'use client'
/**
 * WebGL capability probe, context budget, and the FPS-driven auto-degrade monitor.
 */

let probed: boolean | null = null

/** Context-creation probe. Cached; the probe context is released immediately. */
export function hasWebGL(): boolean {
  if (probed !== null) return probed
  if (typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null
    probed = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    probed = false
  }
  return probed
}

export const isMobile = () =>
  typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768)

/** DPR cap: min(dpr, 2) desktop / 1.5 mobile, further reduced by the quality tier. */
export function targetDPR(): number {
  const cap = isMobile() ? 1.5 : 2
  const base = Math.min(window.devicePixelRatio || 1, cap)
  const tier = quality.tier
  if (tier >= 1) return Math.max(1, base * 0.66)
  return base
}

/* ------------------------------------------------------------------ */
/*  Context budget — max 2 concurrent WebGL contexts                   */
/* ------------------------------------------------------------------ */

const MAX_CONTEXTS = 2
const holders: { id: string; priority: number; evict: () => void }[] = []

/**
 * Request a WebGL context slot. If the budget is full, the lowest-priority
 * holder (below ours) is evicted; otherwise the request is denied and the
 * caller should render its static fallback.
 */
export function acquireContext(id: string, priority: number, evict: () => void): boolean {
  if (holders.some((h) => h.id === id)) return true
  if (holders.length >= MAX_CONTEXTS) {
    holders.sort((a, b) => a.priority - b.priority)
    const lowest = holders[0]
    if (!lowest || lowest.priority >= priority) return false
    holders.shift()
    lowest.evict()
  }
  holders.push({ id, priority, evict })
  return true
}

export function releaseContext(id: string) {
  const i = holders.findIndex((h) => h.id === id)
  if (i >= 0) holders.splice(i, 1)
}

/* ------------------------------------------------------------------ */
/*  Quality monitor — 60-frame rolling average                         */
/* ------------------------------------------------------------------ */

type TierListener = (tier: number) => void

/**
 * Tiers: 0 = full, 1 = reduced DPR, 2 = post-processing / transmission off,
 * 3 = static render. Only samples while a scene is actively rendering, so
 * on-demand scenes that idle never get penalised.
 */
class QualityMonitor {
  tier = 0
  private samples = new Float32Array(60)
  private i = 0
  private filled = 0
  private cooldown = 0
  private listeners = new Set<TierListener>()

  sample(dt: number) {
    if (dt <= 0 || dt > 0.25) return // tab switch / hitch — ignore
    this.samples[this.i] = dt
    this.i = (this.i + 1) % 60
    this.filled = Math.min(60, this.filled + 1)
    if (this.cooldown > 0) {
      this.cooldown--
      return
    }
    if (this.filled < 60) return
    let sum = 0
    for (let k = 0; k < 60; k++) sum += this.samples[k]!
    const fps = 60 / sum
    if (fps < 40 && this.tier < 3) this.setTier(this.tier + 1)
  }

  get fps() {
    if (this.filled === 0) return 60
    let sum = 0
    for (let k = 0; k < this.filled; k++) sum += this.samples[k]!
    return this.filled / sum
  }

  private setTier(t: number) {
    this.tier = t
    this.filled = 0
    this.cooldown = 90 // give the new tier time to settle
    for (const fn of this.listeners) fn(t)
  }

  onChange(fn: TierListener) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}

export const quality = new QualityMonitor()

/**
 * Create a fresh canvas inside a React-owned slot. A lost WebGL context can't
 * be recreated on the same canvas, so scenes that mount/unmount with viewport
 * proximity get a new element each time (React never owns it).
 */
export function mountCanvas(slot: HTMLElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.setAttribute('aria-hidden', 'true')
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  slot.appendChild(c)
  return c
}
