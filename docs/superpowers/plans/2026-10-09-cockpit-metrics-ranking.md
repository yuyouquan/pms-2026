# 驾驶舱同排指标与分类核算排行

**Goal:** 将八项核心指标在桌面同排展示；排行只查看核算，按项目类型切换前五。

**Architecture:** 沿用现有资源事实和排序算法，在排名入口按 category 筛选，所有合计和占比用该类型完整可用项目作为分母。新增内存阅读设置 rankingCategory 替代已移除的 rankingMetric。桌面八列同排，窄屏仍自适应。

**Tech Stack:** React / Zustand / Ant Design / CSS；保留 Remotion 与 ECharts。

用户已明确授权本轮两项改动及此前自主迭代，按截图中的排行只保留核算处理（截图原按钮实际为项目预算）。顶部项目概算指标保留。无需再次审批设计。

- [x] 排行回归先增加七项目 topCount=5、占比25/28及按类型隔离分母、零/缺失与单位断言，执行确认失败。
- [x] `cockpitRankingData.ts` 增加 `CockpitRankingCategory` 与 `COCKPIT_RANKING_LIMIT=5`；筛选在项目汇总前进行，前五占比不截断总体分母。
- [x] `cockpitUi.ts` 使用 `rankingCategory: 'all'`，保留每用户阅读选择；同步界面状态回归。
- [x] `CockpitProjectRanking.tsx` 标题改项目核算排行，全部/四类 Segmented；显示最多五条及实际前N占比。`HrPipelineContainer.tsx` 定位总览时传递当前类型并使用 actual 核对列；保护返回与权限。
- [x] `globals.css` 桌面 >=1200px 八列，每项独占一列，比例改为上下结构并统一数值基线；保留窄屏两列，类别切换可横向滚动。
- [x] 相关排行、状态、资源口径、导航回归通过；顺序 tsc 与 build；3038 本检出生产预览实测 1920/1512/1280 与390，核算类型/合计、明细往返、前五边界、全屏、技术运营空白、减少动效、控制台。
- [x] 差异审查、QA记录完成；feature提交推送及远端一致性由本聊天最终结果核验。

不足五个来源时只显示实际项目，不补造数据。全局核心指标不受排行局部类型影响。无新数据来源、权限或编辑行为。
