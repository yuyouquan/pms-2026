# Machine Project List Hierarchical Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the whole-machine project list's single product-series grouping with the approved brand → product line → product series → project hierarchy, exact screenshot column order, product-series-only collapse, and required field-configuration locks.

**Architecture:** Keep field metadata and pure hierarchy calculations in `projectListMatrix.ts`, then let `ProjectSummaryTable` consume row metadata to render merged cells and the product-series toggle. Pagination continues to be owned by Ant Design, but row spans are calculated per current page while project counts come from the complete filtered result set. The project-list container opts machine tables into the new hierarchy without changing card or calendar behavior.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6 Table, Zustand, Node source-contract verification scripts.

---

### Task 1: Lock the machine field matrix contract

**Files:**
- Modify: `scripts/verify-project-list-matrix.mjs`
- Modify: `src/lib/projectListMatrix.ts`

- [ ] **Step 1: Write the failing matrix assertions**

Add an exact machine-column contract to `scripts/verify-project-list-matrix.mjs`:

```js
const machineRequiredLabels = [
  '品牌', '产品线', '产品系列', '项目数', '市场名', '项目名',
  '版本类型', '首销tOS版本', '产品类型', '研发模式', '安卓版本', '芯片编码',
]
const machineTailLabels = ['SPM', 'SPM部门（二级部门）']
const machineColumns = matrix.getProjectListMatrix('machine', {
  templateTasks: [
    { id: 'concept', taskName: '概念', order: 1 },
    { id: 'concept-start', parentId: 'concept', taskName: '概念启动', order: 1 },
    { id: 'str1', parentId: 'concept', taskName: 'STR1', order: 2 },
  ],
})
assert.deepEqual(
  machineColumns.map(column => column.label),
  [...machineRequiredLabels, '概念启动', 'STR1', ...machineTailLabels],
)
assert.ok(machineColumns.every(column => column.required && column.hideable === false))
assert.deepEqual(matrix.getProjectListFixedColumnKeys('machine'), [])
```

- [ ] **Step 2: Run the matrix contract and verify it fails**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: FAIL because machine columns still begin with `产品系列` and machine fixed columns are still configured.

- [ ] **Step 3: Implement the exact machine matrix**

Update `src/lib/projectListMatrix.ts` so the machine static fields are:

```ts
machine: [
  required('brand', '品牌', 112),
  required('productLine', '产品线', 120),
  required('productSeries', '产品系列', 148),
  required('projectCount', '项目数', 88),
  required('marketName', '市场名', 150),
  required('projectName', '项目名', 200),
  required('versionType', '版本类型', 112),
  required('firstSaleTosVersion', '首销tOS版本', 128),
  required('productType', '产品类型', 112),
  required('developMode', '研发模式', 112),
  required('androidVersion', '安卓版本', 112),
  required('chipCode', '芯片编码', 120),
  required('spm', 'SPM', 112),
  required('spmDepartment', 'SPM部门（二级部门）', 180),
]
```

Set the machine fixed-column array to `[]`. For template-backed machine columns, insert milestones after `chipCode` and before `spm`; keep all screenshot columns and all generated milestone columns `required: true` and `hideable: false`. Optional project-basic-information fields remain appended with `required: false` and `hideable: true`.

- [ ] **Step 4: Run the matrix contract and verify it passes**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: `project list matrix contract passed`.

- [ ] **Step 5: Commit the matrix contract**

```bash
git add scripts/verify-project-list-matrix.mjs src/lib/projectListMatrix.ts
git commit -m "feat: align machine project list fields"
```

### Task 2: Build page-local hierarchical row metadata

**Files:**
- Modify: `scripts/verify-project-list-matrix.mjs`
- Modify: `src/lib/projectListMatrix.ts`

- [ ] **Step 1: Write failing hierarchy and collapse tests**

Add tests for a pure `buildMachineProjectHierarchyPage` helper:

```js
const hierarchyRows = [
  { key: '1', projectId: '1', brand: 'TECNO', productLine: 'CAMON', productSeries: 'CAMON 60' },
  { key: '2', projectId: '2', brand: 'TECNO', productLine: 'CAMON', productSeries: 'CAMON 60' },
  { key: '3', projectId: '3', brand: 'TECNO', productLine: 'CAMON', productSeries: 'CAMON 70' },
  { key: '4', projectId: '4', brand: 'Infinix', productLine: '-', productSeries: '' },
]
const hierarchy = matrix.buildMachineProjectHierarchyPage(hierarchyRows, hierarchyRows, new Set())
assert.deepEqual(hierarchy.map(row => [
  row.projectId, row.__brandRowSpan, row.__productLineRowSpan,
  row.__productSeriesRowSpan, row.__productSeriesProjectCount,
]), [
  ['1', 3, 3, 2, 2],
  ['2', 0, 0, 0, 2],
  ['3', 0, 0, 1, 1],
  ['4', 1, 1, 1, 1],
])
const collapsed = matrix.buildMachineProjectHierarchyPage(
  hierarchyRows,
  hierarchyRows,
  new Set(['TECNO::CAMON::CAMON 60']),
)
assert.deepEqual(collapsed.map(row => row.projectId), ['1', '3', '4'])
assert.equal(collapsed[0].__productSeriesProjectCount, 2)
```

Also assert that blank values normalize to `未配置品牌`, `未配置产品线`, and `未配置产品系列`, and that identical series names under different brands or product lines do not merge.

- [ ] **Step 2: Run the hierarchy contract and verify it fails**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: FAIL with `buildMachineProjectHierarchyPage is not a function`.

- [ ] **Step 3: Implement the hierarchy helper**

Add exported row metadata and helper types in `src/lib/projectListMatrix.ts`:

```ts
export interface MachineProjectHierarchyMetadata {
  __brandKey: string
  __brandLabel: string
  __brandRowSpan: number
  __productLineKey: string
  __productLineLabel: string
  __productLineRowSpan: number
  __productSeriesKey: string
  __productSeriesLabel: string
  __productSeriesRowSpan: number
  __productSeriesProjectCount: number
  __productSeriesCollapsed: boolean
}
```

Implement `buildMachineProjectHierarchyPage(allFilteredRows, pageRows, collapsedSeries)` to:

1. Normalize blank, `-`, and `—` hierarchy values to the approved fallback labels.
2. Build compound keys using brand + product line + product series, so same-named series in different parents never merge.
3. Count every series over `allFilteredRows` before page slicing/collapse.
4. Keep only the first row for a collapsed series within `pageRows`.
5. Calculate brand, product-line, and series row spans only over the visible page rows.
6. Preserve stable input order and attach metadata without mutating the source rows.

- [ ] **Step 4: Run the hierarchy contract and verify it passes**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: `project list matrix contract passed`.

- [ ] **Step 5: Commit the hierarchy helper**

```bash
git add scripts/verify-project-list-matrix.mjs src/lib/projectListMatrix.ts
git commit -m "feat: add machine list hierarchy metadata"
```

### Task 3: Render merged machine hierarchy cells

