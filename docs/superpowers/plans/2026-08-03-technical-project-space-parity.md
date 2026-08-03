# Technical Project Space Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild technical-project basic information and plan pages on the same reusable framework and interaction contract as whole-machine projects while preserving TDT/subproject-specific data and rules.

**Architecture:** Extract small presentation shells from the mature whole-machine information and plan renderers, then feed them with project-type adapters. Keep the existing technical project, subproject, and technical-plan stores as the source of truth; add only the missing plan operations and selectors required for parity. Implement in two vertical slices—basic information first, full plan workspace second—with contract and browser checks at each boundary.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Ant Design 6, Zustand 4, dnd-kit, DHTMLX Gantt wrapper, existing source-contract scripts and Puppeteer browser verification.

---

## File map

### New focused components and helpers

- `src/components/project-info/ProjectInformationFrame.tsx` — shared page width, core card, anchor navigation and slots used by whole-machine and technical information pages.
- `src/components/project-info/CollapsibleInformationSection.tsx` — shared collapsed section header/body behavior for basic, team and deliverable modules.
- `src/components/technical-project/TechnicalProjectInformationView.tsx` — technical adapter that binds core fields, TDT/subproject tabs, plan summaries and common team/deliverable modules to the shared frame.
- `src/components/technical-project/TechnicalPlanSummary.tsx` — read-only version and milestone summary for one technical plan scope.
- `src/components/plans/PlanWorkspaceShell.tsx` — shared scope strip, version/actions toolbar, utility toolbar and content-card layout used by whole-machine and technical full-plan pages.
- `src/components/plans/PlanViewModeSwitcher.tsx` — shared vertical/horizontal/Gantt switcher.
- `src/components/plans/PlanVersionCompareModal.tsx` — shared full-field version comparison shell.
- `src/lib/planWorkspace.ts` — shared plan view modes, filter predicates, hierarchy visibility and horizontal milestone row builders.

### Existing files to modify

- `src/components/project-info/TargetProjectInformationView.tsx` — consume `ProjectInformationFrame` without changing whole-machine behavior.
- `src/components/technical-project/TechnicalProjectBasicInfo.tsx` — retire child-only page implementation; keep only compatibility export or delegate to the new information view.
- `src/components/technical-project/TechnicalProjectOverview.tsx` — remove duplicated ownership of core/team/deliverables or reduce to non-owning overview content.
- `src/components/technical-project/TechnicalPlanModule.tsx` — consume the shared plan shell and add whole-machine parity features.
- `src/stores/technicalPlan.ts` — add safe plan clone and selectors needed by the shared workspace.
- `src/containers/ProjectSpaceContainer.tsx` — wire technical information and plan adapters into the shared project-space routes.
- `src/app/share/plan/page.tsx` — accept technical plan scope parameters and render published technical plans read-only.
- `src/styles/globals.css` — only shared frame and technical extension styles not expressible with existing classes.

### Tests and verification to modify

- `scripts/verify-technical-project.mjs` — replace the incorrect child-only contract with the approved layout and Tab rules.
- `scripts/verify-technical-plan.mjs` — add parity operations and scope-isolation contracts.
- `scripts/verify-project-view-requirements.mjs` — assert shared basic-information and plan-workspace mounting.
- `screenshots/verify-workbench-technical-project-redesign.mjs` — add visual/interaction scenarios comparing whole-machine and technical pages.

---

### Task 1: Lock the corrected information and plan parity contracts

**Files:**
- Modify: `scripts/verify-technical-project.mjs`
- Modify: `scripts/verify-technical-plan.mjs`
- Modify: `scripts/verify-project-view-requirements.mjs`

- [ ] **Step 1: Replace the incorrect child-only basic-information assertions**

Update the source contract to require the new technical information adapter and Tab-controlled modules:

```js
const information = readSource(root, 'src/components/technical-project/TechnicalProjectInformationView.tsx')
assert.match(information, /ProjectInformationFrame/, 'technical information uses the shared project frame')
assert.match(information, /TechnicalPlanSummary/, 'the active tab owns its plan summary')
assert.match(information, /activeTab\.kind === ['"]subproject['"]/, 'only subproject tabs expose basic information')
assert.match(information, /CollapsibleInformationSection[\s\S]*团队信息/, 'team information is a shared collapsed project section')
assert.match(information, /CollapsibleInformationSection[\s\S]*交付物信息/, 'deliverables are a shared collapsed project section')
assert.doesNotMatch(information, /activeTab\.kind === ['"]tdt['"][\s\S]{0,160}基础信息/, 'TDT does not render a basic-information module')
```

- [ ] **Step 2: Add an explicit plan capability matrix contract**

Require technical and whole-machine plan sources to consume the same shell and controls:

```js
const shell = readSource(root, 'src/components/plans/PlanWorkspaceShell.tsx')
const technicalPlan = readSource(root, 'src/components/technical-project/TechnicalPlanModule.tsx')
const projectSpace = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
for (const capability of ['创建修订', '计划克隆', '筛选', '列设置', '全部展开', '全部收起', '版本对比', '分享计划']) {
  assert.match(shell + technicalPlan, new RegExp(capability), `technical plan exposes ${capability}`)
}
assert.match(technicalPlan, /PlanWorkspaceShell/, 'technical plan consumes the common shell')
assert.match(projectSpace, /PlanWorkspaceShell/, 'whole-machine plan consumes the common shell')
assert.match(technicalPlan, /vertical[\s\S]*horizontal[\s\S]*gantt/, 'technical plan exposes all three views')
```

- [ ] **Step 3: Run the contracts and confirm they fail for the current implementation**

Run:

```bash
node scripts/verify-technical-project.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-project-view-requirements.mjs
```

Expected: FAIL because `TechnicalProjectInformationView`, `ProjectInformationFrame` and `PlanWorkspaceShell` do not exist and the old child-only assertion has been removed.

- [ ] **Step 4: Commit the red contracts**

```bash
git add scripts/verify-technical-project.mjs scripts/verify-technical-plan.mjs scripts/verify-project-view-requirements.mjs
git commit -m "test: define technical project space parity"
```

---

### Task 2: Extract the shared project-information frame without changing whole-machine behavior

**Files:**
- Create: `src/components/project-info/ProjectInformationFrame.tsx`
- Create: `src/components/project-info/CollapsibleInformationSection.tsx`
- Modify: `src/components/project-info/TargetProjectInformationView.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-info-followup-adjustments.mjs`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Add a focused shared-frame contract**

Add assertions that the whole-machine wrapper delegates to the shared frame and preserves its named regions:

```js
const targetView = readSource(root, 'src/components/project-info/TargetProjectInformationView.tsx')
const frame = readSource(root, 'src/components/project-info/ProjectInformationFrame.tsx')
assert.match(targetView, /ProjectInformationFrame/, 'whole-machine project information uses the shared frame')
for (const region of ['项目核心字段', '计划信息', '项目信息']) {
  assert.match(frame + targetView, new RegExp(region), `shared project frame preserves ${region}`)
}
```

- [ ] **Step 2: Run the focused contract and confirm it fails**

Run: `node scripts/verify-project-info-followup-adjustments.mjs`  
Expected: FAIL because `ProjectInformationFrame` is not present.

- [ ] **Step 3: Implement the shared information frame**

Create the frame with explicit slots rather than project-type conditionals:

```tsx
export interface ProjectInformationFrameProps {
  projectName: string
  coreFields: readonly { label: string; value: ReactNode; accent: string; fullWidth?: boolean }[]
  actions?: ReactNode
  planInformation?: ReactNode
  informationSections?: ReactNode
  anchorItems: readonly { id: string; label: string; icon: ReactNode }[]
}

export default function ProjectInformationFrame({
  projectName, coreFields, actions, planInformation, informationSections, anchorItems,
}: ProjectInformationFrameProps) {
  return (
    <div className="pms-project-information-frame">
      <ProjectInformationAnchorNav items={anchorItems} scrollContainerId="basic-info-scroll-container" />
      <ProjectCoreFieldsCard projectName={projectName} fields={coreFields} actions={actions} />
      {planInformation}
      {informationSections}
    </div>
  )
}
```

