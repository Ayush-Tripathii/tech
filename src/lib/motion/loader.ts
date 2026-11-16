'use client'
/**
 * Honest asset-load tracker for the preloader. Subsystems register tasks and
 * resolve them when genuinely ready (fonts decoded, hero shaders compiled +
 * first frame rendered, first frame-sequence frames decoded). The preloader's
 * third reel reads `progress()` — it can never show 100% before this is 1.
 */
type Listener = (p: number) => void

const tasks = new Map<string, boolean>()
const listeners = new Set<Listener>()
let sealed = false

const emit = () => {
  const p = progress()
  for (const fn of listeners) fn(p)
}

export function register(name: string) {
  if (sealed || tasks.has(name)) return
  tasks.set(name, false)
  emit()
}

export function resolve(name: string) {
  if (!tasks.has(name) && sealed) return
  tasks.set(name, true)
  emit()
}

export function progress(): number {
  if (tasks.size === 0) return 0
  let done = 0
  for (const v of tasks.values()) if (v) done++
  return done / tasks.size
}

export function onProgress(fn: Listener) {
  listeners.add(fn)
  fn(progress())
  return () => {
    listeners.delete(fn)
  }
}

/** After the preloader completes, late registrations are ignored. */
export function seal() {
  sealed = true
}
