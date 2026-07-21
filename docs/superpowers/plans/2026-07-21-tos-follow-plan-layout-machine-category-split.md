# tOS Follow, Plan Layout, and Machine Category Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only tOS main-type following for level-one plans, move plan information below the core project block, hide the tOS basic display group, and split the whole-machine project type into phone, PAD, and laptop choices without duplicating the existing machine business model.

**Architecture:** Extend the pure tOS type rules with a non-destructive `followsMain` relation, a level-one effective source resolver, and derived summary groups. Keep the selected type as the UI identity while resolving only level-one plan storage/version keys to the main type; level-two and version-train state remain keyed by the selected type. Introduce a machine-project family helper so three new public type values and the legacy value share the existing fields, market, plan, template, roadmap, and permission paths.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5, Ant Design 6, Zustand 4, Node assertion scripts, Puppeteer.

---

## File map

### Pure domain rules

- Modify `src/lib/tosTypeRules.ts`: normalize `followsMain`, resolve effective level-one type, build merged basic-information tabs, and expose the follower read-only rule.
- Modify `src/constants/projectTypes.ts`: define the three machine types, legacy compatibility, family predicates, and template-family normalization.
- Modify `src/types/index.ts` and `src/types/app.ts`: consume the canonical project-type union rather than repeating obsolete string unions.

### Project information and plan UI

- Modify `src/containers/ProjectSpaceContainer.tsx`: wire effective tOS level-one scope, block follower revisions/edits/publish, render independent plan tabs, render merged basic-information tabs, reorder modules, and use the machine-family predicate.
- Modify `src/components/project-info/TargetProjectInformationView.tsx`: accept a plan-information slot after the core card and recognize all machine-family types.
- Modify `src/components/project-info/ProjectInfoSections.tsx`: allow the project-space caller to filter visible groups without changing form Schema.
- Modify `src/components/project-info/ProjectInfoModal.tsx`: include all machine-family projects as tOS first-launch candidates.
- Modify `src/constants/projectInfoSchema.ts`: route every machine-family type to the existing machine Schema.
- Modify `src/lib/projectInfoRules.ts` and `src/lib/projectInfoValues.ts`: aggregate and normalize all machine-family source projects consistently.

### Project-type consumers

- Modify `src/data/projects.ts`, `src/stores/project.ts`, `src/stores/plan.ts`, `src/stores/ui.ts`.
- Modify `src/containers/WorkspaceContainer.tsx`, `src/containers/ConfigContainer.tsx`.
- Modify `src/components/workspace/AddProjectModal.tsx`, `src/components/workspace/WorkspaceModule.tsx`, `src/components/plan/PlanModule.tsx`.
- Modify `src/app/page.tsx`, `src/app/share/plan/page.tsx`, `src/app/config/level1-template/page.tsx`, `src/app/config/level2-template/page.tsx`.
- Modify `src/components/roadmap/utils.ts`, `src/components/roadmap/MilestoneView.tsx`, `src/components/roadmap/ProjectPlanSummaryBoard.tsx`, `src/components/roadmap/MRTrainView.tsx`.

### Verification

- Modify `scripts/verify-tos-type-rules.mjs`.
- Modify `scripts/verify-tos-type-integration.mjs`.
- Modify `scripts/verify-project-info-matrix-refresh.mjs`.
- Create `scripts/verify-machine-project-types.mjs`.
- Create `scripts/verify-machine-project-type-integration.mjs`.
- Modify `screenshots/smoke-tos-type-plan.mjs`.

## Task 1: Establish the clean baseline

**Files:**
- Read: `package.json`
- Read: `package-lock.json`

- [ ] **Step 1: Confirm the worktree and branch**

Run:

```bash
git status --short --branch
git rev-parse --show-toplevel
```

Expected: branch `codex/tos-type-follow-machine-categories`, no uncommitted files, and top level ending in `.worktrees/codex-tos-type-follow-machine-categories`.

- [ ] **Step 2: Install the locked dependencies**

Run:

```bash
npm install
```

Expected: exit 0 and local `node_modules/.bin/tsc` exists.

- [ ] **Step 3: Run the focused baseline scripts**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-project-info-matrix-refresh.mjs
```

Expected: all three scripts print their existing `... verification passed.` messages.

## Task 2: Add pure tOS follower rules with TDD

**Files:**
- Modify: `scripts/verify-tos-type-rules.mjs`
- Modify: `src/lib/tosTypeRules.ts`

- [ ] **Step 1: Write failing follower-rule assertions**

Extend the destructured exports in `scripts/verify-tos-type-rules.mjs`:

```js
const {
  TOS_TYPE_OPTIONS,
  buildTosTypeRows,
  createTosTypePlanEntry,
  ensureTosTypePlanDataForRows,
  getMainTosType,
  getTosTypeCurrentVersion,
  getTosTypePlanSourceType,
  getTosTypeSnapshotKey,
  getTosTypeSummaryGroups,
  getTosTypeVersionKey,
  getTosTypeVersions,
  isFollowTosType,
  isTosTypeLevel1ReadOnly,
  normalizeTosTypeRows,
  setTosTypeCurrentVersion,
  setTosTypeVersions,
} = sandbox.module.exports
```

Update existing row expectations to include `followsMain: false`, then add:

```js
const followRows = normalizeTosTypeRows([
  { id: 'full', type: 'Full', isMain: true, followsMain: false },
  { id: 'go', type: 'GO', isMain: false, followsMain: true },
  { id: 'pad', type: 'PAD', isMain: false, followsMain: false },
])

assert.deepEqual(plain(followRows), [
  { id: 'full', type: 'Full', isMain: true, followsMain: false },
  { id: 'go', type: 'GO', isMain: false, followsMain: true },
  { id: 'pad', type: 'PAD', isMain: false, followsMain: false },
])
assert.equal(isFollowTosType(followRows, 'GO'), true)
assert.equal(isFollowTosType(followRows, 'PAD'), false)
assert.equal(getTosTypePlanSourceType(followRows, 'GO', 'level1'), 'Full')
assert.equal(getTosTypePlanSourceType(followRows, 'GO', 'level2'), 'GO')
assert.equal(isTosTypeLevel1ReadOnly(followRows, 'GO', 'level1'), true)
assert.equal(isTosTypeLevel1ReadOnly(followRows, 'GO', 'level2'), false)
assert.deepEqual(plain(getTosTypeSummaryGroups(followRows)), [
  { key: 'Full', label: 'Full&GO', sourceType: 'Full', memberTypes: ['Full', 'GO'] },
  { key: 'PAD', label: 'PAD', sourceType: 'PAD', memberTypes: ['PAD'] },
])