Define `ProjectInformationAnchorNav` and `ProjectCoreFieldsCard` as private components in `ProjectInformationFrame.tsx`; they are not separate files or exported APIs.

Implement `CollapsibleInformationSection` with `defaultActive={false}`, a stable heading, optional count/config action and a common empty state. Use the existing `pms-project-info-collapse` classes so whole-machine visuals do not regress.

- [ ] **Step 4: Convert `TargetProjectInformationView` into a thin whole-machine adapter**

Keep its current core field calculation and `ProjectInfoSections`, but pass them into `ProjectInformationFrame`. Do not change field order, market plan summary or transfer action.

- [ ] **Step 5: Run whole-machine source and browser smoke contracts**

Run:

```bash
node scripts/verify-project-info-followup-adjustments.mjs
node scripts/verify-project-view-requirements.mjs
```

Expected: PASS with the existing whole-machine field and layout assertions unchanged.

- [ ] **Step 6: Commit the shared information frame**

```bash
git add src/components/project-info/ProjectInformationFrame.tsx src/components/project-info/CollapsibleInformationSection.tsx src/components/project-info/TargetProjectInformationView.tsx src/styles/globals.css scripts/verify-project-info-followup-adjustments.mjs
git commit -m "refactor: share project information frame"
```

---

### Task 3: Build the approved technical-project basic-information page

**Files:**
- Create: `src/components/technical-project/TechnicalProjectInformationView.tsx`
- Create: `src/components/technical-project/TechnicalPlanSummary.tsx`
- Modify: `src/lib/technicalProjectRules.ts`
- Modify: `src/components/technical-project/TechnicalProjectBasicInfo.tsx`
- Modify: `src/components/technical-project/TechnicalProjectOverview.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Add pure Tab-selection and module-visibility assertions**

Extend the test to verify these exact states:

```js
assert.deepEqual(rules.resolveTechnicalInformationModules({ kind: 'tdt' }), {
  plan: true, basic: false, readOnly: false,
})
assert.deepEqual(rules.resolveTechnicalInformationModules({ kind: 'subproject', active: true }), {
  plan: true, basic: true, readOnly: false,
})
assert.deepEqual(rules.resolveTechnicalInformationModules({ kind: 'subproject', active: false }), {
  plan: true, basic: true, readOnly: true,
})
```

- [ ] **Step 2: Run the technical contract and confirm it fails**

Run: `node scripts/verify-technical-project.mjs`  
Expected: FAIL because `resolveTechnicalInformationModules` and the new view do not exist.

- [ ] **Step 3: Add the pure module selector**

In `src/lib/technicalProjectRules.ts` add:

```ts
export type TechnicalInformationTab =
  | { kind: 'tdt' }
  | { kind: 'subproject'; active: boolean }

export const resolveTechnicalInformationModules = (tab: TechnicalInformationTab) => ({
  plan: true,
  basic: tab.kind === 'subproject',
  readOnly: tab.kind === 'subproject' && !tab.active,
})
```

- [ ] **Step 4: Implement `TechnicalPlanSummary`**

Accept one `TechnicalPlanScope`, select its current/published version from `useTechnicalPlanStore`, and render a read-only summary using the same grouped phase/milestone table styles as whole-machine plan information. It must render `暂无计划版本` without creating a draft and must never expose edit controls.

```tsx
export interface TechnicalPlanSummaryProps {
  scope: TechnicalPlanScope
  readOnly?: boolean
}
```

- [ ] **Step 5: Implement `TechnicalProjectInformationView`**

Bind the approved page structure to `ProjectInformationFrame`:

```tsx
const modules = resolveTechnicalInformationModules(activeTab.kind === 'tdt'
  ? { kind: 'tdt' }
  : { kind: 'subproject', active: activeTab.subproject.active })

