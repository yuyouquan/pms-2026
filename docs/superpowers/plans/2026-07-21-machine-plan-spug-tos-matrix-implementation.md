# 整机计划 SPUG 字段与 tOS 类型矩阵 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将整机计划信息收敛为已确认的七字段 Schema，使用异步 SPUG mock 驱动市场级编译字段，并把 tOS 类型编辑改造成与市场编辑共用骨架的横向矩阵。

**Architecture:** 新增无业务状态的 `DimensionMatrixEditor`，由市场和 tOS 两个包装组件分别提供字段行、维度列头和业务控件。市场级 `buildOption` / `buildMarket` 写入 `MarketConfigRow`，历史项目级值只对 `undefined` 的现有市场行做一次兼容回填；SPUG 枚举通过 provider 边界异步获取。tOS 计划规则继续留在 `tosTypeRules.ts`，只抽离编辑 UI 和草稿交互。

**Tech Stack:** Next.js 14、React 18、TypeScript、Ant Design 6、Zustand、Node 静态验证脚本、Puppeteer 聚焦 smoke

---

## 文件结构

- Create: `src/lib/spugBuildOptions.ts` — SPUG 编译选项 / 编译市场 provider 契约与异步 mock。
- Create: `src/components/project-info/DimensionMatrixEditor.tsx` — 市场和类型共用的无业务状态矩阵 Modal。
- Create: `src/components/project-info/TosTypeEditorModal.tsx` — tOS 类型草稿、增加、删除、主类型和跟随控件。
- Modify: `src/lib/marketRules.ts` — 增加两个市场级编译字段及历史项目级兼容回填。
- Modify: `src/constants/projectPlanInfoSchema.ts` — 七字段顺序、默认显示和可隐藏口径。
- Modify: `src/components/project-info/ProjectPlanInfoGrid.tsx` — 只渲染七字段 Schema，最多两行。
- Modify: `src/components/project-info/MarketEditorModal.tsx` — 使用公共矩阵、SPUG provider 和七项业务行。
- Modify: `src/containers/ProjectSpaceContainer.tsx` — 市场必填校验、兼容值、计划卡片传值及 tOS Modal 接线。
- Modify: `src/styles/globals.css` — 将市场专属矩阵样式提升为公共维度矩阵样式。
- Modify: `scripts/verify-market-build-config.mjs` — 市场级字段、SPUG mock、历史回填和市场矩阵静态契约。
- Modify: `scripts/verify-project-info-matrix-refresh.mjs` — 七字段展示 / 配置契约。
- Modify: `scripts/verify-tos-type-integration.mjs` — tOS 类型编辑从容器内联表格迁移到矩阵组件后的集成契约。

### Task 1: 市场级编译字段与 SPUG provider

**Files:**
- Create: `src/lib/spugBuildOptions.ts`
- Modify: `src/lib/marketRules.ts:5-25,236-266`
- Modify: `src/containers/ProjectSpaceContainer.tsx:446-457`
- Test: `scripts/verify-market-build-config.mjs`

- [ ] **Step 1: 扩展规则验证，使旧实现先失败**

在 `scripts/verify-market-build-config.mjs` 增加 provider 路径和以下断言；同时把 `fallback` 增加 `buildOption` / `buildMarket`：

```js
const spugProviderPath = 'src/lib/spugBuildOptions.ts'
const fallback = {
  buildOption: 'ko2_sl303',
  buildMarket: 'op',
  branchInfo: 'feature/global',
  jenkinsUrl: 'https://jenkins.example/job/global',
  buildAddress: 'https://build.example/global',
}

const spugModule = evaluateTypeScriptModule(spugProviderPath)
const spugOptions = await spugModule.mockSpugBuildOptionsProvider.load()
assert.deepEqual(JSON.parse(JSON.stringify(spugOptions.buildOptions)), [
  'ko2_sl303', 'ko2', 'a681l_sm386', 'lj8k_h781', 'lj8_h781', 'lj7_h782', 'x1103b',
])
assert.deepEqual(JSON.parse(JSON.stringify(spugOptions.buildMarkets)), ['op', 'tr'])

assert.equal(initialized[0].buildOption, fallback.buildOption)
assert.equal(initialized[1].buildMarket, fallback.buildMarket)
```

