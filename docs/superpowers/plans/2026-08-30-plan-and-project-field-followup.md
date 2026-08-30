# 一级计划业务节点、MR 版本计划与项目字段调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将整机/tOS 一级计划业务节点新增改为单步且自动编号，补齐 MR 搜索和带边界日期的单元格错误提示，增加“钱九”单项目项目经理 Mock，并让整机、技术项目的新建与项目空间字段严格按已确认顺序和默认显示规则呈现。

**Architecture:** 规则层集中处理业务节点名称、边界日期和权限种子；UI 只消费纯函数结果。项目信息使用共享字段定义和按页面区域拆分的有序键投影，分别驱动新建表单、核心区、计划区和信息分组；保存的字段显示偏好通过 Schema 版本迁移清理已删除键并保留有效选择。既有 MR 聚合、主市场同步、停止发版、1+N 动态计算和一级计划版本快照数据流保持不变。

**Tech Stack:** Next.js 14 App Router、React 18、TypeScript、Ant Design 6、Zustand 4、Node.js 静态/规则验证脚本、Puppeteer/Chrome 浏览器验收。

---

## 0. 实施前基线与文件地图

### 0.1 基线约束

- 开发分支：`codex/mr-version-plan`。
- 规格来源：`docs/superpowers/specs/2026-08-30-plan-and-project-field-followup-design.md`。
- 不清理、不暂存、不覆盖用户已有改动；每个任务提交前先检查 `git status --short`。
- 本计划不授权推送、合并、Vercel 发布或飞书 PRD 更新。
- 不调整 tOS 项目新建/项目空间字段顺序。
- 不改变 MR 聚合资格、停止发版语义、主市场回填或 1+N 算法，只增强错误结构和展示。

### 0.2 预计修改文件

| 文件 | 作用 |
|---|---|
| `src/lib/level1PlanRules.ts` | MR/tOS 业务节点名称校验、下一个默认名称、最终插入校验 |
| `src/containers/ProjectSpaceContainer.tsx` | 单步新增弹窗、规则提示、输入错误展示 |
| `src/types/mrVersionPlan.ts` | 结构化 MR 单元格错误边界字段 |
| `src/lib/mrVersionPlanRules.ts` | tOS 项目 MR 日期上下界错误 |
| `src/lib/mrDateRules.ts` | 联合空间 1+N 与前后版本日期边界错误 |
| `src/components/plans/TosMrVersionPlan.tsx` | tOS 版本模糊搜索及横竖视图共享过滤 |
| `src/components/joint/JointMrVersionPlan.tsx` | 移除错误列，将错误定位到对应日期单元格 |
| `src/components/plans/MrPlanGrid.tsx` | 复用/抽取日期单元格错误内容模式 |
| `src/styles/globals.css` | 搜索框、日期单元格错误图标和滚动层级样式 |
| `src/constants/projectInfoSchema.ts` | 共享字段定义、整机新建/项目空间有序投影、Schema 版本 |
| `src/constants/projectPlanInfoSchema.ts` | 整机项目空间计划区顺序与默认显示 |
| `src/constants/technicalProject.ts` | 技术项目团队字段顺序、必填与“其他” |
| `src/lib/projectInfoRules.ts` | 按 create/space 场景选择有序字段 |
| `src/lib/projectInfoValues.ts` | 新增字段的根字段兼容映射与读写 |
| `src/components/project-info/ProjectInfoModal.tsx` | 整机新建顺序、技术项目前四项编排 |
| `src/components/technical-project/TechnicalProjectCreateFields.tsx` | 技术项目新建剩余字段顺序和必填规则 |
| `src/components/project-info/TargetProjectInformationView.tsx` | 整机项目空间核心字段顺序 |
| `src/components/project-info/ProjectInfoSections.tsx` | 项目空间信息分组按 space 投影渲染 |
| `src/components/technical-project/TechnicalProjectInformationView.tsx` | 技术项目空间核心、基础、团队、交付物顺序 |
| `src/types/app.ts`、`src/types/technicalProject.ts` | 新增团队字段类型 |
| `src/constants/permissions.ts` | Mock 用户“钱九” |
| `src/stores/project.ts` | “钱九”目标项目可见范围 |
| `src/stores/permission.ts` | 仅目标项目的项目经理角色种子 |
| `scripts/verify-level1-flat-milestone-gantt.mjs` | 一级计划名称规则和单步弹窗静态契约 |
| `scripts/verify-mr-version-plan.mjs` | MR 搜索、结构化错误、联合空间错误展示契约 |
| `scripts/verify-project-field-order-followup.mjs` | 四套字段顺序、必填、默认显示和迁移行为 |
| `scripts/verify-project-role-sync.mjs` | “钱九”角色隔离行为 |
| `scripts/verify-project-space-permission-matrix.mjs` | 三类用户权限矩阵 |
| `screenshots/verify-level1-flat-milestone-gantt-browser.mjs` | 整机/tOS 单步弹窗真实浏览器验收 |
| `screenshots/verify-mr-version-plan-browser.mjs` | 搜索、错误单元格、无错误列验收 |
| `screenshots/verify-workbench-technical-project-redesign.mjs` | 新建/项目空间字段和“钱九”验收 |
| `screenshots/mr-version-plan/*.png` | 更新后的关键验收截图 |
| `package.json` | 新增精确字段顺序验证命令 |

## Task 1: 建立一级计划业务节点名称规则

**Files:**
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `src/lib/level1PlanRules.ts`

