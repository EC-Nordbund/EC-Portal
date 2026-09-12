<template lang="pug">
v-dialog(v-model='offen', max-width='520px', persistent)
  v-card(v-if='person')
    v-card-title.d-flex.align-center
      span Führungszeugnis eintragen
    v-card-subtitle {{ person.vorname }} {{ person.nachname }}{{ person.gebDat ? ` (${person.gebDat.german})` : '' }}
    v-card-text
      v-alert.mb-4(type='info', variant='tonal', density='compact')
        | Du bestätigst, das <strong>Original</strong> des erweiterten
        | Führungszeugnisses eingesehen zu haben. Das Zeugnis wird nicht
        | gespeichert — nur Datum und Kommentar.
      v-form(v-model='valid')
        v-text-field(
          label='Führungszeugnis vom',
          type='date',
          v-model='fzVon',
          :max='heute',
          hint='Das Ausstellungsdatum, das auf dem Zeugnis steht',
          persistent-hint,
          :rules='[(v) => (!!v ? true : "Bitte das Ausstellungsdatum angeben.")]'
        )
        v-text-field.mt-4(
          label='Gesehen am',
          type='date',
          v-model='gesehenAm',
          :max='heute',
          :rules='regelnGesehen'
        )
        v-textarea.mt-4(
          label='Kommentar',
          v-model='kommentar',
          rows='2',
          auto-grow,
          :rules='[(v) => (!!v ? true : "Bitte einen Kommentar angeben.")]'
        )
    v-card-actions
      v-spacer
      v-btn(variant='text', @click='abbrechen') Abbrechen
      v-btn(
        v-accent-bg,
        v-white,
        :disabled='!valid || laedt',
        :loading='laedt',
        @click='speichern'
      ) Eintragen
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApi } from '../plugins/api'
import { useDialog } from '../plugins/dialog'

/**
 * Dialog zum Eintragen eines eingesehenen Führungszeugnisses.
 *
 * Gegenüber der Verwaltung (config/forms/addFZ.form.ts) fehlt das Feld
 * "gesehen von": im Portal ist das immer die angemeldete Person, und der
 * Server setzt es aus dem Token. Eine Auswahlliste aller Personen hätte das
 * Portal ohnehin nicht -- und sollte sie auch nicht haben.
 *
 * Das Promise-Muster des Hauses (show().then(...).catch(empty)) passt hier
 * nicht, weil der Dialog selbst speichert und die Warnung der API anzeigt.
 * Stattdessen ein Event nach erfolgreichem Eintrag.
 */
export interface FzPerson {
  personID: number
  vorname: string
  nachname: string
  gebDat?: { german: string } | null
}

const emit = defineEmits<{ (e: 'gespeichert'): void }>()

const api = useApi()
const { error, notifyInfo } = useDialog()

const offen = ref(false)
const person = ref<FzPerson | null>(null)
const valid = ref(false)
const laedt = ref(false)

const heute = new Date().toISOString().slice(0, 10)
const fzVon = ref('')
const gesehenAm = ref(heute)
const kommentar = ref('Es spricht nichts gegen ein Engagement bei uns.')

const regelnGesehen = computed(() => [
  (v: string) => (!!v ? true : 'Bitte das Datum der Einsicht angeben.'),
  (v: string) =>
    !fzVon.value || v >= fzVon.value
      ? true
      : 'Das Zeugnis kann nicht vor seiner Ausstellung eingesehen worden sein.'
])

function show(p: FzPerson) {
  person.value = p
  fzVon.value = ''
  gesehenAm.value = heute
  kommentar.value = 'Es spricht nichts gegen ein Engagement bei uns.'
  offen.value = true
}

function abbrechen() {
  offen.value = false
}

function speichern() {
  if (!valid.value || laedt.value || !person.value) return
  laedt.value = true
  api
    .post<{ warnung: string | null }>(
      '/portal/fz',
      {
        personID: person.value.personID,
        fzVon: fzVon.value,
        gesehenAm: gesehenAm.value,
        kommentar: kommentar.value
      },
      { quiet: true }
    )
    .then((res) => {
      offen.value = false
      // Die Warnung ist kein Fehler: der Eintrag steht. Sie soll aber gesehen
      // werden -- das Zeugnis war bei der Einsicht älter als drei Monate.
      notifyInfo(
        res.warnung
          ? `Eingetragen. Hinweis: ${res.warnung}`
          : 'Führungszeugnis eingetragen.'
      )
      emit('gespeichert')
    })
    .catch((err) => {
      error({
        text: err.message || String(err),
        title: 'Eintragen fehlgeschlagen'
      })
    })
    .finally(() => {
      laedt.value = false
    })
}

defineExpose({ show })
</script>
