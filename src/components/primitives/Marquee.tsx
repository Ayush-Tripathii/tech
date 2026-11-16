'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { subscribe } from '@/lib/motion/engine'
import { prefersReduced } from '@/lib/motion/hooks'
import { damp } from '@/lib/motion/tokens'

/**
 * §10.9 Marquee — content duplicated in the DOM for a seamless loop. Speed is
 * modulated by scroll velocity and direction flips with scroll direction.
 * Only ticks while on screen.
 */
export function Marquee({
  children,
  speed = 40,
  className,
  reverse = false,
}: {
  children: ReactNode
  /** px/s at rest */
  speed?: number
  className?: string
  reverse?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    const tr = track.current
    if (!el || !tr || prefersReduced()) return
    let x = 0
    let dir = reverse ? -1 : 1
    let boost = 0
    let width = 0
    let unsub: (() => void) | null = null
    const measure = () => {
      width = (tr.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(tr)
    const tick = (f: { dt: number; velocity: number; direction: 1 | -1 }) => {
      if (!width) return
      dir = (reverse ? -1 : 1) * f.direction
      boost += (Math.min(Math.abs(f.velocity) * 22, 900) - boost) * damp(0.08, f.dt)
      x -= (speed + boost) * dir * f.dt
      x %= width
      if (x > 0) x -= width
      tr.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`
    }
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        unsub ??= subscribe(tick)
        tr.style.willChange = 'transform'
      } else {
        unsub?.()
        unsub = null
        tr.style.willChange = ''
      }
    })
    io.observe(el)
    return () => {
      io.disconnect()
      ro.disconnect()
      unsub?.()
    }
  }, [speed, reverse])

  return (
    <div ref={root} className={className} style={{ overflow: 'clip', whiteSpace: 'nowrap' }}>
      <div ref={track} style={{ display: 'inline-flex' }}>
        <div style={{ display: 'inline-flex', flex: 'none' }}>{children}</div>
        <div style={{ display: 'inline-flex', flex: 'none' }} aria-hidden="true">
          {children}
        </div>
        <div style={{ display: 'inline-flex', flex: 'none' }} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  )
}
