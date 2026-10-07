import { Satellite, Mountain, Footprints } from 'lucide-react'

/**
 * Sélecteur de fonds de carte et calque sentiers (Design Glassmorphism épuré).
 */
export default function BaseLayerSwitcher({
  baseLayer,
  onBaseLayerChange,
  showTrails,
  onToggleTrails,
}) {
  const isSatellite = baseLayer === 'satellite'
  return (
    <div className="glass absolute right-4 top-4 z-[1000] flex items-center gap-1.5 rounded-2xl p-1.5 shadow-2xl">
      {/* Sélecteur de fond de carte */}
      <div className="relative flex rounded-xl bg-black/30 p-0.5">
        <span
          aria-hidden
          className="absolute bottom-0.5 top-0.5 w-[calc(50%-2px)] rounded-lg bg-white/20 shadow-sm transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${isSatellite ? 0 : 100}%)`, left: 2 }}
        />
        <button
          onClick={() => onBaseLayerChange('satellite')}
          className={`relative z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            isSatellite ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
          }`}
        >
          <Satellite size={13} />
          Satellite
        </button>
        <button
          onClick={() => onBaseLayerChange('relief')}
          className={`relative z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            !isSatellite ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
          }`}
        >
          <Mountain size={13} />
          Relief
        </button>
      </div>

      <div className="mx-0.5 h-5 w-px bg-white/15" />

      {/* Bouton bascule des sentiers de randonnée */}
      <button
        onClick={onToggleTrails}
        title="Afficher/masquer les sentiers de randonnée (GR, PR)"
        className={`glass-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
          showTrails
            ? 'border border-emerald-400/40 bg-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
            : 'bg-white/5 text-white/60 hover:text-white'
        }`}
      >
        <Footprints size={14} className={showTrails ? 'text-emerald-400' : ''} />
        Sentiers
      </button>
    </div>
  )
}
