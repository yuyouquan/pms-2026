'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Button,
  Empty,
  Input,
  Pagination,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  DownOutlined,
  FilterOutlined,
  RightOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { ColumnType, ColumnsType } from 'antd/es/table'
import type { DragEndEvent } from '@dnd-kit/core'
import { FloatingFilterPanel } from '@/components/shared/FloatingFilterPanel'
import { FilterConditionValue } from '@/components/shared/FilterConditionValue'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  SortableProjectListHeader,
  SortableProjectListHeaderContext,
  type ProjectListColumnDragState,
  type ProjectListColumnResizeEvent,
} from '@/components/project-summary/SortableProjectListHeader'
import ActiveFilterConditions from '@/components/project-list/ActiveFilterConditions'
import {
  getDefaultColumnSettings,
  moveColumnSetting,
  type SortableColumnSettingsValue,
} from '@/lib/columnSettings'
import {
  buildProjectListColumnUnits,
  canDropProjectListUnit,
  expandProjectListUnitSettings,
  normalizeProjectListUnitSettings,
  type ProjectListLeafColumnDefinition,
} from '@/lib/projectListColumnOrder'
import {
  clampProjectListColumnWidth,
  getProjectListColumnWidth,
  normalizeProjectListColumnWidths,
} from '@/lib/projectListColumnWidth'
import {
  applyFilterConditions,
  createFilterCondition,
  getDefaultFilterOperator,
  getFieldOptionsWithDuplicateDisabled,
  getFilterOperatorsForKind,
  isValuelessFilterOperator,
  normalizeFilterValueForOperator,
  normalizeFilterConditions,
  type AnyFilterCondition,
  type FilterFieldDefinition,
  type FilterFieldKind,
} from '@/lib/filterConditions'
import type { ProjectInfoProject } from '@/lib/projectInfoValues'
import {
  buildProjectSummaryColumns,
  buildProjectSummaryRow,
  getLatestPublishedTemplateTasks,
  getLinkedQuickFilterValues,
  getProjectListFieldDefinitions,
  getProjectSummaryFieldDefinitions,
  getProjectSummaryQuickFilterDefinitions,
  getTemplateTaskFieldDefinitions,
  normalizeStoredProjectSummaryFilters,
  updateLinkedQuickFilterCondition,
  type ProjectSummaryFieldDefinition,
  type ProjectSummaryRow,
  type ProjectSummaryTemplateTask,
} from '@/lib/projectSummary'
import {
  buildMachineProjectHierarchyPage,
  buildStableGroupSegments,
  getProjectListFixedColumnKeys,
  groupProjectListRows,
  type ProjectListVariant,
} from '@/lib/projectListMatrix'

interface ProjectSummaryVersion {
  id: string
  versionNo: string
  status: string
}

export interface ProjectSummaryTableProps {
  projects: ProjectInfoProject[]
  optionProjects: ProjectInfoProject[]
  planTasksByProjectId: Record<string, ProjectSummaryTemplateTask[]>
  projectType: string
  versions: ProjectSummaryVersion[]
  currentVersion: string
  publishedSnapshots: Record<string, ProjectSummaryTemplateTask[]>
  currentTemplateTasks: ProjectSummaryTemplateTask[]
  storageNamespace: string
  onViewProject: (projectId: string) => void
  matrixVariant?: ProjectListVariant
  matrixTemplateTasks?: ProjectSummaryTemplateTask[]
  providedRows?: ProjectSummaryRow[]
  onViewRow?: (row: ProjectSummaryRow) => void
  controlledFilters?: AnyFilterCondition[]
  onFiltersChange?: (filters: AnyFilterCondition[]) => void
  showQuickFilters?: boolean
  groupBy?: { key: string; fallbackLabel: string }
  machineHierarchy?: boolean
  toolbarHost?: HTMLElement | null
  quickFilterHost?: HTMLElement | null
  filterSummaryHost?: HTMLElement | null
  showTable?: boolean
  showColumnSettings?: boolean
  toolbarTrailingAction?: ReactNode
  tablePageSize?: number
}

interface StoredProjectSummaryPreferences {
  filters?: AnyFilterCondition[]
  columns?: Partial<SortableColumnSettingsValue<string>> | string[]
  columnWidths?: Record<string, number>
}

const getPopupContainer = () => document.body

const getStoredColumns = (
  value: unknown,
): Partial<SortableColumnSettingsValue<string>> | string[] | undefined => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  return {
    order: Array.isArray(candidate.order)
      ? candidate.order.filter((item): item is string => typeof item === 'string')
      : undefined,
    visible: Array.isArray(candidate.visible)
      ? candidate.visible.filter((item): item is string => typeof item === 'string')
      : undefined,
  }
}

const getFilterKind = (
  definition: ProjectSummaryFieldDefinition,
): FilterFieldKind => {
  if (definition.inputType === 'date') return 'date'
  if (definition.inputType === 'select' || definition.inputType === 'boolean') return 'enum'
  return 'text'
}

