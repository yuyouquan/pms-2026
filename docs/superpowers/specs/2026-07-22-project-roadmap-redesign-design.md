# 项目路标重建设计

**日期：** 2026-07-22
**状态：** 已完成对话与可视化方案确认，等待书面审阅
**范围：** 全局整机项目类型迁移、项目路标表单视图、版本演进视图、待规划项目、tOS 版本与目标维护、修改记录

## 1. 背景与目标

现有项目路标里程碑/MR 视图已从入口解除挂载。本次重建的目标是围绕整机产品的首销 tOS 版本规划，统一展示正常项目与仅存在于路标中的待规划项目，并提供两种互补视图：

- 表单视图：聚焦单个 tOS 版本，以可筛选、可排序、可配置字段的表格查看项目。
- 版本演进视图：横向铺开全部 tOS 版本，纵向按照产品类型和品牌固定顺序查看演进关系。

系统继续保持前端 Mock 架构。待规划项目、tOS 枚举、版本目标和修改记录使用 Zustand 管理，并持久化到 localStorage；正常项目仍以现有项目 Store 为唯一数据源。

## 2. 已确认的业务边界

### 2.1 正常项目与待规划项目

- 正常项目来源于工作台/项目空间，在项目路标中只读。
- 待规划项目只存在于项目路标，状态固定为 `待规划`，不得进入工作台和项目空间。
- 待规划项目支持创建、编辑和删除。
- 待规划项目删除后立即从两种路标视图移除，但修改记录保留删除前快照。
- 正常项目的修改记录来自工作台或项目空间的保存动作。

### 2.2 全局整机项目类型迁移

原一级项目类型 `整机产品项目` 拆分为：

- `整机-手机`
- `整机-PAD`
- `整机-笔电`

这不是路标内部的二级分类，而是全系统一级项目类型变更。工作台创建项目、项目类型筛选、项目空间、市场维度计划、路标适配和所有整机判断都必须同步迁移。

新增公共判断函数：

```ts
export const MACHINE_PROJECT_TYPES = [
  '整机-手机',
  '整机-PAD',
  '整机-笔电',
] as const

export function isMachineProjectType(type: string | null | undefined): boolean
```

业务代码不得继续使用 `type === '整机产品项目'`。现有 Mock 项目逐条显式迁移到新类型，不在运行时依靠产品线文本猜测分类。

### 2.3 正常项目进入路标的条件

- 项目类型属于上述三类整机类型。
- 正常项目创建时 `首销 tOS 版本` 为必填字段。
- 三类整机项目都继续使用现有市场维度规则。

## 3. 数据模型

### 3.1 路标业务字段

正常项目和待规划项目通过统一适配层输出以下业务字段：

```ts
type MachineProjectType = '整机-手机' | '整机-PAD' | '整机-笔电'
type RoadmapSource = 'normal' | 'planned'
type RoadmapProductType = '新品' | '老品'
type RoadmapBrand = 'TECNO' | 'Infinix' | 'itel' | '待定' | '其他品牌'
type RoadmapRam = '2GB' | '3GB' | '4GB' | '6GB' | '8GB' | '12GB' | '16GB'
type RoadmapVersionType = 'Full' | 'Slim' | 'Go'
type RoadmapDevelopMode = '自研' | 'ODC' | 'ITD-ODC' | 'ODM' | '纯外研'

interface RoadmapProjectFields {
  machineProjectType: MachineProjectType
  projectCode: string
  displayName: string
  androidVersion: 'Android 16' | 'Android 17' | 'Android 18'
  firstSaleTosVersionId: string
  brand: RoadmapBrand
  productLine: string
  productSeries: string
  marketName: string
  productType: RoadmapProductType
  platform: string
  startRam: RoadmapRam
  versionType: RoadmapVersionType
  str5Date: string
  launchDate: string
  developMode: RoadmapDevelopMode
  remark: string
}

interface RoadmapProjectRow extends RoadmapProjectFields {
  id: string
  source: RoadmapSource
  status: string
  readOnly: boolean
}
```

日期统一使用 `YYYY-MM-DD`。正常项目适配时优先读取新字段；迁移期允许从现有字段回填，例如 `model → projectCode`、`tosVersion → firstSaleTosVersionId`、`cpu/chipPlatform → platform`、`developMode → developMode`。

