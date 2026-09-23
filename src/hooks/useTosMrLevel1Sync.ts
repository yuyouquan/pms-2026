'use client'

import { useEffect } from 'react'
import { PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { rehydrateMrVersionPlanStore, useMrVersionPlanStore } from '@/stores/mrVersionPlan'
import { buildTosTypeRows, getMainTosType } from '@/lib/tosTypeRules'
import { selectActiveTosMrTasks } from '@/lib/tosMrLevel1Sync'
import { selectTosMrVersionCandidatesFromTasks } from '@/lib/mrVersionPlanRules'
import { withoutPmsHydrationWrites } from '@/lib/mockDatasetStorage'

/** Derived MR membership follows the canonical source, even when the MR tab is not open. */
export function startTosMrLevel1Sync(eventTarget: Window = window) {
  let stopped = false
  let queued = false
  const stores = [useProjectStore, usePlanStore, useMrVersionPlanStore]
  const refresh = () => {
    if (stopped || queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      if (stopped || stores.some(store => !store.persist.hasHydrated())) return
      const projectState = useProjectStore.getState()
      const plan = usePlanStore.getState()
      for (const project of projectState.projects) {
        if (project.type !== PROJECT_TYPE_TOS_VERSION) continue
        const tosTypeRows = buildTosTypeRows(project.versionTypes || [], project.versionType || '', projectState.tosTypeConfigsByProjectId[project.id])
        const tasks = selectActiveTosMrTasks({
          project,
          tosTypeRows,
          tosTypeVersionsByKey: plan.tosTypeVersionsByKey,
          publishedSnapshots: plan.publishedSnapshots,
          fallbackVersions: plan.versions,
          sharedBusinessTasks: plan.level1BusinessTasksByScope,
          tosTypePlanData: plan.tosTypePlanDataByProjectId,
        })
        // Missing/not-yet-hydrated source is not an authoritative empty collection.
        if (tasks !== null) useMrVersionPlanStore.getState().syncTosInstancesFromLevel1(project.id, selectTosMrVersionCandidatesFromTasks(tasks), getMainTosType(tosTypeRows))
      }
    })
  }
  const unsubscribe = stores.flatMap(store => [store.subscribe(refresh), store.persist.onFinishHydration(refresh)])
  const names = new Set(stores.map(store => store.persist.getOptions().name))
  const onStorage = (event: StorageEvent) => {
    if (!event.key || !names.has(event.key) || event.storageArea !== eventTarget.localStorage) return
    withoutPmsHydrationWrites(() => { stores.forEach(store => { void store.persist.rehydrate() }) })
    refresh()
  }
  eventTarget.addEventListener('storage', onStorage)
  void rehydrateMrVersionPlanStore().then(refresh)
  refresh()
  return () => {
    stopped = true
    unsubscribe.forEach(stop => stop())
    eventTarget.removeEventListener('storage', onStorage)
  }
}

export function useTosMrLevel1Sync() {
  useEffect(() => startTosMrLevel1Sync(), [])
}
