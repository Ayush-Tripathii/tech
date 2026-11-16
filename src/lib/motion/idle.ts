/** requestIdleCallback with a setTimeout fallback (Safari). Returns a cancel fn. */
export function onIdle(fn: () => void, timeout = 1200): () => void {
  if (typeof window === 'undefined') return () => {}
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout })
    return () => w.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, 16)
  return () => window.clearTimeout(id)
}
