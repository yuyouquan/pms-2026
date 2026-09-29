# 权限中心最终代码审查

日期：2026-09-28。分支：`codex/feature-permission-config`。基线：`f531a96071465253038ef8499bdc3cabfe865d3c`。

审查对象为基线上的未提交实现及新增文件；对照已确认的权限中心设计与实施计划，检查权限领域、持久化和项目/路标/配置/人力/组合计划消费者。审查过程仅修改本记录，没有修改产品代码或提交。

## 首轮发现

| 级别 | 问题 | 触发证据 |
| --- | --- | --- |
| P1 | JSON 合法但结构损坏的权限缓存回退默认超级管理员 | `{state:{},version:3}` 经读取、合并、初始化后，`演示用户01` 恢复超级管理员权限。 |
| P1 | 项目配置历史跨授权范围泄露隐藏字段 | 当前 A 范围允许全部字段、历史 B 范围仅允许名称时，历史入口仍展示 B 快照中的旧项目编码 `SECRET-B`。 |
| P2 | 项目视图分类统计和筛选读取未授权分类字段 | 仅允许名称时，分类数量及分类/二级分类筛选仍读取原始 `type/secondaryCategory`。 |

## 定向复审

- 历史记录：`canReadProjectRegistryHistory` 对当前项目和每个非空 before/after 快照分别要求全字段授权；历史变更及创建通知共用过滤后的数据。创建、删除的合法单侧快照保持可用，双空快照拒绝。代码与专项回归通过。
- 损坏缓存：覆盖非法 JSON、非法外层结构、缺失/非法中心模型、错误状态持久化及默认管理员同步撤销。复审发现并关闭了当前 `version:3` 配合 project-only 结构重新初始化超管的分支。真实存储读取现在仅对已知旧版本 0–2 接受 project-only 结构，当前版本、未来版本和缺失版本均拒绝；迁移阶段用不可从 JSON 伪造的内部 Symbol 将合法旧格式识别传递到 Zustand merge。新版、旧版与首次无缓存初始化的定向回归通过。
- 分类字段：`canReadProjectClassification` / `matchesAuthorizedProjectClassification` 逐行检查 `type` 与 `secondaryCategory` 授权；分类数量、分类筛选和二级分类候选使用同一谓词。隐藏分类的可查看项目保留“全部项目”通用入口，不进入未获授权的分类数量或分类筛选结果。代码与专项回归通过。

## 已独立运行的验证

- `node scripts/verify-permission-center.mjs`：通过。
- `node scripts/verify-permission-center-projects.mjs`：通过，含历史快照字段隔离、分类数量与筛选字段隔离新增用例。
- `node scripts/verify-permission-center-roadmap.mjs`：通过。
- `node scripts/verify-permission-center-corruption.mjs`：最终版本通过，含真实存储读取的当前/未来/缺失版本 project-only 拒绝、0–2 旧版迁移、错误状态写回恢复及真正无缓存初始化用例。

最终结论：本次发现的两项 P1、一项 P2 均已修复并完成定向复审，未发现已审查范围内仍需阻止交付的重要问题。本记录不替代主任务的全量构建、浏览器验收或最终提交结果。
