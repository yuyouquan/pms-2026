import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { initialProjects } from '@/data/projects'
import { EXTERNAL_PROJECT_POOL } from '@/data/externalProjectPool'
import {
  PROJECT_CATEGORY_MACHINE,
  PROJECT_CATEGORY_TECH,
  PROJECT_TYPE_TOS_VERSION,
  isMachineProjectType,
  resolveProjectClassification,
  type PersistedProjectTypeName,
} from '@/constants/projectTypes'
import { buildMarketRowsFromMarkets, type MarketConfigRow } from '@/lib/marketRules'
import { buildTosTypeRows, type TosTypeConfigRow } from '@/lib/tosTypeRules'
import { adaptNormalProject } from '@/lib/roadmapProjectAdapter'
import { createRoadmapAuditSnapshot, diffRoadmapProjectFields } from '@/lib/roadmapAudit'
import { buildRoadmapDisplayName } from '@/lib/roadmapValidation'
import {
  normalizeMachineFamilyName,
  resolveMachineTosUpdate,
  type MachineTosResolution,
} from '@/lib/machineTosVersions'
import { currentTosSnapshotValues, normalizeTosSnapshot } from '@/lib/enumConsumers'
import { useEnumStore } from '@/stores/enums'
import { useRoadmapStore } from '@/stores/roadmap'
import type { ProjectItem } from '@/types/app'
import type {
  RoadmapChangeAction,
  RoadmapFieldChange,
  RoadmapProjectRow,
} from '@/types/roadmap'
import { buildProjectInfoValues, mergeProjectInfoValues } from '@/lib/projectInfoValues'
import {
  TECHNICAL_TEAM_PERMISSION_MAPPING,
  TOS_TEAM_PERMISSION_MAPPING,
  hasPermission,
  usePermissionStore,
} from '@/stores/permission'
import { mergeResponsiblePersonsIntoVisibleMembers } from '@/lib/projectResponsibility'

// Default login user (mock)
export const DEFAULT_LOGIN_USER = '张三'

// Initial project-member assignment (mock seed; runtime value lives in store state below).
export const INITIAL_PROJECT_MEMBER_MAP: Record<string, string[]> = {
  '1': ['张三', '李四', '王五', '赵六', '李白', '钱九'],
  '3': ['王五', '赵六', '孙七'],
  '2': ['张三', '李四', '王五', '赵六', '孙七'],
  '6': ['赵六', '李四', '王五'],
  '4': ['孙七', '李四', '张三'],
  '5': ['周八', '王五', '李白'],
  '7': ['李白', '张三', '王五'],
  '8': ['杜甫', '李白', '张三', '李四', '王五'],
  '9': ['李四', '张三', '赵六', '孙七'],
  '10': ['孙七', '周八', '李白', '杜甫', '王五'],
  '11': ['王五', '李白', '张三', '赵六'],
  ...Object.fromEntries(initialProjects
    .filter(project => project.id.startsWith('mock-machine-'))
    .map(project => [project.id, ['张三', '李四', '李白']])),
}

export const kanbanColumns = [
  { title: '概念阶段', key: 'concept', color: '#1890ff' },
  { title: '计划阶段', key: 'planning', color: '#52c41a' },
  { title: '开发阶段', key: 'developing', color: '#faad14' },
  { title: '发布阶段', key: 'released', color: '#722ed1' },
]

type Project = ProjectItem & {
  type: PersistedProjectTypeName
  secondaryCategory?: string
  versionTypes?: string[]
  responsiblePersons?: string[]
  [key: string]: any
}
type ProjectPatch = Partial<Omit<ProjectItem, 'type' | 'secondaryCategory'>> & {
  type?: PersistedProjectTypeName
  secondaryCategory?: string
  [key: string]: any
}
type ProjectUpdate = ProjectPatch | ((project: Project) => Project)
export type ProjectListViewMode = 'list' | 'card' | 'calendar'
type PersistedProjectState = { projects: Project[]; projectListView: ProjectListViewMode }

export const PROJECT_STORE_VERSION = 8

