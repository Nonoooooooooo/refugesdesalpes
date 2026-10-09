import https from 'node:https';
import fs from 'node:fs';

function queryOverpass(query) {
  return new Promise((resolve, reject) => {
    const data = `data=${encodeURIComponent(query)}`;
    const req = https.request('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'RefugesDesAlpes/1.0'
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchMissingResorts() {
  console.log('Fetching details for Train Rouge, Alpe d\'Huez and Valmorel...');
  // 1. Train Rouge Val d'Isere
  const qValdisere = `[out:json][timeout:30];
relation["name"~"Train Rouge"];
out geom;`;

  // 2. Alpe d'Huez Citron, Pomme, T76
  const qHuez = `[out:json][timeout:30];
(
  relation["network"="Alpe d'Huez"];
  relation["ref"="T76"]["network"="Cars Région Isère"];
);
out geom;`;

  // 3. Valmorel S62 & Valmobus
  const qValmorel = `[out:json][timeout:30];
(
  relation["ref"="S62"]["network"="Cars Région Savoie"];
  relation["name"~"Valmorel"];
);
out geom;`;

  try {
    const rVal = await queryOverpass(qValdisere);
    fs.writeFileSync('scripts/data/osm_valdisere.json', JSON.stringify(rVal, null, 2));
    console.log(`Val d'Isère: found ${rVal.elements?.length || 0} relations.`);

    const rHuez = await queryOverpass(qHuez);
    fs.writeFileSync('scripts/data/osm_huez.json', JSON.stringify(rHuez, null, 2));
    console.log(`Alpe d'Huez: found ${rHuez.elements?.length || 0} relations.`);

    const rValm = await queryOverpass(qValmorel);
    fs.writeFileSync('scripts/data/osm_valmorel.json', JSON.stringify(rValm, null, 2));
    console.log(`Valmorel: found ${rValm.elements?.length || 0} relations.`);
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

fetchMissingResorts();
