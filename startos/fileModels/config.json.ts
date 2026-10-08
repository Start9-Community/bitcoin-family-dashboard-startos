import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const defaultTitle = 'Bitcoin Family Dashboard'

const familyMemberShape = z.looseObject({
  name: z.string(),
  avatar: z.string().catch(''),
  btcAmount: z.number().catch(0),
  avgCost: z.number().catch(0),
})

export const priceSourceTypes = [
  'coinbase',
  'binance',
  'bitstamp',
  'custom',
] as const

const priceSourceShape = z.looseObject({
  type: z.enum(priceSourceTypes).catch('coinbase'),
  apiUrl: z.string().catch(''),
})

const pexelsShape = z.looseObject({
  enabled: z.boolean().catch(false),
  apiKey: z.string().catch(''),
})

export const balanceSources = ['bitcoind', 'mempool'] as const

const watchOnlyWalletShape = z.looseObject({
  memberName: z.string(),
  descriptor: z.string(),
  source: z.enum(balanceSources).catch('bitcoind'),
})

const shape = z.looseObject({
  title: z.string().catch(defaultTitle),
  familyMembers: z
    .array(familyMemberShape)
    .catch([{ name: 'Satoshi', avatar: '', btcAmount: 0.125, avgCost: 40000 }]),
  priceSource: priceSourceShape.catch(() => priceSourceShape.parse({})),
  pexels: pexelsShape.catch(() => pexelsShape.parse({})),
  watchOnlyWallets: z.array(watchOnlyWalletShape).catch([]),
})

export type FamilyMember = z.infer<typeof familyMemberShape>
export type WatchOnlyWallet = z.infer<typeof watchOnlyWalletShape>

export const configJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'config.json' },
  shape,
)