### 3.2 待规划项目

```ts
interface PlannedRoadmapProject extends RoadmapProjectFields {
  id: string
  status: '待规划'
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}
```

显示名为派生值：

- 新品：`displayName = projectCode`
- 老品：`displayName = projectCode + '(' + androidVersion + ')'`

编辑项目代号、安卓版本或产品类型时立即重新计算显示名。

重复键为规范化后的：

```text
projectCode + androidVersion + productType
```

项目代号比较前去除首尾空格并转为不区分大小写。编辑时排除当前记录自身。

### 3.3 正常项目与待规划项目冲突

当正常项目创建或修改后，与任一待规划项目形成相同重复键，生成派生冲突：

```ts
interface RoadmapPlanningConflictGroup {
  key: string
  normalProjects: RoadmapProjectRow[]
  plannedProjects: RoadmapProjectRow[]
}
```

冲突规则：

- 只比较正常项目与待规划项目，不把两个正常项目之间的重复纳入本功能。
- 重复键仍为规范化后的 `projectCode + androidVersion + productType`，不包含首销 tOS 版本。
- 冲突按重复键分组，允许同一组内出现多个正常项目或多个待规划项目；提醒数量按唯一待规划项目计数，不按配对数量重复累计。
- 冲突由当前正常项目和待规划项目实时派生，不单独持久化。
- 正常项目创建不被冲突阻止，也不自动覆盖、合并或删除待规划项目。
- 冲突只高亮需要处理的待规划项目；正常项目保持只读常规样式。
- 删除冲突中的待规划项目后，冲突立即消失，同时写入待规划项目删除记录。

### 3.4 tOS 版本与版本目标

```ts
interface TosVersionConfig {
  id: string
  name: string
  major: number
  minor: number
  targets: string[]
  createdAt: string
  updatedAt: string
}
```

初始枚举：

- tOS 16.1
- tOS 16.2
- tOS 16.3
- tOS 17.0
- tOS 17.1
- tOS 17.2
- tOS 18.0

规则：

- 维护列表按 `major`、`minor` 语义版本降序排列。
- 维护列表不显示“最新”标签，也不对首行做特殊高亮。
- tOS 选择器同样按语义版本降序提供候选项。
- 版本演进视图按语义版本升序从左到右铺开。
- 新增和改名时先解析并规范化版本名称；`tOS17.2`、`tos 17.2` 与 `tOS 17.2` 视为同一版本，统一显示为 `tOS 17.2`。
- 规范化后的版本名称不能重复。
- 引用数大于零时禁止删除，并在禁用反馈中显示引用数量。
- 未被引用的版本删除前二次确认。
- 正常项目、待规划项目、筛选条件和视图状态统一引用稳定版本 ID。改名只更新版本配置的展示名称；迁移期遗留的字符串引用在加载时转换为稳定 ID，避免改名产生孤儿数据。
- 目标为字符串数组，支持新增、修改、删除和清空；没有有效目标时不渲染目标卡片。

### 3.5 修改记录

```ts
type RoadmapChangeAction = 'create' | 'update' | 'delete'

interface RoadmapFieldChange {
  field: RoadmapAuditField
  before: string
  after: string
}

interface RoadmapChangeLog {
  id: string
  projectId: string
  projectDisplayName: string
  source: RoadmapSource
  action: RoadmapChangeAction
  actor: string
  occurredAt: string
  tosVersionName: string
  changes: RoadmapFieldChange[]
  snapshot?: Partial<RoadmapProjectFields>
}
```

普通修改只记录以下字段，并按此固定顺序展示：

1. tOS 版本
2. 品牌
3. 产品线
4. 市场名
5. 项目名
6. 产品类型
7. 平台
8. 起步 RAM
9. 版本类型
10. STR5 时间
11. 上市时间
12. 开发模式
13. 备注

安卓版本和产品系列不属于普通修改记录字段。它们仍参与显示名、历史匹配、重复校验和路标展示。

创建和删除记录保存上述审计字段快照；更新记录只保留真正发生变化的字段，显示为 `旧值 → 新值`。

