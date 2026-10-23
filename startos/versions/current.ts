import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.2.2:4',
  releaseNotes: {
    en_US: 'Updates nginx to 1.31.7 and Node.js with security fixes.',
    es_ES: 'Actualiza nginx a 1.31.7 y Node.js con correcciones de seguridad.',
    de_DE:
      'Aktualisiert nginx auf 1.31.7 und Node.js mit Sicherheitskorrekturen.',
    pl_PL:
      'Aktualizuje nginx do wersji 1.31.7 oraz Node.js z poprawkami bezpieczeństwa.',
    fr_FR:
      'Met à jour nginx vers 1.31.7 et Node.js avec des correctifs de sécurité.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
