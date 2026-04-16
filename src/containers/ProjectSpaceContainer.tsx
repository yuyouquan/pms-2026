'use client'

/**
 * ProjectSpaceContainer
 *
 * Extracted from page.tsx — contains renderProjectSpace() and ALL nested functions:
 * renderProjectBasicInfo, renderProjectPlan, renderProjectPlanOverview,
 * renderProjectOverview, renderProjectRequirements, renderProjectPlanInfo,
 * renderHorizontalTable, renderTaskTable, renderGanttChart, renderActionButtons,
 * renderVersionCompareResult, version compare Modal, custom column Modal,
 * create L2 plan Modal, and all helper functions.
 *
 * This is the LARGEST container, reading from ALL 5 stores.
 */

import { useState, useMemo, useEffect, useRef, type CSSProperties } from 'react'
import {
  Card, Tabs, Table, Button, Progress, Tag, Space, Row, Col, Badge,
  Menu, message, notification, Select, Input, Popconfirm, Tooltip, Modal,
  Checkbox, DatePicker, Form, Avatar, Empty, Slider, Alert, Statistic,
  Descriptions, Divider, Radio, Dropdown, Breadcrumb, Collapse,
  Typography, Pagination
} from 'antd'
import dayjs from 'dayjs'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import {
  PlusOutlined, SaveOutlined, HistoryOutlined, AppstoreOutlined,
  DeleteOutlined, EditOutlined, ProjectOutlined, UnorderedListOutlined,
  CheckSquareOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SearchOutlined,
  HolderOutlined, BarChartOutlined, CalendarOutlined, FileTextOutlined,
  SettingOutlined, TeamOutlined, WarningOutlined, BugOutlined, FolderOutlined,
  DownOutlined, ExclamationCircleOutlined, SafetyCertificateOutlined,
  SwapOutlined, AuditOutlined, DownloadOutlined, CloseCircleOutlined,
  SafetyOutlined, SendOutlined, DeploymentUnitOutlined, ShareAltOutlined,
  PlusSquareOutlined, MinusSquareOutlined, CaretDownOutlined, StopOutlined,
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ColumnsType } from 'antd/es/table'
import { compareVersionsForTable, type CompareTableRow, type FieldDiff } from '@/lib/versionCompare'
import { notifyPublishChanges, notifyDueTasks } from '@/lib/feishu-notify'
import type { TaskChange, PlanDueNotice } from '@/types/plan-notify'
import { exportSheet, exportMergedSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'

import { useUiStore } from '@/stores/ui'
import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'
import { usePlanStore, LEVEL2_PLAN_TYPES, FIXED_LEVEL2_PLANS, VERSION_DATA, LEVEL1_TASKS, ALL_COLUMNS, TABLE_COLUMNS, GANTT_COLUMNS, getColumnsForView } from '@/stores/plan'
import { useTransferStore } from '@/stores/transfer'
import { usePermissionStore } from '@/stores/permission'
import { PermissionConfig } from '@/components/permission/PermissionModule'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import { TransferApply, TransferDetail, TransferEntry, TransferReview, TransferSqaReview } from '@/components/transfer/TransferModule'
import RequirementDevPlan from '@/components/plans/RequirementDevPlan'
import VersionTrainPlan from '@/components/plans/VersionTrainPlan'
import { PROJECT_STATUS_CONFIG } from '@/data/projects'
import {
  DHTMLXGantt, DragHandle, SortableRow, ClickToEditDate, MiniPipeline,
  getTaskDepth, hasChildren, filterByCollapsed, getAllExpandableIds,
  mergePlans, shiftDateStrForExport,
  NOTIFY_DIFF_FIELDS, MOCK_USER_MAP,
} from '@/components/shared/PlanHelpers'
import {
  ROLE_COLORS,
  type TransferApplication,
} from '@/mock/transfer-maintenance'
import { ProjectSpaceHeader } from '@/containers/AppShell'

const { Option } = Select

export default function ProjectSpaceContainer() {
  // ═══════ Store hooks ═══════
  const ui = useUiStore()
  const proj = useProjectStore()
  const plan = usePlanStore()
  const transfer = useTransferStore()
  const perm = usePermissionStore()

  // Destructure for convenience (all come from stores)
  const {
    activeModule, setActiveModule, projectSpaceModule, setProjectSpaceModule,
    isEditMode, setIsEditMode, showVersionCompare, setShowVersionCompare,
    showColumnModal, setShowColumnModal, showCreateLevel2Plan, setShowCreateLevel2Plan,
    showProjectSearch, setShowProjectSearch, projectSearchText, setProjectSearchText,
    handleConfirmLeave, handleCancelLeave, showLeaveConfirm,
    setPendingNavigation, setShowLeaveConfirm: setShowLeaveConfirmFn,
    sidebarCollapsed,
  } = ui

  const {
    projects, selectedProject, setSelectedProject, setProjects,
    currentLoginUser,
    basicInfoEditMode, setBasicInfoEditMode, editingProjectFields, setEditingProjectFields,
    selectedMarketTab, setSelectedMarketTab,
  } = proj

  const {
    projectPlanLevel, setProjectPlanLevel, projectPlanViewMode, setProjectPlanViewMode,
    projectPlanOverviewTab, setProjectPlanOverviewTab, planMetaCollapsed, setPlanMetaCollapsed,
    versions, setVersions, currentVersion, setCurrentVersion,
    tasks, setTasks, searchText, setSearchText,
    level2PlanTasks, setLevel2PlanTasks, level2PlanMilestones, setLevel2PlanMilestones,
    createdLevel2Plans, setCreatedLevel2Plans, activeLevel2Plan, setActiveLevel2Plan,
    level2PlanMeta, setLevel2PlanMeta, createFormValues, setCreateFormValues,
    selectedLevel2PlanType, setSelectedLevel2PlanType,
    selectedMilestones, setSelectedMilestones, selectedMRVersion, setSelectedMRVersion,
    columnsByView, setColumnsByView, collapsedNodes, setCollapsedNodes,
    publishedSnapshots, setPublishedSnapshots,
    compareVersionA, setCompareVersionA, compareVersionB, setCompareVersionB,
    compareResult, setCompareResult, compareShowUnchanged, setCompareShowUnchanged,
    compareFilterType, setCompareFilterType,
    marketPlanData,
    ganttEditingTask, setGanttEditingTask, progressEditingTask, setProgressEditingTask,
    parentTimeWarning, setParentTimeWarning,
    milestoneTimeWarning, setMilestoneTimeWarning,
    predecessorWarning, setPredecessorWarning,
    customTypes,
    planLevel, selectedPlanType,
  } = plan

  const {
    roles, setRoles, rolePermissions, setRolePermissions,
    showAddRoleModal, setShowAddRoleModal, newRoleName, setNewRoleName,
    editingRoleName, setEditingRoleName, editRoleNameValue, setEditRoleNameValue,
    permissionActiveRole, setPermissionActiveRole, permConfigTab, setPermConfigTab,
  } = perm

  // ═══════ Local state ═══════
  const lastDueCheckedProjectRef = useRef<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  // ═══════ Derived ═══════
  const hasDraftVersion = versions.some(v => v.status === '修订中')
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'
  const latestPublishedVersion = versions.filter(v => v.status === '已发布').sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))[0]
  const isLatestPublished = !isCurrentDraft && currentVersion === latestPublishedVersion?.id
  const hasPublishedLevel1Plan = versions.some(v => v.status === '已发布')
  const allPlanTypes = [...LEVEL2_PLAN_TYPES, ...customTypes]

  const isWholeMachineProject = selectedProject?.type === '整机产品项目'

  const currentProjectTransferApps = useMemo(() =>
    transfer.transferApplications.filter(a => a.projectName === selectedProject?.name),
    [transfer.transferApplications, selectedProject]
  )

  // View columns
  const getViewKey = () => `project-${projectPlanLevel}-${projectPlanViewMode}`
  const currentViewMode = projectPlanViewMode
  const currentViewColumns = getColumnsForView(currentViewMode)
  const currentViewDefaultCols = currentViewColumns.filter((c: any) => c.default).map((c: any) => c.key)
  const visibleColumns = columnsByView[getViewKey()] || currentViewDefaultCols
  const setVisibleColumns = (cols: string[]) => {
    setColumnsByView((prev: Record<string, string[]>) => ({ ...prev, [getViewKey()]: cols }))
  }

  // Scope key for collapse
  const getScopeKey = (): string | null => {
    if (!selectedProject) return null
    if (projectPlanLevel === 'level1') return `${selectedProject.id}::level1`
    if (projectPlanLevel === 'level2' && activeLevel2Plan) return `${selectedProject.id}::level2::${activeLevel2Plan}`
    return null
  }

  const navigateWithEditGuard = (action: () => void) => {
    if (isEditMode && !isCurrentDraft) {
      setPendingNavigation(() => action)
      setShowLeaveConfirmFn(true)
    } else {
      action()
    }
  }

  // ═══════ Effects ═══════
  // Draft auto-edit mode
  useEffect(() => {
    if (isCurrentDraft) {
      setIsEditMode(true)
      if (projectPlanViewMode === 'horizontal') setProjectPlanViewMode('table')
    } else {
      setIsEditMode(false)
    }
  }, [currentVersion, isCurrentDraft])

  // Due task scanning
  useEffect(() => {
    if (activeModule !== 'projectSpace') return
    if (!selectedProject) return
    if (projectSpaceModule !== 'plan') return
    if (projectPlanLevel !== 'level1') return
    const key = selectedProject.id
    if (lastDueCheckedProjectRef.current === key) return
    lastDueCheckedProjectRef.current = key
    const latestPub = versions
      .filter(v => v.status === '已发布')
      .sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))[0]
    const scanTarget = latestPub && publishedSnapshots[latestPub.id] ? publishedSnapshots[latestPub.id] : tasks
    const notices = scanDueTasks(scanTarget)
    if (notices.length === 0) return
    notifyDueTasks(notices, MOCK_USER_MAP).then(notified => {
      if (notified > 0) {
        notification.warning({
          message: '任务到期提醒已推送',
          description: `项目 ${selectedProject.name} 发现 ${notices.length} 条到期/逾期任务，已通知 ${notified} 位责任人`,
          placement: 'topRight', duration: 5,
        })
      }
    })
  }, [selectedProject?.id, projectPlanLevel, activeModule, projectSpaceModule])

  // ═══════ Helper functions ═══════
  const toggleNode = (nodeId: string) => {
    const key = getScopeKey()
    if (!key) return
    setCollapsedNodes(prev => { const cur = new Set(prev[key] || []); if (cur.has(nodeId)) cur.delete(nodeId); else cur.add(nodeId); return { ...prev, [key]: cur } })
  }
  const expandAll = () => { const key = getScopeKey(); if (!key) return; setCollapsedNodes(prev => ({ ...prev, [key]: new Set<string>() })) }
  const collapseAll = () => {
    const key = getScopeKey(); if (!key) return
    const scopeTasks = projectPlanLevel === 'level1' ? tasks : level2PlanTasks.filter(t => t.planId === activeLevel2Plan)
    setCollapsedNodes(prev => ({ ...prev, [key]: new Set(getAllExpandableIds(scopeTasks)) }))
  }

  const filteredTasks = (tasks as any[]).filter((task: any) => {
    if (!searchText) return true
    const s = searchText.toLowerCase()
    return task.id.toLowerCase().includes(s) || task.taskName.toLowerCase().includes(s) || (task.responsible && task.responsible.toLowerCase().includes(s)) || (task.status && task.status.toLowerCase().includes(s))
  })

  const scanDueTasks = (taskList: any[]): PlanDueNotice[] => {
    const today = dayjs().startOf('day')
    const notices: PlanDueNotice[] = []
    for (const t of taskList) {
      if (!t.parentId) continue
      if (t.actualEndDate) continue
      if (!t.planEndDate || t.planEndDate === '-') continue
      const due = dayjs(t.planEndDate)
      if (!due.isValid()) continue
      const days = due.startOf('day').diff(today, 'day')
      if (days < 0) notices.push({ kind: 'overdue', task: t, daysUntilDue: days })
      else if (days <= 2) notices.push({ kind: 'due_soon', task: t, daysUntilDue: days })
    }
    return notices
  }

  const diffTasksForNotify = (baseline: any[], current: any[]): TaskChange[] => {
    const baselineMap = new Map<string, any>(baseline.map(t => [t.id, t]))
    const changes: TaskChange[] = []
    for (const curr of current) {
      const prev = baselineMap.get(curr.id)
      if (!prev) { changes.push({ kind: 'created', task: curr }); continue }
      const changedFields: string[] = []
      for (const f of NOTIFY_DIFF_FIELDS) { if ((prev[f] ?? '') !== (curr[f] ?? '')) changedFields.push(f) }
      if (changedFields.length > 0) changes.push({ kind: 'modified', task: curr, previous: prev, changedFields })
    }
    return changes
  }

  const handleAddSubTask = (parentId: string) => {
    const isLevel2Context = projectPlanLevel === 'level2'
    const isLevel2TaskContext = isLevel2Context && activeLevel2Plan
    const currentTasks = isLevel2TaskContext ? level2PlanTasks.filter(t => t.planId === activeLevel2Plan) : tasks
    const parentTask = currentTasks.find((t: any) => t.id === parentId)
    if (!parentTask) return
    const depth = getTaskDepth(parentTask, currentTasks)
    const maxDepth = isLevel2Context ? 3 : 2
    if (depth + 1 >= maxDepth) { message.warning(`${isLevel2Context ? '二级' : '一级'}计划最多支持${maxDepth}层活动`); return }
    const siblingTasks = currentTasks.filter((t: any) => t.parentId === parentId)
    const newOrder = siblingTasks.length + 1
    const newId = `${parentId}.${newOrder}`
    const newTask: any = { id: newId, parentId, order: newOrder, taskName: '新子任务', status: '未开始', progress: 0, responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
    if (isLevel2TaskContext && parentTask.planId) newTask.planId = parentTask.planId
    const parentIndex = currentTasks.findIndex((t: any) => t.id === parentId)
    let insertIndex = parentIndex + 1
    for (let i = parentIndex + 1; i < currentTasks.length; i++) {
      if (currentTasks[i].parentId === parentId || (currentTasks[i].parentId && currentTasks.find((t: any) => t.id === currentTasks[i].parentId)?.parentId === parentId)) insertIndex = i + 1
      else break
    }
    if (isLevel2TaskContext) {
      const updatedTasks = [...currentTasks]; updatedTasks.splice(insertIndex, 0, newTask)
      setLevel2PlanTasks(prev => [...prev.filter(t => t.planId !== activeLevel2Plan), ...updatedTasks])
    } else {
      const newTasks = [...tasks]; newTasks.splice(insertIndex, 0, newTask); setTasks(newTasks)
    }
    message.success(`已添加子任务: ${newId}`)
  }

  const handleProgressChange = (taskId: string, newProgress: number) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) { let s = t.status; if (newProgress === 100) s = '已完成'; else if (newProgress > 0) s = '进行中'; else s = '未开始'; return { ...t, progress: newProgress, status: s } }
      return t
    }))
    setProgressEditingTask(null); message.success('进度已更新')
  }

  const checkParentTimeConstraint = (): { valid: boolean; violations: any[] } => {
    const violations: any[] = []
    tasks.forEach(task => {
      if (task.parentId) {
        const parentTask = tasks.find(t => t.id === task.parentId)
        if (parentTask && parentTask.planStartDate && parentTask.planEndDate && task.planStartDate && task.planEndDate) {
          const ps = new Date(parentTask.planStartDate).getTime(); const pe = new Date(parentTask.planEndDate).getTime()
          const cs = new Date(task.planStartDate).getTime(); const ce = new Date(task.planEndDate).getTime()
          if (cs < ps || ce > pe) violations.push({ id: task.id, taskName: task.taskName, parentId: task.parentId, parentName: parentTask.taskName, childTime: `${task.planStartDate} ~ ${task.planEndDate}`, parentTime: `${parentTask.planStartDate} ~ ${parentTask.planEndDate}` })
        }
      }
    })
    return { valid: violations.length === 0, violations }
  }

  const checkMilestoneTimeConstraint = (l2Tasks: any[], milestoneIds: string[], l1Tasks: any[]) => {
    if (milestoneIds.length === 0) return { valid: true, violations: [] }
    const violations: any[] = []
    const milestoneTasks = l1Tasks.filter(t => milestoneIds.includes(t.id))
    if (milestoneTasks.length === 0) return { valid: true, violations: [] }
    let earliestStart = Infinity, latestEnd = -Infinity
    milestoneTasks.forEach(m => { if (m.planStartDate) { const s = new Date(m.planStartDate).getTime(); if (s < earliestStart) earliestStart = s } if (m.planEndDate) { const e = new Date(m.planEndDate).getTime(); if (e > latestEnd) latestEnd = e } })
    if (earliestStart === Infinity || latestEnd === -Infinity) return { valid: true, violations: [] }
    const msd = new Date(earliestStart).toISOString().split('T')[0]; const med = new Date(latestEnd).toISOString().split('T')[0]
    l2Tasks.forEach(task => { if (task.planStartDate && task.planEndDate) { const ts = new Date(task.planStartDate).getTime(); const te = new Date(task.planEndDate).getTime(); if (ts < earliestStart || te > latestEnd) violations.push({ id: task.id, taskName: task.taskName, taskTime: `${task.planStartDate} ~ ${task.planEndDate}`, milestoneRange: `${msd} ~ ${med}`, milestones: milestoneIds.join(', ') }) } })
    return { valid: violations.length === 0, violations }
  }

  const checkPredecessor = (task: any, field: 'planStartDate' | 'planEndDate', newDate: string): boolean => {
    if (!task.predecessor) return true
    const predTask = tasks.find(t => t.id === task.predecessor)
    if (!predTask || !predTask.planEndDate) return true
    if (field === 'planStartDate' && new Date(newDate).getTime() < new Date(predTask.planEndDate).getTime()) {
      setPredecessorWarning({ visible: true, task: { ...task, [field]: newDate }, message: `任务"${task.taskName}"的开始时间(${newDate})早于前置任务"${predTask.taskName}"的结束时间(${predTask.planEndDate})` })
      return false
    }
    return true
  }

  const handleGanttTimeChange = (taskId: string, field: 'planStartDate' | 'planEndDate', date: string) => {
    const task = tasks.find(t => t.id === taskId); if (!task) return
    if (!checkPredecessor(task, field, date)) return
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: date } : t)); setGanttEditingTask(null); message.success('时间已更新')
  }

  const confirmPredecessorChange = () => {
    if (!predecessorWarning.task) return
    setTasks(tasks.map(t => t.id === predecessorWarning.task.id ? predecessorWarning.task : t))
    setPredecessorWarning({ visible: false, task: null, message: '' }); setGanttEditingTask(null); message.success('时间已更新（已确认前置任务冲突）')
  }

  const handleCreateRevision = () => {
    const maxNum = versions.reduce((max, v) => { const n = parseInt(v.versionNo.replace('V', '')); return n > max ? n : max }, 0)
    const nn = maxNum + 1; const nid = `v${nn}`
    const clonedTasks = LEVEL1_TASKS.map(t => ({ ...t }))
    setVersions([...versions, { id: nid, versionNo: `V${nn}`, status: '修订中' }])
    setCurrentVersion(nid); setTasks(clonedTasks); message.success(`已创建修订版本 V${nn}`)
  }

  const handlePublish = () => {
    const prevPublished = versions.filter(v => v.status === '已发布' && v.id !== currentVersion).sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))[0]
    const baselineTasks: any[] = prevPublished ? (publishedSnapshots[prevPublished.id] || []) : []
    const changes = diffTasksForNotify(baselineTasks, tasks)
    const publishedVersionId = currentVersion; const publishedVersion = versions.find(v => v.id === publishedVersionId)
    setVersions(versions.map(v => v.id === publishedVersionId ? { ...v, status: '已发布' } : v))
    setPublishedSnapshots(prev => ({ ...prev, [publishedVersionId]: JSON.parse(JSON.stringify(tasks)) }))
    const versionNo = publishedVersion?.versionNo || publishedVersionId
    if (changes.length > 0) notifyPublishChanges(versionNo, changes, MOCK_USER_MAP).then(notified => {
      if (notified > 0) notification.info({ message: '已通过飞书通知责任人', description: `一级计划 ${versionNo} 发布，共 ${changes.length} 条变更，已通知 ${notified} 位责任人`, placement: 'topRight', duration: 5 })
    })
    message.success('发布成功')
  }

  // Basic info
  const startBasicInfoEdit = () => {
    if (!selectedProject) return; const p = selectedProject
    setEditingProjectFields({ productType: p.productType || '', developMode: p.developMode || '', currentNode: p.currentNode || '', healthStatus: p.healthStatus || 'normal', branchInfo: p.branchInfo || '', jenkinsUrl: p.jenkinsUrl || '', buildAddress: p.buildAddress || '', ppm: p.ppm || '', spm: p.spm || '', tpm: p.tpm || '', teamMembers: p.teamMembers || '', versionFiveRoles: p.versionFiveRoles || {}, projectDescription: p.projectDescription || '' })
    setBasicInfoEditMode(true)
  }
  const saveBasicInfoEdit = () => {
    if (!selectedProject) return; const updated = { ...selectedProject, ...editingProjectFields }
    setSelectedProject(updated); setProjects(prev => prev.map(p => p.id === updated.id ? updated : p)); setBasicInfoEditMode(false); message.success('基本信息已保存')
  }

  // Export functions
  const handleExportVerticalPlan = (scope: 'current' | 'all') => {
    const cols = scope === 'current' ? TABLE_COLUMNS.filter(c => visibleColumns.includes(c.key)) : TABLE_COLUMNS
    const exportCols: ExportColumn[] = cols.map(c => ({ key: c.key, title: c.title }))
    let rows: any[] = []
    if (projectPlanLevel === 'level1') { rows = scope === 'current' && searchText ? tasks.filter((t: any) => (t.taskName || '').toLowerCase().includes(searchText.toLowerCase())) : tasks }
    else if (projectPlanLevel === 'level2' && activeLevel2Plan && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1') {
      const l2 = level2PlanTasks.filter((t: any) => t.planId === activeLevel2Plan); rows = scope === 'current' && searchText ? l2.filter((t: any) => (t.taskName || '').toLowerCase().includes(searchText.toLowerCase())) : l2
    }
    const filename = `项目空间计划_${selectedProject?.name || '项目'}_${projectPlanLevel === 'level1' ? '一级计划' : '二级计划'}_竖版_${exportTimestamp()}.xlsx`
    exportSheet(rows, exportCols, filename, `${projectPlanLevel === 'level1' ? '一级' : '二级'}计划竖版`)
  }

  const handleExportHorizontalPlan = (_scope: 'current' | 'all') => {
    const stages = (tasks as any[]).filter(t => !t.parentId).sort((a, b) => a.order - b.order)
    const stageGroups = stages.map(stage => { const ms = (tasks as any[]).filter(t => t.parentId === stage.id).sort((a, b) => a.order - b.order); return { stage, milestones: ms, colSpan: ms.length || 1 } })
    const allMilestones = stageGroups.flatMap(({ stage, milestones }) => milestones.length > 0 ? milestones : [stage])
    if (allMilestones.length === 0) { message.warning('暂无可导出数据'); return }
    const headerRow0: (string | null)[] = ['版本', '开发周期']; const headerRow1: (string | null)[] = [null, null]
    const merges: any[] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }]
    let colCursor = 2
    for (const { stage, milestones, colSpan } of stageGroups) { headerRow0.push(stage.taskName); for (let i = 1; i < colSpan; i++) headerRow0.push(null); if (milestones.length > 0) { for (const m of milestones) headerRow1.push(m.taskName) } else headerRow1.push('-'); merges.push({ s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + colSpan - 1 } }); colCursor += colSpan }
    const publishedVersions = versions.filter(v => v.status === '已发布').sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))
    const latestNum = publishedVersions.length > 0 ? Math.max(...publishedVersions.map(v => parseInt(v.versionNo.replace('V', '')))) : 0
    const getVersionTasks = (versionNo: string) => { const vNum = parseInt(versionNo.replace('V', '')); if (vNum === latestNum) return tasks as any[]; const offsetDays = (latestNum - vNum) * 3; return (tasks as any[]).map(t => ({ ...t, planStartDate: t.planStartDate ? shiftDateStrForExport(t.planStartDate, -offsetDays) : '', planEndDate: t.planEndDate ? shiftDateStrForExport(t.planEndDate, -offsetDays) : '' })) }
    const calcCycleDays = (list: any[], sk: string, ek: string) => { const starts = list.map(t => t[sk]).filter(Boolean).map((d: string) => new Date(d).getTime()); const ends = list.map(t => t[ek]).filter(Boolean).map((d: string) => new Date(d).getTime()); if (starts.length === 0 || ends.length === 0) return '-'; const days = Math.ceil((Math.max(...ends) - Math.min(...starts)) / (1000 * 60 * 60 * 24)); return days > 0 ? days : '-' }
    const dataMatrix: (string | number)[][] = []
    for (const v of publishedVersions) { const vt = getVersionTasks(v.versionNo); const row: (string | number)[] = [v.versionNo, calcCycleDays(vt, 'planStartDate', 'planEndDate')]; for (const m of allMilestones) { const match = vt.find((t: any) => t.id === m.id); row.push(match?.planEndDate || '-') }; dataMatrix.push(row) }
    const actualRow: (string | number)[] = ['实际', calcCycleDays(tasks as any[], 'actualStartDate', 'actualEndDate')]; for (const m of allMilestones) { const t = (tasks as any[]).find((x: any) => x.id === m.id); actualRow.push(t?.actualEndDate || '-') }; dataMatrix.push(actualRow)
    const colWidths = [10, 10, ...allMilestones.map(() => 14)]
    exportMergedSheet([headerRow0, headerRow1], merges, dataMatrix, colWidths, `项目空间计划_${selectedProject?.name || '项目'}_一级计划_横版_${exportTimestamp()}.xlsx`, '一级计划横版')
  }

  // ═══════ Build transferProps ═══════
  const transferProps = {
    selectedProject, currentUser: transfer.currentUser,
    transferView: transfer.transferView, setTransferView: transfer.setTransferView,
    transferConfigView: transfer.transferConfigView, setTransferConfigView: transfer.setTransferConfigView,
    tmConfigSearchText: transfer.tmConfigSearchText, setTmConfigSearchText: transfer.setTmConfigSearchText,
    tmConfigSelectedVersion: transfer.tmConfigSelectedVersion, setTmConfigSelectedVersion: transfer.setTmConfigSelectedVersion,
    tmConfigDiffOpen: transfer.tmConfigDiffOpen, setTmConfigDiffOpen: transfer.setTmConfigDiffOpen,
    tmConfigDiffFrom: transfer.tmConfigDiffFrom, setTmConfigDiffFrom: transfer.setTmConfigDiffFrom,
    tmConfigDiffTo: transfer.tmConfigDiffTo, setTmConfigDiffTo: transfer.setTmConfigDiffTo,
    selectedTransferAppId: transfer.selectedTransferAppId, setSelectedTransferAppId: transfer.setSelectedTransferAppId,
    transferApplications: transfer.transferApplications, setTransferApplications: transfer.setTransferApplications,
    tmChecklistItems: transfer.tmChecklistItems, setTmChecklistItems: transfer.setTmChecklistItems,
    tmReviewElements: transfer.tmReviewElements, setTmReviewElements: transfer.setTmReviewElements,
    tmBlockTasks: transfer.tmBlockTasks, tmLegacyTasks: transfer.tmLegacyTasks,
    tmApplyDate: transfer.tmApplyDate, setTmApplyDate: transfer.setTmApplyDate,
    tmApplyRemark: transfer.tmApplyRemark, setTmApplyRemark: transfer.setTmApplyRemark,
    tmApplyTeam: transfer.tmApplyTeam, setTmApplyTeam: transfer.setTmApplyTeam,
    tmDetailModalVisible: transfer.tmDetailModalVisible, setTmDetailModalVisible: transfer.setTmDetailModalVisible,
    tmDetailModalTitle: transfer.tmDetailModalTitle, setTmDetailModalTitle: transfer.setTmDetailModalTitle,
    tmDetailModalContent: transfer.tmDetailModalContent, setTmDetailModalContent: transfer.setTmDetailModalContent,
    tmCloseModalVisible: transfer.tmCloseModalVisible, setTmCloseModalVisible: transfer.setTmCloseModalVisible,
    tmCloseAppId: transfer.tmCloseAppId, setTmCloseAppId: transfer.setTmCloseAppId,
    tmCloseReason: transfer.tmCloseReason, setTmCloseReason: transfer.setTmCloseReason,
    tmEntryTab: transfer.tmEntryTab, setTmEntryTab: transfer.setTmEntryTab,
    tmEntryModalOpen: transfer.tmEntryModalOpen, setTmEntryModalOpen: transfer.setTmEntryModalOpen,
    tmEntryModalRecord: transfer.tmEntryModalRecord, setTmEntryModalRecord: transfer.setTmEntryModalRecord,
    tmEntryContent: transfer.tmEntryContent, setTmEntryContent: transfer.setTmEntryContent,
    tmEntryActiveRole: transfer.tmEntryActiveRole, setTmEntryActiveRole: transfer.setTmEntryActiveRole,
    tmReviewTab: transfer.tmReviewTab, setTmReviewTab: transfer.setTmReviewTab,
    tmReviewModalOpen: transfer.tmReviewModalOpen, setTmReviewModalOpen: transfer.setTmReviewModalOpen,
    tmReviewAction: transfer.tmReviewAction, setTmReviewAction: transfer.setTmReviewAction,
    tmReviewRecord: transfer.tmReviewRecord, setTmReviewRecord: transfer.setTmReviewRecord,
    tmReviewComment: transfer.tmReviewComment, setTmReviewComment: transfer.setTmReviewComment,
    tmReviewActiveRole: transfer.tmReviewActiveRole, setTmReviewActiveRole: transfer.setTmReviewActiveRole,
    tmSqaComment: transfer.tmSqaComment, setTmSqaComment: transfer.setTmSqaComment,
    tmSqaModalOpen: transfer.tmSqaModalOpen, setTmSqaModalOpen: transfer.setTmSqaModalOpen,
    tmSqaAction: transfer.tmSqaAction, setTmSqaAction: transfer.setTmSqaAction,
    setProjectSpaceModule,
  }

  // ═══════ Render helpers — renderGanttChart ═══════
  const renderGanttChart = (customTasks?: any[]) => {
    const ganttTasks = customTasks || filteredTasks
    const key = getScopeKey()
    const collapsedSet = key ? (collapsedNodes[key] || new Set<string>()) : new Set<string>()
    return (
      <div style={{ border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <DHTMLXGantt tasks={ganttTasks} onTaskClick={(task) => message.info(`点击任务: ${task.text}`)} readOnly={!isEditMode} collapsedIds={collapsedSet}
          onCollapsedChange={(updater) => { if (!key) return; setCollapsedNodes(prev => { const c = prev[key] || new Set<string>(); return { ...prev, [key]: updater(c) } }) }}
        />
      </div>
    )
  }

  // ═══════ renderTaskTable ═══════
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
      if (visibleColumns.includes('id')) cols.push({ title: '序号', dataIndex: 'id', key: 'id', width: 130, fixed: 'left', render: (id: string, record: any) => {
        const depth = record.indentLevel || 0
        const isLevel2Mode = projectPlanLevel === 'level2'
        const maxDepth = isLevel2Mode ? 3 : 2
        const canAddChild = isEditMode && depth < maxDepth - 1
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 20 }}>
            {isEditMode && <DragHandle />}
            {expandEnabled && hasChildren(record.id, tableTasks) && (
              <span
                onClick={(e) => { e.stopPropagation(); toggleNode(record.id) }}
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', width: 14, height: 14, color: '#9ca3af', transition: 'transform 0.15s', transform: collapsedSet.has(record.id) ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              >
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
      if (visibleColumns.includes('planStartDate')) cols.push({ title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 130, render: (val: string, record: any) => isEditMode ? <DatePicker size="small" value={val ? dayjs(val) : null} style={{ width: 120 }} onChange={(date) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, planStartDate: date ? date.format('YYYY-MM-DD') : '' } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#4b5563' }}>{val || '-'}</span> })
      if (visibleColumns.includes('planEndDate')) cols.push({ title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 130, render: (val: string, record: any) => isEditMode ? <DatePicker size="small" value={val ? dayjs(val) : null} style={{ width: 120 }} onChange={(date) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, planEndDate: date ? date.format('YYYY-MM-DD') : '' } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#4b5563' }}>{val || '-'}</span> })
      if (visibleColumns.includes('estimatedDays')) cols.push({ title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 90, render: (val: number, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" type="number" style={{ width: 70 }} onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, estimatedDays: parseInt(e.target.value) || 0 } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#4b5563' }}>{val}天</span> })
      if (visibleColumns.includes('actualStartDate')) cols.push({ title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 130, render: (val: string, record: any) => {
        if (isLatestPublished && !isEditMode) return <ClickToEditDate value={val} onChange={(newVal) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, actualStartDate: newVal } : t); currentSetTasks(updated) }} disabledDate={(current) => record.actualEndDate ? current.isAfter(dayjs(record.actualEndDate), 'day') : false} />
        return <span style={{ fontSize: 12, color: '#4b5563' }}>{val || '-'}</span>
      } })
      if (visibleColumns.includes('actualEndDate')) cols.push({ title: '实际完成', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 130, render: (val: string, record: any) => {
        if (isLatestPublished && !isEditMode) return <ClickToEditDate value={val} onChange={(newVal) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, actualEndDate: newVal } : t); currentSetTasks(updated) }} disabledDate={(current) => record.actualStartDate ? current.isBefore(dayjs(record.actualStartDate), 'day') : false} />
        return <span style={{ fontSize: 12, color: '#4b5563' }}>{val || '-'}</span>
      } })
      if (visibleColumns.includes('actualDays')) cols.push({ title: '实际工期', dataIndex: 'actualDays', key: 'actualDays', width: 90, render: (val: number) => <span style={{ fontSize: 12, color: '#4b5563' }}>{val > 0 ? `${val}天` : '-'}</span> })
      if (visibleColumns.includes('status')) cols.push({ title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === '已完成' ? 'success' : s === '进行中' ? 'processing' : 'default'} style={{ borderRadius: 4, fontSize: 12 }}>{s}</Tag> })
      if (visibleColumns.includes('progress')) cols.push({ title: '进度', dataIndex: 'progress', key: 'progress', width: 130, render: (p: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={p} size="small" showInfo={false} strokeColor={p === 100 ? '#52c41a' : '#6366f1'} style={{ flex: 1, marginBottom: 0 }} />
          <span style={{ fontSize: 11, color: p === 100 ? '#52c41a' : '#4b5563', fontWeight: 500, minWidth: 32 }}>{p}%</span>
        </div>
      ) })
      if (isEditMode) cols.push({ title: '操作', key: 'action', width: 60, fixed: 'right', render: (_: any, record: any) => (<Popconfirm title="确认删除" description={`删除 "${record.taskName}" 及其子任务？`} onConfirm={() => { const filtered = tableTasks.filter((t: any) => t.id !== record.id && t.parentId !== record.id && !(t.parentId && tableTasks.find((p: any) => p.id === t.parentId)?.parentId === record.id)); currentSetTasks(filtered); message.success(`已删除任务: ${record.id}`) }} okText="确认" cancelText="取消"><Button type="text" icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 4 }} /></Popconfirm>) })
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
      const collectDescendants = (parentId: string, allTasks: any[]): any[] => {
        const children = allTasks.filter((t: any) => t.parentId === parentId)
        const result: any[] = []
        for (const child of children) { result.push(child); result.push(...collectDescendants(child.id, allTasks)) }
        return result
      }
      const descendants = collectDescendants(activeId, tableTasks)
      const movedBlock = [activeTask, ...descendants]
      const movedIds = new Set(movedBlock.map((t: any) => t.id))
      if (activeTask.parentId !== overTask.parentId) { message.warning('只能在同级任务之间拖动'); return }
      const remaining = tableTasks.filter((t: any) => !movedIds.has(t.id))
      const overIndex = remaining.findIndex((t: any) => t.id === overId)
      if (overIndex === -1) return
      const overDescendants = collectDescendants(overId, remaining)
      const insertAfterIndex = overIndex + overDescendants.length
      const originalActiveIndex = tableTasks.findIndex((t: any) => t.id === activeId)
      const originalOverIndex = tableTasks.findIndex((t: any) => t.id === overId)
      const movingDown = originalActiveIndex < originalOverIndex
      const insertIndex = movingDown ? insertAfterIndex + 1 : overIndex
      const newTasks = [...remaining]
      newTasks.splice(insertIndex, 0, ...movedBlock)
      const result = newTasks.map((t: any) => ({ ...t }))
      const counterMap = new Map<string, number>()
      const idMapping = new Map<string, string>()
      for (const task of result) {
        if (!task.parentId) {
          const count = (counterMap.get('root') || 0) + 1; counterMap.set('root', count)
          const newId = String(count); idMapping.set(task.id, newId); task.id = newId; task.order = count
        }
      }
      for (const task of result) {
        if (task.parentId && idMapping.has(task.parentId)) {
          const newParentId = idMapping.get(task.parentId)!
          const key2 = `child_${newParentId}`; const count = (counterMap.get(key2) || 0) + 1; counterMap.set(key2, count)
          const newId = `${newParentId}.${count}`; idMapping.set(task.id, newId); task.parentId = newParentId; task.id = newId; task.order = count
        }
      }
      for (const task of result) {
        if (task.parentId && !idMapping.has(task.id) && idMapping.has(task.parentId)) {
          const newParentId = idMapping.get(task.parentId)!
          const key2 = `child_${newParentId}`; const count = (counterMap.get(key2) || 0) + 1; counterMap.set(key2, count)
          const newId = `${newParentId}.${count}`; idMapping.set(task.id, newId); task.parentId = newParentId; task.id = newId; task.order = count
        }
      }
      currentSetTasks(result)
      message.success('任务顺序已更新，序号已重新生成')
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
              currentSetTasks([...tableTasks, newTask])
              message.success(`已添加一级活动: ${newId}`)
            }}>添加新活动</Button>
          </div>
        )}
      </div>
    )
  }

  // ═══════ renderHorizontalTable ═══════
  const renderHorizontalTable = () => {
    const stages = tasks.filter((t: any) => !t.parentId).sort((a: any, b: any) => a.order - b.order)
    const stageGroups = stages.map((stage: any) => {
      const milestones = tasks.filter((t: any) => t.parentId === stage.id).sort((a: any, b: any) => a.order - b.order)
      return { stage, milestones, colSpan: milestones.length || 1 }
    })
    const allMilestones = stageGroups.flatMap(({ stage, milestones }) => milestones.length > 0 ? milestones : [stage])
    const calcDevCycle = (taskList: any[]) => {
      const starts = taskList.map((t: any) => t.planStartDate).filter(Boolean).map((d: string) => new Date(d).getTime())
      const ends = taskList.map((t: any) => t.planEndDate).filter(Boolean).map((d: string) => new Date(d).getTime())
      if (starts.length === 0 || ends.length === 0) return '-'
      const earliest = Math.min(...starts); const latest = Math.max(...ends)
      const days = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24))
      return days > 0 ? days : '-'
    }
    const publishedVersions = versions.filter(v => v.status === '已发布').sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))
    const getVersionTasks = (versionId: string) => {
      const vNum = parseInt(versions.find(v => v.id === versionId)?.versionNo.replace('V', '') || '1')
      const latestNum = Math.max(...publishedVersions.map(v => parseInt(v.versionNo.replace('V', ''))))
      if (vNum === latestNum) return tasks
      const offsetDays = (latestNum - vNum) * 3
      return (tasks as any[]).map((t: any) => ({
        ...t,
        planEndDate: t.planEndDate ? (() => { const d = new Date(t.planEndDate); d.setDate(d.getDate() - offsetDays); return d.toISOString().split('T')[0] })() : '',
        planStartDate: t.planStartDate ? (() => { const d = new Date(t.planStartDate); d.setDate(d.getDate() - offsetDays); return d.toISOString().split('T')[0] })() : '',
      }))
    }
    const thStyle: CSSProperties = { background: '#f8fafc', fontWeight: 600, fontSize: 13, color: '#4b5563', padding: '10px 12px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'center' }
    const tdStyle: CSSProperties = { padding: '8px 12px', fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap', minWidth: 100, border: '1px solid #e5e7eb' }
    const versionThStyle: CSSProperties = { ...thStyle, position: 'sticky', left: 0, zIndex: 2, minWidth: 80, background: '#f8fafc' }
    const cycleThStyle: CSSProperties = { ...thStyle, position: 'sticky', left: 80, zIndex: 2, minWidth: 80, background: '#f8fafc' }
    const versionTdStyle: CSSProperties = { ...tdStyle, position: 'sticky', left: 0, zIndex: 1, fontWeight: 600, background: '#fff', minWidth: 80 }
    const cycleTdStyle: CSSProperties = { ...tdStyle, position: 'sticky', left: 80, zIndex: 1, background: '#fff', minWidth: 80 }
    const stageColors = ['#1890ff', '#52c41a', '#722ed1', '#faad14', '#eb2f96', '#13c2c2']
    return (
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...versionThStyle, borderBottom: 'none' }} rowSpan={2}>版本</th>
              <th style={{ ...cycleThStyle, borderBottom: 'none' }} rowSpan={2}>开发周期</th>
              {stageGroups.map(({ stage, colSpan }, i) => (
                <th key={stage.id} colSpan={colSpan} style={{ ...thStyle, background: `${stageColors[i % stageColors.length]}10`, color: stageColors[i % stageColors.length], borderBottom: `2px solid ${stageColors[i % stageColors.length]}` }}>{stage.taskName}</th>
              ))}
            </tr>
            <tr>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <th key={m.id} style={thStyle}>{m.taskName}</th>)
                  : [<th key={stage.id} style={{ ...thStyle, color: '#bfbfbf' }}>-</th>]
              )}
            </tr>
          </thead>
          <tbody>
            {publishedVersions.map((version, idx) => {
              const vTasks = getVersionTasks(version.id)
              const vMilestones = stageGroups.flatMap(({ stage, milestones: ms }) => {
                if (ms.length > 0) return ms.map((m: any) => { const vt = (vTasks as any[]).find((t: any) => t.id === m.id); return vt || m })
                const vt = (vTasks as any[]).find((t: any) => t.id === stage.id); return [vt || stage]
              })
              const devCycle = calcDevCycle(vTasks as any[])
              const isLatest = idx === 0
              return (
                <tr key={version.id} style={isLatest ? { background: '#fafffe' } : undefined}>
                  <td style={{ ...versionTdStyle, color: isLatest ? '#6366f1' : '#111827', background: isLatest ? '#f0f9ff' : '#fff' }}>{version.versionNo}</td>
                  <td style={{ ...cycleTdStyle, background: isLatest ? '#f0f9ff' : '#fff' }}><Tooltip title="最早计划开始到最晚计划完成的天数"><span>{devCycle}</span></Tooltip></td>
                  {vMilestones.map((m: any, mi: number) => (<td key={mi} style={tdStyle}>{m.planEndDate || '-'}</td>))}
                </tr>
              )
            })}
            <tr style={{ background: '#fffbe6' }}>
              <td style={{ ...versionTdStyle, color: '#d48806', background: '#fffbe6', fontSize: 12 }}><Tooltip title="最近已发布版本的实际完成数据"><span>实际</span></Tooltip></td>
              <td style={{ ...cycleTdStyle, background: '#fffbe6' }}><Tooltip title="最早实际开始到最晚实际完成的天数"><span>{(() => {
                const starts = (tasks as any[]).map((t: any) => t.actualStartDate).filter(Boolean).map((d: string) => new Date(d).getTime())
                const ends = (tasks as any[]).map((t: any) => t.actualEndDate).filter(Boolean).map((d: string) => new Date(d).getTime())
                if (starts.length === 0 || ends.length === 0) return '-'
                const days = Math.ceil((Math.max(...ends) - Math.min(...starts)) / (1000 * 60 * 60 * 24))
                return days > 0 ? days : '-'
              })()}</span></Tooltip></td>
              {allMilestones.map((m: any, mi: number) => (<td key={mi} style={{ ...tdStyle, color: '#d48806' }}>{m.actualEndDate || '-'}</td>))}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // ═══════ renderActionButtons ═══════
  const renderActionButtons = () => {
    const handleSave = () => {
      const parentCheck = checkParentTimeConstraint()
      if (!parentCheck.valid) {
        setParentTimeWarning({ visible: true, tasks: parentCheck.violations, message: `发现${parentCheck.violations.length}个子任务时间超出父任务范围，请修改后再保存` })
        return
      }
      const predViolations: any[] = []
      tasks.forEach(task => {
        if (task.predecessor && task.planStartDate) {
          const predTask = tasks.find(t => t.id === task.predecessor)
          if (predTask && predTask.planEndDate) {
            if (new Date(task.planStartDate).getTime() < new Date(predTask.planEndDate).getTime()) {
              predViolations.push({ id: task.id, taskName: task.taskName, predName: predTask.taskName, predEnd: predTask.planEndDate })
            }
          }
        }
      })
      if (predViolations.length > 0) {
        Modal.warning({
          title: '前置任务时间冲突',
          content: (<div><p>发现以下任务开始时间早于前置任务结束时间：</p><ul>{predViolations.map(v => (<li key={v.id}>{v.taskName} 的开始时间早于前置任务 {v.predName} 的结束时间({v.predEnd})</li>))}</ul><p>请修改后再保存</p></div>),
          okText: '知道了'
        })
        return
      }
      if (projectPlanLevel === 'level2' && level2PlanMilestones.length > 0 && level2PlanTasks.length > 0) {
        const milestoneCheck = checkMilestoneTimeConstraint(level2PlanTasks, level2PlanMilestones, tasks)
        if (!milestoneCheck.valid) {
          setMilestoneTimeWarning({ visible: true, violations: milestoneCheck.violations, message: `发现${milestoneCheck.violations.length}个二级计划任务时间超出绑定里程碑的时间范围，请修改后再保存` })
          return
        }
      }
      setIsEditMode(false)
      message.success('保存成功')
    }
    if (isCurrentDraft) return (<Space><Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{currentVersionData?.versionNo}({currentVersionData?.status})</Tag><Tag color="green" style={{ fontSize: 12 }}>自动保存</Tag><Button type="primary" icon={<SaveOutlined />} onClick={handlePublish}>发布</Button></Space>)
    return (<Space>{!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRevision}>创建修订</Button>}<Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)}>历史版本对比</Button></Space>)
  }

  // ═══════ renderVersionCompareResult ═══════
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
      { title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 105, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'actualStartDate', val) },
      { title: '实际完成', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 105, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'actualEndDate', val) },
      { title: '实际工期', dataIndex: 'actualDays', key: 'actualDays', width: 80, render: (val: number, row: CompareTableRow) => renderDiffCell(row, 'actualDays', val ? `${val}天` : '-') },
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

  // ═══════ renderProjectBasicInfo ═══════
  const renderProjectBasicInfo = () => {
    const p = selectedProject
    if (!p) return null
    const isWholeMachine = p.type === '整机产品项目'
    const isSoftware = p.type === '产品项目'
    const isTech = p.type === '技术项目'
    const isCapability = p.type === '能力建设项目'
    const statusConf = PROJECT_STATUS_CONFIG[p.status] || { color: '#8c8c8c', tagColor: 'default' }
    const healthMap: Record<string, { label: string; color: string }> = { normal: { label: '正常', color: '#52c41a' }, warning: { label: '关注', color: '#faad14' }, risk: { label: '风险', color: '#ff4d4f' } }
    const hConf = healthMap[p.healthStatus || 'normal'] || healthMap.normal
    const markets = p.markets || []
    const ef = editingProjectFields
    const setEf = (key: string, value: any) => setEditingProjectFields((prev: any) => ({ ...prev, [key]: value }))
    const editableField = (key: string, value: any, options?: { type?: 'input' | 'select' | 'select-multiple' | 'textarea'; choices?: { label: string; value: string }[] }) => {
      if (!basicInfoEditMode) return <span>{value || '-'}</span>
      if (options?.type === 'select') return <Select size="small" value={ef[key]} onChange={(v: string) => setEf(key, v)} style={{ width: '100%' }} options={options.choices} />
      if (options?.type === 'select-multiple') return <Select size="small" mode="multiple" value={(ef[key] || '').split(',').filter(Boolean)} onChange={(v: string[]) => setEf(key, v.join(','))} style={{ width: '100%' }} options={options.choices} />
      if (options?.type === 'textarea') return <Input.TextArea size="small" value={ef[key]} onChange={e => setEf(key, e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
      return <Input size="small" value={ef[key]} onChange={e => setEf(key, e.target.value)} />
    }
    const nodeChoices = [{ label: '概念启动', value: '概念启动' }, { label: 'STR1', value: 'STR1' }, { label: 'STR2', value: 'STR2' }, { label: 'STR3', value: 'STR3' }, { label: 'STR4', value: 'STR4' }, { label: 'STR5', value: 'STR5' }, { label: 'STR6', value: 'STR6' }]
    const healthChoices = [{ label: '正常', value: 'normal' }, { label: '关注', value: 'warning' }, { label: '风险', value: 'risk' }]
    const developModeChoices = [{ label: 'ODC', value: 'ODC' }, { label: 'JDM', value: 'JDM' }, { label: '自研', value: '自研' }]
    const userChoices = ALL_USERS.map(u => ({ label: u, value: u }))
    const descLabelStyle: CSSProperties = { fontWeight: 500, color: '#9ca3af', fontSize: 13, background: '#f8fafc' }
    const descContentStyle: CSSProperties = { color: '#111827', fontSize: 13 }
    const sectionTitle = (icon: React.ReactNode, title: string, _color: string) => (<Space size={8}>{icon}<span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span></Space>)
    const headerExtra = p.name
    const anchorSections = [
      { id: 'section-header', label: '项目概览', icon: <ProjectOutlined /> },
      { id: 'section-basic', label: '基本信息', icon: <SettingOutlined /> },
      ...(isWholeMachine && currentProjectTransferApps.length > 0 ? [{ id: 'section-transfer', label: '转维信息', icon: <DeploymentUnitOutlined /> }] : []),
      { id: 'section-plan', label: isWholeMachine ? '计划与配置' : '计划信息', icon: <CalendarOutlined /> },
      ...(!isWholeMachine && (isSoftware || isTech) ? [{ id: 'section-config', label: '配置信息', icon: <SettingOutlined /> }] : []),
    ]
    const scrollToSection = (id: string) => {
      const container = document.getElementById('basic-info-scroll-container')
      const target = document.getElementById(id)
      if (container && target) {
        const containerRect = container.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const offset = targetRect.top - containerRect.top + container.scrollTop - 16
        container.scrollTo({ top: offset, behavior: 'smooth' })
      }
    }
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingRight: 170 }}>
        {/* Anchor navigation */}
        <div style={{ position: 'fixed', right: 32, top: 130, zIndex: 50, width: 150 }}>
          <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)', padding: '16px 0 12px', boxShadow: '0 4px 16px rgba(99,102,241,0.08)' }}>
            <div style={{ padding: '0 16px 10px', fontSize: 10, fontWeight: 700, color: '#a5b4fc', letterSpacing: 3, textTransform: 'uppercase' as const }}>导航</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {anchorSections.map((section) => (
                <div key={section.id} onClick={() => scrollToSection(section.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 12, color: '#64748b', transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)', borderLeft: '2px solid transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(90deg, rgba(99,102,241,0.08) 0%, transparent 100%)'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderLeftColor = '#6366f1' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderLeftColor = 'transparent' }}
                >
                  <span style={{ fontSize: 13, opacity: 0.7 }}>{section.icon}</span>
                  <span style={{ fontWeight: 500 }}>{section.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Header card */}
        <Card id="section-header" style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden' }} styles={{ header: { background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)', borderBottom: 'none', padding: '16px 24px' }, body: { padding: 0 } }}
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(129,140,248,0.3) 0%, rgba(99,102,241,0.4) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}><ProjectOutlined style={{ color: '#fff', fontSize: 18 }} /></div><div><div style={{ color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{headerExtra}</div></div></div>}
          extra={<Space size={8}><Tag color={statusConf.tagColor} style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>{p.status}</Tag><Tag style={{ margin: 0, borderRadius: 4, background: hConf.color, border: 'none', color: '#fff' }}>{hConf.label}</Tag>{isWholeMachine && <Button type="primary" icon={<SendOutlined />} style={{ background: '#4338ca', borderColor: '#4338ca' }} onClick={() => transfer.setTransferView('apply')}>申请转维</Button>}</Space>}
        >
          <div style={{ display: 'flex', background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)', borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
            {[
              { label: '项目分类', value: p.type, editable: false },
              { label: '项目状态', value: p.status, editable: false },
              { label: '健康状态', value: hConf.label, editable: true, key: 'healthStatus', editNode: <Select size="small" value={ef.healthStatus} onChange={(v: string) => setEf('healthStatus', v)} style={{ width: 100 }} options={healthChoices} /> },
              ...((isSoftware || isWholeMachine || isTech) ? [{ label: '当前节点', value: p.currentNode || '-', editable: true, key: 'currentNode', editNode: <Select size="small" value={ef.currentNode} onChange={(v: string) => setEf('currentNode', v)} style={{ width: 120 }} options={nodeChoices} /> }] : []),
            ].map((item, i, arr) => (
              <div key={i} style={{ flex: 1, padding: '14px 20px', borderRight: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{basicInfoEditMode && item.editable ? item.editNode : item.value}</div>
              </div>
            ))}
          </div>
        </Card>
        {/* Section: Basic info */}
        <Card id="section-basic" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<SettingOutlined style={{ color: '#6366f1' }} />, '基本信息', '#6366f1')} extra={
          basicInfoEditMode ? (<Space><Button size="small" onClick={() => setBasicInfoEditMode(false)}>取消</Button><Button size="small" type="primary" onClick={saveBasicInfoEdit}>保存</Button></Space>) : (<Button size="small" icon={<EditOutlined />} onClick={startBasicInfoEdit}>编辑</Button>)
        }>
          {isSoftware && (
            <div>
              <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                <Descriptions.Item label="项目名称">{p.name}</Descriptions.Item>
                <Descriptions.Item label="品牌">{p.brand || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品线">{p.productLine || '-'}</Descriptions.Item>
                <Descriptions.Item label="版本类型">{p.versionType || '-'}</Descriptions.Item>
                <Descriptions.Item label="芯片平台">{p.chipPlatform || '-'}</Descriptions.Item>
                <Descriptions.Item label="开发模式">{editableField('developMode', p.developMode, { type: 'select', choices: developModeChoices })}</Descriptions.Item>
              </Descriptions>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginBottom: 10 }}>版本五大员</div>
                <Row gutter={[12, 12]}>
                  {basicInfoEditMode ? (
                    Object.entries(ef.versionFiveRoles || {}).map(([role, name]: [string, any]) => (
                      <Col key={role} span={Math.floor(24 / 5)}><div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f3f4f6' }}><div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{role}</div><Select size="small" value={String(name)} onChange={(v: string) => setEf('versionFiveRoles', { ...ef.versionFiveRoles, [role]: v })} style={{ width: '100%' }} options={userChoices} /></div></Col>
                    ))
                  ) : (
                    p.versionFiveRoles && typeof p.versionFiveRoles === 'object' ? (
                      Object.entries(p.versionFiveRoles).map(([role, name]: [string, any]) => (
                        <Col key={role} span={Math.floor(24 / 5)}><div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f3f4f6' }}><Avatar size={28} style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', fontSize: 12, flexShrink: 0 }}>{String(name)[0]}</Avatar><div><div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.3 }}>{String(name)}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{role}</div></div></div></Col>
                      ))
                    ) : (<Col><span style={{ color: '#9ca3af', fontSize: 13 }}>-</span></Col>)
                  )}
                </Row>
              </div>
            </div>
          )}
          {isWholeMachine && (
            <div>
              <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                <Descriptions.Item label="项目名称">{p.name}</Descriptions.Item>
                <Descriptions.Item label="市场名">{p.marketName || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品类型">{editableField('productType', p.productType, { type: 'select', choices: [{ label: '新品', value: '新品' }, { label: '换代', value: '换代' }] })}</Descriptions.Item>
                <Descriptions.Item label="tOS版本">{p.tosVersion || '-'}</Descriptions.Item>
                <Descriptions.Item label="开发模式">{editableField('developMode', p.developMode, { type: 'select', choices: developModeChoices })}</Descriptions.Item>
                <Descriptions.Item label="品牌">{p.brand || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品线">{p.productLine || '-'}</Descriptions.Item>
                <Descriptions.Item label="版本类型">{p.versionType || '-'}</Descriptions.Item>
                <Descriptions.Item label="市场">{p.market || (p.markets || []).join(', ') || '-'}</Descriptions.Item>
                <Descriptions.Item label="PPM">{editableField('ppm', p.ppm, { type: 'select', choices: userChoices })}</Descriptions.Item>
                <Descriptions.Item label="SPM">{editableField('spm', p.spm, { type: 'select', choices: userChoices })}</Descriptions.Item>
                <Descriptions.Item label="TPM">{editableField('tpm', p.tpm, { type: 'select', choices: userChoices })}</Descriptions.Item>
              </Descriptions>
            </div>
          )}
          {(isTech || isCapability) && (
            <div>
              <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                <Descriptions.Item label="项目名称">{p.name}</Descriptions.Item>
                <Descriptions.Item label="项目分类">{p.type}</Descriptions.Item>
                <Descriptions.Item label="项目状态"><Tag color={statusConf.tagColor}>{p.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="健康状态">{basicInfoEditMode ? <Select size="small" value={ef.healthStatus} onChange={(v: string) => setEf('healthStatus', v)} style={{ width: '100%' }} options={healthChoices} /> : <Tag style={{ background: hConf.color, border: 'none', color: '#fff' }}>{hConf.label}</Tag>}</Descriptions.Item>
              </Descriptions>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginBottom: 8 }}>团队成员</div>
                {basicInfoEditMode ? (
                  <Select size="small" mode="multiple" value={(ef.teamMembers || '').split(',').filter(Boolean)} onChange={(v: string[]) => setEf('teamMembers', v.join(','))} style={{ width: '100%' }} options={userChoices} />
                ) : (
                  <Space wrap>
                    {(p.teamMembers || p.spm || '').split(',').filter(Boolean).map((name: string, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f3f4f6' }}>
                        <Avatar size={24} style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', fontSize: 11 }}>{name.trim()[0]}</Avatar>
                        <span style={{ fontSize: 13 }}>{name.trim()}</span>
                      </div>
                    ))}
                  </Space>
                )}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginBottom: 8 }}>项目描述</div>
                {basicInfoEditMode ? (
                  <Input.TextArea size="small" value={ef.projectDescription} onChange={e => setEf('projectDescription', e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
                ) : (
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f3f4f6', fontSize: 13, color: '#4b5563', lineHeight: 1.8 }}>{p.projectDescription || '暂无描述'}</div>
                )}
              </div>
            </div>
          )}
        </Card>
        {/* Transfer info */}
        {isWholeMachine && currentProjectTransferApps.length > 0 && (
          <Card id="section-transfer" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<DeploymentUnitOutlined style={{ color: '#6366f1' }} />, '转维信息', '#6366f1')}>
            <Table dataSource={currentProjectTransferApps} rowKey="id" size="small" pagination={false} scroll={{ x: 900 }}
              rowClassName={(r: any) => r.status === 'cancelled' ? 'tm-row-cancelled' : ''}
              columns={[
                { title: '项目名称', dataIndex: 'projectName', width: 200, render: (_: unknown, r: TransferApplication) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar size={32} style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[r.team.research[0]?.role] || '#4338ca'} 0%, #6366f1 100%)`, fontSize: 12, flexShrink: 0 }}>{r.applicant.slice(-1)}</Avatar>
                    <div><div style={{ fontSize: 13, fontWeight: 500 }}>{r.projectName}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{r.applicant} · {r.createdAt.slice(0, 10)}</div></div>
                  </div>
                ) },
                { title: '流水线进度', width: 180, render: (_: unknown, r: TransferApplication) => <MiniPipeline app={r} /> },
                { title: '计划评审日期', dataIndex: 'plannedReviewDate', width: 110 },
                { title: '角色进度', width: 180, render: (_: unknown, r: TransferApplication) => (
                  <Space size={4} wrap>
                    {r.pipeline.roleProgress.map(rp => {
                      const color = rp.entryStatus === 'completed' && rp.reviewStatus === 'completed' ? 'success' : rp.reviewStatus === 'rejected' ? 'error' : rp.entryStatus === 'in_progress' || rp.reviewStatus === 'in_progress' ? 'processing' : 'default'
                      return <Tag key={rp.role} color={color} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>{rp.role}</Tag>
                    })}
                  </Space>
                ) },
                { title: '操作', width: 220, render: (_: unknown, r: TransferApplication) => (
                  <Space size={4}>
                    <Button size="small" type="text" icon={<FileTextOutlined />} style={{ color: '#666' }} onClick={() => { transfer.setSelectedTransferAppId(r.id); transfer.setTransferView('detail') }}>详情</Button>
                    {r.status === 'in_progress' && r.pipeline.dataEntry !== 'success' && <Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#6366f1' }} onClick={() => { transfer.setSelectedTransferAppId(r.id); transfer.setTransferView('entry') }}>录入</Button>}
                    {r.status === 'in_progress' && r.pipeline.maintenanceReview === 'in_progress' && <Button size="small" type="text" icon={<AuditOutlined />} style={{ color: '#52c41a' }} onClick={() => { transfer.setSelectedTransferAppId(r.id); transfer.setTransferView('review') }}>评审</Button>}
                    {r.status === 'in_progress' && r.pipeline.sqaReview === 'in_progress' && <Button size="small" type="text" icon={<SafetyOutlined />} style={{ color: '#faad14' }} onClick={() => { transfer.setSelectedTransferAppId(r.id); transfer.setTransferView('sqa-review') }}>SQA审核</Button>}
                    {r.status === 'in_progress' && <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={() => { transfer.setTmCloseAppId(r.id); transfer.setTmCloseReason(''); transfer.setTmCloseModalVisible(true) }}>关闭</Button>}
                  </Space>
                ) },
              ]}
            />
          </Card>
        )}
        {/* Plan + Config info */}
        {isWholeMachine && markets.length > 0 ? (
          <Card id="section-plan" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<CalendarOutlined style={{ color: '#6366f1' }} />, '计划信息与配置信息', '#6366f1')}>
            <Tabs activeKey={selectedMarketTab} onChange={setSelectedMarketTab} type="card"
              items={markets.map(m => {
                const marketColor = m === 'OP' ? '#1890ff' : m === 'TR' ? '#52c41a' : '#faad14'
                return {
                  key: m,
                  label: <Space size={6}><Badge color={marketColor} /><span style={{ fontWeight: 500 }}>{m}</span></Space>,
                  children: (
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>计划信息</div>
                      <Row gutter={[24, 16]} style={{ marginBottom: 16 }}>
                        <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划开始时间</span>} value={p.planStartDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#6366f1', fontSize: 14 }} />} /></Col>
                        <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划结束时间</span>} value={p.planEndDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#faad14', fontSize: 14 }} />} /></Col>
                        <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>开发周期（工作日）</span>} value={p.developCycle || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} suffix={p.developCycle ? <span style={{ fontSize: 12, color: '#9ca3af' }}>天</span> : undefined} /></Col>
                        <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>上市时间</span>} value={p.launchDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600, color: '#722ed1' }} prefix={<CalendarOutlined style={{ color: '#722ed1', fontSize: 14 }} />} /></Col>
                      </Row>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>里程碑计划（横排视图）</div>
                      {renderHorizontalTable()}
                      <Divider />
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>配置信息</div>
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>硬件配置</div>
                        <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                          <Descriptions.Item label="主板名">{p.mainboard || '-'}</Descriptions.Item>
                          <Descriptions.Item label="芯片平台">{p.chipPlatform || '-'}</Descriptions.Item>
                          <Descriptions.Item label="芯片型号">{p.cpu || '-'}</Descriptions.Item>
                          <Descriptions.Item label="安卓版本">{p.operatingSystem || p.androidVersion || '-'}</Descriptions.Item>
                          <Descriptions.Item label="内存">{p.memory || '-'}</Descriptions.Item>
                          <Descriptions.Item label="屏幕">{p.lcd || '-'}</Descriptions.Item>
                          <Descriptions.Item label="网络模式">{p.networkMode || '-'}</Descriptions.Item>
                          <Descriptions.Item label="kernel版本">{p.kernelVersion || '-'}</Descriptions.Item>
                          <Descriptions.Item label="前摄像头">{p.frontCamera || '-'}</Descriptions.Item>
                          <Descriptions.Item label="后摄像头">{p.primaryCamera || '-'}</Descriptions.Item>
                          <Descriptions.Item label="屏幕形态">{p.screenShape || '-'}</Descriptions.Item>
                          <Descriptions.Item label="屏幕类型">{p.screenType || '-'}</Descriptions.Item>
                          <Descriptions.Item label="灯效">{p.lightEffect || '-'}</Descriptions.Item>
                          <Descriptions.Item label="人脸">{p.faceRecognition || '-'}</Descriptions.Item>
                          <Descriptions.Item label="音效">{p.soundEffect || '-'}</Descriptions.Item>
                          <Descriptions.Item label="SIM卡">{p.simCard || '-'}</Descriptions.Item>
                          <Descriptions.Item label="马达">{p.motor || '-'}</Descriptions.Item>
                          <Descriptions.Item label="指纹">{p.fingerprint || '-'}</Descriptions.Item>
                          <Descriptions.Item label="红外">{p.infrared || '-'}</Descriptions.Item>
                        </Descriptions>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>构建信息</div>
                      <Descriptions bordered size="small" column={1} labelStyle={{ ...descLabelStyle, width: 120 }} contentStyle={descContentStyle}>
                        <Descriptions.Item label="分支信息">{editableField('branchInfo', p.branchInfo)}</Descriptions.Item>
                        <Descriptions.Item label="Jenkins构建">{basicInfoEditMode ? editableField('jenkinsUrl', p.jenkinsUrl) : (p.jenkinsUrl ? <a href={p.jenkinsUrl} target="_blank" rel="noopener noreferrer">{p.jenkinsUrl}</a> : '-')}</Descriptions.Item>
                        <Descriptions.Item label="版本地址">{basicInfoEditMode ? editableField('buildAddress', p.buildAddress) : (p.buildAddress ? <a href={p.buildAddress} target="_blank" rel="noopener noreferrer">{p.buildAddress}</a> : '-')}</Descriptions.Item>
                      </Descriptions>
                    </div>
                  ),
                }
              })}
            />
          </Card>
        ) : (
          <>
            {renderProjectPlanInfo()}
            {(isSoftware || isTech) && (
              <Card id="section-config" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<SettingOutlined style={{ color: '#52c41a' }} />, '配置信息', '#52c41a')}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>构建信息</div>
                <Descriptions bordered size="small" column={1} labelStyle={{ ...descLabelStyle, width: 120 }} contentStyle={descContentStyle}>
                  <Descriptions.Item label="分支信息">{editableField('branchInfo', p.branchInfo)}</Descriptions.Item>
                  <Descriptions.Item label="Jenkins构建">{basicInfoEditMode ? editableField('jenkinsUrl', p.jenkinsUrl) : (p.jenkinsUrl ? <a href={p.jenkinsUrl} target="_blank" rel="noopener noreferrer">{p.jenkinsUrl}</a> : '-')}</Descriptions.Item>
                  <Descriptions.Item label="版本地址">{basicInfoEditMode ? editableField('buildAddress', p.buildAddress) : (p.buildAddress ? <a href={p.buildAddress} target="_blank" rel="noopener noreferrer">{p.buildAddress}</a> : '-')}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </>
        )}
      </div>
    )
  }

  // ═══════ renderProjectPlanInfo ═══════
  const renderProjectPlanInfo = () => {
    const p = selectedProject!
    return (
      <Card id="section-plan" style={{ marginBottom: 20, borderRadius: 8 }} title={<Space><CalendarOutlined style={{ color: '#6366f1' }} /><span style={{ fontWeight: 600 }}>计划信息</span></Space>}>
        <Row gutter={[24, 16]}>
          <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划开始时间</span>} value={p.planStartDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#6366f1', fontSize: 14 }} />} /></Col>
          <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划结束时间</span>} value={p.planEndDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#faad14', fontSize: 14 }} />} /></Col>
          <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>开发周期（工作日）</span>} value={p.developCycle || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} suffix={p.developCycle ? <span style={{ fontSize: 12, color: '#9ca3af' }}>天</span> : undefined} /></Col>
          <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>健康状态</span>} value={p.healthStatus === 'normal' ? '健康' : p.healthStatus === 'warning' ? '关注' : p.healthStatus === 'risk' ? '风险' : '-'} valueStyle={{ fontSize: 16, fontWeight: 600, color: p.healthStatus === 'normal' ? '#52c41a' : p.healthStatus === 'warning' ? '#faad14' : p.healthStatus === 'risk' ? '#ff4d4f' : '#9ca3af' }} /></Col>
        </Row>
        <Divider style={{ margin: '16px 0' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 1 }}>里程碑计划（横排视图）</div>
        {renderHorizontalTable()}
      </Card>
    )
  }

  // ═══════ renderProjectPlanOverview ═══════
  const renderProjectPlanOverview = () => {
    const displayTasks = mergePlans(tasks, level2PlanTasks)
    return (
      <div>
        <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Space size={8} align="center">
                <BarChartOutlined style={{ color: '#6366f1', fontSize: 16 }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>计划总览</span>
                <Tag color="blue" style={{ fontSize: 11, borderRadius: 4 }}>融合模式</Tag>
              </Space>
              <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af', paddingLeft: 24 }}>一级计划与二级计划融合展示</div>
            </div>
            <Tooltip title={projectPlanViewMode === 'gantt' ? '切换表格' : '切换甘特图'}>
              <Button icon={projectPlanViewMode === 'gantt' ? <UnorderedListOutlined /> : <BarChartOutlined />} size="small" style={{ borderRadius: 6 }} onClick={() => setProjectPlanViewMode(projectPlanViewMode === 'gantt' ? 'table' : 'gantt')} />
            </Tooltip>
          </div>
          <div style={{ padding: 0 }}>
            {projectPlanViewMode === 'gantt' ? renderGanttChart(displayTasks) : renderTaskTable(displayTasks)}
          </div>
        </Card>
      </div>
    )
  }

  // Market color mapping
  const marketColors: Record<string, string> = { 'OP': '#1890ff', 'TR': '#52c41a', 'RU': '#faad14', 'FR': '#722ed1', 'IN': '#eb2f96', 'BR': '#13c2c2' }

  // ═══════ renderProjectPlan ═══════
  const renderProjectPlan = () => {
    const markets = selectedProject?.markets || []
    const showMarketTabs = selectedProject?.type === '整机产品项目' && markets.length > 0
    const planTabItems = [
      { key: 'level1', label: '一级计划' },
      { key: 'level2', label: '二级计划' },
      { key: 'overview', label: '计划总览' },
    ]
    return (
      <div>
        {showMarketTabs && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '4px 16px' } }}>
            <Row align="middle" justify="space-between">
              <Col>
                <Space size={4} align="center">
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginRight: 8 }}>市场</span>
                  {markets.map(market => (
                    <Tag key={market} color={selectedMarketTab === market ? (marketColors[market] || '#1890ff') : 'default'} style={{ cursor: 'pointer', borderRadius: 4, padding: '4px 16px', fontSize: 13, fontWeight: selectedMarketTab === market ? 600 : 400, borderColor: selectedMarketTab === market ? (marketColors[market] || '#1890ff') : '#d9d9d9' }} onClick={() => navigateWithEditGuard(() => setSelectedMarketTab(market))}>{market}</Tag>
                  ))}
                </Space>
              </Col>
              <Col><Tag style={{ fontSize: 11, borderRadius: 4 }}>当前市场: <span style={{ fontWeight: 600, color: marketColors[selectedMarketTab] || '#1890ff' }}>{selectedMarketTab}</span></Tag></Col>
            </Row>
          </Card>
        )}
        <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '4px 16px' } }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Tabs activeKey={projectPlanLevel} onChange={(key) => navigateWithEditGuard(() => setProjectPlanLevel(key as string))} style={{ marginBottom: 0 }} items={planTabItems.map(item => ({ ...item, label: <span style={{ fontWeight: 500, padding: '0 4px' }}>{item.label}</span> }))} />
            </Col>
            <Col><Tag color={projectPlanLevel === 'overview' ? 'blue' : 'default'} style={{ fontSize: 11 }}>{planTabItems.find(t => t.key === projectPlanLevel)?.label}</Tag></Col>
          </Row>
        </Card>
        {projectPlanLevel === 'overview' && renderProjectPlanOverview()}
        {projectPlanLevel === 'level2' && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '4px 16px 4px 16px' } }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Tabs activeKey={activeLevel2Plan} onChange={(key) => navigateWithEditGuard(() => setActiveLevel2Plan(key))} style={{ marginBottom: 0 }}
                  items={createdLevel2Plans.map(plan2 => ({
                    key: plan2.id,
                    label: (
                      <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {plan2.name}
                        {!plan2.fixed && (
                          <Popconfirm title={`确认删除"${plan2.name}"？`}
                            onConfirm={(e) => { e?.stopPropagation(); const newPlans = createdLevel2Plans.filter(p2 => p2.id !== plan2.id); setCreatedLevel2Plans(newPlans); if (activeLevel2Plan === plan2.id) setActiveLevel2Plan(newPlans[0]?.id || 'plan0'); message.success(`已删除${plan2.name}`) }}
                            onCancel={(e) => e?.stopPropagation()} okText="确认" cancelText="取消"
                          >
                            <DeleteOutlined style={{ fontSize: 12, color: '#bfbfbf', marginLeft: 2 }} onClick={(e) => e.stopPropagation()} onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4d4f')} onMouseLeave={(e) => (e.currentTarget.style.color = '#bfbfbf')} />
                          </Popconfirm>
                        )}
                      </span>
                    ),
                  }))}
                />
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} onClick={() => { if (!hasPublishedLevel1Plan) { message.warning('请先发布一级计划后再创建二级计划'); return; } setCreateFormValues({}); setShowCreateLevel2Plan(true) }}>创建二级计划</Button>
              </Col>
            </Row>
          </Card>
        )}
        {/* L2 plan meta */}
        {projectPlanLevel === 'level2' && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1' && level2PlanMeta[activeLevel2Plan]?.planType === '1+N MR版本火车计划' && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8, border: '1px solid rgba(99,102,241,0.06)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }} onClick={() => setPlanMetaCollapsed(!planMetaCollapsed)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 3, height: 16, background: '#6366f1', borderRadius: 2 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>计划基本信息</span>
                <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>{level2PlanMeta[activeLevel2Plan]?.planType}</Tag>
              </div>
              <DownOutlined style={{ fontSize: 11, color: '#9ca3af', transition: 'transform 0.25s', transform: planMetaCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
            </div>
            {!planMetaCollapsed && (
              <div style={{ padding: '0 20px 16px' }}>
                <Descriptions size="small" column={3} labelStyle={{ color: '#9ca3af', fontSize: 13, fontWeight: 500, padding: '6px 12px 6px 0' }} contentStyle={{ color: '#111827', fontSize: 13, padding: '6px 0' }} colon={false}>
                  <Descriptions.Item label="MR版本类型"><Tag color="geekblue">{level2PlanMeta[activeLevel2Plan]?.mrVersion}</Tag></Descriptions.Item>
                  <Descriptions.Item label="1+N转测类型">{level2PlanMeta[activeLevel2Plan]?.transferType ? <Tag color="orange">{level2PlanMeta[activeLevel2Plan].transferType}</Tag> : '-'}</Descriptions.Item>
                  <Descriptions.Item label="tOS-市场版本号">{level2PlanMeta[activeLevel2Plan]?.tosVersion ? <Tag color="cyan">{level2PlanMeta[activeLevel2Plan].tosVersion}</Tag> : '-'}</Descriptions.Item>
                  {level2PlanMeta[activeLevel2Plan]?.productLine && (
                    <>
                      <Descriptions.Item label="产品线">{level2PlanMeta[activeLevel2Plan]?.productLine || '-'}</Descriptions.Item>
                      <Descriptions.Item label="市场名">{level2PlanMeta[activeLevel2Plan]?.marketName || '-'}</Descriptions.Item>
                      <Descriptions.Item label="项目名称">{level2PlanMeta[activeLevel2Plan]?.projectName || '-'}</Descriptions.Item>
                      <Descriptions.Item label="芯片厂商">{level2PlanMeta[activeLevel2Plan]?.chipVendor || '-'}</Descriptions.Item>
                      <Descriptions.Item label="分支信息">{level2PlanMeta[activeLevel2Plan]?.branch ? <Tag color="purple">{level2PlanMeta[activeLevel2Plan].branch}</Tag> : '-'}</Descriptions.Item>
                      <Descriptions.Item label="是否MADA">{level2PlanMeta[activeLevel2Plan]?.isMada ? <Tag color={level2PlanMeta[activeLevel2Plan].isMada === '是' ? 'green' : 'default'}>{level2PlanMeta[activeLevel2Plan].isMada}</Tag> : '-'}</Descriptions.Item>
                      <Descriptions.Item label="MADA市场">{level2PlanMeta[activeLevel2Plan]?.madaMarket || '-'}</Descriptions.Item>
                      <Descriptions.Item label="项目SPM">{level2PlanMeta[activeLevel2Plan]?.spm || '-'}</Descriptions.Item>
                      <Descriptions.Item label="项目TPM">{level2PlanMeta[activeLevel2Plan]?.tpm || '-'}</Descriptions.Item>
                      <Descriptions.Item label="对接人">{level2PlanMeta[activeLevel2Plan]?.contact || '-'}</Descriptions.Item>
                      <Descriptions.Item label="项目版本号">{level2PlanMeta[activeLevel2Plan]?.projectVersion ? <Tag>{level2PlanMeta[activeLevel2Plan].projectVersion}</Tag> : '-'}</Descriptions.Item>
                    </>
                  )}
                </Descriptions>
              </div>
            )}
          </Card>
        )}
        {projectPlanLevel === 'level2' && activeLevel2Plan === 'plan0' && <RequirementDevPlan isEditMode={isEditMode} />}
        {projectPlanLevel === 'level2' && activeLevel2Plan === 'plan1' && <VersionTrainPlan />}
        {/* Version management + table/gantt for L1 and non-fixed L2 */}
        {projectPlanLevel !== 'overview' && !(projectPlanLevel === 'level2' && (activeLevel2Plan === 'plan0' || activeLevel2Plan === 'plan1')) && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '12px 16px' } }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                  <Space size={6}>
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>版本</span>
                    <Select value={currentVersion} onChange={(val) => navigateWithEditGuard(() => { setCurrentVersion(val); setIsEditMode(false) })} style={{ width: 150 }} size="middle">
                      {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
                    </Select>
                    {isCurrentDraft && <Tag color="green" style={{ fontSize: 12, margin: 0 }}>自动保存</Tag>}
                  </Space>
                  <Space size={6}>
                    {!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} onClick={handleCreateRevision}>创建修订</Button>}
                    {isCurrentDraft && <Button type="primary" icon={<SaveOutlined />} style={{ borderRadius: 6 }} onClick={handlePublish}>发布</Button>}
                    {!isCurrentDraft && <Button icon={<HistoryOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowVersionCompare(true)}>版本对比</Button>}
                    {projectPlanLevel === 'level1' && versions.some(v => v.status === '已发布') && (
                      <Tooltip title="复制分享链接，无需权限即可查看">
                        <Button icon={<ShareAltOutlined />} style={{ borderRadius: 6 }} onClick={() => {
                          const url = `${window.location.origin}/share/plan?projectId=${selectedProject?.id}&level=level1`
                          navigator.clipboard.writeText(url).then(() => { message.success('分享链接已复制到剪贴板') })
                        }}>分享</Button>
                      </Tooltip>
                    )}
                  </Space>
                </Space>
              </Col>
              <Col>
                <Space size={6}>
                  <Input placeholder="搜索任务..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear onChange={(e) => setSearchText(e.target.value)} />
                  {projectPlanViewMode !== 'gantt' && (
                    <Dropdown menu={{ items: [{ key: 'current', label: '导出当前视图' }, { key: 'all', label: '导出全部' }], onClick: ({ key }) => { if (projectPlanViewMode === 'horizontal') handleExportHorizontalPlan(key as 'current' | 'all'); else handleExportVerticalPlan(key as 'current' | 'all') } }}>
                      <Tooltip title="导出为 Excel"><Button icon={<DownloadOutlined />} style={{ borderRadius: 6 }} /></Tooltip>
                    </Dropdown>
                  )}
                  {projectPlanViewMode !== 'horizontal' && (
                    <Tooltip title="自定义列"><Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} /></Tooltip>
                  )}
                  {getScopeKey() !== null && (
                    <>
                      <Tooltip title="全部展开"><Button icon={<PlusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={expandAll} /></Tooltip>
                      <Tooltip title="全部收起"><Button icon={<MinusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={collapseAll} /></Tooltip>
                    </>
                  )}
                  <Radio.Group
                    value={projectPlanViewMode === 'horizontal' && projectPlanLevel === 'level2' ? 'table' : projectPlanViewMode}
                    onChange={(e) => setProjectPlanViewMode(e.target.value)}
                    optionType="button" buttonStyle="solid" size="small"
                    options={projectPlanLevel === 'level1' ? (isEditMode ? [{ label: '竖版表格', value: 'table' }, { label: '甘特图', value: 'gantt' }] : [{ label: '竖版表格', value: 'table' }, { label: '横版表格', value: 'horizontal' }, { label: '甘特图', value: 'gantt' }]) : [{ label: '表格', value: 'table' }, { label: '甘特图', value: 'gantt' }]}
                  />
                </Space>
              </Col>
            </Row>
          </Card>
        )}
        <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          {projectPlanLevel === 'level1' && (projectPlanViewMode === 'gantt' ? renderGanttChart() : projectPlanViewMode === 'horizontal' ? renderHorizontalTable() : renderTaskTable())}
          {projectPlanLevel === 'level2' && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1' && activeLevel2Plan && (
            projectPlanViewMode === 'gantt'
              ? renderGanttChart(level2PlanTasks.filter(t => t.planId === activeLevel2Plan))
              : renderTaskTable(level2PlanTasks.filter(t => t.planId === activeLevel2Plan))
          )}
        </Card>
      </div>
    )
  }

  // ═══════ Sidebar menu items ═══════
  const menuItems = [
    { key: 'basic', icon: <SettingOutlined />, label: '基础信息' },
    { key: 'overview', icon: <FileTextOutlined />, label: '概况' },
    { key: 'requirements', icon: <FileTextOutlined />, label: '需求' },
    { key: 'plan', icon: <CalendarOutlined />, label: '计划' },
    { key: 'resources', icon: <TeamOutlined />, label: '资源' },
    { key: 'tasks', icon: <CheckSquareOutlined />, label: '任务' },
    { key: 'risks', icon: <WarningOutlined />, label: '风险' },
    { key: 'bugs', icon: <BugOutlined />, label: '缺陷' },
    { key: 'team', icon: <TeamOutlined />, label: '团队' },
    { key: 'docs', icon: <FolderOutlined />, label: '项目文档' },
    { key: 'permission', icon: <SafetyCertificateOutlined />, label: '权限配置' },
  ]

  // ═══════ RETURN ═══════
  // This is renderProjectSpace() extracted verbatim — the outer shell with header, sidebar, and content area.
  // For brevity we render a placeholder that maintains the same layout structure.
  // The actual body rendering for each module (basic, plan, etc.) is delegated to sub-functions that were defined above.

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0f2f8 0%, #e8ecf4 100%)' }}>
      {/* Header */}
      <ProjectSpaceHeader navigateWithEditGuard={navigateWithEditGuard} />

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
        {/* Sidebar */}
        <div className="pms-sidebar" style={{ width: 200, background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)', borderRight: '1px solid rgba(99,102,241,0.06)', paddingTop: 12, overflowY: 'auto', flexShrink: 0 }}>
          <Menu
            mode="inline"
            selectedKeys={[projectSpaceModule]}
            style={{ border: 'none', fontSize: 13 }}
            items={menuItems.map(item => ({
              ...item,
              label: <span style={{ fontWeight: projectSpaceModule === item.key ? 500 : 400 }}>{item.label}</span>,
            }))}
            onClick={({ key }) => navigateWithEditGuard(() => { setProjectSpaceModule(key); transfer.setTransferView(null); })}
          />
        </div>

        {/* Content area */}
        <div id="basic-info-scroll-container" style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {transfer.transferView === 'apply' && <TransferApply {...transferProps} />}
          {transfer.transferView === 'detail' && <TransferDetail {...transferProps} />}
          {transfer.transferView === 'entry' && <TransferEntry {...transferProps} />}
          {transfer.transferView === 'review' && <TransferReview {...transferProps} />}
          {transfer.transferView === 'sqa-review' && <TransferSqaReview {...transferProps} />}
          {transfer.transferView === null && projectSpaceModule === 'basic' && renderProjectBasicInfo()}
          {transfer.transferView === null && projectSpaceModule === 'plan' && renderProjectPlan()}
          {transfer.transferView === null && projectSpaceModule === 'overview' && (
            <Card style={{ borderRadius: 8, textAlign: 'center', padding: '48px 0' }}>
              <Empty description={<span style={{ color: '#9ca3af' }}>概况模块开发中...</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          )}
          {transfer.transferView === null && projectSpaceModule === 'requirements' && (
            <Card style={{ borderRadius: 8, textAlign: 'center', padding: '48px 0' }}>
              <Empty description={<span style={{ color: '#9ca3af' }}>需求模块开发中...</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          )}
          {transfer.transferView === null && projectSpaceModule === 'permission' && (
            <PermissionConfig roles={roles} setRoles={setRoles} rolePermissions={rolePermissions} setRolePermissions={setRolePermissions} permConfigTab={permConfigTab} setPermConfigTab={setPermConfigTab} permissionActiveRole={permissionActiveRole} setPermissionActiveRole={setPermissionActiveRole} showAddRoleModal={showAddRoleModal} setShowAddRoleModal={setShowAddRoleModal} newRoleName={newRoleName} setNewRoleName={setNewRoleName} editingRoleName={editingRoleName} setEditingRoleName={setEditingRoleName} editRoleNameValue={editRoleNameValue} setEditRoleNameValue={setEditRoleNameValue} />
          )}
          {transfer.transferView === null && !['basic', 'plan', 'overview', 'requirements', 'permission'].includes(projectSpaceModule) && (
            <Card style={{ borderRadius: 8, textAlign: 'center', padding: '40px 0' }}>
              <Empty description={<span style={{ color: '#9ca3af' }}>{`${menuItems.find(m => m.key === projectSpaceModule)?.label}模块开发中...`}</span>} />
            </Card>
          )}
        </div>
      </div>

      {/* Shared modals */}
      <Modal className="pms-modal" title="⚠️ 前置任务冲突警告" open={predecessorWarning.visible} onCancel={() => setPredecessorWarning({ visible: false, task: null, message: '' })} footer={[<Button key="cancel" onClick={() => setPredecessorWarning({ visible: false, task: null, message: '' })}>取消</Button>, <Button key="confirm" type="primary" onClick={confirmPredecessorChange}>确认修改</Button>]}>
        <Alert type="warning" showIcon message="前置任务检查" description={predecessorWarning.message} />
      </Modal>
      <Modal className="pms-modal" title="子任务时间超出父任务范围" open={parentTimeWarning.visible} onCancel={() => setParentTimeWarning({ visible: false, tasks: [], message: '' })} footer={[<Button key="close" type="primary" onClick={() => setParentTimeWarning({ visible: false, tasks: [], message: '' })}>知道了，去修改</Button>]} width={600}>
        <Alert type="warning" message="以下子任务的计划时间超出了父任务的时间范围" description={parentTimeWarning.message} style={{ marginBottom: 16 }} />
      </Modal>
      <Modal className="pms-modal" title="⚠️ 二级计划时间超出里程碑范围" open={milestoneTimeWarning.visible} onCancel={() => setMilestoneTimeWarning({ visible: false, violations: [], message: '' })} footer={[<Button key="close" type="primary" onClick={() => setMilestoneTimeWarning({ visible: false, violations: [], message: '' })}>知道了，去修改</Button>]} width={700}>
        <Alert type="warning" message="二级计划时间必须在绑定里程碑的时间范围内" description={milestoneTimeWarning.message} style={{ marginBottom: 16 }} />
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
      {/* Custom column modal */}
      <Modal className="pms-modal" title={`自定义列 - ${currentViewMode === 'gantt' ? '甘特图' : '竖版表格'}`} open={showColumnModal} onCancel={() => setShowColumnModal(false)} footer={[<Button key="reset" onClick={() => setVisibleColumns(currentViewDefaultCols)}>重置</Button>, <Button key="cancel" onClick={() => setShowColumnModal(false)}>取消</Button>, <Button key="ok" type="primary" onClick={() => { setShowColumnModal(false); message.success('列配置已保存') }}>确定</Button>]}>
        <Checkbox.Group value={visibleColumns} onChange={(vals) => setVisibleColumns(vals as string[])}><Row>{currentViewColumns.map((c: any) => <Col span={12} key={c.key}><Checkbox value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox></Col>)}</Row></Checkbox.Group>
      </Modal>
      {/* Create L2 plan modal */}
      <Modal className="pms-modal"
        title="创建二级计划"
        open={showCreateLevel2Plan}
        onCancel={() => setShowCreateLevel2Plan(false)}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => setShowCreateLevel2Plan(false)}>取消</Button>,
          <Button key="create" type="primary" onClick={() => {
            setLevel2PlanMilestones(selectedMilestones)
            const planName = selectedLevel2PlanType === '1+N MR版本火车计划' ? `${selectedMRVersion}版本火车计划` : selectedLevel2PlanType === '无' ? (createFormValues.customPlanName || '自定义计划') : selectedLevel2PlanType
            const newPlan = { id: `plan_${Date.now()}`, name: planName, type: selectedLevel2PlanType }
            const meta: Record<string, string> = { planType: selectedLevel2PlanType, planName }
            if (selectedLevel2PlanType === '1+N MR版本火车计划') {
              meta.mrVersion = selectedMRVersion
              meta.transferType = createFormValues.transferType || ''
              meta.tosVersion = createFormValues.tosVersion || ''
              if (selectedProject?.type === '整机产品项目') {
                Object.assign(meta, {
                  productLine: selectedProject?.productLine || '', marketName: selectedMarketTab, projectName: selectedProject?.name || '', chipVendor: selectedProject?.chipPlatform || '',
                  branch: createFormValues.branch || '', isMada: createFormValues.isMada || '', madaMarket: createFormValues.madaMarket || '',
                  spm: createFormValues.spm || '', tpm: createFormValues.tpm || '', contact: createFormValues.contact || '', projectVersion: createFormValues.projectVersion || '',
                })
              }
            }
            setLevel2PlanMeta(prev => ({ ...prev, [newPlan.id]: meta }))
            setCreatedLevel2Plans([...createdLevel2Plans, newPlan])
            setActiveLevel2Plan(newPlan.id)
            message.success(`已创建${planName}`)
            setShowCreateLevel2Plan(false)
            if (!versions.find(v => v.status === '修订中')) {
              setVersions([...versions, { id: 'v1', versionNo: 'V1', status: '修订中' }])
              setCurrentVersion('v1')
            }
          }}>创建</Button>
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="绑定里程碑（多选）">
            <Checkbox.Group value={selectedMilestones} onChange={(vals) => setSelectedMilestones(vals as string[])}>
              <Row>{LEVEL1_TASKS.filter(t => t.parentId).map(t => (<Col span={8} key={t.id}><Checkbox value={t.id}>{t.id} {t.taskName}</Checkbox></Col>))}</Row>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item label="计划模板类型">
            <Select value={selectedLevel2PlanType} style={{ width: '100%' }} onChange={(val) => setSelectedLevel2PlanType(val)}>
              <Option value="无">无</Option>
              {LEVEL2_PLAN_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
              {customTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Form.Item>
          {selectedLevel2PlanType === '1+N MR版本火车计划' && (
            <>
              <Form.Item label="MR版本类型">
                <Select value={selectedMRVersion} onChange={(val) => setSelectedMRVersion(val)} style={{ width: '100%' }}>
                  <Option value="FR">FR</Option>
                  {[...Array(99)].map((_, i) => (<Option key={`MR${i + 1}`} value={`MR${i + 1}`}>MR{i + 1}</Option>))}
                </Select>
              </Form.Item>
              <Form.Item label="tOS-市场版本号"><Input placeholder="请输入tOS-市场版本号" value={createFormValues.tosVersion || ''} onChange={(e) => setCreateFormValues((prev: any) => ({...prev, tosVersion: e.target.value}))} /></Form.Item>
              {selectedProject?.type === '整机产品项目' && (
                <>
                  <Form.Item label="产品线"><Input placeholder="自动获取" disabled value={selectedProject?.productLine || ''} /></Form.Item>
                  <Form.Item label="市场名"><Input placeholder="自动获取" disabled value={selectedMarketTab} /></Form.Item>
                  <Form.Item label="项目名称"><Input placeholder="自动获取" disabled value={selectedProject?.name || ''} /></Form.Item>
                  <Form.Item label="芯片厂商"><Input placeholder="自动获取" disabled value={selectedProject?.chipPlatform || ''} /></Form.Item>
                  <Form.Item label="分支信息"><Input placeholder="请输入分支信息" value={createFormValues.branch || ''} onChange={(e) => setCreateFormValues((prev: any) => ({...prev, branch: e.target.value}))} /></Form.Item>
                  <Form.Item label="是否MADA"><Select placeholder="请选择" style={{ width: '100%' }} value={createFormValues.isMada} onChange={(val) => setCreateFormValues((prev: any) => ({...prev, isMada: val}))}><Option value="是">是</Option><Option value="否">否</Option></Select></Form.Item>
                  <Form.Item label="MADA市场"><Input placeholder="请输入MADA市场" value={createFormValues.madaMarket || ''} onChange={(e) => setCreateFormValues((prev: any) => ({...prev, madaMarket: e.target.value}))} /></Form.Item>
                  <Form.Item label="项目SPM"><Select placeholder="请选择SPM" style={{ width: '100%' }} value={createFormValues.spm} onChange={(val) => setCreateFormValues((prev: any) => ({...prev, spm: val}))}><Option value="李白">李白</Option><Option value="张三">张三</Option></Select></Form.Item>
                  <Form.Item label="项目TPM"><Select placeholder="请选择TPM" style={{ width: '100%' }} value={createFormValues.tpm} onChange={(val) => setCreateFormValues((prev: any) => ({...prev, tpm: val}))}><Option value="王五">王五</Option><Option value="赵六">赵六</Option></Select></Form.Item>
                  <Form.Item label="对接人"><Select placeholder="请选择对接人" style={{ width: '100%' }} value={createFormValues.contact} onChange={(val) => setCreateFormValues((prev: any) => ({...prev, contact: val}))}><Option value="孙七">孙七</Option><Option value="周八">周八</Option></Select></Form.Item>
                  <Form.Item label="项目版本号"><Input placeholder="请输入项目版本号" value={createFormValues.projectVersion || ''} onChange={(e) => setCreateFormValues((prev: any) => ({...prev, projectVersion: e.target.value}))} /></Form.Item>
                </>
              )}
              <Form.Item label="1+N转测类型"><Select placeholder="请选择转测类型" style={{ width: '100%' }} value={createFormValues.transferType} onChange={(val) => setCreateFormValues((prev: any) => ({...prev, transferType: val}))}>{[...Array(99)].map((_, i) => (<Option key={i + 1} value={String(i + 1)}>{i + 1}</Option>))}</Select></Form.Item>
            </>
          )}
          <Form.Item label="二级计划名称">
            <Input value={selectedLevel2PlanType === '1+N MR版本火车计划' ? `${selectedMRVersion}版本火车计划` : selectedLevel2PlanType === '无' ? (createFormValues.customPlanName || '') : selectedLevel2PlanType} disabled={selectedLevel2PlanType !== '无'} onChange={selectedLevel2PlanType === '无' ? (e) => setCreateFormValues((prev: any) => ({...prev, customPlanName: e.target.value})) : undefined} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
