import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  PROJECT_CATEGORY_CAPABILITY,
  PROJECT_CATEGORY_MACHINE,
  PROJECT_CATEGORY_TOS_VERSION,
  PROJECT_CATEGORY_TECH,
  PROJECT_TEMPLATE_TYPES,
  getProjectTypeFamilyKey,
} from '@/constants/projectTypes'
import { initialProjects } from '@/data/projects'
import type { GanttScaleMode } from '@/lib/ganttScale'
import type { FollowVersionSource, MarketCurrentVersionState, MarketVersionsState } from '@/lib/marketRules'
import type {
  TosTypeCurrentVersionState,
  TosTypePlanData,
  TosTypeVersionsState,
} from '@/lib/tosTypeRules'
import type { CompareTableRow } from '@/lib/versionCompare'
import { buildLevel1TasksForProjectType } from '@/lib/level1PlanRules'
import { pickScopedPlanPersistence } from '@/lib/projectSpaceLevel1Rules'
import { cloneDefaultLevel3TemplateActivities, resolveTemplateVersionScopeForMigration } from '@/lib/level3TemplateRules'
import { getTemplateSnapshotKey } from '@/lib/projectTemplateCompatibility'
import {
  getDefaultColumnSettings,
  type SortableColumnDefinition,
  type SortableColumnSettingsValue,
} from '@/lib/columnSettings'
import {
  buildSubprojectTemplateTasks,
  buildTdtTemplateTasks,
  getTemplateConfigScopeKey,
  migrateTechnicalSubprojectSeedState,
  migrateTechnicalTemplateNumberingState,
  migrateTechnicalTemplateState,
  renumberTechnicalTasks,
  TECHNICAL_TEMPLATE_STORAGE_KEYS,
  validateTechnicalTemplateDepth,
} from '@/lib/technicalPlanRules'
import type {
  ConfigTemplateCompareScope,
  ConfigTemplateVersionScope,
  TechnicalTemplateKind,
} from '@/types/technicalPlan'
import type { Level3TemplateActivity } from '@/types/level3Template'

export { getTemplateSnapshotKey } from '@/lib/projectTemplateCompatibility'

export const PLAN_STORE_VERSION = 9
export const PLAN_STORE_STORAGE_KEY = 'pms-plan-store'

// ─── Exported constants ───────────────────────────────────────────────

/** Selectable L2 plan types (excludes the two fixed types) */
export const LEVEL2_PLAN_TYPES = ['1+N MR版本火车计划', '粉丝版本计划', '基础体验计划', 'WBS计划']

/** Fixed L2 plans that always show in the first two positions and cannot be deleted */
export const FIXED_LEVEL2_PLANS = [
  { id: 'plan0', name: '需求开发计划', type: '需求开发计划', fixed: true as const },
  { id: 'plan1', name: '在研版本火车计划', type: '在研版本火车计划', fixed: true as const },
]

export const VERSION_DATA = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
  { id: 'v3', versionNo: 'V3', status: '已发布' },
  { id: 'v4', versionNo: 'V4', status: '修订中' },
]

const createVersionScope = (): ConfigTemplateVersionScope => ({
  versions: VERSION_DATA.map(version => ({ ...version })),
  currentVersion: 'v3',
})

const createInitialConfigTemplateVersionScopes = () => {
  const scopes: Record<string, ConfigTemplateVersionScope> = {}
  PROJECT_TEMPLATE_TYPES.forEach(projectType => {
    if (projectType === PROJECT_CATEGORY_TECH) return
    scopes[getTemplateConfigScopeKey(projectType, 'level1')] = createVersionScope()
    scopes[getTemplateConfigScopeKey(projectType, 'level2')] = createVersionScope()
  })
  scopes[getTemplateConfigScopeKey(PROJECT_CATEGORY_MACHINE, 'level3')] = createVersionScope()
  scopes[getTemplateConfigScopeKey(PROJECT_CATEGORY_TOS_VERSION, 'level3')] = createVersionScope()
  scopes[getTemplateConfigScopeKey(PROJECT_CATEGORY_TECH, 'tdt')] = createVersionScope()
  scopes[getTemplateConfigScopeKey(PROJECT_CATEGORY_TECH, 'subproject')] = createVersionScope()
  return scopes
}

const createInitialConfigTemplateCompareScopes = () => Object.fromEntries(
  Object.keys(createInitialConfigTemplateVersionScopes()).map(scope => [
    scope,
    { versionA: 'v1', versionB: 'v3' },
  ]),
) as Record<string, ConfigTemplateCompareScope>

export const MACHINE_LEVEL1_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_MACHINE, true)
export const TOS_LEVEL1_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_TOS_VERSION, true)
export const CAPABILITY_LEVEL1_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_CAPABILITY, true)
export const MACHINE_LEVEL1_TEMPLATE_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_MACHINE, false)
export const TOS_LEVEL1_TEMPLATE_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_TOS_VERSION, false)
export const CAPABILITY_LEVEL1_TEMPLATE_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_CAPABILITY, false)

const cloneLevel1Tasks = (tasks: readonly any[]) => tasks.map(task => ({ ...task }))

export const getDefaultLevel1TasksForProjectType = (
  projectType: string,
  withMockDates = true,
) => {
  const family = getProjectTypeFamilyKey(projectType)
  if (family === PROJECT_CATEGORY_TOS_VERSION) {
    return cloneLevel1Tasks(withMockDates ? TOS_LEVEL1_TASKS : TOS_LEVEL1_TEMPLATE_TASKS)
  }
  if (family === PROJECT_CATEGORY_CAPABILITY) {
    return cloneLevel1Tasks(withMockDates ? CAPABILITY_LEVEL1_TASKS : CAPABILITY_LEVEL1_TEMPLATE_TASKS)
  }
  return cloneLevel1Tasks(withMockDates ? MACHINE_LEVEL1_TASKS : MACHINE_LEVEL1_TEMPLATE_TASKS)
}

// Whole-machine compatibility exports for legacy standalone surfaces.
export const LEVEL1_TASKS = MACHINE_LEVEL1_TASKS
export const LEVEL1_TEMPLATE_TASKS = MACHINE_LEVEL1_TEMPLATE_TASKS

export const TEMPLATE_PROJECT_TYPES = PROJECT_TEMPLATE_TYPES

export const createInitialTemplatePublishedSnapshots = (
  versionId = 'v3',
): Record<string, any[]> => {
  const snapshots = TEMPLATE_PROJECT_TYPES.reduce((result, projectType) => {
    if (projectType !== PROJECT_CATEGORY_TECH) {
      result[getTemplateSnapshotKey(projectType, versionId)] = getDefaultLevel1TasksForProjectType(projectType, false)
    }
    return result
  }, {} as Record<string, any[]>)
  snapshots[getTemplateSnapshotKey(PROJECT_CATEGORY_TECH, versionId)] = buildTdtTemplateTasks()
  snapshots[getTemplateSnapshotKey(PROJECT_CATEGORY_TECH, versionId, 'tdt')] = buildTdtTemplateTasks()
  snapshots[getTemplateSnapshotKey(PROJECT_CATEGORY_TECH, versionId, 'subproject')] = buildSubprojectTemplateTasks()
  snapshots[getTemplateSnapshotKey(PROJECT_CATEGORY_MACHINE, versionId, 'level3')] = cloneDefaultLevel3TemplateActivities()
  snapshots[getTemplateSnapshotKey(PROJECT_CATEGORY_TOS_VERSION, versionId, 'level3')] = cloneDefaultLevel3TemplateActivities()
  return snapshots
}

const createInitialLevel3TemplateTasks = (): Record<string, Level3TemplateActivity[]> => ({
  [PROJECT_CATEGORY_MACHINE]: cloneDefaultLevel3TemplateActivities(),
  [PROJECT_CATEGORY_TOS_VERSION]: cloneDefaultLevel3TemplateActivities(),
})

const createInitialConfigTemplateTasks = () => {
  const templates = TEMPLATE_PROJECT_TYPES.reduce((result, projectType) => {
    if (projectType !== PROJECT_CATEGORY_TECH) {
      result[projectType] = getDefaultLevel1TasksForProjectType(projectType, false)
    }
    return result
  }, {} as Record<string, any[]>)
  templates[PROJECT_CATEGORY_TECH] = buildTdtTemplateTasks()
  templates[TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt] = buildTdtTemplateTasks()
  templates[TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject] = buildSubprojectTemplateTasks()
  return templates
}

