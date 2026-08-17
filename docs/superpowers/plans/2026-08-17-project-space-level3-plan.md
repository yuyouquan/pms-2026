# Project Space Level 3 Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the project-space secondary/overview plan tabs with an isolated Level 3 plan workbench for whole-machine and tOS-version projects, including two-level activities, rollups, permissions, drag sorting, tools, and history.

**Architecture:** Add a persisted Zustand store and pure rule module dedicated to Level 3 plans, then render them through a focused `Level3PlanModule`. Keep `ProjectSpaceContainer` as the adapter for project scope, follow-source resolution, project roles, and the latest published Level 1 milestones. Preserve legacy Level 2 state for local-storage compatibility while removing its project-space entry points.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Ant Design 6, Zustand 4, dnd-kit, XLSX export helpers, Puppeteer/Playwright browser verification.

---

## File Structure

- Create `src/types/level3Plan.ts` — activity, scope, milestone, change-log, permission-context, and component-prop contracts.
- Create `src/lib/level3PlanRules.ts` — pure numbering, duration, aggregation, filtering context, drag, scope, permission, and validation rules.
- Create `src/stores/level3Plan.ts` — persisted per-scope activities, history, collapse state, and column settings.
- Create `src/components/plans/Level3PlanModule.tsx` — full Level 3 plan workbench UI and user actions.
- Create `scripts/verify-level3-plan.mjs` — executable behavioral and source-integration contract.
- Create `screenshots/verify-level3-plan-browser.mjs` — browser flow for the final interactive verification.
- Modify `src/containers/ProjectSpaceContainer.tsx` — tab visibility, scope adapter, follow state, latest published L1 milestones, and module mounting.
- Modify `src/styles/globals.css` — only Level 3 hover-action and drag-row states not already covered by shared PMS classes.
- Modify `package.json` — add focused rule and browser verification commands.

### Task 1: Pure Level 3 Plan Rules

**Files:**
- Create: `scripts/verify-level3-plan.mjs`
- Create: `src/types/level3Plan.ts`
- Create: `src/lib/level3PlanRules.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing behavior verification**

Create `scripts/verify-level3-plan.mjs`. Transpile `src/lib/level3PlanRules.ts` with the installed TypeScript package and assert the public behaviors below:

```js
const parent = { id: 'p1', parentId: null, order: 0, activityName: '父活动', responsible: '张三' }
const childA = { id: 'c1', parentId: 'p1', order: 0, planStartDate: '2026-01-03', planEndDate: '2026-01-08', actualStartDate: '2026-01-04', actualEndDate: '2026-01-07' }
const childB = { id: 'c2', parentId: 'p1', order: 1, planStartDate: '2026-01-01', planEndDate: '2026-01-10', actualStartDate: '2026-01-02', actualEndDate: '2026-01-09' }

assert.deepEqual(rules.numberLevel3Activities([parent, childA, childB]).map(row => row.number), ['1', '1.1', '1.2'])
assert.deepEqual(rules.getLevel3ParentRollup('p1', [parent, childA, childB]), {
  planStartDate: '2026-01-01',
  planEndDate: '2026-01-10',
  estimatedDays: 9,
  actualStartDate: '2026-01-02',
  actualEndDate: '2026-01-09',
  actualDays: 7,
})
assert.equal(rules.validateLevel3ChildDates({ planStartDate: '2026-01-06', planEndDate: '2026-01-11' }, { planEndDate: '2026-01-10' }).ok, false)
assert.equal(rules.resolveLevel3Scope({ projectId: 'p', kind: 'market', value: 'TR', mainValue: 'OP', followsMain: true }).scopeKey, 'p::market::OP')
```

Add drag assertions for a parent carrying children and a child moving from `p1` to `p2`, plus permission assertions for administrator, SPM, parent owner, child owner, and viewer.

- [ ] **Step 2: Run the verification and observe the expected failure**

Run:

```bash
node scripts/verify-level3-plan.mjs
```

Expected: non-zero exit because `src/lib/level3PlanRules.ts` does not exist.

- [ ] **Step 3: Define exact domain contracts**

Create `src/types/level3Plan.ts` with these central contracts:

```ts
export type Level3ActivityStatus = '待启动' | '进行中' | '已完成'
export type Level3ActivityRisk = '无' | '高' | '中' | '低'
export type Level3ScopeKind = 'market' | 'tosType'

