import React from 'react'

/**
 * Rose des Pentes interactive et visuelle.
 * Représente les 8 orientations (N, NE, E, SE, S, SO, O, NO)
 * et met en valeur les versants et altitudes à risque d'avalanche selon le BERA.
 *
 * @param {Object} pentes - Ex: { N: true, NE: true, E: true, SE: false, S: false, SW: false, W: false, NW: false }
 * @param {number|string} altitudeLimite - Altitude charnière (ex: 2200m)
 * @param {string} riskColor - Couleur officielle du risque (ex: #f97316)
 */
export default function RosePentesSvg({ pentes = {}, altitudeLimite = null, riskColor = '#f97316' }) {
  // Les 8 orientations dans le sens horaire en partant du Nord (0°)
  const orientations = [
    { key: 'N', label: 'N', angle: 0 },
    { key: 'NE', label: 'NE', angle: 45 },
    { key: 'E', label: 'E', angle: 90 },
    { key: 'SE', label: 'SE', angle: 135 },
    { key: 'S', label: 'S', angle: 180 },
    { key: 'SW', label: 'SO', angle: 225 },
    { key: 'W', label: 'O', angle: 270 },
    { key: 'NW', label: 'NO', angle: 315 },
  ]

  const size = 220
  const center = size / 2
  const outerRadius = 85
  const innerRadius = 45
  const coreRadius = 26

  // Génère un secteur angulaire SVG (anneau entre rInner et rOuter)
  function makeArc(angleDeg, rInner, rOuter) {
    const halfWidth = 22.5 // 45° par secteur / 2
    const a1 = ((angleDeg - halfWidth - 90) * Math.PI) / 180
    const a2 = ((angleDeg + halfWidth - 90) * Math.PI) / 180

    const x1 = center + rOuter * Math.cos(a1)
    const y1 = center + rOuter * Math.sin(a1)
    const x2 = center + rOuter * Math.cos(a2)
    const y2 = center + rOuter * Math.sin(a2)

    const x3 = center + rInner * Math.cos(a2)
    const y3 = center + rInner * Math.sin(a2)
    const x4 = center + rInner * Math.cos(a1)
    const y4 = center + rInner * Math.sin(a1)

    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z`
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none drop-shadow-md">
          {/* Cercle de fond */}
          <circle cx={center} cy={center} r={outerRadius + 8} fill="rgba(15, 23, 42, 0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

          {/* Secteurs pour chaque orientation */}
          {orientations.map(({ key, angle }) => {
            const isDanger = Boolean(pentes[key])

            return (
              <g key={key} className="transition-all duration-300">
                {/* Anneau supérieur (Hautes altitudes) */}
                <path
                  d={makeArc(angle, innerRadius, outerRadius)}
                  fill={isDanger ? riskColor : 'rgba(255, 255, 255, 0.06)'}
                  stroke="rgba(0, 0, 0, 0.4)"
                  strokeWidth="1.5"
                  className={isDanger ? 'animate-pulse transition-colors' : 'transition-colors'}
                  style={{
                    fillOpacity: isDanger ? 0.9 : 0.2,
                  }}
                >
                  <title>{`${key} (Haute altitude) : ${isDanger ? 'Pentes à risque' : 'Risque non prédominant'}`}</title>
                </path>

                {/* Anneau inférieur (Moyennes altitudes) */}
                <path
                  d={makeArc(angle, coreRadius, innerRadius)}
                  fill={isDanger && !altitudeLimite ? riskColor : 'rgba(255, 255, 255, 0.04)'}
                  stroke="rgba(0, 0, 0, 0.4)"
                  strokeWidth="1.5"
                  style={{
                    fillOpacity: isDanger && !altitudeLimite ? 0.8 : 0.15,
                  }}
                >
                  <title>{`${key} (Moyenne altitude) : ${isDanger && !altitudeLimite ? 'Pentes à risque' : 'Non prédominant'}`}</title>
                </path>
              </g>
            )
          })}

          {/* Lignes séparatrices et axes cardinaux */}
          <circle cx={center} cy={center} r={innerRadius} fill="none" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" strokeWidth="1" />
          <circle cx={center} cy={center} r={outerRadius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

          {/* Cœur central (Altitude charnière ou neutre) */}
          <circle cx={center} cy={center} r={coreRadius} fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

          {/* Texte au centre */}
          {altitudeLimite ? (
            <>
              <text x={center} y={center - 3} textAnchor="middle" fill="#93c5fd" fontSize="9" fontWeight="bold">
                {`> ${altitudeLimite}m`}
              </text>
              <text x={center} y={center + 8} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7.5">
                Pentes
              </text>
            </>
          ) : (
            <>
              <text x={center} y={center + 3} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="9" fontWeight="600">
                PENTES
              </text>
            </>
          )}

          {/* Labels cardinaux (N, NE, E, SE, S, SO, O, NO) */}
          {orientations.map(({ key, label, angle }) => {
            const rad = ((angle - 90) * Math.PI) / 180
            const textDist = outerRadius + 18
            const x = center + textDist * Math.cos(rad)
            const y = center + textDist * Math.sin(rad) + 4
            const isDanger = Boolean(pentes[key])

            return (
              <text
                key={key}
                x={x}
                y={y}
                textAnchor="middle"
                fontSize={label.length === 1 ? '11' : '9.5'}
                fontWeight={label === 'N' || isDanger ? 'bold' : 'normal'}
                fill={label === 'N' ? '#38bdf8' : isDanger ? riskColor : 'rgba(255,255,255,0.7)'}
              >
                {label}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Légende rapide sous la rose */}
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-white/70">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: riskColor }} />
          <span>Versants à risque</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/10 border border-white/20" />
          <span>Risque non marqué</span>
        </div>
      </div>
    </div>
  )
}
