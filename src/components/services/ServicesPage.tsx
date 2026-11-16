'use client'
import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { subscribe } from '@/lib/motion/engine'
import { DUR, EASE, STAGGER } from '@/lib/motion/tokens'
import { prefersReduced } from '@/lib/motion/hooks'
import { acquireContext, hasWebGL, isMobile, quality, releaseContext } from '@/lib/webgl/capabilities'
import { PROCESS, SERVICES, TECH_STACK } from '@/lib/content/site'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import { Magnetic } from '@/components/primitives/Magnetic'
import { TiltCard } from '@/components/primitives/TiltCard'
import { TransitionLink } from '@/components/system/TransitionLink'
import { CorePoster } from '@/components/webgl/CorePoster'
import type { Swarm } from '@/components/webgl/Swarm'
import styles from './ServicesPage.module.css'

function SwarmHero() {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const h = host.current
    const cv = canvas.current
    if (!h || !cv) return
    if (!hasWebGL()) {
      h.dataset.webgl = 'off'
      return
    }
    const reduced = prefersReduced()
    let swarm: Swarm | null = null
    let unsub: (() => void) | null = null
    let cancelled = false
    let visible = true
    const loop = () => {
      if (reduced || !swarm) return
      unsub ??= subscribe((f) => {
        swarm?.render(f.time, f.dt)
        quality.sample(f.dt)
      })
    }
    const stop = () => {
      unsub?.()
      unsub = null
    }
    if (!acquireContext('swarm', 3, () => { stop(); swarm?.dispose(); swarm = null })) return
    void import('@/components/webgl/Swarm').then(({ Swarm }) => {
      if (cancelled) return
      swarm = new Swarm(cv, isMobile() ? 6000 : 12000)
      const r = h.getBoundingClientRect()
      swarm.resize(r.width, r.height)
      swarm.render(0, 1 / 60)
      if (visible) loop()
    })
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting
      if (visible) loop()
      else stop()
    })
    io.observe(h)
    const ro = new ResizeObserver(() => {
      const r = h.getBoundingClientRect()
      swarm?.resize(r.width, r.height)
    })
    ro.observe(h)
    const onMove = (e: PointerEvent) => {
      const r = h.getBoundingClientRect()
      swarm?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1), true)
    }
    const onLeave = () => swarm?.setPointer(0, 0, false)
    h.addEventListener('pointermove', onMove)
    h.addEventListener('pointerdown', onMove)
    h.addEventListener('pointerleave', onLeave)
    h.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && onLeave())
    return () => {
      cancelled = true
      io.disconnect()
      ro.disconnect()
      h.removeEventListener('pointermove', onMove)
      h.removeEventListener('pointerdown', onMove)
      h.removeEventListener('pointerleave', onLeave)
      stop()
      swarm?.dispose()
      releaseContext('swarm')
    }
  }, [])

  return (
    <section className={styles.hero} aria-labelledby="services-h1">
      <div ref={host} className={styles.swarm} data-cursor="drag" data-cursor-label="Attract">
        <canvas ref={canvas} aria-hidden="true" />
        <CorePoster className={styles.poster} />
      </div>
      <div className={`container ${styles.heroCopy}`}>
        <span className="t-label t-dim">Services — six disciplines</span>
        <SplitReveal as="h1" id="services-h1" mode="chars" trigger="gate" className="t-mega">
          Built to hold formation.
        </SplitReveal>
        <p className={`t-body-lg ${styles.heroLede}`}>
          Website design and development, software and applications, brand, film and growth — one senior squad, one
          standard of engineering.
        </p>
      </div>
    </section>
  )
}

