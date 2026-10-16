import { useState, useEffect, useCallback } from 'react'
import { ensureAppShellCached } from './offlineService'

let deferredPrompt = null

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [installPromptReady, setInstallPromptReady] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)

  // 1. Enregistrement du Service Worker et mise en cache préventive de l'App Shell
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.MODE !== 'test') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker actif, portée:', reg.scope)
          // Synchroniser l'application shell en cache pour garantir un démarrage hors-ligne 100% autonome
          setTimeout(() => {
            ensureAppShellCached()
          }, 1200)
        })
        .catch((err) => {
          console.warn('[PWA] Échec enregistrement Service Worker:', err)
        })
    }
  }, [])

  // 2. Détection en ligne / hors-ligne
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      ensureAppShellCached()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 3. Détection de l'installation PWA et de la plateforme
  useEffect(() => {
    // Détection si déjà installé en mode autonome
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setIsInstalled(isStandalone)

    // Détection iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(userAgent)
    setIsIos(ios)

    // Écoute de l'événement natif d'installation Chrome / Android / Edge
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      deferredPrompt = e
      setInstallPromptReady(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPromptReady(false)
      deferredPrompt = null
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // 4. Déclencheur d'installation native
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    setInstallPromptReady(false)
    return outcome === 'accepted'
  }, [])

  return {
    isOnline,
    isInstalled,
    isIos,
    installPromptReady,
    promptInstall,
  }
}