- [ ] **Step 1: 先写失败的名称规则验证**

在 `scripts/verify-level1-flat-milestone-gantt.mjs` 增加行为断言，覆盖：

```js
assert.equal(level1Rules.getNextMachineMrBusinessName([]), 'MR1')
assert.equal(level1Rules.getNextMachineMrBusinessName([
  { taskName: 'MR1' }, { taskName: 'MR3' }, { taskName: 'STR5' },
]), 'MR4')
for (const name of ['MR1', 'MR2', 'MR10']) {
  assert.equal(level1Rules.validateMachineMrBusinessName(name).valid, true)
}
for (const name of ['MR0', 'MR01', 'MR001', 'MR-1', 'mr1']) {
  assert.equal(level1Rules.validateMachineMrBusinessName(name).valid, false)
}
assert.equal(level1Rules.getNextTosBusinessVersionName('tOS17.0', []), '17.0.0.100')
assert.equal(level1Rules.getNextTosBusinessVersionName('tOS17.0', [
  { taskName: '17.0.0.100' }, { taskName: '17.0.0.110' },
]), '17.0.0.115')
```

同时把旧的“MR 至少从 MR4 开始”和“tOS 默认 `.005`”断言改为新规则，并增加插入/重命名均拒绝 `MR0`、`MR01` 的断言。

- [ ] **Step 2: 运行验证并确认按预期失败**

Run:

```bash
npm run verify:level1-flat-gantt
```

Expected: FAIL，提示 `getNextMachineMrBusinessName` / `getNextTosBusinessVersionName` 尚未导出，或旧 MR4/`.005` 断言不匹配。

- [ ] **Step 3: 实现共享纯函数并复用到插入/重命名**

在 `src/lib/level1PlanRules.ts` 增加：

```ts
export const validateMachineMrBusinessName = (taskName: string) => {
  const value = taskName.trim()
  const valid = /^MR[1-9]\d*$/.test(value)
  return {
    valid,
    message: valid ? '' : '格式：MR+正整数，不允许前导0；示例：MR1、MR2。',
  }
}

export const getNextMachineMrBusinessName = (
  tasks: readonly Pick<Level1PlanTask, 'taskName'>[],
) => {
  const maximum = tasks.reduce((result, task) => {
    const match = /^MR([1-9]\d*)$/.exec(task.taskName.trim())
    return match ? Math.max(result, Number(match[1])) : result
  }, 0)
  return `MR${maximum + 1}`
}

export const getNextTosBusinessVersionName = (
  projectName: string,
  tasks: readonly Pick<Level1PlanTask, 'taskName'>[],
) => {
  const parsed = parseTosProjectVersionPrefix(projectName)
  if (!parsed) return ''
  const prefix = `${parsed.prefix}.`
  const maximum = tasks.reduce((result, task) => {
    const value = task.taskName.trim()
    const suffix = value.startsWith(prefix) ? value.slice(prefix.length) : ''
    return /^\d{3}$/.test(suffix) ? Math.max(result, Number(suffix)) : result
  }, 95)
  return `${parsed.prefix}.${String(maximum + 5).padStart(3, '0')}`
}
```

实现时还必须：

- `insertLevel1BusinessNode` 和 `renameLevel1BusinessNode` 统一调用 `validateMachineMrBusinessName`；
- `insertNextMachineMrMilestone` 改为使用 `getNextMachineMrBusinessName`，不再从 3 起算；
- tOS 默认值只统计同项目合法前缀、三位尾号，返回值仍由 `validateTosBusinessVersionName` 在提交时复验；
- 重复名称仍执行现有全计划/同父阶段检查，不被默认名称函数替代。

- [ ] **Step 4: 重新运行验证并确认通过**

Run:

```bash
npm run verify:level1-flat-gantt
```

Expected: PASS，首个 MR 为 MR1、首个 tOS 尾号为 100、缺号时按最大值继续、非法 MR 被拒绝。

- [ ] **Step 5: 提交规则层变更**

```bash
git add src/lib/level1PlanRules.ts scripts/verify-level1-flat-milestone-gantt.mjs
git commit -m "feat: tighten level1 business node names"
```

## Task 2: 将业务节点新增改为单步弹窗

**Files:**
- Modify: `scripts/verify-level1-flat-milestone-gantt.mjs`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `screenshots/verify-level1-flat-milestone-gantt-browser.mjs`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: 写单步弹窗失败契约**

静态验证要求：

```js
assert.doesNotMatch(projectSpaceSource, /phase:\s*'confirm'\s*\|\s*'name'/)
assert.doesNotMatch(projectSpaceSource, /是否添加 MR 里程碑|是否添加 tOS 版本|下一步/)
assert.match(projectSpaceSource, /格式：MR\+正整数，不允许前导0；示例：MR1、MR2。/)
assert.match(projectSpaceSource, /getNextMachineMrBusinessName/)
assert.match(projectSpaceSource, /getNextTosBusinessVersionName/)
```

浏览器脚本增加整机和 tOS 两个场景：点击允许阶段的加号后，首次出现的 Modal 标题直接为“输入 MR 里程碑名称”或“输入 tOS 版本名称”，不存在“下一步”。

- [ ] **Step 2: 运行静态验证并确认失败**

Run:

```bash
npm run verify:level1-flat-gantt
```

Expected: FAIL，旧 `phase`、确认标题和“下一步”仍存在。

- [ ] **Step 3: 重构弹窗状态和打开逻辑**

将状态改为：

