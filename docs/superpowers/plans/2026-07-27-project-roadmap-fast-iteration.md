# Project Roadmap Fast Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade project-name rendering, three-part tOS versions, inline version cards, multi-select filters, comparison columns, collapsed targets, and estimated STR5 labels without replacing the existing roadmap module.

**Architecture:** Extend the existing roadmap types and persisted Zustand store, with migration functions accepting old two-part versions and scalar filters. Central formatting helpers own project names and business-visible tOS names so tables, evolution cards, audit history, and conflicts cannot diverge.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, existing Node verification scripts.

---

### Task 1: Add failing roadmap contracts

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `scripts/verify-roadmap-mock-seeds.mjs`

- [ ] **Step 1: Add project-name and tOS assertions**

Assert that:

```js
buildRoadmapDisplayName('CN6', 'Android 16', '新品') === 'CN6'
buildRoadmapDisplayName('CN6', 'Android 16', '老品') === 'CN6(Android 16)'
normalizeTosVersionName('17.2.0').patch === 0
formatTosVersionDisplay({ major: 17, minor: 2, patch: 0 }) === 'tOS 17.2'
formatTosVersionDisplay({ major: 15, minor: 2, patch: 1 }) === 'tOS 15.2.1'
```

Add source assertions for `str5Estimated`, `periodStartDate`, `periodEndDate`, multi-select filter values, inline version cards, default collapsed targets, and evolution-column filtering.

- [ ] **Step 2: Run the contract and confirm failure**

Run:

```bash
node scripts/verify-project-roadmap.mjs
```

Expected: failures for missing patch, display helper, multi-select and estimated STR5 contracts.

- [ ] **Step 3: Commit failing contracts**

```bash
git add scripts/verify-project-roadmap.mjs scripts/verify-roadmap-mock-seeds.mjs
git commit -m "test: define roadmap iteration contracts"
```

### Task 2: Upgrade roadmap data types, formatting and migration

**Files:**
- Modify: `src/types/roadmap.ts`
- Modify: `src/lib/roadmapValidation.ts`
- Modify: `src/lib/roadmapSorting.ts`
- Modify: `src/lib/roadmapProjectAdapter.ts`
- Modify: `src/lib/roadmapAudit.ts`
- Modify: `src/stores/roadmap.ts`

- [ ] **Step 1: Extend persistent types**

Add:

```ts
interface TosVersionConfig {
  id: string
  name: string
  major: number
  minor: number
  patch: number
  periodStartDate: string
  periodEndDate: string
  targets: string[]
  createdAt: string
  updatedAt: string
}

interface RoadmapProjectFields {
  // existing fields
  str5Estimated: boolean
}

type RoadmapFilterValue = string | string[]

interface RoadmapFilterCondition {
  id: string
  field: RoadmapColumnKey
  operator: RoadmapFilterOperator
  value: RoadmapFilterValue
}

interface CreateTosVersionInput {
  name: string
  periodStartDate?: string
  periodEndDate?: string
  targets?: string[]
}
```

- [ ] **Step 2: Implement canonical formatters**

In `roadmapValidation.ts`, normalize only three-part input for maintenance and expose:

```ts
export function formatTosVersionFull(version: Pick<TosVersionConfig, 'major' | 'minor' | 'patch'>) {
  return `tOS ${version.major}.${version.minor}.${version.patch}`
}

export function formatTosVersionDisplay(version: Pick<TosVersionConfig, 'major' | 'minor' | 'patch'>) {
  return version.major <= 15
    ? formatTosVersionFull(version)
    : `tOS ${version.major}.${version.minor}`
}
```

Keep migration parsing compatible with old `tOS 17.2` by supplying `patch = 0`.

- [ ] **Step 3: Make project names canonical**

Change `adaptNormalProject` to always use:

```ts
displayName: buildRoadmapDisplayName(projectCode, androidVersion, productType)
```

