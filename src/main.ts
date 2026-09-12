import { createApp, h } from 'vue'
import { RouterView } from 'vue-router'

import 'vuetify/styles'
import 'material-design-icons-iconfont/dist/material-design-icons.css'
import 'roboto-fontface/css/roboto/roboto-fontface.css'
import './assets/style.css'

import { installRouter } from './plugins/router'
import { useVuetify } from './plugins/vuetify'
import { useForm } from './forms/main'
import { registerLibComponents } from './lib/import'

/**
 * Einstieg des EC-Portals.
 *
 * Gegenüber EC-Verwaltung fehlen bewusst: der Service Worker (kein Offline-
 * Bedarf bei einer Anwendung, die ein paar Mal im Jahr benutzt wird, dafür
 * aber eine schwer zu diagnostizierende Fehlerquelle) und die
 * Desktop-Notifications (die fragen beim ersten Laden nach einer Berechtigung,
 * die hier nichts bringt).
 *
 * Auch kein useLogin() im Setup: das Layout lädt den Zuständigkeitsbereich
 * selbst, und der Login soll nicht schon beim Aufruf der Passwort-Seite
 * Requests auslösen.
 */
export const app = createApp({
  render: () => h(RouterView)
})

app.use(installRouter())
useVuetify(app)
useForm(app)
registerLibComponents(app)

app.mount('#app')
