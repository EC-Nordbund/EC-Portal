<template lang="pug">
v-dialog(v-model='offen', max-width='640px', persistent, scrollable)
  v-card
    v-card-title.d-flex.align-center
      span {{ materialID ? 'Material bearbeiten' : 'Neues Material' }}
      v-spacer
      v-btn(icon, variant='text', :disabled='laedt', @click='abbrechen')
        v-icon close
    v-card-text
      v-form(v-model='valid')
        v-text-field(
          v-model='form.name',
          label='Name',
          maxlength='200',
          counter,
          :rules='[(v) => (!!(v && v.trim()) ? true : "Bitte einen Namen angeben.")]'
        )
        .d-flex.flex-wrap.ga-4
          v-select(
            v-model='form.bereich',
            label='Bereich',
            :items='BEREICHE',
            style='min-width: 220px; flex: 1',
            hint='„Speziell“ sehen nur Freizeitleitung und Materialwarte',
            persistent-hint
          )
          v-select(
            v-model='form.materialKategorieID',
            label='Kategorie',
            :items='kategorieItems',
            clearable,
            style='min-width: 220px; flex: 1'
          )
        .d-flex.flex-wrap.ga-4.mt-2
          v-text-field(
            v-model.number='form.bestand',
            label='Anzahl im Lager',
            type='number',
            min='0',
            max='9999',
            style='min-width: 160px; flex: 1',
            :rules='[(v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 9999 ? true : "0 bis 9999")]'
          )
          v-text-field(
            v-model='form.lagerort',
            label='Lagerort',
            maxlength='200',
            style='min-width: 220px; flex: 2',
            hint='z. B. Regal 3, Kiste „Sport“'
          )
        v-textarea.mt-2(
          v-model='form.beschreibung',
          label='Beschreibung / Kommentar',
          rows='3',
          auto-grow,
          maxlength='2000',
          counter
        )
        v-switch(
          v-model='form.freigegeben',
          label='Freigegeben – im Katalog sichtbar',
          color='primary',
          hide-details,
          density='compact'
        )

      //- Foto erst nach dem Anlegen: der Upload braucht die materialID.
      template(v-if='materialID')
        v-divider.my-4
        .d-flex.align-center.ga-4
          ec-material-foto(
            :material-i-d='materialID',
            :name='form.name',
            :hat-foto='hatFoto',
            :foto-stand='fotoStand',
            :size='96'
          )
          div
            .text-subtitle-2 Foto
            .text-caption.text-medium-emphasis.mb-2
              | Wird im Browser verkleinert (max. 1200 px), das Original bleibt bei dir.
            .d-flex.flex-wrap.ga-2
              v-btn(
                size='small',
                variant='tonal',
                prepend-icon='photo_camera',
                :loading='laedtFoto',
                :disabled='laedt',
                @click='dateiInput?.click()'
              ) {{ hatFoto ? 'Foto ersetzen' : 'Foto hochladen' }}
              v-btn(
                v-if='hatFoto',
                size='small',
                variant='text',
                color='error',
                prepend-icon='delete',
                :disabled='laedt || laedtFoto',
                @click='fotoEntfernen'
              ) Entfernen
        input(
          ref='dateiInput',
          type='file',
          accept='image/*',
          style='display: none',
          @change='dateiGewaehlt'
        )
      v-alert.mt-4(v-else, type='info', variant='tonal', density='compact')
        | Ein Foto kannst du nach dem Anlegen hinzufügen.
    v-card-actions
      v-spacer
      v-btn(variant='text', :disabled='laedt', @click='abbrechen') {{ materialID ? 'Schließen' : 'Abbrechen' }}
      v-btn(
        v-accent-bg,
        v-white,
        :disabled='!valid || laedt',
        :loading='laedt',
        @click='speichern'
      ) {{ materialID ? 'Speichern' : 'Anlegen' }}
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useApi } from '../plugins/api'
import { useDialog } from '../plugins/dialog'
import { materialFotoAufbereiten } from '../util/bild.util'
import { useMaterialFotos } from '../util/materialFoto.util'
import type {
  MaterialBereich,
  MaterialKategorie,
  MaterialVerwaltung
} from '../util/material.types'

/**
 * Anlegen und Bearbeiten eines Materials, inklusive Foto.
 *
 * Das Foto hängt an der materialID und geht deshalb erst nach dem Anlegen --
 * der Dialog bleibt nach „Anlegen“ offen und wechselt in den Bearbeiten-
 * Modus, damit man das Foto gleich nachschieben kann. Verkleinert wird im
 * Browser (bild.util.ts), zwei Fassungen: Foto und Vorschau.
 */
const emit = defineEmits<{ (e: 'gespeichert', materialID: number): void }>()
const api = useApi()
const { error, notifyInfo } = useDialog()
const { setze } = useMaterialFotos()

const BEREICHE = [
  { value: 'allgemein', title: 'Allgemein – für alle Portal-Nutzer' },
  // Der DB-Wert heisst weiter 'referenten'; nach aussen ist der Bereich „Speziell“.
  { value: 'referenten', title: 'Speziell' }
]

