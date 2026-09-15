<template lang="pug">
div
  .d-flex.align-center.flex-wrap.ga-2.mb-2
    ec-search(label='Vorlage suchen', @suche='suche = $event')
    v-spacer
    span.text-caption(v-if='daten') {{ zaehler }}
    v-btn(
      variant='flat',
      v-accent-bg,
      v-white,
      size='small',
      prepend-icon='add',
      :disabled='!daten',
      @click='formDialog?.show(null)'
    ) Vorlage

  v-progress-linear(v-if='laedt', indeterminate, color='primary')

  v-alert.mb-4(v-if='abgewiesen', type='warning', variant='tonal') {{ abgewiesen }}

  v-alert.mb-4(v-else-if='daten && !gefiltert.length', type='info', variant='tonal')
    span(v-if='suche') Keine Vorlage passt zur Suche.
    span(v-else)
      | Noch keine Vorlagen. Eine Vorlage ist eine fertige Materialliste
      | (z. B. „Teencamp-Grundliste“), die Freizeitleitungen im Katalog mit einem
      | Klick in ihre Auswahl übernehmen.

  v-list(v-if='gefiltert.length', lines='three', border, rounded)
    template(v-for='(v, i) in gefiltert', :key='v.materialVorlageID')
      v-divider(v-if='i > 0')
      v-list-item(@click='formDialog?.show(v)')
        template(#prepend)
          v-icon bookmark
        v-list-item-title
          | {{ v.name }}
          v-chip.ml-2(size='x-small', variant='outlined') {{ v.bereich === 'referenten' ? 'Speziell' : 'Allgemein' }}
          v-chip.ml-2(v-if='archivierte(v)', size='x-small', color='warning', variant='flat') enthält archiviertes Material
        v-list-item-subtitle
          div(v-if='v.beschreibung') {{ v.beschreibung }}
          div {{ v.positionen.length }} {{ v.positionen.length === 1 ? 'Position' : 'Positionen' }} · {{ stueck(v) }} Stück
          .text-caption.text-medium-emphasis {{ positionenText(v) }}
        template(#append)
          v-menu
            template(#activator='{ props: menuProps }')
              v-btn(v-bind='menuProps', icon, variant='text', size='small', @click.stop)
                v-icon more_vert
            v-list(density='compact')
              v-list-item(title='Bearbeiten', prepend-icon='edit', @click='formDialog?.show(v)')
              v-list-item(title='Löschen', prepend-icon='delete', @click='loeschen(v)')

  material-vorlage-form(ref='formDialog', @gespeichert='laden')
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import materialVorlageForm from '../../../../lib/materialVorlageForm.lib.vue'
import { useApi } from '../../../../plugins/api'
import { useDialog } from '../../../../plugins/dialog'
import filterGenerator from '../../../../util/filter.util'
import { useMaterialFotos } from '../../../../util/materialFoto.util'
import type { VorlageVerwaltung } from '../../../../util/material.types'

/**
 * Vorlagen pflegen: fertige Materiallisten für wiederkehrende Freizeiten.
 *
 * Nur Materialwarte pflegen sie; wer sie sieht, entscheidet der Bereich
 * („Allgemein“ jeder, „Speziell“ nur Freizeitleitung und Materialwarte).
 * Archiviertes Material bleibt in der Vorlage stehen und wird beim Laden im
 * Katalog übersprungen -- hier wird es markiert, damit die Liste gepflegt
 * werden kann.
 */
const api = useApi()
const { error, notifyInfo } = useDialog()
const fotos = useMaterialFotos()
const formDialog =
  useTemplateRef<InstanceType<typeof materialVorlageForm>>('formDialog')

const suche = ref('')
const daten = ref<VorlageVerwaltung[] | null>(null)
const laedt = ref(false)
const abgewiesen = ref('')

const gefiltert = computed(() =>
  (daten.value ?? []).filter((v) =>
    filterGenerator(suche.value)({
      name: v.name,
      beschreibung: v.beschreibung,
      positionen: v.positionen.map((p) => p.name).join(' ')
    })
  )
)

const zaehler = computed(() => {
  const n = daten.value?.length ?? 0
  return `${n} ${n === 1 ? 'Vorlage' : 'Vorlagen'}`
})

const stueck = (v: VorlageVerwaltung) =>
  v.positionen.reduce((s, p) => s + p.menge, 0)

const archivierte = (v: VorlageVerwaltung) => v.positionen.some((p) => !p.aktiv)

function positionenText(v: VorlageVerwaltung) {
  const teile = v.positionen.slice(0, 6).map((p) => `${p.menge}× ${p.name}`)
  if (v.positionen.length > 6) teile.push('…')
  return teile.join(', ')
}

async function laden() {
  laedt.value = true
  abgewiesen.value = ''
  try {
    const res = await api.get<{ vorlagen: VorlageVerwaltung[] }>(
      '/portal/material/verwaltung/vorlage',
      { quiet: true }
    )
    daten.value = res.vorlagen
    fotos.laden()
  } catch (err: any) {
    daten.value = null
    abgewiesen.value =
      err?.status === 403
        ? err.message
        : 'Die Vorlagen konnten nicht geladen werden.'
  } finally {
    laedt.value = false
  }
}

onMounted(laden)

function loeschen(v: VorlageVerwaltung) {
  if (
    !window.confirm(
      `Vorlage „${v.name}“ löschen?\n\nSie verschwindet aus dem Katalog-Menü. Bestehende Anträge sind nicht betroffen; das Löschen lässt sich nicht rückgängig machen.`
    )
  ) {
    return
  }
  api
    .request(`/portal/material/verwaltung/vorlage/${v.materialVorlageID}`, {
      method: 'DELETE',
      quiet: true
    })
    .then(() => {
      notifyInfo(`Vorlage „${v.name}“ gelöscht.`)
      laden()
    })
    .catch((err: any) =>
      error({
        text: err.message || String(err),
        title: 'Löschen fehlgeschlagen'
      })
    )
}
</script>
