# Project Roadmap Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cleared project-roadmap branch with a complete read-only normal-project and editable planned-project roadmap, including global machine-type migration, tOS maintenance, targets, table/evolution views, conflict handling, audit history, permissions, persistence, and browser-verified purple-glass UX.

**Architecture:** Keep normal projects canonical in `useProjectStore`; keep planned projects, tOS catalog, targets, roadmap view state, and audit logs in a persisted `useRoadmapStore`. Adapt both sources into one `RoadmapProjectRow` model, derive conflicts from the unfiltered source sets, and feed the same filtering/column pipeline into the table and evolution views. All normal-project writes go through shared project-store actions so roadmap audit entries are produced once at the data boundary.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5, Ant Design 6, Zustand 4 with `persist`, Day.js, CSS Grid, existing global purple-glass styles, focused Node verification scripts, TypeScript compiler, Next production build, and real-browser smoke verification.

---

## Implementation baseline and constraints

- The approved design is `docs/superpowers/specs/2026-07-22-project-roadmap-redesign-design.md`.
- `src/components/roadmap/RoadmapView.tsx` already contains the intentionally blank roadmap branch, and `scripts/verify-roadmap-view-cleared.mjs` already verifies that old milestone/MR content is not mounted. Preserve these local changes and absorb them into Task 1.
- Preserve unrelated dirty-worktree files. Every commit command below must stage only the files named in that task.
- Keep `src/components/roadmap/MilestoneView.tsx` and `src/components/roadmap/MRTrainView.tsx` in the repository, but do not mount them from `RoadmapView.tsx`.
- Do not add a backend, database call, independent search box, normal-project editing inside the roadmap, automatic conflict merge, old milestone/MR features, or a STR5-before-launch validation rule.
- The repository has no test runner. Red/green checks use `scripts/verify-project-roadmap.mjs`, followed by `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/next/dist/bin/next build` when the local `.bin` shims remain unusable.

## File map

### New domain files

- `src/types/roadmap.ts` — field unions, row/config/log/filter/store contracts, constants, default columns.
- `src/lib/roadmapValidation.ts` — tOS normalization, display-name/duplicate-key rules, brand/product-line rules, required-field validation.
- `src/lib/roadmapSorting.ts` — semantic tOS, RAM, date, and localized text ordering.
- `src/lib/roadmapAudit.ts` — audit whitelist/order, snapshot creation, and before/after diffs.
- `src/lib/roadmapProjectAdapter.ts` — normal/planned row adapters, stable tOS resolution, history matching, conflict derivation.
- `src/stores/roadmap.ts` — persisted roadmap domain state and actions.
- `scripts/verify-project-roadmap.mjs` — behavioral and source-structure verification.

### New UI files

- `src/components/roadmap/ProjectRoadmapModule.tsx` — module orchestration, selectors, overlays, and view composition.
- `src/components/roadmap/RoadmapToolbar.tsx` — view toggle, quick filters, permission-gated actions.
- `src/components/roadmap/RoadmapTableView.tsx` — single-version target and sortable table.
- `src/components/roadmap/RoadmapEvolutionView.tsx` — all-version aligned CSS Grid.
- `src/components/roadmap/PlannedProjectModal.tsx` — planned-project create/edit form and history hints.
- `src/components/roadmap/RoadmapFilterDrawer.tsx` — field/condition/value filters; no separate search.
- `src/components/roadmap/RoadmapColumnSettingsDrawer.tsx` — shared table/card field visibility.
- `src/components/roadmap/RoadmapConflictAlert.tsx` — persistent conflict summary.
- `src/components/roadmap/RoadmapConflictDrawer.tsx` — grouped normal/planned conflict resolution.
- `src/components/roadmap/RoadmapChangeLogDrawer.tsx` — filtered, paginated audit history.
- `src/components/roadmap/TosVersionMaintenanceModal.tsx` — version CRUD and reference protection.
- `src/components/roadmap/TosTargetEditor.tsx` — per-version target list editing.
- `src/components/roadmap/RoadmapProjectCard.tsx` — evolution card shared rendering.

### Existing files to modify

- `src/constants/projectTypes.ts`, `src/types/app.ts`, `src/types/index.ts`, `src/data/projects.ts`, `src/data/externalProjectPool.ts` — machine-type migration and normal roadmap fields.
- `src/stores/project.ts`, `src/stores/ui.ts`, `src/stores/plan.ts`, `src/stores/permission.ts` — shared project writes, template/market helpers, global permission helper.
- `src/components/workspace/AddProjectModal.tsx`, `src/components/workspace/WorkspaceModule.tsx`, `src/containers/WorkspaceContainer.tsx` — three machine types and required first-sale tOS version.
- `src/containers/AppShell.tsx`, `src/containers/ProjectSpaceContainer.tsx`, `src/components/plan/PlanModule.tsx`, `src/app/page.tsx`, `src/app/share/plan/page.tsx` — roadmap entry permission, machine helper, and shared update action.
- `src/app/config/level1-template/page.tsx`, `src/app/config/level2-template/page.tsx` — new project-type union/default.
- `src/components/roadmap/RoadmapView.tsx`, `src/components/roadmap/ProjectPlanSummaryBoard.tsx`, `src/components/roadmap/utils.ts`, dormant roadmap files — remove legacy machine equality and mount the new module only.
- `src/constants/projectBasicFields.ts`, `src/styles/globals.css` — machine field labels/options and roadmap styling/motion.

## Task 1: Lock the cleared-roadmap baseline and create the master verification harness

**Files:**

- Modify: `scripts/verify-roadmap-view-cleared.mjs`
- Create: `scripts/verify-project-roadmap.mjs`
- Existing local modification: `src/components/roadmap/RoadmapView.tsx`

- [ ] **Step 1: Run the existing cleared-state test**

Run:

```bash
node scripts/verify-roadmap-view-cleared.mjs
```

Expected: `Roadmap cleared-state verification passed.`

- [ ] **Step 2: Add a passing master baseline harness**

Create `scripts/verify-project-roadmap.mjs` with a TypeScript module loader and an assertion registry so later tasks can add behavioral checks without adding a test framework:

```js
#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = process.cwd()
const failures = []
const moduleCache = new Map()
const nodeRequire = createRequire(import.meta.url)

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function resolveTypeScriptModule(fromFile, specifier) {
  const candidate = specifier.startsWith('@/')
    ? path.join(root, 'src', specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier)
  for (const suffix of ['.ts', '.tsx', '/index.ts']) {
    const resolved = `${candidate}${suffix}`
    if (fs.existsSync(resolved)) return resolved
  }
  throw new Error(`Cannot resolve ${specifier} from ${fromFile}`)
}

function loadTypeScriptModule(relativePath) {
  const absolutePath = path.join(root, relativePath)
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath).exports
  const module = { exports: {} }
  moduleCache.set(absolutePath, module)
  const source = fs.readFileSync(absolutePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: absolutePath,
  }).outputText
  const localRequire = specifier => {
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      return loadTypeScriptModule(path.relative(root, resolveTypeScriptModule(absolutePath, specifier)))
    }
    return nodeRequire(specifier)
  }
  Function('require', 'module', 'exports', output)(localRequire, module, module.exports)
  return module.exports
}

const roadmapViewSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapView.tsx'), 'utf8')
for (const legacyMount of [
  "import MilestoneView from './MilestoneView'",
  "import MRTrainView from './MRTrainView'",
  '<MilestoneView',
  '<MRTrainView',
]) {
  assert(!roadmapViewSource.includes(legacyMount), `Legacy roadmap content is still mounted: ${legacyMount}`)
}
assert(roadmapViewSource.includes(") : null}"), 'Cleared roadmap branch must remain blank at baseline')

if (failures.length) {
  console.error('Project roadmap verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Project roadmap verification passed.')
```

