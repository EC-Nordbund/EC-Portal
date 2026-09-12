<template lang="pug">
div
  .d-flex.align-center.flex-wrap.ga-4.mb-4
    ec-search(label='Person suchen', @suche='suche = $event')
    v-spacer
    span.text-caption(v-if='daten') {{ zaehler }}
    v-btn(
      variant='flat',
      v-accent-bg,
      v-white,
      size='small',
      prepend-icon='add',
      :disabled='!daten',
      @click='neuDialog.show()'
    ) Neu

  v-progress-linear(v-if='laedtGerade', indeterminate, color='primary')

  v-alert.mb-4(v-if='daten && !gefiltert.length', type='info', variant='tonal')
    span(v-if='suche') Keine Person gefunden.
    span(v-else) In diesem EC-Kreis ist noch niemand eingetragen.

  v-table(v-if='gefiltert.length', density='compact', hover)
    thead
      tr
        th Name
        th Geburtstag
        th Mitgliedsstatus
        th Kontakt
        th
    tbody
      tr(v-for='m in gefiltert', :key='m.personID')
        td {{ m.vorname }} {{ m.nachname }}
        td {{ m.gebDat ? m.gebDat.german : '—' }}
        td(style='min-width: 190px')
          v-select(
            :model-value='m.ecMitglied',
            :items='statusItems',
            density='compact',
            variant='plain',
            hide-details,
            @update:model-value='(v) => statusAendern(m, v)'
          )
        td.text-caption
          div(v-if='m.email') {{ m.email }}
          div(v-if='m.telefon') {{ m.telefon }}
          div(v-if='m.adresse') {{ m.adresse }}
          span(v-if='!m.email && !m.telefon && !m.adresse') —
        td.text-right
          v-btn(
            icon,
            variant='text',
            size='small',
            :title='`${m.vorname} ${m.nachname} aus dem Kreis entfernen`',
            @click='entfernen(m)'
          )
            v-icon person_remove

  neue-person(
    v-if='daten',
    ref='neuDialog',
    :kreis-i-d='id',
    :kreis-name='daten.kreis.bezeichnung',
    :status='daten.status',
    @gespeichert='laden'
  )
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import neuePerson from '../../../../../lib/neuePerson.lib.vue'
import { useApi } from '../../../../../plugins/api'
import { useRouter } from '../../../../../plugins/router'
import { useDialog } from '../../../../../plugins/dialog'
import filterGenerator from '../../../../../util/filter.util'

/**
 * Mitgliederliste eines EC-Kreises — die Aufgabe der oder des
 * Ortsverantwortlichen.
 *
 * Anders als die Führungszeugnis-Liste zeigt sie ausnahmslos alle Personen des
 * Kreises. Der Status lässt sich direkt in der Zeile ändern; ein Dialog dafür
 * wäre bei einer Auswahl aus drei Werten nur im Weg.
 */
const api = useApi()
const { route } = useRouter()
const { error, notifyInfo } = useDialog()
const neuDialog = useTemplateRef<InstanceType<typeof neuePerson>>('neuDialog')

const suche = ref('')
const daten = ref<any>(null)
const laedtGerade = ref(false)

const id = computed(() => parseInt(route.value.params.id as string, 10))

const statusItems = computed(() =>
  (daten.value?.status ?? []).map((s: any) => ({
    value: s.ecMitgliedStatusID,
    title: s.bezeichnung
  }))
)

const gefiltert = computed(() =>
  (daten.value?.mitglieder ?? []).filter(filterGenerator(suche.value))
)

const zaehler = computed(() => {
  const alle = daten.value?.mitglieder ?? []
  const mitglieder = alle.filter((m: any) => m.ecMitglied !== 1).length
  return `${alle.length} Personen · ${mitglieder} Mitglieder`
})

async function laden() {
  laedtGerade.value = true
  try {
    daten.value = await api.get(`/portal/kreis/${id.value}/mitglieder`)
  } finally {
    laedtGerade.value = false
  }
}

watch(id, laden, { immediate: true })

function statusAendern(m: any, wert: number) {
  if (wert === m.ecMitglied) return
  const vorher = m.ecMitglied
  m.ecMitglied = wert
  api
    .request(`/portal/kreis/${id.value}/mitglied/${m.personID}`, {
      method: 'PATCH',
      body: { ecMitglied: wert },
      quiet: true
    })
    .then(() => notifyInfo(`${m.vorname} ${m.nachname}: Status gespeichert.`))
    .catch((err: any) => {
      // Zurücksetzen, damit die Liste nicht etwas anderes zeigt als die
      // Datenbank enthält.
      m.ecMitglied = vorher
      error({
        text: err.message || String(err),
        title: 'Speichern fehlgeschlagen'
      })
    })
}

function entfernen(m: any) {
  if (
    !window.confirm(
      `${m.vorname} ${m.nachname} wirklich aus dem EC-Kreis entfernen?\n\nDie Person bleibt im System, gehört aber zu keinem Kreis mehr und taucht in euren Listen nicht mehr auf.`
    )
  ) {
    return
  }
  api
    .request(`/portal/kreis/${id.value}/mitglied/${m.personID}`, {
      method: 'DELETE',
      quiet: true
    })
    .then(() => {
      notifyInfo(`${m.vorname} ${m.nachname} entfernt.`)
      laden()
    })
    .catch((err: any) =>
      error({
        text: err.message || String(err),
        title: 'Entfernen fehlgeschlagen'
      })
    )
}
</script>
