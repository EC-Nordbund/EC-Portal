<template lang="pug">
v-dialog(v-model='offen', max-width='720px', persistent, scrollable)
  v-card
    v-card-title.d-flex.align-center
      span {{ vorlageID ? 'Vorlage bearbeiten' : 'Neue Vorlage' }}
      v-spacer
      v-btn(icon, variant='text', :disabled='laedt', @click='abbrechen')
        v-icon close
    v-card-text
      v-form(v-model='valid')
        v-text-field(
          v-model='form.name',
          label='Name',
          maxlength='120',
          counter,
          hint='z. B. „Teencamp-Grundliste“',
          :rules='[(v) => (!!(v && v.trim()) ? true : "Bitte einen Namen angeben.")]'
        )
        .d-flex.flex-wrap.ga-4
          v-select(
            v-model='form.bereich',
            label='Bereich',
            :items='BEREICHE',
            style='min-width: 240px; flex: 2',
            :hint='form.bereich === "referenten" ? "Sehen nur Freizeitleitung und Materialwarte; darf Spezial-Material enthalten." : "Sieht jeder Portal-Nutzer; darf nur allgemeines Material enthalten."',
            persistent-hint,
            @update:model-value='bereichGewechselt'
          )
          v-text-field(
            v-model.number='form.sortierung',
            label='Sortierung',
            type='number',
            style='min-width: 120px; flex: 1',
            hint='kleine Zahl = weiter oben'
          )
        v-textarea.mt-2(
          v-model='form.beschreibung',
          label='Beschreibung',
          rows='2',
          auto-grow,
          maxlength='1000',
          counter
        )

      v-divider.my-4

      .text-subtitle-2.mb-2 Positionen
      v-alert.mb-3(v-if='bereichHinweis', type='warning', variant='tonal', density='compact', closable, @click:close='bereichHinweis = ""') {{ bereichHinweis }}
      v-autocomplete(
        v-model='hinzufuegen',
        :items='auswahlItems',
        item-title='title',
        item-value='value',
        label='Material hinzufügen',
        prepend-inner-icon='add',
        density='compact',
        variant='outlined',
        clearable,
        :loading='bestandLaedt',
        :no-data-text='bestandLaedt ? "Lade Bestand …" : "Kein passendes Material"',
        @update:model-value='materialHinzufuegen'
      )
      v-alert(v-if='!positionen.length', type='info', variant='tonal', density='compact')
        | Noch keine Positionen. Wähle oben Material aus.
      v-table(v-else, density='compact')
        thead
          tr
            th(style='width: 48px')
            th Material
            th.text-right(style='width: 120px') Menge
            th(style='width: 48px')
        tbody
          tr(v-for='p in positionen', :key='p.materialID')
            td
              ec-material-foto(
                :material-i-d='p.materialID',
                :name='p.name',
                :hat-foto='p.hatFoto',
                :size='36',
                :klickbar='false'
              )
            td
              | {{ p.name }}
              v-chip.ml-2(v-if='p.bereich === "referenten"', size='x-small', variant='outlined') Speziell
              v-chip.ml-2(v-if='!p.aktiv', size='x-small', color='warning', variant='flat') archiviert
              v-chip.ml-2(v-else-if='!p.freigegeben', size='x-small', variant='outlined') nicht freigegeben
            td.text-right
              v-text-field(
                v-model.number='p.menge',
                type='number',
                min='1',
                max='9999',
                density='compact',
                hide-details,
                variant='outlined',
                style='width: 100px; display: inline-block',
                :error='!mengeGueltig(p.menge)'
              )
            td
              v-btn(icon, variant='text', size='small', title='Entfernen', @click='entfernen(p.materialID)')
                v-icon close
    v-card-actions
      span.text-caption.text-medium-emphasis.ml-2(v-if='positionen.length')
        | {{ positionen.length }} {{ positionen.length === 1 ? 'Position' : 'Positionen' }} · {{ stueck }} Stück
      v-spacer
      v-btn(variant='text', :disabled='laedt', @click='abbrechen') Abbrechen
      v-btn(
        v-accent-bg,
        v-white,
        :disabled='!valid || !positionenOk || laedt',
        :loading='laedt',
        @click='speichern'
      ) {{ vorlageID ? 'Speichern' : 'Anlegen' }}
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useApi } from '../plugins/api'
import { useDialog } from '../plugins/dialog'
import type {
  MaterialBereich,
  MaterialVerwaltung,
  VorlagePositionVerwaltung,
  VorlageVerwaltung
} from '../util/material.types'

/**
 * Anlegen und Bearbeiten einer Materiallisten-Vorlage.
 *
 * Die Positionen kommen aus dem Bestand (nur aktives Material). Eine
 * „Allgemein“-Vorlage darf kein Spezial-Material enthalten -- sonst sähe
 * jemand ohne Spezial-Recht Positionen, die er nie beantragen kann. Beim
 * Umschalten auf „Allgemein“ fliegen solche Positionen deshalb mit Hinweis
 * raus; die API prüft das zusätzlich (BEREICH_KONFLIKT).
 */
const emit = defineEmits<{
  (e: 'gespeichert', materialVorlageID: number): void
}>()
const api = useApi()
const { error, notifyInfo } = useDialog()

