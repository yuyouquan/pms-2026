# 项目路标视图与项目空间计划管理 Excel 导出实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在项目路标视图（里程碑视图、MR 版本火车视图）与项目空间计划管理（竖版表格、横版表格）新增 Excel 导出能力。

**Architecture:** 新增一个共享工具 `src/utils/exportExcel.ts`（基于 SheetJS `xlsx` 库），暴露扁平导出 `exportSheet` 与带合并表头导出 `exportMergedSheet`。四个接入点通过统一的 `<Dropdown>` 按钮触发，下拉提供"导出当前视图 / 导出全部"两个选项；甘特图模式下条件隐藏。

**Tech Stack:** Next.js 14, React 18, TypeScript, Ant Design 6, dayjs（已在依赖中）, xlsx 0.18.5（本计划新增）。

**Spec:** `docs/superpowers/specs/2026-04-10-plan-view-excel-export-design.md`

**重要说明：此项目没有单元测试基础设施（spec 已明确），每个任务的验证步骤是：**
1. `npx tsc --noEmit` 类型检查通过
2. 浏览器手动验证（步骤中给出）
3. 功能验证通过后 commit

---

## File Structure

**新增：**
- `src/utils/exportExcel.ts` — 通用 Excel 导出工具（扁平 + 合并表头两种模式）

**修改：**
- `package.json` — 新增 `xlsx` 依赖
- `src/components/roadmap/MilestoneView.tsx` — 在工具栏 `toolbarActions` 内（约 L508）添加导出 `Dropdown`；新增 `handleExport` 函数
- `src/components/roadmap/MRTrainView.tsx` — 在 `<Tabs>` 行右侧新增工具栏容器，放置导出 `Dropdown`；新增 `handleExport` 函数
- `src/app/page.tsx` — 在项目空间工具栏 `<Space size={6}>` 内（约 L3140）添加导出 `Dropdown`；新增 `handleExportVerticalPlan`、`handleExportHorizontalPlan` 两个函数；甘特图模式下条件隐藏

---

## Task 1: 安装 xlsx 依赖并创建扁平导出工具

**Files:**
- Modify: `package.json`
- Create: `src/utils/exportExcel.ts`

- [ ] **Step 1: 安装 xlsx 依赖**

Run:
```bash
npm install xlsx@0.18.5
```

Expected: `package.json` 的 `dependencies` 下新增 `"xlsx": "^0.18.5"`，`package-lock.json` 更新。

- [ ] **Step 2: 创建 `src/utils/exportExcel.ts`**

Create file with content:

```ts
import * as XLSX from 'xlsx'
import { message } from 'antd'
import dayjs from 'dayjs'

export interface ExportColumn {
  /** 数据字段 key */
  key: string
  /** 表头文本 */
  title: string
  /** 列宽（字符数），未指定时自动计算 */
  width?: number
  /** 单元格值格式化函数 */
  formatter?: (value: any, row: any) => string | number
}

/**
 * 导出扁平表格为 xlsx 文件。
 * - 空数据时给出 warning 并中止
 * - 自动列宽：max(title.length, 前 100 行字符长度) * 1.2，上限 40
 * - 空值统一输出 '-'
 */
export function exportSheet(
  rows: any[],
  columns: ExportColumn[],
  filename: string,
  sheetName: string = 'Sheet1',
): void {
  if (!rows || rows.length === 0) {
    message.warning('暂无可导出数据')
    return
  }
  try {
    const header = columns.map(c => c.title)
    const body = rows.map(row =>
      columns.map(col => {
        const raw = row[col.key]
        const val = col.formatter ? col.formatter(raw, row) : raw
        if (val === undefined || val === null || val === '') return '-'
        return val
      }),
    )
    const aoa: (string | number)[][] = [header, ...body]
    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // 自动列宽
    const sample = body.slice(0, 100)
    ws['!cols'] = columns.map((col, ci) => {
      if (col.width) return { wch: col.width }
      let maxLen = strWidth(col.title)
      for (const row of sample) {
        maxLen = Math.max(maxLen, strWidth(String(row[ci] ?? '')))
      }
      return { wch: Math.min(40, Math.ceil(maxLen * 1.2) + 2) }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    message.success(`已导出 ${filename}`)
  } catch (err) {
    console.error('[exportSheet] failed', err)
    message.error('导出失败，请重试')
  }
}

/** 生成带时间戳的文件名后缀 */
export function exportTimestamp(): string {
  return dayjs().format('YYYYMMDD_HHmm')
}

/** 估算字符显示宽度（中文算 2，其他算 1） */
function strWidth(s: string): number {
  let n = 0
  for (const ch of s) {
    n += /[\u4e00-\u9fff\uff00-\uffef]/.test(ch) ? 2 : 1
  }
  return n
}
```

