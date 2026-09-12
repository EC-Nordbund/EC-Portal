<template lang="pug">
ec-wrapper(title='Übersicht', :subTitle='begruessung')
  v-alert.mb-4(
    v-if='!hatZustaendigkeit',
    type='info',
    variant='tonal'
  )
    | Für dich ist derzeit kein Bereich hinterlegt. Melde dich bitte in der
    | Geschäftsstelle, wenn du eine Liste erwartest.

  template(v-if='me.kreise.length')
    h2.text-h6.mb-2(v-font, v-primary) Meine EC-Kreise
    v-list.mb-6(lines='two', border, rounded)
      v-list-item(
        v-for='k in me.kreise',
        :key='k.ecKreisID',
        @click='navigate({ path: `/kreis/${k.ecKreisID}` })'
      )
        template(#prepend)
          v-icon place
        v-list-item-title {{ k.bezeichnung }}
        v-list-item-subtitle
          span(v-if='k.offen') {{ k.offen }} {{ k.offen === 1 ? 'Person braucht' : 'Personen brauchen' }} ein Führungszeugnis
          span(v-else) Alle Führungszeugnisse sind aktuell
        template(#append)
          ec-ampel(:farbe='k.offen ? "red" : "green"', :label='String(k.offen)')

  template(v-if='me.veranstaltungen.length')
    h2.text-h6.mb-2(v-font, v-primary) Meine Freizeiten
    v-list(lines='two', border, rounded)
      v-list-item(
        v-for='v in me.veranstaltungen',
        :key='v.veranstaltungsID',
        @click='navigate({ path: startseite(v) })'
      )
        template(#prepend)
          v-icon event
        v-list-item-title {{ v.bezeichnung }}
        v-list-item-subtitle
          | {{ v.begin ? v.begin.german : '' }}
          span(v-if='v.ende')  – {{ v.ende.german }}
          |  · {{ v.positionText }}
          span(v-if='v.umfang === "voll"')  · {{ v.mitarbeiter }} Mitarbeitende
        template(#append)
          //- Der Führungszeugnis-Stand gehört zum FZ-Teil; die Küchenleitung
          //- sieht ihn nicht und bekommt stattdessen den Hinweis, was sie hier
          //- findet.
          v-chip(v-if='v.umfang !== "voll"', size='small', variant='tonal') Küchenliste
          ec-ampel(
            v-else,
            :farbe='v.fzOffen ? "red" : "green"',
            :label='v.fzOffen ? `${v.fzOffen} ohne FZ` : "vollständig"'
          )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PortalMe } from '../../plugins/auth'
import { useRouter } from '../../plugins/router'

/**
 * Startseite. Stellt bewusst KEINEN eigenen Request: alles steht schon in
 * /portal/me, das das Layout geladen hat -- inklusive der Zähler.
 */
const props = defineProps<{ me: PortalMe }>()
const { navigate } = useRouter()

/** Küchenleitung hat keinen FZ-Teil — für sie ist die TN-Liste der Einstieg. */
function startseite(v: { veranstaltungsID: number; umfang: string }) {
  return v.umfang === 'kueche'
    ? `/veranstaltung/${v.veranstaltungsID}/tnliste`
    : `/veranstaltung/${v.veranstaltungsID}/mitarbeiter`
}

const begruessung = computed(() => `Hallo ${props.me.user.vorname}`)
const hatZustaendigkeit = computed(
  () => props.me.kreise.length > 0 || props.me.veranstaltungen.length > 0
)
</script>
