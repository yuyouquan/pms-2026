# Level3 Template Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add versioned level-3 plan templates for whole-machine and tOS projects, initialize newly added markets/types once from the latest published template, fix clipped configuration tabs, release to production, and update the Feishu PRD with verified screenshots.

**Architecture:** Keep the existing configuration-center version lifecycle in `usePlanStore`, but add a dedicated level-3 template activity model and pure rules module. Render the template through a focused table component that shares the project-space column contract, then materialize published template snapshots into the existing `useLevel3PlanStore` through an idempotent scope initializer called by market/type save flows.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4 persist middleware, dnd-kit, Node verification scripts, Puppeteer browser checks, Vercel, Feishu Docx via `lark-cli`.

---

## File map

- Create `src/types/level3Template.ts`: template-only activity and initialization result types.
- Create `src/lib/level3TemplateRules.ts`: seeds, numbering, depth validation, milestone option resolution, template-to-project materialization, and project-type support rules.
- Create `src/components/plans/Level3TemplateTable.tsx`: fixed 15-column template table with only activity name and key node editable.
- Create `scripts/verify-level3-template-config.mjs`: executable domain/store/source contracts and persistence migration coverage.
- Create `screenshots/verify-level3-template-config-browser.mjs`: local browser workflow and screenshot capture.
- Modify `src/types/level3Plan.ts`: reuse/export the shared project-space column contract where needed.
- Modify `src/stores/plan.ts`: persisted level-3 template tasks, version scopes, snapshots, actions, and migration.
- Modify `src/stores/level3Plan.ts`: idempotent `initializeScopeFromTemplate` action.
- Modify `src/components/plans/Level3PlanModule.tsx`: table/Gantt switching in project-space view and revision states.
- Modify `src/components/shared/PlanHelpers.tsx`: expose actual dates to shared Gantt columns.
- Modify `src/containers/ConfigContainer.tsx`: new tabs, level-3 lifecycle wiring, latest L1 milestone options, and specialized table rendering.
- Modify `src/containers/ProjectSpaceContainer.tsx`: initialize newly added markets and tOS types.
- Modify `src/styles/globals.css`: stop header/tab/toolbars from shrinking and assign scrolling to the table card.
- Modify `package.json`: register the new verification commands.
- Modify `docs/superpowers/specs/2026-08-19-level3-template-config-design.md`: only if implementation uncovers a contradiction; otherwise keep unchanged.
- Update Feishu document `ZhEkd67WAotJfvxoDBGcLjtZnYg` after production verification.

### Task 1: Add failing domain contracts

**Files:**
- Create: `scripts/verify-level3-template-config.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing verifier**

Create a Node verifier that loads TypeScript modules using the repository's existing `typescript.transpileModule` pattern and asserts the intended API before it exists:

```js
assert.equal(rules.supportsLevel3Template('整机产品项目'), true)
assert.equal(rules.supportsLevel3Template('tOS版本项目'), true)
assert.equal(rules.supportsLevel3Template('能力建设项目'), false)
assert.equal(rules.supportsLevel3Template('技术项目'), false)

assert.deepEqual(
  rules.getLevel3TemplateMilestoneOptions([
    { id: 'stage', taskName: '阶段', order: 0 },
    { id: 'node-a', parentId: 'stage', taskName: '节点A', order: 0 },
    { id: 'node-b', parentId: 'stage', taskName: '节点B', order: 1 },
  ]),
  [
    { value: 'node-a', label: '节点A' },
    { value: 'node-b', label: '节点B' },
  ],
)

