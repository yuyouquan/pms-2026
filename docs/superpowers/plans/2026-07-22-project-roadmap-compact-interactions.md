# Project Roadmap Compact Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress the roadmap control area and add a title-level tOS selector, sticky tOS column, raw multiline targets with collapse controls, application fullscreen, and one-source quick/advanced filters.

**Architecture:** Keep roadmap business data and permissions unchanged. Add pure filter synchronization helpers in `roadmapFilters`, keep collapse/fullscreen as transient state in `ProjectRoadmapModule`, and pass explicit interaction props into the existing toolbar/table/evolution components. Preserve the current persisted tOS target shape by storing one raw multiline string in `targets` while rendering all legacy entries joined by newlines.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, styled-jsx/global CSS, repository verification scripts.

**Execution override:** The user requested a fast iteration. Implement the tasks in one continuous pass, use focused regression assertions for the six requested behaviors, then run one TypeScript check and one browser smoke pass. Do not run a production build or per-task review unless a focused check reveals a problem.

---

## File map

- Modify `src/lib/roadmapFilters.ts`: quick-filter conversion and synchronization helpers.
- Modify `src/stores/roadmap.ts`: synchronize legacy quick state with unified filter conditions during actions and hydration.
- Modify `src/components/roadmap/ProjectRoadmapModule.tsx`: transient fullscreen/target-collapse state and integration props.
- Modify `src/components/roadmap/RoadmapToolbar.tsx`: compact controls, custom quick state, fullscreen and evolution batch-collapse actions.
- Modify `src/components/roadmap/RoadmapTableView.tsx`: title selector, sticky tOS column, raw target text, collapse, blank normal actions.
- Modify `src/components/roadmap/RoadmapEvolutionView.tsx`: raw target text and per-version collapse.
- Modify `src/components/roadmap/TosTargetEditor.tsx`: single raw multiline input.
- Modify `src/styles/globals.css`: scoped compact/fullscreen styling.
- Modify `scripts/verify-project-roadmap.mjs`: behavior and source-contract regression coverage.

### Task 1: Unify quick and drawer filters

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `src/lib/roadmapFilters.ts`
- Modify: `src/stores/roadmap.ts`

- [ ] **Step 1: Write failing filter synchronization assertions**

Add an assertion that imports the real helpers and verifies replacement, clearing, custom display, and legacy migration:

```js
registerAssertion('roadmap quick filters and drawer conditions share one source', () => {
  const filters = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'))
  const brandEquals = filters.setRoadmapQuickFilter([], 'brand', 'TECNO')
  if (brandEquals.length !== 1 || brandEquals[0].operator !== 'equals' || brandEquals[0].value !== 'TECNO') {
    throw new Error('brand quick filter did not create an equals condition')
  }
  if (filters.getRoadmapQuickFilterValue(brandEquals, 'brand') !== 'TECNO') {
    throw new Error('drawer equals condition did not select the quick value')
  }
  const custom = [{ ...brandEquals[0], operator: 'notEquals' }]
  if (filters.getRoadmapQuickFilterValue(custom, 'brand') !== 'custom') {
    throw new Error('non-equals drawer condition did not expose custom state')
  }
  if (filters.setRoadmapQuickFilter(custom, 'brand', 'all').length !== 0) {
    throw new Error('quick all did not clear the drawer condition')
  }
})
```

- [ ] **Step 2: Run the assertion and verify RED**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL because `setRoadmapQuickFilter` and `getRoadmapQuickFilterValue` do not exist.

- [ ] **Step 3: Implement pure synchronization helpers**

Add to `roadmapFilters.ts`:

```ts
export type RoadmapQuickFilterField = 'brand' | 'productType'
export type RoadmapQuickFilterValue = 'all' | 'custom' | RoadmapBrand | RoadmapProductType

export function getRoadmapQuickFilterValue(
  filters: readonly RoadmapFilterCondition[],
  field: RoadmapQuickFilterField,
): RoadmapQuickFilterValue {
  const condition = filters.find(candidate => candidate.field === field)
  if (!condition) return 'all'
  return condition.operator === 'equals' && condition.value ? condition.value as RoadmapQuickFilterValue : 'custom'
}

export function setRoadmapQuickFilter(
  filters: readonly RoadmapFilterCondition[],
  field: RoadmapQuickFilterField,
  value: Exclude<RoadmapQuickFilterValue, 'custom'>,
): RoadmapFilterCondition[] {
  const remaining = filters.filter(condition => condition.field !== field)
  if (value === 'all') return remaining
  const existing = filters.find(condition => condition.field === field)
  return [...remaining, {
    id: existing?.id ?? `roadmap-quick-${field}`,
    field,
    operator: 'equals',
    value,
  }]
}
```

