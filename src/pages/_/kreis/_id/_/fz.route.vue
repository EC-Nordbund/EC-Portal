<template lang="pug">
div
  .d-flex.align-center.flex-wrap.ga-4.mb-4
      ec-search(label='Person suchen', @suche='suche = $event')
      v-btn-toggle(v-model='ansicht', density='compact', mandatory, variant='outlined')
        v-btn(value='ampel', size='small') Relevante
        v-btn(value='alle', size='small') Alle Mitarbeitenden
      v-spacer
      v-btn(
        variant='flat',
        v-accent-bg,
        v-white,
        size='small',
        prepend-icon='person_add',
        :disabled='!daten',
        @click='neuDialog.show()'
      ) Mitarbeiter/in
      v-btn(
        variant='text',
        size='small',
        prepend-icon='qr_code_2',
        :loading='qrLaeuft',
        @click='qrBlatt'
      ) QR-Blatt
      v-btn(
        variant='text',
        size='small',
        prepend-icon='download',
        :disabled='!gefiltert.length',
        @click='csv'
      ) CSV

  v-progress-linear(v-if='laedtGerade', indeterminate, color='primary')

  v-alert.ma-4(
    v-if='daten && !gefiltert.length',
    type='info',
    variant='tonal'
  )
    span(v-if='suche') Keine Person gefunden.
    span(v-else-if='alle') In diesem EC-Kreis ist noch niemand als mitarbeitend eingetragen.
    span(v-else) Keine Personen in dieser Ansicht.

  v-table(v-if='gefiltert.length', density='compact', hover)
    thead
      tr
        th Status
        th Name
        th Geburtstag
        th FZ vom
        th Gültig bis
        th Anträge
        th Kontakt
        th
    tbody
      tr(v-for='p in gefiltert', :key='p.personID')
        td
          ec-ampel(:farbe='p.farbe')
        td
          | {{ p.vorname }} {{ p.nachname }}
          v-chip.ml-2(v-if='p.fzDeaktiviert', size='x-small', variant='outlined') ausgenommen
        td {{ p.gebDat ? p.gebDat.german : '—' }}
        td {{ p.fzVon ? p.fzVon.german : '—' }}
        td {{ p.gueltigBis ? p.gueltigBis.german : '—' }}
        td
          span(v-if='p.anzahlAntraege')
            | {{ p.anzahlAntraege }}
            span(v-if='p.letzterAntrag')  (zuletzt {{ p.letzterAntrag.german }})
          span(v-else) —
        td.text-caption
          div(v-if='p.email') {{ p.email }}
          div(v-if='p.telefon') {{ p.telefon }}
          span(v-if='!p.email && !p.telefon') —
        td.text-right.text-no-wrap
          v-btn(
            v-if='darfEintragen(p)',
            size='small',
            variant='text',
            prepend-icon='verified_user',
            @click='fzDialog.show(p)'
          ) FZ
          v-btn(
            icon,
            variant='text',
            size='small',
            :title='`${p.vorname} ${p.nachname} aus der Mitarbeiterliste entfernen`',
            @click='entfernen(p)'
          )
            v-icon person_remove

  add-fz(ref='fzDialog', @gespeichert='laden')
  neue-person(
    v-if='daten',
    ref='neuDialog',
    art='mitarbeit',
    :kreis-i-d='kreisID',
    :kreis-name='daten.kreis.bezeichnung',
    @gespeichert='nachAnlage'
  )
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import addFz from '../../../../../lib/addFz.lib.vue'
import neuePerson from '../../../../../lib/neuePerson.lib.vue'
import { useApi } from '../../../../../plugins/api'
import { useRouter } from '../../../../../plugins/router'
import type { PortalMe } from '../../../../../plugins/auth'
import filterGenerator from '../../../../../util/filter.util'
import saveBlob from '../../../../../util/download.util'
import { useDialog } from '../../../../../plugins/dialog'

/**
 * Mitarbeiter- und FZ-Liste eines EC-Kreises.
 *
 * Hier stehen die Mitarbeitenden des Kreises — nicht seine Mitglieder. Wer wo
 * Mitglied ist, pflegt die Ortsverantwortliche in der Mitgliederliste; das
 * Führungszeugnis wird dort vorgezeigt, wo jemand mitarbeitet, und jemand kann
 * in mehreren Kreisen mitarbeiten. Die FZ-Verantwortliche trägt deshalb hier
 * selbst ein, wer mitarbeitet.
 *
 * Zwei Ansichten: "Relevante" zeigt genau die Auswahl der Monats-Mail, damit
 * Web-Ansicht und Excel dieselbe Menge zeigen. "Alle Mitarbeitenden" nimmt
 * jede als mitarbeitend eingetragene Person dazu, auch die ganz ohne
 * FZ-Vorgang.
 *
 * Der Umschalter hängt an einem Query-Parameter, steht also in der URL und
 * übersteht ein Neuladen.
 */
const props = defineProps<{ me: PortalMe }>()

const api = useApi()
const { route, booleanQueryRef } = useRouter()
const fzDialog = useTemplateRef<InstanceType<typeof addFz>>('fzDialog')
const neuDialog = useTemplateRef<InstanceType<typeof neuePerson>>('neuDialog')

const alle = booleanQueryRef('alle')
const ansicht = computed({
  get: () => (alle.value ? 'alle' : 'ampel'),
  set: (v: string) => {
    alle.value = v === 'alle'
  }
})

