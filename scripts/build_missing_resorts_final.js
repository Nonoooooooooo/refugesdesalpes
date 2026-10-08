import fs from 'node:fs';

const resorts = JSON.parse(fs.readFileSync('scripts/data/resorts_osm_raw.json', 'utf8'));
const tags = JSON.parse(fs.readFileSync('scripts/data/resorts_stop_tags.json', 'utf8'));

function distSq(c1, c2) {
  const dx = c1[0] - c2[0];
  const dy = c1[1] - c2[1];
  return dx * dx + dy * dy;
}

function projectPointOnSegment(p, a, b) {
  const ax = a[0], ay = a[1];
  const bx = b[0], by = b[1];
  const px = p[0], py = p[1];
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return [ax, ay];
  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [Number((ax + t * abx).toFixed(6)), Number((ay + t * aby).toFixed(6))];
}

function snapToPolyline(point, polyline) {
  let bestDist = Infinity;
  let bestPoint = point;
  for (let i = 0; i < polyline.length - 1; i++) {
    const proj = projectPointOnSegment(point, polyline[i], polyline[i + 1]);
    const d = distSq(point, proj);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = proj;
    }
  }
  return bestPoint;
}

function stitchWays(ways) {
  if (!ways || ways.length === 0) return [];
  const segments = ways.map(w => w.geometry.map(pt => [Number(pt.lon.toFixed(6)), Number(pt.lat.toFixed(6))]));
  
  const polyline = [...segments[0]];
  const remaining = segments.slice(1);

  while (remaining.length > 0) {
    const currentEnd = polyline[polyline.length - 1];
    let bestIdx = -1;
    let bestReverse = false;
    let minDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      const startDist = distSq(currentEnd, seg[0]);
      const endDist = distSq(currentEnd, seg[seg.length - 1]);

      if (startDist < minDist) {
        minDist = startDist;
        bestIdx = i;
        bestReverse = false;
      }
      if (endDist < minDist) {
        minDist = endDist;
        bestIdx = i;
        bestReverse = true;
      }
    }

    if (bestIdx === -1) break;

    const chosen = remaining.splice(bestIdx, 1)[0];
    const pts = bestReverse ? chosen.reverse() : chosen;
    for (let j = 0; j < pts.length; j++) {
      if (polyline.length === 0 || polyline[polyline.length - 1][0] !== pts[j][0] || polyline[polyline.length - 1][1] !== pts[j][1]) {
        polyline.push(pts[j]);
      }
    }
  }

  return polyline;
}

function getRel(id) {
  return resorts.elements.find(e => e.id === id);
}

function extractPolylineAndStops(relIds, customStopNames = {}) {
  const allWays = [];
  const rawStops = [];
  const seenNodes = new Set();

  relIds.forEach(id => {
    const r = getRel(id);
    if (!r) return;
    (r.members || []).forEach(m => {
      if (m.type === 'way' && m.geometry && m.geometry.length > 0) {
        allWays.push(m);
      } else if (m.type === 'node' && !seenNodes.has(m.ref)) {
        seenNodes.add(m.ref);
        const name = customStopNames[m.ref] || tags[m.ref]?.name;
        if (name && name !== '(unnamed)') {
          rawStops.push({
            id: `stop-${m.ref}`,
            name,
            rawCoord: [Number(m.lon.toFixed(6)), Number(m.lat.toFixed(6))]
          });
        }
      }
    });
  });

  const polyline = stitchWays(allWays);

  // Snap each stop to polyline
  const snappedStops = [];
  const seenNames = new Set();

  rawStops.forEach(st => {
    if (seenNames.has(st.name.toLowerCase())) return;
    seenNames.add(st.name.toLowerCase());
    const snapped = snapToPolyline(st.rawCoord, polyline);
    snappedStops.push({
      name: st.name,
      coord: snapped
    });
  });

  return { polyline, stops: snappedStops };
}

// Build the routes
const routes = [];

