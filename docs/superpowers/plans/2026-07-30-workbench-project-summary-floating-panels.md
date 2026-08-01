# Workbench Project Summary and Floating Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workbench list view with a schema- and template-driven project summary table for machine and tOS projects, and replace every filter/column-settings drawer with an anchored floating panel.

**Architecture:** Introduce pure project-summary contract helpers and a reusable `ProjectSummaryTable`, then consume them from the workbench and project summary board. Introduce one shared anchored-popover shell, reuse it in sortable column settings and filter panels, and migrate every current caller without changing its business state model.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Ant Design 6, Zustand 4, dnd-kit, Node verification scripts, Puppeteer browser verification.

---

## Scope and file map

### New files

- `src/lib/projectSummary.ts` — pure field, template-version, dynamic-column, row-value, and workbench-visibility contracts.
- `src/components/project-summary/ProjectSummaryTable.tsx` — reusable summary table rendering and row navigation.
- `src/components/shared/FloatingConfigPopover.tsx` — shared anchored shell with sticky header/footer and draft-close semantics.
- `src/components/shared/FloatingFilterPanel.tsx` — shared filter-panel chrome; callers continue owning condition controls.
- `scripts/verify-project-summary.mjs` — executable contract checks for fields, templates, classifications, and source integration.
- `scripts/verify-floating-config-panels.mjs` — executable checks that shared components and all callers use popovers rather than drawers.
- `scripts/verify-workbench-project-list.mjs` — executable checks for workbench category states and shared-table integration.
- `screenshots/verify-workbench-summary-floating-panels.mjs` — Puppeteer smoke path for the approved UI states.

### Modified shared files

- `src/components/shared/SortableColumnSettings.tsx` — render its draft editor inside `FloatingConfigPopover` and accept an anchor trigger.
- `src/lib/filterConditions.ts` — expose typed field-kind helpers needed by schema-driven project filters; retain AND semantics.
- `src/styles/globals.css` — floating-panel dimensions, sticky regions, compact rows, and responsive behavior.
- `package.json` — add focused verification scripts.

### Modified project-summary/workbench files

- `src/containers/WorkspaceContainer.tsx` — conditional quick-filter rows and shared table/empty-state integration.
- `src/components/roadmap/ProjectPlanSummaryBoard.tsx` — consume the shared field/template contracts and floating controls.
- `src/components/roadmap/utils.ts` — delegate project field and template-node definitions to `projectSummary.ts`.

### Modified floating-panel callers

- `src/components/roadmap/RoadmapFilterDrawer.tsx`
- `src/components/roadmap/RoadmapColumnSettingsDrawer.tsx`
- `src/components/roadmap/RoadmapToolbar.tsx`
- `src/components/roadmap/MilestoneView.tsx`
- `src/containers/ProjectSpaceContainer.tsx`
- `src/containers/ConfigContainer.tsx`
- `src/components/plan/PlanModule.tsx`
- `src/components/plans/RequirementDevPlan.tsx`
- `src/components/plans/VersionTrainPlan.tsx`
- `src/app/share/plan/page.tsx`

Do not rename the roadmap wrapper files during this change; preserving import paths keeps the migration focused. Their rendered implementation will become a popover even if a legacy filename still contains `Drawer`.

---

### Task 1: Add project-summary contract verification

**Files:**
- Create: `scripts/verify-project-summary.mjs`
- Modify: `package.json`
- Test: `scripts/verify-project-summary.mjs`

- [ ] **Step 1: Write the failing contract script**

Create a TypeScript-loader script following the loader already used by `scripts/verify-sortable-column-settings.mjs`. Register these concrete assertions:

```js
const {
  getProjectSummaryFieldDefinitions,
  getLatestPublishedTemplateTasks,
  getLevel1SecondLevelTasks,
  getProjectSummaryQuickFilterDefinitions,
  updateLinkedQuickFilterCondition,
  getWorkbenchListState,
} = loadTypeScriptModule(path.join(root, 'src/lib/projectSummary.ts'))
const {
  MACHINE_PROJECT_INFO_FIELDS,
  TOS_PROJECT_INFO_FIELDS,
} = loadTypeScriptModule(path.join(root, 'src/constants/projectInfoSchema.ts'))
const {
  applyFilterConditions,
} = loadTypeScriptModule(path.join(root, 'src/lib/filterConditions.ts'))

assert.deepEqual(
  getProjectSummaryFieldDefinitions('整机产品项目')
    .filter(field => field.source === 'projectInfo')
    .map(field => field.key),
  MACHINE_PROJECT_INFO_FIELDS.map(field => field.key),
)
assert.deepEqual(
  getProjectSummaryFieldDefinitions('tOS版本项目')
    .filter(field => field.source === 'projectInfo')
    .map(field => field.key),
  TOS_PROJECT_INFO_FIELDS.map(field => field.key),
)

const versions = [
  { id: 'v3', versionNo: 'V3', status: '已发布' },
  { id: 'v4', versionNo: 'V4', status: '修订中' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
]
const snapshots = {
  'template::整机产品项目::level1::v2': [{ id: 'old', taskName: '旧节点' }],
  'template::整机产品项目::level1::v3': [{ id: 'new', taskName: '新节点' }],
}
assert.equal(
  getLatestPublishedTemplateTasks('整机产品项目', versions, snapshots, 'v4', []).at(0)?.id,
  'new',
)

const tasks = [
  { id: '1', taskName: '阶段一' },
  { id: '1.1', parentId: '1', taskName: '节点 A', order: 1 },
  { id: '1.1.1', parentId: '1.1', taskName: '三级任务', order: 1 },
  { id: '2', taskName: '阶段二' },
  { id: '2.1', parentId: '2', taskName: '节点 B', order: 1 },
]
assert.deepEqual(getLevel1SecondLevelTasks(tasks).map(task => task.id), ['1.1', '2.1'])

assert.equal(getWorkbenchListState('all').kind, 'select-category')
assert.deepEqual(getWorkbenchListState('整机产品项目'), {
  kind: 'table',
  showSecondaryCategory: true,
  showStatusQuickFilter: true,
})
assert.deepEqual(getWorkbenchListState('tOS版本项目'), {
  kind: 'table',
  showSecondaryCategory: false,
  showStatusQuickFilter: false,
})
assert.deepEqual(getWorkbenchListState('技术项目'), {
  kind: 'unsupported',
  showSecondaryCategory: true,
  showStatusQuickFilter: true,
})

assert.deepEqual(
  getProjectSummaryQuickFilterDefinitions('整机产品项目', []).map(field => field.key),
  ['firstSaleTosVersion', 'chipCode', 'brand', 'productSeries', 'productType'],
)
assert.deepEqual(
  getProjectSummaryQuickFilterDefinitions('tOS版本项目', []).map(field => field.key),
  ['versionType', 'tosVersion'],
)
const linked = updateLinkedQuickFilterCondition([], 'brand', ['TECNO', 'Infinix'])
assert.equal(linked.length, 1)
assert.equal(linked[0].operator, 'equalsAny')
assert.deepEqual(linked[0].value, ['TECNO', 'Infinix'])
assert.deepEqual(updateLinkedQuickFilterCondition(linked, 'brand', []), [])
assert.deepEqual(
  applyFilterConditions(
    [
      { id: '1', brand: 'TECNO', productType: '新品' },
      { id: '2', brand: 'Infinix', productType: '升级' },
      { id: '3', brand: 'itel', productType: '新品' },
    ],
    [
      { id: 'brand', field: 'brand', operator: 'equalsAny', value: ['TECNO', 'Infinix'] },
      { id: 'type', field: 'productType', operator: 'equalsAny', value: ['新品'] },
    ],
  ).map(row => row.id),
  ['1'],
)
```

