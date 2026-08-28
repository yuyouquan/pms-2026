# MR Version Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy level-3 plan with the new “三级计划-MR版本计划” domain, including the tOS template, tOS project plan, joint tOS/machine workspace, machine-market plan, exact permissions, dynamic aggregation, stop-release records, validation feedback, and verified mock workflows.

**Architecture:** Keep MR data in a dedicated persisted Zustand store and keep all date, eligibility, sorting, snapshot, and permission calculations in pure rule modules. Configuration publishes immutable activity snapshots; tOS project instances copy a template snapshot once; the joint workspace dynamically projects tOS reference rows plus eligible machine rows; machine main-market dates remain live references while only non-main-market overrides are persisted. Existing level-1 plan state is read through explicit adapters and is never mutated by the MR domain.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5, Ant Design 6, Zustand 4 persist middleware, dnd-kit, date-fns/dayjs, executable Node contract scripts, Puppeteer browser verification.

---

## File map

### New domain files

- Create `src/types/mrVersionPlan.ts`: all template, tOS instance, joint row, stop-release, market override, validation, view-mode, and permission types.
- Create `src/data/mrVersionPlanMocks.ts`: the confirmed five-stage/ten-node V1 template and deterministic tOS/machine example dates.
- Create `src/lib/mrTemplateRules.ts`: two-level normalization, numbering, global name uniqueness, version lifecycle helpers, and immutable snapshot cloning.
- Create `src/lib/mrVersionPlanRules.ts`: semantic tOS version sorting, latest-published L1 candidate extraction, tOS project date bounds, view projection, and permission resolution.
- Create `src/lib/mrAggregationRules.ts`: project-to-tOS matching, version interval calculation, STR5 eligibility, forward insertion, stop-release exclusion, and dynamic row reconciliation.
- Create `src/lib/mrDateRules.ts`: all tOS, joint 1+N, cross-version, same-type, and non-main-market date validation.
- Create `src/lib/mrPlanSourceAdapters.ts`: read-only adapters from current project/plan/market/tOS-type stores into stable MR rule inputs.
- Create `src/stores/mrVersionPlan.ts`: persisted template versions, tOS instances, machine values, market overrides, stop records, view preferences, and guarded mutation actions.
- Create `src/components/plans/MrTemplateTable.tsx`: configuration-center activity editor.
- Create `src/components/plans/MrPlanGrid.tsx`: shared grouped horizontal and hierarchical vertical MR tables.
- Create `src/components/plans/TosMrVersionPlan.tsx`: tOS project version selection and date maintenance.
- Create `src/components/plans/MachineMrVersionPlan.tsx`: machine main/non-main-market MR plan.
- Create `src/components/joint/JointMrVersionPlan.tsx`: filters, aggregation grid, validation display, stop-release modal, and history modal.
- Create `src/containers/JointProjectSpaceContainer.tsx`: top-level joint-space shell and single business tab.
- Create `scripts/verify-mr-version-plan.mjs`: executable pure-rule, store, migration, permission, and integration-source contracts.
- Create `screenshots/verify-mr-version-plan-browser.mjs`: end-to-end local-browser workflow and screenshot capture.

### Existing integration files

- Modify `src/stores/ui.ts`: add `jointProjectSpace` as a top-level module and MR deep-link intent fields.
- Modify `src/containers/AppShell.tsx`: add “联合项目空间” immediately after “项目列表”.
- Modify `src/app/page.tsx`: render `JointProjectSpaceContainer`.
- Modify `src/containers/ConfigContainer.tsx`: expose the MR template only for tOS version projects and wire its independent version lifecycle.
- Modify `src/containers/ProjectSpaceContainer.tsx`: replace the old level-3 entry with tOS/machine MR components, swap plan/market tab hierarchy, and consume deep-link focus.
- Modify `src/stores/plan.ts`: remove legacy level-3 template state, actions, snapshots, and migration branches; retain level-1 data as the MR source.
- Modify `src/styles/globals.css`: scoped MR table, sticky column, invalid-cell, toolbar, tab, modal, and responsive rules.
- Modify `package.json`: remove old level-3 verification entries and add MR rule/browser commands.

### Legacy files to delete

- Delete `src/types/level3Plan.ts`.
- Delete `src/types/level3Template.ts`.
- Delete `src/lib/level3PlanRules.ts`.
- Delete `src/lib/level3TemplateRules.ts`.
- Delete `src/stores/level3Plan.ts`.
- Delete `src/components/plans/Level3PlanModule.tsx`.
- Delete `src/components/plans/Level3TemplateTable.tsx`.
- Delete `scripts/verify-level3-plan.mjs`.
- Delete `scripts/verify-level3-template-config.mjs`.
- Delete `screenshots/verify-level3-template-config-browser.mjs`.

## Implementation constraints

- Do not add a database, API route, server action, or Feishu notification.
- Do not write MR state into `usePlanStore`; it is a source only.
- Do not migrate legacy `pms-level3-plan-store` data. Remove that key once after the new store hydrates.
- Do not infer activity semantics from an ID or hidden code. Every special rule matches the current trimmed activity name exactly.
- Do not reject partial date input. Save invalid non-empty values, then surface cell errors.
- Do not copy main-market dates into machine project state. They must remain live projections from the joint machine row.
- Keep all write authorization in store actions as well as button/input visibility.
- Preserve existing edit-guard navigation, project role mappings, market configuration, and all unrelated dirty-worktree data.

## Requirement traceability

| Confirmed requirement | Owning tasks |
|---|---|
| 旧三级计划、Mock、历史和持久化全部删除且不迁移 | Tasks 6, 12 |
| tOS 配置中心 MR 模板、两级活动、版本修订、名称唯一、快照初始化 | Tasks 2, 7 |
| tOS 项目新增版本、来源上市迭代阶段/维护阶段、日期边界、横版/竖版 | Tasks 3, 8 |
| Header 新增联合项目空间和单一业务 Tab | Task 9 |
| STR5+1、最早/最晚二级日期区间、向后插入、动态重算与删除 | Task 4 |
| tOS 行只读、整机 1+N、固定列、筛选、日期错误标红 | Tasks 4, 9 |
| 超级管理员和整机 SPM 的编辑/停止发版权限 | Tasks 3, 6, 9, 10 |
| 停止发版永久排除、停止发版记录、无恢复 | Tasks 4, 10 |
| N/A 永久清空、同类型一致、最大已存在较小类型、7 个自然日、下一版本上限 | Tasks 4, 9 |
| 整机主市场实时同步、非主市场受限、横版/竖版 | Task 11 |
| 项目名称跳转到项目空间 MR 计划并定位版本 | Task 10 |
| Mock、固定列滚动、防重叠、真实浏览器验收 | Tasks 8, 13, 14 |

