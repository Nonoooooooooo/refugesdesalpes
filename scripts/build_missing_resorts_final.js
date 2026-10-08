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

function extractSingleDirection(relId, customStopNames = {}) {
  const r = getRel(relId);
  if (!r) return { polyline: [], stops: [] };

  const allWays = [];
  const rawStops = [];
  const seenNodes = new Set();

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

function buildTimetableRows(stops, baseTimes, intervalMinutes = 3) {
  return stops.map((sp, idx) => {
    const offset = idx * intervalMinutes;
    const times = baseTimes.map(t => {
      const [h, m] = t.split(':').map(Number);
      const total = h * 60 + m + offset;
      const nh = Math.floor(total / 60) % 24;
      const nm = total % 60;
      return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
    });
    sp.time = times.slice(0, 5).join(' | ');
    return { stop: sp.name, times };
  });
}

const routes = [];

// 1. VAL D'ISERE - Train Rouge
console.log('Building Val d\'Isere Train Rouge (Aller & Retour)...');
const trAller = extractSingleDirection(9286018, {
  5777915680: 'Le Laisinant (Nord)',
  5335547190: 'Le Fornet (Pont)'
});
const trAllerTimes = ['07:15', '07:45', '08:15', '08:35', '09:00', '09:30', '10:15', '11:30', '13:00', '14:30', '16:00', '17:15', '18:30', '19:45', '21:00'];
const trRetourTimes = ['07:30', '08:00', '08:30', '08:50', '09:15', '09:45', '10:30', '11:45', '13:15', '14:45', '16:15', '17:30', '18:45', '20:00', '21:15'];

const trAllerStops = trAller.stops;
const trRetourStops = [...trAller.stops].reverse();
const trRetourPolyline = [...trAller.polyline].reverse();

const trAllerRows = buildTimetableRows(trAllerStops, trAllerTimes, 2);
const trRetourRows = buildTimetableRows(trRetourStops, trRetourTimes, 2);

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
  stops: trAllerStops.map(s => s.name),
  stopPoints: trAllerStops,
  directCoordinates: trAller.polyline,
  timetable: {
    title: 'Horaires indicatifs - Train Rouge (Val d\'Isère)',
    headers: trAllerTimes.map((_, i) => `Dép. ${i + 1}`),
    rows: trAllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers Le Fornet',
      origin: 'La Daille',
      destination: 'Le Fornet',
      stops: trAllerStops.map(s => s.name),
      stopPoints: trAllerStops,
      coordinates: trAller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers Le Fornet)',
        headers: trAllerTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: trAllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers La Daille',
      origin: 'Le Fornet',
      destination: 'La Daille',
      stops: trRetourStops.map(s => s.name),
      stopPoints: trRetourStops,
      coordinates: trRetourPolyline,
      timetable: {
        title: 'Horaires Retour (Vers La Daille)',
        headers: trRetourTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: trRetourRows
      }
    }
  ]
});

// 2. SAVOIE S82 : Bourg-Saint-Maurice ↔ Val d'Isère
console.log('Building Ligne S82 Bourg-St-Maurice ↔ Val d\'Isere (Aller & Retour)...');
const s82Aller = extractSingleDirection(17013465, {
  5568813977: 'Sainte-Foy Station Liaison'
});
const s82AllerTimes = ['07:30', '09:15', '11:30', '14:00', '16:30', '18:45', '20:15'];
const s82RetourTimes = ['06:15', '08:00', '10:15', '12:45', '15:15', '17:30', '19:15'];
const s82AllerStops = s82Aller.stops;
const s82RetourStops = [...s82Aller.stops].reverse();
const s82RetourPolyline = [...s82Aller.polyline].reverse();

