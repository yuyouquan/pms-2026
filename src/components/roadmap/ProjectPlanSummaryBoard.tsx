'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, Checkbox, DatePicker, Dropdown, Empty, Input, Modal, Segmented, Select, Space, Table, Tabs, Tag, Tooltip, message } from 'antd'
import { CalendarOutlined, CaretDownOutlined, CaretRightOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, FilterOutlined, FullscreenExitOutlined, FullscreenOutlined, PlusOutlined, SettingOutlined, ShareAltOutlined, TableOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import { FloatingFilterPanel } from '@/components/shared/FloatingFilterPanel'
import {
  inferOsSeriesFromProjectName,
  inferTosVersionFromProjectName,
} from '@/constants/projectBasicFields'
import {
  PROJECT_CATEGORY_MACHINE,
  isMachineProjectType,
  isSoftwareProjectType,
  normalizeSoftwareProjectType,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_MACHINE_PHONE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_TOS_VERSION,
} from '@/constants/projectTypes'
import type { FilterCondition, FilterFieldDefinition } from '@/lib/filterConditions'
import {
  getDefaultColumnSettings,
  normalizeColumnSettings,
  orderVisibleDefinitions,
  type SortableColumnSettingsValue,
} from '@/lib/columnSettings'
import {
  applyFilterConditions,
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  getFilterOperatorsForKind,
  isFilterConditionActive,
  isValuelessFilterOperator,
  normalizeFilterConditions,
} from '@/lib/filterConditions'
import {
  PROJECT_VIEW_KINDS,
  createProjectViewShareUrl,
  deleteProjectView,
  getProjectSummaryBoardColumns,
  getProjectSummaryBoardFilterFields,
  getProjectSummaryFieldDefinitions,
  getProjectSummaryScopeFilterFields,
  getProjectViewColumnSettings,
  getScopedColumnDefinitions,
  getTemplateTaskFieldDefinitions,
  MILESTONE_FILTER_FIELD,
  migrateLegacySummaryRows,
  TECH_MILESTONE_FILTER_FIELD,
  loadProjectViews,
  parseProjectViewShare,
  saveProjectView,
  type ProjectViewState,
  type RoadmapColumnConfig,
  type SavedProjectView,
} from './utils'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import {
  buildProjectSummaryRow,
  getLatestPublishedTemplateTasks,
  type ProjectSummaryFieldDefinition,
} from '@/lib/projectSummary'
import { getTemplateTasksForProjectType } from '@/lib/projectTemplateCompatibility'
import { usePlanStore } from '@/stores/plan'

type SummaryScope = 'overall' | 'machine' | 'tosVersion' | 'tech'
type SummaryStatus = '在研' | '上市' | '转维'
type StatusFilter = 'all' | SummaryStatus
type ProjectViewMode = 'table' | 'calendar'
type MilestoneDateRange = [string, string] | null

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
  milestones?: SummaryMilestone[]
  milestonesText?: string
  isCollapsedPreview?: boolean
  collapsePreviewType?: 'category' | 'series'
  hiddenProjectCount?: number
  hiddenSeriesCount?: number
}

const SUMMARY_SCOPES: { key: SummaryScope; label: string }[] = [
  { key: 'overall', label: '整体' },
  { key: 'machine', label: '整机项目' },
  { key: 'tosVersion', label: 'tOS版本项目' },
  { key: 'tech', label: '技术项目' },
]

const SUMMARY_VISIBLE_STATUSES: SummaryStatus[] = ['在研', '上市', '转维']

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '在研', label: '在研' },
  { key: '上市', label: '上市' },
  { key: '转维', label: '转维' },
]
const SUMMARY_VIEW_KIND = PROJECT_VIEW_KINDS.summaryBoard
const SUMMARY_STICKY_TOP = 47
const TABLE_BODY_SCROLL_Y = 'calc(100vh - 180px)'

const CATEGORY_ORDER = ['CAMON', 'Note', 'SPARK', 'POVA', 'tOS版本', '技术项目']

const CATEGORY_THEME: Record<string, { key: string; label?: string; color: string; bg: string; seriesBg: string; accent: string }> = {
  CAMON: { key: 'camon', color: '#2563eb', bg: '#eff6ff', seriesBg: '#f8fbff', accent: '#3b82f6' },
  Note: { key: 'note', label: 'NOTE', color: 'var(--pms-brand-strong)', bg: 'var(--pms-brand-surface)', seriesBg: 'color-mix(in srgb, var(--pms-brand) 4%, var(--pms-surface-solid))', accent: 'var(--pms-brand)' },
  SPARK: { key: 'spark', color: '#059669', bg: '#ecfdf5', seriesBg: '#f4fff9', accent: '#10b981' },
  POVA: { key: 'pova', color: '#d97706', bg: '#fffbeb', seriesBg: '#fffdf2', accent: '#f59e0b' },
  tOS版本: { key: 'tos', color: '#0891b2', bg: '#ecfeff', seriesBg: '#f0fdfa', accent: '#06b6d4' },
  独立软件产品: { key: 'independent', color: '#0f766e', bg: '#ecfdf5', seriesBg: '#f0fdfa', accent: '#14b8a6' },
  技术项目: { key: 'tech', color: '#0f766e', bg: '#ecfdf5', seriesBg: '#f0fdf4', accent: '#14b8a6' },
}

const DEFAULT_CATEGORY_THEME = { key: 'default', color: '#475569', bg: '#f8fafc', seriesBg: '#ffffff', accent: '#94a3b8' }

const getCategoryTheme = (category: string) => CATEGORY_THEME[category] || DEFAULT_CATEGORY_THEME

const STATUS_COLORS: Record<string, string> = {
  在研: 'processing',
  上市: 'gold',
  转维: 'purple',
  已上市: 'gold',
  进行中: 'orange',
  维护: 'purple',
  维护期: 'purple',
  已完成: 'cyan',
  已迁移: 'default',
  筹备中: 'blue',
}

