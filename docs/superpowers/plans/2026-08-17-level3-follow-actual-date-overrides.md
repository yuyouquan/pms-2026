# Level 3 Follow Overrides and Technical Mock Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authorized users to override both actual dates for an individual Level 3 child activity in a followed market or tOS type while untouched activities continue following the source and detached scopes retain the merged values; also restore global-admin access to technical project space and deliver a complete, migration-safe technical-project mock dataset.

**Architecture:** Keep Level 3 source activities canonical and add a persisted actual-date override map keyed by the selected follower scope and stable activity ID. Build the displayed activity list by overlaying frozen actual dates on source activities before parent rollups; materialize that merged list when a scope stops following. Structural controls remain read-only in follower scopes, while the two inline actual-date cells use the existing activity permissions. Keep “我的项目” membership filtering unchanged, but centralize project-space entry authorization so global admins bypass project roles. Seed technical projects, subprojects and published plan instances through versioned Zustand migrations that append missing seeds and preserve existing user values.

**Tech Stack:** Next.js 14, React 18, TypeScript, Zustand persist middleware, Ant Design 6, Day.js, existing Node verification scripts, Playwright CLI, Vercel CLI.

---

## File map

- `src/types/level3Plan.ts`: define the persisted override record and override map types.
- `src/lib/level3PlanRules.ts`: keep overlay creation, display merging and follower history merging as pure testable rules.
- `src/stores/level3Plan.ts`: persist overrides, freeze both current values on first edit, log changes in the follower scope and materialize overrides on detach.
- `src/components/plans/Level3PlanModule.tsx`: render merged activities and open only the two inline actual-date cells in a followed scope.
- `src/containers/ProjectSpaceContainer.tsx`: pass both selected and source scope keys, and add tOS type detach materialization to the existing market detach flow.
- `scripts/verify-level3-plan.mjs`: cover overlay, freezing, source updates, permissions, parent rollups, detach persistence and integration tokens.
- `src/lib/projectListFilters.ts`: expose the pure global-admin-aware project-space entry rule without changing “我的项目”.
- `src/containers/ProjectListContainer.tsx`: use the centralized entry rule for row/card navigation.
- `src/data/projects.ts`: complete four existing TDT rows and add four realistic TDT mock projects.
- `src/stores/project.ts`: migrate version-6 persisted project data to the expanded version-7 seed set without overwriting populated fields.
- `src/stores/technicalProject.ts`: seed ten active child projects plus one inactive historical child and merge missing seeds on migration.
- `src/stores/technicalPlan.ts`: seed published TDT and child-plan instances and append missing instances on migration while retaining the AI-Engine draft.
- `scripts/verify-project-list-refinement.mjs`: verify global-admin entry and unchanged membership-only “我的项目” behavior.
- `scripts/verify-technical-project.mjs`: verify technical row/child counts, complete configurations and technical-project persistence migration.
- `scripts/verify-technical-plan.mjs`: verify published technical plan seeds and plan-store migration.
- `scripts/verify-project-list-matrix.mjs`: verify that enriched TDT fields, active children and published plan snapshots reach the technical project table.

### Task 1: Add pure override types and rules

**Files:**
- Modify: `src/types/level3Plan.ts`
- Modify: `src/lib/level3PlanRules.ts`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Write failing rule assertions**

Add fixtures and assertions that express the desired behavior before adding production exports:

