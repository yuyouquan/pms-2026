'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Drawer, Dropdown, Empty, Input, Modal, Select, Space, Table, Tabs, Tag, Tooltip } from 'antd'
import { CaretDownOutlined, CaretRightOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, FilterOutlined, FullscreenExitOutlined, FullscreenOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  inferOsSeriesFromProjectName,
  inferTosVersionFromProjectName,
} from '@/constants/projectBasicFields'
import type { FilterCondition } from '@/lib/filterConditions'
import {
  FILTER_OPERATORS,
  applyFilterConditions,
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  isFilterConditionActive,
  isValuelessFilterOperator,
  normalizeFilterConditions,
} from '@/lib/filterConditions'
import { getFixedColumnsForType, type RoadmapColumnConfig } from './utils'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'

type SummaryScope = 'overall' | 'machine' | 'software' | 'tech'
type SummaryStatus = '进行中' | '已完成' | '已上市' | '维护期'
type StatusFilter = 'all' | SummaryStatus

interface ProjectPlanSummaryBoardProps {
  projects: any[]
  onViewProject: (projectId: string, market?: string) => void
}

interface SummaryMilestone {
  name: string
  date: string
}

interface SummaryRow {
  [key: string]: any
  key: string
  projectId: string
  projectType: string
  productCategory: string
  productSeries: string
  projectName: string
  status: SummaryStatus
  spm: string
  department: string
  milestones: SummaryMilestone[]
  milestonesText: string
  isCollapsedPreview?: boolean
  hiddenProjectCount?: number
}

const SUMMARY_SCOPES: { key: SummaryScope; label: string }[] = [
  { key: 'overall', label: '整体' },
  { key: 'machine', label: '整机产品项目' },
  { key: 'software', label: '软件产品项目' },
  { key: 'tech', label: '技术项目' },
]

const SUMMARY_VISIBLE_STATUSES: SummaryStatus[] = ['进行中', '已完成', '已上市', '维护期']

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '进行中', label: '进行中' },
  { key: '已完成', label: '已完成' },
  { key: '已上市', label: '已上市' },
  { key: '维护期', label: '维护期' },
]

const CATEGORY_ORDER = ['CAMON', 'Note', 'SPARK', 'POVA', 'tOS版本', '技术项目']

const CATEGORY_THEME: Record<string, { key: string; label?: string; color: string; bg: string; seriesBg: string; accent: string }> = {
  CAMON: { key: 'camon', color: '#2563eb', bg: '#eff6ff', seriesBg: '#f8fbff', accent: '#3b82f6' },
  Note: { key: 'note', label: 'NOTE', color: '#7c3aed', bg: '#f5f3ff', seriesBg: '#faf7ff', accent: '#8b5cf6' },
  SPARK: { key: 'spark', color: '#059669', bg: '#ecfdf5', seriesBg: '#f4fff9', accent: '#10b981' },
  POVA: { key: 'pova', color: '#d97706', bg: '#fffbeb', seriesBg: '#fffdf2', accent: '#f59e0b' },
  tOS版本: { key: 'tos', color: '#0891b2', bg: '#ecfeff', seriesBg: '#f0fdfa', accent: '#06b6d4' },
  技术项目: { key: 'tech', color: '#0f766e', bg: '#ecfdf5', seriesBg: '#f0fdf4', accent: '#14b8a6' },
}

const DEFAULT_CATEGORY_THEME = { key: 'default', color: '#475569', bg: '#f8fafc', seriesBg: '#ffffff', accent: '#94a3b8' }

const getCategoryTheme = (category: string) => CATEGORY_THEME[category] || DEFAULT_CATEGORY_THEME

const STATUS_COLORS: Record<string, string> = {
  已上市: 'gold',
  进行中: 'orange',
  维护: 'purple',
  维护期: 'purple',
  已完成: 'cyan',
  已迁移: 'default',
  筹备中: 'blue',
}

const STATUS_DOT_COLORS: Record<SummaryStatus, string> = {
  进行中: '#10b981',
  已完成: '#06b6d4',
  已上市: '#3b82f6',
  维护期: '#ef4444',
}

const DEPARTMENT_BY_PROJECT: Record<string, string> = {
  '1': '软件项目一部',
  '3': '集成维护部',
  '7': '软件项目二部',
  '2': '软件项目一部',
  '6': '软件项目一部',
  '8': '软件项目二部',
  '4': '集成维护部',
  '9': '软件项目二部',
}

