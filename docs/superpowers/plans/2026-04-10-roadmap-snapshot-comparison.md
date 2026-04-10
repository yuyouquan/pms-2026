# Roadmap Snapshot Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a snapshot comparison feature to the project roadmap milestone view so users can pick any two versions (live / historical snapshots) and see inline cell-level diffs with a top summary bar.

**Architecture:** Extend `MilestoneView.tsx` with a new exclusive "compare mode" alongside existing "live" and "single-snapshot" display states. A pure `diffSnapshots()` function in `utils.ts` computes row-aligned, field-level diffs; a `buildCompareColumns()` helper renders diff-aware columns. A new entry button + modal + summary bar handle the UX.

**Tech Stack:** Next.js 14 + React 18 + Ant Design 6.3.1 + TypeScript. **No test framework in this project** — verification loop is `npx tsc --noEmit` + `npm run build` + manual browser verification at `http://localhost:3004`.

**Reference spec:** `docs/superpowers/specs/2026-04-10-roadmap-snapshot-comparison-design.md`

**Before starting:** Read the spec once. It defines data shapes, visual rules, and edge cases that the tasks below assume. Also read `src/components/roadmap/MilestoneView.tsx` lines 66–90 (column helpers), 99–108 (snapshot state), 320–385 (existing snapshot handlers + displayColumns) to understand what you're extending.

---

## File Structure

**Modify:**
- `src/components/roadmap/utils.ts` — add diff types + `diffSnapshots()` + `buildCompareColumns()`
- `src/components/roadmap/MilestoneView.tsx` — add compare state, wire display branches, add UI elements
- `src/styles/globals.css` — add 3 CSS classes for row diff backgrounds

**Do not touch:** `RoadmapView.tsx`, `MRTrainView.tsx`, mock data, `src/app/page.tsx`.

---

## Task 1: Add diff types and `diffSnapshots` function

**Files:**
- Modify: `src/components/roadmap/utils.ts` (append at end of file)

- [ ] **Step 1: Add imports and types**

Append at the end of `src/components/roadmap/utils.ts`:

```ts
// ============================================================
// Snapshot comparison (added 2026-04-10)
// ============================================================

export type CellDiff =
  | { kind: 'same' }
  | { kind: 'added' }
  | { kind: 'removed' }
  | { kind: 'changed'; oldVal: any; newVal: any }
  | { kind: 'dateEarlier'; oldVal: string; newVal: string; days: number }
  | { kind: 'dateLater'; oldVal: string; newVal: string; days: number }
  | { kind: 'colAddedOnly' }
  | { kind: 'colRemovedOnly' }

export interface DiffRow {
  rowKey: string
  rowStatus: 'added' | 'removed' | 'modified' | 'same'
  base?: any
  target?: any
  cellDiffs: Record<string, CellDiff>
}

export interface MergedMilestone {
  name: string
  order: number
  onlyIn?: 'base' | 'target'
}

export interface DiffResult {
  rows: DiffRow[]
  mergedMilestones: MergedMilestone[]
  summary: { added: number; removed: number; modified: number; cellChanges: number }
}

export interface SnapshotLike {
  data: any[]
  milestones: { name: string; order: number }[]
}
```

- [ ] **Step 2: Add row-key and date-parse helpers**

Append right after the types added in Step 1:

```ts
function buildRowKey(row: any): string {
  return `${row.projectId}::${row.market ?? ''}`
}

/** Try to parse a value as a date. Returns null on failure or '-'. */
function tryParseDate(val: any): Date | null {
  if (val == null || val === '-' || val === '') return null
  const t = new Date(val)
  if (isNaN(t.getTime())) return null
  return t
}

/** Days between two dates (rounded). */
function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}
```

- [ ] **Step 3: Add `diffSnapshots` function**

Append right after the helpers added in Step 2:

