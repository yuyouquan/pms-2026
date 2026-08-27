# 配置中心扁平枚举与映射配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“配置中心 → 枚举值配置”改为 22 个固定配置项的扁平维护入口，并让单字段、芯片三列映射、项目分类三列映射、TMG 两列映射成为项目新建、编辑与 tOS 路标的统一前端选项源，同时保留历史项目字符串快照。

**Architecture:** 由唯一的枚举注册表声明 22 类配置的顺序、范围、结构、列和初始数据；Zustand store 持久化带稳定 ID 的联合行结构，并从旧版两个 tOS 字符串数组迁移。配置页按注册表生成扁平导航、动态表格和动态表单；业务组件只通过查询适配器和 hooks 读取当前有效行，并把旧项目中已删除的字符串作为“已停用”快照附加展示。项目分类、芯片和 TMG 都按整行映射解析，不在业务组件保留第二份映射。

**Tech Stack:** Next.js 14 App Router、React 18、TypeScript、Ant Design 6、Zustand persist、现有 Node `.mjs` 验证脚本、Puppeteer 浏览器验证。

---

## 实施约束

- 以已批准的设计规格 `docs/superpowers/specs/2026-08-27-flat-enum-mapping-config-design.md` 为行为依据；中文名称、顺序和列名不得简写或重命名。
- 只提交本计划列出的文件。仓库当前已有用户改动，禁止清理、暂存、重置或覆盖无关改动。
- 本仓库没有测试框架。每项行为先写进现有 `scripts/*.mjs` 或 `screenshots/*.mjs` 验证脚本，先看到针对本任务的失败，再写实现。
- 每个任务完成后只暂存该任务列出的文件，并先用 `git diff --cached --check` 自检。
- 配置行 ID 只用于 CRUD；项目数据继续保存字符串快照，不保存配置行 ID。
- 只有 `整机产品项目` 保存和显示 `PMS二级项目分类`；`tOS版本项目`、`技术项目`、`能力建设项目` 的二级分类必须为空且表单不显示。
- `首销tOS版本`、`tOS版本-路标` 保存版本主体，输入允许任意非空字符串；显示端直接加一个 `tOS` 前缀。

## 文件职责图

### 新增

- `src/lib/enumConsumers.ts`：面向业务表单的单字段、历史值、芯片、项目分类、TMG 查询函数。
- `src/hooks/useEnumOptions.ts`：从 store 派生当前配置选项和历史已停用选项的 React hooks。
- `scripts/verify-enum-consumers.mjs`：纯函数级业务适配、历史快照和映射验证。

### 核心改造

- `src/types/enums.ts`：22 类 key、定义元数据、四类数据行和动作参数。
- `src/lib/enumValues.ts`：唯一注册表、初始数据、归一化、逐行校验、显示格式化。
- `src/stores/enums.ts`：`rowsByType`、按 ID CRUD、持久化 v2、v1 tOS 迁移与回滚。
- `src/components/config/EnumConfig.tsx`：扁平配置列表、动态表、动态弹窗、权限态。
- `src/styles/globals.css`：扁平双栏与窄屏样式。

### 权限

- `src/constants/permissions.ts`：新增 `configCenter:enumEdit`。
- `src/stores/permission.ts`：管理组默认授权，编辑组/查看组默认不授权。
- `scripts/verify-global-permission-matrix.mjs`：权限矩阵回归。

### 业务消费者

- `src/components/project-info/ProjectInfoModal.tsx`：动态项目分类、条件二级分类、通用选项覆盖、芯片原子更新。
- `src/components/project-info/ProjectInfoFieldInput.tsx`：历史已停用项、只读芯片型号/平台。
- `src/components/project-info/TargetProjectInformationView.tsx`：动态健康状态的兼容色彩与未知值降级。
- `src/constants/projectInfoSchema.ts`：移除属于 22 项的本地选项数组，保留字段定义。
- `src/components/workspace/AddProjectModal.tsx`：新建项目读取统一选项源。
- `src/constants/projectTypes.ts`：删除运行时硬编码 IPM 映射与非整机二级分类推导。
- `src/components/technical-project/TechnicalProjectCreateFields.tsx`：动态 TMG/子领域级联。
- `src/components/technical-project/SubprojectConfigModal.tsx`：技术开发模式、核心价值、首销 tOS 读取配置。
- `src/components/technical-project/TechnicalProjectBasicInfo.tsx`：技术项目编辑读取当前配置并兼容历史值。
- `src/constants/technicalProject.ts`：移除运行时 TMG 硬编码源。
- `src/types/technicalProject.ts`、`src/stores/technicalProject.ts`：把可配置字段从封闭联合改为字符串快照，并保留必填校验。
- `src/components/roadmap/TosVersionMaintenanceModal.tsx`、`src/components/roadmap/PlannedProjectModal.tsx`、`src/components/roadmap/ProjectRoadmapModule.tsx`：路标与规划项目读取配置。
- `src/lib/roadmapFilters.ts`、`src/lib/roadmapValidation.ts`：校验当前配置值但允许已保存历史快照。
- `src/lib/roadmapProjectAdapter.ts`、`src/types/roadmap.ts`：路标可配置字符串快照兼容，不再以闭合集合丢值。
- `src/components/roadmap/RoadmapProjectCard.tsx`、`src/components/roadmap/RoadmapProjectDetailsModal.tsx`：未知动态版本类型使用中性视觉。
- `src/components/project-info/MarketEditorModal.tsx`：编译选项/编译市场读取配置。
- `src/lib/spugBuildOptions.ts`：仅保留必要的数据转换/校验，不再作为实时选项源。
- `src/lib/projectStatus.ts`、`src/containers/ProjectListContainer.tsx`、`src/containers/ProjectSpaceContainer.tsx`：按项目分类读取三套状态配置和其他可编辑字段配置。
- `src/types/app.ts`：健康状态允许字符串快照，并为旧代码值与中文值提供显示兼容。
- `src/hooks/useTosEnumOptions.ts`、`src/lib/tosEnumOptions.ts`：迁移调用方后删除，避免双实现。

### 验证

- `scripts/verify-enum-config.mjs`：注册表、结构、CRUD、迁移、页面源码契约。
- `scripts/verify-enum-consumers.mjs`：业务查询与历史快照。
- `scripts/verify-project-info-matrix-refresh.mjs`：分类、芯片、二级分类条件逻辑。
- `scripts/verify-technical-project.mjs`：TMG/子领域和技术字段。
- `scripts/verify-project-roadmap.mjs`：路标配置接入。
- `screenshots/verify-enum-config-browser.mjs`：配置页 CRUD、权限、恢复、响应式。
- `screenshots/verify-task5-enum-consumers-browser.mjs`：四类项目、芯片、TMG、历史值的端到端验证。
- `package.json`：新增 `verify:enum-consumers`，保留现有验证命令。

## Task 1：建立 22 类注册表与联合行模型

**Files:**

- Modify: `src/types/enums.ts`
- Modify: `src/lib/enumValues.ts`
- Modify: `scripts/verify-enum-config.mjs`

- [ ] **Step 1：先把注册表契约写进验证脚本**

  在 `scripts/verify-enum-config.mjs` 增加断言：

  - key 顺序严格为下方 22 项；
  - label、scopeLabel、kind 与规格第 5 节逐项一致；
  - kind 计数为 `single: 19`、`tmg-map: 1`、`chip-map: 1`、`project-category-map: 1`；
  - 每种 kind 的列名严格一致；
  - `formatEnumCellValue` 只对两个 tOS 类型加前缀；
  - 输入 `tOS18.0` 归一化为 `18.0`，输入 `alpha` 仍有效，空白无效。

- [ ] **Step 2：运行脚本并确认因新 API 不存在而失败**

  Run: `npm run verify:enum-config`

  Expected: FAIL，错误明确指向 `ENUM_TYPE_KEYS`、`ENUM_DEFINITIONS` 或新行类型/API 尚未实现，而不是语法或模块加载错误。

