# Level 3 Activity History and Cross-Parent Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-activity history inspection and permission-controlled second-level activity dragging across first-level activities in project-space level 3 plans.

**Architecture:** Keep hierarchy, move authorization, drop resolution, and history filtering as pure functions in `level3PlanRules.ts`. The level 3 store performs the same authorization before an atomic move and writes parent snapshots into history; the React module only manages row controls, drawer selection, and user feedback.

**Tech Stack:** Next.js 14, React 18, TypeScript, Zustand, Ant Design 6, dnd-kit, executable Node contract scripts.

---

## File map

- Modify `src/types/level3Plan.ts`: history parent snapshots and move authorization/result types.
- Modify `src/lib/level3PlanRules.ts`: drop resolution, authorization, move execution, and activity-history filtering.
- Modify `src/stores/level3Plan.ts`: store-side authorization and complete history snapshots.
- Modify `src/components/plans/Level3PlanModule.tsx`: per-row history button/drawer and centralized move invocation.
- Modify `scripts/verify-level3-plan.mjs`: executable rule, store, persistence, and UI contracts.
- Verify `src/containers/ProjectSpaceContainer.tsx`: existing SPM/admin lists remain the authority; no behavior change expected.

### Task 1: Define executable move and history rules

**Files:**
- Modify: `scripts/verify-level3-plan.mjs`
- Modify: `src/types/level3Plan.ts`
- Modify: `src/lib/level3PlanRules.ts`

- [ ] **Step 1: Write failing rule tests**

Add executable assertions covering all roles and drop shapes:

```js
const sameOwnerParent = { ...parent2, id: 'p3', responsible: '张三', activityName: '父活动3' }
const sameOwnerChild = { ...childC, id: 'c4', parentId: 'p3' }
const dragActivities = [parent, childA, childB, parent2, childC, sameOwnerParent, sameOwnerChild]

assert.deepEqual(
  rules.getLevel3MovePermission(childA, childC, dragActivities, { ...baseContext, spmUsers: ['张三'] }, false),
  { allowed: true },
)
assert.deepEqual(
  rules.getLevel3MovePermission(childA, childC, dragActivities, baseContext, false),
  { allowed: false, reason: '只能移动到相同负责人的一级活动' },
)
assert.deepEqual(
  rules.getLevel3MovePermission(childA, sameOwnerChild, dragActivities, baseContext, false),
  { allowed: true },
)
assert.equal(rules.getLevel3MovePermission(childA, childB, dragActivities, baseContext, false).allowed, true)
assert.equal(rules.getLevel3MovePermission(parent, parent2, dragActivities, baseContext, false).allowed, true)
assert.equal(rules.getLevel3MovePermission(childA, parent2, dragActivities, { ...baseContext, administratorUsers: ['张三'] }, true).allowed, false)

const appended = rules.moveLevel3Activity(dragActivities, 'c1', 'p2')
assert.equal(appended.ok, true)
assert.equal(appended.changed, true)
assert.equal(appended.activities.find(item => item.id === 'c1').parentId, 'p2')
assert.deepEqual(appended.activities.filter(item => item.parentId === 'p2').map(item => item.id), ['c3', 'c1'])
```

Add history filtering assertions:

```js
const scopedHistory = [
  { ...sourceHistory[0], id: 'parent-log', activityId: 'p1' },
  { ...sourceHistory[0], id: 'child-log', activityId: 'c1', parentActivityId: 'p1', parentActivityName: '父活动1' },
  { ...sourceHistory[0], id: 'move-log', activityId: 'c3', sourceParentActivityId: 'p1', targetParentActivityId: 'p2' },
  { ...sourceHistory[0], id: 'other-log', activityId: 'c4', parentActivityId: 'p3' },
]
assert.deepEqual(rules.filterLevel3HistoryForActivity(scopedHistory, parent, dragActivities).map(item => item.id), ['parent-log', 'child-log', 'move-log'])
assert.deepEqual(rules.filterLevel3HistoryForActivity(scopedHistory, childA, dragActivities).map(item => item.id), ['child-log'])
```

