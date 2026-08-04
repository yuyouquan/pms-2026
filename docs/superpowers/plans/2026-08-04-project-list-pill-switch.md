# Project List Pill Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the project-list view switch with the approved text-only white-selection pill design without changing view state, filtering, or fullscreen behavior.

**Architecture:** Keep the existing Ant Design `Segmented` component and `projectListView` store contract. Narrow the JSX labels to accessible text-only spans, then restyle the existing dedicated CSS selectors; protect the result with the existing source-contract script and finish with repository and browser gates.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, CSS, Node.js source-contract scripts

---

## File Structure

- Modify `scripts/verify-workbench-project-list.mjs`: define the failing text-only pill and CSS contract.
- Modify `src/containers/ProjectListContainer.tsx`: remove view-only icon imports and render the three text-only labels in the existing order.
- Modify `src/styles/globals.css`: implement the approved white-selection capsule rail, hover, focus, and typography states.

### Task 1: Lock and implement the text-only pill switch

**Files:**
- Modify: `scripts/verify-workbench-project-list.mjs:43-50,110-111`
- Modify: `src/containers/ProjectListContainer.tsx:6-10,446-468`
- Modify: `src/styles/globals.css:183-229`

- [ ] **Step 1: Replace the old icon/gradient assertions with the failing approved-design contract**

```js
assert.doesNotMatch(source, /AppstoreOutlined|CalendarOutlined|UnorderedListOutlined/, 'view switch is text only')
assert.match(source, /aria-label="列表视图">列表视图<\/span>[\s\S]*value: 'list'/, 'list is the first text-only option')
assert.match(source, /aria-label="卡片视图">卡片视图<\/span>[\s\S]*value: 'card'/, 'card is the second text-only option')
assert.match(source, /aria-label="日历视图">日历视图<\/span>[\s\S]*value: 'calendar'/, 'calendar is the third text-only option')
assert.match(styles, /\.pms-project-list-view-switch\.ant-segmented\s*\{[^}]*height:\s*36px[^}]*border-radius:\s*999px[^}]*background:\s*#f1f3fb/s, 'view switch uses the pill rail')
assert.match(styles, /\.pms-project-list-view-switch \.ant-segmented-item-selected\s*\{[^}]*color:\s*#4f46e5[^}]*background:\s*#fff[^}]*box-shadow:/s, 'selected view uses the white capsule')
assert.match(styles, /\.pms-project-list-view-switch \.ant-segmented-item:focus-visible\s*\{[^}]*outline:/s, 'view switch retains a visible keyboard focus')
```

- [ ] **Step 2: Run the contract and confirm it fails against the old switch**

Run: `node scripts/verify-workbench-project-list.mjs`

Expected: FAIL because the source still contains view icons and the CSS still uses `border-radius: 10px` plus a purple gradient selection.

- [ ] **Step 3: Remove the three view icons and render accessible text-only labels**

```tsx
import {
  FullscreenExitOutlined, FullscreenOutlined, PlusOutlined, SearchOutlined,
} from '@ant-design/icons'

options={[
  {
    label: <span className="pms-project-list-view-option" aria-label="列表视图">列表视图</span>,
    value: 'list',
  },
  {
    label: <span className="pms-project-list-view-option" aria-label="卡片视图">卡片视图</span>,
    value: 'card',
  },
  {
    label: <span className="pms-project-list-view-option" aria-label="日历视图">日历视图</span>,
    value: 'calendar',
  },
]}
```

- [ ] **Step 4: Apply the approved white-selection capsule styling**

```css
.pms-project-list-view-switch.ant-segmented {
  height: 36px;
  padding: 3px;
  color: #64748b;
  border: 1px solid #dfe3f5;
  border-radius: 999px;
  background: #f1f3fb;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 3px 10px rgba(67, 56, 202, 0.06);
}

.pms-project-list-view-switch .ant-segmented-item {
  min-height: 28px;
  border-radius: 999px;
  transition: color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}

.pms-project-list-view-switch .ant-segmented-item-label {
  min-height: 28px;
  padding-inline: 16px;
  line-height: 28px;
}

.pms-project-list-view-switch .ant-segmented-item-selected {
  color: #4f46e5;
  background: #fff;
  box-shadow: 0 2px 8px rgba(67, 56, 202, 0.14);
}

.pms-project-list-view-switch .ant-segmented-item:not(.ant-segmented-item-selected):hover {
  color: #4f46e5;
  background: rgba(255, 255, 255, 0.72);
}

.pms-project-list-view-switch .ant-segmented-item:focus-visible {
  outline: 2px solid rgba(79, 70, 229, 0.42);
  outline-offset: 1px;
}

.pms-project-list-view-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the focused contract and confirm it passes**

Run: `node scripts/verify-workbench-project-list.mjs`

Expected: PASS with `Workbench project-list source contract passed.`

- [ ] **Step 6: Commit the implementation**

```bash
git add scripts/verify-workbench-project-list.mjs src/containers/ProjectListContainer.tsx src/styles/globals.css
git commit -m "style: refine project list view switch"
```

### Task 2: Verify behavior and presentation

**Files:**
- Verify: `src/containers/ProjectListContainer.tsx`
- Verify: `src/styles/globals.css`

- [ ] **Step 1: Run the project-list regression contracts**

Run: `node scripts/verify-workbench-project-list.mjs && node scripts/verify-project-list-matrix.mjs`

Expected: both commands exit 0 and report their source contracts passed.

- [ ] **Step 2: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: exit 0 with no diagnostics.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js completes compilation, type checking, and static page generation successfully.

- [ ] **Step 4: Exercise the switch in the browser**

Open the project list and verify:

1. The control order is “列表视图 / 卡片视图 / 日历视图”.
2. No option contains an icon.
3. The selected option is a white capsule with purple text; hover and keyboard focus are visible.
4. Each option switches to the correct content immediately.
5. Existing filters remain unchanged after switching views.
6. List and calendar fullscreen controls still enter and exit correctly.
7. The browser console contains no new errors.

- [ ] **Step 5: Record verification in the handoff**

Report the exact contract, TypeScript, build, and browser results. Do not claim remote publication unless a later user request explicitly authorizes pushing or merging.