const planInformation = (
  <TechnicalInformationTabs ...>
    <TechnicalPlanSummary scope={activeTab.scope} readOnly={modules.readOnly} />
    {modules.basic && (
      <CollapsibleInformationSection title="基础信息" defaultActive={false}>
        <TechnicalSubprojectFields subproject={activeTab.subproject} readOnly={modules.readOnly} />
      </CollapsibleInformationSection>
    )}
  </TechnicalInformationTabs>
)
```

Build the nine core fields in the confirmed order; mark project value `fullWidth: true`. Add team and deliverable common sections after the Tab card, both collapsed by default. Keep the subproject config button inside the matching Tab label and preserve focus restoration.

Implement `TechnicalInformationTabs` and `TechnicalSubprojectFields` as private rendering helpers inside `TechnicalProjectInformationView.tsx`; keep the exported surface limited to the page adapter.

- [ ] **Step 6: Correct project-space routing and remove duplicate ownership**

For `projectSpaceModule === 'basic'`, mount `TechnicalProjectInformationView`. Stop mounting `TechnicalProjectOverview` as the owner of core/team/deliverables under `overview`; align that route with the same non-owning overview behavior used by whole-machine projects.

- [ ] **Step 7: Run technical information contracts**

Run:

```bash
node scripts/verify-technical-project.mjs
node scripts/verify-project-view-requirements.mjs
npx tsc --noEmit
```

Expected: PASS; no TypeScript errors.

- [ ] **Step 8: Commit the technical information page**

```bash
git add src/lib/technicalProjectRules.ts src/components/technical-project/TechnicalProjectInformationView.tsx src/components/technical-project/TechnicalPlanSummary.tsx src/components/technical-project/TechnicalProjectBasicInfo.tsx src/components/technical-project/TechnicalProjectOverview.tsx src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-technical-project.mjs scripts/verify-project-view-requirements.mjs
git commit -m "feat: align technical project information page"
```

---

### Task 4: Extract the common plan-workspace presentation shell

**Files:**
- Create: `src/components/plans/PlanWorkspaceShell.tsx`
- Create: `src/components/plans/PlanViewModeSwitcher.tsx`
- Create: `src/components/plans/PlanVersionCompareModal.tsx`
- Create: `src/lib/planWorkspace.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-view-requirements.mjs`
- Test: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: Add pure shared-workspace helper tests**

Test view-mode normalization and hierarchy collapse independently:

```js
assert.equal(workspace.normalizePlanViewMode('horizontal', true), 'vertical')
assert.equal(workspace.normalizePlanViewMode('horizontal', false), 'horizontal')
assert.deepEqual(
  workspace.filterPlanTasksByCollapsed([
    { id: 'p', taskName: 'P' },
    { id: 'c', parentId: 'p', taskName: 'C' },
  ], new Set(['p'])).map(item => item.id),
  ['p'],
)
```

- [ ] **Step 2: Run the helper contract and confirm it fails**

Run: `node scripts/verify-technical-plan.mjs`  
Expected: FAIL because `src/lib/planWorkspace.ts` is missing.

- [ ] **Step 3: Implement `planWorkspace.ts`**

Export:

```ts
export type PlanWorkspaceViewMode = 'vertical' | 'horizontal' | 'gantt'
export const normalizePlanViewMode = (mode: PlanWorkspaceViewMode, horizontalDisabled: boolean) =>
  horizontalDisabled && mode === 'horizontal' ? 'vertical' : mode
export const filterPlanTasksByCollapsed = <T extends { id: string; parentId?: string }>(tasks: readonly T[], collapsed: ReadonlySet<string>) =>
  tasks.filter(task => !task.parentId || !collapsed.has(task.parentId))
