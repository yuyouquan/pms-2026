'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Card, Tabs, Table, Row, Col, Space, Divider, Tag, Menu, Button, Select,
  Input, Tooltip, Modal, Form, Checkbox, message, Progress, Popconfirm,
  DatePicker, Avatar,
} from 'antd'
import {
  CalendarOutlined, SwapOutlined, PlusOutlined, SaveOutlined,
  HistoryOutlined, SearchOutlined, AppstoreOutlined, EditOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, PlusSquareOutlined, MinusSquareOutlined,
  DeleteOutlined, CaretDownOutlined,
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ColumnsType } from 'antd/es/table'
import { useUiStore } from '@/stores/ui'
import { usePlanStore, LEVEL2_PLAN_TYPES, LEVEL1_TASKS, LEVEL1_TEMPLATE_TASKS, ALL_COLUMNS, TABLE_COLUMNS, GANTT_COLUMNS, getColumnsForView } from '@/stores/plan'
import { useTransferStore } from '@/stores/transfer'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { TransferConfig } from '@/components/transfer/TransferModule'
import { PROJECT_TYPES } from '@/data/projects'
import { DHTMLXGantt, DragHandle, SortableRow, DragHandleContext, ClickToEditDate, getTaskDepth, hasChildren, filterByCollapsed, getAllExpandableIds } from '@/components/shared/PlanHelpers'
import { compareVersionsForTable, type CompareTableRow, type FieldDiff } from '@/lib/versionCompare'
import type { TaskChange } from '@/types/plan-notify'
import { NOTIFY_DIFF_FIELDS, MOCK_USER_MAP } from '@/components/shared/PlanHelpers'
import { notifyPublishChanges } from '@/lib/feishu-notify'
import dayjs from 'dayjs'

const { Option } = Select

