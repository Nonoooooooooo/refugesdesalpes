import fs from 'node:fs';
import readline from 'node:readline';

// Quick test to see how fast we can stream shapes.txt
async function testShapesStream() {
  const t0 = Date.now();
  const file = 'imports/haute_savoie/shapes.txt';
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity
  });

  let lines = 0;
  const shapeIds = new Set();
  for await (const line of rl) {
    lines++;
    if (lines === 1) continue;
    const comma = line.indexOf(',');
    if (comma !== -1) {
      shapeIds.add(line.slice(0, comma).replace(/"/g, ''));
    }
  }
  console.log(`Streamed ${lines} lines in ${Date.now() - t0}ms. Unique shapes: ${shapeIds.size}`);
}

testShapesStream();