- [ ] **Step 2: Run the contract and observe RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because `getLevel3MovePermission`, `changed`, parent-drop behavior, history snapshot fields, or `filterLevel3HistoryForActivity` do not exist.

- [ ] **Step 3: Add exact types**

Extend `Level3ChangeLog` and move results:

```ts
export interface Level3ChangeLog {
  // existing fields
  parentActivityId?: string
  parentActivityName?: string
  sourceParentActivityId?: string
  sourceParentActivityName?: string
  targetParentActivityId?: string
  targetParentActivityName?: string
}

export interface Level3MovePermission {
  allowed: boolean
  reason?: string
}

export interface Level3MoveResult {
  ok: boolean
  changed?: boolean
  // existing result fields
}
```

- [ ] **Step 4: Implement pure permission, drop, and history functions**

Add `getLevel3MovePermission` with these explicit branches:

```ts
export function getLevel3MovePermission(
  active: Level3Activity | undefined,
  over: Level3Activity | undefined,
  activities: Level3Activity[],
  context: Level3PermissionContext,
  readOnly: boolean,
): Level3MovePermission {
  if (readOnly) return { allowed: false, reason: '跟随范围不支持拖动' }
  if (!active || !over || active.id === over.id) return { allowed: false, reason: '拖动位置未变化' }
  const elevated = context.administratorUsers.includes(context.currentUser) || context.spmUsers.includes(context.currentUser)
  if (!active.parentId) {
    if (over.parentId) return { allowed: false, reason: '一级活动只能在同级中拖动' }
    return getLevel3ActivityPermissions(active, activities, context).canDrag
      ? { allowed: true }
      : { allowed: false, reason: '无权限拖动该一级活动' }
  }
  const sourceParent = activities.find(item => item.id === active.parentId)
  const targetParent = over.parentId ? activities.find(item => item.id === over.parentId) : over
  if (!sourceParent || !targetParent || targetParent.parentId) return { allowed: false, reason: '目标一级活动已失效' }
  if (elevated) return { allowed: true }
  if (sourceParent.responsible !== context.currentUser) return { allowed: false, reason: '无权限拖动该二级活动' }
  if (sourceParent.id === targetParent.id || sourceParent.responsible === targetParent.responsible) return { allowed: true }
  return { allowed: false, reason: '只能移动到相同负责人的一级活动' }
}
```

Extend `moveLevel3Activity` so a child dropped on a parent uses `toParentId = over.id` and appends after all target children. Preserve parent-on-parent reordering and child-on-child insertion. Return `{ ok: true, changed: false }` when the normalized tree is unchanged.

Add `filterLevel3HistoryForActivity` so child rows match exact `activityId`, while parent rows match the parent activity itself, current child IDs, `parentActivityId`, `sourceParentActivityId`, or `targetParentActivityId`.

- [ ] **Step 5: Run rule contracts to GREEN**

Run: `npm run verify:level3-plan`

Expected: `Level 3 plan rule verification passed`.

- [ ] **Step 6: Commit rule behavior**

```bash
git add scripts/verify-level3-plan.mjs src/types/level3Plan.ts src/lib/level3PlanRules.ts
git commit -m "feat: define level3 cross-parent drag rules"
```

### Task 2: Enforce moves and persist complete history in the store

**Files:**
- Modify: `scripts/verify-level3-plan.mjs`
- Modify: `src/stores/level3Plan.ts`
- Modify: `src/lib/level3PlanRules.ts` only if a shared snapshot helper is required

- [ ] **Step 1: Write failing store tests**

Use a fresh store scope and assert both authorization and logs:

```js
const dragScope = 'drag-scope'
store.setState({
  ...store.getState(),
  activitiesByScope: { ...store.getState().activitiesByScope, [dragScope]: dragActivities },
  historyByScope: { ...store.getState().historyByScope, [dragScope]: [] },
})
const deniedMove = store.getState().moveActivity(dragScope, 'c1', 'c3', baseContext, false)
assert.equal(deniedMove.ok, false)
assert.equal(store.getState().historyByScope[dragScope].length, 0)

const allowedMove = store.getState().moveActivity(
  dragScope,
  'c1',
  'p2',
  { ...baseContext, administratorUsers: ['张三'] },
  false,
)
assert.equal(allowedMove.ok, true)
assert.equal(store.getState().activitiesByScope[dragScope].find(item => item.id === 'c1').parentId, 'p2')
const allowedMoveLog = store.getState().historyByScope[dragScope][0]
assert.equal(allowedMoveLog.action, 'move')
assert.equal(allowedMoveLog.sourceParentActivityId, 'p1')
assert.equal(allowedMoveLog.sourceParentActivityName, '父活动1')
assert.equal(allowedMoveLog.targetParentActivityId, 'p2')
assert.equal(allowedMoveLog.targetParentActivityName, '父活动2')
```

Add create/edit/delete assertions proving child logs contain `parentActivityId` and `parentActivityName`. Add a no-op move assertion proving history length does not change.

- [ ] **Step 2: Run the contract and observe RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because the store move signature does not accept permission context and existing logs omit parent snapshots.

- [ ] **Step 3: Change the store API and add snapshot helpers**

Update the store interface and implementation:

```ts
moveActivity: (
  scopeKey: string,
  activeId: string,
  overId: string,
  context: Level3PermissionContext,
  readOnly: boolean,
) => Level3MoveResult
```

Create a small helper that returns parent snapshot fields for a child:

```ts
const getParentHistorySnapshot = (activities: Level3Activity[], activity: Level3Activity) => {
  const parent = activity.parentId ? activities.find(item => item.id === activity.parentId) : undefined
  return parent ? { parentActivityId: parent.id, parentActivityName: parent.activityName } : {}
}
```

- [ ] **Step 4: Enforce authorization and write atomic move history**

Before calling `moveLevel3Activity`, resolve `active`, `over`, and call `getLevel3MovePermission`. Return the denial without mutating state. If `result.changed === false`, return without state/history updates.

For successful child moves, record source and target parent snapshots and human-readable changes:

```ts
changes: [
  { field: 'parentId', label: '所属一级活动', before: sourceParent?.activityName || '—', after: targetParent?.activityName || '—' },
  { field: 'number', label: '序号', before: beforeNumber, after: afterNumber },
]
```

Add parent snapshots to create, edit, followed actual-date edit, followed status/risk edit, and delete logs. Preserve optional fields through `cloneHistory`, follow-scope fork, persistence hydration, and migration.

- [ ] **Step 5: Run store contracts to GREEN**

Run: `npm run verify:level3-plan`

Expected: `Level 3 plan rule verification passed`, including permission denials, no-op behavior, and parent snapshots.

- [ ] **Step 6: Type-check and commit store behavior**

Run: `node node_modules/typescript/bin/tsc --noEmit`

Expected: exit 0.

```bash
git add scripts/verify-level3-plan.mjs src/stores/level3Plan.ts src/lib/level3PlanRules.ts src/types/level3Plan.ts
git commit -m "feat: persist authorized level3 cross-parent moves"
```

### Task 3: Add per-activity history UI and wire centralized dragging

**Files:**
- Modify: `scripts/verify-level3-plan.mjs`
- Modify: `src/components/plans/Level3PlanModule.tsx`

- [ ] **Step 1: Write failing UI source contracts**

Add focused assertions for the new row action and drawer:

```js
assert.ok(componentSource.includes('const [historyActivityId, setHistoryActivityId] = useState<string | null>(null)'))
assert.ok(componentSource.includes('filterLevel3HistoryForActivity(history, historyActivity, effectiveActivities)'))
assert.ok(componentSource.includes('aria-label={`查看活动历史 ${row.activityName}`}'))
assert.ok(componentSource.includes('readOnly') && componentSource.includes('查看活动历史'))
assert.ok(componentSource.includes('moveActivity(scopeKey, activeActivity.id, overActivity.id, permissionContext, readOnly)'))
assert.ok(!componentSource.includes('跨组拖动需要同时管理来源和目标一级活动'))
```

Slice the row-action branch and assert the history button is outside the `!readOnly` structural-action condition, so followed scopes keep history access.

