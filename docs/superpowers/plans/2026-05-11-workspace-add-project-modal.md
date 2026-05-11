# 工作台「新增项目」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "新增项目" entry point to the workspace whose Modal takes 项目名 (from a mock external pool) / 项目类型 / 项目责任人, and creates a project with per-project permission config where the responsible persons are the project's 系统管理员.

**Architecture:** New `AddProjectModal` + `externalProjectPool` mock. Refactor `usePermissionStore`'s global `roles`/`rolePermissions` into `rolesByProject`/`rolePermissionsByProject` (lazy default for existing 10 projects, overridden for new project). Migrate `PROJECT_MEMBER_MAP` from `export const` to `useProjectStore.projectMemberMap` so visibility updates without page reload.

**Tech Stack:** Next.js 14 + React 18 + Ant Design 6 + Zustand 4 + TypeScript 5. No test framework — verification via `npx tsc --noEmit` and `npm run build` and manual browser check.

**Branch:** Already on `dev`. All commits go to `dev`.

---

## File Structure

| Path | New / Modified | Responsibility |
|---|---|---|
| `src/data/externalProjectPool.ts` | New | Mock `{ name, bid, spm }` pool + `fetchByBid(bid)` returning extra fields. |
| `src/stores/project.ts` | Modified | Convert `PROJECT_MEMBER_MAP` (`export const`) to `projectMemberMap` state + `setProjectMember`. Add `addProject(newProject)` action. |
| `src/stores/permission.ts` | Modified | Replace `roles` / `rolePermissions` with per-project shape `rolesByProject` / `rolePermissionsByProject`. New `initProjectPermissions(projectId, overrides?)`. New `useHasPermission(user, projectId)`. |
| `src/containers/AppShell.tsx` | Modified | Read `projectMemberMap` from store; remove dead-code `roles` destructure (line 22) and `userRoles` line. |
| `src/containers/WorkspaceContainer.tsx` | Modified | Read `projectMemberMap` from store. Add "新增项目" button (gated by `isAdminUser`). Add Modal state + render `AddProjectModal`. |
| `src/containers/ProjectSpaceContainer.tsx` | Modified | Drop unused `PROJECT_MEMBER_MAP` import. Use `useHasPermission(user, selectedProject?.id)`. Derive `roles`/`setRoles`/`rolePermissions`/`setRolePermissions` from per-project getters. |
| `src/components/workspace/AddProjectModal.tsx` | New | Antd Modal with 3-field form; on submit calls store actions and triggers navigation. |
| `docs/superpowers/specs/2026-05-11-workspace-add-project-modal-design.md` | Existing (already committed) | Source spec. |

---

## Task 1: Create external project pool mock

**Files:**
- Create: `src/data/externalProjectPool.ts`

- [ ] **Step 1: Write the new file**