```ts
/** Which fields to compare on a row. Milestones are added dynamically per-call. */
function getCompareFields(projectType: string): string[] {
  const base = [
    'projectName', 'productLine', 'chipPlatform', 'tosVersion',
    'status', 'spm', 'versionType', 'currentNode',
  ]
  if (projectType === '整机产品项目') {
    return [...base, 'brand', 'productType', 'memory', 'developMode', 'launchDate']
  }
  return base
}

export function diffSnapshots(
  base: SnapshotLike,
  target: SnapshotLike,
  projectType: string,
): DiffResult {
  // 1. Build row maps
  const baseMap = new Map<string, any>()
  const targetMap = new Map<string, any>()
  for (const r of base.data) baseMap.set(buildRowKey(r), r)
  for (const r of target.data) targetMap.set(buildRowKey(r), r)

  // 2. Merge milestones (union, target order preferred)
  const mergedMap = new Map<string, MergedMilestone>()
  for (const m of target.milestones) {
    mergedMap.set(m.name, { name: m.name, order: m.order })
  }
  for (const m of base.milestones) {
    if (!mergedMap.has(m.name)) {
      mergedMap.set(m.name, { name: m.name, order: m.order, onlyIn: 'base' })
    }
  }
  // Mark target-only columns
  const baseMilestoneNames = new Set(base.milestones.map(m => m.name))
  for (const m of target.milestones) {
    if (!baseMilestoneNames.has(m.name)) {
      const existing = mergedMap.get(m.name)!
      existing.onlyIn = 'target'
    }
  }
  const mergedMilestones: MergedMilestone[] = Array.from(mergedMap.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  // 3. Walk union of rowKeys
  const allKeys = new Set<string>([...baseMap.keys(), ...targetMap.keys()])
  const fields = getCompareFields(projectType)
  const milestoneFields = mergedMilestones.map(m => `ms_${m.name}`)

  const rows: DiffRow[] = []
  const summary = { added: 0, removed: 0, modified: 0, cellChanges: 0 }

  for (const key of allKeys) {
    const b = baseMap.get(key)
    const t = targetMap.get(key)
    const cellDiffs: Record<string, CellDiff> = {}

    if (b && !t) {
      rows.push({ rowKey: key, rowStatus: 'removed', base: b, cellDiffs: {} })
      summary.removed++
      continue
    }
    if (!b && t) {
      rows.push({ rowKey: key, rowStatus: 'added', target: t, cellDiffs: {} })
      summary.added++
      continue
    }

    // Both exist: compare fields
    let hasChange = false

    for (const f of fields) {
      const oldVal = b[f]
      const newVal = t[f]
      if (oldVal === newVal) {
        cellDiffs[f] = { kind: 'same' }
      } else if (f === 'launchDate') {
        const od = tryParseDate(oldVal)
        const nd = tryParseDate(newVal)
        if (od && nd) {
          if (nd.getTime() === od.getTime()) {
            cellDiffs[f] = { kind: 'same' }
          } else if (nd.getTime() < od.getTime()) {
            cellDiffs[f] = { kind: 'dateEarlier', oldVal, newVal, days: dayDiff(od, nd) }
            hasChange = true
            summary.cellChanges++
          } else {
            cellDiffs[f] = { kind: 'dateLater', oldVal, newVal, days: dayDiff(nd, od) }
            hasChange = true
            summary.cellChanges++
          }
        } else {
          cellDiffs[f] = { kind: 'changed', oldVal, newVal }
          hasChange = true
          summary.cellChanges++
        }
      } else {
        cellDiffs[f] = { kind: 'changed', oldVal, newVal }
        hasChange = true
        summary.cellChanges++
      }
    }

    for (const mf of milestoneFields) {
      const merged = mergedMilestones.find(m => `ms_${m.name}` === mf)!
      if (merged.onlyIn === 'base') {
        cellDiffs[mf] = { kind: 'colRemovedOnly' }
        continue
      }
      if (merged.onlyIn === 'target') {
        cellDiffs[mf] = { kind: 'colAddedOnly' }
        continue
      }
      const oldVal = b[mf]
      const newVal = t[mf]
      if (oldVal === newVal) {
        cellDiffs[mf] = { kind: 'same' }
        continue
      }
      const od = tryParseDate(oldVal)
      const nd = tryParseDate(newVal)
      if (od && nd) {
        if (nd.getTime() === od.getTime()) {
          cellDiffs[mf] = { kind: 'same' }
        } else if (nd.getTime() < od.getTime()) {
          cellDiffs[mf] = { kind: 'dateEarlier', oldVal, newVal, days: dayDiff(od, nd) }
          hasChange = true
          summary.cellChanges++
        } else {
          cellDiffs[mf] = { kind: 'dateLater', oldVal, newVal, days: dayDiff(nd, od) }
          hasChange = true
          summary.cellChanges++
        }
      } else {
        cellDiffs[mf] = { kind: 'changed', oldVal, newVal }
        hasChange = true
        summary.cellChanges++
      }
    }

    rows.push({
      rowKey: key,
      rowStatus: hasChange ? 'modified' : 'same',
      base: b,
      target: t,
      cellDiffs,
    })
    if (hasChange) summary.modified++
  }

  return { rows, mergedMilestones, summary }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/roadmap/utils.ts
git commit -m "feat(roadmap): add diffSnapshots pure function for snapshot comparison"
```

---

## Task 2: Add `buildCompareColumns` helper

**Files:**
- Modify: `src/components/roadmap/utils.ts` (append) — and move the two column config arrays here so both `MilestoneView` and `buildCompareColumns` can share them
- Modify: `src/components/roadmap/MilestoneView.tsx` — re-import the moved constants

**Why the move:** `buildCompareColumns` needs the same `SOFTWARE_FIXED_COLUMNS` / `MACHINE_FIXED_COLUMNS` arrays currently defined in `MilestoneView.tsx` (lines 25–47). Duplicating them would drift. Move them to `utils.ts` and re-import.

- [ ] **Step 1: Cut column arrays from MilestoneView, paste into utils.ts**

At the top of `src/components/roadmap/utils.ts` (after the existing `STORAGE_KEY` line), add:

```ts
// Shared column configs (moved from MilestoneView.tsx 2026-04-10)
export const SOFTWARE_FIXED_COLUMNS = [
  { key: 'projectName', title: '项目名称' },
  { key: 'versionType', title: '版本类型' },
  { key: 'currentNode', title: '当前节点' },
  { key: 'chipPlatform', title: '芯片平台' },
  { key: 'status', title: '状态' },
  { key: 'spm', title: 'SPM' },
]

export const MACHINE_FIXED_COLUMNS = [
  { key: 'tosVersion', title: 'tOS版本' },
  { key: 'brand', title: '品牌' },
  { key: 'productType', title: '产品类型' },
  { key: 'productLine', title: '产品线' },
  { key: 'projectName', title: '项目名称' },
  { key: 'chipPlatform', title: '芯片平台' },
  { key: 'memory', title: '内存' },
  { key: 'versionType', title: '版本类型' },
  { key: 'developMode', title: '开发模式' },
  { key: 'status', title: '状态' },
  { key: 'spm', title: 'SPM' },
]

export function getFixedColumnsForType(projectType: string) {
  return projectType === '整机产品项目' ? MACHINE_FIXED_COLUMNS : SOFTWARE_FIXED_COLUMNS
}

export function getDefaultVisibleColumns(projectType: string) {
  return getFixedColumnsForType(projectType).map(c => c.key)
}
```

In `src/components/roadmap/MilestoneView.tsx`:
- Delete the local `SOFTWARE_FIXED_COLUMNS`, `MACHINE_FIXED_COLUMNS`, `FIXED_COLUMNS`, `getFixedColumnsForType`, `getDefaultVisibleColumns` (lines ~25–72)
- Update the import from `./utils` to include these:

```ts
import {
  aggregateMilestones, generateTableData, saveView, loadAllViews, deleteView,
  SOFTWARE_FIXED_COLUMNS, MACHINE_FIXED_COLUMNS, getFixedColumnsForType, getDefaultVisibleColumns,
  diffSnapshots, buildCompareColumns,
  type DiffResult, type DiffRow, type CellDiff, type SnapshotLike,
} from './utils'
```

(The `buildCompareColumns`, `DiffResult`, etc. imports will be valid after Step 2 of this task.)

- [ ] **Step 2: Add React/AntD imports at the top of utils.ts**

