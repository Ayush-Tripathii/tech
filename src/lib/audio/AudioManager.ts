'use client'
/**
 * Global AudioManager singleton.
 *
 * - Muted by default; mute state persists to localStorage.
 * - The AudioContext is created lazily on the first user gesture — never before.
 * - Everything is synthesised at runtime. The two textural loops (ambient bed,
 *   whoosh) are fetched from /audio/*.mp3 on idle if present, otherwise rendered
 *   procedurally with an OfflineAudioContext — so the site never ships silence.
 * - Every sound has an attack/decay envelope. Master ceiling 0.4.
 * - One sound per discrete event, debounced at 60ms, with voice stealing.
 */
import { onIdle } from '../motion/idle'

const STORAGE_KEY = 'gbg:sound'
const MASTER_CEILING = 0.4
const DEBOUNCE_MS = 60

/** Pentatonic set (G major pentatonic across two octaves) — any combination sounds intentional. */
export const PENTATONIC = [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88] as const

interface Voice {
  stop: (when?: number) => void
  started: number
}

export interface ChargeHandle {
  /** 0..1 */
  update: (p: number) => void
  release: () => void
}

type Listener = (on: boolean) => void

class AudioManagerImpl {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: DynamicsCompressorNode | null = null
  private enabled = false
  private last = new Map<string, number>()
  private voices = new Map<string, Voice[]>()
  private brown: AudioBuffer | null = null
  private white: AudioBuffer | null = null
  private plucks = new Map<number, AudioBuffer>()
  private bedBuffer: AudioBuffer | null = null
  private whooshBuffer: AudioBuffer | null = null
  private bedGain: GainNode | null = null
  private bedSource: AudioBufferSourceNode | null = null
  private listeners = new Set<Listener>()
  private gestureBound = false

