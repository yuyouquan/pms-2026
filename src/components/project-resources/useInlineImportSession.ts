'use client'
import { useEffect, useRef } from 'react'
import { createInlineImportSession } from '@/components/project-resources/inlineFieldSession'

export function useInlineImportSession() {
  const session = useRef(createInlineImportSession()).current
  useEffect(() => {
    session.activate()
    return () => session.invalidate()
  }, [session])
  return session
}