Update the roadmap store setters so `setBrandFilter` / `setProductTypeFilter` replace the matching condition, while `setFilters` derives legacy quick fields as exact values or `all`. During migration, convert a legacy non-`all` quick field into an `equals` condition only when that field has no existing drawer condition.

- [ ] **Step 4: Use only unified conditions for filtering**

In `ProjectRoadmapModule`, derive toolbar values with `getRoadmapQuickFilterValue(normalizedFilters, field)` and route clicks through `setRoadmapQuickFilter` + `setFilters`. Call `applyRoadmapFilters` with `all` for both legacy quick arguments so the condition array is the sole effective source.

- [ ] **Step 5: Run focused verification and commit**

Run: `node scripts/verify-project-roadmap.mjs && node scripts/verify-filter-conditions.mjs`

Expected: PASS.

Commit:

```bash
git add scripts/verify-project-roadmap.mjs src/lib/roadmapFilters.ts src/stores/roadmap.ts src/components/roadmap/ProjectRoadmapModule.tsx
git commit -m "fix: unify roadmap filter controls"
```

### Task 2: Replace target rows with raw multiline text

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `src/components/roadmap/TosTargetEditor.tsx`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`

- [ ] **Step 1: Write the failing target-text contract**

Add source assertions requiring a single `targetText` form field, no `Form.List`, and pre-wrapped display:

```js
registerAssertion('roadmap targets preserve raw multiline text', () => {
  const editor = fs.readFileSync(path.join(root, 'src/components/roadmap/TosTargetEditor.tsx'), 'utf8')
  const table = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')
  const evolution = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
  if (!editor.includes('targetText') || editor.includes('<Form.List')) throw new Error('target editor is not one multiline field')
  for (const source of [table, evolution]) {
    if (!source.includes("whiteSpace: 'pre-wrap'") || !source.includes("targets.join('\\n')")) {
      throw new Error('target text is not rendered with original line breaks')
    }
  }
})
```

- [ ] **Step 2: Run the assertion and verify RED**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL because the editor still uses `Form.List` and the views render `<ul>` lists.

- [ ] **Step 3: Implement one TextArea without changing the persisted type**

Use this form shape:

```ts
interface TosTargetFormValues { targetText: string }

form.setFieldsValue({ targetText: version?.targets.join('\n') ?? '' })
const targetText = values.targetText ?? ''
const result = setTosTargets(version.id, targetText.trim() ? [targetText] : [])
```

Render one `Input.TextArea` with `rows={8}`, `showCount`, and a 2000-character limit. Replace target lists in table/evolution with:

```tsx
<Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
  {version.targets.join('\n')}
</Typography.Paragraph>
```

- [ ] **Step 4: Run focused verification and commit**

Run: `node scripts/verify-project-roadmap.mjs && npx tsc --noEmit`

Expected: PASS.

Commit:

```bash
git add scripts/verify-project-roadmap.mjs src/components/roadmap/TosTargetEditor.tsx src/components/roadmap/RoadmapTableView.tsx src/components/roadmap/RoadmapEvolutionView.tsx
git commit -m "feat: preserve multiline roadmap targets"
```

### Task 3: Add target collapse state and controls

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`

- [ ] **Step 1: Write failing collapse assertions**

Require `collapsedTargetVersionIds`, per-version toggle, batch toggle, and `aria-expanded` in the real components.

- [ ] **Step 2: Run verification and confirm RED**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL on missing collapse contracts.

- [ ] **Step 3: Add transient collapse state to the module**

Use an empty set for default-expanded behavior:

```ts
const [collapsedTargetVersionIds, setCollapsedTargetVersionIds] = useState<Set<string>>(() => new Set())
const targetVersionIds = versions.filter(version => version.targets.length).map(version => version.id)
const allTargetsCollapsed = targetVersionIds.length > 0
  && targetVersionIds.every(id => collapsedTargetVersionIds.has(id))
const toggleTarget = (id: string) => setCollapsedTargetVersionIds(current => {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
})
const toggleAllTargets = () => setCollapsedTargetVersionIds(
  allTargetsCollapsed ? new Set() : new Set(targetVersionIds),
)
```

Pass the set and handlers through `RoadmapViewRenderContext`. Prune IDs no longer present after tOS maintenance.

- [ ] **Step 4: Add accessible table and evolution controls**

Table target header receives a compact icon/text button with `aria-expanded={!collapsed}`. Evolution target headers receive the same per-version control. In evolution mode only, the toolbar shows `收起全部目标` or `展开全部目标` and calls the batch handler.

- [ ] **Step 5: Run focused verification and commit**

Run: `node scripts/verify-project-roadmap.mjs && npx tsc --noEmit`

Expected: PASS.

Commit:

```bash
git add scripts/verify-project-roadmap.mjs src/components/roadmap/ProjectRoadmapModule.tsx src/components/roadmap/RoadmapToolbar.tsx src/components/roadmap/RoadmapTableView.tsx src/components/roadmap/RoadmapEvolutionView.tsx
git commit -m "feat: collapse roadmap targets"
```

