# Workbench, Technical Project, and Enum Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the workbench and project list, add a classified todo center and enum configuration, implement machine tOS version linkage, and deliver the complete technical-project creation, project-space, plan, permission, and project-list experience.

**Architecture:** Keep the existing Next.js, Zustand, Ant Design, permission, plan-version, and shared summary-table foundations. Add focused domain modules for todos, enums, technical projects, and technical plans; extract the project list from `WorkspaceContainer`; use adapters and selectors rather than duplicating business state across pages.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Ant Design 6, Zustand 4 persistence, existing Node contract verifiers, Puppeteer browser verification.

---

## Delivery strategy

The specification spans several independently testable subsystems. Execute the tasks in order, but keep each task in a separate commit so navigation, todos, enums, machine versions, technical projects, plans, permissions, and list rendering can be reviewed and reverted independently.

The approved design is:

- `docs/superpowers/specs/2026-07-31-workbench-technical-project-enum-redesign.md`

Do not change a confirmed rule without updating the design and obtaining user approval.

## File structure

### New focused modules

- `src/containers/WorkbenchContainer.tsx` — workbench tabs only.
- `src/containers/ProjectListContainer.tsx` — extracted project-list surface and project creation.
- `src/components/workspace/TodoCenter.tsx` — classified todo dashboard and table.
- `src/lib/todoAggregation.ts` — pure plan/transfer todo derivation.
- `src/types/enums.ts` — enum type and persisted-state contracts.
- `src/lib/enumValues.ts` — validation, normalization, semantic sorting, migration.
- `src/stores/enums.ts` — fixed enum types and string values.
- `src/components/config/EnumConfig.tsx` — enum CRUD UI.
- `src/lib/machineTosVersions.ts` — new/legacy product linkage and maximum-version calculation.
- `src/types/technicalProject.ts` — TDT project, subproject, team, deliverable, and configuration contracts.
- `src/constants/technicalProject.ts` — TMG/subdomain and fixed option definitions.
- `src/lib/technicalProjectRules.ts` — validation, IPM synchronization, stage calculation.
- `src/stores/technicalProject.ts` — subprojects, configuration, and soft-deactivation.
- `src/components/technical-project/TechnicalProjectCreateFields.tsx` — TDT create/edit fields.
- `src/components/technical-project/TechnicalProjectOverview.tsx` — core board, team, deliverables.
- `src/components/technical-project/TechnicalProjectBasicInfo.tsx` — subproject-tab basic information.
- `src/components/technical-project/SubprojectConfigModal.tsx` — four-field subproject configuration.
- `src/types/technicalPlan.ts` — technical template and plan-instance contracts.
- `src/lib/technicalPlanRules.ts` — template hierarchy and instance/version helpers.
- `src/stores/technicalPlan.ts` — independent TDT/subproject plan versions.
- `src/components/technical-project/TechnicalPlanModule.tsx` — TDT and subproject plan tabs.

### New verifiers

- `scripts/verify-workbench-split.mjs`
- `scripts/verify-todo-center.mjs`
- `scripts/verify-enum-config.mjs`
- `scripts/verify-machine-tos-versions.mjs`
- `scripts/verify-technical-project.mjs`
- `scripts/verify-technical-plan.mjs`
- `scripts/verify-project-list-matrix.mjs`
- `scripts/verify-project-role-sync.mjs`
- `screenshots/verify-workbench-technical-project-redesign.mjs`

### Existing integration points

- `src/app/page.tsx`
- `src/containers/AppShell.tsx`
- `src/containers/WorkspaceContainer.tsx`
- `src/containers/ConfigContainer.tsx`
- `src/containers/ProjectSpaceContainer.tsx`
- `src/components/workspace/AddProjectModal.tsx`
- `src/components/project-info/ProjectInfoModal.tsx`
- `src/components/project-summary/ProjectSummaryTable.tsx`
- `src/components/roadmap/ProjectRoadmapModule.tsx`
- `src/components/roadmap/TosVersionMaintenanceModal.tsx`
- `src/components/permission/PermissionModule.tsx`
- `src/stores/ui.ts`
- `src/stores/project.ts`
- `src/stores/plan.ts`
- `src/stores/permission.ts`
- `src/styles/globals.css`
- `src/types/app.ts`
- `package.json`

---

### Task 1: Add failing cross-feature contracts

**Files:**
- Create: `scripts/verify-workbench-split.mjs`
- Create: `scripts/verify-todo-center.mjs`
- Create: `scripts/verify-enum-config.mjs`
- Create: `scripts/verify-machine-tos-versions.mjs`
- Create: `scripts/verify-technical-project.mjs`
- Create: `scripts/verify-technical-plan.mjs`
- Create: `scripts/verify-project-list-matrix.mjs`
- Create: `scripts/verify-project-role-sync.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create source-contract helpers and one failing assertion per subsystem**

Use Node assertions and direct TypeScript-module loading following the existing verifier style. Each script must fail for a specific missing production contract. Example:

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const ui = read('src/stores/ui.ts')
assert.match(ui, /activeModule:\s*'workbench'/)
assert.match(ui, /projectSpaceOrigin/)
assert.match(read('src/app/page.tsx'), /<ProjectListContainer/)
console.log('workbench split contract passed')
```

Create equivalent initial assertions for:

- fixed enum types and string-snapshot semantics;
- machine version linkage functions;
- technical-project types and subproject soft deactivation;
- TDT/subproject template hierarchy;
- mandatory project-list column matrices;
- technical one-way role sync and tOS last-write-wins sync.

- [ ] **Step 2: Add package scripts**