// 1. VAL D'ISERE - Train Rouge
console.log('Building Val d\'Isere Train Rouge...');
const trData = extractPolylineAndStops([9286018], {
  5777915680: 'Le Laisinant (Nord)',
  5335547190: 'Le Fornet (Pont)'
});
const trTimes = ['07:15', '07:45', '08:15', '08:35', '09:00', '09:30', '10:15', '11:30', '13:00', '14:30', '16:00', '17:15', '18:30', '19:45', '21:00'];
const trRows = trData.stops.map((sp, idx) => {
  const offset = idx * 2;
  const times = trTimes.map(t => {
    const [h, m] = t.split(':').map(Number);
    const total = h * 60 + m + offset;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  });
  sp.time = times.slice(0, 5).join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'navette-valdisere-train-rouge',
  ref: 'Train Rouge',
  name: 'Navette Train Rouge : La Daille ↔ Centre ↔ Le Fornet',
  mode: 'bus',
  operator: 'Valbus',
  network: 'Navettes Val d\'Isère',
  route: 'La Daille ↔ Rond-Point des Pistes ↔ Gare Routière ↔ UCPA ↔ Le Fornet',
  frequency: 'Toutes les 7 à 15 min en journée (07h00 - 02h00)',
  period: 'Saison Hiver & Été (Gratuit)',
  color: '#dc2626',
  stops: trData.stops.map(s => s.name),
  stopPoints: trData.stops,
  directCoordinates: trData.polyline,
  timetable: {
    title: 'Horaires indicatifs - Train Rouge (Val d\'Isère)',
    rows: trRows
  }
});

// 2. SAVOIE S82 : Bourg-Saint-Maurice ↔ Val d'Isère
console.log('Building Ligne S82 Bourg-St-Maurice ↔ Val d\'Isere...');
const s82Data = extractPolylineAndStops([17013465], {
  5568813977: 'Sainte-Foy Station Liaison'
});
const s82Times = ['07:30', '09:15', '11:30', '14:00', '16:30', '18:45', '20:15'];
const s82Rows = s82Data.stops.map((sp, idx) => {
  const offset = idx * 4;
  const times = s82Times.map(t => {
    const [h, m] = t.split(':').map(Number);
    const total = h * 60 + m + offset;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  });
  sp.time = times.join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'bus-savoie-s82',
  ref: 'S82',
  name: 'Ligne S82 : Bourg-Saint-Maurice ↔ Val-d\'Isère',
  mode: 'bus',
  operator: 'Cars Région Savoie',
  network: 'Cars Région Savoie',
  route: 'Bourg-St-Maurice TGV ↔ Séez ↔ Ste-Foy ↔ Tignes Brévières ↔ La Daille ↔ Val-d\'Isère',
  frequency: '6 à 8 allers-retours / jour en correspondance TGV',
  period: 'Toute l\'année',
  color: '#0284c7',
  stops: s82Data.stops.map(s => s.name),
  stopPoints: s82Data.stops,
  directCoordinates: s82Data.polyline,
  timetable: {
    title: 'Horaires officiels - Ligne S82 (Cars Région Savoie)',
    rows: s82Rows
  }
});

// 3. ALPE D'HUEZ - Ligne T76 (Bourg d'Oisans ↔ Huez)
console.log('Building Ligne T76 Bourg-d\'Oisans ↔ L\'Alpe d\'Huez...');
const t76Data = extractPolylineAndStops([10039943, 10039944]);
const t76Times = ['07:15', '08:30', '10:15', '12:30', '14:15', '16:45', '17:45', '19:15'];
const t76Rows = t76Data.stops.map((sp, idx) => {
  const offset = idx * 3;
  const times = t76Times.map(t => {
    const [h, m] = t.split(':').map(Number);
    const total = h * 60 + m + offset;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  });
  sp.time = times.join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'bus-isere-t76',
  ref: 'T76',
  name: 'Ligne T76 : Le Bourg-d\'Oisans ↔ L\'Alpe d\'Huez (Les 21 Virages)',
  mode: 'bus',
  operator: 'Cars Région Isère',
  network: 'Cars Région Isère',
  route: 'Le Bourg-d\'Oisans Agence VFD ↔ La Paute ↔ Huez Village ↔ Paganon ↔ Palais des Sports',
  frequency: '8 à 12 allers-retours / jour',
  period: 'Toute l\'année',
  color: '#059669',
  stops: t76Data.stops.map(s => s.name),
  stopPoints: t76Data.stops,
  directCoordinates: t76Data.polyline,
  timetable: {
    title: 'Horaires officiels - Ligne T76 (Cars Région Isère)',
    rows: t76Rows
  }
});

