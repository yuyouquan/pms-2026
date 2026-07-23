# System-wide Sortable Column Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing user-facing column-settings surface support real drag sorting while preserving visibility rules, fixed-left boundaries, draft apply/cancel semantics, and each view's independent configuration.

**Architecture:** Add a store-agnostic column-settings model and a shared dnd-kit list component. Keep each business surface responsible for persistence, but represent configuration consistently as a complete `order` plus a `visible` set; normalize old data at every read boundary and use the normalized order to build the actual table or card fields.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, `@dnd-kit/core`, `@dnd-kit/sortable`, Node verification scripts.

---

## File map

### New shared files

- `src/lib/columnSettings.ts` — generic types, historical-state normalization, fixed-left boundary enforcement, visibility validation, and definition ordering.
- `src/components/shared/SortableColumnSettings.tsx` — the single reusable sortable-list UI and draft apply/cancel/reset behavior.
- `scripts/verify-sortable-column-settings.mjs` — executable behavior tests for the pure helpers plus source-level integration assertions for every entry point.

### Existing shared/state files

- `src/styles/globals.css` — compact purple-glass list, handle, locked-row, and drag-overlay styles.
- `src/stores/plan.ts` — per-view `order + visible` configuration for project-space and config-center plan views.
- `src/types/roadmap.ts` — roadmap order state and column fixed/locked metadata.
- `src/stores/roadmap.ts` — persisted roadmap order per table/evolution view and migration of historical visible-only data.
- `src/lib/roadmapFilters.ts` — roadmap-specific normalization adapters.

### Existing user-facing entries

- `src/components/roadmap/RoadmapColumnSettingsDrawer.tsx`
- `src/components/roadmap/RoadmapTableView.tsx`
- `src/components/roadmap/RoadmapProjectCard.tsx`
- `src/components/roadmap/ProjectRoadmapModule.tsx`
- `src/containers/ProjectSpaceContainer.tsx`
- `src/containers/ConfigContainer.tsx`
- `src/components/plan/PlanModule.tsx`
- `src/app/share/plan/page.tsx`
- `src/components/plans/RequirementDevPlan.tsx`
- `src/components/plans/VersionTrainPlan.tsx`
- `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- `src/components/roadmap/MilestoneView.tsx`

## Task 1: Lock the shared behavior with failing verification

**Files:**
- Create: `scripts/verify-sortable-column-settings.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing helper and integration assertions**

Create a verifier that loads TypeScript helpers with the same `typescript.transpileModule + vm` approach already used by `scripts/verify-project-roadmap.mjs`. Its behavior cases must include the exact expectations below:

```js
const definitions = [
  { key: 'id', title: '序号', defaultVisible: true, hideable: false, fixed: 'left' },
  { key: 'name', title: '任务名称', defaultVisible: true, hideable: false },
  { key: 'owner', title: '责任人', defaultVisible: true },
  { key: 'status', title: '状态', defaultVisible: false },
]

assert.deepEqual(
  normalizeColumnSettings(definitions, {
    order: ['owner', 'unknown', 'owner', 'id'],
    visible: ['owner', 'unknown'],
  }),
  {
    order: ['id', 'owner', 'name', 'status'],
    visible: ['id', 'name', 'owner'],
  },
)

assert.deepEqual(
  moveColumnSetting(definitions, ['id', 'name', 'owner', 'status'], 'name', 'status'),
  ['id', 'owner', 'status', 'name'],
)

assert.deepEqual(
  moveColumnSetting(definitions, ['id', 'name', 'owner', 'status'], 'owner', 'id'),
  ['id', 'owner', 'name', 'status'],
)

assert.deepEqual(
  orderVisibleDefinitions(definitions, {
    order: ['id', 'status', 'name', 'owner'],
    visible: ['id', 'name', 'status'],
  }).map(column => column.key),
  ['id', 'status', 'name'],
)
```

Also assert that every entry file imports `SortableColumnSettings`, and that the roadmap table/card, plan table/Gantt, requirement plan, version train, summary board, and milestone view all consume an order value when producing display fields.

- [ ] **Step 2: Add one verification command**

Add this script without changing existing commands:

```json
{
  "scripts": {
    "verify:column-settings": "node scripts/verify-sortable-column-settings.mjs"
  }
}
```

- [ ] **Step 3: Run the verifier and confirm the intended failure**

Run:

```bash
npm run verify:column-settings
```

Expected: FAIL because `src/lib/columnSettings.ts` and the shared component do not exist.

- [ ] **Step 4: Commit the red test**

```bash
git add package.json scripts/verify-sortable-column-settings.mjs
git commit -m "test: define sortable column settings contract"
```

## Task 2: Build the shared model and sortable list

**Files:**
- Create: `src/lib/columnSettings.ts`
- Create: `src/components/shared/SortableColumnSettings.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-sortable-column-settings.mjs`

- [ ] **Step 1: Define the generic model and normalization helpers**

Implement these exported contracts:

```ts
export interface SortableColumnDefinition<Key extends string = string> {
  key: Key
  title: React.ReactNode
  defaultVisible: boolean
  hideable?: boolean
  fixed?: 'left'
  disabledReason?: string
}

export interface SortableColumnSettingsValue<Key extends string = string> {
  order: Key[]
  visible: Key[]
}

export function getDefaultColumnSettings<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
): SortableColumnSettingsValue<Key>

export function normalizeColumnSettings<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
  value?: Partial<SortableColumnSettingsValue<Key>> | readonly Key[] | null,
): SortableColumnSettingsValue<Key>

export function moveColumnSetting<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
  order: readonly Key[],
  activeKey: Key,
  overKey: Key,
): Key[]

export function orderVisibleDefinitions<Key extends string>(
  definitions: readonly SortableColumnDefinition<Key>[],
  value: SortableColumnSettingsValue<Key>,
): SortableColumnDefinition<Key>[]
```

`normalizeColumnSettings` must deduplicate known keys, prepend fixed-left keys in definition order, append missing keys, force non-hideable keys visible, and fall back to defaults when no optional business field remains visible. `moveColumnSetting` must return unchanged order when the active row is fixed-left and clamp non-fixed drops after the fixed prefix.

- [ ] **Step 2: Run the pure helper tests**

Run:

```bash
npm run verify:column-settings
```

Expected: helper assertions PASS; integration assertions still FAIL because entry points have not adopted the component.

- [ ] **Step 3: Implement the shared controlled component**

Use this public interface:

```ts
interface SortableColumnSettingsProps<Key extends string> {
  open: boolean
  definitions: readonly SortableColumnDefinition<Key>[]
  value: SortableColumnSettingsValue<Key>
  defaultValue?: SortableColumnSettingsValue<Key>
  minVisible?: number
  applyLabel?: string
  onApply: (value: SortableColumnSettingsValue<Key>) => void
  onCancel: () => void
}
```

The component must:

- reset its local draft from normalized `value` whenever `open` changes from false to true;
- use `PointerSensor`, `TouchSensor`, and `KeyboardSensor` with `sortableKeyboardCoordinates`;
- render a drag handle only for non-fixed rows;
- set `aria-label={`拖动${plainTitle}调整顺序`}` on that handle;
- keep non-hideable checkboxes checked and disabled;
- reject unchecking when it would violate `minVisible`;
- use `moveColumnSetting` in `onDragEnd`;
- reset only the draft when “重置” is clicked;
- call `onCancel` without writing the draft;
- call `onApply(normalizeColumnSettings(definitions, draft))` only when “确定/应用” is clicked.

- [ ] **Step 4: Add compact shared styling**

Add only shared selectors:

```css
.pms-sortable-column-list { display: flex; flex-direction: column; gap: 6px; }
.pms-sortable-column-row { min-height: 40px; display: grid; grid-template-columns: 28px 24px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid rgba(99, 102, 241, .12); border-radius: 10px; background: rgba(255, 255, 255, .72); }
.pms-sortable-column-row.is-dragging { box-shadow: 0 12px 28px rgba(79, 70, 229, .18); border-color: rgba(99, 102, 241, .45); }
.pms-sortable-column-handle { cursor: grab; color: #7c7a91; touch-action: none; }
.pms-sortable-column-handle:active { cursor: grabbing; }
.pms-sortable-column-fixed { color: #8b88a1; font-size: 12px; white-space: nowrap; }
```

