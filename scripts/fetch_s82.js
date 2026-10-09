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
  const query = `[out:json][timeout:30];
relation(17013465);
out geom;`;
  const res = await queryOverpass(query);
  fs.writeFileSync('scripts/data/s82_raw.json', JSON.stringify(res, null, 2));
  console.log(`S82 fetched: ${res.elements?.length || 0} relations.`);
}

run().catch(console.error);
