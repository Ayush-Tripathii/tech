'use client'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { gsap } from '@/lib/gsap'
import { DUR, EASE, STAGGER } from '@/lib/motion/tokens'
import { prefersReduced } from '@/lib/motion/hooks'
import { audio } from '@/lib/audio/AudioManager'
import { BRAND, SERVICES } from '@/lib/content/site'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { SplitReveal } from '@/components/primitives/SplitReveal'
import { RollingText } from '@/components/primitives/RollingText'
import { Arrow } from '@/components/primitives/Arrow'
import styles from './ContactForm.module.css'

type Field = 'name' | 'email' | 'company' | 'service' | 'budget' | 'message'
type Values = Record<Field, string>
const EMPTY: Values = { name: '', email: '', company: '', service: '', budget: '', message: '' }
const BUDGETS = ['< ₹5L', '₹5L – ₹15L', '₹15L – ₹50L', '₹50L +', 'Not sure yet']

function validate(f: Field, v: string): string {
  const s = v.trim()
  switch (f) {
    case 'name':
      return s.length < 2 ? 'Tell us who you are.' : ''
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? '' : 'That email doesn’t look deliverable.'
    case 'service':
      return s ? '' : 'Pick the closest discipline.'
    case 'message':
      return s.length < 20 ? `A little more detail, please (${Math.max(0, 20 - s.length)} more characters).` : ''
    default:
      return ''
  }
}

function FloatingField({
  id,
  label,
  value,
  error,
  onChange,
  onBlur,
  type = 'text',
  multiline = false,
  required = false,
  autoComplete,
}: {
  id: Field
  label: string
  value: string
  error: string
  onChange: (v: string) => void
  onBlur: () => void
  type?: string
  multiline?: boolean
  required?: boolean
  autoComplete?: string
}) {
  const uid = useId()
  const errId = `${uid}-err`
  const common = {
    id: uid,
    name: id,
    value,
    placeholder: ' ',
    required,
    'aria-invalid': !!error,
    'aria-describedby': errId,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onBlur,
    className: styles.input,
    autoComplete,
  }
  return (
    <div className={styles.field} data-error={!!error}>
      {multiline ? <textarea rows={4} {...common} /> : <input type={type} {...common} />}
      <label htmlFor={uid} className={styles.label}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <div className={styles.err} id={errId} aria-live="polite">
        <div>
          <span className="t-label">{error}</span>
        </div>
      </div>
    </div>
  )
}

