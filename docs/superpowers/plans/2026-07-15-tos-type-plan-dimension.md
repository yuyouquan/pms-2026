# tOS Type-Scoped Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Full/Slim/PAD/GO type configuration to tOS version projects and isolate every level-1, level-2, overview, version, and snapshot operation by project and type.

**Architecture:** Keep whole-machine market behavior unchanged. Add a pure `tosTypeRules` module, project-scoped type configuration in `project.ts`, and project/type-scoped plan entries plus version maps in `plan.ts`; `ProjectSpaceContainer` exposes scoped setter adapters so existing plan rendering and editing logic continues to operate on the selected dimension.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5.5, Zustand 4, Ant Design 6, Node assertion scripts, Puppeteer.

---

## File map

- Create `src/lib/tosTypeRules.ts`: type enums, row normalization, scope keys, deep-cloned plan entry initialization, and type-specific version helpers.
- Create `scripts/verify-tos-type-rules.mjs`: executable tests for the pure type rules.
- Create `scripts/verify-tos-type-integration.mjs`: source-level contract checks for Store and UI wiring.
- Create `screenshots/smoke-tos-type-plan.mjs`: browser acceptance for both type entry points and all plan tabs.
- Modify `src/types/index.ts`: add `versionTypes` to the project shape.
- Modify `src/types/app.ts`: add `versionTypes` to app-facing project types.
- Modify `src/data/projects.ts`: seed representative tOS projects with more than one type for browser verification.
- Modify `src/stores/project.ts`: selected type and per-project type configuration.
- Modify `src/stores/plan.ts`: per-project/per-type plan entries and type version/current-version maps.
- Modify `src/containers/ProjectSpaceContainer.tsx`: scoped plan adapters, initialization, type editor, type Tabs, snapshots, and RBAC.
- Modify `src/containers/AppShell.tsx`: reset the selected type to the destination project's main type when switching projects.

## Task 1: Build the pure tOS type rules with a failing verification first

**Files:**
- Create: `scripts/verify-tos-type-rules.mjs`
- Create: `src/lib/tosTypeRules.ts`

- [ ] **Step 1: Write the failing rule verification**

Create `scripts/verify-tos-type-rules.mjs` using the same TypeScript transpile/vm harness as `scripts/verify-market-version-rules.mjs`. The assertions must execute these contracts:

```js
const rows = buildTosTypeRows([], 'Slim')
assert.deepEqual(plain(rows), [{ id: 'tos-type-Slim', type: 'Slim', isMain: true }])

const normalized = normalizeTosTypeRows([
  { id: '1', type: 'Full', isMain: false },
  { id: '2', type: 'Slim', isMain: true },
  { id: '3', type: 'Slim', isMain: false },
  { id: '4', type: 'INVALID', isMain: true },
])
assert.deepEqual(plain(normalized), [
  { id: '1', type: 'Full', isMain: false },
  { id: '2', type: 'Slim', isMain: true },
])

const seed = createTosTypePlanEntry({
  level1Tasks: [{ id: '1', taskName: 'STR1' }],
  level2PlanTasks: [{ id: '1', planId: 'plan0', taskName: '需求' }],
  level2PlanMilestones: ['STR1'],
  createdLevel2Plans: [{ id: 'plan0', name: '需求开发计划', type: '需求开发计划', fixed: true }],
  activeLevel2Plan: 'plan0',
  level2PlanMeta: {},
})
const data = ensureTosTypePlanDataForRows({}, 'project-1', normalized, seed)
assert.notEqual(data['project-1'].Full, data['project-1'].Slim)
assert.notEqual(data['project-1'].Full.level1Tasks, data['project-1'].Slim.level1Tasks)
data['project-1'].Full.level1Tasks[0].taskName = 'Full STR1'
assert.equal(data['project-1'].Slim.level1Tasks[0].taskName, 'STR1')

assert.equal(getTosTypeVersionKey('project-1', 'Full', 'level1'), 'project::project-1::tos-type::Full::level1::versions')
assert.equal(getTosTypeSnapshotKey('project-1', 'Full', 'level2', 'v3'), 'project::project-1::tos-type::Full::level2::v3::snapshot')
```

- [ ] **Step 2: Run the verification and confirm RED**