const changedMainRows = normalizeTosTypeRows([
  { id: 'full', type: 'Full', isMain: false, followsMain: true },
  { id: 'pad', type: 'PAD', isMain: true, followsMain: false },
], 'Full')
assert.equal(changedMainRows.every(row => row.followsMain === false), true)
assert.equal(getMainTosType(changedMainRows), 'PAD')
```

- [ ] **Step 2: Run the rule script and verify RED**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
```

Expected: FAIL because follower helpers are not exported and existing rows do not yet include `followsMain`.

- [ ] **Step 3: Implement the minimal follower model and helpers**

Change the row type and normalization in `src/lib/tosTypeRules.ts`:

```ts
export type TosTypeConfigRow = {
  id: string
  type: TosPlanType
  isMain: boolean
  followsMain: boolean
}

export type TosTypeSummaryGroup = {
  key: TosPlanType
  label: string
  sourceType: TosPlanType
  memberTypes: TosPlanType[]
}

export const normalizeTosTypeRows = (
  rows: Array<{ id: string; type: string; isMain: boolean; followsMain?: boolean }>,
  previousMainType?: string,
): TosTypeConfigRow[] => {
  const seen = new Set<string>()
  const filtered: TosTypeConfigRow[] = []

  rows.forEach(row => {
    if (!isValidTosType(row.type) || seen.has(row.type)) return
    seen.add(row.type)
    filtered.push({
      id: row.id,
      type: row.type,
      isMain: row.isMain,
      followsMain: !!row.followsMain,
    })
  })

  if (filtered.length === 0) return []
  const mainType = filtered.find(row => row.isMain)?.type || filtered[0].type
  const mainChanged = !!previousMainType && previousMainType !== mainType
  return filtered.map(row => {
    const isMain = row.type === mainType
    return {
      ...row,
      isMain,
      followsMain: isMain || mainChanged ? false : row.followsMain,
    }
  })
}
```

Add `followsMain: false` to every row created by `buildTosTypeRows`, then add:

```ts
export const isFollowTosType = (rows: TosTypeConfigRow[], type: string) => {
  const row = normalizeTosTypeRows(rows).find(item => item.type === type)
  return !!row && !row.isMain && row.followsMain
}

export const getTosTypePlanSourceType = (
  rows: TosTypeConfigRow[],
  type: string,
  planLevel: string,
): TosPlanType | '' => {
  const normalized = normalizeTosTypeRows(rows)
  const current = normalized.find(row => row.type === type)
  if (!current) return getMainTosType(normalized) as TosPlanType | ''
  if (planLevel !== 'level1' || current.isMain || !current.followsMain) return current.type
  return getMainTosType(normalized) as TosPlanType | ''
}

export const isTosTypeLevel1ReadOnly = (
  rows: TosTypeConfigRow[],
  type: string,
  planLevel: string,
) => planLevel === 'level1' && isFollowTosType(rows, type)

export const getTosTypeSummaryGroups = (rows: TosTypeConfigRow[]): TosTypeSummaryGroup[] => {
  const normalized = normalizeTosTypeRows(rows)
  const main = normalized.find(row => row.isMain)
  const followers = normalized.filter(row => !row.isMain && row.followsMain)

  return normalized.flatMap(row => {
    if (row.followsMain) return []
    if (row.isMain && main) {
      const memberTypes = [main.type, ...followers.map(item => item.type)]
      return [{ key: main.type, label: memberTypes.join('&'), sourceType: main.type, memberTypes }]
    }
    return [{ key: row.type, label: row.type, sourceType: row.type, memberTypes: [row.type] }]
  })
}
```

- [ ] **Step 4: Run the rule script and verify GREEN**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
```

Expected: `tOS type rules verification passed.`

- [ ] **Step 5: Commit the pure rules**

```bash
git add src/lib/tosTypeRules.ts scripts/verify-tos-type-rules.mjs
git commit -m "feat: add tos main-type follow rules"
```

## Task 3: Add tOS follow editing and preserve historical plan data

**Files:**
- Modify: `scripts/verify-tos-type-integration.mjs`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Verify: `src/stores/project.ts`
- Verify: `src/stores/plan.ts`

- [ ] **Step 1: Add failing integration markers for the editor**

Append these requirements in `scripts/verify-tos-type-integration.mjs`:

```js
const followEditorRequirements = [
  ['src/containers/ProjectSpaceContainer.tsx', '跟随主类型计划'],
  ['src/containers/ProjectSpaceContainer.tsx', 'followsMain'],
  ['src/containers/ProjectSpaceContainer.tsx', 'previousMainType'],
  ['src/lib/tosTypeRules.ts', 'getTosTypeSummaryGroups'],
]

