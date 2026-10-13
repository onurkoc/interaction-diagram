# Deployment auf Cloudflare Pages

Die App ist statisch: Der Ordner `app/` wird so ausgeliefert, wie er im
Repo liegt. Es gibt keinen Build-Schritt und keinen Server.

| | |
|---|---|
| Hosting | Cloudflare Pages, eigenes Projekt nur für diese App |
| Repo | `github.com/onurkoc/interaction-diagram` |
| Ausgabeordner | `app` |
| Build-Befehl | keiner |
| Adresse (Ziel) | `https://interaction-diagram.onurkoc.net/` |
| Vorschau | `https://modernize-js.<projekt>.pages.dev/` |

`<projekt>` ist der Name des Pages-Projekts, z. B. `interaction-diagram`.
Ist der Name vergeben, hängt Cloudflare etwas an; die genaue Adresse
steht im Dashboard beim Deployment.

Die App liegt im Stamm der Subdomain, nicht in einem Unterpfad. Alle
Pfade in `app/` sind relativ, die App läuft deshalb auch unter jeder
Vorschau-Adresse.

`apps.onurkoc.net` ist eine separate Startseite in einem eigenen Repo
und gehört nicht zu diesem Projekt.

## Reihenfolge

1. Vorschau: Branch `modernize-js` als Vorschau-Deployment auf
   `pages.dev`. Noch keine eigene Domain.
2. Vorschau prüfen (Prüfliste unten).
3. Pull Request `modernize-js` nach `master`, Merge durch Onur.
4. Eigene Domain `interaction-diagram.onurkoc.net` eintragen.

Die eigene Domain zeigt immer auf den Produktions-Branch. Sie wird
deshalb erst eingetragen, wenn `master` die neue App enthält.

## 1 Projekt anlegen (Cloudflare-Dashboard)

1. **Workers & Pages** öffnen, neues **Pages**-Projekt anlegen, Variante
   «mit Git verbinden» (Connect to Git).
2. GitHub-Konto verbinden und der Cloudflare-App den Zugriff auf das
   Repo `onurkoc/interaction-diagram` geben (nur dieses Repo genügt).
3. Einstellungen des Projekts:

   | Feld | Wert |
   |---|---|
   | Projektname | `interaction-diagram` |
   | Produktions-Branch | `master` |
   | Framework-Vorgabe | keine (None) |
   | Build-Befehl | leer lassen |
   | Build-Ausgabeordner | `app` |
   | Stammverzeichnis | leer lassen (Stamm des Repos) |
   | Umgebungsvariablen | keine |

4. Speichern und deployen.

Das erste Deployment baut den Produktions-Branch `master`. Solange
`master` noch die alte Dash-App enthält, gibt es dort keinen Ordner
`app/`; dieses Deployment schlägt voraussichtlich fehl. Das ist bis
zum Merge so erwartet und betrifft die Vorschau nicht.

## 2 Vorschau-Branch

1. Im Projekt: **Settings**, Abschnitt **Builds**, **Branch control**.
2. Produktions-Branch: `master`, automatische Deployments ein.
3. Vorschau-Branches: «Custom branches», einschliessen `modernize-js`.
   So werden die alten `dependabot/...`-Branches des Repos nicht
   gebaut.

Ein Vorschau-Deployment entsteht bei einem Push auf den Branch. Der
Branch `modernize-js` ist bereits auf GitHub; nach dem Anlegen des
Projekts braucht es deshalb einen weiteren Push (ein beliebiger neuer
Commit auf `modernize-js`), damit die erste Vorschau gebaut wird.

Adressen eines Vorschau-Deployments:

- `https://<hash>.<projekt>.pages.dev/` – genau dieser Stand, bleibt.
- `https://modernize-js.<projekt>.pages.dev/` – immer der neuste Stand
  des Branches.

Vorschau-Adressen sendet Cloudflare mit `X-Robots-Tag: noindex`; sie
erscheinen nicht in Suchmaschinen.

## 3 Eigene Domain (erst nach geprüfter Vorschau und Merge)

Voraussetzung: `onurkoc.net` liegt als Zone im selben Cloudflare-Konto.

1. Im Projekt: **Custom domains**, Domain einrichten.
2. `interaction-diagram.onurkoc.net` eintragen und bestätigen.
3. Cloudflare legt den DNS-Eintrag (CNAME auf `<projekt>.pages.dev`)
   selbst an und stellt das Zertifikat aus. Warten, bis der Status
   «aktiv» ist.
4. `https://interaction-diagram.onurkoc.net/` öffnen und die Prüfliste
   noch einmal durchgehen.

Den CNAME nicht von Hand im DNS anlegen, ohne die Domain im
Pages-Projekt einzutragen: Die Adresse antwortet dann mit einem Fehler.

## Cache-Regeln (`app/_headers`)

Cloudflare Pages liest die Datei `_headers` im Ausgabeordner.

