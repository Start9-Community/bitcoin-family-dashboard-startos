import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.2.2:1',
  releaseNotes: {
    en_US:
      'Fixed watch-only balances failing against Bitcoin Core 31.1 (missing params field in JSON-RPC) and restored Pexels background photos (the proxy sent the API key in the wrong format, so Pexels returned 401). Background photos now carry photographer attribution per the Pexels API guidelines.',
    es_ES:
      'Corregido el fallo de los saldos de solo vigilancia con Bitcoin Core 31.1 (falta el campo params en JSON-RPC) y restauradas las fotos de fondo de Pexels (el proxy enviaba la clave en un formato incorrecto y Pexels devolvía 401). Las fotos de fondo ahora muestran la atribución del fotógrafo según las directrices de la API de Pexels.',
    de_DE:
      'Fehler bei Watch-only-Salden mit Bitcoin Core 31.1 behoben (fehlendes params-Feld im JSON-RPC) und Pexels-Hintergrundbilder wiederhergestellt (der Proxy sendete den API-Schlüssel im falschen Format, Pexels antwortete mit 401). Hintergrundbilder zeigen nun die Fotografen-Nennung gemäß den Pexels-API-Richtlinien.',
    pl_PL:
      'Naprawiono błędy sald tylko do obserwacji z Bitcoin Core 31.1 (brak pola params w JSON-RPC) i przywrócono zdjęcia tła z Pexels (serwer proxy wysyłał klucz API w złym formacie, przez co Pexels zwracał 401). Zdjęcia tła zawierają teraz informację o autorze zgodnie z wytycznymi API Pexels.',
    fr_FR:
      "Correction des soldes en surveillance seule échouant avec Bitcoin Core 31.1 (champ params manquant dans le JSON-RPC) et restauration des photos d'arrière-plan Pexels (le proxy envoyait la clé API dans un format incorrect, d'où le 401 de Pexels). Les photos d'arrière-plan affichent désormais la mention du photographe, conformément aux consignes de l'API Pexels.",
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
