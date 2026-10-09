import React, { useState, useMemo } from 'react';
import {
  X,
  Train,
  Bus,
  CableCar,
  MapPin,
  Clock,
  Calendar,
  ExternalLink,
  Route,
  Mountain,
  Info,
  Sparkles,
  ArrowLeftRight,
  ArrowRight,
  GitBranch,
} from 'lucide-react';

function getModeInfo(mode, transport = {}) {
  const isFreccia =
    transport.ref === 'Frecciarossa' ||
    transport.isTrenitalia ||
    transport.id === 'trenitalia-frecciarossa-paris-milan';
  const isTGV = (transport.isTGV || transport.ref === 'TGV INOUI') && !isFreccia;

  switch (mode) {
    case 'train':
      if (isFreccia) {
        return {
          label: 'Train Grande Vitesse (Trenitalia Frecciarossa 1000)',
          Icon: Train,
          color: '#059669',
          bgGradient: 'from-emerald-600/30 to-teal-600/20',
        };
      }
      if (isTGV) {
        return {
          label: 'Ligne à Grande Vitesse (TGV INOUI)',
          Icon: Train,
          color: '#be185d',
          bgGradient: 'from-pink-600/30 to-purple-600/20',
        };
      }
      return {
        label: 'Train / TER Alpin',
        Icon: Train,
        color: '#6366f1',
        bgGradient: 'from-indigo-600/25 to-blue-600/15',
      };
    case 'mountain_train':
      return {
        label: 'Train Touristique & Crémaillère',
        Icon: Train,
        color: '#ef4444',
        bgGradient: 'from-rose-600/25 to-red-600/15',
      };
    case 'bus':
      return {
        label: 'Car & Ligne Régionale',
        Icon: Bus,
        color: '#10b981',
        bgGradient: 'from-emerald-600/25 to-teal-600/15',
      };
    case 'navette':
      return {
        label: 'Navette Alpine de Vallée',
        Icon: Bus,
        color: '#f59e0b',
        bgGradient: 'from-amber-600/25 to-orange-600/15',
      };
    case 'cable_car':
    case 'funicular':
      return {
        label: mode === 'funicular' ? 'Funiculaire Alpin' : 'Téléphérique / Télécabine',
        Icon: CableCar,
        color: '#ec4899',
        bgGradient: 'from-pink-600/25 to-purple-600/15',
      };
    case 'station':
      return {
        label: "Gare / Pôle d'échange",
        Icon: MapPin,
        color: '#3b82f6',
        bgGradient: 'from-blue-600/25 to-cyan-600/15',
      };
    default:
      return {
        label: 'Transport en commun',
        Icon: Bus,
        color: '#3b82f6',
        bgGradient: 'from-blue-600/25 to-indigo-600/15',
      };
  }
}