- [ ] **Step 2: Run the contract script and verify the intended failure**

Run:

```bash
node scripts/verify-project-summary.mjs
```

Expected: FAIL with `missing shared helper: src/lib/projectSummary.ts`.

- [ ] **Step 3: Add the focused package command**

Add:

```json
"verify:project-summary": "node scripts/verify-project-summary.mjs"
```

Run:

```bash
npm run verify:project-summary
```

Expected: the same missing-helper failure, proving the package command is wired.

- [ ] **Step 4: Commit the failing contract**

```bash
git add package.json scripts/verify-project-summary.mjs
git commit -m "test: define project summary contracts"
```

---

### Task 2: Implement pure project-summary contracts

**Files:**
- Create: `src/lib/projectSummary.ts`
- Modify: `src/lib/filterConditions.ts`
- Test: `scripts/verify-project-summary.mjs`

- [ ] **Step 1: Define schema-driven system and project fields**

Implement these exported types and functions:

```ts
import type { ProjectInfoFieldDefinition } from '@/constants/projectInfoSchema'
import {
  getProjectInfoFields,
} from '@/constants/projectInfoSchema'
import {
  PROJECT_CATEGORY_MACHINE,
  PROJECT_CATEGORY_TECH,
  PROJECT_TYPE_TOS_VERSION,
  resolveProjectClassification,
} from '@/constants/projectTypes'
import { getTemplateSnapshotKey } from '@/lib/projectTemplateCompatibility'

export type ProjectSummaryFieldSource = 'system' | 'projectInfo' | 'templateTask'

export interface ProjectSummaryFieldDefinition {
  key: string
  title: string
  source: ProjectSummaryFieldSource
  defaultVisible: boolean
  hideable: boolean
  inputType: ProjectInfoFieldDefinition['inputType'] | 'system'
  width: number
  taskId?: string
  parentTaskName?: string
}

const SYSTEM_FIELDS: ProjectSummaryFieldDefinition[] = [
  {
    key: 'projectName',
    title: '项目名称',
    source: 'system',
    defaultVisible: true,
    hideable: false,
    inputType: 'system',
    width: 200,
  },
  {
    key: 'projectCategory',
    title: '项目分类',
    source: 'system',
    defaultVisible: true,
    hideable: false,
    inputType: 'system',
    width: 140,
  },
  {
    key: 'status',
    title: '状态',
    source: 'system',
    defaultVisible: true,
    hideable: true,
    inputType: 'system',
    width: 100,
  },
]

export function getProjectSummaryFieldDefinitions(projectType: string) {
  const category = resolveProjectClassification(projectType).projectCategory
  const projectInfoFields = getProjectInfoFields(category).map(field => ({
    key: field.key,
    title: field.label,
    source: 'projectInfo' as const,
    defaultVisible: field.defaultVisible,
    hideable: field.hideable,
    inputType: field.inputType,
    width: field.inputType === 'people' ? 160 : field.inputType === 'link' ? 220 : 140,
  }))
  return [...SYSTEM_FIELDS, ...projectInfoFields]
}
```

- [ ] **Step 2: Implement latest-published-template selection**

Add:

```ts
type PlanVersion = { id: string; versionNo: string; status: string }

const versionNumber = (versionNo: string) => {
  const match = String(versionNo).match(/\d+/)
  return match ? Number(match[0]) : -1
}

export function getLatestPublishedTemplateTasks(
  projectType: string,
  versions: readonly PlanVersion[],
  publishedSnapshots: Record<string, any[]>,
  currentVersion: string,
  currentTemplateTasks: any[],
) {
  const latest = versions
    .filter(version => version.status === '已发布')
    .sort((a, b) => versionNumber(b.versionNo) - versionNumber(a.versionNo))[0]
  if (!latest) return []
  const snapshot = publishedSnapshots[getTemplateSnapshotKey(projectType, latest.id)]
    ?? publishedSnapshots[latest.id]
  if (snapshot) return snapshot.map(task => ({ ...task }))
  return latest.id === currentVersion ? currentTemplateTasks.map(task => ({ ...task })) : []
}
```

- [ ] **Step 3: Implement direct-second-level task columns**

Add:

```ts
export function getLevel1SecondLevelTasks(tasks: readonly any[]) {
  const parentOrder = new Map(
    tasks
      .filter(task => !task.parentId)
      .map((task, index) => [String(task.id), { order: Number(task.order ?? index), index }] as const),
  )
  return tasks
    .filter(task => task.parentId && parentOrder.has(String(task.parentId)))
    .sort((a, b) => {
      const aParent = parentOrder.get(String(a.parentId))!
      const bParent = parentOrder.get(String(b.parentId))!
      return aParent.order - bParent.order
        || aParent.index - bParent.index
        || Number(a.order ?? 0) - Number(b.order ?? 0)
    })
}

export function getTemplateTaskFieldDefinitions(projectType: string, tasks: readonly any[]) {
  const parents = new Map(tasks.filter(task => !task.parentId).map(task => [String(task.id), task]))
  const secondLevel = getLevel1SecondLevelTasks(tasks)
  const nameCounts = secondLevel.reduce<Record<string, number>>((counts, task) => {
    counts[task.taskName] = (counts[task.taskName] ?? 0) + 1
    return counts
  }, {})
  return secondLevel.map(task => {
    const parentName = String(parents.get(String(task.parentId))?.taskName ?? '')
    return {
      key: `templateTask::${projectType}::${task.id}`,
      title: nameCounts[task.taskName] > 1 ? `${parentName} / ${task.taskName}` : task.taskName,
      source: 'templateTask' as const,
      defaultVisible: Boolean(task.defaultRoadmap),
      hideable: true,
      inputType: 'date' as const,
      width: 130,
      taskId: String(task.id),
      parentTaskName: parentName,
    }
  })
}
```

- [ ] **Step 4: Implement workbench category-state rules**

Add:

```ts
export type WorkbenchListState =
  | { kind: 'select-category' }
  | {
      kind: 'table' | 'unsupported'
      showSecondaryCategory: boolean
      showStatusQuickFilter: boolean
    }

export function getWorkbenchListState(category: string): WorkbenchListState {
  if (category === 'all') return { kind: 'select-category' }
  if (category === PROJECT_CATEGORY_MACHINE) {
    return { kind: 'table', showSecondaryCategory: true, showStatusQuickFilter: true }
  }
  if (category === PROJECT_TYPE_TOS_VERSION) {
    return { kind: 'table', showSecondaryCategory: false, showStatusQuickFilter: false }
  }
  if (category === PROJECT_CATEGORY_TECH) {
    return { kind: 'unsupported', showSecondaryCategory: true, showStatusQuickFilter: true }
  }
  return { kind: 'unsupported', showSecondaryCategory: false, showStatusQuickFilter: false }
}
```

- [ ] **Step 5: Extend shared filter conditions for linked multi-select values**

In `src/lib/filterConditions.ts`, extend the shared types and normalization without changing existing single-value behavior:

```ts
export const MULTI_ENUM_FILTER_OPERATORS = [
  { value: 'equalsAny', label: '任一为' },
] as const

// Keep the existing FilterOperator and FilterCondition declarations unchanged
// so current callers continue seeing a string value.
export interface LinkedFilterCondition {
  id: string
  field: string
  operator: FilterOperator | 'equalsAny'
  value: string | string[]
}

export type AnyFilterCondition = FilterCondition | LinkedFilterCondition

const normalizeFilterValue = (value: AnyFilterCondition['value']) => (
  Array.isArray(value)
    ? [...new Set(value.map(item => item.trim()).filter(Boolean))]
    : value.trim()
)

export const isFilterConditionActive = (condition: AnyFilterCondition) => (
  Boolean(condition.field && (
    isValuelessFilterOperator(condition.operator)
    || (
      Array.isArray(condition.value)
        ? condition.value.some(value => value.trim())
        : condition.value.trim()
    )
  ))
)
```

Add `multiple?: boolean` to `FilterFieldDefinition`. Let `isValuelessFilterOperator` accept `FilterOperator | 'equalsAny'`. Change `normalizeFilterConditions` and `applyFilterConditions` to accept `AnyFilterCondition[]` while keeping their existing generic return behavior. Preserve arrays only for `equalsAny`; all existing operators continue returning string values. Allow `equalsAny` only when the field definition has `multiple: true`.

In `applyFilterConditions`, add before the single-value comparisons:

```ts
if (condition.operator === 'equalsAny') {
  const expectedValues = Array.isArray(condition.value)
    ? condition.value.map(value => value.trim().toLowerCase()).filter(Boolean)
    : [condition.value.trim().toLowerCase()].filter(Boolean)
  return expectedValues.includes(actual)
}
```

Update `.trim()` call sites in this file to use `normalizeFilterValue` or an `Array.isArray` guard. Existing callers typed as `FilterCondition` must continue seeing `value: string`, so no existing filter editor needs an array-value compatibility rewrite.

- [ ] **Step 6: Define project-type quick filters and linked-condition updates**

Add to `src/lib/projectSummary.ts`:

```ts
import type { AnyFilterCondition } from '@/lib/filterConditions'
import { getProjectInfoValue, type ProjectInfoProject } from '@/lib/projectInfoValues'

export interface ProjectSummaryQuickFilterDefinition {
  key: string
  label: string
  options: { label: string; value: string }[]
}

const MACHINE_QUICK_FILTERS = [
  { key: 'firstSaleTosVersion', label: '首销 tOS 版本' },
  { key: 'chipCode', label: '芯片编码' },
  { key: 'brand', label: '品牌' },
  { key: 'productSeries', label: '产品系列' },
  { key: 'productType', label: '产品类型' },
] as const

const TOS_QUICK_FILTERS = [
  { key: 'versionType', label: '版本类型' },
  { key: 'tosVersion', label: 'tOS 版本' },
] as const

const quickFilterValue = (project: ProjectInfoProject, key: string) => {
  if (key === 'brand' || key === 'versionType' || key === 'tosVersion') {
    const value = project[key]
    return typeof value === 'string' ? value.trim() : ''
  }
  const value = getProjectInfoValue(project, key)
  return typeof value === 'string' ? value.trim() : ''
}

export function getProjectSummaryQuickFilterDefinitions(
  projectType: string,
  projects: readonly ProjectInfoProject[],
): ProjectSummaryQuickFilterDefinition[] {
  const category = resolveProjectClassification(projectType).projectCategory
  const definitions = category === PROJECT_CATEGORY_MACHINE
    ? MACHINE_QUICK_FILTERS
    : category === PROJECT_TYPE_TOS_VERSION
      ? TOS_QUICK_FILTERS
      : []
  return definitions.map(definition => {
    const values = [...new Set(projects
      .map(project => quickFilterValue(project, definition.key))
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
    return {
      ...definition,
      options: values.map(value => ({ label: value, value })),
    }
  })
}

export function updateLinkedQuickFilterCondition(
  conditions: readonly AnyFilterCondition[],
  field: string,
  values: string[],
): AnyFilterCondition[] {
  const normalizedValues = [...new Set(values.map(value => value.trim()).filter(Boolean))]
  const existing = conditions.find(condition => condition.field === field)
  const remaining = conditions.filter(condition => condition.field !== field)
  if (normalizedValues.length === 0) return remaining
  return [
    ...remaining,
    {
      id: existing?.id ?? `quick-${field}`,
      field,
      operator: 'equalsAny',
      value: normalizedValues,
    },
  ]
}

export function getLinkedQuickFilterValues(
  conditions: readonly AnyFilterCondition[],
  field: string,
) {
  const condition = conditions.find(item => item.field === field && item.operator === 'equalsAny')
  return Array.isArray(condition?.value) ? condition.value : []
}
```

Quick-filter options must be computed from the category/secondary/status/search-filtered base projects before advanced conditions are applied.

- [ ] **Step 7: Run the focused contract**

Run:

```bash
npm run verify:project-summary
```

Expected: PASS with assertions for all project-space fields, latest published version selection, direct second-level tasks, workbench states, quick-filter definitions, and linked multi-select conditions.

- [ ] **Step 8: Commit the pure contracts**

```bash
git add src/lib/projectSummary.ts src/lib/filterConditions.ts
git commit -m "feat: add project summary contracts"
```

---

### Task 3: Add the anchored floating-panel shell

**Files:**
- Create: `src/components/shared/FloatingConfigPopover.tsx`
- Create: `scripts/verify-floating-config-panels.mjs`
- Modify: `src/styles/globals.css`
- Modify: `package.json`
- Test: `scripts/verify-floating-config-panels.mjs`

- [ ] **Step 1: Write the failing floating-panel source contract**

The verification script must parse the shared component and assert:

