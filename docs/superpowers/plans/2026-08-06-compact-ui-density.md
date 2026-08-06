# Compact UI Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved 12px compact density system across PMS and make the project list table, cards, calendar, view switch, actions, and field configuration fit substantially more content on screen.

**Architecture:** Add contract verification first, then centralize global Ant Design density through CSS variables and scoped overrides. Keep project-list-specific geometry in `ProjectListContainer.tsx` and its CSS, and change the shared `SortableColumnSettings` component to emit valid normalized settings immediately instead of staging them behind footer actions.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand, CSS, Node contract scripts.

---

### Task 1: Define compact-density contracts

**Files:**
- Create: `scripts/verify-compact-ui-density.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add failing source contracts**

Create a script that asserts the project card page size, five-column large-screen layout, icon view labels, icon-only fullscreen action, immediate column-setting application, and shared density tokens:

```js
assert.match(projectListSource, /const projectCardPageSize = 15/)
assert.match(projectListSource, /xxl=\{\{ flex: '0 0 20%' \}\}/)
assert.match(columnSettingsSource, /onApply\(nextValue\)/)
assert.doesNotMatch(columnSettingsSource, />取消</)
assert.match(globalStyles, /--pms-table-row-height: 34px/)
assert.match(globalStyles, /--pms-control-height: 28px/)
```

- [ ] **Step 2: Run the contract and confirm failure**

Run: `node scripts/verify-compact-ui-density.mjs`

Expected: FAIL because the new compact geometry is not implemented yet.

- [ ] **Step 3: Register the verification command**

Add to `package.json`:

```json
"verify:compact-ui-density": "node scripts/verify-compact-ui-density.mjs"
```

### Task 2: Make field configuration immediate

**Files:**
- Modify: `src/components/shared/SortableColumnSettings.tsx`
- Test: `scripts/verify-compact-ui-density.mjs`

- [ ] **Step 1: Replace footer application with a normalized emit helper**

Use a helper that updates local state and calls `onApply` in the same interaction:

```ts
const commitDraft = (next: SortableColumnSettingsValue<Key>) => {
  const normalized = normalizeColumnSettings(definitions, next)
  setDraft(normalized)
  onApply(normalized)
}
```

- [ ] **Step 2: Apply visibility, reset, and drag changes immediately**

Replace `setDraft` calls in `handleDragEnd`, `handleVisibilityChange`, and `handleReset` with `commitDraft(nextValue)`. Preserve `minVisible` and non-hideable checks.

- [ ] **Step 3: Remove footer actions**

Set the popover footer to `null`, remove the unused `Space`, `applyLabel`, `applyDisabled`, and `handleApply` code, while retaining close behavior through the popover trigger.

- [ ] **Step 4: Run the contract**

Run: `node scripts/verify-compact-ui-density.mjs`

Expected: Field-configuration assertions pass; project-list geometry assertions still fail.

### Task 3: Compact the project-list toolbar and actions

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-compact-ui-density.mjs`

- [ ] **Step 1: Add Ant Design icons to view options**

Use existing icons:

```tsx
label: <span className="pms-project-list-view-option"><UnorderedListOutlined />列表视图</span>
label: <span className="pms-project-list-view-option"><AppstoreOutlined />卡片视图</span>
label: <span className="pms-project-list-view-option"><CalendarOutlined />日历视图</span>
```

- [ ] **Step 2: Keep icons on named actions and make fullscreen icon-only**

Keep `PlusOutlined`, `FilterOutlined`, and `SettingOutlined` before their labels. Render fullscreen as a square small button with `FullscreenOutlined`, Tooltip, and `aria-label`, without child text.

- [ ] **Step 3: Apply compact toolbar geometry**

Add scoped styles with 8px outer spacing, 6px by 8px filter padding, 2px row gaps, 28px controls, 12px text, and a 28px capsule switch.

- [ ] **Step 4: Run the contract**

Run: `node scripts/verify-compact-ui-density.mjs`

Expected: Toolbar and action assertions pass.

### Task 4: Compact cards and calendar

