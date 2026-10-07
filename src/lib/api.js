const BASE = 'https://www.refuges.info'
const TIMEOUT_MS = 15000

async function getJson(url, signal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), TIMEOUT_MS)
  const onAbort = () => ctrl.abort(signal.reason)
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`)
    return await res.json()
  } catch (e) {
    if (signal?.aborted) throw e // annulation volontaire
    if (e.name === 'AbortError' || e.message === 'timeout') {
      throw new Error("Le serveur met trop de temps à répondre.")
    }
    throw new Error('Impossible de joindre Refuges.info. Vérifiez votre connexion.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Points dans l'étendue [left, bottom, right, top]. */
export async function fetchBbox([left, bottom, right, top], signal) {
  const bbox = [left, bottom, right, top].map((n) => n.toFixed(5)).join(',')
  const data = await getJson(`${BASE}/api/bbox?bbox=${bbox}`, signal)
  return (data.features ?? []).map((f) => ({
    id: f.properties.id ?? f.id,
    nom: f.properties.nom,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    type: f.properties.type?.valeur ?? 'autre',
    alt: f.properties.coord?.alt,
    places: f.properties.places?.valeur,
    etat: f.properties.etat?.valeur,
  }))
}

const fixPhoto = (path) =>
  path ? BASE + path.replace(/(jpe?g|png|webp)md=/, '$1?md=') : null

/** Détails + photos d'un point. */
export async function fetchPoint(id, signal) {
  const [pointData, comments] = await Promise.all([
    getJson(`${BASE}/api/point?id=${id}&detail=complet`, signal),
    getJson(`${BASE}/api/commentaires?id_point=${id}`, signal).catch((e) => {
      if (signal?.aborted) throw e
      return {} // les photos sont optionnelles
    }),
  ])
  const feature = pointData.features?.[0]
  if (!feature) throw new Error('Point introuvable.')
  const p = feature.properties

  const all = Object.values(comments).filter((c) => c && typeof c === 'object')
  const fixPhotoRel = (path) =>
    path ? '/rimg' + path.replace(/(jpe?g|png|webp)md=/, '$1?md=') : null

  const photos = all
    .filter((c) => c['photo-reduite'])
    .map((c) => ({
      id: `refuge-${c.id_commentaire}`,
      source: 'Refuges.info',
      thumb: fixPhoto(c['photo-vignette']),
      src: fixPhoto(c['photo-reduite']),
      hashSrc: fixPhotoRel(c['photo-vignette'] || c['photo-reduite']),
      full: fixPhoto(c['photo-originale'] ?? c['photo-reduite']),
      legend: c.texte_commentaire,
      auteur: c.auteur_commentaire,
      date: c.date_commentaire,
    }))

  return {
    id: p.id,
    nom: p.nom,
    type: p.type?.valeur,
    alt: p.coord?.alt,
    lat: p.coord?.lat,
    lng: p.coord?.long,
    etat: p.etat?.valeur,
    places: p.places?.valeur,
    lien: p.lien,
    acces: p.acces?.valeur,
    proprio: p.proprio?.valeur,
    description: p.description?.valeur,
    equipements: Object.values(p.info_comp ?? {}).map((i) => ({
      nom: i.nom,
      valeur: i.valeur,
    })),
    photos,
    comments: all
      .filter((c) => c.texte_commentaire)
      .map((c) => ({
        id: c.id_commentaire,
        texte: c.texte_commentaire,
        auteur: c.auteur_commentaire,
        date: c.date_commentaire,
        photo: fixPhoto(c['photo-vignette']),
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
  }
}
