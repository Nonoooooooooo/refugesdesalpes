// Vercel Serverless Function & Vite Dev Handler: /api/places-photos
// Récupère les photos de Google Places (New) et les proxifie en toute sécurité
// sans JAMAIS exposer la clé API Google au client (navigateur).

export const maxDuration = 15

// Cache en mémoire pour limiter les requêtes et les coûts Google Places API
const searchCache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 heure

/**
 * Vérifie si l'origine de la requête est légitime (même origine, localhost ou sous-domaine de prévisualisation)
 */
function isAllowedOrigin(req) {
  const origin = req.headers?.origin || req.headers?.referer
  if (!origin) return true // Requêtes directes ou navigation standard
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
  // 1. Contrôle d'origine pour empêcher d'autres sites d'utiliser notre endpoint comme proxy gratuit
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Accès interdit : origine non autorisée' })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey || apiKey === 'votre_cle_api_google_ici') {
    return res.status(200).json({ photos: [], message: 'Google Places API Key non configurée' })
  }

  const query = req.query || {}

  // 2. MODE PROXY IMAGE : Sert le flux image sans jamais exposer la clé API Google au visiteur
  if (query.media) {
    const mediaName = String(query.media).trim()
    // Validation stricte du format Google Places photoName pour parer les attaques SSRF ou Path Traversal
    if (!/^places\/[a-zA-Z0-9_-]+\/photos\/[a-zA-Z0-9_-]+$/.test(mediaName)) {
      return res.status(400).json({ error: 'Identifiant de photo Google Places invalide' })
    }

    const maxHeight = Math.min(Math.max(parseInt(query.maxHeight, 10) || 1200, 100), 2400)
    const maxWidth = Math.min(Math.max(parseInt(query.maxWidth, 10) || 1200, 100), 2400)

    try {
      const googleMediaUrl = `https://places.googleapis.com/v1/${mediaName}/media?maxHeightPx=${maxHeight}&maxWidthPx=${maxWidth}&key=${apiKey}`
      const imgRes = await fetch(googleMediaUrl)

      if (!imgRes.ok) {
        return res.status(imgRes.status).json({ error: 'Image introuvable sur Google Places' })
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      if (res.setHeader) {
        res.setHeader('Content-Type', contentType)
        // Cache Vercel Edge CDN pendant 7 jours, navigateur pendant 1 jour
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
        res.setHeader('X-Content-Type-Options', 'nosniff')
      }

      const arrayBuffer = await imgRes.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      if (res.send) {
        return res.send(buffer)
      }
      return res.end(buffer)
    } catch (err) {
      return res.status(502).json({ error: 'Erreur proxy photo Google Places' })
    }
  }

  // 3. MODE RECHERCHE LIEU : Recherche avec Places API (New) - searchText
  const { name, lat, lng } = query
  if (!name || lat == null || lng == null) {
    return res.status(400).json({ error: 'Paramètres manquants (name, lat, lng)' })
  }

  const parsedLat = parseFloat(lat)
  const parsedLng = parseFloat(lng)
  if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90 || isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
    return res.status(400).json({ error: 'Coordonnées géographiques invalides' })
  }

  // Nettoyage et limitation de la longueur du nom pour éviter l'abus
  const cleanName = String(name).slice(0, 120).trim()
  const cacheKey = `${cleanName.toLowerCase()}_${parsedLat.toFixed(3)}_${parsedLng.toFixed(3)}`

  // Vérification du cache mémoire
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (res.setHeader) {
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=1800, stale-while-revalidate=86400')
      res.setHeader('X-Content-Type-Options', 'nosniff')
    }
    return res.status(200).json({ photos: cached.photos })
  }

  try {
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.photos',
      },
      body: JSON.stringify({
        textQuery: `${cleanName} refuge`,
        locationBias: {
          circle: {
            center: {
              latitude: parsedLat,
              longitude: parsedLng,
            },
            radius: 1000.0, // 1 km max autour des coordonnées
          },
        },
        maxResultCount: 1,
        languageCode: 'fr',
      }),
    })

    if (!searchRes.ok) {
      const err = await searchRes.text()
      return res.status(searchRes.status).json({ error: err })
    }

    const searchData = await searchRes.json()
    const place = searchData.places?.[0]
    if (!place || !place.photos || place.photos.length === 0) {
      // Met en cache le résultat vide pour éviter de requêter en boucle un lieu sans photos
      searchCache.set(cacheKey, { timestamp: Date.now(), photos: [] })
      return res.status(200).json({ photos: [] })
    }

    // Formatage des photos avec URI sécurisées pointant sur notre proxy interne
    const photos = place.photos.slice(0, 8).map((photo, index) => {
      const photoName = photo.name // Format: places/{place_id}/photos/{photo_reference}
      const author = photo.authorAttributions?.[0]?.displayName || 'Google Maps'
      const authorUri = photo.authorAttributions?.[0]?.uri || null

      const encodedPhoto = encodeURIComponent(photoName)
      const thumb = `/api/places-photos?media=${encodedPhoto}&maxHeight=400&maxWidth=400`
      const src = `/api/places-photos?media=${encodedPhoto}&maxHeight=1200&maxWidth=1200`
      const full = `/api/places-photos?media=${encodedPhoto}&maxHeight=2400&maxWidth=2400`

      return {
        id: `google-${photoName.split('/').pop() || index}`,
        source: 'Google Maps',
        thumb,
        src,
        hashSrc: thumb,
        full,
        width: photo.widthPx,
        height: photo.heightPx,
        legend: place.displayName?.text || cleanName,
        auteur: author,
        pageUrl: authorUri,
      }
    })

    // Gestion de la taille du cache mémoire (max 300 entrées)
    if (searchCache.size > 300) {
      const oldestKey = searchCache.keys().next().value
      searchCache.delete(oldestKey)
    }
    searchCache.set(cacheKey, { timestamp: Date.now(), photos })

    if (res.setHeader) {
      res.setHeader('X-Cache', 'MISS')
      res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=1800, stale-while-revalidate=86400')
      res.setHeader('X-Content-Type-Options', 'nosniff')
    }

    return res.status(200).json({ photos })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
