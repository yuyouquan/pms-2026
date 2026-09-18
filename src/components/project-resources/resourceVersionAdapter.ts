'use client'

import type { ResourceInlineActions } from '@/lib/resourceInlineEditing'
import { useStore, type StoreApi } from 'zustand'
import { useHrMachineStore } from '@/stores/hrMachine'
import { useHrTosStore } from '@/stores/hrTos'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import { useHrCapabilityStore } from '@/stores/hrCapability'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { HrMachineProject, HrMachineVersion } from '@/types/hrMachine'
import type { HrTosProject, HrTosVersion } from '@/types/hrTos'
import type { HrTechnicalProject, HrTechnicalVersion } from '@/types/hrTechnical'
import type { HrCapabilityProject, HrCapabilityVersion } from '@/types/hrCapability'
import type { ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'

export type ResourceVersion = HrMachineVersion | HrTosVersion | HrTechnicalVersion | HrCapabilityVersion
export type ResourceProject = HrMachineProject | HrTosProject | HrTechnicalProject | HrCapabilityProject
export interface ResourceStoreView extends ResourceInlineActions {
  projects: ResourceProject[]
  monthlyInvestments: ResourceMonthlyRow[]
  refreshFormalProjects: () => void
  copyVersion: (projectId: string, versionId: string) => void
  deleteVersion: (projectId: string, versionId: string) => void
  setVersionLocked: (projectId: string, versionId: string, locked: boolean) => void
  setVersionActive: (projectId: string, versionId: string, active: boolean) => void
  updateVersion: (projectId: string, versionId: string, updates: { batch: number | null }) => void
}

const stores = { machine: useHrMachineStore, tos: useHrTosStore, technical: useHrTechnicalStore, capability: useHrCapabilityStore }
/** All four stores implement this narrow shared read/action interface; forms retain their typed stores. */
export function resourceStore(category: HrProjectCategory): StoreApi<ResourceStoreView> {
  return stores[category] as unknown as StoreApi<ResourceStoreView>
}
export function useResourceStore(category: HrProjectCategory) {
  return useStore(resourceStore(category))
}
export const resourceProjectName = (project: ResourceProject) => 'tdtName' in project ? project.tdtName : project.name
