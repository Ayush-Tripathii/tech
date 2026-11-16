import type { ReactNode } from 'react'

/**
 * §10.1 Rolling text — label duplicated in a clipped container; on hover of
 * the nearest link/button the stack translates -100% (0.4s ease-out-quart).
 * The duplicate is aria-hidden so screen readers read the label once.
 */
export function RollingText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`roll${className ? ` ${className}` : ''}`}>
      <span className="roll__stack">
        <span>{children}</span>
        <span aria-hidden="true">{children}</span>
      </span>
    </span>
  )
}
