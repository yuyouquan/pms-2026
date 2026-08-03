'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Badge, Button, Card, DatePicker, Dropdown, Empty, Input, Popconfirm,
  Row, Select, Space, Switch, Table, Tabs, Tag, Tooltip, Typography, Upload, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined, DownloadOutlined, HistoryOutlined, PlusOutlined, SaveOutlined,
  FilterOutlined, MinusSquareOutlined, PlusSquareOutlined, SettingOutlined, ShareAltOutlined,
  StopOutlined, UploadOutlined,
} from '@ant-design/icons'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
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
import { compareVersionsForTable } from '@/lib/versionCompare'
import { getTemplateSnapshotForProjectType } from '@/lib/projectTemplateCompatibility'
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
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
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

const COLUMN_LABELS: Record<string, string> = {
  taskName: '任务名称', responsible: '责任人', predecessor: '前置任务',
  planStartDate: '计划开始', planEndDate: '计划完成', estimatedDays: '预估工期',
  actualStartDate: '实际开始', actualEndDate: '实际完成', actualDays: '实际工期',
  status: '状态', progress: '进度',
}
const TECHNICAL_COLUMN_DEFINITIONS: readonly SortableColumnDefinition<string>[] = Object.entries(COLUMN_LABELS).map(([key, title]) => ({
  key, title, defaultVisible: true, hideable: key !== 'taskName', fixed: key === 'taskName' ? 'left' : undefined,
}))
const DEFAULT_MAX_DEPTH: Readonly<Record<TechnicalTemplateKind, number>> = { tdt: 2, subproject: 1 }
const TECHNICAL_FILTER_FIELDS: readonly FilterFieldDefinition[] = [
  { key: 'taskName', label: '任务名称', kind: 'text' },
  { key: 'responsible', label: '责任人', kind: 'text' },
  { key: 'predecessor', label: '前置任务', kind: 'text' },
  { key: 'planStartDate', label: '计划开始', kind: 'date' },
  { key: 'planEndDate', label: '计划完成', kind: 'date' },
  { key: 'actualStartDate', label: '实际开始', kind: 'date' },
  { key: 'actualEndDate', label: '实际完成', kind: 'date' },
  { key: 'status', label: '状态', kind: 'enum', options: ['未开始', '进行中', '已完成'].map(value => ({ label: value, value })) },
]

