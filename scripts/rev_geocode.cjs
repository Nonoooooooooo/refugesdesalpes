const https = require('https');

function rev(lat, lon, label) {
  return new Promise(resolve => {
    https.get(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: { 'User-Agent': 'RefugesDesAlpes/1.0' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          console.log(label, '->', j.display_name);
        } catch(e) {
          console.log(label, '-> err:', d.slice(0, 50));
        }
        resolve();
      });
    });
  });
}

async function run() {
  await rev(45.0171, 6.6319, 'Roubion (OSM bus stop 6.6319)');
  await new Promise(r => setTimeout(r, 1100));
  await rev(45.018183, 6.621337, 'Point 6.6213');
  await new Promise(r => setTimeout(r, 1100));
  await rev(45.019875, 6.60404, 'N3 coords[0] (6.60404)');
  await new Promise(r => setTimeout(r, 1100));
  await rev(45.02213, 6.578531, 'N3 coords[end] (6.578531)');
}
run();
