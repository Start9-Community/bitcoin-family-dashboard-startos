import { autoconfig } from 'bitcoin-core-startos/startos/actions/config/autoconfig'
import { configJson } from './fileModels/config.json'
import { i18n } from './i18n'
import { bitcoindDescription } from './manifest/i18n'
import { sdk } from './sdk'
import { T } from '@start9labs/start-sdk'

const readsBitcoind = async (effects: T.Effects) =>
  !!(await configJson
    .read((c) => c.watchOnlyWallets.some((w) => w.source === 'bitcoind'))
    .const(effects))

const bitcoind = sdk.Dependency.optional('bitcoind', {
  description: bitcoindDescription,
  metadata: {
    title: 'Bitcoin',
    icon: 'https://raw.githubusercontent.com/Start9Labs/bitcoin-core-startos/refs/heads/31.x/dep-icon.svg',
  },
  versionRange:
    '(>=28.4:42 && <29) || (>=29.5:4 && <30) || (>=30.4:4 && <31) || >=31.2:4 || >=#knotsprerdts:29.3:33',
  kind: 'running',
  healthChecks: ['bitcoind', 'sync-progress'],
  enabled: ({ effects }) => readsBitcoind(effects),
}).withInit(async (effects) => {
  await sdk.action.createTask(effects, 'bitcoind', autoconfig, 'critical', {
    input: {
      kind: 'partial',
      accept: [{ prune: 0, wallet: { enable: true } }],
      set: { prune: 0, wallet: { enable: true } },
    },
    when: { condition: 'input-not-matches', once: false },
    reason: i18n(
      "The dashboard reads balances from Bitcoin's wallet, which needs an unpruned node with its wallet enabled",
    ),
  })
})

export const dependencies = sdk.Dependencies.of().addDependency(bitcoind)
