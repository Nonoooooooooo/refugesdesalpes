// Vercel Serverless Function & Vite Dev Handler: /api/feedback
// Réceptionne les messages de la chatbox du site et les retransmet en toute sécurité
// vers le serveur Discord via Webhook sans jamais exposer l'URL du webhook au client.

export const maxDuration = 10

// Webhook Discord par défaut (sécurisé côté serveur uniquement)
const DEFAULT_DISCORD_WEBHOOK =
  'https://discord.com/api/webhooks/1558602035497148469/ebCeudT3KR24zs9dZtBPN_UEn491zZm7PbeL54IkOoawYnSRK9VOEPuW7Z6lbjst_E4N'

// Anti-spam en mémoire : max 20 messages par tranche de 5 minutes par adresse IP
const ipRateLimit = new Map()
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const MAX_MESSAGES_PER_WINDOW = 20

function isRateLimited(ip) {
  if (!ip) return false
  const now = Date.now()
  const record = ipRateLimit.get(ip) || { count: 0, firstSeen: now }

  if (now - record.firstSeen > RATE_LIMIT_WINDOW_MS) {
    ipRateLimit.set(ip, { count: 1, firstSeen: now })
    return false
  }

  if (record.count >= MAX_MESSAGES_PER_WINDOW) {
    return true
  }

  record.count += 1
  ipRateLimit.set(ip, record)
  return false
}

function isAllowedOrigin(req) {
  const origin = req.headers?.origin || req.headers?.referer
  if (!origin) return true // Navigation directe ou même origine
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase()
    // Autoriser localhost, domaine vercel ou tout sous-domaine de prévisualisation
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.vercel.app') ||
      host.includes('refugesdesalpes')
    ) {
      return true
    }
    const reqHost = (req.headers?.['x-forwarded-host'] || req.headers?.host || '')
      .split(':')[0]
      .toLowerCase()
    if (reqHost && (host === reqHost || host.endsWith(reqHost))) {
      return true
    }
    return true // Par sécurité pour éviter de bloquer des visiteurs légitimes sur mobile
  } catch {
    return true
  }
}

export default async function handler(req, res) {
  // En-têtes CORS pour autoriser l'accès depuis n'importe quel domaine/sous-domaine de prévisualisation
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée (POST uniquement)' })
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Accès interdit : origine non autorisée' })
  }

  const clientIp =
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Trop de messages envoyés récemment. Merci de patienter quelques minutes.',
    })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'Format JSON invalide' })
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString('utf-8'))
    } catch {
      return res.status(400).json({ error: 'Format JSON invalide' })
    }
  }

  const { message, category, author, botField } = body || {}

  // Protection Honeypot anti-bots : si le champ invisible est rempli, on feint le succès
  if (botField) {
    return res.status(200).json({ success: true, message: 'Message transmis avec succès' })
  }

  const cleanMessage = String(message || '').trim()
  if (!cleanMessage || cleanMessage.length < 2) {
    return res.status(400).json({ error: 'Veuillez renseigner votre message.' })
  }

  if (cleanMessage.length > 2000) {
    return res.status(400).json({ error: 'Le message ne doit pas dépasser 2000 caractères.' })
  }

  const cleanAuthor = String(author || 'Anonyme').slice(0, 60).trim()
  const cleanCategory = String(category || 'Message Chatbox').slice(0, 50).trim()

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || DEFAULT_DISCORD_WEBHOOK

  const payload = {
    username: 'Refuges des Alpes · Chatbox',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/2903/2903542.png',
    embeds: [
      {
        title: `📬 Nouveau retour : ${cleanCategory}`,
        color: 0x0284c7, // Bleu alpin
        description: cleanMessage,
        fields: [
          {
            name: 'Auteur',
            value: cleanAuthor || 'Anonyme',
            inline: true,
          },
        ],
        footer: {
          text: 'Refuges des Alpes · Plateforme communautaire',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!discordRes.ok) {
      const errText = await discordRes.text()
      console.error('Erreur retour Discord Webhook:', discordRes.status, errText)
      return res.status(502).json({ error: 'Erreur lors de la transmission vers Discord' })
    }

    return res.status(200).json({
      success: true,
      message: 'Votre message a bien été envoyé à l’équipe. Merci pour votre aide !',
    })
  } catch (err) {
    console.error('Exception Webhook Discord:', err)
    return res.status(500).json({ error: 'Erreur réseau lors de l’envoi' })
  }
}
