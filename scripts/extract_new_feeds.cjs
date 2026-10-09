const { execSync } = require('child_process');
const fs = require('fs');

const dirs = ['transaltitude', 'aravis', 'giffre', 'valdisere', 'la_rosiere'];
for (const d of dirs) {
  const zipPath = `scripts/data_gtfs_${d}.zip`;
  const outDir = `imports/${d}`;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}' -Force"`);
  console.log(`Extracted ${d}`);
}
