# 整机与 tOS 一级计划五阶段调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有整机与 tOS 一级计划从旧六阶段规则调整为已确认的五阶段模板，并完成 Mock 联动、基础信息两行横版、阶段独立新增、严格日期校验和点/时间条甘特交互。

**Architecture:** 继续以 Zustand 中的两级任务数组作为唯一数据源，复用 `level1PlanRules.ts`、`planGanttRules.ts` 和现有市场/tOS 类型版本作用域。先升级纯规则与持久化迁移，再接入项目空间三个视图；所有表格、横版和甘特修改都回到同一套节点类型、权限、日期与稳定标识规则，技术项目和能力建设项目保持当前行为。

**Tech Stack:** Next.js 14、React 18、TypeScript、Ant Design 6、Zustand 4、dnd-kit、DHTMLX Gantt、Node 验证脚本、Puppeteer 浏览器验收。

**Reference design:** `docs/superpowers/specs/2026-08-28-machine-tos-level1-plan-adjustment-design.md`

---

## File responsibility map

- `src/lib/level1PlanRules.ts` — 五阶段模板、能力建设旧模板隔离、节点投影、名称规则、结构权限、严格日期规则、业务节点改名与排序。
- `src/lib/planGanttRules.ts` — 一级阶段/固定里程碑/业务时间段甘特投影，以及不包含首尾补一天的日期补丁。
- `src/lib/projectSpaceLevel1Rules.ts` — 基础信息与计划模块横版版本选择、最新发布摘要、筛选和实际时间合并。
- `src/data/projectListPlanMocks.ts` — 项目列表及项目空间初始化使用的项目级 Mock 日期和动态节点。
- `src/stores/plan.ts` — 默认模板、项目/市场/tOS 类型快照、V8→V9 迁移及幂等保护。
- `src/containers/ProjectListContainer.tsx` — 为项目级 Mock 构造器提供项目类型与项目名称。
- `src/containers/ProjectSpaceContainer.tsx` — 阶段行新增入口、动态节点改名/删除/排序、基础信息两行横版、计划横版和甘特写入。
- `src/styles/globals.css` — 仅在现有样式不足时增加阶段操作和错误态的局部样式。
- `scripts/verify-level1-plan-governance.mjs` — 模板、权限、迁移、版本选择、Mock 和项目空间源码契约。
- `scripts/verify-level1-flat-milestone-gantt.mjs` — 严格日期、工期、里程碑点、时间条和拖动回滚契约。
- `scripts/verify-plan-versioning.mjs` — V9 持久化版本和版本作用域回归。
- `scripts/verify-technical-plan.mjs` — 证明技术项目不受整机/tOS 调整影响。
- `screenshots/verify-level1-flat-milestone-gantt-browser.mjs` — 整机与 tOS 真实浏览器验收。

### Task 0: 同步开发基线并建立回归基准

**Files:**
- Verify only: repository and existing verification scripts

- [ ] **Step 1: 确认隔离工作区和分支状态**

Run:

```bash
git status --short --branch
git branch --show-current
```

Expected: 当前分支为 `codex/level1-flat-milestones`，除已提交设计/计划外没有未提交业务文件。

- [ ] **Step 2: 同步最新开发分支**

Run:

```bash
git fetch origin
git merge --no-edit origin/dev
```

Expected: 输出 `Already up to date.`，或生成一个只包含 `origin/dev` 最新改动的合并提交；不得丢弃、重置或覆盖其他工作区文件。

- [ ] **Step 3: 运行当前一级计划基线**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 三条命令全部退出码为 `0`。若同步后失败，先按 `superpowers:systematic-debugging` 定位基线回归，不能把基线失败混入本需求。

### Task 1: 替换五阶段模板、项目 Mock 与 V9 迁移

**Files:**
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/data/projectListPlanMocks.ts`
- Modify: `src/stores/plan.ts`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-level1-plan-governance.mjs`
- Modify: `scripts/verify-plan-versioning.mjs`
- Modify: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: 写入五阶段、能力建设隔离和 Mock 联动的失败断言**

在 `scripts/verify-level1-plan-governance.mjs` 增加：

```js
const machineV9 = rules.buildLevel1TasksForProjectType('整机产品项目', false)
assert.deepEqual(
  machineV9.filter(task => !task.parentId).map(task => task.taskName),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市阶段', '生命周期阶段'],
)
assert.deepEqual(
  machineV9.filter(task => task.parentId).map(task => task.taskName),
  ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5'],
)

const tosV9 = rules.buildLevel1TasksForProjectType('tOS版本项目', false)
assert.deepEqual(
  tosV9.filter(task => !task.parentId).map(task => task.taskName),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市迭代阶段', '维护阶段'],
)
assert.deepEqual(
  tosV9.filter(task => task.parentId).map(task => task.taskName),
  ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5'],
)
assert.equal(tosV9.some(task => ['规划KO', 'CDCP', '规划阶段'].includes(task.taskName)), false)

const capability = rules.buildLevel1TasksForProjectType('能力建设项目', false)
assert.deepEqual(
  capability.filter(task => !task.parentId).map(task => task.taskName),
  ['概念阶段', '计划阶段', '开发阶段', '验证阶段', '上市阶段', '生命周期阶段'],
  '本轮不能把能力建设项目随整机模板一起升级',
)

const machineMock = projectMocks.buildProjectListMockPlanTasks('1', machineV9, {
  projectType: '整机产品项目',
  projectName: 'X6877-D8400_H991',
})
assert.equal(machineMock.some(task => task.taskName === 'MR1' && task.nodeKind === 'business-period'), true)

const tosMock = projectMocks.buildProjectListMockPlanTasks('19', tosV9, {
  projectType: 'tOS版本项目',
  projectName: 'tOS16.3',
})
assert.equal(tosMock.some(task => task.taskName === '16.3.0.110'), true)
assert.equal(tosMock.some(task => task.taskName === '16.3.0.115'), true)
```

