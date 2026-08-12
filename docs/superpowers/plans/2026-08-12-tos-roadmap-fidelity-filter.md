# tOS Roadmap Fidelity And Filter Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the approved tOS roadmap screenshots, restore advanced filtering, and add full project details on evolution-card click.

**Architecture:** Keep the existing roadmap store and adapters. Repair filter draft synchronization at the popover boundary, add a read-only details modal, and limit default evolution fields through the existing column-setting definitions. Component-scoped styles provide the compact visual hierarchy without changing unrelated modules.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand, existing source-verification scripts.

---

### Task 1: Protect in-progress filter drafts

**Files:**
- Create: `src/lib/roadmapFilterDraft.ts`
- Modify: `src/components/roadmap/RoadmapFilterDrawer.tsx`
- Test: `scripts/verify-tos-roadmap-fidelity-filter.mjs`

- [ ] Write a failing transition test proving that an incomplete selected field remains in the draft while the popover stays open.
- [ ] Run `node scripts/verify-tos-roadmap-fidelity-filter.mjs` and confirm the missing transition helper fails.
- [ ] Implement opening-edge hydration and completed-condition publishing.
- [ ] Re-run the verifier and confirm the filter assertions pass.

### Task 2: Add card details and compact default fields

**Files:**
- Create: `src/components/roadmap/RoadmapProjectDetailsModal.tsx`
- Modify: `src/lib/roadmapFilters.ts`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`
- Test: `scripts/verify-tos-roadmap-fidelity-filter.mjs`

- [ ] Add failing source contracts for platform/STR5/launch defaults and project-detail click wiring.
- [ ] Implement the read-only full-field modal and stop event propagation from project actions.
- [ ] Re-run the verifier and confirm card contracts pass.

### Task 3: Match the approved compact layout

**Files:**
- Modify: `src/components/roadmap/RoadmapView.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`
- Modify: `src/components/shared/FloatingFilterPanel.tsx`
- Modify: `src/components/roadmap/RoadmapEvolutionView.tsx`
- Modify: `src/styles/globals.css`

- [ ] Remove the oversized roadmap title panel and separate the view switch from the content panel.
- [ ] Apply screenshot-matched toolbar, filter-popover, chips, columns, card, and modal spacing.
- [ ] Run `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/next/dist/bin/next build`.
- [ ] Start the worktree on port 3005 and verify quick filters, advanced filters, card details, horizontal scrolling, and both view modes in the in-app browser.
- [ ] Capture source/implementation comparison and record `final result: passed` in `design-qa.md`.