```ts
// src/data/externalProjectPool.ts
// Mock for the "external system" project enumeration. Real impl would
// be replaced with an async fetch keyed by `bid`.

export interface ExternalProjectEntry {
  bid: string
  name: string
  spm: string
}

export const EXTERNAL_PROJECT_POOL: ExternalProjectEntry[] = [
  { bid: 'EXT-001', name: 'X6900-D8600_H1100', spm: '李白' },
  { bid: 'EXT-002', name: 'X6901-D8700_H1102', spm: '张三' },
  { bid: 'EXT-003', name: 'tOS19.0', spm: '李四' },
  { bid: 'EXT-004', name: 'tOS19.1', spm: '王五' },
  { bid: 'EXT-005', name: 'X6912_H1208', spm: '赵六' },
  { bid: 'EXT-006', name: 'AI-Engine-V3', spm: '张三' },
  { bid: 'EXT-007', name: 'X6920-D8800_H1300', spm: '李白' },
  { bid: 'EXT-008', name: 'CI-Platform-V2', spm: '孙七' },
]

export interface FetchByBidResult {
  productLine?: string
  brand?: string
  tosVersion?: string
  androidVersion?: string
  chipPlatform?: string
  planStartDate?: string
  planEndDate?: string
}

// Mocked "external system" fetch. Returns supplementary fields, keyed by bid.
export function fetchByBid(bid: string): FetchByBidResult {
  const map: Record<string, FetchByBidResult> = {
    'EXT-001': { productLine: 'NOTE', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-01', planEndDate: '2026-12-31' },
    'EXT-002': { productLine: 'NOTE', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-07-01', planEndDate: '2027-01-31' },
    'EXT-003': { productLine: 'tOS', tosVersion: 'tOS 19.0', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-01', planEndDate: '2026-11-30' },
    'EXT-004': { productLine: 'tOS', tosVersion: 'tOS 19.1', androidVersion: 'Android 17', chipPlatform: 'QCOM', planStartDate: '2026-08-01', planEndDate: '2027-02-28' },
    'EXT-005': { productLine: 'SPARK', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-15', planEndDate: '2026-12-15' },
    'EXT-006': { productLine: 'AI引擎', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-05-15', planEndDate: '2026-10-31' },
    'EXT-007': { productLine: 'CAMON', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'QCOM', planStartDate: '2026-07-15', planEndDate: '2027-03-31' },
    'EXT-008': { productLine: '工程效率', planStartDate: '2026-06-01', planEndDate: '2026-12-31' },
  }
  return map[bid] ?? {}
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/data/externalProjectPool.ts
git commit -m "$(cat <<'EOF'
feat(workspace): mock external project pool

Adds a mock { name, bid, spm }[] pool plus fetchByBid() returning
supplementary fields, modeling the "external system" the add-project
Modal will pick from.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migrate `PROJECT_MEMBER_MAP` from const to store state

**Files:**
- Modify: `src/stores/project.ts`
- Modify: `src/containers/AppShell.tsx:11,22,39,53-54,171`
- Modify: `src/containers/WorkspaceContainer.tsx:13,64`
- Modify: `src/containers/ProjectSpaceContainer.tsx:46`

- [ ] **Step 1: Update `src/stores/project.ts`**

Replace the `export const PROJECT_MEMBER_MAP` block (lines 7-19) with an exported initial map constant under a new name, then add state + action.

Find (lines 7-19):
```ts
// Project-member assignment (mock: which users are assigned per project in permission config)
export const PROJECT_MEMBER_MAP: Record<string, string[]> = {
  '1': ['张三', '李四', '王五', '赵六', '李白'],         // X6877
  '3': ['王五', '赵六', '孙七'],                         // X6855
  '2': ['张三', '李四', '王五', '赵六', '孙七'],         // tOS16.0
  '6': ['赵六', '李四', '王五'],                         // tOS17.1
  '4': ['孙七', '李四', '张三'],                         // X6876_H786
  '5': ['周八', '王五', '李白'],                         // X6873_H972
  '7': ['李白', '张三', '王五'],                         // X6890 CAMON
  '8': ['杜甫', '李白', '张三', '李四', '王五'],         // tOS18.0
  '9': ['李四', '张三', '赵六', '孙七'],                 // AI-Engine-V2
  '10': ['孙七', '周八', '李白', '杜甫', '王五'],        // DevOps-Platform
}
```

Replace with:
```ts
// Initial project-member assignment (mock seed; runtime value lives in store state below).
export const INITIAL_PROJECT_MEMBER_MAP: Record<string, string[]> = {
  '1': ['张三', '李四', '王五', '赵六', '李白'],         // X6877
  '3': ['王五', '赵六', '孙七'],                         // X6855
  '2': ['张三', '李四', '王五', '赵六', '孙七'],         // tOS16.0
  '6': ['赵六', '李四', '王五'],                         // tOS17.1
  '4': ['孙七', '李四', '张三'],                         // X6876_H786
  '5': ['周八', '王五', '李白'],                         // X6873_H972
  '7': ['李白', '张三', '王五'],                         // X6890 CAMON
  '8': ['杜甫', '李白', '张三', '李四', '王五'],         // tOS18.0
  '9': ['李四', '张三', '赵六', '孙七'],                 // AI-Engine-V2
  '10': ['孙七', '周八', '李白', '杜甫', '王五'],        // DevOps-Platform
}
```

In `ProjectState` (after `todoCollapsed: boolean` on line 54), add:
```ts
  projectMemberMap: Record<string, string[]>
