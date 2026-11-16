'use client'
import { useEffect, useRef, useState } from 'react'
import { coverURL, type CoverSpec } from '@/lib/content/generative'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { DUR, EASE } from '@/lib/motion/tokens'
import { prefersReduced } from '@/lib/motion/hooks'
import { whenTransitionComplete } from '@/lib/motion/store'

/**
 * Generative cover image (no stock). Rendered client-side to a data URL and
 * shown as a real <img> with descriptive alt text. Until it's generated the
 * box shows the project's dominant colour, sized by aspect-ratio (zero CLS).
 */
export function Cover({
  spec,
  alt,
  width = 960,
  height = 640,
  className,
  reveal = false,
  style,
}: {
  spec: CoverSpec
  alt: string
  width?: number
  height?: number
  className?: string
  /** §10.5 Image reveal — clip-path inset 100%→0 with a 1.1→1 counter-scale. */
  reveal?: boolean
  style?: React.CSSProperties
}) {
  const [src, setSrc] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setSrc(coverURL(spec, width, height))
  }, [spec, width, height])

  useEffect(() => {
    if (!reveal || !box.current || !img.current) return
    const b = box.current
    const i = img.current
    if (prefersReduced()) return
    gsap.set(b, { clipPath: 'inset(100% 0% 0% 0%)' })
    gsap.set(i, { scale: 1.1 })
    let st: ScrollTrigger | null = null
    let cancelled = false
    whenTransitionComplete().then(() => {
      if (cancelled) return
      st = ScrollTrigger.create({
        trigger: b,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(b, { clipPath: 'inset(0% 0% 0% 0%)', duration: DUR.cine, ease: EASE.inOutQuint })
          gsap.to(i, { scale: 1, duration: DUR.cine, ease: EASE.outExpo })
        },
      })
    })
    return () => {
      cancelled = true
      st?.kill()
    }
  }, [reveal])

  return (
    <div
      ref={box}
      className={className}
      style={{ aspectRatio: `${width} / ${height}`, background: spec.color, overflow: 'hidden', ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src ?? 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: src ? 1 : 0, transition: 'opacity .6s var(--ease-out-quart)' }}
      />
    </div>
  )
}
