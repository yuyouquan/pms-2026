# Project List Calendar and Technical Plan Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved project-list three-view refinement and make technical-project plans use the same task-table presentation and operations as whole-machine plans.

**Architecture:** Keep one filtered project-list data pipeline for card, list, calendar, counts, and “关于我的”. Extract the whole-machine task table into a shared adapter-driven plan component and connect both the existing plan store and the independent technical-plan store without merging their version data.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, dnd-kit, Node contract scripts.

---

## File structure

- `src/lib/projectListFilters.ts` — pure category/status/about-mine/filter/count selectors.
- `src/components/project-list/ProjectListCalendar.tsx` — calendar rendering over already-filtered rows.
- `src/containers/ProjectListContainer.tsx` — one toolbar and one filtered result for all three views.
- `src/components/project-summary/ProjectSummaryTable.tsx` — fixed identity-column width contract.
- `src/components/shared/SortableColumnSettings.tsx` — shared column search.
- `src/stores/project.ts` — persisted `list | card | calendar` view mode.
- `src/components/technical-project/TechnicalProjectInformationView.tsx` — subproject plan/basic-information grouping.
- `src/components/technical-project/TechnicalPlanModule.tsx` — technical adapter and version/domain operations only.
- `src/components/plans/PlanTaskTable.tsx` — shared vertical plan task table.
- `src/components/plans/PlanWorkspaceShell.tsx` — stable shared toolbar shell.
- `src/containers/ProjectSpaceContainer.tsx` — whole-machine adapter into `PlanTaskTable`.
- `src/stores/technicalPlan.ts` — technical column-settings migration including required sequence column.
- `scripts/verify-project-list-refinement.mjs` — executable project-list contract.
- `scripts/verify-plan-task-table-parity.mjs` — executable shared plan-table contract.

### Task 1: Lock the project-list refinement contract

**Files:**
- Create: `scripts/verify-project-list-refinement.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing contract**

Create assertions that require `ProjectListViewMode` to contain `list`, `card`, and `calendar`; require one selector to expose `filterProjectsForList`, `countProjectsByCategory`, and `matchesAboutMine`; require the view switch order `list → card → calendar`; and require the labels `二级分类`, `项目状态`, and `关于我的`.

```js
assert.match(projectStore, /'list'\s*\|\s*'card'\s*\|\s*'calendar'/)
assert.match(projectList, /value:\s*'list'[\s\S]*value:\s*'card'[\s\S]*value:\s*'calendar'/)
for (const token of ['二级分类', '项目状态', '关于我的']) assert.match(projectList, new RegExp(token))
for (const fn of ['filterProjectsForList', 'countProjectsByCategory', 'matchesAboutMine']) assert.match(filters, new RegExp(`export function ${fn}`))
```

- [ ] **Step 2: Run the contract and confirm failure**

Run: `node scripts/verify-project-list-refinement.mjs`

Expected: FAIL because the calendar mode, shared selector, and about-mine control do not exist.

- [ ] **Step 3: Add the npm verification command**

Add `verify:project-list-refinement` to `package.json` and make it execute the new script.

- [ ] **Step 4: Commit the failing contract**

```bash
git add scripts/verify-project-list-refinement.mjs package.json
git commit -m "test: define project list refinement contract"
```

### Task 2: Implement the shared project-list filter pipeline

**Files:**
- Create: `src/lib/projectListFilters.ts`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/stores/project.ts`
- Test: `scripts/verify-project-list-refinement.mjs`

- [ ] **Step 1: Add pure status and permission selectors**

Implement the approved buckets and permission membership rule:

```ts
export type AggregateProjectStatus = 'all' | 'inProgress' | 'completed'
export const IN_PROGRESS_STATUSES = new Set(['待立项', '规划中', '在研', '进行中', '待验'])
export const COMPLETED_STATUSES = new Set(['已完成', '上市', '转维', 'EOS', '已迁移'])

export function matchesAboutMine(projectId: string, user: string, rolesByProject: RolesByProject) {
  return Object.values(rolesByProject[projectId] || {}).some(role => role.members.includes(user))
}
```

- [ ] **Step 2: Add one filter input and one result**

`filterProjectsForList` must apply visibility, about-mine, category, secondary/type, aggregate status, quick filters, and advanced filters in that order. Technical subprojects inherit the parent TDT permission id.

- [ ] **Step 3: Extend persisted view mode safely**

Change the project store type and setter to `list | card | calendar`. Normalize unknown persisted values to `list` while preserving `card` and `list`.

- [ ] **Step 4: Connect cards and tables to the same rows**

Remove separate card-only filtering. Derive card pagination, table rows, calendar rows, and active-category count from the same memoized filter result.

