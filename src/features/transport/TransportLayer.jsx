import React, { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Cache mémoire global pour éviter tout re-téléchargement
let cachedTransportData = null;

export default function TransportLayer({ active, onSelectTransport }) {
  const map = useMap();
  const [data, setData] = useState(() => cachedTransportData);
  const layerGroupRef = useRef(null);

  // 1. Chargement unique du jeu de données haute fidélité
  useEffect(() => {
    if (!active || data) return;

    let isMounted = true;
    fetch('/transports_alpes.json')
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

  // 2. Rendu Vectoriel Ultra-Fluide sur Canvas GPU
  useEffect(() => {
    if (!active || !data) {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
      return;
    }

    // Si la couche existe déjà, la retirer proprement avant de re-créer
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
    }

    // Moteur Canvas Leaflet dédié : 60 FPS, zéro DOM SVG lourd, tolérance de clic 10px
    const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 10 });
    const group = L.featureGroup();

    // Style selon le mode de transport
    const getStyle = (feature) => {
      const mode = feature.properties?.mode;
      const isCable = mode === 'cable_car' || mode === 'funicular';
      const isTrain = mode === 'train' || mode === 'mountain_train';
      const isNavette = mode === 'navette';

      return {
        renderer: canvasRenderer,
        color: feature.properties?.color || (isTrain ? '#6366f1' : isNavette ? '#f59e0b' : '#10b981'),
        weight: isCable ? 3 : 4,
        opacity: 0.9,
        dashArray: isCable ? '6, 6' : null,
        lineCap: 'round',
        lineJoin: 'round',
      };
    };

    // Tooltip formaté
    const createTooltipContent = (props) => {
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

    // Traitement des entités GeoJSON
    data.features.forEach((feature) => {
      const props = feature.properties || {};

      if (feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        const marker = L.circleMarker([lat, lng], {
          renderer: canvasRenderer,
          radius: 5.5,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1,
        });

        marker.bindTooltip(createTooltipContent(props), {
          className: 'refuge-tooltip',
          direction: 'top',
          offset: [0, -8],
        });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (onSelectTransport) {
            onSelectTransport({ ...props, isTransport: true });
          }
        });

        group.addLayer(marker);
      } else if (
        feature.geometry.type === 'LineString' ||
        feature.geometry.type === 'MultiLineString'
      ) {
        const line = L.geoJSON(feature, {
          style: getStyle(feature),
          onEachFeature: (_, layer) => {
            layer.bindTooltip(createTooltipContent(props), {
              className: 'refuge-tooltip',
              sticky: true,
              offset: [10, 10],
            });

            layer.on({
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (onSelectTransport) {
                  onSelectTransport({ ...props, isTransport: true });
                }
              },
              mouseover: (e) => {
                const target = e.target;
                if (target.setStyle) {
                  target.setStyle({ weight: 6, opacity: 1 });
                }
              },
              mouseout: (e) => {
                const target = e.target;
                if (target.setStyle) {
                  target.setStyle(getStyle(feature));
                }
              },
            });
          },
        });

        group.addLayer(line);
      }
    });

    group.addTo(map);
    layerGroupRef.current = group;

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [active, data, map, onSelectTransport]);

  return null;
}
