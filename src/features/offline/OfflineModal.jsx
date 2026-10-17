import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Download,
  Trash2,
  HardDrive,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
  MapPin,
  Layers,
  Wifi,
  WifiOff,
  Share2,
  PlusSquare,
  Compass,
  Sparkles,
  Info,
} from 'lucide-react'
import {
  calculateZoneTiles,
  downloadZone,
  getSavedZones,
  deleteZone,
  getStorageInfo,
} from './offlineService'

export default function OfflineModal({
  isOpen,
  onClose,
  mapBounds,
  mapCenter,
  onFlyToZone,
  isOnline,
  isInstalled,
  isIos,
  installPromptReady,
  onPromptInstall,
}) {
  const [activeTab, setActiveTab] = useState('download') // 'download' | 'zones' | 'pwa'
  const [zoneName, setZoneName] = useState('')
  const [layer, setLayer] = useState('ign') // 'ign' | 'opentopo'
  const [detailLevel, setDetailLevel] = useState('ultra') // 'ultra' (11-16) | 'topo' (11-15) | 'standard' (10-13)
  const [savedZones, setSavedZones] = useState([])
  const [storage, setStorage] = useState(null)

  // État du téléchargement
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [downloadSuccess, setDownloadSuccess] = useState(null)
  const [downloadError, setDownloadError] = useState(null)
  const abortControllerRef = useRef(null)

  // Chargement des zones et du stockage
  const refreshZones = () => {
    setSavedZones(getSavedZones())
    getStorageInfo().then(setStorage)
  }

  useEffect(() => {
    if (isOpen) {
      refreshZones()
      setDownloadSuccess(null)
      setDownloadError(null)
      if (mapCenter) {
        setZoneName(
          `Massif Alpin (${mapCenter.lat.toFixed(2)}°N, ${mapCenter.lng.toFixed(2)}°E)`,
        )
      } else {
        setZoneName(`Zone Rando (${new Date().toLocaleDateString('fr-FR')})`)
      }
    }
  }, [isOpen, mapCenter])

  // Bornes actuelles de la carte
  const currentBbox = useMemo(() => {
    if (!mapBounds) return [5.8, 44.8, 7.2, 46.2] // Par défaut Alpes
    return [
      mapBounds.getWest(),
      mapBounds.getSouth(),
      mapBounds.getEast(),
      mapBounds.getNorth(),
    ]
  }, [mapBounds])

  // Configuration des niveaux de précision
  const zoomConfig = useMemo(() => {
    switch (detailLevel) {
      case 'standard':
        return {
          minZoom: 10,
          maxZoom: 13,
          title: 'Standard (Aperçu)',
          scale: '1:50 000',
          badge: 'Léger & Rapide',
        }
      case 'topo':
        return {
          minZoom: 11,
          maxZoom: 15,
          title: 'Randonnée TOP 25',
          scale: '1:25 000',
          badge: 'IGN TOP 25',
        }
      case 'ultra':
      default:
        return {
          minZoom: 11,
          maxZoom: 16,
          title: 'Haute Précision',
          scale: '1:12 500',
          badge: 'Identique au Wifi',
        }
    }
  }, [detailLevel])

  const minZoom = zoomConfig.minZoom
  const maxZoom = zoomConfig.maxZoom

  // Estimation dynamique en direct selon l'emprise et le niveau de zoom
  const estimation = useMemo(() => {
    return calculateZoneTiles(currentBbox, minZoom, maxZoom)
  }, [currentBbox, minZoom, maxZoom])

  const isTooLarge = estimation.totalTiles > 6000

  // Lancement du téléchargement
  const handleStartDownload = async () => {
    setDownloading(true)
    setProgress({ percent: 0, downloaded: 0, total: estimation.totalTiles, mb: '0.0' })
    setDownloadError(null)
    setDownloadSuccess(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const result = await downloadZone({
        name: zoneName.trim() || 'Zone Hors-ligne',
        bbox: currentBbox,
        layer,
        minZoom,
        maxZoom,
        onProgress: setProgress,
        signal: controller.signal,
      })

      setDownloadSuccess(result)
      refreshZones()
    } catch (err) {
      if (controller.signal.aborted) {
        setDownloadError('Téléchargement interrompu.')
      } else {
        setDownloadError(err.message || 'Erreur pendant le téléchargement des tuiles.')
      }
    } finally {
      setDownloading(false)
      abortControllerRef.current = null
    }
  }

  const handleCancelDownload = () => {
    abortControllerRef.current?.abort()
    setDownloading(false)
  }

  const handleDeleteZone = async (id, e) => {
    e.stopPropagation()
    if (window.confirm('Voulez-vous supprimer cette zone et libérer l’espace de stockage ?')) {
      await deleteZone(id)
      refreshZones()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop sombre */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={() => !downloading && onClose()}
      />

      {/* Conteneur Modale */}
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-white/10 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-2xl overflow-hidden">
        {/* Header feutré */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/25 text-amber-300">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Mode Hors-Ligne & Application
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {isOnline ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Wifi size={12} /> Réseau connecté
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-300 font-medium">
                    <WifiOff size={12} /> Mode autonome hors-ligne
                  </span>
                )}
                {storage?.usageMb && (
                  <>
                    <span>·</span>
                    <span>{storage.usageMb} Mo stockés</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => !downloading && onClose()}
            disabled={downloading}
            className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition disabled:opacity-40"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Onglets sobres */}
        <div className="flex border-b border-white/10 bg-slate-950/40 px-4 pt-2">
          <button
            onClick={() => setActiveTab('download')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition ${
              activeTab === 'download'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download size={15} />
            <span>Télécharger une zone</span>
          </button>

          <button
            onClick={() => setActiveTab('zones')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition ${
              activeTab === 'zones'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers size={15} />
            <span>Mes zones ({savedZones.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition ${
              activeTab === 'pwa'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone size={15} />
            <span>Installer l’app</span>
            {isInstalled && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                Installée
              </span>
            )}
          </button>
        </div>

        {/* Contenu déroulant */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* ─── ONGLET 1 : TÉLÉCHARGER UNE ZONE ─── */}
          {activeTab === 'download' && (
            <div className="space-y-4.5">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-200/90 leading-relaxed">
                <span className="font-semibold text-amber-300">💡 Fonctionnement hors-ligne :</span>{' '}
                Les tuiles cartographiques de l'emprise visible et l'ensemble des refuges et cabanes sont enregistrés directement dans la mémoire de votre téléphone. Vous pourrez naviguer sur la carte en pleine montagne même en mode avion.
              </div>

              {/* Nom de la zone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Nom du massif / de la zone
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    disabled={downloading}
                    placeholder="Ex: Tour du Mont-Blanc, Belledonne Sud..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/60 transition disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Choix du calque */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Fond cartographique à stocker
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLayer('ign')}
                    disabled={downloading}
                    className={`flex flex-col text-left rounded-2xl border p-3 transition ${
                      layer === 'ign'
                        ? 'border-amber-400/60 bg-amber-400/10 text-white'
                        : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <span className="font-semibold text-xs sm:text-sm text-slate-200">IGN Géoplateforme</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Topographie officielle française, sentiers GR/PR et courbes de niveau
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayer('opentopo')}
                    disabled={downloading}
                    className={`flex flex-col text-left rounded-2xl border p-3 transition ${
                      layer === 'opentopo'
                        ? 'border-amber-400/60 bg-amber-400/10 text-white'
                        : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <span className="font-semibold text-xs sm:text-sm text-slate-200">OpenTopoMap</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Cartographie topo alpine avec ombrage de relief marqué
                    </span>
                  </button>
                </div>
              </div>

              {/* Choix du niveau de détail & zoom */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Niveau de précision & Zoom
                  </label>
                  <span className="text-[11px] text-amber-300 font-medium">
                    Zoom max : {maxZoom} ({zoomConfig.scale})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Niveau 1 : Haute Précision (Identique au Wifi) */}
                  <button
                    type="button"
                    onClick={() => setDetailLevel('ultra')}
                    disabled={downloading}
                    className={`rounded-2xl border p-3 text-left transition flex flex-col justify-between ${
                      detailLevel === 'ultra'
                        ? 'border-amber-400 bg-amber-400/15 text-white ring-1 ring-amber-400/60 shadow-lg'
                        : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-1">
                          <Sparkles size={13} className="text-amber-400" /> Haute Précision
                        </span>
                        <span className="rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 uppercase shrink-0">
                          Comme Wifi
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-tight">
                        <strong>Zooms 11 à 16 (1:12 500)</strong>. Même netteté qu'en ligne : chaque sentier, pierrier, rocher et abords de refuge au mètre près.
                      </p>
                    </div>
                  </button>

                  {/* Niveau 2 : Randonnée TOP 25 */}
                  <button
                    type="button"
                    onClick={() => setDetailLevel('topo')}
                    disabled={downloading}
                    className={`rounded-2xl border p-3 text-left transition flex flex-col justify-between ${
                      detailLevel === 'topo'
                        ? 'border-amber-400 bg-amber-400/15 text-white ring-1 ring-amber-400/60 shadow-lg'
                        : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs sm:text-sm font-semibold text-slate-100">Rando TOP 25</span>
                        <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 uppercase shrink-0">
                          1:25 000
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        <strong>Zooms 11 à 15 (1:25 000)</strong>. Carte IGN topo classique de randonnée avec courbes de niveau et sentiers balisés.
                      </p>
                    </div>
                  </button>

                  {/* Niveau 3 : Standard Aperçu */}
                  <button
                    type="button"
                    onClick={() => setDetailLevel('standard')}
                    disabled={downloading}
                    className={`rounded-2xl border p-3 text-left transition flex flex-col justify-between ${
                      detailLevel === 'standard'
                        ? 'border-amber-400 bg-amber-400/15 text-white ring-1 ring-amber-400/60 shadow-lg'
                        : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs sm:text-sm font-semibold text-slate-100">Standard</span>
                        <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 uppercase shrink-0">
                          Aperçu
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        <strong>Zooms 10 à 13</strong>. Repérage d'ensemble d'un grand massif à très faible volume de données.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Récapitulatif d'estimation */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Emprise visible ciblée :</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {currentBbox[1].toFixed(2)}°N, {currentBbox[0].toFixed(2)}°E ➔ {currentBbox[3].toFixed(2)}°N, {currentBbox[2].toFixed(2)}°E
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Nombre de tuiles estimé :</span>
                  <span className="font-semibold text-slate-200">{estimation.totalTiles} tuiles</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Espace mémoire estimé :</span>
                  <span className="font-semibold text-amber-300">~{estimation.estimatedSizeMb} Mo</span>
                </div>
              </div>

              {/* Alerte si la zone est trop vaste pour ce zoom */}
              {isTooLarge && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-1 animate-in fade-in">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertCircle size={15} /> Zone trop vaste pour la Haute Précision ({estimation.totalTiles} tuiles)
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Pour télécharger avec le niveau de zoom maximal (Zoom 16, identique au Wifi), fermez cette modale, <strong>zoomez sur votre secteur de rando ou votre vallée sur la carte</strong>, puis réouvrez « Enregistrer ». Cela réduira le nombre de tuiles et assurera un enregistrement rapide.
                  </p>
                </div>
              )}

              {/* État de téléchargement / Barre de progression */}
              {downloading && progress && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                    <span>Téléchargement des tuiles IGN en cours...</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {progress.downloaded} / {progress.total} tuiles (Zoom {progress.currentZoom})
                    </span>
                    <span>{progress.mb} Mo transférés</span>
                  </div>
                </div>
              )}

              {/* Message de succès */}
              {downloadSuccess && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3 text-xs text-emerald-200 animate-in fade-in">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-300 block mb-0.5">
                      Zone « {downloadSuccess.name} » enregistrée avec succès !
                    </span>
                    <span>
                      {downloadSuccess.tileCount} tuiles stockées ({downloadSuccess.sizeMb} Mo, jusqu'au zoom {downloadSuccess.maxZoom}) avec {downloadSuccess.refugesCount} refuges et cabanes inclus. Vous pouvez maintenant naviguer en montagne sans réseau.
                    </span>
                  </div>
                </div>
              )}

              {/* Message d'erreur */}
              {downloadError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3 text-xs text-red-200 animate-in fade-in">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-red-300 block mb-0.5">Avertissement</span>
                    <span>{downloadError}</span>
                  </div>
                </div>
              )}

              {/* Bouton d'action */}
              <div className="pt-2 flex items-center gap-3">
                {downloading ? (
                  <button
                    type="button"
                    onClick={handleCancelDownload}
                    className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition"
                  >
                    Arrêter le téléchargement
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartDownload}
                    disabled={isTooLarge}
                    className="w-full rounded-2xl border border-amber-400/40 bg-amber-400/15 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/25 hover:text-amber-100 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={16} />
                    <span>
                      {isTooLarge
                        ? 'Zone trop large · Zoomez d’abord sur la carte'
                        : `Télécharger la zone (${estimation.totalTiles} tuiles · ~${estimation.estimatedSizeMb} Mo)`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── ONGLET 2 : MES ZONES HORS-LIGNE ─── */}
          {activeTab === 'zones' && (
            <div className="space-y-3.5">
              {savedZones.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-800 text-slate-500">
                    <Layers size={26} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300">Aucune zone hors-ligne enregistrée</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Naviguez sur la carte jusqu’au massif de votre choix, puis utilisez l’onglet « Télécharger une zone » pour le conserver sur votre téléphone.
                  </p>
                  <button
                    onClick={() => setActiveTab('download')}
                    className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 transition"
                  >
                    Télécharger ma première zone
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="text-xs text-slate-400 flex items-center justify-between pb-1">
                    <span>{savedZones.length} zone(s) enregistrée(s) en mémoire</span>
                    <span>
                      Total :{' '}
                      {(
                        savedZones.reduce((acc, z) => acc + (parseFloat(z.sizeMb) || 0), 0)
                      ).toFixed(1)}{' '}
                      Mo
                    </span>
                  </div>

                  {savedZones.map((z) => (
                    <div
                      key={z.id}
                      onClick={() => {
                        if (onFlyToZone && z.bbox) {
                          onFlyToZone(z.bbox)
                          onClose()
                        }
                      }}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-800/40 p-3.5 hover:border-amber-400/40 hover:bg-slate-800/70 transition cursor-pointer"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-200 truncate">
                            {z.name}
                          </span>
                          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 shrink-0">
                            {z.layer === 'ign' ? 'IGN' : 'OpenTopo'} · Zoom {z.maxZoom || 13}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{new Date(z.date).toLocaleDateString('fr-FR')}</span>
                          <span>·</span>
                          <span>{z.tileCount} tuiles</span>
                          <span>·</span>
                          <span className="text-amber-300 font-medium">{z.sizeMb} Mo</span>
                          {z.refugesCount > 0 && (
                            <>
                              <span>·</span>
                              <span>{z.refugesCount} refuges</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteZone(z.id, e)}
                          className="rounded-xl p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-300 transition"
                          title="Supprimer cette zone et libérer l’espace"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── ONGLET 3 : INSTALLER L’APPLICATION (PWA) ─── */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-300 shrink-0">
                  <Smartphone size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Application mobile autonome (PWA)</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Installez Refuges des Alpes sur l'écran d'accueil de votre téléphone. L’app démarre en plein écran et fonctionne de manière 100% autonome, même sans réseau en pleine montagne.
                  </p>
                </div>
              </div>

              {/* Réponse claire à la question des fichiers du téléphone */}
              <div className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-4 space-y-1.5 text-xs text-blue-200">
                <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                  <Info size={15} /> Pourquoi l'application ne s'ouvre pas depuis « Mes Fichiers » ?
                </div>
                <p className="text-[11px] text-blue-200/80 leading-relaxed">
                  Sur smartphone (iOS et Android), les navigateurs interdisent aux simples fichiers téléchargés d'accéder au stockage des tuiles et aux cartes interactives pour des raisons de sécurité.
                  <strong> C'est pour cela qu'il faut utiliser l'option « Sur l'écran d'accueil » ci-dessous</strong> : votre téléphone l'enregistre alors comme une véritable application autonome capable de démarrer sans réseau.
                </p>
              </div>

              {/* Si déjà installée */}
              {isInstalled ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3 text-xs text-emerald-200">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <span>
                    L'application est installée sur cet appareil et prête pour une utilisation hors-ligne autonome.
                  </span>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Android / Chrome prompt direct */}
                  {installPromptReady && (
                    <button
                      type="button"
                      onClick={onPromptInstall}
                      className="w-full rounded-2xl border border-amber-400/50 bg-amber-400/20 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/30 transition shadow-lg flex items-center justify-center gap-2"
                    >
                      <Download size={16} />
                      <span>Ajouter à l’écran d’accueil en 1 clic</span>
                    </button>
                  )}

                  {/* Guide pas-à-pas pour iOS (Safari) */}
                  {isIos && (
                    <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-4 space-y-3 text-xs text-slate-300">
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <Share2 size={14} /> Sur iPhone / iPad (Safari) :
                      </div>
                      <ol className="space-y-2 pl-4 list-decimal text-slate-300 text-xs">
                        <li>
                          Appuyez sur le bouton de <strong>Partage</strong>{' '}
                          <span className="inline-block px-1 rounded bg-slate-700 font-mono text-[11px]">
                            ⎋
                          </span>{' '}
                          dans la barre d’outils de Safari en bas de l'écran.
                        </li>
                        <li>
                          Faites défiler vers le bas et sélectionnez{' '}
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-200">
                            <PlusSquare size={13} /> « Sur l’écran d’accueil »
                          </span>
                          .
                        </li>
                        <li>
                          Appuyez sur <strong>« Ajouter »</strong> en haut à droite. L'icône apparaîtra avec vos autres applications.
                        </li>
                      </ol>
                    </div>
                  )}

                  {/* Android manuel */}
                  {!installPromptReady && !isIos && (
                    <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-4 space-y-2 text-xs text-slate-300">
                      <div className="font-semibold text-amber-300">Sur Android / Chrome :</div>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        Ouvrez le menu Chrome (trois petits points verticaux en haut à droite) et appuyez sur <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Avantages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <Compass size={14} className="text-amber-400" /> Vrai plein écran
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Plus de barres d'adresse encombrantes, carte optimisée pour le terrain.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <WifiOff size={14} className="text-amber-400" /> 100% Hors-ligne
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Démarre immédiatement au fond des vallées blanches sans aucun signal.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer feutré */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/60 px-6 py-3.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Stockage local sécurisé</span>
          </div>

          <button
            onClick={() => !downloading && onClose()}
            className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
