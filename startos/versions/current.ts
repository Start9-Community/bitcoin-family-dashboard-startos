import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.2.2:7',
  releaseNotes: {
    en_US: `Requires StartOS 0.4.2 or later.

The dashboard's access to Bitcoin's data is limited to its RPC credentials. If a watch-only wallet reads its balance from Bitcoin on this server, update Bitcoin when StartOS asks.`,
    es_ES: `Requiere StartOS 0.4.2 o posterior.

El acceso del panel a los datos de Bitcoin se limita a sus credenciales RPC. Si una billetera de solo lectura obtiene su saldo de Bitcoin en este servidor, actualiza Bitcoin cuando StartOS lo pida.`,
    de_DE: `Erfordert StartOS 0.4.2 oder neuer.

Der Zugriff des Dashboards auf die Daten von Bitcoin ist auf dessen RPC-Zugangsdaten beschränkt. Wenn eine Watch-only-Wallet ihren Kontostand von Bitcoin auf diesem Server liest, aktualisiere Bitcoin, sobald StartOS dazu auffordert.`,
    pl_PL: `Wymaga StartOS 0.4.2 lub nowszego.

Dostęp panelu do danych Bitcoina ogranicza się do jego danych uwierzytelniających RPC. Jeśli portfel tylko do odczytu pobiera saldo z Bitcoina na tym serwerze, zaktualizuj Bitcoina, gdy StartOS o to poprosi.`,
    fr_FR: `Nécessite StartOS 0.4.2 ou une version ultérieure.

L’accès du tableau de bord aux données de Bitcoin se limite à ses identifiants RPC. Si un portefeuille en lecture seule lit son solde depuis Bitcoin sur ce serveur, mettez Bitcoin à jour lorsque StartOS le demande.`,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
