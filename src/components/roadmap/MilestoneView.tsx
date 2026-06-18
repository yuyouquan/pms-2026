'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Button, Checkbox, DatePicker, Drawer, Dropdown, Empty, Input, Modal, Popover, Segmented, Select, Space, Table, Tabs, Tag, Tooltip, message } from 'antd'
import {
  ArrowRightOutlined,
  CameraOutlined,
  CalendarOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilterOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  HistoryOutlined,
  PlusOutlined,
  SettingOutlined,
  ShareAltOutlined,
  SwapOutlined,
  TableOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  inferOsSeriesFromProjectName,
  inferTosVersionFromProjectName,
} from '@/constants/projectBasicFields'
import {
  LEGACY_SOFTWARE_PROJECT_TYPE,
  SOFTWARE_PROJECT_DISPLAY_TYPE,
  isSoftwareProjectType,
  normalizeSoftwareProjectType,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_MACHINE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_TOS_VERSION,
} from '@/constants/projectTypes'
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
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import {
  PROJECT_VIEW_KINDS,
  createProjectViewShareUrl,
  deleteProjectView,
  getFixedColumnsForType,
  loadProjectViews,
  parseProjectViewShare,
  saveProjectView,
  type ProjectViewState,
  type SavedProjectView,
} from './utils'

type RoadmapScope = 'overall' | 'machine' | 'tosVersion' | 'tech'
type RoadmapStatus = '待立项' | '在研' | '上市' | '转维' | 'EOS' | '暂停' | '已取消' | '已迁移'
type StatusFilter = 'all' | RoadmapStatus
type ProjectViewMode = 'table' | 'calendar'
type MilestoneDateRange = [string, string] | null
type SnapshotDateRange = [string, string] | null

interface MilestoneViewProps {
  projects: any[]
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>
  level1Tasks: any[]
  onViewProject: (projectId: string, market?: string) => void
  initialProjectType?: string
  onProjectTypeChange?: (type: string) => void
  hideProjectTypeTabs?: boolean
  scopeExtra?: ReactNode
}

interface RoadmapMilestone {
  name: string
  date: string
}

interface RoadmapMilestoneRow {
  [key: string]: any
  key: string
  projectId: string
  projectType: string
  tosVersionGroup: string
  productCategory: string
  productSeries: string
  projectName: string
  tosVersion: string
  status: RoadmapStatus
  spm: string
  department: string
  market?: string
  milestones: RoadmapMilestone[]
  milestonesText: string
  isCollapsedPreview?: boolean
  hiddenProjectCount?: number
}

interface RoadmapSnapshot {
  id: string
  version: string
  createdAt: string
  createdAtMs: number
  scope: RoadmapScope
  rows: RoadmapMilestoneRow[]
}

type CompareSource = 'live' | string
type CompareRowStatus = 'added' | 'removed' | 'modified' | 'same'

interface RoadmapCompareRow extends RoadmapMilestoneRow {
  rowStatus: CompareRowStatus
  changeSummary?: string
}

const ROADMAP_SCOPES: { key: RoadmapScope; label: string; projectType: string }[] = [
  { key: 'overall', label: '整体', projectType: '整体' },
  { key: 'machine', label: '整机产品项目', projectType: PROJECT_TYPE_MACHINE },
  { key: 'tosVersion', label: 'tOS版本项目', projectType: PROJECT_TYPE_TOS_VERSION },
  { key: 'tech', label: '技术项目', projectType: PROJECT_TYPE_TECH },
]

const SCOPE_BY_PROJECT_TYPE: Record<string, RoadmapScope> = {
  整体: 'overall',
  [PROJECT_TYPE_MACHINE]: 'machine',
  [PROJECT_TYPE_TOS_VERSION]: 'tosVersion',
  [SOFTWARE_PROJECT_DISPLAY_TYPE]: 'tosVersion',
  [LEGACY_SOFTWARE_PROJECT_TYPE]: 'tosVersion',
  [PROJECT_TYPE_TECH]: 'tech',
}

const PROJECT_TYPE_BY_SCOPE: Record<RoadmapScope, string> = {
  overall: '整体',
  machine: PROJECT_TYPE_MACHINE,
  tosVersion: PROJECT_TYPE_TOS_VERSION,
  tech: PROJECT_TYPE_TECH,
}

const SUMMARY_VISIBLE_STATUSES: RoadmapStatus[] = ['待立项', '在研', '上市', '转维', 'EOS', '暂停', '已取消', '已迁移']

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '待立项', label: '待立项' },
  { key: '在研', label: '在研' },
  { key: '上市', label: '上市' },
  { key: '转维', label: '转维' },
  { key: 'EOS', label: 'EOS' },
  { key: '暂停', label: '暂停' },
  { key: '已取消', label: '已取消' },
  { key: '已迁移', label: '已迁移' },
]
const ROADMAP_MILESTONE_VIEW_KIND = PROJECT_VIEW_KINDS.roadmapMilestone
const SUMMARY_STICKY_TOP = 47
const TABLE_BODY_SCROLL_Y = 'calc(100vh - 180px)'

const CATEGORY_ORDER = ['tOS版本', 'CAMON', 'Note', 'NOTE', 'SPARK', 'POVA', '技术项目']

const CATEGORY_THEME: Record<string, { key: string; label?: string; color: string; accent: string }> = {
  tOS版本: { key: 'tos', color: '#0891b2', accent: '#06b6d4' },
  独立软件产品: { key: 'independent', color: '#0f766e', accent: '#14b8a6' },
  CAMON: { key: 'camon', color: '#2563eb', accent: '#3b82f6' },
  Note: { key: 'note', label: 'NOTE', color: '#7c3aed', accent: '#8b5cf6' },
  NOTE: { key: 'note', label: 'NOTE', color: '#7c3aed', accent: '#8b5cf6' },
  SPARK: { key: 'spark', color: '#059669', accent: '#10b981' },
  POVA: { key: 'pova', color: '#d97706', accent: '#f59e0b' },
  技术项目: { key: 'tech', color: '#0f766e', accent: '#14b8a6' },
}

const DEFAULT_CATEGORY_THEME = { key: 'default', color: '#475569', accent: '#94a3b8' }
const getCategoryTheme = (category: string) => CATEGORY_THEME[category] || DEFAULT_CATEGORY_THEME

const STATUS_COLORS: Record<string, string> = {
  待立项: 'blue',
  在研: 'processing',
  上市: 'gold',
  转维: 'purple',
  EOS: 'default',
  已迁移: 'cyan',
  已上市: 'gold',
  进行中: 'orange',
  维护期: 'purple',
  已完成: 'cyan',
  暂停: 'default',
  已取消: 'red',
}

const STATUS_DOT_COLORS: Record<RoadmapStatus, string> = {
  待立项: '#64748b',
  在研: '#10b981',
  上市: '#3b82f6',
  转维: '#8b5cf6',
  EOS: '#64748b',
  暂停: '#94a3b8',
  已取消: '#ef4444',
  已迁移: '#06b6d4',
}

const DEPARTMENT_BY_PROJECT: Record<string, string> = {
  '1': '软件项目一部',
  '2': '软件项目一部',
  '3': '集成维护部',
  '4': '集成维护部',
  '6': '软件项目一部',
  '7': '软件项目二部',
  '8': '软件项目二部',
  '9': '软件项目二部',
}

