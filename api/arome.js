// Vercel Serverless Function & Vite Dev Handler: /api/arome
// Proxy et cache haute performance pour l'API Météo-France AROME-PI
// - Met en cache les capacités et images radar pour respecter le quota de 50 req/min
// - Injecte le jeton API Météo-France de manière sécurisée côté serveur

export const maxDuration = 15

const AROME_BASE_URL = 'https://public-api.meteofrance.fr/public/aromepi/1.0/wms/MF-NWP-HIGHRES-AROMEPI-001-FRANCE-WMS'

// Cache mémoire serveur (Vercel lambda / Dev server)
const imageCache = new Map()
const MAX_IMAGE_CACHE_SIZE = 120
const IMAGE_CACHE_TTL_MS = 8 * 60 * 1000 // 8 minutes

let capabilitiesCache = null
let capabilitiesCacheTime = 0
const CAPABILITIES_CACHE_TTL_MS = 12 * 60 * 1000 // 12 minutes

// Jeton de secours officiel Météo-France AROME-PI pour la production Vercel
const FALLBACK_TOKEN =
  'eyJ4NXQiOiJZV0kxTTJZNE1qWTNOemsyTkRZeU5XTTRPV014TXpjek1UVmhNbU14T1RSa09ETXlOVEE0Tnc9PSIsImtpZCI6ImdhdGV3YXlfY2VydGlmaWNhdGVfYWxpYXMiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJCYXJ0YW15QGNhcmJvbi5zdXBlciIsImFwcGxpY2F0aW9uIjp7Im93bmVyIjoiQmFydGFteSIsInRpZXJRdW90YVR5cGUiOm51bGwsInRpZXIiOiJVbmxpbWl0ZWQiLCJuYW1lIjoiRGVmYXVsdEFwcGxpY2F0aW9uIiwiaWQiOjUwMTY0LCJ1dWlkIjoiNGNiOTQ4NjMtNWY2My00MzVhLWE0ODYtMmQwNDYzYjUyNDdkIn0sImlzcyI6Imh0dHBzOlwvXC9wb3J0YWlsLWFwaS5tZXRlb2ZyYW5jZS5mcjo0NDNcL29hdXRoMlwvdG9rZW4iLCJ0aWVySW5mbyI6eyI1MFBlck1pbiI6eyJ0aWVyUXVvdGFUeXBlIjoicmVxdWVzdENvdW50IiwiZ3JhcGhRTE1heENvbXBsZXhpdHkiOjAsImdyYXBoUUxNYXhEZXB0aCI6MCwic3RvcE9uUXVvdGFSZWFjaCI6dHJ1ZSwic3Bpa2VBcnJlc3RMaW1pdCI6MCwic3Bpa2VBcnJlc3RVbml0Ijoic2VjIn19LCJrZXl0eXBlIjoiUFJPRFVDVElPTiIsInN1YnNjcmliZWRBUElzIjpbeyJzdWJzY3JpYmVyVGVuYW50RG9tYWluIjoiY2FyYm9uLnN1cGVyIiwibmFtZSI6IkFST01FLVBJIiwiY29udGV4dCI6IlwvcHVibGljXC9hcm9tZXBpXC8xLjAiLCJwdWJsaXNoZXIiOiJhZG1pbl9tZiIsInZlcnNpb24iOiIxLjAiLCJzdWJzY3JpcHRpb25UaWVyIjoiNTBQZXJNaW4ifV0sImV4cCI6MTg1NTM0NDMzNSwidG9rZW5fdHlwZSI6ImFwaUtleSIsImlhdCI6MTc5MjIyOTEzNSwianRpIjoiNTY4YzJiYmEtMTQzNC00MDEzLTkzZGEtMWIzN2E0MGJhZGM0In0=.uOIttuRCwvQq7nLO5_bQiA7nfh_aH9QtcOu_kN3Sx0q97r0tuKsihHJgwRQRqiJYvx1UA3FC-Wg3xEpwpVmxWiPdc4FTCWxVc_wexw9_HBJiN4UxyuF4Nc5O_dRcSnTU_xeJ4n5WopWfIW6gqQJbtwFBLW7r1qxszbNUbFBVcrkp3ZqgMAhEhtgAl-nz0XpZjN8E-lhLmbNqWMmrhMNR6FGDfx-loJoN2gqj15ej-CATmJcQiv25UbMWkqm9OEa0oiQQROIHoDiKpvqS-hD0czrROAri5xJFN76X-NNq4oDYixT0MgMhYY57Ss6qebl_m7ESCmsmF4cg-G9F5GXvbA=='

function getToken(req) {
  const token = (
    process.env.METEOFRANCE_AROME_TOKEN ||
    process.env.VITE_METEOFRANCE_API_KEY ||
    req.headers?.['x-meteofrance-token'] ||
    req.headers?.apikey ||
    ''
  ).trim()
  return token || FALLBACK_TOKEN
}

