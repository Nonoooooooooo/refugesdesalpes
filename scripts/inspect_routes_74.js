import fs from 'node:fs';

const routes = fs.readFileSync('scripts/gtfs_74/routes.txt', 'utf8').split('\n');
const header = routes[0].split(',');
console.log('Routes count:', routes.length - 1);
console.log('Header:', header);

const matchingRoutes = [];
for (let i = 1; i < routes.length; i++) {
  const line = routes[i].trim();
  if (!line) continue;
  // Parse CSV line (simple regex for CSV fields)
  const parts = line.split(',');
  const shortName = parts[2] || '';
  const longName = parts[3] || '';
  const desc = (shortName + ' ' + longName).toLowerCase();
  
  if (
    desc.includes('morzine') || 
    desc.includes('avoriaz') || 
    desc.includes('prodains') || 
    desc.includes('gets') || 
    desc.includes('aulps') ||
    desc.includes('y91') ||
    desc.includes('y92') ||
    desc.includes('y93') ||
    desc.includes('y94')
  ) {
    matchingRoutes.push({ shortName, longName, raw: line });
  }
}

console.log(`\nFound ${matchingRoutes.length} matching routes for Morzine / Avoriaz / Vallée d'Aulps :`);
matchingRoutes.forEach(r => console.log(`- [${r.shortName}] ${r.longName}`));
