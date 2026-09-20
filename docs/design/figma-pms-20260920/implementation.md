# Figma PMS 视觉系统实施映射

日期：2026-09-20。原始设计资料 `UI规范.md` / `design-tokens.json` 保持原文；本文件记录现有实现映射、工程决策和验收。

## 所有权与覆盖范围

保留 Next.js、Ant Design 6、Zustand 与原业务组件。`src/theme/pmsTheme.ts` 管理 Ant 组件 token；`src/styles/globals.css` 的根变量及现有公共覆盖规则管理兼容样式；`html[data-ui="figma-pms"]` 覆盖独立路由及门户弹层。未增加另一套组件库或平行主题。

`globals.css` 已有约9430行、多次密度修订；本次直接修改根 token、公共控件和最后生效的密度层，保留业务色/固定列等高优先级规则。`pms-glass-surface` 等旧类名保留为兼容钩子，但解析为白色、不透明内容。

| 原有所有者/值 | 当前映射 | 来源与决策 |
| --- | --- | --- |
| `brandStrong #5D49F6` / `brandMain #7562FF` | 两者 `#4D41FF` | 实测主色；主按钮改实心 |
| `brandSurface #F5F3FF` | `#F0EFFF` | 实测次按钮；表头用它是工程映射 |
| 页面 `#F4F6FB` / 多段灰紫渐变 | `linear-gradient(90deg,#F1EEFF,#ECF6FF)` | 端点实测，角度工程建议 |
| 透明卡片76% + blur14px | 白色、不透明、无模糊 | 实测白容器；兼容别名保留 |
| 容器16/24px内边距 | 主容器12px；弹层主体24px | 分开内容和弹层变量，避免互相污染 |
| 卡片浮起/发光 | 数据卡无位移；主外卡20px阴影与2px内强调 | 不把强调线应用到每张业务卡 |
| Header56px + 1px边框 | 总高50px、无额外底边 | 行高/项目空间高度/粘性工具栏同步 |
| 顶栏渐变 | 沿用原渐变 | Figma端点未核实；不冒充实测 |
| 正文14/22；表格12/22 | 正文与表格14/20 | 新基线覆盖9月9日表格12px要求 |
| 表内所有后代强制字号 | 标签及其后代排除，保留12/16 | 图标/头像/必填符号例外保留 |
| 标签实体边框与渐变 | 高24px、4×8px、1px内描边 | 4px圆角及非蓝文字深色为工程建议 |
| 数据行最小40px + 8px padding | 普通单行最终40px | 20+19+1；标签24+15+1；控件32+7+1 |
| 合并系列按钮 min40px | min39px + 单元格底边1px | 防止单行41px；合并单元格自然扩展 |
| 资源月度表12px、32px行、26px控件 | 共用14px/40px/32px | 不改变月份、阶段、计划时间轴数据 |
| 弹层footer不统一 | 最小64px、左右24px、gap16px | 不统一弹窗宽度；低高度内部滚动 |
| 普通弹窗默认top100px、按钮附加margin8px | 普通弹窗top24px/最大高度viewport−48px、相邻按钮margin0 | 工程建议；居中弹窗保持top0；以实际按钮边界验证16px间距 |
| Form.Item默认/局部20/16/8px | row12px、column16px、label4px、group8px | 用户补充“表单之间行间距统一，要紧凑” |

## 表单紧凑规则

Ant Form 的 `itemMarginBottom:12` 与 `verticalLabelPadding:'0 0 4px'` 使用已安装6.3.1 API。共享 CSS 同时修正旧项目详情、资源版本和行布局的局部覆盖；Form.Item 负责纵向间隔，包裹字段的 Row 不额外增加纵向 gutter，嵌套 Form.Item 不重复增加 margin。帮助、必填、错误内容仍在正常文档流中。Ant 的 `.ant-form-item-margin-offset` 会用 -12px 抵消错误行尾间隔；仅对非inline表单的可见帮助状态取消此负偏移，确保错误正文结束到下一字段仍有12px，未用固定高度压缩。

主项目表单保持原有四列/六列及业务分组；HR版本保持各类别列数，独立字段列间统一16px，连续里程碑日期作为相关控件分组保持8px。原生月度编辑字段的横向间距也映射同一变量。路标表单保留预估勾选与现有16px横向Row。转维团队角色行使用12px间距；普通弹窗主体默认左右24px内边距，保留专用布局的显式覆盖。

## 未改变的合同

中文名称、字段顺序、枚举、角色、RBAC、编辑离开确认、自动保存、状态机、版本发布、资源月度比例、固定列、合并行、隐藏测量行、排序/拖拽及甘特时间几何不变。危险/警告/无效/修订中/锁定/取消/选中等表现仍由原业务规则控制。没有改数据store、mock、网络API。

`verify-liquid-glass-theme.mjs` 保留原文件入口以兼容已有命令，更新的只是被新规范明确替代的 token、实心表面/无位移、字号/卡片与字体断言；源码消费者检查、可访问性、自测负例及业务断言保留。`verify-compact-ui-density.mjs` 的12px正文断言改为14px。

## 验证

实施阶段执行：`npx tsc --noEmit`；`npm run verify:liquid-glass`；`npm run verify:liquid-glass:self-test`；`npm run verify:compact-ui-density`；`npm run verify:project-surfaces-visual-refresh`。均通过。

应用源代码 `e951409` 的生产构建通过，包含lint和类型检查。真实Chromium / localhost:3024 的完整浏览器流程测量Header50px、标签24px/12px、footer64px、实际按钮间距16px、表单行12px、label padding4px、错误文案到下一字段12px、低高度弹窗内部滚动，以及1280/1440/1920视口。独立审查发现并修正了Ant默认弹窗偏移及按钮附加margin；每个表单都断言页脚和按钮完全留在视口中。完整覆盖、最终观察数量、复现命令和既有审计脚本问题见 `docs/reviews/2026-09-20-figma-ui.md`。
