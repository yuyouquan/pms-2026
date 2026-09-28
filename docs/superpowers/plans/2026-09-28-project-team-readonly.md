# 项目团队 Mock 展示与固定只读权限实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 项目空间展示 IPM 结构的 Mock 团队，团队成员可进入且固定只读，额外人员角色和部门角色不能提升权限，系统超级管理员例外。

**Architecture:** 独立团队数据源和 Zustand 状态维护外部团队身份，不把团队成员塞进可编辑的项目角色。项目入口和统一权限判断读取同一团队快照；职责驱动的计划/转维操作补充相同只读约束。界面复用 Ant Design 紧凑表格与角色树。

**Tech Stack:** Next.js 14、React 18、Ant Design 6、Zustand 4、现有 Node 行为验证脚本。

**Spec:** 本文“需求与边界”为已确认需求；测试矩阵见 `docs/qa/2026-09-28-project-team-test-plan.md`。

## 需求与边界 / Global Constraints

- 用户确认本轮使用 Mock 数据，不接真实 IPM 接口、不复制示例中的真实人员数据或凭据。
- “不能否增加”按“不能增加”处理，已向用户说明：只读优先于额外角色/部门授权；系统超级管理员仍不受限制。
- 团队成员仅有明确查看项；编辑、导入、导出、分享、发布、删除、转维处理、权限管理均不能因其他角色/职责而获得。
- 团队与项目权限配置中的团队职责为不同数据来源；来源 IPM 角色名不赋予 PMS 编辑职责。
- 项目和成员按稳定标识匹配，不按名称猜测；未知身份不授权。
- 数据仅为 Mock，UI 明确标识；刷新重新读取 Mock 来源，不声称已接入 IPM。
- 不更改主工作区；在 `codex/feature-permission-config` 上完成测试后提交推送，不合并或部署。

## Review Focus

1. 同名不同工号与缺失身份不可误授权（任务 1）。
2. 显式管理员角色、部门授权、SPM/任务职责仍不能突破团队只读（任务 1、2）。
3. 项目切换、删除、来源变化和技术子项目父级作用域不可串权（任务 1、2）。
4. 直接执行变更、已打开编辑弹窗和身份切换需要重新校验（任务 2）。
5. 长文本、空角色、搜索无结果、重复角色成员与窄屏布局需正常展示（任务 2）。

## Task 1: Mock 团队域、入口与统一权限

**Files:** 新增 `src/types/projectTeam.ts`、`src/mock/projectTeam.ts`、`src/stores/projectTeam.ts`、`src/lib/projectTeam.ts`；修改 `src/lib/projectListFilters.ts`、`src/stores/permission.ts`、`src/stores/project.ts`、目录 Mock 常量；新增 `scripts/verify-project-team-access.mjs`。

**Interfaces:** `isProjectTeamMember(userName: string, projectId: string | undefined): boolean`、`useIsProjectTeamMember(userName: string, projectId: string | undefined): boolean` 从 `src/lib/projectTeam.ts` 导出。store 公开 `teamsByProjectId` 与 `syncProjects(projects)`；快照类型由 `src/types/projectTeam.ts` 定义，显示与授权共用。

- [x] 新增失败行为测试：已存在角色授予编辑、角色管理、导出、资源编辑时，团队成员仍为 false，查看为 true；管理员例外。
- [x] 实现按工号映射登录身份的 Mock 团队和项目来源关联；成员集合不从角色名称推断。使用专门演示身份避免无关既有场景被种子数据改写。
- [x] 新建/恢复/删除项目时更新对应快照；入口、与我有关筛选和 `hasPermission`/`useHasPermission`/角色管理执行检查共用身份。
- [x] 执行 `node scripts/verify-project-team-access.mjs`，覆盖未知身份、同名、不同项目、子项目、角色/部门叠加、来源移除及刷新；修复并通过。
- [x] 独立代码审查及必要修复。

## Task 2: 团队 UI 与职责权限补齐

**Files:** 新增 `src/components/project-team/ProjectTeam.tsx` 和 CSS module；修改 `src/containers/ProjectSpaceContainer.tsx`、`src/components/permission/ProjectSpaceAccessBoundary.tsx` 及实际发现的计划/转维职责校验入口。

**Consumes:** Task 1 的团队 store、`isProjectTeamMember` 与 `useIsProjectTeamMember`；只读判定为 `isProjectTeamMember(actor, scope) && !isGlobalAdmin(actor)`。

- [x] 实现窄角色树、角色与成员搜索、姓名/工号/角色/直属部门/邮箱/价值交付表格、空态、Mock 标识与刷新；不提供增删编辑外部团队操作。
- [x] 接入项目空间“团队”，界面状态按项目重置；技术子项目使用既有父项目权限作用域。
- [x] 已有全局权限缓存可能没有新演示账号：Header 为团队成员展示“我的团队项目”快捷入口，仅包含本人团队项目；入口不依赖全局菜单授权，不覆盖保存的全局授权或授予额外菜单权限。没有全局菜单时空态提示使用这个入口。
- [x] 补充独立职责路径的失败测试，再统一拦截维护/发布/实际进度/转维处理等写入，不影响阅读。
- [x] 在权限人员配置处说明团队成员固定只读，避免界面勾选让用户误认为可提升其权限。
- [x] 运行聚焦行为检查、类型检查；进行桌面与窄屏浏览器交互验证并修复。
- [x] 独立代码审查及必要修复。

## Task 3: 全量回归与交付

- [x] `npm run verify:full-regression`、`npx tsc --noEmit`、`npm run build`、`git diff --check` 全部通过。
- [x] 浏览器检查团队角色树、搜索、刷新、只读成员进入空间、角色与部门叠加、超级管理员、其他项目、全局权限中心和现有项目关键流程，记录错误日志与截图。
- [x] 独立全分支审查、修复发现的问题并重测受影响项。
- [ ] 更新 QA 实际结果，提交并推送 feature，核对本地和远端 SHA 一致，保持 localhost:3017 可预览。
