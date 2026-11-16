'use client'
/**
 * THE LATTICE CORE — GBGTech's brand object.
 *
 * Raw Three.js on purpose: one render loop owned by the shared engine tick,
 * per-panel mesh control, and deterministic disposal.
 *
 * States
 *   idle         slow 3-axis Lissajous drift, panels breathe ±1.5% on normals @0.4Hz
 *   charging     panels separate, edges emit, camera micro-shake, rumble rises (900ms)
 *   refracted    panels launch along normals with per-panel spin; white beam → 3 rays
 *   reassembling magnetic snap back (ease-snap), staggered by distance from centre
 */
import * as THREE from 'three'
import { gsap } from '@/lib/gsap'
import { EASE, clamp, damp } from '@/lib/motion/tokens'
import { audio, type ChargeHandle } from '@/lib/audio/AudioManager'
import { frame } from '@/lib/motion/frame'
import { quality, targetDPR } from '@/lib/webgl/capabilities'
import { createRenderer, disposeObject, disposeRenderer } from '@/lib/webgl/three-utils'
import { corePanels, glyphPanels, panelGeometry, type Tri } from './latticeGeometry'

export type CoreShape = 'core' | 'glyph404'
type Mode = 'idle' | 'charging' | 'refracted' | 'reassembling'

interface Panel {
  mesh: THREE.Mesh
  edges: THREE.LineSegments
  rest: THREE.Vector3
  normal: THREE.Vector3
  phase: number
  /** magnetic offset (local) */
  offset: THREE.Vector3
  tilt: THREE.Quaternion
  /** free-flight state (refract) */
  pos: THREE.Vector3
  rot: THREE.Quaternion
  vel: THREE.Vector3
  spin: THREE.Vector3
  /** reassembly */
  from: THREE.Vector3
  fromQ: THREE.Quaternion
  t: number
  free: boolean
}

export interface CoreOptions {
  canvas: HTMLCanvasElement
  shape?: CoreShape
  mobile?: boolean
  reduced?: boolean
  onHold?: (p: number) => void
}

const V = new THREE.Vector3()
const V2 = new THREE.Vector3()
const Q = new THREE.Quaternion()
const Q2 = new THREE.Quaternion()
const IDENT = new THREE.Quaternion()
const E = new THREE.Euler()

const HOLD_TIME = 0.9
const REASSEMBLE_AFTER = 3.5
const HOVER_RADIUS = 2.2

export class LatticeCore {
  readonly renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private root = new THREE.Group()
  private core = new THREE.Group()
  private panels: Panel[] = []
  private ringPivots: { pivot: THREE.Group; speed: number }[] = []
  private proxy: THREE.Mesh
  private raycaster = new THREE.Raycaster()
  private ndc = new THREE.Vector2(10, 10)
  private hoverPoint = new THREE.Vector3()
  private hoverAmt = 0
  private pointerInside = false

  private envScene = new THREE.Scene()
  private envLights = new THREE.Group()
  private cubeRT: THREE.WebGLCubeRenderTarget
  private cubeCam: THREE.CubeCamera
  private keyLight: THREE.DirectionalLight
  private glassMat: THREE.MeshPhysicalMaterial
  private cheapMat: THREE.MeshStandardMaterial
  private edgeMat: THREE.LineBasicMaterial
  private beam = new THREE.Group()
  private beamMats: THREE.ShaderMaterial[] = []
  private backdrop: THREE.Mesh

  private mode: Mode = 'idle'
  private charge = 0
  private chargeAudio: ChargeHandle | null = null
  private pressing = false
  private pressAt = 0
  private refractAt = 0
  private beamAmt = { v: 0 }
  private assembled = 1
  /** user rotation */
  private userQ = new THREE.Quaternion()
  private angVel = new THREE.Vector3()
  private dragging = false
  private shake = 0
  private frameCount = 0
  private width = 1
  private height = 1
  private scrollOut = 0
  private fit = 1
  private shape: CoreShape
  private reduced: boolean
  private onHold?: (p: number) => void
  private tweens: gsap.core.Tween[] = []
  private disposed = false
  private unsubQuality: () => void

