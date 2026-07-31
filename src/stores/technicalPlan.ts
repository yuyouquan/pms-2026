import { create } from 'zustand'
import {
  calculateTechnicalProjectStage,
  comparePublishedTechnicalPlanVersions,
  type TechnicalStagePlanVersion,
  type TechnicalStageTask,
} from '@/lib/technicalProjectRules'

export type TechnicalPlanScope =
  | { kind: 'tdt'; parentProjectId: string }
  | { kind: 'subproject'; parentProjectId: string; subprojectId: string }

export const getTechnicalPlanKey = (scope: TechnicalPlanScope) => scope.kind === 'tdt'
  ? `${scope.parentProjectId}:tdt`
  : `${scope.parentProjectId}:subproject:${scope.subprojectId}`

export interface TechnicalPlanInstance {
  planKey: string
  templateKind: 'tdt' | 'subproject'
  versions: TechnicalStagePlanVersion[]
  currentVersionId: string
}

export type TechnicalPlansByKey = Record<string, TechnicalPlanInstance>

const TDT_STAGE_TASKS: TechnicalStageTask[] = [
  { id: 'tdt-planning', name: '规划阶段', parentId: null, order: 1, planStartDate: '2026-01-01', planEndDate: '2026-01-31' },
  { id: 'tdt-planning-start', name: '规划启动', parentId: 'tdt-planning', order: 1, planStartDate: '2026-01-01', planEndDate: '2026-01-10' },
  { id: 'tdt-concept', name: '概念阶段', parentId: null, order: 2, planStartDate: '2026-02-01', planEndDate: '2026-02-28' },
  { id: 'tdt-plan', name: '计划阶段', parentId: null, order: 3, planStartDate: '2026-03-01', planEndDate: '2026-03-31' },
  { id: 'tdt-development', name: '开发验证阶段', parentId: null, order: 4, planStartDate: '2026-04-01', planEndDate: '2026-06-30' },
  { id: 'tdt-transfer', name: '迁移阶段', parentId: null, order: 5, planStartDate: '2026-07-01', planEndDate: '2026-08-31' },
]

export const INITIAL_TECHNICAL_PLANS: TechnicalPlansByKey = {
  '9:tdt': {
    planKey: '9:tdt',
    templateKind: 'tdt',
    currentVersionId: 'tech-9-v2-draft',
    versions: [
      {
        id: 'tech-9-v1',
        versionNo: 'V1',
        templateType: 'tdt',
        status: '已发布',
        publishedAt: '2026-01-05T00:00:00Z',
        tasks: TDT_STAGE_TASKS.map(task => ({ ...task })),
      },
      {
        id: 'tech-9-v2-draft',
        versionNo: 'V2',
        templateType: 'tdt',
        status: '修订中',
        tasks: TDT_STAGE_TASKS.map(task => ({ ...task, name: task.parentId ? task.name : `${task.name}（修订）` })),
      },
    ],
  },
}

export const selectLatestPublishedTechnicalPlanVersion = (
  plansByKey: TechnicalPlansByKey,
  parentProjectId: string,
) => {
  const instance = plansByKey[getTechnicalPlanKey({ kind: 'tdt', parentProjectId })]
  if (!instance || instance.templateKind !== 'tdt') return undefined
  return instance.versions
    .filter(version => version.status === '已发布' && ['tdt', 'TDT项目计划'].includes(version.templateType))
    .sort(comparePublishedTechnicalPlanVersions)[0]
}

export const selectTechnicalProjectStage = (
  plansByKey: TechnicalPlansByKey,
  parentProjectId: string,
  today: string,
) => {
  const latestPublished = selectLatestPublishedTechnicalPlanVersion(plansByKey, parentProjectId)
  return latestPublished ? calculateTechnicalProjectStage(latestPublished.tasks, today) : '-'
}

interface TechnicalPlanState {
  plansByKey: TechnicalPlansByKey
}

const cloneInitialPlans = (): TechnicalPlansByKey => Object.fromEntries(
  Object.entries(INITIAL_TECHNICAL_PLANS).map(([key, plan]) => [key, {
    ...plan,
    versions: plan.versions.map(version => ({
      ...version,
      tasks: version.tasks.map(task => ({ ...task })),
    })),
  }]),
)

export const useTechnicalPlanStore = create<TechnicalPlanState>(() => ({
  plansByKey: cloneInitialPlans(),
}))
