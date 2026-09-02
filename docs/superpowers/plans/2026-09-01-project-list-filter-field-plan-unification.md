# Project List, Filter, and Level-1 Plan Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved project-list quick filters and field matrices, system-wide filter operators, level-1 plan toolbar changes, and the joint-plan rename without changing unrelated project or plan behavior.

**Architecture:** Keep `filterConditions.ts` as the canonical filtering contract and make every filter surface consume operator metadata from it. Keep `projectListMatrix.ts` as the single source for list order/default visibility, while `ProjectSummaryTable` adapts the matrix into grouped column units and persisted settings. Render quick filters in `ProjectListContainer` so all project-list display modes share one controlled condition set.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, source-contract Node scripts, Playwright browser scripts.

---

### Task 1: Unify text, enum, and date filter contracts

**Files:**
- Modify: `scripts/verify-filter-conditions.mjs`
- Modify: `src/lib/filterConditions.ts`
- Modify: `src/components/project-list/ActiveFilterConditions.tsx`

- [ ] **Step 1: Write failing contract assertions**

Add assertions that `createFilterCondition()` defaults to `contains`, text and enum operators expose the approved six labels, date operators expose `等于/不等于/早于/晚于/为空/不为空`, and enum cardinality is derived from the active operator.

```js
assert.equal(createFilterCondition().operator, 'contains')
assert.deepEqual(ENUM_FILTER_OPERATORS.map(item => item.label), ['等于', '不等于', '包含', '不包含', '为空', '不为空'])
assert.deepEqual(DATE_FILTER_OPERATORS.map(item => item.label), ['等于', '不等于', '早于', '晚于', '为空', '不为空'])
assert.equal(isMultiValueFilterOperator('contains', 'enum'), true)
assert.equal(isMultiValueFilterOperator('notContains', 'enum'), true)
assert.equal(isMultiValueFilterOperator('equals', 'enum'), false)
```

- [ ] **Step 2: Run the focused contract and verify failure**

Run: `node scripts/verify-filter-conditions.mjs`

Expected: FAIL because enum operators do not include contains/notContains, date emptiness is missing, and the default is still equals.

- [ ] **Step 3: Implement the canonical operator metadata**

Export the approved operator lists and cardinality helper. Keep `equalsAny` accepted only for legacy normalization.

```ts
export const ENUM_FILTER_OPERATORS = TEXT_FILTER_OPERATORS

export const DATE_FILTER_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'before', label: '早于' },
  { value: 'after', label: '晚于' },
  { value: 'isEmpty', label: '为空' },
  { value: 'isNotEmpty', label: '不为空' },
] as const

export const createFilterCondition = (): FilterCondition => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  field: '',
  operator: 'contains',
  value: '',
})

export const isMultiValueFilterOperator = (
  operator: FilterOperator,
  kind: FilterFieldKind,
) => kind === 'enum' && (operator === 'contains' || operator === 'notContains')
```

Update normalization and matching so enum contains matches any selected value and enum notContains rejects any row matching a selected value. Convert stored `equalsAny` to `contains` with an array.

- [ ] **Step 4: Verify the shared engine**

Run: `node scripts/verify-filter-conditions.mjs`

Expected: PASS, including text substring, enum single/multiple, empty values, dates, legacy migration, and AND composition.

- [ ] **Step 5: Commit the filter contract**

```bash
git add scripts/verify-filter-conditions.mjs src/lib/filterConditions.ts src/components/project-list/ActiveFilterConditions.tsx
git commit -m "feat: unify system filter operators"
```

### Task 2: Apply operator-aware value controls to all filter surfaces

