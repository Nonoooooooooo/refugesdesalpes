// Signale les URL du sitemap en ligne aux moteurs compatibles IndexNow (Bing, Yandex, Seznam, Naver…).
// Bing alimente aussi la recherche de ChatGPT et de DuckDuckGo.
//
// Usage, après un déploiement qui ajoute ou modifie des pages : npm run seo:indexnow
// La clé est le fichier public/<clé>.txt (32 caractères hexadécimaux), servi à la racine du site.
// Le script lit le sitemap en ligne, pas celui de dist/ : seules les URL réellement publiées sont envoyées.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SITE = 'https://refugesdesalpes.fr'
const HOST = 'refugesdesalpes.fr'

const keyFile = readdirSync(join(ROOT, 'public')).find((f) => /^[a-f0-9]{32}\.txt$/.test(f))
if (!keyFile) {
  console.error('Clé IndexNow introuvable : ajoutez un fichier public/<32 caractères hexadécimaux>.txt contenant la clé.')
  process.exit(1)
}
const key = readFileSync(join(ROOT, 'public', keyFile), 'utf8').trim()
const keyLocation = `${SITE}/${keyFile}`

// La clé doit être en ligne, sinon les moteurs rejettent l'envoi
const online = await fetch(keyLocation).then((r) => (r.ok ? r.text() : ''))
if (online.trim() !== key) {
  console.error(`La clé n'est pas encore en ligne sur ${keyLocation} : déployez le site avant de lancer ce script.`)
  process.exit(1)
}

const sitemap = await fetch(`${SITE}/sitemap.xml`).then((r) => r.text())
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
if (!urlList.length) {
  console.error('Aucune URL trouvée dans le sitemap en ligne.')
  process.exit(1)
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
})
// 200 : reçu ; 202 : reçu, clé en cours de vérification ; 4xx : requête refusée
console.log(`IndexNow : ${urlList.length} URL envoyées, réponse ${res.status} ${res.statusText}`)
if (!res.ok) {
  console.error(await res.text())
  process.exit(1)
}
