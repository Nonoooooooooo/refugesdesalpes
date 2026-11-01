/**
 * Service pour maintenir l'enregistrement GPS actif en arrière-plan et écran en veille
 * Fonctionne sur iOS (PWA / Safari) et Android (PWA / Chrome)
 *
 * Utilise la session audio silencieuse continue + MediaSession API
 * pour empêcher le système d'exploitation de suspendre l'exécution JavaScript
 * et l'écoute GPS (watchPosition) lorsque l'écran est verrouillé.
 */

// Son WAV silencieux 48 octets (1 seconde) ultra-léger
const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

let audioElement = null
let isKeeperRunning = false

export function startBackgroundKeeper() {
  if (typeof window === 'undefined') return
  if (isKeeperRunning && audioElement) return

  try {
    // 1. Déclarer la session comme "ambient" pour mixer avec la musique (Spotify, Apple Music, Podcasts)
    // sans JAMAIS couper ou mettre en pause la musique de l'utilisateur !
    if ('audioSession' in navigator) {
      try {
        navigator.audioSession.type = 'ambient'
      } catch {
        // Ignorer si non supporté
      }
    }

    if (!audioElement) {
      audioElement = document.createElement('audio')
      audioElement.setAttribute('loop', 'true')
      audioElement.setAttribute('playsinline', 'true')
      audioElement.setAttribute('preload', 'auto')
      audioElement.style.display = 'none'
      audioElement.src = SILENT_AUDIO_URI
      document.body.appendChild(audioElement)
    }

    const playPromise = audioElement.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isKeeperRunning = true
          setupMediaSession()
        })
        .catch((err) => {
          console.debug('[BackgroundKeeper] Audio play restreint:', err)
        })
    }
  } catch (err) {
    console.debug('[BackgroundKeeper] Erreur initialisation session:', err)
  }
}

export function stopBackgroundKeeper() {
  if (audioElement) {
    try {
      audioElement.pause()
      audioElement.currentTime = 0
    } catch {
      // ignore
    }
  }
  isKeeperRunning = false

  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none'
    } catch {
      // ignore
    }
  }
}

function setupMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

  try {
    // Ne pas écraser le lecteur de musique s'il y a déjà de la musique en cours (Spotify, etc.)
    if (typeof MediaMetadata !== 'undefined' && !navigator.mediaSession.metadata?.title) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Tracé GPS Randonnée',
        artist: 'Refuges des Alpes (Enregistrement actif)',
        album: 'GPS Montagne Hors-Ligne',
      })
    }
  } catch (e) {
    console.debug('[BackgroundKeeper] MediaSession error:', e)
  }
}
