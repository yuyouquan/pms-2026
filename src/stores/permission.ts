import { create } from 'zustand'
import { PERMISSION_MODULES, FIXED_ROLES } from '@/components/permission/PermissionModule'

// ─── Compute default role permissions ───────────────────────────────
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

function buildInitialRolePermissions(): Record<string, Record<string, boolean>> {
  const init: Record<string, Record<string, boolean>> = {}
  FIXED_ROLES.forEach(r => {
    init[r] = {}
    ;(defaultPermsByRole[r] || []).forEach(p => { init[r][p] = true })
  })
  return init
}

// ─── Types ──────────────────────────────────────────────────────────

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

export interface PermissionState {
  // Project-level roles & permissions
  roles: Role[]
  rolePermissions: Record<string, Record<string, boolean>>
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
  setRoles: (v: Role[] | ((prev: Role[]) => Role[])) => void
  setRolePermissions: (v: Record<string, Record<string, boolean>> | ((prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>)) => void
  setShowAddRoleModal: (v: boolean) => void
  setNewRoleName: (v: string) => void
  setEditingRoleName: (v: string | null) => void
  setEditRoleNameValue: (v: string) => void
  setPermissionActiveRole: (v: string) => void
  setPermConfigTab: (v: 'roles' | 'perms') => void

  setGlobalRoles: (v: GlobalRole[] | ((prev: GlobalRole[]) => GlobalRole[])) => void
  setGlobalRolePerms: (v: Record<string, Record<string, boolean>> | ((prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>)) => void
  setGlobalPermTab: (v: 'roles' | 'perms') => void
  setShowGlobalAddRole: (v: boolean) => void
  setGlobalNewRoleName: (v: string) => void
  setGlobalEditingRole: (v: string | null) => void
  setGlobalEditRoleValue: (v: string) => void
  setGlobalPermActiveRole: (v: string) => void
}

export const usePermissionStore = create<PermissionState & PermissionActions>()((set) => ({
  // Project-level roles
  roles: [
    { name: '系统管理员', members: ['张三'], isFixed: true },
    { name: '产品经理', members: ['李四', '王五'], isFixed: true },
    { name: '项目经理', members: ['张三', '赵六'], isFixed: true },
    { name: '开发代表', members: ['王五'], isFixed: true },
    { name: '软件SE', members: ['孙七'], isFixed: true },
    { name: '设计师', members: ['周八'], isFixed: true },
    { name: '开发工程师', members: ['李白', '杜甫'], isFixed: true },
    { name: '测试工程师', members: ['赵六', '孙七'], isFixed: true },
    { name: '管理层', members: ['张三'], isFixed: true },
  ],
  rolePermissions: buildInitialRolePermissions(),
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

  // ─── Setters ─────────────────────────────────────────────────────
  setRoles: (v) => set((s) => ({ roles: typeof v === 'function' ? v(s.roles) : v })),
  setRolePermissions: (v) => set((s) => ({ rolePermissions: typeof v === 'function' ? v(s.rolePermissions) : v })),
  setShowAddRoleModal: (v) => set({ showAddRoleModal: v }),
  setNewRoleName: (v) => set({ newRoleName: v }),
  setEditingRoleName: (v) => set({ editingRoleName: v }),
  setEditRoleNameValue: (v) => set({ editRoleNameValue: v }),
  setPermissionActiveRole: (v) => set({ permissionActiveRole: v }),
  setPermConfigTab: (v) => set({ permConfigTab: v }),

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
// Admin group (global "管理组") bypasses all project-level permission checks.
export function isGlobalAdmin(userName: string): boolean {
  const s = usePermissionStore.getState()
  const admin = s.globalRoles.find(r => r.name === '管理组')
  return !!admin?.members.includes(userName)
}

// Check if a user has a specific project-level permission.
// permKey format: "moduleKey:permissionName", e.g. "basicInfo:编辑", "plan:一级计划-编辑".
export function hasPermission(userName: string, permKey: string): boolean {
  if (!userName) return false
  if (isGlobalAdmin(userName)) return true
  const s = usePermissionStore.getState()
  const userRoles = s.roles.filter(r => r.members.includes(userName)).map(r => r.name)
  return userRoles.some(role => s.rolePermissions[role]?.[permKey] === true)
}

// React hook version — subscribes to permission store so UI re-renders on change.
export function useHasPermission(userName: string): (permKey: string) => boolean {
  const roles = usePermissionStore(s => s.roles)
  const rolePermissions = usePermissionStore(s => s.rolePermissions)
  const globalRoles = usePermissionStore(s => s.globalRoles)
  return (permKey: string) => {
    if (!userName) return false
    const admin = globalRoles.find(r => r.name === '管理组')
    if (admin?.members.includes(userName)) return true
    const userRoles = roles.filter(r => r.members.includes(userName)).map(r => r.name)
    return userRoles.some(role => rolePermissions[role]?.[permKey] === true)
  }
}

// Check if user can view a project. Admin group bypasses; otherwise must be
// listed in PROJECT_MEMBER_MAP for that project.
import { PROJECT_MEMBER_MAP, useProjectStore } from '@/stores/project'

export function hasProjectAccess(userName: string, projectNameOrId: string): boolean {
  if (!userName || !projectNameOrId) return false
  if (isGlobalAdmin(userName)) return true

  // Resolve project name → id (if not already id)
  let projectId = projectNameOrId
  const byName = useProjectStore.getState().projects.find(
    p => p.name === projectNameOrId || p.id === projectNameOrId
  )
  if (byName) projectId = byName.id

  const members = PROJECT_MEMBER_MAP[projectId] || []
  return members.includes(userName)
}
