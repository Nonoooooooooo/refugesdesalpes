import fs from 'node:fs';
import https from 'node:https';

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

async function mergeAndFetchTags() {
  const resorts = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));
  const s82 = JSON.parse(fs.readFileSync('scripts/data/s82_raw.json', 'utf8'));
  const tags = JSON.parse(fs.readFileSync('scripts/data/resorts_stop_tags.json', 'utf8'));

  if (!resorts.elements.some(e => e.id === 17013465)) {
    resorts.elements.push(...s82.elements);
    fs.writeFileSync('scripts/data/resorts_osm_raw.json', JSON.stringify(resorts, null, 2));
    console.log('Added S82 to resorts_osm_raw.json');
  }

  const missingNodeIds = [];
  resorts.elements.forEach(e => {
    (e.members || []).forEach(m => {
      if (m.type === 'node' && !tags[m.ref]) {
        missingNodeIds.push(m.ref);
      }
    });
  });

  console.log(`Missing node tags: ${missingNodeIds.length}`);
  if (missingNodeIds.length > 0) {
    const query = `[out:json][timeout:30];
node(id:${missingNodeIds.join(',')});
out tags;`;
    const res = await queryOverpass(query);
    res.elements?.forEach(e => {
      tags[e.id] = e.tags || {};
    });
    fs.writeFileSync('scripts/data/resorts_stop_tags.json', JSON.stringify(tags, null, 2));
    console.log('Updated resorts_stop_tags.json');
  }
}

mergeAndFetchTags().catch(console.error);
