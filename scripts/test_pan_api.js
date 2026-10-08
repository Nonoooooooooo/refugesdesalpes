import https from 'node:https';

https.get('https://transport.data.gouv.fr/api/datasets', { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const datasets = JSON.parse(data);
      const keywords = ['morzine', 'avoriaz', 'prodains', 'aulps', 'montriond', 'les gets', 'portes du soleil'];
      console.log(`Checking ${datasets.length} datasets for Morzine / Avoriaz keywords...`);
      let found = 0;
      for (const d of datasets) {
        const full = JSON.stringify(d).toLowerCase();
        for (const kw of keywords) {
          if (full.includes(kw)) {
            console.log(`MATCH [kw="${kw}"]: [${d.id}] "${d.title}" (${d.page_url})`);
            found++;
            break;
          }
        }
      }
      if (found === 0) {
        console.log('No direct match found in dataset titles/descriptions for local keywords.');
      }
    } catch (e) {
      console.error(e);
    }
  });
}).on('error', err => console.error(err));
