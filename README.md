# Refuges 2.0 🏔️

Application web moderne (SPA) de consultation interactive des refuges, cabanes et abris de montagne en France et dans les massifs alpins, propulsée par les données ouvertes de [Refuges.info](https://www.refuges.info).

## ✨ Fonctionnalités

- **Fond de carte satellite Esri plein écran** : Imagerie haute résolution mondiale.
- **Chargement dynamique par Bounding Box** : Requêtes sur l'étendue active de la carte (`/api/bbox`) avec gestion du niveau de zoom, annulation des requêtes obsolètes (AbortController) et debouncing.
- **Design Glassmorphism** : Interface flottante sombre, épurée et moderne avec effets de flou translucide (`backdrop-blur`).
- **Marqueurs thématiques** : Couleurs et icônes vectorielles spécifiques (Lucide) selon le type de point (refuges gardés, cabanes non gardées, gîtes, points d'eau, etc.).
- **Filtres interactifs** : Filtrage en temps réel des catégories affichées.
- **Panneau latéral de détails** : Informations complètes (altitude, places, équipements, accès, description nettoyée du BBCode/HTML).
- **Galerie photos & Lightbox** : Visualisation des photos communautaires avec diaporama plein écran.

## 🛠️ Stack Technique

- **React 19** + **Vite**
- **Tailwind CSS 4**
- **Leaflet** & **React-Leaflet**
- **Lucide React** (icônes)

## 🚀 Lancement local

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev

# Build de production
npm run build
```
