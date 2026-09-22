# 项目创建权限与模拟通知验证

日期：2026-09-22。基线：origin/dev `3df5f30897b1f1e9c4a9bb89e891f73945fd04ff`。

## 结果

- `verify-project-creation-rules.mjs`：6 组行为检查通过，覆盖 9 个属性/类型组合与 9 个身份、服务与 Store 权限、IPM 类型伪造、角色同步、操作者不获得空间权限、模拟通知和持久化。
- `verify-project-registry.mjs`：14 组通过。
- `verify-project-registry-transactions.mjs`：创建、编辑、删除的原子状态检查通过。
- `verify-project-management-access.mjs`、`verify-project-management-navigation.mjs`、`verify-project-role-sync.mjs` 通过。
- `npm run verify:resource-permissions` 通过，保留空间资源权限边界。
- `git diff --check`、`npx tsc --noEmit`、最终 `npm run build` 通过。

## 浏览器验证

第一轮：乔永峰只能创建正式整机；创建后通知接收人是表单所选演示用户04；操作者进入项目空间被拒绝；切换所选责任人可进入，SPM 与系统管理员均为演示用户04，普通责任人没有项目配置入口。

第二轮：游进可创建预算且编辑名称，模拟通知固定给游进；王健（Jim）不能编辑预算，创建默认路标/整机，模拟通知固定给王健（Jim）；刷新后项目与通知接收人、原始内容保留在历史中。

修复并复测：能力建设无通知时不写 undefined 字段；路标限定用户首次打开表单的默认属性；新增人员后的长菜单滚动与头像别名处理。

## 既有基线失败

以下均在未修改的 dev 工作树再次复现，未改变其业务规则：

- `verify-mock-data-hygiene.mjs`：10/11 通过，项目 15 的演示成员03不属于登录目录，目录一致性断言失败。
- `verify-project-registry-final-fixes.mjs`：5/6 通过，关联预算在移除原责任人后对正式项目成员的可见性断言失败。该范围属于既有资源可见性，本次不调整。

通知为用户确认的模拟流程；未向真实飞书服务发出消息。历史记录保存发送时的模拟接收人与内容，不会因编辑或刷新重复生成。
