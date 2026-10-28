// Calcul d'itinéraire de randonnée par BRouter (données OpenStreetMap, profil « hiking-mountain »).
// Le serveur public est tenu par des bénévoles, sans quota annoncé : les requêtes passent par une file unique
// espacée, les tronçons déjà calculés sont gardés en mémoire, et l'adresse est isolée ici pour pouvoir
// basculer vers un serveur à nous sans toucher au reste de l'appli.

const ENDPOINT = 'https://brouter.de/brouter'
const PROFILE = 'hiking-mountain'
const TIMEOUT_MS = 25000
const MIN_INTERVAL_MS = 300
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

/**
 * Chemin de randonnée entre deux points, sous forme de points { lat, lng } serrés.
 * Lève NoRouteError si BRouter ne trouve pas de chemin (point hors réseau, trop éloigné, délai dépassé).
 */
export async function fetchHikingSegment(a, b, signal) {
  const k = key(a, b)
  const hit = cache.get(k)
  if (hit) return hit

  const url =
    `${ENDPOINT}?lonlats=${a.lng.toFixed(6)},${a.lat.toFixed(6)}|${b.lng.toFixed(6)},${b.lat.toFixed(6)}` +
    `&profile=${PROFILE}&alternativeidx=0&format=geojson`

  const res = await throttled(async () => {
    const t = withTimeout(signal)
    try {
      return await fetch(url, { signal: t.signal })
    } catch (e) {
      if (signal?.aborted) throw e
      if (t.signal.aborted) throw new NoRouteError('Le serveur d’itinéraires met trop de temps à répondre')
      throw e
    } finally {
      t.done()
    }
  }, signal)

  if (res.status === 400) {
    // BRouter répond en texte brut : « pass0 timeout », « no track found », « from-position not mapped »…
    const text = (await res.text()).trim()
    throw new NoRouteError(text.includes('mapped') ? 'Point trop éloigné d’un sentier' : 'Aucun sentier trouvé entre ces points')
  }
  if (!res.ok) throw new Error(`Serveur d’itinéraires indisponible (${res.status})`)

  const data = await res.json()
  const coords = data.features?.[0]?.geometry?.coordinates
  if (!coords?.length) throw new NoRouteError('Aucun sentier trouvé entre ces points')

  const path = coords.map(([lng, lat]) => ({ lat, lng }))
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(k, path)
  return path
}
