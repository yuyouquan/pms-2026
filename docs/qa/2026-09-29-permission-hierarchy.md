# 全局功能权限层级展示验证

## 变更

权限中心的功能权限改用项目空间的紧凑层级表格：仅保留菜单、功能权限两列；分类整行展开/收起，子菜单按层级缩进；支持展开/收起全部、完整路径搜索。人员视图的权限来源移到对应操作下方。两处复用表格样式，角色授权及数据权限规则保持原有行为。

## 验证结果

- `node scripts/verify-permission-center-matrix.mjs`：通过，全部在范围内的菜单仅出现一次、分类独立、搜索保留完整路径。
- `node scripts/verify-permission-center.mjs`：通过，权限求值、边界、迁移和存储。
- `node scripts/verify-permission-center-role-assignees.mjs`：通过，角色人员/部门归属、撤销、合并及持久化失败保护。
- `node scripts/verify-permission-center-global.mjs`：通过，全局集成、导航隔离、实时授权。
- `node scripts/verify-project-permission-ui.mjs`：通过，项目角色配置及原有紧凑表格交互。
- `npx tsc --noEmit`：退出 0。
- `npm run build`：最终构建退出 0，含类型与 lint 检查；仅有已有 Browserslist 数据过期提示。
- 本地生产预览 `http://localhost:3017/`：超级管理员全选锁定；分类和全部展开/收起；收起后搜索能显示命中的后代，清空恢复收起状态；模板项目类别可独立收起；不存在的搜索显示空态。
- 管理员勾选项目视图导出立即生效，刷新后仍保留；随后撤销并刷新验证已恢复测试前的有效权限。
- 人员视图维持两列，全部勾选不可编辑，菜单对应来源角色正常显示。
- 最终构建确认普通菜单、二级分类、三级分类缩进分别为 30/48/66px；叶子文本不以斜杠拼接显示。
- 700 CSS px 窄屏：菜单与操作分行，页面和权限表均无横向溢出；完成后恢复默认视口。
- 项目空间权限配置仍保留两列表格，4 个分类、21 个操作，分类折叠正常。
- 浏览器错误和警告日志为空。

视觉检查中发现全局表格的 `!important` 内边距覆盖菜单单元格缩进，已将缩进放入标签容器；重新构建并在浏览器核对计算样式。

浏览器记录见 [JSON](assets/2026-09-29-permission-hierarchy-browser.json)，界面截图见 [PNG](assets/2026-09-29-permission-hierarchy.png)。截图为原始浏览器捕获，工具留有右侧与下侧空白边缘。
