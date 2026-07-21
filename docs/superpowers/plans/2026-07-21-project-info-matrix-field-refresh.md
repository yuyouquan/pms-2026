# Project Info Matrix and Field Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the confirmed project-information layout, team multi-person editing, market matrix editor, configurable plan fields, four-column project Modal, and Feishu field-rule refresh, then publish dev→master and update the PRD.

**Architecture:** Keep `projectInfoSchema.ts` as the project-form field source of truth, add overall-required metadata, and normalize team roles at the value boundary so old single-person mocks remain readable. Reuse the existing local preference repository for plan visibility through a separate preference-scope type, keep market data row-based while rendering it as a transposed matrix, and centralize balanced row partitioning in a pure helper shared by information and plan grids.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, CSS, Node verification scripts, lark-cli.

---

### Task 1: Add a focused failing verification gate

**Files:**
- Create: `scripts/verify-project-info-matrix-refresh.mjs`
- Read: `docs/superpowers/specs/2026-07-21-project-info-market-matrix-field-refresh-design.md`

- [ ] **Step 1: Write the verification script**

Create a Node script that reads the relevant source files and asserts these exact contracts:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const schema = read('src/constants/projectInfoSchema.ts')
const view = read('src/components/project-info/TargetProjectInformationView.tsx')
const sections = read('src/components/project-info/ProjectInfoSections.tsx')
const modal = read('src/components/project-info/ProjectInfoModal.tsx')
const market = read('src/components/project-info/MarketEditorModal.tsx')
const plan = read('src/components/project-info/ProjectPlanInfoGrid.tsx')
const styles = read('src/styles/globals.css')

