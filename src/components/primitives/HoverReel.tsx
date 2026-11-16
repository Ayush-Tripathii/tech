'use client'
import { useEffect, useRef } from 'react'
import { drawCover } from '@/lib/content/generative'
import styles from './HoverReel.module.css'

/**
 * Video-on-hover card. With `src` it's a real <video> (poster frame via #t=0.1,
 * playsinline muted, play on enter / pause + reset on leave). Without a file,
 * the identical mechanism drives a generative canvas "reel" so the card is
 * never dead. 0.3s scale 1→1.04, corner mono label slides up.
 */
export function HoverReel({ src, label, title }: { src?: string; label: string; title: string }) {
  const host = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const v = video.current
    const c = canvas.current
    const ctx = c?.getContext('2d')
    let raf = 0
    let t0 = 0
    const paint = (time: number) => {
      if (!c || !ctx) return
      const t = (time - t0) / 1000
      drawCover(ctx, { seed: 5 + Math.floor(t * 6) % 4, color: '#0D0F14', accent: ['#3B82F6', '#22D3EE', '#A78BFA', '#D7FF3E'][Math.floor(t * 1.5) % 4]! }, c.width, c.height)
      ctx.fillStyle = 'rgba(244,245,247,0.8)'
      ctx.font = '500 13px ui-monospace, monospace'
      ctx.fillText(`TC 00:00:${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t * 24) % 24)).padStart(2, '0')}`, 18, c.height - 22)
      raf = requestAnimationFrame(paint)
    }
    if (c && ctx) {
      c.width = 640
      c.height = 400
      drawCover(ctx, { seed: 5, color: '#0D0F14', accent: '#22D3EE' }, c.width, c.height)
    }
    const enter = () => {
      if (v) void v.play().catch(() => {})
      else {
        t0 = performance.now()
        raf = requestAnimationFrame(paint)
      }
    }
    const leave = () => {
      if (v) {
        v.pause()
        v.currentTime = 0.1
      } else {
        cancelAnimationFrame(raf)
        if (c && ctx) drawCover(ctx, { seed: 5, color: '#0D0F14', accent: '#22D3EE' }, c.width, c.height)
      }
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('focusin', enter)
    el.addEventListener('focusout', leave)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('focusin', enter)
      el.removeEventListener('focusout', leave)
    }
  }, [])

  return (
    <div ref={host} className={styles.reel} data-cursor="media" data-cursor-label="Play" tabIndex={0} aria-label={title}>
      <div className={styles.media}>
        {src ? (
          <video ref={video} src={`${src}#t=0.1`} muted playsInline loop preload="metadata" aria-hidden="true" />
        ) : (
          <canvas ref={canvas} aria-hidden="true" />
        )}
      </div>
      <div className={styles.meta}>
        <span className="t-label">{title}</span>
        <span className={`t-label ${styles.corner}`}>
          <span>{label}</span>
        </span>
      </div>
    </div>
  )
}
