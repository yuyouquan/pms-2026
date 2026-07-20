# Project Information UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the whole-machine and tOS project information surfaces with a single-row project header, two-row plan metrics, reference-style information sections, Drawer-based field configuration, and three-column forms that hide derived fields.

**Architecture:** Keep the schema, stores, permissions, and preference repository unchanged. Refactor presentation inside the existing project-info components, introduce one focused plan-metric component to keep `ProjectSpaceContainer` small, and centralize the responsive/motion rules in `globals.css`.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, CSS Grid.

---

### Task 1: Hide derived fields and polish the three-column project form

**Files:**
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/project-info/ProjectInfoFieldInput.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Derive the editable field set**

Add a memoized field collection and use it for rendered group counts and controls while keeping `fields` for persistence:

```tsx
const editableFields = useMemo(
  () => fields.filter(field => !field.readOnly),
  [fields],
)
```

- [ ] **Step 2: Remove the automatic core controls**

Delete the current `coreItems` block. Render `healthStatus` with project name, project type, and project responsibility in the universal grid only for whole-machine and tOS projects:

```tsx
{isTargetProjectInfoType(projectType) && (
  <Form.Item label="健康状态" name="healthStatus" initialValue="normal" rules={[{ required: true, message: '请选择健康状态' }]}>
    <Select options={HEALTH_OPTIONS} />
  </Form.Item>
)}
```

Do not render `marketName`, `brand`, `productLine`, `status`, `currentNode`, `cancelPauseDate`, or any schema field whose `readOnly` property is true. Keep `applySourceValues` and `form.setFieldsValue` unchanged so hidden derived values remain in the form store.

- [ ] **Step 3: Prevent hidden automatic fields from producing unreachable errors**

Filter pure validation errors to editable fields before applying them:

```tsx
const editableFieldKeys = new Set(editableFields.map(field => field.key))
const pureErrors = validateProjectInfoValues(projectType, infoValues, {
  tosAggregateMissingSources: aggregateWarnings,
}).filter(error => editableFieldKeys.has(error.fieldKey))
```

- [ ] **Step 4: Render three-column section cards**

Use `editableFields` inside each group and add `pms-project-info-form-collapse` plus a group tone class. Keep JIRA rows at `grid-column: 1 / -1`.

```tsx
const groupFields = editableFields.filter(field => field.group === group.key)
```

Set Modal width to `1240`, replace `destroyOnClose` with `destroyOnHidden`, and keep the body scroll limit.

- [ ] **Step 5: Add responsive form styling**

Update `.pms-project-info-form-grid` to three columns, two columns below 1100px, and one column below 768px. Add group surface, title, read/write input focus, and reduced-motion rules without changing Ant Design validation classes.

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit`

Expected: exit code 0.

```bash
git add src/components/project-info/ProjectInfoModal.tsx src/components/project-info/ProjectInfoFieldInput.tsx src/styles/globals.css
git commit -m "feat: polish project information forms"
```

### Task 2: Replace field Popovers with a preference Drawer

**Files:**
- Modify: `src/components/project-info/FieldVisibilityPicker.tsx`
- Modify: `src/components/project-info/ProjectInfoSections.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Extend the picker contract with a group label**

Add `groupLabel: string` to `FieldVisibilityPickerProps` and pass `group.label` from `ProjectInfoSections`.

- [ ] **Step 2: Replace Popover state with a Drawer draft**

Use local state so cancel does not persist changes:

```tsx
const [open, setOpen] = useState(false)
const [draftKeys, setDraftKeys] = useState<string[]>(visibleFieldKeys)
const openDrawer = (event: React.MouseEvent) => {
  event.stopPropagation()
  setDraftKeys(visibleFieldKeys)
  setOpen(true)
}
```

The Drawer uses `width={420}`, `placement="right"`, title `配置字段 · ${groupLabel}`, vertical checkboxes, and a footer with “重置默认 / 取消 / 确定”. Determine reset values with:

```tsx
const defaultKeys = fields
  .filter(field => !field.hideable || field.defaultVisible)
  .map(field => field.key)
```

Only “确定” calls `onChange(draftKeys)`.

- [ ] **Step 3: Show field states clearly**

Render “必显” for non-hideable fields and “满足条件时显示” for conditional fields. Preserve the disabled permission Tooltip and stop Drawer trigger clicks from toggling the Collapse panel.

- [ ] **Step 4: Add Drawer-specific styling**

Add a grouped checkbox row style with a 44px minimum hit area, hover background, muted hints, and visible keyboard focus. Do not modify the preference hook or repository.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`

Expected: exit code 0.

```bash
git add src/components/project-info/FieldVisibilityPicker.tsx src/components/project-info/ProjectInfoSections.tsx src/styles/globals.css
git commit -m "feat: move project field settings to drawer"
```

### Task 3: Polish project header and information sections

**Files:**
- Modify: `src/components/project-info/TargetProjectInformationView.tsx`
- Modify: `src/components/project-info/ProjectInfoSections.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Rename the header and keep core fields on one row**

