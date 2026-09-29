# 权限中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Follow the user's instruction to commit only after full verification.

**Goal:** 实现项目空间外的权限中心，按菜单即时配置人员、功能、数据条件及列，并完成完整回归后提交 feature。

**Architecture:** 统一菜单目录和纯授权计算模型；扩展既有权限持久化与兼容接口。权限界面与各业务消费者共享同一策略，保留项目空间权限边界。

**Tech Stack:** Next.js 14、React 18、Ant Design 6、Zustand 4、TypeScript；现有 Node 验证脚本和浏览器验证，不引入新 UI 或测试框架。

**Spec:** `docs/superpowers/specs/2026-09-28-permission-center-design.md`

## Global Constraints

- 所有命令在 `/Users/shswyuyouquan/.codex/worktrees/pms-permission-config/pms-2026` 执行；保留主目录改动。
- 角色栏约 180px，菜单栏约 176px，收起约 40px；分别控制和保留选中状态。
- 按角色、菜单配置人员及部门，勾选即时生效，无保存按钮；筛选未完整时保留已生效策略。
- 标签采用浅紫色圆角胶囊、强调字段名、灰色运算符、深色值和红色关闭图标。
- 超管使用固定身份标识，分类名称不能授予超管能力；新角色默认无权限。
- 多角色按完整的人员、菜单、操作、行、列策略计算并集，导出单独按导出授权计算。
- 不合并 dev/master、不部署；全部检查和修复完成后仅提交当前 feature 分支。

## Review Focus

1. 角色 A 的导出权限不能借角色 B 的查看行范围或字段扩大。
2. 清空条件、错误持久化数据和快速连续勾选不能错误放权。
3. 隐藏字段不能从卡片、详情、排序、筛选、演进图或导出重新出现。
4. 权限管理员不能提升自己为超管，不能移除最后一个有效超管。
5. 切换用户或实时撤权必须更新已打开页面，折叠侧栏不丢失配置。

## Task 1: 权限领域模型、存储和迁移

**Files:** 新建 `src/types/permissionCenter.ts`、`src/constants/permissionCenter.ts`、`src/lib/permissionCenter.ts`；修改 `src/stores/permission.ts`；验证 `scripts/verify-permission-center.mjs`。

**Interfaces:** 领域导出稳定菜单 ID、角色/分组/策略类型、默认空策略、字段定义、完整策略校验及逐行逐列授权函数。Store 导出 `useMenuPermission(user, menuId)`、`hasMenuPermission(user, menuId, action, row?)`、即时修改策略/角色的方法；在后续任务开始前记录实际签名。保留现有 `hasPermission` 与 `useHasPermission`、`hasGlobalPermission`、`useHasGlobalPermission` 兼容入口。

- [x] 在 Node 现有 TS loader 下添加行为测试并运行，确认新 API 尚不存在导致失败。
```js
assert.equal(hasMenuPermission('viewer', 'roadmap.table', 'export', { brand: 'B' }), false)
assert.equal(hasMenuPermission('outsider', 'project.view', 'view'), false)
// Two role policies: A exports brand A/name; B views brand B/cost.
// Assert neither B rows nor cost on A rows appears in export projection.
```
- [x] 实现稳定角色标识、菜单目录、条件校验、人员/部门匹配、按操作的行列投影及管理员保护。
- [x] 实现即时修改动作、持久化失败反馈、从旧全局角色迁移、兼容原项目配置负责人的条件范围。
- [x] 验证重名/空名、部门授权、无权限、多人多角色、未知字段、空条件、导出并集、超管保护、迁移幂等及刷新回读。
- [x] 运行 `node scripts/verify-permission-center.mjs` 及既有权限相关验证；预期通过。
- [x] 记录最终接口和测试结果供后续任务使用；暂不提交。

## Task 2: 权限中心界面和主导航

