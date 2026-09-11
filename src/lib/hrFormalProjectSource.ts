import { isFormalProject } from '@/types/projectRegistry'
import { isMachineProjectType, PROJECT_TYPE_TOS_VERSION, PROJECT_TYPE_TECH, PROJECT_TYPE_CAPABILITY } from '@/constants/projectTypes'
import { getProjectInfoValue } from '@/lib/projectInfoValues'
import { projectLevel1Plan, type Level1PlanTask } from '@/lib/level1PlanRules'
import { resolveSharedLevel1Plan } from '@/lib/sharePlan'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { selectLatestPublishedTechnicalPlanVersion, useTechnicalPlanStore } from '@/stores/technicalPlan'
import type { ProjectItem } from '@/types/app'

export type HrProjectCategory = 'machine' | 'tos' | 'technical' | 'capability'
export const matchesHrCategory = (project: ProjectItem, category: HrProjectCategory) => category === 'machine'
  ? isMachineProjectType(project.type)
  : project.type === ({ tos: PROJECT_TYPE_TOS_VERSION, technical: PROJECT_TYPE_TECH, capability: PROJECT_TYPE_CAPABILITY } as const)[category]

/** Older PMS mock records have no external code; their persisted project ID remains their stable identifier. */
export const hrFormalProjectCode = (project: ProjectItem) => project.sourceBid || project.projectCode || project.id
export function getHrFormalProjectOptions(category: HrProjectCategory, projects: readonly ProjectItem[] = useProjectStore.getState().projects) {
  return projects.filter(project => isFormalProject(project) && matchesHrCategory(project, category)).map(project => ({ id: project.id, code: hrFormalProjectCode(project), name: project.name }))
}
export function findHrFormalProject(category: HrProjectCategory, code: string | null) {
  const matches = useProjectStore.getState().projects.filter(project => isFormalProject(project) && matchesHrCategory(project, category) && hrFormalProjectCode(project) === code)
  return matches.length === 1 ? matches[0] : undefined
}

type PlanTask = Level1PlanTask
const normalizedName = (value: string) => value.toUpperCase().replace(/[\s_\-]/g, '')
function dateOf(tasks: readonly PlanTask[], names: string[], field: 'planEndDate' | 'planStartDate' = 'planEndDate'): string | null {
  const task = tasks.find(item => names.some(name => normalizedName(item.taskName || '') === normalizedName(name)))
  const date = task?.[field]
  return date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null
}

export function resolveHrFormalSource(category: HrProjectCategory, code: string | null, pmsProjectId?: string) {
  const project = pmsProjectId
    ? useProjectStore.getState().projects.find(item => item.id === pmsProjectId && isFormalProject(item) && matchesHrCategory(item, category))
    : findHrFormalProject(category, code)
  const projectState = useProjectStore.getState()
  let tasks: PlanTask[] = []
  let planVersion: string | null = null
  if (project) {
    if (category === 'technical') {
      const version = selectLatestPublishedTechnicalPlanVersion(useTechnicalPlanStore.getState().plansByKey, project.id)
      tasks = version?.tasks || []
      planVersion = version?.versionNo || null
    } else {
      const source = resolveSharedLevel1Plan(usePlanStore.getState(), {
        project, level: 'level1',
        marketRows: projectState.marketConfigsByProjectId[project.id],
        tosTypeRows: projectState.tosTypeConfigsByProjectId[project.id],
      })
      if (source.ok) { tasks = source.tasks; planVersion = source.version.versionNo }
    }
  }
  const stages = projectLevel1Plan(tasks, { mode: 'standard' }).rows
  const milestones = category === 'technical' ? {
    planningStart: dateOf(tasks, ['规划启动']), charterDCP: dateOf(tasks, ['Charter DCP', 'Charter']),
    tdr1: dateOf(tasks, ['TDR1']), pdcp: dateOf(tasks, ['PDCP']), tdcpx: dateOf(tasks, ['TDCP-X']), edcp: dateOf(tasks, ['EDCP']),
  } : category === 'tos' ? {
    planningKO: dateOf(tasks, ['规划KO']), conceptStart: dateOf(tasks, ['概念启动']),
    str1: dateOf(tasks, ['STR1']), str3: dateOf(tasks, ['STR3']), str5: dateOf(tasks, ['STR5']),
    marketIteration: dateOf(stages, ['上市迭代', '上市迭代阶段'], 'planStartDate'),
    maintenanceEnd: dateOf(tasks, ['维护结束']) || dateOf(stages, ['维护阶段']),
  } : {
    conceptStart: dateOf(tasks, ['概念启动']), str1: dateOf(tasks, ['STR1']), str3: dateOf(tasks, ['STR3']),
    str4: dateOf(tasks, ['STR4']), str5: dateOf(tasks, ['STR5']),
    productLaunch: dateOf(tasks, ['产品上市', '上市']) || dateOf(stages, ['上市阶段'], 'planStartDate'),
  }
  const level = project ? getProjectInfoValue(project, 'softwareProjectLevel') : ''
  return {
    project, planVersion, milestones,
    projectLevel: typeof level === 'string' ? level : '',
    projectStartTime: dateOf(tasks, ['概念启动']) || '',
    projectEndTime: dateOf(tasks, ['STR5']) || '',
  }
}
