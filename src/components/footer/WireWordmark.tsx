'use client'
import { useEffect, useRef } from 'react'
import { subscribe } from '@/lib/motion/engine'
import { audio, PENTATONIC } from '@/lib/audio/AudioManager'
import { atmosphere } from '@/lib/motion/atmosphere'
import { prefersReduced } from '@/lib/motion/hooks'
import styles from './Footer.module.css'

type Seg = [number, number, number, number]
const W = 60
const GAP = 22
/** GBGTECH drawn in straight strokes on a 60×100 grid — each stroke is one wire. */
const LETTERS: Seg[][] = [
  // G
  [[60, 0, 0, 0], [0, 0, 0, 100], [0, 100, 60, 100], [60, 100, 60, 52], [60, 52, 30, 52]],
  // B
  [[0, 0, 0, 100], [0, 0, 44, 0], [44, 0, 56, 24], [56, 24, 46, 48], [0, 48, 46, 48], [46, 48, 60, 74], [60, 74, 48, 100], [48, 100, 0, 100]],
  // G
  [[60, 0, 0, 0], [0, 0, 0, 100], [0, 100, 60, 100], [60, 100, 60, 52], [60, 52, 30, 52]],
  // T
  [[0, 0, 60, 0], [30, 0, 30, 100]],
  // E
  [[0, 0, 0, 100], [0, 0, 60, 0], [0, 50, 46, 50], [0, 100, 60, 100]],
  // C
  [[60, 0, 0, 0], [0, 0, 0, 100], [0, 100, 60, 100]],
  // H
  [[0, 0, 0, 100], [60, 0, 60, 100], [0, 50, 60, 50]],
]

interface Wire {
  ax: number
  ay: number
  bx: number
  by: number
  len: number
  nx: number
  ny: number
  disp: number
  vel: number
  /** where along the wire the deflection sits (0..1) */
  at: number
  k: number
  c: number
  grabbed: boolean
  note: number
  lastD: number
  path: SVGPathElement | null
}

const GRAB = 6
const BREAK = 26

/**
 * THE WIRE WORDMARK — every stroke is an independently simulated string.
 * Deflects toward the cursor via a quadratic Bézier control point, and when
 * released oscillates down to rest like a plucked wire. Each pluck plays a
 * Karplus–Strong note from an 8-note pentatonic set (longer wire → lower note)
 * and pulses the shared atmosphere, which the fog reads as turbulence.
 */
