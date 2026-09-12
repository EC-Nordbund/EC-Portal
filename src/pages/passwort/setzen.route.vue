<template lang="pug">
v-app
  v-main
    .ec-alignCenter
      v-card(min-width='320px', max-width='460px')
        v-card-title.d-flex.align-center
          h1(v-font, v-primary) Passwort festlegen
        v-card-text(v-if='pruefung === "laeuft"')
          v-progress-circular(indeterminate, color='primary')
        v-card-text(v-else-if='pruefung === "ungueltig"')
          v-alert(type='error', variant='tonal') {{ fehler }}
        v-card-text(v-else)
          p.mb-4
            | Hallo <strong>{{ info.vorname }}</strong>, lege bitte ein Passwort für
            | den Zugang <strong>{{ info.email }}</strong> fest.
          v-form(v-model='valid', @submit.prevent='speichern')
            v-text-field(
              label='Neues Passwort',
              autocomplete='new-password',
              v-model='pw1',
              autofocus,
              :append-inner-icon='zeigen ? "visibility_off" : "visibility"',
              @click:append-inner='zeigen = !zeigen',
              :type='zeigen ? "text" : "password"',
              :rules='regelnPw'
            )
            v-text-field(
              label='Passwort wiederholen',
              autocomplete='new-password',
              v-model='pw2',
              :type='zeigen ? "text" : "password"',
              @keyup.enter='speichern',
              :rules='[(v) => (v === pw1 ? true : "Die beiden Eingaben stimmen nicht überein.")]'
            )
            p.text-caption.mt-2 Mindestens 12 Zeichen. Eine längere Wortfolge ist sicherer als ein kurzes Kunstwort.
        v-card-actions
          v-btn(variant='text', size='small', to='/login') Zur Anmeldung
          v-spacer
          v-btn(
            v-if='pruefung === "ok"',
            v-accent-bg,
            v-white,
            :disabled='!valid || laedt',
            :loading='laedt',
            @click='speichern'
          ) Speichern
  ec-dialog-host
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '../../plugins/api'
import { useRouter } from '../../plugins/router'
import { useStorage } from '../../storage'
import { useDialog } from '../../plugins/dialog'
import { compileRules } from '../../forms/rules'

/**
 * Einladung und Passwort-Reset teilen sich diese Seite -- beide Wege enden in
 * demselben Einmal-Token.
 *
 * Der Token steht im Fragment der URL (Hash-Routing), wird vom Browser also
 * nie an einen Server geschickt und landet weder in Access-Logs noch im
 * Referer. Für einen Einmal-Link, der ein Konto übernehmen kann, ist das kein
 * Zufallsvorteil, sondern der Grund, das Hash-Routing beizubehalten.
 */
const api = useApi()
const { route, router } = useRouter()
const { authToken } = useStorage()
const { error } = useDialog()

const pruefung = ref<'laeuft' | 'ok' | 'ungueltig'>('laeuft')
const fehler = ref('')
const info = ref({ vorname: '', email: '' })
const pw1 = ref('')
const pw2 = ref('')
const zeigen = ref(false)
const valid = ref(false)
const laedt = ref(false)

// Die Mindestlänge wird serverseitig geprüft; hier dieselbe Regel, damit der
// Hinweis vor dem Absenden kommt. Eine 'gleich wie Feld X'-Regel gibt es in
// rules.ts nicht und wird bewusst nicht ergänzt (sonst driften die Kopien in
// den beiden Repos auseinander) -- die steht direkt am zweiten Feld.
const regelnPw = compileRules('required|min:12', 'Passwort')

const token = () => String(route.value.query.token ?? '')

onMounted(async () => {
  if (!token()) {
    pruefung.value = 'ungueltig'
    fehler.value = 'Dieser Link ist unvollständig.'
    return
  }
  try {
    const res = await api.get<{ vorname: string; email: string }>(
      `/portal/password/token/${encodeURIComponent(token())}`,
      { auth: false, quiet: true }
    )
    info.value = { vorname: res.vorname, email: res.email }
    pruefung.value = 'ok'
  } catch (err: any) {
    pruefung.value = 'ungueltig'
    fehler.value =
      err?.message ??
      'Dieser Link ist abgelaufen oder wurde bereits benutzt. Bitte fordere einen neuen an.'
  }
})

function speichern() {
  if (!valid.value || laedt.value) return
  laedt.value = true
  api
    .post<{ token: string }>(
      '/portal/password/set',
      { token: token(), password: pw1.value },
      { auth: false, quiet: true }
    )
    .then((res) => {
      // Die API meldet direkt an: nach dem Setzen soll niemand noch einmal
      // dasselbe Passwort eintippen müssen.
      authToken.value = res.token
      router.push('/home')
    })
    .catch((err) => {
      error({
        text: err.message || String(err),
        title: 'Passwort konnte nicht gesetzt werden'
      })
    })
    .finally(() => {
      laedt.value = false
    })
}
</script>
