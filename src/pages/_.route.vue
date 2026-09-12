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

      template(v-if='me && me.kreise.length')
        v-divider.my-2
        v-list-subheader Meine EC-Kreise
        v-list-item(
          v-for='k in me.kreise',
          :key='k.ecKreisID',
          :to='`/kreis/${k.ecKreisID}`'
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
    .pa-8.text-center(v-else)
      v-progress-circular(indeterminate, color='primary')

  ec-dialog-host
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useLogin } from '../plugins/auth'
import { useApi } from '../plugins/api'
import { useRouter } from '../plugins/router'
import { useStorage } from '../storage'

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

const theme = useTheme()
watch(
  dark,
  (v) => {
    theme.global.name.value = v ? 'dark' : 'light'
  },
  { immediate: true }
)

const initialen = computed(() =>
  me.value
    ? `${me.value.user.vorname[0] ?? ''}${me.value.user.nachname[0] ?? ''}`
    : ''
)

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

function abmelden() {
  logout()
  router.push('/login')
}

async function laden() {
  try {
    await ladeMe()
    geladen.value = true
  } catch {
    zumLogin()
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
