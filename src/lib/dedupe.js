/**
 * Dédoublonnage de photos issues de plusieurs sources.
 * 1) doublons exacts : même sha1 (Wikimedia)
 * 2) quasi-doublons : hash perceptuel dHash 64 bits + distance de Hamming
 */
const HAMMING_THRESHOLD = 6
const PRIORITY = { 'Refuges.info': 0, 'Wikimedia Commons': 1, 'Google Maps': 2 }

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** dHash : image réduite à 9x8 en gris, bit = pixel plus clair que son voisin de droite. */
async function dHash(url) {
  const img = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = 9
  canvas.height = 8
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, 9, 8)
  const { data } = ctx.getImageData(0, 0, 9, 8) // lève une erreur si canvas "tainted"
  const gray = []
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }
  const bits = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits.push(gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1 : 0)
  }
  return bits
}

const hamming = (a, b) => a.reduce((n, bit, i) => n + (bit !== b[i] ? 1 : 0), 0)

/**
 * @param {Array} photos objets { id, source, sha1?, hashSrc?, width?, ... }
 * Retourne la liste sans doublons, la source la plus prioritaire étant conservée.
 */
export async function dedupePhotos(photos) {
  const sorted = [...photos].sort(
    (a, b) =>
      (PRIORITY[a.source ?? 'Refuges.info'] ?? 9) - (PRIORITY[b.source ?? 'Refuges.info'] ?? 9) ||
      (b.width ?? 0) - (a.width ?? 0),
  )

  // 1) sha1 + id
  const seen = new Set()
  const unique = sorted.filter((p) => {
    const key = p.sha1 ?? p.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 2) hash perceptuel (si l'image est lisible, sinon on garde la photo)
  const hashes = await Promise.all(
    unique.map((p) => (p.hashSrc ? dHash(p.hashSrc).catch(() => null) : null)),
  )
  const kept = []
  const keptHashes = []
  unique.forEach((p, i) => {
    const h = hashes[i]
    if (h && keptHashes.some((k) => hamming(h, k) <= HAMMING_THRESHOLD)) return
    kept.push(p)
    if (h) keptHashes.push(h)
  })
  return kept
}
