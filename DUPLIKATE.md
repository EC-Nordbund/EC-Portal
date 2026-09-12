# Duplikate zu EC-Verwaltung

Das Portal teilt sich mit EC-Verwaltung eine Reihe von Bausteinen — den
Routen-Generator, das Formularsystem, das Vuetify-Setup. Ein gemeinsames
Paket gibt es nicht: es existiert kein Monorepo und keine private Registry,
und ein `@ec/ui`-Paket einzuführen wäre ein eigenes Projekt (Build, Release,
Vuetify-Peer-Deps). Die Duplikation ist also bewusst — aber sie driftet, wenn
niemand hinsieht.

Referenzstand: EC-Verwaltung `de016c0`.

| Datei im Portal | Quelle in EC-Verwaltung | identisch |
|---|---|---|
| `src/plugins/routes.ts` | `src/plugins/routes.ts` | ja |
| `src/plugins/router.ts` | `src/plugins/router.ts` | ja |
| `src/plugins/vuetify.ts` | `src/plugins/vuetify.ts` | ja |
| `src/plugins/base.ts` | `src/plugins/base.ts` | ja |
| `src/plugins/dialog.ts` | `src/plugins/dialog.ts` | ja |
| `src/plugins/caps.ts` | `src/plugins/caps.ts` | ja |
| `src/plugins/apiBase.ts` | `src/plugins/apiBase.ts` | ja |
| `src/lib/search.lib.vue` | `src/lib/search.lib.vue` | ja |
| `src/lib/dialogHost.lib.vue` | `src/lib/dialogHost.lib.vue` | ja |
| `src/forms/rules.ts` | `src/forms/rules.ts` | ja |
| `src/forms/field.ts` | `src/forms/field.ts` | ja |
| `src/forms/wrapper/wrapperDialog.vue` | `src/forms/wrapper/wrapperDialog.vue` | ja |
| `src/util/filter.util.ts` | `src/util/filter.util.ts` | ja |
| `src/config/theme.ts` | `src/config/theme.ts` | ja |
| `src/helpers.ts` | `src/helpers.ts` | ja |
| `src/shims/node-util.ts` | `src/shims/node-util.ts` | ja |
| `src/shims/node-stream.ts` | `src/shims/node-stream.ts` | ja |
| `src/forms/formElements/date.vue` | `src/forms/formElements/date.vue` | ja |
| `src/forms/formElements/input.vue` | `src/forms/formElements/input.vue` | ja |
| `src/forms/formElements/password.vue` | `src/forms/formElements/password.vue` | ja |
| `src/forms/formElements/text.vue` | `src/forms/formElements/text.vue` | ja |
| `src/forms/formElements/label.vue` | `src/forms/formElements/label.vue` | ja |
| `src/forms/formElements/alert.vue` | `src/forms/formElements/alert.vue` | ja |
| `src/forms/formElements/checkbox.vue` | `src/forms/formElements/checkbox.vue` | ja |
| `src/forms/formElements/autocomplete.vue` | `src/forms/formElements/autocomplete.vue` | ja |

## Bewusst abweichend

- `src/lib/wrapper.lib.vue` — ohne Lesezeichen-Button; die Navigationsleiste
  bleibt dauerhaft sichtbar statt sich nach zwei Sekunden auszublenden (ohne
  `mouseover` auf Touch-Geräten sonst nicht mehr erreichbar).
- `src/forms/formular.vue` — Komponenten-Map auf die acht tatsächlich
  genutzten Feldtypen gekürzt.
- `src/forms/main.ts` — ohne Anmelde-Formular und Schema-Registry.
- `src/storage/index.ts` — eigene Schlüssel mit Präfix `ecPortal:`.
- `src/tnList.ts` — Datenquelle REST statt GraphQL, Vorlagen aus der API.

## Pflege

Halbjährlich (oder nach größeren Änderungen in EC-Verwaltung) gegen den oben
genannten Stand diffen:

```bash
diff -r --brief src/plugins ../EC-Verwaltung/src/plugins
```

Die erfahrungsgemäß wandernden Dateien sind `wrapper.lib.vue` und `rules.ts`.
`routes.ts`, `vuetify.ts` und `theme.ts` sind faktisch eingefroren.
