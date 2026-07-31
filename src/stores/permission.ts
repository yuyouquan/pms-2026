import { create } from 'zustand'
import { PROJECT_PERMISSION_ITEMS, FIXED_ROLES, getProjectPermissionKeys } from '@/constants/permissions'
import { initialProjects } from '@/data/projects'
import { getProjectResponsiblePersons } from '@/lib/projectResponsibility'
import { PROJECT_CATEGORY_TECH, PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { getProjectInfoValue } from '@/lib/projectInfoValues'

export const TECHNICAL_TEAM_PERMISSION_MAPPING = {
  '技术项目负责人': 'technicalLead',
  '技术项目经理': 'technicalProjectManager',
  '测试代表': 'testRepresentative',
  '质量代表': 'qualityRepresentative',
  '产品代表': 'productRepresentative',
  '标准化代表': 'standardizationRepresentative',
} as const

export const TOS_TEAM_PERMISSION_MAPPING = {
  '版本项目经理': 'tosVersionProjectManager',
  '规划代表': 'tosPlanningRepresentative',
  'SE': 'tosSe',
  '测试代表': 'tosTestRepresentative',
  'SQA': 'tosSqa',
  'CMO': 'tosCmo',
  'UX': 'tosUx',
  '稳定性代表': 'tosStabilityRepresentative',
  '性能代表': 'tosPerformanceRepresentative',
  '功耗代表': 'tosPowerRepresentative',
  '系统应用开发代表': 'tosSystemAppDevRepresentative',
  '底软通信开发代表': 'tosBasebandDevRepresentative',
  '集成维护开发代表': 'tosIntegrationDevRepresentative',
  '软件架设与技术规划部开发代表': 'tosArchitectureDevRepresentative',
  '创新产品开发代表': 'tosInnovationDevRepresentative',
  'TEX AI开发代表': 'tosTexAiDevRepresentative',
  '影像开发代表': 'tosImagingDevRepresentative',
  '预装管理开发代表': 'tosPreinstallRepresentative',
  '研发战略生态合作部代表': 'tosEcosystemRepresentative',
} as const

export const TECHNICAL_FIXED_ROLES = Object.keys(TECHNICAL_TEAM_PERMISSION_MAPPING)
export const TOS_FIXED_ROLES = Object.keys(TOS_TEAM_PERMISSION_MAPPING)

type RoleProject = {
  id: string
  type: string
  fieldValues?: Record<string, unknown>
  [key: string]: unknown
}

const normalizeRoleMembers = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  return Array.from(new Set(values.map(item => String(item).trim()).filter(Boolean)))
}

const getProjectTeamMembers = (project: RoleProject, field: string): string[] => {
  const members = normalizeRoleMembers(getProjectInfoValue(project as any, field))
  if (members.length || field !== 'technicalLead') return members
  return normalizeRoleMembers(project.responsiblePersons ?? project.leader)
}

export const getFixedProjectRoles = (project: RoleProject): Role[] => {
  const mapping = project.type === PROJECT_CATEGORY_TECH
    ? TECHNICAL_TEAM_PERMISSION_MAPPING
    : project.type === PROJECT_TYPE_TOS_VERSION
      ? TOS_TEAM_PERMISSION_MAPPING
      : null
  if (!mapping) return buildDefaultRoles()
  return Object.entries(mapping).map(([name, field]) => ({
    name,
    members: getProjectTeamMembers(project, field),
    isFixed: true,
  }))
}

export const resolvePermissionProjectId = (projectId: string, parentProjectId?: string): string => (
  parentProjectId?.trim() || projectId
)

// ─── Defaults shared by every project's initial role-permission slot ─

const expandProjectPermissionKeys = (keys: string[]): string[] => {
  const expanded = keys.flatMap(key => {
    const permission = PROJECT_PERMISSION_ITEMS.find(item => item.key === key)
    return permission ? getProjectPermissionKeys(permission) : [key]
  })
  return Array.from(new Set(expanded))
}

