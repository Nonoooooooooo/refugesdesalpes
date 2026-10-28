// Génère, après `vite build`, les pages statiques indexables :
//   /massifs               annuaire des massifs
//   /faq                   questions fréquentes (JSON-LD FAQPage)
//   /massif/<slug>         une page par massif alpin (refuges, gîtes, cabanes)
//   /refuge/<id>-<slug>    une page par refuge gardé et gîte d'étape
//   /sitemap.xml           sitemap complet (remplace celui de public/)
//
// Entrées : public/refuges_index.json, public/data/massifs_bra.geojson, scripts/seo/details.json
// (fiches Refuges.info, CC BY-SA 2.0, récupérées par fetch_details.js). Aucun appel réseau ici.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as turf from '@turf/turf'
import { getTimes } from 'suncalc'
import { MASSIF_INTROS } from './massif-intros.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIST = join(ROOT, 'dist')
const SITE = 'https://refugesdesalpes.fr'
const BUILD_DATE = new Date().toISOString().slice(0, 10)
const NEAR_TOLERANCE_KM = 25

if (!existsSync(DIST)) {
  console.error('dist/ introuvable : lancez `vite build` avant ce script.')
  process.exit(1)
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const points = readJson(join(ROOT, 'public', 'refuges_index.json'))
const massifsGeo = readJson(join(ROOT, 'public', 'data', 'massifs_bra.geojson'))
const detailsPath = join(ROOT, 'scripts', 'seo', 'details.json')
const details = existsSync(detailsPath) ? readJson(detailsPath) : {}

// ───────────── utilitaires ─────────────
const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const slugify = (s) =>
  norm(s)
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '')
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const nf = new Intl.NumberFormat('fr-FR')
const fmt = (n) => nf.format(n).replace(/\u202f/g, '\u00a0')
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

const nameById = new Map(points.map((p) => [String(p.id), p.nom]))

function cleanText(s = '') {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // liens internes Refuges.info : [texte->123] ou [->123] (on retombe sur le nom du point)
    .replace(/\[([^\]\[]*?)-&?(?:gt;|>)(\d+)\]/g, (_, text, id) => text.trim() || nameById.get(id) || 'un autre point')
    .replace(/\[\/?[a-z]+(=[^\]]*)?\]/gi, '')
    .replace(/\[\*\]/g, '• ')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Coupe proprement (fin de phrase ou de mot) sans dépasser max caractères. */
function excerpt(text, max) {
  if (text.length <= max) return { text, cut: false }
  const slice = text.slice(0, max)
  const sentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'))
  const cutAt = sentence > max * 0.5 ? sentence + 1 : slice.lastIndexOf(' ')
  return { text: slice.slice(0, cutAt).trim() + (sentence > max * 0.5 ? '' : '…'), cut: true }
}

const paragraphs = (text) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

function distKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// ───────────── massifs alpins ─────────────
const DISPLAY = { Devoluy: 'Dévoluy', 'Haut-Var/Haut-Verdon': 'Haut-Var et Haut-Verdon' }
const alpine = massifsGeo.features
  .filter((f) => {
    const n = parseInt(f.properties.id.replace('OPP', ''), 10)
    return n >= 1 && n <= 23
  })
  .map((f) => ({
    code: f.properties.id,
    slug: f.properties.slug,
    name: DISPLAY[f.properties.label] ?? f.properties.label.replace(/-/g, '-'),
    feature: f,
    bbox: turf.bbox(f),
    center: turf.centerOfMass(f).geometry.coordinates,
    members: [],
  }))

function findMassif(p) {
  const pt = turf.point([p.lng, p.lat])
  for (const m of alpine) {
    const [w, s, e, n] = m.bbox
    if (p.lng < w || p.lng > e || p.lat < s || p.lat > n) continue
    if (turf.booleanPointInPolygon(pt, m.feature)) return { massif: m, exact: true }
  }
  let best = null
  let bestD = Infinity
  for (const m of alpine) {
    const d = distKm({ lat: p.lat, lng: p.lng }, { lat: m.center[1], lng: m.center[0] })
    if (d < bestD) {
      bestD = d
      best = m
    }
  }
  return best && bestD < NEAR_TOLERANCE_KM + 20 ? { massif: best, exact: false } : null
}