```js
const floatingPath = path.join(root, 'src/components/shared/FloatingConfigPopover.tsx')
assert.equal(fs.existsSync(floatingPath), true, 'missing FloatingConfigPopover')
const floatingSource = fs.readFileSync(floatingPath, 'utf8')
assert.match(floatingSource, /Popover/)
assert.doesNotMatch(floatingSource, /\bDrawer\b/)
assert.match(floatingSource, /placement="bottomRight"/)
assert.match(floatingSource, /onOpenChange/)
assert.match(floatingSource, /getPopupContainer/)
```

Add:

```json
"verify:floating-panels": "node scripts/verify-floating-config-panels.mjs"
```

Run:

```bash
npm run verify:floating-panels
```

Expected: FAIL with `missing FloatingConfigPopover`.

- [ ] **Step 2: Implement `FloatingConfigPopover`**

Create:

```tsx
'use client'

import type { ReactElement, ReactNode } from 'react'
import { Popover } from 'antd'

interface FloatingConfigPopoverProps {
  open: boolean
  trigger: ReactElement
  title: ReactNode
  children: ReactNode
  footer: ReactNode
  width: number
  className?: string
  onCancel: () => void
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement
}

export function FloatingConfigPopover({
  open,
  trigger,
  title,
  children,
  footer,
  width,
  className,
  onCancel,
  getPopupContainer,
}: FloatingConfigPopoverProps) {
  return (
    <Popover
      open={open}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      destroyOnHidden
      onOpenChange={nextOpen => {
        if (!nextOpen) onCancel()
      }}
      getPopupContainer={getPopupContainer}
      classNames={{ root: `pms-floating-config-popover ${className ?? ''}`.trim() }}
      styles={{ container: { width: `min(${width}px, calc(100vw - 24px))`, padding: 0 } }}
      content={(
        <section className="pms-floating-config-panel" aria-label={String(title)}>
          <header className="pms-floating-config-header">{title}</header>
          <div className="pms-floating-config-body">{children}</div>
          <footer className="pms-floating-config-footer">{footer}</footer>
        </section>
      )}
    >
      {trigger}
    </Popover>
  )
}
```

- [ ] **Step 3: Add focused panel CSS**

Append:

```css
.pms-floating-config-popover {
  z-index: 1400;
}

.pms-floating-config-popover .ant-popover-inner {
  overflow: hidden;
  border: 1px solid rgba(99, 102, 241, 0.16);
  border-radius: 14px;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.18);
}

.pms-floating-config-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  max-height: min(680px, calc(100vh - 40px));
  background: #fff;
}

.pms-floating-config-header,
.pms-floating-config-footer {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.98);
}

.pms-floating-config-header {
  border-bottom: 1px solid #eef2f7;
  font-weight: 600;
}

.pms-floating-config-footer {
  border-top: 1px solid #eef2f7;
}

.pms-floating-config-body {
  min-height: 0;
  overflow: auto;
  padding: 12px 16px;
}
```

- [ ] **Step 4: Run the focused floating-shell contract**

Run:

```bash
npm run verify:floating-panels
```

Expected: PASS for the shared shell assertions; caller-migration checks will be added in later tasks.

- [ ] **Step 5: Commit the shell**

```bash
git add package.json scripts/verify-floating-config-panels.mjs src/components/shared/FloatingConfigPopover.tsx src/styles/globals.css
git commit -m "feat: add floating configuration popover"
```

---

### Task 4: Convert shared sortable column settings and every caller

**Files:**
- Modify: `src/components/shared/SortableColumnSettings.tsx`
- Modify: `src/components/roadmap/RoadmapColumnSettingsDrawer.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`
- Modify: `src/components/roadmap/MilestoneView.tsx`
- Modify: `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/components/plan/PlanModule.tsx`
- Modify: `src/components/plans/RequirementDevPlan.tsx`
- Modify: `src/components/plans/VersionTrainPlan.tsx`
- Modify: `src/app/share/plan/page.tsx`
- Modify: `scripts/verify-sortable-column-settings.mjs`
- Modify: `scripts/verify-floating-config-panels.mjs`
- Test: `npm run verify:column-settings`
- Test: `npm run verify:floating-panels`

- [ ] **Step 1: Extend the failing source contract to cover all column callers**

Add this exact caller list to `verify-floating-config-panels.mjs`:

```js
const columnCallers = [
  'src/app/share/plan/page.tsx',
  'src/components/plan/PlanModule.tsx',
  'src/components/plans/RequirementDevPlan.tsx',
  'src/components/plans/VersionTrainPlan.tsx',
  'src/components/roadmap/MilestoneView.tsx',
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
  'src/components/roadmap/RoadmapColumnSettingsDrawer.tsx',
  'src/containers/ConfigContainer.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
]
for (const relativePath of columnCallers) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  assert.match(source, /<SortableColumnSettings/)
  assert.match(source, /trigger=/)
}
const sharedColumns = fs.readFileSync(
  path.join(root, 'src/components/shared/SortableColumnSettings.tsx'),
  'utf8',
)
assert.match(sharedColumns, /FloatingConfigPopover/)
assert.doesNotMatch(sharedColumns, /<Drawer/)
```

Run:

```bash
npm run verify:floating-panels
```

Expected: FAIL because `SortableColumnSettings` still renders `Drawer` and callers do not pass `trigger`.

- [ ] **Step 2: Change `SortableColumnSettings` to an anchored editor**

Add `trigger: ReactElement` and optional `getPopupContainer` props. Replace the Drawer return with:

```tsx
<FloatingConfigPopover
  open={open}
  trigger={trigger}
  title={(
    <div className="pms-floating-config-title-row">
      <span>列设置</span>
      <Button type="link" danger size="small" onClick={handleReset}>重置</Button>
    </div>
  )}
  width={400}
  onCancel={onCancel}
  getPopupContainer={getPopupContainer}
  footer={(
    <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
      <Button onClick={onCancel}>取消</Button>
      <Button type="primary" disabled={applyDisabled} onClick={handleApply}>
        {applyLabel}
      </Button>
    </Space>
  )}
>
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={handleDragEnd}
  >
    <SortableContext items={draft.order} strategy={verticalListSortingStrategy}>
      <div className="pms-sortable-column-list">
        {renderedRows}
      </div>
    </SortableContext>
  </DndContext>
</FloatingConfigPopover>
```

Keep the existing draft initialization, minimum-visible rule, pointer/touch/keyboard sensors, and normalization behavior unchanged.

- [ ] **Step 3: Move each column-settings component to its trigger location**

For every caller, replace a standalone trigger plus bottom-of-tree settings component with one anchored component:

```tsx
<SortableColumnSettings
  open={showColumnModal}
  trigger={(
    <Button
      aria-label="列设置"
      icon={<AppstoreOutlined />}
      onClick={() => setShowColumnModal(true)}
    />
  )}
  definitions={columnDefinitions}
  value={columnSettings}
  defaultValue={defaultColumnSettings}
  onCancel={() => setShowColumnModal(false)}
  onApply={nextSettings => {
    setColumnSettings(nextSettings)
    setShowColumnModal(false)
  }}
/>
```

