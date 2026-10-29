/** Échappe un texte avant de l'insérer dans du HTML construit à la main (infobulles, divIcon Leaflet). */
export function escapeHtml(s = '') {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Nettoie le BBCode / HTML simple de Refuges.info en texte brut. */
export function cleanText(s = '') {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\/?(b|u|i|quote|url|img|list)(=[^\]]*)?\]/gi, '')
    .replace(/\[\*\]/g, '• ')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