在 `preserved` 市场行加入 `buildOption: ''`、`buildMarket: undefined`，并断言显式空值保留、`undefined` 才回填：

```js
assert.equal(preserved.buildOption, '', 'an explicitly cleared build option must not be backfilled')
assert.equal(preserved.buildMarket, fallback.buildMarket, 'an undefined build market must use the project fallback')

const isolatedMarketValues = normalizeMarketRows([
  { id: 'market-OP', market: 'OP', isMain: true, followsMain: false, buildOption: 'ko2', buildMarket: 'op' },
  { id: 'market-TR', market: 'TR', isMain: false, followsMain: true, buildOption: 'x1103b', buildMarket: 'tr' },
])
assert.equal(isolatedMarketValues[0].buildOption, 'ko2')
assert.equal(isolatedMarketValues[1].buildOption, 'x1103b', 'follow markets must keep independent build attributes')
```

- [ ] **Step 2: 运行验证并确认失败**

Run: `node scripts/verify-market-build-config.mjs`

Expected: FAIL，首先报告 `src/lib/spugBuildOptions.ts` 不存在，或 `buildOption` 未回填。

- [ ] **Step 3: 新增 provider 边界**

创建 `src/lib/spugBuildOptions.ts`：

```ts
export interface SpugBuildOptions {
  buildOptions: string[]
  buildMarkets: string[]
}

export interface SpugBuildOptionsProvider {
  load: () => Promise<SpugBuildOptions>
}

export const MOCK_SPUG_BUILD_OPTIONS = [
  'ko2_sl303',
  'ko2',
  'a681l_sm386',
  'lj8k_h781',
  'lj8_h781',
  'lj7_h782',
  'x1103b',
]

export const MOCK_SPUG_BUILD_MARKETS = ['op', 'tr']

export const mockSpugBuildOptionsProvider: SpugBuildOptionsProvider = {
  async load() {
    return {
      buildOptions: [...MOCK_SPUG_BUILD_OPTIONS],
      buildMarkets: [...MOCK_SPUG_BUILD_MARKETS],
    }
  },
}
```

- [ ] **Step 4: 扩展市场行和兼容回填**

在 `MarketConfigRow` 增加：

```ts
buildOption?: string
buildMarket?: string
```

把 `LegacyMarketBuildConfig` 改为：

```ts
export type LegacyMarketBuildConfig = Pick<
  MarketConfigRow,
  'buildOption' | 'buildMarket' | 'branchInfo' | 'jenkinsUrl' | 'buildAddress'
>
```

在 `buildMarketRowsFromMarkets` 的历史回填映射中增加：

```ts
buildOption: row.buildOption === undefined ? (legacyBuildConfig.buildOption || '') : row.buildOption,
buildMarket: row.buildMarket === undefined ? (legacyBuildConfig.buildMarket || '') : row.buildMarket,
```

在 `ProjectSpaceContainer.tsx` 的 `legacyMarketBuildConfig` 增加：

```ts
buildOption: (selectedProject as any).buildOption,
buildMarket: (selectedProject as any).buildMarket,
```

- [ ] **Step 5: 运行规则验证**

Run: `node scripts/verify-market-build-config.mjs`

Expected: PASS，输出更新后的 assertion 数量。

- [ ] **Step 6: 提交规则层**

```bash
git add src/lib/spugBuildOptions.ts src/lib/marketRules.ts src/containers/ProjectSpaceContainer.tsx scripts/verify-market-build-config.mjs
git commit -m "feat: add SPUG-backed market build fields"
```

### Task 2: 七字段计划信息展示与配置

**Files:**
- Modify: `src/constants/projectPlanInfoSchema.ts`
- Modify: `src/components/project-info/ProjectPlanInfoGrid.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx:2792-2855`
- Test: `scripts/verify-project-info-matrix-refresh.mjs`

