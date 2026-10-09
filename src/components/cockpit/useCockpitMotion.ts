'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { COCKPIT_MOTION_FPS, cockpitMotionFrames, cockpitMotionProgress, cockpitTweenValue } from '@/components/cockpit/cockpitMotion'

const useLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect
const motionQuery = '(prefers-reduced-motion: reduce)'
const subscribe = (notify: () => void) => { const query = window.matchMedia(motionQuery); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify) }
const snapshot = () => window.matchMedia(motionQuery).matches
export const useCockpitReducedMotion = () => useSyncExternalStore(subscribe, snapshot, () => true)

export function useCockpitNumber(value: number | undefined, context: string) {
  const reduced = useCockpitReducedMotion(), [display, setDisplay] = useState(value)
  const shown = useRef(value), previousContext = useRef(context)
  useLayout(() => {
    let request = 0, stopped = false
    const from = shown.current, sameContext = previousContext.current === context
    previousContext.current = context
    const settle = () => { stopped = true; cancelAnimationFrame(request); shown.current = value; setDisplay(value) }
    if (reduced || !sameContext || from === undefined || value === undefined || from === value || document.hidden) { settle(); return }
    const start = performance.now(), duration = 30
    const tick = (time: number) => {
      if (stopped) return
      const frame = (time - start) / 1000 * COCKPIT_MOTION_FPS
      const next = cockpitTweenValue(from, value, cockpitMotionProgress(frame, duration))
      shown.current = next; setDisplay(next)
      if (frame < duration) request = requestAnimationFrame(tick)
      else settle()
    }
    const visibility = () => { if (document.hidden) settle() }
    request = requestAnimationFrame(tick); document.addEventListener('visibilitychange', visibility)
    return () => { stopped = true; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', visibility) }
  }, [value, context, reduced])
  return reduced || previousContext.current !== context || value === undefined ? value : display
}

type Element = HTMLElement | SVGElement
const owners = new WeakMap<Element, Animation>()
function play(element: Element, kind: 'enter' | 'line' | 'bar', seconds: number, delay = 0) {
  owners.get(element)?.cancel()
  const animation = element.animate(cockpitMotionFrames(kind, seconds), { duration: seconds * 1000, delay, fill: 'backwards' })
  owners.set(element, animation); element.dataset.cockpitMotion = kind; element.dataset.motionState = 'running'
  void animation.finished.catch(() => {}).then(() => {
    if (owners.get(element) === animation) { owners.delete(element); element.dataset.motionState = 'settled' }
  })
  return animation
}

/** Own only cockpit animations. Reduced motion and background tabs immediately restore final, truthful geometry. */
export function useCockpitMotion(ref: RefObject<HTMLElement | SVGSVGElement>, signature: string, kind: 'page' | 'chart' | 'ranking' | 'content', enabled = true) {
  const reduced = useCockpitReducedMotion()
  useLayout(() => {
    const root = ref.current
    if (!root || reduced || !enabled || document.hidden || typeof root.animate !== 'function') return
    const animations: Animation[] = [], observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || document.hidden || window.matchMedia(motionQuery).matches) return
        observer.unobserve(entry.target)
        animations.push(play(entry.target as Element, 'enter', .38))
      })
    }, { threshold: .08 })
    if (kind === 'page') {
      root.querySelectorAll<Element>('.cockpit-metric').forEach((element, index) => animations.push(play(element, 'enter', .38, index * 24)))
      root.querySelectorAll<Element>('.cockpit-trend-panel, .cockpit-share-panel, .cockpit-overview').forEach(element => observer.observe(element))
    } else if (kind === 'chart') {
      root.querySelectorAll<SVGElement>('.cockpit-line').forEach((element, index) => animations.push(play(element, 'line', .52, index * 28)))
      root.querySelectorAll<SVGElement>('.cockpit-bar-period').forEach((element, index) => animations.push(play(element, 'bar', .42, Math.min(index, 12) * 10)))
    } else if (kind === 'ranking') {
      root.querySelectorAll<HTMLElement>('.cockpit-ranking-list li').forEach((element, index) => animations.push(play(element, 'enter', .34, index * 24)))
    } else animations.push(play(root, 'enter', .22))
    const stop = () => animations.forEach(animation => animation.cancel())
    const visibility = () => { if (document.hidden) { observer.disconnect(); stop() } }
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); stop(); document.removeEventListener('visibilitychange', visibility) }
  }, [ref, signature, kind, enabled, reduced])
}