```json
{
  "verify:workbench-split": "node scripts/verify-workbench-split.mjs",
  "verify:todo-center": "node scripts/verify-todo-center.mjs",
  "verify:enum-config": "node scripts/verify-enum-config.mjs",
  "verify:machine-tos": "node scripts/verify-machine-tos-versions.mjs",
  "verify:technical-project": "node scripts/verify-technical-project.mjs",
  "verify:technical-plan": "node scripts/verify-technical-plan.mjs",
  "verify:project-list-matrix": "node scripts/verify-project-list-matrix.mjs",
  "verify:project-role-sync": "node scripts/verify-project-role-sync.mjs"
}
```

- [ ] **Step 3: Run every verifier and confirm RED**

Run:

```bash
npm run verify:workbench-split
npm run verify:todo-center
npm run verify:enum-config
npm run verify:machine-tos
npm run verify:technical-project
npm run verify:technical-plan
npm run verify:project-list-matrix
npm run verify:project-role-sync
```

Expected: each command exits non-zero on its intended missing contract, not on syntax or file-loading errors.

- [ ] **Step 4: Commit the RED contract**

```bash
git add package.json scripts/verify-workbench-split.mjs scripts/verify-todo-center.mjs scripts/verify-enum-config.mjs scripts/verify-machine-tos-versions.mjs scripts/verify-technical-project.mjs scripts/verify-technical-plan.mjs scripts/verify-project-list-matrix.mjs scripts/verify-project-role-sync.mjs
git commit -m "test: define workbench and technical project contracts"
```

---

### Task 2: Split navigation, workbench, and project list

**Files:**
- Create: `src/containers/WorkbenchContainer.tsx`
- Create: `src/containers/ProjectListContainer.tsx`
- Modify: `src/containers/WorkspaceContainer.tsx`
- Modify: `src/containers/AppShell.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/stores/ui.ts`
- Test: `scripts/verify-workbench-split.mjs`

- [ ] **Step 1: Extend the failing verifier for exact navigation and origin rules**

Assert:

- header order is `workbench`, `projectList`, `roadmap`, `hrPipeline`, `config`;
- `workbenchTab` supports `todo | workTracker` and defaults to `todo`;
- project-space origin stores module and workbench tab;
- source-aware return runs through `navigateWithEditGuard`;
- workbench contains no project-list view selector or collapsed todo sidebar.

- [ ] **Step 2: Run the verifier**

Run: `npm run verify:workbench-split`
Expected: FAIL on missing `workbench`, `projectList`, or origin state.

- [ ] **Step 3: Add typed navigation state**

Use:

```ts
export type MainModule =
  | 'workbench'
  | 'projectList'
  | 'roadmap'
  | 'hrPipeline'
  | 'config'
  | 'projectSpace'

export type ProjectSpaceOrigin = {
  module: Exclude<MainModule, 'projectSpace'>
  workbenchTab?: 'todo' | 'workTracker'
} | null

export interface UiState {
  activeModule: MainModule
  workbenchTab: 'todo' | 'workTracker'
  projectSpaceOrigin: ProjectSpaceOrigin
}
```

Defaults:

```ts
activeModule: 'workbench',
workbenchTab: 'todo',
projectSpaceOrigin: null,
```

Add `enterProjectSpace(origin)` and `returnFromProjectSpace()` actions. The fallback origin is `{ module: 'workbench', workbenchTab: 'todo' }`.

- [ ] **Step 4: Extract the two containers**

`WorkbenchContainer` renders only two Ant Design tabs:

```tsx
<Tabs
  activeKey={workbenchTab}
  onChange={key => setWorkbenchTab(key as 'todo' | 'workTracker')}
  items={[
    { key: 'todo', label: '待办中心', children: <TodoCenter /> },
    { key: 'workTracker', label: '工作跟踪', children: <WorkTracker /> },
  ]}
/>
```

Move the current project list, add-project modal, filters, cards, and summary table to `ProjectListContainer`. Delete the old project/work-tracker tabs and collapsed todo rail from `WorkspaceContainer`; make it a compatibility re-export temporarily, then remove its imports.

- [ ] **Step 5: Wire the page and header**

Render:

```tsx
{activeModule === 'workbench' && <WorkbenchContainer />}
{activeModule === 'projectList' && <ProjectListContainer />}
```

Header items:

```ts
[
  { key: 'workbench', label: '工作台' },
  { key: 'projectList', label: '项目列表' },
  { key: 'roadmap', label: '项目视图' },
  { key: 'hrPipeline', label: '人力资源管道' },
  { key: 'config', label: '配置中心' },
]
```

Every project row, todo, and roadmap entry must call `enterProjectSpace` with its real origin. `ProjectSpaceHeader` returns through `returnFromProjectSpace`.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:workbench-split
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/containers/WorkbenchContainer.tsx src/containers/ProjectListContainer.tsx src/containers/WorkspaceContainer.tsx src/containers/AppShell.tsx src/app/page.tsx src/stores/ui.ts scripts/verify-workbench-split.mjs
git commit -m "feat: split workbench and project list"
```

---

### Task 3: Build the classified todo aggregation and polished todo center

**Files:**
- Create: `src/lib/todoAggregation.ts`
- Create: `src/components/workspace/TodoCenter.tsx`
- Modify: `src/containers/WorkbenchContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-todo-center.mjs`

- [ ] **Step 1: Specify todo contracts**

Use:

```ts
export type TodoSource = 'plan' | 'transfer'
export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export interface WorkbenchTodo {
  id: string
  source: TodoSource
  title: string
  projectId: string
  projectName: string
  assignee: string
  dueDate: string
  status: TodoStatus
  route:
    | { kind: 'plan'; planLevel: 'level1' | 'level2'; planKey: string; versionId: string }
    | { kind: 'transfer'; applicationId: string; view: 'entry' | 'review' | 'sqa-review' }
}