- [ ] **Step 5: Type-check the shared unit**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit the shared capability**

```bash
git add src/lib/columnSettings.ts src/components/shared/SortableColumnSettings.tsx src/styles/globals.css
git commit -m "feat: add shared sortable column settings"
```

## Task 3: Integrate roadmap table and evolution views with persisted order

**Files:**
- Modify: `src/types/roadmap.ts`
- Modify: `src/lib/roadmapFilters.ts`
- Modify: `src/stores/roadmap.ts`
- Modify: `src/components/roadmap/RoadmapColumnSettingsDrawer.tsx`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Test: `scripts/verify-project-roadmap.mjs`
- Test: `scripts/verify-sortable-column-settings.mjs`

- [ ] **Step 1: Add failing roadmap order and migration assertions**

Extend the roadmap verifier to assert:

```js
store.getState().setColumnSettings({
  order: ['firstSaleTosVersionId', 'displayName', 'brand', 'remark'],
  visible: ['firstSaleTosVersionId', 'displayName', 'brand'],
})

assert.deepEqual(
  store.getState().columnOrderByView.table.slice(0, 4),
  ['firstSaleTosVersionId', 'displayName', 'brand', 'remark'],
)
assert.deepEqual(store.getState().visibleColumns, [
  'firstSaleTosVersionId',
  'displayName',
  'brand',
])
```

Add a hydration fixture containing duplicated/unknown order keys and assert that it becomes a complete known-key order with the table's fixed-left prefix restored.

- [ ] **Step 2: Run the roadmap verifier and confirm failure**

Run:

```bash
node scripts/verify-project-roadmap.mjs
```

Expected: FAIL because `columnOrderByView` and `setColumnSettings` are absent.

- [ ] **Step 3: Extend roadmap state without breaking old persisted data**

Add:

```ts
columnOrder: RoadmapColumnKey[]
columnOrderByView: Record<RoadmapViewMode, RoadmapColumnKey[]>
setColumnSettings: (value: SortableColumnSettingsValue<RoadmapColumnKey>) => void
```

Keep `visibleColumns` and `visibleColumnsByView` so old persisted state remains readable. During hydration, normalize:

```ts
const tableSettings = normalizeColumnSettings(roadmapDefinitions, {
  order: persistedOrderByView.table,
  visible: persistedVisibleByView.table ?? legacyVisibleColumns,
})
```

Persist both order arrays and visible arrays. Mark `firstSaleTosVersionId` fixed-left only in the table-view definitions; keep `displayName` non-hideable in evolution but draggable.

- [ ] **Step 4: Replace the roadmap drawer list**

Adapt `ROADMAP_COLUMNS` to shared definitions and render:

```tsx
<SortableColumnSettings
  open={open}
  definitions={definitions}
  value={{ order: columnOrder, visible: [...visibleColumns] }}
  defaultValue={defaultSettings}
  minVisible={1}
  applyLabel="应用"
  onApply={onChange}
  onCancel={onClose}
/>
```

Change the drawer callback to receive the full settings value. Do not write store state during drag, checkbox, or reset.

- [ ] **Step 5: Make the view order real**

In `RoadmapTableView`, replace definition-order filtering with:

```ts
const displayedColumns = orderVisibleDefinitions(ROADMAP_COLUMNS, {
  order: [...columnOrder],
  visible: [...visibleColumns],
})
```

In the evolution view, pass `columnOrder` into every `RoadmapProjectCard`. Keep the required `产品系列（项目名）` title outside the configurable field list, then render optional card fields with `orderVisibleDefinitions`.

- [ ] **Step 6: Run focused verification**

Run:

```bash
node scripts/verify-project-roadmap.mjs
npm run verify:column-settings
npx tsc --noEmit
```

Expected: all roadmap assertions PASS; the global verifier may still report only the not-yet-integrated non-roadmap entries.

- [ ] **Step 7: Commit roadmap integration**

```bash
git add src/types/roadmap.ts src/lib/roadmapFilters.ts src/stores/roadmap.ts src/components/roadmap/RoadmapColumnSettingsDrawer.tsx src/components/roadmap/RoadmapTableView.tsx src/components/roadmap/RoadmapProjectCard.tsx src/components/roadmap/RoadmapEvolutionView.tsx src/components/roadmap/ProjectRoadmapModule.tsx scripts/verify-project-roadmap.mjs
git commit -m "feat: sort roadmap columns and card fields"
```

