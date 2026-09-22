# Resource Dashboard Business Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据业务参考图实现六项指标、四类趋势和可追溯工时核算。
**Architecture:** 共用纯函数完成日期折算、部门筛选和汇总；独立 Mock 人天/费用作为核算来源；React 看板消费只读结果。保留正式版本选择、权限及明细分析。
**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design, Zustand, SVG, existing Excel utilities.

- [x] 增加 `resourceDashboardPeriods.ts`、`resourceAccounting.ts`、独立核算 Mock，遵循人天/当月工作日。
- [x] 扩展 `resourceDashboardData.ts` 的一级部门和日期范围，统一预算与核算的月/周汇总。
- [x] 重构 `ProjectResourceDashboard.tsx`，抽取六张指标、趋势和明细，原分析收进更多分析，扩展同口径导出。
- [x] 添加行为回归 `scripts/verify-resource-dashboard-business.mjs`，覆盖跨年/周、部分月份、缺失来源、零分母、归属歧义、版本隔离和费用单位。
- [x] 运行新旧看板、月度费用和权限回归、`npx tsc --noEmit`、`npm run build`，真实浏览器验证筛选、版本、趋势、明细及空态。
- [ ] 检查 diff、推 feature，合并推 dev、master；验证远程树一致、Vercel 提交与线上交互、运行时错误。

## 验证记录

- 新业务回归通过：跨年周、闰月、部分月份、来源工作日换算、零分母/缺失数据、部门归属歧义、版本隔离、费用含非人力、九张 Excel 工作表回读。
- 原看板回归通过：四种项目来源、关联年度预算、正式版本选择、权限隔离及只读汇总。
- 月度费用回归通过：全周期/年度/月度费用、真实 React 表格/图表与费用行、原人月不变。
- 权限 domain/default 回归通过；UI verifier 补充新组件依赖后通过，仍覆盖导出权限即时撤销、来源解除关联及纯核算导出。
- `npx tsc --noEmit` 通过；生产构建通过。最终版式调整后的生产构建也已通过。
- 本地浏览器 DEMO017：默认正式预算 100 人月；项目核算 28.936 人月、149.37 万元；切换概算 V0.2→V0.1，核算保持不变。
- 筛选研发中心/软件部、2027-01-01～01-15：10 人天/21 工作日=0.476 人月，2.38095 万元人力+0.96 万元非人力=3.34095 万元；周度趋势与明细一致。
- 导出获得成功反馈；更多分析正常。DEMOP21 无正式版本/核算来源时指标为破折号且显示空态；浏览器 error/warn 为空。
- 浏览器发现 1280 窗口第六卡需要滚动，已收紧同排六卡最小宽度；最终生产构建浏览器复验：六卡同为 y=237，最后一张右边界 x=1226，1280 窗口完整同排显示。
- Mock 数据完整性/存储回归通过；使用既有版本和独立演示核算数据，无业务数据回写。
