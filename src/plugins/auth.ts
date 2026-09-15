import { computed, ref } from 'vue'
import { defineUseFunction } from './base'
import { useStorage } from '../storage'
import { useApi } from './api'

export interface PortalMe {
  user: {
    portalUserID: number
    personID: number
    vorname: string
    nachname: string
    email: string
    superuser: boolean
    /**
     * Globale Verantwortung „Schutzkonzept-Verwalter“: baut das Formular und
     * sieht die Schutzkonzepte aller EC-Kreise. Superuser haben sie immer.
     */
    schutzkonzeptVerwalter: boolean
    /**
     * „Materialwart“: pflegt den Ausleihbestand des Nordbunds, bearbeitet
     * Ausleih-Anträge und sieht den Belegungsplan. Superuser haben die Rolle
     * immer. Es gibt bewusst nur diese eine Material-Rolle.
     */
    materialVerwalter: boolean
  }
  /**
   * Materialausleihe. null, wenn das Material-Schema in der API fehlt -- dann
   * gibt es den Bereich im Menü gar nicht.
   *
   * `referenten`: darf den zweiten Bereich (Drucker, Stifte …) sehen, also
   * Freizeitleitung mit Umfang 'voll', Materialwarte und Superuser.
   * `offen`: unbearbeitete Anträge; nur für Materialwarte gefüllt, sonst null.
   */
  material: {
    referenten: boolean
    offen: number | null
  } | null
  kreise: Array<{
    ecKreisID: number
    bezeichnung: string
    needsFZ: boolean
    /**
     * 'fz'  — Führungszeugnis-Liste und Zeugnisse eintragen
     * 'ort' — Mitgliederliste des Kreises pflegen
     *
     * Zwei getrennte Aufgaben mit je eigener Verantwortlicher. Wer beides
     * macht, hat beide Rollen.
     */
    rollen: Array<'fz' | 'ort'>
    /** Offene Führungszeugnisse; null, wenn die Rolle 'fz' fehlt. */
    offen: number | null
  }>
  veranstaltungen: Array<{
    veranstaltungsID: number
    bezeichnung: string
    kurzBezeichnung: string
    begin: { german: string; input: string } | null
    ende: { german: string; input: string } | null
    position: number
    positionText: string
    /**
     * 'voll' fuer Leitung und Hauptleitung, 'kueche' fuer die Kuechenleitung.
     * Bei 'kueche' gibt es keinen Fuehrungszeugnis-Teil und nur die
     * Kuechenliste; die beiden Zaehler sind dann null.
     */
    umfang: 'voll' | 'kueche'
    mitarbeiter: number | null
    fzOffen: number | null
  }>
}

interface LoginAntwort {
  token: string
  expiresAt: string
  user: PortalMe['user']
}

/**
 * Anmeldung und aktueller Zuständigkeitsbereich.
 *
 * Kein Pinia -- das Haus nutzt Singleton-Composables (defineUseFunction), und
 * für einen Token plus ein geladenes Objekt lohnt kein Store-Framework.
 *
 * Anders als in EC-Verwaltung gibt es keinen 12-Stunden-Timer und keinen
 * Reauth-Dialog: das Portal wird ein paar Mal im Jahr benutzt, da ist ein
 * abgelaufener Token einfach ein neuer Login. Der 401-Pfad im API-Client
 * erledigt das.
 */
export const useLogin = defineUseFunction(() => {
  const { authToken, email } = useStorage()
  const api = useApi()

  const me = ref<PortalMe | null>(null)
  const angemeldet = computed(() => !!authToken.value)

  async function login(daten: { email: string; password: string }) {
    const res = await api.post<LoginAntwort>('/portal/login', daten, {
      auth: false,
      quiet: true
    })
    authToken.value = res.token
    email.value = res.user.email
  }

  /** Lädt Person und Zuständigkeiten. Wirft, wenn der Token nicht (mehr) gilt. */
  async function ladeMe() {
    me.value = await api.get<PortalMe>('/portal/me', { quiet: true })
    return me.value
  }

  function logout() {
    authToken.value = ''
    me.value = null
  }

  return { authToken, email, me, angemeldet, login, ladeMe, logout }
})
