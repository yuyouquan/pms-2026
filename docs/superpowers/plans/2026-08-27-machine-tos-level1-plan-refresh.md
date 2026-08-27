# Machine and tOS Level-1 Plan Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the whole-machine and tOS level-one flat milestone experience with the approved project-specific hierarchical templates, nine-column vertical view, governed dates, mixed milestone/bar Gantt editing, published-only basic-information summary, and matching history/export behavior.

**Architecture:** Keep Zustand and the existing two-level task shape as the source of truth. Move project-type-specific templates, business-node naming, projections, date validation, permissions, and Gantt typing into pure helpers; let `ProjectSpaceContainer` compose those helpers for market/tOS scopes without changing technical-project behavior. Advance the persisted plan store once and migrate only empty or recognized default data, preserving nonempty custom content and stable identities.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand persist middleware, DHTMLX Gantt, Node verification scripts, Puppeteer browser acceptance.

**Reference design:** `docs/superpowers/specs/2026-08-27-machine-tos-level1-plan-refresh-design.md`

---

## File responsibility map

- `src/lib/level1PlanRules.ts` — project-specific templates, task projection, stage aggregation, MR/tOS naming, structure permissions, and date validation.
- `src/lib/planGanttRules.ts` — stage/milestone/business-period Gantt projection and pure date-patch behavior.
- `src/lib/projectSpaceLevel1Rules.ts` — tree filter pipeline, scoped latest-published summary, confirmation tokens, and field-only actual-date merging.
- `src/stores/plan.ts` — default seeds, config-template seeds, project/market/tOS snapshots, column settings, and V7→V8 migration.
- `src/containers/ConfigContainer.tsx` — project-type-specific configuration-template fallbacks.
- `src/containers/ProjectSpaceContainer.tsx` — hierarchical table, date inputs, actions, permissions, horizontal/Gantt integration, publish focus, basic-info summary, history, and export.
- `src/components/plans/PlanVersionCompareModal.tsx` — reuse the governed tree-history column mode; technical modes remain unchanged.
- `src/styles/globals.css` — scoped invalid-date and hierarchy/action presentation.
- `scripts/verify-level1-plan-governance.mjs` — pure template, permission, projection, migration, history, and container-contract checks.
- `scripts/verify-level1-flat-milestone-gantt.mjs` — retain the script name for package compatibility while replacing whole-machine/tOS assertions with tree-nine-column and mixed-Gantt contracts; retain technical flat assertions.
- `scripts/verify-technical-plan.mjs` — update only the plan-store version expectation and protect technical-plan behavior.
- `screenshots/verify-level1-flat-milestone-gantt-browser.mjs` — retain the command path while exercising the new whole-machine/tOS flows and unchanged technical flows.

### Task 1: Add project-specific templates and nine-column projections

**Files:**
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `scripts/verify-level1-plan-governance.mjs`
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`

- [ ] **Step 1: Write failing template and projection assertions**

Add assertions before production changes:

```js
const machine = rules.buildLevel1TasksForProjectType('整机产品项目', true)
assert.deepEqual(
  machine.filter(task => !task.parentId).map(task => task.taskName),
  ['概念阶段', '计划阶段', '开发阶段', '验证阶段', '上市阶段', '生命周期阶段'],
)
assert.deepEqual(
  machine.filter(task => task.parentId).map(task => task.taskName),
  ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5'],
)
assert.equal(machine.some(task => ['上市阶段', '生命周期阶段'].includes(task.taskName) && machine.some(child => child.parentId === task.id)), false)

const tos = rules.buildLevel1TasksForProjectType('tOS版本项目', true)
assert.deepEqual(
  tos.filter(task => !task.parentId).map(task => task.taskName),
  ['规划阶段', '概念阶段', '计划阶段', '开发验证阶段', '上市迭代阶段', '维护阶段'],
)
assert.deepEqual(
  tos.filter(task => task.parentId).map(task => task.taskName),
  ['规划KO', 'CDCP', '概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5'],
)

const projection = rules.projectLevel1Plan(machine, { mode: 'standard', today: '2026-08-27' })
assert.equal(projection.rows.length, machine.length)
assert.equal(projection.rows.find(row => row.taskName === '概念启动').planStartDate, '')
assert.equal(projection.rows.find(row => row.taskName === '概念启动').estimatedDays, null)
assert.equal(projection.rows.find(row => row.taskName === '概念阶段').isMilestone, false)
assert.equal(projection.rows.find(row => row.taskName === 'STR1').isMilestone, true)
```

- [ ] **Step 2: Run the focused rules and confirm RED**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
```

Expected: FAIL because `buildLevel1TasksForProjectType` and the two project-specific templates do not exist and the project projection still serves the shared four-stage template.

- [ ] **Step 3: Implement explicit project templates and task kinds**

Extend the task contract and create explicit templates:

```ts
export type Level1ProjectKind = 'machine' | 'tos'
export type Level1NodeKind = 'stage' | 'fixed-milestone' | 'business-period'

export interface Level1PlanTask {
  // existing fields stay unchanged
  nodeKind?: Level1NodeKind
}

const MACHINE_TEMPLATE = [
  ['stage-concept', null, '概念阶段', 'stage'],
  ['milestone-concept-start', 'stage-concept', '概念启动', 'fixed-milestone'],
  ['milestone-str1', 'stage-concept', 'STR1', 'fixed-milestone'],
  ['stage-plan', null, '计划阶段', 'stage'],
  ['milestone-str2', 'stage-plan', 'STR2', 'fixed-milestone'],
  ['milestone-str3', 'stage-plan', 'STR3', 'fixed-milestone'],
  ['stage-development', null, '开发阶段', 'stage'],
  ['milestone-str4', 'stage-development', 'STR4', 'fixed-milestone'],
  ['milestone-str4a', 'stage-development', 'STR4A', 'fixed-milestone'],
  ['stage-verification', null, '验证阶段', 'stage'],
  ['milestone-str5', 'stage-verification', 'STR5', 'fixed-milestone'],
  ['stage-launch', null, '上市阶段', 'stage'],
  ['stage-lifecycle', null, '生命周期阶段', 'stage'],
] as const

const TOS_TEMPLATE = [
  ['stage-planning', null, '规划阶段', 'stage'],
  ['milestone-planning-ko', 'stage-planning', '规划KO', 'fixed-milestone'],
  ['milestone-cdcp', 'stage-planning', 'CDCP', 'fixed-milestone'],
  ['stage-concept', null, '概念阶段', 'stage'],
  ['milestone-concept-start', 'stage-concept', '概念启动', 'fixed-milestone'],
  ['milestone-str1', 'stage-concept', 'STR1', 'fixed-milestone'],
  ['stage-plan', null, '计划阶段', 'stage'],
  ['milestone-str2', 'stage-plan', 'STR2', 'fixed-milestone'],
  ['milestone-str3', 'stage-plan', 'STR3', 'fixed-milestone'],
  ['stage-development-verification', null, '开发验证阶段', 'stage'],
  ['milestone-str4', 'stage-development-verification', 'STR4', 'fixed-milestone'],
  ['milestone-str4a', 'stage-development-verification', 'STR4A', 'fixed-milestone'],
  ['milestone-str5', 'stage-development-verification', 'STR5', 'fixed-milestone'],
  ['stage-launch-iteration', null, '上市迭代阶段', 'stage'],
  ['stage-maintenance', null, '维护阶段', 'stage'],
] as const
```

Implement `buildMachineLevel1Tasks`, `buildTosLevel1Tasks`, and:

```ts
export const buildLevel1TasksForProjectType = (
  projectType: string,
  withMockDates = true,
) => projectType === 'tOS版本项目'
  ? buildTosLevel1Tasks(withMockDates)
  : buildMachineLevel1Tasks(withMockDates)
```

Keep `buildStandardLevel1Tasks` temporarily as a machine-compatible alias only for untouched legacy callers, and migrate active project-space/config callers in later tasks.

Update `projectLevel1Plan` so fixed children expose only completion dates and `null` durations, business periods use inclusive start/end durations, and stages compute start/end/duration from ordered children and the previous completed stage.

- [ ] **Step 4: Run the focused rules and confirm GREEN**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
```

Expected: PASS for project-specific template and projection assertions; existing technical flat milestone assertions remain PASS.

- [ ] **Step 5: Commit the rule slice**

```bash
git add src/lib/level1PlanRules.ts scripts/verify-level1-plan-governance.mjs scripts/verify-level1-flat-milestone-gantt.mjs
git commit -m "feat: add machine and tos level1 templates"
```

### Task 2: Add dynamic MR/tOS nodes and governed structure permissions

**Files:**
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/lib/projectSpaceLevel1Rules.ts`
- Modify: `scripts/verify-level1-plan-governance.mjs`

- [ ] **Step 1: Write failing naming, insertion, and permission assertions**

```js
assert.deepEqual(rules.parseTosProjectVersionPrefix('tOS17.0项目'), { major: '17', minor: '0', prefix: '17.0.0' })
assert.deepEqual(rules.parseTosProjectVersionPrefix('tOS16.3'), { major: '16', minor: '3', prefix: '16.3.0' })
assert.equal(rules.parseTosProjectVersionPrefix('无版本项目'), null)
assert.equal(rules.validateTosBusinessVersionName('tOS16.3', '16.3.0.125').valid, true)
assert.equal(rules.validateTosBusinessVersionName('tOS16.3', '16.3.0.126').valid, false)
assert.equal(rules.validateTosBusinessVersionName('tOS16.3', '16.4.0.125').valid, false)

const machineInsert = rules.insertLevel1BusinessNode(machine, {
  projectType: '整机产品项目', parentStableId: 'stage-launch', taskName: 'MR1', now: 1,
})
assert.equal(machineInsert.ok, true)
assert.equal(machineInsert.task.nodeKind, 'business-period')

const tosInsert = rules.insertLevel1BusinessNode(tos, {
  projectType: 'tOS版本项目', projectName: 'tOS17.0', parentStableId: 'stage-maintenance', taskName: '17.0.0.115', now: 2,
})
assert.equal(tosInsert.ok, true)

assert.deepEqual(rules.getLevel1StructurePermissions({
  projectType: '整机产品项目', isDraft: true, isSuperAdmin: false, isSpm: true,
  task: machineInsert.task, parent: machineInsert.parent,
}), { canAddStage: false, canAddChild: true, canDelete: true, canReorder: true })
assert.equal(rules.getLevel1StructurePermissions({
  projectType: '整机产品项目', isDraft: true, isSuperAdmin: true, isSpm: false,
  task: machine[0], parent: undefined,
}).canDelete, true)
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:level1-plan-governance`

