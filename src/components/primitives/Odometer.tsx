'use client'
import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { DUR, ease as E } from '@/lib/motion/tokens'
import { whenTransitionComplete } from '@/lib/motion/store'
import { prefersReduced } from '@/lib/motion/hooks'
import styles from './Odometer.module.css'

/**
 * §10.10 Split-flap / odometer counter. Each digit is a reel of 0–9 ×2 that
 * translates with a STEPPED, decelerating ease — discrete digit ticks that
 * slow toward rest. Leading zeros are preserved ("03.2M+"). Non-digits are
 * static glyphs. Fires once at 70% viewport.
 */
export function Odometer({ value, className, delay = 0 }: { value: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reels = Array.from(el.querySelectorAll<HTMLElement>('[data-reel]'))
    const reduced = prefersReduced()
    let st: ScrollTrigger | null = null
    let cancelled = false
    const tweens: gsap.core.Tween[] = []

    reels.forEach((r) => {
      gsap.set(r, { yPercent: 0 })
    })
    const fire = () => {
      reels.forEach((r, i) => {
        const digit = Number(r.dataset.reel)
        const steps = 10 + digit // roll through one full revolution, then land
        const target = -(steps / 20) * 100
        if (reduced) {
          gsap.set(r, { yPercent: target })
          return
        }
        tweens.push(
          gsap.to(r, {
            yPercent: target,
            duration: DUR.epic - 0.4 + i * 0.12,
            delay: delay + i * 0.06,
            // Stepped + decelerating: quantise an expo-out curve to whole digits.
            ease: (t: number) => Math.round(E.outExpo(t) * steps) / steps,
          }),
        )
      })
    }
    whenTransitionComplete().then(() => {
      if (cancelled) return
      st = ScrollTrigger.create({ trigger: el, start: 'top 70%', once: true, onEnter: fire })
    })
    return () => {
      cancelled = true
      st?.kill()
      tweens.forEach((t) => t.kill())
    }
  }, [value, delay])

  return (
    <span ref={ref} className={`${styles.odo} ${className ?? ''}`} aria-label={value} role="text">
      {Array.from(value).map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className={styles.window} aria-hidden="true">
            <span className={styles.reel} data-reel={ch}>
              {Array.from({ length: 20 }, (_, k) => (
                <span key={k}>{k % 10}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} className={styles.glyph} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  )
}