在持久化断言中把预期版本改为 `9`，并增加 V8 旧整机/旧 tOS 输入迁移后得到五阶段且重复迁移不再变化的断言。

- [ ] **Step 2: 运行验证并确认 RED**

Run:

```bash
npm run verify:level1-plan-governance
node scripts/verify-plan-versioning.mjs
```

Expected: FAIL，原因包括旧整机仍为六阶段、旧 tOS 仍包含规划阶段、项目 Mock 构造器没有项目上下文，以及 `PLAN_STORE_VERSION` 仍为 `8`。

- [ ] **Step 3: 实现五阶段模板并冻结能力建设旧模板**

在 `src/lib/level1PlanRules.ts` 使用明确的三套模板，整机和 tOS 更新，能力建设保留当前结构：

```ts
export const MACHINE_LEVEL1_TEMPLATE_TASKS: Level1PlanTask[] = [
  templateTask('machine-stage-concept', null, 0, '概念阶段', 'stage'),
  templateTask('machine-ms-concept-kickoff', 'machine-stage-concept', 0, '概念启动', 'fixed-milestone', 'SPM'),
  templateTask('machine-ms-str1', 'machine-stage-concept', 1, 'STR1', 'fixed-milestone', 'SPM'),
  templateTask('machine-stage-planning', null, 1, '计划阶段', 'stage'),
  templateTask('machine-ms-str2', 'machine-stage-planning', 0, 'STR2', 'fixed-milestone', 'SPM'),
  templateTask('machine-ms-str3', 'machine-stage-planning', 1, 'STR3', 'fixed-milestone', 'SPM'),
  templateTask('machine-stage-development', null, 2, '开发验证阶段', 'stage'),
  templateTask('machine-ms-str4', 'machine-stage-development', 0, 'STR4', 'fixed-milestone', 'SPM'),
  templateTask('machine-ms-str4a', 'machine-stage-development', 1, 'STR4A', 'fixed-milestone', 'SPM'),
  templateTask('machine-ms-str5', 'machine-stage-development', 2, 'STR5', 'fixed-milestone', 'SPM'),
  templateTask('machine-stage-launch', null, 3, '上市阶段', 'stage'),
  templateTask('machine-stage-lifecycle', null, 4, '生命周期阶段', 'stage'),
]

export const TOS_LEVEL1_TEMPLATE_TASKS: Level1PlanTask[] = [
  templateTask('tos-stage-concept', null, 0, '概念阶段', 'stage'),
  templateTask('tos-ms-concept-kickoff', 'tos-stage-concept', 0, '概念启动', 'fixed-milestone', 'SPM'),
  templateTask('tos-ms-str1', 'tos-stage-concept', 1, 'STR1', 'fixed-milestone', 'SPM'),
  templateTask('tos-stage-plan', null, 1, '计划阶段', 'stage'),
  templateTask('tos-ms-str2', 'tos-stage-plan', 0, 'STR2', 'fixed-milestone', 'SPM'),
  templateTask('tos-ms-str3', 'tos-stage-plan', 1, 'STR3', 'fixed-milestone', 'SPM'),
  templateTask('tos-stage-development-validation', null, 2, '开发验证阶段', 'stage'),
  templateTask('tos-ms-str4', 'tos-stage-development-validation', 0, 'STR4', 'fixed-milestone', 'SPM'),
  templateTask('tos-ms-str4a', 'tos-stage-development-validation', 1, 'STR4A', 'fixed-milestone', 'SPM'),
  templateTask('tos-ms-str5', 'tos-stage-development-validation', 2, 'STR5', 'fixed-milestone', 'SPM'),
  templateTask('tos-stage-launch-iteration', null, 3, '上市迭代阶段', 'stage'),
  templateTask('tos-stage-maintenance', null, 4, '维护阶段', 'stage'),
]

export const CAPABILITY_LEVEL1_TEMPLATE_TASKS: Level1PlanTask[] = [
  templateTask('capability-stage-concept', null, 0, '概念阶段', 'stage'),
  templateTask('capability-ms-concept-kickoff', 'capability-stage-concept', 0, '概念启动', 'fixed-milestone', 'SPM'),
  templateTask('capability-ms-str1', 'capability-stage-concept', 1, 'STR1', 'fixed-milestone', 'SPM'),
  templateTask('capability-stage-planning', null, 1, '计划阶段', 'stage'),
  templateTask('capability-ms-str2', 'capability-stage-planning', 0, 'STR2', 'fixed-milestone', 'SPM'),
  templateTask('capability-ms-str3', 'capability-stage-planning', 1, 'STR3', 'fixed-milestone', 'SPM'),
  templateTask('capability-stage-development', null, 2, '开发阶段', 'stage'),
  templateTask('capability-ms-str4', 'capability-stage-development', 0, 'STR4', 'fixed-milestone', 'SPM'),
  templateTask('capability-ms-str4a', 'capability-stage-development', 1, 'STR4A', 'fixed-milestone', 'SPM'),
  templateTask('capability-stage-validation', null, 3, '验证阶段', 'stage'),
  templateTask('capability-ms-str5', 'capability-stage-validation', 0, 'STR5', 'fixed-milestone', 'SPM'),
  templateTask('capability-stage-launch', null, 4, '上市阶段', 'stage'),
  templateTask('capability-stage-lifecycle', null, 5, '生命周期阶段', 'stage'),
]
```

