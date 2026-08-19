# Plan Structure And Horizontal Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock template activity structure, preserve the two approved project exceptions, align horizontal headers, and make technical basic-information plan dates editable.

**Architecture:** Extend the existing source-aware level-one task rules instead of adding UI-only checks. Keep structure decisions in pure helpers, let the regular and technical plan components consume those helpers, and route technical basic-information date changes through the existing technical-plan Zustand action so both pages share one version state.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, dnd-kit, source-contract verification scripts, Playwright browser verification.

---

### Task 1: Add source-aware structure and numbering contracts

**Files:**
- Modify: `src/lib/level1PlanRules.ts`
- Modify: `src/lib/technicalPlanWorkspace.ts`
- Modify: `scripts/verify-level1-plan-governance.mjs`
- Modify: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: Write failing contracts for template locks and custom numbering**

Add executable assertions that template tasks cannot be renamed, deleted, or reordered; whole-machine launch custom children can; TDT tasks cannot; and technical subproject custom roots are renumbered continuously:

```js
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: templateLaunchChild, action: 'delete' }), false)
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: customLaunchChild, action: 'delete', parent: launchStage }), true)
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'tdt', task: customRoot, action: 'rename' }), false)
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'subproject', task: customRoot, action: 'rename' }), true)
assert.deepEqual(technicalWorkspace.renumberTechnicalSubprojectTasks([...templateRoots, customRoot]).map(task => task.id), ['1', '2', '3', '4', '5'])
```

- [ ] **Step 2: Run the focused scripts and confirm RED**

Run: `npm run verify:level1-plan-governance && npm run verify:technical-plan`

Expected: FAIL because the new governance and renumbering exports do not exist.

- [ ] **Step 3: Implement minimal pure helpers**

Add a source-aware decision function and subproject renumbering that preserves `stableId`:

```ts
export const canMutateLevel1TaskStructure = (input: StructureMutationInput): boolean => {
  if (input.task.source !== 'custom') return false
  if (input.technicalKind === 'subproject') return !input.task.parentId
  if (input.technicalKind === 'tdt') return false
  return input.projectType === '整机产品项目'
    && Boolean(input.task.parentId)
    && (input.parent?.stableId === 'stage-launch' || input.parent?.taskName === '上市收编阶段')
}

export const renumberTechnicalSubprojectTasks = (tasks: readonly TechnicalTemplateTask[]) => (
  [...tasks].sort((a, b) => a.order - b.order).map((task, index) => ({
    ...task,
    id: String(index + 1),
    order: index,
  }))
)
```

- [ ] **Step 4: Re-run the focused scripts and confirm GREEN**

Run: `npm run verify:level1-plan-governance && npm run verify:technical-plan`

Expected: both scripts print their PASS summaries and exit 0.

- [ ] **Step 5: Commit the pure rules**

```bash
git add src/lib/level1PlanRules.ts src/lib/technicalPlanWorkspace.ts scripts/verify-level1-plan-governance.mjs scripts/verify-technical-plan.mjs
git commit -m "feat: enforce source-aware plan structure rules"
```

### Task 2: Lock regular templates and update horizontal stage headers

**Files:**
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-level1-plan-governance.mjs`

- [ ] **Step 1: Add failing UI contracts**

Assert that the governed table no longer grants global administrators a blanket structure bypass, exposes name input and drag only for approved custom tasks, has no global “添加一级活动” footer, and renders stage duration rather than range/percentage:

```js
assert.doesNotMatch(containerSource, /isGlobalLevel1Admin\s*\|\|/)
assert.doesNotMatch(containerSource, /level1GlobalAdmins\.includes\(currentLoginUser\)[\s\S]{0,300}添加一级活动/)
assert.match(containerSource, /record\.source === 'custom'[\s\S]{0,300}<Input/)
assert.match(containerSource, /stage\.estimatedDays == null \? '-' : `\$\{stage\.estimatedDays\}天`/)
assert.doesNotMatch(horizontalHeaderSlice, /manpowerPercent|planStartDate.*planEndDate/)
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:level1-plan-governance`

Expected: FAIL on the old administrator override and stage header markup.

- [ ] **Step 3: Apply governance in the table**

Use the pure mutation rule for add, rename, delete, and drag. Only create `source: 'custom'` children under `stage-launch`; render template names as text and custom launch-child names as inputs. Reorder only custom siblings and retain template sibling order.

- [ ] **Step 4: Replace horizontal stage metadata**

Render the header as:

```tsx
<div className="pms-level1-stage-heading">
  <span>{stage.taskName}</span>
  <Tag color="blue">{stage.estimatedDays == null ? '-' : `${stage.estimatedDays}天`}</Tag>
