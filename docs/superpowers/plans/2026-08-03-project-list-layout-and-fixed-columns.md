# Project List Layout and Fixed Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place project-list actions on the category row, render exactly one technical-project table selected by a two-value type filter, and pin the required identity columns during horizontal scrolling.

**Architecture:** Keep `ProjectListContainer` as the owner of category/type selection and conditional rendering. Put the fixed-column mapping in `projectListMatrix.ts` so the table renderer and contract tests share one source of truth, then have `ProjectSummaryTable` apply that mapping to Ant Design columns. Preserve the existing controlled filter array so technical quick filters and the floating filter panel continue to use the same state.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Node source-contract scripts.

---

### Task 1: Lock the technical type and fixed-column contracts

**Files:**
- Modify: `scripts/verify-project-list-matrix.mjs`
- Modify: `scripts/verify-workbench-project-list.mjs`
- Modify: `src/lib/projectListMatrix.ts`

- [ ] **Step 1: Write failing matrix assertions**

Change the technical type expectation and add exact fixed-key assertions:

```js
assert.deepEqual(matrix.TECHNICAL_PROJECT_TYPE_OPTIONS, [
  { label: 'TDT项目', value: 'tdt' },
  { label: '子项目', value: 'subproject' },
])
assert.equal(matrix.resolveTechnicalProjectType([]), 'tdt')
assert.equal(matrix.resolveTechnicalProjectType(['tdt']), 'tdt')
assert.equal(matrix.resolveTechnicalProjectType(['subproject']), 'subproject')
assert.deepEqual(matrix.getProjectListFixedColumnKeys('machine'), ['productSeries', 'projectName'])
assert.deepEqual(matrix.getProjectListFixedColumnKeys('tos'), ['tosVersion'])
assert.deepEqual(matrix.getProjectListFixedColumnKeys('technical-tdt'), ['projectName'])
assert.deepEqual(matrix.getProjectListFixedColumnKeys('technical-subproject'), ['projectName'])
```

Update the source-contract script to require a single technical table branch and reject the old all-option/stack behavior:

```js
assert.match(source, /technicalActiveType === 'tdt'/)
assert.match(source, /TECHNICAL_PROJECT_TYPE_OPTIONS\.map/)
assert.doesNotMatch(source, /technicalTypeVisibility\.showBoth/)
```

- [ ] **Step 2: Run the focused contracts and verify failure**

Run:

```bash
node scripts/verify-project-list-matrix.mjs
node scripts/verify-workbench-project-list.mjs
```

Expected: FAIL because the current options include `全部`, visibility defaults to both tables, and fixed-key helpers do not exist.

- [ ] **Step 3: Implement the matrix helpers**

Replace the three-value option set and visibility resolver with:

```ts
export const TECHNICAL_PROJECT_TYPE_OPTIONS = [
  { label: 'TDT项目', value: 'tdt' },
  { label: '子项目', value: 'subproject' },
] as const

export type TechnicalProjectListType = typeof TECHNICAL_PROJECT_TYPE_OPTIONS[number]['value']

export function resolveTechnicalProjectType(values: readonly string[]): TechnicalProjectListType {
  return values.includes('subproject') ? 'subproject' : 'tdt'
}

const PROJECT_LIST_FIXED_COLUMN_KEYS: Record<ProjectListVariant, readonly string[]> = {
  machine: ['productSeries', 'projectName'],
  tos: ['tosVersion'],
  'technical-tdt': ['projectName'],
  'technical-subproject': ['projectName'],
  capability: [],
}

export function getProjectListFixedColumnKeys(variant: ProjectListVariant): string[] {
  return [...PROJECT_LIST_FIXED_COLUMN_KEYS[variant]]
}
```

- [ ] **Step 4: Run the matrix contract**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the contract and helper**

```bash
git add scripts/verify-project-list-matrix.mjs scripts/verify-workbench-project-list.mjs src/lib/projectListMatrix.ts
git commit -m "test: define project list selection and fixed columns"
```

### Task 2: Implement the category-row actions and single technical table

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Replace visibility state with one active type**

Initialize the controlled type filter to TDT and resolve a single active value:

```ts
const [technicalFilters, setTechnicalFilters] = useState<AnyFilterCondition[]>(() => (
  updateLinkedQuickFilterCondition([], 'technicalProjectType', ['tdt'])
))
const technicalSelectedTypes = getLinkedQuickFilterValues(technicalFilters, 'technicalProjectType')
const technicalActiveType = resolveTechnicalProjectType(technicalSelectedTypes)
```

Each type button writes exactly one value:

```tsx
{TECHNICAL_PROJECT_TYPE_OPTIONS.map(item => (
  <button
    type="button"
    key={item.value}
    onClick={() => setTechnicalFilters(current => updateLinkedQuickFilterCondition(
      current,
      'technicalProjectType',
      [item.value],
    ))}
    className={technicalActiveType === item.value
      ? 'pms-project-filter-chip is-active'
      : 'pms-project-filter-chip'}
  >
    {item.label}
  </button>
))}
```

- [ ] **Step 2: Move actions into the category row**

Delete the standalone action row. Add a flex spacer and one non-wrapping action group after the category buttons:

```tsx
<div className="pms-project-list-category-actions">
  {projectTypeFilter !== PROJECT_CATEGORY_TECH && (
    <Input
      aria-label="搜索项目名称"
      placeholder="搜索项目名称..."
      prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
      allowClear
      value={projectSearchText2}
      onChange={event => {
        setProjectSearchText2(event.target.value)
        setProjectCardPage(1)
      }}
    />
  )}
  <Segmented
    aria-label="项目列表视图"
    size="small"
    value={projectListView}
    onChange={value => setProjectListView(value as 'card' | 'list')}
    options={[
      { label: <Tooltip title="卡片视图"><span aria-label="卡片视图"><AppstoreOutlined /></span></Tooltip>, value: 'card' },
      { label: <Tooltip title="列表视图"><span aria-label="列表视图"><UnorderedListOutlined /></span></Tooltip>, value: 'list' },
    ]}
  />
  {isAdminUser && (
    <Button aria-label="新增项目" type="primary" icon={<PlusOutlined />} onClick={() => setAddProjectOpen(true)}>
      新增项目
    </Button>
  )}
</div>
```

Use scoped CSS so the group stays at the far right and remains coherent when category chips wrap:

```css
.pms-project-list-category-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  white-space: nowrap;
}
```

- [ ] **Step 3: Render one technical table**

Replace the stacked conditional sections with a single conditional branch:

```tsx
<div className="pms-technical-list-panel">
  {technicalActiveType === 'tdt' ? (
    <ProjectSummaryTable
      projects={[]}
      optionProjects={[]}
      planTasksByProjectId={{}}
      projectType={PROJECT_CATEGORY_TECH}
      versions={versions}
      currentVersion={currentVersion}
      publishedSnapshots={publishedSnapshots}
      currentTemplateTasks={technicalTdtTemplate}
      matrixTemplateTasks={technicalTdtTemplate}
      matrixVariant="technical-tdt"
      providedRows={technicalRows.tdt}
      storageNamespace="project-list-technical-tdt"
      onViewProject={() => undefined}
      onViewRow={enterSummaryRow}
      controlledFilters={technicalFilters}
      onFiltersChange={setTechnicalFilters}
    />
  ) : (
    <ProjectSummaryTable
      projects={[]}
      optionProjects={[]}
      planTasksByProjectId={{}}
      projectType={PROJECT_CATEGORY_TECH}
      versions={versions}
      currentVersion={currentVersion}
      publishedSnapshots={publishedSnapshots}
      currentTemplateTasks={technicalSubprojectTemplate}
      matrixTemplateTasks={technicalSubprojectTemplate}
      matrixVariant="technical-subproject"
      providedRows={technicalRows.children}
      storageNamespace="project-list-technical-subproject"
      onViewProject={() => undefined}
      onViewRow={enterSummaryRow}
      controlledFilters={technicalFilters}
      onFiltersChange={setTechnicalFilters}
    />
  )}
</div>
```

Remove the obsolete section titles and stack CSS.

- [ ] **Step 4: Run focused source contracts**

Run:

```bash
node scripts/verify-workbench-project-list.mjs
node scripts/verify-workbench-split.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the layout and selection behavior**

```bash
git add src/containers/ProjectListContainer.tsx src/styles/globals.css scripts/verify-workbench-project-list.mjs
git commit -m "fix: streamline technical project list layout"
```

### Task 3: Apply fixed columns and run full regression

**Files:**
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `scripts/verify-project-list-matrix.mjs`
- Modify: `scripts/verify-workbench-project-list.mjs`
- Modify: `screenshots/verify-workbench-technical-project-redesign.mjs`

- [ ] **Step 1: Add a failing source assertion for fixed column application**

Require `ProjectSummaryTable` to import and use the shared helper:

```js
assert.match(summarySource, /getProjectListFixedColumnKeys/)
assert.match(summarySource, /fixedColumnKeys\.has\(definition\.key\)/)
```

Run: `node scripts/verify-workbench-project-list.mjs`

Expected: FAIL until the renderer applies the helper.

- [ ] **Step 2: Apply fixed keys to Ant Design columns**

In `ProjectSummaryTable`, compute the active fixed-key set and preserve it in both column settings metadata and rendered columns:

```ts
const fixedColumnKeys = useMemo(
  () => new Set(matrixVariant ? getProjectListFixedColumnKeys(matrixVariant) : ['projectName']),
  [matrixVariant],
)

fixed: fixedColumnKeys.has(definition.key) ? 'left' : undefined,
```

When constructing `tableColumnByKey`, replace the unconditional matrix reset with:

```ts
const fixed = fixedColumnKeys.has(String(column.key)) ? 'left' as const : undefined
return [String(column.key), { ...column, fixed }]
```

Use `className="pms-table pms-project-summary-table"` so existing Ant Design fixed-cell backgrounds remain scoped and opaque.

- [ ] **Step 3: Run all focused project-list contracts**

Run:

```bash
node scripts/verify-project-list-matrix.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-workbench-split.mjs
node scripts/verify-project-summary.mjs
```

Expected: all PASS.

- [ ] **Step 4: Run repository verification**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: type-check and production build complete successfully. A stale `caniuse-lite` warning is acceptable; TypeScript or Next.js errors are not.

- [ ] **Step 5: Exercise the browser flows**

Start the app and run the existing browser suite:

```bash
npm run dev -- --port 3004
PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:redesign-browser
```

Manually verify at desktop width:

1. The category row ends with view switch and “新增项目”.
2. Technical type defaults to TDT, has no “全部”, and each click replaces rather than appends a table.
3. Horizontal scrolling pins the specified machine, tOS, TDT, and child-project columns.
4. The final milestone column remains reachable and aligned.

Expected: automated browser suite passes and no console errors appear during manual checks.

- [ ] **Step 6: Commit the renderer and regression updates**

```bash
git add src/components/project-summary/ProjectSummaryTable.tsx scripts/verify-project-list-matrix.mjs scripts/verify-workbench-project-list.mjs screenshots/verify-workbench-technical-project-redesign.mjs
git commit -m "fix: pin project list identity columns"
```
