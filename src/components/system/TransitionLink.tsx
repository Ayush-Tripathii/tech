'use client'
import Link from 'next/link'
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { navigate } from './TransitionShell'
import { audio } from '@/lib/audio/AudioManager'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children: ReactNode
}

/**
 * Internal link that routes through the transition shell. Modifier-clicks,
 * new-tab targets and external URLs fall through to the browser.
 */
export function TransitionLink({ href, children, onClick, ...rest }: Props) {
  const external = /^(https?:|mailto:|tel:)/.test(href)
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (external) {
      audio.click()
      return
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || rest.target === '_blank') return
    e.preventDefault()
    audio.click()
    navigate(href)
  }
  if (external) {
    const web = /^https?:/.test(href)
    return (
      <a href={href} onClick={handle} {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} onClick={handle} {...rest}>
      {children}
    </Link>
  )
}