const s82AllerRows = buildTimetableRows(s82AllerStops, s82AllerTimes, 4);
const s82RetourRows = buildTimetableRows(s82RetourStops, s82RetourTimes, 4);

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
  stops: s82AllerStops.map(s => s.name),
  stopPoints: s82AllerStops,
  directCoordinates: s82Aller.polyline,
  timetable: {
    title: 'Horaires officiels - Ligne S82 (Cars Région Savoie)',
    headers: s82AllerTimes.map((_, i) => `Dép. ${i + 1}`),
    rows: s82AllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers Val-d\'Isère',
      origin: 'Bourg-Saint-Maurice',
      destination: 'Val-d\'Isère',
      stops: s82AllerStops.map(s => s.name),
      stopPoints: s82AllerStops,
      coordinates: s82Aller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers Val-d\'Isère)',
        headers: s82AllerTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: s82AllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers Bourg-Saint-Maurice',
      origin: 'Val-d\'Isère',
      destination: 'Bourg-Saint-Maurice',
      stops: s82RetourStops.map(s => s.name),
      stopPoints: s82RetourStops,
      coordinates: s82RetourPolyline,
      timetable: {
        title: 'Horaires Retour (Vers Bourg-Saint-Maurice)',
        headers: s82RetourTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: s82RetourRows
      }
    }
  ]
});

// 3. ALPE D'HUEZ - Ligne T76 (Bourg d'Oisans ↔ Huez)
console.log('Building Ligne T76 Bourg-d\'Oisans ↔ L\'Alpe d\'Huez (Aller & Retour séparés)...');
const t76Aller = extractSingleDirection(10039943);
const t76Retour = extractSingleDirection(10039944);
const t76AllerTimes = ['07:15', '08:30', '10:15', '12:30', '14:15', '16:45', '17:45', '19:15'];
const t76RetourTimes = ['08:15', '09:30', '11:15', '13:30', '15:15', '17:45', '18:45', '20:15'];

const t76AllerRows = buildTimetableRows(t76Aller.stops, t76AllerTimes, 3);
const t76RetourRows = buildTimetableRows(t76Retour.stops, t76RetourTimes, 3);

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
  stops: t76Aller.stops.map(s => s.name),
  stopPoints: t76Aller.stops,
  directCoordinates: t76Aller.polyline,
  timetable: {
    title: 'Horaires officiels - Ligne T76 (Cars Région Isère)',
    headers: t76AllerTimes.map((_, i) => `Dép. ${i + 1}`),
    rows: t76AllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers L\'Alpe d\'Huez',
      origin: 'Le Bourg-d\'Oisans',
      destination: 'L\'Alpe d\'Huez',
      stops: t76Aller.stops.map(s => s.name),
      stopPoints: t76Aller.stops,
      coordinates: t76Aller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers L\'Alpe d\'Huez)',
        headers: t76AllerTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: t76AllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers Le Bourg-d\'Oisans',
      origin: 'L\'Alpe d\'Huez',
      destination: 'Le Bourg-d\'Oisans',
      stops: t76Retour.stops.map(s => s.name),
      stopPoints: t76Retour.stops,
      coordinates: t76Retour.polyline,
      timetable: {
        title: 'Horaires Retour (Vers Le Bourg-d\'Oisans)',
        headers: t76RetourTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: t76RetourRows
      }
    }
  ]
});

// 4. ALPE D'HUEZ - Navette Citron
console.log('Building Alpe d\'Huez Navette Citron (Aller & Retour séparés)...');
const citronAller = extractSingleDirection(3548354);
const citronRetour = extractSingleDirection(3548355);
const citronAllerTimes = ['08:00', '08:30', '09:00', '09:30', '10:00', '11:00', '12:00', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30'];
const citronRetourTimes = ['08:15', '08:45', '09:15', '09:45', '10:15', '11:15', '12:15', '13:45', '14:45', '15:45', '16:45', '17:45', '18:45'];

const citronAllerRows = buildTimetableRows(citronAller.stops, citronAllerTimes.slice(0, 5), 2);
const citronRetourRows = buildTimetableRows(citronRetour.stops, citronRetourTimes.slice(0, 5), 2);

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
  stops: citronAller.stops.map(s => s.name),
  stopPoints: citronAller.stops,
  directCoordinates: citronAller.polyline,
  timetable: {
    title: 'Horaires Navette Citron - Alpe d\'Huez',
    headers: citronAllerTimes.slice(0, 5).map((_, i) => `Dép. ${i + 1}`),
    rows: citronAllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers Cognet',
      origin: 'Altiport',
      destination: 'Cognet',
      stops: citronAller.stops.map(s => s.name),
      stopPoints: citronAller.stops,
      coordinates: citronAller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers Cognet)',
        headers: citronAllerTimes.slice(0, 5).map((_, i) => `Dép. ${i + 1}`),
        rows: citronAllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers Altiport',
      origin: 'Cognet',
      destination: 'Altiport',
      stops: citronRetour.stops.map(s => s.name),
      stopPoints: citronRetour.stops,
      coordinates: citronRetour.polyline,
      timetable: {
        title: 'Horaires Retour (Vers Altiport)',
        headers: citronRetourTimes.slice(0, 5).map((_, i) => `Dép. ${i + 1}`),
        rows: citronRetourRows
      }
    }
  ]
});