## Task 4: Integrate project-space and config-center plan views

**Files:**
- Modify: `src/stores/plan.ts`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/containers/ConfigContainer.tsx`
- Test: `scripts/verify-sortable-column-settings.mjs`

- [ ] **Step 1: Add failing entry and rendering assertions**

Assert that both containers import `SortableColumnSettings`, read `columnSettingsByView`, and build their table/Gantt columns through `orderVisibleDefinitions`. Also assert `getColumnsForView('horizontal')` remains empty.

- [ ] **Step 2: Run the verifier and confirm failure**

Run:

```bash
npm run verify:column-settings
```

Expected: FAIL for the project-space and config-center contracts.

- [ ] **Step 3: Replace visible-only plan-store state**

Add:

```ts
columnSettingsByView: Record<string, SortableColumnSettingsValue<string>>
setColumnSettingsByView: (
  value: Record<string, SortableColumnSettingsValue<string>>
    | ((current: Record<string, SortableColumnSettingsValue<string>>) =>
        Record<string, SortableColumnSettingsValue<string>>)
) => void
```

Initialize `config-table`, `config-gantt`, `project-table`, and `project-gantt` with `getDefaultColumnSettings(getColumnsForView(mode))`. Do not create settings for horizontal views. Keep a compatibility read of `columnsByView` until both containers are migrated, then remove the old setter and state.

- [ ] **Step 4: Give plan definitions correct fixed/visibility metadata**

Use:

```ts
{ key: 'id', title: '序号', defaultVisible: true, hideable: false, fixed: 'left' }
{ key: 'taskName', title: '任务名称', defaultVisible: true, hideable: false }
```

All other plan fields remain hideable and draggable. The task-name row can move because it is non-hideable but not fixed-left.

- [ ] **Step 5: Integrate `ProjectSpaceContainer`**

Compute:

```ts
const columnSettings = normalizeColumnSettings(
  currentViewColumns,
  columnSettingsByView[getViewKey()],
)
const visibleColumns = columnSettings.visible
const orderedColumns = orderVisibleDefinitions(currentViewColumns, columnSettings)
```

Build table columns by iterating `orderedColumns` and selecting the existing column factory for each key; keep edit validation, renderers, and the system action column unchanged. Replace both duplicate column-setting modals in the file with the shared component and one `applyColumnSettings` callback.

- [ ] **Step 6: Integrate `ConfigContainer`**

Use the same view-key and normalized-settings pattern. Preserve the existing exclusion of `defaultRoadmap`, existing task row drag-and-drop, and existing edit renderers. The column-settings modal must update the store only from `onApply`.

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm run verify:column-settings
npx tsc --noEmit
```

Expected: project-space and config-center assertions PASS.

Commit:

```bash
git add src/stores/plan.ts src/containers/ProjectSpaceContainer.tsx src/containers/ConfigContainer.tsx scripts/verify-sortable-column-settings.mjs
git commit -m "feat: sort project plan columns"
```

## Task 5: Integrate the reusable plan module and share page

**Files:**
- Modify: `src/components/plan/PlanModule.tsx`
- Modify: `src/app/share/plan/page.tsx`
- Test: `scripts/verify-sortable-column-settings.mjs`

- [ ] **Step 1: Add failing assertions**

Assert that `PlanModule` accepts a `SortableColumnSettingsValue<string>`, uses order to build `TaskTable` columns, and renders the shared settings component. Assert that the share page maintains one settings value and applies changes only on confirmation.

- [ ] **Step 2: Confirm failure**

Run:

```bash
npm run verify:column-settings
```

Expected: FAIL for `PlanModule.tsx` and `src/app/share/plan/page.tsx`.

- [ ] **Step 3: Migrate `PlanModule`**

Replace `visibleColumns`/`setVisibleColumns` props at the settings boundary with:

```ts
columnSettings: SortableColumnSettingsValue<string>
setColumnSettings: (value: SortableColumnSettingsValue<string>) => void
```

Within `TaskTable`, derive:

```ts
const orderedVisibleKeys = orderVisibleDefinitions(ALL_COLUMNS, columnSettings)
  .map(column => column.key)
```

Map those keys to the existing column definitions. Preserve task-row sorting as a separate `DndContext`; the modal's column DnD context must remain nested inside the modal and must not share item IDs with task rows.

- [ ] **Step 4: Migrate the share page**

Initialize:

```ts
const [columnSettings, setColumnSettings] = useState(
  () => getDefaultColumnSettings(ALL_COLUMNS),
)
```

Pass the value into `TaskTable` and replace `tempColumns` plus the checkbox modal with `SortableColumnSettings`. Because the share page is local-state only, refresh may reset it exactly as before.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run verify:column-settings
npx tsc --noEmit
```

Expected: both entry assertions PASS.

Commit:

```bash
git add src/components/plan/PlanModule.tsx src/app/share/plan/page.tsx scripts/verify-sortable-column-settings.mjs
git commit -m "feat: sort shared plan columns"
```

## Task 6: Integrate requirement-development and version-train plans

**Files:**
- Modify: `src/components/plans/RequirementDevPlan.tsx`
- Modify: `src/components/plans/VersionTrainPlan.tsx`
- Test: `scripts/verify-sortable-column-settings.mjs`

- [ ] **Step 1: Add failing assertions**

Assert requirement IR and SR tabs keep separate settings, version train has one independent setting, both use the shared list, and both use order before filtering/rendering.

- [ ] **Step 2: Confirm failure**

Run:

```bash
npm run verify:column-settings
```

Expected: FAIL for both specialized plan components.

- [ ] **Step 3: Migrate requirement-development tabs independently**

Replace the two visible arrays with:

```ts
const [irColumnSettings, setIrColumnSettings] = useState(
  () => getDefaultColumnSettings(IR_ALL_COLUMNS),
)
const [srColumnSettings, setSrColumnSettings] = useState(
  () => getDefaultColumnSettings(SR_ALL_COLUMNS),
)
```

Select the active value/setter based on `activeTab`. Set the leftmost identifier column in each definition fixed-left and non-hideable; make any other required column non-hideable but draggable. Render actual table columns from `orderVisibleDefinitions`.

- [ ] **Step 4: Migrate version-train settings**

Replace `visibleColumns` with one normalized settings object. Mark its existing fixed-left identifier column fixed and non-hideable. Replace definition-order filtering:

```ts
return orderVisibleDefinitions(ALL_COLUMNS_DEF, columnSettings)
  .map(definition => allColsByKey.get(definition.key))
  .filter((column): column is ColumnsType<VersionTrainRow>[number] => Boolean(column))
```

Replace the checkbox modal with `SortableColumnSettings`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run verify:column-settings
npx tsc --noEmit
```

Expected: both specialized-plan assertions PASS.

Commit:

```bash
git add src/components/plans/RequirementDevPlan.tsx src/components/plans/VersionTrainPlan.tsx scripts/verify-sortable-column-settings.mjs
git commit -m "feat: sort specialized plan columns"
```

## Task 7: Integrate summary-board and legacy milestone saved views

