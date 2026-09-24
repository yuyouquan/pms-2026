# 项目资源界面视觉简化

## 范围与设计

资源页面原有页签、筛选、指标卡、版本说明、里程碑、投入表格和月度汇总各自带外框，嵌套后边界过多。本次用间距与浅色底区分信息层次：

- 主导航保留一条轻分隔线；内容区取消重复圆角外框。
- 八项指标使用浅灰底和小色点，保留正式版本、规则提示以及费用悬停交互。
- 版本说明、月度摘要使用浅底色；里程碑保留阶段颜色，降低背景饱和度并去除单元格竖线。
- 表头、合计行弱化边界；编辑框常态为浅色填充，聚焦仍显示紫色边框，错误仍显示红色提示。锁定时仍为只读文本。
- 新增 `pms-project-resources` 样式作用范围，不改变共享配置中心、人力资源管道及其他项目页面。

字段、公式、自动保存、版本管理、权限与导出逻辑未修改。

## 验证

以下命令均通过：

- `npm run verify:resource-dashboard-business`
- `npm run verify:resource-inline`
- `npm run verify:resource-versions`
- `npm run verify:resource-permissions`
- `npm run verify:resource-monthly-cost`
- `npm run verify:liquid-glass`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`

浏览器以 tOS16.1 检查总览、项目预算、部门人力、非人力、月度汇总；验证输入聚焦、16.5→17.0 自动保存并恢复16.5、Escape 取消、锁定后编辑框数量为0、解锁恢复。导航没有错误触发离开确认。阶段趋势切换正常，验证期间无浏览器 error 日志。

实测 CSS 视口 1440、1023、767 px：指标分别按 8、4、2 列排列；八张指标卡均存在，资源根容器、指标区、总览趋势区的 scrollWidth 与 clientWidth 相同。多月份编辑表格与里程碑原有的内部横向滚动保留。

截图与发布核验记录保存到本任务的 `resource-visual-polish-20260924` 本地证据目录。