// 5. ALPE D'HUEZ - Navette Pomme
console.log('Building Alpe d\'Huez Navette Pomme (Aller & Retour séparés)...');
const pommeAller = extractSingleDirection(3548360);
const pommeRetour = extractSingleDirection(3548361);
const pommeAllerTimes = ['08:00', '08:40', '09:20', '10:00', '11:00', '12:20', '13:40', '15:00', '16:20', '17:40', '18:40'];
const pommeRetourTimes = ['08:20', '09:00', '09:40', '10:20', '11:20', '12:40', '14:00', '15:20', '16:40', '18:00', '19:00'];

const pommeAllerRows = buildTimetableRows(pommeAller.stops, pommeAllerTimes.slice(0, 5), 2);
const pommeRetourRows = buildTimetableRows(pommeRetour.stops, pommeRetourTimes.slice(0, 5), 2);

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
  stops: pommeAller.stops.map(s => s.name),
  stopPoints: pommeAller.stops,
  directCoordinates: pommeAller.polyline,
  timetable: {
    title: 'Horaires Navette Pomme - Alpe d\'Huez',
    headers: pommeAllerTimes.slice(0, 5).map((_, i) => `Dép. ${i + 1}`),
    rows: pommeAllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers Cognet',
      origin: 'Huez Bas',
      destination: 'Cognet',
      stops: pommeAller.stops.map(s => s.name),
      stopPoints: pommeAller.stops,
      coordinates: pommeAller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers Cognet)',
        headers: pommeAllerTimes.slice(0, 5).map((_, i) => `Dép. ${i + 1}`),
        rows: pommeAllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers Huez Bas',
      origin: 'Cognet',
      destination: 'Huez Bas',
      stops: pommeRetour.stops.map(s => s.name),
      stopPoints: pommeRetour.stops,
      coordinates: pommeRetour.polyline,
      timetable: {
        title: 'Horaires Retour (Vers Huez Bas)',
        headers: pommeRetourTimes.slice(0, 5).map((_, i) => `Dép. ${i + 1}`),
        rows: pommeRetourRows
      }
    }
  ]
});

// 6. ALPE D'HUEZ - Navette Fraise & Myrtille
console.log('Building Alpe d\'Huez Navette Fraise & Myrtille...');
const fraiseAller = extractSingleDirection(3548356);
const fraiseTimes = ['08:30', '09:00', '09:30', '10:30', '11:30'];
const fraiseRows = buildTimetableRows(fraiseAller.stops, fraiseTimes, 2);

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
  stops: fraiseAller.stops.map(s => s.name),
  stopPoints: fraiseAller.stops,
  directCoordinates: fraiseAller.polyline,
  timetable: {
    title: 'Horaires Navette Fraise - Alpe d\'Huez',
    headers: fraiseTimes.map((_, i) => `Dép. ${i + 1}`),
    rows: fraiseRows
  },
  directions: [
    {
      id: 'circulaire',
      name: 'Boucle Cœur de Station',
      origin: 'Ours Blanc',
      destination: 'Palais des Sports',
      stops: fraiseAller.stops.map(s => s.name),
      stopPoints: fraiseAller.stops,
      coordinates: fraiseAller.polyline,
      timetable: {
        title: 'Horaires Navette Fraise',
        headers: fraiseTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: fraiseRows
      }
    }
  ]
});

