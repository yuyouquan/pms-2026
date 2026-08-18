# Level 3 Inline Status, Risk, Remark and Compact Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move child status and risk editing into the Level 3 table, aggregate parent status/risk, add the remark column, and simplify/compact activity modals while preserving followed-scope overrides.

**Architecture:** Keep actual-date overrides unchanged and add a separate persisted workflow-field override map for child status/risk, so each field can stop following independently. Apply both override layers before parent rollups, filtering and export; materialize both layers on detach. Keep modal responsibility limited to structural fields and use table controls for operational fields.

**Tech Stack:** Next.js 14, React 18, TypeScript, Zustand persist middleware, Ant Design 6, existing Node verification scripts, Puppeteer browser checks.

---

## File map

- `src/types/level3Plan.ts`: add workflow override types and the remark column key.
- `src/lib/level3PlanRules.ts`: merge workflow overrides, aggregate parent status/risk, and expose one child inline-edit permission rule.
- `src/stores/level3Plan.ts`: persist follower status/risk overrides, create history, migrate v2 data, and materialize overrides on detach.
- `src/components/plans/Level3PlanModule.tsx`: add inline selects, remove operational fields from modals, add remark display/export/filter support.
- `src/styles/globals.css`: scope compact spacing to the Level 3 activity modal.
- `scripts/verify-level3-plan.mjs`: cover rules, store, migration, component contracts and form defaults.

### Task 1: Persist independent followed-scope status and risk overrides

**Files:**
- Modify: `src/types/level3Plan.ts`
- Modify: `src/lib/level3PlanRules.ts`
- Modify: `src/stores/level3Plan.ts`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Write failing pure-rule and store assertions**

Add fixtures showing status and risk freeze independently:

```js
const workflowOverride = rules.createLevel3WorkflowOverride(
  { ...childA, status: '待启动', risk: '低' },
  undefined,
  { status: '进行中' },
  '李四',
  '2026-08-18 10:00:00',
)
assert.deepEqual(workflowOverride, {
  activityId: 'c1',
  status: '进行中',
  detachedBy: '李四',
  detachedAt: '2026-08-18 10:00:00',
})

const withSourceRiskChange = rules.mergeLevel3WorkflowOverrides(
  [{ ...childA, status: '已完成', risk: '高' }],
  { c1: workflowOverride },
)
assert.equal(withSourceRiskChange[0].status, '进行中')
assert.equal(withSourceRiskChange[0].risk, '高')
```

Add a second edit `{ risk: '中' }` and assert the status override remains while risk becomes independent. Assert explicit `undefined` patches are ignored and inputs remain unchanged.

Require store tokens:

```js
for (const token of [
  'workflowOverridesByScope',
  'updateFollowWorkflowFields',
  'mergeLevel3WorkflowOverrides',
  'LEVEL3_PLAN_STORE_VERSION = 3',
]) assert.ok(storeSource.includes(token), `missing ${token}`)
```

- [ ] **Step 2: Run RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because workflow override exports/state do not exist.

- [ ] **Step 3: Add workflow override types**

Add to `src/types/level3Plan.ts`:

```ts
export interface Level3WorkflowOverride {
  activityId: string
  status?: Level3ActivityStatus
  risk?: Level3ActivityRisk
  detachedBy: string
  detachedAt: string
}

export type Level3WorkflowOverrideMap = Partial<Record<string, Level3WorkflowOverride>>
```

- [ ] **Step 4: Implement immutable create and merge rules**

Add to `src/lib/level3PlanRules.ts`:

```ts
export function createLevel3WorkflowOverride(
  displayedActivity: Level3Activity,
  existing: Level3WorkflowOverride | undefined,
  patch: Pick<Partial<Level3Activity>, 'status' | 'risk'>,
  actor: string,
  occurredAt: string,
): Level3WorkflowOverride {
  return {
    ...(existing || { activityId: displayedActivity.id }),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.risk !== undefined ? { risk: patch.risk } : {}),
    activityId: displayedActivity.id,
    detachedBy: actor,
    detachedAt: occurredAt,
  }
}

export function mergeLevel3WorkflowOverrides(
  activities: Level3Activity[],
  overrides: Level3WorkflowOverrideMap,
): Level3Activity[] {
  return activities.map(activity => {
    const override = overrides[activity.id]
    return override ? {
      ...activity,
      ...(override.status !== undefined ? { status: override.status } : {}),
      ...(override.risk !== undefined ? { risk: override.risk } : {}),
    } : { ...activity }
  })
}
```

