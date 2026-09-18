# Resource cell editing and bidirectional totals

Explicit user request in current conversation authorizes the six changes and prior two-round verification + feature push. Base b7ffa08. Work in feature-project-auto-scheduling only; dirty root checkout must remain intact.

## Global Constraints

1. Editable saved fields enter editing by clicking the whole field area. Remove trailing pencil icons; hover/focus indicates editability. Preserve keyboard activation, outside click/blur save, Escape cancellation, validation errors, navigation guard and readonly enforcement.
2. Version tabs show no inactive marker; active uses an icon. Locked and unlocked both use icons. Accessible names and hover tooltips explain statuses; actions/unique activation semantics remain unchanged.
3. Rename 后续里程碑 to 后续阶段.
4. Center department investment and non-labor investment table content, including totals/headers/editors.
5. Move editable per-department 预估投入合计 after 二级部门, before phase columns. Editing total proportionally distributes labor across the represented phases; editing any phase recalculates row total and version aggregate. Includes machine/tOS/technical and preserves capability's existing single total. Full precision reconciliation to 0.1 person-month, nonnegative finite validated values, atomic failures. Machine currently derives rows from saved HR-model snapshot; manual edits must persist per-version without mutating global HR config or silently reverting during source sync/copy/reload/monthly/export.
6. Add editable per-item 预估投入合计 after 三级科目. Editing total evenly distributes over currently displayed months, reconciled to cents; month editing updates row total. Retain off-range amounts for later recovery, but totals reflect displayed range as existing non-labor rules do. No months => clear validation instead of losing amounts. Units remain current application units (人月 for labor, 元 for non-labor).
7. All mutation paths enforce existing scope/RBAC/bound-source/lock guards. Preserve copied/locked snapshots, existing monthly manual edit preservation and source ownership. No global dataset reset or dependency changes.

Allocation rule: use current saved milestone dates and each displayed labor phase's established boundaries, including trailing phases. Calendar-day difference, same-day interval zero. If necessary dates are missing or overall duration zero, reject positive total allocation with an actionable error; do not invent weights. Zero total may clear values. Phase edits remain available without complete dates. User was asked whether to prefer actual allocation or model; actual was the recommended option and is the implementation default unless corrected.

## Task 1: Interaction presentation (controller)

Own ResourceInlineField.tsx, ResourceVersionWorkspace.tsx, BudgetMilestoneSchedule.tsx label-only, scoped globals.css, targeted interaction/status render test updates. Full-cell trigger, keyboard/hover, icon statuses, centered CSS and 后续阶段 label. Preserve existing data/session semantics. Do not edit investment detail/non-labor/domain allocation files owned by Task2.

## Task 2: Bidirectional allocation (implementer)

Own ResourceInlineDetail.tsx, NonLaborInvestmentSection.tsx, resourceInlineEditing.ts, dedicated allocation helpers, necessary hr types/store/constants/monthly/view/export consumers, and focused new behavior tests. Do not edit controller files or package.json/docs QA. Read existing domain data flow first and integrate saved per-version machine overrides so all summaries/monthly/export remain coherent. Machine model changes must have explicit behavior preserving valid manual investment data; do not silently erase overrides on unrelated date edits.

Implement human per-row total editing weighted by phase date durations; phase edits recalculate row/version totals. Non-labor per-item total editing equally distributes current months; preserve out-of-range values and use current nonLaborTotal semantics. Validate totals and all new mutations at store boundary atomically. Frontend calls a purpose-built atomic patch as needed. Keep legacy forms/import/export interoperable. Include tests covering allocation sums/rounding/0/missing dates/invalid totals, all categories, model-derived machine edit persistence, summaries/monthly/export, per-item months/out-of-range data, manual reverse calculation, read-only/scope/RBAC, copy/lock/reload isolation. Test first meaningful failures. No subagents or build/server/browser calls. Commit task-owned files only and report results/risks.

## Task 3: Acceptance/release (controller)

Independent task review, fixes and final integration review. At least two functional rounds plus focused regressions, TypeScript/build, real browser interaction including all new editable controls/status/locks/totals/dates/months. QA doc, commit, push current feature, verify remote/local parity and preserve local preview.

## Post-deployment regression: cross-tab storage convergence

Production acceptance exposed a two-tab storage loop, reproduced with real stores and storage events: two tabs with different machine activeTab values continue alternating persist payloads because UI fields are serialized, merge retains each tab's UI, and no-op refresh still invokes Zustand persist. Fix HR refresh no-ops to avoid writes and persist only durable project/version/monthly/migration data. Preserve legacy payload compatibility and true cross-tab data updates. Add a bounded event harness covering different local UI, actual total/phase/copy changes, source refresh, locks and reload. Re-review, rebuild, and release the same feature→dev→master route without deleting user storage.
