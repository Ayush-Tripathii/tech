import * as THREE from 'three'
import { mulberry32 } from '@/lib/content/generative'

export interface Tri {
  a: THREE.Vector3
  b: THREE.Vector3
  c: THREE.Vector3
  centroid: THREE.Vector3
  normal: THREE.Vector3
}

function makeTri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, outward?: THREE.Vector3): Tri {
  const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3)
  const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
  const ref = outward ?? centroid
  if (normal.dot(ref) < 0) {
    normal.negate()
    return { a, b: c, c: b, centroid, normal }
  }
  return { a, b, c, centroid, normal }
}

/**
 * "Kis" construction: for each apex direction, find its ring of nearest
 * vertices, sort them around the apex and fan triangles from the raised apex.
 *   pentakis dodecahedron → 12 apexes × 5 = 60 panels (desktop)
 *   tetrakis hexahedron   →  6 apexes × 4 = 24 panels (mobile)
 * Vertices get a deterministic jitter so the core reads as procedurally grown,
 * not a textbook solid.
 */
function kis(apexes: THREE.Vector3[], ring: THREE.Vector3[], ringSize: number, apexHeight: number, seed: number): Tri[] {
  const rnd = mulberry32(seed)
  const jittered = ring.map((v) => v.clone().normalize().multiplyScalar(1 + (rnd() - 0.5) * 0.06))
  const tris: Tri[] = []
  for (const apexDir of apexes) {
    const dir = apexDir.clone().normalize()
    const near = jittered
      .map((v, i) => ({ v, i, d: v.clone().normalize().dot(dir) }))
      .sort((x, y) => y.d - x.d)
      .slice(0, ringSize)
    const t1 = new THREE.Vector3(0, 1, 0)
    if (Math.abs(t1.dot(dir)) > 0.9) t1.set(1, 0, 0)
    const u = new THREE.Vector3().crossVectors(dir, t1).normalize()
    const w = new THREE.Vector3().crossVectors(dir, u)
    near.sort((p, q) => Math.atan2(p.v.dot(w), p.v.dot(u)) - Math.atan2(q.v.dot(w), q.v.dot(u)))
    const apex = dir.clone().multiplyScalar(apexHeight * (1 + (rnd() - 0.5) * 0.08))
    for (let k = 0; k < near.length; k++) {
      const p = near[k]!.v
      const q = near[(k + 1) % near.length]!.v
      tris.push(makeTri(apex.clone(), p.clone(), q.clone()))
    }
  }
  return tris
}

export function corePanels(mobile: boolean): Tri[] {
  if (mobile) {
    const axes = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
    const corners: THREE.Vector3[] = []
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push(new THREE.Vector3(x, y, z))
    return kis(axes, corners, 4, 1.32, 7)
  }
  const ico = new THREE.IcosahedronGeometry(1, 0)
  const pos = ico.getAttribute('position')
  const apexes: THREE.Vector3[] = []
  const centroids: THREE.Vector3[] = []
  for (let f = 0; f < pos.count; f += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, f)
    const b = new THREE.Vector3().fromBufferAttribute(pos, f + 1)
    const c = new THREE.Vector3().fromBufferAttribute(pos, f + 2)
    centroids.push(a.clone().add(b).add(c).divideScalar(3).normalize())
    for (const v of [a, b, c]) if (!apexes.some((x) => x.distanceToSquared(v) < 1e-6)) apexes.push(v.clone())
  }
  ico.dispose()
  return kis(apexes, centroids, 5, 1.14, 3)
}

const DIGITS: Record<string, string[]> = {
  '4': ['101', '101', '111', '001', '001'],
  '0': ['111', '101', '101', '101', '111'],
}

/** "404" set in lattice panels: each lit cell of a 3×5 digit grid → 2 triangles. */
export function glyphPanels(text = '404'): Tri[] {
  const cell = 0.34
  const gap = 1
  const cols = text.length * 3 + (text.length - 1) * gap
  const tris: Tri[] = []
  const rnd = mulberry32(404)
  Array.from(text).forEach((ch, di) => {
    const rows = DIGITS[ch] ?? DIGITS['0']!
    rows.forEach((row, ry) => {
      Array.from(row).forEach((on, rx) => {
        if (on !== '1') return
        const gx = di * (3 + gap) + rx
        const x0 = (gx - cols / 2) * cell
        const y0 = (2.5 - ry - 1) * cell
        const bulge = (x: number, y: number) => -(x * x + y * y) * 0.06 + (rnd() - 0.5) * 0.04
        const p = (x: number, y: number) => new THREE.Vector3(x, y, bulge(x, y))
        const A = p(x0, y0)
        const B = p(x0 + cell, y0)
        const C = p(x0 + cell, y0 + cell)
        const D = p(x0, y0 + cell)
        const out = (v: THREE.Vector3) => new THREE.Vector3(v.x * 0.35, v.y * 0.35, 1)
        if ((gx + ry) % 2 === 0) {
          const t1 = makeTri(A, B, C, out(A.clone().add(B).add(C).divideScalar(3)))
          const t2 = makeTri(A, C, D, out(A.clone().add(C).add(D).divideScalar(3)))
          tris.push(t1, t2)
        } else {
          const t1 = makeTri(A, B, D, out(A.clone().add(B).add(D).divideScalar(3)))
          const t2 = makeTri(B, C, D, out(B.clone().add(C).add(D).divideScalar(3)))
          tris.push(t1, t2)
        }
      })
    })
  })
  // Scatter direction for a flat glyph: radial + toward camera.
  for (const t of tris) {
    t.normal.set(t.centroid.x * 0.6, t.centroid.y * 0.6, 1).normalize()
  }
  return tris
}

/** Thin glass prism for one panel, centred on its centroid (so it rotates about itself). */
export function panelGeometry(t: Tri, thickness: number, shrink: number): THREE.BufferGeometry {
  const c = t.centroid
  const n = t.normal
  const pts = [t.a, t.b, t.c].map((v) => v.clone().sub(c).multiplyScalar(shrink))
  const half = n.clone().multiplyScalar(thickness / 2)
  const f = pts.map((p) => p.clone().add(half))
  const b = pts.map((p) => p.clone().sub(half))
  const tris: THREE.Vector3[] = []
  const push = (...v: THREE.Vector3[]) => tris.push(...v)
  push(f[0]!, f[1]!, f[2]!)
  push(b[0]!, b[2]!, b[1]!)
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3
    push(f[i]!, b[i]!, b[j]!)
    push(f[i]!, b[j]!, f[j]!)
  }
  const g = new THREE.BufferGeometry()
  g.setFromPoints(tris)
  g.computeVertexNormals()
  return g
}