- [ ] **Step 1: 把验证口径改为七字段并确认旧实现失败**

将 `scripts/verify-project-info-matrix-refresh.mjs` 的计划字段断言改为：

```js
assert.deepEqual(Array.from(planSchemaModule.PROJECT_PLAN_INFO_FIELDS, field => field.key), [
  'buildOption',
  'buildMarket',
  'googleLaunchDate',
  'isMadaControlled',
  'isSimLocked',
  'isCancelPaused',
  'cancelPauseDate',
], 'plan fields must match the confirmed SPUG-backed order')
assert.deepEqual(
  Array.from(planSchemaModule.PROJECT_PLAN_INFO_FIELDS.filter(field => field.defaultVisible), field => field.key),
  ['googleLaunchDate', 'isMadaControlled', 'isSimLocked', 'isCancelPaused', 'cancelPauseDate'],
)
assert.deepEqual(
  Array.from(planSchemaModule.PROJECT_PLAN_INFO_FIELDS.filter(field => field.hideable), field => field.key),
  ['buildOption', 'buildMarket'],
)
assert.doesNotMatch(plan, /planStartDate|planEndDate|developCycle|isCarrierCustomized/)
assert.match(plan, /key:\s*'buildOption'[\s\S]*key:\s*'cancelPauseDate'/)
```

Run: `node scripts/verify-project-info-matrix-refresh.mjs`

Expected: FAIL，报告旧九字段顺序不符合新口径。

- [ ] **Step 2: 替换计划字段 Schema**

把 `PROJECT_PLAN_INFO_FIELDS` 完整替换为：

```ts
export const PROJECT_PLAN_INFO_FIELDS: ProjectVisibilityFieldDefinition[] = [
  { key: 'buildOption', label: '编译选项', defaultVisible: false, hideable: true },
  { key: 'buildMarket', label: '编译市场', defaultVisible: false, hideable: true },
  { key: 'googleLaunchDate', label: 'Google Launch Date', defaultVisible: true, hideable: false },
  { key: 'isMadaControlled', label: '是否MADA管控', defaultVisible: true, hideable: false },
  { key: 'isSimLocked', label: '是否锁卡', defaultVisible: true, hideable: false },
  { key: 'isCancelPaused', label: '是否取消暂停', defaultVisible: true, hideable: false },
  { key: 'cancelPauseDate', label: '取消暂停时间', defaultVisible: true, hideable: false },
]
```

- [ ] **Step 3: 收敛计划卡片组件**

将 `ProjectPlanInfoGridProps` 改为七字段入参：

```ts
export interface ProjectPlanInfoGridProps {
  visibleFieldKeys: string[]
  buildOption?: string
  buildMarket?: string
  googleLaunchDate?: string
  isMadaControlled?: string
  isSimLocked?: string
  isCancelPaused?: string
  cancelPauseDate?: string
}
```

`metrics` 必须严格按以下顺序构建；编译字段显示普通文本，五个默认字段保留日期 / Boolean Tag 样式：

```ts
const metrics: PlanMetric[] = [
  { key: 'buildOption', label: '编译选项', value: displayValue(buildOption), icon: <CodeOutlined /> },
  { key: 'buildMarket', label: '编译市场', value: displayValue(buildMarket), icon: <GlobalOutlined /> },
  { key: 'googleLaunchDate', label: 'Google Launch Date', value: displayValue(googleLaunchDate), icon: <CalendarOutlined />, tabular: true },
  { key: 'isMadaControlled', label: '是否MADA管控', value: displayBoolean(isMadaControlled), icon: <SafetyCertificateOutlined /> },
  { key: 'isSimLocked', label: '是否锁卡', value: displayBoolean(isSimLocked), icon: <LockOutlined /> },
  { key: 'isCancelPaused', label: '是否取消暂停', value: displayBoolean(isCancelPaused), icon: <PauseCircleOutlined /> },
  { key: 'cancelPauseDate', label: '取消暂停时间', value: displayValue(isCancelPaused === '是' ? cancelPauseDate : undefined), icon: <CalendarOutlined />, tabular: true },
].filter(metric => visibleFieldKeys.includes(metric.key))
```