Expected: FAIL because project-name parsing, generalized business insertion, and explicit structure-permission projection are missing.

- [ ] **Step 3: Implement naming and business insertion**

Add pure helpers with deterministic dependencies:

```ts
export const parseTosProjectVersionPrefix = (projectName: string) => {
  const match = /tOS\s*(\d+)\.(\d+)/i.exec(projectName)
  return match ? { major: match[1], minor: match[2], prefix: `${match[1]}.${match[2]}.0` } : null
}

export const validateTosBusinessVersionName = (projectName: string, taskName: string) => {
  const parsed = parseTosProjectVersionPrefix(projectName)
  if (!parsed) return { valid: false, message: '无法从项目名称解析 tOS 版本前缀' }
  const valid = new RegExp(`^${parsed.major}\\.${parsed.minor}\\.0\\.\\d{2}[05]$`).test(taskName)
  return { valid, message: valid ? '' : `版本号必须符合 ${parsed.prefix}.XXX，且尾号最后一位为0或5` }
}
```

Replace the machine-only insertion helper with `insertLevel1BusinessNode`. It must validate the parent stage by stable ID, reject duplicates, create `nodeKind: 'business-period'`, preserve input arrays, generate a unique stable ID from the injected `now`, and renumber only display IDs.

Define its success result explicitly as `{ ok: true, tasks, task, parent }`; failure results carry one of `parent-missing`, `parent-not-business-stage`, `invalid-name`, or `duplicate-name` plus a user-facing message.

- [ ] **Step 4: Implement structure permissions**

```ts
export const getLevel1StructurePermissions = (input: StructurePermissionInput) => {
  const businessParent = isBusinessStage(input.projectType, input.parent)
  const businessTask = input.task?.nodeKind === 'business-period'
  if (!input.isDraft) return denyAll
  if (input.isSuperAdmin) return { canAddStage: true, canAddChild: true, canDelete: true, canReorder: true }
  if (!input.isSpm) return denyAll
  return {
    canAddStage: false,
    canAddChild: Boolean(businessParent),
    canDelete: Boolean(businessParent && businessTask),
    canReorder: Boolean(businessParent && businessTask),
  }
}
```

Keep technical TDT/subproject permissions on their existing path; do not route technical tasks through this project-specific helper.

- [ ] **Step 5: Run and confirm GREEN**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:technical-plan
```

Expected: PASS, including technical delete-only/custom-transfer behavior.

- [ ] **Step 6: Commit the business-rule slice**

```bash
git add src/lib/level1PlanRules.ts src/lib/projectSpaceLevel1Rules.ts scripts/verify-level1-plan-governance.mjs
git commit -m "feat: govern machine and tos business nodes"
```

### Task 3: Expand date validation and mixed Gantt typing

**Files:**
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/lib/planGanttRules.ts`
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`

- [ ] **Step 1: Write failing validation assertions**

Cover valid equality, invalid order, invalid range, stage overlap, strict dates, empty partial input, and input immutability:

```js
const invalidOrder = rules.validateLevel1ScheduleDates([
  stage('s1', 1, '概念阶段'),
  fixed('m1', 's1', 1, 'STR1', '2026-03-10'),
  stage('s2', 2, '计划阶段'),
  fixed('m2', 's2', 1, 'STR2', '2026-03-09'),
])
assert.equal(invalidOrder.valid, false)
assert.match(invalidOrder.byTaskId.m2.planEndDate[0], /不得早于上一节点/)

const validSameDay = rules.validateLevel1ScheduleDates([
  stage('s1', 1, '概念阶段'),
  fixed('m1', 's1', 1, 'STR1', '2026-03-10'),
  fixed('m2', 's1', 2, 'STR2', '2026-03-10'),
])
assert.equal(validSameDay.valid, true)

