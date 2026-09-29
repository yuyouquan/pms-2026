# Role templates and unified team permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver four project-type role templates, a unified 团队&权限 page, stable IPM role authorization, and parent/leaf bulk permission controls.

**Architecture:** Keep source identities separate from local role names. Persist project copies of template grants once, evaluate live IPM membership before local roles, and reuse the same functional permission presentation in projects and template modals. All multi-key mutations validate and persist atomically before publishing state.

**Tech Stack:** Next.js 14, React 18, Zustand, Ant Design, TypeScript, existing Node verification scripts.

**Spec:** `docs/superpowers/specs/2026-09-29-role-templates-team-permissions-design.md`

## Global Constraints

- IPM 成员按同步角色的功能权限生效，额外角色仍不能提升其权限。
- 全局权限中心与项目空间权限保持独立；只有固定系统超级管理员拥有全系统权限。
- 更新模板不追溯覆盖已有项目角色；重新打开页面、刷新团队、重新载入缓存均不能重置项目权限。
- 同步角色通过 IPM 编码匹配，不能仅凭名称误匹配。
- 一次批量操作只提交一次完整权限更新；重复出现的共享操作键先去重。
- 存储失败、无权限或目标中存在不可授权的无效策略时，整次批量操作失败并保持原状态。
- Keep compact existing PMS styling, Chinese labels, edit navigation guards, current-user/project revalidation, and business responsibility/version checks.
- Mock only. Do not connect real IPM or copy real personnel details. Work only in this feature worktree; push only the existing feature branch after verification.

## Review Focus

1. Same display name for different employee IDs or local/IPM roles must not share authorization (Task 1 behavior tests).
2. Explicitly empty project grants must survive template edits, repeated source sync and reload (Task 1 behavior tests).
3. Changing source binding or technical parent must invalidate stale source grants and callbacks (Task 1 behavior tests).
4. A multi-menu write failing halfway through validation/storage must publish no changes, including self-revoking management (Tasks 1 and 2 tests).
5. Search-filtered parent bulk actions still cover hidden descendants; readonly and stale sessions cannot execute them (Task 2 UI callback tests).

### Task 1: Templates, Mock sources and effective authorization

**Files:**
- Create focused role-template domain/types/store modules under `src/types/rolePermissionTemplate.ts`, `src/lib/rolePermissionTemplates.ts`, `src/stores/rolePermissionTemplates.ts`.
- Modify `src/types/projectTeam.ts`, `src/mock/projectTeam.ts`, `src/stores/projectTeam.ts`, `src/lib/projectTeam.ts`, `src/stores/permission.ts` for stable source role identity, one-time copies, local role preservation, effective evaluation and atomic APIs.
- Modify `src/lib/projectTeamMutationGuard.ts` and affected project, technical plan, resource, MR and transfer action guards only where the old fixed-readonly rule conflicts with the approved per-operation rule.
- Add behavioral verification in `scripts/verify-role-permission-templates.mjs`, `scripts/verify-synced-role-permissions.mjs`; update existing team verification for the new semantics while preserving its original security assertions.

**Interfaces:**
- Produce a typed four-type template model with stable row ID, roleName (the PMS role name), ipmRoleCode, pmsRoleCode, grants. User correction removes the redundant pmsRoleName field and column.
- Expose template create/update/delete/updateGrants operations taking the current actor and returning the existing `{ ok, error? }` result convention; validate the matching global `config.rolePermission:<type>` view/edit permission.
- Expose read-only synced role selectors scoped to the effective project and mutation APIs accepting stable source role identity; expose an atomic project multi-key toggle and an atomic global multi-menu action update. Report exact exported signatures for Task 2.
- Preserve `hasPermission(user, projectId, key)` / `useHasPermission` call signatures, local direct/department inheritance, and source membership hooks. IPM users resolve only their source role union except builtin superadmin.

- [ ] Write failing behavior tests using the existing TypeScript module loader and real stores. Pin type isolation, code uniqueness, same-name identity isolation, exact once initialization and explicit empty grants:
  ```js
  assert.equal(hasPermission(teamUser, projectId, 'basicInfo:编辑'), false);
  grantSyncedRole('basicInfo:编辑');
  assert.equal(hasPermission(teamUser, projectId, 'basicInfo:编辑'), true);
  assert.equal(hasPermission(teamUser, projectId, 'plan:二级计划-编辑'), false);
  revokeSyncedRole('basicInfo:编辑');
  grantLocalRoleOrDepartment('basicInfo:编辑');
  assert.equal(hasPermission(teamUser, projectId, 'basicInfo:编辑'), false);
  ```
