# Permission usability implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Implement the approved first round of permission usability improvements.
**Architecture:** Keep the existing global/project permission components and their shared stylesheet. Derive bulk targets from the rendered filtered hierarchy, retain store authorization guards, and scope layout changes to permission surfaces.
**Tech Stack:** Next 14, React 18, Ant Design, Zustand, CSS modules, Node behavior scripts.
**Spec:** docs/superpowers/specs/2026-10-08-permission-usability.md

## Global Constraints
- No new authorization semantics or personnel assignments.
- Permissions still take effect immediately; filter state never writes permission state.
- Role sidebars remain narrow; preserve hierarchy, checkbox controls and existing theme.
- Native inline implementation with one independent final review.

## Review Focus
- Search, granted-only filtering and partially selected parents must use the same visible menus for state and mutation.
- Read-only people, superadmins and project readers cannot mutate via new controls.
- Removing the last grant in granted-only mode yields an understandable empty state.
- At 1024px, the main navigation can be manually re-expanded and the role search remains reachable after scrolling.
- Template modal reuse and normal non-permission project modules retain behavior.

### Task 1: Filtered functional permission controls

**Files:** FunctionalMatrix.tsx, ProjectFunctionalPermissions.tsx, menuTree.ts, verify-project-permission-ui.mjs.
**Interfaces:** buildPermissionMenuTree(query, optional includeMenu predicate); existing mutation callback signatures unchanged.

- [x] Change existing component behavior tests to expect the searched basic-info parent to emit only `['basicInfo:查看', 'basicInfo:编辑']`, and global project-view parent only `['project.view']`.
- [x] Run `node scripts/verify-project-permission-ui.mjs`. Expected: failed assertion because the current parent includes hidden descendants.
- [x] Use displayed nodes/rows for bulk state and targets. Add a local checkbox filter `onlyGranted` and prune menus with no granted action while preserving ancestors. Show filtered scope feedback; keep each visible menu's full operation list.
- [x] Add behavior assertions for enabling/disabling granted-only, empty results, combined search and permission filter, readonly filtering without writes, and clearing the last authorized menu.
- [x] Run the component script and permission center global regression. Expected: pass.

### Task 2: Compact layout and readonly polish

**Files:** PermissionCenter.tsx/module.css, ProjectPermissionConfig.tsx/module.css, FunctionalPermissionsTable.module.css, ProjectSpaceContainer.tsx.
**Interfaces:** sidebar tool/list CSS classes used by both permission pages; permission-only compact sidebar override in project container, no persisted state changes.

- [x] Separate sidebar tool area from scrolling list using flex wrappers. Preserve existing search and add-role event handlers.
- [x] Scope compact default to permission module at max-width 1100px, allow local override, and leave existing global sidebar state intact.
- [x] Set project permission menu width to clamp(180px, 20vw, 280px) with fixed table layout; keep small-screen stacked layout. Apply readonly contrast only to actual readonly surfaces and remove repeated template text.
- [x] Run `npm run verify:full-regression`, `npx tsc --noEmit`, `npm run build`. Expected: pass; report any baseline failure accurately.
- [x] Browser exercise at 1280×720 and 1024×680: search parent bulk isolation, granted-only on/off/empty, readonly, role-list scroll with fixed controls, compact navigation toggle, and template modal.
- [x] Independent review of complete diff, resolve important findings, commit to feature branch. Keep local preview available.
