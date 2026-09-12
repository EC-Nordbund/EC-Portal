<template lang="pug">
ec-wrapper(
  :title='v ? v.bezeichnung : "Freizeit"',
  :subTitle='zeitraum',
  hasNav,
  hasRouterView,
  :nav='nav'
)
  router-view(v-slot='{ Component }')
    component(:is='Component', :me='me')
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PortalMe } from '../../../../plugins/auth'
import { useRouter } from '../../../../plugins/router'

/**
 * Rahmen einer Freizeit. Die Kopfdaten kommen aus /portal/me statt aus einem
 * eigenen Request -- sie stehen dort ohnehin, und jeder gesparte Aufruf hilft.
 */
const props = defineProps<{ me: PortalMe }>()
const { route } = useRouter()

const id = computed(() => parseInt(route.value.params.id as string, 10))
const v = computed(
  () =>
    props.me.veranstaltungen.find((x) => x.veranstaltungsID === id.value) ??
    null
)

const zeitraum = computed(() => {
  if (!v.value?.begin) return ''
  return v.value.ende
    ? `${v.value.begin.german} – ${v.value.ende.german}`
    : v.value.begin.german
})

/**
 * Die Küchenleitung bekommt den Führungszeugnis-Teil gar nicht erst angeboten.
 * Der Server weist ihn ohnehin ab — ein Menüpunkt, der immer in eine
 * Fehlermeldung läuft, wäre nur irreführend.
 */
const nav = computed(() => {
  const tn = {
    icon: 'list',
    label: 'TN-Liste',
    to: `/veranstaltung/${id.value}/tnliste`
  }
  if (v.value?.umfang === 'kueche') return [tn]
  return [
    {
      icon: 'verified_user',
      label: 'Mitarbeitende',
      to: `/veranstaltung/${id.value}/mitarbeiter`
    },
    tn
  ]
})
</script>
