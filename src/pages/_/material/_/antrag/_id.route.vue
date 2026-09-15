<template lang="pug">
div
  v-progress-linear(v-if='laedtGerade', indeterminate, color='primary')

  v-alert(v-if='abgewiesen', type='info', variant='tonal') {{ abgewiesen }}

  template(v-if='antrag')
    .d-flex.align-center.flex-wrap.ga-2.mb-2
      v-btn(variant='text', size='small', prepend-icon='arrow_back', to='/material/antraege') Meine Anträge
      v-spacer
      v-chip(:color='STATUS_FARBE[antrag.status]', variant='flat') {{ STATUS_TEXT[antrag.status] }}

    h2.text-h6(v-font, v-primary) {{ antrag.anlass }}
    .text-body-2.mb-3
      div
        v-icon.mr-1(size='small') event
        | {{ zeitraum }}
      div(v-if='antrag.kreis')
        v-icon.mr-1(size='small') place
        | {{ antrag.kreis }}
      div(v-if='!antrag.eigener && antrag.antragsteller')
        v-icon.mr-1(size='small') person
        | {{ antrag.antragsteller.vorname }} {{ antrag.antragsteller.nachname }}
      div.text-caption Gestellt am {{ datum(antrag.erstellt) }}

    v-alert.mb-3(v-if='antrag.kommentar', variant='tonal', density='compact', icon='chat_bubble_outline')
      .text-caption Dein Kommentar
      div(style='white-space: pre-line') {{ antrag.kommentar }}

    v-alert.mb-3(
      v-if='antrag.antwort',
      :type='antrag.status === "abgelehnt" ? "warning" : "info"',
      variant='tonal',
      icon='forum'
    )
      .text-caption Antwort der Materialverwaltung
      div(style='white-space: pre-line') {{ antrag.antwort }}

    v-alert.mb-3(v-if='antrag.status === "offen"', type='info', variant='tonal', density='compact')
      | Der Antrag wartet auf die Materialverwaltung. Du bekommst eine E-Mail,
      | sobald er bearbeitet ist.
    v-alert.mb-3(v-else-if='antrag.status === "genehmigt"', type='success', variant='tonal', density='compact')
      | Genehmigt. Hake beim Packen ab, was eingeladen ist, und nach der
      | Freizeit, was zurück im Lager liegt.
    v-alert.mb-3(v-else-if='antrag.status === "abgeschlossen"', type='info', variant='tonal', density='compact')
      | Abgeschlossen – die Rückgabe ist geprüft.

    v-table(density='compact')
      thead
        tr
          th Material
          th.text-right Beantragt
          th.text-right(v-if='entschieden') Genehmigt
          template(v-if='packliste')
            th.text-center Eingeladen
            th.text-center Zurück
      tbody
        tr(
          v-for='p in antrag.positionen',
          :key='p.materialAntragPositionID',
          :class='{ "text-disabled": gestrichen(p) }'
        )
          td
            .d-flex.align-center.ga-2
              ec-material-foto(
                :material-i-d='p.materialID',
                :name='p.name',
                :hat-foto='p.hatFoto',
                :size='36'
              )
              div
                div(:style='gestrichen(p) ? "text-decoration: line-through" : ""') {{ p.name }}
                .text-caption(v-if='p.lagerort') Lagerort: {{ p.lagerort }}
          td.text-right {{ p.menge }}
          td.text-right(v-if='entschieden')
            span(v-if='gestrichen(p)') gestrichen
            strong(v-else, :class='{ "text-warning": (p.mengeGenehmigt ?? p.menge) < p.menge }') {{ p.mengeGenehmigt ?? p.menge }}
          template(v-if='packliste')
            td.text-center
              v-checkbox-btn(
                v-if='!gestrichen(p)',
                :model-value='p.eingeladen',
                :disabled='speichert.has(p.materialAntragPositionID)',
                @update:model-value='(v) => haken(p, "eingeladen", v)'
              )
            td.text-center
              v-checkbox-btn(
                v-if='!gestrichen(p)',
                :model-value='p.zurueck',
                :disabled='speichert.has(p.materialAntragPositionID)',
                @update:model-value='(v) => haken(p, "zurueck", v)'
              )

    .d-flex.justify-end.mt-4(v-if='antrag.status === "offen" && antrag.eigener')
      v-btn(variant='outlined', color='error', prepend-icon='undo', :loading='storniert', @click='zurueckziehen') Antrag zurückziehen
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useApi } from '../../../../../plugins/api'
import { useDialog } from '../../../../../plugins/dialog'
import { useRouter } from '../../../../../plugins/router'
import { useMaterialFotos } from '../../../../../util/materialFoto.util'
import {
  STATUS_FARBE,
  STATUS_TEXT,
  type AntragDetail,
  type AntragPosition
} from '../../../../../util/material.types'

