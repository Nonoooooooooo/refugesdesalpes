// Récupère une seule fois les fiches détaillées (description, accès, places…) des refuges gardés
// et gîtes d'étape depuis Refuges.info (données CC BY-SA 2.0) et les stocke dans
// scripts/seo/details.json. Le build n'appelle jamais le réseau : il lit ce fichier.
//
// Usage : node scripts/seo/fetch_details.js [--all]   (--all : inclut aussi les cabanes)
// Le script est reprenable : les fiches déjà présentes dans details.json sont ignorées.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const INDEX = join(ROOT, 'public', 'refuges_index.json')
const OUT = join(ROOT, 'scripts', 'seo', 'details.json')
const BASE = 'https://www.refuges.info'
const CONCURRENCY = 3
const DELAY_MS = 200

const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const all = process.argv.includes('--all')

const index = JSON.parse(readFileSync(INDEX, 'utf8'))
const wanted = index.filter((p) => {
  const t = norm(p.type)
  return t.includes('refuge garde') || t.includes('gite') || (all && t.includes('cabane'))
})

const details = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const todo = wanted.filter((p) => !details[p.id])
console.log(`${wanted.length} fiches visées, ${todo.length} à récupérer`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchOne(p) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/point?id=${p.id}&detail=complet`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const f = data.features?.[0]?.properties
      if (!f) throw new Error('fiche vide')
      return {
        description: f.description?.valeur ?? '',
        acces: f.acces?.valeur ?? '',
        remarque: f.remarque?.valeur ?? '',
        proprio: f.proprio?.valeur ?? '',
        places: f.places?.valeur ?? null,
        lien: f.lien ?? '',
        modif: f.date?.derniere_modif ?? '',
        equipements: Object.values(f.info_comp ?? {})
          .map((i) => ({ nom: i.nom, valeur: i.valeur }))
          .filter((i) => i.nom),
      }
    } catch (e) {
      if (attempt === 3) {
        console.warn(`  échec ${p.id} : ${e.message}`)
        return null
      }
      await sleep(1000 * attempt)
    }
  }
}

let done = 0
async function worker(queue) {
  while (queue.length) {
    const p = queue.shift()
    const d = await fetchOne(p)
    if (d) details[p.id] = d
    done++
    if (done % 25 === 0) {
      writeFileSync(OUT, JSON.stringify(details))
      console.log(`  ${done}/${todo.length}`)
    }
    await sleep(DELAY_MS)
  }
}

const queue = [...todo]
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))
writeFileSync(OUT, JSON.stringify(details))
console.log(`Terminé : ${Object.keys(details).length} fiches dans details.json`)