export default function ConfigContainer() {
  const {
    configTab, setConfigTab, sidebarCollapsed, setSidebarCollapsed,
    selectedProjectType, setSelectedProjectType,
    isEditMode, setIsEditMode, showVersionCompare, setShowVersionCompare,
    showColumnModal, setShowColumnModal, showAddCustomType, setShowAddCustomType,
    setPendingNavigation, setShowLeaveConfirm,
  } = useUiStore()

  const {
    planLevel, setPlanLevel, selectedPlanType, setSelectedPlanType,
    customTypes, setCustomTypes, viewMode, setViewMode,
    versions, setVersions, currentVersion, setCurrentVersion,
    tasks, setTasks, searchText, setSearchText,
    columnsByView, setColumnsByView, collapsedNodes, setCollapsedNodes,
    publishedSnapshots, setPublishedSnapshots,
    compareVersionA, setCompareVersionA, compareVersionB, setCompareVersionB,
    compareResult, setCompareResult, compareShowUnchanged, setCompareShowUnchanged,
    compareFilterType, setCompareFilterType,
    ganttEditingTask, setGanttEditingTask,
    progressEditingTask, setProgressEditingTask,
    parentTimeWarning, setParentTimeWarning,
    milestoneTimeWarning, setMilestoneTimeWarning,
    predecessorWarning, setPredecessorWarning,
    level2PlanTasks, setLevel2PlanTasks,
    activeLevel2Plan,
  } = usePlanStore()

  const transferStore = useTransferStore()
  const { transferConfigView, setTransferConfigView } = transferStore

  const { selectedProject } = useProjectStore()

  const [newCustomTypeName, setNewCustomTypeName] = useState('')

  const allPlanTypes = [...LEVEL2_PLAN_TYPES, ...customTypes]
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

  // 配置中心使用模板数据（无日期/工期）
  const [configTasks, setConfigTasks] = useState(() => LEVEL1_TEMPLATE_TASKS.map(t => ({ ...t })))

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
  const currentViewColumns = getColumnsForView(currentViewMode)
  const currentViewDefaultCols = currentViewColumns.filter((c: any) => c.default).map((c: any) => c.key)
  const visibleColumns = columnsByView[getViewKey()] || currentViewDefaultCols
  const setVisibleColumns = (cols: string[]) => {
    setColumnsByView((prev: Record<string, string[]>) => ({ ...prev, [getViewKey()]: cols }))
  }

  // Scope key for collapse
  const getScopeKey = (): string | null => {
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
        const maxDepth = isLevel2Mode ? 3 : 2
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
            {canAddChild && <Tooltip title="添加子项"><Button type="text" size="small" icon={<PlusOutlined />} style={{ color: '#6366f1' }} onClick={(e) => { e.stopPropagation(); handleAddSubTask(record.id) }} /></Tooltip>}
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
      if (visibleColumns.includes('responsible')) cols.push({ title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 100, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, responsible: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <Space size={4}><Avatar size={18} style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', fontSize: 10 }}>{val[0]}</Avatar><span style={{ fontSize: 13 }}>{val}</span></Space> : <span style={{ color: '#e5e7eb' }}>-</span>) })
      if (visibleColumns.includes('predecessor')) cols.push({ title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 100, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" placeholder="如: 1.1" onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, predecessor: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <Tag style={{ borderRadius: 4, fontSize: 12 }}>{val}</Tag> : <span style={{ color: '#e5e7eb' }}>-</span>) })
      if (visibleColumns.includes('planStartDate')) cols.push({ title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 130, render: (val: string) => <span style={{ fontSize: 12, color: '#e5e7eb' }}>{val || '-'}</span> })
      if (visibleColumns.includes('planEndDate')) cols.push({ title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 130, render: (val: string) => <span style={{ fontSize: 12, color: '#e5e7eb' }}>{val || '-'}</span> })
      if (visibleColumns.includes('estimatedDays')) cols.push({ title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 90, render: (val: number) => <span style={{ fontSize: 12, color: '#e5e7eb' }}>{val || '-'}</span> })
      if (visibleColumns.includes('status')) cols.push({ title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === '已完成' ? 'success' : s === '进行中' ? 'processing' : 'default'} style={{ borderRadius: 4, fontSize: 12 }}>{s}</Tag> })
      if (visibleColumns.includes('progress')) cols.push({ title: '进度', dataIndex: 'progress', key: 'progress', width: 130, render: (p: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={p} size="small" showInfo={false} strokeColor={p === 100 ? '#52c41a' : '#6366f1'} style={{ flex: 1, marginBottom: 0 }} />
          <span style={{ fontSize: 11, color: p === 100 ? '#52c41a' : '#4b5563', fontWeight: 500, minWidth: 32 }}>{p}%</span>
        </div>
      ) })
      if (isEditMode) cols.push({ title: '操作', key: 'action', width: 60, fixed: 'right', render: (_: any, record: any) => (<Popconfirm title="确认删除" description={`删除 "${record.taskName}" 及其子任务？`} onConfirm={() => { const filtered = tableTasks.filter((t: any) => t.id !== record.id && t.parentId !== record.id && !(t.parentId && tableTasks.find((p2: any) => p2.id === t.parentId)?.parentId === record.id)); currentSetTasks(filtered); message.success(`已删除任务: ${record.id}`) }} okText="确认" cancelText="取消"><Button type="text" icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 4 }} /></Popconfirm>) })
      return cols
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
              const newTask: any = { id: newId, order: maxOrder + 1, taskName: '新活动', status: '未开始', progress: 0, responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
              if (isLevel2Custom && customTasks?.[0]?.planId) newTask.planId = customTasks[0].planId
              currentSetTasks([...tableTasks, newTask]); message.success(`已添加一级活动: ${newId}`)
            }}>添加新活动</Button>
          </div>
        )}
      </div>
    )
  }

  const handleAddSubTask = (parentId: string) => {
    const isLevel2Context = planLevel === 'level2'
    const isLevel2TaskContext = isLevel2Context && activeLevel2Plan
    const currentTasks = isLevel2TaskContext ? level2PlanTasks.filter((t: any) => t.planId === activeLevel2Plan) : configTasks
    const parentTask = currentTasks.find((t: any) => t.id === parentId)
    if (!parentTask) return
    const depth = getTaskDepth(parentTask, currentTasks)
    const maxDepth = isLevel2Context ? 3 : 2
    if (depth + 1 >= maxDepth) {
      message.warning(`${isLevel2Context ? '二级' : '一级'}计划最多支持${maxDepth}层活动`)
      return
    }
    const siblingTasks = currentTasks.filter((t: any) => t.parentId === parentId)
    const newOrder = siblingTasks.length + 1
    const newId = `${parentId}.${newOrder}`
    const newTask: any = { id: newId, parentId, order: newOrder, taskName: '新子任务', status: '未开始', progress: 0, responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
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
  const handleCreateRevision = () => {
    const maxVersionNum = versions.reduce((max, v) => {
      const num = parseInt(v.versionNo.replace('V', ''))
      return num > max ? num : max
    }, 0)
    const newVersionNum = maxVersionNum + 1
    const newVersionId = `v${newVersionNum}`
    const clonedTasks = LEVEL1_TEMPLATE_TASKS.map(t => ({ ...t }))
    const newVersion = { id: newVersionId, versionNo: `V${newVersionNum}`, status: '修订中' }
    setVersions([...versions, newVersion])
    setCurrentVersion(newVersionId)
    setConfigTasks(clonedTasks)
    message.success(`已创建修订版本 V${newVersionNum}`)
  }

  const handlePublish = () => {
    const prevPublished = versions
      .filter(v => v.status === '已发布' && v.id !== currentVersion)
      .sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))[0]
    const baselineTasks: any[] = prevPublished ? (publishedSnapshots[prevPublished.id] || []) : []
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
    setPublishedSnapshots(prev => ({ ...prev, [publishedVersionId]: JSON.parse(JSON.stringify(configTasks)) }))

    const versionNo = publishedVersion?.versionNo || publishedVersionId
    if (changes.length > 0) {
      notifyPublishChanges(versionNo, changes, MOCK_USER_MAP)
    }
    message.success('发布成功')
  }

  const renderActionButtons = () => {
    if (isCurrentDraft) return (<Space><Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{currentVersionData?.versionNo}({currentVersionData?.status})</Tag><Tag color="green" style={{ fontSize: 12 }}>自动保存</Tag><Button type="primary" icon={<SaveOutlined />} onClick={handlePublish}>发布</Button></Space>)
    return (<Space>{!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRevision}>创建修订</Button>}<Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)}>历史版本对比</Button></Space>)
  }

  // Build transferProps for TransferConfig
  const transferProps = {
    selectedProject, currentUser: transferStore.currentUser,
    transferView: transferStore.transferView, setTransferView: transferStore.setTransferView,
    transferConfigView, setTransferConfigView,
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
    const getRowBg = (type: string) => { if (type === '新增') return '#f6ffed'; if (type === '删除') return '#fff2f0'; if (type === '修改') return 'rgba(99,102,241,0.06)'; return undefined }
    const renderDiffCell = (row: CompareTableRow, fieldKey: string, value: any) => {
      const diff = row.fieldDiffs.find((d: FieldDiff) => d.field === fieldKey)
      if (row.changeType === '修改' && diff) {
        return (<Tooltip title={<div style={{ fontSize: 12 }}><div>修改人: {row.modifier}</div><div>修改时间: {row.modifyTime}</div></div>}><div style={{ lineHeight: 1.6 }}><div style={{ color: '#ff4d4f', fontSize: 11, textDecoration: 'line-through', opacity: 0.7 }}>{diff.oldValue}</div><div style={{ color: '#6366f1', fontWeight: 600, fontSize: 12 }}>{diff.newValue}</div></div></Tooltip>)
      }
      if (row.changeType === '新增') return <span style={{ color: '#52c41a', fontWeight: 500 }}>{value || '-'}</span>
      if (row.changeType === '删除') return <span style={{ color: '#ff4d4f', textDecoration: 'line-through', opacity: 0.7 }}>{value || '-'}</span>
      return <span style={{ color: '#4b5563' }}>{value || '-'}</span>
    }
    const compareColumns: any[] = [
      { title: '序号', dataIndex: 'taskId', key: 'taskId', width: 70, fixed: 'left', render: (val: string, row: CompareTableRow) => (<span style={{ fontWeight: 600, fontSize: 12, color: row.changeType === '新增' ? '#52c41a' : row.changeType === '删除' ? '#ff4d4f' : row.changeType === '修改' ? '#6366f1' : '#9ca3af' }}>{val}</span>) },
      { title: '变更类型', dataIndex: 'changeType', key: 'changeType', width: 80, fixed: 'left', render: (val: string) => { const conf: Record<string, { color: string; bg: string }> = { '新增': { color: '#52c41a', bg: '#f6ffed' }, '删除': { color: '#ff4d4f', bg: '#fff2f0' }, '修改': { color: '#6366f1', bg: 'rgba(99,102,241,0.06)' }, '未变更': { color: '#9ca3af', bg: '#fafafa' } }; const c = conf[val]; return c ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: c.color, background: c.bg, border: `1px solid ${c.color}20` }}>{val}</span> : null } },
      { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 160, fixed: 'left', ellipsis: true, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'taskName', val) },
      { title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 80, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'responsible', val) },
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
            { label: '变更总计', value: changedRows.length, color: '#6366f1', filterVal: 'all' },
            { label: '新增', value: stats.added, color: '#52c41a', filterVal: '新增' },
            { label: '修改', value: stats.modified, color: '#6366f1', filterVal: '修改' },
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
    <div>
      {/* Config tab navigation */}
      <Card size="small" style={{ marginBottom: 20, borderRadius: 8 }} styles={{ body: { padding: '4px 16px' } }}>
        <Tabs
          activeKey={configTab}
          onChange={(key) => { setConfigTab(key); if (key === 'transfer') setTransferConfigView('home'); }}
          style={{ marginBottom: 0 }}
          items={[
            { key: 'plan', label: <Space size={6}><CalendarOutlined />计划模板配置</Space> },
            { key: 'transfer', label: <Space size={6}><SwapOutlined />转维材料模板配置</Space> },
          ]}
        />
      </Card>

      {/* Transfer config */}
      {configTab === 'transfer' && <TransferConfig {...transferProps} />}

      {/* Plan config */}
      {configTab === 'plan' && (
        <Row gutter={20}>
          <Col span={sidebarCollapsed ? 1 : 4}>
            <Card
              size="small"
              style={{ borderRadius: 8, position: 'sticky', top: 24 }}
              styles={{
                header: { background: '#f8fafc', borderBottom: '1px solid #f3f4f6', padding: '8px 12px', minHeight: 40 },
                body: { padding: sidebarCollapsed ? '8px 4px' : '8px' },
              }}
              title={!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>项目类型</span>}
              extra={<Button type="text" size="small" icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setSidebarCollapsed(!sidebarCollapsed)} />}
            >
              {!sidebarCollapsed && <Menu mode="inline" selectedKeys={[selectedProjectType]} style={{ border: 'none', fontSize: 13 }} items={PROJECT_TYPES.map(t => ({ key: t, label: <span style={{ fontWeight: selectedProjectType === t ? 500 : 400 }}>{t}</span>, onClick: () => navigateWithEditGuard(() => setSelectedProjectType(t)) }))} />}
            </Card>
          </Col>
          <Col span={sidebarCollapsed ? 23 : 20}>
            {/* Config header */}
            <Card size="small" style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
              <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)', borderBottom: '1px solid #e5e7eb' }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space size={8} align="center">
                      <CalendarOutlined style={{ color: '#6366f1', fontSize: 16 }} />
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{selectedProjectType}</span>
                      <Divider type="vertical" style={{ height: 16, margin: '0 4px' }} />
                      <span style={{ fontSize: 14, color: '#4b5563' }}>计划模板配置</span>
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af', paddingLeft: 24 }}>配置和管理项目计划模板</div>
                  </Col>
                </Row>
              </div>
              <div style={{ padding: '4px 16px' }}>
                <Tabs activeKey={planLevel} onChange={(key) => navigateWithEditGuard(() => setPlanLevel(key))} style={{ marginBottom: 0 }} items={[{ key: 'level1', label: <span style={{ fontWeight: 500 }}>一级计划</span> }, { key: 'level2', label: <span style={{ fontWeight: 500 }}>二级计划</span> }]} />
              </div>
            </Card>

            {/* L2 plan type selector */}
            {planLevel === 'level2' && (
              <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '10px 16px' } }}>
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
            <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '10px 16px' } }}>
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
                    <Tooltip title="自定义列">
                      <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
                    </Tooltip>
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
            <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
              {viewMode === 'gantt' ? renderGanttChart() : renderTaskTable()}
            </Card>
          </Col>
        </Row>
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
        title={<Space><HistoryOutlined style={{ color: '#6366f1' }} /><span style={{ fontWeight: 600 }}>历史版本对比</span></Space>}
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
              const vANum = parseInt(versionA.versionNo.replace('V', ''))
              const vBNum = parseInt(versionB.versionNo.replace('V', ''))
              const oldTasks = versionA.status === '已发布' ? LEVEL1_TEMPLATE_TASKS : configTasks
              let newTasks = versionB.status === '已发布' ? LEVEL1_TEMPLATE_TASKS : configTasks
              if (vANum !== vBNum) {
                newTasks = [
                  ...configTasks.map(t => {
                    if (t.id === '2.1') return { ...t, taskName: 'STR2(更新)', status: '已完成', progress: 100 }
                    if (t.id === '3') return { ...t, responsible: '李四', planStartDate: '2026-02-20' }
                    return t
                  }),
                  { id: '5', order: 5, taskName: '维护', status: '未开始', progress: 0, responsible: '', predecessor: '4', planStartDate: '2026-04-16', planEndDate: '2026-05-15', estimatedDays: 30, actualStartDate: '', actualEndDate: '', actualDays: 0 }
                ]
              }
              const result = compareVersionsForTable(oldTasks as any, newTasks as any)
              setCompareResult(result as CompareTableRow[])
              setCompareFilterType('all')
              message.success('对比完成')
            }
          }}>开始对比</Button>
        </div>
        {renderVersionCompareResult()}
      </Modal>

      {/* Column modal */}
      <Modal className="pms-modal" title={`自定义列 - ${currentViewMode === 'gantt' ? '甘特图' : '竖版表格'}`} open={showColumnModal} onCancel={() => setShowColumnModal(false)} footer={[<Button key="reset" onClick={() => setVisibleColumns(currentViewDefaultCols)}>重置</Button>, <Button key="cancel" onClick={() => setShowColumnModal(false)}>取消</Button>, <Button key="ok" type="primary" onClick={() => { setShowColumnModal(false); message.success('列配置已保存') }}>确定</Button>]}>
        <Checkbox.Group value={visibleColumns} onChange={(vals) => setVisibleColumns(vals as string[])}>
          <Row>{currentViewColumns.map((c: any) => <Col span={12} key={c.key}><Checkbox value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox></Col>)}</Row>
        </Checkbox.Group>
      </Modal>
    </div>
  )
}
