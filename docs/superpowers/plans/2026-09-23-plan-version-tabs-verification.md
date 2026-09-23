# 计划版本 TAB 与 MR 视图验证

## 变更范围

- 同一 tOS 项目及版本的 1+N 转测类型，按完整聚合数据检查连续性。tOS 基准行计为 1，N/A 不参与；第一个缺失类型之后的整机行整行标红，含固定列，并提供缺失类型提示。筛选不参与校验计算。
- 整机与 tOS 的 MR 计划未保存视图偏好时默认横版，保留主动切换后的偏好。
- 整机、tOS、技术项目（含子项目）及共享计划工具栏使用版本 TAB。创建修订为最新已发布 TAB 前的图标；仅当前修订 TAB 内显示自动保存、发布和取消修订。保留修订类型菜单、权限和编辑离开保护。
- 一起发布前一提交的空白 MR mock 恢复迁移：只修复旧内置空记录，不覆盖人工输入、N/A、自建记录和删除状态。

## 自动校验

`npx tsc --noEmit`、`npm run build` 通过。

领域及界面契约脚本：

- verify-mr-transfer-type-sequence
- verify-plan-workspace-shell
- verify-technical-plan
- verify-level1-plan-governance
- verify-mr-version-plan
- verify-mr-mock-recovery
- verify-tos-mr-level1-sync
- verify-mr-downstream-source-sync
- verify-machine-mr-level1-projection
- verify-level1-shared-business
- verify-plan-snapshot-persistence
- verify-level1-flat-milestone-gantt
- verify-mr-mock-and-info-grid

旧技术项目断言已按现有共享阶段样式及存储版本 18 更新；版本控件断言改为检查共享 TAB 的可访问名称。

## 浏览器验证（独立测试端口 3043，生产构建）

- 联合计划：将 16.3.0.155 唯一的类型 2 改成 1，类型 3 和 4 两行整行呈红色，固定列与普通列背景均为 rgb(255, 241, 240)。按项目名称筛选后提示保留；恢复类型 2 后红行数回到 0。
- 整机 DEMO001：MR 初次进入为横版，MR 号及 mock 日期完整。一级计划 V3/V4 切换时，修订操作仅显示于 V4；取消 V4、创建正式 V5、发布 V5 均成功，创建图标随后位于 V5 已发布 TAB 前；切换 TR 市场仍显示独立的 V4 修订。
- tOS16.3：Full 与 Slim 类型切换正常，跟随类型发布按钮不可用；MR 初次进入横版，主动改为竖版后往返一级计划仍保留竖版。
- 技术 DEMO-TECH-V2：TDT 与子项目 TAB 正常；左右方向键可移动版本焦点，Enter 切换；子项目创建 V1.1 非正式修订、确认取消成功。
- 演示用户08无当前技术项目角色，切换后项目内容保持无权访问；恢复管理组后操作恢复。
- 上述浏览器流程 error 日志为空。
