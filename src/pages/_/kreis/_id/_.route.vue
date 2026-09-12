<template lang="pug">
ec-wrapper(
  :title='kreis ? kreis.bezeichnung : "EC-Kreis"',
  :subTitle='untertitel',
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
 * Rahmen eines EC-Kreises.
 *
 * Ein Kreis hat zwei getrennte Aufgaben mit je eigener Verantwortlicher:
 * Führungszeugnisse und Mitgliederpflege. Wer nur eine davon hat, sieht auch
 * nur eine — die Navigation unten erscheint dann gar nicht erst.
 */
const props = defineProps<{ me: PortalMe }>()
const { route } = useRouter()

const id = computed(() => parseInt(route.value.params.id as string, 10))
const kreis = computed(
  () => props.me.kreise.find((k) => k.ecKreisID === id.value) ?? null
)

const untertitel = computed(() => {
  const r = kreis.value?.rollen ?? []
  if (r.includes('fz') && r.includes('ort')) {
    return 'Führungszeugnisse und Mitglieder'
  }
  return r.includes('ort') ? 'Mitglieder' : 'Führungszeugnisse'
})

const nav = computed(() => {
  const r = kreis.value?.rollen ?? []
  const punkte = []
  if (r.includes('fz')) {
    punkte.push({
      icon: 'verified_user',
      label: 'Führungszeugnisse',
      to: `/kreis/${id.value}/fz`
    })
  }
  if (r.includes('ort')) {
    punkte.push({
      icon: 'groups',
      label: 'Mitglieder',
      to: `/kreis/${id.value}/mitglieder`
    })
  }
  // Bei nur einer Aufgabe wäre eine Leiste mit einem einzigen Knopf sinnlos.
  return punkte.length > 1 ? punkte : []
})
</script>
