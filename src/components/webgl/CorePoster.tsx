/**
 * Pre-rendered poster of the Lattice Core for browsers without WebGL
 * (auto-detected via a context-creation probe). Pure SVG — zero requests.
 */
export function CorePoster({ className, label = false }: { className?: string; label?: boolean }) {
  // Pentakis silhouette, flat-shaded facets.
  const facets: [string, number][] = [
    ['0,-120 104,-60 0,0', 0.22],
    ['104,-60 104,60 0,0', 0.12],
    ['104,60 0,120 0,0', 0.08],
    ['0,120 -104,60 0,0', 0.1],
    ['-104,60 -104,-60 0,0', 0.18],
    ['-104,-60 0,-120 0,0', 0.3],
  ]
  return (
    <svg className={className} viewBox="-400 -260 800 520" preserveAspectRatio="xMidYMid slice" aria-hidden={!label} role={label ? 'img' : undefined}>
      <defs>
        <radialGradient id="cp-glow" cx="0" cy="0" r="300" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22D3EE" stopOpacity="0.18" />
          <stop offset="1" stopColor="#06070A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cp-spec" x1="0" x2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <rect x="-400" y="-260" width="800" height="520" fill="#06070A" />
      <circle r="300" fill="url(#cp-glow)" />
      <g transform="translate(0 -10)">
        {facets.map(([pts, o], i) => (
          <polygon key={i} points={pts} fill="#F4F5F7" fillOpacity={o} stroke="#9BEFFF" strokeOpacity="0.35" strokeWidth="1" />
        ))}
        <ellipse rx="170" ry="60" fill="none" stroke="#E8ECF2" strokeOpacity="0.35" transform="rotate(-18)" />
        <ellipse rx="190" ry="90" fill="none" stroke="#E8ECF2" strokeOpacity="0.2" transform="rotate(40)" />
        <line x1="-400" y1="-4" x2="0" y2="0" stroke="#fff" strokeOpacity="0.5" />
        <line x1="0" y1="0" x2="400" y2="-60" stroke="url(#cp-spec)" strokeOpacity="0.6" />
      </g>
    </svg>
  )
}
