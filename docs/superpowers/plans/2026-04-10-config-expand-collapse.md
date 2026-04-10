# Config Center Expand/Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `plan-expand-collapse` feature so that config center template editing (L1 and L2) also supports single-node expand/collapse and bulk "全部展开 / 全部收起" buttons, with state scoped per (projectType, level, planType).

**Architecture:** Extend the existing `getScopeKey()` helper with a new `config::*` branch so that `renderTaskTable`'s chevron + filter logic — which is already gated on `expandEnabled = scopeKey !== null` — starts firing inside the config center context. Extend `collapseAll()` to pick the right task source for config context. Add the same toolbar buttons already used in project space into the config center toolbar JSX.

**Tech Stack:** Next.js 14 + React 18 + Ant Design 6.3.1 + TypeScript. **No test framework** — verification = `npx tsc --noEmit` + `npm run build` + manual browser verification at `http://localhost:3000`.

**Reference spec:** `docs/superpowers/specs/2026-04-10-config-expand-collapse-design.md`
**Prior feature (now on master)**: `docs/superpowers/specs/2026-04-10-plan-expand-collapse-design.md`

**Before starting:** Read the spec once. Also read the current state of `src/app/page.tsx`:
- `getScopeKey()` definition (around line 1154)
- `collapseAll()` definition (around line 1220–1245)
- `renderTaskTable()` chevron rendering and `visibleTasks` derivation (around line 1740–1820)
- Config center toolbar JSX (around line 3933–3956)
- State declarations `planLevel` / `selectedProjectType` / `selectedPlanType` / `activeModule` (around line 646–648)

---

## File Structure

**Modify (one file):** `src/app/page.tsx`

Three focused changes, all in this single file:

1. Extend `getScopeKey()` with a `config::*` branch (~line 1154)
2. Extend `collapseAll()` to pick config-context task source (~line 1220)
3. Insert expand/collapse buttons into config center toolbar (~line 3948)

Total estimated lines: ~30 added, 0 removed.

---

## Task 1: Extend `getScopeKey()` for config center

**Files:**
- Modify: `src/app/page.tsx` — `getScopeKey` helper (~line 1154)

- [ ] **Step 1: Locate and update `getScopeKey()`**

Find the existing helper in `src/app/page.tsx` (around line 1154). The current code is:

```ts
const getScopeKey = (): string | null => {
  if (activeModule !== 'projectSpace') return null
  if (!selectedProject) return null
  if (projectPlanLevel === 'level1') return `${selectedProject.id}::level1`
  if (projectPlanLevel === 'level2' && activeLevel2Plan) return `${selectedProject.id}::level2::${activeLevel2Plan}`
  return null
}
```

Replace it with:

```ts
const getScopeKey = (): string | null => {
  if (activeModule === 'config') {
    if (planLevel === 'level1') return `config::${selectedProjectType}::level1`
    if (planLevel === 'level2') return `config::${selectedProjectType}::level2::${selectedPlanType}`
    return null
  }
  if (activeModule !== 'projectSpace') return null
  if (!selectedProject) return null
  if (projectPlanLevel === 'level1') return `${selectedProject.id}::level1`
  if (projectPlanLevel === 'level2' && activeLevel2Plan) return `${selectedProject.id}::level2::${activeLevel2Plan}`
  return null
}
```

The new branch is inserted at the top — if we're in config mode, return the config key and exit immediately. Otherwise fall through to the existing projectSpace logic.

**Note**: `planLevel`, `selectedProjectType`, `selectedPlanType` are already existing state variables declared near line 646–648. No new imports needed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(config): extend getScopeKey with config center branch"
```

---

## Task 2: Extend `collapseAll()` to handle config context

**Files:**
- Modify: `src/app/page.tsx` — `collapseAll` helper (~line 1220)

- [ ] **Step 1: Locate and update `collapseAll()`**

Find the existing helper in `src/app/page.tsx` (around line 1220–1245). The current code is:

```ts
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

Replace it with:

```ts
const collapseAll = () => {
  const key = getScopeKey()
  if (!key) return
  let scopeTasks: any[]
  if (activeModule === 'config') {
    // Config center's renderTaskTable uses the shared `tasks` state for both L1 and L2
    scopeTasks = tasks
  } else if (projectPlanLevel === 'level1') {
    scopeTasks = tasks
  } else {
    scopeTasks = level2PlanTasks.filter(t => t.planId === activeLevel2Plan)
  }
  const allParents = getAllExpandableIds(scopeTasks)
  setCollapsedNodes(prev => ({ ...prev, [key]: new Set(allParents) }))
}
```