At the very top of `src/components/roadmap/utils.ts`, add these imports right below the existing `import type { MilestoneInfo, RoadmapViewConfig }` line. (ES module imports must live at top-level, so don't append them at the bottom.)

```ts
import React from 'react'
import type { ColumnsType } from 'antd/es/table'
import { Tag, Tooltip, Button } from 'antd'
import { EyeOutlined, ArrowRightOutlined } from '@ant-design/icons'
```

Note: `utils.ts` stays a `.ts` file (not `.tsx`). All React tree construction in this task uses `React.createElement` rather than JSX, which is valid in `.ts`.

- [ ] **Step 3: Append `buildCompareColumns` function**

Append at the very end of `src/components/roadmap/utils.ts`:

```ts
/** Render a single diff cell. Returns a React node. */
function renderDiffCell(field: string, row: DiffRow): React.ReactNode {
  const diff = row.cellDiffs[field]
  const baseVal = row.base?.[field]
  const targetVal = row.target?.[field]

  // Added/removed rows: just show the one side's value, no cell coloring
  if (row.rowStatus === 'added') {
    return React.createElement('span', { style: { fontSize: 11 } }, String(targetVal ?? '-'))
  }
  if (row.rowStatus === 'removed') {
    return React.createElement('span', { style: { fontSize: 11 } }, String(baseVal ?? '-'))
  }

  if (!diff || diff.kind === 'same') {
    return React.createElement('span', { style: { fontSize: 11, color: '#4b5563' } }, String(targetVal ?? '-'))
  }

  if (diff.kind === 'colAddedOnly') {
    return React.createElement('span', { style: { fontSize: 11, color: '#22c55e' } }, String(targetVal ?? '-'))
  }
  if (diff.kind === 'colRemovedOnly') {
    return React.createElement('span', { style: { fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' } }, String(baseVal ?? '-'))
  }

  const arrow = React.createElement(ArrowRightOutlined, { style: { fontSize: 10, margin: '0 4px', color: '#9ca3af' } })
  const oldNode = React.createElement('del', { style: { color: '#9ca3af' } }, String(diff.oldVal ?? '-'))
  const newNode = React.createElement('strong', null, String(diff.newVal ?? '-'))

  let bg = '#fffbeb' // changed
  let tooltip: string | null = null
  if (diff.kind === 'dateEarlier') {
    bg = '#eff6ff'
    tooltip = `提前 ${diff.days} 天`
  } else if (diff.kind === 'dateLater') {
    bg = '#fef2f2'
    tooltip = `延后 ${diff.days} 天`
  }

  const content = React.createElement(
    'span',
    { style: { fontSize: 11, display: 'inline-block', padding: '2px 6px', borderRadius: 4, background: bg } },
    oldNode, arrow, newNode,
  )

  return tooltip ? React.createElement(Tooltip, { title: tooltip }, content) : content
}

export function buildCompareColumns(
  diffResult: DiffResult,
  visibleColumns: string[],
  projectType: string,
  onViewProject: (projectId: string, market?: string) => void,
): ColumnsType<DiffRow> {
  const cols: ColumnsType<DiffRow> = []
  const typeColumns = getFixedColumnsForType(projectType)

  for (const col of typeColumns) {
    if (!visibleColumns.includes(col.key)) continue
    cols.push({
      title: col.title,
      key: col.key,
      width: col.key === 'projectName' ? 160 : 100,
      render: (_: any, row: DiffRow) => renderDiffCell(col.key, row),
    })
  }

  for (const ms of diffResult.mergedMilestones) {
    const field = `ms_${ms.name}`
    const titleNode = ms.onlyIn === 'target'
      ? React.createElement('span', null, ms.name, ' ', React.createElement(Tag, { color: 'green', style: { fontSize: 10, marginLeft: 4 } }, '新增'))
      : ms.onlyIn === 'base'
      ? React.createElement('span', { style: { color: '#9ca3af' } }, ms.name, ' ', React.createElement(Tag, { style: { fontSize: 10, marginLeft: 4 } }, '已删'))
      : ms.name
    cols.push({
      title: titleNode,
      key: field,
      width: 150,
      align: 'center' as const,
      render: (_: any, row: DiffRow) => renderDiffCell(field, row),
    })
  }

  if (projectType === '整机产品项目' && visibleColumns.includes('launchDate')) {
    cols.push({
      title: '产品上市',
      key: 'launchDate',
      width: 150,
      align: 'center' as const,
      render: (_: any, row: DiffRow) => renderDiffCell('launchDate', row),
    })
  }

  cols.push({
    title: '操作',
    key: 'action',
    fixed: 'right' as const,
    width: 90,
    render: (_: any, row: DiffRow) => {
      const src = row.target ?? row.base
      if (!src) return null
      return React.createElement(
        Button,
        {
          type: 'link',
          size: 'small',
          icon: React.createElement(EyeOutlined),
          onClick: () => onViewProject(src.projectId, src.market),
        },
        '查看/记录',
      )
    },
  })

  return cols
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes with no errors. If MilestoneView.tsx complains about missing `FIXED_COLUMNS` or similar, make sure Step 1's deletion also removed the unused `FIXED_COLUMNS` constant (it was only locally referenced).

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/roadmap/utils.ts src/components/roadmap/MilestoneView.tsx
git commit -m "feat(roadmap): add buildCompareColumns helper and hoist shared column configs"
```

---

## Task 3: Add global CSS for compare row backgrounds

**Files:**
- Modify: `src/styles/globals.css` (append)

- [ ] **Step 1: Append CSS classes**

Append at the end of `src/styles/globals.css`:

```css
/* Roadmap snapshot compare mode row backgrounds (added 2026-04-10) */
.pms-table .row-diff-added > td {
  background: #f0fdf4 !important;
  box-shadow: inset 3px 0 0 #22c55e;
}
.pms-table .row-diff-removed > td {
  background: #fef2f2 !important;
  box-shadow: inset 3px 0 0 #ef4444;
  color: #9ca3af;
  text-decoration: line-through;
}
.pms-table .row-diff-modified > td {
  background: #ffffff;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/globals.css
git commit -m "style(roadmap): add CSS classes for compare mode row backgrounds"
```

---

## Task 4: Add compare state and `diffResult` useMemo in MilestoneView

**Files:**
- Modify: `src/components/roadmap/MilestoneView.tsx`

- [ ] **Step 1: Add state declarations**

In `MilestoneView.tsx`, locate the existing snapshot state block (the `baselineSnapshots` / `activeSnapshotId` declarations, around lines 99–108). Immediately after it, add:

```ts
// Compare mode state (added 2026-04-10)
type CompareSource = 'live' | string
const [compareMode, setCompareMode] = useState(false)
const [compareBase, setCompareBase] = useState<CompareSource>('live')
const [compareTarget, setCompareTarget] = useState<CompareSource>('live')
const [onlyDiffRows, setOnlyDiffRows] = useState(true)
const [showCompareModal, setShowCompareModal] = useState(false)
```

- [ ] **Step 2: Add the `diffResult` useMemo**

Locate the existing `displayData` / `activeSnapshot` block (around lines 344–347). Immediately before that block, add:

```ts
// Compare mode: resolve sources and compute diff
const resolveCompareSource = (src: CompareSource): SnapshotLike => {
  if (src === 'live') {
    return { data: tableData, milestones: milestones.map(m => ({ name: m.name, order: m.order })) }
  }
  const snap = baselineSnapshots.find(s => s.id === src)
  if (!snap) {
    return { data: [], milestones: [] }
  }
  return { data: snap.data, milestones: snap.milestones }
}

const diffResult = useMemo(() => {
  if (!compareMode) return null
  const baseSrc = resolveCompareSource(compareBase)
  const targetSrc = resolveCompareSource(compareTarget)
  return diffSnapshots(baseSrc, targetSrc, projectType)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [compareMode, compareBase, compareTarget, tableData, milestones, baselineSnapshots, projectType])
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes. The imports from Task 2 Step 1 should already cover `diffSnapshots`, `SnapshotLike`.

- [ ] **Step 4: Commit**

```bash
git add src/components/roadmap/MilestoneView.tsx
git commit -m "feat(roadmap): add compare mode state and diffResult memo"
```

---

## Task 5: Wire display branches and rowClassName

**Files:**
- Modify: `src/components/roadmap/MilestoneView.tsx`

- [ ] **Step 1: Replace `displayData` / `displayMilestones` / `displayColumns` derivations**

Locate the current block (around lines 344–385). Replace it with:

```ts
// Get current display data (compare / snapshot / live)
const activeSnapshot = activeSnapshotId ? baselineSnapshots.find(s => s.id === activeSnapshotId) : null

const displayData: any[] = useMemo(() => {
  if (compareMode && diffResult) {
    let rows = diffResult.rows
    // Apply existing filters to diff rows (using target ?? base for field lookup)
    if (filters.productLine?.length) {
      rows = rows.filter(r => {
        const src = r.target ?? r.base
        return src && filters.productLine!.includes(src.productLine)
      })
    }
    if (filters.chipPlatform?.length) {
      rows = rows.filter(r => {
        const src = r.target ?? r.base
        return src && filters.chipPlatform!.includes(src.chipPlatform)
      })
    }
    if (filters.status?.length) {
      rows = rows.filter(r => {
        const src = r.target ?? r.base
        return src && filters.status!.includes(src.status)
      })
    }
    if (filters.tosVersion?.length) {
      rows = rows.filter(r => {
        const src = r.target ?? r.base
        return src && filters.tosVersion!.includes(src.tosVersion)
      })
    }
    if (onlyDiffRows) {
      rows = rows.filter(r => r.rowStatus !== 'same')
    }
    return rows
  }
  return activeSnapshot ? activeSnapshot.data : tableData
}, [compareMode, diffResult, onlyDiffRows, filters, activeSnapshot, tableData])

const displayMilestones = compareMode && diffResult
  ? diffResult.mergedMilestones
  : (activeSnapshot ? activeSnapshot.milestones : milestones)

// Rebuild columns (compare / snapshot / live)
const displayColumns = useMemo((): ColumnsType<any> => {
  if (compareMode && diffResult) {
    return buildCompareColumns(diffResult, visibleColumns, projectType, onViewProject)
  }
  if (!activeSnapshot) return columns

  // Existing snapshot column logic (unchanged)
  const cols: ColumnsType<any> = []
  const snapshotType = activeSnapshot.projectType
  const typeColumns = getFixedColumnsForType(snapshotType)
  for (const col of typeColumns) {
    if (!visibleColumns.includes(col.key)) continue
    if (col.key === 'status') {
      cols.push({
        title: col.title, dataIndex: col.key, key: col.key, width: 90,
        render: (val: string) => {
          const colorMap: Record<string, string> = { '进行中': 'processing', '已完成': 'success', '筹备中': 'warning', '暂停': 'default', '未开始': 'default' }
          return <Tag color={colorMap[val] || 'default'}>{val}</Tag>
        },
      })
    } else if (col.key === 'projectName') {
      cols.push({ title: col.title, dataIndex: col.key, key: col.key, width: 160, render: (text: string) => <span style={{ fontWeight: 500, fontSize: 13 }}>{text}</span> })
    } else {
      cols.push({ title: col.title, dataIndex: col.key, key: col.key, width: 100 })
    }
  }
  for (const ms of displayMilestones) {
    cols.push({
      title: ms.name, dataIndex: `ms_${ms.name}`, key: `ms_${ms.name}`, width: 120, align: 'center' as const,
      render: (val: string) => <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#4b5563' }}>{val}</span>,
    })
  }
  cols.push({
    title: '操作', key: 'action', fixed: 'right' as const, width: 80,
    render: (_: any, record: any) => (
      <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewProject(record.projectId, record.market)}>查看/记录</Button>
    ),
  })
  return cols
}, [compareMode, diffResult, activeSnapshot, visibleColumns, displayMilestones, onViewProject, projectType, columns])
```

- [ ] **Step 2: Update the `Table` invocation to add `rowClassName` and a stable key**

Locate the `tableComponent` definition (around line 410). Replace with:

```tsx
const tableComponent = (
  <Table
    className="pms-table"
    columns={displayColumns}
    dataSource={displayData}
    rowKey={(r: any) => compareMode ? r.rowKey : r.key}
    rowClassName={(r: any) => {
      if (!compareMode) return ''
      if (r.rowStatus === 'added') return 'row-diff-added'
      if (r.rowStatus === 'removed') return 'row-diff-removed'
      if (r.rowStatus === 'modified') return 'row-diff-modified'
      return ''
    }}
    scroll={{ x: 'max-content' }}
    size="small"
    pagination={{
      current: currentPage,
      pageSize,
      total: displayData.length,
      showSizeChanger: true,
      pageSizeOptions: ['10', '20', '50', '100'],
      showTotal: (total) => `共 ${total} 条`,
      onChange: (page, size) => {
        setCurrentPage(page)
        setPageSize(size)
      },
    }}
    locale={{ emptyText: <Empty description={compareMode && onlyDiffRows ? '两个版本无差异' : '暂无数据'} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
  />
)
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/roadmap/MilestoneView.tsx
git commit -m "feat(roadmap): wire compare mode into display data/columns/rowClassName"
```

---

## Task 6: Add "对比" button to toolbar + hide snapshot controls in compare mode

**Files:**
- Modify: `src/components/roadmap/MilestoneView.tsx`

- [ ] **Step 1: Add SwapOutlined import**

In the `@ant-design/icons` import statement near the top of the file, add `SwapOutlined`:

```ts
import {
  FilterOutlined, SettingOutlined, SaveOutlined, FullscreenOutlined, FullscreenExitOutlined,
  EyeOutlined, PlusOutlined, CameraOutlined, HistoryOutlined, DeleteOutlined, SwapOutlined,
} from '@ant-design/icons'
```

- [ ] **Step 2: Modify `toolbarActions` to add compare button and conditionally hide snapshot controls**

Locate the `toolbarActions` JSX (around lines 437–492). Replace the entire `toolbarActions = (...)` value with:

```tsx
const toolbarActions = (
  <Space size={6}>
    <Tooltip title="筛选">
      <Button
        icon={<FilterOutlined />}
        onClick={() => { setTempFilters({ ...filters }); setShowFilterModal(true) }}
        type={hasActiveFilters ? 'primary' : 'default'}
        ghost={hasActiveFilters}
        size="small"
        style={{ borderRadius: 6 }}
      >
        筛选{hasActiveFilters ? ' ●' : ''}
      </Button>
    </Tooltip>
    <Tooltip title="列设置">
      <Button icon={<SettingOutlined />} size="small" style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
    </Tooltip>
    <div style={{ width: 1, height: 18, background: '#e0e0e0' }} />
    <Tooltip title={compareMode ? '对比模式下不可创建快照' : '将当前数据创建基线快照'}>
      <Button
        icon={<CameraOutlined />}
        size="small"
        style={{ borderRadius: 6 }}
        onClick={handleCreateSnapshot}
        disabled={!!activeSnapshotId || compareMode}
      >
        快照
      </Button>
    </Tooltip>
    {!compareMode && currentSnapshots.length > 0 && (
      <Select
        value={activeSnapshotId || 'live'}
        onChange={(val) => setActiveSnapshotId(val === 'live' ? null : val)}
        style={{ width: 180 }}
        size="small"
        popupMatchSelectWidth={240}
        optionLabelProp="label"
      >
        <Select.Option value="live" label={<span style={{ fontSize: 12 }}><span style={{ color: '#52c41a', marginRight: 4 }}>●</span>实时数据</span>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#52c41a' }}>●</span>
            <span style={{ fontWeight: 500 }}>实时数据</span>
          </div>
        </Select.Option>
        {currentSnapshots.map(s => (
          <Select.Option key={s.id} value={s.id} label={<span style={{ fontSize: 12 }}><HistoryOutlined style={{ marginRight: 4, color: '#6366f1' }} />{s.version}</span>}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{s.version}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.createdAt}</div>
              </div>
              <DeleteOutlined style={{ color: '#ff4d4f', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(s.id) }} />
            </div>
          </Select.Option>
        ))}
      </Select>
    )}
    <Tooltip title={currentSnapshots.length === 0 ? '请先至少创建一个快照' : '对比两个版本'}>
      <Button
        icon={<SwapOutlined />}
        size="small"
        style={{ borderRadius: 6 }}
        onClick={() => setShowCompareModal(true)}
        disabled={currentSnapshots.length === 0}
        type={compareMode ? 'primary' : 'default'}
        ghost={compareMode}
      >
        {compareMode ? '对比中' : '对比'}
      </Button>
    </Tooltip>
    <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
      <Button icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} size="small" style={{ borderRadius: 6 }} onClick={() => setIsFullscreen(!isFullscreen)} />
    </Tooltip>
  </Space>
)
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/roadmap/MilestoneView.tsx
git commit -m "feat(roadmap): add compare button to toolbar and hide snapshot dropdown in compare mode"
```

---

## Task 7: Add compare entry Modal

**Files:**
- Modify: `src/components/roadmap/MilestoneView.tsx`

- [ ] **Step 1: Add the Modal JSX**

Locate the existing Modal definitions (after `showFilterModal`, `showColumnModal`, etc., toward the bottom of the component's JSX). Add a new Modal block before the closing `</div>` of the component return:

```tsx
{/* Compare Entry Modal */}
<Modal
  title="选择要对比的两个版本"
  open={showCompareModal}
  onCancel={() => setShowCompareModal(false)}
  onOk={() => {
    if (compareBase === compareTarget) {
      message.warning('请选择两个不同的版本')
      return
    }
    setCompareMode(true)
    setActiveSnapshotId(null)
    setShowCompareModal(false)
    setCurrentPage(1)
  }}
  okText="开始对比"
  cancelText="取消"
  width={480}
>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
    <div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>基准版本（旧）</div>
      <Select
        value={compareBase}
        onChange={setCompareBase}
        style={{ width: '100%' }}
      >
        <Select.Option value="live">
          <span style={{ color: '#52c41a', marginRight: 4 }}>●</span>实时数据
        </Select.Option>
        {currentSnapshots.map(s => (
          <Select.Option key={s.id} value={s.id}>
            <HistoryOutlined style={{ marginRight: 4, color: '#6366f1' }} />
            {s.version}
            <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>{s.createdAt}</span>
          </Select.Option>
        ))}
      </Select>
    </div>
    <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>↓ 对比到 ↓</div>
    <div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>对比版本（新）</div>
      <Select
        value={compareTarget}
        onChange={setCompareTarget}
        style={{ width: '100%' }}
      >
        <Select.Option value="live">
          <span style={{ color: '#52c41a', marginRight: 4 }}>●</span>实时数据
        </Select.Option>
        {currentSnapshots.map(s => (
          <Select.Option key={s.id} value={s.id}>
            <HistoryOutlined style={{ marginRight: 4, color: '#6366f1' }} />
            {s.version}
            <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>{s.createdAt}</span>
          </Select.Option>
        ))}
      </Select>
    </div>
  </div>
</Modal>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/roadmap/MilestoneView.tsx
git commit -m "feat(roadmap): add compare entry modal for picking two versions"
```

---

## Task 8: Add compare summary bar

**Files:**
- Modify: `src/components/roadmap/MilestoneView.tsx`

- [ ] **Step 1: Add a helper to format version labels**

Inside the `MilestoneView` component, add this helper above the JSX `return` (near other utility declarations):

```ts
const formatCompareSrcLabel = (src: CompareSource): string => {
  if (src === 'live') return '实时数据'
  const snap = baselineSnapshots.find(s => s.id === src)
  return snap ? snap.version : src
}
```

- [ ] **Step 2: Add the summary bar JSX**

Locate the existing "快照提示条" block (around lines 591–609, the `{activeSnapshot && (...)` block). Replace that entire block with:

```tsx
{/* 快照提示条（单快照查看时） */}
{activeSnapshot && !compareMode && (
  <div style={{
    padding: '8px 16px', marginBottom: 12, borderRadius: 8,
    background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    border: '1px solid rgba(99,102,241,0.2)',
    boxShadow: '0 2px 8px rgba(99,102,241,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }}>
    <Space size={8}>
      <HistoryOutlined style={{ color: '#6366f1' }} />
      <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 500 }}>
        基线快照: {activeSnapshot.version}
      </span>
      <Tag color="blue" style={{ fontSize: 11 }}>{activeSnapshot.createdAt}</Tag>
    </Space>
    <Button type="link" size="small" onClick={() => setActiveSnapshotId(null)}>返回实时数据</Button>
  </div>
)}

{/* 对比摘要条（对比模式时） */}
{compareMode && diffResult && (
  <div style={{
    padding: '10px 16px', marginBottom: 12, borderRadius: 8,
    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    border: '1px solid rgba(217,119,6,0.25)',
    boxShadow: '0 2px 8px rgba(217,119,6,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 8,
  }}>
    <Space size={10} wrap>
      <SwapOutlined style={{ color: '#b45309', fontSize: 16 }} />
      <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>对比模式</span>
      <Tag color="default" style={{ fontSize: 11 }}>基准: {formatCompareSrcLabel(compareBase)}</Tag>
      <ArrowRightOutlined style={{ color: '#9ca3af', fontSize: 11 }} />
      <Tag color="gold" style={{ fontSize: 11 }}>对比: {formatCompareSrcLabel(compareTarget)}</Tag>
      <span style={{ color: '#22c55e', fontSize: 12 }}>🟢 新增 {diffResult.summary.added} 行</span>
      <span style={{ color: '#ef4444', fontSize: 12 }}>🔴 删除 {diffResult.summary.removed} 行</span>
      <span style={{ color: '#d97706', fontSize: 12 }}>🟠 修改 {diffResult.summary.modified} 行（共 {diffResult.summary.cellChanges} 处字段变化）</span>
    </Space>
    <Space size={6}>
      <Checkbox checked={onlyDiffRows} onChange={e => { setOnlyDiffRows(e.target.checked); setCurrentPage(1) }}>
        <span style={{ fontSize: 12 }}>只看有差异的行</span>
      </Checkbox>
      <Button size="small" onClick={() => setShowCompareModal(true)}>切换版本</Button>
      <Button size="small" danger onClick={() => setCompareMode(false)}>退出对比</Button>
    </Space>
  </div>
)}
```

- [ ] **Step 3: Add `ArrowRightOutlined` to icon imports**

In the `@ant-design/icons` import statement at the top of the file, add `ArrowRightOutlined`:

```ts
import {
  FilterOutlined, SettingOutlined, SaveOutlined, FullscreenOutlined, FullscreenExitOutlined,
  EyeOutlined, PlusOutlined, CameraOutlined, HistoryOutlined, DeleteOutlined, SwapOutlined, ArrowRightOutlined,
} from '@ant-design/icons'
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/roadmap/MilestoneView.tsx
git commit -m "feat(roadmap): add compare summary bar with row counts and exit controls"
```

---

## Task 9: Add side effects for auto-exit (snapshot deletion, projectType change)

**Files:**
- Modify: `src/components/roadmap/MilestoneView.tsx`

- [ ] **Step 1: Extend the existing projectType-sync useEffect**

Locate the existing `useEffect` that syncs `initialProjectType` (around lines 114–122). Update it to also reset compare state:

```ts
useEffect(() => {
  if (initialProjectType && initialProjectType !== projectType && PROJECT_TYPES.includes(initialProjectType)) {
    setProjectTypeLocal(initialProjectType)
    setActiveViewId(DEFAULT_VIEW_ID)
    setFilters({})
    setCurrentPage(1)
    setActiveSnapshotId(null)
    setCompareMode(false)
  }
}, [initialProjectType])
```

- [ ] **Step 2: Update the projectType tab click handler**

Locate the `onClick` handler on the `PROJECT_TYPES.map` tabs (around lines 507–513). Add `setCompareMode(false)`:

```tsx
onClick={() => {
  setProjectType(t)
  setActiveViewId(DEFAULT_VIEW_ID)
  setFilters({})
  setCurrentPage(1)
  setActiveSnapshotId(null)
  setCompareMode(false)
}}
```

(Note: the variable is likely `setProjectTypeLocal` or a wrapper named `setProjectType` — use whichever is currently there; don't rename.)

- [ ] **Step 3: Add a useEffect for snapshot deletion auto-exit**

Add this new `useEffect` right after the `resolveCompareSource` / `diffResult` declaration block from Task 4:

```ts
// Auto-exit compare mode if a selected snapshot is deleted
useEffect(() => {
  if (!compareMode) return
  const baseOk = compareBase === 'live' || baselineSnapshots.some(s => s.id === compareBase)
  const targetOk = compareTarget === 'live' || baselineSnapshots.some(s => s.id === compareTarget)
  if (!baseOk || !targetOk) {
    setCompareMode(false)
    message.info('所选快照已被删除，已退出对比')
  }
}, [baselineSnapshots, compareMode, compareBase, compareTarget])
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/roadmap/MilestoneView.tsx
git commit -m "feat(roadmap): auto-exit compare mode on snapshot deletion or projectType change"
```

---

## Task 10: Manual verification

**Files:** none

- [ ] **Step 1: Start dev server**

Run in a separate terminal: `npm run dev`
Open: `http://localhost:3004` (or whatever port it shows)

- [ ] **Step 2: Walk through the verification checklist**

Navigate to 项目路标视图 → 里程碑视图. Verify each item:

- [ ] With zero snapshots: "对比" button is disabled, tooltip shows "请先至少创建一个快照"
- [ ] Create two snapshots (click 快照 button twice, ideally after changing project data in between via other modules — or just verify with two identical snapshots as a baseline)
- [ ] Click "对比" → modal opens, pick two different versions, click "开始对比"
- [ ] Table switches to compare mode: yellow/amber summary bar appears at top with row counts, rowClassName applies colors
- [ ] When data differs: modified cells show `旧 → 新` with amber background; date-earlier cells show blue bg; date-later cells show red bg; tooltips show "提前/延后 N 天"
- [ ] Added rows have green left border + green bg; removed rows have red + strikethrough
- [ ] Milestone columns only in one side show `新增` / `已删` Tag in header
- [ ] "只看有差异的行" Checkbox toggles filtering
- [ ] Two identical versions + "只看有差异的行" on → shows `两个版本无差异` empty state
- [ ] Existing filter modal still works in compare mode; filtered + onlyDiffRows stacks
- [ ] Column setting modal hides columns correctly in compare mode
- [ ] Delete a snapshot that's currently selected in compare → auto-exits with toast "所选快照已被删除，已退出对比"
- [ ] Switch projectType tab → compare mode exits
- [ ] "查看/记录" button in compare mode jumps correctly (both modified and removed rows)
- [ ] "切换版本" in summary bar reopens modal with current selection pre-filled
- [ ] "退出对比" returns to live/snapshot view
- [ ] In compare mode, 快照 button disabled (tooltip "对比模式下不可创建快照"), snapshot dropdown hidden
- [ ] Fullscreen mode works in compare mode

- [ ] **Step 3: Final build + typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass.

- [ ] **Step 4: Final commit (if any fixups)**

If the manual pass surfaced bugs, fix them in small commits. Otherwise this step is a no-op.

---

## Rollback

If things go badly wrong: `git log --oneline` to find commits from this plan, then `git revert <commit>` in reverse order. Each task is its own commit, so granular rollback is straightforward.

## Out of Scope (do NOT implement)

- Exporting compare result to Excel/PDF
- Persisting compare history
- Three-way or multi-way compare
- Configurable field diff whitelist
- Cross-projectType compare
- Extracting compare mode into its own component file