**Files:**
- Modify: `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- Modify: `src/components/roadmap/MilestoneView.tsx`
- Modify: `src/components/roadmap/utils.ts`
- Test: `scripts/verify-project-view-requirements.mjs`
- Test: `scripts/verify-sortable-column-settings.mjs`

- [ ] **Step 1: Add failing saved-view and rendering assertions**

Add cases proving that a saved view with only `visibleColumns` loads with default order, a new saved view writes `columnOrder`, changing scope normalizes unavailable keys, and both tables render using the saved order.

- [ ] **Step 2: Confirm failure**

Run:

```bash
node scripts/verify-project-view-requirements.mjs
npm run verify:column-settings
```

Expected: FAIL because the two components do not store `columnOrder`.

- [ ] **Step 3: Add scope-aware normalization**

In roadmap utilities, expose:

```ts
export function getSafeColumnSettingsForScope(
  scope: RoadmapScope,
  value?: Partial<SortableColumnSettingsValue<string>> | readonly string[],
) {
  return normalizeColumnSettings(
    getAvailableColumnsForScope(scope).map(column => ({
      key: column.key,
      title: column.label,
      defaultVisible: column.locked || column.defaultVisible,
      hideable: !column.locked,
      fixed: column.fixed === 'left' ? 'left' : undefined,
    })),
    value,
  )
}
```

Update saved-view state to write `columnOrder` beside `visibleColumns`. When loading historical state without `columnOrder`, normalize the old visible array and use definition order.

- [ ] **Step 4: Migrate `ProjectPlanSummaryBoard`**

Replace the checkbox drawer with the shared component. When scope changes, normalize current settings against the new scope rather than resetting unrelated valid ordering. Build displayed fields with `orderVisibleDefinitions`; append non-configurable action columns after the ordered fields.

- [ ] **Step 5: Migrate `MilestoneView`**

Apply the identical saved-view migration and scope normalization, but retain its tOS/category/series spanning calculations. The order change must happen before span-dependent column objects are assembled so merged-cell indexes match visual order.

- [ ] **Step 6: Verify and commit**

Run:

```bash
node scripts/verify-project-view-requirements.mjs
npm run verify:column-settings
npx tsc --noEmit
```

Expected: all entry and saved-view assertions PASS.

Commit:

```bash
git add src/components/roadmap/ProjectPlanSummaryBoard.tsx src/components/roadmap/MilestoneView.tsx src/components/roadmap/utils.ts scripts/verify-project-view-requirements.mjs scripts/verify-sortable-column-settings.mjs
git commit -m "feat: sort summary board columns"
```

## Task 8: Full regression verification and browser acceptance

**Files:**
- Modify only if a discovered regression requires a focused fix in the files already listed above.

- [ ] **Step 1: Run every automated gate**

Run:

```bash
npm run verify:column-settings
node scripts/verify-project-roadmap.mjs
node scripts/verify-project-view-requirements.mjs
npx tsc --noEmit
node node_modules/next/dist/bin/next build
```

Expected: every command exits 0; the roadmap verifier retains at least its current 112 assertions plus the new order assertions.

- [ ] **Step 2: Start the isolated worktree locally**

Run:

```bash
npm run dev -- --port 3005
```

Expected: the app is reachable at `http://localhost:3005`.

- [ ] **Step 3: Exercise the shared interaction once in each entry family**

Check these exact behaviors:

1. Roadmap table: `tOS版本` remains fixed-left; another field cannot move ahead of it.
2. Roadmap evolution: required card title remains; a configurable field reorder changes every project card consistently.
3. Project-space table and Gantt: settings remain independent; cancel discards drag and checkbox changes.
4. Config-center plan: reset changes only the draft until confirm.
5. Share plan: hidden field reappears at its saved position.
6. Requirement plan: IR order does not overwrite SR order.
7. Version train: fixed identifier cannot be dragged.
8. Summary board and milestone: locked but non-fixed columns can move; saved-view reload restores order.
9. Keyboard: focus a drag handle, use Space and arrow keys, then Space to drop.

- [ ] **Step 4: Inspect fixed columns and operation columns**

Confirm operation, selection, and expand-control columns never appear in settings and remain in their original table positions. Confirm horizontal plan views still have no column-settings button.

- [ ] **Step 5: Commit any focused verification fixes**

If browser acceptance required changes, first inspect the exact remaining diff:

```bash
git status --short
git diff --check
```

Apply the fix in the owning task above, rerun that task's focused checks, and use that task's exact `git add` list with:

```bash
git commit -m "fix: preserve sortable column settings behavior"
```

Do not stage the pre-existing roadmap quick-fix files (`scripts/verify-project-roadmap.mjs`, `src/components/roadmap/RoadmapChangeLogDrawer.tsx`, `src/components/roadmap/RoadmapFilterDrawer.tsx`, or `src/constants/projectTypes.ts`) unless the acceptance fix intentionally changes the same reviewed hunk. If no files changed, skip this commit.

- [ ] **Step 6: Record final evidence**

Capture:

- `git status --short`
- `git log --oneline --max-count=8`
- command outputs for all five automated gates
- the local URL used for browser acceptance

Expected: only the previously known unrelated quick-fix work remains uncommitted; all sortable-column work is committed in focused commits.