让 `buildLevel1TasksForProjectType` 对三类项目显式分派，不能继续使用“非 tOS 一律整机”的兜底。

- [ ] **Step 4: 实现项目级动态 Mock**

在 `src/data/projectListPlanMocks.ts` 扩展可选上下文，并只在目标阶段没有业务节点时追加确定性 Mock：

```ts
export interface ProjectListMockContext {
  projectType: string
  projectName: string
}

interface BusinessMockSeed {
  stageName: string
  taskName: string
  planStartDate: string
  planEndDate: string
}

const appendBusinessMockRows = <T extends ProjectListMockTemplateTask>(
  tasks: readonly T[],
  projectId: string,
  seeds: readonly BusinessMockSeed[],
): T[] => {
  const taskByName = new Map(tasks.map(task => [task.taskName || task.name || '', task]))
  const additions = seeds.flatMap((seed, index) => {
    const stage = taskByName.get(seed.stageName)
    if (!stage || tasks.some(task => task.parentId === stage.id && task.nodeKind === 'business-period')) return []
    const existingCount = tasks.filter(task => task.parentId === stage.id).length
    return [{
      id: `${stage.id}.${existingCount + 1}`,
      stableId: `mock-${projectId}-business-${index + 1}`,
      parentId: stage.id,
      order: existingCount,
      taskName: seed.taskName,
      source: 'custom',
      nodeKind: 'business-period',
      planStartDate: seed.planStartDate,
      planEndDate: seed.planEndDate,
      actualStartDate: shiftIsoDate(seed.planStartDate, 1),
      actualEndDate: shiftIsoDate(seed.planEndDate, 1),
      estimatedDays: null,
      actualDays: null,
    } as T]
  })
  return [...tasks.map(task => ({ ...task })), ...additions]
}

const buildDatedMilestones = <T extends ProjectListMockTemplateTask>(
  projectId: string,
  templateTasks: readonly T[],
): T[] => {
  const offset = projectOffset(projectId)
  let milestoneIndex = 0
  return templateTasks.map(task => {
    if (!task.parentId) return { ...task, planStartDate: '', planEndDate: '', actualStartDate: '', actualEndDate: '' }
    const currentIndex = milestoneIndex++
    const planEndDate = getMilestoneDate(currentIndex, offset)
    return {
      ...task,
      planStartDate: '',
      planEndDate,
      actualStartDate: '',
      actualEndDate: shiftIsoDate(planEndDate, currentIndex < 2 ? 1 : 0),
    }
  })
}

export function buildProjectListMockPlanTasks<T extends ProjectListMockTemplateTask>(
  projectId: string,
  templateTasks: readonly T[],
  context?: ProjectListMockContext,
): T[] {
  const dated = buildDatedMilestones(projectId, templateTasks)
  if (context?.projectType === '整机产品项目') {
    return appendBusinessMockRows(dated, projectId, [
      { stageName: '上市阶段', taskName: 'MR1', planStartDate: '2026-12-16', planEndDate: '2027-01-15' },
      { stageName: '生命周期阶段', taskName: 'MR2', planStartDate: '2027-01-16', planEndDate: '2027-03-01' },
    ])
  }
  const prefix = context?.projectType === 'tOS版本项目'
    ? parseTosProjectVersionPrefix(context.projectName)?.prefix
    : undefined
  return prefix
    ? appendBusinessMockRows(dated, projectId, [
        { stageName: '上市迭代阶段', taskName: `${prefix}.110`, planStartDate: '2026-12-16', planEndDate: '2027-01-15' },
        { stageName: '维护阶段', taskName: `${prefix}.115`, planStartDate: '2027-01-16', planEndDate: '2027-03-01' },
      ])
    : dated
}
```

更新 `ProjectListContainer` 与 `ProjectSpaceContainer` 两个调用方传入 `{ projectType: project.type, projectName: project.name }`。项目空间市场 Mock 初始化也使用同一构造器，防止项目列表有 MR、进入项目后却没有 MR。

- [ ] **Step 5: 实现 V8→V9 保守迁移**

在 `src/stores/plan.ts`：

```ts
export const PLAN_STORE_VERSION = 9
const shouldMigrateFiveStageLevel1 = persistedVersion < 9
```

在修改模板常量前的 V8 整机/tOS 稳定签名必须以常量保留下来并加入 `STABLE_LEVEL1_SEED_SIGNATURES`。迁移映射要求：

```ts
const MACHINE_V8_PARENT_TARGETS: Record<string, string> = {
  'stage-development': 'machine-stage-development',
  'stage-validation': 'machine-stage-development',
}
```

