import fs from 'node:fs';

const datasetPath = 'public/transports_alpes.json';
const d = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

// Coordonnées exactes des gares TGV / Trenitalia
const STATIONS = {
  // Grandes métropoles extérieures
  paris_lyon: { name: 'Paris Gare de Lyon', lng: 2.373481, lat: 48.844945 },
  lille_europe: { name: 'Lille-Europe', lng: 3.0757, lat: 50.6389 },
  cdg_tgv: { name: 'Aéroport CDG 2 TGV', lng: 2.5708, lat: 49.0042 },
  marne_vallee: { name: 'Marne-la-Vallée Chessy TGV', lng: 2.7826, lat: 48.8703 },
  marseille_st_charles: { name: 'Marseille-Saint-Charles', lng: 5.380843, lat: 43.303283 },
  aix_tgv: { name: 'Aix-en-Provence TGV', lng: 5.445177, lat: 43.522763 },
  avignon_tgv: { name: 'Avignon TGV', lng: 4.805560, lat: 43.941707 },
  valence_tgv: { name: 'Valence TGV', lng: 4.978500, lat: 44.989700 },
  macon_tgv: { name: 'Mâcon-Loché TGV', lng: 4.783600, lat: 46.284200 },
  bourg_en_bresse: { name: 'Bourg-en-Bresse', lng: 5.214700, lat: 46.200500 },
  lyon_part_dieu: { name: 'Lyon Part-Dieu', lng: 4.859722, lat: 45.760000 },
  lyon_st_exupery: { name: 'Lyon Saint-Exupéry TGV', lng: 5.075834, lat: 45.721014 },
  turin_porta_susa: { name: 'Torino Porta Susa (Italie)', lng: 7.666389, lat: 45.073056 },
  milan_centrale: { name: 'Milano Centrale (Italie)', lng: 9.205479, lat: 45.487011 },
  oulx: { name: 'Oulx Cesana Claviere Sestriere (Italie)', lng: 6.819091, lat: 45.036032 },

  // Gares des Alpes
  bellegarde: { name: 'Bellegarde-sur-Valserine', lng: 5.827200, lat: 46.108500 },
  annemasse: { name: 'Annemasse', lng: 6.241500, lat: 46.193400 },
  cluses: { name: 'Cluses', lng: 6.577200, lat: 46.061700 },
  sallanches: { name: 'Sallanches - Combloux - Megève', lng: 6.633400, lat: 45.937900 },
  st_gervais_le_fayet: { name: 'Saint-Gervais-les-Bains-Le Fayet (Mont-Blanc)', lng: 6.702700, lat: 45.906100 },
  culoz: { name: 'Culoz', lng: 5.787800, lat: 45.845600 },
  aix_les_bains: { name: 'Aix-les-Bains - Le Revard', lng: 5.909371, lat: 45.688161 },
  annecy: { name: 'Annecy', lng: 6.121600, lat: 45.900400 },
  chambery: { name: 'Chambéry - Challes-les-Eaux', lng: 5.919547, lat: 45.571302 },
  bourgoin: { name: 'Bourgoin-Jallieu', lng: 5.275000, lat: 45.589000 },
  voiron: { name: 'Voiron', lng: 5.589000, lat: 45.367000 },
  grenoble: { name: 'Grenoble Gare Centrale', lng: 5.714548, lat: 45.191491 },
  st_jean_maurienne: { name: 'Saint-Jean-de-Maurienne - Arvan', lng: 6.354716, lat: 45.277542 },
  st_michel_valloire: { name: 'Saint-Michel - Valloire', lng: 6.471914, lat: 45.216916 },
  modane: { name: 'Modane (Haute-Maurienne)', lng: 6.659139, lat: 45.193555 },
  albertville: { name: 'Albertville', lng: 6.383167, lat: 45.672977 },
  moutiers: { name: 'Moûtiers - Salins - Brides-les-Bains (3 Vallées)', lng: 6.531399, lat: 45.486470 },
  aime: { name: 'Aime - La Plagne', lng: 6.648614, lat: 45.554387 },
  landry: { name: 'Landry (Peisey-Vallandry)', lng: 6.733849, lat: 45.574213 },
  bourg_st_maurice: { name: 'Bourg-Saint-Maurice (Les Arcs / Tignes / Val d\'Isère)', lng: 6.771273, lat: 45.619036 }
};

