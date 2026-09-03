# Unified Plan, Roadmap, Status, and Project Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify tOS MR mock data across project and joint spaces, replace tOS roadmap platform with chip code, align TDT plan interactions with the machine level-one plan, remove retired project statuses, and restore schema-driven project form groups.

**Architecture:** Keep existing domain stores and introduce narrow pure selectors/migrations instead of copying page data. Project UI components consume shared schemas and store data through adapters; existing RBAC, validation, and edit guards remain authoritative.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Ant Design 6, Zustand 4, Node source-contract verification scripts, Puppeteer browser verification.

---

## File Structure

- `src/lib/projectStatus.ts`: authoritative active-status catalogs and legacy status normalization.
- `src/data/projects.ts`: seed project statuses updated to active values only.
- `src/containers/ProjectListContainer.tsx`: filter options limited to active enum rows, without historical disabled values.
- `scripts/verify-project-list-matrix.mjs`: status catalog, seed, and filter source contracts.
- `src/components/project-info/ProjectInfoModal.tsx`: shared grouped rendering for create/edit.
- `src/components/technical-project/TechnicalProjectCreateFields.tsx`: technical field contents projected into the shared three groups.
- `src/lib/projectInfoRules.ts`: modal group projection including tOS basic/team groups.
- `scripts/verify-project-field-order-followup.mjs`: group order, shared rendering, and JIRA placement contracts.
- `src/types/roadmap.ts`: roadmap field renamed from `platform` to `chipCode`.
- `src/lib/roadmapProjectAdapter.ts`, `src/lib/roadmapAudit.ts`, `src/lib/roadmapValidation.ts`, `src/lib/roadmapFilters.ts`: chip-code projection, audit, validation, and filtering.
- `src/stores/roadmap.ts`: planned-project seeds and persisted-state migration.
- `src/components/roadmap/PlannedProjectModal.tsx`, `RoadmapTableView.tsx`, `RoadmapProjectDetailsModal.tsx`, `RoadmapProjectCard.tsx`, `RoadmapEvolutionView.tsx`, `utils.ts`: chip-code input and display surfaces.
- `scripts/verify-project-roadmap.mjs`: chip enum, compatibility migration, and no-platform UI contracts.
- `src/data/mrVersionPlanMocks.ts`: canonical MR mock scenarios shared by project and joint spaces.
- `src/stores/mrVersionPlan.ts`: store version bump and seed-preserving migration.
- `src/lib/mrPlanSourceAdapters.ts`: shared selector used to compare tOS project-space and joint-space references.
- `scripts/verify-mr-version-plan.mjs`: cross-surface mock parity and scenario coverage.
- `src/stores/technicalPlan.ts`: latest-template revision synchronization keyed by task name and store migration.
- `src/components/technical-project/TechnicalPlanModule.tsx`: machine-parity toolbar and version interaction; clone and field-config controls removed.
- `src/lib/technicalPlanWorkspace.ts`: shared horizontal projection behavior for new template nodes.
- `scripts/verify-technical-plan.mjs`, `scripts/verify-technical-plan-operations.mjs`: TDT revision and UI contracts.
- `screenshots/verify-unified-plan-roadmap-browser.mjs`: browser acceptance for all five requested surfaces.
- `package.json`: verification command for the new browser suite.

### Task 1: Active Project Status Catalog and Mock Migration

**Files:**
- Modify: `src/lib/projectStatus.ts`
- Modify: `src/data/projects.ts`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `scripts/verify-project-list-matrix.mjs`

- [ ] **Step 1: Add failing status-catalog assertions**

Append source-contract assertions:

