# tOS Roadmap Project Actions and Filter Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move roadmap conflict/history actions into individual projects, render applied filter chips, and add version/product type tags to evolution cards.

**Architecture:** Keep roadmap data and conflict derivation in `ProjectRoadmapModule`, but add project-scoped drawer state and callbacks passed into both views. Reuse the existing shared `ActiveFilterConditions` component for the applied-filter rail. Keep evolution card title generation unchanged and render non-configurable header tags separately from configurable detail fields.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, repository verification scripts, Playwright CLI.

---

### Task 1: Lock the new interaction contract in the roadmap verifier

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing source-contract assertions**

Add an assertion that requires:

```js
registerAssertion('roadmap exposes project-scoped history, conflict, filters, and card tags', () => {
  const moduleSource = read('src/components/roadmap/ProjectRoadmapModule.tsx')
  const toolbarSource = read('src/components/roadmap/RoadmapToolbar.tsx')
  const tableSource = read('src/components/roadmap/RoadmapTableView.tsx')
  const cardSource = read('src/components/roadmap/RoadmapProjectCard.tsx')

  for (const token of ['activeProjectLogId', 'onOpenProjectHistory', 'ActiveFilterConditions']) {
    if (!moduleSource.includes(token)) throw new Error(`roadmap module is missing ${token}`)
  }
  if (toolbarSource.includes('onResolveConflicts') || toolbarSource.includes('onOpenChangeLog')) {
    throw new Error('roadmap toolbar still exposes global conflict/history actions')
  }
  for (const token of ['HistoryOutlined', 'onOpenProjectHistory', 'onOpenConflict']) {
    if (!tableSource.includes(token)) throw new Error(`roadmap table is missing ${token}`)
  }
  for (const token of ['pms-roadmap-card-header-tags', 'New', 'Old', 'onOpenProjectHistory']) {
    if (!cardSource.includes(token)) throw new Error(`roadmap card is missing ${token}`)
  }
})
```

- [ ] **Step 2: Run the focused verifier and confirm failure**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL on at least one of the new contract tokens before implementation.

### Task 2: Add project-scoped state and applied-filter rail

**Files:**
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`

- [ ] **Step 1: Add project-scoped drawer state and callbacks**

In `ProjectRoadmapModule`, add `activeProjectLogId`, derive `scopedChangeLogs`, and expose this callback through `RoadmapViewRenderContext`:

```tsx
onOpenProjectHistory: (projectId: string) => void

const [activeProjectLogId, setActiveProjectLogId] = useState<string | null>(null)
const scopedChangeLogs = useMemo(
  () => activeProjectLogId
    ? changeLogs.filter(log => log.projectId === activeProjectLogId)
    : [],
  [activeProjectLogId, changeLogs],
)
const openProjectHistory = (projectId: string) => {
  setActiveProjectLogId(projectId)
  setChangeLogOpen(true)
}
```

Pass `scopedChangeLogs` to `RoadmapChangeLogDrawer` and clear `activeProjectLogId` when closing.

- [ ] **Step 2: Remove global conflict/history toolbar inputs**

Delete `conflictCount`, `onResolveConflicts`, `onOpenChangeLog`, `AuditOutlined`, `WarningOutlined`, and their buttons from `RoadmapToolbar`. Preserve version target, maintenance, create, filter, field configuration, and fullscreen actions.

- [ ] **Step 3: Render the applied filter conditions under the toolbar**

Import and render the shared component only when normalized filters exist:

```tsx
<ActiveFilterConditions
  conditions={normalizedFilters}
  definitions={filterFieldDefinitions}
  onEdit={() => {
    setColumnDrawerOpen(false)
    setFilterDrawerOpen(true)
  }}
  onRemove={conditionId => setFilters(
    normalizedFilters.filter(condition => condition.id !== conditionId),
  )}
