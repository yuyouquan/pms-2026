# 权限中心列分组与数据权限布局验收

## 修复范围

- 项目视图权限的列选项复用 `buildProjectListColumnUnits`，与实际项目视图保持相同字段、顺序和里程碑分组。整机、tOS、技术 TDT / 子项目均仅显示一个“里程碑”。能力建设项目继续显示暂无可配置列。
- 保存仍使用字段权限，不迁移为分组权限。历史部分里程碑授权显示半选；阅读配置或编辑其他列不会扩大授权。人员视图同样合并展示。
- 可见数据、可见列分区，操作按钮右对齐；已选列默认展示 8 项并提供展开/收起；列选择面板支持双列列表和搜索。

## 自动验证

以下命令均通过：

- `node scripts/verify-permission-column-units.mjs`（修复前已确认字段来源断言失败；修复后通过）
- `node scripts/verify-project-type-data-permissions.mjs`
- `node scripts/verify-permission-center.mjs`
- `node scripts/verify-permission-center-projects.mjs`
- `node scripts/verify-permission-center-inactive-conditions.mjs`
- `node scripts/verify-permission-center-corruption.mjs`
- `node scripts/verify-sortable-column-settings.mjs`
- `npm run build`
- `npx tsc --noEmit`
- `git diff --check`

本轮针对受影响链路回归，未重复执行上轮的全仓库 189 个脚本。构建仅有现存 Browserslist 数据过期提示。

## 本地浏览器验收

使用 localhost:3017，虚构演示数据，演示用户01。

- 一般查看组 → 项目视图 → 整机：列设置共 38 项，里程碑仅一个，不再单独显示 STR 节点。
- 清空可选列后选项目名称和里程碑：摘要 2 项；刷新后恢复相同配置。
- 全选后摘要只显示 8 项；展开显示 38 项、里程碑一个；收起成功。
- tOS 共 3 项（tOS版本必要列、里程碑、版本项目经理），技术 TDT 11 项、子项目 7 项；切换类型保持配置独立；能力建设无可配置列。
- 搜索“里程碑”只返回一个选项；人员视图按角色展示合并后的里程碑；系统超级管理员的数据/列设置只读。
- 清空筛选值触发未生效提示，列设置禁用，切换类型触发离开确认；补全恢复生效。
- 1025px 与 700px 实际 CSS 视口，页面及两个配置区均无横向溢出，列搜索与操作可用；测试后重置视口。
- 浏览器错误/警告日志为空。临时一般查看组配置恢复为全部数据、全部列。

独立代码复核未发现需要修复的问题；部分旧授权的安全性由行为测试覆盖。