### Task 4: Compact the toolbar and add application fullscreen

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write failing compact/fullscreen assertions**

Require the toolbar to expose `isFullscreen`, `onToggleFullscreen`, `FullscreenOutlined`, `FullscreenExitOutlined`, and the module to use `pms-roadmap-shell-fullscreen`, Escape handling, and body scroll restoration.

- [ ] **Step 2: Run verification and confirm RED**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL on missing fullscreen contracts.

- [ ] **Step 3: Implement module-level fullscreen**

Add `isFullscreen` state and restore the previous body overflow value on exit/unmount. Handle Escape only when no visible Ant Design modal/drawer is above the shell. Toggle the class:

```tsx
<section className={`pms-roadmap-shell${isFullscreen ? ' pms-roadmap-shell-fullscreen' : ''}`}>
```

Use a shell z-index below Ant Design overlays:

```css
.pms-roadmap-shell-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 12px;
  background: var(--bg-page);
}
```

- [ ] **Step 4: Compact toolbar controls**

Remove the table tOS selector from `RoadmapToolbar`. Use medium controls, 36px visual height, 8px container padding, and 6–8px gaps. Add an icon-plus-label fullscreen button with `aria-pressed={isFullscreen}` and ensure custom quick filter status remains visible.

- [ ] **Step 5: Run focused verification and commit**

Run: `node scripts/verify-project-roadmap.mjs && npx tsc --noEmit`

Expected: PASS.

Commit:

```bash
git add scripts/verify-project-roadmap.mjs src/components/roadmap/ProjectRoadmapModule.tsx src/components/roadmap/RoadmapToolbar.tsx src/styles/globals.css
git commit -m "feat: add compact fullscreen roadmap"
```

### Task 5: Move the tOS selector and fix table columns/actions

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`

- [ ] **Step 1: Write failing table-layout assertions**

Require `RoadmapTableView` to import/render `Select`, mark `firstSaleTosVersionId` as `fixed: 'left'`, and return `null` for normal-project actions. Require `RoadmapToolbar` not to contain the table selector label.

- [ ] **Step 2: Run verification and confirm RED**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL because the selector is still in the toolbar and the normal action reads “只读”.

- [ ] **Step 3: Build the title row and sticky column**

Sort versions semantic-descending and render the selector in the table title row:

```tsx
<Select
  aria-label="表单视图 tOS 版本"
  value={version?.id}
  options={descendingVersions.map(item => ({ label: item.name, value: item.id }))}
  onChange={onSelectedTosVersionChange}
  disabled={!descendingVersions.length}
  style={{ width: 156 }}
/>
```

Set the business column property:

```ts
fixed: column.key === 'firstSaleTosVersionId' ? 'left' : undefined,
```

Return `null` when `row.source !== 'planned'`. Keep the action column fixed right for planned edit/delete.

- [ ] **Step 4: Run focused verification and commit**

Run: `node scripts/verify-project-roadmap.mjs && npx tsc --noEmit`

Expected: PASS.

Commit:

```bash
git add scripts/verify-project-roadmap.mjs src/components/roadmap/RoadmapTableView.tsx src/components/roadmap/RoadmapToolbar.tsx
git commit -m "feat: refine roadmap table controls"
```

### Task 6: Integration and browser verification

**Files:**
- Modify if required: `src/styles/globals.css`
- Modify if required: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Run all repository gates**

Run sequentially:

```bash
node scripts/verify-roadmap-view-cleared.mjs
node scripts/verify-project-roadmap.mjs
node scripts/verify-filter-conditions.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Exercise the browser at desktop width**

At `http://localhost:3004/`, verify:

- Compact toolbar occupies one short row at 1440px.
- Table selector sits in the title row.
- tOS column stays left while horizontally scrolling; operation stays right.
- Normal rows have blank action cells.
- Raw target text preserves line breaks.
- Table target folds independently.
- Evolution target folds individually and all targets fold/expand together.
- Fullscreen works for both views and Escape exits when no overlay is open.
- Quick filters and drawer conditions update each other, including custom state.

- [ ] **Step 3: Exercise responsive and accessibility states**

Verify 1024px and 375px layouts, keyboard focus, `aria-expanded`, `aria-pressed`, internal scrolling, and reduced-motion behavior. Intentional table/evolution horizontal scrolling must remain inside their own containers rather than widening the page.

- [ ] **Step 4: Request one consolidated review**

Dispatch one reviewer for requirement and runtime consistency. Fix all Critical/Important findings, then rerun Step 1.

- [ ] **Step 5: Commit final integration fixes**

```bash
git add scripts/verify-project-roadmap.mjs src/components/roadmap src/lib/roadmapFilters.ts src/stores/roadmap.ts src/styles/globals.css
git commit -m "feat: finish compact roadmap interactions"
```
