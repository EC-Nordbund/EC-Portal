<template lang="pug">
ec-wrapper(
  :title='daten ? daten.kreis.bezeichnung : "Schutzkonzept"',
  subTitle='Schutzkonzept',
  hasXBtn,
  hasReload,
  @reload='laden'
)
  v-progress-linear(v-if='laedt', indeterminate, color='primary')

  template(v-if='daten')
    //- ------------------------------------------------------------ Kopf --
    .d-flex.align-start.flex-wrap.ga-4.mb-4
      div
        .text-caption.text-medium-emphasis Schutzkonzept-E-Mails (Login-Code)
        .d-flex.flex-wrap.ga-1(v-if='daten.emails.length')
          v-chip(v-for='e in daten.emails', :key='e', size='small', prepend-icon='mail') {{ e }}
        v-chip(v-else, size='small', color='orange', variant='flat')
          | keine – in der Verwaltung unter EC-Kreise eintragen
      v-spacer
      v-btn(
        variant='flat',
        v-accent-bg,
        v-white,
        prepend-icon='open_in_new',
        :loading='oeffnet',
        :disabled='!daten.aktuelleFormularVersion',
        @click='imSystemOeffnen'
      ) Im Schutzkonzept-System öffnen

    v-alert.mb-4(v-if='!daten.aktuelleFormularVersion', type='warning', variant='tonal')
      | Es ist noch keine Formularversion veröffentlicht.

    //- ----------------------------------------------------------- Draft --
    v-card.mb-4(variant='outlined')
      v-card-title In Bearbeitung
      v-card-text
        template(v-if='daten.draft')
          .d-flex.align-center.ga-2.mb-1
            v-progress-linear(:model-value='daten.draft.fortschritt', color='primary', height='10', rounded)
            span.text-caption.text-no-wrap {{ daten.draft.fortschritt }} %
          .text-body-2
            | Stand {{ daten.draft.versionNr }} · Formular v{{ daten.draft.formularVersionNr }}
            | · zuletzt {{ datumZeit(daten.draft.geaendert) }} von {{ daten.draft.geaendertVon }}
          v-chip.mt-1(v-if='daten.draft.veraltet', size='x-small', color='orange', variant='tonal')
            | liegt auf älterer Formularversion – wird beim nächsten Öffnen übernommen

          //- Prüfstand des Entwurfs: die drei Sperren vor dem Veröffentlichen
          //- (Pflichtangaben, Regeln, Bestätigungen), gerechnet vom Server.
          template(v-if='draftStand')
            .d-flex.flex-wrap.ga-2.mt-3
              v-chip(
                size='small',
                :color='draftStand.fehlend.length ? "orange" : "green"',
                variant='tonal',
                :prepend-icon='draftStand.fehlend.length ? "pending" : "check"'
              ) {{ draftStand.fehlend.length ? `${draftStand.fehlend.length} Pflichtangaben fehlen` : 'Alle Pflichtangaben da' }}
              v-chip(
                size='small',
                :color='draftStand.verstoesse.length ? "red" : "green"',
                variant='tonal',
                :prepend-icon='draftStand.verstoesse.length ? "rule" : "check"'
              ) {{ draftStand.verstoesse.length ? `${draftStand.verstoesse.length} Regelverstöße` : 'Keine Regelverstöße' }}
              v-chip(
                v-if='draftStand.definition.einstellungen.abschnitteBestaetigen',
                size='small',
                :color='draftStand.unbestaetigt.length ? "orange" : "green"',
                variant='tonal',
                :prepend-icon='draftStand.unbestaetigt.length ? "task_alt" : "check"'
              ) {{ bestaetigungsText(draftStand) }}
              v-chip(v-else, size='small', variant='tonal', prepend-icon='info')
                | Abschnitte müssen in dieser Formularversion nicht bestätigt werden
            v-expansion-panels.mt-3(v-if='draftStand.fehlend.length || draftStand.verstoesse.length || draftStand.unbestaetigt.length', variant='accordion')
              v-expansion-panel(v-if='draftStand.fehlend.length', :title='`Fehlende Pflichtangaben (${draftStand.fehlend.length})`')
                v-expansion-panel-text
                  ul.ml-4
                    li(v-for='(f, i) in draftStand.fehlend', :key='`f${i}`') {{ f.label }}
              v-expansion-panel(v-if='draftStand.verstoesse.length', :title='`Regelverstöße (${draftStand.verstoesse.length})`')
                v-expansion-panel-text
                  ul.ml-4
                    li(v-for='(v, i) in draftStand.verstoesse', :key='`v${i}`')
                      | {{ v.label }}:
                      span.text-medium-emphasis  {{ v.text }}
              v-expansion-panel(v-if='draftStand.unbestaetigt.length', :title='`Noch nicht bestätigte Abschnitte (${draftStand.unbestaetigt.length})`')
                v-expansion-panel-text
                  ul.ml-4
                    li(v-for='u in draftStand.unbestaetigt', :key='u.abschnittId') {{ u.titel }}
          .text-caption.text-medium-emphasis.mt-2(v-else-if='draftStandFehler') {{ draftStandFehler }}
        .text-medium-emphasis(v-else) Derzeit bearbeitet niemand das Schutzkonzept.
      v-card-actions(v-if='daten.draft')
        v-btn(variant='text', prepend-icon='visibility', @click='ansehen(daten.draft.standID)') Entwurf ansehen

    //- ------------------------------------------------- Anstehende Termine --
    v-card.mb-4(variant='outlined')
      v-card-title Anstehende Termine
      v-card-text
        template(v-if='erinnerungen')
          .text-body-2.text-medium-emphasis.mb-2(v-if='erinnerungen.stand')
            | Datumsfelder mit Erinnerung aus dem veröffentlichten Stand {{ erinnerungen.stand.versionNr }}.
            | Die Mails gehen an die Schutzkonzept-E-Mails des Kreises; bei Überfälligkeit
            | zusätzlich an die Schutzkonzept-Verwalter/innen.
          .text-medium-emphasis(v-if='!erinnerungen.stand') Erst nach dem ersten veröffentlichten Stand.
          .text-medium-emphasis(v-else-if='!erinnerungen.termine.length') Keine Termine mit Erinnerung eingetragen.
          v-table(v-else, density='compact')
            thead
              tr
                th Frage
                th Datum
                th Fällig
                th Erinnerung
            tbody
              tr(v-for='(t, i) in erinnerungen.termine', :key='i', :class='{ "text-error": t.ueberfaellig }')
                td {{ t.label }}
                td.text-no-wrap {{ datum(t.datum) }}
                td.text-no-wrap
                  v-icon.mr-1(v-if='t.ueberfaellig', size='small', color='error') warning
                  | {{ tageText(t.tage) }}
                td
                  template(v-if='t.stufe')
                    v-chip(size='x-small', :color='t.gesendet ? "green" : "orange"', variant='tonal')
                      | {{ stufeText(t.stufe) }} · {{ t.gesendet ? 'verschickt' : 'steht aus' }}
                  span.text-medium-emphasis(v-else) –
          v-expansion-panels.mt-3(v-if='erinnerungen.protokoll.length', variant='accordion')
            v-expansion-panel(:title='`Verschickte Erinnerungen (${erinnerungen.protokoll.length})`')
              v-expansion-panel-text
                v-table(density='compact')
                  thead
                    tr
                      th Gesendet
                      th Feld
                      th Datum
                      th Stufe
                      th Empfänger
                  tbody
                    tr(v-for='p in erinnerungen.protokoll', :key='p.erinnerungID')
                      td.text-no-wrap {{ datumZeit(p.gesendet) }}
                      td
                        code {{ p.feldKey }}
                        span.text-caption(v-if='p.zeile')  (Zeile {{ p.zeile }})
                      td.text-no-wrap {{ datum(p.datum) }}
                      td {{ stufeText(p.stufe) }}
                      td {{ p.empfaenger }}
        .text-medium-emphasis(v-else-if='erinnerungenFehler') {{ erinnerungenFehler }}
        .text-medium-emphasis(v-else) Wird geladen …

    //- -------------------------------------------------------- Historie --
    h2.text-h6.mb-2(v-font, v-primary) Veröffentlichte Stände
    v-alert(v-if='!daten.historie.length', type='info', variant='tonal')
      | Dieser Kreis hat noch keinen Stand veröffentlicht.
    v-table(v-else, density='compact')
      thead
        tr
          th Stand
          th Veröffentlicht
          th Formular
          th PDFs
          th
      tbody
        tr(v-for='s in daten.historie', :key='s.standID')
          td {{ s.versionNr }}
          td
            | {{ datumZeit(s.publishedAm) }}
            .text-caption.text-medium-emphasis {{ s.publishedVon }}
          td
            | v{{ s.formularVersionNr }}
            v-chip.ml-1(v-if='s.veraltet', size='x-small', color='orange', variant='tonal') veraltet
          td
            .d-flex.flex-wrap.ga-1
              v-chip(
                v-for='p in s.pdfs',
                :key='p.pdfID',
                size='small',
                prepend-icon='picture_as_pdf',
                @click='pdfLaden(p.pdfID)'
              ) {{ p.dateiname }}
          td.text-right
            v-btn(variant='text', size='small', prepend-icon='visibility', @click='ansehen(s.standID)') Ansehen

  //- ------------------------------------------------------ Stand-Ansicht --
  template(#dialogs)
    v-dialog(v-model='ansichtOffen', fullscreen, scrollable)
      v-card(v-if='ansicht')
        v-toolbar(v-accent-bg, density='comfortable')
          v-btn(icon, @click='ansichtOffen = false')
            v-icon(color='white') close
          v-toolbar-title.text-white
            | {{ ansicht.kreis.bezeichnung }} – Stand {{ ansicht.stand.versionNr }}
            | ({{ ansicht.stand.status === 'draft' ? 'Entwurf' : 'veröffentlicht' }})
        v-card-text
          .d-flex.align-center.ga-2.mb-2
            v-progress-linear(:model-value='ansicht.stand.fortschritt', color='primary', height='10', rounded)
            span.text-caption.text-no-wrap {{ ansicht.stand.fortschritt }} %
          .text-body-2.text-medium-emphasis.mb-2
            | Formularversion {{ ansicht.stand.formularVersionNr }} · zuletzt geändert
            | {{ datumZeit(ansicht.stand.geaendert) }} von {{ ansicht.stand.geaendertVon }}
          //- Bestätigungen sind auch bei veröffentlichten Ständen eingefroren
          //- gespeichert; Altbestand (vor dieser Funktion) hat eine leere Liste.
          .d-flex.flex-wrap.ga-2.mb-4
            v-chip(size='small', :color='ansicht.fehlend.length ? "orange" : "green"', variant='tonal')
              | {{ ansicht.fehlend.length ? `${ansicht.fehlend.length} Pflichtangaben fehlen` : 'Alle Pflichtangaben da' }}
            v-chip(size='small', :color='ansicht.verstoesse.length ? "red" : "green"', variant='tonal')
              | {{ ansicht.verstoesse.length ? `${ansicht.verstoesse.length} Regelverstöße` : 'Keine Regelverstöße' }}
            //- Veröffentlicht ohne eine einzige Bestätigung = Altbestand von vor
            //- dieser Funktion; das ist kein Mangel, nur eine Information.
            v-chip(
              v-if='altbestand(ansicht)',
              size='small',
              variant='tonal',
              prepend-icon='history'
            ) Ohne Abschnitts-Bestätigungen veröffentlicht (Altbestand)
            v-chip(
              v-else-if='ansicht.definition.einstellungen.abschnitteBestaetigen',
              size='small',
              :color='ansicht.unbestaetigt.length ? "orange" : "green"',
              variant='tonal'
            ) {{ bestaetigungsText(ansicht) }}
            v-btn(size='small', variant='tonal', @click='ansichtMarkieren = !ansichtMarkieren')
              | {{ ansichtMarkieren ? 'Markierung ausblenden' : 'Fehlendes und Verstöße markieren' }}
          v-expansion-panels(multiple, v-model='offeneBereiche')
            v-expansion-panel(
              v-for='(b, bi) in ansicht.definition.bereiche',
              :key='b.id',
              :value='bi'
            )
              v-expansion-panel-title
                | {{ bi + 1 }}. {{ b.titel }}
                v-spacer
                span.text-caption.text-no-wrap.mr-4 {{ fortschrittBereich(b, ansicht.stand.daten) }} %
              v-expansion-panel-text
                .text-body-2.text-medium-emphasis.mb-3.text-pre(v-if='b.beschreibung') {{ b.beschreibung }}
                abschnitt(
                  v-for='a in b.abschnitte',
                  :key='a.id',
                  v-model:daten='ansicht.stand.daten',
                  :abschnitt='a',
                  :heute='ansicht.heute',
                  :markiere-fehlend='ansichtMarkieren',
                  :bestaetigen-aktiv='ansicht.definition.einstellungen.abschnitteBestaetigen && !altbestand(ansicht)',
                  :bestaetigt='ansicht.stand.abschnitteBestaetigt.includes(a.id)',
                  readonly
                )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useApi } from '../../../../plugins/api'
