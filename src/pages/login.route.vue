<template lang="pug">
v-app
  v-main
    .ec-alignCenter
      v-card(min-width='320px', max-width='420px')
        v-card-title.d-flex.align-center
          h1(v-font, v-primary) Portal
          v-spacer
          img(width='72px', src='../assets/ec-logo-without-bg-512.png')
        v-card-subtitle Für Freizeitleiter und Ortsverantwortliche
        v-card-text
          v-form(v-model='valid', @submit.prevent='anmelden')
            v-text-field(
              label='E-Mail-Adresse',
              type='email',
              autocomplete='username',
              v-model='daten.email',
              :autofocus='daten.email === ""',
              :rules='[(v) => (!!v ? true : "Bitte deine E-Mail-Adresse angeben.")]'
            )
            v-text-field(
              label='Passwort',
              autocomplete='current-password',
              v-model='daten.password',
              :autofocus='daten.email !== ""',
              :color='isCaps ? "info" : undefined',
              :append-icon='isCaps ? "keyboard_capslock" : undefined',
              :append-inner-icon='zeigePasswort ? "visibility_off" : "visibility"',
              @click:append-inner='zeigePasswort = !zeigePasswort',
              :type='zeigePasswort ? "text" : "password"',
              @keyup.enter='anmelden',
              :rules='[(v) => (!!v ? true : "Bitte dein Passwort angeben.")]'
            )
        v-card-actions
          v-btn(variant='text', size='small', to='/passwort/vergessen') Passwort vergessen?
          v-spacer
          v-btn(
            v-accent-bg,
            v-white,
            :disabled='!valid || laedt',
            :loading='laedt',
            @click='anmelden'
          ) Anmelden
  ec-dialog-host
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useStorage } from '../storage'
import { useLogin } from '../plugins/auth'
import { useCaps } from '../plugins/caps'
import { useRouter } from '../plugins/router'
import { useDialog } from '../plugins/dialog'

/**
 * Anmeldung mit E-Mail-Adresse statt Benutzername.
 *
 * Der Zugang entsteht ohnehin über einen Mail-Link, und die Zielgruppe merkt
 * sich keinen zusätzlich vergebenen Kunstnamen. Die Adresse steht als eigene
 * Spalte in `portalUser` und nicht als Join auf `eMails` -- letztere ändert
 * sich sonst unter dem Konto weg.
 */
const { dark } = useStorage()
const { route, router } = useRouter()
const { login, authToken } = useLogin()
const { error } = useDialog()
const { isCaps } = useCaps()

const laedt = ref(false)
const valid = ref(false)
const zeigePasswort = ref(false)
const daten = ref({ email: '', password: '' })

// Die Login-Seite liegt außerhalb des Haupt-Layouts, also das Theme hier
// selbst setzen.
const theme = useTheme()
watch(
  dark,
  (v) => {
    theme.global.name.value = v ? 'dark' : 'light'
  },
  { immediate: true }
)

function weiter() {
  const next = route.value.query.next as string | undefined
  router.push(next && !next.startsWith('/404') ? next : '/home')
}

function anmelden() {
  if (!valid.value || laedt.value) return
  laedt.value = true
  login(daten.value)
    .then(weiter)
    .catch((err) => {
      error({
        text: err.message || String(err),
        title: 'Anmelden fehlgeschlagen'
      })
    })
    .finally(() => {
      laedt.value = false
    })
}

onMounted(() => {
  if (authToken.value) weiter()
})
</script>