const withEosTransitionTime = (project: Project, previous?: Project, now = new Date().toISOString()): Project => {
  if (project.status !== 'EOS') return project
  if (previous?.status === 'EOS' && project.statusChangedAt) return project
  return { ...project, statusChangedAt: project.statusChangedAt || now }
}

export function synchronizeTechnicalRoleMembers(
  existing: Record<string, string[]>,
  incoming: Record<string, string[]>,
): Record<string, string[]> {
  const next = { ...existing }
  Object.keys(TECHNICAL_TEAM_PERMISSION_MAPPING).forEach(role => {
    next[role] = [...(incoming[role] || [])]
  })
  return next
}

type TosRoleSyncFixtureState = {
  teamMembers?: string[]
  permissionMembers?: string[]
  responsiblePersons?: string[]
}

export function synchronizeTosRoleMembers(
  state: TosRoleSyncFixtureState,
  update: { source: 'team' | 'permission'; members: string[]; role: string },
): TosRoleSyncFixtureState {
  const members = Array.from(new Set(update.members.map(member => member.trim()).filter(Boolean)))
  return {
    ...state,
    teamMembers: members,
    permissionMembers: members,
    ...(update.role === '版本项目经理' ? { responsiblePersons: members } : {}),
  }
}

function applyTosRoleMembersToProject(project: Project, role: string, members: string[]): Project | null {
  const field = TOS_TEAM_PERMISSION_MAPPING[role as keyof typeof TOS_TEAM_PERMISSION_MAPPING]
  if (!field || project.type !== PROJECT_TYPE_TOS_VERSION) return null
  const normalizedMembers = Array.from(new Set(members.map(member => member.trim()).filter(Boolean)))
  const teamValues = buildProjectInfoValues(
    project as any,
    Object.values(TOS_TEAM_PERMISSION_MAPPING),
  )
  const merged = mergeProjectInfoValues(project as any, {
    ...teamValues,
    [field]: normalizedMembers,
  }) as Project
  if (role !== '版本项目经理') return merged
  return {
    ...merged,
    leader: normalizedMembers[0] || '',
    responsiblePersons: normalizedMembers,
  }
}

export interface ProjectMutationOptions {
  allowedFirstSaleTosValues?: readonly string[]
}

const PROJECT_STORAGE_KEY = 'pms-projects'

const MACHINE_TOS_VERSION_KEYS = [
  'firstSaleTosVersionId',
  'firstSaleTosVersion',
  'currentTosVersionId',
  'currentTosVersion',
  'tosVersionName',
  'tosVersion',
] as const

function migrateMachineThreePartReference(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const normalized = normalizeTosSnapshot(value)
  if (/^\d+\.\d+\.\d+$/.test(normalized)) return normalized
  if (/^\d+\.\d+$/.test(normalized)) return `${normalized}.0`
  return value
}

function migrateMachineTosHistory(project: Project): Project {
  if (!isMachineProjectType(project.type)) return project
  const migrated = { ...project }
  if (['升级', '切换', '换代'].includes(String(migrated.productType || '').trim())) {
    migrated.productType = '老品'
  }
  MACHINE_TOS_VERSION_KEYS.forEach(key => {
    if (key in migrated) migrated[key] = migrateMachineThreePartReference(migrated[key]) as string
  })
  if (project.fieldValues && typeof project.fieldValues === 'object') {
    const fieldValues = { ...project.fieldValues }
    if (['升级', '切换', '换代'].includes(String(fieldValues.productType || '').trim())) {
      fieldValues.productType = '老品'
    }
    ;(['firstSaleTosVersion', 'currentTosVersion'] as const).forEach(key => {
      if (key in fieldValues) fieldValues[key] = migrateMachineThreePartReference(fieldValues[key]) as any
    })
    migrated.fieldValues = fieldValues
  }
  return migrated
}

function migrateProjectSourceIdentity(project: Project): Project {
  const existingBid = typeof project.sourceBid === 'string' ? project.sourceBid.trim() : ''
  if (existingBid) return existingBid === project.sourceBid ? project : { ...project, sourceBid: existingBid }
  const projectName = project.name.trim()
  const matchingEntries = EXTERNAL_PROJECT_POOL.filter(entry => entry.name.trim() === projectName)
  return matchingEntries.length === 1
    ? { ...project, sourceBid: matchingEntries[0].bid }
    : project
}

