'use client'
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { useLatticeCore } from '@/components/webgl/useLatticeCore'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import { BlurTextReveal } from '@/components/primitives/BlurTextReveal'
import { Magnetic } from '@/components/primitives/Magnetic'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import { TransitionLink } from '@/components/system/TransitionLink'
import { GuideLines } from './GuideLines'
import { EVENTS } from '@/lib/motion/store'
import { prefersReduced } from '@/lib/motion/hooks'
import { BRAND } from '@/lib/content/site'
import { CorePoster } from '@/components/webgl/CorePoster'
import styles from './Hero.module.css'

export function Hero() {
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const canvasHost = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const core = useLatticeCore(canvas, canvasHost, { id: 'hero', trackLoad: true })

  // Scroll-out: scale .92, blur 0→6px, core recedes on Z while the next section slides over.
  useGSAP(
    () => {
      const el = section.current
      const st = stage.current
      if (!el || !st || prefersReduced()) return
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
          pin: true,
          pinSpacing: false,
          onToggle: (self) => {
            st.style.willChange = self.isActive ? 'transform, filter' : ''
          },
          onUpdate: (self) => core.current?.setScrollOut(self.progress),
        },
      })
      tl.to(st, { scale: 0.92, filter: 'blur(6px)', ease: 'none' }, 0)
      return () => {
        tl.scrollTrigger?.kill()
        tl.kill()
      }
    },
    { scope: section },
  )

  return (
    <section ref={section} className={styles.hero} aria-labelledby="hero-title">
      <div ref={stage} className={styles.stage}>
        {/* Layer A — WebGL (decorative) */}
        <div
          ref={canvasHost}
          className={styles.canvasHost}
          data-cursor="drag"
          data-cursor-label="Drag · Hold"
          tabIndex={0}
          role="img"
          aria-label="The Lattice Core — a faceted glass object. Hold Space or Enter to refract it."
        >
          <div ref={canvas} className={styles.canvas} aria-hidden="true" />
          <CorePoster className={styles.poster} />
        </div>

        <GuideLines />

        {/* Layer B — DOM, mix-blend-mode: difference */}
        <div className={styles.copy}>
          <div className={`container ${styles.top}`}>
            <span className="t-label t-dim">
              (Est. {BRAND.founded}) — {BRAND.city}, IN
            </span>
            <span className={`t-label t-dim ${styles.topRight}`}>
              <BlurTextReveal items={['Enterprise', 'Startups', 'Platforms', 'Products']} start="gate" />
              <span> / Engineering-led studio</span>
            </span>
          </div>

          <div className={`container ${styles.headlineWrap}`}>
            <SplitReveal as="h1" id="hero-title" mode="chars" trigger="gate" delay={0.1} className={`t-mega ${styles.headline}`} doneEvent={EVENTS.HERO_REVEALED}>
              Engineering
              <br />
              the Future.
            </SplitReveal>
          </div>

          <div className={`container ${styles.bottom}`}>
            <SplitReveal as="p" mode="lines" trigger="gate" delay={0.5} className={`t-body-lg ${styles.lede}`}>
              {BRAND.mission} Design, software, applications and growth — built by engineers who sweat the last 1%.
            </SplitReveal>
          </div>
        </div>

        {/* CTAs live outside the difference layer so --signal stays true. */}
        <div className={`container ${styles.actions}`}>
          <div className={styles.ctas}>
            <Magnetic>
              <TransitionLink href="/#contact" className="btn btn--signal">
                <RollingText>Start a project</RollingText>
                <Arrow />
              </TransitionLink>
            </Magnetic>
            <Magnetic>
              <TransitionLink href="/work/" className="btn btn--ghost">
                <RollingText>See the work</RollingText>
                <Arrow direction="e" />
              </TransitionLink>
            </Magnetic>
          </div>
        </div>

        {/* The site teaches its own interactions. */}
        <p className={`t-label t-dim ${styles.cueHold}`} aria-hidden="true">
          <span className={styles.holdGlyph} />
          Hold to refract
        </p>
        <p className={`t-label t-dim ${styles.cueLines}`} aria-hidden="true">
          ⚡ Touch the lines
        </p>
        <div className={styles.scrollCue} aria-hidden="true">
          <span className="t-label t-dim">Scroll</span>
          <span className={styles.scrollBar} />
        </div>
      </div>
    </section>
  )
}

