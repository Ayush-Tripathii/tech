'use client'
import { useRef } from 'react'
import { BlurTextReveal } from './BlurTextReveal'
import { useSweep } from './useSweep'
import styles from './Eyebrow.module.css'

/** Section eyebrow: index + label, BlurTextReveal + spectrum sweep on the rule. */
export function Eyebrow({ index, label, className }: { index: string; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useSweep(ref)
  return (
    <div ref={ref} className={`sweep ${styles.eyebrow} ${className ?? ''}`}>
      <span className="t-label t-dim">{index}</span>
      <BlurTextReveal items={[label]} className="t-label" />
    </div>
  )
}
