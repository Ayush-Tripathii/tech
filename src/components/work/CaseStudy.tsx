'use client'
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { prefersReduced } from '@/lib/motion/hooks'
import type { Project } from '@/lib/content/site'
import { Cover } from '@/components/primitives/Cover'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import { Odometer } from '@/components/primitives/Odometer'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import { TransitionLink } from '@/components/system/TransitionLink'
import styles from './CaseStudy.module.css'

const PARALLAX = [0.85, 1.0, 1.15] as const

export function CaseStudy({ project: p, next, index }: { project: Project; next: Project; index: number }) {
  const root = useRef<HTMLDivElement>(null)
  const spec = (seed: number, label?: string) => ({ seed, color: p.color, accent: p.accent, label })

  useGSAP(
    () => {
      if (prefersReduced()) return
      const q = gsap.utils.selector(root)
      // Pinned hero: scroll-scrubbed scale
      gsap.to(q('[data-hero-media]'), {
        scale: 0.82,
        borderRadius: 16,
        ease: 'none',
        scrollTrigger: { trigger: q('[data-hero]')[0], start: 'top top', end: '+=80%', scrub: 1, pin: true },
      })
      gsap.to(q('[data-hero-title]'), {
        yPercent: -40,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: q('[data-hero]')[0], start: 'top top', end: '+=60%', scrub: 1 },
      })
      // Differential parallax: 0.85 / 1.0 / 1.15
      q('[data-speed]').forEach((el) => {
        const speed = Number((el as HTMLElement).dataset.speed)
        gsap.fromTo(
          el,
          { yPercent: (1 - speed) * -60 },
          {
            yPercent: (1 - speed) * 60,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
          },
        )
      })
      // Next project peels up over the footer
      gsap.fromTo(
        q('[data-peel]'),
        { clipPath: 'inset(18% 6% 0% 6% round 24px)', yPercent: 12 },
        {
          clipPath: 'inset(0% 0% 0% 0% round 0px)',
          yPercent: 0,
          ease: 'none',
          scrollTrigger: { trigger: q('[data-peel]')[0], start: 'top bottom', end: 'top 20%', scrub: 1 },
        },
      )
    },
    { scope: root },
  )

  return (
    <div ref={root} className={styles.cs}>
      <section data-hero="" className={styles.hero} aria-labelledby="cs-title">
        <div data-hero-media="" className={styles.heroMedia}>
          <Cover spec={spec(p.seed, p.client)} alt={`${p.client} — ${p.title} key visual`} width={1600} height={900} className={styles.heroCover} />
        </div>
        <div data-hero-title="" className={`container ${styles.heroTitle}`}>
          <span className="t-label">
            {String(index + 1).padStart(2, '0')} — {p.client}
          </span>
          <SplitReveal as="h1" id="cs-title" mode="chars" trigger="gate" className="t-mega">
            {p.title}
          </SplitReveal>
        </div>
      </section>

      <div className={`container ${styles.body}`}>
        <aside className={styles.rail} aria-label="Project details">
          <dl>
            <div>
              <dt className="t-label t-dim">Client</dt>
              <dd>{p.client}</dd>
            </div>
            <div>
              <dt className="t-label t-dim">Year</dt>
              <dd>{p.year}</dd>
            </div>
            <div>
              <dt className="t-label t-dim">Disciplines</dt>
              <dd>{p.disciplines.join(', ')}</dd>
            </div>
            <div>
              <dt className="t-label t-dim">Category</dt>
              <dd>{p.category}</dd>
            </div>
          </dl>
        </aside>

        <article className={styles.content}>
          <SplitReveal as="p" mode="lines" className={`t-h2 ${styles.summary}`}>
            {p.summary}
          </SplitReveal>
          <div className={styles.cols}>
            <div>
              <h2 className="t-label t-dim">The challenge</h2>
              <SplitReveal as="p" mode="lines" className="t-body-lg">
                {p.challenge}
              </SplitReveal>
            </div>
            <div>
              <h2 className="t-label t-dim">The approach</h2>
              <SplitReveal as="p" mode="lines" className="t-body-lg">
                {p.approach}
              </SplitReveal>
            </div>
          </div>
        </article>
      </div>

      <section className={styles.media} aria-label="Project imagery">
        {PARALLAX.map((s, i) => (
          <div key={s} data-speed={s} className={`${styles.mediaItem} ${styles[`m${i}`]}`}>
            <Cover spec={spec(p.seed + (i + 1) * 7)} alt={`${p.client} — interface detail ${i + 1}`} width={1200} height={i === 1 ? 1500 : 800} reveal />
          </div>
        ))}
      </section>

      <div className="container">
        <figure className={styles.pull}>
          <blockquote className="t-editorial">
            <p>“{p.quote.text}”</p>
          </blockquote>
          <figcaption className="t-label t-dim">
            {p.quote.author} — {p.quote.role}
          </figcaption>
        </figure>

        <ul className={styles.results} aria-label="Results">
          {p.results.map((r) => (
            <li key={r.label}>
              <Odometer value={r.value} className="t-h1" />
              <span className="t-label t-dim">{r.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <section className={styles.next} aria-label="Next project">
        <TransitionLink href={`/work/${next.slug}/`} data-peel="" className={styles.peel} data-cursor="media" data-cursor-label="Next">
          {/* already rendered + decoded before it's revealed */}
          <Cover spec={{ seed: next.seed, color: next.color, accent: next.accent, label: next.client }} alt={`${next.client} — ${next.title} cover`} width={1600} height={900} className={styles.nextCover} />
          <span className={`container ${styles.nextLabel}`}>
            <span className="t-label">Next project</span>
            <span className="t-h1">
              <RollingText>{next.client}</RollingText> <Arrow />
            </span>
          </span>
        </TransitionLink>
      </section>
    </div>
  )
}
