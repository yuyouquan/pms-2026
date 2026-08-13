# Personal Workbench Directory Task Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the personal workbench module switch with a PMS-styled directory task table that exposes plan and transfer-maintenance tasks in only pending and completed states.

**Architecture:** Keep `WorkbenchContainer` as the store and navigation adapter, keep `TodoCenter` as a controlled presentation surface, and keep `todoAggregation` pure. Extend the aggregation contract to preserve completed plan and transfer nodes, add deterministic directory/status defaults, then render the confirmed left-directory/right-table layout without changing permission gates or project-space navigation.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Ant Design 6, Zustand 4, CSS, Node assertion-based repository verification scripts.

---

## File responsibility map

- `src/lib/todoAggregation.ts`: canonical two-state task model, plan/transfer candidate generation, aggregation, default selection, filtering and stable sorting.
- `src/components/workspace/TodoCenter.tsx`: directory/status/filter/page state and the eight-column task table.
- `src/containers/WorkbenchContainer.tsx`: store adaptation, permissions, and direct plan/transfer navigation; no work-tracker rendering.
- `src/styles/globals.css`: confirmed directory-style PMS glass layout, table density and responsive behavior.
- `scripts/verify-todo-center.mjs`: executable aggregation, filter, default selection and UI-source contract.
- `scripts/verify-workbench-split.mjs`: workbench shell and legacy navigation compatibility contract.
- `screenshots/verify-workbench-summary-floating-panels.mjs`: browser smoke checks for the rendered workbench.

The implementation preserves every confirmed requirement: intelligent 默认选中, only 待处理/已完成 statuses, the 任务内容 column, 转维护 history, 权限 filtering, 窄屏 layout, 加载/error states, 查看详情 routing, and 未记录 for missing generation dates.

### Task 1: Define the two-state task aggregation contract

**Files:**
- Modify: `scripts/verify-todo-center.mjs`
- Modify: `src/lib/todoAggregation.ts`

- [ ] **Step 1: Write failing aggregation assertions**

Update the fixture expectations so completed work remains in the aggregate and add focused assertions for status normalization, missing generation dates and initial selection:

```js
assert.deepEqual(
  all.map(item => [item.id, item.status]),
  [
    ['plan-overdue', 'pending'],
    ['plan-progress', 'pending'],
    ['transfer-review', 'pending'],
    ['plan-done', 'completed'],
  ],
  'workbench exposes only pending and completed states',
)
assert.equal(
  todos.aggregateWorkbenchTodos({
    currentUser: '张三',
    today: '2026-08-13',
    planTodos: [{
      id: 'missing-date', projectId: 'p1', projectName: '项目 A', assignee: '张三',
      dueDate: '', completed: false, title: '无生成日期', planLevel: 'level1',
      planKey: 'level1', versionId: 'v3',
    }],
    transferApplications: [],
  })[0].generatedAt,
  '',
  'missing source dates stay empty instead of using today',
)
assert.deepEqual(
  todos.resolveWorkbenchDefaultSelection([
    { source: 'plan', status: 'completed' },
    { source: 'transfer', status: 'pending' },
  ]),
  { source: 'transfer', status: 'pending' },
)
assert.deepEqual(
  todos.resolveWorkbenchDefaultSelection([
    { source: 'plan', status: 'completed' },
  ]),
  { source: 'plan', status: 'all' },
)
```

Add transfer fixtures whose `dataEntry` is `success` and current user is the mapped applicant, and assert that the completed entry node is emitted with `view: 'detail'`, while `not_started` future nodes and cancelled applications are absent.

- [ ] **Step 2: Run the contract and verify RED**

Run:

```bash
npm run verify:todo-center
```

Expected: FAIL because `TodoStatus` still contains `in_progress`, completed candidates are filtered out, missing dates use `today`, completed transfer nodes are not generated, and `resolveWorkbenchDefaultSelection` does not exist.

- [ ] **Step 3: Implement the minimal two-state model**

Change the public contracts to:

```ts
export type TodoSource = 'plan' | 'transfer'
export type TodoStatus = 'pending' | 'completed'
export type TodoStatusFilter = 'all' | TodoStatus

export interface WorkbenchTodo {
  id: string
  source: TodoSource
  title: string
  projectId: string
  projectName: string
  assignee: string
  dueDate: string
  generatedAt: string
  status: TodoStatus
  completedAt?: string
  nodeLabel: string
  taskContent: string
  market?: string
  tosType?: string
  route: WorkbenchTodoRoute
}
```

