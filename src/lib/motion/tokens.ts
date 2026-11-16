/**
 * Motion tokens — the single source of truth for every duration, ease and
 * stagger on the site. CSS mirrors these in globals.css (:root custom props).
 * Nothing outside these sets is allowed.
 */
export const DUR = {
  instant: 0.15,
  fast: 0.3,
  base: 0.6,
  slow: 0.9,
  cine: 1.4,
  epic: 2.2,
} as const

export const STAGGER = {
  chars: 0.012,
  words: 0.04,
  lines: 0.08,
  cards: 0.09,
  grid: 0.035,
} as const

/** Exact cubic-bezier control points — shared with CSS so both engines agree. */
export const BEZIER = {
  outExpo: [0.16, 1, 0.3, 1],
  outQuart: [0.25, 1, 0.5, 1],
  inOutQuint: [0.83, 0, 0.17, 1],
  snap: [0.34, 1.56, 0.64, 1],
  mech: [0.7, 0, 0.2, 1],
} as const

/** GSAP ease names, registered via CustomEase in lib/gsap.ts. */
export const EASE = {
  outExpo: 'gbg.outExpo',
  outQuart: 'gbg.outQuart',
  inOutQuint: 'gbg.inOutQuint',
  snap: 'gbg.snap',
  mech: 'gbg.mech',
} as const

export type EaseName = keyof typeof EASE

/** Evaluate a cubic-bezier ease in JS (for per-frame math outside GSAP). */
export function bezierEase([x1, y1, x2, y2]: readonly number[]): (t: number) => number {
  const ax = 3 * x1! - 3 * x2! + 1, bx = 3 * x2! - 6 * x1!, cx = 3 * x1!
  const ay = 3 * y1! - 3 * y2! + 1, by = 3 * y2! - 6 * y1!, cy = 3 * y1!
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= (sx(t) - x) / d
    }
    return sy(Math.min(1, Math.max(0, t)))
  }
}

export const ease = {
  outExpo: bezierEase(BEZIER.outExpo),
  outQuart: bezierEase(BEZIER.outQuart),
  inOutQuint: bezierEase(BEZIER.inOutQuint),
  snap: bezierEase(BEZIER.snap),
  mech: bezierEase(BEZIER.mech),
}

/* ---------- tiny math kit used by every per-frame consumer ---------- */
export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Frame-rate independent lerp factor: `k` is the per-frame factor at 60fps. */
export const damp = (k: number, dt: number) => 1 - Math.pow(1 - k, dt * 60)
/** Map a global progress into a local 0→1 window. */
export const win = (p: number, start: number, end: number) => clamp((p - start) / (end - start))
export const smooth = (t: number) => t * t * (3 - 2 * t)