继续使用 `getBalancedRows(metrics, 5, 2)`。

- [ ] **Step 4: 按市场行传入七字段值**

把 `renderWholeMachinePlanInfo` 中的 `ProjectPlanInfoGrid` 调用改为：

```tsx
<ProjectPlanInfoGrid
  visibleFieldKeys={visiblePlanInfoFieldKeys}
  buildOption={row.buildOption}
  buildMarket={row.buildMarket}
  googleLaunchDate={row.googleLaunchDate}
  isMadaControlled={row.isMadaControlled}
  isSimLocked={row.isSimLocked}
  isCancelPaused={row.isCancelPaused}
  cancelPauseDate={row.isCancelPaused === '是' ? row.cancelPauseDate : undefined}
/>
```

- [ ] **Step 5: 运行验证并提交**

Run: `node scripts/verify-project-info-matrix-refresh.mjs`

Expected: PASS，输出 `Project info matrix refresh verification passed.`

```bash
git add src/constants/projectPlanInfoSchema.ts src/components/project-info/ProjectPlanInfoGrid.tsx src/containers/ProjectSpaceContainer.tsx scripts/verify-project-info-matrix-refresh.mjs
git commit -m "feat: refresh machine plan information fields"
```

### Task 3: 公共维度矩阵与市场编辑

**Files:**
- Create: `src/components/project-info/DimensionMatrixEditor.tsx`
- Modify: `src/components/project-info/MarketEditorModal.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx:1233-1365,3795-3806`
- Modify: `src/styles/globals.css:2157-2233`
- Test: `scripts/verify-market-build-config.mjs`
- Test: `scripts/verify-project-info-matrix-refresh.mjs`

- [ ] **Step 1: 更新市场编辑静态契约并确认失败**

在 `scripts/verify-market-build-config.mjs` 读取公共矩阵源文件，并把旧分支 / Jenkins / 版本地址 UI 断言替换为：

```js
const dimensionMatrixPath = 'src/components/project-info/DimensionMatrixEditor.tsx'
const dimensionMatrixSource = fs.readFileSync(dimensionMatrixPath, 'utf8')
assert.match(dimensionMatrixSource, /dataIndex:\s*dimension\.id/)
assert.match(dimensionMatrixSource, /pms-dimension-matrix/)
assert.match(marketEditorSource, /DimensionMatrixEditor/)
assert.match(marketEditorSource, /key: 'buildOption', label: '编译选项'/)
assert.match(marketEditorSource, /key: 'buildMarket', label: '编译市场'/)
assert.match(marketEditorSource, /mockSpugBuildOptionsProvider/)
assert.match(marketEditorSource, /spugLoading/)
assert.match(marketEditorSource, /spugError/)
assert.match(marketEditorSource, /重新获取/)
assert.doesNotMatch(marketEditorSource, /key: 'isCarrierCustomized'|key: 'branchInfo'|key: 'jenkinsUrl'|key: 'buildAddress'/)
assert.match(projectSpaceSource, /请填写 \$\{missingBuildOptionRow\.market\} 市场的编译选项/)
assert.match(projectSpaceSource, /请填写 \$\{missingBuildMarketRow\.market\} 市场的编译市场/)
```

同时在 `scripts/verify-project-info-matrix-refresh.mjs` 增加：

```js
const dimensionMatrix = read('src/components/project-info/DimensionMatrixEditor.tsx')
assert.match(dimensionMatrix, /pms-dimension-matrix/)
assert.match(market, /DimensionMatrixEditor/)
assert.doesNotMatch(market, /isCarrierCustomized|branchInfo|jenkinsUrl|buildAddress/)
```

Run: `node scripts/verify-market-build-config.mjs`

