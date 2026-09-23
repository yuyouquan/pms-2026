# 一级计划业务子任务同步与序号修复

## 确认范围

- 整机验证阶段显示序号 4，STR5 显示 4.1，上市阶段 5、生命周期阶段 6。展示序号与节点持久化 ID 分离。
- 整机上市/生命周期、tOS 上市迭代/维护的业务子任务，在修订版和最新发布版共用一份数据。新增、改名、日期、删除和排序同步；发布、取消或重建修订不覆盖共享数据。
- 历史发布版保持快照。项目与市场/tOS 类型隔离，沿用管理组、项目维护人员权限和跟随类型只读规则。

## 实现

`level1BusinessTasksByScope` 按项目 + 市场/类型保存业务阶段的子任务；每次变更同步到当前最新发布快照。修订和最新发布的列表、横版、甘特与导出通过同一投影读取，历史版本不使用共享投影。确认动作重新检查用户、项目、范围、版本与权限，避免弹窗期间切换范围导致错误写入。

整机旧 `marketPlanData` 没有项目维度。v17 迁移完整备份到 `legacyUnscopedMarketTasksByMarket`。只有业务节点 stableId 与父阶段在唯一项目/市场的真实最新快照中匹配时，才恢复旧草稿字段到该项目共享集合；无法判定归属的数据留档，不分给首次打开的项目，也不依据运行时补齐的快照推测归属。

## 验证

- `npx tsc --noEmit`
- `npm run build`
- `node scripts/verify-level1-shared-business.mjs`
- `node scripts/verify-level1-plan-governance.mjs`
- `node scripts/verify-level1-flat-milestone-gantt.mjs`
- `node scripts/verify-machine-stage-split.mjs`
- `node scripts/verify-plan-task-identity.mjs`

浏览器验收使用独立测试会话，覆盖整机/tOS 双向新增、改名、删除、日期同步及非法日期拦截、取消/重建/发布修订、旧发布版不变、横版列同步、项目/市场/类型隔离、管理组/项目维护人员/无权限用户。使用 DEMO017、DEMO013 与 tOS16.1 的模拟数据；测试新增数据仅保存在该浏览器测试会话。

验收结果：上述类型检查、构建及 5 个脚本均通过；生产模式 `http://127.0.0.1:3042/` 的刷新保留、序号、双向同步、取消修订、历史快照与横版列同步复核通过，浏览器运行时错误为 0。
