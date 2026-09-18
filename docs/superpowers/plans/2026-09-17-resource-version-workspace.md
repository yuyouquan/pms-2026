# Resource Version Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver five resource tabs with page-based budget version editing, lock/unlock, exclusive activation, copying and selected-version views.
**Architecture:** Preserve the four typed HR stores and business forms; share lifecycle rules, expose embedded form/detail variants, and assemble a project-scoped version workspace. Monthly records belong to their version; activation filters aggregate consumers only.
**Tech Stack:** Next.js 14, React 18, Ant Design 6, Zustand 4, existing TypeScript module-loader verification scripts. No new runtime dependencies.
**Spec:** `docs/superpowers/specs/2026-09-17-resource-version-workspace-design.md`

## Global Constraints

- Fixed labels/order: 项目资源看板、年度预算、项目概算、项目预算、项目核算. First and last remain empty.
- One active version per project and budget type; zero is valid. New and copied versions are unlocked and inactive.
- Locked versions reject all content writes, batch edits, deletion and automatic synchronization; activation remains independent.
- Preserve project permissions, bound-budget readonly scope and formal-source readonly fields. Human investment stays 人月, expense stays 元.
- Work only in the existing feature worktree. No production deployment or shared branch push.
- Maintain current input fields, calculation rules and per-type phase definitions.

## Task 1: Version lifecycle, persistence and aggregate consumers

**Files:** `src/lib/hrVersionRules.ts`, `src/lib/hrProjectSync.ts`, `src/lib/hrMonthlySync.ts`, `src/stores/hr{Machine,Tos,Technical,Capability}.ts`, `src/types/hr{Machine,Tos,Technical,Capability}.ts`, `src/components/project-resources/HrResourceScope.tsx`, existing `src/components/hr-*/{HistoryVersionSpace,ProjectListTab,MonthlyInvestmentTab,MonthlyEditModal}.tsx`, new `scripts/verify-resource-version-lifecycle.mjs`.
**Produces:** `getActiveHrVersion(versions, budgetType)` and `isHrVersionEditable(project, version)`; version `isActive: boolean`, optional copied-source identity; all four stores expose `setVersionLocked(projectId, versionId, locked)`, `setVersionActive(projectId, versionId, active)`, `copyVersion(projectId, versionId)`.

- [ ] Write module-loader behavior assertions for all four stores, starting with `assert.equal(typeof store.getState().setVersionActive, 'function')`; run and capture expected missing-feature failure.
- [ ] Implement lifecycle helpers and idempotent migration. Preserve actual latest helper for numbering/default selection; use active helper for aggregate values only.
- [ ] Apply store-level write guards; all unlocked versions are editable. Locked snapshot survives refresh. Preserve monthly rows for all versions; activated filtering belongs to consumers.
- [ ] Implement source-isolated deep copying, preserving monthly allocations and fresh identity/creator/time. Locked-source copy is allowed; bound and associated write paths remain denied.
- [ ] Exercise two budgets, three versions, switching active, clearing active/rehydrating, locked batch/delete/monthly writes, unlocked history edits, copy isolation, model/plan refresh and actor permissions.
- [ ] Adapt existing list/monthly consumer gating and aggregates; label missing active state. Commit only task-owned files after focused validation.

## Task 2: Reusable embedded version forms and detail

**Files:** `src/components/hr-machine/{NewVersionModal,MachineVersionDetailModal}.tsx`, `src/components/hr-{tos,technical,capability}/{NewVersionModal,VersionDetailModal}.tsx`, new `src/components/project-resources/HrVersionSurface.tsx`; optional `HrVersionMilestones.tsx` adjustments if necessary.
**Consumes:** Task 1 lifecycle helper. **Produces:** Optional `embedded?: boolean`, `fixedBudgetType?: BudgetType` for new forms; optional `embedded?: boolean` for details; optional `onSaved?: () => void` separate from onCancel for all editable surfaces. Existing props remain compatible.

- [ ] Add focused render/source boundary verification asserting embedded surface exists and budget type cannot change when fixed; run expected failure.
- [ ] Create a small `HrVersionSurface` that renders existing Modal for legacy usage or semantic page section with save/cancel actions when embedded.
- [ ] Extract contents without changing input order or duplicating business form logic. For embedded new forms seed fixed budget and project correctly; hide the budget selector.
- [ ] Use unlocked checks instead of latest checks, ensure readonly detail never derives mutable values over a locked snapshot, and call onSaved after successful store writes only.
- [ ] Preserve detail project selection and all existing modal invocation contracts; validate typecheck after domain interface arrives, commit only owned files.

## Task 3: Resource workspace, version controls and monthly views

**Files:** `src/components/project-resources/ProjectResources.tsx`, new `ResourceVersionWorkspace.tsx`, `ResourceVersionViews.tsx`, `resourceVersionAdapter.ts`, `src/styles/globals.css`, focused `scripts/verify-resource-version-workspace.mjs`.
**Consumes:** Task 1 store lifecycle methods, Task 2 embedded components. **Produces:** Complete project resource page.

- [ ] Write structural/behavior tests for five labels and version-derived selected data; observe baseline failure before changes.
- [ ] Replace old estimate tab with five fixed tabs and empty dashboard/accounting. Keep project-scope provider and access guard.
- [ ] Render type-local version selection, badges, create/edit/copy/lock/unlock/activate/deactivate/delete/export actions. Respect project ownership and locked state.
- [ ] Mount the correct embedded new/editor/read detail for the selected category. Scope create to tab type; select created/copied version on success. Save/cancel clear edit guard, switching context uses navigateWithEditGuard.
- [ ] Read monthly records by selected version, filter only archived deleted department rows, show year filter, department matrix, unallocated total and accessible monthly trend. Use current amount units and no new chart dependency.
- [ ] Apply restrained existing-token CSS with horizontal table scrolling and responsive controls. Verify new/empty/readonly/editing/locked and no-active states.
- [ ] Commit owned files after focused verification.

## Task 4: Integration review and browser acceptance

**Files:** test scripts as required; `docs/superpowers/reports/2026-09-17-resource-version-workspace-validation.md`.

- [ ] Review each owned diff for spec compliance and quality, with focused fix/re-review for findings.
- [ ] Run `node scripts/verify-resource-version-lifecycle.mjs`, `node scripts/verify-resource-version-workspace.mjs` and affected existing resource checks; distinguish old latest-only assertions from real regressions.
- [ ] Run `npx tsc --noEmit` then `npm run build`, preserve logs; start isolated local server on an available port.
- [ ] In browser test all four types, three budget tabs, placeholders, create/edit/cancel/copy, lock protection, exclusive activation and zero activation after reload, associated readonly and edit navigation guard. Inspect console/runtime errors and screenshots.
- [ ] Perform whole-branch independent review and fix concrete issues. Report verified result, local preview and commit, with any actual limitations.