assert.match(schema, /required:\s*boolean/)
assert.match(schema, /'tOS15\.0\.1'[\s\S]*'tOS17\.2'/)
assert.match(schema, /\['S', 'A', 'B', 'C', 'D'\]/)
assert.match(schema, /'不维护'[\s\S]*'升3维5'/)
assert.doesNotMatch(view, /statusConfig\.tagColor/)
assert.doesNotMatch(view, /healthConfig\.tagColor/)
assert.match(sections, /getBalancedRows/)
assert.match(sections, /pms-project-info-team-role/)
assert.match(modal, /mode === 'create' \? field\.requiredOnCreate : field\.required/)
assert.match(styles, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
assert.match(market, /pms-market-matrix/)
assert.match(market, /dataIndex:\s*row\.id/)
assert.match(plan, /visibleFieldKeys/)
assert.match(plan, /getBalancedRows\(metrics, 5, 2\)/)

console.log('Project info matrix refresh verification passed.')
```

- [ ] **Step 2: Run it and confirm the pre-change failure**

Run: `node scripts/verify-project-info-matrix-refresh.mjs`

Expected: FAIL on the first missing `required: boolean` or later new marker.

### Task 2: Refresh the field schema and required semantics

**Files:**
- Modify: `src/constants/projectInfoSchema.ts`
- Modify: `src/lib/projectInfoRules.ts`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Test: `scripts/verify-project-info-matrix-refresh.mjs`

- [ ] **Step 1: Add overall required metadata**

Add the property and increment the schema version so existing user preferences reconcile new defaults:

```ts
export interface ProjectInfoFieldDefinition {
  key: string
  label: string
  group: ProjectInfoGroupKey
  inputType: ProjectInfoInputType
  required: boolean
  requiredOnCreate: boolean
  defaultVisible: boolean
  hideable: boolean
  // existing optional properties remain unchanged
}

export const PROJECT_INFO_SCHEMA_VERSION = 2
```

Set `required: true` for machine fields `developmentMode`, `firstSaleTosVersion`, `isFirstLaunchProject`, `softwareProjectLevel`, `versionType`, `dimensionUpgradeStrategy`, `systemType`, `kernelVersion`, `productSeries`, `chipModel`, `chipPlatform`, `wholeMachinePd`, `pcbaSheet`, `shippingCountrySheet`, `keyComponentsSheet`, `isTwoStage`, `isOutsourcedMini`, and `machineSpm`. Set it to false for all automatic/optional machine fields and the remaining six machine team roles.

Set `required: true` for all seven tOS basic fields and all nineteen tOS team fields. Preserve `requiredOnCreate: true` only for `firstLaunchProjects` plus the five derived launch fields, the first seven default tOS team roles, and false for the twelve additional tOS roles exactly as specified. Read-only derived values remain hidden from the form and are validated only after derivation.

- [ ] **Step 2: Refresh exact options and labels**

Use these exact option arrays:

```ts
const FIRST_SALE_TOS_VERSIONS = [
  'tOS15.0.1', 'tOS15.1.0', 'tOS16.0', 'tOS16.1', 'tOS16.2',
  'tOS16.3', 'tOS17.0', 'tOS17.1', 'tOS17.2',
] as const
const SOFTWARE_PROJECT_LEVELS = ['S', 'A', 'B', 'C', 'D'] as const
const DIMENSION_UPGRADE_STRATEGIES = [
  '不维护', 'EWP维护', '维1', '维2', 'EWP维护+tOS升级',
  '维1+tOS升级', '维2+tOS升级', '升1维2', '升2维3', '升3维5',
] as const
```

Rename `firstLaunchProjectChips` label to `首发项目芯片编码`. Keep the array order identical to the design spec tables.

- [ ] **Step 3: Separate create and edit validation**

In `ProjectInfoModal`, apply form rules with:

```tsx
const isRequired = mode === 'create' ? field.requiredOnCreate : field.required
rules={isRequired ? [{ required: true, message: `请填写${field.label}` }] : undefined}
```

Update `validateProjectInfoValues` to select `requiredOnCreate` only when `validateRequiredOnCreate` is true and otherwise select `required`. Continue filtering validation to editable fields so automatic fields never produce an impossible form error.

- [ ] **Step 4: Run the focused script**

Run: `node scripts/verify-project-info-matrix-refresh.mjs`

Expected: still FAIL on later layout markers, while all schema assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/constants/projectInfoSchema.ts src/lib/projectInfoRules.ts src/components/project-info/ProjectInfoModal.tsx scripts/verify-project-info-matrix-refresh.mjs
git commit -m "feat: refresh project information field rules"
```

### Task 3: Support team roles with multiple people

**Files:**
- Modify: `src/constants/projectInfoSchema.ts`
- Modify: `src/types/app.ts`
- Modify: `src/lib/projectInfoValues.ts`
- Modify: `src/components/project-info/ProjectInfoSections.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-info-matrix-refresh.mjs`

- [ ] **Step 1: Switch every team field to people multi-select**

Change all machine and tOS team definitions from `inputType: 'person'` to `inputType: 'people'`. No new control is needed because `ProjectInfoFieldInput` already maps `people` to Ant Design `Select mode="multiple"`.

- [ ] **Step 2: Normalize legacy and new team values**

Use a shared value type and normalizer:

```ts
export type ProjectTeamRoleValue = string | string[]
export type ProjectTeamRoleMap = Record<string, ProjectTeamRoleValue>

export const normalizeTeamMembers = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  return typeof value === 'string' && value.trim() ? [value] : []
}
```

Update `buildMachineTeamRoles`, `buildTosTeamRoles`, and `getProjectInfoValue` so arrays are preserved and legacy strings become one-member arrays without mutating the stored project.

- [ ] **Step 3: Render role and people separately**

For `group.key === 'team'`, render each role as:

```tsx
<article className="pms-project-info-team-role">
  <div className="pms-project-info-team-role-name">{field.label}</div>
  <div className="pms-project-info-team-members">
    {members.length ? members.map(name => (
      <span key={name} className="pms-project-info-team-member">
        <Avatar size={28}>{name.slice(0, 1)}</Avatar><span>{name}</span>
      </span>
    )) : <span className="pms-project-info-empty">未配置</span>}
  </div>
</article>
```

Add responsive two-column role rows on desktop and one column on narrow screens. Members wrap within a role row.

- [ ] **Step 4: Extend verification and run it**

Add source assertions for `inputType: 'people'`, `normalizeTeamMembers`, and `pms-project-info-team-members`.

Run: `node scripts/verify-project-info-matrix-refresh.mjs`

Expected: team assertions PASS; later market/plan assertions still FAIL.

- [ ] **Step 5: Commit**

```bash
git add src/constants/projectInfoSchema.ts src/types/app.ts src/lib/projectInfoValues.ts src/components/project-info/ProjectInfoSections.tsx src/styles/globals.css scripts/verify-project-info-matrix-refresh.mjs
git commit -m "feat: support multi-person project roles"
```

### Task 4: Finish the display layout and four-column Modal

**Files:**
- Create: `src/lib/balancedRows.ts`
- Modify: `src/components/project-info/TargetProjectInformationView.tsx`
- Modify: `src/components/project-info/ProjectInfoSections.tsx`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-info-matrix-refresh.mjs`

- [ ] **Step 1: Add balanced partitioning**

Implement a pure helper which avoids a sparse final row:

```ts
export const getBalancedRows = <T>(items: T[], maxColumns: number, maxRows?: number): T[][] => {
  if (!items.length) return []
  const rowCount = Math.min(maxRows || Number.POSITIVE_INFINITY, Math.ceil(items.length / maxColumns))
  const baseSize = Math.floor(items.length / rowCount)
  const largerRows = items.length % rowCount
  const rows: T[][] = []
  let cursor = 0
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const size = baseSize + (rowIndex < largerRows ? 1 : 0)
    rows.push(items.slice(cursor, cursor + size))
    cursor += size
  }
  return rows
}
```

Render each information row as its own CSS grid with `gridTemplateColumns: repeat(row.length, minmax(0, 1fr))`. At desktop width use maximum six fields, producing 7→4+3, 8→4+4 and 13→5+4+4.

- [ ] **Step 2: Remove duplicate header tags and center information**

Delete the project-title `Tag` nodes for project status and health; retain the core-field values. Keep `gridTemplateColumns: repeat(coreFields.length, minmax(0, 1fr))` and `overflow-x: hidden` for one complete desktop row.

Center both labels and values in basic/extended information cells with `text-align: center`, flex centering, and `min-width: 0`.

- [ ] **Step 3: Change Modal to four columns**

Set `.pms-project-info-form-grid` to:

```css
.pms-project-info-form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 1199px) { .pms-project-info-form-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 899px) { .pms-project-info-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 639px) { .pms-project-info-form-grid { grid-template-columns: 1fr; } }
.pms-project-info-form-span { grid-column: 1 / -1; }
```

- [ ] **Step 4: Run focused and baseline checks**

Run: `node scripts/verify-project-info-matrix-refresh.mjs`

Expected: header/layout/modal assertions PASS; market and plan assertions remain.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/balancedRows.ts src/components/project-info/TargetProjectInformationView.tsx src/components/project-info/ProjectInfoSections.tsx src/components/project-info/ProjectInfoModal.tsx src/styles/globals.css scripts/verify-project-info-matrix-refresh.mjs
git commit -m "feat: balance project information layouts"
```