  /** Read persisted state and arm the first-gesture hook. Never creates a context. */
  init() {
    if (typeof window === 'undefined' || this.gestureBound) return
    this.gestureBound = true
    try {
      this.enabled = window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      this.enabled = false
    }
    const onGesture = () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      if (this.enabled) this.ensure()
    }
    window.addEventListener('pointerdown', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture)
    this.emit()
  }

  get isEnabled() {
    return this.enabled
  }

  onChange(fn: Listener) {
    this.listeners.add(fn)
    fn(this.enabled)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    for (const fn of this.listeners) fn(this.enabled)
  }

  /** Must be called from a user gesture handler. */
  setEnabled(on: boolean) {
    this.enabled = on
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
    } catch {
      /* private mode */
    }
    if (on) this.ensure()
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(on ? MASTER_CEILING : 0, t, 0.08)
    }
    if (on) this.startBed()
    this.emit()
  }

  toggle() {
    this.setEnabled(!this.enabled)
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor({ latencyHint: 'interactive' })
    this.ctx = ctx
    this.bus = ctx.createDynamicsCompressor()
    this.bus.threshold.value = -18
    this.bus.knee.value = 12
    this.bus.ratio.value = 6
    this.bus.attack.value = 0.003
    this.bus.release.value = 0.2
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.bus.connect(this.master).connect(ctx.destination)
    if (this.enabled) this.master.gain.setTargetAtTime(MASTER_CEILING, ctx.currentTime, 0.1)
    // Build heavier buffers off the critical path.
    onIdle(() => {
      this.brown = this.makeNoise('brown', 3)
      this.white = this.makeNoise('white', 1)
      void this.loadLoops()
    })
    return ctx
  }

  private ready(): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.bus) return null
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** Debounce + voice stealing gate. */
  private gate(key: string, maxVoices: number): boolean {
    const now = performance.now()
    const prev = this.last.get(key) ?? 0
    if (now - prev < DEBOUNCE_MS) return false
    this.last.set(key, now)
    const list = this.voices.get(key) ?? []
    while (list.length >= maxVoices) {
      const v = list.shift()
      v?.stop()
    }
    this.voices.set(key, list)
    return true
  }

  private track(key: string, voice: Voice, lifetime: number) {
    const list = this.voices.get(key) ?? []
    list.push(voice)
    this.voices.set(key, list)
    window.setTimeout(() => {
      const l = this.voices.get(key)
      if (!l) return
      const i = l.indexOf(voice)
      if (i >= 0) l.splice(i, 1)
    }, lifetime * 1000 + 50)
  }

  private envGain(ctx: AudioContext, t: number, attack: number, peak: number, decay: number) {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    return g
  }

  private makeNoise(kind: 'brown' | 'white', seconds: number): AudioBuffer | null {
    const ctx = this.ctx
    if (!ctx) return null
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'white') d[i] = w
      else {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      }
    }
    return buf
  }

  private noise(kind: 'brown' | 'white') {
    if (kind === 'brown') return (this.brown ??= this.makeNoise('brown', 3))
    return (this.white ??= this.makeNoise('white', 1))
  }

  /* ------------------------------------------------------------------ */
  /*  Synthesised one-shots                                              */
  /* ------------------------------------------------------------------ */

  hover() {
    const ctx = this.ready()
    if (!ctx || !this.gate('hover', 2)) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(2100, t)
    o.frequency.exponentialRampToValueAtTime(2900, t + 0.04)
    const g = this.envGain(ctx, t, 0.003, 0.035, 0.07)
    o.connect(g).connect(this.bus!)
    o.start(t)
    o.stop(t + 0.1)
    this.track('hover', { stop: () => o.stop(), started: t }, 0.1)
  }

  click() {
    const ctx = this.ready()
    if (!ctx || !this.gate('click', 2)) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(420, t)
    o.frequency.exponentialRampToValueAtTime(140, t + 0.09)
    const g = this.envGain(ctx, t, 0.002, 0.12, 0.12)
    o.connect(g).connect(this.bus!)
    o.start(t)
    o.stop(t + 0.16)
    this.track('click', { stop: () => o.stop(), started: t }, 0.16)
  }

  /** One spark per burst — never per bolt. */
  spark(intensity = 1) {
    const ctx = this.ready()
    const buf = this.noise('white')
    if (!ctx || !buf || !this.gate('spark', 3)) return
    const t = ctx.currentTime
    const out = ctx.createGain()
    out.gain.value = 0.5 * intensity
    out.connect(this.bus!)
    const nodes: AudioScheduledSourceNode[] = []
    // Crackle: a handful of micro-bursts through a resonant band-pass.
    for (let i = 0; i < 7; i++) {
      const at = t + Math.random() * 0.14
      const src = ctx.createBufferSource()
      src.buffer = buf
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 2500 + Math.random() * 4500
      bp.Q.value = 6
      const g = this.envGain(ctx, at, 0.001, 0.25 + Math.random() * 0.25, 0.03 + Math.random() * 0.04)
      src.connect(bp).connect(g).connect(out)
      src.start(at, Math.random() * 0.5, 0.1)
      nodes.push(src)
    }
    // Arc chirp
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(5200, t)
    o.frequency.exponentialRampToValueAtTime(700, t + 0.18)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3800
    const og = this.envGain(ctx, t, 0.002, 0.05, 0.2)
    o.connect(lp).connect(og).connect(out)
    o.start(t)
    o.stop(t + 0.25)
    nodes.push(o)
    this.track('spark', { stop: () => nodes.forEach((n) => { try { n.stop() } catch { /* already */ } }), started: t }, 0.3)
  }

  /** Karplus–Strong plucked wire, buffers computed once per note and cached. */
  pluck(noteIndex: number, amplitude = 1) {
    const ctx = this.ready()
    if (!ctx || !this.gate(`pluck${noteIndex}`, 1)) return
    const i = ((noteIndex % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length
    let buf = this.plucks.get(i)
    if (!buf) {
      buf = this.makePluck(PENTATONIC[i]!)
      this.plucks.set(i, buf)
    }
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = this.envGain(ctx, t, 0.004, 0.55 * Math.min(1, Math.max(0.15, amplitude)), 1.6)
    const pan = ctx.createStereoPanner()
    pan.pan.value = (i / (PENTATONIC.length - 1)) * 1.2 - 0.6
    src.connect(g).connect(pan).connect(this.bus!)
    src.start(t)
    src.stop(t + 1.8)
    const list = this.voices.get('pluck') ?? []
    while (list.length >= 6) list.shift()?.stop()
    const v = { stop: () => { try { src.stop() } catch { /* */ } }, started: t }
    list.push(v)
    this.voices.set('pluck', list)
  }

  private makePluck(freq: number): AudioBuffer {
    const ctx = this.ctx!
    const sr = ctx.sampleRate
    const len = Math.floor(sr * 1.8)
    const buf = ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    const period = Math.max(2, Math.round(sr / freq))
    const ring = new Float32Array(period)
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1
    let idx = 0
    const decay = 0.996
    for (let i = 0; i < len; i++) {
      const a = ring[idx]!
      const b = ring[(idx + 1) % period]!
      const v = decay * 0.5 * (a + b)
      ring[idx] = v
      d[i] = a
      idx = (idx + 1) % period
    }
    return buf
  }

  /** Hold-to-charge rumble: filtered brown noise + sub oscillator rising over 900ms. */
  charge(): ChargeHandle {
    const noop: ChargeHandle = { update: () => {}, release: () => {} }
    const ctx = this.ready()
    const buf = this.noise('brown')
    if (!ctx || !buf) return noop
    this.voices.get('charge')?.forEach((v) => v.stop())
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 4
    lp.frequency.value = 90
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 38
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.08)
    const sg = ctx.createGain()
    sg.gain.value = 0
    src.connect(lp).connect(g).connect(this.bus!)
    sub.connect(sg).connect(this.bus!)
    src.start(t)
    sub.start(t)
    let stopped = false
    const stop = () => {
      if (stopped) return
      stopped = true
      const n = ctx.currentTime
      g.gain.cancelScheduledValues(n)
      g.gain.setTargetAtTime(0.0001, n, 0.06)
      sg.gain.cancelScheduledValues(n)
      sg.gain.setTargetAtTime(0, n, 0.06)
      src.stop(n + 0.4)
      sub.stop(n + 0.4)
    }
    this.voices.set('charge', [{ stop, started: t }])
    return {
      update: (p) => {
        if (stopped) return
        const n = ctx.currentTime
        const e = p * p
        lp.frequency.setTargetAtTime(90 + e * 900, n, 0.03)
        src.playbackRate.setTargetAtTime(0.6 + p * 1.1, n, 0.03)
        g.gain.setTargetAtTime(0.08 + e * 0.55, n, 0.03)
        sub.frequency.setTargetAtTime(38 + p * 34, n, 0.03)
        sg.gain.setTargetAtTime(e * 0.35, n, 0.03)
      },
      release: stop,
    }
  }

  /** Refract burst: glass shatter pings + noise blast + whoosh loop tail. */
  refract() {
    const ctx = this.ready()
    const buf = this.noise('white')
    if (!ctx || !buf || !this.gate('refract', 1)) return
    const t = ctx.currentTime
    const out = ctx.createGain()
    out.gain.value = 0.7
    out.connect(this.bus!)
    // Blast
    const src = ctx.createBufferSource()
    src.buffer = buf
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(400, t)
    hp.frequency.exponentialRampToValueAtTime(6000, t + 0.5)
    const g = this.envGain(ctx, t, 0.004, 0.5, 0.55)
    src.connect(hp).connect(g).connect(out)
    src.start(t)
    // Thump
    const th = ctx.createOscillator()
    th.frequency.setValueAtTime(120, t)
    th.frequency.exponentialRampToValueAtTime(32, t + 0.4)
    const tg = this.envGain(ctx, t, 0.003, 0.7, 0.45)
    th.connect(tg).connect(out)
    th.start(t)
    th.stop(t + 0.5)
    // Glass pings
    for (let i = 0; i < 14; i++) {
      const at = t + 0.02 + Math.random() * 0.5
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = 2400 + Math.random() * 5200
      const pg = this.envGain(ctx, at, 0.001, 0.04 + Math.random() * 0.05, 0.15 + Math.random() * 0.4)
      o.connect(pg).connect(out)
      o.start(at)
      o.stop(at + 0.6)
    }
    this.whoosh(1.4)
  }

  whoosh(duration = 0.9) {
    const ctx = this.ready()
    if (!ctx || !this.gate('whoosh', 1)) return
    const buf = this.whooshBuffer ?? this.noise('white')
    if (!buf) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(300, t)
    bp.frequency.exponentialRampToValueAtTime(2400, t + duration * 0.5)
    bp.frequency.exponentialRampToValueAtTime(500, t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + duration * 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(bp).connect(g).connect(this.bus!)
    src.start(t)
    src.stop(t + duration + 0.05)
    this.track('whoosh', { stop: () => { try { src.stop() } catch { /* */ } }, started: t }, duration)
  }

  /* ------------------------------------------------------------------ */
  /*  Ambient bed                                                        */
  /* ------------------------------------------------------------------ */

  private async loadLoops() {
    const ctx = this.ctx
    if (!ctx) return
    const tryFetch = async (url: string) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        return await ctx.decodeAudioData(await res.arrayBuffer())
      } catch {
        return null
      }
    }
    this.bedBuffer = (await tryFetch('/audio/bed.mp3')) ?? (await this.renderBed())
    this.whooshBuffer = (await tryFetch('/audio/whoosh.mp3')) ?? this.noise('white')
    if (this.enabled) this.startBed()
  }

  private async renderBed(): Promise<AudioBuffer | null> {
    const ctx = this.ctx
    if (!ctx || typeof OfflineAudioContext === 'undefined') return null
    const seconds = 12
    const sr = 22050
    const off = new OfflineAudioContext(2, sr * seconds, sr)
    const g = off.createGain()
    g.gain.value = 0.5
    g.connect(off.destination)
    // Two detuned drones on a fifth, period-aligned to the loop length so it is seamless.
    for (const [f, pan] of [[55, -0.4], [82.5, 0.4], [110.25, 0]] as const) {
      const o = off.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const p = off.createStereoPanner()
      p.pan.value = pan
      const og = off.createGain()
      og.gain.value = 0.18
      const lfo = off.createOscillator()
      lfo.frequency.value = 1 / seconds
      const lg = off.createGain()
      lg.gain.value = 0.1
      lfo.connect(lg).connect(og.gain)
      o.connect(og).connect(p).connect(g)
      o.start()
      lfo.start()
    }
    // Air: low-passed noise
    const n = off.createBuffer(1, sr * seconds, sr)
    const d = n.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 2
    }
    // crossfade ends for a seamless loop
    const fade = sr * 0.5
    for (let i = 0; i < fade; i++) {
      const k = i / fade
      d[i] = d[i]! * k + d[d.length - fade + i]! * (1 - k)
    }
    const ns = off.createBufferSource()
    ns.buffer = n
    const lp = off.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    const ng = off.createGain()
    ng.gain.value = 0.35
    ns.connect(lp).connect(ng).connect(g)
    ns.start()
    return off.startRendering()
  }

  private startBed() {
    const ctx = this.ctx
    if (!ctx || !this.bedBuffer || this.bedSource) return
    this.bedGain = ctx.createGain()
    this.bedGain.gain.value = 0
    const src = ctx.createBufferSource()
    src.buffer = this.bedBuffer
    src.loop = true
    src.connect(this.bedGain).connect(this.bus!)
    src.start()
    this.bedSource = src
  }

  /** Bed gain follows scroll velocity — fast scrolling physically sounds more turbulent. */
  setBed(level: number) {
    if (!this.ctx || !this.bedGain) return
    const v = Math.min(0.35, Math.max(0, level))
    this.bedGain.gain.setTargetAtTime(this.enabled ? v : 0, this.ctx.currentTime, 0.25)
  }

  dispose() {
    this.voices.forEach((l) => l.forEach((v) => v.stop()))
    this.voices.clear()
    try {
      this.bedSource?.stop()
    } catch {
      /* */
    }
    void this.ctx?.close()
    this.ctx = null
    this.bedSource = null
  }
}

export const audio = new AudioManagerImpl()
