const API = 'https://commons.wikimedia.org/w/api.php'
const stripHtml = (s = '') =>
  s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').trim()

/** Photos géolocalisées de Wikimedia Commons autour d'un point (sans clé d'API). */
export async function fetchCommonsPhotos(lat, lng, signal, radius = 250) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${lat}|${lng}`,
    ggsradius: String(radius),
    ggslimit: '30',
    ggsnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|sha1|size|mime',
    iiurlwidth: '960',
    format: 'json',
    origin: '*',
  })
  const res = await fetch(`${API}?${params}`, { signal })
  if (!res.ok) throw new Error(`Wikimedia (${res.status})`)
  const data = await res.json()
  const pages = Object.values(data.query?.pages ?? {})
  return pages
    .map((p) => ({ p, i: p.imageinfo?.[0] }))
    .filter(({ i }) => i && /^image\/(jpeg|png)$/.test(i.mime) && i.width >= 600)
    .map(({ p, i }) => {
      const meta = i.extmetadata ?? {}
      return {
        id: `wm-${p.pageid}`,
        source: 'Wikimedia Commons',
        thumb: i.thumburl,
        src: i.thumburl,
        hashSrc: i.thumburl,
        full: i.url,
        sha1: i.sha1,
        width: i.width,
        height: i.height,
        legend: stripHtml(meta.ImageDescription?.value) || p.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
        auteur: stripHtml(meta.Artist?.value),
        license: stripHtml(meta.LicenseShortName?.value),
        pageUrl: i.descriptionurl,
      }
    })
}