```ts
type Level1InsertionDialog = {
  kind: 'business' | 'stage' | 'child'
  token: Level1StructureScopeToken
  taskName: string
  error: string
}
```

`openLevel1Insertion('business', parentStableId)` 直接：

- 整机调用 `getNextMachineMrBusinessName(effectiveTasks)`；
- tOS 调用 `getNextTosBusinessVersionName(selectedProject.name, effectiveTasks)`；
- 不写计划日期，不变更任务集合；
- 每次打开重新计算默认值，取消只关闭 Modal。

- [ ] **Step 4: 实现规则提示、输入错误和提交复验**

Modal 顶部增加 `Alert` 或等价规则说明：

```tsx
<Alert
  type="info"
  showIcon
  title={isWholeMachineProject
    ? '格式：MR+正整数，不允许前导0；示例：MR1、MR2。'
    : `格式：${tosPrefix}.XXX，XXX为三位数字，末位必须为0或5。`}
/>
```

输入框：

- `status={error ? 'error' : undefined}`；
- 输入变化时清空旧错误；
- 下方展示当前明确错误；
- 确认时重新取得最新 mutation context，重新校验权限、父阶段、名称格式、重复名称和现有日期顺序；
- 失败保持 Modal 打开；成功沿用序号重排、写 Store、历史记录和成功提示。

普通“添加一级阶段/子节点”流程不改变。

- [ ] **Step 5: 跑静态验证**

Run:

```bash
npm run verify:level1-flat-gantt
npm run verify:level1-plan-governance
```

Expected: PASS。

- [ ] **Step 6: 跑真实浏览器单步弹窗场景**

Run:

```bash
PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:level1-flat-gantt-browser
```

Expected:

- 整机首次预填 MR1 或当前最大值 + 1；
- 输入 MR01 时红框且无法提交；
- tOS 首次预填 `.100` 或当前最大值 + 5；
- 两类页面都没有第一步确认框；
- 浏览器 console/page/request/HTTP 错误为 0。

- [ ] **Step 7: 提交单步弹窗变更**

```bash
git add src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-level1-flat-milestone-gantt.mjs screenshots/verify-level1-flat-milestone-gantt-browser.mjs
git commit -m "feat: streamline level1 business node creation"
```

## Task 3: 将 MR 日期错误改为结构化边界错误

**Files:**
- Modify: `src/types/mrVersionPlan.ts`
- Modify: `src/lib/mrVersionPlanRules.ts`
- Modify: `src/lib/mrDateRules.ts`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: 写边界日期失败验证**

为 `validateTosMrInstanceDates` 和 `validateJointMachineRows` 增加精确断言：

```js
assert.deepEqual(error, {
  rowKey: 'tos-1::17.0.0.100',
  activityId: 'collect',
  activityName: '修改点收集开始时间',
  message: '修改点收集开始时间不能早于一级计划中的计划开始时间（2026-09-10）',
  boundaryDate: '2026-09-10',
  boundaryType: 'minimum',
})
```

至少覆盖：

1. tOS 修改点收集开始时间最小边界；
2. tOS OTA 最大边界；
3. MP 入库截止 tOS 最大边界；
4. 1+N=1 与 tOS 日期相等边界；
5. 1+N>1 上一类型日期 + 7 天的动态最小边界；
6. 下一 tOS 版本对应活动的最大边界；
7. 同一单元格同时存在上下边界时产生两条独立且可去重的错误。

- [ ] **Step 2: 运行 MR 规则验证并确认失败**

Run:

```bash
npm run verify:mr-version-plan
```

Expected: FAIL，当前错误没有 `boundaryDate` / `boundaryType`，文案没有实际日期。

- [ ] **Step 3: 扩展错误类型**

在 `src/types/mrVersionPlan.ts`：

```ts
export type MrBoundaryType = 'minimum' | 'maximum' | 'equality'

export interface MrCellError {
  rowKey: string
  activityId: string
  activityName: string
  message: string
  boundaryDate?: string
  boundaryType?: MrBoundaryType
}
```

格式错误允许没有边界字段；所有比较型错误必须带边界字段。

- [ ] **Step 4: 实现统一错误构造函数**

在规则层增加类似：

```ts
const makeBoundaryError = (
  base: Omit<MrCellError, 'message' | 'boundaryDate' | 'boundaryType'>,
  message: string,
  boundaryDate: string,
  boundaryType: MrBoundaryType,
): MrCellError => ({
  ...base,
  message: `${message}（${boundaryDate}）`,
  boundaryDate,
  boundaryType,
})
```

动态计算要求：

- 多个“上一 1+N 类型”行时，最小允许日期取所有 `上一日期 + 7 天` 中最晚的一天；
- 下一 tOS 版本限制取该对应活动的日期；现有业务要求“测试开始时间”为统一上限的场景继续使用测试开始时间；
- 上下边界分别判断并分别产生错误，不能用一个 `if (lower || upper)` 合成模糊文案；
- `groupMrErrorsByRow` 继续按 row/activity/message 去重，不吞掉不同边界日期。

- [ ] **Step 5: 跑 MR 规则验证并确认通过**

Run:

```bash
npm run verify:mr-version-plan
```

Expected: PASS，所有比较错误含真实边界日期和正确边界类型。

- [ ] **Step 6: 提交结构化错误变更**

```bash
git add src/types/mrVersionPlan.ts src/lib/mrVersionPlanRules.ts src/lib/mrDateRules.ts scripts/verify-mr-version-plan.mjs
git commit -m "feat: include dates in mr validation errors"
```

