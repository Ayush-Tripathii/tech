'use client'
import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { scroll, subscribe } from '@/lib/motion/engine'
import { EVENTS, useMotion } from '@/lib/motion/store'
import { EASE, STAGGER, damp, ease as E } from '@/lib/motion/tokens'
import { onProgress, progress, register, resolve, seal } from '@/lib/motion/loader'
import { prefersReduced } from '@/lib/motion/hooks'
import { BRAND } from '@/lib/content/site'
import styles from './Preloader.module.css'

const VISITED = 'gbg:visited'
const MAX_WAIT = 5 // seconds, then force-complete

/**
 * "LATTICE ASSEMBLY" — first visit only (sessionStorage-gated).
 * Six beats, 2.6s if assets are ready, max 5s then force-complete.
 * Return visitors get a 400ms fade only.
 */
export function Preloader() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const set = useMotion.getState().set
    let visited = false
    try {
      visited = sessionStorage.getItem(VISITED) === '1'
    } catch {
      /* */
    }
    scroll.lock()

    register('fonts')
    register('boot')
    void document.fonts.ready.then(() => resolve('fonts'))
    requestAnimationFrame(() => resolve('boot'))

    const finish = () => {
      seal()
      try {
        sessionStorage.setItem(VISITED, '1')
      } catch {
        /* */
      }
      el.style.display = 'none'
      scroll.unlock()
      set({ preloaderDone: true, transitionComplete: true })
      window.dispatchEvent(new CustomEvent(EVENTS.PRELOADER_COMPLETE))
    }

    if (visited || prefersReduced()) {
      el.classList.add(styles.quick!)
      // Short honest wait for the essentials (max 1.2s), then a 400ms fade.
      const start = performance.now()
      let raf = 0
      const check = () => {
        if (progress() >= 1 || performance.now() - start > 1200) {
          gsap.to(el, { opacity: 0, duration: 0.4, ease: 'none', onComplete: finish })
        } else raf = requestAnimationFrame(check)
      }
      raf = requestAnimationFrame(check)
      return () => cancelAnimationFrame(raf)
    }

    const q = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s))
    const brackets = q<HTMLElement>('[data-bracket]')
    const square = el.querySelector<SVGRectElement>('[data-square]')!
    const squareBox = el.querySelector<HTMLElement>('[data-square-box]')!
    const core = el.querySelector<HTMLElement>('[data-core]')!
    const chars = q<HTMLElement>('[data-char]')
    const reels = q<HTMLElement>('[data-reel]')
    const stage = el.querySelector<HTMLElement>('[data-stage]')!
    const belts = q<HTMLElement>('[data-pbelt]')

    // Reel state: [timed, timed, real-progress]
    const values = [0, 0, 0]
    let realTarget = 0
    const unsubProg = onProgress((p) => {
      realTarget = p * 100
    })
    const renderReel = (i: number) => {
      const v = Math.min(100, Math.floor(values[i]!))
      const digits = String(v).padStart(3, '0')
      const cols = reels[i]?.querySelectorAll<HTMLElement>('[data-col]')
      cols?.forEach((c, k) => {
        c.style.transform = `translateY(${-Number(digits[k]) * 10}%)`
      })
    }
    const t0 = performance.now()
    const unsubTick = subscribe((f) => {
      // Reel 3 chases REAL progress, decelerating; never ahead of it.
      values[2] = values[2]! + (realTarget - values[2]!) * damp(0.06, f.dt)
      if (realTarget >= 100 && values[2]! > 99.4) values[2] = 100
      renderReel(2)
    })

    const timed = { a: 0, b: 0 }
    const tl = gsap.timeline()
    // Beat 1 — corner brackets fly in from the viewport edges
    tl.fromTo(
      brackets,
      {
        x: (i: number) => (i % 2 === 0 ? -1 : 1) * window.innerWidth * 0.5,
        y: (i: number) => (i < 2 ? -1 : 1) * window.innerHeight * 0.5,
        opacity: 0,
      },
      { x: 0, y: 0, opacity: 1, duration: 0.35, ease: EASE.outExpo, stagger: 0.05 },
      0,
    )
    // Beat 2 — SVG square draws itself stroke by stroke
    tl.fromTo(square, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.65, ease: 'power2.inOut' }, 0.25)
    // Beat 3 — reels 1 & 2 timed, stepped (integer floors), decelerating
    tl.to(timed, {
      a: 100,
      b: 100,
      duration: 1.7,
      ease: (t: number) => E.outQuart(t),
      onUpdate: () => {
        values[0] = timed.a
        values[1] = Math.min(timed.b * 1.0, Math.max(0, timed.a - 6 + 6 * (timed.a / 100)))
        renderReel(0)
        renderReel(1)
      },
    }, 0.4)
    // Beat 4 — tagline char reveal with blur
    tl.fromTo(
      chars,
      { yPercent: 110, filter: 'blur(6px)', opacity: 0 },
      { yPercent: 0, filter: 'blur(0px)', opacity: 1, duration: 0.8, ease: EASE.outExpo, stagger: STAGGER.chars },
      1.2,
    )
    // Gate at 2.1s: wait for honest 100% or the 5s ceiling.
    tl.addPause(2.1, () => {
      const wait = () => {
        const elapsed = (performance.now() - t0) / 1000
        if ((values[2]! >= 100 && progress() >= 1) || elapsed > MAX_WAIT) {
          if (elapsed > MAX_WAIT) {
            values[2] = 100
            renderReel(2)
          }
          tl.resume()
        } else requestAnimationFrame(wait)
      }
      wait()
    })
    // Beat 5 — square implodes into the Lattice Core silhouette
    tl.to(squareBox, { scale: 0.18, rotate: 90, duration: 0.35, ease: EASE.inOutQuint }, 2.1)
    tl.to(brackets, { scale: 0.4, opacity: 0, duration: 0.35, ease: EASE.inOutQuint }, 2.1)
    tl.fromTo(core, { scale: 0.4, opacity: 0, rotate: -30 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.35, ease: EASE.snap }, 2.2)
    tl.to(stage.querySelectorAll('[data-fade]'), { opacity: 0, yPercent: -20, duration: 0.3, ease: EASE.outQuart }, 2.1)
    // Beat 6 — twelve belts wipe, hero already mid-idle underneath
    tl.to(stage, { opacity: 0, duration: 0.25, ease: 'none' }, 2.32)
    tl.to(belts, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.42, ease: EASE.inOutQuint, stagger: 0.035 }, 2.2)
    tl.call(finish)

    return () => {
      tl.kill()
      unsubTick()
      unsubProg()
    }
  }, [])

  const words = BRAND.taglineWords
  return (
    <div ref={root} className={styles.preloader} data-preloader="" aria-hidden="true">
      <div className={styles.belts}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} data-pbelt="" className={styles.belt} />
        ))}
      </div>
      <div className={styles.stage} data-stage="">
        <div className={styles.frame}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} data-bracket="" className={`${styles.bracket} ${styles[`b${i}`]}`} />
          ))}
          <div className={styles.squareBox} data-square-box="">
            <svg viewBox="0 0 100 100" className={styles.square}>
              <rect data-square="" x="1" y="1" width="98" height="98" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className={styles.core} data-core="">
            <svg viewBox="-50 -50 100 100">
              <polygon points="0,-42 36,-21 36,21 0,42 -36,21 -36,-21" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M0,-42 L0,0 L36,21 M0,0 L-36,21 M-36,-21 L0,0 M36,-21 L0,0 L0,42" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
            </svg>
          </div>
        </div>
        <p className={`t-label ${styles.tagline}`} data-fade="">
          {Array.from(BRAND.tagline).map((c, i) => (
            <span key={i} className={styles.charMask}>
              <span data-char="" className={styles.char}>
                {c === ' ' ? ' ' : c}
              </span>
            </span>
          ))}
        </p>
        <div className={styles.reels} data-fade="">
          {words.map((w, i) => (
            <div key={w} className={styles.reelCell}>
              <span className="t-label t-dim">{String(i + 1).padStart(2, '0')} / {w.replace('.', '')}</span>
              <span className={styles.reel} data-reel="">
                {[0, 1, 2].map((k) => (
                  <span key={k} className={styles.reelWin}>
                    <span className={styles.reelCol} data-col="">
                      {Array.from({ length: 10 }, (_, d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
