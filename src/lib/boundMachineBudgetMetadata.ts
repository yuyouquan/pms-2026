import { isMachineProjectType } from '@/constants/projectTypes'
import { getProjectInfoValue, type ProjectInfoProject } from '@/lib/projectInfoValues'
import { getProjectAttribute, isFormalProject } from '@/types/projectRegistry'
import type { ProjectItem } from '@/types/app'

export const MACHINE_BUDGET_METADATA_KEYS = ['brand', 'productLine', 'marketName'] as const
export const BOUND_MACHINE_METADATA_HINT = '品牌、产品线、市场名跟随绑定正式项目，只读；缺失值请在正式项目空间补充，不影响年度预算版本创建。'

export function isBoundMachineBudget(project: ProjectItem): boolean {
  return isMachineProjectType(project.type) && getProjectAttribute(project) === 'budget' && Boolean(project.boundFormalProjectId)
}

/** Only these three source-owned fields follow binding; budget dates are always manual. */
export function withBoundMachineBudgetMetadata<T extends ProjectItem>(project: T, projects: readonly ProjectItem[]): T {
  if (!isBoundMachineBudget(project)) return project
  const source = projects.find(item => item.id === project.boundFormalProjectId && isFormalProject(item) && isMachineProjectType(item.type))
  const metadata = Object.fromEntries(MACHINE_BUDGET_METADATA_KEYS.map(key => {
    const value = source && getProjectInfoValue(source as unknown as ProjectInfoProject, key)
    return [key, typeof value === 'string' ? value : '']
  }))
  return { ...project, ...metadata, fieldValues: { ...project.fieldValues, ...metadata }, machineBudgetMetadataAuthority: 'registry-v1' }
}

/** Ignore unchanged legacy snapshots, but reject changed canonical fields and aliases that contradict the exact source. */
export function hasBoundMachineBudgetMetadataOverride(previous: ProjectItem, next: ProjectItem, projects: readonly ProjectItem[]): boolean {
  if (!isBoundMachineBudget(previous)) return false
  const effective = withBoundMachineBudgetMetadata(previous, projects)
  return MACHINE_BUDGET_METADATA_KEYS.some(key => (
    (next[key] !== previous[key] && (next[key] ?? '') !== effective[key])
    || (next.fieldValues?.[key] !== previous.fieldValues?.[key] && (next.fieldValues?.[key] ?? '') !== effective[key])
  ))
}

/** Snapshot before unlinking so basic information and resources retain the same last effective values, even if no HR view was opened. */
export function retainBoundMachineBudgetMetadata<T extends ProjectItem>(project: T, projects: readonly ProjectItem[]): T {
  return { ...withBoundMachineBudgetMetadata(project, projects), boundFormalProjectId: null }
}
