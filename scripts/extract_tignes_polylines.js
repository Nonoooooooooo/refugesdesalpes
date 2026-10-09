import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('scripts/tignes_osm_full.json', 'utf8'));

const nodes = new Map();
const ways = new Map();
const relations = [];

d.elements.forEach(e => {
  if (e.type === 'node') nodes.set(e.id, [Number(e.lon.toFixed(6)), Number(e.lat.toFixed(6))]);
  else if (e.type === 'way') ways.set(e.id, e.nodes);
  else if (e.type === 'relation') relations.push(e);
});

function buildPolylineFromWays(wayIds) {
  const points = [];
  wayIds.forEach(wid => {
    const nodeIds = ways.get(wid);
    if (!nodeIds) return;
    nodeIds.forEach(nid => {
      const coord = nodes.get(nid);
      if (coord) {
        if (points.length === 0 || points[points.length - 1][0] !== coord[0] || points[points.length - 1][1] !== coord[1]) {
          points.push(coord);
        }
      }
    });
  });
  return points;
}

relations.forEach(r => {
  const wayMembers = r.members.filter(m => m.type === 'way').map(m => m.ref);
  const poly = buildPolylineFromWays(wayMembers);
  console.log(`Relation ${r.id} (${r.tags.name}): ${wayMembers.length} ways, ${poly.length} coordinates`);
  if (poly.length > 0) {
    fs.writeFileSync(`scripts/data/tignes_rel_${r.id}.json`, JSON.stringify(poly));
  }
});