- [ ] **Step 5: Add store state and update action**

Extend state/action interfaces in `src/stores/level3Plan.ts`:

```ts
workflowOverridesByScope: Record<string, Level3WorkflowOverrideMap>

updateFollowWorkflowFields: (
  sourceScopeKey: string,
  selectedScopeKey: string,
  activityId: string,
  patch: Pick<Partial<Level3Activity>, 'status' | 'risk'>,
  actor: string,
) => boolean
```

Implement the state transition using the existing `buildFieldChanges`, `createId`, `formatNow` and `getActivityNumber` helpers:

```ts
const sourceActivities = state.activitiesByScope[sourceScopeKey] || []
const actualOverrides = state.actualOverridesByScope[selectedScopeKey] || {}
const currentWorkflowOverrides = state.workflowOverridesByScope[selectedScopeKey] || {}
const displayedActivities = mergeLevel3WorkflowOverrides(
  mergeLevel3ActualDateOverrides(sourceActivities, actualOverrides),
  currentWorkflowOverrides,
)
const previousActivity = displayedActivities.find(activity => activity.id === activityId)
if (!previousActivity?.parentId) return state
if (patch.status !== undefined && !LEVEL3_ACTIVITY_STATUSES.includes(patch.status)) return state
if (patch.risk !== undefined && !LEVEL3_ACTIVITY_RISKS.includes(patch.risk)) return state

const nextOverride = createLevel3WorkflowOverride(
  previousActivity,
  currentWorkflowOverrides[activityId],
  patch,
  actor,
  formatNow(),
)
const nextWorkflowOverrides = { ...currentWorkflowOverrides, [activityId]: nextOverride }
const nextActivities = mergeLevel3WorkflowOverrides(
  mergeLevel3ActualDateOverrides(sourceActivities, actualOverrides),
  nextWorkflowOverrides,
)
const nextActivity = nextActivities.find(activity => activity.id === activityId)
if (!nextActivity) return state
const changes = buildFieldChanges(previousActivity, nextActivity)
  .filter(change => change.field === 'status' || change.field === 'risk')
if (changes.length === 0) return state

const log: Level3ChangeLog = {
  id: createId('level3-log'),
  action: 'edit',
  actor,
  occurredAt: nextOverride.detachedAt,
  activityId,
  activityName: nextActivity.activityName,
  activityNumber: getActivityNumber(nextActivities, activityId),
  summary: `编辑活动：${changes.map(change => change.label).join('、')}`,
  changes,
}
updated = true
return {
  workflowOverridesByScope: {
    ...state.workflowOverridesByScope,
    [selectedScopeKey]: nextWorkflowOverrides,
  },
  historyByScope: {
    ...state.historyByScope,
    [selectedScopeKey]: [log, ...(state.historyByScope[selectedScopeKey] || [])],
  },
}
```

Wrap this transition in the same `let updated = false; set(state => ...); return updated` pattern as `updateFollowActualDates`.

- [ ] **Step 6: Materialize workflow overrides on detach**

Extend `forkLevel3ScopeData` to accept a fourth argument:

```ts
export function forkLevel3ScopeData(
  source: Level3ScopeData,
  target?: Level3ScopeData,
  actualOverrides: Level3ActualDateOverrideMap = {},
  workflowOverrides: Level3WorkflowOverrideMap = {},
): Level3ScopeData {
  const activitiesWithActualDates = mergeLevel3ActualDateOverrides(source.activities, actualOverrides)
  const targetColumnSettings = target?.columnSettings
  return {
    activities: mergeLevel3WorkflowOverrides(activitiesWithActualDates, workflowOverrides),
    history: mergeLevel3Histories(source.history, target?.history),
    collapsedIds: [...source.collapsedIds],
    columnSettings: {
      order: [...(targetColumnSettings?.order || source.columnSettings.order)],
      visible: [...(targetColumnSettings?.visible || source.columnSettings.visible)],
    },
  }
}
```

In `forkFollowScope`, pass the target scope's workflow override map into this function. After materialization, remove only workflow records whose activity IDs occur in the materialized activities; retain orphan workflow records exactly as the actual-date path does.

- [ ] **Step 7: Add the v3 migration and persistence round trip**

