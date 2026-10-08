import https from 'node:https';
import fs from 'node:fs';

const url = 'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA';

console.log('Downloading GTFS Haute-Savoie...');
const file = fs.createWriteStream('scripts/data_gtfs_74.zip');

https.get(url, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    console.log('Redirecting to:', res.headers.location);
    https.get(res.headers.location, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res2 => {
      res2.pipe(file);
      res2.on('end', () => console.log('Download finished!'));
    });
  } else {
    res.pipe(file);
    res.on('end', () => console.log('Download finished!'));
  }
}).on('error', err => console.error(err));
