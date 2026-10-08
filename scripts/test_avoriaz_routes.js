import https from 'node:https';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

function fetchRoute(coords) {
  return new Promise((resolve) => {
    const url = `${OSRM_URL}${coords}?overview=simplified&geometries=geojson`;
    https.get(url, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.code === 'Ok' && json.routes?.[0]?.geometry) {
            resolve(json.routes[0].geometry.coordinates);
          } else {
            console.warn('OSRM error for coords:', coords, json.code);
            resolve(null);
          }
        } catch (e) {
          console.warn('OSRM parse error:', e.message);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.warn('OSRM network error:', err.message);
      resolve(null);
    });
  });
}

const testRoutes = [
  {
    name: 'Y91 : Thonon ↔ Morzine ↔ Prodains',
    coords: '6.4797,46.3686;6.5873,46.3243;6.6160,46.3038;6.6476,46.2434;6.6944,46.1968;6.7083,46.1793;6.7533,46.1897'
  },
  {
    name: 'Y92 : Cluses ↔ Les Gets ↔ Morzine ↔ Prodains',
    coords: '6.5824,46.0618;6.5921,46.1077;6.6284,46.1343;6.6686,46.1598;6.7083,46.1793;6.7533,46.1897'
  },
  {
    name: 'Navette A / AU : Morzine ↔ Prodains',
    coords: '6.7083,46.1793;6.7150,46.1810;6.7320,46.1840;6.7533,46.1897'
  },
  {
    name: 'Navette M : Morzine ↔ Lac Montriond ↔ Ardent',
    coords: '6.7083,46.1793;6.6944,46.1968;6.7300,46.2050;6.7445,46.2160'
  },
  {
    name: 'Navette E : Morzine ↔ Téléphérique Nyon ↔ Mines d\'Or',
    coords: '6.7083,46.1793;6.7200,46.1650;6.7380,46.1480;6.7620,46.1340'
  },
  {
    name: 'Balad\'Aulps Bus : Les Gets ↔ Morzine ↔ St-Jean-d\'Aulps ↔ Le Biot ↔ Jotty',
    coords: '6.6560,46.1488;6.6709,46.1609;6.7083,46.1793;6.6944,46.1968;6.6561,46.2325;6.6476,46.2434;6.6313,46.2638;6.6160,46.3038'
  }
];

async function run() {
  for (const r of testRoutes) {
    const pts = await fetchRoute(r.coords);
    console.log(`${r.name} => ${pts ? pts.length + ' points OSRM (Succès)' : 'Echec'}`);
    await new Promise(res => setTimeout(res, 200));
  }
}

run();
