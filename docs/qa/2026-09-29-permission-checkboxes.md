# 权限批量复选框验收

范围：权限中心、项目空间团队&权限、角色权限配置模板的父级和叶子菜单。移除“全选 / 取消权限”文字按钮，改为标题前复选框；提示统一为“全选 / 取消全选”。

复选框按完整目录计算未选、半选、全选状态；搜索不改变批量范围；折叠仍由独立标题按钮处理，授权沿用原有原子操作及禁用规则。

验证通过：

- `verify-project-permission-ui.mjs`：项目/模板与全局父子节点的三态、全选、取消全选、搜索完整子树、只读、超级管理员及草稿禁用。
- `verify-permission-center-matrix.mjs`、`verify-team-role-template-ui.mjs`。
- `npx tsc --noEmit`、`npm run build`、`git diff --check`。
- localhost:3017 真实模板 Modal：搜索基本信息后父级全选包含隐藏转维子项；取消叶子后父级半选；父级从全选取消后所有子项清空；折叠独立工作。临时勾选已恢复默认只读模板。
- 浏览器 error/warn 为 0；独立代码审查无阻断问题。

本次仅复测受影响的交互与构建。完整权限实现的上一轮 188 项回归与修复复测记录见 `2026-09-29-role-templates-team-permissions.md`。

![标题前批量复选框](assets/2026-09-29-permission-checkboxes.png)