- [ ] **Step 3：在类型文件定义稳定 key 与行联合**

  在 `src/types/enums.ts` 使用单一 key 数组派生类型，避免注册表和 union 漂移：

  ```ts
  export const ENUM_TYPE_KEYS = [
    'first-sale-tos',
    'roadmap-tos',
    'machine-project-status',
    'technical-project-status',
    'tos-capability-project-status',
    'machine-health-status',
    'version-type',
    'software-project-level',
    'product-series',
    'research-mode',
    'machine-development-mode',
    'technical-development-mode',
    'upgrade-strategy',
    'system-type',
    'kernel-version',
    'chip-mapping',
    'memory-size',
    'project-category-mapping',
    'build-option',
    'build-market',
    'tmg-subdomain-mapping',
    'core-value',
  ] as const

  export type EnumTypeKey = typeof ENUM_TYPE_KEYS[number]
  export type EnumKind = 'single' | 'tmg-map' | 'chip-map' | 'project-category-map'

  export interface BaseEnumRow { id: string }
  export interface SingleEnumRow extends BaseEnumRow { value: string }
  export interface TmgMappingRow extends BaseEnumRow { domain: string; subdomain: string }
  export interface ChipMappingRow extends BaseEnumRow {
    chipCode: string
    chipModel: string
    chipPlatform: string
  }
  export interface ProjectCategoryMappingRow extends BaseEnumRow {
    ipmProjectCategory: string
    pmsProjectCategory: string
    pmsSecondaryCategory: string
  }
  export type EnumRow = SingleEnumRow | TmgMappingRow | ChipMappingRow | ProjectCategoryMappingRow
  export type EnumRowsByType = { [K in EnumTypeKey]: EnumRow[] }
  export type EnumRowDraft = Omit<SingleEnumRow, 'id'>
    | Omit<TmgMappingRow, 'id'>
    | Omit<ChipMappingRow, 'id'>
    | Omit<ProjectCategoryMappingRow, 'id'>
  ```

  `EnumActionResult.reason` 扩展为 `invalid | duplicate | missing | storage`；字段级错误由校验函数返回 `fieldErrors`，供弹窗定位到具体列。

- [ ] **Step 4：用唯一注册表声明 22 项元数据**

  在 `src/lib/enumValues.ts` 定义 `ENUM_DEFINITIONS`，顺序直接来自 `ENUM_TYPE_KEYS`。元数据必须逐项为：

  | key | label | scopeLabel | kind |
  | --- | --- | --- | --- |
  | `first-sale-tos` | 首销tOS版本 | 整机产品项目 / 技术项目 | single |
  | `roadmap-tos` | tOS版本-路标 | tOS路标 | single |
  | `machine-project-status` | 项目状态-整机产品项目 | 整机产品项目 | single |
  | `technical-project-status` | 项目状态-技术项目 | 技术项目 | single |
  | `tos-capability-project-status` | 项目状态-tOS版本项目/能力建设项目 | tOS版本项目 / 能力建设项目 | single |
  | `machine-health-status` | 健康状态 | 整机产品项目 | single |
  | `version-type` | 版本类型 | 整机产品项目 / tOS版本项目 | single |
  | `software-project-level` | 软件项目等级 | 整机产品项目 | single |
  | `product-series` | 产品系列 | 整机产品项目 | single |
  | `research-mode` | 研发模式 | 整机产品项目 | single |
  | `machine-development-mode` | 开发模式-整机产品项目 | 整机产品项目 | single |
  | `technical-development-mode` | 开发模式-技术项目 | 技术项目 | single |
  | `upgrade-strategy` | 升级策略 | 整机产品项目 | single |
  | `system-type` | 系统类型 | 整机产品项目 | single |
  | `kernel-version` | Kernel版本 | 整机产品项目 | single |
  | `chip-mapping` | 芯片编码/芯片型号/芯片平台 | 整机产品项目 | chip-map |
  | `memory-size` | 内存大小 | 整机产品项目 | single |
  | `project-category-mapping` | 项目分类 | 整机产品项目 / tOS版本项目 / 技术项目 / 能力建设项目 | project-category-map |
  | `build-option` | 编译选项 | 整机产品项目 | single |
  | `build-market` | 编译市场 | 整机产品项目 | single |
  | `tmg-subdomain-mapping` | TMG及技术领域&子领域 | 技术项目 | tmg-map |
  | `core-value` | 核心价值 | 技术项目 | single |

  列声明只能来自 kind：

  ```ts
  const COLUMNS_BY_KIND = {
    single: [{ key: 'value', labelFromDefinition: true }],
    'chip-map': [
      { key: 'chipCode', label: '芯片编码' },
      { key: 'chipModel', label: '芯片型号' },
      { key: 'chipPlatform', label: '芯片平台' },
    ],
    'project-category-map': [
      { key: 'ipmProjectCategory', label: 'IPM项目分类' },
      { key: 'pmsProjectCategory', label: 'PMS项目分类' },
      { key: 'pmsSecondaryCategory', label: 'PMS二级项目分类' },
    ],
    'tmg-map': [
      { key: 'domain', label: 'TMG及技术领域' },
      { key: 'subdomain', label: '子领域' },
    ],
  } as const
  ```

- [ ] **Step 5：实现通用归一化、显示和逐行校验**

  - 所有字符串保存前 `trim()`。
  - 两个 tOS 类型额外执行 `trimmed.replace(/^tOS/, '')`，只剥离一次前导。
  - `formatEnumCellValue(type, value)` 对两个 tOS key 返回 `tOS${normalized}`，其他类型原样返回。
  - 单字段整值区分大小写去重。
  - 芯片、TMG 按完整行区分大小写去重，允许相同芯片编码对应不同型号/平台。
  - 项目分类按 `ipmProjectCategory` 唯一；PMS 分类只接受四个正式名称。
  - PMS 分类不是整机时强制把二级分类归一化为空；整机时二级分类必填。

- [ ] **Step 6：再次运行注册表验证**

  Run: `npm run verify:enum-config`

  Expected: 新注册表、列、格式化和校验断言 PASS；旧 store/UI 断言仍可能因后续任务未迁移而 FAIL。只提交本任务已经通过的分段，或将脚本按 `verifyRegistryContract()` 分段输出以确认该段 PASS。

- [ ] **Step 7：提交核心合同**

  ```bash
  git add src/types/enums.ts src/lib/enumValues.ts scripts/verify-enum-config.mjs
  git diff --cached --check
  git commit -m "feat: define flat enum configuration registry"
  ```

## Task 2：补齐初始数据与 v1 → v2 持久化迁移

**Files:**

- Modify: `src/lib/enumValues.ts`
- Modify: `src/stores/enums.ts`
- Modify: `scripts/verify-enum-config.mjs`

- [ ] **Step 1：先写初始数据和迁移失败用例**

  在 `scripts/verify-enum-config.mjs` 增加：

  - 22 个 key 均存在数组，允许权威值缺失的类型为空数组；
  - 每个初始行都有非空稳定 ID；
  - v1 `tos-2-part: ['16.0', '17.2']` 迁移到 `roadmap-tos`；
  - v1 `tos-3-part: ['16.0.1', '17.2.0']` 与 2-part 合并到 `first-sale-tos`，顺序为 `16.0.1, 17.2.0, 16.0, 17.2`；
  - 无效旧行被过滤，不能解析的某类型回退该类型 seed；
  - 已存在 v2 `rowsByType` 再迁移不丢稳定 ID。

- [ ] **Step 2：运行并确认旧 store 结构导致失败**

  Run: `npm run verify:enum-config`

  Expected: FAIL，明确显示 `rowsByType` 或 version 2 迁移尚未实现。

