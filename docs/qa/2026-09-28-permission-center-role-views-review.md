# 角色与人员权限最终审查记录

## 领域审查

# Task 1 domain review

Reviewed working domain diff against `eae0fbf`, implementation plan and role-view design. No UI review, build, full suite or browser execution performed.

## Finding

**[P1] Reject incomplete legacy conditions before resetting to privileged demo seeds.**

Evidence: `src/lib/permissionCenter.ts:182` accepts `condition.value === undefined` for every operator. `isValidLegacyPermissionCenter` at line 192 relies only on this structural check. `src/stores/permission.ts:397` consequently resets that accepted v1 snapshot to `createPermissionCenterSeed()` rather than denying it. This is a new privilege restoration path: ordinary policy validation rejects the same condition, yet migration creates default superadmins 01/07.

Repro: construct an otherwise valid v1 snapshot with a fixed builtin superadmin assigned only to 演示用户02, and a `project.view` policy with `data = {mode:'conditions', conjunction:'all', conditions:[{id:'broken',field:'name',operator:'eq'}]}` (missing value), valid legacy users/departments, and all columns. `validateMenuPolicy` after removing legacy assignee properties returns `{ok:false,error:'条件未完整，尚未生效'}`. Nevertheless `isValidLegacyPermissionCenter(old)` returns true; `migratePermissionState({permissionCenter:old},3)` returns no `permissionCenterError`, and `isPermissionCenterAdmin(migrated.permissionCenter,'演示用户01')` returns true. Reproduced with repository TypeScript module loader in Node.

Requested correction: validate condition completeness/operator-value compatibility before allowing a legacy seed reset, including empty lists/strings and known numeric/date fields; preserve legitimate dynamic metadata without treating incomplete conditions as valid. Add this scenario to the corruption regression.

## Verification and remaining assessment

- `node scripts/verify-permission-center.mjs`: passed, including safe per-role projection and storage failure rollback.
- `node scripts/verify-permission-center-role-assignees.mjs`: passed.
- `node scripts/verify-permission-center-corruption.mjs`: passed, but does not currently cover the reproduced missing-value case.
- Reviewed role users/departments as the authoritative membership across menus, v2 rejection of menu assignees, fixed builtin bypass, per-role row/column projection, project-only migration boundary (<3), preservation of v2/project slots, and assignment validation/atomic commit. No other actionable defect found in these areas.
- Existing write-failure verification checks model identity is unchanged when storage refuses the write.

Verdict: changes requested for the confirmed legacy migration defect above. No speculative improvements included.

## Scoped fix re-review

The original P1 is fixed in current working files. `src/lib/permissionCenter.ts:182-195` now validates required selected columns, condition identifiers, operator compatibility and operand completeness/types before legacy recognition can seed authority.

Independent Node assertions re-ran the exact missing `eq` value repro and added empty `in` list, invalid numeric operand and selected columns omitting required `name`. All returned false from legacy recognition, a corruption error from migration, and no 演示用户01 administrator grant. Complete dynamic conditions and selected dynamic columns are retained; v2 evaluation denies before field registration and grants only matching rows after registration.

The new assertions in `scripts/verify-permission-center-role-assignees.mjs:62-99` cover missing operands/required columns, actual v3 storage-envelope refresh and serialized v4/v2 readback, custom assignee persistence across fresh module load, assignment storage failure rollback, dynamic legacy conditions and rejection through the actual corrupt-envelope reader.

`node scripts/verify-permission-center-role-assignees.mjs` independently rerun: exit 0, including actual envelope refresh/reload and atomic storage failure checks. Final Task 1 verdict: **clean — no remaining actionable domain findings in the reviewed scope**. Initial P1 above is retained as review history and is resolved.


## 界面审查

# Task 2 UI review

Reviewed the working-tree UI delta against `eae0fbf`, including the implementation plan and role-views design. Read-only review of production code; no build, full regression, or browser run.

## Final verdict

PASS for this scoped static/component review. No open findings. The sole reported retry defect was fixed and its original reproduction is closed. Browser/layout and full-integration verification remain with the root integration pass.

## Resolved finding

### [P2, resolved] Assignment retry bypasses pending-condition protection

`src/components/permission-center/RoleAssignees.tsx:26-31`

After a role-assignment save fails, its retry closure remains in `RoleAssignees` while switching between functional/data tabs. Begin an incomplete data-filter condition: the assignment selectors correctly become disabled through `conditionDirty`, but the error banner's Retry button remains enabled and invokes the stored mutation without checking the current draft state. If persistence has recovered, role membership changes immediately while the data filter is still incomplete. This regresses the previous PolicyEditor's inside-the-retry draft guard and violates the retained pending-condition protection contract.

Original reproduction: fail a role-assignment persistence attempt; select Data permissions; begin an incomplete filter; restore persistence; click the assignment banner's Retry. The assignment store action executed. A focused Node harness transpiled the actual RoleAssignees component, retained its hook state across renders, simulated save failure, rerendered with `conditionDirty=true`, and invoked the rendered Retry: a second mutation call occurred.

Re-review: `RoleAssignees.tsx:18-19,28-36` now keeps the current dirty flag in a ref, checks that ref inside the retained retryable closure, and disables Retry while dirty. Independently reran `node scripts/verify-permission-center-assignee-ui.mjs`: PASS. This actual-component regression verifies the disabled button, directly invokes its callback anyway to confirm no mutation occurs, checks the guard feedback, then resolves the draft and verifies that retry succeeds exactly once and clears the error.

## Verified

