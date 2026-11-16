'use client'
/**
 * DOUBLE HELIX GALLERY — cards on two intertwined strands around a vertical
 * axis. Each card's plane is bent per-frame in the vertex shader onto the
 * helix curvature. Rendering is ON DEMAND: scroll updates and interactions
 * call `invalidate()`; a short-lived tick runs only while springs settle.
 */
import * as THREE from 'three'
import { gsap } from '@/lib/gsap'
import { EASE, damp } from '@/lib/motion/tokens'
import { coverCanvas, dominantColor } from '@/lib/content/generative'
import { createRenderer, disposeObject, disposeRenderer } from '@/lib/webgl/three-utils'
import type { Project } from '@/lib/content/site'

const R = 3.2
const CARD_W = 1.9
const CARD_H = 1.25
const STEP = Math.PI + 0.42 // consecutive cards alternate strands → double helix
const DY = 0.78

const vert = /* glsl */ `
  uniform float uTheta; uniform float uR; uniform float uY; uniform float uLift;
  uniform float uScale; uniform float uFlat;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewDir;
  void main(){
    vUv = uv;
    float r = uR + uLift;
    float a = uTheta + (position.x * uScale) / r;
    vec3 bent = vec3(sin(a) * r, position.y * uScale + uY, cos(a) * r);
    vec3 nB = vec3(sin(a), 0.0, cos(a));
    vec3 c = vec3(sin(uTheta) * r, uY, cos(uTheta) * r);
    vec3 tangent = vec3(cos(uTheta), 0.0, -sin(uTheta));
    vec3 flatP = c + tangent * position.x * uScale + vec3(0.0, 1.0, 0.0) * position.y * uScale;
    vec3 p = mix(bent, flatP, uFlat);
    vec3 n = normalize(mix(nB, vec3(sin(uTheta), 0.0, cos(uTheta)), uFlat));
    vec4 world = modelMatrix * vec4(p, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * n);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`

const frag = /* glsl */ `
  uniform sampler2D uMap; uniform vec2 uSize; uniform float uRadius;
  uniform float uSat; uniform vec3 uRim; uniform float uHover; uniform float uAlpha;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewDir;
  float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main(){
    vec2 px = (vUv - 0.5) * uSize;
    float d = sdRound(px, uSize * 0.5, uRadius);
    float mask = 1.0 - smoothstep(-1.0, 0.5, d);
    if (mask < 0.01) discard;
    vec3 col = texture2D(uMap, vUv).rgb;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, uSat);
    col *= mix(0.45, 1.0, uSat);
    float ndv = clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 3.0);
    // edge rim: fresnel + a thin inner border along the rounded rect
    float edge = 1.0 - smoothstep(0.0, 2.5, abs(d + 1.5));
    col += uRim * (fres * 0.9 + edge * (0.12 + uHover * 0.5));
    if (!gl_FrontFacing) col *= 0.22;
    gl_FragColor = vec4(col, mask * uAlpha);
    #include <colorspace_fragment>
  }`

interface Card {
  mesh: THREE.Mesh
  mat: THREE.ShaderMaterial
  theta: number
  y: number
  hover: number
  hoverV: number
  sat: number
  color: string
  project: Project
  tex: THREE.CanvasTexture
}

