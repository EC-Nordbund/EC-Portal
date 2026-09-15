<template lang="pug">
v-dialog(v-model='offen', max-width='560px', persistent, scrollable)
  v-card
    v-card-title {{ art === 'mitarbeit' ? 'Mitarbeiter/in hinzufügen' : 'Person hinzufügen' }}
    v-card-subtitle {{ kreisName }}
    v-card-text
      v-alert.mb-4(type='info', variant='tonal', density='compact')
        | Gibt es die Person schon im System, wird sie übernommen statt neu
        | angelegt. Name und Geburtsdatum entscheiden darüber — bitte genau
        | eintragen.
        template(v-if='art === "mitarbeit"')
          |  Eine Mitgliedschaft in einem anderen EC-Kreis bleibt unberührt —
          | die Person wird nur bei euch als mitarbeitend eingetragen.
        template(v-else)
          |  Wer hier steht, ist Mitglied. Wer im Kreis mitarbeitet und ein
          | Führungszeugnis braucht, trägt die/der FZ-Verantwortliche in der
          | Mitarbeiterliste ein.
      v-form(v-model='valid')
        .d-flex.ga-4.flex-wrap
          v-text-field(
            label='Vorname',
            v-model='daten.vorname',
            style='min-width: 180px; flex: 1',
            :rules='[pflicht]'
          )
          v-text-field(
            label='Nachname',
            v-model='daten.nachname',
            style='min-width: 180px; flex: 1',
            :rules='[pflicht]'
          )
        .d-flex.ga-4.flex-wrap
          v-text-field(
            label='Geburtsdatum',
            type='date',
            v-model='daten.gebDat',
            :max='heute',
            style='min-width: 180px; flex: 1',
            :rules='[pflicht]'
          )
          v-select(
            label='Geschlecht',
            v-model='daten.geschlecht',
            :items='[{ value: "w", title: "weiblich" }, { value: "m", title: "männlich" }]',
            style='min-width: 180px; flex: 1',
            :rules='[pflicht]'
          )
        v-select.mt-2(
          v-if='art === "mitglied"',
          label='Mitgliedsstatus',
          v-model='daten.ecMitglied',
          :items='statusItems'
        )

        .text-subtitle-2.mt-4.mb-2 Kontakt (kann später ergänzt werden)
        .d-flex.ga-4.flex-wrap
          v-text-field(
            label='E-Mail',
            type='email',
            v-model='daten.email',
            style='min-width: 200px; flex: 1'
          )
          v-text-field(
            label='Telefon',
            v-model='daten.telefon',
            style='min-width: 160px; flex: 1'
          )
        v-text-field(label='Straße und Hausnummer', v-model='daten.strasse')
        .d-flex.ga-4.flex-wrap
          v-text-field(
            label='PLZ',
            v-model='daten.plz',
            style='min-width: 110px; max-width: 140px',
            :rules='[plzRegel]'
          )
          v-text-field(
            label='Ort',
            v-model='daten.ort',
            style='min-width: 200px; flex: 1'
          )
    v-card-actions
      v-spacer
      v-btn(variant='text', @click='offen = false') Abbrechen
      v-btn(
        v-accent-bg,
        v-white,
        :disabled='!valid || laedt',
        :loading='laedt',
        @click='speichern'
      ) Hinzufügen
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApi } from '../plugins/api'
import { useDialog } from '../plugins/dialog'

/**
 * „+ Neu" in der Mitgliederliste (art = 'mitglied') und „+ Mitarbeiter/in"
 * in der FZ-Liste (art = 'mitarbeit'). Gleicher Dialog, zwei Endpunkte:
 * Als Mitglied zieht eine bestehende Person in diesen Kreis um; als
 * Mitarbeiterin wird sie nur zusätzlich eingetragen, ihre Mitgliedschaft
 * bleibt, wo sie ist.
 *
 * Die Dublettenprüfung passiert serverseitig und folgt der Logik der
 * Website-Anmeldung: erst exakt auf Name und Geburtsdatum suchen, dann in der
 * Tabelle bekannter Schreibvarianten, und erst dann neu anlegen. Deshalb sind
 * genau diese drei Felder Pflicht — alles andere lässt sich nachtragen.
 */
export interface StatusOption {
  ecMitgliedStatusID: number
  bezeichnung: string
}

const props = withDefaults(
  defineProps<{
    kreisID: number
    kreisName: string
    art?: 'mitglied' | 'mitarbeit'
    status?: StatusOption[]
  }>(),
  { art: 'mitglied', status: () => [] }
)
const emit = defineEmits<{ (e: 'gespeichert'): void }>()

const api = useApi()
const { error, notifyInfo } = useDialog()

const heute = new Date().toISOString().slice(0, 10)
const offen = ref(false)
const valid = ref(false)
const laedt = ref(false)

const leer = () => ({
  vorname: '',
  nachname: '',
  gebDat: '',
  geschlecht: '',
  ecMitglied: 2,
  email: '',
  telefon: '',
  strasse: '',
  plz: '',
  ort: ''
})
const daten = ref(leer())

const statusItems = computed(() =>
  props.status.map((s) => ({
    value: s.ecMitgliedStatusID,
    title: s.bezeichnung
  }))
)

const pflicht = (v: unknown) => (v ? true : 'Dieses Feld wird gebraucht.')
const plzRegel = (v: string) =>
  !v || /^\d{5}$/.test(v) ? true : 'Fünf Ziffern.'

function show() {
  daten.value = leer()
  offen.value = true
}

function speichern() {
  if (!valid.value || laedt.value) return
  laedt.value = true
  api
    .post<{ art: string; vorherigerKreis?: { bezeichnung: string } | null }>(
      `/portal/kreis/${props.kreisID}/${props.art === 'mitarbeit' ? 'mitarbeiter' : 'mitglied'}`,
      daten.value,
      { quiet: true }
    )
    .then((res) => {
      offen.value = false
      const name = `${daten.value.vorname} ${daten.value.nachname}`
      // Was passiert ist, gehört auf den Tisch: nur so merkt jemand, dass er
      // gerade eine bestehende Person übernommen statt neu angelegt hat.
      if (res.art === 'neu') {
        notifyInfo(`${name} hinzugefügt.`)
      } else if (res.art === 'bereits') {
        notifyInfo(`${name} ist bei euch bereits als mitarbeitend eingetragen.`)
      } else if (props.art === 'mitarbeit') {
        notifyInfo(
          `${name} war bereits im System und ist jetzt bei euch als mitarbeitend eingetragen.`
        )
      } else if (res.art === 'umgezogen') {
        notifyInfo(
          `${daten.value.vorname} ${daten.value.nachname} war bisher bei ${res.vorherigerKreis?.bezeichnung ?? 'einem anderen Kreis'} und ist jetzt in eurem Kreis. Die Geschäftsstelle wurde informiert.`
        )
      } else {
        notifyInfo(
          `${daten.value.vorname} ${daten.value.nachname} war bereits im System und wurde übernommen.`
        )
      }
      emit('gespeichert')
    })
    .catch((err) => {
      error({
        text: err.message || String(err),
        title: 'Hinzufügen fehlgeschlagen'
      })
    })
    .finally(() => {
      laedt.value = false
    })
}

defineExpose({ show })
</script>
