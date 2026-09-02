# Android Package Mapping and MR Row Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Android/package mapping configuration, mapped joint-plan metadata, row locking with role-aware batch controls, horizontal-plan publication dates/read-only drafts, and valid project-status mocks.

**Architecture:** Extend the typed enum registry with one single-value type and one mapping type, expose a pure package lookup, and carry resolved machine metadata into the joint MR projection. Persist row locks in the MR store and centralize permission decisions in MR rules. Extend plan-version metadata with optional publication timestamps and keep basic-info horizontal rendering explicitly read-only.

**Tech Stack:** Next.js 14, React 18, TypeScript, Zustand persist, Ant Design 6, existing Node contract scripts, Puppeteer browser acceptance.

---

## File map

- `src/types/enums.ts`: Android and package-mapping enum keys and row types.
- `src/lib/enumValues.ts`: definitions, validation, migration-safe seeds, and duplicate rules.
- `src/lib/enumConsumers.ts`: dropdown options and pure package-mode lookup.
- `src/components/config/EnumConfig.tsx`: searchable mapping selects.
- `src/types/mrVersionPlan.ts`: lock records and expanded permission/metadata types.
- `src/lib/mrPlanSourceAdapters.ts`: chip code and mapped package mode sources.
- `src/lib/mrVersionPlanRules.ts`: selectable scope and locked/unlocked edit permissions.
- `src/stores/mrVersionPlan.ts`: lock persistence and batch mutations.
- `src/components/joint/JointMrVersionPlan.tsx`: checkbox, batch toolbar, confirmation, icon, and edit gates.
- `src/lib/planVersioning.ts`, `src/lib/projectSpaceLevel1Rules.ts`: publication-date formatting and basic-info version selection.
- `src/stores/plan.ts`, `src/containers/ProjectSpaceContainer.tsx`: publication timestamp storage and horizontal rows.
- `src/components/technical-project/TechnicalPlanModule.tsx`: technical horizontal publication metadata.
- `src/data/projects.ts`, `src/containers/ProjectListContainer.tsx`: valid status mocks and current-enum-only status shortcuts.
- `scripts/verify-enum-config.mjs`, `scripts/verify-mr-version-plan.mjs`, `scripts/verify-plan-workspace-shell.mjs`, `scripts/verify-project-list-matrix.mjs`: executable contracts.
- `screenshots/verify-mr-version-plan-browser.mjs`, `screenshots/verify-project-surfaces-visual-refresh-browser.mjs`: browser acceptance.

### Task 1: Extend the enum registry

**Files:**
- Modify: `src/types/enums.ts`
- Modify: `src/lib/enumValues.ts`
- Modify: `src/stores/enums.ts`
- Test: `scripts/verify-enum-config.mjs`

- [ ] **Step 1: Write the failing enum contract**

Add assertions that require the new definitions and row shape:

```js
assert.deepEqual(enumValues.ENUM_DEFINITIONS['android-version'].columns, [
  { key: 'value', label: '安卓版本' },
])
assert.deepEqual(enumValues.ENUM_DEFINITIONS['package-mode-mapping'].columns, [
  { key: 'androidVersion', label: '安卓版本' },
  { key: 'chipModel', label: '芯片型号' },
  { key: 'packageMode', label: '组包方式' },
])
const duplicate = enumValues.validateAndNormalizeEnumRow(
  'package-mode-mapping',
  { androidVersion: 'Android 16', chipModel: 'MT6877', packageMode: '方式B' },
  [{ id: 'mapping-1', androidVersion: 'Android 16', chipModel: 'MT6877', packageMode: '方式A' }],
)
assert.equal(duplicate.ok, false)
assert.equal(duplicate.reason, 'duplicate')
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `node scripts/verify-enum-config.mjs`

Expected: FAIL because `android-version` and `package-mode-mapping` do not exist.

- [ ] **Step 3: Implement the typed enum rows and validation**

Add:

```ts
export interface PackageModeMappingRow extends BaseEnumRow {
  androidVersion: string
  chipModel: string
  packageMode: string
}
```

Register `android-version` as `single` and `package-mode-mapping` as `package-map`. For package mappings, require all three fields and treat the normalized pair `androidVersion + chipModel` as the duplicate key. Bump the enum store version and merge old persisted rows over fresh seeds so both new arrays always exist.

- [ ] **Step 4: Verify GREEN**

Run: `node scripts/verify-enum-config.mjs`

Expected: PASS for registry, seed, migration, duplicate, and storage contracts.

- [ ] **Step 5: Commit**

```bash
git add src/types/enums.ts src/lib/enumValues.ts src/stores/enums.ts scripts/verify-enum-config.mjs
git commit -m "feat: add Android and package mode enum mappings"
```

### Task 2: Add searchable mapping editors and lookup

**Files:**
- Modify: `src/lib/enumConsumers.ts`
- Modify: `src/components/config/EnumConfig.tsx`
- Test: `scripts/verify-enum-config.mjs`

- [ ] **Step 1: Write failing consumer/UI assertions**

Require a pure lookup and source-backed searchable selects:

```js
assert.equal(enumConsumers.resolvePackageMode([
  { id: '1', androidVersion: 'Android 16', chipModel: 'MT6877', packageMode: '整包' },
], ' Android 16 ', 'MT6877'), '整包')
assert.equal(enumConsumers.resolvePackageMode([], 'Android 16', 'MT6877'), '')
assert.match(enumConfigSource, /package-mode-mapping/)
assert.match(enumConfigSource, /showSearch/)
assert.match(enumConfigSource, /optionFilterProp="label"/)
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/verify-enum-config.mjs`

Expected: FAIL because lookup and mapping controls are absent.

- [ ] **Step 3: Implement options and editor controls**

Export a lookup with exact trimmed matching:

```ts
export function resolvePackageMode(
  rows: readonly PackageModeMappingRow[],
  androidVersion: unknown,
  chipModel: unknown,
): string {
  const android = nonemptyString(androidVersion)
  const chip = nonemptyString(chipModel)
  if (!android || !chip) return ''
  return rows.find(row => row.androidVersion.trim() === android && row.chipModel.trim() === chip)?.packageMode.trim() ?? ''
}
```

In the package-map editor, build Android options from `rowsByType['android-version']` and chip-model options from unique non-empty `rowsByType['chip-mapping'].map(row => row.chipModel)`. Preserve deleted historical values as disabled options while editing an existing row.

- [ ] **Step 4: Verify GREEN and type safety**

Run: `node scripts/verify-enum-config.mjs && npx tsc --noEmit`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enumConsumers.ts src/components/config/EnumConfig.tsx scripts/verify-enum-config.mjs
git commit -m "feat: edit package mode mappings from configured options"
```

