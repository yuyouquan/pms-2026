# Project Management and Resources Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task. Read the named design and retain the user's final milestone correction.

**Goal:** Unify formal, budget and roadmap project creation; expose project-scoped HR versions alongside existing cross-project summaries.
**Architecture:** The PMS project store owns project identity and configuration. Four existing HR stores retain their calculations and version records, joined by stable project IDs. Roadmap and project views filter/project the same registry.
**Tech Stack:** Next.js 14, React 18, Ant Design 6, Zustand 4, TypeScript; existing Mock/localStorage persistence.
**Spec:** `docs/superpowers/specs/2026-09-11-project-management-resource-design.md`

## Global Constraints

- Work only in the current `codex/feature-project-management-space` worktree; preserve all unrelated main-checkout changes.
- Header labels: 工作台、项目管理、项目组合管理、tOS路标、人力资源管道、配置中心。
- Project management tabs: 项目配置、项目视图. Creation button: 新项目. Creation modal: 新增项目.
- Project attributes: 正式项目、预算项目、路标项目. Project types: 整机产品项目、tOS版本项目、技术项目、能力建设项目.
- Formal milestones are read from that formal project's level-one plan and are never manually editable. Budget milestones are manually editable at creation and on latest versions even when bound; never synchronize them from formal plans. Roadmap resource estimates remain empty.
- Formal projects create only 项目概算/项目预算; budget projects create only 年度预算. Linked annual versions in formal space are read-only references to the budget source.
- All mutations enforce permissions and validation in addition to visible button state. Binding uniqueness is formal-project ID plus source project attribute, with matching project type.
- Single-project and cross-project views share version data but not filter/modal navigation state. Keep original IDs/history/monthly edits during migration; no fuzzy name joins or silent destructive migration.
- Use alias imports, existing Chinese labels and shared styles. Do not add dependencies or a new test framework. Use existing behavioral Node verification helpers, TypeScript, build, browser verification.
- Feature-branch commit and push are authorized. No mainline merge or deployment.

## Task 1: Registry identity, minimal creation, binding and audit

**Files:** Create `src/types/projectRegistry.ts`, `src/lib/projectRegistry.ts`, `scripts/verify-project-registry.mjs`; modify `src/types/app.ts`, `src/stores/project.ts`, relevant project permission/source helpers only as needed.

**Interfaces:** Export pure attribute/category helpers from `src/types/projectRegistry.ts` or a pure helper module; export registry creation/update/removal services from `src/lib/projectRegistry.ts`.

```ts
export type ProjectAttribute = 'formal' | 'budget' | 'roadmap'
export interface ProjectRegistryMetadata {
  projectAttribute?: ProjectAttribute
  boundFormalProjectId?: string | null
  createdBy?: string
  createdAt?: string
}
export interface ConfiguredProjectInput {
  projectAttribute: ProjectAttribute
  sourceBid?: string
  name?: string
  type?: string
  responsiblePersons: string[]
}
export type RegistryMutationResult = { ok: true; projectId: string } | { ok: false; message: string }
// createConfiguredProject(input: ConfiguredProjectInput, actor: string): RegistryMutationResult
// updateConfiguredProject(id: string, updates: { name?: string; projectCode?: string; boundFormalProjectId?: string | null }, actor: string): RegistryMutationResult
// deleteConfiguredProject(id: string, actor: string): RegistryMutationResult
```

- [ ] Read existing project initialization, mutation validation, permission synchronization, external source mapping, persistence and audit flows.
- [ ] Add focused behavioral verification for minimal creation of each attribute/type, duplicate source/code, same-type binding, per-attribute binding uniqueness, unbinding, actor roles and history; run and record initial failures.
- [ ] Implement minimal creation using existing IPM Mock enumeration/mapping. Formal name/code/type are source-owned. Manual source types are four exact categories; roadmap only machine. At least one responsible person; assign machine SPM, tOS manager, technical lead plus system administrator as specified.
- [ ] Add optional metadata to project type and normalize legacy PMS projects as formal without losing existing fields. Do not require roadmap/first-sale-tOS completeness to register a minimal project; keep detailed completion validation for later space editing.
- [ ] Implement config field mutation checks, name/code readonly for formal, trimmed code uniqueness, same-type binding, same-attribute uniqueness, unlink behavior and confirmation-ready errors. Audit all successful config and project-space mutations with before/after, actor/time; deleting retains audit snapshot and detaches linked nonformal records without deleting them.
- [ ] Run `node scripts/verify-project-registry.mjs` and `npx tsc --noEmit`; self-review and commit task files. Report exact produced interfaces for downstream work.