const collectOptions = (
  rows: readonly ProjectSummaryRow[],
  field: string,
) => {
  const values = rows
    .map(row => row[field])
    .filter(value => value !== undefined && value !== null && value !== '' && value !== '-')
    .map(value => String(value))
  return [...new Set(values)]
    .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }))
    .map(value => ({ label: value, value }))
}

const cloneConditions = (conditions: readonly AnyFilterCondition[]) => (
  conditions.map(condition => ({
    ...condition,
    value: Array.isArray(condition.value) ? [...condition.value] : condition.value,
  }))
)

export default function ProjectSummaryTable({
  projects,
  optionProjects,
  planTasksByProjectId,
  projectType,
  versions,
  currentVersion,
  publishedSnapshots,
  currentTemplateTasks,
  storageNamespace,
  onViewProject,
  matrixVariant,
  matrixTemplateTasks,
  providedRows,
  onViewRow,
  controlledFilters,
  onFiltersChange,
  showQuickFilters = true,
  groupBy,
  machineHierarchy = false,
  toolbarHost,
  quickFilterHost,
  filterSummaryHost,
  showTable = true,
  showColumnSettings = true,
  toolbarTrailingAction,
  tablePageSize,
}: ProjectSummaryTableProps) {
  const [uncontrolledFilters, setUncontrolledFilters] = useState<AnyFilterCondition[]>([])
  const isFilterControlled = controlledFilters !== undefined
  const filters = controlledFilters ?? uncontrolledFilters
  const setFilters = (next: AnyFilterCondition[] | ((current: AnyFilterCondition[]) => AnyFilterCondition[])) => {
    const resolved = typeof next === 'function' ? next(filters) : next
    if (controlledFilters !== undefined) onFiltersChange?.(resolved)
    else setUncontrolledFilters(resolved)
  }
  const [tempFilters, setTempFilters] = useState<AnyFilterCondition[]>([
    createFilterCondition(),
  ])
  const [filterOpen, setFilterOpen] = useState(false)
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null)
  const [columnOpen, setColumnOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  const [collapsedMachineSeries, setCollapsedMachineSeries] = useState<Set<string>>(() => new Set())
  const [selectedRowKey, setSelectedRowKey] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const compactControlSize = matrixVariant ? 'small' : 'middle'

  useEffect(() => {
    if (!filterOpen || !editingConditionId) return
    const timeout = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-filter-condition-id="${editingConditionId}"]`)
      row?.scrollIntoView({ block: 'nearest' })
      row?.querySelector<HTMLElement>('.ant-select-selector, input, button')?.focus()
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [editingConditionId, filterOpen])

  const templateTasks = useMemo(() => getLatestPublishedTemplateTasks(
    projectType,
    versions,
    publishedSnapshots,
    currentVersion,
    currentTemplateTasks,
    { namespacedOnly: true },
  ), [
    currentTemplateTasks,
    currentVersion,
    projectType,
    publishedSnapshots,
    versions,
  ])

  const effectiveTemplateTasks = matrixTemplateTasks ?? templateTasks
  const fieldDefinitions = useMemo(() => matrixVariant
    ? getProjectListFieldDefinitions(matrixVariant, effectiveTemplateTasks, projectType)
    : [
        ...getProjectSummaryFieldDefinitions(projectType),
        ...getTemplateTaskFieldDefinitions(projectType, templateTasks),
      ], [effectiveTemplateTasks, matrixVariant, projectType, templateTasks])

  const fixedColumnOrder = useMemo(
    () => matrixVariant ? getProjectListFixedColumnKeys(matrixVariant) : ['projectName'],
    [matrixVariant],
  )
  const fixedColumnKeys = useMemo(() => new Set(fixedColumnOrder), [fixedColumnOrder])

  const leafColumnDefinitions = useMemo<ProjectListLeafColumnDefinition[]>(() => (
    fieldDefinitions.map(definition => ({
      key: definition.key,
      title: definition.title,
      source: definition.source,
      defaultVisible: definition.defaultVisible,
      hideable: definition.hideable,
      fixed: fixedColumnKeys.has(definition.key) ? 'left' : undefined,
      disabledReason: definition.hideable === false ? '项目汇总必显字段' : undefined,
    }))
  ), [fieldDefinitions, fixedColumnKeys])

  const columnUnitDefinitions = useMemo(
    () => buildProjectListColumnUnits(leafColumnDefinitions),
    [leafColumnDefinitions],
  )

  const defaultColumnSettings = useMemo(
    () => getDefaultColumnSettings(columnUnitDefinitions),
    [columnUnitDefinitions],
  )
  const [columnSettings, setColumnSettings] = useState<SortableColumnSettingsValue<string>>(
    defaultColumnSettings,
  )
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [headerDragState, setHeaderDragState] = useState<ProjectListColumnDragState | null>(null)
  const tableShellRef = useRef<HTMLDivElement>(null)
  const applyColumnSettings = useCallback((nextSettings: SortableColumnSettingsValue<string>) => {
    setColumnSettings(normalizeProjectListUnitSettings(columnUnitDefinitions, nextSettings))
  }, [columnUnitDefinitions])

  const baseRows = useMemo(
    () => providedRows?.map(row => Object.fromEntries([
      ...fieldDefinitions.map(definition => [definition.key, row[definition.key] ?? '-']),
      ...Object.entries(row),
    ]) as ProjectSummaryRow) ?? projects.map(project => buildProjectSummaryRow(
      project,
      fieldDefinitions,
      planTasksByProjectId[project.id],
    )),
    [fieldDefinitions, planTasksByProjectId, projects, providedRows],
  )
  const quickFilterDefinitions = useMemo(() => {
    if (matrixVariant === 'machine') {
      return getProjectSummaryQuickFilterDefinitions(projectType, optionProjects)
    }
    if (!matrixVariant?.startsWith('technical')) {
      return getProjectSummaryQuickFilterDefinitions(projectType, optionProjects)
    }
    const optionsFor = (key: string) => collectOptions(baseRows, key)
    return matrixVariant === 'technical-subproject'
      ? [{ key: 'parentProjectName', label: '所属TDT项目名称', options: optionsFor('parentProjectName') }]
      : [
          { key: 'technicalTrack', label: '技术赛道', options: optionsFor('technicalTrack') },
          { key: 'tmg', label: 'TMG及技术领域', options: optionsFor('tmg') },
        ]
  }, [baseRows, matrixVariant, optionProjects, projectType])
  const quickFilterByKey = useMemo(
    () => new Map(quickFilterDefinitions.map(definition => [definition.key, definition])),
    [quickFilterDefinitions],
  )

  const filterFieldDefinitions = useMemo<FilterFieldDefinition[]>(() => {
    const definitions = fieldDefinitions.map(definition => {
      const quickDefinition = quickFilterByKey.get(definition.key)
      const kind = quickDefinition ? 'enum' as const : getFilterKind(definition)
      return {
        key: definition.key,
        label: definition.title,
        kind,
        multiple: Boolean(quickDefinition),
        options: quickDefinition?.options
          ?? (kind === 'enum' ? collectOptions(baseRows, definition.key) : undefined),
      }
    })
    const existingKeys = new Set(definitions.map(definition => definition.key))
    quickFilterDefinitions.forEach(definition => {
      if (existingKeys.has(definition.key)) return
      definitions.push({
        key: definition.key,
        label: definition.label,
        kind: 'enum',
        multiple: true,
        options: definition.options,
      })
    })
    return definitions
  }, [baseRows, fieldDefinitions, quickFilterByKey, quickFilterDefinitions])

  const filterDefinitionByKey = useMemo(
    () => new Map(filterFieldDefinitions.map(definition => [definition.key, definition])),
    [filterFieldDefinitions],
  )
  const filterFieldDefinitionsRef = useRef(filterFieldDefinitions)
  filterFieldDefinitionsRef.current = filterFieldDefinitions
  const storageKey = `pms:project-summary:v2:${storageNamespace}:${projectType}:${matrixVariant ?? 'summary'}`
  const definitionSignature = useMemo(
    () => JSON.stringify(columnUnitDefinitions.map(definition => [
      definition.key,
      definition.defaultVisible,
      definition.hideable !== false,
      definition.leafKeys,
    ])),
    [columnUnitDefinitions],
  )
  const filterDefinitionSignature = useMemo(
    () => JSON.stringify(filterFieldDefinitions.map(definition => [
      definition.key,
      definition.kind,
      definition.multiple === true,
    ])),
    [filterFieldDefinitions],
  )
  const hydrationKey = `${storageKey}:${definitionSignature}:${filterDefinitionSignature}`
  const [hydratedKey, setHydratedKey] = useState('')

  useEffect(() => {
    let storedFilters: AnyFilterCondition[] = []
    let storedColumns: SortableColumnSettingsValue<string> = defaultColumnSettings
    let storedColumnWidths: Record<string, number> = {}
    try {
      const raw = window.localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) as unknown : {}
      const stored = parsed && typeof parsed === 'object'
        ? parsed as Record<string, unknown>
        : {}
      storedFilters = normalizeStoredProjectSummaryFilters(
        stored.filters,
        filterFieldDefinitionsRef.current,
      )
      storedColumns = normalizeProjectListUnitSettings(
        columnUnitDefinitions,
        getStoredColumns(stored.columns),
      )
      storedColumnWidths = normalizeProjectListColumnWidths(fieldDefinitions, stored.columnWidths)
    } catch {
      storedFilters = []
      storedColumns = defaultColumnSettings
      storedColumnWidths = {}
    }
    if (!isFilterControlled) setUncontrolledFilters(storedFilters)
    setColumnSettings(storedColumns)
    setColumnWidths(storedColumnWidths)
    setHydratedKey(hydrationKey)
  }, [
    columnUnitDefinitions,
    defaultColumnSettings,
    fieldDefinitions,
    filterDefinitionSignature,
    hydrationKey,
    storageKey,
    isFilterControlled,
  ])

  useEffect(() => {
    if (hydratedKey !== hydrationKey) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        filters,
        columns: normalizeProjectListUnitSettings(columnUnitDefinitions, columnSettings),
        columnWidths: normalizeProjectListColumnWidths(fieldDefinitions, columnWidths),
      } satisfies StoredProjectSummaryPreferences))
    } catch {
      // Preference persistence must never block the table.
    }
  }, [
    columnUnitDefinitions,
    columnSettings,
    columnWidths,
    fieldDefinitions,
    filters,
    hydratedKey,
    hydrationKey,
    storageKey,
  ])

  const filteredRows = useMemo(
    () => applyFilterConditions(baseRows, filters, filterFieldDefinitions),
    [baseRows, filterFieldDefinitions, filters],
  )

  const machineOrderedRows = useMemo<ProjectSummaryRow[]>(() => (
    machineHierarchy
      ? buildMachineProjectHierarchyPage(filteredRows, filteredRows, new Set())
      : filteredRows
  ), [filteredRows, machineHierarchy])

  const displayedRows = useMemo<ProjectSummaryRow[]>(() => {
    if (machineHierarchy) {
      const pageRows = tablePageSize
        ? machineOrderedRows.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize)
        : machineOrderedRows
      return buildMachineProjectHierarchyPage(
        filteredRows,
        pageRows,
        collapsedMachineSeries,
      )
    }
    if (!groupBy) return filteredRows
    return groupProjectListRows(filteredRows, groupBy.key, groupBy.fallbackLabel)
      .flatMap(group => {
        const isCollapsed = collapsedGroups.has(group.key)
        if (isCollapsed) {
          const summary = Object.fromEntries(fieldDefinitions.map(definition => [definition.key, '-']))
          return [{
            ...summary,
            key: `group::${group.key}`,
            projectId: `group::${group.key}`,
            projectName: '-',
            [groupBy.key]: group.key,
            __groupKey: group.key,
            __groupSize: group.rows.length,
            __groupIndex: 0,
            __groupSummary: true,
          } as ProjectSummaryRow]
        }
        return group.rows.map((row, index) => ({
          ...row,
          __groupKey: group.key,
          __groupSize: group.rows.length,
          __groupIndex: index,
          __groupSummary: false,
        }))
      })
  }, [
    collapsedGroups,
    collapsedMachineSeries,
    fieldDefinitions,
    filteredRows,
    groupBy,
    machineHierarchy,
    machineOrderedRows,
    tablePage,
    tablePageSize,
  ])

  useEffect(() => {
    setTablePage(1)
  }, [filters, matrixVariant, projectType, tablePageSize])

  useEffect(() => {
    if (!tablePageSize) return
    const totalRows = machineHierarchy ? filteredRows.length : displayedRows.length
    const maxPage = Math.max(1, Math.ceil(totalRows / tablePageSize))
    if (tablePage > maxPage) setTablePage(maxPage)
  }, [displayedRows.length, filteredRows.length, machineHierarchy, tablePage, tablePageSize])

  useEffect(() => {
    if (selectedRowKey && !displayedRows.some(row => row.key === selectedRowKey)) {
      setSelectedRowKey('')
    }
  }, [displayedRows, selectedRowKey])

  const visibleDefinitions = useMemo(() => {
    const leafColumnSettings = expandProjectListUnitSettings(
      columnUnitDefinitions,
      columnSettings,
    )
    const leafByKey = new Map(leafColumnDefinitions.map(definition => [definition.key, definition]))
    const visibleLeafKeys = new Set(leafColumnSettings.visible)
    const ordered = leafColumnSettings.order
      .filter(key => visibleLeafKeys.has(key))
      .map(key => leafByKey.get(key))
      .filter((definition): definition is ProjectListLeafColumnDefinition => Boolean(definition))
    const byKey = new Map(ordered.map(definition => [definition.key, definition]))
    return [
      ...fixedColumnOrder.flatMap(key => byKey.get(key) ? [byKey.get(key)!] : []),
      ...ordered.filter(definition => !fixedColumnKeys.has(definition.key)),
    ]
  }, [columnSettings, columnUnitDefinitions, fixedColumnKeys, fixedColumnOrder, leafColumnDefinitions])
  const getProjectListCellDragClass = useCallback((leafKey: string) => {
    if (!headerDragState) return ''
    const owner = columnUnitDefinitions.find(unit => unit.leafKeys.includes(leafKey))
    const classes: string[] = []
    if (owner?.key === headerDragState.activeUnitKey) {
      classes.push('pms-project-list-column-drag-source')
    }
    if (owner?.key !== headerDragState.overUnitKey || !headerDragState.dropEdge) {
      return classes.join(' ')
    }
    const visibleOwnerLeaves = owner.leafKeys.filter(key => (
      visibleDefinitions.some(definition => definition.key === key)
    ))
    const explicitTargetLeaf = headerDragState.overHeaderId?.startsWith('leaf::')
      ? headerDragState.overHeaderId.slice('leaf::'.length)
      : null
    const targetLeaf = explicitTargetLeaf && visibleOwnerLeaves.includes(explicitTargetLeaf)
      ? explicitTargetLeaf
      : headerDragState.dropEdge === 'before'
        ? visibleOwnerLeaves[0]
        : visibleOwnerLeaves.at(-1)
    if (leafKey === targetLeaf) {
      classes.push(`pms-project-list-column-drop-${headerDragState.dropEdge}`)
    }
    return classes.join(' ')
  }, [columnUnitDefinitions, headerDragState, visibleDefinitions])
  const handleProjectListResize = useCallback((event: ProjectListColumnResizeEvent) => {
    setColumnWidths(current => ({
      ...current,
      [event.leafKey]: clampProjectListColumnWidth(event.width),
    }))
    const shell = tableShellRef.current
    if (!shell) return
    if (event.phase === 'end') {
      shell.removeAttribute('data-column-resize-active')
      shell.style.removeProperty('--pms-project-list-resize-x')
      return
    }
    const shellRect = shell.getBoundingClientRect()
    const guideX = Math.min(shellRect.width, Math.max(0, event.clientX - shellRect.left))
    shell.dataset.columnResizeActive = 'true'
    shell.style.setProperty('--pms-project-list-resize-x', `${Math.round(guideX)}px`)
  }, [])
  const tableColumnByKey = useMemo(
    () => new Map<string, ColumnType<ProjectSummaryRow>>(buildProjectSummaryColumns(fieldDefinitions).map(column => {
      const key = String(column.key)
      const fixed = fixedColumnKeys.has(key) ? 'left' as const : undefined
      const field = fieldDefinitions.find(definition => definition.key === key)
      const fieldWidth = getProjectListColumnWidth(key, field?.width ?? 140, columnWidths)
      const lockedWidth = {
        width: fieldWidth,
        minWidth: fieldWidth,
        maxWidth: fieldWidth,
      }
      const baseHeaderCell = column.onHeaderCell
      const baseCell = column.onCell
      const isProjectName = key === 'projectName'
      const sizedColumn = {
        ...column,
        fixed,
        width: fieldWidth,
        ellipsis: isProjectName ? false : column.ellipsis,
        render: isProjectName
          ? (value: unknown, _record: ProjectSummaryRow, _index: number) => {
              const projectName = String(value ?? '-').trim() || '-'
              return (
                <Tooltip title={projectName} mouseEnterDelay={0.35}>
                  <span className="pms-project-name-text">{projectName}</span>
                </Tooltip>
              )
            }
          : undefined,
        onHeaderCell: () => {
          const headerCell = baseHeaderCell?.() ?? {}
          const unitKey = field?.source === 'templateTask' ? 'milestone' : key
          return {
            ...headerCell,
            className: isProjectName ? 'pms-project-name-cell' : undefined,
            style: { ...headerCell.style, ...lockedWidth },
            projectListColumnUnit: unitKey,
            projectListColumnLabel: unitKey === 'milestone' ? '里程碑' : String(field?.title ?? key),
            projectListHeaderId: `leaf::${key}`,
            projectListColumnLocked: fixedColumnKeys.has(key),
            projectListLeafKey: key,
            projectListResizable: true,
            projectListColumnWidth: fieldWidth,
            onProjectListResize: handleProjectListResize,
          }
        },
        onCell: (record: ProjectSummaryRow) => {
          const cell = baseCell?.(record) ?? {}
          return {
            ...cell,
            className: [
              cell.className,
              isProjectName ? 'pms-project-name-cell' : '',
              getProjectListCellDragClass(key),
            ]
              .filter(Boolean)
              .join(' '),
            'data-project-list-column-unit': field?.source === 'templateTask' ? 'milestone' : key,
            'data-project-list-column-leaf': key,
            style: lockedWidth,
          }
        },
      }
      if (machineHierarchy && ['brand', 'productLine', 'productSeries', 'projectCount'].includes(key)) {
        const spanField = key === 'brand'
          ? '__brandRowSpan'
          : key === 'productLine'
            ? '__productLineRowSpan'
            : '__productSeriesRowSpan'
        const labelField = key === 'brand'
          ? '__brandLabel'
          : key === 'productLine'
            ? '__productLineLabel'
            : '__productSeriesLabel'
        return [key, {
          ...sizedColumn,
          ellipsis: false,
          render: (_value: unknown, record: ProjectSummaryRow) => {
            if (Number(record[spanField]) === 0) return null
            if (key === 'projectCount') return record.__productSeriesProjectCount ?? 0
            const label = String(record[labelField] ?? '-')
            if (key !== 'productSeries') {
              return <Tooltip title={label}><span className="pms-machine-hierarchy-label">{label}</span></Tooltip>
            }
            const seriesKey = String(record.__productSeriesKey ?? label)
            const isCollapsed = Boolean(record.__productSeriesCollapsed)
            return (
              <button
                type="button"
                className={`pms-machine-series-toggle ${isCollapsed ? '' : 'is-expanded'}`.trim()}
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? '展开' : '收起'}产品系列 ${label}`}
                onClick={event => {
                  event.stopPropagation()
                  setCollapsedMachineSeries(current => {
                    const next = new Set(current)
                    if (next.has(seriesKey)) next.delete(seriesKey)
                    else next.add(seriesKey)
                    return next
                  })
                }}
              >
                {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                <Tooltip title={label}><strong>{label}</strong></Tooltip>
              </button>
            )
          },
          onCell: (record: ProjectSummaryRow) => {
            const cell = sizedColumn.onCell(record)
            return {
              ...cell,
              className: [cell.className, 'pms-machine-hierarchy-cell', `is-${key}`]
                .filter(Boolean)
                .join(' '),
              rowSpan: Number(record[spanField]) || 0,
            }
          },
        }] as const
      }
      if (!groupBy || key !== groupBy.key) return [key, sizedColumn] as const
      return [key, {
        ...sizedColumn,
        ellipsis: false,
        render: (_value: unknown, record: ProjectSummaryRow) => {
          if (Number(record.__groupIndex) > 0) return null
          const groupKey = String(record.__groupKey ?? record[groupBy.key] ?? groupBy.fallbackLabel)
          const groupSize = Number(record.__groupSize) || 0
          const isCollapsed = collapsedGroups.has(groupKey)
          return (
            <button
              type="button"
              className={`pms-project-series-toggle ${isCollapsed ? '' : 'is-expanded'}`.trim()}
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? '展开' : '收起'}产品系列 ${groupKey}`}
              onClick={event => {
                event.stopPropagation()
                setCollapsedGroups(current => {
                  const next = new Set(current)
                  if (next.has(groupKey)) next.delete(groupKey)
                  else next.add(groupKey)
                  return next
                })
              }}
            >
              {isCollapsed ? <RightOutlined /> : <DownOutlined />}
              <span className="pms-project-series-copy">
                <Tooltip title={groupKey}>
                  <strong>{groupKey}</strong>
                </Tooltip>
                <small>{groupSize}个项目</small>
              </span>
            </button>
          )
        },
        onCell: (record: ProjectSummaryRow) => {
          const cell = sizedColumn.onCell(record)
          const groupKey = String(record.__groupKey ?? record[groupBy.key] ?? groupBy.fallbackLabel)
          const isCollapsed = collapsedGroups.has(groupKey)
          return {
            ...cell,
            className: [
              cell.className,
              'pms-project-series-cell',
              isCollapsed ? '' : 'is-expanded',
            ].filter(Boolean).join(' '),
            rowSpan: Number(record.__groupIndex) > 0
              ? 0
              : (isCollapsed ? 1 : Number(record.__groupSize) || 1),
          }
        },
      }] as const
    })),
    [collapsedGroups, columnWidths, fieldDefinitions, fixedColumnKeys, getProjectListCellDragClass, groupBy, handleProjectListResize, machineHierarchy],
  )
  const columns = useMemo<ColumnsType<ProjectSummaryRow>>(() => {
    const result: ColumnsType<ProjectSummaryRow> = []
    const entries = visibleDefinitions.flatMap(definition => {
      const column = tableColumnByKey.get(definition.key)
      if (!column) return []
      const field = fieldDefinitions.find(item => item.key === definition.key)
      return [{ key: definition.key, group: field?.group, column }]
    })
    buildStableGroupSegments(entries).forEach(segment => {
      if (!segment.group) {
        result.push(segment.items[0].column)
        return
      }
      result.push({
        key: segment.key,
        title: segment.group.label,
        onHeaderCell: () => ({
          style: { background: segment.group!.color },
          projectListColumnUnit: 'milestone',
          projectListColumnLabel: '里程碑',
          projectListHeaderId: `group::${segment.key}`,
          projectListColumnLocked: false,
        }),
        children: segment.items.map(item => item.column),
      })
    })
    return result
  }, [fieldDefinitions, tableColumnByKey, visibleDefinitions])
  const sortableHeaderIds = useMemo(() => columns.flatMap(column => {
    if ('children' in column && Array.isArray(column.children)) {
      return [
        `group::${String(column.key)}`,
        ...column.children.map(child => `leaf::${String(child.key)}`),
      ]
    }
    return [`leaf::${String(column.key)}`]
  }), [columns])
  const canDropHeaderUnit = useCallback(
    (activeUnitKey: string, overUnitKey: string) => canDropProjectListUnit(
      columnUnitDefinitions,
      activeUnitKey,
      overUnitKey,
    ),
    [columnUnitDefinitions],
  )
  const handleHeaderDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over) return
    const activeUnitKey = String(active.data.current?.unitKey ?? '')
    const overUnitKey = String(over.data.current?.unitKey ?? '')
    if (!canDropHeaderUnit(activeUnitKey, overUnitKey)) return
    applyColumnSettings({
      ...columnSettings,
      order: moveColumnSetting(
        columnUnitDefinitions,
        columnSettings.order,
        activeUnitKey,
        overUnitKey,
      ),
    })
  }, [applyColumnSettings, canDropHeaderUnit, columnSettings, columnUnitDefinitions])
  const scrollWidth = visibleDefinitions.reduce((total, definition) => {
    const field = fieldDefinitions.find(candidate => candidate.key === definition.key)
    return total + getProjectListColumnWidth(definition.key, field?.width ?? 140, columnWidths)
  }, 0)

  const commitTempFilters = (next: AnyFilterCondition[]) => {
    setTempFilters(next)
    setFilters(normalizeFilterConditions(next, filterFieldDefinitions))
  }

  const updateTempCondition = (
    conditionId: string,
    patch: Partial<AnyFilterCondition>,
  ) => commitTempFilters(tempFilters.map(condition => (
    condition.id === conditionId ? { ...condition, ...patch } as AnyFilterCondition : condition
  )))

  const handleFieldChange = (condition: AnyFilterCondition, field: string) => {
    const definition = filterDefinitionByKey.get(field)
    const operator = getDefaultFilterOperator(definition?.kind ?? 'text')
    updateTempCondition(condition.id, {
      field,
      operator,
      value: normalizeFilterValueForOperator('', operator, definition?.kind ?? 'text'),
    })
  }

  const renderFilterValue = (condition: AnyFilterCondition) => {
    const definition = filterDefinitionByKey.get(condition.field)
    return (
      <FilterConditionValue
        size={compactControlSize}
        condition={condition}
        definition={definition}
        onChange={value => updateTempCondition(condition.id, { value })}
      />
    )
  }

  const openFilterPanel = (conditionId?: string) => {
    setColumnOpen(false)
    setEditingConditionId(conditionId ?? null)
    setTempFilters(filters.length
      ? cloneConditions(filters)
      : [createFilterCondition()])
    setFilterOpen(true)
  }

  const toolbarActions = (
    <Space size={8} className="pms-project-summary-actions">
      <FloatingFilterPanel
        open={filterOpen}
        title="项目筛选"
        getPopupContainer={getPopupContainer}
        trigger={(
          <Tooltip title={filters.length ? '筛选（已启用）' : '筛选'}>
            <Button
              aria-label="筛选"
              icon={<FilterOutlined />}
              type={filters.length ? 'primary' : 'default'}
              onClick={() => openFilterPanel()}
            >筛选</Button>
          </Tooltip>
        )}
        onReset={() => commitTempFilters([createFilterCondition()])}
        onAdd={() => commitTempFilters([...tempFilters, createFilterCondition()])}
        addDisabled={tempFilters.length >= filterFieldDefinitions.length}
        onClose={() => {
          setFilterOpen(false)
          setEditingConditionId(null)
        }}
      >
        <div className={`pms-filter-condition-list ${matrixVariant ? 'is-compact' : ''}`.trim()}>
          {tempFilters.map(condition => {
            const definition = filterDefinitionByKey.get(condition.field)
            const operatorOptions = getFilterOperatorsForKind(definition?.kind ?? 'text')
            return (
              <div
                key={condition.id}
                className="pms-filter-condition-row"
                data-filter-condition-id={condition.id}
              >
                <Select
                  size={compactControlSize}
                  aria-label="筛选字段"
                  placeholder="筛选字段"
                  value={condition.field || undefined}
                  options={getFieldOptionsWithDuplicateDisabled(
                    filterFieldDefinitions.map(field => ({
                      label: field.label,
                      value: field.key,
                    })),
                    tempFilters,
                    condition.id,
                  )}
                  onChange={field => handleFieldChange(condition, field)}
                />
                <Select
                  size={compactControlSize}
                  aria-label="筛选条件"
                  value={condition.operator}
                  options={operatorOptions as any}
                  onChange={operator => updateTempCondition(condition.id, {
                    operator,
                    value: normalizeFilterValueForOperator(
                      condition.value,
                      operator,
                      definition?.kind ?? 'text',
                    ),
                  })}
                />
                {renderFilterValue(condition)}
                <Button
                  size={compactControlSize}
                  danger
                  aria-label="删除筛选条件"
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    const remaining = tempFilters.filter(item => item.id !== condition.id)
                    commitTempFilters(remaining.length ? remaining : [createFilterCondition()])
                  }}
                />
              </div>
            )
          })}
        </div>
      </FloatingFilterPanel>

      {showColumnSettings && (
        <SortableColumnSettings
          open={columnOpen}
          getPopupContainer={getPopupContainer}
          trigger={(
            <Tooltip title="字段配置">
              <Button
                aria-label="字段配置"
                icon={<SettingOutlined />}
                onClick={() => {
                  setFilterOpen(false)
                  setColumnOpen(true)
                }}
              >字段配置</Button>
            </Tooltip>
          )}
          definitions={columnUnitDefinitions}
          value={columnSettings}
          defaultValue={defaultColumnSettings}
          minVisible={0}
          normalizeValue={value => normalizeProjectListUnitSettings(columnUnitDefinitions, value)}
          onCancel={() => setColumnOpen(false)}
          onApply={applyColumnSettings}
        />
      )}
      {toolbarTrailingAction}
    </Space>
  )

  const quickFilterControls = showQuickFilters ? (
    <Space size={8} wrap className="pms-project-list-quick-filter-controls">
      <Input
        size={compactControlSize}
        allowClear
        aria-label={matrixVariant === 'technical-subproject' ? '快捷筛选-子任务名称' : '快捷筛选-项目名称'}
        placeholder={matrixVariant === 'technical-subproject' ? '子任务名称' : '项目名称'}
        prefix={<FilterOutlined />}
        style={{ width: 180 }}
        value={typeof filters.find(item => item.field === 'projectName')?.value === 'string'
          ? filters.find(item => item.field === 'projectName')?.value as string
          : ''}
        onChange={event => setFilters(current => {
          const others = current.filter(item => item.field !== 'projectName')
          const value = event.target.value
          return value ? [...others, { id: 'quick-projectName', field: 'projectName', operator: 'contains', value }] : others
        })}
      />
      {quickFilterDefinitions.map(definition => (
        <Select
          size={compactControlSize}
          key={definition.key}
          mode="multiple"
          allowClear
          showSearch
          maxTagCount={1}
          optionFilterProp="label"
          placeholder={definition.label}
          aria-label={`快捷筛选-${definition.label}`}
          style={{ minWidth: 160, maxWidth: 240 }}
          options={definition.options}
          value={getLinkedQuickFilterValues(filters, definition.key)}
          onChange={values => setFilters(current => updateLinkedQuickFilterCondition(
            current,
            definition.key,
            values,
          ))}
        />
      ))}
    </Space>
  ) : null

  return (
    <div>
      {!toolbarHost && <div className="pms-toolbar pms-project-summary-toolbar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}>
        {quickFilterControls}

        {!toolbarHost && toolbarActions}
      </div>}

      {toolbarHost && createPortal(toolbarActions, toolbarHost)}
      {quickFilterHost && quickFilterControls && createPortal(quickFilterControls, quickFilterHost)}

      {filterSummaryHost && createPortal((
        <ActiveFilterConditions
          conditions={matrixVariant?.startsWith('technical')
            ? filters.filter(condition => condition.field !== 'technicalProjectType')
            : filters}
          definitions={filterFieldDefinitions}
          onEdit={conditionId => openFilterPanel(conditionId)}
          onRemove={conditionId => setFilters(current => (
            current.filter(condition => condition.id !== conditionId)
          ))}
        />
      ), filterSummaryHost)}

      {showTable && templateTasks.length === 0 && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          暂无已发布计划模板
        </Typography.Text>
      )}

      {showTable && <div ref={tableShellRef} className="pms-solid-surface pms-project-summary-table-shell pms-project-summary-surface">
        <SortableProjectListHeaderContext
          items={sortableHeaderIds}
          unitOrder={columnSettings.order}
          canDrop={canDropHeaderUnit}
          onDragEnd={handleHeaderDragEnd}
          onDragStateChange={setHeaderDragState}
        >
        <Table<ProjectSummaryRow>
          className="pms-table pms-project-summary-table"
          tableLayout="fixed"
          rowKey="key"
          columns={columns}
          components={{
            header: { cell: SortableProjectListHeader },
          }}
          dataSource={displayedRows}
          rowClassName={row => [
            'pms-project-summary-row',
            selectedRowKey === row.key ? 'is-selected' : '',
          ].filter(Boolean).join(' ')}
          pagination={tablePageSize && !machineHierarchy ? {
            current: tablePage,
            pageSize: tablePageSize,
            total: displayedRows.length,
            size: 'small',
            showSizeChanger: false,
            showTotal: total => `共 ${total} 个项目`,
            onChange: page => setTablePage(page),
          } : false}
          scroll={{ x: scrollWidth, y: 'calc(100vh - 260px)' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无项目数据"
              />
            ),
          }}
          onRow={row => ({
            style: { cursor: row.__groupSummary ? 'default' : 'pointer' },
            'aria-selected': selectedRowKey === row.key,
            onClick: () => {
              if (row.__groupSummary) return
              setSelectedRowKey(row.key)
              if (onViewRow) onViewRow(row)
              else onViewProject(row.projectId)
            },
          })}
        />
        </SortableProjectListHeaderContext>
        {tablePageSize && machineHierarchy && (
          <div className="pms-project-list-pagination">
            <Pagination
              current={tablePage}
              pageSize={tablePageSize}
              total={filteredRows.length}
              size="small"
              showSizeChanger={false}
              showTotal={total => `共 ${total} 个项目`}
              onChange={page => setTablePage(page)}
            />
          </div>
        )}
      </div>}
    </div>
  )
}