- [ ] **Step 3: Run the master harness and verify the baseline is green**

Run:

```bash
node scripts/verify-project-roadmap.mjs
```

Expected: `Project roadmap verification passed.`

- [ ] **Step 4: Commit only the cleared baseline and harness**

```bash
git add src/components/roadmap/RoadmapView.tsx scripts/verify-roadmap-view-cleared.mjs scripts/verify-project-roadmap.mjs
git commit -m "test: lock cleared roadmap baseline"
```

Expected: one green baseline commit containing no unrelated dirty files.

## Task 2: Migrate the global machine-project type system

**Files:**

- Modify: `src/constants/projectTypes.ts`
- Modify: `src/types/app.ts`
- Modify: `src/types/index.ts`
- Modify: `src/data/projects.ts`
- Modify: `src/stores/ui.ts`
- Modify: `src/stores/plan.ts`
- Modify: `src/stores/project.ts`
- Modify: `src/components/workspace/WorkspaceModule.tsx`
- Modify: `src/containers/WorkspaceContainer.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/plan/PlanModule.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/share/plan/page.tsx`
- Modify: `src/app/config/level1-template/page.tsx`
- Modify: `src/app/config/level2-template/page.tsx`
- Modify: `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- Modify: `src/components/roadmap/utils.ts`
- Modify: `src/components/roadmap/MilestoneView.tsx`
- Modify: `src/components/roadmap/MRTrainView.tsx`
- Test: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing machine-type assertions**

Append checks that load `src/constants/projectTypes.ts` and scan runtime source:

```js
const projectTypes = loadTypeScriptModule('src/constants/projectTypes.ts')
assert(
  JSON.stringify(projectTypes.MACHINE_PROJECT_TYPES) === JSON.stringify(['整机-手机', '整机-PAD', '整机-笔电']),
  'Machine project types must be the three approved top-level types',
)
for (const value of ['整机-手机', '整机-PAD', '整机-笔电']) {
  assert(projectTypes.isMachineProjectType(value), `${value} must be recognized as a machine project`)
}
assert(!projectTypes.isMachineProjectType('整机产品项目'), 'Legacy machine type must not remain active')

const runtimeFiles = [
  'src/app/page.tsx',
  'src/app/share/plan/page.tsx',
  'src/stores/project.ts',
  'src/containers/WorkspaceContainer.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
  'src/components/workspace/WorkspaceModule.tsx',
  'src/components/plan/PlanModule.tsx',
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
  'src/components/roadmap/MilestoneView.tsx',
  'src/components/roadmap/MRTrainView.tsx',
]
for (const file of runtimeFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  assert(!source.includes("=== '整机产品项目'"), `${file} must use isMachineProjectType`)
  assert(!source.includes("!== '整机产品项目'"), `${file} must use isMachineProjectType`)
}
```

Run `node scripts/verify-project-roadmap.mjs` and expect failures for the missing constants and legacy equalities.

- [ ] **Step 2: Replace the legacy type constant with the approved model**

Implement in `src/constants/projectTypes.ts`:

```ts
export const PROJECT_TYPE_MACHINE_PHONE = '整机-手机'
export const PROJECT_TYPE_MACHINE_PAD = '整机-PAD'
export const PROJECT_TYPE_MACHINE_LAPTOP = '整机-笔电'

export const MACHINE_PROJECT_TYPES = [
  PROJECT_TYPE_MACHINE_PHONE,
  PROJECT_TYPE_MACHINE_PAD,
  PROJECT_TYPE_MACHINE_LAPTOP,
] as const

export type MachineProjectType = typeof MACHINE_PROJECT_TYPES[number]

export function isMachineProjectType(type: string | null | undefined): type is MachineProjectType {
  return MACHINE_PROJECT_TYPES.includes(type as MachineProjectType)
}

export const PROJECT_TYPES = [
  ...MACHINE_PROJECT_TYPES,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_CAPABILITY,
] as const
```

Give all three types the existing machine color in `PROJECT_TYPE_COLORS`. Do not keep an active `PROJECT_TYPE_MACHINE = '整机产品项目'` alias.

- [ ] **Step 3: Update TypeScript unions and template defaults**

Use `MachineProjectType` in `src/types/app.ts`, `src/types/index.ts`, and `WorkspaceModule.tsx`. Expand `TEMPLATE_PROJECT_TYPES` with `...MACHINE_PROJECT_TYPES`. Default configuration routes and `useUiStore.selectedProjectType` to `PROJECT_TYPE_MACHINE_PHONE`.

- [ ] **Step 4: Explicitly migrate every existing machine mock**

All current machine mocks are phone records, so replace each `type: PROJECT_TYPE_MACHINE` with `type: PROJECT_TYPE_MACHINE_PHONE`. Do not infer type from product-line text at runtime. Update labels such as summary scope from `整机产品项目` to `整机项目`, while record type tags continue to show the exact new type.

- [ ] **Step 5: Replace runtime equality checks with the helper**

Use:

```ts
const isWholeMachine = isMachineProjectType(project.type)
```

Apply it to market initialization, market tab visibility, project-space plan selection, shared plan page, workspace rendering, project navigation, summary-board scope, roadmap utilities, and dormant roadmap code. Keep the three machine types on the same market-dimension behavior.

- [ ] **Step 6: Verify the migration**

Run:

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Expected: machine assertions and TypeScript both pass.

- [ ] **Step 7: Commit the migration**

```bash
git add src/constants/projectTypes.ts src/types/app.ts src/types/index.ts src/data/projects.ts src/stores/ui.ts src/stores/plan.ts src/stores/project.ts src/components/workspace/WorkspaceModule.tsx src/containers/WorkspaceContainer.tsx src/containers/ProjectSpaceContainer.tsx src/components/plan/PlanModule.tsx src/app/page.tsx src/app/share/plan/page.tsx src/app/config/level1-template/page.tsx src/app/config/level2-template/page.tsx src/components/roadmap/ProjectPlanSummaryBoard.tsx src/components/roadmap/utils.ts src/components/roadmap/MilestoneView.tsx src/components/roadmap/MRTrainView.tsx scripts/verify-project-roadmap.mjs
git commit -m "refactor: split machine project types"
```

## Task 3: Add roadmap contracts and pure business rules

**Files:**

- Create: `src/types/roadmap.ts`
- Create: `src/lib/roadmapValidation.ts`
- Create: `src/lib/roadmapSorting.ts`
- Create: `src/lib/roadmapAudit.ts`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing behavior tests**

Add assertions for display names, duplicate keys, brand lines, semantic version order, RAM order, and audit order:

```js
const validation = loadTypeScriptModule('src/lib/roadmapValidation.ts')
const sorting = loadTypeScriptModule('src/lib/roadmapSorting.ts')
const audit = loadTypeScriptModule('src/lib/roadmapAudit.ts')

