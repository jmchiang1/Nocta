import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  plugins: [react(), cleanLegalUrls],
  server: { port: 5180, open: true },
})
