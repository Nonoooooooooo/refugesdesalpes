# Navettes hors open data

*Étape 3 du chantier « Transport v2 ».*

Certaines navettes de vallée et d'accès aux refuges ne sont publiées sur aucun flux open data. Elles n'existent que sous forme de PDF ou de page web (commune, office de tourisme, communauté de communes). Le fichier [`scripts/transport_v2/navettes_hors_open_data.json`](../../scripts/transport_v2/navettes_hors_open_data.json) les décrit à la main, **chacune avec sa source et ses dates**. La construction du réseau (`3_construire_reseau.cjs`) les ajoute à `public/transports_v2.json`.

Sur la carte, ces lignes portent la mention **« Hors open data »** et le nom du document consulté. Quand la saison est finie, elles passent en **« Hors saison »** avec les horaires de la dernière saison, comme les lignes officielles.

## Navettes décrites (relevé du 25 octobre 2026, saison d'été 2026)

| Navette | Saison 2026 | Horaires | Source |
|---|---|---|---|
| HMV ligne 2 : Bramans ↔ Termignon ↔ Bellecombe ↔ Entre-Deux-Eaux | 28 juin → 4 septembre, 3 grilles selon la période | complets | [Guide mobilité HMV été 2026, v4](https://hmvt.download/SitesWeb/hmv-guide-mobilite-ete.pdf) |
| HMV ligne 3 : Pont de l'Oulietta ↔ Bonneval ↔ Bessans ↔ Avérole | 1er juillet → 31 août, sauf samedi | complets | idem |
| HMV ligne 4 : Bonneval-sur-Arc ↔ L'Écot | 5 juillet → 28 août, sauf samedi | complets | idem |
| Peisey circuit B : Peisey Village ↔ Rosuel | 4 juillet → 5 septembre, tous les jours | complets | [Office de tourisme de Peisey-Vallandry](https://www.mairie-landry.com/wp-content/uploads/2026/05/BAT6-DEP-A4-3V-Peisey-05-2026.pdf) |
| Peisey circuit C : Arc 1800 ↔ Vallandry ↔ Rosuel | 4 juillet → 5 septembre, tous les jours | complets | idem |
| Navette du Valgaudemar : Saint-Firmin ↔ La Chapelle ↔ Le Gioberney | 6 juillet → 23 août, tous les jours | complets | [CC du Champsaur-Valgaudemar](https://static.apidae-tourisme.com/filestore/objets-touristiques/documents/239/253/39648751/Navette+Valgaudemar+2026+V01.pdf) |
| Morzine ligne E : Le Pleney ↔ Lac des Mines d'Or | 25 juin → 30 août | complets, intermédiaires déduits de « toutes les 30 min » | [Affiche navettes Morzine été 2026](https://www.morzine-avoriaz.com/app/uploads/2026/06/affiche-90x65-ete-navette.pdf) |
| Queyras « Andiamo ! » : Ville-Vieille ↔ Molines ↔ Col Agnel | 5 juillet → 30 août, 5 jours sur 7 | **non publiés** (statut « partiel ») | [Article du 13 juillet 2026](https://presseagence.fr/guillestrel-mobilite-des-navettes-transfrontalieres-pour-relier-le-queyras-et-le-piemont/) |

Les arrêts sont placés sur les arrêts de bus d'OpenStreetMap ou les arrêts officiels voisins (Cars Région Savoie). Deux arrêts du Valgaudemar (Les Barrengeards, Le Pont du Roux) ne figurent dans aucune base : leur position est estimée, et le fichier le précise dans le champ `position`.

## Lignes de l'ancienne carte qui ne sont pas reprises

L'ancienne carte contenait des lignes dessinées à la main. Celles-ci n'ont pas été recopiées, faute de source, ou parce qu'elles sont fausses :

| Ancienne ligne | Pourquoi elle n'est pas reprise |
|---|---|
| Navette du Parc des Écrins vers La Bérarde | La Bérarde a été dévastée par la crue de juin 2024. La ligne officielle T77 (Cars Région Isère) s'arrête désormais à la Combe de Pierre Noire et figure déjà dans le réseau v2. |
| S40 « prolongement estival au col du Galibier » | Aucune navette Valloire – Galibier trouvée pour 2026. La S40 officielle s'arrête à Valloire Les Verneys. |
| S66 « Moûtiers ↔ Champagny-le-Haut » | La S66 officielle relie Moûtiers à Pralognan, pas à Champagny. Aucune navette d'été vers Champagny-le-Haut trouvée. |
| « Liaison D338 Morzine ↔ Avoriaz » | Ce n'est pas une ligne de transport, seulement une route. |
| Altigo S17, S18 (Cervières – collèges et lycée) | Circuits scolaires. |
| Navettes du Giffre (Samoëns – Sixt) | Le flux open data date de janvier 2024 et ne contient que l'hiver. Aucun horaire d'été 2026 trouvé. |
| Navette de Val d'Isère « Train Rouge » | Le flux officiel existe mais est vide entre deux saisons : sa version de l'été 2026 est reprise depuis l'archive (voir `archives_saisonnieres.md`). |
| Téléphérique des Prodains, télécabine d'Ardent (Avoriaz) | Remontées mécaniques : à ajouter dans un second temps avec leurs dates d'ouverture d'été. |
| Ligne 22 Albertville – Beaufort – Les Saisies, navette du Val d'Arly | Pas de source trouvée sous ces noms. La navette Col'ette (Hauteluce – Les Saisies), qui a un flux officiel, a été ajoutée au catalogue des sources. |

## Ajouter ou mettre à jour une navette

1. Trouver le **document officiel de la saison** (PDF ou page de la commune, de l'office de tourisme ou de la communauté de communes) et noter son adresse.
2. Ajouter ou modifier l'entrée dans `navettes_hors_open_data.json` (format ci-dessous). Mettre à jour `saison` et `source.consulteLe` à chaque nouvelle saison.
3. Relancer :

```bash
node scripts/transport_v2/navettes_tracer.cjs
node scripts/transport_v2/3_construire_reseau.cjs
```

Le premier script ne recalcule que les tracés des sens dont les arrêts ont changé. Le second contrôle chaque navette : une entrée incomplète (source sans date, heure mal écrite, arrêt inconnu…) est écartée et signalée dans `docs/transport/construction_reseau.md`.

Si une navette finit par être publiée en open data, il faut ajouter son flux à `sources.cjs` et supprimer l'entrée manuelle.

## Format d'une navette

```json
{
  "id": "hmv-ligne-4",
  "ref": "4",
  "nom": "Ligne 4 : Bonneval-sur-Arc ↔ L'Écot",
  "reseau": "Navettes Haute Maurienne Vanoise",
  "exploitant": "Communauté de communes Haute Maurienne Vanoise",
  "mode": "navette",
  "couleur": "#0E7490",
  "statut": "verifie",
  "source": {
    "titre": "Guide mobilité Haute Maurienne Vanoise, été 2026 (version 4 du 28/08/2026)",
    "editeur": "Office de tourisme Haute Maurienne Vanoise",
    "url": "https://hmvt.download/SitesWeb/hmv-guide-mobilite-ete.pdf",
    "consulteLe": "2026-10-25"
  },
  "saison": { "debut": "2026-07-05", "fin": "2026-08-28", "jours": "Tous les jours sauf le samedi" },
  "tarif": "…",
  "reservation": "…",
  "note": "…",
  "sens": [
    {
      "nom": "Vers L'Écot",
      "arrets": [
        { "nom": "Bonneval-sur-Arc – Patinoire", "lat": 45.37329, "lng": 7.05252, "position": "OpenStreetMap" }
      ],
      "grilles": [
        {
          "label": "Tous les jours sauf le samedi",
          "note": "…",
          "lignes": [
            { "arret": "Bonneval-sur-Arc – Patinoire", "heures": ["08:00", "09:10", ""] }
          ]
        }
      ]
    }
  ]
}
```

| Champ | Obligatoire | Contenu |
|---|---|---|
| `id` | oui | Identifiant stable, en minuscules avec des tirets. |
| `nom`, `ref`, `reseau`, `exploitant` | `nom` et `reseau` | Ce qui s'affiche sur la carte. |
| `mode` | oui | `navette`, `bus`, `cable_car`, `funicular`, `mountain_train` ou `train`. |
| `statut` | oui | `verifie` : dates et horaires relevés sur le document de la saison. `partiel` : dates connues, horaires non publiés. `a_verifier` : information ancienne ou indirecte. |
| `source` | oui | `titre`, `url` et `consulteLe` (AAAA-MM-JJ) obligatoires, `editeur` conseillé. |
| `saison` | oui | `debut` et `fin` (AAAA-MM-JJ), `jours` en clair. |
| `tarif`, `reservation`, `note`, `frequence` | non | Texte libre affiché dans la fiche. `frequence` sert quand il n'y a pas de grille. |
| `sens[].arrets` | oui, au moins 2 | Dans l'ordre de passage. `position` indique d'où viennent les coordonnées. |
| `sens[].grilles` | oui si `verifie` | Une grille par jour type ou période. Chaque ligne = un arrêt, chaque colonne = un même départ. `""` = arrêt non desservi par ce départ. Un arrêt où le car stationne peut avoir deux lignes : `Bellecombe (arrivée)` et `Bellecombe (départ)`. |
