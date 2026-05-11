# 工作台「新增项目」Modal 设计

**日期**: 2026-05-11
**分支**: `dev`
**作者**: Claude + youquan.yu

## 背景

项目数据当前由「外部系统」直接同步到本系统。但外部系统不区分项目类型（整机产品 / 产品 / 技术 / 能力建设），因此用户希望在工作台增加「新增项目」入口，**在导入项目的同时让用户指定本系统专属的字段**（项目类型、项目责任人），并把责任人作为该项目空间的初始系统管理员。

## 目标 & 非目标

### 目标
- 在工作台「项目列表」tab 增加「新增项目」按钮，仅全局「管理组」成员可见。
- 弹出 Modal，包含 3 个字段：
  - **项目名**：下拉单选 + 模糊搜索，候选从外部系统枚举池获取（mock）。
  - **项目类型**：下拉单选（4 种固定类型）。
  - **项目责任人**：下拉多选，默认回填外部池里该项目的 SPM，可调整。
- 提交后：通过 bid 调用 mock fetch 拉取外部信息 → 创建项目记录 → 写入 per-project 权限配置（责任人 = 该项目「系统管理员」）→ 跳转到新项目「基础信息」页。

### 非目标
- 不接入真实外部系统（mock）。
- 不实现「新增项目」操作的撤销或软删除。
- 不修改其它现有项目的权限快照（仅为新建项目写入 per-project 配置）。
- 不扩展现有 4 种项目类型；不新增项目状态值。

## 用户故事

1. 张三（全局「管理组」成员）登录 → 进入工作台 → 看到右上角「新增项目」按钮。
2. 张三点击 → Modal 弹出，三个字段均为空。
3. 在「项目名」下拉中输入 `X69` → 候选过滤显示 `X6900-D8600_H1100`、`X6901-...`；选中 `X6900-D8600_H1100`。
4. 「项目责任人」自动回填为该外部项目的 SPM（例如 `[李白]`）。张三补选 `[张三, 李白]`。
5. 「项目类型」选「整机产品项目」。
6. 点击「确定」→ 系统调 `fetchByBid('EXT-XXX')`（mock） → 得到剩余字段 → 项目写入 store → 权限 store 写入 per-project slot（系统管理员 = `[张三, 李白]`，其余角色继承默认） → `PROJECT_MEMBER_MAP` 加入 `{ newId: [张三, 李白] }` → 跳转 `projectSpace.basic` → 提示 `项目创建成功`。
7. 李四（普通用户）登录 → 看不到「新增项目」按钮。

## 架构概览

### 新增 / 修改文件清单

| 路径 | 类型 | 说明 |
|---|---|---|
| `src/components/workspace/AddProjectModal.tsx` | 新增 | Modal 组件，3 个字段，挂在工作台。 |
| `src/data/externalProjectPool.ts` | 新增 | Mock 枚举池 `{ name, bid, spm }[]` + `fetchByBid(bid)`。 |
| `src/containers/WorkspaceContainer.tsx` | 修改 | 工具栏右侧加按钮（gated by `isAdminUser`）+ Modal 接入。 |
| `src/stores/project.ts` | 修改 | `PROJECT_MEMBER_MAP` 从 `export const` 改成 store state；`projects` 增加方法 `addProject(...)`。 |
| `src/stores/permission.ts` | 修改 | `roles` / `rolePermissions` 改为 `rolesByProject` / `rolePermissionsByProject`；helper 增加 `projectId` 入参。 |
| `src/components/permission/PermissionModule.tsx` | 修改 | `PermissionConfig` props 改为通过 `projectId` 读写。 |
| `src/containers/ProjectSpaceContainer.tsx` | 修改 | 改用 per-project getter；`useHasPermission` 改造后的调用方更新。 |
| `src/containers/WorkspaceContainer.tsx` | 修改 | `PROJECT_MEMBER_MAP` 改为 store 读取（不再 import const）。 |

### 数据流

```
外部池 (mock)         User Modal           Stores                Navigation
─────────────         ──────────           ──────              ────────────
[{ name, bid, spm }] → pick name      → projects[]            
                      pick type       → projectMemberMap[id] → setSelectedProject(new)
                      pick owners[]   → rolesByProject[id]   → setProjectSpaceModule('basic')
                                          .系统管理员 members  → setActiveModule('projectSpace')
                      submit          → rolePermsByProject[id]
                                          .（继承默认）
```

## 详细设计

### 1. 外部项目池 (`src/data/externalProjectPool.ts`)

```ts
export interface ExternalProjectEntry {
  bid: string         // 外部系统业务 id
  name: string        // 项目名
  spm: string         // 项目 SPM（用于回填责任人默认值）
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

// 模拟「点击创建后通过 bid 拉取的剩余字段」
export interface FetchByBidResult {
  productLine?: string
  brand?: string
  tosVersion?: string
  androidVersion?: string
  chipPlatform?: string
  planStartDate?: string
  planEndDate?: string
}

export function fetchByBid(bid: string): FetchByBidResult {
  // 按 bid 返回不同的伪外部字段；未匹配时返回空对象。
  const map: Record<string, FetchByBidResult> = {
    'EXT-001': { productLine: 'NOTE', brand: 'TECNO', androidVersion: 'Android 17', chipPlatform: 'MTK', planStartDate: '2026-06-01', planEndDate: '2026-12-31' },
    // ... 其余条目同样列举（实现阶段补齐）
  }
  return map[bid] ?? {}
}
```

SPM 取值范围与 `ALL_USERS` 一致，确保多选回填有效。

### 2. AddProjectModal

```tsx
interface AddProjectModalProps {
  open: boolean
  onCancel: () => void
  onCreated: (newProject: Project) => void
}
```