- [ ] **Step 5: Add the compact category/status controls**

Render labels `二级分类` and `项目状态`; tOS gets `二级分类：全部`; tOS and technical categories get `全部 / 进行中 / 已完成`; technical project type has only `TDT项目 / 子项目`; add default-checked `关于我的` at the end of quick filters.

- [ ] **Step 6: Run the contract**

Run: `node scripts/verify-project-list-refinement.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/projectListFilters.ts src/containers/ProjectListContainer.tsx src/stores/project.ts scripts/verify-project-list-refinement.mjs
git commit -m "feat: unify project list filters and counts"
```

### Task 3: Finish project-list UI, fixed columns, and column search

**Files:**
- Create: `src/components/project-list/ProjectListCalendar.tsx`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/components/shared/SortableColumnSettings.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-list-refinement.mjs`

- [ ] **Step 1: Add the three-item capsule switch**

Render `列表视图`, `卡片视图`, `日历视图` in that order, with one white selected segment in a stable rounded container. Remove the old header project-name search and keep the compact add-project button.

- [ ] **Step 2: Add the filtered calendar view**

Build month navigation and a Sunday-to-Saturday grid. Create events only for rows with valid milestone dates, label them `节点名称 · 项目名称`, show four per day, and route technical subproject events through the parent TDT with the target subproject session key.

- [ ] **Step 3: Fix whole-machine identity columns**

Use constants for product-series and project-name widths in the column definition, colgroup, fixed cells, and group renderer. Apply `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` to series names and zero out Ant measurement rows.

- [ ] **Step 4: Add column search once**

Add a local `searchText` to `SortableColumnSettings`; reset it on open; filter definitions by normalized title; show `未找到匹配列` without mutating order or visibility.

- [ ] **Step 5: Stabilize the toolbar**

Use one minimum height across categories, compact 32px controls, `maxTagCount={1}`, non-wrapping tags, and matching filter/column buttons.

- [ ] **Step 6: Run project-list contracts**

Run:

```bash
node scripts/verify-project-list-refinement.mjs
node scripts/verify-project-list-matrix.mjs
node scripts/verify-workbench-project-list.mjs
```

Expected: all commands print their passed messages.

- [ ] **Step 7: Commit**

```bash
git add src/components/project-list/ProjectListCalendar.tsx src/containers/ProjectListContainer.tsx src/components/project-summary/ProjectSummaryTable.tsx src/components/shared/SortableColumnSettings.tsx src/styles/globals.css
git commit -m "feat: add filtered project calendar and compact toolbar"
```

### Task 4: Align technical create/edit and information grouping

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/components/technical-project/TechnicalProjectInformationView.tsx`
- Modify: `src/lib/technicalProjectRules.ts`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Update technical form rules**

Always render `前置项目` as optional, remove the `IPM 同步` badge, require a four-digit `项目年份`, and stop clearing predecessor data when the IPM project changes.

- [ ] **Step 2: Update core information**

Remove predecessor from the technical core card while keeping project name, secondary category, track, TMG/domain, subdomain, stage, year, and the full-width value row.

- [ ] **Step 3: Group subproject plan and basic information**

For TDT tabs render only plan information in the combined card. For subproject tabs render plan information followed by subproject basic information inside the same outer card; leave team and deliverables outside.

- [ ] **Step 4: Run technical-project contracts**

Run: `node scripts/verify-technical-project.mjs`

Expected: `technical project checks passed`.

- [ ] **Step 5: Commit**

```bash
git add src/containers/ProjectListContainer.tsx src/components/technical-project/TechnicalProjectInformationView.tsx src/lib/technicalProjectRules.ts scripts/verify-technical-project.mjs
git commit -m "feat: refine technical project information flow"
```

### Task 5: Lock the shared plan task-table contract