/**
 * Ein Antrag aus Sicht der Antragstellerin -- und nach der Genehmigung die
 * Packliste. Die Haken gehen sofort an die API (optimistisch, mit Rollback
 * wie in der Mitgliederliste); wer am Lager steht, soll nicht auf einen
 * Speichern-Knopf warten.
 *
 * 404 kommt auch für fremde Anträge: die API unterscheidet nicht zwischen
 * „gibt es nicht“ und „gehört dir nicht“.
 */
const api = useApi()
const { route } = useRouter()
const { error, notifyInfo } = useDialog()
const fotos = useMaterialFotos()

const id = computed(() => parseInt(route.value.params.id as string, 10))
const antrag = ref<AntragDetail | null>(null)
const laedtGerade = ref(false)
const abgewiesen = ref('')
const storniert = ref(false)
const speichert = ref(new Set<number>())

const entschieden = computed(
  () => !!antrag.value && !['offen', 'storniert'].includes(antrag.value.status)
)
const packliste = computed(() => antrag.value?.status === 'genehmigt')

const zeitraum = computed(() => {
  const a = antrag.value
  if (!a) return ''
  const von = a.vonObj?.german ?? a.von
  const bis = a.bisObj?.german ?? a.bis
  return von === bis ? von : `${von} – ${bis}`
})

function gestrichen(p: AntragPosition) {
  return entschieden.value && (p.mengeGenehmigt ?? p.menge) === 0
}

function datum(iso: string) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE')
}

async function laden() {
  laedtGerade.value = true
  abgewiesen.value = ''
  try {
    const res = await api.get<{ antrag: AntragDetail } | AntragDetail>(
      `/portal/material/antrag/${id.value}`,
      { quiet: true }
    )
    antrag.value = 'antrag' in res ? res.antrag : res
  } catch (err: any) {
    antrag.value = null
    abgewiesen.value =
      err?.status === 404
        ? 'Diesen Antrag gibt es nicht, oder er gehört nicht zu dir.'
        : err?.status === 403
          ? err.message
          : 'Der Antrag konnte nicht geladen werden.'
  } finally {
    laedtGerade.value = false
  }
}

watch(id, laden, { immediate: true })
fotos.laden()

function haken(
  p: AntragPosition,
  feld: 'eingeladen' | 'zurueck',
  wert: boolean
) {
  if (!antrag.value || p[feld] === wert) return
  const vorher = p[feld]
  p[feld] = wert
  speichert.value.add(p.materialAntragPositionID)
  api
    .request(
      `/portal/material/antrag/${antrag.value.materialAntragID}/position/${p.materialAntragPositionID}`,
      { method: 'PATCH', body: { [feld]: wert }, quiet: true }
    )
    .then(() => {
      if (feld === 'zurueck' && wert && alleZurueck()) {
        notifyInfo('Alles zurück – die Materialverwaltung ist informiert.')
      }
    })
    .catch((err: any) => {
      p[feld] = vorher
      error({
        text: err.message || String(err),
        title: 'Speichern fehlgeschlagen'
      })
    })
    .finally(() => {
      speichert.value.delete(p.materialAntragPositionID)
    })
}

function alleZurueck() {
  const aktiv = (antrag.value?.positionen ?? []).filter((p) => !gestrichen(p))
  return aktiv.length > 0 && aktiv.every((p) => p.zurueck)
}

function zurueckziehen() {
  if (!antrag.value) return
  if (
    !window.confirm(
      'Antrag wirklich zurückziehen?\n\nDie Materialverwaltung wird informiert, das Material bleibt für andere frei. Ein neuer Antrag ist jederzeit möglich.'
    )
  ) {
    return
  }
  storniert.value = true
  api
    .post(
      `/portal/material/antrag/${antrag.value.materialAntragID}/storno`,
      undefined,
      {
        quiet: true
      }
    )
    .then(() => {
      notifyInfo('Antrag zurückgezogen.')
      laden()
    })
    .catch((err: any) =>
      error({
        text: err.message || String(err),
        title: 'Zurückziehen fehlgeschlagen'
      })
    )
    .finally(() => {
      storniert.value = false
    })
}
</script>
