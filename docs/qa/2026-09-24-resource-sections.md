# 资源分区与技术项目排布控件回归

## 本次调整

- 版本详情采用浅灰画布与三个白色主区块：基础信息与里程碑（其他类型为里程碑计划）、预估投入分配、月度人力投入。保留轻量的内部表格样式。
- 品牌、产品线、市场名、项目等级、等级系数、人力模型版本号统一为 14px、500 字重、22px 行高。
- 技术项目隐藏顶部「规划启动 / EDCP / 按模型排布」工具栏；保存的里程碑日期及原有编辑权限保留，其他预算类型的排布能力保持原有规则。

## 自动检查

- `npm run verify:resource-inline`：通过。
- 修改技术项目条件后单独重跑 `node scripts/verify-resource-inline-date.mjs`：通过。新增断言先在旧逻辑下失败，再验证技术预算无排布工具栏、保存日期不丢失、tOS 预算仍允许排布。
- `npm run verify:resource-monthly-cost`、`npm run verify:budget-scheduling`、`npm run verify:liquid-glass`：通过。
- `npx tsc --noEmit`、`npm run build`、`git diff --check`：通过。

## 浏览器验证

- 1920×1080：整机项目概算三个主区块清晰，六项基础字段标签的实际计算样式一致；部门表格可用宽度与内容宽度均为 1533px。
- 技术预算项目 `mock-budget-technical-unbound`：顶部排布日期范围及按钮数量为 0，九个既有里程碑日期仍显示。
- 1280×900：页面无横向溢出；技术里程碑点击编辑及 Escape 取消正常，人力/非人力页签切换正常。
- 上述流程未发现浏览器运行时错误。

截图保存于当前任务的 `resource-sections-20260924` 证据目录，发布后另行核验正式域名与远端提交一致。
