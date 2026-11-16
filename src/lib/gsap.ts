'use client'
/**
 * GSAP registration — imported once by the MotionProvider. Every component
 * imports gsap from here so plugin registration is guaranteed.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { Observer } from 'gsap/Observer'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { Flip } from 'gsap/Flip'
import { CustomEase } from 'gsap/CustomEase'
import { useGSAP } from '@gsap/react'
import { BEZIER, EASE } from './motion/tokens'

let registered = false

export function registerGSAP() {
  if (registered || typeof window === 'undefined') return
  registered = true
  gsap.registerPlugin(
    ScrollTrigger,
    SplitText,
    Observer,
    Draggable,
    InertiaPlugin,
    DrawSVGPlugin,
    Flip,
    CustomEase,
    useGSAP,
  )
  for (const key of Object.keys(BEZIER) as (keyof typeof BEZIER)[]) {
    const [a, b, c, d] = BEZIER[key]
    CustomEase.create(EASE[key], `M0,0 C${a},${b} ${c},${d} 1,1`)
  }
  gsap.defaults({ ease: EASE.outExpo, duration: 0.6 })
  ScrollTrigger.config({ ignoreMobileResize: true })
}

registerGSAP()

export { gsap, ScrollTrigger, SplitText, Observer, Draggable, InertiaPlugin, Flip, useGSAP }
