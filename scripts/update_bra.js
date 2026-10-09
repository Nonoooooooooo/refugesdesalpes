/**
 * Script de mise à jour quotidienne des Bulletins d'Estimation du Risque d'Avalanche (BERA)
 * Météo-France publie les bulletins chaque jour à 16h00 pour le lendemain.
 * Ce script est conçu pour s'exécuter à 16h05 quotidiennement (cron, CI/CD ou mode daemon).
 *
 * Utilisation :
 *   node scripts/update_bra.js            # Exécution immédiate
 *   node scripts/update_bra.js --watch    # Mode veille : attend chaque jour 16h05
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 23 massifs des Alpes françaises répertoriés par Météo-France
const ALPES_MASSIFS = [
  { id: 1, nom: 'Chablais', slug: 'chablais' },
  { id: 2, nom: 'Aravis', slug: 'aravis' },
  { id: 3, nom: 'Mont-Blanc', slug: 'mont-blanc' },
  { id: 4, nom: 'Bauges', slug: 'bauges' },
  { id: 5, nom: 'Beaufortain', slug: 'beaufortain' },
  { id: 6, nom: 'Haute-Tarentaise', slug: 'haute-tarentaise' },
  { id: 7, nom: 'Chartreuse', slug: 'chartreuse' },
  { id: 8, nom: 'Belledonne', slug: 'belledonne' },
  { id: 9, nom: 'Maurienne', slug: 'maurienne' },
  { id: 10, nom: 'Vanoise', slug: 'vanoise' },
  { id: 11, nom: 'Haute-Maurienne', slug: 'haute-maurienne' },
  { id: 12, nom: 'Grandes-Rousses', slug: 'grandes-rousses' },
  { id: 13, nom: 'Thabor', slug: 'thabor' },
  { id: 14, nom: 'Vercors', slug: 'vercors' },
  { id: 15, nom: 'Oisans', slug: 'oisans' },
  { id: 16, nom: 'Pelvoux', slug: 'pelvoux' },
  { id: 17, nom: 'Queyras', slug: 'queyras' },
  { id: 18, nom: 'Dévoluy', slug: 'devoluy' },
  { id: 19, nom: 'Champsaur', slug: 'champsaur' },
  { id: 20, nom: 'Embrunais-Parpaillon', slug: 'embrunais-parpaillon' },
  { id: 21, nom: 'Ubaye', slug: 'ubaye' },
  { id: 22, nom: 'Haut-Var/Haut-Verdon', slug: 'haut-var-haut-verdon' },
  { id: 23, nom: 'Mercantour', slug: 'mercantour' },
]

function getEnvToken() {
  const envPath = path.resolve(__dirname, '../.env')
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf8')
    const match = text.match(/VITE_METEOFRANCE_API_KEY=([^\r\n]+)/)
    if (match) return match[1].trim()
  }
  return process.env.VITE_METEOFRANCE_API_KEY || process.env.METEOFRANCE_TOKEN || ''
}

const OUTPUT_DIR = path.resolve(__dirname, '../public/data/bra_cache')

async function updateAllMassifs() {
  console.log(`\n======================================================`)
  console.log(`🏔️  DÉBUT DE LA MISE À JOUR BERA (${new Date().toLocaleString('fr-FR')})`)
  console.log(`======================================================`)

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const token = getEnvToken()
  const isHeaderOnly = !token || token.split('.').length < 3

  if (isHeaderOnly) {
    console.log(`⚠️  Note : Le jeton Météo-France configuré est incomplet (header seul).`)
    console.log(`   Pour le direct API, configurez un jeton complet (header.payload.signature).`)
  }

  const results = []

  for (const massif of ALPES_MASSIFS) {
    const targetFile = path.join(OUTPUT_DIR, `${massif.id}.json`)
    const url = `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${massif.id}&format=xml`

    let fetched = false
    let xmlContent = ''

    if (!isHeaderOnly) {
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: token,
            Accept: 'application/xml, text/xml, */*',
          },
        })
        if (res.ok) {
          xmlContent = await res.text()
          fetched = true
          console.log(`  ✓ [Massif ${massif.id}] ${massif.nom} : Bulletin en direct récupéré avec succès`)
        } else {
          console.log(`  - [Massif ${massif.id}] ${massif.nom} : Statut HTTP ${res.status}`)
        }
      } catch (err) {
        console.log(`  ✗ [Massif ${massif.id}] ${massif.nom} : Erreur réseau (${err.message})`)
      }
    }

    const payload = {
      massifId: massif.id,
      massifNom: massif.nom,
      slug: massif.slug,
      updatedAt: new Date().toISOString(),
      isLive: fetched,
      xml: xmlContent || null,
    }

    fs.writeFileSync(targetFile, JSON.stringify(payload, null, 2), 'utf8')
    results.push({ id: massif.id, nom: massif.nom, live: fetched })
  }

  const metaFile = path.join(OUTPUT_DIR, 'last_update.json')
  fs.writeFileSync(
    metaFile,
    JSON.stringify(
      {
        lastRun: new Date().toISOString(),
        massifsCount: ALPES_MASSIFS.length,
        results,
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(`\n✅ Mise à jour terminée : ${ALPES_MASSIFS.length} massifs enregistrés dans public/data/bra_cache/`)
}

function msUntil1605() {
  const now = new Date()
  const target = new Date(now)
  target.setHours(16, 5, 0, 0)
  if (now >= target) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime() - now.getTime()
}

async function main() {
  const isWatch = process.argv.includes('--watch') || process.argv.includes('--daemon')

  // Première exécution
  await updateAllMassifs()

  if (isWatch) {
    console.log(`\n⏳ Mode veille activé : attente de la prochaine mise à jour quotidienne à 16h05...`)
    const waitAndSchedule = () => {
      const ms = msUntil1605()
      const hours = (ms / (1000 * 60 * 60)).toFixed(2)
      console.log(`Prochaine exécution dans ${hours} heures (à 16h05).`)
      setTimeout(async () => {
        await updateAllMassifs()
        waitAndSchedule()
      }, ms)
    }
    waitAndSchedule()
  }
}

main().catch(console.error)
