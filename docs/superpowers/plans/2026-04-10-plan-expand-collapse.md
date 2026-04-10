# Plan View Expand/Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-node and bulk expand/collapse to the project space L1/L2 plan table view and gantt view, with bi-directional state sync between the two views scoped to project + level + plan.

**Architecture:** Single React state `collapsedNodes: Record<scopeKey, Set<string>>` at the top of `page.tsx`. Table view filters its flat data array by ancestor-collapsed check + renders a manual chevron in the 序号 column. Gantt view receives `collapsedIds` as a prop; an effect applies them to the dhtmlx-gantt instance via `gantt.open()/close()`, and gantt's `onTaskOpened/Closed` events write back — with a `suppressFeedback` ref breaking feedback loops.

**Tech Stack:** Next.js 14 + React 18 + Ant Design 6.3.1 + dhtmlx-gantt + TypeScript. **No test framework** — verification = `npx tsc --noEmit` + `npm run build` + manual browser verification at `http://localhost:3000`.

**Reference spec:** `docs/superpowers/specs/2026-04-10-plan-expand-collapse-design.md`

**Before starting:** Read the spec once. Also read `src/app/page.tsx` lines 63-132 (DHTMLXGantt component), 595-710 (project space state declarations), 1662-1830 (renderTaskTable), 1444-1458 (renderGanttChart), and 2850-2895 (project space plan toolbar + render call sites) to understand the integration points.

---

## File Structure

**Modify (one file):** `src/app/page.tsx`

All changes land in this single file. Breakdown by region:

1. **Top-level imports** (~line 100–190): add 3 new icons
2. **DHTMLXGantt component** (~line 63–132): extend with `collapsedIds` / `onCollapsedChange` props + sync effect + event handlers
3. **Home component state block** (~line 595–710): add `collapsedNodes` state
4. **Home component helper functions** (near other `handleXxx`, roughly line 1070–1400): add `getScopeKey`, `hasChildren`, `filterByCollapsed`, `getAllExpandableIds`, `toggleNode`, `expandAll`, `collapseAll`
5. **`renderTaskTable`** (~line 1662–1830): consume scope key + filter tasks + add chevron in 序号 column
6. **`renderGanttChart`** (~line 1444–1458): pass `collapsedIds` / `onCollapsedChange` to DHTMLXGantt
7. **Project space plan toolbar** (~line 2854–2880): insert expand-all / collapse-all buttons

---

## Task 1: Add state, scope-key, and helper functions

**Files:**
- Modify: `src/app/page.tsx` — add state and helpers; add icon imports

- [ ] **Step 1: Add icon imports**

Find the `from '@ant-design/icons'` import block in `src/app/page.tsx` (around line 140–190). Add `PlusSquareOutlined`, `MinusSquareOutlined`, and `CaretDownOutlined` to the named imports. The exact existing import line will vary; add these three names to the end of whatever existing list is there.

- [ ] **Step 2: Add `collapsedNodes` state**

Find the state declarations in the `Home` component near `projectPlanLevel` / `projectPlanViewMode` (around line 683–684). Add directly after them:

```ts
// Collapsed tree nodes per scope (project + level + optional plan)
// Empty Set = fully expanded (default). Presence in Set = that node is collapsed.
const [collapsedNodes, setCollapsedNodes] = useState<Record<string, Set<string>>>({})
```

- [ ] **Step 3: Add helper functions**

Place these helpers inside the `Home` component, near other `handle*` declarations. A good anchor is right after `handleAddSubTask` (search for `const handleAddSubTask =`, this is around line 1094). Insert after that function's closing brace:

