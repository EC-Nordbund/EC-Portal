/**
 * Anzeige-Helfer fuer die Schutzkonzept-Seiten des Portals.
 *
 * Die API liefert Zeitstempel als ISO-UTC (in SQL formatiert, siehe
 * EC-Api/src/schutzkonzept/config.ts isoSql) -- `new Date()` rechnet sie hier
 * korrekt in Ortszeit um.
 */
export function datumZeit(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function datum(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  // Zweistellig wie datumZeit(): "13.09.2026" statt "13.9.2026"
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
}

export function groesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