Set `LEVEL3_PLAN_STORE_VERSION = 3`, include `workflowOverridesByScope` in `partialize`, and migrate v1/v2 data by preserving all existing slices and setting missing workflow overrides to `{}`. Existing v3 workflow overrides must survive JSON hydration and a second reload.

- [ ] **Step 8: Run GREEN and commit**

Run:

```bash
npm run verify:level3-plan
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

Expected: all commands exit 0.

```bash
git add src/types/level3Plan.ts src/lib/level3PlanRules.ts src/stores/level3Plan.ts scripts/verify-level3-plan.mjs
git commit -m "feat: persist followed level3 status and risk"
```

### Task 2: Aggregate parent status and highest risk

**Files:**
- Modify: `src/types/level3Plan.ts`
- Modify: `src/lib/level3PlanRules.ts`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Add failing rollup assertions**

Add table-driven cases:

```js
const parentStateCases = [
  { children: [], status: '待启动', risk: '无' },
  { children: [{ status: '待启动', risk: '无' }, { status: '待启动', risk: '低' }], status: '待启动', risk: '低' },
  { children: [{ status: '已完成', risk: '低' }, { status: '已完成', risk: '中' }], status: '已完成', risk: '中' },
  { children: [{ status: '待启动', risk: '无' }, { status: '已完成', risk: '高' }], status: '进行中', risk: '高' },
  { children: [{ status: '进行中', risk: '中' }, { status: '待启动', risk: '低' }], status: '进行中', risk: '中' },
]
```

For each case build child activities under one parent and assert `getLevel3ParentRollup` and `applyLevel3Rollups` return the expected status/risk without mutating stored parent values.

- [ ] **Step 2: Run RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because parent rollups do not return status/risk.

- [ ] **Step 3: Extend parent rollup type and rules**

Add `status` and `risk` to `Level3ParentRollup`. Implement:

```ts
const LEVEL3_RISK_PRIORITY: Record<Level3ActivityRisk, number> = {
  无: 0,
  低: 1,
  中: 2,
  高: 3,
}

const getParentStatus = (children: Level3Activity[]): Level3ActivityStatus => {
  if (children.length === 0 || children.every(child => child.status === '待启动')) return '待启动'
  if (children.every(child => child.status === '已完成')) return '已完成'
  return '进行中'
}

const getParentRisk = (children: Level3Activity[]): Level3ActivityRisk => (
  children.reduce<Level3ActivityRisk>((highest, child) => (
    LEVEL3_RISK_PRIORITY[child.risk] > LEVEL3_RISK_PRIORITY[highest] ? child.risk : highest
  ), '无')
)
```

Return both values from `getLevel3ParentRollup`.

- [ ] **Step 4: Verify overlay-before-rollup**

Add one followed-scope test where source child status/risk are changed but follower workflow overrides remain; assert the parent rollup uses the effective follower values.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm run verify:level3-plan && node node_modules/typescript/bin/tsc --noEmit`

Expected: both exit 0.

```bash
git add src/types/level3Plan.ts src/lib/level3PlanRules.ts scripts/verify-level3-plan.mjs
git commit -m "feat: aggregate level3 parent status and risk"
```

### Task 3: Add inline child status/risk editing and simplify activity forms

**Files:**
- Modify: `src/components/plans/Level3PlanModule.tsx`
- Modify: `src/lib/level3PlanRules.ts`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Add failing permission and component assertions**

Rename/generalize the permission rule and assert:

```js
assert.equal(rules.canInlineEditLevel3ChildField(childA, [parent, childA], baseContext), true)
assert.equal(rules.canInlineEditLevel3ChildField(parent, [parent, childA], baseContext), false)
assert.equal(rules.canInlineEditLevel3ChildField(childA, [parent, childA], unauthorizedContext), false)
```

Require component tokens for `handleInlineWorkflowChange`, `updateFollowWorkflowFields`, inline `Select`, and forbid operational modal fields in the modal section. Extract the modal source between `<Modal` and `</Modal>` and assert it contains no labels `实际开始时间、实际完成时间、状态、任务风险`.

- [ ] **Step 2: Run RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because inline workflow editing and simplified modal are absent.

- [ ] **Step 3: Build effective activities with both override layers**

Read `workflowOverridesByScope[selectedScopeKey]` with a stable module-level empty constant. Compute:

```ts
const effectiveActivities = useMemo(() => mergeLevel3WorkflowOverrides(
  mergeLevel3ActualDateOverrides(sourceActivities, actualOverrides),
  workflowOverrides,
), [actualOverrides, sourceActivities, workflowOverrides])
```

Keep using `effectiveActivities` for rollups, permissions, filters, export and history display.

- [ ] **Step 4: Add inline child selects**

Add one handler:

```ts
const handleInlineWorkflowChange = (
  row: Level3ActivityViewRow,
  field: 'status' | 'risk',
  value: Level3ActivityStatus | Level3ActivityRisk,
) => {
  if (!canInlineEditLevel3ChildField(row, effectiveActivities, permissionContext)) return
  const saved = readOnly
    ? updateFollowWorkflowFields(scopeKey, selectedScopeKey, row.id, { [field]: value }, currentUser)
    : updateActivity(scopeKey, row.id, { [field]: value }, currentUser)
  if (saved) void messageApi.success('已保存')
}
```

For child status/risk cells with permission, render a small bordered `Select` and stop pointer/double-click propagation. Parent and unauthorized cells continue rendering colored `Tag` values. Use exact enum options and existing tag colors.

- [ ] **Step 5: Remove operational fields from modal state and save patches**

Remove `actualStartDate`, `actualEndDate`, `status` and `risk` from modal field initialization and JSX. Remove actual-date conversion and validation from modal submission. Editing must not put these four fields in the patch.

When creating any activity, keep internal fields complete:

```ts
actualStartDate: '',
actualEndDate: '',
status: '待启动',
risk: '无',
```

The parent also stores these defaults, although its displayed values come from rollups.

- [ ] **Step 6: Run GREEN and integration checks**

Run:

```bash
npm run verify:level3-plan
node scripts/verify-plan-workspace-shell.mjs
node scripts/verify-tos-type-integration.mjs
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/plans/Level3PlanModule.tsx src/lib/level3PlanRules.ts scripts/verify-level3-plan.mjs
git commit -m "feat: edit level3 status and risk inline"
```

### Task 4: Add remark column and compact the Level 3 activity modal

**Files:**
- Modify: `src/types/level3Plan.ts`
- Modify: `src/components/plans/Level3PlanModule.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Add failing column/form assertions**

Require `remark` between `risk` and `creator` in `LEVEL3_COLUMN_KEYS` and component column definitions. Assert filter/export use the remark key. Require `pms-level3-activity-modal`, `autoSize={{ minRows: 1, maxRows: 4 }}`, and scoped 12px form/grid spacing.

- [ ] **Step 2: Run RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because remark is not a column and the modal is not compact.

- [ ] **Step 3: Add remark to every column consumer**

Add `remark` after `risk` in `LEVEL3_COLUMN_KEYS`, column definitions and filter fields. The existing visible-column export path must receive `remark`. Render the cell as one-line ellipsis with a `Tooltip` whose title is the complete remark; render `-` for empty remarks.

- [ ] **Step 4: Add scoped compact styles**

Change the modal class to `pms-modal pms-level3-activity-modal`, replace fixed `rows={4}` with:

```tsx
<Input.TextArea
  autoSize={{ minRows: 1, maxRows: 4 }}
  maxLength={500}
  showCount
  placeholder="请输入备注"
/>
```

Add to `src/styles/globals.css`:

```css
.pms-level3-activity-modal .ant-form-item { margin-bottom: 12px; }
.pms-level3-activity-modal .pms-level3-form-grid { gap: 12px; }
```

Keep the existing single-column responsive rule.

- [ ] **Step 5: Run the complete automated gate**

Run:

```bash
npm run verify:level3-plan
node scripts/verify-plan-workspace-shell.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-project-list-refinement.mjs
node scripts/verify-technical-project.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-project-list-matrix.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 6: Run local browser regression**

Start the existing local server on port 3004 and verify in both a whole-machine followed market and followed tOS type:

- authorized child status/risk edit persists in the follower only;
- source changes update untouched fields but not overridden fields;
- parent status/risk use effective children;
- parent and unauthorized users cannot edit aggregated child fields;
- modals contain only the approved fields, use compact spacing, and default remark to one row;
- remark appears in table, column settings, filter and export;
- detach retains values/history;
- no unexpected console errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/level3Plan.ts src/components/plans/Level3PlanModule.tsx src/styles/globals.css scripts/verify-level3-plan.mjs
git commit -m "feat: add level3 remarks and compact forms"
```
