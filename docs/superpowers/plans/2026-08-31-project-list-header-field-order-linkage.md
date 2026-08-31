# Project List Header and Field Order Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow project-list headers and Field Configuration to reorder one shared column order while treating all template-plan columns as one atomic “里程碑” block.

**Architecture:** Add a focused projection module that converts leaf table columns into sortable display units and migrates legacy leaf settings. `ProjectSummaryTable` owns one canonical display-unit setting, expands it back to leaf columns for Ant Table, and exposes the same update function to header DnD and `SortableColumnSettings`.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design Table, dnd-kit, existing static/browser verifier scripts.

---

### Task 1: Define and verify the atomic display-unit model

**Files:**
- Create: `src/lib/projectListColumnOrder.ts`
- Create: `scripts/verify-project-list-header-reorder.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing model contract**

Add verifier cases that import `src/lib/projectListColumnOrder.ts` and assert this public API:

```js
const definitions = [
  { key: 'projectName', title: '项目名', defaultVisible: true, hideable: false, fixed: 'left', source: 'system' },
  { key: 'brand', title: '品牌', defaultVisible: true, hideable: false, source: 'system' },
  { key: 'milestone::STR1', title: 'STR1', defaultVisible: true, hideable: false, source: 'templateTask' },
  { key: 'milestone::STR2', title: 'STR2', defaultVisible: true, hideable: false, source: 'templateTask' },
  { key: 'status', title: '状态', defaultVisible: true, hideable: true, source: 'projectInfo' },
]
const units = columnOrder.buildProjectListColumnUnits(definitions)
assert.deepEqual(units.map(unit => unit.key), ['projectName', 'brand', 'milestone', 'status'])
assert.deepEqual(columnOrder.getProjectListUnitLeafKeys(units, 'milestone'), ['milestone::STR1', 'milestone::STR2'])
assert.deepEqual(
  columnOrder.normalizeProjectListUnitSettings(units, {
    order: ['projectName', 'milestone::STR2', 'status', 'milestone::STR1', 'brand'],
    visible: definitions.map(item => item.key),
  }).order,
  ['projectName', 'milestone', 'status', 'brand'],
)
```

- [ ] **Step 2: Run the verifier and confirm RED**

Run: `node scripts/verify-project-list-header-reorder.mjs`

Expected: FAIL because `src/lib/projectListColumnOrder.ts` does not exist.

- [ ] **Step 3: Implement the minimal projection module**

Create typed helpers around an explicit key and leaf list:

```ts
export const PROJECT_LIST_MILESTONE_UNIT_KEY = 'milestone' as const

export interface ProjectListLeafColumnDefinition extends SortableColumnDefinition<string> {
  source: 'system' | 'projectInfo' | 'templateTask'
}

export interface ProjectListColumnUnitDefinition extends SortableColumnDefinition<string> {
  leafKeys: string[]
  kind: 'field' | 'milestone'
}

export function buildProjectListColumnUnits(
  definitions: readonly ProjectListLeafColumnDefinition[],
): ProjectListColumnUnitDefinition[]

export function normalizeProjectListUnitSettings(
  units: readonly ProjectListColumnUnitDefinition[],
  stored?: Partial<SortableColumnSettingsValue<string>> | readonly string[] | null,
): SortableColumnSettingsValue<string>

export function expandProjectListUnitSettings(
  units: readonly ProjectListColumnUnitDefinition[],
  settings: SortableColumnSettingsValue<string>,
): SortableColumnSettingsValue<string>
```

The normalizer must place a legacy milestone block at the earliest legacy milestone position, keep fixed units first, deduplicate keys, and make the milestone visible only when its leaf block was visible.

- [ ] **Step 4: Run model verification and confirm GREEN**

Run: `node scripts/verify-project-list-header-reorder.mjs`

Expected: PASS for projection, legacy migration, block expansion, visibility, template add/remove, and fixed-column normalization.

- [ ] **Step 5: Register the verifier and commit**

Add:

```json
"verify:project-list-header-reorder": "node scripts/verify-project-list-header-reorder.mjs"
```

Commit:

```bash
git add src/lib/projectListColumnOrder.ts scripts/verify-project-list-header-reorder.mjs package.json
git commit -m "feat: add atomic project list column order model"
```

### Task 2: Move Field Configuration to display units

**Files:**
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `scripts/verify-project-list-header-reorder.mjs`

- [ ] **Step 1: Add failing source and behavior assertions**

Require `ProjectSummaryTable` to build `columnUnitDefinitions`, normalize stored preferences through `normalizeProjectListUnitSettings`, and pass unit definitions to `SortableColumnSettings`. Assert the settings list contains exactly one label `里程碑` and no template-task titles.

- [ ] **Step 2: Run the verifier and confirm RED**

Run: `npm run verify:project-list-header-reorder`

Expected: FAIL because `ProjectSummaryTable` still passes leaf definitions.

- [ ] **Step 3: Implement canonical display-unit state**

Extend the local leaf definition passed into the projection with its source:

```ts
const leafColumnDefinitions = useMemo(() => fieldDefinitions.map(definition => ({
  key: definition.key,
  title: definition.title,
  source: definition.source,
  defaultVisible: definition.defaultVisible,
  hideable: definition.hideable,
  fixed: fixedColumnKeys.has(definition.key) ? 'left' : undefined,
})), [fieldDefinitions, fixedColumnKeys])

const columnUnitDefinitions = useMemo(
  () => buildProjectListColumnUnits(leafColumnDefinitions),
  [leafColumnDefinitions],
)
```

Store unit settings in `columnSettings`; derive leaf settings only for rendering. Read legacy stored leaf settings through the unit normalizer and persist unit keys on subsequent updates.

- [ ] **Step 4: Connect Field Configuration to the same state**

```tsx
<SortableColumnSettings
  definitions={columnUnitDefinitions}
  value={columnSettings}
  defaultValue={getDefaultColumnSettings(columnUnitDefinitions)}
  onApply={applyColumnSettings}
  ...
