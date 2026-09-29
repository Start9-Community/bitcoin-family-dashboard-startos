<p align="center">
  <img src="icon.svg" alt="Bitcoin Family Dashboard Logo" width="21%">
</p>

# Bitcoin Family Dashboard on StartOS

> Everything not listed in this document should behave the same as upstream
> Bitcoin Family Dashboard. If a feature, setting, or behavior is not mentioned
> here, the upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[Bitcoin Family Dashboard](https://github.com/wahidsaleemi/bitcoin-family-dashboard) is a single static page that shows each family member's bitcoin holdings, their value at the live price, profit and loss against an average cost basis, and 30-day, 1-year and 10-year price charts. Upstream it is a folder of HTML you serve yourself and configure by editing a JSON file; this package serves it with nginx, owns that JSON file through StartOS actions, proxies every outbound API call so the browser never hits CORS, and adds a small Node helper that resolves watch-only wallet balances — from Bitcoin on the same server when it is installed, otherwise from public address APIs.

- **Upstream repo:** <https://github.com/wahidsaleemi/bitcoin-family-dashboard>
- **Wrapper repo:** <https://github.com/Start9-Community/bitcoin-family-dashboard-startos>

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

One image, built by this repo's `Dockerfile` from the `bitcoin-family-dashboard/` git submodule, which is pinned at an upstream commit — upstream ships no image and no releases.

| Property      | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Image         | `dashboard`, built from `./Dockerfile`                 |
| Base          | `nginx:alpine`, plus Alpine's `nodejs` for the helper |
| Architectures | x86_64, aarch64                                        |
| User          | root                                                   |

The image copies the dashboard's static files into nginx's web root and the wallet helper (`wallet-helper/`) into `/opt/wallet-helper` with its dependencies preinstalled. Two daemons share one subcontainer:

| Subcontainer | Daemon          | Command                                       | Purpose                                                                    |
| ------------ | --------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `dashboard`  | `nginx`         | the image entrypoint (`nginx -g 'daemon off'`) | Serves the page and `config.json`, proxies the price, chart and Pexels APIs |
| `dashboard`  | `wallet-helper` | `node /opt/wallet-helper/wallet-helper.mjs`   | Derives addresses from watch-only descriptors and resolves their balances  |

`nginx-templates/default.conf.template` is rendered by the image's own entrypoint at start, with `PRICE_UPSTREAM` and `PRICE_HOST` substituted from the selected price source. Changing the price source therefore restarts the service. The helper listens on loopback port 8090 only; nginx proxies `/api/wallet-balance` to it.

## Volume and Data Layout

One volume, holding one file.

| Volume | Mount Point | Purpose                                   |
| ------ | ----------- | ----------------------------------------- |
| `main` | `/data`     | `config.json`, the dashboard's whole state |

When Bitcoin is installed, its `main` volume is additionally mounted read-only at `/mnt/bitcoind` so the helper can read the RPC cookie. The mount is only declared while Bitcoin is present; the service restarts once when Bitcoin is installed or removed.

There is no `store.json`: every setting is upstream configuration the page itself reads, so it all lives in `config.json`.

## File Models

One model, and it is the whole configuration surface.

| Model        | File                | Format |
| ------------ | ------------------- | ------ |
| `configJson` | `/data/config.json` | JSON   |

`config.json` is the file upstream tells you to edit by hand. The page fetches it on load, and the wallet helper re-reads it on every balance scan. It holds the dashboard title, the family members (name, manual BTC amount, average cost, avatar placeholder), the price source, the Pexels settings, and the watch-only wallet bindings.

It is seeded on every container init with `merge(effects, {})`, so a fresh install gets the schema defaults — one member, "Satoshi", holding 0.125 BTC at a $40,000 cost basis, Coinbase as the price source, backgrounds off — and a missing or invalid key is repaired to its default. Nothing else is re-asserted: the two actions are the only writers after that, each rewriting only the keys it owns. A hand edit survives restarts and updates, and is overwritten only by the next action that touches the same key.

The Pexels API key is served to the browser as part of `config.json`, because the page itself sends it with every Pexels request. Anyone who can reach the dashboard can read it.

While a Pexels background is displayed, the page shows a small attribution pill in the bottom-right corner — "Photos provided by Pexels · Photo by <photographer>" — with links to Pexels and to the photo page, as the [Pexels API guidelines](https://www.pexels.com/api/documentation/#guidelines) require. It disappears when backgrounds are disabled or no photo is shown.

## Dependencies

One optional dependency.

| Dependency | Required | Health checks               | Mount                              | Why                                                                           |
| ---------- | -------- | --------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| Bitcoin    | No       | `bitcoind`, `sync-progress` | `main` at `/mnt/bitcoind`, read-only | Resolves watch-only balances locally instead of through public address APIs |

The dependency is declared as current only while a watch-only wallet is configured with **Bitcoin on this server** as its balance source; a dashboard without watch-only wallets, or one using public APIs, shows no dependency warning at all. The helper authenticates with Bitcoin's RPC cookie over the host bridge, so no RPC user is created.

## Network Access and Interfaces

One interface, serving the page.

| Interface | Id   | Type | Port | Description                          |
| --------- | ---- | ---- | ---- | ------------------------------------ |
| Web UI    | `ui` | ui   | 80   | The dashboard, with its `config.json` |

The port is bound on the `main` MultiHost over plain HTTP and is not masked. The dashboard has no login: whoever can open the address sees every member's holdings and can read `config.json`.

Everything the page needs from the internet goes out through nginx rather than the browser: Coinbase Exchange, Binance, Bitstamp or the custom endpoint for the price; Binance and blockchain.com for chart history; Pexels for backgrounds. The wallet helper reaches mempool.space, blockstream.info, blockcypher.com and blockchain.info directly when it falls back to public APIs.

## Installation and First-Run Flow

Nothing to set up. Install seeds `config.json` with the sample "Satoshi" member and the service starts on its own; opening the address shows the sample dashboard immediately. Replacing the sample data with the real family is done through the two actions, and nothing holds the service on a prompt.

## Actions

Two actions, and between them they own every key in `config.json`. Neither restarts the service on its own; the price source is the one setting whose change causes a restart, because nginx reads it only at start.

### `manage-family-members` — Manage Family Members

- **When to run it:** to add, remove or edit a family member, including switching a member between a hand-entered amount and a watch-only wallet.
- **What it changes:** `familyMembers` and `watchOnlyWallets` in `config.json`, rewritten as a whole from the form. A member's avatar placeholder and — for a member switched to a watch-only wallet — the last manual amount are carried over rather than cleared.
- **Cost:** instant. Changing the set of watch-only wallets restarts the service so the helper starts a fresh scan; other edits take effect on the page's next refresh.
- **Repeat safety:** idempotent — the form always shows the current file, and saving it unchanged writes nothing.
- **What happens next:** a newly attached watch-only wallet shows "Fetching…" on the page and the **Watch-Only Wallets** health check turns to loading until the first balance arrives (see [Health Checks](#health-checks) for how long that can be).
- **Outputs:** none.

The form holds at most six members, and names must be unique because the watch-only binding is keyed by name. A watch-only descriptor accepts `wpkh`, `pkh`, `sh(wpkh)`, `tr`, `wsh(sortedmulti(...))`, or a bare `xpub`; only `xpub`-encoded keys work (no `ypub`/`zpub`), the key origin prefix and a `<0;1>` multipath are accepted, and the descriptor checksum is optional. A wallet on **Bitcoin on this server** never falls back to public APIs — that is the point of choosing it — and the action refuses that source while Bitcoin is not installed. A wallet on **Public address APIs** uses Bitcoin as a fallback when it is installed.

### `configure-dashboard` — Configure Dashboard

- **When to run it:** to rename the dashboard, pick a different price source, or turn rotating Pexels background photos on or off.
- **What it changes:** `title`, `priceSource` and `pexels` in `config.json`.
- **Cost:** instant for the title and backgrounds. Changing the price source restarts the service, a second or two of downtime.
- **Repeat safety:** idempotent.
- **What happens next:** the page picks up the new title and background setting on its next refresh; the new price source is live once the service is back.
- **Outputs:** none.

A custom price API must be an `http://` or `https://` URL returning JSON in either the `{"price", "change24h"}` or the CoinGecko `{"bitcoin": {"usd", "usd_24h_change"}}` shape. nginx proxies it verbatim with the `Host` header set to the URL's host; there is no way to attach an API key to it. Enabling backgrounds without a Pexels key is rejected.

## Tasks

None. This package raises no tasks, so the service is never held on a prompt and its ordinary controls are always available.

## Health Checks

Two checks: one on the web server, one standalone on the balance scan. The helper daemon's own readiness (port 8090) is not displayed.

| Check        | Displayed            | Method                                                  |
| ------------ | -------------------- | ------------------------------------------------------- |
| `nginx`      | "Web Interface"      | Port 80 is listening                                    |
| `watch-scan` | "Watch-Only Wallets" | The helper's scan status, read from `127.0.0.1:8090`    |

**Web Interface** failing means nginx did not start — almost always a rendering error in the config template, which the service logs will show as an nginx `[emerg]` line; a custom price URL that nginx cannot parse as an upstream is the one user-reachable cause.

**Watch-Only Wallets** is `disabled` while no watch-only wallet is configured; that is the normal state of a dashboard tracking holdings by hand. With wallets configured it is:

- `loading` while any wallet still has no balance. With Bitcoin as the source, the first scan of a descriptor imports it into a watch-only wallet on the node with a full rescan from genesis; the message reports the member and the rescan's progress, and the page shows "Fetching…" rather than the partial figure the node would return mid-rescan. That rescan can take an hour or more on an archival node; every later refresh is instant. With public address APIs as the source, the providers rate-limit aggressively — a first scan can take hours, and the helper backs off between retries (2, 5, 15, 30, then 60 minutes) so it never keeps a block in place.
- `success` once every configured wallet has a balance. Balances are cached for five minutes and refreshed on the page's schedule. It is also what a freshly started helper reports before the page has asked for anything.
- `failure` when a wallet is set to read from Bitcoin but Bitcoin is not installed (install it, or move the wallet to public APIs), or when the helper does not answer at all. It probes the public providers before it listens, so a few seconds of failure right after start is normal; anything longer means the helper process died, and its stderr is in the service logs.

## Backups and Restore

The `main` volume is copied wholesale — `sdk.Backups.ofVolumes('main')` — so a backup is the one `config.json` and a restore brings back every member, wallet descriptor and setting exactly. Nothing is excluded.

A restored instance has no cached balances and re-scans each watch-only wallet from scratch, with the same first-scan cost as a fresh install. Custom member avatars are not in the backup at all: the page stores them in the browser's `localStorage`, per device.

## Limitations and Differences

1. **No authentication.** Upstream has none and the package adds none. The interface exposes the family's holdings and the Pexels key to anyone who can reach it.
2. **Bitcoin-backed balances create wallets on the node.** Each watch-only member gets a `watchonly_<name>` descriptor wallet in Bitcoin's wallet directory, imported with a full rescan. Uninstalling the dashboard does not remove them.
3. **Bitcoin must be archival for local balances.** A pruned node rejects the rescan, and a wallet set to Bitcoin never falls back to public APIs, so it stays on "Fetching…" until it is switched.
4. **Only `xpub`-encoded keys.** `ypub`/`zpub`/`vpub` keys are rejected by the helper even though upstream's descriptor parser appears to accept them.
5. **Custom avatars are per browser.** They live in `localStorage`, not in `config.json`, so they are neither shared between devices nor backed up.
6. **The custom price API cannot carry an API key.** Upstream's `apiKey` field is not wired to anything, so the package does not offer it.

---

## Quick Reference for AI Consumers

```yaml
package_id: bitcoin-family-dashboard
image: dashboard # built from ./Dockerfile against the bitcoin-family-dashboard/ submodule
architectures:
  - x86_64
  - aarch64
subcontainers:
  - dashboard # nginx + wallet-helper
volumes:
  main: /data
file_models:
  - /data/config.json
startos_managed_env_vars:
  - PRICE_UPSTREAM # nginx: the price API to proxy
  - PRICE_HOST # nginx: its Host header
  - BITCOIND_RPC # wallet-helper: Bitcoin's RPC bridge address, absent when Bitcoin is not installed
dependencies:
  - bitcoind # optional; current only while a wallet uses it
interfaces:
  ui: { type: ui, port: 80 }
actions:
  - manage-family-members
  - configure-dashboard
tasks: []
health_checks:
  - nginx # displayed "Web Interface"
  - watch-scan # displayed "Watch-Only Wallets"
```