## Task 4: 为 tOS 项目 MR 版本计划增加模糊搜索

**Files:**
- Modify: `src/components/plans/TosMrVersionPlan.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-mr-version-plan.mjs`
- Modify: `screenshots/verify-mr-version-plan-browser.mjs`

- [ ] **Step 1: 写搜索失败契约和浏览器步骤**

静态契约要求：

- 存在临时 `versionQuery` state；
- `visibleInstances` 从 `sortedInstances` 派生；
- `candidates` 仍使用全部 `sortedInstances`，不受搜索影响；
- 搜索输入在“新增tOS版本号”按钮左侧；
- 横竖视图都消费同一 `rows`。

浏览器脚本在已有两个版本实例上：输入 `145` 后仅显示 `16.3.0.145`，切换横版仍只显示该版本；清空后全部恢复；打开新增 Modal 时已添加版本仍禁选。

- [ ] **Step 2: 运行验证并确认失败**

Run:

```bash
npm run verify:mr-version-plan
```

Expected: FAIL，页面不存在版本搜索状态和输入框。

- [ ] **Step 3: 实现展示过滤**

在 `TosMrVersionPlan.tsx` 增加：

```ts
const [versionQuery, setVersionQuery] = useState('')
const visibleInstances = useMemo(() => {
  const query = versionQuery.trim().toLocaleLowerCase()
  return query
    ? sortedInstances.filter(instance => instance.tosVersion.toLocaleLowerCase().includes(query))
    : sortedInstances
}, [sortedInstances, versionQuery])
```

数据依赖规则：

- `candidates`、重复校验、编辑权限和 Store 更新仍使用全部实例；
- `rows`、当前可见错误和空状态使用 `visibleInstances`；
- 无匹配时显示“未找到匹配的tOS版本号”；
- 搜索不写 Zustand、不写 localStorage；
- 输入框使用 `Input.Search allowClear aria-label="搜索tOS版本号"`，位于新增按钮左侧；只读用户也能搜索。

- [ ] **Step 4: 跑静态和浏览器验证**

Run:

```bash
npm run verify:mr-version-plan
PMS_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3004 PMS_ASSERT_SCREENSHOTS_CLEAN=1 npm run verify:mr-version-plan-browser
```

Expected: PASS，模糊过滤、视图切换、清空恢复和新增候选隔离全部成立。

- [ ] **Step 5: 提交搜索变更**

```bash
git add src/components/plans/TosMrVersionPlan.tsx src/styles/globals.css scripts/verify-mr-version-plan.mjs screenshots/verify-mr-version-plan-browser.mjs
git commit -m "feat: search tos mr version instances"
```

## Task 5: 将联合空间错误移入日期单元格

**Files:**
- Modify: `src/components/plans/MrPlanGrid.tsx`
- Modify: `src/components/joint/JointMrVersionPlan.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-mr-version-plan.mjs`
- Modify: `screenshots/verify-mr-version-plan-browser.mjs`
- Update: `screenshots/mr-version-plan/joint-invalid.png`
- Update: `screenshots/mr-version-plan/joint-valid.png`

- [ ] **Step 1: 写联合空间失败契约**

要求：

```js
assert.doesNotMatch(jointSource, /title:\s*['"]错误提示['"]/)
assert.doesNotMatch(jointSource, /data-mr-fixed-error-cell/)
assert.match(jointSource, /pms-mr-cell-error-icon/)
assert.match(jointSource, /tabIndex=\{0\}/)
```

增加行为验证：按 `rowKey + activityId` 获取错误；同单元格多条消息去重；tOS 只读参考行也能接收 `validateTosMrInstanceDates` 的错误。

- [ ] **Step 2: 运行验证并确认失败**

Run:

```bash
npm run verify:mr-version-plan
```

Expected: FAIL，当前仍有固定“错误提示”列，tOS 参考行未关联错误。

- [ ] **Step 3: 抽取可复用单元格错误内容**

在 `MrPlanGrid.tsx` 导出一个只负责呈现的组件或 helper：

```tsx
<MrDateCellContent messages={messages} readOnly={readOnly}>
  {dateControlOrText}
</MrDateCellContent>
```

组件要求：

- 无错误时不渲染图标；
- 有错误时包裹 `pms-mr-invalid-cell-content`；
- 图标 `tabIndex={0}`、`role="img"`、有包含错误数量的 `aria-label`；
- Tooltip 逐条显示去重后的消息；
- 只读文本和 DatePicker 均可使用。

- [ ] **Step 4: 构建联合空间机器行和 tOS 行错误映射**

机器行继续使用 `validateJointMachineRows`。tOS 参考行按项目构建最新已发布一级计划候选，使用：

```ts
selectTosMrVersionCandidates(...)
resolveTosMrInstanceDateAccess(...)
validateTosMrInstanceDates(...)
```

将两类错误合并为：

```ts
Record<string, Record<string, string[]>>
// rowKey -> activityId -> deduped messages
```

不在组件中复制边界文案。

- [ ] **Step 5: 重写日期列并删除错误列**

- `onCell` 对机器行和 tOS 参考行都根据当前 activity 错误设置 `pms-mr-invalid-cell`；
- `render` 内部用共享错误内容组件包住只读值或 DatePicker；
- 删除整个“错误提示”列、固定右列宽和 `data-mr-fixed-error-cell`；
- 保留固定左列，确认水平滚动时错误图标不与固定列重叠；
- N/A 行仍显示 `/`，无日期控件。

