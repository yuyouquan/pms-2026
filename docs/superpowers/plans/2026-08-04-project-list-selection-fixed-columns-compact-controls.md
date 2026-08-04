# Project List Selection, Fixed Columns, and Compact Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align fixed project-list headers with their body cells, add coherent selected/expanded states, and render project-list filter inputs at Ant Design small size.

**Architecture:** Keep `ProjectSummaryTable` as the rendering owner and `projectListMatrix.ts` as the width source of truth. Lock the generated header and body cell styles to each field definition's width, derive row/group state classes from local selection and collapse state, and scope compact controls to project-list matrix variants so other shared summary surfaces do not change.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, CSS, Node source-contract scripts.

---

## File Map

- `scripts/verify-workbench-project-list.mjs` — source-level regression contract for project-list structure and scoped styling.
- `src/components/project-summary/ProjectSummaryTable.tsx` — generated column widths, selected-row state, expanded-series state, and advanced-filter control sizes.
- `src/containers/ProjectListContainer.tsx` — top quick-filter Input and Select sizes.
- `src/styles/globals.css` — fixed-cell surfaces, selected/expanded visuals, truncation, and reduced-motion behavior.

### Task 1: Define the regression contract

**Files:**
- Modify: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Add failing source assertions**

Add assertions requiring:

```js
assert.match(source, /<Input[\s\S]{0,120}size="small"[\s\S]{0,160}aria-label="快捷筛选-项目名称"/)
assert.match(source, /<Select[\s\S]{0,180}size="small"[\s\S]{0,180}aria-label=\{`快捷筛选-\$\{definition\.label\}`\}/)
assert.match(summarySource, /const compactControlSize = matrixVariant \? 'small' : 'middle'/)
assert.match(summarySource, /const \[selectedRowKey, setSelectedRowKey\] = useState\(''\)/)
assert.match(summarySource, /rowClassName=\{row =>/)
assert.match(summarySource, /width:\s*fieldWidth[\s\S]{0,120}minWidth:\s*fieldWidth[\s\S]{0,120}maxWidth:\s*fieldWidth/)
assert.match(styles, /\.pms-project-summary-table \.pms-project-summary-row\.is-selected/)
assert.match(styles, /\.pms-project-series-cell\.is-expanded/)
```

- [ ] **Step 2: Run the contract and confirm failure**

Run:

```bash
node scripts/verify-workbench-project-list.mjs
```

Expected: FAIL on the first missing compact-control or selected-row assertion.

### Task 2: Lock fixed-column widths and state visuals

**Files:**
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx:183-188,424-490,752-775`
- Modify: `src/styles/globals.css:274-367`
- Test: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Add local selection state and stale-selection cleanup**

Add:

```tsx
const [selectedRowKey, setSelectedRowKey] = useState('')

useEffect(() => {
  if (selectedRowKey && !displayedRows.some(row => row.key === selectedRowKey)) {
    setSelectedRowKey('')
  }
}, [displayedRows, selectedRowKey])
```

- [ ] **Step 2: Apply one width to generated columns and cells**

When mapping each table column, derive `fieldWidth` from the matching field definition and merge it into the column plus its header/body callbacks:

```tsx
const fieldWidth = field?.width ?? 140
const lockedWidth = { width: fieldWidth, minWidth: fieldWidth, maxWidth: fieldWidth }
const baseHeaderCell = column.onHeaderCell?.({} as never) ?? {}
const baseCell = column.onCell

