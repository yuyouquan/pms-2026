'use client'

import { useEffect } from 'react'
import { PROJECT_TYPE_TOS_VERSION, isMachineProjectType } from '@/constants/projectTypes'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { rehydrateMrVersionPlanStore, useMrVersionPlanStore } from '@/stores/mrVersionPlan'
import { buildTosTypeRows, getMainTosType } from '@/lib/tosTypeRules'
import { selectActiveTosMrTasks } from '@/lib/tosMrLevel1Sync'
import { selectTosMrVersionCandidatesFromTasks } from '@/lib/mrVersionPlanRules'
import { withoutPmsHydrationWrites } from '@/lib/mockDatasetStorage'
import { buildMrAggregationSources } from '@/lib/mrPlanSourceAdapters'
import { filterFormalRegistryProjects } from '@/lib/projectManagementUi'
import { buildMarketRowsFromMarkets, getMarketVersions, getProjectMarketSnapshotKey } from '@/lib/marketRules'
import { comparePlanVersions } from '@/lib/planVersioning'
import { getShanghaiBusinessDate } from '@/lib/shanghaiBusinessDate'
import { projectMachineMarketMrVersions } from '@/lib/mrMachineMarketRules'
import { classifyMachineMrSource, projectMachineMrLevel1Tasks } from '@/lib/machineMrLevel1Projection'
import { applyLevel1BusinessTasks, captureLevel1BusinessTasks, getLevel1BusinessScopeKey } from '@/lib/level1SharedBusinessTasks'
import type { MrLevel1TaskLike } from '@/types/mrVersionPlan'

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
      const sourceTasksByProjectId: Record<string, readonly MrLevel1TaskLike[] | null> = {}
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
        sourceTasksByProjectId[project.id] = tasks
        // Missing/not-yet-hydrated source is not an authoritative empty collection.
        if (tasks !== null) useMrVersionPlanStore.getState().syncTosInstancesFromLevel1(project.id, selectTosMrVersionCandidatesFromTasks(tasks), getMainTosType(tosTypeRows))
      }
      const sources = buildMrAggregationSources({
        projects: filterFormalRegistryProjects(projectState.projects),
        marketConfigsByProjectId: projectState.marketConfigsByProjectId,
        tosTypeConfigsByProjectId: projectState.tosTypeConfigsByProjectId,
        marketVersionsByKey: plan.marketVersionsByKey,
        tosTypeVersionsByKey: plan.tosTypeVersionsByKey,
        publishedSnapshots: plan.publishedSnapshots,
        fallbackVersions: plan.versions,
        packageModeRows: [],
      })
      const sourceStatusByMachineId = new Map(sources.machineProjects.map(machine => [
        machine.id, classifyMachineMrSource(machine, sources.tosProjects, sourceTasksByProjectId),
      ]))
      const preserveMachineProjectIds = [...sourceStatusByMachineId]
        .filter(([, status]) => status === 'pending').map(([projectId]) => projectId)
      useMrVersionPlanStore.getState().reconcileMachinePlans({
        today: getShanghaiBusinessDate(new Date()),
        tosProjects: sources.tosProjects,
        machineProjects: sources.machineProjects,
        latestPublishedLevel1ByProjectId: sources.latestPublishedLevel1ByProjectId,
        preserveMachineProjectIds,
      })
      const mr = useMrVersionPlanStore.getState()
      for (const project of projectState.projects) {
        if (!isMachineProjectType(project.type)) continue
        const sourceStatus = sourceStatusByMachineId.get(project.id) || 'unbound'
        if (sourceStatus === 'pending') continue
        const marketRows = buildMarketRowsFromMarkets(project.markets || [], projectState.marketConfigsByProjectId[project.id])
        const projection = projectMachineMarketMrVersions({
          projectId: project.id, plansByKey: sourceStatus === 'ready' ? mr.machinePlansByKey : {},
          instancesByProjectId: mr.tosInstancesByProjectId, marketRows,
        })
        for (const market of projection.markets) {
          const tasks = projectMachineMrLevel1Tasks({
            versions: projection.versions, instancesByProjectId: mr.tosInstancesByProjectId,
            sourceTasksByProjectId, overridesByKey: mr.marketOverridesByKey,
            market, mainMarket: projection.mainMarket,
          })
          const scope = getLevel1BusinessScopeKey(project.id, 'market', market)
          const latest = getMarketVersions(plan.marketVersionsByKey, project.id, market, plan.versions)
            .filter(version => version.status === '已发布').sort((left, right) => comparePlanVersions(right, left))[0]
          const snapshotKey = latest ? getProjectMarketSnapshotKey(project.id, market, latest.id) : undefined
          const shared = captureLevel1BusinessTasks(project.type, tasks)
          const existing = usePlanStore.getState().level1BusinessTasksByScope[scope]
          const snapshot = snapshotKey ? usePlanStore.getState().publishedSnapshots[snapshotKey] : undefined
          const snapshotCurrent = !snapshot || JSON.stringify(applyLevel1BusinessTasks(project.type, snapshot, shared)) === JSON.stringify(snapshot)
          if (JSON.stringify(existing) !== JSON.stringify(shared) || !snapshotCurrent) {
            usePlanStore.getState().setLevel1BusinessTasks(scope, project.type, tasks, snapshotKey)
          }
        }
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
