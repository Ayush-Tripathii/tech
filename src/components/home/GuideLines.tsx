'use client'
import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { subscribe } from '@/lib/motion/engine'
import { whenTransitionComplete } from '@/lib/motion/store'
import { audio } from '@/lib/audio/AudioManager'
import { frame } from '@/lib/motion/frame'
import { prefersReduced } from '@/lib/motion/hooks'
import styles from './Hero.module.css'

interface Bolt {
  pts: { x: number; y: number }[]
  born: number
  life: number
  hue: string
}
interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
}

/** Line definitions in normalised hero space (0..1). */
const LINES = [
  { d: (w: number, h: number) => `M ${-0.02 * w} ${0.3 * h} L ${1.02 * w} ${0.22 * h}` },
  { d: (w: number, h: number) => `M ${0.62 * w} ${-0.02 * h} L ${0.86 * w} ${1.02 * h}` },
  { d: (w: number, h: number) => `M ${-0.02 * w} ${0.82 * h} C ${0.3 * w} ${0.7 * h}, ${0.6 * w} ${0.92 * h}, ${1.02 * w} ${0.74 * h}` },
]

const SPECTRUM = ['#3B82F6', '#22D3EE', '#A78BFA', '#F4F5F7']

/**
 * Three guide lines draw across the hero (DrawSVG, 1.2s, stagger 0.15). Once
 * ALL three have finished drawing, hovering a line fires a weld-spark burst
 * arcing to one or two of the others. One synthesized spark per burst.
 */