assert(validation.buildRoadmapDisplayName('X6877', 'Android 16', '新品') === 'X6877', 'New product display name is wrong')
assert(validation.buildRoadmapDisplayName('X6877', 'Android 16', '老品') === 'X6877(Android 16)', 'Old product display name is wrong')
assert(validation.buildRoadmapDuplicateKey(' x6877 ', 'Android 16', '新品') === 'X6877|Android 16|新品', 'Duplicate key must trim and ignore case')
assert(validation.normalizeTosVersionName('tos17.2')?.name === 'tOS 17.2', 'tOS name normalization is wrong')
assert(validation.normalizeTosVersionName('tOS 17') === null, 'tOS version must include major and minor')
assert(JSON.stringify(validation.getProductLineOptions('待定')) === JSON.stringify(['待定']), 'Pending brand line rule is wrong')
assert(JSON.stringify(validation.getProductLineOptions('其他品牌')) === JSON.stringify(['其他系列']), 'Other-brand line rule is wrong')
assert(sorting.compareSemanticTos({ major: 18, minor: 0 }, { major: 17, minor: 2 }) > 0, 'Semantic tOS ordering is wrong')
assert(sorting.compareRam('12GB', '8GB') > 0, 'RAM ordering is wrong')
assert(
  audit.ROADMAP_AUDIT_FIELDS.join(',') === 'firstSaleTosVersionId,brand,productLine,marketName,projectCode,productType,platform,startRam,versionType,str5Date,launchDate,developMode,remark',
  'Audit field whitelist or order is wrong',
)
```

Run the harness and expect module-resolution failures because the files do not exist.

- [ ] **Step 2: Define the complete domain contracts**

`src/types/roadmap.ts` must export the approved unions plus these shared constants:

```ts
import type { MachineProjectType } from '@/constants/projectTypes'

export type RoadmapSource = 'normal' | 'planned'
export type RoadmapViewMode = 'table' | 'evolution'
export type RoadmapProductType = '新品' | '老品'
export type RoadmapBrand = 'TECNO' | 'Infinix' | 'itel' | '待定' | '其他品牌'
export type RoadmapAndroidVersion = 'Android 16' | 'Android 17' | 'Android 18'
export type RoadmapRam = '2GB' | '3GB' | '4GB' | '6GB' | '8GB' | '12GB' | '16GB'
export type RoadmapVersionType = 'Full' | 'Slim' | 'Go'
export type RoadmapDevelopMode = '自研' | 'ODC' | 'ITD-ODC' | 'ODM' | '纯外研'
export type RoadmapSortDirection = 'ascend' | 'descend' | null
export type RoadmapChangeAction = 'create' | 'update' | 'delete'

export interface RoadmapProjectFields {
  machineProjectType: MachineProjectType
  projectCode: string
  displayName: string
  androidVersion: RoadmapAndroidVersion
  firstSaleTosVersionId: string
  brand: RoadmapBrand
  productLine: string
  productSeries: string
  marketName: string
  productType: RoadmapProductType
  platform: string
  startRam: RoadmapRam
  versionType: RoadmapVersionType
  str5Date: string
  launchDate: string
  developMode: RoadmapDevelopMode
  remark: string
}

export interface RoadmapProjectRow extends RoadmapProjectFields {
  id: string
  source: RoadmapSource
  status: string
  readOnly: boolean
}

