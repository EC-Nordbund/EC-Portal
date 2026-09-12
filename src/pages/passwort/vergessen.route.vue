<template lang="pug">
v-app
  v-main
    .ec-alignCenter
      v-card(min-width='320px', max-width='420px')
        v-card-title.d-flex.align-center
          h1(v-font, v-primary) Passwort
        v-card-text(v-if='!gesendet')
          p.mb-4 Gib deine E-Mail-Adresse an. Wenn es dazu einen Zugang gibt, schicken wir dir einen Link zum Festlegen eines neuen Passworts.
          v-form(v-model='valid', @submit.prevent='anfordern')
            v-text-field(
              label='E-Mail-Adresse',
              type='email',
              v-model='email',
              autofocus,
              @keyup.enter='anfordern',
              :rules='[(v) => (!!v ? true : "Bitte deine E-Mail-Adresse angeben.")]'
            )
        v-card-text(v-else)
          v-alert(type='success', variant='tonal')
            | Wenn zu dieser Adresse ein Zugang besteht, ist eine E-Mail unterwegs.
            | Der Link darin ist zwei Stunden gültig.
        v-card-actions
          v-btn(variant='text', size='small', to='/login') Zurück zur Anmeldung
          v-spacer
          v-btn(
            v-if='!gesendet',
            v-accent-bg,
            v-white,
            :disabled='!valid || laedt',
            :loading='laedt',
            @click='anfordern'
          ) Link anfordern
  ec-dialog-host
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '../../plugins/api'

/**
 * "Passwort vergessen".
 *
 * Die Rückmeldung ist bewusst unspezifisch und unabhängig davon, ob es das
 * Konto gibt -- sonst wäre die Seite eine bequeme Möglichkeit
 * herauszufinden, wer im EC-Nordbund einen Zugang hat. Die API antwortet aus
 * demselben Grund immer mit 202.
 */
const api = useApi()
const email = ref('')
const valid = ref(false)
const laedt = ref(false)
const gesendet = ref(false)

function anfordern() {
  if (!valid.value || laedt.value) return
  laedt.value = true
  api
    .post('/portal/password/forgot', { email: email.value }, { auth: false })
    .catch(() => undefined)
    .finally(() => {
      laedt.value = false
      gesendet.value = true
    })
}
</script>
