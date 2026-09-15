<template lang="pug">
div
  v-progress-linear(v-if='laedt && !antrag', indeterminate, color='primary')

  v-alert(v-if='abgewiesen', type='warning', variant='tonal') {{ abgewiesen }}

  template(v-else-if='antrag')
    .d-flex.align-center.flex-wrap.ga-2.mb-3
      v-btn(variant='text', size='small', prepend-icon='arrow_back', @click='zurueck') Anträge
      v-spacer
      v-chip(:color='STATUS_FARBE[antrag.status]', variant='tonal') {{ STATUS_TEXT[antrag.status] }}

    v-card.mb-4(variant='outlined')
      v-card-title {{ antrag.anlass }}
      v-card-text
        .d-flex.flex-wrap.ga-6
          div
            .text-caption.text-medium-emphasis Zeitraum
            div {{ datum(antrag.von, antrag.vonObj) }} – {{ datum(antrag.bis, antrag.bisObj) }}
          div
            .text-caption.text-medium-emphasis Antragsteller/in
            div
              | {{ antrag.antragsteller.vorname }} {{ antrag.antragsteller.nachname }}
              a.ml-2(:href='`mailto:${antrag.antragsteller.email}`') {{ antrag.antragsteller.email }}
          div(v-if='antrag.kreis')
            .text-caption.text-medium-emphasis EC-Kreis
            div {{ antrag.kreis }}
          div
            .text-caption.text-medium-emphasis Gestellt am
            div {{ datumZeit(antrag.erstellt) }}
        .mt-3(v-if='antrag.kommentar')
          .text-caption.text-medium-emphasis Kommentar
          div(style='white-space: pre-wrap') {{ antrag.kommentar }}

    v-alert.mb-4(
      v-if='ueberbuchtNamen.length',
      type='warning',
      variant='tonal',
      density='compact'
    )
      | Mit diesen Mengen wäre im Zeitraum mehr vergeben als im Lager ist:
      | {{ ueberbuchtNamen.join(', ') }}. Das System sperrt nichts – entscheide
      | selbst, wer Vorrang hat (Nordbund-Veranstaltungen zuerst).

    h3.text-subtitle-1.mb-2(v-font, v-primary) Positionen
    v-table(density='compact')
      thead
        tr
          th(style='width: 56px')
          th Material
          th.text-right Beantragt
          th.text-right(style='min-width: 120px') Genehmigt
          th(v-if='zeigePackliste') Packliste
      tbody
        template(v-for='p in antrag.positionen', :key='p.materialAntragPositionID')
          tr(:class='{ "text-medium-emphasis": gestrichen(p) }')
            td
              ec-material-foto(
                :material-i-d='p.materialID',
                :name='p.name',
                :hat-foto='p.hatFoto',
                :size='40'
              )
            td
              div(:style='gestrichen(p) ? "text-decoration: line-through" : ""') {{ p.name }}
              .text-caption.text-medium-emphasis
                span(v-if='p.lagerort') {{ p.lagerort }}
                span(v-if='bestandVon(p) !== null')  · Bestand {{ bestandVon(p) }}
            td.text-right {{ p.menge }}
            td.text-right
              v-text-field(
                v-if='mengenEditierbar',
                v-model.number='mengen[p.materialAntragPositionID]',
                type='number',
                min='0',
                :max='p.menge',
                density='compact',
                variant='outlined',
                hide-details,
                style='max-width: 110px; margin-left: auto',
                :error='!mengeGueltig(mengen[p.materialAntragPositionID], p)'
              )
              span(v-else) {{ p.mengeGenehmigt ?? '—' }}
            td(v-if='zeigePackliste')
              template(v-if='(p.mengeGenehmigt ?? 0) > 0')
                v-icon(size='small', :color='p.eingeladen ? "success" : "grey"') {{ p.eingeladen ? 'check_box' : 'check_box_outline_blank' }}
                span.text-caption.mr-2 eingeladen
                v-icon(size='small', :color='p.zurueck ? "success" : "grey"') {{ p.zurueck ? 'check_box' : 'check_box_outline_blank' }}
                span.text-caption zurück
              span.text-caption.text-medium-emphasis(v-else) gestrichen
          //- Überschneidungen direkt unter der Position: dort, wo die
          //- Entscheidung fällt, nicht in einer eigenen Liste weiter unten.
          tr(v-if='konflikte(p).length')
            td
            td(:colspan='zeigePackliste ? 4 : 3')
              v-alert.mb-2(type='warning', variant='tonal', density='compact')
                div(v-for='k in konflikte(p)', :key='k.materialAntragID')
                  | Überschneidung:
                  a.mx-1(href='#', @click.prevent='navigate({ path: `/materialwart/antrag/${k.materialAntragID}` })') {{ k.anlass }}
                  | {{ k.vonObj.german }} – {{ k.bisObj.german }} · {{ k.menge }} Stk.
                  | ({{ STATUS_TEXT[k.status] }}, {{ k.antragsteller }})

    .text-caption.text-medium-emphasis.mt-1(v-if='mengenEditierbar')
      | Genehmigte Menge 0 streicht die Position. Reduzierte Mengen werden
      | in der Mail an die/den Antragsteller/in hervorgehoben.

    v-textarea.mt-4(
      v-if='antrag.status !== "storniert"',
      v-model='antwort',
      label='Antwort an die/den Antragsteller/in',
      rows='2',
      auto-grow,
      :readonly='antrag.status === "abgeschlossen"',
      hint='Steht in der Benachrichtigung und im Antrag – z. B. Abholzeit, Hinweise zum Material oder der Grund einer Ablehnung.',
      persistent-hint
    )

    .d-flex.flex-wrap.ga-2.mt-4
      template(v-if='antrag.status === "offen"')
        v-btn(v-accent-bg, v-white, prepend-icon='check', :loading='speichert', :disabled='!mengenOk', @click='setzeStatus("genehmigt")') Genehmigen
        v-btn(variant='tonal', color='error', prepend-icon='close', :loading='speichert', @click='setzeStatus("abgelehnt")') Ablehnen
      template(v-else-if='antrag.status === "genehmigt"')
        v-btn(v-accent-bg, v-white, prepend-icon='save', :loading='speichert', :disabled='!mengenOk || !geaendert', @click='setzeStatus("genehmigt")') Änderungen speichern
        v-btn(variant='tonal', prepend-icon='task_alt', :loading='speichert', @click='abschliessen') Abschließen
        v-btn(variant='text', color='error', prepend-icon='undo', :loading='speichert', @click='setzeStatus("abgelehnt")') Genehmigung zurückziehen
      template(v-else-if='antrag.status === "abgelehnt"')
        v-btn(v-accent-bg, v-white, prepend-icon='check', :loading='speichert', :disabled='!mengenOk', @click='setzeStatus("genehmigt")') Doch genehmigen
        v-btn(variant='tonal', prepend-icon='refresh', :loading='speichert', @click='setzeStatus("offen")') Wieder öffnen
      span.text-caption.text-medium-emphasis.align-self-center(v-else-if='antrag.status === "abgeschlossen"')
        | Abgeschlossen{{ antrag.abgeschlossenAm ? ' am ' + datumZeit(antrag.abgeschlossenAm) : '' }}. Keine weiteren Schritte.
      span.text-caption.text-medium-emphasis.align-self-center(v-else)
        | Von der/dem Antragsteller/in zurückgezogen.
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useApi } from '../../../../../plugins/api'
import { useDialog } from '../../../../../plugins/dialog'
import { useRouter } from '../../../../../plugins/router'
import {
  STATUS_FARBE,
  STATUS_TEXT,
  type AntragDetail,
  type AntragPosition,
  type AntragStatus,
  type ApiDatum,
  type Konflikt,
  type MaterialVerwaltung
} from '../../../../../util/material.types'