- [ ] **Step 6: 跑静态与真实浏览器验证并检查截图**

Run:

```bash
npm run verify:mr-version-plan
PMS_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3004 PMS_ASSERT_SCREENSHOTS_CLEAN=1 npm run verify:mr-version-plan-browser
```

人工检查：

- 联合空间最后一列不是“错误提示”；
- 错误日期本身红框，图标在对应日期单元格右侧；
- Tooltip 文案带实际日期；
- tOS 只读错误与机器可编辑错误样式一致；
- 固定列、日期输入和错误图标在水平滚动时不重叠。

- [ ] **Step 7: 提交单元格错误变更**

```bash
git add src/components/plans/MrPlanGrid.tsx src/components/joint/JointMrVersionPlan.tsx src/styles/globals.css scripts/verify-mr-version-plan.mjs screenshots/verify-mr-version-plan-browser.mjs screenshots/mr-version-plan/joint-invalid.png screenshots/mr-version-plan/joint-valid.png
git commit -m "feat: localize joint mr date errors"
```

## Task 6: 建立精确字段 Schema 和页面区域投影

**Files:**
- Create: `scripts/verify-project-field-order-followup.mjs`
- Modify: `package.json`
- Modify: `src/constants/projectInfoSchema.ts`
- Modify: `src/constants/projectPlanInfoSchema.ts`
- Modify: `src/constants/technicalProject.ts`
- Modify: `src/lib/projectInfoRules.ts`
- Modify: `src/lib/projectInfoValues.ts`
- Modify: `src/lib/projectFieldPreferences.ts`
- Modify: `src/types/app.ts`
- Modify: `src/types/technicalProject.ts`

- [ ] **Step 1: 创建四套精确字段失败验证**

新增 `scripts/verify-project-field-order-followup.mjs`，通过 TypeScript 模块加载器按键精确验证：

```js
assert.deepEqual(machineCreateKeys, [
  'firstSaleTosVersion', 'status', 'versionType', 'softwareProjectLevel',
  'isFirstLaunchProject', 'productSeries', 'researchMode', 'developmentMode',
  'dimensionUpgradeStrategy', 'systemType', 'kernelVersion', 'androidMajorUpgrade',
  'modelCategory', 'confidentialityLevel', 'chipCode', 'chipModel', 'chipPlatform',
  'memorySize', 'startingRam', 'isTwoStage', 'isOutsourcedMini', 'wholeMachinePd',
  'pcbaSheet', 'shippingCountrySheet', 'keyComponentsSheet', 'jiraProjects',
  'machineSpm', 'machineSpp', 'machineCmo', 'machineSoftwareSe',
  'machineQualityRepresentative', 'machineDevelopmentRepresentative',
  'machineTestRepresentative', 'machineOther',
])
```

另外逐项验证设计文档中的：

- 整机项目空间 53 项完整顺序和默认显示；
- 技术项目新建 22 项完整顺序和必填性；
- 技术项目空间 28 项完整顺序且全部默认显示；
- `目标市场`、`上市时间`、`machineUx` 不在整机新建/项目空间投影；
- `禁止生产时间`、`测试代表` 各出现一次；
- `主板名`、`产品类型` 存在于整机项目空间设置且默认不显示；
- `项目名`、`安卓版本`、`基线名称` 等默认隐藏字段仍存在；
- tOS 项目字段数组顺序未改变。

在 `package.json` 增加：

```json
"verify:project-field-order": "node scripts/verify-project-field-order-followup.mjs"
```

- [ ] **Step 2: 运行新验证并确认失败**

Run:

```bash
npm run verify:project-field-order
```

Expected: FAIL，当前字段顺序、必填、默认显示和缺少字段均与确认清单不一致。

- [ ] **Step 3: 将字段定义与页面顺序解耦**

在 `projectInfoSchema.ts` 保留共享定义，新增只读有序键投影：

```ts
export const MACHINE_PROJECT_CREATE_FIELD_KEYS = [...] as const
export const MACHINE_PROJECT_SPACE_CORE_FIELD_KEYS = [...] as const
export const MACHINE_PROJECT_SPACE_INFO_FIELD_KEYS = [...] as const
export const TECHNICAL_PROJECT_CREATE_FIELD_KEYS = [...] as const
export const TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS = [...] as const
export const TECHNICAL_PROJECT_SPACE_BASIC_FIELD_KEYS = [...] as const
```

同时在 `projectPlanInfoSchema.ts` 定义机器空间计划区 8-14 的确切顺序：

```ts
[
  'isMadaControlled', 'isSimLocked', 'googleLaunchDate',
  'isCancelPaused', 'cancelPauseDate', 'buildOption', 'buildMarket',
]
```

总顺序验证使用：核心 1-7 + 计划 8-14 + 信息 15-53。

技术项目总顺序验证使用：核心 1-10 + 计划标记 11 + 基础 12-15 + 团队 16-22 + 交付物 23-28。

- [ ] **Step 4: 修正定义元数据和新增键**

必须按设计修正：

- 整机 `dimensionUpgradeStrategy` 标签改为“升级策略”，新建非必填；
- `chipCode`、`memorySize`、`isTwoStage` 新建必填；
- 整机 PD/PCBA/出货国家/关键器件/JIRA 新建非必填；
- `machineSpm` 新建必填；
- 增加 `machineQualityRepresentative`、`machineOther`；
- 删除页面投影中的 `machineUx`，底层旧值仍可读取；
- 技术项目 `projectValue`、`technicalProjectManager` 新建必填；
- 增加 `technicalOther`；
- `charter报告` 标签统一为 `Charter报告`；
- 项目空间 `productionForbiddenDate` 默认显示；
- 所有项目空间确认显示字段的 `defaultVisible` / `hideable` 与设计一致。

