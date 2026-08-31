# Joint MR Mocks and Project Information Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, validator-backed MR acceptance dataset and make every project-space basic-information surface render ordinary fields in an 8-column desktop grid and team roles in a 4-column desktop grid.

**Architecture:** Extend the existing centralized MR seed factory and feed stopped projects through the production stop-release rule so the Store remains internally consistent. Keep the shared machine/tOS/technical information components intact and change their semantic CSS grid; add one narrowly scoped legacy-grid hook for capability projects. Lock both behaviors with a source/runtime verifier and browser acceptance flow.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, CSS Grid, Node verification scripts, Puppeteer.

---

## Task 1: Define the Failing Acceptance Contract

**Files:**

- Create: `scripts/verify-mr-mock-and-info-grid.mjs`
- Modify: `scripts/verify-project-info-matrix-refresh.mjs`
- Test: `scripts/verify-mr-mock-and-info-grid.mjs`

- [ ] **Step 1: Write the failing verifier**

  Load `src/data/mrVersionPlanMocks.ts`, `src/lib/mrAggregationRules.ts`, `src/styles/globals.css`, and the basic-information render sources. Assert exact version count/order, 25–30 visible machine rows, scenario-catalog coverage, N/A empty dates, four stop records, post-stop consistency, real validator errors, and the 8/4 responsive CSS contract.

- [ ] **Step 2: Run it and confirm the expected failure**

  ```bash
  node scripts/verify-mr-mock-and-info-grid.mjs
  ```

  Expected: FAIL because only five tOS instances, six machine plans, zero stop records, and 5/2 CSS columns exist.

- [ ] **Step 3: Update the old verifier expectation without weakening it**

  Change the existing `repeat(5, ...)` assertion in `scripts/verify-project-info-matrix-refresh.mjs` to the approved `repeat(8, ...)` contract and add responsive column assertions.

- [ ] **Step 4: Commit the red test**

  ```bash
  git add scripts/verify-mr-mock-and-info-grid.mjs scripts/verify-project-info-matrix-refresh.mjs
  git commit -m "test: define MR mock and information grid contract"
  ```

## Task 2: Expand Deterministic MR Acceptance Fixtures

**Files:**

- Modify: `src/data/mrVersionPlanMocks.ts`
- Test: `scripts/verify-mr-mock-and-info-grid.mjs`
- Test: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add the sixth tOS plan instance**

  Add fixed secondary-activity dates for `16.3.0.160`, then build the six instances from one ordered version constant.

- [ ] **Step 2: Add reusable date-derivation helpers**

  Add small pure helpers for shifting fixed ISO dates and creating valid type-1/type-N plans, while keeping deliberately invalid overrides explicit and readable.

- [ ] **Step 3: Build the visible 25–30-row machine matrix**

  Use existing machine project IDs and fixed actors to create the target 28 visible plans. Include at least four empty-date `N/A` rows, multiple clean type 1–4 rows, and explicit invalid rows for mismatch, one-week gap, tOS baseline, MP deadline, and next-version boundary.

- [ ] **Step 4: Apply stopped-project fixtures through production rules**

  Import `applyStopRelease` from `src/lib/mrAggregationRules.ts`, create four fixed `MrStopReleaseRecord` objects, and build the returned `machinePlansByKey` by applying those records in order, so forbidden future rows are absent while historical rows remain.

- [ ] **Step 5: Extend the scenario catalog**

  Add stable `na` and `stopped` scenario groups and expand `joint` identifiers to match the actual fixture matrix. Update `verify-mr-version-plan.mjs` expected arrays to the new immutable catalog.

- [ ] **Step 6: Run focused verification**

  ```bash
  node scripts/verify-mr-mock-and-info-grid.mjs
  node scripts/verify-mr-version-plan.mjs
  ```

  Expected: MR data assertions pass; layout assertions remain red until Task 3.

- [ ] **Step 7: Commit**

  ```bash
  git add src/data/mrVersionPlanMocks.ts scripts/verify-mr-version-plan.mjs
  git commit -m "feat: expand joint MR acceptance mocks"
  ```

## Task 3: Apply the Shared 8/4 Responsive Grid

**Files:**

- Modify: `src/styles/globals.css`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Test: `scripts/verify-mr-mock-and-info-grid.mjs`
- Test: `scripts/verify-project-info-matrix-refresh.mjs`
- Test: `scripts/verify-technical-project.mjs`

- [ ] **Step 1: Change shared desktop grid columns**

  Set `.pms-project-info-display-grid` and its technical-basic variant to eight equal columns, and `.pms-project-info-team-grid` to four equal columns.