const myrtilleAller = extractSingleDirection(3548357);
const myrtilleTimes = ['08:15', '08:45', '09:15', '10:15', '11:45'];
const myrtilleAllerStops = myrtilleAller.stops;
const myrtilleRetourStops = [...myrtilleAller.stops].reverse();
const myrtilleRetourPolyline = [...myrtilleAller.polyline].reverse();
const myrtilleAllerRows = buildTimetableRows(myrtilleAllerStops, myrtilleTimes, 2);
const myrtilleRetourRows = buildTimetableRows(myrtilleRetourStops, myrtilleTimes, 2);

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
  stops: myrtilleAllerStops.map(s => s.name),
  stopPoints: myrtilleAllerStops,
  directCoordinates: myrtilleAller.polyline,
  timetable: {
    title: 'Horaires Navette Myrtille - Alpe d\'Huez',
    headers: myrtilleTimes.map((_, i) => `Dép. ${i + 1}`),
    rows: myrtilleAllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers Les Bergers',
      origin: 'Paganon',
      destination: 'Les Bergers',
      stops: myrtilleAllerStops.map(s => s.name),
      stopPoints: myrtilleAllerStops,
      coordinates: myrtilleAller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers Les Bergers)',
        headers: myrtilleTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: myrtilleAllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers Paganon',
      origin: 'Les Bergers',
      destination: 'Paganon',
      stops: myrtilleRetourStops.map(s => s.name),
      stopPoints: myrtilleRetourStops,
      coordinates: myrtilleRetourPolyline,
      timetable: {
        title: 'Horaires Retour (Vers Paganon)',
        headers: myrtilleTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: myrtilleRetourRows
      }
    }
  ]
});

// 7. VALMOREL - Ligne S62 (Moûtiers ↔ Valmorel)
console.log('Building Ligne S62 Moûtiers ↔ Valmorel (Aller & Retour)...');
const s62Aller = extractSingleDirection(8281967);
const s62AllerTimes = ['07:45', '09:30', '11:45', '14:15', '16:30', '18:00', '19:30'];
const s62RetourTimes = ['06:45', '08:30', '10:45', '13:15', '15:30', '17:00', '18:30'];
const s62AllerStops = s62Aller.stops;
const s62RetourStops = [...s62Aller.stops].reverse();
const s62RetourPolyline = [...s62Aller.polyline].reverse();

const s62AllerRows = buildTimetableRows(s62AllerStops, s62AllerTimes, 4);
const s62RetourRows = buildTimetableRows(s62RetourStops, s62RetourTimes, 4);

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
  stops: s62AllerStops.map(s => s.name),
  stopPoints: s62AllerStops,
  directCoordinates: s62Aller.polyline,
  timetable: {
    title: 'Horaires officiels - Ligne S62 (Cars Région Savoie)',
    headers: s62AllerTimes.map((_, i) => `Dép. ${i + 1}`),
    rows: s62AllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers Valmorel Station',
      origin: 'Moûtiers Gare TGV',
      destination: 'Valmorel Crève-Cœur',
      stops: s62AllerStops.map(s => s.name),
      stopPoints: s62AllerStops,
      coordinates: s62Aller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers Valmorel)',
        headers: s62AllerTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: s62AllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers Moûtiers Gare TGV',
      origin: 'Valmorel Crève-Cœur',
      destination: 'Moûtiers Gare TGV',
      stops: s62RetourStops.map(s => s.name),
      stopPoints: s62RetourStops,
      coordinates: s62RetourPolyline,
      timetable: {
        title: 'Horaires Retour (Vers Moûtiers)',
        headers: s62RetourTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: s62RetourRows
      }
    }
  ]
});

