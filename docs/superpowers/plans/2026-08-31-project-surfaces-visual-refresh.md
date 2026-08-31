# Project Surfaces Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the three approved project-space display issues and refresh the project card list, project table, project form modal, and project-space basic-information visuals without changing existing field order or behavior.

**Architecture:** Keep the current Zustand data model, Ant Design components, permissions, field projections, and drag-and-drop behavior. Express the three display corrections through existing schema projections and narrowly scoped render conditions, then apply a shared semantic CSS layer to existing surfaces instead of rebuilding components. Add focused source checks and real-browser acceptance so field order, horizontal headers, market summaries, drag ordering, and interaction regressions remain observable.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, CSS, Node verification scripts, Puppeteer.

---

## Scope Guardrails

- Preserve the dirty main checkout; all work happens in `.worktrees/mr-version-plan` on `codex/project-list-header-reorder`.
- Remove `TDT和子项目名称` only from the technical-project top core information cards. Do not remove its stored value, create/edit data model, subproject tab names, template labels, or project-list milestone labels.
- Hide the four dates only from machine-product and tOS project-space basic-information market summaries. Do not hide or disable dates in the plan tab, horizontal plan, revision, or actual-date editing flows.
- Preserve all non-requested field order, visibility settings, filter behavior, pagination, permissions, edit guards, fixed columns, and atomic milestone-group drag behavior.
- Do not introduce new packages, store keys, persistence keys, or mock-data schema changes.

## Task 1: Lock the Approved Display Contract in a Failing Verifier

**Files:**

- Create: `scripts/verify-project-surfaces-visual-refresh.mjs`
- Modify: `package.json`
- Modify: `scripts/verify-project-field-order-followup.mjs`
- Test: `scripts/verify-project-surfaces-visual-refresh.mjs`

- [ ] Add `verify:project-surfaces-visual-refresh` to `package.json`, running the new Node verifier.
- [ ] In the verifier, load the project schema and assert the exact technical core order:

  ```text
  secondaryCategory → technicalTrack → tmg → subdomain → status →
  projectStage → projectYear → preProjectId → projectValue
  ```

- [ ] Assert that `tdtAndSubprojectName` remains available to the data/create surfaces but is absent from `TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS` and `TECHNICAL_PROJECT_SPACE_CORE_FIELDS`.
- [ ] Assert that the technical subproject horizontal projection exposes a direct single-row milestone-header path and does not render the synthetic `子项目计划` stage in that mode.
- [ ] Assert that machine and tOS basic-information market summaries do not render `planStartDate`, `planEndDate`, `actualStartDate`, or `actualEndDate`, while plan surfaces still retain their date labels and editing code.
- [ ] Run the verifier and confirm it fails against the current implementation for the expected contract violations:

  ```bash
  npm run verify:project-surfaces-visual-refresh
  ```

  Expected: non-zero exit identifying the old core order, synthetic subproject header, or market-summary dates.

- [ ] Update only the old expected technical core projection in `scripts/verify-project-field-order-followup.mjs`; do not weaken its create/modal or unrelated project-space checks.
- [ ] Commit the red contract:

  ```bash
  git add package.json scripts/verify-project-surfaces-visual-refresh.mjs scripts/verify-project-field-order-followup.mjs
  git commit -m "test: define project surface refresh contract"
  ```

## Task 2: Correct the Technical Project Core Cards

**Files:**

- Modify: `src/constants/projectInfoSchema.ts`
- Modify: `src/components/technical-project/TechnicalProjectInformationView.tsx`
- Test: `scripts/verify-project-surfaces-visual-refresh.mjs`
- Test: `scripts/verify-project-field-order-followup.mjs`
- Test: `scripts/verify-technical-project.mjs`

- [ ] Change `TECHNICAL_PROJECT_SPACE_CORE_FIELDS` and `TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS` so `preProjectId` immediately follows `projectYear`, `projectValue` follows `preProjectId`, and `tdtAndSubprojectName` is absent.
- [ ] Remove now-unreachable core-card-only accent and rendering branches for `tdtAndSubprojectName` from `TechnicalProjectInformationView.tsx`, leaving create/edit data and subproject names untouched.
- [ ] Keep `projectValue` full-width behavior and confirm the reordered projection still uses the existing shared core-card renderer.
- [ ] Run focused verification:

  ```bash
  npm run verify:project-surfaces-visual-refresh
  npm run verify:project-field-order
  npm run verify:technical-project
  ```

  Expected: all pass; the new verifier must still fail only on tasks not yet implemented.

