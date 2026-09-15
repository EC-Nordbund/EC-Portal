<template lang="pug">
v-app
  v-navigation-drawer(v-model='drawer')
    v-list
      v-list-item(v-if='me')
        template(#prepend)
          v-avatar(v-accent-bg)
            span.text-white {{ initialen }}
        v-list-item-title {{ me.user.vorname }} {{ me.user.nachname }}
        v-list-item-subtitle {{ me.user.email }}
    v-divider
    v-list(density='compact')
      v-list-item(to='/home')
        template(#prepend)
          v-icon home
        v-list-item-title Übersicht

      //- Downloads sieht, wer ueberhaupt einen Bereich hat: Freizeiten oder
      //- EC-Kreise. Der Server liefert sonst eine leere Liste, und ein
      //- Menuepunkt, hinter dem nichts steht, ist ein Versprechen zu viel.
      v-list-item(v-if='hatDownloads', to='/downloads')
        template(#prepend)
          v-icon folder_shared
        v-list-item-title Downloads

      //- Materialausleihe gibt es fuer jeden Portal-Nutzer -- aber nur, wenn
      //- die API das Modul kennt (me.material ist sonst null).
      template(v-if='me && me.material')
        v-divider.my-2
        v-list-subheader Material
        v-list-item(to='/material/katalog')
          template(#prepend)
            v-icon inventory_2
          v-list-item-title Materialkatalog
        v-list-item(to='/material/antraege')
          template(#prepend)
            v-icon assignment
          v-list-item-title Meine Anträge

      template(v-if='me && me.material && me.user.materialVerwalter')
        v-divider.my-2
        v-list-subheader Materialverwaltung
        v-list-item(to='/materialwart/antraege')
          template(#prepend)
            v-icon inbox
          v-list-item-title Anträge
          template(#append)
            v-chip(v-if='me.material.offen', size='x-small', color='#C62828') {{ me.material.offen }}
        v-list-item(to='/materialwart/bestand')
          template(#prepend)
            v-icon warehouse
          v-list-item-title Bestand
        v-list-item(to='/materialwart/belegung')
          template(#prepend)
            v-icon calendar_month
          v-list-item-title Belegung
        v-list-item(to='/materialwart/vorlagen')
          template(#prepend)
            v-icon bookmarks
          v-list-item-title Vorlagen

      template(v-if='me && me.kreise.length')
        v-divider.my-2
        v-list-subheader Meine EC-Kreise
        v-list-item(
          v-for='k in me.kreise',
          :key='k.ecKreisID',
          :to='kreisStart(k)'
        )
          template(#prepend)
            v-icon place
          v-list-item-title {{ k.bezeichnung }}
          template(#append)
            v-chip(v-if='k.offen', size='x-small', color='#C62828') {{ k.offen }}

      template(v-if='me && me.veranstaltungen.length')
        v-divider.my-2
        v-list-subheader Meine Freizeiten
        v-list-item(
          v-for='v in me.veranstaltungen',
          :key='v.veranstaltungsID',
          :to='startseite(v)'
        )
          template(#prepend)
            v-icon event
          v-list-item-title {{ v.bezeichnung }}
          v-list-item-subtitle {{ v.begin ? v.begin.german : '' }}
          template(#append)
            v-chip(v-if='v.fzOffen', size='x-small', color='#C62828') {{ v.fzOffen }}

      template(v-if='me && me.user.schutzkonzeptVerwalter')
        v-divider.my-2
        v-list-subheader Schutzkonzept
        v-list-item(to='/schutzkonzept/formular')
          template(#prepend)
            v-icon edit_note
          v-list-item-title Formular
        v-list-item(to='/schutzkonzept/kreise')
          template(#prepend)
            v-icon shield
          v-list-item-title EC-Kreise

  v-app-bar(v-accent-bg, density='comfortable')
    v-app-bar-nav-icon(@click='drawer = !drawer')
    v-toolbar-title.text-white EC-Nordbund Portal
    v-spacer
    v-btn(icon, variant='text', @click='dark = !dark')
      v-icon(color='white') {{ dark ? 'light_mode' : 'dark_mode' }}
    v-btn(icon, variant='text', @click='abmelden')
      v-icon(color='white') logout

  v-main
    .pa-2(v-if='geladen')
      router-view(v-slot='{ Component }')
        component(:is='Component', :me='me', @reload='laden')
    .pa-8.text-center(v-else-if='!fehler')
      v-progress-circular(indeterminate, color='primary')

    //- Laden fehlgeschlagen, aber NICHT wegen der Anmeldung: hier bleibt man
    //- angemeldet und kann es noch einmal versuchen.
    .pa-6(v-else)
      v-alert(type='warning', variant='tonal')
        .mb-2 Deine Daten konnten gerade nicht geladen werden.
        .text-caption.mb-3 {{ fehler }}
        v-btn(variant='tonal', size='small', @click='laden') Erneut versuchen

  ec-dialog-host
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useLogin } from '../plugins/auth'
import { ApiError, useApi } from '../plugins/api'
import { useRouter } from '../plugins/router'
import { useStorage } from '../storage'
import { loescheAlleEntwuerfe } from '../util/skEntwurf.util'

/**
 * Layout und Zugangsschutz für alles unterhalb von '/'.
 *
 * Wie in EC-Verwaltung gibt es bewusst keinen Router-Guard: der Schutz sitzt in
 * onMounted. Ohne Token geht es zum Login, und wenn /portal/me den Token
 * ablehnt, ebenfalls -- das fängt einen abgelaufenen oder nach einem
 * Passwortwechsel entwerteten Token ab, ohne dass die Seite leer stehen bleibt.
 */
const { me, ladeMe, logout, authToken } = useLogin()
const { route, router } = useRouter()
const { dark } = useStorage()
const api = useApi()

const drawer = ref(true)
const geladen = ref(false)
const fehler = ref('')

const theme = useTheme()
watch(
  dark,
  (v) => {
    theme.global.name.value = v ? 'dark' : 'light'
  },
  { immediate: true }
)

/** Downloads gibt es nur, wenn mindestens ein Bereich zutrifft. */
const hatDownloads = computed(
  () =>
    !!me.value &&
    (me.value.kreise.length > 0 ||
      me.value.veranstaltungen.length > 0 ||
      me.value.user.superuser)
)

const initialen = computed(() =>
  me.value
    ? `${me.value.user.vorname[0] ?? ''}${me.value.user.nachname[0] ?? ''}`
    : ''
)

/**
 * Wohin ein EC-Kreis im Menue fuehrt. Ein Kreis hat zwei getrennte Aufgaben;
 * wer nur die Mitgliederpflege hat, landet direkt dort.
 */
function kreisStart(k: { ecKreisID: number; rollen: string[] }) {
  return k.rollen.includes('fz')
    ? `/kreis/${k.ecKreisID}/fz`
    : `/kreis/${k.ecKreisID}/mitglieder`
}

/**
 * Wohin eine Freizeit im Menue fuehrt. Die Kuechenleitung hat keinen
 * Fuehrungszeugnis-Teil, fuer sie ist die TN-Liste die Startseite.
 */
function startseite(v: { veranstaltungsID: number; umfang: string }) {
  return v.umfang === 'kueche'
    ? `/veranstaltung/${v.veranstaltungsID}/tnliste`
    : `/veranstaltung/${v.veranstaltungsID}/mitarbeiter`
}

function zumLogin() {
  logout()
  router.push({ path: '/login', query: { next: route.value.fullPath } })
}

/**
 * Erst navigieren, dann abmelden: Die Leave-Guards (z. B. im Formular-Builder)
 * fragen nach ungespeicherten Änderungen. Wäre der Token schon weg, ließe sich
 * bei „Abbrechen“ nichts mehr speichern. Bleibt man auf der Seite, bleibt man
 * auch angemeldet.
 */
async function abmelden() {
  const fehlschlag = await router.push('/login')
  if (fehlschlag) return
  logout()
  // Nur beim bewussten Abmelden: Auf einem geteilten Rechner bekäme der
  // nächste Nutzer sonst den ungespeicherten Formular-Entwurf des Vorgängers
  // zur Wiederherstellung angeboten. Beim Rauswurf durch einen abgelaufenen
  // Token (zumLogin) bleibt der Entwurf liegen -- genau dafür gibt es ihn.
  loescheAlleEntwuerfe()
}

/**
 * Beim Laden von /portal/me nur dann abmelden, wenn die API die ANMELDUNG
 * ablehnt.
 *
 * Vorher flog jeder Fehler in denselben Zweig: eine kurz nicht erreichbare
 * API, ein 503 nach einem Deployment, ein 429 vom Rate-Limiter -- und der
 * Token war weg. Sichtbar wurde das nur beim Neuladen, weil /portal/me sonst
 * kein zweites Mal aufgerufen wird; von aussen sah es aus wie „Reload meldet
 * mich ab".
 */
async function laden() {
  fehler.value = ''
  try {
    await ladeMe()
    geladen.value = true
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      zumLogin()
      return
    }
    fehler.value =
      err instanceof Error ? err.message : 'Unbekannter Fehler beim Laden.'
  }
}

onMounted(() => {
  // Den echten 401-Handler erst hier setzen: api.ts darf den Router nicht
  // importieren (Zyklus über routes.ts und import.meta.glob).
  api.setUnauthorizedHandler(zumLogin)

  if (!authToken.value) {
    zumLogin()
    return
  }
  laden()
})
</script>
