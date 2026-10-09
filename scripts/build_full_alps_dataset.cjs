const fs = require('fs');
const path = require('path');
const { parseGenericGTFS, simplifyPolyline } = require('./build_unified_transport.cjs');

// Coordonnées exactes des gares et hubs alpins majeurs
const ALPINE_STATIONS = [
  { id: 'st-grenoble', name: 'Gare de Grenoble', ref: 'SNCF', lat: 45.191491, lng: 5.714548, alt: 212 },
  { id: 'st-chambery', name: 'Gare de Chambéry - Challes-les-Eaux', ref: 'SNCF', lat: 45.571302, lng: 5.919547, alt: 270 },
  { id: 'st-annecy', name: 'Gare d\'Annecy', ref: 'SNCF', lat: 45.900400, lng: 6.121600, alt: 448 },
  { id: 'st-bourg-st-maurice', name: 'Gare de Bourg-Saint-Maurice', ref: 'TGV / TER', lat: 45.619036, lng: 6.771273, alt: 840 },
  { id: 'st-moutiers', name: 'Gare de Moûtiers - Salins - Brides-les-Bains', ref: 'TGV / TER', lat: 45.486470, lng: 6.531399, alt: 480 },
  { id: 'st-albertville', name: 'Gare d\'Albertville', ref: 'SNCF', lat: 45.672977, lng: 6.383167, alt: 338 },
  { id: 'st-st-jean-maurienne', name: 'Gare de Saint-Jean-de-Maurienne - Arvan', ref: 'TGV / TER', lat: 45.277542, lng: 6.354716, alt: 566 },
  { id: 'st-modane', name: 'Gare Internationale de Modane', ref: 'TGV / TER / Frecciarossa', lat: 45.193555, lng: 6.659139, alt: 1057 },
  { id: 'st-st-gervais', name: 'Gare de Saint-Gervais-les-Bains-Le Fayet', ref: 'TGV / TER / TMB', lat: 45.906100, lng: 6.702700, alt: 580 },
  { id: 'st-chamonix', name: 'Gare de Chamonix-Mont-Blanc', ref: 'TER / Mont-Blanc Express', lat: 45.923889, lng: 6.873056, alt: 1035 },
  { id: 'st-briancon', name: 'Gare de Briançon (Serre Chevalier)', ref: 'SNCF', lat: 44.898611, lng: 6.634167, alt: 1205 },
  { id: 'st-gap', name: 'Gare de Gap', ref: 'SNCF', lat: 44.560278, lng: 6.086667, alt: 744 },
  { id: 'st-embrun', name: 'Gare d\'Embrun', ref: 'SNCF / TER', lat: 44.565800, lng: 6.495200, alt: 871 },
  { id: 'st-veynes', name: 'Gare de Veynes - Dévoluy', ref: 'SNCF / TER', lat: 44.531200, lng: 5.821300, alt: 814 },
  { id: 'st-digne', name: 'Gare de Digne-les-Bains', ref: 'SNCF / Train des Pignes', lat: 44.092800, lng: 6.229400, alt: 596 },
  { id: 'st-tende', name: 'Gare de Tende', ref: 'TER / Train des Merveilles', lat: 44.088300, lng: 7.593600, alt: 816 },
  { id: 'st-valence-tgv', name: 'Gare de Valence TGV (Porte des Alpes)', ref: 'TGV', lat: 44.989700, lng: 4.978500, alt: 160 },
  { id: 'st-aix-les-bains', name: 'Gare d\'Aix-les-Bains - Le Revard', ref: 'TGV / TER', lat: 45.688161, lng: 5.909371, alt: 244 },
  { id: 'st-bellegarde', name: 'Gare de Bellegarde-sur-Valserine', ref: 'TGV / TER', lat: 46.108500, lng: 5.827200, alt: 372 },
  { id: 'st-aime', name: 'Gare d\'Aime-la-Plagne', ref: 'TGV / TER', lat: 45.555000, lng: 6.650000, alt: 679 },
  { id: 'st-landry', name: 'Gare de Landry (Peisey-Vallandry)', ref: 'TGV / TER', lat: 45.570000, lng: 6.741000, alt: 745 },
  { id: 'st-bonneville', name: 'Gare de Bonneville', ref: 'Léman Express / TER', lat: 46.077000, lng: 6.409000, alt: 450 },
  { id: 'st-cluses', name: 'Gare de Cluses', ref: 'TGV / Léman Express', lat: 46.060000, lng: 6.581000, alt: 485 }
];

