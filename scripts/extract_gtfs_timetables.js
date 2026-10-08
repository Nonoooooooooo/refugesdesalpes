import fs from 'node:fs';

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function extractTimetableForRoute(gtfsDir, routeShortName) {
  if (!fs.existsSync(`${gtfsDir}/routes.txt`)) return null;

  const routes = fs.readFileSync(`${gtfsDir}/routes.txt`, 'utf8').split('\n');
  let routeId = null;
  let routeLongName = '';
  for (let i = 1; i < routes.length; i++) {
    const p = parseCSVLine(routes[i]);
    if (p[2] && p[2].replace(/"/g, '').trim().toUpperCase() === routeShortName.toUpperCase()) {
      routeId = p[0].trim();
      routeLongName = p[3] ? p[3].replace(/"/g, '').trim() : '';
      break;
    }
  }

  if (!routeId) return null;

  // Trips
  const trips = fs.readFileSync(`${gtfsDir}/trips.txt`, 'utf8').split('\n');
  const tripIds = new Set();
  for (let i = 1; i < trips.length; i++) {
    const p = parseCSVLine(trips[i]);
    if (p[0]?.trim() === routeId && p[2]) {
      tripIds.add(p[2].trim());
    }
  }

  if (tripIds.size === 0) return null;

  // Stops map
  const stops = fs.readFileSync(`${gtfsDir}/stops.txt`, 'utf8').split('\n');
  const stopNames = {};
  for (let i = 1; i < stops.length; i++) {
    const p = parseCSVLine(stops[i]);
    if (p[0]) stopNames[p[0].trim()] = p[2] ? p[2].replace(/"/g, '').trim() : '';
  }

  // Stop times
  const stopTimes = fs.readFileSync(`${gtfsDir}/stop_times.txt`, 'utf8').split('\n');
  const tripStopTimes = {};
  for (let i = 1; i < stopTimes.length; i++) {
    const p = parseCSVLine(stopTimes[i]);
    const tId = p[0]?.trim();
    if (tId && tripIds.has(tId)) {
      if (!tripStopTimes[tId]) tripStopTimes[tId] = [];
      const sId = p[3]?.trim();
      const dep = p[2]?.trim().slice(0, 5); // HH:MM
      const seq = Number(p[4]);
      if (sId && dep) {
        tripStopTimes[tId].push({ stopId: sId, stopName: stopNames[sId] || sId, dep, seq });
      }
    }
  }

  // Trier les trips par heure de départ du 1er arrêt
  const validTrips = Object.entries(tripStopTimes)
    .filter(([_, stList]) => stList.length >= 3)
    .map(([tId, stList]) => {
      stList.sort((a, b) => a.seq - b.seq);
      return { tId, stList, firstDep: stList[0].dep };
    })
    .filter(t => t.firstDep && t.firstDep.length === 5)
    .sort((a, b) => a.firstDep.localeCompare(b.firstDep));

  if (validTrips.length === 0) return null;

  // Filtrer les trips dans le même sens principal (celui qui a le plus de départs)
  const destCounts = {};
  validTrips.forEach(t => {
    const lastStop = t.stList[t.stList.length - 1].stopName;
    destCounts[lastStop] = (destCounts[lastStop] || 0) + 1;
  });
  const mainDest = Object.entries(destCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mainDirectionTrips = validTrips.filter(t => t.stList[t.stList.length - 1].stopName === mainDest);
  const candidateTrips = mainDirectionTrips.length >= 3 ? mainDirectionTrips : validTrips;

  // Prendre jusqu'à 5 départs représentatifs (matin, midi, aprem, soir)
  const sampledTrips = [];
  const count = Math.min(5, candidateTrips.length);
  const step = candidateTrips.length / count;
  for (let i = 0; i < count; i++) {
    const tripIdx = Math.min(candidateTrips.length - 1, Math.floor(i * step));
    sampledTrips.push(candidateTrips[tripIdx]);
  }

  // Arrêts principaux du voyage type
  const representativeTrip = candidateTrips.reduce((prev, curr) => curr.stList.length > prev.stList.length ? curr : prev, candidateTrips[0]);
  const mainStops = representativeTrip.stList.map(s => s.stopName);

  const rows = mainStops.map(sName => {
    const times = sampledTrips.map(t => {
      const found = t.stList.find(st => st.stopName === sName);
      return found ? found.dep : '-';
    });
    return { stop: sName, times };
  });

  // Ne garder qu'un échantillon lisible si plus de 10 arrêts
  let sampledRows = rows;
  if (rows.length > 8) {
    const stepRow = Math.ceil(rows.length / 8);
    sampledRows = rows.filter((r, idx) => idx === 0 || idx === rows.length - 1 || idx % stepRow === 0);
  }

  const headers = sampledTrips.map((t, idx) => `Car ${idx + 1}`);

  return {
    headers,
    rows: sampledRows,
    note: `Horaires officiels Cars Région / GTFS (${candidateTrips.length} départs quotidiens)`
  };
}

// Extraction automatique
console.log('--- Extraction globale des grilles horaires GTFS ---');
const allTimetables = {};

const targets74 = ['Y91', 'Y92', 'Y93', 'Y94', 'Y51', 'Y81', 'Y82', 'Y71', 'Y72'];
targets74.forEach(ref => {
  const tt = extractTimetableForRoute('scripts/gtfs_74', ref);
  if (tt) {
    allTimetables[ref] = tt;
    console.log(`[GTFS 74] Horaires extraits pour ${ref} (${tt.rows.length} arrêts)`);
  }
});

const targets73 = ['S01', 'S03', 'S04', 'S05', 'S10', 'S11', 'S12'];
targets73.forEach(ref => {
  const tt = extractTimetableForRoute('scripts/gtfs_73', ref);
  if (tt) {
    allTimetables[ref] = tt;
    console.log(`[GTFS 73] Horaires extraits pour ${ref} (${tt.rows.length} arrêts)`);
  }
});

const targets38 = ['T75', 'T73', 'T76', 'T64', 'T65', 'T40', 'T90', 'T91', 'T92', 'T95', 'T50', 'T60', 'T62'];
targets38.forEach(ref => {
  const tt = extractTimetableForRoute('scripts/gtfs_38', ref);
  if (tt) {
    allTimetables[ref] = tt;
    console.log(`[GTFS 38] Horaires extraits pour ${ref} (${tt.rows.length} arrêts)`);
  }
});

if (!fs.existsSync('scripts/data')) {
  fs.mkdirSync('scripts/data', { recursive: true });
}
fs.writeFileSync('scripts/data/gtfs_timetables.json', JSON.stringify(allTimetables, null, 2));
console.log(`\nSauvegardé ${Object.keys(allTimetables).length} grilles horaires dans scripts/data/gtfs_timetables.json`);
