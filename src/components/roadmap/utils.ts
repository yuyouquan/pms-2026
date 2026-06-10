import type { MilestoneInfo, RoadmapViewConfig } from '@/types'
import React from 'react'
import type { ColumnsType } from 'antd/es/table'
import { Tag, Tooltip, Button } from 'antd'
import { EyeOutlined, ArrowRightOutlined } from '@ant-design/icons'

const STORAGE_KEY = 'pms_roadmap_milestone_views'

export interface RoadmapColumnConfig {
  key: string
  title: string
  width?: number
  defaultVisible?: boolean
  locked?: boolean
}

// Shared project-info column configs.
export const SOFTWARE_PROJECT_INFO_COLUMNS: RoadmapColumnConfig[] = [
  { key: 'projectName', title: '项目名称', width: 170, defaultVisible: true, locked: true },
  { key: 'status', title: '项目状态', width: 100, defaultVisible: true },
  { key: 'healthStatus', title: '健康状态', width: 100 },
  { key: 'currentNode', title: '当前节点', width: 110, defaultVisible: true },
  { key: 'brand', title: '品牌', width: 100 },
  { key: 'productLine', title: '产品线', width: 110 },
  { key: 'versionType', title: '版本类型', width: 100, defaultVisible: true },
  { key: 'chipPlatform', title: '芯片平台', width: 110, defaultVisible: true },
  { key: 'developMode', title: '开发模式', width: 100, defaultVisible: true },
  { key: 'spm', title: 'SPM', width: 90, defaultVisible: true },
  { key: 'projectDescription', title: '项目描述', width: 220 },
]

export const MACHINE_PROJECT_INFO_COLUMNS: RoadmapColumnConfig[] = [
  { key: 'tosVersion', title: 'tOS版本', width: 110, defaultVisible: true },
  { key: 'brand', title: '品牌', width: 100, defaultVisible: true },
  { key: 'productLine', title: '产品线', width: 110, defaultVisible: true },
  { key: 'projectName', title: '项目名', width: 170, defaultVisible: true, locked: true },
  { key: 'market', title: '市场', width: 80, defaultVisible: true, locked: true },
  { key: 'chipPlatform', title: '芯片平台', width: 110, defaultVisible: true },
  { key: 'memory', title: '内存', width: 110, defaultVisible: true },
  { key: 'versionType', title: '版本类型', width: 100, defaultVisible: true },
  { key: 'cooperationForm', title: '合作形式', width: 110, defaultVisible: true },
  { key: 'healthStatus', title: '健康状态', width: 100 },
  { key: 'spm', title: 'SPM', width: 90, defaultVisible: true },
  { key: 'mainboard', title: '主板名', width: 110 },
  { key: 'marketName', title: '市场名', width: 120 },
  { key: 'currentNode', title: '当前节点', width: 110 },
  { key: 'productType', title: '产品类型', width: 100, defaultVisible: true },
  { key: 'androidVersion', title: '安卓版本', width: 110 },
  { key: 'developMode', title: '研发模式', width: 100 },
  { key: 'projectLevel', title: '项目等级', width: 100 },
  { key: 'projectDescription', title: '项目描述', width: 220 },
  { key: 'cpu', title: '芯片型号', width: 110 },
  { key: 'bom', title: 'Bom', width: 130 },
  { key: 'lcd', title: '屏幕', width: 120 },
  { key: 'screenShape', title: '屏幕形态', width: 100 },
  { key: 'screenType', title: '屏幕类型', width: 100 },
  { key: 'frontCamera', title: '前摄像头', width: 120 },
  { key: 'primaryCamera', title: '后摄像头', width: 140 },
  { key: 'networkMode', title: '网络模式', width: 100 },
  { key: 'kernelVersion', title: 'kernel版本', width: 110 },
  { key: 'lightEffect', title: '灯效', width: 90 },
  { key: 'faceRecognition', title: '人脸', width: 120 },
  { key: 'soundEffect', title: '音效', width: 110 },
  { key: 'simCard', title: 'SIM卡', width: 110 },
  { key: 'motor', title: '马达', width: 110 },
  { key: 'fingerprint', title: '指纹', width: 130 },
  { key: 'infrared', title: '红外', width: 90 },
]

