# Project List Calendar, Filter, and Field Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved project-list toolbar order, compact active-filter chips, redesigned monthly calendar, and one shared field-settings experience across every table surface.

**Architecture:** Keep `AnyFilterCondition[]` and `SortableColumnSettingsValue` as the single state sources. Add a focused active-condition summary component, let `ProjectSummaryTable` portal that summary beside its existing toolbar actions, and update the shared column-settings component once so all consumers inherit the new behavior. Keep calendar rendering isolated in `ProjectListCalendar`.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, dnd-kit, Zustand, Day.js, source-contract verification scripts.

---

### Task 1: Active filter condition summary

**Files:**
- Create: `src/components/project-list/ActiveFilterConditions.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-list-refinement.mjs`

- [ ] **Step 1: Write failing source-contract assertions**

Add assertions that require an `ActiveFilterConditions` component, `+N` overflow text, `aria-expanded`, immediate condition removal, a dedicated filter-summary portal host, and the absence of the old `pms-project-list-field-filters` controls in `ProjectListContainer`.

- [ ] **Step 2: Run the contract test and verify failure**

Run: `npm run verify:project-list-refinement`

Expected: FAIL because the active-condition component and portal host do not exist.

- [ ] **Step 3: Implement the active-condition component**

Create a component with this public contract:

```ts
type ActiveFilterConditionsProps = {
  conditions: readonly AnyFilterCondition[]
  definitions: readonly FilterFieldDefinition[]
  onEdit: (conditionId: string) => void
  onRemove: (conditionId: string) => void
}
```

Normalize active conditions, format field/operator/value labels, use a `ResizeObserver` to calculate the number of chips that fit before the `+N` and expand button, and expose expand/collapse through `aria-expanded`.

- [ ] **Step 4: Connect it to the existing filter state**

Extend `ProjectSummaryTable` with `filterSummaryHost?: HTMLElement | null`. Portal the summary into that host, open the existing filter panel when a chip is clicked, and remove a condition through the existing controlled/uncontrolled `setFilters` path. In `ProjectListContainer`, replace the old quick-filter input/select rows with the summary host and keep “关于我的” as an independent right-aligned checkbox row.

- [ ] **Step 5: Run the focused test**

Run: `npm run verify:project-list-refinement && npm run verify:floating-panels`

Expected: both contract suites pass.

### Task 2: Toolbar order and icon-only add action

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Write failing toolbar assertions**

Assert the view options occur in `list`, `calendar`, `card` order; the action host appears after the view switch; the fullscreen action is before the add action; and the add button has an icon and accessible label but no visible “新增项目” text.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm run verify:workbench-list`

Expected: FAIL on view order and add-button content.

- [ ] **Step 3: Implement the approved toolbar structure**

Move the existing toolbar portal host into the category-row action group. Render action order as filter, field settings, conditional fullscreen, then icon-only add. Preserve permission gating and existing full-screen behavior.

- [ ] **Step 4: Run toolbar regression tests**

Run: `npm run verify:workbench-list && npm run verify:compact-ui-density`

Expected: both suites pass.

### Task 3: Monthly calendar redesign

**Files:**
- Modify: `src/components/project-list/ProjectListCalendar.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-list-refinement.mjs`

- [ ] **Step 1: Add failing calendar assertions**

Require Monday-first weekdays, month-day formatting for every first day, a today marker class, a month-only mode indicator, three visible events, and “还有 N 条记录” overflow copy.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm run verify:project-list-refinement`

Expected: FAIL because the current calendar starts on Sunday and formats every date as `D日`.

- [ ] **Step 3: Implement month calendar behavior**

Build the 42-day range from `startOf('isoWeek')` semantics without adding a plugin: derive the Monday offset from `month.startOf('month').day()`. Format `day.date() === 1` as `M月D日`, render today with a blue circular marker, show three event strips, and use the approved overflow copy.

- [ ] **Step 4: Implement compact UI styling**

Align the toolbar and weekday grid with the supplied UI, use light-blue event strips, retain a six-row viewport-fit grid, and make adjacent-month dates visually muted.

- [ ] **Step 5: Run calendar and matrix tests**

Run: `npm run verify:project-list-refinement && npm run verify:project-list-matrix`

Expected: both suites pass.

### Task 4: Shared field-settings redesign

**Files:**
- Modify: `src/components/shared/SortableColumnSettings.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-sortable-column-settings.mjs`

- [ ] **Step 1: Write failing shared-component assertions**

Require title “选择要显示的字段”, “重置默认”, search placeholder “搜索字段”, required badge “必显”, eye/eye-invisible actions, immediate apply, no footer actions, and draggable required fields.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm run verify:column-settings`

Expected: FAIL on title, row structure, icon visibility control, and fixed-row drag disabling.

- [ ] **Step 3: Implement row interaction**

Remove checkbox controls and fixed-row drag disabling. Render drag handle, title, optional required badge, and a right-side visibility button using `EyeOutlined` / `EyeInvisibleOutlined`. Disable visibility changes for `hideable === false`, but keep those rows sortable.

- [ ] **Step 4: Apply the approved floating-panel structure**

Set the shared title, danger-tinted reset action, compact search field, scrollable row list, hidden-row text treatment, and immediate `onApply` behavior. Keep `footer={null}`.

- [ ] **Step 5: Run shared field-setting tests**

Run: `npm run verify:column-settings && npm run verify:floating-panels`

Expected: both suites pass and all consumers still import the shared component.

### Task 5: Full verification and browser acceptance

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Run repository contract suites**

Run:

```bash
npm run verify:project-list-refinement
npm run verify:workbench-list
npm run verify:compact-ui-density
npm run verify:column-settings
npm run verify:floating-panels
npm run verify:project-list-matrix
npm run verify:technical-project
npm run verify:technical-plan
npx tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Exercise the UI in the browser**

Verify all project categories and all three views, filter-chip add/edit/delete/expand/collapse, independent “关于我的”, Monday-first calendar cells and first-day labels, icon-only add action, full-screen action visibility, and field settings from project list, roadmap, project space, config center, and share-plan surfaces.

- [ ] **Step 3: Commit the implementation**

```bash
git add scripts src docs/superpowers/plans/2026-08-07-project-list-calendar-filter-field-settings.md
git commit -m "feat: refine project list filters and field settings"
```

- [ ] **Step 4: Promote after fresh merged-result verification**

Fetch `origin`, push the verified feature result to `dev`, merge `origin/dev` into a clean worktree based on `origin/master`, rerun the full verification command, then push the verified merge result to `master`.