- `node scripts/verify-permission-center-matrix.mjs` passed: every configurable menu once, HR exclusions, hierarchy depth, full-parent-path row spans, filtered span coverage, blank-cell alignment.
- `node scripts/verify-permission-center-assignee-ui.mjs` passed in the scoped re-review: pending-condition retries stay blocked and resume after resolution.
- `git diff --check -- src/components/permission-center scripts/verify-permission-center-matrix.mjs` passed.
- Function checkboxes disable existing invalid policies; explicit empty-policy reset retains deny-by-default actions. The previously reported checkbox reset issue is fixed in current source.
- Role-level members/departments use `setCenterRoleAssignees`; PolicyEditor no longer exposes per-menu membership or functional controls.
- Person functional cells call `evaluateMenuPermission`; data view retains each source role's complete data/column policy and explains union semantics.
- Data menu tree filters using dynamic field registration. View/tab/role/person/data-menu selection routes through the shared edit guard.
- Current-user switching is protected by `GlobalPermissionContainer` rendering `<PermissionCenter key={user} />`, so retained mutation closures are discarded across actor changes. A component-only actor-prop retry concern is not an application defect and is excluded.

## Verification boundary

Static inspection found responsive scroll/wrap rules, existing PMS segmented/chip styles, and live model subscriptions. Actual narrow-screen geometry, persistence/revocation flows, and runtime browser errors remain for the root integration pass.


## 最终集成审查

# Final integration review

Reviewed current working changes against `eae0fbf`, role-view design/plan, task review records, and existing global-menu, project-registry/list and roadmap permission consumers. Read-only production review; no build, full suite, browser, commit or push.

## Finding

### [P1] Preserve valid all-data policies that retain an unfinished inactive condition

Location: `src/lib/permissionCenter.ts:184-190` (`isStructuralPolicy`). The new parser validates every retained condition even when `data.mode === 'all'`. The actual editor intentionally retains `draft.conditions` when switching to 全部数据 (`src/components/permission-center/DataPolicyEditor.tsx:97-101`), and `validateMenuPolicy` accepts that saved state because inactive conditions do not constrain the all-data policy. Consequently an ordinary supported UI action saves successfully but the next reload drops the entire policy. For an existing v1 snapshot the same mismatch fails legacy recognition and `src/stores/permission.ts:385-386` replaces the whole center with an empty corrupt state, preventing all global access including the configured superadministrator.

Repro: select an ordinary role with a data-menu view grant; choose 符合筛选条件的数据; leave its newly added condition incomplete; choose 全部数据; reload. The persisted policy contains `data = {mode:'all', conjunction:'all', conditions:[{id:'condition:draft', field:'', operator:'eq', value:''}]}`. A focused Node repro using the actual TypeScript modules and seeded `roadmap-reader-A` / `roadmap.table` reports `validateMenuPolicy(...).ok === true`, user04 view permission before reload true, but after `parsePermissionCenter(JSON.parse(JSON.stringify(model)))` permission false and policy absent. Converting the same legitimate snapshot to v1 and running `migratePermissionState(snapshot, 3)` reports the corruption error and removes user01 superadministrator authority.

Required correction: align persistence recognition with active-policy semantics. Normalize or safely accept retained inactive conditions when mode is all; continue strictly rejecting incomplete **active** conditions so the earlier corruption privilege-restoration fix remains intact. Cover both a v2 save/reload and v1 upgrade generated by the incomplete-filter -> 全部数据 workflow.

## Verified / remaining scope

- `node scripts/verify-permission-center-global.mjs`: passed, including live authorization, corruption, migration scope and standalone fallback checks.
- `node scripts/verify-permission-center-role-assignees.mjs`: passed, including v2 envelope refresh/reload and atomic assignment write failure.
- `node scripts/verify-permission-center-matrix.mjs`: passed, including menu coverage and full-parent-path row spans.
- Role membership is the common evaluator input for global-menu operations, project registry/list projections and roadmap projections. Existing per-role row/column projection remains intact.
- Person view is read-only and retains separate source-role scopes; all assigned users are collected independently of action grants. No additional actionable finding in ordinary seeded/UI-generated source data.
- The prior assignment-retry issue is visibly guarded by a live dirty ref and disabled retry button. Actor remounting in `GlobalPermissionContainer` avoids stale component callbacks on identity changes.
- Root owns actual full-suite, TypeScript/build, narrow-screen and browser persistence/revocation evidence.

Initial verdict: **changes requested** for the confirmed persistence/upgrade defect above. The original finding is retained as review history; see the resolved re-review below.


## Scoped P1 fix re-review

The persistence/upgrade P1 is resolved in the current working files. `isStructuralPolicy` validates the envelope, actions and active column settings, then accepts all-data without interpreting inactive condition entries. `parsePermissionCenter` canonicalizes inactive conditions to an empty list, and `updateMenuPolicy` applies the same normalization before persistence. Strict validation remains in place for active conditional policies.

Independent execution of the exact original seed-based reproduction confirms: the saved all-data policy survives JSON parse/reload, user04 retains roadmap access, and the dormant condition is removed. The same legitimate v1 snapshot is recognized, while changing only its mode to conditions remains rejected; the equivalent active invalid v2 policy does not authorize.

`node scripts/verify-permission-center-inactive-conditions.mjs` independently rerun with exit 0. This covers actual store saving and a fresh module reload, existing v2 dormant-draft parsing, actual v1 envelope upgrade, and active incomplete v1/v2 denial. No production changes, browser execution, build or full suite were performed during this scoped review.

Final verdict: **clean — no remaining actionable findings in the reviewed integration scope**. Browser execution of the exact switch-to-all/reload interaction and broader release checks remain with the root integration pass.