for (const [file, token] of followEditorRequirements) {
  if (!read(file).includes(token)) failures.push(`${file} is missing ${token}`)
}
```

- [ ] **Step 2: Run the integration script and verify RED**

Run:

```bash
node scripts/verify-tos-type-integration.mjs
```

Expected: FAIL for the missing editor label and previous-main normalization.

- [ ] **Step 3: Initialize and update follower state in the shared editor**

In `src/containers/ProjectSpaceContainer.tsx`, initialize every new row with `followsMain: false`. Update the draft function with the previous main type:

```ts
const updateTosTypeDraftRow = (rowId: string, patch: Partial<TosTypeConfigRow>) => {
  setTosTypeDraftRows(previous => {
    const previousMainType = getMainTosType(previous)
    const nextRows = previous.map(row => ({ ...row }))
    const targetRow = nextRows.find(row => row.id === rowId)
    if (!targetRow) return previous

    if (patch.type !== undefined) targetRow.type = patch.type
    if (patch.followsMain !== undefined && !targetRow.isMain) {
      targetRow.followsMain = patch.followsMain
    }
    if (patch.isMain) {
      nextRows.forEach(row => {
        row.isMain = row.id === rowId
        if (row.id === rowId) row.followsMain = false
      })
    }
    return normalizeTosTypeRows(nextRows, previousMainType)
  })
}
```

When adding or falling back to a row, use:

```ts
{
  id: `tos-type-${Date.now()}`,
  type: nextType,
  isMain: previous.length === 0,
  followsMain: false,
}
```

Deletion must call `normalizeTosTypeRows(nextRows, previousMainType)` so deleting the main type clears all old follower bindings.

- [ ] **Step 4: Add the follower checkbox column**

Insert this column between main type and operation:

```tsx
{
  title: '跟随主类型',
  dataIndex: 'followsMain',
  width: 180,
  align: 'center',
  render: (_: boolean, record: TosTypeConfigRow) => (
    <Checkbox
      checked={!record.isMain && record.followsMain}
      disabled={record.isMain}
      onChange={event => updateTosTypeDraftRow(record.id, { followsMain: event.target.checked })}
    >
      跟随主类型计划
    </Checkbox>
  ),
}
```

Keep `ensureTosTypePlanDataForRows` in save. Do not delete entries for hidden, removed, or followed types.

- [ ] **Step 5: Run the editor integration checks**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
```

Expected: both scripts pass.

- [ ] **Step 6: Commit the editor behavior**

```bash
git add src/containers/ProjectSpaceContainer.tsx scripts/verify-tos-type-integration.mjs
git commit -m "feat: configure tos types to follow the main type"
```

## Task 4: Resolve tOS level-one plan scope and enforce follower read-only behavior

**Files:**
- Modify: `scripts/verify-tos-type-integration.mjs`
- Modify: `scripts/verify-market-version-rules.mjs`
- Modify: `src/lib/marketRules.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`

- [ ] **Step 1: Add failing scope and restriction markers**

Add these entries to the integration requirements:

```js
[
  ['src/containers/ProjectSpaceContainer.tsx', 'effectiveTosLevel1Type'],
  ['src/containers/ProjectSpaceContainer.tsx', 'scopedTosPlanType'],
  ['src/containers/ProjectSpaceContainer.tsx', 'currentTosTypeIsFollow'],
  ['src/containers/ProjectSpaceContainer.tsx', 'canMaintainCurrentPlan'],
  ['src/containers/ProjectSpaceContainer.tsx', '当前类型跟随'],
  ['src/containers/ProjectSpaceContainer.tsx', '请切换到'],
  ['src/containers/ProjectSpaceContainer.tsx', 'isTosTypeLevel1ReadOnly'],
]
```

In `scripts/verify-market-version-rules.mjs`, change the follower expectation while retaining independent and level-two behavior:

```js
assert.equal(canCreateRevisionForMarket(changedMain, 'RU', 'level1'), true)
assert.equal(canCreateRevisionForMarket(normalized, 'RU', 'level1'), false)
assert.equal(canCreateRevisionForMarket(normalized, 'RU', 'level2'), true)
```

- [ ] **Step 2: Run the integration script and verify RED**

Run:

```bash
node scripts/verify-tos-type-integration.mjs
node scripts/verify-market-version-rules.mjs
```

Expected: FAIL for the new tOS scope/restriction markers and because the market rule still permits a followed market to create a level-one revision.

- [ ] **Step 3: Derive selected, effective, and scoped types separately**

Import `getTosTypePlanSourceType`, `isFollowTosType`, and `isTosTypeLevel1ReadOnly`. Define the following values immediately after the existing `scopedPlanLevel` and `isTosTypeScoped` declarations, so every referenced value has already been initialized:

```ts
const effectiveTosLevel1Type = getTosTypePlanSourceType(
  tosTypeConfigRows,
  selectedTosTypeTab,
  'level1',
)
const scopedTosPlanType = scopedPlanLevel === 'level1'
  ? effectiveTosLevel1Type
  : selectedTosTypeTab
const currentTosTypeIsFollow = isFollowTosType(tosTypeConfigRows, selectedTosTypeTab)
const followedTosLevel1ReadOnly = isTosTypeScoped
  && currentTosTypeIsFollow
  && isTosTypeLevel1ReadOnly(tosTypeConfigRows, selectedTosTypeTab, projectPlanLevel)
const followSourceLabel = followedTosLevel1ReadOnly
  ? `当前类型跟随 ${effectiveTosLevel1Type}`
  : ''
const canMaintainCurrentPlan = canEditCurrentPlan && !followedTosLevel1ReadOnly
```

Keep `selectedTosTypeTab` as the actual UI tab. Use `effectiveTosLevel1Type` only for level-one plan data, versions, current version, published snapshot, snapshot writes, cancel restore, due scans, and level-one version comparison. Use `selectedTosTypeTab` for all level-two and version-train keys.

- [ ] **Step 4: Split level-one and selected-type data access**

Replace the single selected-type updater with a typed updater:

```ts
const updateTosTypeData = (
  type: string,
  updater: (previous: TosTypePlanEntry) => TosTypePlanEntry,
) => {
  if (!selectedProject || !isTosTypeScoped) return
  setTosTypePlanDataByProjectId(previous => {
    const ensured = ensureTosTypePlanDataForRows(
      previous,
      selectedProject.id,
      tosTypeConfigRows,
      tosTypeSeedEntry,
    )
    const projectData = ensured[selectedProject.id] || {}
    const current = projectData[type] || createTosTypePlanEntry(tosTypeSeedEntry)
    return {
      ...ensured,
      [selectedProject.id]: {
        ...projectData,
        [type]: updater(current),
      },
    }
  })
}

const currentTosTypeData = isTosTypeScoped && selectedProject
  ? (tosTypePlanDataByProjectId[selectedProject.id]?.[selectedTosTypeTab]
    || createTosTypePlanEntry(tosTypeSeedEntry))
  : null

const currentTosLevel1Data = isTosTypeScoped && selectedProject && effectiveTosLevel1Type
  ? (tosTypePlanDataByProjectId[selectedProject.id]?.[effectiveTosLevel1Type]
    || createTosTypePlanEntry(tosTypeSeedEntry))
  : null
```