```ts
// ============================================================
// Plan tree expand/collapse helpers (added 2026-04-10)
// ============================================================

const getScopeKey = (): string | null => {
  if (activeModule !== 'projectSpace') return null
  if (!selectedProject) return null
  if (projectPlanLevel === 'level1') return `${selectedProject.id}::level1`
  if (projectPlanLevel === 'level2' && activeLevel2Plan) return `${selectedProject.id}::level2::${activeLevel2Plan}`
  return null
}

const hasChildren = (id: string, allTasks: any[]): boolean =>
  allTasks.some(t => t.parentId === id)

const filterByCollapsed = (flatTasks: any[], collapsedSet: Set<string>): any[] => {
  if (collapsedSet.size === 0) return flatTasks
  const byId = new Map(flatTasks.map(t => [t.id, t]))
  const isHidden = (task: any): boolean => {
    let cur = task
    while (cur.parentId) {
      if (collapsedSet.has(cur.parentId)) return true
      cur = byId.get(cur.parentId)
      if (!cur) return false
    }
    return false
  }
  return flatTasks.filter(t => !isHidden(t))
}

const getAllExpandableIds = (tasksArg: any[]): string[] => {
  const parentIds = new Set<string>()
  for (const t of tasksArg) if (t.parentId) parentIds.add(t.parentId)
  return Array.from(parentIds)
}

const toggleNode = (nodeId: string) => {
  const key = getScopeKey()
  if (!key) return
  setCollapsedNodes(prev => {
    const cur = new Set(prev[key] || [])
    if (cur.has(nodeId)) cur.delete(nodeId); else cur.add(nodeId)
    return { ...prev, [key]: cur }
  })
}

const expandAll = () => {
  const key = getScopeKey()
  if (!key) return
  setCollapsedNodes(prev => ({ ...prev, [key]: new Set<string>() }))
}

const collapseAll = () => {
  const key = getScopeKey()
  if (!key) return
  const scopeTasks = projectPlanLevel === 'level1'
    ? tasks
    : level2PlanTasks.filter(t => t.planId === activeLevel2Plan)
  const allParents = getAllExpandableIds(scopeTasks)
  setCollapsedNodes(prev => ({ ...prev, [key]: new Set(allParents) }))
}
```

