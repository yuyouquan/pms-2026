# 项目路标视图 · 快照对比功能设计

- **日期**: 2026-04-10
- **作用域**: `src/components/roadmap/MilestoneView.tsx`（里程碑视图）+ `src/components/roadmap/utils.ts`
- **不动**: MR 火车视图、快照数据结构、mock 数据

## 1. 背景与目标

当前里程碑视图已支持"创建基线快照"与"切换到某个历史快照查看"，但无法在两个版本之间观察差异。用户希望能够选择两个版本（实时数据或任意历史快照）进行两两对比，快速识别里程碑计划的变动、项目行的新增/删除以及基础字段的修改。

**目标**：在里程碑视图内增加"对比模式"，以单表格内联染色的形式展示差异，并给出顶部摘要条。

**非目标**：

- 导出对比结果
- 对比历史记录持久化
- 三方或多方对比
- 字段级 diff 白名单配置
- 跨 `projectType` 对比
- MR 火车视图的对比

## 2. 功能规格

### 2.1 对比对象

用户可在"实时数据"与"任意历史快照"之间任选两个作为基准（旧）与对比（新）。两者必须不同，且必须属于当前 `projectType` 的快照集合（由入口选择器天然过滤保证）。

### 2.2 对比维度

全字段对比：

- **行级**：识别新增 / 删除项目行
- **里程碑日期**：识别日期前移、后移、新增/删除里程碑列
- **基础字段**：状态、产品线、芯片平台、tOS 版本等
- **产品上市日期**（整机项目）：作为普通字段参与

### 2.3 展示形式

**单表格内联染色** + **顶部摘要条**，沿用现有列设置与筛选能力。

### 2.4 入口

工具栏在"快照"按钮右侧新增 `对比` 按钮；点击弹出小 Modal，选择基准和对比版本后进入对比模式。

## 3. 状态模型

在 `MilestoneView` 现有状态附近新增：

```ts
type CompareSource = 'live' | string  // 'live' 或 snapshotId

const [compareMode, setCompareMode] = useState(false)
const [compareBase, setCompareBase] = useState<CompareSource>('live')
const [compareTarget, setCompareTarget] = useState<CompareSource>('live')
const [onlyDiffRows, setOnlyDiffRows] = useState(true)
const [showCompareModal, setShowCompareModal] = useState(false)
```

**三种显示态互斥**：实时数据 / 单快照查看 / 对比模式。进入对比模式时强制 `setActiveSnapshotId(null)`。

**副作用**：

- 切换 `projectType` → 退出对比模式
- 监听 `baselineSnapshots`，若 `compareBase` 或 `compareTarget` 指向的快照被删除 → 退出对比模式 + `message.info('所选快照已被删除，已退出对比')`
- `compareMode` 或其依赖变化导致 `displayData` 改变 → `setCurrentPage(1)`

## 4. Diff 算法

在 `src/components/roadmap/utils.ts` 新增纯函数和类型：

```ts
export type CellDiff =
  | { kind: 'same' }
  | { kind: 'added' }
  | { kind: 'removed' }
  | { kind: 'changed', oldVal: any, newVal: any }
  | { kind: 'dateEarlier', oldVal: string, newVal: string, days: number }
  | { kind: 'dateLater',   oldVal: string, newVal: string, days: number }
  | { kind: 'colAddedOnly' }
  | { kind: 'colRemovedOnly' }

export interface DiffRow {
  rowKey: string
  rowStatus: 'added' | 'removed' | 'modified' | 'same'
  base?: any
  target?: any
  cellDiffs: Record<string, CellDiff>
}

export interface DiffResult {
  rows: DiffRow[]
  mergedMilestones: { name: string; order: number; onlyIn?: 'base' | 'target' }[]
  summary: { added: number; removed: number; modified: number; cellChanges: number }
}

export function diffSnapshots(
  base:   { data: any[]; milestones: { name: string; order: number }[] },
  target: { data: any[]; milestones: { name: string; order: number }[] },
  projectType: string,
): DiffResult
```

**行对齐键**：`rowKey = projectId + '::' + (market ?? '')`（整机项目 market 区分；其他项目 market 为空串兜底）。

**算法步骤**：

1. 构造 `baseMap` / `targetMap`（以 `rowKey` 索引）
2. 遍历并集得到所有行：
   - 只在 `base` → `removed`
   - 只在 `target` → `added`
   - 两边都有 → 逐字段 diff，若有任何非 `same` → `modified`，否则 `same`
