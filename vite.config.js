import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

/* /privacy and /terms serve public/privacy.html and public/terms.html, the
 * way Vercel's cleanUrls (vercel.json) does on the live site */
const LEGAL = /^\/(privacy|terms)\/?(\?.*)?$/
const cleanLegalUrls = {
  name: 'nocta-clean-legal-urls',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      req.url = req.url.replace(LEGAL, '/$1.html$2')
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      req.url = req.url.replace(LEGAL, '/$1.html$2')
      next()
    })
  },
}

/* the app version sent with analytics and feedback: package.json's version
 * plus the commit Vercel built (or "dev" locally) */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const APP_VERSION = `${version}+${(process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)}`

export default defineConfig({
  plugins: [react(), cleanLegalUrls],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  server: { port: 5180, open: true },
})