```

In `ProjectActions` (after `setTodoCollapsed`), add:
```ts
  setProjectMember: (projectId: string, members: string[]) => void
  addProject: (newProject: Project) => void
```

In the `create` initial state (after `todoCollapsed: false,`), add:
```ts
  projectMemberMap: { ...INITIAL_PROJECT_MEMBER_MAP },
```

After the existing setters in the create body (after `setTodoCollapsed: (v) => set({ todoCollapsed: v }),`), add:
```ts
  setProjectMember: (projectId, members) => set((s) => ({
    projectMemberMap: { ...s.projectMemberMap, [projectId]: members },
  })),
  addProject: (newProject) => set((s) => ({
    projects: [...s.projects, newProject],
  })),
```

- [ ] **Step 2: Update `src/containers/WorkspaceContainer.tsx`**

Find (line 13):
```ts
import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'
```
Replace with:
```ts
import { useProjectStore } from '@/stores/project'
```

In the destructure of `useProjectStore()` (lines 29-41), add `projectMemberMap` (e.g. after `currentLoginUser,`):
```ts
    currentLoginUser,
    projectMemberMap,
```

Find (line 64):
```ts
      const members = PROJECT_MEMBER_MAP[p.id] || []
```
Replace with:
```ts
      const members = projectMemberMap[p.id] || []
```

- [ ] **Step 3: Update `src/containers/AppShell.tsx`**

Find (line 11):
```ts
import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'
```
Replace with:
```ts
import { useProjectStore } from '@/stores/project'
```

Find (line 21) — `UserSwitcher`'s destructure:
```ts
  const { projects, currentLoginUser, setCurrentLoginUser, setProjectCardPage } = useProjectStore()
```
Replace with:
```ts
  const { projects, currentLoginUser, setCurrentLoginUser, setProjectCardPage, projectMemberMap } = useProjectStore()
```

Find (line 22):
```ts
  const { roles, globalRoles } = usePermissionStore()
```
Replace with:
```ts
  const { globalRoles } = usePermissionStore()
```

Find (line 39):
```ts
                const projectCount = isAdmin ? projects.length : projects.filter(p => (PROJECT_MEMBER_MAP[p.id] || []).includes(currentLoginUser)).length
```
Replace with:
```ts
                const projectCount = isAdmin ? projects.length : projects.filter(p => (projectMemberMap[p.id] || []).includes(currentLoginUser)).length
```

Find (lines 53-54):
```ts
            const projectCount = isAdmin ? projects.length : projects.filter(p => (PROJECT_MEMBER_MAP[p.id] || []).includes(u)).length
            const userRoles = roles.filter(r => r.members.includes(u)).map(r => r.name)
```
Replace with:
```ts
            const projectCount = isAdmin ? projects.length : projects.filter(p => (projectMemberMap[p.id] || []).includes(u)).length
```
(The `userRoles` constant is computed but never read in the rendered JSX — delete the line.)

In `ProjectSpaceHeader` destructure (lines 153-156):
```ts
  const {
    projects, selectedProject, setSelectedProject,
    currentLoginUser, setSelectedMarketTab,
  } = useProjectStore()
```
Add `projectMemberMap`:
```ts
  const {
    projects, selectedProject, setSelectedProject,
    currentLoginUser, setSelectedMarketTab, projectMemberMap,
  } = useProjectStore()
```

Find (line 171):
```ts
      const members = PROJECT_MEMBER_MAP[p.id] || []