The `expandAll` function (which just clears the Set) does NOT need updating — it doesn't inspect any tasks array.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(config): extend collapseAll to pick correct task source in config center"
```

---

## Task 3: Add expand/collapse buttons to config center toolbar

**Files:**
- Modify: `src/app/page.tsx` — config center toolbar JSX (~line 3947–3954)

- [ ] **Step 1: Locate the config center toolbar**

Find the JSX block in the config center render path. The surrounding structure is around line 3933–3956:

```tsx
{/* 版本控制 + 工具栏 */}
<Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '10px 16px' } }}>
  <Row justify="space-between" align="middle">
    <Col>
      <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
        <Space size={6}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>版本</span>
          <Select value={currentVersion} ...>
            ...
          </Select>
        </Space>
        {renderActionButtons()}
      </Space>
    </Col>
    <Col>
      <Space size={6}>
        <Input placeholder="搜索任务..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear onChange={(e) => setSearchText(e.target.value)} />
        <Tooltip title="自定义列">
          <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
        </Tooltip>
      </Space>
    </Col>
  </Row>
</Card>
```

You're inserting into the SECOND `<Col>` → `<Space size={6}>` block (the right side), AFTER the "自定义列" Tooltip and BEFORE the closing `</Space>`.

- [ ] **Step 2: Insert the two new buttons**

Replace the second `<Col>` block (the one containing the search input and 自定义列 button) with:

```tsx
<Col>
  <Space size={6}>
    <Input placeholder="搜索任务..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear onChange={(e) => setSearchText(e.target.value)} />
    <Tooltip title="自定义列">
      <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
    </Tooltip>
    {getScopeKey() !== null && (
      <>
        <Tooltip title="全部展开">
          <Button
            icon={<PlusSquareOutlined />}
            style={{ borderRadius: 6 }}
            onClick={expandAll}
          />
        </Tooltip>
        <Tooltip title="全部收起">
          <Button
            icon={<MinusSquareOutlined />}
            style={{ borderRadius: 6 }}
            onClick={collapseAll}
          />
        </Tooltip>
      </>
    )}
  </Space>
</Col>
```

**Note**: The two new buttons do NOT use `size="small"` — they inherit the default size to match the existing "自定义列" button's visual weight. This is intentionally different from the project space toolbar (which uses `size="small"` because its surrounding buttons are also small).

**Note**: `PlusSquareOutlined`, `MinusSquareOutlined`, `expandAll`, `collapseAll`, `getScopeKey` are all already imported/defined from the prior feature. No new imports needed.

- [ ] **Step 3: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

Both must pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(config): add expand-all and collapse-all buttons to config toolbar"
```

---

## Task 4: Manual verification

**Files:** none

- [ ] **Step 1: Ensure dev server is running**

If not already running: `npm run dev`. Open `http://localhost:3000`.

- [ ] **Step 2: Config center L1 checklist**

Navigate to 配置中心 → 计划模板配置 (default Tab) → 软件产品项目 → 一级计划 (default):

- [ ] Toolbar shows the two new buttons (全部展开 ⊞ / 全部收起 ⊟) after the "自定义列" button
- [ ] Rows with children show the down-arrow chevron in the 序号 column
- [ ] Leaf rows show a 14px empty placeholder (column alignment preserved)
- [ ] Click a chevron → its children are hidden; chevron rotates to ▶
- [ ] Click it again → children re-appear
- [ ] Click "全部收起" → all root-level parents collapse
- [ ] Click "全部展开" → full tree restored
- [ ] Enter edit mode → chevron still works, drag handle still works

- [ ] **Step 3: Config center per-projectType isolation**

- [ ] From software project L1 with some nodes collapsed, switch to 整机产品项目 via left sidebar Menu
- [ ] Integer project L1 is fully expanded (independent state)
- [ ] Switch back to 软件产品项目 → previous collapse state preserved

- [ ] **Step 4: Config center L2 and per-planType isolation**

- [ ] Switch to 二级计划 Tab
- [ ] Toolbar still has the two buttons
- [ ] chevron renders on parent rows
- [ ] Collapse some nodes in "需求开发计划" template
- [ ] Switch 模板类型 to "在研版本火车计划" → fully expanded (independent state)
- [ ] Switch back to "需求开发计划" → previous collapse state preserved
- [ ] Switch L2 ↔ L1 → each level's state independent

- [ ] **Step 5: Cross-module isolation (config ↔ project space)**

- [ ] In config center, collapse some nodes
- [ ] Navigate to 项目空间 → select a project → 计划 → one level → state is whatever was set there before (independent)
- [ ] Navigate back to 配置中心 → original config collapse state preserved
- [ ] Verify project space's expand/collapse continues to work for projectSpace state

- [ ] **Step 6: Final build check**

```bash
npx tsc --noEmit && npm run build
```

Both must pass.

- [ ] **Step 7: Optional fixup commit**

If the manual pass surfaced bugs, fix them in small commits. Otherwise this step is a no-op.

---

## Rollback

Each task is its own commit. To rollback, find commits via `git log --oneline feature/config-expand-collapse ^master` and `git revert` in reverse order.

## Out of Scope (do NOT implement)

- Config center gantt support (no UI exists, `setViewMode` never called from config UI)
- L2 template data independence (underlying `tasks` state is shared by L1 and L2 in config — this is a pre-existing mock limitation)
- localStorage persistence
- Any change to project space behavior
