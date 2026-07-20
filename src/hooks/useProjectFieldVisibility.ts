'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ProjectInfoFieldDefinition,
  ProjectInfoGroupKey,
} from '@/constants/projectInfoSchema'
import {
  defaultProjectFieldPreferenceRepository,
  getDefaultVisibleFieldKeys,
  reconcileVisibleFieldKeys,
  type ProjectFieldPreferenceRepository,
} from '@/lib/projectFieldPreferences'

interface UseProjectFieldVisibilityOptions {
  userId: string
  projectId: string
  groupKey: ProjectInfoGroupKey
  fields: ProjectInfoFieldDefinition[]
  repository?: ProjectFieldPreferenceRepository
}

export const useProjectFieldVisibility = ({
  userId,
  projectId,
  groupKey,
  fields,
  repository = defaultProjectFieldPreferenceRepository,
}: UseProjectFieldVisibilityOptions) => {
  const defaultKeys = useMemo(() => getDefaultVisibleFieldKeys(fields), [fields])
  const [visibleFieldKeys, setVisibleFieldKeysState] = useState<string[]>(defaultKeys)
  const scopeKey = `${userId}::${projectId}::${groupKey}`
  const activeScopeRef = useRef(scopeKey)

  useEffect(() => {
    activeScopeRef.current = scopeKey
    const stored = repository.get({ userId, projectId, groupKey })
    setVisibleFieldKeysState(reconcileVisibleFieldKeys(fields, stored?.visibleFieldKeys))
  }, [fields, groupKey, projectId, repository, scopeKey, userId])

  const setVisibleFieldKeys = useCallback((nextKeys: string[]) => {
    const reconciled = reconcileVisibleFieldKeys(fields, nextKeys)
    setVisibleFieldKeysState(reconciled)
    repository.save({
      userId,
      projectId,
      groupKey,
      visibleFieldKeys: reconciled,
      updatedAt: new Date().toISOString(),
    })
  }, [fields, groupKey, projectId, repository, userId])

  return {
    visibleFieldKeys,
    setVisibleFieldKeys,
    isDefault: visibleFieldKeys.join('|') === defaultKeys.join('|'),
  }
}