### Task 1: Define the executable MR contract

**Files:**
- Create: `scripts/verify-mr-version-plan.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add a TypeScript module loader and failing API assertions**

Use the repository's import-aware `loadTypeScriptModule` helper from `scripts/lib/source-contract.mjs` so aliases and runtime imports resolve correctly. Begin with the template exports owned by the first implementation slice:

```js
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const templateRules = loadTypeScriptModule(root, 'src/lib/mrTemplateRules.ts')

assert.equal(templateRules.DEFAULT_MR_TEMPLATE_ACTIVITIES.length, 15)
assert.deepEqual(
  templateRules.numberMrTemplateActivities(templateRules.DEFAULT_MR_TEMPLATE_ACTIVITIES)
    .map(row => [row.number, row.activityName]),
  [
    ['1', '需求&修改点'],
    ['1.1', '修改点收集开始时间'],
    ['1.2', '修改点锁定时间'],
    ['2', '入库&自测&转测'],
    ['2.1', 'MP入库开始时间'],
    ['2.2', 'MP入库截止时间'],
    ['2.3', '版本转测时间'],
    ['3', '版本测试'],
    ['3.1', '测试开始时间'],
    ['3.2', '测试完成时间'],
    ['4', '版本评审'],
    ['4.1', '评审时间'],
    ['5', '版本发布'],
    ['5.1', '软件归档时间'],
    ['5.2', 'OTA开放验证&部署'],
  ],
)
```

- [ ] **Step 2: Register the new verification command**

Add:

```json
"verify:mr-version-plan": "node scripts/verify-mr-version-plan.mjs"
```

- [ ] **Step 3: Run the contract and confirm RED**

Run: `npm run verify:mr-version-plan`

Expected: FAIL because the new MR modules do not exist.

- [ ] **Step 4: Commit the red contract**

```bash
git add package.json scripts/verify-mr-version-plan.mjs
git commit -m "test: define MR version plan contracts"
```

### Task 2: Implement types, template rules, and template mock

**Files:**
- Create: `src/types/mrVersionPlan.ts`
- Create: `src/data/mrVersionPlanMocks.ts`
- Create: `src/lib/mrTemplateRules.ts`
- Test: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Define the exact domain types**

Create these core types and use them from every later module:

```ts
export type MrTemplateVersionStatus = '已发布' | '修订中'
export type MrTransferType = 'N/A' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
export type MrPlanViewMode = 'vertical' | 'horizontal'
export type MrActivityDateMap = Record<string, string>

export interface MrTemplateActivity {
  id: string
  parentId: string | null
  order: number
  activityName: string
}

export interface MrTemplateVersion {
  id: string
  versionNo: string
  status: MrTemplateVersionStatus
  activities: MrTemplateActivity[]
  createdBy: string
  createdAt: string
  publishedAt?: string
}

export interface MrTemplateChangeLog {
  id: string
  versionId: string
  action: 'create-revision' | 'add' | 'rename' | 'move' | 'delete' | 'publish' | 'cancel-revision'
  activityId?: string
  before?: string
  after?: string
  actor: string
  occurredAt: string
}