### Task 3: Resolve chip code and package mode in joint metadata

**Files:**
- Modify: `src/types/mrVersionPlan.ts`
- Modify: `src/lib/mrPlanSourceAdapters.ts`
- Modify: `src/components/joint/JointMrVersionPlan.tsx`
- Test: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Write failing metadata assertions**

```js
const metadata = adapters.projectMachineMrMetadata(project, marketRows, packageRows)
assert.equal(metadata.chipCode, 'MT6877')
assert.equal(metadata.packageMode, '整包')
assert.doesNotMatch(jointSource, /SOC平台/)
assert.match(jointSource, /芯片编码/)
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/verify-mr-version-plan.mjs`

Expected: FAIL because metadata still exposes `socPlatform` and package mode `/`.

- [ ] **Step 3: Implement the mapped source**

Change metadata to:

```ts
export interface MrMachineMetadata {
  projectName: string
  marketName: string
  productLine: string
  spm: string
  spmUsers: string[]
  isMada: '是' | '否'
  chipCode: string
  packageMode: string
}
```

Pass enum package rows into `buildMrAggregationSources`. Read `chipCode`, `chipModel`, and `androidVersion` through `getProjectInfoValue`; resolve the package mode with the pure lookup. Render `/` for tOS reference rows or unresolved values.

- [ ] **Step 4: Verify GREEN**

