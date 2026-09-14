'use client'

import { useEffect } from 'react'
import { usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { useTechnicalPlanStore } from '@/stores/technicalPlan'
import { useHrConfigStore } from '@/stores/hrConfig'
import { useHrMachineStore } from '@/stores/hrMachine'
import { useHrTosStore } from '@/stores/hrTos'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import { useHrCapabilityStore } from '@/stores/hrCapability'

/** Subscribe to canonical sources; changing the selected market/type never changes the main-plan source. */
export function startHrFormalProjectSync(eventTarget: Window = window) {
  let refreshing = false
  let hydrating = false
  const stores = [usePermissionStore, useProjectStore, usePlanStore, useTechnicalPlanStore, useHrConfigStore, useHrMachineStore, useHrTosStore, useHrTechnicalStore, useHrCapabilityStore]
  const refresh = () => {
    if (hydrating || refreshing || stores.some(store => !store.persist.hasHydrated())) return
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
  // Read all related records before deriving resource metadata. A stale background
  // tab must never write its old version collection during a registry binding change.
  const sharedStores = stores
  const names = new Set(sharedStores.map(store => store.persist.getOptions().name))
  const onStorage = (event: StorageEvent) => {
    if (!event.key || !names.has(event.key) || event.storageArea !== eventTarget.localStorage) return
    hydrating = true
    try {
      // These stores use synchronous localStorage adapters. Permissions precede the
      // registry because its hydration also initializes missing project roles.
      for (const store of sharedStores) void store.persist.rehydrate()
    } finally { hydrating = false }
    refresh()
  }
  eventTarget.addEventListener('storage', onStorage)
  return () => {
    eventTarget.removeEventListener('storage', onStorage)
    unsubscribe.forEach(stop => stop())
  }
}

export function useHrFormalProjectSync() {
  useEffect(() => startHrFormalProjectSync(), [])
}