Use each caller's existing icon, label, definitions, value, apply callback, and permission wrapper. Remove the old duplicate trigger and old bottom-of-tree `<SortableColumnSettings>`.

- [ ] **Step 4: Adapt roadmap wrapper props**

Change `RoadmapColumnSettingsDrawerProps` to accept `trigger: ReactElement`, pass it to `SortableColumnSettings`, and keep `open`, `onClose`, `viewMode`, `value`, and `onChange` unchanged. Update `RoadmapToolbar` to pass its current settings button as the trigger.

- [ ] **Step 5: Update the existing sortable-column verifier**

Retain every existing ordering assertion and add:

```js
const sharedSource = fs.readFileSync(
  path.join(root, 'src/components/shared/SortableColumnSettings.tsx'),
  'utf8',
)
assert.match(sharedSource, /FloatingConfigPopover/)
assert.match(sharedSource, /KeyboardSensor/)
assert.doesNotMatch(sharedSource, /\bDrawer\b/)
```

- [ ] **Step 6: Run focused column verification**

Run:

```bash
npm run verify:column-settings
npm run verify:floating-panels
npx tsc --noEmit
```

Expected: both focused scripts PASS and TypeScript exits 0.

- [ ] **Step 7: Commit the column migration**

```bash
git add src/app/share/plan/page.tsx src/components/plan/PlanModule.tsx src/components/plans/RequirementDevPlan.tsx src/components/plans/VersionTrainPlan.tsx src/components/roadmap/MilestoneView.tsx src/components/roadmap/ProjectPlanSummaryBoard.tsx src/components/roadmap/RoadmapColumnSettingsDrawer.tsx src/components/roadmap/RoadmapToolbar.tsx src/components/shared/SortableColumnSettings.tsx src/containers/ConfigContainer.tsx src/containers/ProjectSpaceContainer.tsx scripts/verify-sortable-column-settings.mjs scripts/verify-floating-config-panels.mjs
git commit -m "feat: move column settings to floating panels"
```

---

### Task 5: Add shared filter chrome and migrate roadmap filters

**Files:**
- Create: `src/components/shared/FloatingFilterPanel.tsx`
- Modify: `src/components/roadmap/RoadmapFilterDrawer.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`
- Modify: `scripts/verify-floating-config-panels.mjs`
- Test: `npm run verify:floating-panels`

- [ ] **Step 1: Extend the failing filter contract**

Add the roadmap-only assertion:

```js
const roadmapFilterSource = fs.readFileSync(
  path.join(root, 'src/components/roadmap/RoadmapFilterDrawer.tsx'),
  'utf8',
)
assert.match(roadmapFilterSource, /FloatingFilterPanel/)
assert.doesNotMatch(roadmapFilterSource, /\bDrawer\b/)
```

Run:

```bash
npm run verify:floating-panels
```

Expected: FAIL because none of the filter callers use the shared panel yet.

- [ ] **Step 2: Implement shared AND-filter chrome**

Create:

```tsx
'use client'

import type { ReactElement, ReactNode } from 'react'
import { Button, Space } from 'antd'
import { FloatingConfigPopover } from '@/components/shared/FloatingConfigPopover'

interface FloatingFilterPanelProps {
  open: boolean
  trigger: ReactElement
  children: ReactNode
  onReset: () => void
  onClear: () => void
  onCancel: () => void
  onConfirm: () => void
  confirmDisabled?: boolean
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement
}

export function FloatingFilterPanel({
  open,
  trigger,
  children,
  onReset,
  onClear,
  onCancel,
  onConfirm,
  confirmDisabled,
  getPopupContainer,
}: FloatingFilterPanelProps) {
  return (
    <FloatingConfigPopover
      open={open}
      trigger={trigger}
      title={(
        <div className="pms-floating-config-title-row">
          <span>筛选符合以下所有条件的结果</span>
          <Space size={4}>
            <Button type="link" danger size="small" onClick={onReset}>重置</Button>
            <Button type="link" danger size="small" onClick={onClear}>清空</Button>
          </Space>
        </div>
      )}
      footer={(
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" disabled={confirmDisabled} onClick={onConfirm}>确认</Button>
        </Space>
      )}
      width={720}
      onCancel={onCancel}
      getPopupContainer={getPopupContainer}
    >
      {children}
    </FloatingConfigPopover>
  )
}
```

- [ ] **Step 3: Convert `RoadmapFilterDrawer` without changing condition semantics**

Add a `trigger: ReactElement` prop. Replace the Drawer with `FloatingFilterPanel`. Map:

```tsx
<FloatingFilterPanel
  open={open}
  trigger={trigger}
  onReset={resetAdvancedFilters}
  onClear={() => setDraftConditions([createRoadmapFilterCondition()])}
  onCancel={onClose}
  onConfirm={applyAdvancedFilters}
>
  <Typography.Paragraph type="secondary">
    多个条件按 AND 关系同时生效。
  </Typography.Paragraph>
  {conditionEditor}
</FloatingFilterPanel>
```

Preserve field deduplication, enum/date/text controls, operator validation, empty-condition removal, and normalization.

- [ ] **Step 4: Move the roadmap filter wrapper to its toolbar anchor**

In `RoadmapToolbar`, pass the existing filter icon button as `trigger`. Remove the old duplicate button. Keep the active-filter primary state and filter-count affordance.

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm run verify:floating-panels
npx tsc --noEmit
```

Expected: PASS and TypeScript exits 0 for the migrated roadmap.

- [ ] **Step 6: Commit roadmap filter migration**

```bash
git add src/components/shared/FloatingFilterPanel.tsx src/components/roadmap/RoadmapFilterDrawer.tsx src/components/roadmap/RoadmapToolbar.tsx scripts/verify-floating-config-panels.mjs
git commit -m "feat: move roadmap filters to floating panel"
```

---

### Task 6: Migrate summary, milestone, and project-space filters

**Files:**
- Modify: `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- Modify: `src/components/roadmap/MilestoneView.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-floating-config-panels.mjs`
- Test: `npm run verify:floating-panels`

- [ ] **Step 1: Convert the project summary board filter**

Move the existing filter button into:

```tsx
<FloatingFilterPanel
  open={showFilterDrawer}
  trigger={filterButton}
  onReset={() => {
    setTempFilters([createFilterCondition()])
    setMilestoneDateRange(null)
  }}
  onClear={() => {
    setTempFilters([createFilterCondition()])
    setMilestoneDateRange(null)
    setSharedRowsOverride(null)
  }}
  onCancel={() => setShowFilterDrawer(false)}
  onConfirm={applyTempFilters}
>
  {tempFilters.map(renderSummaryCondition)}
  {addConditionButton}
</FloatingFilterPanel>
```

