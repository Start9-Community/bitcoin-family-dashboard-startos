#!/usr/bin/env node
/**
 * Watch-only wallet balance helper.
 *
 * Serves /api/wallet-balance (proxied by nginx) and /api/scan-status (read by
 * the package's health check). Derives addresses from output descriptors and
 * resolves balances from Bitcoin's RPC (BITCOIND_RPC, set by main.ts while the
 * bitcoind package is installed) or from public address APIs with
 * multi-provider fallback.
 */
import http from 'node:http'
import { createRequire } from 'node:module'
import { BIP32Factory } from 'bip32'
import * as bitcoin from 'bitcoinjs-lib'

const require = createRequire(import.meta.url)
const ecc = require('tiny-secp256k1')

const bip32 = BIP32Factory(ecc)

const PORT = Number(process.env.HELPER_PORT || 8090)
const BITCOIND_RPC = process.env.BITCOIND_RPC || '' // e.g. http://10.0.3.1:8332
const MEMPOOL_API = process.env.MEMPOOL_API || 'https://mempool.space/api'
const NETWORK = process.env.BITCOIN_NETWORK === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

/**
 * Strip a descriptor checksum suffix (#xxxxxx) if present.
 */
function stripChecksum(s) {
  return s.replace(/#[0-9a-z]{8}$/, '').trim()
}

/**
 * Parse a key expression: optional [fingerprint/path] origin, an xpub, and a
 * trailing /path or <a;b> multipath. Returns { xpub, originPath, paths }
 * where paths is a list of trailing path strings (usually ['0'] for /0/*,
 * or ['0','1'] for <0;1>/*). The wildcard (*) is consumed separately.
 */
function parseKeyExpr(expr) {
  let s = stripChecksum(expr).trim()

  // Key origin: [fingerprint/path]xpub...
  let originPath = ''
  let origin = s.match(/^\[([0-9a-fA-F]{8}(?:\/[0-9hH']+)*)\](.*)$/)
  if (origin) {
    originPath = origin[1].slice(9) // drop the fingerprint (8 hex chars), keep /path
    s = origin[2].trim()
  }

  // Multipath: <0;1> suffix (external;change)
  let paths = ['0']
  let mp = s.match(/^(.*)<([0-9;hH']+)>(.*)$/)
  if (mp) {
    s = (mp[1] + mp[3]).trim()
    paths = mp[2].split(';')
  }

  // Collapse any double slash left by multipath removal (xpub...//*)
  s = s.replace(/\/\//, '/')

  // Trailing path like /0/* or bare /* — extract the last non-wildcard dir
  let trailing = ''
  const tp = s.match(/^(.*?)(\/[0-9hH']+\/\*)$/)
  if (tp) {
    trailing = tp[2].replace(/\/\*$/, '')
    s = tp[1].trim()
  } else {
    // bare /* (multipath already consumed the number) or just /N
    const tp2 = s.match(/^(.*?)(\/[0-9hH']+)(\/\*)?$/)
    if (tp2) {
      trailing = tp2[2]
      s = tp2[1].trim()
    } else {
      // strip a bare /* if nothing else matched
      s = s.replace(/\/\*$/, '')
    }
  }

  const xpub = s.trim()
  if (!/^[xyuvt]pub/.test(xpub)) {
    throw new Error(`Could not parse xpub from: ${expr}`)
  }
  return { xpub, originPath, paths, trailing }
}

/** Apply a derivation path string ("/0/1h/2") to a node. */
function derivePath(node, path) {
  let cur = node
  const parts = path.split('/').filter(Boolean)
  for (const p of parts) {
    let idx = parseInt(p, 10)
    let hardened = false
    if (isNaN(idx)) {
      const m = p.match(/^(\d+)([hH'])$/)
      if (m) { idx = parseInt(m[1], 10); hardened = true }
      else throw new Error(`Bad path component: ${p}`)
    }
    cur = hardened ? cur.deriveHardened(idx) : cur.derive(idx)
  }
  return cur
}

function parseDescriptor(descriptor) {
  const desc = stripChecksum(descriptor).trim()

  // Bare xpub -> wpkh
  if (/^[xyuvt]pub/.test(desc)) {
    const parsed = parseKeyExpr(desc)
    return { type: 'wpkh', ...parsed }
  }

  // tr(xpub...)
  let m = desc.match(/^tr\(([^)]*)\)$/)
  if (m) {
    const parsed = parseKeyExpr(m[1])
    return { type: 'tr', ...parsed }
  }

  // wpkh(xpub...)
  m = desc.match(/^wpkh\(([^)]*)\)$/)
  if (m) {
    const parsed = parseKeyExpr(m[1])
    return { type: 'wpkh', ...parsed }
  }

  // pkh(xpub...)
  m = desc.match(/^pkh\(([^)]*)\)$/)
  if (m) {
    const parsed = parseKeyExpr(m[1])
    return { type: 'pkh', ...parsed }
  }

  // sh(wpkh(xpub...))
  m = desc.match(/^sh\(wpkh\(([^)]*)\)\)$/)
  if (m) {
    const parsed = parseKeyExpr(m[1])
    return { type: 'shwpkh', ...parsed }
  }

  // wsh(sortedmulti(M,key1,key2,...)) — P2WSH multisig
  m = desc.match(/^wsh\(sortedmulti\((\d+),(.*)\)\)$/)
  if (m) {
    const M = parseInt(m[1], 10)
    const keyExprs = m[2].split(/,(?![^[]*\])/) // split on commas not inside [origin]
    const parsedKeys = keyExprs.map((ke) => parseKeyExpr(ke.trim()))
    return { type: 'wsh', M, keys: parsedKeys, paths: parsedKeys[0].paths }
  }

  throw new Error(`Unsupported descriptor format: ${descriptor}`)
}

/** Derive address at index i for a parsed descriptor node.
 *  Handles multipaths (<0;1>), trailing /N paths, and multisig.
 *
 *  IMPORTANT: the origin path ([fp/.../N]) is NOT re-applied here — the xpub
 *  string already encodes its own depth (BIP32). The descriptor's origin is
 *  informational metadata. The <0;1> branch and * index derive DIRECTLY from
 *  the xpub. Re-applying the origin double-derives and produces wrong
 *  addresses (verified: funded address found at direct branch 0 index 136). */
function deriveAddress(parsed, i) {
  if (parsed.type === 'wsh') {
    // Multisig: each key's xpub -> branch -> index, sort pubkeys, redeem.
    // IMPORTANT: honor the branch being scanned (parsed.trailing — set by
    // balanceFromMempool to '/0' or '/1' when iterating the <0;1> multipath).
    // Previously this used each key's OWN k.trailing || k.paths[0], which for
    // a <0;1> descriptor always resolved to branch 0 — so scanning branch 0
    // AND branch 1 derived the SAME addresses and double-counted every UTXO
    // (330 sats displayed as 660). The scanned branch must win.
    const scannedBranch = parsed.trailing || ''
    const branch = scannedBranch || `/${(parsed.paths && parsed.paths[0]) || '0'}`
    const pubkeys = parsed.keys.map((k) => {
      let node = bip32.fromBase58(k.xpub)
      if (branch) node = derivePath(node, branch)
      return node.derive(i).publicKey
    })
    pubkeys.sort(Buffer.compare)
    const redeem = bitcoin.payments.p2wsh({
      redeem: bitcoin.payments.p2ms({ m: parsed.M, pubkeys, network: NETWORK }),
      network: NETWORK,
    })
    return redeem.address
  }

  let node = bip32.fromBase58(parsed.xpub)

  // The trailing path before the wildcard is the account/change level;
  // use path 0 (or the multipath branch 0) by default. Origin NOT applied.
  const branch = (parsed.trailing || '') ? parsed.trailing : (parsed.paths && parsed.paths[0] ? `/${parsed.paths[0]}` : '')
  if (branch) node = derivePath(node, branch)

  const child = node.derive(i)
  const pubkey = child.publicKey

  switch (parsed.type) {
    case 'tr': {
      const xonly = pubkey.slice(1)
      return bitcoin.payments.p2tr({ internalPubkey: xonly, network: NETWORK }).address
    }
    case 'pkh':
      return bitcoin.payments.p2pkh({ pubkey, network: NETWORK }).address
    case 'shwpkh':
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey, network: NETWORK }),
        network: NETWORK,
      }).address
    case 'wpkh':
    default:
      return bitcoin.payments.p2wpkh({ pubkey, network: NETWORK }).address
  }
}

/** Build a scantxoutset descriptor for a parsed wallet descriptor.
 *  e.g. wpkh(xpub/0/*) or wsh(sortedmulti(2,xpub1/0/*,xpub2/0/*,...))
 *  with an explicit range so one RPC call scans the whole wallet. */
function buildScanDescriptor(parsed, branch) {
  const path = `/${branch}/*`
  switch (parsed.type) {
    case 'wsh': {
      const keys = parsed.keys
        .map((k) => k.xpub + path)
        .join(',')
      return `wsh(sortedmulti(${parsed.M},${keys}))`
    }
    case 'tr':
      return `tr(${parsed.xpub}${path})`
    case 'pkh':
      return `pkh(${parsed.xpub}${path})`
    case 'shwpkh':
      return `sh(wpkh(${parsed.xpub}${path}))`
    case 'wpkh':
    default:
      return `wpkh(${parsed.xpub}${path})`
  }
}

const SCAN_RANGE = 300 // descriptor import range (like importdescriptors range)

/** Wallet name for a member: watchonly_<slug> so each member's balance is
 *  isolated (a shared wallet would total across all descriptors). */
function walletNameFor(memberName) {
  const slug = memberName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20)
  return `watchonly_${slug || 'member'}`
}

/** Query the whole wallet balance via Bitcoin Core RPC using a watch-only
 *  wallet: import the descriptor once (range [0, N]), then getbalance —
 *  near-instant on every refresh (no full UTXO scan per request).
 *  Each member gets their own wallet so balances stay isolated. */
async function balanceFromBitcoind(parsed, memberName) {
  const WATCH_WALLET = walletNameFor(memberName)
  let auth
  try {
    const fs = await import('node:fs')
    // The whole-volume mount resolves the chain-data dir directly at the
    // mountpoint, so the cookie is at /mnt/bitcoind/.cookie (not main/.cookie).
    const cookie = fs.readFileSync('/mnt/bitcoind/.cookie', 'utf8').trim()
    const [user, pass] = cookie.split(':')
    auth = Buffer.from(`${user}:${pass}`).toString('base64')
  } catch (e) {
    console.error(`Could not read bitcoind cookie: ${e.message}`)
    return null
  }

  const rpc = async (method, params = [], wallet = false) => {
    // params MUST always be sent: JSON.stringify drops the key when it is
    // undefined, and Bitcoin Core 31.1 (strict JSON-RPC parsing; verified
    // on-box 2026-09-29) rejects the body with -32700 "missing field
    // `params`". Older Core tolerated the omission. This broke listwalletdir
    // (the only call with no args) on Core 31.1, which cascaded into false
    // "wallet missing" → createwallet → -4 "Database already exists" →
    // "No balance source available".
    const url = wallet ? `${BITCOIND_RPC}/wallet/${WATCH_WALLET}` : `${BITCOIND_RPC}/`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ jsonrpc: '1.0', id: 'wallet-helper', method, params }),
    })
    if (!res.ok) {
      const txt = await res.text()
      console.error(`bitcoind RPC error ${method}: ${res.status} ${txt.slice(0, 160)}`)
      return null
    }
    const data = await res.json()
    if (data.error) {
      // Wallet not found / not loaded — sentinel so caller creates it
      if (data.error.code === -18) return { walletNotFound: true }
      console.error(`bitcoind RPC error ${method}: ${JSON.stringify(data.error)}`)
      return null
    }
    return data.result
  }

  // 1. Ensure the watch-only wallet exists (disable_private_keys=true so
  // watch-only descriptors can be imported). Fresh name => no stale-wallet
  // conflict.
  const wallets = await rpc('listwalletdir')
  const exists = wallets?.wallets?.some((w) => w.name === WATCH_WALLET)
  if (!exists) {
    const created = await rpc('createwallet', [WATCH_WALLET, true, false]) // disable_private_keys=true, blank=false
    if (!created) {
      console.error('Could not create watch-only wallet')
      return null
    }
  }

  // 2. Import any descriptors NOT already in the wallet. Already-imported
  // ones (e.g. from a prior install with a different range) are skipped —
  // re-importing with a smaller range fails with 'new range must include
  // current range'. getdescriptorinfo provides the checksum Core requires.
  const branches = parsed.paths && parsed.paths.length ? parsed.paths : ['0']
  const importRequests = []
  for (const b of branches) {
    const rawDesc = buildScanDescriptor(parsed, b)
    const info = await rpc('getdescriptorinfo', [rawDesc])
    if (!info || !info.descriptor) {
      console.error(`getdescriptorinfo failed for ${rawDesc}`)
      return null
    }
    // Is this descriptor already imported? (listdescriptors takes only
    // `private` bool — filter in JS)
    const existing = await rpc('listdescriptors', [false], true)
    const alreadyImported = existing?.descriptors?.some((d) => d.desc === info.descriptor)
    if (!alreadyImported) {
      importRequests.push({
        desc: info.descriptor, // includes #checksum
        // Full-history rescan (timestamp 0) on first import so funds from ANY
        // date are seen. Previously 1704067200 (2024-01-01) — but real wallets
        // can hold funds older than 2024 (verified: Satoshi has a funded
        // address at index 37 whose tx is from April 2023; the 2024 cutoff
        // made bitcoind under-report 0.02743255 instead of the true
        // 0.05143255). The rescan is one-time (a few minutes); after import,
        // getbalance is instant.
        timestamp: 0,
        range: [0, SCAN_RANGE],
        active: true,
        internal: b === '1',
        watchonly: true,
      })
    }
  }
  if (importRequests.length > 0) {
    const importResult = await rpc('importdescriptors', [importRequests], true)
    if (!importResult) return null
    const failed = importResult.filter((r) => !r.success)
    if (failed.length > 0) {
      console.error(`importdescriptors failed: ${JSON.stringify(failed[0])}`)
      return null
    }
  }

  // 3. A balance read mid-rescan is partial: report the rescan instead.
  const info = await rpc('getwalletinfo', [], true)
  if (info?.scanning) return { rescanning: info.scanning.progress ?? 0 }

  const bal = await rpc('getbalance', ['*', 1, true], true) // include watchonly
  if (bal === null) return null
  return Math.round(bal * 1e8)
}

const GAP_LIMIT = 20 // stop scanning after this many unused addresses past the last used one
const MAX_RANGE = 200 // hard cap per branch (keep scans light for rate-limited public APIs)
const SCAN_CONCURRENCY = 5 // public APIs rate-limit; keep modest
const SCAN_BATCH_DELAY_MS = 200 // pause between batches

// ── Address-balance providers (tried in order) ──────────────────
// fetchWithRetry handles transient 429/5xx with backoff so a provider that
// rate-limits us doesn't immediately look "dead".
async function fetchWithRetry(url, { attempts = 3, baseDelay = 400, provider = '' } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`${provider} ${res.status} for ${url}`)
        await new Promise((r) => setTimeout(r, baseDelay * (i + 1) * 2))
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, baseDelay * (i + 1)))
    }
  }
  throw lastErr || new Error(`${provider} fetch failed`)
}

const PROVIDERS = [
  {
    name: 'mempool.space',
    async query(address) {
      const res = await fetchWithRetry(`https://mempool.space/api/address/${address}`, { provider: this.name })
      if (!res.ok) throw new Error(`mempool ${res.status} for ${address}`)
      const data = await res.json()
      const stats = data.chain_stats || {}
      const mempool = data.mempool_stats || {}
      const bal = (stats.funded_txo_sum || 0) - (stats.spent_txo_sum || 0) +
                  (mempool.funded_txo_sum || 0) - (mempool.spent_txo_sum || 0)
      const txCount = (stats.tx_count || 0) + (mempool.tx_count || 0)
      return { balanceSats: bal, txCount }
    },
  },
  {
    name: 'blockstream.info',
    // Same chain_stats/mempool_stats shape as mempool.space.
    async query(address) {
      const res = await fetchWithRetry(`https://blockstream.info/api/address/${address}`, { provider: this.name })
      if (!res.ok) throw new Error(`blockstream ${res.status} for ${address}`)
      const data = await res.json()
      const stats = data.chain_stats || {}
      const mempool = data.mempool_stats || {}
      const bal = (stats.funded_txo_sum || 0) - (stats.spent_txo_sum || 0) +
                  (mempool.funded_txo_sum || 0) - (mempool.spent_txo_sum || 0)
      const txCount = (stats.tx_count || 0) + (mempool.tx_count || 0)
      return { balanceSats: bal, txCount }
    },
  },
  {
    name: 'blockcypher.com',
    // { balance, unconfirmed_balance } in satoshis.
    async query(address) {
      const res = await fetchWithRetry(`https://api.blockcypher.com/v1/btc/main/addrs/${address}`, { provider: this.name })
      if (!res.ok) throw new Error(`blockcypher ${res.status} for ${address}`)
      const data = await res.json()
      const bal = data.final_balance ?? data.balance ?? 0
      const unconf = data.unconfirmed_balance ?? 0
      return { balanceSats: bal + unconf, txCount: data.n_tx || 0 }
    },
  },
  {
    name: 'blockchain.info',
    // Plain integer = confirmed balance in satoshis (no mempool/unconfirmed).
    async query(address) {
      const res = await fetchWithRetry(`https://blockchain.info/q/addressbalance/${address}`, { provider: this.name })
      if (!res.ok) throw new Error(`blockchain.info ${res.status} for ${address}`)
      const txt = (await res.text()).trim()
      const bal = parseInt(txt, 10)
      if (isNaN(bal)) throw new Error(`blockchain.info bad response: ${txt.slice(0, 40)}`)
      return { balanceSats: bal, txCount: bal > 0 ? 1 : 0 }
    },
  },
]

/** Query one address across all providers. Returns { balanceSats, txCount,
 *  provider } or null if every provider failed. Providers are tried in
 *  order with a per-attempt timeout so a dead one is skipped fast. */
async function queryAddressWithFallback(address) {
  for (const p of PROVIDERS) {
    if (p.dead) continue // probed unreachable at startup — skip fast
    try {
      const info = await withTimeout(p.query(address), 8000)
      return { ...info, provider: p.name }
    } catch (e) {
      // Try next provider
    }
  }
  console.error(`All address providers failed for ${address}`)
  return null
}

/** Probe a provider at startup: does one cheap call succeed? Marks it
 *  reachable/dead so the scan skips unreachable providers immediately
 *  (mempool.space can hang ~10s per connect before timing out, which
 *  otherwise stalls every address in the scan). A 429 (rate limit) does
 *  NOT mark a provider dead — it's reachable, just throttled right now. */
async function probeProvider(p) {
  try {
    const res = await withTimeout(p.query('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'), 10000)
    p.dead = false
    console.log(`provider ${p.name}: reachable`)
  } catch (e) {
    // Distinguish "throttled" (429/5xx or slow response — reachable, retry
    // later) from "unreachable" (connection refused/DNS — skip for now).
    const throttled = /429|5\d\d|timeout/i.test(e.message || '')
    if (throttled) {
      p.dead = false
      console.log(`provider ${p.name}: throttled (${e.message}), will retry`)
    } else {
      p.dead = true
      console.log(`provider ${p.name}: unreachable, skipping`)
    }
  }
}

/** Probe all providers once at startup. */
async function probeAllProviders() {
  await Promise.all(PROVIDERS.map((p) => probeProvider(p)))
}

// Re-probe providers periodically so ones that were rate-limited or down at
// boot recover without a container restart.
let PROBE_LOCK = Promise.resolve()
setInterval(() => {
  PROBE_LOCK = PROBE_LOCK.then(() => probeAllProviders()).catch(() => {})
}, 10 * 60 * 1000).unref()

/** Race a promise against a timeout. */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

/** Scan a wallet's balance from public address APIs (mempool.space with
 *  blockstream/blockcypher/blockchain.info fallback). Scans per branch
 *  with a gap limit: stops GAP_LIMIT addresses after the last used one so
 *  we never hammer 500 addresses/branch against rate-limited public APIs.
 *  Returns { balanceSats, addresses, lastUsedIndex, provider } or null on
 *  total failure (all providers unreachable). */
async function balanceFromMempool(parsed) {
  const branches = parsed.paths && parsed.paths.length ? parsed.paths : ['0']
  let total = 0
  const allAddresses = []
  let lastUsedIndex = -1
  let queries = 0
  let nulls = 0
  const usedProviders = new Set()

  for (const branch of branches) {
    const branchParsed = { ...parsed, trailing: `/${branch}` }
    let consecutiveEmpty = 0
    let branchMaxUsed = -1
    let i = 0

    while (i < MAX_RANGE) {
      const batchAddrs = []
      const batchIndices = []
      for (let k = 0; k < SCAN_CONCURRENCY && i < MAX_RANGE; k++, i++) {
        batchIndices.push(i)
        batchAddrs.push(deriveAddress(branchParsed, i))
      }

      const infos = await Promise.all(
        batchAddrs.map(async (a) => {
          const info = await queryAddressWithFallback(a)
          queries++
          if (!info) { nulls++; return { balanceSats: 0, txCount: 0, provider: null } }
          if (info.provider) usedProviders.add(info.provider)
          return info
        }),
      )

      for (let k = 0; k < infos.length; k++) {
        const idx = batchIndices[k]
        total += infos[k].balanceSats
        if (infos[k].txCount > 0) {
          lastUsedIndex = Math.max(lastUsedIndex, idx)
          branchMaxUsed = idx
          consecutiveEmpty = 0
        } else {
          consecutiveEmpty++
        }
      }
      allAddresses.push(...batchAddrs)

      // Fail fast: if an entire batch failed across ALL providers, the
      // container has no reachable public API — abort, caller falls back.
      if (queries > 0 && nulls === queries) {
        console.error('All address providers unreachable — aborting scan, falling back')
        return null
      }

      // Gap stop: after GAP_LIMIT consecutive empty addresses (either past
      // the last used one, or from the start of an empty branch), we've hit
      // the end of the wallet — stop rather than scanning all 500.
      if (consecutiveEmpty >= GAP_LIMIT) {
        break
      }

      // Respect rate limits
      await new Promise((r) => setTimeout(r, SCAN_BATCH_DELAY_MS))
    }
  }

  // If every query failed across all providers, report null (not a bogus 0).
  if (queries > 0 && nulls === queries) {
    console.error('All address providers unreachable — all queries failed')
    return null
  }

  return {
    balanceSats: total,
    addresses: allAddresses,
    lastUsedIndex,
    providers: [...usedProviders],
  }
}

let scanStatus = { scanning: false, member: '', lastScanAt: null, note: '' }
// True when a watch-only wallet is configured but no successful balance has
// been cached yet (e.g. public providers were rate-limited/unreachable on
// the last attempt). Keeps the health check from claiming "idle" when the
// balance is still unknown — the UI shows "still scanning" instead.
let needsBalance = false
// Cache of computed balances so refresh requests don't re-trigger slow scans.
// TTL: 5 minutes (matches the dashboard refresh interval).
const CACHE_TTL_MS = 5 * 60 * 1000
const balanceCache = new Map() // memberName -> { balanceSats, source, at }

async function handle(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)

    // Scan status endpoint (used by the StartOS health check)
    if (url.pathname === '/api/scan-status') {
      // If a wallet needs a balance (no successful scan yet) but no scan is
      // actively running, report it as scanning so the health check doesn't
      // misleadingly say "idle". A background tick will retry.
      const status = (scanStatus.scanning || needsBalance)
        ? { ...scanStatus, scanning: true }
        : scanStatus
      res.writeHead(200)
      res.end(JSON.stringify(status))
      return
    }

    if (url.pathname !== '/api/wallet-balance') {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'not found' }))
      return
    }

    // Wallet-balance endpoint (or internal background retry)
    const wallets = await runBalanceScan()
    res.writeHead(200)
    res.end(JSON.stringify({ wallets }))
  } catch (e) {
    scanStatus = { scanning: false, member: '', lastScanAt: new Date().toISOString() }
    res.writeHead(500)
    res.end(JSON.stringify({ error: e.message }))
  }
}

