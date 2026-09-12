<template lang="pug">
div
  v-progress-linear(v-if='laedtGerade', indeterminate, color='primary')

  v-alert(v-if='abgewiesen', type='info', variant='tonal') {{ abgewiesen }}

  v-alert.mb-4(
    v-if='daten && offene',
    type='warning',
    variant='tonal'
  )
    | {{ offene }} {{ offene === 1 ? 'Mitarbeitende/r hat' : 'Mitarbeitende haben' }}
    |  am Ende der Freizeit kein gültiges Führungszeugnis.

  v-list(v-if='daten', lines='two', border, rounded)
    v-list-item(v-for='m in daten.mitarbeiter', :key='m.anmeldeID')
      template(#prepend)
        v-icon(:color='m.fzGueltigAmStichtag ? "#24C666" : "#C62828"')
          | {{ m.fzGueltigAmStichtag ? 'verified_user' : 'gpp_maybe' }}
      v-list-item-title
        | {{ m.vorname }} {{ m.nachname }}
        span.text-error(v-if='!m.fzGueltigAmStichtag')  – HAT KEIN GÜLTIGES FZ!
      v-list-item-subtitle
        | {{ m.positionText }}
        span(v-if='m.gebDat')  · {{ m.gebDat.german }}
        span(v-if='m.gueltigBis')  · gültig bis {{ m.gueltigBis.german }}
        span(v-else)  · kein Führungszeugnis eingetragen
      template(#append)
        v-btn(
          v-if='m.personID !== me.user.personID',
          size='small',
          variant='text',
          prepend-icon='verified_user',
          @click='fzDialog.show(m)'
        ) FZ

  add-fz(ref='fzDialog', @gespeichert='laden')
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import addFz from '../../../../../lib/addFz.lib.vue'
import { useApi } from '../../../../../plugins/api'
import { useRouter } from '../../../../../plugins/router'
import type { PortalMe } from '../../../../../plugins/auth'

/**
 * FZ-Stand des Teams.
 *
 * Maßgeblich ist nicht "heute gültig", sondern "am Ende der Freizeit noch
 * gültig" -- ein Zeugnis, das während der Freizeit abläuft, reicht nicht. Die
 * Prüfung macht der Server (fzGueltigAmStichtag), damit es davon nicht eine
 * zweite, abweichende Fassung im Client gibt.
 */
defineProps<{ me: PortalMe }>()

const api = useApi()
const { route } = useRouter()
const fzDialog = useTemplateRef<InstanceType<typeof addFz>>('fzDialog')

const daten = ref<any>(null)
const laedtGerade = ref(false)
const id = computed(() => parseInt(route.value.params.id as string, 10))

const offene = computed(
  () =>
    daten.value?.mitarbeiter.filter((m: any) => !m.fzGueltigAmStichtag)
      .length ?? 0
)

const abgewiesen = ref('')

/**
 * Der Fehler wird hier abgefangen und nicht weitergeworfen: die Seite ist
 * über die Navigation zwar nur bei vollem Zugriff erreichbar, per direkter
 * Adresse aber schon (etwa über ein altes Lesezeichen). Ohne catch bliebe eine
 * unbehandelte Ablehnung in der Konsole stehen, während die Seite leer wirkt.
 */
async function laden() {
  laedtGerade.value = true
  abgewiesen.value = ''
  try {
    daten.value = await api.get(
      `/portal/veranstaltung/${id.value}/mitarbeiter`,
      { quiet: true }
    )
  } catch (err: any) {
    daten.value = null
    abgewiesen.value =
      err?.status === 403
        ? err.message
        : 'Die Liste konnte nicht geladen werden.'
  } finally {
    laedtGerade.value = false
  }
}

watch(id, laden, { immediate: true })
</script>
