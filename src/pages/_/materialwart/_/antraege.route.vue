<template lang="pug">
div
  .d-flex.align-center.flex-wrap.ga-4.mb-2
    ec-search(label='Antrag suchen', @suche='suche = $event')
    v-spacer
    span.text-caption(v-if='daten') {{ zaehler }}
    v-btn(variant='text', size='small', prepend-icon='download', :disabled='!gefiltert.length', @click='csv') CSV
    v-btn(icon, variant='text', size='small', :loading='laedt', title='Neu laden', @click='laden')
      v-icon replay

  v-chip-group.mb-2(v-model='filter', mandatory, selected-class='text-primary')
    v-chip(v-for='f in FILTER', :key='f.wert', :value='f.wert', size='small', filter) {{ f.label }}

  v-progress-linear(v-if='laedt', indeterminate, color='primary')

  v-alert.mb-4(v-if='abgewiesen', type='warning', variant='tonal') {{ abgewiesen }}

  v-alert.mb-4(v-else-if='daten && !gefiltert.length', type='info', variant='tonal')
    span(v-if='suche') Kein Antrag gefunden.
    span(v-else-if='filter === "aktiv"') Zurzeit gibt es keine offenen oder genehmigten Anträge.
    span(v-else) Keine Anträge mit diesem Status.

  v-list(v-if='gefiltert.length', lines='two', border, rounded)
    v-list-item(
      v-for='a in gefiltert',
      :key='a.materialAntragID',
      @click='navigate({ path: `/materialwart/antrag/${a.materialAntragID}` })'
    )
      template(#prepend)
        v-icon(:color='a.status === "offen" ? "#C62828" : undefined') {{ statusIcon(a.status) }}
      v-list-item-title
        | {{ a.anlass }}
        v-chip.ml-2(size='x-small', :color='STATUS_FARBE[a.status]', variant='tonal') {{ STATUS_TEXT[a.status] }}
        v-chip.ml-2(v-if='a.ueberfaellig', size='x-small', color='error', variant='flat') Rückgabe überfällig
      v-list-item-subtitle
        | {{ a.vonObj ? a.vonObj.german : a.von }} – {{ a.bisObj ? a.bisObj.german : a.bis }}
        | · {{ a.antragsteller.vorname }} {{ a.antragsteller.nachname }}
        | · {{ a.positionenAnzahl }} {{ a.positionenAnzahl === 1 ? 'Position' : 'Positionen' }}
      template(#append)
        v-icon chevron_right
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useApi } from '../../../../plugins/api'
import { useRouter } from '../../../../plugins/router'
import filterGenerator from '../../../../util/filter.util'
import { csvExport, heuteISO, jaNein } from '../../../../util/csv.util'
import {
  STATUS_FARBE,
  STATUS_TEXT,
  type AntragStatus,
  type AntragUebersicht
} from '../../../../util/material.types'

/**
 * Anträge aus Sicht des Materialwarts.
 *
 * Standardfilter „aktiv“ = offen + genehmigt: das ist die Arbeitsliste.
 * Abgelehnte, abgeschlossene und zurückgezogene Anträge sind Archiv und
 * werden nur auf Wunsch geladen. Der Filter ist ein Server-Parameter, kein
 * Client-Filter -- bei ein paar Jahren Historie soll nicht alles bei jedem
 * Aufruf mitkommen.
 */
const api = useApi()
const { navigate, stringQueryRef } = useRouter()

const FILTER = [
  { wert: 'aktiv', label: 'Offen und genehmigt' },
  { wert: 'offen', label: 'Offen' },
  { wert: 'genehmigt', label: 'Genehmigt' },
  { wert: 'abgelehnt', label: 'Abgelehnt' },
  { wert: 'abgeschlossen', label: 'Abgeschlossen' },
  { wert: 'storniert', label: 'Zurückgezogen' },
  { wert: 'alle', label: 'Alle' }
]

// In der URL, damit „zurück“ vom Antrag denselben Filter zeigt.
const filterQuery = stringQueryRef('status')
const filter = computed({
  get: () => filterQuery.value || 'aktiv',
  set: (v: string) => {
    filterQuery.value = v === 'aktiv' ? '' : v
  }
})
const suche = ref('')
const daten = ref<AntragUebersicht[] | null>(null)
const laedt = ref(false)
const abgewiesen = ref('')

const gefiltert = computed(() =>
  (daten.value ?? []).filter(filterGenerator(suche.value))
)

/**
 * Eine Zeile je Antrag; die Positionen stehen als Text in einer Spalte
 * („Kubb 2 (genehmigt 1); Pavillon 1“), damit die Liste in Excel eine Zeile
 * pro Antrag bleibt.
 */
function csv() {
  const positionenText = (a: AntragUebersicht) =>
    a.positionen
      .map((p) => {
        const gen =
          p.mengeGenehmigt === null || p.mengeGenehmigt === p.menge
            ? ''
            : ` (genehmigt ${p.mengeGenehmigt})`
        return `${p.name} ${p.menge}${gen}`
      })
      .join('; ')
  csvExport(
    `Materialantraege-${heuteISO()}`,
    [
      'Nr',
      'Status',
      'Von',
      'Bis',
      'Anlass',
      'EC-Kreis',
      'Antragsteller/in',
      'E-Mail',
      'Positionen',
      'Anzahl Positionen',
      'Rückgabe überfällig',
      'Kommentar',
      'Antwort',
      'Gestellt am'
    ],
    gefiltert.value.map((a) => [
      a.materialAntragID,
      STATUS_TEXT[a.status],
      a.vonObj?.german ?? a.von,
      a.bisObj?.german ?? a.bis,
      a.anlass,
      a.kreis ?? '',
      `${a.antragsteller.vorname} ${a.antragsteller.nachname}`,
      a.antragsteller.email,
      positionenText(a),
      a.positionenAnzahl,
      jaNein(a.ueberfaellig),
      a.kommentar,
      a.antwort,
      new Date(a.erstellt).toLocaleString('de-DE')
    ])
  )
}

const zaehler = computed(() => {
  const alle = daten.value ?? []
  const offen = alle.filter((a) => a.status === 'offen').length
  return offen
    ? `${alle.length} Anträge · ${offen} offen`
    : `${alle.length} Anträge`
})

function statusIcon(s: AntragStatus) {
  return (
    {
      offen: 'hourglass_top',
      genehmigt: 'check_circle',
      abgelehnt: 'cancel',
      abgeschlossen: 'task_alt',
      storniert: 'remove_circle_outline'
    } as Record<AntragStatus, string>
  )[s]
}

async function laden() {
  laedt.value = true
  abgewiesen.value = ''
  try {
    const res = await api.get<{ antraege: AntragUebersicht[] }>(
      `/portal/material/verwaltung/antraege?status=${encodeURIComponent(filter.value)}`,
      { quiet: true }
    )
    daten.value = res.antraege
  } catch (err: any) {
    daten.value = null
    abgewiesen.value =
      err?.status === 403
        ? err.message
        : 'Die Anträge konnten nicht geladen werden.'
  } finally {
    laedt.value = false
  }
}

watch(filter, laden, { immediate: true })
</script>