- [ ] Commit:

  ```bash
  git add src/constants/projectInfoSchema.ts src/components/technical-project/TechnicalProjectInformationView.tsx scripts/verify-project-field-order-followup.mjs
  git commit -m "fix: align technical project core information"
  ```

## Task 3: Flatten Technical Subproject Horizontal Headers

**Files:**

- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `src/components/technical-project/TechnicalPlanSummary.tsx`
- Test: `scripts/verify-project-surfaces-visual-refresh.mjs`
- Test: `scripts/verify-technical-plan.mjs`

- [ ] Introduce an explicit `technical-subproject` header branch in `TechnicalHorizontalPlanTable`: render `版本`, `开发周期`, and the first-level activity names in one header row when no tasks have parents.
- [ ] Keep the existing two-level colored stage/milestone header unchanged for TDT and all standard technical plans.
- [ ] Apply the same single-level header behavior to `TechnicalPlanSummary` so the project-space basic-information plan summary and the plan tab do not disagree.
- [ ] Preserve version selection, revision icon, editable date cells, actual row, development-cycle calculation, horizontal scrolling, and task IDs.
- [ ] Run:

  ```bash
  npm run verify:project-surfaces-visual-refresh
  npm run verify:technical-plan
  npm run verify:level1-flat-gantt
  ```

  Expected: all pass; no `子项目计划` group row in subproject horizontal tables and no change to standard plan headers.

- [ ] Commit:

  ```bash
  git add src/components/technical-project/TechnicalPlanModule.tsx src/components/technical-project/TechnicalPlanSummary.tsx
  git commit -m "fix: flatten technical subproject plan header"
  ```

## Task 4: Remove Market Summary Dates from Basic Information Only

**Files:**

