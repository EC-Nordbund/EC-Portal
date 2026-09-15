import saveBlob from './download.util'

/**
 * CSV-Export für Excel im deutschen Gebietsschema: Semikolon als Trenner,
 * UTF-8 mit BOM (ohne das öffnet Excel die Datei als Latin-1 und macht aus
 * „Neumünster“ Buchstabensalat). Gleiches Vorgehen wie auf der FZ-Seite.
 */
export function csvExport(
  dateiname: string,
  kopf: string[],
  zeilen: unknown[][]
): void {
  const zelle = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const inhalt =
    '﻿' + [kopf, ...zeilen].map((z) => z.map(zelle).join(';')).join('\r\n')
  saveBlob(
    dateiname.endsWith('.csv') ? dateiname : `${dateiname}.csv`,
    new Blob([inhalt], { type: 'text/csv;charset=utf-8' })
  )
}

/** Ja/Nein statt true/false in der Tabelle. */
export const jaNein = (v: boolean) => (v ? 'ja' : 'nein')

/** Heutiges Datum für Dateinamen (YYYY-MM-DD). */
export function heuteISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}