**Files:**
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/components/workspace/WorkspaceModule.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-compact-ui-density.mjs`

- [ ] **Step 1: Change card pagination to 15**

```ts
const projectCardPageSize = 15
```

- [ ] **Step 2: Use five columns on large screens**

Render each card column as:

```tsx
<Col xs={24} sm={12} md={8} xl={6} xxl={{ flex: '0 0 20%' }}>
```

Use `gutter={[8, 8]}` and apply the same breakpoints to standard, TDT, and subproject cards.

- [ ] **Step 3: Compact card content**

Change `ProjectCard` body padding to `10px`, title to 12px, metadata gaps to 4px, and remove excessive vertical margins. Apply equivalent rules to `.pms-technical-project-card`.

- [ ] **Step 4: Fit the full calendar in the remaining viewport**

Use a six-row grid and viewport-based body height:

```css
.pms-project-list-calendar {
  height: calc(100dvh - var(--pms-project-list-calendar-offset));
  min-height: 480px;
}
.pms-project-list-calendar .pms-project-calendar-grid {
  grid-template-rows: repeat(6, minmax(0, 1fr));
}
```

Set header to 36px, weekdays to 28px, cells to `min-height: 0`, events to 20px, and cap displayed events to the available compact stack.

- [ ] **Step 5: Run the contract**

Run: `npm run verify:compact-ui-density`

Expected: PASS.

### Task 5: Apply the global table and control density

**Files:**
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-compact-ui-density.mjs`

- [ ] **Step 1: Add shared density tokens**

```css
:root {
  --pms-font-size-compact: 12px;
  --pms-control-height: 28px;
  --pms-table-head-height: 32px;
  --pms-table-row-height: 34px;
  --pms-density-gap: 6px;
}
```

- [ ] **Step 2: Normalize all Ant Design tables**

Apply 12px text, 6px by 10px padding, and explicit 32px/34px heights to `.ant-table-wrapper` headers and body cells. Apply the same geometry to `.pms-table` and fixed cells. Preserve zero-height measure rows.

- [ ] **Step 3: Normalize compact controls**

Apply 28px height and 12px font size to small/default buttons, inputs, selects, pickers, input numbers, pagination items, toolbar controls, and table edit controls. Keep text areas and mobile controls exempt from 28px limits.

- [ ] **Step 4: Protect mobile touch targets**

Inside the mobile media query, restore controls to at least 32px and allow filter wrapping.

- [ ] **Step 5: Run verification**

Run: `npm run verify:compact-ui-density && npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

### Task 6: Browser and production verification

**Files:**
- Modify if defects are found: affected files above

- [ ] **Step 1: Run existing contracts**

Run:

```bash
npm run verify:compact-ui-density
npm run verify:collapsible-sidebars
npm run verify:enum-config
npm run verify:todo-center
node scripts/verify-project-list-matrix.mjs
node scripts/verify-workbench-project-list.mjs
node scripts/verify-project-space-permission-matrix.mjs
node scripts/verify-technical-project.mjs
```

Expected: every script exits 0.

- [ ] **Step 2: Verify in browser**

At 1920x1080 and 1440x900, measure:

- Header-to-filter gap at most 8px.
- Toolbar controls 28px and text 12px.
- Table header near 32px and data row near 34px.
- Five cards per row and 15-item pagination.
- Full six-week calendar visible in the viewport.
- Field changes apply immediately with no footer actions.
- At least one project-plan table and the todo table use the compact global density without clipping.

- [ ] **Step 3: Run production checks**

Run:

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit 0; Next.js generates all static pages.

- [ ] **Step 4: Commit implementation**

```bash
git add package.json scripts/verify-compact-ui-density.mjs src/components/shared/SortableColumnSettings.tsx src/containers/ProjectListContainer.tsx src/components/workspace/WorkspaceModule.tsx src/styles/globals.css docs/superpowers/plans/2026-08-06-compact-ui-density.md
git commit -m "feat: apply compact ui density"
```

- [ ] **Step 5: Promote verified commit**

Fast-forward `origin/dev`, merge `origin/dev` into a clean `origin/master` worktree, rerun the verification commands, push `master`, and confirm `origin/dev` is an ancestor of `origin/master`.
