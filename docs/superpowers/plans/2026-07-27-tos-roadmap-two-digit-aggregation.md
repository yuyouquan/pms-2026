# tOS Roadmap Two-Digit Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the roadmap surface, make maintained tOS versions canonical two-part values, map normal projects by product type, add launch-date estimation, refresh mocks, and simplify evolution cards.

**Architecture:** Keep `TosVersionConfig` as the maintained catalog entity but normalize it to `major.minor` only. Adapt normal projects at the source boundary so downstream table, filters, conflict detection, and evolution columns continue consuming stable maintained version IDs. Persist both date-estimation flags on planned projects and render the compact card from the shared roadmap column configuration.

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, Zustand 4, custom Node verification script.

---

### Task 1: Lock the new contracts in the roadmap verifier

**Files:**
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1: Replace three-part maintenance assertions**

Update normalization, CRUD, migration, mock, audit, and display assertions so maintained inputs such as `tOS 16.3` normalize to:

```js
{ name: 'tOS 16.3', major: 16, minor: 3 }
```

Add assertions that legacy `tOS 16.3.0` and `tOS 16.3.2` resolve to the maintained `tOS 16.3` ID during migration.

- [ ] **Step 2: Add product-type mapping and launch-estimate assertions**

Assert that:

```js
normalNew.firstSaleTosVersionId === maintainedFirstSaleId
normalOld.firstSaleTosVersionId === maintainedCurrentId
planned.launchEstimated === true
```

Assert the modal contains `name="launchEstimated"` and both table/card render a gold estimate tag for `launchDate`.

- [ ] **Step 3: Add UI text and card-layout assertions**

Require `tOS 路标视图`, `展开目标`, `收起目标`, `冲突`, `记录`, and `创建项目`; reject the old toolbar labels. Require evolution cards to build the title from `marketName` and canonical project name, omit the source tag, retain labels only for `str5Date` and `launchDate`, and omit `productLine` from evolution defaults.

- [ ] **Step 4: Run the focused verifier and confirm it fails**

Run:

```bash
ROADMAP_VERIFY_FOCUS='two-digit roadmap' node scripts/verify-project-roadmap.mjs
```

Expected: FAIL until Tasks 2–5 are implemented.

### Task 2: Canonicalize maintained tOS versions and migrate persisted data

**Files:**
- Modify: `src/types/roadmap.ts`
- Modify: `src/lib/roadmapValidation.ts`
- Modify: `src/lib/roadmapSorting.ts`
- Modify: `src/stores/roadmap.ts`
- Modify: `src/components/roadmap/TosVersionMaintenanceModal.tsx`

- [ ] **Step 1: Change maintenance normalization to two parts**

Use the accepted pattern:

```ts
const match = input.trim().match(/^(?:tos\s*)?(\d+)\.(\d+)$/i)
return { name: `tOS ${major}.${minor}`, major, minor }
```

Keep a legacy parser that accepts an optional third component but returns the two-part maintained identity.

- [ ] **Step 2: Remove patch-based identity**

Make maintained IDs deterministic as `tos-${major}-${minor}`. Semantic comparison uses major then minor. Formatting always returns `tOS ${major}.${minor}`.

- [ ] **Step 3: Merge legacy persisted versions**

During migration, group old entries by `major.minor`, choose the entry with the latest valid `updatedAt`, normalize its period and targets, and build an old-ID/name-to-canonical-ID map. Remap planned projects, filters, selection, and audit display values through that map.

- [ ] **Step 4: Update maintenance UI validation**

Change placeholder and validation copy to examples such as `tOS 17.0`; reject three-part input for new edits while migration continues accepting it.

- [ ] **Step 5: Run the tOS-focused assertions**

```bash
ROADMAP_VERIFY_FOCUS='tOS' node scripts/verify-project-roadmap.mjs
```

Expected: all focused tOS assertions pass.

### Task 3: Map normal projects and refresh mock data

**Files:**
- Modify: `src/lib/roadmapProjectAdapter.ts`
- Modify: `src/stores/project.ts`
- Modify: `src/stores/roadmap.ts`
- Modify: `src/data/projects.ts`

- [ ] **Step 1: Resolve the normal-project version by product type**

