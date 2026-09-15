<template lang="pug">
ec-wrapper(
  title='Material',
  subTitle='Ausleihmaterial des EC-Nordbund',
  hasNav,
  hasRouterView,
  :nav='nav'
)
  router-view(v-slot='{ Component }')
    component(:is='Component', :me='me')
</template>

<script setup lang="ts">
import type { PortalMe } from '../../../plugins/auth'

/**
 * Rahmen der Materialausleihe für alle Portal-Nutzer: Katalog zum Stöbern und
 * Beantragen, daneben die eigenen Anträge mit Packliste. Der Bereich für
 * Materialwarte liegt getrennt unter /materialwart.
 */
defineProps<{ me: PortalMe }>()

const nav = [
  { icon: 'inventory_2', label: 'Katalog', to: '/material/katalog' },
  { icon: 'assignment', label: 'Meine Anträge', to: '/material/antraege' }
]
</script>