import { useDialog } from '../../../../plugins/dialog'
import { useRouter } from '../../../../plugins/router'
import saveBlob from '../../../../util/download.util'
import abschnitt from '../../../../schutzkonzept/abschnitt.vue'
import { datum, datumZeit } from '../../../../schutzkonzept/format'
import {
  fortschrittBereich,
  type AbschnittRef,
  type Definition,
  type Fehlend,
  type Verstoss
} from '../../../../schutzkonzept/definition'

/**
 * Schutzkonzept eines EC-Kreises aus Sicht der Verwaltung.
 *
 * Lesen geht hier direkt; bearbeitet wird ausschließlich im
 * Schutzkonzept-System selbst. Der Button erzeugt dafür einen Einmal-Link
 * (5 Minuten gültig), der genau diesen Kreis öffnet -- so arbeitet die
 * Verwaltung mit demselben Stepper, Draft und Veröffentlichen wie der Kreis.
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
  veraltet: boolean
}

interface KreisAntwort {
  kreis: { ecKreisID: number; bezeichnung: string }
  aktuelleFormularVersion: {
    formularVersionID: number
    versionNr: number
  } | null
  draft: StandKurz | null
  historie: Array<StandKurz & { pdfs: { pdfID: number; dateiname: string }[] }>
  emails: string[]
}

/** GET .../stand/:standId (ladeStand) -- samt Prüfstand des Servers. */
interface StandAntwort {
  kreis: { ecKreisID: number; bezeichnung: string }
  stand: StandKurz & {
    status: 'draft' | 'published'
    daten: Record<string, any>
    abschnitteBestaetigt: string[]
  }
  definition: Definition
  /** JJJJ-MM-TT, Server-Zeit -- damit rechnen die Datumsregeln. */
  heute: string
  fehlend: Fehlend[]
  verstoesse: Verstoss[]
  /** Leer, wenn die Formularversion keine Bestätigungen verlangt. */
  unbestaetigt: AbschnittRef[]
}

