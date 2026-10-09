const https = require('https');
const fs = require('fs');

function fetchOSRM(coordsStr) {
  return new Promise((resolve, reject) => {
    // coordsStr is lon1,lat1;lon2,lat2
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
    https.get(url, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 'Ok' && json.routes && json.routes[0]) {
            resolve(json.routes[0].geometry.coordinates);
          } else {
            console.error('OSRM returned non-OK code:', json.code);
            resolve(null);
          }
        } catch (e) {
          console.error('OSRM parse error:', e.message);
          resolve(null);
        }
      });
    }).on('error', err => {
      console.error('OSRM network error:', err.message);
      resolve(null);
    });
  });
}

async function run() {
  console.log('Fetching exact road geometries from OSRM...');

  // 1. N3: Roubion (6.6319, 45.0171) -> Ville-Haute (6.6050, 45.0187)
  const n3Coords = await fetchOSRM('6.6319,45.0171;6.6128,45.0181;6.6050,45.0187');
  console.log('N3 coordinates count:', n3Coords ? n3Coords.length : 0);

  // 2. N4: Ville-Haute (6.6050, 45.0187) -> Laval (6.5256, 45.0592)
  const n4Coords = await fetchOSRM('6.6050,45.0187;6.5785,45.0221;6.5451,45.0342;6.5340,45.0520;6.5256,45.0592');
  console.log('N4 coordinates count:', n4Coords ? n4Coords.length : 0);

  // 3. L7: Briançon (6.634, 44.898) -> Ville-Haute (6.6050, 45.0187)
  const l7Coords = await fetchOSRM('6.634,44.898;6.681,44.941;6.670,44.973;6.659,45.005;6.6319,45.0171;6.6050,45.0187');
  console.log('L7 coordinates count:', l7Coords ? l7Coords.length : 0);

  // 4. Vallée Étroite: Névache (6.6050, 45.0187) -> Col de l'Échelle (6.6570, 45.0270) -> Vallée Étroite (6.6350, 45.0870)
  const etroiteCoords = await fetchOSRM('6.6050,45.0187;6.6570,45.0270;6.6350,45.0870');
  console.log('Vallée Étroite coordinates count:', etroiteCoords ? etroiteCoords.length : 0);

  const out = {
    n3Coords,
    n4Coords,
    l7Coords,
    etroiteCoords
  };

  fs.writeFileSync('scripts/nevache_road_geometries.json', JSON.stringify(out, null, 2));
  console.log('Saved road geometries to scripts/nevache_road_geometries.json');
}

run();