export const OVERALL_PROJECT_INFO_COLUMNS: RoadmapColumnConfig[] = [
  { key: 'tosVersionGroup', title: 'tOS版本', width: 120, defaultVisible: true, locked: true },
  { key: 'productCategory', title: '产品分类', width: 130, defaultVisible: true, locked: true },
  { key: 'productSeries', title: '产品系列', width: 140, defaultVisible: true, locked: true },
  { key: 'projectName', title: '项目名', width: 170, defaultVisible: true, locked: true },
  { key: 'status', title: '项目状态', width: 100, defaultVisible: true },
  { key: 'spm', title: 'SPM', width: 90, defaultVisible: true },
  { key: 'department', title: '部门', width: 120, defaultVisible: true },
]

export const TECH_PROJECT_INFO_COLUMNS: RoadmapColumnConfig[] = [
  { key: 'productSeries', title: '领域', width: 130, defaultVisible: true },
  { key: 'projectName', title: '项目名', width: 170, defaultVisible: true, locked: true },
  { key: 'status', title: '项目状态', width: 100, defaultVisible: true },
  { key: 'healthStatus', title: '健康状态', width: 100 },
  { key: 'currentNode', title: '当前节点', width: 110, defaultVisible: true },
  { key: 'tosVersions', title: 'tOS版本', width: 120, defaultVisible: true },
  { key: 'chipPlatform', title: '芯片平台', width: 110, defaultVisible: true },
  { key: 'spm', title: 'SPM', width: 90, defaultVisible: true },
  { key: 'projectDescription', title: '项目描述', width: 220 },
]

// Backwards-compatible aliases used by older callers.
export const SOFTWARE_FIXED_COLUMNS = SOFTWARE_PROJECT_INFO_COLUMNS
export const MACHINE_FIXED_COLUMNS = MACHINE_PROJECT_INFO_COLUMNS

export function getFixedColumnsForType(projectType: string): RoadmapColumnConfig[] {
  if (projectType === '整体') return OVERALL_PROJECT_INFO_COLUMNS
  if (projectType === '整机产品项目') return MACHINE_PROJECT_INFO_COLUMNS
  if (projectType === '技术项目') return TECH_PROJECT_INFO_COLUMNS
  return SOFTWARE_PROJECT_INFO_COLUMNS
}

export function getMilestoneColumnKey(name: string) {
  return `ms_${name}`
}

export function isRoadmapColumnVisible(projectType: string, visibleColumns: string[], key: string) {
  const infoCol = getFixedColumnsForType(projectType).find(c => c.key === key)
  return !!infoCol?.locked || visibleColumns.includes(key)
}

export function getDefaultVisibleColumns(projectType: string, milestones: MilestoneInfo[] = []) {
  return [
    ...getFixedColumnsForType(projectType).filter(c => c.defaultVisible && !c.locked).map(c => c.key),
    ...milestones.filter(m => m.defaultRoadmap).map(m => getMilestoneColumnKey(m.name)),
  ]
}

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

function getTaskDepth(task: any, allTasks: any[]): number {
  if (!task.parentId) return 0
  const parent = allTasks.find(t => t.id === task.parentId)
  if (!parent) return 1
  return 1 + getTaskDepth(parent, allTasks)
}

/** 从配置中心最新已发布模板中聚合二级任务为里程碑列 */
export function aggregateMilestones(templateTasks: any[]): MilestoneInfo[] {
  const milestoneMap = new Map<string, MilestoneInfo>()
  templateTasks.forEach((task, index) => {
    if (!task.parentId || getTaskDepth(task, templateTasks) !== 1) return
    if (milestoneMap.has(task.taskName)) return
    milestoneMap.set(task.taskName, {
      name: task.taskName,
      order: index,
      defaultRoadmap: !!task.defaultRoadmap,
    })
  })

  return Array.from(milestoneMap.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return inferMilestoneOrder(a.name) - inferMilestoneOrder(b.name)
  })
}

