'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  FilterOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { FloatingFilterPanel } from '@/components/shared/FloatingFilterPanel'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  getDefaultColumnSettings,
  normalizeColumnSettings,
  orderVisibleDefinitions,
  type SortableColumnDefinition,
  type SortableColumnSettingsValue,
} from '@/lib/columnSettings'
import {
  ENUM_FILTER_OPERATORS,
  MULTI_ENUM_FILTER_OPERATORS,
  applyFilterConditions,
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  getFilterOperatorsForKind,
  isValuelessFilterOperator,
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
  getProjectSummaryFieldDefinitions,
  getProjectSummaryQuickFilterDefinitions,
  getTemplateTaskFieldDefinitions,
  normalizeStoredProjectSummaryFilters,
  updateLinkedQuickFilterCondition,
  type ProjectSummaryFieldDefinition,
  type ProjectSummaryRow,
  type ProjectSummaryTemplateTask,
} from '@/lib/projectSummary'

interface ProjectSummaryVersion {
  id: string
  versionNo: string
  status: string
}

export interface ProjectSummaryTableProps {
  projects: ProjectInfoProject[]
  projectType: string
  versions: ProjectSummaryVersion[]
  currentVersion: string
  publishedSnapshots: Record<string, ProjectSummaryTemplateTask[]>
  currentTemplateTasks: ProjectSummaryTemplateTask[]
  storageNamespace: string
  onViewProject: (projectId: string) => void
}

