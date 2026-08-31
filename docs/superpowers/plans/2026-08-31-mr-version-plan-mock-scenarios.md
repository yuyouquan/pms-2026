# MR Version Plan Mock Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed deterministic normal, boundary-valid, and rule-invalid MR plan examples across tOS project, joint space, and machine-market views.

**Architecture:** Extend the existing immutable MR acceptance seed with named scenario fixtures rather than random generation or unrelated projects. Keep all dates syntactically valid so the existing validation engines, red cells, error icons, and exact boundary messages are exercised by the real UI.

**Tech Stack:** TypeScript mock factories, Zustand persisted store migration, existing MR validation libraries, Node assertion verifier, Playwright browser acceptance.

---

### Task 1: Specify deterministic MR fixture scenarios

**Files:**
- Modify: `src/data/mrVersionPlanMocks.ts`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Write failing fixture assertions**

Add assertions for exported scenario identities and fresh clones:

```js
const first = mocks.createInitialMrVersionPlanState()
const second = mocks.createInitialMrVersionPlanState()
assert.deepEqual(mocks.MR_MOCK_SCENARIOS.tos, [
  'normal', 'boundary-valid', 'before-plan-start', 'after-plan-end',
])
assert.notStrictEqual(first.tosInstancesByProjectId['19'][0].dates, second.tosInstancesByProjectId['19'][0].dates)
assert.ok(Object.keys(first.machinePlansByKey).length >= 5)
assert.ok(Object.keys(first.marketOverridesByKey).length >= 4)
```

- [ ] **Step 2: Run verifier and confirm RED**

Run: `npm run verify:mr-version-plan`

Expected: FAIL because the scenario catalog and expanded seeds do not exist.

- [ ] **Step 3: Add a named scenario catalog and fixture helpers**

Export a frozen catalog:

```ts
export const MR_MOCK_SCENARIOS = Object.freeze({
  tos: ['normal', 'boundary-valid', 'before-plan-start', 'after-plan-end'],
  joint: ['normal-type-1', 'same-type-mismatch', 'one-week-gap', 'tos-baseline', 'next-version-boundary'],
  market: ['normal-follow', 'later-than-main', 'missing-main-boundary'],
} as const)
```

Use helpers that clone activities and dates on every state creation. Do not introduce invalid strings such as `2026-02-30`.

- [ ] **Step 4: Run verifier and confirm GREEN**

Run: `npm run verify:mr-version-plan`

Expected: PASS for catalog, counts, date format, and reference isolation.

- [ ] **Step 5: Commit**

```bash
git add src/data/mrVersionPlanMocks.ts scripts/verify-mr-version-plan.mjs
git commit -m "test: define deterministic MR mock scenarios"
```

### Task 2: Seed tOS normal and invalid boundary examples

**Files:**
- Modify: `src/data/mrVersionPlanMocks.ts`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing validation expectations**

Use the real tOS validator and assert exactly one minimum and one maximum example:

```js
const seed = mocks.createInitialMrVersionPlanState()
const boundsByVersion = Object.fromEntries(
  mocks.createMrAcceptancePlanScopeSeed()
    .publishedSnapshots['project::19::tos-type::Full::level1::v3::snapshot']
    .filter(task => task.nodeKind === 'business-period')
    .map(task => [task.taskName, { planStartDate: task.planStartDate, planEndDate: task.planEndDate }]),
)
const tosErrors = seed.tosInstancesByProjectId['19'].flatMap(instance => (
  planRules.validateTosMrInstanceDates(instance, boundsByVersion[instance.tosVersion])
))
assert.ok(tosErrors.some(error => error.boundaryType === 'minimum' && /计划开始时间（\d{4}-\d{2}-\d{2}）/.test(error.message)))
assert.ok(tosErrors.some(error => error.boundaryType === 'maximum' && /计划完成时间（\d{4}-\d{2}-\d{2}）/.test(error.message)))
```

- [ ] **Step 2: Run verifier and confirm RED**

Run: `npm run verify:mr-version-plan`

Expected: FAIL because existing tOS examples are all valid.

- [ ] **Step 3: Add versions for normal, equality boundary, lower-bound error, and upper-bound error**

Keep ascending tOS version order and align `createMrAcceptancePlanScopeSeed()` with a plan interval for every version. Put the lower-bound violation only on `mr-node-change-collection` and the upper-bound violation only on `mr-node-ota-deploy`, so UI errors are unambiguous.

- [ ] **Step 4: Run verifier and confirm GREEN**

Run: `npm run verify:mr-version-plan`

Expected: valid and equality-boundary fixtures return no errors; invalid fixtures return the exact dated messages.

- [ ] **Step 5: Commit**

```bash
git add src/data/mrVersionPlanMocks.ts scripts/verify-mr-version-plan.mjs
git commit -m "test: seed tOS MR boundary examples"
```

### Task 3: Seed joint-space 1+N rule examples

**Files:**
- Modify: `src/data/mrVersionPlanMocks.ts`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing joint-validation assertions**

Run `validateJointMachineRows` against the initial seed and require identifiable rows for:

```js
const messages = errors.map(error => `${error.rowKey}:${error.message}`)
assert.ok(messages.some(message => message.includes('同一1+N转测类型的版本转测时间需保持一致')))
assert.ok(messages.some(message => message.includes('需晚于上一个1+N转测类型至少1周（')))
assert.ok(messages.some(message => message.includes('MP入库截止时间不得晚于tOS项目时间（')))
assert.ok(messages.some(message => message.includes('不能超过下一个tOS版本')))
```

- [ ] **Step 2: Run verifier and confirm RED**

Run: `npm run verify:mr-version-plan`

Expected: FAIL because the initial state does not cover every rule family.

- [ ] **Step 3: Add minimal machine rows that each express one rule family**

Reuse existing machine projects and multiple tOS versions. Keep at least one clean type-1 row. For invalid rows, change only the target activity date needed for the scenario so each red cell has a predictable error.

- [ ] **Step 4: Verify no separate error column is reintroduced**

Keep the existing source assertion that `JointMrVersionPlan.tsx` has no `错误提示` column and that each error remains localized in `.pms-mr-invalid-cell`.

- [ ] **Step 5: Run verifier and confirm GREEN**

Run: `npm run verify:mr-version-plan`

Expected: PASS with all named rule families and at least one error-free joint row.

- [ ] **Step 6: Commit**

```bash
git add src/data/mrVersionPlanMocks.ts scripts/verify-mr-version-plan.mjs
git commit -m "test: seed joint MR rule examples"
```

### Task 4: Seed machine-market follow and override examples

**Files:**
- Modify: `src/data/mrVersionPlanMocks.ts`
- Modify: `scripts/verify-mr-version-plan.mjs`

- [ ] **Step 1: Add failing market-rule assertions**

Project the machine-market plan and assert one clean non-main market, one later-than-main error, and one value whose main-market counterpart is empty.

- [ ] **Step 2: Run verifier and confirm RED**

Run: `npm run verify:mr-version-plan`

Expected: FAIL because only one valid `TR` override exists.

- [ ] **Step 3: Add deterministic market overrides**

Seed `TR`, `RU`, or `IN` overrides using existing project markets. Keep main-market values sourced from joint plans; do not duplicate editable main-market state. Use one activity per invalid scenario to preserve precise error messages.

- [ ] **Step 4: Run verifier and confirm GREEN**

Run: `npm run verify:mr-version-plan`

Expected: PASS; clean overrides have no errors and invalid overrides expose the main-market boundary date or missing-main message.

- [ ] **Step 5: Commit**

```bash
git add src/data/mrVersionPlanMocks.ts scripts/verify-mr-version-plan.mjs
git commit -m "test: seed machine market MR examples"
```

### Task 5: Browser acceptance for all three MR entry points

**Files:**
- Modify: `screenshots/verify-mr-version-plan-browser.mjs`

- [ ] **Step 1: Add failing browser scenarios**

After clearing only MR test storage, verify:

```js
assert.equal(await tosNormalCell.hasClass('pms-mr-invalid-cell'), false)
assert.equal(await tosLowerBoundCell.hasClass('pms-mr-invalid-cell'), true)
assert.match(await tosLowerBoundIcon.getAttribute('aria-label'), /\(2026-\d{2}-\d{2}\)/)
assert.equal(await jointCleanCell.hasClass('pms-mr-invalid-cell'), false)
assert.equal(await jointGapCell.hasClass('pms-mr-invalid-cell'), true)
assert.equal(await marketLateCell.hasClass('pms-mr-invalid-cell'), true)
```

- [ ] **Step 2: Run the browser verifier and confirm RED**

Run local dev server, then `npm run verify:mr-version-plan-browser`.

Expected: FAIL on missing new fixture rows.

- [ ] **Step 3: Use stable project/version/activity selectors**

Locate rows using existing `data-mr-project-id`, `data-mr-tos-version`, `data-mr-row-kind`, and `data-mr-activity-id`. Do not edit dates inside the acceptance test just to manufacture the initial errors.

- [ ] **Step 4: Run browser acceptance and confirm GREEN**

Run: `npm run verify:mr-version-plan-browser`

Expected: all scenarios PASS, with no browser errors, failed responses, or tracked screenshot drift.

- [ ] **Step 5: Commit**

```bash
git add screenshots/verify-mr-version-plan-browser.mjs
git commit -m "test: verify MR mock scenario matrix"
```

### Task 6: MR regression and compile gate

**Files:**
- Modify only files required by failures proven here.

- [ ] **Step 1: Run MR and linked-plan verification**

```bash
npm run verify:mr-version-plan
npm run verify:mr-version-plan-browser
npm run verify:level1-flat-gantt
```

Expected: every command exits 0.

- [ ] **Step 2: Stop the dev server and run compile gates**

```bash
npx tsc --noEmit
npm run build
```

Expected: both exit 0.

- [ ] **Step 3: Review the final diff**

```bash
git diff --check
git status --short
```

Confirm no random dates, unrelated projects, persisted credentials, temporary screenshots, or build output are tracked.
