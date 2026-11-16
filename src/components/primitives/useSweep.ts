'use client'
import { useEffect, type RefObject } from 'react'
import { ScrollTrigger } from '@/lib/gsap'
import { whenTransitionComplete } from '@/lib/motion/store'

/**
 * §10.12 Spectrum sweep — the site's signature "charge" tell. A thin spectrum
 * line sweeps across the element ONCE on enter. Add class `sweep` to the element.
 */
export function useSweep(ref: RefObject<HTMLElement | null>, start = 'top 85%') {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let st: ScrollTrigger | null = null
    let cancelled = false
    whenTransitionComplete().then(() => {
      if (cancelled) return
      st = ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => el.classList.add('is-swept') })
    })
    return () => {
      cancelled = true
      st?.kill()
    }
  }, [ref, start])
}
