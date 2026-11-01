import { useMemo } from 'react'
import { Polyline, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Flag, Play } from 'lucide-react'

// Icône de départ (drapeau vert alpin)
function createStartIcon() {
  return L.divIcon({
    className: 'track-start-marker',
    html: renderToStaticMarkup(
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: '#10b981',
          border: '2px solid #ffffff',
          boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
        }}
      >
        <Play size={12} fill="#ffffff" style={{ marginLeft: '1px' }} />
      </div>,
    ),
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

// Icône d'arrivée (drapeau à damier ou rouge)
function createFinishIcon() {
  return L.divIcon({
    className: 'track-finish-marker',
    html: renderToStaticMarkup(
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: '#ef4444',
          border: '2px solid #ffffff',
          boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
        }}
      >
        <Flag size={12} fill="#ffffff" />
      </div>,
    ),
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

const startIcon = createStartIcon()
const finishIcon = createFinishIcon()

export default function TrackLayer({
  activeTrackPoints = [],
  isBacktrackMode = false,
  backtrackGuidance = null,
  currentLocation = null,
  selectedTrackToView = null,
}) {

  // Coordonnées de la trace active en cours d'enregistrement
  const activeLatLngs = useMemo(() => {
    return activeTrackPoints.map((p) => [p.lat, p.lng])
  }, [activeTrackPoints])

  // Ligne de guidage Fil d'Ariane reliant la position actuelle au tracé
  const backtrackGuideLine = useMemo(() => {
    if (!isBacktrackMode || !currentLocation || !backtrackGuidance?.nextWayPoint) {
      return null
    }
    return [
      [currentLocation.lat, currentLocation.lng],
      [backtrackGuidance.nextWayPoint.lat, backtrackGuidance.nextWayPoint.lng],
    ]
  }, [isBacktrackMode, currentLocation, backtrackGuidance])

  // Tracé sauvegardé actif sélectionné pour affichage
  const selectedTrackLatLngs = useMemo(() => {
    if (!selectedTrackToView || !selectedTrackToView.points) return null
    return selectedTrackToView.points.map((p) => [p.lat, p.lng])
  }, [selectedTrackToView])

  return (
    <>
      {/* ─── 1. TRACE ACTIVE EN DIRECT (STYLE STRAVA / HAUTE VISIBILITÉ MONTAGNE) ─── */}
      {activeLatLngs.length > 1 && (
        <>
          {/* Sous-couche de contraste noir (pour ressortir sur fond blanc neige ou satellite sombre) */}
          <Polyline
            positions={activeLatLngs}
            pathOptions={{
              color: '#000000',
              weight: 8,
              opacity: 0.55,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />

          {/* Ligne principale vibrante (Orange Strava ou Cyan Fil d'Ariane) */}
          <Polyline
            positions={activeLatLngs}
            pathOptions={{
              color: isBacktrackMode ? '#00f0ff' : '#ff5a00',
              weight: 5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />

          {/* Point de départ */}
          <Marker position={activeLatLngs[0]} icon={startIcon}>
            <Popup className="track-popup">
              <div className="text-xs p-1 font-semibold text-slate-800">
                🚀 Point de départ
              </div>
            </Popup>
          </Marker>

          {/* Balises de direction / fil d'Ariane (petits points de repère visuel) */}
          {activeLatLngs.length > 5 &&
            activeLatLngs.map((pos, idx) => {
              if (idx > 0 && idx % 8 === 0 && idx < activeLatLngs.length - 1) {
                return (
                  <CircleMarker
                    key={`crumb_${idx}`}
                    center={pos}
                    radius={3.5}
                    pathOptions={{
                      color: '#ffffff',
                      fillColor: isBacktrackMode ? '#00f0ff' : '#ff5a00',
                      fillOpacity: 1,
                      weight: 1.5,
                    }}
                  />
                )
              }
              return null
            })}
        </>
      )}

      {/* ─── 2. LIGNE DE RETOUR FIL D'ARIANE DANS LE BROUILLARD ─── */}
      {backtrackGuideLine && (
        <Polyline
          positions={backtrackGuideLine}
          pathOptions={{
            color: '#00f0ff',
            weight: 3.5,
            dashArray: '6, 8',
            opacity: 0.9,
          }}
        />
      )}

      {/* ─── 3. TRACÉ SAUVEGARDÉ / IMPORTÉ AFFICHÉ SUR LA CARTE ─── */}
      {selectedTrackLatLngs && selectedTrackLatLngs.length > 1 && (
        <>
          {/* Halo de contraste */}
          <Polyline
            positions={selectedTrackLatLngs}
            pathOptions={{
              color: '#000000',
              weight: 8,
              opacity: 0.5,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          {/* Ligne émeraude/violette */}
          <Polyline
            positions={selectedTrackLatLngs}
            pathOptions={{
              color: '#10b981',
              weight: 4.5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />

          {/* Marqueur de début */}
          <Marker position={selectedTrackLatLngs[0]} icon={startIcon}>
            <Popup>
              <div className="text-xs p-1">
                <div className="font-bold text-slate-900">{selectedTrackToView.name}</div>
                <div className="text-slate-500 mt-0.5">Point de départ</div>
              </div>
            </Popup>
          </Marker>

          {/* Marqueur de fin */}
          <Marker
            position={selectedTrackLatLngs[selectedTrackLatLngs.length - 1]}
            icon={finishIcon}
          >
            <Popup>
              <div className="text-xs p-1">
                <div className="font-bold text-slate-900">{selectedTrackToView.name}</div>
                <div className="text-slate-500 mt-0.5">Point d’arrivée</div>
                <div className="mt-1 flex items-center gap-2 font-medium">
                  <span>{(selectedTrackToView.distance / 1000).toFixed(2)} km</span>
                  <span>·</span>
                  <span className="text-emerald-600">
                    +{Math.round(selectedTrackToView.elevationGain || 0)} m
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        </>
      )}
    </>
  )
}