const migrateProjectHistory = (project: Project): Project => (
  migrateProjectSourceIdentity(migrateMachineTosHistory(project))
)

const initialProjectState = (initialProjects as Project[]).map(migrateProjectHistory)

const initialMarketConfigsByProjectId = initialProjects.reduce((acc, project) => {
  if (isMachineProjectType(project.type) && project.markets?.length) {
    acc[project.id] = buildMarketRowsFromMarkets(project.markets).map(row => (
      project.id === '1' && row.market === 'TR' ? { ...row, isMadaControlled: '是' } : row
    ))
  }
  return acc
}, {} as Record<string, MarketConfigRow[]>)

const initialTosTypeConfigsByProjectId = initialProjects.reduce((acc, project) => {
  if (project.type === PROJECT_TYPE_TOS_VERSION) {
    const versionTypes = (project as typeof project & { versionTypes?: string[] }).versionTypes || []
    acc[project.id] = buildTosTypeRows(versionTypes, project.versionType || '')
  }
  return acc
}, {} as Record<string, TosTypeConfigRow[]>)

export interface ProjectState {
  projects: Project[]
  selectedProject: Project | null
  currentLoginUser: string
  projectSearchText2: string
  projectStatusFilter: string
  projectTypeFilter: string
  projectSecondaryCategoryFilter: string
  projectListView: 'list' | 'card' | 'calendar'
  projectCardPage: number
  basicInfoEditMode: boolean
  editingProjectFields: Record<string, any>
  selectedMarketTab: string
  marketConfigsByProjectId: Record<string, MarketConfigRow[]>
  selectedTosTypeTab: string
  tosTypeConfigsByProjectId: Record<string, TosTypeConfigRow[]>
  kanbanDimension: 'stage' | 'type' | 'status'
  todoFilter: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed'
  todoCollapsed: boolean
  projectMemberMap: Record<string, string[]>
}

