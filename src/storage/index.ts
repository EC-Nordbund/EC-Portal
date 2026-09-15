import { useLocalStorage } from '@vueuse/core'
import { defineUseFunction } from '../plugins/base'

/**
 * Persistenter Zustand im localStorage.
 *
 * Die Schlüssel tragen alle den Präfix `ecPortal:` und heißen bewusst NICHT
 * wie die der Verwaltung. In Produktion sind portal.ec-nordbund.de und
 * verwaltung.ec-nordbund.de getrennte Origins, technisch also kollisionsfrei --
 * aber in der Entwicklung laufen beide auf localhost. Wer dort DEV_PORT
 * vergisst, schickt sonst den Verwaltungs-Token an /portal/* und debuggt eine
 * 401-Schleife. Zwei Secrets, zwei Schlüssel.
 */
export const useStorage = defineUseFunction(() => ({
  authToken: useLocalStorage('ecPortal:authToken', ''),
  email: useLocalStorage('ecPortal:email', ''),
  dark: useLocalStorage('ecPortal:dark', false),
  // Zuletzt gewählter Ausleihzeitraum im Materialkatalog (ISO YYYY-MM-DD).
  // Wer erst stöbert und später den Antrag stellt, muss ihn nicht neu tippen.
  materialVon: useLocalStorage('ecPortal:materialVon', ''),
  materialBis: useLocalStorage('ecPortal:materialBis', '')
}))
