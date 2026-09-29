# 项目空间权限角色视图

## Requirements and constraints

- 项目空间采用权限中心角色视图：窄且可收起的分组角色树，人员配置 / 功能权限两个页签，无数据权限。
- 人员和部门通过现有选择弹窗确认；页面只读展示，部门直属成员继承项目角色。部门授权只赋予权限，不改写项目团队职责字段。
- 功能权限使用菜单 / 操作两列，按项目实际模块筛选，不显示占位功能。勾选实时生效。
- 固定角色不能改名、删除；技术项目固定角色和整机 SPM 的直接人员继续由项目团队维护，tOS 固定角色直接人员保持双向同步。
- 本地 mock 权限保持项目隔离、当前会话校验、持久化与草稿离开保护。只沿用系统超级管理员全局豁免。
- 在现有 codex/feature-permission-config worktree 完成；不动主目录。完成测试后提交并推送该 feature 分支，不合并、不部署。

## Task 1: Project role domain and department inheritance

Owned files: src/stores/permission.ts, src/lib/projectListFilters.ts, new src/lib/projectRoleMembership.ts, related domain tests. May edit other non-UI permission consumers only when necessary; tell controller first.

Extend Role with optional departments:string[], groupName:string, description:string. Preserve old role objects when optional fields absent; normalize and persist supplied values. Add guarded atomic createProjectRole(actor, projectId, input), updateProjectRole(actor, projectId, roleName, input), deleteProjectRole(actor, projectId, roleName), setProjectRoleDepartments(actor, projectId, roleName, departments). input is CenterRoleInput. Return PermissionMutationResult, create/update result may carry roleId=role name. Validate trimmed/casefold duplicate names, required group/name, fixed role edits/deletes. Atomic rename must preserve grants and own manageRoles membership; delete removes orphan grants. Persistence failure must return error without applying state, following existing permission-center pattern. UI handles direct member tOS sync through existing project store; leave that behavior intact.

Implement shared roleAppliesToUser(role, user) matching direct members or a user's direct department from PERMISSION_USERS, unknown users fail closed. Apply it to hasPermission, useHasPermission, hasProjectRoleManagementAccess, project list visibility/entry, and other actual permission checks. Do not change fixed responsibility governance (technical lead, SPM, plan owner) into department-derived personnel. Departments survive team synchronization and role persistence migrations.

Write behavioral tests first (RED then GREEN): department inheritance and revocation, no cross-project/global escalation, project entry, guarded administration, atomic own-role rename, duplicate/fixed rejection, malformed storage/department handling, preservation through ensure/sync/reload. Run focused existing project-role/resource/global permission regression scripts. No subagents, no commit (controller coordinates commit after whole-feature testing).

## Task 2: Project role view and functional catalog

Controller owns new project permission UI/catalog, PermissionModule project implementation replacement, ProjectSpaceContainer integration and draft guards, UI/catalog regressions. Reuse RoleForm and AssigneePickerModal. Use metadata from Task 1; group absent fixed roles under 项目角色 and custom roles under 自定义角色. Create selects new role. No duplicate global permission logic. Scope catalog by projectSpaceNavigation and actual operations; explain fixed project responsibility rules for plan maintenance rather than showing ineffective grants.

## Task 3: Review and delivery

Independent task/domain review and final whole-change review. Run regression suite, type check, production build, local browser role CRUD, member/dept cancel/confirm and inheritance/revoke, actual restricted identity, fixed-role source, multiple project types, narrow screen, draft guard, persistence and runtime error inspection. Keep localhost:3017 available, record evidence, commit/push and verify remote SHA.