- [ ] **Step 3：定义精确初始数据**

  在 `src/lib/enumValues.ts` 建立 `createInitialEnumRows()`。seed 行 ID 固定为 `seed-${type}-${index + 1}`，保证每次重置得到相同 ID；迁移旧值使用 `migrated-${type}-${index + 1}`，只有用户新增行才生成随机 ID。当前已有受支持值按以下规则迁移，未提供权威值的 `product-series`、`research-mode`、`chip-mapping` 初始化为空：

  ```ts
  const INITIAL_SINGLE_VALUES = {
    'first-sale-tos': ['16.0.1', '16.0.2', '17.2.0', '16.0', '17.2'],
    'roadmap-tos': ['16.0', '17.2'],
    'machine-project-status': ['待立项', '在研', '上市', '转维', 'EOS', '暂停', '已取消', '规划中'],
    'technical-project-status': ['待立项', '在研', '上市', 'EOS', '暂停', '已取消', '规划中', '已迁移'],
    'tos-capability-project-status': ['在研', '已完成', '暂停', '已取消'],
    'machine-health-status': ['正常', '关注', '风险'],
    'version-type': ['Full', 'Slim', 'PAD', 'GO'],
    'software-project-level': ['S', 'A', 'B', 'C', 'D'],
    'product-series': [],
    'research-mode': [],
    'machine-development-mode': ['自研', '联合开发', 'ODC', '外研', 'ITD-ODC', 'ODM', '纯外研', 'JDM'],
    'technical-development-mode': ['自研', '谷歌合作', 'SoC合作', '高校合作'],
    'upgrade-strategy': ['不维护', 'EWP维护', '维1', '维2', 'EWP维护+tOS升级', '维1+tOS升级', '维2+tOS升级', '升1维2', '升2维3', '升3维5'],
    'system-type': ['32bit', '64bit', '64only'],
    'kernel-version': ['5.10', '5.15', '6.1', '6.6'],
    'memory-size': ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'],
    'build-option': ['ko2_sl303', 'ko2', 'a681l_sm386', 'lj8k_h781', 'lj8_h781', 'lj7_h782', 'x1103b'],
    'build-market': ['op', 'tr'],
    'core-value': ['追赶', '人无我有', '人有我有'],
  } as const
  ```

  TMG 初始行必须是以下 17 行，保持顺序：

  ```ts
  [
    ['基础架构TMG', '无'], ['性能TMG', '无'], ['DFX TMG', '无'], ['UX TMG', '无'],
    ['系统应用', 'AIOS'], ['系统应用', '应用'], ['系统应用', '图形'], ['系统应用', '内核'], ['系统应用', '多媒体'],
    ['底软通信', '器件'], ['底软通信', '蜂窝'], ['底软通信', '短距'], ['底软通信', '功耗'],
    ['集成维护', '三方体验'], ['集成维护', 'GMS'],
    ['其他', '安全'], ['其他', 'AIOT'],
  ]
  ```

  项目分类初始行从当前 `src/constants/projectTypes.ts` 的 25 个 IPM key 一次性迁入注册表；PMS 分类按当前分类保留，但非整机的二级分类写空字符串。精确结果：

  | IPM项目分类 | PMS项目分类 | PMS二级项目分类 |
  | --- | --- | --- |
  | 整机产品-基线IPD | 整机产品项目 | 整机-手机 |
  | 整机产品-模块化IPD | 整机产品项目 | 整机-手机 |
  | 整机产品-非IPD | 整机产品项目 | 整机-手机 |
  | 手机整机产品-大版本升级 | 整机产品项目 | 整机-手机 |
  | 其他-平板--整机产品项目 | 整机产品项目 | 整机-平板 |
  | 其他-笔电/移动互联及其他--整机产品项目 | 整机产品项目 | 整机-笔电 |
  | 其他-笔电 | 整机产品项目 | 整机-笔电 |
  | 移动互联及其他--整机产品项目 | 整机产品项目 | 整机-笔电 |
  | 其他-功能机 | 整机产品项目 | 整机-功能机 |
  | 其他-AIOT | 整机产品项目 | 整机-AIOT扩品类 |
  | 基线项目 | 整机产品项目 | 整机-基线项目 |
  | N+1项目 | 整机产品项目 | 整机-N+1项目 |
  | 预研类项目 | 整机产品项目 | 整机-预研项目 |

  - `软件产品项目`：PMS 分类 `tOS版本项目`，二级为空。
  - 7 个技术 key：`研发级-基础研究-重点项目`、`研发级-基础研究-非重点项目`、`部门级-基础研究`、`研发级-技术研发-重点项目`、`研发级-技术研发-非重点项目`、`部门级-技术研发`、`技术项目前置工作`；PMS 分类 `技术项目`，二级为空。
  - 4 个能力 key：`部门级能力建设`、`公司级/研发级能力建设`、`公司级能力建设`、`研发级能力建设`；PMS 分类 `能力建设项目`，二级为空。

- [ ] **Step 4：把 store 改成按稳定 ID 的多结构 CRUD**

  `src/stores/enums.ts` 的 state/action 改为：

  ```ts
  interface EnumState {
    rowsByType: EnumRowsByType
    selectedType: EnumTypeKey
    hasHydrated: boolean
    hydrationError: string | null
  }

  interface EnumActions {
    setSelectedType(type: EnumTypeKey): void
    addEnumRow(type: EnumTypeKey, draft: EnumRowDraft): EnumActionResult
    updateEnumRow(type: EnumTypeKey, rowId: string, draft: EnumRowDraft): EnumActionResult
    deleteEnumRow(type: EnumTypeKey, rowId: string): EnumActionResult
    hydrateEnumStore(): Promise<boolean>
    resetLocalConfig(): Promise<boolean>
    completeHydration(error?: unknown): void
  }
  ```

  `createEnumStore(initial, idFactory = defaultIdFactory)` 允许验证脚本注入 `() => 'row-1'`；生产 ID 使用 `crypto.randomUUID()`，不可用时用时间戳加随机片段。新增追加到尾部，更新保持原位置，删除按 ID，均通过 `validateAndNormalizeEnumRow`。

- [ ] **Step 5：升级持久化版本并实现显式迁移**

  - `ENUM_STORE_VERSION = 2`，storage key 仍为 `pms-enum-values`。
  - `PersistedEnumState = Pick<EnumState, 'rowsByType'>`。
  - fromVersion 0/1：读取旧 `valuesByType`，按规格合并 tOS 值，其余类型用 seeds。
  - fromVersion 2：逐类型、逐行净化；保留合法 ID，缺 ID 时补稳定新 ID；非法整行丢弃。
  - `cloneRows` 深拷贝每一行，写入失败恢复之前的 `rowsByType`。
  - 水合错误、重试、重置文案与现有行为保持不变。
  - 在 Task 9 完成全部调用方迁移前，store 暂时保留只读派生的旧 `valuesByType` 和旧 tOS CRUD 兼容动作，只把它们映射到 `roadmap-tos/first-sale-tos` 行；兼容字段不进入 v2 持久化。Task 9 必须删除这层桥接。这样 Task 2 到 Task 8 之间现有消费者仍能编译运行，不会形成第三份数据。

- [ ] **Step 6：验证 CRUD、迁移、回滚与恢复**

  Run: `npm run verify:enum-config`

  Expected: PASS for registry, seed, CRUD, v1/v2 migration, duplicate/missing/invalid results, storage partialize and recovery contracts.

- [ ] **Step 7：提交 store 与迁移**

  ```bash
  git add src/lib/enumValues.ts src/stores/enums.ts scripts/verify-enum-config.mjs
  git diff --cached --check
  git commit -m "feat: persist enum mapping rows with migration"
  ```

## Task 3：建立统一业务查询与历史快照适配器

**Files:**

- Create: `src/lib/enumConsumers.ts`
- Create: `src/hooks/useEnumOptions.ts`
- Create: `scripts/verify-enum-consumers.mjs`
- Modify: `package.json`
- Modify: `src/lib/tosEnumOptions.ts`
- Modify: `src/hooks/useTosEnumOptions.ts`

- [ ] **Step 1：先写纯函数失败用例**

  创建 `scripts/verify-enum-consumers.mjs`，通过 `scripts/lib/source-contract.mjs` 加载 TypeScript，覆盖：

  - 单字段选项保持行顺序；
  - tOS option 的 value 保存主体、label 显示一个 `tOS` 前缀；
  - 历史值不在当前配置时追加 `{ value: old, label: 'old（已停用）', disabled: true }`；
  - 历史值仍有效时不重复；
  - 相同芯片编码的多行用完整 `编码 / 型号 / 平台` 区分；
  - 选择芯片 row ID 后一次返回三个字符串快照；
  - IPM 分类精确匹配，未匹配返回 `undefined`；
  - TMG 第一列去重保序，子领域按当前 domain 过滤保序；
  - 唯一子领域为 `无` 时返回 `autoSelect: true`。

