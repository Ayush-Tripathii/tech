'use client'
/**
 * Generative cover art. Every project/culture image on the site is drawn
 * procedurally from a seed — no stock imagery. Covers are cached per
 * (seed, size) and reused by the DOM (as data URLs / canvases) and by WebGL
 * (as CanvasTextures).
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface CoverSpec {
  seed: number
  color: string
  accent: string
  label?: string
  index?: string
}

const cache = new Map<string, HTMLCanvasElement>()

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

export function drawCover(ctx: CanvasRenderingContext2D, spec: CoverSpec, w: number, h: number) {
  const rnd = mulberry32(spec.seed * 9973)
  const { color, accent } = spec
  const s = Math.min(w, h)

  // Ground: deep gradient of the dominant colour
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, rgba(color, 1))
  g.addColorStop(1, '#06070A')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Soft key light
  const lx = w * (0.25 + rnd() * 0.5)
  const ly = h * (0.2 + rnd() * 0.4)
  const rg = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.9)
  rg.addColorStop(0, rgba(accent, 0.55))
  rg.addColorStop(0.4, rgba(accent, 0.12))
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, w, h)

  // Precision grid
  ctx.strokeStyle = 'rgba(244,245,247,0.06)'
  ctx.lineWidth = Math.max(1, s / 600)
  const step = s / 12
  ctx.beginPath()
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()

  const mode = spec.seed % 4
  ctx.save()
  ctx.translate(w / 2, h / 2)
  if (mode === 0) {
    // Faceted shard field
    for (let i = 0; i < 26; i++) {
      const r = s * (0.08 + rnd() * 0.32)
      const a = rnd() * Math.PI * 2
      const cx = Math.cos(a) * r * 0.9
      const cy = Math.sin(a) * r * 0.6
      ctx.beginPath()
      for (let k = 0; k < 3; k++) {
        const aa = a + (k / 3) * Math.PI * 2 + rnd() * 0.5
        const rr = s * (0.04 + rnd() * 0.1)
        ctx.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr)
      }
      ctx.closePath()
      ctx.fillStyle = rgba(rnd() > 0.7 ? accent : '#F4F5F7', 0.05 + rnd() * 0.18)
      ctx.fill()
      ctx.strokeStyle = rgba(accent, 0.35)
      ctx.stroke()
    }
  } else if (mode === 1) {
    // Concentric orbit arcs
    for (let i = 0; i < 9; i++) {
      ctx.beginPath()
      const r = s * (0.08 + i * 0.045)
      const start = rnd() * Math.PI * 2
      ctx.arc(0, 0, r, start, start + Math.PI * (0.6 + rnd() * 1.2))
      ctx.strokeStyle = rgba(i % 3 === 0 ? accent : '#F4F5F7', 0.25 + rnd() * 0.5)
      ctx.lineWidth = Math.max(1, s / (180 + rnd() * 300))
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.05, 0, Math.PI * 2)
    ctx.fillStyle = accent
    ctx.fill()
  } else if (mode === 2) {
    // Telemetry bars
    const n = 28
    const bw = (w * 0.7) / n
    for (let i = 0; i < n; i++) {
      const bh = h * (0.08 + Math.pow(rnd(), 1.6) * 0.5)
      ctx.fillStyle = rgba(i % 7 === 3 ? accent : '#F4F5F7', i % 7 === 3 ? 0.9 : 0.16 + rnd() * 0.2)
      ctx.fillRect(-w * 0.35 + i * bw, h * 0.28 - bh, bw * 0.6, bh)
    }
    ctx.strokeStyle = rgba(accent, 0.8)
    ctx.lineWidth = Math.max(1.5, s / 300)
    ctx.beginPath()
    for (let i = 0; i <= 40; i++) {
      const x = -w * 0.35 + (i / 40) * w * 0.7
      const y = -h * 0.05 + Math.sin(i * 0.4 + rnd()) * h * 0.06 - i * h * 0.004
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  } else {
    // Device frame + interface blocks
    const fw = s * 0.42
    const fh = s * 0.78
    ctx.rotate(-0.08 + rnd() * 0.16)
    ctx.fillStyle = 'rgba(6,7,10,0.65)'
    ctx.strokeStyle = 'rgba(244,245,247,0.25)'
    ctx.lineWidth = Math.max(1, s / 400)
    roundRect(ctx, -fw / 2, -fh / 2, fw, fh, s * 0.04)
    ctx.fill()
    ctx.stroke()
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = rgba(i === 1 ? accent : '#F4F5F7', i === 1 ? 0.85 : 0.1 + rnd() * 0.12)
      roundRect(ctx, -fw * 0.4, -fh * 0.4 + i * fh * 0.13, fw * (0.4 + rnd() * 0.4), fh * 0.08, s * 0.012)
      ctx.fill()
    }
  }
  ctx.restore()

  // Grain
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 14
    d[i] = d[i]! + n
    d[i + 1] = d[i + 1]! + n
    d[i + 2] = d[i + 2]! + n
  }
  ctx.putImageData(img, 0, 0)

  // Label
  if (spec.label) {
    ctx.fillStyle = 'rgba(244,245,247,0.7)'
    ctx.font = `500 ${Math.round(s * 0.032)}px ui-monospace, monospace`
    ctx.textBaseline = 'top'
    ctx.fillText(spec.label.toUpperCase(), s * 0.05, s * 0.05)
    if (spec.index) {
      ctx.textAlign = 'right'
      ctx.fillText(spec.index, w - s * 0.05, s * 0.05)
      ctx.textAlign = 'left'
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function coverCanvas(spec: CoverSpec, w = 960, h = 640): HTMLCanvasElement {
  const key = `${spec.seed}:${w}x${h}:${spec.label ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (ctx) drawCover(ctx, spec, w, h)
  cache.set(key, c)
  return c
}

const urlCache = new Map<string, string>()
export function coverURL(spec: CoverSpec, w = 960, h = 640): string {
  const key = `${spec.seed}:${w}x${h}:${spec.label ?? ''}`
  const hit = urlCache.get(key)
  if (hit) return hit
  const url = coverCanvas(spec, w, h).toDataURL('image/webp', 0.86)
  urlCache.set(key, url)
  return url
}

/**
 * Client-side dominant colour: downsample to 72×72, quantise into coarse
 * 4-bit-per-channel buckets, return the modal bucket's mean colour.
 * Near-black / near-white pixels are down-weighted so the ground doesn't win.
 */
export function dominantColor(source: CanvasImageSource): string {
  const c = document.createElement('canvas')
  c.width = 72
  c.height = 72
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#0D0F14'
  ctx.drawImage(source, 0, 0, 72, 72)
  const d = ctx.getImageData(0, 0, 72, 72).data
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    const weight = max < 24 || min > 235 ? 0.1 : 0.3 + sat
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n += weight
    e.r += r * weight
    e.g += g * weight
    e.b += b * weight
    buckets.set(key, e)
  }
  let best: { n: number; r: number; g: number; b: number } | null = null
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e
  if (!best) return '#0D0F14'
  const hx = (v: number) => Math.round(v / best!.n).toString(16).padStart(2, '0')
  return `#${hx(best.r)}${hx(best.g)}${hx(best.b)}`
}