At the normal-project adapter boundary:

```ts
const versionReference = productType === '新品'
  ? project.firstSaleTosVersionId ?? project.firstSaleTosVersion ?? project.tosVersion
  : project.currentTosVersionId ?? project.currentTosVersion ?? project.tosVersion
```

Resolve the value by stable ID or two-/three-part name against the maintained two-part catalog.

- [ ] **Step 2: Refresh maintained and project mocks**

Use two-part maintenance entries. Ensure normal new products have first-sale versions, normal old products have current versions, planned projects use maintained IDs, at least one planned project has `str5Estimated`, another has `launchEstimated`, and a planned/normal duplicate still produces a conflict.

- [ ] **Step 3: Verify aggregation**

Run the focused adapter/mocks assertions and confirm multiple sources appear under one maintained two-part version.

### Task 4: Add launch-date estimation to planned projects

**Files:**
- Modify: `src/types/roadmap.ts`
- Modify: `src/lib/roadmapValidation.ts`
- Modify: `src/stores/roadmap.ts`
- Modify: `src/components/roadmap/PlannedProjectModal.tsx`
- Modify: `src/components/roadmap/RoadmapTableView.tsx`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`

- [ ] **Step 1: Add the persisted field**

Add:

```ts
launchEstimated: boolean
```

Default missing legacy data to `false`, accept only booleans at validation boundaries, and keep it outside the change-log whitelist.

- [ ] **Step 2: Add the modal checkbox**

Render an independent checkbox beside the launch date:

```tsx
<Form.Item name="launchEstimated" valuePropName="checked" noStyle>
  <Checkbox>预估</Checkbox>
</Form.Item>
```

Rename the planned version field label to `tOS 版本`.

- [ ] **Step 3: Render the estimate tag**

For `launchDate`, append the same gold `预估` tag used by STR5 when `row.launchEstimated` is true.

- [ ] **Step 4: Run focused estimate assertions**

```bash
ROADMAP_VERIFY_FOCUS='estimate' node scripts/verify-project-roadmap.mjs
```

Expected: both date-estimation contracts pass.

### Task 5: Rename and compact the tOS roadmap UI

**Files:**
- Modify: `src/components/roadmap/RoadmapView.tsx`
- Modify: `src/components/roadmap/RoadmapToolbar.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`
- Modify: `src/lib/roadmapFilters.ts`
- Modify: `src/styles/globals.css` only if existing compact classes cannot express the final spacing

- [ ] **Step 1: Rename visible navigation and title**

Replace user-facing `项目路标视图` with `tOS 路标视图` at the project-view tab and roadmap region title.

- [ ] **Step 2: Shorten toolbar labels**

Use `展开目标 / 收起目标`, `冲突`, `记录`, and `创建项目` without changing actions or accessibility.

- [ ] **Step 3: Simplify the evolution card**

Build:

```tsx
const title = `${row.marketName}（${buildRoadmapDisplayName(row.projectCode, row.androidVersion, row.productType)}）`
```

Remove the title-side source/status tag. Render labels only for STR5 and launch date; render other selected values without their labels.

- [ ] **Step 4: Change evolution defaults**

Remove `productLine` from `DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS` while retaining it as an optional column.

- [ ] **Step 5: Verify the UI**

Open the local app, enter `项目视图 -> tOS 路标视图`, and confirm the renamed tab, compact toolbar, two-part columns, card title, hidden labels, and estimate tags.

### Task 6: Full verification and handoff

**Files:**
- Verify: all modified files

- [ ] **Step 1: Run all roadmap assertions**

```bash
node scripts/verify-project-roadmap.mjs
```

Expected: zero failures.

- [ ] **Step 2: Run TypeScript and formatting checks**

```bash
npx tsc --noEmit
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 3: Verify the local development surface**

Confirm the page and both generated CSS files return HTTP 200. Do not run `next build` while the development server is running in the same `.next` directory.

- [ ] **Step 4: Commit the implementation**

```bash
git add scripts/verify-project-roadmap.mjs src docs/superpowers/plans/2026-07-27-tos-roadmap-two-digit-aggregation.md
git commit -m "feat: aggregate projects in two-digit tOS roadmap"
```
