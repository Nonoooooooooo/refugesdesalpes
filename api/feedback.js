// Vercel Serverless Function & Vite Dev Handler: /api/feedback
// Réceptionne les messages de la chatbox du site et les retransmet en toute sécurité
// vers le serveur Discord via Webhook sans jamais exposer l'URL du webhook au client.

import { clientIp, createRateLimiter, isAllowedOrigin } from './_security.js'

export const maxDuration = 10

// Anti-spam en mémoire : max 5 messages par tranche de 10 minutes par adresse IP
const isRateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 })

// Retire les caractères de contrôle (hors retours à la ligne) qui pourraient brouiller l'affichage Discord
// oxlint-disable-next-line no-control-regex
const stripControlChars = (s) => s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')

export default async function handler(req, res) {
  // Pas d'en-tête CORS : seul le site lui-même (même origine) peut appeler ce point d'accès depuis un navigateur
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée (POST uniquement)' })
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Accès interdit : origine non autorisée' })
  }

  if (isRateLimited(clientIp(req))) {
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

  const cleanMessage = stripControlChars(String(message || '')).trim()
  if (!cleanMessage || cleanMessage.length < 2) {
    return res.status(400).json({ error: 'Veuillez renseigner votre message.' })
  }

  if (cleanMessage.length > 2000) {
    return res.status(400).json({ error: 'Le message ne doit pas dépasser 2000 caractères.' })
  }

  const cleanAuthor = stripControlChars(String(author || 'Anonyme')).slice(0, 60).trim()
  const cleanCategory = stripControlChars(String(category || 'Message Chatbox')).slice(0, 50).trim()

  // L'URL du webhook ne vit que dans les variables d'environnement (Vercel ou .env local), jamais dans le code
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(webhookUrl)) {
    console.error('Configuration manquante : DISCORD_WEBHOOK_URL absente ou invalide')
    return res.status(503).json({ error: 'Service de messagerie temporairement indisponible' })
  }

  const payload = {
    username: 'Refuges des Alpes · Chatbox',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/2903/2903542.png',
    // Aucune mention (@everyone, rôles, membres) ne peut être déclenchée par un visiteur
    allowed_mentions: { parse: [] },
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
