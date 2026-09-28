# Permission Center Role Views Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Execute continuously; user has authorized implementation, full testing, commit and feature-branch push.

**Goal:** Move personnel authorization to roles, show functional grants as a matrix, keep scoped data editing, and add a read-only effective-person view.
**Architecture:** v2 role membership plus menu policies, shared evaluator for UI and enforcement, compact Ant Design components in the existing isolated feature worktree.
**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand.
**Spec:** docs/superpowers/specs/2026-09-28-permission-center-role-views-design.md

## Global Constraints

Preserve unrelated work and project-space state. Only fixed system superadmin bypasses grants. Immediate atomic persistence, fail-closed corrupt cache, edit guards, existing permission chip styles and hidden HR menus remain. No backend authorization claims. Root coordinates commits/build/browser; implementers do not commit, push, run the full suite, or alter each other's files.

## Review Focus

Role membership must be authoritative for every menu. No old menu-user fallback in v2. Read-only person view must show actual evaluator results. Preserve complete per-role data policies and required fields. One-time valid-old-model seed refresh must never turn invalid snapshots into privileged defaults. Parent row spans must use full ancestor paths. No clipped narrow-screen actions or lost draft guards.

### Task 1: Role-based domain, clean mock initialization and behavioral regression

Own src/types/permissionCenter.ts, src/constants/permissionCenter.ts (and new seed module if needed), src/lib/permissionCenter.ts, src/stores/permission.ts and permission-center regression scripts. Do not edit UI components.

1. Establish failing meaningful tests for role-level users/departments across menus, union/revocation, seed refresh and corrupt persistence.
2. Change runtime model to version 2. Add required role.departments; remove users/departments from MenuPolicy. Export `isRoleAssignedToUser(role, user): boolean` and `getAssignedPermissionUsers(model): string[]`. Store action `setCenterRoleAssignees(actor, roleId, { users: string[], departments: string[] }): PermissionMutationResult` atomically edits both lists. Retain superadmin setter as appropriate; protect last superadmin and invalid identities.
3. Evaluate all menu grants from matching role membership. Preserve safe row/column union and project-space fallback semantics. Ensure v2 unknown/orphan/invalid policies cannot grant.
4. Refresh recognized valid v1/mock snapshots once into explicit seeded v2 roles, with no compat role/group. Preserve project slots and v2 custom configurations. Preserve corrupt-cache fail-closed behavior and pre-v3 project-only migration boundary if storage version increments.
5. Update existing meaningful fixture tests to model v2, keep genuine old-model tests. Run all permission-center focused scripts. Report files, commands and concerns.

### Task 2: Role/person workspace and functional/data panels

Own src/components/permission-center/** (including new small components and CSS). Do not edit Task 1 files or its scripts. Consume the exact API specified above.

1. Add role/person view segmented switch matching ProjectManagementContainer `pms-project-management__view-mode`; remove visible role group title. Preserve narrow collapsible left sidebar and role CRUD.
2. Move 授权人员/授权部门 selectors to role header area (one form per role), immediate atomic updates, explicit labels/search, validation/failure feedback. Superadmin only-person assignment remains protected. No per-menu assignments.
3. Add 功能权限 / 数据权限 content tabs. Functional table displays all configurable menus, parent hierarchy merged using full-path row spans; leaf menu actions individually checkable with evaluator normalization. Builtin all checked/disabled. Do not show HR menus.
4. Data panel keeps embedded narrow left tree only for data-capable menus and existing condition/column editor. Preserve pending-condition retry/guard semantics. Refactor old PolicyEditor to data-only responsibility.
5. Person sidebar lists deduplicated directly/dept assigned users, search and selection. Show effective functional grants read-only and source roles; data menu shows complete source role policies as read-only scopes with clear union semantics. Handle no grants and superadmin.
6. Retain responsive behavior, compact spacing, displayable empty/error states, live reevaluation on assignments, drafts guarded across all navigation. Run available focused UI/static checks and report.

### Task 3: Integrated review and full verification

Root collects task reviews, coordinates fixes, runs full regression, TypeScript and production build, updates preview on localhost:3017, performs browser workflows including role/person view, role members/departments across menus, action edits, data filters/columns, persistence/revocation, superadmin/read-only and narrow layout. Save QA evidence and final review report. After passing, commit only this feature work and push origin codex/feature-permission-config, verify remote SHA equality.
