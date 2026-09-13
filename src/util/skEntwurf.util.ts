/**
 * Ungespeicherte Formular-Entwürfe des Schutzkonzept-Builders, je
 * Formularversion einer, im localStorage des Browsers.
 *
 * Warum es sie gibt: Der Portal-Token läuft ab (401 -> das Layout meldet ab
 * und schickt zum Login), und ohne Token lässt sich nichts mehr speichern.
 * Ohne diese Sicherung wären Stunden an Umbau in diesem Moment unrettbar.
 *
 * Warum sie hier und nicht in der Builder-Seite stehen: Beim bewussten
 * Abmelden muss das Layout sie löschen. Auf einem geteilten Rechner bekäme
 * sonst der nächste Nutzer den Entwurf des Vorgängers zur Wiederherstellung
 * angeboten. Wer dagegen von einem abgelaufenen Token rausgeworfen wird,
 * meldet sich gleich wieder an -- dessen Entwurf bleibt liegen.
 *
 * Jeder Zugriff ist abgesichert: In einem privaten Fenster oder bei
 * gesperrten Site-Daten wirft schon der Zugriff auf localStorage. Die
 * Sicherung ist ein Zusatz, kein Muss.
 */

const PRAEFIX = 'ecPortal:skBuilder:'

export interface Entwurf {
  /** Revision, auf der der Entwurf aufsetzt. */
  revision: number
  /** JSON aus Definition und Notiz -- genau der String, den der Builder vergleicht. */
  stand: string
  /** ISO-Zeitpunkt der Sicherung, für die Rückfrage beim Wiederherstellen. */
  zeit: string
}

const schluessel = (versionID: number): string => `${PRAEFIX}${versionID}`

export function leseEntwurf(versionID: number): Entwurf | null {
  try {
    const roh = window.localStorage.getItem(schluessel(versionID))
    const e = roh ? JSON.parse(roh) : null
    return e && typeof e.stand === 'string' ? e : null
  } catch {
    return null
  }
}

export function schreibeEntwurf(versionID: number, entwurf: Entwurf): void {
  try {
    window.localStorage.setItem(schluessel(versionID), JSON.stringify(entwurf))
  } catch {
    /* voll oder gesperrt */
  }
}

export function loescheEntwurf(versionID: number): void {
  try {
    window.localStorage.removeItem(schluessel(versionID))
  } catch {
    /* gesperrt -- dann gibt es auch nichts zu löschen */
  }
}

/** Beim Abmelden: alle Entwürfe dieses Browsers, auch die anderer Versionen. */
export function loescheAlleEntwuerfe(): void {
  try {
    const weg: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(PRAEFIX)) weg.push(k)
    }
    for (const k of weg) window.localStorage.removeItem(k)
  } catch {
    /* gesperrt */
  }
}