const sizedColumn = {
  ...column,
  width: fieldWidth,
  onHeaderCell: () => ({
    ...baseHeaderCell,
    style: { ...baseHeaderCell.style, ...lockedWidth },
  }),
  onCell: (record: ProjectSummaryRow) => {
    const cell = baseCell?.(record, 0) ?? {}
    return { ...cell, style: { ...cell.style, ...lockedWidth } }
  },
}
```

Preserve the product-series `rowSpan`, class name, and fixed setting when composing its specialized cell callback.

- [ ] **Step 3: Render explicit row and expanded-group classes**

Use:

```tsx
rowClassName={row => [
  'pms-project-summary-row',
  selectedRowKey === row.key ? 'is-selected' : '',
].filter(Boolean).join(' ')}
```

Set `selectedRowKey` before calling the existing navigation callback. Add `is-expanded` to the product-series cell and toggle button when its group is not collapsed, and wrap the full series name in `Tooltip` while retaining ellipsis in the visible label.

- [ ] **Step 4: Add scoped state and alignment CSS**

Add project-summary rules that:

```css
.pms-project-summary-table .ant-table-cell {
  box-sizing: border-box;
}

.pms-project-summary-table .pms-project-summary-row.is-selected > td,
.pms-project-summary-table .pms-project-summary-row.is-selected > td.ant-table-cell-fix-left {
  background: #eef0ff !important;
}

.pms-project-series-cell.is-expanded,
.pms-project-series-cell.is-expanded .pms-project-series-toggle {
  background: #f3f4ff !important;
}
```

Use an inset left accent on the first visible fixed cell, keep hover opaque on fixed cells, remove the white inner block from expanded series, and retain single-line ellipsis with Tooltip access to the full name.

- [ ] **Step 5: Run the contract**

Run:

```bash
node scripts/verify-workbench-project-list.mjs
```

Expected: width and state assertions pass; compact-control assertions may remain failing until Task 3.

### Task 3: Use small project-list filter controls

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx:520-607`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx:430-738`
- Modify: `src/styles/globals.css:216-271`
- Test: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Compact top quick filters**

Add `size="small"` to both project-name Inputs and every quick-filter Select rendered by `ProjectListContainer`. Keep `maxTagCount={1}` and the existing nowrap overflow rules.

- [ ] **Step 2: Compact matrix-scoped advanced filters**

Define:

```tsx
const compactControlSize = matrixVariant ? 'small' : 'middle'
```

Pass `size={compactControlSize}` to the advanced-filter field Select, operator Select, enum/multiple Select, text Input, disabled Input, and DatePicker. Do not change controls when `matrixVariant` is absent.

- [ ] **Step 3: Keep control heights visually aligned**

Scope project-list action buttons and condition-row delete buttons to the small-control height without changing global buttons. Preserve one-line multi-select overflow.

- [ ] **Step 4: Run the contract**

Run:

```bash
node scripts/verify-workbench-project-list.mjs
```

Expected: `workbench project-list contract passed`.

### Task 4: Verify behavior and build

**Files:**
- Verify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Verify: `src/containers/ProjectListContainer.tsx`
- Verify: `src/styles/globals.css`

- [ ] **Step 1: Run project-list and summary contracts**

```bash
node scripts/verify-workbench-project-list.mjs
node scripts/verify-project-list-matrix.mjs
node scripts/verify-project-summary.mjs
```

Expected: all scripts print their pass summaries and exit 0.

- [ ] **Step 2: Run static validation**

```bash
npx tsc --noEmit
git diff --check
```

Expected: both commands exit 0 without output.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: Next.js reports `Compiled successfully` and all static routes finish generating.

- [ ] **Step 4: Verify in the browser**

Open the project list in list view and verify:

1. `产品系列` and `项目名称` header/body boundaries stay aligned before and after horizontal scrolling.
2. Long series names remain one line and expose the complete value on hover.
3. An expanded series and a selected project row use coherent light-purple surfaces with no white inner block.
4. Quick and advanced filter inputs are small height; multiple selections stay on one line.
5. No console errors appear during expansion, selection, filtering, and horizontal scrolling.

- [ ] **Step 5: Commit implementation**

```bash
git add scripts/verify-workbench-project-list.mjs src/components/project-summary/ProjectSummaryTable.tsx src/containers/ProjectListContainer.tsx src/styles/globals.css
git commit -m "fix: polish project list alignment and controls"
```