- [ ] **Step 2: Add responsive reductions**

  Use scoped media queries so ordinary/team columns are `4/2` below 1280px, `2/1` below 900px, and `1/1` at 640px or below. Preserve field order and visibility.

- [ ] **Step 3: Adapt the capability-project legacy surface**

  Add stable `pms-project-info-legacy-grid` and `pms-project-info-legacy-team-grid` hooks around capability basic/team information and style them to the same 8/4 breakpoints without changing field values, edit controls, or save behavior.

- [ ] **Step 4: Run focused verification**

  ```bash
  node scripts/verify-mr-mock-and-info-grid.mjs
  node scripts/verify-project-info-matrix-refresh.mjs
  node scripts/verify-technical-project.mjs
  ```

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/styles/globals.css src/containers/ProjectSpaceContainer.tsx
  git commit -m "style: align project information grids"
  ```

## Task 4: Add Browser Acceptance

**Files:**

- Create: `screenshots/verify-mr-mock-and-info-grid-browser.mjs`
- Test: `screenshots/verify-mr-mock-and-info-grid-browser.mjs`

- [ ] **Step 1: Write the browser verifier**

  Reuse the repository Puppeteer helpers. Reset only this app's persisted Zustand keys, enter the joint MR space, and assert many rows, visible validation errors, N/A slash cells, and four stop records. Then enter one representative machine, tOS, technical, and capability project and use `getComputedStyle` to assert 8 ordinary columns and 4 team columns at desktop width.

- [ ] **Step 2: Run against a local production build**

  ```bash
  npm run build
  npm run start -- --port 3004
  BASE_URL=http://127.0.0.1:3004 node screenshots/verify-mr-mock-and-info-grid-browser.mjs
  ```

  Expected: PASS with no page errors or unexpected console errors.

- [ ] **Step 3: Commit**

  ```bash
  git add screenshots/verify-mr-mock-and-info-grid-browser.mjs
  git commit -m "test: verify MR mocks and information grids in browser"
  ```

## Task 5: Full Regression and Independent Review

**Files:**

- Modify only if an in-scope defect is found.

- [ ] **Step 1: Run static and type checks**

  ```bash
  git diff --check origin/master...HEAD
  node scripts/verify-mr-mock-and-info-grid.mjs
  node scripts/verify-mr-version-plan.mjs
  node scripts/verify-project-info-matrix-refresh.mjs
  node scripts/verify-technical-project.mjs
  npx tsc --noEmit
  npm run build
  ```

  Expected: all exit zero.

- [ ] **Step 2: Re-run browser acceptance on the production build**

  ```bash
  BASE_URL=http://127.0.0.1:3004 node screenshots/verify-mr-mock-and-info-grid-browser.mjs
  ```

  Expected: PASS.

- [ ] **Step 3: Review scope**

  Confirm no field order, visibility, permissions, validation formula, create form, project-list drag, or unrelated surface changed.

- [ ] **Step 4: Commit any review-only fixes**

  ```bash
  git add src/data/mrVersionPlanMocks.ts src/styles/globals.css src/containers/ProjectSpaceContainer.tsx scripts/verify-mr-mock-and-info-grid.mjs scripts/verify-mr-version-plan.mjs scripts/verify-project-info-matrix-refresh.mjs screenshots/verify-mr-mock-and-info-grid-browser.mjs
  git commit -m "fix: address MR mock grid review"
  ```

## Task 6: Integrate and Publish

**Files:**

- No source changes expected.

- [ ] **Step 1: Fetch and verify remote branch tips**

  ```bash
  git fetch origin dev master
  git rev-parse origin/dev origin/master HEAD
  ```

- [ ] **Step 2: Merge the feature into `dev` and push**

  Use an isolated release branch/worktree based on current `origin/dev`, merge this feature branch without force-pushing, run the focused verifier and build, then push `HEAD:dev`.

- [ ] **Step 3: Merge updated `dev` into `master` and push**

  Use an isolated release branch/worktree based on current `origin/master`, merge updated `origin/dev`, run the focused verifier and build, then push `HEAD:master`.

- [ ] **Step 4: Publish Vercel Production**

  ```bash
  vercel --prod --yes
  ```

  Expected: deployment state `Ready` and production alias points to `https://pms-transsion.vercel.app`.

- [ ] **Step 5: Verify the production URL**

  ```bash
  BASE_URL=https://pms-transsion.vercel.app node screenshots/verify-mr-mock-and-info-grid-browser.mjs
  ```

  Expected: PASS against production.