```js
const override = rules.createLevel3ActualDateOverride(
  { ...childA, actualStartDate: '2026-08-01', actualEndDate: '2026-08-05' },
  undefined,
  { actualStartDate: '2026-08-02' },
  '李四',
  '2026-08-17 12:00:00',
)
assert.deepEqual(override, {
  activityId: 'c1',
  actualStartDate: '2026-08-02',
  actualEndDate: '2026-08-05',
  detachedBy: '李四',
  detachedAt: '2026-08-17 12:00:00',
})

const merged = rules.mergeLevel3ActualDateOverrides(
  [{ ...childA, actualStartDate: '2026-08-03', actualEndDate: '2026-08-08' }, childB],
  { c1: override },
)
assert.equal(merged[0].actualStartDate, '2026-08-02')
assert.equal(merged[0].actualEndDate, '2026-08-05')
assert.notEqual(merged[0], childA)
assert.equal(merged[1].actualStartDate, childB.actualStartDate)

const cleared = rules.createLevel3ActualDateOverride(
  { ...childA, actualStartDate: '2026-08-01', actualEndDate: '2026-08-05' },
  undefined,
  { actualEndDate: '' },
  '李四',
  '2026-08-17 12:01:00',
)
assert.equal(cleared.actualStartDate, '2026-08-01')
assert.equal(cleared.actualEndDate, '')
```

- [ ] **Step 2: Run the rule verification and observe RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because `createLevel3ActualDateOverride` and `mergeLevel3ActualDateOverrides` are not exported.

- [ ] **Step 3: Add the override types**

Add to `src/types/level3Plan.ts`:

```ts
export interface Level3ActualDateOverride {
  activityId: string
  actualStartDate: string
  actualEndDate: string
  detachedBy: string
  detachedAt: string
}

export type Level3ActualDateOverrideMap = Record<string, Level3ActualDateOverride>
```

- [ ] **Step 4: Implement the minimal pure rules**

Add to `src/lib/level3PlanRules.ts`:

```ts
export function createLevel3ActualDateOverride(
  displayedActivity: Level3Activity,
  existing: Level3ActualDateOverride | undefined,
  patch: Pick<Partial<Level3Activity>, 'actualStartDate' | 'actualEndDate'>,
  actor: string,
  occurredAt: string,
): Level3ActualDateOverride {
  const frozen = existing || {
    activityId: displayedActivity.id,
    actualStartDate: displayedActivity.actualStartDate,
    actualEndDate: displayedActivity.actualEndDate,
    detachedBy: actor,
    detachedAt: occurredAt,
  }
  return {
    ...frozen,
    ...patch,
    activityId: displayedActivity.id,
    detachedBy: actor,
    detachedAt: occurredAt,
  }
}

export function mergeLevel3ActualDateOverrides(
  activities: Level3Activity[],
  overrides: Level3ActualDateOverrideMap,
): Level3Activity[] {
  return activities.map(activity => {
    const override = overrides[activity.id]
    return override
      ? { ...activity, actualStartDate: override.actualStartDate, actualEndDate: override.actualEndDate }
      : { ...activity }
  })
}
```

- [ ] **Step 5: Add parent-rollup and existing-override assertions**

Verify a second edit preserves the already frozen counterpart and verify `applyLevel3Rollups(mergeLevel3ActualDateOverrides(...))` uses the overridden child dates for the parent minimum start and maximum end.

- [ ] **Step 6: Run GREEN and type-check**

Run: `npm run verify:level3-plan && npx tsc --noEmit`

Expected: both commands exit 0.

- [ ] **Step 7: Commit the pure rules**

```bash
git add scripts/verify-level3-plan.mjs src/types/level3Plan.ts src/lib/level3PlanRules.ts
git commit -m "feat: add level3 actual date override rules"
```

### Task 2: Persist follower overrides and history

**Files:**
- Modify: `src/stores/level3Plan.ts`
- Modify: `src/lib/level3PlanRules.ts`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Add failing store-contract assertions**

Require these tokens in the store source and add a pure materialization assertion:

```js
for (const token of [
  'actualOverridesByScope',
  'updateFollowActualDates',
  'mergeLevel3ActualDateOverrides',
  'LEVEL3_PLAN_STORE_VERSION = 2',
]) assert.ok(storeSource.includes(token), `missing ${token}`)

const materialized = rules.forkLevel3ScopeData(
  { activities: [parent, childA], history: sourceHistory, collapsedIds: [], columnSettings: defaultColumns },
  { activities: [], history: targetHistory, collapsedIds: [], columnSettings: targetColumns },
  { c1: override },
)
assert.equal(materialized.activities.find(item => item.id === 'c1').actualStartDate, '2026-08-02')
assert.equal(materialized.activities.find(item => item.id === 'c1').actualEndDate, '2026-08-05')
assert.deepEqual(materialized.history.map(item => item.id), ['source-log', 'target-log'])
```