```
Replace with:
```ts
      const members = projectMemberMap[p.id] || []
```

- [ ] **Step 4: Update `src/containers/ProjectSpaceContainer.tsx`**

Find (line 46):
```ts
import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'
```
Replace with:
```ts
import { useProjectStore } from '@/stores/project'
```
(The constant was only imported, never referenced in the file body — confirmed by grep.)

- [ ] **Step 5: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Browser smoke check**

Run: `npm run dev` (port 3004 or 3000)
Manually: open workspace as `张三` (default user) → confirm 10 project cards still appear.
Switch user to `李四` via header → confirm fewer projects (those whose member map contains 李四).

Stop the dev server (`Ctrl+C`) after confirming.

- [ ] **Step 7: Commit**

```bash
git add src/stores/project.ts src/containers/AppShell.tsx src/containers/WorkspaceContainer.tsx src/containers/ProjectSpaceContainer.tsx
git commit -m "$(cat <<'EOF'
refactor(project-store): move PROJECT_MEMBER_MAP into store state

Previously a module-level export const, which meant a freshly created
project couldn't grant visibility to its members without a page
reload. Promote it to a useProjectStore field with setProjectMember.
Also add an addProject action so the upcoming Modal can dispatch via
the store API.

No functional change yet — wires up the same initial map under the
new name and migrates the 4 call sites.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Refactor permission store to per-project

**Files:**
- Modify: `src/stores/permission.ts` (full rewrite of project-level state)
- Modify: `src/containers/ProjectSpaceContainer.tsx:49,156-161,165`
- Modify: `src/containers/AppShell.tsx` (no change needed — already cleaned in Task 2)

- [ ] **Step 1: Rewrite `src/stores/permission.ts`**

Overwrite the entire file with:

```ts
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
```

- [ ] **Step 2: Update `src/containers/ProjectSpaceContainer.tsx`**

Find (lines 156-161):
```ts
  const {
    roles, setRoles, rolePermissions, setRolePermissions,
    showAddRoleModal, setShowAddRoleModal, newRoleName, setNewRoleName,
    editingRoleName, setEditingRoleName, editRoleNameValue, setEditRoleNameValue,
    permissionActiveRole, setPermissionActiveRole, permConfigTab, setPermConfigTab,
  } = perm
```

Replace with:
```ts
  const {
    showAddRoleModal, setShowAddRoleModal, newRoleName, setNewRoleName,
    editingRoleName, setEditingRoleName, editRoleNameValue, setEditRoleNameValue,
    permissionActiveRole, setPermissionActiveRole, permConfigTab, setPermConfigTab,
  } = perm

  // Per-project roles/permissions are looked up by selectedProject.id and
  // proxied through setRolesForProject/setRolePermissionsForProject so the
  // existing PermissionConfig signature (which takes roles/setRoles/etc.) is
  // unchanged.
  const _permProjectId = selectedProject?.id ?? ''
  const roles = perm.rolesByProject[_permProjectId] ?? []
  const setRoles = (v: Parameters<typeof perm.setRolesForProject>[1]) => perm.setRolesForProject(_permProjectId, v)
  const rolePermissions = perm.rolePermissionsByProject[_permProjectId] ?? {}
  const setRolePermissions = (v: Parameters<typeof perm.setRolePermissionsForProject>[1]) => perm.setRolePermissionsForProject(_permProjectId, v)
```

Find (line 165):
```ts
  const canDo = useHasPermission(currentLoginUser)
```

