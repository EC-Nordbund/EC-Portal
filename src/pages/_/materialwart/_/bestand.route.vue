<template lang="pug">
div
  .d-flex.align-center.flex-wrap.ga-2.mb-2
    ec-search(label='Material suchen', @suche='suche = $event')
    v-select(
      v-model='bereichFilter',
      :items='BEREICH_ITEMS',
      density='compact',
      variant='outlined',
      hide-details,
      style='max-width: 200px'
    )
    v-select(
      v-model='kategorieFilter',
      :items='kategorieItems',
      label='Kategorie',
      density='compact',
      variant='outlined',
      hide-details,
      clearable,
      style='max-width: 200px'
    )
    v-checkbox(
      v-model='archivierteZeigen',
      label='Archivierte zeigen',
      density='compact',
      hide-details
    )
    v-spacer
    span.text-caption(v-if='daten') {{ zaehler }}
    v-btn(variant='text', size='small', prepend-icon='download', :disabled='!gefiltert.length', @click='csv') CSV
    v-btn(variant='tonal', size='small', prepend-icon='label', @click='kategorienDialog?.show()') Kategorien
    v-btn(
      variant='flat',
      v-accent-bg,
      v-white,
      size='small',
      prepend-icon='add',
      :disabled='!daten',
      @click='formDialog?.show(null)'
    ) Material

  v-progress-linear(v-if='laedt', indeterminate, color='primary')

  v-alert.mb-4(v-if='abgewiesen', type='warning', variant='tonal') {{ abgewiesen }}

  v-alert.mb-4(v-else-if='daten && !gefiltert.length', type='info', variant='tonal')
    span(v-if='suche || kategorieFilter || bereichFilter !== "alle"') Kein Material passt zu den Filtern.
    span(v-else) Noch kein Material angelegt – über „Material“ oben rechts geht es los.

  v-table(v-if='gefiltert.length', density='compact', hover)
    thead
      tr
        th(style='width: 56px')
        th Material
        th Kategorie
        th Bereich
        th.text-right Anzahl
        th Lagerort
        th Freigegeben
        th
    tbody
      tr(
        v-for='m in gefiltert',
        :key='m.materialID',
        :class='{ "text-medium-emphasis": !m.aktiv }'
      )
        td
          ec-material-foto(
            :material-i-d='m.materialID',
            :name='m.name',
            :hat-foto='m.hatFoto',
            :foto-stand='m.fotoStand',
            :size='40'
          )
        td
          div
            | {{ m.name }}
            v-chip.ml-2(v-if='!m.aktiv', size='x-small', variant='outlined') archiviert
          .text-caption.text-medium-emphasis(v-if='m.beschreibung', style='max-width: 360px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis') {{ m.beschreibung }}
        td {{ m.kategorie || '—' }}
        td
          v-chip(size='x-small', variant='tonal', :color='m.bereich === "referenten" ? "info" : undefined') {{ m.bereich === 'referenten' ? 'Speziell' : 'Allgemein' }}
        td.text-right {{ m.bestand }}
        td {{ m.lagerort || '—' }}
        td
          v-switch(
            :model-value='m.freigegeben',
            color='primary',
            density='compact',
            hide-details,
            :disabled='!m.aktiv',
            :title='m.freigegeben ? "Im Katalog sichtbar" : "Nur für Materialwarte sichtbar"',
            @update:model-value='(v) => freigabe(m, !!v)'
          )
        td.text-right
          v-menu
            template(#activator='{ props: menuProps }')
              v-btn(v-bind='menuProps', icon, variant='text', size='small')
                v-icon more_vert
            v-list(density='compact')
              v-list-item(title='Bearbeiten', prepend-icon='edit', @click='formDialog?.show(m)')
              v-list-item(
                :title='m.hatFoto ? "Foto ersetzen" : "Foto hinzufügen"',
                prepend-icon='photo_camera',
                @click='formDialog?.show(m)'
              )
              v-list-item(
                v-if='m.aktiv',
                title='Archivieren',
                prepend-icon='archive',
                @click='archivieren(m)'
              )
              v-list-item(
                v-else,
                title='Wieder aktivieren',
                prepend-icon='unarchive',
                @click='reaktivieren(m)'
              )

  material-form(ref='formDialog', :kategorien='kategorien', @gespeichert='laden')
  material-kategorien(ref='kategorienDialog', @geaendert='laden')
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import materialForm from '../../../../lib/materialForm.lib.vue'
import materialKategorien from '../../../../lib/materialKategorien.lib.vue'
import { useApi } from '../../../../plugins/api'
import { useDialog } from '../../../../plugins/dialog'
import filterGenerator from '../../../../util/filter.util'
import { csvExport, heuteISO, jaNein } from '../../../../util/csv.util'
import { useMaterialFotos } from '../../../../util/materialFoto.util'
import type {
  MaterialKategorie,
  MaterialVerwaltung
} from '../../../../util/material.types'

/**
 * Bestandspflege des Materialwarts: alles, auch nicht Freigegebenes und
 * Archiviertes. Freigabe direkt in der Zeile (optimistisch, mit Rollback);
 * alles andere im Formular-Dialog. Gelöscht wird nie -- Antragspositionen
 * zeigen auf die Zeile --, sondern archiviert.
 */
const api = useApi()
const { error, notifyInfo } = useDialog()
const fotos = useMaterialFotos()
const formDialog =
  useTemplateRef<InstanceType<typeof materialForm>>('formDialog')
const kategorienDialog =
  useTemplateRef<InstanceType<typeof materialKategorien>>('kategorienDialog')

const BEREICH_ITEMS = [
  { value: 'alle', title: 'Alle Bereiche' },
  { value: 'allgemein', title: 'Allgemein' },
  { value: 'referenten', title: 'Speziell' }
]

const suche = ref('')
const bereichFilter = ref('alle')
const kategorieFilter = ref<number | null>(null)
const archivierteZeigen = ref(false)
const daten = ref<MaterialVerwaltung[] | null>(null)
const kategorien = ref<MaterialKategorie[]>([])
const laedt = ref(false)
const abgewiesen = ref('')

const kategorieItems = computed(() =>
  kategorien.value.map((k) => ({
    value: k.materialKategorieID,
    title: k.bezeichnung
  }))
)

const gefiltert = computed(() =>
  (daten.value ?? [])
    .filter((m) => archivierteZeigen.value || m.aktiv)
    .filter(
      (m) => bereichFilter.value === 'alle' || m.bereich === bereichFilter.value
    )
    .filter(
      (m) =>
        kategorieFilter.value === null ||
        m.materialKategorieID === kategorieFilter.value
    )
    .filter(filterGenerator(suche.value))
)

/** Exportiert die gefilterte Bestandsliste inklusive Pflege-Flags. */
function csv() {
  csvExport(
    `Materialbestand-${heuteISO()}`,
    [
      'ID',
      'Name',
      'Kategorie',
      'Bereich',
      'Bestand',
      'Lagerort',
      'Beschreibung',
      'Freigegeben',
      'Archiviert',
      'Foto'
    ],
    gefiltert.value.map((m) => [
      m.materialID,
      m.name,
      m.kategorie ?? '',
      m.bereich === 'referenten' ? 'Speziell' : 'Allgemein',
      m.bestand,
      m.lagerort,
      m.beschreibung,
      jaNein(m.freigegeben),
      jaNein(!m.aktiv),
      jaNein(m.hatFoto)
    ])
  )
}

const zaehler = computed(() => {
  const alle = daten.value ?? []
  const aktiv = alle.filter((m) => m.aktiv)
  const unfrei = aktiv.filter((m) => !m.freigegeben).length
  return unfrei
    ? `${aktiv.length} Materialien · ${unfrei} nicht freigegeben`
    : `${aktiv.length} Materialien`
})

async function laden() {
  laedt.value = true
  abgewiesen.value = ''
  try {
    const [res, kat] = await Promise.all([
      api.get<{ material: MaterialVerwaltung[] }>(
        '/portal/material/verwaltung/material',
        { quiet: true }
      ),
      api.get<{ kategorien: MaterialKategorie[] }>(
        '/portal/material/verwaltung/kategorie',
        { quiet: true }
      )
    ])
    daten.value = res.material
    kategorien.value = kat.kategorien
    // Vorschauen neu holen: nach einem Upload im Dialog stimmt der Cache
    // zwar schon, aber ein zweiter Materialwart hätte sonst alte Bilder.
    fotos.laden(true)
  } catch (err: any) {
    daten.value = null
    abgewiesen.value =
      err?.status === 403
        ? err.message
        : 'Der Bestand konnte nicht geladen werden.'
  } finally {
    laedt.value = false
  }
}

onMounted(laden)

function freigabe(m: MaterialVerwaltung, wert: boolean) {
  if (wert === m.freigegeben) return
  const vorher = m.freigegeben
  m.freigegeben = wert
  api
    .request(`/portal/material/verwaltung/material/${m.materialID}`, {
      method: 'PATCH',
      body: { freigegeben: wert },
      quiet: true
    })
    .then(() =>
      notifyInfo(
        wert
          ? `„${m.name}“ ist jetzt im Katalog sichtbar.`
          : `„${m.name}“ ist ausgeblendet.`
      )
    )
    .catch((err: any) => {
      m.freigegeben = vorher
      error({
        text: err.message || String(err),
        title: 'Speichern fehlgeschlagen'
      })
    })
}

function archivieren(m: MaterialVerwaltung) {
  if (
    !window.confirm(
      `„${m.name}“ archivieren?\n\nEs verschwindet aus dem Katalog und kann nicht mehr beantragt werden. Bestehende Anträge bleiben erhalten; du kannst es jederzeit wieder aktivieren.`
    )
  ) {
    return
  }
  api
    .request(`/portal/material/verwaltung/material/${m.materialID}`, {
      method: 'DELETE',
      quiet: true
    })
    .then(() => {
      notifyInfo(`„${m.name}“ archiviert.`)
      laden()
    })
    .catch((err: any) =>
      error({
        text: err.message || String(err),
        title: 'Archivieren fehlgeschlagen'
      })
    )
}

function reaktivieren(m: MaterialVerwaltung) {
  api
    .request(`/portal/material/verwaltung/material/${m.materialID}`, {
      method: 'PATCH',
      body: { aktiv: true },
      quiet: true
    })
    .then(() => {
      notifyInfo(`„${m.name}“ ist wieder aktiv.`)
      laden()
    })
    .catch((err: any) =>
      error({
        text: err.message || String(err),
        title: 'Aktivieren fehlgeschlagen'
      })
    )
}
</script>
