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

const CATEGORIES = [
  { id: 'Donnée erronée', label: '⚠️ Donnée erronée', color: 'border-amber-400/50 bg-amber-500/20 text-amber-200' },
  { id: 'Suggestion', label: '💡 Suggestion', color: 'border-purple-400/50 bg-purple-500/20 text-purple-200' },
  { id: 'Encouragement', label: '❤️ Encouragement', color: 'border-pink-400/50 bg-pink-500/20 text-pink-200' },
  { id: 'Autre', label: '🏔️ Autre', color: 'border-sky-400/50 bg-sky-500/20 text-sky-200' },
]

export default function InfoFeedbackButton({ placement = 'top-bar' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('info') // 'info' | 'chatbox'
  const [selectedCategory, setSelectedCategory] = useState('Donnée erronée')
  const [message, setMessage] = useState('')
  const [author, setAuthor] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null) // null | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const closeTimerRef = useRef(null)
  const isPinnedRef = useRef(false)

  // Gestion du survol avec délai de tolérance (Desktop)
  const handleMouseEnter = () => {
    clearTimeout(closeTimerRef.current)
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    if (isPinnedRef.current || activeTab === 'chatbox') return
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 280)
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

  // Envoi du formulaire vers /api/feedback (Discord Webhook)
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
          category: selectedCategory,
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

  const isTopBar = placement === 'top-bar'

  return (
    <div
      className={
        isTopBar
          ? 'relative inline-flex items-center pointer-events-auto'
          : 'fixed bottom-5 left-4 z-[1050] pointer-events-auto'
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ─── BOUTON ROND "i" ─── */}
      <button
        ref={buttonRef}
        onClick={handleClickToggle}
        aria-label="Informations sur le projet et Chatbox Discord"
        title="Informations sur le projet & Chatbox Discord"
        className={`group relative flex items-center justify-center rounded-full border shadow-md backdrop-blur-xl transition-all duration-300 active:scale-95 ${
          isTopBar
            ? 'h-7 w-7 sm:h-8 sm:w-8'
            : 'h-9 w-9 sm:h-10 sm:w-10 shadow-xl'
        } ${
          isOpen
            ? 'border-emerald-400 bg-emerald-500/40 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.5)] ring-1 ring-emerald-400/60'
            : 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/35 hover:text-white'
        }`}
      >
        <Info size={isTopBar ? 15 : 18} strokeWidth={2.5} className="shrink-0" />
        <span className="sr-only">Informations & Chatbox</span>

        {/* Halo discret d'invitation */}
        <span className="absolute -inset-0.5 -z-10 rounded-full bg-emerald-400/25 blur-[3px] opacity-70 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* ─── BULLE D'INFORMATION / CHATBOX (POPOVER) ─── */}
      {isOpen && (
        <>
          {/* Overlay sombre mobile */}
          <div
            className="fixed inset-0 -z-10 bg-black/50 backdrop-blur-[2px] sm:hidden"
            onClick={() => {
              setIsOpen(false)
              isPinnedRef.current = false
            }}
          />

          <div
            ref={popoverRef}
            className={`fixed sm:absolute z-[1200] w-[calc(100vw-1.5rem)] sm:w-[410px] max-w-[440px] rounded-3xl border border-white/20 bg-slate-900/95 p-4 sm:p-5 shadow-2xl backdrop-blur-2xl text-white transition-all animate-in fade-in zoom-in-95 duration-200 max-h-[82vh] overflow-y-auto scroll-thin ${
              isTopBar
                ? 'top-14 right-3 sm:top-11 sm:right-0 sm:left-auto'
                : 'bottom-13 left-3 sm:bottom-13 sm:left-0'
            }`}
          >
            {/* Header avec onglets & fermeture */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-1.5 rounded-xl bg-black/40 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('info')
                    setSubmitStatus(null)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    activeTab === 'info'
                      ? 'bg-white/20 text-white font-semibold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Info size={13} />
                  <span>Projet</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    isPinnedRef.current = true
                    setActiveTab('chatbox')
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    activeTab === 'chatbox'
                      ? 'bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 font-semibold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>Chatbox Discord</span>
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
                <X size={16} />
              </button>
            </div>

            {/* ─── ONGLET 1 : TEXTE DU PROJET (Issu du PDF) ─── */}
            {activeTab === 'info' && (
              <div className="space-y-3.5 text-xs sm:text-[13px] leading-relaxed">
                <div>
                  <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold text-emerald-300">
                    <span>🏔️</span>
                    <span>Le site est en développement continu</span>
                  </h3>
                  <p className="mt-1.5 text-white/80">
                    Alors on compte sur vous ! Si vous observez des données erronées, faites-les nous
                    parvenir via la{' '}
                    <button
                      type="button"
                      onClick={handleOpenChatbox}
                      className="inline-flex items-center gap-0.5 font-semibold text-emerald-300 underline decoration-emerald-400/60 underline-offset-2 hover:text-emerald-200 hover:decoration-emerald-300 transition-colors"
                    >
                      chatbox
                      <ChevronRight size={13} className="inline" />
                    </button>{' '}
                    pour nous permettre d’améliorer cela.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-3.5 space-y-2.5">
                  <h4 className="font-semibold text-white/90 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-300" />
                    Quelques informations :
                  </h4>

                  <div className="flex items-start gap-2 text-white/75">
                    <Zap size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>
                      Pour améliorer la fluidité du site, nous vous suggérons d’activer uniquement les options dont vous avez besoin
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-white/75">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                    <span>
                      Ne vous fiez pas uniquement à nos informations, nous ne garantissons pas la véracité de toutes celles-ci (ex : les numéros de ligne de transports)
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-white/75">
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
                  className="w-full flex items-center justify-between rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/25 to-teal-500/20 px-3.5 py-2.5 text-xs font-semibold text-emerald-200 hover:from-emerald-500/35 hover:to-teal-500/30 hover:border-emerald-400/70 shadow-lg transition-all active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare size={15} />
                    <span>Un avis ou une erreur ? Ouvrir la Chatbox</span>
                  </span>
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            {/* ─── ONGLET 2 : CHATBOX DISCORD INTERACTIVE ─── */}
            {activeTab === 'chatbox' && (
              <div>
                {submitStatus === 'success' ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                      <CheckCircle2 size={26} />
                    </div>
                    <h4 className="text-base font-bold text-white">Message bien envoyé !</h4>
                    <p className="text-xs text-white/75 max-w-xs">
                      Votre retour a été retransmis directement à l’équipe sur Discord. Merci pour votre précieuse contribution !
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
                  <form onSubmit={handleSubmit} className="space-y-3">
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
                        Transmis en direct sur Discord
                      </span>
                    </div>

                    {/* Sélection de catégorie */}
                    <div>
                      <label className="block text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                        Type de message
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-all ${
                              selectedCategory === cat.id
                                ? `${cat.color} font-semibold ring-1 ring-white/40 shadow-sm`
                                : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Zone de texte */}
                    <div>
                      <label
                        htmlFor="chatbox-message"
                        className="block text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-1"
                      >
                        Votre message *
                      </label>
                      <textarea
                        id="chatbox-message"
                        rows={3}
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Ex: Le numéro de ce refuge a changé, la ligne S72 s'arrête ici..."
                        className="w-full rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs sm:text-sm text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all resize-none"
                      />
                    </div>

                    {/* Auteur ou pseudo facultatif */}
                    <div>
                      <label
                        htmlFor="chatbox-author"
                        className="block text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-1"
                      >
                        Prénom / Pseudo <span className="text-white/40 font-normal">(facultatif)</span>
                      </label>
                      <input
                        id="chatbox-author"
                        type="text"
                        maxLength={50}
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="Ex: Marc de Chamonix"
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all"
                      />
                    </div>

                    {/* Message d'erreur */}
                    {errorMessage && (
                      <div className="rounded-xl border border-red-400/40 bg-red-500/20 p-2 text-xs text-red-200 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {/* Bouton d'envoi */}
                    <button
                      type="submit"
                      disabled={isSubmitting || message.trim().length < 3}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-500/40 px-4 py-2.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/50 hover:border-emerald-400/90 shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Transmission en cours…</span>
                        </>
                      ) : (
                        <>
                          <SendHorizontal size={15} />
                          <span>Envoyer sur le Discord</span>
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