Build `effectiveTasks` and `setEffectiveTasks` from `currentTosLevel1Data` and `effectiveTosLevel1Type`. Keep all level-two setters on `currentTosTypeData` and `selectedTosTypeTab`.

- [ ] **Step 5: Scope versions and snapshots**

For generic version getters/setters, use:

```ts
getTosTypeVersions(
  tosTypeVersionsByKey,
  selectedProject.id,
  scopedTosPlanType,
  scopedPlanLevel,
  VERSION_DATA,
)
```

For level-one-only values use `effectiveTosLevel1Type`; for level-two-only values use `selectedTosTypeTab`. Apply the same rule to `getTosTypeCurrentVersion`, `setTosTypeCurrentVersion`, `getTosTypeSnapshotKey`, publish snapshot writes, cancel restores, version comparison, due scans, and `hasPublishedLevel1Plan`.

- [ ] **Step 6: Guard every level-one mutation path**

First implement the existing intended market rule in `src/lib/marketRules.ts`:

```ts
export const canCreateRevisionForMarket = (
  rows: MarketConfigRow[],
  market: string,
  planLevel: string,
) => planLevel !== 'level1' || !isFollowMarket(rows, market)
```

In `ProjectSpaceContainer`, derive a separate create-revision gate so this market rule does not disable the existing follower-market actual-time editing:

```ts
const canCreateCurrentRevision = canMaintainCurrentPlan
  && (!isWholeMachineProject
    || canCreateRevisionForMarket(marketConfigRows, selectedMarketTab, projectPlanLevel))
```

At the beginning of `handleCreateRevision`, `handlePublish`, plan cloning, and other level-one mutation handlers, add:

```ts
if (followedTosLevel1ReadOnly) {
  message.warning(`当前类型跟随 ${effectiveTosLevel1Type}，请切换到 ${effectiveTosLevel1Type} 维护一级计划`)
  return
}
```

For `handleCreateRevision`, also guard a followed machine market:

```ts
if (isWholeMachineProject
  && !canCreateRevisionForMarket(marketConfigRows, selectedMarketTab, projectPlanLevel)) {
  message.warning(`当前市场跟随 ${primaryMarket}，请切换到 ${primaryMarket} 发起一级计划修订`)
  return
}
```

Use `canMaintainCurrentPlan` instead of `canEditCurrentPlan` for the generic level-one create-revision, publish, cancel, clone, table edit, gantt edit, row add/delete, and inline actual-date entry points. The disabled create-revision button must use:

```tsx
<Tooltip title={followedTosLevel1ReadOnly
  ? `当前类型跟随 ${effectiveTosLevel1Type}，请切换到 ${effectiveTosLevel1Type} 维护一级计划`
  : `无${currentPlanPermissionLabel}编辑权限`}
>
  <Button type="primary" icon={<PlusOutlined />} disabled aria-label="创建修订">
    创建修订
  </Button>
</Tooltip>
```

Use `canCreateCurrentRevision` specifically for rendering/enabling the create-revision button. Do not replace the existing `currentMarketIsFollow` actual-date overlay path; followed markets must retain independent actual start/end updates.

Do not apply this restriction when `projectPlanLevel === 'level2'`.

- [ ] **Step 7: Show source and follow labels**

In the type tag bar, render:

```tsx
<Space size={4}>
  {row.type}
  {row.isMain && <span style={{ fontSize: 11 }}>主</span>}
  {row.followsMain && <span style={{ fontSize: 11 }}>跟随</span>}
</Space>
```

Above the level-one version card for a followed type, render:

```tsx
{followedTosLevel1ReadOnly && (
  <Alert
    type="info"
    showIcon
    message={followSourceLabel}
    description={`一级计划来自 ${effectiveTosLevel1Type}，请切换到主类型进行修订、编辑或发布。`}
    style={{ marginBottom: 12 }}
  />
)}
```

- [ ] **Step 8: Run focused checks and type-check**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-market-version-rules.mjs
npx tsc --noEmit
```

Expected: scripts pass and TypeScript exits 0.

- [ ] **Step 9: Commit the effective scope and read-only rule**

```bash
git add src/lib/marketRules.ts src/containers/ProjectSpaceContainer.tsx scripts/verify-market-version-rules.mjs scripts/verify-tos-type-integration.mjs
git commit -m "feat: follow main tos level-one plans read only"
```

## Task 5: Reorder project information and merge only the tOS summary tabs

**Files:**
- Modify: `scripts/verify-project-info-matrix-refresh.mjs`
- Modify: `scripts/verify-tos-type-integration.mjs`
- Modify: `src/components/project-info/TargetProjectInformationView.tsx`
- Modify: `src/components/project-info/ProjectInfoSections.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`

- [ ] **Step 1: Add failing layout assertions**

Add these assertions in `scripts/verify-project-info-matrix-refresh.mjs`:

```js
assert.match(view, /afterCore/, 'the target project view must support content immediately after the core card')
assert.match(view, /visibleGroupKeys/, 'the target project view must pass display-group filtering')
assert.match(sections, /visibleGroupKeys/, 'project-space sections must support caller-selected groups')
```

Add these integration markers in `scripts/verify-tos-type-integration.mjs`:

```js
[
  ['src/containers/ProjectSpaceContainer.tsx', 'getTosTypeSummaryGroups'],
  ['src/containers/ProjectSpaceContainer.tsx', "visibleGroupKeys={isTosVersionProject ? ['team'] : undefined}"],
  ['src/containers/ProjectSpaceContainer.tsx', 'afterCore='],
  ['src/containers/ProjectSpaceContainer.tsx', 'summaryTosTypeGroups'],
]
```

- [ ] **Step 2: Run both scripts and verify RED**

Run:

```bash
node scripts/verify-project-info-matrix-refresh.mjs
node scripts/verify-tos-type-integration.mjs
```

Expected: FAIL for the new layout and summary markers.

- [ ] **Step 3: Add a core-after slot and display-group filter**

Update `TargetProjectInformationView` props:

```ts
interface TargetProjectInformationViewProps {
  project: ProjectInfoProject
  currentUser: string
  canEdit: boolean
  canConfigure: boolean
  onEdit: () => void
  onApplyTransfer?: () => void
  afterCore?: React.ReactNode
  visibleGroupKeys?: ProjectInfoGroupKey[]
}
```

Render `{afterCore}` between the core `Card` and `ProjectInfoSections`, and pass `visibleGroupKeys` to the sections component.

Update `ProjectInfoSections`:

```ts
interface ProjectInfoSectionsProps {
  project: ProjectInfoProject
  currentUser: string
  canConfigure: boolean
  visibleGroupKeys?: ProjectInfoGroupKey[]
}