Expected: FAIL，报告公共矩阵不存在或旧市场字段仍在编辑器中。

- [ ] **Step 2: 创建无业务状态矩阵组件**

创建 `DimensionMatrixEditor.tsx`，核心接口和列构建必须是：

```tsx
'use client'

import type { ReactNode } from 'react'
import { Button, Modal, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

export interface DimensionMatrixField {
  key: string
  label: ReactNode
}

export interface DimensionMatrixColumn {
  id: string
}

export interface DimensionMatrixEditorProps<
  Field extends DimensionMatrixField,
  Dimension extends DimensionMatrixColumn,
> {
  open: boolean
  title: ReactNode
  fields: readonly Field[]
  dimensions: Dimension[]
  toolbar: ReactNode
  notice?: ReactNode
  renderDimensionHeader: (dimension: Dimension) => ReactNode
  renderControl: (field: Field, dimension: Dimension) => ReactNode
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  saveDisabled?: boolean
  width?: number
  fieldColumnWidth?: number
  dimensionColumnWidth?: number
  className?: string
}

export default function DimensionMatrixEditor<
  Field extends DimensionMatrixField,
  Dimension extends DimensionMatrixColumn,
>({
  open, title, fields, dimensions, toolbar, notice,
  renderDimensionHeader, renderControl, onSave, onCancel,
  saving = false, saveDisabled = false, width = 1200,
  fieldColumnWidth = 168, dimensionColumnWidth = 228, className = '',
}: DimensionMatrixEditorProps<Field, Dimension>) {
  const columns: ColumnsType<Field> = [
    {
      title: '字段', dataIndex: 'label', key: 'label', fixed: 'left', width: fieldColumnWidth,
      render: label => <strong className="pms-dimension-matrix-field-label">{label}</strong>,
    },
    ...dimensions.map(dimension => ({
      title: renderDimensionHeader(dimension),
      dataIndex: dimension.id,
      key: dimension.id,
      width: dimensionColumnWidth,
      render: (_value: unknown, field: Field) => renderControl(field, dimension),
    })),
  ]

  return (
    <Modal
      className={`pms-modal pms-dimension-matrix-modal ${className}`.trim()}
      title={title}
      open={open}
      onCancel={onCancel}
      width={width}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={saving}>取消</Button>,
        <Button key="save" type="primary" onClick={onSave} loading={saving} disabled={saveDisabled}>保存</Button>,
      ]}
    >
      {notice}
      <div className="pms-dimension-matrix-toolbar"><Space wrap>{toolbar}</Space></div>
      <Table<Field>
        className="pms-dimension-matrix"
        rowKey="key"
        bordered
        size="small"
        pagination={false}
        dataSource={[...fields]}
        columns={columns}
        scroll={{ x: fieldColumnWidth + dimensions.length * dimensionColumnWidth }}
      />
    </Modal>
  )
}
```

- [ ] **Step 3: 将市场编辑包装到公共矩阵**

把 `MARKET_MATRIX_FIELDS` 改为结构行加七项业务行：

```ts
const MARKET_MATRIX_FIELDS = [
  { key: 'isMain', label: '主市场' },
  { key: 'followsMain', label: '跟随主市场' },
  { key: 'buildOption', label: '编译选项' },
  { key: 'buildMarket', label: '编译市场' },
  { key: 'googleLaunchDate', label: 'Google Launch Date' },
  { key: 'isMadaControlled', label: '是否 MADA 管控' },
  { key: 'isSimLocked', label: '是否锁卡' },
  { key: 'isCancelPaused', label: '是否取消暂停' },
  { key: 'cancelPauseDate', label: '取消暂停时间' },
] as const
```

新增市场初始化值必须包含：

```ts
buildOption: '',
buildMarket: '',
```

在 props 中增加可替换 provider：

```ts
spugProvider?: SpugBuildOptionsProvider
```

默认解构为 `spugProvider = mockSpugBuildOptionsProvider`。组件打开时用以下 effect 获取枚举；加载失败保存错误文本，并通过 `重新获取` 按钮执行 `setSpugRetryKey(value => value + 1)`：

