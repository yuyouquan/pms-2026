# 一级计划平铺里程碑与甘特图交互 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将整机、tOS、TDT 一级计划改为平铺里程碑列表，增加受控的 MR/转测版本节点，并让阶段、里程碑点和技术子项目活动在甘特图中按不同规则编辑与持久化。

**Architecture:** 保留现有父子任务和版本数据，通过纯规则函数生成平铺列表、结构命令、日期校验和甘特任务；React 组件只组合权限、弹窗和 store 写回。共享 `DHTMLXGantt` 增加逐任务类型、逐任务只读和拖动回调，整机/tOS/TDT 与技术子项目分别把回调写入自己的当前修订版本。

**Tech Stack:** Next.js 14、React 18、TypeScript、Ant Design 6、Zustand 4、DHTMLX Gantt 9.1、Node.js `assert` 验证脚本、Puppeteer 浏览器验收。

---

## File map

- Create `src/lib/planGanttRules.ts`: 纯函数生成甘特任务策略并把拖动结果转换为计划字段。
- Create `scripts/verify-level1-flat-milestone-gantt.mjs`: 运行 TypeScript 纯规则和关键 UI 契约验证。
- Create `screenshots/verify-level1-flat-milestone-gantt-browser.mjs`: 浏览器验收整机、tOS、TDT、子项目的列表和甘特交互。
- Modify `src/lib/level1PlanRules.ts`: 平铺里程碑投影、MR 自动编号/插入、仅删除结构权限、周期更新。
- Modify `src/lib/technicalPlanRules.ts`: 子项目模板、转测版本自动插入、四日期校验。
- Modify `src/lib/technicalPlanWorkspace.ts`: 按 TDT/子项目输出不同列表与导出字段。
- Modify `src/lib/versionCompare.ts`: 在稳定 ID 比对结果中保留阶段、里程碑和活动展示字段。
- Modify `src/components/shared/PlanHelpers.tsx`: DHTMLX 逐任务只读、milestone/project/task 类型、拖动保存和失败回滚。
- Modify `src/components/plans/PlanVersionCompareModal.tsx`: 增加平铺里程碑和技术子项目两种对比列模式。
- Modify `src/containers/ProjectSpaceContainer.tsx`: 整机/tOS 平铺表格、MR 按钮、甘特拖动写回。
- Modify `src/components/technical-project/TechnicalPlanModule.tsx`: TDT 平铺表格、子项目活动表格、转测按钮和两类甘特写回。
- Modify `src/stores/plan.ts`: 配置模板种子迁移，并持久化整机市场与 tOS 类型修订数据。
- Modify `src/stores/technicalPlan.ts`: 三节点子项目 Mock 日期分段和持久化版本迁移。
- Modify `src/styles/globals.css`: 平铺列表、锁定阶段、里程碑点和子项目甘特条的必要样式。
- Modify `package.json`: 注册聚焦规则验证与浏览器验证命令。

## Task 1: Add flat-row projections and technical subproject date rules

**Files:**
- Create: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/lib/technicalPlanRules.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing flat-projection and date-validation test**

