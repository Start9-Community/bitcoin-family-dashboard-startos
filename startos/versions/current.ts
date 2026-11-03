import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.2.2:6',
  releaseNotes: {
    en_US:
      'Uploaded profile pictures (custom avatars) are now stored on the service itself, so they survive reboots, browser cache clears and port changes, appear on every device, and are included in backups. Previously they lived only in each browser and were lost.',
    es_ES:
      'Las fotos de perfil subidas (avatares personalizados) ahora se guardan en el propio servicio: sobreviven a reinicios, borrados de caché y cambios de puerto, aparecen en todos los dispositivos y se incluyen en las copias de seguridad. Antes solo vivían en cada navegador y se perdían.',
    de_DE:
      'Hochgeladene Profilbilder (benutzerdefinierte Avatare) werden jetzt auf dem Dienst selbst gespeichert: Sie überstehen Neustarts, Cache-Löschungen und Portwechsel, erscheinen auf jedem Gerät und sind in Backups enthalten. Zuvor lebten sie nur in jedem Browser und gingen verloren.',
    pl_PL:
      'Przesłane zdjęcia profilowe (niestandardowe awatary) są teraz przechowywane w samej usłudze: przetrwają ponowne uruchomienia, czyszczenie pamięci podręcznej i zmiany portów, są widoczne na każdym urządzeniu i uwzględniane w kopiach zapasowych. Wcześniej istniały tylko w każdej przeglądarce i przepadały.',
    fr_FR: `Les photos de profil téléversées (avatars personnalisés) sont désormais stockées sur le service lui-même : elles survivent aux redémarrages, aux vidages de cache et aux changements de port, apparaissent sur chaque appareil et sont incluses dans les sauvegardes. Auparavant, elles ne vivaient que dans chaque navigateur et étaient perdues.`,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
