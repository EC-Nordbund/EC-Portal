<template lang="pug">
v-dialog(v-model='offen', max-width='640px', persistent, scrollable)
  v-card
    v-card-title.d-flex.align-center
      span Material beantragen
    v-card-subtitle(v-if='zeitraum') {{ deutsch(zeitraum.von) }} – {{ deutsch(zeitraum.bis) }}
    v-card-text
      v-form(v-model='valid')
        v-table(density='compact')
          thead
            tr
              th Material
              th.text-right(style='width: 110px') Anzahl
              th(style='width: 40px')
          tbody
            tr(v-for='p in positionen', :key='p.material.materialID')
              td
                div {{ p.material.name }}
                .text-caption(v-if='p.material.frei !== null') {{ p.material.frei }} frei im Zeitraum
              td.text-right
                v-text-field(
                  :model-value='mengen.get(p.material.materialID)',
                  type='number',
                  min='1',
                  :max='maxMenge(p.material)',
                  density='compact',
                  hide-details,
                  variant='outlined',
                  @update:model-value='(v) => mengeSetzen(p.material, v)'
                )
              td
                v-btn(icon, variant='text', size='x-small', title='Position entfernen', @click='entfernen(p.material.materialID)')
                  v-icon close

        v-alert.mt-3(v-if='!positionen.length', type='warning', variant='tonal', density='compact')
          | Keine Positionen mehr im Antrag.

        //- Wofür? Eine Freizeit aus dem eigenen Bereich oder ein anderer
        //- Anlass (Jugendabend, Kreistreffen) -- Ortsveranstaltungen stehen
        //- nicht in der Datenbank, deshalb Freitext plus optionaler Kreis.
        v-radio-group.mt-4(
          v-if='me.veranstaltungen.length',
          v-model='anlassArt',
          label='Anlass',
          hide-details
        )
          v-radio(label='Eine meiner Freizeiten', value='veranstaltung')
          v-radio(label='Anderer Anlass', value='frei')

        v-select(
          v-if='anlassArt === "veranstaltung"',
          v-model='veranstaltungsID',
          :items='veranstaltungItems',
          label='Freizeit',
          :rules='[(v) => (!!v ? true : "Bitte eine Freizeit wählen.")]'
        )
        template(v-else)
          v-text-field(
            v-model='anlass',
            label='Anlass',
            hint='z. B. Jugendabend, Kreiswochenende, Mitarbeiterschulung',
            persistent-hint,
            counter='200',
            :rules='[(v) => (!!v && v.trim() ? true : "Bitte den Anlass angeben."), (v) => (!v || v.length <= 200 ? true : "Höchstens 200 Zeichen.")]'
          )
          v-select.mt-2(
            v-model='ecKreisID',
            :items='kreisItems',
            label='EC-Kreis (optional)',
            clearable
          )

        v-textarea.mt-4(
          v-model='kommentar',
          label='Kommentar (optional)',
          rows='2',
          auto-grow,
          counter='2000',
          hint='Abholung, Rückgabe, Besonderheiten – alles, was der Materialwart wissen sollte',
          persistent-hint,
          :rules='[(v) => (!v || v.length <= 2000 ? true : "Höchstens 2000 Zeichen.")]'
        )
    v-card-actions
      v-spacer
      v-btn(variant='text', @click='abbrechen') Abbrechen
      v-btn(
        v-accent-bg,
        v-white,
        :disabled='!valid || laedt || !positionen.length || !zeitraum',
        :loading='laedt',
        @click='absenden'
      ) Antrag stellen
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useApi } from '../plugins/api'
import type { PortalMe } from '../plugins/auth'
import { useDialog } from '../plugins/dialog'
import type { Material } from '../util/material.types'

/**
 * Antragsdialog: Zusammenfassung der Auswahl, Anlass, Kommentar, absenden.
 *
 * Die Mengen sind hier noch einmal änderbar -- wer beim Zusammenklicken zu
 * viel genommen hat, soll nicht zurück in die Liste müssen. Der Dialog
 * speichert selbst (Muster addFz.lib.vue) und meldet die neue Antrags-ID.
 */
