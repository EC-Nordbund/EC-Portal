import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  plugins: [
    vue({
      template: {
        preprocessOptions: {
          // WICHTIG (wie in EC-Verwaltung): ohne doctype rendert pug
          // valuelose Attribute als attr="attr" und bricht damit
          // template(#prepend), v-btn(icon), v-else.
          doctype: 'html'
        }
      }
    }),
    vuetify({ autoImport: true })
    // Kein VitePWA: der Service Worker der Verwaltung cached cache-first und
    // filtert per URL-Präfix auf die Verwaltungs-Domain. Ein übersehener
    // String hieße im Portal entweder gar kein Caching oder falsches — und ein
    // kaputter SW auf einer nur gelegentlich besuchten Seite ist besonders
    // schwer zu diagnostizieren ("bei mir ist die Seite leer"). Installierbar
    // bleibt das Portal über public/manifest.webmanifest.
  ],
  define: {
    __API_BASE__: JSON.stringify(
      // '||' wie in der Verwaltung: auch ein LEERER String fällt auf Default
      process.env.API_BASE || 'https://api.ec-nordbund.de'
    )
  },
  resolve: {
    alias: {
      // xlsx-template (TN-Listen) und sein elementtree sind CJS-Node-
      // Bibliotheken und importieren 'path' bzw. 'util'. Ohne Alias macht
      // Vite daraus Stubs, die erst zur Laufzeit knallen
      // ("util.inherits is not a function").
      path: 'path-browserify',
      util: fileURLToPath(new URL('./src/shims/node-util.ts', import.meta.url)),
      stream: fileURLToPath(
        new URL('./src/shims/node-stream.ts', import.meta.url)
      )
    }
  },
  optimizeDeps: {
    // Empfehlung von vite-plugin-vuetify: verhindert wiederholte
    // Dep-Re-Optimierung (504 Outdated Optimize Dep) durch autoImport
    exclude: ['vuetify']
  },
  server: {
    // 8080 belegt (accountdesk), 8090 die Verwaltung und 8091 deren HMR-Socket
    // (Vite nutzt Port+1 fuer den WebSocket) -- deshalb 8092.
    port: Number(process.env.DEV_PORT ?? 8092)
  }
})
