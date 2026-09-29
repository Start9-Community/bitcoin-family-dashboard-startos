import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.2.2:1',
  releaseNotes: {
    en_US:
      'Fixed watch-only balances failing against Bitcoin Core 31.1: the helper omitted the JSON-RPC params field on argument-less calls (listwalletdir), which strict RPC parsing now rejects, cascading into "No balance source available".',
    es_ES:
      'Corregido el fallo de los saldos de solo vigilancia con Bitcoin Core 31.1: el asistente omitía el campo params de JSON-RPC en las llamadas sin argumentos (listwalletdir), que el análisis estricto de RPC ahora rechaza.',
    de_DE:
      'Fehler bei Watch-only-Salden mit Bitcoin Core 31.1 behoben: Der Helfer ließ das JSON-RPC-Feld params bei Aufrufen ohne Argumente (listwalletdir) weg, was die strenge RPC-Analyse nun zurückweist.',
    pl_PL:
      'Naprawiono błędy sald tylko do obserwacji z Bitcoin Core 31.1: pomocnik pomijał pole params JSON-RPC w wywołaniach bez argumentów (listwalletdir), które ścisła analiza RPC teraz odrzuca.',
    fr_FR:
      "Correction des soldes en surveillance seule échouant avec Bitcoin Core 31.1 : l'assistant omettait le champ params JSON-RPC des appels sans argument (listwalletdir), désormais rejeté par l'analyse RPC stricte.",
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
