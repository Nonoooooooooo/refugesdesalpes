/**
 * Catalogue des sources officielles importées par 3_construire_reseau.cjs.
 *
 * Chaque entrée correspond à un jeu de données de transport.data.gouv.fr (identifiant
 * visible dans docs/transport/inventaire_sources.csv). La liste de départ reprend tous
 * les réseaux qui ont au moins un arrêt à moins de 5 km d'un refuge (rapport de l'étape 1).
 *
 * Champs :
 *   id        identifiant du jeu de données (obligatoire)
 *   reseau    nom affiché sur la carte
 *   navette   true pour les navettes de station ou de vallée (style « navette » sur la carte)
 *   couleur   couleur de repli quand le flux GTFS n'en fournit pas
 *   actif     false pour ignorer la source sans la supprimer du catalogue
 *   garderLigne(route, agence)  filtre optionnel sur les lignes du flux
 *   note      pourquoi la source est réglée ainsi
 *
 * Les lignes d'un flux ne sont gardées que si elles desservent au moins un arrêt
 * à moins de RAYON_KM d'un refuge, d'une cabane ou d'un gîte (voir 3_construire_reseau.cjs).
 */

module.exports = [
  // --- Cars régionaux et trains (colonne vertébrale de l'accès aux vallées) ---
  { id: '5bb1caa6634f4136693d9053', reseau: 'Cars Région Isère', couleur: '#0ea5e9' },
  { id: '607862da7487e5d490677f14', reseau: 'Cars Région Savoie', couleur: '#0ea5e9' },
  { id: '607861844a84ad655a94f8c5', reseau: 'Cars Région Haute-Savoie', couleur: '#0ea5e9' },
  { id: '60784f6022a1bbe2484cf248', reseau: 'Cars Région Ain', couleur: '#0ea5e9' },
  { id: '607860847e79b65f245982db', reseau: 'Cars Région Drôme', couleur: '#0ea5e9', note: 'Flux mixte : les circuits scolaires sont écartés par le filtre général.' },
  { id: '61b36a0610344080a78cf407', reseau: 'Cars Région Express', couleur: '#0284c7' },
  { id: '678d0721a9efa066b6eed606', reseau: 'Transaltitude (stations de l’Isère)', navette: true },
  { id: '668d0a18a847603d391cbeec', reseau: 'ZOU ! Proximité', couleur: '#e11d48' },
  { id: '668d0a08a847603d391cbed7', reseau: 'ZOU ! Express', couleur: '#be123c' },
  { id: '69e2cd307123972d45a21d49', reseau: 'TER ZOU !', couleur: '#6366f1' },
  { id: '685baf2be31192d0ec7bcdc9', reseau: 'TER ZOU ! (Transdev Rail)', couleur: '#6366f1' },
  {
    id: '6853c089b3ed5781f6adfdf7',
    reseau: 'SNCF',
    couleur: '#6366f1',
    note: 'Flux national : seuls les trains régionaux (TER, Léman Express) sont gardés. Les TGV et Intercités relient les Alpes à des gares lointaines sans tracé officiel.',
    garderLigne: (route, agence) => !/tgv|inoui|ouigo|intercit|lyria|frecciarossa|eurostar/i.test(`${route.route_short_name} ${route.route_long_name} ${route.route_desc || ''} ${agence?.agency_name || ''}`),
  },

  // --- Réseaux urbains et intercommunaux des vallées ---
  { id: '5eb3510a4efd8f649ffe1b9f', reseau: 'Tougo (Grésivaudan)' },
  { id: '5af03701b595081c1880a8a4', reseau: 'TAG (Grenoble)' },
  { id: '5f581b61a3c659162a8f0772', reseau: 'Pays Voironnais' },
  { id: '6153ad370c072cfd9db0681a', reseau: 'Téléphérique de la Bastille' },
  { id: '5bae8c2806e3e75b699dc606', reseau: 'Synchro Bus (Chambéry)' },
  { id: '6026675fc02b24d37069f81a', reseau: 'Ondéa (Aix-les-Bains)' },
  { id: '6a60de39435de98c1708fe89', reseau: 'TRA Mobilité (Albertville)' },
  { id: '671f73739ffc1d041004ddf5', reseau: 'Arvan Bus (3CMA)' },
  { id: '5bd9843e634f413220f7f04a', reseau: 'Sibra (Annecy)' },
  { id: '616853a698450ae104dcab37', reseau: 'Jybus (Rumilly)' },
  { id: '6569e1dd21f63c926518143b', reseau: 'Chamonix Bus' },
  { id: '68b48c2486fd35d69fb0272e', reseau: 'ARVI (Cluses)' },
  { id: '69398942abbf3c01c143b6eb', reseau: 'Aravis Bus', navette: true },
  { id: '63b690e7498125c6c79a0b18', reseau: "EVA'D (Évian, vallée d'Abondance)" },
  { id: '6a32489a813e6bb04d3f5c27', reseau: "STAR'T (Thonon)" },
  { id: '5ca4bcec634f4125a78fad26', reseau: 'TAC (Annemasse)' },
  { id: '65a901970267d05025a905ec', reseau: 'Pays de Gex' },
  { id: '691711a8d9de4a5fcf95f6f1', reseau: "Mobi'Vals (Valserhône)" },
  { id: '6a22836013f1fd880c041222', reseau: 'Duobus (Oyonnax)' },
  { id: '63c562c646696c9cd83544b7', reseau: 'Altigo (Briançonnais)' },
  { id: '68e4f0acdd9bf1d1d9902276', reseau: 'Pays des Écrins' },
  { id: '67612c70408ff2fc34f1916d', reseau: 'Vaï (Embrun)' },
  { id: '65a7d7a7fbf0d8d41d572b1b', reseau: "L'Agglo en Bus (Gap)" },
  { id: '6357f252e8746ab0a790f68e', reseau: 'TUD (Digne-les-Bains)' },
  { id: '687aec884e4a0dd29c55372d', reseau: "Trans'Agglo (Manosque)" },
  { id: '685181f3733800e180c475fa', reseau: "Lignes d'Azur" },
  { id: '5bb49085634f4115ddc9293b', reseau: 'Zest (Menton, Roya)' },
  { id: '5bc59247634f417c808580b3', reseau: 'Sillages (Pays de Grasse)' },
  { id: '5b3b3de988ee38708ada1789', reseau: 'Métropole Aix-Marseille-Provence', note: 'Gros flux : seules les lignes proches des refuges (Sainte-Baume, Sainte-Victoire, lignes vers les Alpes) sont gardées.' },
  { id: '66da461b80f91630d0227702', reseau: "Mouv'enbus (Provence Verte)" },
  { id: '5f2c9a79e4e713875a58be26', reseau: 'Mobigo (Jura)' },

  // --- Navettes de stations et de vallées ---
  { id: '674ec12d71d8fc02e805a58c', reseau: 'Navettes du Guillestrois et du Queyras', navette: true },
  { id: '5e3c29156f444172fa4ec754', reseau: 'Valmobus (Valmorel)', navette: true },
  { id: '692838b1fc4de6dd2c95f1f2', reseau: 'Navettes hivernales Vaï', navette: true },
  { id: '6a06cbcfc1d6f3e3b9441b69', reseau: 'Navette Chorges – Chanteloube', navette: true },
  { id: '61fd29da29ea95c7bc0e1211', reseau: "Navettes de l'Alpe d'Huez", navette: true },
  { id: '69206120a3b522554e1a204a', reseau: 'Navettes des 2 Alpes', navette: true },
  { id: '6793a20138660ccb8785df10', reseau: 'Skibus Courchevel', navette: true },
  { id: '6936e58a20bc7a63a54c2e0f', reseau: 'Transport par câble de Courchevel' },
  { id: '6943c818433a7943c9834b7b', reseau: 'Skibus Vallée des Belleville', navette: true },
  { id: '676e6faa376ffb861e0197f5', reseau: 'Méribus', navette: true },
  { id: '6798942abc43332729738b53', reseau: "Navettes de Val d'Isère", navette: true },
  { id: '6798ab6ab1a98a9f0d4220c0', reseau: 'Navettes de Tignes', navette: true },
  { id: '67978852ec1bc7b5e4b1f3bd', reseau: 'Navettes de Bourg-Saint-Maurice', navette: true },
  { id: '6a47606c05be1f62b3ec5a32', reseau: 'Navettes de La Rosière', navette: true },
  { id: '69c3c79f37c9725d7b98bb91', reseau: "Télécabine Eau d'Olle Express" },
  { id: '6a2852b7baa58d82b47766ea', reseau: "Col'ette (Hauteluce – Les Saisies)", navette: true, note: "Absente de l'inventaire de l'étape 1 (flux hors saison au moment de la collecte)." },
  { id: '699573585cec51215c157895', reseau: 'Funiculaire des Arcs' },
  { id: '6a2f9a84779d9f873659ae48', reseau: 'Remontées mécaniques de Courchevel' },

  // --- Longue distance : désactivés pour l'instant (gares de vallée déjà couvertes par les TER et les cars) ---
  { id: '64635525318cc75a9a8a771f', reseau: 'Trenitalia', actif: false, note: 'Paris – Milan, sans tracé officiel.' },
  { id: '5cdef3698b4c416d21fd76b9', reseau: 'BlaBlaCar Bus', actif: false },
  { id: '5c6ad5248b4c411c3d7ae435', reseau: 'FlixBus', actif: false },
  { id: '63bc5f36f25deab1e855c0ff', reseau: 'Eurostar', actif: false },
];
