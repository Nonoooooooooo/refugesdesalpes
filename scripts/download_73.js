import https from 'node:https';
import fs from 'node:fs';

const urlSavoie = 'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA';

console.log('Downloading Savoie GTFS...');
const file = fs.createWriteStream('scripts/data_gtfs_73.zip');

https.get(urlSavoie, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    https.get(res.headers.location, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res2 => {
      res2.pipe(file);
      res2.on('end', () => console.log('Savoie GTFS downloaded!'));
    });
  } else {
    res.pipe(file);
    res.on('end', () => console.log('Savoie GTFS downloaded!'));
  }
}).on('error', err => console.error(err));
