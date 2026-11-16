'use client'
/**
 * Scroll-scrubbed frame sequence.
 *
 * Sources
 *   UrlFrameSource        — pre-rendered WebP frames listed in /frames/services/manifest.json
 *                           { "count": 240, "pattern": "/frames/services/f_%04d.webp",
 *                             "mobileCount": 120, "mobilePattern": "/frames/services/m/f_%04d.webp" }
 *                           First 24 frames load eagerly; the rest stream on idle.
 *   ProceduralFrameSource — deterministic 2D render of the Lattice Core rotating,
 *                           cracking and reforming. Used when no manifest is deployed.
 *
 * Player: a raw WebGL2 full-screen quad (no three.js) so the palette inversion
 * is a shader uniform (`uInvert`), not a CSS filter. Hue-preserving: luminance
 * flips, spectrum light stays spectrum.
 */
import { corePanels, type Tri } from './latticeGeometry'
import { onIdle } from '@/lib/motion/idle'

export interface FrameSource {
  readonly count: number
  readonly width: number
  readonly height: number
  /** Nearest *available* frame index to i. */
  nearest(i: number): number
  get(i: number): TexImageSource | null
  /** Resolves when the eager set is decoded. */
  ready: Promise<void>
  dispose(): void
}

/* ------------------------------------------------------------------ */
/*  URL source                                                         */
/* ------------------------------------------------------------------ */

interface Manifest {
  count: number
  pattern: string
  mobileCount?: number
  mobilePattern?: string
}

export class UrlFrameSource implements FrameSource {
  readonly count: number
  width = 1600
  height = 900
  private frames: (ImageBitmap | HTMLImageElement | null)[]
  private cancelled = false
  ready: Promise<void>

  constructor(private pattern: string, count: number) {
    this.count = count
    this.frames = new Array(count).fill(null)
    const eager = Math.min(24, count)
    this.ready = Promise.all(Array.from({ length: eager }, (_, i) => this.load(i))).then(() => {
      // Stream the rest on idle, a few at a time.
      let next = eager
      const pump = () => {
        if (this.cancelled || next >= count) return
        const batch = Array.from({ length: Math.min(6, count - next) }, () => this.load(next++))
        void Promise.all(batch).then(() => onIdle(pump, 400))
      }
      onIdle(pump, 400)
    })
  }

  private url(i: number) {
    return this.pattern.replace(/%0(\d)d/, (_, n: string) => String(i + 1).padStart(Number(n), '0'))
  }

  private async load(i: number) {
    try {
      const res = await fetch(this.url(i))
      if (!res.ok) return
      const bmp = await createImageBitmap(await res.blob())
      if (this.cancelled) {
        bmp.close()
        return
      }
      this.width = bmp.width
      this.height = bmp.height
      this.frames[i] = bmp
    } catch {
      /* skip */
    }
  }

  nearest(i: number) {
    const k = Math.max(0, Math.min(this.count - 1, Math.round(i)))
    for (let d = 0; d < this.count; d++) {
      if (this.frames[k - d]) return k - d
      if (this.frames[k + d]) return k + d
    }
    return -1
  }

  get(i: number) {
    const k = this.nearest(i)
    return k >= 0 ? (this.frames[k] as TexImageSource) : null
  }

  dispose() {
    this.cancelled = true
    for (const f of this.frames) if (f && 'close' in f) f.close()
    this.frames = []
  }
}