export default function TransportSidebar({ transport, onClose, onSelectTransport }) {
  const safeTransport = transport || {};

  const isFreccia =
    safeTransport.ref === 'Frecciarossa' ||
    safeTransport.isTrenitalia ||
    safeTransport.id === 'trenitalia-frecciarossa-paris-milan';
  const isTGV = (safeTransport.isTGV || safeTransport.ref === 'TGV INOUI') && !isFreccia;

  const modeInfo = getModeInfo(safeTransport.mode, safeTransport);
  const { label, Icon } = modeInfo;
  const displayColor = isFreccia ? '#059669' : safeTransport.color || modeInfo.color;

  // État local de la direction active (0 = Aller, 1 = Retour)
  const [prevTransportId, setPrevTransportId] = useState(transport?.id);
  const [activeDirIndex, setActiveDirIndex] = useState(
    typeof transport?.activeDirectionIndex === 'number' ? transport.activeDirectionIndex : 0
  );
  // État local de la branche active
  const [activeBranchId, setActiveBranchId] = useState(transport?.activeBranchId || null);

  if (transport?.id !== prevTransportId) {
    setPrevTransportId(transport?.id);
    setActiveDirIndex(
      typeof transport?.activeDirectionIndex === 'number' ? transport.activeDirectionIndex : 0
    );
    setActiveBranchId(transport?.activeBranchId || null);
  }

  // Branches disponibles
  const branches = Array.isArray(safeTransport.branches) && safeTransport.branches.length > 1
    ? safeTransport.branches
    : null;

  const activeBranch = useMemo(() => {
    if (!branches) return null;
    if (activeBranchId) {
      return branches.find((b) => b.id === activeBranchId) || branches[0];
    }
    return branches[0];
  }, [branches, activeBranchId]);

  // Résoudre les directions
  const directions = useMemo(() => {
    if (!transport) return null;
    if (Array.isArray(transport.directions) && transport.directions.length > 0) {
      return transport.directions;
    }
    const nameOrRoute = transport.route || transport.name || '';
    if (nameOrRoute.includes('↔')) {
      const parts = nameOrRoute
        .replace(/^(Ligne|Navette|Car|Train|TER)\s+[A-Za-z0-9/_-]+\s*:\s*/i, '')
        .split('↔')
        .map((s) => s.trim().replace(/\s*\(\d+\s*m\)/g, ''))
        .filter(Boolean);
      if (parts.length >= 2) {
        const origin = parts[0];
        const dest = parts[parts.length - 1];
        const stops = Array.isArray(transport.stops) ? transport.stops : [];
        return [
          {
            id: 'aller',
            name: `Vers ${dest}`,
            origin,
            destination: dest,
            stops: stops,
            stopPoints: transport.stopPoints || [],
            timetable: transport.timetable || null,
          },
          {
            id: 'retour',
            name: `Vers ${origin}`,
            origin: dest,
            destination: origin,
            stops: [...stops].reverse(),
            stopPoints: Array.isArray(transport.stopPoints) ? [...transport.stopPoints].reverse() : [],
            timetable: null,
          },
        ];
      }
    }
    return null;
  }, [transport]);

  const activeDirection = directions ? directions[activeDirIndex] || directions[0] : null;

  const handleSelectDirection = (idx) => {
    setActiveDirIndex(idx);
    setActiveBranchId(null);
    if (onSelectTransport) {
      onSelectTransport({
        ...transport,
        activeDirectionIndex: idx,
        activeBranchId: null,
        skipFlyTo: true,
      });
    }
  };

  const handleSelectBranch = (b) => {
    setActiveBranchId(b.id);
    const newDirIdx = b.direction === 'retour' ? 1 : 0;
    setActiveDirIndex(newDirIdx);
    if (onSelectTransport) {
      onSelectTransport({
        ...transport,
        activeBranchId: b.id,
        activeDirectionIndex: newDirIdx,
        skipFlyTo: true,
      });
    }
  };

  // Arrêts selon la branche ou direction active
  const displayStops = activeBranch?.stops || activeDirection?.stops || transport.stops || [];
  const displayStopPoints =
    activeBranch?.stopPoints || activeDirection?.stopPoints || transport.stopPoints || [];

  // Liaison textuelle
  const displayRoute = activeBranch
    ? `${activeBranch.origin} → ${activeBranch.destination}`
    : activeDirection
    ? `${activeDirection.origin} → ${activeDirection.destination}`
    : transport.route;

  // Grille horaire
  const displayTimetable = useMemo(() => {
    if (activeBranch?.timetable) {
      return activeBranch.timetable;
    }
    if (activeDirection?.timetable) {
      return activeDirection.timetable;
    }
    if (transport.timetable) {
      return transport.timetable;
    }
    return null;
  }, [activeBranch, activeDirection, transport.timetable]);

  const handleStopClick = (stop, idx) => {
    let sp = null;
    if (typeof stop === 'object') {
      sp = stop;
    } else if (Array.isArray(displayStopPoints)) {
      sp = displayStopPoints.find((p) => p.name === stop) || displayStopPoints[idx];
    }
    if (onSelectTransport) {
      onSelectTransport({
        ...transport,
        selectedStop: sp || { name: typeof stop === 'string' ? stop : stop.name },
        skipFlyTo: sp && sp.lat != null ? false : true,
        lat: sp?.lat,
        lng: sp?.lng,
        zoom: 15,
      });
    }
  };

  return (
    <aside className="sidebar-enter glass glass-panel scroll-thin absolute bottom-0 left-0 top-0 z-[1100] flex w-full flex-col overflow-y-auto sm:bottom-4 sm:left-4 sm:top-4 sm:w-[420px] sm:rounded-3xl">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/10 bg-black/40 p-5 backdrop-blur-xl">
        <span
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/20 transition-colors"
          style={{ background: displayColor }}
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
          <h1 className="mt-1 text-lg font-bold leading-snug text-white">{transport.name}</h1>
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
        {/* En-tête exclusif Trenitalia Frecciarossa */}
        {isFreccia && (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#022c22] p-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-emerald-300">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                FS Italiane &bull; TRENITALIA
              </span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[9.5px] font-bold text-emerald-200">
                Frecciarossa 1000
              </span>
            </div>
            <div className="my-2.5 flex h-14 items-center justify-center">
              <img
                src="/icons/trenitalia_logo.svg"
                alt="Trenitalia Frecciarossa 1000"
                className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]"
              />
            </div>
            <div className="flex items-center justify-between border-t border-emerald-500/25 pt-2 text-[11px] text-emerald-200/90">
              <span className="font-medium">Rame Frecciarossa 1000</span>
              <span className="font-bold text-emerald-300">Liaison Transalpine France ↔ Italie</span>
            </div>
          </div>
        )}

        {/* En-tête exclusif TGV inOui */}
        {isTGV && (
          <div className="relative overflow-hidden rounded-2xl border border-rose-500/35 bg-gradient-to-br from-[#1b081d] via-[#2f0827] to-[#160517] p-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-rose-300">
                <span className="inline-block h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                SNCF Voyageurs &bull; TGV INOUI
              </span>
              <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-2.5 py-0.5 text-[9.5px] font-bold text-rose-200">
                Ligne à Grande Vitesse
              </span>
            </div>
            <div className="my-2.5 flex h-14 items-center justify-center">
              <img
                src="/icons/tgv_inoui_model.png"
                alt="TGV INOUI Duplex"
                className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]"
              />
            </div>
            <div className="flex items-center justify-between border-t border-rose-500/20 pt-2 text-[11px] text-rose-200/90">
              <span className="font-medium">Rame Duplex inOui</span>
              <span className="font-bold text-rose-300">Liaison Directe Métropoles &bull; Alpes</span>
            </div>
          </div>
        )}

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

        {/* Sélecteur de branches interactif (si la ligne a des branches) */}
        {branches && branches.length > 1 && (
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-blue-950/30 to-slate-900/40 p-3.5 backdrop-blur-md shadow-lg">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                <GitBranch size={14} className="text-cyan-400" />
                Branches & Variantes ({branches.length})
              </span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/20 px-2 py-0.5 text-[9.5px] font-bold text-cyan-200">
                Choix actif
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {branches.map((b) => {
                const isActive = activeBranch?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelectBranch(b)}
                    className={`flex items-center justify-between gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-600/40 to-blue-600/40 text-white font-semibold ring-2 ring-cyan-400/60 shadow-md scale-[1.01]'
                        : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.09] hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                            b.direction === 'retour'
                              ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                              : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {b.direction === 'retour' ? 'Retour' : 'Aller'}
                        </span>
                        <span className="text-xs font-semibold text-white truncate">
                          {b.name}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-white/60 truncate">
                        {b.origin} &rarr; {b.destination} ({b.stops?.length || 0} arrêts)
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      className={isActive ? 'text-cyan-300 shrink-0' : 'text-white/30 shrink-0'}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sélecteur de direction Aller / Retour */}
        {directions && directions.length >= 2 && (!branches || branches.length <= 1) && (
          <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-3.5 backdrop-blur-md shadow-md">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80">
                <ArrowLeftRight size={14} className="text-amber-400" />
                Sens de circulation
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80">
                {activeDirIndex === 0 ? 'Direction Aller' : 'Direction Retour'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {directions.map((dir, idx) => {
                const isActive = activeDirIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDirection(idx)}
                    className={`flex flex-col items-start gap-1 rounded-xl p-2.5 text-left transition-all ${
                      isActive
                        ? 'shadow-lg ring-2 ring-white/40 text-white font-medium scale-[1.02]'
                        : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white'
                    }`}
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, ${displayColor}ee, ${displayColor}99)`
                        : undefined,
                    }}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-90">
                      <ArrowRight size={12} className={isActive ? 'text-white' : 'text-white/50'} />
                      <span>{idx === 0 ? 'Aller' : 'Retour'}</span>
                    </div>
                    <div className="text-xs font-semibold leading-tight line-clamp-2">
                      {dir.name || `Vers ${dir.destination || 'Terminus'}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Arrêt sélectionné (si clic sur un arrêt spécifique) */}
        {transport.selectedStop && (
          <div className="flex items-start gap-3 rounded-2xl bg-amber-500/15 p-3.5 ring-1 ring-amber-400/30">
            <MapPin size={18} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Arrêt sélectionné
              </div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {transport.selectedStop.name}
              </div>
              {transport.selectedStop.time && (
                <div className="mt-1 font-mono text-xs text-amber-200/90">
                  Départs : {transport.selectedStop.time}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section Parcours / Liaison */}
        {displayRoute && (
          <Section title="Liaison & Itinéraire">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
              <Route size={18} className="mt-0.5 shrink-0 text-white/70" />
              <div className="text-sm font-medium leading-relaxed text-white/95">
                {displayRoute}
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

        {/* Section Arrêts & Gares desservis ordonnés selon la direction active */}
        {Array.isArray(displayStops) && displayStops.length > 0 && (
          <Section
            title={
              transport.mode === 'station'
                ? 'Lignes en correspondance'
                : `Arrêts desservis (${displayStops.length})`
            }
          >
            <div className="rounded-2xl bg-white/[0.05] p-3.5 ring-1 ring-white/10">
              <ul className="relative flex flex-col gap-3 pl-3">
                <div
                  className="absolute bottom-2 left-[17px] top-2 w-[2px] rounded-full opacity-30"
                  style={{ background: displayColor }}
                />
                {displayStops.map((stop, idx) => {
                  const stopLabel = typeof stop === 'string' ? stop : stop?.name || '';
                  const isFirst = idx === 0;
                  const isLast = idx === displayStops.length - 1;
                  const isSelectedStop =
                    transport.selectedStop && transport.selectedStop.name === stopLabel;

                  return (
                    <li
                      key={idx}
                      onClick={() => handleStopClick(stop, idx)}
                      className="relative flex items-center justify-between gap-2 cursor-pointer group rounded-lg p-1 -m-1 transition-colors hover:bg-white/[0.07]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`relative z-10 flex shrink-0 rounded-full ring-2 ring-black/40 transition-transform group-hover:scale-125 ${
                            isSelectedStop
                              ? 'h-3.5 w-3.5 ring-amber-400'
                              : isFirst || isLast
                              ? 'h-3 w-3'
                              : 'h-2 w-2'
                          }`}
                          style={{
                            background: isSelectedStop
                              ? '#f59e0b'
                              : isFirst
                              ? '#10b981'
                              : isLast
                              ? '#ef4444'
                              : displayColor,
                          }}
                        />
                        <span
                          className={`text-xs transition-colors ${
                            isSelectedStop
                              ? 'text-amber-300 font-bold'
                              : isFirst || isLast
                              ? 'text-white font-semibold'
                              : 'text-white/85 group-hover:text-white'
                          }`}
                        >
                          {stopLabel}
                        </span>
                      </div>
                      {(isFirst || isLast) && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isFirst
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isFirst ? 'Départ' : 'Terminus'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Section>
        )}

        {/* Section Grille Horaires Officiels */}
        {displayTimetable &&
          Array.isArray(displayTimetable.rows) &&
          displayTimetable.rows.length > 0 &&
          (() => {
            const rows = displayTimetable.rows;
            const maxCols = Math.max(
              ...rows.map((r) => (Array.isArray(r.times) ? r.times.length : 0)),
              0
            );
            const rawHeaders = Array.isArray(displayTimetable.headers)
              ? displayTimetable.headers
              : [];
            const headers =
              rawHeaders.length > 0
                ? rawHeaders
                : Array.from({ length: maxCols }, (_, idx) => `Dép. ${idx + 1}`);

            return (
              <Section title={displayTimetable.title || 'Horaires et passages'}>
                <div className="rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10">
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full min-w-[340px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/15 text-[10px] uppercase tracking-wider text-white/60">
                          <th className="pb-2 pr-2 font-semibold">Arrêt</th>
                          {headers.map((h, i) => (
                            <th
                              key={i}
                              className="pb-2 px-1 text-center font-semibold text-white/90"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {rows.map((row, i) => {
                          const stopName =
                            typeof row.stop === 'string'
                              ? row.stop
                              : row.stop?.name || row.name || 'Arrêt';
                          const times = Array.isArray(row.times) ? row.times : [];
                          const isSelectedStop =
                            transport.selectedStop &&
                            (transport.selectedStop.name === stopName ||
                              stopName
                                .toLowerCase()
                                .includes(transport.selectedStop.name.toLowerCase()));

                          return (
                            <tr
                              key={i}
                              className={`transition-colors ${
                                isSelectedStop
                                  ? 'bg-amber-500/20 font-semibold'
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              <td className="py-1.5 pr-2 font-medium text-white/90 whitespace-nowrap">
                                <span className="flex items-center gap-1.5">
                                  {isSelectedStop && (
                                    <MapPin size={12} className="text-amber-400 shrink-0" />
                                  )}
                                  {stopName}
                                </span>
                              </td>
                              {times.map((t, j) => (
                                <td
                                  key={j}
                                  className={`py-1.5 px-1 text-center font-mono text-[11px] whitespace-nowrap ${
                                    isSelectedStop ? 'text-amber-200' : 'text-white/80'
                                  }`}
                                >
                                  {t || '-'}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {displayTimetable.note && (
                    <div className="mt-2.5 border-t border-white/10 pt-2 text-[11px] leading-relaxed italic text-white/70">
                      {displayTimetable.note}
                    </div>
                  )}
                </div>
              </Section>
            );
          })()}

        {/* Info mobilités douces & randonnée */}
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-xs leading-relaxed text-white/75">
          <Info size={16} className="mt-0.5 shrink-0 text-cyan-300" />
          <span>
            Cette liaison permet de rejoindre les départs de sentiers, cols et refuges alpins en
            mobilité douce. Vérifiez les conditions météo et correspondances en gare.
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
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
        {title}
      </h2>
      {children}
    </section>
  );
}