/** Run a balance scan for all configured watch-only wallets and return the
 *  per-wallet results. Shared by the HTTP endpoint and the background retry
 *  tick so a wallet that still needs a balance (e.g. providers were down)
 *  is retried automatically without waiting for a dashboard refresh. */
async function runBalanceScan() {
  try {
    // Config is read from the volume at /data/config.json
    const fs = await import('node:fs')
    const raw = fs.readFileSync('/data/config.json', 'utf8')
    const config = JSON.parse(raw)
    const wallets = config.watchOnlyWallets || []

    const processWallet = async (w) => {
      // Serve from cache if fresh — avoids re-triggering slow rescans on
      // every dashboard refresh.
      const cached = balanceCache.get(w.memberName)
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return {
          memberName: w.memberName,
          descriptor: w.descriptor,
          balanceSats: cached.balanceSats,
          addresses: [],
          lastUsedIndex: -1,
          source: cached.source,
          cached: true,
        }
      }

      try {
        // No fresh balance — mark that we still need one (health check will
        // keep showing "scanning" until a real balance is obtained).
        const viaBitcoind = (w.source ?? 'bitcoind') === 'bitcoind'
        scanStatus = {
          scanning: true,
          member: w.memberName,
          lastScanAt: scanStatus.lastScanAt,
          note: viaBitcoind ? 'rescanning' : 'scanning',
          progress: viaBitcoind ? 0 : undefined,
        }
        const parsed = parseDescriptor(w.descriptor)
        let balanceSats = null
        let source = null
        let addresses = []
        let lastUsedIndex = -1
        let mempoolProviders = []

        // A wallet on the local node never falls back to public APIs: the
        // user chose it to keep their addresses off them. Public APIs fall
        // back to the node when it is there.
        const order = viaBitcoind ? ['bitcoind'] : ['mempool', 'bitcoind']

        for (const src of order) {
          if (src === 'bitcoind' && BITCOIND_RPC) {
            const r = await balanceFromBitcoind(parsed, w.memberName)
            if (r !== null && typeof r === 'object') {
              scanStatus = { scanning: true, member: w.memberName, lastScanAt: scanStatus.lastScanAt, note: 'rescanning', progress: r.rescanning }
              return {
                memberName: w.memberName,
                descriptor: w.descriptor,
                balanceSats: null,
                rescanning: r.rescanning,
              }
            }
            if (r !== null) {
              balanceSats = r
              source = 'bitcoind'
              break
            }
          } else if (src === 'mempool') {
            const r = await balanceFromMempool(parsed)
            if (r !== null) {
              balanceSats = r.balanceSats
              addresses = r.addresses
              lastUsedIndex = r.lastUsedIndex
              source = 'mempool'
              mempoolProviders = r.providers || []
              break
            }
          }
        }

        if (source === null) {
          console.error(`No balance source available for ${w.memberName}`)
          return {
            memberName: w.memberName,
            descriptor: w.descriptor,
            balanceSats: null,
            addresses: [],
            lastUsedIndex: -1,
            source: 'none',
            error: 'No balance source available',
          }
        }

        // Cache the computed balance (even 0) so the next refresh is instant
        balanceCache.set(w.memberName, { balanceSats, source, at: Date.now() })

        return {
          memberName: w.memberName,
          descriptor: w.descriptor,
          balanceSats,
          addresses,
          lastUsedIndex,
          source,
          mempoolProviders,
        }
      } catch (e) {
        return {
          memberName: w.memberName,
          descriptor: w.descriptor,
          balanceSats: null,
          error: e.message,
        }
      }
    }

    // Process wallets sequentially (avoids concurrent createwallet races on
    // the same bitcoind). Give the first-time rescan generous time (240s);
    // after the first import completes, subsequent calls are instant.
    const results = []
    for (const w of wallets) {
      const result = await Promise.race([
        processWallet(w),
        new Promise((resolve) =>
          setTimeout(() => resolve({ memberName: w.memberName, descriptor: w.descriptor, balanceSats: null, timedOut: true }), 240000),
        ),
      ])
      results.push(result)
    }

    const pending = results.find((r) => typeof r.balanceSats !== 'number')
    needsBalance = !!pending
    scanStatus = {
      scanning: false,
      member: pending?.memberName ?? '',
      lastScanAt: new Date().toISOString(),
      note: !pending ? '' : typeof pending.rescanning === 'number' ? 'rescanning' : 'waiting for providers',
      progress: pending?.rescanning,
    }

    return results
  } catch (e) {
    scanStatus = { scanning: false, member: '', lastScanAt: new Date().toISOString() }
    console.error(`runBalanceScan error: ${e.message}`)
    return []
  }
}

