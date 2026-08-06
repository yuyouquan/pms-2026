'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Card, Tabs, Table, Row, Col, Space, Divider, Tag, Menu, Button, Select, Segmented,
  Input, Tooltip, Modal, Form, Checkbox, message, Progress, Popconfirm,
  DatePicker, Avatar, Dropdown,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  CalendarOutlined, PlusOutlined, SaveOutlined,
  HistoryOutlined, SearchOutlined, AppstoreOutlined, EditOutlined,
  PlusSquareOutlined, MinusSquareOutlined,
  DeleteOutlined, CaretDownOutlined, StopOutlined,
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ColumnsType } from 'antd/es/table'
import { useUiStore } from '@/stores/ui'
import { usePlanStore, LEVEL2_PLAN_TYPES, LEVEL1_TEMPLATE_TASKS, VERSION_DATA, getConfigColumnsForView, getTemplateSnapshotKey } from '@/stores/plan'
import { useTransferStore } from '@/stores/transfer'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { TransferConfig } from '@/components/transfer/TransferModule'
import { PROJECT_CATEGORY_TECH, PROJECT_TEMPLATE_TYPES, getProjectTypeFamilyKey } from '@/constants/projectTypes'
import { DHTMLXGantt, DragHandle, SortableRow, DragHandleContext, ClickToEditDate, getTaskDepth, hasChildren, filterByCollapsed, getAllExpandableIds, type DHTMLXGanttColumn } from '@/components/shared/PlanHelpers'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import { ConfigWorkspaceShell } from '@/components/shared/CollapsibleWorkspace'
import {
  getDefaultColumnSettings,
  normalizeColumnSettings,
  orderVisibleDefinitions,
} from '@/lib/columnSettings'
import { compareVersionsForTable, type CompareTableRow, type FieldDiff } from '@/lib/versionCompare'
import type { TaskChange } from '@/types/plan-notify'
import { NOTIFY_DIFF_FIELDS, MOCK_USER_MAP } from '@/components/shared/PlanHelpers'
import { notifyPublishChanges } from '@/lib/feishu-notify'
import { cancelDraftRevision } from '@/lib/marketRules'
import { comparePlanVersions, getNextPlanRevisionVersionNo, getPlanVersionId, type PlanRevisionKind } from '@/lib/planVersioning'
import EnumConfig from '@/components/config/EnumConfig'
import {
  getTemplateSnapshotForProjectType,
  getTemplateTasksForProjectType,
} from '@/lib/projectTemplateCompatibility'
import {
  getTemplateConfigScopeKey,
  TECHNICAL_TEMPLATE_STORAGE_KEYS,
} from '@/lib/technicalPlanRules'
import type { TechnicalTemplateKind } from '@/types/technicalPlan'
import dayjs from 'dayjs'

const { Option } = Select
const PLAN_TEMPLATE_ROLE_OPTIONS = [
  { label: 'SPM', value: 'SPM' },
  { label: '技术项目负责人', value: '技术项目负责人' },
]
const PLAN_REVISION_KIND_OPTIONS: Array<{ key: PlanRevisionKind; label: string }> = [
  { key: 'gray', label: '创建非正式版本' },
  { key: 'formal', label: '创建正式版本' },
]

