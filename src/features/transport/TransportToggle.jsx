import React from 'react';
import { TrainFront } from 'lucide-react';

export default function TransportToggle({ active, onToggle }) {
  return (
    <div className="absolute right-4 top-[70px] z-[1000]">
      <button
        onClick={onToggle}
        title="Afficher/masquer le réseau de transport public alpin (trains, cars, navettes, téléphériques)"
        className={`glass-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
          active
            ? 'border border-indigo-400/50 bg-indigo-500/35 text-indigo-200 shadow-[0_0_14px_rgba(99,102,241,0.4)] ring-1 ring-indigo-400/30'
            : 'bg-black/35 text-white/70 hover:text-white hover:bg-black/45'
        }`}
      >
        <TrainFront size={14} className={active ? 'text-indigo-300 animate-pulse' : 'text-white/70'} />
        Transports
      </button>
    </div>
  );
}
