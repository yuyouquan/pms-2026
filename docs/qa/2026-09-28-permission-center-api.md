# 权限中心 API 对接

领域类型：`src/types/permissionCenter.ts`，目录：`src/constants/permissionCenter.ts`。

## Store

`usePermissionStore` 新增 `permissionCenter?: PermissionCenterModel`。运行应用在渲染鉴权消费者前调用 `ensurePermissionCenter()`，缺失时把旧全局配置一次性迁移为可见策略。新角色无策略。测试可以不初始化，兼容旧项目权限验证。

所有写操作返回 `{ ok: true, roleId?: string } | { ok: false, error: string }`。失败显示 `error`；不显示保存成功。

- `ensurePermissionCenter()`
- `createCenterRole(actor, { name, groupName, description? })`
- `updateCenterRole(actor, roleId, { name, groupName, description? })`
- `deleteCenterRole(actor, roleId)`
- `updateMenuPolicy(actor, roleId, menuId, partialPolicy | (previousPolicy) => nextPolicy)`
- `setSuperAdminMembers(actor, members)`

成员与权限同步修改优先函数形式，回调读取最新值。`updateMenuPolicy` 自动处理查看依赖：有操作则添加查看；显式移除原有查看则清空操作。条件及列校验失败不修改已生效策略。内置超管不能修改角色元数据、删除或设置菜单策略；只有超管能改超管成员。旧 global setters 在新模型初始化后失效；旧 globalRoles 的管理组成员映射为内置超管，保证旧只读消费者兼容。

## 授权

- `hasMenuPermission(user, menuId, action = 'view', row?)`
- `useMenuPermission(user, menuId)` 返回 `{ can(action?, row?), columns(action?, row?), project(rows, action?) }`
- 纯函数 `evaluateMenuPermission(model, user, menuId, action = 'view', row?)`
- 纯函数 `evaluateWholeMenuPermission(model, user, menuId, action)`：全量操作要求同一策略全部数据和全部列，拒绝仅条件或指定列授权。
- `projectAuthorizedRows(model, user, menuId, action, rows): Partial<T>[]`
- `getAuthorizedColumns(model, user, menuId, action = 'view', row?): string[]`

无 row 的授权只适合入口。记录修改必须提供原记录；导出调用 action=`export` 的投影。列并集只用于表头，单行值必须使用逐行投影。全部列策略保留整条记录；指定列策略仅输出允许列及结构 `id`，不得从原数据补回被隐藏值。字段读取兼容项目 fieldValues。

## Policy

`{ roleId, menuId, users: string[], departments: string[], actions: PermissionAction[], data: { mode: 'all'|'conditions', conjunction: 'all'|'any', conditions: { id, field, operator, value? }[] }, columns: { mode: 'all'|'selected', fields: string[] } }`

`createEmptyMenuPolicy(roleId, menuId)` 创建无人员、无操作策略。`validateMenuPolicy(policy)` 返回相同 Result。`getPermissionOperators(field)` 列出可用运算符。运算符 eq/neq/contains/notContains/in/notIn/empty/notEmpty/gt/gte/lt/lte；in/notIn 需要字符串数组。

`getPermissionFields(menuId)` 返回业务字段；`registerPermissionFields(menuId, fields)` 注册真实动态任务及列表字段元数据（合并同名字段），建议应用初始化时注册。未知字段在运行时拒绝，已保存动态策略刷新前不会被删除。`PERMISSION_MENUS` 给出分类/名称/动作；字段显示调用 getter 以包含注册字段。`PERMISSION_ACTION_LABELS` 提供中文操作名。`PERMISSION_USERS`、`PERMISSION_DEPARTMENTS`、`PERMISSION_USER_DEPARTMENTS` 来自已有人员及部门目录。

## 菜单 ID

- `workbench`, `project.view`, `project.config`, `joint.plan`
- `roadmap.table`, `roadmap.evolution`
- `hr.${HR_SIDEBAR_NAV group.children leaf.key}`（例如 `hr.investment/machine`）
- `config.${CONFIG_MENU_GROUPS group.children leaf.key}`（例如 `config.plan:整机产品项目`, `config.enum:brand`, `config.hrPipeline:hrModel`；请由真实导航 key 生成）
- `permission.center`

存储版本 3；新模型 version=1。初始 legacy 管理组迁为 `builtin:superadmin`，其他角色按旧 grant 映射。历史公开入口及项目配置指定负责人范围作为“历史兼容授权”分组中的可编辑策略。项目角色数据不变。

## 当前验证

首个行为测试在 API 不存在时以 ENOENT 失败；实现后通过。首次 TypeScript 检查通过。额外行为测试覆盖数字/日期比较、AND/OR、部门匹配、操作依赖、普通管理员防提权、未知超管身份拒绝、动态字段注册、失败存储回滚及成功存储回读；均通过。既有全局权限矩阵、项目空间权限矩阵通过。最终全仓结果以任务 QA 报告为准。
