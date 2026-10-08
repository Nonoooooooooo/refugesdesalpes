import React, { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// S'assurer que L est attaché à window avant d'importer le plugin de décalage parallèle
if (typeof window !== 'undefined') {
  window.L = L;
}
import 'leaflet-polylineoffset';

// Cache mémoire global pour éviter tout re-téléchargement
let cachedTransportData = null;

export default function TransportLayer({ active, onSelectTransport, selectedTransport }) {
  const map = useMap();
  const [data, setData] = useState(() => cachedTransportData);
  const layerGroupRef = useRef(null);
  const layersMapRef = useRef(new Map());
  const selectedTransportRef = useRef(selectedTransport);
  selectedTransportRef.current = selectedTransport;
  const stopMarkersRef = useRef([]);
  const activeDirectionOverlayRef = useRef(null);

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

  // Style selon le mode de transport, décalage et sélection
  const getFeatureStyle = (feature, isSelected, hasSelection) => {
    const mode = feature.properties?.mode;
    const isCable = mode === 'cable_car' || mode === 'funicular';
    const isTrain = mode === 'train' || mode === 'mountain_train';
    const isNavette = mode === 'navette';
    const baseColor =
      feature.properties?.color || (isTrain ? '#6366f1' : isNavette ? '#f59e0b' : '#10b981');
    const offset = Number(feature.properties?.offset) || 0;

    if (hasSelection) {
      if (isSelected) {
        return {
          color: baseColor,
          weight: isCable ? 6 : 7,
          opacity: 1,
          dashArray: isCable ? '6, 6' : null,
          lineCap: 'round',
          lineJoin: 'round',
          offset: offset,
        };
      } else {
        // Lignes non sélectionnées : estompées / sous-brillance
        return {
          color: baseColor,
          weight: isCable ? 2 : 2.5,
          opacity: 0.2,
          dashArray: isCable ? '6, 6' : null,
          lineCap: 'round',
          lineJoin: 'round',
          offset: offset,
        };
      }
    }

    // Aucun transport sélectionné : luminosité et opacité normales avec offset parallèle
    return {
      color: baseColor,
      weight: isCable ? 3 : 4,
      opacity: 0.9,
      dashArray: isCable ? '6, 6' : null,
      lineCap: 'round',
      lineJoin: 'round',
      offset: offset,
    };
  };

  const UNIFORM_STOP_RADIUS = 4;
  const HOVER_STOP_RADIUS = 5.5;

  const stopMatches = (name1, name2) => {
    if (!name1 || !name2) return false;
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
    const w1 = n1
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !['gare', 'arret', 'place', 'centre', 'station'].includes(w));
    const w2 = n2
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !['gare', 'arret', 'place', 'centre', 'station'].includes(w));
    return w1.some((w) => w2.includes(w));
  };

  const isStopAssociatedWithSelection = (entry, selected) => {
    if (!selected) return false;
    const selId = selected.id;
    const selName = selected.name;
    const selRef = selected.ref;

    // Correspondance directe par ID ou Nom de ligne
    if (entry.lineIds.has(selId)) return true;
    if (
      entry.linesInfo.some(
        (l) => l.id === selId || l.name === selName || (selRef && l.ref === selRef)
      )
    )
      return true;

    // Correspondance par stopPoints
    if (Array.isArray(selected.stopPoints)) {
      if (selected.stopPoints.some((sp) => entry.names.some((n) => stopMatches(n, sp.name))))
        return true;
    }

    // Correspondance par stops
    if (Array.isArray(selected.stops)) {
      if (selected.stops.some((s) => entry.names.some((n) => stopMatches(n, s)))) return true;
    }

    // Si le transport sélectionné est une station/gare
    if (
      entry.isStation &&
      (entry.stationId === selId || entry.names.some((n) => stopMatches(n, selName)))
    ) {
      return true;
    }

    return false;
  };

  const createStopTooltipContent = (entry) => {
    const primaryName = entry.names[0] || 'Arrêt';
    const badgesHtml = entry.linesInfo
      .map(
        (line) => `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 3px; font-size: 11px;">
        <span style="background: ${line.color || '#3b82f6'}; color: #fff; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; text-transform: uppercase; white-space: nowrap;">
          ${line.ref || 'Ligne'}
        </span>
        <span style="color: rgba(255,255,255,0.85); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">
          ${line.name || ''}
        </span>
        ${
          line.time
            ? `<span style="color: #38bdf8; font-size: 10px; font-weight: 600; white-space: nowrap;">🕒 ${
                line.time.split('|')[0].trim()
              }</span>`
            : ''
        }
      </div>
    `
      )
      .join('');

    return `
      <div style="font-family: inherit; min-width: 160px; max-width: 280px; padding: 2px;">
        <div style="font-weight: 700; font-size: 12px; color: #fff; line-height: 1.3; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 3px;">
          ${primaryName}
        </div>
        <div>${badgesHtml}</div>
      </div>
    `;
  };

  // 2. Rendu Vectoriel Ultra-Fluide avec décalages parallèles (Offset) et Déduplication
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
    const group = L.featureGroup();

    // Tooltip formaté pour les lignes
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

    const stopMarkersByLocation = new Map();

    // 1. Ajouter d'abord les lignes avec application du décalage parallèle
    data.features.forEach((feature) => {
      const props = feature.properties || {};
      const featId = props.id || feature.id;

      if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        const offsetVal = Number(props.offset) || 0;
        const initialStyle = {
          renderer: canvasRenderer,
          offset: offsetVal,
          ...getFeatureStyle(feature, false, false),
        };

        const line = L.geoJSON(feature, {
          style: () => initialStyle,
          onEachFeature: (_, layer) => {
            // Assurer que le décalage parallèle est injecté sur chaque polyline
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

            layer.bindTooltip(createTooltipContent(props), {
              className: 'refuge-tooltip',
              sticky: true,
              offset: [10, 10],
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
                    weight: isCable ? 6 : 7,
                    opacity: 1,
                    offset: offsetVal,
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
                  target.setStyle(getFeatureStyle(feature, isSelected, hasSelection));
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

        // Agréger les arrêts de la ligne pour la déduplication spatiale
        if (Array.isArray(props.stopPoints) && props.stopPoints.length > 0) {
          props.stopPoints.forEach((sp) => {
            if (sp.lat == null || sp.lng == null) return;
            const key = `${sp.lat.toFixed(4)}_${sp.lng.toFixed(4)}`;
            const lineItem = {
              id: featId,
              name: props.name,
              ref: props.ref,
              color: props.color || '#3b82f6',
              mode: props.mode,
              time: sp.time,
              stopName: sp.name,
            };

            if (stopMarkersByLocation.has(key)) {
              const entry = stopMarkersByLocation.get(key);
              entry.lineIds.add(featId);
              if (!entry.names.includes(sp.name)) entry.names.push(sp.name);
              entry.linesInfo.push(lineItem);
            } else {
              stopMarkersByLocation.set(key, {
                lat: sp.lat,
                lng: sp.lng,
                names: [sp.name],
                lineIds: new Set([featId]),
                linesInfo: [lineItem],
                color: props.color || '#3b82f6',
                primaryProps: props,
                primaryStop: sp,
              });
            }
          });
        }
      }
    });

    // 2. Traiter les gares et pôles (Points) et les fusionner/dédupliquer avec les arrêts
    data.features.forEach((feature) => {
      const props = feature.properties || {};
      const featId = props.id || feature.id;

      if (feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
        const lineItem = {
          id: featId,
          name: props.name,
          ref: props.ref || 'Pôle',
          color: props.color || '#3b82f6',
          mode: props.mode || 'station',
          stops: props.stops || props.lines,
        };

        if (stopMarkersByLocation.has(key)) {
          const entry = stopMarkersByLocation.get(key);
          entry.isStation = true;
          entry.stationId = featId;
          entry.lineIds.add(featId);
          if (!entry.names.includes(props.name)) entry.names.unshift(props.name);
          entry.linesInfo.push(lineItem);
        } else {
          stopMarkersByLocation.set(key, {
            lat,
            lng,
            isStation: true,
            stationId: featId,
            names: [props.name],
            lineIds: new Set([featId]),
            linesInfo: [lineItem],
            color: props.color || '#3b82f6',
            primaryProps: props,
          });
        }
      }
    });

    // 3. Créer un unique marqueur géométrique uniforme pour chaque arrêt dédupliqué
    const stopMarkersList = [];
    stopMarkersByLocation.forEach((entry) => {
      const stopMarker = L.circleMarker([entry.lat, entry.lng], {
        renderer: canvasRenderer,
        radius: UNIFORM_STOP_RADIUS,
        fillColor: entry.color,
        stroke: false,
        weight: 0,
        fillOpacity: 0.95,
      });

      stopMarker._stopEntry = entry;

      stopMarker.bindTooltip(createStopTooltipContent(entry), {
        className: 'refuge-tooltip',
        direction: 'top',
        offset: [0, -6],
      });

      stopMarker.on({
        mouseover: (e) => {
          const currentSel = selectedTransportRef.current;
          const isAssoc = currentSel ? isStopAssociatedWithSelection(entry, currentSel) : true;
          e.target.setRadius(HOVER_STOP_RADIUS);
          if (currentSel && !isAssoc) {
            e.target.setStyle({ fillOpacity: 0.8 });
          }
          if (e.target.bringToFront) e.target.bringToFront();
        },
        mouseout: (e) => {
          const currentSel = selectedTransportRef.current;
          if (currentSel) {
            const isAssoc = isStopAssociatedWithSelection(entry, currentSel);
            e.target.setRadius(isAssoc ? UNIFORM_STOP_RADIUS + 0.5 : UNIFORM_STOP_RADIUS);
            e.target.setStyle({ fillOpacity: isAssoc ? 1 : 0.15 });
          } else {
            e.target.setRadius(UNIFORM_STOP_RADIUS);
            e.target.setStyle({ fillOpacity: 0.95 });
          }
        },
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          if (onSelectTransport) {
            const currentSel = selectedTransportRef.current;
            const matchingLine = entry.linesInfo.find(
              (l) => currentSel && (l.id === currentSel.id || l.name === currentSel.name)
            );
            const targetInfo = matchingLine || entry.linesInfo[0] || entry.primaryProps;
            onSelectTransport({
              ...entry.primaryProps,
              ...targetInfo,
              selectedStop: {
                name: entry.names[0],
                lat: entry.lat,
                lng: entry.lng,
                time: targetInfo.time,
              },
              isTransport: true,
            });
          }
        },
      });

      group.addLayer(stopMarker);
      stopMarkersList.push(stopMarker);
    });

    stopMarkersRef.current = stopMarkersList;
    group.addTo(map);
    layerGroupRef.current = group;

    return () => {
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
    };
  }, [active, data, map, onSelectTransport]);

  // 3. Mise à jour instantanée du style lors de la sélection / désélection d'une ligne
  // et affichage des deux directions (Aller / Retour) avec badges Départ & Terminus
  useEffect(() => {
    if (!layerGroupRef.current) return;

    const hasSelection = Boolean(selectedTransport);
    const selectedId = selectedTransport?.id;
    const selectedName = selectedTransport?.name;

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
        const newStyle = getFeatureStyle(feature, isSelected, hasSelection);
        layer.setStyle(newStyle);

        if (isSelected) {
          selectedLayersToFront.push(layer);
        }
      }
    });

    // Arrêts : sous-brillance synchronisée avec les traits
    if (stopMarkersRef.current && stopMarkersRef.current.length > 0) {
      stopMarkersRef.current.forEach((marker) => {
        const entry = marker._stopEntry;
        if (!entry) return;

        if (hasSelection) {
          const isAssociated = isStopAssociatedWithSelection(entry, selectedTransport);
          if (isAssociated) {
            marker.setStyle({
              radius: UNIFORM_STOP_RADIUS + 0.5,
              fillOpacity: 1,
              opacity: 1,
            });
            selectedLayersToFront.push(marker);
          } else {
            // Sous-brillance (estompé identique aux traits non sélectionnés)
            marker.setStyle({
              radius: UNIFORM_STOP_RADIUS,
              fillOpacity: 0.15,
              opacity: 0.15,
            });
          }
        } else {
          // Aucun transport sélectionné : opacité et taille uniforme normales
          marker.setStyle({
            radius: UNIFORM_STOP_RADIUS,
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

        // 1. Tracé spécifique à la direction si des coordonnées dédiées existent
        if (activeDir?.coordinates && activeDir.coordinates.length >= 2) {
          const latlngs = activeDir.coordinates.map((c) => [c[1], c[0]]);
          const dirLine = L.polyline(latlngs, {
            color: selectedTransport.color || '#3b82f6',
            weight: 7,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
            offset: Number(selectedTransport.offset) || 0,
          });
          dirGroup.addLayer(dirLine);
        }

        // 2. Badge DÉPART (Vert émeraude)
        const departMarker = L.marker(startPt, {
          icon: L.divIcon({
            className: 'custom-direction-marker',
            html: `
              <div style="display: inline-flex; align-items: center; gap: 4px; background: #059669; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2px solid #fff; white-space: nowrap; transform: translate(-50%, -120%); pointer-events: none;">
                <span style="font-size: 11px;">🟢 DÉPART</span>
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
              <div style="display: inline-flex; align-items: center; gap: 4px; background: #e11d48; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2px solid #fff; white-space: nowrap; transform: translate(-50%, -120%); pointer-events: none;">
                <span style="font-size: 11px;">🏁 TERMINUS</span>
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
