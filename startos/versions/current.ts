import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.2.2:5',
  releaseNotes: {
    en_US:
      'Updates nginx to 1.31.8. Stops trusting certificates from a compromised certificate authority (eMudhra). Updates the Brotli compression library with security fixes. The dashboard now verifies the certificates of the price and photo services it connects to.',
    es_ES:
      'Actualiza nginx a 1.31.8. Deja de confiar en los certificados de una autoridad de certificación comprometida (eMudhra). Actualiza la biblioteca de compresión Brotli con correcciones de seguridad. El panel ahora verifica los certificados de los servicios de precios y fotos a los que se conecta.',
    de_DE:
      'Aktualisiert nginx auf 1.31.8. Vertraut Zertifikaten einer kompromittierten Zertifizierungsstelle (eMudhra) nicht mehr. Aktualisiert die Brotli-Kompressionsbibliothek mit Sicherheitskorrekturen. Das Dashboard prüft jetzt die Zertifikate der Preis- und Fotodienste, mit denen es sich verbindet.',
    pl_PL:
      'Aktualizuje nginx do wersji 1.31.8. Przestaje ufać certyfikatom przejętego urzędu certyfikacji (eMudhra). Aktualizuje bibliotekę kompresji Brotli o poprawki bezpieczeństwa. Panel weryfikuje teraz certyfikaty usług cen i zdjęć, z którymi się łączy.',
    fr_FR: `Met à jour nginx vers 1.31.8. Ne fait plus confiance aux certificats d'une autorité de certification compromise (eMudhra). Met à jour la bibliothèque de compression Brotli avec des correctifs de sécurité. Le tableau de bord vérifie désormais les certificats des services de prix et de photos auxquels il se connecte.`,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
