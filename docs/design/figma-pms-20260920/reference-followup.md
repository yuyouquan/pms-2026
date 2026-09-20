# 项目卡片、横版计划与名称遮挡补充调整

2026-09-20，继续在 `codex/feature-pms-figma-ui`（起点 `ab9e957`）实施用户补充的三张截图。

## 视觉与行为边界

- 项目管理卡片：白色20px圆角，12px内边距与卡片间距，16px项目标题，右上角实色圆角状态标签；分类使用紫色描边标签。市场名、品牌、产品线、开发模式、日期、人员、更新时间保留，底部人员区域去掉分隔线。1440px及更宽视口保持五列，1280px保持四列。卡片最小高度200px，长业务内容可自然增高。长名称保留开头、末尾省略，完整名称可悬停查看。
- 仅项目视图的卡片模式取消外层整块白色面板，卡片直接排列在页面渐变背景上；视图导航与筛选组成独立白色区域。项目配置、列表和日历继续沿用原有容器。
- 分类标签按参考显示一级分类，完整一级/二级分类仍保留在标签提示中，筛选、计数和分类数据不变。状态颜色按参考的蓝/青/绿/紫/洋红/灰/橙语义映射，色值使用可读深色以保证白色文字清晰；仅作用于卡片。
- 项目空间横版计划：阶段行 `#D4D1FF`、里程碑行 `#ECEAFF`，两层表头各32px；阶段名称与真实预估天数同行居中，取消独立天数标签和彩色下划线。整机、tOS、技术TDT及技术基本信息共用表头样式；技术子项目继续单层活动表头。动态业务阶段仍不显示固定预估天数，不将截图的30天写入业务数据。
- 项目组合管理名称遮挡：Ant按钮原本将长文本居中，文字开头越过容器后被裁剪；锁图标的负偏移同样被裁剪。修复为左对齐、尾部省略、图标占用独立位置，完整名称通过title查看。固定列宽、sticky偏移、锁定状态及编辑权限不变。

## 验证

构建和TypeScript检查；项目表面、项目列表、一级计划治理及技术计划操作既有验证。一级计划脚本只同步表头提取位置和居中CSS钩子，日期、权限、版本、实际行及动态阶段断言保留。

浏览器使用现有 `verify-figma-ui-browser.mjs` 的项目管理、三类项目空间、无效日期、分享/旧模板、非管理员套件。新增名称可见性回归 `verify-joint-mr-name-visibility-browser.mjs` 检查1440/1920视口、开头/中间/末尾横向滚动、锁定/未锁定，共12组，验证首字符实际命中、锁图标完整边界和固定列无重叠。

## 验收结果

- `npx tsc --noEmit`、`npm run build`、`git diff --check` 通过。
- `verify:project-surfaces-visual-refresh`、`verify:project-list-refinement`、`verify:project-management-navigation`、`verify:level1-plan-governance`、`verify:technical-plan-operations` 通过。
- 首轮7个浏览器套件共40个观察点通过。最终调整外层卡片背景及表头行高后，重新执行项目管理及整机/tOS/技术项目空间4个受影响套件，32个观察点通过，失败与运行时错误均为0。覆盖列表/卡片/日历/配置切换、配置筛选分页、新建与编辑表单、表单错误间距、横版/竖版/甘特图、权限页。
- 最终布局实测：1280/1440/1920宽度分别4/5/5列，页面横向溢出0；卡片背景白色、圆角20px、横向间隔12px、外层背景透明；两层计划表头各32px，跨行单元格64px。卡片键盘Enter可正常进入项目。
- 项目组合名称回归12组全部通过，包括6组锁图标检查；固定列无重叠，首字符实际可命中，完整名称title一致，滚动前后锁状态及编辑控件保持一致，运行时及网络错误0。
- 独立只读代码及截图审查通过，发现的卡片外层白底与表头35px问题均已修复并重新实测。

本地验收服务为 `http://localhost:3024/`。截图及原始结果保存在工作树的以下目录（构建产物和截图不纳入Git）：

- `output/playwright/figma-ui/reference-followup/final/results.json`：最终4套件记录。
- `output/playwright/figma-ui/reference-followup/project-cards-{1280,1440,1920}.png`：卡片各宽度截图。
- `output/playwright/figma-ui/reference-followup/phase-header-final.png` 与 `layout-observations.json`：表头与布局实测。
- `output/playwright/figma-ui/reference-followup/joint-name/observations.json` 与 `locked-*.png`：名称及锁图标检查。
- `output/playwright/figma-ui/build-reference-followup.log`：最终生产构建记录。