const { error, notifyInfo } = useDialog()

const suche = ref('')
const qrLaeuft = ref(false)
const daten = ref<any>(null)
const laedtGerade = ref(false)

const kreisID = computed(() => parseInt(route.value.params.id as string, 10))

const gefiltert = computed(() => {
  if (!daten.value) return []
  return daten.value.personen.filter(filterGenerator(suche.value))
})

/**
 * Ein Führungszeugnis gibt es erst ab 14 (BZRG). Der Button bleibt für
 * Jüngere aus -- die API weist es ohnehin ab, aber ein Button, der immer in
 * eine Fehlermeldung läuft, ist eine schlechte Liste. Für die eigene Person
 * ebenfalls nicht: das Vier-Augen-Prinzip erzwingt der Server.
 */
function darfEintragen(p: any): boolean {
  if (p.personID === props.me.user.personID) return false
  if (!p.gebDat) return true
  const vierzehn = new Date(p.gebDat.input)
  vierzehn.setFullYear(vierzehn.getFullYear() + 14)
  return vierzehn <= new Date()
}

async function laden() {
  laedtGerade.value = true
  try {
    daten.value = await api.get(
      `/portal/kreis/${kreisID.value}/personen?modus=${alle.value ? 'alle' : 'ampel'}`
    )
  } finally {
    laedtGerade.value = false
  }
}

watch([kreisID, alle], laden, { immediate: true })

/**
 * Nach dem Hinzufügen in die Ansicht "Alle" wechseln: eine frisch
 * eingetragene Person hat meist noch keinen FZ-Vorgang und wäre unter
 * "Relevante" unsichtbar -- das sähe aus, als wäre nichts passiert.
 * Der Wechsel löst über den Watcher das Neuladen aus.
 */
function nachAnlage() {
  if (alle.value) laden()
  else alle.value = true
}

function entfernen(p: any) {
  if (
    !window.confirm(
      `${p.vorname} ${p.nachname} wirklich aus der Mitarbeiterliste entfernen?\n\nDie Person bleibt im System und behält ihre Mitgliedschaft; sie taucht nur in eurer FZ-Liste und der Monats-Mail nicht mehr auf.`
    )
  ) {
    return
  }
  api
    .request(`/portal/kreis/${kreisID.value}/mitarbeiter/${p.personID}`, {
      method: 'DELETE',
      quiet: true
    })
    .then(() => {
      notifyInfo(`${p.vorname} ${p.nachname} entfernt.`)
      laden()
    })
    .catch((err: any) =>
      error({
        text: err.message || String(err),
        title: 'Entfernen fehlgeschlagen'
      })
    )
}

/**
 * CSV-Export mit BOM: ohne das öffnet Excel die Datei als Latin-1 und macht
 * aus "Neumünster" Buchstabensalat. Gleiches Vorgehen wie auf der FZ-Seite
 * der Verwaltung.
 */
function csv() {
  const kopf = [
    'PersonenNr',
    'Vorname',
    'Nachname',
    'Geburtstag',
    'Status',
    'Letztes FZ vom',
    'Gültig bis',
    'Erster Antrag',
    'Letzter Antrag',
    'Anzahl Anträge',
    'E-Mail',
    'Telefon'
  ]
  const zelle = (v: unknown) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const zeilen = gefiltert.value.map((p: any) =>
    [
      p.personID,
      p.vorname,
      p.nachname,
      p.gebDat?.german ?? '',
      p.farbe,
      p.fzVon?.german ?? '',
      p.gueltigBis?.german ?? '',
      p.ersterAntrag?.german ?? '',
      p.letzterAntrag?.german ?? '',
      p.anzahlAntraege,
      p.email,
      p.telefon
    ]
      .map(zelle)
      .join(';')
  )

  const inhalt = '﻿' + [kopf.join(';'), ...zeilen].join('\n')
  saveBlob(
    `FZ-${daten.value.kreis.bezeichnung}.csv`,
    new Blob([inhalt], { type: 'text/csv;charset=utf-8' })
  )
}

/**
 * QR-Blatt zur Mitarbeitererfassung.
 *
 * Das Blatt wird ausgehängt; wer im Kreis mitarbeitet, scannt es und meldet
 * sich an. Bisher kam es auf Nachfrage aus der Geschäftsstelle.
 *
 * Das Erzeugen ändert nichts am Bestand: bereits ausgehängte Codes laufen
 * unverändert weiter, es kommt nur ein neues Blatt dazu. Deshalb keine
 * Rückfrage vor dem Download -- nur der Hinweis danach, bis wann das frische
 * Blatt gilt. Die Jahreszahl kommt vom Server, damit die Fünf-Jahres-Regel
 * nicht ein zweites Mal im Frontend steht.
 */
async function qrBlatt() {
  qrLaeuft.value = true
  try {
    const { blob, dateiname, headers } = await api.requestBlob(
      `/portal/kreis/${kreisID.value}/qr`
    )
    saveBlob(dateiname, blob)
    const jahr = headers.get('X-QR-Jahr')
    notifyInfo(
      jahr
        ? `QR-Blatt erzeugt — gültig bis 31.12.${jahr}. Ältere Aushänge bleiben gültig.`
        : 'QR-Blatt erzeugt.'
    )
  } finally {
    qrLaeuft.value = false
  }
}
</script>