// Points de passage ferroviaires le long des LGV et corridors
const CORRIDORS = {
  // LGV Sud-Est Paris -> Lyon
  paris_to_lyon: [
    [2.373481, 48.844945],
    [2.4500, 48.7200],
    [2.7500, 48.3500],
    [3.2000, 47.9500],
    [4.0500, 47.3000],
    [4.7836, 46.2842], // Mâcon
    [4.8300, 45.8500],
    [4.859722, 45.760000] // Lyon Part-Dieu
  ],
  // Lyon Part-Dieu -> Saint-Exupéry TGV -> Chambéry
  lyon_to_chambery: [
    [4.859722, 45.760000],
    [5.075834, 45.721014], // St-Exupéry
    [5.2500, 45.6200],
    [5.5500, 45.5400], // Pont-de-Beauvoisin
    [5.7500, 45.5350], // Aiguebelette
    [5.919547, 45.571302] // Chambéry
  ],
  // Chambéry -> Bourg-Saint-Maurice (Tarentaise)
  chambery_to_tarentaise: [
    [5.919547, 45.571302],
    [6.0200, 45.5100], // Montmélian
    [6.1500, 45.5700],
    [6.383167, 45.672977], // Albertville
    [6.4500, 45.5600],
    [6.531399, 45.486470], // Moûtiers
    [6.648614, 45.554387], // Aime
    [6.733849, 45.574213], // Landry
    [6.771273, 45.619036] // Bourg-St-Maurice
  ],
  // Chambéry -> Modane -> Turin -> Milan (Maurienne)
  chambery_to_milan: [
    [5.919547, 45.571302],
    [6.0200, 45.5100], // Montmélian
    [6.2000, 45.4500],
    [6.354716, 45.277542], // St-Jean-de-Maurienne
    [6.471914, 45.216916], // St-Michel
    [6.659139, 45.193555], // Modane
    [6.819091, 45.036032], // Oulx (Tunnel du Fréjus)
    [7.1500, 45.1000],
    [7.666389, 45.073056], // Turin
    [8.4000, 45.3200],
    [9.205479, 45.487011] // Milan
  ],
  // Lyon -> Grenoble
  lyon_to_grenoble: [
    [5.075834, 45.721014], // St-Exupéry
    [5.275000, 45.589000], // Bourgoin
    [5.4500, 45.4800],
    [5.589000, 45.367000], // Voiron
    [5.6700, 45.2400],
    [5.714548, 45.191491] // Grenoble
  ],
  // Mâcon -> Annecy
  macon_to_annecy: [
    [4.783600, 46.284200], // Mâcon
    [5.214700, 46.200500], // Bourg-en-Bresse
    [5.5500, 45.9500],
    [5.787800, 45.845600], // Culoz
    [5.909371, 45.688161], // Aix-les-Bains
    [6.0500, 45.7800],
    [6.121600, 45.900400] // Annecy
  ],
  // Paris -> Bellegarde -> Saint-Gervais Le Fayet
  paris_to_st_gervais: [
    [2.373481, 48.844945],
    [3.5000, 47.7000],
    [4.7836, 46.2842],
    [5.3500, 46.2000],
    [5.827200, 46.108500], // Bellegarde
    [6.241500, 46.193400], // Annemasse
    [6.4000, 46.1100],
    [6.577200, 46.061700], // Cluses
    [6.633400, 45.937900], // Sallanches
    [6.702700, 45.906100] // St-Gervais
  ],
  // Marseille -> Valence TGV -> Grenoble
  marseille_to_grenoble: [
    [5.380843, 43.303283], // Marseille
    [5.445177, 43.522763], // Aix TGV
    [4.805560, 43.941707], // Avignon TGV
    [4.8800, 44.5000],
    [4.978500, 44.989700], // Valence TGV
    [5.3500, 45.1500],
    [5.714548, 45.191491] // Grenoble
  ]
};

