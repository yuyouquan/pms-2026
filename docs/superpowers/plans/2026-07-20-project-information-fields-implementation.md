# Project Information Fields Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Quickly deliver the approved whole-machine and tOS project-information iteration without reducing the requested field or interaction scope.

**Architecture:** One declarative field schema drives create/edit/display. Project business values use a backward-compatible `fieldValues` extension; field-display preferences use a repository interface with a mock `localStorage` implementation. Reusable modal/section components keep the existing workspace and project-space containers focused on orchestration.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4.

**Fast-delivery verification:** Per user direction, skip per-rule test scripts and broad browser matrices. Keep compilation safety (`npx tsc --noEmit`, `npm run build`) and one focused browser smoke covering the main create/edit/visibility/market paths. Fix observed problems directly.

---

## Task 1: Add schema, values, rules, and visibility persistence

**Files:**

- Modify: `src/types/app.ts`
- Create: `src/constants/projectInfoSchema.ts`
- Create: `src/lib/projectInfoValues.ts`
- Create: `src/lib/projectInfoRules.ts`
- Create: `src/lib/projectFieldPreferences.ts`
- Create: `src/hooks/useProjectFieldVisibility.ts`

### Steps

1. Add `ProjectInfoValues` and `fieldValues` to `ProjectItem`, plus typed market metadata fields.
2. Define the exact approved whole-machine groups (21 basic, 13 extended, 7 team) and tOS groups (7 basic, 19 team), including required/default-visible/hideable/read-only/conditional metadata.
3. Add legacy read/write mappings for existing root fields such as `developMode`, `spm`, `versionFiveRoles`, and `jiraProjects`.
4. Add derivation/validation helpers for external project data, conditional ODC/external-research fields, tOS first-launch aggregates, and inactive-value cleanup.
5. Add the production repository contract and mock localStorage adapter keyed by user/project/group.
6. Add a client-safe hook that reconciles saved keys with schema defaults/fixed fields.
7. Run `npx tsc --noEmit` and fix type errors immediately.
8. Commit: `feat: add project information schema and preferences`.

## Task 2: Build and integrate the shared create/edit modal

**Files:**

- Create: `src/components/project-info/ProjectInfoFieldInput.tsx`
- Create: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/stores/project.ts`
- Modify: `src/data/externalProjectPool.ts` only when source mocks lack required derivation values
- Modify: `src/styles/globals.css`

### Steps

1. Build schema-to-AntD inputs, including people, booleans, dates, searchable free-entry fields, multiselect first-launch projects, and read-only derived values.
2. Build one large, scrollable modal with universal fields first and target-type groups below; edit mode locks name/type and pre-fills all values.
3. Validate all creation-required fields, automatically reveal the first error group, clear inactive conditional values, and protect dirty close/type switches.
4. Keep non-target project creation on the current three-field behavior.
5. On submit, preserve responsibility-to-project-member/system-admin behavior and existing tOS `Full` type initialization.
6. Add an atomic typed project update action to the Zustand store.
7. Run `npx tsc --noEmit`.
8. Commit: `feat: collect complete project information`.

## Task 3: Replace target project-space information display and editing

**Files:**

- Create: `src/components/project-info/FieldVisibilityPicker.tsx`
- Create: `src/components/project-info/ProjectInfoSections.tsx`
- Create: `src/components/project-info/TargetProjectInformationView.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`

### Steps

1. Render the fixed `核心板块` for whole-machine and tOS projects.
2. Render the exact approved collapsible groups, default-collapsed, with visible-field count and role cards for people fields.
3. Add the right-side visibility picker; fixed fields remain checked/disabled, conditional inactive fields remain configurable, and choices persist per user/project/group.
4. Open the shared edit modal from the existing permission-gated edit action and update both selected/list project records.
5. When responsibility changes, update project visibility membership and `系统管理员` only; do not synchronize it from SPM/version project manager.
6. Rename the target anchor to `核心板块`; leave non-target rendering unchanged.
7. Run `npx tsc --noEmit`.
8. Commit: `feat: update target project information workspace`.

## Task 4: Update whole-machine market metadata and vertical editor

**Files:**

- Modify: `src/lib/marketRules.ts`
- Create: `src/components/project-info/MarketEditorModal.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`

### Steps

1. Extend `MarketConfigRow` with Google Launch Date, carrier customization, SIM lock, cancellation/pause, cancellation/pause date, and MADA control while preserving plan-follow semantics.
2. Replace the horizontal market editor table with a vertical form/card layout.
3. Clear cancellation/pause date when cancellation/pause is false.
4. In plan information, remove `上市时间` and show the six new selected-market fields.
5. Remove the complete `硬件配置` subsection while retaining branch, Jenkins, and version links.
6. Run `npx tsc --noEmit`.
7. Commit: `feat: expand whole machine market metadata`.

## Task 5: Fast final gate and focused smoke

**Files:**

- Modify implementation files only for issues found

### Steps

1. Run `npx tsc --noEmit`.
2. Run `npm run build`.
3. Start the app on port 3014 and perform one focused smoke pass:
   - whole-machine create fields and required validation;
   - tOS first-launch aggregation and complete team fields;
   - edit prefill/save;
   - collapsed groups and per-user visibility after reload;
   - vertical market metadata edit and updated plan/config display.
4. Fix observed blocking or obvious visual issues directly, then rerun only the affected path.
5. Re-run `npx tsc --noEmit` and `npm run build` once.
6. Commit final fixes only if needed and report the branch plus verification results.
