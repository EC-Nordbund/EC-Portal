<template lang="pug">
div
  .d-flex.align-center.flex-wrap.ga-4.mb-4
    ec-search(label='Datei suchen', @suche='suche = $event')

  v-progress-linear(v-if='laedtGerade', indeterminate, color='primary')

  v-alert.ma-4(
    v-if='daten && !gefiltert.length',
    type='info',
    variant='tonal'
  )
    | {{ suche ? 'Keine Datei passt zur Suche.' : 'Hier liegt noch nichts bereit.' }}

  div(v-for='bereich in gruppen', :key='bereich.schluessel')
    h3.text-h6.mt-4.mb-1 {{ bereich.name }}
    div(v-for='kategorie in bereich.kategorien', :key='kategorie.name')
      .text-caption.text-medium-emphasis.mt-3.mb-1(v-if='kategorie.name')
        | {{ kategorie.name }}
      v-list(lines='three', density='comfortable')
        v-list-item(
          v-for='d in kategorie.dateien',
          :key='d.downloadID',
          @click='herunterladen(d)'
        )
          template(#prepend)
            v-icon(:color='laeuftGerade === d.downloadID ? "primary" : undefined')
              | {{ symbol(d.mimetype) }}
          v-list-item-title {{ d.titel }}
          v-list-item-subtitle
            div(v-if='d.beschreibung') {{ d.beschreibung }}
            div.text-caption {{ d.dateiname }} · {{ groesse(d.groesse) }}
          template(#append)
            v-progress-circular(
              v-if='laeuftGerade === d.downloadID',
              indeterminate,
              size='20',
              width='2',
              color='primary'
            )
            v-icon(v-else) download
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApi } from '../../plugins/api'
import saveBlob from '../../util/download.util'
import filterGenerator from '../../util/filter.util'

/**
 * Downloads: Formulare und Merkblätter der Geschäftsstelle.
 *
 * Zwei Bereiche, die der Server nach Zuständigkeit ausliefert — „Für
 * Freizeiten" für Leitung, Hauptleitung und Küchenleitung, „Für EC-Kreise" für
 * die Verantwortlichen vor Ort. Was hier ankommt, ist bereits gefiltert; die
 * Datei selbst prüft der Server beim Abruf ein zweites Mal.
 */
const api = useApi()

const suche = ref('')
const daten = ref<any>(null)
const laedtGerade = ref(false)
const laeuftGerade = ref(0)

const gefiltert = computed(() => {
  if (!daten.value) return []
  return daten.value.dateien.filter(filterGenerator(suche.value))
})

/**
 * Nach Bereich und darin nach Kategorie gruppiert. Dateien ohne Kategorie
 * stehen oben ohne Zwischenüberschrift — eine Rubrik „Sonstiges" zu erfinden
 * wäre eine Behauptung über den Inhalt.
 */
const gruppen = computed(() => {
  if (!daten.value) return []

  return daten.value.bereiche
    .map((b: any) => {
      const eigene = gefiltert.value.filter(
        (d: any) => d.bereich === b.schluessel
      )
      const namen = [...new Set(eigene.map((d: any) => d.kategorie))].sort(
        (a: any, z: any) => String(a).localeCompare(String(z), 'de')
      )

      return {
        ...b,
        kategorien: namen.map((name: any) => ({
          name,
          dateien: eigene.filter((d: any) => d.kategorie === name)
        }))
      }
    })
    .filter((b: any) => b.kategorien.length)
})

function symbol(mimetype: string) {
  if (mimetype.includes('pdf')) return 'picture_as_pdf'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.includes('sheet') || mimetype.includes('excel')) {
    return 'table_view'
  }
  if (mimetype.includes('zip')) return 'folder_zip'
  return 'description'
}

function groesse(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function laden() {
  laedtGerade.value = true
  try {
    daten.value = await api.get('/portal/downloads')
  } finally {
    laedtGerade.value = false
  }
}

laden()

/**
 * Der Token steht im Authorization-Header, ein einfacher Link würde ihn nicht
 * mitschicken. Also holen und als Blob weiterreichen; der Dateiname kommt aus
 * Content-Disposition.
 */
async function herunterladen(d: any) {
  if (laeuftGerade.value) return
  laeuftGerade.value = d.downloadID
  try {
    const { blob, dateiname } = await api.requestBlob(
      `/portal/download/${d.downloadID}`
    )
    saveBlob(dateiname || d.dateiname, blob)
  } finally {
    laeuftGerade.value = 0
  }
}
</script>
