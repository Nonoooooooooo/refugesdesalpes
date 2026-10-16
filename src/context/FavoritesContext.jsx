import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

const FAVORITES_STORAGE_KEY = 'refuge2_favorites_v1'

const FavoritesContext = createContext(null)

function loadInitialFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === 'object' && item.id != null)
    }
  } catch (err) {
    console.error('Erreur lors du chargement des favoris :', err)
  }
  return []
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des favoris :', err)
  }
}

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(loadInitialFavorites)
  const [toastMessage, setToastMessage] = useState(null)

  // Synchronisation avec les autres onglets ou modifications directes du storage
  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key === FAVORITES_STORAGE_KEY) {
        setFavorites(loadInitialFavorites())
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Sauvegarde dans localStorage à chaque mise à jour
  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  // Toast temporaire
  const showToast = useCallback((msg) => {
    setToastMessage(msg)
    const timer = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [])

  const favoritesMap = useMemo(() => {
    const map = new Map()
    favorites.forEach((fav) => {
      map.set(String(fav.id), fav)
    })
    return map
  }, [favorites])

  const isFavorite = useCallback(
    (id) => {
      if (id == null) return false
      return favoritesMap.has(String(id))
    },
    [favoritesMap],
  )

  const addFavorite = useCallback((refuge) => {
    if (!refuge || refuge.id == null) return
    setFavorites((prev) => {
      if (prev.some((f) => String(f.id) === String(refuge.id))) return prev
      const item = {
        id: refuge.id,
        nom: refuge.nom || 'Refuge sans nom',
        type: refuge.type || 'autre',
        alt: refuge.alt ?? null,
        lat: refuge.lat,
        lng: refuge.lng,
        places: refuge.places ?? null,
        etat: refuge.etat ?? null,
        addedAt: Date.now(),
      }
      return [item, ...prev]
    })
    showToast(`« ${refuge.nom} » ajouté à vos favoris ❤️`)
  }, [showToast])

  const removeFavorite = useCallback((id) => {
    if (id == null) return
    setFavorites((prev) => {
      const removed = prev.find((f) => String(f.id) === String(id))
      const next = prev.filter((f) => String(f.id) !== String(id))
      if (removed) {
        showToast(`« ${removed.nom} » retiré des favoris`)
      }
      return next
    })
  }, [showToast])

  const toggleFavorite = useCallback(
    (refuge) => {
      if (!refuge || refuge.id == null) return false
      if (isFavorite(refuge.id)) {
        removeFavorite(refuge.id)
        return false
      } else {
        addFavorite(refuge)
        return true
      }
    },
    [isFavorite, addFavorite, removeFavorite],
  )

  const clearFavorites = useCallback(() => {
    setFavorites([])
    showToast('Tous les favoris ont été effacés')
  }, [showToast])

  const exportFavorites = useCallback(() => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(favorites, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `refuges_favoris_${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      showToast('Exportation des favoris réussie 📥')
    } catch (e) {
      console.error(e)
      showToast("Erreur lors de l'export des favoris")
    }
  }, [favorites, showToast])

  const importFavorites = useCallback((newItems) => {
    if (!Array.isArray(newItems)) return false
    const valid = newItems.filter((item) => item && typeof item === 'object' && item.id != null && item.lat && item.lng)
    if (valid.length === 0) {
      showToast('Fichier JSON invalide ou aucun refuge détecté')
      return false
    }

    setFavorites((prev) => {
      const map = new Map(prev.map((f) => [String(f.id), f]))
      valid.forEach((item) => {
        map.set(String(item.id), {
          ...item,
          addedAt: item.addedAt || Date.now(),
        })
      })
      return Array.from(map.values()).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    })

    showToast(`${valid.length} refuge(s) importé(s) avec succès ! ⭐`)
    return true
  }, [showToast])

  const value = useMemo(
    () => ({
      favorites,
      favoritesCount: favorites.length,
      favoritesMap,
      isFavorite,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      clearFavorites,
      exportFavorites,
      importFavorites,
      toastMessage,
    }),
    [
      favorites,
      favoritesMap,
      isFavorite,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      clearFavorites,
      exportFavorites,
      importFavorites,
      toastMessage,
    ],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) {
    throw new Error('useFavorites must be used within a FavoritesProvider')
  }
  return ctx
}