function parseCapabilities(xmlText) {
  const targetLayers = [
    {
      id: 'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE',
      label: 'Précipitations (Radar pluie)',
      shortLabel: 'Pluie',
      unit: 'mm/h',
      icon: '🌧️',
      color: '#38bdf8',
      default: true,
    },
    {
      id: 'TOTAL_SNOW_PRECIPITATION__GROUND_OR_WATER_SURFACE',
      label: 'Chutes de neige',
      shortLabel: 'Neige',
      unit: 'kg/m²',
      icon: '❄️',
      color: '#e0f2fe',
    },
    {
      id: 'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE',
      label: 'Réflectivité Radar',
      shortLabel: 'Réflectivité',
      unit: 'dBZ',
      icon: '⚡',
      color: '#f59e0b',
    },
    {
      id: 'WIND_SPEED_GUST_15MIN__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND',
      label: 'Rafales de vent',
      shortLabel: 'Vent',
      unit: 'm/s',
      icon: '💨',
      color: '#a855f7',
    },
  ]

  const results = []
  let allTimes = []

  for (const t of targetLayers) {
    const block = xmlText.split('<Layer').find((b) => b.includes('<Name>' + t.id + '</Name>'))
    if (block) {
      const timeMatch = block.match(/<Dimension[^>]*name="time"[^>]*>([\s\S]*?)<\/Dimension>/)
      const times = timeMatch ? timeMatch[1].trim().split(',').filter(Boolean) : []
      if (times.length > allTimes.length) {
        allTimes = times
      }
      results.push({
        ...t,
        timesCount: times.length,
      })
    }
  }

  // Filtrage temporel : on garde de H-2h à H+5h pour une animation immédiate fluide
  const now = Date.now()
  const filteredTimes = allTimes.filter((iso) => {
    const t = new Date(iso).getTime()
    return t >= now - 2.5 * 3600 * 1000 && t <= now + 5.5 * 3600 * 1000
  })

  return {
    layers: results,
    times: filteredTimes.length > 0 ? filteredTimes : allTimes.slice(-20),
    allTimesCount: allTimes.length,
    updatedAt: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée (GET uniquement)' })
  }

  const token = getToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Jeton Météo-France manquant ou invalide.' })
  }

  const query = req.query || {}
  const action = query.action

  // 1. Action : GetCapabilities
  if (action === 'capabilities') {
    const now = Date.now()
    if (capabilitiesCache && now - capabilitiesCacheTime < CAPABILITIES_CACHE_TTL_MS) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200')
      return res.status(200).json(capabilitiesCache)
    }

    try {
      const capUrl = `${AROME_BASE_URL}/GetCapabilities?service=WMS&version=1.3.0&language=fre`
      const mfRes = await fetch(capUrl, {
        headers: { apikey: token },
      })

      if (!mfRes.ok) {
        const text = await mfRes.text()
        return res.status(mfRes.status).json({
          error: `Météo-France GetCapabilities error: ${mfRes.statusText}`,
          details: text.slice(0, 300),
        })
      }

      const xml = await mfRes.text()
      const parsed = parseCapabilities(xml)
      capabilitiesCache = parsed
      capabilitiesCacheTime = now

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200')
      return res.status(200).json(parsed)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // 2. Action : GetMap (retourne une image PNG superposable)
  const layer = query.layers || query.layer || 'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE'
  const bbox = query.bbox
  const width = query.width || '512'
  const height = query.height || '512'
  const time = query.time || ''
  const crs = query.crs || 'EPSG:4326'

  if (!bbox) {
    return res.status(400).json({ error: 'Paramètre bbox requis (format: minLat,minLng,maxLat,maxLng)' })
  }

  const cacheKey = `${layer}|${bbox}|${time}|${width}|${height}|${crs}`
  const cached = imageCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    res.setHeader('X-Cache', 'HIT')
    return res.send(cached.buffer)
  }

  try {
    const params = new URLSearchParams({
      service: 'WMS',
      version: '1.3.0',
      request: 'GetMap',
      layers: layer,
      crs: crs,
      format: 'image/png',
      transparent: 'true',
      width: String(width),
      height: String(height),
      bbox: String(bbox),
    })

    if (time) {
      params.append('time', time)
    }

    const mapUrl = `${AROME_BASE_URL}/GetMap?${params.toString()}`
    const mfRes = await fetch(mapUrl, {
      headers: { apikey: token },
    })

    if (!mfRes.ok) {
      const errText = await mfRes.text()
      return res.status(mfRes.status).json({
        error: `Météo-France GetMap error: ${mfRes.statusText}`,
        details: errText.slice(0, 300),
      })
    }

    const buffer = Buffer.from(await mfRes.arrayBuffer())

    // Gestion du cache LRU
    if (imageCache.size >= MAX_IMAGE_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value
      imageCache.delete(firstKey)
    }
    imageCache.set(cacheKey, {
      buffer,
      timestamp: Date.now(),
    })

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    res.setHeader('X-Cache', 'MISS')
    return res.send(buffer)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