- Create: `src/lib/projectBasicInfoPresentation.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Test: `scripts/verify-project-surfaces-visual-refresh.mjs`

- [ ] Add a small pure presentation helper that returns whether the latest-published L1 date summary belongs on a basic-information surface for a project type.
- [ ] Add unit-like source/runtime assertions covering at least:
  - machine product → hidden in basic information;
  - tOS version → hidden in basic information;
  - technical/capability → existing behavior retained;
  - plan views → date labels and editable cells remain present.
- [ ] Route both basic-information render call sites through the helper instead of deleting `renderLatestPublishedLevel1Summary` globally.
- [ ] Confirm market cards, market tab switching, main-market state, and plan data stores are unchanged.
- [ ] Run:

  ```bash
  npm run verify:project-surfaces-visual-refresh
  npm run verify:machine-tos
  npm run verify:level1-plan-governance
  ```

  Expected: all pass; the four summary labels are absent only on the approved basic-information surfaces.

- [ ] Commit:

  ```bash
  git add src/lib/projectBasicInfoPresentation.ts src/containers/ProjectSpaceContainer.tsx
  git commit -m "fix: hide market dates from project basic info"
  ```

## Task 5: Add the Shared Project-Surface Visual Layer

**Files:**

- Modify: `src/components/workspace/WorkspaceModule.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/project-info/ProjectInformationFrame.tsx`
- Modify: `src/components/project-info/CollapsibleInformationSection.tsx`
- Modify: `src/components/technical-project/TechnicalProjectInformationView.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-surfaces-visual-refresh.mjs`
- Test: `scripts/verify-liquid-glass-theme.mjs`

- [ ] Add stable semantic scope classes for the four target surfaces where an existing class is not sufficiently specific. Do not change event handlers, component keys, form bindings, or DnD data attributes.
- [ ] Define shared project-surface variables in `globals.css` for white surfaces, pale-purple grouped headers, border color, radius, shadow, compact spacing, hover/selected backgrounds, focus rings, and 150–250ms transitions.
- [ ] Refresh project cards while preserving card click navigation, project status tags, visible data, assignee, timestamps, and card/list switching.
- [ ] Refresh the project list table while preserving exact column order, fixed/sticky layering, hierarchy cells, horizontal scrolling, pagination, and whole `里程碑` group drag behavior.
- [ ] Refresh the add/edit project modal while preserving exact field projection, top-to-bottom order, required markers, dynamic visibility, validation, create/edit submission, cancel, and edit guard.
- [ ] Refresh project-space basic information while preserving core cards, plan container, section expansion, field configuration, edit controls, and permissions.
- [ ] Add `:focus-visible` states and a `prefers-reduced-motion: reduce` override scoped to the refreshed surfaces.
- [ ] Extend the static verifier to assert the semantic class hooks and bounded CSS selectors without asserting cosmetic pixel values too rigidly.
- [ ] Run:

  ```bash
  npm run verify:project-surfaces-visual-refresh
  npm run verify:liquid-glass
  npm run verify:project-summary
  npm run verify:workbench-list
  npm run verify:project-field-order
  npm run verify:project-list-header-reorder
  ```

  Expected: all pass; existing sticky/fixed-cell and drag contracts remain intact.

- [ ] Commit:

  ```bash
  git add src/components/workspace/WorkspaceModule.tsx src/components/project-summary/ProjectSummaryTable.tsx src/components/project-info/ProjectInfoModal.tsx src/components/project-info/ProjectInformationFrame.tsx src/components/project-info/CollapsibleInformationSection.tsx src/components/technical-project/TechnicalProjectInformationView.tsx src/styles/globals.css scripts/verify-project-surfaces-visual-refresh.mjs
  git commit -m "style: refresh project management surfaces"
  ```

## Task 6: Add Real-Browser Acceptance Coverage

**Files:**

- Create: `screenshots/verify-project-surfaces-visual-refresh-browser.mjs`
- Modify: `package.json`
- Test: `screenshots/verify-project-surfaces-visual-refresh-browser.mjs`

- [ ] Add `verify:project-surfaces-visual-refresh-browser` to `package.json`.
- [ ] Reuse the repository Puppeteer pattern and start from a clean browser state with a test-scoped `localStorage` reset.
- [ ] In card view, assert cards render, project status remains visible, card navigation remains clickable, and card/list switching still works.
- [ ] In list view, assert filters and pagination remain available, fixed cells remain opaque while scrolling, and existing project-list header drag instrumentation remains mounted.
- [ ] Open the project modal and assert representative fields retain their approved order and controls; cancel without mutating project data.
- [ ] Enter a technical project and assert the visible core label order, `前置项目` immediately after `项目年份`, and absence of the `TDT和子项目名称` core card.
- [ ] Open a technical subproject plan and assert the horizontal table has one activity header row without visible `子项目计划`, while version, cycle, revision/actual rows, and date cells remain.
- [ ] Enter representative machine and tOS projects and assert the four basic-information summary labels are absent while the plan tab still displays plan dates.
- [ ] Record console errors and unhandled page errors; fail on any application error introduced by the flow.
- [ ] Capture reference screenshots to a temporary/output directory ignored by Git for manual visual inspection.
- [ ] Run with the local production server:

  ```bash
  npm run build
  npm run start -- --port 3004
  BASE_URL=http://127.0.0.1:3004 npm run verify:project-surfaces-visual-refresh-browser
  ```

  Expected: browser verifier passes and produces screenshots for card, list, modal, technical basic info, subproject plan, machine basic info, and tOS basic info.

- [ ] Commit:

  ```bash
  git add package.json screenshots/verify-project-surfaces-visual-refresh-browser.mjs
  git commit -m "test: verify project surface refresh in browser"
  ```

## Task 7: Full Regression and Release-Ready Evidence

**Files:**

- Modify only if a regression reveals an in-scope defect.

- [ ] Run the complete focused suite:

  ```bash
  npm run verify:project-surfaces-visual-refresh
  npm run verify:project-surfaces-visual-refresh-browser
  npm run verify:project-field-order
  npm run verify:technical-project
  npm run verify:technical-plan
  npm run verify:machine-tos
  npm run verify:project-list-matrix
  npm run verify:project-list-refinement
  npm run verify:project-list-header-reorder
  npm run verify:level1-flat-gantt
  npm run verify:liquid-glass
  npx tsc --noEmit
  npm run build
  ```

- [ ] Review `git diff` and `git status` to confirm no generated screenshots, `.next`, local logs, unrelated fields, or user changes are included.
- [ ] Manually inspect the generated browser screenshots against the supplied references, specifically checking information hierarchy, compact density, purple grouping, white surfaces, no clipped labels, and no overlap in horizontal tables.
- [ ] If final cleanup was required, commit it separately:

  ```bash
  git add <only-in-scope-files>
  git commit -m "fix: close project surface refresh regressions"
  ```

- [ ] Report the exact passing commands, commit IDs, local preview URL, and any remaining release steps. Do not claim push, merge, Vercel deployment, or user acceptance without separate evidence.

