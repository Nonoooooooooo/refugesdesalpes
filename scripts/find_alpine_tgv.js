import fs from 'node:fs';

const tgvLines = fs.readFileSync('imports/tgv/routes.txt', 'utf8').split('\n');
const header = tgvLines[0].split(',');

console.log('--- RECHERCHE ROUTES TGV ALPES ---');
const matches = [];

for (let i = 1; i < tgvLines.length; i++) {
  const line = tgvLines[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  const longName = parts[3] || '';
  const shortName = parts[2] || '';
  const lower = longName.toLowerCase();

  // Filtrer uniquement TGV / TGV INOUI / grande vitesse vers les Alpes
  if (
    lower.includes('alpes') ||
    lower.includes('grenoble') ||
    lower.includes('chambery') ||
    lower.includes('chambéry') ||
    lower.includes('annecy') ||
    lower.includes('bourg-saint-maurice') ||
    lower.includes('tarentaise') ||
    lower.includes('maurienne') ||
    lower.includes('modane') ||
    lower.includes('bellegarde') ||
    lower.includes('saint-gervais') ||
    lower.includes('evian') ||
    lower.includes('évian')
  ) {
    matches.push({ id: parts[0], shortName, longName, routeType: parts[5] });
  }
}

console.log(`Trouvé ${matches.length} routes correspondant aux critères.`);
matches.forEach((m) => console.log(`[${m.shortName}] ${m.longName} (ID: ${m.id})`));