Replace with:
```ts
  const canDo = useHasPermission(currentLoginUser, selectedProject?.id)
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

If any consumer of the old `roles` / `rolePermissions` selectors trips, grep for it and update — the only known consumer is `ProjectSpaceContainer.tsx`.

- [ ] **Step 4: Browser smoke check**

Run: `npm run dev`
Manually:
1. Log in as 张三 → enter project `tOS16.0` → 权限配置 → 「系统管理员」shows `张三` (default).
2. Add another member (e.g. 李四) to 系统管理员 in `tOS16.0` → switch to project `X6877` → confirm `X6877`'s 系统管理员 still shows only 张三. (Per-project isolation works.)
3. Switch user via header to 李四 → confirm 李四 can edit basic info in `tOS16.0` (since we just added them as 系统管理员 there) but NOT in `X6877`.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/stores/permission.ts src/containers/ProjectSpaceContainer.tsx
git commit -m "$(cat <<'EOF'
refactor(permissions): per-project roles & rolePermissions

Move project-level roles/rolePermissions from a single global slot to
rolesByProject / rolePermissionsByProject keyed by projectId. The 10
existing mock projects are eagerly hydrated with the previous defaults
so behavior is unchanged for them.

useHasPermission / hasPermission now require a projectId argument so
that one project's role grants don't leak across projects. The only
in-tree consumer (ProjectSpaceContainer) is updated to pass
selectedProject.id, and the PermissionConfig render-site keeps the
same prop shape via per-project getter wrappers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create AddProjectModal component

**Files:**
- Create: `src/components/workspace/AddProjectModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { Modal, Form, Select, message } from 'antd'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import { PROJECT_TYPES } from '@/data/projects'
import { EXTERNAL_PROJECT_POOL, fetchByBid, type ExternalProjectEntry } from '@/data/externalProjectPool'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { usePermissionStore } from '@/stores/permission'

interface AddProjectModalProps {
  open: boolean
  onCancel: () => void
}

interface FormShape {
  bid: string
  type: string
  responsiblePersons: string[]
}

