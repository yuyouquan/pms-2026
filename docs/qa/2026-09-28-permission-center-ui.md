# Task 2 权限中心界面交接

2026-09-28；实施工作树 `pms-permission-config/pms-2026`；未提交。

## 实现

- Header 在配置中心后新增权限中心；全部主导航按菜单授权显示，页面渲染也使用同一判定。动态撤权卸载原模块并选择第一个仍可访问模块；无入口显示无权限状态。
- Home 在权限持久化恢复后初始化迁移；失败提示重试。在子组件渲染前注册项目字段及实际模板字段。
- 用新 PermissionCenter 替换 GlobalPermissionContainer 对旧 GlobalPermissionConfig 的渲染。旧组件已无页面调用。
- 新建角色表单、180px 角色侧栏、176px 菜单侧栏、32px 控件；两侧可独立缩至40px，并使用明确可访问名称。窄屏用两个选择入口切换侧栏；分组与菜单搜索、长名称完整提示、增加成功自动展开角色栏并选中。
- 分组下拉可搜索和暂存新增分组，角色提交时才持久化；重名校验委托领域规则，支持编辑、确认删除。超级管理员元数据不可编辑。
- 当前菜单个人/部门选择和操作勾选即时提交；超管成员仅超管能修改，超管菜单操作均勾选且只读。失败保留旧策略，显示错误和重试。
- 条件编辑完整有效后提交；不完整和删除最后一条件保留生效策略与胶囊。字段、运算符及值编辑支持枚举、多值、日期和数字；枚举的包含支持自由输入。项目属性以现有中文标签呈现。
- 可见列搜索、全选和清空可选列，必要识别列受保护。过滤与列摘要复用 pms-active-filter-chip 原样式，文字点击打开编辑，关闭图标单独操作。
- `permissionCenterHasDraft` 独立于计划编辑状态，仅保护未完成筛选或角色表单；接入既有导航离开确认、测试身份切换。折叠不触发离开或销毁草稿。
- 格式无效的存储策略显示警告且按空策略展示，不授予访问；仅用户明确编辑才重建。

## 变更文件

- `src/components/permission-center/{PermissionCenter,RoleForm,PolicyEditor,DataPolicyEditor}.tsx`
- `src/components/permission-center/PermissionCenter.module.css`
- `src/components/permission-center/navigation.ts`
- `src/containers/{GlobalPermissionContainer,AppShell}.tsx`
- `src/app/page.tsx`
- `src/stores/ui.ts`
- `src/components/shared/CollapsibleWorkspace.tsx`（仅新增可选展开/收起按钮文案）

## 验证边界

- 本任务文件 `git diff --check` 通过。
- 最后一次 `npx tsc --noEmit --pretty false` 全仓通过（exit 0）。之前项目 agent 修改中的 RegistryRow 类型错误已修复。
- 根协调 agent 已报告浏览器确认主导航、必填报错和180/176/40px四种折叠状态。共享HMR导致测试上下文重置，完整持久化、条件、角色、多身份测试由协调 agent 在稳定构建继续。
- 本子任务未运行浏览器、build或全量回归，避免与协调 agent 并行操作同一页面；最终结论以整体 QA 记录为准。

## 主导航旧断言迁移

- `verify-project-management-navigation.mjs` 改为加载实际 `PERMISSION_MAIN_NAV`，逐项验证菜单 key/中文 label/完整顺序（权限中心在配置中心后），并验证 AppShell 确实消费该目录及当前身份过滤。
- `verify-tos-roadmap-single-entry.mjs` 验证目录中 roadmap key 和 tOS路标 label 均唯一，并保持返回文案及页面单入口检查。
- `node scripts/verify-tos-roadmap-single-entry.mjs` 通过。
- `node scripts/verify-project-management-navigation.mjs` 的导航目录检查已通过，随后在原101行项目配置导航断言失败：旧断言固定 `activateProject(project)`，当前权限投影适配后使用经权限检查的 `activateProject(source)`。此项属于项目 agent 的消费者适配，已交接该 agent 更新；未为通过而删除检查。
- 两个脚本 `git diff --check` 通过。

## P1 审查修复：未完成条件期间阻止其他授权变更

- 根因：首次条件草稿未提交，其他即时控件仍可把默认全部数据策略补成有效授权。
- 修复：PolicyEditor 接收条件未完成/未保存状态，同步保存至提交守卫 ref；禁用人员选择、功能勾选及全部列变更入口，并显示明确内联说明。守卫位于可重试动作内部，防止快速事件或旧重试绕过。
- 数据条件编辑使用独立允许路径；填写有效条件、重试失败的条件提交或明确切换到全部数据均可继续。已生效策略和胶囊不受未完成草稿影响；无效存储策略的警告保持。
- 回归场景交给根协调 agent 浏览器验证：新角色/菜单先选择条件模式且留空，再尝试人员、查看和列；应禁用且继续无授权。完成条件后控件恢复，只授予条件内行。已有有效条件改为不完整时仍保留旧授权。
- 本轮未操作共享浏览器、未修改领域逻辑、未提交。
- 修复后 `npx tsc --noEmit --pretty false` 全仓通过（exit 0）；两份修复文件 `git diff --check` 通过。