- 旧整机 `STR4`、`STR4A`、`STR5` 合并到 `machine-stage-development`；
- 旧 tOS 规划阶段、规划KO、CDCP 不进入新默认模板；
- 若被删除阶段下存在用户自定义子节点，保留该阶段为 `source: 'custom'` 的兼容阶段，避免子节点变成孤儿；
- 配置模板、模板发布快照、市场数据、tOS 类型数据、普通项目快照和根 `tasks` 都执行同一 V9 迁移；
- 能力建设项目跳过本次五阶段迁移；
- 第二次执行 `migratePlanStoreState(first, 9)` 必须深度等于第一次结果。

- [ ] **Step 6: 运行验证并确认 GREEN**

Run:

```bash
npm run verify:level1-plan-governance
node scripts/verify-plan-versioning.mjs
npm run verify:technical-plan
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 全部 PASS；技术项目和能力建设结构断言保持不变。

- [ ] **Step 7: 提交模板、Mock 和迁移切片**

```bash
git add src/lib/level1PlanRules.ts src/data/projectListPlanMocks.ts src/stores/plan.ts src/containers/ProjectListContainer.tsx src/containers/ProjectSpaceContainer.tsx scripts/verify-level1-plan-governance.mjs scripts/verify-plan-versioning.mjs scripts/verify-technical-plan.mjs
git commit -m "feat: migrate machine and tos level1 plans to five stages"
```

### Task 2: 实施严格日期顺序、工期和安全排序

**Files:**
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/lib/planGanttRules.ts`
- Modify: `scripts/verify-level1-plan-governance.mjs`
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`

- [ ] **Step 1: 写入严格顺序和非包含式工期的失败断言**

在两个验证脚本中增加：

```js
const sameDayFixed = rules.validateLevel1ScheduleDates([
  { id: 's', stableId: 's', parentId: null, order: 0, taskName: '阶段', nodeKind: 'stage' },
  { id: 'a', stableId: 'a', parentId: 's', order: 0, taskName: 'A', nodeKind: 'fixed-milestone', planEndDate: '2026-02-01' },
  { id: 'b', stableId: 'b', parentId: 's', order: 1, taskName: 'B', nodeKind: 'fixed-milestone', planEndDate: '2026-02-01' },
])
assert.equal(sameDayFixed.valid, false)
assert.match(sameDayFixed.byTaskId.b.planEndDate.join('；'), /下一个子节点日期不允许超上一个子节点/)

const periodProjection = rules.projectLevel1Plan([
  { id: 's', stableId: 's', parentId: null, order: 0, taskName: '上市阶段', nodeKind: 'stage' },
  { id: 'mr1', stableId: 'mr1', parentId: 's', order: 0, taskName: 'MR1', nodeKind: 'business-period', planStartDate: '2026-03-01', planEndDate: '2026-03-11' },
])
assert.equal(periodProjection.rows.find(row => row.id === 'mr1').estimatedDays, 10)
assert.equal(periodProjection.rows.find(row => row.id === 's').estimatedDays, 10)

const emptyFirstStage = rules.projectLevel1Plan([
  { id: 's1', stableId: 's1', parentId: null, order: 0, taskName: '空阶段', nodeKind: 'stage' },
  { id: 's2', stableId: 's2', parentId: null, order: 1, taskName: '有效阶段', nodeKind: 'stage' },
  { id: 'm2', stableId: 'm2', parentId: 's2', order: 0, taskName: '节点', nodeKind: 'fixed-milestone', planEndDate: '2026-04-10' },
])
assert.equal(emptyFirstStage.rows.find(row => row.id === 's1').planStartDate, '')
assert.equal(emptyFirstStage.rows.find(row => row.id === 's2').planStartDate, '2026-04-10')
```

加入排序失败不改变输入数组的断言：

```js
const invalidMove = rules.reorderLevel1BusinessNodes(periodTasks, 'mr2', 'mr1')
assert.equal(invalidMove.ok, false)
assert.equal(invalidMove.message, '下一个子节点日期不允许超上一个子节点。')
assert.deepEqual(periodTasks, originalPeriodTasks)
```

- [ ] **Step 2: 运行并确认 RED**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
```

Expected: FAIL，因为显式固定节点目前允许同日，业务工期仍按 `+1` 计算，排序仍在容器内直接写入。

- [ ] **Step 3: 收紧统一日期校验**

在 `validateLevel1ScheduleDates` 中将固定节点和阶段边界统一为严格递增：

```ts
const LEVEL1_SEQUENCE_ERROR = '下一个子节点日期不允许超上一个子节点。'

if (previousTimestamp !== null && timestamp <= previousTimestamp) {
  addViolation(task, endField, LEVEL1_SEQUENCE_ERROR)
}

if (blockingStage && stageStart.start <= blockingStage.end) {
  addViolation(stageStart.startTask, stageStart.startField, LEVEL1_SEQUENCE_ERROR)
}
```

删除 `equalFixedPointStages` 例外。业务时间段继续使用 `nextStart <= previousEnd` 作为冲突；空日期继续允许暂存，计划和实际分别遍历。

- [ ] **Step 4: 统一使用完成减开始的工期**

业务节点、阶段和甘特时间条改用现有 `getLevel1DateDifference`，不能使用 `getLevel1InclusiveDuration`：

```ts
const estimatedDays = getLevel1DateDifference(planStartDate, planEndDate)
const actualDays = getLevel1DateDifference(actualStartDate, actualEndDate)
```