const initialized = rules.materializeLevel3Template(template, {
  actor: '系统管理员',
  initializedAt: '2026-08-19 09:00:00',
  projectMilestones: [{ id: 'node-a', name: '节点A', planEndDate: '2026-10-01' }],
})
assert.equal(initialized[0].status, '待启动')
assert.equal(initialized[0].risk, '无')
assert.equal(initialized[0].responsible, '')
assert.equal(initialized[1].milestonePlanEndDate, '2026-10-01')
assert.throws(() => rules.normalizeLevel3TemplateActivities(threeLevelRows), /最多支持两级活动/)
```

Add the command:

```json
"verify:level3-template": "node scripts/verify-level3-template-config.mjs"
```

- [ ] **Step 2: Run the verifier and confirm RED**

Run: `npm run verify:level3-template`

Expected: FAIL because `src/lib/level3TemplateRules.ts` and its exported functions do not exist.

- [ ] **Step 3: Commit the red contract**

```bash
git add package.json scripts/verify-level3-template-config.mjs
git commit -m "test: define level3 template contracts"
```

### Task 2: Implement template types and pure rules

**Files:**
- Create: `src/types/level3Template.ts`
- Create: `src/lib/level3TemplateRules.ts`
- Modify: `src/types/level3Plan.ts`
- Test: `scripts/verify-level3-template-config.mjs`

- [ ] **Step 1: Define the template-only type**

```ts
export interface Level3TemplateActivity {
  id: string
  parentId: string | null
  order: number
  activityName: string
  milestoneId: string
  milestoneName: string
  source: 'template' | 'custom'
}

export interface Level3TemplateMaterializeContext {
  actor: string
  initializedAt: string
  projectMilestones: Level3Milestone[]
}
```

- [ ] **Step 2: Implement pure rules minimally**

Implement these exact exports:

```ts
export const supportsLevel3Template = (projectType: string): boolean => {
  const family = getProjectTypeFamilyKey(projectType)
  return family === PROJECT_CATEGORY_MACHINE || family === PROJECT_CATEGORY_TOS_VERSION
}

export interface Level1TemplateTaskLike {
  id?: unknown
  parentId?: unknown
  taskName?: unknown
  order?: unknown
}

export function getLevel3TemplateMilestoneOptions(tasks: readonly Level1TemplateTaskLike[]) {
  return tasks
    .filter(task => Boolean(task.parentId && task.id && task.taskName?.trim()))
    .map(task => ({ value: String(task.id), label: String(task.taskName).trim() }))
}