### Task 5: Replace market cards with the market-column matrix

**Files:**
- Modify: `src/components/project-info/MarketEditorModal.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-info-matrix-refresh.mjs`
- Test: `scripts/verify-market-build-config.mjs`

- [ ] **Step 1: Define stable matrix field rows**

Create a local descriptor array in the exact order:

```ts
const MARKET_MATRIX_FIELDS = [
  'isMain', 'followsMain', 'googleLaunchDate', 'isCarrierCustomized',
  'isSimLocked', 'isCancelPaused', 'cancelPauseDate', 'isMadaControlled',
  'branchInfo', 'jenkinsUrl', 'buildAddress',
] as const
```

Map each descriptor to the existing control and existing `updateRow(row.id, patch)` behavior. Disable and clear `cancelPauseDate` unless that market has `isCancelPaused === '是'`.

- [ ] **Step 2: Render markets as columns**

Use an Ant Design `Table` with a fixed first field column and one generated column per `draftRows` entry:

```tsx
const marketColumns: ColumnsType<MarketMatrixField> = [
  { title: '字段', dataIndex: 'label', key: 'label', fixed: 'left', width: 168 },
  ...draftRows.map(row => ({
    title: <MarketColumnHeader row={row} onRemove={() => removeRow(row.id)} />,
    dataIndex: row.id,
    key: row.id,
    width: 220,
    render: (_value, field) => renderMarketControl(field.key, row),
  })),
]
```