export interface Level3Activity {
  id: string
  parentId: string | null
  order: number
  activityName: string
  responsible: string
  responsibleDepartment: string
  planStartDate: string
  planEndDate: string
  actualStartDate: string
  actualEndDate: string
  milestoneId: string
  milestoneName: string
  milestonePlanEndDate: string
  status: Level3ActivityStatus
  risk: Level3ActivityRisk
  remark: string
  creator: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export interface Level3PermissionContext {
  currentUser: string
  administratorUsers: string[]
  spmUsers: string[]
}
```

Define `Level3Milestone`, `Level3ScopeResolution`, `Level3ChangeLog`, `Level3ActivityFormValue`, and `Level3ColumnKey` using the 14 confirmed table fields.

- [ ] **Step 4: Implement the minimum pure rules**

Create `src/lib/level3PlanRules.ts` without runtime imports so the verification script can transpile it directly. Export:

```ts
export function getLevel3ScopeKey(projectId: string, kind: 'market' | 'tosType', value: string): string
export function resolveLevel3Scope(input: Level3ScopeInput): Level3ScopeResolution
export function numberLevel3Activities(activities: Level3Activity[]): NumberedLevel3Activity[]
export function getLevel3ParentRollup(parentId: string, activities: Level3Activity[]): Level3ParentRollup
export function applyLevel3Rollups(activities: Level3Activity[]): Level3ActivityViewRow[]
export function validateLevel3ChildDates(values: Level3ActivityFormValue, milestone: Level3Milestone | undefined): Level3ValidationResult
export function moveLevel3Activity(activities: Level3Activity[], activeId: string, overId: string): Level3MoveResult
export function getLevel3ActivityPermissions(activity: Level3Activity | undefined, activities: Level3Activity[], context: Level3PermissionContext): Level3ActivityPermissions
export function filterLevel3ActivitiesWithParents(rows: NumberedLevel3Activity[], matchedIds: Set<string>): NumberedLevel3Activity[]
```

`moveLevel3Activity` must reject parent-to-child and child-to-parent drops, move parents as complete groups, allow child cross-parent moves, normalize both sibling lists, and report before/after parent and positions for history.

- [ ] **Step 5: Run the verification and observe it pass**

Run:

```bash
node scripts/verify-level3-plan.mjs
```

Expected: `Level 3 plan rule verification passed`.

- [ ] **Step 6: Add the focused command and commit**

Add to `package.json`:

```json
"verify:level3-plan": "node scripts/verify-level3-plan.mjs"
```

Run `npm run verify:level3-plan`, then commit only Task 1 files with message `feat: add level3 plan rules`.

### Task 2: Persisted Per-Scope Store

**Files:**
- Modify: `scripts/verify-level3-plan.mjs`
- Create: `src/stores/level3Plan.ts`

- [ ] **Step 1: Extend the verification contract and observe failure**

Add source-contract assertions requiring the store to expose these actions and to persist only business state:

```js
for (const token of [
  'getScopeData',
  'createActivity',
  'updateActivity',
  'moveActivity',
  'setCollapsedIds',
  'setColumnSettings',
  'activitiesByScope',
  'historyByScope',
]) assert.ok(storeSource.includes(token), `missing ${token}`)
```

Run `npm run verify:level3-plan`.

Expected: failure because `src/stores/level3Plan.ts` does not exist.

- [ ] **Step 2: Implement store state and guarded mutations**

Create a persisted store using `createJSONStorage(() => localStorage)` and storage key `pms-level3-plan-store`:

```ts
interface Level3PlanState {
  activitiesByScope: Record<string, Level3Activity[]>
  historyByScope: Record<string, Level3ChangeLog[]>
  collapsedIdsByScope: Record<string, string[]>
  columnSettingsByScope: Record<string, SortableColumnSettingsValue<Level3ColumnKey>>
}
```

Actions receive the resolved writable scope key and already-authorized actor. Each mutation recomputes sibling order and appends exactly one history record. `updateActivity` preserves creator/createdAt. `moveActivity` uses the pure move result and appends one drag record only when a move succeeds.

- [ ] **Step 3: Keep runtime UI state out of persistence**

Use a `partialize` function that persists only the four records above. Modal visibility, filter draft, hovered rows, and active drag IDs remain component-local.

- [ ] **Step 4: Re-run focused verification and type-check**

Run:

```bash
npm run verify:level3-plan
npx tsc --noEmit
```

Expected: both commands exit zero.

- [ ] **Step 5: Commit**

Commit `src/stores/level3Plan.ts` and the verification update with message `feat: persist scoped level3 plans`.

### Task 3: Level 3 Plan Workbench UI

**Files:**
- Modify: `scripts/verify-level3-plan.mjs`
- Create: `src/components/plans/Level3PlanModule.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add UI source-contract assertions and observe failure**

Require the component source to contain the confirmed toolbar order and modal labels:

```js
const orderedToolbarTokens = ['筛选', '导出', '字段配置', '全部展开', '全部收起', '历史修改记录']
assertInOrder(componentSource, orderedToolbarTokens)
for (const label of ['活动名称', '责任人', '责任部门', '计划开始时间', '计划完成时间', '关键节点', '状态', '任务风险', '备注']) {
  assert.ok(componentSource.includes(label), `missing form label ${label}`)
}
```

Run `npm run verify:level3-plan` and observe failure because the component is absent.

- [ ] **Step 2: Build the fixed 14-column table**

Create `Level3PlanModule.tsx` with `LEVEL3_COLUMN_DEFINITIONS` in this exact order:

```ts
['number', 'activityName', 'responsible', 'responsibleDepartment',
 'planStartDate', 'planEndDate', 'estimatedDays', 'milestoneName',
 'actualStartDate', 'actualEndDate', 'actualDays', 'status', 'risk', 'creator']
```

Use `SortableColumnSettings`; make `number` and `activityName` fixed and non-hideable. Render parent rows with `pms-level3-parent-row`, second-level activities indented, status/risk Tags, `—` for missing aggregated values, and horizontal scrolling.

- [ ] **Step 3: Add create/edit modals**

Use one Ant Design `Form` and modal mode:

```ts
type ActivityModalMode =
  | { kind: 'create-parent' }
  | { kind: 'create-child'; parentId: string }
  | { kind: 'edit'; activityId: string }
  | null
```

Parent mode renders activity name, responsible, read-only department, status, risk, and remark. Child mode additionally renders plan/actual dates and milestone. Disable unavailable milestone options and validate both date rules before calling the store.

Resolve department from provided `userDepartments`; when the directory has no value, automatically show `待补充` instead of inventing a department.

- [ ] **Step 4: Add hover permissions and drag behavior**

Use dnd-kit row handles. Parent owners see parent edit and child-add actions; child owners see only their own edit action; SPM/admin see all legal actions. Drag starts only when permission rules allow it. After an invalid drop, keep the original rows and show the result reason.

Add only these focused CSS states:

```css
.pms-level3-row-actions { opacity: 0; transition: opacity .16s ease; }
.ant-table-row:hover .pms-level3-row-actions { opacity: 1; }
.pms-level3-parent-row > td { background: var(--pms-surface-soft); font-weight: 600; }
.pms-level3-dragging > td { box-shadow: inset 0 0 0 1px var(--pms-brand); }
```

- [ ] **Step 5: Add tools and history drawer**

Implement the confirmed order with shared PMS components:

- `FloatingFilterPanel` using field definitions for all business fields; preserve parents when children match.
- `exportSheet` with current filtered view and all-data choices.
- `SortableColumnSettings` for visibility/order.
- Collapse/expand all parent IDs.
- A right-side `Drawer` showing newest-first creation, edit, and drag records with field before/after values.

- [ ] **Step 6: Re-run focused verification and type-check**

Run:

```bash
npm run verify:level3-plan
npx tsc --noEmit
```

Expected: both commands exit zero.

- [ ] **Step 7: Commit**

Commit the component, focused styles, and verification update with message `feat: build level3 plan workspace`.

### Task 4: Project-Space Integration and Legacy Tab Removal

**Files:**
- Modify: `scripts/verify-level3-plan.mjs`
- Modify: `src/containers/ProjectSpaceContainer.tsx`

- [ ] **Step 1: Add integration assertions and observe failure**

Add assertions that `ProjectSpaceContainer.tsx` imports and renders `Level3PlanModule`, that tab literals are `level1` and `level3`, and that the active project-space tab list no longer contains the `level2` or `overview` labels.

Run `npm run verify:level3-plan`.

Expected: failure on the old tab array.

- [ ] **Step 2: Replace the project-space tab contract**

Build tab items from project type:

```ts
const supportsLevel3Plan = isMachineProjectType(selectedProject?.type)
  || selectedProject?.type === PROJECT_TYPE_TOS_VERSION
const planTabItems = [
  { key: 'level1', label: '一级计划' },
  ...(supportsLevel3Plan ? [{ key: 'level3', label: '三级计划' }] : []),
]
```

Add an effect that resets persisted `projectPlanLevel` values other than the visible keys to `level1`. Remove project-space rendering and modal entry points for Level 2/overview without deleting legacy Plan Store fields.

- [ ] **Step 3: Resolve Level 3 scope and follow source**

For whole-machine projects, determine whether the selected market follows the main market and pass both selected and resolved source market. For tOS projects, use the same `getTosTypePlanSourceType(..., 'level1')` logic as Level 1. Pass `readOnly` plus a source message whenever selected and resolved values differ.

- [ ] **Step 4: Supply latest published Level 1 milestones**

Resolve the latest published Level 1 version for the effective source scope and read its published snapshot using `getProjectMarketSnapshotKey` or `getTosTypeSnapshotKey`. Convert only tasks with a parent into:

```ts
{
  id: String(task.id),
  name: String(task.taskName),
  planEndDate: String(task.planEndDate || ''),
}
```

Do not use the current draft as milestone input. If no published version or snapshot exists, pass an empty milestone list.

- [ ] **Step 5: Supply permission and directory context**

Build administrator users from global `管理组` plus the project `系统管理员` role. Parse `selectedProject.spm` as the SPM user list. Pass `ALL_USERS`, current user, activity permission context, and a department map containing only currently sourced project department data; unsourced users resolve to `待补充` in the component.

- [ ] **Step 6: Re-run focused and regression verification**

Run:

```bash
npm run verify:level3-plan
node scripts/verify-plan-workspace-shell.mjs
node scripts/verify-tos-type-integration.mjs
npx tsc --noEmit
```

Expected: all commands exit zero. Update stale verification tokens only where they assert the intentionally removed project-space secondary/overview tabs; do not weaken unrelated checks.

- [ ] **Step 7: Commit**

Commit integration changes with message `feat: integrate project space level3 plans`.

### Task 5: Build and Browser Iteration

**Files:**
- Create: `screenshots/verify-level3-plan-browser.mjs`
- Modify as failures require: Level 3 files from Tasks 1-4

- [ ] **Step 1: Run the complete static gate**

Run:

```bash
npm run verify:level3-plan
npx tsc --noEmit
npm run build
```

Expected: focused verification passes, TypeScript reports no errors, and Next.js production build exits zero.

- [ ] **Step 2: Start the development server and open a browser**

Start the app on an available local port, then use the Playwright browser workflow to open the actual page. Reuse an existing healthy server only after confirming its process belongs to this checkout.

- [ ] **Step 3: Verify whole-machine main and follow markets**

In project `X6877-D8400_H991`:

1. Open 项目空间 → 计划 and confirm only 一级计划、三级计划.
2. Enter the main market Level 3 tab.
3. Create a parent, create two children with valid milestone dates, and confirm rollups.
4. Edit a child and confirm rollup/history changes.
5. Drag parents with children and move a child across parents; confirm positions and numbers.
6. Exercise filter, export menu, column settings, collapse/expand, and history drawer.
7. Switch to a configured follow market and confirm the source plan is visible but write and drag actions are disabled.

- [ ] **Step 4: Verify tOS main and follow types plus role restrictions**

In project `tOS16.1`:

1. Confirm Full/Slim Level 3 scope switching.
2. Create and edit activities in the main type.
3. Switch users to verify administrator/SPM, parent owner, child owner, and viewer action visibility.
4. Confirm a follow type is read-only and references the main type.
5. Attempt an end date after the milestone and confirm the modal blocks saving without losing values.

- [ ] **Step 5: Fix and immediately re-run the affected path**

For each observed defect, make the smallest scoped correction, run `npm run verify:level3-plan` plus the affected browser flow, and retain a final screenshot of the whole-machine Level 3 table and the tOS follow read-only state.

- [ ] **Step 6: Final verification and commit**

Run fresh:

```bash
npm run verify:level3-plan
npx tsc --noEmit
npm run build
node screenshots/verify-level3-plan-browser.mjs
```

Expected: all commands exit zero and the browser script reports each scenario passed. Commit browser verification and final corrections with message `test: verify level3 plan workflows`.