## 4. Store 与数据流

新增 `useRoadmapStore`，负责：

- 待规划项目 CRUD
- tOS 版本 CRUD
- 版本目标维护
- 修改记录
- 当前路标视图
- 表单视图选中版本
- 品牌和产品类型快捷筛选
- 组合筛选条件
- 字段可见性
- 表格排序
- 正常项目与待规划项目冲突选择器

正常项目不复制进 `useRoadmapStore`。选择器通过 `isMachineProjectType` 过滤 `projectStore.projects`，再适配为只读 `RoadmapProjectRow`；待规划项目适配为可编辑行；两者合并后进入统一筛选管道。

冲突选择器在完整正常项目集与完整待规划项目集上计算，不受当前 tOS 版本、品牌、产品类型或组合筛选条件影响，避免被当前视图筛选隐藏。正常项目或待规划项目发生变化后自动重算。

正常项目编辑路径迁移到共享 `updateProject` 动作。该动作在写入前后比较路标审计字段，并把差异提交给 `useRoadmapStore.recordNormalProjectChange`。不得在多个组件中各自实现差异比较。

localStorage 只持久化路标领域状态，不把待规划项目写入项目 Store。持久化数据增加版本号和迁移函数，避免后续字段调整导致旧缓存无法加载。

## 5. 页面结构

### 5.1 顶部结构

项目路标页保留现有项目视图的外层标题和“项目计划汇总看板 / 项目路标视图”切换。项目路标内部包含：

- 表单视图 / 版本演进视图切换
- 修改记录
- tOS 版本维护
- 创建待规划项目
- 品牌快捷筛选
- 产品类型快捷筛选
- 筛选
- 列设置
- 规划冲突提醒

不提供独立搜索框或搜索按钮。字段查询全部进入筛选抽屉。

### 5.2 筛选

筛选抽屉复用项目计划汇总看板的组合条件模式：

```text
字段 + 条件 + 值
```

文本字段支持包含、不包含、等于；枚举和日期字段使用相应输入控件。多条件为 AND 关系。品牌和产品类型快捷筛选与抽屉条件共同生效。

### 5.3 列设置

列设置复用项目计划汇总看板的视觉和交互模式。所有路标业务字段均可进入列设置，操作列固定显示且不参与设置。

同一字段可见性配置被两种视图共享：

- 表单视图控制表格列。
- 版本演进视图控制卡片详情字段。
- 版本列标题、卡片项目标识和行操作不受字段可见性影响。

### 5.4 规划冲突提醒

存在正常项目与待规划项目冲突时，两种路标视图的操作区下方显示持续提醒条：

```text
发现 N 个待规划项目已存在对应正常项目　[查看冲突]
```

提醒条不可永久忽略；冲突全部处理后自动消失。点击“查看冲突”打开宽抽屉，逐组展示：

- 重复键字段：项目名、安卓版本、产品类型
- 正常项目：项目名称、首销 tOS 版本、来源和“查看正常项目”操作
- 待规划项目：显示名、首销 tOS 版本、来源和“删除待规划项目”操作

正常项目与待规划项目的首销 tOS 版本可以不同，冲突抽屉仍必须按重复键成组展示。“查看正常项目”复用现有项目跳转动作进入对应项目空间。删除待规划项目需要二次确认，确认文案说明删除后路标记录消失、修改记录保留删除前快照。

## 6. 表单视图

### 6.1 版本范围

- 一次只查看一个 tOS 版本。
- 版本下拉按语义版本降序。
- 初次进入默认选择排序后的第一项。
- 切换版本后，版本目标、项目数据和数量统计同步刷新。

### 6.2 版本目标

当前版本已设置目标时，在表格上方显示高亮液态玻璃卡片，并提供编辑入口。未设置或清空目标时，目标区域不占页面空间。

### 6.3 字段顺序

完整业务字段顺序：

1. tOS 版本
2. 品牌
3. 产品线
4. 产品系列
5. 市场名
6. 项目名
7. 产品类型
8. 平台
9. 起步 RAM
10. 版本类型
11. STR5 时间
12. 上市时间
13. 开发模式
14. 备注

默认显示字段不包含“产品系列”，其余上述字段默认显示。产品系列可通过列设置开启。

