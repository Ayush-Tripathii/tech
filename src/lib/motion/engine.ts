'use client'
/**
 * THE engine. One gsap.ticker, one Lenis, one pointer listener.
 *
 * Every subsystem that needs per-frame work calls `subscribe(fn)` and reads
 * from `frame`. Nobody else attaches scroll listeners or runs its own rAF.
 */
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '../gsap'
import { frame } from './frame'
import { clamp, damp } from './tokens'

type Tick = (f: typeof frame) => void

let lenis: Lenis | null = null
let started = false
const subs = new Set<Tick>()
let lastX = 0
let lastY = 0

function onPointerMove(e: PointerEvent) {
  const p = frame.pointer
  p.x = e.clientX
  p.y = e.clientY
  p.nx = (e.clientX / frame.vw) * 2 - 1
  p.ny = -((e.clientY / frame.vh) * 2 - 1)
  p.coarse = e.pointerType !== 'mouse'
  p.active = true
}
function onDown(e: PointerEvent) {
  onPointerMove(e)
  frame.pointer.down = true
  frame.energy.click = Math.max(frame.energy.click, 0.6)
}
function onUp() {
  frame.pointer.down = false
}
function onResize() {
  frame.vw = window.innerWidth
  frame.vh = window.innerHeight
}

function tick(time: number, deltaMs: number) {
  const dt = Math.min(deltaMs / 1000, 1 / 20)
  frame.time = time
  frame.dt = dt

  if (lenis) {
    lenis.raf(time * 1000)
    frame.scroll = lenis.scroll
    frame.velocity = lenis.velocity
    frame.limit = lenis.limit
  } else {
    const y = window.scrollY
    frame.velocity = y - frame.scroll
    frame.scroll = y
    frame.limit = document.documentElement.scrollHeight - frame.vh
  }
  if (frame.velocity > 0.1) frame.direction = 1
  else if (frame.velocity < -0.1) frame.direction = -1

  // Normalised scroll speed → scroll energy channel (decays with the lerp).
  const targetSpeed = clamp(Math.abs(frame.velocity) / 40)
  frame.speed += (targetSpeed - frame.speed) * damp(0.1, dt)
  frame.energy.scroll = frame.speed
  frame.energy.click *= Math.pow(0.92, dt * 60)
  frame.energy.hover *= Math.pow(0.9, dt * 60)
  // Idle pulse: a slow 0.4Hz breath so nothing is ever completely still.
  frame.energy.idle = 0.08 + 0.06 * Math.sin(time * Math.PI * 0.8)

  const p = frame.pointer
  p.vx = p.x - lastX
  p.vy = p.y - lastY
  lastX = p.x
  lastY = p.y

  for (const fn of subs) fn(frame)
}

export function startEngine({ reducedMotion }: { reducedMotion: boolean }) {
  if (started) return
  started = true
  onResize()

  if (!reducedMotion) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1, syncTouch: false })
    lenis.on('scroll', ScrollTrigger.update)
  }
  // Lenis is advanced inside tick() — i.e. gsap.ticker.add((t) => lenis.raf(t * 1000))
  // — so per-frame shared state is computed in the very same callback.
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('pointerup', onUp, { passive: true })
  window.addEventListener('pointercancel', onUp, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
}

export function stopEngine() {
  if (!started) return
  started = false
  gsap.ticker.remove(tick)
  lenis?.destroy()
  lenis = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onDown)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  window.removeEventListener('resize', onResize)
  subs.clear()
}

/** Register a per-frame consumer. Returns an unsubscribe function. */
export function subscribe(fn: Tick): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

export const scroll = {
  lock() {
    lenis?.stop()
    document.documentElement.classList.add('is-locked')
  },
  unlock() {
    lenis?.start()
    document.documentElement.classList.remove('is-locked')
  },
  top() {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
    window.scrollTo(0, 0)
    frame.scroll = 0
  },
  to(target: number | string | HTMLElement, opts: { offset?: number; duration?: number } = {}) {
    if (lenis) {
      lenis.scrollTo(target, { offset: opts.offset ?? 0, duration: opts.duration ?? 1.4 })
      return
    }
    if (typeof target === 'number') window.scrollTo({ top: target })
    else {
      const el = typeof target === 'string' ? document.querySelector(target) : target
      el?.scrollIntoView()
    }
  },
  get lenis() {
    return lenis
  },
}
