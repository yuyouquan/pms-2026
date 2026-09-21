# 项目空间资源权限实施计划

> **For agentic workers:** Use subagent-driven-development for the independent defaults task and verify both contract and implementation before release.

**Goal:** 在项目空间权限配置增加资源权限，并将查看、版本管理、导出和投入编辑按角色独立授权。

**Architecture:** 权限表继续由项目 rolesByProject / rolePermissionsByProject 管理。新增八个 resource 权限键，补齐缺失默认值而不覆盖显式 true/false。资源使用统一作用域权限函数，视图与 store 动作均校验，后台刷新不走用户写入授权。

**Tech Stack:** Next.js 14、React 18、Ant Design 6、Zustand 4、TypeScript。

## 权限契约

| Key | 显示名 | 默认授权 |
| --- | --- | --- |
| resource:view | 查看 | 所有空间角色 |
| resource:createVersion | 新建版本 | 系统管理员及类型负责人 |
| resource:lockVersion | 锁定/不锁定 | 系统管理员及类型负责人 |
| resource:setOfficialVersion | 设置为正式版本 | 系统管理员及类型负责人 |
| resource:deleteVersion | 删除 | 系统管理员及类型负责人 |
| resource:export | 导出 | 系统管理员及类型负责人 |
| resource:laborEdit | 各部门人力投入 | 所有空间角色 |
| resource:nonLaborEdit | 非人力投入 | 所有空间角色 |

类型负责人：整机 SPM，tOS 版本项目经理，技术 技术项目负责人，能力建设 系统管理员。全局管理组保持既有管理员通行规则。多角色授权取并集，无空间角色的人员不因全局查看组/编辑组自动获权。

边界：权限不能突破版本锁定、关联预算只读、来源里程碑只读、整机模型部门投入只读。月度编辑归 laborEdit。基础信息/里程碑/模型维护暂归 createVersion（用户已确认）。导出版本及资源看板均校验 export。设置/取消正式共用一项，锁定/解锁共用一项。

## Task 1 — 权限定义、默认值、配置界面（独立）

Files: src/constants/permissions.ts, src/stores/permission.ts, src/components/permission/PermissionModule.tsx; scripts/verify-resource-permission-defaults.mjs.

- [x] 补齐八个资源键和类型负责人默认映射。
- [x] 让整机 SPM 固定角色来自真实 SPM 字段；保留已有系统管理员和其他角色。
- [x] 初始、旧缓存、ensure/sync、创建角色/项目都补齐资源默认值；显式关闭保留；自定义角色不能靠改名获得管理权限。
- [x] 界面展示“资源”分组和默认规则，当前角色勾选仍可修改并保存。
- [x] 验证四类负责人/普通成员/管理员/非成员、显式 false、重载和项目隔离。

## Task 2 — 资源授权边界与操作接入

Files: src/lib/hrProjectRegistry.ts, src/lib/hrVersionRules.ts, src/lib/resourceInlineEditing.ts, src/lib/resourceStoreActions.ts, src/stores/hr{Machine,Tos,Technical,Capability}.ts, src/components/project-resources/*.

- [x] 统一 canResourceAction(record, action, scopeId?, actor?)，查看/导出允许当前正式项目关联年度预算读取；写入须为所属空间且未绑定为只读。
- [x] 将版本创建/复制/锁定/正式/删除写入按动作校验；直接 store 调用同样拒绝越权。
- [x] 按字段分离 laborEdit、nonLaborEdit、createVersion，批量更新逐字段验证且原子拒绝。
- [x] 月度人力与看板/版本导出应用对应权限；延迟导入、弹窗确认在执行时重验当前身份授权。
- [x] 不将旧人力管道状态管理意外开放给普通资源编辑者，后台同步与历史快照继续保留。

## Task 3 — 验证与交付

- [x] 新增行为回归覆盖四类项目、跨项目、锁定、权限撤销、普通成员投入修改而不能管理版本。
- [x] 运行相关 permission/resource verifiers，npx tsc --noEmit，npm run build，git diff --check。
- [x] 浏览器验证管理员权限配置、普通成员编辑/管理隐藏、负责人管理、撤销生效及恢复。
- [x] 独立规格审查与代码审查，解决阻塞问题。
- [ ] 按会话既定 feature → dev → master 发布流程交付，核验 Vercel commit 与线上交互/runtime。


## 验证记录（发布前）

- 第一轮：八项默认值 9 组行为；四类资源直接操作、混合字段原子拒绝、跨空间、锁定、关联年度预算；版本/行内编辑/正式版本/月度重分配相关回归全部通过。
- 独立审查修复：模型字段运行时白名单；能力建设日期参数不能覆盖投入授权校验；资源元数据写入须在已授权同步事务中；SPM 来源变动立即同步。
- 第二轮：新增越权用例、权限 UI、角色同步、权限矩阵、项目管理再审 9 组、资源行内编辑再次通过。TypeScript、Next.js production build、diff 检查通过。
- 浏览器：DEMO017-DEMOCHIP001_DEMOBOARD016，演示用户08 无版本管理/导出按钮，可以将月度 2.7 改为 2.8 后保存并恢复；非人力为编辑态、整机配置部门只读。演示用户03（SPM）有创建、锁定、正式和导出权限。撤销开发工程师人力权限后月度输入立即消失，恢复授权正常。
- 最终构建浏览器：SPM 人员来源控件只读；锁定后月度与基础字段只读；解锁、取消/设置正式正常；关联年度预算只能查看/导出；浏览器 error 日志为 0。
- 本地浏览器仅使用独立 localhost:3053 的 mock 数据，测试改动已恢复；原工作目录保留不动。