export interface PlanTodoCandidate {
  id: string
  projectId: string
  projectName: string
  assignee: string
  dueDate: string
  completed: boolean
  title: string
  planLevel: 'level1' | 'level2'
  planKey: string
  versionId: string
}

export interface TransferTodoCandidate {
  applicationId: string
  projectId: string
  projectName: string
  activeOwner: string
  dueDate: string
  completed: boolean
  title: string
  view: 'entry' | 'review' | 'sqa-review'
}

export interface TodoFilters {
  source: 'all' | TodoSource
  search: string
  projectId: string
  status: 'all' | TodoStatus
  dueDateFrom: string
  dueDateTo: string
}

export interface TodoSummary {
  total: number
  dueToday: number
  overdue: number
  completedThisWeek: number
}
```

Verifier fixtures must prove:

- only the current user is returned;
- plan tasks map by task responsibility;
- transfer applications map only their active action owner;
- checklist rows do not become separate todos;
- category and metric counts use the same filtered source.

- [ ] **Step 2: Run RED**

Run: `npm run verify:todo-center`
Expected: FAIL because `todoAggregation.ts` does not exist.

- [ ] **Step 3: Implement pure aggregation**

Expose:

```ts
export function aggregateWorkbenchTodos(input: {
  currentUser: string
  planTodos: readonly PlanTodoCandidate[]
  transferApplications: readonly TransferTodoCandidate[]
}): WorkbenchTodo[]

export function filterWorkbenchTodos(
  todos: readonly WorkbenchTodo[],
  filters: TodoFilters,
): WorkbenchTodo[]

export function summarizeWorkbenchTodos(
  todos: readonly WorkbenchTodo[],
  today: string,
): TodoSummary
```

Sort overdue first, then ascending due date, then localized title.

- [ ] **Step 4: Build the UI**

Create:

- segmented source selector `全部 / 计划待办 / 转维待办`;
- four metric cards;
- one compact filter toolbar;
- fixed-height table with sticky header;
- overdue red text, due-today orange badge, completed green state;
- responsive wrapping below 1100px;
- empty state per category.

Use stable row keys and `aria-label` values for source selector, search, project, status, and due-date controls.

- [ ] **Step 5: Wire navigation**

Plan rows select project, plan tab, plan instance, and version before entering project space. Transfer rows select application and transfer view. Preserve the workbench todo origin for return.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:todo-center
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/todoAggregation.ts src/components/workspace/TodoCenter.tsx src/containers/WorkbenchContainer.tsx src/styles/globals.css scripts/verify-todo-center.mjs
git commit -m "feat: add classified todo center"
```

---

### Task 4: Add fixed enum types, string-snapshot rules, and config UI

**Files:**
- Create: `src/types/enums.ts`
- Create: `src/lib/enumValues.ts`
- Create: `src/stores/enums.ts`
- Create: `src/components/config/EnumConfig.tsx`
- Modify: `src/containers/ConfigContainer.tsx`
- Test: `scripts/verify-enum-config.mjs`

- [ ] **Step 1: Define exact tests**

Fixtures must prove:

- only `tos-2-part` and `tos-3-part` types exist;
- type names cannot be edited or deleted;
- initial values are exact;
- whitespace is trimmed;
- `16.0` is valid only for two-part;
- `16.0.1` is valid only for three-part;
- duplicates are rejected;
- deletion removes the option without changing a captured business string;
- semantic sorting is numeric by component.

- [ ] **Step 2: Run RED**

Run: `npm run verify:enum-config`
Expected: FAIL on missing enum store.

- [ ] **Step 3: Implement types and rules**

```ts
export type EnumTypeKey = 'tos-2-part' | 'tos-3-part'

export interface EnumTypeDefinition {
  key: EnumTypeKey
  label: 'tOS版本（2位）' | 'tOS版本（3位）'
  values: string[]
}

export const ENUM_PATTERNS: Record<EnumTypeKey, RegExp> = {
  'tos-2-part': /^\d+\.\d+$/,
  'tos-3-part': /^\d+\.\d+\.\d+$/,
}
```

Expose `normalizeEnumValue`, `validateEnumValue`, and `sortEnumValues`.

- [ ] **Step 4: Implement the persisted store**

Persist only:

```ts
type PersistedEnumState = {
  valuesByType: Record<EnumTypeKey, string[]>
}
```

Seeds:

```ts
{
  'tos-2-part': ['16.0', '17.2'],
  'tos-3-part': ['16.0.1', '16.0.2', '17.2.0'],
}
```

Actions return `{ ok: true }` or `{ ok: false, reason: 'invalid' | 'duplicate' | 'missing' }`.

- [ ] **Step 5: Build the config UI**

Use a two-column card:

- fixed left type list;
- right table with value, display preview (`tOS${value}`), edit, delete;
- add/edit modal with inline format error;
- delete confirmation explains that historical saved strings are unaffected.