**Files:**
- Modify: `scripts/verify-workbench-project-list.mjs`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/containers/ProjectListContainer.tsx`

- [ ] **Step 1: Write failing source and integration assertions**

Extend `scripts/verify-workbench-project-list.mjs` to require:

```js
assert.match(summarySource, /buildMachineProjectHierarchyPage/)
assert.match(summarySource, /__brandRowSpan/)
assert.match(summarySource, /__productLineRowSpan/)
assert.match(summarySource, /__productSeriesRowSpan/)
assert.match(summarySource, /__productSeriesProjectCount/)
assert.match(summarySource, /collapsedMachineSeries/)
assert.match(projectListSource, /machineHierarchy=\{standardMatrixVariant === 'machine'\}/)
```

Remove the old assertion that machine tables are wired only through `groupBy.productSeries`.

- [ ] **Step 2: Run the workbench contract and verify it fails**

Run: `node scripts/verify-workbench-project-list.mjs`

Expected: FAIL because the table has no machine-hierarchy prop or metadata rendering.

- [ ] **Step 3: Add the machine hierarchy table contract**

In `ProjectSummaryTable.tsx`:

```ts
machineHierarchy?: boolean
```

Maintain `collapsedMachineSeries: Set<string>`. When table pagination is enabled, derive `pageRows` from the full filtered rows and call `buildMachineProjectHierarchyPage(filteredRows, pageRows, collapsedMachineSeries)`. Disable Ant Design's internal data slicing for this path but keep the existing small pagination control with `total: filteredRows.length`; other variants keep their current behavior.

For the machine columns:

- `brand`: render `__brandLabel`, `rowSpan: __brandRowSpan`.
- `productLine`: render `__productLineLabel`, `rowSpan: __productLineRowSpan`.
- `productSeries`: render the only expand/collapse control using `__productSeriesKey`, label and full count; `rowSpan: __productSeriesRowSpan`.
- `projectCount`: render `__productSeriesProjectCount`; use the same series row span.
- All project detail and milestone columns render normally.
- Clicking a merged hierarchy cell does not suppress project row navigation except the series-toggle button, which stops propagation.

In `ProjectListContainer.tsx`, pass `machineHierarchy={standardMatrixVariant === 'machine'}` to all three shared table instances and remove their machine `groupBy` wiring. Card and calendar views keep their existing data and filters.

- [ ] **Step 4: Run focused contracts**

Run:

```bash
node scripts/verify-project-list-matrix.mjs
node scripts/verify-workbench-project-list.mjs
```

Expected: both scripts pass.

- [ ] **Step 5: Commit hierarchy rendering**

```bash
git add scripts/verify-workbench-project-list.mjs src/components/project-summary/ProjectSummaryTable.tsx src/containers/ProjectListContainer.tsx
git commit -m "feat: render hierarchical machine project list"
```

### Task 4: Polish compact hierarchy presentation

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Add failing style-contract assertions**

Require the dedicated hierarchy classes:

```js
assert.match(globalStyles, /\.pms-machine-hierarchy-cell/)
assert.match(globalStyles, /\.pms-machine-series-toggle/)
assert.match(globalStyles, /white-space:\s*nowrap/)
```

- [ ] **Step 2: Run the workbench contract and verify it fails**

Run: `node scripts/verify-workbench-project-list.mjs`

Expected: FAIL because hierarchy-specific compact styles do not exist.

- [ ] **Step 3: Add compact hierarchy styles**

Add styles that keep brand, product line, series, and project count vertically centered; prevent hierarchy labels from wrapping; ellipsize long values with tooltip support; keep the toggle icon and series label on one line; and preserve the existing 12px compact table density. Do not add sticky positioning or card-like backgrounds to merged cells.

- [ ] **Step 4: Run focused contracts**

Run:

```bash
node scripts/verify-project-list-matrix.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-compact-ui-density.mjs
```

Expected: all scripts pass.

- [ ] **Step 5: Commit the visual polish**

```bash
git add src/styles/globals.css scripts/verify-workbench-project-list.mjs
git commit -m "style: polish machine hierarchy cells"
```

### Task 5: Full verification and browser acceptance

**Files:**
- Verify only: `src/lib/projectListMatrix.ts`
- Verify only: `src/components/project-summary/ProjectSummaryTable.tsx`
- Verify only: `src/containers/ProjectListContainer.tsx`
- Verify only: `src/styles/globals.css`

- [ ] **Step 1: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: exit code 0 with no diagnostics.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Next.js build completes successfully.

- [ ] **Step 3: Start the local application**

Run: `npm run dev`

Expected: Next.js reports a reachable localhost URL.

- [ ] **Step 4: Manually verify the machine list**

In the browser, open 项目列表 → 整机产品项目 → 列表视图 and verify:

1. Default fields follow the approved screenshot order.
2. Brand and product line are merged but have no expand/collapse affordance.
3. Product series is merged and is the only hierarchy level with expand/collapse.
4. Project count remains the full filtered series count when collapsed.
5. Missing hierarchy values display approved fallback labels.
6. Changing filters, page, category, or 我的/全部 does not create row-span gaps or overlaps.
7. Clicking an accessible project row enters project space; the series toggle only expands/collapses.
8. 字段配置 marks every screenshot field and every active milestone field 必显 and does not allow hiding them; additional basic-information fields remain configurable.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git status --short
git diff --check
git log --oneline --decorate -5
```

Expected: no whitespace errors, only planned files changed, and all feature commits are present.