Use the same helper when creating audit records and conflict rows. Never use `project.name` as a roadmap display name.

- [ ] **Step 4: Upgrade store migration and CRUD**

Migration rules:

```ts
const patch = Number.isSafeInteger(entry.patch) ? Number(entry.patch) : parsed.patch ?? 0
const periodStartDate = trimStringValue(entry.periodStartDate)
const periodEndDate = trimStringValue(entry.periodEndDate)
const str5Estimated = input.str5Estimated === true
```

For new tOS versions with `major >= 16`, reject another entry with the same `major` and `minor`. Do not reject or merge pre-existing migrated duplicates.

- [ ] **Step 5: Run focused contracts**

Run:

```bash
node scripts/verify-project-roadmap.mjs
node scripts/verify-roadmap-mock-seeds.mjs
```

Expected: data, migration and formatting assertions pass; UI assertions may still fail.

- [ ] **Step 6: Commit**

```bash
git add src/types/roadmap.ts src/lib/roadmapValidation.ts src/lib/roadmapSorting.ts src/lib/roadmapProjectAdapter.ts src/lib/roadmapAudit.ts src/stores/roadmap.ts
git commit -m "feat: upgrade roadmap version data"
```

### Task 3: Implement multi-select filtering and evolution comparison

**Files:**
- Modify: `src/lib/roadmapFilters.ts`
- Modify: `src/components/roadmap/RoadmapFilterDrawer.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`

- [ ] **Step 1: Normalize scalar and array filter values**

Implement:

```ts
function normalizeFilterValues(value: string | string[]): string[] {
  return (Array.isArray(value) ? value : [value])
    .map(item => item.trim())
    .filter(Boolean)
}
```

For `enum`, `ram`, and `tos-version`, `equals` matches any selected value and `notEquals` matches none of the selected values. Other fields keep scalar behavior.

- [ ] **Step 2: Render multi-select controls**

For selectable definitions use:

```tsx
<Select
  mode="multiple"
  maxTagCount="responsive"
  value={normalizeFilterValues(condition.value)}
  onChange={value => updateCondition(condition.id, { value })}
/>
```

- [ ] **Step 3: Clear tOS filters on table-to-evolution transition**

Replace the direct toolbar setter with:

```ts
const handleViewModeChange = (next: RoadmapViewMode) => {
  if (viewMode === 'table' && next === 'evolution') {
    setSelectedTosVersionId(null)
    setFilters(filters.filter(condition => condition.field !== 'firstSaleTosVersionId'))
  }
  setViewMode(next)
}
```

- [ ] **Step 4: Filter evolution columns**

Derive selected IDs from the tOS condition and pass:

```ts
const visibleEvolutionVersions = selectedTosIds.length
  ? tosVersions.filter(version => selectedTosIds.includes(version.id))
  : tosVersions
```

Render only `visibleEvolutionVersions`, retaining semantic descending order.

- [ ] **Step 5: Run contract and commit**

```bash
node scripts/verify-project-roadmap.mjs
git add src/lib/roadmapFilters.ts src/components/roadmap/RoadmapFilterDrawer.tsx src/components/roadmap/ProjectRoadmapModule.tsx src/components/roadmap/RoadmapEvolutionView.tsx
git commit -m "feat: add roadmap multi-select comparison filters"
```

### Task 4: Replace tOS maintenance form with inline cards

**Files:**
- Modify: `src/components/roadmap/TosVersionMaintenanceModal.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`
- Delete: `src/components/roadmap/TosTargetEditor.tsx`

- [ ] **Step 1: Define one inline draft**

Use:

```ts
interface TosVersionCardDraft {
  id: string | null
  name: string
  period: [Dayjs, Dayjs] | null
  targets: string
}
```

Clicking “新增版本” sets a draft with `id: null`; clicking “编辑” copies the selected card. Only one draft exists.

- [ ] **Step 2: Render edit and read-only card states**

