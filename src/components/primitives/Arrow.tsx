/**
 * §10.3 Arrow shift — the icon exits on the diagonal while a duplicate enters
 * from (-10px, 10px). 0.3s. Pure CSS (globals.css .arrow).
 */
export function Arrow({ direction = 'ne' }: { direction?: 'ne' | 'e' | 'down' }) {
  const d =
    direction === 'e'
      ? 'M2 8h11M9 4l4 4-4 4'
      : direction === 'down'
        ? 'M8 2v11M4 9l4 4 4-4'
        : 'M4 12L12 4M5.5 4H12v6.5'
  const svg = (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" aria-hidden="true">
      <path d={d} />
    </svg>
  )
  return (
    <span className="arrow" aria-hidden="true">
      {svg}
      {svg}
    </span>
  )
}