- [ ] **Step 2: Run verification and observe RED**

Run: `npm run verify:level3-plan`

Expected: FAIL at the first missing store token or the new third `forkLevel3ScopeData` argument.

- [ ] **Step 3: Extend state and actions**

Add to the store interfaces:

```ts
actualOverridesByScope: Record<string, Level3ActualDateOverrideMap>

updateFollowActualDates: (
  sourceScopeKey: string,
  selectedScopeKey: string,
  activityId: string,
  patch: Pick<Partial<Level3Activity>, 'actualStartDate' | 'actualEndDate'>,
  actor: string,
) => boolean
```

Initialize `actualOverridesByScope` to `{}` and include it in `partialize`.

- [ ] **Step 4: Implement freeze-on-first-edit**

Inside `updateFollowActualDates`, merge the current source activities with existing follower overrides, find the displayed activity, call `createLevel3ActualDateOverride`, reject an invalid non-empty start/end pair, and write the result to `actualOverridesByScope[selectedScopeKey]`. Build field changes from the displayed activity to the merged next activity and prepend an `edit` history entry to `historyByScope[selectedScopeKey]`.

Use this exact invariant:

```ts
const previousDisplayed = mergeLevel3ActualDateOverrides(sourceActivities, currentOverrides)
  .find(activity => activity.id === activityId)
const nextOverride = createLevel3ActualDateOverride(
  previousDisplayed,
  currentOverrides[activityId],
  patch,
  actor,
  occurredAt,
)
if (
  nextOverride.actualStartDate
  && nextOverride.actualEndDate
  && nextOverride.actualStartDate > nextOverride.actualEndDate
) return state
```

- [ ] **Step 5: Materialize overrides during detach**

Extend `forkLevel3ScopeData(source, target, overrides = {})` to merge overrides into cloned source activities. In `forkFollowScope`, pass `state.actualOverridesByScope[targetScopeKey]`, write the merged activities/history and remove `targetScopeKey` from `actualOverridesByScope` only after materialization succeeds.

- [ ] **Step 6: Add a persistence migration**

Set `LEVEL3_PLAN_STORE_VERSION = 2` and add a `migrate` callback that preserves existing version-1 activities, history, collapse state and column settings while defaulting `actualOverridesByScope` to `{}`. Do not discard existing local Level 3 data.

- [ ] **Step 7: Run GREEN and type-check**

Run: `npm run verify:level3-plan && npx tsc --noEmit`

Expected: exit 0 with override and materialization assertions passing.

- [ ] **Step 8: Commit store behavior**

```bash
git add scripts/verify-level3-plan.mjs src/lib/level3PlanRules.ts src/stores/level3Plan.ts
git commit -m "feat: persist followed level3 actual dates"
```

### Task 3: Render merged data and enable only inline actual-date editing

**Files:**
- Modify: `src/components/plans/Level3PlanModule.tsx`
- Modify: `src/lib/level3PlanRules.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Add failing component-contract assertions**

Add assertions requiring `selectedScopeKey`, `mergeLevel3ActualDateOverrides`, `updateFollowActualDates`, and a read-only branch inside `handleInlineActualDateChange`. Keep the existing assertions that follower scopes do not render the notice or create button.

- [ ] **Step 2: Run verification and observe RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because `Level3PlanModule` has no selected follower scope or override action.

- [ ] **Step 3: Pass both scope keys from the container**

Extend component props and usage:

```tsx
<Level3PlanModule
  scopeKey={level3ScopeResolution.scopeKey}
  selectedScopeKey={level3ScopeResolution.selectedScopeKey}
  readOnly={level3ScopeResolution.readOnly}
  // existing props remain unchanged
