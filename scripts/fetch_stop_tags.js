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

async function fetchStopTags() {
  const d = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));
  const nodeIds = new Set();
  d.elements.forEach(e => {
    (e.members || []).forEach(m => {
      if (m.type === 'node') {
        nodeIds.add(m.ref);
      }
    });
  });

  const ids = Array.from(nodeIds);
  console.log(`Querying tags for ${ids.length} stop nodes...`);
  const query = `[out:json][timeout:30];
node(id:${ids.join(',')});
out tags;`;

  const res = await queryOverpass(query);
  console.log(`Fetched ${res.elements?.length || 0} node tags.`);
  const map = {};
  res.elements?.forEach(e => {
    map[e.id] = e.tags || {};
  });
  fs.writeFileSync('scripts/data/resorts_stop_tags.json', JSON.stringify(map, null, 2));
  console.log('Saved to scripts/data/resorts_stop_tags.json');
}

fetchStopTags().catch(console.error);
