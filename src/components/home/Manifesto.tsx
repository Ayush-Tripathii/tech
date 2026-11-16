'use client'
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import { BlurTextReveal } from '@/components/primitives/BlurTextReveal'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Marquee } from '@/components/primitives/Marquee'
import { prefersReduced } from '@/lib/motion/hooks'
import { BRAND } from '@/lib/content/site'
import styles from './Manifesto.module.css'

const TICKER = [
  'Website design',
  'Website development',
  'Software development',
  'Application development',
  'Graphic design',
  'Video editing',
  'Digital marketing',
  'Performance marketing',
]

export function Manifesto() {
  const root = useRef<HTMLElement>(null)
  const rule = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!rule.current) return
      if (prefersReduced()) {
        gsap.set(rule.current, { scaleX: 1 })
        return
      }
      gsap.fromTo(
        rule.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          transformOrigin: 'left center',
          scrollTrigger: { trigger: rule.current, start: 'top 95%', end: 'top 45%', scrub: 1 },
        },
      )
    },
    { scope: root },
  )

  return (
    <section ref={root} className={styles.manifesto} aria-labelledby="manifesto-title">
      <div className={styles.seam}>
        <Marquee className={`t-label ${styles.ticker}`} speed={36}>
          {TICKER.map((t) => (
            <span key={t} className={styles.tick}>
              {t}
              <span className={styles.star} aria-hidden="true">
                ✦
              </span>
            </span>
          ))}
        </Marquee>
      </div>

      <div className="container section">
        <Eyebrow index="01" label="Manifesto" />
        <div ref={rule} className={`rule ${styles.rule}`} />

        <div className={styles.grid}>
          <h2 id="manifesto-title" className={`t-h1 ${styles.verbLine}`}>
            <span>We </span>
            <BlurTextReveal items={BRAND.verbs} className={styles.verb} />
            <span> the unforgettable.</span>
          </h2>
          <SplitReveal as="p" mode="lines" className={`t-h2 ${styles.statement}`}>
            GBGTech is an engineering-led studio. We build websites, software and applications that hold formation
            under pressure — and only break apart when we tell them to.
          </SplitReveal>
          <SplitReveal as="p" mode="lines" className={`t-body-lg t-dim ${styles.aside}`}>
            Since {BRAND.founded}, a small senior team in {BRAND.city} has shipped products for enterprises and
            startups across four continents. No handoffs between strategy, design and code: one squad, one standard.
          </SplitReveal>
        </div>
      </div>
    </section>
  )
}