```

Also add shared filter-condition application and phase/milestone horizontal row builders using the current whole-machine behavior as the contract.

- [ ] **Step 4: Implement the shared shell components**

`PlanWorkspaceShell` owns only layout, not plan data:

```tsx
export interface PlanWorkspaceShellProps {
  scopeTabs: ReactNode
  notices?: ReactNode
  versionControls: ReactNode
  primaryActions: ReactNode
  utilityActions: ReactNode
  viewMode: PlanWorkspaceViewMode
  onViewModeChange: (mode: PlanWorkspaceViewMode) => void
  horizontalDisabled?: boolean
  children: ReactNode
}
```

Place controls in the exact whole-machine order and expose stable ARIA regions: `计划作用域`, `计划版本操作`, `计划工具`, `计划内容`.

`PlanVersionCompareModal` receives already-computed `CompareTableRow[]` and renders the complete whole-machine change summary and field columns, not the current two-column technical simplification.

- [ ] **Step 5: Convert whole-machine `renderProjectPlan` to the shell**

Move only its presentation wrappers into `PlanWorkspaceShell`; keep market/tOS type state, version mutations and task renderers in `ProjectSpaceContainer`. Ensure its existing controls, order and data remain unchanged.

- [ ] **Step 6: Run whole-machine regression contracts**

Run:

```bash
node scripts/verify-project-view-requirements.mjs
node scripts/verify-tos-type-integration.mjs
npx tsc --noEmit
```

Expected: PASS with no feature loss in whole-machine or tOS plan pages.

- [ ] **Step 7: Commit the shared plan shell**

```bash
git add src/components/plans/PlanWorkspaceShell.tsx src/components/plans/PlanViewModeSwitcher.tsx src/components/plans/PlanVersionCompareModal.tsx src/lib/planWorkspace.ts src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-project-view-requirements.mjs scripts/verify-technical-plan.mjs
git commit -m "refactor: share project plan workspace"
```

---

### Task 5: Add missing technical-plan operations without breaking scope isolation

**Files:**
- Modify: `src/stores/technicalPlan.ts`
- Modify: `src/lib/technicalPlanRules.ts`
- Modify: `src/app/share/plan/page.tsx`
- Test: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: Add failing clone and scope-isolation tests**

```js
const store = technicalPlan.createTechnicalPlanStore({ plansByKey: seededPlans })
const cloned = store.clonePublishedVersion({ kind: 'tdt', parentProjectId: 'p' }, 'v1')
assert.equal(cloned.ok, true)
assert.equal(store.getState().plansByKey['p:tdt'].versions.at(-1).status, '修订中')
assert.deepEqual(store.getState().plansByKey['p:subproject:c1'], seededPlans['p:subproject:c1'])
assert.equal(store.clonePublishedVersion({ kind: 'subproject', parentProjectId: 'p', subprojectId: 'c2' }, 'missing').ok, false)
```

- [ ] **Step 2: Run the store test and confirm it fails**

Run: `node scripts/verify-technical-plan.mjs`  
Expected: FAIL because `clonePublishedVersion` is not defined.

- [ ] **Step 3: Implement scoped cloning**

Add this result shape and action:

```ts
export type CloneTechnicalVersionResult =
  | { ok: true; versionId: string }
  | { ok: false; reason: 'missing-instance' | 'missing-source' | 'draft-exists' | 'inactive' | 'incomplete-configuration' }

