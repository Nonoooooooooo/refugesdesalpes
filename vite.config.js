import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import placesHandler from './api/places-photos.js'
import overpassHandler from './api/overpass.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.GOOGLE_PLACES_API_KEY = env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dev-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/places-photos', async (req, res) => {
            const parsedUrl = new URL(req.url, 'http://localhost')
            const query = Object.fromEntries(parsedUrl.searchParams)
            const fakeReq = { query }
            const fakeRes = {
              status(code) {
                res.statusCode = code
                return this
              },
              json(data) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              },
            }
            try {
              await placesHandler(fakeReq, fakeRes)
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })

          server.middlewares.use('/api/overpass', async (req, res) => {
            const parsedUrl = new URL(req.url, 'http://localhost')
            const query = Object.fromEntries(parsedUrl.searchParams)
            let rawBody = ''
            if (req.method === 'POST') {
              for await (const chunk of req) {
                rawBody += chunk
              }
            }
            let parsedBody = null
            if (rawBody) {
              try {
                parsedBody = JSON.parse(rawBody)
              } catch {
                parsedBody = rawBody
              }
            }
            const fakeReq = {
              method: req.method,
              query,
              body: parsedBody || query.data || query.ql,
            }
            const fakeRes = {
              statusCode: 200,
              setHeader(k, v) {
                res.setHeader(k, v)
              },
              status(code) {
                res.statusCode = code
                return this
              },
              json(data) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              },
            }
            try {
              await overpassHandler(fakeReq, fakeRes)
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
            }
          })
        },
      },
    ],
    server: {
      proxy: {
        '/rimg': {
          target: 'https://www.refuges.info',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rimg/, ''),
        },
        '/api/meteofrance': {
          target: 'https://public-api.meteofrance.fr/public/DPBRA/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/meteofrance/, ''),
          secure: false,
        },
      },
    },
  }
})
