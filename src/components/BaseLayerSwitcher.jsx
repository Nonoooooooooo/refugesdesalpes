import { Satellite, Mountain } from 'lucide-react'

const OPTIONS = [
  { key: 'satellite', label: 'Satellite', Icon: Satellite },
  { key: 'relief', label: 'Relief', Icon: Mountain },
]

/** Sélecteur segmenté de fond de carte (style glassmorphism). */
export default function BaseLayerSwitcher({ value, onChange }) {
  const index = OPTIONS.findIndex((o) => o.key === value)
  return (
    <div
      role="radiogroup"
      aria-label="Fond de carte"
      className="glass absolute right-4 top-4 z-[1000] flex rounded-2xl p-1"
    >
      {/* Pastille animée */}
      <span
        aria-hidden
        className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-xl bg-white/20 shadow-inner transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)`, left: 4 }}
      />
      {OPTIONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={`relative z-10 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
            value === key ? 'text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  )
}
