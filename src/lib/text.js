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