export function materializeLevel3Template(
  template: readonly Level3TemplateActivity[],
  context: Level3TemplateMaterializeContext,
): Level3Activity[] {
  const milestones = new Map(context.projectMilestones.map(item => [item.id, item]))
  return normalizeLevel3TemplateActivities(template).map(item => ({
    id: item.id,
    parentId: item.parentId,
    order: item.order,
    activityName: item.activityName.trim(),
    responsible: '',
    responsibleDepartment: '',
    planStartDate: '',
    planEndDate: '',
    actualStartDate: '',
    actualEndDate: '',
    milestoneId: item.milestoneId,
    milestoneName: item.milestoneName,
    milestonePlanEndDate: milestones.get(item.milestoneId)?.planEndDate || '',
    status: '待启动',
    risk: '无',
    remark: '',
    creator: context.actor,
    createdAt: context.initializedAt,
    updatedBy: context.actor,
    updatedAt: context.initializedAt,
  }))
}
```

`normalizeLevel3TemplateActivities` must reject orphan parents and depth greater than two, normalize sibling order, and return parents followed by their children. Add a deterministic default template seed using the four existing level-3 mock parent groups and stable L1 milestone IDs.

- [ ] **Step 3: Run domain verifier and confirm GREEN**

Run: `npm run verify:level3-template`

Expected: PASS for project-type support, milestone options, materialization defaults, and depth rejection.

- [ ] **Step 4: Commit pure domain code**

```bash
git add src/types/level3Template.ts src/types/level3Plan.ts src/lib/level3TemplateRules.ts scripts/verify-level3-template-config.mjs
git commit -m "feat: add level3 template domain rules"
```

### Task 3: Persist versioned level-3 templates

**Files:**
- Modify: `src/stores/plan.ts`
- Modify: `src/lib/projectTemplateCompatibility.ts`
- Test: `scripts/verify-level3-template-config.mjs`

- [ ] **Step 1: Extend the failing verifier for store state and migration**

Add assertions that a fresh store contains independent whole-machine and tOS template arrays, version scopes for `level3`, and published snapshots; then pass a version-4 persisted fixture with custom L1 data through `migratePlanStoreState` and assert the L1 data is unchanged while level-3 defaults are added.

```js
assert.notStrictEqual(
  state.level3TemplateTasksByType['整机产品项目'],
  state.level3TemplateTasksByType['tOS版本项目'],
)
assert.ok(state.configTemplateVersionScopes['config-template::整机产品项目::level3'])
assert.ok(state.publishedSnapshots['template::整机产品项目::level3::v1'])
assert.deepEqual(migrated.configTemplateTasksByType['整机产品项目'], customLevel1Tasks)
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:level3-template`

Expected: FAIL because `level3TemplateTasksByType` and its actions are absent.

- [ ] **Step 3: Add state and actions**

Increment `PLAN_STORE_VERSION` and add:

```ts
level3TemplateTasksByType: Record<string, Level3TemplateActivity[]>
setLevel3TemplateTasks: (
  projectType: string,
  value: Level3TemplateActivity[] | ((previous: Level3TemplateActivity[]) => Level3TemplateActivity[]),
) => void
```

Initialize separate cloned templates for whole-machine and tOS. Extend `createInitialConfigTemplateVersionScopes` with only those two `level3` scopes. Seed `publishedSnapshots` through `getTemplateSnapshotKey(projectType, versionId, 'level3')`. Include the new map in `partialize` and migration without rewriting existing maps.

- [ ] **Step 4: Run store verifier and existing governance verifier**

Run:

```bash
npm run verify:level3-template
npm run verify:level1-plan-governance
```

Expected: both PASS.

- [ ] **Step 5: Commit store support**

```bash
git add src/stores/plan.ts src/lib/projectTemplateCompatibility.ts scripts/verify-level3-template-config.mjs
git commit -m "feat: persist level3 plan templates"
```

### Task 4: Add idempotent project-scope initialization

**Files:**
- Modify: `src/stores/level3Plan.ts`
- Test: `scripts/verify-level3-template-config.mjs`

- [ ] **Step 1: Add failing idempotency tests**

Load the Zustand module with the existing in-memory storage harness and assert:

```js
assert.equal(store.getState().initializeScopeFromTemplate('scope-a', initialized), true)
assert.deepEqual(store.getState().activitiesByScope['scope-a'], initialized)
store.getState().updateActivity('scope-a', initialized[0].id, { activityName: '用户修改' }, '张三')
assert.equal(store.getState().initializeScopeFromTemplate('scope-a', otherTemplate), false)
assert.equal(store.getState().activitiesByScope['scope-a'][0].activityName, '用户修改')
assert.equal(store.getState().initializeScopeFromTemplate('empty-scope', []), true)
assert.equal(store.getState().initializeScopeFromTemplate('empty-scope', initialized), false)
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:level3-template`

Expected: FAIL because `initializeScopeFromTemplate` is absent.

- [ ] **Step 3: Implement the minimal action**

```ts
initializeScopeFromTemplate: (scopeKey, activities) => {
  if (!scopeKey) return false
  if (Object.prototype.hasOwnProperty.call(get().activitiesByScope, scopeKey)) return false
  set(state => ({
    activitiesByScope: {
      ...state.activitiesByScope,
      [scopeKey]: cloneActivities(activities),
    },
  }))
  return true
}
```

Do not create history entries for system initialization and do not clear override/history maps.

- [ ] **Step 4: Run level-3 verifiers**

Run:

```bash
npm run verify:level3-template
npm run verify:level3-plan
```

Expected: both PASS.

- [ ] **Step 5: Commit scope initialization**

```bash
git add src/stores/level3Plan.ts scripts/verify-level3-template-config.mjs
git commit -m "feat: initialize level3 scopes from templates"
```

### Task 5: Render the configuration-center level-3 table

**Files:**
- Create: `src/components/plans/Level3TemplateTable.tsx`
- Modify: `src/containers/ConfigContainer.tsx`
- Test: `scripts/verify-level3-template-config.mjs`

- [ ] **Step 1: Add failing source and data-contract assertions**

Assert the component exists, exports/reuses the 15 project-space column keys in exact order, renders `Input` only for `activityName`, renders `Select` only for `milestoneId`, renders `-` for all execution columns, and blocks child creation on depth 1. Assert `ConfigContainer` exposes `level3` only for supported project types.

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:level3-template`

Expected: FAIL because the component and `level3` tabs do not exist.

- [ ] **Step 3: Implement the table component**

The component API must be explicit:

```ts
interface Level3TemplateTableProps {
  activities: Level3TemplateActivity[]
  editable: boolean
  milestoneOptions: Array<{ value: string; label: string }>
  collapsedIds: string[]
  onActivitiesChange: (activities: Level3TemplateActivity[]) => void
  onCollapsedIdsChange: (ids: string[]) => void
}
```

Build all 15 columns from the shared `LEVEL3_COLUMN_KEYS`. Use `numberLevel3TemplateActivities` for `1 / 1.1`. Use dnd-kit only while editable and permit drops only between rows with the same `parentId`. Parent drag moves its children because the normalized output is tree-flattened. Add/delete operations must call the pure normalizer so a third level cannot be created.

- [ ] **Step 4: Wire tabs and version lifecycle**

In `ConfigContainer`:

- Add `{ key: 'level3', label: '三级计划' }` only when `supportsLevel3Template(selectedTemplateType)`.
- Resolve `templateVersionScope` with `level3`.
- Resolve template tasks from `level3TemplateTasksByType` in level-3 mode.
- Resolve milestone options from the latest published L1 template snapshot for the same project type.
- Publish and compare snapshots with `planLevel = 'level3'`.
- Render `Level3TemplateTable` instead of the L1 table/Gantt.
- Hide Gantt-only and role-column settings in level-3 mode; keep version, search, expand/collapse and lifecycle actions.

- [ ] **Step 5: Run focused and regression verifiers**

Run:

```bash
npm run verify:level3-template
npm run verify:level1-plan-governance
npm run verify:technical-plan
```

Expected: all PASS.

- [ ] **Step 6: Commit the configuration UI**

```bash
git add src/components/plans/Level3TemplateTable.tsx src/containers/ConfigContainer.tsx scripts/verify-level3-template-config.mjs
git commit -m "feat: configure level3 plan templates"
```

### Task 5A: Add project-space table and Gantt views

**Files:**
- Modify: `src/components/plans/Level3PlanModule.tsx`
- Modify: `src/components/shared/PlanHelpers.tsx`
- Test: `scripts/verify-level3-template-config.mjs`
- Test: `scripts/verify-level3-plan.mjs`

- [ ] **Step 1: Add failing view contracts**

Assert that the level-3 module renders `PlanViewModeSwitcher` with horizontal disabled in both read-only and editable states, defaults to table, renders `DHTMLXGantt` in Gantt mode, and maps rolled-up rows to task name, planned dates, actual dates, hierarchy, and duration without manufacturing dates for empty rows.

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:level3-template`

Expected: FAIL because the level-3 module has no view switch or Gantt mapping.

- [ ] **Step 3: Implement the two views**

Add local `vertical | gantt` state to `Level3PlanModule`, place the shared switcher at the right edge of the existing toolbar, and set `horizontalDisabled`. Build Gantt rows from the already filtered and rolled-up table rows:

```ts
const ganttTasks = filteredRows.map(row => ({
  id: row.id,
  parentId: row.parentId || undefined,
  taskName: row.activityName,
  planStartDate: row.planStartDate,
  planEndDate: row.planEndDate,
  actualStartDate: row.actualStartDate,
  actualEndDate: row.actualEndDate,
  estimatedDays: row.estimatedDays || undefined,
}))
```

Render the shared `DHTMLXGantt` with read-only behavior, dedicated columns for activity name, planned start/end and actual start/end, and the same collapsed IDs. Keep all mutations in table view.

- [ ] **Step 4: Run focused regressions**

Run:

```bash
npm run verify:level3-template
npm run verify:level3-plan
```

Expected: both PASS.

- [ ] **Step 5: Commit the view support**

```bash
git add src/components/plans/Level3PlanModule.tsx src/components/shared/PlanHelpers.tsx scripts/verify-level3-template-config.mjs scripts/verify-level3-plan.mjs
git commit -m "feat: add level3 gantt view"
```

### Task 6: Initialize new markets and tOS types

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/lib/level3TemplateRules.ts`
- Test: `scripts/verify-level3-template-config.mjs`

- [ ] **Step 1: Add failing transition tests**

Extract and test a pure helper:

```ts
getAddedDimensionValues(['OP'], ['OP', 'TR']) // ['TR']
getAddedDimensionValues(['Full'], ['Full', 'Slim']) // ['Slim']
getAddedDimensionValues(['OP', 'TR'], ['OP', 'TR']) // []
```