- [ ] Run the new scripts and record expected RED before implementation.
- [ ] Implement source identities using source binding plus IPM role code. Keep source role definitions separate from mutable local names. Add four mock template sets, all-view defaults, multi-role and empty/unmapped roles, employee ID dedup and same-name/different-ID examples. Reuse existing demo identities where possible.
- [ ] Persist templates and project copies with schema validation and atomic storage failure handling; normalize permitted catalog keys by project type/attribute. Local legacy fixed roles become editable local roles without resetting their saved users/departments/grants or allowing old fixed-role sync to recreate deleted roles.
- [ ] Implement authority ordering and operation-key guards. Revalidate current actor/project at mutation time. A basic-info edit grant never releases L1 maintenance, MR, resource or transfer writes; existing responsibility conditions remain in force. Test source removal/rebind, parent scope, stale callbacks, multi-role union, superadmin and denied mutations.
- [ ] Add atomic bulk mutation APIs and prove no partial store/storage update when any target is invalid or storage fails. Verify readonly/self-revoke cases. Keep global menu view dependencies normalized.
- [ ] Run focused affected scripts and `npx tsc --noEmit`; full regression once before commit. Record integration failures owned by Task 2 explicitly rather than weakening assertions.
- [ ] Self-review, commit domain work and write report including exact APIs and RED/GREEN evidence.

### Task 2: Configuration and unified permission UI

**Files:**
- Create `src/components/permission/RolePermissionTemplateConfig.tsx` and a focused `ProjectTeamMembers.tsx` table component plus small CSS module if needed.
- Modify `src/lib/configNavigation.ts`, `src/constants/permissionCenter.ts` if needed, `src/containers/ConfigContainer.tsx` to register/mount four role-template entries.
- Modify `src/components/permission/ProjectPermissionConfig.tsx`, `ProjectRoleAssignees.tsx`, `ProjectFunctionalPermissions.tsx`, `projectPermissionCatalog.ts`, `ProjectPermissionConfig.module.css`, `src/components/permission-center/FunctionalMatrix.tsx`, `FunctionalPermissionsTable.module.css`.
- Modify `src/lib/projectSpaceNavigation.ts`, `src/containers/ProjectSpaceContainer.tsx` for merged navigation, team alias resolution and readonly unified page access. Remove obsolete standalone team UI only after references are gone.
- Add `scripts/verify-team-role-template-ui.mjs` exercising actual React handlers/store mutations; update affected existing UI tests for intentional copy and ordering changes.

**Interfaces:**
- Consume Task 1's reported typed template/source selectors and atomic mutations; inspect those declarations before integration.
- Extend `ProjectFunctionalPermissions` with `onBulkChange(keys: string[], enabled: boolean)` alongside `onChange(key, enabled)`. Deduplicate full catalog subtree keys, independent of search.
- All table/modal mutations use the atomic result and render a retryable error on failure; actor/project changes invalidate old callbacks.

- [ ] Write failing UI behavior tests for four nav entries, source/local role identity, first functional tab, source readonly people, parent/leaf bulk scope under search, denied/stale callbacks, and template modal reuse. Run and capture RED.
- [ ] Add template navigation and mapping CRUD table in order 角色名称 / PMS角色编码 / IPM角色编码 / 操作. Three fields required/trimmed, codes unique per type; first name already means PMS role name. 配置权限 opens a PMS-styled modal with the shared permission component and immediate saving. Gate view and edit separately.
- [ ] Merge team navigation, resolve old `team` state to `permission`, and let members read the unified page. Prefer source roles in the narrow tree, tag source identity, protect source deletion. Local same-name roles remain separate/selectable/editable/deletable. Default functional tab on entry/role changes/new role.
- [ ] Render source members with the exact columns `No. / 成员名称 / 工号 / 角色 / 价值交付 / 直属部门 / 人员邮箱`; dedup by employee ID, preserve same-name different IDs, search, name filter, name/employee sorting, empty states. Preserve local personnel/departments modal behavior; give ProjectRoleAssignees a disabled state for readonly visitors so configuration controls and any open picker become unavailable when management is revoked.
- [ ] Add parent and leaf 全选/取消权限 controls to project/template/global functional trees. Keep fold action separate, show full-subtree scope tooltip under search, disable readonly/superadmin/invalid targets. Use one atomic store operation per click:
  ```ts
  const keys = [...new Set(group.rows.flatMap(row => row.actions.map(action => action.key)))];
  onBulkChange(keys, enabled);
  ```
- [ ] Run focused scripts and typecheck, fix actual behavior rather than relax tests, self-review and commit. Write report with screenshot-independent functional evidence; root performs live desktop/narrow browser checks after build.

### Task 3: End-to-end verification and feature handoff

**Files:** `docs/qa/2026-09-29-role-templates-team-permissions.md` and related QA assets; product fixes go through their owning task implementer.

- [ ] Run `npm run verify:full-regression`, `npx tsc --noEmit`, `npm run build`; fix failures and repeat only affected checks plus final required gate when code changes.
- [ ] Restart the owned 3017 local preview on the new build. Use browser UI to configure templates, inspect all four types, verify initial source copies, switch source/local tabs, inspect members, configure people/departments, test parent/leaf bulk and search behavior, and read back after reload.
- [ ] Switch demo users and exercise actual project view/edit/export operations, revoked permissions, source-only ceilings, readonly unified page and superadmin. Inspect runtime error/warn logs. Check desktop and narrow layouts, dialogs and long personnel fields.
- [ ] Obtain broad final diff review; route findings to implementation owner, fix and rerun covering checks. Record exact test counts and limitations in QA doc.
- [ ] Commit final QA evidence, push `codex/feature-permission-config`, and verify local HEAD equals remote ref. Keep local preview available; do not merge or deploy production.