Create `scripts/verify-level1-flat-milestone-gantt.mjs` with a TypeScript loader and assertions that require the new APIs:

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const loadTs = async relativePath => {
  const filename = path.join(root, relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const level1 = await loadTs('src/lib/level1PlanRules.ts')
const technical = await loadTs('src/lib/technicalPlanRules.ts')

const hierarchy = [
  { id: '1', stableId: 'stage-concept', order: 0, taskName: '概念阶段', source: 'template' },
  { id: '1.1', stableId: 'concept-start', parentId: '1', order: 0, taskName: '概念启动', source: 'template', status: '已完成', planStartDate: '2026-01-01', planEndDate: '2026-01-01', estimatedDays: 1, actualStartDate: '2026-01-01', actualEndDate: '2026-01-01', actualDays: 1 },
  { id: '1.2', stableId: 'str1', parentId: '1', order: 1, taskName: 'STR1', source: 'template', status: '已完成', planStartDate: '2026-01-02', planEndDate: '2026-01-16', estimatedDays: 15, actualStartDate: '2026-01-02', actualEndDate: '2026-01-16', actualDays: 15 },
  { id: '2', stableId: 'stage-plan', order: 1, taskName: '计划阶段', source: 'template' },
  { id: '2.1', stableId: 'str2', parentId: '2', order: 0, taskName: 'STR2', source: 'template', status: '未开始', planStartDate: '2026-01-17', planEndDate: '2026-02-14', estimatedDays: 29, actualStartDate: '', actualEndDate: '', actualDays: 0 },
]

const flat = level1.projectLevel1FlatMilestones(hierarchy, { today: '2026-01-20' })
assert.deepEqual(flat.map(row => [row.sequence, row.stageName, row.milestoneName]), [
  [1, '概念阶段', '概念启动'],
  [2, '概念阶段', 'STR1'],
  [3, '计划阶段', 'STR2'],
])
assert.equal(flat.some(row => row.taskName === '概念阶段'), false)
assert.equal(flat[1].estimatedDays, 15)

const subproject = level1.projectTechnicalSubprojectRows([
  { id: '1', stableId: 'transfer-1', order: 0, taskName: '第1版转测', source: 'template', status: '进行中', planStartDate: '2026-03-01', planEndDate: '2026-03-15', actualStartDate: '2026-03-02', actualEndDate: '2026-03-16' },
])
assert.deepEqual(subproject.map(row => [row.sequence, row.activityName, row.planStartDate, row.planEndDate]), [
  [1, '第1版转测', '2026-03-01', '2026-03-15'],
])
assert.equal(subproject[0].estimatedDays, 14)
assert.equal(subproject[0].actualDays, 14)

const invalidSubproject = technical.validateTechnicalSubprojectDates([
  { id: '1', order: 0, taskName: '第1版转测', planStartDate: '2026-03-20', planEndDate: '2026-03-10', actualStartDate: '2026-03-18', actualEndDate: '2026-03-15' },
])
assert.equal(invalidSubproject.valid, false)
assert.match(invalidSubproject.byTaskId['1'].planStartDate[0], /不得晚于/)
assert.match(invalidSubproject.byTaskId['1'].actualEndDate[0], /不得早于/)

console.log('PASS level1 flat milestone and gantt rules')
```

Add package commands:

```json
"verify:level1-flat-gantt": "node scripts/verify-level1-flat-milestone-gantt.mjs",
"verify:level1-flat-gantt-browser": "node screenshots/verify-level1-flat-milestone-gantt-browser.mjs"
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run verify:level1-flat-gantt`

Expected: FAIL because `projectLevel1FlatMilestones`, `projectTechnicalSubprojectRows`, or `validateTechnicalSubprojectDates` is missing.

- [ ] **Step 3: Implement flat rows and four-date validation**

In `src/lib/level1PlanRules.ts`, extend `Level1PlanTask` with the existing schedule fields and add these exported row contracts and projectors:

```ts
export interface Level1PlanTask {
  id: string
  stableId?: string
  parentId?: string | null
  order: number
  taskName: string
  role?: string
  source?: Level1TaskSource
  status?: string
  progress?: number
  responsible?: string
  predecessor?: string
  planStartDate?: string
  planEndDate?: string
  estimatedDays?: number | null
  actualStartDate?: string
  actualEndDate?: string
  actualDays?: number | null
}

export interface Level1FlatMilestoneRow extends Level1PlanTask {
  sequence: number
  stageId: string
  stageStableId: string
  stageName: string
  milestoneName: string
  activityName: string
  planStartDate: string
  planEndDate: string
  estimatedDays: number | null
  actualStartDate: string
  actualEndDate: string
  actualDays: number | null
  delayStatus: Level1DelayStatus
}

const durationFromTask = (
  task: Level1PlanTask,
  startKey: 'planStartDate' | 'actualStartDate',
  endKey: 'planEndDate' | 'actualEndDate',
  durationKey: 'estimatedDays' | 'actualDays',
) => {
  const calculated = getLevel1DateDifference(String(task[startKey] || ''), String(task[endKey] || ''))
  if (calculated !== null) return calculated
  const stored = task[durationKey]
  return typeof stored === 'number' && stored >= 0 ? stored : null
}

export const projectLevel1FlatMilestones = (
  tasks: readonly Level1PlanTask[],
  options: { today?: string } = {},
): Level1FlatMilestoneRow[] => {
  const today = options.today || new Date().toISOString().slice(0, 10)
  const ordered = getOrderedLevel1Tasks(tasks)
  const byId = new Map(ordered.map(task => [task.id, task]))
  return ordered.filter(task => Boolean(task.parentId)).map((task, index) => {
    const stage = byId.get(task.parentId!)
    return {
      ...task,
      sequence: index + 1,
      stageId: stage?.id || '',
      stageStableId: stage?.stableId || stage?.id || '',
      stageName: stage?.taskName || '',
      milestoneName: task.taskName,
      activityName: task.taskName,
      planStartDate: task.planStartDate || '',
      planEndDate: task.planEndDate || '',
      estimatedDays: durationFromTask(task, 'planStartDate', 'planEndDate', 'estimatedDays'),
      actualStartDate: task.actualStartDate || '',
      actualEndDate: task.actualEndDate || '',
      actualDays: durationFromTask(task, 'actualStartDate', 'actualEndDate', 'actualDays'),
      delayStatus: getLevel1DelayStatus(task.planEndDate || '', task.actualEndDate || '', today),
    }
  })
}

export const projectTechnicalSubprojectRows = (
  tasks: readonly Level1PlanTask[],
): Level1FlatMilestoneRow[] => getOrderedLevel1Tasks(tasks).map((task, index) => ({
  ...task,
  sequence: index + 1,
  stageId: '',
  stageStableId: '',
  stageName: '',
  milestoneName: '',
  activityName: task.taskName,
  planStartDate: task.planStartDate || '',
  planEndDate: task.planEndDate || '',
  estimatedDays: durationFromTask(task, 'planStartDate', 'planEndDate', 'estimatedDays'),
  actualStartDate: task.actualStartDate || '',
  actualEndDate: task.actualEndDate || '',
  actualDays: durationFromTask(task, 'actualStartDate', 'actualEndDate', 'actualDays'),
  delayStatus: getLevel1DelayStatus(task.planEndDate || '', task.actualEndDate || '', new Date().toISOString().slice(0, 10)),
}))
```

In `src/lib/technicalPlanRules.ts`, add a validator that allows empty partial input but reports both sides of an invalid pair:

```ts
export type TechnicalSubprojectDateField = 'planStartDate' | 'planEndDate' | 'actualStartDate' | 'actualEndDate'

export const validateTechnicalSubprojectDates = (tasks: readonly TechnicalTemplateTaskInput[]) => {
  const byTaskId: Record<string, Partial<Record<TechnicalSubprojectDateField, string[]>>> = {}
  const add = (id: string, field: TechnicalSubprojectDateField, message: string) => {
    byTaskId[id] = byTaskId[id] || {}
    byTaskId[id][field] = [...(byTaskId[id][field] || []), message]
  }
  tasks.forEach(task => {
    if (!task.id) return
    const planStart = String(task.planStartDate || '')
    const planEnd = String(task.planEndDate || '')
    const actualStart = String(task.actualStartDate || '')
    const actualEnd = String(task.actualEndDate || '')
    if (planStart && planEnd && planStart > planEnd) {
      add(task.id, 'planStartDate', '计划开始时间不得晚于计划完成时间')
      add(task.id, 'planEndDate', '计划完成时间不得早于计划开始时间')
    }
    if (actualStart && actualEnd && actualStart > actualEnd) {
      add(task.id, 'actualStartDate', '实际开始时间不得晚于实际完成时间')
      add(task.id, 'actualEndDate', '实际完成时间不得早于实际开始时间')
    }
  })
  return { valid: Object.keys(byTaskId).length === 0, byTaskId }
}
```

- [ ] **Step 4: Run the focused and existing governance tests**

Run: `npm run verify:level1-flat-gantt && npm run verify:level1-plan-governance && npm run verify:technical-plan`

Expected: all three commands print PASS and exit 0. Update old assertions that expected subproject projected start/duration to be empty so they now expect retained dates and durations.

- [ ] **Step 5: Commit the projection rules**

```bash
git add package.json scripts/verify-level1-flat-milestone-gantt.mjs src/lib/level1PlanRules.ts src/lib/technicalPlanRules.ts
git commit -m "feat: add flat level1 plan projections"
```

## Task 2: Add locked automatic MR and transfer-version commands

**Files:**
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/lib/technicalPlanRules.ts`
- Modify: `src/stores/technicalPlan.ts`

- [ ] **Step 1: Add failing command assertions**

Append assertions that lock names/order and prove only generated nodes can be deleted:

```js
const launchTasks = [
  { id: '4', stableId: 'stage-launch', order: 3, taskName: '上市阶段', source: 'template' },
  { id: '4.1', stableId: 'mr1', parentId: '4', order: 0, taskName: 'MR1', source: 'template' },
  { id: '4.2', stableId: 'mr2', parentId: '4', order: 1, taskName: 'MR2', source: 'template' },
]
const mr4Result = level1.insertNextMachineMrMilestone(launchTasks)
assert.equal(mr4Result.ok, true)
assert.equal(mr4Result.task.taskName, 'MR4')
const mr5Result = level1.insertNextMachineMrMilestone(mr4Result.tasks)
assert.equal(mr5Result.task.taskName, 'MR5')
const mrAfterDelete = level1.insertNextMachineMrMilestone(
  mr5Result.tasks.filter(task => task.stableId !== mr5Result.task.stableId),
)
assert.equal(mrAfterDelete.task.taskName, 'MR5')
assert.equal(level1.canAddLevel1CustomChild('整机产品项目', launchTasks[0]), false)
assert.equal(level1.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: mr4Result.task, parent: launchTasks[0], action: 'rename' }), false)
assert.equal(level1.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: mr4Result.task, parent: launchTasks[0], action: 'reorder' }), false)
assert.equal(level1.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: mr4Result.task, parent: launchTasks[0], action: 'delete' }), true)

assert.deepEqual(technical.SUBPROJECT_TEMPLATE_SEED, ['第1版转测', '第2版转测', 'TDR3'])
const transferResult = technical.insertNextTechnicalSubprojectTransfer(technical.buildSubprojectTemplateTasks())
assert.equal(transferResult.ok, true)
assert.deepEqual(transferResult.tasks.map(task => task.taskName), ['第1版转测', '第2版转测', '第3版转测', 'TDR3'])
const transfer4Result = technical.insertNextTechnicalSubprojectTransfer(transferResult.tasks)
assert.deepEqual(transfer4Result.tasks.map(task => task.taskName), ['第1版转测', '第2版转测', '第3版转测', '第4版转测', 'TDR3'])
const transferAfterDelete = technical.insertNextTechnicalSubprojectTransfer(
  transfer4Result.tasks.filter(task => task.stableId !== transfer4Result.task.stableId),
)
assert.deepEqual(transferAfterDelete.tasks.map(task => task.taskName), ['第1版转测', '第2版转测', '第3版转测', '第4版转测', 'TDR3'])
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run verify:level1-flat-gantt`

Expected: FAIL because the insertion commands do not exist and the seed still contains `第X版转测`.

- [ ] **Step 3: Implement machine MR insertion and delete-only permission**

In `src/lib/level1PlanRules.ts`, export a stable-ID-preserving renumber helper, a discriminated command result, and the insertion command:

```ts
export const renumberLevel1Tasks = (tasks: readonly Level1PlanTask[]): Level1PlanTask[] => {
  const ordered = getOrderedLevel1Tasks(tasks)
  const roots = ordered.filter(task => !task.parentId)
  const idByOldId = new Map(roots.map((task, index) => [task.id, String(index + 1)]))
  return roots.flatMap((root, rootIndex) => {
    const rootId = String(rootIndex + 1)
    const children = ordered.filter(task => task.parentId === root.id)
    return [
      { ...root, id: rootId, stableId: root.stableId || root.id, order: rootIndex },
      ...children.map((child, childIndex) => ({
        ...child,
        id: `${rootId}.${childIndex + 1}`,
        stableId: child.stableId || child.id,
        parentId: idByOldId.get(String(child.parentId)) || rootId,
        order: childIndex,
      })),
    ]
  })
}

export type Level1InsertResult =
  | { ok: true; tasks: Level1PlanTask[]; task: Level1PlanTask }
  | { ok: false; tasks: Level1PlanTask[]; reason: 'launch-stage-missing' | 'duplicate-name' }

export const insertNextMachineMrMilestone = (tasks: readonly Level1PlanTask[]): Level1InsertResult => {
  const ordered = getOrderedLevel1Tasks(tasks)
  const stage = ordered.find(task => !task.parentId && isLaunchStageTask(task))
  if (!stage) return { ok: false, tasks: ordered, reason: 'launch-stage-missing' }
  const siblings = ordered.filter(task => task.parentId === stage.id)
  const maxMr = siblings.reduce((max, task) => {
    const match = /^MR(\d+)$/.exec(task.taskName.trim())
    return match ? Math.max(max, Number(match[1])) : max
  }, 3)
  const taskName = `MR${maxMr + 1}`
  if (siblings.some(task => task.taskName === taskName)) return { ok: false, tasks: ordered, reason: 'duplicate-name' }
  const nonce = Date.now()
  const task: Level1PlanTask = {
    id: `machine-mr-${nonce}`,
    stableId: `machine-mr-${nonce}-${maxMr + 1}`,
    parentId: stage.id,
    order: siblings.length,
    taskName,
    source: 'custom',
    planStartDate: '', planEndDate: '', estimatedDays: null,
    actualStartDate: '', actualEndDate: '', actualDays: null,
    status: '未开始', progress: 0,
  }
  return { ok: true, tasks: renumberLevel1Tasks([...ordered, task]), task }
}
```

Replace the launch-stage and structural permission rules with:

```ts
const isLaunchStageTask = (task?: Level1PlanTask) => Boolean(
  task && (
    task.stableId === 'stage-launch'
    || task.taskName === '上市阶段'
    || task.taskName === '上市收编阶段'
  ),
)

export const canAddLevel1CustomChild = (_projectType: string, _parent: Level1PlanTask): boolean => false

export const canMutateLevel1TaskStructure = (input: Level1StructureMutationInput): boolean => {
  if (input.task.source !== 'custom') return false
  if (input.action !== 'delete') return false
  if (input.technicalKind === 'tdt') return false
  if (input.technicalKind === 'subproject') return !input.task.parentId
  return input.projectType === '整机产品项目'
    && Boolean(input.task.parentId)
    && isLaunchStageTask(input.parent)
}
```

Use `renumberLevel1Tasks` after deleting a custom MR as well as after insertion. Stable IDs must never change when display IDs are regenerated.

- [ ] **Step 4: Implement the subproject seed, command, and Mock migration**

In `src/lib/technicalPlanRules.ts`, set the exact template and add insertion before `TDR3`:

```ts
export const SUBPROJECT_TEMPLATE_SEED = ['第1版转测', '第2版转测', 'TDR3'] as const

export const insertNextTechnicalSubprojectTransfer = (tasks: readonly TechnicalTemplateTask[]) => {
  const ordered = [...tasks].sort((left, right) => left.order - right.order)
  const tdrIndex = ordered.findIndex(task => task.taskName === 'TDR3')
  if (tdrIndex < 0) return { ok: false as const, tasks: ordered, reason: 'tdr3-missing' as const }
  const maxVersion = ordered.reduce((max, task) => {
    const match = /^第(\d+)版转测$/.exec(task.taskName.trim())
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  const taskName = `第${maxVersion + 1}版转测`
  if (ordered.some(task => task.taskName === taskName)) {
    return { ok: false as const, tasks: ordered, reason: 'duplicate-name' as const }
  }
  const nonce = Date.now()
  const task: TechnicalTemplateTask = {
    id: `technical-transfer-${nonce}`,
    stableId: `technical-transfer-${nonce}-${maxVersion + 1}`,
    source: 'custom', order: tdrIndex, taskName,
    responsible: '技术项目负责人', predecessor: '',
    planStartDate: '', planEndDate: '', estimatedDays: 0,
    actualStartDate: '', actualEndDate: '', actualDays: 0,
    status: '未开始', progress: 0, defaultRoadmap: false,
  }
  const next = [...ordered.slice(0, tdrIndex), task, ...ordered.slice(tdrIndex)]
    .map((item, index) => ({ ...item, id: String(index + 1), order: index + 1 }))
  return { ok: true as const, tasks: next, task: next.find(item => item.stableId === task.stableId)! }
}
```

Add `migrateTechnicalSubprojectSeedState` in `src/lib/technicalPlanRules.ts`. It replaces only an exact legacy current configuration seed (`第1版转测、第2版转测、第X版转测、TDR3`) and leaves any customized template and every published snapshot untouched:

```ts
export const migrateTechnicalSubprojectSeedState = <T extends Record<string, any>>(state: T): T => {
  const templates = { ...(state.configTemplateTasksByType || {}) }
  const key = TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject
  const current = Array.isArray(templates[key]) ? templates[key] : []
  const names = current.map((task: TechnicalTemplateTaskInput) => String(task.taskName || '')).join('|')
  if (names === '第1版转测|第2版转测|第X版转测|TDR3') templates[key] = buildSubprojectTemplateTasks()
  return { ...state, configTemplateTasksByType: templates }
}
```

In `src/stores/plan.ts`, bump `PLAN_STORE_VERSION` from `5` to `6` and invoke this migration only when `persistedVersion < 6`:

```ts
const seedMigrated = persistedVersion < 6
  ? migrateTechnicalSubprojectSeedState(migrated)
  : migrated
```

Use `seedMigrated` for the remainder of `migratePlanStoreState`; do not modify existing `publishedSnapshots` or historical `configTemplateVersionScopes`.

In `src/stores/technicalPlan.ts`, calculate subproject Mock ranges using `const segmentCount = buildSubprojectTemplateTasks().length` instead of the literal `4` in both division expressions. Bump `TECHNICAL_PLAN_STORE_VERSION` to `8` so missing default scopes use the new three-row seed, but keep all valid stored `versions[].tasks` unchanged so historical published plans are never rewritten solely because they contain `第X版转测`.

- [ ] **Step 5: Run focused and store regression tests**

Run: `npm run verify:level1-flat-gantt && npm run verify:level1-plan-governance && npm run verify:technical-plan && npm run verify:technical-project`

Expected: all commands exit 0; old assertions that custom nodes can rename/reorder are replaced with delete-only assertions.

- [ ] **Step 6: Commit automatic structure commands**

```bash
git add scripts/verify-level1-flat-milestone-gantt.mjs src/lib/level1PlanRules.ts src/lib/technicalPlanRules.ts src/stores/plan.ts src/stores/technicalPlan.ts
git commit -m "feat: add controlled MR and transfer milestones"
```

## Task 3: Add typed Gantt behavior and persistent drag callbacks

**Files:**
- Create: `src/lib/planGanttRules.ts`
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `src/components/shared/PlanHelpers.tsx`

- [ ] **Step 1: Add failing Gantt policy assertions**

Load `src/lib/planGanttRules.ts` in the verification script and assert the three node modes:

```js
const ganttRules = await loadTs('src/lib/planGanttRules.ts')
const ganttHierarchy = ganttRules.buildPlanGanttTasks(hierarchy, { mode: 'hierarchical', editable: true })
assert.deepEqual(ganttHierarchy.map(task => [task.id, task.type, task.readonly]), [
  ['1', 'project', true],
  ['1.1', 'milestone', false],
  ['1.2', 'milestone', false],
  ['2', 'project', true],
  ['2.1', 'milestone', false],
])
assert.equal(ganttHierarchy.find(task => task.id === '1.2').start_date, '2026-01-16')
assert.deepEqual(
  [ganttHierarchy.find(task => task.id === '1').start_date, ganttHierarchy.find(task => task.id === '1').end_date],
  ['2026-01-01', '2026-01-16'],
)

const ganttSubproject = ganttRules.buildPlanGanttTasks(subproject, { mode: 'technical-subproject', editable: true })
assert.deepEqual(ganttSubproject.map(task => [task.type, task.readonly]), [['task', false]])

const movedMilestone = ganttRules.applyPlanGanttDateChange(hierarchy, {
  taskId: '1.2', mode: 'milestone', startDate: '2026-01-20', endDate: '2026-01-20',
})
assert.equal(movedMilestone.find(task => task.id === '1.2').planEndDate, '2026-01-20')
assert.equal(movedMilestone.find(task => task.id === '1.2').actualEndDate, '2026-01-16')
assert.equal(movedMilestone.find(task => task.id === '1.2').estimatedDays, 18)

const movedBar = ganttRules.applyPlanGanttDateChange(subproject, {
  taskId: '1', mode: 'task', startDate: '2026-03-03', endDate: '2026-03-17',
})
assert.deepEqual([movedBar[0].planStartDate, movedBar[0].planEndDate], ['2026-03-03', '2026-03-17'])
assert.equal(movedBar[0].estimatedDays, 14)

const movedActual = ganttRules.applyPlanTaskDatePatch(subproject, {
  taskId: '1', patch: { actualStartDate: '2026-03-04', actualEndDate: '2026-03-19' },
})
assert.equal(movedActual[0].actualDays, 15)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run verify:level1-flat-gantt`

Expected: FAIL with `ENOENT` for `src/lib/planGanttRules.ts`.

- [ ] **Step 3: Implement pure Gantt rules**

Create `src/lib/planGanttRules.ts` with explicit modes and immutable updates:

```ts
import type { Level1PlanTask } from '@/lib/level1PlanRules'

export type PlanGanttMode = 'hierarchical' | 'technical-subproject'
export type PlanGanttNodeType = 'project' | 'milestone' | 'task'

export interface PlanGanttDateChange {
  taskId: string
  mode: 'milestone' | 'task'
  startDate: string
  endDate: string
}

export interface PlanTaskDatePatch {
  taskId: string
  patch: Partial<Pick<Level1PlanTask, 'planStartDate' | 'planEndDate' | 'actualStartDate' | 'actualEndDate'>>
}

const dateDifference = (start: string, end: string): number | null => {
  const startTime = /^\d{4}-\d{2}-\d{2}$/.test(start) ? Date.parse(`${start}T00:00:00Z`) : Number.NaN
  const endTime = /^\d{4}-\d{2}-\d{2}$/.test(end) ? Date.parse(`${end}T00:00:00Z`) : Number.NaN
  return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= startTime
    ? Math.round((endTime - startTime) / 86_400_000)
    : null
}

export const applyPlanTaskDatePatch = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  input: PlanTaskDatePatch,
): Task[] => tasks.map(task => {
  if (task.id !== input.taskId) return { ...task }
  const next = { ...task, ...input.patch }
  const estimatedDays = dateDifference(String(next.planStartDate || ''), String(next.planEndDate || ''))
  const actualDays = dateDifference(String(next.actualStartDate || ''), String(next.actualEndDate || ''))
  return {
    ...next,
    ...(estimatedDays !== null ? { estimatedDays } : {}),
    ...(actualDays !== null ? { actualDays } : {}),
  }
})

const addDay = (value: string) => {
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) ? new Date(time + 86_400_000).toISOString().slice(0, 10) : ''
}

export const buildPlanGanttTasks = (
  tasks: readonly Level1PlanTask[],
  options: { mode: PlanGanttMode; editable: boolean },
) => {
  let previousStageEnd = ''
  const stageBounds = new Map<string, { start: string; end: string }>()
  tasks.filter(task => !task.parentId).sort((left, right) => left.order - right.order).forEach(stage => {
    const milestones = tasks.filter(task => task.parentId === stage.id).sort((left, right) => left.order - right.order)
    const first = milestones.find(task => task.planStartDate || task.planEndDate)
    const last = [...milestones].reverse().find(task => task.planEndDate || task.planStartDate)
    const start = String(stage.planStartDate || (previousStageEnd ? addDay(previousStageEnd) : first?.planStartDate || first?.planEndDate || ''))
    const end = String(stage.planEndDate || last?.planEndDate || last?.planStartDate || '')
    stageBounds.set(stage.id, { start, end })
    if (end) previousStageEnd = end
  })
  return tasks.map(task => {
  const type: PlanGanttNodeType = options.mode === 'technical-subproject'
    ? 'task'
    : task.parentId ? 'milestone' : 'project'
  const milestoneDate = task.planEndDate || task.planStartDate || ''
  const bounds = stageBounds.get(task.id)
  return {
    ...task,
    type,
    readonly: !options.editable || type === 'project',
    start_date: type === 'milestone' ? milestoneDate : bounds?.start || task.planStartDate || '',
    end_date: type === 'milestone' ? milestoneDate : bounds?.end || task.planEndDate || '',
    duration: type === 'milestone' ? 0 : dateDifference(bounds?.start || task.planStartDate || '', bounds?.end || task.planEndDate || '') ?? task.estimatedDays ?? 1,
  }
  })
}

export const applyPlanGanttDateChange = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  change: PlanGanttDateChange,
): Task[] => applyPlanTaskDatePatch(tasks, {
  taskId: change.taskId,
  patch: change.mode === 'milestone'
    ? { planEndDate: change.endDate || change.startDate }
    : { planStartDate: change.startDate, planEndDate: change.endDate },
})
```

- [ ] **Step 4: Extend `DHTMLXGantt` with per-task editability and rollback**

Add this callback contract to `PlanHelpers.tsx`:

```ts
export interface DHTMLXGanttDateChange {
  taskId: string
  nodeType: 'milestone' | 'task'
  startDate: string
  endDate: string
}

onTaskDateChange?: (change: DHTMLXGanttDateChange) => boolean

const onTaskDateChangeRef = useRef(onTaskDateChange)
useEffect(() => {
  onTaskDateChangeRef.current = onTaskDateChange
}, [onTaskDateChange])
```

During data mapping, preserve supplied type and readonly values:

```ts
type: t.type || (t.parentId ? 'task' : 'project'),
readonly: readOnly || Boolean(t.readonly),
start_date: t.start_date ?? t.planStartDate ?? '',
end_date: t.end_date ?? t.planEndDate ?? '',
duration: t.duration ?? t.estimatedDays ?? 1,
```

Set `gantt.config.readonly_property = 'readonly'`. Add deterministic classes for browser verification and locked-stage styling:

```ts
gantt.templates.task_class = (_start, _end, task) => [
  `pms-gantt-${task.type || 'task'}`,
  task.readonly ? 'pms-gantt-task-readonly' : 'pms-gantt-task-editable',
].join(' ')
```

Attach and clean up drag and lightbox events:

```ts
let dragSnapshot: { id: string; start: Date; end: Date } | null = null
const beforeDragHandler = gantt.attachEvent('onBeforeTaskDrag', (id: string | number) => {
  const task = gantt.getTask(id)
  if (readOnly || task.readonly || task.type === 'project') return false
  dragSnapshot = { id: String(id), start: new Date(task.start_date), end: new Date(task.end_date) }
  return true
})
const afterDragHandler = gantt.attachEvent('onAfterTaskDrag', (id: string | number) => {
  const task = gantt.getTask(id)
  const accepted = onTaskDateChangeRef.current?.({
    taskId: String(id),
    nodeType: task.type === 'milestone' ? 'milestone' : 'task',
    startDate: gantt.date.date_to_str('%Y-%m-%d')(task.start_date),
    endDate: gantt.date.date_to_str('%Y-%m-%d')(task.end_date),
  }) !== false
  if (!accepted && dragSnapshot?.id === String(id)) {
    task.start_date = dragSnapshot.start
    task.end_date = dragSnapshot.end
    gantt.updateTask(id)
  }
  dragSnapshot = null
  return true
})
const beforeLightboxHandler = gantt.attachEvent('onBeforeLightbox', (id: string | number) => {
  const task = gantt.getTask(id)
  return !(readOnly || task.readonly || task.type === 'project')
})
```

Keep the callback in `onTaskDateChangeRef`, update the ref in a separate effect, detach `beforeDragHandler`, `afterDragHandler`, and `beforeLightboxHandler` during cleanup, and do not add the callback itself to the parse effect dependency list. Restore the drag snapshot and call `gantt.updateTask(id)` whenever the callback returns `false`.

- [ ] **Step 5: Run rules, type-check, and build**

Run: `npm run verify:level1-flat-gantt && npx tsc --noEmit && npm run build`

Expected: all commands exit 0; build prints `Compiled successfully`.

- [ ] **Step 6: Commit shared Gantt behavior**

```bash
git add scripts/verify-level1-flat-milestone-gantt.mjs src/lib/planGanttRules.ts src/components/shared/PlanHelpers.tsx
git commit -m "feat: support typed gantt task editing"
```

## Task 4: Render whole-machine and tOS flat lists and wire MR/Gantt actions

**Files:**
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/stores/plan.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add failing project-space UI contract checks**

Append source checks that require the new labels and forbid the old editable tree affordances inside the governed table branch:

```js
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const projectSpaceSource = read('src/containers/ProjectSpaceContainer.tsx')
for (const label of ['阶段', '里程碑点', '计划开发周期', '实际开发周期', '添加上市阶段 MR 里程碑']) {
  assert.match(projectSpaceSource, new RegExp(label), `project-space flat table contains ${label}`)
}
assert.match(projectSpaceSource, /insertNextMachineMrMilestone/)
assert.match(projectSpaceSource, /projectLevel1FlatMilestones/)
assert.match(projectSpaceSource, /buildPlanGanttTasks/)
assert.match(projectSpaceSource, /onTaskDateChange/)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run verify:level1-flat-gantt`

Expected: FAIL because the project-space component does not contain the new table labels and commands.

- [ ] **Step 3: Replace the governed tree table with the flat milestone table**

In `renderTaskTable`, compute `flatRows = projectLevel1FlatMilestones(tableTasks)` and feed those rows directly to Ant Design Table. The governed columns must be exactly:

```ts
const governedColumns: ColumnsType<Level1FlatMilestoneRow> = [
  { title: '序号', dataIndex: 'sequence', key: 'sequence', width: 72, fixed: 'left' },
  { title: '阶段', dataIndex: 'stageName', key: 'stageName', width: 160, fixed: 'left' },
  { title: '里程碑点', dataIndex: 'milestoneName', key: 'milestoneName', width: 160, fixed: 'left' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: value => value || '-' },
  { title: '计划完成时间', dataIndex: 'planEndDate', key: 'planEndDate', width: 145, render: renderEditablePlanEnd },
  { title: '计划开发周期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 120, render: value => value == null ? '-' : `${value}天` },
  { title: '实际完成时间', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 145, render: renderEditableActualEnd },
  { title: '实际开发周期', dataIndex: 'actualDays', key: 'actualDays', width: 120, render: value => value == null ? '-' : `${value}天` },
]
```

Append the operation column only when `flatRows.some(row => canMutateGovernedTask(row, 'delete'))`; otherwise do not render a blank operation column. Remove governed-table drag handles, inline task-name inputs, parent add buttons, tree indentation, expand/collapse filtering, and row sorting. Keep filtering by applying current filters to the projected flat rows. Add `aria-label="计划版本"` to the level-one version selector so browser verification can explicitly select draft/latest/history.

Both editable date renderers must use `applyPlanTaskDatePatch`: planned completion is editable only in the maintainable current draft, while actual completion is editable in that draft or the latest published version with existing maintenance permission. Historical published versions remain read-only:

```tsx
const patchGovernedDate = (
  record: Level1FlatMilestoneRow,
  field: 'planEndDate' | 'actualEndDate',
  value: string,
) => currentSetTasks(applyPlanTaskDatePatch(tableTasks, { taskId: record.id, patch: { [field]: value } }))

const canEditPlanEnd = (record: Level1FlatMilestoneRow) => isGovernedDraft && Boolean(record.parentId)
const canEditActualEnd = (record: Level1FlatMilestoneRow) => (
  canMaintainCurrentPlan && (isCurrentDraft || isLatestPublished) && Boolean(record.parentId)
)
```

- [ ] **Step 4: Add the confirmed MR button and delete-only interaction**

Render the button only for whole-machine draft scopes with maintenance permission:

```tsx
{isMachineProjectType(selectedProject?.type) && isCurrentDraft && canMaintainCurrentPlan && !followedTosLevel1ReadOnly && (
  <Button
    icon={<PlusOutlined />}
    onClick={() => Modal.confirm({
      title: '确认添加上市阶段 MR 里程碑？',
      content: '系统将自动生成下一个 MR 编号，名称不可修改。',
      okText: '确认添加',
      cancelText: '取消',
      onOk: () => {
        const result = insertNextMachineMrMilestone(effectiveTasks)
        if (!result.ok) {
          message.error(result.reason === 'launch-stage-missing' ? '未找到上市阶段' : 'MR 编号已存在')
          return
        }
        setEffectiveTasks(result.tasks)
        message.success(`已添加 ${result.task.taskName}`)
      },
    })}
  >
    添加上市阶段 MR 里程碑
  </Button>
)}
```

The delete action calls the existing current-scope setter after filtering by stable ID, and is rendered only when `source === 'custom'` and this exact check is true:

```ts
canMutateLevel1TaskStructure({
  projectType: selectedProject.type,
  task: record,
  parent: effectiveTasks.find(task => task.id === record.parentId),
  action: 'delete',
})
```

- [ ] **Step 5: Wire typed Gantt tasks and milestone persistence**

Build tasks with `mode: 'hierarchical'` and set `editable` only for an editable current draft. Handle the callback synchronously:

```tsx
<DHTMLXGantt
  tasks={buildPlanGanttTasks(filteredTasks, {
    mode: 'hierarchical',
    editable: isCurrentDraft && canMaintainCurrentPlan && !followedTosLevel1ReadOnly,
  })}
  readOnly={!isCurrentDraft || !canMaintainCurrentPlan || followedTosLevel1ReadOnly}
  scaleMode={projectPlanGanttScaleMode}
  onTaskDateChange={change => {
    if (change.nodeType !== 'milestone') return false
    const next = applyPlanGanttDateChange(effectiveTasks, { ...change, mode: 'milestone' })
    const validation = validateLevel1MilestoneDates(next)
    if (!validation.valid) {
      message.error(validation.violations[0]?.message || '里程碑日期不符合顺序要求')
      return false
    }
    setEffectiveTasks(next)
    message.success('计划完成时间已更新')
    return true
  }}
/>
```

Pass `editable: isEditMode && isCurrentDraft && canMaintainCurrentPlan && !followedTosLevel1ReadOnly` and the matching global `readOnly` value so entering a draft without edit mode cannot accidentally unlock the chart. Build from the unprojected hierarchy; `buildPlanGanttTasks` derives read-only stage spans and milestone points.

- [ ] **Step 6: Align export and persisted current-scope data**

Change `handleExportVerticalPlan` to use `projectLevel1FlatMilestones(effectiveTasks)` and these exact export fields for governed level-one plans:

```ts
const LEVEL1_FLAT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'sequence', title: '序号' },
  { key: 'stageName', title: '阶段' },
  { key: 'milestoneName', title: '里程碑点' },
  { key: 'status', title: '状态' },
  { key: 'planEndDate', title: '计划完成时间' },
  { key: 'estimatedDays', title: '计划开发周期' },
  { key: 'actualEndDate', title: '实际完成时间' },
  { key: 'actualDays', title: '实际开发周期' },
]
```

In `src/stores/plan.ts`, include the live scoped plan data in `partialize` so list/Gantt auto-save survives reload and cannot fall back to another scope:

```ts
partialize: state => ({
  versions: state.versions,
  currentVersion: state.currentVersion,
  publishedSnapshots: state.publishedSnapshots,
  configTemplateTasksByType: state.configTemplateTasksByType,
  level3TemplateTasksByType: state.level3TemplateTasksByType,
  configTemplateVersionScopes: state.configTemplateVersionScopes,
  configTemplateCompareScopes: state.configTemplateCompareScopes,
  marketPlanData: state.marketPlanData,
  marketFollowVersionMeta: state.marketFollowVersionMeta,
  marketVersionsByKey: state.marketVersionsByKey,
  marketCurrentVersionByKey: state.marketCurrentVersionByKey,
  tosTypePlanDataByProjectId: state.tosTypePlanDataByProjectId,
  tosTypeVersionsByKey: state.tosTypeVersionsByKey,
  tosTypeCurrentVersionByKey: state.tosTypeCurrentVersionByKey,
})
```

- [ ] **Step 7: Run focused and existing project regressions**

Run: `npm run verify:level1-flat-gantt && npm run verify:level1-plan-governance && npm run verify:machine-tos && npx tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 8: Commit project-space UI**

```bash
git add scripts/verify-level1-flat-milestone-gantt.mjs src/containers/ProjectSpaceContainer.tsx src/stores/plan.ts src/styles/globals.css
git commit -m "feat: flatten whole-machine and tOS milestones"
```

## Task 5: Render TDT/subproject tables and wire transfer/Gantt actions

**Files:**
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `src/lib/technicalPlanWorkspace.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add failing technical UI and export assertions**

Append checks for both technical modes:

```js
const technicalModuleSource = read('src/components/technical-project/TechnicalPlanModule.tsx')
const technicalWorkspaceSource = read('src/lib/technicalPlanWorkspace.ts')
for (const label of ['阶段', '里程碑点', '活动名称', '添加转测版本', '实际开始时间', '实际完成时间']) {
  assert.match(technicalModuleSource, new RegExp(label), `technical plan contains ${label}`)
}
assert.match(technicalModuleSource, /insertNextTechnicalSubprojectTransfer/)
assert.match(technicalModuleSource, /projectTechnicalSubprojectRows/)
assert.match(technicalModuleSource, /onTaskDateChange/)
assert.match(technicalWorkspaceSource, /TECHNICAL_SUBPROJECT_EXPORT_COLUMNS/)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run verify:level1-flat-gantt`

Expected: FAIL because technical tables and export modes are not split.

- [ ] **Step 3: Split TDT and subproject table projections**

Use `projectLevel1FlatMilestones(tasks)` for TDT and `projectTechnicalSubprojectRows(tasks)` for subprojects. TDT uses the same eight business columns as Task 4. Subproject uses this complete column contract:

```ts
const subprojectColumns: ColumnsType<Level1FlatMilestoneRow> = [
  { title: '序号', dataIndex: 'sequence', key: 'sequence', width: 72, fixed: 'left' },
  { title: '活动名称', dataIndex: 'activityName', key: 'activityName', width: 180, fixed: 'left' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: value => value || '-' },
  { title: '计划开始时间', dataIndex: 'planStartDate', key: 'planStartDate', width: 145, render: renderSubprojectPlanDate },
  { title: '计划完成时间', dataIndex: 'planEndDate', key: 'planEndDate', width: 145, render: renderSubprojectPlanDate },
  { title: '计划周期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 100, render: value => value == null ? '-' : `${value}天` },
  { title: '实际开始时间', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 145, render: renderSubprojectActualDate },
  { title: '实际完成时间', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 145, render: renderSubprojectActualDate },
  { title: '实际周期', dataIndex: 'actualDays', key: 'actualDays', width: 100, render: value => value == null ? '-' : `${value}天` },
]
```

Append the operation column only when the current subproject draft has at least one `source: 'custom'` activity for which `canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'subproject', task: record, action: 'delete' })` returns true. Plan dates edit only in a maintainable draft. Actual dates edit in a maintainable draft or the latest published version under existing technical-plan permission. Every date editor writes through `applyPlanTaskDatePatch`, then calls `updateCurrentTasks`, so `estimatedDays` and `actualDays` stay synchronized. Use `validateTechnicalSubprojectDates` for per-cell error classes and in `handlePublish`; when invalid, scroll to the first invalid row, show its first reason, and do not call `publishRevision`. Remove all drag-sort and rename inputs from technical project tables.

- [ ] **Step 4: Add transfer insertion and delete-only controls**

Render this confirmed action only in a maintainable subproject draft:

```tsx
{tab?.templateKind === 'subproject' && canMaintain && (
  <Button
    icon={<PlusOutlined />}
    onClick={() => Modal.confirm({
      title: '确认添加转测版本？',
      content: '系统将在 TDR3 前自动生成下一个转测版本，名称不可修改。',
      okText: '确认添加',
      cancelText: '取消',
      onOk: () => {
        const result = insertNextTechnicalSubprojectTransfer(tasks)
        if (!result.ok) {
          message.error(result.reason === 'tdr3-missing' ? '未找到 TDR3' : '转测版本编号已存在')
          return
        }
        updateCurrentTasks(scope, result.tasks, maxDepth)
        message.success(`已添加 ${result.task.taskName}`)
      },
    })}
  >
    添加转测版本
  </Button>
)}
```

Delete only `source: 'custom'` activities after `Popconfirm`, validate the action with `canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'subproject', task, action: 'delete' })`, and renumber display IDs without changing stable IDs. Template rows never receive an action button.

- [ ] **Step 5: Wire TDT milestone and subproject bar Gantt saves**

Choose mode from `tab.templateKind` and validate before store writes:

```tsx
<DHTMLXGantt
  tasks={buildPlanGanttTasks(tasks, {
    mode: tab?.templateKind === 'subproject' ? 'technical-subproject' : 'hierarchical',
    editable: canMaintain,
  })}
  readOnly={!canMaintain}
  collapsedIds={collapsedIds}
  onCollapsedChange={updater => setCollapsed(scope, [...updater(collapsedIds)])}
  onTaskDateChange={change => {
    const mode = tab?.templateKind === 'subproject' ? 'task' : 'milestone'
    if (change.nodeType !== mode) return false
    const next = applyPlanGanttDateChange(tasks, { ...change, mode })
    const valid = tab?.templateKind === 'subproject'
      ? validateTechnicalSubprojectDates(next).valid
      : validateLevel1MilestoneDates(next).valid
    if (!valid) {
      message.error('拖动后的日期不符合计划规则')
      return false
    }
    return updateCurrentTasks(scope, next, maxDepth).ok
  }}
/>
```

- [ ] **Step 6: Split technical export labels by plan kind**

In `technicalPlanWorkspace.ts`, replace the single governed export array with these exact projections:

```ts
export const TECHNICAL_TDT_EXPORT_COLUMNS = [
  { key: 'sequence', title: '序号' },
  { key: 'stageName', title: '阶段' },
  { key: 'milestoneName', title: '里程碑点' },
  { key: 'status', title: '状态' },
  { key: 'planEndDate', title: '计划完成时间' },
  { key: 'estimatedDays', title: '计划开发周期' },
  { key: 'actualEndDate', title: '实际完成时间' },
  { key: 'actualDays', title: '实际开发周期' },
] as const

export const TECHNICAL_SUBPROJECT_EXPORT_COLUMNS = [
  { key: 'sequence', title: '序号' },
  { key: 'activityName', title: '活动名称' },
  { key: 'status', title: '状态' },
  { key: 'planStartDate', title: '计划开始时间' },
  { key: 'planEndDate', title: '计划完成时间' },
  { key: 'estimatedDays', title: '计划周期' },
  { key: 'actualStartDate', title: '实际开始时间' },
  { key: 'actualEndDate', title: '实际完成时间' },
  { key: 'actualDays', title: '实际周期' },
] as const
```

Select both the projection and its column array from `tab.templateKind` in `TechnicalPlanModule`; do not export a blank stage column for subprojects.

- [ ] **Step 7: Run focused and technical regressions**

Run: `npm run verify:level1-flat-gantt && npm run verify:technical-plan && npm run verify:technical-project && npx tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 8: Commit technical plan UI**

```bash
git add scripts/verify-level1-flat-milestone-gantt.mjs src/components/technical-project/TechnicalPlanModule.tsx src/lib/technicalPlanWorkspace.ts src/styles/globals.css
git commit -m "feat: add flat technical plan interactions"
```

## Task 6: Align version history with each current table

**Files:**
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `src/lib/versionCompare.ts`
- Modify: `src/components/plans/PlanVersionCompareModal.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`

- [ ] **Step 1: Add failing flat-history assertions**

Append source and behavior checks:

```js
const versionCompareSource = read('src/lib/versionCompare.ts')
const compareModalSource = read('src/components/plans/PlanVersionCompareModal.tsx')
assert.match(versionCompareSource, /stageName/)
assert.match(versionCompareSource, /milestoneName/)
assert.match(versionCompareSource, /activityName/)
assert.match(compareModalSource, /hierarchical-flat/)
assert.match(compareModalSource, /technical-subproject/)
for (const label of ['阶段', '里程碑点', '活动名称']) {
  assert.match(compareModalSource, new RegExp(label))
}

const compareModule = await loadTs('src/lib/versionCompare.ts')
const stableCompare = compareModule.compareVersionsForTable(
  [{ ...flat[1], id: '1.2', stableId: 'str1', sequence: 2, planEndDate: '2026-01-16' }],
  [{ ...flat[1], id: '1.1', stableId: 'str1', sequence: 1, planEndDate: '2026-01-20' }],
)
assert.equal(stableCompare.length, 1)
assert.equal(stableCompare[0].changeType, '修改')
assert.equal(stableCompare[0].taskId, '1.1')
assert.equal(stableCompare[0].stageName, '概念阶段')
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run verify:level1-flat-gantt`

Expected: FAIL because compare rows and modal modes do not expose the new fields.

- [ ] **Step 3: Preserve flat display fields in stable-ID comparison**

In `versionCompare.ts`, use type-only imports, extend its local comparison task input with `stableId` plus the flat display fields, add the same optional fields to `CompareTableRow`, and copy them from the selected old/new task in every added/deleted/modified row:

```ts
stageName?: string
milestoneName?: string
activityName?: string
sequence?: number
```

Use `stableId || id` as the map key while retaining `taskId` for the current display task. This ensures generated row sequence changes do not appear as delete/add when stable IDs match.

The two maps and row identity must use this exact keying:

```ts
const identity = (task: PlanTask & { stableId?: string }) => task.stableId || task.id
const oldMap = new Map(oldTasks.map(task => [identity(task), task]))
const newMap = new Map(newTasks.map(task => [identity(task), task]))
// For a matched row use newTask.id; for a deleted row use oldTask.id.
const displayTask = newTask || oldTask!
const taskId = displayTask.id
const key = identity(displayTask)
```

- [ ] **Step 4: Add two explicit compare column modes**

Change the prop to:

```ts
fieldMode?: 'legacy' | 'hierarchical-flat' | 'technical-subproject'
```

For `hierarchical-flat`, render `序号、变更类型、阶段、里程碑点、状态、计划完成、计划开发周期、实际完成、实际开发周期`. For `technical-subproject`, render `序号、变更类型、活动名称、状态、计划开始、计划完成、计划周期、实际开始、实际完成、实际周期`. The first column uses `sequence`, not the hierarchical `taskId`; additions/deletions keep the sequence from their source row.

- [ ] **Step 5: Project versions before comparison and pass the correct mode**

In project space, call `compareVersionsForTable(projectLevel1FlatMilestones(old.tasks), projectLevel1FlatMilestones(new.tasks))` and pass `fieldMode="hierarchical-flat"` for level 1. In the technical module, use flat milestone rows for TDT and activity rows for subprojects, then pass the matching field mode.

- [ ] **Step 6: Run all focused compare regressions**

Run: `npm run verify:level1-flat-gantt && npm run verify:level1-plan-governance && npm run verify:technical-plan && npx tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 7: Commit flat version history**

```bash
git add scripts/verify-level1-flat-milestone-gantt.mjs src/lib/versionCompare.ts src/components/plans/PlanVersionCompareModal.tsx src/containers/ProjectSpaceContainer.tsx src/components/technical-project/TechnicalPlanModule.tsx
git commit -m "feat: align plan history with flat tables"
```

## Task 7: Add browser acceptance and run the full release gate

**Files:**
- Create: `screenshots/verify-level1-flat-milestone-gantt-browser.mjs`
- Modify: `docs/superpowers/plans/2026-08-20-level1-flat-milestone-gantt.md`

- [ ] **Step 1: Write the failing browser verification**

Create `screenshots/verify-level1-flat-milestone-gantt-browser.mjs` with the complete navigation and interaction matrix below. It reuses the repository's current visible labels (`项目列表`, category buttons, project names, `计划`, scope tabs and view aria labels) and DHTMLX's stable `task_id` attribute:

```js
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://localhost:3004'
const TIMEOUT = 30_000
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1440, height: 960 } })

const assertText = async (page, text, scope = 'body') => page.waitForFunction((value, selector) => (
  (document.querySelector(selector)?.textContent || '').includes(value)
), { timeout: TIMEOUT }, text, scope)
const assertNoText = async (page, text, scope = 'body') => {
  const found = await page.$eval(scope, (root, value) => (root.textContent || '').includes(value), text)
  assert.equal(found, false, `unexpected ${text}`)
}
const clickExact = async (page, selector, text, scope = 'body') => {
  const clicked = await page.evaluate((candidateSelector, value, rootSelector) => {
    const root = document.querySelector(rootSelector)
    const target = Array.from(root?.querySelectorAll(candidateSelector) || []).find(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim() === value
    })
    target?.click()
    return Boolean(target)
  }, selector, text, scope)
  assert.equal(clicked, true, `cannot click ${text}`)
  await wait(180)
}
const clickAria = async (page, label) => {
  await page.waitForFunction(value => Array.from(document.querySelectorAll(`[aria-label="${CSS.escape(value)}"]`)).some(element => {
    const target = element.getBoundingClientRect().width > 0 ? element : element.closest('label')
    const rect = target?.getBoundingClientRect()
    return Boolean(rect && rect.width > 0 && rect.height > 0)
  }), { timeout: TIMEOUT }, label)
  const clicked = await page.evaluate(value => {
    for (const element of document.querySelectorAll(`[aria-label="${CSS.escape(value)}"]`)) {
      const target = element.getBoundingClientRect().width > 0 ? element : element.closest('label')
      const rect = target?.getBoundingClientRect()
      if (rect && rect.width > 0 && rect.height > 0) {
        target.click()
        return true
      }
    }
    return false
  }, label)
  assert.equal(clicked, true, `cannot click aria ${label}`)
  await wait(180)
}
const openMain = async (page, label) => {
  await clickExact(page, '[role="menuitem"]', label)
  await page.waitForFunction(value => (
    (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === value
  ), { timeout: TIMEOUT }, label)
}
const clickCategory = async (page, label) => {
  const clicked = await page.evaluate(value => {
    const root = document.querySelector('[aria-label="项目分类筛选"]')
    const button = Array.from(root?.querySelectorAll('button') || []).find(element => (
      element.getBoundingClientRect().width > 0 && (element.textContent || '').trim().startsWith(value)
    ))
    button?.click()
    return Boolean(button)
  }, label)
  assert.equal(clicked, true, `missing category ${label}`)
  await wait(180)
}
const clickProject = async (page, name) => {
  const clicked = await page.evaluate(value => {
    const label = Array.from(document.querySelectorAll('button,[role="button"],.ant-table-cell,*')).find(element => (
      element.getBoundingClientRect().width > 0 && (element.textContent || '').trim() === value
    ))
    let target = label
    while (target && target !== document.body) {
      if (target.matches('button,[role="button"]') || getComputedStyle(target).cursor === 'pointer') {
        target.click()
        return true
      }
      target = target.parentElement
    }
    return false
  }, name)
  assert.equal(clicked, true, `missing project ${name}`)
  await assertText(page, '项目空间')
}
const openPlan = async (page, category, projectName) => {
  await openMain(page, '项目列表')
  await clickCategory(page, category)
  await clickProject(page, projectName)
  await clickExact(page, '[role="menuitem"]', '计划')
  await assertText(page, '计划')
}
const assertColumns = async (page, expected, forbidden = []) => {
  const headers = await page.$$eval('.ant-table-thead th', nodes => nodes.filter(node => {
    const rect = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }).map(node => (node.textContent || '').trim()))
  expected.forEach(label => assert.ok(headers.includes(label), `missing column ${label}: ${headers.join(',')}`))
  forbidden.forEach(label => assert.equal(headers.includes(label), false, `unexpected column ${label}`))
  assert.equal(await page.$$eval('.ant-table-row-expand-icon', nodes => nodes.filter(node => {
    const rect = node.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }).length), 0, 'flat table cannot expose tree expanders')
}
const ganttIdByText = async (page, text) => page.evaluate(value => {
  const row = Array.from(document.querySelectorAll('.gantt_row')).find(element => (
    element.getBoundingClientRect().height > 0 && (element.textContent || '').includes(value)
  ))
  return row?.getAttribute('task_id') || ''
}, text)
const taskLine = id => `.gantt_task_line[task_id="${id}"]`
const assertGanttPolicy = async (page, stageName, milestoneName) => {
  const stageId = await ganttIdByText(page, stageName)
  const milestoneId = await ganttIdByText(page, milestoneName)
  assert.ok(stageId && milestoneId)
  const stageClass = await page.$eval(taskLine(stageId), element => element.className)
  const milestoneClass = await page.$eval(taskLine(milestoneId), element => element.className)
  assert.match(stageClass, /pms-gantt-project/)
  assert.match(stageClass, /pms-gantt-task-readonly/)
  assert.match(milestoneClass, /gantt_milestone|pms-gantt-milestone/)
  assert.doesNotMatch(milestoneClass, /pms-gantt-task-readonly/)
  return { stageId, milestoneId }
}
const dragLine = async (page, id, deltaX) => {
  const line = await page.$(taskLine(id))
  const box = await line?.boundingBox()
  assert.ok(box, `missing gantt line ${id}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await wait(400)
}
const resizeRight = async (page, id, deltaX) => {
  const handle = await page.$(`${taskLine(id)} .gantt_task_drag.task_right`)
  const box = await handle?.boundingBox()
  assert.ok(box, `missing right resize handle ${id}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await wait(400)
}
const rowText = async (page, name) => page.evaluate(value => {
  const row = Array.from(document.querySelectorAll('.ant-table-tbody tr')).find(element => (
    element.getBoundingClientRect().height > 0 && (element.textContent || '').includes(value)
  ))
  return (row?.textContent || '').replace(/\s+/g, ' ').trim()
}, name)
const selectVersion = async (page, label) => {
  await clickAria(page, '计划版本')
  const clicked = await page.evaluate(value => {
    const option = Array.from(document.querySelectorAll('.ant-select-item-option')).find(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').includes(value)
    ))
    option?.click()
    return Boolean(option)
  }, label)
  assert.equal(clicked, true, `missing version ${label}`)
  await wait(250)
  const leaveConfirm = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-modal')).some(element => (
    element.getBoundingClientRect().height > 0 && (element.textContent || '').includes('离开确认')
  )))
  if (leaveConfirm) await clickExact(page, '.ant-modal button', '确认离开')
}
const switchUser = async (page, name) => {
  await clickAria(page, '切换当前用户')
  const clicked = await page.evaluate(value => {
    const label = Array.from(document.querySelectorAll('.pms-user-menu__name')).find(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === value
    ))
    label?.closest('.ant-dropdown-menu-item')?.click()
    return Boolean(label)
  }, name)
  assert.equal(clicked, true, `missing user ${name}`)
  await wait(300)
}
const assertAllGanttReadOnly = async page => {
  const classes = await page.$$eval('.gantt_task_line', lines => lines.filter(line => line.getBoundingClientRect().height > 0).map(line => line.className))
  assert.ok(classes.length > 0)
  classes.forEach(className => assert.match(className, /pms-gantt-task-readonly/))
}
const assertCompareColumns = async (page, expected, forbidden = []) => {
  await clickAria(page, '版本对比')
  await clickExact(page, '.ant-modal button', '开始对比')
  const headers = await page.$$eval('.ant-modal .ant-table-thead th', nodes => nodes.map(node => (node.textContent || '').trim()))
  expected.forEach(label => assert.ok(headers.includes(label), `compare missing ${label}`))
  forbidden.forEach(label => assert.equal(headers.includes(label), false, `compare unexpected ${label}`))
  await page.click('.ant-modal-close')
  await wait(180)
}
const newPage = async () => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    const text = message.text()
    const missingFavicon = text.includes('Failed to load resource') && message.location().url.endsWith('/favicon.ico')
    if (message.type() === 'error' && !text.startsWith('Warning: [antd:') && !missingFavicon) errors.push(text)
  })
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' })
  await assertText(page, '项目管理系统')
  return { context, page, errors }
}

{
  const { context, page, errors } = await newPage()
  await openPlan(page, '整机产品项目', 'X6877-D8400_H991')
  await clickAria(page, '竖版表格')
  await assertColumns(page, ['序号', '阶段', '里程碑点', '状态', '计划完成时间', '计划开发周期', '实际完成时间', '实际开发周期'])
  await clickExact(page, 'button', '添加上市阶段 MR 里程碑')
  await clickExact(page, '.ant-modal button', '确认添加')
  await assertText(page, 'MR4')
  await clickAria(page, '甘特图')
  const { stageId, milestoneId } = await assertGanttPolicy(page, '概念阶段', '概念启动')
  const stageBefore = await page.$eval(taskLine(stageId), element => element.getBoundingClientRect().x)
  await dragLine(page, stageId, 60)
  const stageAfter = await page.$eval(taskLine(stageId), element => element.getBoundingClientRect().x)
  assert.equal(Math.round(stageAfter), Math.round(stageBefore), 'stage moved')
  const str1Id = await ganttIdByText(page, 'STR1')
  const invalidBefore = await page.$eval(taskLine(str1Id), element => element.getBoundingClientRect().x)
  await dragLine(page, str1Id, -160)
  const invalidAfter = await page.$eval(taskLine(str1Id), element => element.getBoundingClientRect().x)
  assert.equal(Math.round(invalidAfter), Math.round(invalidBefore), 'invalid milestone drag did not roll back')
  await dragLine(page, milestoneId, 18)
  await clickAria(page, '竖版表格')
  const savedMilestone = await rowText(page, '概念启动')
  await switchUser(page, '王五')
  await assertNoText(page, '添加上市阶段 MR 里程碑')
  await clickAria(page, '甘特图')
  await assertAllGanttReadOnly(page)
  await switchUser(page, '张三')
  await selectVersion(page, 'V3')
  await assertNoText(page, '添加上市阶段 MR 里程碑')
  await clickAria(page, '甘特图')
  await assertAllGanttReadOnly(page)
  await selectVersion(page, 'V1')
  await assertNoText(page, '添加上市阶段 MR 里程碑')
  await selectVersion(page, 'V4')
  await page.reload({ waitUntil: 'networkidle0' })
  await openPlan(page, '整机产品项目', 'X6877-D8400_H991')
  await clickAria(page, '竖版表格')
  assert.equal(await rowText(page, '概念启动'), savedMilestone, 'machine drag did not survive reload')
  await assertCompareColumns(page, ['阶段', '里程碑点'], ['活动名称'])
  assert.deepEqual(errors, [])
  await context.close()
}

{
  const { context, page, errors } = await newPage()
  await openPlan(page, 'tOS版本项目', 'tOS16.1')
  await clickAria(page, '竖版表格')
  await assertColumns(page, ['阶段', '里程碑点', '计划完成时间', '实际完成时间'])
  await assertNoText(page, '添加上市阶段 MR 里程碑')
  await clickAria(page, '甘特图')
  await assertGanttPolicy(page, '概念阶段', '概念启动')
  assert.deepEqual(errors, [])
  await context.close()
}

{
  const { context, page, errors } = await newPage()
  await openPlan(page, '技术项目', 'AI-Engine-V2')
  await clickAria(page, '竖版表格')
  await assertColumns(page, ['阶段', '里程碑点', '计划完成时间', '实际完成时间'])
  await assertNoText(page, '添加转测版本')
  await clickAria(page, '甘特图')
  await assertGanttPolicy(page, '规划阶段', '规划启动')
  await clickExact(page, '[role="tab"]', 'AI推理引擎子项目计划', '[aria-label="计划作用域"]')
  if (await page.$('[aria-label="创建修订"]')) {
    await clickAria(page, '创建修订')
    await clickExact(page, '.ant-dropdown-menu-item', '创建正式版本')
  }
  await clickAria(page, '竖版表格')
  await assertColumns(page, ['序号', '活动名称', '状态', '计划开始时间', '计划完成时间', '计划周期', '实际开始时间', '实际完成时间', '实际周期'], ['阶段', '里程碑点'])
  await clickExact(page, 'button', '添加转测版本')
  await clickExact(page, '.ant-modal button', '确认添加')
  assert.match(await rowText(page, '第3版转测'), /第3版转测/)
  await clickAria(page, '甘特图')
  const activityId = await ganttIdByText(page, '第1版转测')
  const activityClass = await page.$eval(taskLine(activityId), element => element.className)
  assert.match(activityClass, /pms-gantt-task/)
  assert.doesNotMatch(activityClass, /pms-gantt-task-readonly/)
  await resizeRight(page, activityId, 24)
  await clickAria(page, '竖版表格')
  const savedActivity = await rowText(page, '第1版转测')
  await page.reload({ waitUntil: 'networkidle0' })
  await openPlan(page, '技术项目', 'AI-Engine-V2')
  await clickExact(page, '[role="tab"]', 'AI推理引擎子项目计划', '[aria-label="计划作用域"]')
  await clickAria(page, '竖版表格')
  assert.equal(await rowText(page, '第1版转测'), savedActivity, 'subproject resize did not survive reload')
  await assertCompareColumns(page, ['活动名称', '计划开始', '实际开始'], ['阶段', '里程碑点'])
  assert.deepEqual(errors, [])
  await context.close()
}

await browser.close()
console.log('PASS browser level1 flat milestone and gantt flows')
```

- [ ] **Step 2: Run the browser test and verify RED**

Start the app: `npm run dev -- -p 3004`

Run in another terminal: `PMS_BASE_URL=http://localhost:3004 npm run verify:level1-flat-gantt-browser`

Expected before final selector/interaction implementation: FAIL at the first missing target or persistence assertion.

- [ ] **Step 3: Fix only failures exposed by the concrete browser matrix**

If the RED run exposes a missing accessible production control, add only the semantic label used above (`计划版本`, existing view labels, or existing scope labels). Keep the DHTMLX selectors based on its public `task_id` DOM attribute and the `pms-gantt-*` policy classes from Task 3; do not add hidden test hooks.

- [ ] **Step 4: Run the focused automated suite**

Run:

```bash
npm run verify:level1-flat-gantt
npm run verify:level1-plan-governance
npm run verify:machine-tos
npm run verify:technical-plan
npm run verify:technical-project
```

Expected: every command exits 0 and prints PASS.

- [ ] **Step 5: Run repository gates**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: TypeScript exits 0 with no output; Next.js build exits 0 and prints `Compiled successfully`.

- [ ] **Step 6: Run the final browser matrix**

Run: `PMS_BASE_URL=http://localhost:3004 npm run verify:level1-flat-gantt-browser`

Expected: `PASS browser level1 flat milestone and gantt flows` with no browser console errors caused by the feature.

- [ ] **Step 7: Record verification evidence and commit**

Mark completed checkboxes in this plan only after the matching commands have fresh successful output. Then commit the browser verifier and plan evidence:

```bash
git add screenshots/verify-level1-flat-milestone-gantt-browser.mjs docs/superpowers/plans/2026-08-20-level1-flat-milestone-gantt.md
git commit -m "test: verify flat plan and gantt workflows"
```

## Final requirement audit

- [ ] Whole-machine, tOS, and TDT lists contain no tree rows or expand/collapse controls.
- [ ] Stage names repeat per milestone row and sequences are continuous.
- [ ] Technical subprojects use only `活动名称`, not blank stage/milestone columns.
- [ ] Template tasks cannot be added, deleted, renamed, or reordered.
- [ ] Machine MR names start at MR4 and are delete-only.
- [ ] Subproject transfer names start at 第3版转测, remain before TDR3, and are delete-only.
- [ ] Stages are locked summary bars; milestone diamonds persist plan completion after drag.
- [ ] Subproject bars persist plan start/end after move or resize.
- [ ] Subproject list edits all four requested date fields with validation.
- [ ] Latest published actual-time editing and historical-version read-only behavior remain intact.
- [ ] Version history uses the same flat columns as the current plan type.
- [ ] Type-check, production build, focused scripts, and browser matrix all pass with fresh evidence.