// ───────────── types ─────────────
function kindOf(type) {
  const t = norm(type)
  if (t.includes('refuge garde')) return 'garde'
  if (t.includes('gite')) return 'gite'
  if (t.includes('cabane')) return 'cabane'
  return null // points d'eau, passages délicats, grottes… : pas de page
}
const KIND_LABEL = { garde: 'Refuge gardé', gite: "Gîte d'étape", cabane: 'Cabane non gardée' }
const KIND_PLURAL = { garde: 'Refuges gardés', gite: "Gîtes d'étape", cabane: 'Cabanes non gardées' }

const items = []
for (const p of points) {
  const kind = kindOf(p.type)
  if (!kind || typeof p.lat !== 'number' || typeof p.lng !== 'number') continue
  const found = findMassif(p)
  if (!found) continue
  const d = details[p.id]
  const alt = p.alt > 0 ? p.alt : null // 0 ou absent = altitude non renseignée dans Refuges.info
  const item = {
    ...p,
    alt,
    kind,
    massif: found.massif,
    exact: found.exact,
    details: d,
    hasPage: kind !== 'cabane' && alt !== null,
  }
  item.slug = `${p.id}-${slugify(p.nom) || 'refuge'}`
  item.url = `/refuge/${item.slug}`
  items.push(item)
  found.massif.members.push(item)
}

const pageItems = items.filter((i) => i.hasPage)
const mapLink = (i) => `/?refuge=${i.id}`
const byAlt = (a, b) => (b.alt ?? 0) - (a.alt ?? 0)
const altM = (n) => (n ? `${fmt(n)} m` : 'altitude inconnue')
const byName = (a, b) => a.nom.localeCompare(b.nom, 'fr')

// ───────────── gabarit ─────────────
const CSS = `
:root{color-scheme:dark;--bg:#020617;--card:#0f172a;--line:#1e293b;--txt:#e2e8f0;--mut:#94a3b8;--acc:#34d399}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:var(--acc)}a:hover{color:#6ee7b7}
header.site{border-bottom:1px solid var(--line);background:var(--card)}
.wrap{max-width:900px;margin:0 auto;padding:0 20px}
header.site .wrap{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding-top:12px;padding-bottom:12px}
header.site .brand{display:flex;align-items:center;gap:10px;font-weight:700;color:#fff;text-decoration:none}
header.site img{width:28px;height:28px;border-radius:6px}
header.site nav{display:flex;gap:16px;margin-left:auto;font-size:.95rem}
nav.crumbs{font-size:.88rem;color:var(--mut);padding:16px 0 0}nav.crumbs a{color:var(--mut)}
h1{font-size:1.9rem;line-height:1.2;margin:.6rem 0 .4rem;color:#fff}
h2{font-size:1.25rem;margin:2rem 0 .6rem;color:#6ee7b7}
.lead{color:var(--mut);margin:0 0 1rem}
.cta{display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;padding:.7rem 1.1rem;border-radius:999px;margin:.5rem 0}
.cta:hover{background:#047857;color:#fff}
table{width:100%;border-collapse:collapse;font-size:.95rem}th,td{text-align:left;padding:.45rem .5rem;border-bottom:1px solid var(--line)}th{color:var(--mut);font-weight:600}
dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:.3rem 1.2rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem}
dl.facts dt{color:var(--mut)}dl.facts dd{margin:0}
ul.cols{columns:2;column-gap:2rem;padding-left:1.1rem}ul.cols li{break-inside:avoid;margin-bottom:.25rem}
.src{font-size:.85rem;color:var(--mut);border-top:1px solid var(--line);margin-top:2rem;padding-top:1rem}
footer{margin-top:3rem;padding:1.5rem 0;border-top:1px solid var(--line);color:var(--mut);font-size:.88rem}
.faq{margin:1.5rem 0}
.faq details{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:0 0 .75rem;transition:border-color .2s}
.faq details[open]{border-color:#065f46}
.faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.2rem;border-radius:12px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"";flex:none;width:.55rem;height:.55rem;margin-top:-.3rem;border-right:2px solid var(--acc);border-bottom:2px solid var(--acc);transform:rotate(45deg);transition:transform .2s,margin .2s}
.faq details[open] summary::after{transform:rotate(-135deg);margin-top:.3rem}
.faq summary:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.faq summary h2{margin:0;font-size:1.05rem;line-height:1.4;color:#fff;transition:color .2s}
.faq summary:hover h2{color:#6ee7b7}
.faq .a{padding:0 1.2rem 1.1rem;color:#cbd5e1}.faq .a p{margin:0}.faq .a strong{color:#fff}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1.1rem 1.2rem;margin-top:2rem}.box h2{margin-top:0}.box p{margin:0 0 .5rem}
@media(prefers-reduced-motion:reduce){.faq details,.faq summary::after,.faq summary h2{transition:none}}
@media(max-width:600px){h1{font-size:1.5rem}ul.cols{columns:1}header.site nav{margin-left:0}.faq summary{padding:.9rem 1rem}.faq .a{padding:0 1rem 1rem}}
`

