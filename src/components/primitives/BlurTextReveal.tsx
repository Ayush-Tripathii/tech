'use client'
import { useEffect, useRef, useState } from 'react'
import { gsap } from '@/lib/gsap'
import { DUR, EASE, STAGGER } from '@/lib/motion/tokens'
import { whenTransitionComplete } from '@/lib/motion/store'
import { prefersReduced } from '@/lib/motion/hooks'

interface Props {
  /** One item = a one-shot reveal. Several = a rotating cycle. */
  items: readonly string[]
  interval?: number
  className?: string
  /** Start on viewport entry (default) or immediately after the gate. */
  start?: 'inview' | 'gate'
}

/**
 * <BlurTextReveal> — the reusable blur→sharp char reveal. Used for the
 * manifesto rotating verb, stats hints and section eyebrows with different
 * props. All words are stacked in one grid cell, so the box is always as wide
 * as the widest word: zero layout shift while cycling.
 */
export function BlurTextReveal({ items, interval = 2.4, className, start = 'inview' }: Props) {
  const root = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const el = root.current
    if (!el) return
    let cancelled = false
    let timer: number | undefined
    let io: IntersectionObserver | null = null
    const begin = () => {
      if (cancelled) return
      setActive(0)
      if (items.length > 1) {
        timer = window.setInterval(() => setActive((a) => (a + 1) % items.length), interval * 1000)
      }
    }
    whenTransitionComplete().then(() => {
      if (cancelled) return
      if (start === 'gate') begin()
      else {
        io = new IntersectionObserver(([e]) => {
          if (e?.isIntersecting) {
            io?.disconnect()
            begin()
          }
        }, { rootMargin: '0px 0px -15% 0px' })
        io.observe(el)
      }
    })
    return () => {
      cancelled = true
      io?.disconnect()
      if (timer) window.clearInterval(timer)
    }
  }, [items.length, interval, start])

  useEffect(() => {
    const el = root.current
    if (!el || active < 0) return
    const words = Array.from(el.querySelectorAll<HTMLElement>('[data-word]'))
    const reduced = prefersReduced()
    const ctx = gsap.context(() => {
      words.forEach((w, i) => {
        const chars = w.querySelectorAll<HTMLElement>('[data-c]')
        if (i === active) {
          gsap.set(w, { visibility: 'visible' })
          if (reduced) {
            gsap.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.2 })
            return
          }
          gsap.fromTo(
            chars,
            { yPercent: 40, opacity: 0, filter: 'blur(6px)' },
            { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: DUR.slow, ease: EASE.outExpo, stagger: STAGGER.chars * 2, delay: 0.12 },
          )
        } else if (w.style.visibility === 'visible') {
          if (reduced) {
            gsap.to(w, { opacity: 0, duration: 0.2, onComplete: () => void gsap.set(w, { visibility: 'hidden' }) })
            return
          }
          gsap.to(chars, {
            yPercent: -40,
            opacity: 0,
            filter: 'blur(6px)',
            duration: DUR.fast,
            ease: EASE.outQuart,
            stagger: STAGGER.chars,
            onComplete: () => void gsap.set(w, { visibility: 'hidden' }),
          })
        }
      })
    }, el)
    return () => ctx.kill()
  }, [active])

  return (
    <span ref={root} className={className} style={{ display: 'inline-grid', verticalAlign: 'bottom' }}>
      {/* Screen readers get the first word only; the cycle is decorative. */}
      <span className="sr-only">{items[0]}</span>
      {items.map((w, i) => (
        <span
          key={w + i}
          data-word=""
          aria-hidden="true"
          style={{ gridArea: '1 / 1', visibility: 'hidden', whiteSpace: 'nowrap' }}
        >
          {Array.from(w).map((c, j) => (
            <span key={j} data-c="" style={{ display: 'inline-block', whiteSpace: 'pre' }}>
              {c}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}