export default function ConfigContainer() {
  const {
    configTab, setConfigTab, configSidebarCollapsed, setConfigSidebarCollapsed,
    selectedProjectType, setSelectedProjectType,
    isEditMode, setIsEditMode, showVersionCompare, setShowVersionCompare,
    showColumnModal, setShowColumnModal, showAddCustomType, setShowAddCustomType,
    setPendingNavigation, setShowLeaveConfirm,
  } = useUiStore()

  const {
    planLevel, setPlanLevel, selectedPlanType, setSelectedPlanType,
    customTypes, setCustomTypes, viewMode, setViewMode,
    tasks, setTasks, searchText, setSearchText,
    columnSettingsByView, setColumnSettingsByView, collapsedNodes, setCollapsedNodes,
    publishedSnapshots, setPublishedSnapshots,
    compareResult, setCompareResult, compareShowUnchanged, setCompareShowUnchanged,
    compareFilterType, setCompareFilterType,
    ganttEditingTask, setGanttEditingTask,
    progressEditingTask, setProgressEditingTask,
    parentTimeWarning, setParentTimeWarning,
    milestoneTimeWarning, setMilestoneTimeWarning,
    predecessorWarning, setPredecessorWarning,
    level2PlanTasks, setLevel2PlanTasks,
    activeLevel2Plan,
    configTemplateTasksByType, setConfigTemplateTasksByType, setTechnicalTemplateTasks,
    configTemplateVersionScopes, setConfigTemplateVersions, setConfigTemplateCurrentVersion,
    configTemplateCompareScopes, setConfigTemplateCompareVersions,
  } = usePlanStore()

  const transferStore = useTransferStore()
  const { transferConfigView, setTransferConfigView } = transferStore

  const { selectedProject, currentLoginUser } = useProjectStore()

  // Derive the transfer-module current user from the logged-in user so it
  // tracks the user switcher instead of being pinned to MOCK_TM_USERS[0].
  const transferCurrentUser = useMemo(() => ({
    id: `login-${currentLoginUser}`,
    name: currentLoginUser,
    role: 'SPM' as const,
    department: '-',
  }), [currentLoginUser])

  const [newCustomTypeName, setNewCustomTypeName] = useState('')

  const allPlanTypes = [...LEVEL2_PLAN_TYPES, ...customTypes]
  // 配置中心使用模板数据（按项目分类隔离，无日期/工期）
  const selectedTemplateType = getProjectTypeFamilyKey(selectedProjectType)
  const isTechnicalTemplate = selectedTemplateType === PROJECT_CATEGORY_TECH
  const technicalTemplateKind: TechnicalTemplateKind = planLevel === 'subproject' ? 'subproject' : 'tdt'
  const templatePlanLevel = isTechnicalTemplate ? technicalTemplateKind : planLevel
  const templateVersionScope = getTemplateConfigScopeKey(selectedTemplateType, templatePlanLevel)
  const versionScope = configTemplateVersionScopes[templateVersionScope] || {
    versions: VERSION_DATA.map(version => ({ ...version })),
    currentVersion: 'v3',
  }
  const versions = versionScope.versions
  const currentVersion = versions.some(version => version.id === versionScope.currentVersion)
    ? versionScope.currentVersion
    : versions.at(-1)?.id || ''
  const setVersions = (next: typeof versions | ((previous: typeof versions) => typeof versions)) => (
    setConfigTemplateVersions(templateVersionScope, next)
  )
  const setCurrentVersion = (versionId: string) => (
    setConfigTemplateCurrentVersion(templateVersionScope, versionId)
  )
  const configuredCompareScope = configTemplateCompareScopes[templateVersionScope]
  const compareVersionA = versions.some(version => version.id === configuredCompareScope?.versionA)
    ? configuredCompareScope.versionA
    : versions[0]?.id || ''
  const compareVersionB = versions.some(version => version.id === configuredCompareScope?.versionB)
    ? configuredCompareScope.versionB
    : versions.filter(version => version.status === '已发布').at(-1)?.id || currentVersion
  const setCompareVersionA = (versionId: string) => (
    setConfigTemplateCompareVersions(templateVersionScope, versionId, compareVersionB)
  )
  const setCompareVersionB = (versionId: string) => (
    setConfigTemplateCompareVersions(templateVersionScope, compareVersionA, versionId)
  )
  const hasDraftVersion = versions.some(v => v.status === '修订中')
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'

  const navigateWithEditGuard = (action: () => void) => {
    if (isEditMode && !isCurrentDraft) {
      setPendingNavigation(() => action)
      setShowLeaveConfirm(true)
    } else {
      action()
    }
  }

  const technicalTemplateKey = TECHNICAL_TEMPLATE_STORAGE_KEYS[technicalTemplateKind]
  const configTasks = isTechnicalTemplate
    ? configTemplateTasksByType[technicalTemplateKey] || []
    : getTemplateTasksForProjectType(configTemplateTasksByType, selectedTemplateType)
      || LEVEL1_TEMPLATE_TASKS.map(t => ({ ...t }))
  const setConfigTasks = (next: any[] | ((prev: any[]) => any[])) => {
    if (isTechnicalTemplate) {
      setTechnicalTemplateTasks(technicalTemplateKind, next)
      return
    }
    setConfigTemplateTasksByType(prev => {
      const current = getTemplateTasksForProjectType(prev, selectedTemplateType)
        || LEVEL1_TEMPLATE_TASKS.map(t => ({ ...t }))
      const resolved = typeof next === 'function' ? next(current) : next
      return { ...prev, [selectedTemplateType]: resolved }
    })
  }

  useEffect(() => {
    if (isTechnicalTemplate && planLevel !== 'tdt' && planLevel !== 'subproject') setPlanLevel('tdt')
    if (!isTechnicalTemplate && planLevel !== 'level1' && planLevel !== 'level2') setPlanLevel('level1')
  }, [isTechnicalTemplate, planLevel, setPlanLevel])

  // 修订版本自动进入编辑状态，已发布版本退出编辑
  useEffect(() => {
    if (isCurrentDraft) {
      setIsEditMode(true)
    } else {
      setIsEditMode(false)
    }
  }, [currentVersion, isCurrentDraft])

  // View columns
  const getViewKey = () => `config-${planLevel}-${viewMode}`
  const currentViewMode = viewMode
  const currentViewColumns = getConfigColumnsForView(currentViewMode)
  const currentViewKey = getViewKey()
  const storedColumnSettings = columnSettingsByView[currentViewKey]
  const columnSettings = useMemo(
    () => normalizeColumnSettings(currentViewColumns, storedColumnSettings),
    [currentViewColumns, storedColumnSettings],
  )
  const orderedVisibleColumns = useMemo(
    () => orderVisibleDefinitions(currentViewColumns, columnSettings)
      .filter(column => column.key !== 'defaultRoadmap'),
    [columnSettings, currentViewColumns],
  )
  const visibleColumns = orderedVisibleColumns.map(column => column.key)
  const ganttColumns = useMemo<DHTMLXGanttColumn[]>(() => (
    orderedVisibleColumns.map(column => {
      const ganttColumnByKey: Record<string, DHTMLXGanttColumn> = {
        taskName: { name: 'text', label: '任务名称', width: 180, tree: true },
        predecessor: { name: 'predecessor', label: '前置任务', align: 'center', width: 70 },
        planStartDate: { name: 'start_date', label: '计划开始', align: 'center', width: 90 },
        planEndDate: { name: 'end_date', label: '计划完成', align: 'center', width: 90 },
        estimatedDays: { name: 'duration', label: '计划周期', align: 'center', width: 60, template: task => task.duration + '天' },
        progress: { name: 'progress', label: '进度', align: 'center', width: 60, template: task => Math.round(task.progress * 100) + '%' },
      }
      return ganttColumnByKey[column.key]
    }).filter((column): column is DHTMLXGanttColumn => Boolean(column))
  ), [orderedVisibleColumns])
  const applyColumnSettings = (nextSettings: typeof columnSettings) => {
    setColumnSettingsByView(previous => ({ ...previous, [currentViewKey]: nextSettings }))
  }

  // Scope key for collapse
  const getScopeKey = (): string | null => {
    if (isTechnicalTemplate) return `config::${PROJECT_CATEGORY_TECH}::${technicalTemplateKind}`
    if (planLevel === 'level1') return `config::${selectedProjectType}::level1`
    if (planLevel === 'level2') return `config::${selectedProjectType}::level2::${selectedPlanType}`
    return null
  }

  const toggleNode = (nodeId: string) => {
    const key = getScopeKey()
    if (!key) return
    setCollapsedNodes(prev => {
      const cur = new Set(prev[key] || [])
      if (cur.has(nodeId)) cur.delete(nodeId); else cur.add(nodeId)
      return { ...prev, [key]: cur }
    })
  }

  const expandAll = () => {
    const key = getScopeKey()
    if (!key) return
    setCollapsedNodes(prev => ({ ...prev, [key]: new Set<string>() }))
  }

  const collapseAll = () => {
    const key = getScopeKey()
    if (!key) return
    const allParents = getAllExpandableIds(configTasks)
    setCollapsedNodes(prev => ({ ...prev, [key]: new Set(allParents) }))
  }

  const filteredTasks = (configTasks as any[]).filter((task: any) => {
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      task.id.toLowerCase().includes(searchLower) ||
      task.taskName.toLowerCase().includes(searchLower) ||
      (task.responsible && task.responsible.toLowerCase().includes(searchLower)) ||
      (task.status && task.status.toLowerCase().includes(searchLower))
    )
  })

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  // Task table for config
  const renderTaskTable = (customTasks?: any[]) => {
    const isLevel2Custom = !!customTasks
    const tableTasks = customTasks || configTasks
    const currentSetTasks = isLevel2Custom ? (newTasks: any[]) => {
      const planId = customTasks?.[0]?.planId
      if (planId) {
        setLevel2PlanTasks(prev => [...prev.filter(t => t.planId !== planId), ...newTasks])
      }
    } : setConfigTasks

    const flatTasks = tableTasks.map((task: any) => ({ ...task, indentLevel: getTaskDepth(task, tableTasks) }))
    const scopeKey = getScopeKey()
    const collapsedSet = scopeKey ? (collapsedNodes[scopeKey] || new Set<string>()) : new Set<string>()
    const expandEnabled = scopeKey !== null
    const visibleTasks = expandEnabled ? filterByCollapsed(flatTasks, collapsedSet) : flatTasks

    const getColumns = (): ColumnsType<any> => {
      const cols: ColumnsType<any> = []
      if (visibleColumns.includes('id')) cols.push({ title: '序号', dataIndex: 'id', key: 'id', width: 130, fixed: 'left', render: (id: string, record: any) => {
        const depth = record.indentLevel || 0
        const isLevel2Mode = planLevel === 'level2'
        const maxDepth = isTechnicalTemplate ? (technicalTemplateKind === 'tdt' ? 2 : 1) : isLevel2Mode ? 3 : 2
        const canAddChild = isEditMode && depth < maxDepth - 1
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 20 }}>
            {isEditMode && <DragHandle />}
            {expandEnabled && hasChildren(record.id, tableTasks) && (
              <span onClick={(e) => { e.stopPropagation(); toggleNode(record.id) }} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', width: 14, height: 14, color: '#9ca3af', transition: 'transform 0.15s', transform: collapsedSet.has(record.id) ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                <CaretDownOutlined style={{ fontSize: 10 }} />
              </span>
            )}
            {expandEnabled && !hasChildren(record.id, tableTasks) && <span style={{ display: 'inline-block', width: 14 }} />}
            {canAddChild && <Tooltip title="添加子项"><Button type="text" size="small" icon={<PlusOutlined />} style={{ color: 'var(--pms-brand)' }} onClick={(e) => { e.stopPropagation(); handleAddSubTask(record.id) }} /></Tooltip>}
            <span style={{ fontWeight: depth === 0 ? 600 : 500, color: depth === 0 ? '#111827' : '#4b5563', fontSize: 13 }}>{id}</span>
          </div>
        )
      } })
      if (visibleColumns.includes('taskName')) cols.push({ title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 220, render: (name: string, record: any) => {
        const depth = record.indentLevel || 0
        if (isEditMode) return <Input className="pms-edit-input" value={name} size="small" style={{ fontWeight: depth === 0 ? 600 : 400 }} onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, taskName: e.target.value } : t); currentSetTasks(updated) }} />
        return (
          <div style={{ paddingLeft: depth * 16, display: 'flex', alignItems: 'center', gap: 4 }}>
            {depth > 0 && <span style={{ color: '#e5e7eb', fontSize: 11, flexShrink: 0 }}>{depth === 1 ? '├' : '└'}</span>}
            <span style={{ color: depth === 0 ? '#111827' : depth === 1 ? '#4b5563' : '#9ca3af', fontWeight: depth === 0 ? 600 : 400 }}>{name}</span>
          </div>
        )
      } })
      if (visibleColumns.includes('responsible')) cols.push({ title: '角色', dataIndex: 'responsible', key: 'responsible', width: 100, render: (val: string, record: any) => isEditMode ? <Select className="pms-edit-input" value={val || 'SPM'} size="small" style={{ width: '100%' }} options={PLAN_TEMPLATE_ROLE_OPTIONS} onChange={(value) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, responsible: value } : t); currentSetTasks(updated) }} /> : (val ? <Tag color="processing" style={{ borderRadius: 4, fontSize: 12 }}>{val}</Tag> : <span style={{ color: '#e5e7eb' }}>-</span>) })
      if (visibleColumns.includes('predecessor')) cols.push({ title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 100, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" placeholder="如: 1.1" onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, predecessor: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <Tag style={{ borderRadius: 4, fontSize: 12 }}>{val}</Tag> : <span style={{ color: '#e5e7eb' }}>-</span>) })
      if (visibleColumns.includes('planStartDate')) cols.push({ title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 130, render: (val: string) => <span style={{ fontSize: 12, color: '#e5e7eb' }}>{val || '-'}</span> })
      if (visibleColumns.includes('planEndDate')) cols.push({ title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 130, render: (val: string) => <span style={{ fontSize: 12, color: '#e5e7eb' }}>{val || '-'}</span> })
      if (visibleColumns.includes('estimatedDays')) cols.push({ title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 90, render: (val: number) => <span style={{ fontSize: 12, color: '#e5e7eb' }}>{val || '-'}</span> })
      if (visibleColumns.includes('status')) cols.push({ title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === '已完成' ? 'success' : s === '进行中' ? 'processing' : 'default'} style={{ borderRadius: 4, fontSize: 12 }}>{s}</Tag> })
      if (visibleColumns.includes('progress')) cols.push({ title: '进度', dataIndex: 'progress', key: 'progress', width: 130, render: (p: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={p} size="small" showInfo={false} strokeColor={p === 100 ? '#52c41a' : 'var(--pms-brand)'} style={{ flex: 1, marginBottom: 0 }} />
          <span style={{ fontSize: 11, color: p === 100 ? '#52c41a' : '#4b5563', fontWeight: 500, minWidth: 32 }}>{p}%</span>
        </div>
      ) })
      if (isEditMode) cols.push({ title: '操作', key: 'action', width: 60, fixed: 'right', render: (_: any, record: any) => (<Popconfirm title="确认删除" description={`删除 "${record.taskName}" 及其子任务？`} onConfirm={() => { const filtered = tableTasks.filter((t: any) => t.id !== record.id && t.parentId !== record.id && !(t.parentId && tableTasks.find((p2: any) => p2.id === t.parentId)?.parentId === record.id)); currentSetTasks(filtered); message.success(`已删除任务: ${record.id}`) }} okText="确认" cancelText="取消"><Button type="text" icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 4 }} /></Popconfirm>) })
      const configurableColumnByKey = new Map(
        cols
          .filter(column => column.key !== 'action')
          .map(column => [String(column.key), column] as const),
      )
      const orderedConfigurableColumns = orderVisibleDefinitions(currentViewColumns, columnSettings)
        .map(definition => configurableColumnByKey.get(definition.key))
        .filter((column): column is ColumnsType<any>[number] => Boolean(column))
      const systemColumns = cols.filter(column => column.key === 'action')
      return [...orderedConfigurableColumns, ...systemColumns]
    }

    const handleTableDragEnd = (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const activeId = String(active.id)
      const overId = String(over.id)
      const activeTask = tableTasks.find((t: any) => t.id === activeId)
      const overTask = tableTasks.find((t: any) => t.id === overId)
      if (!activeTask || !overTask) return
      if (activeTask.parentId !== overTask.parentId) { message.warning('只能在同级任务之间拖动'); return }
      const collectDescendants = (parentId: string, allTasks: any[]): any[] => {
        const children = allTasks.filter((t: any) => t.parentId === parentId); const result: any[] = []
        for (const child of children) { result.push(child); result.push(...collectDescendants(child.id, allTasks)) }
        return result
      }
      const descendants = collectDescendants(activeId, tableTasks)
      const movedBlock = [activeTask, ...descendants]
      const movedIds = new Set(movedBlock.map((t: any) => t.id))
      const remaining = tableTasks.filter((t: any) => !movedIds.has(t.id))
      const overIndex = remaining.findIndex((t: any) => t.id === overId)
      if (overIndex === -1) return
      const overDescendants = collectDescendants(overId, remaining)
      const insertAfterIndex = overIndex + overDescendants.length
      const originalActiveIndex = tableTasks.findIndex((t: any) => t.id === activeId)
      const originalOverIndex = tableTasks.findIndex((t: any) => t.id === overId)
      const movingDown = originalActiveIndex < originalOverIndex
      const insertIndex = movingDown ? insertAfterIndex + 1 : overIndex
      const newTasks = [...remaining]; newTasks.splice(insertIndex, 0, ...movedBlock)
      const result = newTasks.map((t: any) => ({ ...t }))
      const counterMap = new Map<string, number>(); const idMapping = new Map<string, string>()
      for (const task of result) { if (!task.parentId) { const count = (counterMap.get('root') || 0) + 1; counterMap.set('root', count); const newId = String(count); idMapping.set(task.id, newId); task.id = newId; task.order = count } }
      for (const task of result) { if (task.parentId && idMapping.has(task.parentId)) { const np = idMapping.get(task.parentId)!; const k = `child_${np}`; const c = (counterMap.get(k) || 0) + 1; counterMap.set(k, c); const ni = `${np}.${c}`; idMapping.set(task.id, ni); task.parentId = np; task.id = ni; task.order = c } }
      for (const task of result) { if (task.parentId && !idMapping.has(task.id) && idMapping.has(task.parentId)) { const np = idMapping.get(task.parentId)!; const k = `child_${np}`; const c = (counterMap.get(k) || 0) + 1; counterMap.set(k, c); const ni = `${np}.${c}`; idMapping.set(task.id, ni); task.parentId = np; task.id = ni; task.order = c } }
      currentSetTasks(result); message.success('任务顺序已更新，序号已重新生成')
    }

    const TableComponents = isEditMode ? { body: { row: SortableRow } } : undefined
    const tableClassName = `pms-table ${isEditMode ? 'pms-table-edit' : ''}`
    return (
      <div>
        {isEditMode && (
          <div style={{ padding: '8px 16px', background: 'linear-gradient(90deg, #fffbe6, #fff7cc)', borderBottom: '1px solid #ffe58f', display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#faad14', fontSize: 14 }} />
            <span style={{ fontSize: 13, color: '#ad6800', fontWeight: 500 }}>编辑模式</span>
            <span style={{ fontSize: 12, color: '#ad8b00' }}>- 拖拽手柄排序，点击单元格编辑，完成后点击保存</span>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTableDragEnd}><SortableContext items={visibleTasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}><Table className={tableClassName} dataSource={visibleTasks} columns={getColumns()} rowKey="id" pagination={false} scroll={{ x: visibleColumns.length * 100 + 200 }} components={TableComponents} size="middle" /></SortableContext></DndContext>
        {isEditMode && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', background: '#f8fafc' }}>
            <Button type="dashed" icon={<PlusOutlined />} style={{ width: '100%', borderRadius: 6, height: 36 }} onClick={() => {
              const parentTasks = tableTasks.filter((t: any) => !t.parentId)
              const maxOrder = parentTasks.length > 0 ? Math.max(...parentTasks.map((t: any) => parseInt(t.id) || t.order)) : 0
              const newId = String(maxOrder + 1)
              const newTask: any = { id: newId, order: maxOrder + 1, taskName: '新活动', status: '未开始', progress: 0, responsible: 'SPM', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
              if (isLevel2Custom && customTasks?.[0]?.planId) newTask.planId = customTasks[0].planId
              currentSetTasks([...tableTasks, newTask]); message.success(`已添加一级活动: ${newId}`)
            }}>添加新活动</Button>
          </div>
        )}
      </div>
    )
  }

  const handleAddSubTask = (parentId: string) => {
    if (isTechnicalTemplate && technicalTemplateKind === 'subproject') {
      message.warning('子项目计划只支持一级任务，不可添加子任务')
      return
    }
    const isLevel2Context = planLevel === 'level2'
    const isLevel2TaskContext = isLevel2Context && activeLevel2Plan
    const currentTasks = isLevel2TaskContext ? level2PlanTasks.filter((t: any) => t.planId === activeLevel2Plan) : configTasks
    const parentTask = currentTasks.find((t: any) => t.id === parentId)
    if (!parentTask) return
    const depth = getTaskDepth(parentTask, currentTasks)
    const maxDepth = isTechnicalTemplate ? 2 : isLevel2Context ? 3 : 2
    if (depth + 1 >= maxDepth) {
      message.warning(`${isTechnicalTemplate ? 'TDT项目' : isLevel2Context ? '二级' : '一级'}计划最多支持${maxDepth}层活动`)
      return
    }
    const siblingTasks = currentTasks.filter((t: any) => t.parentId === parentId)
    const newOrder = siblingTasks.length + 1
    const newId = `${parentId}.${newOrder}`
    const newTask: any = { id: newId, parentId, order: newOrder, taskName: '新子任务', status: '未开始', progress: 0, responsible: 'SPM', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
    if (isLevel2TaskContext && parentTask.planId) newTask.planId = parentTask.planId
    const parentIndex = currentTasks.findIndex((t: any) => t.id === parentId)
    let insertIndex = parentIndex + 1
    for (let i = parentIndex + 1; i < currentTasks.length; i++) {
      if (currentTasks[i].parentId === parentId || (currentTasks[i].parentId && currentTasks.find((t: any) => t.id === currentTasks[i].parentId)?.parentId === parentId)) {
        insertIndex = i + 1
      } else break
    }
    if (isLevel2TaskContext) {
      const updatedTasks = [...currentTasks]
      updatedTasks.splice(insertIndex, 0, newTask)
      setLevel2PlanTasks(prev => [...prev.filter((t: any) => t.planId !== activeLevel2Plan), ...updatedTasks])
    } else {
      const newTasks = [...configTasks]
      const globalIndex = configTasks.findIndex((t: any) => t.id === parentId)
      let globalInsertIndex = globalIndex + 1
      for (let i = globalIndex + 1; i < configTasks.length; i++) {
        if (configTasks[i].parentId === parentId) globalInsertIndex = i + 1
        else break
      }
      newTasks.splice(globalInsertIndex, 0, newTask)
      setConfigTasks(newTasks)
    }
    message.success(`已添加子任务: ${newId}`)
  }

  // Action buttons
  const handleCreateRevision = (revisionKind: PlanRevisionKind) => {
    const newVersionNo = getNextPlanRevisionVersionNo(versions, revisionKind)
    const newVersionId = getPlanVersionId(newVersionNo)
    const clonedTasks = isTechnicalTemplate
      ? configTasks.map(task => ({ ...task }))
      : LEVEL1_TEMPLATE_TASKS.map(t => ({ ...t }))
    const newVersion = { id: newVersionId, versionNo: newVersionNo, status: '修订中' }
    setVersions([...versions, newVersion])
    setCurrentVersion(newVersionId)
    setConfigTasks(clonedTasks)
    message.success(`已创建${revisionKind === 'gray' ? '非正式' : '正式'}修订版本 ${newVersionNo}`)
  }

  const handleCreateRevisionMenuClick: MenuProps['onClick'] = ({ key }) => {
    handleCreateRevision(key as PlanRevisionKind)
  }

  const handlePublish = () => {
    const prevPublished = versions
      .filter(v => v.status === '已发布' && v.id !== currentVersion)
      .sort((a, b) => comparePlanVersions(b, a))[0]
    const getSnapshot = (versionId: string) => {
      return getTemplateSnapshotForProjectType(publishedSnapshots, selectedProjectType, versionId, templatePlanLevel)
        || []
    }
    const baselineTasks: any[] = prevPublished ? getSnapshot(prevPublished.id) : []
    const changes: TaskChange[] = []
    const baselineMap = new Map<string, any>(baselineTasks.map(t => [t.id, t]))
    for (const curr of configTasks) {
      const prev = baselineMap.get(curr.id)
      if (!prev) { changes.push({ kind: 'created', task: curr }); continue }
      const changedFields: string[] = []
      for (const f of NOTIFY_DIFF_FIELDS) {
        if ((prev[f] ?? '') !== (curr[f] ?? '')) changedFields.push(f)
      }
      if (changedFields.length > 0) changes.push({ kind: 'modified', task: curr, previous: prev, changedFields })
    }

    const publishedVersionId = currentVersion
    const publishedVersion = versions.find(v => v.id === publishedVersionId)
    setVersions(versions.map(v => v.id === publishedVersionId ? { ...v, status: '已发布' } : v))
    const snapshot = JSON.parse(JSON.stringify(configTasks))
    setPublishedSnapshots(prev => ({
      ...prev,
      [getTemplateSnapshotKey(selectedProjectType, publishedVersionId, templatePlanLevel)]: snapshot,
      ...(isTechnicalTemplate && technicalTemplateKind === 'tdt'
        ? { [getTemplateSnapshotKey(selectedProjectType, publishedVersionId)]: JSON.parse(JSON.stringify(snapshot)) }
        : {}),
    }))

    const versionNo = publishedVersion?.versionNo || publishedVersionId
    if (changes.length > 0) {
      notifyPublishChanges(versionNo, changes, MOCK_USER_MAP)
    }
    message.success('发布成功')
  }

  const handleCancelRevision = () => {
    if (!isCurrentDraft || !currentVersionData) return
    Modal.confirm({
      title: '取消修订版本',
      content: `确认取消 ${currentVersionData.versionNo} 修订版本？取消后该版本将显示为已取消，可重新创建新的修订版本。`,
      okText: '确认取消',
      okType: 'danger',
      cancelText: '保留修订',
      onOk: () => {
        const result = cancelDraftRevision(versions, currentVersion)
        setVersions(result.versions as typeof versions)
        setCurrentVersion(result.currentVersion)
        setIsEditMode(false)
        message.success(`${currentVersionData.versionNo} 已取消`)
      },
    })
  }

  const renderActionButtons = () => {
    if (isCurrentDraft) return (<Space><Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{currentVersionData?.versionNo}({currentVersionData?.status})</Tag><Tag color="green" style={{ fontSize: 12 }}>自动保存</Tag><Button type="primary" icon={<SaveOutlined />} onClick={handlePublish}>发布</Button><Button danger icon={<StopOutlined />} onClick={handleCancelRevision}>取消修订</Button><Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)}>历史版本对比</Button></Space>)
    return (<Space>{!hasDraftVersion && <Dropdown menu={{ items: PLAN_REVISION_KIND_OPTIONS, onClick: handleCreateRevisionMenuClick }} trigger={['click']} placement="bottomLeft"><Button type="primary" icon={<PlusOutlined />}>创建修订</Button></Dropdown>}<Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)}>历史版本对比</Button></Space>)
  }

  // Build transferProps for TransferConfig
  const transferProps = {
    selectedProject, currentUser: transferCurrentUser,
    transferView: transferStore.transferView, setTransferView: transferStore.setTransferView,
    transferConfigView, setTransferConfigView,
    configSidebarCollapsed, setConfigSidebarCollapsed,
    tmConfigSearchText: transferStore.tmConfigSearchText, setTmConfigSearchText: transferStore.setTmConfigSearchText,
    tmConfigSelectedVersion: transferStore.tmConfigSelectedVersion, setTmConfigSelectedVersion: transferStore.setTmConfigSelectedVersion,
    tmConfigDiffOpen: transferStore.tmConfigDiffOpen, setTmConfigDiffOpen: transferStore.setTmConfigDiffOpen,
    tmConfigDiffFrom: transferStore.tmConfigDiffFrom, setTmConfigDiffFrom: transferStore.setTmConfigDiffFrom,
    tmConfigDiffTo: transferStore.tmConfigDiffTo, setTmConfigDiffTo: transferStore.setTmConfigDiffTo,
    selectedTransferAppId: transferStore.selectedTransferAppId, setSelectedTransferAppId: transferStore.setSelectedTransferAppId,
    transferApplications: transferStore.transferApplications, setTransferApplications: transferStore.setTransferApplications,
    tmChecklistItems: transferStore.tmChecklistItems, setTmChecklistItems: transferStore.setTmChecklistItems,
    tmReviewElements: transferStore.tmReviewElements, setTmReviewElements: transferStore.setTmReviewElements,
    tmBlockTasks: transferStore.tmBlockTasks, tmLegacyTasks: transferStore.tmLegacyTasks,
    tmApplyDate: transferStore.tmApplyDate, setTmApplyDate: transferStore.setTmApplyDate,
    tmApplyRemark: transferStore.tmApplyRemark, setTmApplyRemark: transferStore.setTmApplyRemark,
    tmApplyTeam: transferStore.tmApplyTeam, setTmApplyTeam: transferStore.setTmApplyTeam,
    tmDetailModalVisible: transferStore.tmDetailModalVisible, setTmDetailModalVisible: transferStore.setTmDetailModalVisible,
    tmDetailModalTitle: transferStore.tmDetailModalTitle, setTmDetailModalTitle: transferStore.setTmDetailModalTitle,
    tmDetailModalContent: transferStore.tmDetailModalContent, setTmDetailModalContent: transferStore.setTmDetailModalContent,
    tmCloseModalVisible: transferStore.tmCloseModalVisible, setTmCloseModalVisible: transferStore.setTmCloseModalVisible,
    tmCloseAppId: transferStore.tmCloseAppId, setTmCloseAppId: transferStore.setTmCloseAppId,
    tmCloseReason: transferStore.tmCloseReason, setTmCloseReason: transferStore.setTmCloseReason,
    tmEntryTab: transferStore.tmEntryTab, setTmEntryTab: transferStore.setTmEntryTab,
    tmEntryModalOpen: transferStore.tmEntryModalOpen, setTmEntryModalOpen: transferStore.setTmEntryModalOpen,
    tmEntryModalRecord: transferStore.tmEntryModalRecord, setTmEntryModalRecord: transferStore.setTmEntryModalRecord,
    tmEntryContent: transferStore.tmEntryContent, setTmEntryContent: transferStore.setTmEntryContent,
    tmEntryActiveRole: transferStore.tmEntryActiveRole, setTmEntryActiveRole: transferStore.setTmEntryActiveRole,
    tmReviewTab: transferStore.tmReviewTab, setTmReviewTab: transferStore.setTmReviewTab,
    tmReviewModalOpen: transferStore.tmReviewModalOpen, setTmReviewModalOpen: transferStore.setTmReviewModalOpen,
    tmReviewAction: transferStore.tmReviewAction, setTmReviewAction: transferStore.setTmReviewAction,
    tmReviewRecord: transferStore.tmReviewRecord, setTmReviewRecord: transferStore.setTmReviewRecord,
    tmReviewComment: transferStore.tmReviewComment, setTmReviewComment: transferStore.setTmReviewComment,
    tmReviewActiveRole: transferStore.tmReviewActiveRole, setTmReviewActiveRole: transferStore.setTmReviewActiveRole,
    tmSqaComment: transferStore.tmSqaComment, setTmSqaComment: transferStore.setTmSqaComment,
    tmSqaModalOpen: transferStore.tmSqaModalOpen, setTmSqaModalOpen: transferStore.setTmSqaModalOpen,
    tmSqaAction: transferStore.tmSqaAction, setTmSqaAction: transferStore.setTmSqaAction,
    setProjectSpaceModule: useUiStore.getState().setProjectSpaceModule,
  }

  const renderGanttChart = () => {
    const ganttTasks = filteredTasks
    const key = getScopeKey()
    const collapsedSet = key ? (collapsedNodes[key] || new Set<string>()) : new Set<string>()
    return (
      <div style={{ border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <DHTMLXGantt
          tasks={ganttTasks}
          columns={ganttColumns}
          onTaskClick={(task) => { message.info(`点击任务: ${task.text}`) }}
          readOnly={!isEditMode}
          collapsedIds={collapsedSet}
          onCollapsedChange={(updater) => {
            if (!key) return
            setCollapsedNodes(prev => {
              const current = prev[key] || new Set<string>()
              const next = updater(current)
              return { ...prev, [key]: next }
            })
          }}
        />
      </div>
    )
  }

  // Version compare result renderer
  const renderVersionCompareResult = () => {
    if (compareResult.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#bfbfbf' }}>
          <HistoryOutlined style={{ fontSize: 36, display: 'block', marginBottom: 12, color: '#e5e7eb' }} />
          <div style={{ fontSize: 14, color: '#9ca3af' }}>选择两个版本后点击"开始对比"查看差异</div>
        </div>
      )
    }
    const changedRows = compareResult.filter(r => r.changeType !== '未变更')
    const stats = { total: compareResult.length, added: changedRows.filter(r => r.changeType === '新增').length, deleted: changedRows.filter(r => r.changeType === '删除').length, modified: changedRows.filter(r => r.changeType === '修改').length, unchanged: compareResult.filter(r => r.changeType === '未变更').length }
    let filteredData = compareShowUnchanged ? compareResult : changedRows
    if (compareFilterType !== 'all') filteredData = filteredData.filter(r => r.changeType === compareFilterType)
    const getRowBg = (type: string) => { if (type === '新增') return '#f6ffed'; if (type === '删除') return '#fff2f0'; if (type === '修改') return 'var(--pms-brand-surface)'; return undefined }
    const renderDiffCell = (row: CompareTableRow, fieldKey: string, value: any) => {
      const diff = row.fieldDiffs.find((d: FieldDiff) => d.field === fieldKey)
      if (row.changeType === '修改' && diff) {
        return (<Tooltip title={<div style={{ fontSize: 12 }}><div>修改人: {row.modifier}</div><div>修改时间: {row.modifyTime}</div></div>}><div style={{ lineHeight: 1.6 }}><div style={{ color: '#ff4d4f', fontSize: 11, textDecoration: 'line-through', opacity: 0.7 }}>{diff.oldValue}</div><div style={{ color: 'var(--pms-brand)', fontWeight: 600, fontSize: 12 }}>{diff.newValue}</div></div></Tooltip>)
      }
      if (row.changeType === '新增') return <span style={{ color: '#52c41a', fontWeight: 500 }}>{value || '-'}</span>
      if (row.changeType === '删除') return <span style={{ color: '#ff4d4f', textDecoration: 'line-through', opacity: 0.7 }}>{value || '-'}</span>
      return <span style={{ color: '#4b5563' }}>{value || '-'}</span>
    }
    const compareColumns: any[] = [
      { title: '序号', dataIndex: 'taskId', key: 'taskId', width: 70, render: (val: string, row: CompareTableRow) => (<span style={{ fontWeight: 600, fontSize: 12, color: row.changeType === '新增' ? '#52c41a' : row.changeType === '删除' ? '#ff4d4f' : row.changeType === '修改' ? 'var(--pms-brand)' : '#9ca3af' }}>{val}</span>) },
      { title: '变更类型', dataIndex: 'changeType', key: 'changeType', width: 80, render: (val: string) => { const conf: Record<string, { color: string; bg: string }> = { '新增': { color: '#52c41a', bg: '#f6ffed' }, '删除': { color: '#ff4d4f', bg: '#fff2f0' }, '修改': { color: 'var(--pms-brand)', bg: 'var(--pms-brand-surface)' }, '未变更': { color: '#9ca3af', bg: '#fafafa' } }; const c = conf[val]; return c ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: c.color, background: c.bg, border: val === '修改' ? '1px solid var(--pms-brand-border)' : `1px solid ${c.color}20` }}>{val}</span> : null } },
      { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 160, ellipsis: true, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'taskName', val) },
      { title: '角色', dataIndex: 'responsible', key: 'responsible', width: 80, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'responsible', val) },
      { title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 80, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'predecessor', val) },
      { title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 105, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'planStartDate', val) },
      { title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 105, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'planEndDate', val) },
      { title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 80, render: (val: number, row: CompareTableRow) => renderDiffCell(row, 'estimatedDays', val ? `${val}天` : '-') },
      { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'status', val) },
      { title: '进度', dataIndex: 'progress', key: 'progress', width: 70, render: (val: number, row: CompareTableRow) => renderDiffCell(row, 'progress', `${val}%`) },
    ]
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          {[
            { label: '变更总计', value: changedRows.length, color: 'var(--pms-brand)', filterVal: 'all' },
            { label: '新增', value: stats.added, color: '#52c41a', filterVal: '新增' },
            { label: '修改', value: stats.modified, color: 'var(--pms-brand)', filterVal: '修改' },
            { label: '删除', value: stats.deleted, color: '#ff4d4f', filterVal: '删除' },
          ].map(item => {
            const isActive = compareFilterType === item.filterVal
            return (<div key={item.filterVal} onClick={() => setCompareFilterType(item.filterVal)} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', background: isActive ? `${item.color}10` : '#fafafa', border: isActive ? `1px solid ${item.color}` : '1px solid #f3f4f6', transition: 'all 0.2s' }}><div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div><div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.label}</div></div>)
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>共 {filteredData.length} 条记录</span>
          <Checkbox checked={compareShowUnchanged} onChange={e => setCompareShowUnchanged(e.target.checked)}><span style={{ fontSize: 12 }}>显示未变更项</span></Checkbox>
        </div>
        <Table className="pms-table" columns={compareColumns} dataSource={filteredData} size="small" bordered pagination={filteredData.length > 15 ? { pageSize: 15, size: 'small', showTotal: (t) => `共 ${t} 条` } : false} scroll={{ x: 1200, y: 420 }} rowKey="key" onRow={(record: CompareTableRow) => ({ style: { background: getRowBg(record.changeType) } })} />
      </div>
    )
  }

  return (
    <div className="pms-admin-workspace pms-page-shell pms-config-center">
      <header className="pms-workbench-header pms-config-center-header pms-glass-surface">
        <h1>配置中心</h1>
        <Segmented
          className="pms-workbench-switch pms-config-center-switch"
          aria-label="配置中心模块"
          value={configTab}
          onChange={(key) => {
            const nextKey = String(key)
            setConfigTab(nextKey)
            if (nextKey === 'transfer' && transferConfigView === 'home') setTransferConfigView('checklist')
          }}
          options={[
            { value: 'plan', label: '计划模板配置' },
            { value: 'transfer', label: '转维材料模板配置' },
            { value: 'enum', label: '枚举值配置' },
          ]}
        />
      </header>

      {/* Transfer config */}
      {configTab === 'transfer' && <TransferConfig {...transferProps} />}

      {/* Fixed tOS enum value config */}
      {configTab === 'enum' && (
        <EnumConfig
          collapsed={configSidebarCollapsed}
          onCollapsedChange={setConfigSidebarCollapsed}
        />
      )}

      {/* Plan config */}
      {configTab === 'plan' && (
        <ConfigWorkspaceShell
          collapsed={configSidebarCollapsed}
          onCollapsedChange={setConfigSidebarCollapsed}
          title="项目分类"
          ariaLabel="计划模板项目分类"
          content={(
            <div className="pms-config-workspace-card">
            {/* Config header */}
            <Card className="pms-glass-surface" size="small" style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
              <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)', borderBottom: '1px solid #e5e7eb' }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space size={8} align="center">
                      <CalendarOutlined style={{ color: 'var(--pms-brand)', fontSize: 16 }} />
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{selectedTemplateType}</span>
                      <Divider type="vertical" style={{ height: 16, margin: '0 4px' }} />
                      <span style={{ fontSize: 14, color: '#4b5563' }}>计划模板配置</span>
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af', paddingLeft: 24 }}>配置和管理项目计划模板</div>
                  </Col>
                </Row>
              </div>
              <div style={{ padding: '4px 16px' }}>
                <Tabs
                  activeKey={planLevel}
                  onChange={(key) => navigateWithEditGuard(() => setPlanLevel(key))}
                  style={{ marginBottom: 0 }}
                  items={isTechnicalTemplate
                    ? [
                      { key: 'tdt', label: <span style={{ fontWeight: 500 }}>TDT项目计划</span> },
                      { key: 'subproject', label: <span style={{ fontWeight: 500 }}>子项目计划</span> },
                    ]
                    : [
                      { key: 'level1', label: <span style={{ fontWeight: 500 }}>一级计划</span> },
                      { key: 'level2', label: <span style={{ fontWeight: 500 }}>二级计划</span> },
                    ]}
                />
              </div>
            </Card>

            {/* L2 plan type selector */}
            {planLevel === 'level2' && (
              <Card className="pms-toolbar" size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '10px 16px' } }}>
                <Space wrap size={[8, 8]}>
                  <span style={{ color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>模板类型</span>
                  <Divider type="vertical" style={{ height: 16, margin: '0 4px' }} />
                  {allPlanTypes.map(t => {
                    const isCustom = customTypes.includes(t)
                    return (
                      <Tag
                        key={t}
                        color={selectedPlanType === t ? 'blue' : 'default'}
                        style={{ cursor: 'pointer', borderRadius: 4, padding: '2px 10px', fontWeight: selectedPlanType === t ? 500 : 400 }}
                        onClick={() => navigateWithEditGuard(() => setSelectedPlanType(t))}
                        closable={isCustom}
                        onClose={(e) => {
                          e.preventDefault()
                          Modal.confirm({
                            title: '删除计划类型',
                            content: `确认删除自定义类型"${t}"？`,
                            okText: '删除', okType: 'danger', cancelText: '取消',
                            onOk: () => {
                              setCustomTypes(prev => prev.filter(c => c !== t))
                              if (selectedPlanType === t) setSelectedPlanType(LEVEL2_PLAN_TYPES[0])
                              message.success('已删除')
                            },
                          })
                        }}
                      >
                        {t}
                      </Tag>
                    )
                  })}
                  <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ borderRadius: 4 }} onClick={() => setShowAddCustomType(true)}>添加类型</Button>
                </Space>
              </Card>
            )}

            {/* Version control + toolbar */}
            <Card className="pms-toolbar" size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '10px 16px' } }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                    <Space size={6}>
                      <span style={{ color: '#9ca3af', fontSize: 13 }}>版本</span>
                      <Select value={currentVersion} onChange={(val) => navigateWithEditGuard(() => { setCurrentVersion(val); setIsEditMode(false) })} style={{ width: 180 }} size="middle">
                        {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
                      </Select>
                    </Space>
                    {renderActionButtons()}
                  </Space>
                </Col>
                <Col>
                  <Space size={6}>
                    <Input placeholder="搜索任务..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear onChange={(e) => setSearchText(e.target.value)} />
                    <SortableColumnSettings
                      open={showColumnModal}
                      trigger={(
                        <Tooltip title="自定义列">
                          <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
                        </Tooltip>
                      )}
                      definitions={currentViewColumns}
                      value={columnSettings}
                      defaultValue={getDefaultColumnSettings(currentViewColumns)}
                      onApply={applyColumnSettings}
                      onCancel={() => setShowColumnModal(false)}
                    />
                    {getScopeKey() !== null && (
                      <>
                        <Tooltip title="全部展开"><Button icon={<PlusSquareOutlined />} style={{ borderRadius: 6 }} onClick={expandAll} /></Tooltip>
                        <Tooltip title="全部收起"><Button icon={<MinusSquareOutlined />} style={{ borderRadius: 6 }} onClick={collapseAll} /></Tooltip>
                      </>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* Table / Gantt content */}
            <Card className="pms-solid-surface" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
              {viewMode === 'gantt' ? renderGanttChart() : renderTaskTable()}
            </Card>
            </div>
          )}
        >
          <Menu
            className="pms-config-sidebar-menu"
            mode="inline"
            inlineCollapsed={configSidebarCollapsed}
            selectedKeys={[selectedTemplateType]}
            items={PROJECT_TEMPLATE_TYPES.map(t => ({
              key: t,
              icon: <AppstoreOutlined />,
              label: <span style={{ fontWeight: selectedTemplateType === t ? 500 : 400 }}>{t}</span>,
              title: t,
              onClick: () => navigateWithEditGuard(() => {
                setSelectedProjectType(t)
                setPlanLevel(t === PROJECT_CATEGORY_TECH ? 'tdt' : 'level1')
              }),
            }))}
          />
        </ConfigWorkspaceShell>
      )}

      {/* Custom type modal */}
      <Modal className="pms-modal"
        title="添加自定义二级计划类型"
        open={showAddCustomType}
        onCancel={() => { setShowAddCustomType(false); setNewCustomTypeName('') }}
        footer={[
          <Button key="cancel" onClick={() => { setShowAddCustomType(false); setNewCustomTypeName('') }}>取消</Button>,
          <Button key="add" type="primary" disabled={!newCustomTypeName.trim() || allPlanTypes.includes(newCustomTypeName.trim())} onClick={() => {
            if (!newCustomTypeName.trim()) { message.error('请输入类型名称'); return }
            if (allPlanTypes.includes(newCustomTypeName.trim())) { message.error('该类型名称已存在'); return }
            setCustomTypes(prev => [...prev, newCustomTypeName.trim()])
            setSelectedPlanType(newCustomTypeName.trim())
            setShowAddCustomType(false)
            setNewCustomTypeName('')
            message.success(`已添加类型: ${newCustomTypeName.trim()}`)
          }}>确认添加</Button>
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="类型名称" required help={allPlanTypes.includes(newCustomTypeName.trim()) ? '该类型名称已存在' : undefined} validateStatus={newCustomTypeName.trim() && allPlanTypes.includes(newCustomTypeName.trim()) ? 'error' : undefined}>
            <Input placeholder="请输入自定义类型名称" value={newCustomTypeName} onChange={(e) => setNewCustomTypeName(e.target.value)} maxLength={20} />
          </Form.Item>
          <div style={{ color: '#888', fontSize: 12 }}>
            <p>固定类型: {LEVEL2_PLAN_TYPES.join('、')}</p>
          </div>
        </Form>
      </Modal>

      {/* Version compare modal */}
      <Modal className="pms-modal"
        title={<Space><HistoryOutlined style={{ color: 'var(--pms-brand)' }} /><span style={{ fontWeight: 600 }}>历史版本对比</span></Space>}
        open={showVersionCompare}
        onCancel={() => { setShowVersionCompare(false); setCompareResult([]); setCompareFilterType('all'); setCompareShowUnchanged(false) }}
        footer={null} width={1200}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)', borderRadius: 10, marginBottom: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>基准版本</span>
            <Select value={compareVersionA} onChange={setCompareVersionA} style={{ width: 180 }} size="middle">
              {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
            </Select>
          </div>
          <div style={{ fontSize: 18, color: '#bfbfbf' }}>→</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>对比版本</span>
            <Select value={compareVersionB} onChange={setCompareVersionB} style={{ width: 180 }} size="middle">
              {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
            </Select>
          </div>
          <Button type="primary" icon={<SearchOutlined />} style={{ borderRadius: 6 }} onClick={() => {
            const versionA = versions.find(v => v.id === compareVersionA)
            const versionB = versions.find(v => v.id === compareVersionB)
            if (versionA && versionB) {
              const getVersionTasks = (version: typeof versionA) => (
                version.status === '已发布'
                  ? getTemplateSnapshotForProjectType(
                    publishedSnapshots,
                    selectedProjectType,
                    version.id,
                    templatePlanLevel,
                  ) || []
                  : version.id === currentVersion ? configTasks : []
              )
              const oldTasks = getVersionTasks(versionA)
              const newTasks = getVersionTasks(versionB)
              const result = compareVersionsForTable(oldTasks as any, newTasks as any)
              setCompareResult(result as CompareTableRow[])
              setCompareFilterType('all')
              message.success('对比完成')
            }
          }}>开始对比</Button>
        </div>
        {renderVersionCompareResult()}
      </Modal>
    </div>
  )
}
