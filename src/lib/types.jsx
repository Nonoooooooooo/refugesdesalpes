import { Home, Bed, MapPin, Droplets } from 'lucide-react'

/** Icône chalet / cabane de montagne (toit débordant, cheminée de poêle, murs en dur) */
export function Cabin({ size = 24, strokeWidth = 2, className = '', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="m2 11 10-8 10 8" />
      <path d="M17 5v3.5" />
      <path d="M4 10.5V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9.5" />
      <path d="M10 21v-6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6" />
    </svg>
  )
}

const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const TYPES = [
  { key: 'garde', match: 'refuge garde', label: 'Refuge gardé', shortLabel: 'Refuge', color: '#16a34a', Icon: Home },
  { key: 'cabane', match: 'cabane', label: 'Cabane non gardée', shortLabel: 'Cabane', color: '#d97706', Icon: Cabin },
  { key: 'gite', match: 'gite', label: "Gîte d'étape", shortLabel: 'Gîte', color: '#2563eb', Icon: Bed },
  { key: 'eau', match: 'point d', label: "Point d'eau", shortLabel: 'Eau', color: '#0891b2', Icon: Droplets },
]
const OTHER = { key: 'autre', label: 'Autre', shortLabel: 'Autre', color: '#64748b', Icon: MapPin }

export const FILTERABLE = [...TYPES, OTHER]

export function typeInfo(valeur) {
  const n = norm(valeur)
  return TYPES.find((t) => n.includes(t.match)) ?? OTHER
}

export function isPointClosed(etat) {
  if (!etat) return false
  const s = norm(etat)
  return s.includes('ferm') || s.includes('detruit')
}