clonePublishedVersion: (
  scope: TechnicalPlanScope,
  sourceVersionId: string,
  subproject?: TechnicalSubproject,
) => CloneTechnicalVersionResult
```

Clone tasks by value into the same scope only, create the next `Vn` draft, and leave every other TDT/subproject instance untouched.

- [ ] **Step 4: Add technical share scope parsing**

Extend the share route with query parameters `technical=1`, `kind=tdt|subproject`, and optional `subprojectId`. Resolve the matching published technical version and render it through the existing read-only share layout. Missing or draft-only scopes show a non-sensitive empty state.

- [ ] **Step 5: Run plan-store and share contracts**

Run:

```bash
node scripts/verify-technical-plan.mjs
npx tsc --noEmit
```

Expected: PASS and no scope leakage.

- [ ] **Step 6: Commit technical plan operations**

```bash
git add src/stores/technicalPlan.ts src/lib/technicalPlanRules.ts src/app/share/plan/page.tsx scripts/verify-technical-plan.mjs
git commit -m "feat: complete technical plan operations"
```

---

### Task 6: Rebuild `TechnicalPlanModule` on the common workspace

**Files:**
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-technical-plan.mjs`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Add failing UI capability assertions**

Require the technical module to provide the common shell slots and all three views:

```js
for (const sourceToken of [
  'PlanWorkspaceShell', 'FloatingFilterPanel', 'SortableColumnSettings',
  'PlanVersionCompareModal', 'clonePublishedVersion', '全部展开', '全部收起',
  "'vertical'", "'horizontal'", "'gantt'", '分享计划',
]) assert.match(technicalPlan, new RegExp(sourceToken), `technical plan includes ${sourceToken}`)
```

- [ ] **Step 2: Run the technical-plan contract and confirm it fails**

Run: `node scripts/verify-technical-plan.mjs`  
Expected: FAIL on the missing shell and parity controls.

- [ ] **Step 3: Move the technical scope strip into the shared shell**

Keep `buildTechnicalPlanTabs` as the source of Tab order. Render TDT first, subproject config buttons beside their Tabs, and the inactive switch on the same row as the whole-machine market/type strip.

- [ ] **Step 4: Implement common version and action controls**

Feed version selection, create revision, clone, publish and cancel actions into `PlanWorkspaceShell`. Reuse the current permission and read-only reasons, and keep disabled controls visible with precise Tooltip text.

- [ ] **Step 5: Add filters, expand/collapse and complete view switching**

Use `FloatingFilterPanel` with the task fields from `TECHNICAL_COLUMN_DEFINITIONS`. Apply filters after selecting the current version and before rendering any view. Expand/collapse writes to the current technical scope only.

Map views as follows:

```tsx
const content = viewMode === 'gantt'
  ? <DHTMLXGantt ... />
  : viewMode === 'horizontal'
    ? <TechnicalHorizontalPlanTable tasks={filteredTasks} versions={instance.versions} />
    : <TechnicalVerticalPlanTable tasks={visibleTasks} ... />
```

Implement `TechnicalHorizontalPlanTable` as a private component in `TechnicalPlanModule.tsx`, using the shared phase/milestone row builder from `planWorkspace.ts`.

- [ ] **Step 6: Replace simplified version comparison with the common modal**

Call `compareVersionsForTable` with both selected technical versions and pass all returned field diffs into `PlanVersionCompareModal`. Preserve add/modify/delete/unchanged filtering and change counts.

- [ ] **Step 7: Align import, export and sharing**

Keep import available only for a maintainable draft. Export current view or all columns using the shared dropdown semantics. Generate a technical share link containing the exact current scope.

- [ ] **Step 8: Run technical plan tests and type-check**

Run:

```bash
node scripts/verify-technical-plan.mjs
node scripts/verify-technical-project.mjs
npx tsc --noEmit
```

Expected: PASS; technical and whole-machine sources both consume the common shell.

- [ ] **Step 9: Commit the technical plan workspace**

```bash
git add src/components/technical-project/TechnicalPlanModule.tsx src/styles/globals.css scripts/verify-technical-plan.mjs scripts/verify-technical-project.mjs
git commit -m "feat: align technical plan workspace"
```

---

### Task 7: Add browser parity scenarios and correct old expectations

**Files:**
- Modify: `screenshots/verify-workbench-technical-project-redesign.mjs`
- Modify: `scripts/verify-technical-project.mjs`
- Modify: `scripts/verify-project-view-requirements.mjs`

- [ ] **Step 1: Add a basic-information browser scenario**