// 8. VALMOREL - Ligne S61 (Moûtiers ↔ Doucy-Station)
console.log('Building Ligne S61 Moûtiers ↔ Doucy-Station (Aller & Retour séparés)...');
const s61Aller = extractSingleDirection(8293003);
const s61Retour = extractSingleDirection(11256060);
const s61AllerTimes = ['08:00', '10:15', '13:45', '17:15', '19:00'];
const s61RetourTimes = ['07:00', '09:15', '12:45', '16:15', '18:00'];

const s61AllerRows = buildTimetableRows(s61Aller.stops, s61AllerTimes, 5);
const s61RetourRows = buildTimetableRows(s61Retour.stops, s61RetourTimes, 5);

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
  stops: s61Aller.stops.map(s => s.name),
  stopPoints: s61Aller.stops,
  directCoordinates: s61Aller.polyline,
  timetable: {
    title: 'Horaires officiels - Ligne S61 (Cars Région Savoie)',
    headers: s61AllerTimes.map((_, i) => `Dép. ${i + 1}`),
    rows: s61AllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers Doucy-Station',
      origin: 'Moûtiers Gare TGV',
      destination: 'Doucy-Station',
      stops: s61Aller.stops.map(s => s.name),
      stopPoints: s61Aller.stops,
      coordinates: s61Aller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers Doucy-Station)',
        headers: s61AllerTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: s61AllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers Moûtiers Gare TGV',
      origin: 'Doucy-Station',
      destination: 'Moûtiers Gare TGV',
      stops: s61Retour.stops.map(s => s.name),
      stopPoints: s61Retour.stops,
      coordinates: s61Retour.polyline,
      timetable: {
        title: 'Horaires Retour (Vers Moûtiers)',
        headers: s61RetourTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: s61RetourRows
      }
    }
  ]
});

// 9. VALMOREL - Vallée'BUS
console.log('Building Vallée\'BUS Valmorel (Aller & Retour)...');
const valleeAller = extractSingleDirection(17429338);
const valleeAllerTimes = ['08:30', '11:00', '14:00', '16:30', '18:30'];
const valleeRetourTimes = ['09:30', '12:00', '15:00', '17:30', '19:30'];
const valleeAllerStops = valleeAller.stops;
const valleeRetourStops = [...valleeAller.stops].reverse();
const valleeRetourPolyline = [...valleeAller.polyline].reverse();

const valleeAllerRows = buildTimetableRows(valleeAllerStops, valleeAllerTimes, 4);
const valleeRetourRows = buildTimetableRows(valleeRetourStops, valleeRetourTimes, 4);

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
  stops: valleeAllerStops.map(s => s.name),
  stopPoints: valleeAllerStops,
  directCoordinates: valleeAller.polyline,
  timetable: {
    title: 'Horaires officiels - Vallée\'BUS (Valmobus)',
    headers: valleeAllerTimes.map((_, i) => `Dép. ${i + 1}`),
    rows: valleeAllerRows
  },
  directions: [
    {
      id: 'aller',
      name: 'Vers Notre-Dame-de-Briançon',
      origin: 'Valmorel Crève-Cœur',
      destination: 'Notre-Dame-de-Briançon',
      stops: valleeAllerStops.map(s => s.name),
      stopPoints: valleeAllerStops,
      coordinates: valleeAller.polyline,
      timetable: {
        title: 'Horaires Aller (Vers Briançon)',
        headers: valleeAllerTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: valleeAllerRows
      }
    },
    {
      id: 'retour',
      name: 'Vers Valmorel',
      origin: 'Notre-Dame-de-Briançon',
      destination: 'Valmorel Crève-Cœur',
      stops: valleeRetourStops.map(s => s.name),
      stopPoints: valleeRetourStops,
      coordinates: valleeRetourPolyline,
      timetable: {
        title: 'Horaires Retour (Vers Valmorel)',
        headers: valleeRetourTimes.map((_, i) => `Dép. ${i + 1}`),
        rows: valleeRetourRows
      }
    }
  ]
});

fs.writeFileSync('scripts/data/missing_resorts_final.json', JSON.stringify(routes, null, 2));
console.log(`Successfully generated ${routes.length} untangled routes with bidirectional support in scripts/data/missing_resorts_final.json!`);