- Antd `Modal` + `Form`。
- **项目名**：`Select showSearch filterOption` 候选过滤掉已经存在于 `projects` 的 `name`。
- **项目类型**：`Select` options = `PROJECT_TYPES`。
- **项目责任人**：`Select mode="multiple"` options = `ALL_USERS`；选择项目名时同步回填默认值 `[spm]`，仅当用户尚未手动改动该字段（`responsibleTouched` flag）。

**触发流程**（提交按钮）：
1. `form.validateFields()`
2. 找到选中条目 → 调 `fetchByBid(bid)` → 拼装 `Project`：
   ```ts
   const newProject: Project = {
     id: `${Date.now()}`,
     name, type,
     spm: pool.spm,
     leader: responsiblePersons[0],
     status: '筹备中',
     progress: 0,
     markets: [],
     updatedAt: '刚刚',
     healthStatus: 'normal',
     ...fetchByBid(bid),
   }
   ```
3. `addProject(newProject)`
4. `setProjectMember(newId, responsiblePersons)`
5. `initProjectPermissions(newId, { 系统管理员: responsiblePersons })`
6. `setSelectedProject + setProjectSpaceModule('basic') + setActiveModule('projectSpace')`
7. `message.success('项目创建成功')` + close

### 3. Permission store 重构

**当前**:
```ts
roles: Role[]                              // 全局共享
rolePermissions: Record<role, Record<perm, boolean>>
```

**改造后**:
```ts
rolesByProject: Record<projectId, Role[]>
rolePermissionsByProject: Record<projectId, Record<role, Record<perm, boolean>>>

// helpers
getRolesForProject(projectId): Role[]
setRolesForProject(projectId, roles | updater)
getRolePermsForProject(projectId): Record<role, Record<perm, boolean>>
setRolePermsForProject(projectId, perms | updater)
initProjectPermissions(projectId, overrides?: Partial<Record<role, string[]>>) // hydrate 默认 + override
```

**初始 hydration**：在 store 创建时为现有 10 个项目（即 `initialProjects.map(p => p.id)`）调用 `initProjectPermissions`，使用原先的全局默认成员（避免 breaking）。

**Helpers 改造**:
```ts
hasPermission(userName, projectId, permKey): boolean
useHasPermission(userName, projectId): (permKey) => boolean
isGlobalAdmin(userName): boolean       // 不变
```

调用方迁移（实现计划阶段精确列出）：基本上 `useHasPermission(currentLoginUser)` → `useHasPermission(currentLoginUser, selectedProject.id)`。

### 4. `PROJECT_MEMBER_MAP` → store 化

由于「新增项目后责任人必须立即看到」，必须可变：

```ts
// project.ts
interface ProjectState {
  ...
  projectMemberMap: Record<string, string[]>
}
interface ProjectActions {
  ...
  setProjectMember: (projectId: string, members: string[]) => void
}
```

`initialProjects` 对应的 mapping 作为 `projectMemberMap` 的初值，移除 `export const PROJECT_MEMBER_MAP`。`WorkspaceContainer.tsx:64` 的过滤逻辑改读 store。

### 5. 按钮可见性 & 位置

- 复用 `WorkspaceContainer.tsx` 已有的 `isAdminUser`（globalRoles `管理组` membership 检查）。
- 工具栏右侧，紧邻 `Segmented` 视图切换右侧，使用 `Button type="primary" icon={<PlusOutlined />}`。
- 仅当 `workspaceTab === 'projects' && isAdminUser` 时渲染。

## 校验规则

| 字段 | 规则 |
|---|---|
| 项目名 | 必填；候选已排除现有项目，因此本身去重 |
| 项目类型 | 必填；4 种枚举 |
| 项目责任人 | 必填；至少 1 项 |

点击「确定」时调用 `form.validateFields()`；任一字段不合法则 Antd 自动在字段下展示错误信息，submit handler 返回不继续创建。

## 风险 & 缓解

| 风险 | 说明 | 缓解 |
|---|---|---|
| Permission helper 调用方多 | `useHasPermission` 当前不带 `projectId`，多处需同时改。 | 实现计划阶段穷举调用点；优先一次性补齐编译，再跑 `npx tsc --noEmit` 兜底。 |
| `PROJECT_MEMBER_MAP` 作为 const 被多处 import | grep 已确认仅 `WorkspaceContainer.tsx` 使用。 | 改 store + 重命名为 `useProjectStore.projectMemberMap`，集中迁移。 |
| 默认回填覆盖用户手动改动 | 用户先选项目名 → 改责任人 → 换项目名，原 SPM 默认值会覆盖用户输入。 | `responsibleTouched` 本地 state；用户手动改过后不再覆盖。 |
| 工具栏空间挤压 | 工具栏已有较多控件。 | 按钮放最右侧，必要时压缩 `Segmented` 视图切换为图标按钮。 |

## 测试 / 验证

无单元测试框架。验证手段：

1. `npx tsc --noEmit` 通过。
2. `npm run build` 通过。
3. 浏览器手测：
   - 张三（管理组）登录看见按钮 → 创建一个项目 → 跳转到基础信息 → 进权限中心确认「系统管理员」是选中的责任人。
   - 切换到李四（非管理组）→ 按钮消失。
   - 责任人手动改动后切换项目名 → 默认值不被覆盖。
   - 已有 10 个项目的权限配置切换浏览，不出现互相串扰（即 per-project 隔离生效）。
   - 工作台「项目列表」中新项目卡片立即可见（PROJECT_MEMBER_MAP 改造生效）。

## 后续可能演进（非本期）

- 真正接入外部系统：替换 mock pool 为 API；将 `fetchByBid` 改成 async + Modal loading state。
- 权限中心 UI 增加「初始化为责任人」快捷按钮。
- 软删除 / 归档项目入口。