export interface ProjectActions {
  setProjects: (v: Project[] | ((prev: Project[]) => Project[])) => void
  setSelectedProject: (v: Project | null) => void
  setCurrentLoginUser: (v: string) => void
  setProjectSearchText2: (v: string) => void
  setProjectStatusFilter: (v: string) => void
  setProjectTypeFilter: (v: string) => void
  setProjectSecondaryCategoryFilter: (v: string) => void
  setProjectListView: (v: 'list' | 'card' | 'calendar') => void
  setProjectCardPage: (v: number) => void
  setBasicInfoEditMode: (v: boolean) => void
  setEditingProjectFields: (v: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  setSelectedMarketTab: (v: string) => void
  setMarketConfigForProject: (projectId: string, rows: MarketConfigRow[]) => void
  setSelectedTosTypeTab: (v: string) => void
  setTosTypeConfigForProject: (projectId: string, rows: TosTypeConfigRow[]) => void
  setKanbanDimension: (v: 'stage' | 'type' | 'status') => void
  setTodoFilter: (v: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed') => void
  setTodoCollapsed: (v: boolean) => void
  setProjectMember: (projectId: string, members: string[]) => void
  addProject: (newProject: Project, actor?: string, options?: ProjectMutationOptions) => boolean
  updateProject: (projectId: string, update: ProjectUpdate, actor?: string, options?: ProjectMutationOptions) => Project | null
  deleteProject: (projectId: string, actor?: string) => boolean
  syncTechnicalTeamPermissionMembers: (projectId: string) => boolean
  syncTosTeamPermissionMembers: (projectId: string, role?: string, members?: string[]) => boolean
  syncTosTeamPermissionMembersGuarded: (projectId: string, actor: string, role: string, members: string[]) => boolean
}

function resolveAllowedFirstSaleTosValues(options?: ProjectMutationOptions): string[] {
  if (options?.allowedFirstSaleTosValues) {
    return currentTosSnapshotValues(options.allowedFirstSaleTosValues)
  }
  const enumState = useEnumStore.getState()
  if (!enumState.hasHydrated || enumState.hydrationError) return []
  return currentTosSnapshotValues(enumState.rowsByType['first-sale-tos'].map(row => row.value))
}

function normalizeProjectSourceBid(project: Project): string {
  return typeof project.sourceBid === 'string' ? project.sourceBid.trim() : ''
}

function hasDuplicateProjectSourceBid(
  projects: readonly Project[],
  project: Project,
): boolean {
  const sourceBid = normalizeProjectSourceBid(project)
  return Boolean(sourceBid && projects.some(existing => (
    existing.id !== project.id && normalizeProjectSourceBid(existing) === sourceBid
  )))
}

function resolveMachineTosValue(project: Project): string {
  const preferred = project.productType === '老品'
    ? [project.currentTosVersionId, project.currentTosVersion]
    : [project.firstSaleTosVersionId, project.firstSaleTosVersion]
  const candidate = [...preferred, project.tosVersionName, project.tosVersion]
    .find(value => typeof value === 'string' && value.trim())
  return normalizeTosSnapshot(candidate)
}

function isValidMachineProjectMutation(
  project: Project,
  options?: ProjectMutationOptions,
  previousProject?: Project,
): boolean {
  if (!adaptNormalProject(project as unknown as ProjectItem, [])) return false
  const tosValue = resolveMachineTosValue(project)
  if (!tosValue) return false
  const previousTosValue = previousProject ? resolveMachineTosValue(previousProject) : ''
  if (previousTosValue && tosValue === previousTosValue) return true
  return resolveAllowedFirstSaleTosValues(options).includes(tosValue)
}

function synchronizeMachineTosValues(
  project: Project,
  firstSaleTosVersion: string,
  currentTosVersion: string,
): Project {
  return {
    ...project,
    firstSaleTosVersionId: firstSaleTosVersion,
    firstSaleTosVersion,
    currentTosVersionId: currentTosVersion,
    currentTosVersion,
    tosVersionName: firstSaleTosVersion,
    tosVersion: currentTosVersion,
    fieldValues: {
      ...(project.fieldValues || {}),
      firstSaleTosVersion,
      currentTosVersion,
    },
  }
}

function applyMachineTosResolution(
  projects: Project[],
  resolution: Extract<MachineTosResolution<Project>, { ok: true }>,
  appendCandidate: boolean,
): Project[] {
  const updateById = new Map(resolution.updates.map(update => [update.id, update]))
  const synchronizedCandidate = synchronizeMachineTosValues(
    resolution.candidate,
    resolution.candidate.firstSaleTosVersion,
    resolution.candidate.currentTosVersion,
  )
  const nextProjects = projects.map(project => {
    if (project.id === synchronizedCandidate.id) return synchronizedCandidate
    const update = updateById.get(project.id)
    if (!update) return project
    return synchronizeMachineTosValues(
      project,
      resolveMachineTosValue({ ...project, productType: '新品' } as Project),
      update.currentTosVersion,
    )
  })
  return appendCandidate ? [...nextProjects, synchronizedCandidate] : nextProjects
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const cloneProjectSeedValue = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map(cloneProjectSeedValue) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, cloneProjectSeedValue(nested)]),
    ) as T
  }
  return value
}

const cloneProjectSeed = (project: Project): Project => cloneProjectSeedValue(project)

const isMissingSeedValue = (value: unknown) => (
  value === undefined
  || value === null
  || (typeof value === 'string' && !value.trim())
  || (Array.isArray(value) && value.length === 0)
)

