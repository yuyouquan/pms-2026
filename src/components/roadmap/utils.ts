import type { MilestoneInfo, RoadmapViewConfig } from '@/types'

const STORAGE_KEY = 'pms_roadmap_milestone_views'

/** 推断里程碑排序权重 */
export function inferMilestoneOrder(name: string): number {
  if (name === '概念启动') return 0
  // 匹配 STR 后跟数字和可选的 /数字 组合
  const strMatch = name.match(/^STR(\d+(?:\/\d+)*)$/)
  if (strMatch) {
    const parts = strMatch[1].split('/')
    const first = parseInt(parts[0], 10)
    // STR1 = 10, STR2 = 20, STR1/2/3 = 15 (取中间值)
    if (parts.length > 1) {
      const last = parseInt(parts[parts.length - 1], 10)
      return (first * 10 + last * 10) / 2
    }
    return first * 10
  }
  // 其他名称按字母排序，放在后面
  return 1000
}

/** 从项目列表中聚合里程碑（去重并排序） */
export function aggregateMilestones(
  projects: any[],
  projectType: string,
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>,
  level1Tasks: any[]
): MilestoneInfo[] {
  const milestoneSet = new Set<string>()
  const filtered = projects.filter(p => p.type === projectType)

  for (const project of filtered) {
    if (project.type === '整机产品项目' && project.markets?.length > 0) {
      // 整机产品项目：使用第一个市场的 tasks
      const firstMarket = project.markets[0]
      const data = marketPlanData[firstMarket]
      if (data?.tasks) {
        for (const task of data.tasks) {
          if (task.parentId) {
            milestoneSet.add(task.taskName)
          }
        }
      }
    } else {
      // 其他项目类型：使用 level1Tasks
      for (const task of level1Tasks) {
        if (task.parentId) {
          milestoneSet.add(task.taskName)
        }
      }
    }
  }

  const milestones: MilestoneInfo[] = Array.from(milestoneSet).map(name => ({
    name,
    order: inferMilestoneOrder(name),
  }))

  milestones.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  return milestones
}

/** 生成表格数据行 */
export function generateTableData(
  projects: any[],
  milestones: MilestoneInfo[],
  projectType: string,
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>,
  level1Tasks: any[]
): any[] {
  const filtered = projects.filter(p => p.type === projectType)
  const rows: any[] = []

  for (const project of filtered) {
    if (project.type === '整机产品项目') {
      const row: any = {
        key: project.id,
        projectId: project.id,
        projectName: project.name,
        productLine: project.productLine || '-',
        chipPlatform: project.chipPlatform || '-',
        tosVersion: project.tosVersion || '-',
        status: project.status,
        spm: project.spm || '-',
        brand: project.brand || '-',
        productType: project.productType || '-',
        memory: project.memory || '-',
        versionType: project.versionType || '-',
        developMode: project.developMode || '-',
        launchDate: project.launchDate || '-',
        currentNode: project.currentNode || '-',
      }

      // Use first market's tasks for milestone data
      const firstMarket = project.markets?.[0]
      const data = firstMarket ? marketPlanData[firstMarket] : null
      for (const ms of milestones) {
        const task = data?.tasks?.find((t: any) => t.parentId && t.taskName === ms.name)
        row[`ms_${ms.name}`] = task?.planEndDate || '-'
      }

      rows.push(row)
    } else {
      const row: any = {
        key: project.id,
        projectId: project.id,
        projectName: project.name,
        market: undefined,
        productLine: project.productLine || '-',
        chipPlatform: project.chipPlatform || '-',
        tosVersion: project.tosVersion || '-',
        status: project.status,
        spm: project.spm || '-',
        versionType: project.versionType || '-',
        currentNode: project.currentNode || '-',
      }

      for (const ms of milestones) {
        const task = level1Tasks.find((t: any) => t.parentId && t.taskName === ms.name)
        row[`ms_${ms.name}`] = task?.planEndDate || '-'
      }

      rows.push(row)
    }
  }

  return rows
}

/** 保存视图配置到 localStorage */
export function saveView(config: RoadmapViewConfig): void {
  try {
    const views = loadAllViews()
    const existIdx = views.findIndex(v => v.id === config.id)
    if (existIdx >= 0) {
      views[existIdx] = config
    } else {
      views.push(config)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    // graceful fail
  }
}

/** 从 localStorage 加载所有保存的视图 */
export function loadAllViews(): RoadmapViewConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 删除指定视图 */
export function deleteView(id: string): void {
  try {
    const views = loadAllViews().filter(v => v.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    // graceful fail
  }
}

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

/** Compare two date-field values, returning the appropriate CellDiff. */
function compareDateField(oldVal: any, newVal: any): CellDiff {
  if (oldVal === newVal) return { kind: 'same' }
  const od = tryParseDate(oldVal)
  const nd = tryParseDate(newVal)
  if (od && nd) {
    if (nd.getTime() === od.getTime()) return { kind: 'same' }
    if (nd.getTime() < od.getTime()) return { kind: 'dateEarlier', oldVal, newVal, days: dayDiff(od, nd) }
    return { kind: 'dateLater', oldVal, newVal, days: dayDiff(nd, od) }
  }
  return { kind: 'changed', oldVal, newVal }
}

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
        const result = compareDateField(oldVal, newVal)
        cellDiffs[f] = result
        if (result.kind !== 'same') { hasChange = true; summary.cellChanges++ }
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
      const result = compareDateField(b[mf], t[mf])
      cellDiffs[mf] = result
      if (result.kind !== 'same') { hasChange = true; summary.cellChanges++ }
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