</div>
```

Keep the development cycle bound to `sumLevel1EstimatedDays` and apply the same renderer in basic information and the plan page through the existing shared `renderHorizontalTable` function.

- [ ] **Step 5: Re-run and commit**

Run: `npm run verify:level1-plan-governance`

Expected: PASS.

```bash
git add src/containers/ProjectSpaceContainer.tsx scripts/verify-level1-plan-governance.mjs
git commit -m "feat: lock template tasks and show stage duration"
```

### Task 3: Correct technical subproject activity editing and numbering

**Files:**
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: Add failing component contracts**

Require structure maintenance for authorized subproject drafts only, custom-task name inputs, custom-only delete and drag controls, and displayed numeric IDs:

```js
assert.match(technicalModuleSource, /tab\?\.templateKind === 'subproject'[\s\S]{0,160}canMaintain/)
assert.match(technicalModuleSource, /row\.source === 'custom'[\s\S]{0,240}<Input/)
assert.match(technicalModuleSource, /renumberTechnicalSubprojectTasks/)
assert.doesNotMatch(technicalModuleSource, /<span>\{value\}<\/span>/)
assert.doesNotMatch(containerSource, /canManageStructure=\{level1GlobalAdmins\.includes/)
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:technical-plan`

Expected: FAIL because structure editing is globally gated and custom names are text-only.

- [ ] **Step 3: Implement the approved subproject exception**

Compute structure permission from `canMaintain && tab.templateKind === 'subproject'`. Keep TDT structural controls absent. Generate unique `stableId`, insert the root, then normalize visible IDs with `renumberTechnicalSubprojectTasks`. Render an `<Input>` only when `row.source === 'custom'`; use the same predicate for drag and delete.

- [ ] **Step 4: Reorder safely**

On drag, reject template rows and cross-parent operations. Reorder only custom roots, preserve template roots in their current relative order, then renumber every root to `1..N` while retaining stable IDs for version pairing.

- [ ] **Step 5: Re-run and commit**

Run: `npm run verify:technical-plan`

Expected: PASS.

```bash
git add src/components/technical-project/TechnicalPlanModule.tsx src/containers/ProjectSpaceContainer.tsx scripts/verify-technical-plan.mjs
git commit -m "fix: edit and renumber technical subproject activities"
```

### Task 4: Enable technical basic-information horizontal date editing

**Files:**
- Modify: `src/components/technical-project/TechnicalPlanSummary.tsx`
- Modify: `src/components/technical-project/TechnicalProjectInformationView.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `scripts/verify-technical-plan.mjs`

- [ ] **Step 1: Add failing data-flow and UI contracts**

Require the summary to receive plan-maintenance permission, include visible draft versions, call `updateCurrentTasks`, use `ClickToEditDate` for the draft plan row and actual row, and omit the horizontal read-only tag:

```js
assert.match(summarySource, /canEditPlan/)
assert.match(summarySource, /updateCurrentTasks/)
assert.equal((summarySource.match(/<ClickToEditDate/g) || []).length >= 2, true)
assert.match(informationSource, /<TechnicalPlanSummary[\s\S]{0,180}canEditPlan=/)
assert.doesNotMatch(technicalModuleSource, /横版只读/)
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm run verify:technical-plan`

Expected: FAIL because `TechnicalPlanSummary` currently renders only published, read-only cells.

- [ ] **Step 3: Wire shared store updates**

Pass `canEditPlan={canGovernLevel1Plan}` from the project container through `TechnicalProjectInformationView`. In `TechnicalPlanSummary`, select published versions plus the draft when permitted, resolve the active draft/current published version, and update its tasks through:

```ts
updateCurrentTasks(scope, currentTasks.map(task => (
  task.id === taskId ? { ...task, [field]: value } : task
)), scope.kind === 'subproject' ? 1 : 2)
```

Use the existing store behavior to synchronize actual completion changes between the draft and latest published version.

- [ ] **Step 4: Align technical horizontal headers**

Remove the date range and manpower percentage from `TechnicalHorizontalPlanTable`; render `stage.estimatedDays` as `N天`. Remove only the `横版只读` tag while retaining the Gantt read-only notice.

- [ ] **Step 5: Re-run and commit**

Run: `npm run verify:technical-plan && node node_modules/typescript/bin/tsc --noEmit`

Expected: both commands exit 0.

```bash
git add src/components/technical-project/TechnicalPlanSummary.tsx src/components/technical-project/TechnicalProjectInformationView.tsx src/components/technical-project/TechnicalPlanModule.tsx src/containers/ProjectSpaceContainer.tsx scripts/verify-technical-plan.mjs
git commit -m "feat: edit technical plan dates from basic information"
```

### Task 5: Full verification and release

**Files:**
- Verify all modified files

- [ ] **Step 1: Run focused and compile gates**

```bash
npm run verify:level1-plan-governance
npm run verify:technical-plan
npm run verify:level3-plan
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git diff --check
```

Expected: every command exits 0; production build completes all static pages.

- [ ] **Step 2: Exercise browser flows**

Verify with a clean browser profile:

1. Whole-machine basic information and plan horizontal headers show stage name plus `N天`, with no stage dates or percentages.
2. A whole-machine draft permits a custom launch child to be added, renamed, reordered, and deleted while template rows expose none of those actions.
3. A technical TDT draft has no structure actions.
4. A technical subproject draft adds activities as numeric `5`, `6`, permits custom names and custom-only reorder/delete.
5. Technical basic-information horizontal draft and actual dates edit successfully and immediately match the plan page.
6. No application console errors are produced.

- [ ] **Step 3: Commit any verification-only adjustments**

```bash
git add scripts src docs
git commit -m "test: cover plan structure and horizontal editing"
```

- [ ] **Step 4: Publish through the requested branches**

Push the verified tree to `dev`, merge the identical tree into `master`, push `master`, wait for the `pms-2026` Vercel deployment to reach `Ready`, and repeat the browser smoke test against `https://pms-transsion.vercel.app/`.