const invalidRange = rules.validateLevel1ScheduleDates([
  stage('launch', 1, '上市阶段'),
  period('mr1', 'launch', 1, 'MR1', '2026-04-10', '2026-04-01'),
])
assert.equal(invalidRange.byTaskId.mr1.planStartDate.length > 0, true)
assert.equal(invalidRange.byTaskId.mr1.planEndDate.length > 0, true)
```

- [ ] **Step 2: Write failing mixed-Gantt assertions**

```js
const gantt = ganttRules.buildPlanGanttTasks(tasks, { mode: 'hierarchical', editable: true })
assert.equal(gantt.find(task => task.taskName === '概念阶段').type, 'project')
assert.equal(gantt.find(task => task.taskName === 'STR1').type, 'milestone')
assert.equal(gantt.find(task => task.taskName === 'MR1').type, 'task')
assert.equal(gantt.find(task => task.taskName === 'MR1').duration, 10)

const moved = ganttRules.applyPlanGanttDateChange(tasks, {
  taskId: 'mr1', mode: 'task', startDate: '2026-04-02', endDate: '2026-04-11',
})
assert.equal(moved.find(task => task.id === 'mr1').estimatedDays, 10)
```

- [ ] **Step 3: Run and confirm RED**

Run: `npm run verify:level1-flat-gantt`

Expected: FAIL because validation only addresses completion fields and all hierarchical children are emitted as zero-duration milestones.

- [ ] **Step 4: Implement the unified validation result**

Replace the narrow field union with:

```ts
export type Level1DateField = 'planStartDate' | 'planEndDate' | 'actualStartDate' | 'actualEndDate'

export interface Level1DateValidationResult {
  valid: boolean
  violations: Array<{ taskId: string; field: Level1DateField; message: string }>
  byTaskId: Record<string, Partial<Record<Level1DateField, string[]>>>
}
```

Implement `validateLevel1ScheduleDates` to validate real ISO dates, same-row start/end, nondecreasing fixed completion points, nonoverlapping business periods, and nonoverlapping derived stage ranges. Empty values stay neutral. Keep `validateLevel1MilestoneDates` as a compatibility alias until all project-space callers move.

- [ ] **Step 5: Implement mixed Gantt typing**

In `buildPlanGanttTasks`, emit `type: 'task'` for `nodeKind === 'business-period'`, use inclusive duration (`difference + 1`), and keep stages read-only. Fixed milestones remain points. Update `applyPlanGanttDateChange` so fixed points only patch completion while business periods patch start/end and recompute inclusive duration.

- [ ] **Step 6: Run and confirm GREEN**

Run:

```bash
npm run verify:level1-flat-gantt
npm run verify:technical-plan
```

Expected: PASS; technical TDT milestone and technical-subproject task behavior remains unchanged.

- [ ] **Step 7: Commit the scheduling slice**

```bash
git add src/lib/level1PlanRules.ts src/lib/planGanttRules.ts scripts/verify-level1-flat-milestone-gantt.mjs
git commit -m "feat: validate hierarchical level1 schedules"
```

### Task 4: Migrate persisted templates and scoped mock plans to V8

**Files:**
- Modify: `src/stores/plan.ts`
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `scripts/verify-level1-plan-governance.mjs`
- Modify: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: Write failing V8 migration assertions**

```js
assert.equal(plan.PLAN_STORE_VERSION, 8)

const migrated = plan.migratePlanStoreState({
  configTemplateTasksByType: {
    '整机产品项目': plan.LEVEL1_TEMPLATE_TASKS,
    'tOS版本项目': plan.LEVEL1_TEMPLATE_TASKS,
  },
  marketPlanData: { OP: { tasks: plan.LEVEL1_TASKS, level2Tasks: [], createdLevel2Plans: [] } },
  publishedSnapshots: {
    'template::整机产品项目::level1::v3': plan.LEVEL1_TEMPLATE_TASKS,
    'template::tOS版本项目::level1::v3': plan.LEVEL1_TEMPLATE_TASKS,
  },
}, 7)
assert.deepEqual(migrated.configTemplateTasksByType['整机产品项目'].filter(task => !task.parentId).map(task => task.taskName), ['概念阶段', '计划阶段', '开发阶段', '验证阶段', '上市阶段', '生命周期阶段'])
assert.deepEqual(migrated.configTemplateTasksByType['tOS版本项目'].filter(task => !task.parentId).map(task => task.taskName), ['规划阶段', '概念阶段', '计划阶段', '开发验证阶段', '上市迭代阶段', '维护阶段'])

const custom = [{ id: 'custom', stableId: 'custom', order: 1, taskName: '用户自定义阶段', source: 'custom' }]
assert.deepEqual(plan.migratePlanStoreState({ tasks: custom }, 7).tasks, custom)
const once = plan.migratePlanStoreState(migrated, 8)
assert.deepEqual(once, migrated)
```

- [ ] **Step 2: Run and confirm RED**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:technical-plan
```

Expected: FAIL because the store is V7 and seeds every nontechnical type from one shared template.

- [ ] **Step 3: Implement type-specific seeds and conservative migration**

Set `PLAN_STORE_VERSION = 8`. Export explicit constants:

```ts
export const MACHINE_LEVEL1_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_MACHINE, true)
export const TOS_LEVEL1_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_TOS_VERSION, true)
export const MACHINE_LEVEL1_TEMPLATE_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_MACHINE, false)
export const TOS_LEVEL1_TEMPLATE_TASKS = buildLevel1TasksForProjectType(PROJECT_CATEGORY_TOS_VERSION, false)
export const getDefaultLevel1TasksForProjectType = (projectType: string, withMockDates = true) => /* select and clone */
```

Keep `LEVEL1_TASKS`/`LEVEL1_TEMPLATE_TASKS` as machine-compatible exports for legacy standalone surfaces. Make config templates and initial published snapshots call `getDefaultLevel1TasksForProjectType`.

Add `migrateLevel1TasksForProjectType(tasks, projectType, withMockDates)` that:

1. replaces empty arrays and recognized shared/default seed structures;
2. maps existing fixed-node dates by stable ID, then normalized name fallback;
3. maps `stage-launch`/`上市收编阶段` to the approved project-specific stage;
4. preserves nonempty unknown/custom arrays unchanged;
5. never mutates the input;
6. is idempotent at V8.

Route config templates, project mock snapshots, market data, tOS type plan data, and known template snapshots through the same helper. Do not touch technical snapshots.

- [ ] **Step 4: Update configuration fallbacks**

In `ConfigContainer`, replace generic `LEVEL1_TEMPLATE_TASKS` fallbacks with:

```ts
getDefaultLevel1TasksForProjectType(selectedTemplateType, false)
```

Creation of a new revision must clone the currently selected project type's template, not the machine default.

- [ ] **Step 5: Run and confirm GREEN**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:technical-plan
npm run verify:machine-tos
```

Expected: PASS, including V8 idempotency, custom preservation, and technical snapshot preservation.

- [ ] **Step 6: Commit the persistence slice**

```bash
git add src/stores/plan.ts src/containers/ConfigContainer.tsx scripts/verify-level1-plan-governance.mjs scripts/verify-technical-plan.mjs
git commit -m "feat: migrate level1 templates by project type"
```

### Task 5: Add tree filters and latest-published basic-information selectors

**Files:**
- Modify: `src/lib/projectSpaceLevel1Rules.ts`
- Modify: `scripts/verify-level1-plan-governance.mjs`

- [ ] **Step 1: Write failing tree-filter assertions**

```js
assert.deepEqual(rules.LEVEL1_TREE_FILTER_FIELDS.map(field => field.label), [
  '序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期',
  '实际开始时间', '实际完成时间', '实际工期', '是否延期',
])

const filtered = rules.filterLevel1TreeRows(treeRows, [{ field: 'taskName', operator: 'contains', value: 'STR1' }])
assert.deepEqual(filtered.map(row => row.taskName), ['概念阶段', 'STR1'])
const stageFiltered = rules.filterLevel1TreeRows(treeRows, [{ field: 'taskName', operator: 'contains', value: '概念阶段' }])
assert.deepEqual(stageFiltered.map(row => row.taskName), ['概念阶段', '概念启动', 'STR1'])
```

- [ ] **Step 2: Write failing latest-published summary assertions**

```js
const summary = rules.selectLatestPublishedLevel1Summary({
  versions: [
    { id: 'v3', versionNo: 'V3', status: '已发布' },
    { id: 'v4', versionNo: 'V4', status: '修订中' },
  ],
  getSnapshot: versionId => ({ v3: publishedTasks, v4: draftTasks })[versionId],
})
assert.deepEqual(summary, {
  versionId: 'v3', planStartDate: '2026-01-01', planEndDate: '2026-12-31',
  actualStartDate: '2026-01-03', actualEndDate: '2027-01-02',
})
assert.equal(summary.planEndDate === draftTasks.at(-1).planEndDate, false)
```

- [ ] **Step 3: Run and confirm RED**

Run: `npm run verify:level1-plan-governance`

Expected: FAIL because the workspace helper only exposes flat-row filtering and no latest-published four-date summary.

- [ ] **Step 4: Implement tree filtering and summary selection**

Add the exact nine field definitions. `filterLevel1TreeRows` must preserve original order, include a parent when a child matches, and include children when their parent matches. Empty conditions return clones of every row.

Implement:

```ts
export const selectLatestPublishedLevel1Summary = ({ versions, getSnapshot }: Input) => {
  const latest = versions.filter(version => version.status === '已发布')
    .sort((left, right) => comparePlanVersions(right, left))[0]
  const tasks = latest ? getSnapshot(latest.id) : undefined
  if (!latest || !tasks) return emptySummary
  return {
    versionId: latest.id,
    planStartDate: minIso(tasks.map(task => task.planStartDate)),
    planEndDate: maxIso(tasks.map(task => task.planEndDate)),
    actualStartDate: minIso(tasks.map(task => task.actualStartDate)),
    actualEndDate: maxIso(tasks.map(task => task.actualEndDate)),
  }
}
```

Strictly ignore draft tasks and invalid dates.

- [ ] **Step 5: Run and confirm GREEN**

Run: `npm run verify:level1-plan-governance`

Expected: PASS for hierarchy preservation and draft-independent summary.

- [ ] **Step 6: Commit the workspace-helper slice**

```bash
git add src/lib/projectSpaceLevel1Rules.ts scripts/verify-level1-plan-governance.mjs
git commit -m "feat: select hierarchical level1 workspace data"
```

### Task 6: Replace project-space flat UI with the governed tree UI

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-level1-plan-governance.mjs`
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `screenshots/verify-level1-flat-milestone-gantt-browser.mjs`