### 6.4 排序

每个业务列都支持排序：

- tOS 版本：语义版本排序
- 起步 RAM：按 GB 数值排序
- STR5 时间、上市时间：按日期排序
- 其它字段：按本地化文本排序

每次只保留一个主排序字段，支持升序、降序和取消排序。排序状态使用 Ant Design 表格标准交互并提供 `aria-sort`。

### 6.5 行操作

- 正常项目：只读，不显示编辑和删除操作。
- 待规划项目：项目名附近显示轻量“待规划”标识，操作列提供编辑和删除。
- 发生规划冲突的待规划项目行使用警告底色、左侧强调线和“已存在正常项目”文字标识；不能只依靠颜色表达冲突。
- 点击冲突标识打开冲突处理抽屉，并定位到对应冲突组。
- 删除需要二次确认，成功后立即刷新当前视图和修改记录。

## 7. 版本演进视图

### 7.1 版本列

- 展示全部 tOS 版本。
- 从左到右按语义版本升序。
- 每次进入视图或版本列表发生变化后，自动滚动到最右侧。
- 不在版本列添加“最新”标签。

### 7.2 单一共享滚动容器

所有版本列位于同一个可横向、纵向滚动的容器中，不允许各列拥有独立纵向滚动条。

外层使用 CSS Grid：

- 第一行：各版本标题与目标吸顶单元格
- 第二行：各版本新品区域
- 第三行：新品/老品分割线
- 第四行：各版本老品区域

新品区域处于同一个 Grid 行，行高由当前筛选结果中内容最高的版本决定，因此所有版本的老品起始线天然横向对齐。

### 7.3 吸顶

- 页面操作栏固定在项目视图顶部之下。
- 向下滚动时，版本名与版本目标继续吸顶。
- 未设置目标的版本不显示目标卡片；网格仍保持项目区域对齐。

### 7.4 分组排序

每个版本列固定为：

1. 新品
2. 老品

每个产品类型内部固定为：

1. TECNO
2. Infinix
3. itel

某品牌无数据时直接跳过，不生成空品牌卡片。待定和其他品牌数据保留在筛选/表单视图中；版本演进的品牌快捷筛选和固定品牌分组只覆盖需求指定的三个品牌。

### 7.5 冲突卡片

发生规划冲突的待规划项目卡片使用与表单行一致的警告样式和“已存在正常项目”文字标识。点击标识打开冲突处理抽屉并定位到对应组。正常项目卡片不高亮，避免将只读正常数据误表达为错误对象。

## 8. 创建与编辑待规划项目

创建和编辑复用同一个宽 Modal，延续工作台新增项目的 Modal 交互语言，并按以下顺序分组。

### 8.1 项目分类

- 整机-手机
- 整机-PAD
- 整机-笔电

### 8.2 基础识别字段

- 项目名：文本输入
- 安卓版本：Android 16、Android 17、Android 18
- 产品类型：新品、老品
- 首销 tOS 版本：来自维护枚举

输入项目名后，立即在下方列出历史同名项目：

- 项目名称
- 项目名
- 安卓版本
- 产品类型

同名历史项目只作为信息提示；重复键完全一致时显示就地错误并禁用提交。

### 8.3 产品与版本字段

- 品牌：TECNO、Infinix、itel、待定、其他品牌
- 产品线：随品牌联动
- 产品系列：文本输入
- 市场名：文本输入
- 平台：文本输入
- 起步 RAM：2GB、3GB、4GB、6GB、8GB、12GB、16GB
- 版本类型：Full、Slim、Go
- 开发模式：自研、ODC、ITD-ODC、ODM、纯外研

品牌与产品线映射：

| 品牌 | 产品线候选 |
| --- | --- |
| TECNO | PHANTOM、CAMON、POVA、SPARK、POP |
| Infinix | ZERO、NOTE、GT、HOT、SMART |
| itel | SUPER、POWER、CITY、A |
| 待定 | 待定 |
| 其他品牌 | 其他系列 |

切换品牌时，如果当前产品线不属于新品牌候选，自动清空产品线并要求重新选择。

### 8.4 时间与备注

