<template lang="pug">
v-dialog(v-model='offen', max-width='520px')
  v-card
    v-card-title.d-flex.align-center
      span Kategorien
      v-spacer
      v-btn(icon, variant='text', @click='offen = false')
        v-icon close
    v-card-text
      v-alert.mb-3(type='info', variant='tonal', density='compact')
        | Kategorien gliedern den Katalog (Sport, Küche, Spiele …). Löschen geht
        | nur, solange kein Material die Kategorie benutzt.
      v-progress-linear(v-if='laedt', indeterminate, color='primary')
      v-list(density='compact')
        v-list-item(v-for='k in kategorien', :key='k.materialKategorieID')
          template(#prepend)
            v-icon label
          v-text-field(
            :model-value='k.bezeichnung',
            density='compact',
            variant='underlined',
            hide-details,
            :disabled='speichert',
            @change='(e) => umbenennen(k, e)'
          )
          template(#append)
            v-btn(
              icon,
              variant='text',
              size='small',
              :title='`„${k.bezeichnung}“ löschen`',
              :disabled='speichert',
              @click='loeschen(k)'
            )
              v-icon delete
        v-list-item(v-if='!laedt && !kategorien.length')
          v-list-item-title.text-medium-emphasis Noch keine Kategorien.
      v-form.mt-2(@submit.prevent='anlegen')
        .d-flex.align-center.ga-2
          v-text-field(
            v-model='neu',
            label='Neue Kategorie',
            density='compact',
            variant='outlined',
            hide-details,
            maxlength='80',
            :disabled='speichert'
          )
          v-btn(
            v-accent-bg,
            v-white,
            type='submit',
            :disabled='!neu.trim() || speichert',
            :loading='speichert'
          ) Anlegen
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '../plugins/api'
import { useDialog } from '../plugins/dialog'
import type { MaterialKategorie } from '../util/material.types'

/**
 * Kategorien pflegen: umbenennen direkt in der Zeile (Enter oder Feld
 * verlassen), anlegen unten, löschen rechts. Ein eigener Bearbeiten-Dialog
 * pro Kategorie wäre für ein einziges Textfeld nur im Weg.
 */
const emit = defineEmits<{ (e: 'geaendert'): void }>()
const api = useApi()
const { error, notifyInfo } = useDialog()

const offen = ref(false)
const laedt = ref(false)
const speichert = ref(false)
const kategorien = ref<MaterialKategorie[]>([])
const neu = ref('')

async function laden() {
  laedt.value = true
  try {
    const res = await api.get<{ kategorien: MaterialKategorie[] }>(
      '/portal/material/verwaltung/kategorie',
      { quiet: true }
    )
    kategorien.value = res.kategorien
  } catch (err: any) {
    error({ text: err.message || String(err), title: 'Laden fehlgeschlagen' })
  } finally {
    laedt.value = false
  }
}

function show() {
  neu.value = ''
  offen.value = true
  laden()
}

async function anlegen() {
  const bezeichnung = neu.value.trim()
  if (!bezeichnung || speichert.value) return
  speichert.value = true
  try {
    await api.post(
      '/portal/material/verwaltung/kategorie',
      { bezeichnung, sortierung: kategorien.value.length + 1 },
      { quiet: true }
    )
    neu.value = ''
    notifyInfo(`Kategorie „${bezeichnung}“ angelegt.`)
    await laden()
    emit('geaendert')
  } catch (err: any) {
    error({ text: err.message || String(err), title: 'Anlegen fehlgeschlagen' })
  } finally {
    speichert.value = false
  }
}

async function umbenennen(k: MaterialKategorie, e: Event) {
  const bezeichnung = (
    (e.target as HTMLInputElement | null)?.value ?? ''
  ).trim()
  if (!bezeichnung || bezeichnung === k.bezeichnung) return
  speichert.value = true
  try {
    await api.request(
      `/portal/material/verwaltung/kategorie/${k.materialKategorieID}`,
      { method: 'PATCH', body: { bezeichnung }, quiet: true }
    )
    notifyInfo(`„${k.bezeichnung}“ heißt jetzt „${bezeichnung}“.`)
    await laden()
    emit('geaendert')
  } catch (err: any) {
    error({
      text: err.message || String(err),
      title: 'Umbenennen fehlgeschlagen'
    })
    await laden()
  } finally {
    speichert.value = false
  }
}

async function loeschen(k: MaterialKategorie) {
  if (
    !window.confirm(
      `Kategorie „${k.bezeichnung}“ löschen?\n\nGeht nur, wenn kein Material sie benutzt – sonst erst umhängen.`
    )
  ) {
    return
  }
  speichert.value = true
  try {
    await api.request(
      `/portal/material/verwaltung/kategorie/${k.materialKategorieID}`,
      { method: 'DELETE', quiet: true }
    )
    notifyInfo(`Kategorie „${k.bezeichnung}“ gelöscht.`)
    await laden()
    emit('geaendert')
  } catch (err: any) {
    error({
      text: err.message || String(err),
      title: 'Löschen nicht möglich'
    })
  } finally {
    speichert.value = false
  }
}

defineExpose({ show })
</script>
