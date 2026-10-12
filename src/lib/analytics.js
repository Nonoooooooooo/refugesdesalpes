/**
 * Helper sécurisé pour Google Analytics 4 (GA4).
 * Ne génère pas d'erreur si un adblocker est actif ou en environnement hors-navigateur.
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    try {
      window.gtag('event', eventName, params)
    } catch {
      // Ignore silencieusement en cas de restriction navigateur
    }
  }
}