更新 `projectInfoValues.ts` 的根字段兼容映射，让新字段从 `fieldValues` 和现有根字段安全读写；更新 TypeScript 类型，不删除底层 `targetMarkets` / `launchDate` 属性。

- [ ] **Step 5: 升级字段显示偏好并验证删除键清理**

- `PROJECT_INFO_SCHEMA_VERSION` 增加 1；
- `reconcileVisibleFieldKeys` 继续过滤不存在于新投影的 `目标市场/上市时间/UX` 键；
- 旧偏好中的其他有效键保留；
- 新增且默认显示的字段通过 `introducedInSchemaVersion` 自动加入旧偏好；
- 默认隐藏的主板名、产品类型不自动加入，但仍出现在字段设置。

- [ ] **Step 6: 跑字段与偏好规则验证**

Run:

```bash
npm run verify:project-field-order
node scripts/verify-project-field-preferences.mjs
node scripts/verify-project-info-matrix-refresh.mjs
node scripts/verify-project-info-followup-adjustments.mjs
```

Expected: PASS；若旧矩阵断言引用过期顺序，更新为新业务清单，但保留 tOS 和字段偏好既有回归断言。

- [ ] **Step 7: 提交 Schema 变更**

```bash
git add package.json src/constants/projectInfoSchema.ts src/constants/projectPlanInfoSchema.ts src/constants/technicalProject.ts src/lib/projectInfoRules.ts src/lib/projectInfoValues.ts src/lib/projectFieldPreferences.ts src/types/app.ts src/types/technicalProject.ts scripts/verify-project-field-order-followup.mjs scripts/verify-project-field-preferences.mjs scripts/verify-project-info-matrix-refresh.mjs scripts/verify-project-info-followup-adjustments.mjs
git commit -m "feat: define ordered project field surfaces"
```

## Task 7: 按确认顺序重排整机和技术项目新建表单

