import fs from 'node:fs';
import https from 'node:https';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

function fetchRoute(coords) {
  return new Promise((resolve) => {
    const url = `${OSRM_URL}${coords}?overview=full&geometries=geojson`;
    https.get(url, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.code === 'Ok' && json.routes?.[0]?.geometry) {
            resolve(json.routes[0].geometry.coordinates);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  // 1. Pelvoux Station -> Ailefroide
  const section1 = await fetchRoute('6.4880,44.8640;6.4710,44.8640;6.4620,44.8710;6.4550,44.8780;6.4458,44.8919');
  console.log('Section 1 (Pelvoux -> Ailefroide):', section1.length, 'points');

  // 2. D 204T Ailefroide -> Pré de Madame Carle
  const section2 = JSON.parse(fs.readFileSync('scripts/d204t_road.json', 'utf8'));
  console.log('Section 2 (Ailefroide -> Madame Carle):', section2.length, 'points');

  const fullRoute = [...section1, ...section2];
  console.log('Total full route points:', fullRoute.length);
  console.log('Start (Pelvoux):', fullRoute[0]);
  console.log('End (Pré de Madame Carle):', fullRoute[fullRoute.length - 1]);

  fs.writeFileSync('scripts/data/estibus_madame_carle_full.json', JSON.stringify(fullRoute));
  console.log('Saved to scripts/data/estibus_madame_carle_full.json');
}

main();