- [ ] **Step 3: 类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/utils/exportExcel.ts
git commit -m "$(cat <<'EOF'
feat(export): add xlsx dependency and exportSheet utility

Create src/utils/exportExcel.ts with exportSheet for flat tables.
Supports auto column width, empty-value placeholders, and error handling.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 扩展工具，支持合并表头导出（用于横版表格）

**Files:**
- Modify: `src/utils/exportExcel.ts`

- [ ] **Step 1: 追加 `exportMergedSheet` 函数**

在 `src/utils/exportExcel.ts` 的 `exportSheet` 函数之后、`exportTimestamp` 之前插入：

```ts
/**
 * 导出带合并单元格（分组表头）的 xlsx 文件。
 * 用于横版表格：第 1 行阶段分组 colSpan，第 2 行里程碑；
 * "版本"、"开发周期"列跨两行 rowSpan。
 *
 * @param headerMatrix 二维表头：null 表示被合并单元格覆盖的格子
 * @param merges SheetJS merges 列表
 * @param dataMatrix 二维数据区
 * @param colWidths 每列宽度（字符数）
 */
export function exportMergedSheet(
  headerMatrix: (string | null)[][],
  merges: XLSX.Range[],
  dataMatrix: (string | number)[][],
  colWidths: number[],
  filename: string,
  sheetName: string = 'Sheet1',
): void {
  if (!dataMatrix || dataMatrix.length === 0) {
    message.warning('暂无可导出数据')
    return
  }
  try {
    const aoa = [
      ...headerMatrix.map(row => row.map(c => c ?? '')),
      ...dataMatrix,
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!merges'] = merges
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(40, w) }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    message.success(`已导出 ${filename}`)
  } catch (err) {
    console.error('[exportMergedSheet] failed', err)
    message.error('导出失败，请重试')
  }
}
```

- [ ] **Step 2: 类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 3: Commit**