在 `src/lib/planGanttRules.ts` 中让 `business-period` 的投影、`applyPlanGanttDateChange` 和 `applyPlanTaskDatePatch` 使用同一差值函数。技术子项目原有工期逻辑不改。

- [ ] **Step 5: 增加纯排序函数并在写入前校验**

在 `src/lib/level1PlanRules.ts` 增加：

```ts
export type ReorderLevel1BusinessNodesResult =
  | { ok: true; tasks: Level1PlanTask[] }
  | { ok: false; message: string }

export const reorderLevel1BusinessNodes = (
  tasks: readonly Level1PlanTask[],
  activeStableId: string,
  overStableId: string,
): ReorderLevel1BusinessNodesResult => {
  const active = tasks.find(task => (task.stableId || task.id) === activeStableId)
  const over = tasks.find(task => (task.stableId || task.id) === overStableId)
  if (!active || !over || active.parentId !== over.parentId
    || active.nodeKind !== 'business-period' || over.nodeKind !== 'business-period'
    || active.source !== 'custom' || over.source !== 'custom') {
    return { ok: false, message: '只能调整同一阶段内的动态节点顺序' }
  }
  const siblings = tasks.filter(task => task.parentId === active.parentId).sort((a, b) => a.order - b.order)
  const from = siblings.findIndex(task => (task.stableId || task.id) === activeStableId)
  const to = siblings.findIndex(task => (task.stableId || task.id) === overStableId)
  if (from < 0 || to < 0) return { ok: false, message: '动态节点不存在' }
  const reordered = [...siblings]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(to, 0, moved)
  const byStableId = new Map(reordered.map((task, index) => [task.stableId || task.id, { ...task, order: index }]))
  const candidate = renumberLevel1Tasks(tasks.map(task => byStableId.get(task.stableId || task.id) || { ...task }))
  return validateLevel1ScheduleDates(candidate).valid
    ? { ok: true, tasks: candidate }
    : { ok: false, message: LEVEL1_SEQUENCE_ERROR }
}
```

- [ ] **Step 6: 运行验证并确认 GREEN**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 全部 PASS，且包含同日、倒序、时间段交叠、跨阶段交叠、空阶段和计划/实际独立校验。

- [ ] **Step 7: 提交日期与排序规则**

```bash
git add src/lib/level1PlanRules.ts src/lib/planGanttRules.ts scripts/verify-level1-plan-governance.mjs scripts/verify-level1-flat-milestone-gantt.mjs
git commit -m "feat: enforce strict level1 schedule ordering"
```

### Task 3: 将动态节点操作放到对应阶段并补齐改名

**Files:**
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-level1-plan-governance.mjs`

- [ ] **Step 1: 写入阶段入口、改名和安全排序的失败契约**

增加纯规则断言：

```js
const renamed = rules.renameLevel1BusinessNode(machineTasksWithMr, {
  projectType: '整机产品项目',
  projectName: 'X6877',
  taskStableId: 'mock-mr-1',
  taskName: 'MR9',
})
assert.equal(renamed.ok, true)
assert.equal(renamed.tasks.find(task => task.stableId === 'mock-mr-1').taskName, 'MR9')

const invalidRename = rules.renameLevel1BusinessNode(machineTasksWithMr, {
  projectType: '整机产品项目', projectName: 'X6877', taskStableId: 'mock-mr-1', taskName: 'mr9',
})
assert.equal(invalidRename.ok, false)
```

增加源码契约，要求阶段名称列包含业务阶段 `＋`，并且顶部结构操作不再用 `businessStages[0]`：

```js
assert.match(projectSpaceSource, /aria-label={`添加业务节点 \${value}`}/)
assert.match(projectSpaceSource, /openLevel1Insertion\('business', record\.stableId \|\| record\.id\)/)
assert.doesNotMatch(projectSpaceSource, /businessStages\[0\]/)
assert.match(projectSpaceSource, /renameLevel1BusinessNode/)
assert.match(projectSpaceSource, /reorderLevel1BusinessNodes/)
```

- [ ] **Step 2: 运行并确认 RED**

Run: `npm run verify:level1-plan-governance`

Expected: FAIL，因为目前顶部按钮固定选择第一个业务阶段，树表没有 SPM 阶段级新增按钮，也没有新治理路径的动态节点改名。

- [ ] **Step 3: 增加纯改名函数**

在 `src/lib/level1PlanRules.ts` 增加不可变更新函数：

```ts
export type RenameLevel1BusinessNodeResult =
  | { ok: true; tasks: Level1PlanTask[]; task: Level1PlanTask; parent: Level1PlanTask }
  | { ok: false; code: 'target-missing' | 'invalid-name' | 'duplicate-name'; message: string }