const MACHINE_MILESTONE_NAMES = ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', 'STR6']
const SOFTWARE_MILESTONE_NAMES = ['概念启动', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5', 'MR6', 'MR7']
const TECH_MILESTONE_NAMES = ['概念启动', 'TDR1', 'TDR2', 'TDR3', 'TDR4']
const BASE_COLUMN_OPTIONS: RoadmapColumnConfig[] = [
  { key: 'productCategory', title: '产品分类', width: 150, defaultVisible: true, locked: true },
  { key: 'productSeries', title: '产品系列', width: 146, defaultVisible: true },
  { key: 'projectName', title: '项目名', width: 176, defaultVisible: true, locked: true },
  { key: 'status', title: '状态', width: 104, defaultVisible: true },
  { key: 'spm', title: 'SPM', width: 90, defaultVisible: true },
  { key: 'department', title: '部门', width: 128, defaultVisible: true },
  { key: 'milestones', title: '里程碑节点', width: 720, defaultVisible: true },
]
const BASE_COLUMN_KEYS = new Set(BASE_COLUMN_OPTIONS.map(col => col.key))
const SUMMARY_DRAWER_Z_INDEX = 1200

const toDate = (baseDate: string | undefined, index: number, rowOffset: number) => {
  const base = baseDate && dayjs(baseDate).isValid() ? dayjs(baseDate) : dayjs('2026-01-01')
  return base.add(index * 30 + rowOffset * 5, 'day').format('YYYY/M/D')
}

const splitValues = (value: any) => String(value || '').split(',').map(item => item.trim()).filter(Boolean)

const buildMilestones = (project: any, names: string[], rowIndex: number): SummaryMilestone[] => (
  names.map((name, index) => ({
    name,
    date: toDate(project.planStartDate, index, rowIndex % 3),
  }))
)

const getMachineCategory = (project: any) => project.productCategory || (project.productLine === 'NOTE' ? 'Note' : project.productLine || 'CAMON')
const getMachineSeries = (project: any) => project.productSeries || project.productLine || '未分系列'
const getSoftwareSeries = (project: any) => project.osSeries || inferOsSeriesFromProjectName(project.name) || `${inferTosVersionFromProjectName(project.name).split('.')[0] || '16'}.X`
const getTechSeries = (project: any) => splitValues(project.domain)[0] || project.productLine || '基础架构'
const normalizeSummaryStatus = (status: any): SummaryStatus | null => {
  const value = String(status || '').trim()
  if (value === '维护') return '维护期'
  if (SUMMARY_VISIBLE_STATUSES.includes(value as SummaryStatus)) return value as SummaryStatus
  return null
}
const normalizeValue = (value: any) => {
  if (Array.isArray(value)) return value.join(',')
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

const buildProjectFields = (project: any) => ({
  tosVersion: normalizeValue(project.tosVersion),
  brand: normalizeValue(project.brand),
  productLine: normalizeValue(project.productLine),
  market: normalizeValue(project.market || project.markets),
  chipPlatform: normalizeValue(project.chipPlatform),
  memory: normalizeValue(project.memory),
  versionType: normalizeValue(project.versionType),
  cooperationForm: normalizeValue(project.cooperationForm),
  healthStatus: normalizeValue(project.healthStatus),
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
})

function getExtraColumnsForScope(scope: SummaryScope): RoadmapColumnConfig[] {
  if (scope === 'machine') return getFixedColumnsForType('整机产品项目').filter(col => !BASE_COLUMN_KEYS.has(col.key))
  if (scope === 'software') return getFixedColumnsForType('软件产品项目').filter(col => !BASE_COLUMN_KEYS.has(col.key))
  return []
}

function getAvailableColumnsForScope(scope: SummaryScope): RoadmapColumnConfig[] {
  const baseColumns = BASE_COLUMN_OPTIONS.filter(col => scope === 'overall' || col.key !== 'productCategory')
  return [...baseColumns, ...getExtraColumnsForScope(scope)]
}

function getDefaultVisibleColumnsForScope(scope: SummaryScope) {
  return getAvailableColumnsForScope(scope)
    .filter(col => col.locked || col.defaultVisible)
    .map(col => col.key)
}

const makeSummaryRows = (projects: any[]): SummaryRow[] => {
  const rows: SummaryRow[] = []
  let rowIndex = 0

  for (const project of projects) {
    const status = normalizeSummaryStatus(project.status)
    if (!status) continue

    if (project.type === '整机产品项目') {
      const milestones = buildMilestones(project, MACHINE_MILESTONE_NAMES, rowIndex)
      rows.push({
        key: `machine-${project.id}`,
        projectId: project.id,
        projectType: project.type,
        ...buildProjectFields(project),
        productCategory: getMachineCategory(project),
        productSeries: getMachineSeries(project),
        projectName: project.name,
        status,
        spm: project.spm || project.leader || '-',
        department: DEPARTMENT_BY_PROJECT[project.id] || '软件项目一部',
        milestones,
        milestonesText: milestones.map(item => `${item.date} ${item.name}`).join(' '),
      })
      rowIndex++
    }

    if (project.type === '产品项目') {
      const milestones = buildMilestones(project, SOFTWARE_MILESTONE_NAMES, rowIndex)
      rows.push({
        key: `software-${project.id}`,
        projectId: project.id,
        projectType: project.type,
        ...buildProjectFields(project),
        productCategory: 'tOS版本',
        productSeries: getSoftwareSeries(project),
        projectName: project.name,
        status,
        spm: project.spm || project.leader || '-',
        department: DEPARTMENT_BY_PROJECT[project.id] || '软件项目一部',
        milestones,
        milestonesText: milestones.map(item => `${item.date} ${item.name}`).join(' '),
      })
      rowIndex++
    }

    if (project.type === '技术项目') {
      const milestones = buildMilestones(project, TECH_MILESTONE_NAMES, rowIndex)
      rows.push({
        key: `tech-${project.id}`,
        projectId: project.id,
        projectType: project.type,
        ...buildProjectFields(project),
        productCategory: '技术项目',
        productSeries: getTechSeries(project),
        projectName: project.name,
        status,
        spm: project.spm || project.leader || '-',
        department: DEPARTMENT_BY_PROJECT[project.id] || '集成维护部',
        milestones,
        milestonesText: milestones.map(item => `${item.date} ${item.name}`).join(' '),
      })
      rowIndex++
    }
  }

  return rows.sort((a, b) => {
    const categoryA = CATEGORY_ORDER.indexOf(a.productCategory)
    const categoryB = CATEGORY_ORDER.indexOf(b.productCategory)
    if (categoryA !== categoryB) return (categoryA === -1 ? 99 : categoryA) - (categoryB === -1 ? 99 : categoryB)
    if (a.productSeries !== b.productSeries) return a.productSeries.localeCompare(b.productSeries, 'zh-CN')
    return a.projectName.localeCompare(b.projectName, 'zh-CN')
  })
}

function computeRowSpans(rows: SummaryRow[], key: keyof SummaryRow, groupKeys: (keyof SummaryRow)[] = []) {
  const spans = new Array(rows.length).fill(0)
  let i = 0
  while (i < rows.length) {
    let j = i + 1
    while (j < rows.length) {
      const sameKey = rows[j][key] === rows[i][key]
      const sameGroup = groupKeys.every(groupKey => rows[j][groupKey] === rows[i][groupKey])
      if (!sameKey || !sameGroup) break
      j++
    }
    spans[i] = j - i
    for (let k = i + 1; k < j; k++) spans[k] = 0
    i = j
  }
  return spans
}

function countBy(rows: SummaryRow[], key: keyof SummaryRow) {
  return rows.reduce((acc, row) => {
    const value = String(row[key])
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

function scopeRows(rows: SummaryRow[], scope: SummaryScope) {
  if (scope === 'machine') return rows.filter(row => row.projectType === '整机产品项目')
  if (scope === 'software') return rows.filter(row => row.projectType === '产品项目')
  if (scope === 'tech') return rows.filter(row => row.projectType === '技术项目')
  return rows
}

function applyStatusFilter(rows: SummaryRow[], statusFilter: StatusFilter) {
  if (statusFilter === 'all') return rows
  return rows.filter(row => row.status === statusFilter)
}

function applyCollapsedCategories(rows: SummaryRow[], collapsedCategories: Set<string>) {
  const visible: SummaryRow[] = []
  let i = 0
  while (i < rows.length) {
    const category = rows[i].productCategory
    const group: SummaryRow[] = []
    while (i < rows.length && rows[i].productCategory === category) {
      group.push(rows[i])
      i++
    }
    if (collapsedCategories.has(category) && group.length > 1) {
      visible.push({ ...group[0], isCollapsedPreview: true, hiddenProjectCount: group.length - 1 })
    } else {
      visible.push(...group)
    }
  }
  return visible
}

function renderInfoCell(key: string, value: any) {
  if (key === 'healthStatus') {
    const config: Record<string, { label: string; color: string }> = {
      normal: { label: '正常', color: 'success' },
      warning: { label: '预警', color: 'warning' },
      risk: { label: '风险', color: 'error' },
    }
    const item = config[value] || { label: value || '-', color: 'default' }
    return <Tag color={item.color} style={{ margin: 0 }}>{item.label}</Tag>
  }
  if (key === 'projectDescription') {
    return (
      <Tooltip title={value === '-' ? '' : value}>
        <span className="pms-summary-ellipsis-cell">{value || '-'}</span>
      </Tooltip>
    )
  }
  if (key === 'market') {
    return <Tag color="blue" style={{ margin: 0 }}>{value || '-'}</Tag>
  }
  return <span className="pms-summary-text-cell">{value || '-'}</span>
}

export default function ProjectPlanSummaryBoard({ projects, onViewProject }: ProjectPlanSummaryBoardProps) {
  const [scope, setScope] = useState<SummaryScope>('overall')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [motionVersion, setMotionVersion] = useState(0)
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [tempFilters, setTempFilters] = useState<FilterCondition[]>([])
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => getDefaultVisibleColumnsForScope('overall'))
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showColumnDrawer, setShowColumnDrawer] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const rowsSignatureRef = useRef('')
  const allRows = useMemo(() => makeSummaryRows(projects), [projects])
  const scopedRows = useMemo(() => scopeRows(allRows, scope), [allRows, scope])
  const filteredRows = useMemo(() => applyFilterConditions(scopedRows, filters), [scopedRows, filters])
  const statusRows = useMemo(() => applyStatusFilter(filteredRows, statusFilter), [filteredRows, statusFilter])
  const rows = useMemo(() => applyCollapsedCategories(statusRows, collapsedCategories), [statusRows, collapsedCategories])
  const categoryCounts = useMemo(() => countBy(statusRows, 'productCategory'), [statusRows])
  const seriesCounts = useMemo(() => countBy(statusRows, 'productSeries'), [statusRows])
  const availableColumns = useMemo(() => getAvailableColumnsForScope(scope), [scope])
  const defaultVisibleColumns = useMemo(() => getDefaultVisibleColumnsForScope(scope), [scope])
  const hasActiveFilters = filters.some(isFilterConditionActive)
  const filterFieldOptions = useMemo(() => (
    availableColumns.map(col => ({
      value: col.key === 'milestones' ? 'milestonesText' : col.key,
      label: col.title,
    }))
  ), [availableColumns])
  const statusStats = useMemo(() => {
    const stats = SUMMARY_VISIBLE_STATUSES.reduce((acc, status) => {
      acc[status] = 0
      return acc
    }, {} as Record<SummaryStatus, number>)
    filteredRows.forEach(row => {
      stats[row.status] += 1
    })
    return stats
  }, [filteredRows])
  const categorySpans = useMemo(() => computeRowSpans(rows, 'productCategory'), [rows])
  const seriesSpans = useMemo(() => computeRowSpans(rows, 'productSeries', ['productCategory']), [rows])
  const rowsSignature = useMemo(() => (
    rows.map(row => `${row.key}:${row.isCollapsedPreview ? 'closed' : 'open'}:${row.hiddenProjectCount || 0}`).join('|')
  ), [rows])

  useEffect(() => {
    if (!rowsSignatureRef.current) {
      rowsSignatureRef.current = rowsSignature
      return
    }
    if (rowsSignatureRef.current !== rowsSignature) {
      rowsSignatureRef.current = rowsSignature
      setMotionVersion(prev => prev + 1)
    }
  }, [rowsSignature])

  const handleScopeChange = (key: string) => {
    const nextScope = key as SummaryScope
    setScope(nextScope)
    setStatusFilter('all')
    setFilters([])
    setTempFilters([])
    setCollapsedCategories(new Set())
    setVisibleColumns(getDefaultVisibleColumnsForScope(nextScope))
  }

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }
  const expandAllCategories = () => setCollapsedCategories(new Set())
  const collapseAllCategories = () => setCollapsedCategories(new Set(Object.keys(categoryCounts).filter(category => categoryCounts[category] > 1)))

  const buildExportColumns = () => (
    availableColumns
      .filter(col => {
        if (scope !== 'overall' && col.key === 'productCategory') return false
        return col.locked || visibleColumns.includes(col.key)
      })
      .map<ExportColumn>(col => ({
        key: col.key === 'milestones' ? 'milestonesText' : col.key,
        title: col.title,
      }))
  )

  const handleExport = (exportScope: 'current' | 'all') => {
    const sourceRows = exportScope === 'current' ? statusRows : scopedRows
    const filename = `项目计划汇总看板_${SUMMARY_SCOPES.find(item => item.key === scope)?.label || '整体'}_${exportTimestamp()}.xlsx`
    exportSheet(sourceRows, buildExportColumns(), filename, '项目计划汇总')
  }

  const columns = useMemo<ColumnsType<SummaryRow>>(() => {
    const isVisible = (key: string) => {
      const column = availableColumns.find(item => item.key === key)
      return Boolean(column?.locked || visibleColumns.includes(key))
    }
    const cols: ColumnsType<SummaryRow> = []

    if (scope === 'overall' && isVisible('productCategory')) {
      cols.push({
        title: '产品分类',
        dataIndex: 'productCategory',
        key: 'productCategory',
        width: 150,
        align: 'left',
        fixed: scope === 'overall' ? 'left' as const : undefined,
        onCell: (row, index) => ({
          rowSpan: categorySpans[index ?? 0],
          className: `pms-summary-category-cell pms-summary-category-${getCategoryTheme(row.productCategory).key}`,
        }),
        render: (value: string, row) => {
          const theme = getCategoryTheme(value)
          const collapsed = collapsedCategories.has(value)
          const total = categoryCounts[value] || 0
          return (
            <div className="pms-summary-category-content">
              <Button
                type="text"
                size="small"
                className="pms-summary-collapse-button"
                icon={collapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCategory(value)
                }}
              />
              <span className="pms-summary-category-dot" style={{ background: theme.accent }} />
              <div>
                <div className="pms-summary-category-name" style={{ color: theme.color }}>{theme.label || value}</div>
                <div className="pms-summary-category-meta">
                  {row.isCollapsedPreview ? `已收起 ${row.hiddenProjectCount || 0} 个项目` : `${total} 个项目`}
                </div>
              </div>
            </div>
          )
        },
      })
    }

	    if (isVisible('productSeries')) {
	      cols.push({
	        title: '产品系列',
	        dataIndex: 'productSeries',
	        key: 'productSeries',
	        width: 146,
	        align: 'left',
	        fixed: 'left' as const,
	        onCell: (row, index) => ({
	          rowSpan: seriesSpans[index ?? 0],
	          className: `pms-summary-series-cell pms-summary-series-${getCategoryTheme(row.productCategory).key}`,
	        }),
        render: (value: string, row) => {
          const theme = getCategoryTheme(row.productCategory)
          return (
            <div className="pms-summary-series-content">
              <span className="pms-summary-series-dot" style={{ background: theme.accent }} />
              <div>
                <div className="pms-summary-series-name">{value}</div>
                <div className="pms-summary-series-meta">{seriesCounts[value] || 0}个项目</div>
              </div>
            </div>
          )
        },
      })
    }

	    if (isVisible('projectName')) {
	      cols.push({
	        title: '项目名',
	        dataIndex: 'projectName',
	        key: 'projectName',
	        width: 176,
	        fixed: 'left' as const,
	        className: 'pms-summary-project-cell',
	        render: (value: string, row) => (
	          <div className="pms-summary-project-content">
            <Tooltip title={row.projectType}>
              <span className="pms-summary-project-name">{value}</span>
            </Tooltip>
            {row.isCollapsedPreview && !!row.hiddenProjectCount && (
              <Tag color="blue" style={{ margin: 0, borderRadius: 10 }}>+{row.hiddenProjectCount}</Tag>
            )}
          </div>
        ),
      })
    }

    if (isVisible('status')) {
      cols.push({
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 104,
        align: 'center',
        render: (value: string) => <Tag color={STATUS_COLORS[value] || 'processing'} style={{ margin: 0 }}>{value}</Tag>,
      })
    }

    if (isVisible('spm')) {
      cols.push({ title: 'SPM', dataIndex: 'spm', key: 'spm', width: 90, align: 'center' })
    }

    if (isVisible('department')) {
      cols.push({ title: '部门', dataIndex: 'department', key: 'department', width: 128, align: 'center' })
    }

    getExtraColumnsForScope(scope).forEach(col => {
      if (!isVisible(col.key)) return
      cols.push({
        title: col.title,
        dataIndex: col.key,
        key: col.key,
        width: col.width || 110,
        render: (value: any) => renderInfoCell(col.key, value),
      })
    })

    if (isVisible('milestones')) {
      cols.push({
        title: '里程碑节点',
        dataIndex: 'milestones',
        key: 'milestones',
        width: 720,
        className: 'pms-summary-milestones-cell',
        onHeaderCell: () => ({ className: 'pms-summary-milestones-header' }),
        render: (milestones: SummaryMilestone[]) => (
          <div className="pms-summary-milestone-chain">
            {milestones.map((milestone, index) => (
              <div className="pms-summary-milestone-node" key={`${milestone.name}-${index}`}>
                <div className="pms-summary-milestone-dot-wrap">
                  <span className="pms-summary-milestone-dot" />
                  {index < milestones.length - 1 && <span className="pms-summary-milestone-line" />}
                </div>
                <div className="pms-summary-milestone-card">
                  <div className="pms-summary-milestone-date">{milestone.date}</div>
                  <div className="pms-summary-milestone-name">{milestone.name}</div>
                </div>
              </div>
            ))}
          </div>
        ),
      })
    }

	    cols.push({
	      title: '操作',
	      key: 'action',
	      width: 92,
	      align: 'center',
	      fixed: 'right' as const,
	      render: (_: unknown, row) => (
	        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewProject(row.projectId)}>
	          查看
        </Button>
      ),
    })

    return cols
  }, [availableColumns, visibleColumns, scope, categoryCounts, categorySpans, collapsedCategories, onViewProject, seriesCounts, seriesSpans])

  const renderSummaryTable = () => (
    <Table
      className="pms-table pms-summary-board"
      columns={columns}
      dataSource={rows}
      rowKey="key"
      rowClassName={(row) => {
        const theme = getCategoryTheme(row.productCategory)
        return [
          `pms-summary-row-${theme.key}`,
          row.isCollapsedPreview ? 'pms-summary-row-collapsed' : '',
          motionVersion > 0 ? 'pms-summary-row-motion' : '',
          motionVersion > 0 ? `pms-summary-row-motion-${motionVersion % 2 === 0 ? 'even' : 'odd'}` : '',
        ].filter(Boolean).join(' ')
      }}
      bordered
      size="small"
      tableLayout="fixed"
      scroll={{ x: 'max-content' }}
      pagination={false}
      locale={{ emptyText: <Empty description="暂无项目计划汇总数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
  )

  return (
    <div>
      <style>{`
        .pms-summary-control-shell {
          margin-bottom: 14px;
          padding: 12px 14px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 8px 22px rgba(15,23,42,0.05);
        }
        .pms-summary-toolbar {
          margin-bottom: 0;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pms-summary-status-group {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          flex-wrap: wrap;
          flex: 1 1 520px;
          min-width: 320px;
        }
        .pms-summary-toolbar-actions {
          flex: 0 0 auto;
          justify-content: flex-end;
          margin-left: auto;
        }
        .pms-summary-toolbar-actions .ant-btn {
          font-weight: 600;
        }
        .pms-summary-scope-tabs {
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eef2f7;
        }
        .pms-summary-scope-tabs .ant-tabs-nav {
          margin: 0 !important;
        }
        .pms-summary-status-label {
          color: #64748b;
          font-size: 12px;
        }
        .pms-summary-status-pill {
          border: 1px solid #dbe5f1;
          background: #fff;
          color: #334155;
          border-radius: 16px;
          padding: 4px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .pms-summary-status-pill:hover {
          border-color: #93c5fd;
          color: #2563eb;
        }
        .pms-summary-status-pill-active {
          background: #4f6df5;
          border-color: #4f6df5;
          color: #fff;
          box-shadow: 0 4px 10px rgba(79,109,245,0.22);
        }
        .pms-summary-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 6px;
          vertical-align: 1px;
        }
        .pms-summary-status-count {
          margin-left: 6px;
          font-weight: 800;
        }
        .pms-summary-board .ant-table-thead > tr:first-child > th {
          background: #f8fafc !important;
          color: #334155 !important;
          font-weight: 700 !important;
          border-color: #dbe5f1 !important;
          padding: 10px 16px !important;
          line-height: 18px !important;
          white-space: nowrap;
          overflow: visible;
          text-overflow: clip;
        }
        .pms-summary-board .ant-table-thead > tr:first-child > th.pms-summary-milestones-header {
          background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%) !important;
          color: #9f1239 !important;
        }
        .pms-summary-board .ant-table-tbody > tr > td {
          border-color: #e2e8f0 !important;
          background: #fff !important;
          padding: 0 16px !important;
          transition: background-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
        }
        .pms-summary-board .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
        .pms-summary-board .ant-table-cell-fix,
        .pms-summary-board .ant-table-cell-fix-start,
        .pms-summary-board .ant-table-cell-fix-end {
          position: sticky !important;
        }
        .pms-table.pms-summary-board .ant-table-thead > tr > th.ant-table-cell-fix,
        .pms-table.pms-summary-board .ant-table-thead > tr > th.ant-table-cell-fix-start,
        .pms-table.pms-summary-board .ant-table-thead > tr > th.ant-table-cell-fix-end,
        .pms-table.pms-summary-board .ant-table-tbody > tr > td.ant-table-cell-fix,
        .pms-table.pms-summary-board .ant-table-tbody > tr > td.ant-table-cell-fix-start,
        .pms-table.pms-summary-board .ant-table-tbody > tr > td.ant-table-cell-fix-end {
          position: sticky !important;
        }
        .pms-summary-board .ant-table-cell-fix-left,
        .pms-summary-board .ant-table-cell-fix-right,
        .pms-summary-board .ant-table-cell-fix-start,
        .pms-summary-board .ant-table-cell-fix-end {
          background-clip: padding-box;
        }
        .pms-summary-board .ant-table-cell-fix-left-last,
        .pms-summary-board .ant-table-cell-fix-start-shadow {
          box-shadow: 8px 0 14px -12px rgba(15,23,42,0.28);
        }
        .pms-summary-board .ant-table-cell-fix-right-first,
        .pms-summary-board .ant-table-cell-fix-end-shadow {
          box-shadow: -8px 0 14px -12px rgba(15,23,42,0.28);
        }
        .pms-summary-category-content,
        .pms-summary-series-content,
        .pms-summary-project-content {
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.22s ease, opacity 0.22s ease;
        }
        .pms-summary-category-cell {
          vertical-align: top;
          padding: 14px 12px !important;
          border-right-color: #cfe0f4 !important;
        }
        .pms-summary-series-cell {
          vertical-align: top;
          padding: 14px 16px !important;
          border-right: 1px solid #fde68a !important;
        }
        .pms-summary-project-cell {
          padding: 0 16px !important;
          background: #fff !important;
        }
        .pms-summary-category-camon,
        .pms-summary-row-camon > td.pms-summary-category-cell {
          background: #eff6ff !important;
        }
        .pms-summary-series-camon,
        .pms-summary-row-camon > td.pms-summary-series-cell {
          background: #f8fbff !important;
        }
        .pms-summary-category-note,
        .pms-summary-row-note > td.pms-summary-category-cell {
          background: #f5f3ff !important;
        }
        .pms-summary-series-note,
        .pms-summary-row-note > td.pms-summary-series-cell {
          background: #faf7ff !important;
        }
        .pms-summary-category-spark,
        .pms-summary-row-spark > td.pms-summary-category-cell {
          background: #ecfdf5 !important;
        }
        .pms-summary-series-spark,
        .pms-summary-row-spark > td.pms-summary-series-cell {
          background: #f4fff9 !important;
        }
        .pms-summary-category-pova,
        .pms-summary-row-pova > td.pms-summary-category-cell {
          background: #fffbeb !important;
        }
        .pms-summary-series-pova,
        .pms-summary-row-pova > td.pms-summary-series-cell {
          background: #fffdf2 !important;
        }
        .pms-summary-category-tos,
        .pms-summary-row-tos > td.pms-summary-category-cell {
          background: #ecfeff !important;
        }
        .pms-summary-series-tos,
        .pms-summary-row-tos > td.pms-summary-series-cell {
          background: #f0fdfa !important;
        }
        .pms-summary-category-tech,
        .pms-summary-row-tech > td.pms-summary-category-cell {
          background: #ecfdf5 !important;
        }
        .pms-summary-series-tech,
        .pms-summary-row-tech > td.pms-summary-series-cell {
          background: #f0fdf4 !important;
        }
        .pms-summary-collapse-button {
          color: #64748b !important;
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          padding: 0 !important;
          border-radius: 5px !important;
          transition: background-color 0.18s ease, transform 0.22s cubic-bezier(0.2, 0, 0, 1) !important;
        }
        .pms-summary-collapse-button .anticon {
          transition: transform 0.24s cubic-bezier(0.2, 0, 0, 1);
        }
        .pms-summary-collapse-button:hover {
          background: rgba(255,255,255,0.7) !important;
        }
        .pms-summary-category-dot,
        .pms-summary-series-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.72);
        }
        .pms-summary-category-name {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0;
        }
        .pms-summary-category-meta,
        .pms-summary-series-meta {
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
        }
        .pms-summary-series-name {
          color: #9a3412;
          font-size: 13px;
          font-weight: 800;
        }
        .pms-summary-project-name {
          color: #111827;
          font-weight: 700;
          letter-spacing: 0;
        }
        .pms-summary-text-cell {
          color: #4b5563;
          font-size: 12px;
          white-space: nowrap;
        }
        .pms-summary-ellipsis-cell {
          color: #4b5563;
          display: inline-block;
          font-size: 12px;
          max-width: 210px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pms-summary-row-collapsed > td {
          box-shadow: inset 0 -1px 0 #cbd5e1;
        }
        .pms-summary-row-motion-even > td,
        .pms-summary-row-motion-odd > td {
          animation: pmsSummaryRowReveal 220ms ease-out both;
        }
        .pms-summary-row-collapsed > td {
          animation: pmsSummaryCollapseSettle 220ms ease-out both;
        }
        @keyframes pmsSummaryRowReveal {
          from {
            opacity: 0.72;
            filter: brightness(0.98);
          }
          to {
            opacity: 1;
            filter: brightness(1);
          }
        }
        @keyframes pmsSummaryCollapseSettle {
          0% {
            filter: brightness(0.98);
          }
          100% {
            filter: brightness(1);
          }
        }
        .pms-summary-milestones-cell {
          padding: 8px 12px !important;
        }
        .pms-summary-milestone-chain {
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 10px;
          overflow-x: auto;
          padding: 7px 2px;
          scrollbar-width: thin;
        }
        .pms-summary-milestone-node {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 0 0 auto;
        }
        .pms-summary-milestone-dot-wrap {
          position: relative;
          width: 16px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 16px;
        }
        .pms-summary-milestone-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f97316;
          box-shadow: 0 0 0 4px #ffedd5;
          z-index: 1;
        }
        .pms-summary-milestone-line {
          position: absolute;
          left: 14px;
          width: 72px;
          height: 1px;
          background: linear-gradient(90deg, #fdba74 0%, rgba(253,186,116,0.25) 100%);
        }
        .pms-summary-milestone-card {
          min-width: 72px;
          padding: 4px 7px;
          border-radius: 6px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          line-height: 1.28;
          box-shadow: 0 1px 2px rgba(154,52,18,0.06);
        }
        .pms-summary-milestone-date {
          color: #374151;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .pms-summary-milestone-name {
          color: #9a3412;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        @media (prefers-reduced-motion: reduce) {
          .pms-summary-row-motion-even > td,
          .pms-summary-row-motion-odd > td,
          .pms-summary-row-collapsed > td {
            animation: none;
          }
          .pms-summary-board .ant-table-tbody > tr > td,
          .pms-summary-category-content,
          .pms-summary-series-content,
          .pms-summary-project-content,
          .pms-summary-collapse-button,
          .pms-summary-collapse-button .anticon {
            transition: none !important;
          }
        }
      `}</style>

      <div className="pms-summary-control-shell">
        <Tabs
          className="pms-summary-scope-tabs"
          activeKey={scope}
          onChange={handleScopeChange}
          items={SUMMARY_SCOPES.map(item => ({ key: item.key, label: item.label }))}
        />

        <div className="pms-summary-toolbar">
          <div className="pms-summary-status-group">
            <span className="pms-summary-status-label">状态筛选:</span>
            {STATUS_FILTERS.map(item => {
              const count = item.key === 'all' ? filteredRows.length : statusStats[item.key]
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`pms-summary-status-pill${statusFilter === item.key ? ' pms-summary-status-pill-active' : ''}`}
                  onClick={() => setStatusFilter(item.key)}
                >
                  {item.key !== 'all' && <span className="pms-summary-status-dot" style={{ background: STATUS_DOT_COLORS[item.key] }} />}
                  {item.label}
                  <span className="pms-summary-status-count">{count || 0}</span>
                </button>
              )
            })}
          </div>
          <Space size={8} className="pms-summary-toolbar-actions">
            {scope === 'overall' && (
              <>
                <Button size="small" onClick={expandAllCategories}>展开全部</Button>
                <Button size="small" onClick={collapseAllCategories}>折叠全部</Button>
              </>
            )}
            <Button
              size="small"
              icon={<FilterOutlined />}
              type={hasActiveFilters ? 'primary' : 'default'}
              onClick={() => {
                setTempFilters(filters.length ? filters.map(item => ({ ...item })) : [createFilterCondition()])
                setShowFilterDrawer(true)
              }}
            >
              筛选{hasActiveFilters ? ' ●' : ''}
            </Button>
            <Button size="small" icon={<SettingOutlined />} onClick={() => setShowColumnDrawer(true)}>
              列设置
            </Button>
            <Dropdown
              menu={{
                items: [
                  { key: 'current', label: '导出当前视图' },
                  { key: 'all', label: '导出当前分类全部' },
                ],
                onClick: ({ key }) => handleExport(key as 'current' | 'all'),
              }}
            >
              <Button size="small" icon={<DownloadOutlined />}>导出</Button>
            </Dropdown>
            <Button
              size="small"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setIsFullscreen(true)}
            >
              全屏
            </Button>
          </Space>
        </div>
      </div>

      {renderSummaryTable()}

      <Modal
        title={(
          <Space>
            <span>项目计划汇总看板</span>
            <Tag>{SUMMARY_SCOPES.find(item => item.key === scope)?.label || '整体'}</Tag>
          </Space>
        )}
        open={isFullscreen}
        onCancel={() => setIsFullscreen(false)}
        footer={null}
        width="100vw"
        style={{ top: 0, maxWidth: '100vw', paddingBottom: 0 }}
        styles={{ body: { height: 'calc(100vh - 110px)', overflow: 'auto' } }}
      >
        {renderSummaryTable()}
      </Modal>

      <Drawer
        title="筛选条件"
        open={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        width={520}
        placement="right"
        zIndex={SUMMARY_DRAWER_Z_INDEX}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setTempFilters([createFilterCondition()])}>清除全部</Button>
            <Space>
              <Button onClick={() => setShowFilterDrawer(false)}>取消</Button>
              <Button
                type="primary"
                onClick={() => {
                  setFilters(normalizeFilterConditions(tempFilters))
                  setShowFilterDrawer(false)
                }}
              >
                应用
              </Button>
            </Space>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tempFilters.map((condition) => (
            <div key={condition.id} style={{ padding: 12, border: '1px solid #eef2ff', borderRadius: 8, background: '#fafbff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 116px 40px', gap: 8, marginBottom: isValuelessFilterOperator(condition.operator) ? 0 : 8 }}>
                <Select
                  aria-label="筛选字段"
                  placeholder="筛选字段"
                  value={condition.field || undefined}
                  options={getFieldOptionsWithDuplicateDisabled(filterFieldOptions, tempFilters, condition.id)}
                  onChange={(value) => setTempFilters(prev => prev.map(item => item.id === condition.id ? { ...item, field: value } : item))}
                />
                <Select
                  value={condition.operator}
                  options={FILTER_OPERATORS as any}
                  onChange={(value) => {
                    const operator = value as FilterCondition['operator']
                    setTempFilters(prev => prev.map(item => item.id === condition.id ? {
                      ...item,
                      operator,
                      value: isValuelessFilterOperator(operator) ? '' : item.value,
                    } : item))
                  }}
                />
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => setTempFilters(prev => prev.length > 1 ? prev.filter(item => item.id !== condition.id) : [createFilterCondition()])}
                />
              </div>
              {!isValuelessFilterOperator(condition.operator) && (
                <Input
                  placeholder="输入筛选值"
                  value={condition.value}
                  onChange={(event) => setTempFilters(prev => prev.map(item => item.id === condition.id ? { ...item, value: event.target.value } : item))}
                />
              )}
            </div>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setTempFilters(prev => [...prev, createFilterCondition()])}
          >
            添加条件
          </Button>
        </div>
      </Drawer>

      <Drawer
        title="列设置"
        open={showColumnDrawer}
        onClose={() => setShowColumnDrawer(false)}
        width={420}
        placement="right"
        zIndex={SUMMARY_DRAWER_Z_INDEX}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setVisibleColumns(defaultVisibleColumns)}>重置默认</Button>
            <Space>
              <Button onClick={() => setShowColumnDrawer(false)}>取消</Button>
              <Button type="primary" onClick={() => setShowColumnDrawer(false)}>确定</Button>
            </Space>
          </div>
        )}
      >
        <div style={{ marginBottom: 10, fontSize: 12, color: '#64748b' }}>
          {scope === 'overall' ? '整体视图保留产品分类维度；其它视图不显示产品分类。' : '当前视图不显示产品分类。'}
        </div>
        <Checkbox.Group
          value={visibleColumns}
          onChange={(values) => {
            const lockedKeys = availableColumns.filter(col => col.locked).map(col => col.key)
            setVisibleColumns(Array.from(new Set([...lockedKeys, ...(values as string[])])))
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '8px 0 2px' }}>当前视图字段</div>
          {availableColumns.map(col => (
            <Checkbox key={col.key} value={col.key} disabled={col.locked}>
              <Space size={6}>
                <span>{col.title}</span>
                {col.locked && <Tag color="blue" style={{ marginInlineEnd: 0 }}>固定</Tag>}
              </Space>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Drawer>
    </div>
  )
}