export interface PlannedRoadmapProject extends RoadmapProjectFields {
  id: string
  status: '待规划'
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface TosVersionConfig {
  id: string
  name: string
  major: number
  minor: number
  targets: string[]
  createdAt: string
  updatedAt: string
}
```

Also define `RoadmapPlanningConflictGroup`, `RoadmapFieldChange`, `RoadmapChangeLog`, `RoadmapFilterCondition`, `RoadmapSortState`, `RoadmapColumnKey`, `RoadmapStoreState`, and action-result types. Export `ROADMAP_COLUMNS` in the approved 14-field order; set `productSeries.defaultVisible` to `false` and every other business field to `true`.

- [ ] **Step 3: Implement validation and normalization**

`roadmapValidation.ts` must provide:

```ts
export const PRODUCT_LINES_BY_BRAND = {
  TECNO: ['PHANTOM', 'CAMON', 'POVA', 'SPARK', 'POP'],
  Infinix: ['ZERO', 'NOTE', 'GT', 'HOT', 'SMART'],
  itel: ['SUPER', 'POWER', 'CITY', 'A'],
  待定: ['待定'],
  其他品牌: ['其他系列'],
} as const

export function buildRoadmapDisplayName(
  projectCode: string,
  androidVersion: RoadmapAndroidVersion,
  productType: RoadmapProductType,
) {
  const normalizedCode = projectCode.trim()
  return productType === '老品' ? `${normalizedCode}(${androidVersion})` : normalizedCode
}

export function buildRoadmapDuplicateKey(
  projectCode: string,
  androidVersion: string,
  productType: string,
) {
  return `${projectCode.trim().toLocaleUpperCase()}|${androidVersion.trim()}|${productType.trim()}`
}

export function normalizeTosVersionName(input: string) {
  const match = input.trim().match(/^tos\s*(\d+)\.(\d+)$/i)
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  return { name: `tOS ${major}.${minor}`, major, minor }
}
```

Add `getProductLineOptions`, `validatePlannedProject`, `isExactRoadmapDuplicate`, and `normalizeLegacyRoadmapProductType`. Validation must require every planned field except `remark`, exclude the current record during edit, and return field-keyed errors so the Modal can focus the first invalid control.

- [ ] **Step 4: Implement sorting and audit helpers**

`roadmapSorting.ts` must compare semantic versions by numeric major/minor, RAM by parsed GB, dates by ISO date, and all other fields through `localeCompare('zh-CN', { numeric: true, sensitivity: 'base' })`.

`roadmapAudit.ts` must export the fixed whitelist and label map, plus:

```ts
export function diffRoadmapProjectFields(
  before: RoadmapProjectFields,
  after: RoadmapProjectFields,
  versions: TosVersionConfig[],
): RoadmapFieldChange[]

export function createRoadmapAuditSnapshot(
  fields: RoadmapProjectFields,
  versions: TosVersionConfig[],
): Partial<RoadmapProjectFields>
```

Resolve `firstSaleTosVersionId` to the current display name before comparing or writing a log. Do not include Android version or product series in ordinary updates.

- [ ] **Step 5: Run the behavioral harness and type check**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Expected: all pure-rule checks pass and TypeScript passes.

- [ ] **Step 6: Commit the domain foundation**

```bash
git add src/types/roadmap.ts src/lib/roadmapValidation.ts src/lib/roadmapSorting.ts src/lib/roadmapAudit.ts scripts/verify-project-roadmap.mjs
git commit -m "feat: add roadmap domain rules"
```

## Task 4: Build the persisted roadmap store and migration

**Files:**

- Create: `src/stores/roadmap.ts`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing store-structure and migration checks**

Assert that the store source uses `persist`, a named storage key, `version: 1`, a `migrate` function, and `partialize`; assert initial versions normalize to the approved seven entries and are descending through a pure exported initializer.

```js
const roadmapStoreSource = fs.readFileSync(path.join(root, 'src/stores/roadmap.ts'), 'utf8')
for (const token of ['persist(', "name: 'pms-project-roadmap'", 'version: 1', 'migrate:', 'partialize:']) {
  assert(roadmapStoreSource.includes(token), `Roadmap store is missing ${token}`)
}
const roadmapStore = loadTypeScriptModule('src/stores/roadmap.ts')
assert(
  roadmapStore.createInitialTosVersions().map(item => item.name).join(',') === 'tOS 18.0,tOS 17.2,tOS 17.1,tOS 17.0,tOS 16.3,tOS 16.2,tOS 16.1',
  'Initial tOS versions must be semantic-descending',
)
```

Run the harness and expect failure because the store does not exist.

- [ ] **Step 2: Implement initial state and persistence boundary**

Use stable IDs `tos-16-1` through `tos-18-0`. Persist only roadmap-domain state:

```ts
export const useRoadmapStore = create<RoadmapStore>()(
  persist(
    (set, get) => ({
      plannedProjects: [],
      tosVersions: createInitialTosVersions(),
      changeLogs: [],
      viewMode: 'table',
      selectedTosVersionId: 'tos-18-0',
      brandFilter: 'all',
      productTypeFilter: 'all',
      filters: [],
      visibleColumns: ROADMAP_COLUMNS.filter(column => column.defaultVisible).map(column => column.key),
      sort: { field: null, direction: null },
      selectedConflictKey: null,
      createPlannedProject: input => createPlannedProject(set, get, input),
      updatePlannedProject: (id, input) => updatePlannedProject(set, get, id, input),
      deletePlannedProject: (id, actor) => deletePlannedProject(set, get, id, actor),
      createTosVersion: input => createTosVersion(set, get, input),
      renameTosVersion: (id, input) => renameTosVersion(set, get, id, input),
      deleteTosVersion: (id, normalReferenceCount) => deleteTosVersion(set, get, id, normalReferenceCount),
      setTosTargets: (id, targets) => setTosTargets(set, id, targets),
      recordNormalProjectChange: log => set(state => ({ changeLogs: [log, ...state.changeLogs] })),
    }),
    {
      name: 'pms-project-roadmap',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: migrateRoadmapState,
      partialize: state => ({
        plannedProjects: state.plannedProjects,
        tosVersions: state.tosVersions,
        changeLogs: state.changeLogs,
        viewMode: state.viewMode,
        selectedTosVersionId: state.selectedTosVersionId,
        brandFilter: state.brandFilter,
        productTypeFilter: state.productTypeFilter,
        filters: state.filters,
        visibleColumns: state.visibleColumns,
        sort: state.sort,
      }),
    },
  ),
)
```

- [ ] **Step 3: Implement planned-project actions and audit writes**

Creation derives `displayName`, writes timestamps/user, blocks exact duplicates, and prepends a create log with snapshot. Update excludes self from duplicate detection and records only changed audit fields. Delete removes the project and prepends a delete log with the pre-delete snapshot.

- [ ] **Step 4: Implement version CRUD, targets, and reference protection**

Normalize names before create/rename, reject duplicates, keep stable IDs on rename, trim empty target rows, and return structured results:

```ts
type RoadmapMutationResult =
  | { ok: true }
  | { ok: false; reason: 'duplicate' | 'referenced' | 'not-found' | 'invalid'; referenceCount?: number }
```

`deleteTosVersion` must count planned references internally and add the supplied normal-reference count. If the selected version is deleted, select the highest remaining semantic version.

- [ ] **Step 5: Implement persisted-state migration**

`migrateRoadmapState` must:

1. Parse old version names through `normalizeTosVersionName`.
2. Rebuild missing stable IDs from major/minor.
3. Convert legacy planned-project string tOS references to IDs.
4. Recompute planned display names.
5. Drop malformed filters and unknown visible-column keys.
6. Fall back to initial versions if stored data is malformed.

Catch malformed localStorage data through Zustand storage fallback and log one `console.error` without blocking the module.

- [ ] **Step 6: Verify and commit**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/stores/roadmap.ts scripts/verify-project-roadmap.mjs
git commit -m "feat: add persisted roadmap store"
```

Expected: store/migration checks and TypeScript pass.

## Task 5: Adapt normal projects, enrich mocks, and derive history/conflicts

**Files:**

- Create: `src/lib/roadmapProjectAdapter.ts`
- Modify: `src/types/app.ts`
- Modify: `src/data/projects.ts`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing adapter and conflict tests**

Build fixtures containing one normal project and two planned projects with the same normalized key but different tOS versions. Assert one conflict group, two unique planned conflicts, no normal-vs-normal conflict, and no dependency on view filters.

```js
const adapter = loadTypeScriptModule('src/lib/roadmapProjectAdapter.ts')
const groups = adapter.deriveRoadmapPlanningConflicts(normalRows, plannedRows)
assert(groups.length === 1, 'Cross-source duplicates must form one conflict group')
assert(groups[0].normalProjects.length === 1, 'Conflict group must retain normal projects')
assert(groups[0].plannedProjects.length === 2, 'Conflict group must retain all planned projects across tOS versions')
assert(adapter.countConflictingPlannedProjects(groups) === 2, 'Conflict count must count unique planned projects')
```

Run the harness and expect a missing-module failure.

- [ ] **Step 2: Add explicit normal-roadmap fields to `ProjectItem`**

Add optional fields without removing existing compatibility fields:

```ts
firstSaleTosVersionId?: string
projectCode?: string
platform?: string
startRam?: RoadmapRam
str5Date?: string
remark?: string
```

Retain `tosVersion`, `model`, `cpu`, `chipPlatform`, `memory`, and `projectDescription` because other screens still use them.

- [ ] **Step 3: Enrich every machine mock explicitly**

For each machine mock, set `firstSaleTosVersionId`, `projectCode`, `platform`, `startRam`, `str5Date`, and `remark`. Normalize legacy values used by the roadmap:

- `productType: '升级'` or `换代` maps to `老品`.
- `developMode: '外研'` maps to `纯外研`.
- `developMode: '联合开发'` maps to `ITD-ODC`.
- `memory: '8GB+256GB'` may backfill `startRam: '8GB'`, but the explicit `startRam` field becomes authoritative.

- [ ] **Step 4: Implement the adapter**

Export:

```ts
export function adaptNormalProject(
  project: ProjectItem,
  versions: TosVersionConfig[],
): RoadmapProjectRow | null

export function adaptPlannedProject(project: PlannedRoadmapProject): RoadmapProjectRow

export function mergeRoadmapProjects(
  projects: ProjectItem[],
  plannedProjects: PlannedRoadmapProject[],
  versions: TosVersionConfig[],
): RoadmapProjectRow[]

export function findRoadmapHistoryMatches(
  rows: RoadmapProjectRow[],
  projectCode: string,
  excludedId?: string,
): RoadmapProjectRow[]

export function deriveRoadmapPlanningConflicts(
  normalRows: RoadmapProjectRow[],
  plannedRows: RoadmapProjectRow[],
): RoadmapPlanningConflictGroup[]
```

`adaptNormalProject` returns `null` unless `isMachineProjectType(project.type)`. It sets `source: 'normal'`, `readOnly: true`, resolves stable tOS ID from the new field first and legacy string second, and uses compatibility fallbacks only during migration.

- [ ] **Step 5: Keep conflict derivation outside the filtered pipeline**

Use duplicate-key maps built from the complete normal and planned arrays. Sort conflict groups by planned display name; de-duplicate records by source/id. Do not accept selected tOS, brand, product type, or filter conditions as function arguments.

- [ ] **Step 6: Verify and commit**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/lib/roadmapProjectAdapter.ts src/types/app.ts src/data/projects.ts scripts/verify-project-roadmap.mjs
git commit -m "feat: adapt projects for roadmap"
```

## Task 6: Route normal-project writes through shared audited actions

**Files:**

- Modify: `src/stores/project.ts`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/data/externalProjectPool.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/constants/projectBasicFields.ts`
- Modify: `src/stores/permission.ts`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing source-boundary checks**

Assert that `ProjectActions` exposes `updateProject` and `deleteProject`, `AddProjectModal` includes `firstSaleTosVersionId`, and `ProjectSpaceContainer` no longer performs direct project-array replacement for basic-info saves.

```js
const projectStoreSource = fs.readFileSync(path.join(root, 'src/stores/project.ts'), 'utf8')
assert(projectStoreSource.includes('updateProject:'), 'Project store must expose updateProject')
assert(projectStoreSource.includes('deleteProject:'), 'Project store must expose deleteProject')
const addModalSource = fs.readFileSync(path.join(root, 'src/components/workspace/AddProjectModal.tsx'), 'utf8')
assert(addModalSource.includes('firstSaleTosVersionId'), 'Normal machine creation must require first-sale tOS')
```

Run the harness and expect failures.

- [ ] **Step 2: Add global permission helpers**

The roadmap permissions are global, not project-scoped. Add to `src/stores/permission.ts`:

```ts
export function hasGlobalPermission(userName: string, permKey: string): boolean
export function useHasGlobalPermission(userName: string): (permKey: string) => boolean
```

Resolve every global role containing the user and return true when any role grants the key. The management group continues to bypass checks.

- [ ] **Step 3: Add shared project actions with one audit boundary**

Define actions:

```ts
addProject: (newProject: ProjectItem, actor?: string) => void
updateProject: (projectId: string, patch: Partial<ProjectItem>, actor?: string) => ProjectItem | null
deleteProject: (projectId: string, actor?: string) => boolean
```

Before/after adaptation uses the current roadmap version catalog. Write normal create/update/delete logs only for machine projects. Update `selectedProject` inside the same action when it points at the modified record. Non-machine project writes remain unaffected.

- [ ] **Step 4: Make first-sale tOS required for normal machine creation**

Extend `FormShape` and render a conditional field whenever `isMachineProjectType(Form.useWatch('type', form))`:

```tsx
<Form.Item
  label="首销 tOS 版本"
  name="firstSaleTosVersionId"
  rules={[{ required: true, message: '请选择首销 tOS 版本' }]}
>
  <Select options={descendingVersions.map(version => ({ label: version.name, value: version.id }))} />
</Form.Item>
```

Normal machine creation must also seed roadmap-compatible fields from the external project data: `projectCode`, `platform`, `productType`, `startRam`, `versionType`, `str5Date`, `launchDate`, `developMode`, and `remark`. Keep non-machine creation unchanged.

- [ ] **Step 5: Replace direct project-space save writes**

Change `saveBasicInfoEdit` to call:

```ts
const updated = updateProject(selectedProject.id, updatedFields, currentLoginUser)
if (!updated) return
setBasicInfoEditMode(false)
message.success('基本信息已保存')
```

Use the same action for market configuration updates. Add the new roadmap fields to the machine basic-information field definitions so existing normal-project editing can update and audit them. Use the maintained tOS catalog for the first-sale tOS selector.

- [ ] **Step 6: Verify normal creation and audit wiring**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Expected: shared-action checks pass; creating a machine project without first-sale tOS fails form validation; updating through the store emits at most one audit record.

- [ ] **Step 7: Commit**

```bash
git add src/stores/project.ts src/components/workspace/AddProjectModal.tsx src/data/externalProjectPool.ts src/containers/ProjectSpaceContainer.tsx src/constants/projectBasicFields.ts src/stores/permission.ts scripts/verify-project-roadmap.mjs
git commit -m "feat: audit normal roadmap projects"
```

## Task 7: Build planned-project, tOS-version, and target maintenance overlays

**Files:**

- Create: `src/components/roadmap/PlannedProjectModal.tsx`
- Create: `src/components/roadmap/TosVersionMaintenanceModal.tsx`
- Create: `src/components/roadmap/TosTargetEditor.tsx`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing overlay contract checks**

Assert source-level requirements that are difficult to omit accidentally:

```js
const plannedModalSource = fs.readFileSync(path.join(root, 'src/components/roadmap/PlannedProjectModal.tsx'), 'utf8')
for (const field of ['projectCode', 'androidVersion', 'firstSaleTosVersionId', 'brand', 'productLine', 'productSeries', 'marketName', 'productType', 'platform', 'startRam', 'versionType', 'str5Date', 'launchDate', 'developMode', 'remark']) {
  assert(plannedModalSource.includes(`name="${field}"`) || plannedModalSource.includes(`name='${field}'`), `Planned-project form is missing ${field}`)
}
assert(plannedModalSource.includes('历史同名项目'), 'Planned-project form must show history matches')
assert(plannedModalSource.includes('已存在相同项目'), 'Planned-project form must explain exact duplicates')

const maintenanceSource = fs.readFileSync(path.join(root, 'src/components/roadmap/TosVersionMaintenanceModal.tsx'), 'utf8')
assert(!maintenanceSource.includes('最新'), 'tOS maintenance must not mark a latest version')
assert(maintenanceSource.includes('引用'), 'tOS maintenance must show reference counts')
```

Run the harness and expect missing-file failures.

- [ ] **Step 2: Implement the shared planned-project Modal**

Use one `Form<PlannedRoadmapProjectInput>` for create/edit. Split the body into three visual sections: project classification, product/version data, and dates/remarks. All fields except `remark` are required. Use `DatePicker` values in the form and convert to `YYYY-MM-DD` on submit.

Watch `projectCode`, `androidVersion`, `productType`, and `brand`:

```ts
const projectCode = Form.useWatch('projectCode', form) || ''
const androidVersion = Form.useWatch('androidVersion', form)
const productType = Form.useWatch('productType', form)
const brand = Form.useWatch('brand', form)

const historyMatches = useMemo(
  () => findRoadmapHistoryMatches(allRows, projectCode, editingProject?.id),
  [allRows, editingProject?.id, projectCode],
)
const duplicateExists = useMemo(
  () => Boolean(androidVersion && productType && allRows.some(row => (
    row.id !== editingProject?.id
    && buildRoadmapDuplicateKey(row.projectCode, row.androidVersion, row.productType)
      === buildRoadmapDuplicateKey(projectCode, androidVersion, productType)
  ))),
  [allRows, androidVersion, editingProject?.id, projectCode, productType],
)
```

Use the actual variable name `projectCode` consistently. The create button is disabled while `duplicateExists` or submitting. On validation failure, call `form.scrollToField(firstErrorField, { block: 'center' })` and focus the matching control.

In edit mode, add a permission-gated danger action in the Modal footer. It must use the same deletion confirmation and audit-preserving store action as row/card deletion; do not implement a second deletion path.

- [ ] **Step 3: Implement history hint and brand cascade**

Below project identification fields, render a compact table with exactly: 项目名称、项目名、安卓版本、产品类型. A history match alone is informational; only the exact three-field duplicate blocks submission.

When brand changes:

```ts
const nextOptions = getProductLineOptions(nextBrand)
const currentLine = form.getFieldValue('productLine')
if (!nextOptions.includes(currentLine)) form.setFieldValue('productLine', undefined)
```

For `待定` and `其他品牌`, set the sole product-line value automatically and keep the select enabled for transparent feedback.

- [ ] **Step 4: Implement tOS maintenance in semantic-descending order**

Render name, target summary, total reference count, edit, target, and delete. `referenceCount = normalRows + plannedRows`. Disable deletion when nonzero and use a tooltip such as `已被 3 个项目引用，无法删除`. For an unreferenced version, use `Modal.confirm` before calling the store action.

Create and rename use the same inline form, normalize input on blur/submit, and show specific invalid/duplicate errors. Do not render a newest tag or special first-row style.

- [ ] **Step 5: Implement target editing**

`TosTargetEditor` uses `Form.List` or equivalent stable keyed rows. Trim entries and drop blank targets on save. Confirm that saving an empty list removes the target card completely rather than leaving an empty shell.

- [ ] **Step 6: Verify and commit**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/components/roadmap/PlannedProjectModal.tsx src/components/roadmap/TosVersionMaintenanceModal.tsx src/components/roadmap/TosTargetEditor.tsx scripts/verify-project-roadmap.mjs
git commit -m "feat: add roadmap maintenance dialogs"
```

## Task 8: Build the module shell, toolbar, filters, and shared column settings

**Files:**

- Create: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Create: `src/components/roadmap/RoadmapToolbar.tsx`
- Create: `src/components/roadmap/RoadmapFilterDrawer.tsx`
- Create: `src/components/roadmap/RoadmapColumnSettingsDrawer.tsx`
- Modify: `src/lib/filterConditions.ts`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing shell and no-search checks**

```js
const toolbarSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')
for (const label of ['表单视图', '版本演进视图', '修改记录', 'tOS 版本维护', '创建待规划项目', '筛选', '列设置']) {
  assert(toolbarSource.includes(label), `Roadmap toolbar is missing ${label}`)
}
assert(!toolbarSource.includes('placeholder="搜索'), 'Roadmap must not add a standalone search input')
assert(toolbarSource.includes('canEdit'), 'Roadmap edit actions must be permission-gated')
```

Run and expect missing-file failures.

- [ ] **Step 2: Extend filters for typed roadmap fields**

Keep the existing summary-board visual pattern, but extend reusable filter evaluation so each roadmap field declares its input type:

```ts
export type FilterFieldKind = 'text' | 'enum' | 'date'

export interface FilterFieldDefinition {
  key: string
  label: string
  kind: FilterFieldKind
  options?: { label: string; value: string }[]
}
```

Text supports equals/notEquals/contains/notContains/isEmpty/isNotEmpty. Enum supports equals/notEquals/isEmpty/isNotEmpty. Date supports equals/notEquals plus before/after. Multiple active conditions use AND. Continue preventing duplicate field selection in the same drawer.

- [ ] **Step 3: Implement the roadmap toolbar**

Left side:

- table/evolution segmented toggle;
- table-only tOS version selector in semantic-descending order;
- brand quick filter: 全部/TECNO/Infinix/itel;
- product-type quick filter: 全部/新品/老品.

Right side:

- change log;
- tOS maintenance;
- create planned project;
- filter;
- column settings.

Use `useHasGlobalPermission(currentLoginUser)` once in the parent and pass `canView`/`canEdit` booleans. View actions require `roadmap:view`; mutations require `roadmap:edit`. When a user without `roadmap:view` reaches the page directly, show an Ant Design `Result` or `Empty` permission state rather than rendering hidden content.

The toolbar shell is sticky below the existing project-view title region. Give it an opaque-enough glass background and explicit z-index so table/evolution content never shows through action labels while scrolling.

- [ ] **Step 4: Implement the filter drawer with no search box**

Use the same field + condition + value row layout as `ProjectPlanSummaryBoard`. The filter button shows an active indicator/count. Applying filters normalizes and stores them; resetting clears only drawer filters, not quick brand/product filters.

- [ ] **Step 5: Implement shared column visibility**

Render all 14 business fields in approved order. The action column is absent from the setting list and always rendered by views. Store one `visibleColumns` array; table columns and evolution-card detail rows both consume it. Enforce at least one visible business field.

- [ ] **Step 6: Compose the data pipeline in `ProjectRoadmapModule`**

Use separate memoized stages:

```ts
const isPresent = <T,>(value: T | null): value is T => value !== null
const normalRows = useMemo(() => projects.map(project => adaptNormalProject(project, versions)).filter(isPresent), [projects, versions])
const plannedRows = useMemo(() => plannedProjects.map(adaptPlannedProject), [plannedProjects])
const conflicts = useMemo(() => deriveRoadmapPlanningConflicts(normalRows, plannedRows), [normalRows, plannedRows])
const allRows = useMemo(() => [...normalRows, ...plannedRows], [normalRows, plannedRows])
const filteredRows = useMemo(() => applyRoadmapFilters(allRows, brandFilter, productTypeFilter, filters), [allRows, brandFilter, filters, productTypeFilter])
```

Conflicts must be computed before filtering. Debounce only free-text filter values by 150 ms; enum/date application remains immediate. Do not recompute grouping on scroll.

- [ ] **Step 7: Verify and commit**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/components/roadmap/ProjectRoadmapModule.tsx src/components/roadmap/RoadmapToolbar.tsx src/components/roadmap/RoadmapFilterDrawer.tsx src/components/roadmap/RoadmapColumnSettingsDrawer.tsx src/lib/filterConditions.ts scripts/verify-project-roadmap.mjs
git commit -m "feat: add roadmap controls and filters"
```

## Task 9: Implement the single-version table view

**Files:**

- Create: `src/components/roadmap/RoadmapTableView.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing table checks**

Assert the exact column order/defaults from `ROADMAP_COLUMNS`, and source tokens for `sorter`, `aria-sort`, planned-only edit/delete, target conditional rendering, and conflict text.

```js
const types = loadTypeScriptModule('src/types/roadmap.ts')
assert(types.ROADMAP_COLUMNS.map(column => column.key).join(',') === 'firstSaleTosVersionId,brand,productLine,productSeries,marketName,displayName,productType,platform,startRam,versionType,str5Date,launchDate,developMode,remark', 'Table field order is wrong')
assert(types.ROADMAP_COLUMNS.filter(column => column.defaultVisible).every(column => column.key !== 'productSeries'), 'Product series must be hidden by default')
```

Run and expect table-file failures.

- [ ] **Step 2: Render a single tOS version and conditional target card**

Filter the already-global-filtered rows by `selectedTosVersionId`. If selected ID no longer exists, select the highest semantic version. Render target glass only when `targets.length > 0`; do not allocate blank height when empty. When `canEdit` is true, the target card includes a clear `修改目标` action that opens `TosTargetEditor` for the selected version.

- [ ] **Step 3: Build all sortable business columns**

Generate columns from `ROADMAP_COLUMNS`, filtered by `visibleColumns`. Use `compareRoadmapValues` for each field and make sort controlled by the single store sort state:

```ts
sortOrder: sort.field === column.key ? sort.direction : null,
sorter: (left, right) => compareRoadmapValues(column.key, left, right, versions),
onHeaderCell: () => ({ 'aria-sort': getAriaSort(sort, column.key) }),
```

Display the current tOS name from the catalog, not the raw ID. Dates stay `YYYY-MM-DD`.

- [ ] **Step 4: Render source and conflict states correctly**

Normal rows show no edit/delete. Planned rows show `待规划`, edit, and delete. Conflicting planned rows add the warning background, left accent, and text `已存在正常项目`; normal rows in the same group remain visually unchanged. Clicking the warning text opens the conflict drawer at that key.

- [ ] **Step 5: Verify and commit**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/components/roadmap/RoadmapTableView.tsx src/components/roadmap/ProjectRoadmapModule.tsx scripts/verify-project-roadmap.mjs
git commit -m "feat: add roadmap table view"
```

## Task 10: Implement the aligned version-evolution view

**Files:**

- Create: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Create: `src/components/roadmap/RoadmapProjectCard.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing evolution structure checks**

```js
const evolutionSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
assert(evolutionSource.includes('grid-template-rows'), 'Evolution view must align sections with shared grid rows')
assert(evolutionSource.includes('scrollTo'), 'Evolution view must auto-scroll to the rightmost version')
assert(!evolutionSource.includes('overflowY: \'auto\''), 'Version columns must not have independent vertical scrolling')
assert(!evolutionSource.includes('最新'), 'Evolution view must not mark a latest version')
```

Run and expect missing-file failures.

- [ ] **Step 2: Build one shared two-axis scroll container**

Sort versions semantic-ascending for columns. Use one container with horizontal and vertical overflow. The grid has four conceptual rows:

```css
.pms-roadmap-evolution-grid {
  display: grid;
  grid-template-columns: repeat(var(--roadmap-version-count), minmax(292px, 1fr));
  grid-template-rows: auto minmax(min-content, max-content) auto minmax(min-content, max-content);
  align-items: stretch;
  min-width: max-content;
}
```

Render all version headers/targets in row 1, all new-product sections in row 2, all separators in row 3, and all old-product sections in row 4. Do not render each version as an isolated vertical flex column because that breaks old-product alignment.

- [ ] **Step 3: Implement sticky version/target cells**

Each row-1 cell uses `position: sticky; top: 0; z-index: 4`. The target block is inside the same sticky cell and omitted when empty. Keep a consistent minimum header height so project content starts aligned even when only some versions have targets. Each non-empty target card exposes `修改目标` when `canEdit` is true and opens the editor for that column's version.

- [ ] **Step 4: Implement fixed grouping and visible card fields**

Within each product-type cell, iterate brands in exact order:

```ts
const EVOLUTION_BRAND_ORDER = ['TECNO', 'Infinix', 'itel'] as const
```

Skip empty brand sections. `待定` and `其他品牌` remain available through the table/filter pipeline but are not added to fixed evolution groups. Cards always show project identity and source state; optional details follow shared `visibleColumns`.

- [ ] **Step 5: Add rightmost auto-scroll without hijacking filter changes**

Track a signature composed only of view mode and ordered version IDs. On initial evolution mount or version-list change:

```ts
requestAnimationFrame(() => {
  const element = scrollRef.current
  element?.scrollTo({ left: element.scrollWidth, behavior: reducedMotion ? 'auto' : 'smooth' })
})
```

Do not include brand, product type, field filters, or visible columns in the effect dependency signature.

- [ ] **Step 6: Add conflict and planned-only actions to cards**

Reuse the same text warning, edit/delete callbacks, and source rules as the table. Cards use stable `${source}:${id}` keys. Normal project cards remain read-only.

- [ ] **Step 7: Verify and commit**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/components/roadmap/RoadmapEvolutionView.tsx src/components/roadmap/RoadmapProjectCard.tsx src/components/roadmap/ProjectRoadmapModule.tsx src/styles/globals.css scripts/verify-project-roadmap.mjs
git commit -m "feat: add roadmap evolution view"
```

## Task 11: Add persistent conflict alert and grouped resolution drawer

**Files:**

- Create: `src/components/roadmap/RoadmapConflictAlert.tsx`
- Create: `src/components/roadmap/RoadmapConflictDrawer.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing conflict UI checks**

Assert exact user-facing text, absence of permanent-dismiss logic, presence of normal-project navigation, and planned delete confirmation.

```js
const alertSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapConflictAlert.tsx'), 'utf8')
assert(alertSource.includes('个待规划项目已存在对应正常项目'), 'Conflict alert copy is missing')
assert(alertSource.includes('查看冲突'), 'Conflict alert must open resolution')
assert(!alertSource.includes('dismiss'), 'Conflict alert must not be permanently dismissible')
```

Run and expect missing-file failures.

- [ ] **Step 2: Render the alert from global conflict state**

Place it under the toolbar and above both views. Count unique planned project IDs across groups. It disappears automatically only when the derived group array is empty.

- [ ] **Step 3: Implement grouped conflict presentation**

Each group header shows 项目名、安卓版本、产品类型. Under it:

- normal list: display name, first-sale tOS name, `正常项目`, `查看正常项目`;
- planned list: display name, first-sale tOS name, `待规划项目`, `删除待规划项目`.

Opening from a row/card sets `selectedConflictKey`; after the drawer mounts, scroll the matching group into view. Different first-sale tOS versions remain in the same duplicate-key group.

- [ ] **Step 4: Reuse existing normal-project navigation and planned deletion**

`查看正常项目` calls the `onViewProject(projectId)` callback already supplied to `RoadmapView`. Deletion uses one confirmation copy:

```text
删除后，该待规划项目会立即从项目路标中移除；修改记录仍保留删除前快照。确认删除？
```

On success, close or advance the drawer selection only after conflict derivation updates. Require `roadmap:edit`; view-only users may inspect and jump but cannot delete.

- [ ] **Step 5: Verify and commit**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/components/roadmap/RoadmapConflictAlert.tsx src/components/roadmap/RoadmapConflictDrawer.tsx src/components/roadmap/ProjectRoadmapModule.tsx scripts/verify-project-roadmap.mjs
git commit -m "feat: add roadmap conflict resolution"
```

## Task 12: Add the unified roadmap change log drawer

**Files:**

- Create: `src/components/roadmap/RoadmapChangeLogDrawer.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing audit-drawer checks**

Assert project query, source filter, action filter, date range, descending order, pagination, fixed audit labels, and before/after arrow rendering.

```js
const logSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapChangeLogDrawer.tsx'), 'utf8')
for (const label of ['项目标识', '来源', '动作', '日期范围', '正常项目', '待规划项目', '创建', '修改', '删除']) {
  assert(logSource.includes(label), `Change log drawer is missing ${label}`)
}
assert(logSource.includes('→'), 'Update records must show before-to-after values')
```

Run and expect a missing-file failure.

- [ ] **Step 2: Implement deterministic filtering and pagination**

Use controlled local drawer filters; query matches project display name and project ID. Source/action/date conditions use AND. Sort by `occurredAt` descending before slicing the current page. Reset page to 1 whenever filters change.

- [ ] **Step 3: Render create/update/delete correctly**

Record heading: time, actor, action verb, current tOS display name, project display name, source tag. Update renders only `changes` in the fixed audit order. Create/delete renders the audit snapshot in that same order. Do not show Android version or product series as ordinary update rows.

- [ ] **Step 4: Verify and commit**

```bash
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/components/roadmap/RoadmapChangeLogDrawer.tsx src/components/roadmap/ProjectRoadmapModule.tsx scripts/verify-project-roadmap.mjs
git commit -m "feat: add roadmap change history"
```

## Task 13: Mount the new roadmap, complete permission wiring, and polish the purple-glass UX

**Files:**

- Modify: `src/components/roadmap/RoadmapView.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`
- Modify: `src/containers/AppShell.tsx`
- Modify: `src/styles/globals.css`
- Modify: `src/app/page.tsx`
- Modify: `scripts/verify-roadmap-view-cleared.mjs`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Replace the blank branch with a failing integration assertion**

Update the master harness to require `ProjectRoadmapModule` import/mount and to reject `MilestoneView`/`MRTrainView` imports. Update `verify-roadmap-view-cleared.mjs` so it now means “legacy content remains unmounted and the rebuilt module is mounted,” not “branch is null.”

Run both scripts. Expected: FAIL until the new module is mounted.

- [ ] **Step 2: Mount only the new module**

`RoadmapView.tsx` remains responsible only for the outer project-view switch:

```tsx
{activeProjectView === 'summary' ? (
  <ProjectPlanSummaryBoard projects={projects} onViewProject={onViewProject} />
) : (
  <ProjectRoadmapModule projects={projects} onViewProject={onViewProject} />
)}
```

Remove now-unused `marketPlanData` and `level1Tasks` props from `RoadmapView` and `src/app/page.tsx`. Keep the existing outer title and summary-board switch.

- [ ] **Step 3: Complete visual hierarchy**

Add scoped classes in `globals.css`:

- glass toolbar/header/target/sticky surfaces using the existing purple tokens;
- high-contrast white table/card bodies;
- conflict background plus left accent and icon/text;
- focus-visible outlines;
- compact data-dense spacing;
- sticky z-index layers that do not cover drawers or Modal masks.

Do not apply backdrop blur to every table row or card body.

- [ ] **Step 4: Constrain animation and reduced motion**

Transitions use only opacity/transform where possible, 150–300 ms. Add:

```css
@media (prefers-reduced-motion: reduce) {
  .pms-roadmap-shell *,
  .pms-roadmap-shell *::before,
  .pms-roadmap-shell *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

All icon-only buttons require `aria-label`; selected quick filters and view toggles expose state through native Ant Design semantics or `aria-pressed`.

- [ ] **Step 5: Verify permission matrix in source and browser**

Confirm:

- `roadmap:view`: view, filter, sort, columns, audit, conflict inspect, normal-project jump.
- `roadmap:edit`: planned CRUD, conflict delete, tOS CRUD, target editing.
- normal rows/cards never expose edit/delete even when `roadmap:edit` is true.
- management group bypass remains intact.

Filter the `MainHeader` menu so the 项目视图 entry is absent when `roadmap:view` is false. Keep the `RoadmapView` direct-render permission state as defense in depth, covering programmatic navigation and stale `activeModule` state.

- [ ] **Step 6: Run integration checks and commit**

```bash
node scripts/verify-roadmap-view-cleared.mjs
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
git add src/components/roadmap/RoadmapView.tsx src/components/roadmap/ProjectRoadmapModule.tsx src/components/roadmap/RoadmapToolbar.tsx src/containers/AppShell.tsx src/styles/globals.css src/app/page.tsx scripts/verify-roadmap-view-cleared.mjs scripts/verify-project-roadmap.mjs
git commit -m "feat: mount rebuilt project roadmap"
```

Expected: both scripts and TypeScript pass.

## Task 14: Perform production build and full browser acceptance

**Files:**

- Modify when defects are found: only the files responsible for the defect
- Modify: `scripts/verify-project-roadmap.mjs` for any missing durable regression assertion

- [ ] **Step 1: Run all automated gates from a clean application state**

```bash
node scripts/verify-roadmap-view-cleared.mjs
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

Expected:

- both focused scripts print passed;
- TypeScript exits 0;
- Next prints a successful production build with the `/` route generated.

- [ ] **Step 2: Start the app and open the actual roadmap surface**

```bash
npm run dev
```

Use the in-app browser at the reported localhost URL. Navigate through the main header to 项目视图 → 项目路标视图. Do not verify only isolated files or static mockups.

- [ ] **Step 3: Run machine-type and planned-project acceptance**

1. Open workbench creation and confirm `整机-手机`, `整机-PAD`, `整机-笔电` are top-level types.
2. Select each machine type and confirm first-sale tOS is required.
3. Create a planned project and confirm it appears in the roadmap but not workbench/project-space navigation.
4. Verify new-product display `X6877` and old-product display `X6877(Android 16)`.
5. Enter a same-code history match and confirm four columns appear.
6. Create an exact duplicate key and confirm submission is disabled with a specific message.
7. Switch each brand and verify product-line candidates and stale-value clearing.
8. Edit a planned project and confirm both views refresh.
9. Delete it and confirm the audit delete snapshot remains.

- [ ] **Step 4: Run normal-project, conflict, and audit acceptance**

1. Confirm normal machine projects are visible and read-only.
2. Edit an audited normal field in project space and confirm the roadmap and one change-log record update.
3. Create or modify a normal project to match a planned duplicate key.
4. Confirm the persistent banner count reflects unique planned projects.
5. Confirm only the planned table row/card is highlighted with `已存在正常项目`.
6. Put matching records under different first-sale tOS versions and apply filters; confirm the global conflict remains discoverable.
7. Open the drawer from banner and row/card; confirm it positions the correct group.
8. Jump to the normal project.
9. Delete the planned project after confirmation and confirm conflict disappears while audit remains.

- [ ] **Step 5: Run tOS and table acceptance**

1. Open maintenance and confirm `tOS 18.0` through `tOS 16.1` are semantic-descending with no latest marker.
2. Verify normalization of `tos17.2`, duplicate rejection, referenced delete protection/count, unreferenced delete confirmation, and stable-ID rename behavior.
3. Add/edit/clear targets and confirm empty targets render no card.
4. In table view, switch one tOS at a time.
5. Verify the default 13 fields, optional product series, fixed operation column, and every field sort cycle.
6. Verify brand/product quick filters AND with drawer conditions.
7. Confirm there is no standalone search input.

- [ ] **Step 6: Run evolution, permissions, and accessibility acceptance**

1. Confirm versions are left-old/right-new and initial entry lands at the rightmost column.
2. Scroll vertically and verify one shared scrollbar, sticky version/targets, and aligned old-product starts.
3. Confirm 新品 above 老品 and TECNO/Infinix/itel ordering; empty brands disappear.
4. Change filter/column settings and confirm the viewport is not forced back to the right.
5. Switch to 查看组 and confirm mutation actions are absent/disabled while view actions remain.
6. Switch to 编辑组 and management group and confirm allowed actions.
7. Keyboard-tab through icon buttons, Modal fields, drawers, table sort headers, and conflict actions.
8. Enable reduced motion and repeat view switching/rightmost entry; confirm no prolonged animation.

- [ ] **Step 7: Inspect persistence recovery**

Reload after creating planned data, targets, filters, and column settings; confirm restoration. Then temporarily place malformed JSON under `pms-project-roadmap`, reload, and confirm safe fallback with a console error rather than a blank page. Restore valid storage before handoff.

- [ ] **Step 8: Fix defects with focused red/green checks**

For each defect:

1. add a failing assertion to `scripts/verify-project-roadmap.mjs` when the behavior is source-testable;
2. reproduce in browser;
3. apply the smallest fix;
4. rerun the focused script, TypeScript, and the affected browser path.

- [ ] **Step 9: Run final clean gates and commit fixes**

```bash
node scripts/verify-roadmap-view-cleared.mjs
node scripts/verify-project-roadmap.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git status --short
```

If acceptance produced fixes:

```bash
git add scripts/verify-project-roadmap.mjs src/components/roadmap src/constants/projectTypes.ts src/constants/projectBasicFields.ts src/data/projects.ts src/data/externalProjectPool.ts src/lib src/stores src/styles/globals.css src/types src/app/page.tsx src/app/share/plan/page.tsx src/containers/AppShell.tsx src/containers/WorkspaceContainer.tsx src/containers/ProjectSpaceContainer.tsx src/components/workspace src/components/plan/PlanModule.tsx
git commit -m "fix: close roadmap acceptance gaps"
```

Before committing, inspect `git diff --cached --name-only` and unstage every unrelated pre-existing dirty file.

## Completion criteria

- The old roadmap milestone/MR implementation remains unmounted.
- All three machine project types work across creation, filtering, project space, market plans, and roadmap adaptation.
- Normal projects remain canonical/read-only in roadmap; planned projects remain roadmap-only and support create/edit/delete.
- tOS catalog, targets, persistence, reference protection, semantic ordering, and no-latest-marker rules are verified.
- Table and evolution views share filters/columns, expose no separate search, and match alignment/sticky/auto-scroll rules.
- Cross-source conflicts are global, persistent, actionable, and resolved only by explicit planned-project deletion.
- Audit records have correct source/action/snapshot/diff semantics and fixed field order.
- Permission, keyboard, contrast, reduced-motion, type-check, production-build, and browser gates all pass.