function layout({ path, title, description, h1, crumbs, body, schema }) {
  const url = `${SITE}${path}`
  const crumbHtml = crumbs
    .map((c, i) => (i === crumbs.length - 1 ? `<span>${esc(c.name)}</span>` : `<a href="${c.href}">${esc(c.name)}</a>`))
    .join(' › ')
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE}${c.href}`,
    })),
  }
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Refuges des Alpes">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og-image.jpg">
<meta name="theme-color" content="#0f172a">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
${jsonLd({ '@context': 'https://schema.org', '@graph': [...schema, breadcrumb] })}
<style>${CSS}</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-F5NXK7Q2RD"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-F5NXK7Q2RD');</script>
</head>
<body>
<header class="site"><div class="wrap">
<a class="brand" href="/"><img src="/favicon-48x48.png" alt="" width="28" height="28">Refuges des Alpes</a>
<nav aria-label="Navigation principale"><a href="/">Carte interactive</a><a href="/massifs">Massifs</a><a href="/faq">FAQ</a></nav>
</div></header>
<main class="wrap">
<nav class="crumbs" aria-label="Fil d’Ariane">${crumbHtml}</nav>
<h1>${esc(h1)}</h1>
${body}
</main>
<footer><div class="wrap">Refuges des Alpes · carte interactive gratuite des refuges, cabanes et gîtes des Alpes. Données Refuges.info (CC BY-SA 2.0), IGN, Météo-France, OpenStreetMap. · <a href="/faq">Questions fréquentes</a></div></footer>
</body>
</html>
`
}

