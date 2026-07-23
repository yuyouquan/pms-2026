# Roadmap All-tOS and Evolution Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the table view default to an “全部” tOS scope and refine evolution cards with locked titles, brand colors, and colored version-type tags.

**Architecture:** Use `selectedTosVersionId = null` as the single “全部” state and keep it synchronized with the absence of a `firstSaleTosVersionId` filter condition. Treat the evolution card title as structural content backed by locked column keys, while leaving all other card details controlled by the current evolution column configuration.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, focused Node verifier.

---

### Task 1: Add the “全部” tOS table scope

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `src/stores/roadmap.ts`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`

- [ ] **Step 1: Write the failing verifier assertion**

Add an assertion that requires initial `selectedTosVersionId` to be `null`, requires selecting `null` to remove the `firstSaleTosVersionId` condition, and requires the table selector to expose a first option with value `all`.

```js
registerAssertion('table view defaults to the all-tOS scope', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  if (store.getState().selectedTosVersionId !== null) throw new Error('default tOS scope is not all')
  store.getState().setSelectedTosVersionId('tos-17-2')
  store.getState().setSelectedTosVersionId(null)
  if (store.getState().filters.some(condition => condition.field === 'firstSaleTosVersionId')) {
    throw new Error('all-tOS scope retained a version condition')
  }
})
```

- [ ] **Step 2: Run the verifier and confirm RED**

Run:

```bash
node scripts/verify-project-roadmap.mjs
```

Expected: FAIL because the initial store selects `tos-18-0` and null selection repairs to the highest version.

- [ ] **Step 3: Implement the all-tOS state**

Change selection repair so null and invalid IDs resolve to null, initialize the store with null selection, and make `setSelectedTosVersionId(null)` remove the version condition.

```ts
function repairSelectedTosVersionId(
  selectedTosVersionId: string | null | undefined,
  tosVersions: readonly TosVersionConfig[],
): string | null {
  if (!selectedTosVersionId) return null
  return tosVersions.some(version => version.id === selectedTosVersionId)
    ? selectedTosVersionId
    : null
}
```

In `RoadmapTableView`, prepend `{ label: '全部', value: 'all' }`, map `all` to `onSelectedTosVersionChange(null)`, show every filtered row when selection is null, and hide the single-version target controls in that state.

- [ ] **Step 4: Run the focused verifier**

Run:

```bash
node scripts/verify-project-roadmap.mjs
```

Expected: the new all-tOS assertion passes; update obsolete assertions that explicitly required fallback to `tos-18-0` so they now require null.

### Task 2: Lock and style evolution card headers

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `src/lib/roadmapFilters.ts`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapColumnSettingsDrawer.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`

- [ ] **Step 1: Write the failing card assertion**

Require a structural card-title formatter, locked evolution columns, three brand color classes, and version-type Tag mappings.

```js
registerAssertion('evolution cards keep locked titles and approved colors', () => {
  const card = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'), 'utf8')
  const evolution = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
  for (const token of ['formatEvolutionCardTitle', "Full: 'blue'", "Slim: 'gold'", "Go: 'cyan'"]) {
    if (!card.includes(token)) throw new Error(`card is missing ${token}`)
  }
  for (const token of ['brand-tecno', 'brand-infinix', 'brand-itel']) {
    if (!evolution.includes(token)) throw new Error(`brand styling is missing ${token}`)
  }
})
```

- [ ] **Step 2: Run the verifier and confirm RED**

Run:

```bash
node scripts/verify-project-roadmap.mjs
```

Expected: FAIL because card title locking, brand-label colors, and Tag mappings do not yet exist.

- [ ] **Step 3: Implement locked evolution fields**

Export the locked keys and include them in evolution defaults:

```ts
export const ROADMAP_EVOLUTION_LOCKED_COLUMNS: RoadmapColumnKey[] = [
  'productSeries',
  'displayName',
]
```

Pass these keys to `RoadmapColumnSettingsDrawer` only in evolution mode. The drawer must merge locked keys into draft/apply values and render their checkboxes checked and disabled.

- [ ] **Step 4: Implement title, brand, and version tags**

Format card titles with full-width parentheses and fallback dashes:

```ts
export function formatEvolutionCardTitle(row: RoadmapProjectRow): string {
  return `${row.productSeries.trim() || '—'}（${row.displayName.trim() || '—'}）`
}
```

Exclude `productSeries` and `displayName` from detail rows, place the title and source tag in one non-wrapping flex row, and render `versionType` through this map:

```ts
const VERSION_TYPE_TAG_COLORS = {
  Full: 'blue',
  Slim: 'gold',
  Go: 'cyan',
} as const
```

Apply `.brand-tecno`, `.brand-infinix`, and `.brand-itel` classes to both the brand dot and brand label.

In `RoadmapTableView`, render the project name and “待规划” Tag in one non-wrapping flex row; give the name `min-width: 0`, `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap`, while the Tag remains non-shrinking.

- [ ] **Step 5: Run the focused verifier**

Run:

```bash
node scripts/verify-project-roadmap.mjs
```

Expected: all project-roadmap assertions pass.

### Task 3: Verify the integrated interaction

**Files:**
- Verify only; no planned production edits.

- [ ] **Step 1: Run static checks**

```bash
node node_modules/typescript/bin/tsc --noEmit
node scripts/verify-filter-conditions.mjs
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Run a lightweight browser smoke**

At `http://localhost:3004`, confirm:

1. Table view opens with “全部” selected and shows rows from more than one tOS version.
2. Selecting one version adds the matching drawer condition; selecting “全部” removes it.
3. Evolution column settings lock 产品系列 and 项目名.
4. Evolution cards show `产品系列（项目名）`, colored brand labels, and colored Full/Slim/Go tags without wrapping the source tag.
5. Table project names and their “待规划” tags stay on one line.

- [ ] **Step 3: Commit the implementation**

```bash
git add scripts/verify-project-roadmap.mjs src/stores/roadmap.ts src/lib/roadmapFilters.ts src/components/roadmap/ProjectRoadmapModule.tsx src/components/roadmap/RoadmapTableView.tsx src/components/roadmap/RoadmapColumnSettingsDrawer.tsx src/components/roadmap/RoadmapEvolutionView.tsx src/components/roadmap/RoadmapProjectCard.tsx
git commit -m "feat: refine roadmap scopes and evolution cards"
```