const STATUS_DOT_COLORS: Record<SummaryStatus, string> = {
  在研: '#10b981',
  上市: '#3b82f6',
  转维: '#8b5cf6',
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

const TECH_MILESTONE_NAMES = ['概念启动', 'TDR1', 'TDR2', 'TDR3', 'TDR4']
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
const MILESTONE_RANGE_SEPARATOR = '~'
const COMMON_COLUMN_OPTIONS: RoadmapColumnConfig[] = [
  { key: 'productCategory', title: '产品分类', width: 150, defaultVisible: true, locked: true },
  { key: 'productSeries', title: '产品系列', width: 146, defaultVisible: true },
  { key: 'projectName', title: '项目名', width: 176, defaultVisible: true, locked: true },
  { key: 'tosVersion', title: 'tOS版本', width: 110, defaultVisible: true },
  { key: 'status', title: '状态', width: 104, defaultVisible: true },
  { key: 'spm', title: 'SPM', width: 90, defaultVisible: true },
  { key: 'department', title: '部门', width: 128, defaultVisible: true },
]
const TECHNICAL_MILESTONE_COLUMN: RoadmapColumnConfig = {
  key: 'milestones',
  title: '里程碑节点',
  width: 720,
  defaultVisible: true,
}

const toDate = (baseDate: string | undefined, index: number, rowOffset: number) => {
  const base = baseDate && dayjs(baseDate).isValid() ? dayjs(baseDate) : dayjs('2026-01-01')
  return base.add(index * 30 + rowOffset * 5, 'day').format('YYYY/M/D')
}

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

const buildMilestones = (project: any, names: string[], rowIndex: number): SummaryMilestone[] => (
  names.map((name, index) => ({
    name,
    date: toDate(project.planStartDate, index, rowIndex % 3),
  }))
)

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
const normalizeSummaryStatus = (status: any): SummaryStatus | null => {
  const value = String(status || '').trim()
  if (value === '进行中') return '在研'
  if (value === '已上市') return '上市'
  if (value === '维护' || value === '维护期') return '转维'
  if (SUMMARY_VISIBLE_STATUSES.includes(value as SummaryStatus)) return value as SummaryStatus
  return null
}
const normalizeValue = (value: any) => {
  if (Array.isArray(value)) return value.join(',')
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

const getProjectTosVersion = (project: any) => normalizeValue(
  project.tosVersion
  || project.tosVersionName
  || splitValues(project.tosVersions)[0]
  || inferTosVersionFromProjectName(project.name),
)

const buildProjectFields = (project: any) => ({
  tosVersion: getProjectTosVersion(project),
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

function getAvailableColumnsForScope(
  scope: SummaryScope,
  activeProjectSummaryDefinitions: readonly ProjectSummaryFieldDefinition[] = [],
): RoadmapColumnConfig[] {
  if (scope === 'machine' || scope === 'tosVersion') {
    return getProjectSummaryBoardColumns(activeProjectSummaryDefinitions)
  }
  const commonColumns = COMMON_COLUMN_OPTIONS.filter(
    col => scope === 'overall' || col.key !== 'productCategory',
  )
  return scope === 'tech'
    ? [...commonColumns, TECHNICAL_MILESTONE_COLUMN]
    : commonColumns
}

function getDefaultVisibleColumnsForScope(
  scope: SummaryScope,
  activeProjectSummaryDefinitions: readonly ProjectSummaryFieldDefinition[] = [],
) {
  return getAvailableColumnsForScope(scope, activeProjectSummaryDefinitions)
    .filter(col => col.locked || col.defaultVisible)
    .map(col => col.key)
}

interface ProjectSummaryDefinitionSets {
  machine: ProjectSummaryFieldDefinition[]
  tosVersion: ProjectSummaryFieldDefinition[]
}

const makeSummaryRows = (
  projects: any[],
  definitionSets: ProjectSummaryDefinitionSets,
): SummaryRow[] => {
  const rows: SummaryRow[] = []
  let rowIndex = 0

  for (const project of projects) {
    const status = normalizeSummaryStatus(project.status)
    if (!status) continue

    if (isMachineProjectType(project.type)) {
      const summaryValues = buildProjectSummaryRow(project, definitionSets.machine)
      rows.push({
        ...buildProjectFields(project),
        ...summaryValues,
        key: `machine-${project.id}`,
        projectId: project.id,
        projectType: PROJECT_TYPE_MACHINE_PHONE,
        productCategory: getMachineCategory(project),
        productSeries: getMachineSeries(project),
        projectName: project.name,
        status,
        spm: project.spm || project.leader || '-',
        department: getDepartmentByFirstSpm(project, '软件项目一部'),
      })
      rowIndex++
    }

    if (isSoftwareProjectType(project.type)) {
      const normalizedProjectType = normalizeSoftwareProjectType(project.type, project.name)
      if (normalizedProjectType === PROJECT_TYPE_INDEPENDENT_SOFTWARE) continue
      const summaryValues = buildProjectSummaryRow(project, definitionSets.tosVersion)
      rows.push({
        ...buildProjectFields(project),
        ...summaryValues,
        key: `${normalizedProjectType}-${project.id}`,
        projectId: project.id,
        projectType: normalizedProjectType,
        productCategory: getSoftwareCategory(project),
        productSeries: getSoftwareSeries(project),
        projectName: project.name,
        status,
        spm: project.spm || project.leader || '-',
        department: getDepartmentByFirstSpm(project, '软件项目一部'),
      })
      rowIndex++
    }

    if (project.type === PROJECT_TYPE_TECH) {
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
        department: getDepartmentByFirstSpm(project, '集成维护部'),
        milestones,
        milestonesText: milestones
          .map(item => `${item.date} ${item.name}`)
          .join(' '),
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

const getSeriesGroupKey = (category: string, series: string) => `series::${category}::${series}`

function countUniqueProjects(rows: SummaryRow[]) {
  return new Set(rows.map(row => row.projectId)).size
}

function countSeriesByCategory(rows: SummaryRow[]) {
  const categorySeriesMap = rows.reduce((acc, row) => {
    const category = row.productCategory
    if (!acc[category]) acc[category] = new Set<string>()
    acc[category].add(row.productSeries)
    return acc
  }, {} as Record<string, Set<string>>)

  return Object.fromEntries(
    Object.entries(categorySeriesMap).map(([category, series]) => [category, series.size]),
  ) as Record<string, number>
}

function countProjectsBySeriesGroup(rows: SummaryRow[]) {
  const seriesProjectMap = rows.reduce((acc, row) => {
    const key = getSeriesGroupKey(row.productCategory, row.productSeries)
    if (!acc[key]) acc[key] = new Set<string>()
    acc[key].add(row.projectId)
    return acc
  }, {} as Record<string, Set<string>>)

  return Object.fromEntries(
    Object.entries(seriesProjectMap).map(([key, projects]) => [key, projects.size]),
  ) as Record<string, number>
}

function scopeRows(rows: SummaryRow[], scope: SummaryScope) {
  if (scope === 'machine') return rows.filter(row => isMachineProjectType(row.projectType))
  if (scope === 'tosVersion') return rows.filter(row => row.projectType === PROJECT_TYPE_TOS_VERSION)
  if (scope === 'tech') return rows.filter(row => row.projectType === PROJECT_TYPE_TECH)
  return rows
}

function applyStatusFilter(rows: SummaryRow[], statusFilter: StatusFilter) {
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

function getNodeDefinitionsForRow(
  row: SummaryRow,
  definitionSets: ProjectSummaryDefinitionSets,
) {
  if (isMachineProjectType(row.projectType)) {
    return definitionSets.machine.filter(definition => definition.source === 'templateTask')
  }
  if (row.projectType === PROJECT_TYPE_TOS_VERSION) {
    return definitionSets.tosVersion.filter(definition => definition.source === 'templateTask')
  }
  return []
}

function getSafeRowMilestones(value: unknown): SummaryMilestone[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const name = (item as { name?: unknown }).name
    const date = (item as { date?: unknown }).date
    return typeof name === 'string' && name.trim()
      && typeof date === 'string' && date.trim()
      ? [{ name: name.trim(), date: date.trim() }]
      : []
  })
}

function getRowNodeMilestones(
  row: SummaryRow,
  nodeDefinitions: readonly ProjectSummaryFieldDefinition[],
): SummaryMilestone[] {
  if (row.projectType === PROJECT_TYPE_TECH) {
    return getSafeRowMilestones(row.milestones)
  }
  const dynamicMilestones = nodeDefinitions.flatMap(definition => {
    const value = row[definition.key]
    if (typeof value !== 'string' || !value || value === '-') return []
    return [{ name: definition.title, date: value }]
  })
  if (dynamicMilestones.length > 0) return dynamicMilestones
  return getSafeRowMilestones(row.milestones)
}

function applyMilestoneDateRange(
  rows: SummaryRow[],
  range: MilestoneDateRange,
  definitionSets: ProjectSummaryDefinitionSets,
) {
  if (!range) return rows
  const [start, end] = range
  const startDate = dayjs(start).startOf('day')
  const endDate = dayjs(end).endOf('day')
  return rows.flatMap(row => {
    const milestones = getRowNodeMilestones(
      row,
      getNodeDefinitionsForRow(row, definitionSets),
    ).filter(milestone => {
      const date = parseMilestoneDate(milestone.date)
      return date.isValid() && !date.isBefore(startDate) && !date.isAfter(endDate)
    })
    if (milestones.length === 0) return []
    if (row.projectType === PROJECT_TYPE_TECH) {
      return [{
        ...row,
        milestones,
        milestonesText: milestones.map(item => `${item.date} ${item.name}`).join(' '),
      }]
    }
    return [row]
  })
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
    || condition.field === TECH_MILESTONE_FILTER_FIELD
}

function createMilestoneDateFilter(
  range: MilestoneDateRange,
  id?: string,
  field = MILESTONE_FILTER_FIELD,
): FilterCondition {
  return {
    id: id || createFilterCondition().id,
    field,
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

function normalizeProjectFilterConditions(
  conditions: FilterCondition[],
  fallbackRange?: MilestoneDateRange,
  filterFieldDefinitions?: readonly FilterFieldDefinition[],
) {
  const normalized = normalizeFilterConditions(
    getStandardFilterConditions(conditions),
    filterFieldDefinitions,
  )
  const milestoneCondition = conditions.find(isMilestoneDateFilter)
  const range = getMilestoneDateRangeFromFilters(conditions) || fallbackRange || null
  const defaultMilestoneFilterField = filterFieldDefinitions?.some(
    definition => definition.key === TECH_MILESTONE_FILTER_FIELD,
  )
    ? TECH_MILESTONE_FILTER_FIELD
    : MILESTONE_FILTER_FIELD
  const milestoneFilterField = milestoneCondition?.field ?? defaultMilestoneFilterField
  return range
    ? [...normalized, createMilestoneDateFilter(
        range,
        milestoneCondition?.id,
        milestoneFilterField,
      )]
    : normalized
}

function getCalendarDays(month: dayjs.Dayjs) {
  const start = month.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'))
}

function cloneRowsForShare(rows: SummaryRow[]) {
  return rows.map(row => ({
    ...row,
    ...(row.milestones ? {
      milestones: row.milestones.map(milestone => ({ ...milestone })),
    } : {}),
  }))
}

function applyCollapsedGroups(
  rows: SummaryRow[],
  collapsedCategories: Set<string>,
  collapsedSeries: Set<string>,
) {
  const visible: SummaryRow[] = []
  let i = 0
  while (i < rows.length) {
    const category = rows[i].productCategory
    const group: SummaryRow[] = []
    while (i < rows.length && rows[i].productCategory === category) {
      group.push(rows[i])
      i++
    }
    const seriesCount = new Set(group.map(row => row.productSeries)).size
    if (collapsedCategories.has(category) && seriesCount > 1) {
      visible.push({
        ...group[0],
        key: `${group[0].key}-category-collapsed`,
        isCollapsedPreview: true,
        collapsePreviewType: 'category',
        hiddenProjectCount: countUniqueProjects(group) - 1,
        hiddenSeriesCount: seriesCount - 1,
      })
      continue
    }

    let seriesIndex = 0
    while (seriesIndex < group.length) {
      const series = group[seriesIndex].productSeries
      const seriesGroup: SummaryRow[] = []
      while (seriesIndex < group.length && group[seriesIndex].productSeries === series) {
        seriesGroup.push(group[seriesIndex])
        seriesIndex++
      }
      const seriesKey = getSeriesGroupKey(category, series)
      if (collapsedSeries.has(seriesKey) && seriesGroup.length > 1) {
        visible.push({
          ...seriesGroup[0],
          key: `${seriesGroup[0].key}-series-collapsed`,
          isCollapsedPreview: true,
          collapsePreviewType: 'series',
          hiddenProjectCount: countUniqueProjects(seriesGroup) - 1,
        })
      } else {
        visible.push(...seriesGroup)
      }
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
  const {
    versions,
    currentVersion,
    publishedSnapshots,
    configTemplateTasksByType,
  } = usePlanStore()
  const projectSummaryDefinitionsByScope = useMemo<ProjectSummaryDefinitionSets>(() => {
    const getDefinitions = (projectType: string) => {
      const currentTemplateTasks = getTemplateTasksForProjectType(
        configTemplateTasksByType,
        projectType,
      ) ?? []
      const publishedTemplateTasks = getLatestPublishedTemplateTasks(
        projectType,
        versions,
        publishedSnapshots,
        currentVersion,
        currentTemplateTasks,
        { namespacedOnly: true },
      )
      return [
        ...getProjectSummaryFieldDefinitions(projectType),
        ...getTemplateTaskFieldDefinitions(projectType, publishedTemplateTasks),
      ]
    }
    return {
      machine: getDefinitions(PROJECT_CATEGORY_MACHINE),
      tosVersion: getDefinitions(PROJECT_TYPE_TOS_VERSION),
    }
  }, [
    configTemplateTasksByType,
    currentVersion,
    publishedSnapshots,
    versions,
  ])
  const [scope, setScope] = useState<SummaryScope>('overall')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [collapsedSeries, setCollapsedSeries] = useState<Set<string>>(new Set())
  const [motionVersion, setMotionVersion] = useState(0)
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [tempFilters, setTempFilters] = useState<FilterCondition[]>([])
  const [columnSettings, setColumnSettings] = useState<SortableColumnSettingsValue<string>>(() => (
    getDefaultColumnSettings(getScopedColumnDefinitions(
      getAvailableColumnsForScope('overall', []),
      ['productCategory', 'productSeries', 'projectName'],
    ))
  ))
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
  const [sharedRowsOverride, setSharedRowsOverride] = useState<SummaryRow[] | null>(null)
  const rowsSignatureRef = useRef('')
  const stickyRegionStyle = {
    '--pms-summary-sticky-offset': `${SUMMARY_STICKY_TOP}px`,
  } as CSSProperties
  const activeProjectType = scope === 'machine'
    ? PROJECT_CATEGORY_MACHINE
    : scope === 'tosVersion'
      ? PROJECT_TYPE_TOS_VERSION
      : null
  const activeProjectSummaryDefinitions = useMemo(
    () => activeProjectType
      ? projectSummaryDefinitionsByScope[scope as 'machine' | 'tosVersion']
      : [],
    [activeProjectType, projectSummaryDefinitionsByScope, scope],
  )
  const allRows = useMemo(
    () => makeSummaryRows(projects, projectSummaryDefinitionsByScope),
    [projectSummaryDefinitionsByScope, projects],
  )
  const scopedRows = useMemo(() => scopeRows(allRows, scope), [allRows, scope])
  const availableColumns = useMemo(
    () => getAvailableColumnsForScope(scope, activeProjectSummaryDefinitions),
    [activeProjectSummaryDefinitions, scope],
  )
  const filterFieldDefinitions = useMemo<FilterFieldDefinition[]>(() => {
    const baseFields = activeProjectType
      ? getProjectSummaryBoardFilterFields(
          activeProjectType,
          activeProjectSummaryDefinitions,
        )
      : availableColumns.map(column => ({
          key: column.key,
          label: column.title,
          kind: 'text' as const,
        }))
    return getProjectSummaryScopeFilterFields(scope, baseFields)
  }, [activeProjectSummaryDefinitions, activeProjectType, availableColumns, scope])
  const filterFieldByKey = useMemo(
    () => new Map(filterFieldDefinitions.map(field => [field.key, field] as const)),
    [filterFieldDefinitions],
  )
  const normalizedFilters = useMemo(
    () => normalizeProjectFilterConditions(
      filters,
      milestoneDateRange,
      filterFieldDefinitions,
    ),
    [filterFieldDefinitions, filters, milestoneDateRange],
  )
  const activeMilestoneDateRange = useMemo(() => getMilestoneDateRangeFromFilters(normalizedFilters), [normalizedFilters])
  const standardFilters = useMemo(() => getStandardFilterConditions(normalizedFilters), [normalizedFilters])
  const filteredRows = useMemo(
    () => applyFilterConditions(scopedRows, standardFilters, filterFieldDefinitions),
    [filterFieldDefinitions, scopedRows, standardFilters],
  )
  const dateFilteredRows = useMemo(
    () => applyMilestoneDateRange(
      filteredRows,
      activeMilestoneDateRange,
      projectSummaryDefinitionsByScope,
    ),
    [activeMilestoneDateRange, filteredRows, projectSummaryDefinitionsByScope],
  )
  const statusRows = useMemo(() => (
    sharedRowsOverride || applyStatusFilter(dateFilteredRows, statusFilter)
  ), [dateFilteredRows, statusFilter, sharedRowsOverride])
  const rows = useMemo(() => applyCollapsedGroups(statusRows, collapsedCategories, collapsedSeries), [statusRows, collapsedCategories, collapsedSeries])
  const categorySeriesCounts = useMemo(() => countSeriesByCategory(statusRows), [statusRows])
  const seriesProjectCounts = useMemo(() => countProjectsBySeriesGroup(statusRows), [statusRows])
  const columnDefinitions = useMemo(() => getScopedColumnDefinitions(
    availableColumns,
    scope === 'overall'
      ? ['productCategory', 'productSeries', 'projectName']
      : ['productSeries', 'projectName'],
  ), [availableColumns, scope])
  const defaultColumnSettings = useMemo(
    () => getDefaultColumnSettings(columnDefinitions),
    [columnDefinitions],
  )
  const visibleColumns = columnSettings.visible
  const hasActiveFilters = normalizedFilters.some(isFilterConditionActive)
  const filterFieldOptions = useMemo(() => (
    filterFieldDefinitions.map(field => ({
      value: field.key,
      label: field.label,
    }))
  ), [filterFieldDefinitions])
  const statusStats = useMemo(() => {
    const stats = SUMMARY_VISIBLE_STATUSES.reduce((acc, status) => {
      acc[status] = 0
      return acc
    }, {} as Record<SummaryStatus, number>)
    const sourceRows = sharedRowsOverride || dateFilteredRows
    sourceRows.forEach(row => {
      stats[row.status] += 1
    })
    return stats
  }, [dateFilteredRows, sharedRowsOverride])
  const categorySpans = useMemo(() => computeRowSpans(rows, 'productCategory'), [rows])
  const seriesSpans = useMemo(() => computeRowSpans(rows, 'productSeries', ['productCategory']), [rows])
  const rowsSignature = useMemo(() => (
    rows.map(row => `${row.key}:${row.isCollapsedPreview ? 'closed' : 'open'}:${row.hiddenProjectCount || 0}`).join('|')
  ), [rows])

  const getSummaryDefinitionsForScope = (nextScope: SummaryScope) => (
    nextScope === 'machine'
      ? projectSummaryDefinitionsByScope.machine
      : nextScope === 'tosVersion'
        ? projectSummaryDefinitionsByScope.tosVersion
        : []
  )

  const getDefinitionsForScope = (nextScope: SummaryScope) => getScopedColumnDefinitions(
    getAvailableColumnsForScope(nextScope, getSummaryDefinitionsForScope(nextScope)),
    nextScope === 'overall'
      ? ['productCategory', 'productSeries', 'projectName']
      : ['productSeries', 'projectName'],
  )

  const getFilterDefinitionsForScope = (nextScope: SummaryScope) => {
    const projectType = nextScope === 'machine'
      ? PROJECT_CATEGORY_MACHINE
      : nextScope === 'tosVersion'
        ? PROJECT_TYPE_TOS_VERSION
        : null
    const summaryDefinitions = getSummaryDefinitionsForScope(nextScope)
    const fields = projectType
      ? getProjectSummaryBoardFilterFields(projectType, summaryDefinitions)
      : getAvailableColumnsForScope(nextScope, summaryDefinitions).map(column => ({
          key: column.key,
          label: column.title,
          kind: 'text' as const,
        }))
    return getProjectSummaryScopeFilterFields(nextScope, fields)
  }

  const normalizeScope = (value: string | undefined): SummaryScope => {
    if (value === 'software') return 'tosVersion'
    return SUMMARY_SCOPES.some(item => item.key === value) ? value as SummaryScope : 'overall'
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
    columnOrder: columnSettings.order,
    filters: normalizedFilters,
    collapsedKeys: [...Array.from(collapsedCategories), ...Array.from(collapsedSeries)],
    viewMode,
    milestoneDateRange: activeMilestoneDateRange,
    ...(includeSharedRows ? { sharedRows: cloneRowsForShare(statusRows) } : {}),
  })

  const applyProjectViewState = (state: ProjectViewState) => {
    const nextScope = normalizeScope(state.scope)
    const nextDefinitions = getDefinitionsForScope(nextScope)

    setScope(nextScope)
    setStatusFilter(normalizeStatusFilter(state.statusFilter))
    const nextDateRange = normalizeDateRange(state.milestoneDateRange)
    const nextFilters = normalizeProjectFilterConditions(
      (state.filters || []) as FilterCondition[],
      nextDateRange,
      getFilterDefinitionsForScope(nextScope),
    )
    const collapsedKeys = Array.isArray(state.collapsedKeys) ? state.collapsedKeys.map(String) : []
    setFilters(nextFilters)
    setTempFilters([])
    setCollapsedCategories(new Set(collapsedKeys.filter(key => !key.startsWith('series::')).map(key => key.replace(/^category::/, ''))))
    setCollapsedSeries(new Set(collapsedKeys.filter(key => key.startsWith('series::'))))
    setColumnSettings(getProjectViewColumnSettings(nextDefinitions, state))
    setViewMode(normalizeViewMode(state.viewMode))
    const appliedDateRange = getMilestoneDateRangeFromFilters(nextFilters)
    setMilestoneDateRange(appliedDateRange)
    if (appliedDateRange) setCalendarMonth(dayjs(appliedDateRange[0]).startOf('month'))
    const sharedRows = Array.isArray(state.sharedRows) ? state.sharedRows : null
    const migratedSharedRows = sharedRows && (nextScope === 'machine' || nextScope === 'tosVersion')
      ? migrateLegacySummaryRows(sharedRows, getSummaryDefinitionsForScope(nextScope))
      : sharedRows
    setSharedRowsOverride(migratedSharedRows as SummaryRow[] | null)
  }

  const refreshSavedProjectViews = () => {
    setSavedProjectViews(loadProjectViews(SUMMARY_VIEW_KIND))
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
    setColumnSettings(current => normalizeColumnSettings(columnDefinitions, current))
  }, [columnDefinitions])

  useEffect(() => {
    refreshSavedProjectViews()
    const sharedView = parseProjectViewShare(SUMMARY_VIEW_KIND)
    if (sharedView) {
      applyProjectViewState(sharedView.state)
      setActiveSavedViewId(null)
      if (sharedView.name) setProjectViewName(sharedView.name)
      message.success('已应用分享视图')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScopeChange = (key: string) => {
    const nextScope = key as SummaryScope
    setScope(nextScope)
    setStatusFilter('all')
    setFilters([])
    setTempFilters([])
    setMilestoneDateRange(null)
    setCollapsedCategories(new Set())
    setCollapsedSeries(new Set())
    setColumnSettings(getDefaultColumnSettings(getDefinitionsForScope(nextScope)))
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
  }

  const toggleCategory = (category: string) => {
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }
  const toggleSeries = (category: string, series: string) => {
    const seriesKey = getSeriesGroupKey(category, series)
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
    setCollapsedSeries(prev => {
      const next = new Set(prev)
      if (next.has(seriesKey)) next.delete(seriesKey)
      else next.add(seriesKey)
      return next
    })
  }
  const expandAllCategories = () => {
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
    setCollapsedCategories(new Set())
    setCollapsedSeries(new Set())
  }
  const collapseAllCategories = () => {
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
    setCollapsedCategories(new Set(Object.keys(categorySeriesCounts).filter(category => categorySeriesCounts[category] > 1)))
    setCollapsedSeries(new Set(Object.keys(seriesProjectCounts).filter(key => seriesProjectCounts[key] > 1)))
  }

  const buildExportColumns = () => (
    orderVisibleDefinitions(columnDefinitions, columnSettings)
      .map<ExportColumn>(definition => ({
        key: scope === 'tech' && definition.key === 'milestones'
          ? 'milestonesText'
          : definition.key,
        title: String(definition.title),
      }))
  )

  const handleExport = (exportScope: 'current' | 'all') => {
    const sourceRows = exportScope === 'current' ? statusRows : scopedRows
    const filename = `项目计划汇总看板_${SUMMARY_SCOPES.find(item => item.key === scope)?.label || '整体'}_${exportTimestamp()}.xlsx`
    exportSheet(sourceRows, buildExportColumns(), filename, '项目计划汇总')
  }

  const handleSavedProjectViewChange = (value: string) => {
    if (value === 'default') {
      applyProjectViewState({
        scope: 'overall',
        statusFilter: 'all',
        visibleColumns: getDefaultVisibleColumnsForScope('overall', []),
        columnOrder: getDefinitionsForScope('overall').map(definition => definition.key),
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
      id: `summary-${Date.now()}`,
      kind: SUMMARY_VIEW_KIND,
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
    const url = createProjectViewShareUrl(SUMMARY_VIEW_KIND, buildCurrentProjectViewState(true), activeView?.name || projectViewName || '项目计划汇总看板视图')
    setProjectViewShareUrl(url)
    setShowProjectViewShareModal(true)
    void copyProjectViewShareUrl(url)
  }

  const getFilterDrawerInitialConditions = () => (
    normalizedFilters.length ? normalizedFilters.map(item => ({ ...item })) : [createFilterCondition()]
  )

  const commitSummaryFilters = (next: FilterCondition[]) => {
    const nextFilters = normalizeProjectFilterConditions(
      next,
      undefined,
      filterFieldDefinitions,
    )
    const nextDateRange = getMilestoneDateRangeFromFilters(nextFilters)
    setTempFilters(next)
    setFilters(nextFilters)
    setMilestoneDateRange(nextDateRange)
    if (nextDateRange) setCalendarMonth(dayjs(nextDateRange[0]).startOf('month'))
    setActiveSavedViewId(null)
    setSharedRowsOverride(null)
  }

  const updateTempFilter = (conditionId: string, patch: Partial<FilterCondition>) => {
    commitSummaryFilters(tempFilters.map(item => item.id === conditionId ? { ...item, ...patch } : item))
  }

  const handleTempFilterFieldChange = (condition: FilterCondition, field: string) => {
    const definition = filterFieldByKey.get(field)
    const operator = field === MILESTONE_FILTER_FIELD
      || field === TECH_MILESTONE_FILTER_FIELD
      ? 'contains'
      : getFilterOperatorsForKind(definition?.kind ?? 'text')[0]?.value ?? 'equals'
    updateTempFilter(condition.id, {
      field,
      operator,
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
            选择后，仅保留范围内存在计划节点的项目。
          </div>
        </div>
      )
    }

    if (isValuelessFilterOperator(condition.operator)) return null

    const definition = filterFieldByKey.get(condition.field)
    if (definition?.kind === 'enum' && definition.options?.length) {
      return (
        <Select
          style={{ width: '100%' }}
          showSearch
          allowClear
          placeholder="请选择筛选值"
          options={definition.options}
          value={condition.value || undefined}
          onChange={value => updateTempFilter(condition.id, { value: value ?? '' })}
        />
      )
    }
    if (definition?.kind === 'date') {
      return (
        <DatePicker
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
          value={condition.value && dayjs(condition.value).isValid()
            ? dayjs(condition.value)
            : null}
          onChange={date => updateTempFilter(condition.id, {
            value: date ? date.format('YYYY-MM-DD') : '',
          })}
        />
      )
    }

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

  const columns = useMemo<ColumnsType<SummaryRow>>(() => {
    const isVisible = (key: string) => {
      const column = availableColumns.find(item => item.key === key)
      return Boolean(column?.locked || visibleColumns.includes(key))
    }
    const cols: ColumnsType<SummaryRow> = []

    if (activeProjectType) {
      activeProjectSummaryDefinitions.forEach(definition => {
        if (!isVisible(definition.key)) return
        cols.push({
          title: definition.title,
          dataIndex: definition.key,
          key: definition.key,
          width: definition.width,
          fixed: definition.key === 'projectName' ? 'left' as const : undefined,
          className: definition.key === 'projectName' ? 'pms-summary-project-cell' : undefined,
          render: (value: unknown, row) => {
            if (definition.key === 'projectName') {
              return (
                <div className="pms-summary-project-content">
                  <Tooltip title={row.projectType}>
                    <span className="pms-summary-project-name">{String(value || '-')}</span>
                  </Tooltip>
                </div>
              )
            }
            if (definition.key === 'status') {
              return (
                <Tag color={STATUS_COLORS[String(value)] || 'processing'} style={{ margin: 0 }}>
                  {String(value || '-')}
                </Tag>
              )
            }
            return renderInfoCell(definition.key, value)
          },
        })
      })
    }

    if (!activeProjectType && scope === 'overall' && isVisible('productCategory')) {
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
        render: (value: string) => {
          const theme = getCategoryTheme(value)
          const canCollapse = (categorySeriesCounts[value] || 0) > 1
          return (
            <div className="pms-summary-category-content">
              {canCollapse ? (
                <Button
                  type="text"
                  size="small"
                  className="pms-summary-collapse-button"
                  icon={collapsedCategories.has(value) ? <CaretRightOutlined /> : <CaretDownOutlined />}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleCategory(value)
                  }}
                />
              ) : <span className="pms-summary-collapse-placeholder" />}
              <div>
                <div className="pms-summary-category-name" style={{ color: theme.color }}>{theme.label || value}</div>
              </div>
            </div>
          )
        },
      })
    }

	    if (!activeProjectType && isVisible('productSeries')) {
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
          const seriesKey = getSeriesGroupKey(row.productCategory, value)
          const projectCount = seriesProjectCounts[seriesKey] || 0
          const isCategoryCollapsedPreview = row.collapsePreviewType === 'category'
          const canCollapse = row.collapsePreviewType !== 'category' && projectCount > 1
          return (
            <div className="pms-summary-series-content">
              {canCollapse ? (
                <Button
                  type="text"
                  size="small"
                  className="pms-summary-collapse-button"
                  icon={collapsedSeries.has(seriesKey) ? <CaretRightOutlined /> : <CaretDownOutlined />}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleSeries(row.productCategory, value)
                  }}
                />
              ) : (
                <span className="pms-summary-series-dot" style={{ background: theme.accent }} />
              )}
              <div>
                <div className="pms-summary-series-name">{value}</div>
                <div className="pms-summary-series-meta">{projectCount}个项目</div>
                {isCategoryCollapsedPreview && !!row.hiddenSeriesCount && (
                  <div className="pms-summary-series-hidden">另收起 {row.hiddenSeriesCount} 个系列</div>
                )}
              </div>
            </div>
          )
        },
      })
    }

    if (!activeProjectType && isVisible('projectName')) {
      cols.push({
        title: '项目名',
        dataIndex: 'projectName',
	        key: 'projectName',
	        width: 176,
	        fixed: 'left' as const,
	        className: 'pms-summary-project-cell',
	        render: (value: string, row) => (
	          <div className="pms-summary-project-content">
            <div>
              <Tooltip title={row.projectType}>
                <span className="pms-summary-project-name">{value}</span>
              </Tooltip>
              {row.isCollapsedPreview && !!row.hiddenProjectCount && (
                <div className="pms-summary-project-hidden">另收起 {row.hiddenProjectCount} 个项目</div>
              )}
            </div>
          </div>
        ),
      })
    }

    if (!activeProjectType && isVisible('tosVersion')) {
      cols.push({
        title: 'tOS版本',
        dataIndex: 'tosVersion',
        key: 'tosVersion',
        width: 110,
        align: 'center',
        render: (value: any) => <span className="pms-summary-text-cell">{value || '-'}</span>,
      })
    }

    if (!activeProjectType && isVisible('status')) {
      cols.push({
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 104,
        align: 'center',
        render: (value: string) => <Tag color={STATUS_COLORS[value] || 'processing'} style={{ margin: 0 }}>{value}</Tag>,
      })
    }

    if (!activeProjectType && isVisible('spm')) {
      cols.push({ title: 'SPM', dataIndex: 'spm', key: 'spm', width: 90, align: 'center' })
    }

    if (!activeProjectType && isVisible('department')) {
      cols.push({ title: '部门', dataIndex: 'department', key: 'department', width: 128, align: 'center' })
    }

    if (scope === 'tech' && isVisible('milestones')) {
      cols.push({
        title: TECHNICAL_MILESTONE_COLUMN.title,
        dataIndex: 'milestones',
        key: 'milestones',
        width: TECHNICAL_MILESTONE_COLUMN.width,
        className: 'pms-summary-milestones-cell',
        onHeaderCell: () => ({ className: 'pms-summary-milestones-header' }),
        render: (milestones: SummaryMilestone[] = []) => (
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

    const columnByKey = new Map(cols.map(column => [String(column.key), column]))
    const actionColumn = columnByKey.get('action')
    const orderedColumns = orderVisibleDefinitions(columnDefinitions, columnSettings)
      .map(definition => columnByKey.get(definition.key))
      .filter((column): column is NonNullable<typeof column> => Boolean(column))
    return actionColumn ? [...orderedColumns, actionColumn] : orderedColumns
  }, [activeProjectSummaryDefinitions, activeProjectType, availableColumns, columnDefinitions, columnSettings, visibleColumns, scope, categorySeriesCounts, categorySpans, collapsedCategories, collapsedSeries, onViewProject, seriesProjectCounts, seriesSpans])

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth])
  const calendarEvents = useMemo(() => {
    const eventMap = new Map<string, { row: SummaryRow; milestone: SummaryMilestone }[]>()
    statusRows.forEach(row => {
      const nodeDefinitions = getNodeDefinitionsForRow(
        row,
        projectSummaryDefinitionsByScope,
      )
      getRowNodeMilestones(row, nodeDefinitions).forEach(milestone => {
        const date = parseMilestoneDate(milestone.date)
        if (!date.isValid()) return
        if (activeMilestoneDateRange) {
          const [start, end] = activeMilestoneDateRange
          if (
            date.isBefore(dayjs(start).startOf('day'))
            || date.isAfter(dayjs(end).endOf('day'))
          ) return
        }
        const key = date.format('YYYY-MM-DD')
        eventMap.set(key, [...(eventMap.get(key) || []), { row, milestone }])
      })
    })
    return eventMap
  }, [activeMilestoneDateRange, projectSummaryDefinitionsByScope, statusRows])

  const renderCalendarView = () => (
    <div className="pms-project-calendar pms-solid-surface">
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
    viewMode === 'calendar' ? renderCalendarView() : renderSummaryTable()
  )

  const renderSummaryTable = () => (
    <Table
      className="pms-table pms-summary-board pms-solid-surface"
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
      scroll={{ x: 'max-content', y: TABLE_BODY_SCROLL_Y }}
      pagination={false}
      locale={{ emptyText: <Empty description="暂无项目计划汇总数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
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
          background: var(--pms-brand-surface);
          color: var(--pms-brand-strong);
        }
        .pms-summary-status-pill-active {
          background: var(--pms-brand);
          color: #fff;
          box-shadow: 0 4px 10px color-mix(in srgb, var(--pms-brand) 22%, transparent);
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
          background: var(--pms-brand-surface) !important;
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
        .pms-summary-collapse-placeholder {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
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
        .pms-summary-series-hidden {
          color: #2563eb;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          margin-top: 4px;
          white-space: nowrap;
        }
        .pms-summary-project-hidden {
          color: #2563eb;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          margin-top: 4px;
          white-space: nowrap;
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

      <div className="pms-summary-control-shell pms-summary-control-shell-static pms-glass-surface">
        <Tabs
          className="pms-summary-scope-tabs"
          activeKey={scope}
          onChange={handleScopeChange}
          items={SUMMARY_SCOPES.map(item => ({ key: item.key, label: item.label }))}
	        />

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

      {(() => {
        const renderToolbar = () => (
          <div className="pms-summary-sticky-region pms-summary-sticky-offset" style={stickyRegionStyle}>
        <div className="pms-summary-toolbar-shell">
	        <div className="pms-summary-toolbar pms-toolbar">
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
                      onClick={expandAllCategories}
                    />
                  </Tooltip>
                  <Tooltip title="折叠全部">
                    <Button
                      aria-label="折叠全部"
                      className="pms-summary-icon-button"
                      size="small"
                      icon={<CaretRightOutlined />}
                      onClick={collapseAllCategories}
                    />
                  </Tooltip>
	              </>
            )}
            <FloatingFilterPanel
              open={showFilterDrawer}
              title="项目筛选"
              trigger={(
                <Tooltip title={hasActiveFilters ? '筛选（已启用）' : '筛选'}>
                  <Button
                    aria-label="筛选"
                    className="pms-summary-icon-button"
                    size="small"
                    icon={<FilterOutlined />}
                    type={hasActiveFilters ? 'primary' : 'default'}
                    onClick={() => {
                      setShowColumnDrawer(false)
                      setTempFilters(getFilterDrawerInitialConditions())
                      setShowFilterDrawer(true)
                    }}
                  />
                </Tooltip>
              )}
              onReset={() => commitSummaryFilters([createFilterCondition()])}
              onAdd={() => commitSummaryFilters([...tempFilters, createFilterCondition()])}
              addDisabled={tempFilters.length >= filterFieldOptions.length}
              onClose={() => setShowFilterDrawer(false)}
            >
              <div className="pms-filter-condition-list">
                {tempFilters.map((condition) => (
                  <div key={condition.id} className="pms-filter-condition-row">
                      <Select
                        aria-label="筛选字段"
                        placeholder="筛选字段"
                        value={condition.field || undefined}
                        options={getFieldOptionsWithDuplicateDisabled(filterFieldOptions, tempFilters, condition.id)}
                        onChange={(value) => handleTempFilterFieldChange(condition, value)}
                      />
                      <Select
                          aria-label="筛选条件"
                          value={condition.operator}
                          options={(isMilestoneDateFilter(condition)
                            ? [{ label: '范围内', value: 'contains' }]
                            : getFilterOperatorsForKind(
                              filterFieldByKey.get(condition.field)?.kind ?? 'text',
                            )) as any}
                          disabled={isMilestoneDateFilter(condition)}
                          onChange={(value) => {
                            const operator = value as FilterCondition['operator']
                            updateTempFilter(condition.id, {
                              operator,
                              value: isValuelessFilterOperator(operator) ? '' : condition.value,
                            })
                          }}
                      />
                      {isValuelessFilterOperator(condition.operator) && !isMilestoneDateFilter(condition)
                        ? <span className="pms-filter-value-placeholder" aria-hidden />
                        : renderFilterValueControl(condition)}
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        aria-label="删除筛选条件"
                        onClick={() => {
                          const remaining = tempFilters.filter(item => item.id !== condition.id)
                          commitSummaryFilters(remaining.length ? remaining : [createFilterCondition()])
                        }}
                      />
                  </div>
                ))}
              </div>
            </FloatingFilterPanel>
            <SortableColumnSettings
              open={showColumnDrawer}
              trigger={(
                <Tooltip title={scope === 'overall' ? '整体视图保留产品分类维度；其它视图不显示产品分类。' : '当前视图不显示产品分类。'}>
                  <Button
                    aria-label="列设置"
                    className="pms-summary-icon-button"
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => {
                      setShowFilterDrawer(false)
                      setShowColumnDrawer(true)
                    }}
                  />
                </Tooltip>
              )}
              definitions={columnDefinitions}
              value={columnSettings}
              defaultValue={defaultColumnSettings}
              onCancel={() => setShowColumnDrawer(false)}
              onApply={(nextSettings) => {
                setColumnSettings(nextSettings)
                setActiveSavedViewId(null)
                setSharedRowsOverride(null)
                setShowColumnDrawer(false)
              }}
            />
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
                onClick={() => {
                  setShowFilterDrawer(false)
                  setShowColumnDrawer(false)
                  setIsFullscreen(current => !current)
                }}
              />
            </Tooltip>
          </Space>
        </div>
      </div>
      </div>

        )

        return (
          <>
      {!isFullscreen && renderToolbar()}

      {!isFullscreen && renderCurrentView()}

      <Modal
        className="pms-modal"
        classNames={{ header: 'pms-glass-surface', body: 'pms-solid-surface', footer: 'pms-glass-surface' }}
        title={(
          <Space>
            <span>项目计划汇总看板</span>
            <Tag>{SUMMARY_SCOPES.find(item => item.key === scope)?.label || '整体'}</Tag>
          </Space>
        )}
        open={isFullscreen}
        onCancel={() => {
          setShowFilterDrawer(false)
          setShowColumnDrawer(false)
          setIsFullscreen(false)
        }}
        footer={null}
        width="100vw"
        style={{ top: 0, maxWidth: '100vw', paddingBottom: 0 }}
        styles={{ body: { height: 'calc(100vh - 110px)', overflow: 'auto' } }}
	      >
          {isFullscreen && renderToolbar()}
	        {renderCurrentView()}
	      </Modal>
          </>
        )
      })()}

	      <Modal
	        className="pms-modal"
	        classNames={{ header: 'pms-glass-surface', body: 'pms-solid-surface', footer: 'pms-glass-surface' }}
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
	            将以当前分类、视图模式、状态筛选、字段筛选条件、列设置和折叠状态创建视图，名称不可重复。
	          </div>
	        </Space>
	      </Modal>

	      <Modal
	        className="pms-modal"
	        classNames={{ header: 'pms-glass-surface', body: 'pms-solid-surface', footer: 'pms-glass-surface' }}
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
	            分享链接会携带当前筛选条件和筛选后的数据快照，打开后自动应用到项目计划汇总看板。
	          </div>
	        </Space>
	      </Modal>

    </div>
  )
}