const props = defineProps<{ kategorien: MaterialKategorie[] }>()

const kategorieItems = computed(() =>
  props.kategorien.map((k) => ({
    value: k.materialKategorieID,
    title: k.bezeichnung
  }))
)

const offen = ref(false)
const valid = ref(false)
const laedt = ref(false)
const laedtFoto = ref(false)
const materialID = ref<number | null>(null)
const hatFoto = ref(false)
const fotoStand = ref<number | null>(null)
const dateiInput = ref<HTMLInputElement | null>(null)

const form = reactive({
  name: '',
  bereich: 'allgemein' as MaterialBereich,
  materialKategorieID: null as number | null,
  bestand: 1,
  lagerort: '',
  beschreibung: '',
  freigegeben: true
})

function show(m: MaterialVerwaltung | null) {
  materialID.value = m?.materialID ?? null
  hatFoto.value = m?.hatFoto ?? false
  fotoStand.value = m?.fotoStand ?? null
  form.name = m?.name ?? ''
  form.bereich = m?.bereich ?? 'allgemein'
  form.materialKategorieID = m?.materialKategorieID ?? null
  form.bestand = m?.bestand ?? 1
  form.lagerort = m?.lagerort ?? ''
  form.beschreibung = m?.beschreibung ?? ''
  // Neues Material ist standardmäßig freigegeben: es gibt nur die eine
  // Rolle, wer anlegt, gibt auch frei. Wer erst prüfen will, schaltet ab.
  form.freigegeben = m?.freigegeben ?? true
  offen.value = true
}

function abbrechen() {
  offen.value = false
}

async function speichern() {
  if (!valid.value || laedt.value) return
  laedt.value = true
  const body = {
    name: form.name.trim(),
    bereich: form.bereich,
    materialKategorieID: form.materialKategorieID,
    bestand: Number(form.bestand),
    lagerort: form.lagerort.trim(),
    beschreibung: form.beschreibung.trim(),
    freigegeben: form.freigegeben
  }
  try {
    if (materialID.value) {
      await api.request(
        `/portal/material/verwaltung/material/${materialID.value}`,
        { method: 'PATCH', body, quiet: true }
      )
      notifyInfo(`„${body.name}“ gespeichert.`)
      offen.value = false
      emit('gespeichert', materialID.value)
    } else {
      const res = await api.post<{ materialID: number }>(
        '/portal/material/verwaltung/material',
        body,
        { quiet: true }
      )
      materialID.value = res.materialID
      notifyInfo(
        `„${body.name}“ angelegt. Du kannst jetzt ein Foto hinzufügen.`
      )
      emit('gespeichert', res.materialID)
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

async function dateiGewaehlt(e: Event) {
  const input = e.target as HTMLInputElement
  const datei = input.files?.[0]
  if (!datei || !materialID.value) {
    input.value = ''
    return
  }
  laedtFoto.value = true
  try {
    // Erst lesen, dann das Input leeren (unten im finally): Chromium gibt den
    // Dateiinhalt sonst frei, bevor er dekodiert ist -- "Bild lässt sich
    // nicht lesen", obwohl die Datei in Ordnung war.
    const { foto, vorschau } = await materialFotoAufbereiten(datei)
    await api.request(
      `/portal/material/verwaltung/material/${materialID.value}/foto`,
      {
        method: 'PUT',
        body: {
          mimetype: foto.mimetype,
          inhalt: foto.base64,
          vorschau: vorschau.base64
        },
        quiet: true
      }
    )
    hatFoto.value = true
    fotoStand.value = Math.floor(Date.now() / 1000)
    setze(materialID.value, `data:image/jpeg;base64,${vorschau.base64}`)
    notifyInfo('Foto gespeichert.')
    emit('gespeichert', materialID.value)
  } catch (err: any) {
    error({
      text: err.message || String(err),
      title: 'Foto konnte nicht gespeichert werden'
    })
  } finally {
    // Gleiche Datei noch einmal wählen soll wieder ein change-Event auslösen.
    input.value = ''
    laedtFoto.value = false
  }
}

async function fotoEntfernen() {
  if (!materialID.value) return
  if (
    !window.confirm(
      'Foto entfernen?\n\nIm Katalog erscheint dann ein Platzhalter.'
    )
  )
    return
  laedtFoto.value = true
  try {
    await api.request(
      `/portal/material/verwaltung/material/${materialID.value}/foto`,
      { method: 'DELETE', quiet: true }
    )
    hatFoto.value = false
    fotoStand.value = null
    setze(materialID.value, null)
    notifyInfo('Foto entfernt.')
    emit('gespeichert', materialID.value)
  } catch (err: any) {
    error({
      text: err.message || String(err),
      title: 'Entfernen fehlgeschlagen'
    })
  } finally {
    laedtFoto.value = false
  }
}

defineExpose({ show })
</script>
