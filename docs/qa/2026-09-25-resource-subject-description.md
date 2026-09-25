# 科目说明与非人力一级部门回归

## 范围

- 科目配置新增可选多行“科目说明”，最多 500 字，支持编辑、列表、导入导出与刷新持久化。
- 非人力投入首列新增一级部门，依次联动二级、三级部门。改变上级清空下级，保留金额和科目。
- 三级科目右侧说明图标支持鼠标悬停和键盘聚焦；优先读取当前配置，已删除科目使用行内说明快照，无说明时显示“暂无科目说明”。
- 模板与版本导出包含一级部门；总览部门过滤、累计费用和操作日志使用显式一级部门。
- 原有无一级部门的历史行与金额保留。旧模板仅在归属唯一时补全一级部门；归属歧义时提示下载新模板。
- 新版示例部门映射配置补充一级部门；刷新只补充未改名的内置记录中缺失的新字段，不覆盖用户留空、改名或删除。

## 自动验证

以下命令全部通过：

- `npm run verify:non-labor-investment`
- `node scripts/verify-non-labor-import.mjs`
- `node scripts/verify-resource-subject-description.mjs`
- `npm run verify:resource-inline`
- `npm run verify:resource-dashboard`
- `npm run verify:resource-dashboard-business`
- `npm run verify:resource-expense-followup`
- `npm run verify:resource-permissions`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`

新用例覆盖部门层级有效性、跨一级部门重名、部分填写自动保存、历史行保留、配置说明更新/清空/删除、500 字限制、权限、新旧模板导入及隐藏月份保留、费用部门归属。

## 浏览器验证

使用本地生产构建 `http://127.0.0.1:3027/`：

1. 配置中心编辑机票的多行科目说明，保存、刷新并重新进入后内容一致。
2. 项目概算的非人力投入首列显示一级部门；机票说明图标显示上述最新配置。
3. 新增“研发中心 / 硬件部 / 射频设计 / 办公费 / 办公耗材”行，填写 123.45 元，离开单元格自动保存；刷新并重新进入后部门、科目和金额一致。
4. 关联年度预算仍显示只读状态，无一级部门编辑框和新增按钮；科目说明图标仍可查看。
5. 浏览器 error 日志为空。1280×720 截图确认字段与说明图标正常显示。

截图保存在任务可视化目录的 `resource-subject-description-20260925/`：`config-description.png`、`expense-subject-tooltip.png`、`expense-primary-saved.png`、`readonly-subject-tooltip.png`。

本次保留原有版本页面线框、金额单位和业务权限；未修改原始工作区中的未提交内容。
