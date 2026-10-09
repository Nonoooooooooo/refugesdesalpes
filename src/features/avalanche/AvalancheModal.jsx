import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  X,
  ShieldAlert,
  Snowflake,
  Wind,
  Mountain,
  RefreshCw,
  ExternalLink,
  Download,
  Clock,
  Info,
  CheckCircle2,
  AlertTriangle,
  Key,
} from 'lucide-react'
import {
  AVALANCHE_RISK,
  fetchAvalancheBulletin,
  getMeteoFrancePdfUrl,
  getActiveToken,
  setActiveToken,
  isJwtHeaderOnly,
  register1605Scheduler,
} from './avalancheService'
import RosePentesSvg from './RosePentesSvg'

export default function AvalancheModal({ massif, point, onClose }) {
  const [loading, setLoading] = useState(true)
  const [bulletin, setBulletin] = useState(null)
  const [notice, setNotice] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const [cachedAt, setCachedAt] = useState(null)
  const [activeTab, setActiveTab] = useState('synthese') // 'synthese' | 'neige' | 'meteo'
  const [showTokenConfig, setShowTokenConfig] = useState(false)
  const [customTokenInput, setCustomTokenInput] = useState('')
  const [tokenSaveSuccess, setTokenSaveSuccess] = useState(false)

  const activeToken = useMemo(() => getActiveToken(), [])
  const headerOnly = useMemo(() => isJwtHeaderOnly(activeToken), [activeToken])

  const loadData = useCallback(
    async (force = false) => {
      if (!massif) return
      setLoading(true)
      try {
        const res = await fetchAvalancheBulletin(massif.id, massif.label, force)
        setBulletin(res.bulletin)
        setIsLive(res.isLive)
        setIsCached(res.isCached)
        setCachedAt(res.cachedAt)
        setNotice(res.notice || null)
      } catch (err) {
        console.error('Erreur chargement BERA :', err)
        setNotice(err.message)
      } finally {
        setLoading(false)
      }
    },
    [massif],
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  // Abonnement au timer automatique de 16h05
  useEffect(() => {
    const unregister = register1605Scheduler(() => {
      console.log('🔄 Rafraîchissement automatique à 16h05...')
      loadData(true)
    })
    return () => unregister()
  }, [loadData])

  // Fermeture avec la touche Échap
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSaveToken(e) {
    e.preventDefault()
    setActiveToken(customTokenInput.trim())
    setTokenSaveSuccess(true)
    setTimeout(() => setTokenSaveSuccess(false), 3000)
    loadData(true)
  }

  const riskInfo = bulletin?.risque ? AVALANCHE_RISK[bulletin.risque.max] || AVALANCHE_RISK[2] : AVALANCHE_RISK[2]
  const riskColor = riskInfo.color

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/90 text-white shadow-2xl backdrop-blur-2xl">
        {/* HEADER DE LA MODALE */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/20"
              style={{ background: riskColor }}
            >
              <ShieldAlert size={22} className="text-white drop-shadow" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold leading-tight truncate">
                  Massif {massif.label}
                </h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/75">
                  BERA #{massif.id}
                </span>
              </div>
              <p className="text-xs text-white/60 truncate">
                {point?.nom ? `Pour : ${point.nom}` : 'Estimation du Risque d\'Avalanche'}
                {point?.alt ? ` (${point.alt} m)` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              title="Rafraîchir les données (Mise à jour à 16h05)"
              className="glass-btn flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 transition-all active:scale-95 text-white/80 hover:text-white"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-sky-400' : ''} />
            </button>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="glass-btn flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 transition-all active:scale-95 text-white/80 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* CONTENU DÉFILABLE */}
        <div className="scroll-thin flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* BANDEAU INDICATEUR 16h05 & STATUT DU BULLETIN */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-sky-400 shrink-0" />
              <span>
                <strong className="text-white">Mise à jour quotidienne Météo-France :</strong>{' '}
                <span className="text-sky-300">16h05 tous les jours</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isLive ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 size={12} /> Direct API Météo-France
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-amber-300 border border-amber-500/30">
                  <Info size={12} /> Référence BERA
                </span>
              )}
              {isCached && (
                <span className="text-white/50 text-[11px]" title={cachedAt ? new Date(cachedAt).toLocaleString('fr-FR') : undefined}>
                  En cache {cachedAt ? `(${new Date(cachedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : ''}
                </span>
              )}
            </div>
          </div>

          {/* BANNIÈRE NOTICE / TOKEN INCOMPLET */}
          {notice && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200/90 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-300">Information Météo-France</p>
                  <p className="text-amber-200/80 leading-relaxed mt-0.5">{notice}</p>
                </div>
              </div>
              {headerOnly && (
                <button
                  onClick={() => setShowTokenConfig(!showTokenConfig)}
                  className="flex items-center gap-1.5 text-amber-300 hover:text-white underline font-medium text-xs ml-6"
                >
                  <Key size={13} />
                  {showTokenConfig ? 'Masquer la configuration du token' : 'Comment configurer mon token complet ?'}
                </button>
              )}
            </div>
          )}

          {/* SECTION CONFIGURATION DU TOKEN (ACCORDÉON) */}
          {showTokenConfig && (
            <div className="rounded-2xl border border-sky-500/30 bg-sky-950/40 p-4 text-xs space-y-3">
              <div className="flex items-center gap-2 text-sky-300 font-semibold text-sm">
                <Key size={16} /> Configuration du Token Météo-France
              </div>
              <p className="text-white/80 leading-relaxed">
                Le token collé initialement ne contenait que l’en-tête (<em>JWT Header</em>). Un token JWT complet
                se compose de 3 parties séparées par des points :{' '}
                <code className="text-sky-300 bg-white/10 px-1 py-0.5 rounded">header.payload.signature</code>.
                Copiez l’intégralité de la clé depuis votre compte Météo-France (<a href="https://portail-api.meteofrance.fr/" target="_blank" rel="noreferrer" className="text-sky-300 underline">portail-api.meteofrance.fr</a>).
              </p>
              <form onSubmit={handleSaveToken} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Collez ici votre token JWT complet..."
                  value={customTokenInput}
                  onChange={(e) => setCustomTokenInput(e.target.value)}
                  className="flex-1 rounded-xl bg-black/40 border border-white/20 px-3 py-2 text-xs text-white placeholder-white/40 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="glass-btn rounded-xl bg-sky-600/80 hover:bg-sky-500 text-white px-4 py-2 font-medium transition-all"
                >
                  Tester & Enregistrer
                </button>
              </form>
              {tokenSaveSuccess && (
                <p className="text-emerald-400 font-medium">✓ Token enregistré ! Rechargement en direct...</p>
              )}
            </div>
          )}

          {/* BLOC PRINCIPAL DU RISQUE AVEC CARTE VISUELLE */}
          {bulletin && (
            <div
              className="relative overflow-hidden rounded-3xl border p-5 sm:p-6 transition-all"
              style={{
                borderColor: `${riskColor}55`,
                background: `linear-gradient(135deg, ${riskInfo.bg} 0%, rgba(15, 23, 42, 0.7) 100%)`,
              }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                    Indice de risque maximal
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: riskColor }}>
                      {bulletin.risque.max} / 5
                    </span>
                    <span className="text-xl sm:text-2xl font-bold text-white">
                      {riskInfo.label}
                    </span>
                  </div>
                  {bulletin.risque.altitudeLimite && (
                    <p className="text-xs text-white/80 font-medium">
                      ⚠️ Risque marqué au-dessus de {bulletin.risque.altitudeLimite} m
                    </p>
                  )}
                </div>

                {/* Évolution J2 (lendemain) */}
                {bulletin.risque.risqueMaxJ2 && (
                  <div className="rounded-2xl border border-white/15 bg-black/40 p-3 text-center sm:text-right shrink-0">
                    <div className="text-[11px] text-white/60">Évolution lendemain (J+1)</div>
                    <div className="flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: AVALANCHE_RISK[bulletin.risque.risqueMaxJ2]?.color || '#eab308',
                        }}
                      />
                      <span className="font-bold text-sm">
                        Indice {bulletin.risque.risqueMaxJ2} ({AVALANCHE_RISK[bulletin.risque.risqueMaxJ2]?.label || 'Stable'})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {bulletin.risque.commentaire && (
                <p className="mt-4 text-xs sm:text-sm text-white/90 border-t border-white/10 pt-3 leading-relaxed">
                  {bulletin.risque.commentaire}
                </p>
              )}
            </div>
          )}

          {/* ONGLETS DE NAVIGATION */}
          <div className="flex border-b border-white/10 gap-2">
            {[
              { id: 'synthese', label: 'Synthèse & Versants' },
              { id: 'neige', label: 'Enneigement & Qualité' },
              { id: 'meteo', label: 'Météo du Massif' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`pb-2.5 text-xs sm:text-sm font-semibold transition-colors relative ${
                  activeTab === t.id ? 'text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* ONGLET 1 : SYNTHÈSE & ROSE DES PENTES */}
          {activeTab === 'synthese' && bulletin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* ROSE DES PENTES */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center justify-center">
                <div className="w-full flex items-center justify-between mb-2">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-white/70">
                    Rose des Pentes à Risque
                  </h3>
                  <span className="text-[11px] text-white/50">Orientations</span>
                </div>
                <RosePentesSvg
                  pentes={bulletin.pentes}
                  altitudeLimite={bulletin.risque.altitudeLimite}
                  riskColor={riskColor}
                />
              </div>

              {/* DANGERS D'AVALANCHES & SITUATIONS TYPIQUES */}
              <div className="space-y-4">
                {/* SITUATIONS AVALANCHEUSES TYPIQUES (SAT) */}
                {bulletin.stabilite.sat?.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-white/70">
                      Situations Avalancheuses Typiques (SAT)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {bulletin.stabilite.sat.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium"
                        >
                          <span>{s.icon}</span>
                          <span>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DÉCLENCHEMENTS PROVOQUÉS */}
                {bulletin.risque.accidentel && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                      <AlertTriangle size={14} /> Déclenchements Randonneurs / Skieurs
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed">
                      {bulletin.risque.accidentel}
                    </p>
                  </div>
                )}

                {/* DÉPARTS SPONTANÉS */}
                {bulletin.risque.naturel && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                      <Mountain size={14} /> Départs Spontanés / Naturels
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed">
                      {bulletin.risque.naturel}
                    </p>
                  </div>
                )}
              </div>

              {/* ANALYSE DÉTAILLÉE DE LA STABILITÉ */}
              {bulletin.stabilite.texte && (
                <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-white/70">
                    Stabilité du manteau neigeux
                  </h3>
                  {bulletin.stabilite.titre && (
                    <p className="text-sm font-semibold text-white">
                      {bulletin.stabilite.titre}
                    </p>
                  )}
                  <p className="whitespace-pre-line text-xs sm:text-sm text-white/80 leading-relaxed">
                    {bulletin.stabilite.texte}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : ENNEIGEMENT & QUALITÉ DE LA NEIGE */}
          {activeTab === 'neige' && bulletin && (
            <div className="space-y-5">
              {/* QUALITÉ DE LA NEIGE */}
              {bulletin.qualite.texte && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-white/70">
                    <Snowflake size={15} className="text-cyan-400" />
                    Qualité & État de la neige
                  </div>
                  <p className="whitespace-pre-line text-xs sm:text-sm text-white/85 leading-relaxed">
                    {bulletin.qualite.texte}
                  </p>
                </div>
              )}

              {/* TABLEAU DES HAUTEURS DE NEIGE PAR ALTITUDE */}
              {bulletin.enneigement.niveaux?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-white/70">
                    Épaisseurs de neige par altitude
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-white/10 text-white/60">
                          <th className="py-2 px-3">Altitude</th>
                          <th className="py-2 px-3">Versant Nord</th>
                          <th className="py-2 px-3">Versant Sud</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {bulletin.enneigement.niveaux.map((n) => (
                          <tr key={n.altitude} className="hover:bg-white/5">
                            <td className="py-2 px-3 font-semibold text-white">{n.altitude} m</td>
                            <td className="py-2 px-3 text-cyan-300 font-medium">{n.nord} cm</td>
                            <td className="py-2 px-3 text-amber-300 font-medium">{n.sud} cm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-2 text-xs text-white/70 border-t border-white/10">
                    {bulletin.enneigement.limiteNord && (
                      <div>
                        Limite d'enneigement Nord :{' '}
                        <strong className="text-white">{bulletin.enneigement.limiteNord} m</strong>
                      </div>
                    )}
                    {bulletin.enneigement.limiteSud && (
                      <div>
                        Limite d'enneigement Sud :{' '}
                        <strong className="text-white">{bulletin.enneigement.limiteSud} m</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NEIGE FRAÎCHE */}
              {bulletin.neigeFraiche.chutes24h?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-white/70">
                    Cumuls de neige fraîche observés (référence {bulletin.neigeFraiche.altitudeRef} m)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {bulletin.neigeFraiche.chutes24h.slice(-4).map((c, i) => (
                      <div key={i} className="rounded-xl bg-white/5 p-3 text-center border border-white/10">
                        <div className="text-[11px] text-white/50">{c.date}</div>
                        <div className="text-lg font-bold text-sky-300 mt-0.5">
                          {c.min === c.max ? `${c.max} cm` : `${c.min}-${c.max} cm`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ONGLET 3 : MÉTÉO MONTAGNE */}
          {activeTab === 'meteo' && bulletin && (
            <div className="space-y-4">
              {bulletin.meteo.commentaire && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                  <div className="text-xs uppercase tracking-wider font-semibold text-white/70">
                    Aperçu météorologique
                  </div>
                  <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
                    {bulletin.meteo.commentaire}
                  </p>
                </div>
              )}

              {bulletin.meteo.echeances?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-white/70 flex items-center gap-2">
                    <Wind size={15} className="text-sky-400" />
                    Vents en altitude & Isotherme 0°C
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {bulletin.meteo.echeances.map((e, idx) => (
                      <div key={idx} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2 text-xs">
                        <div className="font-semibold text-sky-300 border-b border-white/10 pb-1">
                          {e.date.split('T')[1]?.slice(0, 5) || e.date}
                        </div>
                        <div className="flex justify-between text-white/70">
                          <span>Vent à {bulletin.meteo.altitudeVent1} m :</span>
                          <strong className="text-white">
                            {e.ventDir1 || '-'} {e.ventForce1 ? `${e.ventForce1} km/h` : '-'}
                          </strong>
                        </div>
                        <div className="flex justify-between text-white/70">
                          <span>Vent à {bulletin.meteo.altitudeVent2} m :</span>
                          <strong className="text-white">
                            {e.ventDir2 || '-'} {e.ventForce2 ? `${e.ventForce2} km/h` : '-'}
                          </strong>
                        </div>
                        {e.iso0 && (
                          <div className="flex justify-between text-white/70 border-t border-white/5 pt-1">
                            <span>Isotherme 0°C :</span>
                            <strong className="text-cyan-300">{e.iso0} m</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PIED DE LA MODALE AVEC LIENS OFFICIELS */}
        <footer className="border-t border-white/10 bg-slate-900/90 px-5 py-3.5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-white/60">
            Source officielle :{' '}
            <strong className="text-white">Météo-France (DPBRA)</strong> · Validité jusqu'à{' '}
            {bulletin?.dateValidite ? bulletin.dateValidite.replace('T', ' ') : 'demain soir'}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={getMeteoFrancePdfUrl(massif.id)}
              target="_blank"
              rel="noreferrer"
              className="glass-btn flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-all active:scale-95"
            >
              <Download size={13} />
              Bulletin PDF
            </a>
            <a
              href={`https://meteofrance.com/meteo-montagne/alpes-du-nord/bulletin-avalanche/${massif.slug || ''}`}
              target="_blank"
              rel="noreferrer"
              className="glass-btn flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-all active:scale-95"
            >
              Météo-France <ExternalLink size={13} />
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
