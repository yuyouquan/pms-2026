# 项目路标视图与项目空间计划管理 Excel 导出设计

**日期**: 2026-04-10
**范围**: `项目路标视图`（里程碑视图 + MR 版本火车视图）与 `项目空间计划管理`（竖版/横版表格）新增 Excel 导出能力

## 1. 目标与需求

- 在 **项目路标视图** 和 **项目空间计划管理** 中增加"导出"按钮。
- 支持导出当前可见的表格为 `.xlsx` 文件：
  - 里程碑视图 Table
  - MR 版本火车视图 Table
  - 项目空间计划 —— 竖版表格（一级 / 二级）
  - 项目空间计划 —— 横版表格（一级专用，含分组表头）
- 甘特图模式下不提供导出（本次需求未覆盖）。
- 用户可选择"导出当前视图"（含筛选、搜索、列可见性状态）或"导出全部"（全量数据）。

## 2. 非目标

- 不支持甘特图导出。
- 不导出图片 / PDF。
- 不修改权限模型、mock 数据或已有甘特图 / Table 渲染逻辑。
- 不引入单元测试框架；沿用项目现有的手动验证模式。

## 3. 技术选型

- 依赖：新增 `xlsx@^0.18.5`（SheetJS，MIT）。
  - 支持合并单元格、列宽、多 sheet、中文。
  - 横版表格的"阶段-里程碑"两行分组表头可用 `worksheet['!merges']` 完美还原。
  - 预估产物体积增幅 ~600KB（gzip ~130KB），仅在导出按钮触发时使用，不阻塞首屏。
- 不引入 `file-saver`：`XLSX.writeFile` 在浏览器内会自动触发下载。
- 时间戳使用项目已有的 `dayjs`，无需新增。

## 4. 架构

### 4.1 新增共享工具 `src/utils/exportExcel.ts`

暴露两个函数（约 120 行）：

```ts
import * as XLSX from 'xlsx'

export interface ExportColumn {
  key: string
  title: string
  width?: number
  formatter?: (value: any, row: any) => string | number
}

export function exportSheet(
  rows: any[],
  columns: ExportColumn[],
  filename: string,
  sheetName?: string,
): void

export function exportMergedSheet(
  headerMatrix: (string | null)[][],
  merges: XLSX.Range[],
  dataMatrix: (string | number)[][],
  colWidths: number[],
  filename: string,
  sheetName?: string,
): void
```

**职责**：
- 列宽自适应：`max(title.length, sample rows 字符长度) * 1.2`，上限 40。
- 空值统一输出 `-`。
- 日期字段直接按字符串输出（现有数据已是 `YYYY-MM-DD`）。
- 空数据时 `message.warning('暂无可导出数据')` 并提前 return（由调用方或工具内决定；本设计放在调用方以便区分"当前视图为空"与"全部为空"的提示措辞）。
- 导出成功 `message.success('已导出 {filename}')`。
- SheetJS 抛错时 `message.error('导出失败，请重试')` 并 `console.error` 记录栈。

### 4.2 UI 模式统一

所有接入点均使用：

```tsx
<Dropdown
  menu={{
    items: [
      { key: 'current', label: '导出当前视图' },
      { key: 'all',     label: '导出全部' },
    ],
    onClick: ({ key }) => handleExport(key as 'current' | 'all'),
  }}
>
  <Button icon={<DownloadOutlined />}>导出</Button>
</Dropdown>
```

甘特图模式下：通过条件渲染 `{projectPlanViewMode !== 'gantt' && ...}` 直接隐藏按钮。

### 4.3 文件名规范

`{视图名}_{上下文}_{YYYYMMDD_HHmm}.xlsx`

示例：
- `里程碑视图_软件产品项目_20260410_1430.xlsx`
- `MR版本火车视图_20260410_1430.xlsx`
- `项目空间计划_tOS16.3.50_竖版_20260410_1430.xlsx`
- `项目空间计划_tOS16.3.50_横版_20260410_1430.xlsx`

## 5. 各接入点行为

| # | 位置 | 列来源 | 导出当前视图 | 导出全部 |
|---|---|---|---|---|
| 1 | `MilestoneView` 工具栏 | `getFixedColumnsForType(projectType)` + 当前可见里程碑列 | 当前筛选 + 当前可见列 + 当前 projectType | 当前 projectType 下全部项目 × 全部里程碑列 |
| 2 | `MRTrainView` 工具栏 | 固定列 + 按"阶段-活动"展开的日期列 | 当前筛选行 | 全部 `MR_TRAIN_DATA` |
| 3 | `src/app/page.tsx` 项目空间工具栏（竖版） | `currentViewColumns` | `searchText` 过滤后 + 当前可见列 + 当前 level2 tab | 当前层级全部任务 + 全部列 |
| 4 | `src/app/page.tsx` 项目空间工具栏（横版，仅一级） | 固定结构：版本 / 开发周期 / 阶段 × 里程碑 | 当前 tasks + 当前已发布版本集合 | 同左（横版本身即"全量已发布版本"汇总，但仍保留下拉项以保持交互一致性） |

