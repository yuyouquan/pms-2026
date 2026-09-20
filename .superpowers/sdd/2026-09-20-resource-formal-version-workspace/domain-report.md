# Resource formal workspace — domain completion report

Date: 2026-09-20. Worktree: `.worktrees/feature-project-auto-scheduling`. Branch: `codex/feature-project-auto-scheduling`. Input design/plan base: `75b2eb4`.

## Delivered contracts

- All four stores expose `createResourceVersion(projectId, budgetType, scopeId, { versionNumber, sourceVersionId? })` and `updateResourceMonthlyInvestment(projectId, versionId, rowId, month, value, scopeId)`.
- Blank versions have no invented department/expense rows; formal source-owned metadata is populated. Explicit copies preserve snapshots, monthly overrides and ratios in isolated data, remapping version-derived row identities and ratio-map keys together.
- Manual display names support numeric dot segments, optional V prefix, same-budget duplicate rejection, and reload preservation. Legacy display names also remain intact; internal ordering remains independent. Automatic legacy names skip existing custom-name collisions.
- `departmentRatio` patches and optional `departments.phaseRatios` support atomic imports. Independent department target totals survive temporary ratio sums below/above 100, identity edits and changes to sibling rows. Actual legacy phase-amount writes rederive ratios; unchanged amounts preserve precise percentages.
- `getResourceRatioFields`, `getResourcePhaseRatios`, `allocateResourceRatios`, and independent `getResourceFormalValidationErrors` are exported. Capability uses `projectPeriod`. Complete allocations use deterministic tenths conservation; incomplete ratios are not silently normalized.
- Explicitly confirmed formalization gates require 100% phase ratios and every department's saved monthly sum equal to its target. Saved historical months count in both UI/domain full-cycle sums. Existing valid outside-period months can be corrected; arbitrary new outside-period months are rejected.
- Monthly edits enforce scope, RBAC, bound-budget protection, lock state, nonnegative finite values and one decimal place. Numeric values are normalized to one decimal to avoid floating point representations such as 6.199999999.
- Machine department and total writes are readonly. Explicit model edits recapture selected configuration and clear only that edited version's manual override. Existing saved model snapshots/overrides are never deleted during refresh/migration. Snapshot-owned project level no longer gets overwritten by live source level, which previously caused S snapshots to be filtered by A and lose all generated rows.
- `resourceOperationLogs` persist inside project records atomically with actual mutation writes. User action wrapping excludes background refresh/rehydration/cross-tab synchronization and failed/no-op writes. Copy/create/delete, lock/formal state, base metadata, milestones, departments/percentages, nonlabor and monthly edits are covered. Version deletion retains project audit history. Legacy per-version operation logs are retained, with no-op append suppression.
- Audit changes are individual Chinese business paths with before/after values: milestone name; department and phase; percent; department/subject/month amount; one monthly labor cell. Internal row IDs match identity but are not displayed. Creation/deletion use concise version/target/source summaries.

## RED evidence and fixes

1. Actual store graph initially failed `Machine: named creation API` (undefined), proving the new action contract was missing.
2. Actual graph exposed a circular-module TDZ for top-level action metadata; moving that metadata into store initialization fixed startup without replacing real imports.
3. Real monthly write test caught 6.199999999 vs expected 6.2; normalized one-cell numeric writes now match precision contract.
4. Legacy-name test caught V1.0 rewritten to V0.1; normalization now preserves saved display names.
5. Legacy department-action test caught stale ratio 0 vs expected 100 after an actual phase-amount edit; derived ratio maps now follow real legacy edits.
6. Snapshot test caught live-source grade overwrite incompatible with saved model records; saved model selection now remains self-consistent.
7. Identity-only edit test caught independent target 20 reduced to 13.4; identity/sibling edits preserve independent target and precise partial ratios.

## Verification

Passed with real TypeScript store module graph:

- `node scripts/verify-resource-formal-domain.mjs`
- `node scripts/verify-resource-cross-tab-storage.mjs` — 4 categories × 3 budgets; edit/copy each one cross-tab event; unchanged refresh zero durable writes; audits converge with data.
- `node scripts/verify-resource-version-lifecycle.mjs`
- `node scripts/verify-resource-total-editing.mjs`
- `node scripts/verify-resource-inline-editing.mjs`
- `node scripts/verify-mock-dataset-storage.mjs`
- `npx tsc --noEmit --incremental false`
- `git diff --check` on owned paths

Formal-domain coverage includes named creation/copy/reload, duplicate rejection without mutation, historical names, blank/copy isolation, 33.33/33.33/33.34 conserved rounding, capability100, malformed/negative/over100 individual ratio rejection, incomplete-sum preservation and formal rejection, atomic ratio import, ratio-copy ID mapping, legacy writes, identity-only edits, monthly target persistence, scope/lock/month/numeric rejection, preserved historical month correction, monthly formal imbalance rejection, no-op/no-refresh logs, leaf milestone/expense audit paths and persistent deletion logs.

## Intentionally superseded fixtures

- Cross-tab investment edits now use machine model coefficient, since manual machine department totals are expressly superseded.
- Lifecycle month edit fixture formerly used arbitrary 2035 outside-period values; it now tests rejection and uses a valid balancing month. After a model change retains a manual monthly override, the fixture explicitly rebalances before formalizing.
- Total-editing suite now proves machine readonly behavior, history preservation and explicit model recalculation instead of asserting mutable machine overrides.
- `verify-hr-investment.mjs` legacy-name assertion updated to preserve historical names. Its broader old harness still fails earlier at line65 expecting unlocked historical date edits to be blocked; this contradicts the existing lifecycle contract and is outside the bounded new focused suite. Reported to controller; not claimed passing.
- Controller owns `verify-resource-empty-project-persistence.mjs`: its old fixture changed targets to [17.1,0,0] but retained seed phase amounts, so new formal gates correctly reject it. Controller is updating the fixture through valid rows and monthly balancing.

## Remaining ownership

Controller retains UI/config, fixture integration, independent review, production build, browser rounds and release. No build, dev server, browser or release commands were executed by this domain worker. Exact frozen source commit is supplied in the completion message; this report is included in that commit.
