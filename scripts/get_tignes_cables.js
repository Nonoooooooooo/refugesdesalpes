import https from 'node:https';
import fs from 'node:fs';

const overpassQuery = `[out:json][timeout:30];
(
  way["aerialway"="cable_car"](45.40,6.88,45.52,6.96);
  way["aerialway"="gondola"](45.40,6.88,45.52,6.96);
  way["railway"="funicular"](45.40,6.88,45.52,6.96);
  relation["railway"="funicular"](45.40,6.88,45.52,6.96);
);
out body;
>;
out skel qt;`;

const req = https.request('https://overpass-api.de/api/interpreter', { method: 'POST' }, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Total elements:', json.elements.length);
      fs.writeFileSync('scripts/tignes_cables_osm.json', JSON.stringify(json, null, 2));
    } catch (e) {
      console.error(e.message);
    }
  });
});
req.write('data=' + encodeURIComponent(overpassQuery));
req.end();