function normalizeValue(value: any): string {
  if (Array.isArray(value)) return value.join(',')
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

function buildProjectInfo(project: any, projectType: string, market?: string): any {
  const isMachine = projectType === '整机产品项目'
  return {
    projectId: project.id,
    projectName: project.name,
    market: isMachine ? normalizeValue(market) : undefined,
    tosVersion: normalizeValue(project.tosVersion),
    brand: normalizeValue(project.brand),
    productLine: normalizeValue(project.productLine),
    chipPlatform: normalizeValue(project.chipPlatform),
    memory: normalizeValue(project.memory),
    versionType: normalizeValue(project.versionType),
    cooperationForm: normalizeValue(project.cooperationForm),
    healthStatus: normalizeValue(project.healthStatus),
    status: normalizeValue(project.status),
    spm: normalizeValue(project.spm),
    mainboard: normalizeValue(project.mainboard),
    marketName: normalizeValue(project.marketName),
    currentNode: normalizeValue(project.currentNode),
    productType: normalizeValue(project.productType),
    androidVersion: normalizeValue(project.androidVersion || project.operatingSystem),
    developMode: normalizeValue(project.developMode),
    projectLevel: normalizeValue(project.projectLevel),
    projectDescription: normalizeValue(project.projectDescription || project.description),
    cpu: normalizeValue(project.cpu),
    bom: normalizeValue(project.bom),
    lcd: normalizeValue(project.lcd),
    screenShape: normalizeValue(project.screenShape),
    screenType: normalizeValue(project.screenType),
    frontCamera: normalizeValue(project.frontCamera),
    primaryCamera: normalizeValue(project.primaryCamera),
    networkMode: normalizeValue(project.networkMode),
    kernelVersion: normalizeValue(project.kernelVersion),
    lightEffect: normalizeValue(project.lightEffect),
    faceRecognition: normalizeValue(project.faceRecognition),
    soundEffect: normalizeValue(project.soundEffect),
    simCard: normalizeValue(project.simCard),
    motor: normalizeValue(project.motor),
    fingerprint: normalizeValue(project.fingerprint),
    infrared: normalizeValue(project.infrared),
  }
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
      const markets = project.markets?.length ? project.markets : [project.market || '-']
      for (const market of markets) {
        const row: any = {
          key: `${project.id}::${market}`,
          ...buildProjectInfo(project, projectType, market),
        }
        const data = market ? marketPlanData[market] : null
        for (const ms of milestones) {
          const task = data?.tasks?.find((t: any) => t.parentId && t.taskName === ms.name)
          row[getMilestoneColumnKey(ms.name)] = task?.planEndDate || '-'
        }
        rows.push(row)
      }
    } else {
      const row: any = {
        key: project.id,
        ...buildProjectInfo(project, projectType),
      }

      for (const ms of milestones) {
        const task = level1Tasks.find((t: any) => t.parentId && t.taskName === ms.name)
        row[getMilestoneColumnKey(ms.name)] = task?.planEndDate || '-'
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
  return getFixedColumnsForType(projectType).map(c => c.key)
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
  const milestoneFields = mergedMilestones.map(m => getMilestoneColumnKey(m.name))

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

  // At this point diff.kind is one of: 'changed' | 'dateEarlier' | 'dateLater' | 'added' | 'removed'
  // 'added'/'removed' on a row-level diff shouldn't reach here but guard anyway
  if (diff.kind === 'added' || diff.kind === 'removed') {
    return React.createElement('span', { style: { fontSize: 11 } }, String(targetVal ?? baseVal ?? '-'))
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
    if (!isRoadmapColumnVisible(projectType, visibleColumns, col.key)) continue
    cols.push({
      title: col.title,
      key: col.key,
      width: col.width || (col.key === 'projectName' ? 160 : 100),
      fixed: col.locked ? 'left' as const : undefined,
      render: (_: any, row: DiffRow) => renderDiffCell(col.key, row),
    })
  }

  for (const ms of diffResult.mergedMilestones) {
    const field = getMilestoneColumnKey(ms.name)
    if (!visibleColumns.includes(field)) continue
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