const newTgvRoutes = [
  // 1. TRENITALIA FRECCIAROSSA PARIS ↔ LYON ↔ CHAMBÉRY ↔ MILAN
  {
    id: 'trenitalia-frecciarossa-paris-milan',
    ref: 'Frecciarossa',
    name: 'Trenitalia Frecciarossa : Paris Gare de Lyon ↔ Lyon ↔ Chambéry ↔ Modane ↔ Milan',
    mode: 'train',
    operator: 'Trenitalia France',
    network: 'Trenitalia - Frecciarossa 1000',
    route: 'Paris Gare de Lyon ↔ Lyon Part-Dieu ↔ Chambéry ↔ Saint-Jean-de-Maurienne ↔ Modane ↔ Turin ↔ Milan Centrale',
    frequency: 'Liaisons quotidiennes à grande vitesse',
    period: 'Toute l\'année',
    color: '#059669',
    stationKeys: ['paris_lyon', 'lyon_part_dieu', 'chambery', 'st_jean_maurienne', 'modane', 'oulx', 'turin_porta_susa', 'milan_centrale'],
    coordinates: [...CORRIDORS.paris_to_lyon, ...CORRIDORS.lyon_to_chambery.slice(1), ...CORRIDORS.chambery_to_milan.slice(1)],
    url: 'https://www.trenitalia.com'
  },

  // 2. TGV INOUI DES NEIGES : PARIS ↔ CHAMBÉRY ↔ MOÛTIERS ↔ BOURG-SAINT-MAURICE (TARENTAISE)
  {
    id: 'tgv-inoui-paris-tarentaise',
    ref: 'TGV INOUI',
    name: 'TGV INOUI des Neiges : Paris ↔ Chambéry ↔ Albertville ↔ Moûtiers ↔ Bourg-Saint-Maurice',
    mode: 'train',
    operator: 'SNCF Voyageurs',
    network: 'TGV INOUI - Tarentaise & Haute-Tarentaise',
    route: 'Paris Gare de Lyon ↔ Lyon Saint-Exupéry ↔ Chambéry ↔ Albertville ↔ Moûtiers ↔ Aime-la-Plagne ↔ Landry ↔ Bourg-Saint-Maurice',
    frequency: 'Liaisons directes quotidiennes (Renfort massif week-ends & hiver pour les stations)',
    period: 'Toute l\'année (Accès direct Val Thorens, Courchevel, Méribel, Les Arcs, Tignes, Val d\'Isère)',
    color: '#9d174d',
    stationKeys: ['paris_lyon', 'lyon_st_exupery', 'chambery', 'albertville', 'moutiers', 'aime', 'landry', 'bourg_st_maurice'],
    coordinates: [
      ...CORRIDORS.paris_to_lyon.slice(0, -1),
      [5.075834, 45.721014],
      ...CORRIDORS.lyon_to_chambery.slice(2),
      ...CORRIDORS.chambery_to_tarentaise.slice(1)
    ],
    url: 'https://www.sncf-connect.com'
  },

  // 3. TGV INOUI : PARIS ↔ GRENOBLE (CAPITALE DES ALPES)
  {
    id: 'tgv-inoui-paris-grenoble',
    ref: 'TGV INOUI',
    name: 'TGV INOUI : Paris Gare de Lyon ↔ Lyon Saint-Exupéry ↔ Grenoble',
    mode: 'train',
    operator: 'SNCF Voyageurs',
    network: 'TGV INOUI - Alpes & Isère',
    route: 'Paris Gare de Lyon ↔ Lyon Saint-Exupéry TGV ↔ Bourgoin-Jallieu ↔ Voiron ↔ Grenoble',
    frequency: 'Jusqu\'à 10 allers-retours directs par jour (Trajet en 3h00)',
    period: 'Toute l\'année (Accès direct Belledonne, Oisans, Vercors, Chartreuse)',
    color: '#7c3aed',
    stationKeys: ['paris_lyon', 'lyon_st_exupery', 'bourgoin', 'voiron', 'grenoble'],
    coordinates: [
      ...CORRIDORS.paris_to_lyon.slice(0, -1),
      [5.075834, 45.721014],
      ...CORRIDORS.lyon_to_grenoble
    ],
    url: 'https://www.sncf-connect.com'
  },

  // 4. TGV INOUI : PARIS ↔ ANNECY (SAVOIE & HAUTE-SAVOIE)
  {
    id: 'tgv-inoui-paris-annecy',
    ref: 'TGV INOUI',
    name: 'TGV INOUI : Paris Gare de Lyon ↔ Mâcon ↔ Aix-les-Bains ↔ Annecy',
    mode: 'train',
    operator: 'SNCF Voyageurs',
    network: 'TGV INOUI - Lac d\'Annecy & Aravis',
    route: 'Paris Gare de Lyon ↔ Mâcon-Loché TGV ↔ Bourg-en-Bresse ↔ Culoz ↔ Aix-les-Bains ↔ Annecy',
    frequency: 'Nombreuses liaisons directes quotidiennes (Trajet en 3h40)',
    period: 'Toute l\'année (Accès direct Lac d\'Annecy, La Clusaz, Le Grand-Bornand)',
    color: '#0284c7',
    stationKeys: ['paris_lyon', 'macon_tgv', 'bourg_en_bresse', 'culoz', 'aix_les_bains', 'annecy'],
    coordinates: [
      ...CORRIDORS.paris_to_lyon.slice(0, 6),
      ...CORRIDORS.macon_to_annecy
    ],
    url: 'https://www.sncf-connect.com'
  },

  // 5. TGV INOUI MONT-BLANC : PARIS ↔ BELLEGARDE ↔ CLUSES ↔ SAINT-GERVAIS LE FAYET
  {
    id: 'tgv-inoui-paris-mont-blanc',
    ref: 'TGV INOUI',
    name: 'TGV INOUI Mont-Blanc : Paris ↔ Bellegarde ↔ Cluses ↔ Saint-Gervais-les-Bains-Le Fayet',
    mode: 'train',
    operator: 'SNCF Voyageurs',
    network: 'TGV INOUI - Pays du Mont-Blanc & Chamonix',
    route: 'Paris Gare de Lyon ↔ Bellegarde ↔ Annemasse ↔ Cluses ↔ Sallanches ↔ Saint-Gervais-les-Bains-Le Fayet',
    frequency: 'Liaisons directes week-ends & renforts vacances (Accès Chamonix, Megève, Grand Massif)',
    period: 'Toute l\'année (Correspondance Mont-Blanc Express vers Chamonix)',
    color: '#0d9488',
    stationKeys: ['paris_lyon', 'bellegarde', 'annemasse', 'cluses', 'sallanches', 'st_gervais_le_fayet'],
    coordinates: CORRIDORS.paris_to_st_gervais,
    url: 'https://www.sncf-connect.com'
  },

  // 6. TGV INOUI MAURIENNE : PARIS ↔ CHAMBÉRY ↔ SAINT-JEAN-DE-MAURIENNE ↔ MODANE
  {
    id: 'tgv-inoui-paris-maurienne',
    ref: 'TGV INOUI',
    name: 'TGV INOUI Maurienne : Paris Gare de Lyon ↔ Chambéry ↔ Saint-Jean-de-Maurienne ↔ Modane',
    mode: 'train',
    operator: 'SNCF Voyageurs',
    network: 'TGV INOUI - Maurienne & Vanoise',
    route: 'Paris Gare de Lyon ↔ Lyon Saint-Exupéry ↔ Chambéry ↔ Saint-Jean-de-Maurienne ↔ Saint-Michel-Valloire ↔ Modane',
    frequency: 'Allers-retours quotidiens à grande vitesse',
    period: 'Toute l\'année (Accès Vanoise, Val Cenis, La Norma, Valfréjus, Valloire)',
    color: '#c026d3',
    stationKeys: ['paris_lyon', 'lyon_st_exupery', 'chambery', 'st_jean_maurienne', 'st_michel_valloire', 'modane'],
    coordinates: [
      ...CORRIDORS.paris_to_lyon.slice(0, -1),
      [5.075834, 45.721014],
      ...CORRIDORS.lyon_to_chambery.slice(2),
      ...CORRIDORS.chambery_to_milan.slice(1, 6)
    ],
    url: 'https://www.sncf-connect.com'
  },

  // 7. TGV INOUI MÉDITERRANÉE : MARSEILLE ↔ AIX TGV ↔ AVIGNON TGV ↔ VALENCE TGV ↔ GRENOBLE
  {
    id: 'tgv-inoui-mediterranee-grenoble',
    ref: 'TGV INOUI',
    name: 'TGV INOUI Méditerranée : Marseille ↔ Aix TGV ↔ Avignon TGV ↔ Valence TGV ↔ Grenoble',
    mode: 'train',
    operator: 'SNCF Voyageurs',
    network: 'TGV INOUI - Ligne Méditerranée & Sillon Alpin',
    route: 'Marseille-Saint-Charles ↔ Aix-en-Provence TGV ↔ Avignon TGV ↔ Valence TGV ↔ Grenoble',
    frequency: 'Liaisons quotidiennes reliant le littoral méditerranéen aux Alpes',
    period: 'Toute l\'année',
    color: '#ea580c',
    stationKeys: ['marseille_st_charles', 'aix_tgv', 'avignon_tgv', 'valence_tgv', 'grenoble'],
    coordinates: CORRIDORS.marseille_to_grenoble,
    url: 'https://www.sncf-connect.com'
  },

  // 8. TGV INOUI INTERSECTEURS : LILLE ↔ CDG 2 TGV ↔ LYON ↔ CHAMBÉRY ↔ BOURG-SAINT-MAURICE
  {
    id: 'tgv-inoui-lille-alpes',
    ref: 'TGV INOUI',
    name: 'TGV INOUI Intersecteurs : Lille ↔ Roissy CDG ↔ Lyon ↔ Chambéry ↔ Bourg-Saint-Maurice',
    mode: 'train',
    operator: 'SNCF Voyageurs',
    network: 'TGV INOUI - Nord & Île-de-France vers les Alpes',
    route: 'Lille-Europe ↔ Aéroport CDG 2 TGV ↔ Marne-la-Vallée Chessy ↔ Lyon Saint-Exupéry ↔ Chambéry ↔ Albertville ↔ Moûtiers ↔ Bourg-Saint-Maurice',
    frequency: 'Liaisons directes contournant Paris (très prisées en hiver)',
    period: 'Toute l\'année (Renfort hivernal stations de ski)',
    color: '#4338ca',
    stationKeys: ['lille_europe', 'cdg_tgv', 'marne_vallee', 'lyon_st_exupery', 'chambery', 'albertville', 'moutiers', 'aime', 'landry', 'bourg_st_maurice'],
    coordinates: [
      [3.0757, 50.6389], // Lille
      [2.5708, 49.0042], // CDG
      [2.7826, 48.8703], // Marne-la-Vallée
      [3.2000, 47.9500],
      [4.0500, 47.3000],
      [5.075834, 45.721014], // Lyon St-Exupéry
      ...CORRIDORS.lyon_to_chambery.slice(2),
      ...CORRIDORS.chambery_to_tarentaise.slice(1)
    ],
    url: 'https://www.sncf-connect.com'
  }
];