**Files:**
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/technical-project/TechnicalProjectCreateFields.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-project-field-order-followup.mjs`
- Modify: `scripts/verify-technical-project.mjs`
- Modify: `screenshots/verify-workbench-technical-project-redesign.mjs`

- [ ] **Step 1: 写表单渲染失败契约**

验证不只检查数组，还检查两个页面均由 create 投影渲染：

- 整机业务字段按 34 项顺序，无重复 `Form.Item`；
- 技术项目顶部依次为项目分类、技术赛道、子项目名称、项目状态；
- 技术项目后续依次为 TMG、子领域、项目价值、项目年份、前置项目；
- 技术项目经理显示必填；
- “其他”在标准化代表后；
- 交付物按项目KPI、概设、Charter、PDCP、TDCP、EDCP。

保留 IPM 项目选择能力：候选项目选择控件作为来源选择器，不计入业务字段清单；选中后自动回填项目分类、技术赛道、子项目名称和项目状态。

- [ ] **Step 2: 运行验证并确认失败**

Run:

```bash
npm run verify:project-field-order
npm run verify:technical-project
```

Expected: FAIL，当前通用字段块和技术组件分段导致顺序不一致，技术项目经理不是必填。

- [ ] **Step 3: 用 create 投影驱动整机表单**

在 `ProjectInfoModal.tsx`：

- IPM 来源选择器保持在业务字段区域上方，选择后再展示确认清单字段；
- 整机 `status` 进入 create 投影的第 2 位，不再由通用块提前渲染；
- `readOnly` 字段仍展示禁用控件，不参与必填校验；
- `requiredOnCreate` 驱动规则；
- 条件字段不改变确认顺序：不满足条件时隐藏，满足时回到其固定序号；
- 不渲染 UX、目标市场和上市时间。

- [ ] **Step 4: 重排技术项目表单**

将技术项目专用头部和 `TechnicalProjectCreateFields` 组合为一个确定顺序：

- 来源选择后，前四项按确认顺序展示；
- 项目分类、技术赛道、子项目名称、项目状态为来源快照，不要求用户二次填写；
- 项目价值与年份均必填且顺序为价值在前、年份在后；
- 技术项目负责人和经理均必填；
- `TECHNICAL_TEAM_FIELDS` 加入“其他”，只出现一次测试代表；
- 提交 payload、草稿恢复、编辑回填和角色同步包含新增字段；
- 失败读取草稿/枚举时继续使用现有保护，不绕过 edit guard。

- [ ] **Step 5: 跑规则与浏览器验收**

Run:

```bash
npm run verify:project-field-order
npm run verify:technical-project
node scripts/verify-project-creation-draft.mjs
PMS_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:redesign-browser
```

Expected: PASS；浏览器按 DOM/可见标签顺序逐项断言，技术项目经理空值阻止提交，默认/只读字段不误报必填。

- [ ] **Step 6: 提交新建表单变更**

```bash
git add src/components/project-info/ProjectInfoModal.tsx src/components/technical-project/TechnicalProjectCreateFields.tsx src/styles/globals.css scripts/verify-project-field-order-followup.mjs scripts/verify-technical-project.mjs screenshots/verify-workbench-technical-project-redesign.mjs
git commit -m "feat: align project creation field order"
```

## Task 8: 按确认顺序重排项目空间并保留字段设置

**Files:**
- Modify: `src/components/project-info/TargetProjectInformationView.tsx`
- Modify: `src/components/project-info/ProjectInfoSections.tsx`
- Modify: `src/components/technical-project/TechnicalProjectInformationView.tsx`
- Modify: `src/components/project-info/FieldVisibilityPicker.tsx`（仅在迁移后需显示新字段时）
- Modify: `scripts/verify-project-field-order-followup.mjs`
- Modify: `scripts/verify-project-info-matrix-refresh.mjs`
- Modify: `scripts/verify-technical-project.mjs`
- Modify: `screenshots/verify-workbench-technical-project-redesign.mjs`

- [ ] **Step 1: 写项目空间完整顺序失败契约**

脚本拼接各页面区域实际 key 并精确断言：

- 整机：核心 1-7 → 计划 8-14 → 基础/扩展/团队 15-53；
- 技术：核心 1-10 → 计划 11 → 基础 12-15 → 团队 16-22 → 交付物 23-28；
- 整机核心不再重复“项目名称/项目分类”，标题仍显示项目名；
- 技术核心不再重复项目名，TDT/子项目名称在第 10 位；
- 产品类型、主板名在字段设置可选且默认隐藏；
- 目标市场、上市时间、UX 不在字段设置；
- 禁止生产时间只出现一次且默认显示。

- [ ] **Step 2: 运行验证并确认失败**

Run:

```bash
npm run verify:project-field-order
node scripts/verify-project-info-matrix-refresh.mjs
npm run verify:technical-project
```

Expected: FAIL，当前核心区顺序、计划区顺序和技术基础区均未满足清单。

- [ ] **Step 3: 重排整机项目空间**

`TargetProjectInformationView.tsx` 核心区严格为：

```ts
['brand', 'productLine', 'marketName', 'firstSaleTosVersion', 'status', 'healthStatus', 'currentNode']
```

要求：

- 项目名仅由 Frame 标题显示，不占核心字段序号；
- “项目分类”不在确认清单，移出核心字段；
- 计划区按 Task 6 的 7 项投影渲染；
- `ProjectInfoSections` 调用 space 投影，基础从当前 tOS 版本开始；
- 读取值仍通过 `getProjectInfoValue`，不破坏旧 Mock。

- [ ] **Step 4: 重排技术项目空间**

`TechnicalProjectInformationView.tsx`：

- 核心区为项目分类、技术赛道、TMG及技术领域、子领域、项目状态、项目阶段、项目年份、项目价值、前置项目、TDT和子项目名称；
- “计划”保留现有 `TechnicalPlanSummary`，位置紧跟核心区；
- 基础信息展示核心价值、开发模式、首导tOS版本、首导整机产品项目；
- 团队按负责人、经理、测试、质量、产品、标准化、其他；
- 交付物按 6 项确认顺序；
- 子项目 TAB、待配置状态和计划编辑权限不变；
- 所有 28 项默认显示，字段设置功能继续按现有能力工作。

- [ ] **Step 5: 验证偏好迁移和真实页面**

Run:

```bash
npm run verify:project-field-order
node scripts/verify-project-field-preferences.mjs
node scripts/verify-project-info-matrix-refresh.mjs
npm run verify:technical-project
PMS_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:redesign-browser
```

浏览器检查：

- 新用户默认显示顺序正确；
- 旧 localStorage 偏好中的目标市场/上市时间/UX 被清理；
- 打开字段设置可找到产品类型和主板名，勾选后按固定顺序出现；
- 刷新页面后有效字段选择保留；
- 技术项目 28 项无缺失、无重复。

- [ ] **Step 6: 提交项目空间变更**

```bash
git add src/components/project-info/TargetProjectInformationView.tsx src/components/project-info/ProjectInfoSections.tsx src/components/technical-project/TechnicalProjectInformationView.tsx src/components/project-info/FieldVisibilityPicker.tsx scripts/verify-project-field-order-followup.mjs scripts/verify-project-info-matrix-refresh.mjs scripts/verify-technical-project.mjs screenshots/verify-workbench-technical-project-redesign.mjs
git commit -m "feat: align project space field order"
```

## Task 9: 增加“钱九”单项目项目经理 Mock

**Files:**
- Modify: `src/constants/permissions.ts`
- Modify: `src/stores/project.ts`
- Modify: `src/stores/permission.ts`
- Modify: `scripts/verify-project-role-sync.mjs`
- Modify: `scripts/verify-project-space-permission-matrix.mjs`
- Modify: `screenshots/verify-workbench-technical-project-redesign.mjs`

- [ ] **Step 1: 写权限隔离失败验证**

断言：

```js
assert.equal(ALL_USERS.includes('钱九'), true)
assert.equal(INITIAL_PROJECT_MEMBER_MAP['1'].includes('钱九'), true)
assert.equal(rolesByProject['1'].find(role => role.name === '项目经理').members.includes('钱九'), true)
assert.equal(rolesByProject['2'].some(role => role.members.includes('钱九')), false)
assert.equal(globalRoles.some(role => role.members.includes('钱九')), false)
```

权限矩阵验证：

- 张三：目标项目中保持全局管理员能力；
- 钱九：项目 `1` 具有现有项目经理角色权限；
- 钱九：其他项目没有项目经理/系统管理员/全局权限；
- 李四：保持普通成员权限，不能获得一级计划维护和角色管理能力。

- [ ] **Step 2: 运行权限验证并确认失败**

Run:

```bash
npm run verify:project-role-sync
node scripts/verify-project-space-permission-matrix.mjs
```

Expected: FAIL，“钱九”尚未出现在用户、成员和角色种子中。

- [ ] **Step 3: 实现项目级种子，不污染默认角色**

- `ALL_USERS` 追加“钱九”；
- `INITIAL_PROJECT_MEMBER_MAP['1']` 追加“钱九”；
- 不修改 `DEFAULT_ROLE_MEMBERS['项目经理']`；
- 在 `buildInitialPerProject` 对项目 `id === '1'` 的项目经理角色做明确项目级 override：

```ts
const withProjectSpecificMockMembers = (projectId: string, roles: Role[]) => (
  projectId === '1'
    ? roles.map(role => role.name === '项目经理'
      ? { ...role, members: [...new Set([...role.members, '钱九'])] }
      : role)
    : roles
)
```

- 不加入管理组、系统管理员或任何技术/tOS 固定角色；
- 保持持久化角色清洗和既有用户自定义角色行为。

- [ ] **Step 4: 跑静态权限与浏览器验收**

Run:

```bash
npm run verify:project-role-sync
node scripts/verify-project-space-permission-matrix.mjs
PMS_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:redesign-browser
```

浏览器脚本切换用户验证：

- 张三看到管理员入口；
- 钱九能进入 `X6877-D8400_H991`、编辑其基础信息/一级计划并打开权限配置；
- 钱九不能以项目经理身份编辑其他项目；
- 李四不出现项目经理编辑动作。

- [ ] **Step 5: 提交权限 Mock**

```bash
git add src/constants/permissions.ts src/stores/project.ts src/stores/permission.ts scripts/verify-project-role-sync.mjs scripts/verify-project-space-permission-matrix.mjs screenshots/verify-workbench-technical-project-redesign.mjs
git commit -m "test: add project manager permission mock"
```

## Task 10: 全量回归、浏览器检查和证据收口

**Files:**
- Modify only if failures reveal an in-scope regression.
- Update tracked screenshots only when their expected UI intentionally changed.

- [ ] **Step 1: 跑所有定向静态/规则验证**

Run:

```bash
npm run verify:level1-flat-gantt
npm run verify:level1-plan-governance
npm run verify:mr-version-plan
npm run verify:project-field-order
node scripts/verify-project-info-matrix-refresh.mjs
node scripts/verify-project-info-followup-adjustments.mjs
npm run verify:technical-project
npm run verify:project-role-sync
node scripts/verify-project-space-permission-matrix.mjs
node scripts/verify-project-field-preferences.mjs
node scripts/verify-project-creation-draft.mjs
```

Expected: 全部 PASS。

- [ ] **Step 2: 跑工作台、列表和关联模块回归**

Run:

```bash
npm run verify:workbench-list
npm run verify:workbench-split
npm run verify:project-list-matrix
npm run verify:project-list-refinement
npm run verify:project-summary
npm run verify:enum-consumers
npm run verify:machine-tos
```

Expected: 全部 PASS；重点确认 UI 删除字段没有破坏项目列表、路线图和旧数据读取。

- [ ] **Step 3: 跑 TypeScript 与生产构建**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: exit code 0，无类型错误、无构建错误。

- [ ] **Step 4: 用独立端口启动最终验收服务**

Run:

```bash
npm run dev -- -p 3014
```

Expected: `http://127.0.0.1:3014` 可访问。记录该会话，只在验收完成后停止自己启动的服务，不终止用户正在查看的其他本地服务。