- [ ] **Step 1: Write failing static and browser UI contract assertions**

Replace whole-machine/tOS flat assertions with:

```js
for (const label of ['序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际完成时间', '实际工期', '是否延期']) {
  assert.match(projectSpaceSource, new RegExp(label))
}
assert.doesNotMatch(projectSpaceSource, /isFlatGovernedLevel1Table/)
assert.match(projectSpaceSource, /filterLevel1TreeRows/)
assert.match(projectSpaceSource, /pms-level1-date-input-invalid/)
assert.match(projectSpaceSource, /添加MR里程碑/)
assert.match(projectSpaceSource, /添加tOS版本/)
assert.match(projectSpaceSource, /getLevel1StructurePermissions/)
```

Before changing the component, update the public-UI browser flow to require:

```js
await assertSelectedView(page, '横版表格')
await selectView(page, '竖版表格')
await assertColumns(page, [
  '序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期',
  '实际开始时间', '实际完成时间', '实际工期', '是否延期',
])
await assertTreeExpanders(page)
```

Also add the machine/tOS SPM and super-admin interactions, red invalid-order DatePicker assertion, publish-block/focus assertion, fixed-milestone Gantt drag, business-period move/resize, stage-readonly assertion, and same-context persistence. These tests must navigate through visible controls and must not call Zustand/React internals.

- [ ] **Step 2: Run and confirm RED**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
PMS_BROWSER_CASE=machine npm run verify:level1-flat-gantt-browser
PMS_BROWSER_CASE=tos npm run verify:level1-flat-gantt-browser
```

Expected: rule scripts and both browser cases FAIL because the special branch still renders flat eight-column rows and machine-only MR insertion. The browser failure must be at the first missing tree-nine-column or dynamic-node behavior, not at navigation.

- [ ] **Step 3: Remove the whole-machine/tOS flat-table branch**

For governed level one, always use `projectLevel1Plan(tableTasks, { mode: 'standard' })`. Feed its ordered rows to the hierarchy-aware filter, collapsed-node helper, and a stable `rowKey={record => record.stableId || record.id}`. Keep technical-project code outside this container unchanged.

Render these exact columns from one `governedLevel1Columns` definition:

```ts
const governedLevel1Columns = [
  sequenceColumn,
  treeTaskNameColumn,
  planStartColumn,
  planEndColumn,
  estimatedDaysColumn,
  actualStartColumn,
  actualEndColumn,
  actualDaysColumn,
  delayStatusColumn,
]
```

Fixed milestones expose only completion editors. Business periods expose all four date editors. Stage dates and all durations are derived read-only cells.

- [ ] **Step 4: Wire real-time red error feedback and publish focus**

Use `validateLevel1ScheduleDates(tableTasks)` for column `onCell` and DatePicker `status="error"`. Wrap errors in a red Tooltip. Invalid input must still persist to the draft through a permissive date patch; only malformed dates are rejected immediately. On publish, use the stable row key and field-specific selector:

```ts
document.querySelector(`[data-row-key="${stableId}"] [data-field="${field}"]`)?.scrollIntoView(...)
```

Do not key the scroll target by renumberable display ID.

- [ ] **Step 5: Wire permission-aware structure actions**

At render time and again inside confirmation callbacks, read current project, permission, plan, and UI stores. Compute SPM from project fields plus the project-manager role; compute super-admin from global roles. Use `getLevel1StructurePermissions` for every action.

Implement:

- machine `添加MR里程碑`: confirm → validated name input → insert into selected 上市/生命周期 stage;
- tOS `添加tOS版本`: confirm → validated name input → insert into selected 上市迭代/维护 stage;
- super-admin generic stage/child add/delete;
- SPM business-node delete and drag reorder only;
- confirmation tokens covering project, scope, version, user, parent stage, and edit/draft state.

No action writes if context changes while a modal is open.

- [ ] **Step 6: Integrate mixed Gantt changes**

Build Gantt from the unprojected hierarchy, pass `editable` only for SPM/super-admin in a draft, and validate the candidate task array before accepting `onTaskDateChange`. Fixed points patch only `planEndDate`; business bars patch both planned boundaries. Invalid drags return `false`, display the first validation message, and allow the interaction controller to restore the DOM task.

- [ ] **Step 7: Add scoped styles**

```css
.pms-level1-tree-table .pms-level1-date-input-invalid .ant-picker {
  border-color: #ff4d4f;
  box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.08);
}
.pms-level1-tree-table .ant-table-row-level-0 > td {
  background: #fafafa;
  font-weight: 600;
}
```

Do not change technical tables or global DatePicker styles.

- [ ] **Step 8: Run and confirm GREEN**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
npx tsc --noEmit
PMS_BROWSER_CASE=machine npm run verify:level1-flat-gantt-browser
PMS_BROWSER_CASE=tos npm run verify:level1-flat-gantt-browser
```

