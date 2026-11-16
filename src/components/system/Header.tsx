'use client'
import { useEffect, useRef, useState } from 'react'
import { TransitionLink } from './TransitionLink'
import { RollingText } from '@/components/primitives/RollingText'
import { Magnetic } from '@/components/primitives/Magnetic'
import { MenuOverlay } from './MenuOverlay'
import { useMotion } from '@/lib/motion/store'
import { subscribe } from '@/lib/motion/engine'
import { audio } from '@/lib/audio/AudioManager'
import { NAV } from '@/lib/content/site'
import styles from './Header.module.css'

export function LatticeMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className={styles.mark}>
      <polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M0,-46 L0,0 L40,23 M0,0 L-40,23" fill="none" stroke="currentColor" strokeWidth="6" />
    </svg>
  )
}

export function Header() {
  const [sound, setSound] = useState(false)
  const menuOpen = useMotion((s) => s.menuOpen)
  const ref = useRef<HTMLElement>(null)
  const burger = useRef<HTMLButtonElement>(null)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })

  useEffect(() => audio.onChange(setSound), [])

  // Hide on scroll down, show on scroll up — read from the shared frame.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let hidden = false
    return subscribe((f) => {
      const shouldHide = f.scroll > 200 && f.direction === 1 && Math.abs(f.velocity) > 0.5 && !useMotion.getState().menuOpen
      const shouldShow = f.direction === -1 || f.scroll < 200
      if (shouldHide && !hidden) {
        hidden = true
        el.dataset.hidden = 'true'
      } else if (shouldShow && hidden) {
        hidden = false
        el.dataset.hidden = 'false'
      }
    })
  }, [])

  const toggleMenu = () => {
    const r = burger.current?.getBoundingClientRect()
    if (r) setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    audio.click()
    useMotion.getState().set({ menuOpen: !menuOpen })
  }

  return (
    <>
      <header ref={ref} className={styles.header} data-hidden="false">
        <TransitionLink href="/" className={styles.logo} aria-label="GBGTech — home">
          <LatticeMark />
          <RollingText>GBGTech</RollingText>
        </TransitionLink>

        <nav aria-label="Primary" className={styles.nav}>
          <ul className="dim-rest">
            {NAV.map((n, i) => (
              <li key={n.href} className="dim-item">
                <TransitionLink href={n.href} className={`t-label ${styles.navLink}`}>
                  <span className={styles.navIdx}>0{i + 1}</span>
                  <RollingText>{n.label}</RollingText>
                </TransitionLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <Magnetic strength={0.18}>
            <button
              type="button"
              className={styles.sound}
              aria-pressed={sound}
              aria-label={sound ? 'Mute sound' : 'Enable sound'}
              onClick={() => audio.toggle()}
              data-on={sound}
            >
              <span className={styles.eq} aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} style={{ animationDelay: `${i * -0.23}s` }} />
                ))}
              </span>
              <span className="t-label">
                <RollingText>{sound ? 'Sound on' : 'Sound off'}</RollingText>
              </span>
            </button>
          </Magnetic>
          <Magnetic strength={0.25}>
            <button
              ref={burger}
              type="button"
              className={styles.burger}
              aria-expanded={menuOpen}
              aria-controls="menu-overlay"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={toggleMenu}
              data-open={menuOpen}
            >
              <span />
              <span />
            </button>
          </Magnetic>
        </div>
      </header>
      <MenuOverlay origin={origin} onClose={() => burger.current?.focus()} />
    </>
  )
}