**Files:**
- Create: `src/components/shared/FilterConditionValue.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/components/plans/Level3PlanModule.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/roadmap/MilestoneView.tsx`
- Modify: `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- Modify: `src/components/roadmap/RoadmapFilterDrawer.tsx`
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `scripts/verify-project-summary.mjs`
- Modify: `scripts/verify-level3-plan.mjs`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing source and behavior assertions**

Assert every listed filter surface imports the shared value control, no enum operator selector is forcibly disabled, and field changes choose `contains` for text/enum and `equals` for dates.

```js
assert.match(summarySource, /FilterConditionValue/)
assert.doesNotMatch(summarySource, /disabled=\{definition\?\.multiple\}/)
assert.match(summarySource, /getDefaultFilterOperator\(definition\?\.kind/)
```

- [ ] **Step 2: Run the affected contracts and verify failure**

Run: `node scripts/verify-project-summary.mjs && node scripts/verify-level3-plan.mjs && node scripts/verify-project-roadmap.mjs`

Expected: FAIL because filter surfaces still render separate inputs and old enum operator lists.

- [ ] **Step 3: Create the shared value renderer**

The component must render no control for empty operators, a `DatePicker` for date values, a searchable single `Select` for enum equals/notEquals, a searchable multi `Select` for enum contains/notContains, and an `Input` for text values.

```tsx
export function FilterConditionValue(props: FilterConditionValueProps) {
  const { definition, condition, onChange } = props
  if (isValuelessFilterOperator(condition.operator)) return <span className="pms-filter-value-placeholder" />
  if (definition?.kind === 'date') return <DatePicker value={toDayjs(condition.value)} onChange={value => onChange(value?.format('YYYY-MM-DD') ?? '')} />
  if (definition?.kind === 'enum') return (
    <Select
      showSearch
      allowClear
      mode={isMultiValueFilterOperator(condition.operator, 'enum') ? 'multiple' : undefined}
      options={definition.options}
      value={condition.value || undefined}
      onChange={onChange}
    />
  )
  return <Input value={String(condition.value ?? '')} onChange={event => onChange(event.target.value)} />
}
```

- [ ] **Step 4: Replace per-page value controls and normalize on field/operator change**

Use `getDefaultFilterOperator(kind)` so text/enum fields start with contains and dates start with equals. When an operator changes between single and multiple, reset the value rather than retaining an incompatible shape.

- [ ] **Step 5: Re-run all affected contracts**

Run: `node scripts/verify-filter-conditions.mjs && node scripts/verify-project-summary.mjs && node scripts/verify-level3-plan.mjs && node scripts/verify-project-roadmap.mjs && node scripts/verify-technical-plan.mjs`

Expected: PASS.

- [ ] **Step 6: Commit shared filter UI**

```bash
git add src/components/shared/FilterConditionValue.tsx src/components/project-summary/ProjectSummaryTable.tsx src/components/plans/Level3PlanModule.tsx src/containers/ProjectSpaceContainer.tsx src/components/roadmap/MilestoneView.tsx src/components/roadmap/ProjectPlanSummaryBoard.tsx src/components/roadmap/RoadmapFilterDrawer.tsx src/components/technical-project/TechnicalPlanModule.tsx scripts/verify-project-summary.mjs scripts/verify-level3-plan.mjs scripts/verify-project-roadmap.mjs
git commit -m "feat: standardize filter condition controls"
```

### Task 3: Rebuild project-list field matrices and milestone unit

**Files:**
- Modify: `src/lib/projectListMatrix.ts`
- Modify: `src/lib/projectSummary.ts`
- Modify: `src/lib/projectListColumnOrder.ts`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `scripts/verify-project-list-matrix.mjs`
- Modify: `scripts/verify-project-summary.mjs`
- Modify: `scripts/verify-project-list-header-reorder.mjs`

- [ ] **Step 1: Write failing exact-order/default-visibility assertions**

Assert the 37 machine units and 11 technical TDT units exactly match the approved order and default-visible sets. Assert every business field is hideable and the milestone leaves collapse into one unit named `里程碑`.

```js
assert.deepEqual(machine.map(item => item.label), MACHINE_EXPECTED_ORDER)
assert.deepEqual(machine.filter(item => item.defaultVisible).map(item => item.label), MACHINE_EXPECTED_DEFAULTS)
assert.ok(machine.every(item => item.hideable))
assert.deepEqual(units.at(-1), { key: 'milestones', label: '里程碑', leafKeys: milestoneKeys, defaultVisible: true, hideable: true })
```

- [ ] **Step 2: Run matrix contracts and verify failure**

Run: `node scripts/verify-project-list-matrix.mjs && node scripts/verify-project-summary.mjs`

Expected: FAIL on order, default visibility, labels, and milestone grouping.

- [ ] **Step 3: Separate default visibility from hideability**

Add `defaultVisible` to `ProjectListColumnDefinition`, replace the old `required()` helper with a configurable constructor, and map optional schema fields using their actual default visibility.

```ts
const field = (key: string, label: string, defaultVisible: boolean, width = 132): ProjectListColumnDefinition => ({
  key,
  label,
  width,
  defaultVisible,
  required: false,
  hideable: true,
  reorderable: true,
  source: 'system',
})
```

Build the machine and TDT arrays in the exact approved order. Rename the machine label from `项目名` to `项目名称` and from `SPM部门（二级部门）` to `SPM部门`.

- [ ] **Step 4: Group all template milestones into one configuration unit**

Keep phase metadata on leaf columns for the rendered two-row header, but return one unit for configuration and header dragging.

```ts
if (definition.source === 'templateTask') {
  milestoneUnit.leafKeys.push(definition.key)
  milestoneUnit.defaultVisible ||= definition.defaultVisible
  continue
}
```

- [ ] **Step 5: Version project-list preferences**

Change only affected project-list storage namespaces to a `:v2` key. Do not clear or rewrite unrelated local-storage keys.

```ts
const storageKey = `pms:project-summary:v2:${storageNamespace}:${projectType}:${matrixVariant ?? 'default'}`
```

- [ ] **Step 6: Verify matrix and linked header drag**

Run: `node scripts/verify-project-list-matrix.mjs && node scripts/verify-project-summary.mjs && node scripts/verify-project-list-header-reorder.mjs`

Expected: PASS.

- [ ] **Step 7: Commit project-list matrices**

```bash
git add src/lib/projectListMatrix.ts src/lib/projectSummary.ts src/lib/projectListColumnOrder.ts src/components/project-summary/ProjectSummaryTable.tsx scripts/verify-project-list-matrix.mjs scripts/verify-project-summary.mjs scripts/verify-project-list-header-reorder.mjs
git commit -m "feat: align project list field matrices"
```

### Task 4: Add dynamic quick-filter rows

**Files:**
- Modify: `src/lib/projectListMatrix.ts`
- Modify: `src/lib/projectSummary.ts`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-workbench-project-list.mjs`
- Modify: `screenshots/verify-workbench-summary-floating-panels.mjs`
- Modify: `screenshots/verify-workbench-technical-project-redesign.mjs`

- [ ] **Step 1: Write failing quick-filter assertions**

Assert exact per-variant definitions and the technical type row followed by a dynamic filter row.

```js
assert.deepEqual(machineFilters.map(item => item.label), ['项目名称', '首销tOS版本', '芯片编码', '品牌', '产品系列', '产品类型'])
assert.deepEqual(tosFilters.map(item => item.label), ['项目名称'])
assert.deepEqual(tdtFilters.map(item => item.label), ['项目名称', '技术赛道', '项目阶段'])
assert.deepEqual(subprojectFilters.map(item => item.label), ['子项目名称', '项目阶段'])
```

- [ ] **Step 2: Run quick-filter contracts and verify failure**

Run: `node scripts/verify-workbench-project-list.mjs && node scripts/verify-workbench-summary-floating-panels.mjs && node scripts/verify-workbench-technical-project-redesign.mjs`

Expected: FAIL because the new row and per-variant field sets are absent.

- [ ] **Step 3: Implement controlled quick-filter helpers**

Text inputs write `contains` string conditions. Enum controls write `contains` array conditions. Reuse the same `summaryFilters` or `technicalFilters` consumed by every view.

```ts
const updateQuickText = (conditions: AnyFilterCondition[], field: string, value: string) => [
  ...conditions.filter(item => item.field !== field),
  ...(value.trim() ? [{ id: `quick-${field}`, field, operator: 'contains' as const, value }] : []),
]
```

- [ ] **Step 4: Render the rows below project status**

Keep the technical type row independent. Render only the active technical variant's quick controls, with stable accessible labels such as `快捷筛选-子项目名称`.

- [ ] **Step 5: Add compact responsive styles**

Keep the existing project-list visual language, allow controls to wrap, and prevent the row label from shrinking.

- [ ] **Step 6: Re-run quick-filter contracts**

Run: `node scripts/verify-workbench-project-list.mjs && node scripts/verify-workbench-summary-floating-panels.mjs && node scripts/verify-workbench-technical-project-redesign.mjs`

Expected: PASS.

- [ ] **Step 7: Commit quick filters**

```bash
git add src/lib/projectListMatrix.ts src/lib/projectSummary.ts src/containers/ProjectListContainer.tsx src/styles/globals.css scripts/verify-workbench-project-list.mjs screenshots/verify-workbench-summary-floating-panels.mjs screenshots/verify-workbench-technical-project-redesign.mjs
git commit -m "feat: add project list quick filter rows"
```

### Task 5: Adjust level-1 plan controls and joint-plan copy

**Files:**
- Modify: `src/components/plans/PlanViewModeSwitcher.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/containers/JointProjectSpaceContainer.tsx`
- Modify: `scripts/verify-plan-workspace-shell.mjs`
- Modify: `scripts/verify-project-view-requirements.mjs`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Write failing assertions**

```js
assertInOrder(viewSwitcherSource, ["label: '横版表格'", "label: '竖版表格'", "label: '甘特图'"])
assert.doesNotMatch(level1ToolbarSource, /projectPlanLevel === 'level1'[\s\S]{0,600}aria-label="字段配置"/)
assert.match(jointContainerSource, /tOS&整机1\+N项目计划/)
assert.doesNotMatch(jointContainerSource, /tOS&整机MR版本计划/)
```

- [ ] **Step 2: Run focused contracts and verify failure**

Run: `node scripts/verify-plan-workspace-shell.mjs && node scripts/verify-project-view-requirements.mjs && node scripts/verify-mr-version-plan.mjs`

Expected: FAIL on switch order, level-1 field configuration, and old name.

- [ ] **Step 3: Implement the interaction changes**

Swap the shared view-option order. Render `SortableColumnSettings` only when `projectPlanLevel !== 'level1'` and the current view supports columns. Replace user-visible joint-plan copy without rewriting historical documentation.

- [ ] **Step 4: Verify focused contracts**

Run: `node scripts/verify-plan-workspace-shell.mjs && node scripts/verify-project-view-requirements.mjs && node scripts/verify-mr-version-plan.mjs`

Expected: PASS.

- [ ] **Step 5: Commit plan controls and copy**

```bash
git add src/components/plans/PlanViewModeSwitcher.tsx src/containers/ProjectSpaceContainer.tsx src/containers/JointProjectSpaceContainer.tsx scripts/verify-plan-workspace-shell.mjs scripts/verify-project-view-requirements.mjs scripts/verify-mr-version-plan.mjs
git commit -m "feat: align level one plan controls"
```

### Task 6: Browser acceptance and full regression

**Files:**
- Create: `screenshots/verify-project-list-filter-unification-browser.mjs`
- Create: `screenshots/artifacts/project-list-filter-unification/`
- Modify: affected contract scripts only when a verified assertion is stale.

- [ ] **Step 1: Add the browser acceptance script**

Cover machine/tOS/TDT/subproject quick filters, card/list/calendar result parity, field configuration default visibility, milestone block drag/hide, enum operator cardinality, date operators, level-1 switch order, missing level-1 field configuration, and renamed joint-space tab.

- [ ] **Step 2: Start the production-like local server**

Run: `npm run dev -- --port 3014`

Expected: Next.js ready on `http://127.0.0.1:3014`.

- [ ] **Step 3: Run browser acceptance**

Run: `PMS_BASE_URL=http://127.0.0.1:3014 node screenshots/verify-project-list-filter-unification-browser.mjs`

Expected: PASS and screenshots written under `screenshots/artifacts/project-list-filter-unification/`.

- [ ] **Step 4: Run the full relevant contract suite**

Run: `node scripts/verify-filter-conditions.mjs && node scripts/verify-project-list-matrix.mjs && node scripts/verify-project-summary.mjs && node scripts/verify-workbench-project-list.mjs && node scripts/verify-project-list-header-reorder.mjs && node scripts/verify-level3-plan.mjs && node scripts/verify-project-roadmap.mjs && node scripts/verify-technical-plan.mjs && node scripts/verify-plan-workspace-shell.mjs && node scripts/verify-project-view-requirements.mjs && node scripts/verify-mr-version-plan.mjs`

Expected: PASS.

- [ ] **Step 5: Run repository verification**

Run: `npx tsc --noEmit`

Expected: exit 0.

Run: `npm run build`

Expected: successful production build.

- [ ] **Step 6: Commit browser coverage**

```bash
git add screenshots/verify-project-list-filter-unification-browser.mjs screenshots/artifacts/project-list-filter-unification
git commit -m "test: cover project list and filter unification"
```

### Task 7: Integrate to dev and deploy Vercel

**Files:**
- No source files expected.

- [ ] **Step 1: Verify the feature branch is clean**

Run: `git status --short`

Expected: no output.

- [ ] **Step 2: Push the feature branch**

Run: `git push -u origin codex/project-list-filter-unification`

Expected: remote feature branch updated.

- [ ] **Step 3: Update and merge into dev without rewriting history**

Run in a clean integration worktree based on `origin/dev`:

```bash
git fetch origin
git merge --no-ff origin/codex/project-list-filter-unification
git push origin dev
```

Expected: `origin/dev` contains the feature commits.

- [ ] **Step 4: Deploy the verified dev revision to Vercel production**

Run: `vercel --prod --yes`

Expected: production deployment succeeds and returns the production URL.

- [ ] **Step 5: Verify production**

Run the browser smoke flow against the returned production URL and verify the deployed commit matches the merged `dev` revision.

