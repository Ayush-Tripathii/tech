'use client'
import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { useMotion } from '@/lib/motion/store'
import { scroll } from '@/lib/motion/engine'
import { EASE, DUR } from '@/lib/motion/tokens'
import { prefersReduced } from '@/lib/motion/hooks'
import { BRAND, NAV } from '@/lib/content/site'
import { TransitionLink } from './TransitionLink'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import styles from './MenuOverlay.module.css'

/**
 * Menu overlay: circular clip-path expanding from the hamburger's exact
 * coordinates (0.8s ease-in-out-quint), nav items revealing on a 0.06 stagger,
 * an animated lattice field fading in behind. Focus-trapped, Esc closes.
 * The background is Canvas2D so it never competes for the 2-context WebGL budget.
 */
export function MenuOverlay({ origin, onClose }: { origin: { x: number; y: number }; onClose: () => void }) {
  const open = useMotion((s) => s.menuOpen)
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const first = useRef(true)

  useEffect(() => {
    const el = root.current
    if (!el) return
    if (first.current) {
      first.current = false
      if (!open) return
    }
    const items = el.querySelectorAll<HTMLElement>('[data-item]')
    const reduced = prefersReduced()
    const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))
    const tl = gsap.timeline()
    if (open) {
      scroll.lock()
      el.style.visibility = 'visible'
      if (reduced) {
        tl.fromTo(el, { opacity: 0, clipPath: 'none' }, { opacity: 1, duration: 0.2 })
      } else {
        tl.fromTo(
          el,
          { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` },
          { clipPath: `circle(${r}px at ${origin.x}px ${origin.y}px)`, duration: 0.8, ease: EASE.inOutQuint },
        )
        tl.fromTo(items, { yPercent: 110 }, { yPercent: 0, duration: DUR.slow, ease: EASE.outExpo, stagger: 0.06 }, 0.25)
        tl.fromTo(canvas.current, { opacity: 0 }, { opacity: 1, duration: DUR.cine, ease: 'none' }, 0.2)
      }
      tl.call(() => el.querySelector<HTMLElement>('a')?.focus())
    } else {
      if (reduced) tl.to(el, { opacity: 0, duration: 0.2 })
      else {
        tl.to(items, { yPercent: -110, duration: DUR.fast, ease: EASE.outQuart, stagger: 0.03 })
        tl.to(el, { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`, duration: 0.6, ease: EASE.inOutQuint }, 0.1)
      }
      tl.call(() => {
        el.style.visibility = 'hidden'
        if (useMotion.getState().phase === 'idle') scroll.unlock()
        onClose()
      })
    }
    return () => {
      tl.kill()
    }
  }, [open, origin, onClose])

  // Focus trap + Esc
  useEffect(() => {
    if (!open) return
    const el = root.current!
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useMotion.getState().set({ menuOpen: false })
        return
      }
      if (e.key !== 'Tab') return
      const focusables = Array.from(el.querySelectorAll<HTMLElement>('a, button'))
      const burger = document.querySelector<HTMLElement>('[aria-controls="menu-overlay"]')
      if (burger) focusables.push(burger)
      if (!focusables.length) return
      const idx = focusables.indexOf(document.activeElement as HTMLElement)
      e.preventDefault()
      const next = e.shiftKey ? (idx <= 0 ? focusables.length - 1 : idx - 1) : (idx + 1) % focusables.length
      focusables[next]?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Lattice field background — only animates while open.
  useEffect(() => {
    if (!open || prefersReduced()) return
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(devicePixelRatio, 1.5)
    const resize = () => {
      c.width = innerWidth * dpr
      c.height = innerHeight * dpr
    }
    resize()
    const pts = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00025,
      vy: (Math.random() - 0.5) * 0.00025,
    }))
    let raf = 0
    const draw = () => {
      const w = c.width
      const h = c.height
      ctx.clearRect(0, 0, w, h)
      for (const p of pts) {
        p.x = (p.x + p.vx + 1) % 1
        p.y = (p.y + p.vy + 1) % 1
      }
      ctx.lineWidth = dpr
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j]!
          const d = Math.hypot((a.x - b.x) * w, (a.y - b.y) * h)
          if (d < 180 * dpr) {
            const al = (1 - d / (180 * dpr)) * 0.22
            ctx.strokeStyle = j % 9 === 0 ? `rgba(34,211,238,${al * 1.6})` : `rgba(244,245,247,${al})`
            ctx.beginPath()
            ctx.moveTo(a.x * w, a.y * h)
            ctx.lineTo(b.x * w, b.y * h)
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
    }
  }, [open])

  const close = () => useMotion.getState().set({ menuOpen: false })

  return (
    <div
      ref={root}
      id="menu-overlay"
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      data-lenis-prevent=""
      inert={!open}
    >
      <canvas ref={canvas} className={styles.bg} aria-hidden="true" />
      <nav aria-label="Menu" className={styles.inner}>
        <ul className={`dim-rest ${styles.list}`}>
          {NAV.map((n, i) => (
            <li key={n.href} className={`dim-item ${styles.row}`}>
              <span className={styles.mask}>
                <TransitionLink href={n.href} data-item="" className={styles.link} onClick={close}>
                  <span className={`t-label t-dim ${styles.idx}`}>0{i + 1}</span>
                  <span className="t-h1">
                    <RollingText>{n.label}</RollingText>
                  </span>
                  <Arrow />
                </TransitionLink>
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.meta}>
          <span className={styles.mask}>
            <a data-item="" href={`mailto:${BRAND.email}`} className="t-label">
              <RollingText>{BRAND.email}</RollingText>
            </a>
          </span>
          <span className={styles.mask}>
            <span data-item="" className="t-label t-dim">
              {BRAND.city}, {BRAND.country} · {BRAND.coords}
            </span>
          </span>
        </div>
      </nav>
    </div>
  )
}