export default function ProjectInfoSections({
  project,
  currentUser,
  canConfigure,
  visibleGroupKeys,
}: ProjectInfoSectionsProps) {
  const groups = getProjectInfoGroups(project.type)
    .filter(group => !visibleGroupKeys || visibleGroupKeys.includes(group.key))
  return (
    <div id="section-basic" className="pms-project-info-sections">
      {groups.map(group => (
        <ProjectInfoGroupPanel
          key={group.key}
          group={group}
          project={project}
          currentUser={currentUser}
          canConfigure={canConfigure}
        />
      ))}
    </div>
  )
}
```

Do not change `ProjectInfoModal`; it must continue reading all Schema groups.

- [ ] **Step 4: Move both target-project plan cards into the slot**

Extract the current whole-machine “计划信息与配置信息” card into `renderWholeMachinePlanInfo()`. Keep its market tabs, field configuration, horizontal table, and build information unchanged.

Pass the slot from `renderProjectBasicInfo()`:

```tsx
<TargetProjectInformationView
  project={p as unknown as ProjectInfoProject}
  currentUser={currentLoginUser}
  canEdit={canEditBasicInfo}
  canConfigure={canViewBasicInfo}
  onEdit={() => setShowProjectInfoEditor(true)}
  onApplyTransfer={isWholeMachine ? () => transfer.setTransferView('apply') : undefined}
  afterCore={isWholeMachine ? renderWholeMachinePlanInfo() : renderProjectPlanInfo()}
  visibleGroupKeys={isTosVersionProject ? ['team'] : undefined}
/>
```

Remove the old lower-page render of both plan cards. Keep transfer and tOS build-configuration cards after the information sections. Reorder `anchorSections` to `section-header`, `section-plan`, `section-basic`, then later sections.

- [ ] **Step 5: Build merged tOS summary items**

In `renderProjectPlanInfo()`, derive:

```ts
const summaryTosTypeGroups = getTosTypeSummaryGroups(tosTypeConfigRows)
const summaryActiveType = getTosTypePlanSourceType(
  tosTypeConfigRows,
  selectedTosTypeTab,
  'level1',
)
```

Render summary tabs with:

```tsx
<Tabs
  activeKey={summaryActiveType}
  onChange={type => navigateWithEditGuard(() => setSelectedTosTypeTab(type))}
  type="card"
  tabBarExtraContent={{ right: typeEditButton }}
  items={summaryTosTypeGroups.map(group => ({
    key: group.key,
    label: <span style={{ fontWeight: 500 }}>{group.label}</span>,
    children: <div style={{ paddingTop: 8 }}>{planInfoContent}</div>,
  }))}
/>
```

The plan module type bar must still iterate `tosTypeConfigRows`; do not reuse `summaryTosTypeGroups` there.

- [ ] **Step 6: Remove only the tOS summary statistics**

Wrap the four statistics and their divider:

```tsx
{!isTosVersionProject && (
  <>
    <Row gutter={[24, 16]}>
      <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划开始时间</span>} value={displayedPlanStartDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#6366f1', fontSize: 14 }} />} /></Col>
      <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划结束时间</span>} value={displayedPlanEndDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#faad14', fontSize: 14 }} />} /></Col>
      <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>开发周期（工作日）</span>} value={displayedDevelopCycle || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} suffix={displayedDevelopCycle ? <span style={{ fontSize: 12, color: '#9ca3af' }}>天</span> : undefined} /></Col>
      <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>健康状态</span>} value={displayedHealthLabel} valueStyle={{ fontSize: 16, fontWeight: 600 }} /></Col>
    </Row>
    <Divider style={{ margin: '16px 0' }} />
  </>
)}
<div className="pms-project-plan-info-title">里程碑计划（横排视图）</div>
{renderHorizontalTable()}
```

Do not remove the whole-machine `ProjectPlanInfoGrid` or non-tOS statistics.

- [ ] **Step 7: Run focused checks and type-check**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-project-info-matrix-refresh.mjs
npx tsc --noEmit
```

Expected: all commands pass.

- [ ] **Step 8: Commit the project-information layout**

```bash
git add src/components/project-info/TargetProjectInformationView.tsx src/components/project-info/ProjectInfoSections.tsx src/containers/ProjectSpaceContainer.tsx scripts/verify-project-info-matrix-refresh.mjs scripts/verify-tos-type-integration.mjs
git commit -m "feat: place plan information below project core"
```

## Task 6: Define the three machine project types and compatibility family

**Files:**
- Create: `scripts/verify-machine-project-types.mjs`
- Modify: `src/constants/projectTypes.ts`
- Modify: `src/types/index.ts`
- Modify: `src/types/app.ts`
- Modify: `src/constants/projectInfoSchema.ts`
- Modify: `src/data/projects.ts`

- [ ] **Step 1: Write a failing pure project-type verification**