- STR5 时间：日期选择器，精确到日
- 上市时间：日期选择器，精确到日
- 备注：多行文本

除备注外，以上创建字段均为必填。未增加 STR5 与上市时间的先后关系校验，避免引入需求未定义的规则。

### 8.5 删除

删除入口只出现在待规划项目的编辑态或行操作中。确认文案明确说明：项目将从路标移除，但修改记录会保留删除前快照。

## 9. tOS 版本维护与目标维护

tOS 版本维护使用独立 Modal，字段包括：

- tOS 版本
- 版本目标摘要
- 引用数量
- 编辑
- 目标
- 删除

引用数量统计正常项目和待规划项目。目标编辑器支持多条目标逐项维护；保存空目标列表等同于清空目标。

## 10. 修改记录

修改记录使用宽抽屉，从项目路标打开，不离开当前视图。支持：

- 项目标识查询
- 来源筛选：全部、正常项目、待规划项目
- 动作筛选：全部、创建、修改、删除
- 日期范围
- 时间倒序分页

记录标题显示操作者、动作、tOS 版本和项目标识；来源使用文字标签区分。更新记录只展示变化字段；创建和删除展示字段快照。

## 11. 权限

- `roadmap:view`：进入项目路标、查看两种视图、筛选、排序、列设置、查看修改记录、查看冲突抽屉和跳转正常项目。
- `roadmap:edit`：创建、编辑、删除待规划项目，从冲突抽屉删除待规划项目，维护 tOS 版本和版本目标。
- 正常项目即使用户拥有 `roadmap:edit`，在路标中仍保持只读。
- 全局管理组继续沿用现有权限绕过逻辑。

所有编辑按钮必须通过 `useHasPermission(currentLoginUser)` 控制，不得只在提交函数中做隐藏式判断。

## 12. 组件与文件边界

建议新增：

```text
src/components/roadmap/
  ProjectRoadmapModule.tsx
  RoadmapToolbar.tsx
  RoadmapTableView.tsx
  RoadmapEvolutionView.tsx
  PlannedProjectModal.tsx
  RoadmapFilterDrawer.tsx
  RoadmapColumnSettingsDrawer.tsx
  RoadmapConflictAlert.tsx
  RoadmapConflictDrawer.tsx
  RoadmapChangeLogDrawer.tsx
  TosVersionMaintenanceModal.tsx
  TosTargetEditor.tsx
  RoadmapProjectCard.tsx

src/stores/
  roadmap.ts

src/types/
  roadmap.ts

src/lib/
  roadmapProjectAdapter.ts
  roadmapValidation.ts
  roadmapSorting.ts
  roadmapAudit.ts
```

现有 `RoadmapView.tsx` 只负责在“项目计划汇总看板”和新 `ProjectRoadmapModule` 之间切换。旧 `MilestoneView.tsx`、`MRTrainView.tsx` 和相关工具文件暂不删除，避免在设计尚未完全替代旧能力前做不可逆清理。

## 13. 视觉与动效

- 延续现有紫色液态玻璃风格，不引入新的主色体系。
- 玻璃效果用于标题、目标、吸顶层和浮层，不用于大面积正文表格背景。
- 正文、表格和卡片保持高对比度，正常文本至少满足 WCAG AA。
- 交互动效使用 `transform` 和 `opacity`，时长 150–300ms。
- 不使用高度动画驱动新品/老品对齐，避免滚动抖动和布局重排。
- Modal、抽屉、视图切换和行状态变化支持 `prefers-reduced-motion`。
- 所有图标按钮提供文本或 `aria-label`，键盘焦点状态可见。

## 14. 性能

- 正常项目适配、统一过滤、分组和排序使用 memoized selector。
- 筛选输入使用轻量防抖，不在滚动时重复计算项目分组。
- 版本演进卡片以稳定项目 ID 作为 Key。
- 自动滚动仅在进入版本演进或版本列表变化时触发，不在筛选变化时强制重置用户水平位置。
- 数据量达到明显卡顿阈值后再引入虚拟化；首版不提前增加复杂的二维虚拟列表。

## 15. 错误与反馈