const FALLBACK_MILESTONES: Record<string, string[]> = {
  整机产品项目: ['概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', 'STR6'],
  产品项目: ['概念启动', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5', 'MR6', 'MR7'],
  tOS版本项目: ['概念启动', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5', 'MR6', 'MR7'],
  独立软件产品项目: ['概念启动', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5', 'MR6', 'MR7'],
  技术项目: ['概念启动', 'TDR1', 'TDR2', 'TDR3', 'TDR4'],
}
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MILESTONE_DATE_RANGE_PRESETS = [
  {
    label: '最近3个月',
    value: [dayjs().startOf('month'), dayjs().add(2, 'month').endOf('month')],
  },
  {
    label: '未来三个月',
    value: [dayjs().add(1, 'month').startOf('month'), dayjs().add(3, 'month').endOf('month')],
  },
]
const MILESTONE_FILTER_FIELD = 'milestonesText'
const MILESTONE_RANGE_SEPARATOR = '~'
const SNAPSHOT_DATE_RANGE_PRESETS = [
  {
    label: '今天',
    value: [dayjs().startOf('day'), dayjs().endOf('day')],
  },
  {
    label: '昨天',
    value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')],
  },
  {
    label: '最近7天',
    value: [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')],
  },
  {
    label: '最近30天',
    value: [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')],
  },
]

const BASE_COLUMN_OPTIONS = [
  ...getFixedColumnsForType('整体').map(col => ({
    ...col,
    title: col.key === 'status' ? '状态' : col.title,
  })),
  { key: 'milestones', title: '里程碑节点', width: 760, defaultVisible: true },
]

const BASE_COLUMN_KEYS = new Set(BASE_COLUMN_OPTIONS.map(col => col.key))
const ROADMAP_DRAWER_Z_INDEX = 1200

const splitValues = (value: any) => String(value || '').split(/[,\uff0c、/]/).map(item => item.trim()).filter(Boolean)
const getFirstSpm = (value: any) => splitValues(value)[0] || ''

const SPM_DEPARTMENT_MAP: Record<string, string> = {
  张三: '软件项目一部',
  李白: '软件项目一部',
  李四: '软件项目二部',
  王五: '系统平台部',
  赵六: '集成维护部',
  孙七: '质量保障部',
  周八: '项目管理部',
  杜甫: '系统平台部',
}

const getDepartmentByFirstSpm = (project: any, fallback: string) => {
  const firstSpm = getFirstSpm(project.spm || project.leader)
  return SPM_DEPARTMENT_MAP[firstSpm] || DEPARTMENT_BY_PROJECT[project.id] || fallback
}

const isIndependentSoftwareProject = (project: any) => (
  normalizeSoftwareProjectType(project.type, project.name) === PROJECT_TYPE_INDEPENDENT_SOFTWARE
)

const normalizeValue = (value: any) => {
  if (Array.isArray(value)) return value.join(',')
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

const normalizeStatus = (status: any): RoadmapStatus | null => {
  const value = String(status || '').trim()
  if (value === '进行中') return '在研'
  if (value === '已上市') return '上市'
  if (value === '维护' || value === '维护期') return '转维'
  if (value === '筹备中') return '待立项'
  if (SUMMARY_VISIBLE_STATUSES.includes(value as RoadmapStatus)) return value as RoadmapStatus
  return null
}

const normalizeTosVersion = (value: any) => {
  const raw = String(value || '').trim()
  if (!raw || raw === '-') return '未归属'
  const compact = raw.replace(/\s+/g, '')
  if (/^tOS/i.test(compact)) return compact.replace(/^tos/i, 'tOS')
  const match = compact.match(/\d+(?:\.\d+)?/)
  return match ? `tOS${match[0]}` : compact
}

const getMainMarket = (project: any) => {
  const markets = Array.isArray(project.markets) ? project.markets : splitValues(project.market)
  return project.mainMarket || markets[0] || project.buildMarket?.toUpperCase?.() || '-'
}

const getProjectSortName = (project: any) => String(project.name || project.projectName || '')
const getMachineCategory = (project: any) => project.productCategory || (project.productLine === 'NOTE' ? 'Note' : project.productLine || 'CAMON')
const getMachineSeries = (project: any) => project.productSeries || project.productLine || '未分系列'
const getSoftwareSeries = (project: any) => {
  if (normalizeSoftwareProjectType(project.type, project.name) === PROJECT_TYPE_TOS_VERSION) {
    return project.productSeries || project.osSeries || inferOsSeriesFromProjectName(project.name) || `${inferTosVersionFromProjectName(project.name).split('.')[0] || '16'}.X`
  }
  if (normalizeSoftwareProjectType(project.type, project.name) === PROJECT_TYPE_INDEPENDENT_SOFTWARE) {
    return project.productSeries || '未填产品系列'
  }
  return project.productSeries || project.osSeries || inferOsSeriesFromProjectName(project.name) || '未填产品系列'
}
const getSoftwareCategory = (project: any) => (
  normalizeSoftwareProjectType(project.type, project.name) === PROJECT_TYPE_TOS_VERSION
    ? 'tOS版本'
    : '独立软件产品'
)
const getTechSeries = (project: any) => splitValues(project.domain)[0] || project.productLine || '基础架构'

const getProductCategory = (project: any) => {
  if (isSoftwareProjectType(project.type)) return getSoftwareCategory(project)
  if (project.type === PROJECT_TYPE_TECH) return '技术项目'
  return getMachineCategory(project)
}

const getProductSeries = (project: any) => {
  if (isSoftwareProjectType(project.type)) return getSoftwareSeries(project)
  if (project.type === PROJECT_TYPE_TECH) return getTechSeries(project)
  return getMachineSeries(project)
}

const getOverallTosVersion = (project: any) => {
  if (isSoftwareProjectType(project.type)) return normalizeTosVersion(project.tosVersion || project.tosVersionName || project.name)
  if (project.type === PROJECT_TYPE_TECH) return normalizeTosVersion(splitValues(project.tosVersions)[0] || project.tosVersion)
  return normalizeTosVersion(project.tosVersion || project.tosVersionName)
}

const getProjectTosVersion = (project: any) => normalizeValue(
  project.tosVersion
  || project.tosVersionName
  || splitValues(project.tosVersions)[0]
  || inferTosVersionFromProjectName(project.name),
)

const toFallbackDate = (baseDate: string | undefined, index: number, rowOffset: number) => {
  const base = baseDate && dayjs(baseDate).isValid() ? dayjs(baseDate) : dayjs('2026-01-01')
  return base.add(index * 30 + rowOffset * 5, 'day').format('YYYY/M/D')
}

const formatTaskDate = (value: any) => {
  if (!value) return ''
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY/M/D') : String(value)
}

const buildMilestoneNodes = (project: any, sourceTasks: any[], rowIndex: number): RoadmapMilestone[] => {
  const fallbackNames = FALLBACK_MILESTONES[project.type] || FALLBACK_MILESTONES['整机产品项目']
  const taskMilestones = sourceTasks
    .filter(task => task?.parentId && task?.taskName)
    .map(task => ({
      name: task.taskName,
      date: formatTaskDate(task.planEndDate || task.planStartDate) || toFallbackDate(project.planStartDate, Number(task.order || 0), rowIndex % 3),
    }))

  if (taskMilestones.length) {
    const taskByName = new Map(taskMilestones.map(item => [item.name, item]))
    return fallbackNames.map((name, index) => (
      taskByName.get(name) || {
        name,
        date: toFallbackDate(project.planStartDate, index, rowIndex % 3),
      }
    ))
  }

  return fallbackNames.map((name, index) => ({
    name,
    date: toFallbackDate(project.planStartDate, index, rowIndex % 3),
  }))
}

const buildProjectFields = (project: any) => ({
  tosVersionGroup: getOverallTosVersion(project),
  productCategory: getProductCategory(project),
  productSeries: getProductSeries(project),
  projectName: project.name,
  tosVersion: getProjectTosVersion(project),
  status: normalizeStatus(project.status),
  spm: project.spm || project.leader || '-',
  department: getDepartmentByFirstSpm(project, project.type === '技术项目' ? '集成维护部' : '软件项目一部'),
})

const buildRoadmapMilestoneRow = (
  project: any,
  milestones: RoadmapMilestone[],
  options: { keyPrefix: string; tosVersionGroup?: string; market?: string },
): RoadmapMilestoneRow | null => {
  const status = normalizeStatus(project.status)
  if (!status) return null

  const row: RoadmapMilestoneRow = {
    key: `${options.keyPrefix}-${project.id}`,
    projectId: project.id,
    projectType: normalizeSoftwareProjectType(project.type, project.name) || project.type,
    ...buildProjectFields(project),
    status,
    market: options.market,
    milestones,
    milestonesText: milestones.map(item => `${item.date} ${item.name}`).join(' '),
  }

  if (options.tosVersionGroup) {
    row.tosVersionGroup = options.tosVersionGroup
  }

  return row
}

const sortProjectsByRoadmapDimension = (projects: any[]) => [...projects].sort((a, b) => {
  const categoryA = CATEGORY_ORDER.indexOf(getProductCategory(a))
  const categoryB = CATEGORY_ORDER.indexOf(getProductCategory(b))
  const safeCategoryA = categoryA === -1 ? 50 : categoryA
  const safeCategoryB = categoryB === -1 ? 50 : categoryB
  if (safeCategoryA !== safeCategoryB) return safeCategoryA - safeCategoryB
  const seriesA = getProductSeries(a)
  const seriesB = getProductSeries(b)
  if (seriesA !== seriesB) return seriesA.localeCompare(seriesB, 'zh-CN', { numeric: true })
  return getProjectSortName(a).localeCompare(getProjectSortName(b), 'zh-CN', { numeric: true })
})

const getTosGroups = (projects: any[]) => {
  const groups = new Map<string, any[]>()
  projects
    .filter(project => isSoftwareProjectType(project.type) && !isIndependentSoftwareProject(project) && normalizeStatus(project.status))
    .forEach(project => {
      const version = normalizeTosVersion(project.tosVersion || project.tosVersionName || project.name)
      groups.set(version, [...(groups.get(version) || []), project])
    })

  if (!groups.size) {
    projects
      .filter(project => (isSoftwareProjectType(project.type) || [PROJECT_TYPE_MACHINE, PROJECT_TYPE_TECH].includes(project.type)) && !isIndependentSoftwareProject(project) && normalizeStatus(project.status))
      .forEach(project => {
        const version = getOverallTosVersion(project)
        groups.set(version, groups.get(version) || [])
      })
  }

  return Array.from(groups.entries())
    .map(([version, softwareProjects]) => ({
      version,
      softwareProjects: sortProjectsByRoadmapDimension(softwareProjects),
    }))
    .sort((a, b) => a.version.localeCompare(b.version, 'zh-CN', { numeric: true }))
}

function buildRoadmapMilestoneRows(
  projects: any[],
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>,
  level1Tasks: any[],
) {
  const rows: RoadmapMilestoneRow[] = []
  let rowIndex = 0
  const tosGroups = getTosGroups(projects)
  const machineProjects = sortProjectsByRoadmapDimension(projects.filter(project => project.type === PROJECT_TYPE_MACHINE && normalizeStatus(project.status)))
  const techProjects = sortProjectsByRoadmapDimension(projects.filter(project => project.type === PROJECT_TYPE_TECH && normalizeStatus(project.status)))

  for (const tosGroup of tosGroups) {
    for (const project of tosGroup.softwareProjects) {
      const row = buildRoadmapMilestoneRow(project, buildMilestoneNodes(project, level1Tasks, rowIndex), {
        keyPrefix: `overall-${tosGroup.version}`,
        tosVersionGroup: tosGroup.version,
      })
      if (row) rows.push(row)
      rowIndex++
    }

    for (const project of machineProjects) {
      const mainMarket = getMainMarket(project)
      const row = buildRoadmapMilestoneRow(project, buildMilestoneNodes(project, marketPlanData[mainMarket || '']?.tasks || [], rowIndex), {
        keyPrefix: `overall-${tosGroup.version}-${mainMarket}`,
        tosVersionGroup: tosGroup.version,
        market: mainMarket,
      })
      if (row) rows.push(row)
      rowIndex++
    }

    for (const project of techProjects) {
      const row = buildRoadmapMilestoneRow(project, buildMilestoneNodes(project, level1Tasks, rowIndex), {
        keyPrefix: `overall-${tosGroup.version}`,
        tosVersionGroup: tosGroup.version,
      })
      if (row) rows.push(row)
      rowIndex++
    }
  }

  return rows
}

function buildScopedMilestoneRows(
  projects: any[],
  scope: RoadmapScope,
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>,
  level1Tasks: any[],
) {
  if (scope === 'overall') return buildRoadmapMilestoneRows(projects, marketPlanData, level1Tasks)

  const typeMap: Record<RoadmapScope, string> = {
    overall: '',
    machine: PROJECT_TYPE_MACHINE,
    tosVersion: PROJECT_TYPE_TOS_VERSION,
    tech: PROJECT_TYPE_TECH,
  }

  let rowIndex = 0
  return sortProjectsByRoadmapDimension(projects.filter(project => project.type === typeMap[scope] && !isIndependentSoftwareProject(project) && normalizeStatus(project.status)))
    .map(project => {
      const mainMarket = project.type === PROJECT_TYPE_MACHINE ? getMainMarket(project) : undefined
      const sourceTasks = project.type === PROJECT_TYPE_MACHINE
        ? marketPlanData[mainMarket || '']?.tasks || []
        : level1Tasks
      const row = buildRoadmapMilestoneRow(project, buildMilestoneNodes(project, sourceTasks, rowIndex), {
        keyPrefix: scope,
        market: mainMarket,
      })
      rowIndex++
      return row
    })
    .filter(Boolean) as RoadmapMilestoneRow[]
}

function computeMilestoneRowSpans(rows: RoadmapMilestoneRow[], key: keyof RoadmapMilestoneRow, groupKeys: (keyof RoadmapMilestoneRow)[] = []) {
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

function countBy(rows: RoadmapMilestoneRow[], key: keyof RoadmapMilestoneRow) {
  return rows.reduce((acc, row) => {
    const value = String(row[key])
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

function scopeRows(rows: RoadmapMilestoneRow[], scope: RoadmapScope) {
  if (scope === 'overall') return rows
  if (scope === 'machine') return rows.filter(row => row.projectType === PROJECT_TYPE_MACHINE)
  if (scope === 'tosVersion') return rows.filter(row => row.projectType === PROJECT_TYPE_TOS_VERSION)
  return rows.filter(row => row.projectType === PROJECT_TYPE_TECH)
}

function applyStatusFilter(rows: RoadmapMilestoneRow[], statusFilter: StatusFilter) {
  if (statusFilter === 'all') return rows
  return rows.filter(row => row.status === statusFilter)
}

function parseMilestoneDate(value: string) {
  const match = String(value || '').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (match) {
    const [, year, month, day] = match
    return dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
  }
  return dayjs(value)
}

function filterMilestonesByDateRange(milestones: RoadmapMilestone[], range: MilestoneDateRange) {
  if (!range) return milestones
  const [start, end] = range
  const startDate = dayjs(start).startOf('day')
  const endDate = dayjs(end).endOf('day')
  return milestones.filter(milestone => {
    const date = parseMilestoneDate(milestone.date)
    if (!date.isValid()) return false
    return !date.isBefore(startDate) && !date.isAfter(endDate)
  })
}

function applyMilestoneDateRange(rows: RoadmapMilestoneRow[], range: MilestoneDateRange) {
  if (!range) return rows
  return rows
    .map(row => {
      const milestones = filterMilestonesByDateRange(row.milestones, range)
      return {
        ...row,
        milestones,
        milestonesText: milestones.map(item => `${item.date} ${item.name}`).join(' '),
      }
    })
    .filter(row => row.milestones.length > 0)
}

function normalizeDateRange(value: unknown): MilestoneDateRange {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [start, end] = value
  if (!start || !end || !dayjs(start).isValid() || !dayjs(end).isValid()) return null
  return [dayjs(start).format('YYYY-MM-DD'), dayjs(end).format('YYYY-MM-DD')]
}

function formatMilestoneDateRangeValue(range: MilestoneDateRange) {
  return range ? `${range[0]}${MILESTONE_RANGE_SEPARATOR}${range[1]}` : ''
}

function parseMilestoneDateRangeValue(value: unknown): MilestoneDateRange {
  if (Array.isArray(value)) return normalizeDateRange(value)
  const text = String(value || '').trim()
  if (!text) return null
  const [start, end] = text.split(MILESTONE_RANGE_SEPARATOR).map(item => item.trim())
  return normalizeDateRange([start, end])
}

function isMilestoneDateFilter(condition: FilterCondition) {
  return condition.field === MILESTONE_FILTER_FIELD
}

function createMilestoneDateFilter(range: MilestoneDateRange, id?: string): FilterCondition {
  return {
    id: id || createFilterCondition().id,
    field: MILESTONE_FILTER_FIELD,
    operator: 'contains',
    value: formatMilestoneDateRangeValue(range),
  }
}

function getMilestoneDateRangeFromFilters(conditions: FilterCondition[]) {
  const condition = conditions.find(isMilestoneDateFilter)
  return condition ? parseMilestoneDateRangeValue(condition.value) : null
}

function getStandardFilterConditions(conditions: FilterCondition[]) {
  return conditions.filter(condition => !isMilestoneDateFilter(condition))
}

function normalizeProjectFilterConditions(conditions: FilterCondition[], fallbackRange?: MilestoneDateRange) {
  const normalized = normalizeFilterConditions(getStandardFilterConditions(conditions))
  const milestoneCondition = conditions.find(isMilestoneDateFilter)
  const range = getMilestoneDateRangeFromFilters(conditions) || fallbackRange || null
  return range
    ? [...normalized, createMilestoneDateFilter(range, milestoneCondition?.id)]
    : normalized
}

function normalizeSnapshotDateRange(value: unknown): SnapshotDateRange {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [start, end] = value
  if (!start || !end || !dayjs(start).isValid() || !dayjs(end).isValid()) return null
  return [dayjs(start).toISOString(), dayjs(end).toISOString()]
}

function getSnapshotCreatedAt(snapshot: RoadmapSnapshot) {
  if (typeof snapshot.createdAtMs === 'number') return dayjs(snapshot.createdAtMs)
  return dayjs(snapshot.createdAt)
}

function filterSnapshotsByDateRange(snapshots: RoadmapSnapshot[], range: SnapshotDateRange) {
  if (!range) return snapshots
  const [start, end] = range
  const startDate = dayjs(start)
  const endDate = dayjs(end)
  return snapshots.filter(snapshot => {
    const createdAt = getSnapshotCreatedAt(snapshot)
    if (!createdAt.isValid()) return false
    return !createdAt.isBefore(startDate) && !createdAt.isAfter(endDate)
  })
}

function getCalendarDays(month: dayjs.Dayjs) {
  const start = month.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'))
}

function cloneRowsForShare(rows: RoadmapMilestoneRow[]) {
  return rows.map(row => ({
    ...row,
    milestones: row.milestones.map(milestone => ({ ...milestone })),
  }))
}

function applyCollapsedTosGroups(rows: RoadmapMilestoneRow[], collapsedTosGroups: Set<string>) {
  if (!collapsedTosGroups.size) return rows
  const visible: RoadmapMilestoneRow[] = []
  let i = 0
  while (i < rows.length) {
    const tosGroup = rows[i].tosVersionGroup
    const group: RoadmapMilestoneRow[] = []
    while (i < rows.length && rows[i].tosVersionGroup === tosGroup) {
      group.push(rows[i])
      i++
    }
    if (collapsedTosGroups.has(tosGroup) && group.length > 1) {
      visible.push({ ...group[0], key: `${group[0].key}-collapsed`, isCollapsedPreview: true, hiddenProjectCount: group.length - 1 })
    } else {
      visible.push(...group)
    }
  }
  return visible
}

function buildCompareRows(baseRows: RoadmapMilestoneRow[], targetRows: RoadmapMilestoneRow[]): RoadmapCompareRow[] {
  const compareFields = ['tosVersionGroup', 'productCategory', 'productSeries', 'projectName', 'tosVersion', 'status', 'spm', 'department', 'milestonesText']
  const baseMap = new Map(baseRows.map(row => [row.key, row]))
  const targetMap = new Map(targetRows.map(row => [row.key, row]))
  const keys = Array.from(new Set([...baseMap.keys(), ...targetMap.keys()]))

  return keys.map(key => {
    const base = baseMap.get(key)
    const target = targetMap.get(key)
    if (!base && target) {
      return { ...target, rowStatus: 'added', changeSummary: '新增' }
    }
    if (base && !target) {
      return { ...base, rowStatus: 'removed', changeSummary: '删除' }
    }
    if (!base || !target) {
      return null
    }

    const changedFields = compareFields.filter(field => base[field] !== target[field])
    return {
      ...target,
      rowStatus: changedFields.length ? 'modified' : 'same',
      changeSummary: changedFields.length ? `变更 ${changedFields.length} 项` : '无变化',
    }
  }).filter(Boolean) as RoadmapCompareRow[]
}

function getAvailableColumnsForScope(scope: RoadmapScope) {
  return BASE_COLUMN_OPTIONS.filter(col => {
    if (scope === 'overall') return col.key !== 'tosVersion'
    return col.key !== 'tosVersionGroup'
  })
}

function getDefaultVisibleColumnsForScope(scope: RoadmapScope) {
  return getAvailableColumnsForScope(scope)
    .filter(col => col.locked || col.defaultVisible)
    .map(col => col.key)
}

export default function MilestoneView({
  projects,
  marketPlanData,
  level1Tasks,
  onViewProject,
	initialProjectType,
	onProjectTypeChange,
	hideProjectTypeTabs,
	scopeExtra,
}: MilestoneViewProps) {
  const initialScope = initialProjectType ? SCOPE_BY_PROJECT_TYPE[initialProjectType] || 'overall' : 'overall'
  const [scope, setScope] = useState<RoadmapScope>(initialScope)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [collapsedTosGroups, setCollapsedTosGroups] = useState<Set<string>>(new Set())
  const [motionVersion, setMotionVersion] = useState(0)
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [tempFilters, setTempFilters] = useState<FilterCondition[]>([])
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => getDefaultVisibleColumnsForScope(initialScope))
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showColumnDrawer, setShowColumnDrawer] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [savedProjectViews, setSavedProjectViews] = useState<SavedProjectView[]>([])
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null)
  const [showSaveProjectViewModal, setShowSaveProjectViewModal] = useState(false)
  const [projectViewName, setProjectViewName] = useState('')
  const [showProjectViewShareModal, setShowProjectViewShareModal] = useState(false)
  const [projectViewShareUrl, setProjectViewShareUrl] = useState('')
  const [viewMode, setViewMode] = useState<ProjectViewMode>('table')
  const [milestoneDateRange, setMilestoneDateRange] = useState<MilestoneDateRange>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => dayjs().startOf('month'))
  const [sharedRowsOverride, setSharedRowsOverride] = useState<RoadmapMilestoneRow[] | null>(null)
  const [baselineSnapshots, setBaselineSnapshots] = useState<RoadmapSnapshot[]>([])
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null)
  const [snapshotDateRange, setSnapshotDateRange] = useState<SnapshotDateRange>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareBase, setCompareBase] = useState<CompareSource>('live')
  const [compareTarget, setCompareTarget] = useState<CompareSource>('live')
  const [onlyDiffRows, setOnlyDiffRows] = useState(true)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const rowsSignatureRef = useRef('')
  const stickyRegionStyle = {
    '--pms-summary-sticky-offset': `${SUMMARY_STICKY_TOP}px`,
  } as CSSProperties

  useEffect(() => {
    if (!initialProjectType) return
    const nextScope = SCOPE_BY_PROJECT_TYPE[initialProjectType]
    if (!nextScope || nextScope === scope) return
    setScope(nextScope)
    setStatusFilter('all')
    setFilters([])
    setTempFilters([])
    setMilestoneDateRange(null)
    setCollapsedTosGroups(new Set())
    setVisibleColumns(getDefaultVisibleColumnsForScope(nextScope))
    setActiveSnapshotId(null)
    setSnapshotDateRange(null)
    setCompareMode(false)
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
  }, [initialProjectType, scope])

  const allRows = useMemo(() => buildRoadmapMilestoneRows(projects, marketPlanData, level1Tasks), [projects, marketPlanData, level1Tasks])
  const scopedRows = useMemo(() => scopeRows(allRows, scope), [allRows, scope])
  const normalizedFilters = useMemo(() => normalizeProjectFilterConditions(filters, milestoneDateRange), [filters, milestoneDateRange])
  const activeMilestoneDateRange = useMemo(() => getMilestoneDateRangeFromFilters(normalizedFilters), [normalizedFilters])
  const standardFilters = useMemo(() => getStandardFilterConditions(normalizedFilters), [normalizedFilters])
  const filteredRows = useMemo(() => applyFilterConditions(scopedRows, standardFilters), [scopedRows, standardFilters])
  const dateFilteredRows = useMemo(() => applyMilestoneDateRange(filteredRows, activeMilestoneDateRange), [filteredRows, activeMilestoneDateRange])
  const statusRows = useMemo(() => (
    sharedRowsOverride || applyStatusFilter(dateFilteredRows, statusFilter)
  ), [dateFilteredRows, statusFilter, sharedRowsOverride])
  const activeSnapshot = activeSnapshotId ? baselineSnapshots.find(snapshot => snapshot.id === activeSnapshotId) : null
  const currentSnapshots = useMemo(
    () => baselineSnapshots.filter(snapshot => snapshot.scope === scope),
    [baselineSnapshots, scope],
  )
  const filteredSnapshots = useMemo(
    () => filterSnapshotsByDateRange(currentSnapshots, snapshotDateRange),
    [currentSnapshots, snapshotDateRange],
  )
  const resolveCompareSource = (source: CompareSource) => {
    if (source === 'live') return statusRows
    return baselineSnapshots.find(snapshot => snapshot.id === source)?.rows || []
  }
  const compareRows = useMemo(() => {
    if (!compareMode) return []
    const baseRows = resolveCompareSource(compareBase)
    const targetRows = resolveCompareSource(compareTarget)
    const rows = buildCompareRows(baseRows, targetRows)
    return onlyDiffRows ? rows.filter(row => row.rowStatus !== 'same') : rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareMode, compareBase, compareTarget, baselineSnapshots, statusRows, onlyDiffRows])
  const sourceRows = compareMode ? compareRows : (activeSnapshot ? activeSnapshot.rows : statusRows)
  const rows = useMemo(() => (
    scope === 'overall' && !compareMode ? applyCollapsedTosGroups(sourceRows, collapsedTosGroups) : sourceRows
  ), [sourceRows, scope, compareMode, collapsedTosGroups])
  const availableColumns = useMemo(() => getAvailableColumnsForScope(scope), [scope])
  const defaultVisibleColumns = useMemo(() => getDefaultVisibleColumnsForScope(scope), [scope])
  const hasActiveFilters = normalizedFilters.some(isFilterConditionActive)
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
	    }, {} as Record<RoadmapStatus, number>)
    const sourceRows = sharedRowsOverride || dateFilteredRows
    sourceRows.forEach(row => {
      stats[row.status] += 1
	    })
	    return stats
	  }, [dateFilteredRows, sharedRowsOverride])
	  const compareSourceOptions = useMemo(() => [
	    { value: 'live', label: '实时数据' },
	    ...currentSnapshots.map(snapshot => ({
	      value: snapshot.id,
	      label: `快照 ${snapshot.version}`,
	    })),
	  ], [currentSnapshots])
	  const compareStats = useMemo(() => {
	    const stats: Record<CompareRowStatus, number> = {
	      added: 0,
	      removed: 0,
	      modified: 0,
	      same: 0,
	    }
	    compareRows.forEach(row => {
	      stats[row.rowStatus] += 1
	    })
	    return stats
	  }, [compareRows])
	  const tosSpans = useMemo(() => computeMilestoneRowSpans(rows, 'tosVersionGroup'), [rows])
  const categorySpans = useMemo(() => computeMilestoneRowSpans(rows, 'productCategory', scope === 'overall' ? ['tosVersionGroup'] : []), [rows, scope])
  const seriesSpans = useMemo(() => computeMilestoneRowSpans(rows, 'productSeries', scope === 'overall' ? ['tosVersionGroup', 'productCategory'] : ['productCategory']), [rows, scope])
  const tosCounts = useMemo(() => countBy(statusRows, 'tosVersionGroup'), [statusRows])
  const categoryCounts = useMemo(() => countBy(statusRows, 'productCategory'), [statusRows])
  const seriesCounts = useMemo(() => countBy(statusRows, 'productSeries'), [statusRows])
  const rowsSignature = useMemo(() => (
    rows.map(row => `${row.key}:${row.isCollapsedPreview ? 'closed' : 'open'}:${row.hiddenProjectCount || 0}`).join('|')
  ), [rows])

  const getSafeVisibleColumns = (nextScope: RoadmapScope, nextVisibleColumns: string[]) => {
    const available = getAvailableColumnsForScope(nextScope)
    const availableKeys = new Set(available.map(col => col.key))
    const lockedKeys = available.filter(col => col.locked).map(col => col.key)
    const safeColumns = nextVisibleColumns.filter(key => availableKeys.has(key))
    return Array.from(new Set([...lockedKeys, ...safeColumns]))
  }

  const normalizeScope = (value: string | undefined): RoadmapScope => {
    if (value === 'software') return 'tosVersion'
    return ROADMAP_SCOPES.some(item => item.key === value) ? value as RoadmapScope : 'overall'
  }

  const normalizeStatusFilter = (value: string | undefined): StatusFilter => (
    STATUS_FILTERS.some(item => item.key === value) ? value as StatusFilter : 'all'
  )

  const normalizeViewMode = (value: string | undefined): ProjectViewMode => (
    value === 'calendar' ? 'calendar' : 'table'
  )

  const buildCurrentProjectViewState = (includeSharedRows = false): ProjectViewState => ({
    scope,
    statusFilter,
    visibleColumns,
    filters: normalizedFilters,
    collapsedKeys: Array.from(collapsedTosGroups),
    viewMode,
    milestoneDateRange: activeMilestoneDateRange,
    ...(includeSharedRows ? { sharedRows: cloneRowsForShare(statusRows) } : {}),
  })

  const applyProjectViewState = (state: ProjectViewState) => {
    const nextScope = normalizeScope(state.scope)
    const nextVisibleColumns = Array.isArray(state.visibleColumns) && state.visibleColumns.length
      ? state.visibleColumns
      : getDefaultVisibleColumnsForScope(nextScope)

    setScope(nextScope)
    onProjectTypeChange?.(PROJECT_TYPE_BY_SCOPE[nextScope])
    setStatusFilter(normalizeStatusFilter(state.statusFilter))
    const nextDateRange = normalizeDateRange(state.milestoneDateRange)
    const nextFilters = normalizeProjectFilterConditions((state.filters || []) as FilterCondition[], nextDateRange)
    setFilters(nextFilters)
    setTempFilters([])
    setCollapsedTosGroups(new Set(Array.isArray(state.collapsedKeys) ? state.collapsedKeys : []))
    setVisibleColumns(getSafeVisibleColumns(nextScope, nextVisibleColumns))
    setViewMode(normalizeViewMode(state.viewMode))
    const appliedDateRange = getMilestoneDateRangeFromFilters(nextFilters)
    setMilestoneDateRange(appliedDateRange)
    if (appliedDateRange) setCalendarMonth(dayjs(appliedDateRange[0]).startOf('month'))
    setSharedRowsOverride(Array.isArray(state.sharedRows) ? state.sharedRows as RoadmapMilestoneRow[] : null)
    setActiveSnapshotId(null)
    setCompareMode(false)
  }

  const refreshSavedProjectViews = () => {
    setSavedProjectViews(loadProjectViews(ROADMAP_MILESTONE_VIEW_KIND))
  }

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

  useEffect(() => {
    refreshSavedProjectViews()
    const sharedView = parseProjectViewShare(ROADMAP_MILESTONE_VIEW_KIND)
    if (sharedView) {
      applyProjectViewState(sharedView.state)
      setActiveSavedViewId(null)
      if (sharedView.name) setProjectViewName(sharedView.name)
      message.success('已应用分享视图')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScopeChange = (key: string) => {
    const nextScope = key as RoadmapScope
    setScope(nextScope)
    onProjectTypeChange?.(PROJECT_TYPE_BY_SCOPE[nextScope])
    setStatusFilter('all')
    setFilters([])
    setTempFilters([])
    setMilestoneDateRange(null)
    setCollapsedTosGroups(new Set())
    setVisibleColumns(getDefaultVisibleColumnsForScope(nextScope))
    setActiveSnapshotId(null)
    setSnapshotDateRange(null)
    setCompareMode(false)
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
  }

  const toggleTosGroup = (tosGroup: string) => {
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
    setCollapsedTosGroups(prev => {
      const next = new Set(prev)
      if (next.has(tosGroup)) next.delete(tosGroup)
      else next.add(tosGroup)
      return next
    })
  }

  const expandAllTosGroups = () => {
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
    setCollapsedTosGroups(new Set())
  }
  const collapseAllTosGroups = () => {
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
    setCollapsedTosGroups(new Set(Object.keys(tosCounts).filter(tosGroup => tosCounts[tosGroup] > 1)))
  }

  const handleCreateSnapshot = () => {
    const now = new Date()
    const pad = (value: number) => value.toString().padStart(2, '0')
    const version = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${now.getMilliseconds().toString().padStart(3, '0')}`
    const snapshot: RoadmapSnapshot = {
      id: `${version}-${Math.random().toString(36).slice(2, 8)}`,
      version,
      createdAt: now.toLocaleString('zh-CN'),
      createdAtMs: now.getTime(),
      scope,
      rows: JSON.parse(JSON.stringify(statusRows)),
    }
    setBaselineSnapshots(prev => [snapshot, ...prev])
    setActiveSnapshotId(snapshot.id)
  }

  const handleDeleteSnapshot = (id: string) => {
    setBaselineSnapshots(prev => prev.filter(snapshot => snapshot.id !== id))
    if (activeSnapshotId === id) setActiveSnapshotId(null)
    if (compareBase === id) setCompareBase('live')
    if (compareTarget === id) setCompareTarget('live')
  }

	  const formatCompareSourceLabel = (source: CompareSource) => {
	    if (source === 'live') return '实时数据'
	    return baselineSnapshots.find(snapshot => snapshot.id === source)?.version || source
	  }

	  const handleOpenCompare = () => {
	    setCompareBase(currentSnapshots[0]?.id || 'live')
	    setCompareTarget('live')
	    setOnlyDiffRows(true)
	    setShowCompareModal(true)
	  }

	  const handleApplyCompare = () => {
	    if (compareBase === compareTarget) return
	    setCompareMode(true)
	    setActiveSnapshotId(null)
	    setShowCompareModal(false)
	  }

  const buildExportColumns = () => (
    availableColumns
      .filter(col => col.locked || visibleColumns.includes(col.key))
      .map<ExportColumn>(col => ({
        key: col.key === 'milestones' ? 'milestonesText' : col.key,
        title: col.title,
      }))
  )

  const handleExport = (exportScope: 'current' | 'all') => {
    const sourceRows = exportScope === 'current' ? statusRows : scopedRows
    const filename = `项目路标里程碑_${ROADMAP_SCOPES.find(item => item.key === scope)?.label || '整体'}_${exportTimestamp()}.xlsx`
    exportSheet(sourceRows, buildExportColumns(), filename, '里程碑视图')
  }

  const handleSavedProjectViewChange = (value: string) => {
    if (value === 'default') {
      applyProjectViewState({
        scope: 'overall',
        statusFilter: 'all',
        visibleColumns: getDefaultVisibleColumnsForScope('overall'),
        filters: [],
        collapsedKeys: [],
        viewMode: 'table',
        milestoneDateRange: null,
      })
      setActiveSavedViewId(null)
      return
    }

    const view = savedProjectViews.find(item => item.id === value)
    if (!view) return
    applyProjectViewState(view.state)
    setActiveSavedViewId(view.id)
    setProjectViewName(view.name)
    message.success(`已切换视图：${view.name}`)
  }

  const isProjectViewNameDuplicate = (name: string) => {
    const normalizedName = name.trim().toLowerCase()
    return savedProjectViews.some(view => view.name.trim().toLowerCase() === normalizedName)
  }

  const handleOpenSaveProjectView = () => {
    setProjectViewName('')
    setShowSaveProjectViewModal(true)
  }

  const handleSaveProjectView = () => {
    const name = projectViewName.trim()
    if (!name) {
      message.warning('请输入视图名称')
      return
    }
    if (isProjectViewNameDuplicate(name)) {
      message.warning('视图名称不可重复')
      return
    }

    const now = new Date().toISOString()
    const view: SavedProjectView = {
      id: `roadmap-milestone-${Date.now()}`,
      kind: ROADMAP_MILESTONE_VIEW_KIND,
      name,
      state: buildCurrentProjectViewState(),
      createdAt: now,
      updatedAt: now,
    }

    saveProjectView(view)
    refreshSavedProjectViews()
    setActiveSavedViewId(view.id)
    setShowSaveProjectViewModal(false)
    message.success('视图已保存')
  }

  const handleDeleteProjectView = (viewId: string) => {
    const view = savedProjectViews.find(item => item.id === viewId)
    if (!view) return

    Modal.confirm({
      title: '确认删除视图',
      content: `删除「${view.name}」后无法恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        deleteProjectView(viewId)
        refreshSavedProjectViews()
        if (activeSavedViewId === viewId) setActiveSavedViewId(null)
        message.success('视图已删除')
      },
    })
  }

  const copyProjectViewShareUrl = async (url = projectViewShareUrl) => {
    if (!url) return
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(url)
      message.success('分享链接已复制')
    } catch {
      message.info('已生成分享链接，可手动复制')
    }
  }

  const handleShareProjectView = () => {
    const activeView = activeSavedViewId ? savedProjectViews.find(item => item.id === activeSavedViewId) : null
    const url = createProjectViewShareUrl(
      ROADMAP_MILESTONE_VIEW_KIND,
      buildCurrentProjectViewState(true),
      activeView?.name || projectViewName || '项目路标里程碑视图',
    )
    setProjectViewShareUrl(url)
    setShowProjectViewShareModal(true)
    void copyProjectViewShareUrl(url)
  }

  const getFilterDrawerInitialConditions = () => (
    normalizedFilters.length ? normalizedFilters.map(item => ({ ...item })) : [createFilterCondition()]
  )

  const updateTempFilter = (conditionId: string, patch: Partial<FilterCondition>) => {
    setTempFilters(prev => prev.map(item => item.id === conditionId ? { ...item, ...patch } : item))
  }

  const handleTempFilterFieldChange = (condition: FilterCondition, field: string) => {
    updateTempFilter(condition.id, {
      field,
      operator: field === MILESTONE_FILTER_FIELD ? 'contains' : condition.operator,
      value: '',
    })
  }

  const handleTempFilterDateRangeChange = (condition: FilterCondition, dates: any) => {
    const nextRange = dates?.[0] && dates?.[1]
      ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] as [string, string]
      : null
    updateTempFilter(condition.id, {
      operator: 'contains',
      value: formatMilestoneDateRangeValue(nextRange),
    })
  }

  const applyTempFilters = () => {
    const nextFilters = normalizeProjectFilterConditions(tempFilters)
    const nextDateRange = getMilestoneDateRangeFromFilters(nextFilters)
    setFilters(nextFilters)
    setMilestoneDateRange(nextDateRange)
    if (nextDateRange) setCalendarMonth(dayjs(nextDateRange[0]).startOf('month'))
    setShowFilterDrawer(false)
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
  }

  const renderFilterValueControl = (condition: FilterCondition) => {
    if (isMilestoneDateFilter(condition)) {
      const range = parseMilestoneDateRangeValue(condition.value)
      return (
        <div>
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            value={range ? [dayjs(range[0]), dayjs(range[1])] : null}
            presets={MILESTONE_DATE_RANGE_PRESETS as any}
            format="YYYY-MM-DD"
            placeholder={['开始日期', '结束日期']}
            onChange={(dates) => handleTempFilterDateRangeChange(condition, dates)}
          />
          <div style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>
            选择后，里程碑节点列仅保留范围内的节点。
          </div>
        </div>
      )
    }

    if (isValuelessFilterOperator(condition.operator)) return null

    return (
      <Input
        placeholder="输入筛选值"
        value={condition.value}
        onChange={(event) => updateTempFilter(condition.id, { value: event.target.value })}
      />
    )
  }

  const savedProjectViewTabs = [
    { key: 'default', label: '默认视图' },
    ...savedProjectViews.map(view => ({
      key: view.id,
      label: (
        <span className="pms-project-view-tab-label">
          <span>{view.name}</span>
          <Button
            type="text"
            size="small"
            className="pms-project-view-tab-close"
            icon={<DeleteOutlined />}
            aria-label={`删除视图 ${view.name}`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              handleDeleteProjectView(view.id)
            }}
          />
        </span>
      ),
    })),
  ]

  const columns = useMemo<ColumnsType<RoadmapMilestoneRow>>(() => {
    const isVisible = (key: string) => {
      const column = availableColumns.find(item => item.key === key)
      return Boolean(column?.locked || visibleColumns.includes(key))
    }
    const cols: ColumnsType<RoadmapMilestoneRow> = []

	    if (scope === 'overall' && isVisible('tosVersionGroup')) {
	      cols.push({
	        title: 'tOS版本',
	        dataIndex: 'tosVersionGroup',
	        key: 'tosVersionGroup',
	        width: 128,
	        align: 'left',
	        fixed: 'left' as const,
	        onCell: (_row, index) => ({
	          rowSpan: tosSpans[index ?? 0],
	          className: 'pms-summary-category-cell pms-summary-category-tos',
	        }),
        render: (value: string) => {
          const collapsed = collapsedTosGroups.has(value)
          return (
            <div className="pms-summary-category-content">
              <Button
                type="text"
                size="small"
                className="pms-summary-collapse-button"
                icon={collapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleTosGroup(value)
                }}
              />
              <div>
                <div className="pms-summary-category-name" style={{ color: '#0891b2' }}>{value}</div>
              </div>
            </div>
          )
        },
      })
    }

	    if (isVisible('productCategory')) {
	      cols.push({
	        title: '产品分类',
	        dataIndex: 'productCategory',
	        key: 'productCategory',
	        width: 150,
	        align: 'left',
	        fixed: 'left' as const,
	        onCell: (row, index) => ({
	          rowSpan: categorySpans[index ?? 0],
	          className: `pms-summary-category-cell pms-summary-category-${getCategoryTheme(row.productCategory).key}`,
	        }),
        render: (value: string) => {
          const theme = getCategoryTheme(value)
          return (
            <div className="pms-summary-category-content">
              <span className="pms-summary-category-dot" style={{ background: theme.accent }} />
              <div>
                <div className="pms-summary-category-name" style={{ color: theme.color }}>{theme.label || value}</div>
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

    if (isVisible('tosVersion')) {
      cols.push({
        title: 'tOS版本',
        dataIndex: 'tosVersion',
        key: 'tosVersion',
        width: 110,
        align: 'center',
        render: (value: any) => <span className="pms-summary-text-cell">{value || '-'}</span>,
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

    if (compareMode) {
      cols.push({
        title: '变更',
        key: 'changeSummary',
        width: 100,
        align: 'center',
        render: (_: unknown, row: any) => {
          const colorMap: Record<CompareRowStatus, string> = {
            added: 'green',
            removed: 'red',
            modified: 'gold',
            same: 'default',
          }
          return <Tag color={colorMap[row.rowStatus as CompareRowStatus] || 'default'} style={{ margin: 0 }}>{row.changeSummary || '-'}</Tag>
        },
      })
    }

    if (isVisible('milestones')) {
      cols.push({
        title: '里程碑节点',
        dataIndex: 'milestones',
        key: 'milestones',
        width: 760,
        className: 'pms-summary-milestones-cell',
        onHeaderCell: () => ({ className: 'pms-summary-milestones-header' }),
        render: (milestones: RoadmapMilestone[]) => (
          <div className="pms-roadmap-milestone-chain pms-summary-milestone-chain">
            {milestones.map((milestone, index) => (
              <div className="pms-roadmap-milestone-node pms-summary-milestone-node" key={`${milestone.name}-${index}`}>
                <div className="pms-roadmap-milestone-dot-wrap pms-summary-milestone-dot-wrap">
                  <span className="pms-roadmap-milestone-dot pms-summary-milestone-dot" />
                  {index < milestones.length - 1 && <span className="pms-roadmap-milestone-line pms-summary-milestone-line" />}
                </div>
                <div className="pms-roadmap-milestone-card pms-summary-milestone-card">
                  <div className="pms-roadmap-milestone-date pms-summary-milestone-date">{milestone.date}</div>
                  <div className="pms-roadmap-milestone-name pms-summary-milestone-name">{milestone.name}</div>
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
	        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewProject(row.projectId, row.market)}>
	          查看
        </Button>
      ),
    })

    return cols
  }, [availableColumns, visibleColumns, scope, tosSpans, categorySpans, seriesSpans, collapsedTosGroups, tosCounts, categoryCounts, seriesCounts, compareMode, onViewProject])

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth])
  const calendarEvents = useMemo(() => {
    const eventMap = new Map<string, { row: RoadmapMilestoneRow; milestone: RoadmapMilestone }[]>()
    sourceRows.forEach(row => {
      row.milestones.forEach(milestone => {
        const date = parseMilestoneDate(milestone.date)
        if (!date.isValid()) return
        const key = date.format('YYYY-MM-DD')
        eventMap.set(key, [...(eventMap.get(key) || []), { row, milestone }])
      })
    })
    return eventMap
  }, [sourceRows])

  const renderCalendarView = () => (
    <div className="pms-project-calendar">
      <div className="pms-project-calendar-header">
        <div className="pms-project-calendar-title">{calendarMonth.format('YYYY年M月')}</div>
        <Space size={6}>
          <Button size="small" shape="circle" onClick={() => setCalendarMonth(prev => prev.subtract(1, 'month'))}>‹</Button>
          <Button size="small" onClick={() => setCalendarMonth(dayjs().startOf('month'))}>今天</Button>
          <Button size="small" shape="circle" onClick={() => setCalendarMonth(prev => prev.add(1, 'month'))}>›</Button>
        </Space>
      </div>
      <div className="pms-project-calendar-weekdays">
        {WEEKDAYS.map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="pms-project-calendar-grid">
        {calendarDays.map(day => {
          const dayKey = day.format('YYYY-MM-DD')
          const events = calendarEvents.get(dayKey) || []
          return (
            <div
              key={dayKey}
              className={`pms-project-calendar-cell${day.month() !== calendarMonth.month() ? ' pms-project-calendar-cell-muted' : ''}`}
            >
              <div className="pms-project-calendar-dayline">
                <span>{day.format('D日')}</span>
              </div>
              <div className="pms-project-calendar-events">
                {events.slice(0, 4).map(({ row, milestone }) => {
                  const theme = getCategoryTheme(row.productCategory)
                  const calendarEventTitle = `${milestone.name}  ${row.projectName}`
                  return (
                    <div className="pms-project-calendar-event" key={`${row.key}-${milestone.name}-${milestone.date}`}>
                      <Tooltip title={calendarEventTitle}>
                        <div className="pms-project-calendar-event-single" style={{ background: theme.accent }}>
                          {calendarEventTitle}
                        </div>
                      </Tooltip>
                    </div>
                  )
                })}
                {events.length > 4 && <div className="pms-project-calendar-more">+{events.length - 4} 个节点</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderCurrentView = () => (
    viewMode === 'calendar' ? renderCalendarView() : renderMilestoneTable()
  )

  const renderMilestoneTable = () => (
    <Table
      className="pms-table pms-summary-board pms-roadmap-milestone-table"
      columns={columns}
      dataSource={rows}
      rowKey="key"
	      rowClassName={(row) => {
	        const theme = getCategoryTheme(row.productCategory)
	        const compareStatus = compareMode ? (row as RoadmapCompareRow).rowStatus : undefined
	        return [
	          `pms-summary-row-${theme.key}`,
	          row.isCollapsedPreview ? 'pms-summary-row-collapsed' : '',
	          compareStatus ? `pms-roadmap-compare-row-${compareStatus}` : '',
	          motionVersion > 0 ? 'pms-summary-row-motion' : '',
	          motionVersion > 0 ? `pms-summary-row-motion-${motionVersion % 2 === 0 ? 'even' : 'odd'}` : '',
	        ].filter(Boolean).join(' ')
      }}
      bordered
      size="small"
      tableLayout="fixed"
      scroll={{ x: 'max-content', y: TABLE_BODY_SCROLL_Y }}
      pagination={false}
      locale={{ emptyText: <Empty description="暂无项目路标里程碑数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
  )

  const snapshotPopoverContent = (
    <div className="pms-roadmap-snapshot-popover">
      <Button
        block
        type="primary"
        size="small"
        icon={<CameraOutlined />}
        onClick={handleCreateSnapshot}
      >
        创建快照
      </Button>
      <div className="pms-roadmap-snapshot-section-title">快照时间</div>
      <DatePicker.RangePicker
        size="small"
        showTime={{ format: 'HH:mm' }}
        format="YYYY/MM/DD HH:mm"
        allowClear
        className="pms-roadmap-snapshot-range"
        presets={SNAPSHOT_DATE_RANGE_PRESETS as any}
        value={snapshotDateRange ? [dayjs(snapshotDateRange[0]), dayjs(snapshotDateRange[1])] as any : null}
        placeholder={['开始时间', '结束时间']}
        onChange={(dates) => setSnapshotDateRange(normalizeSnapshotDateRange(dates))}
      />
      <div className="pms-roadmap-snapshot-section-title">切换快照</div>
      <button
        type="button"
        className={`pms-roadmap-snapshot-item${!activeSnapshotId ? ' pms-roadmap-snapshot-item-active' : ''}`}
        disabled={compareMode}
        onClick={() => {
          setCompareMode(false)
          setActiveSnapshotId(null)
        }}
      >
        <span className="pms-roadmap-snapshot-item-main">
          <HistoryOutlined />
          <span>实时数据</span>
        </span>
        {!activeSnapshotId && <Tag color="blue">当前</Tag>}
      </button>
      {filteredSnapshots.length ? (
        <div className="pms-roadmap-snapshot-list">
          {filteredSnapshots.map(snapshot => {
            const isActive = activeSnapshotId === snapshot.id
            return (
              <div className="pms-roadmap-snapshot-row" key={snapshot.id}>
                <button
                  type="button"
                  className={`pms-roadmap-snapshot-item${isActive ? ' pms-roadmap-snapshot-item-active' : ''}`}
                  disabled={compareMode}
                  onClick={() => setActiveSnapshotId(snapshot.id)}
                >
                  <span className="pms-roadmap-snapshot-item-main">
                    <HistoryOutlined />
                    <span>快照 {snapshot.version}</span>
                  </span>
                  <span className="pms-roadmap-snapshot-time">{snapshot.createdAt}</span>
                </button>
                <Tooltip title="删除快照">
                  <Button
                    aria-label="删除快照"
                    className="pms-roadmap-snapshot-delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={compareMode}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDeleteSnapshot(snapshot.id)
                    }}
                  />
                </Tooltip>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="pms-roadmap-snapshot-empty">
          {currentSnapshots.length ? '暂无符合时间范围的快照' : '暂无快照'}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <style>{`
	        .pms-summary-control-shell {
	          padding: 12px 14px 10px;
	          border: 1px solid #e2e8f0;
	          border-radius: 12px;
	          background: rgba(255,255,255,0.96);
	          box-shadow: 0 10px 24px rgba(15,23,42,0.08);
	          backdrop-filter: blur(12px);
	        }
	        .pms-summary-control-shell-static {
	          margin-bottom: 10px;
	        }
	        .pms-summary-sticky-region {
	          position: sticky;
	          top: var(--pms-summary-sticky-offset);
	          z-index: 30;
	          margin-bottom: 23px;
	        }
	        .pms-summary-sticky-region::after {
	          content: '';
	          position: absolute;
	          left: 12px;
	          right: 12px;
	          bottom: -12px;
	          height: 12px;
	          pointer-events: none;
	          background: linear-gradient(180deg, rgba(245,246,250,0.92) 0%, rgba(245,246,250,0) 100%);
	        }
	        .pms-summary-toolbar-shell {
	          padding: 6px 8px;
	          border: 1px solid #dbe5f1;
	          border-radius: 999px;
	          background: rgba(255,255,255,0.96);
	          box-shadow: 0 8px 20px rgba(15,23,42,0.08);
	          backdrop-filter: blur(12px);
	        }
	        .pms-summary-toolbar {
	          margin-bottom: 0;
	          padding: 0;
	          display: flex;
	          align-items: center;
	          justify-content: space-between;
	          gap: 8px;
	          flex-wrap: nowrap;
	        }
	        .pms-summary-status-group {
	          display: flex;
	          align-items: center;
	          justify-content: flex-start;
	          gap: 3px;
	          flex: 1 1 auto;
	          min-width: 0;
	          overflow-x: auto;
	          overflow-y: hidden;
	          padding: 3px;
	          border: 1px solid #dbe5f1;
	          border-radius: 999px;
	          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
	          scrollbar-width: none;
	        }
	        .pms-summary-status-group::-webkit-scrollbar {
	          display: none;
	        }
	        .pms-summary-toolbar-actions {
	          flex: 0 0 auto;
	          justify-content: flex-end;
	          margin-left: auto;
	          padding: 3px;
	          border: 1px solid #dbe5f1;
	          border-radius: 999px;
	          background: #fff;
	          box-shadow: 0 3px 10px rgba(15,23,42,0.04);
	        }
	        .pms-summary-toolbar-actions .ant-btn {
	          font-weight: 600;
	        }
	        .pms-summary-toolbar-actions .ant-segmented {
	          padding: 2px;
	          border-radius: 999px;
	          background: #f1f5f9;
	        }
	        .pms-summary-toolbar-actions .ant-segmented-item {
	          border-radius: 999px;
	        }
	        .pms-summary-icon-button {
	          width: 28px !important;
	          min-width: 28px !important;
	          height: 28px !important;
	          padding: 0 !important;
	          display: inline-flex !important;
	          align-items: center;
	          justify-content: center;
	          border-radius: 50% !important;
	        }
	        .pms-summary-view-mode-icon {
	          width: 22px;
	          height: 20px;
	          display: inline-flex;
	          align-items: center;
	          justify-content: center;
	        }
	        .pms-project-view-row {
	          margin-bottom: 12px;
	          padding-bottom: 10px;
	          border-bottom: 1px solid #eef2f7;
	          display: flex;
	          align-items: center;
	          justify-content: space-between;
	          gap: 12px;
	          flex-wrap: wrap;
	        }
	        .pms-project-view-left {
	          display: flex;
	          align-items: center;
	          gap: 8px;
	          flex: 1 1 520px;
	          min-width: 0;
	        }
	        .pms-project-view-tabs {
	          flex: 1 1 auto;
	          min-width: 0;
	        }
	        .pms-project-view-tabs .ant-tabs-nav {
	          margin: 0 !important;
	        }
	        .pms-project-view-tabs .ant-tabs-tab {
	          padding: 4px 10px !important;
	          border-radius: 16px;
	          transition: background-color 0.18s ease, color 0.18s ease;
	        }
	        .pms-project-view-tabs .ant-tabs-tab-active {
	          background: #eef2ff;
	        }
	        .pms-project-view-tab-label {
	          display: inline-flex;
	          align-items: center;
	          gap: 4px;
	          max-width: 170px;
	        }
	        .pms-project-view-tab-label > span:first-child {
	          overflow: hidden;
	          text-overflow: ellipsis;
	          white-space: nowrap;
	        }
	        .pms-project-view-tab-close {
	          width: 18px !important;
	          height: 18px !important;
	          min-width: 18px !important;
	          padding: 0 !important;
	          color: #94a3b8 !important;
	        }
	        .pms-project-view-tab-close:hover {
	          color: #ef4444 !important;
	          background: #fee2e2 !important;
	        }
	        .pms-summary-scope-tabs {
	          flex: 1 1 auto;
	          min-width: 0;
	        }
	        .pms-summary-scope-tabs .ant-tabs-nav {
	          margin: 0 !important;
	        }
	        .pms-summary-scope-row {
	          margin-bottom: 10px;
	          padding-bottom: 8px;
	          border-bottom: 1px solid #eef2f7;
	          display: flex;
	          align-items: center;
	          justify-content: space-between;
	          gap: 12px;
	        }
	        .pms-summary-scope-extra {
	          flex: 0 0 auto;
	          display: flex;
	          align-items: center;
	          justify-content: flex-end;
	        }
	        .pms-roadmap-snapshot-popover {
	          width: 328px;
	          max-height: 392px;
	          overflow: hidden;
	        }
	        .pms-roadmap-snapshot-range {
	          width: 100%;
	        }
	        .pms-roadmap-snapshot-section-title {
	          margin: 10px 0 6px;
	          color: #64748b;
	          font-size: 12px;
	          font-weight: 700;
	        }
	        .pms-roadmap-snapshot-list {
	          max-height: 190px;
	          overflow-y: auto;
	          padding-right: 2px;
	        }
	        .pms-roadmap-snapshot-row {
	          display: flex;
	          align-items: center;
	          gap: 4px;
	        }
	        .pms-roadmap-snapshot-item {
	          min-width: 0;
	          flex: 1 1 auto;
	          border: 0;
	          border-radius: 8px;
	          background: transparent;
	          color: #334155;
	          cursor: pointer;
	          display: flex;
	          align-items: center;
	          justify-content: space-between;
	          gap: 8px;
	          padding: 7px 8px;
	          text-align: left;
	          transition: background-color 0.18s ease, color 0.18s ease;
	        }
	        .pms-roadmap-snapshot-item:hover {
	          background: #f1f5f9;
	          color: #2563eb;
	        }
	        .pms-roadmap-snapshot-item:disabled {
	          cursor: not-allowed;
	          opacity: 0.55;
	        }
	        .pms-roadmap-snapshot-item-active {
	          background: #eef2ff;
	          color: #4f46e5;
	          font-weight: 700;
	        }
	        .pms-roadmap-snapshot-item-main {
	          min-width: 0;
	          display: inline-flex;
	          align-items: center;
	          gap: 6px;
	        }
	        .pms-roadmap-snapshot-item-main span:last-child {
	          overflow: hidden;
	          text-overflow: ellipsis;
	          white-space: nowrap;
	        }
	        .pms-roadmap-snapshot-time {
	          flex: 0 0 auto;
	          color: #94a3b8;
	          font-size: 11px;
	        }
	        .pms-roadmap-snapshot-delete {
	          flex: 0 0 auto;
	        }
	        .pms-roadmap-snapshot-empty {
	          padding: 12px 8px 4px;
	          color: #94a3b8;
	          font-size: 12px;
	          text-align: center;
	        }
	        .pms-roadmap-info-bar {
	          margin-bottom: 12px;
	          padding: 9px 12px;
	          border: 1px solid #dbeafe;
	          border-radius: 10px;
	          background: #eff6ff;
	          color: #1e3a8a;
	          display: flex;
	          align-items: center;
	          justify-content: space-between;
	          gap: 12px;
	          flex-wrap: wrap;
	        }
	        .pms-roadmap-compare-bar {
	          border-color: #fde68a;
	          background: #fffbeb;
	          color: #854d0e;
	        }
	        .pms-roadmap-compare-stat {
	          font-size: 12px;
	          font-weight: 700;
	        }
	        .pms-roadmap-compare-stat-added {
	          color: #15803d;
	        }
	        .pms-roadmap-compare-stat-removed {
	          color: #b91c1c;
	        }
	        .pms-roadmap-compare-stat-modified {
	          color: #a16207;
	        }
        .pms-summary-status-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          line-height: 22px;
          padding: 0 7px;
          flex: 0 0 auto;
        }
        .pms-summary-status-pill {
          border: 0;
          background: transparent;
          color: #334155;
          border-radius: 999px;
          height: 24px;
          padding: 0 9px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          flex: 0 0 auto;
          white-space: nowrap;
          transition: all 0.18s ease;
        }
        .pms-summary-status-pill:hover {
          background: #eaf1ff;
          color: #2563eb;
        }
        .pms-summary-status-pill-active {
          background: #4f6df5;
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
          margin-left: 4px;
          font-weight: 800;
        }
        @media (max-width: 980px) {
          .pms-summary-toolbar {
            flex-wrap: wrap;
          }
          .pms-summary-status-group {
            flex-basis: 100%;
          }
          .pms-summary-toolbar-actions {
            margin-left: 0;
          }
        }
        .pms-project-calendar {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fff;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .pms-project-calendar-header {
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .pms-project-calendar-title {
          color: #111827;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0;
        }
        .pms-project-calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, minmax(150px, 1fr));
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
        }
        .pms-project-calendar-weekdays > div {
          padding: 9px 12px;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
        }
        .pms-project-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(150px, 1fr));
          min-width: 1050px;
        }
        .pms-project-calendar-cell {
          min-height: 132px;
          padding: 8px 8px 10px;
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
        }
        .pms-project-calendar-cell:nth-child(7n) {
          border-right: none;
        }
        .pms-project-calendar-cell-muted {
          background: #fafafa;
        }
        .pms-project-calendar-dayline {
          margin-bottom: 8px;
          color: #111827;
          display: flex;
          justify-content: flex-end;
          font-size: 13px;
          font-weight: 700;
        }
        .pms-project-calendar-cell-muted .pms-project-calendar-dayline {
          color: #94a3b8;
        }
        .pms-project-calendar-events {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pms-project-calendar-event {
          min-width: 0;
        }
        .pms-project-calendar-event-single {
          height: 22px;
          padding: 0 7px;
          border-radius: 5px;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          line-height: 22px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pms-project-calendar-more {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }
        .pms-summary-board .ant-table-thead > tr:first-child > th {
          position: sticky !important;
          top: 0 !important;
          z-index: 18;
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
        .pms-summary-board .ant-table-thead > tr:first-child > th.ant-table-cell-fix,
        .pms-summary-board .ant-table-thead > tr:first-child > th.ant-table-cell-fix-start,
        .pms-summary-board .ant-table-thead > tr:first-child > th.ant-table-cell-fix-end {
          z-index: 24 !important;
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
	        .pms-summary-category-independent,
	        .pms-summary-row-independent > td.pms-summary-category-cell {
	          background: #ecfdf5 !important;
	        }
	        .pms-summary-series-independent,
	        .pms-summary-row-independent > td.pms-summary-series-cell {
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
	        .pms-roadmap-compare-row-added > td {
	          background: #f0fdf4 !important;
	        }
	        .pms-roadmap-compare-row-removed > td {
	          background: #fff1f2 !important;
	        }
	        .pms-roadmap-compare-row-modified > td {
	          background: #fffbeb !important;
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
        .pms-roadmap-milestone-chain {
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 10px;
          overflow-x: auto;
          padding: 7px 2px;
          scrollbar-width: thin;
        }
        .pms-roadmap-milestone-node {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 0 0 auto;
        }
        .pms-roadmap-milestone-dot-wrap {
          position: relative;
          width: 16px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 16px;
        }
        .pms-roadmap-milestone-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f97316;
          box-shadow: 0 0 0 4px #ffedd5;
          z-index: 1;
        }
        .pms-roadmap-milestone-line {
          position: absolute;
          left: 14px;
          width: 72px;
          height: 1px;
          background: linear-gradient(90deg, #fdba74 0%, rgba(253,186,116,0.25) 100%);
        }
        .pms-roadmap-milestone-card {
          min-width: 72px;
          padding: 4px 7px;
          border-radius: 6px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          line-height: 1.28;
          box-shadow: 0 1px 2px rgba(154,52,18,0.06);
        }
        .pms-roadmap-milestone-date {
          color: #374151;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .pms-roadmap-milestone-name {
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

	      <div className="pms-summary-control-shell pms-summary-control-shell-static">
	        {!hideProjectTypeTabs && (
	          <div className="pms-summary-scope-row">
	            <Tabs
	              className="pms-summary-scope-tabs"
	              activeKey={scope}
	              onChange={handleScopeChange}
	              items={ROADMAP_SCOPES.map(item => ({ key: item.key, label: item.label }))}
	            />
	            {scopeExtra && <div className="pms-summary-scope-extra">{scopeExtra}</div>}
		          </div>
		        )}

		        <div className="pms-project-view-row">
		          <div className="pms-project-view-left">
		            <Tabs
		              className="pms-project-view-tabs"
		              activeKey={activeSavedViewId || 'default'}
		              onChange={handleSavedProjectViewChange}
		              items={savedProjectViewTabs}
		            />
		            <Button size="small" icon={<PlusOutlined />} onClick={handleOpenSaveProjectView}>
		              新建视图
		            </Button>
		          </div>
		          <Button size="small" icon={<ShareAltOutlined />} onClick={handleShareProjectView}>
		            分享视图
		          </Button>
		        </div>
	      </div>

	      <div className="pms-summary-sticky-region pms-summary-sticky-offset" style={stickyRegionStyle}>
	        <div className="pms-summary-toolbar-shell">
		        <div className="pms-summary-toolbar">
		          <div className="pms-summary-status-group">
			            <span className="pms-summary-status-label">状态</span>
		            {STATUS_FILTERS.map(item => {
		              const count = item.key === 'all' ? (sharedRowsOverride || dateFilteredRows).length : statusStats[item.key]
		              return (
		                <button
		                  key={item.key}
		                  type="button"
		                  className={`pms-summary-status-pill${statusFilter === item.key ? ' pms-summary-status-pill-active' : ''}`}
		                  onClick={() => {
		                    setStatusFilter(item.key)
		                    setActiveSavedViewId(null)
                        setSharedRowsOverride(null)
		                  }}
		                >
		                  {item.key !== 'all' && <span className="pms-summary-status-dot" style={{ background: STATUS_DOT_COLORS[item.key] }} />}
		                  {item.label}
		                  <span className="pms-summary-status-count">{count || 0}</span>
		                </button>
		              )
		            })}
		          </div>
			          <Space size={4} className="pms-summary-toolbar-actions">
                <Segmented
                  size="small"
                  value={viewMode}
                  options={[
                    {
                      label: (
                        <Tooltip title="表格视图">
                          <span className="pms-summary-view-mode-icon"><TableOutlined /></span>
                        </Tooltip>
                      ),
                      value: 'table',
                    },
                    {
                      label: (
                        <Tooltip title="日历视图">
                          <span className="pms-summary-view-mode-icon"><CalendarOutlined /></span>
                        </Tooltip>
                      ),
                      value: 'calendar',
                    },
                  ]}
                  onChange={(value) => {
                    setViewMode(value as ProjectViewMode)
                    setActiveSavedViewId(null)
                  }}
                />
		            {scope === 'overall' && (
		              <>
		                <Tooltip title="展开全部">
		                  <Button
		                    aria-label="展开全部"
		                    className="pms-summary-icon-button"
		                    size="small"
		                    icon={<CaretDownOutlined />}
		                    onClick={expandAllTosGroups}
		                  />
		                </Tooltip>
		                <Tooltip title="折叠全部">
		                  <Button
		                    aria-label="折叠全部"
		                    className="pms-summary-icon-button"
		                    size="small"
		                    icon={<CaretRightOutlined />}
		                    onClick={collapseAllTosGroups}
		                  />
		                </Tooltip>
		              </>
	            )}
	            <Tooltip title={hasActiveFilters ? '筛选（已启用）' : '筛选'}>
	              <Button
	                aria-label="筛选"
	                className="pms-summary-icon-button"
	                size="small"
	                icon={<FilterOutlined />}
	                type={hasActiveFilters ? 'primary' : 'default'}
	                onClick={() => {
	                  setTempFilters(getFilterDrawerInitialConditions())
	                  setShowFilterDrawer(true)
	                }}
	              />
	            </Tooltip>
	            <Tooltip title="列设置">
	              <Button
	                aria-label="列设置"
	                className="pms-summary-icon-button"
	                size="small"
	                icon={<SettingOutlined />}
	                onClick={() => setShowColumnDrawer(true)}
	              />
	            </Tooltip>
		            <Popover
		              title="快照"
		              content={snapshotPopoverContent}
		              trigger="hover"
		              placement="bottomRight"
		              overlayClassName="pms-roadmap-snapshot-overlay"
		            >
		              <Button
		                aria-label="快照"
		                className="pms-summary-icon-button"
		                size="small"
		                icon={<CameraOutlined />}
		                type={activeSnapshotId ? 'primary' : 'default'}
		              />
		            </Popover>
	            <Tooltip title={compareMode ? '对比中' : '对比'}>
	              <span>
	                <Button
	                  aria-label={compareMode ? '对比中' : '对比'}
	                  className="pms-summary-icon-button"
	                  size="small"
	                  icon={<SwapOutlined />}
	                  type={compareMode ? 'primary' : 'default'}
	                  disabled={!currentSnapshots.length}
	                  onClick={handleOpenCompare}
	                />
	              </span>
	            </Tooltip>
	            <Dropdown
	              menu={{
	                items: [
	                  { key: 'current', label: '导出当前视图' },
	                  { key: 'all', label: '导出当前分类全部' },
	                ],
	                onClick: ({ key }) => handleExport(key as 'current' | 'all'),
	              }}
	            >
	              <Tooltip title="导出">
	                <Button
	                  aria-label="导出"
	                  className="pms-summary-icon-button"
	                  size="small"
	                  icon={<DownloadOutlined />}
	                />
	              </Tooltip>
	            </Dropdown>
	            <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
	              <Button
	                aria-label={isFullscreen ? '退出全屏' : '全屏'}
	                className="pms-summary-icon-button"
	                size="small"
	                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
	                onClick={() => setIsFullscreen(true)}
	              />
	            </Tooltip>
	          </Space>
	        </div>
	      </div>
	      </div>

	      {activeSnapshot && !compareMode && (
	        <div className="pms-roadmap-info-bar">
	          <Space size={8}>
	            <HistoryOutlined />
	            <span>当前查看快照 {activeSnapshot.version}</span>
	            <Tag color="blue">{activeSnapshot.createdAt}</Tag>
	          </Space>
	          <Button size="small" onClick={() => setActiveSnapshotId(null)}>返回实时数据</Button>
	        </div>
	      )}

	      {compareMode && (
	        <div className="pms-roadmap-info-bar pms-roadmap-compare-bar">
	          <Space size={8} wrap>
	            <SwapOutlined />
	            <span>{formatCompareSourceLabel(compareBase)}</span>
	            <ArrowRightOutlined />
	            <span>{formatCompareSourceLabel(compareTarget)}</span>
	            <span className="pms-roadmap-compare-stat pms-roadmap-compare-stat-added">新增 {compareStats.added}</span>
	            <span className="pms-roadmap-compare-stat pms-roadmap-compare-stat-removed">删除 {compareStats.removed}</span>
	            <span className="pms-roadmap-compare-stat pms-roadmap-compare-stat-modified">变更 {compareStats.modified}</span>
	          </Space>
	          <Space size={10}>
	            <Checkbox checked={onlyDiffRows} onChange={(event) => setOnlyDiffRows(event.target.checked)}>仅看差异</Checkbox>
	            <Button size="small" onClick={() => setShowCompareModal(true)}>切换对比</Button>
	            <Button size="small" onClick={() => setCompareMode(false)}>退出对比</Button>
	          </Space>
	        </div>
	      )}

	      {renderCurrentView()}

	      <Modal
	        title={(
	          <Space>
	            <span>项目路标里程碑视图</span>
	            <Tag>{ROADMAP_SCOPES.find(item => item.key === scope)?.label || '整体'}</Tag>
          </Space>
        )}
        open={isFullscreen}
        onCancel={() => setIsFullscreen(false)}
        footer={null}
        width="100vw"
        style={{ top: 0, maxWidth: '100vw', paddingBottom: 0 }}
        styles={{ body: { height: 'calc(100vh - 110px)', overflow: 'auto' } }}
      >
        {renderCurrentView()}
      </Modal>

	      <Modal
	        title="新建视图"
	        open={showSaveProjectViewModal}
	        onCancel={() => setShowSaveProjectViewModal(false)}
	        onOk={handleSaveProjectView}
	        okText="新建"
	        cancelText="取消"
	        okButtonProps={{ disabled: !projectViewName.trim() }}
	      >
	        <Space direction="vertical" size={10} style={{ width: '100%' }}>
	          <Input
	            autoFocus
	            placeholder="请输入视图名称"
	            value={projectViewName}
	            onChange={(event) => setProjectViewName(event.target.value)}
	            onPressEnter={handleSaveProjectView}
	          />
	          <div style={{ color: '#64748b', fontSize: 12 }}>
	            将以当前分类、视图模式、状态筛选、字段筛选条件、列设置和 tOS 折叠状态创建视图；快照和对比状态不会写入视图配置，名称不可重复。
	          </div>
	        </Space>
	      </Modal>

	      <Modal
	        title="分享视图"
	        open={showProjectViewShareModal}
	        onCancel={() => setShowProjectViewShareModal(false)}
	        footer={(
	          <Space>
	            <Button icon={<CopyOutlined />} onClick={() => void copyProjectViewShareUrl()}>
	              复制链接
	            </Button>
	            <Button type="primary" onClick={() => setShowProjectViewShareModal(false)}>
	              完成
	            </Button>
	          </Space>
	        )}
	      >
	        <Space direction="vertical" size={10} style={{ width: '100%' }}>
	          <Input.TextArea value={projectViewShareUrl} readOnly autoSize={{ minRows: 3, maxRows: 6 }} />
	          <div style={{ color: '#64748b', fontSize: 12 }}>
	            分享链接会携带当前筛选条件和筛选后的数据快照，打开后自动应用到项目路标里程碑视图。
	          </div>
	        </Space>
	      </Modal>

	      <Modal
	        title="快照对比"
	        open={showCompareModal}
	        onCancel={() => setShowCompareModal(false)}
	        onOk={handleApplyCompare}
	        okButtonProps={{ disabled: compareBase === compareTarget }}
	        okText="开始对比"
	        cancelText="取消"
	      >
	        <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: 10, alignItems: 'center' }}>
	          <Select
	            value={compareBase}
	            options={compareSourceOptions}
	            onChange={(value) => setCompareBase(value)}
	          />
	          <ArrowRightOutlined style={{ color: '#94a3b8', textAlign: 'center' }} />
	          <Select
	            value={compareTarget}
	            options={compareSourceOptions}
	            onChange={(value) => setCompareTarget(value)}
	          />
	        </div>
	        <div style={{ marginTop: 10, color: '#64748b', fontSize: 12 }}>
	          对比会按当前视图维度展示新增、删除和字段变更；里程碑节点按完整节点链参与比较。
	        </div>
	      </Modal>

	      <Drawer
        title="筛选条件"
        open={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        width={520}
        placement="right"
        zIndex={ROADMAP_DRAWER_Z_INDEX}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => {
              setTempFilters([createFilterCondition()])
              setMilestoneDateRange(null)
              setSharedRowsOverride(null)
            }}>清除全部</Button>
            <Space>
              <Button onClick={() => setShowFilterDrawer(false)}>取消</Button>
              <Button
	                type="primary"
	                onClick={applyTempFilters}
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
              <div style={{ display: 'grid', gridTemplateColumns: isMilestoneDateFilter(condition) ? 'minmax(0, 1fr) 40px' : 'minmax(0, 1fr) 116px 40px', gap: 8, marginBottom: isValuelessFilterOperator(condition.operator) && !isMilestoneDateFilter(condition) ? 0 : 8 }}>
                <Select
                  aria-label="筛选字段"
                  placeholder="筛选字段"
                  value={condition.field || undefined}
                  options={getFieldOptionsWithDuplicateDisabled(filterFieldOptions, tempFilters, condition.id)}
                  onChange={(value) => handleTempFilterFieldChange(condition, value)}
                />
                {!isMilestoneDateFilter(condition) && (
                  <Select
                    value={condition.operator}
                    options={FILTER_OPERATORS as any}
                    onChange={(value) => {
                      const operator = value as FilterCondition['operator']
                      updateTempFilter(condition.id, {
                        operator,
                        value: isValuelessFilterOperator(operator) ? '' : condition.value,
                      })
                    }}
                  />
                )}
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => setTempFilters(prev => prev.length > 1 ? prev.filter(item => item.id !== condition.id) : [createFilterCondition()])}
                />
              </div>
              {renderFilterValueControl(condition)}
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
        zIndex={ROADMAP_DRAWER_Z_INDEX}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => {
	              setVisibleColumns(defaultVisibleColumns)
	              setActiveSavedViewId(null)
              setSharedRowsOverride(null)
	            }}>重置默认</Button>
            <Space>
              <Button onClick={() => setShowColumnDrawer(false)}>取消</Button>
              <Button type="primary" onClick={() => setShowColumnDrawer(false)}>确定</Button>
            </Space>
          </div>
        )}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: '#9ca3af' }}>
          {scope === 'overall' ? '整体视图保留首列 tOS版本维度，不显示项目名后的重复 tOS版本；' : '当前视图不显示首列 tOS版本维度；'}固定列始终显示。
        </div>
        <Checkbox.Group
          value={visibleColumns}
	          onChange={(vals) => {
	            setVisibleColumns(vals as string[])
	            setActiveSavedViewId(null)
              setSharedRowsOverride(null)
	          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {availableColumns.map(col => (
            <Checkbox key={col.key} value={col.key} disabled={!!col.locked}>
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
