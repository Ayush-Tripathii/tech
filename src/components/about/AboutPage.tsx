'use client'
import { useEffect, useRef, useState } from 'react'
import { gsap, Draggable } from '@/lib/gsap'
import { subscribe } from '@/lib/motion/engine'
import { EVENTS } from '@/lib/motion/store'
import { prefersReduced } from '@/lib/motion/hooks'
import { audio } from '@/lib/audio/AudioManager'
import { acquireContext, hasWebGL, releaseContext } from '@/lib/webgl/capabilities'
import { coverCanvas, dominantColor, mulberry32 } from '@/lib/content/generative'
import { BRAND, CULTURE, TEAM } from '@/lib/content/site'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Odometer } from '@/components/primitives/Odometer'
import type { DepthPortrait } from '@/components/webgl/DepthPortrait'
import styles from './AboutPage.module.css'

const STRIPS = 8
const STIFFNESS = 0.08
const DAMPING = 0.86

/** Depth-mapped portrait + draggable curtain strips (per-strip spring physics). */
function Portrait() {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  // Shader
  useEffect(() => {
    const h = host.current
    const cv = canvas.current
    if (!h || !cv || !hasWebGL()) return
    let p: DepthPortrait | null = null
    let unsub: (() => void) | null = null
    let cancelled = false
    const reduced = prefersReduced()
    if (!acquireContext('portrait', 3, () => { unsub?.(); p?.dispose(); p = null })) return
    void import('@/components/webgl/DepthPortrait').then(async ({ DepthPortrait }) => {
      const inst = await DepthPortrait.create(cv)
      if (cancelled || !inst) {
        inst?.dispose()
        return
      }
      p = inst
      const r = h.getBoundingClientRect()
      p.resize(r.width, r.height)
      p.render(0, 1 / 60)
      if (!reduced) unsub = subscribe((f) => p?.render(f.time, f.dt))
    })
    const onMove = (e: PointerEvent) => {
      const r = h.getBoundingClientRect()
      p?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
    }
    const onLeave = () => p?.setPointer(0, 0)
    window.addEventListener('pointermove', onMove, { passive: true })
    h.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => {
      const r = h.getBoundingClientRect()
      p?.resize(r.width, r.height)
    })
    ro.observe(h)
    return () => {
      cancelled = true
      unsub?.()
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      h.removeEventListener('pointerleave', onLeave)
      p?.dispose()
      releaseContext('portrait')
    }
  }, [])

  // Curtains — gated behind the hero headline's reveal (never two set-pieces at once).
  useEffect(() => {
    const h = host.current
    if (!h) return
    const strips = Array.from(h.querySelectorAll<HTMLElement>('[data-strip]'))
    const reduced = prefersReduced()
    const sim = strips.map(() => ({ y: 0, v: 0, target: 0, dragging: false, open: false }))
    let height = h.offsetHeight
    let unsub: (() => void) | null = null
    let armed = false
    const tick = (f: { dt: number }) => {
      const steps = Math.max(1, Math.round(f.dt * 60))
      let moving = false
      sim.forEach((s, i) => {
        if (!s.dragging) {
          for (let k = 0; k < steps; k++) {
            s.v += (s.target - s.y) * STIFFNESS
            s.v *= DAMPING
            s.y += s.v
          }
        }
        strips[i]!.style.transform = `translate3d(0, ${s.y.toFixed(2)}px, 0)`
        if (s.dragging || Math.abs(s.v) > 0.05 || Math.abs(s.target - s.y) > 0.5) moving = true
      })
      if (!moving) {
        unsub?.()
        unsub = null
      }
    }
    const wake = () => (unsub ??= subscribe(tick))

    const intro = () => {
      if (armed) return
      armed = true
      h.dataset.armed = 'true'
      if (reduced) {
        sim.forEach((s) => {
          s.target = -height
          s.y = -height
          s.open = true
        })
        strips.forEach((st) => (st.style.transform = `translate3d(0, ${-height}px, 0)`))
        return
      }
      // synchronized sequence: strips lift in turn, one ascending note each, then settle as a tease
      sim.forEach((s, i) => {
        window.setTimeout(() => {
          s.target = -height * 0.16
          audio.pluck(i % 8, 0.45)
          wake()
          window.setTimeout(() => {
            if (!s.dragging && !s.open) {
              s.target = 0
              wake()
            }
          }, 520)
        }, i * 90)
      })
    }
    window.addEventListener(EVENTS.HERO_REVEALED, intro)
    // Safety: if the headline already revealed (fast nav), arm after a beat.
    const fallback = window.setTimeout(intro, 4500)

    let active = -1
    let startY = 0
    let startPos = 0
    const onDown = (e: PointerEvent) => {
      if (!armed) return
      const t = (e.target as Element).closest<HTMLElement>('[data-strip]')
      if (!t) return
      active = strips.indexOf(t)
      const s = sim[active]!
      s.dragging = true
      startY = e.clientY
      startPos = s.y
      t.setPointerCapture(e.pointerId)
      wake()
    }
    const onMove = (e: PointerEvent) => {
      if (active < 0) return
      const s = sim[active]!
      s.y = Math.min(0, startPos + (e.clientY - startY))
    }
    const onUp = () => {
      if (active < 0) return
      const s = sim[active]!
      s.dragging = false
      const wasOpen = s.open
      s.open = s.y < -height * 0.3
      s.target = s.open ? -height : 0
      if (s.open !== wasOpen) audio.pluck(s.open ? 7 - (active % 8) : active % 8, 0.7)
      active = -1
      wake()
    }
    const onResize = () => {
      height = h.offsetHeight
      sim.forEach((s) => {
        if (s.open) s.target = -height
      })
      wake()
    }
    h.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('resize', onResize)
    return () => {
      unsub?.()
      window.clearTimeout(fallback)
      window.removeEventListener(EVENTS.HERO_REVEALED, intro)
      h.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div ref={host} className={styles.portrait} data-cursor="drag" data-cursor-label="Peel">
      <canvas ref={canvas} className={styles.portraitCanvas} role="img" aria-label="A studio render of the GBGTech Lattice Core, parallaxing with the cursor" />
      <div className={styles.strips} aria-hidden="true">
        {Array.from({ length: STRIPS }, (_, i) => (
          <div key={i} data-strip="" className={styles.strip}>
            <span className="t-label">{String(i + 1).padStart(2, '0')}</span>
          </div>
        ))}
      </div>
      <p className={`t-label ${styles.peelHint}`} aria-hidden="true">
        ↑ Drag the strips
      </p>
    </div>
  )
}

function Team() {
  const area = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const a = area.current
    if (!a || prefersReduced()) return
    const cards = Array.from(a.querySelectorAll<HTMLElement>('[data-team]'))
    const ds = Draggable.create(cards, {
      type: 'x,y',
      bounds: a,
      inertia: true,
      edgeResistance: 0.75,
      zIndexBoost: true,
      onPress() {
        gsap.to(this.target, { scale: 1.04, duration: 0.3, ease: 'gbg.outQuart' })
        audio.click()
      },
      onRelease() {
        gsap.to(this.target, { scale: 1, duration: 0.6, ease: 'gbg.snap' })
      },
    })
    return () => ds.forEach((d) => d.kill())
  }, [])
  return (
    <div ref={area} className={styles.teamArea}>
      {TEAM.map((t, i) => (
        <article
          key={t.name}
          data-team=""
          className={styles.teamCard}
          data-cursor="drag"
          data-cursor-label="Drag"
          style={{ ['--hue' as string]: String(t.hue), left: `${6 + (i % 3) * 31}%`, top: `${8 + Math.floor(i / 3) * 46}%`, rotate: `${(i % 2 ? 1 : -1) * (2 + i)}deg` }}
        >
          <div className={styles.avatar} aria-hidden="true">
            {t.initials}
          </div>
          <h3 className="t-h3">{t.name}</h3>
          <p className="t-label t-dim">{t.role}</p>
        </article>
      ))}
    </div>
  )
}