/>
```

- [ ] **Step 4: Build the effective activity list**

Read `sourceActivities` from `activitiesByScope[scopeKey]`, overrides from `actualOverridesByScope[selectedScopeKey]`, and compute:

```ts
const activities = useMemo(
  () => mergeLevel3ActualDateOverrides(sourceActivities, actualOverrides),
  [actualOverrides, sourceActivities],
)
```

Use `activities` for numbering, permissions, filters, export and `applyLevel3Rollups`. In follower mode, combine source history with `historyByScope[selectedScopeKey]` by stable log ID so actual-time edits appear in the history drawer.

- [ ] **Step 5: Open only the actual date cells**

Keep activity action buttons, create, drag and double-click modal editing guarded by `!readOnly`. Change actual-date permission so a child row can be edited in follower mode when `getLevel3ActivityPermissions(...).canEdit` is true. Parent rows remain aggregated and non-editable.

Route edits explicitly:

```ts
if (readOnly) {
  updateFollowActualDates(scopeKey, selectedScopeKey, row.id, { [field]: value }, currentUser)
} else {
  updateActivity(scopeKey, row.id, { [field]: value }, currentUser)
}
```

- [ ] **Step 6: Keep date validation on the effective row**

Continue using the merged row values for the Day.js disabled-date constraints so the frozen counterpart controls the edited field. Show the existing success message only when the store action returns true.

- [ ] **Step 7: Run GREEN and integration checks**

Run:

```bash
npm run verify:level3-plan
npx tsc --noEmit
node scripts/verify-plan-workspace-shell.mjs
node scripts/verify-tos-type-integration.mjs
```

Expected: all four commands exit 0.

- [ ] **Step 8: Commit the UI integration**

```bash
git add scripts/verify-level3-plan.mjs src/components/plans/Level3PlanModule.tsx src/lib/level3PlanRules.ts src/containers/ProjectSpaceContainer.tsx
git commit -m "feat: edit followed level3 actual dates"
```

### Task 4: Materialize tOS type detach as well as market detach

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Add a failing tOS detach integration assertion**

Require the tOS save path to contain `previousTosTypeRows`, `unfollowedTosTypes`, `resolveLevel3DetachedScopeFork`, and `forkFollowScope` near `saveTosTypeConfig`.

- [ ] **Step 2: Run verification and observe RED**

Run: `npm run verify:level3-plan`

Expected: FAIL because only market detach currently calls `forkFollowScope`.

- [ ] **Step 3: Detect tOS follow-to-independent transitions**

At the start of `saveTosTypeConfig`, capture `previousRows = getCurrentTosTypeRows()` and `previousMainType = getMainTosType(previousRows)`. After normalization compute types previously following and types still following, then derive `unfollowedTosTypes`.

- [ ] **Step 4: Materialize each detached tOS type**

After project update succeeds, call `resolveLevel3DetachedScopeFork` with `kind: 'tosType'`, the previous and next main types, and the row follow flags. Call `forkFollowScope` for each non-null result. This automatically applies and clears the target type's overrides through Task 2.

- [ ] **Step 5: Verify both detach paths**

Run: `npm run verify:level3-plan && npx tsc --noEmit`

Expected: market and tOS detach integration assertions pass.

- [ ] **Step 6: Commit tOS detach support**

```bash
git add scripts/verify-level3-plan.mjs src/containers/ProjectSpaceContainer.tsx
git commit -m "fix: retain level3 dates after type detach"
```

### Task 5: Restore global-admin entry to technical project space

**Files:**
- Modify: `src/lib/projectListFilters.ts`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `scripts/verify-project-list-refinement.mjs`

- [ ] **Step 1: Add failing runtime access assertions**

Import `loadTypeScriptModule` from `scripts/lib/source-contract.mjs`, load `src/lib/projectListFilters.ts`, and replace the static assertion for the old inline `matchesAboutMine` callback with:

```js
const filters = loadTypeScriptModule(root, 'src/lib/projectListFilters.ts')
const rolesByProject = { tech: [{ members: ['李四'] }] }