Keep the existing add-market selector above the table, protect the main market from deletion, and preserve existing draft guards. Use `scroll={{ x: 'max-content' }}` only for additional markets.

- [ ] **Step 3: Run matrix and compatibility checks**

Run: `node scripts/verify-project-info-matrix-refresh.mjs`

Expected: market markers PASS.

Run: `node scripts/verify-market-build-config.mjs`

Expected: all existing market-specific build assertions PASS after updating only presentation-specific assertions from card labels to matrix descriptors.

- [ ] **Step 4: Commit**

```bash
git add src/components/project-info/MarketEditorModal.tsx src/styles/globals.css scripts/verify-project-info-matrix-refresh.mjs scripts/verify-market-build-config.mjs
git commit -m "feat: edit project markets in a matrix"
```

### Task 6: Add configurable plan information fields

**Files:**
- Create: `src/constants/projectPlanInfoSchema.ts`
- Modify: `src/lib/projectFieldPreferences.ts`
- Modify: `src/hooks/useProjectFieldVisibility.ts`
- Modify: `src/components/project-info/FieldVisibilityPicker.tsx`
- Modify: `src/components/project-info/ProjectPlanInfoGrid.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-project-field-preferences.mjs`
- Test: `scripts/verify-project-info-matrix-refresh.mjs`

- [ ] **Step 1: Define the nine plan fields**

Export the exact ordered definitions:

```ts
export const PROJECT_PLAN_INFO_FIELDS = [
  { key: 'planStartDate', label: '计划开始时间', defaultVisible: true, hideable: true },
  { key: 'planEndDate', label: '计划结束时间', defaultVisible: true, hideable: true },
  { key: 'developCycle', label: '开发周期（工作日）', defaultVisible: true, hideable: true },
  { key: 'googleLaunchDate', label: 'Google Launch Date', defaultVisible: true, hideable: true },
  { key: 'isMadaControlled', label: '是否MADA管控', defaultVisible: true, hideable: true },
  { key: 'isCarrierCustomized', label: '是否运营商定制', defaultVisible: true, hideable: false },
  { key: 'isSimLocked', label: '是否锁卡', defaultVisible: true, hideable: true },
  { key: 'isCancelPaused', label: '是否取消暂停', defaultVisible: true, hideable: true },
  { key: 'cancelPauseDate', label: '取消暂停时间', defaultVisible: true, hideable: true },
] as const
```

- [ ] **Step 2: Reuse preference storage with a plan scope**

Export `ProjectFieldPreferenceGroupKey = ProjectInfoGroupKey | 'plan'` from `projectFieldPreferences.ts` and use it only for persistence scopes. Keep `ProjectInfoGroupKey` unchanged as `'basic' | 'extended' | 'team'`, so Modal grouping and `GROUP_COLORS` remain exhaustive. Generalize the preference utilities and picker to accept `{ key, label, defaultVisible, hideable, conditionalHint? }` so plan definitions can use the same Drawer without pretending to be project-info form fields.

Call `useProjectFieldVisibility` with `groupKey: 'plan'`, `userId: currentLoginUser`, and `projectId: selectedProject.id`. This deliberately omits market from the storage key so all markets in one project share the preference.

- [ ] **Step 3: Filter and balance the plan grid**

Add `visibleFieldKeys: string[]` to `ProjectPlanInfoGridProps`, filter the nine metrics in schema order, and call `getBalancedRows(metrics, 5, 2)`. Render each row with its own grid column count, guaranteeing one row for 1–5 fields and at most two rows for 6–9.