## Task 2: Project configuration UI and navigation

**Files:** Create `src/containers/ProjectManagementContainer.tsx`, `src/components/project-management/ProjectConfiguration.tsx`, `src/components/project-management/NewProjectModal.tsx`, and focused reusable cells/history components as needed. Modify `src/stores/ui.ts`, `src/app/page.tsx`, `src/containers/AppShell.tsx`, `src/containers/ProjectListContainer.tsx`, `src/containers/JointProjectSpaceContainer.tsx`, scoped shared CSS and existing navigation verifiers.

**Consumes:** Task 1 registry helpers/services and project metadata. **Produces:** project management config/view wrapper, project-origin tab restoration, `openProjectConfiguration()` navigation action or equivalent existing-store action with exact name reported.

- [ ] Build the two tabs, default config, retaining project-list filters and layouts in view. Remove obsolete empty main module; rename labels/return strings; formal-only filter all project-list views and joint aggregation.
- [ ] New project modal has exactly attribute, name, type, responsible people; names/types follow registry rules, successful creation adds row without auto-entering space. Display mapping errors and field validation.
- [ ] Configuration table exact columns: 项目名称、项目类型、项目属性、项目编码、创建人、创建时间、绑定正式项目、操作. Name navigates; separate pencil edits nonformal name. Use canonical registry actions for edits/deletion.
- [ ] Implement changed-value blur confirmation (cancel restores; unchanged skips; one pending modal; dropdown selection/clear doesn't create duplicate confirms), filtered binding options, readonly formal cells, history modal and delete confirmation including affected bindings.
- [ ] Remove old project-list creation UI and route any retained shortcut into configuration. New navigation honors existing edit guard and transfer reset; config/view origin restored on return. Enforce permissions.
- [ ] Update existing navigation verifiers for intentional new labels/order; run relevant verifier and typecheck; commit and report.

## Task 3: Roadmap projects use unified registry and project space

**Files:** Modify `src/stores/roadmap.ts`, `src/lib/roadmapProjectAdapter.ts`, `src/types/roadmap.ts`, roadmap components, project-space/basic-info helper files as needed. Create a focused registry/roadmap adapter if needed. Modify `scripts/verify-project-roadmap.mjs` only where its old contract is intentionally replaced; add behavioral verification for new flow.

**Consumes:** unified projects with `projectAttribute`, registry services, Task 2 configuration navigation. **Produces:** stable-ID roadmap projection/migration and nonformal project-space editing support.

- [ ] Migrate legacy planned projects to registry roadmap projects once, preserving IDs, data and change logs. Ensure rehydration doesn't reinsert deleted seeds or repeat migration.
- [ ] Planned roadmap rows come from registry roadmap projects; ordinary roadmap rows exclude budgets. Existing plan/config metadata stays in roadmap store. Changes in project space reflect in roadmap immediately.
- [ ] Remove independent roadmap creation entry/modal behavior and route users to config. Incomplete records remain in table; no invented dates or positioning on timeline before dates exist.
- [ ] Ensure manually created budget/roadmap projects can enter and edit corresponding project-space basic information; preserve editable nonformal name/code and formal source fields. Keep formal-only consumers from picking budget/roadmap records as formal projects.
- [ ] Verify migration, minimal roadmap creation -> table -> space completion -> table update, deletion/unbinding and existing formal roadmap flows. Run focused checks/typecheck, commit, report.

## Task 4: Shared HR ownership and project-scoped resource workspace

**Files:** Modify `src/stores/hrMachine.ts`, `src/stores/hrTos.ts`, `src/stores/hrTechnical.ts`, `src/stores/hrCapability.ts`, HR project types, `src/lib/hrFormalProjectSource.ts`, `src/lib/hrProjectSync.ts`, `src/lib/hrVersionRules.ts`, `src/hooks/useHrFormalProjectSync.ts`, four HistoryVersionSpace components and Content wrappers. Create `src/lib/hrProjectRegistry.ts`, `src/components/project-resources/ProjectResources.tsx`, scoped HR context/helper files and behavioral verifier. Integrate in `src/containers/ProjectSpaceContainer.tsx`.

**Consumes:** stable project registry identities/attributes/bindings. **Produces:** four stores joined to canonical projects with `pmsProjectId` (optional for legacy only); project-scoped and cross-project UI over same version records, registry migration/sync hook.

- [ ] Define and verify deterministic legacy mapping: original formal registry IDs stay unchanged; old annual HR versions remain on derived budget registry records; nonannual versions map to exact bound formal IDs. Preserve version IDs/monthly edits/history. Conflicting/unknown bindings remain explicitly reported, no guessed joins.
- [ ] Ensure each configured formal/budget project has appropriate HR record; roadmaps cannot create versions. Store-level creation/copy rules enforce attribute budget restrictions even when bound. Canonical project creation/deletion/binding is managed from config, not independent HR project modals.
- [ ] Formal latest nonannual milestones and applicable dates/level resolve from own level-one plan; budget annual milestones always stay independent. Binding copies/follows only required brand/product-line/market metadata, never annual milestone values. Last version deletion retains project.
- [ ] Add resource two-tab wrapper with empty 项目资源看板; roadmaps render empty estimates. Project scope filters to own versions plus bound budget annual versions, removing name/brand/product-line selectors and project selector. Associated annual rows readonly with source navigation; every mutation honors source project permissions.
- [ ] Keep cross-project summaries and monthly views over same records, no duplicate annual counting; scope filters isolated from cross-project state. Add per-version machine 项目年份.
- [ ] Test formal/budget milestones under plan changes, binding/unbinding, identity migration repeatability, shared edits, annual references/permissions, budget type enforcement and last-version retention. Typecheck and relevant HR verifiers; commit and report.

## Task 5: Version forms, milestone details and model configuration

**Files:** Four `NewVersionModal.tsx` files, four version detail modals, relevant form types/store signatures, `src/containers/ConfigContainer.tsx`, `src/constants/hrPipeline.ts`, `src/components/hr-config/ConfigContent.tsx`, `src/constants/hrConfig.ts`, shared styling and relevant focused verifiers.

**Consumes:** Task 4 scope/attribute helpers and canonical HR ownership; existing model calculators and phase constants. **Produces:** complete three-column creation forms and migrated model navigation.

- [ ] All version forms have three fields per row; full-width phase tables. Fixed project scope in space; cross-project selection remains available in summary but filtered by permissions and eligible attributes.
- [ ] Formal new-version milestones readonly from own level-one plan. Budget new-version milestones editable and persisted with latest-version table edits; bound budget never inherits formal milestone values. Historical rows retain existing immutable scope.
- [ ] For machine budget records unbound: require brand, product line, market name at version creation; bound: display formal values readonly. Machine phase preview table uses selected configured model/level/coefficient and is readonly; tOS phase table remains manual. Technical/capability retain their correct phase/date structures.
- [ ] All detail modals display milestone/date information. Linked annual details respect readonly source scope.
- [ ] Config center adds 人力资源管道 -> 整机人力模型 using existing model data and edit permissions. Remove old model leaf; keep other original config leaves.
- [ ] Verify all four forms, optional/incomplete formal plan dates, model changes, version detail information, readonly behavior, and config data reuse. Run focused checks, typecheck, commit and report.

## Task 6: Refresh feature-aware Mock data

**User steering:** Refresh Mock data for the new feature, exercise actual interactions, and only commit/push after tests pass.
**Files:** Current project, roadmap and four HR seed-data modules, mock dataset storage/migration helpers, relevant dataset verifier and feature acceptance scenarios.

- [ ] Provide coherent visible formal, budget and roadmap examples across all four supported project types; machine-only roadmaps. Include bound and unbound budgets, annual-source association, history, incomplete roadmap, and empty resource examples.
- [ ] Formal sample milestone dates come from the sample formal level-one plan; budget sample dates are visibly different and stay independent after binding. Annual references share source version IDs without duplicate counts.
- [ ] Use deterministic IDs and existing sanitized demo identities; avoid presenting legacy unknown-code/collision examples as normal new-feature data. Preserve supported old stored-data migration and user-entered versions; no fuzzy identity joins.
- [ ] Update relevant Mock verifier contracts and verify clean fresh-origin data plus reload/migration behavior.
- [ ] Commit task files only after relevant feature and data checks. Final browser acceptance and full build still required before feature push.

## Final acceptance

- [ ] Review integrated branch against full spec and user milestone correction. Fix meaningful findings before delivery.
- [ ] Run fresh typecheck, production build, project registry + relevant HR/navigation/roadmap behavioral verification. Separate changed product contracts from real regressions.
- [ ] Exercise browser: three attributes/four types; blur-confirm cancel/save; duplicate binding; project views; roadmap completion; budget manual vs formal readonly milestones; shared summary/single-project state; annual read-only source; model configuration; unauthorized user.
- [ ] Inspect browser errors and final git diff; push feature only; verify remote HEAD and clean worktree.
