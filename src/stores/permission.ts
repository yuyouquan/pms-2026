import { create } from 'zustand'
import { PERMISSION_MODULES, FIXED_ROLES } from '@/components/permission/PermissionModule'
import { initialProjects } from '@/data/projects'

// ─── Defaults shared by every project's initial role-permission slot ─

const defaultPermsByRole: Record<string, string[]> = {
  '系统管理员': PERMISSION_MODULES.flatMap(m => m.permissions.map(p => `${m.key}:${p}`)),
  '项目经理': ['basicInfo:查看', 'basicInfo:编辑', 'plan:一级计划-查看', 'plan:一级计划-编辑', 'plan:二级计划-查看', 'plan:二级计划-编辑', 'plan:导入/导出', 'resources:查看', 'tasks:查看', 'risks:查看'],
  '产品经理': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'resources:查看', 'tasks:查看', 'risks:查看'],
  '开发代表': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
  '软件SE': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
  '设计师': ['basicInfo:查看'],
  '开发工程师': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
  '测试工程师': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看', 'risks:查看'],
  '管理层': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'resources:查看', 'tasks:查看', 'risks:查看'],
}

// Default members per fixed role — matches the prior global `roles` initial values
// so existing 10 mock projects retain the same user-→-role mapping.
const DEFAULT_ROLE_MEMBERS: Record<string, string[]> = {
  '系统管理员': ['张三'],
  '产品经理': ['李四', '王五'],
  '项目经理': ['张三', '赵六'],
  '开发代表': ['王五'],
  '软件SE': ['孙七'],
  '设计师': ['周八'],
  '开发工程师': ['李白', '杜甫'],
  '测试工程师': ['赵六', '孙七'],
  '管理层': ['张三'],
}

interface Role {
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

function buildInitialPerProject(): {
  rolesByProject: Record<string, Role[]>,
  rolePermissionsByProject: Record<string, Record<string, Record<string, boolean>>>,
} {
  const rolesByProject: Record<string, Role[]> = {}
  const rolePermissionsByProject: Record<string, Record<string, Record<string, boolean>>> = {}
  initialProjects.forEach(p => {
    rolesByProject[p.id] = buildDefaultRoles()
    rolePermissionsByProject[p.id] = buildDefaultRolePermissions()
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
    '管理组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': true },
    '编辑组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': true },
    '查看组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': false },
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
