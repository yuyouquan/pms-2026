# Findings & Decisions

## Requirements
- User requested: "先对现有项目进行一个扫描分析".
- Treat this as an analysis-first, read-only pass over the current `pms-2026` project.
- Final answer should be in Chinese and focus on actionable architecture/risk understanding.

## Research Findings
- Session catchup detected previous unsynced context from a PRD export/merge workflow, but no existing planning files were present in this repo root.
- Memory confirms this repo is a Next.js 14 / React 18 / Ant Design 6 / Zustand project with a thin app entry and large container/store architecture.
- Memory flags known regression zones: branch context, RBAC gates, plan validation cells, `SortableRow` prop forwarding, long PRD update safety, and browser verification.
- Current branch is `master`; `HEAD` is `520194e` and matches `origin/master`.
- `dev` is at `c58b3a9`, behind the merge commit now on `master`; sibling worktrees exist for `feature/ai-chat-assistant` and `claude/brave-carson`.
- `git status -sb` shows only untracked files at this point: `AGENTS.md`, planning files, and several `screenshots/capture-*.mjs` scripts.
- Dependency/config scan: `package.json` scripts are `dev`, `build`, `start`, `lint`, `db:generate`, and `db:push`; there is no test runner script.
- Runtime stack from config/deps: Next.js 14.2.5, React 18.3.1, Ant Design 6.3.1, Zustand 4.5.4, Tailwind 3.4.4, TypeScript 5.5.3, dhtmlx-gantt, xlsx, dnd-kit, Prisma packages.
- Actual Tailwind config file is `tailwind.config.js`; my first lookup for `tailwind.config.ts` failed.
- Prisma packages are installed, but `rg --files prisma` failed because there is no `prisma/` directory in the repo root.
- Largest scanned source files by line count: `ProjectSpaceContainer.tsx` 1703, `globals.css` 1379, `TransferModule.tsx` 1108, `ConfigContainer.tsx` 718, `PermissionModule.tsx` 445, `PlanHelpers.tsx` 426.
- Source layout is concentrated under `src/app`, `src/containers`, `src/stores`, `src/components`, `src/lib`, `src/utils`, `src/mock`, `src/data`, `src/types`, and `src/styles`.
- Docs/assets layout includes `docs/prd/PMS-V1.0-PRD.md` plus `docs/prd/pic`, historical `docs/superpowers/{plans,specs}`, and many screenshot/smoke scripts under `screenshots/`.
- App entry: `src/app/page.tsx` renders one of five modules from `activeModule`; project space is full-screen when `activeModule === 'projectSpace' && selectedProject`.
- `src/stores/ui.ts` owns navigation, sidebar, modals, and edit guard state; several containers still implement their own `navigateWithEditGuard` variant.
- `src/stores/project.ts` owns mock project list, selected project, login user, workspace filters, basic-info editing state, market tab, todo state, and mutable per-project visibility map.
- `src/stores/plan.ts` owns plan template/project state, versions, L1/L2 tasks, columns, collapsed nodes, published snapshots, compare state, whole-machine `marketPlanData`, and warning modals.
- `src/stores/permission.ts` owns per-project role/permission slots plus global roles; `管理组` bypasses project-level permission checks.
- `src/stores/transfer.ts` owns transfer-maintenance views and data; changing `transferView` resets view-scoped transient state to avoid stale form/modal leakage.
- Project-space complexity is concentrated in `ProjectSpaceContainer.tsx`: permissions, market-specific task routing, draft-version defaulting, date validation, publish flow, transfer entry points, version compare modal, and nested render helpers.
- Plan validation is cell-level: `getInvalidTaskFields()` skips empty dates, checks row start/end order plus parent-child date range, and `handlePublish()` blocks publishing and scrolls to first invalid row.
- `SortableRow` in `PlanHelpers.tsx` correctly forwards Antd props before applying dnd-kit ref/style/attributes; this is critical for row keys and cell invalid classes.
- Workspace project visibility is global-admin-or-member based. Only 管理组 sees the "新增项目" button; creation adds the project, sets project members, initializes project permissions, and navigates to basic info.
- Roadmap is split between milestone and MR-train views, with project navigation callback back into project-space plan.
- Transfer-maintenance is fully mock-backed from `src/mock/transfer-maintenance.ts` with applications, checklist/review templates, pipeline status helpers, close-review rows, and config version diffs.
- Work tracker is local-state mock data filtered by current login user; it can navigate users into project plan/basic views and update actual time in-place.
- Feishu notifications are a frontend stub: `sendFeishuMessage()` logs to console and comments describe expected backend proxy integration.
- Export path is centralized in `src/utils/exportExcel.ts` via `exportSheet`, `exportMergedSheet`, and timestamp helper.
- Risk scan found widespread `any` usage, mostly in plan/task shape handling, ProjectSpaceContainer, PlanHelpers, and historical docs/spec snippets.
- Screenshot/smoke scripts exist under `screenshots/`; several scripts hard-code local ports (`3000`, `3001`, `3004`, `3005`) and should be checked before reuse.
- Validation run: `npx tsc --noEmit` passed with no output.
- Validation run: `npm run build` passed; Next generated 7 static pages, with `/` first-load JS reported as 816 kB.
- Final `git status -sb`: still on `master`; only untracked files are `AGENTS.md`, this scan's planning files, and four `screenshots/capture-*.mjs` scripts.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use `rg`, `find`, and targeted file reads | Fast, low-noise, read-only repository scan |
| Avoid running builds initially | User asked for analysis, and structural scan should come before verification |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Previous session catchup reported unsynced context | Ran `git diff --stat` and checked for planning files before proceeding |
| `tailwind.config.ts` lookup failed | Located actual `tailwind.config.js` with `rg --files` |
| `prisma` path lookup failed | Treated Prisma as installed-but-not-wired because no `prisma/` directory exists |

## Resources
- `/Users/shswyuyouquan/Documents/work/pms-2026`
- `/Users/shswyuyouquan/.codex/memories/MEMORY.md`
- `AGENTS.md` instructions provided by the user in-thread
- `git worktree list`
- `git log --oneline --decorate -n 8`

## Visual/Browser Findings
- No browser/manual UI inspection was performed in this scan; typecheck and production build passed.