/** Premier titre de la liste qui tient dans max caractères (sinon le dernier, tronqué). */
function fitTitle(candidates, max = 62) {
  const ok = candidates.find((t) => t.length <= max)
  if (ok) return ok
  const last = candidates[candidates.length - 1]
  return last.slice(0, max - 1).replace(/[\s,(·:-]+$/, '') + '…'
}

/** Raccourcit une meta description à max caractères en retirant des phrases entières en fin de texte. */
function fitDesc(text, max = 158) {
  if (text.length <= max) return text
  const sentences = text.split(/(?<=\.)\s+/)
  while (sentences.length > 1 && sentences.join(' ').length > max) sentences.pop()
  const out = sentences.join(' ')
  return out.length <= max ? out : out.slice(0, max - 1).replace(/[\s,;:]+$/, '') + '…'
}

function write(relPath, html) {
  const file = join(DIST, relPath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}

// ───────────── pages refuge ─────────────
const fmtTime = (d) =>
  d && !isNaN(d) ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(d) : '–'
function sunRow(label, date, lat, lng) {
  const t = getTimes(date, lat, lng)
  const ms = t.sunset - t.sunrise
  const h = Math.floor(ms / 3.6e6)
  const m = Math.round((ms % 3.6e6) / 6e4)
  return `<tr><td>${label}</td><td>${fmtTime(t.sunrise)}</td><td>${fmtTime(t.sunset)}</td><td>${h} h ${String(m).padStart(2, '0')}</td></tr>`
}

function nearby(item, n = 6) {
  return items
    .filter((o) => o.id !== item.id)
    .map((o) => ({ o, d: distKm(item, o) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
}

function refugePage(item) {
  const d = item.details
  const massifName = item.massif.name
  const where = item.exact ? `dans le massif ${massifName}` : `près du massif ${massifName}`
  const places = d?.places ?? null
  const label = KIND_LABEL[item.kind]
  const pageTitle = fitTitle([
    `${item.nom} (${fmt(item.alt)} m), ${massifName} | Refuges des Alpes`,
    `${item.nom} (${fmt(item.alt)} m), ${massifName}`,
    `${item.nom} (${fmt(item.alt)} m)`,
  ])
  const description = fitDesc(
    `${label} à ${fmt(item.alt)} m ${where}${places ? `, ${places} places` : ''}. Accès, équipements, ensoleillement et refuges proches. Carte interactive avec météo en direct.`,
  )

  // Les champs Refuges.info se recoupent souvent (la description reprend remarque et accès) :
  // on n'affiche une section que si son début n'apparaît pas déjà plus haut.
  const flat = (s) => norm(s).replace(/\s+/g, ' ')
  const seen = []
  const section = (raw, max, { dropLines } = {}) => {
    if (!raw) return null
    let text = cleanText(raw)
    if (dropLines) text = text.split('\n').filter((l) => !dropLines.test(l)).join('\n').trim()
    if (text.length < 20) return null
    const key = flat(text).slice(0, 80)
    if (seen.some((s) => s.includes(key))) return null
    seen.push(flat(text))
    return excerpt(text, max)
  }
  const desc = section(d?.description, 900)
  const acces = section(d?.acces, 900)
  const remarque = section(d?.remarque, 500)
  // pas de noms de personnes (gardiens) : seules les informations de contact du lieu sont reprises
  const proprio = section(d?.proprio, 500, { dropLines: /gardiens?\s*:/i })
  const equip = (d?.equipements ?? []).filter(
    (e) => e.valeur && !/^non$/i.test(String(e.valeur).trim()) && !/capacit/i.test(e.nom),
  )
  const near = nearby(item)

  const facts = [
    ['Type', label],
    ['Altitude', `${fmt(item.alt)} m`],
    ['Massif', item.exact ? `<a href="/massif/${item.massif.slug}">${esc(massifName)}</a>` : `proche du <a href="/massif/${item.massif.slug}">massif ${esc(massifName)}</a>`],
    ...(places ? [['Places pour dormir', String(places)]] : []),
    ['Coordonnées', `${item.lat.toFixed(5)} °N, ${item.lng.toFixed(5)} °E`],
  ]

  const sun = [
    sunRow('Solstice d’été (21 juin)', new Date(Date.UTC(2027, 5, 21, 10)), item.lat, item.lng),
    sunRow('Équinoxe de printemps (21 mars)', new Date(Date.UTC(2027, 2, 21, 10)), item.lat, item.lng),
    sunRow('Solstice d’hiver (21 déc.)', new Date(Date.UTC(2026, 11, 21, 10)), item.lat, item.lng),
  ].join('')

  const body = `
<p class="lead">${esc(label)} à ${fmt(item.alt)} m d’altitude ${esc(where)}.</p>
<a class="cta" href="${mapLink(item)}">Voir sur la carte : météo, radar et ensoleillement en direct</a>

<h2>Fiche du refuge</h2>
<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v.startsWith('<a') || v.includes('<a ') ? v : esc(v)}</dd>`).join('')}</dl>

${desc ? `<h2>Description</h2>${paragraphs(desc.text)}` : ''}
${acces ? `<h2>Accès</h2>${paragraphs(acces.text)}` : ''}
${remarque ? `<h2>À savoir</h2>${paragraphs(remarque.text)}` : ''}
${proprio ? `<h2>Se renseigner</h2>${paragraphs(proprio.text)}` : ''}
${
  equip.length
    ? `<h2>Équipements et services</h2><ul class="cols">${equip.map((e) => `<li>${esc(e.nom)}${e.valeur && e.valeur !== true && !/^oui$/i.test(String(e.valeur)) ? ` : ${esc(String(e.valeur))}` : ''}</li>`).join('')}</ul>`
    : ''
}

<h2>Lever et coucher du soleil</h2>
<p>Heures calculées pour les coordonnées du refuge, à horizon dégagé (heure de Paris). Dans une vallée encaissée, les crêtes voisines raccourcissent la journée de soleil : le calculateur d’ensoleillement de la carte tient compte du relief.</p>
<table><thead><tr><th>Date</th><th>Lever</th><th>Coucher</th><th>Durée du jour</th></tr></thead><tbody>${sun}</tbody></table>

<h2>Refuges et cabanes à proximité</h2>
<ul>${near
    .map(({ o, d: km }) => {
      const name = o.hasPage ? `<a href="${o.url}">${esc(o.nom)}</a>` : esc(o.nom)
      return `<li>${name} (${KIND_LABEL[o.kind].toLowerCase()}, ${altM(o.alt)}) : à ${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km à vol d’oiseau</li>`
    })
    .join('')}</ul>

<p><a href="/massif/${item.massif.slug}">Tous les refuges ${item.exact ? 'du' : 'proches du'} massif ${esc(massifName)}</a> · <a href="${mapLink(item)}">Ouvrir ce refuge sur la carte</a></p>

<p class="src">Informations issues de <a href="${esc(d?.lien || `https://www.refuges.info/point/${item.id}/`)}" rel="noopener" target="_blank">la fiche Refuges.info</a>, contribution collaborative sous licence <a href="https://creativecommons.org/licenses/by-sa/2.0/deed.fr" rel="noopener" target="_blank">CC BY-SA 2.0</a>. Vérifiez toujours l’ouverture, les tarifs et les conditions auprès du gardien ou du propriétaire avant de partir.</p>`

  const schema = [
    {
      '@type': ['Place', 'TouristAttraction'],
      '@id': `${SITE}${item.url}#place`,
      name: item.nom,
      description,
      url: `${SITE}${item.url}`,
      geo: { '@type': 'GeoCoordinates', latitude: item.lat, longitude: item.lng, elevation: item.alt },
      containedInPlace: { '@type': 'Place', name: `Massif ${massifName}`, url: `${SITE}/massif/${item.massif.slug}` },
      ...(places ? { amenityFeature: { '@type': 'LocationFeatureSpecification', name: 'Places pour dormir', value: places } } : {}),
      isAccessibleForFree: true,
    },
  ]

  return layout({
    path: item.url,
    title: pageTitle,
    description,
    h1: item.nom,
    crumbs: [
      { name: 'Accueil', href: '/' },
      { name: 'Massifs', href: '/massifs' },
      { name: massifName, href: `/massif/${item.massif.slug}` },
      { name: item.nom, href: item.url },
    ],
    body,
    schema,
  })
}

// ───────────── pages massif ─────────────
function massifPage(m) {
  const intro = MASSIF_INTROS[m.slug]
  const members = m.members
  const byKind = (k) => members.filter((i) => i.kind === k)
  const garde = byKind('garde').sort(byName)
  const gite = byKind('gite').sort(byName)
  const cabane = byKind('cabane').sort(byName)
  const alts = members.map((i) => i.alt).filter(Number.isFinite)
  const highest = [...members].filter((i) => i.alt).sort(byAlt)[0]
  const stats = `La carte référence ${garde.length} refuge${garde.length > 1 ? 's' : ''} gardé${garde.length > 1 ? 's' : ''}, ${gite.length} gîte${gite.length > 1 ? 's' : ''} d’étape et ${cabane.length} cabane${cabane.length > 1 ? 's' : ''} non gardée${cabane.length > 1 ? 's' : ''} dans ou autour du massif ${m.name}${alts.length ? `, entre ${fmt(Math.min(...alts))} m et ${fmt(Math.max(...alts))} m d’altitude` : ''}.${highest ? ` Le plus haut est ${highest.hasPage ? `<a href="${highest.url}">${esc(highest.nom)}</a>` : esc(highest.nom)} (${fmt(highest.alt)} m).` : ''}`

  const rowsLinked = (list) =>
    list
      .map((i) => {
        const places = i.details?.places
        const name = i.hasPage ? `<a href="${i.url}">${esc(i.nom)}</a>` : esc(i.nom)
        return `<tr><td>${name}</td><td>${i.alt ? altM(i.alt) : '–'}</td><td>${places ? places : '–'}</td></tr>`
      })
      .join('')
  const table = (list) =>
    `<table><thead><tr><th>Nom</th><th>Altitude</th><th>Places</th></tr></thead><tbody>${rowsLinked(list)}</tbody></table>`

  const others = alpine.filter((o) => o.slug !== m.slug && o.members.length)
  const [lng, lat] = m.center
  const desc = `Refuges, gîtes d’étape et cabanes du massif ${m.name} : ${garde.length} refuges gardés, ${gite.length} gîtes, ${cabane.length} cabanes. Altitudes, accès et carte interactive avec météo en direct.`

  const body = `
<p class="lead">${esc(intro?.resume ?? '')}</p>
<p>${stats}</p>
<a class="cta" href="/?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&z=10">Ouvrir la carte sur le massif ${esc(m.name)}</a>
${intro?.reperes ? `<h2>Repères</h2><p>${esc(intro.reperes)}</p>` : ''}
${garde.length ? `<h2>Refuges gardés du massif ${esc(m.name)}</h2><p>Tenus par un gardien en saison, ils proposent repas et couchage.</p>${table(garde)}` : ''}
${gite.length ? `<h2>Gîtes d’étape</h2>${table(gite)}` : ''}
${
  cabane.length
    ? `<h2>Cabanes non gardées</h2><p>Abris sans services : prévoyez couchage et nourriture. Cliquez sur la carte pour voir chaque cabane, son accès et la météo.</p><ul class="cols">${cabane.map((i) => `<li>${esc(i.nom)}${i.alt ? ` (${altM(i.alt)})` : ''}</li>`).join('')}</ul>`
    : ''
}
<h2>Préparer sa sortie</h2>
<p>Sur la <a href="/">carte interactive</a>, activez le radar météo AROME pour suivre les précipitations, consultez le bulletin d’estimation du risque d’avalanche (BERA) du massif, les transports en commun pour partir sans voiture et le calculateur d’ensoleillement de chaque refuge.</p>
<h2>Autres massifs des Alpes</h2>
<ul class="cols">${others.map((o) => `<li><a href="/massif/${o.slug}">${esc(o.name)}</a></li>`).join('')}</ul>
<p class="src">Positions et caractéristiques issues de <a href="https://www.refuges.info" rel="noopener" target="_blank">Refuges.info</a> (CC BY-SA 2.0). Les massifs suivent le découpage Météo-France du bulletin d’avalanche. Vérifiez l’ouverture et les conditions auprès des gardiens avant de partir.</p>`

  const schema = [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE}/massif/${m.slug}#page`,
      name: `Refuges du massif ${m.name}`,
      description: desc,
      url: `${SITE}/massif/${m.slug}`,
      about: { '@type': 'Place', name: `Massif ${m.name}`, geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: garde.length + gite.length,
        itemListElement: [...garde, ...gite].slice(0, 100).map((i, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          url: `${SITE}${i.url}`,
          name: i.nom,
        })),
      },
    },
  ]

  return layout({
    path: `/massif/${m.slug}`,
    title: fitTitle([
      `Refuges du massif ${m.name} : carte, gîtes, cabanes | Refuges des Alpes`,
      `Refuges du massif ${m.name} : carte, gîtes, cabanes`,
      `Refuges du massif ${m.name}`,
    ]),
    description: desc,
    h1: `Refuges et cabanes du massif ${m.name}`,
    crumbs: [
      { name: 'Accueil', href: '/' },
      { name: 'Massifs', href: '/massifs' },
      { name: m.name, href: `/massif/${m.slug}` },
    ],
    body,
    schema,
  })
}

