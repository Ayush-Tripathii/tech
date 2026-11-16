'use client'
/** Three-dependent helpers. Only imported from dynamically-loaded scene modules. */
import * as THREE from 'three'
import { isMobile, targetDPR } from './capabilities'

/** Create a renderer with site defaults. */
export function createRenderer(canvas: HTMLCanvasElement, opts: { alpha?: boolean; antialias?: boolean } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: opts.alpha ?? false,
    antialias: opts.antialias ?? !isMobile(),
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  })
  renderer.setPixelRatio(targetDPR())
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  return renderer
}

/** Dispose every geometry / material / texture under an object. */
export function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    mesh.geometry?.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : []
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose()
      m.dispose()
    }
  })
}

export function disposeRenderer(renderer: THREE.WebGLRenderer) {
  renderer.renderLists.dispose()
  renderer.dispose()
  renderer.forceContextLoss()
}
