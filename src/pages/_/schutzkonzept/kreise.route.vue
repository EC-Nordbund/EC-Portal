<template lang="pug">
ec-wrapper(
  title='Schutzkonzepte',
  :subTitle='untertitel',
  hasReload,
  @reload='laden'
)
  .d-flex.align-center.flex-wrap.ga-4.mb-4
    ec-search(label='EC-Kreis suchen', @suche='suche = $event')
    v-spacer
    span.text-caption(v-if='daten') {{ zaehler }}

  v-progress-linear(v-if='laedt', indeterminate, color='primary')

  v-alert.mb-4(v-if='daten && !daten.aktuelleFormularVersion', type='warning', variant='tonal')
    | Es ist noch keine Formularversion veröffentlicht – die EC-Kreise können
    | noch nichts ausfüllen.

  v-table(v-if='gefiltert.length', density='compact', hover)
    thead
      tr
        th EC-Kreis
        th E-Mails
        th Veröffentlicht
        th In Bearbeitung
        th
    tbody
      tr(
        v-for='k in gefiltert',
        :key='k.ecKreisID',
        style='cursor: pointer',
        @click='navigate({ path: `/schutzkonzept/kreis/${k.ecKreisID}` })'
      )
        td {{ k.bezeichnung }}
        td
          span(v-if='k.anzahlEmails') {{ k.anzahlEmails }}
          v-chip(
            v-else,
            size='x-small',
            color='orange',
            variant='flat',
            title='In der Verwaltung unter EC-Kreise eine Schutzkonzept-E-Mail eintragen'
          ) keine Schutzkonzept-E-Mail – in der Verwaltung pflegen
        td
          template(v-if='k.veroeffentlicht')
            div
              | Stand {{ k.veroeffentlicht.versionNr }} · {{ datum(k.veroeffentlicht.publishedAm) }}
              v-chip.ml-2(
                v-if='k.veraltet',
                size='x-small',
                color='orange',
                variant='tonal',
                :title='`Auf Formularversion ${k.veroeffentlicht.formularVersionNr}, aktuell ist ${daten.aktuelleFormularVersion?.versionNr}`'
              ) veraltet
            .text-caption.text-medium-emphasis
              | {{ k.veroeffentlicht.publishedVon }} · Formular v{{ k.veroeffentlicht.formularVersionNr }}
          span.text-medium-emphasis(v-else) —
        td(style='min-width: 180px')
          template(v-if='k.draft')
            .d-flex.align-center.ga-2
              v-progress-linear(:model-value='k.draft.fortschritt', color='primary', height='8', rounded)
              span.text-caption.text-no-wrap {{ k.draft.fortschritt }} %
            .text-caption.text-medium-emphasis {{ datumZeit(k.draft.geaendert) }} · {{ k.draft.geaendertVon }}
          span.text-medium-emphasis(v-else) —
        td.text-right
          v-icon chevron_right

  v-alert(v-else-if='daten', type='info', variant='tonal') Kein EC-Kreis gefunden.
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useApi } from '../../../plugins/api'
import { useRouter } from '../../../plugins/router'
import filterGenerator from '../../../util/filter.util'
import { datum, datumZeit } from '../../../schutzkonzept/format'

/**
 * Stand der Schutzkonzepte aller EC-Kreise.
 *
 * „Veraltet“ heißt: der letzte veröffentlichte Stand hängt an einer älteren
 * Formularversion. Die Angaben sind nicht verloren -- beim nächsten
 * Bearbeiten werden sie auf die neue Version übernommen.
 */
interface StandKurz {
  standID: number
  versionNr: number
  formularVersionNr: number
  fortschritt: number
  geaendert: string
  geaendertVon: string
  publishedAm: string | null
  publishedVon: string | null
}

interface KreiseAntwort {
  aktuelleFormularVersion: {
    formularVersionID: number
    versionNr: number
  } | null
  kreise: Array<{
    ecKreisID: number
    bezeichnung: string
    anzahlEmails: number
    draft: StandKurz | null
    veroeffentlicht: StandKurz | null
    veraltet: boolean
  }>
}

const api = useApi()
const { navigate } = useRouter()

const daten = ref<KreiseAntwort | null>(null)
const laedt = ref(false)
const suche = ref('')

const gefiltert = computed(() =>
  (daten.value?.kreise ?? []).filter(filterGenerator(suche.value))
)

const untertitel = computed(() =>
  daten.value?.aktuelleFormularVersion
    ? `Aktuelle Formularversion ${daten.value.aktuelleFormularVersion.versionNr}`
    : ''
)

const zaehler = computed(() => {
  const k = daten.value?.kreise ?? []
  const fertig = k.filter((x) => x.veroeffentlicht && !x.veraltet).length
  return `${k.length} Kreise · ${fertig} aktuell veröffentlicht`
})

async function laden() {
  laedt.value = true
  try {
    daten.value = await api.get<KreiseAntwort>('/portal/schutzkonzept/kreise')
  } finally {
    laedt.value = false
  }
}

onMounted(laden)
</script>
