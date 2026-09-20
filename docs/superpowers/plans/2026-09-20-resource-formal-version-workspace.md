# Resource Formal Version Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all 18 resource requirements with named formal versions, ratio editing, monthly labor/cost views, auditing and safe release.
**Architecture:** Keep four persisted HR stores and shared scope rules. Add explicit resource actions and pure domain helpers for naming, ratios, audit and monthly validation; bind compact React views to these actions. Preserve data-only cross-tab persistence.
**Tech Stack:** Next14 / React18 / AntD6 / Zustand4 / TypeScript / existing Node verifier scripts.
**Spec:** docs/superpowers/specs/2026-09-20-resource-formal-version-workspace-design.md

## Global Constraints

- Work only in feature-project-auto-scheduling; base b57a5a7. Dirty root untouched.
- No dataset reset, branch force-push, or deletion of existing data. Browser via CUA only.
- Lock and scope/RBAC apply in store actions and UI. Formal status remains independent of editability.
- Requirements1–18 mapped into tasks below. No additional user approval needed for already authorized implementation/release.

### Task 1: Version, ratio, monthly-edit and audit domain

**Files:** src/types/hr{Machine,Tos,Technical,Capability}.ts, src/lib/{hrVersionRules,resourceInlineEditing,resourceAllocation,hrProjectSync}.ts, src/stores/hr{Machine,Tos,Technical,Capability}.ts; new src/types/resourceOperations.ts, src/lib/resourceOperations.ts, src/lib/resourceRatios.ts; scripts/verify-resource-formal-domain.mjs.
**Produces:**
- `createResourceVersion(projectId,budgetType,scopeId,{versionNumber,sourceVersionId?}): string` on all stores; blank by default, explicit source copy, name validation/preservation.
- `updateResourceMonthlyInvestment(projectId,versionId,rowId,month,value,scopeId): void` on all stores; validate/write/audit one cell.
- `ResourceInlinePatch` adds `{type:'departmentRatio',rowId,key,value}`; `departmentTotal` preserves percent weights for non-machine; machine department writes rejected.
- `getResourcePhaseRatios(category,version,row): Record<string,number>` and `getResourceRatioFields(category): {key,label}[]` from resourceRatios.ts. Capability key `projectPeriod`.
- `ResourceProject.resourceOperationLogs?: ResourceOperationLog[]`; ResourceOperationLog `{id,versionId,versionNumber,budgetType,operator,timestamp,action,changes:{field,before,after}[]}` from resourceOperations types. Persist audits atomically with actual actions; no-op/refresh excluded.
- `ResourceVersion.departmentPhaseRatios?: Record<string,Record<string,number>>`; optional custom-name marker to survive normalize; helpers report ratios/month balances before formal status set.

- [ ] RED tests actual stores: custom V7.2 survives refresh/copy/reload; duplicate name rejects without mutation; blank vs copy isolation; ratio33.33/33.33/33.34 sums100 and rounded amounts match total; zero/malformed/over100; capability100; machine rejects manual department writes; locked/month/scope rejects; no-op logs absent; delete logs survive; cross-tab converges.
- [ ] Implement domain at shared boundaries and adapt 4 stores without new persistence loops. E.g. `assert.equal(getVersion().versionNumber,'V7.2')` after `await store.persist.rehydrate()`.
- [ ] Run domain plus relevant lifecycle/storage scripts, update intentionally superseded old tests with explicit evidence, tsc and commit only owned files.
- [ ] Independent task review.

### Task 2: Resource UI and config (controller implementation alongside bounded domain task)

**Files:** ResourceVersionWorkspace.tsx, ResourceInlineDetail.tsx, ResourceVersionViews.tsx, BudgetMilestoneSchedule.tsx, ProjectResources.tsx, resourceVersionAdapter.ts, new create/log modal and pure monthly view helpers; src/types/hrConfig.ts, src/constants/hrConfig.ts, src/stores/hrConfig.ts, ConfigContent.tsx, ConfigContainer.tsx, globals.css.
**Consumes:** Task1 exact store actions, ratio helpers and audit types. Existing preserved legacy fields stay readable.

- [ ] Add feeRate config singleton with current config permissions, one nonnegative number, default mock rate and durable merge; dedicated compact edit control rather than generic record add/delete.
- [ ] Version tabs extraContent contains create and category logs, new modal user-specified number/source, flag icons, remove batch/caption/title, compact metadata.
- [ ] Render basics+milestones and investment tabs as separate panels; machine readonly number(percent), others percent(number) and ratio editors; controls=false number inputs, one border.
- [ ] Resolve fallback template model before schedule button, always show stage metrics and manual dates; simplify anchor labels.
- [ ] Monthly view calculations and UI: years, totals/peak/period/stagecards, labor/cost tabs, grouped month columns, yearly/global totals, editable labor/month with target +/- feedback. Preserve hidden months and version selection isolation.
- [ ] Test pure calculation boundaries, component callbacks and accessible controls; browser actual select/date/numeric/lock/version-create/log flows; commit and independent review.

### Task 3: Integration, fixtures, two QA rounds and release

**Files:** fixtures and focused verification scripts, package.json, docs/qa/2026-09-20-resource-formal-workspace.md.
- [ ] Complete realistic 4-category mocks/new fields without resetting existing storage; creation actions should log true current actor and dates.
- [ ] Round1 domain integration/perms/persistence/import/export consumers. Round2 actual browser create blank/copy/manual version, official switching/cancel, locked edit rejection, ratio totals, monthly correction, fee/year/read-only cost, manual scheduling and audit details.
- [ ] Independent whole increment review, resolve findings; `npx tsc --noEmit`, `npm run build`; server refresh and final browser on frozen source.
- [ ] Push feature; clean release worktree merge/push dev then master; sync local dev/master; verify matching trees and remote refs; Vercel READY exact mainline commit, named live flow and runtime error query. Record any concrete blocker honestly.