/**
 * Ein Antrag aus Sicht des Materialwarts: entscheiden, Mengen anpassen,
 * abschließen.
 *
 * Alle Aktionen laufen über EINEN PATCH mit {status, antwort, positionen} --
 * der Server prüft den Übergang und verschickt die Mail. Konflikte stehen
 * direkt unter der jeweiligen Position; das System warnt nur, gesperrt wird
 * nichts (Vorrang entscheidet der Mensch).
 *
 * Die Überbuchungs-Warnung rechnet der Client aus Konflikten und den gerade
 * eingetragenen Mengen -- so reagiert sie sofort auf jede Änderung im
 * Formular, ohne einen Request je Tastendruck.
 */
const emit = defineEmits<{ (e: 'reload'): void }>()
const api = useApi()
const { route, router, navigate } = useRouter()
const { error, notifyInfo } = useDialog()

const id = computed(() => parseInt(route.value.params.id as string, 10))
const antrag = ref<AntragDetail | null>(null)
/** Bestand je materialID, aus der Bestandsliste -- für die Überbuchungs-Warnung. */
const bestand = ref<Map<number, number>>(new Map())
const laedt = ref(false)
const speichert = ref(false)
const abgewiesen = ref('')
const antwort = ref('')
/** Genehmigte Menge je Position, so wie sie im Formular steht. */
const mengen = reactive<Record<number, number>>({})

