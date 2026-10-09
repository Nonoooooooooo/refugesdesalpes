globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  devicePixelRatio: 1
};
globalThis.document = {
  documentElement: { style: {} },
  createElement: () => ({ getContext: () => ({}) })
};
globalThis.navigator = { userAgent: '' };

import L from 'leaflet';
import 'leaflet-polylineoffset';

const line = L.polyline([[45.0, 6.0], [45.1, 6.1]], { offset: 5 });
console.log('Polyline created with offset option:', line.options.offset);
console.log('Has setOffset method?', typeof line.setOffset === 'function');