```ts
useEffect(() => {
  if (!open) return
  let active = true
  setSpugLoading(true)
  setSpugError('')
  void spugProvider.load()
    .then(options => {
      if (active) setSpugOptions(options)
    })
    .catch(() => {
      if (active) setSpugError('SPUG 枚举获取失败，请重新获取')
    })
    .finally(() => {
      if (active) setSpugLoading(false)
    })
  return () => { active = false }
}, [open, spugProvider, spugRetryKey])
```

两个字段使用受控 Select：

```tsx
case 'buildOption':
  return <Select value={row.buildOption || undefined} placeholder="请选择编译选项" loading={spugLoading} disabled={!!spugError} options={spugOptions.buildOptions.map(value => ({ label: value, value }))} onChange={value => updateRow(row.id, { buildOption: value })} />
case 'buildMarket':
  return <Select value={row.buildMarket || undefined} placeholder="请选择编译市场" loading={spugLoading} disabled={!!spugError} options={spugOptions.buildMarkets.map(value => ({ label: value, value }))} onChange={value => updateRow(row.id, { buildMarket: value })} />
```

使用 `DimensionMatrixEditor` 渲染 Modal；市场 wrapper 继续负责主市场修订 Alert、市场选择器、主市场删除禁用及七项控件。

- [ ] **Step 4: 增加保存必填校验**

在取消暂停时间校验之前增加：

```ts
const missingBuildOptionRow = normalizedRows.find(row => !row.buildOption?.trim())
if (missingBuildOptionRow) {
  message.error(`请填写 ${missingBuildOptionRow.market} 市场的编译选项`)
  return
}
const missingBuildMarketRow = normalizedRows.find(row => !row.buildMarket?.trim())
if (missingBuildMarketRow) {
  message.error(`请填写 ${missingBuildMarketRow.market} 市场的编译市场`)
  return
}
```

- [ ] **Step 5: 把矩阵 CSS 提升为公共类名**

将 `.pms-market-matrix-*` 选择器统一改为 `.pms-dimension-matrix-*`，表格主体使用 `.pms-dimension-matrix`；列头使用 `.pms-dimension-matrix-header`。保留 640px 下工具栏纵向排列，市场和类型不得各自复制一套表格样式。

- [ ] **Step 6: 运行市场和计划验证并提交**

Run:

```bash
node scripts/verify-market-build-config.mjs
node scripts/verify-project-info-matrix-refresh.mjs
```

Expected: 两条命令均 PASS。

```bash
git add src/components/project-info/DimensionMatrixEditor.tsx src/components/project-info/MarketEditorModal.tsx src/containers/ProjectSpaceContainer.tsx src/styles/globals.css scripts/verify-market-build-config.mjs scripts/verify-project-info-matrix-refresh.mjs
git commit -m "feat: unify market editing on dimension matrix"
```

### Task 4: tOS 类型矩阵与容器接线

**Files:**
- Create: `src/components/project-info/TosTypeEditorModal.tsx`
- Modify: `src/containers/ProjectSpaceContainer.tsx:1130-1200,3804-3895`
- Modify: `scripts/verify-tos-type-integration.mjs`
- Test: `scripts/verify-tos-type-rules.mjs`

- [ ] **Step 1: 将集成契约指向独立类型矩阵并确认失败**

从 `verify-tos-type-integration.mjs` 删除以下容器内联表格专属检查项：

```js
['src/containers/ProjectSpaceContainer.tsx', 'TOS_TYPE_OPTIONS'],
['src/containers/ProjectSpaceContainer.tsx', '是否主类型'],
['src/containers/ProjectSpaceContainer.tsx', '跟随主类型计划'],
['src/containers/ProjectSpaceContainer.tsx', 'checked={!record.isMain && record.followsMain}'],
['src/containers/ProjectSpaceContainer.tsx', 'normalizeTosTypeRows(nextRows, previousMainType)'],
['src/containers/ProjectSpaceContainer.tsx', 'normalizeTosTypeRows(filtered, previousMainType)'],
```