- 表单错误显示在对应字段下方，提交失败后聚焦第一个错误字段。
- 重复项目错误展示原因和恢复方式，不只提示“创建失败”。
- 正常项目与待规划项目形成冲突时使用持续提醒条和文字标识，不使用一次性 Toast 代替可处理入口。
- 删除和 tOS 引用保护使用明确确认/禁用反馈。
- 保存按钮提交期间禁用并显示加载状态，成功后关闭浮层、刷新当前视图并给出成功提示。
- localStorage 数据解析失败时回退到初始 Mock，并保留错误日志，不阻断项目视图加载。

## 16. 验证方案

仓库没有测试框架，验证由聚焦 Node 脚本、类型检查、生产构建和真实浏览器冒烟组成。

### 16.1 聚焦验证脚本

- 原 `整机产品项目` 业务判断已迁移为公共 helper。
- 工作台创建三类整机项目时首销 tOS 版本必填。
- 待规划项目不会进入工作台选择器。
- 显示名和重复键规则正确。
- 正常项目与待规划项目冲突选择器不受视图筛选影响，并且只返回跨来源冲突。
- 品牌与产品线联动正确。
- tOS 语义版本排序、引用保护和改名级联正确。
- 审计字段白名单和固定顺序正确。
- 表格默认字段、完整字段和排序函数正确。

### 16.2 浏览器冒烟

1. 工作台创建三类整机项目并进入对应项目空间。
2. 新增待规划项目，验证工作台不显示。
3. 输入同名项目，验证历史列表；制造完全重复，验证禁用提交。
4. 切换品牌，验证产品线候选和旧值清空。
5. 编辑待规划项目，验证显示名、重复校验和视图刷新。
6. 删除待规划项目，验证视图移除和删除记录快照。
7. 验证正常项目在路标中只读。
8. 在项目空间修改正常项目审计字段，验证路标数据和修改记录更新。
9. 创建与待规划项目重复的正常项目，验证顶部提醒、两种视图中的待规划项目高亮和冲突抽屉成对展示。
10. 在不同首销 tOS 版本下制造相同重复键，验证冲突仍可发现且不受当前视图筛选影响。
11. 从冲突抽屉查看正常项目并删除待规划项目，验证冲突消失和删除记录快照。
12. 维护 tOS 版本，验证降序、重名校验、引用保护和改名级联。
13. 新增、修改、清空版本目标，验证两种视图显示。
14. 表单视图切换单个版本，验证全部业务列排序、筛选和列设置。
15. 版本演进视图验证左旧右新、进入定位最右侧、共享纵向滚动、版本/目标吸顶、新品/老品对齐和品牌顺序。
16. 验证修改记录的来源、动作、日期筛选、字段顺序和分页。
17. 验证 `roadmap:view`、`roadmap:edit` 和管理组权限。
18. 在减少动态效果设置下重复核心视图切换。

### 16.3 完整命令

```bash
node scripts/verify-project-roadmap.mjs
npx tsc --noEmit
npm run build
```

如果本地 `node_modules/.bin` 仍因权限问题无法执行，使用相同依赖的 Node 入口完成等价检查，并在交付说明中记录原因。

## 17. 非目标

- 本次不接入真实数据库或后端 API。
- 本次不让待规划项目进入工作台或项目空间。
- 本次不允许在路标编辑正常项目。
- 本次不自动合并、覆盖或删除与正常项目重复的待规划项目，必须由用户确认删除。
- 本次不恢复旧里程碑视图、MR 版本火车、基线快照、分享或 Excel 导出能力。
- 本次不增加 STR5 时间必须早于上市时间等未确认业务规则。
- 本次不修改 tOS 目标或枚举的独立审计范围；修改记录只聚焦项目记录。

## 18. 实施拆分建议

为降低全局类型迁移和新路标同时落地的风险，实施计划按以下顺序展开：

1. 全局整机项目类型迁移与兼容 helper。
2. 路标类型、Store、适配器、排序、校验和审计基础。
3. 待规划项目创建/编辑/删除、规划冲突处理与 tOS 维护。
4. 表单视图及筛选、列设置、排序。
5. 版本演进视图及滚动、对齐、吸顶。
6. 修改记录与正常项目审计接入。
7. 权限、动效、持久化迁移和完整验证。
