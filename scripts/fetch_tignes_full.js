import https from 'node:https';
import fs from 'node:fs';

const overpassQuery = `[out:json][timeout:60];
(
  relation(2023055);
  relation(3960475);
  relation(17013466);
);
out body;
>;
out skel qt;`;

const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);

console.log('Fetching full geometry and stops for Tignes lines...');
https.get(url, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Overpass response elements count:', json.elements.length);
      fs.writeFileSync('scripts/tignes_osm_full.json', JSON.stringify(json, null, 2));
      console.log('Saved to scripts/tignes_osm_full.json');
    } catch (e) {
      console.error('Error parsing JSON:', e.message, data.slice(0, 300));
    }
  });
}).on('error', err => console.error('Fetch error:', err.message));