3. 里程碑并集：按两边 milestones 的 `name` 合并，按 `order` 排序（以 target 优先），只在一侧存在的列加 `onlyIn` 标记
4. 字段级 diff（仅对两边都存在的行执行）：
   - 基础字段（`status` / `productLine` / `chipPlatform` / `tosVersion` 等）：字符串不等 → `changed`
   - 里程碑列 `ms_xxx` 与 `launchDate`：尝试 `new Date(val)` 解析；
     - 解析成功且 `newTime < oldTime` → `dateEarlier`，`days = round((oldTime - newTime) / 86400000)`
     - 解析成功且 `newTime > oldTime` → `dateLater`
     - 解析成功且相等 → `same`
     - 解析失败或 `'-'` → 按普通 `changed` 处理（非空字符串不等时）
   - 只在一侧存在的里程碑列：该列上所有行标 `colAddedOnly` / `colRemovedOnly`
5. `summary` 累计 `added` / `removed` / `modified` 行数及总 `cellChanges` 数

**列构建辅助函数**（也放 utils.ts）：

```ts
export function buildCompareColumns(
  diffResult: DiffResult,
  visibleColumns: string[],
  projectType: string,
  onViewProject: (projectId: string, market?: string) => void,
): ColumnsType<DiffRow>
```

该函数复用 `getFixedColumnsForType` 获取固定列配置，对每个单元格统一走 `renderDiffCell(field, row)`（见下节）。

## 5. 渲染规范

### 5.1 行级底色（`rowClassName`）

| rowStatus | 背景 | 左边框 | 文字 |
|---|---|---|---|
| `added`    | `#f0fdf4` | `3px solid #22c55e` | 正常 |
| `removed`  | `#fef2f2` | `3px solid #ef4444` | 灰色 + 删除线 |
| `modified` | 白 | 无 | 正常 |
| `same`     | 白 | 无 | 正常（仅在 `onlyDiffRows=false` 时出现）|

### 5.2 单元格渲染

| CellDiff | 背景 | 内容 |
|---|---|---|
| `same`       | 无 | 显示 `target.value`（removed 行显示 `base.value`）|
| `added` / `removed` | 无 | 显示本侧值（靠行底色区分）|
| `changed`    | `#fffbeb`（橙）| `<del>{oldVal}</del> → <strong>{newVal}</strong>` |
| `dateEarlier`| `#eff6ff`（蓝）| `{oldVal} → {newVal}`，Tooltip：`提前 {days} 天` |
| `dateLater`  | `#fef2f2`（红）| `{oldVal} → {newVal}`，Tooltip：`延后 {days} 天` |

- 里程碑列宽在对比模式下由 120 → 150
- 单元格文字 `font-size: 11`
- `colAddedOnly` / `colRemovedOnly` 的列整体：列头加 `<Tag>新增</Tag>` / `<Tag>已删</Tag>`，已删列文字置灰

### 5.3 操作列

对比模式下"查看/记录"按钮仍显示，点击使用 `row.target?.projectId ?? row.base.projectId`（removed 行也可点击跳到实时详情）。

### 5.4 无差异空态

若 `onlyDiffRows=true` 且过滤后 `rows.length === 0` → `<Empty description="两个版本无差异" />`。

## 6. 交互细节

### 6.1 工具栏"对比"按钮

放在现有"快照"按钮右侧、快照选择下拉左侧：

```tsx
<Button icon={<SwapOutlined/>} size="small" onClick={() => setShowCompareModal(true)}
        disabled={currentSnapshots.length === 0}
        type={compareMode ? 'primary' : 'default'} ghost={compareMode}>
  {compareMode ? '对比中' : '对比'}
</Button>
```

- 无快照时禁用，Tooltip：`请先至少创建一个快照`
- 进入对比模式后视觉为 primary ghost

### 6.2 对比入口 Modal

- 标题：`选择要对比的两个版本`
- 字段：
  - **基准版本（旧）**：Select，选项 = `实时数据` + `currentSnapshots`
  - **对比版本（新）**：Select，选项同上
- 校验：二者不能相同 → `message.warning('请选择两个不同的版本')`
- 确认：
  ```ts
  setCompareMode(true)
  setActiveSnapshotId(null)
  setShowCompareModal(false)
  setCurrentPage(1)
  ```
- "切换版本"从摘要条再次打开时，预填当前 `compareBase` / `compareTarget`

### 6.3 对比摘要条

在 compareMode 下替代原"快照提示条"：

```
[⇄ 对比模式]  基准: 实时数据  →  对比: 20260408-143022
  🟢 新增 2 行   🔴 删除 1 行   🟠 修改 5 行 (共 12 处字段变化)
  [☑ 只看有差异的行]               [切换版本] [退出对比]
```

- 背景：`linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)`（与单快照提示条的蓝紫渐变区分）
- 摘要数字取自 `diffResult.summary`
- 版本显示：`'live'` 显示为 `实时数据`；快照 id 显示为其 `version` 字符串
- `只看有差异的行` Checkbox 双向绑定 `onlyDiffRows`（默认 true）
- `切换版本` 打开入口 Modal（预填当前选择）
- `退出对比` → `setCompareMode(false)`

