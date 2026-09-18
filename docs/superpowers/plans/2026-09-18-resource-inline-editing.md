# Resource version inline editing

The user approved this interaction change directly on 2026-09-18. Scope is the project-space resources workspace on the existing feature branch. Existing resource-pipeline dialogs remain supported.

## Global Constraints
- After creating a version, show the saved detail layout directly. Remove the workspace whole-version new/edit form and its save/cancel footer.
- Editable fields display text with a small accessible edit icon. Clicking it enters editing; clicking elsewhere saves and returns to text. Enter saves, Escape cancels. Select/DatePicker popup interaction must not count as leaving the field prematurely. Validation failures retain the editor and explain the error without silently discarding the input.
- Update associated department totals, monthly distribution, chart, expense range and totals immediately from the saved store state.
- Preserve exact existing business labels, four category contracts, permissions, source readonly rules, lock and activation rules, snapshots, copy behavior and imports/exports. Locked versions have no content edits. No backend, deployment, dependency upgrade, root-checkout changes or unrelated redesign.
- Keep top tabs and placeholders. Reuse the present Ant Design style and detail hierarchy. No nested modal-like editing surface in this workspace.
- New versions use existing source/default values where meaningful; manually missing data remains blank (待填写). Do not invent business dates or pick arbitrary department/expense subjects. New and copied versions remain unlocked/inactive.
- Clicking new version must persist/select a version immediately without a separate form. Retain model-availability validation when no valid machine model can be selected. New version versus copy must stay distinct.
- Partial entry must remain practical: dates may be filled individually; incomplete department/expense rows can be filled cell by cell. Persist partial data intentionally with explicit inline-only APIs/options if necessary, while preserving strict legacy form/import validators. Invalid values, mismatched configured pairs, duplicate completed rows and reversed dates must still be rejected. An unfinished draft must never be mistaken for successful canonical save.
- Final acceptance requires two functional-test rounds, focused regression scripts, TypeScript check, production build, actual browser interactions and refresh persistence. User already authorized feature commit/push and local retention.


- User screenshot refinement: replace version Select and count with the same market-tab appearance used for OP/TR. Include activation and locking states in each version tab; remove the separate repeated version heading/state chips.
- Version toolbar copy/lock/unlock/activate/deactivate/export/delete use icon-only accessible buttons with Tooltip descriptions. The obsolete whole-version edit action stays removed.
- Remove the repeated detail summary of project name, budget type and estimate total (technical screenshot TDT项目/预算类型/预估投入). Retain relevant editable metadata and one workspace summary.
- Unlocked versions with edit permission show manual-department 添加部门/下载模板/导入 toolbar. Locked and other readonly versions hide it. Machine model-derived department rows remain calculated.

## Task 1: Implement direct creation and inline detail editing

Implement the complete scoped interaction across machine, tOS, technical and capability in the feature worktree. Prefer focused reusable modules: an inline field editor, typed resource mutation helpers, and a detail view composed of the existing domain sections. You may add focused files under project-resources and small additive inline props to shared components. Preserve legacy modal flows and source snapshot behavior.

Primary integration file is src/components/project-resources/ResourceVersionWorkspace.tsx. Remove mode=create/edit, new/edit modal imports and 编辑版本. Every editable metadata/batch/milestone/model/department/expense field in this workspace follows the icon-to-editor interaction. Machine calculated department amounts stay readonly; changing its coefficient/model immediately recalculates them. Manual departments retain add/delete/template/import. Expense inputs retain add/delete/template/import and linked selectors. Monthly view remains visible during editing and follows saved state.

Provide meaningful executable tests of direct creation, mutation validation, atomicity, related calculations, incomplete entry, frozen versions, source ownership and persistence. Add to npm verification script if useful. Test editor lifecycle with a lightweight actual handler/hook harness if available; root will perform real browser QA independently. Do not test mere source tokens in place of behavior.

Files allowed: src/components/project-resources/*; focused additive props in four hr-category detail/shared components if needed; minimum required store/lib/types changes to support safe inline writes; src/styles/globals.css; focused scripts and package script. Do not edit docs/qa (root owns), do not modify other workflows unless necessary for compatibility.

Run focused tests and npx tsc --noEmit. Do not run npm build or change preview processes (root owns). Commit only your task files once checked. Write a concise implementation report with design choices, validation commands/output, changed APIs, and any concerns.

## Task 2: Independent acceptance and release (controller)

Review Task 1 diff with a fresh reviewer; resolve findings. Run two actual functional rounds including all four categories, linked/locked versions, date/select popup behavior, totals, direct creation, copy and refresh. Check production build and regression suites, update QA documentation, commit and push feature; verify local and remote parity. Keep user files and root checkout intact.
