'use client'

import { useCallback, useEffect, useRef } from 'react'

type FocusTarget = HTMLElement | null | undefined | (() => HTMLElement | null | undefined)

const resolveFocusTarget = (target: FocusTarget) => (
  typeof target === 'function' ? target() : target
)

/** Shared focus-return and same-tick submission guard for short-lived overlays. */
export function useOverlayInteraction() {
  const triggerRef = useRef<HTMLElement | null>(null)
  const submitLockedRef = useRef(false)
  const focusTimerRef = useRef<number | null>(null)
  const unlockTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current)
    if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current)
  }, [])

  const captureTrigger = useCallback((target?: HTMLElement | null) => {
    const activeElement = target ?? document.activeElement
    if (activeElement instanceof HTMLElement) triggerRef.current = activeElement
  }, [])

  const restoreTriggerFocus = useCallback((preferred?: FocusTarget) => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current)
    focusTimerRef.current = window.setTimeout(() => {
      const preferredTarget = resolveFocusTarget(preferred)
      const fallback = triggerRef.current?.isConnected ? triggerRef.current : null
      const target = preferredTarget?.isConnected ? preferredTarget : fallback
      target?.focus()
      focusTimerRef.current = null
    }, 180)
  }, [])

  const tryBeginSubmit = useCallback(() => {
    if (submitLockedRef.current) return false
    submitLockedRef.current = true
    return true
  }, [])

  const releaseSubmission = useCallback((afterCurrentTick = false) => {
    if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current)
    if (!afterCurrentTick) {
      submitLockedRef.current = false
      return
    }
    unlockTimerRef.current = window.setTimeout(() => {
      submitLockedRef.current = false
      unlockTimerRef.current = null
    }, 0)
  }, [])

  return { captureTrigger, restoreTriggerFocus, tryBeginSubmit, releaseSubmission }
}
