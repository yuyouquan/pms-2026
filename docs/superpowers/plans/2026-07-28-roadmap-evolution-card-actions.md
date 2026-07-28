# Roadmap Evolution Card Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the old-product section with the new-product background and collapse planned-project edit/delete actions behind a compact control.

**Architecture:** Keep the change local to `RoadmapEvolutionView` and `RoadmapProjectCard`. The section styling remains CSS-only, while each editable planned-project card owns its expanded/collapsed action state.

**Tech Stack:** Next.js 14, React 18, Ant Design 6, TypeScript, scoped JSX CSS

---

### Task 1: Unify old-product section styling

**Files:**
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Test: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add focused source assertions**

Assert that the separator uses the same translucent purple surface as the product columns and no white raised background.

- [ ] **Step 2: Run the verifier and confirm the new assertion fails**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL because the old separator still uses `rgba(255, 255, 255, 0.9)`.

- [ ] **Step 3: Implement the visual update**

Change the separator to a transparent purple surface, reduce its height, remove the raised shadow, and use a subtle top divider.

- [ ] **Step 4: Run the verifier**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: all roadmap assertions pass.

### Task 2: Collapse planned-project actions

**Files:**
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Test: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add focused source assertions**

Assert that editable planned-project cards expose a compact operation toggle, keep actions collapsed by default, and include motion/reduced-motion styling.

- [ ] **Step 2: Run the verifier and confirm the new assertion fails**

Run: `node scripts/verify-project-roadmap.mjs`

Expected: FAIL because edit/delete buttons are currently always visible.

- [ ] **Step 3: Implement the interaction**

Use local React state and Ant Design `MoreOutlined`. Place the toggle in the card header, animate the action panel with grid-row expansion plus opacity/transform, and keep normal projects free of the control.

- [ ] **Step 4: Verify code and behavior**

Run:

```bash
node scripts/verify-project-roadmap.mjs
npx tsc --noEmit
git diff --check
```

Expected: all commands exit successfully.

### Task 3: Refine roadmap table fixed columns and row actions

**Files:**
- Modify: `src/components/roadmap/RoadmapTableView.tsx`
- Test: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Add focused source assertions**

Assert that planned tags are absent, conflict copy uses “正式项目”, fixed cells use opaque surfaces, and edit/delete actions reveal on row hover or keyboard focus.

- [ ] **Step 2: Run the focused verifier and confirm it fails**

Run: `ROADMAP_VERIFY_FOCUS='opaque fixed columns' node scripts/verify-project-roadmap.mjs`

Expected: FAIL against the current always-visible actions and translucent fixed cells.

- [ ] **Step 3: Implement the table refinement**

Remove the planned tags, update conflict copy, add a planned-row class, animate the edit/delete action group with opacity and translation, and explicitly restore sticky positioning plus opaque backgrounds for fixed left/right cells.

- [ ] **Step 4: Verify code and behavior**

Run:

```bash
node scripts/verify-project-roadmap.mjs
npx tsc --noEmit
git diff --check
```

Expected: all commands exit successfully.