Do not expose type CRUD.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:enum-config
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/enums.ts src/lib/enumValues.ts src/stores/enums.ts src/components/config/EnumConfig.tsx src/containers/ConfigContainer.tsx scripts/verify-enum-config.mjs
git commit -m "feat: add enum value configuration"
```

---

### Task 5: Source tOS roadmap maintenance from two-part enums

**Files:**
- Modify: `src/components/roadmap/TosVersionMaintenanceModal.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/stores/roadmap.ts`
- Modify: `src/lib/roadmapValidation.ts`
- Test: `scripts/verify-enum-config.mjs`
- Test: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing integration assertions**

Assert:

- roadmap maintenance reads `tos-2-part`;
- business display adds `tOS`;
- roadmap no longer owns an independently editable tOS catalog;
- deleting an enum leaves existing roadmap project strings visible;
- new selections contain only current enum values.

- [ ] **Step 2: Run RED**

Run:

```bash
npm run verify:enum-config
node scripts/verify-project-roadmap.mjs
```

Expected: enum integration assertion fails.

- [ ] **Step 3: Add an enum adapter**

Replace ID coupling with string values at the UI boundary:

```ts
const twoPartOptions = enumValues.map(value => ({
  label: `tOS${value}`,
  value,
}))

const displayTosVersion = (value: string) =>
  value ? `tOS${value.replace(/^tOS/i, '')}` : '-'
```

Persist roadmap business selections as normalized numeric strings. Migration strips a leading `tOS` but preserves unrecognized historical text for display-only rows.

- [ ] **Step 4: Change maintenance behavior**

The roadmap maintenance entry opens or navigates to enum configuration rather than maintaining a second catalog. Existing roadmap filters and planned-project forms use enum options plus their already-saved historical current value.

- [ ] **Step 5: Run verification**

Run:

```bash
npm run verify:enum-config
node scripts/verify-project-roadmap.mjs
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/roadmap/TosVersionMaintenanceModal.tsx src/components/roadmap/ProjectRoadmapModule.tsx src/stores/roadmap.ts src/lib/roadmapValidation.ts scripts/verify-enum-config.mjs scripts/verify-project-roadmap.mjs
git commit -m "feat: source roadmap versions from enum config"
```

---

### Task 6: Implement machine new/legacy tOS version linkage and owner derivation

**Files:**
- Create: `src/lib/machineTosVersions.ts`
- Modify: `src/constants/projectInfoSchema.ts`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/lib/projectInfoRules.ts`
- Modify: `src/stores/project.ts`
- Test: `scripts/verify-machine-tos-versions.mjs`

- [ ] **Step 1: Define pure-rule tests**

Cover:

- project-name trim and exact match;
- new product initializes first-sale and current to selected three-part value;
- legacy product inherits first-sale from one matching new product;
- zero or multiple matching new products is rejected;
- numeric comparison makes `17.10.0 > 17.2.0`;
- new current is maximum across all same-name legacy projects;
- deleted enum values remain valid historical inputs to recomputation;
- responsible person is derived from SPM.

- [ ] **Step 2: Run RED**

Run: `npm run verify:machine-tos`
Expected: FAIL on missing `machineTosVersions.ts`.

- [ ] **Step 3: Implement pure functions**

```ts
export function normalizeMachineFamilyName(name: string): string {
  return name.trim()
}

export function compareThreePartVersions(a: string, b: string): number {
  const left = a.replace(/^tOS/i, '').split('.').map(Number)
  const right = b.replace(/^tOS/i, '').split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

export function resolveMachineTosUpdate(
  projects: readonly MachineVersionProject[],
  candidate: MachineVersionCandidate,
): MachineTosResolution
```

Return explicit error reasons: `missing-new-product`, `duplicate-new-product`, `invalid-version`.

- [ ] **Step 4: Make fields conditional**

For a new product:

- `firstSaleTosVersion` editable and required;
- `currentTosVersion` read-only computed.

For a legacy product:

- `firstSaleTosVersion` read-only inherited;
- `currentTosVersion` editable and required.

Options come from current three-part enum values. Existing deleted saved values remain rendered.

For a tOS version project, set its read-only `tosVersion` value directly from the normalized project name. Do not read, validate, or write enum configuration for this field.

- [ ] **Step 5: Apply atomic store updates**

Creation or editing must update the candidate and recompute only the one matched new-product record in the same `set` transaction. Do not update historical legacy records.

Set:

```ts
responsiblePersons: normalizedSpm ? [normalizedSpm] : []
```

Remove the independent project-responsible input for machine projects.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:machine-tos
npm run verify:project-summary
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/machineTosVersions.ts src/constants/projectInfoSchema.ts src/components/workspace/AddProjectModal.tsx src/components/project-info/ProjectInfoModal.tsx src/lib/projectInfoRules.ts src/stores/project.ts scripts/verify-machine-tos-versions.mjs
git commit -m "feat: link machine tOS versions"
```

---

### Task 7: Define technical-project data, field rules, and creation/edit UI

**Files:**
- Create: `src/types/technicalProject.ts`
- Create: `src/constants/technicalProject.ts`
- Create: `src/lib/technicalProjectRules.ts`
- Create: `src/components/technical-project/TechnicalProjectCreateFields.tsx`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/constants/projectInfoSchema.ts`
- Modify: `src/types/app.ts`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Add field and validation fixtures**

Prove:

- IPM selection maps category, secondary category, and technical track;
- technical lead is required and becomes responsible;
- other five team fields are optional;
- `无` subdomain auto-fills for the four no-subdomain TMGs;
- other TMG options match the approved table exactly;
- pre-project is required only for `技术项目前置工作`;
- pre-project candidates include all project types except current;
- year accepts a four-digit year;
- every deliverable accepts one URL or one file metadata object, never both.

- [ ] **Step 2: Run RED**

Run: `npm run verify:technical-project`
Expected: FAIL on missing contracts.

- [ ] **Step 3: Define technical types**

