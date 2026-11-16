'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import '@/lib/gsap'
import { ScrollTrigger } from '@/lib/gsap'
import { startEngine, subscribe } from '@/lib/motion/engine'
import { useMotion } from '@/lib/motion/store'
import { audio } from '@/lib/audio/AudioManager'
import { hasWebGL, quality } from '@/lib/webgl/capabilities'
import { prefersReduced, isCoarse } from '@/lib/motion/hooks'

/**
 * Boots the global systems exactly once. Rendered as the FIRST child of
 * <body> so its effect runs before any sibling's effect.
 */
export function MotionBoot() {
  const pathname = usePathname()

  useEffect(() => {
    const reduced = prefersReduced()
    const coarse = isCoarse()
    const webgl = hasWebGL()
    useMotion.getState().set({ reducedMotion: reduced, isTouch: coarse, webgl })
    const html = document.documentElement
    if (!coarse) html.classList.add('has-cursor')
    if (!webgl) html.classList.add('no-webgl')
    if (reduced) html.classList.add('reduced-motion')
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    startEngine({ reducedMotion: reduced })
    audio.init()

    // Dev FPS overlay: append ?fps to any URL.
    let unsubFps: (() => void) | null = null
    if (new URLSearchParams(location.search).has('fps')) {
      const el = document.createElement('div')
      el.style.cssText =
        'position:fixed;left:8px;bottom:8px;z-index:99999;font:11px/1.3 monospace;color:#D7FF3E;background:#000a;padding:6px 8px;pointer-events:none'
      document.body.appendChild(el)
      let acc = 0
      let n = 0
      unsubFps = subscribe((f) => {
        acc += f.dt
        n++
        if (acc > 0.5) {
          el.textContent = `${Math.round(n / acc)} fps · tier ${quality.tier}`
          acc = 0
          n = 0
        }
      })
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => location.reload()
    mq.addEventListener('change', onMq)
    return () => {
      mq.removeEventListener('change', onMq)
      unsubFps?.()
    }
  }, [])

  // Recalculate every trigger once the new route has painted.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh()))
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return null
}
