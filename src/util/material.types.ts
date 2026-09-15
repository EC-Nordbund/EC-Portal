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
  kategorie: string | null
  hatFoto: boolean
  menge: number
  /** null = noch nicht entschieden, 0 = gestrichen */
  mengeGenehmigt: number | null
  eingeladen: boolean
  zurueck: boolean
}

/**
 * Antrag (EC-Api src/material/antrag.ts, AntragKopf). `von`/`bis` sind
 * ISO-Strings, die Anzeigeform steckt in `vonObj`/`bisObj`.
 */
export interface Antrag {
  materialAntragID: number
  portalUserID: number
  status: AntragStatus
  von: string
  bis: string
  vonObj: ApiDatum | null
  bisObj: ApiDatum | null
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
  antragsteller: { vorname: string; nachname: string; email: string }
  positionen: AntragPosition[]
}

/**
 * Ein anderer Antrag, der sich mit einer Position überschneidet
 * (EC-Api src/material/verfuegbarkeit.ts, Konflikt). `von`/`bis` sind
 * ISO-Strings, die Anzeigeform steckt in `vonObj`/`bisObj`.
 */
export interface Konflikt {
  materialID: number
  materialAntragID: number
  status: AntragStatus
  von: string
  bis: string
  vonObj: ApiDatum
  bisObj: ApiDatum
  /** genehmigte Menge bei genehmigten, beantragte bei offenen Anträgen */
  menge: number
  anlass: string
  antragsteller: string
}

/** Detail: eigener Antrag oder als Materialwart, dann mit Konflikten je materialID. */
export interface AntragDetail extends Antrag {
  eigener: boolean
  konflikte?: Record<number, Konflikt[]>
}

/** Zeile in der Antragsliste des Materialwarts. */
export interface AntragUebersicht extends Antrag {
  ueberfaellig: boolean
  positionenAnzahl: number
}

/** Eine Zeile im Belegungsplan (EC-Api verfuegbarkeit.ts, BelegungMaterial). */
export interface Reservierung {
  materialAntragID: number
  status: AntragStatus
  von: string
  bis: string
  vonObj: ApiDatum
  bisObj: ApiDatum
  menge: number
  anlass: string
  antragsteller: string
}

export interface BelegungMaterial {
  materialID: number
  name: string
  bereich: MaterialBereich
  kategorie: string | null
  bestand: number
  aktiv: boolean
  freigegeben: boolean
  hatFoto: boolean
  reservierungen: Reservierung[]
  /** Höchste gleichzeitig genehmigte Menge an einem Tag des Fensters. */
  maxBelegt: number
  ueberbucht: boolean
}

export interface Belegung {
  zeitraum: { von: ApiDatum; bis: ApiDatum }
  material: BelegungMaterial[]
}

/** Position einer Materiallisten-Vorlage, wie der Katalog sie bekommt. */
export interface VorlagePosition {
  materialID: number
  name: string
  menge: number
}

/**
 * Materiallisten-Vorlage („Teencamp-Grundliste“). Gepflegt nur von
 * Materialwarten; `bereich` entscheidet, wer sie im Katalog sieht.
 */
export interface Vorlage {
  materialVorlageID: number
  name: string
  beschreibung: string
  bereich: MaterialBereich
  sortierung: number
  positionen: VorlagePosition[]
}

/** Verwaltungsansicht: Positionen tragen den Materialstatus für den Editor. */
export interface VorlagePositionVerwaltung extends VorlagePosition {
  aktiv: boolean
  freigegeben: boolean
  bereich: MaterialBereich
  hatFoto: boolean
}

export interface VorlageVerwaltung extends Vorlage {
  positionen: VorlagePositionVerwaltung[]
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