| Dateien | Cache-Control | Wirkung |
|---|---|---|
| `/`, `index.html`, `*.js`, `*.css`, `norms/*.js` | `no-cache` | Der Browser fragt bei jedem Aufruf nach, ob die Datei neu ist. Eine neue Version erscheint beim normalen Neuladen. |
| `vendor/*` | `public, max-age=31536000, immutable` | Plotly.js und SheetJS bleiben ein Jahr im Browser. |

Zwei Regeln, die beim Ändern zu beachten sind:

- **Die Regeln dürfen sich nicht überlappen.** Trifft mehr als eine
  Regel mit demselben Kopf auf eine Datei zu, hängt Cloudflare die Werte
  aneinander. Darum steht dort `/:file.js` (ein Name ohne `/`) und nicht
  `/*.js`, das auch `vendor/` treffen würde. Ein neuer Unterordner in
  `app/` braucht eine eigene Regel. `tests/headers.test.js` prüft, dass
  jede Datei von genau einer Regel getroffen wird.
- **Eine neue Version einer Bibliothek braucht einen neuen Dateinamen**
  (z. B. mit der Versionsnummer), sonst behalten Browser die alte Datei
  bis zu einem Jahr. Der Name steht in `app/index.html`.

`_headers` gilt nur auf Cloudflare Pages. Lokal sendet `serve.py` für
alle Dateien `Cache-Control: no-store`.

## Prüfliste nach dem Deployment

Zuerst auf der Vorschau, später noch einmal auf der eigenen Domain.

1. **Seite lädt.** Startseite erscheint, keine rote Meldung «Diese
   Seite muss über einen Webserver geöffnet werden» und keine Meldung
   «Die App konnte nicht geladen werden».
2. **Köpfe.** In den Entwicklerwerkzeugen (F12, Netzwerk) oder mit
   `curl -I`:
   - `…/app.js`, `…/style.css`, `…/norms/sia262.js` und die Seite
     selbst: `Cache-Control: no-cache`, genau ein Wert.
   - `…/vendor/plotly-basic.min.js`, `…/vendor/xlsx.mjs`:
     `Cache-Control: public, max-age=31536000, immutable`, genau ein
     Wert.
   - `.js` und `.mjs` kommen mit einem JavaScript-Typ
     (`Content-Type: text/javascript` oder `application/javascript`).
3. **Cache ohne Ctrl+F5.** Eine sichtbare Kleinigkeit ändern (z. B.
   einen Text in `app/i18n.js`), committen, pushen, das neue Deployment
   abwarten. Die Seite **normal** neu laden (F5 oder Adresse neu
   aufrufen, nicht Ctrl+F5): Die neue Version erscheint. Danach die
   Änderung zurücknehmen.
4. **Erstes Diagramm.** Norm wählen, «Beispiel laden»: Das Diagramm
   füllt seine Fläche schon beim ersten Zeichnen (Desktop 720 px hoch,
   schmaler Bildschirm 460 px), nicht gestaucht. Dasselbe mit von Hand
   getippten Werten, ohne «Beispiel laden».
5. **Echtes Handy.** Seite auf dem Handy öffnen: eine Spalte, Legende
   als Text unter dem Diagramm, Eingabe mit Dezimaltastatur, Tabelle
   seitlich verschiebbar.
6. **Drag-and-drop.** Eine `.xlsx`-Datei mit Lastpunkten auf die
   gestrichelte Fläche ziehen: Meldung «… gelesen: n Lastpunkte»,
   Punkte im Diagramm, Tabelle darunter. Auch über «Datei auswählen».
   Eine Datei mit falscher Endung wird mit Meldung abgelehnt.
7. **Sprache wechseln.** DE und EN auf Startseite und im Rechner: alle
   Texte wechseln, Dezimalzeichen wechselt, Eingaben bleiben. Seite neu
   laden: Die Sprache bleibt.
8. **Norm wechseln.** «Norm wechseln», andere Norm wählen: gemeinsame
   Eingaben bleiben, die Felder der anderen Norm sind ausgeblendet,
   γ_c und γ_s heissen je nach Norm «Widerstandsbeiwert» (SIA 262)
   oder «Teilsicherheitsbeiwert» (EN 1992-1-1).
9. **Kennzeichnung.** «Beispiel laden» zeigt «Beispielwerte, nicht
   projektbezogen»; ein geändertes Feld des Querschnitts löscht sie;
   selbst getippte Werte werden nicht gekennzeichnet.
10. **Vermerk zum Stand der Validierung** steht auf der Startseite und
    im Fuss des Rechners, in beiden Sprachen.
11. **Konsole** (F12): keine Fehler, keine Anfrage an fremde Adressen
    (alles kommt von der eigenen Adresse, kein CDN).

## Später

- Neue Version veröffentlichen: Merge oder Push auf `master`,
  Cloudflare deployt selbst. Zurück auf einen alten Stand: im Dashboard
  beim gewünschten Deployment «Rollback».
- Der alte Heroku-Link aus dem Jahr 2020 ist tot und wird nicht ersetzt.