- [ ] **Step 2：运行并确认模块尚不存在**

  Run: `node scripts/verify-enum-consumers.mjs`

  Expected: FAIL，指向 `src/lib/enumConsumers.ts` 不存在。

- [ ] **Step 3：实现无 React 依赖的查询函数**

  `src/lib/enumConsumers.ts` 至少导出：

  ```ts
  export interface EnumOption { value: string; label: string; disabled?: boolean }

  export function getSingleEnumValues(rowsByType: EnumRowsByType, type: SingleEnumTypeKey): string[]
  export function buildEnumOptions(
    rowsByType: EnumRowsByType,
    type: SingleEnumTypeKey,
    historicalValues?: readonly string[],
  ): EnumOption[]
  export function buildChipOptions(rowsByType: EnumRowsByType, historical?: ProjectChipSnapshot): ChipOption[]
  export function resolveChipRow(rowsByType: EnumRowsByType, rowId: string): ProjectChipSnapshot | undefined
  export function findProjectCategoryMapping(rowsByType: EnumRowsByType, ipmCategory: string): ProjectCategorySnapshot | undefined
  export function getTmgDomains(rowsByType: EnumRowsByType, historicalDomain?: string): EnumOption[]
  export function getTmgSubdomainState(
    rowsByType: EnumRowsByType,
    domain: string,
    historicalSubdomain?: string,
  ): { options: EnumOption[]; autoValue?: string; disabled: boolean }
  ```

  历史芯片组合不能伪造 row ID；使用 `history:<encoded snapshot>` 的只读 option，保持现值但用户重新选择时只允许有效 row ID。

- [ ] **Step 4：实现 hooks，并把旧 tOS hook 临时变成兼容包装**

  `src/hooks/useEnumOptions.ts` 只读取 `useEnumStore(state => state.rowsByType)` 并 `useMemo` 调用纯函数。现阶段 `useTosEnumOptions` 可包装：

  - 旧 `'tos-2-part'` → 新 `'roadmap-tos'`；
  - 旧 `'tos-3-part'` → 新 `'first-sale-tos'`。

  这样后续逐入口迁移时不会出现一半代码无法编译；Task 9 在所有调用方替换后删除兼容文件。

- [ ] **Step 5：加入命令并运行**

  `package.json` 增加：

  ```json
  "verify:enum-consumers": "node scripts/verify-enum-consumers.mjs"
  ```

  Run: `npm run verify:enum-consumers`

  Expected: PASS，输出单字段、历史值、芯片、分类、TMG 五组断言均通过。

- [ ] **Step 6：提交查询层**

  ```bash
  git add src/lib/enumConsumers.ts src/hooks/useEnumOptions.ts scripts/verify-enum-consumers.mjs package.json src/lib/tosEnumOptions.ts src/hooks/useTosEnumOptions.ts
  git diff --cached --check
  git commit -m "feat: add enum consumer adapters"
  ```

## Task 4：新增枚举编辑专用全局权限

**Files:**

- Modify: `src/constants/permissions.ts`
- Modify: `src/stores/permission.ts`
- Modify: `scripts/verify-global-permission-matrix.mjs`

- [ ] **Step 1：先添加权限矩阵断言**

  在 `scripts/verify-global-permission-matrix.mjs` 断言：

  - 配置中心模块出现 `configCenter:enumEdit`，显示名 `枚举值新增、修改、删除`；
  - `管理组` 为 true；
  - `编辑组`、`查看组` 为 false；
  - 管理员 bypass 仍然有效。

- [ ] **Step 2：运行并确认缺少权限 key**

  Run: `node scripts/verify-global-permission-matrix.mjs`

  Expected: FAIL，缺少 `configCenter:enumEdit`。

- [ ] **Step 3：添加权限声明和默认矩阵**

  将下列项加入 `src/constants/permissions.ts` 的配置中心权限组：

  ```ts
  { key: 'configCenter:enumEdit', label: '枚举值新增、修改、删除' }
  ```

  在 `src/stores/permission.ts` 的三组默认值中明确写入 `管理组: true`、`编辑组: false`、`查看组: false`，不要依赖 undefined 隐式为 false。

- [ ] **Step 4：运行权限回归**

  Run: `node scripts/verify-global-permission-matrix.mjs`

  Expected: PASS；已有计划模板、转维等权限断言不变。

- [ ] **Step 5：提交权限**

  ```bash
  git add src/constants/permissions.ts src/stores/permission.ts scripts/verify-global-permission-matrix.mjs
  git diff --cached --check
  git commit -m "feat: add enum configuration edit permission"
  ```

## Task 5：实现扁平枚举配置页与动态 CRUD

**Files:**

- Modify: `src/components/config/EnumConfig.tsx`
- Modify: `src/containers/ConfigContainer.tsx`
- Modify: `src/styles/globals.css`
- Modify: `scripts/verify-enum-config.mjs`

- [ ] **Step 1：先把页面源码契约改为新设计**

  删除验证脚本中对 AntD `Tree`、`通用`、`人力资源管道`、两种 tOS 节点的正向断言，改为：

  - 页面从 `ENUM_TYPE_KEYS`、`ENUM_DEFINITIONS` 生成列表和表格；
  - 左侧标题包含 `配置项（22）`；
  - 搜索只匹配 definition label，不重排；
  - 表格首列 render 为 `index + 1`；
  - 动态列来自 definition columns；
  - 新增/编辑调用按 ID 的 store action；
  - 删除确认包含行摘要；
  - `useHasGlobalPermission(currentLoginUser)` 返回的权限检查函数以 `configCenter:enumEdit` 控制三个写操作；
  - 页面源码不存在 `Tree`、`通用`、`人力资源管道`、旧 `enum-category-*`。

- [ ] **Step 2：运行并确认旧页面失败**

  Run: `npm run verify:enum-config`

  Expected: FAIL，指向旧树结构或旧 CRUD API。

- [ ] **Step 3：重构为扁平左栏**

  在 `EnumConfig.tsx`：

  - 左栏直接 map `ENUM_TYPE_KEYS`；
  - 搜索结果保持原数组顺序；
  - 每项显示 label 和 `rowsByType[key].length`；
  - 当前项用稳定 class `pms-enum-type-item--active`；
  - 初始选中 `first-sale-tos`；
  - 不允许用户维护配置类型本身。

- [ ] **Step 4：生成动态表与序号**

  - 固定首列 `{ title: '序号', width: 72, render: (_v, _row, index) => index + 1 }`。
  - 中间列按 definition 生成；tOS 单字段 cell 用 `formatEnumCellValue`。
  - 最后一列为编辑/删除；无权限时整列不渲染。
  - 空表文案为 `暂无配置值`，有权限时同时显示新增按钮。
  - 右侧头部显示结构标签、应用范围、`${rowCount} 条` 和新增按钮。

- [ ] **Step 5：实现一个动态新增/编辑弹窗**

  弹窗按 kind 生成：

  - single：一个输入框，label 为配置项名称；
  - chip：芯片编码/芯片型号/芯片平台三个输入框；
  - project category：IPM 输入、PMS 四项 Select、条件二级输入；非整机时清空并 disabled；
  - TMG：领域、子领域两个输入框。

  提交时使用 store 的 `fieldErrors` 显示 `必填`、`配置值已存在`、`该 IPM 项目分类已存在` 等错误；提交期间按钮 loading，关闭后把焦点还给触发按钮。删除使用 `Modal.confirm` 并显示 `getEnumRowSummary(type, row)`。

