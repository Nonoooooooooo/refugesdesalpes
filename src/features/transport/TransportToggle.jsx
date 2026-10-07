import React from 'react';
import { TrainFront } from 'lucide-react';

export default function TransportToggle({ active, onToggle }) {
  return (
    <div className="absolute right-4 top-20 z-[1000]">
      <button
        onClick={onToggle}
        title="Afficher/masquer les lignes et arrêts de transport public"
        className={`glass-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
          active
            ? 'border border-blue-400/40 bg-blue-500/30 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
            : 'bg-black/30 text-white/60 hover:text-white'
        }`}
      >
        <TrainFront size={14} className={active ? 'text-blue-400' : ''} />
        Transports
      </button>
    </div>
  );
}
