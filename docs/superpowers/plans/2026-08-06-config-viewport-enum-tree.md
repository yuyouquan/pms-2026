# Config Viewport and Enum Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep configuration pages within the visible viewport and replace oversized enum cards with a compact scalable tree.

**Architecture:** Retain `ConfigWorkspaceShell` as the shared two-column boundary. Add viewport-constrained CSS and internal scrolling, then simplify `EnumConfig` node markup so CSS can render a dense two-level tree without changing enum data or store behavior.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, CSS.

---

### Task 1: Define the regression contract

**Files:**
- Modify: `scripts/verify-collapsible-sidebars.mjs`
- Modify: `scripts/verify-enum-config.mjs`

- [ ] Assert the shared workspace has an explicit viewport height and overflow boundary.
- [ ] Assert enum navigation uses tree roles and compact node classes.
- [ ] Run both scripts and confirm they fail before implementation.

### Task 2: Implement the compact enum tree

**Files:**
- Modify: `src/components/config/EnumConfig.tsx`
- Modify: `src/styles/globals.css`

- [ ] Change category/type containers to `tree` / `treeitem` semantics.
- [ ] Replace card-like type rows with compact tree rows and count badges.
- [ ] Preserve selection, category switching, tooltips, and collapsed state.
- [ ] Constrain desktop workspace height and make sidebar/content bodies scroll internally.

### Task 3: Verify and release

**Files:**
- Test: `scripts/verify-collapsible-sidebars.mjs`
- Test: `scripts/verify-enum-config.mjs`

- [ ] Run contract scripts, `npx tsc --noEmit`, and `npm run build`.
- [ ] Check desktop behavior in the browser at 1440x900.
- [ ] Commit, push to `dev`, merge `origin/dev` into `master`, and verify remote ancestry.

### Task 4: Normalize personal-workbench filters and source columns

**Files:**
- Modify: `src/components/workspace/TodoCenter.tsx`
- Modify: `src/styles/globals.css`
- Test: `scripts/verify-todo-center.mjs`

- [ ] Add one sizing hook per filter control.
- [ ] Use a compact wrapping flex row with 32px controls and stable field widths.
- [ ] Keep multi-select tags on one line and reset both generation-date fields atomically.
- [ ] Split “任务来源” and “任务节点” into independent table columns.
