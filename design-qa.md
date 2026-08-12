# 项目列表、技术项目信息与计划交互 Design QA

- Source visual truth: `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-727a6c3c-d931-4a32-9dc5-cfd3923d3063.png`
- Implementation screenshot: `screenshots/filter-panel-immediate-implementation.png`
- Project-list implementation screenshot: `screenshots/project-list-toolbar-alignment.png`
- Technical-plan source visual: `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-f5ebd5de-d489-4994-860c-1e8892835063.png`
- Technical-plan implementation screenshot: `screenshots/technical-plan-revision-menu-implementation.png`
- Technical-template implementation screenshot: `screenshots/technical-template-parity-implementation.png`
- Technical-plan combined comparison: `screenshots/technical-plan-parity-comparison.png`
- Viewport: 1274 × 717 CSS px
- Source pixels: 1468 × 803 px; the reference is treated as a 2× capture, normalized to about 734 × 402 CSS px
- Implementation pixels: 1274 × 717 px; visible filter panel measured 720 × 359 CSS px
- State: 项目列表 / 整机产品项目 / 列表视图 / 筛选悬浮窗打开 / 5 条条件

## Full-view comparison evidence

The source and implementation were opened together at original detail. The implementation preserves the source hierarchy: contextual title and AND subtitle on the left; reset, gradient add, and close controls on the right; five aligned field/operator/value/delete rows; no confirmation footer.

The implementation intentionally keeps the PMS table visible behind the anchored panel and uses the product-specific title `项目筛选` instead of the reference product's `技术点筛选`.

## Focused region comparison evidence

The filter panel was measured and exercised directly in the in-app browser:

- panel z-index: 1100
- Select dropdown z-index: 1150
- dropdown is visibly above the floating panel
- selecting `品牌 = TECNO` reduced the visible project rows immediately while the panel remained open
- deleting the condition restored the full 10 project rows immediately
- `确认` and `取消` actions are absent
- reset, add, delete, close, keyboard focus, and five-row layout are visible and operable

## Findings

- No actionable P0/P1/P2 mismatch remains.
- P3: the implementation close icon is slightly smaller than the reference. It remains clear, aligned, and consistent with the PMS icon scale, so no blocking change is required.
- P3: empty conditions display the safer `请先选择筛选字段` disabled value prompt until a field is selected, rather than the reference's generic value prompt. This is an intentional usability difference.

## Project-list follow-up evidence

- Reference visuals: project-list alignment, toolbar composition, and card/list segmented control supplied in the August 3 follow-up screenshots.
- Fixed header cells now retain `position: sticky`; browser measurements show the first seven header/data left edges match exactly: `24, 156, 356, 488, 620, 752, 892`.
- The category/filter surface measures 142 px for whole-machine, tOS-version, and technical project types.
- Card/list controls have visible labels and icons; the selected segment is white on the existing PMS purple surface.
- The duplicate category-row project-name search is absent. Whole-machine quick filters start with a fuzzy project-name input.
- Filter and column-setting actions appear at the far right of the quick-filter row in both card and list views.
- Card-view quick project-name filtering reduced 9 cards to 1 immediately, and clearing restored all 9.

## Technical project information follow-up evidence

- `计划信息` is rendered as the same white, purple-accented information card used by the whole-machine frame.
- Subproject basic information uses the shared four-cell display grid; team information uses the shared two-column role grid.
- Six deliverable cards remain visible without the redundant `暂无交付物` footer.
- Neither the basic-information surface nor the technical plan scope exposes `显示已停用`.

## Technical plan and template parity evidence

- The supplied whole-machine edit-state reference and the browser-rendered technical-plan implementation were normalized into one 2550 × 717 px side-by-side comparison input. The shared visual hierarchy is retained: scope tabs, edit notice/version bar, primary revision controls, utility toolbar, view switch, and plan content surface.
- On the configured `AI推理引擎子项目计划` scope with no existing version, clicking `创建修订` opens two actionable entries: `创建非正式版本` and `创建正式版本`. No revision was created during the visual check.
- The technical TDT scope retains the whole-machine/tOS operations already present: version selection, automatic save state, plan clone, publish, cancel revision, add top-level task, filter, column settings, expand/collapse, version compare, import, export, sharing, and vertical/horizontal/Gantt views.
- The technical-plan revision store was exercised for both numbering paths: gray revision `V1.1` and formal revision `V2`, with the same one-draft-at-a-time rule.
- In configuration center, technical TDT and subproject templates use the same shared task table and revision toolbar as other project templates. `创建修订` exposes the same formal/nonformal menu.
- TDT task numbering is visibly hierarchical (`1`, `1.1`, `1.2`, `2`, `2.1` ...); subproject templates use single-level numeric numbering (`1` ... `4`). Existing technical template/plan data is migrated without resetting edited task content, and predecessor references follow renumbered IDs.
- Technical template role cells visibly show `技术项目负责人`; the edit selector now contains both the common SPM role and the technical-project owner role.
- Primary interactions tested in the in-app browser: project-category switch, project-space entry, plan-module navigation, TDT/subproject tab switch, revision-menu open, configuration-center navigation, technical-template tab switch, draft cancel confirmation, and configuration revision-menu open.
- Browser-rendered state was checked at 1275 × 717 CSS px. No error overlay, broken layout, or failed interaction appeared; the development server showed successful route compilation and requests. The only terminal notices were non-blocking stale Browserslist data and a transient development cache warning before the clean build/restart cycle.

