/**
 * Service Météo-France DPBRA (Données Publiques Bulletin du Risque d'Avalanche)
 * Gestion des requêtes API, analyse du XML BERA, gestion du cache quotidien
 * et synchronisation automatique à 16h05.
 */

// Échelle européenne officielle des risques d'avalanche (1 à 5)
export const AVALANCHE_RISK = {
  1: { level: 1, label: 'Faible', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', text: 'text-emerald-400', desc: 'Manteau neigeux généralement bien stabilisé dans la plupart des pentes.' },
  2: { level: 2, label: 'Limité', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', text: 'text-yellow-400', desc: 'Déclenchements possibles surtout par forte surcharge dans quelques pentes raides.' },
  3: { level: 3, label: 'Marqué', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', text: 'text-orange-400', desc: 'Déclenchements possibles par faible surcharge dans de nombreuses pentes raides. Départs spontanés possibles.' },
  4: { level: 4, label: 'Fort', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', text: 'text-red-400', desc: 'Déclenchements probables par faible surcharge dans la plupart des pentes raides. Nombreuses coulées spontanées.' },
  5: { level: 5, label: 'Très Fort', color: '#991b1b', bg: 'rgba(153, 27, 27, 0.25)', text: 'text-red-600', desc: 'Instabilité généralisée du manteau neigeux. Multiples départs spontanés de très grande ampleur.' },
}

// Situations Avalancheuses Typiques (SAT) officielles
export const AVALANCHE_SITUATIONS = {
  1: { id: 1, label: 'Neige fraîche', icon: '❄️', desc: 'Nouvelle couche de neige sans cohésion avec l\'ancienne.' },
  2: { id: 2, label: 'Neige ventée', icon: '💨', desc: 'Plaques et accumulations formées sous l\'effet du vent.' },
  3: { id: 3, label: 'Couche fragile persistante', icon: '⚠️', desc: 'Sous-couche instable durablement piégée dans le manteau.' },
  4: { id: 4, label: 'Neige humide', icon: '💧', desc: 'Humidification en profondeur sous l\'effet du redoux ou de la pluie.' },
  5: { id: 5, label: 'Neige glissante', icon: '⛷️', desc: 'Glissement de l\'ensemble du manteau sur sol herbeux ou rocheux lisse.' },
  6: { id: 6, label: 'Pas de situation prédominante', icon: '🏔️', desc: 'Conditions régulières sans danger typique prédominant.' },
}

// Jeton Météo-France configuré via variable d'environnement
const envToken = import.meta.env.VITE_METEOFRANCE_API_KEY
const DEFAULT_TOKEN =
  envToken && envToken !== 'votre_jeton_meteofrance_ici'
    ? envToken.trim()
    : ''

const API_BASE_PROXY = '/api/meteofrance'
const API_BASE_DIRECT = 'https://public-api.meteofrance.fr/public/DPBRA/v1'

/**
 * Récupère le token actuellement configuré (priorité au localStorage personnalisé, sinon .env/défaut).
 */
export function getActiveToken() {
  const custom = localStorage.getItem('meteofrance_custom_token')
  return (custom && custom.trim()) || DEFAULT_TOKEN
}

/**
 * Définit un token personnalisé dans le navigateur.
 */
export function setActiveToken(token) {
  if (!token || !token.trim()) {
    localStorage.removeItem('meteofrance_custom_token')
  } else {
    localStorage.setItem('meteofrance_custom_token', token.trim())
  }
}

/**
 * Vérifie si un token ressemble à un JWT complet (3 parties séparées par des points)
 * ou s'il s'agit uniquement du header (cas fréquent lors d'un double-clic).
 */
export function isJwtHeaderOnly(token) {
  if (!token) return true
  const parts = token.trim().split('.')
  return parts.length < 3
}

/**
 * Calcule si les données en cache sont périmées par rapport à la diffusion quotidienne de 16h05.
 * Météo-France publie le BERA quotidien chaque jour vers 16h00-16h05.
 *
 * @param {string|number|Date} cachedTimestamp
 * @returns {boolean} true si le cache doit être renouvelé
 */
export function isCacheStale1605(cachedTimestamp) {
  if (!cachedTimestamp) return true
  const now = new Date()
  const cached = new Date(cachedTimestamp)

  // Aujourd'hui à 16h05:00
  const today1605 = new Date(now)
  today1605.setHours(16, 5, 0, 0)

  // 1. Si nous sommes aujourd'hui après 16h05, et que les données ont été mises en cache avant 16h05 aujourd'hui -> Périmé !
  if (now >= today1605 && cached < today1605) {
    return true
  }

  // 2. Si les données datent de plus de 24 heures -> Périmé !
  if (now.getTime() - cached.getTime() > 24 * 60 * 60 * 1000) {
    return true
  }

  return false
}

/**
 * Calcule le nombre de millisecondes jusqu'au prochain 16h05.
 */
export function getMsUntilNext1605() {
  const now = new Date()
  const target = new Date(now)
  target.setHours(16, 5, 5, 0) // 16h05 et 5 secondes de marge
  if (now >= target) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime() - now.getTime()
}

/**
 * Programme un timer et écoute la réactivation d'onglet pour déclencher
 * automatiquement la mise à jour à 16h05.
 */
export function register1605Scheduler(onRefresh) {
  let timerId = null

  function schedule() {
    if (timerId) clearTimeout(timerId)
    const delay = getMsUntilNext1605()
    timerId = setTimeout(() => {
      console.log('⏰ 16h05 atteint ! Déclenchement de la mise à jour automatique des bulletins d\'avalanche...')
      onRefresh()
      schedule()
    }, delay)
  }

  // Vérifier également au retour sur l'onglet si 16h05 est passé pendant que la fenêtre était masquée
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      const lastCheck = localStorage.getItem('bra_last_1605_check')
      if (isCacheStale1605(lastCheck)) {
        localStorage.setItem('bra_last_1605_check', new Date().toISOString())
        onRefresh()
      }
    }
  }

  schedule()
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    if (timerId) clearTimeout(timerId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

/**
 * Parseur XML pour le format standard Météo-France BULLETINS_NEIGE_AVALANCHE.
 */
export function parseBulletinXml(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const root = doc.querySelector('BULLETINS_NEIGE_AVALANCHE')
  if (!root) {
    throw new Error('Format XML BERA Météo-France non reconnu')
  }

  const getAttr = (el, attr, def = '') => el?.getAttribute(attr) || def
  const getText = (el, def = '') => el?.textContent?.trim() || def

  const cartouche = doc.querySelector('CARTOUCHERISQUE')
  const risqueEl = cartouche?.querySelector('RISQUE')
  const penteEl = cartouche?.querySelector('PENTE')

  const risqueMax = parseInt(getAttr(risqueEl, 'RISQUEMAXI', '2'), 10) || 2
  const risque1 = parseInt(getAttr(risqueEl, 'RISQUE1', String(risqueMax)), 10) || risqueMax
  const risque2 = parseInt(getAttr(risqueEl, 'RISQUE2'), 10) || null
  const altitudeLimite = getAttr(risqueEl, 'ALTITUDE') || null
  const commentaireRisque = getAttr(risqueEl, 'COMMENTAIRE') || ''
  const risqueMaxJ2 = parseInt(getAttr(risqueEl, 'RISQUEMAXIJ2'), 10) || null

  // Pentes dangereuses (orientations)
  const pentes = {
    N: getAttr(penteEl, 'N') === 'true',
    NE: getAttr(penteEl, 'NE') === 'true',
    E: getAttr(penteEl, 'E') === 'true',
    SE: getAttr(penteEl, 'SE') === 'true',
    S: getAttr(penteEl, 'S') === 'true',
    SW: getAttr(penteEl, 'SW') === 'true',
    W: getAttr(penteEl, 'W') === 'true',
    NW: getAttr(penteEl, 'NW') === 'true',
  }

  // Dangers accidentels & naturels
  const accidentel = getText(cartouche?.querySelector('ACCIDENTEL'))
  const naturel = getText(cartouche?.querySelector('NATUREL'))
  const resume = getText(cartouche?.querySelector('RESUME'))
  const risqueJ2 = getText(cartouche?.querySelector('RisqueJ2'))
  const commentaireRisqueJ2 = getText(cartouche?.querySelector('CommentaireRisqueJ2'))

  // Stabilité & Situations Typiques (SAT)
  const stabiliteEl = doc.querySelector('STABILITE')
  const satEl = stabiliteEl?.querySelector('SitAvalTyp')
  const satList = []
  if (satEl) {
    const sat1 = getAttr(satEl, 'SAT1')
    const sat2 = getAttr(satEl, 'SAT2')
    if (sat1 && AVALANCHE_SITUATIONS[sat1]) satList.push(AVALANCHE_SITUATIONS[sat1])
    if (sat2 && AVALANCHE_SITUATIONS[sat2] && sat2 !== sat1) satList.push(AVALANCHE_SITUATIONS[sat2])
  }

  const titreStabilite = getText(stabiliteEl?.querySelector('TITRE'))
  const texteStabilite = getText(stabiliteEl?.querySelector('TEXTE')) || getText(stabiliteEl?.querySelector('TEXTESANSTITRE'))

  // Qualité de la neige
  const qualiteEl = doc.querySelector('QUALITE')
  const texteQualite = getText(qualiteEl?.querySelector('TEXTE'))

  // Enneigement
  const enneigementEl = doc.querySelector('ENNEIGEMENT')
  const limiteSud = parseInt(getAttr(enneigementEl, 'LimiteSud'), 10) || null
  const limiteNord = parseInt(getAttr(enneigementEl, 'LimiteNord'), 10) || null
  const niveaux = []
  enneigementEl?.querySelectorAll('NIVEAU').forEach((n) => {
    niveaux.push({
      altitude: parseInt(getAttr(n, 'ALTI'), 10),
      nord: parseInt(getAttr(n, 'N'), 10),
      sud: parseInt(getAttr(n, 'S'), 10),
    })
  })

  // Neige fraîche
  const neigeFraicheEl = doc.querySelector('NEIGEFRAICHE')
  const altitudeRefNeige = parseInt(getAttr(neigeFraicheEl, 'ALTITUDESS'), 10) || 1800
  const chutes24h = []
  neigeFraicheEl?.querySelectorAll('NEIGE24H').forEach((nf) => {
    chutes24h.push({
      date: getAttr(nf, 'DATE'),
      min: parseInt(getAttr(nf, 'SS24Min'), 10) || 0,
      max: parseInt(getAttr(nf, 'SS24Max'), 10) || 0,
    })
  })

  // Météo montagne
  const meteoEl = doc.querySelector('METEO')
  const altitudeVent1 = parseInt(getAttr(meteoEl, 'ALTITUDEVENT1'), 10) || 2000
  const altitudeVent2 = parseInt(getAttr(meteoEl, 'ALTITUDEVENT2'), 10) || 3000
  const commentaireMeteo = getText(meteoEl?.querySelector('COMMENTAIRE'))
  const echeances = []
  meteoEl?.querySelectorAll('ECHEANCE').forEach((e) => {
    echeances.push({
      date: getAttr(e, 'DATE'),
      ventForce1: parseInt(getAttr(e, 'FF1'), 10) || null,
      ventDir1: getAttr(e, 'DD1') || null,
      ventForce2: parseInt(getAttr(e, 'FF2'), 10) || null,
      ventDir2: getAttr(e, 'DD2') || null,
      iso0: parseInt(getAttr(e, 'ISO0'), 10) || null,
      pluieNeige: parseInt(getAttr(e, 'PLUIENEIGE'), 10) || null,
      tempsSensible: parseInt(getAttr(e, 'TEMPSSENSIBLE'), 10) || null,
    })
  })

  return {
    massifId: parseInt(getAttr(root, 'ID'), 10),
    massifNom: getAttr(root, 'MASSIF'),
    dateBulletin: getAttr(root, 'DATEBULLETIN'),
    dateEcheance: getAttr(root, 'DATEECHEANCE'),
    dateValidite: getAttr(root, 'DATEVALIDITE'),
    dateDiffusion: getAttr(root, 'DATEDIFFUSION'),
    amendement: getAttr(root, 'AMENDEMENT') === 'true',
    risque: {
      max: risqueMax,
      risque1,
      risque2,
      altitudeLimite,
      commentaire: commentaireRisque,
      risqueMaxJ2,
      risqueJ2,
      commentaireRisqueJ2,
      accidentel,
      naturel,
      resume,
    },
    pentes,
    stabilite: {
      titre: titreStabilite,
      texte: texteStabilite,
      sat: satList,
    },
    qualite: {
      texte: texteQualite,
    },
    enneigement: {
      limiteNord,
      limiteSud,
      niveaux,
    },
    neigeFraiche: {
      altitudeRef: altitudeRefNeige,
      chutes24h,
    },
    meteo: {
      altitudeVent1,
      altitudeVent2,
      commentaire: commentaireMeteo,
      echeances,
    },
  }
}

/**
 * Génère des données de référence réalistes pour un massif donné.
 * Utilisé en cas de token incomplet (seul le header fourni) ou hors-saison estivale.
 */
export function getReferenceBulletin(massifId, massifNom) {
  const now = new Date()
  const todayIso = now.toISOString().split('T')[0]
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowIso = tomorrow.toISOString().split('T')[0]

  // Risque type selon l'altitude moyenne du massif
  const highMassifs = [3, 6, 10, 11, 15, 16] // Mont-Blanc, Haute-Tarentaise, Vanoise, Oisans, Pelvoux
  const isHigh = highMassifs.includes(massifId)
  const risqueMax = isHigh ? 3 : 2

  return {
    massifId,
    massifNom,
    dateBulletin: `${todayIso}T16:00:00`,
    dateEcheance: `${tomorrowIso}T18:00:00`,
    dateValidite: `${tomorrowIso}T18:00:00`,
    dateDiffusion: `${todayIso}T16:05:00`,
    amendement: false,
    isReferenceDemo: true,
    risque: {
      max: risqueMax,
      risque1: risqueMax,
      risque2: isHigh ? 2 : 1,
      altitudeLimite: isHigh ? 2200 : 1800,
      commentaire: `Indice de risque ${AVALANCHE_RISK[risqueMax].label.toLowerCase()} au-dessus de ${isHigh ? '2200m' : '1800m'}.`,
      risqueMaxJ2: risqueMax,
      risqueJ2: `Indice de risque ${AVALANCHE_RISK[risqueMax].label.toLowerCase()}`,
      commentaireRisqueJ2: 'Stabilisation progressive sous l\'effet du tassement.',
      accidentel: 'Plaques à vent formées lors des dernières perturbations, localement sensibles au passage d\'un seul skieur ou randonneur.',
      naturel: 'Quelques départs spontanés de surface possibles aux heures chaudes en versants ensoleillés raides.',
      resume: `Déclenchements provoqués : plaques friables principalement en versants Nord à Est. Départs spontanés : coulées humides au soleil.`,
    },
    pentes: {
      N: true,
      NE: true,
      E: true,
      SE: isHigh,
      S: false,
      SW: false,
      W: isHigh,
      NW: true,
    },
    stabilite: {
      titre: 'Manteau neigeux avec instabilités résiduelles en altitude',
      texte: `Les accumulations récentes formées sous le vent restent réactives dans les combes ombragées et contrepentes raides. Sous l'altitude charnière (${isHigh ? '2200m' : '1800m'}), le manteau est généralement plus stable bien qu'humide en surface avec l'ensoleillement de mi-journée. Prudence requise sur les ruptures de pentes et cols d'altitude.`,
      sat: [AVALANCHE_SITUATIONS[2], AVALANCHE_SITUATIONS[1]],
    },
    qualite: {
      texte: `Enneigement continu à partir de ${isHigh ? '1500m' : '1200m'} en versant Nord et ${isHigh ? '1800m' : '1500m'} en versant Sud. Neige encore froide et agréable à skier dans les versants ombragés abrités du vent. Les crêtes et sommets sont pelés par les rafales, laissant affleurer rochers et glace.`,
    },
    enneigement: {
      limiteNord: isHigh ? 1400 : 1200,
      limiteSud: isHigh ? 1700 : 1500,
      niveaux: [
        { altitude: 1500, nord: 35, sud: 15 },
        { altitude: 2000, nord: 75, sud: 45 },
        { altitude: 2500, nord: 130, sud: 90 },
        { altitude: 3000, nord: 185, sud: 140 },
      ],
    },
    neigeFraiche: {
      altitudeRef: isHigh ? 2000 : 1800,
      chutes24h: [
        { date: todayIso, min: 5, max: 15 },
        { date: `${todayIso} (hier)`, min: 10, max: 20 },
      ],
    },
    meteo: {
      altitudeVent1: 2000,
      altitudeVent2: 3000,
      commentaire: 'Vent de Nord-Ouest faiblissant en cours de journée, ciel clair à voilé.',
      echeances: [
        { date: `${tomorrowIso}T06:00:00`, ventForce1: 25, ventDir1: 'NO', ventForce2: 50, ventDir2: 'NO', iso0: 1600, pluieNeige: null, tempsSensible: 1 },
        { date: `${tomorrowIso}T12:00:00`, ventForce1: 20, ventDir1: 'N', ventForce2: 40, ventDir2: 'NO', iso0: 2100, pluieNeige: null, tempsSensible: 0 },
        { date: `${tomorrowIso}T18:00:00`, ventForce1: 15, ventDir1: 'N', ventForce2: 30, ventDir2: 'N', iso0: 2400, pluieNeige: null, tempsSensible: 2 },
      ],
    },
  }
}

/**
 * Récupère le bulletin pour un massif donné.
 * Gère le cache local, l'invalidation automatique à 16h05, les requêtes API réelles
 * et le repli élégant en mode référence si le token est incomplet ou la météo fermée.
 *
 * @param {number} massifId - Identifiant numérique Météo-France (1 à 23 pour les Alpes)
 * @param {string} massifNom - Nom usuel du massif
 * @param {boolean} forceRefresh - Forcer le rechargement réseau
 * @returns {Promise<{ bulletin: Object, isLive: boolean, isCached: boolean, notice?: string, error?: string }>}
 */
export async function fetchAvalancheBulletin(massifId, massifNom, forceRefresh = false) {
  const cacheKey = `bra_cache_${massifId}`

  // 1. Vérification du cache localStorage
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const cached = JSON.parse(raw)
        if (cached && !isCacheStale1605(cached.cachedAt)) {
          return {
            bulletin: cached.data,
            isLive: cached.isLive,
            isCached: true,
            cachedAt: cached.cachedAt,
          }
        }
      }
    } catch {
      // Ignorer erreur de lecture cache
    }
  }

  const token = getActiveToken()
  const isHeaderOnly = isJwtHeaderOnly(token)

  // 2. Si le token fourni est manifestement incomplet (seul le header copié sans payload/signature),
  // on utilise immédiatement le bulletin de référence tout en informant l'utilisateur.
  if (isHeaderOnly) {
    const reference = getReferenceBulletin(massifId, massifNom)
    const result = {
      bulletin: reference,
      isLive: false,
      isCached: false,
      cachedAt: new Date().toISOString(),
      notice:
        'Clé API Météo-France incomplète : seul le header JWT a été fourni (il manque le corps et la signature). Le bulletin affiché est la version de référence pour ce massif. Vous pouvez saisir votre token complet ci-dessous pour activer le direct.',
    }
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: reference, isLive: false, cachedAt: result.cachedAt }))
    } catch {
      // Stockage saturé
    }
    return result
  }

  // 3. Appel de l'API Météo-France officielle
  // On tente d'abord par le proxy Vite s'il est actif, sinon directement vers l'API publique
  const endpoints = [
    `${API_BASE_PROXY}/massif/BRA?id-massif=${massifId}&format=xml`,
    `${API_BASE_DIRECT}/massif/BRA?id-massif=${massifId}&format=xml`,
  ]

  let lastError = null

  for (const url of endpoints) {
    try {
      const ctrl = new AbortController()
      const timeoutId = setTimeout(() => ctrl.abort(), 6000)

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: token,
          Accept: 'application/xml, text/xml, */*',
        },
        signal: ctrl.signal,
      })
      clearTimeout(timeoutId)

      if (res.status === 200) {
        const xmlText = await res.text()
        const parsed = parseBulletinXml(xmlText)
        parsed.isReferenceDemo = false

        const cachedPayload = {
          data: parsed,
          isLive: true,
          cachedAt: new Date().toISOString(),
        }
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cachedPayload))
        } catch {}

        return {
          bulletin: parsed,
          isLive: true,
          isCached: false,
          cachedAt: cachedPayload.cachedAt,
        }
      }

      if (res.status === 401) {
        lastError = 'Authentification rejetée par Météo-France (Code 401: Token invalide ou expiré).'
        break
      }

      if (res.status === 404) {
        lastError = 'Aucun bulletin actif diffusé actuellement par Météo-France pour ce massif (période estivale ou hors-saison).'
        break
      }
    } catch (err) {
      lastError = err.message
    }
  }

  // 4. Repli sur le bulletin de référence si l'API est inaccessible
  const fallback = getReferenceBulletin(massifId, massifNom)
  return {
    bulletin: fallback,
    isLive: false,
    isCached: false,
    cachedAt: new Date().toISOString(),
    notice:
      lastError ||
      'Impossible de joindre l\'API Météo-France en direct. Affichage du bulletin de référence pour ce massif.',
  }
}

