<template lang="pug">
v-dialog(v-model='offen', max-width='760', scrollable)
  v-card(v-if='material')
    //- Grosses Foto oben; solange es laedt, die Vorschau aus dem Cache.
    v-sheet.d-flex.align-center.justify-center(
      v-if='material.hatFoto',
      color='grey-lighten-4',
      height='360'
    )
      img(
        v-if='vollbild || vorschau',
        :src='vollbild || vorschau',
        :alt='material.name',
        style='max-width: 100%; max-height: 360px; object-fit: contain'
      )
      v-progress-circular(v-else, indeterminate, color='primary')
    v-card-title.d-flex.align-center
      span.text-wrap {{ material.name }}
      v-spacer
      v-btn(icon, variant='text', @click='offen = false')
        v-icon close
    v-card-text
      .d-flex.flex-wrap.ga-1.mb-3
        v-chip(v-if='material.kategorie', size='small', variant='tonal', prepend-icon='label') {{ material.kategorie }}
        v-chip(size='small', variant='outlined') {{ material.bereich === 'referenten' ? 'Speziell' : 'Allgemein' }}
        v-chip(size='small', variant='tonal') Bestand {{ material.bestand }}
        template(v-if='material.frei !== null')
          v-chip(size='small', :color='material.frei > 0 ? "success" : "error"', variant='flat')
            | {{ material.frei > 0 ? `${material.frei} frei` : 'reserviert' }}
          v-chip(v-if='material.angefragt', size='small', color='warning', variant='flat')
            | {{ material.angefragt }} angefragt
      p.text-body-1(v-if='material.beschreibung', style='white-space: pre-line') {{ material.beschreibung }}
      p.text-medium-emphasis(v-else) Keine Beschreibung hinterlegt.
      v-table.mt-2(density='compact')
        tbody
          tr
            td.text-medium-emphasis(style='width: 160px') Lagerort
            td {{ material.lagerort || '—' }}
          tr(v-if='zeitraumText')
            td.text-medium-emphasis Zeitraum
            td {{ zeitraumText }}
    v-divider
    v-card-actions
      //- Auswahl direkt aus dem Dialog: Menge und Haken wie in der Liste.
      template(v-if='menge !== null')
        v-text-field(
          :model-value='menge',
          type='number',
          min='1',
          :max='maxMenge',
          density='compact',
          hide-details,
          variant='outlined',
          label='Anzahl',
          style='max-width: 110px',
          @update:model-value='(v) => emit("menge", material, v)'
        )
        v-btn(variant='text', @click='emit("entfernen", material)') Aus Auswahl entfernen
      v-btn(
        v-else,
        variant='flat',
        v-accent-bg,
        v-white,
        prepend-icon='add_shopping_cart',
        :disabled='maxMenge < 1',
        @click='emit("auswaehlen", material)'
      ) {{ maxMenge < 1 ? 'Im Zeitraum nicht verfügbar' : 'Auswählen' }}
      v-spacer
      v-btn(variant='text', @click='offen = false') Schließen
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useApi } from '../plugins/api'
import { useMaterialFotos } from '../util/materialFoto.util'
import type { Material } from '../util/material.types'

/**
 * Detailansicht eines Materials im Katalog: grosses Foto, Beschreibung in
 * voller Laenge, Verfuegbarkeit -- und die Auswahl gleich mit, damit man
 * nicht zum Auswaehlen wieder in die Liste zurueck muss.
 *
 * Das grosse Foto kommt per requestBlob (ein img-Tag koennte den Token nicht
 * mitschicken); bis es da ist, steht die kleine Vorschau aus dem Cache.
 */
const props = defineProps<{
  /** Menge in der Auswahl oder null, wenn nicht ausgewaehlt. */
  menge: number | null
  maxMenge: number
  zeitraumText: string
}>()

const emit = defineEmits<{
  auswaehlen: [material: Material]
  entfernen: [material: Material]
  menge: [material: Material, wert: string | number]
}>()

const api = useApi()
const { vorschauen } = useMaterialFotos()

const offen = ref(false)
const material = ref<Material | null>(null)
const vollbild = ref<string | null>(null)

const vorschau = computed(() =>
  material.value ? (vorschauen.get(material.value.materialID) ?? null) : null
)

function freigeben() {
  if (vollbild.value) URL.revokeObjectURL(vollbild.value)
  vollbild.value = null
}

async function show(m: Material) {
  freigeben()
  material.value = m
  offen.value = true
  if (!m.hatFoto) return
  try {
    const { blob } = await api.requestBlob(
      `/portal/material/${m.materialID}/foto?v=${m.fotoStand ?? 0}`,
      { quiet: true }
    )
    // Inzwischen ein anderes Material geoeffnet? Dann gehoert das Bild nicht mehr hierher.
    if (material.value?.materialID !== m.materialID) return
    vollbild.value = URL.createObjectURL(blob)
  } catch {
    /* ohne grosses Foto bleibt die Vorschau stehen */
  }
}

watch(offen, (o) => {
  if (!o) freigeben()
})

// Fuer den Typ-Check: props werden nur im Template gelesen.
void props

// `material` mit nach draussen: der Katalog leitet daraus Menge/Obergrenze ab.
defineExpose({ show, material })
</script>
