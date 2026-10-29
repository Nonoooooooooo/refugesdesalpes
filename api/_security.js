// Garde-fous partagés par les fonctions /api (le préfixe « _ » empêche Vercel d'en faire une route).

const ALLOWED_HOSTS = new Set(['refugesdesalpes.fr', 'www.refugesdesalpes.fr', 'localhost', '127.0.0.1'])

/**
 * Refuse les appels lancés depuis la page d'un autre site (Origin ou Referer étranger).
 * Les requêtes sans Origin ni Referer (navigation directe, PWA, <img> sans Referer) restent acceptées :
 * ce contrôle protège nos quotas contre les sites tiers, pas contre un script qui forge ses en-têtes.
 */
export function isAllowedOrigin(req) {
  const origin = req.headers?.origin || req.headers?.referer
  if (!origin) return true
  try {
    const host = new URL(origin).hostname.toLowerCase()
    if (ALLOWED_HOSTS.has(host)) return true
    // Préversions Vercel et tout autre domaine qui sert le site : l'appel vient alors du même hôte
    const reqHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
      .split(':')[0]
      .toLowerCase()
    return Boolean(reqHost) && host === reqHost
  } catch {
    return false
  }
}

/** Adresse IP du visiteur (Vercel remplace x-real-ip / x-forwarded-for, le client ne peut pas les imposer). */
export function clientIp(req) {
  return (
    req.headers?.['x-real-ip'] ||
    String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'inconnue'
  )
}

/**
 * Limiteur en mémoire : au plus `max` appels par IP et par fenêtre de `windowMs`.
 * Chaque instance de fonction a sa propre table : c'est un frein, pas un plafond global.
 */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map()
  return function isRateLimited(ip) {
    const now = Date.now()
    if (hits.size > 5000) {
      for (const [key, rec] of hits) {
        if (now - rec.start > windowMs) hits.delete(key)
      }
    }
    const rec = hits.get(ip)
    if (!rec || now - rec.start > windowMs) {
      hits.set(ip, { start: now, count: 1 })
      return false
    }
    rec.count += 1
    return rec.count > max
  }
}