Run: `node scripts/verify-tos-type-rules.mjs`

Expected: FAIL with `src/lib/tosTypeRules.ts is missing`.

- [ ] **Step 3: Implement the pure rule module**

Create `src/lib/tosTypeRules.ts` with these public contracts:

```ts
export const TOS_TYPE_OPTIONS = ['Full', 'Slim', 'PAD', 'GO'] as const
export type TosPlanType = typeof TOS_TYPE_OPTIONS[number]

export type TosTypeConfigRow = { id: string; type: TosPlanType; isMain: boolean }
export type TosTypePlanEntry = {
  level1Tasks: any[]
  level2PlanTasks: any[]
  level2PlanMilestones: string[]
  createdLevel2Plans: any[]
  activeLevel2Plan: string
  level2PlanMeta: Record<string, any>
}
export type TosTypePlanData = Record<string, Record<string, TosTypePlanEntry>>
export type TosTypeVersionsState = Record<string, { id: string; versionNo: string; status: string }[]>
export type TosTypeCurrentVersionState = Record<string, string>

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export const isValidTosType = (value: string): value is TosPlanType => TOS_TYPE_OPTIONS.includes(value as TosPlanType)

export const normalizeTosTypeRows = (rows: Array<{ id: string; type: string; isMain: boolean }>): TosTypeConfigRow[] => {
  const seen = new Set<string>()
  const filtered = rows.filter(row => isValidTosType(row.type) && !seen.has(row.type) && seen.add(row.type)) as TosTypeConfigRow[]
  if (!filtered.length) return []
  const mainType = filtered.find(row => row.isMain)?.type || filtered[0].type
  return filtered.map(row => ({ ...row, isMain: row.type === mainType }))
}

export const buildTosTypeRows = (versionTypes: string[] = [], versionType = '', existingRows: TosTypeConfigRow[] = []) => {
  const sourceTypes = versionTypes.filter(isValidTosType)
  const fallback = isValidTosType(versionType) ? versionType : 'Full'
  const rows = existingRows.length ? existingRows : (sourceTypes.length ? sourceTypes : [fallback]).map((type, index) => ({ id: `tos-type-${type}`, type, isMain: index === 0 }))
  return normalizeTosTypeRows(rows)
}

export const getMainTosType = (rows: TosTypeConfigRow[]) => normalizeTosTypeRows(rows).find(row => row.isMain)?.type || ''
export const createTosTypePlanEntry = (seed: TosTypePlanEntry): TosTypePlanEntry => clone(seed)
export const ensureTosTypePlanDataForRows = (data: TosTypePlanData, projectId: string, rows: TosTypeConfigRow[], seed: TosTypePlanEntry) => {
  const projectData = { ...(data[projectId] || {}) }
  normalizeTosTypeRows(rows).forEach(row => { if (!projectData[row.type]) projectData[row.type] = createTosTypePlanEntry(seed) })
  return { ...data, [projectId]: projectData }
}
export const getTosTypeVersionKey = (projectId: string, type: string, planLevel: string) => `project::${projectId}::tos-type::${type}::${planLevel}::versions`
export const getTosTypeSnapshotKey = (projectId: string, type: string, planLevel: string, versionId: string) => `project::${projectId}::tos-type::${type}::${planLevel}::${versionId}::snapshot`

export const getTosTypeVersions = (state: TosTypeVersionsState, projectId: string, type: string, planLevel: string, fallback: Array<{ id: string; versionNo: string; status: string }>) =>
  clone(state[getTosTypeVersionKey(projectId, type, planLevel)] || fallback)

export const setTosTypeVersions = (state: TosTypeVersionsState, projectId: string, type: string, planLevel: string, fallback: Array<{ id: string; versionNo: string; status: string }>, next: Array<{ id: string; versionNo: string; status: string }> | ((prev: Array<{ id: string; versionNo: string; status: string }>) => Array<{ id: string; versionNo: string; status: string }>)) => {
  const key = getTosTypeVersionKey(projectId, type, planLevel)
  const previous = getTosTypeVersions(state, projectId, type, planLevel, fallback)
  return { ...state, [key]: clone(typeof next === 'function' ? next(previous) : next) }
}

export const getTosTypeCurrentVersion = (state: TosTypeCurrentVersionState, projectId: string, type: string, planLevel: string, versions: Array<{ id: string; versionNo: string; status: string }>, fallback: string) => {
  const selected = state[getTosTypeVersionKey(projectId, type, planLevel)] || fallback
  if (versions.some(version => version.id === selected)) return selected
  return versions.filter(version => version.status === '已发布').at(-1)?.id || versions[0]?.id || fallback
}

export const setTosTypeCurrentVersion = (state: TosTypeCurrentVersionState, projectId: string, type: string, planLevel: string, versionId: string) => ({
  ...state,
  [getTosTypeVersionKey(projectId, type, planLevel)]: versionId,
})
```

