<template lang="pug">
div
  v-progress-linear(v-if='laedtGerade', indeterminate, color='primary')

  v-alert(v-if='abgewiesen', type='info', variant='tonal') {{ abgewiesen }}

  v-alert.mb-4(v-if='antraege && !antraege.length', type='info', variant='tonal')
    | Du hast noch keinen Antrag gestellt. Im
    |
    a(href='#/material/katalog') Katalog
    |  kannst du Material auswählen.

  v-list(v-if='antraege && antraege.length', lines='three', border, rounded)
    v-list-item(
      v-for='a in antraege',
      :key='a.materialAntragID',
      @click='navigate({ path: `/material/antrag/${a.materialAntragID}` })'
    )
      template(#prepend)
        v-icon {{ icon(a.status) }}
      v-list-item-title
        | {{ a.anlass }}
        v-chip.ml-2(size='x-small', :color='STATUS_FARBE[a.status]', variant='flat') {{ STATUS_TEXT[a.status] }}
      v-list-item-subtitle
        div {{ zeitraum(a) }} · {{ a.positionen.length }} {{ a.positionen.length === 1 ? 'Position' : 'Positionen' }}
        div.text-truncate {{ a.positionen.map((p) => `${p.mengeGenehmigt ?? p.menge}× ${p.name}`).join(', ') }}
        div(v-if='a.status === "genehmigt" && packlisteText(a)') {{ packlisteText(a) }}
      template(#append)
        v-icon chevron_right
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '../../../../plugins/api'
import { useRouter } from '../../../../plugins/router'
import {
  STATUS_FARBE,
  STATUS_TEXT,
  type Antrag,
  type AntragStatus
} from '../../../../util/material.types'

/**
 * Eigene Ausleih-Anträge, neueste zuerst. Der Server filtert auf die
 * angemeldete Person; ein Antrag ist auch dann noch hier, wenn die Freizeit
 * längst aus dem Zuständigkeitsfenster gefallen ist.
 */
const api = useApi()
const { navigate } = useRouter()

const antraege = ref<Antrag[] | null>(null)
const laedtGerade = ref(false)
const abgewiesen = ref('')

const ICONS: Record<AntragStatus, string> = {
  offen: 'hourglass_empty',
  genehmigt: 'check_circle',
  abgelehnt: 'cancel',
  abgeschlossen: 'task_alt',
  storniert: 'remove_circle_outline'
}
const icon = (s: AntragStatus) => ICONS[s]

function zeitraum(a: Antrag) {
  const von = a.vonObj?.german ?? a.von
  const bis = a.bisObj?.german ?? a.bis
  return von === bis ? von : `${von} – ${bis}`
}

/** Kurzer Packlisten-Stand: was ist eingeladen, was zurück. */
function packlisteText(a: Antrag) {
  const aktiv = a.positionen.filter((p) => (p.mengeGenehmigt ?? 0) > 0)
  if (!aktiv.length) return ''
  const zurueck = aktiv.filter((p) => p.zurueck).length
  const eingeladen = aktiv.filter((p) => p.eingeladen).length
  if (zurueck === aktiv.length) return 'Alles zurückgebracht'
  if (eingeladen === 0 && zurueck === 0)
    return 'Packliste: noch nichts abgehakt'
  return `Packliste: ${eingeladen} von ${aktiv.length} eingeladen, ${zurueck} zurück`
}

async function laden() {
  laedtGerade.value = true
  abgewiesen.value = ''
  try {
    const res = await api.get<{ antraege: Antrag[] } | Antrag[]>(
      '/portal/material/antraege',
      { quiet: true }
    )
    antraege.value = Array.isArray(res) ? res : res.antraege
  } catch (err: any) {
    antraege.value = null
    abgewiesen.value =
      err?.status === 503
        ? 'Die Materialausleihe ist noch nicht eingerichtet.'
        : err?.message || 'Die Anträge konnten nicht geladen werden.'
  } finally {
    laedtGerade.value = false
  }
}

laden()
</script>
