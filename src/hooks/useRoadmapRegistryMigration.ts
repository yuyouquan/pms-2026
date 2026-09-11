'use client'
import { useEffect, useState } from 'react'
import { useProjectStore } from '@/stores/project'
import { useRoadmapStore } from '@/stores/roadmap'
import { migrateLegacyRoadmapRegistry } from '@/lib/roadmapRegistryMigration'

export function useRoadmapRegistryMigration(): string[] {
  const [conflicts, setConflicts] = useState<string[]>([])
  useEffect(() => {
    const migrate = () => {
      if (useProjectStore.persist.hasHydrated() && useRoadmapStore.persist.hasHydrated()) {
        setConflicts(migrateLegacyRoadmapRegistry().conflicts)
      }
    }
    const stopProject = useProjectStore.persist.onFinishHydration(migrate)
    const stopRoadmap = useRoadmapStore.persist.onFinishHydration(migrate)
    migrate()
    return () => { stopProject(); stopRoadmap() }
  }, [])
  return conflicts
}
