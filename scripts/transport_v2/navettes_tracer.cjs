/**
 * Calcule le tracé routier de chaque sens des navettes hors open data (navettes_traces.json).
 *
 * Le tracé suit le réseau routier OpenStreetMap d'arrêt en arrêt, via le serveur de
 * démonstration OSRM. Il n'est recalculé que lorsque les arrêts d'un sens changent.
 *
 * Utilisation (après avoir modifié navettes_hors_open_data.json) :
 *   node scripts/transport_v2/navettes_tracer.cjs
 *   node scripts/transport_v2/3_construire_reseau.cjs
 */

const fs = require('fs');
const { FILES, loadNavettes, loadTraces, stopsHash } = require('./navettes.cjs');

const OSRM = 'https://router.project-osrm.org/route/v1/driving';

// Douglas-Peucker léger (tolérance ~12 m) et arrondi au mètre
function simplify(coords, tolM = 12) {
  const round = (v) => Math.round(v * 1e5) / 1e5;
  if (coords.length <= 2) return coords.map(([x, y]) => [round(x), round(y)]);
  const kx = 111320 * Math.cos((coords[0][1] * Math.PI) / 180);
  const ky = 110540;
  const pts = coords.map(([x, y]) => [x * kx, y * ky]);
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const t = len2 ? Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2)) : 0;
      const d = Math.hypot(pts[i][0] - (ax + t * dx), pts[i][1] - (ay + t * dy));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolM) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return coords.filter((_, i) => keep[i]).map(([x, y]) => [round(x), round(y)]);
}

async function route(arrets) {
  const coords = arrets.map((a) => `${a.lng},${a.lat}`).join(';');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`, { headers: { 'User-Agent': 'RefugesDesAlpes-Navettes/1.0' } });
      const j = await res.json();
      if (j.code !== 'Ok') throw new Error(j.code || `HTTP ${res.status}`);
      return { coordinates: simplify(j.routes[0].geometry.coordinates), km: Math.round(j.routes[0].distance / 100) / 10 };
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

async function main() {
  const traces = loadTraces();
  const used = new Set();
  let calcules = 0;
  for (const n of loadNavettes()) {
    for (const [i, s] of (n.sens || []).entries()) {
      const key = `${n.id}#${i}`;
      used.add(key);
      if (!Array.isArray(s.arrets) || s.arrets.length < 2) continue;
      const empreinte = stopsHash(s.arrets);
      if (traces[key]?.empreinte === empreinte) continue;
      try {
        const r = await route(s.arrets);
        traces[key] = { empreinte, source: 'OSRM (réseau routier OpenStreetMap)', km: r.km, coordinates: r.coordinates };
        calcules++;
        console.log(`🧭 ${key.padEnd(40)} ${String(r.km).padStart(6)} km, ${r.coordinates.length} points`);
        await new Promise((res) => setTimeout(res, 1000)); // serveur de démonstration : rester discret
      } catch (err) {
        console.log(`⚠️  ${key} : tracé impossible (${err.message}), la ligne sera tracée d'arrêt en arrêt`);
      }
    }
  }
  for (const key of Object.keys(traces)) if (!used.has(key)) delete traces[key];
  fs.writeFileSync(FILES.traces, JSON.stringify(traces), 'utf8');
  console.log(`✅ ${calcules} tracés calculés, ${Object.keys(traces).length} au total`);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
