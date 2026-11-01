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
          console.debug('[BackgroundKeeper] Audio play restreint (nécessite clic utilisateur):', err)
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
    // Configurer le widget écran de verrouillage
    if (typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Tracé GPS Randonnée',
        artist: 'Refuges des Alpes (Enregistrement en cours)',
        album: 'GPS Montagne Hors-Ligne',
      })
    }

    navigator.mediaSession.playbackState = 'playing'

    // Gérer les contrôles système si l'utilisateur appuie dessus depuis l'écran de verrouillage
    navigator.mediaSession.setActionHandler('play', () => {
      audioElement?.play()
      navigator.mediaSession.playbackState = 'playing'
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      // Garder l'audio pour ne pas couper le GPS accidentellement en poche
      audioElement?.play()
      navigator.mediaSession.playbackState = 'playing'
    })
  } catch (e) {
    console.debug('[BackgroundKeeper] MediaSession non supporté:', e)
  }
}
