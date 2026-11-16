'use client'
import { useLayoutEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { subscribe } from '@/lib/motion/engine'
import { whenTransitionComplete } from '@/lib/motion/store'
import { ease as E, win, damp, lerp } from '@/lib/motion/tokens'
import { prefersReduced } from '@/lib/motion/hooks'
import { audio } from '@/lib/audio/AudioManager'
import { acquireContext, isMobile, mountCanvas, releaseContext } from '@/lib/webgl/capabilities'
import { SERVICES } from '@/lib/content/site'
import { TransitionLink } from '@/components/system/TransitionLink'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import type { FramePlayer, FrameSource } from '@/components/webgl/FrameSequence'
import styles from './ServicesSequence.module.css'

const TITLE = 'Six disciplines. One lattice.'

/** Entry vectors (in viewport units) + rotation for each card's motion path. */
const PATHS: { from: [number, number]; ctrl: [number, number]; rot: number; ry: number }[] = [
  { from: [-1.1, -0.6], ctrl: [-0.6, 0.4], rot: -24, ry: 40 },
  { from: [0.1, 1.2], ctrl: [-0.4, 0.6], rot: 12, ry: -30 },
  { from: [1.2, -0.5], ctrl: [0.7, 0.5], rot: 30, ry: -50 },
  { from: [-1.2, 0.7], ctrl: [-0.3, -0.5], rot: -18, ry: 35 },
  { from: [0.0, -1.2], ctrl: [0.6, -0.3], rot: 20, ry: 20 },
  { from: [1.25, 0.8], ctrl: [0.2, 0.9], rot: -32, ry: -40 },
]

type RGB = [number, number, number]
const VOID: RGB = [6, 7, 10]
const INK: RGB = [244, 245, 247]
const DIM: RGB = [138, 144, 155]
const DIM_INV: RGB = [74, 79, 88] // 7.6:1 on #F4F5F7 — AA in the inverted state
const mix = (a: RGB, b: RGB, t: number) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i]!, t))).join(',')})`

/**
 * SERVICES SEQUENCE — ~400vh pinned (250vh mobile). ONE normalised progress
 * value drives every effect; each effect derives its own window from it:
 *   0.00–0.70 frame sequence scrub (lerped index, 0.12)
 *   0.05–0.25 headline glyph scatter → swarm → formation
 *   0.20–0.80 six cards on motion paths, SVG borders drawing
 *   0.55–0.75 palette inversion (CSS vars + shader uniform)
 *   0.85–1.00 five stripes hand off to the next section
 */
export function ServicesSequence() {
  const section = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLDivElement>(null)

  // Layout effect: its cleanup must run BEFORE React removes the DOM, so the
  // ScrollTrigger pin-spacer is unwrapped first (otherwise removeChild throws).
  useLayoutEffect(() => {
    const el = section.current
    const cv = canvas.current
    if (!el || !cv) return
    const reduced = prefersReduced()
    const mobile = isMobile()
    const glyphs = Array.from(el.querySelectorAll<HTMLElement>('[data-glyph]'))
    const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-card]'))
    const borders = cards.map((c) => c.querySelector<SVGRectElement>('rect'))
    const stripes = Array.from(el.querySelectorAll<HTMLElement>('[data-stripe]'))
    let player: FramePlayer | null = null
    let cvEl: HTMLCanvasElement | null = null
    let booting = false
    let source: FrameSource | null = null
    let frameTarget = 0
    let frameCur = 0
    let invert = 0
    let active = false
    let unsub: (() => void) | null = null
    let cancelled = false
    let st: ScrollTrigger | null = null
    let tween: gsap.core.Tween | null = null

    // Per-glyph random scatter vectors (measured outward from the title centre).
    let vectors: { x: number; y: number; r: number; d: number }[] = []
    const measure = () => {
      const title = el.querySelector<HTMLElement>('[data-title]')
      if (!title) return
      const tr = title.getBoundingClientRect()
      const cx = tr.left + tr.width / 2
      const cy = tr.top + tr.height / 2
      vectors = glyphs.map((g, i) => {
        const r = g.getBoundingClientRect()
        const dx = r.left + r.width / 2 - cx
        const dy = r.top + r.height / 2 - cy
        const len = Math.hypot(dx, dy) || 1
        const seed = Math.sin(i * 12.9898) * 43758.5453
        const rand = seed - Math.floor(seed)
        const dist = innerWidth * (0.15 + rand * 0.3)
        return {
          x: (dx / len) * dist + (rand - 0.5) * 200,
          y: (dy / len) * dist * 0.6 + (rand - 0.5) * innerHeight * 0.6,
          r: (rand - 0.5) * 540,
          d: rand,
        }
      })
    }

    const apply = (p: number) => {
      // 0.00–0.70 frame index
      if (source) frameTarget = win(p, 0, 0.7) * (source.count - 1)

      // 0.05–0.25 glyph swarm
      const gu = win(p, 0.05, 0.25)
      glyphs.forEach((g, i) => {
        const v = vectors[i]
        if (!v) return
        // each glyph has its own phase in the swarm, so they leave and return out of sync
        const local = Math.max(0, Math.min(1, gu * 1.35 - v.d * 0.35))
        const s = Math.sin(local * Math.PI)
        const k = s * s
        g.style.transform = k > 0.0005 ? `translate3d(${(v.x * k).toFixed(1)}px, ${(v.y * k).toFixed(1)}px, 0) rotate(${(v.r * k).toFixed(1)}deg) scale(${(1 - 0.4 * k).toFixed(3)})` : ''
        g.style.opacity = String(1 - k * 0.55)
      })

      // 0.20–0.80 cards along motion paths
      cards.forEach((c, i) => {
        const start = 0.2 + i * 0.07
        const cp = E.outExpo(win(p, start, start + 0.2))
        const path = PATHS[i]!
        const inv = 1 - cp
        // quadratic Bézier from entry vector → control → rest (0,0)
        const bx = inv * inv * path.from[0] + 2 * inv * cp * path.ctrl[0] * 0.5
        const by = inv * inv * path.from[1] + 2 * inv * cp * path.ctrl[1] * 0.5
        c.style.transform = `translate3d(${(bx * innerWidth).toFixed(1)}px, ${(by * innerHeight).toFixed(1)}px, 0) rotate(${(path.rot * inv).toFixed(2)}deg) rotateY(${(path.ry * inv).toFixed(2)}deg) scale(${(0.82 + 0.18 * cp).toFixed(3)})`
        c.style.opacity = String(Math.min(1, cp * 1.6))
        const b = borders[i]
        if (b) b.style.strokeDashoffset = String(1 - cp) // length (=1 via pathLength) × (1 − progress)
        c.style.pointerEvents = cp > 0.9 ? 'auto' : 'none'
      })

      // 0.55–0.75 palette inversion
      invert = E.inOutQuint(win(p, 0.55, 0.75))
      el.style.setProperty('--sec-bg', mix(VOID, INK, invert))
      el.style.setProperty('--sec-ink', mix(INK, VOID, invert))
      el.style.setProperty('--sec-dim', mix(DIM, DIM_INV, invert))
      el.style.setProperty('--sec-line', invert > 0.5 ? 'rgba(6,7,10,0.14)' : 'rgba(244,245,247,0.1)')
      el.dataset.inverted = invert > 0.5 ? 'true' : 'false'

      // 0.85–1.00 five stripes, stagger 0.04 (in seconds-equivalent of the window)
      stripes.forEach((s, i) => {
        const a = 0.85 + i * 0.022
        const t = E.inOutQuint(win(p, a, a + 0.06))
        s.style.transform = `scaleY(${t.toFixed(4)})`
      })
    }

    const tick = (f: { dt: number; speed: number }) => {
      frameCur += (frameTarget - frameCur) * damp(0.12, f.dt)
      if (player && source) player.draw(source, frameCur, invert)
      // turbulence: bed gain follows scroll velocity, clamped 0–0.35
      audio.setBed(Math.min(0.35, f.speed * 0.9))
      if (!active && Math.abs(frameTarget - frameCur) < 0.05) {
        unsub?.()
        unsub = null
      }
    }

    const start = () => {
      unsub ??= subscribe(tick)
    }

    // Player + source (dynamic import keeps the main bundle lean)
    const boot = async () => {
      if (player || booting || !acquireContext('services', 2, release)) return
      booting = true
      const mod = await import('@/components/webgl/FrameSequence')
      booting = false
      if (cancelled) return
      cvEl = mountCanvas(cv)
      player = mod.FramePlayer.create(cvEl)
      if (!player) return
      source ??= (await mod.loadManifest(mobile)) ?? new mod.ProceduralFrameSource(mobile ? 120 : 240, mobile ? 960 : 1600, mobile ? 1200 : 900)
      await source.ready
      if (cancelled) return
      const r = cv.getBoundingClientRect()
      player.resize(r.width, r.height, Math.min(devicePixelRatio, mobile ? 1.5 : 2))
      frameTarget = reduced ? source.count - 1 : frameTarget
      frameCur = frameTarget
      player.draw(source, frameCur, invert)
    }

    const release = () => {
      player?.dispose()
      player = null
      cvEl?.remove()
      cvEl = null
      releaseContext('services')
    }
    const ro = new ResizeObserver(() => {
      const r = cv.getBoundingClientRect()
      player?.resize(r.width, r.height, Math.min(devicePixelRatio, mobile ? 1.5 : 2))
      if (player && source) player.draw(source, frameCur, invert)
    })
    ro.observe(cv)

    // Mount the WebGL player only while near the viewport.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void boot()
        else release()
      },
      { rootMargin: '100% 0px 100% 0px' },
    )
    io.observe(el)

    if (reduced) {
      // Static end state: formed cards, dark palette, no pin.
      el.dataset.static = 'true'
      measure()
      cards.forEach((c, i) => {
        c.style.opacity = '1'
        const b = borders[i]
        if (b) b.style.strokeDashoffset = '0'
      })
    } else {
      whenTransitionComplete().then(() => {
        if (cancelled) return
        measure()
        const proxy = { p: 0 }
        tween = gsap.to(proxy, {
          p: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: () => `+=${(mobile ? 1.5 : 3) * innerHeight}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            onRefresh: measure,
            onToggle: (self) => {
              active = self.isActive
              if (active) start()
              else audio.setBed(0)
            },
          },
          onUpdate: () => {
            apply(proxy.p)
            start()
          },
        })
        st = tween.scrollTrigger ?? null
        apply(0)
      })
    }

    return () => {
      cancelled = true
      io.disconnect()
      ro.disconnect()
      unsub?.()
      st?.kill()
      tween?.kill()
      audio.setBed(0)
      release()
      source?.dispose()
    }
  }, [])

  return (
    <section ref={section} className={styles.services} aria-labelledby="services-title" id="services">
      <div ref={canvas} className={styles.canvas} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={`container ${styles.head}`}>
          <span className="t-label">03 — Services</span>
          <h2 id="services-title" className={`t-h1 ${styles.title}`} data-title="" aria-label={TITLE}>
            {TITLE.split(' ').map((word, wi) => (
              <span key={wi} className={styles.word} aria-hidden="true">
                {Array.from(word).map((ch, ci) => (
                  <span key={ci} data-glyph="" className={styles.glyph}>
                    {ch}
                  </span>
                ))}
                {' '}
              </span>
            ))}
          </h2>
        </div>
        <ul className={`container ${styles.cards}`}>
          {SERVICES.map((s) => (
            <li key={s.id} data-card="" className={styles.card}>
              <svg className={styles.border} aria-hidden="true" preserveAspectRatio="none">
                <rect x="0.5" y="0.5" width="100%" height="100%" rx="8" ry="8" pathLength={1} />
              </svg>
              <TransitionLink href={`/services/#${s.id}`} className={styles.cardLink}>
                <span className={`t-label ${styles.idx}`}>{s.index}</span>
                <span className={`t-h3 ${styles.cardTitle}`}>
                  <RollingText>{s.title}</RollingText>
                </span>
                <span className={styles.short}>{s.short}</span>
                <span className={`t-label ${styles.covers}`}>{s.covers.join(' · ')}</span>
                <span className={styles.cardArrow}>
                  <Arrow />
                </span>
              </TransitionLink>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.stripes} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} data-stripe="" />
        ))}
      </div>
    </section>
  )
}