Run: `node scripts/verify-mr-version-plan.mjs && npx tsc --noEmit`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/types/mrVersionPlan.ts src/lib/mrPlanSourceAdapters.ts src/components/joint/JointMrVersionPlan.tsx scripts/verify-mr-version-plan.mjs
git commit -m "feat: map package mode into joint MR plan"
```

### Task 4: Add persistent row locks and permission rules

**Files:**
- Modify: `src/types/mrVersionPlan.ts`
- Modify: `src/lib/mrVersionPlanRules.ts`
- Modify: `src/stores/mrVersionPlan.ts`
- Test: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Write failing lock-store and permission contracts**

Cover migration, idempotence, manager scope, admin scope, and edit matrix:

```js
assert.equal(store.getState().lockMachineRows([row], '李白', managerPermission), true)
assert.equal(store.getState().machineRowLocks[row.key].lockedBy, '李白')
assert.equal(store.getState().lockMachineRows([row], '李白', managerPermission), true)
assert.equal(resolveMachineRowEditAccess({ locked: true, isMachineSpm: true, isTosManager: false, isGlobalAdmin: false }), false)
assert.equal(resolveMachineRowEditAccess({ locked: true, isMachineSpm: false, isTosManager: true, isGlobalAdmin: false }), true)
assert.equal(resolveMachineRowEditAccess({ locked: true, isMachineSpm: false, isTosManager: false, isGlobalAdmin: true }), true)
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/verify-mr-version-plan.mjs`

Expected: FAIL because lock state and actions are absent.

- [ ] **Step 3: Implement state and centralized access**

Add:

```ts
export interface MrMachineRowLock {
  key: string
  projectId: string
  tosProjectId: string
  tosVersion: string
  lockedBy: string
  lockedAt: string
}
```

Bump `MR_VERSION_PLAN_STORE_VERSION`, sanitize lock records during migration, include them in partial persistence, and expose permission-checked `lockMachineRows`/`unlockMachineRows`. Extend joint-machine permission resolution so unlocked rows allow machine SPM, matching tOS manager, or admin; locked rows allow matching tOS manager or admin only.

- [ ] **Step 4: Verify GREEN**

Run: `node scripts/verify-mr-version-plan.mjs`

Expected: PASS for lock migration, idempotence, and every permission matrix cell.

- [ ] **Step 5: Commit**

```bash
git add src/types/mrVersionPlan.ts src/lib/mrVersionPlanRules.ts src/stores/mrVersionPlan.ts scripts/verify-mr-version-plan.mjs
git commit -m "feat: persist and authorize joint MR row locks"
```

### Task 5: Build joint-plan batch selection and confirmation UI

**Files:**
- Modify: `src/components/joint/JointMrVersionPlan.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-mr-version-plan.mjs`
- Test: `screenshots/verify-mr-version-plan-browser.mjs`

- [ ] **Step 1: Add failing source and browser contracts**

Require:

```js
assert.match(jointSource, /已勾选.*个项目/)
assert.match(jointSource, /LockOutlined/)
assert.match(jointSource, /rowSelection/)
assert.match(jointSource, /锁定所选项目/)
assert.match(jointSource, /解锁所选项目/)
```

The browser scenario must assert that the action group is absent at zero selections, appears after selection, lists every `tOS版本号 + 项目名称`, persists after reload, disables a locked row for SPM, and remains editable for the matching manager and admin.

- [ ] **Step 2: Verify RED**

Run: `node scripts/verify-mr-version-plan.mjs`

Expected: FAIL because selection and controls are absent.

- [ ] **Step 3: Implement minimal batch UI**

Use Ant Design `Table.rowSelection` only for managers/admins. Disable tOS reference rows and out-of-scope manager rows. Prune selected keys against `filteredRows` when filters change. Render the right-aligned batch group only when `selectedRowKeys.length > 0`. Use `modal.confirm` with an unordered list of accessible labels; clear selection only after successful confirmation. Render `LockOutlined` with tooltip and `aria-label="已锁定"` in the project-name cell.

- [ ] **Step 4: Verify GREEN in source and browser**

Run:

```bash
node scripts/verify-mr-version-plan.mjs
PMS_UPDATE_SCREENSHOTS=1 node screenshots/verify-mr-version-plan-browser.mjs
```

Expected: source contract passes; all MR browser steps pass and tracked evidence is refreshed atomically.

- [ ] **Step 5: Commit**

```bash
git add src/components/joint/JointMrVersionPlan.tsx src/styles/globals.css scripts/verify-mr-version-plan.mjs screenshots/verify-mr-version-plan-browser.mjs screenshots/mr-version-plan
git commit -m "feat: batch lock joint MR project rows"
```

### Task 6: Add publication dates and basic-info draft row

**Files:**
- Modify: `src/lib/planVersioning.ts`
- Modify: `src/lib/projectSpaceLevel1Rules.ts`
- Modify: `src/stores/plan.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Test: `scripts/verify-plan-workspace-shell.mjs`
- Test: `screenshots/verify-project-surfaces-visual-refresh-browser.mjs`

- [ ] **Step 1: Write failing version-display contracts**

```js
assert.deepEqual(selectLevel1HorizontalVersions(versions, { surface: 'basic-info' }).map(v => v.status), ['已发布', '修订中'])
assert.equal(formatPlanPublishedDate({ status: '已发布', publishedAt: '2026-09-02T08:00:00+08:00' }), '2026-09-02')
assert.equal(formatPlanPublishedDate({ status: '已发布' }), '-')
assert.equal(formatPlanPublishedDate({ status: '修订中' }), '修订中')
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/verify-plan-workspace-shell.mjs`

Expected: FAIL because basic-info excludes drafts and plan versions have no publication display helper.

- [ ] **Step 3: Implement timestamp storage and two-line rendering**

Extend `PlanVersionLike` with `publishedAt?: string`. Add deterministic dates to initial V1–V3 mocks. Every project-space publish path must replace the draft with:

```ts
{ ...version, status: '已发布', publishedAt: new Date().toISOString() }
```

Format published timestamps in Shanghai as `YYYY-MM-DD`; render `修订中` for drafts and `-` for legacy published versions without a timestamp. For `surface: 'basic-info'`, select latest published plus the single draft; render the draft immediately after latest published and force all date cells to text. Keep the actual row last. Apply the same two-line version label to technical horizontal plans.