**"全部"的 projectType 说明**：里程碑视图 A. 导出全部时仍限定在当前 projectType tab 下（软件/整机），因为该 tab 是视图的一级维度而非可过滤项；若要跨 projectType 导出需用户手动切换 tab 再导出。此约定写入工具 tooltip。

## 6. 文件改动清单

### 新增
- `src/utils/exportExcel.ts` — 通用导出工具

### 修改
| 文件 | 改动 |
|---|---|
| `package.json` | 新增 `xlsx@^0.18.5` |
| `src/components/roadmap/MilestoneView.tsx` | 工具栏右侧加 `<Dropdown>` 导出按钮；实现 `handleExport(scope)` 把 Antd columns 映射为 `ExportColumn[]` |
| `src/components/roadmap/MRTrainView.tsx` | 同模式；处理"阶段-活动"展开列到扁平 `ExportColumn[]` |
| `src/app/page.tsx` | 在 `<Space size={6}>`（约行 3140）内"自定义列"按钮前加导出 `<Dropdown>`；新增 `handleExportVerticalPlan(scope)`（复用 `currentViewColumns` 与 `displayTasks`）、`handleExportHorizontalPlan(scope)`（构造 `headerMatrix + merges + dataMatrix`）；甘特图模式下条件隐藏 |

### 不改动
- mock 数据
- 权限模型
- 甘特图渲染
- 已有 Table / 表头逻辑

## 7. 横版表格合并表头构造

横版表格的表头结构：

```
| 版本 | 开发周期 | 阶段A (colSpan=n) | 阶段B (colSpan=m) | ...
|     |          | 里程碑 | 里程碑 | ... | 里程碑 | 里程碑 | ...
```

`exportMergedSheet` 的 `headerMatrix` 与 `merges` 构造规则：

- 第 0 行：`['版本', '开发周期', '阶段A', null, ..., '阶段B', null, ...]`
- 第 1 行：`[null, null, '里程碑1', '里程碑2', ..., '里程碑k', ...]`
- merges：
  - `{ s:{r:0,c:0}, e:{r:1,c:0} }` — "版本" rowSpan=2
  - `{ s:{r:0,c:1}, e:{r:1,c:1} }` — "开发周期" rowSpan=2
  - 每个阶段：`{ s:{r:0,c:start}, e:{r:0,c:start+colSpan-1} }`

数据区每行按 `[版本号, 开发周期, ...各里程碑计划日期字符串]` 顺序输出。

## 8. 测试策略

项目目前无单元测试基础设施。通过浏览器手动验证覆盖：

| 接入点 | 导出当前视图 | 导出全部 | 空数据 |
|---|---|---|---|
| 里程碑视图 | ✓ | ✓ | ✓ |
| MR 火车视图 | ✓ | ✓ | ✓ |
| 项目空间 · 竖版（一级） | ✓ | ✓ | ✓ |
| 项目空间 · 竖版（二级） | ✓ | ✓ | — |
| 项目空间 · 横版 | ✓ | ✓ | — |

验收项：
- 导出文件能在 macOS Numbers / 在线 xlsx 预览工具中正常打开
- 表头、合并单元格、中文、日期与界面完全一致
- 空数据时不下载文件，仅出现 `warning` 提示
- 甘特图模式下导出按钮不可见
- 成功后 `message.success` 显示正确文件名

额外验证：
- `npx tsc --noEmit` 通过
- `npm run build` 通过

## 9. 风险与权衡

| 风险 | 应对 |
|---|---|
| xlsx 体积 ~600KB 拖慢首屏 | 先接受；若后续首屏预算吃紧，可改 `const XLSX = await import('xlsx')` 做动态导入 |
| 横版表格 merges 偏移错误 | 构造时写显式注释、导出后用 Numbers 校验 |
| MR 火车视图"阶段-活动"展开列数较多 | 列宽上限 40，避免 Excel 中列过宽 |
| "导出全部"在里程碑视图是否跨 projectType tab | 明确不跨；tooltip 说明"仅导出当前项目类型" |

## 10. 不做的事（YAGNI）

- 不支持多 sheet（每次只导一张表）
- 不支持自定义导出列选择对话框（"导出当前视图"已等价于列选）
- 不支持 PDF / PNG 导出
- 不引入 file-saver、exceljs、html2canvas 等额外依赖
- 不做导出进度条（数据量小，瞬时完成）