Create `scripts/verify-machine-project-types.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const filename = 'src/constants/projectTypes.ts'
const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const module = { exports: {} }
vm.runInNewContext(output, { module, exports: module.exports }, { filename })

const {
  LEGACY_PROJECT_TYPE_MACHINE,
  MACHINE_PROJECT_TYPES,
  PROJECT_TYPES,
  PROJECT_TYPE_MACHINE,
  PROJECT_TYPE_MACHINE_LAPTOP,
  PROJECT_TYPE_MACHINE_PAD,
  PROJECT_TYPE_MACHINE_PHONE,
  getProjectTypeFamilyKey,
  isMachineProjectType,
  normalizeMachineProjectType,
} = module.exports
const plain = value => JSON.parse(JSON.stringify(value))

assert.equal(PROJECT_TYPE_MACHINE_PHONE, '整机产品-手机')
assert.equal(PROJECT_TYPE_MACHINE_PAD, '整机产品-PAD')
assert.equal(PROJECT_TYPE_MACHINE_LAPTOP, '整机产品-笔电')
assert.equal(PROJECT_TYPE_MACHINE, PROJECT_TYPE_MACHINE_PHONE)
assert.equal(LEGACY_PROJECT_TYPE_MACHINE, '整机产品项目')
assert.deepEqual(plain(MACHINE_PROJECT_TYPES), [
  '整机产品-手机',
  '整机产品-PAD',
  '整机产品-笔电',
])
assert.equal(MACHINE_PROJECT_TYPES.every(isMachineProjectType), true)
assert.equal(isMachineProjectType(LEGACY_PROJECT_TYPE_MACHINE), true)
assert.equal(isMachineProjectType('tOS版本项目'), false)
assert.equal(normalizeMachineProjectType(LEGACY_PROJECT_TYPE_MACHINE), PROJECT_TYPE_MACHINE_PHONE)
assert.equal(getProjectTypeFamilyKey(PROJECT_TYPE_MACHINE_PAD), PROJECT_TYPE_MACHINE_PHONE)
assert.equal(getProjectTypeFamilyKey(PROJECT_TYPE_MACHINE_LAPTOP), PROJECT_TYPE_MACHINE_PHONE)
assert.equal(PROJECT_TYPES.includes(LEGACY_PROJECT_TYPE_MACHINE), false)
assert.equal(PROJECT_TYPES.includes(PROJECT_TYPE_MACHINE_PHONE), true)
assert.equal(PROJECT_TYPES.includes(PROJECT_TYPE_MACHINE_PAD), true)
assert.equal(PROJECT_TYPES.includes(PROJECT_TYPE_MACHINE_LAPTOP), true)

console.log('Machine project type verification passed.')
```

- [ ] **Step 2: Run the new script and verify RED**

Run:

```bash
node scripts/verify-machine-project-types.mjs
```

Expected: FAIL because the new constants and helpers do not exist.

- [ ] **Step 3: Implement the machine family constants and helpers**

Define the three machine scalar constants first, keep the existing tOS/independent-software/technical/capability scalar constants next, and declare the arrays only after all scalar constants. The resulting machine and array section is:

```ts
export const PROJECT_TYPE_MACHINE_PHONE = '整机产品-手机' as const
export const PROJECT_TYPE_MACHINE_PAD = '整机产品-PAD' as const
export const PROJECT_TYPE_MACHINE_LAPTOP = '整机产品-笔电' as const
export const PROJECT_TYPE_MACHINE = PROJECT_TYPE_MACHINE_PHONE
export const LEGACY_PROJECT_TYPE_MACHINE = '整机产品项目' as const

export const MACHINE_PROJECT_TYPES = [
  PROJECT_TYPE_MACHINE_PHONE,
  PROJECT_TYPE_MACHINE_PAD,
  PROJECT_TYPE_MACHINE_LAPTOP,
] as const

export const PROJECT_TYPES = [
  ...MACHINE_PROJECT_TYPES,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_CAPABILITY,
] as const

export const PROJECT_TEMPLATE_TYPES = [
  PROJECT_TYPE_MACHINE,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_CAPABILITY,
] as const

export function isMachineProjectType(type: string | undefined | null) {
  return type === LEGACY_PROJECT_TYPE_MACHINE
    || (MACHINE_PROJECT_TYPES as readonly string[]).includes(String(type || ''))
}

export function normalizeMachineProjectType(type: string | undefined | null) {
  return type === LEGACY_PROJECT_TYPE_MACHINE ? PROJECT_TYPE_MACHINE_PHONE : type || ''
}

export function getProjectTypeFamilyKey(type: string | undefined | null) {
  return isMachineProjectType(type) ? PROJECT_TYPE_MACHINE : type || ''
}
```

Add color entries for all three new values and retain one legacy color entry for old persisted data.

- [ ] **Step 4: Replace repeated type unions and route the machine Schema**

In `src/types/index.ts`:

```ts
import type { ProjectTypeName } from '@/constants/projectTypes'
export type ProjectType = ProjectTypeName
```

In `src/types/app.ts`:

```ts
import type { ProjectTypeName } from '@/constants/projectTypes'
export type ProjectCategory = ProjectTypeName
```

In `src/constants/projectInfoSchema.ts`, import `MACHINE_PROJECT_TYPES` and `isMachineProjectType`, then use:

```ts
export const TARGET_PROJECT_TYPES = [...MACHINE_PROJECT_TYPES, PROJECT_TYPE_TOS_VERSION] as const

export const isTargetProjectInfoType = (type: string | undefined) => (
  isMachineProjectType(type) || type === PROJECT_TYPE_TOS_VERSION
)

export const getProjectInfoFields = (type: string | undefined) => {
  if (isMachineProjectType(type)) return MACHINE_PROJECT_INFO_FIELDS
  if (type === PROJECT_TYPE_TOS_VERSION) return TOS_PROJECT_INFO_FIELDS
  return []
}

export const getProjectInfoGroups = (type: string | undefined) => {
  if (isMachineProjectType(type)) return MACHINE_PROJECT_INFO_GROUPS
  if (type === PROJECT_TYPE_TOS_VERSION) return TOS_PROJECT_INFO_GROUPS
  return []
}
```

- [ ] **Step 5: Migrate Mock machine records**

Keep `src/data/projects.ts` machine records on `PROJECT_TYPE_MACHINE`; because it now aliases `整机产品-手机`, all existing Mock machine projects migrate without rewriting each object. Change `mapIpmStatus` to `isMachineProjectType(projectType)` so legacy and all new types share hardware status mapping.

- [ ] **Step 6: Run pure and Schema verification**

Run:

```bash
node scripts/verify-machine-project-types.mjs
node scripts/verify-project-info-matrix-refresh.mjs
npx tsc --noEmit
```

Expected: all commands pass after updating the Schema verification stub to export `MACHINE_PROJECT_TYPES` and `isMachineProjectType`.

- [ ] **Step 7: Commit the machine family model**

```bash
git add src/constants/projectTypes.ts src/types/index.ts src/types/app.ts src/constants/projectInfoSchema.ts src/data/projects.ts scripts/verify-machine-project-types.mjs scripts/verify-project-info-matrix-refresh.mjs
git commit -m "feat: split machine projects into three categories"
```

