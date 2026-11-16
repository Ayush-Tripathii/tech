'use client'
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { gsap } from '@/lib/gsap'
import { DUR, EASE } from '@/lib/motion/tokens'
import { scroll } from '@/lib/motion/engine'
import { prefersReduced } from '@/lib/motion/hooks'
import { audio } from '@/lib/audio/AudioManager'
import { TESTIMONIALS } from '@/lib/content/site'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { RollingText } from '@/components/primitives/RollingText'
import { Magnetic } from '@/components/primitives/Magnetic'
import styles from './Testimonials.module.css'

export function Testimonials() {
  const [active, setActive] = useState(0)
  const [shown, setShown] = useState(0)
  const [modal, setModal] = useState<{ x: number; y: number } | null>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const bar = useRef<HTMLSpanElement>(null)
  const quote = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const listenBtn = useRef<HTMLButtonElement>(null)

  // Highlight bar: measure the target's exact position + width (never fixed-width).
  const moveBar = (i: number, instant = false) => {
    const t = tabs.current[i]
    const b = bar.current
    if (!t || !b) return
    gsap.to(b, {
      x: t.offsetLeft,
      width: t.offsetWidth,
      duration: instant || prefersReduced() ? 0 : DUR.base,
      ease: EASE.outQuart,
    })
  }
  useLayoutEffect(() => {
    moveBar(active, true)
    const onResize = () => moveBar(active, true)
    window.addEventListener('resize', onResize)
    void document.fonts.ready.then(onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const select = (i: number) => {
    if (i === active) return
    setActive(i)
    moveBar(i)
    audio.click()
    const q = quote.current
    if (!q || prefersReduced()) {
      setShown(i)
      return
    }
    gsap.to(q, {
      opacity: 0,
      filter: 'blur(8px)',
      y: -8,
      duration: 0.2,
      ease: EASE.outQuart,
      onComplete: () => {
        setShown(i)
        gsap.fromTo(q, { opacity: 0, filter: 'blur(8px)', y: 8 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.4, ease: EASE.outExpo, clearProps: 'filter' })
      },
    })
  }

  const onKey = (e: KeyboardEvent) => {
    const n = TESTIMONIALS.length
    let next = -1
    if (e.key === 'ArrowRight') next = (active + 1) % n
    if (e.key === 'ArrowLeft') next = (active - 1 + n) % n
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = n - 1
    if (next >= 0) {
      e.preventDefault()
      select(next)
      tabs.current[next]?.focus()
    }
  }

  const openModal = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX || r.left + r.width / 2
    const y = e.clientY || r.top + r.height / 2
    setModal({ x, y })
    audio.whoosh(0.7)
  }

  // Modal: circular clip-path reveal from the click coordinates (layout effect → no flash).
  useLayoutEffect(() => {
    const m = modalRef.current
    if (!modal || !m) return
    scroll.lock()
    const r = Math.hypot(Math.max(modal.x, innerWidth - modal.x), Math.max(modal.y, innerHeight - modal.y))
    const reduced = prefersReduced()
    gsap.fromTo(
      m,
      reduced ? { opacity: 0 } : { clipPath: `circle(0px at ${modal.x}px ${modal.y}px)` },
      reduced ? { opacity: 1, duration: 0.2 } : { clipPath: `circle(${r}px at ${modal.x}px ${modal.y}px)`, duration: 0.8, ease: EASE.inOutQuint },
    )
    m.querySelector<HTMLElement>('button')?.focus()
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'Tab') {
        const f = Array.from(m.querySelectorAll<HTMLElement>('button, a'))
        const i = f.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length]?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal])

  const close = () => {
    const m = modalRef.current
    if (!m || !modal) return
    gsap.to(m, {
      clipPath: `circle(0px at ${modal.x}px ${modal.y}px)`,
      duration: 0.6,
      ease: EASE.inOutQuint,
      onComplete: () => {
        setModal(null)
        scroll.unlock()
        listenBtn.current?.focus()
      },
    })
  }

  const t = TESTIMONIALS[shown]!
  return (
    <section className={`section ${styles.testimonials}`} aria-labelledby="voices-title">
      <div className="container">
        <Eyebrow index="05" label="Client voices" />
        <h2 id="voices-title" className="sr-only">
          Testimonials
        </h2>
        <div className={styles.tabs} role="tablist" aria-label="Clients" onKeyDown={onKey}>
          {TESTIMONIALS.map((x, i) => (
            <button
              key={x.client}
              ref={(el) => {
                tabs.current[i] = el
              }}
              role="tab"
              id={`tab-${i}`}
              aria-selected={i === active}
              aria-controls="voice-panel"
              tabIndex={i === active ? 0 : -1}
              className={`t-label ${styles.tab}`}
              data-active={i === active}
              onClick={() => select(i)}
            >
              <RollingText>{x.client}</RollingText>
            </button>
          ))}
          <span ref={bar} className={styles.bar} aria-hidden="true" />
        </div>

        <div id="voice-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className={styles.panel}>
          <div ref={quote} className={styles.quoteWrap}>
            <blockquote className={`t-editorial ${styles.quote}`}>
              <p>“{t.quote}”</p>
            </blockquote>
            <div className={styles.attr}>
              <span className={styles.author}>{t.author}</span>
              <span className="t-label t-dim">
                {t.role}, {t.client}
              </span>
            </div>
          </div>
          <Magnetic>
            <button ref={listenBtn} type="button" className="btn btn--ghost" onClick={openModal} aria-haspopup="dialog">
              <span aria-hidden="true">▷</span>
              <RollingText>Listen</RollingText>
            </button>
          </Magnetic>
        </div>
      </div>

      {modal && (
        <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-label={`${t.author} — interview`} data-lenis-prevent="">
          <div className={styles.modalInner}>
            <div className={styles.modalHead}>
              <span className="t-label t-dim">Interview · {t.client}</span>
              <button type="button" className="btn btn--ghost" onClick={close}>
                <RollingText>Close</RollingText>
              </button>
            </div>
            <div className={styles.wave} aria-hidden="true">
              {Array.from({ length: 64 }, (_, i) => (
                <i key={i} style={{ animationDelay: `${(i % 16) * -0.07}s`, height: `${20 + Math.abs(Math.sin(i * 1.7)) * 80}%` }} />
              ))}
            </div>
            <p className={`t-h2 ${styles.transcript}`}>{t.transcript}</p>
            <p className="t-label t-dim">
              {t.author} — {t.role}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
