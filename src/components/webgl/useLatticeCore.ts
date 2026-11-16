'use client'
import { useEffect, useRef, type RefObject } from 'react'
import type { LatticeCore, CoreShape } from './LatticeCore'
import { subscribe } from '@/lib/motion/engine'
import { useMotion } from '@/lib/motion/store'
import { register, resolve } from '@/lib/motion/loader'
import { acquireContext, hasWebGL, isMobile, mountCanvas, quality, releaseContext } from '@/lib/webgl/capabilities'
import { prefersReduced } from '@/lib/motion/hooks'

const DRAG_THRESHOLD = 6

/**
 * Mounts a LatticeCore into `slotRef` and wires it to the shared engine.
 *  - The scene (and its WebGL context) exists only while the host is within
 *    one viewport of the screen — this keeps the site at ≤ 2 live contexts.
 *  - It renders only while actually visible and the tab is visible.
 *  - Pointer → magnetic hover / drag inertia / hold-to-refract; Space/Enter
 *    on the focused host also refracts.
 */
export function useLatticeCore(
  slotRef: RefObject<HTMLElement | null>,
  hostRef: RefObject<HTMLElement | null>,
  opts: { shape?: CoreShape; id: string; trackLoad?: boolean },
) {
  const coreRef = useRef<LatticeCore | null>(null)

  useEffect(() => {
    const slot = slotRef.current
    const host = hostRef.current
    if (!slot || !host) return
    if (!hasWebGL()) {
      host.dataset.webgl = 'off'
      return
    }
    const reduced = prefersReduced()
    const set = useMotion.getState().set
    let tracking = !!opts.trackLoad
    if (tracking) register(opts.id)
    const done = () => {
      if (tracking) {
        tracking = false
        resolve(opts.id)
      }
    }

    let core: LatticeCore | null = null
    let canvas: HTMLCanvasElement | null = null
    let disposed = false
    let building = false
    let near = false
    let visible = false
    let unsub: (() => void) | null = null

    const stop = () => {
      unsub?.()
      unsub = null
    }
    const loop = () => {
      if (!core || core.isStatic || document.hidden || !visible) return
      unsub ??= subscribe((f) => {
        if (!core) return
        core.update(f.dt, f.time)
        core.render()
        quality.sample(f.dt)
        if (core.isStatic) stop()
      })
    }
    const size = () => {
      const r = host.getBoundingClientRect()
      core?.resize(r.width, r.height)
    }
    const teardown = () => {
      stop()
      core?.dispose()
      core = null
      coreRef.current = null
      canvas?.remove()
      canvas = null
      releaseContext(opts.id)
      set({ hold: 0 })
    }
    const build = async () => {
      if (core || building || disposed) return
      if (!acquireContext(opts.id, 3, teardown)) {
        done()
        return
      }
      building = true
      const { LatticeCore } = await import('./LatticeCore')
      if (disposed || !near) {
        building = false
        releaseContext(opts.id)
        return
      }
      canvas = mountCanvas(slot)
      core = new LatticeCore({
        canvas,
        shape: opts.shape,
        mobile: isMobile(),
        reduced,
        onHold: (p) => {
          const h = useMotion.getState().hold
          if (Math.abs(h - p) > 0.004 || (p === 0 && h !== 0)) set({ hold: p })
        },
      })
      coreRef.current = core
      size()
      await core.warm()
      building = false
      if (disposed) return
      host.dataset.ready = 'true'
      done()
      loop()
    }

    // Proximity: build within one viewport, tear down beyond it.
    const nearIO = new IntersectionObserver(
      ([e]) => {
        near = !!e?.isIntersecting
        if (near) void build()
        else {
          teardown()
          done()
        }
      },
      { rootMargin: '100% 0px 100% 0px' },
    )
    nearIO.observe(host)
    // Visibility: render only while on screen.
    const visIO = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting
      if (visible) loop()
      else stop()
    })
    visIO.observe(host)
    const onVis = () => (document.hidden ? stop() : loop())
    document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(() => {
      size()
      if (core?.isStatic) core.render()
    })
    ro.observe(host)

    // --- pointer: hover / drag / hold ---
    let down = false
    let dragging = false
    let sx = 0
    let sy = 0
    let lx = 0
    let ly = 0
    const local = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      return { nx: ((e.clientX - r.left) / r.width) * 2 - 1, ny: -(((e.clientY - r.top) / r.height) * 2 - 1) }
    }
    const onMove = (e: PointerEvent) => {
      if (!core) return
      const { nx, ny } = local(e)
      core.setPointer(nx, ny, e.pointerType === 'mouse' || down)
      if (!down) return
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      lx = e.clientX
      ly = e.clientY
      if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > DRAG_THRESHOLD) {
        dragging = true
        core.beginDrag()
      }
      if (dragging) core.drag(dx, dy)
    }
    const onDown = (e: PointerEvent) => {
      if (!core || e.button > 0) return
      down = true
      dragging = false
      sx = lx = e.clientX
      sy = ly = e.clientY
      core.press()
    }
    const onUp = () => {
      if (!core || !down) return
      if (dragging) core.endDrag()
      else core.release()
      down = false
      dragging = false
    }
    const onLeave = () => {
      core?.setPointer(10, 10, false)
      onUp()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && core) {
        e.preventDefault()
        down = true
        core.press()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') onUp()
    }
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('keydown', onKeyDown)
    host.addEventListener('keyup', onKeyUp)

    return () => {
      disposed = true
      nearIO.disconnect()
      visIO.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onUp)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('keydown', onKeyDown)
      host.removeEventListener('keyup', onKeyUp)
      teardown()
      done()
    }
  }, [slotRef, hostRef, opts.shape, opts.id, opts.trackLoad])

  return coreRef
}