function hubPage() {
  const list = alpine.filter((m) => m.members.length)
  const rows = list
    .map((m) => {
      const g = m.members.filter((i) => i.kind === 'garde').length
      const t = m.members.filter((i) => i.kind === 'gite').length
      const c = m.members.filter((i) => i.kind === 'cabane').length
      return `<tr><td><a href="/massif/${m.slug}">${esc(m.name)}</a></td><td>${g}</td><td>${t}</td><td>${c}</td></tr>`
    })
    .join('')
  const desc = `Les ${list.length} massifs des Alpes françaises avec leurs refuges gardés, gîtes d’étape et cabanes non gardées : Mont-Blanc, Vanoise, Écrins, Queyras, Mercantour et plus.`
  const body = `
<p class="lead">Choisissez un massif pour retrouver ses refuges, gîtes d’étape et cabanes, avec altitudes, accès et ensoleillement.</p>
<a class="cta" href="/">Ouvrir la carte interactive</a>
<table><thead><tr><th>Massif</th><th>Refuges gardés</th><th>Gîtes d’étape</th><th>Cabanes</th></tr></thead><tbody>${rows}</tbody></table>
<p class="src">Découpage des massifs : bulletin d’estimation du risque d’avalanche (BERA) de Météo-France. Données Refuges.info (CC BY-SA 2.0).</p>`
  return layout({
    path: '/massifs',
    title: 'Massifs des Alpes : refuges, gîtes et cabanes | Refuges des Alpes',
    description: desc,
    h1: 'Les massifs des Alpes et leurs refuges',
    crumbs: [
      { name: 'Accueil', href: '/' },
      { name: 'Massifs', href: '/massifs' },
    ],
    body,
    schema: [
      {
        '@type': 'CollectionPage',
        name: 'Massifs des Alpes',
        url: `${SITE}/massifs`,
        description: desc,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: list.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/massif/${m.slug}`, name: m.name })),
        },
      },
    ],
  })
}

// ───────────── FAQ ─────────────
// Réponses en HTML ; le JSON-LD FAQPage en reprend le texte brut, identique au texte visible.
const FAQ = [
  {
    q: 'Quel est l’objectif du site Refuges des Alpes ?',
    a: 'Le site a pour objectif de vous permettre de parcourir facilement une <a href="/">carte interactive</a> pour découvrir les refuges, cabanes et gîtes de montagne en vue de préparer votre prochain voyage ou randonnée.',
  },
  {
    q: 'Comment trouver un refuge dans les Alpes ?',
    a: 'Utilisez la <a href="/">carte interactive</a> de Refuges des Alpes : zoomez sur le massif qui vous intéresse (Mont-Blanc, Vanoise, Écrins, Belledonne, Queyras…), les marqueurs des refuges gardés et cabanes non gardées apparaissent automatiquement avec leur altitude, nombre de places et état d’ouverture.',
  },
  {
    q: 'Quelle est la différence entre un refuge gardé et une cabane non gardée ?',
    a: 'Un refuge gardé est tenu par un gardien en saison (généralement mi-juin à mi-septembre) et propose repas, couchage et demi-pension. Une cabane non gardée (ou abri) est ouverte toute l’année mais sans services : il faut apporter son matériel de couchage et sa nourriture.',
  },
  {
    q: 'Peut-on réserver directement sur le site ?',
    a: 'Non, le site ne gère pas les réservations en direct. Cependant, un lien vous redirige vers <a href="https://www.refuges.info" rel="noopener" target="_blank"><strong>refuges.info</strong></a> (et les plateformes partenaires), où vous trouverez l’ensemble des contacts et des liens nécessaires pour effectuer votre réservation auprès des gardiens.',
  },
  {
    q: 'Peut-on accéder aux refuges des Alpes sans voiture ?',
    a: 'Oui ! Activez la couche Transports sur la carte pour voir toutes les lignes de train (TGV, TER), bus régionaux et navettes estivales qui desservent les vallées alpines. Le réseau couvre les gares de Chambéry, Grenoble, Briançon, Saint-Gervais, Bourg-Saint-Maurice et Modane, avec correspondances en bus et navettes vers les départs de sentier.',
  },
  {
    q: 'Comment consulter le bulletin d’estimation du risque d’avalanche (BERA) ?',
    a: 'Les Bulletins d’Estimation du Risque d’Avalanche (BERA) de Météo-France sont intégrés directement dans la carte interactive. Cliquez sur un massif pour voir l’indice de risque de 1 à 5, les orientations à risque et l’altitude critique.',
  },
  {
    q: 'Quels massifs des Alpes sont couverts par la carte ?',
    a: 'Tous les <a href="/massifs">massifs des Alpes françaises</a> sont couverts : Mont-Blanc, Vanoise, Écrins, Belledonne, Chartreuse, Vercors, Queyras, Mercantour, Chablais, Aravis, Bauges, Beaufortain, Lauzière, Cerces, Thabor, Oisans, Dévoluy, Briançonnais et plus encore.',
  },
  {
    q: 'Les données affichées sur le site sont-elles fiables ?',
    a: 'Nous ne créons pas les données de toutes pièces : nous récupérons les informations via des API spécialisées et reconnues dans leur domaine (par exemple, les données météo proviennent de Météo-France). Il peut toutefois arriver que certaines informations soient temporairement erronées en raison d’un décalage de synchronisation avec les API partenaires.',
  },
  {
    q: 'Qui se cache derrière Refuges des Alpes ?',
    a: 'Nous sommes deux étudiants passionnés de montagne. Nous avons initialement créé ce site pour répondre à nos propres besoins lors de nos sorties en altitude. Voir qu’il peut aujourd’hui rendre service à toute la communauté des randonneurs est une grande satisfaction pour nous !',
  },
  {
    q: 'Comment puis-je vous suggérer des améliorations ou signaler un bug ?',
    a: 'C’est très simple ! Sur la <a href="/">carte interactive</a>, vous trouverez un <strong>bouton d’information vert (icône « i »)</strong> situé en bas à gauche. Il vous permet de nous laisser un message direct. Nous lisons tous les retours avec attention pour améliorer continuellement l’outil.',
  },
]

// espace insécable avant ? ! : ; et à l'intérieur des guillemets français
const frTypo = (s) => s.replace(/ ([?!:;])/g, ' $1').replace(/« /g, '« ').replace(/ »/g, ' »')
const stripTags = (s) => s.replace(/<[^>]+>/g, '')

function faqPage() {
  const desc =
    'Trouver un refuge dans les Alpes, réserver, y aller sans voiture, consulter le BERA : les réponses aux questions fréquentes sur Refuges des Alpes.'
  const entries = FAQ.map(({ q, a }) => ({ q: frTypo(q), a: frTypo(a) }))
  const body = `
<p class="lead">Tout ce qu’il faut savoir sur la carte des refuges, cabanes et gîtes de montagne des Alpes.</p>
<div class="faq">
${entries
  .map(
    ({ q, a }, i) =>
      `<details${i === 0 ? ' open' : ''}><summary><h2>${esc(q)}</h2></summary><div class="a"><p>${a}</p></div></details>`,
  )
  .join('\n')}
</div>
<div class="box">
<h2>Une autre question ?</h2>
<p>Écrivez-nous depuis la carte avec le bouton vert « i » en bas à gauche : nous répondons à chaque message.</p>
<a class="cta" href="/">Ouvrir la carte interactive</a>
</div>`
  return layout({
    path: '/faq',
    title: 'FAQ : questions fréquentes | Refuges des Alpes',
    description: desc,
    h1: 'Questions fréquentes',
    crumbs: [
      { name: 'Accueil', href: '/' },
      { name: 'Questions fréquentes', href: '/faq' },
    ],
    body: frTypo(body),
    schema: [
      {
        '@type': 'FAQPage',
        '@id': `${SITE}/faq#faq`,
        url: `${SITE}/faq`,
        name: 'Questions fréquentes sur Refuges des Alpes',
        description: desc,
        inLanguage: 'fr-FR',
        mainEntity: entries.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: stripTags(a) },
        })),
      },
    ],
  })
}