const PROJECT_PERMISSION_PRESETS: Record<string, string[]> = {
  '系统管理员': [
    'basicInfo:查看',
    'basicInfo:transferView',
    'basicInfo:planConfigView',
    'basicInfo:编辑',
    'basicInfo:applyTransfer',
    'plan:一级计划-编辑',
    'plan:一级计划-查看',
    'plan:一级计划-分享',
    'plan:导入',
    'plan:导出',
    'projectPermission:manageRoles',
  ],
  '项目经理': [
    'basicInfo:查看',
    'basicInfo:transferView',
    'basicInfo:planConfigView',
    'basicInfo:编辑',
    'basicInfo:applyTransfer',
    'plan:一级计划-编辑',
    'plan:一级计划-查看',
    'plan:一级计划-分享',
    'plan:导入',
    'plan:导出',
    'projectPermission:manageRoles',
  ],
  '产品经理': ['basicInfo:查看', 'basicInfo:transferView'],
  '软件SE': ['basicInfo:查看', 'basicInfo:transferView'],
  '开发代表': [
    'basicInfo:查看',
    'basicInfo:transferView',
    'basicInfo:planConfigView',
    'plan:一级计划-查看',
    'plan:一级计划-分享',
    'plan:导出',
  ],
  '设计师': ['basicInfo:查看', 'basicInfo:transferView'],
  '测试TPM': [
    'basicInfo:查看',
    'basicInfo:transferView',
    'basicInfo:planConfigView',
    'plan:一级计划-查看',
    'plan:一级计划-分享',
    'plan:导出',
  ],
  'SQA': [
    'basicInfo:查看',
    'basicInfo:transferView',
    'basicInfo:planConfigView',
    'plan:一级计划-查看',
    'plan:一级计划-分享',
    'plan:导出',
  ],
  '开发工程师': ['basicInfo:查看', 'basicInfo:transferView'],
  '测试工程师': ['basicInfo:查看', 'basicInfo:transferView'],
  '管理层': [
    'basicInfo:查看',
    'basicInfo:transferView',
    'basicInfo:planConfigView',
    'plan:一级计划-查看',
    'plan:一级计划-分享',
    'plan:导出',
  ],
  '其他': ['basicInfo:查看', 'basicInfo:transferView'],
}

const defaultPermsByRole: Record<string, string[]> = {
  ...Object.fromEntries(FIXED_ROLES.map(role => [role, expandProjectPermissionKeys(PROJECT_PERMISSION_PRESETS[role] || [])])),
}

// Default members per fixed role — matches the prior global `roles` initial values
// so existing 10 mock projects retain the same user-→-role mapping.
const DEFAULT_ROLE_MEMBERS: Record<string, string[]> = {
  '系统管理员': ['张三'],
  '项目经理': ['张三', '赵六'],
  '产品经理': ['李四', '王五'],
  '软件SE': ['孙七'],
  '开发代表': ['王五'],
  '设计师': ['周八'],
  '测试TPM': [],
  'SQA': [],
  '开发工程师': ['李白', '杜甫'],
  '测试工程师': ['赵六', '孙七'],
  '管理层': ['张三'],
  '其他': [],
}

export interface Role {
  name: string
  members: string[]
  isFixed: boolean
}

interface GlobalRole {
  name: string
  members: string[]
  isFixed?: boolean
}

function buildDefaultRoles(): Role[] {
  return FIXED_ROLES.map(name => ({ name, members: [...(DEFAULT_ROLE_MEMBERS[name] || [])], isFixed: true }))
}

function buildDefaultRolePermissions(): Record<string, Record<string, boolean>> {
  const init: Record<string, Record<string, boolean>> = {}
  FIXED_ROLES.forEach(r => {
    init[r] = {}
    ;(defaultPermsByRole[r] || []).forEach(p => { init[r][p] = true })
  })
  return init
}

