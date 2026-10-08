import { rpcHostId, rpcPort } from 'bitcoin-core-startos/startos/utils'
import { configJson } from './fileModels/config.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { priceUpstreams, uiPort, walletHelperPort } from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Bitcoin Family Dashboard!'))

  const priceSource = await configJson.read((c) => c.priceSource).const(effects)
  const watchOnlyWallets = await configJson
    .read((c) => c.watchOnlyWallets)
    .const(effects)
  const priceUpstream =
    priceSource?.type === 'custom'
      ? priceSource.apiUrl
      : priceUpstreams[priceSource?.type ?? 'coinbase']

  const bitcoindRpc = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'bitcoind',
      hostId: rpcHostId,
      internalPort: rpcPort,
      ssl: false,
    })
    .const()

  let mounts = sdk.Mounts.of().mountVolume({
    volumeId: 'main',
    subpath: null,
    mountpoint: '/data',
    readonly: false,
  })
  if (bitcoindRpc) {
    mounts = mounts.mountDependency({
      dependencyId: 'bitcoind',
      volumeId: 'main',
      subpath: null,
      mountpoint: '/mnt/bitcoind',
      readonly: true,
    })
  }

  const dashboard = sdk.SubContainer.of(
    effects,
    { imageId: 'dashboard' },
    mounts,
    'dashboard',
  )

  return sdk.Daemons.of(effects)
    .addDaemon('nginx', {
      subcontainer: dashboard,
      exec: {
        command: sdk.useEntrypoint(),
        env: {
          PRICE_UPSTREAM: priceUpstream,
          PRICE_HOST: new URL(priceUpstream).host,
        },
      },
      ready: {
        display: i18n('Web Interface'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, uiPort, {
            successMessage: i18n('The web interface is ready'),
            errorMessage: i18n('The web interface is not ready'),
          }),
      },
      requires: [],
    })
    .addDaemon('wallet-helper', {
      subcontainer: dashboard,
      exec: {
        command: ['node', '/opt/wallet-helper/wallet-helper.mjs'],
        env: bitcoindRpc ? { BITCOIND_RPC: `http://${bitcoindRpc}` } : {},
      },
      ready: {
        display: null,
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, walletHelperPort, {
            successMessage: i18n('The wallet helper is ready'),
            errorMessage: i18n('The wallet helper is not ready'),
          }),
      },
      requires: [],
    })
    .addHealthCheck('watch-scan', {
      ready: {
        display: i18n('Watch-Only Wallets'),
        fn: async () => {
          if (!watchOnlyWallets?.length) {
            return {
              result: 'disabled',
              message: i18n('No watch-only wallets are configured'),
            }
          }

          if (
            !bitcoindRpc &&
            watchOnlyWallets.some((w) => w.source === 'bitcoind')
          ) {
            return {
              result: 'failure',
              message: i18n(
                'A watch-only wallet reads its balance from Bitcoin, but Bitcoin is not installed',
              ),
            }
          }

          const status = await fetch(
            `http://127.0.0.1:${walletHelperPort}/api/scan-status`,
          )
            .then(
              (res) =>
                res.json() as Promise<{
                  scanning: boolean
                  member: string
                  note: string
                  progress?: number
                }>,
            )
            .catch(() => null)
          if (!status) {
            return {
              result: 'failure',
              message: i18n('The wallet helper is not responding'),
            }
          }

          if (status.note === 'wallet disabled') {
            return {
              result: 'failure',
              message: i18n(
                "Bitcoin's wallet is disabled. Turn on Enable Wallet in Bitcoin's Other Settings.",
              ),
            }
          }

          if (!status.scanning) {
            return {
              result: 'success',
              message: i18n('Watch-only wallet balances are up to date'),
            }
          }
          return {
            result: 'loading',
            message:
              status.note === 'rescanning'
                ? i18n(
                    'Bitcoin is rescanning the chain for ${member} (${progress}%)',
                    {
                      member: status.member,
                      progress: String(
                        Math.floor((status.progress ?? 0) * 100),
                      ),
                    },
                  )
                : i18n(
                    'Scanning for watch-only wallet balances. Public address APIs are rate-limited, so a first scan can take hours.',
                  ),
          }
        },
      },
      requires: ['wallet-helper'],
    })
})
