# Project List Primary Columns Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the whole-machine project list primary fixed columns visually aligned and readable, and replace the weak view switch with a clear icon-and-label segmented control.

**Architecture:** Keep `ProjectSummaryTable` as the shared rendering kernel and `projectListMatrix` as the single source of column widths. Add source-contract assertions before changing production code, then use matrix widths plus narrowly scoped CSS to defeat the later global Ant Design cell-padding override; retain Ant Design `Segmented` for state and accessibility while replacing only its option content and visual treatment.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, CSS, Node assertion scripts, Playwright CLI.

---

### Task 1: Lock the fixed-column visual contract

**Files:**
- Modify: `scripts/verify-workbench-project-list.mjs`
- Test: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Write the failing contract assertions**

Add assertions requiring the machine matrix to declare `productSeries` at `160px` and `projectName` at `220px`, and requiring scoped CSS for full-width group cells, identical fixed-column horizontal padding, one-line ellipsis, and a lightweight fixed-boundary shadow.

```js
assert.match(matrixSource, /required\('productSeries', '产品系列', 160\)/)
assert.match(matrixSource, /required\('projectName', '项目名称', 220\)/)
assert.match(styles, /\.pms-table\.pms-project-summary-table[^}]*td\.pms-project-series-cell[^}]*padding:\s*0\s*!important/s)
assert.match(styles, /\.pms-project-summary-table \.pms-project-series-toggle\s*\{[^}]*box-sizing:\s*border-box[^}]*width:\s*100%/s)
assert.match(styles, /\.pms-project-summary-table \.ant-table-cell\.pms-project-name-cell[^}]*padding-inline:\s*16px\s*!important/s)
assert.match(source, /UnorderedListOutlined/)
assert.match(source, /AppstoreOutlined/)
assert.match(source, /CalendarOutlined/)
assert.match(styles, /\.pms-project-list-view-switch\.ant-segmented\s*\{[^}]*height:\s*36px[^}]*border-radius:\s*10px/s)
assert.match(styles, /\.pms-project-list-view-switch \.ant-segmented-item-selected\s*\{[^}]*linear-gradient[^}]*color:\s*#fff/s)
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `node scripts/verify-workbench-project-list.mjs`

Expected: FAIL because the current matrix still uses the default `140px` product-series width, the scoped cell rules do not exist, and the view switch has no icons or selected gradient.

- [ ] **Step 3: Commit the failing contract together with the passing implementation in Task 2**

The repository uses source-contract scripts rather than a test runner; keep the red evidence in the execution log and commit after green.

### Task 2: Align widths and render full-width fixed cells

**Files:**
- Modify: `src/lib/projectListMatrix.ts`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-workbench-project-list.mjs`

- [ ] **Step 1: Set widths at the matrix source**

Change the machine fixed fields to:

```ts
required('productSeries', '产品系列', 160),
required('projectName', '项目名称', 220),
```

- [ ] **Step 2: Give the project-name column a stable semantic class and Tooltip**

When constructing the field column, append `pms-project-name-cell` to the header and body cell class names for `projectName`. Render the value with a `pms-project-name-text` span wrapped in an Ant Design Tooltip so long values remain accessible.

- [ ] **Step 3: Override the actual root-cause CSS locally**

Add selectors scoped to `.pms-table.pms-project-summary-table` after the generic table rules so the group cell has `padding: 0 !important`, the series button uses `box-sizing: border-box; width: 100%; height: 100%`, and both project-name header/body cells use `padding-inline: 16px !important`. Keep names on one line with ellipsis and reduce the fixed-column boundary shadow.

- [ ] **Step 4: Run the focused contract and verify GREEN**

Run: `node scripts/verify-workbench-project-list.mjs`

Expected: PASS with the new width and CSS assertions satisfied.

- [ ] **Step 5: Run adjacent project-list contracts**

Run:

```bash
node scripts/verify-project-list-matrix.mjs
node scripts/verify-project-summary.mjs
```

Expected: both scripts exit 0.

### Task 3: Verify visual geometry and interactions

**Files:**
- No production files
- Browser artifacts: `output/playwright/` (remove temporary screenshots before commit)

- [ ] **Step 1: Run type and build verification**

Run:

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit 0; the existing caniuse-lite warning is non-blocking.

- [ ] **Step 2: Start or reuse the feature-worktree dev server**

Use an available local port and confirm the served checkout is this worktree.

- [ ] **Step 3: Measure browser geometry**

Using Playwright CLI, open the project list in list view and measure:

- product-series header and first visible body cell both equal `160px`;
- project-name header and body cell both equal `220px`;
- corresponding left and right boundaries differ by no more than `1px`;
- the series button fills the body cell content box with no inherited outer padding;
- long product-series and project-name text remains one line and exposes full text by Tooltip.

- [ ] **Step 4: Exercise interactions**

Collapse and expand a product series, then click a project row. Confirm the group button does not navigate, the row click still navigates/selects, and fixed-column selection backgrounds cover complete cells. Switch among list, card and calendar views and confirm the selected icon-label segment is visually clear, keyboard focus remains visible, and the control does not change the category-row height.

- [ ] **Step 5: Commit the implementation**

```bash
git add scripts/verify-workbench-project-list.mjs src/lib/projectListMatrix.ts src/components/project-summary/ProjectSummaryTable.tsx src/styles/globals.css
git commit -m "fix: refine project list primary columns"
```