function TechnicalHorizontalPlanTable({
  tasks,
  versions,
}: {
  tasks: readonly TechnicalTemplateTask[]
  versions: readonly { id: string; versionNo: string; status: string; tasks: TechnicalTemplateTask[] }[]
}) {
  const groups = buildPlanHorizontalStageGroups(
    tasks as readonly (TechnicalTemplateTask & Record<string, unknown>)[],
  )
  if (!groups.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无横版计划数据" />
  const columns: ColumnsType<(typeof versions)[number]> = [
    {
      key: 'versionNo', title: '版本', dataIndex: 'versionNo', width: 100, fixed: 'left',
      render: (value, row) => <Space size={4}><strong>{value}</strong>{row.status === '修订中' && <Tag color="green">修订中</Tag>}</Space>,
    },
    ...groups.map(group => ({
      key: group.stage.id,
      title: group.stage.taskName,
      children: (group.milestones.length ? group.milestones : [group.stage]).map(milestone => ({
        key: milestone.id,
        title: milestone.taskName,
        width: 136,
        align: 'center' as const,
        render: (_: unknown, version: (typeof versions)[number]) => {
          const versionTask = version.tasks.find(task => task.id === milestone.id)
          return versionTask?.planEndDate || versionTask?.planStartDate || '-'
        },
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
      dataSource={[...versions]}
      scroll={{ x: Math.max(960, groups.reduce((total, group) => total + group.colSpan * 136, 100)) }}
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
  projectId, currentLoginUser, canEdit, canPublish, canImport, canExport,
  maxDepthByKind = DEFAULT_MAX_DEPTH,
}: TechnicalPlanModuleProps) {
  const [showInactive, setShowInactive] = useState(false)
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
  const clonePublishedVersion = useTechnicalPlanStore(state => state.clonePublishedVersion)
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
    () => buildTechnicalPlanTabs(projectId, subprojects, showInactive),
    [projectId, showInactive, subprojects],
  )
  useEffect(() => {
    const firstKey = `${projectId}:tdt`
    setActiveKey(current => tabs.some(tab => tab.key === current) ? current : firstKey)
  }, [projectId, tabs])
  const tab = tabs.find(item => item.key === activeKey) || tabs[0]
  const scope = tab?.scope || { kind: 'tdt' as const, parentProjectId: projectId }
  const instance = plansByKey[getTechnicalPlanKey(scope)]
  const currentVersion = instance?.versions.find(version => version.id === instance.currentVersionId) || instance?.versions[0]
  const tasks = currentVersion?.tasks || []
  const isDraft = currentVersion?.status === '修订中'
  const readOnlyReason = tab?.subproject && !tab.subproject.active
    ? '已停用子项目仅可查看历史计划'
    : tab?.subproject && (!tab.subproject.configuration.coreValue || !tab.subproject.configuration.developmentMode)
      ? '请先完成子项目信息配置'
      : ''
  const canMaintain = canEdit && isDraft && !readOnlyReason
  const templateTasks = latestPublishedTemplate(
    tab?.templateKind || 'tdt', configTemplateVersionScopes, publishedSnapshots,
    configTemplateTasksByType[TECHNICAL_TEMPLATE_STORAGE_KEYS[tab?.templateKind || 'tdt']] || [],
  )
  const maxDepth = Math.min(maxDepthByKind[tab?.templateKind || 'tdt'], tab?.templateKind === 'subproject' ? 1 : 2)
  const invalid = getInvalidTechnicalTaskFields(tasks)
  const collapsedIds = useMemo(() => new Set(instance?.collapsedRows || []), [instance?.collapsedRows])
  const filteredTasks = useMemo(
    () => applyPlanWorkspaceFilters(tasks, filters, TECHNICAL_FILTER_FIELDS),
    [filters, tasks],
  )
  const visibleTasks = useMemo(
    () => filterPlanTasksByCollapsed(filteredTasks, collapsedIds),
    [collapsedIds, filteredTasks],
  )
  const publishedVersions = useMemo(
    () => (instance?.versions || []).filter(version => version.status === '已发布'),
    [instance?.versions],
  )
  const hasDraft = Boolean(instance?.versions.some(version => version.status === '修订中'))

  useEffect(() => {
    setIsEditMode(Boolean(canMaintain))
  }, [canMaintain, setIsEditMode])
  useEffect(() => () => setIsEditMode(false), [setIsEditMode])

  useEffect(() => {
    setFilters([])
    setTempFilters([createFilterCondition()])
    setViewMode('vertical')
    setCompareOpen(false)
    setHasCompared(false)
  }, [activeKey])

  const handleCreateRevision = () => {
    if (!tab || !canEdit) return
    const result = createRevision({ scope: tab.scope, templateKind: tab.templateKind, maxDepth, templateTasks, subproject: tab.subproject })
    if (!result.ok) {
      message.warning(result.reason === 'draft-exists' ? '当前计划已有修订版' : readOnlyReason || '当前子项目不可创建修订')
      return
    }
    message.success(`已创建 ${result.versionId.replace('-draft', '')} 修订`)
  }

  const handleClonePlan = () => {
    if (!tab || !canEdit || readOnlyReason || hasDraft) return
    const source = currentVersion?.status === '已发布'
      ? currentVersion
      : [...publishedVersions].sort((left, right) => right.versionNo.localeCompare(left.versionNo, undefined, { numeric: true }))[0]
    if (!source) { message.warning('暂无可克隆的已发布版本'); return }
    const result = clonePublishedVersion({ scope: tab.scope, sourceVersionId: source.id, subproject: tab.subproject })
    if (result.ok) { message.success(`已克隆为 ${result.versionId.replace('-draft', '')} 修订`); return }
    const reasons = {
      'draft-exists': '当前计划已有修订版', inactive: '已停用子项目不可创建修订',
      'incomplete-configuration': '请先完成子项目信息配置', 'missing-instance': '暂无可克隆计划',
      'missing-source': '请选择已发布版本进行克隆',
    }
    message.warning(reasons[result.reason])
  }

  const handlePublish = () => {
    if (!canPublish || !canMaintain) return
    if (invalid.size) { message.error('请先修复计划日期冲突'); return }
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
    if (!over || active.id === over.id || !canMaintain) return
    const oldIndex = tasks.findIndex(task => task.id === active.id)
    const newIndex = tasks.findIndex(task => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const moved = arrayMove(tasks, oldIndex, newIndex).map((task, order) => ({ ...task, order: order + 1 }))
    updateCurrentTasks(scope, moved, maxDepth)
  }

  const handleScopeChange = (nextKey: string) => {
    const nextTab = tabs.find(item => item.key === nextKey)
    const nextInstance = nextTab ? plansByKey[getTechnicalPlanKey(nextTab.scope)] : undefined
    const nextVersion = nextInstance?.versions.find(version => version.id === nextInstance.currentVersionId)
    navigateWithEditGuard(() => setActiveKey(nextKey), nextVersion?.status === '修订中')
  }

  const handleVersionChange = (versionId: string) => {
    const nextVersion = instance?.versions.find(version => version.id === versionId)
    navigateWithEditGuard(() => setCurrentVersion(scope, versionId), nextVersion?.status === '修订中')
  }

  const expandAll = () => setCollapsed(scope, [])
  const collapseAll = () => setCollapsed(scope, filteredTasks.filter(task => !task.parentId).map(task => task.id))

  const baseColumns: ColumnsType<TechnicalTemplateTask> = [
    { key: 'drag', width: 42, render: () => canMaintain ? <DragHandle /> : null },
    { key: 'taskName', title: '任务名称', dataIndex: 'taskName', width: 230, render: (value, row) => canMaintain ? <Input value={value} onChange={event => updateTask(row.id, { taskName: event.target.value })} /> : <Space size={8}><span style={{ paddingLeft: row.parentId ? 20 : 0 }}>{value}</span>{!row.parentId && <Tag color="geekblue">阶段</Tag>}</Space> },
    { key: 'responsible', title: '责任人', dataIndex: 'responsible', width: 130, render: (value, row) => canMaintain ? <Input value={value} onChange={event => updateTask(row.id, { responsible: event.target.value })} /> : value || '-' },
    { key: 'predecessor', title: '前置任务', dataIndex: 'predecessor', width: 120, render: (value, row) => canMaintain ? <Input value={value} onChange={event => updateTask(row.id, { predecessor: event.target.value })} /> : value || '-' },
    { key: 'planStartDate', title: '计划开始', dataIndex: 'planStartDate', width: 145, onCell: row => ({ className: invalid.get(row.id)?.start ? 'pms-cell-invalid' : '' }), render: (value, row) => canMaintain ? <Tooltip title={invalid.get(row.id)?.start?.join('；')}><DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { planStartDate: date?.format('YYYY-MM-DD') || '' })} /></Tooltip> : value || '-' },
    { key: 'planEndDate', title: '计划完成', dataIndex: 'planEndDate', width: 145, onCell: row => ({ className: invalid.get(row.id)?.end ? 'pms-cell-invalid' : '' }), render: (value, row) => canMaintain ? <Tooltip title={invalid.get(row.id)?.end?.join('；')}><DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { planEndDate: date?.format('YYYY-MM-DD') || '' })} /></Tooltip> : value || '-' },
    { key: 'estimatedDays', title: '预估工期', dataIndex: 'estimatedDays', width: 100, render: (value, row) => canMaintain ? <Input type="number" min={0} value={value} onChange={event => updateTask(row.id, { estimatedDays: Number(event.target.value) || 0 })} /> : `${value || 0}天` },
    { key: 'actualStartDate', title: '实际开始', dataIndex: 'actualStartDate', width: 145, render: (value, row) => canMaintain ? <DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { actualStartDate: date?.format('YYYY-MM-DD') || '' })} /> : value || '-' },
    { key: 'actualEndDate', title: '实际完成', dataIndex: 'actualEndDate', width: 145, render: (value, row) => canMaintain ? <DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { actualEndDate: date?.format('YYYY-MM-DD') || '' })} /> : value || '-' },
    { key: 'actualDays', title: '实际工期', dataIndex: 'actualDays', width: 100, render: (value, row) => canMaintain ? <Input type="number" min={0} value={value} onChange={event => updateTask(row.id, { actualDays: Number(event.target.value) || 0 })} /> : `${value || 0}天` },
    { key: 'status', title: '状态', dataIndex: 'status', width: 105, render: (value, row) => canMaintain ? <Select value={value} style={{ width: 96 }} options={['未开始', '进行中', '已完成'].map(status => ({ label: status, value: status }))} onChange={status => updateTask(row.id, { status })} /> : <Tag color={value === '已完成' ? 'success' : value === '进行中' ? 'processing' : 'default'}>{value}</Tag> },
    { key: 'progress', title: '进度', dataIndex: 'progress', width: 100, render: (value, row) => canMaintain ? <Input type="number" min={0} max={100} value={value} suffix="%" onChange={event => updateTask(row.id, { progress: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /> : `${value || 0}%` },
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
  const columnOrder = ['drag', ...(instance?.columnSettings.order || Object.keys(COLUMN_LABELS))]
  const columns = baseColumns
    .filter(column => column.key === 'drag' || column.key === 'actions' || visibleKeys.has(String(column.key)))
    .sort((left, right) => {
      const index = (key: unknown) => key === 'actions' ? Number.MAX_SAFE_INTEGER : columnOrder.indexOf(String(key))
      return index(left.key) - index(right.key)
    })

  const exportPlan = (mode: 'current' | 'all') => {
    if (!canExport) { message.error('无计划导出权限'); return }
    const exportRows = mode === 'current' ? filteredTasks : tasks
    const exportColumns = Object.entries(COLUMN_LABELS)
      .filter(([key]) => mode === 'all' || visibleKeys.has(key))
      .map(([key, title]) => ({ key, title }))
    exportSheet(exportRows, exportColumns, `${tab?.label || '技术计划'}_${currentVersion?.versionNo || ''}_${exportTimestamp()}.xlsx`, '计划')
  }
  const importWorkbook = async (file: File) => {
    if (!canImport || !canMaintain) { message.error(!canImport ? '无计划导入权限' : '仅修订中版本可导入'); return false }
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
      const imported = rows.map((row, index) => ({
        ...(tasks[index] || templateTasks[index] || {}), id: String(row.ID || row.id || tasks[index]?.id || `import-${index + 1}`), order: index + 1,
        taskName: String(row['任务名称'] || row.taskName || ''), responsible: String(row['责任人'] || row.responsible || ''),
        predecessor: String(row['前置任务'] || row.predecessor || ''), planStartDate: String(row['计划开始'] || row.planStartDate || ''), planEndDate: String(row['计划完成'] || row.planEndDate || ''),
      })) as TechnicalTemplateTask[]
      validateTechnicalTemplateDepth(tab?.templateKind || 'tdt', imported)
      const result = updateCurrentTasks(scope, imported, maxDepth)
      if (!result.ok) throw new Error('maxDepth')
      message.success('计划已导入')
    } catch { message.error('导入失败，请检查文件层级与字段') }
    return false
  }

  const compareRows = useMemo(() => {
    if (!instance || !hasCompared || !compareBaseId || !compareTargetId) return []
    const left = instance.versions.find(version => version.id === compareBaseId)
    const right = instance.versions.find(version => version.id === compareTargetId)
    return left && right ? compareVersionsForTable(left.tasks as any, right.tasks as any) : []
  }, [compareBaseId, compareTargetId, hasCompared, instance])

  const openVersionCompare = () => {
    const versions = instance?.versions || []
    const base = versions.find(version => version.status === '已发布') || versions[0]
    const target = currentVersion || versions[versions.length - 1]
    setCompareBaseId(base?.id || '')
    setCompareTargetId(target?.id || '')
    setHasCompared(false)
    setCompareOpen(true)
  }

  const handleShare = () => {
    if (!publishedVersions.length) { message.warning('暂无已发布版本可分享'); return }
    const query = new URLSearchParams({ technical: '1', kind: scope.kind, projectId: scope.parentProjectId })
    if (scope.kind === 'subproject') query.set('subprojectId', scope.subprojectId)
    const url = `${window.location.origin}/share/plan?${query.toString()}`
    navigator.clipboard.writeText(url)
      .then(() => message.success('分享链接已复制到剪贴板'))
      .catch(() => message.error('复制失败，请重试'))
  }

  return (
    <div className="technical-project-space" aria-label="技术项目计划">
      <PlanWorkspaceShell
        scopeTabs={(
          <Card className="technical-space-card technical-plan-scope-card" aria-label={FIXED_TDT_LABEL} styles={{ body: { padding: '4px 16px 12px' } }}>
            <Row justify="space-between" align="middle" wrap={false}>
              <Tabs
                activeKey={tab?.key}
                onChange={handleScopeChange}
                items={tabs.map(item => ({
                  key: item.key,
                  label: (
                    <Space size={5}>
                      <span>{item.label}</span>
                      {item.subproject && !item.subproject.active && <Tag>已停用</Tag>}
                      {item.subproject?.active && (
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
              <Space size={8}>
                <Text type="secondary">显示已停用</Text>
                <Switch checked={showInactive} onChange={setShowInactive} aria-label="显示已停用子项目计划" />
              </Space>
            </Row>
          </Card>
        )}
        notices={(
          <>
            {readOnlyReason && <Alert showIcon type={tab?.subproject?.active ? 'warning' : 'info'} message={readOnlyReason} style={{ marginBottom: 12 }} />}
            {!readOnlyReason && !canEdit && <Alert showIcon type="info" message="当前账号无计划编辑权限，仅可查看计划" style={{ marginBottom: 12 }} />}
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
              options={(instance?.versions || []).map(version => ({ value: version.id, label: `${version.versionNo}${version.status === '修订中' ? '（修订中）' : ''}` }))}
            />
            {isDraft && <Tag color="green">自动保存</Tag>}
          </Space>
        )}
        primaryActions={(
          <Space size={6}>
            {!hasDraft && (
              <Tooltip title={!canEdit ? '无计划编辑权限' : readOnlyReason}>
                <Button type="primary" icon={<PlusOutlined />} disabled={!canEdit || Boolean(readOnlyReason)} onClick={handleCreateRevision} aria-label="创建修订">创建修订</Button>
              </Tooltip>
            )}
            <Tooltip title={!canEdit ? '无计划编辑权限' : readOnlyReason || (!publishedVersions.length ? '暂无已发布版本' : '计划克隆')}>
              <Button
                icon={<PlusOutlined />}
                disabled={!canEdit || Boolean(readOnlyReason) || hasDraft || !publishedVersions.length}
                onClick={handleClonePlan}
                aria-label="计划克隆"
              >
                计划克隆
              </Button>
            </Tooltip>
            {isDraft && (
              <Tooltip title={!canPublish ? '无计划发布权限' : !canMaintain ? readOnlyReason : '发布'}>
                <Button type="primary" icon={<SaveOutlined />} disabled={!canPublish || !canMaintain} onClick={handlePublish} aria-label="发布">发布</Button>
              </Tooltip>
            )}
            {isDraft && (
              <Popconfirm title="确认取消当前修订？" onConfirm={() => { if (cancelRevision(scope).ok) message.success('已取消修订') }}>
                <Tooltip title={!canMaintain ? readOnlyReason || '无计划编辑权限' : '取消修订'}>
                  <Button danger icon={<StopOutlined />} disabled={!canMaintain} aria-label="取消修订">取消修订</Button>
                </Tooltip>
              </Popconfirm>
            )}
            <Tooltip title={!canMaintain ? readOnlyReason || '仅修订中版本可新增任务' : '新增一级任务'}>
              <Button icon={<PlusOutlined />} disabled={!canMaintain} onClick={handleAddTopLevelTask}>新增一级任务</Button>
            </Tooltip>
          </Space>
        )}
        utilityActions={(
          <Space size={6}>
            <FloatingFilterPanel
              open={filterOpen}
              trigger={(
                <Tooltip title="筛选">
                  <Badge dot={filters.some(isFilterConditionActive)} offset={[-2, 2]}>
                    <Button
                      icon={<FilterOutlined />}
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
              onReset={() => setTempFilters([createFilterCondition()])}
              onClear={() => setTempFilters([createFilterCondition()])}
              onCancel={() => setFilterOpen(false)}
              onConfirm={() => {
                setFilters(normalizeFilterConditions(tempFilters, TECHNICAL_FILTER_FIELDS))
                setFilterOpen(false)
              }}
            >
              <div className="technical-plan-filter-list">
                {tempFilters.map(condition => {
                  const definition = TECHNICAL_FILTER_FIELDS.find(item => item.key === condition.field)
                  return (
                    <div key={condition.id} className="technical-plan-filter-row">
                      <Select
                        aria-label="筛选字段"
                        placeholder="筛选字段"
                        value={condition.field || undefined}
                        options={getFieldOptionsWithDuplicateDisabled(
                          TECHNICAL_FILTER_FIELDS.map(field => ({ value: field.key, label: field.label })),
                          tempFilters,
                          condition.id,
                        )}
                        onChange={field => setTempFilters(current => current.map(item => item.id === condition.id ? { ...item, field, operator: 'equals', value: '' } : item))}
                      />
                      <Select
                        aria-label="筛选条件"
                        value={condition.operator}
                        options={getFilterOperatorsForKind(definition?.kind || 'text') as any}
                        onChange={(operator: FilterOperator) => setTempFilters(current => current.map(item => item.id === condition.id ? { ...item, operator, value: isValuelessFilterOperator(operator) ? '' : item.value } : item))}
                      />
                      {!isValuelessFilterOperator(condition.operator) && definition?.kind === 'enum' ? (
                        <Select
                          aria-label="筛选值"
                          placeholder="请选择"
                          allowClear
                          value={condition.value || undefined}
                          options={definition.options}
                          onChange={value => setTempFilters(current => current.map(item => item.id === condition.id ? { ...item, value: value || '' } : item))}
                        />
                      ) : !isValuelessFilterOperator(condition.operator) ? (
                        <Input
                          aria-label="筛选值"
                          placeholder={definition?.kind === 'date' ? 'YYYY-MM-DD' : '输入筛选值'}
                          value={condition.value}
                          onChange={event => setTempFilters(current => current.map(item => item.id === condition.id ? { ...item, value: event.target.value } : item))}
                        />
                      ) : <span />}
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        aria-label="删除筛选条件"
                        onClick={() => setTempFilters(current => current.length > 1 ? current.filter(item => item.id !== condition.id) : [createFilterCondition()])}
                      />
                    </div>
                  )
                })}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => setTempFilters(current => [...current, createFilterCondition()])}>添加条件</Button>
              </div>
            </FloatingFilterPanel>
            {viewMode === 'vertical' && (
              <SortableColumnSettings
                open={columnsOpen}
                trigger={(
                  <Tooltip title="列设置">
                    <Button icon={<SettingOutlined />} disabled={!instance} onClick={() => { setFilterOpen(false); setColumnsOpen(true) }} aria-label="列设置" />
                  </Tooltip>
                )}
                definitions={TECHNICAL_COLUMN_DEFINITIONS}
                value={instance?.columnSettings || { order: Object.keys(COLUMN_LABELS), visible: Object.keys(COLUMN_LABELS) }}
                onApply={value => { setColumns(scope, value); setColumnsOpen(false); message.success('列设置已保存') }}
                onCancel={() => setColumnsOpen(false)}
              />
            )}
            <Tooltip title="全部展开"><Button icon={<PlusSquareOutlined />} size="small" onClick={expandAll} aria-label="全部展开" /></Tooltip>
            <Tooltip title="全部收起"><Button icon={<MinusSquareOutlined />} size="small" onClick={collapseAll} aria-label="全部收起" /></Tooltip>
            <Tooltip title="版本对比"><Button aria-label="版本对比" icon={<HistoryOutlined />} disabled={(instance?.versions.length || 0) < 2} onClick={openVersionCompare} /></Tooltip>
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={importWorkbook} disabled={!canImport || !canMaintain}>
              <Tooltip title={!canImport ? '无计划导入权限' : !canMaintain ? readOnlyReason || '仅修订中版本可导入' : '导入'}>
                <Button icon={<UploadOutlined />} disabled={!canImport || !canMaintain} aria-label="导入">导入</Button>
              </Tooltip>
            </Upload>
            <Dropdown
              menu={{ items: [{ key: 'current', label: '导出当前视图' }, { key: 'all', label: '导出全部' }], onClick: ({ key }) => exportPlan(key as 'current' | 'all') }}
              disabled={!canExport || !tasks.length}
            >
              <Tooltip title={!canExport ? '无计划导出权限' : '导出为 Excel'}>
                <Button icon={<DownloadOutlined />} disabled={!canExport || !tasks.length} aria-label="导出" />
              </Tooltip>
            </Dropdown>
            <Tooltip title={publishedVersions.length ? '复制精确作用域分享链接' : '暂无已发布版本'}>
              <Button icon={<ShareAltOutlined />} disabled={!publishedVersions.length} onClick={handleShare} aria-label="分享计划" />
            </Tooltip>
          </Space>
        )}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
        {!currentVersion ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划版本，请创建修订" />
        ) : viewMode === 'vertical' ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
              <Table<TechnicalTemplateTask>
                className="pms-table"
                rowKey="id"
                size="middle"
                pagination={false}
                scroll={{ x: 1050 }}
                dataSource={visibleTasks}
                columns={columns}
                components={canMaintain ? { body: { row: SortableRow } } : undefined}
                rowClassName={row => row.parentId ? 'technical-plan-child-row' : 'technical-plan-phase-row'}
              />
            </SortableContext>
          </DndContext>
        ) : viewMode === 'horizontal' ? (
          <TechnicalHorizontalPlanTable tasks={filteredTasks} versions={instance.versions} />
        ) : viewMode === 'gantt' ? (
          <DHTMLXGantt
            tasks={filteredTasks}
            readOnly={!canMaintain}
            collapsedIds={collapsedIds}
            onCollapsedChange={updater => setCollapsed(scope, [...updater(collapsedIds)])}
          />
        ) : null}
      </PlanWorkspaceShell>

      <PlanVersionCompareModal
        open={compareOpen}
        rows={compareRows}
        versions={(instance?.versions || []).map(version => ({ id: version.id, versionNo: version.versionNo, status: version.status }))}
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