```ts
export type TechnicalDomain =
  | '基础架构TMG'
  | '性能TMG'
  | 'DFX TMG'
  | 'UX TMG'
  | '系统应用'
  | '底软通信'
  | '集成维护'
  | '其他'

export interface TechnicalTeam {
  technicalLead: string
  technicalProjectManager: string
  testRepresentative: string
  qualityRepresentative: string
  productRepresentative: string
  standardizationRepresentative: string
}

export type DeliverableValue =
  | { kind: 'url'; url: string }
  | { kind: 'file'; name: string; size: number; mimeType: string }
  | null
```

- [ ] **Step 4: Define exact constants**

```ts
export const SUBDOMAINS_BY_DOMAIN = {
  基础架构TMG: ['无'],
  性能TMG: ['无'],
  'DFX TMG': ['无'],
  'UX TMG': ['无'],
  系统应用: ['AIOS', '应用', '图形', '内核', '多媒体'],
  底软通信: ['器件', '蜂窝', '短距', '功耗'],
  集成维护: ['三方体验', 'GMS'],
  其他: ['安全', 'AIOT'],
} as const
```

- [ ] **Step 5: Build the form section**

Render read-only IPM fields first, then technical fields, team, and deliverables. Use a `YearPicker`, people selectors, searchable pre-project selector, multiline project value, and a reusable one-value deliverable control.

Do not render a technical-subproject creation path.

- [ ] **Step 6: Integrate create/edit and owner derivation**

On save:

```ts
responsiblePersons: values.technicalTeam.technicalLead
  ? [values.technicalTeam.technicalLead]
  : []
```

For capability projects, preserve the existing manual owner control. For tOS projects, derive owner from `tosVersionProjectManager`.

- [ ] **Step 7: Run verification**

Run:

```bash
npm run verify:technical-project
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/types/technicalProject.ts src/constants/technicalProject.ts src/lib/technicalProjectRules.ts src/components/technical-project/TechnicalProjectCreateFields.tsx src/components/project-info/ProjectInfoModal.tsx src/components/workspace/AddProjectModal.tsx src/constants/projectInfoSchema.ts src/types/app.ts scripts/verify-technical-project.mjs
git commit -m "feat: add technical project creation fields"
```

---

### Task 8: Add IPM subproject synchronization and configuration

**Files:**
- Create: `src/stores/technicalProject.ts`
- Create: `src/components/technical-project/SubprojectConfigModal.tsx`
- Modify: `src/lib/technicalProjectRules.ts`
- Modify: `src/data/externalProjectPool.ts`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Add synchronization fixtures**

Test:

- new stable IDs create active child records;
- updates preserve PMS configuration and plan references;
- missing IDs soft-deactivate;
- returning IDs reactivate;
- a failed sync makes no changes;
- duplicate incoming IDs reject the whole batch;
- manual delete action does not exist;
- core value and development mode are required before plan revision.

- [ ] **Step 2: Run RED**

Run: `npm run verify:technical-project`
Expected: synchronization assertions fail.

- [ ] **Step 3: Implement the store**

```ts
export interface TechnicalSubproject {
  id: string
  parentProjectId: string
  name: string
  active: boolean
  ipmOrder: number
  configuration: {
    coreValue: '' | '追赶' | '人无我有' | '人有我有'
    developmentMode: '' | '自研' | '谷歌合作' | 'SoC合作' | '高校合作'
    firstTosVersion: string
    firstMachineProjectId: string
  }
}
```

Persist subprojects and configuration by stable ID. `synchronizeSubprojects` validates the full payload before a single store update.

- [ ] **Step 4: Seed representative IPM fixtures**

Add at least:

- one TDT project with two active subprojects;
- one returned subproject that can be reactivated;
- deterministic order values.

Do not create separate PMS project-space entities for children.

- [ ] **Step 5: Build the configuration modal**

Use one compact modal with:

- required core value;
- required development mode;
- optional current two-part enum selection;
- optional searchable machine-project selector;
- cancel/confirm draft semantics;
- no delete button.

Show `待配置` until both required fields are present.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:technical-project
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/stores/technicalProject.ts src/components/technical-project/SubprojectConfigModal.tsx src/lib/technicalProjectRules.ts src/data/externalProjectPool.ts scripts/verify-technical-project.mjs
git commit -m "feat: synchronize technical subprojects"
```

---

### Task 9: Build technical project-space overview, basic information, team, and deliverables

**Files:**
- Create: `src/components/technical-project/TechnicalProjectOverview.tsx`
- Create: `src/components/technical-project/TechnicalProjectBasicInfo.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/lib/technicalProjectRules.ts`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Add stage and surface assertions**

Test `calculateTechnicalProjectStage`:

- before first phase → `未开始`;
- inside one top-level interval → its name;
- after all phases → `已完成`;
- missing date, gap, or overlap → `-`;
- child row uses parent result.

Assert project-space source mounts technical overview and basic-info components instead of the generic placeholder.

- [ ] **Step 2: Run RED**

Run: `npm run verify:technical-project`
Expected: stage or component assertion fails.

- [ ] **Step 3: Implement the stage selector**

```ts
export interface TechnicalStageTask {
  id: string
  name: string
  parentId: string | null
  planStartDate: string
  planEndDate: string
  order: number
}

