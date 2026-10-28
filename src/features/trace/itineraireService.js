// Calcul d'itinéraire piéton de la Géoplateforme (IGN, graphe BD TOPO), interrogé directement depuis le navigateur.
// La limite d'usage est de 5 requêtes/s par adresse IP : chaque utilisateur a donc son propre quota.
// Comme pour l'altimétrie, les requêtes passent par une file unique espacée, les tronçons déjà calculés sont
// gardés en mémoire, et un 429 est réessayé après le blocage de 5 s.

const ENDPOINT = 'https://data.geopf.fr/navigation/itineraire'
// bdtopo-osrm, citée par la documentation, n'existe pas sur le service : seuls bdtopo-pgr et bdtopo-valhalla répondent
const RESOURCE = 'bdtopo-pgr'
const TIMEOUT_MS = 25000
const MIN_INTERVAL_MS = 250
const BLOCK_DURATION_S = 5
const MAX_RETRIES = 2
const CACHE_MAX = 200

// "lng,lat|lng,lat" arrondis à 1e-5° (~1 m) → [{ lat, lng }, …]
const cache = new Map()

const key = (a, b) => `${a.lng.toFixed(5)},${a.lat.toFixed(5)}|${b.lng.toFixed(5)},${b.lat.toFixed(5)}`

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

let queue = Promise.resolve()
let lastRequestAt = 0

function throttled(fn, signal) {
  const run = queue.then(async () => {
    signal?.throwIfAborted()
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait, signal)
    lastRequestAt = Date.now()
    return fn()
  })
  queue = run.catch(() => {})
  return run
}

/** Signal qui s'interrompt soit avec celui de l'appelant, soit après le délai maximal */
function withTimeout(signal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), TIMEOUT_MS)
  const onAbort = () => ctrl.abort(signal.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

export class NoRouteError extends Error {}

async function request(url, signal, attempt = 0) {
  const res = await throttled(async () => {
    const t = withTimeout(signal)
    try {
      return await fetch(url, { signal: t.signal })
    } catch (e) {
      if (signal?.aborted) throw e
      if (t.signal.aborted) throw new Error('Le service d’itinéraire IGN met trop de temps à répondre')
      throw e
    } finally {
      t.done()
    }
  }, signal)
  if (res.status === 429 && attempt < MAX_RETRIES) {
    await sleep(BLOCK_DURATION_S * 1000, signal)
    return request(url, signal, attempt + 1)
  }
  return res
}

/**
 * Chemin piéton entre deux points, sous forme de points { lat, lng } serrés.
 * Le profil piéton de l'IGN ne connaît pas la randonnée : il suit les sentiers, chemins et routes de la BD TOPO
 * au plus court. Lève NoRouteError si aucun chemin n'est trouvé entre les deux points.
 */
export async function fetchWalkingSegment(a, b, signal) {
  const k = key(a, b)
  const hit = cache.get(k)
  if (hit) return hit

  const params = new URLSearchParams({
    resource: RESOURCE,
    profile: 'pedestrian',
    optimization: 'shortest',
    start: `${a.lng.toFixed(6)},${a.lat.toFixed(6)}`,
    end: `${b.lng.toFixed(6)},${b.lat.toFixed(6)}`,
    geometryFormat: 'geojson',
    getSteps: 'false',
    getBbox: 'false',
  })
  const res = await request(`${ENDPOINT}?${params}`, signal)

  if (res.status === 404 || res.status === 400) {
    // « No path found », ou point hors de la zone couverte par le graphe
    throw new NoRouteError('Aucun chemin trouvé entre ces points')
  }
  if (!res.ok) throw new Error(`Service d’itinéraire IGN indisponible (${res.status})`)

  const data = await res.json()
  const coords = data.geometry?.coordinates
  if (!coords?.length) throw new NoRouteError('Aucun chemin trouvé entre ces points')

  const path = coords.map(([lng, lat]) => ({ lat, lng }))
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(k, path)
  return path
}
