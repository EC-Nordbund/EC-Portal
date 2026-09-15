<template lang="pug">
div
  //- Zeitraum zuerst: ohne ihn gibt es keine Verfügbarkeit, nur den Bestand.
  v-card.mb-4(variant='tonal', color='primary')
    v-card-text
      .d-flex.align-center.flex-wrap.ga-4
        v-text-field(
          label='Ausleihe von',
          type='date',
          v-model='von',
          :min='heute',
          density='compact',
          hide-details,
          style='max-width: 190px'
        )
        v-text-field(
          label='bis',
          type='date',
          v-model='bis',
          :min='von || heute',
          density='compact',
          hide-details,
          style='max-width: 190px'
        )
        span.text-caption(v-if='zeitraum') Verfügbarkeit für {{ zeitraumText }}
        span.text-caption.text-error(v-else-if='zeitraumFehler') {{ zeitraumFehler }}
        span.text-caption(v-else-if='von || bis') Bitte beide Daten angeben.
        span.text-caption(v-else) Zeitraum wählen, um zu sehen, was frei ist.

  .d-flex.align-center.flex-wrap.ga-4.mb-4
    ec-search(label='Material suchen', @suche='suche = $event', style='max-width: 320px')
    v-select(
      v-if='stammdaten && stammdaten.kategorien.length',
      v-model='kategorie',
      :items='kategorieItems',
      label='Kategorie',
      density='compact',
      hide-details,
      clearable,
      style='max-width: 220px'
    )
    v-chip-group(
      v-if='stammdaten && stammdaten.referenten',
      v-model='bereich',
      mandatory,
      selected-class='text-primary'
    )
      v-chip(value='alle', size='small', filter) Alles
      v-chip(value='allgemein', size='small', filter) Allgemein
      v-chip(value='referenten', size='small', filter) Speziell
    v-spacer
    span.text-caption(v-if='material') {{ zaehler }}
    //- Vorlagen: fertige Materiallisten (z. B. Teencamp-Grundliste), die der
    //- Materialwart pflegt. Laden füllt die Auswahl, der Antrag geht dann wie
    //- gewohnt weiter.
    v-menu(v-model='vorlagenOffen', :close-on-content-click='true')
      template(#activator='{ props: menuProps }')
        v-btn(
          v-bind='menuProps',
          variant='text',
          size='small',
          prepend-icon='bookmarks',
          :disabled='!material'
        ) Vorlagen
      v-list(density='compact', min-width='280')
        v-list-subheader Vorlage laden
        v-list-item(v-if='vorlagenLaedt', disabled)
          v-list-item-title
            v-progress-circular(indeterminate, size='16', width='2')
            span.ml-2 Lade …
        v-list-item(v-else-if='vorlagen && !vorlagen.length', disabled)
          v-list-item-title Noch keine Vorlagen
        v-list-item(
          v-for='v in vorlagen ?? []',
          :key='v.materialVorlageID',
          @click='vorlageAnwenden(v)'
        )
          template(#prepend)
            v-icon bookmark
          v-list-item-title
            | {{ v.name }}
            v-chip.ml-2(v-if='v.bereich === "referenten"', size='x-small', variant='outlined') Speziell
          v-list-item-subtitle
            | {{ v.positionen.length }} {{ v.positionen.length === 1 ? 'Position' : 'Positionen' }}
            span(v-if='v.beschreibung')  · {{ v.beschreibung }}
    v-btn(
      variant='text',
      size='small',
      prepend-icon='download',
      :disabled='!gefiltert.length',
      @click='csv'
    ) CSV

  v-progress-linear(v-if='laedtGerade', indeterminate, color='primary')

  v-alert(v-if='abgewiesen', type='info', variant='tonal') {{ abgewiesen }}

  //- Ergebnis des Vorlage-Ladens: was übernommen wurde, was gekürzt und was
  //- gar nicht ging. Bleibt stehen, bis man es wegklickt -- sonst übersieht
  //- man, dass der Beamer fehlt.
  v-alert.mb-4(
    v-if='vorlageHinweis',
    type='info',
    variant='tonal',
    closable,
    @click:close='vorlageHinweis = ""'
  ) {{ vorlageHinweis }}

  v-alert.mb-4(v-if='material && !gefiltert.length', type='info', variant='tonal')
    span(v-if='suche || kategorie || bereich !== "alle"') Kein Material passt zu den Filtern.
    span(v-else) Es ist noch kein Material eingetragen.

  v-list(v-if='gefiltert.length', lines='three', border, rounded)
    //- Klick auf die Zeile oeffnet das Detail (grosses Foto, ganze
    //- Beschreibung); Haken und Mengenfeld rechts stoppen den Klick.
    v-list-item(
      v-for='m in gefiltert',
      :key='m.materialID',
      :class='{ "bg-green-lighten-5": auswahl.has(m.materialID) }',
      @click='detailDialog?.show(m)'
    )
      template(#prepend)
        ec-material-foto.mr-3(
          :material-i-d='m.materialID',
          :name='m.name',
          :hat-foto='m.hatFoto',
          :foto-stand='m.fotoStand',
          :klickbar='false'
        )
      v-list-item-title
        | {{ m.name }}
        v-chip.ml-2(v-if='m.bereich === "referenten"', size='x-small', variant='outlined') Speziell
      v-list-item-subtitle
        div(v-if='m.kategorie || m.lagerort') {{ untertitel(m) }}
        div(v-if='m.beschreibung') {{ m.beschreibung }}
        .d-flex.flex-wrap.ga-1.mt-1
          v-chip(size='x-small', variant='tonal') Bestand {{ m.bestand }}
          template(v-if='m.frei !== null')
            v-chip(size='x-small', :color='m.frei > 0 ? "success" : "error"', variant='flat')
              | {{ m.frei > 0 ? `${m.frei} frei` : 'reserviert' }}
            v-chip(v-if='m.angefragt', size='x-small', color='warning', variant='flat')
              | {{ m.angefragt }} angefragt
      template(#append)
        .d-flex.align-center.ga-2(@click.stop)
          v-text-field(
            v-if='auswahl.has(m.materialID)',
            :model-value='auswahl.get(m.materialID)',
            type='number',
            min='1',
            :max='maxMenge(m)',
            density='compact',
            hide-details,
            variant='outlined',
            label='Anzahl',
            style='width: 90px',
            @update:model-value='(v) => mengeSetzen(m, v)'
          )
          v-checkbox-btn(
            :model-value='auswahl.has(m.materialID)',
            :disabled='maxMenge(m) < 1',
            :title='maxMenge(m) < 1 ? "Im gewählten Zeitraum nicht verfügbar" : "Auswählen"',
            @update:model-value='(v) => umschalten(m, v)'
          )

  //- Bleibt beim Scrollen unten stehen: die Auswahl kann über die ganze Liste
  //- verteilt sein, der Knopf soll trotzdem immer erreichbar sein.
  v-sheet.pa-3.mt-4.d-flex.align-center.flex-wrap.ga-3(
    v-if='auswahl.size',
    border,
    rounded,
    elevation='4',
    style='position: sticky; bottom: 0; z-index: 2'
  )
    span
      strong {{ auswahl.size }}
      |  {{ auswahl.size === 1 ? 'Position' : 'Positionen' }} · {{ gesamtStueck }} Stück
    v-spacer
    span.text-caption(v-if='!zeitraum') Bitte zuerst den Zeitraum wählen.
    v-btn(variant='text', size='small', @click='auswahl.clear()') Auswahl leeren
    v-btn(
      variant='flat',
      v-accent-bg,
      v-white,
      prepend-icon='send',
      :disabled='!zeitraum',
      @click='antragDialog.show()'
    ) Antrag stellen

  material-detail(
    ref='detailDialog',
    :menge='detailMenge',
    :max-menge='detailMax',
    :zeitraum-text='zeitraumText',
    @auswaehlen='(m) => umschalten(m, true)',
    @entfernen='(m) => umschalten(m, false)',
    @menge='mengeSetzen'
  )

  material-antrag(
    v-if='stammdaten && material',
    ref='antragDialog',
    :me='me',
    :zeitraum='zeitraum',
    :kreise='stammdaten.kreise',
    :positionen='ausgewaehlt',
    @entfernt='(id) => auswahl.delete(id)',
    @gespeichert='gespeichert'
  )
</template>

<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import materialAntrag from '../../../../lib/materialAntrag.lib.vue'
import materialDetail from '../../../../lib/materialDetail.lib.vue'
import { useApi } from '../../../../plugins/api'
import type { PortalMe } from '../../../../plugins/auth'
import { useRouter } from '../../../../plugins/router'
import { useStorage } from '../../../../storage'
import filterGenerator from '../../../../util/filter.util'
import { csvExport, heuteISO } from '../../../../util/csv.util'
import { useMaterialFotos } from '../../../../util/materialFoto.util'
import type {
  Material,
  Stammdaten,
  Vorlage
} from '../../../../util/material.types'

/**
 * Materialkatalog mit Warenkorb.
 *
 * Der Zeitraum steht oben und wird im localStorage gemerkt: wer erst stöbert,
 * dann den Antrag stellt, tippt ihn nicht zweimal. Erst mit Zeitraum liefert
 * die API frei/angefragt -- vorher nur den Bestand. Die Auswahl lebt in einer
 * Map und überlebt Filter und Suche; der sticky Fuß zeigt sie an.
 *
 * Der zweite Bereich („Referenten“: Drucker, Stifte) kommt nur für Leitung,
 * Materialwarte und Superuser überhaupt von der API; die Chips dafür
 * erscheinen nur dann.
 */
const props = defineProps<{ me: PortalMe }>()

const api = useApi()
const { navigate } = useRouter()
const { materialVon, materialBis } = useStorage()
const fotos = useMaterialFotos()
const antragDialog =
  useTemplateRef<InstanceType<typeof materialAntrag>>('antragDialog')
const detailDialog =
  useTemplateRef<InstanceType<typeof materialDetail>>('detailDialog')

const heute = new Date().toISOString().slice(0, 10)
const von = materialVon
const bis = materialBis

const suche = ref('')
const kategorie = ref<number | null>(null)
const bereich = ref<'alle' | 'allgemein' | 'referenten'>('alle')

const stammdaten = ref<Stammdaten | null>(null)
const material = ref<Material[] | null>(null)
const laedtGerade = ref(false)
const abgewiesen = ref('')

const vorlagenOffen = ref(false)
const vorlagen = ref<Vorlage[] | null>(null)
const vorlagenLaedt = ref(false)
const vorlageHinweis = ref('')

/** materialID -> Menge */
const auswahl = reactive(new Map<number, number>())

/** Dieselben Grenzen wie die API (MAX_ZEITRAUM_TAGE in EC-Api src/material/config.ts). */
const MAX_TAGE = 366

function tageZwischen(a: string, b: string) {
  const [aj, am, at] = a.split('-').map(Number)
  const [bj, bm, bt] = b.split('-').map(Number)
  return Math.round(
    (Date.UTC(bj, bm - 1, bt) - Date.UTC(aj, am - 1, at)) / 86400000
  )
}

/**
 * Warum der eingetippte Zeitraum nicht taugt -- oder leer. Die Prüfung läuft
 * hier und nicht erst in der API: das Datumsfeld lässt jede Eingabe zu (die
 * min-Grenze hält nur den Picker auf), und ein Tippfehler im Jahr ließ vorher
 * die ganze Liste hinter einer Fehlermeldung verschwinden.
 */
const zeitraumFehler = computed(() => {
  if (!von.value || !bis.value) return ''
  if (von.value < heute)
    return 'Der Zeitraum darf nicht in der Vergangenheit beginnen.'
  if (bis.value < von.value) return 'Das Ende liegt vor dem Anfang.'
  // Wie die API: Differenz der Tage, nicht die inklusive Anzahl.
  if (tageZwischen(von.value, bis.value) > MAX_TAGE) {
    return `Ein Zeitraum darf höchstens ${MAX_TAGE} Tage umfassen.`
  }
  return ''
})

/** Nur ein vollständiger, plausibler Zeitraum zählt; sonst lädt die Liste ohne Verfügbarkeit. */
const zeitraum = computed(() => {
  if (!von.value || !bis.value || zeitraumFehler.value) return null
  return { von: von.value, bis: bis.value }
})

function deutsch(iso: string) {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}
const zeitraumText = computed(() =>
  zeitraum.value
    ? `${deutsch(zeitraum.value.von)} – ${deutsch(zeitraum.value.bis)}`
    : ''
)

const kategorieItems = computed(() =>
  (stammdaten.value?.kategorien ?? []).map((k) => ({
    value: k.materialKategorieID,
    title: k.bezeichnung
  }))
)

const gefiltert = computed(() => {
  let liste = material.value ?? []
  if (kategorie.value) {
    liste = liste.filter((m) => m.materialKategorieID === kategorie.value)
  }
  if (bereich.value !== 'alle') {
    liste = liste.filter((m) => m.bereich === bereich.value)
  }
  // Nur über die sichtbaren Felder suchen -- die Zahlen (IDs, Bestand)
  // würden sonst „7“ überall treffen.
  const f = filterGenerator(suche.value)
  return liste.filter((m) =>
    f({
      name: m.name,
      beschreibung: m.beschreibung,
      lagerort: m.lagerort,
      kategorie: m.kategorie ?? ''
    })
  )
})

/** Exportiert, was gerade gefiltert zu sehen ist -- mit Verfügbarkeit, falls ein Zeitraum gewählt ist. */
function csv() {
  const mitZeitraum = !!zeitraum.value
  const kopf = [
    'Name',
    'Kategorie',
    'Bereich',
    'Bestand',
    'Lagerort',
    'Beschreibung'
  ]
  if (mitZeitraum) kopf.push('Zeitraum', 'Reserviert', 'Angefragt', 'Frei')
  const zeilen = gefiltert.value.map((m) => {
    const z: unknown[] = [
      m.name,
      m.kategorie ?? '',
      m.bereich === 'referenten' ? 'Speziell' : 'Allgemein',
      m.bestand,
      m.lagerort,
      m.beschreibung
    ]
    if (mitZeitraum) {
      z.push(
        zeitraumText.value,
        m.reserviert ?? '',
        m.angefragt ?? '',
        m.frei ?? ''
      )
    }
    return z
  })
  csvExport(`Material-${heuteISO()}`, kopf, zeilen)
}

const zaehler = computed(() => {
  const alle = material.value?.length ?? 0
  return gefiltert.value.length === alle
    ? `${alle} Materialien`
    : `${gefiltert.value.length} von ${alle}`
})

const ausgewaehlt = computed(() =>
  (material.value ?? [])
    .filter((m) => auswahl.has(m.materialID))
    .map((m) => ({ material: m, menge: auswahl.get(m.materialID) ?? 1 }))
)

const gesamtStueck = computed(() =>
  ausgewaehlt.value.reduce((s, p) => s + p.menge, 0)
)

function untertitel(m: Material) {
  const teile: string[] = []
  if (m.kategorie) teile.push(m.kategorie)
  if (m.lagerort) teile.push(`Lagerort: ${m.lagerort}`)
  return teile.join(' · ')
}

/**
 * Der Detaildialog kennt nur „sein“ Material; Menge und Obergrenze kommen
 * reaktiv von hier, damit ein Haken im Dialog sofort in der Liste steht und
 * umgekehrt.
 */
const detailMaterial = computed(
  () => (detailDialog.value as any)?.material as Material | null | undefined
)
const detailMenge = computed(() => {
  const m = detailMaterial.value
  return m && auswahl.has(m.materialID)
    ? (auswahl.get(m.materialID) ?? 1)
    : null
})
const detailMax = computed(() =>
  detailMaterial.value ? maxMenge(detailMaterial.value) : 0
)

/** Obergrenze fürs Mengenfeld: frei im Zeitraum, sonst der Bestand. */
function maxMenge(m: Material) {
  return m.frei !== null ? m.frei : m.bestand
}

function umschalten(m: Material, an: boolean) {
  if (an) auswahl.set(m.materialID, 1)
  else auswahl.delete(m.materialID)
}

function mengeSetzen(m: Material, wert: string | number) {
  const n = Math.floor(Number(wert))
  if (!Number.isFinite(n) || n < 1) return
  auswahl.set(m.materialID, Math.min(n, Math.max(maxMenge(m), 1)))
}

/** Vorlagen erst beim ersten Öffnen des Menüs holen -- die meisten brauchen sie nie. */
async function ladeVorlagen() {
  if (vorlagen.value || vorlagenLaedt.value) return
  vorlagenLaedt.value = true
  try {
    const res = await api.get<{ vorlagen: Vorlage[] }>(
      '/portal/material/vorlagen',
      { quiet: true }
    )
    vorlagen.value = res.vorlagen
  } catch {
    vorlagen.value = []
  } finally {
    vorlagenLaedt.value = false
  }
}
watch(vorlagenOffen, (o) => {
  if (o) ladeVorlagen()
})

/**
 * Vorlage in die Auswahl übernehmen. Die Vorlage ist eine Wunschliste, der
 * Katalog die Wirklichkeit: Mengen werden auf das Freie gekürzt, was im
 * Zeitraum belegt, archiviert oder für diese Person unsichtbar ist, fällt
 * weg. Bestehende Auswahl bleibt; gleiche Materialien bekommen die Menge
 * der Vorlage. Der Hinweis nennt alles, was nicht 1:1 übernommen wurde.
 */
function vorlageAnwenden(v: Vorlage) {
  const liste = material.value ?? []
  const uebernommen: string[] = []
  const gekuerzt: string[] = []
  const belegt: string[] = []
  const fehlt: string[] = []
  for (const p of v.positionen) {
    const m = liste.find((x) => x.materialID === p.materialID)
    if (!m) {
      fehlt.push(p.name)
      continue
    }
    const max = maxMenge(m)
    if (max < 1) {
      belegt.push(m.name)
      continue
    }
    const menge = Math.min(p.menge, max)
    auswahl.set(m.materialID, menge)
    uebernommen.push(m.name)
    if (menge < p.menge) gekuerzt.push(`${m.name} (${p.menge} → ${menge})`)
  }
  const teile = [
    `Vorlage „${v.name}“: ${uebernommen.length} ${uebernommen.length === 1 ? 'Position' : 'Positionen'} übernommen`
  ]
  if (gekuerzt.length) teile.push(`gekürzt: ${gekuerzt.join(', ')}`)
  if (belegt.length) teile.push(`im Zeitraum belegt: ${belegt.join(', ')}`)
  if (fehlt.length) teile.push(`nicht verfügbar: ${fehlt.join(', ')}`)
  vorlageHinweis.value = teile.join(' · ')
}

async function ladeStammdaten() {
  try {
    stammdaten.value = await api.get<Stammdaten>(
      '/portal/material/stammdaten',
      {
        quiet: true
      }
    )
  } catch (err: any) {
    abgewiesen.value =
      err?.status === 503
        ? 'Die Materialausleihe ist noch nicht eingerichtet.'
        : 'Der Katalog konnte nicht geladen werden.'
  }
}

async function laden() {
  laedtGerade.value = true
  abgewiesen.value = ''
  try {
    const q = zeitraum.value
      ? `?von=${zeitraum.value.von}&bis=${zeitraum.value.bis}`
      : ''
    const res = await api.get<{ material: Material[] } | Material[]>(
      `/portal/material${q}`,
      { quiet: true }
    )
    material.value = Array.isArray(res) ? res : res.material
    // Mengen einkürzen, falls im neuen Zeitraum weniger frei ist.
    for (const m of material.value) {
      if (auswahl.has(m.materialID)) {
        if (maxMenge(m) < 1) auswahl.delete(m.materialID)
        else
          auswahl.set(
            m.materialID,
            Math.min(auswahl.get(m.materialID)!, maxMenge(m))
          )
      }
    }
  } catch (err: any) {
    material.value = null
    abgewiesen.value =
      err?.status === 503
        ? 'Die Materialausleihe ist noch nicht eingerichtet.'
        : err?.message || 'Der Katalog konnte nicht geladen werden.'
  } finally {
    laedtGerade.value = false
  }
}

function gespeichert(materialAntragID: number) {
  auswahl.clear()
  navigate({ path: `/material/antrag/${materialAntragID}` })
}

ladeStammdaten()
fotos.laden()
watch(zeitraum, laden, { immediate: true })

// Für den Typ-Check: me wird an den Dialog durchgereicht.
void props.me
</script>
