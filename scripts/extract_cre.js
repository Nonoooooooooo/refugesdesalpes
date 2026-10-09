import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const zips = fs.readdirSync('imports').filter(f => f.endsWith('.zip') && f.toLowerCase().includes('interurbain'));
console.log('Zip found:', zips);
if (zips.length > 0) {
  const zipPath = path.join('imports', zips[0]);
  execSync(`powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath 'imports/cars_region_express' -Force"`);
  console.log('Extracted successfully!');
  const files = fs.readdirSync('imports/cars_region_express');
  files.forEach(f => {
    const s = fs.statSync(path.join('imports/cars_region_express', f));
    console.log(f, s.size, 'bytes');
  });
}