const normalizeLevel1MigrationName = (value: unknown) => String(value || '')
  .trim()
  .replace(/\s+/g, '')
  .toUpperCase()

const LEVEL1_STABLE_SEMANTICS: Record<string, string> = {
  'machine-stage-concept': 'stage-concept',
  'tos-stage-concept': 'stage-concept',
  'capability-stage-concept': 'stage-concept',
  'stage-concept': 'stage-concept',
  'machine-ms-concept-kickoff': 'ms-concept-kickoff',
  'tos-ms-concept-kickoff': 'ms-concept-kickoff',
  'capability-ms-concept-kickoff': 'ms-concept-kickoff',
  'milestone-concept-start': 'ms-concept-kickoff',
  'machine-ms-str1': 'ms-str1',
  'tos-ms-str1': 'ms-str1',
  'capability-ms-str1': 'ms-str1',
  'milestone-str1': 'ms-str1',
  'machine-stage-planning': 'stage-plan',
  'tos-stage-plan': 'stage-plan',
  'capability-stage-planning': 'stage-plan',
  'stage-plan': 'stage-plan',
  'machine-ms-str2': 'ms-str2',
  'tos-ms-str2': 'ms-str2',
  'capability-ms-str2': 'ms-str2',
  'milestone-str2': 'ms-str2',
  'machine-ms-str3': 'ms-str3',
  'tos-ms-str3': 'ms-str3',
  'capability-ms-str3': 'ms-str3',
  'milestone-str3': 'ms-str3',
  'machine-stage-development': 'stage-development',
  'tos-stage-development-validation': 'stage-development',
  'capability-stage-development': 'stage-development',
  'stage-development': 'stage-development',
  'machine-ms-str4': 'ms-str4',
  'tos-ms-str4': 'ms-str4',
  'capability-ms-str4': 'ms-str4',
  'milestone-str4': 'ms-str4',
  'machine-ms-str4a': 'ms-str4a',
  'tos-ms-str4a': 'ms-str4a',
  'capability-ms-str4a': 'ms-str4a',
  'milestone-str4a': 'ms-str4a',
  'machine-stage-validation': 'stage-validation',
  'capability-stage-validation': 'stage-validation',
  'machine-ms-str5': 'ms-str5',
  'tos-ms-str5': 'ms-str5',
  'capability-ms-str5': 'ms-str5',
  'milestone-str5': 'ms-str5',
  'machine-stage-launch': 'stage-launch',
  'tos-stage-launch-iteration': 'stage-launch',
  'capability-stage-launch': 'stage-launch',
  'stage-launch': 'stage-launch',
  'machine-stage-lifecycle': 'stage-maintenance',
  'tos-stage-maintenance': 'stage-maintenance',
  'capability-stage-lifecycle': 'stage-maintenance',
  'tos-stage-planning': 'stage-planning',
  'tos-ms-planning-ko': 'ms-planning-ko',
  'tos-ms-cdcp': 'ms-cdcp',
  'milestone-close': 'legacy-close',
}

const LEVEL1_NAME_SEMANTICS: Record<string, string> = {
  '概念': 'stage-concept',
  '概念阶段': 'stage-concept',
  '概念启动': 'ms-concept-kickoff',
  STR1: 'ms-str1',
  '计划': 'stage-plan',
  '计划阶段': 'stage-plan',
  STR2: 'ms-str2',
  STR3: 'ms-str3',
  '开发验证': 'stage-development',
  '开发验证阶段': 'stage-development',
  '开发阶段': 'stage-development',
  STR4: 'ms-str4',
  STR4A: 'ms-str4a',
  '验证阶段': 'stage-validation',
  STR5: 'ms-str5',
  '上市保障': 'stage-launch',
  '上市收编阶段': 'stage-launch',
  '上市阶段': 'stage-launch',
  '上市迭代阶段': 'stage-launch',
  '生命周期阶段': 'stage-maintenance',
  '维护阶段': 'stage-maintenance',
  '规划阶段': 'stage-planning',
  '规划KO': 'ms-planning-ko',
  CDCP: 'ms-cdcp',
  '收编完成': 'legacy-close',
}

const getStableLevel1Semantic = (task: any) => (
  LEVEL1_STABLE_SEMANTICS[String(task?.stableId || '')]
)

const getNamedLevel1Semantic = (task: any) => (
  LEVEL1_NAME_SEMANTICS[normalizeLevel1MigrationName(task?.taskName)]
)

const getLevel1Semantic = (task: any) => (
  getStableLevel1Semantic(task) || getNamedLevel1Semantic(task)
)

interface StableLevel1SeedSignatureEntry {
  index: number
  parentStableId: string | null
  taskName: string
  order: number
  source: unknown
  nodeKind: unknown
  defaultRoadmap: unknown
}

type StableLevel1SeedSignature = ReadonlyMap<string, StableLevel1SeedSignatureEntry>

const buildStableLevel1SeedSignature = (tasks: readonly any[]): StableLevel1SeedSignature => {
  const stableIdById = new Map(tasks.map(task => [task.id, task.stableId]))
  return new Map(tasks.map((task, index) => [
    task.stableId,
    {
      index,
      parentStableId: task.parentId ? stableIdById.get(task.parentId) || null : null,
      taskName: normalizeLevel1MigrationName(task.taskName),
      order: task.order,
      source: task.source,
      nodeKind: task.nodeKind,
      defaultRoadmap: task.defaultRoadmap,
    },
  ]))
}

const buildV8StableLevel1SeedSignature = (
  descriptors: readonly (readonly [string, string | null, string, number, string])[],
): StableLevel1SeedSignature => new Map(descriptors.map(([
  stableId,
  parentStableId,
  taskName,
  order,
  nodeKind,
], index) => [stableId, {
  index,
  parentStableId,
  taskName: normalizeLevel1MigrationName(taskName),
  order,
  source: 'template',
  nodeKind,
  defaultRoadmap: parentStableId !== null,
}]))

const MACHINE_V8_LEVEL1_STABLE_SIGNATURE = buildV8StableLevel1SeedSignature([
  ['machine-stage-concept', null, '概念阶段', 0, 'stage'],
  ['machine-ms-concept-kickoff', 'machine-stage-concept', '概念启动', 0, 'fixed-milestone'],
  ['machine-ms-str1', 'machine-stage-concept', 'STR1', 1, 'fixed-milestone'],
  ['machine-stage-planning', null, '计划阶段', 1, 'stage'],
  ['machine-ms-str2', 'machine-stage-planning', 'STR2', 0, 'fixed-milestone'],
  ['machine-ms-str3', 'machine-stage-planning', 'STR3', 1, 'fixed-milestone'],
  ['machine-stage-development', null, '开发阶段', 2, 'stage'],
  ['machine-ms-str4', 'machine-stage-development', 'STR4', 0, 'fixed-milestone'],
  ['machine-ms-str4a', 'machine-stage-development', 'STR4A', 1, 'fixed-milestone'],
  ['machine-stage-validation', null, '验证阶段', 3, 'stage'],
  ['machine-ms-str5', 'machine-stage-validation', 'STR5', 0, 'fixed-milestone'],
  ['machine-stage-launch', null, '上市阶段', 4, 'stage'],
  ['machine-stage-lifecycle', null, '生命周期阶段', 5, 'stage'],
])

const TOS_V8_LEVEL1_STABLE_SIGNATURE = buildV8StableLevel1SeedSignature([
  ['tos-stage-planning', null, '规划阶段', 0, 'stage'],
  ['tos-ms-planning-ko', 'tos-stage-planning', '规划KO', 0, 'fixed-milestone'],
  ['tos-ms-cdcp', 'tos-stage-planning', 'CDCP', 1, 'fixed-milestone'],
  ['tos-stage-concept', null, '概念阶段', 1, 'stage'],
  ['tos-ms-concept-kickoff', 'tos-stage-concept', '概念启动', 0, 'fixed-milestone'],
  ['tos-ms-str1', 'tos-stage-concept', 'STR1', 1, 'fixed-milestone'],
  ['tos-stage-plan', null, '计划阶段', 2, 'stage'],
  ['tos-ms-str2', 'tos-stage-plan', 'STR2', 0, 'fixed-milestone'],
  ['tos-ms-str3', 'tos-stage-plan', 'STR3', 1, 'fixed-milestone'],
  ['tos-stage-development-validation', null, '开发验证阶段', 3, 'stage'],
  ['tos-ms-str4', 'tos-stage-development-validation', 'STR4', 0, 'fixed-milestone'],
  ['tos-ms-str4a', 'tos-stage-development-validation', 'STR4A', 1, 'fixed-milestone'],
  ['tos-ms-str5', 'tos-stage-development-validation', 'STR5', 2, 'fixed-milestone'],
  ['tos-stage-launch-iteration', null, '上市迭代阶段', 4, 'stage'],
  ['tos-stage-maintenance', null, '维护阶段', 5, 'stage'],
])