export const renameLevel1BusinessNode = (
  tasks: readonly Level1PlanTask[],
  input: { projectType: string; projectName: string; taskStableId: string; taskName: string },
): RenameLevel1BusinessNodeResult => {
  const target = tasks.find(task => (task.stableId || task.id) === input.taskStableId)
  const parent = target?.parentId ? tasks.find(task => task.id === target.parentId) : undefined
  if (!target || target.nodeKind !== 'business-period' || target.source !== 'custom') {
    return { ok: false, code: 'target-missing', message: '只能修改动态业务节点' }
  }
  const taskName = input.taskName.trim()
  const valid = input.projectType === 'tOS版本项目'
    ? validateTosBusinessVersionName(input.projectName, taskName)
    : { valid: /^MR\d+$/.test(taskName), message: 'MR号格式必须为MR+数字' }
  if (!valid.valid) return { ok: false, code: 'invalid-name', message: valid.message }
  if (tasks.some(task => task !== target && task.parentId === target.parentId && task.taskName === taskName)) {
    return { ok: false, code: 'duplicate-name', message: '同一阶段内已存在相同节点名称' }
  }
  if (!parent) return { ok: false, code: 'target-missing', message: '动态节点所属阶段不存在' }
  const renamedTask = { ...target, taskName }
  return {
    ok: true,
    tasks: tasks.map(task => task === target ? renamedTask : { ...task }),
    task: renamedTask,
    parent: { ...parent },
  }
}
```

- [ ] **Step 4: 将新增入口移到每个业务阶段行**

在 `renderTaskTable` 的治理树路径增加：

```tsx
const canAddBusinessChild = (record: any) => {
  const rawStage = getRawTask(record)
  return Boolean(
    rawStage
    && !rawStage.parentId
    && isBusinessStage(selectedProject.type, rawStage)
    && getStructurePermissions(undefined, rawStage).canAddChild
  )
}

{canAddBusinessChild(record) && (
  <Tooltip title="新增动态节点">
    <Button
      type="text"
      size="small"
      aria-label={`添加业务节点 ${value}`}
      icon={<PlusOutlined />}
      onClick={() => openLevel1Insertion('business', record.stableId || record.id)}
    />
  </Tooltip>
)}
```

删除顶部“添加MR里程碑/添加tOS版本”按钮和业务父阶段选择器；系统超级管理员的“添加一级阶段”入口继续保留。

- [ ] **Step 5: 接入改名、删除和经过校验的排序**

- 动态节点行悬浮显示编辑、删除和拖动手柄；
- 编辑弹框保存前重新获取最新作用域、版本和权限，再调用 `renameLevel1BusinessNode`；
- 删除继续二次确认并在处理函数内复核权限；
- 排序确认调用 `reorderLevel1BusinessNodes`，失败时不写 store，并显示 `下一个子节点日期不允许超上一个子节点。`；
- 模板固定节点对 SPM 不显示以上操作；一级阶段日期列始终不出现编辑器。

- [ ] **Step 6: 运行验证并确认 GREEN**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 全部 PASS。

- [ ] **Step 7: 提交结构交互**

```bash
git add src/lib/level1PlanRules.ts src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-level1-plan-governance.mjs
git commit -m "feat: manage level1 business nodes from stage rows"
```

### Task 4: 区分基础信息两行横版与计划模块横版

**Files:**
- Modify: `src/lib/projectSpaceLevel1Rules.ts`
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-level1-plan-governance.mjs`
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`

- [ ] **Step 1: 写入版本选择和开发周期的失败断言**

```js
const versions = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
  { id: 'v3', versionNo: 'V3', status: '修订中' },
]
assert.deepEqual(
  workspaceRules.selectLevel1HorizontalVersions(versions, { surface: 'basic-info', canMaintain: true }).map(item => item.id),
  ['v2'],
)
assert.deepEqual(
  workspaceRules.selectLevel1HorizontalVersions(versions, { surface: 'project-plan', canMaintain: true }).map(item => item.id),
  ['v1', 'v2', 'v3'],
)

assert.equal(rules.sumLevel1StageEstimatedDays([
  { id: '1', parentId: null, estimatedDays: 19 },
  { id: '1.1', parentId: '1', estimatedDays: null },
  { id: '2', parentId: null, estimatedDays: 65 },
  { id: '2.1', parentId: '2', estimatedDays: 10 },
]), 84)
```

增加源码契约：基础信息调用 `renderHorizontalTable('basic-info')`，计划模块调用 `renderHorizontalTable('project-plan')`，业务阶段不渲染工期 Tag。

- [ ] **Step 2: 运行并确认 RED**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
```

Expected: FAIL，因为当前 `renderHorizontalTable` 在基础信息和计划模块复用同一版本集合，并且开发周期对所有投影行求和。

- [ ] **Step 3: 实现纯版本选择器和阶段工期求和**

在 `src/lib/projectSpaceLevel1Rules.ts` 增加：

```ts
export const selectLevel1HorizontalVersions = <Version extends Level1SummaryVersion>(
  versions: readonly Version[],
  options: { surface: 'basic-info' | 'project-plan'; canMaintain: boolean },
): Version[] => {
  if (options.surface === 'project-plan') {
    return getDisplayPlanVersionsForHorizontalPlan(versions, { includeDraft: options.canMaintain })
  }
  return versions
    .filter(version => version.status === '已发布')
    .sort((left, right) => compareLevel1Versions(right, left))
    .slice(0, 1)
}
```

同时从 `@/lib/planVersioning` 导入并复用 `getDisplayPlanVersionsForHorizontalPlan`；基础信息最新发布排序继续使用本文件已有的 `compareLevel1Versions`。

在 `src/lib/level1PlanRules.ts` 增加：

```ts
export const sumLevel1StageEstimatedDays = (
  rows: readonly Pick<Level1PlanViewRow, 'parentId' | 'estimatedDays'>[],
): number | null => sumLevel1EstimatedDays(rows.filter(row => !row.parentId))
```

- [ ] **Step 4: 为横版渲染器增加明确界面参数**