export default function AddProjectModal({ open, onCancel }: AddProjectModalProps) {
  const [form] = Form.useForm<FormShape>()
  const [responsibleTouched, setResponsibleTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { projects, addProject, setSelectedProject, setProjectMember, setSelectedMarketTab } = useProjectStore()
  const { setActiveModule, setProjectSpaceModule } = useUiStore()
  const initProjectPermissions = usePermissionStore(s => s.initProjectPermissions)

  // Exclude bids whose name is already in projects.
  const candidatePool = useMemo<ExternalProjectEntry[]>(() => {
    const existingNames = new Set(projects.map(p => p.name))
    return EXTERNAL_PROJECT_POOL.filter(e => !existingNames.has(e.name))
  }, [projects])

  // Reset form when modal opens.
  useEffect(() => {
    if (open) {
      form.resetFields()
      setResponsibleTouched(false)
    }
  }, [open, form])

  const handleBidChange = (bid: string) => {
    const entry = candidatePool.find(e => e.bid === bid)
    if (!entry) return
    // Auto-fill responsible persons with SPM, only if user hasn't touched it.
    if (!responsibleTouched) {
      form.setFieldValue('responsiblePersons', [entry.spm])
    }
  }

  const handleSubmit = async () => {
    let values: FormShape
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const entry = candidatePool.find(e => e.bid === values.bid)
    if (!entry) {
      message.error('未找到外部项目条目')
      return
    }
    setSubmitting(true)
    try {
      const extra = fetchByBid(entry.bid)
      const newId = `${Date.now()}`
      const newProject: any = {
        id: newId,
        name: entry.name,
        type: values.type,
        status: '筹备中',
        progress: 0,
        leader: values.responsiblePersons[0],
        markets: [],
        androidVersion: extra.androidVersion ?? '',
        chipPlatform: extra.chipPlatform ?? '',
        spm: entry.spm,
        updatedAt: '刚刚',
        productLine: extra.productLine ?? '',
        tosVersion: extra.tosVersion ?? '',
        brand: extra.brand ?? undefined,
        planStartDate: extra.planStartDate ?? '',
        planEndDate: extra.planEndDate ?? '',
        healthStatus: 'normal',
      }
      addProject(newProject)
      setProjectMember(newId, values.responsiblePersons)
      initProjectPermissions(newId, { '系统管理员': values.responsiblePersons })
      setSelectedProject(newProject)
      setSelectedMarketTab('OP')
      setProjectSpaceModule('basic')
      setActiveModule('projectSpace')
      message.success('项目创建成功')
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="新增项目"
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText="创建"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="项目名"
          name="bid"
          rules={[{ required: true, message: '请选择项目名' }]}
        >
          <Select
            showSearch
            placeholder="搜索并选择项目"
            optionFilterProp="label"
            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={candidatePool.map(e => ({ label: e.name, value: e.bid }))}
            onChange={handleBidChange}
            notFoundContent="无匹配项目"
          />
        </Form.Item>
        <Form.Item
          label="项目类型"
          name="type"
          rules={[{ required: true, message: '请选择项目类型' }]}
        >
          <Select
            placeholder="请选择项目类型"
            options={PROJECT_TYPES.map(t => ({ label: t, value: t }))}
          />
        </Form.Item>
        <Form.Item
          label="项目责任人"
          name="responsiblePersons"
          rules={[{ required: true, message: '请选择项目责任人', type: 'array', min: 1 }]}
          extra="默认回填该项目的 SPM；创建后将成为权限中心的「系统管理员」"
        >
          <Select
            mode="multiple"
            placeholder="请选择项目责任人"
            options={ALL_USERS.map(u => ({ label: u, value: u }))}
            onChange={() => setResponsibleTouched(true)}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/AddProjectModal.tsx
git commit -m "$(cat <<'EOF'
feat(workspace): AddProjectModal component

3-field Modal (项目名 / 项目类型 / 项目责任人) that selects from the
mock external pool, auto-fills 责任人 default with the pool entry's
SPM (only while user hasn't touched it), and on submit:
- addProject(newProject) into useProjectStore
- setProjectMember(newId, 责任人)
- initProjectPermissions(newId, { 系统管理员: 责任人 })
- navigates into the new project's 基础信息 view

Not wired into any container yet — that lands in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire button + Modal into WorkspaceContainer

**Files:**
- Modify: `src/containers/WorkspaceContainer.tsx`

- [ ] **Step 1: Import & state**

Near the existing imports (around line 18-20), add:
```ts
import AddProjectModal from '@/components/workspace/AddProjectModal'
import { PlusOutlined } from '@ant-design/icons'
```

(`@ant-design/icons` is already imported on line 8 — extend that import list instead of adding a separate one. The full updated line 8-11 is:)
```ts
import {
  AppstoreOutlined, UnorderedListOutlined, ClockCircleOutlined,
  SearchOutlined, MenuFoldOutlined, MenuUnfoldOutlined, CheckSquareOutlined,
  PlusOutlined,
} from '@ant-design/icons'
```

After the existing `useState(initialTodos)` declaration around line 54:
```ts
  const [addProjectOpen, setAddProjectOpen] = useState(false)
```

- [ ] **Step 2: Add the "新增项目" button to the toolbar**

Find the closing `</Segmented>` and its enclosing parent `<div>` near lines 230-239:
```tsx
            <Segmented
              size="small"
              value={projectListView}
              onChange={(v) => setProjectListView(v as 'card' | 'list')}
              options={[
                { label: <AppstoreOutlined />, value: 'card' },
                { label: <UnorderedListOutlined />, value: 'list' },
              ]}
            />
          </div>
        )}
```

Add a primary button immediately after the `Segmented` component, gated by `isAdminUser`. Replace the snippet above with:
```tsx
            <Segmented
              size="small"
              value={projectListView}
              onChange={(v) => setProjectListView(v as 'card' | 'list')}
              options={[
                { label: <AppstoreOutlined />, value: 'card' },
                { label: <UnorderedListOutlined />, value: 'list' },
              ]}
            />
            {isAdminUser && (
              <>
                <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddProjectOpen(true)} style={{ borderRadius: 6 }}>
                  新增项目
                </Button>
              </>
            )}
          </div>
        )}
```

- [ ] **Step 3: Render the modal**

Find the outermost `return ( <div> ... </div> )` and the closing `</div>` of the WorkspaceContainer root (around line 387). Insert the modal as the last child:
```tsx
      <AddProjectModal open={addProjectOpen} onCancel={() => setAddProjectOpen(false)} />
    </div>
  )
}
```

So the very end of the function becomes:
```tsx
      )}
      <AddProjectModal open={addProjectOpen} onCancel={() => setAddProjectOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Browser smoke test**

Run: `npm run dev`

Test plan:
1. Open as 张三 (default, `管理组`). Confirm "新增项目" button visible top-right of the workspace toolbar.
2. Switch via header to 李四 (not in `管理组`). Confirm button is gone.
3. Switch back to 张三. Click "新增项目":
   - Modal opens with 3 empty fields.
   - In 项目名: type `tOS19` → only matching entries shown → pick `tOS19.0`.
   - 项目责任人 auto-fills with `[李四]` (the pool entry's SPM).
   - Manually add `张三` to 项目责任人 (now `[李四, 张三]`).
   - Switch 项目名 to `tOS19.1` → 项目责任人 should NOT change back (user has touched it).
   - Pick 项目类型 `产品项目`.
   - Click 创建. Expect:
     - Modal closes.
     - Page navigates to projectSpace → `tOS19.1` → 基础信息 view.
     - `success` toast: 项目创建成功.
4. Navigate into 权限配置 (项目空间侧栏) → 「系统管理员」row members should be `[李四, 张三]`.
5. Navigate to existing project `tOS16.0` → 权限配置 → 「系统管理员」row should still be `[张三]` (unchanged, per-project isolation works).
6. Click back to workspace → confirm new project card appears.
7. Switch user to 李四 → confirm 李四 can still see the new project (PROJECT_MEMBER_MAP update worked) but cannot see "新增项目" button (not 管理组).

Stop the dev server.

- [ ] **Step 6: Production build sanity**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/containers/WorkspaceContainer.tsx
git commit -m "$(cat <<'EOF'
feat(workspace): 新增项目 button + Modal wiring

Adds a primary 新增项目 button to the workspace toolbar (right of the
card/list view toggle), gated by isAdminUser (only members of the
global 管理组 see it). Clicking opens AddProjectModal; on submit the
new project lands in the projects store, gets its own permission slot
with the chosen 责任人 as 系统管理员, and the page navigates straight
into the new project's 基础信息 view.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Self-review & wrap-up

- [ ] **Step 1: Re-check verification gates**

Run both:
```
npx tsc --noEmit
npm run build
```
Both must pass cleanly. If either fails, return to the failing task and fix.

- [ ] **Step 2: Confirm no stale references**

Run:
```bash
grep -rn "PROJECT_MEMBER_MAP" src/
grep -rn "useHasPermission(currentLoginUser)\b" src/
```
First grep should return zero results (only `INITIAL_PROJECT_MEMBER_MAP` in `src/stores/project.ts` is allowed).
Second grep should return zero — every `useHasPermission` call now takes a `projectId`.

- [ ] **Step 3: Check git log is clean**

Run: `git log --oneline -8`
Expected: 5 new commits on `dev`, all signed with Co-Authored-By:
1. `feat(workspace): mock external project pool`
2. `refactor(project-store): move PROJECT_MEMBER_MAP into store state`
3. `refactor(permissions): per-project roles & rolePermissions`
4. `feat(workspace): AddProjectModal component`
5. `feat(workspace): 新增项目 button + Modal wiring`

- [ ] **Step 4: Final sweep through the design spec**

Open `docs/superpowers/specs/2026-05-11-workspace-add-project-modal-design.md`. Walk each section's requirements. Tick mentally that the corresponding task implements it. If anything is missing, surface it.

If everything is green, the work is done.
