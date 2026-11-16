'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { gsap } from '@/lib/gsap'
import { scroll } from '@/lib/motion/engine'
import { useMotion } from '@/lib/motion/store'
import { DUR, EASE, STAGGER } from '@/lib/motion/tokens'
import { audio } from '@/lib/audio/AudioManager'
import { prefersReduced } from '@/lib/motion/hooks'
import { PROJECTS } from '@/lib/content/site'
import styles from './TransitionShell.module.css'

const BELTS = 12

type Navigate = (href: string) => void
let navigateImpl: Navigate | null = null

/** Navigate through the transition shell (falls back to location if not mounted). */
export function navigate(href: string) {
  if (navigateImpl) navigateImpl(href)
  else window.location.href = href
}

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p)

function routeName(path: string): string {
  const p = norm(path.split('#')[0] ?? '/')
  if (p === '' || p === '/') return 'Index'
  if (p.startsWith('/work/')) {
    const slug = p.split('/')[2]
    const proj = PROJECTS.find((x) => x.slug === slug)
    return proj ? `${proj.client} — ${proj.title}` : 'Case study'
  }
  const seg = p.split('/')[1] ?? ''
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

/**
 * The single reusable page-transition shell.
 *   OUT  0.00–0.55  page → scale .96, blur 8, opacity .4; 12 belts sweep down
 *   HOLD 0.55–0.75  route resolves behind the cover; mono label shows destination
 *   IN   0.75–1.40  belts sweep up (reversed order); page enters from 1.04 / blur 6
 * Scroll is locked throughout and reset to 0 during HOLD. The outgoing page's
 * WebGL is disposed when it unmounts — which happens during HOLD.
 */
export function TransitionShell() {
  const router = useRouter()
  const pathname = usePathname()
  const root = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const pending = useRef<string | null>(null)
  const pathWaiter = useRef<{ target: string; resolve: () => void } | null>(null)
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  // Resolve the HOLD wait when the router has actually swapped the page.
  useEffect(() => {
    const w = pathWaiter.current
    if (w && norm(pathname) === norm(w.target)) {
      pathWaiter.current = null
      w.resolve()
    }
  }, [pathname])

  useEffect(() => {
    const el = root.current!
    const belts = Array.from(el.querySelectorAll<HTMLElement>('[data-belt]'))
    const label = labelRef.current!

    const run = async (href: string) => {
      const [pathPart, hash] = href.split('#') as [string, string | undefined]
      const target = pathPart || '/'
      const samePage = norm(target) === norm(pathnameRef.current)
      if (samePage) {
        if (hash) scroll.to(`#${hash}`, { offset: -40 })
        else scroll.to(0)
        return
      }
      if (busy.current) {
        pending.current = href
        return
      }
      busy.current = true
      const page = document.getElementById('page')
      const reduced = prefersReduced()
      const set = useMotion.getState().set
      set({ transitionComplete: false, phase: 'out', menuOpen: false })
      scroll.lock()
      audio.whoosh(1.1)

      // ---- OUT --------------------------------------------------------
      el.style.visibility = 'visible'
      label.textContent = ''
      if (reduced) {
        await gsap.fromTo(belts, { scaleY: 1, opacity: 0 }, { opacity: 1, duration: 0.2 }).then()
      } else {
        const out = gsap.timeline()
        if (page) {
          page.style.willChange = 'transform, filter, opacity'
          out.to(page, { scale: 0.96, filter: 'blur(8px)', opacity: 0.4, duration: 0.55, ease: EASE.inOutQuint }, 0)
        }
        out.fromTo(
          belts,
          { scaleY: 0, transformOrigin: '50% 0%' },
          { scaleY: 1, duration: DUR.fast, ease: EASE.inOutQuint, stagger: 0.03 },
          0,
        )
        await out.then()
      }

      // ---- HOLD -------------------------------------------------------
      set({ phase: 'hold' })
      const name = routeName(href)
      label.innerHTML = ''
      const chars = Array.from(name).map((c) => {
        const s = document.createElement('span')
        s.textContent = c === ' ' ? ' ' : c
        s.style.display = 'inline-block'
        label.appendChild(s)
        return s
      })
      if (!reduced) {
        gsap.fromTo(chars, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: DUR.base, ease: EASE.outExpo, stagger: STAGGER.chars })
      }
      const swapped = new Promise<void>((resolve) => {
        pathWaiter.current = { target, resolve }
      })
      router.push(href, { scroll: false })
      await Promise.race([swapped, new Promise((r) => setTimeout(r, 4000))])
      await new Promise((r) => setTimeout(r, 200))
      scroll.top()
      // Let the new page mount + measure before revealing.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      // ---- IN ---------------------------------------------------------
      set({ phase: 'in' })
      if (reduced) {
        await gsap.to(belts, { opacity: 0, duration: 0.2 }).then()
      } else {
        const tin = gsap.timeline()
        if (page) {
          gsap.set(page, { scale: 1.04, filter: 'blur(6px)', opacity: 1 })
          tin.to(page, { scale: 1, filter: 'blur(0px)', duration: 0.65, ease: EASE.outExpo }, 0.05)
        }
        tin.to(chars, { yPercent: -100, opacity: 0, duration: DUR.fast, ease: EASE.outQuart, stagger: STAGGER.chars / 2 }, 0)
        tin.to(
          [...belts].reverse(),
          { scaleY: 0, transformOrigin: '50% 0%', duration: DUR.fast, ease: EASE.inOutQuint, stagger: 0.03 },
          0,
        )
        await tin.then()
      }
      if (page) {
        gsap.set(page, { clearProps: 'transform,filter,opacity,willChange' })
      }
      el.style.visibility = 'hidden'
      scroll.unlock()
      set({ transitionComplete: true, phase: 'idle' })
      if (hash) setTimeout(() => scroll.to(`#${hash}`, { offset: -40 }), 300)
      busy.current = false

      const next = pending.current
      pending.current = null
      if (next && norm(next.split('#')[0] || '/') !== norm(target)) void run(next)
    }

    navigateImpl = (href) => void run(href)

    // Back / forward: the router swaps without us. Make sure gates stay open
    // and scroll restoration lands correctly after the new page measures.
    const onPop = () => {
      useMotion.getState().set({ transitionComplete: true })
    }
    window.addEventListener('popstate', onPop)
    return () => {
      navigateImpl = null
      window.removeEventListener('popstate', onPop)
    }
  }, [router])

  return (
    <div ref={root} className={styles.shell} aria-hidden="true">
      <div className={styles.belts}>
        {Array.from({ length: BELTS }, (_, i) => (
          <div key={i} data-belt="" className={styles.belt} />
        ))}
      </div>
      <div className={`t-label ${styles.label}`} ref={labelRef} />
    </div>
  )
}