const LEGACY_SHARED_LEVEL1_STABLE_SIGNATURE: StableLevel1SeedSignature = new Map([
  ['stage-concept', { index: 0, parentStableId: null, taskName: '概念阶段', order: 0, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['milestone-concept-start', { index: 1, parentStableId: 'stage-concept', taskName: '概念启动', order: 0, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['milestone-str1', { index: 2, parentStableId: 'stage-concept', taskName: 'STR1', order: 1, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['stage-plan', { index: 3, parentStableId: null, taskName: '计划阶段', order: 1, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['milestone-str2', { index: 4, parentStableId: 'stage-plan', taskName: 'STR2', order: 0, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['milestone-str3', { index: 5, parentStableId: 'stage-plan', taskName: 'STR3', order: 1, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['stage-development', { index: 6, parentStableId: null, taskName: '开发验证阶段', order: 2, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['milestone-str4', { index: 7, parentStableId: 'stage-development', taskName: 'STR4', order: 0, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['milestone-str4a', { index: 8, parentStableId: 'stage-development', taskName: 'STR4A', order: 1, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['milestone-str5', { index: 9, parentStableId: 'stage-development', taskName: 'STR5', order: 2, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['stage-launch', { index: 10, parentStableId: null, taskName: '上市收编阶段', order: 3, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
  ['milestone-close', { index: 11, parentStableId: 'stage-launch', taskName: '收编完成', order: 0, source: 'template', nodeKind: undefined, defaultRoadmap: undefined }],
])

const LEGACY_SHARED_V4_V7_LEVEL1_STABLE_SIGNATURE: StableLevel1SeedSignature = new Map(
  [...LEGACY_SHARED_LEVEL1_STABLE_SIGNATURE].map(([stableId, entry]) => [
    stableId,
    { ...entry, defaultRoadmap: entry.parentStableId !== null },
  ]),
)

const STABLE_LEVEL1_SEED_SIGNATURES: readonly StableLevel1SeedSignature[] = [
  buildStableLevel1SeedSignature(MACHINE_LEVEL1_TEMPLATE_TASKS),
  buildStableLevel1SeedSignature(TOS_LEVEL1_TEMPLATE_TASKS),
  buildStableLevel1SeedSignature(CAPABILITY_LEVEL1_TEMPLATE_TASKS),
  MACHINE_V8_LEVEL1_STABLE_SIGNATURE,
  TOS_V8_LEVEL1_STABLE_SIGNATURE,
  LEGACY_SHARED_LEVEL1_STABLE_SIGNATURE,
  LEGACY_SHARED_V4_V7_LEVEL1_STABLE_SIGNATURE,
]

const LEGACY_SIMPLE_LEVEL1_SIGNATURE = [
  { id: '1', parentId: null, order: 1, taskName: '概念' },
  { id: '1.1', parentId: '1', order: 1, taskName: '概念启动' },
  { id: '1.2', parentId: '1', order: 2, taskName: 'STR1' },
  { id: '2', parentId: null, order: 2, taskName: '计划' },
  { id: '2.1', parentId: '2', order: 1, taskName: 'STR2' },
  { id: '2.2', parentId: '2', order: 2, taskName: 'STR3' },
  { id: '3', parentId: null, order: 3, taskName: '开发验证' },
  { id: '4', parentId: null, order: 4, taskName: '上市保障' },
] as const

const matchesStableLevel1SeedSignature = (
  fixedTasks: any[],
  signature: StableLevel1SeedSignature,
) => {
  if (fixedTasks.length !== signature.size) return false
  const taskById = new Map(fixedTasks.map(task => [task.id, task]))
  const stableIds = new Set(fixedTasks.map(task => task.stableId))
  if (taskById.size !== fixedTasks.length || stableIds.size !== signature.size) return false
  return fixedTasks.every((task, index) => {
    if (!signature.has(task.stableId)) return false
    const expected = signature.get(task.stableId)!
    const parent = task.parentId ? taskById.get(task.parentId) : undefined
    if (task.parentId && !parent) return false
    const parentStableId = parent?.stableId || null
    return index === expected.index
      && parentStableId === expected.parentStableId
      && normalizeLevel1MigrationName(task.taskName) === normalizeLevel1MigrationName(expected.taskName)
      && task.order === expected.order
      && task.source === expected.source
      && task.nodeKind === expected.nodeKind
      && task.defaultRoadmap === expected.defaultRoadmap
  })
}

const matchesLegacySimpleLevel1SeedSignature = (fixedTasks: any[]) => {
  if (fixedTasks.length !== LEGACY_SIMPLE_LEVEL1_SIGNATURE.length) return false
  const taskById = new Map(fixedTasks.map(task => [task.id, task]))
  if (taskById.size !== fixedTasks.length) return false
  return LEGACY_SIMPLE_LEVEL1_SIGNATURE.every(expected => {
    const task = taskById.get(expected.id)
    return task
      && (task.parentId || null) === expected.parentId
      && task.order === expected.order
      && normalizeLevel1MigrationName(task.taskName) === normalizeLevel1MigrationName(expected.taskName)
      && task.source === undefined
      && task.nodeKind === undefined
  })
}

const isRecognizedLevel1Seed = (tasks: any[]) => {
  if (!tasks.every(task => task?.source === undefined || task?.source === 'template' || task?.source === 'custom')) {
    return false
  }
  const ids = tasks.map(task => task?.id)
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) return false
  const idSet = new Set(ids)
  if (tasks.some(task => task?.parentId && !idSet.has(task.parentId))) return false
  const fixedTasks = tasks.filter(task => task?.source !== 'custom')
  if (!fixedTasks.every(task => task.source === undefined || task.source === 'template')) return false
  const hasStableIds = fixedTasks.some(task => Boolean(task?.stableId))
  if (hasStableIds) {
    if (!fixedTasks.every(task => typeof task?.stableId === 'string' && task.stableId)) return false
    return STABLE_LEVEL1_SEED_SIGNATURES.some(signature => (
      matchesStableLevel1SeedSignature(fixedTasks, signature)
    ))
  }
  return matchesLegacySimpleLevel1SeedSignature(fixedTasks)
}

const LEVEL1_DATE_FIELDS = ['planStartDate', 'planEndDate', 'actualStartDate', 'actualEndDate'] as const

const renumberMigratedLevel1DisplayIds = (tasks: any[]) => {
  const indexed = tasks.map((task, index) => ({ task: { ...task }, index }))
  const sortSiblings = (items: typeof indexed) => [...items].sort((left, right) => (
    Number(left.task.order) - Number(right.task.order) || left.index - right.index
  ))
  const roots = sortSiblings(indexed.filter(({ task }) => !task.parentId))
  const childrenByParent = new Map<string, typeof indexed>()
  indexed.forEach(item => {
    if (!item.task.parentId) return
    childrenByParent.set(item.task.parentId, [
      ...(childrenByParent.get(item.task.parentId) || []),
      item,
    ])
  })
  const numbered: any[] = []
  const included = new Set<number>()
  roots.forEach((root, rootIndex) => {
    const rootId = String(rootIndex + 1)
    included.add(root.index)
    numbered.push({ ...root.task, id: rootId })
    sortSiblings(childrenByParent.get(root.task.id) || []).forEach((child, childIndex) => {
      included.add(child.index)
      numbered.push({ ...child.task, id: `${rootId}.${childIndex + 1}`, parentId: rootId })
    })
  })
  indexed.filter(item => !included.has(item.index)).forEach(item => {
    numbered.push({ ...item.task, id: String(numbered.filter(task => !task.parentId).length + 1), parentId: null })
  })
  return numbered
}

/** Conservatively replaces only confirmed shared/default seeds and preserves user-owned arrays. */
export const migrateLevel1TasksForProjectType = (
  tasks: unknown,
  projectType: string,
  withMockDates: boolean,
): any[] => {
  const defaults = getDefaultLevel1TasksForProjectType(projectType, withMockDates)
  if (!Array.isArray(tasks) || tasks.length === 0) return defaults
  const input = tasks.map(task => ({ ...task }))
  if (!isRecognizedLevel1Seed(input)) return input

  const fixedTasks = input.filter(task => task?.source !== 'custom')
  const usedSources = new Set<any>()
  const migratedDefaults = defaults.map(defaultTask => {
    const semantic = getStableLevel1Semantic(defaultTask)
    const sourceTask = fixedTasks.find(task => !usedSources.has(task) && task?.stableId === defaultTask.stableId)
      || fixedTasks.find(task => !usedSources.has(task) && getStableLevel1Semantic(task) === semantic)
      || fixedTasks.find(task => !usedSources.has(task) && getNamedLevel1Semantic(task) === semantic)
    if (!sourceTask) return { ...defaultTask }
    usedSources.add(sourceTask)
    const merged = {
      ...defaultTask,
      ...sourceTask,
      id: defaultTask.id,
      stableId: defaultTask.stableId,
      parentId: defaultTask.parentId,
      order: defaultTask.order,
      taskName: defaultTask.taskName,
      source: defaultTask.source,
      nodeKind: defaultTask.nodeKind,
      defaultRoadmap: defaultTask.defaultRoadmap,
    }
    LEVEL1_DATE_FIELDS.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(sourceTask, field)) merged[field] = sourceTask[field]
    })
    return merged
  })

  const targetBySemantic = new Map(migratedDefaults.map(task => [getStableLevel1Semantic(task), task]))
  const sourceById = new Map(input.map(task => [task?.id, task]))
  const getMigratedParent = (parent: any) => {
    const semantic = getLevel1Semantic(parent)
    if (projectType === PROJECT_CATEGORY_MACHINE && semantic === 'stage-validation') {
      return targetBySemantic.get('stage-development')
    }
    return targetBySemantic.get(semantic)
  }
  const compatibilityParentsById = new Map<string, any>()
  input.filter(task => task?.source === 'custom').forEach(task => {
    const parent = sourceById.get(task.parentId)
    if (!parent || getMigratedParent(parent) || compatibilityParentsById.has(parent.id)) return
    compatibilityParentsById.set(parent.id, {
      ...parent,
      id: `compat-${parent.id}`,
      source: 'custom',
      nodeKind: parent.nodeKind || 'stage',
      parentId: parent.parentId || null,
    })
  })
  const customTasks = input.filter(task => task?.source === 'custom').map(task => {
    const parent = sourceById.get(task.parentId)
    const migratedParent = parent ? getMigratedParent(parent) : undefined
    const compatibilityParent = parent ? compatibilityParentsById.get(parent.id) : undefined
    return {
      ...task,
      ...((migratedParent || compatibilityParent) ? { parentId: (migratedParent || compatibilityParent).id } : {}),
    }
  })
  return renumberMigratedLevel1DisplayIds([
    ...migratedDefaults,
    ...compatibilityParentsById.values(),
    ...customTasks,
  ])
}

const INITIAL_LEVEL1_PROJECT_TYPES_BY_ID = Object.fromEntries(initialProjects.map(project => [
  String(project.id),
  getProjectTypeFamilyKey(project.type),
])) as Record<string, string>

const INITIAL_MACHINE_MARKETS_BY_PROJECT_ID = Object.fromEntries(initialProjects
  .filter(project => getProjectTypeFamilyKey(project.type) === PROJECT_CATEGORY_MACHINE)
  .map(project => [String(project.id), new Set(Array.isArray(project.markets) ? project.markets : [])])) as Record<string, Set<string>>

const RESERVED_NON_MARKET_LEVEL1_SCOPES = new Set(['technical', 'tdt', 'subproject', 'tos-type'])

const migratePublishedLevel1Snapshot = (
  key: string,
  value: unknown,
  migrateCapability: boolean,
) => {
  if (!Array.isArray(value)) return value
  const templateMatch = /^template::([^:]+)::level1::([^:]+)$/.exec(key)
  if (templateMatch) {
    const projectType = getProjectTypeFamilyKey(templateMatch[1])
    if ([PROJECT_CATEGORY_MACHINE, PROJECT_CATEGORY_TOS_VERSION].includes(projectType as any)
      || (migrateCapability && projectType === PROJECT_CATEGORY_CAPABILITY)) {
      return migrateLevel1TasksForProjectType(value, projectType, false)
    }
    return value
  }

  const projectMatch = /^project::([^:]+)::/.exec(key)
  const knownProjectType = projectMatch ? INITIAL_LEVEL1_PROJECT_TYPES_BY_ID[projectMatch[1]] : undefined
  if (knownProjectType === PROJECT_CATEGORY_TECH) return value

  if (/^project::[^:]+::tos-type::[^:]+::level1::[^:]+::snapshot$/.test(key)) {
    if (knownProjectType && knownProjectType !== PROJECT_CATEGORY_TOS_VERSION) return value
    return migrateLevel1TasksForProjectType(value, PROJECT_CATEGORY_TOS_VERSION, true)
  }
  const marketSnapshotMatch = /^project::([^:]+)::([^:]+)::level1::([^:]+)$/.exec(key)
  if (marketSnapshotMatch) {
    const [, projectId, market] = marketSnapshotMatch
    if (RESERVED_NON_MARKET_LEVEL1_SCOPES.has(market)) return value
    if (knownProjectType !== PROJECT_CATEGORY_MACHINE) return value
    if (!INITIAL_MACHINE_MARKETS_BY_PROJECT_ID[projectId]?.has(market)) return value
    return migrateLevel1TasksForProjectType(value, PROJECT_CATEGORY_MACHINE, true)
  }
  const ordinaryProjectMatch = /^project::([^:]+)::level1::[^:]+$/.exec(key)
  if (ordinaryProjectMatch) {
    const projectType = INITIAL_LEVEL1_PROJECT_TYPES_BY_ID[ordinaryProjectMatch[1]]
    if ([PROJECT_CATEGORY_MACHINE, PROJECT_CATEGORY_TOS_VERSION].includes(projectType as any)
      || (migrateCapability && projectType === PROJECT_CATEGORY_CAPABILITY)) {
      return migrateLevel1TasksForProjectType(value, projectType, true)
    }
  }
  return value
}

export const migratePlanStoreState = (persistedState: unknown, persistedVersion = 0) => {
  if (!persistedState || typeof persistedState !== 'object') return persistedState as PlanState
  const legacyMigrated = persistedVersion < 1
    ? migrateTechnicalTemplateState(persistedState as Record<string, any>)
    : persistedState as Record<string, any>
  const numberedMigrated = persistedVersion < 3
    ? migrateTechnicalTemplateNumberingState(legacyMigrated)
    : legacyMigrated
  const migrated = persistedVersion < 6
    ? migrateTechnicalSubprojectSeedState(numberedMigrated)
    : numberedMigrated
  const shouldMigrateFiveStageLevel1 = persistedVersion < 9
  const shouldMigrateCapabilityLevel1 = persistedVersion < 8
  const shouldBackfillDemoMarkets = persistedVersion < 7
  const standardTemplateTypes = PROJECT_TEMPLATE_TYPES.filter(projectType => projectType !== PROJECT_CATEGORY_TECH)
  const migratedConfigTemplates = { ...(migrated.configTemplateTasksByType || {}) }
  standardTemplateTypes.forEach(projectType => {
    const shouldMigrateProjectType = projectType === PROJECT_CATEGORY_CAPABILITY
      ? shouldMigrateCapabilityLevel1
      : shouldMigrateFiveStageLevel1
    if (shouldMigrateProjectType) {
      migratedConfigTemplates[projectType] = migrateLevel1TasksForProjectType(
        migratedConfigTemplates[projectType],
        projectType,
        false,
      )
    } else if (!Array.isArray(migratedConfigTemplates[projectType])) {
      migratedConfigTemplates[projectType] = getDefaultLevel1TasksForProjectType(projectType, false)
    }
  })
  const migratedSnapshots = Object.fromEntries(Object.entries(migrated.publishedSnapshots || {}).map(([key, value]) => [
    key,
    shouldMigrateFiveStageLevel1
      ? migratePublishedLevel1Snapshot(key, value, shouldMigrateCapabilityLevel1)
      : value,
  ])) as Record<string, any[]>
  const initialPublishedSnapshots = createInitialTemplatePublishedSnapshots()
  Object.entries(initialPublishedSnapshots).forEach(([key, value]) => {
    if (migratedSnapshots[key] === undefined) migratedSnapshots[key] = value.map(item => ({ ...item }))
  })
  const initialLevel3Templates = createInitialLevel3TemplateTasks()
  const level3TemplateTasksByType = Object.fromEntries(Object.entries(migrated.level3TemplateTasksByType || {})
    .filter((entry): entry is [string, Level3TemplateActivity[]] => Array.isArray(entry[1]))
    .map(([key, items]) => [key, items.map(item => ({ ...item }))])) as Record<string, Level3TemplateActivity[]>
  Object.entries(initialLevel3Templates).forEach(([projectType, defaults]) => {
    if (!Array.isArray(level3TemplateTasksByType[projectType])) {
      level3TemplateTasksByType[projectType] = defaults.map(item => ({ ...item }))
    }
  })
  const fallbackMarketPlanData = Object.fromEntries(['OP', 'TR', 'RU'].map(market => [market, {
    tasks: getDefaultLevel1TasksForProjectType(PROJECT_CATEGORY_MACHINE, true),
    level2Tasks: [],
    createdLevel2Plans: [...FIXED_LEVEL2_PLANS],
  }]))
  const marketPlanSource = shouldBackfillDemoMarkets
    ? { ...fallbackMarketPlanData, ...(migrated.marketPlanData || {}) }
    : (migrated.marketPlanData || {})
  const migratedMarketPlanData = Object.fromEntries(Object.entries(marketPlanSource).map(([market, value]) => {
    const planData = value as Record<string, any>
    return [market, {
      ...planData,
      tasks: shouldMigrateFiveStageLevel1
        ? migrateLevel1TasksForProjectType(planData.tasks, PROJECT_CATEGORY_MACHINE, true)
        : planData.tasks,
    }]
  }))
  const migratedTosTypePlanDataByProjectId = Object.fromEntries(
    Object.entries(migrated.tosTypePlanDataByProjectId || {}).map(([projectId, projectData]) => [
      projectId,
      Object.fromEntries(Object.entries(projectData as Record<string, any>).map(([type, planData]) => [
        type,
        planData && typeof planData === 'object'
          ? {
              ...planData,
              level1Tasks: shouldMigrateFiveStageLevel1
                ? migrateLevel1TasksForProjectType(planData.level1Tasks, PROJECT_CATEGORY_TOS_VERSION, true)
                : planData.level1Tasks,
            }
          : planData,
      ])),
    ]),
  )
  const initialScopes = createInitialConfigTemplateVersionScopes()
  const legacyVersions = Array.isArray(migrated.versions)
    ? migrated.versions.map((version: any) => ({ ...version }))
    : VERSION_DATA.map(version => ({ ...version }))
  const legacyCurrentVersion = legacyVersions.some((version: any) => version.id === migrated.currentVersion)
    ? migrated.currentVersion
    : 'v3'
  const storedScopes = migrated.configTemplateVersionScopes && typeof migrated.configTemplateVersionScopes === 'object'
    ? migrated.configTemplateVersionScopes as Record<string, ConfigTemplateVersionScope>
    : {}
  const configTemplateVersionScopes = Object.fromEntries(Object.keys(initialScopes).map(scope => {
    const stored = storedScopes[scope]
    return [scope, resolveTemplateVersionScopeForMigration(
      scope,
      stored && Array.isArray(stored.versions) ? stored : undefined,
      initialScopes[scope],
      { versions: legacyVersions, currentVersion: legacyCurrentVersion },
    )]
  }))
  return {
    ...migrated,
    tasks: shouldMigrateFiveStageLevel1
      ? migrateLevel1TasksForProjectType(migrated.tasks, PROJECT_CATEGORY_MACHINE, true)
      : migrated.tasks,
    marketPlanData: migratedMarketPlanData,
    tosTypePlanDataByProjectId: migratedTosTypePlanDataByProjectId,
    publishedSnapshots: migratedSnapshots,
    configTemplateTasksByType: migratedConfigTemplates,
    level3TemplateTasksByType,
    columnSettingsByView: {
      ...(migrated.columnSettingsByView || {}),
      'project-level1-table': getDefaultColumnSettings(TABLE_COLUMNS),
      'config-level1-table': getDefaultColumnSettings(CONFIG_TABLE_COLUMNS),
      'config-level2-table': getDefaultColumnSettings(CONFIG_TABLE_COLUMNS),
    },
    configTemplateVersionScopes,
    configTemplateCompareScopes: {
      ...createInitialConfigTemplateCompareScopes(),
      ...(migrated.configTemplateCompareScopes || {}),
    },
  } as PlanState
}

type PlanColumnDefinition = Omit<SortableColumnDefinition<string>, 'title'> & {
  title: string
  default: boolean
}

export const ALL_COLUMNS: PlanColumnDefinition[] = [
  { key: 'id', title: '序号', default: true, defaultVisible: true, hideable: false, fixed: 'left' },
  { key: 'taskName', title: '阶段/里程碑节点', default: true, defaultVisible: true, hideable: false },
  { key: 'planStartDate', title: '计划开始时间', default: true, defaultVisible: true },
  { key: 'planEndDate', title: '计划完成时间', default: true, defaultVisible: true },
  { key: 'estimatedDays', title: '预估工期', default: true, defaultVisible: true },
  { key: 'actualStartDate', title: '实际开始时间', default: true, defaultVisible: true },
  { key: 'actualEndDate', title: '实际结束时间', default: true, defaultVisible: true },
  { key: 'actualDays', title: '实际工期', default: true, defaultVisible: true },
  { key: 'delayStatus', title: '是否延期', default: true, defaultVisible: true },
]

export const TABLE_COLUMNS = ALL_COLUMNS
export const CONFIG_TABLE_COLUMNS: PlanColumnDefinition[] = [
  { key: 'id', title: '序号', default: true, defaultVisible: true, hideable: false, fixed: 'left' },
  { key: 'taskName', title: '任务名称', default: true, defaultVisible: true, hideable: false },
  { key: 'responsible', title: '角色', default: true, defaultVisible: true },
]

export const GANTT_COLUMNS: PlanColumnDefinition[] = [
  { key: 'taskName', title: '任务名称', default: true, defaultVisible: true, hideable: false },
  { key: 'predecessor', title: '前置任务', default: true, defaultVisible: true },
  { key: 'planStartDate', title: '计划开始', default: true, defaultVisible: true },
  { key: 'planEndDate', title: '计划完成', default: true, defaultVisible: true },
  { key: 'estimatedDays', title: '计划周期', default: true, defaultVisible: true },
  { key: 'progress', title: '进度', default: true, defaultVisible: true },
]

export const getColumnsForView = (viewMode: string) => {
  if (viewMode === 'gantt') return GANTT_COLUMNS
  if (viewMode === 'horizontal') return [] // 横版无自定义列
  return TABLE_COLUMNS
}

export const getConfigColumnsForView = (viewMode: string) => {
  if (viewMode === 'gantt') return GANTT_COLUMNS
  return CONFIG_TABLE_COLUMNS
}

/** Initial L2 plan tasks (in-line data from page.tsx) */
export const INITIAL_LEVEL2_PLAN_TASKS: any[] = [
  // 在研版本火车计划 - 三层结构 (plan1)
  { id: '1', order: 1, taskName: '16.3.030', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-02-01', planId: 'plan1' },
  { id: '1.1', parentId: '1', order: 1, taskName: '需求分析', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-15', planId: 'plan1' },
  { id: '1.1.1', parentId: '1.1', order: 1, taskName: 'IR需求梳理', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-07', planId: 'plan1' },
  { id: '1.1.2', parentId: '1.1', order: 2, taskName: 'SR需求拆分', status: '已完成', progress: 100, responsible: '李四', predecessor: '1.1.1', planStartDate: '2026-01-08', planEndDate: '2026-01-15', planId: 'plan1' },
  { id: '1.2', parentId: '1', order: 2, taskName: '开发集成', status: '已完成', progress: 100, responsible: '王五', predecessor: '1.1', planStartDate: '2026-01-16', planEndDate: '2026-02-01', planId: 'plan1' },
  { id: '2', order: 2, taskName: '16.3.031', status: '进行中', progress: 60, responsible: '李四', predecessor: '1', planStartDate: '2026-02-02', planEndDate: '2026-03-15', planId: 'plan1' },
  { id: '2.1', parentId: '2', order: 1, taskName: '功能开发', status: '进行中', progress: 70, responsible: '李四', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-28', planId: 'plan1' },
  { id: '2.1.1', parentId: '2.1', order: 1, taskName: 'Camera模块', status: '已完成', progress: 100, responsible: '李四', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-15', planId: 'plan1' },
  { id: '2.1.2', parentId: '2.1', order: 2, taskName: 'Display模块', status: '进行中', progress: 40, responsible: '赵六', predecessor: '2.1.1', planStartDate: '2026-02-16', planEndDate: '2026-02-28', planId: 'plan1' },
  { id: '2.2', parentId: '2', order: 2, taskName: '集成测试', status: '未开始', progress: 0, responsible: '王五', predecessor: '2.1', planStartDate: '2026-03-01', planEndDate: '2026-03-15', planId: 'plan1' },
  { id: '3', order: 3, taskName: '16.3.032', status: '未开始', progress: 0, responsible: '王五', predecessor: '2', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan1' },
  // FR版本火车计划 - 三层结构 (plan2)
  { id: '1', order: 1, taskName: '版本规划', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-02-02', planId: 'plan2' },
  { id: '1.1', parentId: '1', order: 1, taskName: '修改点收集', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-01-20', planId: 'plan2' },
  { id: '1.1.1', parentId: '1.1', order: 1, taskName: '需求变更评审', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-01-10', planId: 'plan2' },
  { id: '1.1.2', parentId: '1.1', order: 2, taskName: '修改点确认', status: '已完成', progress: 100, responsible: '孙七', predecessor: '1.1.1', planStartDate: '2026-01-11', planEndDate: '2026-01-20', planId: 'plan2' },
  { id: '1.2', parentId: '1', order: 2, taskName: '版本计划制定', status: '已完成', progress: 100, responsible: '孙七', predecessor: '1.1', planStartDate: '2026-01-21', planEndDate: '2026-02-02', planId: 'plan2' },
  { id: '2', order: 2, taskName: '版本开发', status: '进行中', progress: 50, responsible: '孙七', predecessor: '1', planStartDate: '2026-02-02', planEndDate: '2026-03-15', planId: 'plan2' },
  { id: '2.1', parentId: '2', order: 1, taskName: 'MP分支入库', status: '进行中', progress: 60, responsible: '孙七', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-03-01', planId: 'plan2' },
  { id: '2.1.1', parentId: '2.1', order: 1, taskName: '代码合入', status: '已完成', progress: 100, responsible: '孙七', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-15', planId: 'plan2' },
  { id: '2.1.2', parentId: '2.1', order: 2, taskName: '编译验证', status: '进行中', progress: 30, responsible: '周八', predecessor: '2.1.1', planStartDate: '2026-02-16', planEndDate: '2026-03-01', planId: 'plan2' },
  { id: '2.2', parentId: '2', order: 2, taskName: 'MR版本转测', status: '未开始', progress: 0, responsible: '周八', predecessor: '2.1', planStartDate: '2026-03-02', planEndDate: '2026-03-15', planId: 'plan2' },
  { id: '3', order: 3, taskName: '版本测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '2', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan2' },
  { id: '3.1', parentId: '3', order: 1, taskName: 'MR版本测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan2' },
  { id: '3.1.1', parentId: '3.1', order: 1, taskName: '冒烟测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-03-25', planId: 'plan2' },
  { id: '3.1.2', parentId: '3.1', order: 2, taskName: '回归测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '3.1.1', planStartDate: '2026-03-26', planEndDate: '2026-05-01', planId: 'plan2' },
  // MR版本火车计划 (plan3)
  { id: '1', order: 1, taskName: 'MR版本规划', status: '未开始', progress: 0, responsible: '周八', predecessor: '', planStartDate: '2026-03-01', planEndDate: '2026-03-15', planId: 'plan3' },
  { id: '1.1', parentId: '1', order: 1, taskName: '版本需求整理', status: '未开始', progress: 0, responsible: '周八', predecessor: '', planStartDate: '2026-03-01', planEndDate: '2026-03-10', planId: 'plan3' },
  { id: '1.2', parentId: '1', order: 2, taskName: '版本计划评审', status: '未开始', progress: 0, responsible: '周八', predecessor: '1.1', planStartDate: '2026-03-11', planEndDate: '2026-03-15', planId: 'plan3' },
  { id: '2', order: 2, taskName: 'MR版本开发', status: '未开始', progress: 0, responsible: '吴九', predecessor: '1', planStartDate: '2026-03-16', planEndDate: '2026-04-15', planId: 'plan3' },
  { id: '2.1', parentId: '2', order: 1, taskName: '功能修复', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-04-01', planId: 'plan3' },
  { id: '2.2', parentId: '2', order: 2, taskName: '版本集成', status: '未开始', progress: 0, responsible: '吴九', predecessor: '2.1', planStartDate: '2026-04-02', planEndDate: '2026-04-15', planId: 'plan3' },
]

/** Initial L2 plan metadata (form info saved at creation time) */
export const INITIAL_LEVEL2_PLAN_META: Record<string, any> = {
  plan2: {
    planType: '1+N MR版本火车计划', planName: 'FR版本火车计划', mrVersion: 'FR',
    productLine: 'NOTE', marketName: 'OP', projectName: 'X6877-D8400_H991',
    chipVendor: 'MTK', tosVersion: '16.3.050', branch: '16.3.050_main',
    isMada: '否', madaMarket: '', spm: '李白', tpm: '王五', contact: '孙七',
    projectVersion: 'V1.0.0', transferType: '1',
  },
  plan3: {
    planType: '1+N MR版本火车计划', planName: 'MR1版本火车计划', mrVersion: 'MR1',
    productLine: 'NOTE', marketName: 'OP', projectName: 'X6877-D8400_H991',
    chipVendor: 'MTK', tosVersion: '16.3.051', branch: '16.3.050_MR1',
    isMada: '是', madaMarket: 'EU', spm: '张三', tpm: '赵六', contact: '周八',
    projectVersion: 'V1.1.0', transferType: '2',
  },
}

// ─── Helper to compute default columns ──────────────────────────────
const defaultTableColumnSettings = getDefaultColumnSettings(TABLE_COLUMNS)
const defaultConfigTableColumnSettings = getDefaultColumnSettings(CONFIG_TABLE_COLUMNS)
const defaultGanttColumnSettings = getDefaultColumnSettings(GANTT_COLUMNS)
const initialColumnSettingsByView = [
  'project-level1-table',
  'project-level2-table',
].reduce<Record<string, SortableColumnSettingsValue<string>>>((settings, key) => {
  settings[key] = { order: [...defaultTableColumnSettings.order], visible: [...defaultTableColumnSettings.visible] }
  return settings
}, [
  'config-level1-table',
  'config-level2-table',
].reduce<Record<string, SortableColumnSettingsValue<string>>>((settings, key) => {
  settings[key] = { order: [...defaultConfigTableColumnSettings.order], visible: [...defaultConfigTableColumnSettings.visible] }
  return settings
}, [
  'project-level1-gantt',
  'project-level2-gantt',
  'config-level1-gantt',
  'config-level2-gantt',
].reduce<Record<string, SortableColumnSettingsValue<string>>>((settings, key) => {
  settings[key] = { order: [...defaultGanttColumnSettings.order], visible: [...defaultGanttColumnSettings.visible] }
  return settings
}, {})))

// ─── Store types ────────────────────────────────────────────────────

type Level2Plan = { id: string; name: string; type: string; fixed?: boolean }

export interface PlanState {
  // Config-center plan
  planLevel: string
  selectedPlanType: string
  customTypes: string[]
  viewMode: 'table' | 'gantt'

  // Project-space plan
  projectPlanLevel: string
  projectPlanViewMode: 'table' | 'horizontal' | 'gantt'
  projectPlanGanttScaleMode: GanttScaleMode
  projectPlanOverviewTab: string
  planMetaCollapsed: boolean

  // Versions
  versions: typeof VERSION_DATA
  currentVersion: string

  // Tasks
  tasks: any[]
  searchText: string

  // Level 2
  level2PlanTasks: any[]
  level2PlanMilestones: string[]
  createdLevel2Plans: Level2Plan[]
  activeLevel2Plan: string
  level2PlanMeta: Record<string, any>
  createFormValues: Record<string, string>
  selectedLevel2PlanType: string
  selectedMilestones: string[]
  selectedMRVersion: string

  // Columns per view
  columnSettingsByView: Record<string, SortableColumnSettingsValue<string>>

  // Collapsed tree nodes per scope
  collapsedNodes: Record<string, Set<string>>

  // Published snapshots
  publishedSnapshots: Record<string, any[]>
  configTemplateTasksByType: Record<string, any[]>
  level3TemplateTasksByType: Record<string, Level3TemplateActivity[]>
  configTemplateVersionScopes: Record<string, ConfigTemplateVersionScope>
  configTemplateCompareScopes: Record<string, ConfigTemplateCompareScope>

  // Version compare
  compareVersionA: string
  compareVersionB: string
  compareResult: CompareTableRow[]
  compareShowUnchanged: boolean
  compareFilterType: string

  // Market plan data (whole-machine projects)
  marketPlanData: Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }>
  marketFollowVersionMeta: Record<string, FollowVersionSource>
  marketVersionsByKey: MarketVersionsState
  marketCurrentVersionByKey: MarketCurrentVersionState

  // tOS version projects: all plan data is isolated by project and type
  tosTypePlanDataByProjectId: TosTypePlanData
  tosTypeVersionsByKey: TosTypeVersionsState
  tosTypeCurrentVersionByKey: TosTypeCurrentVersionState

  // Editing helpers
  ganttEditingTask: any
  progressEditingTask: any

  // Time-constraint warnings
  parentTimeWarning: { visible: boolean; tasks: any[]; message: string }
  milestoneTimeWarning: { visible: boolean; violations: any[]; message: string }
  predecessorWarning: { visible: boolean; task: any; message: string }
}

export interface PlanActions {
  setPlanLevel: (v: string) => void
  setSelectedPlanType: (v: string) => void
  setCustomTypes: (v: string[] | ((prev: string[]) => string[])) => void
  setViewMode: (v: 'table' | 'gantt') => void

  setProjectPlanLevel: (v: string) => void
  setProjectPlanViewMode: (v: 'table' | 'horizontal' | 'gantt') => void
  setProjectPlanGanttScaleMode: (v: GanttScaleMode) => void
  setProjectPlanOverviewTab: (v: string) => void
  setPlanMetaCollapsed: (v: boolean) => void

  setVersions: (v: typeof VERSION_DATA | ((prev: typeof VERSION_DATA) => typeof VERSION_DATA)) => void
  setCurrentVersion: (v: string) => void

  setTasks: (v: any[] | ((prev: any[]) => any[])) => void
  setSearchText: (v: string) => void

  setLevel2PlanTasks: (v: any[] | ((prev: any[]) => any[])) => void
  setLevel2PlanMilestones: (v: string[] | ((prev: string[]) => string[])) => void
  setCreatedLevel2Plans: (v: Level2Plan[] | ((prev: Level2Plan[]) => Level2Plan[])) => void
  setActiveLevel2Plan: (v: string) => void
  setLevel2PlanMeta: (v: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  setCreateFormValues: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
  setSelectedLevel2PlanType: (v: string) => void
  setSelectedMilestones: (v: string[] | ((prev: string[]) => string[])) => void
  setSelectedMRVersion: (v: string) => void

  setColumnSettingsByView: (
    v: Record<string, SortableColumnSettingsValue<string>>
      | ((prev: Record<string, SortableColumnSettingsValue<string>>) => Record<string, SortableColumnSettingsValue<string>>)
  ) => void
  setCollapsedNodes: (v: Record<string, Set<string>> | ((prev: Record<string, Set<string>>) => Record<string, Set<string>>)) => void

  setPublishedSnapshots: (v: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>)) => void
  setConfigTemplateTasksByType: (v: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>)) => void
  setLevel3TemplateTasks: (
    projectType: string,
    v: Level3TemplateActivity[] | ((prev: Level3TemplateActivity[]) => Level3TemplateActivity[]),
  ) => void
  setTechnicalTemplateTasks: (kind: TechnicalTemplateKind, v: any[] | ((prev: any[]) => any[])) => void
  setConfigTemplateVersions: (scope: string, v: ConfigTemplateVersionScope['versions'] | ((prev: ConfigTemplateVersionScope['versions']) => ConfigTemplateVersionScope['versions'])) => void
  setConfigTemplateCurrentVersion: (scope: string, versionId: string) => boolean
  setConfigTemplateCompareVersions: (scope: string, versionA: string, versionB: string) => boolean

  setCompareVersionA: (v: string) => void
  setCompareVersionB: (v: string) => void
  setCompareResult: (v: CompareTableRow[]) => void
  setCompareShowUnchanged: (v: boolean) => void
  setCompareFilterType: (v: string) => void

  setMarketPlanData: (v: Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }> | ((prev: Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }>) => Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }>)) => void
  setMarketFollowVersionMeta: (v: Record<string, FollowVersionSource> | ((prev: Record<string, FollowVersionSource>) => Record<string, FollowVersionSource>)) => void
  setMarketVersionsByKey: (v: MarketVersionsState | ((prev: MarketVersionsState) => MarketVersionsState)) => void
  setMarketCurrentVersionByKey: (v: MarketCurrentVersionState | ((prev: MarketCurrentVersionState) => MarketCurrentVersionState)) => void
  setTosTypePlanDataByProjectId: (v: TosTypePlanData | ((prev: TosTypePlanData) => TosTypePlanData)) => void
  setTosTypeVersionsByKey: (v: TosTypeVersionsState | ((prev: TosTypeVersionsState) => TosTypeVersionsState)) => void
  setTosTypeCurrentVersionByKey: (v: TosTypeCurrentVersionState | ((prev: TosTypeCurrentVersionState) => TosTypeCurrentVersionState)) => void

  setGanttEditingTask: (v: any) => void
  setProgressEditingTask: (v: any) => void

  setParentTimeWarning: (v: { visible: boolean; tasks: any[]; message: string }) => void
  setMilestoneTimeWarning: (v: { visible: boolean; violations: any[]; message: string }) => void
  setPredecessorWarning: (v: { visible: boolean; task: any; message: string }) => void
}

export const usePlanStore = create<PlanState & PlanActions>()(persist((set, get) => ({
  // Config-center plan
  planLevel: 'level1',
  selectedPlanType: LEVEL2_PLAN_TYPES[0],
  customTypes: [],
  viewMode: 'table',

  // Project-space plan
  projectPlanLevel: 'level1',
  projectPlanViewMode: 'horizontal',
  projectPlanGanttScaleMode: 'month',
  projectPlanOverviewTab: 'overview',
  planMetaCollapsed: false,

  // Versions
  versions: [...VERSION_DATA],
  currentVersion: 'v3',

  // Tasks
  tasks: [...LEVEL1_TASKS],
  searchText: '',

  // Level 2
  level2PlanTasks: [...INITIAL_LEVEL2_PLAN_TASKS],
  level2PlanMilestones: [],
  createdLevel2Plans: [
    ...FIXED_LEVEL2_PLANS,
    { id: 'plan2', name: 'FR版本火车计划', type: 'FR版本火车计划' },
    { id: 'plan3', name: 'MR1版本火车计划', type: 'MR版本火车计划' },
  ],
  activeLevel2Plan: 'plan0',
  level2PlanMeta: { ...INITIAL_LEVEL2_PLAN_META },
  createFormValues: {},
  selectedLevel2PlanType: '1+N MR版本火车计划',
  selectedMilestones: [],
  selectedMRVersion: 'FR',

  // Columns per view
  columnSettingsByView: initialColumnSettingsByView,

  // Collapsed tree nodes
  collapsedNodes: {},

  // Published snapshots
  publishedSnapshots: createInitialTemplatePublishedSnapshots(),
  configTemplateTasksByType: createInitialConfigTemplateTasks(),
  level3TemplateTasksByType: createInitialLevel3TemplateTasks(),
  configTemplateVersionScopes: createInitialConfigTemplateVersionScopes(),
  configTemplateCompareScopes: createInitialConfigTemplateCompareScopes(),

  // Version compare
  compareVersionA: 'v1',
  compareVersionB: 'v3',
  compareResult: [],
  compareShowUnchanged: false,
  compareFilterType: 'all',

  // Market plan data — 整机产品项目按市场维度维护独立的计划数据
  marketPlanData: Object.fromEntries(['OP', 'TR', 'RU'].map(market => [market, {
    tasks: getDefaultLevel1TasksForProjectType(PROJECT_CATEGORY_MACHINE, true),
    level2Tasks: [],
    createdLevel2Plans: [...FIXED_LEVEL2_PLANS],
  }])),
  marketFollowVersionMeta: {},
  marketVersionsByKey: {},
  marketCurrentVersionByKey: {},
  tosTypePlanDataByProjectId: {},
  tosTypeVersionsByKey: {},
  tosTypeCurrentVersionByKey: {},

  // Editing helpers
  ganttEditingTask: null,
  progressEditingTask: null,

  // Warnings
  parentTimeWarning: { visible: false, tasks: [], message: '' },
  milestoneTimeWarning: { visible: false, violations: [], message: '' },
  predecessorWarning: { visible: false, task: null, message: '' },

  // ─── Setters ─────────────────────────────────────────────────────
  setPlanLevel: (v) => set({ planLevel: v }),
  setSelectedPlanType: (v) => set({ selectedPlanType: v }),
  setCustomTypes: (v) => set((s) => ({ customTypes: typeof v === 'function' ? v(s.customTypes) : v })),
  setViewMode: (v) => set({ viewMode: v }),

  setProjectPlanLevel: (v) => set({ projectPlanLevel: v }),
  setProjectPlanViewMode: (v) => set({ projectPlanViewMode: v }),
  setProjectPlanGanttScaleMode: (v) => set({ projectPlanGanttScaleMode: v }),
  setProjectPlanOverviewTab: (v) => set({ projectPlanOverviewTab: v }),
  setPlanMetaCollapsed: (v) => set({ planMetaCollapsed: v }),

  setVersions: (v) => set((s) => ({ versions: typeof v === 'function' ? v(s.versions) : v })),
  setCurrentVersion: (v) => set({ currentVersion: v }),

  setTasks: (v) => set((s) => ({ tasks: typeof v === 'function' ? v(s.tasks) : v })),
  setSearchText: (v) => set({ searchText: v }),

  setLevel2PlanTasks: (v) => set((s) => ({ level2PlanTasks: typeof v === 'function' ? v(s.level2PlanTasks) : v })),
  setLevel2PlanMilestones: (v) => set((s) => ({ level2PlanMilestones: typeof v === 'function' ? v(s.level2PlanMilestones) : v })),
  setCreatedLevel2Plans: (v) => set((s) => ({ createdLevel2Plans: typeof v === 'function' ? v(s.createdLevel2Plans) : v })),
  setActiveLevel2Plan: (v) => set({ activeLevel2Plan: v }),
  setLevel2PlanMeta: (v) => set((s) => ({ level2PlanMeta: typeof v === 'function' ? v(s.level2PlanMeta) : v })),
  setCreateFormValues: (v) => set((s) => ({ createFormValues: typeof v === 'function' ? v(s.createFormValues) : v })),
  setSelectedLevel2PlanType: (v) => set({ selectedLevel2PlanType: v }),
  setSelectedMilestones: (v) => set((s) => ({ selectedMilestones: typeof v === 'function' ? v(s.selectedMilestones) : v })),
  setSelectedMRVersion: (v) => set({ selectedMRVersion: v }),

  setColumnSettingsByView: (v) => set((s) => ({
    columnSettingsByView: typeof v === 'function' ? v(s.columnSettingsByView) : v,
  })),
  setCollapsedNodes: (v) => set((s) => ({ collapsedNodes: typeof v === 'function' ? v(s.collapsedNodes) : v })),

  setPublishedSnapshots: (v) => set((s) => ({ publishedSnapshots: typeof v === 'function' ? v(s.publishedSnapshots) : v })),
  setConfigTemplateTasksByType: (v) => set((s) => ({ configTemplateTasksByType: typeof v === 'function' ? v(s.configTemplateTasksByType) : v })),
  setLevel3TemplateTasks: (projectType, v) => set(state => {
    const current = (state.level3TemplateTasksByType[projectType] || []).map(item => ({ ...item }))
    const next = typeof v === 'function' ? v(current) : v
    return {
      level3TemplateTasksByType: {
        ...state.level3TemplateTasksByType,
        [projectType]: next.map(item => ({ ...item })),
      },
    }
  }),
  setTechnicalTemplateTasks: (kind, v) => {
    const key = TECHNICAL_TEMPLATE_STORAGE_KEYS[kind]
    const current = get().configTemplateTasksByType[key] || []
    const input = current.map(task => ({ ...task }))
    const resolved = typeof v === 'function' ? v(input) : v
    const next = renumberTechnicalTasks(resolved)
    validateTechnicalTemplateDepth(kind, next)
    set(state => ({
      configTemplateTasksByType: {
        ...state.configTemplateTasksByType,
        [key]: next,
        ...(kind === 'tdt' ? { [PROJECT_CATEGORY_TECH]: next.map(task => ({ ...task })) } : {}),
      },
    }))
  },
  setConfigTemplateVersions: (scope, v) => set(state => {
    const current = state.configTemplateVersionScopes[scope] || createVersionScope()
    const input = current.versions.map(version => ({ ...version }))
    const versions = (typeof v === 'function' ? v(input) : v).map(version => ({ ...version }))
    const currentVersion = versions.some(version => version.id === current.currentVersion)
      ? current.currentVersion
      : versions.at(-1)?.id || ''
    return {
      configTemplateVersionScopes: {
        ...state.configTemplateVersionScopes,
        [scope]: { versions, currentVersion },
      },
    }
  }),
  setConfigTemplateCurrentVersion: (scope, versionId) => {
    const current = get().configTemplateVersionScopes[scope]
    if (!current?.versions.some(version => version.id === versionId)) return false
    set(state => ({
      configTemplateVersionScopes: {
        ...state.configTemplateVersionScopes,
        [scope]: { ...state.configTemplateVersionScopes[scope], currentVersion: versionId },
      },
    }))
    return true
  },
  setConfigTemplateCompareVersions: (scope, versionA, versionB) => {
    const versions = get().configTemplateVersionScopes[scope]?.versions || []
    if (![versionA, versionB].every(versionId => versions.some(version => version.id === versionId))) return false
    set(state => ({
      configTemplateCompareScopes: {
        ...state.configTemplateCompareScopes,
        [scope]: { versionA, versionB },
      },
    }))
    return true
  },

  setCompareVersionA: (v) => set({ compareVersionA: v }),
  setCompareVersionB: (v) => set({ compareVersionB: v }),
  setCompareResult: (v) => set({ compareResult: v }),
  setCompareShowUnchanged: (v) => set({ compareShowUnchanged: v }),
  setCompareFilterType: (v) => set({ compareFilterType: v }),

  setMarketPlanData: (v) => set((s) => ({ marketPlanData: typeof v === 'function' ? v(s.marketPlanData) : v })),
  setMarketFollowVersionMeta: (v) => set((s) => ({ marketFollowVersionMeta: typeof v === 'function' ? v(s.marketFollowVersionMeta) : v })),
  setMarketVersionsByKey: (v) => set((s) => ({ marketVersionsByKey: typeof v === 'function' ? v(s.marketVersionsByKey) : v })),
  setMarketCurrentVersionByKey: (v) => set((s) => ({ marketCurrentVersionByKey: typeof v === 'function' ? v(s.marketCurrentVersionByKey) : v })),
  setTosTypePlanDataByProjectId: (v) => set((s) => ({ tosTypePlanDataByProjectId: typeof v === 'function' ? v(s.tosTypePlanDataByProjectId) : v })),
  setTosTypeVersionsByKey: (v) => set((s) => ({ tosTypeVersionsByKey: typeof v === 'function' ? v(s.tosTypeVersionsByKey) : v })),
  setTosTypeCurrentVersionByKey: (v) => set((s) => ({ tosTypeCurrentVersionByKey: typeof v === 'function' ? v(s.tosTypeCurrentVersionByKey) : v })),

  setGanttEditingTask: (v) => set({ ganttEditingTask: v }),
  setProgressEditingTask: (v) => set({ progressEditingTask: v }),

  setParentTimeWarning: (v) => set({ parentTimeWarning: v }),
  setMilestoneTimeWarning: (v) => set({ milestoneTimeWarning: v }),
  setPredecessorWarning: (v) => set({ predecessorWarning: v }),
}), {
  name: PLAN_STORE_STORAGE_KEY,
  version: PLAN_STORE_VERSION,
  storage: createJSONStorage(() => localStorage),
  migrate: migratePlanStoreState,
  partialize: state => ({
    versions: state.versions,
    currentVersion: state.currentVersion,
    publishedSnapshots: state.publishedSnapshots,
    configTemplateTasksByType: state.configTemplateTasksByType,
    level3TemplateTasksByType: state.level3TemplateTasksByType,
    configTemplateVersionScopes: state.configTemplateVersionScopes,
    configTemplateCompareScopes: state.configTemplateCompareScopes,
    ...pickScopedPlanPersistence(state),
  }),
}))