Extend the transfer route view to include the read-only details surface:

```ts
view: 'entry' | 'review' | 'sqa-review' | 'detail'
```

Normalize plan status with only two return values:

```ts
function resolvePlanTodoStatus(task: PlanTodoTaskLike): TodoStatus {
  return task.status === '已完成' || Number(task.progress) >= 100
    ? 'completed'
    : 'pending'
}
```

Remove the completed-candidate exclusions in `aggregateWorkbenchTodos`, do not fall back to `aggregationDate`, and map the presentation fields:

```ts
generatedAt: toDateKey(candidate.generatedAt),
status: completed ? 'completed' : 'pending',
nodeLabel: candidate.sourceLabel || (candidate.planLevel === 'level1' ? '一级计划' : candidate.planKey),
taskContent: candidate.context || '',
```

Generate transfer candidates for each completed historical node plus the current actionable node. Use the application remark as `taskContent`; use `view: 'detail'` for completed nodes and retain `entry/review/sqa-review` for current pending nodes. Exclude `not_started` and cancelled applications.

Add the pure default selector:

```ts
export function resolveWorkbenchDefaultSelection(
  todos: readonly Pick<WorkbenchTodo, 'source' | 'status'>[],
): { source: TodoSource; status: TodoStatusFilter } {
  for (const source of ['plan', 'transfer'] as const) {
    if (todos.some(todo => todo.source === source && todo.status === 'pending')) {
      return { source, status: 'pending' }
    }
  }
  return { source: 'plan', status: 'all' }
}
```

Update `TodoFilters` to include the selected directory and status rather than a multi-category filter:

```ts
export interface TodoFilters {
  search: string
  projectId: string
  source: TodoSource
  status: TodoStatusFilter
  generatedDateFrom: string
  generatedDateTo: string
}
```

Filter search against title, project, node label, task content and assignee; apply source and status before the remaining filters. Sort pending before completed, then generation time descending, title and ID.

- [ ] **Step 4: Run the aggregation contract and verify GREEN**

Run:

```bash
npm run verify:todo-center
```

Expected: PASS with `todo center contract passed`.

- [ ] **Step 5: Commit the aggregation contract**

```bash
git add scripts/verify-todo-center.mjs src/lib/todoAggregation.ts
git commit -m "feat: add two-state workbench task aggregation"
```

### Task 2: Build the directory-style task table

**Files:**
- Modify: `scripts/verify-todo-center.mjs`
- Modify: `src/components/workspace/TodoCenter.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write failing component-source assertions**

Replace the old category-select assertions with exact directory, tab and table contracts:

```js
for (const label of ['任务目录', '计划', '转维护', '全部', '待处理', '已完成']) {
  assert.match(todoCenterSource, new RegExp(label), `todo center missing ${label}`)
}
for (const column of ['任务名称', '所属项目', '状态', '任务节点', '任务内容', '处理人', '生成时间', '操作']) {
  assert.match(todoCenterSource, new RegExp(`title:\\s*['"]${column}['"]`), `todo table missing ${column}`)
}
assert.doesNotMatch(todoCenterSource, /mode="multiple"/, 'directory replaces the category multi-select')
assert.doesNotMatch(todoCenterSource, /任务来源/, 'source is represented by the left directory')
assert.match(todoCenterSource, /resolveWorkbenchDefaultSelection/, 'initial source and status use the pure default selector')
assert.match(todoCenterSource, /前往处理/, 'pending action is explicit')
assert.match(todoCenterSource, /查看详情/, 'completed action is explicit')
assert.match(globalStyles, /grid-template-columns:\s*176px minmax\(0, 1fr\)/, 'desktop uses directory and data columns')
assert.match(globalStyles, /@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*1fr/, 'narrow layout stacks the directory above the table')
```

- [ ] **Step 2: Run the contract and verify RED**

Run:

```bash
npm run verify:todo-center
```

Expected: FAIL because the current UI has no directory, status tabs, status/content columns or responsive two-column layout.

- [ ] **Step 3: Implement the component state and filtering**

Initialize directory and status from the pure selector and recalculate when the current user's `todos` identity changes:

```ts
const initialSelection = useMemo(() => resolveWorkbenchDefaultSelection(todos), [todos])
const [source, setSource] = useState<TodoSource>(initialSelection.source)
const [status, setStatus] = useState<TodoStatusFilter>(initialSelection.status)

