# Project List Layout Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align “关于我的”、active filter conditions, and field-visibility controls according to the approved project-list UI.

**Architecture:** Keep all existing Zustand filter and column-setting state unchanged. Add semantic row classes in `ProjectListContainer`, render “关于我的” inside the category-appropriate row, and use explicit CSS grid-column placement for field-setting controls.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, CSS, Node source-contract scripts.

---

### Task 1: Add failing layout contracts

**Files:**
- Modify: `scripts/verify-workbench-project-list.mjs`
- Modify: `scripts/verify-sortable-column-settings.mjs`

- [ ] **Step 1: Add project-list row assertions**

Assert that the secondary and technical-type rows use a shared semantic class, contain the `Checkbox`, and that the active-filter host follows the status row:

```js
assert.match(source, /className="pms-project-list-secondary-row"[\s\S]*?<Checkbox[\s\S]*?>关于我的<\/Checkbox>/)
assert.match(source, /className="pms-project-list-technical-type-row"[\s\S]*?<Checkbox[\s\S]*?>关于我的<\/Checkbox>/)
assert.match(source, /aria-label="状态快捷筛选"[\s\S]*?className="pms-project-list-filter-summary-row"/)
```

- [ ] **Step 2: Add field-control alignment assertions**

Assert that the required badge and visibility control occupy explicit grid columns:

```js
assert.match(styles, /\.pms-sortable-column-required\s*\{[^}]*grid-column:\s*3/s)
assert.match(styles, /\.pms-sortable-column-visibility\s*\{[^}]*grid-column:\s*4/s)
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
npm run verify:workbench-list
npm run verify:column-settings
```

Expected: FAIL because the new row classes and explicit grid columns do not exist.

### Task 2: Align project-list filter rows

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx:480-570`
- Modify: `src/styles/globals.css:6050-6070`

- [ ] **Step 1: Extract the reusable checkbox element**

Create one local `aboutMineControl` JSX value before the return body:

```tsx
const aboutMineControl = (
  <Checkbox
    className="pms-project-list-about-mine"
    checked={aboutMineOnly}
    onChange={event => { setAboutMineOnly(event.target.checked); setProjectCardPage(1) }}
  >关于我的</Checkbox>
)
```

- [ ] **Step 2: Place checkbox in the correct row**

Use `pms-project-list-secondary-row` for the secondary-category row and render `aboutMineControl` after its options. Use `pms-project-list-technical-type-row` for the technical project-type row and render the same control after its options. Remove the standalone `pms-project-list-about-mine-row` block.

- [ ] **Step 3: Keep filter summary directly below status**

Move `pms-project-list-filter-summary-row` immediately after the status row and before the technical project-type row. Retain `ref={setProjectListFilterSummaryHost}` unchanged.

- [ ] **Step 4: Add stable flex alignment**

```css
.pms-project-list-secondary-row,
.pms-project-list-technical-type-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.pms-project-list-about-mine {
  flex: 0 0 auto;
  margin-left: auto;
  padding-inline: 8px 4px;
  white-space: nowrap;
}

.pms-project-list-filter-summary-row {
  box-sizing: border-box;
  min-width: 0;
  min-height: 24px;
  padding-left: 96px;
  padding-right: 4px;
}
```

- [ ] **Step 5: Run project-list test**

Run: `npm run verify:workbench-list`

Expected: PASS.

### Task 3: Align field visibility controls

**Files:**
- Modify: `src/styles/globals.css:6175-6220`

- [ ] **Step 1: Pin badge and visibility columns**

```css
.pms-sortable-column-required { grid-column: 3; }
.pms-sortable-column-visibility { grid-column: 4; justify-self: end; }
```

The explicit fourth-column placement ensures rows without a required badge do not shift the eye icon left.

- [ ] **Step 2: Run field-setting test**

Run: `npm run verify:column-settings`

Expected: PASS.

### Task 4: Verify the complete change

**Files:**
- No production file changes expected.

- [ ] **Step 1: Run focused contracts**

```bash
npm run verify:workbench-list
npm run verify:column-settings
npm run verify:compact-ui-density
```

Expected: all commands exit 0.

- [ ] **Step 2: Run type and build gates**

```bash
npx tsc --noEmit
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Browser-check the three project categories**

Verify whole-product and tOS put “关于我的” at the far right of the secondary row; technical puts it at the far right of the project-type row; active conditions render below status; field-setting eye controls form one vertical line.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-workbench-project-list.mjs scripts/verify-sortable-column-settings.mjs src/containers/ProjectListContainer.tsx src/styles/globals.css
git commit -m "fix: align project list filters and field controls"
```