```bash
git add src/utils/exportExcel.ts
git commit -m "$(cat <<'EOF'
feat(export): add exportMergedSheet for grouped-header tables

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: MilestoneView 集成导出按钮

**Files:**
- Modify: `src/components/roadmap/MilestoneView.tsx`

- [ ] **Step 1: 更新 imports**

在 `src/components/roadmap/MilestoneView.tsx` 文件顶部调整 imports：

把第 4 行
```ts
import {
  Table, Button, Space, Select, Tag, Modal, Checkbox, Input, Tabs, message, Tooltip, Popconfirm, Empty,
} from 'antd'
```
改为：
```ts
import {
  Table, Button, Space, Select, Tag, Modal, Checkbox, Input, Tabs, message, Tooltip, Popconfirm, Empty, Dropdown,
} from 'antd'
```

把第 7–10 行
```ts
import {
  FilterOutlined, SettingOutlined, SaveOutlined, FullscreenOutlined, FullscreenExitOutlined,
  EyeOutlined, PlusOutlined, CameraOutlined, HistoryOutlined, DeleteOutlined, SwapOutlined, ArrowRightOutlined,
} from '@ant-design/icons'
```
改为：
```ts
import {
  FilterOutlined, SettingOutlined, SaveOutlined, FullscreenOutlined, FullscreenExitOutlined,
  EyeOutlined, PlusOutlined, CameraOutlined, HistoryOutlined, DeleteOutlined, SwapOutlined, ArrowRightOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
```

在第 18 行下方（紧跟 `./utils` import 之后）新增：
```ts
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
```

- [ ] **Step 2: 新增 `handleExport` 函数**

在 `MilestoneView` 组件内，`handleSaveView` 函数之前（约 L244 附近，`resetToDefault` 函数之后）插入：

```ts
// ========== 导出 Excel ==========
const handleExport = (scope: 'current' | 'all') => {
  // 列集合：scope='current' 用当前可见列，scope='all' 用全部固定列 + 全部里程碑
  const fixedCols = getFixedColumnsForType(projectType)
  const visibleFixedKeys = scope === 'current'
    ? fixedCols.filter(c => visibleColumns.includes(c.key)).map(c => c.key)
    : fixedCols.map(c => c.key)

  const exportCols: ExportColumn[] = []
  for (const col of fixedCols) {
    if (!visibleFixedKeys.includes(col.key)) continue
    exportCols.push({ key: col.key, title: col.title })
  }
  for (const ms of milestones) {
    exportCols.push({ key: `ms_${ms.name}`, title: ms.name })
  }
  if (projectType === '整机产品项目') {
    exportCols.push({ key: 'launchDate', title: '产品上市' })
  }

  // 数据源：scope='current' 用筛选后的 tableData，scope='all' 用 allTableData
  const rows = scope === 'current' ? tableData : allTableData

  const filename = `里程碑视图_${projectType}_${exportTimestamp()}.xlsx`
  exportSheet(rows, exportCols, filename, '里程碑视图')
}
```

- [ ] **Step 3: 在 `toolbarActions` 最右侧添加导出按钮**

定位到 `toolbarActions` 定义（约 L508 开始的 `<Space size={6}>` 块）。在"全屏"按钮之前（即 `<Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>` 那个 Tooltip 之前）插入：

```tsx
<Dropdown
  menu={{
    items: [
      { key: 'current', label: '导出当前视图' },
      { key: 'all', label: `导出全部（${projectType}）` },
    ],
    onClick: ({ key }) => handleExport(key as 'current' | 'all'),
  }}
>
  <Tooltip title="导出为 Excel">
    <Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: 6 }} />
  </Tooltip>
</Dropdown>
```

- [ ] **Step 4: 类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 5: 浏览器手动验证**

Run dev server (若未启动)：`npm run dev`

验证项（在浏览器中）：
1. 进入项目路标视图 → 里程碑视图
2. 工具栏出现下载图标按钮，悬停显示 "导出为 Excel"
3. 点击 → 出现"导出当前视图 / 导出全部（软件产品项目）"两项
4. 点击"导出当前视图" → 浏览器下载 `里程碑视图_软件产品项目_*.xlsx`，`message.success` 显示文件名
5. 打开导出文件，列与界面可见列一致，数据一致
6. 切换到"整机产品项目" tab，应用一个筛选（例如产品线），导出当前视图，验证文件只包含筛选后数据，且包含"产品上市"列
7. 导出全部，验证不受筛选影响

- [ ] **Step 6: Commit**

```bash
git add src/components/roadmap/MilestoneView.tsx
git commit -m "$(cat <<'EOF'
feat(export): add Excel export to Milestone view

Dropdown with "export current view" and "export all" respecting
filters, column visibility, and projectType tab.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: MRTrainView 集成导出按钮

**Files:**
- Modify: `src/components/roadmap/MRTrainView.tsx`

- [ ] **Step 1: 更新 imports**

把 `src/components/roadmap/MRTrainView.tsx` 第 4 行
```ts
import { Table, Tag, Tabs, Button, Empty } from 'antd'
```
改为：
```ts
import { Table, Tag, Tabs, Button, Empty, Dropdown, Tooltip } from 'antd'
```

把第 5 行
```ts
import { EyeOutlined } from '@ant-design/icons'
```
改为：
```ts
import { EyeOutlined, DownloadOutlined } from '@ant-design/icons'
```