Remove the old Drawer. Preserve milestone date-range control, duplicate-field disabling, valueless operators, saved-view invalidation, and shared-row reset.

- [ ] **Step 2: Convert the legacy milestone view filter**

Apply the same anchored structure while preserving snapshot comparison controls, milestone date filtering, status rows, and saved-view state. Remove only the Drawer chrome.

- [ ] **Step 3: Convert the project-space plan filter**

Move the current filter button and its inline Drawer body into `FloatingFilterPanel`. Preserve:

- current plan-level scope;
- current view-mode field definitions;
- invalid/empty condition behavior;
- edit mode and RBAC gates;
- reset/clear distinction.

When project space is rendered inside a fullscreen modal, pass:

```tsx
getPopupContainer={triggerNode => (
  triggerNode.closest('.ant-modal-content') as HTMLElement
  ?? triggerNode.parentElement
  ?? document.body
)}
```

- [ ] **Step 4: Complete the no-filter-drawer verifier**

For the remaining three inline filter caller files, parse imports and JSX and assert:

```js
const inlineFilterCallers = [
  'src/components/roadmap/MilestoneView.tsx',
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
]
for (const relativePath of inlineFilterCallers) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  assert.match(source, /FloatingFilterPanel/)
  assert.doesNotMatch(source, /title="筛选条件"[\s\S]{0,200}<Drawer/)
}
```

Also assert `RoadmapFilterDrawer.tsx` has no `Drawer` import or JSX.

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm run verify:floating-panels
npx tsc --noEmit
```

Expected: PASS and TypeScript exits 0.

- [ ] **Step 6: Commit remaining filter migrations**

```bash
git add src/components/roadmap/ProjectPlanSummaryBoard.tsx src/components/roadmap/MilestoneView.tsx src/containers/ProjectSpaceContainer.tsx scripts/verify-floating-config-panels.mjs
git commit -m "feat: move project filters to floating panels"
```

---

### Task 7: Build the reusable project summary table

**Files:**
- Create: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/lib/projectSummary.ts`
- Modify: `scripts/verify-project-summary.mjs`
- Test: `npm run verify:project-summary`

- [ ] **Step 1: Extend the failing contract for row and column generation**

Add assertions:

```js
const {
  buildProjectSummaryRow,
  buildProjectSummaryColumns,
} = loadTypeScriptModule(path.join(root, 'src/lib/projectSummary.ts'))

const project = {
  id: 'p1',
  name: 'Demo',
  type: '整机产品项目',
  status: '在研',
  developMode: 'ODC',
  level1PlanTasks: [{ id: '1.1', planEndDate: '2026-08-01' }],
}
const definitions = [
  ...getProjectSummaryFieldDefinitions('整机产品项目'),
  ...getTemplateTaskFieldDefinitions('整机产品项目', tasks),
]
const row = buildProjectSummaryRow(project, definitions)
assert.equal(row.projectName, 'Demo')
assert.equal(row.developmentMode, 'ODC')
assert.equal(row['templateTask::整机产品项目::1.1'], '2026-08-01')
assert.equal(row['templateTask::整机产品项目::2.1'], '-')
assert.equal(buildProjectSummaryColumns(definitions).at(0)?.fixed, 'left')
```

Run:

```bash
npm run verify:project-summary
```

Expected: FAIL because row and column helpers are missing.

- [ ] **Step 2: Implement row values without fabricated dates**

Add:

```ts
import {
  formatProjectInfoValue,
  getProjectInfoValue,
  type ProjectInfoProject,
} from '@/lib/projectInfoValues'

export interface ProjectSummaryRow extends Record<string, unknown> {
  key: string
  projectId: string
  projectName: string
}

function findProjectTaskDate(project: ProjectInfoProject, taskId: string) {
  const tasks = Array.isArray(project.level1PlanTasks) ? project.level1PlanTasks : []
  const task = tasks.find(item => String(item?.id) === taskId)
  return typeof task?.planEndDate === 'string' && task.planEndDate ? task.planEndDate : '-'
}

export function buildProjectSummaryRow(
  project: ProjectInfoProject,
  definitions: readonly ProjectSummaryFieldDefinition[],
): ProjectSummaryRow {
  const classification = resolveProjectClassification(project.type, String(project.secondaryCategory ?? ''))
  const row: ProjectSummaryRow = {
    key: project.id,
    projectId: project.id,
    projectName: project.name,
    brand: typeof project.brand === 'string' ? project.brand : '-',
    versionType: typeof project.versionType === 'string' ? project.versionType : '-',
    tosVersion: typeof project.tosVersion === 'string' ? project.tosVersion : '-',
  }
  for (const definition of definitions) {
    if (definition.key === 'projectName') row[definition.key] = project.name
    else if (definition.key === 'projectCategory') row[definition.key] = classification.projectCategory
    else if (definition.key === 'status') row[definition.key] = formatProjectInfoValue(project.status as any)
    else if (definition.source === 'projectInfo') {
      row[definition.key] = formatProjectInfoValue(getProjectInfoValue(project, definition.key))
    } else if (definition.source === 'templateTask' && definition.taskId) {
      row[definition.key] = findProjectTaskDate(project, definition.taskId)
    }
  }
  return row
}
```

- [ ] **Step 3: Implement ordered Ant Design columns**

Add:

```ts
export function buildProjectSummaryColumns(
  definitions: readonly ProjectSummaryFieldDefinition[],
) {
  return definitions.map(definition => ({
    title: definition.title,
    dataIndex: definition.key,
    key: definition.key,
    width: definition.width,
    fixed: definition.key === 'projectName' ? 'left' as const : undefined,
    ellipsis: true,
  }))
}
```

- [ ] **Step 4: Implement `ProjectSummaryTable`**

Create a component that accepts:

```tsx
interface ProjectSummaryTableProps {
  projects: ProjectInfoProject[]
  projectType: string
  versions: { id: string; versionNo: string; status: string }[]
  currentVersion: string
  publishedSnapshots: Record<string, any[]>
  currentTemplateTasks: any[]
  storageNamespace: string
  onViewProject: (projectId: string) => void
}
```

Inside it:

1. Compute latest published tasks.
2. Build system/project-info/template definitions.
3. Normalize persisted column settings by `storageNamespace + projectType`.
4. Build schema-aware filter field definitions, adding the project-type quick fields even when they are filter-only.
5. Keep one applied `filters` array and a separate advanced-panel draft.
6. Derive quick-filter values from the applied `filters`; never store separate quick-filter state.
7. Apply `applyFilterConditions`, retaining AND across conditions and `equalsAny` OR semantics within quick fields.
8. Render compact toolbar with linked quick filters, `FloatingFilterPanel`, and `SortableColumnSettings`.
9. Render `Table` with `scroll={{ x: totalWidth, y: 'calc(100vh - 260px)' }}`.
10. Render `Empty` when projects are empty.
11. Navigate on row click.

