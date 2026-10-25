// Service Worker pour Refuges des Alpes (PWA + Cartes hors-ligne)
const STATIC_CACHE = 'refuges-static-v3'
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
      .then(async (cache) => {
        // 1. Pré-cache des ressources de base
        await Promise.allSettled(
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

        // 2. Découverte et pré-cache dynamique des bundles JS/CSS Vite (/assets/...)
        try {
          const indexRes = (await cache.match('/index.html')) || (await fetch('/index.html'))
          if (indexRes && indexRes.ok) {
            const html = await indexRes.clone().text()
            const assetUrls = []
            // Détection des fichiers JS et CSS générés par Vite dans index.html
            const regex = /(?:src|href)=["'](\/assets\/[^"']+)["']/g
            let match
            while ((match = regex.exec(html)) !== null) {
              assetUrls.push(match[1])
            }
            await Promise.allSettled(
              assetUrls.map(async (assetUrl) => {
                try {
                  const res = await fetch(assetUrl)
                  if (res.ok) await cache.put(assetUrl, res)
                } catch {
                  // Ignore échec individuel
                }
              }),
            )
          }
        } catch (e) {
          console.warn('[SW] Pré-cache dynamique Vite bundles:', e)
        }
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
            // Mettre en cache automatique des tuiles consultées en ligne
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

  // 2. NAVIGATION (Lancement de la PWA ou chargement de page hors-ligne)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Essai réseau en priorité si connecté
          const preload = await event.preloadResponse
          if (preload) return preload

          const networkRes = await fetch(req)
          if (networkRes && networkRes.ok) {
            const staticCache = await caches.open(STATIC_CACHE)
            staticCache.put('/index.html', networkRes.clone()).catch(() => {})
            return networkRes
          }
        } catch {
          // Réseau indisponible (mode montagne / hors-ligne)
        }

        // Secours garanti sur l'application shell en cache
        const cached =
          (await caches.match('/index.html')) ||
          (await caches.match('/', { ignoreSearch: true })) ||
          (await caches.match(req, { ignoreSearch: true }))

        if (cached) return cached

        return new Response(
          '<!doctype html><html lang="fr"><head><meta charset="UTF-8"><title>Refuges des Alpes</title></head><body style="background:#0f172a;color:#fff;text-align:center;padding:50px;font-family:sans-serif;"><h2>Refuges des Alpes</h2><p>Application en mode hors-ligne.</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
      })(),
    )
    return
  }

  // 3. DONNÉES / API (Network First avec fallback cache)
  // Les données transport (réseau, fiches de lignes, index) suivent aussi cette règle : chaque
  // reconstruction du réseau doit être vue tout de suite, le cache ne sert qu'hors ligne
  if (url.includes('/api/') || url.includes('/rimg/') || url.includes('refuges.info') || url.includes('/transports')) {
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

  // 4. FICHIERS STATIQUES DE L'APPLICATION (JS, CSS, Polices, Images, Icons)
  // Stratégie : Cache First avec revalidation réseau en arrière-plan
  event.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: true })
      if (cached) {
        // En arrière-plan, mise à jour discrète si le réseau est accessible
        fetch(req)
          .then(async (networkRes) => {
            if (networkRes && networkRes.ok) {
              const staticCache = await caches.open(STATIC_CACHE)
              staticCache.put(req, networkRes).catch(() => {})
            }
          })
          .catch(() => {})
        return cached
      }

      // Si absent du cache, récupération réseau
      try {
        const networkRes = await fetch(req)
        if (networkRes && networkRes.ok) {
          const staticCache = await caches.open(STATIC_CACHE)
          staticCache.put(req, networkRes.clone()).catch(() => {})
        }
        return networkRes
      } catch (err) {
        // Fallback ultime sur index.html pour les navigations statiques
        if (url.endsWith('.html') || url === self.location.origin + '/') {
          const fallback = await caches.match('/index.html')
          if (fallback) return fallback
        }
        throw err
      }
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