在 imports 最后追加：
```ts
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
```

- [ ] **Step 2: 新增 `handleExport` 函数**

在 `MRTrainView` 组件内，`columns` useMemo 之后（约 L382 `return` 之前）插入：

```ts
// ========== 导出 Excel ==========
const handleExport = (scope: 'current' | 'all') => {
  // 构建扁平列：主分组 + 次分组 + 信息列 + 活动日期列
  const exportCols: ExportColumn[] = [
    { key: dimConfig.primaryKey, title: dimConfig.primaryTitle },
    { key: dimConfig.secondaryKey, title: dimConfig.secondaryTitle },
  ]
  if (dimConfig.primaryKey === 'branch') {
    exportCols.push({ key: 'tosVersion', title: 'tOS版本号' })
  }
  exportCols.push(
    { key: 'projectType', title: '项目类型' },
    { key: 'productLine', title: '产品线' },
    { key: 'market', title: '市场名' },
    { key: 'projectName', title: '项目名称' },
    { key: 'isMada', title: '是否MADA' },
    { key: 'madaMarket', title: 'MADA市场' },
    { key: 'spm', title: '项目SPM' },
    { key: 'contact', title: '对接人' },
    { key: 'tpm', title: '项目TPM' },
    { key: 'mrType', title: 'MR版本类型' },
    { key: 'projectVersion', title: '项目版本号' },
    { key: 'crossTestType', title: '1+N跨测类型' },
  )
  for (const act of ACTIVITY_STRUCTURE) {
    for (const sub of act.children) {
      exportCols.push(
        { key: `act_${act.name}_${sub}_start`, title: `${act.name}-${sub}-计划开始` },
        { key: `act_${act.name}_${sub}_end`, title: `${act.name}-${sub}-计划结束` },
      )
    }
  }

  // 数据源：本视图当前无筛选 UI，scope current/all 等价于 sortedData；
  // 保留下拉交互一致性。未来若新增筛选，此处 scope='all' 应切回 MR_TRAIN_DATA。
  const rows = scope === 'current' ? sortedData : MR_TRAIN_DATA

  const filename = `MR版本火车视图_${dimConfig.primaryTitle}_${exportTimestamp()}.xlsx`
  exportSheet(rows, exportCols, filename, 'MR版本火车视图')
}
```

- [ ] **Step 3: 在 Tabs 行右侧放置导出按钮**

定位到 `<Tabs>` 组件（约 L401）。把：

```tsx
<Tabs
  activeKey={dimension}
  onChange={setDimension}
  size="small"
  style={{ marginBottom: 12 }}
  items={[
    { key: 'tosVersion', label: 'tOS版本号维度' },
    { key: 'branch', label: '分支信息维度' },
  ]}
/>
```

改为：

```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
  <Tabs
    activeKey={dimension}
    onChange={setDimension}
    size="small"
    style={{ marginBottom: 0 }}
    items={[
      { key: 'tosVersion', label: 'tOS版本号维度' },
      { key: 'branch', label: '分支信息维度' },
    ]}
  />
  <Dropdown
    menu={{
      items: [
        { key: 'current', label: '导出当前视图' },
        { key: 'all', label: '导出全部' },
      ],
      onClick: ({ key }) => handleExport(key as 'current' | 'all'),
    }}
  >
    <Tooltip title="导出为 Excel">
      <Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: 6 }}>导出</Button>
    </Tooltip>
  </Dropdown>
</div>
```

- [ ] **Step 4: 类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 5: 浏览器手动验证**

1. 进入项目路标视图 → 切换到 "MR版本火车视图"
2. 右上角出现"导出"按钮
3. 点击 → "导出当前视图 / 导出全部"
4. 导出当前视图 → 下载 `MR版本火车视图_*.xlsx`
5. 打开文件，列应包含：主/次分组列、信息列、活动日期列（4 个活动 × 2 = 8 个日期列）
6. 切换到"分支信息维度" tab，导出，第 3 列应是"tOS版本号"

- [ ] **Step 6: Commit**

