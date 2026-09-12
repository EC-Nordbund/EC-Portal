<template lang="pug">
div
  v-progress-linear(v-if='laedtGerade', indeterminate, color='primary')

  .d-flex.align-center.flex-wrap.ga-4.mb-4(v-if='daten')
    ec-search(label='Person suchen', @suche='suche = $event')
    v-btn-toggle(v-model='gruppe', density='compact', mandatory, variant='outlined')
      v-btn(value='fest', size='small') Angemeldet
      v-btn(value='warteliste', size='small') Warteliste
      v-btn(value='abgemeldet', size='small') Abgemeldet
    v-spacer
    span.text-caption {{ zaehler }}
    //- close-on-content-click MUSS aus: die Vorlagen sind aufklappbare Gruppen,
    //- und mit dem Standardverhalten schliesst sich das Menue schon beim Klick
    //- auf die Vorlage -- die Wartelisten-Varianten waeren nie erreichbar.
    //- Nach der Auswahl schliesst es der Klick-Handler selbst.
    v-menu(v-model='menuOffen', :close-on-content-click='false')
      template(#activator='{ props }')
        v-btn(
          v-bind='props',
          variant='text',
          size='small',
          prepend-icon='download',
          :loading='exportLaeuft',
          :disabled='!daten'
        ) Excel-Liste
      v-list(density='compact')
        v-list-subheader Vorlage wählen
        v-list-group(v-for='t in vorlagen', :key='t.name', :value='t.name')
          template(#activator='{ props }')
            v-list-item(v-bind='props', :title='t.label')
          v-list-item(
            v-for='(f, key) in varianten',
            :key='key',
            :title='f',
            @click='exportiere(t.name, key)'
          )
        v-divider
        v-list-item(
          title='Alle Vorlagen (mit und ohne Warteliste)',
          @click='exportiereAlle'
        )

  v-alert.mb-4(v-if='daten && !gefiltert.length', type='info', variant='tonal')
    | Keine Anmeldungen in dieser Ansicht.

  v-table(v-if='gefiltert.length', density='compact', hover)
    thead
      tr
        th Rolle
        th Name
        th Geburtstag
        th(v-if='umfang === "voll"') Adresse
        th Kontakt
        th(v-if='umfang === "kueche"') Essen
    tbody
      tr(v-for='a in gefiltert', :key='a.anmeldeID')
        td
          v-chip(size='x-small', :variant='a.position > 1 ? "flat" : "outlined"')
            | {{ rolle(a.position) }}
        td {{ a.person.vorname }} {{ a.person.nachname }}
        td {{ a.person.gebDat ? a.person.gebDat.german : '—' }}
        td.text-caption(v-if='umfang === "voll"')
          | {{ a.adresse.strasse }}, {{ a.adresse.plz }} {{ a.adresse.ort }}
        td.text-caption
          div(v-if='a.telefon.telefon') {{ a.telefon.telefon }}
          div(v-if='a.email.eMail') {{ a.email.eMail }}
        td.text-caption(v-if='umfang === "kueche"')
          v-chip(v-if='a.vegetarisch', size='x-small', variant='tonal') vegetarisch
          span.text-medium-emphasis(v-else) —

  v-alert.mt-4(type='info', variant='tonal', density='compact')
    span(v-if='umfang === "kueche"')
      | Als Küchenleitung siehst du die Küchenliste dieser Freizeit. Allergien
      | und Ernährungshinweise stehen in der Excel-Liste — sie werden erst beim
      | Herunterladen geladen.
    span(v-else)
      | Gesundheitsangaben und Allergien sind in dieser Ansicht bewusst
      | ausgeblendet. Sie stehen in den Excel-Listen — dort werden sie erst
      | beim Herunterladen geladen.
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useApi } from '../../../../../plugins/api'
import { useRouter } from '../../../../../plugins/router'
import { useStorage } from '../../../../../storage'
import { useDialog } from '../../../../../plugins/dialog'
import filterGenerator from '../../../../../util/filter.util'
import type { PortalMe } from '../../../../../plugins/auth'
import {
  generate,
  getTemplates,
  wListFilter,
  type TnListTemplate
} from '../../../../../tnList'

/**
 * Teilnehmerliste als Web-Ansicht.
 *
 * Lädt bewusst mit `felder=basis`: Gesundheitsangaben, Allergien und
 * Bemerkungen sind besondere Kategorien personenbezogener Daten (DSGVO Art. 9)
 * und überwiegend die von Minderjährigen. Sie gehen erst über die Leitung,
 * wenn jemand die Excel-Liste tatsächlich exportiert -- nicht schon beim
 * Öffnen der Seite.
 */
const props = defineProps<{ me: PortalMe }>()

const api = useApi()
const { route } = useRouter()
const { authToken } = useStorage()
const { error, notifyInfo } = useDialog()

const daten = ref<any>(null)
const laedtGerade = ref(false)
const suche = ref('')
const gruppe = ref<'fest' | 'warteliste' | 'abgemeldet'>('fest')

const id = computed(() => parseInt(route.value.params.id as string, 10))

const ROLLEN = [
  'Teilnehmer',
  'Mitarbeiter',
  'Küchenmitarbeiter',
  'Küchenleitung',
  'Leitung',
  'Hauptleitung'
]
const rolle = (p: number) => ROLLEN[p - 1] ?? `Position ${p}`

const nachGruppe = computed(() => {
  if (!daten.value) return []
  return daten.value.anmeldungen.filter((a: any) => {
    if (gruppe.value === 'fest') return a.wartelistenPlatz === 0
    if (gruppe.value === 'warteliste') return a.wartelistenPlatz > 0
    return a.wartelistenPlatz < 0
  })
})

const gefiltert = computed(() =>
  nachGruppe.value.filter(filterGenerator(suche.value))
)

/**
 * Was die angemeldete Person bei dieser Freizeit darf. Die Küchenleitung
 * bekommt vom Server ein reduziertes Feldset — Adressen und Geschlecht fehlen
 * dort, deshalb richten sich Spalten und Zähler danach.
 */
const umfang = computed(
  () =>
    props.me.veranstaltungen.find((v) => v.veranstaltungsID === id.value)
      ?.umfang ?? 'voll'
)

const zaehler = computed(() => {
  const l = nachGruppe.value
  if (umfang.value === 'kueche') {
    const veg = l.filter((a: any) => a.vegetarisch).length
    return `${l.length} gesamt · ${veg} vegetarisch`
  }
  const m = l.filter((a: any) => a.person.geschlecht === 'm').length
  const w = l.filter((a: any) => a.person.geschlecht === 'w').length
  return `${l.length} gesamt · ${m} m · ${w} w`
})

/**
 * Der volle Datensatz (mit Gesundheitsangaben) wird nur fuer den Export
 * geholt und dann wiederverwendet. Deklaration muss VOR laden() stehen: der
 * watch unten laeuft mit immediate und wuerde sonst in die temporale Todzone
 * von `let` greifen.
 */
let vollDaten: any = null

async function laden() {
  vollDaten = null
  laedtGerade.value = true
  try {
    daten.value = await api.get(
      `/portal/veranstaltung/${id.value}/tnliste?felder=basis`
    )
  } finally {
    laedtGerade.value = false
  }
}

watch(id, laden, { immediate: true })

/* ----------------------------------------------------------- XLSX-Export -- */

const vorlagen = ref<TnListTemplate[]>([])
const exportLaeuft = ref(false)
const menuOffen = ref(false)

const varianten: Record<string, string> = {
  'ohne-warteliste': 'ohne Warteliste',
  'mit-warteliste': 'mit Warteliste',
  'nur-warteliste': 'nur Warteliste',
  'nur-abgemeldete': 'nur Abgemeldete'
}

onMounted(async () => {
  try {
    vorlagen.value = await getTemplates(authToken.value)
  } catch (err: any) {
    error({
      text: err.message || String(err),
      title: 'Vorlagen konnten nicht geladen werden'
    })
  }
})

/**
 * Für den Export braucht es den vollen Datensatz -- die Web-Ansicht lädt
 * bewusst ohne Gesundheitsangaben. Einmal geholt, danach beliebig oft
 * gerendert; die Verwaltung fragt pro Vorlage neu ab, was mit einem
 * Rate-Limit nicht funktioniert.
 */
async function holeVoll() {
  if (!vollDaten) {
    vollDaten = await api.get(
      `/portal/veranstaltung/${id.value}/tnliste?felder=voll`
    )
  }
  return vollDaten
}

async function exportiere(template: string, variante: string) {
  menuOffen.value = false
  exportLaeuft.value = true
  try {
    const d = await holeVoll()
    await generate(
      d,
      template,
      authToken.value,
      wListFilter[variante],
      variante
    )
  } catch (err: any) {
    error({ text: err.message || String(err), title: 'Export fehlgeschlagen' })
  } finally {
    exportLaeuft.value = false
  }
}

/**
 * Alle Vorlagen nacheinander. Bewusst sequenziell: parallel gestartete
 * Downloads blockt der Browser reihenweise.
 */
async function exportiereAlle() {
  menuOffen.value = false
  exportLaeuft.value = true
  try {
    const d = await holeVoll()
    for (const t of vorlagen.value) {
      for (const v of ['ohne-warteliste', 'mit-warteliste']) {
        await generate(d, t.name, authToken.value, wListFilter[v], v)
      }
    }
    notifyInfo(`${vorlagen.value.length * 2} Listen erzeugt.`)
  } catch (err: any) {
    error({ text: err.message || String(err), title: 'Export fehlgeschlagen' })
  } finally {
    exportLaeuft.value = false
  }
}
</script>
