'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PROJECT_INFO_SCHEMA_VERSION,
} from '@/constants/projectInfoSchema'
import {
  createCurrentFieldVisibilityPreference,
  defaultProjectFieldPreferenceRepository,
  getDefaultVisibleFieldKeys,
  reconcileVisibleFieldKeys,
  type ProjectFieldPreferenceGroupKey,
  type ProjectFieldPreferenceRepository,
  type ProjectVisibilityFieldDefinition,
} from '@/lib/projectFieldPreferences'

interface UseProjectFieldVisibilityOptions {
  userId: string
  projectId: string
  groupKey: ProjectFieldPreferenceGroupKey
  fields: ProjectVisibilityFieldDefinition[]
  repository?: ProjectFieldPreferenceRepository
  onSaveError?: () => void
}

export const useProjectFieldVisibility = ({
  userId,
  projectId,
  groupKey,
  fields,
  repository = defaultProjectFieldPreferenceRepository,
  onSaveError,
}: UseProjectFieldVisibilityOptions) => {
  const defaultKeys = useMemo(() => getDefaultVisibleFieldKeys(fields), [fields])
  const [visibleFieldKeys, setVisibleFieldKeysState] = useState<string[]>(defaultKeys)
  const scopeKey = `${userId}::${projectId}::${groupKey}`
  const activeScopeRef = useRef<string | null>(scopeKey)
  const visibleFieldKeysRef = useRef<string[]>(defaultKeys)
  const saveRequestRef = useRef(0)

  useEffect(() => {
    activeScopeRef.current = scopeKey
    const stored = repository.get({ userId, projectId, groupKey })
    const reconciled = reconcileVisibleFieldKeys(fields, stored)
    visibleFieldKeysRef.current = reconciled
    setVisibleFieldKeysState(reconciled)

    return () => {
      if (activeScopeRef.current === scopeKey) activeScopeRef.current = null
    }
  }, [fields, groupKey, projectId, repository, scopeKey, userId])

  const setVisibleFieldKeys = useCallback(async (nextKeys: string[]) => {
    const previousKeys = visibleFieldKeysRef.current
    const reconciled = reconcileVisibleFieldKeys(fields, {
      visibleFieldKeys: nextKeys,
      schemaVersion: PROJECT_INFO_SCHEMA_VERSION,
    })
    const requestId = ++saveRequestRef.current

    visibleFieldKeysRef.current = reconciled
    setVisibleFieldKeysState(reconciled)

    try {
      const result = await repository.save(createCurrentFieldVisibilityPreference(
        { userId, projectId, groupKey },
        reconciled,
      ))
      if (result === false) throw new Error('Project field preference repository returned failure')
    } catch (error) {
      if (activeScopeRef.current === scopeKey && saveRequestRef.current === requestId) {
        visibleFieldKeysRef.current = previousKeys
        setVisibleFieldKeysState(previousKeys)
        onSaveError?.()
      }
      throw error instanceof Error ? error : new Error('Project field preference save failed')
    }
  }, [fields, groupKey, onSaveError, projectId, repository, scopeKey, userId])

  return {
    visibleFieldKeys,
    setVisibleFieldKeys,
    isDefault: visibleFieldKeys.join('|') === defaultKeys.join('|'),
  }
}
