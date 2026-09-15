import type { App } from 'vue'

import wrapper from './wrapper.lib.vue'
import search from './search.lib.vue'
import dialogHost from './dialogHost.lib.vue'
import ampel from './ampel.lib.vue'
import materialFoto from './materialFoto.lib.vue'

/**
 * Global registrierte Bausteine. Deutlich weniger als in EC-Verwaltung: die
 * Lesezeichen und die Merge-Formulare sind Werkzeuge der Geschäftsstelle und
 * haben im Portal keine Entsprechung.
 */
export function registerLibComponents(app: App) {
  app.component('EcWrapper', wrapper)
  app.component('EcSearch', search)
  app.component('EcDialogHost', dialogHost)
  app.component('EcAmpel', ampel)
  // Vorschau + Vollbild eines Materials; in Katalog, Anträgen und Bestand.
  app.component('EcMaterialFoto', materialFoto)
}