```bash
git add src/components/roadmap/MRTrainView.tsx
git commit -m "$(cat <<'EOF'
feat(export): add Excel export to MR Train view

Flatten stage/activity grouped columns into dated columns for export.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 项目空间 · 竖版表格 导出

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 更新 imports**

在 `src/app/page.tsx` 顶部 icons import 中追加 `DownloadOutlined`。定位到包含 `AppstoreOutlined` 或 `ShareAltOutlined` 的 `@ant-design/icons` import 块，加入 `DownloadOutlined`。

另外确认 antd 的 `Dropdown` 已在 import 列表里；若不在则追加。

在所有组件相关 import 之后追加：
```ts
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
```

- [ ] **Step 2: 新增 `handleExportVerticalPlan` 函数**

在 `renderHorizontalTable` 之前或 `renderTaskTable` 附近的合适位置（组件内部函数区），新增：

```ts
// ========== 导出：竖版表格 ==========
const handleExportVerticalPlan = (scope: 'current' | 'all') => {
  // 列：scope='current' 取当前 currentViewColumns（用户自定义可见列）
  //     scope='all' 取当前 level 的全部可用列
  const allCols = getColumnsForView('table') // 所有列定义
  const cols = scope === 'current' ? currentViewColumns : allCols

  const exportCols: ExportColumn[] = cols.map((c: any) => ({
    key: c.dataIndex || c.key,
    title: typeof c.title === 'string' ? c.title : (c.exportTitle || c.key),
  }))

  // 数据：
  // - level1: displayTasks (已合并一级/二级)，current 按 searchText 过滤
  // - level2: 当前 activeLevel2Plan 的 tasks，current 按 searchText 过滤
  let rows: any[] = []
  if (projectPlanLevel === 'level1') {
    rows = scope === 'current'
      ? displayTasks.filter((t: any) =>
          !searchText || (t.taskName || '').toLowerCase().includes(searchText.toLowerCase()))
      : displayTasks
  } else if (projectPlanLevel === 'level2' && activeLevel2Plan && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1') {
    const l2 = level2PlanTasks.filter((t: any) => t.planId === activeLevel2Plan)
    rows = scope === 'current'
      ? l2.filter((t: any) =>
          !searchText || (t.taskName || '').toLowerCase().includes(searchText.toLowerCase()))
      : l2
  }

  const levelLabel = projectPlanLevel === 'level1' ? '一级计划' : '二级计划'
  const projectName = selectedProject?.name || '项目'
  const filename = `项目空间计划_${projectName}_${levelLabel}_竖版_${exportTimestamp()}.xlsx`
  exportSheet(rows, exportCols, filename, `${levelLabel}竖版`)
}
```

> **注意：** 上面代码用到的 `displayTasks` 变量在 `renderProjectSpace` 的其他位置已定义（约 L3216）。若 `handleExportVerticalPlan` 所在作用域看不到 `displayTasks`，需要把函数定义放在 `const displayTasks = mergePlans(...)` 所在的同一作用域内（即 `renderProjectSpace` 函数体内，而非组件顶层）。请按实际作用域放置。

- [ ] **Step 3: 在项目空间工具栏添加导出按钮**

定位到 `src/app/page.tsx` 中 `projectPlanViewMode !== 'horizontal' && (...)` 的 "自定义列" Tooltip 之前（约 L3142 位置）。在 `<Space size={6}>` 容器内，搜索输入框 `<Input placeholder="搜索任务..."` 之后插入：

```tsx
{projectPlanViewMode !== 'gantt' && (
  <Dropdown
    menu={{
      items: [
        { key: 'current', label: '导出当前视图' },
        { key: 'all', label: '导出全部' },
      ],
      onClick: ({ key }) => {
        if (projectPlanViewMode === 'horizontal') {
          handleExportHorizontalPlan(key as 'current' | 'all')
        } else {
          handleExportVerticalPlan(key as 'current' | 'all')
        }
      },
    }}
  >
    <Tooltip title="导出为 Excel">
      <Button icon={<DownloadOutlined />} style={{ borderRadius: 6 }} />
    </Tooltip>
  </Dropdown>
)}
```

> **注意：** `handleExportHorizontalPlan` 将在 Task 6 添加。此处先保留引用会导致 Task 5 单独 commit 时类型检查失败。**解决方案**：在 Task 5 中同时插入 `handleExportHorizontalPlan` 的**空桩实现**，在 Task 6 再替换为真实实现：

在 Task 5 Step 2 的 `handleExportVerticalPlan` 之后追加临时桩：

```ts
// 横版导出（Task 6 实现）
const handleExportHorizontalPlan = (_scope: 'current' | 'all') => {
  message.info('横版导出将在后续任务中实现')
}
```

- [ ] **Step 4: 类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 5: 浏览器手动验证**

1. 进入任意项目 → 项目空间 → 一级计划（竖版表格）
2. 工具栏出现"导出"图标按钮
3. 点击"导出当前视图" → 下载 `项目空间计划_{项目名}_一级计划_竖版_*.xlsx`
4. 打开，列与自定义列配置一致，数据与界面行一致
5. 输入搜索关键字过滤后再次导出当前视图，仅包含匹配行
6. 点击"导出全部"，包含全部列与全部行（忽略搜索）
7. 切换到二级计划某个 plan，导出当前视图，验证文件名含"二级计划"且数据正确
8. 切换到甘特图模式，导出按钮应消失
9. 切换到横版表格模式，导出按钮应可见，点击后提示"横版导出将在后续任务中实现"

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(export): add Excel export to project space vertical plan table

Adds Dropdown export button to the project plan toolbar with
"current view" (searchText + visible columns) and "all" scopes.
Hidden in Gantt mode. Horizontal export is stubbed for Task 6.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 项目空间 · 横版表格 导出（合并表头）

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 更新 imports**

在 `src/app/page.tsx` 顶部 `@/utils/exportExcel` import 追加 `exportMergedSheet`：

```ts
import { exportSheet, exportMergedSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
```

- [ ] **Step 2: 替换 `handleExportHorizontalPlan` 桩为真实实现**

将 Task 5 Step 2 中插入的桩：

```ts
const handleExportHorizontalPlan = (_scope: 'current' | 'all') => {
  message.info('横版导出将在后续任务中实现')
}
```

替换为：

```ts
// ========== 导出：横版表格 ==========
const handleExportHorizontalPlan = (_scope: 'current' | 'all') => {
  // 横版表格仅用于 level1。列结构：版本 | 开发周期 | 阶段A(colSpan=n) | 阶段B(colSpan=m) | ...
  // 行：按版本号倒序的已发布版本 + 末行"实际"数据。
  // 注：spec 中说明横版的 current/all 行为一致，_scope 参数保留以维持交互统一。

  const stages = (tasks as any[]).filter((t: any) => !t.parentId).sort((a: any, b: any) => a.order - b.order)
  const stageGroups = stages.map((stage: any) => {
    const ms = (tasks as any[]).filter((t: any) => t.parentId === stage.id).sort((a: any, b: any) => a.order - b.order)
    return { stage, milestones: ms, colSpan: ms.length || 1 }
  })
  const allMilestones = stageGroups.flatMap(({ stage, milestones }) =>
    milestones.length > 0 ? milestones : [stage],
  )

  if (allMilestones.length === 0) {
    message.warning('暂无可导出数据')
    return
  }

  // 构建 headerMatrix（2 行）与 merges
  const headerRow0: (string | null)[] = ['版本', '开发周期']
  const headerRow1: (string | null)[] = [null, null]
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // 版本 rowSpan=2
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // 开发周期 rowSpan=2
  ]
  let colCursor = 2
  for (const { stage, milestones, colSpan } of stageGroups) {
    headerRow0.push(stage.taskName)
    for (let i = 1; i < colSpan; i++) headerRow0.push(null)
    if (milestones.length > 0) {
      for (const m of milestones) headerRow1.push(m.taskName)
    } else {
      headerRow1.push('-')
    }
    merges.push({ s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + colSpan - 1 } })
    colCursor += colSpan
  }
  const headerMatrix: (string | null)[][] = [headerRow0, headerRow1]

  // 计算各版本的任务（复用 renderHorizontalTable 里的 offset 模拟逻辑）
  const publishedVersions = versions
    .filter(v => v.status === '已发布')
    .sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))
  const latestNum = publishedVersions.length > 0
    ? Math.max(...publishedVersions.map(v => parseInt(v.versionNo.replace('V', ''))))
    : 0
  const getVersionTasks = (versionNo: string) => {
    const vNum = parseInt(versionNo.replace('V', ''))
    if (vNum === latestNum) return tasks as any[]
    const offsetDays = (latestNum - vNum) * 3
    return (tasks as any[]).map((t: any) => ({
      ...t,
      planStartDate: t.planStartDate ? shiftDateStr(t.planStartDate, -offsetDays) : '',
      planEndDate: t.planEndDate ? shiftDateStr(t.planEndDate, -offsetDays) : '',
    }))
  }

  const calcCycleDays = (list: any[], startKey: string, endKey: string): string | number => {
    const starts = list.map((t: any) => t[startKey]).filter(Boolean).map((d: string) => new Date(d).getTime())
    const ends = list.map((t: any) => t[endKey]).filter(Boolean).map((d: string) => new Date(d).getTime())
    if (starts.length === 0 || ends.length === 0) return '-'
    const days = Math.ceil((Math.max(...ends) - Math.min(...starts)) / (1000 * 60 * 60 * 24))
    return days > 0 ? days : '-'
  }

  // 构建数据矩阵
  const dataMatrix: (string | number)[][] = []

  // 已发布版本行
  for (const v of publishedVersions) {
    const vt = getVersionTasks(v.versionNo)
    const devCycle = calcCycleDays(vt, 'planStartDate', 'planEndDate')
    const row: (string | number)[] = [v.versionNo, devCycle]
    for (const m of allMilestones) {
      const match = vt.find((t: any) => t.id === m.id)
      row.push(match?.planEndDate || '-')
    }
    dataMatrix.push(row)
  }

  // 实际数据行
  const actualCycle = calcCycleDays(tasks as any[], 'actualStartDate', 'actualEndDate')
  const actualRow: (string | number)[] = ['实际', actualCycle]
  for (const m of allMilestones) {
    const t = (tasks as any[]).find((x: any) => x.id === m.id)
    actualRow.push(t?.actualEndDate || '-')
  }
  dataMatrix.push(actualRow)

  // 列宽：版本 10、开发周期 10、各里程碑 14
  const colWidths = [10, 10, ...allMilestones.map(() => 14)]

  const projectName = selectedProject?.name || '项目'
  const filename = `项目空间计划_${projectName}_一级计划_横版_${exportTimestamp()}.xlsx`
  exportMergedSheet(headerMatrix, merges, dataMatrix, colWidths, filename, '一级计划横版')
}

