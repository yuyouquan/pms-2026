'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createSubmissionGuard } from '@/lib/submissionGuard'

type FocusTarget = HTMLElement | null | undefined | (() => HTMLElement | null | undefined)

const resolveFocusTarget = (target: FocusTarget) => (
  typeof target === 'function' ? target() : target
)

/** Shared focus-return and same-tick submission guard for short-lived overlays. */
export function useOverlayInteraction() {
  const triggerRef = useRef<HTMLElement | null>(null)
  const submissionGuardRef = useRef<ReturnType<typeof createSubmissionGuard>>()
  if (!submissionGuardRef.current) submissionGuardRef.current = createSubmissionGuard()
  const focusTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current)
    submissionGuardRef.current?.dispose()
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

  const tryBeginSubmit = useCallback(() => submissionGuardRef.current!.tryBeginSubmit(), [])

  const releaseSubmission = useCallback((afterCurrentTick = false) => {
    submissionGuardRef.current!.releaseSubmission(afterCurrentTick)
  }, [])

  return { captureTrigger, restoreTriggerFocus, tryBeginSubmit, releaseSubmission }
}