```js
const projectStatus = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/projectStatus.ts')
assert.deepEqual(projectStatus.getActiveProjectStatuses('整机产品项目'), ['待立项', '在研', '上市', 'EOS', '转维', '已取消', '已暂停'])
assert.deepEqual(projectStatus.getActiveProjectStatuses('tOS版本项目'), ['在研', '已完成'])
assert.deepEqual(projectStatus.getActiveProjectStatuses('技术项目'), ['进行中', '已完成', '暂停', '已取消'])
assert.equal(projectStatus.normalizeLegacyProjectStatus('整机产品项目', '暂停'), '已暂停')
assert.equal(projectStatus.normalizeLegacyProjectStatus('整机产品项目', '规划中'), '待立项')
assert.equal(projectStatus.normalizeLegacyProjectStatus('技术项目', '已迁移'), '已完成')
assert.equal(projectStatus.normalizeLegacyProjectStatus('技术项目', '在研'), '进行中')
const projectSeedSource = readSource(projectRoot(import.meta.url), 'src/data/projects.ts')
for (const retired of ['暂停（已停用）', '规划中（已停用）', '已迁移（已停用）']) {
  assert.doesNotMatch(projectSeedSource, new RegExp(retired))
}
const listSource = readSource(projectRoot(import.meta.url), 'src/containers/ProjectListContainer.tsx')
assert.match(listSource, /useSingleEnumOptions\(\s*statusEnumType,\s*\[\]/)
```

- [ ] **Step 2: Run the assertion and confirm failure**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: FAIL because `getActiveProjectStatuses` and `normalizeLegacyProjectStatus` do not exist and filters still pass status history.

- [ ] **Step 3: Implement the active catalog and migration**

Add the following pure API to `src/lib/projectStatus.ts`:

```ts
export const ACTIVE_PROJECT_STATUSES = {
  machine: ['待立项', '在研', '上市', 'EOS', '转维', '已取消', '已暂停'],
  tos: ['在研', '已完成'],
  technical: ['进行中', '已完成', '暂停', '已取消'],
} as const

export function getActiveProjectStatuses(projectType: string): readonly string[] {
  if (projectType === '整机产品项目') return ACTIVE_PROJECT_STATUSES.machine
  if (projectType === '技术项目') return ACTIVE_PROJECT_STATUSES.technical
  return ACTIVE_PROJECT_STATUSES.tos
}

export function normalizeLegacyProjectStatus(projectType: string, status: string): string {
  const value = status.trim()
  if (projectType === '整机产品项目') {
    if (value === '暂停') return '已暂停'
    if (value === '规划中' || value === '筹备中') return '待立项'
  }
  if (projectType === '技术项目') {
    if (value === '在研' || value === '筹备中') return '进行中'
    if (value === '已迁移' || value === 'EOS') return '已完成'
  }
  if (projectType === 'tOS版本项目' || projectType === '能力建设项目') {
    if (value === '已完成' || value === '已迁移' || value === 'EOS') return '已完成'
    return '在研'
  }
  return value
}
```

Update all seed rows in `src/data/projects.ts` with normalized active values. In project-list filtering, pass `[]` rather than `statusHistory` to `useSingleEnumOptions`, so historical disabled values cannot be appended to filters.

- [ ] **Step 4: Run the status verification**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: PASS and all project-list assertions remain green.

- [ ] **Step 5: Commit the status slice**

```bash
git add src/lib/projectStatus.ts src/data/projects.ts src/containers/ProjectListContainer.tsx scripts/verify-project-list-matrix.mjs
git commit -m "fix: remove retired project statuses from mocks and filters"
```

### Task 2: Shared Project Form Groups