Change the Card title from “核心板块” to “项目名称” while keeping the actual project name as the subtitle. Keep `coreFields` ordering unchanged.

```tsx
<div>项目名称</div>
<span>{project.name}</span>
```

Style `.pms-project-info-core-grid` with column flow and `overflow-x: auto`; each item uses `minmax(128px, 1fr)` so fields never wrap to another row.

- [ ] **Step 2: Apply the reference-style section header**

Wrap each group Collapse in a tone class (`basic`, `extended`, `team`). Use a 36px icon surface, strong title, neutral count pill, and aligned field-config action.

- [ ] **Step 3: Improve field and role grids**

Use six columns for basic/extended fields on wide desktop, four below 1500px, two below 1100px, and one below 640px. Preserve borders between cells. Keep team roles as cards with avatar, name, and role.

- [ ] **Step 4: Add meaningful micro-interactions**

Add 180–240ms border/shadow hover transitions, icon surface feedback, and content fade/translate on expansion. Disable transforms and animation under `prefers-reduced-motion: reduce`.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`

Expected: exit code 0.

```bash
git add src/components/project-info/TargetProjectInformationView.tsx src/components/project-info/ProjectInfoSections.tsx src/styles/globals.css
git commit -m "feat: refine project information cards"
```

### Task 4: Unify whole-machine plan metrics into two rows

**Files:**
- Create: `src/components/project-info/ProjectPlanInfoGrid.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Create a focused metric-grid component**

Define the component contract with nine display values:

```tsx
export interface ProjectPlanInfoGridProps {
  planStartDate?: string
  planEndDate?: string
  developCycle?: string | number
  googleLaunchDate?: string
  isCarrierCustomized?: string
  isSimLocked?: string
  isCancelPaused?: string
  cancelPauseDate?: string
  isMadaControlled?: string
}
```

Build a stable array in the required order and render every item with the same `pms-project-plan-metric` structure. Boolean values use Ant Design Tags with text, so state is not color-only.

- [ ] **Step 2: Replace mixed Statistic and Descriptions markup**

In the whole-machine market tab, replace the existing `Row` of three Statistics and six-item `Descriptions` with:

```tsx
<ProjectPlanInfoGrid
  planStartDate={p.planStartDate}
  planEndDate={p.planEndDate}
  developCycle={p.developCycle}
  googleLaunchDate={row.googleLaunchDate}
  isCarrierCustomized={row.isCarrierCustomized}
  isSimLocked={row.isSimLocked}
  isCancelPaused={row.isCancelPaused}
  cancelPauseDate={row.isCancelPaused === '是' ? row.cancelPauseDate : ''}
  isMadaControlled={row.isMadaControlled}
/>
```

- [ ] **Step 3: Add two-row responsive styling**

Use five equal columns on desktop so nine values render as 5+4. Use three columns below 1280px, two below 900px, and one below 560px. Keep every metric at the same height and use tabular figures for dates and durations.

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit`

Expected: exit code 0.

```bash
git add src/components/project-info/ProjectPlanInfoGrid.tsx src/containers/ProjectSpaceContainer.tsx src/styles/globals.css
git commit -m "feat: unify whole machine plan metrics"
```

### Task 5: Focused browser verification and production gate

**Files:**
- Verify only; modify the responsible component if a regression is found.

- [ ] **Step 1: Run static verification**

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 and all application routes generated.

- [ ] **Step 2: Verify whole-machine project space**

Open `http://127.0.0.1:3004`, enter `X6877-D8400_H991`, and confirm:

- Header says “项目名称”; core items remain on one row.
- Basic, extended, and team sections match the card hierarchy and animate on expand.
- Field settings open in a Drawer; cancel does not save and confirm persists across returning to the project.
- Nine plan values share one visual style and occupy two rows on desktop.

- [ ] **Step 3: Verify create and edit forms**

Open create and edit forms for whole-machine and tOS projects. Confirm three-column desktop layout, editable-field-only rendering, edit backfill, and no labels for automatic fields such as market name, brand, product line, project status, or next node.

- [ ] **Step 4: Verify responsive and motion behavior**

At 1024px confirm no page-level horizontal overflow except the intentional core-field scroller. At 768px confirm form grids reduce columns. Emulate reduced motion and confirm project-info transitions are disabled.

- [ ] **Step 5: Final diff check**

Run: `git diff --check`

Expected: exit code 0.

Commit any focused verification fix with a component-specific message; otherwise leave the verified commits unchanged.
