import React from 'react';
import { X, Train, Bus, CableCar, MapPin, Clock, Calendar, ExternalLink, Route, Mountain, Info, Sparkles } from 'lucide-react';

function getModeInfo(mode) {
  switch (mode) {
    case 'train':
      return {
        label: 'Train / TER Alpin',
        Icon: Train,
        color: '#6366f1',
        bgGradient: 'from-indigo-600/25 to-blue-600/15'
      };
    case 'mountain_train':
      return {
        label: 'Train Touristique & Crémaillère',
        Icon: Train,
        color: '#ef4444',
        bgGradient: 'from-rose-600/25 to-red-600/15'
      };
    case 'bus':
      return {
        label: 'Car & Ligne Régionale',
        Icon: Bus,
        color: '#10b981',
        bgGradient: 'from-emerald-600/25 to-teal-600/15'
      };
    case 'navette':
      return {
        label: 'Navette Alpine de Vallée',
        Icon: Bus,
        color: '#f59e0b',
        bgGradient: 'from-amber-600/25 to-orange-600/15'
      };
    case 'cable_car':
    case 'funicular':
      return {
        label: mode === 'funicular' ? 'Funiculaire Alpin' : 'Téléphérique / Télécabine',
        Icon: CableCar,
        color: '#ec4899',
        bgGradient: 'from-pink-600/25 to-purple-600/15'
      };
    case 'station':
      return {
        label: 'Gare / Pôle d\'échange',
        Icon: MapPin,
        color: '#3b82f6',
        bgGradient: 'from-blue-600/25 to-cyan-600/15'
      };
    default:
      return {
        label: 'Transport en commun',
        Icon: Bus,
        color: '#3b82f6',
        bgGradient: 'from-blue-600/25 to-indigo-600/15'
      };
  }
}

export default function TransportSidebar({ transport, onClose }) {
  if (!transport) return null;

  const { label, Icon, color } = getModeInfo(transport.mode);

  return (
    <aside className="sidebar-enter glass glass-panel scroll-thin absolute bottom-0 left-0 top-0 z-[1100] flex w-full flex-col overflow-y-auto sm:bottom-4 sm:left-4 sm:top-4 sm:w-[420px] sm:rounded-3xl">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/10 bg-black/40 p-5 backdrop-blur-xl">
        <span
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/20"
          style={{ background: color }}
        >
          <Icon size={22} className="text-white drop-shadow" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              {transport.ref || 'Ligne'}
            </span>
            <span className="text-xs font-medium text-white/60">{label}</span>
          </div>
          <h1 className="mt-1 text-lg font-bold leading-snug text-white">
            {transport.name}
          </h1>
          <p className="text-xs text-white/75">{transport.operator}</p>
        </div>
        <button
          aria-label="Fermer"
          onClick={onClose}
          className="glass-btn shrink-0 rounded-full p-2 transition-transform hover:scale-105 active:scale-95"
        >
          <X size={18} />
        </button>
      </header>

      {/* Corps du panneau */}
      <div className="flex flex-col gap-5 p-5">
        {/* Badges / Chips */}
        <div className="flex flex-wrap gap-2">
          {transport.network && (
            <Chip icon={<Sparkles size={13} className="text-amber-300" />}>
              {transport.network}
            </Chip>
          )}
          {transport.period && (
            <Chip icon={<Calendar size={13} className="text-blue-300" />}>
              {transport.period}
            </Chip>
          )}
          {transport.alt != null && (
            <Chip icon={<Mountain size={13} className="text-emerald-300" />}>
              Altitude {transport.alt} m
            </Chip>
          )}
        </div>

        {/* Section Parcours / Liaison */}
        {transport.route && (
          <Section title="Liaison & Itinéraire">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
              <Route size={18} className="mt-0.5 shrink-0 text-white/70" />
              <div className="text-sm font-medium leading-relaxed text-white/95">
                {transport.route}
              </div>
            </div>
          </Section>
        )}

        {/* Section Fréquence & Cadencement */}
        {transport.frequency && (
          <Section title="Fréquence & Cadencement">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
              <Clock size={18} className="mt-0.5 shrink-0 text-white/70" />
              <div className="text-sm leading-relaxed text-white/90">
                {transport.frequency}
              </div>
            </div>
          </Section>
        )}

        {/* Section Arrêts & Gares desservis */}
        {Array.isArray(transport.stops) && transport.stops.length > 0 && (
          <Section
            title={
              transport.mode === 'station'
                ? 'Lignes en correspondance'
                : `Arrêts principaux desservis (${transport.stops.length})`
            }
          >
            <div className="rounded-2xl bg-white/[0.05] p-3.5 ring-1 ring-white/10">
              <ul className="relative flex flex-col gap-3 pl-3">
                {/* Ligne verticale de la timeline */}
                <div
                  className="absolute bottom-2 left-[17px] top-2 w-[2px] rounded-full opacity-30"
                  style={{ background: color }}
                />
                {transport.stops.map((stop, idx) => (
                  <li key={idx} className="relative flex items-center gap-3">
                    <span
                      className="relative z-10 flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-black/40"
                      style={{ background: color }}
                    />
                    <span className="text-xs font-medium text-white/90">{stop}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        )}

        {/* Info mobilités douces & randonnée */}
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-xs leading-relaxed text-white/75">
          <Info size={16} className="mt-0.5 shrink-0 text-cyan-300" />
          <span>
            Cette ligne permet de rejoindre les sentiers de randonnée et refuges des Alpes sans voiture. Vérifiez les horaires en temps réel selon les conditions météo et saisons.
          </span>
        </div>

        {/* Lien officiel */}
        {transport.url && (
          <a
            href={transport.url}
            target="_blank"
            rel="noreferrer"
            className="glass-btn flex items-center justify-center gap-2 rounded-2xl bg-white/15 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-white/25 active:scale-[0.98]"
          >
            Consulter les horaires officiels <ExternalLink size={15} />
          </a>
        )}
      </div>
    </aside>
  );
}

function Chip({ icon, children }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/10"
      style={{ background: 'rgba(255,255,255,0.1)' }}
    >
      {icon}
      {children}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h2>
      {children}
    </section>
  );
}
