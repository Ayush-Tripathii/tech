'use client'
/**
 * Discrete, cross-component motion state. Things that change a handful of
 * times per session live here (preloader done, transition phase, menu, sound).
 * Per-frame values live in ./frame.ts instead.
 */
import { create } from 'zustand'

export type CursorMode = 'default' | 'link' | 'drag' | 'media' | 'hold' | 'hidden'
export type TransitionPhase = 'idle' | 'out' | 'hold' | 'in'

interface MotionStore {
  reducedMotion: boolean
  webgl: boolean
  isTouch: boolean
  preloaderDone: boolean
  /** Gate for EVERY entrance animation. False during preloader and page transitions. */
  transitionComplete: boolean
  phase: TransitionPhase
  menuOpen: boolean
  soundOn: boolean
  cursor: { mode: CursorMode; label: string }
  /** 0..1, drives the cursor ring radial sweep for hold-to-charge. */
  hold: number
  set: (p: Partial<Omit<MotionStore, 'set'>>) => void
}

export const useMotion = create<MotionStore>((set) => ({
  reducedMotion: false,
  webgl: true,
  isTouch: false,
  preloaderDone: false,
  transitionComplete: false,
  phase: 'idle',
  menuOpen: false,
  soundOn: false,
  cursor: { mode: 'default', label: '' },
  hold: 0,
  set: (p) => set(p),
}))

export const motionState = () => useMotion.getState()

/**
 * Resolve when `transitionComplete` is true. Every entrance animation awaits
 * this so nothing ever animates underneath a curtain.
 */
export function whenTransitionComplete(): Promise<void> {
  if (useMotion.getState().transitionComplete) return Promise.resolve()
  return new Promise((resolve) => {
    const unsub = useMotion.subscribe((s) => {
      if (s.transitionComplete) {
        unsub()
        resolve()
      }
    })
  })
}

/** Site-wide custom events (loosely coupled one-way signals). */
export const EVENTS = {
  PRELOADER_COMPLETE: 'gbg:preloader-complete',
  HERO_REVEALED: 'gbg:hero-revealed',
} as const