Exercise the real project `AI-Engine-V2`:

```js
await openTechnicalProject(page, 'AI-Engine-V2')
await clickExact(page, '[role="menuitem"]', '基础信息')
await assertText(page, '项目价值', '[aria-label="技术项目基础信息"]')
await assertText(page, 'TDT', '[aria-label="技术信息分类"]')
await assertNoText(page, '核心价值', '[aria-label="技术信息分类内容"]')
await clickExact(page, '[aria-label="技术信息分类"] button', 'AI推理引擎子项目')
await assertText(page, '核心价值', '[aria-label="技术信息分类内容"]')
await assertCollapsed(page, '基础信息')
await assertCollapsed(page, '团队信息')
await assertCollapsed(page, '交付物信息')
```

- [ ] **Step 2: Add a plan parity browser scenario**

Open whole-machine and technical plan pages sequentially and collect named controls:

```js
const requiredControls = ['创建修订', '计划克隆', '筛选', '列设置', '全部展开', '全部收起', '版本对比', '分享计划']
for (const control of requiredControls) {
  await page.waitForSelector(`[aria-label="${control}"]`)
}
for (const mode of ['竖版', '横版', '甘特图']) await assertText(page, mode, '[aria-label="计划视图"]')
```

Also verify TDT allows a second-level task, subproject does not, and the same scope remains selected after changing views.

- [ ] **Step 3: Run the new scenarios and confirm they fail before final selector/styling work**

Run:

```bash
PMS_SCENARIO_ONLY=12 node screenshots/verify-workbench-technical-project-redesign.mjs
PMS_SCENARIO_ONLY=13 node screenshots/verify-workbench-technical-project-redesign.mjs
```

Expected initially: FAIL on any remaining layout, ARIA or interaction mismatch.

- [ ] **Step 4: Fix only issues evidenced by the browser scenarios**

Adjust stable ARIA labels, spacing, overflow containers, popover anchoring and focus restoration. Do not introduce new project-space behavior outside the approved design.

- [ ] **Step 5: Run all technical browser scenarios**

Run: `node screenshots/verify-workbench-technical-project-redesign.mjs`  
Expected: all technical information and plan scenarios PASS; unrelated pre-existing failures must be reported separately with their exact scenario and cause.

- [ ] **Step 6: Commit browser parity coverage**

```bash
git add screenshots/verify-workbench-technical-project-redesign.mjs scripts/verify-technical-project.mjs scripts/verify-project-view-requirements.mjs src/styles/globals.css
git commit -m "test: verify technical project space parity"
```

---

### Task 8: Final verification and local acceptance

**Files:**
- Verify all changed files

- [ ] **Step 1: Run focused technical contracts**

```bash
node scripts/verify-technical-project.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-project-view-requirements.mjs
node scripts/verify-project-role-sync.mjs
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run adjacent whole-machine and tOS regressions**

```bash
node scripts/verify-project-info-followup-adjustments.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-project-summary.mjs
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run static and production gates**

```bash
npx tsc --noEmit
git diff --check
npm run build
```

Expected: no TypeScript errors, no whitespace errors, and Next.js build exits `0`.

- [ ] **Step 4: Run browser regression and inspect server output**

Start the app with `npm run dev`, run `node screenshots/verify-workbench-technical-project-redesign.mjs`, then inspect stdout/stderr. Expected: approved scenarios pass and no new runtime errors appear.

- [ ] **Step 5: Perform side-by-side visual acceptance**

At 1920×1080 compare whole-machine and technical basic-information pages, then their plan pages. Confirm common width, card hierarchy, toolbar order, vertical rhythm, sticky/fixed behavior, horizontal scrolling, floating panels and transition feedback.

- [ ] **Step 6: Commit final verified adjustments**

```bash
git add src scripts screenshots
git commit -m "fix: complete technical project space parity"
```

Only create this commit when final verification required a real adjustment; otherwise leave the previously verified commits unchanged.