## Task 7: Route all machine consumers through the family helper

**Files:**
- Create: `scripts/verify-machine-project-type-integration.mjs`
- Modify: `src/app/page.tsx`
- Modify: `src/app/share/plan/page.tsx`
- Modify: `src/app/config/level1-template/page.tsx`
- Modify: `src/app/config/level2-template/page.tsx`
- Modify: `src/components/plan/PlanModule.tsx`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/project-info/TargetProjectInformationView.tsx`
- Modify: `src/components/workspace/WorkspaceModule.tsx`
- Modify: `src/lib/projectInfoRules.ts`
- Modify: `src/lib/projectInfoValues.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/containers/WorkspaceContainer.tsx`
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/stores/project.ts`
- Modify: `src/stores/plan.ts`
- Modify: `src/components/roadmap/utils.ts`
- Modify: `src/components/roadmap/MilestoneView.tsx`
- Modify: `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- Modify: `src/components/roadmap/MRTrainView.tsx`

- [ ] **Step 1: Write a failing integration scan**

Create `scripts/verify-machine-project-type-integration.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(file, 'utf8')
const required = [
  ['src/components/project-info/TargetProjectInformationView.tsx', 'isMachineProjectType'],
  ['src/components/project-info/ProjectInfoModal.tsx', 'isMachineProjectType(item.type)'],
  ['src/lib/projectInfoRules.ts', 'isMachineProjectType(project.type)'],
  ['src/lib/projectInfoValues.ts', 'isMachineProjectType'],
  ['src/containers/ProjectSpaceContainer.tsx', 'isMachineProjectType(selectedProject?.type)'],
  ['src/stores/project.ts', 'isMachineProjectType(project.type)'],
  ['src/app/share/plan/page.tsx', 'isMachineProjectType(project?.type)'],
  ['src/components/plan/PlanModule.tsx', 'isMachineProjectType(selectedProject?.type)'],
  ['src/components/roadmap/utils.ts', 'isMachineProjectType'],
  ['src/components/roadmap/MilestoneView.tsx', 'isMachineProjectType'],
  ['src/components/roadmap/ProjectPlanSummaryBoard.tsx', 'isMachineProjectType'],
  ['src/stores/plan.ts', 'PROJECT_TEMPLATE_TYPES'],
  ['src/containers/ConfigContainer.tsx', 'PROJECT_TEMPLATE_TYPES'],
]

for (const [file, token] of required) {
  assert.equal(read(file).includes(token), true, `${file} must use ${token}`)
}

const directComparisonFiles = [
  'src/app/page.tsx',
  'src/app/share/plan/page.tsx',
  'src/components/plan/PlanModule.tsx',
  'src/components/project-info/ProjectInfoModal.tsx',
  'src/components/project-info/TargetProjectInformationView.tsx',
  'src/components/workspace/WorkspaceModule.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
  'src/containers/WorkspaceContainer.tsx',
  'src/stores/project.ts',
]

