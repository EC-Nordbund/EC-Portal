import type { App } from 'vue'
import formular from './formular.vue'
import dialog from './wrapper/wrapperDialog.vue'

/**
 * Registriert die Formular-Komponenten global.
 *
 * Gegenüber EC-Verwaltung fehlen `EcFormAnmeldung` (Anmeldeformular der
 * Website) und `FormularSelector` (löst Schema-Namen aus einer Registry auf) --
 * das Portal hat genau zwei Formulare und übergibt deren Schema direkt.
 * `Formular` muss global bleiben, weil der Dialog-Wrapper es referenziert.
 */
export function useForm(app: App) {
  app.component('Formular', formular)
  app.component('FormularDialog', dialog)
}
