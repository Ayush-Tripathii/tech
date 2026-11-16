'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { ScrollTrigger, Observer } from '@/lib/gsap'
import { subscribe } from '@/lib/motion/engine'
import { frame } from '@/lib/motion/frame'
import { whenTransitionComplete } from '@/lib/motion/store'
import { prefersReduced } from '@/lib/motion/hooks'
import { acquireContext, hasWebGL, isMobile, mountCanvas, releaseContext } from '@/lib/webgl/capabilities'
import { audio } from '@/lib/audio/AudioManager'
import { PROJECTS } from '@/lib/content/site'
import { navigate } from '@/components/system/TransitionShell'
import { TransitionLink } from '@/components/system/TransitionLink'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import { Cover } from '@/components/primitives/Cover'
import type { Helix } from '@/components/webgl/Helix'
import styles from './HelixGallery.module.css'

const WORD = 'Selected work — '

export function HelixGallery() {
  const section = useRef<HTMLElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'webgl' | 'static'>('webgl')
  const [active, setActive] = useState(0)

  // Layout effect: its cleanup must run BEFORE React removes the DOM, so the
  // ScrollTrigger pin-spacer is unwrapped first (otherwise removeChild throws).
  useLayoutEffect(() => {
    const el = section.current
    const h = host.current
    const cv = canvas.current
    if (!el || !h || !cv) return
    if (prefersReduced() || !hasWebGL()) {
      setMode('static')
      return
    }
    const mobile = isMobile()
    let helix: Helix | null = null
    let cvEl: HTMLCanvasElement | null = null
    let cancelled = false
    let unsub: (() => void) | null = null
    let st: ScrollTrigger | null = null
    let obs: Observer | null = null
    let busyUntil = 0
    let lastActive = -1
    let progress = 0

    const tick = (f: { dt: number; time: number }) => {
      if (!helix) return
      const moving = helix.update(f.dt)
      helix.render()
      const idx = helix.activeIndex
      if (idx !== lastActive) {
        lastActive = idx
        setActive(idx)
      }
      // counter-parallax kinetic type against the helix rotation
      const shift = (progress * 100) % 50
      if (top.current) top.current.style.transform = `translate3d(${-50 + shift}%,0,0)`
      if (bottom.current) bottom.current.style.transform = `translate3d(${-shift}%,0,0)`
      if (!moving && f.time > busyUntil) {
        unsub?.()
        unsub = null
      }
    }
    const invalidate = (sec = 0.15) => {
      busyUntil = frame.time + sec
      unsub ??= subscribe(tick)
    }

    const onMove = (e: PointerEvent) => {
      if (!helix) return
      const r = cv.getBoundingClientRect()
      helix.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
      invalidate()
    }
    const onLeave = () => {
      helix?.setPointer(10, 10)
      invalidate(0.6)
    }
    let downX = 0
    let downY = 0
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
    }
    const onClick = async (e: MouseEvent) => {
      if (!helix || Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
      const r = cv.getBoundingClientRect()
      helix.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
      const i = helix.pick()
      if (i < 0) return
      audio.click()
      invalidate(2)
      await helix.fly(i)
      navigate(`/work/${PROJECTS[i]!.slug}/`)
    }

    const boot = async () => {
      if (helix || !acquireContext('helix', 2, () => teardown())) return
      const { Helix } = await import('@/components/webgl/Helix')
      if (cancelled) return
      cvEl = mountCanvas(cv)
      helix = new Helix(cvEl, PROJECTS)
      const r = h.getBoundingClientRect()
      helix.resize(r.width, r.height)
      helix.setProgress(progress * (helix.count - 1))
      helix.onHover = (i, color) => {
        el.style.setProperty('--tint', color ?? 'transparent')
        el.dataset.hover = i >= 0 ? 'true' : 'false'
        h.dataset.cursor = i >= 0 ? 'media' : 'drag'
        h.dataset.cursorLabel = i >= 0 ? 'View' : 'Drag'
        if (i >= 0) audio.hover()
      }
      invalidate(0.3)
    }
    const teardown = () => {
      unsub?.()
      unsub = null
      helix?.dispose()
      helix = null
      cvEl?.remove()
      cvEl = null
      releaseContext('helix')
    }

    // mount the scene only while near the viewport (2-context budget)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void boot()
        else teardown()
      },
      { rootMargin: '100% 0px 100% 0px' },
    )
    io.observe(el)
    const ro = new ResizeObserver(() => {
      const r = h.getBoundingClientRect()
      helix?.resize(r.width, r.height)
      invalidate()
    })
    ro.observe(h)

    whenTransitionComplete().then(() => {
      if (cancelled) return
      st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: () => `+=${(mobile ? 2.2 : 3.2) * innerHeight}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          progress = self.progress
          helix?.setProgress(progress * ((helix?.count ?? 1) - 1))
          invalidate()
        },
      })
      // swipe / drag spins the helix with inertia
      obs = Observer.create({
        target: h,
        type: 'touch,pointer',
        dragMinimum: 4,
        lockAxis: true,
        onDrag: (self) => {
          if (Math.abs(self.deltaX) > Math.abs(self.deltaY)) {
            helix?.drag(-self.deltaX)
            invalidate()
          }
        },
        onDragEnd: (self) => {
          helix?.release(-self.velocityX)
          invalidate(1.5)
        },
      })
    })

    h.addEventListener('pointermove', onMove)
    h.addEventListener('pointerleave', onLeave)
    h.addEventListener('pointerdown', onDown)
    h.addEventListener('click', onClick)
    return () => {
      cancelled = true
      io.disconnect()
      ro.disconnect()
      st?.kill()
      obs?.kill()
      h.removeEventListener('pointermove', onMove)
      h.removeEventListener('pointerleave', onLeave)
      h.removeEventListener('pointerdown', onDown)
      h.removeEventListener('click', onClick)
      teardown()
    }
  }, [])

  const p = PROJECTS[active]!

  return (
    <section ref={section} className={styles.helix} data-mode={mode} aria-labelledby="work-title" id="work">
      <div className={styles.tint} aria-hidden="true" />
      <div className={styles.kinetic} aria-hidden="true">
        <div ref={top} className={`top-word ${styles.row}`}>
          {WORD.repeat(6)}
        </div>
        <div ref={bottom} className={`bottom-word ${styles.row} ${styles.rowOutline}`}>
          {WORD.repeat(6)}
        </div>
      </div>

      <div className={`container ${styles.head}`}>
        <span className="t-label">04 — Work</span>
        <h2 id="work-title" className="sr-only">
          Selected work
        </h2>
        <TransitionLink href="/work/" className={`t-label ${styles.all}`}>
          <RollingText>All projects ({PROJECTS.length})</RollingText>
          <Arrow />
        </TransitionLink>
      </div>

      {mode === 'webgl' ? (
        <>
          <div ref={host} className={styles.host} data-cursor="drag" data-cursor-label="Drag">
            <div ref={canvas} className={styles.canvas} aria-hidden="true" />
          </div>
          <div className={`container ${styles.info}`} aria-live="polite">
            <span className="t-label t-dim">
              {String(active + 1).padStart(2, '0')} / {String(PROJECTS.length).padStart(2, '0')}
            </span>
            <TransitionLink href={`/work/${p.slug}/`} className={styles.infoLink}>
              <span className="t-h3">
                {p.client} — {p.title}
              </span>
              <span className="t-label t-dim">
                {p.disciplines.join(' · ')} · {p.year}
              </span>
            </TransitionLink>
          </div>
          {/* Keyboard / screen-reader path through the gallery */}
          <ul className="sr-only">
            {PROJECTS.map((x) => (
              <li key={x.slug}>
                <TransitionLink href={`/work/${x.slug}/`}>
                  {x.client} — {x.title}
                </TransitionLink>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className={`container ${styles.grid} dim-rest`}>
          {PROJECTS.map((x, i) => (
            <li key={x.slug} className="dim-item">
              <TransitionLink href={`/work/${x.slug}/`} className={styles.gridItem} data-cursor="media" data-cursor-label="View">
                <Cover spec={{ seed: x.seed, color: x.color, accent: x.accent, label: x.client, index: String(i + 1).padStart(2, '0') }} alt={`${x.client} ${x.title} — cover artwork`} width={768} height={512} reveal />
                <span className="t-h3">{x.client}</span>
                <span className="t-label t-dim">{x.title}</span>
              </TransitionLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