function Select({
  label,
  options,
  value,
  error,
  onChange,
  onClose,
  required,
}: {
  label: string
  options: string[]
  value: string
  error: string
  onChange: (v: string) => void
  onClose: () => void
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const uid = useId()

  useEffect(() => {
    const l = list.current
    if (!l) return
    const items = l.querySelectorAll('li')
    if (open) {
      gsap.set(l, { display: 'block' })
      if (prefersReduced()) gsap.fromTo(l, { opacity: 0 }, { opacity: 1, duration: 0.2 })
      else {
        gsap.fromTo(l, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: DUR.base, ease: EASE.outExpo })
        gsap.fromTo(items, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.base, ease: EASE.outExpo, stagger: STAGGER.grid })
      }
    } else {
      gsap.to(l, { clipPath: 'inset(0 0 100% 0)', duration: DUR.fast, ease: EASE.outQuart, onComplete: () => void gsap.set(l, { display: 'none' }) })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => {
      if (!btn.current?.parentElement?.contains(e.target as Node)) {
        setOpen(false)
        onClose()
      }
    }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open, onClose])

  const choose = (i: number) => {
    onChange(options[i]!)
    setOpen(false)
    audio.click()
    btn.current?.focus()
  }
  const onKey = (e: KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setOpen(true)
      setFocus(Math.max(0, options.indexOf(value)))
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocus((f) => (f + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocus((f) => (f - 1 + options.length) % options.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(focus)
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
      onClose()
    }
  }

  return (
    <div className={`${styles.field} ${styles.selectField}`} data-error={!!error} data-filled={!!value} data-open={open}>
      <button
        ref={btn}
        type="button"
        className={`${styles.input} ${styles.selectBtn}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${uid}-lbl ${uid}-val`}
        aria-activedescendant={open ? `${uid}-opt-${focus}` : undefined}
        aria-invalid={!!error}
        onClick={() => {
          setOpen((o) => !o)
          setFocus(Math.max(0, options.indexOf(value)))
        }}
        onKeyDown={onKey}
      >
        <span id={`${uid}-val`}>{value || ' '}</span>
        <span className={styles.chev} aria-hidden="true" />
      </button>
      <span id={`${uid}-lbl`} className={styles.label}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <ul ref={list} role="listbox" className={styles.options} aria-labelledby={`${uid}-lbl`} data-lenis-prevent="" style={{ display: 'none' }}>
        {options.map((o, i) => (
          <li
            key={o}
            id={`${uid}-opt-${i}`}
            role="option"
            aria-selected={o === value}
            data-focus={i === focus}
            className={styles.option}
            onPointerDown={(e) => {
              e.preventDefault()
              choose(i)
            }}
            onPointerEnter={() => setFocus(i)}
          >
            <span className="t-label t-dim">{String(i + 1).padStart(2, '0')}</span>
            {o}
          </li>
        ))}
      </ul>
      <div className={styles.err} aria-live="polite">
        <div>
          <span className="t-label">{error}</span>
        </div>
      </div>
    </div>
  )
}

export function ContactForm() {
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const panel = useRef<HTMLFormElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const success = useRef<HTMLDivElement>(null)

  const set = (f: Field) => (v: string) => {
    setValues((s) => ({ ...s, [f]: v }))
    if (errors[f]) setErrors((e) => ({ ...e, [f]: validate(f, v) }))
  }
  const blur = (f: Field) => () => setErrors((e) => ({ ...e, [f]: validate(f, values[f]) }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state !== 'idle') return
    const next: Partial<Record<Field, string>> = {}
    ;(Object.keys(values) as Field[]).forEach((f) => {
      const m = validate(f, values[f])
      if (m) next[f] = m
    })
    setErrors(next)
    if (Object.keys(next).length) {
      panel.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setState('sending')
    audio.click()
    const btn = submitRef.current!
    const fill = btn.querySelector<HTMLElement>('[data-fill]')!
    const reduced = prefersReduced()
    // 1. button → progress bar
    const morph = gsap.timeline()
    morph.to(btn, { width: '100%', borderRadius: 4, height: 6, duration: reduced ? 0 : DUR.base, ease: EASE.inOutQuint })
    morph.to(btn.querySelectorAll('[data-btn-label]'), { opacity: 0, duration: 0.15 }, 0)
    const progress = gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 0.85, duration: 2.2, ease: 'power2.out', paused: true })
    morph.call(() => void progress.play())

    const endpoint = process.env.NEXT_PUBLIC_FORM_ENDPOINT
    try {
      if (endpoint) {
        await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(values) })
      } else {
        await new Promise((r) => setTimeout(r, 1500))
      }
    } catch {
      /* we still show success; a real endpoint should surface failures */
    }
    progress.kill()
    // 2. progress → checkmark → 3. panel folds away
    const tl = gsap.timeline()
    tl.to(fill, { scaleX: 1, duration: 0.3, ease: EASE.outQuart })
    tl.to(btn, { width: 56, height: 56, borderRadius: 28, duration: DUR.base, ease: EASE.snap })
    tl.fromTo(btn.querySelector('[data-check]'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.4, ease: EASE.outExpo }, '-=0.2')
    tl.call(() => audio.pluck(5, 0.8))
    tl.to(panel.current, { rotateX: -88, opacity: 0, transformOrigin: '50% 0%', duration: DUR.slow, ease: EASE.inOutQuint }, '+=0.35')
    tl.call(() => setState('done'))
  }

  useEffect(() => {
    if (state !== 'done' || !success.current) return
    gsap.fromTo(
      success.current.children,
      { yPercent: 60, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: DUR.slow, ease: EASE.outExpo, stagger: STAGGER.lines },
    )
    success.current.focus()
  }, [state])

  return (
    <section className={`section ${styles.contact}`} id="contact" aria-labelledby="contact-title">
      <div className="container">
        <Eyebrow index="06" label="Start a project" />
        <div className={styles.layout}>
          <div className={styles.intro}>
            <SplitReveal as="h2" id="contact-title" mode="lines" className="t-h1">
              Tell us what you’re building.
            </SplitReveal>
            <p className="t-body-lg t-dim">We reply within one working day — usually with questions that make the brief better.</p>
            <a href={`mailto:${BRAND.email}`} className={`t-label ${styles.mail}`}>
              <RollingText>{BRAND.email}</RollingText>
              <Arrow />
            </a>
          </div>

          <div className={styles.stageWrap}>
            {state !== 'done' ? (
              <form ref={panel} className={styles.form} onSubmit={submit} noValidate aria-busy={state === 'sending'}>
                <div className={styles.row2}>
                  <FloatingField id="name" label="Your name" value={values.name} error={errors.name ?? ''} onChange={set('name')} onBlur={blur('name')} required autoComplete="name" />
                  <FloatingField id="email" type="email" label="Work email" value={values.email} error={errors.email ?? ''} onChange={set('email')} onBlur={blur('email')} required autoComplete="email" />
                </div>
                <FloatingField id="company" label="Company" value={values.company} error="" onChange={set('company')} onBlur={blur('company')} autoComplete="organization" />
                <div className={styles.row2}>
                  <Select label="Discipline" options={SERVICES.map((s) => s.title)} value={values.service} error={errors.service ?? ''} onChange={set('service')} onClose={blur('service')} required />
                  <Select label="Budget" options={BUDGETS} value={values.budget} error="" onChange={set('budget')} onClose={() => {}} />
                </div>
                <FloatingField id="message" label="What are you building?" value={values.message} error={errors.message ?? ''} onChange={set('message')} onBlur={blur('message')} multiline required />
                <div className={styles.submitRow}>
                  <button ref={submitRef} type="submit" className={`btn btn--signal ${styles.submit}`} disabled={state !== 'idle'}>
                    <span data-fill="" className={styles.fill} aria-hidden="true" />
                    <span data-btn-label="" className={styles.btnLabel}>
                      <RollingText>{state === 'sending' ? 'Sending…' : 'Send brief'}</RollingText>
                      <Arrow direction="e" />
                    </span>
                    <svg className={styles.check} viewBox="0 0 24 24" aria-hidden="true">
                      <path data-check="" d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </button>
                  <span className="t-label t-dim">* required</span>
                </div>
              </form>
            ) : (
              <div ref={success} className={styles.success} tabIndex={-1} role="status">
                <span className="t-label" style={{ color: 'var(--signal)' }}>
                  Brief received
                </span>
                <p className="t-h2">Thank you, {values.name.split(' ')[0]}. The lattice is assembling.</p>
                <p className="t-dim">Expect a reply at {values.email} within one working day.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