function haversineM(c1, c2) {
  const R = 6371000;
  const dLat = (c2[1] - c1[1]) * Math.PI / 180;
  const dLon = (c2[0] - c1[0]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1[1] * Math.PI / 180) * Math.cos(c2[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stitchMultiLine(parts) {
  let segments = parts.map(p => [...p]);
  if (segments.length === 0) return [];
  let bestStartIdx = 0;
  let minLon = 999;
  segments.forEach((seg, i) => {
    if (seg[0][0] < minLon) { minLon = seg[0][0]; bestStartIdx = i; }
  });

  let chain = [...segments.splice(bestStartIdx, 1)[0]];
  while (segments.length > 0) {
    const endPt = chain[chain.length - 1];
    let bestDist = Infinity;
    let bestIdx = -1;
    let bestReverse = false;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const dStart = haversineM(endPt, seg[0]);
      const dEnd = haversineM(endPt, seg[seg.length - 1]);
      if (dStart < bestDist) { bestDist = dStart; bestIdx = i; bestReverse = false; }
      if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; bestReverse = true; }
    }

    if (bestIdx >= 0 && bestDist < 600) {
      let seg = segments.splice(bestIdx, 1)[0];
      if (bestReverse) seg.reverse();
      chain.push(...seg);
    } else {
      break;
    }
  }
  return chain;
}

async function generateCompleteDataset() {
  console.log('=== DÉBUT DE LA GÉNÉRATION DU DATASET COMPLET DES TRANSPORTS ALPINS ===\n');
  const allFeatures = [];
  const registeredIds = new Set();

  function addFeature(f) {
    if (!f || !f.properties || !f.geometry) return;
    let id = f.properties.id || f.id;
    if (registeredIds.has(id)) {
      id = `${id}-${Math.floor(Math.random() * 1000)}`;
      f.properties.id = id;
    }
    registeredIds.add(id);
    allFeatures.push(f);
  }

  // 1. HAUTE-SAVOIE (Cars Région 74 - Lignes Yxx)
  const hsFeatures = await parseGenericGTFS('imports/haute_savoie', {
    idPrefix: 'bus-hs',
    network: 'Cars Région Haute-Savoie',
    operator: 'Cars Région Haute-Savoie',
    mode: 'bus',
    color: '#0284c7',
    frequency: 'Liaisons quotidiennes régulières',
    period: 'Toute l\'année (Renfort saisonnier)',
    url: 'https://www.laregionvoustransporte.fr'
  });
  hsFeatures.forEach(addFeature);

  // 2. SAVOIE (Cars Région 73 - Lignes Sxx)
  const savoieFeatures = await parseGenericGTFS('imports/savoie', {
    idPrefix: 'bus-savoie',
    network: 'Cars Région Savoie',
    operator: 'Cars Région Savoie',
    mode: 'bus',
    color: '#2563eb',
    frequency: 'Liaisons quotidiennes de vallée',
    period: 'Toute l\'année / Saisonnier',
    url: 'https://www.laregionvoustransporte.fr'
  });
  savoieFeatures.forEach(addFeature);

  // 3. ISÈRE (Cars Région 38 - Lignes de montagne Vercors, Chartreuse, Oisans, Matheysine, Belledonne)
  const isereAlpineRefs = new Set([
    'T40', 'T41', 'T42', 'T60', 'T62', 'T64', 'T65', 'T66',
    'T73', 'T75', 'T83', 'T87', 'T90', 'T91', 'T92', 'T95',
    'T50', 'T51', 'X08'
  ]);
  const isereFeatures = await parseGenericGTFS('scripts/gtfs_38', {
    idPrefix: 'bus-isere',
    network: 'Cars Région Isère',
    operator: 'Cars Région Isère (Transisère)',
    mode: 'bus',
    color: '#059669',
    frequency: 'Cadencement régulier & Navettes directes',
    period: 'Toute l\'année (Renfort hiver/été)',
    url: 'https://www.itinisere.fr',
    filterRoute: (r) => isereAlpineRefs.has(r.shortName)
  });
  isereFeatures.forEach(addFeature);

  // 4. CARS RÉGION EXPRESS (Lignes express interurbaines alpines)
  const creExcluded = new Set(['X76', 'X73', 'X18', 'X13', 'X25', 'X51', 'X71', 'X74', 'X75']);
  const creFeatures = await parseGenericGTFS('imports/cars_region_express', {
    idPrefix: 'cars-express',
    network: 'Cars Région Express',
    operator: 'Région Auvergne-Rhône-Alpes',
    mode: 'bus',
    color: '#0d9488',
    frequency: 'Lignes express cadencées',
    period: 'Toute l\'année',
    url: 'https://www.laregionvoustransporte.fr',
    filterRoute: (r) => !creExcluded.has(r.shortName.toUpperCase())
  });
  creFeatures.forEach(addFeature);

  // 5. STATIONS DE SKI & VALLÉES - NAVETTES & RÉSEAUX OFFICIELS (GTFS)
  const resortConfigs = [
    { dir: 'imports/courchevel', prefix: 'skibus-courchevel', network: 'Skibus Courchevel', operator: 'Courchevel Mobilités', color: '#f59e0b', mode: 'navette' },
    { dir: 'imports/belleville', prefix: 'skibus-belleville', network: 'Navettes Vallée des Belleville', operator: 'Transdev Belleville (St-Martin / Menuires / Val Thorens)', color: '#ea580c', mode: 'navette' },
    { dir: 'imports/meribus', prefix: 'navette-meribus', network: 'Méribus', operator: 'Transdev Savoie', color: '#d97706', mode: 'navette' },
    { dir: 'imports/deux_alpes', prefix: 'navette-2alpes', network: 'Navettes Les 2 Alpes', operator: 'Les 2 Alpes Mobilités', color: '#10b981', mode: 'navette' },
    { dir: 'imports/bourg_saint_maurice', prefix: 'navette-bsm', network: 'Navettes Bourg-Saint-Maurice / Arcs', operator: 'Bourg-Saint-Maurice Mobilités', color: '#06b6d4', mode: 'navette' },
    { dir: 'imports/funiculaire_arcs', prefix: 'funiculaire-arcs', network: 'Funiculaire des Arcs', operator: 'ADS (Arc 1600 ↔ Bourg-St-Maurice)', color: '#0284c7', mode: 'funicular' },
    { dir: 'imports/arlysere', prefix: 'bus-arlysere', network: 'TRA Mobilité (Arlysère / Albertville)', operator: 'Arlysère Mobilités', color: '#eab308', mode: 'bus' },
    { dir: 'imports/3cma', prefix: 'bus-3cma', network: '3CMA Bus Cœur de Maurienne (Saint-Jean)', operator: 'Cœur de Maurienne Arvan', color: '#06b6d4', mode: 'bus' }
  ];

  for (const rc of resortConfigs) {
    const rFeatures = await parseGenericGTFS(rc.dir, {
      idPrefix: rc.prefix,
      network: rc.network,
      operator: rc.operator,
      mode: rc.mode,
      color: rc.color,
      frequency: 'Départs toutes les 15 à 30 minutes',
      period: 'Saison hiver & été (Gratuit station)'
    });
    rFeatures.forEach(addFeature);
  }

  // 6. DROME ALPINE (Vercors / Diois / Baronnies)
  const dromeAlpineFilter = new Set(['D05', 'D20', 'D24', 'D25', 'D28', 'D29', 'D30', 'D33', 'D34', 'D36']);
  const dromeFeatures = await parseGenericGTFS('imports/drome', {
    idPrefix: 'bus-drome',
    network: 'Cars Région Drôme',
    operator: 'Cars Région Drôme',
    mode: 'bus',
    color: '#14b8a6',
    filterRoute: (r) => dromeAlpineFilter.has(r.shortName)
  });
  dromeFeatures.forEach(addFeature);

  // 6bis. ALPES DU SUD (05, 04, 06) - CARS RÉGION SUD ZOU !
  const zouAlpineFilter = new Set([
    '51', '55', '66', '68', '69', '71', '76', '49', 'P26'
  ]);
  const zouBusFeatures = await parseGenericGTFS('imports/zou_express', {
    idPrefix: 'zou-car',
    network: 'Cars Région Sud ZOU !',
    operator: 'Région Provence-Alpes-Côte d\'Azur',
    color: '#0284c7',
    mode: 'bus',
    frequency: 'Liaisons régionales & vallées alpines',
    period: 'Toute l\'année (Horaires officiels GTFS)',
    url: 'https://zou.maregionsud.fr',
    filterRoute: (r) => zouAlpineFilter.has((r.shortName || '').trim().toUpperCase())
  });
  zouBusFeatures.forEach(addFeature);

  // 6ter. ALPES DU SUD - TRAINS RÉGIONAUX TER ZOU !
  const terZouFilter = new Set(['K2', 'P4', 'P1', 'P25', 'P24', 'C2']);
  const terZouFeatures = await parseGenericGTFS('imports/ter_zou', {
    idPrefix: 'ter-zou',
    network: 'TER ZOU ! (SNCF / Région Sud)',
    operator: 'SNCF Voyageurs',
    color: '#6366f1',
    mode: 'train',
    frequency: 'Liaisons ferroviaires cadencées',
    period: 'Toute l\'année (Horaires officiels GTFS)',
    url: 'https://www.ter.sncf.com/sud-provence-alpes-cote-d-azur',
    filterRoute: (r) => terZouFilter.has((r.shortName || '').trim().toUpperCase())
  });
  terZouFeatures.forEach(addFeature);

  // 6quater. BRIANÇONNAIS & SERRE CHEVALIER - RÉSEAU ALTIGO
  const altigoShapes = fs.existsSync('scripts/data/altigo_osrm_routes.json')
    ? JSON.parse(fs.readFileSync('scripts/data/altigo_osrm_routes.json', 'utf8'))
    : {};
  const altigoFeatures = await parseGenericGTFS('imports/altigo', {
    idPrefix: 'bus-altigo',
    network: 'Réseau Altigo (Briançonnais)',
    operator: 'Communauté de Communes du Briançonnais',
    color: '#0284c7',
    mode: 'bus',
    customShapes: altigoShapes,
    frequency: 'Toutes les 15 à 30 minutes',
    period: 'Toute l\'année (Renfort hiver Serre Chevalier)',
    url: 'https://www.ccbrianconnais.fr'
  });
  altigoFeatures.forEach(addFeature);

  // 6quinquies. PARC DU QUEYRAS - NAVETTES SAISONNIÈRES
  const queyrasFeatures = await parseGenericGTFS('imports/queyras', {
    idPrefix: 'navette-queyras',
    network: 'Navettes du Queyras',
    operator: 'CC Guillestrois et du Queyras',
    color: '#ea580c',
    mode: 'navette',
    frequency: 'Navettes saisonnières régulières',
    period: 'Saison été & hiver',
    url: 'https://www.queyras-montagne.com'
  });
  queyrasFeatures.forEach(addFeature);

  // 6sexies. PAYS DES ÉCRINS - ESTIBUS
  const ecrinsFeatures = await parseGenericGTFS('imports/ecrins', {
    idPrefix: 'navette-ecrins',
    network: 'Estibus Pays des Écrins',
    operator: 'CC du Pays des Écrins',
    color: '#10b981',
    mode: 'navette',
    frequency: 'Navettes de vallée et accès aux refuges',
    period: 'Saison été (Juin à Septembre)',
    url: 'https://www.paysdesecrins.com'
  });
  ecrinsFeatures.forEach(addFeature);

  // 6septies. EMBRUN & SERRE-PONÇON - RÉSEAU VAÏ
  const embrunFeatures = await parseGenericGTFS('imports/embrun', {
    idPrefix: 'bus-embrun',
    network: 'Réseau Vaï (Embrun)',
    operator: 'CC Serre-Ponçon',
    color: '#06b6d4',
    mode: 'bus',
    frequency: 'Liaisons régulières',
    period: 'Toute l\'année'
  });
  embrunFeatures.forEach(addFeature);

  // 6septies-bis. HAUTES-ALPES & ÉCRINS - RÉSEAU ZOU ! PROXIMITÉ (05)
  if (fs.existsSync('imports/zou_proximite/routes.txt')) {
    const zou05Features = await parseGenericGTFS('imports/zou_proximite', {
      idPrefix: 'bus-zou-05',
      network: 'ZOU ! Proximité (Hautes-Alpes / Écrins)',
      operator: 'Région Sud Provence-Alpes-Côte d\'Azur',
      color: '#e47f0b',
      mode: 'bus',
      frequency: 'Liaisons régulières interurbaines et de montagne',
      period: 'Toute l\'année (Renfort été & hiver vers les vallées et massifs)',
      url: 'https://zou.maregionsud.fr',
      filterRoute: (r) => (r.id && r.id.startsWith('ZOP:5')) || (r.shortName && r.shortName.startsWith('5')) || r.id === 'ZOP:400' || r.id === 'ZOP:430'
    });
    zou05Features.forEach(addFeature);
  }

  // 6octies. ISÈRE - NAVETTES TRANSALTITUDE (Stations de l'Oisans, Vercors, Chartreuse, Belledonne)
  if (fs.existsSync('imports/transaltitude/routes.txt')) {
    const transaltitudeFeatures = await parseGenericGTFS('imports/transaltitude', {
      idPrefix: 'transaltitude',
      network: 'Transaltitude (Isère Ski)',
      operator: 'Isère Mobilités / Région AURA',
      color: '#059669',
      mode: 'bus',
      frequency: 'Liaisons directes gares ↔ stations',
      period: 'Saison hiver & été (Liaisons directes massifs)',
      url: 'https://www.transaltitude.fr'
    });
    transaltitudeFeatures.forEach(addFeature);
  }

  // 6nonies. MASSIF DES ARAVIS - RÉSEAU ARAVIS BUS (La Clusaz, Le Grand Bornand)
  if (fs.existsSync('imports/aravis/routes.txt')) {
    const aravisFeatures = await parseGenericGTFS('imports/aravis', {
      idPrefix: 'skibus-aravis',
      network: 'Aravis Bus (La Clusaz / Grand-Bornand)',
      operator: 'Aravis Mobilités',
      color: '#ea580c',
      mode: 'navette',
      frequency: 'Départs réguliers toutes les 15 à 30 min',
      period: 'Saison hiver & été',
      url: 'https://www.aravisbus.com'
    });
    aravisFeatures.forEach(addFeature);
  }

  // 6decies. VALLÉE DU GIFFRE & GRAND MASSIF - NAVETTES DU GIFFRE
  if (fs.existsSync('imports/giffre/routes.txt')) {
    const giffreFeatures = await parseGenericGTFS('imports/giffre', {
      idPrefix: 'navette-giffre',
      network: 'Navettes du Giffre (Grand Massif)',
      operator: 'CC des Montagnes du Giffre',
      color: '#0284c7',
      mode: 'navette',
      frequency: 'Liaisons régulières vallée et cirque',
      period: 'Saison hiver & été'
    });
    giffreFeatures.forEach(addFeature);
  }

  // 6undecies. LA ROSIÈRE 1850 - NAVETTES STATION
  if (fs.existsSync('imports/la_rosiere/routes.txt')) {
    const rosiereFeatures = await parseGenericGTFS('imports/la_rosiere', {
      idPrefix: 'navette-rosiere',
      network: 'Navettes La Rosière 1850',
      operator: 'La Rosière Mobilités',
      color: '#ec4899',
      mode: 'navette',
      frequency: 'Toutes les 20 à 30 min',
      period: 'Saison hiver & été'
    });
    rosiereFeatures.forEach(addFeature);
  }

  // 6duodecies. PORTES DU SOLEIL - CHABLAIS & AVORIAZ 1800
  const avoriazOsrm = fs.existsSync('scripts/data/morzine_avoriaz_osrm.json')
    ? JSON.parse(fs.readFileSync('scripts/data/morzine_avoriaz_osrm.json', 'utf8'))
    : {};

  // 1. Téléphérique 3S Prodains Express (Liaison officielle car-free d'Avoriaz 1800)
  addFeature({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [6.753364, 46.189763],
        [6.7590, 46.1903],
        [6.7660, 46.1911],
        [6.77450, 46.19185]
      ]
    },
    properties: {
      id: 'cable-prodains-express',
      ref: '3S Prodains',
      name: 'Téléphérique 3S Prodains Express : Les Prodains ↔ Avoriaz 1800',
      mode: 'cable_car',
      operator: 'SERMA Avoriaz / Portes du Soleil',
      network: 'Avoriaz 1800 Mobilités',
      route: 'Les Prodains (1180 m) ↔ Avoriaz 1800 (1795 m, Place Jean Vuarnet)',
      frequency: 'En continu toutes les 4 min (trajet 4 min chrono)',
      period: 'Saison hiver & été (Accès principal piétons & bagages à la station piétonne)',
      color: '#ec4899',
      stops: ['Les Prodains (Gare Téléphérique 1180 m)', 'Avoriaz 1800 (Place Jean Vuarnet 1795 m)'],
      stopPoints: [
        { name: 'Les Prodains (Gare Téléphérique 1180 m)', lng: 6.753364, lat: 46.189763 },
        { name: 'Avoriaz 1800 (Place Jean Vuarnet 1795 m)', lng: 6.77450, lat: 46.19185 }
      ]
    }
  });

  // 2. Navette Morzine ↔ Les Prodains Express (Ligne A)
  if (avoriazOsrm.morzine_prodains) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(avoriazOsrm.morzine_prodains, 1.5)
      },
      properties: {
        id: 'navette-morzine-prodains',
        ref: 'Navette A',
        name: 'Navette Morzine : Centre / Pléney ↔ Téléphérique Prodains (Avoriaz)',
        mode: 'navette',
        operator: 'Morzine Mobilités',
        network: 'Navettes Morzine-Avoriaz',
        route: 'Morzine Pléney ↔ Office de Tourisme ↔ Pied de la Plagne ↔ Les Prodains',
        frequency: 'Toutes les 10 à 15 minutes (Gratuit)',
        period: 'Saison hiver & été (Liaison officielle pour monter à Avoriaz)',
        color: '#ea580c',
        stops: ['Morzine Pléney / Mairie', 'Office de Tourisme', 'Pied de la Plagne', 'Les Prodains (Téléphérique 3S Avoriaz 1800)'],
        stopPoints: [
          { name: 'Morzine Pléney / Mairie', lng: 6.7083, lat: 46.1793 },
          { name: 'Office de Tourisme', lng: 6.7095, lat: 46.1788 },
          { name: 'Pied de la Plagne', lng: 6.7320, lat: 46.1840 },
          { name: 'Les Prodains (Téléphérique 3S Avoriaz 1800)', lng: 6.753364, lat: 46.189763 }
        ]
      }
    });
  }

  // 3. Liaison Routière D338 Morzine ↔ Col de la Joux Verte ↔ Avoriaz 1800 (Accueil)
  if (avoriazOsrm.morzine_avoriaz_road) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(avoriazOsrm.morzine_avoriaz_road, 2)
      },
      properties: {
        id: 'route-morzine-avoriaz',
        ref: 'D338 Avoriaz',
        name: 'Liaison D338 : Morzine ↔ Col de la Joux Verte ↔ Avoriaz 1800',
        mode: 'bus',
        operator: 'Portes du Soleil Mobilité',
        network: 'Réseau Morzine-Avoriaz',
        route: 'Morzine Centre ↔ Les Meuniers ↔ Col de la Joux Verte (1760 m) ↔ Avoriaz 1800 (Gare d\'Accueil)',
        frequency: 'Liaisons régulières en saison',
        period: 'Toute l\'année (Accès routier et livraison station)',
        color: '#8b5cf6',
        stops: ['Morzine Centre', 'Les Meuniers', 'Col de la Joux Verte (1760 m)', 'Avoriaz 1800 (Gare d\'Accueil)'],
        stopPoints: [
          { name: 'Morzine Centre', lng: 6.7083, lat: 46.1793 },
          { name: 'Les Meuniers', lng: 6.7280, lat: 46.2010 },
          { name: 'Col de la Joux Verte (1760 m)', lng: 6.7550, lat: 46.2005 },
          { name: 'Avoriaz 1800 (Gare d\'Accueil)', lng: 6.7725, lat: 46.1935 }
        ]
      }
    });
  }

  // 4. Navette M : Morzine ↔ Lac de Montriond ↔ Ardent Télécabine vers Avoriaz
  if (avoriazOsrm.morzine_ardent) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(avoriazOsrm.morzine_ardent, 1.5)
      },
      properties: {
        id: 'navette-morzine-ardent',
        ref: 'Ligne M',
        name: 'Navette Morzine : Pléney ↔ Lac de Montriond ↔ Ardent Télécabine (Avoriaz)',
        mode: 'navette',
        operator: 'Morzine Mobilités',
        network: 'Navettes Morzine-Avoriaz',
        route: 'Morzine Pléney ↔ Montriond Village ↔ Lac de Montriond ↔ Ardent Télécabine',
        frequency: 'Toutes les 30 min (Gratuit)',
        period: 'Saison hiver & été',
        color: '#0284c7',
        stops: ['Morzine Pléney', 'Montriond Chef-lieu', 'Lac de Montriond', 'Ardent Télécabine (Accès Lindarets & Avoriaz)'],
        stopPoints: [
          { name: 'Morzine Pléney', lng: 6.7083, lat: 46.1793 },
          { name: 'Montriond Chef-lieu', lng: 6.6944, lat: 46.1968 },
          { name: 'Lac de Montriond', lng: 6.7300, lat: 46.2050 },
          { name: 'Ardent Télécabine (Accès Lindarets & Avoriaz)', lng: 6.7445, lat: 46.2160 }
        ]
      }
    });
  }

  // 5. Télécabine d'Ardent (Ardent ↔ Les Lindarets ↔ Avoriaz)
  addFeature({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [6.7445, 46.2160],
        [6.7620, 46.2110],
        [6.7680, 46.2080],
        [6.7745, 46.1950]
      ]
    },
    properties: {
      id: 'cable-ardent-lindarets-avoriaz',
      ref: 'Télécabine Ardent',
      name: 'Télécabine d\'Ardent : Lac de Montriond ↔ Les Lindarets ↔ Avoriaz',
      mode: 'cable_car',
      operator: 'SERMA / Portes du Soleil',
      network: 'Avoriaz 1800',
      route: 'Ardent (1210 m) ↔ Village des Lindarets (1467 m) ↔ Crête d\'Avoriaz (1800 m)',
      frequency: 'En continu (Liaison piétons & skieurs)',
      period: 'Saison hiver & été',
      color: '#06b6d4',
      stops: ['Ardent Gare Aval (1210 m)', 'Les Lindarets Village des Chèvres (1467 m)', 'Avoriaz Crête (1800 m)'],
      stopPoints: [
        { name: 'Ardent Gare Aval (1210 m)', lng: 6.7445, lat: 46.2160 },
        { name: 'Les Lindarets Village des Chèvres (1467 m)', lng: 6.7680, lat: 46.2080 },
        { name: 'Avoriaz Crête (1800 m)', lng: 6.7745, lat: 46.1950 }
      ]
    }
  });

  // 6. Navette E : Morzine ↔ Téléphérique de Nyon ↔ Lac des Mines d'Or
  addFeature({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [6.7083, 46.1793],
        [6.7200, 46.1650],
        [6.7380, 46.1480],
        [6.7620, 46.1340]
      ]
    },
    properties: {
      id: 'navette-morzine-nyon-mines',
      ref: 'Ligne E',
      name: 'Navette Vallée de la Manche : Morzine ↔ Nyon ↔ Lac des Mines d\'Or',
      mode: 'navette',
      operator: 'Morzine Mobilités',
      network: 'Navettes Morzine-Avoriaz',
      route: 'Morzine Pléney ↔ Téléphérique de Nyon ↔ L\'Érigné ↔ Lac des Mines d\'Or',
      frequency: 'Toutes les 30 min (Gratuit)',
      period: 'Saison été & hiver (Accès randonnées Hauts-Forts & Terres Maudites)',
      color: '#ea580c',
      stops: ['Morzine Pléney', 'Téléphérique de Nyon', 'L\'Érigné', 'Lac des Mines d\'Or (1390 m)'],
      stopPoints: [
        { name: 'Morzine Pléney', lng: 6.7083, lat: 46.1793 },
        { name: 'Téléphérique de Nyon', lng: 6.7200, lat: 46.1650 },
        { name: 'L\'Érigné', lng: 6.7380, lat: 46.1480 },
        { name: 'Lac des Mines d\'Or (1390 m)', lng: 6.7620, lat: 46.1340 }
      ]
    }
  });

  // 6tredecies. QUEYRAS - NAVETTE REFUGE AGNEL & COL AGNEL (2744 m) - CORRECTION PRÉCISION GPS
  if (avoriazOsrm.queyras_saint_veran_agnel) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(avoriazOsrm.queyras_saint_veran_agnel, 1.5)
      },
      properties: {
        id: 'navette-queyras-saint-veran',
        ref: 'Navette Agnel',
        name: 'Navette Queyras : Guillestre ↔ Molines ↔ Saint-Véran ↔ Refuge Agnel ↔ Col Agnel (2744 m)',
        mode: 'navette',
        operator: 'Communauté de Communes du Guillestrois et du Queyras',
        network: 'Navettes du Queyras',
        route: 'Guillestre Gare Routière ↔ Château-Queyras ↔ Molines ↔ Saint-Véran (2040 m) ↔ Refuge Agnel (2580 m) ↔ Col Agnel (2744 m)',
        frequency: 'Navettes estivales régulières',
        period: 'Saison été (Accès plus haute commune habitée d\'Europe & Col Agnel 2744 m)',
        color: '#f59e0b',
        stops: [
          'Guillestre Gare Routière',
          'Château-Queyras',
          'Molines-en-Queyras',
          'Saint-Véran (2040 m, Musée du Soum & cadran solaire)',
          'Refuge Agnel (2580 m)',
          'Col Agnel (2744 m, 2e plus haut col routier des Alpes)'
        ],
        stopPoints: [
          { name: 'Guillestre Gare Routière', lng: 6.649386, lat: 44.667024 },
          { name: 'Château-Queyras', lng: 6.7865, lat: 44.7554 },
          { name: 'Molines-en-Queyras', lng: 6.8407, lat: 44.7303 },
          { name: 'Saint-Véran (2040 m, Musée du Soum & cadran solaire)', lng: 6.8643, lat: 44.7001 },
          { name: 'Refuge Agnel (2580 m)', lng: 6.97812, lat: 44.69338 },
          { name: 'Col Agnel (2744 m, 2e plus haut col routier des Alpes)', lng: 6.98820, lat: 44.67912 }
        ]
      }
    });
  }

  // 6quaterdecies. TRAIN INTERCITÉS DE NUIT PARIS ↔ BRIANÇON
  const terZouP4 = terZouFeatures.find(f => f.properties.ref === 'P4' || f.properties.id === 'ter-zou-p4');
  const brianconRailCoords = terZouP4?.geometry?.coordinates || [];
  if (brianconRailCoords.length > 10) {
    // Raccord ferroviaire Paris Gare d'Austerlitz jusqu'à Valence Ville
    const parisToValenceTrack = [
      [2.3662, 48.8411], // Paris Austerlitz
      [2.4500, 48.7000],
      [3.1000, 48.1000],
      [4.0000, 47.4000],
      [4.8000, 46.3000],
      [4.8300, 45.7500], // Lyon Perrache
      [4.8900, 44.9300]  // Valence Ville
    ];
    const fullNightTrainCoords = [...parisToValenceTrack, ...brianconRailCoords];
    if (brianconRailCoords.length > 0) {
      fullNightTrainCoords.push([6.634167, 44.898611]);
    }
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(fullNightTrainCoords, 2)
      },
      properties: {
        id: 'train-intercites-nuit-paris-briancon',
        ref: 'Intercités Nuit',
        name: 'Intercités de Nuit : Paris-Austerlitz ↔ Gap ↔ Briançon (Serre Chevalier)',
        mode: 'train',
        operator: 'SNCF Voyageurs',
        network: 'SNCF Intercités de Nuit',
        route: 'Paris-Austerlitz ↔ Crest ↔ Die ↔ Luc-en-Diois ↔ Veynes-Dévoluy ↔ Gap ↔ Chorges ↔ Embrun ↔ Montdauphin-Guillestre ↔ L\'Argentière-les-Écrins ↔ Briançon',
        frequency: '1 train de nuit quotidien par sens (Voitures-couchettes 1ère & 2nde classe)',
        period: 'Toute l\'année (Train mythique reliant la capitale au cœur des Alpes)',
        color: '#1e3a8a',
        stops: [
          'Paris-Austerlitz',
          'Crest',
          'Die',
          'Luc-en-Diois',
          'Veynes - Dévoluy',
          'Gap',
          'Chorges',
          'Embrun',
          'Montdauphin - Guillestre',
          'L\'Argentière-les-Écrins',
          'Briançon'
        ],
        stopPoints: [
          { name: 'Paris-Austerlitz', lng: 2.3662, lat: 48.8411 },
          { name: 'Crest', lng: 5.0233, lat: 44.7303 },
          { name: 'Die', lng: 5.3708, lat: 44.7574 },
          { name: 'Luc-en-Diois', lng: 5.4542, lat: 44.6158 },
          { name: 'Veynes - Dévoluy', lng: 5.8213, lat: 44.5312 },
          { name: 'Gap', lng: 6.0867, lat: 44.5603 },
          { name: 'Chorges', lng: 6.2778, lat: 44.5447 },
          { name: 'Embrun', lng: 6.4952, lat: 44.5658 },
          { name: 'Montdauphin - Guillestre', lng: 6.6083, lat: 44.6694 },
          { name: 'L\'Argentière-les-Écrins', lng: 6.5572, lat: 44.7936 },
          { name: 'Briançon', lng: 6.6342, lat: 44.8986 }
        ]
      }
    });
  }

  // 6quindecies. MAURIENNE & HAUTE MAURIENNE VANOISE (Modane, Val Cenis, Valfréjus, La Norma, Aussois, Bessans, Bonneval, Orgère, Bardonecchia, TER Maurienne)
  const modaneOsrm = fs.existsSync('scripts/data/modane_maurienne_osrm.json')
    ? JSON.parse(fs.readFileSync('scripts/data/modane_maurienne_osrm.json', 'utf8'))
    : {};

  // 1. TER Maurienne : Chambéry ↔ Saint-Jean-de-Maurienne ↔ Modane
  if (modaneOsrm.ter_maurienne) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(modaneOsrm.ter_maurienne, 2)
      },
      properties: {
        id: 'ter-maurienne-chambery-modane',
        ref: 'TER Maurienne',
        name: 'TER Maurienne : Chambéry ↔ Saint-Jean-de-Maurienne ↔ Modane',
        mode: 'train',
        operator: 'SNCF Voyageurs / TER Auvergne-Rhône-Alpes',
        network: 'TER Auvergne-Rhône-Alpes',
        route: 'Chambéry ↔ Montmélian ↔ Saint-Pierre-d\'Albigny ↔ Aiguebelle ↔ Épierre ↔ Saint-Jean-de-Maurienne ↔ Saint-Michel-de-Maurienne ↔ Modane',
        frequency: 'Liaisons ferroviaires quotidiennes cadencées',
        period: 'Toute l\'année (Axe ferroviaire transalpin)',
        color: '#6366f1',
        stops: ['Chambéry', 'Montmélian', 'Saint-Pierre-d\'Albigny', 'Aiguebelle', 'Épierre - Saint-Alban-des-Hurtières', 'Saint-Jean-de-Maurienne - Arvan', 'Saint-Michel - Valloire', 'Modane'],
        stopPoints: [
          { name: 'Chambéry', lng: 5.9195, lat: 45.5713 },
          { name: 'Montmélian', lng: 6.0594, lat: 45.5019 },
          { name: 'Saint-Pierre-d\'Albigny', lng: 6.1472, lat: 45.5711 },
          { name: 'Aiguebelle', lng: 6.3069, lat: 45.5428 },
          { name: 'Épierre - Saint-Alban-des-Hurtières', lng: 6.2941, lat: 45.4541 },
          { name: 'Saint-Jean-de-Maurienne - Arvan', lng: 6.3547, lat: 45.2775 },
          { name: 'Saint-Michel - Valloire', lng: 6.4719, lat: 45.2181 },
          { name: 'Modane', lng: 6.65914, lat: 45.19356 }
        ]
      }
    });
  }

  // 2. Lignes S52 / S53 : Modane ↔ Aussois ↔ Val Cenis ↔ Bessans ↔ Bonneval-sur-Arc
  if (modaneOsrm.modane_valcenis_bonneval) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(modaneOsrm.modane_valcenis_bonneval, 1.5)
      },
      properties: {
        id: 'bus-savoie-s52-s53',
        ref: 'S52 / S53',
        name: 'Lignes S52-S53 : Modane ↔ Aussois ↔ Val Cenis ↔ Bessans ↔ Bonneval-sur-Arc',
        mode: 'bus',
        operator: 'Cars Région Savoie / Haute Maurienne Vanoise',
        network: 'Haute Maurienne Vanoise',
        route: 'Modane Gare Routière ↔ Aussois ↔ Bramans ↔ Termignon ↔ Lanslebourg ↔ Lanslevillard ↔ Bessans ↔ Bonneval-sur-Arc (1800 m)',
        frequency: 'Tous les jours en été & hiver (Correspondances TGV & TER en gare de Modane)',
        period: 'Toute l\'année (Liaison maîtresse de Haute-Maurienne)',
        color: '#f59e0b',
        stops: [
          'Modane Gare Routière (SNCF / TGV)',
          'Modane Ville',
          'Aussois Centre (Maison d\'Aussois)',
          'Bramans Le Petit Paris',
          'Sollières Mairie',
          'Termignon Maison de la Vanoise',
          'Val Cenis Lanslebourg (Auditorium)',
          'Val Cenis Lanslevillard (Office de Tourisme)',
          'Bessans Mairie',
          'Bonneval-sur-Arc Village (1800 m)'
        ],
        stopPoints: [
          { name: 'Modane Gare Routière (SNCF / TGV)', lng: 6.65914, lat: 45.19356 },
          { name: 'Modane Ville', lng: 6.6732, lat: 45.2016 },
          { name: 'Aussois Centre (Maison d\'Aussois)', lng: 6.7422, lat: 45.2312 },
          { name: 'Bramans Le Petit Paris', lng: 6.7765, lat: 45.2255 },
          { name: 'Sollières Mairie', lng: 6.8122, lat: 45.2635 },
          { name: 'Termignon Maison de la Vanoise', lng: 6.8145, lat: 45.2785 },
          { name: 'Val Cenis Lanslebourg (Auditorium)', lng: 6.8778, lat: 45.2848 },
          { name: 'Val Cenis Lanslevillard (Office de Tourisme)', lng: 6.9125, lat: 45.2904 },
          { name: 'Bessans Mairie', lng: 6.9942, lat: 45.3208 },
          { name: 'Bonneval-sur-Arc Village (1800 m)', lng: 7.0475, lat: 45.3712 }
        ]
      }
    });
  }

  // 3. Ligne S50 : Modane Gare ↔ Valfréjus (1550 m)
  if (modaneOsrm.modane_valfrejus) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(modaneOsrm.modane_valfrejus, 1.5)
      },
      properties: {
        id: 'bus-savoie-s50-valfrejus',
        ref: 'Ligne S50',
        name: 'Ligne S50 : Modane Gare ↔ Valfréjus (1550 m)',
        mode: 'bus',
        operator: 'Cars Région Savoie / HMV',
        network: 'Haute Maurienne Vanoise',
        route: 'Modane Gare Routière / SNCF ↔ Fourneaux ↔ Valfréjus Office de Tourisme (1550 m)',
        frequency: 'Liaisons quotidiennes régulières en saison',
        period: 'Saison hiver & été (Accès station & Massif du Thabor)',
        color: '#3b82f6',
        stops: ['Modane Gare Routière (SNCF / TGV)', 'Fourneaux (Charmaix)', 'Valfréjus Office de Tourisme (1550 m)'],
        stopPoints: [
          { name: 'Modane Gare Routière (SNCF / TGV)', lng: 6.65914, lat: 45.19356 },
          { name: 'Fourneaux (Charmaix)', lng: 6.6586, lat: 45.1856 },
          { name: 'Valfréjus Office de Tourisme (1550 m)', lng: 6.6558, lat: 45.1745 }
        ]
      }
    });
  }

  // 4. Ligne S51 : Modane Gare ↔ La Norma (1350 m)
  if (modaneOsrm.modane_lanorma) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(modaneOsrm.modane_lanorma, 1.5)
      },
      properties: {
        id: 'bus-savoie-s51-lanorma',
        ref: 'Ligne S51',
        name: 'Ligne S51 : Modane Gare ↔ La Norma (1350 m)',
        mode: 'bus',
        operator: 'Cars Région Savoie / HMV',
        network: 'Haute Maurienne Vanoise',
        route: 'Modane Gare Routière / SNCF ↔ Villarodin ↔ La Norma Rond-point (Station piétonne)',
        frequency: 'Liaisons quotidiennes régulières en saison',
        period: 'Saison hiver & été',
        color: '#ec4899',
        stops: ['Modane Gare Routière (SNCF / TGV)', 'Villarodin Abribus', 'La Norma Rond-point (Station 1350 m)'],
        stopPoints: [
          { name: 'Modane Gare Routière (SNCF / TGV)', lng: 6.65914, lat: 45.19356 },
          { name: 'Villarodin Abribus', lng: 6.6850, lat: 45.2081 },
          { name: 'La Norma Rond-point (Station 1350 m)', lng: 6.6985, lat: 45.2028 }
        ]
      }
    });
  }

  // 5. Ligne 1 HMV : Modane ↔ Refuge-Porte de l'Orgère (1935 m, Vanoise)
  if (modaneOsrm.modane_orgere) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(modaneOsrm.modane_orgere, 1.5)
      },
      properties: {
        id: 'navette-hmv-orgere',
        ref: 'Ligne Orgère',
        name: 'Ligne 1 HMV : Modane ↔ Refuge-Porte de l\'Orgère (1935 m)',
        mode: 'navette',
        operator: 'Parc National de la Vanoise / HMV',
        network: 'Haute Maurienne Vanoise',
        route: 'Modane Gare Routière ↔ Saint-André ↔ Polset ↔ Refuge-Porte de l\'Orgère (1935 m)',
        frequency: 'Tous les jours en été (Accès sentier nature & Tour des Glaciers)',
        period: 'Saison été (Juin à Septembre)',
        color: '#db2777',
        stops: ['Modane Gare Routière (SNCF / TGV)', 'Saint-André Église', 'Polset Hameau', 'Refuge-Porte de l\'Orgère (1935 m)'],
        stopPoints: [
          { name: 'Modane Gare Routière (SNCF / TGV)', lng: 6.65914, lat: 45.19356 },
          { name: 'Saint-André Église', lng: 6.6710, lat: 45.2021 },
          { name: 'Polset Hameau', lng: 6.6803, lat: 45.2141 },
          { name: 'Refuge-Porte de l\'Orgère (1935 m)', lng: 6.6734, lat: 45.2295 }
        ]
      }
    });
  }

  // 6. Ligne 4 HMV : Bonneval-sur-Arc ↔ Hameau de L’Écot (2020 m)
  if (modaneOsrm.bonneval_ecot) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(modaneOsrm.bonneval_ecot, 1.5)
      },
      properties: {
        id: 'navette-hmv-ecot',
        ref: 'Ligne Écot',
        name: 'Ligne 4 HMV : Bonneval-sur-Arc ↔ Hameau de L’Écot (2020 m)',
        mode: 'navette',
        operator: 'Communauté de Communes Haute Maurienne Vanoise',
        network: 'Haute Maurienne Vanoise',
        route: 'Bonneval-sur-Arc Patinoire (1800 m) ↔ Pierre Fendue ↔ Hameau de L’Écot (2020 m)',
        frequency: '9 allers-retours quotidiens en été',
        period: 'Saison été (Accès Refuges des Évettes & du Carro)',
        color: '#10b981',
        stops: ['Bonneval-sur-Arc Patinoire (1800 m)', 'Parking Pierre Fendue', 'Hameau de L’Écot (2020 m)'],
        stopPoints: [
          { name: 'Bonneval-sur-Arc Patinoire (1800 m)', lng: 7.0475, lat: 45.3712 },
          { name: 'Parking Pierre Fendue', lng: 7.0792, lat: 45.3755 },
          { name: 'Hameau de L’Écot (2020 m)', lng: 7.0924, lat: 45.3810 }
        ]
      }
    });
  }

  // 7. Ligne 3 HMV : Bessans ↔ Hameau d'Avérole (Refuge d'Avérole 2040 m)
  if (modaneOsrm.bessans_averole) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(modaneOsrm.bessans_averole, 1.5)
      },
      properties: {
        id: 'navette-hmv-averole',
        ref: 'Ligne Avérole',
        name: 'Ligne 3 HMV : Bessans ↔ Hameau d\'Avérole (2040 m)',
        mode: 'navette',
        operator: 'Communauté de Communes Haute Maurienne Vanoise',
        network: 'Haute Maurienne Vanoise',
        route: 'Bessans Placette ↔ Parking des Vincendières ↔ Hameau d\'Avérole (2040 m)',
        frequency: '6 à 8 rotations/jour en été (Correspondance S52/S53)',
        period: 'Saison été (Accès Refuge d\'Avérole & frontière Italie)',
        color: '#ef4444',
        stops: ['Bessans Placette', 'Parking des Vincendières (1815 m)', 'Hameau d\'Avérole (2040 m)'],
        stopPoints: [
          { name: 'Bessans Placette', lng: 6.9942, lat: 45.3208 },
          { name: 'Parking des Vincendières (1815 m)', lng: 7.0375, lat: 45.3082 },
          { name: 'Hameau d\'Avérole (2040 m)', lng: 7.0651, lat: 45.3037 }
        ]
      }
    });
  }

  // 8. Ligne 902 Transalpine : Modane ↔ Bardonecchia (Italie)
  if (modaneOsrm.modane_bardonecchia) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(modaneOsrm.modane_bardonecchia, 1.5)
      },
      properties: {
        id: 'bus-hmv-902-bardonecchia',
        ref: 'Ligne 902',
        name: 'Ligne 902 Transalpine : Modane ↔ Bardonecchia (Italie)',
        mode: 'bus',
        operator: 'Bellando Tours / Région Auvergne-Rhône-Alpes',
        network: 'Liaisons Transalpines',
        route: 'Modane Gare Routière / SNCF ↔ Tunnel Routier du Fréjus ↔ Bardonecchia Gare FS (Italie)',
        frequency: '7 allers-retours quotidiens du lundi au samedi toute l\'année (Correspondances trains FS vers Turin)',
        period: 'Toute l\'année (Liaison internationale France ↔ Italie)',
        color: '#16a34a',
        stops: ['Modane Gare Routière (France)', 'Plateforme Tunnel du Fréjus', 'Bardonecchia Gare FS (Italie)'],
        stopPoints: [
          { name: 'Modane Gare Routière (France)', lng: 6.65914, lat: 45.19356 },
          { name: 'Plateforme Tunnel du Fréjus', lng: 6.6830, lat: 45.1680 },
          { name: 'Bardonecchia Gare FS (Italie)', lng: 6.7019, lat: 45.0757 }
        ]
      }
    });
  }

  // 6sexdecies. LIAISONS MAJEURES COMPLÉMENTAIRES (Albertville, Les Saisies, Sybelles, Maurienne, La Plagne, Peisey-Rosuel, Champagny, Léman Express L3 Bonneville)
  const suppOsrm = fs.existsSync('scripts/data/supplementary_resorts_osrm.json')
    ? JSON.parse(fs.readFileSync('scripts/data/supplementary_resorts_osrm.json', 'utf8'))
    : {};

  // 1. Ligne 22 : Albertville ↔ Beaufort ↔ Hauteluce ↔ Les Saisies (1650 m)
  if (suppOsrm.albertville_beaufort_saisies) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.albertville_beaufort_saisies, 1.5)
      },
      properties: {
        id: 'bus-arlysere-22-saisies',
        ref: 'Ligne 22',
        name: 'Ligne 22 : Albertville ↔ Beaufort ↔ Hauteluce ↔ Les Saisies (1650 m)',
        mode: 'bus',
        operator: 'Mobilités Arlysère / Cars Région Savoie',
        network: 'Mobilités Arlysère / Beaufortain',
        route: 'Albertville Gare Routière (480 m) ↔ Venthon ↔ Queige ↔ Beaufort-sur-Doron ↔ Hauteluce ↔ Col des Saisies (1650 m)',
        frequency: 'Liaisons quotidiennes régulières en saison',
        period: 'Toute l\'année (Accès station Les Saisies & Espace Diamant)',
        color: '#f59e0b',
        stops: ['Albertville Gare Routière', 'Venthon', 'Queige Chef-Lieu', 'Beaufort-sur-Doron (Gare)', 'Hauteluce Village', 'Les Saisies (Maison des Saisies 1650 m)'],
        stopPoints: [
          { name: 'Albertville Gare Routière', lng: 6.383167, lat: 45.672977 },
          { name: 'Venthon', lng: 6.4110, lat: 45.6980 },
          { name: 'Queige Chef-Lieu', lng: 6.4830, lat: 45.7140 },
          { name: 'Beaufort-sur-Doron (Gare)', lng: 6.5740, lat: 45.7180 },
          { name: 'Hauteluce Village', lng: 6.5850, lat: 45.7480 },
          { name: 'Les Saisies (Maison des Saisies 1650 m)', lng: 6.5338, lat: 45.7610 }
        ]
      }
    });
  }

  // 2. Navette Interstations Val d'Arly : Flumet ↔ Crest-Voland ↔ Les Saisies ↔ Bisanne 1500
  if (suppOsrm.saisies_val_d_arly) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.saisies_val_d_arly, 1.5)
      },
      properties: {
        id: 'navette-val-d-arly-saisies',
        ref: 'Navette Diamant',
        name: 'Navette Interstations : Flumet ↔ Crest-Voland ↔ Les Saisies ↔ Bisanne 1500',
        mode: 'navette',
        operator: 'Communauté de Communes du Val d\'Arly / Espace Diamant',
        network: 'Val d\'Arly Mobilités',
        route: 'Flumet Office de Tourisme ↔ Crest-Voland Village ↔ Col des Saisies (1650 m) ↔ Bisanne 1500',
        frequency: 'Circulations régulières 7j/7 en saison',
        period: 'Saison hiver & été (Liaison inter-villages Espace Diamant)',
        color: '#10b981',
        stops: ['Flumet (Office de Tourisme)', 'Crest-Voland (Centre Village)', 'Col des Saisies (Office de Tourisme)', 'Bisanne 1500 (Résidence)'],
        stopPoints: [
          { name: 'Flumet (Office de Tourisme)', lng: 6.5170, lat: 45.8190 },
          { name: 'Crest-Voland (Centre Village)', lng: 6.5050, lat: 45.7950 },
          { name: 'Col des Saisies (Office de Tourisme)', lng: 6.5338, lat: 45.7610 },
          { name: 'Bisanne 1500 (Résidence)', lng: 6.5020, lat: 45.7480 }
        ]
      }
    });
  }

  // 3. Ligne S32 : Saint-Jean-de-Maurienne ↔ Saint-Jean-d'Arves ↔ Saint-Sorlin-d'Arves (1600 m, Les Sybelles)
  if (suppOsrm.st_jean_sybelles) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.st_jean_sybelles, 1.5)
      },
      properties: {
        id: 'bus-savoie-s32-sybelles',
        ref: 'Ligne S32',
        name: 'Ligne S32 : Saint-Jean-de-Maurienne ↔ Saint-Jean-d\'Arves ↔ Saint-Sorlin-d\'Arves (1600 m)',
        mode: 'bus',
        operator: 'Trans-Alpes / Cars Région Savoie',
        network: 'Les Sybelles / Maurienne',
        route: 'Saint-Jean-de-Maurienne Gare SNCF ↔ Pontamafrey ↔ Saint-Jean-d\'Arves (La Tour) ↔ Saint-Sorlin-d\'Arves (Col de la Croix de Fer)',
        frequency: 'Tous les jours en saison (Correspondances TGV & TER en gare de St-Jean)',
        period: 'Toute l\'année (Accès Domaine des Sybelles)',
        color: '#3b82f6',
        stops: ['Saint-Jean-de-Maurienne Gare SNCF', 'Pontamafrey (Vallée Arvan)', 'Saint-Jean-d\'Arves (La Tour)', 'Saint-Sorlin-d\'Arves (Église / 1600 m)'],
        stopPoints: [
          { name: 'Saint-Jean-de-Maurienne Gare SNCF', lng: 6.354716, lat: 45.277542 },
          { name: 'Pontamafrey (Vallée Arvan)', lng: 6.3020, lat: 45.2420 },
          { name: 'Saint-Jean-d\'Arves (La Tour)', lng: 6.2750, lat: 45.2070 },
          { name: 'Saint-Sorlin-d\'Arves (Église / 1600 m)', lng: 6.2230, lat: 45.2210 }
        ]
      }
    });
  }

  // 4. Ligne S33 : Saint-Jean-de-Maurienne ↔ Villargondran ↔ Albiez-Montrond (1500 m)
  if (suppOsrm.st_jean_albiez) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.st_jean_albiez, 1.5)
      },
      properties: {
        id: 'bus-savoie-s33-albiez',
        ref: 'Ligne S33',
        name: 'Ligne S33 : Saint-Jean-de-Maurienne ↔ Villargondran ↔ Albiez-Montrond (1500 m)',
        mode: 'bus',
        operator: 'Trans-Alpes / Cars Région Savoie',
        network: 'Haute-Maurienne / Sybelles',
        route: 'Saint-Jean-de-Maurienne Gare SNCF ↔ Villargondran ↔ Albiez-le-Jeune ↔ Albiez-Montrond (Chef-Lieu 1500 m)',
        frequency: 'Liaisons quotidiennes régulières',
        period: 'Toute l\'année (Au pied des Aiguilles d\'Arves)',
        color: '#8b5cf6',
        stops: ['Saint-Jean-de-Maurienne Gare SNCF', 'Villargondran', 'Albiez-le-Jeune (Mairie)', 'Albiez-Montrond (Chef-Lieu 1500 m)'],
        stopPoints: [
          { name: 'Saint-Jean-de-Maurienne Gare SNCF', lng: 6.354716, lat: 45.277542 },
          { name: 'Villargondran', lng: 6.3710, lat: 45.2580 },
          { name: 'Albiez-le-Jeune (Mairie)', lng: 6.3450, lat: 45.2310 },
          { name: 'Albiez-Montrond (Chef-Lieu 1500 m)', lng: 6.3350, lat: 45.2180 }
        ]
      }
    });
  }

  // 5. Ligne S30 : Saint-Avre - La Chambre ↔ Saint-François-Longchamp (1650 m)
  if (suppOsrm.st_jean_st_francois) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.st_jean_st_francois, 1.5)
      },
      properties: {
        id: 'bus-savoie-s30-st-francois',
        ref: 'Ligne S30',
        name: 'Ligne S30 : Saint-Avre - La Chambre ↔ Saint-François-Longchamp (1650 m)',
        mode: 'bus',
        operator: 'Trans-Alpes / Cars Région Savoie',
        network: 'Cars Région Savoie',
        route: 'Saint-Jean-de-Maurienne Gare SNCF ↔ La Chambre (Gare SNCF) ↔ Montgellafrey ↔ Saint-François-Longchamp (1650 m, Col de la Madeleine)',
        frequency: 'Tous les jours en saison hiver & été',
        period: 'Saison hiver & été (Accès Grand Domaine)',
        color: '#ec4899',
        stops: ['Saint-Jean-de-Maurienne Gare SNCF', 'La Chambre (Gare SNCF)', 'Montgellafrey', 'Saint-François-Longchamp (Station 1650 m)'],
        stopPoints: [
          { name: 'Saint-Jean-de-Maurienne Gare SNCF', lng: 6.354716, lat: 45.277542 },
          { name: 'La Chambre (Gare SNCF)', lng: 6.2970, lat: 45.3620 },
          { name: 'Montgellafrey', lng: 6.3100, lat: 45.3850 },
          { name: 'Saint-François-Longchamp (Station 1650 m)', lng: 6.3090, lat: 45.4140 }
        ]
      }
    });
  }

  // 6. Ligne S71 : Aime-la-Plagne ↔ Macôt ↔ Plagne 1800 ↔ Plagne Centre ↔ Belle Plagne (2050 m)
  if (suppOsrm.aime_la_plagne) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.aime_la_plagne, 1.5)
      },
      properties: {
        id: 'bus-savoie-s71-la-plagne',
        ref: 'Ligne S71',
        name: 'Ligne S71 : Aime-la-Plagne ↔ Macôt ↔ Plagne Centre ↔ Belle Plagne (2050 m)',
        mode: 'bus',
        operator: 'Cars Région Savoie / Loyet Tarentaise',
        network: 'La Plagne Tarentaise',
        route: 'Aime-la-Plagne Gare SNCF (TGV) ↔ Macôt-la-Plagne ↔ Plagne 1800 ↔ Plagne Centre (1970 m) ↔ Plagne Bellecôte ↔ Belle Plagne (2050 m)',
        frequency: 'Liaisons régulières cadencées (Correspondances TGV à Aime)',
        period: 'Toute l\'année (Liaison maîtresse La Plagne Tarentaise)',
        color: '#e11d48',
        stops: ['Aime-la-Plagne Gare SNCF (TGV)', 'Macôt-la-Plagne', 'Plagne 1800', 'Plagne Centre (1970 m)', 'Plagne Bellecôte', 'Belle Plagne (2050 m)'],
        stopPoints: [
          { name: 'Aime-la-Plagne Gare SNCF (TGV)', lng: 6.6500, lat: 45.5550 },
          { name: 'Macôt-la-Plagne', lng: 6.6710, lat: 45.5450 },
          { name: 'Plagne 1800', lng: 6.6740, lat: 45.5080 },
          { name: 'Plagne Centre (1970 m)', lng: 6.6750, lat: 45.5070 },
          { name: 'Plagne Bellecôte', lng: 6.6970, lat: 45.5130 },
          { name: 'Belle Plagne (2050 m)', lng: 6.7080, lat: 45.5150 }
        ]
      }
    });
  }

  // 6bis. Ligne S72 : Landry Gare SNCF ↔ Bellentre ↔ Montchavin - Les Coches (1450 m)
  if (suppOsrm.landry_montchavin) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.landry_montchavin, 1.5)
      },
      properties: {
        id: 'bus-savoie-s72-montchavin',
        ref: 'Ligne S72',
        name: 'Ligne S72 : Landry Gare SNCF ↔ Montchavin - Les Coches (1450 m)',
        mode: 'bus',
        operator: 'Cars Région Savoie / Loyet Tarentaise',
        network: 'La Plagne Paradiski',
        route: 'Landry Gare SNCF (TGV) ↔ Bellentre ↔ Montchavin Village (1250 m) ↔ Les Coches (1450 m)',
        frequency: 'Tous les jours en saison hiver & été',
        period: 'Saison hiver & été (Accès Montchavin-Les Coches Paradiski)',
        color: '#f43f5e',
        stops: ['Landry Gare SNCF (TGV)', 'Bellentre', 'Montchavin Village (1250 m)', 'Les Coches (1450 m)'],
        stopPoints: [
          { name: 'Landry Gare SNCF (TGV)', lng: 6.7410, lat: 45.5700 },
          { name: 'Bellentre', lng: 6.7110, lat: 45.5670 },
          { name: 'Montchavin Village (1250 m)', lng: 6.7380, lat: 45.5580 },
          { name: 'Les Coches (1450 m)', lng: 6.7320, lat: 45.5530 }
        ]
      }
    });
  }

  // 7. Ligne S70 / Navette Vallée Peisey-Vallandry : Landry ↔ Peisey ↔ Vallandry ↔ Refuge-Porte de Rosuel (1550 m, Vanoise)
  if (suppOsrm.landry_peisey_rosuel) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.landry_peisey_rosuel, 1.5)
      },
      properties: {
        id: 'navette-peisey-rosuel',
        ref: 'Ligne S70',
        name: 'Ligne S70 : Landry Gare SNCF ↔ Peisey ↔ Vallandry ↔ Refuge Rosuel (1550 m)',
        mode: 'navette',
        operator: 'Parc National de la Vanoise / Transdev Savoie',
        network: 'Peisey-Vallandry Vanoise',
        route: 'Landry Gare SNCF (TGV) ↔ Le Villaret ↔ Peisey-Nancroix (Village) ↔ Plan-Peisey / Vallandry (1600 m) ↔ Refuge-Porte de Rosuel (1550 m, Vanoise)',
        frequency: 'Tous les jours en saison hiver & été (Gratuit en saison)',
        period: 'Saison hiver & été (Accès cœur du Parc National de la Vanoise)',
        color: '#059669',
        stops: ['Landry Gare SNCF (TGV)', 'Le Villaret', 'Peisey-Nancroix (Village)', 'Plan-Peisey / Vallandry (1600 m)', 'Refuge-Porte de Rosuel (1550 m, Vanoise)'],
        stopPoints: [
          { name: 'Landry Gare SNCF (TGV)', lng: 6.7410, lat: 45.5700 },
          { name: 'Le Villaret', lng: 6.7560, lat: 45.5520 },
          { name: 'Peisey-Nancroix (Village)', lng: 6.7580, lat: 45.5460 },
          { name: 'Plan-Peisey / Vallandry (1600 m)', lng: 6.7490, lat: 45.5390 },
          { name: 'Refuge-Porte de Rosuel (1550 m, Vanoise)', lng: 6.8040, lat: 45.5260 }
        ]
      }
    });
  }

  // 8. Ligne S66 : Moûtiers ↔ Brides ↔ Bozel ↔ Champagny-en-Vanoise (1250 m) ↔ Champagny-le-Haut (1470 m)
  if (suppOsrm.moutiers_champagny) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.moutiers_champagny, 1.5)
      },
      properties: {
        id: 'bus-savoie-s66-champagny',
        ref: 'Ligne S66',
        name: 'Ligne S66 : Moûtiers ↔ Brides ↔ Bozel ↔ Champagny-en-Vanoise (1250 m) ↔ Champagny-le-Haut (1470 m)',
        mode: 'bus',
        operator: 'Cars Région Savoie / Communauté de Communes Val Vanoise',
        network: 'Val Vanoise',
        route: 'Moûtiers Gare Routière (SNCF) ↔ Salins-les-Thermes ↔ Brides-les-Bains ↔ Bozel (Mairie) ↔ Champagny-en-Vanoise (Village 1250 m) ↔ Champagny-le-Haut (Refuge du Bois 1470 m)',
        frequency: 'Liaisons quotidiennes cadencées (Correspondances TGV à Moûtiers)',
        period: 'Toute l\'année (Accès Grand Bec & Parc National de la Vanoise)',
        color: '#0d9488',
        stops: ['Moûtiers Gare Routière (SNCF / TGV)', 'Brides-les-Bains (Office de Tourisme)', 'Bozel (Mairie)', 'Champagny-en-Vanoise (Village 1250 m)', 'Champagny-le-Haut (Refuge du Bois 1470 m)'],
        stopPoints: [
          { name: 'Moûtiers Gare Routière (SNCF / TGV)', lng: 6.531399, lat: 45.486470 },
          { name: 'Brides-les-Bains (Office de Tourisme)', lng: 6.5750, lat: 45.4520 },
          { name: 'Bozel (Mairie)', lng: 6.6490, lat: 45.4430 },
          { name: 'Champagny-en-Vanoise (Village 1250 m)', lng: 6.6920, lat: 45.4540 },
          { name: 'Champagny-le-Haut (Refuge du Bois 1470 m)', lng: 6.7480, lat: 45.4580 }
        ]
      }
    });
  }

  // 8bis. Ligne S65 : Moûtiers ↔ Brides-les-Bains ↔ Bozel ↔ Pralognan-la-Vanoise (1410 m)
  if (suppOsrm.moutiers_pralognan) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.moutiers_pralognan, 1.5)
      },
      properties: {
        id: 'bus-savoie-s65-pralognan',
        ref: 'Ligne S65',
        name: 'Ligne S65 : Moûtiers ↔ Brides ↔ Bozel ↔ Pralognan-la-Vanoise (1410 m)',
        mode: 'bus',
        operator: 'Cars Région Savoie / Communauté de Communes Val Vanoise',
        network: 'Val Vanoise',
        route: 'Moûtiers Gare Routière (SNCF) ↔ Salins-les-Thermes ↔ Brides-les-Bains ↔ Bozel (Mairie) ↔ Pralognan-la-Vanoise (Gare Routière / 1410 m)',
        frequency: 'Liaisons quotidiennes cadencées (Correspondances TGV à Moûtiers)',
        period: 'Toute l\'année (Capitale historique du Parc National de la Vanoise)',
        color: '#0891b2',
        stops: ['Moûtiers Gare Routière (SNCF / TGV)', 'Brides-les-Bains (Office de Tourisme)', 'Bozel (Mairie)', 'Pralognan-la-Vanoise (Gare Routière)'],
        stopPoints: [
          { name: 'Moûtiers Gare Routière (SNCF / TGV)', lng: 6.531399, lat: 45.486470 },
          { name: 'Brides-les-Bains (Office de Tourisme)', lng: 6.5750, lat: 45.4520 },
          { name: 'Bozel (Mairie)', lng: 6.6490, lat: 45.4430 },
          { name: 'Pralognan-la-Vanoise (Gare Routière)', lng: 6.7215, lat: 45.3780 }
        ]
      }
    });
  }

  // 8ter. Ligne S40 : Saint-Michel-de-Maurienne ↔ Valloire (1430 m) ↔ Col du Galibier (2642 m)
  if (suppOsrm.st_michel_valloire_galibier) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.st_michel_valloire_galibier, 1.5)
      },
      properties: {
        id: 'bus-savoie-s40-valloire',
        ref: 'Ligne S40',
        name: 'Ligne S40 : Saint-Michel-de-Maurienne ↔ Valloire (1430 m) ↔ Col du Galibier (2642 m)',
        mode: 'bus',
        operator: 'Trans-Alpes / Cars Région Savoie',
        network: 'Maurienne / Galibier',
        route: 'Saint-Michel-de-Maurienne Gare SNCF ↔ Saint-Martin-d\'Arc ↔ Saint-Martin-de-la-Porte ↔ Valloire (Office de Tourisme 1430 m) ↔ Plan Lachat ↔ Col du Galibier (2642 m)',
        frequency: 'Liaisons quotidiennes régulières en saison',
        period: 'Toute l\'année vers Valloire (Prolongement estival au Col du Galibier)',
        color: '#f97316',
        stops: ['Saint-Michel-de-Maurienne Gare SNCF', 'Valloire (Office de Tourisme 1430 m)', 'Plan Lachat (1980 m)', 'Col du Galibier (2642 m)'],
        stopPoints: [
          { name: 'Saint-Michel-de-Maurienne Gare SNCF', lng: 6.4710, lat: 45.2180 },
          { name: 'Valloire (Office de Tourisme 1430 m)', lng: 6.4290, lat: 45.1660 },
          { name: 'Plan Lachat (1980 m)', lng: 6.4670, lat: 45.1010 },
          { name: 'Col du Galibier (2642 m)', lng: 6.4080, lat: 45.0640 }
        ]
      }
    });
  }

  // 9. Léman Express L3 : Genève ↔ Annemasse ↔ Bonneville ↔ Cluses ↔ Sallanches ↔ Saint-Gervais
  if (suppOsrm.leman_express_l3) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.leman_express_l3, 2)
      },
      properties: {
        id: 'train-leman-express-l3',
        ref: 'Léman Express L3',
        name: 'Léman Express L3 : Genève ↔ Annemasse ↔ Bonneville ↔ Cluses ↔ Sallanches ↔ Saint-Gervais',
        mode: 'train',
        operator: 'SNCF Voyageurs / CFF (Lémanis)',
        network: 'Léman Express / TER Auvergne-Rhône-Alpes',
        route: 'Genève Cornavin ↔ Annemasse ↔ Reignier ↔ La Roche-sur-Foron ↔ Saint-Pierre-en-Faucigny ↔ Bonneville ↔ Marignier ↔ Cluses ↔ Magland ↔ Sallanches-Combloux-Megève ↔ Saint-Gervais-les-Bains-Le Fayet',
        frequency: 'Cadencement toutes les heures (RER transfrontalier franco-suisse)',
        period: 'Toute l\'année (Axe ferroviaire majeur de la Vallée de l\'Arve)',
        color: '#dc2626',
        stops: ['Annemasse', 'Reignier', 'La Roche-sur-Foron', 'Saint-Pierre-en-Faucigny', 'Bonneville', 'Marignier', 'Cluses', 'Magland', 'Sallanches - Combloux - Megève', 'Saint-Gervais-les-Bains-Le Fayet'],
        stopPoints: [
          { name: 'Annemasse', lng: 6.2360, lat: 46.1930 },
          { name: 'Reignier', lng: 6.3140, lat: 46.1550 },
          { name: 'La Roche-sur-Foron', lng: 6.3140, lat: 46.0670 },
          { name: 'Saint-Pierre-en-Faucigny', lng: 6.3710, lat: 46.0630 },
          { name: 'Bonneville', lng: 6.4090, lat: 46.0770 },
          { name: 'Marignier', lng: 6.4990, lat: 46.0900 },
          { name: 'Cluses', lng: 6.5810, lat: 46.0600 },
          { name: 'Magland', lng: 6.6210, lat: 45.9980 },
          { name: 'Sallanches - Combloux - Megève', lng: 6.6340, lat: 45.9380 },
          { name: 'Saint-Gervais-les-Bains-Le Fayet', lng: 6.7027, lat: 45.9061 }
        ]
      }
    });
  }

  // 10. Navettes Haute Montagne & Refuges du Parc National des Écrins
  if (suppOsrm.pre_madame_carle) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.pre_madame_carle, 1.5)
      },
      properties: {
        id: 'navette-ecrins-pre-madame-carle',
        ref: 'Navette Pré de Mme Carle',
        name: 'Navette Parc des Écrins : L\'Argentière ↔ Vallouise ↔ Ailefroide ↔ Pré de Madame Carle (1874 m)',
        mode: 'navette',
        operator: 'CC du Pays des Écrins / Parc National des Écrins',
        network: 'Parc National des Écrins',
        route: 'L\'Argentière-la-Bessée Gare SNCF ↔ Vallouise (Village) ↔ Pelvoux (Station) ↔ Ailefroide (1506 m) ↔ Pré de Madame Carle (1874 m)',
        frequency: 'Circulations estivales quotidiennes pour randonneurs et alpinistes',
        period: 'Saison été (Accès Glacier Blanc, Barre des Écrins, Refuges Cézanne, Écrins, Pelvoux, Sélé)',
        color: '#10b981',
        stops: ['L\'Argentière Gare SNCF', 'Vallouise Centre', 'Pelvoux Téléphérique', 'Ailefroide (1506 m)', 'Pré de Madame Carle (1874 m)'],
        stopPoints: [
          { name: 'L\'Argentière Gare SNCF', lng: 6.5580, lat: 44.7930 },
          { name: 'Vallouise Centre', lng: 6.4880, lat: 44.8460 },
          { name: 'Pelvoux Téléphérique', lng: 6.4840, lat: 44.8640 },
          { name: 'Ailefroide (1506 m)', lng: 6.4440, lat: 44.8870 },
          { name: 'Pré de Madame Carle (1874 m)', lng: 6.4170, lat: 44.9170 }
        ]
      }
    });
  }

  if (suppOsrm.valgaudemar_gioberney) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.valgaudemar_gioberney, 1.5)
      },
      properties: {
        id: 'navette-ecrins-valgaudemar-gioberney',
        ref: 'Navette Valgaudemar',
        name: 'Navette Parc des Écrins : Saint-Firmin ↔ La Chapelle ↔ Chalet-Hôtel du Gioberney (1642 m)',
        mode: 'navette',
        operator: 'CC du Champsaur-Valgaudemar / Parc National des Écrins',
        network: 'Parc National des Écrins',
        route: 'Saint-Firmin (Champsaur/Valgaudemar) ↔ Saint-Maurice-en-Valgaudemar ↔ Villard-Loubière ↔ La Chapelle-en-Valgaudemar ↔ Chalet-Hôtel du Gioberney (1642 m, Cirque du Gioberney)',
        frequency: 'Navettes estivales régulières',
        period: 'Saison été (Porte d\'entrée ouest des Écrins : Refuges Pigeonnier, Vallonpierre, Chabournéou, Olan)',
        color: '#059669',
        stops: ['Saint-Firmin', 'Saint-Maurice-en-Valgaudemar', 'La Chapelle-en-Valgaudemar', 'Chalet-Hôtel du Gioberney (1642 m)'],
        stopPoints: [
          { name: 'Saint-Firmin', lng: 6.0330, lat: 44.8050 },
          { name: 'Saint-Maurice-en-Valgaudemar', lng: 6.0960, lat: 44.8020 },
          { name: 'La Chapelle-en-Valgaudemar', lng: 6.1930, lat: 44.8180 },
          { name: 'Chalet-Hôtel du Gioberney (1642 m)', lng: 6.2790, lat: 44.8390 }
        ]
      }
    });
  }

  if (suppOsrm.veneon_berarde) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: simplifyPolyline(suppOsrm.veneon_berarde, 1.5)
      },
      properties: {
        id: 'navette-ecrins-veneon-berarde',
        ref: 'Navette Bérarde',
        name: 'Navette Parc des Écrins : Le Bourg-d\'Oisans ↔ Saint-Christophe ↔ La Bérarde (1713 m)',
        mode: 'navette',
        operator: 'CC de l\'Oisans / Parc National des Écrins',
        network: 'Parc National des Écrins / Oisans',
        route: 'Le Bourg-d\'Oisans Gare Routière ↔ Vénosc ↔ Saint-Christophe-en-Oisans ↔ Champhorent ↔ La Bérarde (1713 m)',
        frequency: 'Liaisons estivales quotidiennes pour alpinistes',
        period: 'Saison été (Cœur alpin des Écrins : Refuges Carrelet, Promontoire, Châtelleret, Temple-Écrins, Pilatte)',
        color: '#047857',
        stops: ['Le Bourg-d\'Oisans', 'Vénosc (Pont des Ougiers)', 'Saint-Christophe-en-Oisans', 'Champhorent', 'La Bérarde (1713 m)'],
        stopPoints: [
          { name: 'Le Bourg-d\'Oisans', lng: 6.0290, lat: 45.0530 },
          { name: 'Vénosc (Pont des Ougiers)', lng: 6.1150, lat: 44.9920 },
          { name: 'Saint-Christophe-en-Oisans', lng: 6.1770, lat: 44.9570 },
          { name: 'Champhorent', lng: 6.2080, lat: 44.9410 },
          { name: 'La Bérarde (1713 m)', lng: 6.2930, lat: 44.9320 }
        ]
      }
    });
  }

  // 7. INCLURE LES LIGNES DE STATIONS & VALLÉES COMPLÉMENTAIRES (Val d'Isère, Alpe d'Huez, Valmorel, S82, T76)
  if (fs.existsSync('scripts/data/missing_resorts_final.json')) {
    const missingResorts = JSON.parse(fs.readFileSync('scripts/data/missing_resorts_final.json', 'utf8'));
    for (const r of missingResorts) {
      if (registeredIds.has(r.id)) continue;
      const coords = r.directCoordinates || [];
      const stopPts = (r.stops || []).map(sName => {
        const found = (r.stopPoints || []).find(sp => sp.name === sName);
        if (found) {
          const ptCoord = found.coord || [found.lng, found.lat];
          return { name: sName, lng: ptCoord[0], lat: ptCoord[1], time: found.time };
        }
        return null;
      }).filter(Boolean);

      const f = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords
        },
        properties: {
          id: r.id,
          ref: r.ref || r.id,
          name: r.name,
          mode: r.mode || 'navette',
          operator: r.operator || 'Navette Station',
          network: r.network || 'Navettes Alpines',
          route: r.route || r.name,
          frequency: r.frequency || 'Toutes les 15 min',
          period: r.period || 'Saison hiver & été',
          color: r.color || '#f59e0b',
          stops: r.stops,
          stopPoints: stopPts,
          timetable: r.timetable || null
        }
      };
      addFeature(f);
    }
  }

  // 8. TIGNES (Tracés haute précision)
  const tignesRel17 = fs.existsSync('scripts/data/tignes_rel_17013466.json')
    ? JSON.parse(fs.readFileSync('scripts/data/tignes_rel_17013466.json', 'utf8'))
    : null;
  const tignesRel20 = fs.existsSync('scripts/data/tignes_rel_2023055.json')
    ? JSON.parse(fs.readFileSync('scripts/data/tignes_rel_2023055.json', 'utf8'))
    : null;
  const tignesRel39 = fs.existsSync('scripts/data/tignes_rel_3960475.json')
    ? JSON.parse(fs.readFileSync('scripts/data/tignes_rel_3960475.json', 'utf8'))
    : null;

  if (tignesRel20 && tignesRel20.length >= 2) {
    addFeature({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: simplifyPolyline(tignesRel20, 2) },
      properties: {
        id: 'navette-tignes-val-claret',
        ref: 'Tignes Navette',
        name: 'Navette Gratuite Tignes : Val Claret ↔ Le Lac ↔ Lavachet',
        mode: 'navette',
        operator: 'Régie des Pistes de Tignes',
        network: 'Navettes Tignes',
        route: 'Val Claret Grande Motte ↔ Le Lac ↔ Le Lavachet',
        frequency: 'Navettes gratuites toutes les 10 à 15 min 24h/24 en saison',
        period: 'Saison hiver & été (24h/24)',
        color: '#0284c7',
        stops: ['Val Claret Grande Motte', 'Val Claret Centre', 'Le Lac', 'Le Lavachet'],
        stopPoints: [
          { name: 'Val Claret Grande Motte', lng: 6.8996, lat: 45.4542 },
          { name: 'Val Claret Centre', lng: 6.9032, lat: 45.4586 },
          { name: 'Le Lac', lng: 6.9085, lat: 45.4691 },
          { name: 'Le Lavachet', lng: 6.9068, lat: 45.4745 }
        ]
      }
    });
  }

  if (tignesRel39 && tignesRel39.length >= 2) {
    addFeature({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: simplifyPolyline(tignesRel39, 2) },
      properties: {
        id: 'navette-tignes-boisses-brevieres',
        ref: 'Tignes 1800',
        name: 'Navette Tignes 1800 : Le Lac ↔ Les Boisses ↔ Les Brévières',
        mode: 'navette',
        operator: 'Régie des Pistes de Tignes',
        network: 'Navettes Tignes',
        route: 'Le Lac ↔ Tignes 1800 (Les Boisses) ↔ Les Brévières (1550 m)',
        frequency: 'Toutes les 30 min en journée',
        period: 'Saison hiver & été',
        color: '#0ea5e9',
        stops: ['Le Lac', 'Tignes 1800 Les Boisses', 'Les Brévières'],
        stopPoints: [
          { name: 'Le Lac', lng: 6.9085, lat: 45.4691 },
          { name: 'Tignes 1800 Les Boisses', lng: 6.9258, lat: 45.4912 },
          { name: 'Les Brévières', lng: 6.9324, lat: 45.5085 }
        ]
      }
    });
  }

  // 9. CHAMONIX BUS (Réseau Chamonix Mobilité)
  if (fs.existsSync('scripts/data/chamonix_bus.json')) {
    const chamRoutes = JSON.parse(fs.readFileSync('scripts/data/chamonix_bus.json', 'utf8'));
    for (const cr of chamRoutes) {
      if (registeredIds.has(cr.id)) continue;
      const coords = cr.directCoordinates || [];
      const stopPts = (cr.stops || []).map((sName, idx) => {
        const found = (cr.stopPoints || []).find(sp => sp.name === sName);
        if (found) {
          const ptCoord = found.coord || [found.lng, found.lat];
          return { name: sName, lng: ptCoord[0], lat: ptCoord[1] };
        }
        // Fallback interpolation le long du tracé si nécessaire
        const ratio = idx / Math.max(1, cr.stops.length - 1);
        const cIdx = Math.min(coords.length - 1, Math.floor(ratio * coords.length));
        return { name: sName, lng: coords[cIdx][0], lat: coords[cIdx][1] };
      });

      addFeature({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: simplifyPolyline(coords, 2) },
        properties: {
          id: cr.id,
          ref: cr.ref || 'Chamonix Bus',
          name: cr.name,
          mode: 'bus',
          operator: cr.operator || 'Chamonix Mobilité',
          network: cr.network || 'Chamonix Bus',
          route: cr.route || cr.name,
          frequency: cr.frequency || 'Toutes les 15 à 30 min',
          period: cr.period || 'Toute l\'année',
          color: cr.color || '#dc2626',
          stops: cr.stops,
          stopPoints: stopPts
        }
      });
    }
  }

  // 10. NAVETTES VALLÉES ALPINES (Madame Carle, Névache, Aravis, Giffre, Queyras, Altigo, Galibier)
  if (fs.existsSync('public/transports_alpes.json')) {
    const existing = JSON.parse(fs.readFileSync('public/transports_alpes.json', 'utf8'));
    const keepSpecialIds = new Set([
      'bus-aravis-clusaz', 'bus-aravis-bornand',
      'navette-claree-nevache', 'bus-altigo-serreche', 'navette-pre-madame-carle',
      'navette-giffre-sixt', 'navette-galibier-lautaret',
      'telepherique-bastille-grenoble',
      'telepherique-eau-d-olle-oz', 'telepherique-aiguille-du-midi', 'telepherique-vanoise-express',
      'rail-tramway-du-mont-blanc', 'rail-montenvers-mer-de-glace', 'rail-chemin-de-fer-de-la-mure',
      'ter-sillon-alpin-grenoble-chambery-annecy', 'ter-maurienne-chambery-modane',
      'ter-tarentaise-chambery-bourg-st-maurice', 'ter-mont-blanc-express-st-gervais-chamonix-vallorcine',
      'ter-etoile-veynes-gap-briancon', 'train-pignes-nice-digne',
      'tgv-inoui-paris-tarentaise', 'tgv-inoui-paris-grenoble', 'tgv-inoui-paris-annecy',
      'tgv-inoui-paris-mont-blanc', 'tgv-inoui-paris-maurienne', 'tgv-inoui-lille-alpes',
      'tgv-inoui-mediterranee-grenoble', 'trenitalia-frecciarossa-paris-milan'
    ]);

    for (const f of existing.features) {
      const fid = f.properties?.id || f.id;
      if (keepSpecialIds.has(fid) && !registeredIds.has(fid)) {
        if ((fid === 'rail-tramway-du-mont-blanc' || fid === 'rail-chemin-de-fer-de-la-mure') && f.geometry.type === 'MultiLineString') {
          const stitched = stitchMultiLine(f.geometry.coordinates);
          if (stitched.length > 10) {
            f.geometry = { type: 'LineString', coordinates: simplifyPolyline(stitched, 1.5) };
          }
        }
        if (Array.isArray(f.properties?.stopPoints)) {
          f.properties.stopPoints.forEach(sp => {
            if (sp.coord && (sp.lng == null || sp.lat == null)) {
              sp.lng = sp.coord[0];
              sp.lat = sp.coord[1];
            }
          });
        }
        addFeature(f);
      }
    }
  }

  // 11. GARES & PÔLES D'ÉCHANGE ALPINS (Points)
  for (const st of ALPINE_STATIONS) {
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [st.lng, st.lat]
      },
      properties: {
        id: st.id,
        name: st.name,
        ref: st.ref,
        mode: 'station',
        operator: 'SNCF Gares & Connexions',
        alt: st.alt,
        color: '#3b82f6'
      }
    });
  }

  // 12. VÉRIFICATION RIGOUREUSE DES DIRECTIONS, BRANCHES ET GÉOMÉTRIES
  const smoothedCache = fs.existsSync('scripts/data/smoothed_routes_cache.json')
    ? JSON.parse(fs.readFileSync('scripts/data/smoothed_routes_cache.json', 'utf8'))
    : null;

  // Projection orthogonale et magnétisation mathématique exacte de chaque arrêt sur sa polyligne (distance = 0 m)
  function projectOnSegment(p, a, b) {
    const midLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
    const cosLat = Math.cos(midLat);
    const dx = (b[0] - a[0]) * cosLat;
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return [a[0], a[1]];
    const px = (p[0] - a[0]) * cosLat;
    const py = p[1] - a[1];
    let t = (px * dx + py * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }

  function snapPointToCoords(pt, lineCoords, maxDistMeters = 3000) {
    if (!Array.isArray(lineCoords) || lineCoords.length < 2) return pt;
    let minD = Infinity;
    let bestProj = pt;
    for (let i = 0; i < lineCoords.length - 1; i++) {
      const a = lineCoords[i], b = lineCoords[i + 1];
      const proj = projectOnSegment(pt, a, b);
      const d = haversineM(pt, proj);
      if (d < minD) {
        minD = d;
        bestProj = proj;
      }
    }
    if (minD <= maxDistMeters) {
      return bestProj;
    }
    return pt;
  }

  allFeatures.forEach(f => {
    if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') return;
    const props = f.properties || {};

    // Lissage routier des sauts résiduels et respect strict des tracés de montagne
    if (props.id === 'cars-express-x37' && smoothedCache?.x37_dortan_saint_claude) {
      const coords = f.geometry.coordinates;
      const roadRev = [...smoothedCache.x37_dortan_saint_claude].reverse();
      const newCoords = [...roadRev, ...coords.slice(2)];
      f.geometry.coordinates = simplifyPolyline(newCoords, 1.5);
    }
    if (props.id === 'navette-valmorel-valleebus' && smoothedCache?.valmorel_aigueblanche_resort) {
      const coords = f.geometry.coordinates;
      const jumpIdx = coords.findIndex((c, i) => i < coords.length - 1 && haversineM(c, coords[i + 1]) > 5000);
      if (jumpIdx >= 0) {
        const newCoords = [...coords.slice(0, jumpIdx + 1), ...smoothedCache.valmorel_aigueblanche_resort, ...coords.slice(jumpIdx + 1)];
        f.geometry.coordinates = simplifyPolyline(newCoords, 1.5);
      }
    }
    if (props.id === 'navette-valdisere-train-rouge') {
      if (f.geometry.coordinates.length > 276) {
        f.geometry.coordinates = f.geometry.coordinates.slice(0, 276);
      }
    }
    if (props.id === 'bus-isere-t76') {
      if (f.geometry.coordinates.length > 1357) {
        f.geometry.coordinates = f.geometry.coordinates.slice(0, 1357);
      }
    }

    // S'assurer que directions existe et est complet avec des coordonnées réelles
    if (!props.directions || props.directions.length === 0) {
      const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
      const stops = props.stops || [];
      const stopPoints = props.stopPoints || [];
      const origin = stops[0] || 'Départ';
      const destination = stops[stops.length - 1] || 'Terminus';

      props.directions = [
        {
          id: 'aller',
          name: `Vers ${destination}`,
          origin: origin,
          destination: destination,
          stops: stops,
          stopPoints: stopPoints,
          coordinates: coords,
          timetable: props.timetable || null
        },
        {
          id: 'retour',
          name: `Vers ${origin}`,
          origin: destination,
          destination: origin,
          stops: [...stops].reverse(),
          stopPoints: [...stopPoints].reverse(),
          coordinates: [...coords].reverse(),
          timetable: null
        }
      ];
    } else {
      // Vérifier que chaque direction a ses propres coordonnées
      props.directions.forEach(dir => {
        if (!dir.coordinates || dir.coordinates.length < 2) {
          if (dir.id === 'retour') {
            const allerCoords = props.directions[0]?.coordinates || (f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0]);
            dir.coordinates = [...allerCoords].reverse();
          } else {
            dir.coordinates = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
          }
        }
        if (!dir.stops && props.stops) {
          dir.stops = dir.id === 'retour' ? [...props.stops].reverse() : props.stops;
        }
        if (!dir.stopPoints && props.stopPoints) {
          dir.stopPoints = dir.id === 'retour' ? [...props.stopPoints].reverse() : props.stopPoints;
        }
      });
    }

    // Si des branches distinctes existent, marquer `hasBranches: true`
    if (Array.isArray(props.branches) && props.branches.length > 1) {
      props.hasBranches = true;
    }

    // Calage géométrique rigoureux : projection orthogonale de chaque arrêt sur le tracé physique (distance = 0 m)
    const lineCoords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
    if (Array.isArray(lineCoords) && lineCoords.length >= 2) {
      if (Array.isArray(props.stopPoints)) {
        props.stopPoints.forEach(sp => {
          if (sp.lng != null && sp.lat != null) {
            const snapped = snapPointToCoords([sp.lng, sp.lat], lineCoords);
            sp.lng = Number(snapped[0].toFixed(6));
            sp.lat = Number(snapped[1].toFixed(6));
            if (sp.coord) sp.coord = [sp.lng, sp.lat];
          }
        });
      }

      if (Array.isArray(props.directions)) {
        props.directions.forEach(dir => {
          const dirCoords = Array.isArray(dir.coordinates) && dir.coordinates.length >= 2 ? dir.coordinates : lineCoords;
          if (Array.isArray(dir.stopPoints)) {
            dir.stopPoints.forEach(sp => {
              if (sp.lng != null && sp.lat != null) {
                const snapped = snapPointToCoords([sp.lng, sp.lat], dirCoords);
                sp.lng = Number(snapped[0].toFixed(6));
                sp.lat = Number(snapped[1].toFixed(6));
                if (sp.coord) sp.coord = [sp.lng, sp.lat];
              }
            });
          }
        });
      }

      if (Array.isArray(props.branches)) {
        props.branches.forEach(br => {
          const brCoords = Array.isArray(br.coordinates) && br.coordinates.length >= 2 ? br.coordinates : lineCoords;
          if (Array.isArray(br.stopPoints)) {
            br.stopPoints.forEach(sp => {
              if (sp.lng != null && sp.lat != null) {
                const snapped = snapPointToCoords([sp.lng, sp.lat], brCoords);
                sp.lng = Number(snapped[0].toFixed(6));
                sp.lat = Number(snapped[1].toFixed(6));
                if (sp.coord) sp.coord = [sp.lng, sp.lat];
              }
            });
          }
        });
      }
    }
  });

  console.log(`\nTOTAL FEATURES VALIDES GÉNÉRÉES : ${allFeatures.length}`);

  const outputGeoJSON = {
    type: 'FeatureCollection',
    name: 'Transports_Alpes_Francaises_HD',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
    },
    features: allFeatures
  };

  const outPath1 = 'public/transports_alpes.json';
  const outPath2 = 'public/transport_alps_v2.geojson';

  fs.writeFileSync(outPath1, JSON.stringify(outputGeoJSON));
  fs.writeFileSync(outPath2, JSON.stringify(outputGeoJSON));

  console.log(`✓ Dataset écrit avec succès dans ${outPath1} et ${outPath2} !`);
  const bytes = fs.statSync(outPath1).size;
  console.log(`  Taille du dataset : ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}

generateCompleteDataset().catch(console.error);
