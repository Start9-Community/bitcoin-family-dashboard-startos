import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.2.2:2',
  releaseNotes: {
    en_US: `Fixed watch-only balances failing against Bitcoin Core 31.1 (missing params field in JSON-RPC) and restored Pexels background photos (the proxy sent the API key in the wrong format, so Pexels returned 401). Background photos now carry photographer attribution per the Pexels API guidelines.

- Price Source, Holdings and Balance Source list each of their options and what choosing it means.
- A watch-only wallet read from Bitcoin on this server shows only its own descriptor's balance. Each one rescans the chain once after this update.
- Balances from Bitcoin on this server keep updating after Bitcoin restarts.
- The Watch-Only Wallets health check says when Bitcoin's wallet is disabled.
- Configure Dashboard notes that anyone who can open the dashboard can read the Pexels API key.
- When a wallet reads its balance from Bitcoin on this server, StartOS asks to keep Bitcoin unpruned with its wallet enabled.
- Bitcoin must be at least 28.4:30, 29.4:17, 30.3:17 or 31.1:19, depending on its major version. Bitcoin Knots (pre-RDTS) 29.3:29 or later also works.`,
    es_ES: `Corregido el fallo de los saldos de solo vigilancia con Bitcoin Core 31.1 (falta el campo params en JSON-RPC) y restauradas las fotos de fondo de Pexels (el proxy enviaba la clave en un formato incorrecto y Pexels devolvía 401). Las fotos de fondo ahora muestran la atribución del fotógrafo según las directrices de la API de Pexels.

- Fuente del precio, Tenencias y Fuente del saldo enumeran cada una de sus opciones y qué implica elegirla.
- Un monedero de solo lectura leído de Bitcoin en este servidor muestra solo el saldo de su propio descriptor. Cada uno vuelve a escanear la cadena una vez tras esta actualización.
- Los saldos de Bitcoin en este servidor siguen actualizándose después de que Bitcoin se reinicie.
- La comprobación de salud Monederos de solo lectura indica cuándo el monedero de Bitcoin está desactivado.
- Configurar el panel advierte que cualquiera que pueda abrir el panel puede leer la clave de API de Pexels.
- Cuando un monedero lee su saldo de Bitcoin en este servidor, StartOS pide mantener Bitcoin sin podar y con el monedero activado.
- Bitcoin debe ser al menos la versión 28.4:30, 29.4:17, 30.3:17 o 31.1:19, según su versión principal. También funciona Bitcoin Knots (pre-RDTS) 29.3:29 o posterior.`,
    de_DE: `Fehler bei Watch-only-Salden mit Bitcoin Core 31.1 behoben (fehlendes params-Feld im JSON-RPC) und Pexels-Hintergrundbilder wiederhergestellt (der Proxy sendete den API-Schlüssel im falschen Format, Pexels antwortete mit 401). Hintergrundbilder zeigen nun die Fotografen-Nennung gemäß den Pexels-API-Richtlinien.

- Kursquelle, Bestände und Quelle des Saldos nennen jede ihrer Optionen und was ihre Wahl bedeutet.
- Ein von Bitcoin auf diesem Server gelesenes Watch-only-Wallet zeigt nur den Saldo seines eigenen Deskriptors. Jedes durchsucht die Chain nach diesem Update einmal erneut.
- Salden von Bitcoin auf diesem Server werden nach einem Neustart von Bitcoin weiter aktualisiert.
- Die Statusprüfung Watch-only-Wallets meldet, wenn das Wallet von Bitcoin deaktiviert ist.
- Dashboard konfigurieren weist darauf hin, dass jeder, der das Dashboard öffnen kann, den Pexels-API-Schlüssel lesen kann.
- Wenn ein Wallet seinen Saldo von Bitcoin auf diesem Server liest, bittet StartOS darum, Bitcoin unbeschnitten und mit aktiviertem Wallet zu betreiben.
- Bitcoin muss je nach Hauptversion mindestens 28.4:30, 29.4:17, 30.3:17 oder 31.1:19 sein. Bitcoin Knots (pre-RDTS) ab 29.3:29 funktioniert ebenfalls.`,
    pl_PL: `Naprawiono błędy sald tylko do obserwacji z Bitcoin Core 31.1 (brak pola params w JSON-RPC) i przywrócono zdjęcia tła z Pexels (serwer proxy wysyłał klucz API w złym formacie, przez co Pexels zwracał 401). Zdjęcia tła zawierają teraz informację o autorze zgodnie z wytycznymi API Pexels.

- Źródło kursu, Zasoby i Źródło salda wymieniają każdą ze swoich opcji i to, co oznacza jej wybór.
- Portfel tylko do odczytu odczytywany z Bitcoina na tym serwerze pokazuje tylko saldo własnego deskryptora. Każdy z nich po tej aktualizacji raz ponownie skanuje łańcuch.
- Salda z Bitcoina na tym serwerze nadal się aktualizują po ponownym uruchomieniu Bitcoina.
- Kontrola stanu Portfele tylko do odczytu informuje, gdy portfel Bitcoina jest wyłączony.
- Konfiguruj panel informuje, że każdy, kto może otworzyć panel, może odczytać klucz API Pexels.
- Gdy portfel odczytuje saldo z Bitcoina na tym serwerze, StartOS prosi o pozostawienie Bitcoina bez przycinania i z włączonym portfelem.
- Bitcoin musi być co najmniej w wersji 28.4:30, 29.4:17, 30.3:17 lub 31.1:19, zależnie od wersji głównej. Działa też Bitcoin Knots (pre-RDTS) 29.3:29 lub nowszy.`,
    fr_FR: `Correction des soldes en surveillance seule échouant avec Bitcoin Core 31.1 (champ params manquant dans le JSON-RPC) et restauration des photos d'arrière-plan Pexels (le proxy envoyait la clé API dans un format incorrect, d'où le 401 de Pexels). Les photos d'arrière-plan affichent désormais la mention du photographe, conformément aux consignes de l'API Pexels.

- Source du cours, Avoirs et Source du solde listent chacune de leurs options et ce que signifie son choix.
- Un portefeuille en lecture seule lu depuis Bitcoin sur ce serveur n'affiche que le solde de son propre descripteur. Chacun réanalyse la chaîne une fois après cette mise à jour.
- Les soldes provenant de Bitcoin sur ce serveur continuent de se mettre à jour après un redémarrage de Bitcoin.
- Le contrôle d'état Portefeuilles en lecture seule signale quand le portefeuille de Bitcoin est désactivé.
- Configurer le tableau de bord signale que toute personne pouvant ouvrir le tableau de bord peut lire la clé API Pexels.
- Quand un portefeuille lit son solde depuis Bitcoin sur ce serveur, StartOS demande de garder Bitcoin non élagué avec son portefeuille activé.
- Bitcoin doit être au moins en version 28.4:30, 29.4:17, 30.3:17 ou 31.1:19, selon sa version majeure. Bitcoin Knots (pre-RDTS) 29.3:29 ou plus récent fonctionne aussi.`,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