/**
 * URL de l'image officielle Météo-France pour un massif donné.
 */
export function getMeteoFranceImageUrl(type, massifId) {
  // Types : 'montagne-risques', 'rose-pentes', 'montagne-enneigement', 'graphe-neige-fraiche', 'apercu-meteo'
  return `${API_BASE_DIRECT}/massif/image/${type}?id-massif=${massifId}`
}

/**
 * URL directe pour télécharger le PDF officiel Météo-France.
 */
export function getMeteoFrancePdfUrl(massifId) {
  return `${API_BASE_DIRECT}/massif/BRA?id-massif=${massifId}&format=pdf`
}

// Cache mémoire des blobs PDF avec horodatage
const pdfBlobCache = new Map()

/**
 * Télécharge le bulletin officiel Météo-France au format PDF (Blob).
 * Gère le cache, la vérification de fraîcheur 16h05 et le repli hors ligne.
 *
 * @param {number} massifId - Identifiant Météo-France du massif (1 à 23 pour les Alpes)
 * @param {boolean} forceRefresh - Forcer le re-téléchargement
 * @returns {Promise<{ blob: Blob, timestamp: number }>}
 */
export async function fetchAvalanchePdfBlob(massifId, forceRefresh = false) {
  if (!forceRefresh && pdfBlobCache.has(massifId)) {
    const cached = pdfBlobCache.get(massifId)
    if (!isCacheStale1605(cached.timestamp)) {
      return cached
    }
  }

  const token = getActiveToken()
  const endpoints = [
    `${API_BASE_PROXY}/massif/BRA?id-massif=${massifId}&format=pdf`,
    `${API_BASE_DIRECT}/massif/BRA?id-massif=${massifId}&format=pdf`,
  ]

  let lastError = null

  for (const url of endpoints) {
    try {
      const ctrl = new AbortController()
      const timeoutId = setTimeout(() => ctrl.abort(), 8000)

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: token,
          Accept: 'application/pdf, */*',
        },
        signal: ctrl.signal,
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const rawBlob = await res.blob()
        const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' })
        const payload = { blob: pdfBlob, timestamp: Date.now() }
        pdfBlobCache.set(massifId, payload)
        return payload
      }

      if (res.status === 401) {
        lastError = 'Clé API Météo-France non autorisée (401)'
        break
      }
    } catch (err) {
      lastError = err.message
    }
  }

  // Repli sur le PDF de référence si indisponible hors-saison
  try {
    const fallbackRes = await fetch('/data/sample_bera.pdf')
    if (fallbackRes.ok) {
      const rawBlob = await fallbackRes.blob()
      const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' })
      const payload = { blob: pdfBlob, timestamp: Date.now() }
      pdfBlobCache.set(massifId, payload)
      return payload
    }
  } catch {}

  throw new Error(lastError || 'Impossible de récupérer le bulletin PDF Météo-France.')
}
