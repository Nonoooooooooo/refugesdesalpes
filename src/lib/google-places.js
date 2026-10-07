/**
 * Client pour récupérer les photos Google Maps via notre point d'accès serveur.
 */
export async function fetchGooglePlacesPhotos(name, lat, lng, signal) {
  if (!name || lat == null || lng == null) return []

  try {
    const params = new URLSearchParams({
      name,
      lat: String(lat),
      lng: String(lng),
    })

    const res = await fetch(`/api/places-photos?${params}`, { signal })
    if (!res.ok) return []

    const data = await res.json()
    return data.photos || []
  } catch (e) {
    if (signal?.aborted) throw e
    return []
  }
}
