# tOS 路标与项目视图增强验收

验收日期：2026-09-28。分支：`codex/feature-tos-roadmap-20260924`。

基线：`origin/dev` / `49edf9aeaf31bf1a6f5c8ece022f485ed94ebafb`；发布前再次查询远端 dev，仍为同一提交。修改在独立工作树内完成，原目录中的未提交工作保留。本文记录本地验收；远端合并和正式部署以发布回执为准。

## 需求与结果

| 需求 | 实现及验收结果 |
| --- | --- |
| 项目视图表头排序 | 支持升序、降序、取消排序；文本、数量、RAM、版本、日期按类型比较；分页前排序，保留品牌/产品线/产品系列合并组和 TDT 父子关系；隐藏排序列或切换类型后清理排序状态。 |
| 路标表头拖动、字段配置排序、列宽 | 复用项目视图交互；两处顺序同步并保存；列宽刷新后保留；固定 tOS 列保持固定；鼠标拖动、调整宽度和键盘拖放均不误触排序。 |
| 排除取消/暂停项目 | 路标统一数据入口排除“已取消”“已暂停”，覆盖表格和版本演进；不影响编辑校验和历史审计。 |
| 四项必填 | 编辑器仅项目二级分类、安卓版本、产品类型、tOS 版本必填；其余可留空、可清空保存；缺少必填项不进入路标。没有品牌的项目归入“未填写品牌”，没有日期仍可进入版本演进。 |
| 空版本整列隐藏 | 按最终筛选结果移除无项目版本的标题、目标区和项目区；清空筛选后可恢复。 |
| 市场名隐藏品牌前缀 | 项目表格/卡片、路标表格/卡片/详情统一显示 `CAMON 40`；原始 `TECNO CAMON 40` 保存值不变。 |

## 验证证据

- `npx tsc --noEmit`：通过。
- `npm run build`：通过；包含 lint、类型检查和静态页面生成。仅保留现有 Browserslist 数据陈旧提示。
- 全量 Node 回归执行 165 个脚本，首次 162 个通过。3 个旧断言仍要求可选字段非空、依赖旧日期门槛或旧市场名输出，按批准的新规则更新后复跑通过。
- 再次复跑路标登记、编辑、信息补全、演示数据及上述 3 个脚本，均通过。新增项目卡片市场名脚本也通过；共 166 个独立脚本的最近执行结果为通过。
- `npm run verify:tos-roadmap-enhancements`：通过，覆盖排序/分组/显示值、路标拖动控件与宽度持久化、四字段可见性与空列移除。
- 最后一次卡片空标签调整后重新执行 `verify-project-roadmap`（142 项断言）、表格交互验证、类型检查、生产构建和浏览器验收，均通过。
- `PMS_BUILD_MODE=production npm run verify:tos-roadmap-enhancements-browser`：在 `http://127.0.0.1:3034` 的生产构建下通过 6 组场景，页面异常和 console error 均为 0。鼠标实际清除已有品牌、芯片、市场名及两项日期后，读取保存数据确认为空。
- `git diff --check`：通过。独立代码复核未留下待处理问题。

浏览器验收使用独立临时浏览器配置及受控测试数据，不改动用户浏览器数据。单独 Node SSR 验证会提示未经 Next.js 转换的 styled-jsx 属性；生产构建和实际浏览器无对应错误。

## 产物与复验

- [浏览器验收结果](../../output/playwright/tos-roadmap-enhancements/results.json)
- [生产构建日志](../../output/playwright/tos-roadmap-enhancements/build.log)
- [Node 回归首次结果](../../output/playwright/tos-roadmap-enhancements/regression/initial-summary.json)
- [复跑结果](../../output/playwright/tos-roadmap-enhancements/regression/rerun-summary.json)
- [每个脚本最近一次结果](../../output/playwright/tos-roadmap-enhancements/regression/final-summary.json)
- [版本演进截图](../../output/playwright/tos-roadmap-enhancements/evolution.png)
- [项目视图截图](../../output/playwright/tos-roadmap-enhancements/project-view.png)
- [四字段编辑器截图](../../output/playwright/tos-roadmap-enhancements/roadmap-editor.png)

启动本地生产预览后，可执行 `npm run verify:tos-roadmap-enhancements-browser`；指定其他端口或正式域名时使用 `PMS_BASE_URL`，单独执行脚本时可用 `PMS_BROWSER_OUTPUT` 指定独立证据目录。项目仍使用原有模拟数据与浏览器本地存储，本次未涉及后端接入。

## 追加修复：拖动列宽导致行高增加

用户反馈表格拖动后行高变大。使用真实演示数据复现：品牌列由 100px 缩为 80px 时，`normal:14` 等行从 40px 增至 60px，拖动中和松手后都会出现。根因是仅备注、产品系列启用了省略显示，其他列允许文字换行。

修复：为路标全部业务列启用单行省略显示，沿用表格完整文本提示；预估日期的自定义渲染补充完整日期提示。未硬编码行高，也未改动列宽、顺序和数据保存逻辑。

新增真实浏览器回归 `screenshots/verify-roadmap-row-height-browser.mjs`，已并入 `verify:tos-roadmap-enhancements-browser`。该脚本先在修复前捕获 40px → 60px 的失败，修复后验证品牌、市场名、项目名、芯片编码、两项日期及备注共 7 列缩窄时行高不变；同时验证拖动换序、刷新恢复和 736px 窄视口。实测各数据行均保持 40px，页面及控制台错误为 0。

本轮重新通过类型检查、生产构建、路标 142 项断言、专项 Node 回归及原有六组浏览器验收。

- [行高测量结果](../../output/playwright/roadmap-row-height/results.json)
- [缩窄及换序后截图](../../output/playwright/roadmap-row-height/after.png)
- [本轮生产构建日志](../../output/playwright/roadmap-row-height/build.log)

## 发布前复核

2026-09-28 再次执行完整 166 项 Node 回归：165 项首次通过，1 项 `verify-fan-trial` 仍将路标的粉丝试用国家列为必补字段。按四项必填规则修正该断言，保留正式/预算项目及存储层的粉丝试用校验；该脚本与信息补全脚本均复跑通过。最终 166 项的最近结果均通过，产品代码没有因本轮回归新增修改。

类型检查、生产构建、六组功能浏览器验收和行高专项再次通过；所有行高保持 40px，浏览器页面及控制台错误为 0。

- [发布前回归结果及复跑说明](../../output/playwright/tos-roadmap-enhancements/regression/release-summary.json)