### 6.4 互斥行为

进入对比模式时：

- 现有"快照选择下拉"**隐藏**
- "创建快照"按钮**禁用**，Tooltip：`对比模式下不可创建快照`

退出对比模式时：恢复原样。

### 6.5 筛选 / 列设置 / 分页

- **筛选**：对 `diffResult.rows` 生效，先筛选再过滤无差异行
- **列设置**：对比模式下仍生效（隐藏的列不渲染但仍计入 summary）
- **分页**：`displayData` 变化时 `setCurrentPage(1)`

## 7. 数据流总览

```
compareMode = false
└── 现有逻辑：displayData = activeSnapshot ? snapshot.data : tableData
            displayColumns = 现有 columns / snapshot columns

compareMode = true
└── resolvedBase   = compareBase  === 'live' ? { data: tableData, milestones } : snapshots[compareBase]
    resolvedTarget = compareTarget === 'live' ? { data: tableData, milestones } : snapshots[compareTarget]
    diffResult     = diffSnapshots(resolvedBase, resolvedTarget, projectType)
    filteredRows   = applyFilters(diffResult.rows)
    finalRows      = onlyDiffRows ? filteredRows.filter(r => r.rowStatus !== 'same') : filteredRows
    displayData    = finalRows
    displayColumns = buildCompareColumns(diffResult, visibleColumns, projectType, onViewProject)
```

## 8. 边界与降级

1. **快照被删**：副作用监听，自动退出对比模式
2. **projectType 切换**：自动退出对比模式
3. **两侧完全一致**：`onlyDiffRows=true` 时空态；`false` 时正常渲染所有行为 `same`
4. **milestones 同名不同 order**：以 target 的 order 为准
5. **日期解析失败**：降级为普通 `changed` 或 `same`，不计算天数
6. **全屏模式**：对比模式正常工作
7. **rowKey 兜底**：`projectId + '::' + (market ?? '')`

## 9. 改动清单

### 9.1 `src/components/roadmap/utils.ts`（+约 150 行）

- 新增类型：`CellDiff`、`DiffRow`、`DiffResult`
- 新增函数：`diffSnapshots(base, target, projectType): DiffResult`
- 新增函数：`buildCompareColumns(diffResult, visibleColumns, projectType, onViewProject): ColumnsType`

### 9.2 `src/components/roadmap/MilestoneView.tsx`（+约 200 行）

- 新增 5 个状态（见第 3 节）
- 新增 `useMemo` 计算 `diffResult` 和 `finalRows`
- `displayData` / `displayColumns` / `displayMilestones` 增加 `compareMode` 分支
- 工具栏：新增"对比"按钮；`compareMode` 下隐藏快照下拉、禁用创建快照
- 新增"对比入口 Modal"
- 新增"对比摘要条"组件块
- `Table` 增加 `rowClassName` 处理对比行底色
- 副作用：快照被删自动退出、projectType 切换自动退出
- 引入 `SwapOutlined` 图标

### 9.3 `src/styles/globals.css`（+约 20 行）

```css
.pms-table .row-diff-added    { background: #f0fdf4; box-shadow: inset 3px 0 0 #22c55e; }
.pms-table .row-diff-removed  { background: #fef2f2; box-shadow: inset 3px 0 0 #ef4444; color: #9ca3af; text-decoration: line-through; }
.pms-table .row-diff-modified { background: #fff; }
```

### 9.4 不需要改动

- `RoadmapView.tsx`
- `MRTrainView.tsx`
- mock 数据

## 10. 测试 / 验证点

手动验证（mock 环境）：

- [ ] 无快照时"对比"按钮禁用
- [ ] 创建两个快照后，对比两个快照，可见新增/删除/修改行
- [ ] 对比"实时 vs 快照"，修改某行数据后应能看到 `modified`
- [ ] 里程碑日期前移后移分别显示蓝/红底色与 Tooltip 天数
- [ ] 只在一侧存在的里程碑列显示 `新增` / `已删` Tag
- [ ] `只看有差异的行` 切换正常，两版本一致时显示空态
- [ ] 筛选 + 对比叠加工作正常
- [ ] 列设置隐藏某列后，该列不显示但 summary 数字不变
- [ ] 删除正在对比的快照 → 自动退出对比模式
- [ ] 切换 projectType → 自动退出对比模式
- [ ] 全屏模式下对比模式正常
- [ ] 对比模式下"查看/记录"按钮可用（含 removed 行）
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过

## 11. 明确不做（YAGNI）

- 导出对比结果为 Excel/PDF
- 对比历史记录持久化
- 三方或多方对比
- 字段级 diff 白名单配置
- 为对比模式单独建组件文件
