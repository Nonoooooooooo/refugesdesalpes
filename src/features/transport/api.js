import osmtogeojson from 'osmtogeojson';

export async function fetchTransportData(bbox, signal) {
  const [w, s, e, n] = bbox;
  
  // Requête Overpass pour extraire arrêts et lignes alpines (trains, bus, téléphériques)
  const query = `
    [out:json][timeout:25];
    (
      node["public_transport"="stop_position"](${s},${w},${n},${e});
      node["highway"="bus_stop"](${s},${w},${n},${e});
      node["railway"="station"](${s},${w},${n},${e});
      node["railway"="halt"](${s},${w},${n},${e});
      way["railway"~"rail|light_rail|narrow_gauge|funicular"](${s},${w},${n},${e});
      way["aerialway"](${s},${w},${n},${e});
    );
    out body;
    >;
    out skel qt;
  `;
  
  const url = `https://overpass-api.de/api/interpreter`;
  const res = await fetch(url, {
    method: 'POST',
    body: "data=" + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal
  });
  
  if (!res.ok) {
    throw new Error("Erreur de récupération des données de transport (Overpass API)");
  }
  
  const data = await res.json();
  return osmtogeojson(data);
}
