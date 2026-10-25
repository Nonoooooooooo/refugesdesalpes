# Archives des flux saisonniers

*Étape 4 du chantier « Transport v2 ».*

## Le problème

Plusieurs navettes de station publient leurs horaires sur transport.data.gouv.fr, mais **vident leur flux entre deux saisons**. Hors saison, le fichier ne contient plus que des en-têtes, sans aucune ligne. C'est le cas de Val d'Isère, Tignes, l'Alpe d'Huez et Valmorel. Sans archive, ces navettes disparaissaient de la carte d'octobre jusqu'à la saison suivante.

Certains de ces flux sont aussi **« glissants »** : chaque version ne couvre que les jours ou semaines à venir. La dernière version remplie peut donc ne contenir que la fin de la saison. Par exemple, Tignes au 1er septembre 2026 ne couvre que 6 jours sur 2 lignes, alors que la version du 4 juillet couvre toute la saison d'été sur 3 lignes.

## La solution

Le dépôt garde, pour chaque flux de navette, **la version remplie la plus complète de la dernière saison connue**. Cette version a d'abord le plus de lignes, puis le plus de jours de service et le plus de courses. Elle est stockée dans [`scripts/transport_v2/archives/`](../../scripts/transport_v2/archives/) : `index.json` décrit les versions, `gtfs/` contient les fichiers.

- **Construction du réseau** (`3_construire_reseau.cjs`) :
  - si un flux est vide, la version archivée est utilisée à sa place ;
  - les lignes concernées s'affichent en « Hors saison », avec les horaires de leur dernière saison ;
  - la fiche précise « version du JJ/MM/AAAA conservée : l'éditeur ne publie aucune ligne entre deux saisons ».
- **Archivage automatique** : à chaque construction, toute nouvelle version remplie d'un flux de navette est mesurée. Elle est gardée si elle est meilleure que la version archivée, ou si elle appartient à une saison plus récente. Sont concernées les sources marquées `navette: true` ou `archiver: true` dans `sources.cjs`.
- **Rattrapage** (`archiver_historique.cjs`) : transport.data.gouv.fr conserve les dernières versions de chaque ressource. Ce script les télécharge pour remplir l'archive, par exemple quand une source est ajoutée hors saison.

Pour garder le dépôt léger, seuls les flux de moins de 1 Mo sont archivés, à raison d'une version par ressource. L'archive pèse environ 1,6 Mo pour 17 ressources.

## État au 25 octobre 2026

| Navette | Flux actuel | Version utilisée | Saison couverte |
|---|---|---|---|
| Navettes de Val d'Isère (5 lignes) | vide | historique du 4 juillet 2026 | 4 juillet → 30 août 2026 |
| Navettes de Tignes (3 lignes) | vide | historique du 4 juillet 2026 | 4 juillet → 30 août 2026 |
| Navettes de l'Alpe d'Huez (4 lignes) | vide | historique du 30 juillet 2026 | 24 juillet → 31 août 2026 |
| Valmobus, Valmorel (6 lignes) | vide | historique du 2 juillet 2026 | 1er juillet → 31 août 2026 |

Pour l'Alpe d'Huez, la version la plus longue (16 juillet → 30 août) ne contenait que 2 lignes sur 4. C'est pourquoi la version du 30 juillet, qui a les 4 lignes, est retenue.

Les 13 autres navettes archivées ont un flux rempli en ce moment. L'archive les protège pour leur prochaine intersaison.

## Commandes

```bash
node scripts/transport_v2/archiver_historique.cjs
node scripts/transport_v2/3_construire_reseau.cjs
```

Le premier script, facultatif, rattrape l'historique de toutes les navettes (ou des jeux de données passés en argument). Le second construit le réseau en utilisant l'archive quand c'est nécessaire, et archive les nouvelles versions remplies.