export async function loadManifest(mobile: boolean): Promise<UrlFrameSource | null> {
  // Opt-in: set NEXT_PUBLIC_SERVICES_FRAMES=1 once /public/frames/services/ is deployed.
  if (process.env.NEXT_PUBLIC_SERVICES_FRAMES !== '1') return null
  try {
    const res = await fetch('/frames/services/manifest.json', { cache: 'force-cache' })
    if (!res.ok) return null
    const m = (await res.json()) as Manifest
    if (mobile && m.mobilePattern && m.mobileCount) return new UrlFrameSource(m.mobilePattern, m.mobileCount)
    return new UrlFrameSource(m.pattern, m.count)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Procedural source                                                  */
/* ------------------------------------------------------------------ */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export class ProceduralFrameSource implements FrameSource {
  readonly count: number
  readonly width: number
  readonly height: number
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tris: Tri[]
  private rand: number[]
  private last = -1
  ready = Promise.resolve()

  constructor(count: number, width: number, height: number) {
    this.count = count
    this.width = width
    this.height = height
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    this.ctx = this.canvas.getContext('2d')!
    this.tris = corePanels(false)
    this.rand = this.tris.map((_, i) => ((Math.sin(i * 91.7) * 43758.5453) % 1 + 1) % 1)
  }

  nearest(i: number) {
    return Math.max(0, Math.min(this.count - 1, Math.round(i)))
  }

  get(i: number) {
    const k = this.nearest(i)
    if (k !== this.last) {
      this.draw(k)
      this.last = k
    }
    return this.canvas
  }

  private draw(f: number) {
    const { ctx, width: W, height: H } = this
    const u = f / (this.count - 1)
    const crack = smooth(0.28, 0.48, u) * (1 - smooth(0.62, 0.86, u))
    const yaw = u * Math.PI * 2.4
    const pitch = 0.4 + Math.sin(u * Math.PI * 2) * 0.25
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
    const rot = (x: number, y: number, z: number): [number, number, number] => {
      const x1 = x * cy + z * sy
      const z1 = -x * sy + z * cy
      const y2 = y * cp - z1 * sp
      const z2 = y * sp + z1 * cp
      return [x1, y2, z2]
    }
    const camZ = 4.4
    const focal = H * 0.95
    const proj = (p: [number, number, number]) => {
      const s = focal / (camZ - p[2])
      return [W / 2 + p[0] * s, H / 2 - p[1] * s] as const
    }

    // ground
    ctx.fillStyle = '#06070A'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(244,245,247,0.035)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x < W; x += 64) {
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, H)
    }
    for (let y = 0; y < H; y += 64) {
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(W, y + 0.5)
    }
    ctx.stroke()

    // inner light escaping through the cracks
    if (crack > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.6)
      g.addColorStop(0, `rgba(255,255,255,${0.55 * crack})`)
      g.addColorStop(0.2, `rgba(34,211,238,${0.35 * crack})`)
      g.addColorStop(0.45, `rgba(167,139,250,${0.18 * crack})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }

    const L = [-0.45, 0.6, 0.66]
    const faces = this.tris.map((t, i) => {
      const r = this.rand[i]!
      const push = crack * (0.35 + r * 0.9)
      const spin = crack * (r - 0.5) * 1.6
      const cs = Math.cos(spin), sn = Math.sin(spin)
      const pts = [t.a, t.b, t.c].map((v) => {
        // spin around the panel normal-ish axis (approximate: around centroid in local xy)
        const lx = v.x - t.centroid.x, ly = v.y - t.centroid.y, lz = v.z - t.centroid.z
        const sx2 = lx * cs - ly * sn, sy2 = lx * sn + ly * cs
        return rot(
          t.centroid.x + sx2 * 0.94 + t.normal.x * push,
          t.centroid.y + sy2 * 0.94 + t.normal.y * push,
          t.centroid.z + lz * 0.94 + t.normal.z * push,
        )
      })
      const n = rot(t.normal.x, t.normal.y, t.normal.z)
      const depth = (pts[0]![2] + pts[1]![2] + pts[2]![2]) / 3
      const lambert = Math.max(0, n[0] * L[0]! + n[1] * L[1]! + n[2] * L[2]!)
      return { pts, n, depth, lambert, r }
    })
    faces.sort((a, b) => a.depth - b.depth)

    for (const f2 of faces) {
      const p = f2.pts.map(proj)
      const front = f2.n[2] > 0
      const spec = Math.pow(f2.lambert, 12)
      const base = front ? 0.05 + f2.lambert * 0.32 + spec * 0.5 : 0.02 + f2.lambert * 0.06
      ctx.beginPath()
      ctx.moveTo(p[0]![0], p[0]![1])
      ctx.lineTo(p[1]![0], p[1]![1])
      ctx.lineTo(p[2]![0], p[2]![1])
      ctx.closePath()
      ctx.fillStyle = `rgba(232,240,255,${base.toFixed(3)})`
      ctx.fill()
      const edgeA = (front ? 0.22 : 0.06) + crack * 0.6
      const hue = f2.r < 0.33 ? '59,130,246' : f2.r < 0.66 ? '34,211,238' : '167,139,250'
      ctx.strokeStyle = crack > 0.05 && f2.r > 0.4 ? `rgba(${hue},${edgeA.toFixed(3)})` : `rgba(244,245,247,${edgeA.toFixed(3)})`
      ctx.lineWidth = front ? 1.2 : 0.8
      ctx.stroke()
    }

    // frame metadata
    ctx.fillStyle = 'rgba(244,245,247,0.35)'
    ctx.font = '500 13px ui-monospace, monospace'
    ctx.fillText(`FRAME ${String(f + 1).padStart(3, "0")}/${this.count}`, W * 0.08, H - 40)
    ctx.textAlign = 'right'
    ctx.fillText(crack > 0.05 ? `FRACTURE ${(crack * 100).toFixed(0).padStart(3, '0')}%` : "FORMATION HOLD", W * 0.92, H - 40)
    ctx.textAlign = 'left'
  }

  dispose() {
    this.canvas.width = 0
    this.canvas.height = 0
  }
}

/* ------------------------------------------------------------------ */
/*  Player                                                             */
/* ------------------------------------------------------------------ */

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(aPos, 0.0, 1.0); }`

const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform float uInvert; uniform vec2 uScale; uniform vec2 uOffset;
void main(){
  vec2 uv = vUv * uScale + uOffset;
  vec3 c = texture(uTex, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 inv = clamp(c + (1.0 - 2.0 * l), 0.0, 1.0);   // hue-preserving luminance flip
  vec3 col = mix(c, inv, uInvert);
  // keep the ground EXACTLY on the palette (#06070A → #F4F5F7)
  vec3 voidC = vec3(0.0235, 0.0275, 0.0392);
  vec3 invC = vec3(0.957, 0.961, 0.969);
  float ground = 1.0 - smoothstep(0.0, 0.06, distance(c, voidC));
  col = mix(col, mix(voidC, invC, uInvert), ground);
  o = vec4(col, 1.0);
}`

export class FramePlayer {
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private tex: WebGLTexture
  private buf: WebGLBuffer
  private u: Record<string, WebGLUniformLocation | null> = {}
  private lastSrc: TexImageSource | null = null
  private lastIndex = -1
  private invert = 0
  private canvas: HTMLCanvasElement
  private imgW = 16
  private imgH = 9

  static create(canvas: HTMLCanvasElement): FramePlayer | null {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' })
    return gl ? new FramePlayer(canvas, gl) : null
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas
    this.gl = gl
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const p = gl.createProgram()!
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(p)
    this.prog = p
    gl.useProgram(p)
    this.buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(p, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const n of ['uTex', 'uInvert', 'uScale', 'uOffset']) this.u[n] = gl.getUniformLocation(p, n)
    this.tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(this.u.uTex!, 0)
  }

  resize(w: number, h: number, dpr: number) {
    this.canvas.width = Math.max(1, Math.round(w * dpr))
    this.canvas.height = Math.max(1, Math.round(h * dpr))
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.lastIndex = -1
  }

  /** Draw frame `index`; uploads only when the frame actually changes. */
  draw(source: FrameSource, index: number, invert: number) {
    const gl = this.gl
    const k = source.nearest(index)
    if (k < 0) return
    const changedFrame = k !== this.lastIndex
    if (!changedFrame && Math.abs(invert - this.invert) < 0.001) return
    if (changedFrame) {
      const img = source.get(k)
      if (!img) return
      gl.bindTexture(gl.TEXTURE_2D, this.tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      this.lastSrc = img
      this.lastIndex = k
      this.imgW = source.width
      this.imgH = source.height
    }
    this.invert = invert
    // object-fit: cover
    const cr = this.canvas.width / this.canvas.height
    const ir = this.imgW / this.imgH
    let sx = 1, sy = 1
    if (cr > ir) sy = ir / cr
    else sx = cr / ir
    gl.uniform2f(this.u.uScale!, sx, sy)
    gl.uniform2f(this.u.uOffset!, (1 - sx) / 2, (1 - sy) / 2)
    gl.uniform1f(this.u.uInvert!, invert)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  dispose() {
    const gl = this.gl
    gl.deleteTexture(this.tex)
    gl.deleteBuffer(this.buf)
    gl.deleteProgram(this.prog)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.lastSrc = null
  }
}
