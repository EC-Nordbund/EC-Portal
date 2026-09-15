<template lang="pug">
div
  .d-flex.align-center.flex-wrap.ga-2.mb-2
    v-text-field(
      v-model='von',
      label='Von',
      type='date',
      density='compact',
      variant='outlined',
      hide-details,
      style='max-width: 170px'
    )
    v-text-field(
      v-model='bis',
      label='Bis',
      type='date',
      density='compact',
      variant='outlined',
      hide-details,
      :min='von',
      style='max-width: 170px'
    )
    v-btn-toggle(density='compact', variant='outlined', divided)
      v-btn(size='small', @click='schnell(30)') +30 Tage
      v-btn(size='small', @click='schnell(90)') +90 Tage
      v-btn(size='small', @click='schnell(180)') +180 Tage
    v-checkbox(
      v-model='nurBelegte',
      label='Nur belegtes Material',
      density='compact',
      hide-details
    )
    v-spacer
    ec-search(label='Material oder Anlass', @suche='suche = $event')
    v-btn(variant='text', size='small', prepend-icon='download', :disabled='!gefiltert.length', @click='csv') CSV

  v-progress-linear(v-if='laedt', indeterminate, color='primary')

  v-alert.mb-4(v-if='abgewiesen', type='warning', variant='tonal') {{ abgewiesen }}

  template(v-else-if='daten')
    .text-caption.text-medium-emphasis.mb-3
      | Zeitraum {{ anzeige(daten.zeitraum.von) }} – {{ anzeige(daten.zeitraum.bis) }}
      | · {{ zaehler }}
      | · Balken: <span :style='farbe("genehmigt")'>■</span> genehmigt, <span :style='farbe("offen")'>■</span> angefragt

    v-alert.mb-4(v-if='!gefiltert.length', type='info', variant='tonal')
      span(v-if='nurBelegte') Im Zeitraum ist nichts reserviert oder angefragt.
      span(v-else) Kein Material gefunden.

    v-list(v-else, lines='two', border, rounded)
      template(v-for='(m, i) in gefiltert', :key='m.materialID')
        v-divider(v-if='i > 0')
        v-list-item
          template(#prepend)
            ec-material-foto(:material-i-d='m.materialID', :name='m.name', :size='40', :hat-foto='m.hatFoto')
          v-list-item-title
            | {{ m.name }}
            span.text-caption.text-medium-emphasis.ml-2(v-if='m.kategorie') {{ m.kategorie }}
            v-chip.ml-2(v-if='!m.aktiv', size='x-small', variant='outlined') archiviert
            v-chip.ml-2(v-else-if='!m.freigegeben', size='x-small', variant='outlined') nicht freigegeben
            v-chip.ml-2(v-if='m.ueberbucht', size='x-small', color='error', variant='flat') überbucht
          v-list-item-subtitle
            | Bestand {{ m.bestand }}
            span(v-if='m.reservierungen.length')  · Spitze {{ m.maxBelegt }} gleichzeitig genehmigt
            span(v-else)  · nichts reserviert
          //- Zeitleiste: je Reservierung ein Balken, Lage und Breite in
          //- Prozent des Fensters. Reine Darstellung -- die Liste darunter ist
          //- die Wahrheit und auf dem Handy allein schon lesbar.
          .belegung-leiste.mt-2(v-if='m.reservierungen.length')
            .belegung-balken(
              v-for='r in m.reservierungen',
              :key='r.materialAntragID',
              :style='balken(r)',
              :title='`${r.anlass}: ${r.vonObj.german} – ${r.bisObj.german}, ${r.menge} Stk. (${STATUS_TEXT[r.status]})`',
              @click='navigate({ path: `/materialwart/antrag/${r.materialAntragID}` })'
            )
          v-table.mt-1(v-if='m.reservierungen.length', density='compact')
            tbody
              tr(
                v-for='r in m.reservierungen',
                :key='r.materialAntragID',
                style='cursor: pointer',
                @click='navigate({ path: `/materialwart/antrag/${r.materialAntragID}` })'
              )
                td.text-no-wrap {{ r.vonObj.german }} – {{ r.bisObj.german }}
                td.text-right {{ r.menge }} Stk.
                td {{ r.anlass }}
                td.text-caption {{ r.antragsteller }}
                td
                  v-chip(size='x-small', variant='tonal', :color='STATUS_FARBE[r.status]') {{ STATUS_TEXT[r.status] }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useApi } from '../../../../plugins/api'
import { useRouter } from '../../../../plugins/router'
import filterGenerator from '../../../../util/filter.util'
import { csvExport } from '../../../../util/csv.util'
import { useMaterialFotos } from '../../../../util/materialFoto.util'
import {
  STATUS_FARBE,
  STATUS_TEXT,
  type AntragStatus,
  type BelegungMaterial,
  type Reservierung
} from '../../../../util/material.types'

/**
 * Belegungsplan: welches Material ist wann wohin reserviert.
 *
 * Bewusst eine Liste je Material mit Balkenleiste statt einer Matrix
 * Material × Tage: die Matrix wäre auf dem Handy unlesbar, und der
 * Materialwart braucht vor allem die Antwort „ist das im Zeitraum frei, und
 * wenn nicht, wer hat es“ -- das steht in der Zeile.
 */
interface Antwort {
  zeitraum: { von: string; bis: string }
  material: BelegungMaterial[]
}

const api = useApi()
const { navigate } = useRouter()

function iso(d: Date) {
  const j = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${j}-${m}-${t}`
}

function plusTage(tage: number, ab = new Date()) {
  const d = new Date(ab)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + tage)
  return iso(d)
}

const von = ref(plusTage(0))
const bis = ref(plusTage(90))
const nurBelegte = ref(true)
const suche = ref('')
const daten = ref<Antwort | null>(null)
const laedt = ref(false)
const abgewiesen = ref('')

function schnell(tage: number) {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(von.value)
    ? new Date(von.value)
    : new Date()
  bis.value = plusTage(tage, start)
}

function anzeige(isoDatum: string) {
  const [j, m, t] = isoDatum.split('-')
  return j && m && t ? `${t}.${m}.${j}` : isoDatum
}

const gefiltert = computed(() =>
  (daten.value?.material ?? [])
    .filter((m) => !nurBelegte.value || m.reservierungen.length > 0)
    .filter(filterGenerator(suche.value))
)

/**
 * Eine Zeile je Reservierung; Material ohne Reservierung im Fenster bekommt
 * eine Zeile mit leeren Reservierungsfeldern, damit die Liste vollständig ist.
 */
function csv() {
  const zeilen: unknown[][] = []
  for (const m of gefiltert.value) {
    const basis = [
      m.name,
      m.kategorie ?? '',
      m.bestand,
      m.maxBelegt,
      m.ueberbucht ? 'ja' : 'nein'
    ]
    if (!m.reservierungen.length) {
      zeilen.push([...basis, '', '', '', '', '', '', ''])
      continue
    }
    for (const r of m.reservierungen) {
      zeilen.push([
        ...basis,
        r.materialAntragID,
        STATUS_TEXT[r.status],
        r.vonObj?.german ?? r.von,
        r.bisObj?.german ?? r.bis,
        r.menge,
        r.anlass,
        r.antragsteller
      ])
    }
  }
  const z = daten.value?.zeitraum
  csvExport(
    `Belegung-${z?.von ?? von.value}-bis-${z?.bis ?? bis.value}`,
    [
      'Material',
      'Kategorie',
      'Bestand',
      'Max. belegt',
      'Überbucht',
      'Antrag Nr',
      'Status',
      'Von',
      'Bis',
      'Menge',
      'Anlass',
      'Antragsteller/in'
    ],
    zeilen
  )
}

const zaehler = computed(() => {
  const alle = daten.value?.material ?? []
  const belegt = alle.filter((m) => m.reservierungen.length > 0).length
  const ueber = alle.filter((m) => m.ueberbucht).length
  return `${belegt} von ${alle.length} Materialien belegt${ueber ? ` · ${ueber} überbucht` : ''}`
})

/** Tage seit Fensterbeginn, als Kalenderdifferenz ohne Uhrzeit (UTC-Trick). */
function tagIndex(isoDatum: string) {
  const [j, m, t] = isoDatum.split('-').map(Number)
  const [fj, fm, ft] = (daten.value?.zeitraum.von ?? von.value)
    .split('-')
    .map(Number)
  return Math.round(
    (Date.UTC(j, m - 1, t) - Date.UTC(fj, fm - 1, ft)) / 86400000
  )
}

const fensterTage = computed(() =>
  daten.value ? tagIndex(daten.value.zeitraum.bis) + 1 : 1
)

const FARBEN: Record<AntragStatus, string> = {
  genehmigt: '#8FB217',
  offen: '#F9A825',
  abgelehnt: '#9E9E9E',
  abgeschlossen: '#9E9E9E',
  storniert: '#9E9E9E'
}

function farbe(status: AntragStatus) {
  return { color: FARBEN[status] }
}

function balken(r: Reservierung) {
  const n = fensterTage.value
  // Innerhalb des Fensters abschneiden: eine Reservierung kann vor dem
  // Fenster beginnen oder danach enden.
  const start = Math.max(0, tagIndex(r.von))
  const ende = Math.min(n - 1, tagIndex(r.bis))
  const left = (start / n) * 100
  const width = ((ende - start + 1) / n) * 100
  return {
    left: `${left}%`,
    width: `${Math.max(width, 0.5)}%`,
    background: FARBEN[r.status]
  }
}

async function laden() {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(von.value) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(bis.value)
  )
    return
  if (bis.value < von.value) return
  // Grenze der API (MAX_ZEITRAUM_TAGE) schon hier prüfen: ein Tippfehler im
  // Jahr soll einen Hinweis geben, keinen Fehler vom Server.
  const [vj, vm, vt] = von.value.split('-').map(Number)
  const [bj, bm, bt] = bis.value.split('-').map(Number)
  const tage = Math.round(
    (Date.UTC(bj, bm - 1, bt) - Date.UTC(vj, vm - 1, vt)) / 86400000
  )
  if (tage > 366) {
    abgewiesen.value =
      'Ein Zeitraum darf höchstens 366 Tage umfassen – bitte das Datum prüfen.'
    return
  }
  laedt.value = true
  abgewiesen.value = ''
  try {
    daten.value = await api.get<Antwort>(
      `/portal/material/verwaltung/belegung?von=${von.value}&bis=${bis.value}`,
      { quiet: true }
    )
  } catch (err: any) {
    daten.value = null
    abgewiesen.value =
      err?.status === 403
        ? err.message
        : err?.message || 'Die Belegung konnte nicht geladen werden.'
  } finally {
    laedt.value = false
  }
}

watch([von, bis], laden, { immediate: true })
// Vorschauen kommen aus dem Sitzungs-Cache; wer per Mail-Link direkt hier
// landet, hat ihn noch nicht gefüllt.
useMaterialFotos().laden()
</script>

<style scoped>
.belegung-leiste {
  position: relative;
  height: 10px;
  border-radius: 5px;
  background: rgba(128, 128, 128, 0.15);
  overflow: hidden;
}
.belegung-balken {
  position: absolute;
  top: 0;
  height: 100%;
  cursor: pointer;
  opacity: 0.85;
}
.belegung-balken:hover {
  opacity: 1;
}
</style>