**Files:**
- Create: `scripts/verify-plan-task-table-parity.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing parity assertions**

Require `PlanTaskTable.tsx`; require both whole-machine and technical modules to import it; require required sequence/task columns; and forbid technical-only `baseColumns` or the `阶段` tag.

```js
assert.match(shared, /序号[\s\S]*任务名称[\s\S]*责任人[\s\S]*状态[\s\S]*进度/)
assert.match(whole, /import\s*\{\s*PlanTaskTable\s*\}/)
assert.match(technical, /import\s*\{\s*PlanTaskTable\s*\}/)
assert.doesNotMatch(technical, /const baseColumns/)
assert.doesNotMatch(technical, />阶段<\/Tag>/)
```

- [ ] **Step 2: Run and confirm failure**

Run: `node scripts/verify-plan-task-table-parity.mjs`

Expected: FAIL because the shared task table does not exist.

- [ ] **Step 3: Commit the failing contract**

```bash
git add scripts/verify-plan-task-table-parity.mjs package.json
git commit -m "test: define shared plan table parity"
```

### Task 6: Extract the whole-machine plan task table

**Files:**
- Create: `src/components/plans/PlanTaskTable.tsx`
- Create: `src/lib/planTaskTable.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/plans/PlanWorkspaceShell.tsx`
- Test: `scripts/verify-plan-task-table-parity.mjs`

- [ ] **Step 1: Define the shared adapter**

Create a task record with id, parentId, taskName, responsible, predecessor, plan/actual dates, duration, status, and progress. The adapter supplies update, replace, add root, add child, delete cascade, reorder, actual-date update, permission checks, maximum depth, invalid-date reasons, collapsed ids, and column settings.

- [ ] **Step 2: Move hierarchy and column renderers**

Move sequence, task name, responsible avatar, predecessor tag, plan validation, actual-date editing, status tag, progress bar, fixed operation column, edit notice, dnd rows, and full-width add footer into `PlanTaskTable`.

- [ ] **Step 3: Preserve whole-machine semantics**

Connect the existing whole-machine task arrays and permission predicates through the adapter. Keep level-one max depth two, level-two max depth three, row-responsible editing, follow-readonly restrictions, and existing actual-date callbacks.

- [ ] **Step 4: Run existing plan checks**

Run:

```bash
node scripts/verify-plan-task-table-parity.mjs
node scripts/verify-plan-interactions.mjs
npx tsc --noEmit
```

Expected: parity and plan interaction checks pass; TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/plans/PlanTaskTable.tsx src/lib/planTaskTable.ts src/components/plans/PlanWorkspaceShell.tsx src/containers/ProjectSpaceContainer.tsx
git commit -m "refactor: extract shared plan task table"
```

### Task 7: Connect technical plans to the shared table

**Files:**
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `src/stores/technicalPlan.ts`
- Modify: `src/lib/technicalPlanWorkspace.ts`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-plan-task-table-parity.mjs`
- Test: `scripts/verify-technical-plan.mjs`
- Test: `scripts/verify-technical-plan-operations.mjs`

- [ ] **Step 1: Add technical column migration**

Bump `TECHNICAL_PLAN_STORE_VERSION`; normalize stored settings to include non-hideable `id` before `taskName`; preserve existing order and visibility for all other columns.

- [ ] **Step 2: Replace the technical table renderer**

Delete technical `baseColumns`, vertical table Dnd wrapper, and phase-tag rendering. Supply the technical store callbacks, max depth, filters, collapse state, invalid-date map, and permissions to `PlanTaskTable`.

- [ ] **Step 3: Align technical toolbar states**

Use the same version labels, draft controls, utility order, button sizing, disabled positioning, and view switch as the whole-machine workspace. Keep formal/nonformal revision choices and technical-specific scope tabs.

- [ ] **Step 4: Preserve technical domain operations**

Keep keyed TDT/subproject versions, subproject configuration gates, technical import/export/share query, TDT depth two, and subproject depth one.

- [ ] **Step 5: Run technical-plan contracts**

Run:

```bash
node scripts/verify-plan-task-table-parity.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-technical-plan-operations.mjs
npx tsc --noEmit
```

Expected: all checks pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/technical-project/TechnicalPlanModule.tsx src/stores/technicalPlan.ts src/lib/technicalPlanWorkspace.ts src/styles/globals.css scripts/verify-plan-task-table-parity.mjs
git commit -m "feat: align technical plans with shared workspace"
```

### Task 8: Full verification and release-ready commit

**Files:**
- Modify only files needed to fix discovered regressions.

- [ ] **Step 1: Run all focused contracts**

```bash
node scripts/verify-project-list-refinement.mjs
node scripts/verify-project-list-matrix.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-technical-project.mjs
node scripts/verify-plan-task-table-parity.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-technical-plan-operations.mjs
```

Expected: every script prints a passed message.

- [ ] **Step 2: Run repository gates**

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Expected: TypeScript and build exit 0; diff check has no output.

- [ ] **Step 3: Browser-check project list**

At desktop widths 1440 and 1920, verify list/card/calendar order, stable toolbar height, filters and counts, about-mine default, all category states, column search, whole-machine fixed columns, and calendar event navigation.

- [ ] **Step 4: Browser-check technical plans**

Compare whole-machine and technical TDT/subproject pages in published and draft states. Verify toolbar control order, sequence/task/action fixed columns, matching row/header alignment, hierarchy, drag constraints, add child/root, delete cascade, date validation, status/progress, revision operations, import/export/share, and all three views.

- [ ] **Step 5: Commit verification fixes**

```bash
git add src scripts package.json
git commit -m "fix: close project list and plan parity regressions"
```
