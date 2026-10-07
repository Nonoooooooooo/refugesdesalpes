import { Home, Tent, Mountain, TriangleAlert, Bed, MapPin, Droplets } from 'lucide-react'

const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const TYPES = [
  { key: 'garde', match: 'refuge garde', label: 'Refuge gardé', color: '#16a34a', Icon: Home },
  { key: 'cabane', match: 'cabane', label: 'Cabane non gardée', color: '#d97706', Icon: Tent },
  { key: 'gite', match: 'gite', label: "Gîte d'étape", color: '#2563eb', Icon: Bed },
  { key: 'eau', match: 'point d', label: "Point d'eau", color: '#0891b2', Icon: Droplets },
  { key: 'sommet', match: 'sommet', label: 'Sommet', color: '#7c3aed', Icon: Mountain },
  { key: 'danger', match: 'passage', label: 'Passage délicat', color: '#dc2626', Icon: TriangleAlert },
]
const OTHER = { key: 'autre', label: 'Autre', color: '#64748b', Icon: MapPin }

export const FILTERABLE = [...TYPES, OTHER]

export function typeInfo(valeur) {
  const n = norm(valeur)
  return TYPES.find((t) => n.includes(t.match)) ?? OTHER
}
