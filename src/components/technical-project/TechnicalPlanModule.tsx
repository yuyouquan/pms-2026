'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Avatar, Badge, Button, Card, DatePicker, Dropdown, Empty, Input, Modal, Popconfirm, Progress,
  Row, Select, Space, Table, Tabs, Tag, Tooltip, Typography, Upload, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
  CopyOutlined, DeleteOutlined, DownloadOutlined, HistoryOutlined, PlusOutlined, SaveOutlined,
  CaretDownOutlined, EditOutlined, FilterOutlined, MinusSquareOutlined, PlusSquareOutlined, SettingOutlined, ShareAltOutlined,
  StopOutlined, UploadOutlined,
} from '@ant-design/icons'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import SubprojectConfigModal from '@/components/technical-project/SubprojectConfigModal'
import { PlanVersionCompareModal } from '@/components/plans/PlanVersionCompareModal'
import { PlanWorkspaceShell } from '@/components/plans/PlanWorkspaceShell'
import { FloatingFilterPanel } from '@/components/shared/FloatingFilterPanel'
import { DHTMLXGantt, DragHandle, SortableRow } from '@/components/shared/PlanHelpers'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  applyPlanWorkspaceFilters,
  buildPlanHorizontalStageGroups,
  filterPlanTasksByCollapsed,
  type PlanWorkspaceViewMode,
} from '@/lib/planWorkspace'
import {
  buildTechnicalHorizontalRows,
  includeTechnicalPlanAncestors,
  isResponsibleForTechnicalPlanTasks,
  parseTechnicalPlanImportRows,
  reorderTechnicalTasksWithinParent,
  selectVisibleTechnicalPlanVersions,
  TECHNICAL_PLAN_EXPORT_COLUMNS,
} from '@/lib/technicalPlanWorkspace'
import { compareVersionsForTable } from '@/lib/versionCompare'
import type { PlanRevisionKind } from '@/lib/planVersioning'
import { getTemplateSnapshotForProjectType } from '@/lib/projectTemplateCompatibility'
import { comparePublishedTechnicalPlanVersions } from '@/lib/technicalProjectRules'
import {
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  getFilterOperatorsForKind,
  isFilterConditionActive,
  isValuelessFilterOperator,
  normalizeFilterConditions,
  type FilterCondition,
  type FilterFieldDefinition,
  type FilterOperator,
} from '@/lib/filterConditions'
import {
  getInvalidTechnicalTaskFields,
  getTemplateConfigScopeKey,
  insertTechnicalPlanTask,
  deleteTechnicalPlanTaskCascade,
  TECHNICAL_TEMPLATE_STORAGE_KEYS,
  validateTechnicalTemplateDepth,
} from '@/lib/technicalPlanRules'
import { exportMergedSheet, exportSheet, exportTimestamp } from '@/utils/exportExcel'
import { usePlanStore } from '@/stores/plan'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import { useUiStore } from '@/stores/ui'
import {
  buildTechnicalPlanTabs, getTechnicalPlanKey, useTechnicalPlanStore,
} from '@/stores/technicalPlan'
import type { TechnicalTemplateKind, TechnicalTemplateTask } from '@/types/technicalPlan'
import type { TechnicalSubproject } from '@/types/technicalProject'
import type { SortableColumnDefinition } from '@/lib/columnSettings'

const { Text } = Typography
const FIXED_TDT_LABEL = 'TDT项目计划'
const PLAN_REVISION_KIND_OPTIONS: Array<{ key: PlanRevisionKind; label: string }> = [
  { key: 'gray', label: '创建非正式版本' },
  { key: 'formal', label: '创建正式版本' },
]

const COLUMN_LABELS: Record<string, string> = {
  id: '序号',
  taskName: '任务名称', responsible: '责任人', predecessor: '前置任务',
  planStartDate: '计划开始', planEndDate: '计划完成', estimatedDays: '预估工期',
  actualStartDate: '实际开始', actualEndDate: '实际完成', actualDays: '实际工期',
  status: '状态', progress: '进度',
}
const TECHNICAL_COLUMN_DEFINITIONS: readonly SortableColumnDefinition<string>[] = Object.entries(COLUMN_LABELS).map(([key, title]) => ({
  key, title, defaultVisible: true, hideable: key !== 'id' && key !== 'taskName', fixed: key === 'id' || key === 'taskName' ? 'left' : undefined,
}))
const DEFAULT_MAX_DEPTH: Readonly<Record<TechnicalTemplateKind, number>> = { tdt: 2, subproject: 1 }
const TECHNICAL_FILTER_FIELDS: readonly FilterFieldDefinition[] = [
  { key: 'taskName', label: '任务名称', kind: 'text' },
  { key: 'responsible', label: '责任人', kind: 'text' },
  { key: 'predecessor', label: '前置任务', kind: 'text' },
  { key: 'planStartDate', label: '计划开始', kind: 'date' },
  { key: 'planEndDate', label: '计划完成', kind: 'date' },
  { key: 'estimatedDays', label: '预估工期', kind: 'text' },
  { key: 'actualStartDate', label: '实际开始', kind: 'date' },
  { key: 'actualEndDate', label: '实际完成', kind: 'date' },
  { key: 'actualDays', label: '实际工期', kind: 'text' },
  { key: 'status', label: '状态', kind: 'enum', options: ['未开始', '进行中', '已完成'].map(value => ({ label: value, value })) },
  { key: 'progress', label: '进度', kind: 'text' },
]

