'use client'
import { useEffect, useRef, useState } from 'react'
import { subscribe, scroll } from '@/lib/motion/engine'
import { atmosphere } from '@/lib/motion/atmosphere'
import { prefersReduced } from '@/lib/motion/hooks'
import { acquireContext, hasWebGL, mountCanvas, releaseContext } from '@/lib/webgl/capabilities'
import { BRAND, NAV } from '@/lib/content/site'
import { TransitionLink } from '@/components/system/TransitionLink'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import { Magnetic } from '@/components/primitives/Magnetic'
import { WireWordmark } from './WireWordmark'
import type { Fog } from '@/components/webgl/Fog'
import styles from './Footer.module.css'

function Clock() {
  const [time, setTime] = useState('--:--:--')
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: BRAND.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const update = () => setTime(fmt.format(new Date()))
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <time className="t-label" suppressHydrationWarning>
      {time} IST
    </time>
  )
}

export function Footer() {
  const root = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLDivElement>(null)

  // Fog: mounted only near the viewport, renders only while visible.
  useEffect(() => {
    const el = root.current
    const cv = canvas.current
    if (!el || !cv || !hasWebGL()) return
    const reduced = prefersReduced()
    let fog: Fog | null = null
    let cvEl: HTMLCanvasElement | null = null
    let unsub: (() => void) | null = null
    let cancelled = false
    const teardown = () => {
      unsub?.()
      unsub = null
      fog?.dispose()
      fog = null
      cvEl?.remove()
      cvEl = null
      releaseContext('fog')
    }
    const size = () => {
      const r = cv.getBoundingClientRect()
      fog?.resize(r.width, r.height)
    }
    const boot = async () => {
      if (fog || !acquireContext('fog', 1, teardown)) return
      const mod = await import('@/components/webgl/Fog')
      if (cancelled) return
      cvEl = mountCanvas(cv)
      fog = mod.Fog.create(cvEl)
      if (!fog) return
      size()
      fog.render(0, 0, 0.5)
      if (reduced) return
      unsub = subscribe((f) => {
        atmosphere.decay(f.dt)
        fog?.render(f.time, atmosphere.energy, atmosphere.x)
      })
    }
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) void boot()
      else teardown()
    })
    io.observe(el)
    const ro = new ResizeObserver(size)
    ro.observe(cv)
    return () => {
      cancelled = true
      io.disconnect()
      ro.disconnect()
      teardown()
    }
  }, [])

  return (
    <footer ref={root} className={styles.footer}>
      <div ref={canvas} className={styles.fog} aria-hidden="true" />
      <div className={`container ${styles.inner}`}>
        <div className={styles.cta}>
          <span className="t-label t-dim">Next</span>
          <TransitionLink href="/#contact" className={`t-h1 ${styles.ctaLink}`}>
            <RollingText>Let’s engineer what’s next</RollingText>
            <Arrow />
          </TransitionLink>
        </div>

        <div className={styles.cols}>
          <nav aria-label="Footer">
            <span className="t-label t-dim">Index</span>
            <ul className="dim-rest">
              {NAV.map((n) => (
                <li key={n.href} className="dim-item">
                  <TransitionLink href={n.href}>
                    <RollingText>{n.label}</RollingText>
                  </TransitionLink>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <span className="t-label t-dim">Social</span>
            <ul className="dim-rest">
              {BRAND.social.map((s) => (
                <li key={s.label} className="dim-item">
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className={styles.social}>
                    <RollingText>{s.label}</RollingText>
                    <Arrow />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="t-label t-dim">Contact</span>
            <ul>
              <li>
                <a href={`mailto:${BRAND.email}`}>
                  <RollingText>{BRAND.email}</RollingText>
                </a>
              </li>
              <li>
                <a href={`tel:${BRAND.phone.replace(/\s/g, '')}`}>
                  <RollingText>{BRAND.phone}</RollingText>
                </a>
              </li>
            </ul>
          </div>
          <div>
            <span className="t-label t-dim">Studio</span>
            <p>
              {BRAND.city}, {BRAND.country}
            </p>
            <Clock />
          </div>
        </div>

        <div className={styles.wordWrap}>
          <WireWordmark />
          <p className={`t-label t-dim ${styles.pluckHint}`} aria-hidden="true">
            ↖ Pluck the strings
          </p>
        </div>

        <div className={styles.legal}>
          <span className="t-label t-dim">
            © {BRAND.founded}–{new Date().getFullYear()} {BRAND.name}. {BRAND.tagline}
          </span>
          <span className="t-label t-dim">{BRAND.coords}</span>
          <Magnetic>
            <button type="button" className="t-label" onClick={() => scroll.to(0, { duration: 2.2 })}>
              <RollingText>Back to top ↑</RollingText>
            </button>
          </Magnetic>
        </div>
      </div>
    </footer>
  )
}