- [ ] **Step 6：接入专用权限与恢复态**

  `ConfigContainer` 已读取 `currentLoginUser`，把它作为 prop 传给 `EnumConfig`；组件内使用：

  ```ts
  const hasGlobalPermission = useHasGlobalPermission(currentLoginUser)
  const canEditEnums = hasGlobalPermission('configCenter:enumEdit')
  ```

  - 浏览配置不要求 `enumEdit`。
  - 没有权限时隐藏新增、编辑、删除按钮。
  - 水合失败继续使用现有错误卡、重试、重置入口。
  - 写入失败时提示 store 返回的存储错误，不关闭弹窗。

- [ ] **Step 7：更新双栏和窄屏样式**

  `globals.css` 复用 `ConfigWorkspaceShell`，新增/调整：

  - 桌面左栏固定合理宽度，左右各自滚动；
  - 22 项有紧凑行高、数量徽标、浅紫 active 和左强调线；
  - 序号列使用 `font-variant-numeric: tabular-nums`；
  - `max-width: 900px` 下改为单列，左侧列表限高并内部滚动；
  - 删除已无消费者的 tree/category 专用样式前先 `rg` 确认只属于本组件。

- [ ] **Step 8：运行配置页源码验证和类型检查**

  Run: `npm run verify:enum-config && npx tsc --noEmit`

  Expected: 两个命令 PASS；无旧 enum store API、旧 tree props 或联合类型错误。

- [ ] **Step 9：提交配置页**

  ```bash
  git add src/components/config/EnumConfig.tsx src/containers/ConfigContainer.tsx src/styles/globals.css scripts/verify-enum-config.mjs
  git diff --cached --check
  git commit -m "feat: build flat enum mapping editor"
  ```

## Task 6：用动态项目分类映射替换硬编码，并隐藏非整机二级分类

**Files:**