Render each quick filter as:

```tsx
{quickFilterDefinitions.map(definition => (
  <Select
    key={definition.key}
    aria-label={`快捷筛选-${definition.label}`}
    mode="multiple"
    showSearch
    allowClear
    maxTagCount="responsive"
    placeholder={definition.label}
    options={definition.options}
    value={getLinkedQuickFilterValues(filters, definition.key)}
    onChange={values => {
      setFilters(current => updateLinkedQuickFilterCondition(
        current,
        definition.key,
        values,
      ))
    }}
    style={{ minWidth: 150, maxWidth: 220 }}
  />
))}
```

When the advanced panel opens, copy applied filters into `tempFilters`. For quick fields, render the same multi-select value control and fix the operator to `equalsAny`/“任一为”; do not offer operators that the quick control cannot represent. Clicking “确认” normalizes and applies `tempFilters`, which updates the derived quick controls. Cancel, Esc, and outside click discard `tempFilters` and leave the quick controls unchanged.

The component must not render summary-board tabs, calendar, export, saved views, share, or fullscreen actions.

- [ ] **Step 5: Run focused verification and type-check**

Run:

```bash
npm run verify:project-summary
npx tsc --noEmit
```

Expected: PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the shared table**

```bash
git add src/components/project-summary/ProjectSummaryTable.tsx src/lib/projectSummary.ts scripts/verify-project-summary.mjs
git commit -m "feat: add shared project summary table"
```

---

### Task 8: Replace the workbench list view

**Files:**
- Create: `scripts/verify-workbench-project-list.mjs`
- Modify: `src/containers/WorkspaceContainer.tsx`
- Modify: `package.json`
- Test: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Write the failing workbench integration contract**

Assert:

```js
const source = fs.readFileSync(
  path.join(root, 'src/containers/WorkspaceContainer.tsx'),
  'utf8',
)
assert.match(source, /ProjectSummaryTable/)
assert.match(source, /getWorkbenchListState/)
assert.match(source, /请选择项目分类/)
assert.match(source, /该项目分类的列表视图暂未配置/)
assert.doesNotMatch(source, /columns=\{\[\s*\{\s*title: '项目名称'/)
```

Add:

```json
"verify:workbench-list": "node scripts/verify-workbench-project-list.mjs"
```

Run:

```bash
npm run verify:workbench-list
```

Expected: FAIL because the fixed table remains.

- [ ] **Step 2: Compute the approved category state**

In `WorkspaceContainer`:

```tsx
const workbenchListState = useMemo(
  () => getWorkbenchListState(projectTypeFilter),
  [projectTypeFilter],
)
```

Render project-secondary and status quick-filter rows only when their respective booleans are true. Do not change advanced table filtering.

Give the rows stable accessible labels:

```tsx
<div aria-label="项目二级分类快捷筛选">{secondaryCategoryControls}</div>
<div aria-label="状态快捷筛选">{statusControls}</div>
```

Give the segmented view options `aria-label="卡片视图"` and `aria-label="列表视图"` so the browser path does not depend on icon position.

- [ ] **Step 3: Replace only the list branch**

Use:

```tsx
{projectListView === 'card' ? renderCards() : (
  workbenchListState.kind === 'select-category' ? (
    <Empty description="请选择项目分类" />
  ) : workbenchListState.kind === 'unsupported' ? (
    <Empty description="该项目分类的列表视图暂未配置" />
  ) : (
    <ProjectSummaryTable
      projects={workspaceFilteredProjects}
      projectType={projectTypeFilter}
      versions={versions}
      currentVersion={currentVersion}
      publishedSnapshots={publishedSnapshots}
      currentTemplateTasks={getTemplateTasksForProjectType(
        configTemplateTasksByType,
        projectTypeFilter,
      )}
      storageNamespace="workbench-project-list"
      onViewProject={projectId => {
        const project = projects.find(item => item.id === projectId)
        if (!project) return
        activateProject(project)
        setProjectSpaceModule('basic')
        setActiveModule('projectSpace')
      }}
    />
  )
)}
```

Extend the existing plan-store destructure for the required version/template values. Preserve cards, pagination, todos, search, add-project permission, and project activation.

- [ ] **Step 4: Run workbench and summary contracts**

Run:

```bash
npm run verify:workbench-list
npm run verify:project-summary
npx tsc --noEmit
```

Expected: both scripts PASS and TypeScript exits 0.

- [ ] **Step 5: Commit workbench integration**

```bash
git add package.json scripts/verify-workbench-project-list.mjs src/containers/WorkspaceContainer.tsx
git commit -m "feat: replace workbench project list table"
```

---

### Task 9: Update the project plan summary board field and node contracts

**Files:**
- Modify: `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- Modify: `src/components/roadmap/utils.ts`
- Modify: `scripts/verify-project-summary.mjs`
- Test: `npm run verify:project-summary`

- [ ] **Step 1: Add failing source assertions**

Assert:

```js
const boardSource = fs.readFileSync(
  path.join(root, 'src/components/roadmap/ProjectPlanSummaryBoard.tsx'),
  'utf8',
)
assert.match(boardSource, /getProjectSummaryFieldDefinitions/)
assert.match(boardSource, /getTemplateTaskFieldDefinitions/)
assert.doesNotMatch(boardSource, /MACHINE_MILESTONE_NAMES/)
assert.doesNotMatch(boardSource, /TOS_VERSION_MILESTONE_NAMES/)
assert.doesNotMatch(boardSource, /title: '里程碑节点'/)
```

Run:

```bash
npm run verify:project-summary
```

Expected: FAIL because the board still uses manual fields and one large milestone column.

- [ ] **Step 2: Replace manual field definitions**

For machine and tOS scopes, build available definitions from:

```ts
const projectInfoDefinitions = getProjectSummaryFieldDefinitions(activeProjectType)
const publishedTemplateTasks = getLatestPublishedTemplateTasks(
  activeProjectType,
  versions,
  publishedSnapshots,
  currentVersion,
  getTemplateTasksForProjectType(configTemplateTasksByType, activeProjectType),
)
const nodeDefinitions = getTemplateTaskFieldDefinitions(
  activeProjectType,
  publishedTemplateTasks,
)
const availableDefinitions = [...projectInfoDefinitions, ...nodeDefinitions]
```

Pass the required plan-store data into the board through its existing component/store boundary. Do not retain the manual `BASE_COLUMN_OPTIONS` field list for machine or tOS.

- [ ] **Step 3: Replace the large milestone chain**

Remove the `milestones`/`milestonesText` aggregate column from table mode. Render each direct second-level task as its own date column. Update filter options, export columns, visible-column normalization, saved-view column order, and share payloads to use stable task keys.

Keep calendar mode functional by deriving calendar events from the same node definitions and row date values rather than from the old `milestones` cell.

- [ ] **Step 4: Preserve unsupported summary scopes**

Technical-project rendering remains untouched except for shared floating controls. “Overall” must not union machine and tOS dynamic nodes; keep its current common/system-field presentation.

- [ ] **Step 5: Run focused and type verification**

Run:

```bash
npm run verify:project-summary
npm run verify:floating-panels
npx tsc --noEmit
```

Expected: all PASS.

- [ ] **Step 6: Commit summary-board migration**

```bash
git add src/components/roadmap/ProjectPlanSummaryBoard.tsx src/components/roadmap/utils.ts scripts/verify-project-summary.mjs
git commit -m "feat: align summary board with project space fields"
```

---

### Task 10: Add browser verification for approved states

**Files:**
- Create: `screenshots/verify-workbench-summary-floating-panels.mjs`
- Modify: `package.json`
- Test: `screenshots/verify-workbench-summary-floating-panels.mjs`

- [ ] **Step 1: Add the browser smoke script**

Use Puppeteer to:

```js
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const baseUrl = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
await page.goto(baseUrl, { waitUntil: 'networkidle0' })