Note the parameter name is `tasksArg` (not `tasks`) to avoid shadowing the outer `tasks` state variable.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes with no errors. (The new helpers may appear unused until later tasks consume them — TS does not warn on unused locals in this project.)

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(plan): add collapsedNodes state and expand/collapse helpers"
```

---

## Task 2: Filter `renderTaskTable` data and add chevron

**Files:**
- Modify: `src/app/page.tsx` — update `renderTaskTable` (around line 1662–1830)

- [ ] **Step 1: Add scope/filter derivation at the top of `renderTaskTable`**

Find `const renderTaskTable = (customTasks?: any[]) => {` (around line 1662). Immediately after the existing `const flatTasks = tableTasks.map(...)` line, add:

```ts
const scopeKey = getScopeKey()
const collapsedSet = scopeKey ? (collapsedNodes[scopeKey] || new Set<string>()) : new Set<string>()
const expandEnabled = scopeKey !== null
const visibleTasks = expandEnabled ? filterByCollapsed(flatTasks, collapsedSet) : flatTasks
```

- [ ] **Step 2: Insert chevron into the 序号 column render**

Find the 序号 column render (`if (visibleColumns.includes('id')) cols.push({ title: '序号', ...`, around line 1675). The current render body looks like:

```tsx
return (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 20 }}>
    {isEditMode && <DragHandle />}
    {canAddChild && <Tooltip title="添加子项">...</Tooltip>}
    <span style={{ fontWeight: depth === 0 ? 600 : 500, ... }}>{id}</span>
  </div>
)
```

Replace that `return (...)` block with:

```tsx
return (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 20 }}>
    {isEditMode && <DragHandle />}
    {expandEnabled && hasChildren(record.id, tableTasks) && (
      <span
        onClick={(e) => { e.stopPropagation(); toggleNode(record.id) }}
        style={{
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
          width: 14, height: 14, color: '#9ca3af', transition: 'transform 0.15s',
          transform: collapsedSet.has(record.id) ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}
      >
        <CaretDownOutlined style={{ fontSize: 10 }} />
      </span>
    )}
    {expandEnabled && !hasChildren(record.id, tableTasks) && (
      <span style={{ display: 'inline-block', width: 14 }} />
    )}
    {canAddChild && <Tooltip title="添加子项"><Button type="text" size="small" icon={<PlusOutlined />} style={{ color: '#6366f1' }} onClick={(e) => { e.stopPropagation(); handleAddSubTask(record.id) }} /></Tooltip>}
    <span style={{ fontWeight: depth === 0 ? 600 : 500, color: depth === 0 ? '#111827' : '#4b5563', fontSize: 13 }}>{id}</span>
  </div>
)
```

The chevron (or its 14px placeholder) appears between `DragHandle` and `canAddChild` so that both edit-mode and read-only modes keep the same column alignment.

- [ ] **Step 3: Update the `Table` / `SortableContext` to use `visibleTasks`**

Find the `<Table ... dataSource={flatTasks} .../>` JSX (around line 1825). Change both `dataSource={flatTasks}` and `items={flatTasks.map(t => t.id)}` to use `visibleTasks` instead:

Before:
```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTableDragEnd}>
  <SortableContext items={flatTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
    <Table className={tableClassName} dataSource={flatTasks} columns={getColumns()} rowKey="id" pagination={false} scroll={{ x: visibleColumns.length * 100 + 200 }} components={TableComponents} size="middle" />
  </SortableContext>
</DndContext>
```

After:
```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTableDragEnd}>
  <SortableContext items={visibleTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
    <Table className={tableClassName} dataSource={visibleTasks} columns={getColumns()} rowKey="id" pagination={false} scroll={{ x: visibleColumns.length * 100 + 200 }} components={TableComponents} size="middle" />
  </SortableContext>
</DndContext>
```

Leave the `handleTableDragEnd` function itself unchanged — it still operates on the complete `tableTasks` array internally (via `collectDescendants`), so folded-child blocks move with their parent naturally.

- [ ] **Step 4: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

Both must pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(plan): filter task table by collapsed nodes and render chevron"
```

---

## Task 3: Add "全部展开 / 全部收起" toolbar buttons

**Files:**
- Modify: `src/app/page.tsx` — project space plan toolbar (around line 2854–2880)

- [ ] **Step 1: Insert buttons into the toolbar Space**

Find the project space plan toolbar JSX. Look for the block containing `projectPlanViewMode !== 'horizontal'` and the "自定义列" tooltip (around line 2856–2860). The surrounding structure is:

```tsx
<Col>
  <Space size={6}>
    <Input placeholder="搜索任务..." .../>
    {projectPlanViewMode !== 'horizontal' && (
      <Tooltip title="自定义列">
        <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
      </Tooltip>
    )}
    <Radio.Group .../>
  </Space>
</Col>
```

Insert a new conditional block right before the `<Radio.Group .../>`:

```tsx
{getScopeKey() !== null && (
  <>
    <Tooltip title="全部展开">
      <Button
        icon={<PlusSquareOutlined />}
        size="small"
        style={{ borderRadius: 6 }}
        onClick={expandAll}
      />
    </Tooltip>
    <Tooltip title="全部收起">
      <Button
        icon={<MinusSquareOutlined />}
        size="small"
        style={{ borderRadius: 6 }}
        onClick={collapseAll}
      />
    </Tooltip>
  </>
)}
```

The `<>` fragment is necessary because AntD `Space` treats each direct child as a spaced item.

- [ ] **Step 2: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

Both must pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(plan): add expand-all and collapse-all toolbar buttons"
```

---

## Task 4: Extend `DHTMLXGantt` component with bi-directional collapse sync

**Files:**
- Modify: `src/app/page.tsx` — DHTMLXGantt component (around line 63–132)

- [ ] **Step 1: Add `useRef` import if missing**

Check the existing React import at the top of `src/app/page.tsx`. It likely includes `useState`, `useEffect`, `useMemo`, `useRef`. If `useRef` is missing, add it to the `from 'react'` named import list.

- [ ] **Step 2: Extend the component signature**

Find the existing signature (around line 63):

```tsx
function DHTMLXGantt({ tasks, onTaskClick, readOnly = false }: { tasks: any[], onTaskClick?: (task: any) => void, readOnly?: boolean }) {
```

Replace it with:

```tsx
function DHTMLXGantt({
  tasks,
  onTaskClick,
  readOnly = false,
  collapsedIds,
  onCollapsedChange,
}: {
  tasks: any[]
  onTaskClick?: (task: any) => void
  readOnly?: boolean
  collapsedIds?: Set<string>
  onCollapsedChange?: (updater: (prev: Set<string>) => Set<string>) => void
}) {
```

- [ ] **Step 3: Add `suppressFeedback` ref**

Find the existing `const ganttContainer = useRef<HTMLDivElement>(null)` (around line 64, immediately after the signature you just replaced). On the next line, add:

```ts
const suppressFeedback = useRef(false)
```

- [ ] **Step 4: Wrap the existing `gantt.parse` call with suppressFeedback**

Find the existing `gantt.parse(ganttData)` call (around line 116 in the existing effect). Replace it with:

```ts
suppressFeedback.current = true
gantt.parse(ganttData)
queueMicrotask(() => { suppressFeedback.current = false })
```

- [ ] **Step 5: Register `onTaskOpened` / `onTaskClosed` event handlers**

In the same `useEffect` where gantt is initialized, AFTER `gantt.parse(...)` and BEFORE the existing `if (onTaskClick)` block (around line 118–120), register the open/close event handlers:

```ts
const openHandler = gantt.attachEvent('onTaskOpened', (id: any) => {
  if (suppressFeedback.current) return
  onCollapsedChange?.((prev) => { const s = new Set(prev); s.delete(String(id)); return s })
})
const closeHandler = gantt.attachEvent('onTaskClosed', (id: any) => {
  if (suppressFeedback.current) return
  onCollapsedChange?.((prev) => { const s = new Set(prev); s.add(String(id)); return s })
})
```

- [ ] **Step 6: Detach event handlers in the effect cleanup**

Find the existing cleanup `return () => { gantt.clearAll() }` at the end of the init effect (around line 127). Replace with:

```ts
return () => {
  gantt.detachEvent(openHandler)
  gantt.detachEvent(closeHandler)
  gantt.clearAll()
}
```

- [ ] **Step 7: Add a second `useEffect` to sync `collapsedIds` into the gantt instance**

Immediately after the existing init `useEffect` closing brace, add:

```ts
useEffect(() => {
  if (!ganttContainer.current) return
  if (!gantt.$container) return
  suppressFeedback.current = true
  gantt.eachTask((task: any) => {
    const id = String(task.id)
    const shouldOpen = !(collapsedIds && collapsedIds.has(id))
    if (task.$open !== shouldOpen) {
      if (shouldOpen) gantt.open(id)
      else gantt.close(id)
    }
  })
  queueMicrotask(() => { suppressFeedback.current = false })
}, [collapsedIds])
```

- [ ] **Step 8: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

Both must pass.

- [ ] **Step 9: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(plan): add bi-directional collapse sync to DHTMLXGantt"
```

---

## Task 5: Wire `renderGanttChart` to pass collapsedIds

**Files:**
- Modify: `src/app/page.tsx` — `renderGanttChart` (around line 1444–1458)

- [ ] **Step 1: Replace `renderGanttChart` body**

Find `const renderGanttChart = (customTasks?: any[]) => {` (around line 1444). The current body is:

```tsx
const renderGanttChart = (customTasks?: any[]) => {
  const ganttTasks = customTasks || filteredTasks
  return (
    <div style={{ border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <DHTMLXGantt
        tasks={ganttTasks}
        onTaskClick={(task) => {
          message.info(`点击任务: ${task.text}`)
        }}
        readOnly={!isEditMode}
      />
    </div>
  )
}
```

Replace it with (preserving the existing `<div>` wrapper style and the inline `onTaskClick` handler):

```tsx
const renderGanttChart = (customTasks?: any[]) => {
  const ganttTasks = customTasks || filteredTasks
  const key = getScopeKey()
  const collapsedSet = key ? (collapsedNodes[key] || new Set<string>()) : new Set<string>()
  return (
    <div style={{ border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <DHTMLXGantt
        tasks={ganttTasks}
        onTaskClick={(task) => {
          message.info(`点击任务: ${task.text}`)
        }}
        readOnly={!isEditMode}
        collapsedIds={collapsedSet}
        onCollapsedChange={(updater) => {
          if (!key) return
          setCollapsedNodes(prev => {
            const current = prev[key] || new Set<string>()
            const next = updater(current)
            return { ...prev, [key]: next }
          })
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

Both must pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(plan): wire renderGanttChart to share collapsed state with table"
```

---

## Task 6: Manual verification

**Files:** none

- [ ] **Step 1: Start dev server**

If not already running, in a separate terminal: `npm run dev`. Open `http://localhost:3000`.

- [ ] **Step 2: L1 table view checklist**

Navigate to 项目空间 → select a project → 计划 → 一级计划 → 表格视图. Verify:

- [ ] Tree is fully expanded by default (same rows as before the change)
- [ ] Rows with children show a down-arrow chevron in the 序号 column
- [ ] Leaf rows show a 14px empty placeholder (column alignment preserved)
- [ ] Click a chevron → its children are hidden; chevron rotates to ▶
- [ ] Click again → children re-appear; chevron rotates back to ▼
- [ ] Toolbar shows "全部展开" (⊞) and "全部收起" (⊟) buttons
- [ ] Click "全部收起" → all parent nodes collapse, only root-level rows remain
- [ ] Click "全部展开" → full tree visible again
- [ ] Enter edit mode → chevron still present, drag handle still works
- [ ] Drag a collapsed-parent row → its hidden children move with it

- [ ] **Step 3: L1 gantt sync checklist**

From L1 table, collapse a couple of nodes, then switch to 甘特图 view:

- [ ] Same nodes are collapsed in gantt
- [ ] Click "全部展开" → gantt expands all
- [ ] Click "全部收起" → gantt collapses all parents
- [ ] Manually click a gantt row's open/close icon → state propagates
- [ ] Switch back to 表格 → latest collapse state is reflected

- [ ] **Step 4: L2 per-plan isolation**

Navigate to 二级计划. There should be multiple plans (plan0/plan1/etc):

- [ ] Collapse nodes in plan A
- [ ] Switch to plan B → plan B is fully expanded (independent state)
- [ ] Switch back to plan A → previous collapse state preserved
- [ ] L1 ↔ L2 switch preserves each level's state independently

- [ ] **Step 5: Cross-project isolation**

- [ ] Collapse nodes in Project 1
- [ ] Switch to Project 2 → fully expanded (own state)
- [ ] Switch back to Project 1 → previous state preserved

- [ ] **Step 6: Out-of-scope safety**

- [ ] Navigate to 配置中心 → 一级计划模板 → verify there are NO chevrons and NO expand/collapse buttons in the toolbar
- [ ] Navigate to 横版表格 (L1) → verify no chevrons rendered
- [ ] Config center template editing behaves exactly as before

- [ ] **Step 7: Final build check**

```bash
npx tsc --noEmit && npm run build
```

Both must pass.

- [ ] **Step 8: Optional fixup commit**

If the manual pass surfaced bugs, fix them in small commits. Otherwise this step is a no-op.

---

## Rollback

Each task is its own commit. To rollback, find the relevant commit hashes via `git log --oneline feature/plan-expand-collapse ^master` and `git revert` them in reverse order.

## Out of Scope (do NOT implement)

- localStorage persistence
- "Expand to depth N"
- Keyboard shortcuts
- Complex expand/collapse animations beyond the chevron rotate
- Extracting into a separate component file
- Expand/collapse on `renderHorizontalTable` or config-center template editing