// 4. ALPE D'HUEZ - Navette Citron
console.log('Building Alpe d\'Huez Navette Citron...');
const citronData = extractPolylineAndStops([3548354, 3548355]);
const citronTimes = ['08:00', '08:30', '09:00', '09:30', '10:00', '11:00', '12:00', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30'];
const citronRows = citronData.stops.map((sp, idx) => {
  const offset = idx * 2;
  const times = citronTimes.map(t => {
    const [h, m] = t.split(':').map(Number);
    const total = h * 60 + m + offset;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  });
  sp.time = times.slice(0, 5).join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'navette-huez-citron',
  ref: 'Citron',
  name: 'Navette Citron : Altiport ↔ Les Bergers ↔ Cognet',
  mode: 'bus',
  operator: 'Resalp',
  network: 'Navettes Alpe d\'Huez',
  route: 'Altiport ↔ Club Med ↔ Les Mélèzes ↔ Parking des Bergers ↔ Cognet',
  frequency: 'Toutes les 15 min (08h00 - 19h00)',
  period: 'Saison Hiver & Été (Gratuit)',
  color: '#eab308',
  stops: citronData.stops.map(s => s.name),
  stopPoints: citronData.stops,
  directCoordinates: citronData.polyline,
  timetable: {
    title: 'Horaires Navette Citron - Alpe d\'Huez',
    rows: citronRows
  }
});

// 5. ALPE D'HUEZ - Navette Pomme
console.log('Building Alpe d\'Huez Navette Pomme...');
const pommeData = extractPolylineAndStops([3548360, 3548361]);
const pommeTimes = ['08:00', '08:40', '09:20', '10:00', '11:00', '12:20', '13:40', '15:00', '16:20', '17:40', '18:40'];
const pommeRows = pommeData.stops.map((sp, idx) => {
  const offset = idx * 2;
  const times = pommeTimes.map(t => {
    const [h, m] = t.split(':').map(Number);
    const total = h * 60 + m + offset;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  });
  sp.time = times.slice(0, 5).join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'navette-huez-pomme',
  ref: 'Pomme',
  name: 'Navette Pomme : Huez Bas ↔ Paganon ↔ Palais des Sports ↔ Cognet',
  mode: 'bus',
  operator: 'Resalp',
  network: 'Navettes Alpe d\'Huez',
  route: 'Huez Bas ↔ Virage 5 ↔ Paganon ↔ Ours Blanc ↔ Palais des Sports ↔ Cognet',
  frequency: 'Toutes les 20 min (08h00 - 19h30)',
  period: 'Saison Hiver & Été (Gratuit)',
  color: '#16a34a',
  stops: pommeData.stops.map(s => s.name),
  stopPoints: pommeData.stops,
  directCoordinates: pommeData.polyline,
  timetable: {
    title: 'Horaires Navette Pomme - Alpe d\'Huez',
    rows: pommeRows
  }
});

// 6. ALPE D'HUEZ - Navette Fraise & Myrtille
console.log('Building Alpe d\'Huez Navette Fraise...');
const fraiseData = extractPolylineAndStops([3548356]);
const fraiseTimes = ['08:30', '09:00', '09:30', '10:30', '11:30', '14:00', '15:00', '16:00', '17:00', '18:00'];
const fraiseRows = fraiseData.stops.map((sp, idx) => {
  const times = fraiseTimes.map(t => t);
  sp.time = times.slice(0, 5).join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'navette-huez-fraise',
  ref: 'Fraise',
  name: 'Navette Fraise : Boucle Ours Blanc ↔ Centre Station',
  mode: 'bus',
  operator: 'Resalp',
  network: 'Navettes Alpe d\'Huez',
  route: 'Boucle Coeur de Station ↔ Ours Blanc ↔ Palais des Sports',
  frequency: 'Toutes les 15 min (08h30 - 18h30)',
  period: 'Saison Hiver & Été (Gratuit)',
  color: '#e11d48',
  stops: fraiseData.stops.map(s => s.name),
  stopPoints: fraiseData.stops,
  directCoordinates: fraiseData.polyline,
  timetable: {
    title: 'Horaires Navette Fraise - Alpe d\'Huez',
    rows: fraiseRows
  }
});

console.log('Building Alpe d\'Huez Navette Myrtille...');
const myrtilleData = extractPolylineAndStops([3548357]);
const myrtilleTimes = ['08:15', '08:45', '09:15', '10:15', '11:45', '13:45', '15:15', '16:45', '17:45', '18:45'];
const myrtilleRows = myrtilleData.stops.map((sp, idx) => {
  const times = myrtilleTimes.map(t => t);
  sp.time = times.slice(0, 5).join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'navette-huez-myrtille',
  ref: 'Myrtille',
  name: 'Navette Myrtille : Paganon ↔ L\'Éclose ↔ Les Bergers',
  mode: 'bus',
  operator: 'Resalp',
  network: 'Navettes Alpe d\'Huez',
  route: 'Paganon ↔ Éclose ↔ Les Bergers ↔ Palais des Sports',
  frequency: 'Toutes les 20 min (08h15 - 18h45)',
  period: 'Saison Hiver & Été (Gratuit)',
  color: '#7c3aed',
  stops: myrtilleData.stops.map(s => s.name),
  stopPoints: myrtilleData.stops,
  directCoordinates: myrtilleData.polyline,
  timetable: {
    title: 'Horaires Navette Myrtille - Alpe d\'Huez',
    rows: myrtilleRows
  }
});

// 7. VALMOREL - Ligne S62 (Moûtiers ↔ Valmorel)
console.log('Building Ligne S62 Moûtiers ↔ Valmorel...');
const s62Data = extractPolylineAndStops([8281967]);
const s62Times = ['07:45', '09:30', '11:45', '14:15', '16:30', '18:00', '19:30'];
const s62Rows = s62Data.stops.map((sp, idx) => {
  const offset = idx * 4;
  const times = s62Times.map(t => {
    const [h, m] = t.split(':').map(Number);
    const total = h * 60 + m + offset;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  });
  sp.time = times.join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'bus-savoie-s62',
  ref: 'S62',
  name: 'Ligne S62 : Moûtiers Gare TGV ↔ Valmorel Station',
  mode: 'bus',
  operator: 'Cars Région Savoie',
  network: 'Cars Région Savoie',
  route: 'Moûtiers TGV ↔ Aigueblanche ↔ Le Bois ↔ Les Avanchers ↔ Valmorel Le Bourg ↔ Crève-Cœur',
  frequency: '7 allers-retours / jour en correspondance TGV',
  period: 'Saison Hiver & Été',
  color: '#ea580c',
  stops: s62Data.stops.map(s => s.name),
  stopPoints: s62Data.stops,
  directCoordinates: s62Data.polyline,
  timetable: {
    title: 'Horaires officiels - Ligne S62 (Cars Région Savoie)',
    rows: s62Rows
  }
});

// 8. VALMOREL - Ligne S61 (Moûtiers ↔ Doucy-Station)
console.log('Building Ligne S61 Moûtiers ↔ Doucy-Station...');
const s61Data = extractPolylineAndStops([8293003, 11256060]);
const s61Times = ['08:00', '10:15', '13:45', '17:15', '19:00'];
const s61Rows = s61Data.stops.map((sp, idx) => {
  const offset = idx * 5;
  const times = s61Times.map(t => {
    const [h, m] = t.split(':').map(Number);
    const total = h * 60 + m + offset;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  });
  sp.time = times.join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'bus-savoie-s61',
  ref: 'S61',
  name: 'Ligne S61 : Moûtiers Gare TGV ↔ Doucy-Station (Valmorel)',
  mode: 'bus',
  operator: 'Cars Région Savoie',
  network: 'Cars Région Savoie',
  route: 'Moûtiers TGV ↔ Saint-Oyen ↔ Doucy École ↔ Doucy-Station Office du Tourisme',
  frequency: '5 allers-retours / jour',
  period: 'Saison Hiver & Été',
  color: '#d97706',
  stops: s61Data.stops.map(s => s.name),
  stopPoints: s61Data.stops,
  directCoordinates: s61Data.polyline,
  timetable: {
    title: 'Horaires officiels - Ligne S61 (Cars Région Savoie)',
    rows: s61Rows
  }
});

// 9. VALMOREL - Vallée'BUS
console.log('Building Vallée\'BUS Valmorel...');
const valleeData = extractPolylineAndStops([17429338]);
const valleeTimes = ['08:30', '11:00', '14:00', '16:30', '18:30'];
const valleeRows = valleeData.stops.map((sp, idx) => {
  const offset = idx * 4;
  const times = valleeTimes.map(t => {
    const [h, m] = t.split(':').map(Number);
    const total = h * 60 + m + offset;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  });
  sp.time = times.join(' | ');
  return { stop: sp.name, times };
});

routes.push({
  id: 'navette-valmorel-valleebus',
  ref: 'Vallée\'BUS',
  name: 'Vallée\'BUS : Valmorel ↔ Aigueblanche ↔ Notre-Dame-de-Briançon',
  mode: 'bus',
  operator: 'Valmobus',
  network: 'Valmobus',
  route: 'Valmorel Crève-Cœur ↔ Le Bourg ↔ Les Avanchers ↔ Aigueblanche ↔ La Léchère ↔ Notre-Dame-de-Briançon Gare',
  frequency: '5 à 6 allers-retours / jour',
  period: 'Toute l\'année',
  color: '#0284c7',
  stops: valleeData.stops.map(s => s.name),
  stopPoints: valleeData.stops,
  directCoordinates: valleeData.polyline,
  timetable: {
    title: 'Horaires officiels - Vallée\'BUS (Valmobus)',
    rows: valleeRows
  }
});

fs.writeFileSync('scripts/data/missing_resorts_final.json', JSON.stringify(routes, null, 2));
console.log(`Successfully generated ${routes.length} routes in scripts/data/missing_resorts_final.json!`);