- [ ] **Step 4: Verify GREEN and browser read-only behavior**

Run:

```bash
node scripts/verify-plan-workspace-shell.mjs
PMS_BASE_URL=http://127.0.0.1:3004 node screenshots/verify-project-surfaces-visual-refresh-browser.mjs
```

Expected: contract passes; browser sees publication dates, the read-only basic-info draft, and unchanged plan-view editing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planVersioning.ts src/lib/projectSpaceLevel1Rules.ts src/stores/plan.ts src/containers/ProjectSpaceContainer.tsx src/components/technical-project/TechnicalPlanModule.tsx scripts/verify-plan-workspace-shell.mjs screenshots/verify-project-surfaces-visual-refresh-browser.mjs
git commit -m "feat: show plan publication dates and basic info drafts"
```

### Task 7: Remove retired project statuses and refresh mocks

**Files:**
- Modify: `src/data/projects.ts`
- Modify: `src/containers/ProjectListContainer.tsx`
- Test: `scripts/verify-project-list-matrix.mjs`

- [ ] **Step 1: Write failing status-set contracts**

```js
const allowed = {
  '整机产品项目': new Set(['待立项', '在研', '上市', 'EOS', '转维', '已取消', '已暂停']),
  'tOS版本项目': new Set(['在研', '已完成']),
  '能力建设项目': new Set(['在研', '已完成']),
  '技术项目': new Set(['进行中', '已完成', '暂停', '已取消']),
}
for (const project of projectData.initialProjects) assert.ok(allowed[project.type].has(project.status), `${project.name}: ${project.status}`)
assert.doesNotMatch(projectListSource, /statusOptions[\s\S]*PROJECT_STATUS_CONFIG/)
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/verify-project-list-matrix.mjs`

Expected: FAIL on retired mock statuses.

- [ ] **Step 3: Refresh mock statuses and keep filters enum-driven**

Apply the approved normalization: machine `暂停 → 已暂停`, pagination `规划中 → 待立项`; tOS/capability active work → `在研`, completed work → `已完成`; technical active work → `进行中`, completed/migrated work → `已完成`. Keep status shortcuts exclusively sourced from the current type-specific enum options.

- [ ] **Step 4: Verify GREEN**

Run: `node scripts/verify-project-list-matrix.mjs && node scripts/verify-workbench-project-list.mjs`

Expected: both exit 0 and no retired status shortcut is generated.

- [ ] **Step 5: Commit**

```bash
git add src/data/projects.ts src/containers/ProjectListContainer.tsx scripts/verify-project-list-matrix.mjs
git commit -m "fix: remove retired project statuses from mocks"
```

### Task 8: Full verification and release

**Files:**
- Modify only if a verification reveals a requirement defect.

- [ ] **Step 1: Run complete static verification**

```bash
node scripts/verify-enum-config.mjs
node scripts/verify-mr-version-plan.mjs
node scripts/verify-mr-mock-and-info-grid.mjs
node scripts/verify-plan-workspace-shell.mjs
node scripts/verify-project-list-matrix.mjs
node scripts/verify-workbench-project-list.mjs
npx tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Run browser acceptance sequentially**

Start the local server and run:

```bash
npm run dev -- --port 3004
PMS_UPDATE_SCREENSHOTS=1 node screenshots/verify-mr-version-plan-browser.mjs
PMS_BASE_URL=http://127.0.0.1:3004 node screenshots/verify-project-surfaces-visual-refresh-browser.mjs
node screenshots/verify-project-list-header-reorder-browser.mjs
```

Expected: MR suite, project-surface suite, and project-list suite all report PASS with zero browser/page/request errors.

- [ ] **Step 3: Commit refreshed evidence if changed**

```bash
git add screenshots/mr-version-plan
git commit -m "test: refresh mapped and locked MR evidence"
```

- [ ] **Step 4: Confirm the feature worktree is clean**

Run: `git status --short`

Expected: no output.

- [ ] **Step 5: Publish development and main branches**

```bash
git fetch origin
git push origin HEAD:dev
```

Create a clean temporary worktree from `origin/master`, merge `origin/dev` with a merge commit, and push that exact result to `master`. Do not modify the user's main checkout.

- [ ] **Step 6: Confirm Vercel production deployment**

Use the linked project in `.vercel/project.json`. If direct CLI authorization is unavailable, confirm the GitHub deployment attached to the new master SHA reaches `success`. Verify both the immutable deployment URL and `https://pms-2026.vercel.app` return 200 with matching content fingerprints.

- [ ] **Step 7: Run one online interaction smoke test**

Run the project-list browser verifier against the immutable production URL and manually inspect the joint-plan lock/mapping surface. Expected: new production page loads, mapped/locked MR behavior is present, and the tested interaction exits 0.