- [ ] **Step 2: Run the contract and observe RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because row history state/button/filter and the new store call are absent.

- [ ] **Step 3: Add row history selection and shared rendering**

Add state and derived values:

```ts
const [historyActivityId, setHistoryActivityId] = useState<string | null>(null)
const historyActivity = effectiveActivities.find(activity => activity.id === historyActivityId)
const activityHistory = historyActivity
  ? filterLevel3HistoryForActivity(history, historyActivity, effectiveActivities)
  : EMPTY_HISTORY
```

Extract the existing history list into a local `renderHistoryRecords(records, emptyDescription)` renderer used by both drawers.

Add this button for every row, independent of edit/read-only state:

```tsx
<Tooltip title="查看历史">
  <Button
    type="text"
    size="small"
    icon={<HistoryOutlined />}
    aria-label={`查看活动历史 ${row.activityName}`}
    onClick={() => setHistoryActivityId(row.id)}
  />
</Tooltip>
```

Add an activity drawer titled `活动历史记录 · ${historyActivity?.activityName || ''}`. Closing it sets `historyActivityId` to `null`.

- [ ] **Step 4: Replace duplicate component authorization**

Keep the early checks for missing drag targets, then call only the store boundary:

```ts
const result = moveActivity(
  scopeKey,
  activeActivity.id,
  overActivity.id,
  permissionContext,
  readOnly,
)
if (!result.ok) {
  void messageApi.warning(result.reason || '拖动失败')
  return
}
if (result.changed !== false) void messageApi.success('活动顺序已更新')
```

Use `getLevel3ActivityPermissions` in `dragPermissions` so only users who can initiate structural drags receive handles; use `getLevel3MovePermission` after a concrete drop target exists. Parent rows remain valid drop targets for elevated users and matching parent owners.

- [ ] **Step 5: Run UI contracts and type-check to GREEN**

Run:

```bash
npm run verify:level3-plan
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit UI behavior**

```bash
git add scripts/verify-level3-plan.mjs src/components/plans/Level3PlanModule.tsx
git commit -m "feat: view activity history in level3 plans"
```

### Task 4: Regression, browser verification, and release

**Files:**
- Verify only unless a regression is found.

- [ ] **Step 1: Run complete focused verification**

```bash
npm run verify:level3-plan
npm run verify:level1-plan-governance
npm run verify:technical-plan
npm run verify:technical-project
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git diff --check
test -z "$(git status --porcelain)"
```

Expected: all commands exit 0; the build reports `Compiled successfully`.

- [ ] **Step 2: Run local browser scenarios**

Start a clean dev server on an unused port, then use the Playwright CLI to verify:

1. Super admin drags a child onto another parent row and into a target child position.
2. A first-level owner moves within its group and to a same-owner parent.
3. A first-level owner is rejected when the target parent has another responsible person.
4. Parent move carries children and renumbers the tree.
5. Parent history includes itself plus child create/edit/move history; child history is isolated.
6. Followed scopes show row history but no drag handles.
7. Refresh preserves hierarchy and history.
8. Browser console has no application errors.

- [ ] **Step 3: Re-run verification after any browser fix**

If browser verification requires a code change, add a failing contract first, apply the minimum fix, and re-run every command from Step 1 before committing.

- [ ] **Step 4: Push `dev` without force**

Fetch current refs, rebase only when the verified base tree matches, and push fast-forward:

```bash
git fetch origin dev master
git rebase origin/dev
git push origin HEAD:dev
```

Expected: `dev` advances without `--force`.

- [ ] **Step 5: Merge into latest `master` and verify tree identity**

Create a clean release worktree from `origin/master`, merge the verified feature branch with a merge commit, and assert the merged tree equals the verified feature tree before pushing `master`.

Expected: `master` advances without force and contains the exact verified production tree.

- [ ] **Step 6: Verify Vercel production**

Wait for the Git-integrated production deployment to reach `Ready`, inspect the deployment alias, and verify `https://pms-transsion.vercel.app/` in a fresh browser session. Check Vercel error logs since deployment and report the deployment URL, `dev` SHA, and `master` SHA.
