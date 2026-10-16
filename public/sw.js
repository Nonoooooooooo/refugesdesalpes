// Service Worker pour Refuges des Alpes (PWA + Cartes hors-ligne)
const STATIC_CACHE = 'refuges-static-v2'
const TILES_CACHE = 'refuges-map-tiles-v1'
const DATA_CACHE = 'refuges-data-v1'

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/favicon.png',
  '/favicon-192x192.png',
  '/apple-touch-icon.png',
  '/refuges_index.json',
]

// 1x1 pixel PNG transparent de secours si une tuile est absente hors-ligne
const TRANSPARENT_TILE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return Promise.allSettled(
          CORE_ASSETS.map((url) =>
            fetch(url, { cache: 'no-cache' })
              .then((res) => {
                if (res.ok) return cache.put(url, res)
              })
              .catch((err) => {
                console.warn('[SW] Pré-cache avertissement sur:', url, err)
              }),
          ),
        )
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            // Ne JAMAIS supprimer le cache de tuiles de l'utilisateur lors d'une mise à jour de l'app !
            if (key !== STATIC_CACHE && key !== TILES_CACHE && key !== DATA_CACHE) {
              console.log('[SW] Nettoyage ancien cache:', key)
              return caches.delete(key)
            }
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

function isTileUrl(url) {
  return (
    url.includes('data.geopf.fr') ||
    url.includes('tile.opentopomap.org') ||
    url.includes('tile.waymarkedtrails.org') ||
    url.includes('server.arcgisonline.com')
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = req.url

  // 1. TUILLES DE CARTE (IGN, OpenTopoMap, Sentiers, Satellite)
  if (isTileUrl(url)) {
    event.respondWith(
      (async () => {
        const tilesCache = await caches.open(TILES_CACHE)
        // Vérifie si la tuile est présente dans le cache hors-ligne
        const cached = await tilesCache.match(url, { ignoreSearch: false })
        if (cached) {
          return cached
        }

        // Si non trouvée en cache, essaye le réseau
        try {
          const networkRes = await fetch(req)
          if (networkRes && networkRes.ok) {
            // Mettre en cache automatique des tuiles consultées en ligne (jusqu'à une taille raisonnable)
            tilesCache.put(url, networkRes.clone()).catch(() => {})
            return networkRes
          }
          return networkRes
        } catch {
          // Hors-ligne et tuile non téléchargée : renvoyer le pixel transparent pour ne pas casser la carte Leaflet
          return fetch(TRANSPARENT_TILE_BASE64)
        }
      })(),
    )
    return
  }

  // 2. DONNÉES / API (Network First avec fallback cache)
  if (url.includes('/api/') || url.includes('/rimg/') || url.includes('refuges.info')) {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req)
          if (networkRes && networkRes.ok) {
            const dataCache = await caches.open(DATA_CACHE)
            dataCache.put(req, networkRes.clone()).catch(() => {})
          }
          return networkRes
        } catch (err) {
          const cached = await caches.match(req)
          if (cached) return cached
          throw err
        }
      })(),
    )
    return
  }

  // 3. FICHIERS STATIQUES DE L'APPLICATION (HTML, CSS, JS, Fonts, Images) : Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cached = await caches.match(req)
      const fetchPromise = fetch(req)
        .then(async (networkRes) => {
          if (networkRes && networkRes.ok) {
            const staticCache = await caches.open(STATIC_CACHE)
            staticCache.put(req, networkRes.clone()).catch(() => {})
          }
          return networkRes
        })
        .catch(() => cached)

      return cached || fetchPromise
    })(),
  )
})

// Communication avec l'interface React
self.addEventListener('message', async (event) => {
  if (!event.data) return

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data.type === 'GET_STATS') {
    try {
      const tilesCache = await caches.open(TILES_CACHE)
      const keys = await tilesCache.keys()
      event.ports[0].postMessage({
        tileCount: keys.length,
      })
    } catch (err) {
      event.ports[0].postMessage({ error: err.message })
    }
  }

  if (event.data.type === 'CLEAR_TILES') {
    try {
      await caches.delete(TILES_CACHE)
      event.ports[0].postMessage({ success: true })
    } catch (err) {
      event.ports[0].postMessage({ error: err.message })
    }
  }
})
