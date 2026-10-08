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
  { name: 'S21 : Moûtiers ↔ Pralognan', coords: '6.5310,45.4830;6.6430,45.4410;6.6970,45.4540;6.7210,45.3800' },
  { name: 'S22 : Moûtiers ↔ Val Thorens', coords: '6.5310,45.4830;6.5050,45.3800;6.5330,45.3230;6.5800,45.2980' },
  { name: 'S52 : Modane ↔ Bonneval-sur-Arc', coords: '6.6660,45.2010;6.7420,45.2310;6.8740,45.2850;6.9930,45.3580;7.0470,45.3720' },
  { name: 'S53 : St-Jean ↔ St-Sorlin-d\'Arves', coords: '6.3530,45.2780;6.3050,45.2440;6.2420,45.2210;6.2200,45.2050' },
  { name: 'S11 : Aix-les-Bains ↔ Le Revard', coords: '5.9080,45.6880;5.9550,45.6980;5.9870,45.6830' },
  { name: 'T77 : Bourg-d\'Oisans ↔ La Bérarde', coords: '6.0305,45.0553;6.0720,45.0050;6.1750,44.9890;6.2930,44.9330' },
  { name: 'T93 : La Mure ↔ Alpe du Grand Serre', coords: '5.7870,44.9060;5.7720,44.9540;5.8190,45.0060' },
  { name: 'ZOU 74 : Gap ↔ Barcelonnette', coords: '6.0880,44.5670;6.2770,44.5450;6.5380,44.4710;6.6510,44.3860' },
  { name: 'ZOU 60 : Digne ↔ Castellane', coords: '6.2360,44.0920;6.3470,44.0530;6.3980,43.9480;6.5130,43.8470' },
  { name: 'ZOU 25 : Nice ↔ Tende', coords: '7.2620,43.7040;7.4470,43.8770;7.5140,43.9400;7.5520,43.9980;7.5930,44.0880' }
];

async function run() {
  for (const r of testRoutes) {
    const pts = await fetchRoute(r.coords);
    console.log(`${r.name} => ${pts ? pts.length + ' points (Succès)' : 'Echec'}`);
    await new Promise(res => setTimeout(res, 200));
  }
}

run();
