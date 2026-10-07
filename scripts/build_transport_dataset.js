import fs from 'node:fs';
import https from 'node:https';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

function fetchRoute(coords) {
  return new Promise((resolve) => {
    const url = `${OSRM_URL}${coords}?overview=simplified&geometries=geojson`;
    https.get(url, { headers: { 'User-Agent': 'RefugesDesAlpes/1.0' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.code === 'Ok' && json.routes?.[0]?.geometry) {
            resolve(json.routes[0].geometry.coordinates);
          } else {
            console.warn('OSRM error for coords:', coords, json.code);
            resolve(null);
          }
        } catch (e) {
          console.warn('OSRM parse error:', e.message);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.warn('OSRM network error:', err.message);
      resolve(null);
    });
  });
}

const BUS_ROUTES = [
  // HAUTE-SAVOIE & MONT-BLANC
  {
    id: 'bus-y51',
    ref: 'Y51',
    name: 'Ligne Y51 : Annecy ↔ Albertville',
    mode: 'bus',
    operator: 'Cars Région Haute-Savoie',
    network: 'Cars Région',
    route: 'Annecy ↔ Faverges ↔ Ugine ↔ Albertville',
    frequency: 'Toutes les 30 à 60 min (Tous les jours)',
    period: 'Toute l\'année',
    stops: ['Annecy Gare Routière', 'Sévrier', 'Saint-Jorioz', 'Doussard', 'Faverges', 'Ugine', 'Albertville Gare'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.1296,45.8992;6.2215,45.7820;6.3150,45.7480;6.3927,45.6756'
  },
  {
    id: 'bus-y62',
    ref: 'Y62',
    name: 'Ligne Y62 : Annecy ↔ La Clusaz / Le Grand-Bornand',
    mode: 'bus',
    operator: 'Cars Région Haute-Savoie',
    network: 'Cars Région',
    route: 'Annecy ↔ Thônes ↔ Saint-Jean-de-Sixt ↔ La Clusaz / Grand-Bornand',
    frequency: 'Toutes les heures (Liaison Aravis)',
    period: 'Toute l\'année',
    stops: ['Annecy Gare', 'Alex', 'Thônes Gare Routière', 'Saint-Jean-de-Sixt', 'La Clusaz', 'Le Grand-Bornand'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.1296,45.8992;6.3248,45.8820;6.4087,45.9228;6.4265,45.9048'
  },
  {
    id: 'bus-y81',
    ref: 'Y81',
    name: 'Ligne Y81 : Cluses ↔ Chamonix-Mont-Blanc',
    mode: 'bus',
    operator: 'Cars Région Haute-Savoie',
    network: 'Cars Région',
    route: 'Cluses ↔ Sallanches ↔ Saint-Gervais ↔ Les Houches ↔ Chamonix',
    frequency: 'Plusieurs liaisons par jour',
    period: 'Toute l\'année',
    stops: ['Cluses Gare', 'Sallanches', 'Le Fayet', 'Les Houches', 'Chamonix Sud'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.5790,46.0601;6.6300,45.9380;6.7118,45.9080;6.8694,45.9237'
  },
  {
    id: 'bus-y82',
    ref: 'Y82',
    name: 'Ligne Y82 : Chamonix ↔ Megève ↔ Praz-sur-Arly',
    mode: 'bus',
    operator: 'Cars Région Haute-Savoie',
    network: 'Cars Région',
    route: 'Chamonix ↔ Les Houches ↔ Saint-Gervais ↔ Megève ↔ Praz-sur-Arly',
    frequency: 'Quotidien été & hiver',
    period: 'Toute l\'année',
    stops: ['Chamonix Sud', 'Les Houches', 'Saint-Gervais', 'Demi-Quartier', 'Megève Autogare', 'Praz-sur-Arly'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.8694,45.9237;6.7978,45.8899;6.7118,45.8920;6.6178,45.8568;6.5740,45.8370'
  },
  {
    id: 'bus-y92',
    ref: 'Y92/Y93',
    name: 'Ligne Y92/Y93 : Cluses ↔ Samoëns ↔ Sixt-Fer-à-Cheval',
    mode: 'bus',
    operator: 'Cars Région Haute-Savoie',
    network: 'Cars Région',
    route: 'Cluses ↔ Taninges ↔ Samoëns ↔ Sixt-Fer-à-Cheval (Vallée du Giffre)',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Cluses Gare', 'Taninges', 'Morillon', 'Samoëns Gare Routière', 'Sixt-Fer-à-Cheval'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.5790,46.0601;6.5910,46.1080;6.7275,46.0838;6.7770,46.0560'
  },
  {
    id: 'navette-chamonix-1',
    ref: 'Ligne 1',
    name: 'Chamonix Bus 1 : Les Houches ↔ Chamonix ↔ Les Praz',
    mode: 'navette',
    operator: 'Chamonix Mobilité',
    network: 'Chamonix Bus',
    route: 'Les Houches (Prarion) ↔ Chamonix Centre ↔ Les Praz (Téléphérique Flégère)',
    frequency: 'Toutes les 15 à 30 min (Navette gratuite vallée)',
    period: 'Toute l\'année',
    stops: ['Les Houches Prarion', 'Le Grippaz', 'Chamonix Centre', 'Place Mont-Blanc', 'Les Praz Flégère'],
    color: '#f59e0b',
    url: 'https://chamonix-bus.com',
    coords: '6.7745,45.8890;6.8694,45.9237;6.8860,45.9410'
  },
  {
    id: 'navette-chamonix-2',
    ref: 'Ligne 2',
    name: 'Chamonix Bus 2 : Le Tour ↔ Argentière ↔ Chamonix ↔ Les Bossons',
    mode: 'navette',
    operator: 'Chamonix Mobilité',
    network: 'Chamonix Bus',
    route: 'Le Tour ↔ Montroc ↔ Argentière (Grands Montets) ↔ Chamonix ↔ Les Bossons',
    frequency: 'Toutes les 20 à 30 min',
    period: 'Toute l\'année',
    stops: ['Le Tour', 'Montroc', 'Argentière Gare', 'Les Chosalets', 'Chamonix Sud', 'Glacier des Bossons'],
    color: '#f59e0b',
    url: 'https://chamonix-bus.com',
    coords: '6.9460,46.0020;6.9290,45.9830;6.8694,45.9237;6.8420,45.8980'
  },
  {
    id: 'navette-sixt-lignon',
    ref: 'Navette Giffre',
    name: 'Navette Estivale Sixt ↔ Fer-à-Cheval ↔ Le Lignon',
    mode: 'navette',
    operator: 'Haut-Giffre Tourisme',
    network: 'Navettes du Giffre',
    route: 'Sixt-Fer-à-Cheval ↔ Cirque du Fer-à-Cheval ↔ Cascade du Rouget ↔ Le Lignon',
    frequency: 'Toutes les heures en été (Accès sentiers & refuges)',
    period: 'Saison estivale (Juin-Septembre)',
    stops: ['Sixt Village', 'Gorges des Tines', 'Cirque du Fer-à-Cheval', 'Cascade du Rouget', 'Le Lignon (Départ refuges Anterne & Sales)'],
    color: '#f59e0b',
    url: 'https://www.haut-giffre.fr',
    coords: '6.7770,46.0560;6.8220,46.0790;6.8160,46.0420;6.8280,46.0280'
  },

  // SAVOIE (TARENTAISE & MAURIENNE & VANOISE)
  {
    id: 'bus-s10',
    ref: 'S10',
    name: 'Ligne S10 : Moûtiers ↔ Courchevel',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Moûtiers ↔ Brides-les-Bains ↔ Saint-Bon ↔ Courchevel (1550, 1650, 1850)',
    frequency: 'Nombreux allers-retours quotidiens',
    period: 'Toute l\'année (Renfort saisonnier)',
    stops: ['Moûtiers Gare', 'Brides-les-Bains', 'Courchevel Le Praz', 'Courchevel 1550', 'Courchevel 1850'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.5317,45.4836;6.5680,45.4520;6.6260,45.4320;6.6340,45.4140'
  },
  {
    id: 'bus-s11',
    ref: 'S11',
    name: 'Ligne S11 : Moûtiers ↔ Méribel',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Moûtiers ↔ Brides-les-Bains ↔ Les Allues ↔ Méribel Centre ↔ Mottaret',
    frequency: 'Régulier été & hiver',
    period: 'Toute l\'année',
    stops: ['Moûtiers Gare', 'Brides-les-Bains', 'Les Allues', 'Méribel Centre', 'Méribel Mottaret'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.5317,45.4836;6.5680,45.4520;6.5660,45.3980;6.5780,45.3720'
  },
  {
    id: 'bus-s12',
    ref: 'S12',
    name: 'Ligne S12 : Moûtiers ↔ Les Menuires ↔ Val Thorens',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Moûtiers ↔ Saint-Martin-de-Belleville ↔ Les Menuires ↔ Val Thorens',
    frequency: 'Cadencement renforcé week-ends et vacances',
    period: 'Toute l\'année',
    stops: ['Moûtiers Gare', 'Saint-Jean-de-Belleville', 'Saint-Martin-de-Belleville', 'Les Menuires', 'Val Thorens (2300 m)'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.5317,45.4836;6.5050,45.3800;6.5360,45.3230;6.5800,45.2980'
  },
  {
    id: 'bus-s14',
    ref: 'S14',
    name: 'Ligne S14 : Bourg-Saint-Maurice ↔ Tignes ↔ Val d\'Isère',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Bourg-Saint-Maurice ↔ Sainte-Foy ↔ Tignes (Les Brévières, Le Lac, Val Claret) ↔ Val d\'Isère',
    frequency: 'Toutes les heures en saison',
    period: 'Toute l\'année',
    stops: ['Bourg-Saint-Maurice Gare', 'Sainte-Foy Station', 'Tignes Les Boisses', 'Tignes Le Lac', 'Val d\'Isère Gare Routière'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.7700,45.6180;6.8830,45.5490;6.9150,45.4980;6.9770,45.4480'
  },
  {
    id: 'bus-s16',
    ref: 'S16',
    name: 'Ligne S16 : Bourg-Saint-Maurice ↔ Les Arcs',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Bourg-Saint-Maurice ↔ Arc 1600 ↔ Arc 1800 ↔ Arc 1950 ↔ Arc 2000',
    frequency: 'Nombreuses navettes en complément du funiculaire',
    period: 'Toute l\'année',
    stops: ['Bourg-Saint-Maurice Gare', 'Arc 1600', 'Arc 1800', 'Arc 1950', 'Arc 2000'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.7700,45.6180;6.8040,45.5780;6.8280,45.5640;6.8520,45.5730'
  },
  // ═════════════════════════════════════════════════════════════════════════
  // RÉSEAU OFFICIEL HAUTE MAURIENNE VANOISE (HMV - ÉTÉ 2026 & HIVER 2025-2026)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'hmv-s52-s53',
    ref: 'S52 / S53',
    name: 'Lignes S52-S53 : Modane ↔ Aussois ↔ Val Cenis ↔ Bessans ↔ Bonneval-sur-Arc',
    mode: 'bus',
    operator: 'Cars Région Savoie / Haute Maurienne Vanoise',
    network: 'Haute Maurienne Vanoise',
    route: 'Modane Gare Routière / SNCF ↔ Villarodin ↔ Aussois ↔ Bramans ↔ Sardières ↔ Sollières ↔ Termignon ↔ Lanslebourg ↔ Lanslevillard ↔ Bessans ↔ Bonneval-sur-Arc',
    frequency: 'Tous les jours en été & hiver (nombreux allers-retours, transport vélo sur porte-vélo 6 places)',
    period: 'Toute l\'année (Été 2026 : du 20 juin au 5 sept. / Hiver : du 13 déc. au 25 avril)',
    stops: [
      'Modane Gare routière (SNCF / TGV)',
      'Modane Ville',
      'Villarodin RD1006',
      'Le Bourget Rocher des Amoureux',
      'Aussois (La Buidonnière, Longecôte, Centre, Maison d\'Aussois OT)',
      'Bramans (Les Glières, Petit Paris, Lenfrey)',
      'Sardières Église',
      'Sollières Mairie / Les Favières',
      'Termignon Maison Vanoise (Porte du Parc)',
      'Val Cenis Lanslebourg (Églises, Auditorium, Pont du Folgoët, Les Champs)',
      'Val Cenis Lanslevillard (TC Vieux Moulin, Pont abribus OT, Val Cenis Le Haut)',
      'Bessans (Camping de l\'Illaz, Placette, Mairie, Hameau de la Neige, La Bessannaise, Le Villaron)',
      'Bonneval-sur-Arc Village',
      'Bonneval-sur-Arc Patinoire (1800 m)'
    ],
    color: '#f59e0b',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.6710,45.2020;6.6970,45.2150;6.7410,45.2310;6.7820,45.2280;6.8150,45.2790;6.8830,45.2850;6.9100,45.2950;6.9940,45.3210;7.0470,45.3710'
  },
  {
    id: 'hmv-ligne-1',
    ref: 'Ligne 1 HMV',
    name: 'Ligne 1 HMV : Orgère (Porte du Parc) ↔ Modane ↔ Valfréjus / La Norma',
    mode: 'navette',
    operator: 'Communauté de Communes Haute Maurienne Vanoise',
    network: 'Haute Maurienne Vanoise',
    route: 'Refuge-Porte de l\'Orgère (1935 m) ↔ Polset ↔ Saint-André ↔ Fourneaux ↔ Modane Gare Routière ↔ Valfréjus Office de Tourisme / La Norma',
    frequency: 'Tous les jours en été (1er juillet au 31 août, 4 à 5 départs/jour)',
    period: 'Été (1er juillet au 31 août 2026 - Accès cœur Parc national de la Vanoise & Refuge de l\'Orgère)',
    stops: [
      'Refuge-Porte de l\'Orgère (1935 m, Cœur de Parc, départ sentier nature & Tour des Glaciers)',
      'Polset (Hameau d\'alpage)',
      'Saint-André (Hameau du Col, Église / Parking aval)',
      'Fourneaux (Pont du Charmaix)',
      'Modane Gare Routière (Correspondance SNCF & Lignes S52/S53)',
      'Modane (Hôtel de Ville, Collège, Loutraz)',
      'Le Bourget (Rocher des Amoureux, Lot. St-Bernard, Mairie)',
      'Avrieux Centre (Sentier de l\'Eau, cascade Saint-Benoît)',
      'Villarodin Abribus',
      'La Norma Rond-point (Station de ski piétonne)',
      'Valfréjus Office de Tourisme (1550 m, départ Refuge du Thabor & Col de la Vallée Étroite)'
    ],
    color: '#db2777',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.6780,45.2280;6.6850,45.2180;6.6870,45.2080;6.6710,45.2020;6.6430,45.1740;6.6970,45.2150'
  },
  {
    id: 'hmv-ligne-2',
    ref: 'Ligne 2 HMV',
    name: 'Ligne 2 HMV : Val Cenis Bramans ↔ Termignon ↔ Bellecombe ↔ Entre-Deux-Eaux',
    mode: 'navette',
    operator: 'Parc National de la Vanoise / Haute Maurienne Vanoise',
    network: 'Haute Maurienne Vanoise',
    route: 'Bramans ↔ Sollières ↔ Termignon ↔ Le Coëtet ↔ Bellecombe (Parking) ↔ Plan du Lac (Refuge) ↔ Plume Fine ↔ Entre-Deux-Eaux (Refuge)',
    frequency: 'Tous les jours en été du 28 juin au 4 sept. (Jusqu\'à 11 rotations/jour, navette gratuite de Termignon à Bellecombe)',
    period: 'Été (Du 28 juin au 4 septembre 2026 - Accès Porte du Parc de Bellecombe 2307 m & Refuges)',
    stops: [
      'Bramans (Les Glières, Petit Paris, Lenfrey)',
      'Sollières (Les Favières)',
      'Termignon (Sherpa, Parking / Pied de pistes, Porte d\'entrée du Parc)',
      'Le Coëtet (1900 m)',
      'Bellecombe Parking (2307 m, Porte d\'entrée du Parc national de la Vanoise)',
      'Refuge du Plan du Lac (2385 m, vue panoramique Dent Parrachée & Grande Casse)',
      'Plume Fine (Vallon de la Leisse)',
      'Refuge d\'Entre-Deux-Eaux (2120 m, carrefour GR5, Tour des Glaciers de la Vanoise)'
    ],
    color: '#84cc16',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.7820,45.2280;6.8150,45.2790;6.8350,45.3010;6.8470,45.3220;6.8720,45.3340;6.8920,45.3480'
  },
  {
    id: 'hmv-ligne-3',
    ref: 'Ligne 3 HMV',
    name: 'Ligne 3 HMV : Oulietta ↔ Bonneval-sur-Arc ↔ Bessans ↔ Avérole',
    mode: 'navette',
    operator: 'Communauté de Communes Haute Maurienne Vanoise',
    network: 'Haute Maurienne Vanoise',
    route: 'Parking Pont de l\'Oulietta (2476 m) ↔ Bonneval-sur-Arc ↔ Bessans ↔ La Goulaz ↔ Parking des Vincendières ↔ Hameau d\'Avérole (Refuge)',
    frequency: 'Tous les jours sauf samedis du 1er juillet au 31 août (6 à 8 rotations/jour, correspondance S52/S53)',
    period: 'Été (Du 1er juillet au 31 août 2026 - Accès Sentier Balcon de l\'Iseran & Vallée d\'Avérole)',
    stops: [
      'Parking Pont de l\'Oulietta (2476 m, départ sentier Balcon de l\'Iseran vers le Carro)',
      'Bonneval-sur-Arc (Patinoire, Village classé)',
      'Bessans (Le Villaron, La Bessannaise biathlon, Hameau de la Neige, Mairie, Placette)',
      'La Goulaz',
      'Parking des Vincendières (1815 m, début de zone réglementée)',
      'Hameau d\'Avérole (2040 m, départ Refuge d\'Avérole, Pointe de Charbonnel, frontière Italie)'
    ],
    color: '#ef4444',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '7.0310,45.4170;7.0470,45.3710;6.9940,45.3210;7.0450,45.3090;7.0850,45.2950'
  },
  {
    id: 'hmv-ligne-4',
    ref: 'Ligne 4 HMV',
    name: 'Ligne 4 HMV : Bonneval-sur-Arc ↔ Hameau de L’Écot',
    mode: 'navette',
    operator: 'Communauté de Communes Haute Maurienne Vanoise',
    network: 'Haute Maurienne Vanoise',
    route: 'Bonneval-sur-Arc Patinoire ↔ Parking Pierre Fendue ↔ Hameau préservé de L’Écot (2020 m)',
    frequency: 'Tous les jours sauf samedis du 5 juillet au 28 août (9 allers-retours quotidiens)',
    period: 'Été (Du 5 juillet au 28 août 2026 - Accès Refuges des Évettes & du Carro)',
    stops: [
      'Bonneval-sur-Arc Patinoire (1800 m)',
      'Parking de la Pierre Fendue',
      'Hameau de L’Écot (2020 m, chapelle Sainte-Marguerite, départ sentier Refuge des Évettes & Refuge du Carro)'
    ],
    color: '#10b981',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '7.0470,45.3710;7.0780,45.3780;7.1080,45.3850'
  },
  {
    id: 'hmv-ligne-5',
    ref: 'Ligne 5 HMV',
    name: 'Ligne 5 Transalpine HMV : Val Cenis Lanslebourg ↔ Mont-Cenis ↔ Suse (Italie)',
    mode: 'bus',
    operator: 'Haute Maurienne Vanoise / Interreg Alcotra',
    network: 'Haute Maurienne Vanoise',
    route: 'Val Cenis Lanslebourg (Auditorium) ↔ Col du Mont-Cenis (2083 m) ↔ Lac du Mont-Cenis / Plan des Fontainettes ↔ Grand Croix ↔ Bar Cenisio ↔ Giaglione ↔ Susa Gare Routière / Trenitalia (Italie)',
    frequency: 'Samedis et dimanches jusqu\'au 27 septembre (3 allers-retours/jour, transport vélo gratuit sur réservation)',
    period: 'Été (Jusqu\'au 27 septembre 2026 - Liaison transfrontalière France-Italie)',
    stops: [
      'Val Cenis Lanslebourg (Auditorium)',
      'Col du Mont-Cenis (2083 m)',
      'Plan des Fontainettes (Pyramide, Jardin Botanique, Lac du Mont-Cenis)',
      'Parking Grand Croix / Hôtels',
      'Bar Cenisio (Italie)',
      'Giaglione (Italie)',
      'Suse Gare Routière / Stazione di Susa (Italie, correspondances ferroviaires SFM vers Turin)'
    ],
    color: '#0284c7',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.8830,45.2850;6.9010,45.2600;6.9380,45.2280;6.9630,45.2050;7.0090,45.1610;7.0510,45.1380'
  },
  {
    id: 'hmv-ligne-902',
    ref: 'Ligne 902',
    name: 'Ligne 902 Transalpine : Modane ↔ Bardonecchia (Italie)',
    mode: 'bus',
    operator: 'Bellando Tours / Région Auvergne-Rhône-Alpes',
    network: 'Liaison Transalpine HMV',
    route: 'Modane Gare Routière / Ferroviaire (SNCF) ↔ Tunnel du Fréjus ↔ Bardonecchia Gare ferroviaire / FS (Italie)',
    frequency: 'Lundi au samedi toute l\'année (7 allers-retours/jour, correspondance directe trains vers Turin Porta Nuova)',
    period: 'Toute l\'année (Été & Hiver, 3.40 € - 3.70 € l\'aller)',
    stops: [
      'Modane Gare ferroviaire / Routière (France)',
      'Tunnel du Fréjus',
      'Bardonecchia Gare ferroviaire (Italie, 7 correspondances directes en train quotidien vers Turin)'
    ],
    color: '#16a34a',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.6710,45.2020;6.6950,45.1680;6.7020,45.0760'
  },
  {
    id: 'hmv-hiver-s50',
    ref: 'S50 Hiver',
    name: 'Ligne S50 : Modane Gare ↔ Valfréjus',
    mode: 'bus',
    operator: 'Cars Région Savoie / HMV',
    network: 'Haute Maurienne Vanoise Hiver',
    route: 'Modane Gare routière ↔ Valfréjus Office de Tourisme (1550 m)',
    frequency: 'Circule tous les jours en hiver (renforcé le samedi, réservations Altibus)',
    period: 'Hiver (Du 20 décembre au 11 avril)',
    stops: [
      'Modane Gare routière (SNCF / TGV)',
      'Valfréjus Office de Tourisme (1550 m, pied des pistes & départ sentiers Thabor)'
    ],
    color: '#3b82f6',
    url: 'https://vente.cars-region-savoie.fr',
    coords: '6.6710,45.2020;6.6580,45.1850;6.6430,45.1740'
  },
  {
    id: 'hmv-hiver-s51',
    ref: 'S51 Hiver',
    name: 'Ligne S51 : Modane Gare ↔ La Norma',
    mode: 'bus',
    operator: 'Cars Région Savoie / HMV',
    network: 'Haute Maurienne Vanoise Hiver',
    route: 'Modane Gare routière ↔ La Norma Rond-point (Station piétonne)',
    frequency: 'Circule tous les jours en hiver (renforcé le samedi)',
    period: 'Hiver (Du 20 décembre au 11 avril)',
    stops: [
      'Modane Gare routière (SNCF / TGV)',
      'La Norma Rond-point (Station 1350 m)'
    ],
    color: '#ec4899',
    url: 'https://vente.cars-region-savoie.fr',
    coords: '6.6710,45.2020;6.6970,45.2080;6.6970,45.2150'
  },
  {
    id: 'hmv-hiver-b1-ambin',
    ref: 'Navette B1',
    name: 'Ligne B1 HMV Hiver : Val Cenis Bramans ↔ Val d’Ambin (Nordique & Ambin)',
    mode: 'navette',
    operator: 'Haute Maurienne Vanoise',
    network: 'Haute Maurienne Vanoise Hiver',
    route: 'Bramans (Rond-point Grands Prés, Mairie) ↔ Vallée du Val d’Ambin (Domaine Nordique, accès Refuge d’Ambin)',
    frequency: 'Gratuit, départs cadencés du dimanche au vendredi selon périodes',
    period: 'Hiver (Du 21 décembre au 15 mars - Accès domaine nordique & Refuge d\'Ambin)',
    stops: [
      'Bramans (Rond-point Grands Prés)',
      'Bramans (Parking Mairie / OT)',
      'Val d’Ambin (Domaine nordique & départ rando refuge d’Ambin)'
    ],
    color: '#06b6d4',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.7820,45.2280;6.8040,45.2030;6.8400,45.1820'
  },
  {
    id: 'hmv-hiver-f-norma-aussois',
    ref: 'Ligne F Hiver',
    name: 'Ligne F HMV Hiver : Aussois ↔ Le Bourget ↔ Avrieux ↔ Villarodin ↔ La Norma',
    mode: 'navette',
    operator: 'Haute Maurienne Vanoise / Région AURA',
    network: 'Haute Maurienne Vanoise Hiver',
    route: 'Aussois (Maison du Tourisme, Centre, Longecôte) ↔ Le Bourget ↔ Avrieux Centre ↔ Villarodin ↔ La Norma (Rond-point, Avenières)',
    frequency: 'Tous les jours en saison hivernale du 1er février au 10 avril (liaison inter-stations)',
    period: 'Hiver (Du 1er février au 10 avril)',
    stops: [
      'Aussois (Maison du Tourisme, Centre, Longecôte)',
      'Le Bourget (Lot. Saint-Bernard, Mairie)',
      'Avrieux Centre',
      'Villarodin Abribus',
      'La Norma (Rond-point, Parking des Avenières)'
    ],
    color: '#db2777',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.7410,45.2310;6.7110,45.2200;6.6970,45.2150;6.6970,45.2080'
  },
  {
    id: 'hmv-hiver-c-val-cenis',
    ref: 'Navettes C1/C2',
    name: 'Navette Interne Val Cenis : Termignon ↔ Lanslebourg ↔ Lanslevillard',
    mode: 'navette',
    operator: 'Haute Maurienne Vanoise',
    network: 'Haute Maurienne Vanoise Hiver',
    route: 'Termignon (École, Girarde) ↔ Lanslebourg (Auditorium, Églises, Ramasse) ↔ Lanslevillard (Vieux Moulin, Val Cenis Le Haut, Terres Grasses)',
    frequency: 'Gratuit, toutes les 20 à 30 minutes de 8h15 à 19h + soirées mardi/jeudi jusqu\'à 22h30',
    period: 'Hiver (Du 14 décembre au 17 avril - Ski-bus inter-villages et remontées mécaniques)',
    stops: [
      'Termignon (Pied de pistes Télésiège La Girarde)',
      'Lanslebourg (Office de Tourisme, Auditorium, Télésiège La Ramasse)',
      'Lanslebourg (Pont du Folgoët, Plan des Champs)',
      'Lanslevillard (Télécabine du Vieux Moulin, École de ski, Mairie)',
      'Lanslevillard (Télécabine Val Cenis le Haut, Terres Grasses)'
    ],
    color: '#0284c7',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.8150,45.2790;6.8830,45.2850;6.9100,45.2950;6.9320,45.3050'
  },
  {
    id: 'hmv-hiver-e2-bessans-bonneval',
    ref: 'Navette E2 Hiver',
    name: 'Navette E2 Hiver : Bessans ↔ Bonneval-sur-Arc',
    mode: 'navette',
    operator: 'Haute Maurienne Vanoise',
    network: 'Haute Maurienne Vanoise Hiver',
    route: 'Bessans (La Placette, Mairie, Hameau de la Neige, La Bessannaise, Le Villaron) ↔ Bonneval-sur-Arc (Patinoire, Lavoir village)',
    frequency: 'Gratuit, tous les jours sauf samedis du 21 déc. au 8 mars (4 rotations directes matin & soir)',
    period: 'Hiver (Du 21 décembre au 8 mars - Liaison nordique et alpine Bessans / Bonneval)',
    stops: [
      'Bessans (La Placette)',
      'Bessans (Mairie / La Poste)',
      'Bessans (Hameaux de la Neige)',
      'Bessans (La Bessannaise)',
      'Bessans (Le Villaron)',
      'Bonneval-sur-Arc (La Patinoire)',
      'Bonneval-sur-Arc (Lavoir village)'
    ],
    color: '#f59e0b',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '6.9940,45.3210;7.0150,45.3400;7.0470,45.3710'
  },
  {
    id: 'navette-pralognan-prioux',
    ref: 'Navette Vanoise',
    name: 'Navette Vanoise : Pralognan ↔ Les Prioux',
    mode: 'navette',
    operator: 'Parc National de la Vanoise',
    network: 'Navettes Vanoise',
    route: 'Pralognan-la-Vanoise ↔ Les Prioux (Accès cœur de Parc & Refuges)',
    frequency: 'Toutes les 30 min en saison estivale',
    period: 'Été (Juillet-Août)',
    stops: ['Pralognan Centre', 'Pont de Gerlon', 'Les Prioux (Départ refuges Félix Faure, Péclet-Polset, Roc de la Pêche)'],
    color: '#f59e0b',
    url: 'https://www.vanoise-parcnational.fr',
    coords: '6.7210,45.3800;6.7180,45.3520;6.7120,45.3340'
  },

  // ISÈRE & OISANS / BELLEDONNE / VERCORS
  {
    id: 'bus-t87',
    ref: 'T87',
    name: 'Ligne T87 : Grenoble ↔ Le Bourg-d\'Oisans ↔ Les Deux Alpes',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble ↔ Vizille ↔ Rochetaillée ↔ Le Bourg-d\'Oisans ↔ Les Deux Alpes',
    frequency: 'Plusieurs départs quotidiens',
    period: 'Toute l\'année',
    stops: ['Grenoble Gare Routière', 'Vizille', 'Rochetaillée', 'Le Bourg-d\'Oisans', 'Mont-de-Lans', 'Les Deux Alpes 1650'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.7720,45.0740;6.0280,45.0540;6.1260,45.0080'
  },
  {
    id: 'bus-t88',
    ref: 'T88',
    name: 'Ligne T88 : Grenoble ↔ Le Bourg-d\'Oisans ↔ L\'Alpe d\'Huez',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble ↔ Vizille ↔ Rochetaillée ↔ Le Bourg-d\'Oisans ↔ L\'Alpe d\'Huez (21 virages)',
    frequency: 'Liaisons régulières toute l\'année',
    period: 'Toute l\'année',
    stops: ['Grenoble Gare', 'Vizille', 'Le Bourg-d\'Oisans', 'Huez Village', 'L\'Alpe d\'Huez 1860'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.7720,45.0740;6.0280,45.0540;6.0710,45.0920'
  },
  {
    id: 'bus-t89',
    ref: 'T89',
    name: 'Ligne T89 : Le Bourg-d\'Oisans ↔ La Grave ↔ Col du Lautaret ↔ Briançon',
    mode: 'bus',
    operator: 'Cars Région / Région Sud',
    network: 'Liaison Transalpine',
    route: 'Le Bourg-d\'Oisans ↔ Barrage du Chambon ↔ La Grave ↔ Col du Lautaret ↔ Le Monêtier ↔ Briançon',
    frequency: 'Liaison quotidienne Isère - Hautes-Alpes',
    period: 'Toute l\'année',
    stops: ['Le Bourg-d\'Oisans', 'La Grave (Gare Téléphérique Meije)', 'Villar-d\'Arêne', 'Col du Lautaret 2058 m', 'Le Monêtier-les-Bains', 'Briançon Gare'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '6.0280,45.0540;6.3050,45.0450;6.3810,45.0340;6.4710,44.9360;6.6340,44.8980'
  },
  {
    id: 'bus-t83',
    ref: 'T83',
    name: 'Ligne T83 : Grenoble ↔ Uriage ↔ Chamrousse',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble ↔ Gières ↔ Uriage-les-Bains ↔ Chamrousse 1750',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Grenoble Gare', 'Gières Gare Universités', 'Uriage', 'Chamrousse 1650', 'Chamrousse 1750 Roche Béranger'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.8300,45.1430;5.8770,45.1110'
  },
  {
    id: 'bus-t84',
    ref: 'T84',
    name: 'Ligne T84 : Grenoble ↔ Villard-de-Lans (Vercors)',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble ↔ Sassenage ↔ Engins ↔ Lans-en-Vercors ↔ Villard-de-Lans',
    frequency: 'Toutes les heures',
    period: 'Toute l\'année',
    stops: ['Grenoble Gare', 'Sassenage', 'Engins', 'Lans-en-Vercors', 'Villard-de-Lans Gare Routière'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.5890,45.1270;5.5520,45.0720'
  },
  {
    id: 'navette-berarde',
    ref: 'Navette Oisans',
    name: 'Navette Estivale Le Bourg-d\'Oisans ↔ Saint-Christophe ↔ La Bérarde',
    mode: 'navette',
    operator: 'Oisans Tourisme',
    network: 'Navettes Écrins',
    route: 'Le Bourg-d\'Oisans ↔ Les Ougiers ↔ Saint-Christophe-en-Oisans ↔ Champhorent ↔ La Bérarde',
    frequency: 'Allers-retours quotidiens en saison estivale',
    period: 'Été (Accès haute montagne)',
    stops: ['Le Bourg-d\'Oisans', 'Saint-Christophe-en-Oisans', 'Champhorent (Départ refuge de la Lavey)', 'La Bérarde (Cœur des Écrins, refuges Promontoire, Châtelleret, Temple Écrins)'],
    color: '#f59e0b',
    url: 'https://www.oisans.com',
    coords: '6.0280,45.0540;6.0960,45.0060;6.1770,44.9570;6.2940,44.9330'
  },

  // HAUTES-ALPES (ÉCRINS, QUEYRAS, BRIANÇONNAIS, UBAYE)
  {
    id: 'bus-zou-55',
    ref: 'ZOU! 55',
    name: 'Ligne ZOU! 55 : Briançon ↔ Serre Chevalier ↔ Monêtier-les-Bains',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Briançon ↔ Chantemerle ↔ Villeneuve ↔ Le Monêtier-les-Bains',
    frequency: 'Toutes les 30 min (Liaison haute fréquence vallée de la Guisane)',
    period: 'Toute l\'année',
    stops: ['Briançon Gare SNCF', 'Chantemerle Téléphérique', 'Villeneuve Aravet', 'Le Monêtier-les-Bains Les Grands Bains'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.6340,44.8980;6.5860,44.9340;6.5440,44.9540;6.5080,44.9750'
  },
  {
    id: 'bus-zou-54',
    ref: 'ZOU! 54',
    name: 'Ligne ZOU! 54 : Briançon ↔ Montgenèvre ↔ Oulx TGV',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU! / Autocars Resalp',
    route: 'Briançon ↔ Montgenèvre (Col frontière) ↔ Clavière ↔ Oulx Gare TGV (Italie)',
    frequency: 'Correspondance avec les TGV Paris-Milan',
    period: 'Toute l\'année',
    stops: ['Briançon Gare', 'Montgenèvre Village (1860 m)', 'Clavière', 'Cesana Torinese', 'Oulx Gare TGV'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.6340,44.8980;6.7210,44.9310;6.7500,44.9380;6.8320,45.0340'
  },
  {
    id: 'bus-zou-57',
    ref: 'ZOU! 57',
    name: 'Ligne ZOU! 57 : Briançon ↔ Guillestre ↔ Queyras (Saint-Véran / Abriès)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Briançon ↔ L\'Argentière ↔ Montdauphin-Guillestre ↔ Château-Ville-Vieille ↔ Molines ↔ Saint-Véran',
    frequency: 'Quotidien (Dessert les plus hauts villages d\'Europe)',
    period: 'Toute l\'année',
    stops: ['Briançon Gare', 'L\'Argentière-la-Bessée', 'Montdauphin-Guillestre', 'Château-Queyras', 'Molines-en-Queyras', 'Saint-Véran (2042 m)'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.6340,44.8980;6.5590,44.7930;6.6490,44.6680;6.7900,44.7560;6.8640,44.7010'
  },
  {
    id: 'bus-zou-51',
    ref: 'ZOU! 51',
    name: 'Ligne ZOU! 51 : Gap ↔ Embrun ↔ Barcelonnette (Ubaye)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Gap ↔ Chorges ↔ Savines-le-Lac ↔ Le Lauzet-Ubaye ↔ Barcelonnette',
    frequency: 'Plusieurs allers-retours par jour',
    period: 'Toute l\'année',
    stops: ['Gap Gare Routière', 'Chorges', 'Savines-le-Lac (Lac de Serre-Ponçon)', 'Le Lauzet-Ubaye', 'Barcelonnette Place Aimé Gassier'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.0790,44.5630;6.2770,44.5450;6.3050,44.5260;6.4320,44.4300;6.6510,44.3860'
  },
  {
    id: 'bus-zou-52',
    ref: 'ZOU! 52',
    name: 'Ligne ZOU! 52 : Gap ↔ Saint-Bonnet ↔ Orcières-Merlette (Champsaur)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Gap ↔ Col Bayard ↔ Saint-Bonnet-en-Champsaur ↔ Pont-du-Fossé ↔ Orcières 1850',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Gap Gare', 'Saint-Bonnet', 'Pont-du-Fossé', 'Orcières Village', 'Orcières-Merlette 1850'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.0790,44.5630;6.0740,44.6810;6.2280,44.6710;6.3260,44.6940'
  },


  // ALPES-MARITIMES & MERCANTOUR
  {
    id: 'bus-zou-91',
    ref: 'ZOU! 91',
    name: 'Ligne ZOU! 91 : Nice ↔ Saint-Martin-Vésubie ↔ Le Boréon (Mercantour)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Nice Grand Arénas ↔ Plan-du-Var ↔ Lantosque ↔ Saint-Martin-Vésubie ↔ Le Boréon (1500 m)',
    frequency: 'Quotidien (Accès direct Parc National du Mercantour)',
    period: 'Toute l\'année (Prolongement Le Boréon en été)',
    stops: ['Nice Grand Arénas (Gare TGV & Tram)', 'Plan-du-Var', 'Lantosque', 'Saint-Martin-Vésubie Village', 'Le Boréon (Centre Alpha Loup, départ refuges Cougourde & Trecolpas)'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '7.2160,43.6680;7.2020,43.8600;7.3160,43.9740;7.4320,44.0680;7.2880,44.1180'
  },
  {
    id: 'bus-zou-92',
    ref: 'ZOU! 92',
    name: 'Ligne ZOU! 92 : Nice ↔ Saint-Sauveur-sur-Tinée ↔ Isola 2000',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Nice Grand Arénas ↔ La Courbaisse ↔ Saint-Sauveur-sur-Tinée ↔ Isola Village ↔ Isola 2000',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Nice Grand Arénas', 'Saint-Sauveur-sur-Tinée', 'Isola Village', 'Isola 2000 Station (Frontière italienne)'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '7.2160,43.6680;7.1060,43.9050;7.1070,44.0840;7.1560,44.1820'
  },

  // ═══════════════════════════════════════════════════════
  // NAVETTES MANQUANTES - HAUTES-ALPES (CLARÉE, QUEYRAS, UBAYE, VALGAUDEMAR)
  // ═══════════════════════════════════════════════════════
  {
    id: 'navette-claree',
    ref: 'Navette Clarée',
    name: 'Navette Vallée de la Clarée : Briançon ↔ Val-des-Prés ↔ Névache ↔ Fontcouverte (Refuge de la Fruitière)',
    mode: 'navette',
    operator: 'Communauté de Communes du Briançonnais',
    network: 'Navettes Clarée',
    route: 'Briançon Gare ↔ Val-des-Prés ↔ Plampinet ↔ Névache Village ↔ Ville Haute ↔ Hameau de Fontcouverte (Refuge de la Fruitière)',
    frequency: 'Navettes régulières en saison (toutes les heures environ, parking obligatoire Névache)',
    period: 'Été (Juin-Septembre, accès réglementé vallée de la Clarée)',
    stops: [
      'Briançon Gare SNCF',
      'Val-des-Prés',
      'Plampinet',
      'Névache Village (1600 m)',
      'Névache Ville Haute',
      'Pont du Rately (Départ Refuge de Buffère)',
      'Hameau de Fontcouverte (Auberge & Refuge de la Fruitière, Cascade de Fontcouverte)'
    ],
    color: '#f59e0b',
    url: 'https://www.nevache-tourisme.fr',
    coords: '6.6340,44.8980;6.6060,44.9350;6.5790,44.9490;6.5370,44.9720;6.5110,44.9830'
  },
  {
    id: 'navette-claree-haute',
    ref: 'Navette Haute Clarée',
    name: 'Navette Haute Clarée : Névache ↔ Fontcouverte (Refuge de la Fruitière) ↔ Laval ↔ Drayères',
    mode: 'navette',
    operator: 'Communauté de Communes du Briançonnais',
    network: 'Navettes Clarée',
    route: 'Névache Ville Haute ↔ Pont du Rately ↔ Fontcouverte (Auberge & Refuge de la Fruitière) ↔ Chalets de Laval ↔ Parking de Laval / Drayères',
    frequency: 'Navettes continues en été toutes les 20 à 30 min (Circulation interdite aux voitures)',
    period: 'Été (Juillet-Août, accès véhicules strictement interdit au-delà de Névache de 9h à 18h)',
    stops: [
      'Névache Ville Haute (1600 m, Parking obligatoire)',
      'Pont du Rately (Départ sentier & Refuge de Buffère 2076 m)',
      'Hameau de Fontcouverte (Auberge & Refuge de la Fruitière 1857 m, Cascade de Fontcouverte)',
      'Pont du Moutet (Départ sentier & Refuge du Chardonnet 2223 m)',
      'Chalets de Laval (Refuge de Laval 2010 m)',
      'Parking de Laval / Pont de la Clarée (Départ Refuge des Drayères 2180 m & Refuge de Ricou 2115 m, GR57)'
    ],
    color: '#f59e0b',
    url: 'https://www.nevache-tourisme.fr',
    coords: '6.5370,44.9720;6.5110,44.9830;6.4950,44.9920;6.4780,45.0050'
  },
  {
    id: 'navette-claree-buffere',
    ref: 'Navette Buffère',
    name: 'Navette Clarée - Pont du Rately : Névache ↔ Pont du Rately (Accès Refuge de Buffère)',
    mode: 'navette',
    operator: 'Communauté de Communes du Briançonnais',
    network: 'Navettes Clarée',
    route: 'Névache Ville Haute ↔ Pont du Rately (Départ sentier vers Refuge de Buffère 2076 m & Col de Buffère)',
    frequency: 'Navettes estivales régulières',
    period: 'Été (Juillet-Août)',
    stops: [
      'Névache Ville Haute',
      'Pont du Rately (1680 m, départ Refuge de Buffère, Lac Vert, GR57)'
    ],
    color: '#f59e0b',
    url: 'https://www.nevache-tourisme.fr',
    coords: '6.5370,44.9720;6.5210,44.9780'
  },
  {
    id: 'navette-vallee-etroite',
    ref: 'Navette Étroite',
    name: 'Navette Vallée Étroite : Névache ↔ Col de l\'Échelle ↔ Vallée Étroite',
    mode: 'navette',
    operator: 'Communauté de Communes du Briançonnais',
    network: 'Navettes Clarée',
    route: 'Névache ↔ Col de l\'Échelle (1762 m) ↔ Vallée Étroite (Granges de la Vallée Étroite, Refuges I Re Magi & Terzo Alpini)',
    frequency: 'Navettes estivales sur réservation',
    period: 'Été (Accès sentier des Lacs de Terre Rouge & Refuges italiens)',
    stops: ['Névache Village', 'Col de l\'Échelle (1762 m)', 'Vallée Étroite (Granges de la Vallée Étroite 1650 m, Refuges I Re Magi & Terzo Alpini)'],
    color: '#f59e0b',
    url: 'https://www.nevache-tourisme.fr',
    coords: '6.5370,44.9720;6.5660,45.0160;6.5920,45.0350'
  },
  {
    id: 'navette-queyras-est',
    ref: 'Navette Queyras',
    name: 'Navette Queyras : Château-Ville-Vieille ↔ Aiguilles ↔ Abriès ↔ Ristolas',
    mode: 'navette',
    operator: 'Communauté de Communes du Guillestrois-Queyras',
    network: 'Navettes du Queyras',
    route: 'Château-Queyras ↔ Aiguilles ↔ Abriès-Ristolas ↔ L\'Échalp ↔ La Monta (Départ sentiers vers Mont Viso)',
    frequency: 'Navettes régulières en été',
    period: 'Été (Accès Parc Naturel Régional du Queyras & Mont Viso)',
    stops: ['Château-Queyras Fort Vauban', 'Aiguilles (1470 m)', 'Abriès', 'Ristolas', 'L\'Échalp (Départ refuge Viso & Belvédère)', 'La Monta (1620 m)'],
    color: '#f59e0b',
    url: 'https://www.queyras-montagne.com',
    coords: '6.7900,44.7560;6.8710,44.7760;6.9250,44.7910;6.9520,44.7580'
  },
  {
    id: 'navette-valgaudemar',
    ref: 'Navette Valgaudemar',
    name: 'Navette du Valgaudemar : La Chapelle ↔ Le Casset ↔ Gioberney',
    mode: 'navette',
    operator: 'Communauté de Communes du Champsaur-Valgaudemar',
    network: 'Navettes Écrins',
    route: 'La Chapelle-en-Valgaudemar ↔ Les Portes ↔ Le Bourg ↔ Le Casset ↔ Le Clot ↔ Gioberney (1640 m)',
    frequency: 'Navettes quotidiennes en été (Accès cœur du Parc National des Écrins)',
    period: 'Été (Juin-Septembre, route étroite au-delà de La Chapelle)',
    stops: ['La Chapelle-en-Valgaudemar Mairie', 'Les Portes', 'Le Bourg', 'Le Casset', 'Le Clot', 'Gioberney (Refuge du Xavier Blanc, refuge de Vallonpierre, cascade du Voile de la Mariée)'],
    color: '#f59e0b',
    url: 'https://www.champsaur-valgaudemar.com',
    coords: '6.1740,44.8190;6.1950,44.8050;6.2290,44.7840;6.2750,44.7680'
  },
  {
    id: 'navette-champsaur-prapic',
    ref: 'Navette Prapic',
    name: 'Navette Champsaur : Orcières ↔ Prapic (Village de marmottes)',
    mode: 'navette',
    operator: 'Communauté de Communes du Champsaur-Valgaudemar',
    network: 'Navettes Écrins',
    route: 'Orcières Village ↔ Prapic (1530 m, village sans voiture)',
    frequency: 'Navettes en été (Village classé fermé aux véhicules)',
    period: 'Été (Juillet-Août)',
    stops: ['Orcières Village (1440 m)', 'Prapic Village (1530 m, sentier des marmottes & départ GR54)'],
    color: '#f59e0b',
    url: 'https://www.orcieres.com',
    coords: '6.3260,44.6940;6.2800,44.6660'
  },
  {
    id: 'navette-haute-ubaye',
    ref: 'Navette Ubaye',
    name: 'Navette Haute Ubaye : Barcelonnette ↔ Saint-Paul ↔ Maljasset / Fouillouse',
    mode: 'navette',
    operator: 'Communauté de Communes Vallée de l\'Ubaye Serre-Ponçon',
    network: 'Navettes Haute Ubaye',
    route: 'Barcelonnette ↔ Jausiers ↔ Saint-Paul-sur-Ubaye ↔ Maljasset (1903 m) / Fouillouse (1907 m)',
    frequency: 'Navettes estivales 2-3 allers-retours par jour',
    period: 'Été (Accès refuges & sentiers GR5/GR56 vers le Mercantour)',
    stops: ['Barcelonnette Place Aimé Gassier', 'Jausiers', 'Saint-Paul-sur-Ubaye', 'Maljasset (1903 m, départ Cols de Mary & Girardin)', 'Fouillouse (1907 m, départ refuges du Chambeyron)'],
    color: '#f59e0b',
    url: 'https://www.ubaye.com',
    coords: '6.6510,44.3860;6.7320,44.4200;6.7810,44.4650;6.8500,44.4780'
  },
  {
    id: 'bus-zou-35',
    ref: 'ZOU! 35',
    name: 'Ligne ZOU! 35 : Sisteron ↔ Gap (Vallée de la Durance)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Sisteron ↔ Laragne-Montéglin ↔ Serres ↔ Veynes ↔ Gap',
    frequency: 'Plusieurs allers-retours quotidiens',
    period: 'Toute l\'année',
    stops: ['Sisteron Gare Routière', 'Laragne-Montéglin', 'Serres', 'Veynes', 'Gap Gare Routière'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '5.9440,44.1940;5.8220,44.3110;5.7120,44.3740;5.8230,44.5330;6.0790,44.5630'
  },

  // ═══════════════════════════════════════════════════════
  // NAVETTES MANQUANTES - SAVOIE (VANOISE, BEAUFORTAIN, ROSIÈRE)
  // ═══════════════════════════════════════════════════════
  {
    id: 'bus-s15',
    ref: 'S15',
    name: 'Ligne S15 : Bourg-Saint-Maurice ↔ Séez ↔ La Rosière ↔ Col du Petit Saint-Bernard',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Bourg-Saint-Maurice ↔ Séez ↔ La Rosière 1850 ↔ Col du Petit Saint-Bernard (2188 m, frontière italienne)',
    frequency: 'Quotidien',
    period: 'Toute l\'année (Col fermé en hiver)',
    stops: ['Bourg-Saint-Maurice Gare', 'Séez', 'La Rosière 1850 Village', 'Col du Petit Saint-Bernard (2188 m)'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.7700,45.6180;6.8080,45.6320;6.8500,45.6290;6.8840,45.6790'
  },
  {
    id: 'bus-s20',
    ref: 'S20',
    name: 'Ligne S20 : Albertville ↔ Beaufort ↔ Cormet de Roselend',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Albertville ↔ Villard-sur-Doron ↔ Beaufort-sur-Doron ↔ Lac de Roselend ↔ Cormet de Roselend (1968 m)',
    frequency: 'Liaison quotidienne (Renfort estival pour le Cormet)',
    period: 'Toute l\'année (Route du Cormet ouverte en été uniquement)',
    stops: ['Albertville Gare', 'Villard-sur-Doron', 'Beaufort-sur-Doron (fromage Beaufort)', 'Barrage de Roselend', 'Cormet de Roselend (1968 m, départ sentiers vers Chapieux & refuge de la Croix du Bonhomme)'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.3927,45.6756;6.4340,45.6660;6.5710,45.7200;6.6580,45.6870'
  },
  {
    id: 'navette-contamines',
    ref: 'Navette Contamines',
    name: 'Navette Les Contamines-Montjoie ↔ Notre-Dame de la Gorge',
    mode: 'navette',
    operator: 'Mairie des Contamines-Montjoie',
    network: 'Navettes Mont-Blanc',
    route: 'Les Contamines-Montjoie Village ↔ Parking du Pontet ↔ Notre-Dame de la Gorge (1210 m)',
    frequency: 'Toutes les 30 min en saison (Parking obligatoire au Pontet)',
    period: 'Été (Juillet-Août, accès direct Tour du Mont-Blanc & refuge Nant Borrant)',
    stops: ['Les Contamines-Montjoie Office de Tourisme', 'Parking du Pontet', 'Notre-Dame de la Gorge (1210 m, départ TMB, refuges Nant Borrant & Balme)'],
    color: '#f59e0b',
    url: 'https://www.lescontamines.com',
    coords: '6.7270,45.8190;6.7200,45.8010;6.7130,45.7870'
  },
  {
    id: 'navette-peisey-rosuel',
    ref: 'Navette Rosuel',
    name: 'Navette Peisey-Nancroix ↔ Rosuel (Porte du Parc National de la Vanoise)',
    mode: 'navette',
    operator: 'Mairie de Peisey-Nancroix',
    network: 'Navettes Vanoise',
    route: 'Peisey-Nancroix Village ↔ Parking Rosuel ↔ Porte de Rosuel (1560 m)',
    frequency: 'Navettes régulières en été',
    period: 'Été (Accès direct cœur Vanoise, refuge du Col du Palet, refuge d\'Entre le Lac)',
    stops: ['Peisey-Nancroix Centre (1350 m)', 'Parking de Rosuel', 'Porte de Rosuel (1560 m, Maison du Parc, départ sentiers Vanoise)'],
    color: '#f59e0b',
    url: 'https://www.peisey-vallandry.com',
    coords: '6.7570,45.5400;6.7780,45.5120;6.8010,45.4920'
  },
  {
    id: 'navette-champagny-laisonnay',
    ref: 'Navette Champagny',
    name: 'Navette Champagny-en-Vanoise ↔ Le Laisonnay d\'en Bas',
    mode: 'navette',
    operator: 'Mairie de Champagny-en-Vanoise',
    network: 'Navettes Vanoise',
    route: 'Champagny-le-Haut ↔ Le Laisonnay d\'en Bas (1570 m)',
    frequency: 'Navettes estivales',
    period: 'Été (Accès direct refuge de la Glière & cirque de Champagny)',
    stops: ['Champagny-le-Haut', 'Le Laisonnay d\'en Bas (1570 m, refuge de la Glière & accès Col de la Vanoise)'],
    color: '#f59e0b',
    url: 'https://www.champagny.com',
    coords: '6.7080,45.4280;6.7110,45.3970'
  },
  // (Ancienne navette Termignon-Bellecombe remplacée par Ligne 2 HMV officielle)
  {
    id: 'bus-s50',
    ref: 'S50',
    name: 'Ligne S50 : Chambéry ↔ Saint-Jean-de-Maurienne',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Chambéry ↔ Montmélian ↔ Aiguebelle ↔ La Chambre ↔ Saint-Jean-de-Maurienne',
    frequency: 'Plusieurs liaisons par jour',
    period: 'Toute l\'année',
    stops: ['Chambéry Gare', 'Montmélian', 'Aiguebelle', 'La Chambre', 'Saint-Jean-de-Maurienne Gare'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '5.9200,45.5714;6.0580,45.5060;6.1740,45.3520;6.3440,45.2760'
  },
  {
    id: 'bus-s51',
    ref: 'S51',
    name: 'Ligne S51 : Saint-Jean-de-Maurienne ↔ Saint-Sorlin-d\'Arves ↔ Les Sybelles',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Saint-Jean-de-Maurienne ↔ Saint-Sorlin-d\'Arves ↔ Le Corbier ↔ La Toussuire (Les Sybelles)',
    frequency: 'Quotidien',
    period: 'Toute l\'année (Renfort saisonnier)',
    stops: ['Saint-Jean-de-Maurienne Gare', 'Villarembert', 'Le Corbier', 'La Toussuire', 'Saint-Sorlin-d\'Arves Village (1550 m)'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.3440,45.2760;6.2420,45.2360;6.2230,45.2110;6.2290,45.2270'
  },

  // ═══════════════════════════════════════════════════════
  // NAVETTES MANQUANTES - HAUTE-SAVOIE (CONTAMINES, MORZINE, VALLORCINE)
  // ═══════════════════════════════════════════════════════
  {
    id: 'bus-y71',
    ref: 'Y71',
    name: 'Ligne Y71 : Thonon-les-Bains ↔ Morzine ↔ Avoriaz',
    mode: 'bus',
    operator: 'Cars Région Haute-Savoie',
    network: 'Cars Région',
    route: 'Thonon-les-Bains ↔ Bioge ↔ Saint-Jean-d\'Aulps ↔ Morzine ↔ Avoriaz (1800 m)',
    frequency: 'Plusieurs allers-retours quotidiens',
    period: 'Toute l\'année',
    stops: ['Thonon-les-Bains Gare Routière', 'Bioge', 'Saint-Jean-d\'Aulps', 'Morzine Office de Tourisme', 'Avoriaz Station (1800 m)'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.4770,46.3720;6.5810,46.2430;6.7060,46.1770;6.7720,46.1810;6.7740,46.1940'
  },
  {
    id: 'bus-y72',
    ref: 'Y72',
    name: 'Ligne Y72 : Cluses ↔ Taninges ↔ Les Gets ↔ Morzine',
    mode: 'bus',
    operator: 'Cars Région Haute-Savoie',
    network: 'Cars Région',
    route: 'Cluses ↔ Châtillon-sur-Cluses ↔ Taninges ↔ Les Gets ↔ Morzine',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Cluses Gare', 'Châtillon-sur-Cluses', 'Taninges Centre', 'Les Gets Village (1172 m)', 'Morzine Office de Tourisme'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.5790,46.0601;6.5790,46.0870;6.5910,46.1080;6.6690,46.1540;6.7060,46.1770'
  },
  {
    id: 'bus-y91',
    ref: 'Y91',
    name: 'Ligne Y91 : Annecy ↔ Talloires ↔ Col de la Forclaz (Parapente)',
    mode: 'bus',
    operator: 'Cars Région Haute-Savoie',
    network: 'Cars Région',
    route: 'Annecy ↔ Veyrier-du-Lac ↔ Menthon-Saint-Bernard ↔ Talloires ↔ Col de la Forclaz',
    frequency: 'Quotidien',
    period: 'Toute l\'année (Accès site de parapente emblématique)',
    stops: ['Annecy Gare', 'Veyrier-du-Lac', 'Menthon-Saint-Bernard (Château)', 'Talloires-Montmin', 'Col de la Forclaz (1150 m, envol parapente)'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.1296,45.8992;6.1630,45.8780;6.1930,45.8580;6.2090,45.8420;6.2150,45.8240'
  },
  {
    id: 'navette-sat-courmayeur',
    ref: 'SAT Courmayeur',
    name: 'Liaison SAT Chamonix ↔ Courmayeur (Tunnel du Mont-Blanc)',
    mode: 'bus',
    operator: 'SAT Autocars',
    network: 'Liaison Transalpine',
    route: 'Chamonix-Mont-Blanc ↔ Tunnel du Mont-Blanc ↔ Entrèves ↔ Courmayeur (Italie)',
    frequency: 'Plusieurs départs quotidiens (Correspondance TMB & Tour du Mont-Blanc)',
    period: 'Toute l\'année (Liaison internationale France-Italie)',
    stops: ['Chamonix Gare Routière', 'Entrèves (Départ Skyway Monte Bianco)', 'Courmayeur Centre'],
    color: '#10b981',
    url: 'https://www.sat-montblanc.com',
    coords: '6.8694,45.9237;6.9810,45.8280;6.9700,45.7950'
  },

  // ═══════════════════════════════════════════════════════
  // NAVETTES MANQUANTES - ISÈRE (VERCORS, CHARTREUSE, BELLEDONNE)
  // ═══════════════════════════════════════════════════════
  {
    id: 'bus-t85',
    ref: 'T85',
    name: 'Ligne T85 : Grenoble ↔ Autrans-Méaudre (Vercors Nord)',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble ↔ Sassenage ↔ Autrans ↔ Méaudre (Plateau du Vercors)',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Grenoble Gare', 'Sassenage', 'Autrans Centre (1050 m)', 'Méaudre Village (1012 m)'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.6610,45.1960;5.5440,45.1730;5.5270,45.1310'
  },
  {
    id: 'bus-t86',
    ref: 'T86',
    name: 'Ligne T86 : Grenoble ↔ Corrençon-en-Vercors (Hauts Plateaux)',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble ↔ Villard-de-Lans ↔ Corrençon-en-Vercors (Accès Réserve Naturelle des Hauts Plateaux)',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Grenoble Gare', 'Villard-de-Lans', 'Corrençon-en-Vercors (1111 m, porte de la Réserve Naturelle & GR91)'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.5520,45.0720;5.5190,45.0310'
  },
  {
    id: 'bus-chartreuse',
    ref: 'T68',
    name: 'Ligne T68 : Grenoble ↔ Saint-Pierre-de-Chartreuse (Chartreuse)',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble ↔ Saint-Laurent-du-Pont ↔ Saint-Pierre-de-Chartreuse ↔ Col de Porte',
    frequency: 'Quotidien',
    period: 'Toute l\'année (Accès Massif de la Chartreuse & sentiers vers Chamechaude)',
    stops: ['Grenoble Gare', 'Saint-Laurent-du-Pont', 'Saint-Pierre-de-Chartreuse (880 m)', 'Col de Porte (1326 m, pistes de ski)'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.7330,45.3800;5.8150,45.3420;5.7650,45.2860'
  },
  {
    id: 'bus-t61',
    ref: 'T61',
    name: 'Ligne T61 : Grenoble ↔ Alpe du Grand Serre (Matheysine)',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble ↔ Vif ↔ La Mure ↔ Pierre-Châtel ↔ Alpe du Grand Serre',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Grenoble Gare', 'Vif', 'La Mure', 'Pierre-Châtel', 'Alpe du Grand Serre (1367 m)'],
    color: '#10b981',
    url: 'https://www.carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.6710,45.0610;5.7840,44.9020;5.8490,44.9480'
  },

  // ═══════════════════════════════════════════════════════
  // NAVETTES MANQUANTES - ALPES-MARITIMES & MERCANTOUR
  // ═══════════════════════════════════════════════════════
  {
    id: 'navette-madone-fenestre',
    ref: 'Navette Fenestre',
    name: 'Navette Madone de Fenestre : Saint-Martin-Vésubie ↔ Sanctuaire de la Madone (1903 m)',
    mode: 'navette',
    operator: 'Communauté de Communes Vésubie-Mercantour',
    network: 'Navettes Mercantour',
    route: 'Saint-Martin-Vésubie ↔ Camp d\'Argent ↔ Sanctuaire de la Madone de Fenestre (1903 m)',
    frequency: 'Navettes estivales quotidiennes',
    period: 'Été (Accès direct cœur du Mercantour, refuges de Nice & Fenestre)',
    stops: ['Saint-Martin-Vésubie Village', 'Camp d\'Argent', 'Madone de Fenestre (1903 m, refuge de Nice & départ Pas de l\'Arpette)'],
    color: '#f59e0b',
    url: 'https://www.vesubie-mercantour.com',
    coords: '7.2560,44.0680;7.3360,44.0880;7.3550,44.0980'
  },
  {
    id: 'navette-merveilles',
    ref: 'Navette Merveilles',
    name: 'Navette Vallée des Merveilles : Saint-Dalmas-de-Tende ↔ Lac des Mesches',
    mode: 'navette',
    operator: 'Parc National du Mercantour',
    network: 'Navettes Mercantour',
    route: 'Saint-Dalmas-de-Tende ↔ Castérino ↔ Lac des Mesches (1390 m)',
    frequency: 'Navettes estivales (Accès réglementé Vallée des Merveilles)',
    period: 'Été (Juin-Septembre, accès aux 40 000 gravures rupestres)',
    stops: ['Saint-Dalmas-de-Tende Gare SNCF', 'Castérino (1550 m)', 'Lac des Mesches (1390 m, départ refuge des Merveilles & refuge de Fontanalbe)'],
    color: '#f59e0b',
    url: 'https://www.mercantour-parcnational.fr',
    coords: '7.5950,44.0520;7.5550,44.0800;7.5340,44.0870'
  },
  {
    id: 'navette-haute-tinee',
    ref: 'Navette Tinée',
    name: 'Navette Haute Tinée : Saint-Étienne-de-Tinée ↔ Auron ↔ Col de la Bonette (2715 m)',
    mode: 'navette',
    operator: 'Communauté de Communes de la Tinée',
    network: 'Navettes Mercantour',
    route: 'Saint-Étienne-de-Tinée ↔ Auron ↔ Bousiéyas ↔ Camp des Fourches ↔ Col de la Bonette (2715 m)',
    frequency: 'Navettes estivales (Plus haute route d\'Europe)',
    period: 'Été (Route de la Bonette ouverte Juin-Octobre)',
    stops: ['Saint-Étienne-de-Tinée (1144 m)', 'Auron Station (1600 m)', 'Bousiéyas (1896 m)', 'Camp des Fourches (2260 m)', 'Col de la Bonette (2715 m, plus haute route goudronnée d\'Europe)'],
    color: '#f59e0b',
    url: 'https://www.auron.com',
    coords: '6.9270,44.2580;6.9350,44.2290;6.9340,44.2720;6.9660,44.3260'
  },
  {
    id: 'bus-zou-93',
    ref: 'ZOU! 93',
    name: 'Ligne ZOU! 93 : Nice ↔ Valdeblore ↔ Saint-Sauveur-sur-Tinée',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Nice ↔ Plan-du-Var ↔ Villars-sur-Var ↔ Valdeblore (La Colmiane 1500 m) ↔ Saint-Sauveur-sur-Tinée',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Nice Grand Arénas', 'Plan-du-Var', 'Villars-sur-Var', 'Valdeblore / La Colmiane (1500 m)', 'Saint-Sauveur-sur-Tinée'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '7.2160,43.6680;7.1680,43.8500;7.0900,43.9400;7.0580,44.0620;7.1060,43.9050'
  },

  // ═══════════════════════════════════════════════════════
  // NAVETTES MANQUANTES - ALPES-DE-HAUTE-PROVENCE (LAC D'ALLOS, DÉVOLUY)
  // ═══════════════════════════════════════════════════════
  {
    id: 'navette-lac-allos',
    ref: 'Navette Allos',
    name: 'Navette Lac d\'Allos : Allos Village ↔ Parking Laus ↔ Lac d\'Allos (2228 m)',
    mode: 'navette',
    operator: 'Mairie d\'Allos',
    network: 'Navettes Mercantour',
    route: 'Allos Village ↔ Parking du Laus ↔ Lac d\'Allos (2228 m, plus grand lac naturel d\'altitude d\'Europe)',
    frequency: 'Navettes continues en été (parking obligatoire)',
    period: 'Été (Juin-Septembre)',
    stops: ['Allos Village (1425 m)', 'Parking du Laus', 'Lac d\'Allos (2228 m, accès Refuge du Lac d\'Allos & sentier du Tour du Lac)'],
    color: '#f59e0b',
    url: 'https://www.valdallos.com',
    coords: '6.6260,44.2370;6.6940,44.2310;6.7150,44.2300'
  },
  {
    id: 'bus-zou-devoluy',
    ref: 'ZOU! Dévoluy',
    name: 'Ligne ZOU! : Gap ↔ Col du Festre ↔ Superdévoluy ↔ La Joue du Loup',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Gap ↔ Col du Festre (1441 m) ↔ Saint-Étienne-en-Dévoluy ↔ Superdévoluy ↔ La Joue du Loup',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Gap Gare Routière', 'Col du Festre (1441 m)', 'Saint-Étienne-en-Dévoluy', 'Superdévoluy (1500 m)', 'La Joue du Loup (1450 m)'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.0790,44.5630;5.8810,44.6760;5.9140,44.6640;5.9290,44.6490'
  },
  {
    id: 'bus-zou-digne',
    ref: 'ZOU! Digne',
    name: 'Ligne ZOU! : Digne-les-Bains ↔ Barcelonnette (Alpes-de-Haute-Provence)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Digne-les-Bains ↔ Seyne-les-Alpes ↔ Le Lauzet-Ubaye ↔ Barcelonnette',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Digne-les-Bains Gare', 'Seyne-les-Alpes (1270 m)', 'Le Lauzet-Ubaye', 'Barcelonnette Place Aimé Gassier'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.2350,44.0930;6.3550,44.3490;6.4320,44.4300;6.6510,44.3860'
  },

  // ═══════════════════════════════════════════════════════
  // NAVETTES COMPLÉMENTAIRES DES GRANDS COLS & VALLÉES ALPINES
  // ═══════════════════════════════════════════════════════
  {
    id: 'navette-granon',
    ref: 'Navette Granon',
    name: 'Navette Col du Granon : Briançon ↔ Chantemerle ↔ Col du Granon (2404 m)',
    mode: 'navette',
    operator: 'Communauté de Communes du Briançonnais',
    network: 'Navettes Serre Chevalier',
    route: 'Briançon ↔ Chantemerle (Saint-Chaffrey) ↔ Col du Granon (2404 m)',
    frequency: 'Navettes estivales régulières',
    period: 'Été (Juillet-Août, panorama spectaculaire sur les Glaciers des Écrins)',
    stops: ['Briançon Champ de Mars', 'Chantemerle Téléphérique', 'Col du Granon (2404 m, départ sentiers vers Crête de Cibouit & Grand Aréa)'],
    color: '#f59e0b',
    url: 'https://www.serre-chevalier.com',
    coords: '6.6340,44.8980;6.5860,44.9350;6.5510,44.9810'
  },
  {
    id: 'navette-galibier-lautaret',
    ref: 'Navette Galibier',
    name: 'Navette Col du Lautaret & Galibier : Briançon ↔ Le Monêtier ↔ Col du Galibier (2642 m)',
    mode: 'navette',
    operator: 'Région Provence-Alpes-Côte d\'Azur / Linkbus',
    network: 'Navettes des Cols Alpins',
    route: 'Briançon Gare ↔ Chantemerle ↔ Villeneuve ↔ Le Monêtier-les-Bains ↔ Col du Lautaret (2058 m) ↔ Col du Galibier (2642 m)',
    frequency: 'Navettes quotidiennes en été',
    period: 'Été (Juin-Septembre, ouverture des grands cols du Tour de France)',
    stops: ['Briançon Gare', 'Le Monêtier-les-Bains (Grands Bains thermaux)', 'Col du Lautaret (2058 m, Jardin Botanique Alpin & départ sentier des crevasses)', 'Col du Galibier (2642 m, monument Henri Desgrange)'],
    color: '#f59e0b',
    url: 'https://www.hautes-alpes.net',
    coords: '6.6340,44.8980;6.5080,44.9750;6.4060,45.0340;6.4070,45.0640'
  },
  {
    id: 'navette-queyras-saint-veran',
    ref: 'Navette Saint-Véran',
    name: 'Navette Queyras : Guillestre ↔ Molines ↔ Saint-Véran ↔ Col Agnel (2744 m)',
    mode: 'navette',
    operator: 'Communauté de Communes du Guillestrois-Queyras',
    network: 'Navettes du Queyras',
    route: 'Guillestre Gare / Ville ↔ Ville-Vieille ↔ Molines-en-Queyras ↔ Saint-Véran (2040 m) ↔ Refuge Agnel ↔ Col Agnel (2744 m, frontière Italie)',
    frequency: 'Navettes estivales régulières',
    period: 'Été (Accès plus haute commune habitée d\'Europe & Col Agnel)',
    stops: ['Guillestre Gare Routière', 'Château-Queyras', 'Molines-en-Queyras', 'Saint-Véran (2040 m, Musée du Soum & cadran solaire)', 'Refuge Agnel (2580 m)', 'Col Agnel (2744 m, 2e plus haut col routier des Alpes)'],
    color: '#f59e0b',
    url: 'https://www.queyras-montagne.com',
    coords: '6.6490,44.6680;6.7900,44.7560;6.8400,44.7310;6.8680,44.7000;6.9800,44.6930;6.9930,44.6860'
  },
  {
    id: 'navette-queyras-ceillac',
    ref: 'Navette Ceillac',
    name: 'Navette Queyras : Montdauphin-Guillestre ↔ Ceillac (Mélézet)',
    mode: 'navette',
    operator: 'Communauté de Communes du Guillestrois-Queyras',
    network: 'Navettes du Queyras',
    route: 'Montdauphin-Guillestre Gare SNCF ↔ Gorges du Cristillan ↔ Ceillac Village (1640 m) ↔ Chaurionde / Mélézet',
    frequency: 'Quotidien été & hiver',
    period: 'Toute l\'année (Accès Lac Miroir, Lac Sainte-Anne & Tête de Jacquette)',
    stops: ['Montdauphin-Guillestre Gare', 'Guillestre Centre', 'Ceillac Église Sainte-Cécile (1640 m)', 'Le Mélézet (Cascade de la Pisse, départ GR58 Tour du Queyras)'],
    color: '#f59e0b',
    url: 'https://www.queyras-montagne.com',
    coords: '6.6490,44.6680;6.6500,44.6600;6.7770,44.6670;6.7990,44.6540'
  },
  {
    id: 'navette-queyras-izoard',
    ref: 'Navette Izoard',
    name: 'Navette Col d\'Izoard : Guillestre ↔ Arvieux ↔ Casse Déserte ↔ Col d\'Izoard (2360 m)',
    mode: 'navette',
    operator: 'Communauté de Communes du Guillestrois-Queyras',
    network: 'Navettes du Queyras',
    route: 'Guillestre ↔ Château-Queyras ↔ Arvieux ↔ Brunissard ↔ Casse Déserte ↔ Col d\'Izoard (2360 m)',
    frequency: 'Navettes estivales régulières',
    period: 'Été (Juin-Septembre, col mythique des Alpes)',
    stops: ['Guillestre', 'Château-Queyras', 'Arvieux (1540 m)', 'Brunissard', 'Casse Déserte (Paysage lunaire d\'éboulis)', 'Col d\'Izoard (2360 m, refuge Napoléon & obélisque)'],
    color: '#f59e0b',
    url: 'https://www.queyras-montagne.com',
    coords: '6.6490,44.6680;6.7900,44.7560;6.7380,44.7670;6.7410,44.7950;6.7350,44.8200'
  },
  {
    id: 'ligne-1-pays-des-ecrins',
    ref: 'Ligne 1 Écrins',
    name: 'Ligne 1 Pays des Écrins : Vallouise-Pelvoux ↔ L\'Argentière-La Bessée (Toute l\'année)',
    mode: 'navette',
    operator: 'Communauté de Communes du Pays des Écrins',
    network: 'Transports du Pays des Écrins',
    route: 'Vallouise-Pelvoux (École St-Antoine) ↔ Le Fangeas ↔ Le Sarret ↔ Le Poët ↔ Vallouise Centre ↔ La Casse ↔ Les Vigneaux (Le Rif, La Bâtie) ↔ L\'Argentière-La Bessée Gare',
    frequency: '7 allers-retours par jour du lundi au samedi (Gratuit et ouvert à tous)',
    period: 'Toute l\'année (Horaires officiels 2025)',
    stops: [
      'Vallouise-Pelvoux (École St-Antoine)',
      'Le Fangeas',
      'Le Sarret',
      'Le Poët',
      'Vallouise Centre (Maison du Parc des Écrins)',
      'La Casse Commerces',
      'Pieds de Parcher',
      'Les Vigneaux (Le Rif)',
      'Les Vigneaux (La Bâtie)',
      'L\'Argentière-La Bessée (Av. de Vallouise)',
      'L\'Argentière (Le Kiosque)',
      'L\'Argentière (Place R. Demaison)',
      'L\'Argentière-La Bessée Gare SNCF'
    ],
    color: '#ec4899',
    url: 'https://www.cc-paysdesecrins.fr',
    coords: '6.4710,44.8640;6.4790,44.8580;6.4840,44.8520;6.4880,44.8460;6.4950,44.8420;6.5410,44.8240;6.5590,44.7930'
  },
  {
    id: 'ligne-interne-argentiere',
    ref: 'Navette Interne L\'Argentière',
    name: 'Navette Interne L\'Argentière-La Bessée : Gare ↔ Plan Léothaud ↔ Maison Blanche',
    mode: 'navette',
    operator: 'Communauté de Communes du Pays des Écrins',
    network: 'Transports du Pays des Écrins',
    route: 'Plan Léothaud ↔ La Magdeleine ↔ Le Quartz Piscine ↔ ZA Les Sablonnières ↔ La Gare SNCF ↔ Place Demaison ↔ Le Kiosque ↔ Maison Blanche',
    frequency: 'Liaisons régulières du lundi au samedi (Gratuit)',
    period: 'Toute l\'année',
    stops: [
      'Plan Léothaud',
      'La Magdeleine',
      'Le Quartz Piscine',
      'ZA Les Sablonnières',
      'L\'Argentière Gare SNCF',
      'Place R. Demaison',
      'Le Kiosque',
      'Avenue de Vallouise',
      'Maison Blanche / Collège'
    ],
    color: '#06b6d4',
    url: 'https://www.cc-paysdesecrins.fr',
    coords: '6.5510,44.7790;6.5550,44.7860;6.5590,44.7930;6.5620,44.7980;6.5650,44.8030'
  },
  {
    id: 'navette-iseran-bonneval',
    ref: 'Navette Iseran',
    name: 'Navette Transalpine Col de l\'Iseran : Bonneval-sur-Arc ↔ Col de l\'Iseran (2764 m) ↔ Val-d\'Isère',
    mode: 'navette',
    operator: 'Région Auvergne-Rhône-Alpes / Haute Maurienne Vanoise',
    network: 'Liaison Maurienne-Tarentaise',
    route: 'Bonneval-sur-Arc (1800 m) ↔ Pont Saint-Charles ↔ Col de l\'Iseran (2764 m) ↔ Le Fornet ↔ Val-d\'Isère (1850 m)',
    frequency: 'Liaisons quotidiennes en été',
    period: 'Été (Juillet-Août, plus haut col de montagne routier de toutes les Alpes)',
    stops: ['Bonneval-sur-Arc (Plus beau village de France)', 'Pont de l\'Oulietta', 'Col de l\'Iseran (2764 m, chapelle Notre-Dame de Toute Prudence)', 'Le Fornet Téléphérique', 'Val-d\'Isère Gare Routière'],
    color: '#f59e0b',
    url: 'https://www.haute-maurienne-vanoise.com',
    coords: '7.0470,45.3710;7.0310,45.4170;6.9790,45.4500'
  },
  // (Ancienne navette Avérole remplacée par Ligne 3 HMV officielle)
  {
    id: 'navette-aussois-barrages',
    ref: 'Navette Aussois',
    name: 'Navette Barrages de Plan d\'Amont : Aussois ↔ Barrages de Plan d\'Amont & d\'Aval (2040 m)',
    mode: 'navette',
    operator: 'Mairie d\'Aussois',
    network: 'Navettes Vanoise',
    route: 'Aussois Village (1500 m) ↔ Camping La Buidonnière ↔ Barrage de Plan d\'Aval ↔ Barrage de Plan d\'Amont (2040 m)',
    frequency: 'Navettes continues en été',
    period: 'Été (Accès Porte de la Vanoise, Refuge de la Fournache, Refuge de Plan d\'Amont)',
    stops: ['Aussois Place Centrale', 'Barrage de Plan d\'Aval (1950 m)', 'Barrage de Plan d\'Amont (2040 m, départ Dent Parrachée & Tour des Glaciers de la Vanoise)'],
    color: '#f59e0b',
    url: 'https://www.aussois.com',
    coords: '6.7420,45.2310;6.7110,45.2580;6.7020,45.2690'
  },
  {
    id: 'navette-valloire-galibier',
    ref: 'Navette Valloire',
    name: 'Navette Valloire & Galibier : Saint-Michel-de-Maurienne ↔ Valloire ↔ Plan Lachat ↔ Col du Galibier',
    mode: 'navette',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Saint-Michel-de-Maurienne Gare SNCF ↔ Col du Télégraphe (1566 m) ↔ Valloire (1430 m) ↔ Plan Lachat (1960 m) ↔ Col du Galibier (2642 m)',
    frequency: 'Quotidien en saison',
    period: 'Toute l\'année (Col du Galibier ouvert de juin à octobre)',
    stops: ['Saint-Michel-de-Maurienne Gare', 'Col du Télégraphe (1566 m)', 'Valloire Office de Tourisme', 'Plan Lachat (1960 m, départ Lac des Cerces & Grand Galibier)', 'Col du Galibier (2642 m)'],
    color: '#10b981',
    url: 'https://www.valloire.net',
    coords: '6.4710,45.2180;6.4460,45.1990;6.4290,45.1660;6.4410,45.1010;6.4070,45.0640'
  },
  {
    id: 'navette-areches-saint-guerin',
    ref: 'Navette Beaufortain',
    name: 'Navette Beaufortain : Beaufort ↔ Arêches ↔ Barrage de Saint-Guérin ↔ Col du Pré (1703 m)',
    mode: 'navette',
    operator: 'Communauté de Communes des Confluences Beaufortain',
    network: 'Navettes du Beaufortain',
    route: 'Beaufort-sur-Doron ↔ Arêches Village ↔ Barrage de Saint-Guérin (Passerelle himalayenne) ↔ Col du Pré (1703 m)',
    frequency: 'Navettes estivales',
    period: 'Été (Accès Tour du Beaufortain & vue imprenable sur le Mont-Blanc)',
    stops: ['Beaufort-sur-Doron', 'Arêches Village (1050 m)', 'Barrage de Saint-Guérin (1559 m, passerelle suspendue 80 m)', 'Col du Pré (1703 m, départ sentiers vers la Roche Parstire)'],
    color: '#f59e0b',
    url: 'https://www.areches-beaufort.com',
    coords: '6.5710,45.7200;6.5720,45.6880;6.5850,45.6420;6.6020,45.6790'
  },
  {
    id: 'navette-belledonne-fond-de-france',
    ref: 'Navette Sept Laux',
    name: 'Navette Belledonne Sept Laux : Allevard ↔ Pinsot ↔ Fond de France (Vallée du Bréda)',
    mode: 'navette',
    operator: 'Communauté de Communes Le Grésivaudan',
    network: 'TouGo Grésivaudan',
    route: 'Allevard-les-Bains ↔ Pinsot ↔ La Ferrière ↔ Fond de France (1100 m, porte des Sept Laux)',
    frequency: 'Liaisons régulières en saison',
    period: 'Toute l\'année (Accès direct Cirque des Sept Laux & GR738 Haute Traversée de Belledonne)',
    stops: ['Allevard-les-Bains Thermes', 'Pinsot (Sentier du fer)', 'Fond de France (1100 m, cascade du Pissou, départ Refuges des 7 Laux & Lac Noir)'],
    color: '#f59e0b',
    url: 'https://www.le-gresivaudan.fr',
    coords: '6.0740,45.3930;6.0960,45.3570;6.0350,45.2760;6.0590,45.2280'
  },
  {
    id: 'navette-belledonne-chamrousse',
    ref: 'Navette Chamrousse',
    name: 'Navette Belledonne Chamrousse : Grenoble ↔ Uriage ↔ Chamrousse (Plateau de l\'Arselle)',
    mode: 'navette',
    operator: 'Cars Région Isère / Transaltitude',
    network: 'Cars Région',
    route: 'Grenoble Gare ↔ Saint-Martin-d\'Uriage ↔ Chamrousse 1650 (Recoin) ↔ Chamrousse 1750 (Roche Béranger) ↔ Plateau de l\'Arselle (1600 m)',
    frequency: 'Quotidien',
    period: 'Toute l\'année (Accès Lacs Achard, Lacs Robert, Croix de Chamrousse 2253 m)',
    stops: ['Grenoble Gare Routière', 'Uriage Thermes', 'Chamrousse 1650 Recoin (Téléphérique de la Croix)', 'Chamrousse 1750 Roche Béranger', 'Plateau de l\'Arselle (1600 m, Réserve Naturelle de la Tourbière)'],
    color: '#10b981',
    url: 'https://www.chamrousse.com',
    coords: '5.7140,45.1910;5.8310,45.1430;5.8750,45.1260;5.8850,45.1150'
  },
  {
    id: 'navette-gordolasque',
    ref: 'Navette Gordolasque',
    name: 'Navette Gordolasque : Belvédère ↔ La Gordolasque ↔ Cascade du Ray (Refuge de Nice)',
    mode: 'navette',
    operator: 'Communauté de Communes Vésubie-Mercantour',
    network: 'Navettes Mercantour',
    route: 'Belvédère Village (830 m) ↔ Saint-Grat ↔ Cascade du Ray (1600 m, terminus vallée de la Gordolasque)',
    frequency: 'Navettes estivales',
    period: 'Été (Juin-Septembre, accès direct Vallon de la Fous & Refuge de Nice)',
    stops: ['Belvédère Village', 'Saint-Grat', 'Pont du Countet / Cascade du Ray (1600 m, départ sentiers Lac Autier & Refuge de Nice)'],
    color: '#f59e0b',
    url: 'https://www.vesubie-mercantour.com',
    coords: '7.3210,44.0150;7.3750,44.0450;7.4110,44.0880'
  },
  {
    id: 'navette-cayolle',
    ref: 'Navette Cayolle',
    name: 'Navette Col de la Cayolle : Barcelonnette ↔ Uvernet-Fours ↔ Bayasse ↔ Col de la Cayolle (2326 m)',
    mode: 'navette',
    operator: 'Communauté de Communes Vallée de l\'Ubaye Serre-Ponçon',
    network: 'Navettes de l\'Ubaye',
    route: 'Barcelonnette ↔ Gorges du Bachelard ↔ Bayasse ↔ Refuge de la Cayolle ↔ Col de la Cayolle (2326 m, frontière Alpes-Maritimes)',
    frequency: 'Navettes estivales',
    period: 'Été (Accès Cœur du Parc National du Mercantour, Lac d\'Allos & Mont Pelat 3051 m)',
    stops: ['Barcelonnette Place Aimé Gassier', 'Uvernet-Fours', 'Bayasse (1783 m, départ GR56 Tour de l\'Ubaye)', 'Refuge de la Cayolle', 'Col de la Cayolle (2326 m, porte du Mercantour)'],
    color: '#f59e0b',
    url: 'https://www.ubaye.com',
    coords: '6.6510,44.3860;6.6260,44.3580;6.7410,44.2540;6.7440,44.2230'
  },

  // ═══════════════════════════════════════════════════════
  // LIGNES OFFICIELLES DU PARC NATIONAL DES ÉCRINS (GUIDE ÉTÉ)
  // ═══════════════════════════════════════════════════════
  {
    id: 'bus-t75',
    ref: 'T75',
    name: 'Ligne CARS RÉGION T75 : Grenoble ↔ Vizille ↔ Le Bourg-d\'Oisans',
    mode: 'bus',
    operator: 'Cars Région Isère',
    network: 'Cars Région',
    route: 'Grenoble Gare Routière ↔ Pont-de-Claix ↔ Vizille ↔ Séchilienne ↔ Rochetaillée ↔ Le Bourg-d\'Oisans',
    frequency: 'Toutes les heures toute l\'année (Ligne structurante Oisans / Écrins)',
    period: 'Toute l\'année',
    stops: ['Grenoble Gare Routière', 'Vizille Place du Château', 'Séchilienne', 'Rochetaillée', 'Le Bourg-d\'Oisans Agence Cars Région'],
    color: '#10b981',
    url: 'https://carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.7720,45.0740;5.8330,45.0540;6.0280,45.0540'
  },
  {
    id: 'bus-zou-69',
    ref: 'ZOU! LER 69',
    name: 'Ligne ZOU! LER 69 : Briançon ↔ Embrun ↔ Gap ↔ Marseille',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU! Express',
    route: 'Briançon ↔ L\'Argentière ↔ Montdauphin ↔ Saint-Clément ↔ Châteauroux ↔ Embrun ↔ Crots ↔ Savines-le-Lac ↔ Chorges ↔ Gap ↔ Aix ↔ Marseille',
    frequency: 'Plusieurs départs quotidiens',
    period: 'Toute l\'année',
    stops: ['Briançon Gare', 'L\'Argentière-la-Bessée', 'Montdauphin-Guillestre', 'Saint-Clément-sur-Durance', 'Châteauroux-les-Alpes', 'Embrun Gare', 'Crots', 'Savines-le-Lac', 'Chorges', 'Gap Gare Routière'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.6340,44.8980;6.5590,44.7930;6.6490,44.6680;6.5780,44.6460;6.5180,44.6140;6.4950,44.5630;6.4710,44.5320;6.4040,44.5260;6.2770,44.5450;6.0790,44.5630'
  },
  {
    id: 'bus-zou-76',
    ref: 'ZOU! 76',
    name: 'Ligne ZOU! 76 : Briançon ↔ Montgenèvre ↔ Oulx TGV (Liaison Italie / Paris)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur / Resalp',
    network: 'ZOU!',
    route: 'Briançon Gare SNCF ↔ Montgenèvre (1860 m) ↔ Clavière (Italie) ↔ Cesana Torinese ↔ Oulx Gare TGV',
    frequency: 'Correspondances TGV Paris-Milan et Turin',
    period: 'Toute l\'année',
    stops: ['Briançon Gare', 'Montgenèvre Village', 'Clavière', 'Cesana Torinese', 'Oulx Gare TGV'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.6340,44.8980;6.7210,44.9310;6.7500,44.9380;6.7930,44.9520;6.8320,45.0340'
  },
  {
    id: 'bus-t90-t91',
    ref: 'T90 / T91',
    name: 'Ligne CARS RÉGION T90 / T91 : Grenoble ↔ La Mure ↔ Corps ↔ Gap',
    mode: 'bus',
    operator: 'Cars Région Isère / AURA',
    network: 'Cars Région',
    route: 'Grenoble ↔ Vizille ↔ La Mure ↔ Corps ↔ Saint-Firmin (Pont des Richards) ↔ Saint-Bonnet-en-Champsaur ↔ La Fare-en-Champsaur ↔ Gap',
    frequency: 'Liaison quotidienne régulière',
    period: 'Toute l\'année (Accès Valgaudemar & Champsaur)',
    stops: ['Grenoble Gare Routière', 'Vizille', 'La Mure', 'Corps', 'Saint-Firmin (Pont des Richards, correspondance Gioberney)', 'Saint-Bonnet-en-Champsaur', 'La Fare-en-Champsaur', 'Gap Gare Routière'],
    color: '#10b981',
    url: 'https://carsisere.auvergnerhonealpes.fr',
    coords: '5.7140,45.1910;5.7720,45.0740;5.7840,44.9020;5.9470,44.8190;6.0020,44.7810;6.0740,44.6810;6.0620,44.6670;6.0790,44.5630'
  },
  // ═════════════════════════════════════════════════════════════════════════
  // RÉSEAU OFFICIEL ALTIGO - BRIANÇONNAIS & VALLÉES (URBAIN & INTERURBAIN)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'altigo-l1',
    ref: 'ALTIGO 1',
    name: 'Ligne ALTIGO 1 : Champ de Mars (Cité Vauban) ↔ Gare SNCF ↔ Espace Sud',
    mode: 'bus',
    operator: 'Réseau AltiGo / Communauté de Communes du Briançonnais',
    network: 'AltiGo Briançon',
    route: 'Champ de Mars (Cité Vauban) ↔ Hôpital ↔ Place de l\'Europe ↔ Gare SNCF ↔ Sainte-Catherine ↔ Grand\'Boucle ↔ Espace Sud',
    frequency: 'Toutes les 20 à 30 min du lundi au samedi (Axe central de Briançon)',
    period: 'Toute l\'année (Liaison Cité Vauban UNESCO ↔ Gare TGV/TER ↔ Zones commerciales)',
    stops: [
      'Champ de Mars (1320 m, Cité Vauban, Fort des Salettes)',
      'Porte Pignerol',
      'Centre Hospitalier des Escartons',
      'Place de l\'Europe',
      'Gare SNCF de Briançon (1204 m, Pôle multimodal)',
      'Médiathèque / La Ruche',
      'Sainte-Catherine (Cœur de ville moderne)',
      'Grand\'Boucle',
      'Espace Sud (Centre commercial & zone d\'activités)'
    ],
    color: '#3b82f6',
    url: 'https://www.monaltigo.fr',
    coords: '6.6430,44.8990;6.6370,44.8980;6.6340,44.8980;6.6280,44.8870;6.6210,44.8770'
  },
  {
    id: 'altigo-l2',
    ref: 'ALTIGO 2',
    name: 'Ligne ALTIGO 2 : Champ de Mars ↔ Saint-Chaffrey / Chantemerle',
    mode: 'bus',
    operator: 'Réseau AltiGo / Communauté de Communes du Briançonnais',
    network: 'AltiGo Briançon',
    route: 'Champ de Mars ↔ Chantoiseau ↔ Les Carines ↔ Colaud ↔ Saint-Chaffrey ↔ Chantemerle (Télécabine Ratier)',
    frequency: 'Du lundi au samedi toute la journée',
    period: 'Toute l\'année (Accès station Serre Chevalier 1350 & départs rando Prorel)',
    stops: [
      'Champ de Mars (Cité Vauban)',
      'Chantoiseau',
      'Les Carines',
      'Colaud',
      'Saint-Chaffrey Village',
      'Chantemerle (1350 m, Télécabine Ratier, départ circuits VTT et sentiers)'
    ],
    color: '#10b981',
    url: 'https://www.monaltigo.fr',
    coords: '6.6430,44.8990;6.6340,44.9080;6.6120,44.9190;6.5860,44.9340'
  },
  {
    id: 'altigo-l3',
    ref: 'ALTIGO 3',
    name: 'Ligne ALTIGO 3 : Champ de Mars ↔ Villard-Saint-Pancrace ↔ Saint-Blaise',
    mode: 'bus',
    operator: 'Réseau AltiGo / Communauté de Communes du Briançonnais',
    network: 'AltiGo Briançon',
    route: 'Champ de Mars ↔ Gare SNCF ↔ Pont de Cervières ↔ Villard-Saint-Pancrace ↔ Saint-Blaise ↔ Pont La Lame',
    frequency: 'Du lundi au samedi régulier',
    period: 'Toute l\'année (Accès Vallée des Ayes, Refuge des Fonts de Cervières & Chalets)',
    stops: [
      'Champ de Mars',
      'Gare SNCF de Briançon',
      'Pont de Cervières (Accès vallée de Cervières & Col d\'Izoard)',
      'Villard-Saint-Pancrace Village',
      'Saint-Blaise',
      'Pont La Lame (Départ randonnées Vallée des Ayes / Lac de l\'Orceyrette)'
    ],
    color: '#f59e0b',
    url: 'https://www.monaltigo.fr',
    coords: '6.6430,44.8990;6.6340,44.8980;6.6420,44.8870;6.6350,44.8720;6.6280,44.8580'
  },
  {
    id: 'altigo-l4',
    ref: 'ALTIGO 4',
    name: 'Ligne ALTIGO 4 : Chantoiseau ↔ Champ de Mars ↔ Fontchristiane',
    mode: 'bus',
    operator: 'Réseau AltiGo / Communauté de Communes du Briançonnais',
    network: 'AltiGo Briançon',
    route: 'Chantoiseau ↔ Colaud ↔ Champ de Mars ↔ Fort du Randouillet ↔ Fontchristiane',
    frequency: 'Du lundi au samedi',
    period: 'Toute l\'année (Dessert les hauteurs de Briançon et le patrimoine fortifié)',
    stops: [
      'Chantoiseau',
      'Colaud',
      'Champ de Mars (Cité Vauban)',
      'Fontchristiane (Pied des forts du Randouillet & des Têtes)'
    ],
    color: '#8b5cf6',
    url: 'https://www.monaltigo.fr',
    coords: '6.6280,44.9080;6.6430,44.8990;6.6520,44.8910;6.6480,44.8790'
  },
  {
    id: 'altigo-l5',
    ref: 'ALTIGO 5',
    name: 'Ligne ALTIGO 5 : Briançon ↔ La Vachette ↔ Montgenèvre (Station Frontière)',
    mode: 'bus',
    operator: 'Réseau AltiGo / Autocars Resalp',
    network: 'AltiGo Briançonnais',
    route: 'Briançon Gare SNCF ↔ Champ de Mars ↔ La Vachette ↔ Val-des-Prés ↔ Montgenèvre Gare Routière ↔ Durancia / Chalmettes (1860 m)',
    frequency: 'Quotidien toute l\'année, cadencement renforcé en été et hiver (liaison directe vers le Col de Montgenèvre)',
    period: 'Toute l\'année (Accès Chaberton 3131 m, Vallée de la Doire & frontière italienne)',
    stops: [
      'Briançon Gare SNCF (1204 m)',
      'Briançon Champ de Mars',
      'La Vachette (Entrée Vallée de la Clarée)',
      'Montgenèvre Gare Routière (1860 m, Espace Prarial)',
      'Montgenèvre Durancia / Les Chalmettes (Centre balnéo & départ sentiers Mont Chaberton / Lac des Sarailles)'
    ],
    color: '#ef4444',
    url: 'https://www.monaltigo.fr',
    coords: '6.6340,44.8980;6.6430,44.8990;6.6780,44.9210;6.7180,44.9310;6.7260,44.9340'
  },
  {
    id: 'altigo-l6',
    ref: 'ALTIGO 6',
    name: 'Ligne ALTIGO 6 : Briançon ↔ Serre Chevalier ↔ Le Monêtier-les-Bains (↔ La Grave en été)',
    mode: 'bus',
    operator: 'Réseau AltiGo / Communauté de Communes du Briançonnais',
    network: 'AltiGo Briançonnais',
    route: 'Briançon Champ de Mars ↔ Gare SNCF ↔ Chantemerle ↔ Villeneuve ↔ Le Monêtier-les-Bains ↔ Le Lauzet ↔ Col du Lautaret ↔ Villar-d\'Arêne ↔ La Grave',
    frequency: 'Toutes les heures toute l\'année (prolongement régulier à La Grave en été)',
    period: 'Toute l\'année (Accès Vallée de la Guisane, Grands Bains du Monêtier, Col du Lautaret & Haute Romanche)',
    stops: [
      'Briançon Champ de Mars',
      'Briançon Gare SNCF',
      'Chantemerle (Téléphérique Serre Chevalier 1350)',
      'Villeneuve Aravet (1400 m)',
      'Le Monêtier-les-Bains (1500 m, Grands Bains, départ sentier Lac de la Douche & Col d\'Arsine)',
      'Le Lauzet',
      'Col du Lautaret (2058 m, Jardin du Lautaret)',
      'Villar-d\'Arêne',
      'La Grave (Téléphérique des Glaciers de la Meije 3200 m)'
    ],
    color: '#06b6d4',
    url: 'https://www.monaltigo.fr',
    coords: '6.6340,44.8980;6.5860,44.9340;6.5440,44.9540;6.5080,44.9750;6.4380,45.0210;6.4060,45.0340;6.3370,45.0440;6.3050,45.0450'
  },
  {
    id: 'altigo-l7',
    ref: 'ALTIGO 7',
    name: 'Ligne ALTIGO 7 : Briançon ↔ Val-des-Prés ↔ Plampinet ↔ Névache (Vallée de la Clarée)',
    mode: 'bus',
    operator: 'Réseau AltiGo / Autocars Resalp',
    network: 'AltiGo Briançonnais',
    route: 'Briançon Gare SNCF ↔ Champ de Mars ↔ La Vachette ↔ Val-des-Prés ↔ Plampinet ↔ Névache Roubion ↔ Névache Ville-Haute (1600 m)',
    frequency: 'Quotidien toute l\'année avec renfort le week-end et en saison (Correspondance avec les navettes Haute Clarée)',
    period: 'Toute l\'année (Ligne régulière pérenne, accès direct Vallée de la Clarée & refuges)',
    stops: [
      'Briançon Gare SNCF',
      'Briançon Champ de Mars',
      'La Vachette',
      'Val-des-Prés (Le Rosier, La Vachette)',
      'Plampinet (Auberge de la Clarée, départ Col des Thures)',
      'Névache Roubion (Foyer nordique)',
      'Névache Ville-Haute (1600 m, Pôle d\'échange des navettes de la Haute Clarée)'
    ],
    color: '#ec4899',
    url: 'https://www.monaltigo.fr',
    coords: '6.6340,44.8980;6.6430,44.8990;6.6780,44.9210;6.6060,44.9350;6.5790,44.9490;6.5370,44.9720'
  },
  {
    id: 'altigo-ld',
    ref: 'ALTIGO D',
    name: 'Ligne ALTIGO D (Dimanches & Jours fériés) : Cité Vauban ↔ Gare ↔ Espace Sud',
    mode: 'bus',
    operator: 'Réseau AltiGo / Ville de Briançon',
    network: 'AltiGo Briançon',
    route: 'Champ de Mars (Cité Vauban) ↔ Hôpital ↔ Gare SNCF ↔ Grand\'Boucle ↔ Espace Sud',
    frequency: 'Circule les dimanches et jours fériés toute l\'année',
    period: 'Toute l\'année (Dimanches et fériés)',
    stops: [
      'Champ de Mars (Cité Vauban)',
      'Hôpital des Escartons',
      'Gare SNCF de Briançon',
      'Grand\'Boucle',
      'Espace Sud'
    ],
    color: '#6366f1',
    url: 'https://www.monaltigo.fr',
    coords: '6.6430,44.8990;6.6370,44.8980;6.6340,44.8980;6.6280,44.8870;6.6210,44.8770'
  },
  {
    id: 'navette-oisans-vaujany',
    ref: 'Navette Vaujany',
    name: 'Navette Oisans : Venosc ↔ Le Bourg-d\'Oisans ↔ Allemond ↔ Vaujany',
    mode: 'navette',
    operator: 'Oisans Tourisme',
    network: 'Navettes Oisans',
    route: 'Venosc ↔ Le Bourg-d\'Oisans ↔ Rochetaillée ↔ Allemond (Lac du Verney) ↔ Vaujany',
    frequency: 'Navettes estivales régulières',
    period: 'Été (Juillet-Août)',
    stops: ['Venosc Village', 'Le Bourg-d\'Oisans', 'Allemond (Eau d\'Olle Express)', 'Vaujany Téléphérique'],
    color: '#f59e0b',
    url: 'https://www.oisans.com',
    coords: '6.1170,44.9900;6.0280,45.0540;6.0360,45.1320;6.0770,45.1580'
  },
  {
    id: 'navette-oisans-ferrand',
    ref: 'Navette Ferrand',
    name: 'Navette Ferrand : Le Bourg-d\'Oisans ↔ Mizoën ↔ Besse-en-Oisans',
    mode: 'navette',
    operator: 'Oisans Tourisme',
    network: 'Navettes Oisans',
    route: 'Le Bourg-d\'Oisans ↔ Barrage du Chambon ↔ Mizoën ↔ Besse-en-Oisans (1450 m, village classé)',
    frequency: 'Navettes estivales',
    period: 'Été (Accès Plateau d\'Emparis & Lacs Noir et Lérié face à la Meije)',
    stops: ['Le Bourg-d\'Oisans', 'Barrage du Chambon', 'Mizoën', 'Besse-en-Oisans (Départ sentiers Plateau d\'Emparis & GR54)'],
    color: '#f59e0b',
    url: 'https://www.oisans.com',
    coords: '6.0280,45.0540;6.2160,45.0460;6.2150,45.0500;6.1700,45.0740'
  },
  {
    id: 'telecabine-venosc',
    ref: 'Télécabine Venosc',
    name: 'Télécabine de Venosc : Venosc Village ↔ Les Deux Alpes 1650',
    mode: 'cable_car',
    operator: 'SATA Deux Alpes',
    network: 'Remontées Mécaniques Oisans',
    route: 'Venosc Village (945 m, Vallée du Vénéon) ↔ Les Deux Alpes 1650',
    frequency: 'Liaison continue en 8 minutes',
    period: 'Été & Hiver (Lien direct sans voiture entre le Vénéon et Les Deux Alpes)',
    stops: ['Venosc Village (945 m)', 'Les Deux Alpes 1650 (Place de Venosc)'],
    color: '#ec4899',
    url: 'https://www.les2alpes.com',
    coords: '6.1170,44.9900;6.1210,45.0080'
  },
  {
    id: 'ligne-2-pays-des-ecrins',
    ref: 'Ligne 2 Écrins',
    name: 'Ligne 2 Pays des Écrins : La Roche-de-Rame ↔ L\'Argentière ↔ Saint-Martin-de-Queyrières',
    mode: 'navette',
    operator: 'Communauté de Communes du Pays des Écrins',
    network: 'Transports du Pays des Écrins',
    route: 'La Roche-de-Rame (Pra Reboul, Le Lac, La Roche Village, La Ruine, Pont de l\'Ascension) ↔ L\'Argentière-La Bessée (Plan Léothaud, La Magdeleine, Le Quartz, Gare SNCF, Place Demaison, Maison Planche) ↔ Saint-Martin-de-Queyrières (Queyrières, St-Martin Village, Prelles, La Rochette)',
    frequency: 'Du lundi au vendredi toute l\'année (Gratuit et ouvert à tous, horaires 2025)',
    period: 'Toute l\'année (Horaires officiels 2025)',
    stops: [
      'La Roche-de-Rame (Pra Reboul)',
      'La Roche-de-Rame (Le Lac)',
      'La Roche Village',
      'La Ruine',
      'Pont de l\'Ascension',
      'L\'Argentière (Plan Léothaud)',
      'L\'Argentière (La Magdeleine)',
      'L\'Argentière (Le Quartz Piscine)',
      'ZA Les Sablonnières',
      'L\'Argentière-La Bessée Gare SNCF',
      'Place R. Demaison',
      'Le Kiosque',
      'Maison Planche',
      'Queyrières',
      'Saint-Martin-de-Queyrières Village',
      'Prelles',
      'La Rochette'
    ],
    color: '#3b82f6',
    url: 'https://www.cc-paysdesecrins.fr',
    coords: '6.5880,44.7380;6.5810,44.7500;6.5780,44.7560;6.5710,44.7640;6.5650,44.7720;6.5510,44.7790;6.5590,44.7930;6.5650,44.8030;6.5780,44.8250;6.5840,44.8410;6.5770,44.8560;6.5710,44.8680'
  },
  {
    id: 'estibus-a-madame-carle',
    ref: 'ESTIBUS A',
    name: 'ESTIBUS A : Vallouise-Pelvoux ↔ Ailefroide ↔ Pré de Madame Carle (1874 m)',
    mode: 'navette',
    operator: 'Communauté de Communes du Pays des Écrins',
    network: 'Les ESTIBUS du Pays des Écrins',
    route: 'Station Pelvoux ↔ École St-Antoine ↔ Route du Domaine ↔ La Chapelle ↔ Tunnel des Claux ↔ Ailefroide Camping ↔ Ailefroide Village ↔ Pré de Madame Carle (1874 m)',
    frequency: 'Du lundi au dimanche y compris jours fériés (8 rotations/jour, 1 € le trajet, gratuit -12 ans)',
    period: 'Été (Du 4 juillet au 30 août 2026, correspondance Ligne 1)',
    stops: [
      'Station Pelvoux (1250 m)',
      'École Saint-Antoine (Correspondance Ligne 1 L\'Argentière)',
      'Route du Domaine',
      'La Chapelle (Pelvoux)',
      'Tunnel des Claux',
      'Ailefroide Camping (1500 m)',
      'Ailefroide Village (Maison de la Montagne & Bureau des Guides)',
      'Pré de Madame Carle (1874 m, terminus route, départ direct refuges Cézanne, Glacier Blanc, Pelvoux)'
    ],
    color: '#06b6d4',
    url: 'https://www.cc-paysdesecrins.fr',
    coords: '6.4880,44.8640;6.4710,44.8640;6.4620,44.8710;6.4550,44.8780;6.4500,44.8820;6.4460,44.8860;6.4440,44.8870;6.4180,44.9180'
  },
  {
    id: 'estibus-b-dormillouse',
    ref: 'ESTIBUS B',
    name: 'ESTIBUS B : L\'Argentière ↔ Freissinières ↔ Parking Dormillouse (Vallée Sauvage)',
    mode: 'navette',
    operator: 'Communauté de Communes du Pays des Écrins',
    network: 'Les ESTIBUS du Pays des Écrins',
    route: 'L\'Argentière Gare SNCF ↔ ZA Les Sablonnières ↔ Quartz Piscine ↔ Plan Léothaud ↔ La Roche-de-Rame ↔ Freissinières (Pallon, Les Allouviers, Le Plan, Les Ribes, Les Bellons, Les Viollins) ↔ Parking des Cascades de Dormillouse',
    frequency: 'Du lundi au dimanche y compris jours fériés (6 rotations/jour, 1 € le trajet)',
    period: 'Été (Du 4 juillet au 30 août 2026, accès unique hameau sans voiture de Dormillouse & Lac Faravel)',
    stops: [
      'L\'Argentière-La Bessée Gare SNCF',
      'ZA Les Sablonnières',
      'Le Quartz Piscine',
      'Plan Léothaud',
      'La Roche-de-Rame (Pont de l\'Ascension, La Ruine, Village, Lac)',
      'Freissinières (Hameau de Pallon)',
      'Freissinières (Pont de Pallon)',
      'Freissinières (Les Allouviers)',
      'Freissinières (Le Plan / Mairie)',
      'Freissinières (Les Ribes)',
      'Freissinières (Les Bellons)',
      'Freissinières (Les Viollins)',
      'Parking de Dormillouse (Départ sentier vers Dormillouse seul village habité au cœur du Parc, Lac Faravel, Lac Palluel, Refuge des Bans)'
    ],
    color: '#f97316',
    url: 'https://www.cc-paysdesecrins.fr',
    coords: '6.5590,44.7930;6.5550,44.7860;6.5510,44.7790;6.5780,44.7560;6.5810,44.7500;6.5410,44.7430;6.5340,44.7470;6.5180,44.7520;6.4860,44.7560;6.4620,44.7410;6.4420,44.7310'
  },
  {
    id: 'estibus-c-beassac',
    ref: 'ESTIBUS C',
    name: 'ESTIBUS C : Vallouise Centre ↔ Chapelle de Béassac',
    mode: 'navette',
    operator: 'Communauté de Communes du Pays des Écrins',
    network: 'Les ESTIBUS du Pays des Écrins',
    route: 'Vallouise Centre (Maison du Parc) ↔ La Casse ↔ Puy-Aillaud / Chapelle de Béassac',
    frequency: 'Du lundi au dimanche y compris jours fériés (7 rotations/jour, 1 € le trajet)',
    period: 'Été (Du 4 juillet au 30 août 2026)',
    stops: [
      'Vallouise Centre (Office de Tourisme & Maison du Parc)',
      'Chapelle de Béassac (Départ sentiers belvédère du Pelvoux & Puy-Aillaud)'
    ],
    color: '#84cc16',
    url: 'https://www.cc-paysdesecrins.fr',
    coords: '6.4880,44.8460;6.4820,44.8390;6.4760,44.8340'
  },
  {
    id: 'navette-marche-puy-st-vincent',
    ref: 'Navette Marché PSV',
    name: 'Navette Marché Puy-Saint-Vincent ↔ Vallouise Centre',
    mode: 'navette',
    operator: 'Communauté de Communes du Pays des Écrins',
    network: 'Les ESTIBUS du Pays des Écrins',
    route: 'Puy-Saint-Vincent 1800 (Récoumère, Clot Léothaud, Tartarasse) ↔ Station 1600 (Panoramic, Maison du Miel) ↔ Station 1400 (Saint-Roch, Mairie, Place du Puy) ↔ Aiglière ↔ Vallouise Centre',
    frequency: 'Tous les jeudis matin pour le marché traditionnel de Vallouise (Vacances d\'été)',
    period: 'Été (Jeudis matins de juillet-août)',
    stops: [
      'Puy-Saint-Vincent 1800 (Récoumère)',
      'Clot des Léothauds',
      'Tartarasse',
      'Puy-Saint-Vincent 1600 (Panoramic)',
      'Maison Artisanale / Maison du Miel',
      'Puy-Saint-Vincent 1400 (Place des Prés)',
      'Saint-Roch',
      'Puy-Saint-Vincent Mairie',
      'Place du Puy',
      'Aiglière',
      'Vallouise Centre (Marché provençal de montagne)'
    ],
    color: '#a855f7',
    url: 'https://www.cc-paysdesecrins.fr',
    coords: '6.4790,44.8190;6.4820,44.8230;6.4860,44.8270;6.4880,44.8310;6.4880,44.8460'
  },
  {
    id: 'navette-serre-poncon-chanteloube',
    ref: 'Navette Serre-Ponçon',
    name: 'Navette Serre-Ponçon : Chorges ↔ Baie de Chanteloube (Lac)',
    mode: 'navette',
    operator: 'CC Serre-Ponçon',
    network: 'Navettes Serre-Ponçon',
    route: 'Chorges Gare SNCF ↔ Village ↔ Baie de Chanteloube / Viaduc immergé',
    frequency: 'Navettes quotidiennes en été',
    period: 'Été (Juillet-Août)',
    stops: ['Chorges Gare SNCF', 'Chorges Centre', 'Baie de Chanteloube (Plage & activités nautiques)'],
    color: '#f59e0b',
    url: 'https://www.ccserreponcon.com',
    coords: '6.2770,44.5450;6.2810,44.5320;6.3260,44.5180'
  },
  {
    id: 'navette-urbaine-embrun',
    ref: 'Navette Embrun',
    name: 'Navette Urbaine & Plage d\'Embrun : Gare SNCF ↔ Centre Historique ↔ Plan d\'Eau',
    mode: 'navette',
    operator: 'CC Serre-Ponçon',
    network: 'Navettes Serre-Ponçon',
    route: 'Embrun Gare SNCF ↔ Centre Ville ↔ Maison du Parc des Écrins ↔ Plan d\'Eau d\'Embrun',
    frequency: 'Régulier toute l\'année, renfort estival vers le lac',
    period: 'Toute l\'année',
    stops: ['Embrun Gare SNCF', 'Embrun Centre Ville', 'Maison du Parc des Écrins', 'Plan d\'Eau d\'Embrun'],
    color: '#f59e0b',
    url: 'https://www.ccserreponcon.com',
    coords: '6.4950,44.5630;6.4940,44.5580;6.4890,44.5520;6.4790,44.5540'
  },
  {
    id: 'bus-zou-520',
    ref: 'ZOU! 520',
    name: 'Ligne ZOU! 520 : Gap ↔ Col Bayard ↔ Saint-Bonnet-en-Champsaur',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Gap Gare Routière ↔ Col Bayard (1248 m) ↔ Saint-Bonnet-en-Champsaur',
    frequency: 'Quotidien toute l\'année',
    period: 'Toute l\'année',
    stops: ['Gap Gare Routière', 'Col Bayard (Golf & centre nordique)', 'Saint-Bonnet-en-Champsaur Centre'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.0790,44.5630;6.0590,44.6200;6.0740,44.6810'
  },
  {
    id: 'bus-zou-523-524',
    ref: 'ZOU! 523/524',
    name: 'Ligne ZOU! 523/524 : Gap ↔ Manse ↔ Pont-du-Fossé ↔ Saint-Jean-Saint-Nicolas ↔ Orcières',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Gap Gare ↔ Col de Manse ↔ Pont-du-Fossé ↔ Saint-Jean-Saint-Nicolas ↔ Orcières-Merlette',
    frequency: 'Liaison régulière toute l\'année',
    period: 'Toute l\'année',
    stops: ['Gap Gare Routière', 'Col de Manse (1268 m)', 'Pont-du-Fossé', 'Saint-Jean-Saint-Nicolas', 'Orcières Village', 'Orcières-Merlette 1850'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.0790,44.5630;6.1360,44.6180;6.2280,44.6710;6.2780,44.6780;6.3260,44.6940'
  },
  {
    id: 'bus-zou-527',
    ref: 'ZOU! 527',
    name: 'Ligne ZOU! 527 : Gap ↔ Ancelle ↔ Saint-Léger-les-Mélèzes',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Gap Gare Routière ↔ Col de Manse ↔ Ancelle (1350 m) ↔ Saint-Léger-les-Mélèzes',
    frequency: 'Quotidien en saison estivale & hivernale',
    period: 'Été & Hiver',
    stops: ['Gap Gare Routière', 'Col de Manse', 'Ancelle Village', 'Saint-Léger-les-Mélèzes Station'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.0790,44.5630;6.1360,44.6180;6.2050,44.6240;6.2190,44.6440'
  },
  {
    id: 'bus-zou-528',
    ref: 'ZOU! 528',
    name: 'Ligne ZOU! 528 : Gap ↔ Saint-Jean-Saint-Nicolas ↔ Champoléon ↔ Orcières',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Gap ↔ Chabottes ↔ Saint-Jean-Saint-Nicolas ↔ Vallée de Champoléon ↔ Orcières',
    frequency: 'Navettes estivales',
    period: 'Été (Accès Vallée de Champoléon & sentier des cascades)',
    stops: ['Gap Gare Routière', 'Chabottes', 'Saint-Jean-Saint-Nicolas', 'Champoléon (Maison du Berger)', 'Orcières Village'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.0790,44.5630;6.1710,44.6430;6.2780,44.6780;6.2620,44.7170;6.3260,44.6940'
  },
  {
    id: 'bus-zou-522',
    ref: 'ZOU! 522',
    name: 'Ligne ZOU! 522 : Gap ↔ Saint-Bonnet ↔ Saint-Firmin (Valgaudemar)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Gap Gare Routière ↔ Saint-Bonnet-en-Champsaur ↔ Chauffayer ↔ Saint-Firmin (Porte du Valgaudemar)',
    frequency: 'Quotidien toute l\'année',
    period: 'Toute l\'année (Correspondance Navette Gioberney)',
    stops: ['Gap Gare Routière', 'Saint-Bonnet', 'Chauffayer', 'Saint-Firmin Village (Pont des Richards)'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.0790,44.5630;6.0740,44.6810;6.0180,44.7540;6.0020,44.7810'
  },
  {
    id: 'navette-valgaudemar-st-firmin',
    ref: 'Navette Valgaudemar',
    name: 'Navette du Valgaudemar : Saint-Firmin ↔ La Chapelle ↔ Le Gioberney (1640 m)',
    mode: 'navette',
    operator: 'Communauté de Communes du Champsaur-Valgaudemar',
    network: 'Navettes Écrins',
    route: 'Saint-Firmin (Pont des Richards) ↔ Saint-Maurice-en-Valgodemard ↔ La Chapelle-en-Valgaudemar ↔ Les Portes ↔ Le Casset ↔ Le Clot ↔ Gioberney (1640 m)',
    frequency: 'Navettes quotidiennes en été (Réservation office de tourisme)',
    period: 'Été (Juin-Septembre, accès direct haute montagne des Écrins)',
    stops: ['Saint-Firmin (Pont des Richards, correspondance Gap/Grenoble)', 'Saint-Maurice', 'La Chapelle-en-Valgaudemar (Maison du Parc des Écrins)', 'Les Portes', 'Le Casset', 'Le Clot', 'Gioberney (1640 m, Refuges Xavier Blanc, Vallonpierre, Chabournéou, Cascade Voile de la Mariée)'],
    color: '#f59e0b',
    url: 'https://www.champsaur-valgaudemar.com',
    coords: '6.0020,44.7810;6.0820,44.8040;6.1740,44.8190;6.1950,44.8050;6.2290,44.7840;6.2750,44.7680'
  },
  {
    id: 'bus-zou-551',
    ref: 'ZOU! 551',
    name: 'Ligne ZOU! 551 : Briançon ↔ Le Monêtier-les-Bains (Guisane Express)',
    mode: 'bus',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    network: 'ZOU!',
    route: 'Briançon Gare ↔ Saint-Chaffrey (Chantemerle) ↔ La Salle-les-Alpes (Villeneuve) ↔ Le Monêtier-les-Bains',
    frequency: 'Service renforcé toute l\'année',
    period: 'Toute l\'année',
    stops: ['Briançon Gare SNCF', 'Chantemerle Téléphérique', 'Villeneuve Centre', 'Le Monêtier-les-Bains Les Grands Bains'],
    color: '#0284c7',
    url: 'https://zou.maregionsud.fr',
    coords: '6.6340,44.8980;6.5860,44.9340;6.5440,44.9540;6.5080,44.9750'
  }
];

const STATIONS = [
  { id: 'st-chamonix', name: 'Gare de Chamonix-Mont-Blanc', mode: 'station', alt: 1035, lat: 45.9237, lng: 6.8694, lines: ['Mont-Blanc Express', 'Chamonix Bus 1 & 2', 'Liaison Martigny (Suisse)'] },
  { id: 'st-le-fayet', name: 'Gare de Saint-Gervais-les-Bains-Le Fayet', mode: 'station', alt: 581, lat: 45.9080, lng: 6.7118, lines: ['TGV InOui', 'TER AURA', 'Mont-Blanc Express', 'Tramway du Mont-Blanc (TMB)'] },
  { id: 'st-grenoble', name: 'Gare de Grenoble', mode: 'station', alt: 212, lat: 45.1910, lng: 5.7140, lines: ['TGV InOui', 'TER Sillon Alpin', 'Ligne des Alpes', 'Cars Région T83/T84/T87/T88'] },
  { id: 'st-chambery', name: 'Gare de Chambéry - Challes-les-Eaux', mode: 'station', alt: 270, lat: 45.5714, lng: 5.9200, lines: ['TGV InOui / TGV Milan', 'TER Maurienne', 'TER Tarentaise', 'TER Annecy/Genève'] },
  { id: 'st-annecy', name: 'Gare d\'Annecy', mode: 'station', alt: 448, lat: 45.8992, lng: 6.1296, lines: ['TGV InOui', 'Léman Express', 'TER AURA', 'Cars Région Y51/Y62/Y91'] },
  { id: 'st-modane', name: 'Gare de Modane (Frontière Fr/It)', mode: 'station', alt: 1057, lat: 45.2020, lng: 6.6710, lines: ['TGV Paris-Milan', 'TER Maurienne', 'Cars Région S52/S53 (Val Cenis & Vanoise)'] },
  { id: 'st-bsm', name: 'Gare de Bourg-Saint-Maurice', mode: 'station', alt: 810, lat: 45.6180, lng: 6.7700, lines: ['TGV des Neiges / Eurostar', 'TER Tarentaise', 'Funiculaire Arc-en-Ciel', 'Cars S14/S15/S16'] },
  { id: 'st-moutiers', name: 'Gare de Moûtiers - Salins - Brides-les-Bains', mode: 'station', alt: 480, lat: 45.4836, lng: 6.5317, lines: ['TGV des Neiges', 'TER Tarentaise', 'Cars S10 (Courchevel)/S11 (Méribel)/S12 (Val Thorens)'] },
  { id: 'st-albertville', name: 'Gare d\'Albertville', mode: 'station', alt: 340, lat: 45.6756, lng: 6.3927, lines: ['TER Tarentaise', 'Cars Région Y51 (Annecy)', 'Cars S20 (Beaufort)'] },
  { id: 'st-briancon', name: 'Gare de Briançon (1204 m)', mode: 'station', alt: 1204, lat: 44.8980, lng: 6.6340, lines: ['Train de nuit Intercités Paris-Briançon', 'TER Val de Durance', 'ZOU! 54/55/57', 'Navette Clarée'] },
  { id: 'st-gap', name: 'Gare de Gap', mode: 'station', alt: 745, lat: 44.5630, lng: 6.0790, lines: ['TER Valence-Briançon', 'TER Marseille-Briançon', 'Ligne des Alpes', 'ZOU! 51/52/Dévoluy'] },
  { id: 'st-veynes', name: 'Gare de Veynes - Dévoluy', mode: 'station', alt: 814, lat: 44.5330, lng: 5.8230, lines: ['Nœud ferroviaire alpin (Ligne des Alpes & Val de Durance)'] },
  { id: 'st-largentiere', name: 'Gare de L\'Argentière-les-Écrins', mode: 'station', alt: 976, lat: 44.7930, lng: 6.5590, lines: ['TER Briançon', 'Intercités Nuit', 'Navette Pré de Madame Carle (Écrins)'] },
  { id: 'st-montdauphin', name: 'Gare de Montdauphin - Guillestre', mode: 'station', alt: 900, lat: 44.6680, lng: 6.6490, lines: ['TER Briançon', 'Correspondances Queyras / Vars / Risoul'] },
  { id: 'st-nice', name: 'Gare de Nice-Ville', mode: 'station', alt: 16, lat: 43.7040, lng: 7.2620, lines: ['TGV Méditerranée', 'Train des Merveilles (Tende)', 'Chemins de Fer de Provence (Digne)', 'ZOU! 91/92/93'] },
  { id: 'st-vallorcine', name: 'Gare de Vallorcine', mode: 'station', alt: 1260, lat: 46.0310, lng: 6.9320, lines: ['Mont-Blanc Express (Frontière Franco-Suisse)'] },
  { id: 'st-cluses', name: 'Gare de Cluses', mode: 'station', alt: 486, lat: 46.0601, lng: 6.5790, lines: ['TER AURA / Léman Express', 'Cars Région Y81 (Chamonix)', 'Y72 (Les Gets/Morzine)', 'Y92 (Samoëns/Sixt)'] },
  { id: 'st-sallanches', name: 'Gare de Sallanches', mode: 'station', alt: 545, lat: 45.9380, lng: 6.6300, lines: ['TER AURA', 'Cars Région Y81 (Chamonix)', 'Navette Megève'] },
  { id: 'st-thonon', name: 'Gare de Thonon-les-Bains', mode: 'station', alt: 431, lat: 46.3720, lng: 6.4770, lines: ['Léman Express', 'TER AURA', 'Cars Région Y71 (Morzine/Avoriaz)'] },
  { id: 'st-sjm', name: 'Gare de Saint-Jean-de-Maurienne', mode: 'station', alt: 550, lat: 45.2760, lng: 6.3440, lines: ['TER Maurienne', 'Cars Région S50/S51 (Les Sybelles)'] },
  { id: 'st-digne', name: 'Gare de Digne-les-Bains (Terminus Train des Pignes)', mode: 'station', alt: 608, lat: 44.0930, lng: 6.2350, lines: ['Chemins de Fer de Provence (Train des Pignes Nice → Digne)', 'ZOU! Digne-Barcelonnette'] },
  { id: 'st-nevache', name: 'Pôle Navettes de Névache (Vallée de la Clarée)', mode: 'station', alt: 1600, lat: 44.9720, lng: 6.5370, lines: ['Navette Vallée de la Clarée', 'Navette Haute Clarée (Fontcouverte)', 'Navette Vallée Étroite'] },
  { id: 'st-st-dalmas', name: 'Gare de Saint-Dalmas-de-Tende', mode: 'station', alt: 710, lat: 44.0520, lng: 7.5950, lines: ['Train des Merveilles (Ligne de Tende)', 'Navette Vallée des Merveilles'] },
  { id: 'st-barcelonnette', name: 'Gare Routière de Barcelonnette', mode: 'station', alt: 1132, lat: 44.3860, lng: 6.6510, lines: ['ZOU! 51 (Gap-Embrun)', 'ZOU! Digne', 'Navette Haute Ubaye (Maljasset/Fouillouse)'] },
  { id: 'hub-madame-carle', name: 'Pôle Navettes Pré de Madame Carle', mode: 'station', alt: 1874, lat: 44.9180, lng: 6.4180, lines: ['Navette Écrins (Vallouise - Ailefroide - Madame Carle)', 'Départ direct refuges Glacier Blanc & Cézanne'] },
  { id: 'hub-pralognan', name: 'Pôle Navettes Pralognan-la-Vanoise', mode: 'station', alt: 1410, lat: 45.3800, lng: 6.7210, lines: ['Navette Parc Vanoise Les Prioux', 'Départ refuges Félix Faure, Péclet-Polset, Roc de la Pêche'] },
  { id: 'hub-berarde', name: 'Pôle Navettes La Bérarde (Écrins)', mode: 'station', alt: 1727, lat: 44.9330, lng: 6.2940, lines: ['Navette Oisans Saint-Christophe / Bourg-d\'Oisans', 'Départ refuges Promontoire, Châtelleret, Carrelet'] },
  { id: 'hub-gioberney', name: 'Pôle Navettes Gioberney (Valgaudemar)', mode: 'station', alt: 1640, lat: 44.7680, lng: 6.2750, lines: ['Navette Valgaudemar', 'Départ refuges Xavier Blanc & Vallonpierre'] },
  { id: 'hub-notre-dame-gorge', name: 'Pôle Navettes Notre-Dame de la Gorge', mode: 'station', alt: 1210, lat: 45.7870, lng: 6.7130, lines: ['Navette Les Contamines', 'Départ Tour du Mont-Blanc & refuge Nant Borrant'] }
];

async function main() {
  console.log('--- Compilation du jeu de données des transports alpins ---');
  
  // 1. Charger les voies ferrées et téléphériques depuis public/transport_alps.geojson
  console.log('Lecture de public/transport_alps.geojson...');
  const rawData = JSON.parse(fs.readFileSync('public/transport_alps.geojson', 'utf8'));

  const features = [];

  // Groupement des voies ferrées majeures
  const railGroups = {};
  for (const f of rawData.features) {
    if (!f.properties?.name) continue;
    const isRail = f.properties.railway === 'rail' || f.properties.railway === 'narrow_gauge';
    if (!isRail) continue;
    
    const name = f.properties.name;
    // Filtrer les noms techniques non voyageurs
    if (name.startsWith('Voie') || name.startsWith('Pont') || name.startsWith('Route') || name.length < 4) continue;

    if (!railGroups[name]) {
      railGroups[name] = {
        name,
        type: f.properties.railway,
        operator: f.properties.operator || 'SNCF Réseau',
        coords: []
      };
    }
    if (f.geometry.type === 'LineString') {
      railGroups[name].coords.push(f.geometry.coordinates);
    } else if (f.geometry.type === 'MultiLineString') {
      railGroups[name].coords.push(...f.geometry.coordinates);
    }
  }

  // Métadonnées enrichies pour les trains
  const RAIL_METADATA = {
    'Ligne de la Maurienne': {
      ref: 'TER / TGV',
      mode: 'train',
      operator: 'SNCF Voyageurs / TER AURA',
      network: 'TER Auvergne-Rhône-Alpes',
      route: 'Chambéry ↔ Saint-Jean-de-Maurienne ↔ Modane',
      frequency: 'Toutes les heures (Liaisons TGV Paris-Milan & TER)',
      period: 'Toute l\'année',
      stops: ['Chambéry', 'Montmélian', 'Saint-Pierre-d\'Albigny', 'Aiguebelle', 'Épierre', 'Saint-Jean-de-Maurienne', 'Saint-Michel-de-Maurienne', 'Modane'],
      color: '#6366f1',
      url: 'https://www.ter.sncf.com/auvergne-rhone-alpes'
    },
    'Ligne de la Tarentaise': {
      ref: 'TER / TGV des Neiges',
      mode: 'train',
      operator: 'SNCF Voyageurs / TER AURA',
      network: 'TER Auvergne-Rhône-Alpes',
      route: 'Chambéry ↔ Albertville ↔ Moûtiers ↔ Bourg-Saint-Maurice',
      frequency: 'Liaisons régulières toute l\'année, renfort TGV/Eurostar en hiver',
      period: 'Toute l\'année',
      stops: ['Chambéry', 'Montmélian', 'Albertville', 'Notre-Dame-de-Briançon', 'Moûtiers-Salins-Brides-les-Bains', 'Aime-la-Plagne', 'Landry', 'Bourg-Saint-Maurice'],
      color: '#6366f1',
      url: 'https://www.ter.sncf.com/auvergne-rhone-alpes'
    },
    'Ligne de Veynes à Briançon': {
      ref: 'TER / Intercités Nuit',
      mode: 'train',
      operator: 'SNCF Voyageurs / TER PACA & AURA',
      network: 'Ligne du Val de Durance',
      route: 'Valence / Marseille ↔ Veynes ↔ Gap ↔ Embrun ↔ Briançon',
      frequency: 'Liaisons quotidiennes & Train de nuit direct Paris-Austerlitz',
      period: 'Toute l\'année',
      stops: ['Veynes-Dévoluy', 'Gap', 'Chorges', 'Embrun', 'Montdauphin-Guillestre', 'L\'Argentière-les-Écrins', 'Briançon'],
      color: '#6366f1',
      url: 'https://zou.maregionsud.fr'
    },
    'Ligne de Saint-Gervais-les-Bains-Le Fayet à Vallorcine (frontière)': {
      ref: 'Mont-Blanc Express',
      name: 'Ligne du Mont-Blanc Express : Le Fayet ↔ Chamonix ↔ Vallorcine ↔ Martigny',
      mode: 'train',
      operator: 'SNCF Voyageurs & TMR (Suisse)',
      network: 'Mont-Blanc Express',
      route: 'Saint-Gervais-Le Fayet ↔ Servoz ↔ Les Houches ↔ Chamonix ↔ Argentière ↔ Vallorcine ↔ Martigny',
      frequency: 'Toutes les heures (Train panoramique à crémaillère)',
      period: 'Toute l\'année (Gratuit dans la vallée avec carte d\'hôte)',
      stops: ['Saint-Gervais Le Fayet', 'Chedde', 'Servoz', 'Les Houches', 'Taconnaz', 'Les Bossons', 'Chamonix-Mont-Blanc', 'Les Praz', 'Argentière', 'Montroc', 'Vallorcine', 'Martigny (CH)'],
      color: '#3b82f6',
      url: 'https://www.sncf.com'
    },
    'Ligne de Lyon-Perrache à Marseille-Saint-Charles (via Grenoble)': {
      ref: 'TER / Ligne des Alpes',
      mode: 'train',
      operator: 'SNCF Voyageurs',
      network: 'Ligne des Alpes (Trièves & Buëch)',
      route: 'Grenoble ↔ Vif ↔ Monestier-de-Clermont ↔ Clelles-Mens ↔ Lus-la-Croix-Haute ↔ Veynes',
      frequency: 'Plusieurs allers-retours par jour (Ligne panoramique du Mont Aiguille)',
      period: 'Toute l\'année',
      stops: ['Grenoble', 'Pont-de-Claix', 'Vif', 'Monestier-de-Clermont', 'Clelles-Mens', 'Lus-la-Croix-Haute', 'Aspres-sur-Buëch', 'Veynes-Dévoluy'],
      color: '#6366f1',
      url: 'https://www.ter.sncf.com/auvergne-rhone-alpes'
    },
    'Ligne de Grenoble à Montmélian': {
      ref: 'TER Sillon Alpin',
      mode: 'train',
      operator: 'SNCF Voyageurs',
      network: 'TER Auvergne-Rhône-Alpes',
      route: 'Valence ↔ Grenoble ↔ Chambéry ↔ Annecy / Genève',
      frequency: 'Cadencement à la demi-heure aux heures de pointe',
      period: 'Toute l\'année',
      stops: ['Grenoble', 'Grenoble Universités Gières', 'Brignoud', 'Pontcharra-sur-Bréda', 'Montmélian', 'Chambéry'],
      color: '#6366f1',
      url: 'https://www.ter.sncf.com/auvergne-rhone-alpes'
    },
    'Ligne Saint-André-le-Gaz - Chambéry': {
      ref: 'TER / TGV',
      mode: 'train',
      operator: 'SNCF Voyageurs',
      network: 'Liaison Lyon ↔ Chambéry',
      route: 'Lyon-Part-Dieu ↔ Saint-André-le-Gaz ↔ Pont-de-Beauvoisin ↔ Chambéry',
      frequency: 'Liaisons directes fréquentes',
      period: 'Toute l\'année',
      stops: ['Saint-André-le-Gaz', 'Les Abrets', 'Pont-de-Beauvoisin', 'Lépin-le-Lac', 'Aiguebelette-le-Lac', 'Chambéry'],
      color: '#6366f1',
      url: 'https://www.ter.sncf.com/auvergne-rhone-alpes'
    },
    'Ligne La Roche sur Foron - Le Fayet': {
      ref: 'Léman Express / TER',
      mode: 'train',
      operator: 'SNCF Voyageurs / Léman Express',
      network: 'Léman Express L3',
      route: 'Genève / Annemasse ↔ La Roche-sur-Foron ↔ Bonneville ↔ Cluses ↔ Saint-Gervais Le Fayet',
      frequency: 'Toutes les heures',
      period: 'Toute l\'année',
      stops: ['La Roche-sur-Foron', 'Saint-Pierre-en-Faucigny', 'Bonneville', 'Marignier', 'Cluses', 'Magland', 'Sallanches', 'Saint-Gervais Le Fayet'],
      color: '#3b82f6',
      url: 'https://www.lemanexpress.ch'
    },
    'Ligne d\'Aix-les-Bains-Le Revard à Annemasse': {
      ref: 'TER / Léman Express',
      mode: 'train',
      operator: 'SNCF Voyageurs',
      network: 'Léman Express L2',
      route: 'Aix-les-Bains ↔ Annecy ↔ La Roche-sur-Foron ↔ Annemasse ↔ Genève',
      frequency: 'Toutes les 30 à 60 min',
      period: 'Toute l\'année',
      stops: ['Aix-les-Bains', 'Albens', 'Bloye', 'Rumilly', 'Annecy', 'Pringy', 'Groisy', 'La Roche-sur-Foron', 'Annemasse'],
      color: '#3b82f6',
      url: 'https://www.lemanexpress.ch'
    },
    'Train du Montenvers': {
      ref: 'Montenvers',
      name: 'Chemin de fer du Montenvers : Chamonix ↔ Mer de Glace (1913 m)',
      mode: 'mountain_train',
      operator: 'Compagnie du Mont-Blanc',
      network: 'Chemin de fer du Montenvers',
      route: 'Chamonix-Mont-Blanc (1042 m) ↔ Mer de Glace (1913 m)',
      frequency: 'Départs toutes les 20 à 30 min (Train panoramique à crémaillère)',
      period: 'Toute l\'année (Accès direct Mer de Glace, Glaciorium & Grotte de Glace)',
      stops: ['Gare du Montenvers Chamonix (1042 m)', 'Les Mottets', 'Hôtel du Montenvers & Mer de Glace (1913 m)'],
      color: '#ef4444',
      url: 'https://www.montblancnaturalresort.com'
    },
    'Tramway du Mont-Blanc': {
      ref: 'TMB',
      name: 'Tramway du Mont-Blanc (TMB) : Le Fayet ↔ Nid d\'Aigle (2372 m)',
      mode: 'mountain_train',
      operator: 'Compagnie du Mont-Blanc',
      network: 'Tramway du Mont-Blanc',
      route: 'Le Fayet (580 m) ↔ Saint-Gervais ↔ Col de Voza ↔ Bellevue ↔ Mont Lachat ↔ Nid d\'Aigle (2372 m)',
      frequency: 'Plusieurs trains par jour (Plus haut train à crémaillère de France)',
      period: 'Saisonnier Été & Hiver (Accès direct voie normale du Mont-Blanc & Refuge du Goûter)',
      stops: ['Le Fayet (580 m)', 'Saint-Gervais-les-Bains (820 m)', 'Motieu', 'Col de Voza (1653 m)', 'Bellevue (1794 m)', 'Mont Lachat (2115 m)', 'Nid d\'Aigle (2372 m)'],
      color: '#ef4444',
      url: 'https://www.montblancnaturalresort.com'
    },
    'Chemin de fer de la Mure': {
      ref: 'Train de La Mure',
      name: 'Petit Train de La Mure : Saint-Georges ↔ Monteynard',
      mode: 'mountain_train',
      operator: 'Edeis',
      network: 'Train Touristique des Alpes',
      route: 'La Mure ↔ Les Grands Balcons de Monteynard (Vue lac)',
      frequency: 'Circulations touristiques estivales',
      period: 'Avril à Novembre',
      stops: ['Gare de La Mure', 'Belvédère du Drac', 'Restaurant Panoramique du Paney', 'Monteynard'],
      color: '#ef4444',
      url: 'https://lepetittraindelamure.com'
    },
    'Ferrovia Cuneo-Ventimiglia': {
      ref: 'Train des Merveilles',
      name: 'Ligne de Tende / Train des Merveilles : Nice ↔ Breil ↔ Tende ↔ Cuneo',
      mode: 'train',
      operator: 'SNCF Voyageurs & Trenitalia',
      network: 'TER ZOU! / Trenitalia',
      route: 'Nice-Ville ↔ Sospel ↔ Breil-sur-Roya ↔ Saorge ↔ Fontan ↔ Saint-Dalmas-de-Tende ↔ Tende ↔ Cuneo (Italie)',
      frequency: 'Plusieurs liaisons quotidiennes (Ouvrage d\'art spectaculaire dans les gorges)',
      period: 'Toute l\'année (Accès direct Vallée des Merveilles & Mercantour)',
      stops: ['Nice-Ville', 'Drap-Cantaron', 'L\'Escarène', 'Sospel', 'Breil-sur-Roya', 'Fontan-Saorge', 'Saint-Dalmas-de-Tende', 'Tende', 'Vievola', 'Cuneo'],
      color: '#6366f1',
      url: 'https://zou.maregionsud.fr'
    }
  };

  for (const [name, g] of Object.entries(railGroups)) {
    const meta = RAIL_METADATA[name];
    if (!meta) continue; // On ne garde que les grandes lignes voyageurs nommées

    features.push({
      type: 'Feature',
      id: 'rail-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      properties: {
        id: 'rail-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: meta.name || name,
        ref: meta.ref || 'Train',
        mode: meta.mode || 'train',
        operator: meta.operator || g.operator,
        network: meta.network || 'Réseau Ferré',
        route: meta.route || name,
        frequency: meta.frequency || 'Quotidien',
        period: meta.period || 'Toute l\'année',
        stops: meta.stops || [],
        color: meta.color || '#6366f1',
        url: meta.url || 'https://www.sncf.com'
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: g.coords
      }
    });
  }

  console.log(`Ajouté ${features.length} lignes de train majeures.`);

  // Téléphériques majeurs emblématiques
  const CABLE_METADATA = {
    'TPH Plan de l\'Aiguille': {
      ref: 'Aiguille du Midi 1',
      name: 'Téléphérique de l\'Aiguille du Midi (Tronçon 1 : Chamonix ↔ Plan de l\'Aiguille 2317 m)',
      mode: 'cable_car',
      operator: 'Compagnie du Mont-Blanc',
      network: 'Mont-Blanc Natural Resort',
      route: 'Chamonix Centre (1035 m) ↔ Plan de l\'Aiguille (2317 m)',
      frequency: 'Toutes les 15 minutes',
      period: 'Toute l\'année (Accès direct départ sentier Grand Balcon Nord vers Montenvers)',
      stops: ['Gare Chamonix Aiguille du Midi (1035 m)', 'Plan de l\'Aiguille (2317 m, Refuge du Plan de l\'Aiguille)'],
      color: '#ec4899',
      url: 'https://www.montblancnaturalresort.com'
    },
    'TPH Aiguille du Midi': {
      ref: 'Aiguille du Midi 2',
      name: 'Téléphérique de l\'Aiguille du Midi (Tronçon 2 : Plan de l\'Aiguille ↔ Aiguille du Midi 3842 m)',
      mode: 'cable_car',
      operator: 'Compagnie du Mont-Blanc',
      network: 'Mont-Blanc Natural Resort',
      route: 'Plan de l\'Aiguille (2317 m) ↔ Aiguille du Midi (3842 m)',
      frequency: 'Toutes les 15 minutes',
      period: 'Toute l\'année (Plus haut téléphérique de France, accès Vallée Blanche & Refuge des Cosmiques)',
      stops: ['Plan de l\'Aiguille (2317 m)', 'Sommet Aiguille du Midi (3842 m, Terrasse Panoramique & Le Pas dans le Vide)'],
      color: '#ec4899',
      url: 'https://www.montblancnaturalresort.com'
    },
    'Glaciers de La Meije I': {
      ref: 'Meije 1',
      name: 'Téléphérique des Glaciers de La Meije (Tronçon 1 : La Grave ↔ Les Ruillans)',
      mode: 'cable_car',
      operator: 'Téléphériques de la Meije',
      network: 'Massif des Écrins',
      route: 'La Grave (1450 m) ↔ Peyrou d\'Amont (2400 m)',
      frequency: 'Continu',
      period: 'Été & Hiver (Accès direct haute montagne des Écrins, vue majestueuse sur La Meije)',
      stops: ['La Grave Village (1450 m)', 'Gare intermédiaire Peyrou d\'Amont (2400 m)'],
      color: '#ec4899',
      url: 'https://www.la-grave.com'
    },
    'Glaciers de La Meije II': {
      ref: 'Meije 2',
      name: 'Téléphérique des Glaciers de La Meije (Tronçon 2 : Peyrou d\'Amont ↔ Col des Ruillans 3211 m)',
      mode: 'cable_car',
      operator: 'Téléphériques de la Meije',
      network: 'Massif des Écrins',
      route: 'Peyrou d\'Amont (2400 m) ↔ Col des Ruillans (3211 m)',
      frequency: 'Continu',
      period: 'Été & Hiver (Accès direct glacier de la Girose, Grotte de Glace & Refuge Évariste Chancel)',
      stops: ['Peyrou d\'Amont (2400 m)', 'Col des Ruillans (3211 m, Belvédère des Glaciers)'],
      color: '#ec4899',
      url: 'https://www.la-grave.com'
    },
    'Flégère': {
      ref: 'Flégère',
      name: 'Télécabine de La Flégère : Les Praz (1060 m) ↔ La Flégère (1877 m)',
      mode: 'cable_car',
      operator: 'Compagnie du Mont-Blanc',
      network: 'Mont-Blanc Natural Resort',
      route: 'Les Praz de Chamonix ↔ La Flégère (1877 m)',
      frequency: 'Continu',
      period: 'Été & Hiver (Départ classique vers le Lac Blanc & Refuge du Lac Blanc)',
      stops: ['Les Praz de Chamonix (1060 m)', 'Gare de La Flégère (1877 m)'],
      color: '#ec4899',
      url: 'https://www.montblancnaturalresort.com'
    },
    'Vanoise Express 1': {
      ref: 'Vanoise Express',
      name: 'Téléphérique Vanoise Express : Peisey-Vallandry ↔ La Plagne',
      mode: 'cable_car',
      operator: 'Paradiski (ADS / SAP)',
      network: 'Paradiski',
      route: 'Plan-Peisey (1612 m) ↔ Montchavin-Les Coches (1560 m) en 4 minutes (plus grand téléphérique à 2 étages au monde)',
      frequency: 'Toutes les 10 min en saison',
      period: 'Été & Hiver',
      stops: ['Plan-Peisey (1612 m)', 'Montchavin (1560 m)'],
      color: '#ec4899',
      url: 'https://www.paradiski.com'
    },
    'Aiguille Rouge': {
      ref: 'Aiguille Rouge',
      name: 'Téléphérique de l\'Aiguille Rouge : Arc 2000 ↔ Sommet 3226 m',
      mode: 'cable_car',
      operator: 'ADS Les Arcs',
      network: 'Les Arcs Paradiski',
      route: 'Arc 2000 ↔ Sommet de l\'Aiguille Rouge (3226 m)',
      frequency: 'Continu',
      period: 'Été & Hiver (Passerelle panoramique à 3226 m & réserve naturelle des Hauts de Villaroger)',
      stops: ['Arc 2000', 'Sommet de l\'Aiguille Rouge (3226 m)'],
      color: '#ec4899',
      url: 'https://www.lesarcs.com'
    },
    'Bastille': {
      ref: 'Bulles Bastille',
      name: 'Téléphérique de Grenoble Bastille ("Les Bulles")',
      mode: 'cable_car',
      operator: 'Régie du Téléphérique de Grenoble',
      network: 'Transports Métropole Grenoble',
      route: 'Jardin de Ville (Bords de l\'Isère 214 m) ↔ Fort de la Bastille (475 m)',
      frequency: 'Continu',
      period: 'Toute l\'année (Accès belvédère de la Bastille & Massif de la Chartreuse)',
      stops: ['Grenoble Quai Stéphane Jay', 'Fort de la Bastille'],
      color: '#ec4899',
      url: 'https://www.bastille-grenoble.fr'
    },
    'Brévent': {
      ref: 'Brévent',
      name: 'Téléphérique du Brévent (Planpraz ↔ Le Brévent 2525 m)',
      mode: 'cable_car',
      operator: 'Compagnie du Mont-Blanc',
      network: 'Mont-Blanc Natural Resort',
      route: 'Planpraz (2000 m) ↔ Le Brévent (2525 m)',
      frequency: 'Continu',
      period: 'Été & Hiver (Vue panoramique face au Mont-Blanc & Refuges Bellachat, Moëde Anterne)',
      stops: ['Planpraz (2000 m)', 'Sommet du Brévent (2525 m)'],
      color: '#ec4899',
      url: 'https://www.montblancnaturalresort.com'
    },
    'Funiculaire Les Arcs\' Express': {
      ref: 'Arc-en-Ciel',
      name: 'Funiculaire Arc-en-Ciel : Bourg-Saint-Maurice ↔ Arc 1600',
      mode: 'funicular',
      operator: 'ADS Les Arcs',
      network: 'Les Arcs Paradiski',
      route: 'Bourg-Saint-Maurice (810 m) ↔ Arc 1600 (1620 m) en 7 minutes',
      frequency: 'Toutes les 20 min (Connexion directe quai de gare TGV)',
      period: 'Été & Hiver',
      stops: ['Gare TGV Bourg-Saint-Maurice (810 m)', 'Arc 1600 (1620 m)'],
      color: '#ec4899',
      url: 'https://www.lesarcs.com'
    },
    'Funiplagne Grande Rochette': {
      ref: 'Funiplagne',
      name: 'Funiplagne de la Grande Rochette : Plagne Centre ↔ Grande Rochette (2505 m)',
      mode: 'cable_car',
      operator: 'SAP La Plagne',
      network: 'La Plagne Paradiski',
      route: 'Plagne Centre (1970 m) ↔ Grande Rochette (2505 m)',
      frequency: 'Continu',
      period: 'Été & Hiver',
      stops: ['Plagne Centre (1970 m)', 'Sommet Grande Rochette (2505 m)'],
      color: '#ec4899',
      url: 'https://www.la-plagne.com'
    },
    'Cime Caron': {
      ref: 'TPH Caron',
      name: 'Téléphérique de la Cime Caron (Val Thorens 3200 m)',
      mode: 'cable_car',
      operator: 'SETAM Val Thorens',
      network: 'Les 3 Vallées',
      route: 'Plan Bouchet (2300 m) ↔ Cime Caron (3195 m)',
      frequency: 'Continu',
      period: 'Été & Hiver (Panorama à 360° sur les Alpes françaises, suisses et italiennes)',
      stops: ['Plan Bouchet (2300 m)', 'Cime Caron (3195 m)'],
      color: '#ec4899',
      url: 'https://www.valthorens.com'
    }
  };

  for (const f of rawData.features) {
    const name = f.properties?.name;
    if (name && CABLE_METADATA[name]) {
      const meta = CABLE_METADATA[name];
      features.push({
        type: 'Feature',
        id: 'cable-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        properties: {
          id: 'cable-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: meta.name,
          ref: meta.ref,
          mode: meta.mode,
          operator: meta.operator,
          network: meta.network,
          route: meta.route,
          frequency: meta.frequency,
          period: meta.period,
          stops: meta.stops,
          color: meta.color,
          url: meta.url
        },
        geometry: f.geometry
      });
      delete CABLE_METADATA[name]; // éviter les doublons
    }
  }

  // 2. Générer les lignes de Bus & Navettes via OSRM
  console.log(`Génération des tracés routiers précis pour ${BUS_ROUTES.length} lignes de bus et navettes...`);
  for (let i = 0; i < BUS_ROUTES.length; i++) {
    const routeDef = BUS_ROUTES[i];
    process.stdout.write(`[${i+1}/${BUS_ROUTES.length}] ${routeDef.ref} : ${routeDef.name.slice(0, 30)}... `);
    const coords = await fetchRoute(routeDef.coords);
    if (coords && coords.length > 0) {
      features.push({
        type: 'Feature',
        id: routeDef.id,
        properties: {
          id: routeDef.id,
          name: routeDef.name,
          ref: routeDef.ref,
          mode: routeDef.mode,
          operator: routeDef.operator,
          network: routeDef.network,
          route: routeDef.route,
          frequency: routeDef.frequency,
          period: routeDef.period,
          stops: routeDef.stops,
          color: routeDef.color,
          url: routeDef.url
        },
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      });
      console.log(`OK (${coords.length} points)`);
    } else {
      console.log('Fallback direct');
      // En cas de panne OSRM, fallback sur les waypoints directs
      const fallbackCoords = routeDef.coords.split(';').map(pt => pt.split(',').map(Number));
      features.push({
        type: 'Feature',
        id: routeDef.id,
        properties: {
          id: routeDef.id,
          name: routeDef.name,
          ref: routeDef.ref,
          mode: routeDef.mode,
          operator: routeDef.operator,
          network: routeDef.network,
          route: routeDef.route,
          frequency: routeDef.frequency,
          period: routeDef.period,
          stops: routeDef.stops,
          color: routeDef.color,
          url: routeDef.url
        },
        geometry: {
          type: 'LineString',
          coordinates: fallbackCoords
        }
      });
    }
    // Petit délai pour ménager l'API
    await new Promise(r => setTimeout(r, 120));
  }

  // 3. Ajouter les gares et pôles d'échange alpins
  console.log(`Ajout de ${STATIONS.length} gares et pôles de transport alpins...`);
  for (const st of STATIONS) {
    features.push({
      type: 'Feature',
      id: st.id,
      properties: {
        id: st.id,
        name: st.name,
        ref: 'Gare / Pôle',
        mode: st.mode,
        operator: 'SNCF Gares & Connexions / Pôle Alpin',
        network: 'Réseau Alpin',
        route: `Altitude : ${st.alt} m`,
        frequency: 'Correspondances régionales et vallées',
        period: 'Toute l\'année',
        alt: st.alt,
        stops: st.lines || [],
        color: '#3b82f6',
        url: 'https://www.garesetconnexions.sncf'
      },
      geometry: {
        type: 'Point',
        coordinates: [st.lng, st.lat]
      }
    });
  }

  const outputGeoJSON = {
    type: 'FeatureCollection',
    name: 'Transports_Des_Alpes',
    features
  };

  const outputPath = 'public/transport_alps_v2.geojson';
  fs.writeFileSync(outputPath, JSON.stringify(outputGeoJSON));
  const stats = fs.statSync(outputPath);
  console.log(`\nTERMINE ! Fichier généré avec succès dans ${outputPath}`);
  console.log(`Nombre total de fonctionnalités transport : ${features.length}`);
  console.log(`Taille du fichier optimisé : ${(stats.size / 1024).toFixed(1)} KB (vs 8300 KB auparavant)`);
}

main().catch(console.error);
