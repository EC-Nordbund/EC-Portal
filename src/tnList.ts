import { API_BASE } from './plugins/apiBase'
import saveBlob from './util/download.util'

/**
 * Erzeugung der TN-Listen (Küche/Leiter/Mitarbeiter/Zuschüsse/Spezial-MA) aus
 * den xlsx-Vorlagen.
 *
 * Portiert aus EC-Verwaltung/src/tnList.ts. Zwei bewusste Unterschiede:
 *
 *  1. Die Daten kommen per REST statt aus einer GraphQL-Query, und sie werden
 *     der Funktion ÜBERGEBEN statt selbst geholt. In der Verwaltung lädt der
 *     "Alle"-Durchlauf zehnmal dieselbe Query; mit einem Rate-Limit im Rücken
 *     wäre das nicht tragbar. Jetzt: einmal laden, mehrfach rendern -- die
 *     Web-Ansicht nutzt dieselben Daten.
 *  2. Die Vorlagen kommen aus der API (`/portal/templates`) statt aus dem
 *     eigenen `public/`-Ordner. Sonst lägen dieselben fünf Binärdateien in
 *     zwei Repos, ohne Möglichkeit sie zu diffen.
 *
 * Alles Übrige -- die abgeleiteten Felder, der Dateiname, der Buffer-Shim --
 * ist absichtlich unverändert: davon hängt ab, ob die Vorlagen sich weiter
 * füllen lassen.
 */

export interface TnListTemplate {
  name: string
  label: string
}

const TEMPLATE_BASE = `${API_BASE}/portal/templates`

/**
 * xlsx-template ist eine CJS-Node-Bibliothek. Ihre Node-Bezüge (`path`,
 * `util`, `stream`) löst vite.config.ts über Aliase auf; bleibt `Buffer`,
 * das sie für eine Typprüfung der Eingabe braucht.
 *
 * Die Reihenfolge ist wichtig: erst importieren, dann shimmen. Das
 * mitgelieferte jszip entscheidet beim Laden anhand von `typeof Buffer`, ob es
 * mit Node-Buffern oder mit Uint8Array arbeitet -- ein vorher gesetzter Shim
 * schickt es in den Node-Pfad und es scheitert mit
 * "Buffer is not a constructor".
 *
 * Der Import ist dynamisch, damit die ~200 kB nur beim tatsächlichen
 * Listen-Export geladen werden.
 */
async function loadXlsxTemplate() {
  const mod = await import('xlsx-template')
  const g = globalThis as unknown as {
    Buffer?: { isBuffer(v: unknown): boolean }
  }
  if (!g.Buffer) {
    g.Buffer = { isBuffer: () => false }
  }
  return (mod as any).default ?? mod
}

/** Holt Vorlage bzw. Katalog mit Auth-Header -- beides liegt hinter /portal. */
async function holeVorlage(pfad: string, token: string): Promise<Response> {
  const res = await fetch(`${TEMPLATE_BASE}/${pfad}`, {
    headers: { authorization: token }
  })
  if (!res.ok) {
    throw new Error(`Vorlage "${pfad}" nicht gefunden (HTTP ${res.status}).`)
  }
  return res
}

export async function getTemplates(token: string): Promise<TnListTemplate[]> {
  return (await holeVorlage('list.json', token)).json()
}

/**
 * Rendert eine Vorlage mit bereits geladenen Veranstaltungsdaten.
 *
 * `daten` ist die Antwort von GET /portal/veranstaltung/:id/tnliste mit
 * `felder=voll` -- die Feldnamen darin sind die Platzhalterpfade der xlsx.
 */
export async function generate(
  daten: any,
  template: string,
  token: string,
  wlistFilter: (wlist: number) => boolean,
  variante = ''
): Promise<void> {
  const templateData = await (
    await holeVorlage(`${template}.xlsx`, token)
  ).arrayBuffer()

  const XlsxTemplate = await loadXlsxTemplate()
  const instance = new XlsxTemplate(templateData)

  const replData = {
    ...daten,
    vOrtLocation: `${daten.veranstaltungsort.plz} ${daten.veranstaltungsort.ort} (${daten.veranstaltungsort.land})`,
    anmeldungen: daten.anmeldungen
      .filter((an: any) => wlistFilter(an.wartelistenPlatz))
      .map((h: any, id: number) => ({
        id,
        ...h,
        empty: '',
        m: h.person.geschlecht === 'm' ? 'X' : '',
        w: h.person.geschlecht === 'w' ? 'X' : '',
        // Stichtag ist das ENDE der Veranstaltung. ende ist nullable
        // (Eintagesveranstaltungen) -> dann gilt begin.
        older27:
          dateDiffInYears(
            h.person.gebDat.input,
            (daten.ende ?? daten.begin).input
          ) > 27
            ? 'X'
            : '',
        betreuer: h.position > 1 ? 'X' : ''
      }))
  }

  instance.substitute(1, replData)
  const resultList = instance.generate({ type: 'arraybuffer' })

  // begin.german ist "DD.MM.YYYY" -> [2] ist das Jahr
  const jahr = String(replData.begin?.german ?? '').split('.')[2] ?? ''
  const kurz = replData.kurzBezeichnung || replData.veranstaltungsID

  saveByteArray(
    ['TN-Liste', template, `${kurz}-${jahr}`, variante]
      .filter(Boolean)
      .join('.') + '.xlsx',
    resultList
  )
}

export function saveByteArray(reportName: string, byte: ArrayBuffer): void {
  saveBlob(
    reportName,
    new Blob([byte], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
  )
}

function dateDiffInYears(dateoldS: string, datenewS: string): number {
  const dateold = new Date(dateoldS)
  const datenew = new Date(datenewS)
  let diff = datenew.getFullYear() - dateold.getFullYear()
  const mold = dateold.getMonth()
  const mnew = datenew.getMonth()
  if (mold > mnew || (mold === mnew && dateold.getDate() > datenew.getDate())) {
    diff--
  }
  return diff
}

/**
 * Wartelisten-Varianten wie in der Verwaltung. `wartelistenPlatz`: 0 = fester
 * Platz, > 0 Warteliste, < 0 abgemeldet.
 */
export const wListFilter: Record<string, (v: number) => boolean> = {
  'ohne-warteliste': (v) => v === 0,
  'mit-warteliste': (v) => v >= 0,
  'nur-warteliste': (v) => v > 0,
  'nur-abgemeldete': (v) => v < 0
}
