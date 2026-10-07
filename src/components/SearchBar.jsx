import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Search,
  X,
  MapPin,
  Home,
  Tent,
  Bed,
  TrainFront,
  Bus,
  CableCar,
  ChevronRight,
  Loader2,
  Navigation,
  Compass
} from 'lucide-react'
import { typeInfo } from '../lib/types.jsx'

const norm = (str = '') =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

function getTransportBadge(mode) {
  switch (mode) {
    case 'train':
      return { label: 'Train TER/TGV', color: '#3b82f6', Icon: TrainFront }
    case 'mountain_train':
      return { label: 'Train panoramique', color: '#8b5cf6', Icon: TrainFront }
    case 'navette':
      return { label: 'Navette estivale', color: '#f59e0b', Icon: Bus }
    case 'cable_car':
      return { label: 'Téléphérique', color: '#ec4899', Icon: CableCar }
    case 'funicular':
      return { label: 'Funiculaire', color: '#ec4899', Icon: CableCar }
    case 'station':
      return { label: 'Gare / Pôle', color: '#06b6d4', Icon: MapPin }
    default:
      return { label: 'Car / Bus', color: '#10b981', Icon: Bus }
  }
}

let cachedRefuges = null
let cachedTransports = null

export default function SearchBar({
  onSelectRefuge,
  onSelectTransport,
  onSelectCity,
  hasSelected,
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'refuges' | 'transports' | 'villes'
  
  const [refugesData, setRefugesData] = useState([])
  const [transportsData, setTransportsData] = useState([])
  const [cityResults, setCityResults] = useState([])
  const [isSearchingCities, setIsSearchingCities] = useState(false)

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const cityAbortRef = useRef(null)

  // Charger les données d'index en arrière-plan
  useEffect(() => {
    if (cachedRefuges) {
      setRefugesData(cachedRefuges)
    } else {
      fetch('/refuges_index.json')
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          cachedRefuges = data
          setRefugesData(data)
        })
        .catch(() => {})
    }

    if (cachedTransports) {
      setTransportsData(cachedTransports)
    } else {
      fetch('/transports_alpes.json')
        .then((r) => (r.ok ? r.json() : { features: [] }))
        .then((geojson) => {
          const items = (geojson.features || []).map((f) => {
            const props = f.properties || {}
            let centerLat = props.lat
            let centerLng = props.lng
            if (!centerLat && f.geometry?.coordinates) {
              const coords = f.geometry.coordinates
              if (f.geometry.type === 'Point') {
                centerLng = coords[0]
                centerLat = coords[1]
              } else if (f.geometry.type === 'LineString' && coords.length > 0) {
                const mid = coords[Math.floor(coords.length / 2)]
                centerLng = mid[0]
                centerLat = mid[1]
              }
            }
            return {
              ...props,
              centerLat,
              centerLng,
              isTransport: true,
            }
          })
          cachedTransports = items
          setTransportsData(items)
        })
        .catch(() => {})
    }
  }, [])

  // Clic en dehors pour fermer
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Recherche villes via Base Adresse Nationale (Gouv.fr)
  useEffect(() => {
    const q = query.trim()
    cityAbortRef.current?.abort()

    if (q.length < 2) {
      setCityResults([])
      setIsSearchingCities(false)
      return
    }

    const ctrl = new AbortController()
    cityAbortRef.current = ctrl
    setIsSearchingCities(true)

    const timer = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&limit=4`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((d) => {
          const cities = (d.features || []).map((f) => ({
            name: f.properties.name,
            postcode: f.properties.postcode,
            context: f.properties.context,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
          setCityResults(cities)
          setIsSearchingCities(false)
        })
        .catch((e) => {
          if (ctrl.signal.aborted) return
          setCityResults([])
          setIsSearchingCities(false)
        })
    }, 180)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query])

  // Filtrage local des refuges et des transports
  const filteredRefuges = useMemo(() => {
    const q = norm(query)
    if (!q || q.length < 2) return []

    const matches = []
    for (const r of refugesData) {
      const name = norm(r.nom)
      if (name.includes(q)) {
        const starts = name.startsWith(q)
        matches.push({ item: r, score: starts ? 2 : 1 })
      }
      if (matches.length >= 25) break
    }

    return matches.sort((a, b) => b.score - a.score).map((m) => m.item).slice(0, 6)
  }, [query, refugesData])

  const filteredTransports = useMemo(() => {
    const q = norm(query)
    if (!q || q.length < 2) return []

    const matches = []
    for (const t of transportsData) {
      const name = norm(t.name)
      const ref = norm(t.ref)
      const route = norm(t.route)
      const net = norm(t.network)
      const stops = Array.isArray(t.stops) ? t.stops.map(norm).join(' ') : ''

      if (name.includes(q) || ref.includes(q) || route.includes(q) || net.includes(q) || stops.includes(q)) {
        matches.push(t)
      }
      if (matches.length >= 20) break
    }

    return matches.slice(0, 6)
  }, [query, transportsData])

  const totalResults = filteredRefuges.length + filteredTransports.length + cityResults.length
  const hasQuery = query.trim().length >= 2

  const handleSelectRefuge = (r) => {
    onSelectRefuge(r)
    setIsOpen(false)
    setIsMobileOpen(false)
  }

  const handleSelectTransport = (t) => {
    onSelectTransport(t)
    setIsOpen(false)
    setIsMobileOpen(false)
  }

  const handleSelectCity = (c) => {
    onSelectCity(c)
    setIsOpen(false)
    setIsMobileOpen(false)
  }

  const clearQuery = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div
      ref={containerRef}
      className={`absolute top-4 z-[1050] transition-all duration-300 ${
        hasSelected ? 'left-4 sm:left-[448px]' : 'left-4'
      } ${
        isMobileOpen
          ? 'right-4 sm:right-auto sm:w-80 md:w-96'
          : 'w-10 sm:w-80 md:w-96'
      }`}
    >
      {/* Barre de recherche principale */}
      <div
        className={`glass flex items-center gap-2 rounded-2xl p-1.5 shadow-2xl transition-all ${
          isOpen ? 'ring-2 ring-emerald-400/40' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setIsMobileOpen((prev) => !prev)
            setIsOpen(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          title="Rechercher refuge, ville, transport"
        >
          <Search size={16} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false)
              setIsMobileOpen(false)
            }
          }}
          placeholder="Refuge, ville, ligne (ex: Clarée, Chamonix)..."
          className={`h-8 w-full bg-transparent text-xs text-white placeholder-white/45 outline-none transition-all ${
            !isMobileOpen ? 'hidden sm:block' : 'block'
          }`}
        />

        {query && (
          <button
            type="button"
            onClick={clearQuery}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
            title="Effacer"
          >
            <X size={14} />
          </button>
        )}

        {isMobileOpen && (
          <button
            type="button"
            onClick={() => {
              setIsMobileOpen(false)
              setIsOpen(false)
            }}
            className="sm:hidden flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/60 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dropdown des résultats */}
      {isOpen && hasQuery && (
        <div className="glass glass-panel scroll-thin mt-2 flex max-h-[72vh] flex-col overflow-y-auto rounded-2xl border border-white/15 bg-black/85 p-2 shadow-2xl backdrop-blur-2xl">
          {/* Onglets de filtrage rapide */}
          <div className="mb-2 flex gap-1 border-b border-white/10 pb-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Tout ({totalResults})
            </button>
            <button
              onClick={() => setActiveTab('refuges')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'refuges'
                  ? 'bg-emerald-500/30 text-emerald-200'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Refuges ({filteredRefuges.length})
            </button>
            <button
              onClick={() => setActiveTab('transports')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'transports'
                  ? 'bg-indigo-500/30 text-indigo-200'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Transports ({filteredTransports.length})
            </button>
            <button
              onClick={() => setActiveTab('villes')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'villes'
                  ? 'bg-sky-500/30 text-sky-200'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Villes ({cityResults.length})
            </button>
          </div>

          {totalResults === 0 && !isSearchingCities && (
            <div className="py-6 text-center text-xs text-white/50">
              Aucun résultat pour « {query} »
            </div>
          )}

          {/* Section Refuges */}
          {(activeTab === 'all' || activeTab === 'refuges') && filteredRefuges.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                <Home size={12} /> Refuges & Cabanes ({filteredRefuges.length})
              </div>
              <div className="flex flex-col gap-1">
                {filteredRefuges.map((r) => {
                  const info = typeInfo(r.type)
                  return (
                    <button
                      key={r.id}
                      onClick={() => handleSelectRefuge(r)}
                      className="flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-white/10"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm"
                        style={{ background: info.color }}
                      >
                        <info.Icon size={14} className="text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">
                          {r.nom}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/60">
                          {r.alt ? <span>{r.alt} m</span> : null}
                          <span>· {info.label}</span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/30" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section Transports */}
          {(activeTab === 'all' || activeTab === 'transports') && filteredTransports.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-indigo-300/80">
                <Bus size={12} /> Lignes & Navettes ({filteredTransports.length})
              </div>
              <div className="flex flex-col gap-1">
                {filteredTransports.map((t) => {
                  const badge = getTransportBadge(t.mode)
                  return (
                    <button
                      key={t.id || t.name}
                      onClick={() => handleSelectTransport(t)}
                      className="flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-white/10"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm"
                        style={{ background: t.color || badge.color }}
                      >
                        <badge.Icon size={14} className="text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-white/20 px-1 py-0.2 text-[9px] font-bold text-white uppercase">
                            {t.ref || 'Ligne'}
                          </span>
                          <span className="truncate text-xs font-semibold text-white">
                            {t.name}
                          </span>
                        </div>
                        <div className="truncate text-[10px] text-white/60">
                          {t.route || t.operator || badge.label}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/30" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section Villes */}
          {(activeTab === 'all' || activeTab === 'villes') && (
            <div>
              <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-sky-300/80">
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} /> Villes & Communes
                </span>
                {isSearchingCities && <Loader2 size={10} className="animate-spin text-white/50" />}
              </div>
              <div className="flex flex-col gap-1">
                {cityResults.map((c) => (
                  <button
                    key={`${c.name}-${c.lat}-${c.lng}`}
                    onClick={() => handleSelectCity(c)}
                    className="flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-white/10"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/25 text-sky-300 shadow-sm">
                      <Navigation size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">
                        {c.name}
                      </div>
                      <div className="truncate text-[10px] text-white/60">
                        {c.context}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-white/30" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
