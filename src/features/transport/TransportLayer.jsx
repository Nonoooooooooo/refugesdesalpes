import React, { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// S'assurer que L est attaché à window avant d'importer le plugin de décalage parallèle
if (typeof window !== 'undefined') {
  window.L = L;
}
import 'leaflet-polylineoffset';

// ============================================================================
// 1. PATCH ANTI-BOUCLES SUR LEAFLET-POLYLINEOFFSET
// Neutralise le bug géométrique de boucle (circular arcs à 350°) sur les lacets de montagne
// ============================================================================
if (typeof window !== 'undefined' && L.PolylineOffset) {
  const originalJoinSegments = L.PolylineOffset.joinSegments;

  L.PolylineOffset.joinSegments = function (s1, s2, offset) {
    if (!s1 || !s2) return [];

    // Longueurs des segments d'origine à l'écran
    const len1 = Math.hypot(s1.original[1].x - s1.original[0].x, s1.original[1].y - s1.original[0].y);
    const len2 = Math.hypot(s2.original[1].x - s2.original[0].x, s2.original[1].y - s2.original[0].y);
    const absOffset = Math.abs(offset || 0);

    // 1. Si les segments sont très courts (dézoom sur lacets de montagne),
    // ne jamais tracer d'arc de cercle qui ferait une boucle visible
    if (len1 < absOffset * 1.5 || len2 < absOffset * 1.5) {
      return [s1.offset[1], s2.offset[0]];
    }

    // 2. Écart angulaire le plus court entre les deux segments
    let diff = s2.offsetAngle - s1.offsetAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    // En cas de virage trop en épingle (> 115° = ~2 rad), relier directement
    if (Math.abs(diff) > 2.0) {
      return [s1.offset[1], s2.offset[0]];
    }

    try {
      const arc = originalJoinSegments.call(this, s1, s2, offset);
      // Si l'arc fait plus de 6 points pour un petit angle, il y a eu un débordement angulaire (boucle)
      if (arc && arc.length > 7) {
        return [s1.offset[1], s2.offset[0]];
      }
      return arc;
    } catch {
      return [s1.offset[1], s2.offset[0]];
    }
  };
}

// ============================================================================
// 2. GÉOMÉTRIE & PROJECTION DÉCALÉE DES ARRÊTS SUR LEURS TRAITS RESPECTIFS
// ============================================================================

/**
 * Trouve le segment géométrique le plus proche pour un arrêt donné
 */
function findClosestSegment(lat, lng, geometry) {
  if (!geometry || !geometry.coordinates) return null;

  let lineStrings = [];
  if (geometry.type === 'LineString') {
    lineStrings = [geometry.coordinates];
  } else if (geometry.type === 'MultiLineString') {
    lineStrings = geometry.coordinates;
  }

  let minDistSq = Infinity;
  let best = null;

  for (let s = 0; s < lineStrings.length; s++) {
    const coords = lineStrings[s];
    if (!coords || coords.length < 2) continue;

    for (let i = 0; i < coords.length - 1; i++) {
      const c1 = coords[i];
      const c2 = coords[i + 1];
      const dx = c2[0] - c1[0];
      const dy = c2[1] - c1[1];
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      let t = ((lng - c1[0]) * dx + (lat - c1[1]) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = c1[0] + t * dx;
      const py = c1[1] + t * dy;
      const distSq = (lng - px) * (lng - px) + (lat - py) * (lat - py);

      if (distSq < minDistSq) {
        minDistSq = distSq;
        best = {
          c1: [c1[1], c1[0]], // [lat, lng]
          c2: [c2[1], c2[0]], // [lat, lng]
          t: t,
        };
      }
    }
  }

  return best;
}

/**
 * Marqueur d'arrêt dont la position écran est exactement décalée sur le trait de sa ligne
 */
const LineStopMarker = L.CircleMarker.extend({
  options: {
    offset: 0,
    segmentData: null,
  },
  _project: function () {
    if (!this._map) return;
    this._point = this._map.latLngToLayerPoint(this._latlng);
    const offset = this.options.offset || 0;
    const seg = this.options.segmentData;

    if (offset !== 0 && seg) {
      const p1 = this._map.latLngToLayerPoint(seg.c1);
      const p2 = this._map.latLngToLayerPoint(seg.c2);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);

      if (len > 0) {
        const projX = p1.x + seg.t * dx;
        const projY = p1.y + seg.t * dy;
        const nx = -dy / len;
        const ny = dx / len;
        this._point = L.point(projX + offset * nx, projY + offset * ny);
      }
    }
    this._updateBounds();
  },
  setOffset: function (offset) {
    this.options.offset = offset;
    if (this._map) {
      this._project();
      this.redraw();
    }
    return this;
  },
});

const ZOOM_OFFSET_THRESHOLD = 11;
let cachedTransportData = null;

// Hubs métropolitains extérieurs pour les lignes à grande vitesse
const HIGH_SPEED_EXTERNAL_HUBS = {
  'trenitalia-frecciarossa-paris-milan': [
    { name: 'Paris Gare de Lyon', lat: 48.844945, lng: 2.373481 },
  ],
  'tgv-inoui-paris-tarentaise': [{ name: 'Paris Gare de Lyon', lat: 48.844945, lng: 2.373481 }],
  'tgv-inoui-paris-grenoble': [{ name: 'Paris Gare de Lyon', lat: 48.844945, lng: 2.373481 }],
  'tgv-inoui-paris-annecy': [{ name: 'Paris Gare de Lyon', lat: 48.844945, lng: 2.373481 }],
  'tgv-inoui-paris-mont-blanc': [{ name: 'Paris Gare de Lyon', lat: 48.844945, lng: 2.373481 }],
  'tgv-inoui-paris-maurienne': [{ name: 'Paris Gare de Lyon', lat: 48.844945, lng: 2.373481 }],
  'tgv-inoui-lille-alpes': [
    { name: 'Lille-Europe', lat: 50.6389, lng: 3.0757 },
    { name: 'Paris CDG', lat: 49.0097, lng: 2.5479 },
  ],
  'tgv-inoui-mediterranee-grenoble': [
    { name: 'Marseille-Saint-Charles', lat: 43.303283, lng: 5.380843 },
  ],
};

function isHighSpeedLine(feature) {
  const props = feature?.properties || {};
  return Boolean(
    props.isTGV ||
    props.ref === 'TGV INOUI' ||
    props.ref === 'Frecciarossa' ||
    props.isTrenitalia ||
    props.id === 'trenitalia-frecciarossa-paris-milan'
  );
}

function isOriginInFrame(feature, map) {
  if (!map) return true;
  const props = feature?.properties || {};
  const featId = props.id || feature.id;
  const hubs = HIGH_SPEED_EXTERNAL_HUBS[featId] || [
    { name: 'Paris Gare de Lyon', lat: 48.844945, lng: 2.373481 },
  ];
  const bounds = map.getBounds();
  // Vrai si au moins une grande métropole d'origine est visible dans le cadre actuel
  return hubs.some((h) => bounds.contains(L.latLng(h.lat, h.lng)));
}

function ensureSvgGradients(renderer) {
  if (!renderer || !renderer._container) return;
  const svg = renderer._container;
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  if (!defs.querySelector('#sncf-tgv-gradient')) {
    defs.innerHTML += `
      <!-- Dégradé Signature SNCF Carmillon inOui -->
      <linearGradient id="sncf-tgv-gradient" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="#881337" stop-opacity="1"/>
        <stop offset="25%" stop-color="#be123c" stop-opacity="1"/>
        <stop offset="60%" stop-color="#e11d48" stop-opacity="1"/>
        <stop offset="100%" stop-color="#c026d3" stop-opacity="1"/>
      </linearGradient>
      <!-- Dégradé Signature TGV inOui Survol / Sélection -->
      <linearGradient id="sncf-tgv-gradient-hover" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="#9f1239" stop-opacity="1"/>
        <stop offset="25%" stop-color="#e11d48" stop-opacity="1"/>
        <stop offset="60%" stop-color="#fb7185" stop-opacity="1"/>
        <stop offset="100%" stop-color="#f472b6" stop-opacity="1"/>
      </linearGradient>
      <!-- Dégradé Officiel Trenitalia Vert Signature -->
      <linearGradient id="trenitalia-gradient" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="#064e3b" stop-opacity="1"/>
        <stop offset="30%" stop-color="#047857" stop-opacity="1"/>
        <stop offset="70%" stop-color="#059669" stop-opacity="1"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="1"/>
      </linearGradient>
      <!-- Dégradé Trenitalia Vert Survol / Sélection -->
      <linearGradient id="trenitalia-gradient-hover" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="#047857" stop-opacity="1"/>
        <stop offset="30%" stop-color="#059669" stop-opacity="1"/>
        <stop offset="70%" stop-color="#10b981" stop-opacity="1"/>
        <stop offset="100%" stop-color="#34d399" stop-opacity="1"/>
      </linearGradient>
      <!-- Dégradé Frecciarossa compatibilité vert -->
      <linearGradient id="frecciarossa-gradient" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="#064e3b" stop-opacity="1"/>
        <stop offset="30%" stop-color="#047857" stop-opacity="1"/>
        <stop offset="70%" stop-color="#059669" stop-opacity="1"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="1"/>
      </linearGradient>
    `;
  }
}

export default function TransportLayer({ active, onSelectTransport, selectedTransport }) {
  const map = useMap();
  const [data, setData] = useState(() => cachedTransportData);
  const layerGroupRef = useRef(null);
  const svgRendererRef = useRef(null);
  const syncHighSpeedVisibilityRef = useRef(null);
  const layersMapRef = useRef(new Map());
  const selectedTransportRef = useRef(selectedTransport);
  selectedTransportRef.current = selectedTransport;
  const stopMarkersRef = useRef([]);
  const activeDirectionOverlayRef = useRef(null);

  // 1. Chargement unique du jeu de données haute fidélité
  useEffect(() => {
    if (!active || data) return;

    let isMounted = true;
    fetch('/transports_alpes.json', { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error('Impossible de charger les transports');
        return res.json();
      })
      .then((json) => {
        cachedTransportData = json;
        if (isMounted) setData(json);
      })
      .catch((err) => {
        console.error('Erreur chargement transports:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [active, data]);

  // Style selon le mode de transport, décalage et sélection
  const getFeatureStyle = (feature, isSelected, hasSelection, currentZoom) => {
    const props = feature.properties || {};
    const mode = props.mode;
    const isCable = mode === 'cable_car' || mode === 'funicular';
    const isTrain = mode === 'train' || mode === 'mountain_train';
    const isNavette = mode === 'navette';
    const isFreccia = props.ref === 'Frecciarossa' || props.id === 'trenitalia-frecciarossa-paris-milan' || props.isTrenitalia;
    const isTGV = (props.isTGV || props.ref === 'TGV INOUI') && !isFreccia;

    let baseColor =
      props.color || (isTrain ? '#6366f1' : isNavette ? '#f59e0b' : '#10b981');
    if (isTGV) {
      baseColor = 'url(#sncf-tgv-gradient)';
    } else if (isFreccia) {
      baseColor = 'url(#trenitalia-gradient)';
    }

    const zoom = typeof currentZoom === 'number' ? currentZoom : map ? map.getZoom() : 12;
    const rawOffset = Number(props.offset) || 0;
    const offset = zoom >= ZOOM_OFFSET_THRESHOLD ? rawOffset : 0;

    if (hasSelection) {
      if (isSelected) {
        return {
          color: isTGV
            ? 'url(#sncf-tgv-gradient-hover)'
            : isFreccia
            ? 'url(#trenitalia-gradient-hover)'
            : baseColor,
          weight: isTGV || isFreccia ? 7.5 : isCable ? 6 : 7,
          opacity: 1,
          dashArray: isCable ? '6, 6' : null,
          lineCap: 'round',
          lineJoin: 'round',
          offset: offset,
          className: isTGV ? 'tgv-sncf-polyline' : isFreccia ? 'trenitalia-polyline' : undefined,
        };
      } else {
        // Lignes non sélectionnées : estompées / sous-brillance
        return {
          color: isTGV ? '#881337' : isFreccia ? '#064e3b' : baseColor,
          weight: isCable ? 2 : 2.5,
          opacity: 0.2,
          dashArray: isCable ? '6, 6' : null,
          lineCap: 'round',
          lineJoin: 'round',
          offset: offset,
          className: isTGV ? 'tgv-sncf-polyline' : isFreccia ? 'trenitalia-polyline' : undefined,
        };
      }
    }

    // Aucun transport sélectionné : luminosité et opacité normales
    return {
      color: baseColor,
      weight: isTGV || isFreccia ? 5 : isCable ? 3 : 4,
      opacity: isTGV || isFreccia ? 0.95 : 0.9,
      dashArray: isCable ? '6, 6' : null,
      lineCap: 'round',
      lineJoin: 'round',
      offset: offset,
      className: isTGV ? 'tgv-sncf-polyline' : isFreccia ? 'trenitalia-polyline' : undefined,
    };
  };

  const UNIFORM_STOP_RADIUS = 4;
  const HOVER_STOP_RADIUS = 5.5;

  const createStopTooltipContent = (sp, lineProps) => {
    const stopName = sp.name || 'Arrêt';
    const isFreccia = lineProps.ref === 'Frecciarossa' || lineProps.id === 'trenitalia-frecciarossa-paris-milan' || lineProps.isTrenitalia;
    const isTGV = (lineProps.isTGV || lineProps.ref === 'TGV INOUI') && !isFreccia;
    const lineBadge = isFreccia ? 'FRECCIAROSSA' : isTGV ? 'TGV INOUI' : (lineProps.ref || (lineProps.mode === 'train' ? 'TER' : 'Ligne'));
    const timeInfo = sp.time ? `Passage : ${sp.time.split('|')[0].trim()}` : '';

    return `
      <div style="font-family: inherit; min-width: 150px; max-width: 260px; padding: 2px;">
        <div style="font-weight: 700; font-size: 12px; color: #fff; line-height: 1.3; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 3px;">
          ${stopName}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 3px; font-size: 11px;">
          <span style="background: ${lineProps.color || '#3b82f6'}; color: #fff; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; text-transform: uppercase; white-space: nowrap;">
            ${lineBadge}
          </span>
          <span style="color: rgba(255,255,255,0.85); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">
            ${lineProps.name || ''}
          </span>
        </div>
        ${
          timeInfo
            ? `<div style="color: #38bdf8; font-size: 10px; font-weight: 600; margin-top: 3px;">${timeInfo}</div>`
            : ''
        }
      </div>
    `;
  };

  // 2. Rendu Vectoriel Ultra-Fluide avec décalages parallèles (Offset) et Arrêts sur leurs traits
  useEffect(() => {
    if (!active || !data) {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
      if (activeDirectionOverlayRef.current) {
        map.removeLayer(activeDirectionOverlayRef.current);
        activeDirectionOverlayRef.current = null;
      }
      layersMapRef.current.clear();
      stopMarkersRef.current = [];
      return;
    }

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
    }
    if (activeDirectionOverlayRef.current) {
      map.removeLayer(activeDirectionOverlayRef.current);
      activeDirectionOverlayRef.current = null;
    }
    layersMapRef.current.clear();
    stopMarkersRef.current = [];

    const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 10 });
    const svgRenderer = L.svg({ padding: 0.5 });
    svgRendererRef.current = svgRenderer;
    svgRenderer.addTo(map);
    ensureSvgGradients(svgRenderer);

    const group = L.featureGroup();
    const currentZoom = map.getZoom();
    const isOffsetActive = currentZoom >= ZOOM_OFFSET_THRESHOLD;

    // Tooltip formaté pour les lignes avec thème inOui / TGV et Frecciarossa Trenitalia
    const createTooltipContent = (props) => {
      const isFreccia = props.ref === 'Frecciarossa' || props.id === 'trenitalia-frecciarossa-paris-milan' || props.isTrenitalia;
      const isTGV = (props.isTGV || props.ref === 'TGV INOUI') && !isFreccia;

      if (isFreccia) {
        const originName = props.stopPoints?.[0]?.name || 'Paris Gare de Lyon';
        const destName = props.stopPoints?.[props.stopPoints.length - 1]?.name || 'Milano Centrale';
        const stopCount = (props.stopPoints || []).length;

        return `
          <div style="font-family: inherit; width: 300px; max-width: 320px; overflow: hidden; border-radius: 12px; color: #fff;">
            <!-- Bandeau Thème Officiel Trenitalia Vert avec logo -->
            <div style="background: linear-gradient(180deg, #022c22 0%, #064e3b 100%); border-bottom: 2px solid #059669; padding: 10px 12px 8px 12px; text-align: center;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 0.6px; color: #34d399; text-transform: uppercase;">
                  FS Italiane &bull; TRENITALIA
                </span>
                <span style="background: rgba(5, 150, 105, 0.25); border: 1px solid rgba(16, 185, 129, 0.5); color: #a7f3d0; font-size: 9px; font-weight: 700; padding: 1.5px 7px; border-radius: 9999px;">
                  Frecciarossa 1000
                </span>
              </div>
              <div style="height: 52px; display: flex; align-items: center; justify-content: center; margin: 3px 0;">
                <img src="/icons/trenitalia_logo.svg" alt="Trenitalia" style="width: 100%; max-height: 48px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); display: block; margin: 0 auto;" />
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: rgba(167, 243, 208, 0.95); font-weight: 600; padding-top: 3px; border-top: 1px solid rgba(5, 150, 105, 0.3);">
                <span>Rame Frecciarossa 1000</span>
                <span>Liaison Transalpine &bull; France ↔ Italie</span>
              </div>
            </div>

            <!-- Informations Ligne -->
            <div style="background: rgba(2, 44, 34, 0.95); padding: 10px 12px 12px 12px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span style="background: linear-gradient(135deg, #047857, #059669); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Frecciarossa
                </span>
                <span style="color: #cbd5e1; font-size: 11px; font-weight: 700;">
                  ${props.ref || 'Frecciarossa'}
                </span>
                <span style="margin-left: auto; color: rgba(255,255,255,0.45); font-size: 10px;">
                  ${stopCount} gares
                </span>
              </div>

              <div style="font-weight: 700; font-size: 12.5px; color: #fff; line-height: 1.35;">
                ${props.name}
              </div>

              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px;">
                <div style="color: #a7f3d0; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                  <span style="color: #34d399; font-size: 9.5px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.3px;">Liaison :</span>
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${originName} &rarr; ${destName}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; color: rgba(255,255,255,0.5); font-size: 10px; margin-top: 3px;">
                  <span>${props.operator || 'Trenitalia France'}</span>
                  <span style="color: #34d399; font-weight: 600;">Cliquer pour détails &rarr;</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      if (isTGV) {
        const originName = props.stopPoints?.[0]?.name || 'Paris Gare de Lyon';
        const destName = props.stopPoints?.[props.stopPoints.length - 1]?.name || 'Alpes';
        const stopCount = (props.stopPoints || []).length;

        return `
          <div style="font-family: inherit; width: 295px; max-width: 320px; overflow: hidden; border-radius: 12px; color: #fff;">
            <!-- Bandeau Pictogramme TGV inOui Duplex conforme au modèle exact -->
            <div style="background: linear-gradient(180deg, #18091a 0%, #2e0c29 100%); border-bottom: 2px solid #e11d48; padding: 10px 12px 8px 12px; text-align: center;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 0.6px; color: #f43f5e; text-transform: uppercase;">
                  SNCF Voyageurs &bull; TGV INOUI
                </span>
                <span style="background: rgba(225, 29, 72, 0.2); border: 1px solid rgba(225, 29, 72, 0.5); color: #fecdd3; font-size: 9px; font-weight: 700; padding: 1.5px 7px; border-radius: 9999px;">
                  Grande Vitesse
                </span>
              </div>
              <div style="height: 52px; display: flex; align-items: center; justify-content: center; margin: 3px 0;">
                <img src="/icons/tgv_inoui_model.png" alt="TGV inOui" style="width: 100%; max-height: 48px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6)); display: block; margin: 0 auto;" />
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: rgba(254, 205, 211, 0.9); font-weight: 600; padding-top: 3px; border-top: 1px solid rgba(225, 29, 72, 0.25);">
                <span>Rame Duplex inOui</span>
                <span>Liaison Directe Alpes</span>
              </div>
            </div>

            <!-- Informations Ligne -->
            <div style="background: rgba(18, 7, 20, 0.95); padding: 10px 12px 12px 12px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span style="background: linear-gradient(135deg, #be123c, #e11d48); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                  inOui
                </span>
                <span style="color: #cbd5e1; font-size: 11px; font-weight: 700;">
                  ${props.ref || 'TGV INOUI'}
                </span>
                <span style="margin-left: auto; color: rgba(255,255,255,0.45); font-size: 10px;">
                  ${stopCount} gares
                </span>
              </div>

              <div style="font-weight: 700; font-size: 12.5px; color: #fff; line-height: 1.35;">
                ${props.name}
              </div>

              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px;">
                <div style="color: #fecdd3; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                  <span style="color: #fb7185; font-size: 9.5px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.3px;">Liaison :</span>
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${originName} &rarr; ${destName}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; color: rgba(255,255,255,0.5); font-size: 10px; margin-top: 3px;">
                  <span>${props.operator || 'SNCF Voyageurs'}</span>
                  <span style="color: #fb7185; font-weight: 600;">Cliquer pour détails &rarr;</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      const modeBadge =
        props.mode === 'train'
          ? 'Train'
          : props.mode === 'mountain_train'
          ? 'Train Touristique'
          : props.mode === 'cable_car'
          ? 'Téléphérique'
          : props.mode === 'funicular'
          ? 'Funiculaire'
          : props.mode === 'navette'
          ? 'Navette'
          : props.mode === 'station'
          ? 'Gare'
          : 'Bus';

      return `
        <div style="font-family: inherit; min-width: 160px; padding: 2px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background: ${props.color || '#3b82f6'}; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; text-transform: uppercase;">
              ${props.ref || modeBadge}
            </span>
            <span style="color: rgba(255,255,255,0.7); font-size: 11px;">
              ${modeBadge}
            </span>
          </div>
          <div style="font-weight: 600; font-size: 12px; color: #fff; line-height: 1.3;">
            ${props.name}
          </div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 2px;">
            ${props.operator || ''}
          </div>
        </div>
      `;
    };

    const stopMarkersList = [];

    // 1. Ajouter les lignes et créer les arrêts directement associés à chaque ligne sur son trait
    data.features.forEach((feature) => {
      const props = feature.properties || {};
      const featId = props.id || feature.id;

      if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        const rawOffset = Number(props.offset) || 0;
        const offsetVal = isOffsetActive ? rawOffset : 0;
        const isHighSpeed = isHighSpeedLine(feature);
        const lineRenderer = isHighSpeed ? svgRenderer : canvasRenderer;
        const initialStyle = {
          renderer: lineRenderer,
          offset: offsetVal,
          ...getFeatureStyle(feature, false, false, currentZoom),
        };

        const line = L.geoJSON(feature, {
          style: () => initialStyle,
          onEachFeature: (_, layer) => {
            if (layer.setOffset) {
              layer.setOffset(offsetVal);
            } else if (layer.options) {
              layer.options.offset = offsetVal;
            }
            if (layer.eachLayer) {
              layer.eachLayer((sub) => {
                if (sub.setOffset) sub.setOffset(offsetVal);
                else if (sub.options) sub.options.offset = offsetVal;
              });
            }

            const isFreccia = props.ref === 'Frecciarossa' || props.id === 'trenitalia-frecciarossa-paris-milan' || props.isTrenitalia;
            const isTGV = (props.isTGV || props.ref === 'TGV INOUI') && !isFreccia;
            layer.bindTooltip(createTooltipContent(props), {
              className: isTGV
                ? 'refuge-tooltip refuge-tooltip-inoui'
                : isFreccia
                ? 'refuge-tooltip refuge-tooltip-trenitalia'
                : 'refuge-tooltip',
              sticky: true,
              offset: isTGV || isFreccia ? [14, 14] : [10, 10],
            });

            layer.on({
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (onSelectTransport) {
                  onSelectTransport({ ...props, activeDirectionIndex: 0, isTransport: true });
                }
              },
              mouseover: (e) => {
                const target = e.target;
                const currentSelection = selectedTransportRef.current;
                const hasSelection = Boolean(currentSelection);
                const isSelected =
                  hasSelection &&
                  (currentSelection.id === featId || currentSelection.name === props.name);

                if (hasSelection && !isSelected) return;

                if (target.setStyle) {
                  const isCable = props.mode === 'cable_car' || props.mode === 'funicular';
                  target.setStyle({
                    weight: isTGV || isFreccia ? 8 : isCable ? 6 : 7,
                    opacity: 1,
                    color: isTGV
                      ? 'url(#sncf-tgv-gradient-hover)'
                      : isFreccia
                      ? 'url(#trenitalia-gradient-hover)'
                      : undefined,
                    offset: map.getZoom() >= ZOOM_OFFSET_THRESHOLD ? rawOffset : 0,
                  });
                  if (target.bringToFront) target.bringToFront();
                }
              },
              mouseout: (e) => {
                const target = e.target;
                const currentSelection = selectedTransportRef.current;
                const hasSelection = Boolean(currentSelection);
                const isSelected =
                  hasSelection &&
                  (currentSelection.id === featId || currentSelection.name === props.name);

                if (target.setStyle) {
                  target.setStyle(getFeatureStyle(feature, isSelected, hasSelection, map.getZoom()));
                  if (hasSelection) {
                    const selObj = layersMapRef.current.get(currentSelection.id);
                    if (selObj?.layer) {
                      if (selObj.layer.eachLayer) {
                        selObj.layer.eachLayer((sub) => {
                          if (sub.bringToFront) sub.bringToFront();
                        });
                      }
                      if (selObj.layer.bringToFront) selObj.layer.bringToFront();
                    }
                  }
                }
              },
            });
          },
        });

        group.addLayer(line);

        const lineStopMarkers = [];
        // Créer les arrêts de CETTE ligne posés exactement sur SON trait
        if (Array.isArray(props.stopPoints) && props.stopPoints.length > 0) {
          const seenLineStopKeys = new Set();
          props.stopPoints.forEach((sp) => {
            if (sp.lat == null || sp.lng == null) return;
            const stopKey = `${(sp.name || '').toLowerCase().trim()}_${sp.lat.toFixed(4)}_${sp.lng.toFixed(4)}`;
            if (seenLineStopKeys.has(stopKey)) return;
            seenLineStopKeys.add(stopKey);

            const isFreccia = props.ref === 'Frecciarossa' || props.id === 'trenitalia-frecciarossa-paris-milan' || props.isTrenitalia;
            const isTGV = (props.isTGV || props.ref === 'TGV INOUI') && !isFreccia;
            const segData = findClosestSegment(sp.lat, sp.lng, feature.geometry);

            const stopMarker = new LineStopMarker([sp.lat, sp.lng], {
              renderer: canvasRenderer,
              radius: isHighSpeed ? UNIFORM_STOP_RADIUS + 0.5 : UNIFORM_STOP_RADIUS,
              fillColor: isTGV ? '#be123c' : isFreccia ? '#059669' : (props.color || '#3b82f6'),
              color: '#ffffff',
              weight: 1.5,
              opacity: 1,
              fillOpacity: 0.95,
              offset: offsetVal,
              segmentData: segData,
            });

            stopMarker._lineId = featId;
            stopMarker._lineProps = props;
            stopMarker._stop = sp;
            stopMarker._rawOffset = rawOffset;

            stopMarker.bindTooltip(createStopTooltipContent(sp, props), {
              className: 'refuge-tooltip',
              direction: 'top',
              offset: [0, -6],
            });

            stopMarker.on({
              mouseover: (e) => {
                e.target.setRadius(HOVER_STOP_RADIUS);
                e.target.setStyle({ weight: 2, fillOpacity: 1 });
                if (e.target.bringToFront) e.target.bringToFront();
              },
              mouseout: (e) => {
                const currentSel = selectedTransportRef.current;
                if (currentSel) {
                  const isAssoc =
                    currentSel.id === featId ||
                    currentSel.name === props.name ||
                    (Array.isArray(currentSel.stopPoints) &&
                      currentSel.stopPoints.some((s) => s.name === sp.name));
                  e.target.setRadius(isAssoc ? UNIFORM_STOP_RADIUS + 1 : UNIFORM_STOP_RADIUS);
                  e.target.setStyle({
                    fillOpacity: isAssoc ? 1 : 0.15,
                    opacity: isAssoc ? 1 : 0.2,
                    weight: isAssoc ? 2 : 0.8,
                  });
                } else {
                  e.target.setRadius(UNIFORM_STOP_RADIUS);
                  e.target.setStyle({ fillOpacity: 0.95, opacity: 1, weight: 1.5 });
                }
              },
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (onSelectTransport) {
                  onSelectTransport({
                    ...props,
                    selectedStop: sp,
                    activeDirectionIndex: 0,
                    isTransport: true,
                  });
                }
              },
            });

            group.addLayer(stopMarker);
            stopMarkersList.push(stopMarker);
            lineStopMarkers.push(stopMarker);
          });
        }

        if (featId) {
          layersMapRef.current.set(featId, {
            type: 'line',
            layer: line,
            feature,
            props,
            stopMarkers: lineStopMarkers,
            isHighSpeed,
          });
        }
      }
    });

    // 2. Traiter les gares et pôles centraux (Points)
    data.features.forEach((feature) => {
      const props = feature.properties || {};
      const featId = props.id || feature.id;

      if (feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;

        const stationMarker = L.circleMarker([lat, lng], {
          renderer: canvasRenderer,
          radius: 5.5,
          fillColor: '#0f172a',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1,
          opacity: 1,
        });

        stationMarker._isStation = true;
        stationMarker._stationId = featId;
        stationMarker._stationProps = props;

        stationMarker.bindTooltip(
          `
          <div style="font-family: inherit; min-width: 140px; padding: 2px;">
            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
              <span style="background: #3b82f6; color: #fff; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; text-transform: uppercase;">
                ${props.ref || 'Gare'}
              </span>
              <span style="font-size: 10px; color: rgba(255,255,255,0.7);">Pôle d'échange</span>
            </div>
            <div style="font-weight: 700; font-size: 12px; color: #fff;">${props.name}</div>
          </div>
        `,
          {
            className: 'refuge-tooltip',
            direction: 'top',
            offset: [0, -8],
          }
        );

        stationMarker.on({
          mouseover: (e) => {
            e.target.setRadius(7);
            e.target.setStyle({ weight: 2.5 });
            if (e.target.bringToFront) e.target.bringToFront();
          },
          mouseout: (e) => {
            e.target.setRadius(5.5);
            e.target.setStyle({ weight: 2 });
          },
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            if (onSelectTransport) {
              onSelectTransport({
                ...props,
                isStation: true,
                isTransport: true,
              });
            }
          },
        });

        group.addLayer(stationMarker);
        stopMarkersList.push(stationMarker);
      }
    });

    stopMarkersRef.current = stopMarkersList;
    group.addTo(map);
    layerGroupRef.current = group;

    // 3. Masquage dynamique des lignes TGV & Frecciarossa au zoom sur les Alpes
    // Si la grande métropole de départ (ex: Paris) n'est plus dans le cadre, le trait disparaît !
    const syncHighSpeedVisibility = () => {
      if (!layerGroupRef.current || !map) return;
      const grp = layerGroupRef.current;
      const currentSel = selectedTransportRef.current;
      const currentSelId = currentSel?.id;
      const currentZoom = map.getZoom();
      const shouldOffset = currentZoom >= ZOOM_OFFSET_THRESHOLD;

      layersMapRef.current.forEach((item) => {
        if (item.type !== 'line' || !item.isHighSpeed) return;

        const isSelected = Boolean(
          currentSel && (item.props.id === currentSelId || item.props.name === currentSel?.name)
        );
        const inFrame = isOriginInFrame(item.feature, map);
        const shouldBeVisible = isSelected || inFrame;

        if (shouldBeVisible) {
          if (!grp.hasLayer(item.layer)) {
            grp.addLayer(item.layer);
          }
          (item.stopMarkers || []).forEach((m) => {
            if (!grp.hasLayer(m)) {
              grp.addLayer(m);
              if (m.setOffset && m._rawOffset != null && m._map) {
                m.setOffset(shouldOffset ? m._rawOffset : 0);
              }
            }
          });
        } else {
          if (grp.hasLayer(item.layer)) {
            grp.removeLayer(item.layer);
          }
          (item.stopMarkers || []).forEach((m) => {
            if (grp.hasLayer(m)) {
              grp.removeLayer(m);
            }
          });
        }
      });
    };

    syncHighSpeedVisibilityRef.current = syncHighSpeedVisibility;
    syncHighSpeedVisibility();

    // 4. Gestion dynamique du zoom et du déplacement de carte
    let rafId = null;
    const onMapMove = () => {
      // Éviter de muter les calques pendant l'animation fluide de zoom Leaflet
      if (map._animatingZoom) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncHighSpeedVisibility);
    };

    const onZoomEnd = () => {
      ensureSvgGradients(svgRenderer);
      syncHighSpeedVisibility();
      const zoom = map.getZoom();
      const shouldOffset = zoom >= ZOOM_OFFSET_THRESHOLD;

      layersMapRef.current.forEach(({ type, layer, props }) => {
        if (type !== 'line') return;
        const targetOffset = shouldOffset ? (Number(props.offset) || 0) : 0;
        if (layer.setOffset) layer.setOffset(targetOffset);
        if (layer.eachLayer) {
          layer.eachLayer((sub) => {
            if (sub.setOffset) {
              sub.setOffset(targetOffset);
            } else if (sub.options) {
              sub.options.offset = targetOffset;
            }
            if (sub._map) {
              if (sub._project) sub._project();
              sub.redraw?.();
            }
          });
        }
      });

      stopMarkersRef.current.forEach((marker) => {
        if (marker.setOffset && marker._rawOffset != null && marker._map) {
          marker.setOffset(shouldOffset ? marker._rawOffset : 0);
        }
      });
    };

    map.on('move', onMapMove);
    map.on('moveend', syncHighSpeedVisibility);
    map.on('zoomend', onZoomEnd);

    return () => {
      map.off('move', onMapMove);
      map.off('moveend', syncHighSpeedVisibility);
      map.off('zoomend', onZoomEnd);
      if (rafId) cancelAnimationFrame(rafId);
      syncHighSpeedVisibilityRef.current = null;
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
      if (svgRendererRef.current) {
        map.removeLayer(svgRendererRef.current);
        svgRendererRef.current = null;
      }
      if (activeDirectionOverlayRef.current) {
        map.removeLayer(activeDirectionOverlayRef.current);
        activeDirectionOverlayRef.current = null;
      }
      layersMapRef.current.clear();
      stopMarkersRef.current = [];
    };
  }, [active, data, map, onSelectTransport]);

  // 4. Mise à jour instantanée du style lors de la sélection / désélection d'une ligne
  // et affichage des deux directions (Aller / Retour) avec badges Départ & Terminus
  useEffect(() => {
    if (!layerGroupRef.current) return;

    // Resynchroniser la visibilité des lignes à grande vitesse si la sélection change
    syncHighSpeedVisibilityRef.current?.();

    const hasSelection = Boolean(selectedTransport);
    const selectedId = selectedTransport?.id;
    const selectedName = selectedTransport?.name;
    const currentZoom = map.getZoom();

    // Supprimer tout ancien calque de direction
    if (activeDirectionOverlayRef.current) {
      map.removeLayer(activeDirectionOverlayRef.current);
      activeDirectionOverlayRef.current = null;
    }

    let selectedLayersToFront = [];

    // Lignes : sélectionnée en relief, autres en sous-brillance
    layersMapRef.current.forEach(({ type, layer, feature, props }) => {
      if (type === 'line') {
        const isSelected =
          hasSelection && (props.id === selectedId || props.name === selectedName);
        const newStyle = getFeatureStyle(feature, isSelected, hasSelection, currentZoom);
        layer.setStyle(newStyle);

        if (isSelected) {
          selectedLayersToFront.push(layer);
        }
      }
    });

    // Arrêts : sous-brillance synchronisée avec les traits
    if (stopMarkersRef.current && stopMarkersRef.current.length > 0) {
      stopMarkersRef.current.forEach((marker) => {
        if (!marker._map) return;
        if (marker._isStation) {
          // Gare / pôle
          if (hasSelection) {
            const isAssoc =
              selectedTransport?.id === marker._stationId ||
              selectedTransport?.name === marker._stationProps?.name;
            marker.setStyle({
              radius: isAssoc ? 7 : 4.5,
              fillOpacity: isAssoc ? 1 : 0.25,
              opacity: isAssoc ? 1 : 0.3,
            });
            if (isAssoc) selectedLayersToFront.push(marker);
          } else {
            marker.setStyle({ radius: 5.5, fillOpacity: 1, opacity: 1 });
          }
          return;
        }

        // Arrêt d'une ligne
        const lineId = marker._lineId;
        const lineProps = marker._lineProps;
        const sp = marker._stop;

        if (hasSelection) {
          const isAssociated =
            lineId === selectedId ||
            lineProps?.name === selectedName ||
            (Array.isArray(selectedTransport?.stopPoints) &&
              selectedTransport.stopPoints.some((s) => s.name === sp?.name));

          if (isAssociated) {
            marker.setStyle({
              radius: UNIFORM_STOP_RADIUS + 1,
              weight: 2,
              fillOpacity: 1,
              opacity: 1,
            });
            selectedLayersToFront.push(marker);
          } else {
            // Sous-brillance (estompé identique aux traits non sélectionnés)
            marker.setStyle({
              radius: UNIFORM_STOP_RADIUS - 0.5,
              weight: 0.8,
              fillOpacity: 0.15,
              opacity: 0.2,
            });
          }
        } else {
          // Aucun transport sélectionné : opacité et taille uniforme normales
          marker.setStyle({
            radius: UNIFORM_STOP_RADIUS,
            weight: 1.5,
            fillOpacity: 0.95,
            opacity: 1,
          });
        }
      });
    }

    // Affichage enrichi des deux directions sur la carte
    if (hasSelection && selectedTransport && selectedTransport.mode !== 'station') {
      const activeDirIndex =
        typeof selectedTransport.activeDirectionIndex === 'number'
          ? selectedTransport.activeDirectionIndex
          : 0;
      const directions = selectedTransport.directions;
      const activeDir = directions ? directions[activeDirIndex] || directions[0] : null;

      let startPt = null;
      let endPt = null;
      let originLabel = 'Départ';
      let destLabel = 'Terminus';

      if (activeDir) {
        originLabel = activeDir.origin || activeDir.stops?.[0] || 'Départ';
        destLabel =
          activeDir.destination || activeDir.stops?.[activeDir.stops.length - 1] || 'Terminus';

        if (activeDir.stopPoints && activeDir.stopPoints.length >= 2) {
          const sp0 = activeDir.stopPoints[0];
          const spEnd = activeDir.stopPoints[activeDir.stopPoints.length - 1];
          if (sp0.lat != null && sp0.lng != null) startPt = [sp0.lat, sp0.lng];
          if (spEnd.lat != null && spEnd.lng != null) endPt = [spEnd.lat, spEnd.lng];
        } else if (activeDir.coordinates && activeDir.coordinates.length >= 2) {
          const c0 = activeDir.coordinates[0];
          const cEnd = activeDir.coordinates[activeDir.coordinates.length - 1];
          startPt = [c0[1], c0[0]];
          endPt = [cEnd[1], cEnd[0]];
        }
      }

      // Si pas trouvé dans activeDir, tenter depuis la géométrie du calque
      if (!startPt || !endPt) {
        const selFeatObj = layersMapRef.current.get(selectedId);
        if (selFeatObj && selFeatObj.feature?.geometry?.coordinates) {
          const coords = selFeatObj.feature.geometry.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            if (selFeatObj.feature.geometry.type === 'LineString') {
              const c0 = activeDirIndex === 0 ? coords[0] : coords[coords.length - 1];
              const cEnd = activeDirIndex === 0 ? coords[coords.length - 1] : coords[0];
              if (!startPt) startPt = [c0[1], c0[0]];
              if (!endPt) endPt = [cEnd[1], cEnd[0]];
            }
          }
        }
      }

      if (startPt && endPt) {
        const dirGroup = L.featureGroup();
        const effectiveOffset =
          currentZoom >= ZOOM_OFFSET_THRESHOLD ? (Number(selectedTransport.offset) || 0) : 0;

        // 1. Tracé spécifique à la direction si des coordonnées dédiées existent
        if (activeDir?.coordinates && activeDir.coordinates.length >= 2) {
          const latlngs = activeDir.coordinates.map((c) => [c[1], c[0]]);
          const isFreccia =
            selectedTransport.ref === 'Frecciarossa' ||
            selectedTransport.isTrenitalia ||
            selectedTransport.id === 'trenitalia-frecciarossa-paris-milan';
          const isTGV = (selectedTransport.isTGV || selectedTransport.ref === 'TGV INOUI') && !isFreccia;
          const dirLine = L.polyline(latlngs, {
            color: isTGV
              ? 'url(#sncf-tgv-gradient-hover)'
              : isFreccia
              ? 'url(#trenitalia-gradient-hover)'
              : selectedTransport.color || '#3b82f6',
            weight: isTGV || isFreccia ? 7.5 : 7,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
            offset: effectiveOffset,
            renderer: isTGV || isFreccia ? svgRendererRef.current || undefined : undefined,
          });
          dirGroup.addLayer(dirLine);
        }

        // 2. Badge DÉPART (Vert émeraude)
        const departMarker = L.marker(startPt, {
          icon: L.divIcon({
            className: 'custom-direction-marker',
            html: `
              <div style="display: inline-flex; align-items: center; gap: 5px; background: #059669; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2px solid #fff; white-space: nowrap; transform: translate(-50%, -120%); pointer-events: none;">
                <span style="font-size: 10px; font-weight: 900; letter-spacing: 0.5px; opacity: 0.95;">DÉPART</span>
                <span style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; font-weight: 600;">${originLabel}</span>
              </div>
            `,
            iconSize: [0, 0],
          }),
          zIndexOffset: 1200,
        });

        // 3. Badge TERMINUS (Rose / Rouge carmin)
        const arriveeMarker = L.marker(endPt, {
          icon: L.divIcon({
            className: 'custom-direction-marker',
            html: `
              <div style="display: inline-flex; align-items: center; gap: 5px; background: #e11d48; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2px solid #fff; white-space: nowrap; transform: translate(-50%, -120%); pointer-events: none;">
                <span style="font-size: 10px; font-weight: 900; letter-spacing: 0.5px; opacity: 0.95;">TERMINUS</span>
                <span style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; font-weight: 600;">${destLabel}</span>
              </div>
            `,
            iconSize: [0, 0],
          }),
          zIndexOffset: 1200,
        });

        dirGroup.addLayer(departMarker);
        dirGroup.addLayer(arriveeMarker);
        dirGroup.addTo(map);
        activeDirectionOverlayRef.current = dirGroup;
      }
    }

    // Passer la ligne et les arrêts sélectionnés AU-DESSUS de toutes les autres couches
    if (selectedLayersToFront.length > 0) {
      selectedLayersToFront.forEach((l) => {
        if (l.eachLayer) {
          l.eachLayer((subLayer) => {
            if (subLayer.bringToFront) subLayer.bringToFront();
          });
        }
        if (l.bringToFront) {
          l.bringToFront();
        }
      });
    }
  }, [selectedTransport, map]);

  return null;
}