function TechnicalHorizontalPlanTable({
  tasks,
  versions,
  currentVersionId,
}: {
  tasks: readonly TechnicalTemplateTask[]
  versions: readonly { id: string; versionNo: string; status: string; tasks: TechnicalTemplateTask[] }[]
  currentVersionId: string
}) {
  const groups = buildPlanHorizontalStageGroups(
    tasks.map(task => ({ ...task })),
  )
  if (!groups.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无横版计划数据" />
  const rows = buildTechnicalHorizontalRows(versions, currentVersionId)
  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      key: 'versionNo', title: '版本', dataIndex: 'versionNo', width: 110, fixed: 'left',
      render: (value, row) => <Space size={4}><strong>{value}</strong>{row.status === '修订中' && <Tag color="green">修订中</Tag>}</Space>,
    },
    {
      key: 'cycleDays', title: '开发周期', dataIndex: 'cycleDays', width: 100, fixed: 'left',
      render: value => value == null ? '-' : `${value}天`,
    },
    ...groups.map(group => ({
      key: group.stage.id,
      title: group.stage.taskName,
      children: (group.milestones.length ? group.milestones : [group.stage]).map(milestone => ({
        key: milestone.id,
        title: milestone.taskName,
        width: 136,
        align: 'center' as const,
        render: (_: unknown, row: (typeof rows)[number]) => row.endDatesByTaskId[milestone.id] || '-',
      })),
    })),
  ]
  return (
    <Table
      className="pms-table technical-horizontal-plan-table"
      rowKey="id"
      size="middle"
      bordered
      pagination={false}
      columns={columns}
      dataSource={rows}
      rowClassName={row => row.rowType === 'actual' ? 'technical-plan-summary-actual' : ''}
      scroll={{ x: Math.max(960, groups.reduce((total, group) => total + group.colSpan * 136, 210)) }}
    />
  )
}

export interface TechnicalPlanModuleProps {
  projectId: string
  currentLoginUser?: string
  canEdit: boolean
  canPublish: boolean
  canImport: boolean
  canExport: boolean
  canViewTechnicalPlan: boolean
  canShareTechnicalPlan: boolean
  maxDepthByKind: Readonly<Record<TechnicalTemplateKind, number>>
}

const latestPublishedTemplate = (
  kind: TechnicalTemplateKind,
  scopes: ReturnType<typeof usePlanStore.getState>['configTemplateVersionScopes'],
  snapshots: ReturnType<typeof usePlanStore.getState>['publishedSnapshots'],
  fallback: readonly TechnicalTemplateTask[],
) => {
  const scope = scopes[getTemplateConfigScopeKey('技术项目', kind)]
  const published = (scope?.versions || [])
    .filter(version => version.status === '已发布')
    .sort((left, right) => (Number.parseInt(right.versionNo.replace(/\D/g, ''), 10) || 0) - (Number.parseInt(left.versionNo.replace(/\D/g, ''), 10) || 0))[0]
  return (published && getTemplateSnapshotForProjectType<TechnicalTemplateTask[]>(snapshots, '技术项目', published.id, kind)) || fallback
}

