/**
 * Antwortformen der Material-Routen (/portal/material/*).
 *
 * Handgepflegte Nachbildung wie PortalMe in plugins/auth.ts -- es gibt keinen
 * Typ-Generator zwischen EC-Api und Portal. Maßgeblich ist EC-Api
 * src/material/*; bei Abweichungen dort nachsehen.
 */

/** Datum, wie die API es überall liefert (dateObj in EC-Api src/portal/date.ts). */
export interface ApiDatum {
  day: number
  month: number
  year: number
  /** TT.MM.JJJJ */
  german: string
  /** YYYY-MM-DD, für <input type=date> und als Request-Parameter */
  input: string
}

export type MaterialBereich = 'allgemein' | 'referenten'

export type AntragStatus =
  'offen' | 'genehmigt' | 'abgelehnt' | 'abgeschlossen' | 'storniert'

export interface MaterialKategorie {
  materialKategorieID: number
  bezeichnung: string
  sortierung: number
}

export interface Material {
  materialID: number
  bereich: MaterialBereich
  materialKategorieID: number | null
  kategorie: string | null
  name: string
  beschreibung: string
  bestand: number
  lagerort: string
  hatFoto: boolean
  /** UNIX-Sekunden der letzten Foto-Änderung; Cache-Buster fürs Vollbild. */
  fotoStand: number | null
  /** Nur mit ?von&bis gefüllt, sonst null. */
  reserviert: number | null
  angefragt: number | null
  frei: number | null
}

/** Bestandsliste des Materialwarts: zusätzlich die Pflege-Flags. */
export interface MaterialVerwaltung extends Material {
  freigegeben: boolean
  aktiv: boolean
  erstellt: string
  geaendert: string
}

export interface Stammdaten {
  kategorien: MaterialKategorie[]
  kreise: Array<{ ecKreisID: number; bezeichnung: string }>
  referenten: boolean
}

export interface AntragPosition {
  materialAntragPositionID: number
  materialID: number
  name: string
  lagerort: string
  bereich: MaterialBereich
  hatFoto: boolean
  fotoStand: number | null
  menge: number
  mengeGenehmigt: number | null
  eingeladen: boolean
  zurueck: boolean
}

export interface Antrag {
  materialAntragID: number
  status: AntragStatus
  von: ApiDatum
  bis: ApiDatum
  veranstaltungsID: number | null
  ecKreisID: number | null
  kreis: string | null
  anlass: string
  kommentar: string
  antwort: string
  erstellt: string
  geaendert: string
  entschiedenAm: string | null
  abgeschlossenAm: string | null
  positionen: AntragPosition[]
}

/** Ein anderer Antrag, der sich mit einer Position überschneidet. */
export interface Konflikt {
  materialAntragID: number
  status: AntragStatus
  von: ApiDatum
  bis: ApiDatum
  menge: number
  anlass: string
  antragsteller: string
}

/** Detail für Materialwarte: Antragsteller und Konflikte je Position. */
export interface AntragDetail extends Antrag {
  antragsteller: { vorname: string; nachname: string; email: string } | null
  konflikte: Record<number, Konflikt[]> | null
  ueberbucht: number[] | null
}

/** Zeile in der Antragsliste des Materialwarts. */
export interface AntragUebersicht {
  materialAntragID: number
  status: AntragStatus
  von: ApiDatum
  bis: ApiDatum
  anlass: string
  antragsteller: string
  positionen: number
  ueberfaellig: boolean
  erstellt: string
}

export interface Reservierung {
  materialAntragID: number
  status: AntragStatus
  von: ApiDatum
  bis: ApiDatum
  menge: number
  anlass: string
  antragsteller: string
}

export interface BelegungMaterial {
  materialID: number
  name: string
  bestand: number
  kategorie: string | null
  reservierungen: Reservierung[]
  maxBelegt: number
}

export interface Belegung {
  zeitraum: { von: ApiDatum; bis: ApiDatum }
  material: BelegungMaterial[]
}

export const STATUS_TEXT: Record<AntragStatus, string> = {
  offen: 'offen',
  genehmigt: 'genehmigt',
  abgelehnt: 'abgelehnt',
  abgeschlossen: 'abgeschlossen',
  storniert: 'zurückgezogen'
}

/** Chip-Farben je Status, einheitlich in allen Listen. */
export const STATUS_FARBE: Record<AntragStatus, string | undefined> = {
  offen: undefined,
  genehmigt: 'success',
  abgelehnt: 'error',
  abgeschlossen: 'info',
  storniert: undefined
}
