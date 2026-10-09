import https from 'node:https';
import fs from 'node:fs';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

async function queryOverpass(query) {
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await new Promise((resolve, reject) => {
        const url = new URL(endpoint);
        const data = `data=${encodeURIComponent(query)}`;
        const req = https.request({
          hostname: url.hostname,
          path: url.pathname,
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
            if (res.statusCode !== 200) {
              reject(new Error(`Status ${res.statusCode} from ${endpoint}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error(`Non-JSON response from ${endpoint}`));
            }
          });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });
      return res;
    } catch (err) {
      console.warn(`Failed on ${endpoint}:`, err.message);
    }
  }
  throw new Error('All Overpass endpoints failed');
}

async function run() {
  const ids = [
    // Val d'Isère
    9286018, // Train Rouge
    // Alpe d'Huez
    3548354, 3548355, // Citron
    3548360, 3548361, // Pomme
    3548356, // Fraise
    3548357, // Myrtille
    10039943, 10039944, // T76 Bourg d'Oisans - Huez
    // Valmorel
    8281967, // S62 Moûtiers - Valmorel
    8293003, 11256060, // S61 Moûtiers - Doucy
    17429338 // Vallée'BUS Valmorel - Notre-Dame-de-Briançon
  ];

  console.log(`Querying ${ids.length} relations with out geom...`);
  const query = `[out:json][timeout:30];
relation(id:${ids.join(',')});
out geom;`;

  const res = await queryOverpass(query);
  console.log(`Received ${res.elements?.length || 0} relations.`);
  fs.writeFileSync('scripts/data/resorts_osm_raw.json', JSON.stringify(res, null, 2));
  console.log('Saved to scripts/data/resorts_osm_raw.json');
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