- [ ] **Step 4: Run the verification and confirm GREEN**

Run: `node scripts/verify-tos-type-rules.mjs`

Expected: `tOS type rules verification passed.`

- [ ] **Step 5: Commit the rule slice**

```bash
git add scripts/verify-tos-type-rules.mjs src/lib/tosTypeRules.ts
git commit -m "feat: add tOS plan type rules"
```

## Task 2: Add project and plan Store state

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/types/app.ts`
- Modify: `src/stores/project.ts`
- Modify: `src/stores/plan.ts`
- Create: `scripts/verify-tos-type-integration.mjs`

- [ ] **Step 1: Write failing Store contract checks**

Create `scripts/verify-tos-type-integration.mjs` with a `read(relativePath)` helper and fail unless all of these tokens exist:

```js
const required = [
  ['src/stores/project.ts', 'selectedTosTypeTab'],
  ['src/stores/project.ts', 'tosTypeConfigsByProjectId'],
  ['src/stores/project.ts', 'setTosTypeConfigForProject'],
  ['src/stores/plan.ts', 'tosTypePlanDataByProjectId'],
  ['src/stores/plan.ts', 'tosTypeVersionsByKey'],
  ['src/stores/plan.ts', 'tosTypeCurrentVersionByKey'],
  ['src/types/index.ts', 'versionTypes?'],
  ['src/types/app.ts', 'versionTypes'],
]
```

- [ ] **Step 2: Run the integration verification and confirm RED**

Run: `node scripts/verify-tos-type-integration.mjs`

Expected: FAIL listing missing Store contracts.

- [ ] **Step 3: Extend project types and project Store**

Add `versionTypes?: TosPlanType[]` to `Project` in `src/types/index.ts` and `versionTypes?: string[]` to the app project type. In `src/stores/project.ts`, build initial configurations only for `PROJECT_TYPE_TOS_VERSION` projects and add:

```ts
selectedTosTypeTab: string
tosTypeConfigsByProjectId: Record<string, TosTypeConfigRow[]>
setSelectedTosTypeTab: (value: string) => void
setTosTypeConfigForProject: (projectId: string, rows: TosTypeConfigRow[]) => void
```

Initialize `selectedTosTypeTab` to `Full`, normalize each tOS project's `versionTypes/versionType`, and make both setters immutable.

- [ ] **Step 4: Extend the plan Store**

Add the following state and functional setters to `src/stores/plan.ts`:

```ts
tosTypePlanDataByProjectId: TosTypePlanData
tosTypeVersionsByKey: TosTypeVersionsState
tosTypeCurrentVersionByKey: TosTypeCurrentVersionState
setTosTypePlanDataByProjectId: (value: TosTypePlanData | ((prev: TosTypePlanData) => TosTypePlanData)) => void
setTosTypeVersionsByKey: (value: TosTypeVersionsState | ((prev: TosTypeVersionsState) => TosTypeVersionsState)) => void
setTosTypeCurrentVersionByKey: (value: TosTypeCurrentVersionState | ((prev: TosTypeCurrentVersionState) => TosTypeCurrentVersionState)) => void
```

Initialize all three maps to `{}`. Do not modify or rename the existing market maps.

- [ ] **Step 5: Run Store checks and TypeScript**

Run: `node scripts/verify-tos-type-integration.mjs && npx tsc --noEmit`

Expected: integration script passes and TypeScript exits 0.

- [ ] **Step 6: Commit the Store slice**

```bash
git add scripts/verify-tos-type-integration.mjs src/types/index.ts src/types/app.ts src/stores/project.ts src/stores/plan.ts
git commit -m "feat: store tOS plans by project and type"
```

## Task 3: Route every plan operation through the selected tOS type

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-tos-type-integration.mjs`

