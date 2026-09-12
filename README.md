# EC-Portal

Selbstbedienungs-Portal des EC-Nordbund für **Freizeitleiter** und
**Ortsverantwortliche**: sie sehen ihre aktuellen Listen und tragen
Führungszeugnisse für die Personen ein, für die sie zuständig sind.

Bis dahin liefen beide Wege über die Geschäftsstelle — Ortsverantwortliche
bekamen einmal im Monat eine Excel-Liste per Mail, Freizeitleiter ihre
TN-Listen auf Anfrage, und ein eingesehenes Führungszeugnis konnte nur die
Geschäftsstelle eintragen.

## Stack

Vue 3.5 · Vuetify 4 · Vite 8 · TypeScript · Pug — derselbe Stack wie
EC-Verwaltung, aber **ohne GraphQL**: das Portal spricht ausschließlich die
REST-Routen unter `/portal/*` der EC-Api.

## Entwicklung

```bash
nvm use
DEV_PORT=8092 API_BASE=http://localhost:4000 npm run dev
```

Port 8092, weil 8080 (accountdesk), 8090 (EC-Verwaltung) und 8091 (deren
HMR-Socket) belegt sind. Die API läuft über `dev/run-api.sh` auf 4000, das
Datenbank-Schema liegt in `dev/dumps/zz-portal-schema.sql`.

Demo-Zugänge aus `dev/seed-demo.sql`, Passwort jeweils `Nordsee-Kutter-2026`:

| E-Mail | Rolle |
|---|---|
| `doro.demo@example.org` | Ortsverantwortliche Neumünster **und** Hauptleitung Sommerfreizeit |
| `max.muster@example.org` | nur Freizeitleiter (Pfingstcamp) |
| `erika@example.org` | Ortsverantwortliche Kiel |
| `greta@example.org` | Vollzugriff |
| `fam.platzh@example.org` | Einladung offen — Link: `/#/passwort/setzen?token=demo-invite-token` |

## Was man wissen sollte

- **Der Token ist ein anderer als der der Verwaltung.** Beide JWTs werden mit
  unterschiedlichen Secrets signiert. Das ist keine Kosmetik: `checkAuth` der
  API prüft nur die Signatur und kennt keine Rechte — mit gemeinsamem Secret
  wäre jeder Portal-Login ein Vollzugriff auf die Verwaltung.
- **Zuständigkeit wird bei jedem Request neu aufgelöst**, nicht in den Token
  gebacken. Anmeldungen ändern sich täglich.
- **Kein Service Worker.** Der SW der Verwaltung filtert per URL-Präfix auf
  deren Domain; ein übersehener String hieße hier falsches oder gar kein
  Caching. Installierbar ist das Portal trotzdem
  (`public/manifest.webmanifest`).
- **Hash-Routing bleibt.** Der statische vhost braucht damit keinen
  SPA-Fallback, und der Einladungs-Token steht im Fragment — der Browser
  schickt ihn nie an einen Server, er landet also weder in Access-Logs noch im
  `Referer`.
- **Rund 25 Dateien sind Kopien aus EC-Verwaltung.** Siehe `DUPLIKATE.md`.

## Deployment

GitHub Actions baut und rsynct von `main` nach
`portal.ec-nordbund.de` (Serverpfad `/webpage/portal.ec-nordbund.de`).
`API_BASE` ist eine Compile-Time-Konstante — ein
Artefakt gilt für genau eine API.
