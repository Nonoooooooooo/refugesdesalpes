import fs from 'node:fs';

const files = fs.readdirSync('imports/ain').filter(f => f.startsWith('Ligne_'));
console.log(`Found ${files.length} line files in Ain:`);

for (const f of files) {
  const content = fs.readFileSync(`imports/ain/${f}`, 'utf8');
  const mName = content.match(/<Name>([^<]+)<\/Name>/);
  const mShort = content.match(/<ShortName>([^<]+)<\/ShortName>/);
  const mColor = content.match(/<ColourValue>([^<]+)<\/ColourValue>/);
  console.log(`- ${f}: [${mShort ? mShort[1] : ''}] ${mName ? mName[1] : ''} (Color: ${mColor ? mColor[1] : ''})`);
}