- [ ] **Step 1: Add failing scoped-data checks**

Require these contracts in `ProjectSpaceContainer.tsx`:

```js
[
  'isTosTypeScoped',
  'currentTosTypeData',
  'getTosTypeVersions',
  'getTosTypeSnapshotKey',
  'effectiveLevel2PlanTasks',
  'effectiveCreatedLevel2Plans',
  'effectiveLevel2PlanMeta',
]
```

Run: `node scripts/verify-tos-type-integration.mjs`

Expected: FAIL listing the missing scoped-data contracts.

- [ ] **Step 2: Alias global L2 state and create scoped adapters**

Rename Store destructuring locals to `baseLevel2PlanTasks`, `setBaseLevel2PlanTasks`, `baseCreatedLevel2Plans`, and corresponding base names for milestones, active plan, and metadata. Derive:

```ts
const isTosVersionProject = selectedProject?.type === PROJECT_TYPE_TOS_VERSION
const tosTypeConfigRows = selectedProject && isTosVersionProject
  ? buildTosTypeRows(selectedProject.versionTypes || [], selectedProject.versionType || '', tosTypeConfigsByProjectId[selectedProject.id])
  : []
const isTosTypeScoped = !!selectedProject && isTosVersionProject && !!selectedTosTypeTab
const currentTosTypeData = isTosTypeScoped ? tosTypePlanDataByProjectId[selectedProject.id]?.[selectedTosTypeTab] : undefined
```

Expose `effectiveTasks`, `effectiveLevel2PlanTasks`, `effectiveCreatedLevel2Plans`, `effectiveActiveLevel2Plan`, `effectiveLevel2PlanMeta`, and `effectiveLevel2PlanMilestones`. Each setter must immutably patch only `tosTypePlanDataByProjectId[selectedProject.id][selectedTosTypeTab]`; non-tOS projects continue calling the existing base setter. Replace downstream L2 reads/writes with the effective aliases.

Use one patch helper so every scoped setter preserves sibling projects and types:

```ts
const patchCurrentTosTypeData = (patcher: (entry: TosTypePlanEntry) => TosTypePlanEntry) => {
  if (!selectedProject || !currentTosTypeData) return
  setTosTypePlanDataByProjectId(prev => ({
    ...prev,
    [selectedProject.id]: {
      ...(prev[selectedProject.id] || {}),
      [selectedTosTypeTab]: patcher(prev[selectedProject.id][selectedTosTypeTab]),
    },
  }))
}

const effectiveTasks = currentTosTypeData?.level1Tasks || currentMarketData?.tasks || baseTasks
const setEffectiveTasks = currentTosTypeData
  ? (next: any[] | ((prev: any[]) => any[])) => patchCurrentTosTypeData(entry => ({ ...entry, level1Tasks: typeof next === 'function' ? next(entry.level1Tasks) : next }))
  : currentMarketData
    ? setCurrentMarketTasks
    : setBaseTasks

const effectiveLevel2PlanTasks = currentTosTypeData?.level2PlanTasks || baseLevel2PlanTasks
const setEffectiveLevel2PlanTasks = currentTosTypeData
  ? (next: any[] | ((prev: any[]) => any[])) => patchCurrentTosTypeData(entry => ({ ...entry, level2PlanTasks: typeof next === 'function' ? next(entry.level2PlanTasks) : next }))
  : setBaseLevel2PlanTasks

const effectiveCreatedLevel2Plans = currentTosTypeData?.createdLevel2Plans || baseCreatedLevel2Plans
const effectiveActiveLevel2Plan = currentTosTypeData?.activeLevel2Plan || baseActiveLevel2Plan
const effectiveLevel2PlanMeta = currentTosTypeData?.level2PlanMeta || baseLevel2PlanMeta
const effectiveLevel2PlanMilestones = currentTosTypeData?.level2PlanMilestones || baseLevel2PlanMilestones
```

Create equivalent setters for the final four fields, then rename the local effective aliases back to the names consumed by existing render and handler code. This keeps every existing call site on the scoped values without duplicating plan logic.