- [ ] **Step 5: 跑三套真实浏览器矩阵**

Run:

```bash
PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3014 npm run verify:level1-flat-gantt-browser
PMS_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3014 PMS_ASSERT_SCREENSHOTS_CLEAN=1 npm run verify:mr-version-plan-browser
PMS_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PMS_BASE_URL=http://127.0.0.1:3014 npm run verify:redesign-browser
```

Expected:

- 一级计划整机/tOS/技术矩阵全部通过；
- MR 浏览器矩阵全部通过，页面无独立错误列；
- 新建/项目空间字段和三用户权限矩阵通过；
- console、page、request、HTTP error 均为 0。

- [ ] **Step 6: 人工检查关键截图**

逐张查看：

- 整机 MR 单步弹窗；
- tOS 版本单步弹窗；
- tOS MR 搜索横版和竖版；
- 联合空间有效/无效日期；
- 整机新建表单和项目空间字段设置；
- 技术项目新建表单和项目空间；
- 钱九目标项目权限状态。

检查重点：标签原文、从上到下顺序、无字段缺失/重复、红框与图标定位、固定列水平滚动、Modal 密度、默认隐藏字段设置可见。

- [ ] **Step 7: 检查工作区和变更范围**

Run:

```bash
git status --short
git diff --check
git diff --stat HEAD~10..HEAD
```

Expected: 无空白错误；只有本计划范围内源码、验证脚本、截图和文档发生变化；`.superpowers` 临时预览不进入提交。

- [ ] **Step 8: 按完成分支流程复核，但不推送/合并/发布**

若全量回归发现问题，回到对应 Task 的文件清单和验证命令完成修复与提交；不得用宽泛暂存命令夹带范围外文件。全部恢复通过后，使用 `superpowers:finishing-a-development-branch` 检查提交、验证证据和分支状态。除非用户另行明确授权，不执行 `git push`、dev/master 合并、Vercel 发布或飞书文档更新。