const BEREICHE = [
  { value: 'allgemein', title: 'Allgemein – für alle Portal-Nutzer' },
  { value: 'referenten', title: 'Speziell' }
]

const offen = ref(false)
const valid = ref(false)
const laedt = ref(false)
const vorlageID = ref<number | null>(null)
const bereichHinweis = ref('')
const hinzufuegen = ref<number | null>(null)

const form = reactive({
  name: '',
  bereich: 'allgemein' as MaterialBereich,
  sortierung: 0,
  beschreibung: ''
})
const positionen = ref<VorlagePositionVerwaltung[]>([])

// Bestand einmal je Dialog-Sitzung; danach aus dem Speicher.
const bestand = ref<MaterialVerwaltung[]>([])
const bestandLaedt = ref(false)

async function ladeBestand() {
  if (bestand.value.length || bestandLaedt.value) return
  bestandLaedt.value = true
  try {
    const res = await api.get<{ material: MaterialVerwaltung[] }>(
      '/portal/material/verwaltung/material',
      { quiet: true }
    )
    bestand.value = res.material
  } catch {
    bestand.value = []
  } finally {
    bestandLaedt.value = false
  }
}

/** Auswahlliste: aktiv, noch nicht in der Vorlage, und zum Bereich passend. */
const auswahlItems = computed(() => {
  const drin = new Set(positionen.value.map((p) => p.materialID))
  return bestand.value
    .filter((m) => m.aktiv && !drin.has(m.materialID))
    .filter((m) => form.bereich === 'referenten' || m.bereich !== 'referenten')
    .map((m) => ({
      value: m.materialID,
      title: `${m.name}${m.kategorie ? ` · ${m.kategorie}` : ''}${m.bereich === 'referenten' ? ' · Speziell' : ''}${m.freigegeben ? '' : ' · nicht freigegeben'}`
    }))
})

const stueck = computed(() =>
  positionen.value.reduce((s, p) => s + (Number(p.menge) || 0), 0)
)

function mengeGueltig(v: unknown) {
  const n = Number(v)
  return v !== '' && v !== null && Number.isInteger(n) && n >= 1 && n <= 9999
}

const positionenOk = computed(
  () =>
    positionen.value.length > 0 &&
    positionen.value.every((p) => mengeGueltig(p.menge))
)

function materialHinzufuegen(id: number | null) {
  if (!id) return
  const m = bestand.value.find((x) => x.materialID === id)
  if (m && !positionen.value.some((p) => p.materialID === id)) {
    positionen.value.push({
      materialID: m.materialID,
      name: m.name,
      menge: 1,
      aktiv: m.aktiv,
      freigegeben: m.freigegeben,
      bereich: m.bereich,
      hatFoto: m.hatFoto
    })
  }
  // Feld wieder leeren, damit das nächste Material gewählt werden kann.
  hinzufuegen.value = null
}

function entfernen(materialID: number) {
  positionen.value = positionen.value.filter((p) => p.materialID !== materialID)
}

/** Allgemein darf kein Spezial-Material enthalten: raus damit, aber gesagt. */
function bereichGewechselt(neu: MaterialBereich) {
  if (neu !== 'allgemein') return
  const weg = positionen.value.filter((p) => p.bereich === 'referenten')
  if (!weg.length) return
  positionen.value = positionen.value.filter((p) => p.bereich !== 'referenten')
  bereichHinweis.value = `Entfernt, weil eine allgemeine Vorlage kein Spezial-Material enthalten darf: ${weg.map((p) => p.name).join(', ')}`
}

function show(v: VorlageVerwaltung | null) {
  vorlageID.value = v?.materialVorlageID ?? null
  form.name = v?.name ?? ''
  form.bereich = v?.bereich ?? 'allgemein'
  form.sortierung = v?.sortierung ?? 0
  form.beschreibung = v?.beschreibung ?? ''
  positionen.value = (v?.positionen ?? []).map((p) => ({ ...p }))
  bereichHinweis.value = ''
  hinzufuegen.value = null
  offen.value = true
  ladeBestand()
}

function abbrechen() {
  offen.value = false
}

async function speichern() {
  if (!valid.value || !positionenOk.value || laedt.value) return
  laedt.value = true
  const body = {
    name: form.name.trim(),
    beschreibung: form.beschreibung.trim(),
    bereich: form.bereich,
    sortierung: Number(form.sortierung) || 0,
    positionen: positionen.value.map((p) => ({
      materialID: p.materialID,
      menge: Number(p.menge)
    }))
  }
  try {
    if (vorlageID.value) {
      await api.request(
        `/portal/material/verwaltung/vorlage/${vorlageID.value}`,
        { method: 'PUT', body, quiet: true }
      )
      notifyInfo(`Vorlage „${body.name}“ gespeichert.`)
      offen.value = false
      emit('gespeichert', vorlageID.value)
    } else {
      const res = await api.post<{ materialVorlageID: number }>(
        '/portal/material/verwaltung/vorlage',
        body,
        { quiet: true }
      )
      notifyInfo(`Vorlage „${body.name}“ angelegt.`)
      offen.value = false
      emit('gespeichert', res.materialVorlageID)
    }
  } catch (err: any) {
    error({
      text: err.message || String(err),
      title: 'Speichern fehlgeschlagen'
    })
  } finally {
    laedt.value = false
  }
}

defineExpose({ show })
</script>
