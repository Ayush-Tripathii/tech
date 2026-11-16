'use client'
import { createElement, useRef, type ElementType, type ReactNode } from 'react'
import { gsap, SplitText, ScrollTrigger, useGSAP } from '@/lib/gsap'
import { DUR, EASE, STAGGER } from '@/lib/motion/tokens'
import { whenTransitionComplete } from '@/lib/motion/store'
import { prefersReduced } from '@/lib/motion/hooks'

type Mode = 'chars' | 'lines' | 'words'

interface Props {
  as?: ElementType
  children: ReactNode
  className?: string
  id?: string
  /** chars: headline (chars within lines); lines: masked line reveal; words */
  mode?: Mode
  /** 'gate' = after the page transition; 'scroll' = once at 80% viewport (also gated). */
  trigger?: 'gate' | 'scroll'
  delay?: number
  /** CustomEvent dispatched on window when the reveal completes. */
  doneEvent?: string
}

/**
 * Text reveal primitive.
 *   chars → y 110%→0, blur 8px→0, opacity 0→1, stagger 0.012, 0.9s ease-out-expo
 *   lines → each line in its own overflow mask, y 100%→0, stagger 0.08
 * Container height is locked via getBoundingClientRect() BEFORE SplitText runs,
 * so the page never jumps on split. Real DOM text — always selectable/accessible.
 */
export function SplitReveal({
  as = 'div',
  children,
  className,
  id,
  mode = 'lines',
  trigger = 'scroll',
  delay = 0,
  doneEvent,
}: Props) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      let split: SplitText | null = null
      let st: ScrollTrigger | null = null
      let cancelled = false

      const done = () => {
        el.style.height = ''
        if (doneEvent) window.dispatchEvent(new CustomEvent(doneEvent))
      }

      if (prefersReduced()) {
        whenTransitionComplete().then(() => {
          if (cancelled) return
          el.classList.add('is-revealed')
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none', onComplete: done })
        })
        return () => {
          cancelled = true
        }
      }

      const run = () => {
        if (cancelled) return
        // Height lock before split.
        el.style.height = `${el.getBoundingClientRect().height}px`
        split = SplitText.create(el, {
          type: mode === 'chars' ? 'lines,chars' : mode === 'words' ? 'lines,words' : 'lines',
          mask: 'lines',
          linesClass: 'mask-line',
          charsClass: 'split-char',
          aria: 'auto',
        })
        el.classList.add('is-revealed')
        const targets = mode === 'chars' ? split.chars : mode === 'words' ? split.words : split.lines
        const fromVars: gsap.TweenVars =
          mode === 'lines'
            ? { yPercent: 100 }
            : { yPercent: 110, opacity: 0, filter: 'blur(8px)' }
        const toVars: gsap.TweenVars = mode === 'lines' ? { yPercent: 0 } : { yPercent: 0, opacity: 1, filter: 'blur(0px)' }
        gsap.fromTo(targets, fromVars, {
          ...toVars,
          duration: DUR.slow,
          ease: EASE.outExpo,
          stagger: mode === 'chars' ? STAGGER.chars : mode === 'words' ? STAGGER.words : STAGGER.lines,
          delay,
          onStart: () => {
            gsap.set(targets, { willChange: 'transform, filter' })
          },
          onComplete: () => {
            gsap.set(targets, { willChange: 'auto', clearProps: 'filter' })
            done()
          },
        })
      }

      whenTransitionComplete().then(() => {
        if (cancelled) return
        if (trigger === 'gate') {
          // Fonts must be ready or the measured lines are wrong.
          void document.fonts.ready.then(run)
        } else {
          st = ScrollTrigger.create({
            trigger: el,
            start: 'top 82%',
            once: true,
            onEnter: () => void document.fonts.ready.then(run),
          })
        }
      })

      return () => {
        cancelled = true
        st?.kill()
        split?.revert()
      }
    },
    { scope: ref },
  )

  return createElement(as, { ref, className, id, 'data-reveal': '' }, children)
}