// Probe public address providers before serving so unreachable ones are
// skipped quickly instead of stalling every balance query with connect timeouts.
probeAllProviders().then(() => {
  http.createServer(handle).listen(PORT, () => {
    console.log(`wallet-helper listening on :${PORT} (bitcoind: ${BITCOIND_RPC || 'none -> mempool'})`)
  })
})

// Background retry: if any configured wallet still needs a balance (no
// successful scan yet — e.g. providers were down/rate-limited), retry the
// scan so the dashboard eventually shows a real balance and the health
// check can stop reporting "still scanning". Guards against concurrent
// scans with a simple in-flight flag.
//
// CRITICAL: back off aggressively on repeated failure. Public address APIs
// (blockstream/blockcypher/blockchain.info) block shared egress IPs for
// HOURS once triggered; retrying every 2 minutes keeps re-triggering the
// block and it never lifts. Track consecutive failures and space retries
// out: 2m → 5m → 15m → 30m → 60m (cap). Any successful scan resets to 2m.
let scanInFlight = false
let consecutiveScanFailures = 0
const RETRY_DELAYS_MS = [2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000]

// Re-schedule the interval when the failure count changes (only grows the
// delay while failing; a success path above resets the counter but the
// timer itself can't easily be reset — instead skip runs that are too
// early by tracking the next-allowed time).
let nextRetryAllowedAt = 0
const retryTick = async () => {
  if (scanInFlight) return
  if (!needsBalance) return
  const now = Date.now()
  if (now < nextRetryAllowedAt) return // backing off — skip this tick
  scanInFlight = true
  try {
    const results = await runBalanceScan()
    const anyResolved = (results || []).some(
      (r) => r && typeof r.balanceSats === 'number' && !r.error && !r.timedOut,
    )
    if (anyResolved) {
      consecutiveScanFailures = 0
      nextRetryAllowedAt = 0
    } else {
      consecutiveScanFailures++
      const delayIdx = Math.min(consecutiveScanFailures - 1, RETRY_DELAYS_MS.length - 1)
      nextRetryAllowedAt = now + RETRY_DELAYS_MS[delayIdx]
      console.log(`balance scan still failing (${consecutiveScanFailures}x) — next retry in ${RETRY_DELAYS_MS[delayIdx] / 60000} min`)
    }
  } catch (e) {
    consecutiveScanFailures++
    const delayIdx = Math.min(consecutiveScanFailures - 1, RETRY_DELAYS_MS.length - 1)
    nextRetryAllowedAt = Date.now() + RETRY_DELAYS_MS[delayIdx]
    console.error(`background retry failed: ${e.message}; next retry in ${RETRY_DELAYS_MS[delayIdx] / 60000} min`)
  } finally {
    scanInFlight = false
  }
}
setInterval(retryTick, 2 * 60 * 1000).unref()
