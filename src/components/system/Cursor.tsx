'use client'
import { useEffect, useRef, useState } from 'react'
import { subscribe } from '@/lib/motion/engine'
import { frame } from '@/lib/motion/frame'
import { useMotion, type CursorMode } from '@/lib/motion/store'
import { audio } from '@/lib/audio/AudioManager'
import { damp } from '@/lib/motion/tokens'
import styles from './Cursor.module.css'

/**
 * Custom cursor — one root element, GPU-transformed. Dot lerps at 0.18, the
 * trailing ring at 0.09. Mode comes from `data-cursor` on the hovered element
 * (link | drag | media | hidden) with an optional `data-cursor-label`; links
 * and buttons default to `link`. Disabled entirely on (pointer: coarse).
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setEnabled(window.matchMedia('(pointer: fine)').matches)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const r = root.current!
    const d = dot.current!
    const g = ring.current!
    const l = label.current!
    const pos = { dx: -100, dy: -100, rx: -100, ry: -100 }
    let mode: CursorMode = 'default'
    let lastHoverEl: Element | null = null
    let visible = false

    const setMode = (m: CursorMode, text: string) => {
      if (m === mode && l.textContent === text) return
      mode = m
      r.dataset.mode = m
      l.textContent = text
    }

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const t = e.target as Element | null
      if (!t || !t.closest) return
      const tagged = t.closest<HTMLElement>('[data-cursor]')
      const interactive = t.closest('a, button, [role="button"], [role="tab"], select, summary, label')
      const field = t.closest('input, textarea, [contenteditable="true"]')
      if (field) {
        setMode('hidden', '')
      } else if (tagged) {
        setMode((tagged.dataset.cursor as CursorMode) || 'link', tagged.dataset.cursorLabel ?? '')
      } else if (interactive) {
        setMode('link', '')
      } else {
        setMode('default', '')
      }
      const hoverEl = tagged ?? interactive
      if (hoverEl && hoverEl !== lastHoverEl) {
        audio.hover()
        frame.energy.hover = Math.max(frame.energy.hover, 0.5)
      }
      lastHoverEl = hoverEl
    }
    const onLeaveDoc = () => {
      visible = false
      r.style.opacity = '0'
    }
    const onEnterDoc = () => {
      visible = true
      r.style.opacity = '1'
    }

    const unsubStore = useMotion.subscribe((s) => {
      r.style.setProperty('--hold', String(s.hold))
      r.dataset.holding = s.hold > 0.001 ? 'true' : 'false'
      if (s.cursor.mode !== 'default' || s.cursor.label) setMode(s.cursor.mode, s.cursor.label)
    })

    const unsub = subscribe((f) => {
      if (!f.pointer.active) return
      if (!visible) onEnterDoc()
      const kd = damp(0.18, f.dt)
      const kr = damp(0.09, f.dt)
      pos.dx += (f.pointer.x - pos.dx) * kd
      pos.dy += (f.pointer.y - pos.dy) * kd
      pos.rx += (f.pointer.x - pos.rx) * kr
      pos.ry += (f.pointer.y - pos.ry) * kr
      d.style.transform = `translate3d(${pos.dx.toFixed(1)}px, ${pos.dy.toFixed(1)}px, 0)`
      g.style.transform = `translate3d(${pos.rx.toFixed(1)}px, ${pos.ry.toFixed(1)}px, 0)`
    })

    document.addEventListener('pointerover', onOver, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeaveDoc)
    document.documentElement.addEventListener('pointerenter', onEnterDoc)
    return () => {
      unsub()
      unsubStore()
      document.removeEventListener('pointerover', onOver)
      document.documentElement.removeEventListener('pointerleave', onLeaveDoc)
      document.documentElement.removeEventListener('pointerenter', onEnterDoc)
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <div ref={root} className={styles.cursor} data-mode="default" aria-hidden="true" style={{ opacity: 0 }}>
      <div ref={ring} className={styles.ringPos}>
        <div className={styles.ring}>
          <span className={styles.sweep} />
          <span className={styles.glyph}>↔</span>
          <span ref={label} className={styles.label} />
        </div>
      </div>
      <div ref={dot} className={styles.dotPos}>
        <div className={styles.dot} />
      </div>
    </div>
  )
}