/** GET .../erinnerungen (Termine aus dem letzten veröffentlichten Stand). */
interface ErinnerungenAntwort {
  heute: string
  stand: { standID: number; versionNr: number } | null
  termine: {
    feldKey: string
    zeile: number | null
    label: string
    datum: string
    /** Tage bis zum Datum, negativ = vergangen. */
    tage: number
    ueberfaellig: boolean
    /** Heute fällige Stufe ('vorher-30' | 'tag' | 'ueberfaellig-2' …) oder null. */
    stufe: string | null
    gesendet: boolean
  }[]
  protokoll: {
    erinnerungID: number
    standID: number
    feldKey: string
    zeile: number | null
    datum: string
    stufe: string
    empfaenger: number
    gesendet: string
  }[]
}

const api = useApi()
const { error } = useDialog()
const { route } = useRouter()

const id = computed(() => parseInt(route.value.params.id as string, 10))

const daten = ref<KreisAntwort | null>(null)
const laedt = ref(false)
const oeffnet = ref(false)

/** Vollständiger Entwurf (für Prüfstand und Bestätigungen), falls einer existiert. */
const draftStand = ref<StandAntwort | null>(null)
const draftStandFehler = ref('')

const erinnerungen = ref<ErinnerungenAntwort | null>(null)
const erinnerungenFehler = ref('')