export function calculateTechnicalProjectStage(
  topLevelTasks: readonly TechnicalStageTask[],
  today: string,
): string
```

Only consume the latest published TDT plan. Ignore drafts.

- [ ] **Step 4: Build the core board**

Use the existing project-space card visual language. Display the eight approved fields, with project value spanning the full width. Add team and deliverable sections below:

- six fixed team roles;
- custom permission roles;
- six deliverable links/files.

- [ ] **Step 5: Build basic-information child tabs**

Render only child tabs, in IPM order. Put the configuration icon beside each active tab. Add a `显示已停用` switch; inactive children are read-only and visibly tagged `已停用`.

- [ ] **Step 6: Integrate into project space**

Route technical project modules to the focused components. Keep generic navigation, RBAC, edit guard, and transfer-view reset behavior.

- [ ] **Step 7: Run verification**

Run:

```bash
npm run verify:technical-project
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/technical-project/TechnicalProjectOverview.tsx src/components/technical-project/TechnicalProjectBasicInfo.tsx src/containers/ProjectSpaceContainer.tsx src/lib/technicalProjectRules.ts src/styles/globals.css scripts/verify-technical-project.mjs
git commit -m "feat: add technical project space"
```

---

### Task 10: Replace technical plan-template categories

**Files:**
- Create: `src/types/technicalPlan.ts`
- Create: `src/lib/technicalPlanRules.ts`
- Modify: `src/stores/plan.ts`
- Modify: `src/containers/ConfigContainer.tsx`
- Test: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: Add exact template tests**

Assert:

- technical config exposes only `TDT项目计划` and `子项目计划`;
- TDT seed names, order, and parent relationships exactly match the approved table;
- TDT rejects depth greater than two;
- subproject seed order is exact;
- subproject template rejects any child task;
- other project-type templates are unchanged.

- [ ] **Step 2: Run RED**

Run: `npm run verify:technical-plan`
Expected: FAIL on missing technical template model.

- [ ] **Step 3: Define seeds and validators**

```ts
export const TDT_TEMPLATE_SEED = [
  ['规划阶段', ['规划启动', 'charter DCP']],
  ['概念阶段', ['TDR1']],
  ['计划阶段', ['TDR2', 'PDCP']],
  ['开发验证阶段', ['TDR3_X', 'TDCP_X']],
  ['迁移阶段', ['TDR4', 'EDCP']],
] as const

export const SUBPROJECT_TEMPLATE_SEED = [
  '第1版转测',
  '第2版转测',
  '第X版转测',
  'TDR3',
] as const
```

Expose `validateTechnicalTemplateDepth` and deterministic seed builders with stable IDs.

- [ ] **Step 4: Integrate config-center tabs**

When selected project family is technical:

- show `TDT项目计划 / 子项目计划`;
- hide generic `一级计划 / 二级计划` labels;
- enforce the correct add-task depth at the UI and store boundary;
- preserve revision/publish/template-version interactions.

- [ ] **Step 5: Reset only legacy technical template persistence**

Bump the plan-store persistence version. Migrate nontechnical data unchanged. Replace legacy technical template keys and technical plan Mock data with the new seeds.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:technical-plan
npm run verify:project-summary
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/technicalPlan.ts src/lib/technicalPlanRules.ts src/stores/plan.ts src/containers/ConfigContainer.tsx scripts/verify-technical-plan.mjs
git commit -m "feat: add technical plan templates"
```

---

### Task 11: Add independent TDT and subproject plan instances

**Files:**
- Create: `src/stores/technicalPlan.ts`
- Create: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/lib/technicalPlanRules.ts`
- Test: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: Add version-isolation tests**

Fixtures must prove:

- TDT instance is always first;
- active children follow IPM order;
- every instance has its own version sequence;
- every instance allows at most one draft;
- publishing one instance does not change another;
- creating a draft uses the latest published matching template;
- existing versions do not mutate after template changes;
- inactive children are history-only and cannot create drafts;
- incomplete child configuration cannot create drafts.

- [ ] **Step 2: Run RED**

Run: `npm run verify:technical-plan`
Expected: instance assertions fail.

- [ ] **Step 3: Implement keyed plan state**

```ts
export type TechnicalPlanScope =
  | { kind: 'tdt'; parentProjectId: string }
  | { kind: 'subproject'; parentProjectId: string; subprojectId: string }

export const getTechnicalPlanKey = (scope: TechnicalPlanScope) =>
  scope.kind === 'tdt'
    ? `${scope.parentProjectId}:tdt`
    : `${scope.parentProjectId}:subproject:${scope.subprojectId}`
```

Persist versions, current version, tasks by version, column settings, and collapsed rows per plan key.

- [ ] **Step 4: Reuse plan interactions**

Extract or adapt the existing plan table/gantt/version toolbar so `TechnicalPlanModule` receives:

```ts
{
  planKey,
  templateKind,
  maxDepth,
  canEdit,
  canPublish,
}
```

Keep date validation, compare, import/export, sortable columns, and draft cancellation behavior identical to machine plans.

- [ ] **Step 5: Build plan tabs**

Render:

- `TDT项目计划` first;
- active child plan tabs in IPM order;
- config icon next to child tabs;
- `显示已停用` history mode.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:technical-plan
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/stores/technicalPlan.ts src/components/technical-project/TechnicalPlanModule.tsx src/containers/ProjectSpaceContainer.tsx src/lib/technicalPlanRules.ts scripts/verify-technical-plan.mjs
git commit -m "feat: add technical plan instances"
```

---

### Task 12: Implement technical and tOS role synchronization

