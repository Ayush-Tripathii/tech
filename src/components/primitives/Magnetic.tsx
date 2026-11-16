'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { gsap } from '@/lib/gsap'
import { subscribe } from '@/lib/motion/engine'
import { DUR, EASE, damp } from '@/lib/motion/tokens'
import { isCoarse, prefersReduced } from '@/lib/motion/hooks'

/**
 * §10.2 Magnetic — the inner element translates toward the cursor at
 * `strength` within a 1.5× bounding radius (lerp 0.15) and snaps back with
 * ease-snap on leave. The outer wrapper is never transformed, so its rect is
 * a stable measurement source (no feedback loop).
 */
export function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: ReactNode
  strength?: number
  className?: string
}) {
  const wrap = useRef<HTMLSpanElement>(null)
  const inner = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const w = wrap.current
    const el = inner.current
    if (!w || !el || isCoarse() || prefersReduced()) return
    const s = { x: 0, y: 0 }
    let engaged = false
    let unsub: (() => void) | null = null
    let snap: gsap.core.Tween | null = null
    const apply = () => {
      el.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0)`
    }
    const tick = (f: { pointer: { x: number; y: number; active: boolean }; dt: number }) => {
      if (!f.pointer.active) return
      const r = w.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = f.pointer.x - cx
      const dy = f.pointer.y - cy
      const inside = Math.abs(dx) < r.width * 0.75 && Math.abs(dy) < r.height * 0.75
      if (inside) {
        if (!engaged) {
          engaged = true
          snap?.kill()
          el.style.willChange = 'transform'
        }
        const k = damp(0.15, f.dt)
        s.x += (dx * strength - s.x) * k
        s.y += (dy * strength - s.y) * k
        apply()
      } else if (engaged) {
        engaged = false
        snap = gsap.to(s, {
          x: 0,
          y: 0,
          duration: DUR.base,
          ease: EASE.snap,
          onUpdate: apply,
          onComplete: () => {
            el.style.willChange = ''
          },
        })
      }
    }
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) unsub ??= subscribe(tick)
      else {
        unsub?.()
        unsub = null
      }
    })
    io.observe(w)
    return () => {
      io.disconnect()
      unsub?.()
      snap?.kill()
    }
  }, [strength])

  return (
    <span ref={wrap} className={className} style={{ display: 'inline-block' }}>
      <span ref={inner} style={{ display: 'inline-block' }}>
        {children}
      </span>
    </span>
  )
}