const ansicht = ref<StandAntwort | null>(null)
const ansichtOffen = ref(false)
const ansichtMarkieren = ref(false)
const offeneBereiche = ref<number[]>([0])

async function laden() {
  laedt.value = true
  const kreisId = id.value
  try {
    const r = await api.get<KreisAntwort>(
      `/portal/schutzkonzept/kreise/${kreisId}`
    )
    // Veraltete Antwort nach schnellem Kreiswechsel nicht übernehmen.
    if (kreisId !== id.value) return
    daten.value = r
    draftStand.value = null
    draftStandFehler.value = ''
    erinnerungen.value = null
    erinnerungenFehler.value = ''
    await Promise.all([ladeDraftStand(r), ladeErinnerungen()])
  } finally {
    laedt.value = false
  }
}

/**
 * Der Prüfstand (fehlend/verstoesse/unbestaetigt) steckt nur in ladeStand,
 * nicht in der Kreisübersicht -- deshalb ein zweiter, stiller Request.
 */
async function ladeDraftStand(r: KreisAntwort) {
  if (!r.draft) return
  const kreisId = r.kreis.ecKreisID
  try {
    const s = await api.get<StandAntwort>(
      `/portal/schutzkonzept/kreise/${kreisId}/stand/${r.draft.standID}`,
      { quiet: true }
    )
    if (kreisId === id.value) draftStand.value = s
  } catch (err: any) {
    if (kreisId === id.value) {
      draftStandFehler.value = `Prüfstand des Entwurfs nicht ladbar (${err.message}).`
    }
  }
}

