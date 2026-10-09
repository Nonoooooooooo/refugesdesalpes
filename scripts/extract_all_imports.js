import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const zips = [
  { match: 'Ain.zip', dir: 'ain' },
  { match: 'alpe-huez.zip', dir: 'alpe_huez' },
  { match: 'Bourg Saint Maurice', dir: 'bourg_saint_maurice' },
  { match: 'Drome.zip', dir: 'drome' },
  { match: 'Funiculaire Arcs', dir: 'funiculaire_arcs' },
  { match: 'rosi', dir: 'la_rosiere' },
  { match: 'Meribus', dir: 'meribus' },
  { match: '2-alpes', dir: 'deux_alpes' },
  { match: 'Courchevel', dir: 'courchevel' },
  { match: 'Belleville', dir: 'belleville' },
  { exact: 'Savoie.zip', dir: 'savoie' },
  { match: 'valdisere.zip', dir: 'valdisere' },
  { match: 'valmorel.zip', dir: 'valmorel' }
];

const allFiles = fs.readdirSync('imports').filter(f => f.endsWith('.zip'));

for (const z of zips) {
  const actualFile = z.exact
    ? allFiles.find(f => f.toLowerCase() === z.exact.toLowerCase())
    : allFiles.find(f => f.toLowerCase().includes(z.match.toLowerCase()));
  if (!actualFile) {
    console.warn(`No zip matching '${z.match}' found`);
    continue;
  }
  const outDir = path.join('imports', z.dir);
  console.log(`Extracting: "${actualFile}" -> "${outDir}"`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  try {
    const psFile = actualFile.replace(/'/g, "''");
    const psDir = outDir.replace(/'/g, "''");
    const cmd = `powershell -NoProfile -Command "Expand-Archive -LiteralPath 'imports/${psFile}' -DestinationPath '${psDir}' -Force"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`  ✓ Extracted to ${outDir}`);
  } catch (e) {
    console.error(`  ✗ Error on ${actualFile}:`, e.message);
  }
}
