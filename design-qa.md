# 项目列表与技术项目信息 Design QA

- Source visual truth: `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-727a6c3c-d931-4a32-9dc5-cfd3923d3063.png`
- Implementation screenshot: `screenshots/filter-panel-immediate-implementation.png`
- Project-list implementation screenshot: `screenshots/project-list-toolbar-alignment.png`
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

final result: passed