function Accordion() {
  const [open, setOpen] = useState<number>(0)
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    refs.current.forEach((panel, i) => {
      if (!panel) return
      const items = panel.querySelectorAll('li')
      const reduced = prefersReduced()
      if (i === open) {
        gsap.to(panel, { height: 'auto', duration: reduced ? 0 : DUR.base, ease: EASE.inOutQuint })
        if (!reduced) gsap.fromTo(items, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.base, ease: EASE.outExpo, stagger: STAGGER.grid, delay: 0.15 })
      } else {
        gsap.to(panel, { height: 0, duration: reduced ? 0 : DUR.base, ease: EASE.inOutQuint })
      }
    })
  }, [open])

  return (
    <ul className={`dim-rest ${styles.acc}`}>
      {TECH_STACK.map((g, i) => {
        const isOpen = open === i
        return (
          <li key={g.group} className={`dim-item ${styles.accRow}`} data-open={isOpen}>
            <h3>
              <button
                type="button"
                className={styles.accBtn}
                aria-expanded={isOpen}
                aria-controls={`acc-${i}`}
                id={`accb-${i}`}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                <span className="t-label t-dim">{g.index}</span>
                <span className="t-h2">
                  <RollingText>{g.group}</RollingText>
                </span>
                <span className={styles.plus} aria-hidden="true" />
              </button>
            </h3>
            <div
              id={`acc-${i}`}
              role="region"
              aria-labelledby={`accb-${i}`}
              ref={(el) => {
                refs.current[i] = el
              }}
              className={styles.accPanel}
              style={{ height: i === 0 ? 'auto' : 0 }}
            >
              <ul className={styles.chips}>
                {g.items.map((it) => (
                  <li key={it} className="t-label">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Process() {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const line = root.current?.querySelector('[data-line]')
      if (!line) return
      if (prefersReduced()) {
        gsap.set(line, { drawSVG: '100%' })
        return
      }
      gsap.fromTo(line, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', scrollTrigger: { trigger: root.current, start: 'top 70%', end: 'bottom 60%', scrub: 1 } })
      root.current?.querySelectorAll('[data-step]').forEach((s) => {
        gsap.fromTo(s.querySelector('[data-dot]'), { scale: 0 }, { scale: 1, ease: EASE.snap, duration: DUR.base, scrollTrigger: { trigger: s, start: 'top 65%', once: true } })
      })
    },
    { scope: root },
  )
  return (
    <div ref={root} className={styles.process}>
      <svg className={styles.processLine} viewBox="0 0 2 100" preserveAspectRatio="none" aria-hidden="true">
        <line data-line="" x1="1" y1="0" x2="1" y2="100" />
      </svg>
      <ol>
        {PROCESS.map((p) => (
          <li key={p.index} data-step="" className={styles.step}>
            <span data-dot="" className={styles.dot} aria-hidden="true" />
            <span className="t-label t-dim">{p.index}</span>
            <h3 className="t-h1">{p.title}</h3>
            <p className="t-body-lg t-dim">{p.body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function ServicesPage() {
  return (
    <>
      <SwarmHero />
      <section className="section">
        <div className="container">
          <Eyebrow index="01" label="Disciplines" />
          <ul className={`dim-rest dim-rest--cards ${styles.grid}`}>
            {SERVICES.map((s) => (
              <li key={s.id} id={s.id} className="dim-item">
                <TiltCard className={styles.card}>
                  <span className="t-label t-dim">{s.index}</span>
                  <h2 className="t-h2">{s.title}</h2>
                  <p className="t-dim">{s.body}</p>
                  <ul className={styles.covers}>
                    {s.covers.map((c) => (
                      <li key={c} className="t-label">
                        {c}
                      </li>
                    ))}
                  </ul>
                  <span className="t-label t-dim">{s.stack.join(' · ')}</span>
                </TiltCard>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <Eyebrow index="02" label="Tech stack" />
          <Accordion />
        </div>
      </section>
      <section className="section">
        <div className="container">
          <Eyebrow index="03" label="Process" />
          <Process />
          <div className={styles.cta}>
            <Magnetic>
              <TransitionLink href="/#contact" className="btn btn--signal">
                <RollingText>Start with a calibration sprint</RollingText>
                <Arrow />
              </TransitionLink>
            </Magnetic>
          </div>
        </div>
      </section>
    </>
  )
}