assert.equal(
  filters.canEnterProjectSpace('tech', '张三', rolesByProject, true),
  true,
  'global admin can enter a technical project without a project role',
)
assert.equal(
  filters.canEnterProjectSpace('tech', '张三', rolesByProject, false),
  false,
  'normal user without a project role remains blocked',
)
assert.equal(
  filters.canEnterProjectSpace('tech', '李四', rolesByProject, false),
  true,
  'project role member can still enter',
)
assert.equal(
  filters.matchesAboutMine('tech', '张三', rolesByProject),
  false,
  'global-admin status does not make every project appear under 我的项目',
)
assert.match(projectList, /canEnterProjectSpace\([\s\S]*isAdminUser/, 'project navigation uses the shared access rule')
```

- [ ] **Step 2: Run the access verification and observe RED**

Run: `node scripts/verify-project-list-refinement.mjs`

Expected: FAIL because `canEnterProjectSpace` is not exported and the project-list container still calls `matchesAboutMine` directly.

- [ ] **Step 3: Implement the pure entry rule**

Add to `src/lib/projectListFilters.ts` without changing `filterProjectsForList`:

```ts
export function canEnterProjectSpace(
  projectId: string,
  currentLoginUser: string,
  rolesByProject: ProjectPermissionRolesByProject,
  isGlobalAdmin: boolean,
) {
  return isGlobalAdmin || matchesAboutMine(projectId, currentLoginUser, rolesByProject)
}
```

This deliberately affects navigation only; `filterProjectsForList` must continue using `matchesAboutMine` so “我的项目” stays membership-based.

- [ ] **Step 4: Route every project-list entry through the rule**

Import `canEnterProjectSpace` in `src/containers/ProjectListContainer.tsx` and replace the local callback with:

```ts
const canEnterProject = (projectId: string) => canEnterProjectSpace(
  projectId,
  currentLoginUser,
  rolesByProject,
  isAdminUser,
)
```

Keep both card and table-row entry paths calling this same callback.

- [ ] **Step 5: Run GREEN and type-check**

Run:

```bash
node scripts/verify-project-list-refinement.mjs
npx tsc --noEmit
```

Expected: both commands exit 0, with normal project-role behavior unchanged.

- [ ] **Step 6: Commit the access fix**

```bash
git add scripts/verify-project-list-refinement.mjs src/lib/projectListFilters.ts src/containers/ProjectListContainer.tsx
git commit -m "fix: allow global admins into technical projects"
```

### Task 6: Expand technical project, child and plan mock seeds

**Files:**
- Modify: `src/data/projects.ts`
- Modify: `src/stores/project.ts`
- Modify: `src/stores/technicalProject.ts`
- Modify: `src/stores/technicalPlan.ts`
- Modify: `scripts/verify-technical-project.mjs`
- Modify: `scripts/verify-technical-plan.mjs`
- Modify: `scripts/verify-project-list-matrix.mjs`
- Modify: `scripts/verify-project-list-refinement.mjs`

- [ ] **Step 1: Add failing dataset and row-projection assertions**

Extend the verification scripts before changing the seed data. Assert these exact contracts:

```js
const technicalProjects = projects.initialProjects.filter(project => project.type === '技术项目')
assert.equal(technicalProjects.length, 8, 'eight TDT projects are available')
for (const project of technicalProjects) {
  for (const field of ['technicalTrack', 'tmg', 'subdomain', 'technicalLead', 'technicalProjectManager']) {
    assert.ok(String(project[field] || '').trim(), `${project.id} has ${field}`)
  }
}

const activeChildren = technicalProject.INITIAL_TECHNICAL_SUBPROJECTS.filter(item => item.active)
const inactiveChildren = technicalProject.INITIAL_TECHNICAL_SUBPROJECTS.filter(item => !item.active)
assert.equal(activeChildren.length, 10, 'ten active child projects are available')
assert.equal(inactiveChildren.length, 1, 'one inactive historical child remains available')
for (const child of activeChildren) {
  assert.equal(rules.isTechnicalSubprojectConfigured(child), true, `${child.id} is fully configured`)
}

const seededPlanKeys = Object.keys(technicalPlan.INITIAL_TECHNICAL_PLANS)
assert.equal(seededPlanKeys.filter(key => key.endsWith(':tdt')).length, 8)
assert.equal(seededPlanKeys.filter(key => key.includes(':subproject:')).length, 10)
for (const instance of Object.values(technicalPlan.INITIAL_TECHNICAL_PLANS)) {
  assert.ok(instance.versions.some(version => version.status === '已发布'), `${instance.planKey} has a published snapshot`)
}
assert.ok(
  technicalPlan.INITIAL_TECHNICAL_PLANS['9:tdt'].versions.some(version => version.status === '修订中'),
  'AI-Engine keeps its draft in addition to the published version',
)
```

In `scripts/verify-project-list-matrix.mjs`, build rows from the seed stores and assert eight TDT root rows, ten active child rows, non-placeholder TDT display fields, and published plan-node/stage values for every root and active child.

- [ ] **Step 2: Add failing migration assertions**

Cover all three previously persisted store versions:

```js
const migratedProjects = projectStore.migrateProjectState({
  projects: [{ ...existingTechProject, technicalTrack: '用户自定义赛道' }],
  projectListView: 'list',
}, 6).projects
assert.equal(migratedProjects.filter(project => project.type === '技术项目').length, 8)
assert.equal(migratedProjects.find(project => project.id === existingTechProject.id).technicalTrack, '用户自定义赛道')

const migratedChildren = technicalProject.migrateTechnicalProjectState({
  subprojects: [{ ...customizedChild, name: '用户自定义名称' }],
}, 2).subprojects
assert.equal(migratedChildren.length, 11)
assert.equal(migratedChildren.find(item => item.id === customizedChild.id).name, '用户自定义名称')

const migratedPlans = technicalPlan.migrateTechnicalPlanState({
  plansByKey: { [customPlan.planKey]: customPlan },
}, 5).plansByKey
assert.equal(Object.keys(migratedPlans).length, 18)
assert.equal(migratedPlans[customPlan.planKey].versions[0].id, customPlan.versions[0].id)
```

- [ ] **Step 3: Run the focused scripts and observe RED**

Run:

```bash
node scripts/verify-technical-project.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-project-list-matrix.mjs
node scripts/verify-project-list-refinement.mjs
```

Expected: FAIL on project/child/plan counts and the version-6/2/5 migration assertions.

- [ ] **Step 4: Complete the eight TDT project fixtures**

In `src/data/projects.ts`, populate the five technical table fields on the four current TDT rows with these values:

| ID | Project | technicalTrack | tmg | subdomain | technicalLead | technicalProjectManager |
| --- | --- | --- | --- | --- | --- | --- |
| `4` | X6876_H786 | 芯片平台前瞻 | 基础架构TMG | 芯片适配 | 孙七 | 李四 |
| `9` | AI-Engine-V2 | AIOS | 系统应用 | 端侧AI引擎 | 李四 | 张三 |
| `20` | 基础架构-项目2 | 基础架构 | 基础架构TMG | 系统框架 | 李四 | 赵六 |
| `21` | 影像-项目1 | 计算影像 | 系统应用 | 影像算法 | 王五 | 孙七 |

Add four TDT projects using IDs `mock-tech-aios-v3`, `mock-tech-perf-power`, `mock-tech-system-experience`, and `mock-tech-6g-prestudy`, named respectively `AIOS架构演进V3`, `端侧性能功耗协同优化`, `下一代系统体验`, and `6G通信预研`. Give every new fixture a non-empty status, progress, leader, spm, plan dates, product line, domain, tOS versions, description, team members and all five technical table fields. Use only existing mock users and statuses already accepted by the technical project table.

- [ ] **Step 5: Seed ten configured active children plus one inactive child**

Keep `IPM-AI-001` and fill `IPM-AI-002`. Add eight configured active records with stable IDs and parent relationships:

```ts
[
  ['IPM-BASE-001', '20', '新一代任务调度'],
  ['IPM-BASE-002', '20', '系统服务治理'],
  ['IPM-IMAGE-001', '21', '夜景计算摄影'],
  ['IPM-IMAGE-002', '21', '端侧视频增强'],
  ['IPM-AIOS-001', 'mock-tech-aios-v3', '分布式服务框架'],
  ['IPM-POWER-001', 'mock-tech-perf-power', '智能能效调度'],
  ['IPM-UX-001', 'mock-tech-system-experience', '高帧动效引擎'],
  ['IPM-6G-001', 'mock-tech-6g-prestudy', '6G协议验证平台'],
]
```

Each active child gets a complete `configuration` with an allowed core value, allowed development mode, a non-empty first tOS version and an existing whole-machine project ID. Retain inactive `IPM-AI-003` unchanged as historical data.

- [ ] **Step 6: Seed deterministic published plans**

Import `buildSubprojectTemplateTasks` beside `buildTdtTemplateTasks`. Add pure seed builders that accept a plan key, template kind, project index and optional draft flag; assign deterministic date offsets to every task and derive stable version IDs from the sanitized plan key.

Build `INITIAL_TECHNICAL_PLANS` from:

```ts
const SEEDED_TDT_PROJECT_IDS = [
  '4', '9', '20', '21',
  'mock-tech-aios-v3', 'mock-tech-perf-power',
  'mock-tech-system-experience', 'mock-tech-6g-prestudy',
] as const

const SEEDED_ACTIVE_SUBPROJECTS = INITIAL_TECHNICAL_SUBPROJECTS.filter(item => item.active)
```

Create one `已发布` TDT instance per root project and one `已发布` subproject instance per active child. Only `9:tdt` also contains its existing `V2` `修订中` version and keeps that draft as `currentVersionId`; every other instance points to its published version. Use the existing TDT/subproject templates, numbering and maximum-depth constraints.

- [ ] **Step 7: Add append-only, non-destructive migrations**

Implement these version transitions:

- project store `version: 7`: for persisted versions below 7, merge missing seed projects by ID and fill only blank/missing seeded fields on existing project IDs; preserve every non-empty persisted value and every user-created project;
- technical-project store `TECHNICAL_PROJECT_STORE_VERSION = 3`: after sanitizing persisted children, append seed children whose IDs are absent; keep persisted records with matching IDs unchanged;
- technical-plan store `TECHNICAL_PLAN_STORE_VERSION = 6`: after sanitizing persisted instances, append seed plan keys that are absent; keep persisted instances with matching keys unchanged.

Use small helpers instead of replacing whole records:

```ts
const appendMissingById = <T extends { id: string }>(persisted: T[], seeds: readonly T[]) => {
  const ids = new Set(persisted.map(item => item.id))
  return [...persisted, ...seeds.filter(seed => !ids.has(seed.id))]
}

const appendMissingPlans = (persisted: TechnicalPlansByKey, seeds: TechnicalPlansByKey) => ({
  ...clonePlans(seeds),
  ...persisted,
})
```

Update the project store `merge` call to migrate with the current version constant/value so a version-6 browser cache actually receives the new seeds.

- [ ] **Step 8: Run GREEN, projection checks and type-check**

Run:

```bash
node scripts/verify-technical-project.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-project-list-matrix.mjs
node scripts/verify-project-list-refinement.mjs
npx tsc --noEmit
```

Expected: all commands exit 0; the technical list receives eight complete root rows and ten active child rows, and customized persisted fixtures survive migration.

- [ ] **Step 9: Commit the mock refresh**

```bash
git add src/data/projects.ts src/stores/project.ts src/stores/technicalProject.ts src/stores/technicalPlan.ts scripts/verify-technical-project.mjs scripts/verify-technical-plan.mjs scripts/verify-project-list-matrix.mjs scripts/verify-project-list-refinement.mjs
git commit -m "feat: expand technical project mock data"
```

### Task 7: Browser regression and production build

**Files:**
- Verify only unless a browser-discovered defect requires a focused test-first fix.

- [ ] **Step 1: Run the complete automated gate**

Run sequentially:

```bash
npm run verify:level3-plan
npx tsc --noEmit
node scripts/verify-plan-workspace-shell.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-project-list-refinement.mjs
node scripts/verify-technical-project.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-project-list-matrix.mjs
npm run build
git diff --check
```

Expected: every command exits 0. `npm run lint` may still open the repository's pre-existing ESLint setup prompt and is not used as a release signal.

- [ ] **Step 2: Start the app and test a whole-machine follower**

Run `npm run dev`, open the app with Playwright, enter X6877 → 计划 → 三级计划, create two child activities in OP and set both actual dates. Configure TR to follow OP.

Verify in TR:

- source activities and dates are visible;
- no follow notice, create, edit, delete or drag controls are available;
- authorized user can edit the two child actual-date cells;
- changing only one field freezes both current displayed values;
- parent actual dates aggregate from the effective child values.

- [ ] **Step 3: Verify source changes and detach**

Change both OP actual dates for the overridden child and one untouched child. Return to TR and verify the overridden child's two values remain frozen while the untouched child updates. Detach TR and verify values/history remain and structural controls return. Modify TR again and verify OP is unaffected.

- [ ] **Step 4: Verify permissions and tOS type behavior**

Switch to an unauthorized user and verify both actual-date cells are read-only. Repeat the inheritance, one-field freeze and detach preservation flow for a followed tOS type.

- [ ] **Step 5: Verify technical project access and enriched data**

In a fresh session, switch to the global-admin user 张三, open 全部项目 → 技术项目, and verify all eight TDT project rows render their technical fields. Enter `基础架构-项目2` from both the table row and project name, verify the project space opens, then return and enter one of the new TDT projects. Verify active child rows expand, inactive history remains non-entry data, and published plan nodes/stages are visible.

Switch to a normal user without a role on `基础架构-项目2` and verify entry is still blocked. Assign/use a normal user with a project role and verify entry succeeds. Enable “我的项目” as 张三 and verify it still contains only explicitly assigned projects rather than all eight global-admin-accessible TDT projects.

- [ ] **Step 6: Check browser errors**

Open a fresh browser session after all hot reloads and verify zero console errors on both the Level 3 plan page and technical project list/detail flows.

- [ ] **Step 7: Commit any focused browser fix and rerun the full gate**

If a defect is found, first add a failing assertion reproducing it, then implement the minimal fix, rerun the full gate and commit only the affected files.

### Task 8: Publish dev, master and Vercel

**Files:**
- No source changes expected.

- [ ] **Step 1: Fetch and protect the dirty main checkout**

Run `git fetch --prune origin`, compare feature-changed paths with the main checkout's dirty paths, and only fast-forward `dev` when they do not overlap. Do not stash, reset, clean or overwrite user files.

- [ ] **Step 2: Push dev**

Fast-forward local `dev` to the verified feature branch and run `git push origin dev`. Confirm local and remote `dev` resolve to the same commit.

- [ ] **Step 3: Merge the latest master in an isolated release worktree**

Create a temporary branch from current `origin/master`, merge `origin/dev` without rewriting history, install dependencies and rerun Task 7 Step 1 on the merged result.

- [ ] **Step 4: Push master without force**

Run `git push origin HEAD:master` only after confirming `origin/master` is an ancestor of the tested release merge.

- [ ] **Step 5: Deploy production**

Use the existing `.vercel/project.json` binding for project `pms-2026`, deploy the tested master merge with a pinned Vercel CLI, and wait for status `READY`.

- [ ] **Step 6: Verify production**

Confirm `https://pms-transsion.vercel.app` returns HTTP 200, open X6877 → 计划 → 三级计划 in a fresh browser, verify the followed actual-date behavior and zero console errors, then scan deployment runtime logs for errors from the last hour.

- [ ] **Step 7: Record release evidence**

Report the `dev` commit, `master` merge commit, deployment URL, Vercel status, framework/build result, browser result and any pre-existing dependency warnings. Preserve the user's original dirty checkout and remove only worktrees created for this delivery.
