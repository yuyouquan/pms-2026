# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (used port 3004 historically; falls back to 3000)
npm run build        # Production build
npm run start        # Run the production build
npm run lint         # ESLint via next lint
npx tsc --noEmit     # Type-check the whole project (no test framework is configured)
npm run db:generate  # `prisma generate`  — Prisma client (DB is not wired into the running app today)
npm run db:push      # `prisma db push`
```

There is no test runner. "Verification" in this repo means `npx tsc --noEmit` + `npm run build` + manual exercise in the browser.

If port 3004 is held by a stale dev server: `lsof -ti:3004 -sTCP:LISTEN | xargs kill`.

## High-level architecture

This is a Chinese-language project-management UI built on **Next.js 14 (App Router) + React 18 + Ant Design 6 + Zustand 4 + Tailwind**. It is currently mock-data only — `@prisma/client` is installed but the app does not call a database.

### One page, five modules, switched by store state

`src/app/page.tsx` is intentionally tiny (~133 lines). It picks one of five top-level modules based on `useUiStore().activeModule`:

| `activeModule`     | Renders                                                  |
| ------------------ | -------------------------------------------------------- |
| `projects`         | `WorkspaceContainer` (project list/cards + work tracker) |
| `roadmap`          | `RoadmapView` (milestone + MR-train roadmap)             |
| `hrPipeline`       | placeholder Empty card                                   |
| `config`           | `ConfigContainer` (config center: plan templates, etc.)  |
| `globalPermission` | `GlobalPermissionContainer`                              |
| `projectSpace` (+ `selectedProject`) | `ProjectSpaceContainer` — full-screen project workspace |

`MainHeader` and `ProjectSpaceHeader` (both in `src/containers/AppShell.tsx`) are the two header variants.

`src/app/config/level1-template/page.tsx`, `src/app/config/level2-template/page.tsx`, and `src/app/share/plan/page.tsx` are standalone routes (older / share-link surfaces) that do **not** go through the container/store machinery.

### Five Zustand stores own all state

Domain stores in `src/stores/` — components never `useState` for cross-cutting concerns; they read directly from these stores:

- **`ui.ts`** — navigation (`activeModule`, `configTab`, `projectSpaceModule`), sidebar, modal visibility, **edit guard** (`isEditMode`, `showLeaveConfirm`, `pendingNavigation`, `navigateWithEditGuard`).
- **`project.ts`** — `projects`, `selectedProject`, `currentLoginUser`, workspace filters, `selectedMarketTab`, basic-info edit state. Also exports `PROJECT_MEMBER_MAP` (which users see which project) and `DEFAULT_LOGIN_USER`.
- **`plan.ts`** — L1/L2 plan tasks, `versions`, `LEVEL2_PLAN_TYPES`, `FIXED_LEVEL2_PLANS`, market-specific plan data, column configs, share state. Largest store.
- **`transfer.ts`** — transfer-maintenance ("转维") workflow: `transferView` (`null|apply|detail|entry|review|sqa-review`), `selectedTransferAppId`, applications, checklist items, review elements, config-view sub-state. Backed by mocks in `src/mock/transfer-maintenance.ts`.
- **`permission.ts`** — project-level roles + `rolePermissions`, plus separate `globalRoles` / `globalRolePerms`. Exports two helpers used everywhere: **`hasPermission(user, permKey)`** (imperative) and **`useHasPermission(user)`** (hook). The global role **`管理组`** bypasses every project-level check via `isGlobalAdmin`.

### Container components consume the stores

`src/containers/`:

- `AppShell.tsx` — `MainHeader`, `ProjectSpaceHeader`, shared `UserSwitcher` (a dropdown that switches `currentLoginUser` for permission testing).
- `WorkspaceContainer.tsx` — workspace tab.
- `ProjectSpaceContainer.tsx` — **the giant one (~1572 lines)**. Holds every render helper for the project space: `renderProjectBasicInfo`, `renderProjectPlan`, `renderProjectPlanOverview`, `renderProjectOverview`, `renderProjectRequirements`, `renderProjectPlanInfo`, `renderHorizontalTable`, `renderTaskTable`, `renderGanttChart`, `renderActionButtons`, plus the Modals for version compare, custom columns, and L2-plan creation.
- `ConfigContainer.tsx`, `GlobalPermissionContainer.tsx`.

Larger UI fragments still live as components: `src/components/permission/PermissionModule.tsx` (`FIXED_ROLES`, `ALL_USERS`, `PERMISSION_MODULES`, `PermissionConfig`), `src/components/transfer/TransferModule.tsx` (the 5 transfer view components), `src/components/plans/{RequirementDevPlan,VersionTrainPlan}.tsx`, `src/components/roadmap/*`, `src/components/shared/PlanHelpers.tsx` (`DHTMLXGantt`, `DragHandle`, `SortableRow`, `ClickToEditDate`, `MiniPipeline`, plus tree helpers `getTaskDepth`, `hasChildren`, `filterByCollapsed`, `mergePlans`, and `MOCK_USER_MAP`).

This refactor is documented in `docs/superpowers/plans/2026-04-15-core-refactor-zustand-containers.md` — the previous architecture was a single ~4720-line `page.tsx`.

### Cross-cutting patterns to know about before editing

- **Edit-guard before navigation.** Anywhere a user might lose an in-progress draft, navigation goes through `useUiStore().navigateWithEditGuard(action)`, which pops a confirm Modal when `isEditMode && !isCurrentDraft`. Don't bypass it. The Modal lives in `page.tsx` and is shared by every route.
- **RBAC enforcement on edit actions.** Edit / save / delete buttons must be gated by `useHasPermission(currentLoginUser)` (or `hasPermission(...)` for non-React contexts). Example permission keys: `basicInfo:编辑`, `plan:一级计划-编辑`, `plan:导入/导出`. Adding a new edit action without a permission gate is a known regression class — recent commits (`994868e`) fixed several.
- **Transfer view state must reset on project navigation.** When the user leaves the project space, call `setTransferView(null)` (see `ProjectSpaceHeader`). Forgetting this leaves the user stuck on a transfer sub-view in the next project.
- **整机产品项目 + market dimension.** Project type `整机产品项目` adds a `markets` field (e.g. `OP`, `TR`, `RU`). For these projects, plan data lives in `marketPlanData` keyed by market, and `selectedMarketTab` decides which slice is shown. Other project types use the flat `projects/plans` shape.
- **Plan versions.** L1 and L2 plans have `Vxxx(已发布)` / `Vxxx(修订中)` versions. Only one `修订中` per template at a time. Editing only allowed on `修订中`. Diff via `src/lib/versionCompare.ts` (`compareVersionsForTable` returns `CompareTableRow[]` with green/red/blue change types).
- **Plan time validation in 修订中.** `getInvalidTaskFields` (top of `ProjectSpaceContainer.tsx`) enforces two rules per task: (a) same row `planStartDate <= planEndDate`, (b) child date in parent date range. Violating cells get `pms-cell-invalid` class via column `onCell` + a red-themed `Tooltip` listing reasons. `handlePublish` aborts publish when any cell is invalid, scrolling to the first violating row. Don't tighten the rules to flag empty-date cells — partial input shouldn't error.
- **`SortableRow` props forwarding (edit-mode tables).** In `src/components/shared/PlanHelpers.tsx`, `SortableRow` is the body row component for `renderTaskTable` while `isEditMode` is true. The `<tr>` MUST spread `{...props}` first (then override `ref` / `style` / dnd-kit `attributes`), otherwise Antd's `rowClassName`, per-cell `onCell` className, and `data-row-key` are silently dropped. This bit us once already — any new row- or cell-level styling that uses Antd's column APIs must be tested in edit mode (i.e. inside a `修订中` draft).
- **Excel export** goes through `src/utils/exportExcel.ts` (`exportSheet`, `exportMergedSheet`, `exportTimestamp`). Don't roll your own `xlsx` calls.
- **Feishu notifications** are a stub — `src/lib/feishu-notify.ts` (`notifyPublishChanges`, `notifyDueTasks`) currently `console.log`s. The header comment explains the production wiring; treat changes there as front-end-only mocks unless the user asks for the backend.
- **Path alias.** `@/*` → `src/*` (see `tsconfig.json`). Always use the alias, never relative `../../` from `src/`.
- **Styling.** Bulk styling lives in `src/styles/globals.css` (~1366 lines, "purple glassmorphism" theme + Ant Design overrides + `pms-table`, `pms-modal`, `pms-card-hover`, `pms-sidebar`, `pms-edit-input` classes). Page-level overrides should stay tiny inside the component; don't duplicate what's already in `globals.css`.
- **Mock users.** `ALL_USERS` (`src/components/permission/PermissionModule.tsx`) lists the 8 testable identities; `DEFAULT_LOGIN_USER = '张三'`. `张三` and `李白` are in the `管理组` global role and therefore bypass project RBAC by default.

### Domain glossary (helps reading the code)

- **整机产品项目 / 产品项目 / 技术项目 / 能力建设项目** — four project types. Only the first has `markets`.
- **一级计划 / 二级计划 / 计划总览** — L1 plan (max 2 levels deep), L2 plan (max 3 levels), overview view.
- **转维 / 转维维护** — "transfer to maintenance" workflow (the entire `transfer*` surface).
- **筹备中 / 进行中 / 生命周期 / 上市** — project status values.
- **修订中 / 已发布** — plan-version status.

The full original product spec is `原始需求.md` at the repo root. Newer per-feature specs are under `docs/prd/` and `docs/superpowers/plans/`.