在原 `required` 数组中增加以下检查项，其他原有检查项原样保留：

```js
['src/containers/ProjectSpaceContainer.tsx', '<TosTypeEditorModal'],
['src/containers/ProjectSpaceContainer.tsx', 'rows={tosTypeDraftRows}'],
['src/components/project-info/TosTypeEditorModal.tsx', 'DimensionMatrixEditor'],
['src/components/project-info/TosTypeEditorModal.tsx', "{ key: 'isMain', label: '主类型' }"],
['src/components/project-info/TosTypeEditorModal.tsx', "{ key: 'followsMain', label: '跟随主类型' }"],
['src/components/project-info/TosTypeEditorModal.tsx', 'targetRow?.isMain'],
['src/components/project-info/TosTypeEditorModal.tsx', '请先指定其他主类型后再删除'],
['src/components/project-info/TosTypeEditorModal.tsx', 'normalizeTosTypeRows(nextRows, previousMainType)'],
```

Run: `node scripts/verify-tos-type-integration.mjs`

Expected: FAIL，报告 `TosTypeEditorModal.tsx` 不存在。

- [ ] **Step 2: 创建 tOS 类型包装组件**

创建 `TosTypeEditorModal.tsx`，定义两行矩阵字段：

```ts
const TOS_TYPE_MATRIX_FIELDS = [
  { key: 'isMain', label: '主类型' },
  { key: 'followsMain', label: '跟随主类型' },
] as const
```

组件 props：

```ts
export interface TosTypeEditorModalProps {
  open: boolean
  rows: TosTypeConfigRow[]
  canEdit: boolean
  onChange: (rows: TosTypeConfigRow[]) => void
  onSave: () => void
  onCancel: () => void
}
```

候选类型只包含尚未配置的值，并在候选变化时保持有效选择：

```ts
const [selectedType, setSelectedType] = useState<TosPlanType>()
const availableTypes = useMemo(() => TOS_TYPE_OPTIONS.filter(type => (
  !rows.some(row => row.type === type)
)), [rows])

useEffect(() => {
  if (!availableTypes.length) {
    setSelectedType(undefined)
    return
  }
  if (!selectedType || !availableTypes.includes(selectedType)) {
    setSelectedType(availableTypes[0])
  }
}, [availableTypes, selectedType])
```

更新、增加和删除必须使用以下规则：

```ts
const updateRow = (rowId: string, patch: Partial<TosTypeConfigRow>) => {
  const previousMainType = getMainTosType(rows)
  const nextRows = rows.map(row => ({ ...row }))
  const targetRow = nextRows.find(row => row.id === rowId)
  if (!targetRow) return
  if (patch.followsMain !== undefined && !targetRow.isMain) targetRow.followsMain = patch.followsMain
  if (patch.isMain) {
    nextRows.forEach(row => { row.isMain = row.id === rowId })
    targetRow.followsMain = false
  }
  onChange(normalizeTosTypeRows(nextRows, previousMainType))
}

const addType = () => {
  if (!selectedType) return
  const previousMainType = getMainTosType(rows)
  onChange(normalizeTosTypeRows([
    ...rows,
    { id: `tos-type-${Date.now()}-${selectedType}`, type: selectedType, isMain: rows.length === 0, followsMain: false },
  ], previousMainType))
}

const removeType = (rowId: string) => {
  const targetRow = rows.find(row => row.id === rowId)
  if (rows.length <= 1 || targetRow?.isMain) return
  onChange(normalizeTosTypeRows(rows.filter(row => row.id !== rowId), getMainTosType(rows)))
}
```

类型作为 `dimensions`，列头显示类型名、主类型 Tag 和删除按钮；主类型 Tooltip 为“请先指定其他主类型后再删除”。主类型行使用 Radio，跟随行使用 Checkbox 且主类型禁用。