## Required fidelity surfaces

- Fonts and typography: PMS system font retained; title/subtitle weight and hierarchy match the reference intent.
- Spacing and layout rhythm: 720 px panel, 40 px controls, 12 px row rhythm, aligned four-column grid, rounded panel and controls.
- Colors and visual tokens: white surface, red reset/delete actions, purple gradient add action, gray secondary copy.
- Image quality and asset fidelity: no custom raster assets are required; Ant Design icons are used for add, delete, and close.
- Copy and content: contextual PMS titles are retained; AND semantics and immediate behavior are explicit.

## Comparison history

1. Earlier implementation used stacked card rows, a bottom confirmation footer, and a 1400 panel z-index that covered 1150-level Select dropdowns.
2. The shared panel was changed to the reference header/row structure, confirmation footer was removed, all six filter callers were converted to immediate application, and the panel z-index was corrected to 1100.
3. Post-fix browser evidence confirms the dropdown layer, immediate filtering, reset/delete behavior, and final five-row composition.

## Implementation checklist

- [x] Shared floating filter visual shell
- [x] Header reset/add/close actions
- [x] Four-column condition rows
- [x] No confirmation footer
- [x] Immediate application for all six filter callers
- [x] Dropdown layer above panel
- [x] Responsive and reduced-motion styles retained
- [x] Technical plan formal/nonformal revision menu
- [x] Technical template formal/nonformal revision menu
- [x] Shared technical template task numbering and role selector
- [x] Persisted technical plan/template numbering migrations
- [x] Browser interaction and combined visual comparison

final result: passed

---

# tOS 路标项目级操作与筛选摘要 QA（2026-08-12）

- Source visual truth:
  - `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-988594c0-9a14-4b67-850f-9e1c3c9d2f64.png`
  - `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-351ceafc-7f08-4ebb-baa4-4e27f1aa99e3.png`
  - `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-0d7d3467-25a7-433a-ad98-3ef417979245.png`
- Implementation screenshots:
  - `output/playwright/tos-roadmap-project-actions-table.png` (1280 × 720)
  - `output/playwright/tos-roadmap-project-actions-evolution.png` (1275 × 717)
  - `output/playwright/tos-roadmap-project-actions-filters.png` (1275 × 717)
- Combined comparisons: `output/playwright/table-comparison.png`, `output/playwright/evolution-comparison.png`.
- Viewport: approximately 1280 × 720 CSS px, deviceScaleFactor 1. Source and implementation captures were normalized to 720px height without stretching before side-by-side comparison.
- State: conflicting planned table row hovered; evolution cards in default collapsed-operation state; brand quick filter applied; project-scoped history and conflict drawers opened.

## Findings and iteration

1. Initial evolution-card capture showed the tags and action trigger compressing long titles (P2). Tags were compacted and the action trigger moved below the detail grid.
2. Post-fix capture shows the full `NOTE 50 Pro（X6877）` title, right-aligned `Full/Slim/Go + New/Old` tags, and no duplicate type values in details.
3. Table capture shows four non-wrapping actions only on the hovered conflicting planned row. Formal rows expose only their own history action.
4. Filter capture shows the synchronized quick-filter condition as a removable chip with a separate clear action.
5. No actionable P0/P1/P2 difference remains. Mock tOS/project counts and the existing page title region differ from the interaction drafts but do not affect this scoped change.

## Required fidelity surfaces

- Fonts and typography: existing PMS font hierarchy retained; card titles use a compact 13px weight and remain single-line.
- Spacing and layout rhythm: 28px table icon controls, compact non-wrapping card tags, and existing glass-surface spacing retained.
- Colors and tokens: existing PMS purple and warning tokens plus Ant Design tag colors are reused.
- Image quality and assets: no new raster assets; all icons come from `@ant-design/icons`.
- Copy and content: global conflict/history actions are removed; project-level copy uses `历史`, `冲突`, and `正式项目`.

## Interactions and runtime

- Verified table history/edit/conflict/delete, card operation expand/collapse, scoped history, scoped conflict, quick-filter chip removal, clear-all, and view switching.
- Browser console warnings/errors: 0.

final result: passed