**Files:**
- Modify: `src/stores/permission.ts`
- Modify: `src/components/permission/PermissionModule.tsx`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/stores/project.ts`
- Test: `scripts/verify-project-role-sync.mjs`

- [ ] **Step 1: Add role-sync fixtures**

Technical assertions:

- six fixed roles are exact;
- form save overwrites their permission members;
- permission UI cannot edit fixed-role members;
- permissions remain editable;
- custom roles can be added and assigned;
- one parent permission set covers all children.

tOS assertions:

- all 19 approved roles exist;
- team save updates permission members;
- permission-member save updates team fields;
- last save wins;
- version project manager updates responsible person.

- [ ] **Step 2: Run RED**

Run: `npm run verify:project-role-sync`
Expected: FAIL on missing role contracts.

- [ ] **Step 3: Add typed mappings**

```ts
export const TECH_TEAM_ROLE_FIELD_MAP = {
  技术项目负责人: 'technicalLead',
  技术项目经理: 'technicalProjectManager',
  测试代表: 'testRepresentative',
  质量代表: 'qualityRepresentative',
  产品代表: 'productRepresentative',
  标准化代表: 'standardizationRepresentative',
} as const
```

Define the exact 19-entry tOS map from the approved design.

- [ ] **Step 4: Implement technical one-way sync**

Project save writes fixed-role membership in the same action. Permission member controls for fixed technical roles are disabled with tooltip `请在项目团队信息中维护`. Custom-role creation remains available.

- [ ] **Step 5: Implement tOS last-write-wins**

Both project-team save and permission-member save call one shared synchronizer that atomically updates both stores. When the role is `版本项目经理`, also update `responsiblePersons`.

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:project-role-sync
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/stores/permission.ts src/components/permission/PermissionModule.tsx src/components/project-info/ProjectInfoModal.tsx src/stores/project.ts scripts/verify-project-role-sync.mjs
git commit -m "feat: synchronize project team roles"
```

---

### Task 13: Complete the project-list matrix, filters, grouped milestones, and row navigation

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/lib/projectSummary.ts`
- Create: `src/lib/projectListMatrix.ts`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-list-matrix.mjs`
- Test: `scripts/verify-project-summary.mjs`

- [ ] **Step 1: Encode exact matrix tests**

Assert:

- no first-level `全部`;
- default category is machine;
- capability category is empty;
- machine and tOS quick-filter sets remain exact;
- technical has no secondary-category row;
- technical type options are `全部 / TDT项目 / 子项目`;
- technical name search is fuzzy;
- track and stage filters use stable current-category domains;
- mandatory columns for figures 6–9 cannot hide but can reorder;
- optional fields come from the current project-info schema;
- child row navigation selects parent space and child tab.

- [ ] **Step 2: Run RED**

Run: `npm run verify:project-list-matrix`
Expected: FAIL on missing matrix.

- [ ] **Step 3: Define the matrix**

```ts
export type ProjectListVariant =
  | 'machine'
  | 'tos'
  | 'technical-tdt'
  | 'technical-subproject'
  | 'capability'

export interface ProjectListColumnDefinition {
  key: string
  label: string
  required: boolean
  group?: { key: string; label: string; color: string }
}
```

Build exact required static field definitions from figures 6–9. Append dynamic template tasks:

- machine/tOS: direct second-level tasks grouped by top-level phase;
- TDT: direct second-level tasks grouped by top-level phase;
- child: one-level template tasks with the approved purple header treatment.

- [ ] **Step 4: Build technical rows**

TDT rows combine parent fields, computed stage, fixed team members, and latest published TDT task dates. Child rows combine child configuration, inherited parent stage, and latest published child-plan task dates.

No published plan means `-`.

- [ ] **Step 5: Apply required-column settings**

Required columns use `hideable: false`, stay visible through preference migration, and remain draggable. Optional schema fields remain configurable.

- [ ] **Step 6: Add header styling**

Use CSS variables for pastel groups. Apply color only to group and column headers. Keep data cells white; mark overdue valid ISO dates red.

- [ ] **Step 7: Run verification**

Run:

```bash
npm run verify:project-list-matrix
npm run verify:project-summary
npm run verify:workbench-list
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/containers/ProjectListContainer.tsx src/components/project-summary/ProjectSummaryTable.tsx src/lib/projectSummary.ts src/lib/projectListMatrix.ts src/styles/globals.css scripts/verify-project-list-matrix.mjs scripts/verify-project-summary.mjs
git commit -m "feat: complete project list matrices"
```

---

### Task 14: Polish interaction quality and accessibility