The edit card contains `Input`, `DatePicker.RangePicker`, multiline `Input.TextArea`, and right-aligned “取消、保存”. Read-only cards display the full three-part version, optional period and target summary, with only “编辑、删除”.

- [ ] **Step 3: Save atomically**

Send version, period and split multiline targets through `createTosVersion` or `renameTosVersion`. Validate the date range before mutation and keep the draft open on failure.

- [ ] **Step 4: Show period and business version labels**

Use `formatTosVersionDisplay` in table/evolution headings and `Tooltip` with `formatTosVersionFull`. Show the optional project period below the evolution version heading.

- [ ] **Step 5: Default targets to collapsed**

Initialize collapse state from all target-bearing versions:

```ts
const [collapsedTargetVersionIds, setCollapsedTargetVersionIds] = useState(
  () => new Set(tosVersions.filter(version => version.targets.length).map(version => version.id)),
)
```

- [ ] **Step 6: Run contract and commit**

```bash
node scripts/verify-project-roadmap.mjs
git add src/components/roadmap/TosVersionMaintenanceModal.tsx src/components/roadmap/ProjectRoadmapModule.tsx src/components/roadmap/RoadmapEvolutionView.tsx src/components/roadmap/RoadmapTableView.tsx src/components/roadmap/TosTargetEditor.tsx
git commit -m "feat: add inline tOS version cards"
```

### Task 5: Add estimated STR5 input and labels

**Files:**
- Modify: `src/components/roadmap/PlannedProjectModal.tsx`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`
- Modify: `src/stores/roadmap.ts`

- [ ] **Step 1: Add checkbox to form values**

Use:

```ts
type PlannedProjectFormValues =
  Omit<PlannedRoadmapProjectInput, 'str5Date' | 'launchDate'> & {
    str5Date: Dayjs
    launchDate: Dayjs
    str5Estimated: boolean
  }
```

Render the date and:

```tsx
<Form.Item name="str5Estimated" valuePropName="checked" noStyle>
  <Checkbox>预估</Checkbox>
</Form.Item>
```

- [ ] **Step 2: Persist the flag**

Submit `str5Estimated: values.str5Estimated === true`; editing old projects defaults to `false`.

- [ ] **Step 3: Render semantic tags**

After the formatted STR5 date render:

```tsx
{row.str5Estimated ? <Tag color="gold">预估</Tag> : null}
```

Apply the same rule in the table and evolution project card.

- [ ] **Step 4: Run contract and commit**

```bash
node scripts/verify-project-roadmap.mjs
git add src/components/roadmap/PlannedProjectModal.tsx src/components/roadmap/RoadmapTableView.tsx src/components/roadmap/RoadmapProjectCard.tsx src/stores/roadmap.ts
git commit -m "feat: mark estimated roadmap STR5 dates"
```

### Task 6: Fast integrated verification and local handoff

**Files:**
- Modify if required by failures: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Run focused automated gates**

```bash
node scripts/verify-project-roadmap.mjs
node scripts/verify-roadmap-mock-seeds.mjs
npx tsc --noEmit
```

Expected: all commands exit 0.

- [ ] **Step 2: Run production compile**

```bash
npm run build
```

Expected: Next.js compilation and static-page generation succeed.

- [ ] **Step 3: Browser smoke on local server**

Verify:

```text
CN6_H902 source project -> CN6 roadmap label
tOS 17.2.0 maintenance -> tOS 17.2 view label
tOS 15.2.1 maintenance -> tOS 15.2.1 view label
inline add/edit/cancel/save card
period in evolution header
targets initially collapsed
multi-select tOS -> matching evolution columns only
estimated STR5 -> gold 预估 tag
```

- [ ] **Step 4: Commit any verification-only adjustments**

```bash
git add scripts/verify-project-roadmap.mjs scripts/verify-roadmap-mock-seeds.mjs
git commit -m "test: verify roadmap fast iteration"
```

