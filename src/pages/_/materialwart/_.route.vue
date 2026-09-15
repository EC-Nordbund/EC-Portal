<template lang="pug">
ec-wrapper(
  title='Materialverwaltung',
  :subTitle='untertitel',
  hasNav,
  hasRouterView,
  :nav='nav'
)
  //- Ohne Rolle gibt es hier nichts zu sehen. Der Server sperrt die Routen
  //- ohnehin mit 403; der Hinweis erspart nur den leeren Bildschirm nach einem
  //- alten Lesezeichen oder einem entzogenen Recht.
  v-alert.ma-4(v-if='!me.user.materialVerwalter', type='info', variant='tonal')
    | Die Materialverwaltung ist der/dem Materialwart/in vorbehalten. Wenn du
    | Material ausleihen möchtest, findest du den Katalog im Menü unter
    | „Material“.
  router-view(v-else, v-slot='{ Component }')
    component(:is='Component', :me='me', @reload='emit("reload")')
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PortalMe } from '../../../plugins/auth'

/**
 * Rahmen des Materialwart-Bereichs: Anträge bearbeiten, Bestand pflegen,
 * Belegung ansehen, Vorlagen pflegen. Eine Rolle, vier Aufgaben -- deshalb
 * immer alle Reiter, anders als beim EC-Kreis, wo die Leiste je nach Rolle
 * wegfällt.
 */
const props = defineProps<{ me: PortalMe }>()
const emit = defineEmits<{ (e: 'reload'): void }>()

const untertitel = computed(() => {
  const offen = props.me.material?.offen
  return offen
    ? `${offen} ${offen === 1 ? 'offener Antrag' : 'offene Anträge'}`
    : ''
})

const nav = [
  { icon: 'inbox', label: 'Anträge', to: '/materialwart/antraege' },
  { icon: 'warehouse', label: 'Bestand', to: '/materialwart/bestand' },
  { icon: 'calendar_month', label: 'Belegung', to: '/materialwart/belegung' },
  { icon: 'bookmarks', label: 'Vorlagen', to: '/materialwart/vorlagen' }
]
</script>
