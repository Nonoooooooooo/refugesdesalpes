const https = require('https');

function queryOverpass(query) {
  return new Promise((resolve, reject) => {
    const postData = 'data=' + encodeURIComponent(query);
    const req = https.request('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'RefugesDesAlpes/1.0'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(new Error(data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const q = `
    [out:json][timeout:25];
    (
      node["highway"="bus_stop"](45.00,6.50,45.08,6.65);
      node["public_transport"="platform"](45.00,6.50,45.08,6.65);
    );
    out body;
  `;
  try {
    const json = await queryOverpass(q);
    console.log('Found stops in Nevache area:', json.elements.length);
    json.elements.forEach(e => {
      console.log(`${e.tags?.name || 'Sans nom'} | lat: ${e.lat} | lon: ${e.lon}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
