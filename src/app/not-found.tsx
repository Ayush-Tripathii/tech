'use client'
import { useRef } from 'react'
import { useLatticeCore } from '@/components/webgl/useLatticeCore'
import { CorePoster } from '@/components/webgl/CorePoster'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import { Magnetic } from '@/components/primitives/Magnetic'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import { TransitionLink } from '@/components/system/TransitionLink'

/** 404 — the Lattice Core as a "404" glyph, with the same hold-to-refract. The error page is a reward. */
export default function NotFound() {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  useLatticeCore(canvas, host, { id: 'glyph404', shape: 'glyph404' })

  return (
    <section style={{ position: 'relative', height: '100svh', minHeight: 560, overflow: 'hidden' }} aria-labelledby="nf-title">
      <div
        ref={host}
        style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}
        data-cursor="drag"
        data-cursor-label="Hold"
        tabIndex={0}
        role="img"
        aria-label="404 built from glass lattice panels. Hold Space or Enter to shatter it."
      >
        <div ref={canvas} style={{ position: 'absolute', inset: 0 }} aria-hidden="true" />
      </div>
      <noscript>
        <CorePoster />
      </noscript>
      <div
        className="container"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 'clamp(32px, 8vh, 80px)', display: 'grid', gap: 24, pointerEvents: 'none' }}
      >
        <span className="t-label t-dim">Error 404 — route not found</span>
        <SplitReveal as="h1" id="nf-title" mode="chars" trigger="gate" className="t-h1">
          This page broke formation.
        </SplitReveal>
        <p className="t-label t-dim">Hold anywhere to finish the job — or head back.</p>
        <div style={{ pointerEvents: 'auto' }}>
          <Magnetic>
            <TransitionLink href="/" className="btn btn--signal">
              <RollingText>Back to index</RollingText>
              <Arrow />
            </TransitionLink>
          </Magnetic>
        </div>
      </div>
    </section>
  )
}
