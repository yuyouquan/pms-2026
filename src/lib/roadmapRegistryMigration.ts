import { useProjectStore } from '@/stores/project'
import { useRoadmapStore } from '@/stores/roadmap'
import { usePermissionStore } from '@/stores/permission'
import type { ProjectItem } from '@/types/app'
import type { PlannedRoadmapProject } from '@/types/roadmap'

export function migrateLegacyRoadmapProject(legacy: PlannedRoadmapProject): ProjectItem {
  return {
    ...legacy, legacyRoadmapSnapshot: JSON.parse(JSON.stringify(legacy)),
    id: legacy.id, name: legacy.displayName || legacy.projectCode, type: '整机产品项目',
    projectAttribute: 'roadmap', secondaryCategory: legacy.machineProjectType,
    status: '筹备中', boundFormalProjectId: null,
    responsiblePersons: legacy.createdBy ? [legacy.createdBy] : [], leader: legacy.createdBy,
    spm: legacy.createdBy, progress: 0, markets: [], chipPlatform: '', tosVersion: '',
    planStartDate: '', planEndDate: '', developCycle: 0, healthStatus: 'normal',
    fieldValues: { chipCode: legacy.chipCode, spm: legacy.createdBy ? [legacy.createdBy] : [] },
  }
}

/** IDs are persisted atomically with imported rows. Deleting a row never clears its marker. */
export function migrateLegacyRoadmapRegistry(): { importedIds: string[]; conflicts: string[] } {
  const state = useProjectStore.getState()
  const roadmap = useRoadmapStore.getState()
  const marked = new Set(state.migratedRoadmapIds)
  const existing = new Map(state.projects.map(project => [project.id, project]))
  const imported: ProjectItem[] = [], conflicts: string[] = []
  for (const legacy of roadmap.plannedProjects) {
    if (marked.has(legacy.id)) continue
    if (existing.has(legacy.id)) {
      conflicts.push(`旧路标项目 ${legacy.id} 与现有项目 ID 冲突，原数据已保留，请核对`)
      continue
    }
    if (roadmap.changeLogs.some(log => log.projectId === legacy.id && log.source === 'planned' && log.action === 'delete')) {
      marked.add(legacy.id)
      continue
    }
    imported.push(migrateLegacyRoadmapProject(legacy))
    marked.add(legacy.id)
  }
  if (imported.length || marked.size !== state.migratedRoadmapIds.length) {
    useProjectStore.setState({ projects: [...state.projects, ...imported], migratedRoadmapIds: [...marked] })
  }
  usePermissionStore.getState().ensureProjectPermissions(imported.map(project => ({ ...project })))
  return { importedIds: imported.map(project => project.id), conflicts }
}
