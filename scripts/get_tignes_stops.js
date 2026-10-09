import https from 'node:https';
import fs from 'node:fs';

const overpassQuery = `[out:json][timeout:30];
(
  node["highway"="bus_stop"](45.42,6.88,45.56,7.02);
  node["public_transport"="platform"](45.42,6.88,45.56,7.02);
);
out tags center;`;

const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);

https.get(url, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Stops found:', json.elements.length);
      const stops = [];
      json.elements.forEach(e => {
        if (e.tags?.name) {
          stops.push({ name: e.tags.name, lat: e.lat, lng: e.lon });
          console.log(`- ${e.tags.name} [${e.lon}, ${e.lat}]`);
        }
      });
      fs.writeFileSync('scripts/tignes_named_stops.json', JSON.stringify(stops, null, 2));
    } catch (e) {
      console.error('Error:', e.message);
    }
  });
}).on('error', err => console.error(err));