// Transformer en GeoJSON Features complètes conformes
const createdFeatures = newTgvRoutes.map((routeDef) => {
  const stops = routeDef.stationKeys.map((k) => STATIONS[k]?.name || k);
  const stopPoints = routeDef.stationKeys.map((k) => {
    const s = STATIONS[k];
    return {
      name: s.name,
      lng: s.lng,
      lat: s.lat
    };
  });

  const origin = stops[0];
  const dest = stops[stops.length - 1];

  const directions = [
    {
      id: 'aller',
      name: `Vers ${dest}`,
      origin,
      destination: dest,
      stops: [...stops],
      stopPoints: [...stopPoints],
      coordinates: routeDef.coordinates
    },
    {
      id: 'retour',
      name: `Vers ${origin}`,
      origin: dest,
      destination: origin,
      stops: [...stops].reverse(),
      stopPoints: [...stopPoints].reverse(),
      coordinates: [...routeDef.coordinates].reverse()
    }
  ];

  return {
    type: 'Feature',
    id: routeDef.id,
    geometry: {
      type: 'LineString',
      coordinates: routeDef.coordinates
    },
    properties: {
      id: routeDef.id,
      ref: routeDef.ref,
      name: routeDef.name,
      mode: 'train',
      operator: routeDef.operator,
      network: routeDef.network,
      route: routeDef.route,
      frequency: routeDef.frequency,
      period: routeDef.period,
      color: routeDef.color,
      offset: 0,
      stops,
      stopPoints,
      directions,
      isTGV: routeDef.ref === 'TGV INOUI',
      isTrenitalia: routeDef.ref === 'Frecciarossa',
      url: routeDef.url
    }
  };
});

// Supprimer d'anciennes versions éventuelles pour éviter tout doublon
const existingIds = new Set(createdFeatures.map((f) => f.id));
d.features = d.features.filter((f) => !existingIds.has(f.id) && !existingIds.has(f.properties?.id));

// Ajouter les 8 nouvelles grandes lignes TGV & Trenitalia
d.features.unshift(...createdFeatures);

console.log(`Ajouté ${createdFeatures.length} lignes TGV & Trenitalia à grande vitesse.`);
console.log(`Total features dans le dataset: ${d.features.length}`);

// Sauvegarder
fs.writeFileSync(datasetPath, JSON.stringify(d, null, 2), 'utf8');
if (fs.existsSync('public/transport_alps_v2.geojson')) {
  fs.writeFileSync('public/transport_alps_v2.geojson', JSON.stringify(d, null, 2), 'utf8');
}
console.log('Fichiers transports_alpes.json et transport_alps_v2.geojson mis à jour avec succès !');
