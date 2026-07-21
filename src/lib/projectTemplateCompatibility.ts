import {
  LEGACY_PROJECT_TYPE_MACHINE,
  getProjectTypeFamilyKey,
  isMachineProjectType,
} from '@/constants/projectTypes'

const getTemplateReadTypes = (projectType: string) => {
  const canonicalType = getProjectTypeFamilyKey(projectType)
  return isMachineProjectType(projectType)
    ? [canonicalType, LEGACY_PROJECT_TYPE_MACHINE]
    : [canonicalType]
}

export const getTemplateSnapshotKey = (
  projectType: string,
  versionId: string,
  planLevel = 'level1',
) => `template::${getProjectTypeFamilyKey(projectType)}::${planLevel}::${versionId}`

export const getTemplateSnapshotReadKeys = (
  projectType: string,
  versionId: string,
  planLevel = 'level1',
) => getTemplateReadTypes(projectType).map(type => (
  `template::${type}::${planLevel}::${versionId}`
))

export const getTemplateTasksForProjectType = <T>(
  tasksByType: Record<string, T>,
  projectType: string,
): T | undefined => {
  for (const type of getTemplateReadTypes(projectType)) {
    if (tasksByType[type] !== undefined) return tasksByType[type]
  }
  return undefined
}

export const getTemplateSnapshotForProjectType = <T>(
  snapshots: Record<string, T>,
  projectType: string,
  versionId: string,
  planLevel = 'level1',
): T | undefined => {
  for (const key of getTemplateSnapshotReadKeys(projectType, versionId, planLevel)) {
    if (snapshots[key] !== undefined) return snapshots[key]
  }
  return undefined
}
