// Vercel Serverless Function & Vite Dev Handler: /api/feedback
// Réceptionne les messages de la chatbox du site et les retransmet en toute sécurité
// vers le serveur Discord via Webhook sans jamais exposer l'URL du webhook au client.

export const maxDuration = 10

// Anti-spam en mémoire : max 5 messages par tranche de 5 minutes par adresse IP
const ipRateLimit = new Map()
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const MAX_MESSAGES_PER_WINDOW = 5

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
  if (!origin) return true
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
  }

  const { message, category, author, botField } = body || {}

  // Protection Honeypot anti-bots : si le champ invisible est rempli, on feint le succès
  if (botField) {
    return res.status(200).json({ success: true, message: 'Message transmis avec succès' })
  }

  const cleanMessage = String(message || '').trim()
  if (!cleanMessage || cleanMessage.length < 3) {
    return res.status(400).json({ error: 'Le message doit contenir au moins 3 caractères' })
  }

  if (cleanMessage.length > 2000) {
    return res.status(400).json({ error: 'Le message ne doit pas dépasser 2000 caractères' })
  }

  const cleanAuthor = String(author || 'Anonyme').slice(0, 60).trim()
  const cleanCategory = String(category || 'Donnée erronée').slice(0, 50).trim()

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  const isWebhookConfigured =
    webhookUrl &&
    typeof webhookUrl === 'string' &&
    webhookUrl.startsWith('https://discord.com/api/webhooks/')

  // Couleurs des embeds Discord selon la catégorie
  const categoryColors = {
    'Donnée erronée': 0xf59e0b, // Ambre / Orange
    'Suggestion': 0x8b5cf6, // Violet
    'Encouragement': 0xec4899, // Rose
    'Autre': 0x0284c7, // Bleu alpin
  }
  const embedColor = categoryColors[cleanCategory] || 0x0284c7

  const payload = {
    username: 'Refuges des Alpes · Chatbox',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/2903/2903542.png',
    embeds: [
      {
        title: `📬 Nouveau retour : ${cleanCategory}`,
        color: embedColor,
        description: cleanMessage,
        fields: [
          {
            name: 'Auteur',
            value: cleanAuthor || 'Anonyme',
            inline: true,
          },
          {
            name: 'Catégorie',
            value: cleanCategory,
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

  // Si le webhook n'est pas encore renseigné (ex: en cours de dev ou avant config Vercel)
  if (!isWebhookConfigured) {
    console.log('\n[FEEDBACK DISCORD - MODE SIMULATION]')
    console.log('Auteur:', cleanAuthor)
    console.log('Catégorie:', cleanCategory)
    console.log('Message:', cleanMessage)
    console.log('Note: Configurez DISCORD_WEBHOOK_URL dans .env ou Vercel pour recevoir en direct sur Discord.\n')

    return res.status(200).json({
      success: true,
      mocked: true,
      message: 'Message bien reçu ! (Mode démo : le Webhook Discord sera opérationnel dès sa configuration dans .env/Vercel).',
    })
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
      message: 'Votre message a bien été envoyé sur notre serveur Discord. Merci pour votre aide !',
    })
  } catch (err) {
    console.error('Exception Webhook Discord:', err)
    return res.status(500).json({ error: 'Erreur réseau lors de l\'envoi vers Discord' })
  }
}