function buildPermissionsForRoles(roles: readonly Role[]): Record<string, Record<string, boolean>> {
  return Object.fromEntries(roles.map(role => {
    const managerRole = role.name === '技术项目负责人' || role.name === '版本项目经理'
    const source = managerRole
      ? PROJECT_PERMISSION_PRESETS['项目经理']
      : PROJECT_PERMISSION_PRESETS[role.name] || ['basicInfo:查看']
    return [role.name, Object.fromEntries(expandProjectPermissionKeys(source).map(key => [key, true]))]
  }))
}

function mergeProjectRoles(project: RoleProject, existing: readonly Role[] = []): Role[] {
  const fixed = getFixedProjectRoles(project)
  if (project.type !== PROJECT_CATEGORY_TECH && project.type !== PROJECT_TYPE_TOS_VERSION) return fixed
  return [...fixed, ...existing.filter(role => !role.isFixed)]
}

function buildInitialPerProject(): {
  rolesByProject: Record<string, Role[]>,
  rolePermissionsByProject: Record<string, Record<string, Record<string, boolean>>>,
} {
  const rolesByProject: Record<string, Role[]> = {}
  const rolePermissionsByProject: Record<string, Record<string, Record<string, boolean>>> = {}
  initialProjects.forEach(p => {
    const responsiblePersons = getProjectResponsiblePersons(p)
    const specialRoles = p.type === PROJECT_CATEGORY_TECH || p.type === PROJECT_TYPE_TOS_VERSION
    rolesByProject[p.id] = specialRoles
      ? mergeProjectRoles(p as unknown as RoleProject)
      : buildDefaultRoles().map(role => (
          role.name === '系统管理员'
            ? { ...role, members: responsiblePersons }
            : role
        ))
    rolePermissionsByProject[p.id] = specialRoles
      ? buildPermissionsForRoles(rolesByProject[p.id])
      : buildDefaultRolePermissions()
  })
  return { rolesByProject, rolePermissionsByProject }
}

const __INITIAL = buildInitialPerProject()

// ─── Store types ────────────────────────────────────────────────────

export interface PermissionState {
  // Per-project roles & permissions
  rolesByProject: Record<string, Role[]>
  rolePermissionsByProject: Record<string, Record<string, Record<string, boolean>>>

  // Shared UI state for PermissionConfig
  showAddRoleModal: boolean
  newRoleName: string
  editingRoleName: string | null
  editRoleNameValue: string
  permissionActiveRole: string
  permConfigTab: 'roles' | 'perms'

  // Global roles & permissions
  globalRoles: GlobalRole[]
  globalRolePerms: Record<string, Record<string, boolean>>
  globalPermTab: 'roles' | 'perms'
  showGlobalAddRole: boolean
  globalNewRoleName: string
  globalEditingRole: string | null
  globalEditRoleValue: string
  globalPermActiveRole: string
}

