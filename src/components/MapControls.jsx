import { useMap } from 'react-leaflet'
import { Plus, Minus, LocateFixed } from 'lucide-react'

export default function MapControls() {
  const map = useMap()
  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 13),
      () => {},
    )
  const btn = 'glass-btn flex h-10 w-10 items-center justify-center'
  return (
    <div
      className="absolute right-4 top-4 z-[1000] flex flex-col gap-2"
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="glass flex flex-col overflow-hidden rounded-2xl">
        <button aria-label="Zoom avant" className={btn} onClick={() => map.zoomIn()}>
          <Plus size={18} />
        </button>
        <div className="h-px bg-white/15" />
        <button aria-label="Zoom arrière" className={btn} onClick={() => map.zoomOut()}>
          <Minus size={18} />
        </button>
      </div>
      <button aria-label="Ma position" className={`${btn} glass rounded-2xl`} onClick={locate}>
        <LocateFixed size={18} />
      </button>
    </div>
  )
}
