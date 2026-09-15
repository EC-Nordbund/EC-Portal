import { reactive } from 'vue'
import { defineUseFunction } from '../plugins/base'
import { useApi } from '../plugins/api'

/**
 * Vorschaubilder des Materialkatalogs.
 *
 * Ein <img src="/portal/material/7/foto"> ginge nicht: der Token steht im
 * Authorization-Header, den ein Bild-Tag nicht mitschickt. Und fünfzig
 * einzelne requestBlob-Aufrufe für fünfzig Vorschauen wären beim
 * /portal-Limit von 120 Anfragen pro Minute knapp. Deshalb liefert die API
 * alle Vorschauen in EINEM Request als Data-URLs, und dieser Cache hält sie
 * für die Sitzung. Das große Foto holt nur der Detaildialog, einzeln.
 */
export const useMaterialFotos = defineUseFunction(() => {
  const api = useApi()
  const vorschauen = reactive(new Map<number, string>())
  let geladen = false
  let laeuft: Promise<void> | null = null

  /** Einmal pro Sitzung laden; parallele Aufrufer teilen sich den Request. */
  function laden(erneut = false): Promise<void> {
    if (geladen && !erneut) return Promise.resolve()
    if (laeuft) return laeuft
    laeuft = api
      .get<Record<string, string>>('/portal/material/vorschauen', {
        quiet: true
      })
      .then((res) => {
        vorschauen.clear()
        for (const [id, url] of Object.entries(res)) {
          vorschauen.set(Number(id), url)
        }
        geladen = true
      })
      .catch(() => {
        /* ohne Vorschauen zeigt die Liste Platzhalter -- kein Grund zu blockieren */
      })
      .finally(() => {
        laeuft = null
      })
    return laeuft
  }

  /** Nach Upload/Löschen im Verwaltungsbereich: eine einzelne Vorschau ersetzen. */
  function setze(materialID: number, dataUrl: string | null) {
    if (dataUrl) vorschauen.set(materialID, dataUrl)
    else vorschauen.delete(materialID)
  }

  return { vorschauen, laden, setze }
})