**Files:**
- Modify: `src/components/workspace/TodoCenter.tsx`
- Modify: `src/components/config/EnumConfig.tsx`
- Modify: `src/components/technical-project/TechnicalProjectCreateFields.tsx`
- Modify: `src/components/technical-project/TechnicalProjectOverview.tsx`
- Modify: `src/components/technical-project/TechnicalProjectBasicInfo.tsx`
- Modify: `src/components/technical-project/SubprojectConfigModal.tsx`
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-workbench-split.mjs`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Add interaction contracts**

Require:

- every icon-only action has an accessible label and tooltip;
- tab-adjacent config buttons do not trigger tab selection twice;
- modal cancel restores the original draft;
- confirm buttons lock against same-tick double submit;
- loading, empty, error, inactive, and no-permission states have visible copy;
- reduced-motion users do not receive long transitions;
- focus returns to each trigger after modal or popover close.

- [ ] **Step 2: Run RED**

Run:

```bash
npm run verify:workbench-split
npm run verify:technical-project
```

Expected: new accessibility/polish assertions fail.

- [ ] **Step 3: Apply visual system**

Use:

- 8px spacing rhythm;
- 8–12px radii matching the existing PMS theme;
- 32px compact controls and 40px primary form actions;
- sticky table toolbars where horizontal data is wide;
- consistent purple primary actions;
- subtle 120–180ms opacity/transform transitions;
- no layout-shifting hover effects;
- internal scrolling for long modals and floating panels.

- [ ] **Step 4: Apply keyboard and focus behavior**

Ensure Tab order follows visual order, Escape closes only the active overlay, Enter does not accidentally submit multiline fields, and focus returns to the originating control.

- [ ] **Step 5: Run verification**

Run:

```bash
npm run verify:workbench-split
npm run verify:technical-project
npm run verify:floating-panels
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/TodoCenter.tsx src/components/config/EnumConfig.tsx src/components/technical-project/TechnicalProjectCreateFields.tsx src/components/technical-project/TechnicalProjectOverview.tsx src/components/technical-project/TechnicalProjectBasicInfo.tsx src/components/technical-project/SubprojectConfigModal.tsx src/components/technical-project/TechnicalPlanModule.tsx src/containers/ProjectListContainer.tsx src/styles/globals.css scripts/verify-workbench-split.mjs scripts/verify-technical-project.mjs
git commit -m "fix: polish redesigned project workflows"
```

---

### Task 15: Add end-to-end browser verification and run the full gate

**Files:**
- Create: `screenshots/verify-workbench-technical-project-redesign.mjs`
- Modify: `package.json`
- Modify: `docs/prd/PMS-V1.0-PRD.md`

- [ ] **Step 1: Add a browser script with cleanup in `finally`**

The script must exercise:

1. header order and workbench default todo tab;
2. todo category counts and plan/transfer navigation;
3. project-list default machine category and absence of first-level `全部`;
4. machine/tOS/technical filter matrices;
5. enum add, invalid format, duplicate, edit, delete, and historical display;
6. machine new product creation and two legacy versions producing a maximum new-product current version;
7. TDT create validation, owner derivation, no-subdomain auto-fill, conditional pre-project, team, and deliverable modes;
8. IPM child tabs, required config, soft deactivation, and reactivation;
9. independent TDT and child revisions and publication;
10. technical stage and grouped list milestones;
11. technical one-way roles and tOS last-write-wins roles;
12. source-aware project-space return.

Use stable aria labels, not pixel positions or row indexes.

- [ ] **Step 2: Add the package command**

```json
{
  "verify:redesign-browser": "node screenshots/verify-workbench-technical-project-redesign.mjs"
}
```

- [ ] **Step 3: Update the active PRD**

Replace obsolete workbench, enum, technical-project, template, role, and list behavior with the approved design. Keep the PRD concise and link the detailed spec.

- [ ] **Step 4: Run all source contracts**

Run:

```bash
npm run verify:workbench-split
npm run verify:todo-center
npm run verify:enum-config
npm run verify:machine-tos
npm run verify:technical-project
npm run verify:technical-plan
npm run verify:project-list-matrix
npm run verify:project-role-sync
npm run verify:project-summary
npm run verify:column-settings
npm run verify:floating-panels
node scripts/verify-project-roadmap.mjs
```

Expected: every command exits 0.

- [ ] **Step 5: Run type and production gates**

Run:

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 6: Run browser verification against the production build**

Run:

```bash
npm run start -- --port 3004
npm run verify:redesign-browser
```

Expected: every named browser step prints `PASS`; the browser and server are stopped after verification.

- [ ] **Step 7: Manually inspect visual quality**

At widths 1440, 1280, and 1024 verify:

- no clipped toolbar controls;
- no overlapping sticky headers;
- stable table horizontal scrolling;
- readable pastel milestone groups;
- modal and floating-panel viewport avoidance;
- no layout jump when switching technical tabs;
- focus, hover, loading, empty, error, inactive, and no-permission states.

Record and fix every observed issue, then rerun the affected contract and browser steps.

- [ ] **Step 8: Commit**

```bash
git add screenshots/verify-workbench-technical-project-redesign.mjs package.json docs/prd/PMS-V1.0-PRD.md
git commit -m "test: verify redesigned project workflows"
```

---

## Final completion checklist

- [ ] All 15 task commits exist and contain only their scoped files.
- [ ] Working tree is clean.
- [ ] Every new store has a bounded persisted shape and migration.
- [ ] No new edit action bypasses RBAC.
- [ ] No project-space route bypasses source-aware return or edit guard.
- [ ] No IPM sync failure mutates existing child state.
- [ ] No enum deletion mutates historical business strings.
- [ ] No technical draft or template state leaks across TDT and child plan keys.
- [ ] All mandatory list columns survive stored-preference migration.
- [ ] Type check, production build, source contracts, browser automation, and visual inspection pass with fresh evidence.

## Specification coverage map

| Confirmed requirement | Implementation tasks |
| --- | --- |
| 工作台、项目列表拆分与来源感知返回 | Task 2 |
| 待办中心、计划／转维分类与当前用户聚合 | Task 3 |
| 固定枚举类型、字符串快照、删除历史保留 | Task 4 |
| tOS路标读取两位枚举 | Task 5 |
| 整机新品／老品版本计算、责任人映射、tOS项目名称直读 | Task 6 |
| 技术项目创建／编辑、条件字段、团队与交付物 | Task 7 |
| IPM子项目同步、配置、停用与恢复 | Task 8 |
| 技术项目空间、阶段、基础信息、团队与交付物 | Task 9 |
| TDT项目计划与子项目计划模板 | Task 10 |
| TDT及各子项目独立计划版本 | Task 11 |
| 技术项目和tOS项目权限角色同步 | Task 12 |
| 项目列表类型、筛选、必显列、里程碑分组和跳转 | Task 13 |
| UI美观、交互流畅、键盘和焦点质量 | Task 14 |
| 全功能浏览器测试、问题回修和生产门禁 | Task 15 |
