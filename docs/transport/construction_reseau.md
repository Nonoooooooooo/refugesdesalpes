# Transport : construction du réseau à partir des sources officielles

*Étape 2 du chantier « Transport v2 » — généré le 2026-10-25 par `scripts/transport_v2/3_construire_reseau.cjs`.*

## En bref

- **666 lignes** construites depuis 57 sources officielles. Une ligne est gardée si elle offre l'un des meilleurs accès à un refuge, une cabane ou un gîte : un arrêt à moins de 5 km, au plus 1,5 km plus loin que l'arrêt officiel le plus proche de cet hébergement.
- **134 lignes hors saison** : leur flux ne contient plus de date à venir. Elles sont affichées avec les horaires de leur dernière saison et la mention « Hors saison ».
- **135 lignes sans tracé officiel** : le flux ne fournit pas le dessin de la ligne, elle est tracée d'arrêt en arrêt.
- **14 trains en double écartés** : publiés à la fois par la région et dans le flux national SNCF.
- Les circuits scolaires sont écartés, y compris ceux qui ne sont pas déclarés comme tels (service en semaine uniquement, 1 ou 2 départs, terminus dans un collège, un lycée ou une école).
- **8 navettes hors open data** ajoutées à la main avec leur source officielle (voir plus bas).
- **4 sources publient un flux vide** en ce moment (Valmobus (Valmorel), Navettes de l'Alpe d'Huez, Navettes de Val d'Isère, Navettes de Tignes) : l'éditeur retire ses lignes entre deux saisons. Leur dernière version remplie, gardée dans `scripts/transport_v2/archives/`, est affichée en « Hors saison ».
- Chaque grille horaire correspond à un **jour type réel** (semaine, samedi, dimanche) et chaque colonne à **un même départ**.

## Sources

| Réseau | Lignes | Hors saison | Sans tracé | Ressources utilisées | Remarques |
|---|---|---|---|---|---|
| [Cars Région Isère](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-isere-38-1) | 56 | 0 | 0 | 40287 (2026-10-08 → 2027-08-31) | 40287 : 151/498 lignes près des refuges, 95 scolaires écartées |
| [Cars Région Savoie](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-savoie-73) | 28 | 0 | 0 | 81244 (2026-09-10 → 2027-08-31), 84247 (2026-05-04 → 2027-10-25) | 81244 : 6/8 lignes près des refuges ; 84247 : 22/22 lignes près des refuges |
| [Cars Région Haute-Savoie](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-haute-savoie-74) | 21 | 0 | 0 | 80964 (2026-10-08 → 2027-08-31) | 80964 : 21/24 lignes près des refuges |
| [Cars Région Ain](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-ain-01) | 6 | 0 | 0 | 83113 (2026-09-10 → 2027-08-31) | 83113 : 7/31 lignes près des refuges, 1 scolaires écartées |
| [Cars Région Drôme](https://transport.data.gouv.fr/datasets/reseau-interurbain-et-scolaire-cars-region-drome-26) | 3 | 0 | 0 | 80960 (2026-09-10 → 2027-08-31) | 80960 : 13/134 lignes près des refuges, 10 scolaires écartées |
| [Cars Région Express](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-express) | 4 | 0 | 0 | 83112 (2026-10-19 → 2027-01-17) | 83112 : 4/13 lignes près des refuges |
| [Transaltitude (stations de l’Isère)](https://transport.data.gouv.fr/datasets/desserte-des-stations-de-ski-iseroises-transaltitude-38) | 10 | 0 | 0 | 82729 (2026-11-28 → 2027-04-25) | 82729 : 10/13 lignes près des refuges |
| [ZOU ! Proximité](https://transport.data.gouv.fr/datasets/lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-proximite-3-3) | 40 | 0 | 0 | 82137 (2026-10-21 → 2027-04-21) | 82137 : 44/122 lignes près des refuges, 4 scolaires écartées |
| [ZOU ! Express](https://transport.data.gouv.fr/datasets/lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-express-3-3) | 19 | 0 | 0 | 82285 (2026-10-21 → 2027-04-22) | 82285 : 23/68 lignes près des refuges |
| [TER ZOU !](https://transport.data.gouv.fr/datasets/trains-zou-en-provence-alpes-cote-dazur) | 4 | 0 | 0 | 83990 (2026-10-23 → 2027-04-23) | 83990 : 14/46 lignes près des refuges |
| [TER ZOU ! (Transdev Rail)](https://transport.data.gouv.fr/datasets/zou) | 0 | 0 | 0 | 83448 (2026-10-25 → 2027-05-12) | 83448 : 0/1 lignes près des refuges |
| [SNCF](https://transport.data.gouv.fr/datasets/horaires-sncf) | 34 | 0 | 34 | 83582 (2026-10-24 → 2027-03-31) | 83582 : 51/774 lignes près des refuges, 5 écartées par le filtre |
| [Tougo (Grésivaudan)](https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-tougo) | 42 | 5 | 29 | 81794 (2026-08-20 → 2027-08-31) | 81794 : 60/72 lignes près des refuges, 18 scolaires écartées |
| [TAG (Grenoble)](https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-tag) | 35 | 0 | 5 | 83459 (2026-10-15 → 2026-12-31) | 83459 : 35/54 lignes près des refuges |
| [Pays Voironnais](https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transport-du-pays-voironnais) | 19 | 0 | 2 | 83462 (2025-09-01 → 2027-08-31) | 83462 : 40/86 lignes près des refuges, 21 scolaires écartées |
| [Téléphérique de la Bastille](https://transport.data.gouv.fr/datasets/horaires-theoriques-du-telepherique-de-la-bastille) | 1 | 0 | 1 | 81618 (2025-12-01 → 2027-01-03) | 81618 : 1/1 lignes près des refuges |
| [Synchro Bus (Chambéry)](https://transport.data.gouv.fr/datasets/arrets-et-horaires-theoriques-bus-temps-reel) | 11 | 0 | 0 | 82272 (2026-10-21 → 2026-12-20) | 82272 : 14/26 lignes près des refuges, 3 scolaires écartées |
| [Ondéa (Aix-les-Bains)](https://transport.data.gouv.fr/datasets/ctlb-donnees-theoriques-et-rt-aix-les-bains-lac-du-bourget) | 5 | 0 | 0 | 71223 (2026-10-17 → 2027-03-31) | 71223 : 14/64 lignes près des refuges, 9 scolaires écartées |
| [TRA Mobilité (Albertville)](https://transport.data.gouv.fr/datasets/tra-mobilite-horaires-du-reseau-dalbertville) | 11 | 0 | 0 | 84135 (2026-01-02 → 2026-12-31) | 84135 : 11/11 lignes près des refuges |
| [Arvan Bus (3CMA)](https://transport.data.gouv.fr/datasets/transport-urbain-3cma-bus) | 5 | 1 | 0 | 83258 (2026-07-01 → 2026-12-31) | 83258 : 5/9 lignes près des refuges |
| [Sibra (Annecy)](https://transport.data.gouv.fr/datasets/offre-de-transports-sibra-a-annecy-gtfs) | 11 | 0 | 0 | 80100 (2026-10-01 → 2026-12-20) | 80100 : 11/28 lignes près des refuges |
| [Jybus (Rumilly)](https://transport.data.gouv.fr/datasets/offre-de-transports-jybus-a-rumilly) | 0 | 0 | 0 | 80092 (2026-08-06 → 2027-07-03) | 80092 : 0/5 lignes près des refuges |
| [Chamonix Bus](https://transport.data.gouv.fr/datasets/gtfs-reseau-chamonix-mobilite) | 18 | 3 | 0 | 82663 (2026-08-07 → 2026-12-18) | 82663 : 23/23 lignes près des refuges, 5 scolaires écartées |
| [ARVI (Cluses)](https://transport.data.gouv.fr/datasets/gtfs-rentree) | 5 | 0 | 0 | 83578 (2026-09-01 → 2027-08-31), 84192 (2026-09-07 → 2026-10-16) | 83578 : 5/8 lignes près des refuges ; 84192 : 4/7 lignes près des refuges |
| [Aravis Bus](https://transport.data.gouv.fr/datasets/aravis-bus-hiver-2025-2026) | 39 | 39 | 0 | 84055 (2026-06-20 → 2026-09-05), 83755 (2025-12-02 → 2026-04-26) | 84055 : 12/13 lignes près des refuges ; 83755 : 27/29 lignes près des refuges |
| [EVA'D (Évian, vallée d'Abondance)](https://transport.data.gouv.fr/datasets/donnees-du-reseau-evad-1) | 6 | 0 | 0 | 83746 (2025-02-12 → 2026-07-04), 80973 (2026-09-04 → 2026-12-20) | 83746 : 22/67 lignes près des refuges, 22 scolaires écartées ; 80973 : 6/10 lignes près des refuges |
| [STAR'T (Thonon)](https://transport.data.gouv.fr/datasets/start-horaires-du-reseau-de-lagglomeration-de-thonon) | 1 | 0 | 0 | 84108 (2026-09-01 → 2026-12-20) | 84108 : 4/25 lignes près des refuges, 3 scolaires écartées |
| [TAC (Annemasse)](https://transport.data.gouv.fr/datasets/offre-de-transports-reseau-tac-annemasse-agglo) | 1 | 0 | 0 | 76779 (2026-08-31 → 2027-08-31) | 76779 : 1/8 lignes près des refuges |
| [Pays de Gex](https://transport.data.gouv.fr/datasets/transports-publics-urbains-sur-le-territoire-de-la-ca-du-pays-de-gex-1) | 4 | 0 | 4 | 81585 (2025-12-14 → 2026-12-12) | 81585 : 4/9 lignes près des refuges |
| [Mobi'Vals (Valserhône)](https://transport.data.gouv.fr/datasets/mobivals-horaires-theoriques-du-reseau-de-transport-urbain-de-valserhone) | 6 | 0 | 0 | 83633 (2026-08-17 → 2027-08-14) | 83633 : 8/10 lignes près des refuges, 2 scolaires écartées |
| [Duobus (Oyonnax)](https://transport.data.gouv.fr/datasets/duobus-horaires-du-reseau-doyonnax-01) | 8 | 0 | 0 | 84112 (2026-01-26 → 2027-12-31) | 84112 : 8/8 lignes près des refuges |
| [Altigo (Briançonnais)](https://transport.data.gouv.fr/datasets/donnees-de-transport-en-commun-reseau-altigo-communaute-de-communes-du-brianconnais-format-gtfs) | 16 | 0 | 16 | 81455 (2026-09-14 → 2027-12-31) | 81455 : 25/27 lignes près des refuges, 9 scolaires écartées |
| [Pays des Écrins](https://transport.data.gouv.fr/datasets/transports-en-commun-pays-des-ecrins) | 5 | 3 | 0 | 83467 (2024-10-16 → 2026-12-31) | 83467 : 5/5 lignes près des refuges |
| [Vaï (Embrun)](https://transport.data.gouv.fr/datasets/reseau-vai-embrun) | 2 | 0 | 0 | 84175 (2026-09-01 → 2027-08-31) | 84175 : 2/2 lignes près des refuges |
| [L'Agglo en Bus (Gap)](https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reels-du-reseau-de-transports-lagglo-en-bus-communaute-dagglomeration-gap-tallard-durance) | 14 | 0 | 1 | 81547 (2025-12-17 → 2026-12-31) | 81547 : 14/14 lignes près des refuges |
| [TUD (Digne-les-Bains)](https://transport.data.gouv.fr/datasets/reseau-de-transport-urbains-dignois) | 4 | 0 | 0 | 81367, 83915 (2026-01-02 → 2026-12-31) | 81367 : 5/5 lignes près des refuges, 1 scolaires écartées ; 83915 : 5/5 lignes près des refuges, 1 scolaires écartées |
| [Trans'Agglo (Manosque)](https://transport.data.gouv.fr/datasets/reseau-de-transport-en-commun-trans-agglo-de-dlva) | 23 | 1 | 21 | 83291 (2026-02-03 → 2026-12-31), 83789 (2024-05-01 → 2026-12-31) | 83291 : 22/41 lignes près des refuges, 1 scolaires écartées ; 83789 : 23/41 lignes près des refuges, 1 scolaires écartées |
| [Lignes d'Azur](https://transport.data.gouv.fr/datasets/donnees-statiques-et-dynamiques-du-reseau-de-transport-lignes-dazur) | 42 | 0 | 0 | 83178 (2026-10-23 → 2026-12-31) | 83178 : 45/107 lignes près des refuges, 3 scolaires écartées |
| [Zest (Menton, Roya)](https://transport.data.gouv.fr/datasets/horaires-reseau-zest) | 1 | 0 | 0 | 79559 (2026-09-17 → 2027-07-04) | 79559 : 1/53 lignes près des refuges |
| [Sillages (Pays de Grasse)](https://transport.data.gouv.fr/datasets/lignes-regulieres-de-transports-sillages-en-pays-de-grasse-urbain-et-scolaire) | 5 | 0 | 4 | 79822 (2026-07-01 → 2027-08-31), 79821 (2026-09-01 → 2027-07-02) | 79822 : 2/15 lignes près des refuges ; 79821 : 7/36 lignes près des refuges, 4 scolaires écartées |
| [Métropole Aix-Marseille-Provence](https://transport.data.gouv.fr/datasets/reseaux-de-transports-en-commun-de-la-metropole-daix-marseille-provence-et-des-bouches-du-rhone) | 12 | 0 | 5 | 39593 (2026-09-08 → 2027-07-02), 39598 (2026-09-19 → 2026-12-31), 39601 (2026-09-23 → 2027-01-03), 39597 (2026-08-31 → 2026-11-01), 39599 (2025-12-24 → 2026-12-31), 39596 (2026-09-23 → 2026-12-31), 39595 (2026-08-05 → 2026-12-31), 39591 (2026-07-29 → 2027-12-31), 39589 (2026-10-24 → 2026-12-23), 39602 (2026-09-19 → 2027-07-03), 39592 (2026-09-13 → 2026-11-01), 81969 (2026-10-24 → 2027-05-13), 39594 (2026-08-31 → 2027-06-30), 80736 (2026-09-15 → 2026-12-31), 39603 (2026-09-14 → 2027-06-06) | 39593 : 0/2 lignes près des refuges ; 39598 : 0/46 lignes près des refuges ; 39601 : 4/90 lignes près des refuges ; 39597 : 0/59 lignes près des refuges ; 39599 : 0/1 lignes près des refuges ; 39596 : 0/10 lignes près des refuges ; 39595 : 0/18 lignes près des refuges ; 39591 : 0/183 lignes près des refuges ; 39589 : 0/122 lignes près des refuges ; 39602 : 0/48 lignes près des refuges ; 39592 : 0/55 lignes près des refuges ; 81969 : 12/772 lignes près des refuges ; 39594 : 0/2 lignes près des refuges ; 80736 : 0/9 lignes près des refuges ; 39603 : 0/63 lignes près des refuges |
| [Mouv'enbus (Provence Verte)](https://transport.data.gouv.fr/datasets/reseau-transport-mouv-enbus-agglomeration-provence-verte) | 0 | 0 | 0 | 83429 (2026-08-01 → 2027-08-31) | 83429 : 0/31 lignes près des refuges |
| [Mobigo (Jura)](https://transport.data.gouv.fr/datasets/reseau-de-transport-interurbain-mobigo-en-bourgogne-franche-comte) | 6 | 0 | 3 | 84076 (2026-09-30 → 2027-12-31), 84077 (2026-09-02 → 2027-08-31), 83931 (2026-06-24 → 2026-12-31), 84073 (2026-09-01 → 2027-08-31), 84074 (2026-09-01 → 2027-08-31), 84078 (2026-09-11 → 2027-08-31), 84075 (2026-10-20 → 2027-08-31), 84072 (2026-10-21 → 2027-08-31) | 84076 : 3/14 lignes près des refuges ; 84077 : 0/9 lignes près des refuges ; 83931 : 3/141 lignes près des refuges ; 84073 : 0/20 lignes près des refuges ; 84074 : 0/16 lignes près des refuges ; 84078 : 0/33 lignes près des refuges ; 84075 : 0/27 lignes près des refuges ; 84072 : 0/22 lignes près des refuges |
| [Navettes du Guillestrois et du Queyras](https://transport.data.gouv.fr/datasets/reseau-de-transports-collectifs-de-la-ccgq) | 15 | 15 | 0 | 82604 (2025-12-20 → 2026-09-06) | 82604 : 15/15 lignes près des refuges |
| [Valmobus (Valmorel)](https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reel-de-la-station-de-ski-valmorel-gtfs-gtfs-rt) | 6 | 6 | 0 | 12616 | 12616 : flux vide en ce moment, version archivée du 2026-07-02 utilisée (2026-07-01 → 2026-08-31) ; 12616 : 6/6 lignes près des refuges |
| [Navettes hivernales Vaï](https://transport.data.gouv.fr/datasets/navettes-stations-hiver-2025-2026-reseau-vai) | 8 | 8 | 0 | 83736 (2025-12-06 → 2026-04-10) | 83736 : 8/8 lignes près des refuges |
| [Navette Chorges – Chanteloube](https://transport.data.gouv.fr/datasets/navette-chorges-chanteloube-ete-2026-reseau-vai) | 1 | 1 | 0 | 84030 (2026-07-04 → 2026-08-23) | 84030 : 1/1 lignes près des refuges |
| [Navettes de l'Alpe d'Huez](https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reel-des-navettes-hivernales-de-lalpe-dhuez-gtfs-gtfs-rt) | 4 | 4 | 0 | 78387 | 78387 : flux vide en ce moment, version archivée du 2026-07-30 utilisée (2026-07-24 → 2026-08-31) ; 78387 : 4/4 lignes près des refuges |
| [Navettes des 2 Alpes](https://transport.data.gouv.fr/datasets/gtfs-les-2alpes-saison-hiver-2025-2026) | 2 | 2 | 0 | 83989 (2026-05-04 → 2026-07-04), 83813 (2026-05-04 → 2026-07-04), 83810 (2026-05-04 → 2026-07-04) | 83989 : 1/1 lignes près des refuges ; 83813 : 1/1 lignes près des refuges ; 83810 : 1/1 lignes près des refuges |
| [Skibus Courchevel](https://transport.data.gouv.fr/datasets/skibus-courchevel-hiver) | 6 | 6 | 0 | 84102 (2026-07-01 → 2026-08-23) | 84102 : 6/6 lignes près des refuges |
| [Transport par câble de Courchevel](https://transport.data.gouv.fr/datasets/transport-urbain-par-cable-hiver-2025-26) | 1 | 1 | 0 | 83744 (2025-12-05 → 2026-04-19) | 83744 : 1/3 lignes près des refuges |
| [Skibus Vallée des Belleville](https://transport.data.gouv.fr/datasets/skibus-vallee-des-belleville) | 3 | 3 | 0 | 83787 (2026-07-01 → 2026-08-31) | 83787 : 3/3 lignes près des refuges |
| [Méribus](https://transport.data.gouv.fr/datasets/meribus-ete) | 1 | 1 | 0 | 82682 (2026-07-04 → 2026-08-30) | 82682 : 1/3 lignes près des refuges |
| [Navettes de Val d'Isère](https://transport.data.gouv.fr/datasets/navettes-val-disere) | 5 | 5 | 0 | 83629 | 83629 : flux vide en ce moment, version archivée du 2026-07-04 utilisée (2026-07-04 → 2026-08-30) ; 83629 : 5/5 lignes près des refuges |
| [Navettes de Tignes](https://transport.data.gouv.fr/datasets/navettes-tignes) | 3 | 3 | 0 | 83627 | 83627 : flux vide en ce moment, version archivée du 2026-07-04 utilisée (2026-07-04 → 2026-08-30) ; 83627 : 3/3 lignes près des refuges |
| [Navettes de Bourg-Saint-Maurice](https://transport.data.gouv.fr/datasets/navettes-bourg-saint-maurice) | 2 | 2 | 0 | 83626 (2026-08-21 → 2026-12-04) | 83626 : 2/5 lignes près des refuges |
| [Navettes de La Rosière](https://transport.data.gouv.fr/datasets/navettes-la-rosiere) | 2 | 2 | 2 | 84133 (2026-06-27 → 2026-09-04) | 84133 : 2/2 lignes près des refuges |
| [Télécabine Eau d'Olle Express](https://transport.data.gouv.fr/datasets/telecabine-eau-dolle-express-allemond-oz) | 1 | 0 | 0 | 83994 (2025-12-06 → 2027-04-19) | 83994 : 1/1 lignes près des refuges |
| [Col'ette (Hauteluce – Les Saisies)](https://transport.data.gouv.fr/datasets/navette-colette-savoie-les-saisies) | 1 | 1 | 0 | 84203 (2026-07-04 → 2026-08-28) | 84203 : 1/1 lignes près des refuges |
| [Funiculaire des Arcs](https://transport.data.gouv.fr/datasets/funiculaire-des-arcs) | 0 | 0 | 0 | 83848 (2026-12-12 → 2027-04-25) | 83848 : 0/1 lignes près des refuges |
| [Remontées mécaniques de Courchevel](https://transport.data.gouv.fr/datasets/remontees-mecaniques-courchevel) | 14 | 14 | 0 | 84204 (2026-07-04 → 2026-08-30) | 84204 : 14/21 lignes près des refuges |

## Navettes hors open data

Navettes absentes de transport.data.gouv.fr, relevées à la main sur leur document officiel (`scripts/transport_v2/navettes_hors_open_data.json`, format décrit dans `docs/transport/navettes_hors_open_data.md`). Sur la carte, elles portent la mention « Hors open data » et le nom de leur source.

| Navette | Saison | Statut | Source | Tracé | Remarques |
|---|---|---|---|---|---|
| Ligne 2 : Bramans ↔ Termignon ↔ Bellecombe ↔ Entre-Deux-Eaux | 2026-06-28 → 2026-09-04 | Horaires relevés sur la source officielle de la saison | [Guide mobilité Haute Maurienne Vanoise, été 2026 (version 4 du 28/08/2026)](https://hmvt.download/SitesWeb/hmv-guide-mobilite-ete.pdf), consultée le 2026-10-25 | réseau routier |  |
| Ligne 3 : Pont de l'Oulietta ↔ Bonneval-sur-Arc ↔ Bessans ↔ Avérole | 2026-07-01 → 2026-08-31 | Horaires relevés sur la source officielle de la saison | [Guide mobilité Haute Maurienne Vanoise, été 2026 (version 4 du 28/08/2026)](https://hmvt.download/SitesWeb/hmv-guide-mobilite-ete.pdf), consultée le 2026-10-25 | réseau routier |  |
| Ligne 4 : Bonneval-sur-Arc ↔ L'Écot | 2026-07-05 → 2026-08-28 | Horaires relevés sur la source officielle de la saison | [Guide mobilité Haute Maurienne Vanoise, été 2026 (version 4 du 28/08/2026)](https://hmvt.download/SitesWeb/hmv-guide-mobilite-ete.pdf), consultée le 2026-10-25 | réseau routier |  |
| Circuit B : Peisey Village ↔ Rosuel | 2026-07-04 → 2026-09-05 | Horaires relevés sur la source officielle de la saison | [Horaires des navettes gratuites, été 2026 (du 4 juillet au 5 septembre)](https://www.mairie-landry.com/wp-content/uploads/2026/05/BAT6-DEP-A4-3V-Peisey-05-2026.pdf), consultée le 2026-10-25 | réseau routier |  |
| Circuit C : Arc 1800 ↔ Vallandry ↔ Rosuel (Rosuel Express) | 2026-07-04 → 2026-09-05 | Horaires relevés sur la source officielle de la saison | [Horaires des navettes gratuites, été 2026 (du 4 juillet au 5 septembre)](https://www.mairie-landry.com/wp-content/uploads/2026/05/BAT6-DEP-A4-3V-Peisey-05-2026.pdf), consultée le 2026-10-25 | réseau routier |  |
| Navette du Valgaudemar : Saint-Firmin ↔ La Chapelle ↔ Le Gioberney | 2026-07-06 → 2026-08-23 | Horaires relevés sur la source officielle de la saison | [Navette du Valgaudemar, été 2026 (fiche horaire)](https://static.apidae-tourisme.com/filestore/objets-touristiques/documents/239/253/39648751/Navette+Valgaudemar+2026+V01.pdf), consultée le 2026-10-25 | réseau routier |  |
| Ligne E : Le Pleney ↔ Lac des Mines d'Or | 2026-06-25 → 2026-08-30 | Horaires relevés sur la source officielle de la saison | [Navettes Morzine, horaires valables du 25 juin au 30 août 2026 (affiche)](https://www.morzine-avoriaz.com/app/uploads/2026/06/affiche-90x65-ete-navette.pdf), consultée le 2026-10-25 | réseau routier |  |
| Navette « Andiamo ! » : Ville-Vieille ↔ Molines ↔ Col Agnel | 2026-07-05 → 2026-08-30 | Dates connues, horaires non publiés par la source | [Des navettes transfrontalières pour relier le Queyras et le Piémont (article du 13 juillet 2026)](https://presseagence.fr/guillestrel-mobilite-des-navettes-transfrontalieres-pour-relier-le-queyras-et-le-piemont/), consultée le 2026-10-25 | réseau routier |  |

## Relancer la construction

```bash
node scripts/transport_v2/navettes_tracer.cjs
node scripts/transport_v2/3_construire_reseau.cjs
```

Les flux sont gardés en cache dans `imports/transport_v2/gtfs/` et ne sont retéléchargés que lorsque l'éditeur publie une nouvelle version. Pour ajouter, retirer ou régler une source : `scripts/transport_v2/sources.cjs`. Le premier script ne recalcule que les tracés des navettes dont les arrêts ont changé.
