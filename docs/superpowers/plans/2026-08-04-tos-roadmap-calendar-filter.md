# tOS Roadmap Single Entry and Calendar Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the project-view switch with one tOS roadmap destination and restore the advanced filter action in calendar view without exposing irrelevant column settings.

**Architecture:** Keep the existing `roadmap` module key and `ProjectRoadmapModule`, but simplify `RoadmapView` into a single-purpose shell. Reuse `ProjectSummaryTable` as the calendar filter controller with its table hidden, adding one capability prop so calendar renders only filtering while list/card retain both filtering and column settings.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Node source-contract scripts, Playwright CLI.

---

### Task 1: Lock the single tOS roadmap contract

**Files:**
- Create: `scripts/verify-tos-roadmap-single-entry.mjs`
- Modify: `scripts/lib/roadmap-source-analysis.mjs`
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `scripts/verify-roadmap-view-cleared.mjs`
- Modify: `scripts/verify-project-view-requirements.mjs`
- Modify: `scripts/verify-workbench-split.mjs`

- [ ] **Step 1: Write failing source assertions**

Require the Header roadmap item to use `tOS路标`, and require `RoadmapView` to import and mount `ProjectRoadmapModule` directly while excluding `ProjectPlanSummaryBoard`, `activeProjectView`, `PROJECT_VIEW_OPTIONS`, and the old switch labels.

```js
assert.match(appShellSource, /key:\s*'roadmap',\s*label:\s*'tOS路标'/)
assert.match(roadmapViewSource, /<ProjectRoadmapModule\s+projects=\{projects\}\s+onViewProject=\{onViewProject\}\s*\/>/)
assert.doesNotMatch(roadmapViewSource, /ProjectPlanSummaryBoard|activeProjectView|PROJECT_VIEW_OPTIONS|项目计划汇总看板|tOS 路标视图/)
```

- [ ] **Step 2: Run the roadmap contracts and verify RED**

Run the focused new contract first:

```bash
node scripts/verify-tos-roadmap-single-entry.mjs
node scripts/verify-roadmap-view-cleared.mjs
```

Expected: FAIL because the Header and `RoadmapView` still expose the two-view switch.

- [ ] **Step 3: Update the AST helper for the new contract**

Replace summary-conditional and option-label analysis with direct facts: `hasTosRoadmapHeader`, `hasProjectRoadmapImport`, `mountsProjectRoadmapModule`, `importsSummaryBoard`, `mountsSummaryBoard`, and `hasProjectViewSwitcher`. Keep legacy `MilestoneView` / `MRTrainView` detection fixtures.

### Task 2: Simplify the roadmap shell

**Files:**
- Modify: `src/containers/AppShell.tsx`
- Modify: `src/components/roadmap/RoadmapView.tsx`

- [ ] **Step 1: Rename the Header destination**

Change the main item to `{ key: 'roadmap', label: 'tOS路标' }` and the project-space return label to `返回tOS路标`, retaining the `roadmap` key and edit guard.

- [ ] **Step 2: Remove two-view state and imports**

Delete `useState`, `useEffect`, `Button`, `ProjectPlanSummaryBoard`, share parsing, and option definitions from `RoadmapView`.

- [ ] **Step 3: Render one roadmap destination**

Use a fixed `tOS路标` title, a roadmap-only subtitle, and mount only:

```tsx
<ProjectRoadmapModule projects={projects} onViewProject={onViewProject} />
```

Keep `pms-roadmap-view-card` and `overflow: 'visible'` unchanged.

- [ ] **Step 4: Run roadmap contracts and verify GREEN**

Run the focused commands from Task 1. Expected: both exit 0. The broader roadmap script currently has unrelated baseline failures and is retained as diagnostic evidence rather than a release gate for this scoped change.

### Task 3: Restore calendar advanced filtering

**Files:**
- Modify: `scripts/verify-workbench-project-list.mjs`
- Modify: `src/components/project-summary/ProjectSummaryTable.tsx`
- Modify: `src/containers/ProjectListContainer.tsx`

- [ ] **Step 1: Write failing calendar filter assertions**

Require a `showColumnSettings?: boolean` prop, conditional column-settings rendering, and calendar-branch hidden controllers that pass `showColumnSettings={false}` and the existing controlled filter pairs.

```js
assert.match(summarySource, /showColumnSettings\?: boolean/)
assert.match(summarySource, /showColumnSettings\s*&&\s*\(\s*<SortableColumnSettings/)
assert.match(source, /projectListView === 'calendar'[\s\S]*showTable=\{false\}[\s\S]*showColumnSettings=\{false\}/)
```

- [ ] **Step 2: Run the workbench contract and verify RED**

Run: `node scripts/verify-workbench-project-list.mjs`

Expected: FAIL because calendar has no summary-controller mount and the toolbar cannot hide column settings.

- [ ] **Step 3: Add the toolbar capability prop**

Add `showColumnSettings?: boolean` to `ProjectSummaryTableProps`, default it to `true`, and wrap only `SortableColumnSettings` in `showColumnSettings && (...)`. Do not change `FloatingFilterPanel` rendering.

- [ ] **Step 4: Mount calendar filter controllers**

Wrap the calendar branch in a fragment. After `ProjectListCalendar`, mount the same technical or standard `ProjectSummaryTable` controller used by card view with `showTable={false}`, `showQuickFilters={false}`, the existing `toolbarHost`, controlled filters, and `showColumnSettings={false}`.

- [ ] **Step 5: Run workbench contracts and verify GREEN**

Run:

```bash
node scripts/verify-workbench-project-list.mjs
node scripts/verify-project-list-matrix.mjs
node scripts/verify-project-summary.mjs
```

Expected: all exit 0.

### Task 4: Verify, commit, and release

**Files:**
- No additional production files
- Browser artifacts: `output/playwright/` (remove temporary artifacts before commit)

- [ ] **Step 1: Run static and build verification**

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all exit 0; the existing stale caniuse-lite warning is non-blocking.

- [ ] **Step 2: Verify in a real browser**

Open the app, click Header `tOS路标`, confirm the roadmap module is immediately visible and no summary/roadmap switch exists. Open project list calendar view and confirm the quick-filter row contains `筛选` but not `列设置`; apply a project-name filter, confirm calendar results change, and switch back to list to confirm the condition persists.

- [ ] **Step 3: Commit implementation**

```bash
git add scripts src/containers/AppShell.tsx src/components/roadmap/RoadmapView.tsx src/components/project-summary/ProjectSummaryTable.tsx src/containers/ProjectListContainer.tsx
git commit -m "fix: simplify roadmap entry and restore calendar filtering"
```

- [ ] **Step 4: Push and promote**

Push the feature branch, merge into the latest `origin/dev` in an isolated release worktree, re-run contracts/type/build, push `dev`, then merge `origin/dev` into the latest `origin/master`, re-run the same gates, and push `master`.