export default function TechnicalPlanModule({
  projectId, currentLoginUser, canEdit, canPublish, canImport, canExport, canViewTechnicalPlan, canShareTechnicalPlan,
  maxDepthByKind = DEFAULT_MAX_DEPTH,
}: TechnicalPlanModuleProps) {
  const [activeKey, setActiveKey] = useState(`${projectId}:tdt`)
  const [viewMode, setViewMode] = useState<PlanWorkspaceViewMode>('vertical')
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareBaseId, setCompareBaseId] = useState('')
  const [compareTargetId, setCompareTargetId] = useState('')
  const [hasCompared, setHasCompared] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [tempFilters, setTempFilters] = useState<FilterCondition[]>([createFilterCondition()])
  const [configuringChild, setConfiguringChild] = useState<TechnicalSubproject | null>(null)
  const [configTrigger, setConfigTrigger] = useState<HTMLElement | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const subprojects = useTechnicalProjectStore(state => state.subprojects)
  const plansByKey = useTechnicalPlanStore(state => state.plansByKey)
  const createRevision = useTechnicalPlanStore(state => state.createRevision)
  const publishRevision = useTechnicalPlanStore(state => state.publishRevision)
  const cancelRevision = useTechnicalPlanStore(state => state.cancelRevision)
  const updateCurrentTasks = useTechnicalPlanStore(state => state.updateCurrentTasks)
  const setCurrentVersion = useTechnicalPlanStore(state => state.setCurrentVersion)
  const setColumns = useTechnicalPlanStore(state => state.setColumns)
  const setCollapsed = useTechnicalPlanStore(state => state.setCollapsed)
  const configTemplateTasksByType = usePlanStore(state => state.configTemplateTasksByType)
  const configTemplateVersionScopes = usePlanStore(state => state.configTemplateVersionScopes)
  const publishedSnapshots = usePlanStore(state => state.publishedSnapshots)
  const setIsEditMode = useUiStore(state => state.setIsEditMode)
  const navigateWithEditGuard = useUiStore(state => state.navigateWithEditGuard)

  const tabs = useMemo(
    () => buildTechnicalPlanTabs(projectId, subprojects, false),
    [projectId, subprojects],
  )
  useEffect(() => {
    const firstKey = `${projectId}:tdt`
    setActiveKey(current => tabs.some(tab => tab.key === current) ? current : firstKey)
  }, [projectId, tabs])
  const tab = tabs.find(item => item.key === activeKey) || tabs[0]
  const scope = tab?.scope || { kind: 'tdt' as const, parentProjectId: projectId }
  const instance = plansByKey[getTechnicalPlanKey(scope)]
  const technicalDraft = instance?.versions.find(version => version.status === '修订中')
  const canViewTechnicalDraft = canViewTechnicalPlan && (
    canEdit || isResponsibleForTechnicalPlanTasks(technicalDraft?.tasks || [], currentLoginUser)
  )
  const visibleVersions = useMemo(
    () => canViewTechnicalPlan
      ? selectVisibleTechnicalPlanVersions(instance?.versions || [], canViewTechnicalDraft)
      : [],
    [canViewTechnicalDraft, canViewTechnicalPlan, instance?.versions],
  )
  const selectedVisibleVersion = visibleVersions.find(version => version.id === instance?.currentVersionId)
  const latestPublishedVersion = [...visibleVersions]
    .filter(version => version.status === '已发布')
    .sort(comparePublishedTechnicalPlanVersions)[0]
  const currentVersion = selectedVisibleVersion || latestPublishedVersion || visibleVersions[0]
  const tasks = currentVersion?.tasks || []
  const isDraft = currentVersion?.status === '修订中'
  const readOnlyReason = tab?.subproject && !tab.subproject.active
    ? '已停用子项目仅可查看历史计划'
    : tab?.subproject && (!tab.subproject.configuration.coreValue || !tab.subproject.configuration.developmentMode)
      ? '请先完成子项目信息配置'
      : ''
  const canEditTechnicalPlan = canViewTechnicalPlan && canEdit
  const canMaintain = canEditTechnicalPlan && isDraft && !readOnlyReason
  const templateTasks = latestPublishedTemplate(
    tab?.templateKind || 'tdt', configTemplateVersionScopes, publishedSnapshots,
    configTemplateTasksByType[TECHNICAL_TEMPLATE_STORAGE_KEYS[tab?.templateKind || 'tdt']] || [],
  )
  const maxDepth = Math.min(maxDepthByKind[tab?.templateKind || 'tdt'], tab?.templateKind === 'subproject' ? 1 : 2)
  const invalid = getInvalidTechnicalTaskFields(tasks)
  const collapsedIds = useMemo(() => new Set(instance?.collapsedRows || []), [instance?.collapsedRows])
  const directlyFilteredTasks = useMemo(
    () => applyPlanWorkspaceFilters(tasks, filters, TECHNICAL_FILTER_FIELDS),
    [filters, tasks],
  )
  const hasActiveFilters = filters.some(isFilterConditionActive)
  const filteredTasks = useMemo(
    () => hasActiveFilters ? includeTechnicalPlanAncestors(tasks, directlyFilteredTasks) : [...tasks],
    [directlyFilteredTasks, hasActiveFilters, tasks],
  )
  const visibleTasks = useMemo(
    () => filterPlanTasksByCollapsed(filteredTasks, collapsedIds),
    [collapsedIds, filteredTasks],
  )
  const publishedVersions = useMemo(
    () => canViewTechnicalPlan
      ? (instance?.versions || []).filter(version => version.status === '已发布')
      : [],
    [canViewTechnicalPlan, instance?.versions],
  )
  const hasDraft = Boolean(instance?.versions.some(version => version.status === '修订中'))
  const canEditTaskStructure = canMaintain && viewMode === 'vertical'
  const canDrag = canEditTaskStructure && !hasActiveFilters

  useEffect(() => {
    setIsEditMode(Boolean(canMaintain))
  }, [canMaintain, setIsEditMode])
  useEffect(() => () => setIsEditMode(false), [setIsEditMode])

  useEffect(() => {
    setFilters([])
    setTempFilters([createFilterCondition()])
    setFilterOpen(false)
    setColumnsOpen(false)
    setViewMode('vertical')
    setCompareOpen(false)
    setHasCompared(false)
  }, [activeKey])

  const handleCreateRevision = (revisionKind: PlanRevisionKind) => {
    if (!tab || !canEditTechnicalPlan) return
    const result = createRevision({ scope: tab.scope, templateKind: tab.templateKind, maxDepth, templateTasks, revisionKind, subproject: tab.subproject })
    if (!result.ok) {
      message.warning(result.reason === 'draft-exists' ? '当前计划已有修订版' : readOnlyReason || '当前子项目不可创建修订')
      return
    }
    message.success(`已创建${revisionKind === 'gray' ? '非正式' : '正式'}修订版本 ${result.versionId.replace('-draft', '')}`)
  }

  const handleCreateRevisionMenuClick: MenuProps['onClick'] = ({ key }) => {
    handleCreateRevision(key as PlanRevisionKind)
  }

  const handleClonePlan = () => {
    if (!tab || !canMaintain) return
    const source = [...publishedVersions]
      .sort((left, right) => right.versionNo.localeCompare(left.versionNo, undefined, { numeric: true }))[0]
    if (!source) { message.warning('暂无可克隆的已发布版本'); return }
    Modal.confirm({
      title: '确认克隆计划',
      content: `确认将 ${source.versionNo} 的计划信息克隆到当前修订版本？实际开始和实际完成时间不会被克隆。`,
      okText: '确认克隆',
      cancelText: '取消',
      onOk: () => {
        const clonedTasks = source.tasks.map(task => ({
          ...task,
          actualStartDate: '',
          actualEndDate: '',
        }))
        const result = updateCurrentTasks(scope, clonedTasks, maxDepth)
        if (!result.ok) { message.error('计划克隆失败，请检查任务层级'); return }
        message.success(`已克隆 ${source.versionNo}，实际开始和实际完成时间已清空`)
      },
    })
  }

  const handlePublish = () => {
    if (!canPublish || !canMaintain) return
    if (invalid.size) {
      setCollapsed(scope, [])
      setFilters([])
      setTempFilters([createFilterCondition()])
      setFilterOpen(false)
      setColumnsOpen(false)
      setViewMode('vertical')
      const firstInvalidTaskId = invalid.keys().next().value
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.querySelector(`[data-row-key="${CSS.escape(String(firstInvalidTaskId))}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      })
      message.error('请先修复计划日期冲突')
      return
    }
    if (publishRevision(scope).ok) message.success('计划已发布')
  }

  const updateTask = (id: string, patch: Partial<TechnicalTemplateTask>) => {
    if (!canMaintain) return
    updateCurrentTasks(scope, tasks.map(task => task.id === id ? { ...task, ...patch } : task), maxDepth)
  }

  const createTask = (parentId?: string): TechnicalTemplateTask => ({
    id: `technical-task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    order: tasks.length + 1,
    taskName: parentId ? '新建二级任务' : '新建一级任务',
    ...(parentId ? { parentId } : {}),
    responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0,
    actualStartDate: '', actualEndDate: '', actualDays: 0, status: '未开始', progress: 0, defaultRoadmap: Boolean(parentId),
  })

  const handleAddTopLevelTask = () => {
    if (!canMaintain) return
    const result = updateCurrentTasks(scope, insertTechnicalPlanTask(tasks, createTask(), tab?.templateKind || 'tdt', maxDepth), maxDepth)
    if (!result.ok) message.error('新增任务超出允许层级')
  }

  const handleAddChildTask = (parentId: string) => {
    if (!canMaintain || maxDepth < 2 || tasks.find(task => task.id === parentId)?.parentId) return
    const next = insertTechnicalPlanTask(tasks, createTask(parentId), tab?.templateKind || 'tdt', maxDepth)
    const result = updateCurrentTasks(scope, next, maxDepth)
    if (!result.ok) message.error('新增任务超出允许层级')
  }

  const handleDeleteTask = (taskId: string) => {
    if (!canMaintain) return
    const next = deleteTechnicalPlanTaskCascade(tasks, taskId)
    updateCurrentTasks(scope, next, maxDepth)
    const removedCount = tasks.length - next.length
    message.success(removedCount > 1 ? `已级联删除 ${removedCount} 项任务` : '已删除任务')
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !canDrag) return
    const moved = reorderTechnicalTasksWithinParent(tasks, String(active.id), String(over.id))
    updateCurrentTasks(scope, moved, maxDepth)
  }

  const handleScopeChange = (nextKey: string) => {
    navigateWithEditGuard(() => {
      setFilterOpen(false)
      setColumnsOpen(false)
      setActiveKey(nextKey)
    }, Boolean(isDraft))
  }

  const handleVersionChange = (versionId: string) => {
    navigateWithEditGuard(() => setCurrentVersion(scope, versionId), Boolean(isDraft))
  }

  const expandAll = () => setCollapsed(scope, [])
  const collapseAll = () => setCollapsed(scope, filteredTasks
    .filter(task => tasks.some(child => child.parentId === task.id))
    .map(task => task.id))
  const toggleCollapsedTask = (taskId: string) => {
    const nextCollapsedIds = new Set(collapsedIds)
    if (nextCollapsedIds.has(taskId)) nextCollapsedIds.delete(taskId)
    else nextCollapsedIds.add(taskId)
    setCollapsed(scope, [...nextCollapsedIds])
  }

  const baseColumns: ColumnsType<TechnicalTemplateTask> = [
    {
      key: 'id', title: '序号', dataIndex: 'id', width: 130, fixed: 'left',
      render: (value, row) => (
        <div className="technical-plan-sequence-cell" style={{ paddingLeft: row.parentId ? 20 : 0 }}>
          {canDrag && <DragHandle />}
          {tasks.some(child => child.parentId === row.id) ? (
            <Tooltip title={collapsedIds.has(row.id) ? '展开一级任务' : '收起一级任务'}>
              <Button
                type="text"
                size="small"
                className="technical-plan-collapse-button"
                aria-label={`${collapsedIds.has(row.id) ? '展开' : '收起'}一级任务 ${row.taskName}`}
                aria-expanded={!collapsedIds.has(row.id)}
                icon={<CaretDownOutlined />}
                onClick={event => {
                  event.stopPropagation()
                  toggleCollapsedTask(row.id)
                }}
              />
            </Tooltip>
          ) : <span className="technical-plan-collapse-placeholder" aria-hidden />}
          {canMaintain && tab?.templateKind === 'tdt' && !row.parentId && maxDepth >= 2 && (
            <Tooltip title="添加子项"><Button type="text" size="small" icon={<PlusOutlined />} onClick={() => handleAddChildTask(row.id)} /></Tooltip>
          )}
          <span>{value}</span>
        </div>
      ),
    },
    {
      key: 'taskName', title: '任务名称', dataIndex: 'taskName', width: 260, fixed: 'left',
      render: (value, row) => (
        <div className="technical-plan-task-name-cell" style={{ paddingLeft: row.parentId ? 16 : 0 }}>
          {canMaintain
            ? <Input className="pms-edit-input" value={value} onChange={event => updateTask(row.id, { taskName: event.target.value })} />
            : <><span aria-hidden style={{ color: '#e5e7eb' }}>{row.parentId ? '├' : ''}</span><span className="technical-plan-task-name-text">{value}</span></>}
        </div>
      ),
    },
    { key: 'responsible', title: '责任人', dataIndex: 'responsible', width: 130, render: (value, row) => canMaintain ? <Input className="pms-edit-input" value={value} onChange={event => updateTask(row.id, { responsible: event.target.value })} /> : value ? <Space size={6}><Avatar size={20}>{String(value).slice(0, 1)}</Avatar><span>{value}</span></Space> : '-' },
    { key: 'predecessor', title: '前置任务', dataIndex: 'predecessor', width: 120, render: (value, row) => canMaintain ? <Input value={value} onChange={event => updateTask(row.id, { predecessor: event.target.value })} /> : value || '-' },
    { key: 'planStartDate', title: '计划开始', dataIndex: 'planStartDate', width: 145, onCell: row => ({ className: invalid.get(row.id)?.start ? 'pms-cell-invalid' : '' }), render: (value, row) => canMaintain ? <Tooltip title={invalid.get(row.id)?.start?.join('；')}><DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { planStartDate: date?.format('YYYY-MM-DD') || '' })} /></Tooltip> : value || '-' },
    { key: 'planEndDate', title: '计划完成', dataIndex: 'planEndDate', width: 145, onCell: row => ({ className: invalid.get(row.id)?.end ? 'pms-cell-invalid' : '' }), render: (value, row) => canMaintain ? <Tooltip title={invalid.get(row.id)?.end?.join('；')}><DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { planEndDate: date?.format('YYYY-MM-DD') || '' })} /></Tooltip> : value || '-' },
    { key: 'estimatedDays', title: '预估工期', dataIndex: 'estimatedDays', width: 100, render: (value, row) => canMaintain ? <Input type="number" min={0} value={value} onChange={event => updateTask(row.id, { estimatedDays: Number(event.target.value) || 0 })} /> : `${value || 0}天` },
    { key: 'actualStartDate', title: '实际开始', dataIndex: 'actualStartDate', width: 145, render: (value, row) => canMaintain ? <DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { actualStartDate: date?.format('YYYY-MM-DD') || '' })} /> : value || '-' },
    { key: 'actualEndDate', title: '实际完成', dataIndex: 'actualEndDate', width: 145, render: (value, row) => canMaintain ? <DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { actualEndDate: date?.format('YYYY-MM-DD') || '' })} /> : value || '-' },
    { key: 'actualDays', title: '实际工期', dataIndex: 'actualDays', width: 100, render: (value, row) => canMaintain ? <Input type="number" min={0} value={value} onChange={event => updateTask(row.id, { actualDays: Number(event.target.value) || 0 })} /> : `${value || 0}天` },
    { key: 'status', title: '状态', dataIndex: 'status', width: 105, render: (value, row) => canMaintain ? <Select value={value} style={{ width: 96 }} options={['未开始', '进行中', '已完成'].map(status => ({ label: status, value: status }))} onChange={status => updateTask(row.id, { status })} /> : <Tag color={value === '已完成' ? 'success' : value === '进行中' ? 'processing' : 'default'}>{value}</Tag> },
    { key: 'progress', title: '进度', dataIndex: 'progress', width: 130, render: (value, row) => canMaintain ? <Input type="number" min={0} max={100} value={value} suffix="%" onChange={event => updateTask(row.id, { progress: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /> : <div className="technical-plan-progress"><Progress percent={value || 0} size="small" showInfo={false} /><span>{value || 0}%</span></div> },
    {
      key: 'actions', title: '操作', fixed: 'right', width: 105,
      render: (_, row) => (
        <Space size={2}>
          {tab?.templateKind === 'tdt' && !row.parentId && (
            <Tooltip title="新增二级任务">
              <Button type="text" size="small" aria-label={`新增二级任务 ${row.taskName}`} icon={<PlusOutlined />} disabled={!canMaintain || maxDepth < 2} onClick={() => handleAddChildTask(row.id)} />
            </Tooltip>
          )}
          <Popconfirm title={tasks.some(task => task.parentId === row.id) ? '删除一级任务将同时删除其下所有二级任务，是否继续？' : '确认删除该任务？'} onConfirm={() => handleDeleteTask(row.id)}>
            <Tooltip title="删除任务">
              <Button type="text" danger size="small" aria-label={`删除任务 ${row.taskName}`} icon={<DeleteOutlined />} disabled={!canMaintain} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]
  const visibleKeys = new Set(instance?.columnSettings.visible || Object.keys(COLUMN_LABELS))
  const columnOrder = instance?.columnSettings.order || Object.keys(COLUMN_LABELS)
  const columns = baseColumns
    .filter(column => column.key === 'actions' ? canMaintain : visibleKeys.has(String(column.key)))
    .sort((left, right) => {
      const index = (key: unknown) => key === 'actions' ? Number.MAX_SAFE_INTEGER : columnOrder.indexOf(String(key))
      return index(left.key) - index(right.key)
    })
  const verticalTableScrollX = columns.reduce((total, column) => (
    total + (typeof column.width === 'number' ? column.width : 140)
  ), 0)

  const exportHorizontalPlan = () => {
    const groups = buildPlanHorizontalStageGroups(
      filteredTasks.map(task => ({ ...task })),
    )
    const milestoneTasks = groups.flatMap(group => group.milestones.length ? group.milestones : [group.stage])
    const headerMatrix: (string | null)[][] = [
      ['版本', '开发周期', ...groups.flatMap(group => [group.stage.taskName, ...Array(Math.max(0, group.colSpan - 1)).fill(null)])],
      [null, null, ...milestoneTasks.map(task => task.taskName)],
    ]
    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
    ]
    let columnIndex = 2
    groups.forEach(group => {
      if (group.colSpan > 1) merges.push({ s: { r: 0, c: columnIndex }, e: { r: 0, c: columnIndex + group.colSpan - 1 } })
      columnIndex += group.colSpan
    })
    const rows = buildTechnicalHorizontalRows(visibleVersions, currentVersion?.id || '').map(row => [
      row.versionNo,
      row.cycleDays == null ? '-' : `${row.cycleDays}天`,
      ...milestoneTasks.map(task => row.endDatesByTaskId[task.id] || '-'),
    ])
    exportMergedSheet(
      headerMatrix,
      merges,
      rows,
      [12, 12, ...milestoneTasks.map(() => 15)],
      `${tab?.label || '技术计划'}_横版_${exportTimestamp()}.xlsx`,
      '横版计划',
    )
  }

  const exportPlan = (mode: 'current' | 'all') => {
    if (!canExport) { message.error('无计划导出权限'); return }
    if (mode === 'current' && viewMode === 'horizontal') {
      exportHorizontalPlan()
      return
    }
    const exportRows = mode === 'current' ? filteredTasks : tasks
    const exportColumns = TECHNICAL_PLAN_EXPORT_COLUMNS.filter(column => (
      mode === 'all' || column.key === 'id' || column.key === 'parentId' || visibleKeys.has(column.key)
    ))
    exportSheet(exportRows, exportColumns, `${tab?.label || '技术计划'}_${currentVersion?.versionNo || ''}_${exportTimestamp()}.xlsx`, '计划')
  }
  const importWorkbook = async (file: File) => {
    if (!canImport || !canMaintain) { message.error(!canImport ? '无计划导入权限' : '仅修订中版本可导入'); return false }
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
      const imported = parseTechnicalPlanImportRows(rows, tasks.length ? tasks : templateTasks)
      validateTechnicalTemplateDepth(tab?.templateKind || 'tdt', imported)
      const result = updateCurrentTasks(scope, imported, maxDepth)
      if (!result.ok) throw new Error('maxDepth')
      message.success('计划已导入')
    } catch (error) {
      const reason = error instanceof Error ? error.message : ''
      if (reason.includes('duplicate-id')) message.error('导入失败：任务 ID 不可重复')
      else if (reason.includes('missing-id')) message.error('导入失败：任务 ID 不能为空；旧模板无 ID 列时需与当前计划逐行对应')
      else message.error('导入失败，请检查文件层级与字段')
    }
    return false
  }

  const compareRows = useMemo(() => {
    if (!instance || !hasCompared || !compareBaseId || !compareTargetId) return []
    const left = visibleVersions.find(version => version.id === compareBaseId)
    const right = visibleVersions.find(version => version.id === compareTargetId)
    return left && right ? compareVersionsForTable(left.tasks as any, right.tasks as any) : []
  }, [compareBaseId, compareTargetId, hasCompared, instance, visibleVersions])

  const openVersionCompare = () => {
    const base = visibleVersions.find(version => version.status === '已发布') || visibleVersions[0]
    const target = currentVersion || visibleVersions[visibleVersions.length - 1]
    setCompareBaseId(base?.id || '')
    setCompareTargetId(target?.id || '')
    setHasCompared(false)
    setCompareOpen(true)
  }

  const handleShare = () => {
    if (!canViewTechnicalPlan || !canShareTechnicalPlan) return
    if (!publishedVersions.length) { message.warning('暂无已发布版本可分享'); return }
    const query = new URLSearchParams({ technical: '1', kind: scope.kind, projectId: scope.parentProjectId })
    if (scope.kind === 'subproject') query.set('subprojectId', scope.subprojectId)
    const url = `${window.location.origin}/share/plan?${query.toString()}`
    navigator.clipboard.writeText(url)
      .then(() => message.success('分享链接已复制到剪贴板'))
      .catch(() => message.error('复制失败，请重试'))
  }

  const commitTechnicalFilters = (next: FilterCondition[]) => {
    setTempFilters(next)
    setFilters(normalizeFilterConditions(next, TECHNICAL_FILTER_FIELDS))
  }

  const updateTechnicalFilter = (id: string, patch: Partial<FilterCondition>) => {
    commitTechnicalFilters(tempFilters.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  return (
    <div className="technical-project-space pms-plan-workspace" aria-label="技术项目计划">
      <PlanWorkspaceShell
        scopeTabs={(
          <Card className="technical-space-card technical-plan-scope-card pms-glass-surface" aria-label={FIXED_TDT_LABEL} styles={{ body: { padding: '4px 16px 12px' } }}>
            <Row justify="space-between" align="middle" wrap={false}>
              <Tabs
                activeKey={tab?.key}
                onChange={handleScopeChange}
                items={tabs.map(item => ({
                  key: item.key,
                  label: (
                    <Space size={5}>
                      <span>{item.label}</span>
                      {item.subproject && (
                        <Tooltip title="子项目信息配置">
                          <Button
                            type="text"
                            size="small"
                            aria-label={`配置子项目 ${item.subproject.name}`}
                            icon={<SettingOutlined />}
                            onClick={event => {
                              event.preventDefault()
                              event.stopPropagation()
                              setConfigTrigger(event.currentTarget)
                              setConfiguringChild(item.subproject!)
                            }}
                          />
                        </Tooltip>
                      )}
                    </Space>
                  ),
                }))}
              />
            </Row>
          </Card>
        )}
        notices={(
          <>
            {readOnlyReason && <Alert showIcon type={tab?.subproject?.active ? 'warning' : 'info'} message={readOnlyReason} style={{ marginBottom: 12 }} />}
            {!canViewTechnicalPlan && <Alert showIcon type="warning" message="当前账号无技术项目一级计划查看权限" style={{ marginBottom: 12 }} />}
            {canViewTechnicalPlan && !readOnlyReason && !canEdit && <Alert showIcon type="info" message="当前账号无计划编辑权限，仅可查看计划" style={{ marginBottom: 12 }} />}
            {canMaintain && viewMode === 'vertical' && (
              <div className="technical-plan-edit-notice" role="status">
                <EditOutlined />
                <strong>编辑模式</strong>
                <span>- 拖拽手柄排序，点击单元格编辑，修改内容自动保存</span>
              </div>
            )}
          </>
        )}
        versionControls={(
          <Space size={6}>
            <Text type="secondary">版本</Text>
            <Select
              aria-label="计划版本"
              style={{ width: 150 }}
              value={currentVersion?.id}
              placeholder="暂无版本"
              onChange={handleVersionChange}
              options={visibleVersions.map(version => ({ value: version.id, label: `${version.versionNo}${version.status === '修订中' ? '（修订中）' : ''}` }))}
            />
            {isDraft && viewMode === 'vertical' && <Tag color="green">自动保存</Tag>}
            {isDraft && viewMode !== 'vertical' && <Tag>{viewMode === 'gantt' ? '甘特图只读' : '横版只读'}</Tag>}
          </Space>
        )}
        primaryActions={(
          <Space size={6}>
            {!hasDraft && (
              <Tooltip title={!canEditTechnicalPlan ? '无计划编辑权限' : readOnlyReason}>
                <Dropdown
                  menu={{ items: PLAN_REVISION_KIND_OPTIONS, onClick: handleCreateRevisionMenuClick }}
                  trigger={['click']}
                  placement="bottomLeft"
                  disabled={!canEditTechnicalPlan || Boolean(readOnlyReason)}
                >
                  <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} disabled={!canEditTechnicalPlan || Boolean(readOnlyReason)} aria-label="创建修订">创建修订</Button>
                </Dropdown>
              </Tooltip>
            )}
            {isDraft && (
              <Tooltip title={!canMaintain ? readOnlyReason || '无计划编辑权限' : !publishedVersions.length ? '暂无已发布版本' : '计划克隆'}>
                <Button icon={<CopyOutlined />} style={{ borderRadius: 6 }} disabled={!canMaintain || !publishedVersions.length} onClick={handleClonePlan} aria-label="计划克隆" />
              </Tooltip>
            )}
            {isDraft && (
              <Tooltip title={!canPublish ? '无计划发布权限' : !canMaintain ? readOnlyReason : '发布'}>
                <Button type="primary" icon={<SaveOutlined />} style={{ borderRadius: 6 }} disabled={!canPublish || !canMaintain} onClick={handlePublish} aria-label="发布" />
              </Tooltip>
            )}
            {isDraft && (
              <Popconfirm title="确认取消当前修订？" onConfirm={() => { if (cancelRevision(scope).ok) message.success('已取消修订') }}>
                <Tooltip title={!canMaintain ? readOnlyReason || '无计划编辑权限' : '取消修订'}>
                  <Button danger icon={<StopOutlined />} style={{ borderRadius: 6 }} disabled={!canMaintain} aria-label="取消修订" />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        )}
        utilityActions={(
          <Space size={6}>
            <FloatingFilterPanel
              open={filterOpen}
              title="计划筛选"
              trigger={(
                <Tooltip title="筛选">
                  <Badge dot={filters.some(isFilterConditionActive)} offset={[-2, 2]}>
                    <Button
                      icon={<FilterOutlined />}
                      style={{ borderRadius: 6 }}
                      onClick={() => {
                        setColumnsOpen(false)
                        setTempFilters(filters.length ? filters.map(item => ({ ...item })) : [createFilterCondition()])
                        setFilterOpen(true)
                      }}
                      aria-label="筛选"
                    />
                  </Badge>
                </Tooltip>
              )}
              onReset={() => commitTechnicalFilters([createFilterCondition()])}
              onAdd={() => commitTechnicalFilters([...tempFilters, createFilterCondition()])}
              addDisabled={tempFilters.length >= TECHNICAL_FILTER_FIELDS.length}
              onClose={() => setFilterOpen(false)}
            >
              <div className="pms-filter-condition-list technical-plan-filter-list">
                {tempFilters.map(condition => {
                  const definition = TECHNICAL_FILTER_FIELDS.find(item => item.key === condition.field)
                  return (
                    <div key={condition.id} className="pms-filter-condition-row technical-plan-filter-row">
                      <Select
                        aria-label="筛选字段"
                        placeholder="筛选字段"
                        value={condition.field || undefined}
                        options={getFieldOptionsWithDuplicateDisabled(
                          TECHNICAL_FILTER_FIELDS.map(field => ({ value: field.key, label: field.label })),
                          tempFilters,
                          condition.id,
                        )}
                        onChange={field => updateTechnicalFilter(condition.id, { field, operator: 'equals', value: '' })}
                      />
                      <Select
                        aria-label="筛选条件"
                        value={condition.operator}
                        options={getFilterOperatorsForKind(definition?.kind || 'text') as any}
                        onChange={(operator: FilterOperator) => updateTechnicalFilter(condition.id, { operator, value: isValuelessFilterOperator(operator) ? '' : condition.value })}
                      />
                      {!isValuelessFilterOperator(condition.operator) && definition?.kind === 'enum' ? (
                        <Select
                          aria-label="筛选值"
                          placeholder="请选择"
                          allowClear
                          value={condition.value || undefined}
                          options={definition.options}
                          onChange={value => updateTechnicalFilter(condition.id, { value: value || '' })}
                        />
                      ) : !isValuelessFilterOperator(condition.operator) ? (
                        <Input
                          aria-label="筛选值"
                          placeholder={definition?.kind === 'date' ? 'YYYY-MM-DD' : '输入筛选值'}
                          value={condition.value}
                          onChange={event => updateTechnicalFilter(condition.id, { value: event.target.value })}
                        />
                      ) : <span className="pms-filter-value-placeholder" aria-hidden />}
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        aria-label="删除筛选条件"
                        onClick={() => {
                          const remaining = tempFilters.filter(item => item.id !== condition.id)
                          commitTechnicalFilters(remaining.length ? remaining : [createFilterCondition()])
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              </FloatingFilterPanel>
            <Dropdown
              menu={{ items: [{ key: 'current', label: '导出当前视图' }, { key: 'all', label: '导出全部' }], onClick: ({ key }) => exportPlan(key as 'current' | 'all') }}
              disabled={!canExport || !tasks.length}
            >
              <Tooltip title={!canExport ? '无计划导出权限' : '导出为 Excel'}>
                <Button icon={<DownloadOutlined />} style={{ borderRadius: 6 }} disabled={!canExport || !tasks.length} aria-label="导出" />
              </Tooltip>
            </Dropdown>
            {viewMode === 'vertical' && (
              <SortableColumnSettings
                open={columnsOpen}
                trigger={(
                  <Tooltip title="字段配置">
                    <Button icon={<SettingOutlined />} style={{ borderRadius: 6 }} disabled={!instance} onClick={() => { setFilterOpen(false); setColumnsOpen(true) }} aria-label="字段配置" />
                  </Tooltip>
                )}
                definitions={TECHNICAL_COLUMN_DEFINITIONS}
                value={instance?.columnSettings || { order: Object.keys(COLUMN_LABELS), visible: Object.keys(COLUMN_LABELS) }}
                onApply={value => { setColumns(scope, value); setColumnsOpen(false); message.success('字段配置已保存') }}
                onCancel={() => setColumnsOpen(false)}
              />
            )}
            <Tooltip title="全部展开"><Button icon={<PlusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={expandAll} aria-label="全部展开" /></Tooltip>
            <Tooltip title="全部收起"><Button icon={<MinusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={collapseAll} aria-label="全部收起" /></Tooltip>
            <Tooltip title="版本对比"><Button aria-label="版本对比" icon={<HistoryOutlined />} style={{ borderRadius: 6 }} disabled={visibleVersions.length < 2} onClick={openVersionCompare} /></Tooltip>
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={importWorkbook} disabled={!canImport || !canMaintain}>
              <Tooltip title={!canImport ? '无计划导入权限' : !canMaintain ? readOnlyReason || '仅修订中版本可导入' : '导入'}>
                <Button icon={<UploadOutlined />} style={{ borderRadius: 6 }} disabled={!canImport || !canMaintain} aria-label="导入" />
              </Tooltip>
            </Upload>
            <Tooltip title={!canViewTechnicalPlan ? '无技术项目一级计划查看权限' : !canShareTechnicalPlan ? '无技术项目一级计划分享权限' : publishedVersions.length ? '复制精确作用域分享链接' : '暂无已发布版本'}>
              <Button icon={<ShareAltOutlined />} style={{ borderRadius: 6 }} disabled={!canViewTechnicalPlan || !canShareTechnicalPlan || !publishedVersions.length} onClick={handleShare} aria-label="分享计划" />
            </Tooltip>
          </Space>
        )}
        viewMode={viewMode}
        onViewModeChange={nextViewMode => { setFilterOpen(false); setColumnsOpen(false); setViewMode(nextViewMode) }}
      >
        {!currentVersion ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划版本，请创建修订" />
        ) : viewMode === 'vertical' ? (
          <div className="technical-plan-vertical-table-shell pms-solid-surface">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                <Table<TechnicalTemplateTask>
                  className={`pms-table technical-plan-vertical-table ${canMaintain ? 'pms-table-edit' : ''}`}
                  tableLayout="fixed"
                  rowKey="id"
                  size="middle"
                  pagination={false}
                  scroll={{ x: verticalTableScrollX }}
                  dataSource={visibleTasks}
                  columns={columns}
                  components={canDrag ? { body: { row: SortableRow } } : undefined}
                  rowClassName={row => row.parentId ? 'technical-plan-child-row' : 'technical-plan-phase-row'}
                />
              </SortableContext>
            </DndContext>
            {canEditTaskStructure && (
              <div className="technical-plan-add-task">
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddTopLevelTask}>添加新活动</Button>
              </div>
            )}
          </div>
        ) : viewMode === 'horizontal' ? (
          <TechnicalHorizontalPlanTable tasks={filteredTasks} versions={visibleVersions} currentVersionId={currentVersion.id} />
        ) : viewMode === 'gantt' ? (
          <DHTMLXGantt
            tasks={filteredTasks}
            readOnly
            collapsedIds={collapsedIds}
            onCollapsedChange={updater => setCollapsed(scope, [...updater(collapsedIds)])}
          />
        ) : null}
      </PlanWorkspaceShell>

      <PlanVersionCompareModal
        open={compareOpen}
        rows={compareRows}
        versions={visibleVersions.map(version => ({ id: version.id, versionNo: version.versionNo, status: version.status }))}
        baseVersionId={compareBaseId}
        targetVersionId={compareTargetId}
        onBaseVersionChange={value => { setCompareBaseId(value); setHasCompared(false) }}
        onTargetVersionChange={value => { setCompareTargetId(value); setHasCompared(false) }}
        onCompare={() => setHasCompared(true)}
        onCancel={() => { setCompareOpen(false); setHasCompared(false) }}
      />
      <SubprojectConfigModal open={Boolean(configuringChild)} subproject={configuringChild} currentLoginUser={currentLoginUser} returnFocusTo={configTrigger} onCancel={() => setConfiguringChild(null)} />
    </div>
  )
}
