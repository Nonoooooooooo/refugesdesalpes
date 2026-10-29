// Vercel Serverless Function & Vite Dev Handler: /api/webcams
// Relaie l'API Windy Webcams v3 en ajoutant la clé côté serveur :
// elle n'apparaît plus dans le JavaScript téléchargé par les visiteurs.

import { clientIp, createRateLimiter, isAllowedOrigin } from './_security.js'

export const maxDuration = 10

const WINDY_WEBCAMS_URL = 'https://api.windy.com/webcams/api/v3/webcams'
const BBOX_PATTERN = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/

// Le client interroge Windy à chaque déplacement de carte (zoom ≥ 10), parfois deux fois (ordre de bbox de secours)
const isRateLimited = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 150 })

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée (GET uniquement)' })
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Accès interdit : origine non autorisée' })
  }

  // VITE_WINDY_API_KEY reste lue pour les déploiements existants ; WINDY_API_KEY est le nom recommandé
  const apiKey = (process.env.WINDY_API_KEY || process.env.VITE_WINDY_API_KEY || '').trim()
  if (!apiKey || apiKey === 'votre_cle_windy_ici') {
    return res.status(503).json({ error: 'Clé API Windy Webcams non configurée' })
  }

  const bbox = String(req.query?.bbox || '').trim()
  if (!BBOX_PATTERN.test(bbox)) {
    return res.status(400).json({ error: 'Paramètre bbox invalide (4 nombres séparés par des virgules)' })
  }

  if (isRateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Trop de requêtes webcams, réessayez dans quelques minutes.' })
  }

  try {
    const upstream = await fetch(`${WINDY_WEBCAMS_URL}?bbox=${bbox}&include=location,player&limit=50`, {
      headers: {
        'x-windy-key': apiKey,
        'x-windy-api-key': apiKey,
      },
    })

    if (!upstream.ok) {
      console.error('Windy Webcams:', upstream.status, (await upstream.text()).slice(0, 300))
      // Les erreurs 4xx (bbox refusée…) sont renvoyées telles quelles : le client retente avec l'autre ordre de bbox
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: 'Erreur API Windy Webcams' })
    }

    const data = await upstream.json()
    // Les liens d'images Windy expirent au bout de quelques minutes : cache court
    res.setHeader('Cache-Control', 'public, s-maxage=120, max-age=60')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(200).json(data)
  } catch (err) {
    console.error('Exception Windy Webcams:', err)
    return res.status(502).json({ error: 'Erreur réseau Windy Webcams' })
  }
}