const props = defineProps<{
  me: PortalMe
  zeitraum: { von: string; bis: string } | null
  kreise: Array<{ ecKreisID: number; bezeichnung: string }>
  positionen: Array<{ material: Material; menge: number }>
}>()

const emit = defineEmits<{
  (e: 'gespeichert', materialAntragID: number): void
  (e: 'entfernt', materialID: number): void
}>()

const api = useApi()
const { error, notifyInfo } = useDialog()

const offen = ref(false)
const valid = ref(false)
const laedt = ref(false)

/** Mengen im Dialog; die Liste dahinter bleibt unberührt, bis abgesendet wird. */
const mengen = reactive(new Map<number, number>())

const anlassArt = ref<'veranstaltung' | 'frei'>('frei')
const veranstaltungsID = ref<number | null>(null)
const anlass = ref('')
const ecKreisID = ref<number | null>(null)
const kommentar = ref('')

const veranstaltungItems = computed(() =>
  props.me.veranstaltungen.map((v) => ({
    value: v.veranstaltungsID,
    title: v.begin ? `${v.bezeichnung} (${v.begin.german})` : v.bezeichnung
  }))
)

const kreisItems = computed(() =>
  props.kreise.map((k) => ({ value: k.ecKreisID, title: k.bezeichnung }))
)

function deutsch(iso: string) {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

function maxMenge(m: Material) {
  return Math.max(m.frei !== null ? m.frei : m.bestand, 1)
}

function mengeSetzen(m: Material, wert: string | number) {
  const n = Math.floor(Number(wert))
  if (!Number.isFinite(n) || n < 1) return
  mengen.set(m.materialID, Math.min(n, maxMenge(m)))
}

function entfernen(materialID: number) {
  mengen.delete(materialID)
  emit('entfernt', materialID)
}

function show() {
  mengen.clear()
  for (const p of props.positionen) mengen.set(p.material.materialID, p.menge)
  // Vorbelegung: wer genau eine Freizeit hat, meint fast immer die.
  if (props.me.veranstaltungen.length) {
    anlassArt.value = 'veranstaltung'
    veranstaltungsID.value =
      props.me.veranstaltungen.length === 1
        ? props.me.veranstaltungen[0].veranstaltungsID
        : null
  } else {
    anlassArt.value = 'frei'
    veranstaltungsID.value = null
  }
  // Kreis vorbelegen, wenn es nur einen gibt, an dem die Person hängt.
  ecKreisID.value =
    props.me.kreise.length === 1 ? props.me.kreise[0].ecKreisID : null
  anlass.value = ''
  kommentar.value = ''
  offen.value = true
}

function abbrechen() {
  offen.value = false
}

function absenden() {
  if (
    !valid.value ||
    laedt.value ||
    !props.zeitraum ||
    !props.positionen.length
  )
    return
  laedt.value = true
  const body: Record<string, unknown> = {
    von: props.zeitraum.von,
    bis: props.zeitraum.bis,
    kommentar: kommentar.value.trim(),
    positionen: props.positionen.map((p) => ({
      materialID: p.material.materialID,
      menge: mengen.get(p.material.materialID) ?? p.menge
    }))
  }
  if (anlassArt.value === 'veranstaltung') {
    body.veranstaltungsID = veranstaltungsID.value
  } else {
    body.anlass = anlass.value.trim()
    if (ecKreisID.value) body.ecKreisID = ecKreisID.value
  }
  api
    .post<{ materialAntragID: number }>('/portal/material/antrag', body, {
      quiet: true
    })
    .then((res) => {
      offen.value = false
      notifyInfo('Antrag gestellt. Der Materialwart meldet sich per E-Mail.')
      emit('gespeichert', res.materialAntragID)
    })
    .catch((err) => {
      error({
        text: err.message || String(err),
        title: 'Antrag konnte nicht gestellt werden'
      })
    })
    .finally(() => {
      laedt.value = false
    })
}

defineExpose({ show })
</script>
