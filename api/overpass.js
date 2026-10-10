// Vercel Serverless Function & Vite Dev Handler: /api/overpass
// Proxy sécurisé pour Overpass API afin de contourner l'erreur 406 Not Acceptable (User-Agent requis)
// et gérer le basculement automatique entre plusieurs serveurs miroirs avec mise en cache CDN/mémoire.

export const maxDuration = 15 // Durée maximale sur Vercel (Hobby: 15s)

const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

const cache = new Map()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_QUERY_LENGTH = 25000 // Max 25 Ko pour parer les abus et surcharges

/**
 * Vérifie si l'origine de la requête est légitime
 */
function isAllowedOrigin(req) {
  const origin = req.headers?.origin || req.headers?.referer
  if (!origin) return true // Navigation directe ou même origine
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
      return true
    }
    const reqHost = (req.headers?.host || '').split(':')[0].toLowerCase()
    if (reqHost && host === reqHost) {
      return true
    }
    return false
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  // 1. Contrôle de méthode HTTP
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée (GET ou POST uniquement)' })
  }

  // 2. Contrôle d'origine pour empêcher le détournement du proxy par d'autres sites
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Accès interdit : origine non autorisée' })
  }

  let ql = ''

  if (req.method === 'POST') {
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body)
        ql = parsed.data || parsed.ql || req.body
      } catch {
        ql = req.body
      }
    } else if (req.body && typeof req.body === 'object') {
      ql = req.body.data || req.body.ql || ''
    }
  }

  if (!ql && req.query) {
    ql = req.query.data || req.query.ql || ''
  }

  if (!ql) {
    return res.status(400).json({ error: 'Paramètre de requête Overpass manquant (ql ou data)' })
  }

  // 3. Protection anti-déni de service : taille maximale de requête
  if (ql.length > MAX_QUERY_LENGTH) {
    return res.status(413).json({ error: 'Requête Overpass trop volumineuse' })
  }

  // 4. Vérification du cache en mémoire
  const cached = cache.get(ql)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (res.setHeader) {
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('Cache-Control', 'public, s-maxage=600, max-age=300, stale-while-revalidate=300')
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Content-Type-Options', 'nosniff')
    }
    return res.status(200).json(cached.data)
  }

  let lastError = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController()
      // Timeout de 12 secondes pour laisser le temps aux requêtes Overpass d'aboutir
      const timer = setTimeout(() => controller.abort(), 12000)

      const upstreamRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'RefugeApp/2.0 (contact@refuge.app; https://refuge.app)',
        },
        body: 'data=' + encodeURIComponent(ql),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (upstreamRes.ok) {
        const data = await upstreamRes.json()

        // Mise en cache mémoire (max 250 entrées)
        if (cache.size > 250) {
          const firstKey = cache.keys().next().value
          cache.delete(firstKey)
        }
        cache.set(ql, { timestamp: Date.now(), data })

        if (res.setHeader) {
          res.setHeader('X-Cache', 'MISS')
          res.setHeader('Cache-Control', 'public, s-maxage=600, max-age=300, stale-while-revalidate=300')
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('X-Content-Type-Options', 'nosniff')
        }
        return res.status(200).json(data)
      } else {
        lastError = new Error(`Overpass ${endpoint} status ${upstreamRes.status}`)
      }
    } catch (e) {
      lastError = e
    }
  }

  res.status(502).json({ error: lastError?.message || 'Erreur de connexion aux serveurs Overpass' })
}
