import fs from 'node:fs';
import readline from 'node:readline';

async function inspectShapePoints() {
  const file = 'imports/haute_savoie/shapes.txt';
  const targetShapes = new Set(['3072$1078338$19', '3072$1100624$90', '3072$1097648$228']);
  const points = {};
  targetShapes.forEach(s => points[s] = []);

  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    const comma = line.indexOf(',');
    const sId = line.slice(0, comma).replace(/"/g, '');
    if (targetShapes.has(sId)) {
      const parts = line.split(',');
      points[sId].push({
        lat: parseFloat(parts[1]),
        lon: parseFloat(parts[2]),
        seq: parseInt(parts[3]),
        dist: parseFloat(parts[4])
      });
    }
  }

  for (const [sId, pts] of Object.entries(points)) {
    pts.sort((a, b) => a.seq - b.seq);
    console.log(`Shape ${sId}: ${pts.length} points, start: [${pts[0]?.lon}, ${pts[0]?.lat}], end: [${pts[pts.length-1]?.lon}, ${pts[pts.length-1]?.lat}], max dist: ${pts[pts.length-1]?.dist}m`);
  }
}

inspectShapePoints();
