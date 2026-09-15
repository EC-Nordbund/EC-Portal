<template lang="pug">
//- Vorschau eines Materials, optional mit Klick zum Vollbild.
v-avatar(
  v-bind='$attrs',
  :size='size',
  rounded,
  :color='vorschau ? undefined : "grey-lighten-3"',
  :style='{ cursor: vorschau && klickbar ? "zoom-in" : "default" }',
  @click.stop='oeffnen'
)
  v-img(v-if='vorschau', :src='vorschau', cover, :alt='name')
  v-icon(v-else, color='grey') image_not_supported

v-dialog(v-model='offen', max-width='900')
  v-card
    v-card-title.d-flex.align-center
      span {{ name }}
      v-spacer
      v-btn(icon, variant='text', @click='offen = false')
        v-icon close
    v-card-text.text-center
      v-progress-circular(v-if='laedt', indeterminate, color='primary')
      img(
        v-else-if='vollbild',
        :src='vollbild',
        :alt='name',
        style='max-width: 100%; max-height: 75vh'
      )
      v-alert(v-else, type='info', variant='tonal') Kein Foto vorhanden.
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useApi } from '../plugins/api'
import { useMaterialFotos } from '../util/materialFoto.util'

/**
 * Zeigt die Vorschau aus dem Sitzungs-Cache (useMaterialFotos). Das große
 * Foto wird erst beim Öffnen geholt -- per requestBlob, weil ein <img> den
 * Token nicht mitschickt -- und beim Schließen wieder freigegeben.
 */
// Zwei Wurzelknoten (Avatar + Dialog): class/style sollen auf den Avatar.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    materialID: number
    name: string
    hatFoto?: boolean
    /** Cache-Buster: ändert sich mit dem Foto (UNIX-Zeit von materialFoto.geaendert). */
    fotoStand?: number | null
    size?: number | string
    klickbar?: boolean
  }>(),
  { hatFoto: true, fotoStand: null, size: 56, klickbar: true }
)

const api = useApi()
const { vorschauen } = useMaterialFotos()

const vorschau = computed(() =>
  props.hatFoto ? (vorschauen.get(props.materialID) ?? null) : null
)

const offen = ref(false)
const laedt = ref(false)
const vollbild = ref<string | null>(null)

async function oeffnen() {
  if (!props.klickbar || !props.hatFoto) return
  offen.value = true
  if (vollbild.value) return
  laedt.value = true
  try {
    const { blob } = await api.requestBlob(
      `/portal/material/${props.materialID}/foto?v=${props.fotoStand ?? 0}`,
      { quiet: true }
    )
    vollbild.value = URL.createObjectURL(blob)
  } catch {
    vollbild.value = null
  } finally {
    laedt.value = false
  }
}

function freigeben() {
  if (vollbild.value) URL.revokeObjectURL(vollbild.value)
  vollbild.value = null
}

onBeforeUnmount(freigeben)
</script>
