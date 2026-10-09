import https from 'node:https';

const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
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
              reject(new Error(`Status ${res.statusCode} from ${endpoint}: ${body.slice(0, 120)}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error(`Non-JSON response (${res.statusCode}) from ${endpoint}: ${body.slice(0, 100)}`));
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

async function check() {
  console.log('Querying bus routes in Alpe d\'Huez...');
  const query = `[out:json][timeout:30];
  relation["route"="bus"](45.05,6.03,45.12,6.13);
out tags;`;
  try {
    const res = await queryOverpass(query);
    console.log(`Found ${res.elements?.length || 0} bus relations in Val d'Isere:`);
    res.elements?.forEach(e => {
      console.log(`ID: ${e.id} | Ref: ${e.tags.ref || '-'} | Name: ${e.tags.name} | From: ${e.tags.from || '-'} -> To: ${e.tags.to || '-'}`);
    });
  } catch (e) {
    console.error('Overpass error:', e.message);
  }
}

check();
