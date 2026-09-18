# Task 2 report — budget milestone scheduling

## Result

- Added a budget-only milestone scheduling flow for machine, tOS, and technical resources. The two category anchors are displayed before the `里程碑信息` heading and schedule all mapped intermediate milestones from the newest published template.
- Saved each schedule with an immutable model snapshot containing the published template version, mapped milestones, stage ownership, intervals, and total model days. Later manual milestone edits update scheduled metrics while model metrics remain tied to the saved snapshot.
- Rendered the milestone row by template stages with colored headers and `排布N天(xx.xx%)/模型N天(xx.xx%)`. Unmapped trailing lifecycle dates remain in a `手动维护` group and are never overwritten by auto scheduling.
- Added one atomic `milestoneSchedule` resource patch. The full snapshot, mapped keys, dates, source ownership, scope, editable version state, RBAC, and complete milestone order are validated before the store writes the new version. Machine derived `STR5+6个月` and non-labor month ranges still follow saved dates.
- Added fresh-install mock models and examples for all three categories. Default drafts and default published V3 snapshots use the same 100-day interval models; bound budget fixtures include scheduled dates and a saved model snapshot.

## Mock and persistence behavior

- Fresh plan-store initialization seeds machine/tOS/technical draft intervals and published V3 snapshot intervals only through the initial builders.
- Existing persisted draft values and same-key published snapshots win during Zustand rehydrate/migration, including intentionally empty interval models. They are not silently filled or replaced.
- Existing persisted resource versions are not backfilled with `scheduleModelSnapshot`; newly seeded fixtures supply examples only when the mock dataset is first created. The mock dataset version was not bumped, and localStorage is never cleared.
- An old persisted dataset therefore keeps its current records. Users can schedule an editable budget version from the current latest published template and thereby save a snapshot normally.

## Verification

- RED: focused schedule verifier initially failed because the schedule module was absent, then failed on missing store snapshot defaults, then failed on missing default milestone interval values.
- GREEN: `node scripts/verify-budget-milestone-scheduling.mjs`
  - covers all three anchor mappings; newest published selection; exact endpoints; unequal weights and rounding; missing, zero, unknown, and out-of-order nodes; manual metric changes; malformed snapshot rejection; atomic store writes; scope/RBAC/lock guards; investment and expense calculations; copy and reload independence; fresh defaults; and persisted-value preservation.
- `npx tsc --noEmit`
- `node scripts/verify-resource-inline-editing.mjs && node scripts/verify-resource-inline-editor.mjs && node scripts/verify-resource-inline-render.mjs && node scripts/verify-resource-inline-date.mjs && node scripts/verify-resource-inline-import.mjs`
- `node scripts/verify-resource-version-lifecycle.mjs && node scripts/verify-resource-version-workspace.mjs && node scripts/verify-resource-empty-project-persistence.mjs`
- `node scripts/verify-template-intervals.mjs && node scripts/verify-template-interval-ui.mjs`
- `node scripts/verify-project-resource-fixtures.mjs && node scripts/verify-resource-dataset-refresh.mjs`
- `node scripts/verify-hr-resource-regressions.mjs && node scripts/verify-machine-end-milestones.mjs && node scripts/verify-technical-resource-followup.mjs && node scripts/verify-resource-expense-followup.mjs`
- `git diff --check`

All commands above exited 0 in the implementer worktree. Per controller instruction, the implementer did not run production build, start/stop services, or browser automation; the controller owns those checks.

## Review notes and remaining acceptance risk

- Direct keyboard entry in the two anchor DatePickers uses the existing input-capture helper before blur/Enter. Browser acceptance still needs to confirm Ant Design's native input event sequence in the connected UI.
- Stored schedules intentionally remain bound to their saved template snapshot. Publishing another template changes only the next schedule action, not existing model metrics.
- Bound formal-source budget fixtures are readonly by design; their prefilled schedules demonstrate rendering. Editable unbound budget fixtures exercise the scheduling action.