export interface PermissionActions {
  // Per-project actions
  setRolesForProject: (projectId: string, v: Role[] | ((prev: Role[]) => Role[])) => void
  setRolePermissionsForProject: (projectId: string, v: Record<string, Record<string, boolean>> | ((prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>)) => void
  initProjectPermissions: (projectId: string, overrides?: Partial<Record<string, string[]>>) => void
  syncProjectTeamPermissionMembers: (project: RoleProject) => void

  // UI state setters
  setShowAddRoleModal: (v: boolean) => void
  setNewRoleName: (v: string) => void
  setEditingRoleName: (v: string | null) => void
  setEditRoleNameValue: (v: string) => void
  setPermissionActiveRole: (v: string) => void
  setPermConfigTab: (v: 'roles' | 'perms') => void

  // Global role setters
  setGlobalRoles: (v: GlobalRole[] | ((prev: GlobalRole[]) => GlobalRole[])) => void
  setGlobalRolePerms: (v: Record<string, Record<string, boolean>> | ((prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>)) => void
  setGlobalPermTab: (v: 'roles' | 'perms') => void
  setShowGlobalAddRole: (v: boolean) => void
  setGlobalNewRoleName: (v: string) => void
  setGlobalEditingRole: (v: string | null) => void
  setGlobalEditRoleValue: (v: string) => void
  setGlobalPermActiveRole: (v: string) => void
}

export const usePermissionStore = create<PermissionState & PermissionActions>()((set, get) => ({
  rolesByProject: __INITIAL.rolesByProject,
  rolePermissionsByProject: __INITIAL.rolePermissionsByProject,

  showAddRoleModal: false,
  newRoleName: '',
  editingRoleName: null,
  editRoleNameValue: '',
  permissionActiveRole: '系统管理员',
  permConfigTab: 'roles',

  // Global roles
  globalRoles: [
    { name: '管理组', members: ['张三', '李白'], isFixed: true },
    { name: '编辑组', members: ['李四', '赵六', '王五'], isFixed: true },
    { name: '查看组', members: ['孙七', '周八', '杜甫'], isFixed: true },
  ],
  globalRolePerms: {
    '管理组': { 'roadmap:view': true, 'roadmap:edit': true, 'roadmap:baseline': true, 'roadmap:share': true, 'roadmap:export': true, 'configCenter:planEdit': true, 'configCenter:planPublish': true, 'configCenter:transferEdit': true, 'permissionCenter:manageRoles': true },
    '编辑组': { 'roadmap:view': true, 'roadmap:edit': true, 'roadmap:baseline': true, 'roadmap:share': false, 'roadmap:export': false, 'configCenter:planEdit': false, 'configCenter:planPublish': false, 'configCenter:transferEdit': false, 'permissionCenter:manageRoles': false },
    '查看组': { 'roadmap:view': true, 'roadmap:edit': false, 'roadmap:baseline': false, 'roadmap:share': false, 'roadmap:export': false, 'configCenter:planEdit': false, 'configCenter:planPublish': false, 'configCenter:transferEdit': false, 'permissionCenter:manageRoles': false },
  },
  globalPermTab: 'roles',
  showGlobalAddRole: false,
  globalNewRoleName: '',
  globalEditingRole: null,
  globalEditRoleValue: '',
  globalPermActiveRole: '管理组',

  // Per-project setters
  setRolesForProject: (projectId, v) => set((s) => {
    const prev = s.rolesByProject[projectId] ?? buildDefaultRoles()
    const next = typeof v === 'function' ? v(prev) : v
    return { rolesByProject: { ...s.rolesByProject, [projectId]: next } }
  }),
  setRolePermissionsForProject: (projectId, v) => set((s) => {
    const prev = s.rolePermissionsByProject[projectId] ?? buildDefaultRolePermissions()
    const next = typeof v === 'function' ? v(prev) : v
    return { rolePermissionsByProject: { ...s.rolePermissionsByProject, [projectId]: next } }
  }),
  initProjectPermissions: (projectId, overrides) => set((s) => {
    const roles = buildDefaultRoles().map(r => overrides && overrides[r.name] ? { ...r, members: [...overrides[r.name]!] } : r)
    const perms = buildDefaultRolePermissions()
    return {
      rolesByProject: { ...s.rolesByProject, [projectId]: roles },
      rolePermissionsByProject: { ...s.rolePermissionsByProject, [projectId]: perms },
    }
  }),
  syncProjectTeamPermissionMembers: (project) => set((s) => {
    const previousRoles = s.rolesByProject[project.id] ?? []
    const roles = mergeProjectRoles(project, previousRoles)
    const previousPermissions = s.rolePermissionsByProject[project.id] ?? {}
    const rolePermissions = {
      ...buildPermissionsForRoles(roles),
      ...previousPermissions,
    }
    return {
      rolesByProject: { ...s.rolesByProject, [project.id]: roles },
      rolePermissionsByProject: { ...s.rolePermissionsByProject, [project.id]: rolePermissions },
    }
  }),

  // UI state setters
  setShowAddRoleModal: (v) => set({ showAddRoleModal: v }),
  setNewRoleName: (v) => set({ newRoleName: v }),
  setEditingRoleName: (v) => set({ editingRoleName: v }),
  setEditRoleNameValue: (v) => set({ editRoleNameValue: v }),
  setPermissionActiveRole: (v) => set({ permissionActiveRole: v }),
  setPermConfigTab: (v) => set({ permConfigTab: v }),

  // Global setters
  setGlobalRoles: (v) => set((s) => ({ globalRoles: typeof v === 'function' ? v(s.globalRoles) : v })),
  setGlobalRolePerms: (v) => set((s) => ({ globalRolePerms: typeof v === 'function' ? v(s.globalRolePerms) : v })),
  setGlobalPermTab: (v) => set({ globalPermTab: v }),
  setShowGlobalAddRole: (v) => set({ showGlobalAddRole: v }),
  setGlobalNewRoleName: (v) => set({ globalNewRoleName: v }),
  setGlobalEditingRole: (v) => set({ globalEditingRole: v }),
  setGlobalEditRoleValue: (v) => set({ globalEditRoleValue: v }),
  setGlobalPermActiveRole: (v) => set({ globalPermActiveRole: v }),
}))

// ─── Permission helpers ─────────────────────────────────────────────
// Global "管理组" bypasses every project-level check.
export function isGlobalAdmin(userName: string): boolean {
  const s = usePermissionStore.getState()
  const admin = s.globalRoles.find(r => r.name === '管理组')
  return !!admin?.members.includes(userName)
}

// Global permission check used by cross-project modules such as Project Roadmap.
// A user may belong to several global roles; permissions are the union of all roles.
export function hasGlobalPermission(userName: string, permKey: string): boolean {
  if (!userName) return false
  const state = usePermissionStore.getState()
  const userRoles = state.globalRoles.filter(role => role.members.includes(userName))
  if (userRoles.some(role => role.name === '管理组')) return true
  return userRoles.some(role => state.globalRolePerms[role.name]?.[permKey] === true)
}

// React hook variant — subscribes to both global role membership and grants.
export function useHasGlobalPermission(userName: string): (permKey: string) => boolean {
  const globalRoles = usePermissionStore(state => state.globalRoles)
  const globalRolePerms = usePermissionStore(state => state.globalRolePerms)
  return (permKey: string) => {
    if (!userName) return false
    const userRoles = globalRoles.filter(role => role.members.includes(userName))
    if (userRoles.some(role => role.name === '管理组')) return true
    return userRoles.some(role => globalRolePerms[role.name]?.[permKey] === true)
  }
}

// Project-scoped permission check.
// projectId may be undefined during navigation transitions — returns global-admin result only.
export function hasPermission(userName: string, projectId: string | undefined, permKey: string): boolean {
  if (!userName) return false
  if (isGlobalAdmin(userName)) return true
  if (!projectId) return false
  const s = usePermissionStore.getState()
  const projectRoles = s.rolesByProject[projectId] ?? []
  const projectPerms = s.rolePermissionsByProject[projectId] ?? {}
  const userRoles = projectRoles.filter(r => r.members.includes(userName)).map(r => r.name)
  return userRoles.some(role => projectPerms[role]?.[permKey] === true)
}

// React hook variant — subscribes to per-project slot so UI re-renders on change.
export function useHasPermission(userName: string, projectId: string | undefined): (permKey: string) => boolean {
  const globalRoles = usePermissionStore(s => s.globalRoles)
  const projectRoles = usePermissionStore(s => (projectId ? s.rolesByProject[projectId] : undefined))
  const projectPerms = usePermissionStore(s => (projectId ? s.rolePermissionsByProject[projectId] : undefined))
  return (permKey: string) => {
    if (!userName) return false
    const admin = globalRoles.find(r => r.name === '管理组')
    if (admin?.members.includes(userName)) return true
    if (!projectId || !projectRoles || !projectPerms) return false
    const userRoles = projectRoles.filter(r => r.members.includes(userName)).map(r => r.name)
    return userRoles.some(role => projectPerms[role]?.[permKey] === true)
  }
}
