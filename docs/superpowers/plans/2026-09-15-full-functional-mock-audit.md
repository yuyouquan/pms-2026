# Full Functional and Mock Data Audit

> **For agentic workers:** Use superpowers:executing-plans for the audit sequence and superpowers:dispatching-parallel-agents for independent failure domains. Steps below track the release gates.

**Goal:** Verify the current implemented PMS modules and Mock data interactions, repair confirmed defects, and release through feature, dev, master, and Vercel.

**Architecture:** Run the existing source/domain checks in isolated processes against a clean source snapshot. Exercise browser workflows against a production build with isolated browser storage. Separate obsolete verification assumptions from implementation defects, and validate each fix before release.

**Tech Stack:** Next.js 14, React 18, Ant Design 6, Zustand, TypeScript, existing Node verification scripts, Playwright/Puppeteer browser checks.

**Spec:** Current conversation requirements take precedence over older documents; existing feature contracts are documented under `docs/prd/` and `docs/superpowers/plans/`.

## Global Constraints

- Preserve unrelated work in the main checkout; use the existing `codex/feature-project-management-space` worktree.
- Project management configuration is restricted to 管理组; other users see 项目视图 only.
- Budget and roadmap projects keep their confirmed restricted navigation and project attribute rules.
- Non-labor investment uses 元 and the 二级部门 + 三级部门 + 二级科目 + 三级科目 unique key; retired configuration does not erase historical values.
- Machine investment uses the seven milestone intervals and derives STR5+6个月; formal plan-owned dates remain read-only and budget dates remain independent.
- Creating a resource version appends a new version; editing affects only the latest eligible version. Binding/unbinding never discards source investment data.
- Planned empty modules remain empty; do not invent functionality for placeholders.
- No external notification messages. Release is already authorized by the user.

## Task 1: Baseline verification inventory

- [x] Confirm feature, dev, and master refs and preserve the main checkout.
- [x] Snapshot the current source and enumerate all existing verification scripts.
- [x] Run every non-browser verification script and the verifier self-test; retain individual logs and exit codes.
- [x] Run TypeScript checking and a production build.
- [x] Classify every failing assertion using current requirements and owning source code.

## Task 2: Domain and Mock data correctness

Use the existing checks for project registry, permissions, session boundaries, resource stores, plan versions, roadmap, enum consumers, and transfer workflow. For a confirmed gap, first capture a minimal failing domain scenario, repair the owning function, and rerun the relevant checks.

- [x] Project creation, editable fields, binding uniqueness/type constraints, deletion, ownership, history, and basic-information todos.
- [x] Formal/budget/roadmap resource synchronization, new/edit version behavior, history isolation, derived dates, non-labor imports, and persistence/cross-tab behavior.
- [x] L1/L3 plans, market/tOS dimensions, draft/publish/compare rules, linked project views, and shared snapshots.
- [x] Enum and HR configuration changes, deleted configuration snapshots, Mock migration/reload, role changes, and transfer workflow.

## Task 3: Browser workflow coverage

Exercise actual controls and collect console/page errors. Keep browser data isolated from the user's active preview.

- [x] Workbench: categories, incomplete-info task navigation, edit modal, save/return flow, and budget exclusion.
- [x] Project management: four project categories, filters, list/calendar/cards, export, fullscreen/collapse, column resize/reorder, configuration create/edit/bind/delete/history, admin/non-admin transitions.
- [x] Project spaces: type/attribute navigation, basic-info forms, fan-trial display, L1/L3 list/Gantt/horizontal views, versions, and permissions.
- [x] Resources: all four types, create/edit/detail, milestone ownership, non-labor add/import/template/total, annual budget binding and source navigation.
- [x] Configuration: tree search, plan templates, enum filters/CRUD, machine models, and non-labor subjects.
- [x] Roadmap and project portfolio: view/filter switches, project-space navigation, milestones/MR aggregation, and configured Mock data.
- [x] Standalone template/share routes and cross-session access checks.

## Task 4: Consolidated regression and release

- [x] Record each actual defect and each outdated verifier separately in an audit report.
- [x] Rerun the full verification inventory against the final source and resolve every failure.
- [x] Confirm TypeScript/build success and final browser acceptance without runtime errors.
- [ ] Commit and push feature; merge/push dev; merge/push master. Verify remote refs and tested source-tree parity.
- [ ] Confirm Vercel production READY for the new master commit, test the changed flows on the production domain, and check runtime errors.

## Evidence

Baseline/final script logs and browser artifacts are stored in the isolated audit directory. The checked-in report records counts, coverage, fixes and exceptions. Release commit IDs, deployment identity and production verification are attached to the delivery evidence after deployment.
