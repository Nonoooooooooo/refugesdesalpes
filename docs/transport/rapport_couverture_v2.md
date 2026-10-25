# Transport : inventaire des sources et couverture des refuges

*Étape 1 du chantier « Transport v2 » — généré le 2026-10-25 par `scripts/transport_v2/`. Données officielles collectées le 2026-10-25.*

## En bref

- **2080 hébergements analysés** (refuges gardés, cabanes non gardées, gîtes d'étape) : 1668 en France, dont 141 refuges gardés, et 412 en Suisse ou en Italie. Les chiffres qui suivent portent sur la France.
- **1177 (71 %)** ont aujourd'hui un arrêt avec horaires à moins de 5 km sur la carte.
- **3** ne sont desservis que par des lignes dessinées à la main, sans horaires.
- **44** pourraient être desservis simplement en important des données officielles qui existent déjà.
- **444** n'ont aucun arrêt officiel à moins de 5 km : c'est là qu'il faut chercher des navettes hors open data (PDF de communes, offices de tourisme, Parcs nationaux) — ou accepter qu'il n'y en a pas.
- **59 jeux de données officiels** ont des arrêts à moins de 5 km d'un refuge. La chaîne de mise à jour (sources.cjs) en suit 58. 0 ne sont pas (ou presque pas) sur la carte, et 1 y sont mais ne sont jamais mis à jour.
- **Hors de France**, seuls 36 des 412 hébergements ont un arrêt avec horaires à moins de 5 km. Les couvrir demanderait les données ouvertes suisses (opentransportdata.swiss) et italiennes, que transport.data.gouv.fr ne contient pas.

## Méthode et limites

- **Sources officielles** : tous les arrêts GTFS publiés sur transport.data.gouv.fr autour des refuges (110396 arrêts, 56 tuiles de 0,5°), via l'API `/api/gtfs-stops`, et le catalogue `/api/datasets` pour les dates de validité.
- **Carte analysée** : les 12424 arrêts des 666 lignes de `public/transports_v2.json`.
- **Distance à vol d'oiseau** entre le refuge et l'arrêt le plus proche. Ce n'est pas un temps de marche : un arrêt à 4 km peut être à 3 h de montée, et un arrêt de l'autre côté d'une crête ne sert à rien.
- Un arrêt officiel est compté comme **repris sur la carte** si un arrêt de la carte se trouve à moins de 200 m.
- Les **circuits scolaires** et les **lignes de covoiturage** sont exclus de la desserte. Les **agrégats régionaux** sont comptés à part, car ils regroupent des réseaux déjà publiés séparément.
- Un arrêt présent dans un flux ne garantit pas un service utile : une navette peut ne rouler qu'en hiver, ou quelques jours par an. La colonne validité du fichier CSV donne la période couverte par chaque flux.
- Les refuges hors de France (Suisse, Italie) ne peuvent pas être couverts par transport.data.gouv.fr.

## Couverture des refuges en France

| Situation | Total | refuge gardé | cabane non gardée | gîte d'étape |
|---|---|---|---|---|
| Desservi (arrêt avec horaires à ≤ 5 km) | 1177 (71 %) | 87 | 896 | 194 |
| Desservi seulement par une ligne sans horaires | 3 (0 %) | 1 | 2 | 0 |
| Récupérable : arrêt officiel à ≤ 5 km, absent de la carte | 42 (3 %) | 5 | 34 | 3 |
| Récupérable via l'agrégat régional uniquement | 2 (0 %) | 0 | 2 | 0 |
| Éloigné : arrêt officiel entre 5 et 10 km | 407 (24 %) | 47 | 308 | 52 |
| Aucun arrêt officiel à moins de 10 km | 37 (2 %) | 1 | 30 | 6 |

### Par département

| Département | Hébergements | Desservis | Sans horaires | Récupérables | Sans arrêt officiel à ≤ 5 km |
|---|---|---|---|---|---|
| 01 Ain | 42 | 42 (100 %) | 0 | 0 | 0 |
| 04 Alpes-de-Haute-Provence | 270 | 109 (40 %) | 0 | 2 | 159 |
| 05 Hautes-Alpes | 299 | 188 (63 %) | 3 | 10 | 98 |
| 06 Alpes-Maritimes | 58 | 33 (57 %) | 0 | 0 | 25 |
| 13 Bouches-du-Rhône | 5 | 5 (100 %) | 0 | 0 | 0 |
| 26 Drôme | 25 | 5 (20 %) | 0 | 14 | 6 |
| 38 Isère | 362 | 330 (91 %) | 0 | 12 | 20 |
| 39 Jura | 28 | 17 (61 %) | 0 | 0 | 11 |
| 73 Savoie | 378 | 283 (75 %) | 0 | 0 | 95 |
| 74 Haute-Savoie | 195 | 159 (82 %) | 0 | 6 | 30 |
| 83 Var | 4 | 4 (100 %) | 0 | 0 | 0 |
| 84 Vaucluse | 2 | 2 (100 %) | 0 | 0 | 0 |
| Hors France | 412 | 36 (9 %) | 1 | 13 | 362 |

## Sources officielles à intégrer

Jeux de données qui ont des arrêts près des refuges mais qui sont absents de la carte (moins de 50 % de leurs arrêts repris). « Refuges gagnés » = hébergements sans arrêt avec horaires à ≤ 5 km aujourd'hui, qui en auraient un avec ce réseau.

| Jeu de données | Refuges gagnés | Refuges à ≤ 5 km | Arrêts repris | Validité | Dernière mise à jour |
|---|---|---|---|---|---|

Réseaux longue distance également présents près des refuges, à intégrer en option pour l'accès aux vallées : Réseau européen BlaBlaCar Bus, Réseau européen FlixBus et FlixTrain, Réseau européen Eurostar.

## Sources déjà sur la carte mais jamais mises à jour

Ces réseaux ont été importés une fois mais ne font pas partie des sources suivies par la mise à jour : leurs horaires vieillissent sans qu'on le voie.

| Jeu de données | Arrêts repris | Refuges à ≤ 5 km | Validité du flux officiel | Dernière mise à jour officielle |
|---|---|---|---|---|
| [Réseau national Trenitalia France](https://transport.data.gouv.fr/datasets/horaires-des-trains-trenitalia-france) | 70 % | 2 | valide (2026-10-24 → 2026-12-11) | 2026-10-24 |

## Sources suivies par la mise à jour

| Jeu de données | Arrêts repris | Refuges à ≤ 5 km | Validité | Dernière mise à jour officielle |
|---|---|---|---|---|
| [Réseau interurbain et scolaire - Drôme (26)](https://transport.data.gouv.fr/datasets/reseau-interurbain-et-scolaire-cars-region-drome-26) | 18 % | 32 | valide (2026-09-10 → 2027-08-31) | 2026-10-07 |
| [Réseau interurbain - Isère (38)](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-isere-38-1) | 28 % | 298 | valide (2026-10-08 → 2027-08-31) | 2026-10-16 |
| [Réseau interurbain bus Proximité ZOU !](https://transport.data.gouv.fr/datasets/lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-proximite-3-3) | 41 % | 158 | valide (2026-10-21 → 2027-04-21) | 2026-10-24 |
| [Réseau urbain Pays des Ecrins](https://transport.data.gouv.fr/datasets/transports-en-commun-pays-des-ecrins) | 68 % | 39 | valide (2024-10-16 → 2026-12-31) | 2026-10-24 |
| [Réseau urbain Sibra](https://transport.data.gouv.fr/datasets/offre-de-transports-sibra-a-annecy-gtfs) | 51 % | 53 | valide (2026-10-01 → 2026-12-20) | 2026-10-01 |
| [Réseau urbain et interurbain Altigo](https://transport.data.gouv.fr/datasets/donnees-de-transport-en-commun-reseau-altigo-communaute-de-communes-du-brianconnais-format-gtfs) | 93 % | 36 | valide (2026-09-14 → 2027-12-31) | 2026-09-29 |
| [Réseau urbain EVA'D](https://transport.data.gouv.fr/datasets/donnees-du-reseau-evad-1) | 59 % | 16 | valide (2026-09-04 → 2026-12-20) | 2026-09-08 |
| [Réseau interurbain - Haute-Savoie (74)](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-haute-savoie-74) | 96 % | 149 | valide (2026-10-08 → 2027-08-31) | 2026-10-15 |
| [Réseau SNCF TGV, Intercités et TER](https://transport.data.gouv.fr/datasets/horaires-sncf) | 71 % | 218 | valide (2026-10-24 → 2027-03-31) | 2026-10-24 |
| [Réseau interurbain - Savoie (73)](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-savoie-73) | 98 % | 156 | valide (2026-09-10 → 2027-08-31) | 2026-10-23 |
| [Réseau interurbain Express ZOU !](https://transport.data.gouv.fr/datasets/lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-express-3-3) | 74 % | 139 | valide (2026-10-21 → 2027-04-22) | 2026-10-24 |
| [Réseaux urbains de la Métropole Aix-Marseille-Provence](https://transport.data.gouv.fr/datasets/reseaux-de-transports-en-commun-de-la-metropole-daix-marseille-provence-et-des-bouches-du-rhone) | 6 % | 112 | valide (2026-09-19 → 2027-07-03) | 2026-10-25 |
| [Réseau urbain Tougo](https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-tougo) | 84 % | 102 | valide (2026-08-20 → 2027-08-31) | 2026-10-16 |
| [Navettes saisonnières Transaltitude - Isère](https://transport.data.gouv.fr/datasets/desserte-des-stations-de-ski-iseroises-transaltitude-38) | 94 % | 97 | à venir (2026-11-28 → 2027-04-25) | 2026-10-16 |
| [Réseau urbain TRA Mobilité](https://transport.data.gouv.fr/datasets/tra-mobilite-horaires-du-reseau-dalbertville) | 100 % | 77 | valide (2026-01-02 → 2026-12-31) | 2026-01-22 |
| [Réseau urbain TAG](https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-tag) | 78 % | 75 | valide (2026-10-15 → 2026-12-31) | 2026-10-22 |
| [Trains régionaux ZOU !](https://transport.data.gouv.fr/datasets/trains-zou-en-provence-alpes-cote-dazur) | 74 % | 51 | valide (2026-10-23 → 2027-04-23) | 2026-04-17 |
| [Réseau interurbain - Ain (01)](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-ain-01) | 35 % | 47 | valide (2026-09-10 → 2027-08-31) | 2026-10-24 |
| [Navettes saisonnières de la CC du Guillestrois et du Queyras](https://transport.data.gouv.fr/datasets/reseau-de-transports-collectifs-de-la-ccgq) | 99 % | 46 | périmé (2025-12-20 → 2026-09-06) | 2026-08-17 |
| [Réseau urbain Synchro Bus](https://transport.data.gouv.fr/datasets/arrets-et-horaires-theoriques-bus-temps-reel) | 65 % | 42 | valide (2026-10-21 → 2026-12-20) | 2026-10-19 |
| [Réseau urbain Chamonix](https://transport.data.gouv.fr/datasets/gtfs-reseau-chamonix-mobilite) | 98 % | 42 | valide (2026-08-07 → 2026-12-18) | 2026-09-24 |
| [Réseau urbain ARAVIS Bus](https://transport.data.gouv.fr/datasets/aravis-bus-hiver-2025-2026) | 100 % | 40 | périmé (2026-06-20 → 2026-09-05) | 2026-06-05 |
| [Navettes saisonnières Valmobus](https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reel-de-la-station-de-ski-valmorel-gtfs-gtfs-rt) | 100 % | 34 | inconnue | 2026-09-15 |
| [Réseau interurbain Cars Région Express](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-express) | 92 % | 29 | valide (2026-10-19 → 2027-01-17) | 2026-10-12 |
| [Navettes hivernales réseau Vaï](https://transport.data.gouv.fr/datasets/navettes-stations-hiver-2025-2026-reseau-vai) | 100 % | 27 | périmé (2025-12-06 → 2026-04-10) | 2025-12-30 |
| [Réseau urbain Lignes d'Azur](https://transport.data.gouv.fr/datasets/donnees-statiques-et-dynamiques-du-reseau-de-transport-lignes-dazur) | 61 % | 24 | valide (2026-10-23 → 2026-12-31) | 2026-09-17 |
| [Réseau interurbain Mobigo](https://transport.data.gouv.fr/datasets/reseau-de-transport-interurbain-mobigo-en-bourgogne-franche-comte) | 24 % | 23 | valide (2026-10-21 → 2027-08-31) | 2026-09-21 |
| [Réseau urbain Transports du Pays Voironnais](https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transport-du-pays-voironnais) | 53 % | 21 | valide (2025-09-01 → 2027-08-31) | 2026-09-22 |
| [Réseau urbain Ondéa](https://transport.data.gouv.fr/datasets/ctlb-donnees-theoriques-et-rt-aix-les-bains-lac-du-bourget) | 31 % | 21 | valide (2026-10-17 → 2027-03-31) | 2026-09-08 |
| [Navettes hivernales de l'Alpe d'Huez](https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reel-des-navettes-hivernales-de-lalpe-dhuez-gtfs-gtfs-rt) | 99 % | 21 | inconnue | 2026-09-01 |
| [Réseau urbain du Pays de Gex](https://transport.data.gouv.fr/datasets/transports-publics-urbains-sur-le-territoire-de-la-ca-du-pays-de-gex-1) | 52 % | 14 | valide (2025-12-14 → 2026-12-12) | 2026-02-27 |
| [Navettes hivernales Skibus Courchevel](https://transport.data.gouv.fr/datasets/skibus-courchevel-hiver) | 77 % | 10 | périmé (2026-07-01 → 2026-08-23) | 2026-07-03 |
| [Navettes Skibus Vallée des Belleville](https://transport.data.gouv.fr/datasets/skibus-vallee-des-belleville) | 79 % | 10 | périmé (2026-07-01 → 2026-08-31) | 2026-07-01 |
| [Réseau urbain 3CMA](https://transport.data.gouv.fr/datasets/transport-urbain-3cma-bus) | 80 % | 8 | valide (2026-07-01 → 2026-12-31) | 2026-06-30 |
| [Navettes saisonnières Val d'Isère](https://transport.data.gouv.fr/datasets/navettes-val-disere) | 98 % | 8 | inconnue | 2026-09-01 |
| [Réseau urbain Mobi'Vals](https://transport.data.gouv.fr/datasets/mobivals-horaires-theoriques-du-reseau-de-transport-urbain-de-valserhone) | 90 % | 7 | valide (2026-08-17 → 2027-08-14) | 2026-09-18 |
| [Télécabine Eau d'Olle Express (Allemond - Oz)](https://transport.data.gouv.fr/datasets/telecabine-eau-dolle-express-allemond-oz) | 100 % | 7 | valide (2025-12-06 → 2027-04-19) | 2026-08-31 |
| [Réseau urbain ARVI](https://transport.data.gouv.fr/datasets/gtfs-rentree) | 60 % | 6 | valide (2026-09-01 → 2027-08-31) | 2026-10-12 |
| [Navettes hivernales des 2 Alpes](https://transport.data.gouv.fr/datasets/gtfs-les-2alpes-saison-hiver-2025-2026) | 100 % | 5 | périmé (2026-05-04 → 2026-07-04) | 2026-06-02 |
| [Navettes saisonnières Bourg-Saint-Maurice](https://transport.data.gouv.fr/datasets/navettes-bourg-saint-maurice) | 40 % | 5 | valide (2026-08-21 → 2026-12-04) | 2026-09-08 |
| [Réseau urbain Vaï Embrun](https://transport.data.gouv.fr/datasets/reseau-vai-embrun) | 100 % | 4 | valide (2026-09-01 → 2027-08-31) | 2026-08-18 |
| [Réseau urbain et scolaire Sillages](https://transport.data.gouv.fr/datasets/lignes-regulieres-de-transports-sillages-en-pays-de-grasse-urbain-et-scolaire) | 37 % | 3 | valide (2026-07-01 → 2027-08-31) | 2026-09-07 |
| [Réseau urbain Jybus](https://transport.data.gouv.fr/datasets/offre-de-transports-jybus-a-rumilly) | 14 % | 3 | valide (2026-08-06 → 2027-07-03) | 2026-08-07 |
| [Navettes estivales Chorges - Chanteloube](https://transport.data.gouv.fr/datasets/navette-chorges-chanteloube-ete-2026-reseau-vai) | 100 % | 3 | périmé (2026-07-04 → 2026-08-23) | 2026-05-15 |
| [Réseau urbain Zest](https://transport.data.gouv.fr/datasets/horaires-reseau-zest) | 20 % | 2 | valide (2026-09-17 → 2027-07-04) | 2026-09-18 |
| [Réseau urbain et interurbain Trans'Agglo](https://transport.data.gouv.fr/datasets/reseau-de-transport-en-commun-trans-agglo-de-dlva) | 90 % | 2 | valide (2024-05-01 → 2026-12-31) | 2026-01-07 |
| [Réseau urbain TAC Mobilité](https://transport.data.gouv.fr/datasets/offre-de-transports-reseau-tac-annemasse-agglo) | 40 % | 2 | valide (2026-08-31 → 2027-08-31) | 2026-08-30 |
| [Réseau urbain TUD](https://transport.data.gouv.fr/datasets/reseau-de-transport-urbains-dignois) | 97 % | 2 | valide (2026-01-02 → 2026-12-31) | 2026-04-24 |
| [Navettes saisonnières Tignes](https://transport.data.gouv.fr/datasets/navettes-tignes) | 100 % | 2 | inconnue | 2026-09-07 |
| [Trains régionaux ZOU ! - Transdev Rail Sud Intermétropole](https://transport.data.gouv.fr/datasets/zou) | 67 % | 2 | valide (2026-10-25 → 2027-05-12) | 2026-10-05 |
| [Téléphérique de la Bastille - Bulles de Grenoble](https://transport.data.gouv.fr/datasets/horaires-theoriques-du-telepherique-de-la-bastille) | 100 % | 2 | valide (2025-12-01 → 2027-01-03) | 2026-01-15 |
| [Réseau urbain Mouv'enbus](https://transport.data.gouv.fr/datasets/reseau-transport-mouv-enbus-agglomeration-provence-verte) | 0 % | 1 | valide (2026-08-01 → 2027-08-31) | 2026-08-26 |
| [Réseaux urbains STAR'T](https://transport.data.gouv.fr/datasets/start-horaires-du-reseau-de-lagglomeration-de-thonon) | 20 % | 1 | valide (2026-09-01 → 2026-12-20) | 2026-08-31 |
| [Réseau urbain L'Agglo en Bus](https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reels-du-reseau-de-transports-lagglo-en-bus-communaute-dagglomeration-gap-tallard-durance) | 99 % | 1 | valide (2025-12-17 → 2026-12-31) | 2026-10-24 |
| [Réseau urbain Duobus](https://transport.data.gouv.fr/datasets/duobus-horaires-du-reseau-doyonnax-01) | 99 % | 1 | valide (2026-01-26 → 2027-12-31) | 2026-01-26 |
| [Navette saisonnière Méribus](https://transport.data.gouv.fr/datasets/meribus-ete) | 45 % | 1 | périmé (2026-07-04 → 2026-08-30) | 2026-06-19 |
| [Navettes estivales La Rosière](https://transport.data.gouv.fr/datasets/navettes-la-rosiere) | 100 % | 1 | périmé (2026-06-27 → 2026-09-04) | 2026-07-03 |
| [Transport par câble hivernal Courchevel](https://transport.data.gouv.fr/datasets/transport-urbain-par-cable-hiver-2025-26) | 100 % | 1 | périmé (2025-12-05 → 2026-04-19) | 2025-12-11 |
| [Funiculaire des Arcs](https://transport.data.gouv.fr/datasets/funiculaire-des-arcs) | 25 % | 0 | à venir (2026-12-12 → 2027-04-25) | 2026-10-13 |

## Agrégats régionaux

| Jeu de données | Arrêts dans la zone | Refuges à ≤ 5 km | Validité | Dernière mise à jour |
|---|---|---|---|---|
| [Agrégat des réseaux urbains et interurbains d'Auvergne-Rhône-Alpes](https://transport.data.gouv.fr/datasets/agregat-oura) | 14154 | 658 | valide (2026-10-25 → 2028-06-30) | 2026-10-25 |

2 hébergements ne sont proches que d'arrêts présents dans un agrégat (et dans aucun flux séparé).

**L'agrégat ne remplace pas les flux séparés.** Part des arrêts de chaque réseau (à moins de 5 km d'au moins 5 refuges) que l'on retrouve dans un agrégat. Les réseaux de la région Sud (ZOU !, Altigo, Queyras…) n'ont pas d'agrégat : 0 % est normal pour eux.

| Réseau | Refuges à ≤ 5 km | Arrêts présents dans un agrégat |
|---|---|---|
| Réseaux urbains de la Métropole Aix-Marseille-Provence | 112 | 0 % |
| Navettes saisonnières de la CC du Guillestrois et du Queyras | 46 | 0 % |
| Réseau urbain Pays des Ecrins | 39 | 0 % |
| Réseau urbain et interurbain Altigo | 36 | 0 % |
| Navettes saisonnières Valmobus | 34 | 0 % |
| Navettes hivernales réseau Vaï | 27 | 0 % |
| Réseau urbain Lignes d'Azur | 24 | 0 % |
| Navettes hivernales Skibus Courchevel | 10 | 0 % |
| Navettes Skibus Vallée des Belleville | 10 | 0 % |
| Réseau urbain 3CMA | 8 | 0 % |
| Navettes saisonnières Val d'Isère | 8 | 0 % |
| Réseau interurbain bus Proximité ZOU ! | 158 | 2 % |
| Réseau interurbain Mobigo | 23 | 2 % |
| Réseau urbain ARVI | 6 | 3 % |
| Réseau urbain Tougo | 102 | 6 % |
| Navettes saisonnières Bourg-Saint-Maurice | 5 | 6 % |
| Réseau interurbain Express ZOU ! | 139 | 10 % |
| Réseau urbain TAG | 75 | 12 % |
| Réseau urbain Sibra | 53 | 15 % |
| Réseau urbain du Pays de Gex | 14 | 15 % |
| Trains régionaux ZOU ! | 51 | 23 % |
| Réseau interurbain - Savoie (73) | 156 | 33 % |
| Réseau SNCF TGV, Intercités et TER | 218 | 38 % |
| Réseau urbain Transports du Pays Voironnais | 21 | 39 % |
| Télécabine Eau d'Olle Express (Allemond - Oz) | 7 | 50 % |
| Navettes hivernales des 2 Alpes | 5 | 55 % |
| Navettes hivernales de l'Alpe d'Huez | 21 | 60 % |
| Navettes saisonnières Transaltitude - Isère | 97 | 83 % |
| Réseau urbain EVA'D | 16 | 92 % |
| Réseau urbain ARAVIS Bus | 40 | 96 % |
| Réseau urbain Ondéa | 21 | 99 % |
| Réseau interurbain - Isère (38) | 298 | 100 % |
| Réseau interurbain - Haute-Savoie (74) | 149 | 100 % |
| Réseau urbain TRA Mobilité | 77 | 100 % |
| Réseau interurbain - Ain (01) | 47 | 100 % |
| Réseau urbain Synchro Bus | 42 | 100 % |
| Réseau urbain Chamonix | 42 | 100 % |
| Réseau interurbain et scolaire - Drôme (26) | 32 | 100 % |
| Réseau interurbain Cars Région Express | 29 | 100 % |
| Réseau urbain Mobi'Vals | 7 | 100 % |

## Où chercher les navettes manquantes

Communes qui comptent le plus de **refuges gardés** sans aucun arrêt officiel à moins de 5 km (et sans arrêt avec horaires sur la carte). Ce sont les meilleures pistes pour trouver des navettes estivales publiées seulement en PDF.

| Commune | Refuges gardés | Arrêt officiel le plus proche | Refuges |
|---|---|---|---|
| Chamonix-Mont-Blanc (74) | 4 | 5,7 km (GREPON LE TREMPLIN, Réseau urbain Chamonix) | Refuge d'Argentière, Refuge du Requin, Refuge de Leschaux, Refuge du Couvercle |
| Saint-Christophe-en-Oisans (38) | 4 | 5,1 km (Les Etages, Réseau interurbain - Isère (38)) | Refuge de la Selle, Refuge de la Pilatte, Refuge du Promontoire, Refuge de Temple Ecrins |
| Névache (05) | 3 | 5,8 km (NEVACHE- VILLE HAUTE- OT, Réseau urbain et interurbain Altigo) | Auberge & Refuge de la Fruitière (Fontcouverte, Névache), Refuge de Ricou, Refuge des Drayères |
| Val-Cenis (73) | 3 | 5,5 km (Bramans - Lenfrey, Réseau interurbain - Savoie (73)) | Refuge d'Ambin, Refuge-gîte du Suffet, Refuge de la Femma |
| Bourg-Saint-Maurice (73) | 2 | 6,1 km (Le Barattet, Réseau interurbain - Haute-Savoie (74)) | Refuge de la Croix du Bonhomme, Refuge Robert Blanc |
| Champagny-en-Vanoise (73) | 2 | 7 km (Grande Motte (12), Navettes saisonnières Tignes) | Refuge de Plaisance, Refuge de la Glière |
| La Plagne Tarentaise (73) | 2 | 7,5 km (La Résidence, Navettes saisonnières Bourg-Saint-Maurice) | Refuge de la Balme, Refuge de Presset |
| Pralognan-la-Vanoise (73) | 2 | 5,5 km (La Grande Cordée, Réseau interurbain - Savoie (73)) | Refuge du Col de la Vanoise, Refuge de Peclet-Polset |
| Saint-Martin-Vésubie (06) | 2 | 7,2 km (Centre de Cure Thermale, Réseau urbain Lignes d'Azur) | Refuge de la Cougourde, Gîte-Refuge de la Madone de Fenestre |
| Tende (06) | 2 | 5 km (Castérino, Réseau urbain Zest) | Refuge des Merveilles, Refuge CAF de la Valmasque |
| Villar-d'Arêne (05) | 2 | 5,8 km (VILLAR D'ARENE- GROUPE SCOLAIRE LA MEIJE, Réseau urbain et interurbain Altigo) | Refuge Adèle Planchard, Refuge du Pavé |
| Abriès-Ristolas (05) | 1 | 7,9 km (L'Echalp, Navettes saisonnières de la CC du Guillestrois et du Queyras) | Refuge du Viso |
| Aime-la-Plagne (73) | 1 | 7,7 km (Le Bois, Réseau urbain TRA Mobilité) | Refuge de la Coire |
| Aussois (73) | 1 | 5,8 km (Office de Tourisme, Réseau interurbain - Savoie (73)) | Refuge du fond d'Aussois |
| Beaufort (73) | 1 | 7,8 km (Arêches Place Capitaine Bulle, Réseau urbain TRA Mobilité) | Refuge du Plan de la Lai |
| Bellecombe-en-Bauges (73) | 1 | 5,6 km (Marceau la Plaine, Réseau interurbain - Haute-Savoie (74)) | Refuge de Bornette |
| Belvédère (06) | 1 | 8,6 km (Castérino, Réseau urbain Zest) | Refuge de Nice |
| Blieux (04) | 1 | 8 km (Village, Réseau interurbain bus Proximité ZOU !) | Refuge du mont Chiran |
| Bonneval-sur-Arc (73) | 1 | 7,6 km (Patinoire, Réseau interurbain - Savoie (73)) | Refuge du Carro |
| Cervières (05) | 1 | 7,2 km (CERVIERES- LE LAUS DE CERVIERES, Réseau urbain et interurbain Altigo) | Refuge des Fonts de Cervières |
| Champoléon (05) | 1 | 7,7 km (Orcières 1850 - Gare Routière, Réseau interurbain bus Proximité ZOU !) | Refuge du Pré de La Chaumette |
| Modane (73) | 1 | 7,1 km (VALFREJUS, Réseau interurbain - Savoie (73)) | Refuge du Mont Thabor |
| Orelle (73) | 1 | 7,2 km (VALFREJUS, Réseau interurbain - Savoie (73)) | Refuge des Marches |
| Passy (74) | 1 | 5,6 km (Gare Routiere, Réseau interurbain - Haute-Savoie (74)) | Refuge Alfred Wills (Anterne) |
| Prads-Haute-Bléone (04) | 1 | 8 km (Le Moulin, Réseaux urbains de la Métropole Aix-Marseille-Provence) | Refuge de la Gorgerette (Relais montagne de la crête de Cadun) |
| Saint-Étienne-de-Tinée (06) | 1 | 6,8 km (Collège Jean Franco, Réseau urbain Lignes d'Azur) | Refuge des lacs de Vens |
| Saint-Gervais-les-Bains (74) | 1 | 5,2 km (La Faviere, Réseau interurbain - Haute-Savoie (74)) | Refuge de Plan Glacier |
| Saint-Paul-sur-Ubaye (04) | 1 | 11,1 km (Chaurionde, Navettes saisonnières de la CC du Guillestrois et du Queyras) | Refuge de Chambeyron |
| Sainte-Foy-Tarentaise (73) | 1 | 5,9 km (Les Eucherts - Plan de l'Arc, Navettes estivales La Rosière) | Refuge du Ruitor |
| Valjouffrey (38) | 1 | 7,9 km (Champhorent, Réseau interurbain - Isère (38)) | Refuge de Font Turbat |
| Valmeinier (73) | 1 | 6,3 km (Le Pont du Moulin, Réseau interurbain - Savoie (73)) | Refuge de Terre Rouge |

Liste complète (444 hébergements en France, toutes catégories) : filtrer la colonne « Situation » de `couverture_refuges.csv`.

## Refuges gardés desservis seulement par des lignes sans horaires

Ces refuges dépendent de lignes ajoutées à la main. Si un arrêt officiel est proche, on peut remplacer la ligne manuelle par la vraie ; sinon il faut vérifier qu'elle existe encore.

| Refuge | Ligne de la carte | Arrêt officiel le plus proche |
|---|---|---|
| Refuge Agnel | Navettes du Guillestrois et du Queyras (1 km) | aucun à ≤ 5 km |

## Relancer l’analyse

```bash
node scripts/transport_v2/1_collecter_sources.cjs
node scripts/transport_v2/2_analyser_couverture.cjs
```

Le premier script interroge transport.data.gouv.fr et geo.api.gouv.fr (environ une minute) et met les réponses en cache dans `imports/transport_v2/`. Le second travaille hors ligne et régénère ce rapport et les deux fichiers CSV.
