import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useMapEvents, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { fetchTransportData } from './api';

const MIN_ZOOM = 12; // Overpass peut être lourd, on limite au zoom 12

const pointToLayer = (feature, latlng) => {
  return L.circleMarker(latlng, {
    radius: 4,
    fillColor: '#3b82f6', // bleu pour les arrêts
    color: '#ffffff',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.9
  });
};

const style = (feature) => {
  if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
    const isAerialway = !!feature.properties?.aerialway;
    return {
      color: isAerialway ? '#d946ef' : '#3b82f6', // fuchsia pour les téléphériques, bleu pour les trains
      weight: isAerialway ? 2 : 3,
      opacity: 0.7,
      dashArray: isAerialway ? '5, 5' : null
    };
  }
};

const onEachFeature = (feature, layer) => {
  if (feature.properties?.name) {
    layer.bindTooltip(
      `<div class="font-medium text-sm">${feature.properties.name}</div>
       <div class="text-xs opacity-80">${feature.properties.public_transport || feature.properties.railway || feature.properties.aerialway || 'Arrêt'}</div>`,
      { sticky: true }
    );
  }
};

export default function TransportLayer({ active }) {
  const map = useMap();
  const [geoData, setGeoData] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: null, tooFar: false });
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  const load = useCallback(() => {
    if (!active) return;
    
    abortRef.current?.abort();
    if (map.getZoom() < MIN_ZOOM) {
      setStatus({ loading: false, error: null, tooFar: true });
      setGeoData(null);
      return;
    }

    const b = map.getBounds();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    
    setStatus({ loading: true, error: null, tooFar: false });
    
    fetchTransportData([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], ctrl.signal)
      .then((data) => {
        setGeoData(data);
        setStatus({ loading: false, error: null, tooFar: false });
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setStatus({ loading: false, error: "Erreur transports", tooFar: false });
      });
  }, [map, active]);

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, 500);
  }, [load]);

  useMapEvents({ moveend: schedule });

  useEffect(() => {
    if (active) {
      load();
    } else {
      setGeoData(null);
      abortRef.current?.abort();
      setStatus({ loading: false, error: null, tooFar: false });
    }
    return () => {
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [active, load]);

  // Petit indicateur de statut local au dessus de la carte
  const StatusIndicator = () => {
    if (!active || (!status.loading && !status.error && !status.tooFar)) return null;
    
    return (
      <div className="absolute top-16 right-4 z-[1000] pointer-events-none">
        <div className="glass px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 text-white/80">
          {status.loading && <span>Chargement transports...</span>}
          {status.tooFar && !status.loading && <span>Zoomer pour les transports</span>}
          {status.error && !status.loading && <span className="text-red-300">{status.error}</span>}
        </div>
      </div>
    );
  };

  return (
    <>
      <StatusIndicator />
      {active && geoData && (
        <GeoJSON
          key={geoData.features.length + '-' + map.getCenter().toString() + '-' + map.getZoom()}
          data={geoData}
          pointToLayer={pointToLayer}
          style={style}
          onEachFeature={onEachFeature}
        />
      )}
    </>
  );
}
