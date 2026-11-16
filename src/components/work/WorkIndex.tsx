'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap, Flip } from '@/lib/gsap'
import { subscribe } from '@/lib/motion/engine'
import { DUR, EASE, STAGGER, damp } from '@/lib/motion/tokens'
import { isCoarse, prefersReduced } from '@/lib/motion/hooks'
import { coverURL } from '@/lib/content/generative'
import { PROJECTS, type Project } from '@/lib/content/site'
import { TransitionLink } from '@/components/system/TransitionLink'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import styles from './WorkIndex.module.css'

const FILTERS = ['All', 'Platform', 'Web', 'App', 'Brand', 'Growth'] as const
type Filter = (typeof FILTERS)[number]

const spec = (p: Project, i: number) => ({ seed: p.seed, color: p.color, accent: p.accent, label: p.client, index: String(i + 1).padStart(2, '0') })

export function WorkIndex() {
  const [filter, setFilter] = useState<Filter>('All')
  const [covers, setCovers] = useState<string[]>([])
  const list = useRef<HTMLUListElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  const preview = useRef<HTMLDivElement>(null)
  const previewImg = useRef<HTMLImageElement>(null)
  const bar = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setCovers(PROJECTS.map((p, i) => coverURL(spec(p, i), 640, 420)))
  }, [])

  const choose = (f: Filter) => {
    if (f === filter || !list.current) return
    flipState.current = Flip.getState(list.current.querySelectorAll('[data-row]'))
    setFilter(f)
  }

  // FLIP: reorder/filter, then animate from the captured state.
  useLayoutEffect(() => {
    const st = flipState.current
    if (!st || !list.current) return
    flipState.current = null
    const tl = gsap.timeline()
    tl.add(
      Flip.from(st, {
        duration: prefersReduced() ? 0 : DUR.base,
        ease: EASE.inOutQuint,
        stagger: STAGGER.grid,
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: DUR.base, ease: EASE.outExpo, stagger: STAGGER.grid }),
        onLeave: (els) => gsap.to(els, { opacity: 0, duration: DUR.fast, ease: EASE.outQuart }),
      }),
    )
  }, [filter])

  // Cursor-follow preview (§10.8): springs to the cursor, clip-path reveal, difference blend.
  useEffect(() => {
    const l = list.current
    const pv = preview.current
    const img = previewImg.current
    const b = bar.current
    if (!l || !pv || !img || !b || isCoarse()) return
    const pos = { x: innerWidth / 2, y: innerHeight / 2, vx: 0, vy: 0 }
    let shown = false
    let unsub: (() => void) | null = null
    let reveal: gsap.core.Tween | null = null
    const tick = (f: { dt: number; pointer: { x: number; y: number } }) => {
      const k = 260
      const c = 24
      pos.vx += ((f.pointer.x - pos.x) * k - pos.vx * c) * f.dt
      pos.vy += ((f.pointer.y - pos.y) * k - pos.vy * c) * f.dt
      pos.x += pos.vx * f.dt
      pos.y += pos.vy * f.dt
      const tilt = Math.max(-12, Math.min(12, pos.vx * 0.01))
      pv.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${tilt.toFixed(2)}deg)`
      if (!shown && Math.abs(pos.vx) + Math.abs(pos.vy) < 1) {
        unsub?.()
        unsub = null
      }
    }
    const onOver = (e: PointerEvent) => {
      const row = (e.target as Element).closest<HTMLElement>('[data-row]')
      if (!row) return
      const i = Number(row.dataset.index)
      if (covers[i]) img.src = covers[i]!
      gsap.to(b, { y: row.offsetTop, height: row.offsetHeight, opacity: 1, duration: DUR.fast, ease: EASE.outQuart })
      if (!shown) {
        shown = true
        pos.x = e.clientX
        pos.y = e.clientY
        pv.style.willChange = 'transform, clip-path'
        reveal?.kill()
        reveal = gsap.fromTo(pv, { clipPath: 'inset(50% 50% 50% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: DUR.base, ease: EASE.outExpo })
      }
      unsub ??= subscribe(tick)
    }
    const onLeave = () => {
      shown = false
      gsap.to(b, { opacity: 0, duration: DUR.base, ease: EASE.outQuart })
      reveal?.kill()
      reveal = gsap.to(pv, {
        clipPath: 'inset(50% 50% 50% 50%)',
        duration: DUR.fast,
        ease: EASE.outQuart,
        onComplete: () => void (pv.style.willChange = ''),
      })
    }
    l.addEventListener('pointerover', onOver)
    l.addEventListener('pointerleave', onLeave)
    return () => {
      l.removeEventListener('pointerover', onOver)
      l.removeEventListener('pointerleave', onLeave)
      unsub?.()
    }
  }, [covers])

  const visible = PROJECTS.map((p, i) => ({ p, i })).filter(({ p }) => filter === 'All' || p.category === filter)

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <span className="t-label t-dim">Index — {PROJECTS.length} projects</span>
        <SplitReveal as="h1" mode="chars" trigger="gate" className="t-mega">
          Work
        </SplitReveal>
      </header>

      <div className={styles.filters} role="group" aria-label="Filter projects">
        {FILTERS.map((f) => {
          const n = f === 'All' ? PROJECTS.length : PROJECTS.filter((p) => p.category === f).length
          return (
            <button key={f} type="button" className={`t-label ${styles.chip}`} aria-pressed={filter === f} onClick={() => choose(f)}>
              <RollingText>{f}</RollingText>
              <sup>{String(n).padStart(2, '0')}</sup>
            </button>
          )
        })}
      </div>

      <div className={styles.listWrap}>
        <span ref={bar} className={styles.bar} aria-hidden="true" />
        <ul ref={list} className={`dim-rest ${styles.list}`}>
          {visible.map(({ p, i }) => (
            <li key={p.slug} data-row="" data-flip-id={p.slug} data-index={i} className={`dim-item ${styles.row}`}>
              <TransitionLink href={`/work/${p.slug}/`} className={styles.link} data-cursor="media" data-cursor-label="View">
                <span className="t-label t-dim">{String(i + 1).padStart(2, '0')}</span>
                <span className={`t-h2 ${styles.client}`}>
                  <RollingText>{p.client}</RollingText>
                </span>
                <span className={styles.title}>{p.title}</span>
                <span className={`t-label t-dim ${styles.disc}`}>{p.disciplines.join(' · ')}</span>
                <span className="t-label">{p.year}</span>
                <Arrow />
              </TransitionLink>
            </li>
          ))}
        </ul>
      </div>

      <div ref={preview} className={styles.preview} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={previewImg} alt="" width={640} height={420} />
      </div>
    </div>
  )
}