export class Helix {
  readonly renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60)
  private group = new THREE.Group()
  private cards: Card[] = []
  private t = 0
  private dragOffset = 0
  private dragVel = 0
  private hovered = -1
  private ndc = new THREE.Vector2(10, 10)
  private raycaster = new THREE.Raycaster()
  private inv = new THREE.Matrix4()
  private flying = false
  private camZ = 8
  private width = 1
  private height = 1
  private disposed = false
  onHover?: (index: number, color: string | null) => void

  constructor(canvas: HTMLCanvasElement, projects: Project[]) {
    this.renderer = createRenderer(canvas, { alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.NoToneMapping
    const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 32, 1)
    projects.forEach((p, i) => {
      const cover = coverCanvas({ seed: p.seed, color: p.color, accent: p.accent, label: p.client, index: String(i + 1).padStart(2, '0') }, 768, 512)
      const tex = new THREE.CanvasTexture(cover)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      const mat = new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
        uniforms: {
          uMap: { value: tex },
          uTheta: { value: i * STEP },
          uR: { value: R },
          uY: { value: -i * DY },
          uLift: { value: 0 },
          uScale: { value: 1 },
          uFlat: { value: 0 },
          uSize: { value: new THREE.Vector2(400, 263) },
          uRadius: { value: 8.0 },
          uSat: { value: 1 },
          uRim: { value: new THREE.Color(p.accent) },
          uHover: { value: 0 },
          uAlpha: { value: 1 },
        },
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.frustumCulled = false
      this.group.add(mesh)
      // Dominant colour, extracted client-side from the actual cover (72×72 quantise).
      const color = dominantColor(cover)
      this.cards.push({ mesh, mat, theta: i * STEP, y: -i * DY, hover: 0, hoverV: 0, sat: 1, color, project: p, tex })
    })
    // spine: two faint strand curves
    for (const s of [0, 1]) {
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 400; k++) {
        const u = k / 400
        const i = u * (projects.length - 1)
        const a = i * (STEP - Math.PI) + s * Math.PI
        pts.push(new THREE.Vector3(Math.sin(a) * (R - 0.25), -i * DY, Math.cos(a) * (R - 0.25)))
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xf4f5f7, transparent: true, opacity: 0.12 }),
      )
      this.group.add(line)
    }
    this.scene.add(this.group)
  }

  get count() {
    return this.cards.length
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w)
    this.height = Math.max(1, h)
    this.renderer.setSize(this.width, this.height, false)
    const aspect = this.width / this.height
    this.camera.aspect = aspect
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    // Fit the front card: width with margin on portrait, height on landscape.
    const distW = (CARD_W * 1.5) / (2 * tan * aspect)
    const distH = (CARD_H * 2.3) / (2 * tan)
    this.camZ = R + Math.max(distW, distH)
    this.camera.position.set(0, 0, this.camZ)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
    // px per world unit at the front card → rounded corner radius in px
    const pxPerUnit = this.height / (2 * tan * (this.camZ - R))
    for (const c of this.cards) c.mat.uniforms.uSize!.value.set(CARD_W * pxPerUnit, CARD_H * pxPerUnit)
  }

  /** Scroll position in card units (0 … count-1). */
  setProgress(t: number) {
    // Dwell plateaus: each card holds front-and-centre for ~45% of its scroll
    // segment, then the helix spins to the next with an in-out ease.
    const i = Math.floor(t)
    const f = t - i
    const u = Math.min(1, Math.max(0, (f - 0.225) / 0.55))
    this.t = i + u * u * u * (u * (u * 6 - 15) + 10)
  }

  drag(dx: number) {
    this.dragVel = dx * 0.004
    this.dragOffset += this.dragVel
  }

  release(vx: number) {
    this.dragVel = vx * 0.00006
  }

  setPointer(nx: number, ny: number) {
    this.ndc.set(nx, ny)
  }

  get activeIndex() {
    return Math.max(0, Math.min(this.cards.length - 1, Math.round(this.t + this.dragOffset)))
  }

  /** Analytic ray–cylinder pick: no mesh raycast against bent geometry needed. */
  pick(): number {
    this.raycaster.setFromCamera(this.ndc, this.camera)
    this.group.updateMatrixWorld()
    this.inv.copy(this.group.matrixWorld).invert()
    const ray = this.raycaster.ray.clone().applyMatrix4(this.inv)
    const o = ray.origin
    const d = ray.direction
    const a = d.x * d.x + d.z * d.z
    const b = 2 * (o.x * d.x + o.z * d.z)
    const c = o.x * o.x + o.z * o.z - R * R
    const disc = b * b - 4 * a * c
    if (disc < 0 || a < 1e-8) return -1
    const sq = Math.sqrt(disc)
    for (const tHit of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
      if (tHit < 0) continue
      const px = o.x + d.x * tHit
      const py = o.y + d.y * tHit
      const pz = o.z + d.z * tHit
      const ang = Math.atan2(px, pz)
      for (let i = 0; i < this.cards.length; i++) {
        const card = this.cards[i]!
        let diff = ang - card.theta
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        if (Math.abs(diff) < CARD_W / 2 / R && Math.abs(py - card.y) < CARD_H / 2) return i
      }
    }
    return -1
  }

  /** Advance springs; returns true while anything is still moving. */
  update(dt: number): boolean {
    if (this.disposed) return false
    // drag inertia, then ease the offset home
    if (Math.abs(this.dragVel) > 1e-5) {
      this.dragOffset += this.dragVel * 60 * dt
      this.dragVel *= Math.pow(0.92, dt * 60)
    } else {
      this.dragOffset += (0 - this.dragOffset) * damp(0.03, dt)
    }
    const tt = this.t + this.dragOffset
    if (!this.flying) {
      this.group.rotation.y = -tt * STEP
      this.group.position.y = tt * DY
    }

    const hit = this.flying ? this.hovered : this.pick()
    if (hit !== this.hovered) {
      this.hovered = hit
      this.onHover?.(hit, hit >= 0 ? this.cards[hit]!.color : null)
    }
    let moving = Math.abs(this.dragOffset) > 0.001 || Math.abs(this.dragVel) > 1e-5
    const anyHover = this.hovered >= 0
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i]!
      const target = i === this.hovered ? 1 : 0
      // critically-damped-ish spring
      const k = 170
      const damping = 20
      c.hoverV += ((target - c.hover) * k - c.hoverV * damping) * dt
      c.hover += c.hoverV * dt
      const satTarget = anyHover && i !== this.hovered ? 0.35 : 1
      c.sat += (satTarget - c.sat) * damp(0.12, dt)
      const u = c.mat.uniforms
      if (!this.flying) {
        u.uScale!.value = 1 + 0.08 * c.hover
        u.uLift!.value = 0.4 * c.hover
      }
      u.uSat!.value = c.sat
      u.uHover!.value = c.hover
      if (Math.abs(target - c.hover) > 0.001 || Math.abs(c.hoverV) > 0.001 || Math.abs(satTarget - c.sat) > 0.005) moving = true
    }
    return moving || this.flying
  }

  render() {
    if (!this.disposed) this.renderer.render(this.scene, this.camera)
  }

  /** Click: the card unbends and flies to fill the viewport. */
  fly(index: number): Promise<void> {
    const c = this.cards[index]
    if (!c) return Promise.resolve()
    this.flying = true
    this.hovered = index
    const u = c.mat.uniforms
    // Rotate the helix so the card faces the camera dead-on.
    const twoPi = Math.PI * 2
    const cur = this.group.rotation.y
    // nearest equivalent angle — never spin the long way round
    const targetRot = -c.theta + Math.round((cur + c.theta) / twoPi) * twoPi
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const near = 0.9
    const lift = this.camZ - R - near
    const scale = Math.max((2 * near * tan) / CARD_H, (2 * near * tan * this.camera.aspect) / CARD_W) * 1.08
    for (const o of this.cards) if (o !== c) gsap.to(o.mat.uniforms.uAlpha!, { value: 0, duration: 0.5, ease: EASE.outQuart })
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: () => resolve() })
      tl.to(this.group.rotation, { y: targetRot, duration: 0.6, ease: EASE.inOutQuint }, 0)
      tl.to(this.group.position, { y: -c.y, duration: 0.6, ease: EASE.inOutQuint }, 0)
      tl.to(u.uFlat!, { value: 1, duration: 0.6, ease: EASE.inOutQuint }, 0)
      tl.to(u.uLift!, { value: lift, duration: 0.9, ease: EASE.inOutQuint }, 0.15)
      tl.to(u.uScale!, { value: scale, duration: 0.9, ease: EASE.inOutQuint }, 0.15)
      tl.to(u.uRadius!, { value: 0, duration: 0.6 }, 0.4)
    })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const c of this.cards) {
      gsap.killTweensOf(c.mat.uniforms)
      c.tex.dispose()
    }
    disposeObject(this.scene)
    disposeRenderer(this.renderer)
  }
}
