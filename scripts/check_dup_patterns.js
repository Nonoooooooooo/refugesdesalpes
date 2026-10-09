import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));

let consecutiveDups = 0;
let palindromeDups = 0;
let loopDups = 0;

d.features.forEach((f) => {
  if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') return;
  const p = f.properties || {};
  const stops = p.stops || [];
  if (stops.length < 2) return;

  const names = stops.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : (s.name || '').trim().toLowerCase()));

  // 1. Doublons consécutifs
  for (let i = 0; i < names.length - 1; i++) {
    if (names[i] && names[i] === names[i + 1]) {
      consecutiveDups++;
    }
  }

  // 2. Vérifier si c'est une liste symétrique aller-retour (palindrome)
  // Chercher le point culminant ou de rebroussement (terminus)
  const first = names[0];
  const last = names[names.length - 1];
  if (first === last && names.length > 3) {
    loopDups++;
  }
});

console.log('Doublons consécutifs trouvés:', consecutiveDups);
console.log('Lignes faisant une boucle fermée (départ == arrivée):', loopDups);