// 横版导出辅助：将日期字符串偏移 N 天
const shiftDateStr = (dateStr: string, deltaDays: number): string => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}
```

> **作用域提醒：** `shiftDateStr` 若与其他地方已有同名函数冲突，请改名为 `shiftDateStrForExport`。

- [ ] **Step 3: 类型检查**

Run:
```bash
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 4: 浏览器手动验证**

1. 进入项目空间 → 一级计划 → 切换到"横版表格"视图
2. 工具栏"导出"按钮可见
3. 点击"导出当前视图" → 下载 `项目空间计划_{项目名}_一级计划_横版_*.xlsx`
4. 在 macOS Numbers（或 Excel / Google Sheets）中打开
5. 验证：
   - 第 1 行："版本"、"开发周期"纵向跨 2 行；阶段名（如"版本规划"、"版本开发"）按分组横向合并
   - 第 2 行：各里程碑名称
   - 数据行：每个已发布版本一行 + 末行"实际"
   - 日期与页面上横版表格一致
6. 点击"导出全部"，输出与当前一致（spec 约定）

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(export): add Excel export for project space horizontal table

Implements grouped-header export using exportMergedSheet: stage colSpans
and version/cycle rowSpans reproduced faithfully. Replaces Task 5 stub.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 端到端验证与最终构建