const mengenEditierbar = computed(
  () =>
    !!antrag.value &&
    ['offen', 'genehmigt', 'abgelehnt'].includes(antrag.value.status)
)

const zeigePackliste = computed(
  () =>
    antrag.value?.status === 'genehmigt' ||
    antrag.value?.status === 'abgeschlossen'
)

function datum(iso: string, obj: ApiDatum | null) {
  return obj ? obj.german : iso
}

function mengeGueltig(v: unknown, p: AntragPosition) {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= p.menge
}

/** Im Formular gestrichen (0) bzw. bei nicht editierbaren Anträgen laut Server. */
function gestrichen(p: AntragPosition) {
  return mengenEditierbar.value
    ? mengen[p.materialAntragPositionID] === 0
    : p.mengeGenehmigt === 0
}

const mengenOk = computed(() =>
  (antrag.value?.positionen ?? []).every((p) =>
    mengeGueltig(mengen[p.materialAntragPositionID], p)
  )
)

const geaendert = computed(() => {
  if (!antrag.value) return false
  if (antwort.value !== antrag.value.antwort) return true
  return antrag.value.positionen.some(
    (p) => mengen[p.materialAntragPositionID] !== (p.mengeGenehmigt ?? p.menge)
  )
})

function konflikte(p: AntragPosition): Konflikt[] {
  const k = antrag.value?.konflikte
  if (!k) return []
  // Der Server schlüsselt nach materialID; ein Objekt-Key ist ein String.
  return (k as Record<string, Konflikt[]>)[String(p.materialID)] ?? []
}

function bestandVon(p: AntragPosition): number | null {
  return bestand.value.get(p.materialID) ?? null
}

/**
 * Überbucht: genehmigte Mengen der anderen Anträge im Zeitraum plus die hier
 * eingetragene Menge übersteigen den Bestand. Konservativ (alle Konflikte
 * addiert, auch wenn sie sich untereinander nicht überschneiden) -- das ist
 * eine Warnung, keine Sperre.
 */
const ueberbuchtNamen = computed(() => {
  const a = antrag.value
  if (!a) return []
  return a.positionen
    .filter((p) => {
      const b = bestandVon(p)
      if (b === null) return false
      const eigene = mengenEditierbar.value
        ? Number(mengen[p.materialAntragPositionID]) || 0
        : (p.mengeGenehmigt ?? 0)
      if (eigene === 0) return false
      const andere = konflikte(p)
        .filter((k) => k.status === 'genehmigt')
        .reduce((s, k) => s + k.menge, 0)
      return eigene + andere > b
    })
    .map((p) => p.name)
})

