<template lang="pug">
ec-wrapper(
  title='Schutzkonzept-Formular',
  subTitle='Versionen',
  hasReload,
  @reload='laden'
)
  .d-flex.align-center.flex-wrap.ga-4.mb-4
    .text-body-2.text-medium-emphasis
      | Jede Version ist zunächst ein Entwurf. Nach dem Veröffentlichen ist sie
      | eingefroren; Änderungen gehen nur über eine neue Version, die alle
      | Inhalte und Vorlagen der letzten veröffentlichten übernimmt.
    v-spacer
    v-btn(
      variant='flat',
      v-accent-bg,
      v-white,
      prepend-icon='add',
      :disabled='!versionen || !!draft || laedt',
      :title='draft ? "Es gibt bereits einen Entwurf" : ""',
      @click='neueVersion'
    ) Neue Version

  v-progress-linear(v-if='laedt', indeterminate, color='primary')

  v-alert.mb-4(v-if='versionen && !versionen.length', type='info', variant='tonal')
    | Es gibt noch keine Formularversion. Lege die erste an.

  v-table(v-if='versionen && versionen.length', density='compact', hover)
    thead
      tr
        th Nr.
        th Status
        th Notiz
        th Erstellt
        th Veröffentlicht
        th.text-right Vorlagen
        th.text-right Stände
        th
    tbody
      tr(
        v-for='v in versionen',
        :key='v.formularVersionID',
        style='cursor: pointer',
        @click='oeffnen(v)'
      )
        td {{ v.versionNr }}
        td
          v-chip(
            v-if='v.status === "draft"',
            size='small',
            color='orange',
            variant='flat'
          ) Entwurf
          v-chip(
            v-else-if='v.formularVersionID === aktuellID',
            size='small',
            color='green',
            variant='flat'
          ) Aktuell
          v-chip(v-else, size='small', variant='tonal') Veröffentlicht
        td {{ v.notiz || '—' }}
        td.text-caption {{ datumZeit(v.erstellt) }}
          br
          | {{ v.erstelltVon }}
        td.text-caption
          template(v-if='v.publishedAm')
            | {{ datumZeit(v.publishedAm) }}
            br
            | {{ v.publishedVon }}
          span(v-else) —
        td.text-right {{ v.anzahlVorlagen }}
        td.text-right {{ v.anzahlStaende }}
        td.text-right(@click.stop)
          v-btn(
            v-if='v.status === "draft"',
            icon='delete',
            size='small',
            variant='text',
            title='Entwurf verwerfen',
            @click='verwerfen(v)'
          )
          v-btn(
            icon='chevron_right',
            size='small',
            variant='text',
            @click='oeffnen(v)'
          )
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useApi } from '../../../plugins/api'
import { useDialog } from '../../../plugins/dialog'
import { useRouter } from '../../../plugins/router'
import { datumZeit } from '../../../schutzkonzept/format'

/**
 * Versionsliste des Schutzkonzept-Formulars.
 *
 * Es gibt genau ein Formular; versioniert wird es als Ganzes, inklusive der
 * DOCX-Vorlagen. Höchstens ein Entwurf zur Zeit (erzwingt die Datenbank).
 */
interface Version {
  formularVersionID: number
  versionNr: number
  status: 'draft' | 'published'
  notiz: string
  revision: number
  erstellt: string
  erstelltVon: string
  publishedAm: string | null
  publishedVon: string | null
  anzahlVorlagen: number
  anzahlStaende: number
}

const api = useApi()
const { notifyInfo, error } = useDialog()
const { navigate } = useRouter()

const versionen = ref<Version[] | null>(null)
const laedt = ref(false)

const draft = computed(
  () => versionen.value?.find((v) => v.status === 'draft') ?? null
)
const aktuellID = computed(
  () =>
    versionen.value?.find((v) => v.status === 'published')?.formularVersionID ??
    null
)

async function laden() {
  laedt.value = true
  try {
    const r = await api.get<{ versionen: Version[] }>(
      '/portal/schutzkonzept/formular'
    )
    versionen.value = r.versionen
  } finally {
    laedt.value = false
  }
}

function oeffnen(v: Version) {
  navigate({ path: `/schutzkonzept/version/${v.formularVersionID}` })
}

async function neueVersion() {
  const notiz = window.prompt(
    'Kurze Notiz zu dieser Version (z. B. „Räume ergänzt“):',
    ''
  )
  if (notiz === null) return
  laedt.value = true
  try {
    const r = await api.post<{ formularVersionID: number }>(
      '/portal/schutzkonzept/formular/versionen',
      { notiz }
    )
    navigate({ path: `/schutzkonzept/version/${r.formularVersionID}` })
  } catch {
    // Fehlerdialog kommt aus api.ts
    await laden()
  } finally {
    laedt.value = false
  }
}

async function verwerfen(v: Version) {
  if (
    !window.confirm(
      `Entwurf Version ${v.versionNr} wirklich verwerfen?\n\nAlle Änderungen und hochgeladenen Vorlagen dieses Entwurfs gehen verloren.`
    )
  ) {
    return
  }
  try {
    // Revision mitschicken: Die Liste kann veraltet sein (zweiter Tab, anderer
    // Verwalter). Der Server verwirft dann nur den Stand, den man hier sieht.
    await api.request(
      `/portal/schutzkonzept/formular/versionen/${v.formularVersionID}?revision=${v.revision}`,
      {
        method: 'DELETE',
        quiet: true
      }
    )
    notifyInfo(`Entwurf Version ${v.versionNr} verworfen.`)
  } catch (err: any) {
    error({
      title: 'Verwerfen fehlgeschlagen',
      text:
        err.code === 'CONFLICT'
          ? 'Der Entwurf wurde inzwischen an anderer Stelle geändert. Die Liste wird neu geladen – bitte prüfen und dann erneut entscheiden.'
          : err.message
    })
  }
  laden()
}

onMounted(laden)
</script>
