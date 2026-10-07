import React from 'react';
import { TileLayer } from 'react-leaflet';

export default function TransportLayer({ active }) {
  if (!active) return null;

  return (
    <TileLayer
      key="opnvkarte-transport"
      pane="overlayPane"
      url="https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://memomaps.de/">memomaps.de</a> <a href="http://www.openstreetmap.org/copyright">ODbL</a>'
      opacity={0.75}
      maxZoom={18}
    />
  );
}
