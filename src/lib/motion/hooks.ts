'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { subscribe } from './engine'
import type { FrameState } from './frame'

/** Synchronous reduced-motion read (safe inside child effects that run before providers). */
export function prefersReduced(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isCoarse(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** Subscribe to the shared engine tick while `active`. */
export function useFrame(fn: (f: FrameState) => void, active = true) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active) return
    return subscribe((f) => ref.current(f))
  }, [active])
}

/** IntersectionObserver visibility flag. */
export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = '0px', once = false) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return
        setInView(e.isIntersecting)
        if (e.isIntersecting && once) io.disconnect()
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin, once])
  return inView
}

/** Lazily mount heavy children only when near the viewport (and keep them while near). */
export function useNear<T extends Element>(ref: RefObject<T | null>, margin = '50%') {
  return useInView(ref, `${margin} 0px ${margin} 0px`)
}
