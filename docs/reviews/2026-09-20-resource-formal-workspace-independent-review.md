# 项目空间资源独立审查记录


---

# Task 2 UI/config independent review

Reviewed the working-tree increment against `75b2eb4`, using the 2026-09-20 resource formal workspace specification and implementation plan. Read-only static review; no build, browser, or verifier execution. Production files were not modified.

## Findings

### [P1] Department structure edits overwrite saved totals and precise ratios

- UI entry points: `src/components/project-resources/ResourceInlineDetail.tsx:49`, `:75`, `:143`.
- Integration cause: `src/lib/resourceInlineEditing.ts:188-190`, with amount-to-total conversion at `:96-104`.
- The UI submits every remaining row through `{ type: 'departments', rows }` when changing a department name, adding a row, or deleting a row. Unlike import, these patches omit `phaseRatios`. The domain validator then overwrites each row's independent `estimatedInvestment` with the sum of its phase amounts, and line 190 discards the version's saved percentages by deriving them from rounded amounts.
- Concrete scenario: a tOS or technical row has total `100` and a temporarily saved phase ratio sum of `50%` (phase amounts total `50`). Clicking **添加部门**, deleting a different row, or changing the row's department rewrites the original total to `50` and its ratio sum to `100%`. Even complete `33.33/33.33/33.34` ratios become amount-derived percentages after one-decimal allocation. Capability rows also lose a temporarily saved non-100 project-period ratio because derivation defaults to 100.
- Impact: a normal structural UI action silently changes labor budgets and other rows' version-owned ratios; it violates the independent-total and partial-ratio persistence contract and can subsequently recalculate monthly targets.
- Suggested fix: preserve each existing row's total and stored percentages for department identity/structure edits, using a dedicated patch or explicit ratio maps. Only import or explicit phase editing should replace allocation data. Add a focused regression covering rename/add/delete with an unaffected partial-ratio row and a complete two-decimal-ratio row.

No other concrete P1/P2 issue was established in the scoped UI/config review. The reviewed branches include scope/lock gates, create/copy modal isolation, atomic import callback, monthly year and full-cycle totals, cost read-only rendering, fee singleton permissions/persistence merge, fallback milestone model display, log entry/filter UI, and compact styling.

## Assessment

Changes requested for the P1 integration finding. Browser behavior and runtime evidence remain the controller's planned second-round verification; this review does not replace those checks.

## Review round 2 — targeted static follow-up

**Assessment: PASS for the reviewed UI fixes; the round-1 P1 is closed by the current implementation.** No new P1/P2 finding. This follow-up did not run tests, builds, or browsers and did not modify production code.

- `ResourceInlineDetail.tsx:49-50,76,144`: department identity edits, delete, and add now all call `saveDepartments`. It sends the unchanged independent totals plus explicit per-row percentages obtained from the current version. Existing row IDs resolve the version-owned percentage map; a new empty tOS/technical row derives zero percentages and a new capability row gets its 100% project-period default. Import remains an explicit single patch containing its parsed ratio map (`:86-94`). This removes the UI path that dropped partial or precise percentages.
- The current domain branch also preserves supplied totals and ratios (`resourceInlineEditing.ts:180-198`) and retains saved percentages for unchanged phase amounts when a legacy caller omits the map. This supports the reviewed UI contract; regression execution belongs to the domain/controller verification.
- `ResourceVersionWorkspace.tsx:69`: keying the action `Space` by `version.id`, `version.lockState`, and `version.isActive` correctly forces React to unmount/remount the action subtree when any input controlling its labels/icons changes. The mounted buttons and Tooltip children therefore receive the selected version's current labels and event closures, including when switching between two versions with identical status. Same-version lock or formal-status changes also remount the subtree. The key is scoped to the toolbar, so detail/monthly editor state is not reset by this measure. It is an appropriate static fix for stale retained children; the reported browser symptom still needs the controller's immediate-after-switch and lock/formal-toggle recheck.


---

# Resource formal workspace — independent domain review

Reviewed: `75b2eb4..56fdd55`, followed by focused fix review of `77f538c`, on 2026-09-20. Scope: Task 1 domain changes only; controller-owned UI/config changes are excluded. Requirements: `docs/superpowers/specs/2026-09-20-resource-formal-version-workspace-design.md`, including the confirmed rule that an unbalanced version cannot be set as formal.

## Assessment

**PASS — original P2 closed by `77f538c`; no open P1/P2 findings.**

### Closed P2 — Run formalization validation independently of version-creation eligibility

- **Closure evidence:** `77f538c` changes the formalization guard to edit access plus allowed budget type (`src/lib/resourceStoreActions.ts:113-118`), matching the executable lifecycle guard in `src/lib/hrVersionRules.ts:143-150`. It no longer calls `canCreateHrVersion` or depends on `status === 'active'`. Every permitted non-formal-to-formal transition now reaches ratio/monthly validation before the wrapped state mutation, including paused/cancelled projects.
- **Regression review:** Read `scripts/verify-resource-formal-status.mjs`; it covers all four categories and active/paused/cancelled states, rejects monthly imbalance and applicable incomplete ratios, checks unchanged state/audit on rejection, and retains successful balanced activation/deactivation without changing project status. The script was reviewed, not executed by this reviewer.
- **Original finding below refers to `56fdd55` and is retained for traceability.**

