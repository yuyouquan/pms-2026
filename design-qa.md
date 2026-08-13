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

# 个人工作台目录任务表 QA（2026-08-13）

- Source visual truth:
  - `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-285d47d8-f9b7-4167-a106-bb3788710401.png`
  - `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-ff3e0fa4-56c0-4b7a-8623-b3804047a94b.png`
- Implementation screenshots:
  - `output/workbench-directory-desktop.png`（1702 × 894）
  - `output/workbench-directory-narrow-v2.png`（720 × 900）
- Combined comparisons:
  - `output/workbench-directory-comparison-full.png`
  - `output/workbench-directory-comparison-focused.png`
- Viewports: desktop 1702 × 894 CSS px; narrow 720 × 900 CSS px.
- State: 张三登录；计划无待处理、转维护有 1 条待处理，因此默认选中“转维护 / 待处理”。

## Findings and iteration

1. 首版窄屏下筛选器与分页空间不足（P2）；将筛选区改为 2 列网格，搜索占整行，520px 以下降为单列，并禁止分页换行。
2. 桌面版保留参考图“左目录 + 右状态与表格”的信息架构，同时沿用 PMS 紫色玻璃拟态、现有标题栏和 Ant Design 表格体系。
3. 表格固定为 8 个业务表头，待处理使用“前往处理”，已完成使用“查看详情”，没有增加任务详情弹窗。
4. 完成态转维护任务使用真实申请 ID 跳转；聚合行 ID 与业务路由 ID 分离，避免历史节点无法打开申请详情。
5. 最终浏览器控制台 warning/error 为 0；无剩余 P0/P1/P2 差异。

## Required fidelity surfaces

- Fonts and typography: 保留 PMS 现有中文字号与表格密度；标题、目录和状态标签层级清楚。
- Spacing and layout rhythm: 176px 左目录、紧凑状态页签、单行筛选工具栏和高密度表格；窄屏自动纵向排列。
- Colors and tokens: 复用系统紫色主色、淡紫选中态、橙色待处理与绿色已完成标签。
- Image quality and assets: 未引入位图素材；目录和操作图标来自 `@ant-design/icons`。
- Copy and content: 目录仅“计划 / 转维护”；状态仅“全部 / 待处理 / 已完成”；八列表头与需求一致。

## Interaction verification

- 验证默认选中规则：存在转维护待处理时进入“转维护 / 待处理”。
- 验证计划、转维护目录切换，以及全部、待处理、已完成页签切换。
- 验证搜索无结果、清空筛选、项目与生成日期筛选控件状态。
- 验证待处理任务“前往处理”打开对应转维护资料录入页面，并可返回工作台。
- 验证桌面与 720px 窄屏无页面横向溢出。

final result: passed

---

# tOS 路标顶部版本筛选与维护版本列 QA（2026-08-12）

- Source visual truth: `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-f739b39f-a2f3-4f10-822f-0238766c1e7e.png`（277 × 46 px）。
- Table implementation: `output/roadmap-qa/tos-roadmap-table-filter-2026-08-12.png`（1280 × 720 px，CSS viewport 1280 × 720，deviceScaleFactor 1）。
- Evolution implementation: `output/roadmap-qa/tos-roadmap-evolution-maintained-versions-2026-08-12.png`（1280 × 720 px，CSS viewport 1280 × 720，deviceScaleFactor 1）。
- Focused comparison: `output/roadmap-qa/tos-roadmap-filter-comparison-2026-08-12.png`（1250 × 200 px）。源图放大至 554 × 92 后与实现顶部筛选区域同画布比较，未拉伸实现区域。
- State: 表单视图 tOS 下拉展开；版本演进视图无 tOS 高级筛选。

## Findings

- P0: none.
- P1: none. 表单视图的 tOS 版本筛选已移动到顶部快捷筛选首位，并位于品牌之前。
- P2: none. 已增加 `tOS版本` 标题，原筛选旁的 `共 21 个项目` 已移除；分页中的 `共 21 条` 保留为分页总数，不属于被删除区域。
- P2: none. 演进视图以 tOS 版本维护记录作为纵列目录，16.1、16.2、16.3、17.0、17.1、17.2、18.0 均显示；无项目版本保留空列。
- P3: Ant Design 仍输出项目已有的 `Card bordered` 弃用警告，与本次筛选及版本列改动无关。

## Required fidelity surfaces

- Fonts and typography: 复用现有 PMS 12px 快捷筛选标题与控件字号，单行显示无换行。
- Spacing and layout rhythm: tOS、品牌、产品类型保持同一工具栏和 6px 内部间距，30px 控件高度一致。
- Colors and tokens: 沿用现有紫色液态玻璃主题和 Ant Design 选择态，不新增颜色。
- Image quality and assets: 本次无新增图片资产或自绘图标。
- Copy and content: `tOS版本`、`全部` 和维护版本文案与业务要求一致；原项目数副文案已删除。

## Interaction verification

- 表单视图 tOS 下拉可打开，选项为全部及 7 个维护版本，未显示“已停用”状态。
- 表单 / 版本演进切换正常。
- 演进视图完整展示 7 个维护版本，其中 tOS16.3 聚合 21 个项目，其余无数据版本仍展示。
- 页面仅观察到既有 Ant Design 弃用警告，无本次功能错误。

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

---

# tOS Roadmap Design QA

## Compared states

- Table reference: `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-b42d885a-ae88-4995-baf4-d10e250c81a8.png`
- Table implementation: `output/roadmap-qa/tos-roadmap-table.jpg`
- Evolution reference: `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-46d66fe9-4315-456c-85a2-cab746ab7c3f.png`
- Evolution implementation: `output/roadmap-qa/tos-roadmap-evolution.jpg`
- Detail reference: `/var/folders/t_/bxx0q9dj4fd_ylb6wjl6tt5h0000gn/T/codex-clipboard-5befc8f9-b269-4b0c-a0a5-88f8f75d9913.png`
- Detail implementation: `output/roadmap-qa/tos-roadmap-detail.jpg`

## Findings

- P0: none.
- P1: none after fixing the filter draft feedback loop and forcing the new three-field evolution defaults through store migration version 7.
- P2: none after separating the compact view switch, reducing toolbar density, aligning card tags, and adding the full-field details modal.
- P3: the implementation uses the repository's current mock versions and projects rather than duplicating the screenshot's sample rows. The details modal is slightly taller because the approved behavior now exposes every roadmap field.

## Interaction verification

- Advanced filter field selection remains visible while its value is incomplete.
- Selecting a product-line value immediately changed tOS16.3 from 21 projects to 4 and displayed `筛选 1`.
- Reset cleared the applied condition.
- Evolution cards default to platform, STR5 date, and launch date only.
- Clicking `NOTE 50 Pro（X6877）` opened all roadmap fields; embedded project actions remain independently clickable.
- Table and evolution view switching remained functional.

final result: passed