**Files:** 修改 `src/containers/GlobalPermissionContainer.tsx`、`src/containers/AppShell.tsx`、`src/app/page.tsx`、`src/stores/ui.ts`；新增 `src/components/permission-center/` 下角色表单、双树导航、策略编辑器；仅新增局部样式。

**Interfaces:** 消费 Task 1 的菜单目录、权限 store 和授权函数。复用 `CollapsibleSidebarShell`；若需独立按钮名称，新增可选属性并保持原调用兼容。

- [x] 用浏览器测试约定入口与角色创建流程，先确认现有页面缺少权限中心。
```js
// Rendered browser interactions: Header > 权限中心 > 添加角色.
// Empty required fields reject; duplicate trimmed names reject.
// Successful add selects role, expands group; no 保存 button exists.
```
- [x] 实现角色组与角色树、可搜索且可新增的分组选择、角色名称/定位表单、编辑删除和自动选择。
- [x] 实现独立的窄双侧栏、分类菜单树、可搜索个人/部门、多操作复选、实时生效反馈。
- [x] 实现有效条件自动提交、筛选浮层和列浮层、截图式胶囊摘要、必要列保护、未完成输入保护。
- [x] Header 配置中心后增加权限中心，入口与页面本体均鉴权；移除或封闭旧全局编辑旁路。
- [x] 验证四种侧栏状态、角色/菜单切换、搜索、多角色与刷新一致性；预期通过。暂不提交。

## Task 3: 项目、路标与全局业务入口实际授权

**Files:** 项目视图/配置、项目组合计划、路标表单与演进图、配置中心、HR和工作台相关容器及业务动作；必要时新增投影适配 hook。不进行无关重构。

**Interfaces:** 使用 Task 1 实际签名。保留 `useHasPermission(user, projectId)` 的项目内控制。业务字段通过已有字段注册表适配，禁止用 DOM 隐藏代替数据投影。

- [x] 添加端到端授权集成验证，先确认原页面未受新菜单策略约束。
```js
// Seed a brand-scoped reader, switch identity, visit both roadmap modes.
// Clear UI filters: other brands must stay absent; hidden columns stay absent.
// Export has only rows/fields from matching export grants, not all view grants.
```
- [x] 项目视图先按授权过滤源数据，再运行个人筛选/排序/汇总，限制字段选择、卡片、详情、导出。
- [x] 路标按表单与演进图分别授权，覆盖筛选候选、详情、统计和导出；执行修改前重新校验。
- [x] 项目配置负责人范围迁入明确策略；组合计划和配置中心动作接入菜单权限并保留既有业务约束。
- [x] 工作台、HR及旧独立路由接入适用访问边界，避免撤权后的残留内容；项目空间仍走项目权限。
- [x] 运行专项脚本和类型检查；预期通过。暂不提交。

## Task 4: 完整测试、审查、修复与提交

**Files:** `scripts/verify-permission-center*.mjs`、浏览器验证脚本与 `docs/qa/2026-09-28-permission-center.md`。

- [x] 运行 `npx tsc --noEmit`、`npm run build`、`npm run verify:full-regression`、`git diff --check`，记录精确结果。
- [x] 浏览器实测超管、限定品牌只读和撤权用户，多角色策略组合由行为脚本验证；验证添加、实时配置、刷新、导出及撤权。
- [x] 检查 1440×900、1280×800、1920×1080及窄屏的布局、胶囊样式、四种侧栏状态和运行异常。
- [x] 回归项目创建、项目空间计划/资源/权限/转维、组合计划、路标与配置中心；结果写入 QA 文档。
- [x] 新上下文审查完整变更和五项 Review Focus；修复实质问题，添加回归证据并重跑受影响检查。
- [x] 所有检查及失败复测通过后执行已授权的 feature 提交（提交结果以 Git 日志为准）：
```bash
git diff --check
git add <本任务文件>
git commit -m "feat: add menu-scoped permission center"
git status --short --branch
git log -1 --oneline
```
- [x] 交付包含 commit、测试摘要及确实存在的限制。不自动发布。
