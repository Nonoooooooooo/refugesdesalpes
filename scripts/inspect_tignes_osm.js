import https from 'node:https';

const overpassQuery = `[out:json][timeout:30];
(
  relation["route"="bus"](45.42,6.88,45.56,7.02);
  relation["route"="funicular"](45.42,6.88,45.56,7.02);
  relation["route"="cable_car"](45.42,6.88,45.56,7.02);
);
out tags;`;

const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);

console.log('Querying Overpass for Tignes routes...');
https.get(url, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Total routes found in Tignes / Haute-Tarentaise area:', json.elements.length);
      json.elements.forEach(e => {
        console.log(`- [${e.tags.route}] ${e.id} : ${e.tags.ref || ''} "${e.tags.name}" (op: ${e.tags.operator || ''}, net: ${e.tags.network || ''})`);
      });
    } catch (e) {
      console.error('Error parsing:', e.message, data.slice(0, 300));
    }
  });
}).on('error', err => console.error('Request error:', err.message));
