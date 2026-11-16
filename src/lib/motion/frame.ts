/**
 * The shared per-frame state. Computed ONCE per gsap.ticker tick by the engine,
 * read by every subsystem (cursor, WebGL scenes, marquees, audio). This is a
 * plain mutable object on purpose — per-frame values must never trigger React
 * renders.
 */
export interface FrameState {
  time: number
  dt: number
  /** Lenis scroll position in px. */
  scroll: number
  /** Lenis velocity, px/frame (signed). */
  velocity: number
  /** Smoothed absolute velocity, normalised 0..1. */
  speed: number
  /** 1 = down, -1 = up. Sticky: keeps last non-zero direction. */
  direction: 1 | -1
  limit: number
  vw: number
  vh: number
  pointer: {
    /** client px */
    x: number
    y: number
    /** -1..1, y up */
    nx: number
    ny: number
    vx: number
    vy: number
    down: boolean
    /** True once the pointer has moved at least once. */
    active: boolean
    coarse: boolean
  }
  energy: {
    scroll: number
    hover: number
    click: number
    idle: number
  }
}

export const frame: FrameState = {
  time: 0,
  dt: 1 / 60,
  scroll: 0,
  velocity: 0,
  speed: 0,
  direction: 1,
  limit: 0,
  vw: 1,
  vh: 1,
  pointer: { x: 0, y: 0, nx: 0, ny: 0, vx: 0, vy: 0, down: false, active: false, coarse: false },
  energy: { scroll: 0, hover: 0, click: 0, idle: 0 },
}

/** Combine interaction sources — never add, always max. */
export const combinedEnergy = (e = frame.energy) => Math.max(e.scroll, e.hover, e.click, e.idle)