interface StoredProjectSummaryPreferences {
  filters?: AnyFilterCondition[]
  columns?: Partial<SortableColumnSettingsValue<string>> | string[]
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
  projectType,
  versions,
  currentVersion,
  publishedSnapshots,
  currentTemplateTasks,
  storageNamespace,
  onViewProject,
}: ProjectSummaryTableProps) {
  const [filters, setFilters] = useState<AnyFilterCondition[]>([])
  const [tempFilters, setTempFilters] = useState<AnyFilterCondition[]>([
    createFilterCondition(),
  ])
  const [filterOpen, setFilterOpen] = useState(false)
  const [columnOpen, setColumnOpen] = useState(false)

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

  const fieldDefinitions = useMemo(() => [
    ...getProjectSummaryFieldDefinitions(projectType),
    ...getTemplateTaskFieldDefinitions(projectType, templateTasks),
  ], [projectType, templateTasks])

  const columnDefinitions = useMemo<SortableColumnDefinition<string>[]>(() => (
    fieldDefinitions.map(definition => ({
      key: definition.key,
      title: definition.title,
      defaultVisible: definition.defaultVisible,
      hideable: definition.hideable,
      fixed: definition.key === 'projectName' ? 'left' : undefined,
      disabledReason: definition.hideable === false ? '项目汇总必显字段' : undefined,
    }))
  ), [fieldDefinitions])

  const defaultColumnSettings = useMemo(
    () => getDefaultColumnSettings(columnDefinitions),
    [columnDefinitions],
  )
  const [columnSettings, setColumnSettings] = useState<SortableColumnSettingsValue<string>>(
    defaultColumnSettings,
  )

  const baseRows = useMemo(
    () => projects.map(project => buildProjectSummaryRow(project, fieldDefinitions)),
    [fieldDefinitions, projects],
  )
  const quickFilterDefinitions = useMemo(
    () => getProjectSummaryQuickFilterDefinitions(projectType, projects),
    [projectType, projects],
  )
  const quickFilterByKey = useMemo(
    () => new Map(quickFilterDefinitions.map(definition => [definition.key, definition])),
    [quickFilterDefinitions],
  )

  const filterFieldDefinitions = useMemo<FilterFieldDefinition[]>(() => {
    const definitions = fieldDefinitions.map(definition => {
      const quickDefinition = quickFilterByKey.get(definition.key)
      const kind = getFilterKind(definition)
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
  const storageKey = `pms:project-summary:${storageNamespace}:${projectType}`
  const definitionSignature = useMemo(
    () => JSON.stringify(columnDefinitions.map(definition => [
      definition.key,
      definition.defaultVisible,
      definition.hideable !== false,
    ])),
    [columnDefinitions],
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
      storedColumns = normalizeColumnSettings(
        columnDefinitions,
        getStoredColumns(stored.columns),
      )
    } catch {
      storedFilters = []
      storedColumns = defaultColumnSettings
    }
    setFilters(storedFilters)
    setColumnSettings(storedColumns)
    setHydratedKey(hydrationKey)
  }, [
    columnDefinitions,
    defaultColumnSettings,
    filterDefinitionSignature,
    hydrationKey,
    storageKey,
  ])

  useEffect(() => {
    if (hydratedKey !== hydrationKey) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        filters,
        columns: normalizeColumnSettings(columnDefinitions, columnSettings),
      } satisfies StoredProjectSummaryPreferences))
    } catch {
      // Preference persistence must never block the table.
    }
  }, [
    columnDefinitions,
    columnSettings,
    filters,
    hydratedKey,
    hydrationKey,
    storageKey,
  ])

  const filteredRows = useMemo(
    () => applyFilterConditions(baseRows, filters, filterFieldDefinitions),
    [baseRows, filterFieldDefinitions, filters],
  )

  const visibleDefinitions = useMemo(
    () => orderVisibleDefinitions(columnDefinitions, columnSettings),
    [columnDefinitions, columnSettings],
  )
  const tableColumnByKey = useMemo(
    () => new Map(buildProjectSummaryColumns(fieldDefinitions).map(column => [
      String(column.key),
      column,
    ])),
    [fieldDefinitions],
  )
  const columns = useMemo<ColumnsType<ProjectSummaryRow>>(
    () => visibleDefinitions
      .map(definition => tableColumnByKey.get(definition.key))
      .filter((column): column is NonNullable<typeof column> => Boolean(column)),
    [tableColumnByKey, visibleDefinitions],
  )
  const scrollWidth = visibleDefinitions.reduce((total, definition) => {
    const field = fieldDefinitions.find(candidate => candidate.key === definition.key)
    return total + (field?.width ?? 140)
  }, 0)

  const updateTempCondition = (
    conditionId: string,
    patch: Partial<AnyFilterCondition>,
  ) => {
    setTempFilters(current => current.map(condition => (
      condition.id === conditionId ? { ...condition, ...patch } as AnyFilterCondition : condition
    )))
  }

  const handleFieldChange = (condition: AnyFilterCondition, field: string) => {
    const definition = filterDefinitionByKey.get(field)
    updateTempCondition(condition.id, {
      field,
      operator: definition?.multiple ? 'equalsAny' : 'equals',
      value: definition?.multiple ? [] : '',
    })
  }

  const renderFilterValue = (condition: AnyFilterCondition) => {
    if (isValuelessFilterOperator(condition.operator)) return null
    const definition = filterDefinitionByKey.get(condition.field)
    if (!definition) {
      return <Input disabled placeholder="请先选择筛选字段" />
    }
    if (definition.multiple) {
      return (
        <Select
          mode="multiple"
          aria-label={`${definition.label}筛选值`}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="请选择筛选值"
          value={Array.isArray(condition.value) ? condition.value : []}
          options={definition.options}
          onChange={value => updateTempCondition(condition.id, { value })}
        />
      )
    }
    if (definition.kind === 'date') {
      const value = typeof condition.value === 'string' && condition.value
        ? dayjs(condition.value)
        : null
      return (
        <DatePicker
          aria-label={`${definition.label}筛选值`}
          style={{ width: '100%' }}
          value={value?.isValid() ? value : null}
          onChange={date => updateTempCondition(
            condition.id,
            { value: date ? date.format('YYYY-MM-DD') : '' },
          )}
        />
      )
    }
    if (definition.kind === 'enum') {
      return (
        <Select
          aria-label={`${definition.label}筛选值`}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="请选择筛选值"
          value={typeof condition.value === 'string' && condition.value
            ? condition.value
            : undefined}
          options={definition.options}
          onChange={value => updateTempCondition(condition.id, { value: value ?? '' })}
        />
      )
    }
    return (
      <Input
        aria-label={`${definition.label}筛选值`}
        placeholder="输入筛选值"
        value={typeof condition.value === 'string' ? condition.value : ''}
        onChange={event => updateTempCondition(condition.id, { value: event.target.value })}
      />
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}>
        <Space size={8} wrap>
          {quickFilterDefinitions.map(definition => (
            <Select
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

        <Space size={6}>
          <FloatingFilterPanel
            open={filterOpen}
            getPopupContainer={getPopupContainer}
            trigger={(
              <Tooltip title={filters.length ? '筛选（已启用）' : '筛选'}>
                <Button
                  aria-label="筛选"
                  icon={<FilterOutlined />}
                  type={filters.length ? 'primary' : 'default'}
                  onClick={() => {
                    setColumnOpen(false)
                    setTempFilters(filters.length
                      ? cloneConditions(filters)
                      : [createFilterCondition()])
                    setFilterOpen(true)
                  }}
                />
              </Tooltip>
            )}
            onReset={() => setTempFilters([createFilterCondition()])}
            onClear={() => setTempFilters([createFilterCondition()])}
            onCancel={() => setFilterOpen(false)}
            onConfirm={() => {
              setFilters(normalizeFilterConditions(
                tempFilters,
                filterFieldDefinitions,
              ))
              setFilterOpen(false)
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tempFilters.map(condition => {
                const definition = filterDefinitionByKey.get(condition.field)
                const operatorOptions = definition?.multiple
                  ? MULTI_ENUM_FILTER_OPERATORS
                  : definition?.kind === 'enum'
                    ? ENUM_FILTER_OPERATORS
                    : getFilterOperatorsForKind(definition?.kind ?? 'text')
                return (
                  <div
                    key={condition.id}
                    style={{
                      padding: 12,
                      border: '1px solid #eef2ff',
                      borderRadius: 8,
                      background: '#fafbff',
                    }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) 116px 40px',
                      gap: 8,
                      marginBottom: isValuelessFilterOperator(condition.operator) ? 0 : 8,
                    }}>
                      <Select
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
                        aria-label="筛选操作符"
                        value={condition.operator}
                        options={operatorOptions as any}
                        disabled={definition?.multiple}
                        onChange={operator => updateTempCondition(condition.id, {
                          operator,
                          value: isValuelessFilterOperator(operator) ? '' : condition.value,
                        })}
                      />
                      <Button
                        danger
                        aria-label="删除筛选条件"
                        icon={<DeleteOutlined />}
                        onClick={() => setTempFilters(current => {
                          const remaining = current.filter(
                            item => item.id !== condition.id,
                          )
                          return remaining.length ? remaining : [createFilterCondition()]
                        })}
                      />
                    </div>
                    {renderFilterValue(condition)}
                  </div>
                )
              })}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setTempFilters(current => [
                  ...current,
                  createFilterCondition(),
                ])}
              >
                添加条件
              </Button>
            </div>
          </FloatingFilterPanel>

          <SortableColumnSettings
            open={columnOpen}
            getPopupContainer={getPopupContainer}
            trigger={(
              <Tooltip title="列设置">
                <Button
                  aria-label="列设置"
                  icon={<SettingOutlined />}
                  onClick={() => {
                    setFilterOpen(false)
                    setColumnOpen(true)
                  }}
                />
              </Tooltip>
            )}
            definitions={columnDefinitions}
            value={columnSettings}
            defaultValue={defaultColumnSettings}
            onCancel={() => setColumnOpen(false)}
            onApply={nextSettings => {
              setColumnSettings(nextSettings)
              setColumnOpen(false)
            }}
          />
        </Space>
      </div>

      {templateTasks.length === 0 && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          暂无已发布一级计划模板
        </Typography.Text>
      )}

      <Table<ProjectSummaryRow>
        className="pms-table"
        rowKey="projectId"
        columns={columns}
        dataSource={filteredRows}
        pagination={false}
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
          style: { cursor: 'pointer' },
          onClick: () => onViewProject(row.projectId),
        })}
      />
    </div>
  )
}
