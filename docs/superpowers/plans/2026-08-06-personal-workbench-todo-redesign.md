# Personal Workbench Todo Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the metric-heavy categorized todo page with a compact personal-workbench header and a paginated, pending-only todo table filtered by task category and generation date.

**Architecture:** Extend the existing todo aggregation contract with normalized generation dates and pending-only output, keep project/permission routing intact, and move workbench navigation into a header-level segmented control. TodoCenter remains responsible only for local filters, pagination, and table presentation.

**Tech Stack:** React 18, TypeScript, Ant Design 6, Zustand 4, Node source-contract scripts, global CSS.

---

### Task 1: Define failing todo behavior

**Files:**
- Modify: `scripts/verify-todo-center.mjs`

- [ ] Add assertions that aggregated todos contain normalized `generatedAt`, completed todos are excluded, transfer creation time is preserved, and generation-date/category filters compose.

```js
assert.equal(all.every(todo => todo.status !== 'completed'), true)
assert.equal(all.find(todo => todo.source === 'transfer')?.generatedAt, '2026-07-29')
assert.deepEqual(
  todos.filterWorkbenchTodos(all, { categories: ['plan'], generatedDateFrom: '2026-07-30', generatedDateTo: '2026-07-31' }).map(todo => todo.source),
  ['plan'],
)
```

- [ ] Add source assertions that the UI contains “个人工作台”“前往处理”, `RangePicker`, multiple category selection and pagination, while excluding metrics, status filters, status columns and due-date badges.
- [ ] Run `npm run verify:todo-center` and confirm failure occurs because the new fields and UI are absent.
- [ ] Commit with `git commit -m "test: define personal todo workspace contract"`.

### Task 2: Update todo aggregation

**Files:**
- Modify: `src/lib/todoAggregation.ts`
- Modify: `src/containers/WorkbenchContainer.tsx`

- [ ] Add `generatedAt` to todo and candidate interfaces and replace `TodoFilters.source/status/dueDate*` with `categories/generatedDate*`.

```ts
export interface TodoFilters {
  search: string
  projectId: string
  categories: TodoSource[]
  generatedDateFrom: string
  generatedDateTo: string
}
```

- [ ] Populate transfer candidates from application `createdAt`; plan candidates accept generation metadata when available.
- [ ] Normalize missing plan generation dates to the aggregation date, exclude completed todos, and sort by generation date descending with stable title/ID fallback.
- [ ] Filter categories as a multi-select array and apply an inclusive generated-date range.
- [ ] Run `npm run verify:todo-center` to confirm data assertions pass while presentation assertions still fail.

### Task 3: Redesign workbench and TodoCenter

**Files:**
- Modify: `src/containers/WorkbenchContainer.tsx`
- Modify: `src/components/workspace/TodoCenter.tsx`
- Modify: `src/styles/globals.css`

- [ ] Replace the outer Ant Design Tabs bar with a fixed-height title row and text-only capsule Segmented control; render the selected content below it.

```tsx
<header className="pms-workbench-header">
  <h1>个人工作台</h1>
  <Segmented
    aria-label="个人工作台模块"
    value={workbenchTab}
    options={[{ label: '待办中心', value: 'todo' }, { label: '工作跟踪', value: 'workTracker' }]}
    onChange={switchWorkbenchTab}
  />
</header>
```

- [ ] Remove TodoCenter title/source switch and metric cards.
- [ ] Render search, project, multiple task categories, one generated-date RangePicker and clear action.
- [ ] Render only the six approved columns and label the action “前往处理”.

```ts
const approvedColumns = ['任务名称', '所属项目', '任务', '处理人', '生成时间', '操作']
```

- [ ] Add controlled local pagination with 10/20/50 sizes and reset page 1 when filters change.
- [ ] Add compact responsive styles and accessible names without changing todo navigation callbacks.
- [ ] Run `npm run verify:todo-center && npx tsc --noEmit` and confirm both pass.

### Task 4: Combined verification

**Files:**
- Modify only files where verification reveals a defect.

- [ ] Run `npm run verify:collapsible-sidebars`, `npm run verify:enum-config`, `npm run verify:todo-center`, project-space permission and technical-project contracts.
- [ ] Run `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- [ ] Browser-check three configuration tabs, project-space collapse, personal-workbench capsule switching, todo filters, pagination, empty state and navigation.
- [ ] Commit verification fixes with `git add -u src scripts package.json && git commit -m "fix: polish workspace navigation interactions"` when needed.
