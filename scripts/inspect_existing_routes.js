import fs from 'node:fs';

const content = fs.readFileSync('scripts/build_transport_dataset.js', 'utf8');
const regex = /ref:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"]/g;
let m;
const routes = [];
while ((m = regex.exec(content)) !== null) {
  routes.push({ ref: m[1], name: m[2] });
}

console.log(`Total bus/navette routes found in code: ${routes.length}`);
routes.forEach(r => console.log(`- [${r.ref}] ${r.name}`));