export interface TosMrVersionInstance {
  projectId: string
  tosVersion: string
  templateVersionId: string
  activities: MrTemplateActivity[]
  dates: MrActivityDateMap
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export interface JointMachinePlan {
  projectId: string
  tosProjectId: string
  tosVersion: string
  transferType: MrTransferType
  dates: MrActivityDateMap
  updatedBy: string
  updatedAt: string
}

export interface MrStopReleaseRecord {
  id: string
  projectId: string
  projectName: string
  stopDate: string
  operator: string
  operatedAt: string
}

export interface MrMarketOverride {
  projectId: string
  tosVersion: string
  market: string
  dates: MrActivityDateMap
}

export interface MrCellError {
  rowKey: string
  activityId: string
  activityName: string
  message: string
}

export interface MrPermissionInput {
  context: 'config' | 'tos' | 'joint-machine' | 'machine-market'
  currentUser: string
  globalAdminUsers: string[]
  tosManagerUsers: string[]
  machineSpm: string
}

export interface MrPermissionResult {
  canView: boolean
  canEditTemplate: boolean
  canEditTos: boolean
  canEditMachine: boolean
  canStopRelease: boolean
  canEditMarket: boolean
}
```

Define the remaining rule-input and projection interfaces in the same type file rather than as anonymous object unions, so rule tests, store actions, and React props share the same signatures.

- [ ] **Step 2: Add the confirmed V1 template seed**

In `src/data/mrVersionPlanMocks.ts`, export `DEFAULT_MR_TEMPLATE_ACTIVITIES` with stable IDs such as `mr-stage-requirements` and `mr-node-change-collection`, exactly five parents and ten children in the confirmed order. Export `createInitialMrTemplateVersions()` returning one `V1` published version with deep-cloned activities. Re-export `DEFAULT_MR_TEMPLATE_ACTIVITIES` from `src/lib/mrTemplateRules.ts` so the rule contract has one stable entry point.

- [ ] **Step 3: Implement template normalization and lifecycle helpers**

Export these exact functions from `src/lib/mrTemplateRules.ts`:

```ts
export function normalizeMrTemplateActivities(rows: readonly MrTemplateActivity[]): MrTemplateActivity[]
export function numberMrTemplateActivities(rows: readonly MrTemplateActivity[]): Array<MrTemplateActivity & { number: string; depth: 0 | 1 }>
export function validateMrTemplateForPublish(rows: readonly MrTemplateActivity[]): string[]
export function cloneMrTemplateSnapshot(rows: readonly MrTemplateActivity[]): MrTemplateActivity[]
export function createMrTemplateRevision(versions: readonly MrTemplateVersion[], actor: string, now: string): MrTemplateVersion[]
export function publishMrTemplateRevision(versions: readonly MrTemplateVersion[], revisionId: string, actor: string, now: string): MrTemplateVersion[]
export function cancelMrTemplateRevision(versions: readonly MrTemplateVersion[], revisionId: string): MrTemplateVersion[]
export function moveMrTemplateActivity(rows: readonly MrTemplateActivity[], activeId: string, overId: string): MrTemplateActivity[]
```

Normalization must reject duplicate IDs, orphan children, a child used as a parent, depth greater than one child level, and blank names. Publish validation must add `活动名称重复：{name}` for every duplicated trimmed display name. Moving a parent reorders the parent and carries its children; moving a child is limited to its current parent.

- [ ] **Step 4: Extend the verifier with lifecycle cases**

Assert:

```js
assert.deepEqual(templateRules.validateMrTemplateForPublish([
  parent,
  { ...childA, activityName: '节点A' },
  { ...childB, activityName: ' 节点A ' },
]), ['活动名称重复：节点A'])
assert.throws(() => templateRules.normalizeMrTemplateActivities([parent, childA, grandchild]), /最多支持两级活动/)
assert.deepEqual(templateRules.cloneMrTemplateSnapshot(seed), seed)
assert.notStrictEqual(templateRules.cloneMrTemplateSnapshot(seed)[0], seed[0])

const revision = templateRules.createMrTemplateRevision(initialVersions, '张三', NOW)
assert.equal(revision.filter(item => item.status === '修订中').length, 1)
assert.throws(() => templateRules.createMrTemplateRevision(revision, '张三', NOW), /已存在修订版本/)
```

- [ ] **Step 5: Run and confirm GREEN**

Run: `npm run verify:mr-version-plan`

Expected: template seed, numbering, uniqueness, depth, snapshot, revision, publish, cancellation, and reorder assertions PASS.

- [ ] **Step 6: Commit the template domain**

```bash
git add src/types/mrVersionPlan.ts src/data/mrVersionPlanMocks.ts src/lib/mrTemplateRules.ts scripts/verify-mr-version-plan.mjs
git commit -m "feat: add MR template domain"
```

### Task 3: Implement tOS source, sorting, permissions, and bounds

**Files:**
- Create: `src/lib/mrVersionPlanRules.ts`
- Test: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing source and permission assertions**

Extend the verifier with `const planRules = loadTypeScriptModule(root, 'src/lib/mrVersionPlanRules.ts')`. Cover latest-published-only selection, stage scoping, incomplete candidates, duplicate exclusion, numeric sorting, exact-name bounds, and the role matrix:

```js
const candidates = planRules.selectTosMrVersionCandidates({
  versions: [publishedV3, draftV4],
  getSnapshot: id => id === 'v3' ? tosLevel1Tasks : draftTasks,
  usedVersions: ['16.3.0.110'],
})
assert.deepEqual(candidates.map(item => [item.value, item.disabled]), [
  ['16.3.0.110', true],
  ['16.3.0.115', false],
  ['16.3.0.120', true],
])
assert.equal(candidates[2].reason, '请先完善一级计划中的计划开始时间和计划完成时间')

assert.deepEqual(planRules.resolveMrPermissions({
  currentUser: '李白', globalAdminUsers: [], tosManagerUsers: ['李白'], machineSpm: '张三', context: 'tos',
}), { canView: true, canEditTemplate: false, canEditTos: true, canEditMachine: false, canStopRelease: false, canEditMarket: false })
```

- [ ] **Step 2: Implement exact exports**

```ts
export function compareTosVersionNumbers(left: string, right: string): number
export function sortTosVersionNumbers(values: readonly string[]): string[]
export function selectTosMrVersionCandidates(input: TosMrCandidateInput): TosMrVersionCandidate[]
export function validateTosMrInstanceDates(instance: TosMrVersionInstance, bounds: { planStartDate: string; planEndDate: string }): MrCellError[]
export function resolveMrPermissions(input: MrPermissionInput): MrPermissionResult
export function createTosMrVersionInstance(input: CreateTosMrVersionInput): TosMrVersionInstance
export function projectTosMrVerticalRows(instance: TosMrVersionInstance): TosMrVerticalRow[]
export function projectTosMrHorizontalColumns(activities: readonly MrTemplateActivity[]): MrGroupedColumn[]
export function buildJointMrColumnSchema(instances: readonly TosMrVersionInstance[], latestTemplate: readonly MrTemplateActivity[]): MrGroupedColumn[]
```

`selectTosMrVersionCandidates` must:

1. choose the highest numeric `Vn` with `status === '已发布'`;
2. read only children of exact parent names `上市迭代阶段` and `维护阶段`;
3. use the child task name as the tOS version number;
4. use child `planStartDate` and `planEndDate` as bounds;
5. mark already-used versions disabled with `该tOS版本号已添加`;
6. mark missing start/end disabled with the confirmed prompt.

`validateTosMrInstanceDates` must match exact activity names. Only non-empty invalid values create errors:

- `修改点收集开始时间` before the L1 start;
- `OTA开放验证&部署` after the L1 end.

`buildJointMrColumnSchema` must create one deterministic union for the single joint table: use trimmed `父活动名称::二级活动名称` as the logical column identity, order columns from the latest published template first, then append legacy snapshot-only columns in semantic tOS-version order. A tOS or machine row displays a value only when its own snapshot contains that exact parent/child name pair. This preserves old snapshots after template renames without inventing hidden business codes.

`resolveMrPermissions` must always return `canView: true` for a logged-in mock user. A global admin receives every edit flag. A tOS version project manager receives only `canEditTos`; a machine SPM receives `canEditMachine`, `canStopRelease`, and `canEditMarket` only for that project. `canEditTemplate` is global-admin-only. All other flags remain false.

- [ ] **Step 3: Run the MR verifier**

Run: `npm run verify:mr-version-plan`

Expected: all tOS candidate, sort, permission, view-projection, and boundary cases PASS.

- [ ] **Step 4: Commit tOS rules**

```bash
git add src/lib/mrVersionPlanRules.ts scripts/verify-mr-version-plan.mjs
git commit -m "feat: add tOS MR plan rules"
```

### Task 4: Implement aggregation, stop-release, and date validation rules

**Files:**
- Create: `src/lib/mrAggregationRules.ts`
- Create: `src/lib/mrDateRules.ts`
- Test: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing aggregation fixtures**

Extend the verifier with `aggregationRules` and `dateRules` loaded from their exact new module paths. Use fixed dates and project fixtures; never depend on the real clock in tests:

```js
assert.deepEqual(
  aggregationRules.getTosVersionInterval(tosInstance),
  { startDate: '2026-06-22', endDate: '2026-07-11' },
)
assert.equal(aggregationRules.getTosVersionInterval(emptyInstance), null)
assert.equal(aggregationRules.resolveMachineTosProjectKey(newProduct), '16.3')
assert.equal(aggregationRules.resolveMachineTosProjectKey(oldProduct), '16.3')

const reconciled = aggregationRules.reconcileJointMachinePlans({
  today: '2026-08-29',
  tosProjects,
  tosInstances,
  machineProjects,
  latestPublishedLevel1ByProjectId,
  persistedPlans: staleAndValidPlans,
  stopRecords: [],
})
assert.deepEqual(reconciled.rows.map(row => row.key), [
  'tos-project-16.3::16.3.0.140::reference',
  'machine-c09::16.3.0.140',
  'tos-project-16.3::16.3.0.145::reference',
  'machine-c09::16.3.0.145',
])
assert.deepEqual(Object.keys(reconciled.persistedPlans), ['machine-c09::16.3.0.140', 'machine-c09::16.3.0.145'])
```

Include a source-date change fixture proving an ineligible machine row and its dates are removed, and a still-eligible invalid row retains its dates.

- [ ] **Step 2: Implement dynamic aggregation**

Export:

```ts
export function getTosVersionInterval(instance: TosMrVersionInstance): { startDate: string; endDate: string } | null
export function resolveMachineTosProjectKey(project: MrMachineProjectSource): string | null
export function resolveLatestPublishedStr5Date(source: MrLevel1Source): string | null
export function reconcileJointMachinePlans(input: ReconcileJointInput): ReconcileJointResult
export function applyStopRelease(input: ApplyStopReleaseInput): ApplyStopReleaseResult
export function isPlanExcludedByStopRecord(input: StopExclusionInput): boolean
```

The reconcile algorithm must be deterministic:

1. match new products by first-sale tOS and old/legacy-normalized products by current tOS;
2. match the first two numeric segments to the tOS project;
3. require `today > STR5 planEndDate` from the latest published machine L1 snapshot;
4. calculate each tOS version interval from all non-empty child dates;
5. locate the interval containing `STR5 + 1 day` inclusively;
6. project the machine into that version and every later semantic version;
7. create missing plans with type `1` and empty dates;
8. permanently remove persisted plans no longer eligible;
9. apply every stop record after eligibility so deleted future rows cannot reappear.

`applyStopRelease` must compare the tOS reference date for the exact activity name `修改点收集开始时间`; missing/empty values do not delete the row. It must append an immutable audit record and return both removed plan keys and retained plans.

- [ ] **Step 3: Add failing date-rule assertions**

Cover every exact prompt and boundary:

```js
assert.deepEqual(dateRules.validateJointMachineRows(typeOneFixture).map(error => error.message), [
  '版本转测时间应等于tOS版本转测时间',
])
assert.ok(dateRules.validateJointMachineRows(typeTwoSixDayGap).some(error => (
  error.message === '版本转测时间需晚于上一个1+N转测类型至少1周'
)))
assert.ok(dateRules.validateJointMachineRows(sameTypeMismatch).every(error => (
  error.message === '同一1+N转测类型的版本转测时间需保持一致'
)))
assert.deepEqual(dateRules.validateMachineMarketDate({ value: '2026-07-12', mainValue: '2026-07-11', ...context }), [
  '非主市场时间不得晚于主市场对应时间',
])
assert.deepEqual(dateRules.validateMachineMarketDate({ value: '2026-07-10', mainValue: '', ...context }), [
  '主市场对应时间未填写，当前市场不可填写',
])
```

- [ ] **Step 4: Implement exact-name date rules**

Export:

```ts
export function validateJointMachineRows(input: JointValidationInput): MrCellError[]
export function validateMachineMarketDate(input: MarketDateValidationInput): string[]
export function clearDatesForNa(row: JointMachinePlan): JointMachinePlan
export function groupMrErrorsByRow(errors: readonly MrCellError[]): Record<string, MrCellError[]>
```

Rules must implement:

- exact equality with tOS for modification collection/lock;
- `MP入库截止时间 <= tOS`, with exact prompt `整机产品项目的MP入库截止时间不得晚于tOS项目时间`;
- same numeric 1+N type has the same version-transfer date, without auto-sync;
- type `1` version transfer equals tOS;
- type `>1` compares with the greatest existing smaller numeric type and is at least 7 natural days later;
- type `>1` transfer date does not exceed next tOS version `测试开始时间`;
- test start/completion/review/archive/OTA type `1` is not earlier than the same tOS field and not later than next tOS `测试开始时间`;
- type `>1` is at least 7 days after the corresponding field on the greatest smaller existing type and no later than the same field on the next tOS version;
- last tOS version has no next-version upper bound;
- empty cells do not produce errors;
- when a required tOS/prior/next-version comparison date is empty, skip that comparison until the reference value exists;
- `N/A` dates are cleared and projected as `/`.

- [ ] **Step 5: Run and confirm GREEN**

Run: `npm run verify:mr-version-plan`

Expected: all interval, eligibility, dynamic removal, stop, N/A, same-type, prior-type, next-version, and market-boundary assertions PASS.

- [ ] **Step 6: Commit rule engine**

```bash
git add src/lib/mrAggregationRules.ts src/lib/mrDateRules.ts scripts/verify-mr-version-plan.mjs
git commit -m "feat: add MR aggregation and date rules"
```

### Task 5: Add read-only source adapters for current project and level-1 stores

**Files:**
- Create: `src/lib/mrPlanSourceAdapters.ts`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing adapter contracts**

Load `src/lib/mrPlanSourceAdapters.ts` into `adapter`, then build store-shaped fixtures for one tOS project and one machine project. Assert:

```js
assert.equal(adapter.selectLatestPublishedTosLevel1(input).versionId, 'v4')
assert.equal(adapter.selectLatestPublishedMachineLevel1(input).versionId, 'v3')
assert.equal(adapter.selectLatestPublishedMachineLevel1(input).tasks.find(row => row.taskName === 'STR5').planEndDate, '2026-05-15')
assert.deepEqual(adapter.projectMachineMrMetadata(project, marketRows), {
  projectName: 'X6877-D8400_H991',
  marketName: 'OP',
  productLine: 'NOTE',
  spm: '李白',
  isMada: '是',
  socPlatform: 'MT6877',
  packageMode: '/',
})
```

- [ ] **Step 2: Implement adapters without writes**

Export:

```ts
export function selectLatestPublishedTosLevel1(input: TosLevel1AdapterInput): MrLevel1Source | null
export function selectLatestPublishedMachineLevel1(input: MachineLevel1AdapterInput): MrLevel1Source | null
export function buildMrAggregationSources(input: MrStoreAdapterInput): MrAggregationSources
export function projectMachineMrMetadata(project: ProjectItem, marketRows: readonly MarketConfigRow[]): MrMachineMetadata
export function getTosManagerUsers(project: ProjectItem): string[]
```

Use existing helpers `getTosTypeVersions`, `getTosTypeSnapshotKey`, `getMarketVersions`, `getProjectMarketSnapshotKey`, `getMainMarket`, and `getProjectInfoValue`. For machine L1, always use the main market's latest published snapshot. For tOS L1, use the effective primary tOS type and latest published snapshot. Do not fall back to a draft. Compute MADA as “是” if any normalized market row has `isMadaControlled === '是'`.

Normalize every source date to `YYYY-MM-DD` before passing it to MR rules; accept existing string or `Date` values and map missing/invalid values to an empty string.

- [ ] **Step 3: Run adapter and existing L1 contracts**

Run:

```bash
npm run verify:mr-version-plan
npm run verify:level1-plan-governance
```

Expected: both PASS.

- [ ] **Step 4: Commit source adapters**

```bash
git add src/lib/mrPlanSourceAdapters.ts scripts/verify-mr-version-plan.mjs
git commit -m "feat: adapt level1 sources for MR plans"
```

### Task 6: Persist MR state and enforce all writes in the store

**Files:**
- Create: `src/stores/mrVersionPlan.ts`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing store actions and migration tests**

Load the store with the existing in-memory `localStorage` harness and assert:

```js
assert.equal(store.MR_VERSION_PLAN_STORAGE_KEY, 'pms-mr-version-plan-store')
assert.equal(state.templateVersions[0].status, '已发布')
assert.equal(state.addTosVersionInstance(addInput, unauthorizedPermission), false)
assert.equal(state.addTosVersionInstance(addInput, managerPermission), true)
assert.equal(state.updateTosDate(projectId, version, childId, '2026-06-22', actor, managerPermission), true)
assert.equal(state.updateTosDate(projectId, version, parentId, '2026-06-22', actor, managerPermission), false)

state.updateMachineTransferType(machineKey, 'N/A', actor, machinePermission)
assert.deepEqual(store.getState().machinePlansByKey[machineKey].dates, {})
assert.equal(store.getState().updateMachineDate(otherMachineKey, activityId, DATE, actor, machinePermission), false)
assert.equal(store.getState().updateMarketDate({
  projectId, tosVersion, market: 'OP', mainMarket: 'OP', activityId, value: DATE, mainValue: DATE,
}, actor, adminPermission), false)
assert.equal(store.getState().updateMarketDate({
  projectId, tosVersion, market: 'TR', mainMarket: 'OP', activityId, value: DATE, mainValue: '',
}, actor, adminPermission), false)
```

Pass a corrupt persisted fixture through `migrateMrVersionPlanState` and assert invalid transfer types, orphan template children, blank keys, and main-market copies are discarded. Assert the store hydration callback removes `pms-level3-plan-store` and never imports it.

- [ ] **Step 2: Implement state shape and actions**

Use this state surface:

```ts
export interface MrVersionPlanState {
  templateVersions: MrTemplateVersion[]
  currentTemplateVersionId: string
  templateHistory: MrTemplateChangeLog[]
  tosInstancesByProjectId: Record<string, TosMrVersionInstance[]>
  machinePlansByKey: Record<string, JointMachinePlan>
  marketOverridesByKey: Record<string, MrMarketOverride>
  stopReleaseRecords: MrStopReleaseRecord[]
  viewModeByScope: Record<string, MrPlanViewMode>
}
```

Expose guarded actions:

```ts
createTemplateRevision(actor: string, permission: MrPermissionResult): boolean
updateTemplateActivities(versionId: string, updater: MrActivityUpdater, permission: MrPermissionResult): boolean
publishTemplateRevision(versionId: string, actor: string, permission: MrPermissionResult): { ok: boolean; errors: string[] }
cancelTemplateRevision(versionId: string, permission: MrPermissionResult): boolean
addTosVersionInstance(input: AddTosInstanceInput, permission: MrPermissionResult): boolean
updateTosDate(projectId: string, tosVersion: string, activityId: string, value: string, actor: string, permission: MrPermissionResult): boolean
reconcileMachinePlans(input: ReconcileJointInput): ReconcileJointResult
updateMachineTransferType(key: string, value: MrTransferType, actor: string, permission: MrPermissionResult): boolean
updateMachineDate(key: string, activityId: string, value: string, actor: string, permission: MrPermissionResult): boolean
stopRelease(input: StoreStopReleaseInput, permission: MrPermissionResult): boolean
updateMarketDate(input: { projectId: string; tosVersion: string; market: string; mainMarket: string; activityId: string; value: string; mainValue: string }, actor: string, permission: MrPermissionResult): boolean
setViewMode(scopeKey: string, mode: MrPlanViewMode): void
```

Every template mutation must append `MrTemplateChangeLog`; cancel-revision records the cancellation before removing the draft and keeps the log. Use `MR_VERSION_PLAN_STORE_VERSION = 1`, safe JSON storage, deep clone boundaries, and `partialize` containing only domain state. On hydration, call `localStorage.removeItem('pms-level3-plan-store')` inside a guarded browser-only branch. `updateMarketDate` must reject `market === mainMarket` and reject a non-empty value when `mainValue` is empty; values later than a populated main value are saved and left for validation highlighting.

- [ ] **Step 3: Keep dynamic reconciliation atomic**

`reconcileMachinePlans` must set `machinePlansByKey` to the pure rule result and remove matching `marketOverridesByKey` entries for every deleted machine plan key in the same Zustand transaction. It must return without calling `set` when the reconciled value is structurally unchanged so React source-change effects cannot loop. `stopRelease` must append the audit record and delete affected machine plans plus overrides atomically.

- [ ] **Step 4: Run store contracts and type-check**

Run:

```bash
npm run verify:mr-version-plan
npx tsc --noEmit
```

Expected: store/migration/authorization tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the MR store**

```bash
git add src/stores/mrVersionPlan.ts scripts/verify-mr-version-plan.mjs
git commit -m "feat: persist MR version plan state"
```

### Task 7: Add the tOS MR template configuration UI

**Files:**
- Create: `src/components/plans/MrTemplateTable.tsx`
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing UI source contracts**

Assert the configuration surface contains:

```js
assert.match(configSource, /key: ['"]mr-version-plan['"]/)
assert.match(configSource, /三级计划-MR版本计划/)
assert.match(configSource, /selectedTemplateType === PROJECT_TYPE_TOS_VERSION/)
assert.match(configSource, /<MrTemplateTable/)
assert.doesNotMatch(configSource, /Level3TemplateTable/)
assert.match(templateSource, /tOS版本号/)
assert.match(templateSource, /活动序号/)
assert.match(templateSource, /活动名称/)
assert.match(templateSource, /日期/)
assert.match(templateSource, /validateMrTemplateForPublish/)
```

- [ ] **Step 2: Build `MrTemplateTable`**

Props:

```ts
interface MrTemplateTableProps {
  activities: MrTemplateActivity[]
  editable: boolean
  onChange: (activities: MrTemplateActivity[]) => void
}
```

Render fixed columns `tOS版本号 / 活动序号 / 活动名称 / 日期`. Display `-` in version/date, use `Input` only for names in an editable revision, provide add-child/delete actions on row hover, add-parent below the table, and dnd-kit sibling sorting. Parent drag carries children; children cannot cross parents. Add accessible labels such as `aria-label="活动名称-1.1"` and `aria-label="删除活动-1.1"` for browser verification.

- [ ] **Step 3: Wire the independent template lifecycle**

In `ConfigContainer.tsx`:

- show the MR tab only when the selected template type resolves to tOS version project;
- read/write `useMrVersionPlanStore`, not `usePlanStore` level-1 arrays;
- reuse the visible version selector, create-revision, save/publish, cancel, compare/history presentation style from L1;
- allow editing only on `修订中` and only for global configuration administrators;
- block publish with `validateMrTemplateForPublish` and show all errors;
- ensure published version switching displays that version's immutable snapshot.

The history control reads `templateHistory` and displays actor, time, version, action, activity, and before/after values. Version comparison uses immutable activity snapshots and reports added, removed, renamed, and reordered rows without mutating either version.

- [ ] **Step 4: Add scoped styles**

Create `.pms-mr-template-table`, `.pms-mr-toolbar`, `.pms-mr-invalid-cell`, and compact row-action styles without changing generic Ant Design selectors. Keep the configuration tab bar fully visible inside the existing header card.

- [ ] **Step 5: Run contract, type-check, and build**

Run:

```bash
npm run verify:mr-version-plan
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the configuration UI**

```bash
git add src/components/plans/MrTemplateTable.tsx src/containers/ConfigContainer.tsx src/styles/globals.css scripts/verify-mr-version-plan.mjs
git commit -m "feat: add MR template configuration"
```

### Task 8: Add the tOS project MR plan and shared table views

**Files:**
- Create: `src/components/plans/MrPlanGrid.tsx`
- Create: `src/components/plans/TosMrVersionPlan.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing component contracts**

Assert:

```js
assert.match(projectSpaceSource, /三级计划-MR版本计划/)
assert.match(tosSource, /新增tOS版本号/)
assert.match(tosSource, /selectTosMrVersionCandidates/)
assert.match(tosSource, /请先完善一级计划中的计划开始时间和计划完成时间/)
assert.match(tosSource, /vertical/)
assert.match(tosSource, /horizontal/)
assert.match(gridSource, /pms-mr-parent-row/)
assert.match(gridSource, /pms-mr-sticky-version/)
```

- [ ] **Step 2: Implement the shared grid**

`MrPlanGrid` accepts `mode`, numbered activities, logical row data, editable-cell resolver, cell-error map, and date-change callback. Vertical mode renders one row per activity with parent rows highlighted and `/` dates. Horizontal mode renders parents as Ant Design grouped headers and children as leaf date columns. Fix only the version/identity columns; apply opaque backgrounds and correct `z-index` to prevent the previously observed overlap while horizontally scrolling.

- [ ] **Step 3: Implement `TosMrVersionPlan`**

The component must:

- derive candidates from the latest published L1 source adapter;
- disable add when no MR template is published and show `请先在配置中心发布三级计划-MR版本计划模板`;
- display used/incomplete candidates disabled with their exact reasons;
- copy the latest published template on add;
- sort instances semantically ascending;
- start in vertical view and persist `tos::{projectId}` view preference;
- make all parent dates `/` and only child dates editable;
- resolve edit permission from current tOS version manager or global admin;
- save invalid dates, show the cell red, and show the error reason in a tooltip/icon.

- [ ] **Step 4: Wire the project plan tab**

For tOS version projects, show only `一级计划` and `三级计划-MR版本计划` in the first-level plan switcher. Do not show market/tOS-type switching in the MR plan. Reset any L1 edit mode through the existing edit guard when switching to MR.

- [ ] **Step 5: Run contracts, type-check, and build**

Run:

```bash
npm run verify:mr-version-plan
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the tOS project UI**

```bash
git add src/components/plans/MrPlanGrid.tsx src/components/plans/TosMrVersionPlan.tsx src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-mr-version-plan.mjs
git commit -m "feat: add tOS MR project plan"
```

### Task 9: Add the joint project-space navigation and aggregation table

**Files:**
- Create: `src/containers/JointProjectSpaceContainer.tsx`
- Create: `src/components/joint/JointMrVersionPlan.tsx`
- Modify: `src/stores/ui.ts`
- Modify: `src/containers/AppShell.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing navigation and table contracts**

Assert Header order and top-level rendering:

```js
assert.ok(headerSource.indexOf('项目列表') < headerSource.indexOf('联合项目空间'))
assert.ok(headerSource.indexOf('联合项目空间') < headerSource.indexOf('tOS路标'))
assert.match(uiSource, /\| ['"]jointProjectSpace['"]/)
assert.match(pageSource, /activeModule === ['"]jointProjectSpace['"]/)
assert.match(jointSource, /tOS&整机MR版本计划/)
for (const label of ['tOS版本号', '项目名称', '1+N版本类型', '停止发版', '停止发版记录']) {
  assert.ok(jointSource.includes(label))
}
```

- [ ] **Step 2: Add the top-level module**

Add `jointProjectSpace` to `MainModule`, render it in `page.tsx`, and add the Header item immediately after project list. Route changes must call `navigateWithEditGuard` and clear project-space-only transfer state just like existing Header navigation. All logged-in users can enter.

- [ ] **Step 3: Build the joint shell and grid projection**

`JointProjectSpaceContainer` renders the tOS-roadmap-style tab shell with one tab. `JointMrVersionPlan` must:

- call `buildMrAggregationSources` and reconcile on source changes;
- render filters on the left and stop buttons on the right;
- render fixed columns in the confirmed order;
- append the deterministic union returned by `buildJointMrColumnSchema`; each row resolves only the exact parent/child name pairs present in its own immutable snapshot;
- render the read-only tOS row before machine rows per version;
- show tOS metadata as `/`, tOS transfer type as `1`, and group mode as `/` everywhere;
- sort versions numerically and machine projects stably by project name/id;
- expose project names as keyboard-accessible links;
- show machine edit controls only when store-side permission will also permit the write.

Derive `today` once per render in the `Asia/Shanghai` timezone and pass it into reconciliation; never call `new Date()` inside pure aggregation rules.

- [ ] **Step 4: Add validation presentation**

Compute `validateJointMachineRows` after every projection. Add `.pms-mr-invalid-cell` to failing cells, render one error icon in the far-right error column, and show the row's full de-duplicated messages in a Tooltip. Changing a date must persist even when it remains invalid.

- [ ] **Step 5: Implement 1+N editing**

Use exact options `N/A, 1, 2, 3, 4, 5, 6, 7, 8`. Selecting `N/A` calls `updateMachineTransferType`, permanently clears dates, and displays `/`. Switching back to a number leaves cells blank. Same-type rows remain independent edits and rely on validation for mismatch feedback.

- [ ] **Step 6: Run contracts and engineering checks**

Run:

```bash
npm run verify:mr-version-plan
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit joint aggregation UI**

```bash
git add src/containers/JointProjectSpaceContainer.tsx src/components/joint/JointMrVersionPlan.tsx src/stores/ui.ts src/containers/AppShell.tsx src/app/page.tsx src/styles/globals.css scripts/verify-mr-version-plan.mjs
git commit -m "feat: add joint MR project space"
```

### Task 10: Add stop-release workflows and project deep links

**Files:**
- Modify: `src/components/joint/JointMrVersionPlan.tsx`
- Modify: `src/stores/ui.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing stop and deep-link source contracts**

Assert the two modals, permission filtering, disabled reason, and navigation intent:

```js
assert.match(jointSource, /当前MR版本计划缺少修改点收集开始时间，无法判断停止范围/)
assert.match(jointSource, /停止发版项目名称/)
assert.match(jointSource, /停止发版日期/)
assert.match(jointSource, /操作人/)
assert.match(jointSource, /操作时间/)
assert.match(jointSource, /操作项目/)
assert.match(uiSource, /mrTosVersion/)
assert.match(projectSpaceSource, /mrTosVersion/)
```

- [ ] **Step 2: Implement the stop-release modal**

The project selector contains only currently rendered, non-stopped machine projects the user can stop: all for a global admin, own projects for an SPM. If every candidate version snapshot lacks the exact activity name `修改点收集开始时间`, disable the button with the confirmed reason. The submit action passes the current actor and timestamp to the store, which performs the atomic delete and record append.

- [ ] **Step 3: Implement the immutable record modal**

Show `操作人 / 操作时间 / 操作项目 / 停止发版日期`, newest first. Do not expose edit, delete, restore, or retry actions.

- [ ] **Step 4: Implement deep-link navigation**

Extend the UI navigation intent with:

```ts
export interface MrPlanNavigationIntent {
  source: 'joint-mr'
  projectId: string
  mrTosVersion: string
}
```

Clicking a machine project name resolves the project, sets it as selected, enters project space using `enterProjectSpace({ module: 'jointProjectSpace' })`, selects the plan module and MR plan tab, and passes the version focus. `ProjectSpaceContainer` consumes and clears the intent after the matching version is scrolled into view.

- [ ] **Step 5: Run contracts and commit**

Run:

```bash
npm run verify:mr-version-plan
npx tsc --noEmit
```

Expected: both PASS.

```bash
git add src/components/joint/JointMrVersionPlan.tsx src/stores/ui.ts src/containers/ProjectSpaceContainer.tsx scripts/verify-mr-version-plan.mjs
git commit -m "feat: add MR stop release workflow"
```

### Task 11: Add the machine project MR plan and market sync

**Files:**
- Create: `src/components/plans/MachineMrVersionPlan.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing machine-plan contracts**

Assert:

```js
assert.match(machineSource, /getMainMarket/)
assert.match(machineSource, /主市场对应时间未填写，当前市场不可填写/)
assert.match(machineSource, /validateMachineMarketDate/)
assert.match(machineSource, /marketOverridesByKey/)
assert.match(projectSpaceSource, /projectPlanLevel === ['"]level1['"].*market/s)
assert.match(projectSpaceSource, /市场编辑/)
```

Add rule/store fixtures proving:

- only a joint machine row with at least one non-empty date creates a project-space version;
- transfer type alone does not create a version;
- N/A does not create a version;
- deleting a joint row removes its market overrides;
- main dates are read live and never stored as overrides.

- [ ] **Step 2: Implement machine version projection**

`MachineMrVersionPlan` selects joint plans for the current project and filters to rows with at least one non-empty date. It uses the matching tOS instance snapshot for the activity structure. It renders:

- vertical: `tOS版本号 / 活动序号 / 活动名称 / one column per market`;
- horizontal: `tOS版本号 / 市场项目 / grouped activity date columns`;
- parent cells as `/`;
- main-market cells as real-time read-only joint values;
- non-main-market cells from `marketOverridesByKey`.

Remember view mode under `machine::{projectId}` and default to vertical.

- [ ] **Step 3: Enforce market permissions and bounds**

Only the machine SPM or global admin may edit a non-main-market date. The input is disabled when the main date is empty and shows `主市场对应时间未填写，当前市场不可填写`. If the main date moves earlier than an existing override, keep the override, mark it red, and display `非主市场时间不得晚于主市场对应时间`.

- [ ] **Step 4: Reorder the project plan controls**

For machine projects:

- first-level tabs are `一级计划 / 三级计划-MR版本计划`;
- market tabs appear only inside `一级计划`;
- the shared market edit button stays at the far right of the top-level plan-tab row;
- MR mode displays all configured markets together;
- the deep-linked tOS version receives a stable `data-mr-version` target and focus highlight.

- [ ] **Step 5: Run contracts, type-check, and build**

Run:

```bash
npm run verify:mr-version-plan
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit machine project MR plans**

```bash
git add src/components/plans/MachineMrVersionPlan.tsx src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-mr-version-plan.mjs
git commit -m "feat: add machine MR market plans"
```

### Task 12: Remove the legacy level-3 plan completely

**Files:**
- Delete: all legacy files listed in the File map
- Modify: `src/stores/plan.ts`
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `package.json`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing retirement assertions**

The verifier must assert all deleted paths are absent and scan runtime sources:

```js
for (const legacyPath of legacyPaths) {
  assert.equal(fs.existsSync(path.join(root, legacyPath)), false, `${legacyPath} must be removed`)
}
for (const source of runtimeSources) {
  assert.doesNotMatch(source.text, /useLevel3PlanStore|Level3PlanModule|Level3TemplateTable|level3TemplateTasksByType/)
}
assert.doesNotMatch(packageSource, /verify:level3-plan|verify:level3-template/)
assert.match(mrStoreSource, /removeItem\(['"]pms-level3-plan-store['"]\)/)
```

- [ ] **Step 2: Remove legacy imports, state, and version scopes**

From `src/stores/plan.ts`, remove:

- level-3 template imports;
- `level3TemplateTasksByType` state/action;
- `level3` configuration scopes and snapshots;
- old migration/default branches;
- old `partialize` fields.

Increment `PLAN_STORE_VERSION` and make migration drop legacy fields while leaving every L1/technical/market/tOS-type value untouched.

- [ ] **Step 3: Delete legacy source and verification files**

Use `apply_patch` deletions for the exact paths in the File map. Remove old package commands. Remove all old level-3 initialization, follow, history, risk/status, Gantt, market/type-scope, and toolbar code from both containers.

- [ ] **Step 4: Run the retirement and regression contracts**

Run:

```bash
npm run verify:mr-version-plan
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
npm run verify:technical-plan
npm run verify:technical-plan-operations
npm run verify:project-list-refinement
npm run verify:project-roadmap
npx tsc --noEmit
npm run build
```

Expected: every command exits 0 and no old level-3 import/storage read remains.

- [ ] **Step 5: Commit legacy retirement**

```bash
git add -A
git commit -m "refactor: replace legacy level3 plans with MR plans"
```

### Task 13: Add deterministic mock coverage and browser acceptance

**Files:**
- Modify: `src/data/mrVersionPlanMocks.ts`
- Modify: `src/data/projects.ts`
- Create: `screenshots/verify-mr-version-plan-browser.mjs`
- Modify: `package.json`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Seed an acceptance-ready mock story**

Add deterministic data that reuses existing projects rather than inventing duplicate project identities:

- one tOS16.3 project with `16.3.0.140` and `16.3.0.145` L1 candidates;
- published MR instances whose child dates form non-overlapping visible ranges;
- `X6877-D8400_H991` eligible after STR5, with OP as main and TR/RU non-main markets;
- one type-1 row with valid dates;
- one type-2 row containing at least one saved invalid date so the red-state interaction can be verified;
- market MADA data where at least one market is “是”.

All seeds must go through exported factory functions so verification can reset the persisted store deterministically.

- [ ] **Step 2: Register the browser command**

Add:

```json
"verify:mr-version-plan-browser": "node screenshots/verify-mr-version-plan-browser.mjs"
```

- [ ] **Step 3: Implement the browser workflow**

The Puppeteer script must set a 1600×1000 viewport, reset only `pms-mr-version-plan-store` and `pms-level3-plan-store`, collect unexpected console errors, and verify:

1. Header order and entry into “联合项目空间”;
2. tOS row is read-only and precedes machine rows;
3. fixed columns remain opaque and non-overlapping after horizontal scroll;
4. filters reduce the visible row set;
5. SPM can edit own machine row but not another project;
6. global admin can edit all rows;
7. N/A clears dates and displays `/`;
8. invalid values persist, cell turns red, and error Tooltip contains the exact prompt;
9. stop release removes future rows and adds a record;
10. project link opens plan → MR tab and focuses the version;
11. tOS project add-version modal disables used/incomplete candidates;
12. tOS vertical/horizontal date edits share values;
13. machine main market is read-only and non-main market is editable within bounds;
14. configuration revision supports add/delete/reorder/name edit, rejects duplicates, and publishes a snapshot;
15. no old “三级计划” standalone tab or legacy UI remains.

Capture screenshots to `screenshots/mr-version-plan/` for configuration, tOS vertical, tOS horizontal, joint valid, joint invalid, stop record, machine vertical, and machine horizontal states.

- [ ] **Step 4: Run local browser verification**

Terminal A:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3004
```

Wait until Next reports ready. Terminal B:

```bash
PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:mr-version-plan-browser
```

Expected: `PASS MR version plan browser verification` and eight current screenshots. Stop the dev server after the run.

- [ ] **Step 5: Fix only scoped UI defects found by the browser**

Re-run the browser command after each fix. Common failure gates are sticky-column `z-index`, grouped header width, disabled date-picker overlays, modal scroll, and project deep-link timing. Keep fixes under `.pms-mr-*` selectors.

- [ ] **Step 6: Commit mocks and browser acceptance**

```bash
git add src/data/mrVersionPlanMocks.ts src/data/projects.ts screenshots/verify-mr-version-plan-browser.mjs screenshots/mr-version-plan package.json src/styles/globals.css
git commit -m "test: cover MR version plan browser flows"
```

### Task 14: Final regression, plan verification, and handoff

**Files:**
- Modify: implementation files only when a verified failure requires a correction
- Verify: `docs/superpowers/specs/2026-08-29-mr-version-plan-design.md`
- Verify: `docs/superpowers/plans/2026-08-29-mr-version-plan.md`

- [ ] **Step 1: Run the full automated matrix from a clean feature worktree**

```bash
npm run verify:mr-version-plan
npm run verify:level1-plan-governance
npm run verify:level1-flat-gantt
npm run verify:level1-browser-harness
npm run verify:project-list-matrix
npm run verify:project-list-refinement
npm run verify:project-roadmap
npm run verify:technical-project
npm run verify:technical-plan
npm run verify:technical-plan-operations
npx tsc --noEmit
npm run build
```

Expected: every command exits 0.

- [ ] **Step 2: Run the final real-browser matrix**

Start the local app on port 3004 and run:

```bash
PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:mr-version-plan-browser
PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:level1-flat-gantt-browser
PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:workbench-browser
```

Expected: all browser verifiers PASS with no unexpected console errors.

- [ ] **Step 3: Verify requirement coverage explicitly**

Check the implementation and screenshots against every section of the design document:

- legacy deletion;
- tOS-only configuration template;
- immutable per-version template snapshots;
- tOS project add/version/date permissions;
- joint navigation, metadata, sorting, filters, validation, and permissions;
- dynamic STR5/interval insertion and deletion;
- stop-release permanent exclusion and record;
- main-market real-time sync and non-main-market bounds;
- horizontal/vertical views and sticky-column behavior;
- deep link to the focused MR version.

Record each as `verified` or fix it before continuing; do not mark a source-only assertion as browser acceptance.

- [ ] **Step 4: Confirm clean status and commit any final verified fixes**

Run: `git status --short`

Expected: empty. If verification required corrections, commit them first with a focused message such as:

```bash
git add <corrected-files>
git commit -m "fix: close MR version plan acceptance gaps"
git status --short
```

- [ ] **Step 5: Prepare the implementation handoff**

Report:

- branch and final commit;
- exact automated and browser commands run;
- screenshot directory;
- verified behavior versus intentionally out-of-scope backend work;
- no push, merge, deployment, or Feishu update unless the user separately authorizes those external changes.