/>
```

Add a compact “清空” button next to the rail that calls `setFilters([])`; keep brand and product type quick filters synchronized through the existing normalized filter source.

- [ ] **Step 4: Run TypeScript**

Run: `node_modules/.bin/tsc --noEmit`

Expected: PASS.

### Task 3: Add project-level operations to the table

**Files:**
- Modify: `src/components/roadmap/RoadmapTableView.tsx`

- [ ] **Step 1: Extend table props**

Add:

```tsx
onOpenProjectHistory: (projectId: string) => void
```

- [ ] **Step 2: Replace text actions with compact icon actions**

Render a history icon for every project. For planned projects with permission, also render edit and delete. Render the conflict icon only when a planned project has a conflict key:

```tsx
<Tooltip title="历史记录">
  <Button type="text" size="small" aria-label={`查看${row.displayName}历史记录`}
    icon={<HistoryOutlined />} onClick={() => onOpenProjectHistory(row.id)} />
</Tooltip>
{conflictKey ? (
  <Tooltip title="解决冲突">
    <Button type="text" danger size="small" aria-label={`解决${row.displayName}冲突`}
      icon={<WarningOutlined />} onClick={() => onOpenConflict(conflictKey)} />
  </Tooltip>
) : null}
```

Remove the large “已存在正式项目” link from the project-name cell. Keep the conflict row highlight and show actions on row hover/focus.

- [ ] **Step 3: Run the focused verifier**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: The table-related new assertions pass; remaining card assertion may still fail.

### Task 4: Update evolution card header and project actions

**Files:**
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`

- [ ] **Step 1: Forward project history callback**

Add `onOpenProjectHistory` to `RoadmapEvolutionViewProps` and pass it to every `RoadmapProjectCard`.

- [ ] **Step 2: Render fixed header tags without changing the title**

Keep `formatEvolutionCardTitle(row)` unchanged. Render the tags in a non-wrapping header group:

```tsx
<Flex className="pms-roadmap-card-header-tags" gap={4} wrap={false}>
  <Tag color={VERSION_TYPE_TAG_COLORS[row.versionType]}>{row.versionType}</Tag>
  <Tag color={row.productType === '新品' ? 'volcano' : 'default'}>
    {row.productType === '新品' ? 'New' : 'Old'}
  </Tag>
</Flex>
```

Exclude `versionType` and `productType` from `detailColumns` to prevent duplicate values.

- [ ] **Step 3: Move conflict and history into the compact action area**

Remove the full-width conflict link. Add history to all project cards and conditionally add conflict for conflicting planned projects. Keep edit/delete inside the existing smooth collapsible action region for editable planned projects.

- [ ] **Step 4: Adjust local card CSS**

Ensure the title remains ellipsized, the tag group never wraps, icon buttons remain 28px, and the expanded action row transitions without changing adjacent column widths.

- [ ] **Step 5: Run the focused verifier and TypeScript**

Run:

```bash
node scripts/verify-project-roadmap.mjs
node_modules/.bin/tsc --noEmit
```

Expected: PASS.

### Task 5: Visual verification against the supplied screenshots

**Files:**
- Create: `design-qa.md`
- Create: `output/playwright/tos-roadmap-project-actions-table.png`
- Create: `output/playwright/tos-roadmap-project-actions-evolution.png`
- Create: `output/playwright/tos-roadmap-project-actions-filters.png`

- [ ] **Step 1: Start the local app**

Run: `npm run dev -- -p 3005`

Expected: Next.js reports ready at `http://localhost:3005`.

- [ ] **Step 2: Exercise the table interactions**

Open the tOS roadmap table view, hover a formal row and a conflicting planned row, then verify:

- no global conflict/history buttons;
- history exists per project;
- conflict exists only on the conflicting planned row;
- edit/delete remain permission gated;
- the action column does not wrap.

- [ ] **Step 3: Exercise the applied-filter rail**

Add at least three filter conditions, verify their chips, remove one chip, expand/collapse the rail, and clear all filters.

- [ ] **Step 4: Exercise the evolution card**

Switch to evolution view and verify the title is unchanged, `Full/Slim/Go` and `New/Old` appear at the right, details do not duplicate version/product types, and project history/conflict actions open scoped drawers.

- [ ] **Step 5: Write the design QA result**

Create `design-qa.md` with the compared viewport, interaction states, issues found, fixes applied, and the final line:

```text
final result: passed
```

- [ ] **Step 6: Run final verification**

Run:

```bash
node scripts/verify-project-roadmap.mjs
node_modules/.bin/tsc --noEmit
npm run build
git diff --check
```

Expected: all commands pass and the browser console has no new roadmap-specific errors.