**Files:**
- Modify: `src/lib/projectInfoRules.ts`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/technical-project/TechnicalProjectCreateFields.tsx`
- Modify: `scripts/verify-project-field-order-followup.mjs`

- [ ] **Step 1: Add failing group assertions**

Add these contracts:

```js
const projectInfoModalSource = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
assert.deepEqual(schema.getProjectInfoGroups('整机产品项目').map(group => group.label), ['基础信息', '扩展信息', '团队信息'])
assert.deepEqual(schema.getProjectInfoGroups('tOS版本项目').map(group => group.label), ['基础信息', '团队信息'])
assert.deepEqual(schema.getProjectInfoGroups('技术项目').map(group => group.label), ['技术信息', '团队人员', '交付物'])
assert.match(projectInfoModalSource, /groups\.map\(group =>/)
assert.doesNotMatch(projectInfoModalSource, /machineCreateFields\.length > 0[\s\S]*pms-project-create-fields/)
assert.match(projectInfoModalSource, /data-project-info-group=\{group\.key\}/)
assert.match(projectInfoModalSource, /field\.inputType === 'jira'.*pms-project-info-form-span/s)
```

- [ ] **Step 2: Run and confirm the ungrouped machine branch fails**

Run: `node scripts/verify-project-field-order-followup.mjs`

Expected: FAIL on the dedicated machine create branch and missing shared group marker.

- [ ] **Step 3: Unify modal group selection**

Change `getProjectInfoModalGroups` to return visible groups for every supported project type, including technical and tOS. Preserve the existing field Schema and filter only fields that truly do not belong in the modal.

```ts
export const getProjectInfoModalGroups = (type: string) => {
  const visible = new Set(getProjectInfoModalFields(type).map(field => field.group))
  return getProjectInfoGroups(type).filter(group => visible.has(group.key))
}
```

For tOS, keep the basic group projection so aggregate/read-only fields can display in their original field mode.

- [ ] **Step 4: Replace the machine-only flat grid with shared Collapse items**

Build group items from the ordered `fields`/`createFields`. Each item must carry `data-project-info-group`, count only currently visible fields, and render JIRA with the existing full-row class.

```tsx
const groupedFields = groups.map(group => ({
  ...group,
  fields: modalFields.filter(field => field.group === group.key && isFieldVisible(field, watchedValues)),
}))

<Collapse
  activeKey={activeGroups}
  items={groupedFields.map(group => ({
    key: group.key,
    label: <ProjectInfoGroupLabel group={group} count={group.fields.length} />,
    children: <div data-project-info-group={group.key} className="pms-project-info-form-grid">{group.fields.map(renderProjectInfoField)}</div>,
  }))}
/>
```

Keep common source/name/category/responsible-person/health fields above the groups. Default to the first non-empty group; draft restoration and validation expansion keep using `activeGroups`.

- [ ] **Step 5: Project technical fields into the same group shell**

Refactor `TechnicalProjectCreateFields` to expose group contents keyed by `basic`, `team`, and `extended`, preserving TMG/subdomain linkage and deliverable editors. The parent Collapse uses labels `技术信息`, `团队人员`, and `交付物`.

- [ ] **Step 6: Verify and commit**

Run: `node scripts/verify-project-field-order-followup.mjs && npx tsc --noEmit`

Expected: PASS with create/edit group order and existing field-order assertions unchanged.

```bash
git add src/lib/projectInfoRules.ts src/components/project-info/ProjectInfoModal.tsx src/components/technical-project/TechnicalProjectCreateFields.tsx scripts/verify-project-field-order-followup.mjs
git commit -m "fix: restore schema driven project form groups"
```

### Task 3: Replace tOS Roadmap Platform with Chip Code

**Files:**
- Modify: `src/types/roadmap.ts`
- Modify: `src/lib/roadmapProjectAdapter.ts`
- Modify: `src/lib/roadmapAudit.ts`
- Modify: `src/lib/roadmapValidation.ts`
- Modify: `src/lib/roadmapFilters.ts`
- Modify: `src/stores/roadmap.ts`
- Modify: `src/components/roadmap/PlannedProjectModal.tsx`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`
- Modify: `src/components/roadmap/RoadmapProjectDetailsModal.tsx`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Modify: `src/components/roadmap/utils.ts`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add failing chip-code assertions**

```js
const roadmapTypes = readSource(root, 'src/types/roadmap.ts')
const plannedModal = readSource(root, 'src/components/roadmap/PlannedProjectModal.tsx')
const detailsModal = readSource(root, 'src/components/roadmap/RoadmapProjectDetailsModal.tsx')
assert.match(roadmapTypes, /chipCode:\s*string/)
assert.doesNotMatch(roadmapTypes, /\n\s*platform:\s*string/)
assert.match(plannedModal, /label="芯片编码"[\s\S]*showSearch/)
assert.match(plannedModal, /useChipOptions|buildChipOptions/)
assert.doesNotMatch(plannedModal, /label="平台"/)
assert.doesNotMatch(detailsModal, /芯片平台|平台/)
assert.match(detailsModal, /芯片编码/)
```

- [ ] **Step 2: Run and confirm failure**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL because the domain type and modal still use `platform`.

- [ ] **Step 3: Rename the domain field and implement compatibility migration**

Rename `RoadmapProjectFields.platform` to `chipCode`. Update adapter precedence to use project `chipCode` first, then use legacy `platform` only in migration:

```ts
chipCode: firstNonBlank(project.chipCode, project.projectCode, project.platform)
```

Increment the roadmap Store version. During migration:

```ts
const chipCode = trimStringValue(candidate.chipCode || candidate.platform)
```

Do not retain `platform` in the normalized stored object.

- [ ] **Step 4: Use enum-backed chip-code selection**

In `PlannedProjectModal`, read chip rows from `useEnumStore`, build searchable options with `buildChipOptions`, and resolve the selected row ID back to its `chipCode` before submitting.

```tsx
<Form.Item
  label="芯片编码"
  name="chipCode"
  rules={[{ required: true, message: '请选择芯片编码' }]}
  getValueProps={chipCode => ({
    value: chipOptions.find(option => resolveChipRow(rowsByType, option.value)?.chipCode === chipCode)?.value,
  })}
  getValueFromEvent={rowId => resolveChipRow(rowsByType, rowId)?.chipCode || ''}
>
  <Select showSearch optionFilterProp="label" options={chipOptions} />
</Form.Item>
```

When no active chip option exists, show `暂无可用芯片编码，请先在配置中心维护` and prevent save.

- [ ] **Step 5: Update all display and audit surfaces**

Change table key/width, details label, filter/export definition and audit label to `芯片编码`. Keep historical values displayable only for editing existing rows.

- [ ] **Step 6: Verify and commit**

Run: `node scripts/verify-project-roadmap.mjs && npx tsc --noEmit`

Expected: PASS with no UI input labeled 平台 in the tOS roadmap flow.

```bash
git add src/types/roadmap.ts src/lib/roadmapProjectAdapter.ts src/lib/roadmapAudit.ts src/lib/roadmapValidation.ts src/lib/roadmapFilters.ts src/stores/roadmap.ts src/components/roadmap scripts/verify-project-roadmap.mjs
git commit -m "feat: use chip code throughout the tos roadmap"
```

### Task 4: Canonical MR Mock Data Across tOS and Joint Spaces

**Files:**
- Modify: `src/data/mrVersionPlanMocks.ts`
- Modify: `src/stores/mrVersionPlan.ts`
- Modify: `src/lib/mrPlanSourceAdapters.ts`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing parity and scenario assertions**

```js
const seed = templateMocks.createInitialMrVersionPlanState()
const instances = Object.values(seed.tosInstancesByProjectId).flat()
assert.ok(instances.length >= 4, 'need multiple tOS project/version rows')
assert.ok(Object.keys(seed.machinePlansByKey).length >= 8, 'need rich joint machine rows')
assert.ok(Object.keys(seed.machineRowLocks).length >= 2, 'need locked examples')
assert.ok(templateMocks.MR_MOCK_SCENARIOS.normal.length > 0)
assert.ok(templateMocks.MR_MOCK_SCENARIOS.invalid.length > 0)
assert.ok(templateMocks.MR_MOCK_SCENARIOS.locked.length > 0)
for (const instance of instances) {
  const jointReference = adapter.selectJointTosReference(seed, instance.projectId, instance.tosVersion)
  assert.deepEqual(jointReference.activities, instance.activities)
  assert.deepEqual(jointReference.dates, instance.dates)
}
```

- [ ] **Step 2: Run and confirm the current seed is incomplete**

Run: `node scripts/verify-mr-version-plan.mjs`

Expected: FAIL because the scenario catalog/parity selector does not yet cover the required examples.

- [ ] **Step 3: Expand the canonical seed**

Add stable scenario IDs and seed data for normal, invalid, locked, `N/A`, and numeric 1+N rows. Every joint reference row must point to an existing `TosMrVersionInstance`; do not duplicate tOS reference dates in joint mock builders.

- [ ] **Step 4: Add a narrow shared selector and migration merge**

```ts
export function selectJointTosReference(
  state: { tosInstancesByProjectId: Readonly<Record<string, readonly TosMrVersionInstance[]>> },
  projectId: string,
  tosVersion: string,
): TosMrVersionInstance | undefined {
  return state.tosInstancesByProjectId[projectId]?.find(row => compareTosVersionNumbers(row.tosVersion, tosVersion) === 0)
}
```

Increment `MR_VERSION_PLAN_STORE_VERSION`. Migration must preserve valid user rows and add missing seed project/version rows by stable key.

- [ ] **Step 5: Verify and commit**

Run: `node scripts/verify-mr-version-plan.mjs && npx tsc --noEmit`

Expected: PASS, including existing permission, date, lock, and aggregation assertions.

```bash
git add src/data/mrVersionPlanMocks.ts src/stores/mrVersionPlan.ts src/lib/mrPlanSourceAdapters.ts scripts/verify-mr-version-plan.mjs
git commit -m "fix: share canonical mr mock data across project spaces"
```

### Task 5: Align TDT Plan Interaction with Machine Level-One Plan

**Files:**
- Modify: `src/stores/technicalPlan.ts`
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: `src/lib/technicalPlanWorkspace.ts`
- Modify: `scripts/verify-technical-plan.mjs`
- Modify: `scripts/verify-technical-plan-operations.mjs`

- [ ] **Step 1: Replace stale clone assertions with parity assertions**

```js
const moduleSource = readSource(root, 'src/components/technical-project/TechnicalPlanModule.tsx')
assert.doesNotMatch(moduleSource, /计划克隆|handleClonePlan|CopyOutlined/)
assert.doesNotMatch(moduleSource, /aria-label="字段配置"/)
assert.match(moduleSource, /PlanWorkspaceViewMode\('horizontal'\)/)
assert.match(moduleSource, /自动保存/)
assert.match(moduleSource, /aria-label="发布"/)
assert.match(moduleSource, /aria-label="取消修订"/)
```

Add a store test using a published version with task `节点A`, a latest template containing `节点A` plus `新增节点`, and a custom `MR1`. Assert that `createRevision` returns the latest template structure, copies dates for `节点A` by task name, preserves `MR1` while its stage remains, and leaves the new node dates empty.

- [ ] **Step 2: Run and confirm failure**

Run: `node scripts/verify-technical-plan.mjs && node scripts/verify-technical-plan-operations.mjs`

Expected: FAIL on clone/field-config UI and task-name-only synchronization.

- [ ] **Step 3: Centralize revision synchronization by task name**

Add a pure helper in `src/lib/technicalPlanWorkspace.ts`:

```ts
export function buildTechnicalRevisionTasks(
  latestTemplate: readonly TechnicalTemplateTask[],
  previousPublished: readonly TechnicalTemplateTask[],
): TechnicalTemplateTask[]
```

The helper must:

- use latest template order and stage structure;
- match prior user dates by normalized `taskName` only;
- preserve prior custom tasks if their parent stage name still exists;
- omit custom tasks whose stage no longer exists;
- initialize new template task date fields as empty.

Use this helper for every TDT/subproject revision instead of later-version cloning from old task structure.

- [ ] **Step 4: Remove clone and field configuration controls**

Delete `handleClonePlan`, `CopyOutlined`, and the disabled field-configuration button. Keep the create-revision, add-transfer-version (subprojects), publish, cancel, filter, export, compare, share and view controls.

- [ ] **Step 5: Confirm initial draft edit and gantt columns**

Ensure `currentVersion` resolves the persisted draft on first render and `canMaintain` is true immediately when permission permits. Keep the view switch order horizontal/vertical/gantt. Remove predecessor from TDT gantt grid configuration, while keeping dependency calculations internal if used.

- [ ] **Step 6: Verify and commit**

Run: `node scripts/verify-technical-plan.mjs && node scripts/verify-technical-plan-operations.mjs && npx tsc --noEmit`

Expected: PASS with TDT draft immediately editable and no clone/field-config source contract.

```bash
git add src/stores/technicalPlan.ts src/components/technical-project/TechnicalPlanModule.tsx src/lib/technicalPlanWorkspace.ts scripts/verify-technical-plan.mjs scripts/verify-technical-plan-operations.mjs
git commit -m "fix: align tdt plan interaction with level one plans"
```

### Task 6: Full Verification and Browser Acceptance

**Files:**
- Create: `screenshots/verify-unified-plan-roadmap-browser.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add browser acceptance script**

The script must launch the local app, clear only the relevant mock keys (`pms-mr-version-plan-store`, `pms-roadmap-store`, `pms-technical-plans`), and verify:

```js
await assertProjectStatusFilters(page)
await assertProjectFormGroups(page, ['整机产品项目', 'tOS版本项目', '技术项目'])
await assertTosRoadmapChipCode(page)
await assertTosAndJointMrParity(page)
await assertTdtDraftIsImmediatelyEditable(page)
```

Capture one full-screen screenshot for each surface into `output/playwright/unified-plan-roadmap/` and fail on browser console errors.

- [ ] **Step 2: Add the package command**

```json
"verify:unified-plan-roadmap-browser": "node screenshots/verify-unified-plan-roadmap-browser.mjs"
```

- [ ] **Step 3: Run all affected source-contract suites**

Run:

```bash
node scripts/verify-project-list-matrix.mjs
node scripts/verify-project-field-order-followup.mjs
node scripts/verify-project-roadmap.mjs
node scripts/verify-mr-version-plan.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-technical-plan-operations.mjs
```

Expected: all scripts print their PASS summaries and exit 0.

- [ ] **Step 4: Run full static verification**

Run: `npx tsc --noEmit && npm run build`

Expected: type check and Next.js production build exit 0.

- [ ] **Step 5: Run browser verification**

Start: `npm run dev -- --hostname 127.0.0.1 --port 3004`

Run: `npm run verify:unified-plan-roadmap-browser`

Expected: PASS with five screenshots and no page/console errors.

- [ ] **Step 6: Commit verification assets**

```bash
git add screenshots/verify-unified-plan-roadmap-browser.mjs package.json
git commit -m "test: cover unified plan roadmap and project forms"
```

### Task 7: Review, Integrate, and Release

**Files:**
- Review: all files changed since `origin/dev`

- [ ] **Step 1: Review the complete diff**

Run: `git diff --check && git diff --stat origin/dev...HEAD && git status --short`

Expected: no whitespace errors and no unrelated files.

- [ ] **Step 2: Re-run the release gate**

Run: `npx tsc --noEmit && npm run build && npm run verify:unified-plan-roadmap-browser`

Expected: all exit 0 from the final commit.

- [ ] **Step 3: Push the feature commits to dev**

Fetch the current remote state, merge or rebase only after confirming the integration worktree is clean, then push the verified result to `origin/dev`. Confirm `git rev-parse origin/dev` equals the pushed commit.

- [ ] **Step 4: Merge dev into master and push**

Use a separate clean release worktree based on current `origin/master`. Merge the verified `origin/dev` without touching the user's dirty checkout, run the static release gate again, then push to `origin/master`.

- [ ] **Step 5: Verify Vercel production**

Confirm the Vercel deployment belongs to the new master commit, open the production URL, and repeat the five browser smoke checks. Record the final dev commit, master commit, deployment URL and verification time.
