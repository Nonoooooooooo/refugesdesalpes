// Vercel Serverless Function & Vite Dev Handler: /api/overpass
// Proxy pour Overpass API afin de contourner l'erreur 406 Not Acceptable (User-Agent requis)
// et gérer le basculement automatique entre plusieurs serveurs miroirs.

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const cache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export default async function handler(req, res) {
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

  // Vérification du cache en mémoire
  const cached = cache.get(ql)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (res.setHeader) {
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('Content-Type', 'application/json')
    }
    return res.status(200).json(cached.data)
  }

  let lastError = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController()
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

        // Mise en cache
        if (cache.size > 150) {
          const firstKey = cache.keys().next().value
          cache.delete(firstKey)
        }
        cache.set(ql, { timestamp: Date.now(), data })

        if (res.setHeader) {
          res.setHeader('X-Cache', 'MISS')
          res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=120')
          res.setHeader('Content-Type', 'application/json')
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