- [ ] **Step 3: Scope versions and snapshots**

For tOS projects, resolve version/current-version through `getTosTypeVersions` and `getTosTypeCurrentVersion` with `projectPlanLevel === 'level2' ? 'level2' : 'level1'`. Make create revision, publish, cancel, compare baseline, due-task scan, and published snapshot writes use:

```ts
getTosTypeSnapshotKey(selectedProject.id, selectedTosTypeTab, scopedPlanLevel, versionId)
```

Keep `getProjectMarketSnapshotKey` unchanged for whole-machine projects and the legacy snapshot key for all remaining projects.

- [ ] **Step 4: Initialize an unseen type from the tOS template seed**

Create the seed with explicit execution-field clearing, then call `ensureTosTypePlanDataForRows` when entering a tOS project and when saving newly added rows:

```ts
const clearExecutionFields = (task: any) => ({
  ...task,
  planStartDate: '',
  planEndDate: '',
  actualStartDate: '',
  actualEndDate: '',
  actualDays: 0,
  status: '未开始',
  progress: 0,
})
const latestTemplateVersion = baseVersions.filter(version => version.status === '已发布').sort(comparePlanVersions).at(-1)
const templateSnapshot = latestTemplateVersion
  ? publishedSnapshots[getTemplateSnapshotKey(PROJECT_TYPE_TOS_VERSION, latestTemplateVersion.id, 'level1')]
  : undefined
const level1Template = templateSnapshot || configTemplateTasksByType[PROJECT_TYPE_TOS_VERSION] || []
const tosTypeSeed = createTosTypePlanEntry({
  level1Tasks: initializeProjectPlanTasksFromTemplate(level1Template).map(clearExecutionFields),
  level2PlanTasks: INITIAL_LEVEL2_PLAN_TASKS.map(clearExecutionFields),
  level2PlanMilestones: [],
  createdLevel2Plans: JSON.parse(JSON.stringify(FIXED_LEVEL2_PLANS)),
  activeLevel2Plan: FIXED_LEVEL2_PLANS[0].id,
  level2PlanMeta: JSON.parse(JSON.stringify(INITIAL_LEVEL2_PLAN_META)),
})
```

- [ ] **Step 5: Run rule, integration, and TypeScript checks**

Run: `node scripts/verify-tos-type-rules.mjs && node scripts/verify-tos-type-integration.mjs && npx tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 6: Commit scoped plan behavior**

```bash
git add scripts/verify-tos-type-integration.mjs src/containers/ProjectSpaceContainer.tsx
git commit -m "feat: isolate all tOS plans by type"
```

## Task 4: Add the type editor and both UI entry points

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-tos-type-integration.mjs`

- [ ] **Step 1: Add failing UI contract checks**

Require all of these strings in the container:

```js
['类型编辑', '是否主类型', '添加类型', '请至少配置一个类型', '可选类型已全部添加', '无基本信息编辑权限']
```

Also require both `renderTosTypeTabs` and `saveTosTypeConfig`.

Run: `node scripts/verify-tos-type-integration.mjs`

Expected: FAIL listing missing type editor contracts.

- [ ] **Step 2: Implement editor state and handlers**

Add `showTosTypeEditor` and `tosTypeDraftRows`. Implement open, update, add, remove, and save functions with these exact outcomes:

- update main Radio: one and only one row is main;
- adding selects the first unused value from `TOS_TYPE_OPTIONS`;
- deleting the last row shows `至少保留一个类型`;
- saving no valid rows shows `请至少配置一个类型`;
- saving updates `versionTypes`, sets scalar `versionType` to the main type, preserves hidden plan data, and falls back to main when the selected type was removed.

- [ ] **Step 3: Render the shared type switcher**

Create `renderTosTypeTabs()` returning the label, Tags, main marker, and RBAC-gated button. Use it:

- in the tOS basic-information plan card as Ant Design Tabs with `tabBarExtraContent`;
- above the plan-level Tabs for level 1, level 2, and overview.

Every type change must call `navigateWithEditGuard(() => setSelectedTosTypeTab(type))`.

- [ ] **Step 4: Render the Modal**

Use the existing `pms-modal` and `pms-table` classes, width 780, a type `Select`, main `Radio`, delete button, full-width dashed add button, Cancel, and Save. Do not render any follow-main checkbox or follow-version warning.

