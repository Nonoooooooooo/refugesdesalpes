import React, { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Cache mémoire global pour éviter tout re-téléchargement
let cachedTransportData = null;

export default function TransportLayer({ active, onSelectTransport, selectedTransport }) {
  const map = useMap();
  const [data, setData] = useState(() => cachedTransportData);
  const layerGroupRef = useRef(null);
  const layersMapRef = useRef(new Map());
  const selectedTransportRef = useRef(selectedTransport);
  selectedTransportRef.current = selectedTransport;

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

  // Style selon le mode de transport et l'état de sélection
  const getFeatureStyle = (feature, isSelected, hasSelection) => {
    const mode = feature.properties?.mode;
    const isCable = mode === 'cable_car' || mode === 'funicular';
    const isTrain = mode === 'train' || mode === 'mountain_train';
    const isNavette = mode === 'navette';
    const baseColor = feature.properties?.color || (isTrain ? '#6366f1' : isNavette ? '#f59e0b' : '#10b981');

    if (hasSelection) {
      if (isSelected) {
        return {
          color: baseColor,
          weight: isCable ? 6 : 7,
          opacity: 1,
          dashArray: isCable ? '6, 6' : null,
          lineCap: 'round',
          lineJoin: 'round',
        };
      } else {
        // Lignes non sélectionnées : estompées / moins lumineuses
        return {
          color: baseColor,
          weight: isCable ? 2 : 2.5,
          opacity: 0.2,
          dashArray: isCable ? '6, 6' : null,
          lineCap: 'round',
          lineJoin: 'round',
        };
      }
    }

    // Aucun transport sélectionné : luminosité et opacité normales
    return {
      color: baseColor,
      weight: isCable ? 3 : 4,
      opacity: 0.9,
      dashArray: isCable ? '6, 6' : null,
      lineCap: 'round',
      lineJoin: 'round',
    };
  };

  // 2. Rendu Vectoriel Ultra-Fluide sur Canvas GPU
  useEffect(() => {
    if (!active || !data) {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
      layersMapRef.current.clear();
      return;
    }

    // Si la couche existe déjà, la retirer proprement avant de re-créer
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
    }
    layersMapRef.current.clear();

    // Moteur Canvas Leaflet dédié : 60 FPS, zéro DOM SVG lourd, tolérance de clic 10px
    const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 10 });
    const group = L.featureGroup();

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
      const featId = props.id || feature.id;

      if (feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        const marker = L.circleMarker([lat, lng], {
          renderer: canvasRenderer,
          radius: 5.5,
          fillColor: props.color || '#3b82f6',
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

        if (featId) {
          layersMapRef.current.set(featId, { type: 'point', layer: marker, feature, props });
        }
        group.addLayer(marker);
      } else if (
        feature.geometry.type === 'LineString' ||
        feature.geometry.type === 'MultiLineString'
      ) {
        const initialStyle = {
          renderer: canvasRenderer,
          ...getFeatureStyle(feature, false, false),
        };

        const line = L.geoJSON(feature, {
          style: () => initialStyle,
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
                const currentSelection = selectedTransportRef.current;
                const hasSelection = Boolean(currentSelection);
                const isSelected = hasSelection && (currentSelection.id === featId || currentSelection.name === props.name);

                // Si une ligne est déjà sélectionnée dans la fenêtre de gauche :
                // Les autres lignes NE DOIVENT PAS se ré-éclairer au survol.
                if (hasSelection && !isSelected) {
                  return;
                }

                if (target.setStyle) {
                  const isCable = props.mode === 'cable_car' || props.mode === 'funicular';
                  target.setStyle({ weight: isCable ? 6 : 7, opacity: 1 });
                  if (target.bringToFront) target.bringToFront();
                }
              },
              mouseout: (e) => {
                const target = e.target;
                const currentSelection = selectedTransportRef.current;
                const hasSelection = Boolean(currentSelection);
                const isSelected = hasSelection && (currentSelection.id === featId || currentSelection.name === props.name);

                if (target.setStyle) {
                  target.setStyle(getFeatureStyle(feature, isSelected, hasSelection));
                  // Si une ligne est sélectionnée et qu'on survolait autre chose, remettre la sélection au premier plan
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

        if (featId) {
          layersMapRef.current.set(featId, { type: 'line', layer: line, feature, props });
        }
        group.addLayer(line);

        // 2b. Afficher chaque arrêt sous forme d'un petit point de la même couleur que le trait
        if (Array.isArray(props.stopPoints) && props.stopPoints.length > 0) {
          props.stopPoints.forEach((sp) => {
            if (sp.lat == null || sp.lng == null) return;
            const stopMarker = L.circleMarker([sp.lat, sp.lng], {
              renderer: canvasRenderer,
              radius: 3.5,
              fillColor: props.color || '#3b82f6',
              color: '#ffffff',
              weight: 1.5,
              fillOpacity: 1,
            });

            const stopTooltipHtml = `
              <div style="font-family: inherit; min-width: 140px; padding: 2px;">
                <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
                  <span style="background: ${props.color || '#3b82f6'}; color: #fff; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; text-transform: uppercase;">
                    ${props.ref || 'Arrêt'}
                  </span>
                  <span style="font-size: 10px; color: rgba(255,255,255,0.7);">${props.name}</span>
                </div>
                <div style="font-weight: 700; font-size: 12px; color: #fff; line-height: 1.3;">
                  ${sp.name}
                </div>
                ${sp.time ? `<div style="font-size: 10px; color: #38bdf8; font-weight: 600; margin-top: 3px;">🕒 Horaires : ${sp.time}</div>` : ''}
              </div>
            `;

            stopMarker.bindTooltip(stopTooltipHtml, {
              className: 'refuge-tooltip',
              direction: 'top',
              offset: [0, -6],
            });

            stopMarker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              if (onSelectTransport) {
                onSelectTransport({ ...props, selectedStop: sp, isTransport: true });
              }
            });

            group.addLayer(stopMarker);
          });
        }
      }
    });

    group.addTo(map);
    layerGroupRef.current = group;

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
      layersMapRef.current.clear();
    };
  }, [active, data, map, onSelectTransport]);

  // 3. Mise à jour instantanée du style lors de la sélection / désélection d'une ligne
  useEffect(() => {
    if (!layerGroupRef.current || layersMapRef.current.size === 0) return;

    const hasSelection = Boolean(selectedTransport);
    const selectedId = selectedTransport?.id;
    const selectedName = selectedTransport?.name;

    let selectedLayersToFront = [];

    layersMapRef.current.forEach(({ type, layer, feature, props }) => {
      const isSelected = hasSelection && (props.id === selectedId || props.name === selectedName);

      if (type === 'line') {
        const newStyle = getFeatureStyle(feature, isSelected, hasSelection);
        layer.setStyle(newStyle);

        if (isSelected) {
          selectedLayersToFront.push(layer);
        }
      } else if (type === 'point') {
        if (hasSelection) {
          layer.setStyle({
            fillOpacity: isSelected ? 1 : 0.25,
            opacity: isSelected ? 1 : 0.25,
            radius: isSelected ? 7 : 4.5,
          });
          if (isSelected) {
            selectedLayersToFront.push(layer);
          }
        } else {
          layer.setStyle({
            fillOpacity: 1,
            opacity: 1,
            radius: 5.5,
          });
        }
      }
    });

    // Passer la ligne sélectionnée impérativement AU-DESSUS de toutes les autres lignes
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
  }, [selectedTransport]);

  return null;
}
