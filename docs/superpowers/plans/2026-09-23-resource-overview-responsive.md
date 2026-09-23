# 资源总览自适应与月度累计 Implementation Plan

> **For agentic workers:** Use executing-plans inline, following the already confirmed user requirements. Preserve unrelated dirty work.

**Goal:** 资源总览移除横向滚动、精简卡片、按正式月度计划累计到今天，并消除资源自动保存后的错误离开提示。

**Architecture:** `cumulativeEstimateData.ts` 作为卡片、部门表、导出的共同计算入口；仅累计预估改为自然日，趋势的既有工作日折算保持原口径。界面使用自适应 CSS Grid 和按容器宽度绘制的 SVG，所有点保留、轴标签抽样。资源字段同步更新实际未保存状态，导航读取即时状态。

**Tech Stack:** Next.js 14 / React 18 / Ant Design / Zustand / TypeScript。

## 1. 基线与计算回归
- [x] 等待引用任务完成；fetch 后从 origin/dev `53b8c60` 创建 feature 分支，复用隔离 worktree。
- [x] 运行 `npm run verify:resource-dashboard-business`，基线通过。
- [x] 将 `scripts/verify-resource-cumulative-estimate.mjs` 改为月度拆日边界断言，先证明旧实现失败：月投入 30，9月1日至11日（含）为 `30 * 11 / 30 = 11`；起算9月5日则为7。覆盖闰月、无开始日期、未来月份、正式来源回退、手动月度更新、部门过滤、费用及总数勾稽。
- [x] `selectCumulativeEstimateSource` 顺序改为 `['projectBudget','projectEstimate','annual']`。
- [x] `buildCumulativeEstimate` 接收 monthly rows 和项目开始日期，用有效月自然日数计算覆盖比例；只取选中正式版本未归档明细。费率和非人力元换算沿用，来源非法不默默回退。

## 2. 卡片与趋势
- [x] `ResourceDashboardMetrics.tsx`：来源和规则只在右上角提示；三张比例卡用外层 Tooltip 展示费用率、费用差或数值公式，卡内仅保留人月。累计执行率各入口更名“累至今日预算执行率”。
- [x] `globals.css`：八张卡 `repeat(8,minmax(0,1fr))`，标题可换行、数字响应式；较窄容器四/两列，保持无横向滚动。
- [x] `ResourceBusinessTrend.tsx`：ResizeObserver 读取实际宽度，SVG `width:100%`，抽样日期标签而非删点；月/周/阶段及人月/费用全部验收。
- [x] 同步部门表说明和 Excel 的来源顺序、日期范围、公式及名称。

## 3. 资源离开提示
- [x] 在 `verify-resource-cell-editing.mjs` 增加仅聚焦不脏、保存后立即清除保护（无须等待 React effect）的失败断言。
- [x] `inlineFieldSession.ts` 增加 dirty，begin 为 false，change 比较原值，save/cancel 同步清除；`ResourceInlineField.tsx` 同步上报状态，失败草稿仍保留。
- [x] `ProjectSpaceContainer.tsx` 导航读取当前 store 状态；进入资源不继承计划编辑状态。其它模块真正草稿的离开保护保留。

## 4. 验收、发布和文档
- [x] `verify:resource-dashboard-business`、`verify:resource-dashboard`、`verify:resource-inline`、`verify:resource-monthly-cost`、`npx tsc --noEmit`、`npm run build`、`git diff --check`。
- [x] 浏览器多尺寸验证八卡/趋势无横向溢出、费用悬停/键盘可见、来源角标、切换、月度保存联动、资源离开无误提示、其它草稿仍提醒，检查 console。
- [ ] 推送 feature → 合并推送 dev → 合并推送 master；核验 Vercel READY、正式域名提交及线上命名流程。
- [ ] 局部更新原飞书 PRD 的计算、布局、提示、截图和原画板，回读；完成后停用 automation-2。

## 验收记录
- 2026-09-23：business/cumulative、dashboard、inline、monthly-cost、activation/cross-tab 回归通过；TypeScript、生产构建、diff 检查通过。
- 本地生产构建 DEMO017：1920/1366/960/640 CSS 视口，卡片与趋势容器 scrollWidth 等于 clientWidth；八卡分别为 1/1/2/4 行。
- 月度 2026-09 产品部从 1.8 改为 2.8，累计人月从94.253变为95.020，费用471.27变为475.10；离开资源无确认，已恢复原值。单纯聚焦也不触发确认，非法草稿保护有执行回归覆盖。
- 密集月份首两个轴标签相撞已修正，贪心间距保留首尾与全部52个月度系列点；周度230点、阶段24点；费用提示显示独立费率，浏览器error/warn为空。
- 独立复查发现旧锁定快照缺少部分正投入部门月度行会被计0，已补未知值及缺行提示，并通过复核。
- 起算日使用现有项目档案 planStartDate；缺失提示补全，不用创建日期。PRD同步说明该口径。
