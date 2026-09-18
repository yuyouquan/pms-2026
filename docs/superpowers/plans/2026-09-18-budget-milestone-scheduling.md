# Budget milestone scheduling and template interval configuration

User requirements approved directly in this conversation; this plan records the continuation across the two connected tasks.

## Global Constraints

- Configuration center 一级计划 and TDT项目计划 remove the role column. Second-level milestones have editable nonnegative interval days; stage interval and percentage are derived from direct milestone children. Percentage denominator is the sum of all populated milestone intervals in this template. Show total cycle before the task search. Search/collapse do not change calculations. Published templates are readonly; preserve historical values and revision inheritance. Subproject and MR templates retain existing behavior.
- Budget project space resources gains two milestone completion-date inputs to the left of 里程碑信息. Anchors by category: machine 概念启动 + STR5; tOS 规划KO + STR5; technical 规划启动 + EDCP. These are planned completion dates, not duration input or task start dates.
- With both endpoints, allocate intermediate planned completion dates proportionally to configured milestone intervals. Both endpoints must remain exact after integer calendar-day rounding. Users may subsequently edit individual dates using the existing inline autosave interaction. Validate order atomically; no partial schedule write on failure.
- Match project-space horizontal plan visual hierarchy: colored stage headers above milestone names and planned completion dates. Replace duration text with 排布N天（xx.xx%）/模型N天（xx.xx%）. Scheduled metrics derive from current saved dates and update on manual changes; model metrics derive from the plan-template intervals.
- Budget projects only receive scheduling actions; formal/source readonly behavior and locked versions remain protected. Capability was not named by the user and keeps its current date section.
- Reuse existing domain milestone labels, fields and phase ownership. Do not copy illustrative labels/data from screenshots. Keep resource investment and monthly/expense recalculations connected to the saved dates. Preserve locked snapshots and copy independence.
- Preload usable mock interval templates and budget scheduling examples for all three named categories, including default drafts and published templates; preserve existing saved user edits and avoid resetting the mock dataset.
- Work only in feature-project-auto-scheduling; preserve the dirty root checkout. No dependency upgrade/backend/deploy. Finish at least two functional rounds, focused regression, tsc/build, review, commit/push to existing feature, local retention already authorized.

## Task 1: Template intervals (controller, already implemented)

Complete pending template review fixes, actual browser two-round validation, meaningful calculation/render-handler persistence tests and documentation. Files owned: ConfigContainer.tsx, stores/plan.ts, lib/templateIntervals.ts, lib/versionCompare.ts, scripts/verify-template-interval*.mjs, package.json.

## Task 2: Budget milestone scheduling (implementer)

Implement pure schedule math and plan-template mapping; atomic store mutation through resource inline APIs; budget-only horizontal resource milestone view with the category-specific date inputs and schedule/model metrics. Own project-resources resource detail/new scheduling components, resource inline helper, minimum hr store/type additions, styles scoped to new view, and focused scheduling scripts. Do not edit Task 1 files or package.json; send the command to the controller for integration. Controller owns preview/build/browser and QA docs.

Use newest published plan template of the category and a model snapshot per resource version/schedule so locked/copied models do not drift. If no published template with usable mapped interval weights exists, explain why schedule cannot execute; manual dates remain usable. Do not invent intervals. Model snapshot includes version identity and milestone/stage mapping. Each interval represents the time into its milestone; the first anchor has no preceding interval in the selected scheduling window and is excluded from allocation. Trailing manual lifecycle dates are not overwritten. Model metrics for a phase are the sum of applicable configured intervals; schedule metrics use actual date gaps for those same milestone boundaries. Incomplete dates display an unavailable metric rather than a fabricated duration.

When a required endpoint name/field is unavailable, mapped node order conflicts, or unknown nonzero template nodes cannot be represented by existing resource milestone fields, fail clearly rather than silently dropping model days. Stage grouping should match template phase membership for mapped milestones, and preserve existing remaining resource milestones with readonly/manual ownership.

Implement meaningful TDD tests: three category endpoint mappings, exact anchors, unequal weights and rounding, missing/zero weights, order validation, scope/RBAC/lock guards, atomic batch save, manual edit metric change, snapshot/copy/reload independence and existing calculations. No additional agents. Commit task-owned files only and write task report.

## Task 3: Acceptance and release (controller)

Review Task 2 independently, resolve findings, test the connected template -> publish -> budget resource scheduling -> manual modification -> lock/copy/reload flow, record results and push after verification.
