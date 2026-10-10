import { useState, useRef, useEffect } from 'react'
import {
  Info,
  X,
  MessageSquare,
  SendHorizontal,
  CheckCircle2,
  AlertTriangle,
  Zap,
  SquareParking,
  Loader2,
  Sparkles,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'

export default function InfoFeedbackButton({ hasSelected }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('info') // 'info' | 'chatbox'
  const [message, setMessage] = useState('')
  const [author, setAuthor] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null) // null | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const closeTimerRef = useRef(null)
  const isPinnedRef = useRef(false)

  // Survol sur grand écran (Desktop)
  const handleMouseEnter = () => {
    // Sur écran tactile / mobile, on ignore le survol
    if (window.matchMedia('(hover: hover)').matches) {
      clearTimeout(closeTimerRef.current)
      setIsOpen(true)
    }
  }

  const handleMouseLeave = () => {
    if (isPinnedRef.current || activeTab === 'chatbox') return
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 250)
  }

  const handleClickToggle = (e) => {
    e.stopPropagation()
    clearTimeout(closeTimerRef.current)
    setIsOpen((prev) => {
      const next = !prev
      isPinnedRef.current = next
      return next
    })
  }

  const handleOpenChatbox = () => {
    isPinnedRef.current = true
    setActiveTab('chatbox')
    setIsOpen(true)
  }

  // Fermeture par clic extérieur
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false)
        isPinnedRef.current = false
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // Envoi simple du message vers l'équipe
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim() || message.trim().length < 3) {
      setErrorMessage('Veuillez renseigner un message d’au moins 3 caractères.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Message Chatbox',
          message: message.trim(),
          author: author.trim() || 'Anonyme',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l’envoi.')
      }

      setSubmitStatus('success')
      setMessage('')
      setAuthor('')
    } catch (err) {
      setSubmitStatus('error')
      setErrorMessage(err.message || 'Impossible de joindre le serveur. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={`fixed bottom-4 sm:bottom-5 z-[1050] transition-all duration-300 ${
        hasSelected ? 'left-3 sm:left-[444px]' : 'left-3 sm:left-4'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ─── BOUTON ROND "i" EN BAS À GAUCHE ─── */}
      <button
        ref={buttonRef}
        onClick={handleClickToggle}
        aria-label="Informations sur le projet et Chatbox"
        title="Informations & Chatbox"
        className={`group relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 shadow-2xl backdrop-blur-xl transition-all duration-300 active:scale-95 ${
          isOpen
            ? 'border-emerald-400 bg-emerald-500/40 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.55)] ring-2 ring-emerald-400/50'
            : 'border-emerald-400/70 bg-slate-900/90 text-emerald-300 hover:border-emerald-400 hover:bg-slate-900 hover:text-white hover:scale-105 shadow-xl ring-1 ring-emerald-400/30'
        }`}
      >
        <Info size={20} strokeWidth={2.4} className="shrink-0" />
        <span className="sr-only">Informations</span>

        {/* Halo discret d'invitation */}
        <span className="absolute -inset-1 -z-10 rounded-full bg-emerald-400/25 blur-[4px] opacity-80 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* ─── BULLE D'INFORMATION / CHATBOX (ERGONOMIQUE MOBILE & DESKTOP) ─── */}
      {isOpen && (
        <>
          {/* Overlay sombre sur téléphone pour une fermeture facile au clic en dehors */}
          <div
            className="fixed inset-0 -z-10 bg-black/60 backdrop-blur-[2px] sm:hidden"
            onClick={() => {
              setIsOpen(false)
              isPinnedRef.current = false
            }}
          />

          <div
            ref={popoverRef}
            className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:absolute sm:bottom-14 sm:left-0 z-[1200] w-auto sm:w-[410px] max-w-[440px] rounded-3xl border border-white/20 bg-slate-900/95 p-4 sm:p-5 shadow-2xl backdrop-blur-2xl text-white transition-all animate-in fade-in zoom-in-95 duration-200 max-h-[82vh] overflow-y-auto scroll-thin"
          >
            {/* Header avec onglets & bouton fermeture */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3.5">
              <div className="flex items-center gap-1.5 rounded-xl bg-black/40 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('info')
                    setSubmitStatus(null)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    activeTab === 'info'
                      ? 'bg-white/20 text-white font-semibold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Info size={14} />
                  <span>Projet</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    isPinnedRef.current = true
                    setActiveTab('chatbox')
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    activeTab === 'chatbox'
                      ? 'bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 font-semibold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <MessageSquare size={14} />
                  <span>Chatbox</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  isPinnedRef.current = false
                }}
                className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* ─── ONGLET 1 : TEXTE DU PROJET (AVEC MISE EN AVANT DU "ON COMPTE SUR VOUS") ─── */}
            {activeTab === 'info' && (
              <div className="space-y-3.5 text-xs sm:text-[13px] leading-relaxed">
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                    Le site est en développement continu
                  </h3>

                  {/* 🌟 ENCART MIS EN AVANT : "ON COMPTE SUR VOUS !" 🌟 */}
                  <div className="rounded-2xl border-2 border-emerald-400/50 bg-gradient-to-br from-emerald-500/25 via-emerald-600/20 to-teal-500/15 p-4 text-center shadow-lg">
                    <span className="text-base sm:text-lg font-black tracking-tight text-emerald-200 uppercase flex items-center justify-center gap-2">
                      <span>🤝</span>
                      <span>On compte sur vous !</span>
                    </span>
                    <p className="mt-1.5 text-xs sm:text-[13px] text-white/95 leading-relaxed font-medium">
                      Si vous observez des données erronées, faites-les nous parvenir via la{' '}
                      <button
                        type="button"
                        onClick={handleOpenChatbox}
                        className="font-bold text-emerald-300 underline underline-offset-2 hover:text-emerald-100 transition-colors"
                      >
                        chatbox
                      </button>{' '}
                      pour nous permettre d’améliorer le site.
                    </p>
                  </div>
                </div>

                {/* Quelques informations utiles */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2.5">
                  <h4 className="font-semibold text-white/90 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-300" />
                    Quelques informations :
                  </h4>

                  <div className="flex items-start gap-2 text-white/80">
                    <Zap size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>
                      Pour améliorer la fluidité du site, nous vous suggérons d’activer uniquement les options dont vous avez besoin
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-white/80">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                    <span>
                      Ne vous fiez pas uniquement à nos informations, nous ne garantissons pas la véracité de toutes celles-ci (ex : les numéros de ligne de transports)
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-white/80">
                    <SquareParking size={14} className="mt-0.5 shrink-0 text-sky-400" />
                    <span>
                      Les parkings sont visibles mais demandent beaucoup de ressources, nous vous conseillons de zoomer suffisamment sur la zone qui vous intéresse avant d’activer l’option
                    </span>
                  </div>
                </div>

                {/* Bouton d'action proéminent vers la chatbox */}
                <button
                  type="button"
                  onClick={handleOpenChatbox}
                  className="w-full flex items-center justify-between rounded-2xl border border-emerald-400/50 bg-gradient-to-r from-emerald-500/30 to-teal-500/25 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-200 hover:from-emerald-500/40 hover:to-teal-500/35 hover:border-emerald-400/80 shadow-lg transition-all active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare size={16} />
                    <span>Ouvrir la Chatbox / Laisser un mot</span>
                  </span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ─── ONGLET 2 : CHATBOX SIMPLIFIÉE (SANS CATÉGORIES, SANS MENTION DISCORD) ─── */}
            {activeTab === 'chatbox' && (
              <div>
                {submitStatus === 'success' ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                      <CheckCircle2 size={26} />
                    </div>
                    <h4 className="text-base font-bold text-white">Message bien envoyé !</h4>
                    <p className="text-xs text-white/80 max-w-xs">
                      Votre retour a bien été transmis à l’équipe. Merci beaucoup pour votre aide !
                    </p>
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitStatus(null)
                          setActiveTab('info')
                        }}
                        className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-all"
                      >
                        Retour aux infos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubmitStatus(null)}
                        className="rounded-xl border border-emerald-400/40 bg-emerald-500/25 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/35 transition-all"
                      >
                        Nouveau message
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
                      >
                        <ArrowLeft size={13} />
                        <span>Retour</span>
                      </button>
                      <span className="text-[11px] text-emerald-300/80 font-medium">
                        Transmis directement à l’équipe
                      </span>
                    </div>

                    {/* Zone de texte du message (simple et spacieuse) */}
                    <div>
                      <label
                        htmlFor="chatbox-message"
                        className="block text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-1"
                      >
                        Votre message *
                      </label>
                      <textarea
                        id="chatbox-message"
                        rows={4}
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Décrivez une donnée erronée, une suggestion, ou laissez simplement un mot à l'équipe..."
                        className="w-full rounded-2xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all resize-none"
                      />
                    </div>

                    {/* Champ prénom ou contact facultatif */}
                    <div>
                      <label
                        htmlFor="chatbox-author"
                        className="block text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-1"
                      >
                        Prénom ou pseudo <span className="text-white/40 font-normal">(facultatif)</span>
                      </label>
                      <input
                        id="chatbox-author"
                        type="text"
                        maxLength={50}
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="Ex: Marc de Chamonix"
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all"
                      />
                    </div>

                    {/* Message d'erreur éventuel */}
                    {errorMessage && (
                      <div className="rounded-xl border border-red-400/40 bg-red-500/20 p-2 text-xs text-red-200 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {/* Bouton d'envoi clair et direct */}
                    <button
                      type="submit"
                      disabled={isSubmitting || message.trim().length < 3}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-500/40 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-100 hover:bg-emerald-500/50 hover:border-emerald-400/90 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Envoi en cours…</span>
                        </>
                      ) : (
                        <>
                          <SendHorizontal size={16} />
                          <span>Envoyer le message</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