function datumZeit(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function laden() {
  laedt.value = true
  abgewiesen.value = ''
  try {
    const a = await api.get<AntragDetail>(
      `/portal/material/antrag/${id.value}`,
      {
        quiet: true
      }
    )
    antrag.value = a
    antwort.value = a.antwort ?? ''
    for (const p of a.positionen) {
      mengen[p.materialAntragPositionID] = p.mengeGenehmigt ?? p.menge
    }
    ladeBestand()
  } catch (err: any) {
    antrag.value = null
    abgewiesen.value =
      err?.status === 404
        ? 'Diesen Antrag gibt es nicht (mehr).'
        : err?.status === 403
          ? err.message
          : 'Der Antrag konnte nicht geladen werden.'
  } finally {
    laedt.value = false
  }
}

/** Nur für die Warnung; ohne diese Liste fehlt sie einfach. */
async function ladeBestand() {
  try {
    const res = await api.get<{ material: MaterialVerwaltung[] }>(
      '/portal/material/verwaltung/material',
      { quiet: true }
    )
    bestand.value = new Map(res.material.map((m) => [m.materialID, m.bestand]))
  } catch {
    bestand.value = new Map()
  }
}

watch(id, laden, { immediate: true })

function zurueck() {
  if (window.history.length > 1) router.back()
  else navigate({ path: '/materialwart/antraege' })
}

async function patch(body: Record<string, unknown>, meldung: string) {
  if (speichert.value) return
  speichert.value = true
  try {
    await api.request(`/portal/material/verwaltung/antrag/${id.value}`, {
      method: 'PATCH',
      body,
      quiet: true
    })
    notifyInfo(meldung)
    await laden()
    // Zähler „offene Anträge“ im Menü und auf der Startseite nachziehen.
    emit('reload')
  } catch (err: any) {
    error({
      text: err.message || String(err),
      title: 'Speichern fehlgeschlagen'
    })
  } finally {
    speichert.value = false
  }
}

function positionenBody() {
  return (antrag.value?.positionen ?? []).map((p) => ({
    materialAntragPositionID: p.materialAntragPositionID,
    mengeGenehmigt: Number(mengen[p.materialAntragPositionID])
  }))
}

function setzeStatus(status: AntragStatus) {
  if (!antrag.value) return
  if (status === 'abgelehnt' && antrag.value.status === 'genehmigt') {
    if (
      !window.confirm(
        'Genehmigung wirklich zurückziehen?\n\nDie Reservierung entfällt, und die/der Antragsteller/in bekommt eine Mail mit deiner Antwort als Begründung.'
      )
    ) {
      return
    }
  }
  if (status === 'abgelehnt' && !antwort.value.trim()) {
    if (
      !window.confirm(
        'Ohne Antwort ablehnen?\n\nDie/der Antragsteller/in erfährt dann nicht, warum. Abbrechen, um noch einen Grund einzutragen.'
      )
    ) {
      return
    }
  }
  const body: Record<string, unknown> = { status, antwort: antwort.value }
  if (status === 'genehmigt') body.positionen = positionenBody()
  const meldung =
    status === 'genehmigt'
      ? antrag.value.status === 'genehmigt'
        ? 'Änderungen gespeichert, Antragsteller/in benachrichtigt.'
        : 'Antrag genehmigt, Antragsteller/in benachrichtigt.'
      : status === 'abgelehnt'
        ? 'Antrag abgelehnt, Antragsteller/in benachrichtigt.'
        : 'Antrag wieder geöffnet.'
  patch(body, meldung)
}

function abschliessen() {
  if (!antrag.value) return
  const offen = antrag.value.positionen.filter(
    (p) => (p.mengeGenehmigt ?? 0) > 0 && !p.zurueck
  )
  const hinweis = offen.length
    ? `\n\n${offen.length} ${offen.length === 1 ? 'Position ist' : 'Positionen sind'} noch nicht als zurückgebracht abgehakt (${offen.map((p) => p.name).join(', ')}). Mit dem Abschluss bestätigst du, dass alles wieder da ist.`
    : ''
  if (
    !window.confirm(
      `Antrag „${antrag.value.anlass}“ abschließen?${hinweis}\n\nDanach lässt sich nichts mehr ändern.`
    )
  ) {
    return
  }
  patch(
    { status: 'abgeschlossen', antwort: antwort.value },
    'Antrag abgeschlossen.'
  )
}
</script>
