'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { subscribe } from '@/lib/motion/engine'
import { isCoarse, prefersReduced } from '@/lib/motion/hooks'
import { damp } from '@/lib/motion/tokens'
import styles from './TiltCard.module.css'

/**
 * §10.7 3D tilt + §10.6 card lift. perspective 1200px, ±7°, lerp 0.14,
 * cursor-tracked radial specular, 1px border that brightens on hover.
 * The tick only runs while hovered or settling back to rest.
 */
export function TiltCard({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || isCoarse() || prefersReduced()) return
    const s = { rx: 0, ry: 0, lift: 0, mx: 50, my: 50 }
    const t = { rx: 0, ry: 0, lift: 0, mx: 50, my: 50 }
    let unsub: (() => void) | null = null
    let rect = el.getBoundingClientRect()

    const tick = (f: { dt: number }) => {
      const k = damp(0.14, f.dt)
      s.rx += (t.rx - s.rx) * k
      s.ry += (t.ry - s.ry) * k
      s.lift += (t.lift - s.lift) * k
      s.mx += (t.mx - s.mx) * k
      s.my += (t.my - s.my) * k
      el.style.transform = `perspective(1200px) translate3d(0, ${(-6 * s.lift).toFixed(2)}px, 0) rotateX(${s.rx.toFixed(3)}deg) rotateY(${s.ry.toFixed(3)}deg)`
      el.style.setProperty('--mx', `${s.mx.toFixed(1)}%`)
      el.style.setProperty('--my', `${s.my.toFixed(1)}%`)
      el.style.setProperty('--lift', s.lift.toFixed(3))
      const settled = t.lift === 0 && Math.abs(s.rx) + Math.abs(s.ry) + s.lift < 0.01
      if (settled) {
        el.style.transform = ''
        el.style.willChange = ''
        unsub?.()
        unsub = null
      }
    }
    const onEnter = () => {
      rect = el.getBoundingClientRect()
      t.lift = 1
      el.style.willChange = 'transform'
      unsub ??= subscribe(tick)
    }
    const onMove = (e: PointerEvent) => {
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      t.ry = (px - 0.5) * 2 * max
      t.rx = -(py - 0.5) * 2 * max
      t.mx = px * 100
      t.my = py * 100
    }
    const onLeave = () => {
      t.rx = 0
      t.ry = 0
      t.lift = 0
    }
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      unsub?.()
    }
  }, [max])

  return (
    <div ref={ref} className={`${styles.card} ${className ?? ''}`}>
      <span className={styles.spec} aria-hidden="true" />
      {children}
    </div>
  )
}
