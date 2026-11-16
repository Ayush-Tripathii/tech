'use client'
/**
 * The Lattice Core dissolved into an orbiting particle swarm.
 * 12k GPU points (6k mobile), seeded on the core's panel surfaces, orbiting
 * with curl-noise displacement computed in the vertex shader (stateless — no
 * FBO simulation), attracted to the cursor within a radius.
 */
import * as THREE from 'three'
import { createRenderer, disposeObject, disposeRenderer } from '@/lib/webgl/three-utils'
import { corePanels } from './latticeGeometry'

const vert = /* glsl */ `
  uniform float uTime; uniform vec3 uPointer; uniform float uAttract; uniform float uPixel;
  attribute vec3 aSeed; attribute float aSize;
  varying float vMix; varying float vAlpha;
  // cheap curl from analytic sin-noise gradients
  vec3 field(vec3 p){
    return vec3(
      sin(p.y * 1.7 + uTime * 0.31) + sin(p.z * 2.3 - uTime * 0.17),
      sin(p.z * 1.9 + uTime * 0.23) + sin(p.x * 2.1 + uTime * 0.29),
      sin(p.x * 1.6 - uTime * 0.27) + sin(p.y * 2.7 + uTime * 0.21));
  }
  vec3 curl(vec3 p){
    float e = 0.1;
    vec3 dx = vec3(e,0,0), dy = vec3(0,e,0), dz = vec3(0,0,e);
    vec3 a = field(p + dy) - field(p - dy); vec3 b = field(p + dz) - field(p - dz); vec3 c = field(p + dx) - field(p - dx);
    return vec3(a.z - b.y, b.x - c.z, c.y - a.x) / (2.0 * e);
  }
  void main(){
    vec3 p = position;
    // orbit: angular speed falls with radius
    float r = length(p.xz);
    float ang = uTime * (0.25 / (0.6 + r)) + aSeed.x * 0.5;
    float ca = cos(ang), sa = sin(ang);
    p.xz = mat2(ca, -sa, sa, ca) * p.xz;
    // dissolve outward + curl noise
    p *= 1.0 + aSeed.y * 1.6;
    p += curl(p * 0.6 + aSeed * 3.0) * 0.18 * (0.4 + aSeed.y);
    // cursor attraction within a radius
    vec3 toP = uPointer - p;
    float d = length(toP);
    float pull = smoothstep(2.2, 0.0, d) * uAttract;
    p += toP * pull * 0.55;
    vMix = aSeed.z;
    vAlpha = 0.35 + pull * 0.65;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel * (1.0 + pull * 1.5) / -mv.z;
  }`

const frag = /* glsl */ `
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
  varying float vMix; varying float vAlpha;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    vec3 col = vMix < 0.6 ? vec3(0.95) : (vMix < 0.75 ? uA : (vMix < 0.9 ? uB : uC));
    gl_FragColor = vec4(col * a, a);
  }`

export class Swarm {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50)
  private points: THREE.Points
  private mat: THREE.ShaderMaterial
  private pointer = new THREE.Vector3(99, 99, 0)
  private target = new THREE.Vector3(99, 99, 0)
  private attract = 0
  private attractTarget = 0
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  private ray = new THREE.Raycaster()

  constructor(canvas: HTMLCanvasElement, count: number) {
    this.renderer = createRenderer(canvas, { alpha: true, antialias: false })
    this.renderer.setClearColor(0, 0)
    this.camera.position.set(0, 0, 7)
    const tris = corePanels(false)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count * 3)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const t = tris[i % tris.length]!
      // uniform sample inside the triangle
      let u = Math.random(), v = Math.random()
      if (u + v > 1) {
        u = 1 - u
        v = 1 - v
      }
      const p = t.a.clone().multiplyScalar(1 - u - v).add(t.b.clone().multiplyScalar(u)).add(t.c.clone().multiplyScalar(v))
      pos.set([p.x * 1.3, p.y * 1.3, p.z * 1.3], i * 3)
      seed.set([Math.random() * 6.28, Math.pow(Math.random(), 2.2), Math.random()], i * 3)
      size[i] = 1 + Math.random() * 2.5
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector3(99, 99, 0) },
        uAttract: { value: 0 },
        uPixel: { value: 30 },
        uA: { value: new THREE.Color('#3B82F6') },
        uB: { value: new THREE.Color('#22D3EE') },
        uC: { value: new THREE.Color('#A78BFA') },
      },
    })
    this.points = new THREE.Points(geo, this.mat)
    this.scene.add(this.points)
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.position.z = w / h < 1 ? 10 : 7
    this.camera.updateProjectionMatrix()
    this.mat.uniforms.uPixel!.value = (h * this.renderer.getPixelRatio()) / 28
  }

  setPointer(nx: number, ny: number, active: boolean) {
    this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera)
    this.ray.ray.intersectPlane(this.plane, this.target)
    this.attractTarget = active ? 1 : 0
  }

  render(time: number, dt: number) {
    const k = 1 - Math.pow(0.88, dt * 60)
    this.pointer.lerp(this.target, k)
    this.attract += (this.attractTarget - this.attract) * k
    this.mat.uniforms.uTime!.value = time
    this.mat.uniforms.uAttract!.value = this.attract
    this.points.rotation.y = time * 0.03
    this.points.rotation.x = Math.sin(time * 0.05) * 0.2
    // pointer is in world space; points are rotated — compensate
    this.points.updateMatrixWorld()
    const inv = this.points.matrixWorld.clone().invert()
    ;(this.mat.uniforms.uPointer!.value as THREE.Vector3).copy(this.pointer).applyMatrix4(inv)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    disposeObject(this.scene)
    disposeRenderer(this.renderer)
  }
}