export function GuideLines() {
  const svg = useRef<SVGSVGElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const s = svg.current
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!s || !c || !ctx) return
    const visible = Array.from(s.querySelectorAll<SVGPathElement>('[data-line]'))
    const hits = Array.from(s.querySelectorAll<SVGPathElement>('[data-hit]'))
    const reduced = prefersReduced()
    let w = 0
    let h = 0
    let armed = false
    let cancelled = false
    const dpr = Math.min(devicePixelRatio, 2)
    const bolts: Bolt[] = []
    const sparks: Spark[] = []
    const lastFire = new Map<number, number>()
    let unsub: (() => void) | null = null

    const layout = () => {
      const r = s.getBoundingClientRect()
      w = r.width
      h = r.height
      s.setAttribute('viewBox', `0 0 ${w} ${h}`)
      LINES.forEach((l, i) => {
        visible[i]?.setAttribute('d', l.d(w, h))
        hits[i]?.setAttribute('d', l.d(w, h))
      })
      c.width = w * dpr
      c.height = h * dpr
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(s)

    gsap.set(visible, { drawSVG: '0%' })
    whenTransitionComplete().then(() => {
      if (cancelled) return
      if (reduced) {
        gsap.set(visible, { drawSVG: '100%' })
        return
      }
      gsap.to(visible, {
        drawSVG: '100%',
        duration: 1.2,
        ease: 'gbg.inOutQuint',
        stagger: 0.15,
        delay: 0.4,
        onComplete: () => {
          armed = true
          s.dataset.armed = 'true'
        },
      })
    })

    const nearestOn = (path: SVGPathElement, x: number, y: number) => {
      const len = path.getTotalLength()
      let best = { x: 0, y: 0, d: Infinity }
      for (let i = 0; i <= 40; i++) {
        const p = path.getPointAtLength((i / 40) * len)
        const d = (p.x - x) ** 2 + (p.y - y) ** 2
        if (d < best.d) best = { x: p.x, y: p.y, d }
      }
      // pick a point along the target line, offset from the nearest so arcs travel
      const shift = (Math.random() - 0.5) * len * 0.25
      const t = Math.max(0, Math.min(len, (Math.sqrt(best.d) > 0 ? len / 2 : 0) + shift))
      const p = Math.random() < 0.6 ? best : path.getPointAtLength(t)
      return { x: p.x, y: p.y }
    }

    const bolt = (ax: number, ay: number, bx: number, by: number, hue: string) => {
      const pts: { x: number; y: number }[] = []
      const n = 18
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const nx = -(by - ay)
      const ny = bx - ax
      const bow = (Math.random() - 0.5) * 0.5
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const arc = Math.sin(t * Math.PI) * bow
        const jitter = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 18
        // quadratic arc + jitter perpendicular
        const qx = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * (mx + nx * arc) + t * t * bx
        const qy = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * (my + ny * arc) + t * t * by
        pts.push({ x: qx + jitter * (ny / Math.hypot(nx, ny || 1)), y: qy - jitter * (nx / Math.hypot(nx || 1, ny)) })
      }
      bolts.push({ pts, born: frame.time, life: 0.28 + Math.random() * 0.15, hue })
    }

    const burst = (i: number, x: number, y: number) => {
      const now = performance.now()
      if (now - (lastFire.get(i) ?? 0) < 260) return
      lastFire.set(i, now)
      const others = [0, 1, 2].filter((k) => k !== i)
      const targets = Math.random() < 0.5 ? others : [others[Math.floor(Math.random() * 2)]!]
      for (const k of targets) {
        const p = nearestOn(visible[k]!, x, y)
        bolt(x, y, p.x, p.y, SPECTRUM[Math.floor(Math.random() * SPECTRUM.length)]!)
        if (Math.random() < 0.5) bolt(x, y, p.x, p.y, '#F4F5F7')
        for (let j = 0; j < 10; j++) {
          const a = Math.random() * Math.PI * 2
          const v = 60 + Math.random() * 220
          sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, born: frame.time, life: 0.4 + Math.random() * 0.4 })
        }
      }
      for (let j = 0; j < 14; j++) {
        const a = Math.random() * Math.PI * 2
        const v = 80 + Math.random() * 260
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, born: frame.time, life: 0.35 + Math.random() * 0.5 })
      }
      audio.spark(0.9) // one per burst, never per bolt
      frame.energy.hover = Math.max(frame.energy.hover, 0.8)
      unsub ??= subscribe(draw)
    }

    const draw = (f: { time: number; dt: number }) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]!
        const age = (f.time - b.born) / b.life
        if (age >= 1) {
          bolts.splice(i, 1)
          continue
        }
        ctx.strokeStyle = b.hue
        ctx.globalAlpha = (1 - age) * (0.6 + Math.random() * 0.4)
        ctx.lineWidth = 1.4 * (1 - age) + 0.4
        ctx.shadowColor = b.hue
        ctx.shadowBlur = 12
        ctx.beginPath()
        b.pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]!
        const age = (f.time - p.born) / p.life
        if (age >= 1) {
          sparks.splice(i, 1)
          continue
        }
        p.vy += 520 * f.dt
        p.vx *= 0.98
        p.x += p.vx * f.dt
        p.y += p.vy * f.dt
        ctx.globalAlpha = 1 - age
        ctx.fillStyle = age < 0.3 ? '#FFFFFF' : '#D7FF3E'
        ctx.fillRect(p.x, p.y, 1.6, 1.6)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      if (!bolts.length && !sparks.length) {
        ctx.clearRect(0, 0, w, h)
        unsub?.()
        unsub = null
      }
    }

    const handlers = hits.map((hp, i) => {
      const fn = (e: PointerEvent) => {
        if (!armed || reduced) return
        const r = s.getBoundingClientRect()
        burst(i, e.clientX - r.left, e.clientY - r.top)
      }
      hp.addEventListener('pointerenter', fn)
      hp.addEventListener('pointermove', fn)
      hp.addEventListener('pointerdown', fn)
      return fn
    })

    return () => {
      cancelled = true
      ro.disconnect()
      unsub?.()
      hits.forEach((hp, i) => {
        hp.removeEventListener('pointerenter', handlers[i]!)
        hp.removeEventListener('pointermove', handlers[i]!)
        hp.removeEventListener('pointerdown', handlers[i]!)
      })
    }
  }, [])

  return (
    <>
      <svg ref={svg} className={styles.lines} aria-hidden="true" data-armed="false">
        {LINES.map((_, i) => (
          <g key={i}>
            <path data-line="" className={styles.line} fill="none" />
            <path data-hit="" className={styles.hit} fill="none" />
          </g>
        ))}
      </svg>
      <canvas ref={canvas} className={styles.sparks} aria-hidden="true" />
    </>
  )
}
