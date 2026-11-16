'use client'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Odometer } from '@/components/primitives/Odometer'
import { TiltCard } from '@/components/primitives/TiltCard'
import { BlurTextReveal } from '@/components/primitives/BlurTextReveal'
import { HoverReel } from '@/components/primitives/HoverReel'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import { AWARDS, STATS } from '@/lib/content/site'
import styles from './KeyFacts.module.css'

export function KeyFacts() {
  return (
    <section className={`section ${styles.facts}`} aria-labelledby="facts-title">
      <div className="container">
        <Eyebrow index="02" label="Key facts" />
        <div className={styles.head}>
          <SplitReveal as="h2" id="facts-title" mode="lines" className="t-h1">
            Proof, measured.
          </SplitReveal>
          <p className={`t-label t-dim ${styles.note}`}>Figures since 2020</p>
        </div>

        <ul className={`${styles.grid} dim-rest dim-rest--cards`}>
          {STATS.map((s, i) => (
            <li key={s.label} className={`dim-item ${styles.cell}`}>
              <TiltCard className={styles.card}>
                <span className="t-label t-dim">{String(i + 1).padStart(2, '0')}</span>
                <Odometer value={s.value} className={`t-h1 ${styles.value}`} delay={i * 0.08} />
                <div className={styles.cardFoot}>
                  <span className={styles.label}>{s.label}</span>
                  <BlurTextReveal items={[s.hint]} className="t-label t-dim" />
                </div>
              </TiltCard>
            </li>
          ))}
          <li className={`dim-item ${styles.reelCell}`}>
            <HoverReel label="Play reel" title="Showreel 2026 — 01:12" />
          </li>
        </ul>

        <div className={styles.awards}>
          <span className="t-label t-dim">Recognition</span>
          <ul className={styles.awardList}>
            {AWARDS.map((a) => (
              <li key={a.label} className={styles.award} style={{ ['--hue' as string]: a.hue }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.awardMark}>
                  <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M12 7 L16.5 9.5 L16.5 14.5 L12 17 L7.5 14.5 L7.5 9.5 Z" fill="currentColor" />
                </svg>
                <span className="t-label">{a.label}</span>
                <span className="t-label t-dim">{a.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
