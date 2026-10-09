import fs from 'node:fs';

const routesContent = fs.readFileSync('imports/cars_region_express/routes.txt', 'utf8');
const lines = routesContent.trim().split('\n');
const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
console.log('Header:', header);

const routes = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  // Parse CSV line handling quotes
  const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      parts.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += c;
    }
  }
  parts.push(current.trim().replace(/^"|"$/g, ''));
  
  const obj = {};
  header.forEach((h, idx) => {
    obj[h] = parts[idx] || '';
  });
  routes.push(obj);
}

console.log(`Total routes in Cars Région Express: ${routes.length}`);
routes.forEach(r => {
  console.log(`- [${r.route_short_name || r.route_id}] ${r.route_long_name} | color: #${r.route_color || ''} | type: ${r.route_type}`);
});
