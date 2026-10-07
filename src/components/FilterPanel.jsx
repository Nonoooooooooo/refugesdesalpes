import { FILTERABLE } from '../lib/types.jsx'

export default function FilterPanel({ active, onToggle }) {
  return (
    <div className="glass absolute right-[19rem] top-4 z-[1000] hidden max-w-[calc(100vw-34rem)] flex-wrap justify-end gap-1.5 rounded-2xl p-2 lg:flex">
      {FILTERABLE.map(({ key, label, color, Icon }) => {
        const on = active.has(key)
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            aria-pressed={on}
            className={`glass-btn flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium ${
              on ? 'bg-white/15' : 'opacity-45'
            }`}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: color }}
            >
              <Icon size={12} />
            </span>
            {label}
          </button>
        )
      })}
    </div>
  )
}