Add source contracts requiring both `saveMarketConfig` and `saveTosTypeConfig` to call `initializeScopeFromTemplate` only for added values and to use the latest published template snapshot.

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:level3-template`

Expected: FAIL because transitions are not wired.

- [ ] **Step 3: Implement initialization orchestration**

Add a local helper in `ProjectSpaceContainer` that:

1. Finds the latest published level-3 template version for the project family.
2. Reads `getTemplateSnapshotForProjectType(publishedSnapshots, projectType, version.id, 'level3')`.
3. Resolves project-space latest published L1 milestones for the target market/type.
4. Calls `materializeLevel3Template` and `initializeScopeFromTemplate`.
5. Returns a result used to show one consolidated success/warning message.

Call it after successful project and dimension-config persistence:

```ts
const addedMarkets = getAddedDimensionValues(previousRows.map(row => row.market), nextMarkets)
addedMarkets.forEach(market => initializeNewLevel3Dimension('market', market))

const addedTypes = getAddedDimensionValues(previousRows.map(row => row.type), nextTypes)
addedTypes.forEach(type => initializeNewLevel3Dimension('tosType', type))
```

The level-3 store action is the final idempotency guard; existing keys, including empty arrays, are never overwritten.

- [ ] **Step 4: Run focused and scope regressions**

Run:

```bash
npm run verify:level3-template
npm run verify:level3-plan
npm run verify:level1-plan-governance
```

Expected: all PASS.

- [ ] **Step 5: Commit initialization wiring**

```bash
git add src/containers/ProjectSpaceContainer.tsx src/lib/level3TemplateRules.ts scripts/verify-level3-template-config.mjs
git commit -m "feat: seed new level3 project scopes"
```

### Task 7: Fix configuration tabs and scrolling

**Files:**
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-level3-template-config.mjs`

- [ ] **Step 1: Add failing CSS contract assertions**

Require these classes and behaviors:

```css
.pms-config-template-header-card { flex: 0 0 auto; }
.pms-config-template-tabs .ant-tabs-nav { min-height: 44px; }
.pms-config-template-toolbar { flex: 0 0 auto; }
.pms-config-template-content-card { flex: 1 1 auto; min-height: 0; }
```

