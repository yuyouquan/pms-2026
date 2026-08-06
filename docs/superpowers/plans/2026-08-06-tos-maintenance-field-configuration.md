# tOS Maintenance and Field Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore in-roadmap tOS version maintenance with two-part enum selection, place project-list fullscreen immediately after field configuration, and rename every user-visible column-settings label to field configuration.

**Architecture:** Reintroduce the focused `TosVersionMaintenanceModal` as a roadmap business editor while sourcing version choices through the existing enum hook. Keep all column-setting state and persistence APIs unchanged; only migrate presentation copy in the shared component and direct trigger implementations. Extend source-contract scripts so the restored modal, toolbar order, and global wording are independently verifiable.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand, Node source-contract scripts.

---

## File map

- Create `src/components/roadmap/TosVersionMaintenanceModal.tsx`: version list and inline create/edit form backed by the two-part enum.
- Modify `src/components/roadmap/ProjectRoadmapModule.tsx`: own Modal open state and render it instead of navigating to configuration.
- Modify `src/components/shared/SortableColumnSettings.tsx`: central user-facing “字段配置” copy.
- Modify direct trigger files in project list, roadmap, project plan and technical plan: replace remaining visible labels without renaming internal state.
- Modify `scripts/verify-project-roadmap.mjs`: assert Modal restoration and enum-backed selection.
- Modify `scripts/verify-workbench-project-list.mjs`: assert project-list action order and new copy.
- Modify `scripts/verify-floating-config-panels.mjs` and `scripts/verify-technical-plan.mjs`: assert shared/direct field-configuration copy.
- Create `scripts/verify-field-configuration-copy.mjs`: scan current user-facing source surfaces for old labels.

