'use client'
/**
 * Depth-mapped portrait: ONE fragment shader samples a precomputed depth map
 * to parallax the image against the cursor — 3D illusion with zero geometry.
 * Uses /about/portrait.jpg + /about/depth.png if deployed; otherwise both
 * maps are generated procedurally (a studio render of the Lattice Core).
 */
import { mulberry32 } from '@/lib/content/generative'

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(aPos, 0.0, 1.0); }`
const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uImg; uniform sampler2D uDepth; uniform vec2 uMouse; uniform float uStrength; uniform vec2 uScale; uniform float uTime;
void main(){
  vec2 uv = (vUv - 0.5) * uScale + 0.5;
  float d = texture(uDepth, uv).r;
  // two-tap refinement reduces edge tearing on steep depth
  vec2 off = uMouse * uStrength * (d - 0.5);
  float d2 = texture(uDepth, uv + off).r;
  vec2 p = uv + uMouse * uStrength * (mix(d, d2, 0.5) - 0.5);
  vec3 c = texture(uImg, p).rgb;
  c *= 0.92 + 0.08 * sin(uTime * 0.6 + d * 6.0);
  o = vec4(c, 1.0);
}`

function proceduralMaps(w: number, h: number) {
  const img = document.createElement('canvas')
  const dep = document.createElement('canvas')
  img.width = dep.width = w
  img.height = dep.height = h
  const ci = img.getContext('2d')!
  const cd = dep.getContext('2d')!
  const rnd = mulberry32(2020)
  // backdrop
  const bg = ci.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0d1018')
  bg.addColorStop(1, '#06070A')
  ci.fillStyle = bg
  ci.fillRect(0, 0, w, h)
  cd.fillStyle = '#000'
  cd.fillRect(0, 0, w, h)
  // floor plane gradient depth
  const fg = cd.createLinearGradient(0, h * 0.6, 0, h)
  fg.addColorStop(0, '#202020')
  fg.addColorStop(1, '#707070')
  cd.fillStyle = fg
  cd.fillRect(0, h * 0.6, w, h * 0.4)
  // the object: a faceted gem, facets shaded + depth by distance to centre
  const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.3
  const N = 14
  const pts = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.15
    const r = R * (0.85 + rnd() * 0.18)
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.05] as const
  })
  const core = [cx + R * 0.08, cy - R * 0.1] as const
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % N]!
    const lit = 0.25 + 0.75 * Math.max(0, Math.cos((i / N) * Math.PI * 2 + 2.2))
    const hue = i % 5 === 0 ? [34, 211, 238] : i % 7 === 0 ? [167, 139, 250] : [232, 238, 248]
    ci.beginPath()
    ci.moveTo(core[0], core[1])
    ci.lineTo(p[0], p[1])
    ci.lineTo(q[0], q[1])
    ci.closePath()
    const g = ci.createLinearGradient(core[0], core[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    g.addColorStop(0, `rgba(${hue.join(',')},${(0.5 * lit + 0.25).toFixed(3)})`)
    g.addColorStop(1, `rgba(${hue.join(',')},${(0.08 + 0.2 * lit).toFixed(3)})`)
    ci.fillStyle = g
    ci.fill()
    ci.strokeStyle = 'rgba(244,245,247,0.35)'
    ci.lineWidth = 1.5
    ci.stroke()
    const dg = cd.createRadialGradient(core[0], core[1], 0, core[0], core[1], R * 1.1)
    dg.addColorStop(0, '#ffffff')
    dg.addColorStop(1, '#5a5a5a')
    cd.fillStyle = dg
    cd.beginPath()
    cd.moveTo(core[0], core[1])
    cd.lineTo(p[0], p[1])
    cd.lineTo(q[0], q[1])
    cd.closePath()
    cd.fill()
  })
  // orbit rings (mid depth)
  ci.strokeStyle = 'rgba(232,236,242,0.45)'
  cd.strokeStyle = '#9a9a9a'
  for (const [rx, ry, rot] of [[R * 1.5, R * 0.42, -0.3], [R * 1.7, R * 0.6, 0.5]] as const) {
    for (const c of [ci, cd]) {
      c.lineWidth = c === cd ? 10 : 1.5
      c.beginPath()
      c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 1.7)
      c.stroke()
    }
  }
  // soft grain + depth blur
  cd.filter = 'blur(8px)'
  cd.drawImage(dep, 0, 0)
  cd.filter = 'none'
  return { img, dep }
}

async function tryLoad(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => resolve(null)
    i.src = url
  })
}

export class DepthPortrait {
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private tex: WebGLTexture[] = []
  private u: Record<string, WebGLUniformLocation | null> = {}
  private canvas: HTMLCanvasElement
  private mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  private imgAspect = 4 / 5

  static async create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) return null
    const p = new DepthPortrait(canvas, gl)
    // Opt-in: set NEXT_PUBLIC_ABOUT_PORTRAIT=1 once /public/about/{portrait.jpg,depth.png} exist.
    const real = process.env.NEXT_PUBLIC_ABOUT_PORTRAIT === '1'
    const [img, dep] = real ? await Promise.all([tryLoad('/about/portrait.jpg'), tryLoad('/about/depth.png')]) : [null, null]
    if (img && dep) {
      p.upload(img, dep)
      p.imgAspect = img.width / img.height
    } else {
      const m = proceduralMaps(1000, 1250)
      p.upload(m.img, m.dep)
    }
    return p
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas
    this.gl = gl
    const sh = (t: number, s: string) => {
      const x = gl.createShader(t)!
      gl.shaderSource(x, s)
      gl.compileShader(x)
      return x
    }
    const p = gl.createProgram()!
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(p)
    gl.useProgram(p)
    this.prog = p
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(p, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const n of ['uImg', 'uDepth', 'uMouse', 'uStrength', 'uScale', 'uTime']) this.u[n] = gl.getUniformLocation(p, n)
    gl.uniform1i(this.u.uImg!, 0)
    gl.uniform1i(this.u.uDepth!, 1)
    gl.uniform1f(this.u.uStrength!, 0.045)
  }

  private upload(img: TexImageSource, dep: TexImageSource) {
    const gl = this.gl
    ;[img, dep].forEach((src, i) => {
      const t = gl.createTexture()!
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
      this.tex.push(t)
    })
  }

  resize(w: number, h: number) {
    const dpr = Math.min(devicePixelRatio, 1.5)
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    const cr = w / h
    // cover-fit, inset slightly so parallax never shows an edge
    const sx = cr > this.imgAspect ? 1 : cr / this.imgAspect
    const sy = cr > this.imgAspect ? this.imgAspect / cr : 1
    this.gl.uniform2f(this.u.uScale!, sx * 0.92, sy * 0.92)
  }

  setPointer(nx: number, ny: number) {
    this.mouse.tx = nx
    this.mouse.ty = -ny
  }

  render(time: number, dt: number) {
    const k = 1 - Math.pow(0.92, dt * 60)
    this.mouse.x += (this.mouse.tx - this.mouse.x) * k
    this.mouse.y += (this.mouse.ty - this.mouse.y) * k
    const gl = this.gl
    gl.uniform2f(this.u.uMouse!, this.mouse.x, this.mouse.y)
    gl.uniform1f(this.u.uTime!, time)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  dispose() {
    this.tex.forEach((t) => this.gl.deleteTexture(t))
    this.gl.deleteProgram(this.prog)
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
