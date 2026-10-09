import fs from 'node:fs';

const content = fs.readFileSync('scripts/build_transport_dataset.js', 'utf8').split('\n');

const ids = ['bus-y51', 'bus-y62', 'bus-y63', 'bus-y81', 'bus-y82', 'bus-y91', 'bus-y92', 'bus-y93-sixt', 'bus-y71', 'bus-y72', 'bus-y21-talloires'];

for (let i = 0; i < content.length; i++) {
  const line = content[i];
  for (const id of ids) {
    if (line.includes(`id: '${id}'`) || line.includes(`id: "${id}"`)) {
      console.log(`Found ${id} at line ${i + 1}`);
    }
  }
}