- [ ] **Step 4: Place the configuration Drawer trigger**

In the whole-machine plan card, render `FieldVisibilityPicker` on the same line as “计划信息”, pass `PROJECT_PLAN_INFO_FIELDS`, and pass the saved `visibleFieldKeys` into `ProjectPlanInfoGrid`. Do not add configuration to non-machine plan statistics.

- [ ] **Step 5: Verify persistence and layout**

Update `scripts/verify-project-field-preferences.mjs` so `'plan'` preferences reconcile defaults and the locked carrier field cannot disappear.

Run:

```bash
node scripts/verify-project-field-preferences.mjs
node scripts/verify-project-info-matrix-refresh.mjs
npx tsc --noEmit
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/constants/projectPlanInfoSchema.ts src/lib/projectFieldPreferences.ts src/hooks/useProjectFieldVisibility.ts src/components/project-info/FieldVisibilityPicker.tsx src/components/project-info/ProjectPlanInfoGrid.tsx src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-project-field-preferences.mjs scripts/verify-project-info-matrix-refresh.mjs
git commit -m "feat: configure project plan information fields"
```

### Task 7: Full verification, screenshots, release and PRD sync

**Files:**
- Modify: `docs/superpowers/plans/2026-07-21-project-info-matrix-field-refresh.md` (check completed steps)
- Update externally: Feishu document `项目管理-项目创建与字段分类更新需求文档PRD`

- [ ] **Step 1: Run the focused verification set**

Run:

```bash
node scripts/verify-project-info-matrix-refresh.mjs
node scripts/verify-project-field-preferences.mjs
node scripts/verify-project-core-layout.mjs
node scripts/verify-market-build-config.mjs
node scripts/verify-project-creation-draft.mjs
```

Expected: every script exits 0.

- [ ] **Step 2: Run the release gate**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: both exit 0 and the Next.js production build lists all app routes.

- [ ] **Step 3: Run a focused browser smoke**

Start `npm run dev`, open a whole-machine project and a tOS version project, and verify:

- no title status/health tags; core fields remain one line without scrolling;
- basic/extended fields are centered and 7/8/13 visible fields leave no blank cell;
- team roles show multiple members separately;
- create/edit Modal shows four fields per desktop row;
- market matrix can add/delete a non-main market and save independent values;
- plan Drawer hides/restores fields and the plan grid remains at most two rows.

Capture screenshots after saved state for the PRD, with no open temporary dropdown unless the corresponding interaction is being documented.

- [ ] **Step 4: Commit final verification fixes**

```bash
git add src scripts docs/superpowers/plans/2026-07-21-project-info-matrix-field-refresh.md
git commit -m "test: verify project information matrix refresh"
```

Skip this commit if the worktree is already clean after checking plan boxes is intentionally omitted from the release commits.

- [ ] **Step 5: Publish dev and master**

Push the verified feature tip to `dev`. In the clean release worktree based on the remote master head, merge the dev tip with a merge commit, rerun `npx tsc --noEmit` and `npm run build`, then push the merge commit to `master`. Verify both remote refs with `git ls-remote --heads origin dev master`; do not infer publication from local branches.

- [ ] **Step 6: Update the Feishu PRD**

In `项目管理-项目创建与字段分类更新需求文档PRD`:

- replace three-column Modal wording with four columns;
- add the no-gap balanced information-row rule and examples 7→4+3, 8→4+4;
- update team fields to multi-person roles and document legacy normalization;
- replace vertical market editor screenshots/text with the market matrix and all eleven field rows;
- add plan-field Drawer, persistence scope and two-row maximum;
- refresh all whole-machine and tOS field tables from the confirmed design spec;
- insert fresh screenshots directly after the related feature descriptions;
- update change history, acceptance criteria, omission checklist, and dev/master release evidence.

Fetch the document again after update and verify all six change areas, screenshot placement, field counts, and remote commit IDs are present exactly once.
