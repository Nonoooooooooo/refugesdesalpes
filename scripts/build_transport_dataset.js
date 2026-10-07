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
  {
    id: 'bus-s52',
    ref: 'S52',
    name: 'Ligne S52 : Modane ↔ Aussois ↔ La Norma',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Modane ↔ Fourneaux ↔ Villarodin-Bourget ↔ Aussois / La Norma',
    frequency: 'Quotidien',
    period: 'Toute l\'année',
    stops: ['Modane Gare TGV', 'Fourneaux', 'Villarodin', 'Aussois Village (Accès Portes de Vanoise)', 'La Norma'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.6710,45.2020;6.6970,45.2150;6.7410,45.2310'
  },
  {
    id: 'bus-s53',
    ref: 'S53',
    name: 'Ligne S53 : Modane ↔ Val Cenis ↔ Bonneval-sur-Arc',
    mode: 'bus',
    operator: 'Cars Région Savoie',
    network: 'Cars Région',
    route: 'Modane ↔ Bramans ↔ Termignon ↔ Lanslebourg ↔ Val Cenis ↔ Bessans ↔ Bonneval-sur-Arc',
    frequency: 'Plusieurs liaisons par jour (Accès Parc National de la Vanoise)',
    period: 'Toute l\'année',
    stops: ['Modane Gare', 'Bramans', 'Termignon', 'Lanslebourg', 'Bessans', 'Bonneval-sur-Arc (Départ refuges Carro, Évettes)'],
    color: '#10b981',
    url: 'https://www.laregionvoustransporte.fr',
    coords: '6.6710,45.2020;6.7820,45.2280;6.8830,45.2850;6.9940,45.3210;7.0470,45.3710'
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
  {
    id: 'navette-madame-carle',
    ref: 'Navette Écrins',
    name: 'Navette Écrins : L\'Argentière ↔ Vallouise ↔ Ailefroide ↔ Pré de Madame Carle',
    mode: 'navette',
    operator: 'Communauté de Communes du Pays des Écrins',
    network: 'Navettes Pays des Écrins',
    route: 'L\'Argentière Gare ↔ Vallouise ↔ Pelvoux ↔ Ailefroide ↔ Pré de Madame Carle (1874 m)',
    frequency: 'Plusieurs navettes par jour en saison estivale',
    period: 'Été (Accès direct cœur Massif des Écrins & Glaciers)',
    stops: ['L\'Argentière-les-Écrins Gare SNCF', 'Vallouise Maison du Parc', 'Pelvoux', 'Ailefroide Camping & Maison de la Montagne', 'Pré de Madame Carle (Départ refuges Glacier Blanc & Cézanne)'],
    color: '#f59e0b',
    url: 'https://www.paysdesecrins.com',
    coords: '6.5590,44.7930;6.4880,44.8460;6.4440,44.8870;6.4180,44.9180'
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
  }
];

const STATIONS = [
  { id: 'st-chamonix', name: 'Gare de Chamonix-Mont-Blanc', mode: 'station', alt: 1035, lat: 45.9237, lng: 6.8694, lines: ['Mont-Blanc Express', 'Chamonix Bus 1 & 2', 'Liaison Martigny (Suisse)'] },
  { id: 'st-le-fayet', name: 'Gare de Saint-Gervais-les-Bains-Le Fayet', mode: 'station', alt: 581, lat: 45.9080, lng: 6.7118, lines: ['TGV InOui', 'TER AURA', 'Mont-Blanc Express', 'Tramway du Mont-Blanc (TMB)'] },
  { id: 'st-grenoble', name: 'Gare de Grenoble', mode: 'station', alt: 212, lat: 45.1910, lng: 5.7140, lines: ['TGV InOui', 'TER Sillon Alpin', 'Ligne des Alpes', 'Cars Région T83/T84/T87/T88'] },
  { id: 'st-chambery', name: 'Gare de Chambéry - Challes-les-Eaux', mode: 'station', alt: 270, lat: 45.5714, lng: 5.9200, lines: ['TGV InOui / TGV Milan', 'TER Maurienne', 'TER Tarentaise', 'TER Annecy/Genève'] },
  { id: 'st-annecy', name: 'Gare d\'Annecy', mode: 'station', alt: 448, lat: 45.8992, lng: 6.1296, lines: ['TGV InOui', 'Léman Express', 'TER AURA', 'Cars Région Y51/Y62'] },
  { id: 'st-modane', name: 'Gare de Modane (Frontière Fr/It)', mode: 'station', alt: 1057, lat: 45.2020, lng: 6.6710, lines: ['TGV Paris-Milan', 'TER Maurienne', 'Cars Région S52/S53 (Val Cenis & Vanoise)'] },
  { id: 'st-bsm', name: 'Gare de Bourg-Saint-Maurice', mode: 'station', alt: 810, lat: 45.6180, lng: 6.7700, lines: ['TGV des Neiges / Eurostar', 'TER Tarentaise', 'Funiculaire Arc-en-Ciel', 'Cars Région S14/S15/S16'] },
  { id: 'st-moutiers', name: 'Gare de Moûtiers - Salins - Brides-les-Bains', mode: 'station', alt: 480, lat: 45.4836, lng: 6.5317, lines: ['TGV des Neiges', 'TER Tarentaise', 'Cars Région S10 (Courchevel)/S11 (Méribel)/S12 (Val Thorens)'] },
  { id: 'st-albertville', name: 'Gare d\'Albertville', mode: 'station', alt: 340, lat: 45.6756, lng: 6.3927, lines: ['TER Tarentaise', 'Cars Région Y51 (Annecy)'] },
  { id: 'st-briancon', name: 'Gare de Briançon (1204 m)', mode: 'station', alt: 1204, lat: 44.8980, lng: 6.6340, lines: ['Train de nuit Intercités Paris-Briançon', 'TER Val de Durance', 'TER Briançon-Marseille', 'ZOU! 54/55/57'] },
  { id: 'st-gap', name: 'Gare de Gap', mode: 'station', alt: 745, lat: 44.5630, lng: 6.0790, lines: ['TER Valence-Briançon', 'TER Marseille-Briançon', 'Ligne des Alpes', 'ZOU! 51/52'] },
  { id: 'st-veynes', name: 'Gare de Veynes - Dévoluy', mode: 'station', alt: 814, lat: 44.5330, lng: 5.8230, lines: ['Nœud ferroviaire alpin (Ligne des Alpes & Val de Durance)'] },
  { id: 'st-largentiere', name: 'Gare de L\'Argentière-les-Écrins', mode: 'station', alt: 976, lat: 44.7930, lng: 6.5590, lines: ['TER Briançon', 'Intercités Nuit', 'Navette Pré de Madame Carle (Écrins)'] },
  { id: 'st-montdauphin', name: 'Gare de Montdauphin - Guillestre', mode: 'station', alt: 900, lat: 44.6680, lng: 6.6490, lines: ['TER Briançon', 'Correspondances Queyras / Vars / Risoul'] },
  { id: 'st-nice', name: 'Gare de Nice-Ville', mode: 'station', alt: 16, lat: 43.7040, lng: 7.2620, lines: ['TGV Méditerranée', 'Train des Merveilles (Ligne de Tende)', 'Chemins de Fer de Provence (Digne)', 'ZOU! 91/92'] },
  { id: 'st-vallorcine', name: 'Gare de Vallorcine', mode: 'station', alt: 1260, lat: 46.0310, lng: 6.9320, lines: ['Mont-Blanc Express (Frontière Franco-Suisse)'] },
  { id: 'hub-madame-carle', name: 'Pôle Navettes Pré de Madame Carle', mode: 'station', alt: 1874, lat: 44.9180, lng: 6.4180, lines: ['Navette Écrins (Vallouise - Ailefroide - Madame Carle)', 'Départ direct refuges Glacier Blanc & Cézanne'] },
  { id: 'hub-pralognan', name: 'Pôle Navettes Pralognan-la-Vanoise', mode: 'station', alt: 1410, lat: 45.3800, lng: 6.7210, lines: ['Navette Parc Vanoise Les Prioux', 'Départ refuges Félix Faure, Péclet-Polset, Roc de la Pêche'] },
  { id: 'hub-berarde', name: 'Pôle Navettes La Bérarde (Écrins)', mode: 'station', alt: 1727, lat: 44.9330, lng: 6.2940, lines: ['Navette Oisans Saint-Christophe / Bourg-d\'Oisans', 'Départ refuges Promontoire, Châtelleret, Carrelet'] }
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
