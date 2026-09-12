<template lang="pug">
component(:is='tag || "div"')
  component(
    :is='map[field.type]',
    v-for='(field, i) in schema',
    :key='`${i}-form`',
    :schema='field',
    :value='value[field.name]',
    :save='save',
    :cancel='cancel',
    @input='value[field.name] = $event'
  )
</template>

<script setup lang="ts">
import FormAlert from './formElements/alert.vue'
import FormAutocomplete from './formElements/autocomplete.vue'
import FormCheckbox from './formElements/checkbox.vue'
import FormDate from './formElements/date.vue'
import FormInput from './formElements/input.vue'
import FormLabel from './formElements/label.vue'
import FormPassword from './formElements/password.vue'
import FormText from './formElements/text.vue'

defineProps({
  value: {},
  schema: {},
  tag: {},
  cancel: { required: true },
  save: { required: true }
})

// KOPIE aus EC-Verwaltung/src/forms/formular.vue.
// Explizite Komponenten-Map statt String-Auflösung über globale Registrierung.
// Gegenüber der Verwaltung fehlen adresse, radio, rating, stepper, switch und
// time: die kommen im Portal in keinem Formular vor, und ein Import ohne Datei
// bricht den Build.
const map: Record<string, any> = {
  alert: FormAlert,
  autocomplete: FormAutocomplete,
  select: FormAutocomplete,
  checkbox: FormCheckbox,
  date: FormDate,
  input: FormInput,
  label: FormLabel,
  password: FormPassword,
  text: FormText
}
</script>
