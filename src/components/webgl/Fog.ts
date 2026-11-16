'use client'
/**
 * Volumetric fog — domain-warped multi-octave simplex noise on a full-screen
 * quad (raw WebGL2, rendered at half resolution). `uHoverEnergy` comes from
 * the shared atmosphere context: pluck a wire and the smoke reacts.
 */
const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform float uTime; uniform float uHoverEnergy; uniform vec2 uRes; uniform float uX;
// --- 3D simplex noise (Ashima / Stefan Gustavson, MIT) ---
vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * snoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main(){
  vec2 uv = vUv; vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.2;
  float t = uTime * 0.05; float e = uHoverEnergy;
  // domain warp, turbulence scaled by energy
  vec2 q = vec2(fbm(vec3(p, t)), fbm(vec3(p + 5.2, t * 1.1)));
  vec2 r = vec2(fbm(vec3(p + 2.0 * q + vec2(1.7, 9.2), t * 1.6 + e * 0.6)), fbm(vec3(p + 2.0 * q + vec2(8.3, 2.8), t * 1.3)));
  float f = fbm(vec3(p + (2.0 + e * 2.5) * r, t * 2.0));
  float density = smoothstep(-0.3, 0.9, f) * smoothstep(1.05, 0.0, uv.y) ;
  float near = exp(-pow((uv.x - uX) * 3.0, 2.0)) * e;
  vec3 voidC = vec3(0.0235, 0.0275, 0.039);
  vec3 cool = mix(vec3(0.231, 0.51, 0.965), vec3(0.133, 0.827, 0.933), q.x * 0.5 + 0.5);
  vec3 col = voidC + vec3(0.09) * density + cool * density * (0.05 + e * 0.22 + near * 0.3) + vec3(0.655, 0.545, 0.98) * r.y * r.y * 0.04 * (1.0 + e);
  o = vec4(col, 1.0);
}`

export class Fog {
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private buf: WebGLBuffer
  private u: Record<string, WebGLUniformLocation | null> = {}
  private canvas: HTMLCanvasElement

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' })
    return gl ? new Fog(canvas, gl) : null
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
    gl.useProgram(p)
    this.prog = p
    this.buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(p, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const n of ['uTime', 'uHoverEnergy', 'uRes', 'uX']) this.u[n] = gl.getUniformLocation(p, n)
  }

  /** Half resolution: fog is soft by nature, so the pixels are free. */
  resize(w: number, h: number) {
    this.canvas.width = Math.max(1, Math.round(w * 0.5))
    this.canvas.height = Math.max(1, Math.round(h * 0.5))
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.gl.uniform2f(this.u.uRes!, this.canvas.width, this.canvas.height)
  }

  render(time: number, energy: number, x: number) {
    const gl = this.gl
    gl.uniform1f(this.u.uTime!, time)
    gl.uniform1f(this.u.uHoverEnergy!, energy)
    gl.uniform1f(this.u.uX!, x)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  dispose() {
    const gl = this.gl
    gl.deleteBuffer(this.buf)
    gl.deleteProgram(this.prog)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