useEffect(() => {
  const next = resolveWorkbenchDefaultSelection(todos)
  setSource(next.source)
  setStatus(next.status)
  setCurrentPage(1)
}, [todos])
```

Keep search, project and generation-range controls. Build filters with `{ search, projectId, source, status, generatedDateFrom, generatedDateTo }`. Build the project selector from tasks in the current directory so options do not leak across directories. Clearing filters must not reset `source` or `status`.

- [ ] **Step 4: Implement the confirmed A layout and table**

Render this semantic structure:

```tsx
<section className="pms-todo-center pms-glass-surface" aria-label="个人工作台任务">
  <aside className="pms-todo-directory" aria-label="任务目录">
    <h2>任务目录</h2>
    {/* plan and transfer buttons with pending counts */}
  </aside>
  <div className="pms-todo-workspace">
    <nav className="pms-todo-status-tabs" aria-label="任务状态">
      {/* all, pending, completed tabs with current-directory counts */}
    </nav>
    {/* search, project, date, clear */}
    {/* result status and table */}
  </div>
</section>
```

Use the exact columns from the specification. Render missing dates as `未记录`, missing task content as `—`, pending status with an amber tag and completed status with a green tag. Set the action label from status:

```ts
const actionLabel = record.status === 'completed' ? '查看详情' : '前往处理'
```

Keep pagination at 10/20/50, `scroll={{ x: 1320, y: 460 }}`, the fixed right action column, loading skeleton, retry alert, context-specific empty text and accessible action labels.

- [ ] **Step 5: Implement PMS glass styles**

Replace obsolete source/metric styles with focused selectors:

```css
.pms-todo-center {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  min-height: 560px;
  padding: 0;
  overflow: hidden;
}

.pms-todo-directory {
  padding: 16px 12px;
  border-right: 1px solid rgba(99, 102, 241, 0.12);
  background: rgba(248, 250, 255, 0.72);
}

.pms-todo-directory__item.is-active {
  color: var(--pms-brand-strong);
  background: linear-gradient(90deg, rgba(237, 233, 254, 0.96), rgba(238, 242, 255, 0.82));
  box-shadow: inset 2px 0 var(--pms-brand);
}

.pms-todo-status-tabs__item[aria-selected='true'] {
  color: var(--pms-brand-strong);
  border-bottom-color: var(--pms-brand);
}

