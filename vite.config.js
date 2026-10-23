import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/* /privacy and /terms serve public/privacy.html and public/terms.html, the
 * way Vercel's cleanUrls (vercel.json) does on the live site; /app goes to
 * /app/, as vercel.json's redirect does */
const LEGAL = /^\/(privacy|terms)\/?(\?.*)?$/
const APP_NO_SLASH = /^\/app(\?.*)?$/
const siteUrls = (req, res, next) => {
  const app = req.url.match(APP_NO_SLASH)
  if (app) {
    res.statusCode = 308
    res.setHeader('Location', `/app/${app[1] ?? ''}`)
    res.end()
    return
  }
  req.url = req.url.replace(LEGAL, '/$1.html$2')
  next()
}
const cleanLegalUrls = {
  name: 'nocta-site-urls',
  configureServer(server) {
    server.middlewares.use(siteUrls)
  },
  configurePreviewServer(server) {
    server.middlewares.use(siteUrls)
  },
}

/* the app version sent with analytics and feedback: package.json's version
 * plus the commit Vercel built (or "dev" locally) */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const APP_VERSION = `${version}+${(process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)}`

/* two pages: the marketing site at / (index.html, src/site/) and the app at
 * /app/ (app/index.html, src/main.jsx). The app only uses query strings, never
 * paths, so /app/ is its one address. */
export default defineConfig({
  plugins: [react(), cleanLegalUrls],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  server: { port: 5180, open: '/app/' },
  build: {
    rollupOptions: {
      input: {
        site: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app/index.html', import.meta.url)),
      },
    },
  },
})
