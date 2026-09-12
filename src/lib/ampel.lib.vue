<template lang="pug">
v-chip(:color='farbe', :variant='variante', size='small', label) {{ text }}
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Ampel-Anzeige für den Führungszeugnis-Stand.
 *
 * Als Chip und nicht als Zeilenhintergrund wie in der Excel: die Originalfarben
 * (grün #24C666, gelb #FFFF00, rot #FF0000) sind flächig hinterlegt im
 * Dark-Mode unlesbar, und Gelb auf Weiß ist es auch im hellen Theme. Die Farbe
 * selbst bleibt dieselbe, damit die Web-Ansicht und die Monats-Mail nicht
 * unterschiedlich aussehen.
 *
 * Die Farbe wird immer vom Server geliefert. Es gibt im Bestand schon drei
 * verschiedene FZ-Regeln (cron.php, die FZ-Seite der Verwaltung und die
 * Stichtagsprüfung je Veranstaltung) — eine vierte im Client wäre der sichere
 * Weg in Widersprüche.
 */
const props = defineProps<{
  farbe?: 'green' | 'yellow' | 'red'
  /** Optionaler eigener Text statt der Standardbeschriftung. */
  label?: string
}>()

const farbe = computed(() => {
  switch (props.farbe) {
    case 'green':
      return '#24C666'
    case 'yellow':
      return '#B8860B'
    default:
      return '#C62828'
  }
})

const variante = computed(() => (props.farbe === 'green' ? 'tonal' : 'flat'))

const text = computed(() => {
  if (props.label) return props.label
  switch (props.farbe) {
    case 'green':
      return 'gültig'
    case 'yellow':
      return 'läuft ab'
    default:
      return 'fehlt'
  }
})
</script>