Expected: PASS with no TypeScript errors or unexpected browser console/page errors.

- [ ] **Step 9: Commit the project-space UI slice**

```bash
git add src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-level1-plan-governance.mjs scripts/verify-level1-flat-milestone-gantt.mjs screenshots/verify-level1-flat-milestone-gantt-browser.mjs
git commit -m "feat: restore hierarchical level1 plan views"
```

### Task 7: Align horizontal view, basic information, history, filters, and exports

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/plans/PlanVersionCompareModal.tsx` only if the governed mode needs a label/width correction
- Modify: `src/lib/versionCompare.ts` only if a missing tree field is exposed by RED
- Modify: `scripts/verify-level1-plan-governance.mjs`
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `screenshots/verify-level1-flat-milestone-gantt-browser.mjs`

- [ ] **Step 1: Write failing cross-surface assertions**

```js
assert.match(projectSpaceSource, /selectLatestPublishedLevel1Summary/)
assert.match(projectSpaceSource, /latestPublishedLevel1Summary\.actualStartDate/)
assert.match(projectSpaceSource, /latestPublishedLevel1Summary\.actualEndDate/)
assert.match(projectSpaceSource, /dynamicBusinessStage.*estimatedDays.*'-'/s)
assert.match(projectSpaceSource, /compareVersionsForTable\(projectLevel1Plan\(oldTasks/)
assert.match(projectSpaceSource, /fieldMode="governed"/)
assert.match(projectSpaceSource, /LEVEL1_TREE_FILTER_FIELDS/)
```

Add a pure compare assertion proving reorder-only changes preserve identity, while node rename, add/delete, and all four dates produce changes.

Before changing production, add browser assertions that:

- latest-published actual edits update all four basic-information summary fields after same-context reopen;
- draft planned dates do not change the basic-information summary;
- governed version comparison has a nonzero expected task/date change and the ten expected headers;
- vertical current/all and horizontal current/all exports download files containing the expected headers.

- [ ] **Step 2: Run and confirm RED**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
PMS_BROWSER_CASE=machine npm run verify:level1-flat-gantt-browser
PMS_BROWSER_CASE=tos npm run verify:level1-flat-gantt-browser
```

Expected: static and browser cases FAIL because project comparison still projects whole-machine/tOS snapshots into flat rows, base information can read active draft data, and filter/export definitions still use the flat eight-field contract.

- [ ] **Step 3: Align horizontal view**

Use the same project-specific tree projection for every version snapshot. Center stage names and render stage duration at the right, except for machine 上市/生命周期 and tOS 上市迭代/维护 where the duration badge is omitted. Fixed milestones edit completion only; business periods expose planned and actual start/end via the tree/detail surface while the horizontal cell continues to show completion.

- [ ] **Step 4: Make basic information latest-published only**

Resolve the snapshot key from current market or current tOS type and call `selectLatestPublishedLevel1Summary`. In `renderProjectBasicInfo`, render plan start, plan completion, actual start, and actual completion from that result. Never fall back to `effectiveTasks` when a draft is selected. Updating actual data in the latest published snapshot must refresh the selector without overwriting a paired draft's plan fields or custom nodes.

- [ ] **Step 5: Align version history**

For whole-machine/tOS project level one, compare:

```ts
projectLevel1Plan(snapshot, { mode: 'standard' }).rows
```

and pass `fieldMode="governed"`. The modal must show `序号、变更类型、阶段/节点、计划开始、计划完成、预估工期、实际开始、实际完成、实际工期、是否延期`. Technical TDT stays `hierarchical-flat`; technical subprojects stay `technical-subproject`.

- [ ] **Step 6: Align filter and export pipelines**

Use `LEVEL1_TREE_FILTER_FIELDS` for the filter drawer. Feed the same filtered hierarchy to vertical table and Gantt. Vertical current-view export uses the filtered tree projection; vertical all export uses the complete tree projection. Horizontal current/all export keeps the version-stage matrix and derives every stage from its own snapshot.

- [ ] **Step 7: Run and confirm GREEN**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
npm run verify:technical-plan
npm run verify:technical-plan-operations
npx tsc --noEmit
PMS_BROWSER_CASE=machine npm run verify:level1-flat-gantt-browser
PMS_BROWSER_CASE=tos npm run verify:level1-flat-gantt-browser
```

Expected: PASS with technical history/filter/export unchanged.

- [ ] **Step 8: Commit the cross-surface slice**

```bash
git add src/containers/ProjectSpaceContainer.tsx src/components/plans/PlanVersionCompareModal.tsx src/lib/versionCompare.ts scripts/verify-level1-plan-governance.mjs scripts/verify-level1-flat-milestone-gantt.mjs screenshots/verify-level1-flat-milestone-gantt-browser.mjs
git commit -m "feat: align hierarchical level1 plan surfaces"
```

Only add modal/compare files if RED required actual changes; do not stage untouched files.

### Task 8: Complete browser acceptance and retain technical regression

**Files:**
- Modify: `screenshots/verify-level1-flat-milestone-gantt-browser.mjs`
- Modify: `docs/superpowers/plans/2026-08-27-machine-tos-level1-plan-refresh.md`

- [ ] **Step 1: Audit the pre-written browser matrix against the approved design**

Confirm the browser tests written before Tasks 6 and 7 cover these observable contracts without using store/test hooks:

```js
await assertSelectedView(page, '横版表格')
await selectView(page, '竖版表格')
await assertColumns(page, [
  '序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期',
  '实际开始时间', '实际完成时间', '实际工期', '是否延期',
])
await assertTreeExpanders(page)
```

The pre-written real interactions must cover:

1. machine SPM: create a revision, add `MR1` under 上市阶段, enter all four dates, reorder/delete, and reopen;
2. tOS SPM: create a revision, add a project-prefix version under 上市迭代 and 维护, reject wrong prefix and tail, then persist a valid version;
3. invalid fixed-node order: set a later node earlier than its predecessor, assert red DatePicker and exact error Tooltip, assert publish blocked and row focused;
4. valid fixed milestone Gantt drag changes only completion;
5. business-period Gantt move and resize update both boundaries and inclusive duration;
6. stage Gantt tasks remain read-only;
7. super-admin generic structure actions are visible; ordinary members cannot edit;
8. latest-published actual update refreshes basic information after same-context reopen; draft plan edits do not;
9. governed history compare reports a nonzero expected task/date change;
10. vertical/horizontal exports trigger downloads with the expected header cells;
11. existing TDT and technical-subproject cases still pass unchanged.

- [ ] **Step 2: Run focused browser cases to GREEN**

```bash
PMS_BROWSER_CASE=machine npm run verify:level1-flat-gantt-browser
PMS_BROWSER_CASE=tos npm run verify:level1-flat-gantt-browser
PMS_BROWSER_CASE=technical npm run verify:level1-flat-gantt-browser
```

Expected: all three exit 0, emit actual before/after dates, and report zero unexpected console errors/page errors.

- [ ] **Step 3: Run the complete browser matrix**

```bash
PMS_BROWSER_CASE=all npm run verify:level1-flat-gantt-browser
```

Expected: PASS and a nonempty executed-case list. `PMS_BROWSER_CASE=__typo__` must exit nonzero.

- [ ] **Step 4: Record evidence and commit**

Check off the executed commands in this plan and record the observed date values, rejected format, red error text, and basic-info values. Then:

```bash
git add screenshots/verify-level1-flat-milestone-gantt-browser.mjs docs/superpowers/plans/2026-08-27-machine-tos-level1-plan-refresh.md
git commit -m "test: verify hierarchical level1 plan workflows"
```

### Task 9: Full regression, production build, and feature-branch delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-08-27-machine-tos-level1-plan-refresh.md` only to record final evidence

- [ ] **Step 1: Run all focused rule gates sequentially**

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
npm run verify:machine-tos
npm run verify:technical-plan
npm run verify:technical-project
npm run verify:technical-plan-operations
npm run verify:workbench-split
```

Expected: every command exits 0. Do not run build concurrently with TypeScript because `.next` generation races have occurred in this repository.

- [ ] **Step 2: Run type-check and production build sequentially**

```bash
npx tsc --noEmit
npm run build
```

Expected: both exit 0; a Browserslist/caniuse-lite freshness warning is nonblocking, but TypeScript or page-generation warnings are not.

- [ ] **Step 3: Restart the dev server after build and run one final clean browser matrix**

```bash
npm run dev -- -p 3004
PMS_BROWSER_CASE=all npm run verify:level1-flat-gantt-browser
```

Expected: server returns HTTP 200 and the post-build browser matrix exits 0.

- [ ] **Step 4: Inspect the final diff and branch boundary**

```bash
git diff --check origin/codex/level1-flat-milestones...HEAD
git status --short --branch
git log --oneline --decorate origin/codex/level1-flat-milestones..HEAD
```

Expected: no whitespace errors, only in-scope files, and branch `codex/level1-flat-milestones` ahead of its matching remote. Do not merge `dev`/`master` and do not deploy.

- [ ] **Step 5: Commit final evidence if the plan changed**

```bash
git add docs/superpowers/plans/2026-08-27-machine-tos-level1-plan-refresh.md
git commit -m "docs: record level1 plan refresh verification"
```

Skip this commit if the plan file is unchanged.

- [ ] **Step 6: Push only the feature branch**

```bash
git push origin codex/level1-flat-milestones
git rev-parse HEAD
git rev-parse origin/codex/level1-flat-milestones
```

Expected: local and remote SHAs match. Report the commit range and verification evidence; explicitly state that `dev`, `master`, and deployment were not changed.
