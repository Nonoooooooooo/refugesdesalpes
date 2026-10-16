import { useState, useMemo, useRef } from 'react'
import {
  Heart,
  X,
  Trash2,
  Navigation,
  Download,
  Upload,
  Search,
  Mountain,
  BedDouble,
  ArrowUpDown,
  ExternalLink,
  MapPin,
  CheckCircle,
} from 'lucide-react'
import { useFavorites } from '../context/FavoritesContext.jsx'
import { typeInfo } from '../lib/types.jsx'

export default function FavoritesModal({
  isOpen,
  onClose,
  onSelectRefuge,
  filterOnlyFavorites,
  onToggleFilterOnlyFavorites,
}) {
  const {
    favorites,
    favoritesCount,
    removeFavorite,
    clearFavorites,
    exportFavorites,
    importFavorites,
  } = useFavorites()

  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('recent') // 'recent' | 'name' | 'alt'
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInputRef = useRef(null)

  // Filtrage et tri
  const filteredFavorites = useMemo(() => {
    let list = [...favorites]

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (f) =>
          f.nom.toLowerCase().includes(q) ||
          (f.type && f.type.toLowerCase().includes(q)) ||
          (f.alt != null && String(f.alt).includes(q)),
      )
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    } else if (sortBy === 'alt') {
      list.sort((a, b) => (b.alt || 0) - (a.alt || 0))
    } else {
      // 'recent'
      list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    }

    return list
  }, [favorites, query, sortBy])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result)
        importFavorites(data)
      } catch (err) {
        console.error(err)
        alert('Format de fichier JSON invalide')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass glass-panel relative flex flex-col w-full max-w-xl max-h-[85vh] rounded-3xl border border-white/20 bg-neutral-950/90 shadow-2xl text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <Heart size={20} className="fill-rose-500" />
            </span>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Mes Refuges Favoris
                <span className="rounded-full bg-rose-500/30 text-rose-300 text-xs px-2.5 py-0.5 font-semibold">
                  {favoritesCount}
                </span>
              </h2>
              <p className="text-xs text-white/60">
                Sauvegardés sans compte sur cet appareil (navigateur)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="glass-btn flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        {/* Toolbar & Filter */}
        <div className="flex flex-col gap-3 p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer parmi vos favoris…"
                className="w-full rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:border-rose-400/50 focus:bg-white/10 focus:outline-none transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Tri */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs">
              <ArrowUpDown size={13} className="text-white/50" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs text-white/90 outline-none cursor-pointer"
              >
                <option value="recent" className="bg-neutral-900 text-white">Récents</option>
                <option value="name" className="bg-neutral-900 text-white">Nom (A-Z)</option>
                <option value="alt" className="bg-neutral-900 text-white">Altitude</option>
              </select>
            </div>
          </div>

          {/* Option n'afficher que les favoris sur la carte */}
          {favoritesCount > 0 && (
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterOnlyFavorites}
                  onChange={onToggleFilterOnlyFavorites}
                  className="rounded accent-rose-500 h-4 w-4 cursor-pointer"
                />
                <span>N'afficher que mes favoris sur la carte</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportFavorites}
                  title="Exporter mes favoris au format JSON"
                  className="glass-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] text-white/70 hover:text-white bg-white/5 border border-white/10"
                >
                  <Download size={12} />
                  <span>Exporter</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Importer des favoris depuis un fichier JSON"
                  className="glass-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] text-white/70 hover:text-white bg-white/5 border border-white/10"
                >
                  <Upload size={12} />
                  <span>Importer</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 scroll-thin flex flex-col gap-2.5">
          {favoritesCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                <Heart size={32} />
              </div>
              <h3 className="text-base font-semibold mb-1 text-white">
                Aucun refuge dans vos favoris
              </h3>
              <p className="text-xs text-white/60 max-w-sm mb-6 leading-relaxed">
                Cliquez sur l'icône cœur <span className="text-rose-400 font-bold">❤️</span> dans la fiche détaillée de n'importe quel refuge pour l'ajouter ici.
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70 max-w-sm text-left">
                <div className="font-semibold text-rose-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Pas besoin de compte !
                </div>
                Vos coups de cœur sont conservés automatiquement dans le stockage local de votre navigateur. Vous pouvez également les exporter en un clic pour les conserver.
              </div>
            </div>
          ) : filteredFavorites.length === 0 ? (
            <div className="py-12 text-center text-xs text-white/50">
              Aucun refuge ne correspond à votre recherche « {query} ».
            </div>
          ) : (
            filteredFavorites.map((refuge) => {
              const info = typeInfo(refuge.type)
              return (
                <div
                  key={refuge.id}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      onSelectRefuge(refuge)
                      onClose()
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md text-white"
                      style={{ background: info.color }}
                    >
                      <info.Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white group-hover:text-rose-200 transition-colors">
                        {refuge.nom}
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-white/60 mt-0.5">
                        {refuge.alt != null && (
                          <span className="flex items-center gap-1">
                            <Mountain size={12} className="text-white/40" />
                            {refuge.alt} m
                          </span>
                        )}
                        {refuge.places > 0 && (
                          <span className="flex items-center gap-1">
                            <BedDouble size={12} className="text-white/40" />
                            {refuge.places} pl.
                          </span>
                        )}
                        <span className="truncate opacity-75">· {info.label}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onSelectRefuge(refuge)
                        onClose()
                      }}
                      title="Localiser sur la carte"
                      className="glass-btn flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/15"
                    >
                      <Navigation size={15} />
                    </button>
                    <button
                      onClick={() => removeFavorite(refuge.id)}
                      title="Retirer des favoris"
                      className="glass-btn flex h-8 w-8 items-center justify-center rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {favoritesCount > 0 && (
          <footer className="flex items-center justify-between border-t border-white/10 px-6 py-3 bg-black/40 text-xs">
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-rose-400 font-medium">Tout effacer ?</span>
                <button
                  onClick={() => {
                    clearFavorites()
                    setConfirmClear(false)
                  }}
                  className="rounded-lg bg-rose-600 px-2.5 py-1 text-white hover:bg-rose-700"
                >
                  Oui
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-white hover:bg-white/20"
                >
                  Non
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-white/40 hover:text-rose-400 transition-colors"
              >
                Vider la liste
              </button>
            )}

            <button
              onClick={onClose}
              className="glass-btn rounded-xl bg-white/10 px-4 py-1.5 font-medium text-white hover:bg-white/20"
            >
              Fermer
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