await page.locator('::-p-text(项目列表)').click()
await page.locator('::-p-aria(列表视图)').click()
await page.locator('::-p-text(请选择项目分类)').wait()

await page.locator('::-p-aria(整机产品项目)').click()
await page.locator('::-p-aria(项目二级分类快捷筛选)').wait()
await page.locator('::-p-aria(状态快捷筛选)').wait()
for (const label of ['首销 tOS 版本', '芯片编码', '品牌', '产品系列', '产品类型']) {
  await page.locator(`::-p-aria(快捷筛选-${label})`).wait()
}
await page.locator('::-p-aria(快捷筛选-品牌)').click()
await page.locator('::-p-text(TECNO)').click()
const linkedBrandText = await page.$eval(
  '[aria-label="快捷筛选-品牌"]',
  element => element.closest('.ant-select')?.textContent ?? '',
)
assert.match(linkedBrandText, /TECNO/)
await page.locator('::-p-aria(筛选)').click()
await page.locator('::-p-text(筛选符合以下所有条件的结果)').wait()
await page.locator('::-p-aria(品牌筛选值)').wait()
assert.equal((await page.$$('.ant-drawer')).length, 0)
await page.locator('::-p-aria(取消)').click()

await page.locator('::-p-aria(列设置)').click()
await page.locator('::-p-text(列设置)').wait()
assert.equal((await page.$$('.ant-drawer')).length, 0)
await page.keyboard.press('Escape')

await page.locator('::-p-aria(tOS版本项目)').click()
assert.equal((await page.$$('::-p-aria(项目二级分类快捷筛选)')).length, 0)
assert.equal((await page.$$('::-p-aria(状态快捷筛选)')).length, 0)
await page.locator('::-p-aria(快捷筛选-版本类型)').wait()
await page.locator('::-p-aria(快捷筛选-tOS 版本)').wait()
assert.equal((await page.$$('::-p-aria(快捷筛选-品牌)')).length, 0)

await browser.close()
```

The implementation must provide these exact accessible labels; do not replace them with positional selectors.

- [ ] **Step 2: Add the browser command**

Add:

```json
"verify:workbench-browser": "node screenshots/verify-workbench-summary-floating-panels.mjs"
```

- [ ] **Step 3: Start the app and verify the script fails for any selector mismatch**

Terminal A:

```bash
npm run dev -- --port 3004
```

Expected: Next.js reports ready on `http://localhost:3004`.

Terminal B:

```bash
PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:workbench-browser
```

Expected: PASS. If a selector fails, add the missing accessible label in the component and rerun; do not weaken the assertion to a brittle positional selector.

- [ ] **Step 4: Verify the remaining surfaces manually in the same browser session**

Exercise:

- project plan summary board filter and columns;
- project roadmap filter and columns;
- project-space plan filter and columns;
- config-center plan columns;
- requirement-development and version-train columns;
- share page columns;
- summary-board fullscreen popup anchoring;
- cancel, reset, clear, confirm, outside-click, and Esc draft behavior.

Record screenshots only for failed or ambiguous states; do not add generated screenshots to git.

- [ ] **Step 5: Commit browser verification**

```bash
git add package.json screenshots/verify-workbench-summary-floating-panels.mjs
git commit -m "test: verify workbench summary interactions"
```

---

### Task 11: Final regression gate and documentation reconciliation

**Files:**
- Modify: `docs/prd/PMS-V1.0-PRD.md` only if it currently states drawer behavior or a single aggregated milestone column.
- Verify: all changed source and scripts.

- [ ] **Step 1: Search for stale product wording**

Run:

```bash
rg -n "筛选抽屉|列设置抽屉|里程碑节点列|一个大的字段|Drawer" docs/prd/PMS-V1.0-PRD.md docs/superpowers/specs
```

Expected: no active PRD statement contradicts the approved floating-panel or split-node-column behavior. Historical design documents may retain old wording.

- [ ] **Step 2: Update active PRD wording only when contradictory**

If an active PRD paragraph contradicts the implementation, replace it with:

```markdown
- 筛选和列设置使用工具按钮锚定悬浮框；确认后生效，取消、Esc 或点击外部丢弃草稿。
- 项目汇总表的计划节点列来自当前项目类型最新已发布一级计划模板的直接二级任务，每个任务独立成列。
```

Do not rewrite unrelated PRD sections.

- [ ] **Step 3: Run every focused verifier**

Run:

```bash
npm run verify:column-settings
npm run verify:floating-panels
npm run verify:project-summary
npm run verify:workbench-list
```

Expected: every command exits 0.

- [ ] **Step 4: Run repository gates**

Run:

```bash
npx tsc --noEmit
npm run build
git diff --check
git status --short
```

Expected:

- TypeScript exits 0.
- Next.js production build exits 0.
- `git diff --check` prints nothing.
- `git status --short` contains only intentional changes, or is clean after the final commit.

- [ ] **Step 5: Run browser gate against the production-equivalent UI**

Run the dev server or production build and then:

```bash
PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:workbench-browser
```

Expected: PASS for category states, project summary data, floating filters, floating columns, and no drawers.

- [ ] **Step 6: Review the diff against the approved exclusions**

Confirm:

- card view is unchanged;
- work tracker and todo center are unchanged;
- no RBAC edit action was added;
- navigation still uses the existing project activation path;
- no database/API integration was added;
- unsupported list categories remain empty;
- tOS hides only the top status quick filter, not its status field in advanced filtering or columns.
- machine shows five linked quick filters and tOS shows two;
- quick selections and confirmed advanced-filter edits share one condition array;
- multi-select values within one quick field use OR, while different conditions remain AND.

- [ ] **Step 7: Commit final reconciliation**

```bash
git add docs/prd/PMS-V1.0-PRD.md
git commit -m "docs: align project summary interaction contract"
```

If the PRD required no change, skip this commit and report that the active PRD had no contradictory wording.