const fillMissingSeedProjectFields = (persisted: Project, seed: Project): Project => {
  const next = { ...persisted }
  const supportsTechnicalFieldValues = persisted.type === PROJECT_CATEGORY_TECH
  // A missing nested snapshot is not a request to create one.  Earlier
  // migrations only hydrate the root project fields, and materialising an
  // empty `fieldValues` object here makes a second migration change state.
  const hasTechnicalFieldValues = supportsTechnicalFieldValues
    && isRecord(persisted.fieldValues)
  const fieldValues = hasTechnicalFieldValues
    ? cloneProjectSeedValue(persisted.fieldValues)
    : undefined
  Object.entries(seed).forEach(([key, value]) => {
    const rootValue = next[key]
    const nestedValue = fieldValues?.[key]
    const rootMissing = isMissingSeedValue(rootValue)
    const nestedMissing = isMissingSeedValue(nestedValue)
    if (hasTechnicalFieldValues && rootMissing && !nestedMissing) {
      next[key] = cloneProjectSeedValue(nestedValue)
    } else if (hasTechnicalFieldValues && !rootMissing && nestedMissing) {
      fieldValues![key] = cloneProjectSeedValue(rootValue)
    }
    if (isMissingSeedValue(next[key]) && (nestedMissing || !hasTechnicalFieldValues)) {
      next[key] = cloneProjectSeedValue(value)
    }
    if (hasTechnicalFieldValues && isMissingSeedValue(fieldValues![key]) && !isMissingSeedValue(next[key])) {
      fieldValues![key] = cloneProjectSeedValue(next[key])
    }
  })
  if (fieldValues) next.fieldValues = fieldValues
  return next
}

export function migrateProjectState(persistedState: unknown, version: number): PersistedProjectState {
  if (!isRecord(persistedState) || !Array.isArray(persistedState.projects)) {
    return { projects: initialProjectState.map(cloneProjectSeed), projectListView: 'list' }
  }

  const projectListView: ProjectListViewMode = persistedState.projectListView === 'card'
    || persistedState.projectListView === 'calendar'
    || persistedState.projectListView === 'list'
    ? persistedState.projectListView
    : 'list'

  const seenIds = new Set<string>()
  const projects = persistedState.projects.flatMap(value => {
    if (!isRecord(value)) return []
    const id = typeof value.id === 'string' ? value.id.trim() : ''
    const name = typeof value.name === 'string' ? value.name.trim() : ''
    const rawType = typeof value.type === 'string' ? value.type.trim() : ''
    const rawSecondaryCategory = typeof value.secondaryCategory === 'string'
      ? value.secondaryCategory.trim()
      : ''
    const classification = resolveProjectClassification(rawType, rawSecondaryCategory)
    const type = classification.projectCategory
    if (!id || !name || !type || seenIds.has(id)) return []
    seenIds.add(id)
    return [migrateProjectHistory({
      ...value,
      id,
      name,
      type,
      secondaryCategory: classification.secondaryCategory,
    } as Project)]
  })

  if (persistedState.projects.length > 0 && projects.length === 0) {
    return { projects: initialProjectState.map(cloneProjectSeed), projectListView }
  }
  const migrationNow = new Date().toISOString()
  const migratedProjects = (version < PROJECT_STORE_VERSION
    ? (() => {
        const seedById = new Map(initialProjectState.map(seed => [seed.id, seed]))
        const merged = projects.map(project => {
          const seed = seedById.get(project.id)
          return seed ? migrateProjectHistory(fillMissingSeedProjectFields(project, seed)) : project
        })
        return [
          ...merged,
          ...initialProjectState.filter(seed => !seenIds.has(seed.id)).map(cloneProjectSeed),
        ]
      })()
    : projects).map(project => withEosTransitionTime(project, undefined, migrationNow))
  return { projects: migratedProjects, projectListView }
}

export function partializeProjectState(state: ProjectState & ProjectActions): PersistedProjectState {
  return { projects: state.projects, projectListView: state.projectListView }
}

const safeProjectStorage: StateStorage = {
  getItem(name) {
    if (typeof window === 'undefined') return null
    try {
      const stored = window.localStorage.getItem(name)
      if (stored !== null) JSON.parse(stored)
      return stored
    } catch (error) {
      console.error(`Failed to read ${PROJECT_STORAGE_KEY}; using initial project state.`, error)
      return null
    }
  },
  setItem(name, value) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      console.error(`Failed to persist ${PROJECT_STORAGE_KEY}.`, error)
    }
  },
  removeItem(name) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(name)
    } catch (error) {
      console.error(`Failed to remove ${PROJECT_STORAGE_KEY}.`, error)
    }
  },
}

