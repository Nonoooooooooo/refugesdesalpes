// Vercel Serverless Function: /api/places-photos
// Récupère les photos de Google Places (New) sans exposer la clé API au client.

export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return res.status(200).json({ photos: [], message: 'Google Places API Key non configurée' })
  }

  const { name, lat, lng } = req.query
  if (!name || !lat || !lng) {
    return res.status(400).json({ error: 'Paramètres manquants (name, lat, lng)' })
  }

  try {
    // 1. Recherche du lieu avec Places API (New) - searchText
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.photos',
      },
      body: JSON.stringify({
        textQuery: `${name} refuge`,
        locationBias: {
          circle: {
            center: {
              latitude: parseFloat(lat),
              longitude: parseFloat(lng),
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
      return res.status(200).json({ photos: [] })
    }

    // 2. Formatage des photos avec URI directes de Places API
    const photos = place.photos.slice(0, 8).map((photo, index) => {
      const photoName = photo.name // Format: places/{place_id}/photos/{photo_reference}
      const author = photo.authorAttributions?.[0]?.displayName || 'Google Maps'
      const authorUri = photo.authorAttributions?.[0]?.uri || null

      const thumb = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&maxWidthPx=400&key=${apiKey}`
      const src = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=1200&maxWidthPx=1200&key=${apiKey}`
      const full = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=2400&maxWidthPx=2400&key=${apiKey}`

      return {
        id: `google-${photoName.split('/').pop() || index}`,
        source: 'Google Maps',
        thumb,
        src,
        hashSrc: thumb,
        full,
        width: photo.widthPx,
        height: photo.heightPx,
        legend: place.displayName?.text || name,
        auteur: author,
        pageUrl: authorUri,
      }
    })

    return res.status(200).json({ photos })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