调用公共矩阵时使用 `saveDisabled={!canEdit || rows.length === 0}`，保证无权限和空配置都不能保存。

- [ ] **Step 3: 从巨型容器移除类型 UI 细节并接线**

删除 `updateTosTypeDraftRow`、`addTosTypeDraftRow`、`removeTosTypeDraftRow` 和内联 `<Modal><Table ... /></Modal>`；保留 `openTosTypeEditor`、`saveTosTypeConfig` 和草稿 state。新增：

```tsx
<TosTypeEditorModal
  open={showTosTypeEditor}
  rows={tosTypeDraftRows}
  canEdit={canEditBasicInfo}
  onChange={setTosTypeDraftRows}
  onSave={saveTosTypeConfig}
  onCancel={() => setShowTosTypeEditor(false)}
/>
```

清理只为旧内联 Modal 服务且项目其他位置未使用的 Ant Design / icon import。

- [ ] **Step 4: 运行 tOS 规则和集成验证**

Run:

```bash
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
```

Expected: 两条命令均 PASS；既有一级计划跟随、不可修订、二级计划独立断言不变。

- [ ] **Step 5: 提交 tOS 矩阵**

```bash
git add src/components/project-info/TosTypeEditorModal.tsx src/containers/ProjectSpaceContainer.tsx scripts/verify-tos-type-integration.mjs
git commit -m "feat: align tOS type editing with market matrix"
```

### Task 5: 工程门禁与聚焦浏览器验证

**Files:**
- Modify only if a gate exposes a defect in the files already listed above.
- Verify: `screenshots/smoke-tos-type-plan.mjs`

- [ ] **Step 1: 运行聚焦规则验证**

Run:

```bash
node scripts/verify-market-build-config.mjs
node scripts/verify-project-info-matrix-refresh.mjs
node scripts/verify-tos-type-rules.mjs
node scripts/verify-tos-type-integration.mjs
```

Expected: 四条命令均 PASS。

- [ ] **Step 2: 运行 TypeScript 和生产构建**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: TypeScript 零错误；Next.js production build 成功生成页面。

- [ ] **Step 3: 启动本地服务并执行 tOS 既有 smoke**

Run: `npm run dev`

在另一个终端运行：

```bash
PMS_BASE_URL=http://127.0.0.1:3000 node screenshots/smoke-tos-type-plan.mjs
```

如果 dev server 使用其他端口，用终端输出的实际 URL 替换 `PMS_BASE_URL`。

Expected: 输出 `tOS type plan smoke passed.`。

- [ ] **Step 4: 浏览器聚焦检查整机市场编辑**

在整机项目基础信息页完成以下路径：

1. 默认计划信息只显示 Google Launch Date、是否MADA管控、是否锁卡、是否取消暂停、取消暂停时间。
2. 配置字段抽屉只能切换编译选项、编译市场；开启后计划信息仍不超过两行。
3. 市场编辑以市场为列，业务行只有七项；SPUG 下拉包含设计中的 mock 值。
4. 清空任一市场的编译选项或编译市场，保存时显示该市场的必填提示。
5. 是否取消暂停为“是”但日期为空时保存失败；改为“否”后日期清空。

- [ ] **Step 5: 浏览器聚焦检查 tOS 类型编辑**

在 tOS 项目基础信息和计划模块分别打开类型编辑，确认两处是同一个矩阵：

1. Full / Slim / PAD / GO 作为列，左侧只有主类型、跟随主类型。
2. 主类型删除按钮禁用；切换主类型后，原主类型可删除。
3. 切换主类型清空已有跟随关系；主类型自身不能勾选跟随。
4. 跟随类型仍不能发起一级计划修订，二级计划仍可独立维护。

- [ ] **Step 6: 检查工作区和提交最终修复**

Run:

```bash
git diff --check
git status --short
git log --oneline -6
```

Expected: `git diff --check` 无输出；不存在未说明的文件。如果验证修复产生改动：

```bash
git add src scripts screenshots
git commit -m "fix: close matrix editor verification gaps"
```