function recordNormalProjectAudit(
  action: RoadmapChangeAction,
  before: Project | null,
  after: Project | null,
  actor: string,
): void {
  const roadmapState = useRoadmapStore.getState()
  const beforeRow = before ? adaptNormalProject(before as unknown as ProjectItem, []) : null
  const afterRow = after ? adaptNormalProject(after as unknown as ProjectItem, []) : null

  let auditRow: RoadmapProjectRow | null = null
  if (action === 'create') auditRow = afterRow
  if (action === 'delete') auditRow = beforeRow
  if (action === 'update') {
    if (!beforeRow || !afterRow) return
    const changes = diffRoadmapProjectFields(beforeRow, afterRow, [])
    if (!changes.length) return
    roadmapState.recordNormalProjectChange({
      projectId: afterRow.id,
      projectDisplayName: buildRoadmapDisplayName(
        afterRow.projectCode,
        afterRow.androidVersion,
        afterRow.productType,
      ),
      action,
      actor,
      tosVersionName: `tOS${afterRow.firstSaleTosVersionId}`,
      changes: changes as [RoadmapFieldChange, ...RoadmapFieldChange[]],
    })
    return
  }

  if (!auditRow) return
  roadmapState.recordNormalProjectChange({
    projectId: auditRow.id,
    projectDisplayName: buildRoadmapDisplayName(
      auditRow.projectCode,
      auditRow.androidVersion,
      auditRow.productType,
    ),
    action,
    actor,
    tosVersionName: `tOS${auditRow.firstSaleTosVersionId}`,
    changes: [],
    snapshot: createRoadmapAuditSnapshot(auditRow, []),
  })
}

