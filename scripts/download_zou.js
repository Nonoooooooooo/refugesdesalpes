import https from 'node:https';
import fs from 'node:fs';

const urlZouExpress = 'https://www.datasud.fr/fr/dataset/datasets/3743/resource/5153/download/';

console.log('Downloading ZOU Express GTFS...');
const file = fs.createWriteStream('scripts/data_gtfs_zou_express.zip');

function download(u, cb) {
  https.get(u, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log('Redirecting to:', res.headers.location);
      download(res.headers.location, cb);
    } else {
      res.pipe(file);
      res.on('end', () => cb());
    }
  }).on('error', err => console.error(err));
}

download(urlZouExpress, () => console.log('ZOU Express GTFS downloaded!'));
