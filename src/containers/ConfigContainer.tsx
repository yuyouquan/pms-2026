'use client'

import { useState, useMemo } from 'react'
import {
  Card, Tabs, Row, Col, Space, Divider, Tag, Menu, Button, Select,
  Input, Tooltip, Modal, Form, Checkbox, message,
} from 'antd'
import {
  CalendarOutlined, SwapOutlined, PlusOutlined, SaveOutlined,
  HistoryOutlined, SearchOutlined, AppstoreOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, PlusSquareOutlined, MinusSquareOutlined,
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ColumnsType } from 'antd/es/table'
import { useUiStore } from '@/stores/ui'
import { usePlanStore, LEVEL2_PLAN_TYPES, LEVEL1_TASKS, ALL_COLUMNS, TABLE_COLUMNS, GANTT_COLUMNS, getColumnsForView } from '@/stores/plan'
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

  const navigateWithEditGuard = (action: () => void) => {
    if (isEditMode) {
      setPendingNavigation(() => action)
      setShowLeaveConfirm(true)
    } else {
      action()
    }
  }

  const allPlanTypes = [...LEVEL2_PLAN_TYPES, ...customTypes]
  const hasDraftVersion = versions.some(v => v.status === '修订中')
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'

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
    const allParents = getAllExpandableIds(tasks)
    setCollapsedNodes(prev => ({ ...prev, [key]: new Set(allParents) }))
  }

  const filteredTasks = (tasks as any[]).filter((task: any) => {
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
    const tableTasks = customTasks || tasks
    const currentSetTasks = isLevel2Custom ? (newTasks: any[]) => {
      const planId = customTasks?.[0]?.planId
      if (planId) {
        setLevel2PlanTasks(prev => [...prev.filter(t => t.planId !== planId), ...newTasks])
      }
    } : setTasks

    const flatTasks = tableTasks.map((task: any) => ({ ...task, indentLevel: getTaskDepth(task, tableTasks) }))
    const scopeKey = getScopeKey()
    const collapsedSet = scopeKey ? (collapsedNodes[scopeKey] || new Set<string>()) : new Set<string>()
    const expandEnabled = scopeKey !== null
    const visibleTasks = expandEnabled ? filterByCollapsed(flatTasks, collapsedSet) : flatTasks

    const getColumns = (): ColumnsType<any> => {
      const cols: ColumnsType<any> = []
      // Simplified columns for config context - same structure as page.tsx
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
                <span style={{ fontSize: 10 }}>&#9660;</span>
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
        return <span style={{ color: depth === 0 ? '#111827' : '#4b5563', fontWeight: depth === 0 ? 600 : 400 }}>{name}</span>
      } })
      if (visibleColumns.includes('responsible')) cols.push({ title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 100, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, responsible: e.target.value } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 13 }}>{val || '-'}</span> })
      if (visibleColumns.includes('status')) cols.push({ title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === '已完成' ? 'success' : s === '进行中' ? 'processing' : 'default'} style={{ borderRadius: 4, fontSize: 12 }}>{s}</Tag> })
      if (visibleColumns.includes('progress')) cols.push({ title: '进度', dataIndex: 'progress', key: 'progress', width: 100, render: (p: number) => <span>{p}%</span> })
      return cols
    }

    const TableComponents = isEditMode ? { body: { row: SortableRow } } : undefined
    return (
      <div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={() => {}}><SortableContext items={visibleTasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}><table className={`pms-table ${isEditMode ? 'pms-table-edit' : ''}`}></table></SortableContext></DndContext>
        {/* For simplicity, use the same Ant Design Table */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={() => {}}>
          <SortableContext items={visibleTasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
            <table style={{ display: 'none' }} />
          </SortableContext>
        </DndContext>
        {/* Actual table rendering placeholder — relies on Ant Design Table from PlanModule */}
      </div>
    )
  }

  const handleAddSubTask = (parentId: string) => {
    const isLevel2Context = planLevel === 'level2'
    const isLevel2TaskContext = isLevel2Context && activeLevel2Plan
    const currentTasks = isLevel2TaskContext ? level2PlanTasks.filter((t: any) => t.planId === activeLevel2Plan) : tasks
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
      const newTasks = [...tasks]
      const globalIndex = tasks.findIndex((t: any) => t.id === parentId)
      let globalInsertIndex = globalIndex + 1
      for (let i = globalIndex + 1; i < tasks.length; i++) {
        if (tasks[i].parentId === parentId) globalInsertIndex = i + 1
        else break
      }
      newTasks.splice(globalInsertIndex, 0, newTask)
      setTasks(newTasks)
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
    const clonedTasks = LEVEL1_TASKS.map(t => ({ ...t }))
    const newVersion = { id: newVersionId, versionNo: `V${newVersionNum}`, status: '修订中' }
    setVersions([...versions, newVersion])
    setCurrentVersion(newVersionId)
    setTasks(clonedTasks)
    message.success(`已创建修订版本 V${newVersionNum}`)
  }

  const handlePublish = () => {
    const prevPublished = versions
      .filter(v => v.status === '已发布' && v.id !== currentVersion)
      .sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))[0]
    const baselineTasks: any[] = prevPublished ? (publishedSnapshots[prevPublished.id] || []) : []
    const changes: TaskChange[] = []
    const baselineMap = new Map<string, any>(baselineTasks.map(t => [t.id, t]))
    for (const curr of tasks) {
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
    setPublishedSnapshots(prev => ({ ...prev, [publishedVersionId]: JSON.parse(JSON.stringify(tasks)) }))

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
    let filteredData = compareShowUnchanged ? compareResult : changedRows
    if (compareFilterType !== 'all') {
      filteredData = filteredData.filter(r => r.changeType === compareFilterType)
    }
    return <div style={{ marginTop: 16 }}><div style={{ fontSize: 12, color: '#9ca3af' }}>共 {filteredData.length} 条记录</div></div>
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
              const oldTasks = versionA.status === '已发布' ? LEVEL1_TASKS : tasks
              let newTasks = versionB.status === '已发布' ? LEVEL1_TASKS : tasks
              if (vANum !== vBNum) {
                newTasks = [
                  ...tasks.map(t => {
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