for (const file of directComparisonFiles) {
  assert.doesNotMatch(
    read(file),
    /(?:===|!==)\s*['"]整机产品项目['"]|['"]整机产品项目['"]\s*(?:===|!==)/,
    `${file} must not branch on the legacy machine string`,
  )
}

console.log('Machine project type integration verification passed.')
```

- [ ] **Step 2: Run the integration scan and verify RED**

Run:

```bash
node scripts/verify-machine-project-type-integration.mjs
```

Expected: FAIL in the first consumer still using one machine type.

- [ ] **Step 3: Replace exact branching with family checks**

Import and use `isMachineProjectType` in every listed runtime consumer. Apply these exact transformations:

```ts
const isWholeMachine = isMachineProjectType(project.type)
const isWholeMachineProject = isMachineProjectType(selectedProject?.type)
```

Use the predicate for filters:

```ts
projects.filter(project => isMachineProjectType(project.type))
existingProjects.filter(item => isMachineProjectType(item.type))
```

Use it for market navigation, share-page market tabs, project cards, plan-market tabs, roadmap rows, roadmap fixed columns, machine status conversion, and first-launch candidates. Keep display-only legacy labels only where they describe the aggregate roadmap scope; never use them for a runtime branch.

Normalize old persisted values in `ProjectInfoModal` before they enter or leave the form:

```ts
const normalizedProjectType = normalizeMachineProjectType(project.type)
const initialValues = {
  ...project,
  type: normalizedProjectType,
  responsiblePersons,
  ...infoValues,
}
```

When submitting create/edit values, persist `normalizeMachineProjectType(String(values.type || ''))`. In `projectInfoRules.ts` and `projectInfoValues.ts`, replace exact machine filtering and conditional-field checks with `isMachineProjectType`; this keeps aggregation and external-development cleanup working for phone, PAD, laptop, and legacy records.

- [ ] **Step 4: Show three public choices while sharing one template family**

Use `PROJECT_TYPES` for new/edit project choices and workspace filters. Update the hardcoded workspace quick filters to:

```ts
[
  { label: '整机-手机', value: PROJECT_TYPE_MACHINE_PHONE },
  { label: '整机-PAD', value: PROJECT_TYPE_MACHINE_PAD },
  { label: '整机-笔电', value: PROJECT_TYPE_MACHINE_LAPTOP },
  { label: 'tOS版本', value: PROJECT_TYPE_TOS_VERSION },
  { label: '独立软件', value: PROJECT_TYPE_INDEPENDENT_SOFTWARE },
  { label: '技术', value: PROJECT_TYPE_TECH },
  { label: '能力建设', value: PROJECT_TYPE_CAPABILITY },
]
```

Use `PROJECT_TEMPLATE_TYPES` in `src/stores/plan.ts`, `src/containers/ConfigContainer.tsx`, and both standalone template pages so only one canonical machine template exists. Before reading a template in `ProjectSpaceContainer`, normalize:

```ts
const projectType = getProjectTypeFamilyKey(selectedProject?.type || selectedPlanType)
const templateTasks = configTemplateTasksByType[projectType] || LEVEL1_TEMPLATE_TASKS
```

Apply the same family-key normalization to template snapshot keys.

- [ ] **Step 5: Keep the roadmap aggregate scope**

Keep one visible roadmap scope labelled “整机产品项目”, but make its filters use `isMachineProjectType`. `getFixedColumnsForType`, `buildProjectInfo`, milestone fallback lookup, comparison fields, and summary-board rows must treat phone/PAD/laptop identically. Resolve the initial scope with `isMachineProjectType(initialProjectType) ? 'machine' : SCOPE_BY_PROJECT_TYPE[initialProjectType]`, so PAD and laptop projects do not fall back to “整体”.

Define the machine fallback milestone key with the canonical constant:

```ts
const FALLBACK_MILESTONES: Record<string, string[]> = {
  [PROJECT_TYPE_MACHINE]: ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5'],
  [LEGACY_SOFTWARE_PROJECT_TYPE]: ['概念启动', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5', 'MR6', 'MR7'],
  [PROJECT_TYPE_TOS_VERSION]: ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', 'tOS16.1.101', 'tOS16.1.102', 'tOS16.1.103', 'tOS16.1.104'],
  [PROJECT_TYPE_INDEPENDENT_SOFTWARE]: ['概念启动', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5', 'MR6', 'MR7'],
  [PROJECT_TYPE_TECH]: ['概念启动', 'TDR1', 'TDR2', 'TDR3', 'TDR4'],
}
```

For fallback milestone lookup use:

```ts
const fallbackType = isMachineProjectType(project.type) ? PROJECT_TYPE_MACHINE : project.type
const fallbackNames = FALLBACK_MILESTONES[fallbackType] || FALLBACK_MILESTONES[PROJECT_TYPE_MACHINE]
```

- [ ] **Step 6: Run the consumer matrix**

Run:

```bash
node scripts/verify-machine-project-types.mjs
node scripts/verify-machine-project-type-integration.mjs
node scripts/verify-project-info-matrix-refresh.mjs
node scripts/verify-whole-machine-project-fields.mjs
node scripts/verify-tos-type-integration.mjs
npx tsc --noEmit
```

Expected: all commands pass.

- [ ] **Step 7: Audit remaining legacy comparisons**

Run:

```bash
rg -n "=== ['\"]整机产品项目['\"]|['\"]整机产品项目['\"] ===|!== ['\"]整机产品项目['\"]|['\"]整机产品项目['\"] !==" src
```

Expected: no output. Aggregate display labels, legacy constants, migration fixtures, and comments may still contain the old text.

- [ ] **Step 8: Commit all consumer routing**

```bash
git add src scripts/verify-machine-project-type-integration.mjs
git commit -m "refactor: route machine categories through one family"
```

## Task 8: Update the focused browser smoke path

**Files:**
- Modify: `screenshots/smoke-tos-type-plan.mjs`

- [ ] **Step 1: Extend the smoke test before changing production code further**

Add DOM helpers that return element top positions and locate a type-editor row by its selected value. Extend the scenario to verify:

```js
await assertVisibleText(page, '计划信息', '#section-plan')
await assertNoVisibleText(page, '计划开始时间', '#section-plan')
await assertNoVisibleText(page, '计划结束时间', '#section-plan')
await assertNoVisibleText(page, '开发周期（工作日）', '#section-plan')
await assertNoVisibleText(page, '健康状态', '#section-plan')

const order = await page.evaluate(() => ({
  core: document.querySelector('#section-header')?.getBoundingClientRect().top,
  plan: document.querySelector('#section-plan')?.getBoundingClientRect().top,
  sections: document.querySelector('#section-basic')?.getBoundingClientRect().top,
}))
if (!(order.core < order.plan && order.plan < order.sections)) {
  fail(`Unexpected project-information order: ${JSON.stringify(order)}`)
}
```

In the type editor, add GO if absent, check its “跟随主类型计划” checkbox, save, and assert `Full&GO` in basic information. Then enter the plan module and assert Full and GO remain separate tags. Select GO on level one and assert the source alert plus a disabled “创建修订” button.

Open the add-project Modal, locate the form item whose label is `项目类型`, click its `.ant-select-selector`, then assert these option texts are present:

```js
for (const type of ['整机产品-手机', '整机产品-PAD', '整机产品-笔电']) {
  await assertVisibleText(page, type, '.ant-select-dropdown')
}
```

- [ ] **Step 2: Start the local app**

Run in a persistent terminal:

```bash
npm run dev -- --port 3105
```

Expected: Next.js reports ready at `http://localhost:3105`.

- [ ] **Step 3: Run the smoke test**

Run:

```bash
PMS_BASE_URL=http://localhost:3105 node screenshots/smoke-tos-type-plan.mjs
```

Expected: `tOS type plan smoke passed.` with no page runtime errors.

- [ ] **Step 4: Commit the smoke coverage**

```bash
git add screenshots/smoke-tos-type-plan.mjs
git commit -m "test: cover tos follow and machine type split"
```

## Task 9: Final verification and handoff

**Files:**
- Verify: all files changed in Tasks 2-8

- [ ] **Step 1: Run every focused verification script**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
node scripts/verify-machine-project-types.mjs
node scripts/verify-machine-project-type-integration.mjs
node scripts/verify-project-info-matrix-refresh.mjs
node scripts/verify-whole-machine-project-fields.mjs
node scripts/verify-market-version-rules.mjs
```

Expected: every script prints its success message.

- [ ] **Step 2: Run the repository gates**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: both exit 0; Next.js completes the production build.

- [ ] **Step 3: Re-run the focused UI smoke**

Run:

```bash
PMS_BASE_URL=http://localhost:3105 node screenshots/smoke-tos-type-plan.mjs
```

Expected: pass with no runtime errors.

- [ ] **Step 4: Inspect final scope and history**

Run:

```bash
git status --short --branch
git diff origin/dev...HEAD --stat
git log --oneline origin/dev..HEAD
```

Expected: clean worktree, only planned feature/spec/test changes, and small task-level commits.

- [ ] **Step 5: Prepare release information**

Record the feature branch name, final commit, verification commands, local URL, and any known limitation. Do not push to `dev`, merge `master`, deploy, or edit the Feishu PRD unless the user requests those release actions for this iteration.