- [ ] **Step 5: Verify UI contracts and TypeScript**

Run: `node scripts/verify-tos-type-integration.mjs && npx tsc --noEmit`

Expected: both commands exit 0.

- [ ] **Step 6: Commit the UI slice**

```bash
git add scripts/verify-tos-type-integration.mjs src/containers/ProjectSpaceContainer.tsx
git commit -m "feat: add tOS type editor and tabs"
```

## Task 5: Reset the selected type across project navigation and seed mock coverage

**Files:**
- Modify: `src/containers/AppShell.tsx`
- Modify: `src/data/projects.ts`
- Modify: `scripts/verify-tos-type-integration.mjs`

- [ ] **Step 1: Add failing navigation and mock checks**

Require `setSelectedTosTypeTab` and `getMainTosType` in `AppShell.tsx`, and require `versionTypes:` in `src/data/projects.ts`.

Run: `node scripts/verify-tos-type-integration.mjs`

Expected: FAIL listing missing navigation/mock contracts.

- [ ] **Step 2: Reset the type in project switching**

When `ProjectSpaceHeader` selects a project, build its normalized rows and set the selected tOS type to `getMainTosType(rows)`. Keep the existing first-market selection for whole-machine projects. `ProjectSpaceContainer`'s selected-project effect remains the safety net for workspace cards, todo links, add-project navigation, and roadmap navigation.

- [ ] **Step 3: Seed browser-verifiable tOS projects**

Give `tOS16.3` at least `versionTypes: ['Full', 'Slim']` with Full as the existing scalar `versionType`, while leaving another tOS project with only one scalar type to verify compatibility initialization.

- [ ] **Step 4: Run regression scripts and TypeScript**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-market-version-rules.mjs
node scripts/verify-plan-versioning.mjs
npx tsc --noEmit
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit navigation and mock coverage**

```bash
git add scripts/verify-tos-type-integration.mjs src/containers/AppShell.tsx src/data/projects.ts
git commit -m "feat: initialize tOS project type selection"
```

## Task 6: Browser acceptance and production verification

**Files:**
- Create: `screenshots/smoke-tos-type-plan.mjs`
- Modify only if verification exposes a defect: files already listed in Tasks 1-5

- [ ] **Step 1: Write the browser smoke script**

Create a Puppeteer script using `PMS_BASE_URL || 'http://localhost:3004'`. It must:

1. open the workspace and enter `tOS16.3`;
2. assert the basic-information plan card contains Full and Slim plus `类型编辑`;
3. open the Modal, add PAD, save, and assert PAD appears;
4. switch to the plan module and assert the type strip appears for level 1, level 2, and overview;
5. switch Full → Slim → PAD and assert the active Tag changes;
6. reopen the Modal and assert no follow-main control exists;
7. switch to an entire-machine project and assert `市场编辑` still appears and `类型编辑` does not replace it.

The script exits nonzero on any failed assertion and prints `tOS type plan smoke passed.` on success.

- [ ] **Step 2: Start the development server**

Run: `npm run dev -- --port 3004`

Expected: Next.js reports ready on `http://localhost:3004`. If a stale listener owns the port, inspect it with `lsof -nP -iTCP:3004 -sTCP:LISTEN` and stop only that stale process before retrying.

- [ ] **Step 3: Run browser acceptance**

Run: `PMS_BASE_URL=http://localhost:3004 node screenshots/smoke-tos-type-plan.mjs`

Expected: `tOS type plan smoke passed.`

- [ ] **Step 4: Run the complete static gate**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-market-version-rules.mjs
node scripts/verify-plan-versioning.mjs
npx tsc --noEmit
npm run build
```

Expected: every verification passes, TypeScript exits 0, and Next.js finishes a production build.

- [ ] **Step 5: Inspect the final diff**

Run: `git status --short && git diff --check && git diff --stat HEAD~5..HEAD`

Expected: no whitespace errors; only files in this plan plus the pre-existing unrelated dirty files are reported.

- [ ] **Step 6: Commit the browser smoke**

```bash
git add screenshots/smoke-tos-type-plan.mjs
git commit -m "test: cover tOS type-scoped plans"
```