- Modify: `src/constants/projectTypes.ts`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/lib/projectInfoRules.ts`
- Modify: `scripts/verify-project-info-matrix-refresh.mjs`
- Modify: `scripts/verify-enum-consumers.mjs`

- [ ] **Step 1：先写四类项目分类的失败用例**

  验证以下输入输出：

  - 整机 IPM key → `整机产品项目` + 对应二级分类，表单显示且要求二级；
  - `软件产品项目` → `tOS版本项目` + 空二级，表单不显示二级；
  - 任一技术 key → `技术项目` + 空二级，表单不显示二级；
  - 任一能力 key → `能力建设项目` + 空二级，表单不显示二级；
  - 未配置 IPM 分类不再硬编码猜测，返回 `该 IPM 项目分类尚未配置映射，请联系管理员维护` 并阻止提交；
  - 编辑历史项目时不因配置映射变化自动重写已保存的分类快照。

- [ ] **Step 2：运行并确认旧二级分类规则失败**

  Run: `npm run verify:enum-consumers && node scripts/verify-project-info-matrix-refresh.mjs`

  Expected: FAIL，至少有一项显示旧逻辑仍为 tOS/技术/能力合成二级分类或所有类型都要求二级。

- [ ] **Step 3：把创建态改成查询配置映射**

  `ProjectInfoModal` 接收/读取 `rowsByType`，选择 IPM 项目后用 `findProjectCategoryMapping`：

  ```ts
  const mapped = findProjectCategoryMapping(rowsByType, selectedIpmProject.categoryName)
  if (!mapped) {
    form.setFieldsValue({ projectCategory: undefined, projectSecondaryCategory: undefined })
    setClassificationError(UNMAPPED_IPM_CATEGORY_MESSAGE)
    return
  }
  form.setFieldsValue({
    projectCategory: mapped.pmsProjectCategory,
    projectSecondaryCategory: mapped.pmsProjectCategory === PROJECT_CATEGORY_MACHINE
      ? mapped.pmsSecondaryCategory
      : undefined,
  })
  ```

  分类字段保持只读；只有 `projectCategory === '整机产品项目'` 时 render 二级分类行。

- [ ] **Step 4：修正提交规则并隔离历史编辑态**

  `projectInfoRules` 的分类校验改为：

  ```ts
  if (!projectCategory) return '项目分类不能为空'
  if (projectCategory === PROJECT_CATEGORY_MACHINE && !projectSecondaryCategory) {
    return '项目二级分类不能为空'
  }
  ```

  新建/重新选择 IPM 时必须有当前映射；编辑已保存项目且 IPM 来源不变时沿用 snapshot，不触发 remap。只有明确重新选择 IPM 项目才应用当前映射。

- [ ] **Step 5：删除运行时硬编码映射源**

  从 `projectTypes.ts` 删除 `IPM_PROJECT_CLASSIFICATION_MAP` 及 `mapIpmProjectClassification` 的运行时使用；`resolveProjectClassification` 只解析已有项目快照/兼容旧显示，不再根据 IPM 名称合成映射，不再为 tOS/技术/能力补二级分类。

- [ ] **Step 6：运行分类回归**

  Run: `npm run verify:enum-consumers && node scripts/verify-project-info-matrix-refresh.mjs && npx tsc --noEmit`

  Expected: PASS；四类项目和未映射错误均符合规格。

- [ ] **Step 7：提交项目分类接入**

  ```bash
  git add src/constants/projectTypes.ts src/components/project-info/ProjectInfoModal.tsx src/lib/projectInfoRules.ts scripts/verify-project-info-matrix-refresh.mjs scripts/verify-enum-consumers.mjs
  git diff --cached --check
  git commit -m "feat: drive project classification from enum mappings"
  ```

## Task 7：接入整机项目单字段枚举与芯片三列映射

**Files:**

- Modify: `src/components/project-info/ProjectInfoFieldInput.tsx`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/components/workspace/AddProjectModal.tsx`
- Modify: `src/constants/projectInfoSchema.ts`
- Modify: `src/types/app.ts`
- Modify: `src/components/project-info/TargetProjectInformationView.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `scripts/verify-project-info-matrix-refresh.mjs`
- Modify: `scripts/verify-machine-tos-versions.mjs`

- [ ] **Step 1：先写整机配置和芯片失败用例**

  在现有脚本中验证：

  - 首销 tOS、健康状态、版本类型、软件项目等级、产品系列、研发模式、整机开发模式、升级策略、系统类型、Kernel 版本、内存大小均来自相应 key；
  - 旧值被删除后编辑页出现 `（已停用）` 且不改字段可保存；
  - 选择 `D6300 / MT6835 / MTK` 后三个字段一次更新；
  - 若再有 `D6300 / MT6835T / MTK`，两个 option 可区分且不会交叉组合；
  - 芯片型号、芯片平台只读；
  - 配置无有效值时 Select 显示维护指引，不回退硬编码数组。

- [ ] **Step 2：运行并确认硬编码源仍被使用**

  Run: `node scripts/verify-project-info-matrix-refresh.mjs && npm run verify:machine-tos`

  Expected: FAIL，指出硬编码 options、旧 tOS key 或芯片自由文本仍存在。

- [ ] **Step 3：统一 ProjectInfo 字段 option 覆盖**

  `ProjectInfoModal` 为所有实际可选择的配置字段构造 `fieldOptionOverrides`，不是只对整机的少数字段覆盖。每个字段把当前项目 snapshot 作为 historical value 传给 `buildEnumOptions`。原本由 IPM 带出或只读的 `researchMode`、`memorySize` 继续只读，只做 snapshot 展示和有效值校验，不因配置接入改成可编辑；芯片编码是本次已确认的明确例外，改成映射行选择入口。

  映射必须明确为：

  ```ts
  const PROJECT_FIELD_ENUM_TYPE = {
    firstSaleTosVersion: 'first-sale-tos',
    currentTosVersion: 'first-sale-tos',
    healthStatus: 'machine-health-status',
    versionType: 'version-type',
    softwareProjectLevel: 'software-project-level',
    productSeries: 'product-series',
    researchMode: 'research-mode',
    developmentMode: 'machine-development-mode',
    dimensionUpgradeStrategy: 'upgrade-strategy',
    systemType: 'system-type',
    kernelVersion: 'kernel-version',
    memorySize: 'memory-size',
  } as const
  ```

  现有项目字段 key 继续使用 `dimensionUpgradeStrategy`，项目表单现有显示名“升维策略”也不在本任务顺手改名；配置中心名称严格为 `升级策略`。`currentTosVersion` 继续沿用首销版本的同一组选项，因为现有界面本来就与 `firstSaleTosVersion` 共用来源，本期不新增第 23 个配置类型。

- [ ] **Step 4：把芯片改为整行选择并原子写入**

  `ProjectInfoFieldInput` 的芯片编码控件使用 `buildChipOptions`。onChange 先 `resolveChipRow`，然后单次 `form.setFieldsValue({ chipCode, chipModel, chipPlatform })`。编辑历史组合时显示禁用的历史 option；用户重新选择后只接受有效 row。

- [ ] **Step 5：移除属于 22 项的组件内 options**

  - `projectInfoSchema.ts` 保留字段、label、required、readonly 元数据，删除本任务配置项的 hardcoded options/free-text suggestion。
  - `AddProjectModal` 不再自己拼 first-sale tOS、版本类型、开发模式数组，改用统一 hooks。
  - `ProjectSpaceContainer` 内相同字段的编辑 Select 也使用统一 options，避免新建和编辑来源不一致。

- [ ] **Step 6：兼容健康状态历史值**

  `src/types/app.ts` 将 `HealthStatus` 调整为字符串快照；在 `TargetProjectInformationView.tsx` 使用共享的 `getHealthPresentation(value)`（放在该组件可复用的现有 helper 或相邻 lib 中）：

  - `normal` 或 `正常` 使用现有正常颜色；
  - `warning`、`关注`、`预警` 使用现有关注颜色；
  - `risk` 或 `风险` 使用现有风险颜色；
  - 其他配置值使用中性灰色，不崩溃、不强制改写。

- [ ] **Step 7：运行整机回归与类型检查**

  Run: `node scripts/verify-project-info-matrix-refresh.mjs && npm run verify:machine-tos && npx tsc --noEmit`

  Expected: PASS；源码中不再出现属于上述字段的第二份选项数组。

- [ ] **Step 8：提交整机接入**

  ```bash
  git add src/components/project-info/ProjectInfoFieldInput.tsx src/components/project-info/ProjectInfoModal.tsx src/components/project-info/TargetProjectInformationView.tsx src/components/workspace/AddProjectModal.tsx src/constants/projectInfoSchema.ts src/types/app.ts src/containers/ProjectSpaceContainer.tsx scripts/verify-project-info-matrix-refresh.mjs scripts/verify-machine-tos-versions.mjs
  git diff --cached --check
  git commit -m "feat: connect machine project fields to enum config"
  ```

## Task 8：接入技术项目 TMG、子领域和单字段枚举

**Files:**

- Modify: `src/components/technical-project/TechnicalProjectCreateFields.tsx`
- Modify: `src/components/technical-project/SubprojectConfigModal.tsx`
- Modify: `src/components/technical-project/TechnicalProjectBasicInfo.tsx`
- Modify: `src/constants/technicalProject.ts`
- Modify: `src/types/technicalProject.ts`
- Modify: `src/stores/technicalProject.ts`
- Modify: `scripts/verify-technical-project.mjs`
- Modify: `scripts/verify-enum-consumers.mjs`

- [ ] **Step 1：先写技术项目失败用例**

  验证：

  - 领域 options 来自 TMG 映射第一列，去重且保序；
  - 切换领域后，旧子领域不在新 options 中则清空；
  - `基础架构TMG` 唯一子领域 `无` 时自动填充并禁用；
  - `系统应用` 提供 `AIOS/应用/图形/内核/多媒体`；
  - 当前领域无子领域时显示 `暂无可用配置，请先在配置中心维护` 并阻止提交；
  - 技术项目首销 tOS、开发模式、核心价值、项目状态使用各自配置；
  - 已保存但已删除的技术字段仍以 `（已停用）` 显示并可原样保存。

- [ ] **Step 2：运行并确认当前常量源导致失败**

  Run: `npm run verify:technical-project && npm run verify:enum-consumers`

  Expected: FAIL，明确指向 `SUBDOMAINS_BY_DOMAIN`、`TECHNICAL_CORE_VALUES`、`TECHNICAL_DEVELOPMENT_MODES` 或旧 tOS key。

- [ ] **Step 3：替换 TMG 联动**

  `TechnicalProjectCreateFields` 和技术项目编辑入口统一使用 `getTmgDomains/getTmgSubdomainState`：

  - domain onChange 后查询新状态；
  - 若 `autoValue` 存在，写入该值；
  - 若旧 subdomain 不在有效 options，清空；
  - disabled 只由“唯一值为无”决定；
  - 空 options 的 required 校验使用维护指引文案。

  `constants/technicalProject.ts` 只保留团队字段、交付物字段等与 22 项无关的常量，删除运行时 `SUBDOMAINS_BY_DOMAIN`、`TECHNICAL_DOMAINS`、`NO_SUBDOMAIN_DOMAINS`。

- [ ] **Step 4：替换技术项目单字段源**

  映射为：

  ```ts
  const TECHNICAL_FIELD_ENUM_TYPE = {
    firstSaleTosVersion: 'first-sale-tos',
    developmentMode: 'technical-development-mode',
    projectValue: 'core-value',
    projectStatus: 'technical-project-status',
  } as const
  ```

  `SubprojectConfigModal`、`TechnicalProjectBasicInfo` 不再 import 本地数组；当前 snapshot 通过 history option 保留。

- [ ] **Step 5：把封闭 union 改成字符串快照兼容**

  `src/types/technicalProject.ts` 对开发模式、核心价值等可配置字段使用 `string`，不要生成 22 项值的 TypeScript union。`stores/technicalProject.ts` 只校验必填/字符串，不再以硬编码数组拒绝已停用 snapshot；有效新选择由 UI 当前 options 约束。

- [ ] **Step 6：运行技术项目回归**

  Run: `npm run verify:technical-project && npm run verify:enum-consumers && npx tsc --noEmit`

  Expected: PASS；TMG 与技术单字段无第二份运行时数组。

- [ ] **Step 7：提交技术项目接入**

  ```bash
  git add src/components/technical-project/TechnicalProjectCreateFields.tsx src/components/technical-project/SubprojectConfigModal.tsx src/components/technical-project/TechnicalProjectBasicInfo.tsx src/constants/technicalProject.ts src/types/technicalProject.ts src/stores/technicalProject.ts scripts/verify-technical-project.mjs scripts/verify-enum-consumers.mjs
  git diff --cached --check
  git commit -m "feat: connect technical projects to enum mappings"
  ```

## Task 9：接入路标、项目状态、编译选项与剩余入口

**Files:**

- Modify: `src/components/roadmap/TosVersionMaintenanceModal.tsx`
- Modify: `src/components/roadmap/PlannedProjectModal.tsx`
- Modify: `src/components/roadmap/ProjectRoadmapModule.tsx`
- Modify: `src/lib/roadmapFilters.ts`
- Modify: `src/lib/roadmapValidation.ts`
- Modify: `src/lib/roadmapProjectAdapter.ts`
- Modify: `src/types/roadmap.ts`
- Modify: `src/components/roadmap/RoadmapProjectCard.tsx`
- Modify: `src/components/roadmap/RoadmapProjectDetailsModal.tsx`
- Modify: `src/components/project-info/MarketEditorModal.tsx`
- Modify: `src/lib/spugBuildOptions.ts`
- Modify: `src/lib/projectStatus.ts`
- Modify: `src/constants/projectTypes.ts`
- Modify: `src/components/project-info/ProjectInfoModal.tsx`
- Modify: `src/containers/ProjectListContainer.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx`
- Delete: `src/hooks/useTosEnumOptions.ts`
- Delete: `src/lib/tosEnumOptions.ts`
- Modify: `scripts/verify-project-roadmap.mjs`
- Modify: `scripts/verify-tos-project-status.mjs`
- Modify: `scripts/verify-enum-consumers.mjs`
- Modify: `package.json`

- [ ] **Step 1：先写剩余入口失败用例**

  覆盖：

  - tOS 路标只读取 `roadmap-tos`，显示直接加 `tOS`，不限制两段格式；
  - 规划整机项目的版本类型、内存、产品系列、开发模式读取统一配置；
  - 整机、技术、tOS/能力分别读取三套状态配置；
  - 编译选项和编译市场读取 `build-option/build-market`；
  - 删除配置后旧路标/旧项目仍显示历史值；
  - 源码不再 import `useTosEnumOptions`、`TOS_ENUM_REGISTRY` 或把 SPUG mock 当实时 options。

- [ ] **Step 2：运行并确认旧来源失败**

  Run: `npm run verify:project-roadmap && npm run verify:tos-project-status && npm run verify:enum-consumers`

  Expected: FAIL，指向旧 tOS key、状态数组、路标数组或 SPUG options。

- [ ] **Step 3：迁移 tOS 路标**

  三个 roadmap 组件统一使用 `useEnumOptions('roadmap-tos', historicalValues)`。校验只要求非空/current selection；已有 snapshot 不因不在当前 options 中失效。`roadmapFilters`/`roadmapValidation` 接收 options 或查询函数结果，不再硬编码 `Full/Slim/PAD/Go`、RAM 和开发模式。

  `types/roadmap.ts` 将 `RoadmapRam`、`RoadmapVersionType`、`RoadmapDevelopMode` 改成字符串 snapshot；`roadmapProjectAdapter.ts` 对非空字符串保留原值，不再以三个闭合集合丢弃新配置值。两个 roadmap 详情/卡片组件对未知版本类型使用中性 Tag 颜色，不以固定 Record 直接索引导致 undefined。

- [ ] **Step 4：迁移规划项目剩余字段**

  `PlannedProjectModal` 使用：

  - `version-type`
  - `memory-size`
  - `product-series`
  - `machine-development-mode`
  - `first-sale-tos`，写入现有 `firstSaleTosVersionId` 字段

  旧 `Go` snapshot 继续显示为 `Go（已停用）`；当前有效值按 seed 中 `GO` 展示，不静默改写。

- [ ] **Step 5：迁移三套项目状态**

  `projectStatus.ts` 提供分类到 enum key 的纯映射：

  ```ts
  export function getProjectStatusEnumType(category: string): SingleEnumTypeKey {
    if (category === '整机产品项目') return 'machine-project-status'
    if (category === '技术项目') return 'technical-project-status'
    return 'tos-capability-project-status'
  }
  ```

  项目列表过滤、项目空间编辑和 tOS 状态入口都读取对应配置；“全部”仅是过滤 UI 的固定控制项，不写入配置中心。

  同时从 `constants/projectTypes.ts` 删除 `PROJECT_STATUS_VALUES` 这份运行时数组；`getProjectStatusOptions` 改成接受当前配置值参数，或由调用方直接使用 `buildEnumOptions` 后在过滤器前附加“全部”。

  `ProjectInfoModal` 的 tOS/能力状态 Select 也改用分类对应的配置 options；新建时即使字段因 IPM 同步而 disabled，显示和快照校验仍读取当前配置，不再 import `TOS_PROJECT_STATUS_OPTIONS`。

- [ ] **Step 6：迁移编译选项与市场**

  `MarketEditorModal` 直接从 store 读取 `build-option/build-market`，把已有市场行里的旧值作为历史 disabled option。`spugBuildOptions.ts` 可保留 `validateBuildSelection`、格式转换或 mock 外部调用兼容，但不能再导出/注入实时硬编码选项作为 UI source。

- [ ] **Step 7：删除 tOS 兼容包装**

  运行 `rg "useTosEnumOptions|tos-2-part|tos-3-part|TOS_ENUM_REGISTRY|valuesByType|addEnumValue|updateEnumValue|deleteEnumValue" src`。将所有业务调用替换后删除 `src/hooks/useTosEnumOptions.ts`、`src/lib/tosEnumOptions.ts` 以及 Task 2 的 store 兼容字段/动作；最终旧 key 只允许存在于 store v1 → v2 迁移中。

  `package.json` 增加 `"verify:project-roadmap": "node scripts/verify-project-roadmap.mjs"`，使本任务及全量回归命令可重复执行。

- [ ] **Step 8：运行剩余入口、类型与构建回归**

  Run:

  ```bash
  npm run verify:project-roadmap
  npm run verify:tos-project-status
  npm run verify:enum-consumers
  npx tsc --noEmit
  npm run build
  ```

  Expected: 全部 PASS；Next build 完成，无 hydration、动态 import 或类型错误。

- [ ] **Step 9：提交剩余业务接入**

  ```bash
  git add src/components/roadmap/TosVersionMaintenanceModal.tsx src/components/roadmap/PlannedProjectModal.tsx src/components/roadmap/ProjectRoadmapModule.tsx src/components/roadmap/RoadmapProjectCard.tsx src/components/roadmap/RoadmapProjectDetailsModal.tsx src/lib/roadmapFilters.ts src/lib/roadmapValidation.ts src/lib/roadmapProjectAdapter.ts src/types/roadmap.ts src/components/project-info/MarketEditorModal.tsx src/components/project-info/ProjectInfoModal.tsx src/lib/spugBuildOptions.ts src/lib/projectStatus.ts src/constants/projectTypes.ts src/containers/ProjectListContainer.tsx src/containers/ProjectSpaceContainer.tsx src/hooks/useTosEnumOptions.ts src/lib/tosEnumOptions.ts src/stores/enums.ts scripts/verify-project-roadmap.mjs scripts/verify-tos-project-status.mjs scripts/verify-enum-consumers.mjs package.json
  git diff --cached --check
  git commit -m "feat: connect roadmap status and build enums"
  ```

## Task 10：配置页浏览器验收、权限态与本地恢复

**Files:**

- Modify: `screenshots/verify-enum-config-browser.mjs`
- Modify: `scripts/verify-enum-config.mjs`

- [ ] **Step 1：把浏览器脚本改为新页面结构**

  继续复用现有 dev server 探测、登录用户切换、本地存储注入和截图工具，但把旧树节点 selector 改成稳定的 `data-testid`：

  - `enum-type-first-sale-tos`
  - `enum-type-chip-mapping`
  - `enum-type-project-category-mapping`
  - `enum-type-tmg-subdomain-mapping`
  - `enum-row-<row-id>`
  - `enum-add-button`
  - `enum-edit-<row-id>`
  - `enum-delete-<row-id>`

- [ ] **Step 2：先运行并确认旧浏览器脚本失败**

  启动应用：`npm run dev`

  另一个终端运行：`npm run verify:enum-browser`

  Expected: FAIL，原因是旧树 selector/旧两类枚举断言不匹配新页面；服务本身应能加载。

- [ ] **Step 3：覆盖 22 项列表和四种表结构**

  浏览器断言：

  - 左侧恰好 22 项，名称顺序与注册表一致；
  - 页面无 `通用`、`人力资源管道`；
  - 单字段、芯片、项目分类、TMG 表头分别正确；
  - 每张非空表序号为 `1..n`；删除一行后连续重排；新增总在末尾。

- [ ] **Step 4：覆盖动态 CRUD 与字段校验**

  - 单字段新增、编辑、重复、空白；
  - tOS 输入 `tOS18.preview` 后表格显示 `tOS18.preview` 且存储主体为 `18.preview`；
  - 芯片允许同编码不同完整行，拒绝完整重复；
  - 项目分类 IPM 重复被拒绝；非整机选择后二级输入清空且禁用；整机二级必填；
  - TMG 同领域多子领域可保存，完整重复被拒绝；
  - 删除确认文案包含行摘要。

- [ ] **Step 5：覆盖权限和恢复**

  - 管理组用户可见三个写操作；
  - 编辑组/查看组只能浏览；
  - corrupted storage 显示重试/重置；
  - storage unavailable 显示权限提示；
  - 写入抛错后表格回滚；
  - reset 恢复 22 类 seeds。

- [ ] **Step 6：覆盖桌面与窄屏**

  - 1440×900：外层无页面级纵向溢出，左右区独立滚动；
  - 768×900：左列表在上、表格在下，无页面级横向溢出；
  - 保存两张验证截图到现有 screenshots 输出目录，但不把临时图片加入提交，除非仓库既有流程明确跟踪它们。

- [ ] **Step 7：运行浏览器验证**

  Run: `npm run verify:enum-browser`

  Expected: PASS，输出 22 项、CRUD、权限、恢复、desktop、narrow 全部场景通过。

- [ ] **Step 8：提交浏览器验证**

  ```bash
  git add screenshots/verify-enum-config-browser.mjs scripts/verify-enum-config.mjs
  git diff --cached --check
  git commit -m "test: cover flat enum configuration browser flows"
  ```

## Task 11：四类项目端到端验收与历史快照验证

**Files:**

- Modify: `screenshots/verify-task5-enum-consumers-browser.mjs`
- Modify: `scripts/verify-project-info-matrix-refresh.mjs`
- Modify: `scripts/verify-technical-project.mjs`
- Modify: `scripts/verify-project-roadmap.mjs`

- [ ] **Step 1：建立四类项目浏览器场景**

  脚本每个场景开始时写入确定的 v2 `pms-enum-values` fixture，避免依赖人工本地数据：

  1. 整机 IPM 分类带出 PMS 分类和二级分类；
  2. tOS IPM 分类带出 `tOS版本项目`，页面不存在项目二级分类字段；
  3. 技术 IPM 分类带出 `技术项目`，页面不存在项目二级分类字段；
  4. 能力 IPM 分类带出 `能力建设项目`，页面不存在项目二级分类字段；
  5. 未映射 IPM 分类显示规定文案并阻止提交。

- [ ] **Step 2：覆盖芯片与 TMG 业务联动**

  - 选择同编码的第二个完整芯片 option，断言型号和平台对应同一行；
  - 切换 TMG 后旧子领域清空；
  - 选择唯一 `无` 的 TMG 后自动填充并禁用；
  - 删除所有当前领域子项后，新建技术项目显示维护指引并阻止提交。

- [ ] **Step 3：覆盖历史快照**

  - 先用 fixture 创建/加载一个项目，其字段值存在；
  - 再从配置 rows 删除对应单字段、芯片映射或 TMG 行；
  - 打开编辑页，断言旧值显示 `（已停用）`；
  - 不修改该字段保存成功；
  - 重新打开下拉，只能重新选择当前有效值。

- [ ] **Step 4：覆盖 tOS 前缀**

  - 首销版本和路标配置 fixture 包含 `18.preview`；
  - 新建/编辑项目和路标下拉都显示 `tOS18.preview`；
  - 已保存值为主体字符串，不出现 `tOStOS`；
  - 原 `16.0`、`16.0.1` 迁移 fixture 都可选择。

- [ ] **Step 5：运行端到端脚本**

  Run: `node screenshots/verify-task5-enum-consumers-browser.mjs`

  Expected: PASS，四类分类、芯片、TMG、历史快照、tOS 前缀五组场景均通过。

- [ ] **Step 6：提交业务浏览器验证**

  ```bash
  git add screenshots/verify-task5-enum-consumers-browser.mjs scripts/verify-project-info-matrix-refresh.mjs scripts/verify-technical-project.mjs scripts/verify-project-roadmap.mjs
  git diff --cached --check
  git commit -m "test: verify enum consumers across project types"
  ```

## Task 12：全量回归、人工视觉检查与交付自检

**Files:**

- Modify only if a failure exposes a task-related defect; stage only the exact repaired files.

- [ ] **Step 1：运行所有本功能纯验证**

  ```bash
  npm run verify:enum-config
  npm run verify:enum-consumers
  node scripts/verify-global-permission-matrix.mjs
  node scripts/verify-project-info-matrix-refresh.mjs
  npm run verify:machine-tos
  npm run verify:technical-project
  npm run verify:project-roadmap
  npm run verify:tos-project-status
  ```

  Expected: 全部 PASS，无 skipped 场景。

- [ ] **Step 2：运行相邻模块回归**

  ```bash
  npm run verify:project-summary
  npm run verify:project-list-matrix
  npm run verify:project-list-refinement
  npm run verify:project-role-sync
  ```

  Expected: 全部 PASS；若失败，先判断是否为本任务回归，不能修改无关用户代码来“消红”。

- [ ] **Step 3：运行静态与生产构建验证**

  ```bash
  npx tsc --noEmit
  npm run build
  ```

  Expected: TypeScript 0 errors；Next.js production build 成功。

- [ ] **Step 4：运行两个浏览器验证**

  在 dev server 运行期间执行：

  ```bash
  npm run verify:enum-browser
  node screenshots/verify-task5-enum-consumers-browser.mjs
  ```

  Expected: 全部 PASS。

- [ ] **Step 5：人工视觉与交互检查**

  在 1440×900 和窄屏各检查一次：

  - 22 项顺序、长中文名称、应用范围不截断到不可读；
  - 三种列宽合理，项目分类长值可读；
  - 序号连续；
  - 左右区域滚动不会带动整页异常跳动；
  - 弹窗字段标签、错误、loading、删除确认、焦点恢复正常；
  - 无权限用户没有可操作但不可见的图标；
  - 历史 `（已停用）` 标签清晰但不与正常项混淆。

- [ ] **Step 6：检查旧源和重复数据源已移除**

  Run:

  ```bash
  rg "tos-2-part|tos-3-part|TOS_ENUM_REGISTRY|SUBDOMAINS_BY_DOMAIN|IPM_PROJECT_CLASSIFICATION_MAP|useTosEnumOptions" src --glob '!src/stores/enums.ts'
  rg "tos-2-part|tos-3-part" src/stores/enums.ts
  rg "configCenter:enumEdit" src scripts
  ```

  Expected: 第一条无业务源码命中；第二条只命中 v1 → v2 迁移；第三条命中权限声明、默认矩阵、UI gate 和验证脚本。

- [ ] **Step 7：审阅提交范围**

  ```bash
  git status --short
  git diff --stat HEAD~11..HEAD
  git log --oneline -12
  ```

  Expected: 用户原有 dirty 文件仍保持原状；本功能提交只包含本计划声明的代码、验证和文档，没有临时截图、构建产物或本地存储文件。

- [ ] **Step 8：如有最终修复，单独提交**

  仅在前述验证发现本任务缺陷时执行：先用 `git diff -- <明确的缺陷文件路径>` 审核修复，再用同一组明确路径逐个 `git add`；禁止 `git add .`。随后运行 `git diff --cached --check` 并提交 `fix: complete enum configuration integration`。若没有缺陷，明确勾选为“无需最终修复”。

- [ ] **Step 9：交付说明**

  最终交付必须区分：

  - 已实现：22 类扁平配置、多结构 CRUD、权限、四类项目联动、历史快照、迁移；
  - 已验证：列出实际成功运行的命令和浏览器场景；
  - 未包含：数据库、后端/真实 IPM、导入导出、拖拽排序、批量编辑；
  - 本地状态：说明保留了哪些用户已有未提交改动，不把“本地可运行”描述成已部署。

---

## 完成定义

只有同时满足以下条件才可声明完成：

1. 配置页只显示 22 个固定配置项，顺序、名称、范围、结构完全匹配规格。
2. 每张表第一列序号连续自增，CRUD 以稳定行 ID 工作。
3. v1 的两类 tOS 本地配置成功迁移到 v2，不丢值；tOS 不再受两段/三段格式限制。
4. 项目分类完全读取配置映射；只有整机显示并要求二级分类。
5. 芯片编码选择原子带出型号和平台；同编码多行可区分。
6. TMG/子领域级联、唯一 `无` 自动选择和空配置阻断正确。
7. 其余 19 个单字段在其现有可编辑入口不再维护第二份运行时数组。
8. 配置删除不改写历史项目，旧值可见、标记已停用且可原样保存。
9. `configCenter:enumEdit` 的管理组/编辑组/查看组行为正确。
10. 纯验证、TypeScript、production build、桌面和窄屏浏览器验证全部通过。