**Files:** 无新改动

- [ ] **Step 1: 类型检查**

Run:
```bash
npx tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 2: 生产构建**

Run:
```bash
npm run build
```
Expected: 构建成功，无错误。记录 bundle 增量（估计 ~600KB 未压缩）。

- [ ] **Step 3: 回归性手动测试**

1. 里程碑视图：两个 projectType tab × 有/无筛选 × current/all，共 8 次导出，全部打开无异常
2. MR火车视图：两个维度 tab × current/all，共 4 次导出
3. 项目空间竖版：一级 + 二级各导出 current 和 all；搜索过滤验证
4. 项目空间横版：一级导出 current 和 all，合并表头正确
5. 甘特图模式：导出按钮不可见
6. 空状态验证：在一个无任务的新项目中进入项目空间计划管理，点击导出 → 应显示 "暂无可导出数据" warning，不下载文件
7. 无 console 错误

- [ ] **Step 4: 无改动则跳过 commit**

若前面任务 commit 都无问题，此任务无需 commit。

---

## Self-Review

**1. Spec 覆盖检查：**
- ✅ §3 技术选型 xlsx — Task 1
- ✅ §4.1 `exportSheet` — Task 1；`exportMergedSheet` — Task 2
- ✅ §4.2 Dropdown UI 统一 — Task 3/4/5/6 均使用
- ✅ §4.3 文件名规范 — 全部 handler 使用 `exportTimestamp()` 与 spec 格式
- ✅ §5 接入点 1（MilestoneView）— Task 3
- ✅ §5 接入点 2（MRTrainView）— Task 4
- ✅ §5 接入点 3（竖版一级/二级）— Task 5
- ✅ §5 接入点 4（横版）— Task 6
- ✅ §6 文件改动清单 — Task 1–6 一一对应
- ✅ §7 横版 merges 构造规则 — Task 6 Step 2
- ✅ §8 手动验证矩阵 — Task 3/4/5/6/7 的验证步骤
- ✅ 甘特图下隐藏 — Task 5 条件渲染
- ✅ 空数据 warning — `exportSheet`/`exportMergedSheet` 内置

**2. 占位符扫描：** 无 TBD / TODO / "implement later" / 未填充代码步骤。每个代码步骤都含完整可粘贴代码。

**3. 类型 / 方法名一致性：**
- `exportSheet(rows, columns, filename, sheetName?)` — Task 1 定义，Task 3/4/5 使用 ✓
- `exportMergedSheet(headerMatrix, merges, dataMatrix, colWidths, filename, sheetName?)` — Task 2 定义，Task 6 使用 ✓
- `exportTimestamp()` — Task 1 定义，所有 handler 使用 ✓
- `ExportColumn` interface — Task 1 定义，Task 3/4/5 使用 ✓
- `handleExportVerticalPlan` / `handleExportHorizontalPlan` — Task 5 定义（后者是桩），Task 6 替换桩 ✓
- `DownloadOutlined` — Task 3/4/5 均补 import ✓
- `Dropdown` — Task 3/4 补 import；Task 5 需要确认 page.tsx 已有（若无则补）
- `shiftDateStr` — Task 6 定义，仅 Task 6 使用 ✓

**4. 作用域风险：** Task 5/6 的 handler 需要访问 `displayTasks`、`tasks`、`versions`、`searchText`、`selectedProject`、`currentViewColumns`、`level2PlanTasks`、`activeLevel2Plan`、`projectPlanLevel`。这些都是 `Home` / `renderProjectSpace` 作用域的局部状态，因此 handler 必须定义在与它们相同的作用域内（见 Task 5 Step 2 的作用域提醒）。实施时请据实际组件结构放置，不要盲目放到组件顶层。

以上自审通过。