export function WireWordmark() {
  const svg = useRef<SVGSVGElement>(null)

  const wires: Omit<Wire, 'path'>[] = []
  LETTERS.forEach((segs, li) => {
    const ox = li * (W + GAP)
    for (const [x1, y1, x2, y2] of segs) {
      const ax = x1 + ox, ay = y1, bx = x2 + ox, by = y2
      const len = Math.hypot(bx - ax, by - ay)
      wires.push({ ax, ay, bx, by, len, nx: -(by - ay) / len, ny: (bx - ax) / len, disp: 0, vel: 0, at: 0.5, k: 0, c: 0, grabbed: false, note: 0, lastD: 999 })
    }
  })
  const totalW = LETTERS.length * W + (LETTERS.length - 1) * GAP

  useEffect(() => {
    const s = svg.current
    if (!s) return
    const paths = Array.from(s.querySelectorAll<SVGPathElement>('[data-wire]'))
    const sim: Wire[] = wires.map((w, i) => ({ ...w, path: paths[i] ?? null }))
    // tune: rank by length into 8 pentatonic notes; physical frequency ∝ 1/length
    const ranked = [...sim].sort((a, b) => b.len - a.len)
    ranked.forEach((w, r) => {
      w.note = Math.min(PENTATONIC.length - 1, Math.floor((r / ranked.length) * PENTATONIC.length))
      const f = 4 + (100 / w.len) * 2.2 // visual Hz
      w.k = (2 * Math.PI * f) ** 2
      w.c = 2 * 0.045 * Math.sqrt(w.k)
    })
    const reduced = prefersReduced()
    let unsub: (() => void) | null = null
    let px = -999
    let py = -999
    let inside = false

    const draw = (w: Wire) => {
      const cx = w.ax + (w.bx - w.ax) * w.at + w.nx * w.disp * 2
      const cy = w.ay + (w.by - w.ay) * w.at + w.ny * w.disp * 2
      w.path?.setAttribute('d', `M${w.ax} ${w.ay} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${w.bx} ${w.by}`)
    }

    const release = (w: Wire) => {
      w.grabbed = false
      const amp = Math.min(1, Math.abs(w.disp) / BREAK)
      audio.pluck(w.note, amp)
      atmosphere.pulse(0.25 + amp * 0.6, (w.ax + w.bx) / 2 / totalW)
    }

    const tick = (f: { dt: number }) => {
      let moving = false
      const steps = 3
      const h = f.dt / steps
      for (const w of sim) {
        if (inside && !reduced) {
          // project pointer onto the wire
          const dx = px - w.ax, dy = py - w.ay
          const t = (dx * (w.bx - w.ax) + dy * (w.by - w.ay)) / (w.len * w.len)
          const d = dx * w.nx + dy * w.ny
          const prevD = w.lastD
          w.lastD = d
          if (w.grabbed) {
            if (t < 0.04 || t > 0.96 || Math.abs(d) > BREAK) release(w)
            else {
              w.at = t
              w.disp += (d - w.disp) * 0.5
              w.vel = 0
            }
          } else if (t > 0.08 && t < 0.92 && Math.abs(w.disp) < 2 && (Math.abs(d) < GRAB || (Math.abs(prevD) < 40 && Math.sign(d) !== Math.sign(prevD)))) {
            w.grabbed = true
            w.at = t
          }
        } else if (w.grabbed) release(w)

        if (!w.grabbed) {
          for (let i = 0; i < steps; i++) {
            const acc = -w.k * w.disp - w.c * w.vel
            w.vel += acc * h
            w.disp += w.vel * h
          }
        }
        if (w.grabbed || Math.abs(w.disp) > 0.02 || Math.abs(w.vel) > 0.5) {
          moving = true
          draw(w)
        } else if (w.disp !== 0) {
          w.disp = 0
          w.vel = 0
          draw(w)
        }
      }
      if (!moving && !inside) {
        unsub?.()
        unsub = null
      }
    }

    const toLocal = (e: PointerEvent) => {
      const m = s.getScreenCTM()
      if (!m) return
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
      px = pt.x
      py = pt.y
    }
    const onMove = (e: PointerEvent) => {
      toLocal(e)
      inside = true
      unsub ??= subscribe(tick)
    }
    const onLeave = () => {
      inside = false
      for (const w of sim) w.lastD = 999
      px = py = -999
    }
    s.addEventListener('pointermove', onMove)
    s.addEventListener('pointerdown', onMove)
    s.addEventListener('pointerleave', onLeave)
    s.addEventListener('pointercancel', onLeave)
    return () => {
      unsub?.()
      s.removeEventListener('pointermove', onMove)
      s.removeEventListener('pointerdown', onMove)
      s.removeEventListener('pointerleave', onLeave)
      s.removeEventListener('pointercancel', onLeave)
    }
    // wires is derived from constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <svg
      ref={svg}
      className={styles.wordmark}
      viewBox={`-30 -40 ${totalW + 60} 180`}
      role="img"
      aria-label="GBGTech"
      data-cursor="link"
      data-cursor-label="Pluck"
    >
      {wires.map((w, i) => (
        <g key={i}>
          {/* invisible enlarged hit area — large target, unchanged visuals */}
          <line x1={w.ax} y1={w.ay} x2={w.bx} y2={w.by} className={styles.wireHit} />
          <path data-wire="" d={`M${w.ax} ${w.ay} Q${(w.ax + w.bx) / 2} ${(w.ay + w.by) / 2} ${w.bx} ${w.by}`} className={styles.wire} />
        </g>
      ))}
    </svg>
  )
}
