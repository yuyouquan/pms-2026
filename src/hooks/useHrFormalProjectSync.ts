'use client'

import { useEffect } from 'react'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { useTechnicalPlanStore } from '@/stores/technicalPlan'
import { useHrConfigStore } from '@/stores/hrConfig'
import { useHrMachineStore } from '@/stores/hrMachine'
import { useHrTosStore } from '@/stores/hrTos'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import { useHrCapabilityStore } from '@/stores/hrCapability'

/** Subscribe to canonical sources; changing the selected market/type never changes the main-plan source. */
export function useHrFormalProjectSync() {
  useEffect(() => {
    let refreshing = false
    const stores = [useProjectStore, usePlanStore, useTechnicalPlanStore, useHrConfigStore, useHrMachineStore, useHrTosStore, useHrTechnicalStore, useHrCapabilityStore]
    const refresh = () => {
      if (refreshing || stores.some(store => !store.persist.hasHydrated())) return
      refreshing = true
      try {
        useHrMachineStore.getState().refreshFormalProjects()
        useHrTosStore.getState().refreshFormalProjects()
        useHrTechnicalStore.getState().refreshFormalProjects()
        useHrCapabilityStore.getState().refreshFormalProjects()
      } finally { refreshing = false }
    }
    refresh()
    const unsubscribe = [
      useProjectStore.subscribe(refresh), usePlanStore.subscribe(refresh),
      useTechnicalPlanStore.subscribe(refresh), useHrConfigStore.subscribe(refresh),
    ]
    unsubscribe.push(...stores.map(store => store.persist.onFinishHydration(refresh)))
    return () => unsubscribe.forEach(stop => stop())
  }, [])
}