@media (max-width: 760px) {
  .pms-todo-center { grid-template-columns: 1fr; }
  .pms-todo-directory { display: flex; border-right: 0; border-bottom: 1px solid rgba(99, 102, 241, 0.12); }
}
```

- [ ] **Step 6: Run the UI contract and verify GREEN**

Run:

```bash
npm run verify:todo-center
```

Expected: PASS with `todo center contract passed`.

- [ ] **Step 7: Commit the task table**

```bash
git add scripts/verify-todo-center.mjs src/components/workspace/TodoCenter.tsx src/styles/globals.css
git commit -m "feat: redesign personal workbench task table"
```

### Task 3: Remove work tracking and preserve direct navigation

**Files:**
- Modify: `scripts/verify-workbench-split.mjs`
- Modify: `scripts/verify-todo-center.mjs`
- Modify: `src/containers/WorkbenchContainer.tsx`
- Modify: `src/stores/ui.ts`

- [ ] **Step 1: Write failing shell and route assertions**

Add:

```js
assert.doesNotMatch(workbenchSource, /WorkTracker|工作跟踪|pms-workbench-switch/, 'workbench renders only tasks')
assert.doesNotMatch(workbenchSource, /setWorkbenchTab/, 'workbench no longer switches internal modules')
assert.match(workbenchSource, /<TodoCenter todos=\{todos\} onOpenTodo=\{openTodo\}/, 'task table remains the only workbench body')
assert.match(workbenchSource, /route\.view === 'detail'/, 'completed transfer tasks open read-only details')
assert.match(workbenchSource, /setTransferView\('detail'\)/, 'completed transfer navigation uses the detail surface')
assert.match(uiStoreSource, /export type WorkbenchTab = 'todo'/, 'legacy origin type cannot restore work tracking')
```

- [ ] **Step 2: Run the shell contracts and verify RED**

Run:

```bash
npm run verify:workbench-split
npm run verify:todo-center
```

Expected: FAIL because `WorkbenchContainer` still imports and renders `WorkTracker`, and `WorkbenchTab` still includes `workTracker`.

- [ ] **Step 3: Remove the work-tracker surface**

Delete the `Segmented`, `WorkTracker`, `WorkbenchTab`, `workbenchTab`, `setWorkbenchTab` and `createdLevel2Plans` dependencies that only support the removed module. Render:

```tsx
return (
  <section className="pms-workbench">
    <header className="pms-workbench-header pms-glass-surface">
      <h1>个人工作台</h1>
    </header>
    <div className="pms-workbench-content">
      <TodoCenter todos={todos} onOpenTodo={openTodo} />
    </div>
  </section>
)
```

For plan routes retain the current activation, permission, market/tOS validation, edit guard and `planNavigationIntent` flow. For transfer routes use:

```ts
setProjectSpaceModule('basic')
setSelectedTransferAppId(route.applicationId)
setTransferView(route.view === 'detail' ? 'detail' : route.view)
```

Enter project space with the compatibility origin `{ module: 'workbench', workbenchTab: 'todo' }`.

- [ ] **Step 4: Narrow legacy workbench origin state**

Change:

```ts
export type WorkbenchTab = 'todo'
```

Keep `workbenchTab`, `setWorkbenchTab` and origin restoration internally for compatibility with existing callers, but every fallback and caller must resolve to `todo`.

- [ ] **Step 5: Run shell and route contracts and verify GREEN**

Run:

```bash
npm run verify:workbench-split
npm run verify:todo-center
```

Expected: both commands PASS.

- [ ] **Step 6: Commit navigation compatibility**

```bash
git add scripts/verify-workbench-split.mjs scripts/verify-todo-center.mjs src/containers/WorkbenchContainer.tsx src/stores/ui.ts
git commit -m "feat: focus workbench on personal tasks"
```

### Task 4: Verify the full implementation in code and browser

**Files:**
- Modify: `screenshots/verify-workbench-summary-floating-panels.mjs`
- Modify: `scripts/verify-todo-center.mjs`

- [ ] **Step 1: Write failing browser smoke expectations**

Update the workbench smoke to assert:

```js
await page.getByRole('heading', { name: '个人工作台' }).waitFor()
await page.getByRole('complementary', { name: '任务目录' }).waitFor()
await page.getByRole('button', { name: /计划/ }).waitFor()
await page.getByRole('button', { name: /转维护/ }).waitFor()
await page.getByRole('tab', { name: /待处理/ }).waitFor()
await page.getByRole('columnheader', { name: '任务内容' }).waitFor()
if (await page.getByRole('button', { name: /前往处理/ }).count()) {
  await page.getByRole('button', { name: /前往处理/ }).first().focus()
}
```

Retain the existing unexpected-console-error collector and failure throw.

- [ ] **Step 2: Run browser smoke and verify RED**

Run the development server and smoke script in separate terminals:

```bash
node node_modules/next/dist/bin/next dev -p 3004
PMS_BASE_URL=http://127.0.0.1:3004 node screenshots/verify-workbench-summary-floating-panels.mjs
```

Expected: the smoke command FAILS on the first missing new-workbench selector, proving the updated browser contract detects the old semantics.

- [ ] **Step 3: Add the required selector and accessibility semantics**

Correct semantic roles and accessible names in `TodoCenter` without changing the confirmed layout or business behavior. Use real buttons for directories and `role="tablist"`, `role="tab"`, `aria-selected` for status tabs.

- [ ] **Step 4: Run repository verification**

Run:

```bash
npm run verify:workbench-split
npm run verify:todo-center
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git diff --check
```

Expected: all commands exit 0. TypeScript reports no errors; Next.js completes a production build; `git diff --check` prints nothing.

- [ ] **Step 5: Run browser visual and interaction verification**

Verify at desktop and narrow viewport:

1. smart initial plan/transfer directory and status selection;
2. directory counts and status counts;
3. search, project, date and clear filters;
4. pending and completed task rows;
5. direct pending navigation and completed detail navigation;
6. directory stacking at narrow width and horizontal table scroll;
7. no unexpected console or hydration errors.

Expected: all checks pass and the visual hierarchy matches confirmed option A while retaining PMS styling.

- [ ] **Step 6: Commit browser coverage**

```bash
git add screenshots/verify-workbench-summary-floating-panels.mjs scripts/verify-todo-center.mjs src/components/workspace/TodoCenter.tsx
git commit -m "test: verify directory-style workbench interactions"
```

## Final completion gate

Before reporting completion, run the entire Task 4 command set again from a clean feature checkout and inspect `git status --short`. Report separately:

- aggregation/source contract result;
- TypeScript result;
- production build result;
- browser interaction and console result;
- files and commits created;
- any pre-existing unrelated workspace changes that remain untouched.