  constructor(opts: CoreOptions) {
    this.shape = opts.shape ?? 'core'
    this.reduced = !!opts.reduced
    this.onHold = opts.onHold
    const mobile = !!opts.mobile

    this.renderer = createRenderer(opts.canvas, { alpha: false })
    this.renderer.setClearColor(new THREE.Color('#06070A'), 1)

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60)
    this.camera.position.set(0, 0, 6.4)

    /* ---------- Environment: moving light panels captured by a CubeCamera ---------- */
    this.cubeRT = new THREE.WebGLCubeRenderTarget(mobile ? 128 : 256, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    })
    this.cubeCam = new THREE.CubeCamera(0.1, 50, this.cubeRT)
    this.envScene.background = new THREE.Color('#020203')
    const panel = (w: number, h: number, color: string, intensity: number) =>
      new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
      )
    const strips: [number, number, string, number, THREE.Vector3][] = [
      [10, 1.2, '#ffffff', 2.4, new THREE.Vector3(0, 6, -4)],
      [1.0, 9, '#ffffff', 1.6, new THREE.Vector3(-7, 0, 2)],
      [0.5, 7, '#3B82F6', 2.2, new THREE.Vector3(7, -1, -3)],
      [0.5, 7, '#22D3EE', 2.0, new THREE.Vector3(6, 1, 4)],
      [0.4, 6, '#A78BFA', 2.0, new THREE.Vector3(-5, -2, -6)],
      [6, 0.3, '#ffffff', 1.2, new THREE.Vector3(0, -6, 3)],
    ]
    for (const [w, h, c, i, p] of strips) {
      const m = panel(w, h, c, i)
      m.position.copy(p)
      m.lookAt(0, 0, 0)
      this.envLights.add(m)
    }
    this.envScene.add(this.envLights)
    this.scene.environment = this.cubeRT.texture

    /* ---------- Lights ---------- */
    this.keyLight = new THREE.DirectionalLight('#ffffff', 2.4)
    this.keyLight.position.set(3, 4, 5)
    this.scene.add(this.keyLight)
    const rim = new THREE.DirectionalLight('#22D3EE', 1.1)
    rim.position.set(-4, -2, -3)
    this.scene.add(rim)
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.08))

    /* ---------- Backdrop: precision grid (opaque, so transmission has something to bend) ---------- */
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 24),
      new THREE.ShaderMaterial({
        toneMapped: false,
        uniforms: {
          uVoid: { value: new THREE.Color('#06070A') },
          uLine: { value: new THREE.Color('#F4F5F7') },
          uAccent: { value: new THREE.Color('#22D3EE') },
          uTime: { value: 0 },
          uEnergy: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vPos;
          void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uVoid; uniform vec3 uLine; uniform vec3 uAccent; uniform float uTime; uniform float uEnergy;
          varying vec2 vUv; varying vec3 vPos;
          float grid(vec2 p, float s){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y), 1.0); }
          void main(){
            float r = length(vPos.xy) / 9.0;
            float fade = smoothstep(1.0, 0.05, r);
            float g = grid(vPos.xy, 0.8) * 0.035 + grid(vPos.xy, 4.0) * 0.05;
            float scan = smoothstep(0.006, 0.0, abs(fract(vPos.y * 0.05 - uTime * 0.03) - 0.5)) * 0.014;
            vec3 col = uVoid + uLine * g * fade + uAccent * (scan * fade + uEnergy * 0.02 * fade);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    )
    this.backdrop.position.z = -5
    this.scene.add(this.backdrop)

    /* ---------- Materials ---------- */
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.08,
      transmission: 0.9,
      ior: 1.6,
      thickness: 1.2,
      envMapIntensity: 1.35,
      specularIntensity: 1,
      clearcoat: 0.4,
      clearcoatRoughness: 0.1,
      iridescence: 0.35,
      iridescenceIOR: 1.3,
      attenuationColor: new THREE.Color('#BFD7FF'),
      attenuationDistance: 2.5,
      emissive: new THREE.Color('#22D3EE'),
      emissiveIntensity: 0,
      side: THREE.FrontSide,
    })
    this.cheapMat = new THREE.MeshStandardMaterial({
      color: '#cfd8e6',
      metalness: 0.9,
      roughness: 0.12,
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 0.88,
      emissive: new THREE.Color('#22D3EE'),
      emissiveIntensity: 0,
    })
    this.edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#9BEFFF'),
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    /* ---------- Panels ---------- */
    const tris: Tri[] = this.shape === 'glyph404' ? glyphPanels() : corePanels(mobile)
    const useCheap = quality.tier >= 2 || mobile
    for (const t of tris) {
      const g = panelGeometry(t, this.shape === 'glyph404' ? 0.09 : 0.07, 0.94)
      const mesh = new THREE.Mesh(g, useCheap ? this.cheapMat : this.glassMat)
      mesh.position.copy(t.centroid)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), this.edgeMat)
      mesh.add(edges)
      this.core.add(mesh)
      this.panels.push({
        mesh,
        edges,
        rest: t.centroid.clone(),
        normal: t.normal.clone(),
        phase: t.centroid.x * 1.3 + t.centroid.y * 0.7,
        offset: new THREE.Vector3(),
        tilt: new THREE.Quaternion(),
        pos: t.centroid.clone(),
        rot: new THREE.Quaternion(),
        vel: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        from: new THREE.Vector3(),
        fromQ: new THREE.Quaternion(),
        t: 1,
        free: false,
      })
    }

    /* ---------- Raycast proxy (one mesh instead of 60) ---------- */
    const proxyGeo =
      this.shape === 'glyph404' ? new THREE.BoxGeometry(4.2, 1.9, 0.4) : new THREE.SphereGeometry(1.2, 24, 16)
    this.proxy = new THREE.Mesh(proxyGeo, new THREE.MeshBasicMaterial({ visible: false }))
    this.core.add(this.proxy)

    /* ---------- Orbiting arc rings — the three G-B-G strokes ---------- */
    const ringMat = new THREE.MeshStandardMaterial({ color: '#E8ECF2', metalness: 1, roughness: 0.22, envMapIntensity: 1.6 })
    const beadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#D7FF3E').multiplyScalar(1.4), toneMapped: false })
    const ringSpecs: [number, number, number, THREE.Euler][] = [
      [1.62, Math.PI * 1.55, 0.08, new THREE.Euler(1.2, 0.2, 0)],
      [1.82, Math.PI * 1.25, -0.05, new THREE.Euler(0.3, 1.1, 0.4)],
      [2.02, Math.PI * 1.7, 0.11, new THREE.Euler(-0.5, -0.6, 1.0)],
    ]
    const ringScale = this.shape === 'glyph404' ? 1.25 : 1
    for (const [r, arc, speed, tilt] of ringSpecs) {
      const holder = new THREE.Group()
      holder.rotation.copy(tilt)
      const pivot = new THREE.Group()
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * ringScale, 0.007, 6, 180, arc), ringMat)
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), beadMat)
      bead.position.set(Math.cos(arc) * r * ringScale, Math.sin(arc) * r * ringScale, 0)
      pivot.add(ring, bead)
      holder.add(pivot)
      this.root.add(holder)
      this.ringPivots.push({ pivot, speed })
    }

    /* ---------- Refraction beam: white in, three spectrum rays out ---------- */
    const beamGeo = new THREE.PlaneGeometry(1, 1, 1, 1)
    beamGeo.translate(0.5, 0, 0)
    const beamShader = (color: string) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uColor: { value: new THREE.Color(color) }, uAmt: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uAmt; uniform float uTime; varying vec2 vUv;
          void main(){
            float core = exp(-pow((vUv.y - 0.5) * 9.0, 2.0));
            float head = smoothstep(uAmt, uAmt - 0.15, vUv.x);
            float tail = smoothstep(0.0, 0.08, vUv.x);
            float flick = 0.85 + 0.15 * sin(uTime * 40.0 + vUv.x * 30.0);
            float a = core * head * tail * flick;
            gl_FragColor = vec4(uColor * a * 1.6, a);
          }`,
      })
    const whiteMat = beamShader('#ffffff')
    const white = new THREE.Mesh(beamGeo, whiteMat)
    white.scale.set(9, 0.12, 1)
    white.position.set(-9, 0, 0)
    this.beam.add(white)
    this.beamMats.push(whiteMat)
    ;(['#3B82F6', '#22D3EE', '#A78BFA'] as const).forEach((c, i) => {
      const m = beamShader(c)
      const ray = new THREE.Mesh(beamGeo, m)
      ray.scale.set(9, 0.16, 1)
      ray.rotation.z = (i - 1) * 0.2 - 0.05
      this.beam.add(ray)
      this.beamMats.push(m)
    })
    this.beam.visible = false
    this.root.add(this.beam)

    this.root.add(this.core)
    this.scene.add(this.root)

    this.unsubQuality = quality.onChange((tier) => this.applyTier(tier))
  }

  /** Compile shaders + render the env + one frame, so the first visible frame is never a black canvas. */
  async warm(): Promise<void> {
    this.cubeCam.update(this.renderer, this.envScene)
    const r = this.renderer as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<void> }
    if (r.compileAsync) await r.compileAsync(this.scene, this.camera)
    else this.renderer.compile(this.scene, this.camera)
    this.update(1 / 60, 0)
    this.render()
  }

  private applyTier(tier: number) {
    this.renderer.setPixelRatio(targetDPR())
    this.resize(this.width, this.height)
    if (tier >= 2) for (const p of this.panels) p.mesh.material = this.cheapMat
  }

  get isStatic() {
    return this.reduced || quality.tier >= 3
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w)
    this.height = Math.max(1, h)
    this.renderer.setSize(this.width, this.height, false)
    const aspect = this.width / this.height
    this.camera.aspect = aspect
    // Keep the object framed on portrait screens.
    const needed = this.shape === 'glyph404' ? 4.6 : 4.4
    const visibleW = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect
    this.fit = Math.min(1, visibleW / needed)
    this.camera.updateProjectionMatrix()
  }

  /* ------------------------------------------------------------------ */
  /*  Input                                                              */
  /* ------------------------------------------------------------------ */

  setPointer(nx: number, ny: number, inside: boolean) {
    this.ndc.set(nx, ny)
    this.pointerInside = inside
  }

  /** Called on pointerdown inside the canvas. */
  press() {
    if (this.mode === 'refracted' || this.mode === 'reassembling') return
    this.pressing = true
    this.pressAt = performance.now()
    this.mode = 'charging'
    this.chargeAudio = audio.charge()
  }

  release() {
    // A held press that crossed the threshold between frames still refracts.
    if (this.pressing && this.mode === 'charging' && performance.now() - this.pressAt >= HOLD_TIME * 1000) {
      this.pressing = false
      this.refract()
      return
    }
    this.pressing = false
    this.chargeAudio?.release()
    this.chargeAudio = null
    if (this.mode === 'charging') this.mode = 'idle'
  }

  /** Movement past the drag threshold turns a press into a drag. */
  beginDrag() {
    this.dragging = true
    this.release()
  }

  drag(dxPx: number, dyPx: number) {
    const k = 0.0042
    // Pointer-follow while dragging; inertia carries after release.
    this.angVel.set(dyPx * k * 60, dxPx * k * 60, 0)
  }

  endDrag() {
    this.dragging = false
  }

  setScrollOut(p: number) {
    this.scrollOut = p
  }

  /* ------------------------------------------------------------------ */
  /*  Refract                                                            */
  /* ------------------------------------------------------------------ */

  refract() {
    if (this.mode === 'refracted' || this.mode === 'reassembling') return
    this.mode = 'refracted' // set first: release() must not re-enter refract()
    this.release()
    this.refractAt = frame.time
    this.charge = 0
    this.onHold?.(0)
    frame.energy.click = 1
    audio.refract()
    for (const p of this.panels) {
      p.free = true
      p.pos.copy(p.mesh.position)
      p.rot.copy(p.mesh.quaternion)
      const speed = 2.4 + Math.random() * 2.6
      p.vel.copy(p.normal).multiplyScalar(speed).add(V.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.8))
      p.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(9)
    }
    this.beam.visible = true
    this.tweens.push(
      gsap.fromTo(this.beamAmt, { v: 0 }, { v: 1.15, duration: 0.6, ease: EASE.outExpo }),
      gsap.to(this.beamAmt, { v: 0, duration: 1.4, delay: 1.6, ease: EASE.inOutQuint, onComplete: () => void (this.beam.visible = false) }),
    )
  }

  private reassemble() {
    this.mode = 'reassembling'
    // Stagger by distance from centre: nearest panels snap home first.
    const order = [...this.panels].sort((a, b) => a.pos.lengthSq() - b.pos.lengthSq())
    let remaining = order.length
    order.forEach((p, i) => {
      p.from.copy(p.pos)
      p.fromQ.copy(p.rot)
      p.t = 0
      p.free = false
      this.tweens.push(
        gsap.to(p, {
          t: 1,
          duration: 1.1,
          delay: i * 0.012,
          ease: EASE.snap,
          onComplete: () => {
            remaining--
            if (remaining === 0) this.mode = 'idle'
          },
        }),
      )
    })
    audio.whoosh(0.8)
  }

  /* ------------------------------------------------------------------ */
  /*  Frame                                                              */
  /* ------------------------------------------------------------------ */

  /** Returns true if the scene is still "busy" (needs continued rendering). */
  update(dt: number, time: number): boolean {
    if (this.disposed) return false
    this.frameCount++
    const t = time

    // ---- charge ----
    if (this.mode === 'charging' && this.pressing) {
      // wall-clock, not dt: the hold is exactly 900ms even on a struggling GPU
      this.charge = Math.min(1, (performance.now() - this.pressAt) / 1000 / HOLD_TIME)
      this.chargeAudio?.update(this.charge)
      if (this.charge >= 1) this.refract()
    } else if (this.charge > 0) {
      this.charge = Math.max(0, this.charge - dt / 0.4)
    }
    this.onHold?.(this.charge)

    // ---- energy: Math.max of every source ----
    const energy = Math.max(frame.energy.scroll * 0.6, this.hoverAmt * 0.5, this.charge, frame.energy.click * 0.6, frame.energy.idle)

    // ---- rotation: idle drift × user quaternion with inertia ----
    if (!this.dragging) this.angVel.multiplyScalar(Math.pow(0.94, dt * 60))
    if (this.angVel.lengthSq() > 1e-8) {
      const ang = this.angVel.length() * dt
      Q.setFromAxisAngle(V.copy(this.angVel).normalize(), ang)
      this.userQ.premultiply(Q)
    }
    // A glyph must stay legible: gentle wobble instead of a full 3-axis drift.
    if (this.shape === 'glyph404') E.set(Math.sin(t * 0.31) * 0.12, Math.sin(t * 0.23) * 0.28, Math.sin(t * 0.17) * 0.04)
    else E.set(Math.sin(t * 0.13) * 0.35, t * 0.09, Math.sin(t * 0.07) * 0.2)
    Q2.setFromEuler(E)
    this.core.quaternion.copy(this.userQ).multiply(Q2)

    // Lissajous drift + scroll-out recede
    this.root.position.set(
      Math.sin(t * 0.23) * 0.12,
      Math.sin(t * 0.31 + 1.0) * 0.08 + 0.15,
      Math.sin(t * 0.17) * 0.06 - this.scrollOut * 3.2,
    )
    this.root.scale.setScalar(this.fit)

    // Rings: independent axes and speeds, quickened by energy
    for (const r of this.ringPivots) r.pivot.rotation.z += r.speed * dt * (1 + energy * 6)

    // Key light sweep — moving specular at all times
    this.keyLight.position.set(Math.cos(t * 0.25) * 5, 3 + Math.sin(t * 0.18) * 1.5, Math.sin(t * 0.25) * 5)
    this.envLights.rotation.y = t * 0.12
    this.envLights.rotation.x = Math.sin(t * 0.07) * 0.3

    // ---- magnetic hover: raycast ONLY when fully assembled ----
    let hovering = false
    if (this.assembled > 0.98 && this.pointerInside && this.mode !== 'refracted') {
      this.raycaster.setFromCamera(this.ndc, this.camera)
      const hit = this.raycaster.intersectObject(this.proxy, false)[0]
      if (hit) {
        hovering = true
        this.core.worldToLocal(this.hoverPoint.copy(hit.point))
      }
    }
    this.hoverAmt += ((hovering ? 1 : 0) - this.hoverAmt) * damp(0.12, dt)
    if (hovering) frame.energy.hover = Math.max(frame.energy.hover, 0.4)

    // ---- panels ----
    const breath = this.reduced ? 0 : 0.015
    const separate = this.charge * this.charge * 0.18
    const kHover = damp(0.12, dt)
    let assembledSum = 0
    for (const p of this.panels) {
      if (p.free) {
        // Free flight with drag
        p.pos.addScaledVector(p.vel, dt)
        p.vel.multiplyScalar(Math.pow(0.975, dt * 60))
        Q.setFromEuler(E.set(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt))
        p.rot.multiply(Q)
        p.spin.multiplyScalar(Math.pow(0.992, dt * 60))
        p.mesh.position.copy(p.pos)
        p.mesh.quaternion.copy(p.rot)
        continue
      }

      // Rest pose: breathe along normal (±1.5% @0.4Hz) + charge separation
      const b = Math.sin(t * Math.PI * 2 * 0.4 + p.phase) * breath * p.rest.length()
      V.copy(p.rest).addScaledVector(p.normal, b + separate)

      // Magnetic push + tilt toward cursor
      if (this.hoverAmt > 0.001) {
        const d = p.rest.distanceTo(this.hoverPoint)
        const f = d < HOVER_RADIUS ? Math.pow(1 - d / HOVER_RADIUS, 2) * this.hoverAmt : 0
        V2.copy(p.normal).multiplyScalar(f * 0.32)
        p.offset.lerp(V2, kHover)
        const axis = V2.subVectors(this.hoverPoint, p.rest).cross(p.normal)
        if (axis.lengthSq() > 1e-6) Q.setFromAxisAngle(axis.normalize(), -f * 0.45)
        else Q.identity()
        p.tilt.slerp(Q, kHover)
      } else {
        p.offset.multiplyScalar(1 - kHover)
        p.tilt.slerp(IDENT, kHover)
      }
      V.add(p.offset)

      if (p.t < 1) {
        // Reassembly: magnetic snap from the free-flight pose (ease-snap overshoots)
        p.mesh.position.lerpVectors(p.from, V, p.t)
        p.mesh.quaternion.slerpQuaternions(p.fromQ, p.tilt, Math.min(1, p.t))
        assembledSum += clamp(p.t)
      } else {
        p.mesh.position.copy(V)
        p.mesh.quaternion.copy(p.tilt)
        assembledSum += 1
      }
    }
    this.assembled = assembledSum / this.panels.length

    if (this.mode === 'refracted' && t - this.refractAt > REASSEMBLE_AFTER) this.reassemble()

    // ---- light emission ----
    const glow = Math.max(this.charge, energy * 0.35, this.mode === 'refracted' ? 0.6 : 0)
    this.edgeMat.opacity = 0.07 + glow * 0.85
    this.glassMat.emissiveIntensity = this.charge * 0.35
    this.cheapMat.emissiveIntensity = this.charge * 0.35
    const bm = this.backdrop.material as THREE.ShaderMaterial
    bm.uniforms.uTime!.value = t
    bm.uniforms.uEnergy!.value = glow

    // Beam
    if (this.beam.visible) {
      for (let i = 0; i < this.beamMats.length; i++) {
        const u = this.beamMats[i]!.uniforms
        // the white ray arrives first; spectrum rays exit after it reaches the core
        u.uAmt!.value = i === 0 ? clamp(this.beamAmt.v * 1.4) : clamp(this.beamAmt.v * 1.4 - 0.35)
        u.uTime!.value = t
      }
    }

    // Camera micro-shake ramps with charge²
    this.shake += ((this.mode === 'charging' ? this.charge * this.charge : 0) - this.shake) * damp(0.2, dt)
    const s = this.shake * 0.04
    this.camera.position.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 6.4)

    return (
      this.mode !== 'idle' || this.charge > 0 || this.hoverAmt > 0.01 || this.angVel.lengthSq() > 1e-6 || this.dragging
    )
  }

  render() {
    if (this.disposed) return
    // Env capture is cheap (6 tiny renders); every other frame keeps specular moving.
    if (this.frameCount % 2 === 0) this.cubeCam.update(this.renderer, this.envScene)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.tweens.forEach((t) => t.kill())
    this.chargeAudio?.release()
    this.unsubQuality()
    disposeObject(this.scene)
    disposeObject(this.envScene)
    this.glassMat.dispose()
    this.cheapMat.dispose()
    this.edgeMat.dispose()
    this.cubeRT.dispose()
    disposeRenderer(this.renderer)
  }
}