/**
 * Die Erinnerungs-Route kommt mit dem Erinnerungs-Job in die API; solange sie
 * fehlt (404), zeigt der Block nur einen Hinweis statt eines Fehlerdialogs.
 */
async function ladeErinnerungen() {
  const kreisId = id.value
  try {
    const e = await api.get<ErinnerungenAntwort>(
      `/portal/schutzkonzept/kreise/${kreisId}/erinnerungen`,
      { quiet: true }
    )
    if (kreisId !== id.value) return
    if (!e || !Array.isArray(e.termine)) {
      erinnerungenFehler.value =
        'Erinnerungen noch nicht aktiv (unerwartete Antwort der API).'
      return
    }
    erinnerungen.value = {
      ...e,
      protokoll: Array.isArray(e.protokoll) ? e.protokoll : []
    }
  } catch (err: any) {
    if (kreisId !== id.value) return
    erinnerungenFehler.value =
      err.status === 404
        ? 'Erinnerungen noch nicht aktiv – die API kennt diese Funktion noch nicht.'
        : `Erinnerungen nicht ladbar (${err.message}).`
  }
}

watch(id, laden, { immediate: true })

/** "12 von 25 Abschnitten bestätigt" bzw. "Alle 25 Abschnitte bestätigt". */
function bestaetigungsText(s: StandAntwort): string {
  const gesamt = s.definition.bereiche.reduce(
    (n, b) => n + b.abschnitte.length,
    0
  )
  const ok = s.stand.abschnitteBestaetigt.length
  if (gesamt === 0) return 'Keine Abschnitte'
  return ok >= gesamt
    ? `Alle ${gesamt} Abschnitte bestätigt`
    : `${ok} von ${gesamt} Abschnitten bestätigt`
}

/** Veröffentlicht, aber kein Abschnitt bestätigt: Stand von vor dieser Funktion. */
function altbestand(s: StandAntwort): boolean {
  return (
    s.definition.einstellungen.abschnitteBestaetigen &&
    s.stand.status === 'published' &&
    s.stand.abschnitteBestaetigt.length === 0
  )
}

/** "in 30 Tagen", "heute", "seit 3 Tagen überfällig". */
function tageText(tage: number): string {
  if (tage === 0) return 'heute'
  if (tage === 1) return 'morgen'
  if (tage > 1) return `in ${tage} Tagen`
  if (tage === -1) return 'seit gestern überfällig'
  return `seit ${-tage} Tagen überfällig`
}

/** Stufe aus der API lesbar machen -- gerechnet wird sie nur auf dem Server. */
function stufeText(stufe: string): string {
  if (stufe === 'tag') return 'am Tag selbst'
  const vorher = /^vorher-(\d+)$/.exec(stufe)
  if (vorher) return `${vorher[1]} Tage vorher`
  const ueber = /^ueberfaellig-(\d+)$/.exec(stufe)
  if (ueber) return `überfällig, Woche ${ueber[1]}`
  return stufe
}

async function ansehen(standID: number) {
  laedt.value = true
  try {
    ansicht.value = await api.get<StandAntwort>(
      `/portal/schutzkonzept/kreise/${id.value}/stand/${standID}`
    )
    offeneBereiche.value = ansicht.value.definition.bereiche.map((_, i) => i)
    ansichtMarkieren.value = false
    ansichtOffen.value = true
  } finally {
    laedt.value = false
  }
}

async function pdfLaden(pdfID: number) {
  const { blob, dateiname } = await api.requestBlob(
    `/portal/schutzkonzept/pdf/${pdfID}`
  )
  saveBlob(dateiname, blob)
}

async function imSystemOeffnen() {
  // Fenster sofort öffnen und erst danach befüllen: nach einem await würde
  // der Popup-Blocker window.open als nicht vom Nutzer ausgelöst werten.
  const fenster = window.open('about:blank', '_blank')
  oeffnet.value = true
  try {
    const r = await api.post<{ url: string }>(
      `/portal/schutzkonzept/kreise/${id.value}/zugang`,
      {},
      { quiet: true }
    )
    if (fenster) {
      fenster.opener = null
      fenster.location.href = r.url
    } else window.location.href = r.url
  } catch (err: any) {
    fenster?.close()
    error({ title: 'Öffnen fehlgeschlagen', text: err.message })
  } finally {
    oeffnet.value = false
  }
}
</script>

<style scoped>
.text-pre {
  white-space: pre-line;
}
</style>