### Task 1: Add failing contracts for the restored roadmap maintenance flow

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`
- Create: `scripts/verify-field-configuration-copy.mjs`
- Modify: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Add the roadmap maintenance contract**

Add assertions requiring `ProjectRoadmapModule` to import and render `TosVersionMaintenanceModal`, open it from the toolbar, and avoid using `openSharedTosEnumConfig` for the normal maintenance action. Require the Modal source to include:

```js
assert.match(moduleSource, /import TosVersionMaintenanceModal from ['"]\.\/TosVersionMaintenanceModal['"]/)
assert.match(moduleSource, /onOpenTosMaintenance=\{\(\) => setTosMaintenanceOpen\(true\)\}/)
assert.match(modalSource, /useTosEnumOptions\(['"]tos-2-part['"]/)
assert.match(modalSource, /<Select[\s\S]*name="name"/)
```

- [ ] **Step 2: Add toolbar and global-copy contracts**

Require the project-list source to render the list-view actions in this order:

```js
assert.match(source, /筛选[\s\S]*字段配置[\s\S]*全屏/)
```

Create `scripts/verify-field-configuration-copy.mjs` to scan active source files and fail if user-facing patterns such as `>列设置<`, `title="列设置"`, `aria-label="列设置"`, `ariaLabel="列设置"`, or `列设置已保存` remain. The script must also assert that `SortableColumnSettings` contains `字段配置` and `搜索字段配置`.

- [ ] **Step 3: Run contracts and confirm failure**

Run:

```bash
node scripts/verify-project-roadmap.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-field-configuration-copy.mjs
```

Expected: FAIL because the current maintenance action navigates to configuration and old “列设置” copy remains.

- [ ] **Step 4: Commit failing contracts**

```bash
git add scripts/verify-project-roadmap.mjs scripts/verify-workbench-project-list.mjs scripts/verify-field-configuration-copy.mjs
git commit -m "test: define roadmap maintenance and field configuration contracts"
```

### Task 2: Restore enum-backed tOS version maintenance

**Files:**
- Create: `src/components/roadmap/TosVersionMaintenanceModal.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`

- [ ] **Step 1: Restore the version-maintenance component shell**

Restore the previous Modal responsibilities: sorted version list, inline create/edit card, period, technical-point text, reference counts, delete confirmation, submit lock and dirty-draft confirmation. Keep the public props:

```ts
interface TosVersionMaintenanceModalProps {
  open: boolean
  onCancel: () => void
  normalProjects: readonly ProjectItem[]
  plannedProjects: readonly PlannedRoadmapProject[]
  canEdit: boolean
  onChanged?: () => void
}
```

- [ ] **Step 2: Replace free text with enum-backed Select**

Load current and historical options:

```ts
const historicalValues = useMemo(
  () => tosVersions.map(version => version.id),
  [tosVersions],
)
const { options, hasHydrated, hydrationError, retryHydration } = useTosEnumOptions(
  'tos-2-part',
  historicalValues,
)
```

Render a labeled Select inside `Form.Item name="name"`, displaying `tOSxx.x`. Disable values already owned by a different roadmap version. Retain a deleted historical value as a disabled “已停用” option when editing that record.

- [ ] **Step 3: Preserve existing create/edit/delete behavior**

Submit normalized values through existing store actions:

```ts
const input = {
  name: formatTosEnumValue(values.name),
  periodStartDate,
  periodEndDate,
  targets: targetText ? [targetText] : [],
}
```

Use `createTosVersion` for create and `renameTosVersion` for edit. Keep project-reference deletion protection and explicit error messages for duplicate, invalid and missing values.

- [ ] **Step 4: Wire the Modal into the roadmap module**

Add state and rendering:

```tsx
const [tosMaintenanceOpen, setTosMaintenanceOpen] = useState(false)

<RoadmapToolbar
  onOpenTosMaintenance={() => setTosMaintenanceOpen(true)}
/>

<TosVersionMaintenanceModal
  open={tosMaintenanceOpen}
  onCancel={() => setTosMaintenanceOpen(false)}
  normalProjects={projects}
  plannedProjects={plannedProjects}
  canEdit={canEdit}
/>
```

Retain configuration navigation only in the enum hydration error recovery action.

- [ ] **Step 5: Run roadmap and enum contracts**

Run:

```bash
node scripts/verify-project-roadmap.mjs
node scripts/verify-enum-config.mjs
node scripts/verify-roadmap-mock-seeds.mjs
npx tsc --noEmit
```

Expected: all PASS.

- [ ] **Step 6: Commit the restored maintenance flow**

```bash
git add src/components/roadmap/TosVersionMaintenanceModal.tsx src/components/roadmap/ProjectRoadmapModule.tsx
git commit -m "fix: restore enum-backed tOS version maintenance"
```

### Task 3: Order project-list actions and migrate user-facing copy

**Files:**
- Modify: `src/components/shared/SortableColumnSettings.tsx`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`
- Modify: `src/components/roadmap/ProjectPlanSummaryBoard.tsx`
- Modify: `src/components/roadmap/MilestoneView.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/components/technical-project/TechnicalPlanModule.tsx`
- Modify: current source-contract scripts that assert the old visible label.

- [ ] **Step 1: Update shared field-configuration copy**

Change the shared presentation strings to:

```tsx
ariaLabel="字段配置"
<span>字段配置</span>
placeholder="搜索字段"
aria-label="搜索字段配置"
```

Keep `SortableColumnSettings`, `ColumnSettingsValue`, `columnOrder` and storage keys unchanged.

- [ ] **Step 2: Update direct triggers and feedback**

Replace user-visible tooltip, button, aria-label and success copy in direct implementations:

```tsx
<Tooltip title="字段配置">
  <Button aria-label="字段配置">字段配置</Button>
</Tooltip>
```

Change `message.success('列设置已保存')` to `message.success('字段配置已保存')`. Do not rename internal state such as `columnsOpen` or `setColumnSettings`.

- [ ] **Step 3: Place fullscreen after field configuration**

In the project-list toolbar, keep filtering first, render field configuration second, and render fullscreen immediately afterward for list view. Preserve existing card/calendar capability rules and the same click handlers.

- [ ] **Step 4: Update test wording**

Update source-contract expectations from old user-facing labels to `字段配置`, while leaving internal API assertions untouched.

- [ ] **Step 5: Run focused contracts**

Run:

```bash
node scripts/verify-workbench-project-list.mjs
node scripts/verify-floating-config-panels.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-field-configuration-copy.mjs
```

Expected: all PASS and the scanner reports no active user-facing “列设置” strings.

- [ ] **Step 6: Commit copy and toolbar changes**

```bash
git add src scripts
git commit -m "fix: align field configuration actions"
```

### Task 4: Full verification and browser exercise

**Files:**
- Modify only if verification finds a scoped defect.

- [ ] **Step 1: Run full static verification**

```bash
npx tsc --noEmit
npm run build
```

Expected: both exit 0.

- [ ] **Step 2: Run related regression scripts**

```bash
node scripts/verify-project-roadmap.mjs
node scripts/verify-enum-config.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-project-list-fullscreen.mjs
node scripts/verify-floating-config-panels.mjs
node scripts/verify-technical-plan.mjs
node scripts/verify-field-configuration-copy.mjs
```

Expected: all PASS.

- [ ] **Step 3: Browser verification**

Start the dev server and verify:

1. `tOS 路标 → tOS 版本维护` opens a Modal without changing the active module.
2. New/edit version uses two-part enum options and preserves disabled historical values.
3. Period, technical-point and delete behaviors remain usable.
4. Project-list list view displays `筛选 → 字段配置 → 全屏`; calendar omits field configuration; card omits fullscreen.
5. Field-configuration popovers open in normal and fullscreen modes without clipping.
6. Browser console contains no newly introduced errors.

- [ ] **Step 4: Review final diff and commit any verification fixes**

```bash
git status --short
git diff --check
git log --oneline --decorate -5
```

Expected: no conflict markers, no whitespace errors, and only scoped files differ from `origin/dev`.

## Self-review

- Spec coverage: all three requested changes map to Tasks 2 and 3; loading, historical values, permissions and fullscreen edge cases map to Tasks 2 and 4.
- Placeholder scan: no TBD, TODO or unspecified implementation steps.
- Type consistency: the Modal props, enum hook signature and existing store action names match current source.
- Scope: no persistence-key migration, configuration schema change or unrelated UI refactor.