Also assert the header card no longer relies on an inline `overflow: hidden` that clips the Tab navigation.

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:level3-template`

Expected: FAIL because the scoped classes are absent.

- [ ] **Step 3: Apply the scoped layout fix**

Assign the four classes in `ConfigContainer`; keep overflow on the content card body/table region, not the header/Tab card. Preserve the responsive `max-width: 760px` behavior where the page becomes naturally tall.

- [ ] **Step 4: Run static UI verifiers**

Run:

```bash
npm run verify:level3-template
npm run verify:collapsible-sidebars
npm run verify:compact-ui-density
```

Expected: all PASS.

- [ ] **Step 5: Commit the layout repair**

```bash
git add src/containers/ConfigContainer.tsx src/styles/globals.css scripts/verify-level3-template-config.mjs
git commit -m "fix: keep plan configuration tabs visible"
```

### Task 8: Full engineering and browser verification

**Files:**
- Create: `screenshots/verify-level3-template-config-browser.mjs`
- Modify: `package.json`
- Output: `output/level3-template-config/*.png`

- [ ] **Step 1: Add the browser command and workflow**

Register:

```json
"verify:level3-template-browser": "node screenshots/verify-level3-template-config-browser.mjs"
```

The script must use a dedicated temporary browser profile and exercise: whole-machine tabs, tOS tabs, unsupported categories, 15 columns, draft edit controls, key-node dropdown, add child/depth limit, new market initialization, new tOS type initialization, repeated-save preservation, the clipped-tab viewport, and project-space level-3 table/Gantt switching in both published and revision states. Save screenshots with stable names for PRD insertion.

- [ ] **Step 2: Run all non-browser gates**

```bash
npm run verify:level3-template
npm run verify:level3-plan
npm run verify:level1-plan-governance
npm run verify:technical-plan
npm run verify:technical-project
npm run verify:collapsible-sidebars
npm run verify:compact-ui-density
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git diff --check
```

Expected: every command exits 0 with no TypeScript or build errors.

- [ ] **Step 3: Start the local production-like app**

Run `npm run dev -- --port 3004` in a persistent session after confirming port 3004 is free. If occupied by this repository's stale server, stop only that explicit PID and restart.

- [ ] **Step 4: Run browser verification and inspect screenshots**

Run: `PMS_BASE_URL=http://127.0.0.1:3004 npm run verify:level3-template-browser`

Expected: PASS and screenshots for configuration tabs, whole-machine template, tOS template, key-node editor, market result, and tOS-type result. Inspect each image for clipping, overlaps, empty text, and incorrect controls.

- [ ] **Step 5: Fix any observed issue using a new RED/GREEN cycle**

For each issue, add a failing verifier assertion or browser check, reproduce the failure, apply the minimal fix, rerun the focused check, then rerun the full gates.

- [ ] **Step 6: Commit browser evidence and final fixes**

```bash
git add package.json screenshots/verify-level3-template-config-browser.mjs src scripts
git commit -m "test: verify level3 template workflows"
```

Do not commit generated `output/` screenshots unless the repository convention explicitly tracks them; retain them locally for PRD upload.

### Task 9: Release dev, mainline, and Vercel

**Files:**
- No intended source changes.

- [ ] **Step 1: Fetch and verify release targets**

Run:

```bash
git fetch --prune origin
git status --short --branch
git log -1 --oneline origin/dev
git symbolic-ref refs/remotes/origin/HEAD
```

Confirm the current mainline branch from the remote instead of assuming its name. Rebase or merge latest `origin/dev` into the feature branch only after checking changed paths for overlap, then rerun the full gates.

- [ ] **Step 2: Push feature result to dev through a clean release worktree**

Create a clean release branch from current `origin/dev`, merge `codex/level3-template-config` with `--no-ff --no-autostash`, rerun focused tests/typecheck/build, then push the resulting commit to `origin/dev`.

- [ ] **Step 3: Merge dev to the confirmed mainline branch**

Use a second clean release worktree based on current mainline, merge current `origin/dev` with `--no-ff --no-autostash`, rerun focused tests/typecheck/build, and push mainline.

- [ ] **Step 4: Verify remote refs**

Run `git ls-remote origin refs/heads/dev refs/heads/<mainline>` and confirm the expected release commits are present.

- [ ] **Step 5: Verify Vercel production**

Use the repository's current Vercel project binding to locate the deployment triggered by mainline. Wait for `Ready`, confirm the production alias, open `https://pms-transsion.vercel.app/`, and repeat the critical configuration-tab and template read-only checks against production.

### Task 10: Update and verify the Feishu PRD

**Files:**
- External document: `https://transsioner.feishu.cn/docx/ZhEkd67WAotJfvxoDBGcLjtZnYg`
- Local screenshots: `output/level3-template-config/*.png`

- [ ] **Step 1: Fetch the latest outline and section 9**

Use `lark-cli docs +fetch --as user` with `--scope outline --max-depth 3 --detail full`, then fetch section `9. 三级计划` by its current block ID. Record current revision and existing image blocks.

- [ ] **Step 2: Insert the configuration-center subsection precisely**

Add a new subsection under section 9 covering:

- supported project types and tabs;
- version lifecycle and two-level structure;
- the full 15-field table with editable/read-only rules;
- key-node option source;
- market/type one-time initialization and idempotency;
- missing-template handling;
- tab clipping fix;
- acceptance checks.

Use `block_insert_after`, `block_replace`, and `block_move_after`; do not overwrite the document.

- [ ] **Step 3: Insert current screenshots next to matching functions**

Upload the verified production screenshots for whole-machine template, tOS template, draft editing/key-node dropdown, market initialization, tOS type initialization, repaired tabs, and the project-space level-3 Gantt view. Give captions consistent with section 9 numbering and replace obsolete screenshots only when they represent the same function.

- [ ] **Step 4: Read back and validate the document**

Re-fetch outline and section 9 with `--detail full`. Verify heading order, no duplicate subsection, complete field table, all expected interaction text, screenshot count/order/captions, no old conflicting screenshot for the same function, and a higher revision ID.

- [ ] **Step 5: Final evidence report**

Return feature commits, dev/mainline remote commit IDs, Vercel deployment URL/status, browser checks, and the Feishu document link/revision. Mention any unrelated dirty files that remained untouched.