const WALL_COLORS = ['#1E3A8A', '#7C2D12', '#065F46', '#4C1D95', '#9F1239', '#0E7490', '#365314', '#3F3F46', '#1D4ED8', '#78350F']
const WALL_ACCENTS = ['#93C5FD', '#FB923C', '#34D399', '#A78BFA', '#FB7185', '#22D3EE', '#A3E635', '#E5E7EB', '#60A5FA', '#FBBF24']

interface Placed {
  x: number
  y: number
  w: number
  h: number
}

/** Culture scatter-wall: rejection sampling (max 40 attempts), grid fallback. */
function Culture() {
  const wall = useRef<HTMLDivElement>(null)
  const [placed, setPlaced] = useState<Placed[]>([])
  const [srcs, setSrcs] = useState<string[]>([])
  const colors = useRef<string[]>([])

  useEffect(() => {
    const canv = CULTURE.map((c, i) => coverCanvas({ seed: c.seed, color: WALL_COLORS[i % WALL_COLORS.length]!, accent: WALL_ACCENTS[i % WALL_ACCENTS.length]! }, 480, 360))
    colors.current = canv.map((c) => dominantColor(c))
    setSrcs(canv.map((c) => c.toDataURL('image/webp', 0.85)))
  }, [])

  useEffect(() => {
    const w = wall.current
    if (!w) return
    const layout = () => {
      const W = w.clientWidth
      const H = w.clientHeight
      const rnd = mulberry32(77)
      const out: Placed[] = []
      const pad = 16
      const cols = W < 700 ? 2 : 4
      CULTURE.forEach((_, i) => {
        const iw = W * (W < 700 ? 0.42 : 0.16 + rnd() * 0.1)
        const ih = iw * 0.75
        let ok: Placed | null = null
        for (let a = 0; a < 40 && !ok; a++) {
          const cand = { x: rnd() * (W - iw), y: rnd() * (H - ih), w: iw, h: ih }
          const hit = out.some((r) => cand.x < r.x + r.w + pad && cand.x + cand.w + pad > r.x && cand.y < r.y + r.h + pad && cand.y + cand.h + pad > r.y)
          if (!hit) ok = cand
        }
        if (!ok) {
          // grid fallback
          const cw = W / cols
          ok = { x: (i % cols) * cw + pad / 2, y: Math.floor(i / cols) * (cw * 0.75 + pad), w: cw - pad, h: (cw - pad) * 0.75 }
        }
        out.push(ok)
      })
      setPlaced(out)
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(w)
    return () => ro.disconnect()
  }, [])

  const tint = (i: number | null) => {
    const w = wall.current
    if (!w) return
    w.style.setProperty('--tint', i === null ? 'var(--bg-void)' : colors.current[i] ?? 'var(--bg-void)')
  }

  return (
    <div ref={wall} className={`${styles.wall} dim-rest`} onPointerLeave={() => tint(null)}>
      {CULTURE.map((c, i) => {
        const p = placed[i]
        return (
          <figure
            key={c.label}
            className={`dim-item ${styles.shot}`}
            style={p ? { left: p.x, top: p.y, width: p.w, height: p.h } : { visibility: 'hidden' }}
            onPointerEnter={() => tint(i)}
            data-cursor="media"
            data-cursor-label="Look"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {srcs[i] && <img src={srcs[i]} alt={`${c.label} — generative studio artwork`} />}
            <figcaption className="t-label">{c.label}</figcaption>
          </figure>
        )
      })}
    </div>
  )
}

export function AboutPage() {
  return (
    <>
      <section className={`container ${styles.hero}`} aria-labelledby="about-h1">
        <div className={styles.heroCopy}>
          <span className="t-label t-dim">About — est. {BRAND.founded}, {BRAND.city}</span>
          <SplitReveal as="h1" id="about-h1" mode="chars" trigger="gate" className="t-mega" doneEvent={EVENTS.HERO_REVEALED}>
            Engineers who design.
          </SplitReveal>
          <SplitReveal as="p" mode="lines" trigger="gate" delay={0.4} className="t-body-lg t-dim">
            GBGTech began in {BRAND.city} in {BRAND.founded} with a simple rule: the people who design a product should
            understand how it is built, and the people who build it should care how it feels.
          </SplitReveal>
        </div>
        <Portrait />
      </section>

      <section className="section">
        <div className="container">
          <Eyebrow index="01" label="By the numbers" />
          <ul className={styles.nums}>
            {[
              ['006', 'Years engineering'],
              ['032', 'People in the studio'],
              ['011', 'Countries served'],
              ['140+', 'Products shipped'],
            ].map(([v, l]) => (
              <li key={l}>
                <Odometer value={v!} className="t-h1" />
                <span className="t-label t-dim">{l}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Eyebrow index="02" label="Leadership — drag them around" />
          <Team />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Eyebrow index="03" label="Culture" />
          <SplitReveal as="h2" mode="lines" className={`t-h1 ${styles.cultureTitle}`}>
            Calm studio. Loud results.
          </SplitReveal>
          <Culture />
        </div>
      </section>
    </>
  )
}