```tsx
const renderHorizontalTable = (surface: 'basic-info' | 'project-plan' = 'project-plan') => {
  const displayVersions = selectLevel1HorizontalVersions(level1SurfaceVersions, {
    surface,
    canMaintain: level1SurfaceCanMaintain,
  })
  // stageGroups 和 actualProjection 只基于 displayVersions 计算
  // devCycle 使用 sumLevel1StageEstimatedDays(vProjection.rows)
}
```

- `renderProjectPlanInfo` 使用 `renderHorizontalTable('basic-info')`；
- 项目空间计划模块使用 `renderHorizontalTable('project-plan')`；
- 基础信息即使用户有修订权限也只显示最新已发布版本行和“实际”行；
- 基础信息的实际行仍按现有权限允许修改最新已发布实际完成时间；
- 计划模块仍显示其原有历史、修订和实际行。

- [ ] **Step 5: 固化阶段表头规则**

```tsx
const dynamicBusinessStage = selectedProject
  ? isBusinessStage(selectedProject.type, stage)
  : false

{!dynamicBusinessStage && (
  <Tag color="blue">{stage.estimatedDays === null ? '-' : `${stage.estimatedDays}天`}</Tag>
)}
```

阶段名称下不得重新显示时间范围；整机上市/生命周期和 tOS 上市迭代/维护不显示工期 Tag。

- [ ] **Step 6: 运行验证并确认 GREEN**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 全部 PASS。

- [ ] **Step 7: 提交横版视图切片**

```bash
git add src/lib/projectSpaceLevel1Rules.ts src/lib/level1PlanRules.ts src/containers/ProjectSpaceContainer.tsx scripts/verify-level1-plan-governance.mjs scripts/verify-level1-flat-milestone-gantt.mjs
git commit -m "feat: separate level1 basic and project horizontal views"
```

### Task 5: 完成一级阶段只读、里程碑点和时间条甘特交互

**Files:**
- Modify: `src/lib/planGanttRules.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`

- [ ] **Step 1: 写入甘特节点类型和只读失败断言**

```js
const ganttRows = ganttRules.buildPlanGanttTasks([
  { id: 'stage', stableId: 'stage', parentId: null, order: 0, taskName: '开发验证阶段', nodeKind: 'stage' },
  { id: 'str5', stableId: 'str5', parentId: 'stage', order: 0, taskName: 'STR5', nodeKind: 'fixed-milestone', planEndDate: '2026-12-15' },
  { id: 'launch', stableId: 'launch', parentId: null, order: 1, taskName: '上市阶段', nodeKind: 'stage' },
  { id: 'mr1', stableId: 'mr1', parentId: 'launch', order: 0, taskName: 'MR1', nodeKind: 'business-period', planStartDate: '2026-12-16', planEndDate: '2027-01-15' },
], { mode: 'hierarchical', editable: true })

assert.deepEqual(
  ganttRows.map(row => [row.id, row.type, row.readonly]),
  [['stage', 'project', true], ['str5', 'milestone', false], ['launch', 'project', true], ['mr1', 'task', false]],
)
assert.equal(ganttRows.find(row => row.id === 'str5').duration, 0)
assert.equal(ganttRows.find(row => row.id === 'mr1').duration, 30)

const unchangedStage = ganttRules.applyPlanGanttDateChange(ganttInput, {
  taskId: 'stage', mode: 'task', startDate: '2026-01-01', endDate: '2026-12-31',
})
assert.strictEqual(unchangedStage, ganttInput)
```

为交互控制器增加：`project` 拖动和 lightbox 均拒绝、里程碑拖动成功、非法时间条拖动返回 `false` 后恢复快照。

- [ ] **Step 2: 运行并确认 RED**

Run: `npm run verify:level1-flat-gantt`

Expected: 新的非包含式时间条工期或回退提示断言失败；一级阶段只读断言必须保持 GREEN。

- [ ] **Step 3: 固化甘特投影和日期写入**

`buildPlanGanttTasks` 必须保持：

```ts
result.push({
  ...stage,
  type: 'project',
  readonly: true,
  start_date: range.startDate,
  end_date: range.endDate,
  duration: range.duration,
})
```

固定节点使用 `type: 'milestone'`、`duration: 0`；动态业务节点使用 `type: 'task'` 和 `getDateDifference(startDate, endDate)`。开始或完成时间缺失时不伪造时间条。

- [ ] **Step 4: 接入统一校验和指定错误提示**

在 `renderGanttChart` 的 `onTaskDateChange` 中：

```ts
const validation = validateLevel1ScheduleDates(next)
if (!validation.valid) {
  void message.error(validation.violations[0]?.message || '计划日期不符合顺序要求')
  return false
}
setEffectiveTasks(next)
return true
```

`createPlanGanttInteractionController` 收到 `false` 后恢复 `start_date`、`end_date` 并调用 `updateTask`。一级阶段不打开 lightbox，不触发任何 store 写入。

- [ ] **Step 5: 运行验证并确认 GREEN**

Run:

```bash
npm run verify:level1-flat-gantt
npm run verify:level1-plan-governance
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 全部 PASS。

- [ ] **Step 6: 提交甘特切片**

```bash
git add src/lib/planGanttRules.ts src/containers/ProjectSpaceContainer.tsx scripts/verify-level1-flat-milestone-gantt.mjs
git commit -m "feat: align level1 milestone and period gantt editing"
```

### Task 6: 完整静态、构建和真实浏览器验收

**Files:**
- Modify: `screenshots/verify-level1-flat-milestone-gantt-browser.mjs`
- Modify only if acceptance finds a defect: files owned by Tasks 1–5

- [ ] **Step 1: 更新浏览器验收场景**

在现有脚本中保留技术项目回归，并先把业务新增帮助函数改为阶段行入口：

```js
const openBusinessInsertion = async (page, parentStage, kind) => {
  await clickAriaButton(page, `添加业务节点 ${parentStage}`)
  const confirmTitle = kind === 'tos' ? '是否添加 tOS 版本？' : '是否添加 MR 里程碑？'
  const nameTitle = kind === 'tos' ? '输入 tOS 版本名称' : '输入 MR 里程碑名称'
  await clickDialogButton(page, confirmTitle, '下一步')
  await page.waitForFunction(title => document.body.innerText.includes(title), { timeout: TIMEOUT }, nameTitle)
}

const readHorizontalStageNames = page => page.$$eval(
  '[aria-label="一级计划横版"] [data-stage-label]',
  nodes => nodes.map(node => node.textContent?.trim() || ''),
)
const readHorizontalRowLabels = page => page.$$eval(
  '[aria-label="一级计划横版"] tbody tr',
  rows => rows.map(row => row.querySelector('td')?.textContent?.trim() || ''),
)
const durationDays = (start, end) => Math.round(
  (new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86_400_000,
)
```

整机场景增加以下断言：

```js
assert.deepEqual(
  await readHorizontalStageNames(page),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市阶段', '生命周期阶段'],
)
await assertHorizontalStageHeader(page, '上市阶段', { dynamic: true })
await assertHorizontalStageHeader(page, '生命周期阶段', { dynamic: true })
const basicRows = await readHorizontalRowLabels(page)
assert.equal(basicRows.length, 2)
assert.match(basicRows[0], /^V\d+/)
assert.equal(basicRows[1], '实际')
await openBusinessInsertion(page, '上市阶段', 'machine')
await replaceAriaInputValue(page, '业务节点名称', 'MR9')
await clickDialogButton(page, '输入 MR 里程碑名称', '确认添加')
assert.ok((await textOf(page, table)).includes('MR9'))
assert.ok(await page.$('.gantt_task_line.pms-gantt-project.pms-gantt-task-readonly'))
assert.ok(await page.$('.gantt_task_line.pms-gantt-milestone'))
assert.ok(await page.$('.gantt_task_line.pms-gantt-task'))
```

tOS 场景使用真实 Mock 项目 `tOS16.3`：

```js
assert.deepEqual(
  await readHorizontalStageNames(page),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市迭代阶段', '维护阶段'],
)
await openBusinessInsertion(page, '维护阶段', 'tos')
await replaceAriaInputValue(page, '业务节点名称', '16.3.0.125')
await clickDialogButton(page, '输入 tOS 版本名称', '确认添加')
assert.ok((await textOf(page, table)).includes('16.3.0.125'))
```

复用现有 `assertTosBusinessNameRejected` 验证 `17.0.0.125` 和 `16.3.0.126`；把脚本内 `inclusiveDays` 及“inclusive”断言全部改成 `durationDays` 和完成减开始语义。再验证同日、倒序和非法拖动均回退并出现指定提示。

- [ ] **Step 2: 运行所有聚焦验证**

Run:

```bash
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
node scripts/verify-plan-versioning.mjs
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
npm run verify:technical-plan
npm run verify:level3-plan
```

Expected: 全部退出码为 `0`。

- [ ] **Step 3: 运行类型、生产构建和差异检查**

Run:

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run build
git diff --check
```

Expected: TypeScript 无错误，Next.js 生产构建成功，差异检查无输出。

- [ ] **Step 4: 运行真实浏览器验收**

Run:

```bash
npm run verify:level1-flat-gantt-browser
```

Expected: 整机、tOS 和技术项目场景全部 PASS；页面控制台没有未处理异常，浏览器脚本保存关键界面截图到既有输出目录。

- [ ] **Step 5: 修复浏览器发现的问题并重跑完整门禁**

任何失败都先按 `superpowers:systematic-debugging` 复现根因，再写失败断言、做最小修复，并完整重跑 Steps 2–4；不得只修改浏览器脚本绕过产品问题。

- [ ] **Step 6: 提交验收脚本和最后修复**

```bash
git add screenshots/verify-level1-flat-milestone-gantt-browser.mjs src/lib/level1PlanRules.ts src/lib/planGanttRules.ts src/lib/projectSpaceLevel1Rules.ts src/data/projectListPlanMocks.ts src/stores/plan.ts src/containers/ProjectListContainer.tsx src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-level1-plan-governance.mjs scripts/verify-level1-flat-milestone-gantt.mjs scripts/verify-plan-versioning.mjs scripts/verify-technical-plan.mjs
git commit -m "test: verify five-stage level1 plan workflows"
```

- [ ] **Step 7: 完成交付前复核**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
git diff origin/dev...HEAD --check
```

Expected: 工作区干净，提交历史按模板/迁移、日期、结构交互、横版、甘特、浏览器验收分层；随后使用 `superpowers:requesting-code-review` 和 `superpowers:verification-before-completion`，再由用户决定是否推送、合并 `dev/master` 和发布 Vercel。