// ───────────── écriture ─────────────
let nRefuge = 0
let nMassif = 0
const sitemap = [{ loc: '/', lastmod: BUILD_DATE }]

write('massifs.html', hubPage())
sitemap.push({ loc: '/massifs', lastmod: BUILD_DATE })

write('faq.html', faqPage())
sitemap.push({ loc: '/faq', lastmod: BUILD_DATE })

for (const m of alpine) {
  if (!m.members.length) continue
  write(`massif/${m.slug}.html`, massifPage(m))
  sitemap.push({ loc: `/massif/${m.slug}`, lastmod: BUILD_DATE })
  nMassif++
}

for (const item of pageItems) {
  write(`refuge/${item.slug}.html`, refugePage(item))
  const mod = item.details?.modif?.slice(0, 10)
  sitemap.push({ loc: item.url, lastmod: mod && mod <= BUILD_DATE ? mod : BUILD_DATE })
  nRefuge++
}

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sitemap.map((u) => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') +
  `\n</urlset>\n`
writeFileSync(join(DIST, 'sitemap.xml'), xml)

const withDetails = pageItems.filter((i) => i.details).length
console.log(
  `SEO : ${nMassif} massifs, ${nRefuge} fiches refuge (${withDetails} avec détails Refuges.info), ${sitemap.length} URL dans le sitemap`,
)
