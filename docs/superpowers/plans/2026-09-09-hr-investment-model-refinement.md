# 人力投入与模型配置调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成用户本轮七项调整，并在本地 dev 验证交付。
**Architecture:** 保留现有四个业务 store；共享版本选取、年度预算编辑规则与部门联动选项。模型配置通过现有 hrConfig store 原子更新同版本记录，独立统计弹窗汇总。
**Tech Stack:** Next.js 14 / React 18 / Ant Design 6 / Zustand / TypeScript。

## 需求口径
- 四类版本表项目名之后依次显示预算类型、版本号；版本表与月度表移除批次列/编辑，旧存储字段保留兼容（用户已确认）。
- 年度预算最新版本的里程碑及整机项目等级可手动修改，绑定后也采用手动值；其他预算绑定后继续跟随正式主市场/主类型最新已发布一级计划。历史版本保持只读快照（用户已确认）。
- 整机新增版本弹窗删除顶部提示与版本规则；表单验证保留。
- 三类部门投入弹窗在项目或预算选择变化时回填同预算最新版本；不存在时按 createdAt 取项目最新版本；复制所有部门与阶段，编辑草稿不影响来源。版本号仍按当前预算类型独立计算。
- 版本新建、模型新建编辑的部门只能从关联下拉选择，变更一级部门清空不匹配的二级部门。候选由现有模型/阶段配置和项目版本的实际部门对汇总，保留旧数据，不将二三级部门映射冒充一二级。
- 模型编辑表单每行三字段；启停需二次确认，按模型版本号整组启停。新增按钮右侧添加模型版本统计，显示每个版本各等级各阶段人力合计与总量，包含禁用模型并标注状态。

## Task 1: 部门联动及模型管理
Files: src/lib/hrDepartments.ts, src/hooks/useHrDepartmentOptions.ts, src/lib/hrModelStatistics.ts, src/components/hr-config/{ConfigEditModal,ConfigTablePanel,HrModelStatisticsModal}.tsx, src/stores/hrConfig.ts, scripts/verify-hr-model.mjs.
- [x] 先添加行为断言：一级部门切换后二级不越级、同模型版本整组启停、其他版本不变、各等级分阶段精确求和。
- [x] 实现共享部门选项 API：useHrDepartmentOptions() 返回 primaryOptions、getSecondaryOptions(primary)、isValidPair(primary,secondary)。
- [x] 模型表单使用联动 Select、三列 Row/Col；在有效父选项变化时同步清理子值并验证。
- [x] hrConfig 原子更新同版本 enabled；确认弹窗显示版本号和影响条数；取消无任何变动。新增/改入已有模型版本继承其启停状态。
- [x] 统计由完整 hrModel 数据按版本+等级汇总，弹窗使用现有配置阶段标题，数字保留一位小数；列头与数据对齐，无无关状态控件。
- [x] 类型检查、模块断言、浏览器验证；需求审查后进行质量审查。

## Task 2: 版本回填和年度预算规则
Files: src/lib/hrVersionRules.ts, src/lib/hrProjectSync.ts, src/stores/hr{Machine,Tos,Technical,Capability}.ts, src/components/hr-*/NewVersionModal.tsx, scripts/verify-hr-investment.mjs.
- [x] getHrVersionSeed(versions,budgetType) 先 getLatestHrVersion 同预算，再用 createdAt 选最新。
- [x] allowedHrVersionUpdates 与同步逻辑共同保留年度预算手动字段，历史保护不变；新建年度预算初始化来源快照，后续发布不能覆盖手动值。
- [x] 弹窗只在打开/项目/预算切换时复制来源部门数组和字段，避免 store 订阅刷新覆盖草稿；保存验证所有部门对，独立分配新版本编号。
- [x] 接入 Task 1 的部门下拉并验证导入数据；现有缺失日期与人月分配规则保留。
- [x] 更新旧断言中的年度预算绑定契约，补充手动值发布后保留、非年度继续同步、同预算/跨预算回填及复制隔离。

## Task 3: 表格顺序和批次清理
Files: 四类 HistoryVersionSpace.tsx / MonthlyInvestmentTab.tsx，以及相关版本详情与导出。
- [x] 项目名后移动预算类型和版本号，对应固定列、滚动宽度、合计与导出顺序一致。
- [x] 移除批次列和编辑入口，不删除已有持久化数据。检查所有详情路径，不残留误导的编辑提示。
- [x] 年度预算最新版本可编辑入口与 store 权限一致；其他预算绑定后保持只读计划。
- [x] 整机新增版本删除提示及版本规则。

## Task 4: 验收与本地交付
- [x] npm run verify:hr-investment、npm run verify:hr-version-refinement、npm run verify:hr-model、npx tsc --noEmit、npm run build。
- [x] 浏览器覆盖四类列顺序与无批次、年度预算绑定编辑、3类同预算和跨预算回填、联动部门、模型三列表单、启停取消/确认/全组、模型统计、历史快照、控制台与网络错误。
- [x] 记录新证据，提交到本地 dev，原目录未提交改动完整保留。本轮无自动推送/发布。