- **Changed location:** `src/lib/resourceStoreActions.ts:113-117` (specifically the `canCreateHrVersion(project, version.budgetType)` condition at line 115).
- **Scenario:** A retained HR project has `status: 'cancelled'` or `'paused'`, its non-formal version has an incomplete department ratio or an unequal monthly sum, and an authorized user sets that version as formal. The cancellation state can exist through the existing `cancelProject` action and persists in the project record.
- **Evidence:** The wrapper only calls `getResourceFormalValidationErrors` when `canCreateHrVersion` returns true. That helper requires `project.status === 'active'` (`src/lib/hrVersionRules.ts:94-100`). The wrapped `setVersionActive` still proceeds (`src/stores/hrTos.ts:291-293`, equivalent in all four stores), and `changeHrVersionLifecycle` checks edit access and allowed budget type but does **not** require an active project (`src/lib/hrVersionRules.ts:143-150`). Therefore a cancelled/paused project skips both balance gates and sets `isActive: true`. The existing workspace activation entry is gated by `canEditHrInScope`, which also has no project-status restriction; this is a reachable lifecycle path, not a direct `setState` bypass.
- **Impact:** Incomplete ratios or monthly allocations become the formal version, replacing any former formal version and changing the budget aggregate. This contradicts the explicitly confirmed formalization gate for retained project data.
- **Suggested fix:** Validate every authorized, allowed-budget transition from non-formal to formal, without depending on permission to **create** a version. Alternatively reject the lifecycle transition itself for cancelled/paused projects if that is the intended status contract. Add a focused regression for an unbalanced cancelled/paused project and assert that neither formal state nor success audit changes.

## Other reviewed contracts

- Named blank creation, numeric dot-segment validation, same-budget duplicate rejection, preserved display names and independent ordering.
- Explicit source-budget checks, deep snapshot copying, department/ratio identity remapping, monthly override preservation and machine snapshot retention.
- Independent department targets, incomplete ratios, 100% formal gate across all lifecycle-eligible project states after `77f538c`, deterministic one-decimal allocation, identity-only edits and legacy phase-write rederivation.
- Monthly finite/nonnegative/precision validation, existing valid outside-period month correction, scope/RBAC/bound-budget/lock checks.
- Project-owned field-level audit deltas in the same HR-store write, no-op/failed-write suppression, deletion history retention, persisted project/log payloads and background hydration/cross-tab paths.

No additional P1/P2 issues were found in those paths. Review was static and read-only except for this requested report; no build, test script, dev server, or browser session was run. Existing verification claims in `domain-report.md` were read as implementation evidence, not independently re-executed.


---

# Final independent branch review

**Result: PASS — no additional confirmed P1/P2 finding.**

Reviewed `b57a5a7` through HEAD `56fdd55` plus the current working-tree changes and new UI/config files, against `docs/superpowers/specs/2026-09-20-resource-formal-version-workspace-design.md` and its implementation plan. This was a static review only: no tests, build, dev server, or browser were run, and no implementation files were changed. A read-only `git diff --check b57a5a7` produced no whitespace diagnostics.

The separately reported paused/cancelled-project formal-validation gate belongs to the domain reviewer and is not duplicated here. The current wrapper uses allowed budget types for that gate rather than the creation-status predicate.

## Requirement coverage reviewed

| Confirmed requirement group | Code evidence and result |
| --- | --- |
| 1, 2, 3, 4, 5, 14, 16 — version controls and compact workspace | `ResourceVersionWorkspace`, `ResourceVersionDialogs`, `ProjectResources`, and `globals.css` implement the formal flag action, independent lock, named blank/copy creation, budget-category tabs, compact fields, and three-panel structure. Create/copy and monthly callbacks retain project/category/version identity. Saved display names are preserved independently of internal ordering. |
| 6, 7, 8, 10 — department labor and percentage editing | `ResourceInlineDetail`, `resourceInlineEditing`, `resourceRatios`, and the four stores retain independent non-machine targets and saved two-decimal percentages. Complete allocations conserve tenths. Partial percentages persist and remain visible. Capability uses a project-period percentage. Machine department/phase/total cells are read-only, with domain rejection of manual writes. Explicit model edits recapture configuration; refresh retains saved model snapshots and legacy manual values. |
| 9, 13 — milestone model display | `BudgetMilestoneSchedule` resolves a published template without requiring an existing schedule snapshot, computes comparisons for saved manual dates, and preserves saved snapshots. Missing templates retain the milestone fields with an unavailable-model indication. Anchor labels are simplified. |
| 11, 12 — monthly labor/cost presentation and fee configuration | `ResourceVersionViews`, `resourceMonthlyPresentation`, and `resourceVersionViewData` project only the selected version, assign each month to one group, retain whole-cycle totals across year filters, display allocation target/delta, and render cost cells as read-only. Global rate changes are subscribed through the config store. `FeeRateConfig` and the config store enforce an authorized, finite, nonnegative singleton; generic record actions cannot alter it. |
| 15, 17, 18 — operation audit, mocks, and persistence | `resourceStoreActions` wraps actual user mutations and appends project-owned audit deltas atomically. `resourceOperations` uses business labels and before/after values. Logs survive version deletion and can be filtered by version. Fresh four-category mocks now include ratios and creation/formal logs, while existing cross-year/multi-version fixtures remain. Fee defaults merge into old config data. Existing saved HR projects/versions/monthly rows are retained instead of replacing them with fresh fixtures. |

## Previously found issue

The round-1 P1 concerning department identity/add/delete actions resetting independent totals and precise ratios is closed. All UI structure actions now pass through `saveDepartments` with each remaining row's saved percentages. The domain also preserves the existing ratio map for unchanged phase amounts when a legacy caller omits it. The targeted round-2 assessment is recorded in `ui-review.md`.

The version-action toolbar is keyed by version ID, lock state, and formal state, so switching any label-defining state remounts its Tooltip/button subtree. This leaves the detail/monthly editor subtree independent.

## Verification boundary

This PASS is the independent code-review conclusion, not a claim that browser behavior, deployment parity, or the two requested runtime verification rounds have completed. Those execution results remain the controller's verification/release responsibility.
