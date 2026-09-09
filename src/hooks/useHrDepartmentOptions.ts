'use client'

import { useMemo } from 'react'
import { createHrDepartmentOptions } from '@/lib/hrDepartments'
import { useHrConfigStore } from '@/stores/hrConfig'
import { useHrTosStore } from '@/stores/hrTos'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import { useHrCapabilityStore } from '@/stores/hrCapability'

export function useHrDepartmentOptions() {
  const configData = useHrConfigStore(state => state.data)
  const tosProjects = useHrTosStore(state => state.projects)
  const technicalProjects = useHrTechnicalStore(state => state.projects)
  const capabilityProjects = useHrCapabilityStore(state => state.projects)

  return useMemo(() => createHrDepartmentOptions(
    Object.values(configData).flat(),
    [tosProjects, technicalProjects, capabilityProjects],
  ), [configData, tosProjects, technicalProjects, capabilityProjects])
}