/>
```

The milestone unit title must be `里程碑`, and its visibility toggle must expand to every milestone leaf.

- [ ] **Step 5: Run focused and existing field-setting verification**

Run:

```bash
npm run verify:project-list-header-reorder
npm run verify:column-settings
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/project-summary/ProjectSummaryTable.tsx scripts/verify-project-list-header-reorder.mjs
git commit -m "feat: group project milestones in field settings"
```

### Task 3: Add draggable table-header units

**Files:**
- Create: `src/components/project-summary/SortableProjectListHeader.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-project-list-header-reorder.mjs`

- [ ] **Step 1: Write failing header-DnD assertions**

Assert that the table renders a `DndContext` with horizontal sorting, uses a `PointerSensor` activation distance, exposes `data-project-list-column-unit`, and sends both ordinary and grouped milestone headers to one `handleHeaderDragEnd` function.

- [ ] **Step 2: Run verifier and confirm RED**

Run: `npm run verify:project-list-header-reorder`

Expected: FAIL because no sortable header component exists.

- [ ] **Step 3: Implement a focused sortable header wrapper**

Create a component using `useSortable` and a drag handle region:

```tsx
export function SortableProjectListHeader({ unitKey, locked, children, ...cellProps }: Props) {
  const sortable = useSortable({ id: unitKey, disabled: locked })
  return (
    <th
      {...cellProps}
      ref={sortable.setNodeRef}
      data-project-list-column-unit={unitKey}
      className={[cellProps.className, 'pms-project-list-sortable-header', sortable.isDragging ? 'is-dragging' : '']
        .filter(Boolean)
        .join(' ')}
      {...(!locked ? sortable.attributes : {})}
      {...(!locked ? sortable.listeners : {})}
    >{children}</th>
  )
}
```

Use an activation constraint such as `{ distance: 6 }` to protect normal clicks.

- [ ] **Step 4: Map leaf and grouped headers to unit keys**

Ordinary columns receive their own key. Every milestone group header and milestone child header receives `milestone`. The drag-end handler calls `moveColumnSetting(columnUnitDefinitions, columnSettings.order, active, over)` and then the same `applyColumnSettings` used by Field Configuration.

- [ ] **Step 5: Add visual feedback and fixed-region constraints**

Add compact cursor, dragging opacity, outline, and placeholder styles. Keep fixed unit headers locked; `moveColumnSetting` must prevent insertion before fixed units.

- [ ] **Step 6: Run focused verification**

Run: `npm run verify:project-list-header-reorder`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/project-summary/SortableProjectListHeader.tsx src/components/project-summary/ProjectSummaryTable.tsx src/styles/globals.css scripts/verify-project-list-header-reorder.mjs
git commit -m "feat: reorder project list columns from table headers"
```

### Task 4: Browser acceptance for bidirectional linkage

**Files:**
- Create: `screenshots/verify-project-list-header-reorder-browser.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the browser scenarios**

The script must clear only the relevant `pms:project-summary:*` preference, enter a matrix project list, and verify:

```js
await dragHeader('品牌', '状态')
assert.deepEqual(await visibleUnitOrder(), await fieldSettingsOrder())
await dragFieldSetting('里程碑', '品牌')
assertMilestoneLeavesAreContiguous(await leafHeaderOrder())
await toggleFieldSetting('里程碑', false)
assert.equal(await milestoneLeafCount(), 0)
await page.reload({ waitUntil: 'networkidle0' })
assert.deepEqual(await visibleUnitOrder(), expectedPersistedOrder)
```

Also verify the fixed header lacks draggable state and technical/tOS variants keep existing table behavior.

- [ ] **Step 2: Run against the pre-feature baseline and confirm RED**

Run local dev server, then:

`node screenshots/verify-project-list-header-reorder-browser.mjs`

Expected: FAIL at the first header drag.

- [ ] **Step 3: Stabilize only selectors and waits required by the real UI**

Use semantic labels and `data-project-list-column-unit`; do not mutate application state through `page.evaluate` to fake drag results.

- [ ] **Step 4: Run browser acceptance and confirm GREEN**

Run: `node screenshots/verify-project-list-header-reorder-browser.mjs`

Expected: all scenarios PASS with no page errors, console errors, or failed HTTP responses.

- [ ] **Step 5: Register and commit**

Add `verify:project-list-header-reorder-browser` to `package.json`, then:

```bash
git add screenshots/verify-project-list-header-reorder-browser.mjs package.json
git commit -m "test: verify project list header reorder linkage"
```

### Task 5: Regression and production-build gate

**Files:**
- Modify only files required by failures proven in this task.

- [ ] **Step 1: Run project-list regressions**

```bash
npm run verify:project-list-header-reorder
npm run verify:column-settings
npm run verify:project-list-matrix
npm run verify:project-list-refinement
npm run verify:project-field-order
```

Expected: every command exits 0.

- [ ] **Step 2: Run browser acceptance**

Run: `npm run verify:project-list-header-reorder-browser`

Expected: all scenarios PASS.

- [ ] **Step 3: Stop the dev server and run full compile gates**

```bash
npx tsc --noEmit
npm run build
```

Expected: both exit 0; build reports successful compilation and eight generated static pages.

- [ ] **Step 4: Review diff and commit any evidence-driven fixes**

```bash
git diff --check
git status --short
```

If verification required a code fix, commit only those proven files with a focused message. Leave the branch available for local review.
