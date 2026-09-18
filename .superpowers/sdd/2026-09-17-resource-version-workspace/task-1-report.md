# Task 1 report — lifecycle and aggregate consumers

Implemented shared activation/lock/copy rules and all four typed stores. Every new version is inactive; migration selects latest only when the whole legacy budget group lacks an explicit active flag, and deterministically resolves multiple active flags. Explicit all-inactive groups remain inactive after rehydration. Actual latest selectors still serve default selection and numbering.

All content write entrances now guard lock, registry permissions and allowed budget scope. Locked versions skip source milestone/model/nonlabor synchronization and fixture backfills; locked monthly rows remain exact snapshots. Historical unlocked versions accept edits. Capability detail has optional fifth `{ projectStartTime, projectEndTime }` argument with date-order validation. Explicit historical machine model edits capture the chosen model snapshot.

Copy is available in every store, allows locked sources, preserves batch/business snapshots/manual monthly allocations, gives fresh version and monthly identities, records copied source identity, deep-clones nested values, and does not mutate source logs. Source operation logs are not copied. Bound annual source writes stay denied.

Stores retain monthly records for every version. HrResourceScope selects active versions only for external pipeline aggregation and all visible versions for project scope; lifecycle setters are business actions, not scoped UI setters. Legacy project lists aggregate active versions and show 未激活; history/monthly editing uses unlocked plus access guards. Locked-source copy remains available in existing technical/capability history entry points.

## RED / GREEN evidence

- RED: `node scripts/verify-resource-version-lifecycle.mjs` exited 1 before implementation: `AssertionError: Machine active action exists`, actual `undefined`, expected `function`.
- GREEN: same command exited 0 after implementation, with PASS lifecycle API plus PASS Machine / Tos / Technical / Capability.
- Assertions cover required APIs, legacy/multiple-active migration, explicit zero migration/reload, new inactive state, copy inactive state, activation switching and budget isolation, historical edit, locked batch/nonlabor/department/delete/monthly writes, latest locked snapshot across actual model configuration and plan date changes plus reload, manual copy allocation survival on refresh, no source mutation, unlock, actor permissions and bound-source denial.
- `npx tsc --noEmit`: no task-owned errors; integration run reports in-progress root-owned workspace errors (ProjectResources argument counts, ResourceVersionViews nullable scope arguments, missing exportResourceVersion module, heterogeneous version array generic inference). Root informed. Full final typecheck/build/browser verification belongs to root.
- `git diff --check` passed after whitespace cleanup.

Existing scripts asserting latest-only editability or latest-only monthly row storage encode superseded requirements and may need integration fixture updates; those changes are outside this task's ownership.

## Review follow-up: copied snapshots and manual fixture allocations

Independent review reproduced a copied locked machine snapshot being replaced by current configuration/plan data on refresh. Added a RED case that clears model configuration and shifts published plan dates before copying, then refreshes and rehydrates. RED reported copied investment 100 → 0, model snapshot emptied and copied milestone/nonlabor ranges changed.

Fixed background synchronization to retain a copied version's saved business snapshot in every category. Machine model fixture preparation and current-model snapshot replacement also exclude copied records. Explicit user edits normalize dependent nonlabor ranges in the write path; an actual changed model option recaptures/recalculates the machine snapshot. Re-submitting unchanged model fields during an unrelated save does not require the old model to remain in current configuration and does not recalculate.

GREEN: `node scripts/verify-resource-version-lifecycle.mjs` passes all four categories including full copied-version equality after changed model/plan dependencies + refresh + reload, unchanged source, same-valued model submission, and explicit coefficient change followed by stable refresh/reload.

Also fixed the fresh fixture manual-month allocation seed to key by project + version, rather than only project. Storing all versions had otherwise assigned the demo edit only to the oldest version and removed the existing current-source manual allocation scenario. `node scripts/verify-project-resource-fixtures.mjs` passes after this correction.

Forms agent/root informed of copied edit initialization needing saved formal milestones and machine level; that UI follow-up is outside Task 1 ownership.
