// KOPIE aus EC-Verwaltung/src/plugins/caps.ts (Stand de016c0).
// Aenderungen bitte in beiden Repos spiegeln, siehe DUPLIKATE.md.
import { ref } from 'vue'
import { defineUseFunction } from './base'

export const useCaps = defineUseFunction(() => {
  const isCaps = ref(false)

  window.addEventListener('keydown', (ev: KeyboardEvent) => {
    const key = ev.key
    if (key.length === 1) {
      isCaps.value =
        key.toUpperCase() === key && key.toLowerCase() !== key && !ev.shiftKey
    } else {
      if (key === 'CapsLock') {
        isCaps.value = !isCaps.value
      }
    }
  })

  return {
    isCaps
  }
})