export const useProjectStore = create<ProjectState & ProjectActions>()(persist(
  (set, get) => ({
    projects: initialProjectState,
    selectedProject: null,
    currentLoginUser: DEFAULT_LOGIN_USER,
    projectSearchText2: '',
    projectStatusFilter: 'all',
    projectTypeFilter: PROJECT_CATEGORY_MACHINE,
    projectSecondaryCategoryFilter: 'all',
    projectListView: 'list',
    projectCardPage: 1,
    basicInfoEditMode: false,
    editingProjectFields: {},
    selectedMarketTab: 'OP',
    marketConfigsByProjectId: initialMarketConfigsByProjectId,
    selectedTosTypeTab: 'Full',
    tosTypeConfigsByProjectId: initialTosTypeConfigsByProjectId,
    kanbanDimension: 'stage',
    todoFilter: 'all',
    todoCollapsed: false,
    projectMemberMap: { ...INITIAL_PROJECT_MEMBER_MAP },

    setProjects: (v) => set(state => ({ projects: typeof v === 'function' ? v(state.projects) : v })),
    setSelectedProject: (v) => set({ selectedProject: v }),
    setCurrentLoginUser: (v) => set({ currentLoginUser: v }),
    setProjectSearchText2: (v) => set({ projectSearchText2: v }),
    setProjectStatusFilter: (v) => set({ projectStatusFilter: v }),
    setProjectTypeFilter: (v) => set({ projectTypeFilter: v }),
    setProjectSecondaryCategoryFilter: (v) => set({ projectSecondaryCategoryFilter: v }),
    setProjectListView: (v) => set({ projectListView: v }),
    setProjectCardPage: (v) => set({ projectCardPage: v }),
    setBasicInfoEditMode: (v) => set({ basicInfoEditMode: v }),
    setEditingProjectFields: (v) => set(state => ({
      editingProjectFields: typeof v === 'function' ? v(state.editingProjectFields) : v,
    })),
    setSelectedMarketTab: (v) => set({ selectedMarketTab: v }),
    setMarketConfigForProject: (projectId, rows) => set(state => ({
      marketConfigsByProjectId: { ...state.marketConfigsByProjectId, [projectId]: rows },
    })),
    setSelectedTosTypeTab: (v) => set({ selectedTosTypeTab: v }),
    setTosTypeConfigForProject: (projectId, rows) => set(state => ({
      tosTypeConfigsByProjectId: { ...state.tosTypeConfigsByProjectId, [projectId]: rows },
    })),
    setKanbanDimension: (v) => set({ kanbanDimension: v }),
    setTodoFilter: (v) => set({ todoFilter: v }),
    setTodoCollapsed: (v) => set({ todoCollapsed: v }),
    setProjectMember: (projectId, members) => set(state => ({
      projectMemberMap: { ...state.projectMemberMap, [projectId]: members },
    })),
    addProject: (newProject, actor, options) => {
      const sourceBid = normalizeProjectSourceBid(newProject)
      let projectToAdd = sourceBid && newProject.sourceBid !== sourceBid
        ? { ...newProject, sourceBid }
        : newProject
      projectToAdd = withEosTransitionTime(projectToAdd)
      if (hasDuplicateProjectSourceBid(get().projects, projectToAdd)) return false
      let machineResolution: Extract<MachineTosResolution<Project>, { ok: true }> | null = null
      if (isMachineProjectType(projectToAdd.type)) {
        const resolution = resolveMachineTosUpdate(get().projects, projectToAdd)
        if (!resolution.ok) return false
        projectToAdd = synchronizeMachineTosValues(
          resolution.candidate,
          resolution.candidate.firstSaleTosVersion,
          resolution.candidate.currentTosVersion,
        )
        if (!isValidMachineProjectMutation(projectToAdd, options)) return false
        machineResolution = resolution
      }
      if (machineResolution) {
        const resolution = machineResolution
        set(state => {
          const projects = applyMachineTosResolution(state.projects, {
            ...resolution,
            updates: resolution.updates,
          }, true)
          return {
            projects,
            selectedProject: state.selectedProject
              ? projects.find(project => project.id === state.selectedProject?.id) || state.selectedProject
              : null,
          }
        })
      } else {
        set(state => ({ projects: [...state.projects, projectToAdd] }))
      }
      if (projectToAdd.type === '技术项目' || projectToAdd.type === PROJECT_TYPE_TOS_VERSION) {
        const savedProject = get().projects.find(project => project.id === projectToAdd.id)
        if (savedProject) usePermissionStore.getState().syncProjectTeamPermissionMembers(savedProject)
      }
      recordNormalProjectAudit('create', null, projectToAdd, actor?.trim() || get().currentLoginUser.trim() || '系统')
      return true
    },
    updateProject: (projectId, update, actor, options) => {
      const existing = get().projects.find(project => project.id === projectId)
      if (!existing) return null
      const updated = typeof update === 'function'
        ? update(existing)
        : { ...existing, ...update } as Project
      const sourceBid = normalizeProjectSourceBid(updated)
      let projectToSave = sourceBid && updated.sourceBid !== sourceBid
        ? { ...updated, sourceBid }
        : updated
      projectToSave = withEosTransitionTime(projectToSave, existing)
      if (hasDuplicateProjectSourceBid(get().projects, projectToSave)) return null
      let machineResolution: Extract<MachineTosResolution<Project>, { ok: true }> | null = null
      if (isMachineProjectType(projectToSave.type)) {
        const resolution = resolveMachineTosUpdate(get().projects, projectToSave)
        if (!resolution.ok) return null
        projectToSave = synchronizeMachineTosValues(
          resolution.candidate,
          resolution.candidate.firstSaleTosVersion,
          resolution.candidate.currentTosVersion,
        )
        if (!isValidMachineProjectMutation(projectToSave, options, existing)) return null
        machineResolution = resolution
      }
      if (machineResolution) {
        const resolution = machineResolution
        set(state => {
          const projects = applyMachineTosResolution(state.projects, {
            ...resolution,
            updates: resolution.updates,
          }, false)
          return {
            projects,
            selectedProject: state.selectedProject
              ? projects.find(project => project.id === state.selectedProject?.id) || state.selectedProject
              : null,
          }
        })
      } else {
        set(state => ({
          projects: state.projects.map(project => project.id === projectId ? projectToSave : project),
          selectedProject: state.selectedProject?.id === projectId ? projectToSave : state.selectedProject,
        }))
      }
      if (projectToSave.type === '技术项目' || projectToSave.type === PROJECT_TYPE_TOS_VERSION) {
        const savedProject = get().projects.find(project => project.id === projectId)
        if (savedProject) usePermissionStore.getState().syncProjectTeamPermissionMembers(savedProject)
      }
      recordNormalProjectAudit('update', existing, projectToSave, actor?.trim() || get().currentLoginUser.trim() || '系统')
      return projectToSave
    },
    deleteProject: (projectId, actor) => {
      const currentProjects = get().projects
      const existing = currentProjects.find(project => project.id === projectId)
      if (!existing) return false
      let projects = currentProjects.filter(project => project.id !== projectId)
      let recomputedNewProject: Project | null = null
      if (isMachineProjectType(existing.type) && existing.productType === '老品') {
        const familyName = normalizeMachineFamilyName(existing.name)
        const matchingNewProjects = projects.filter(project => (
          isMachineProjectType(project.type)
          && project.productType === '新品'
          && normalizeMachineFamilyName(project.name) === familyName
        ))
        if (matchingNewProjects.length > 1) return false
        if (matchingNewProjects.length === 1) {
          const resolution = resolveMachineTosUpdate(projects, matchingNewProjects[0])
          if (!resolution.ok) return false
          recomputedNewProject = synchronizeMachineTosValues(
            resolution.candidate,
            resolution.candidate.firstSaleTosVersion,
            resolution.candidate.currentTosVersion,
          )
          projects = projects.map(project => (
            project.id === recomputedNewProject?.id ? recomputedNewProject : project
          ))
        }
      }
      set(state => ({
        projects,
        selectedProject: state.selectedProject?.id === projectId
          ? null
          : recomputedNewProject && state.selectedProject?.id === recomputedNewProject.id
            ? recomputedNewProject
            : state.selectedProject,
      }))
      recordNormalProjectAudit('delete', existing, null, actor?.trim() || get().currentLoginUser.trim() || '系统')
      return true
    },
    syncTechnicalTeamPermissionMembers: (projectId) => {
      const project = get().projects.find(item => item.id === projectId)
      if (!project || project.type !== '技术项目') return false
      usePermissionStore.getState().syncProjectTeamPermissionMembers(project)
      return true
    },
    syncTosTeamPermissionMembers: (projectId, role, members) => {
      const project = get().projects.find(item => item.id === projectId)
      if (!project || project.type !== PROJECT_TYPE_TOS_VERSION) return false
      let synchronizedProject = project
      if (role) {
        const nextProject = applyTosRoleMembersToProject(project, role, members || [])
        if (!nextProject) return false
        synchronizedProject = nextProject
        set(state => ({
          projects: state.projects.map(item => item.id === projectId ? synchronizedProject : item),
          selectedProject: state.selectedProject?.id === projectId ? synchronizedProject : state.selectedProject,
          projectMemberMap: role === '版本项目经理'
            ? {
                ...state.projectMemberMap,
                [projectId]: mergeResponsiblePersonsIntoVisibleMembers(
                  state.projectMemberMap[projectId] || [],
                  synchronizedProject.responsiblePersons || [],
                ),
              }
            : state.projectMemberMap,
        }))
      }
      usePermissionStore.getState().syncProjectTeamPermissionMembers(synchronizedProject)
      return true
    },
    syncTosTeamPermissionMembersGuarded: (projectId, actor, role, members) => {
      if (!hasPermission(actor, projectId, 'projectPermission:manageRoles')) return false
      return get().syncTosTeamPermissionMembers(projectId, role, members)
    },
  }),
  {
    name: PROJECT_STORAGE_KEY,
    version: PROJECT_STORE_VERSION,
    storage: createJSONStorage(() => safeProjectStorage),
    migrate: migrateProjectState,
    partialize: partializeProjectState,
    merge: (persistedState, currentState) => ({
      ...currentState,
      ...migrateProjectState(persistedState, PROJECT_STORE_VERSION),
    }),
    onRehydrateStorage: () => (state) => {
      if (state) usePermissionStore.getState().ensureProjectPermissions(state.projects)
    },
  },
))
