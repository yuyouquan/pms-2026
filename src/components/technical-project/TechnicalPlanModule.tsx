'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Alert, App, Avatar, Badge, Button, Card, DatePicker, Dropdown, Empty, Input, Modal, Popconfirm, Progress,
  Row, Select, Space, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
  CopyOutlined, DeleteOutlined, DownloadOutlined, HistoryOutlined, PlusOutlined, SaveOutlined,
  EditOutlined, FilterOutlined, MinusSquareOutlined, PlusSquareOutlined, SettingOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import SubprojectConfigModal from '@/components/technical-project/SubprojectConfigModal'
import { PlanVersionCompareModal } from '@/components/plans/PlanVersionCompareModal'
import { PlanWorkspaceShell } from '@/components/plans/PlanWorkspaceShell'
import { FloatingFilterPanel } from '@/components/shared/FloatingFilterPanel'
import { FilterConditionValue } from '@/components/shared/FilterConditionValue'
import { ClickToEditDate, DHTMLXGantt } from '@/components/shared/PlanHelpers'
import {
  applyPlanWorkspaceFilters,
  buildPlanHorizontalStageGroups,
  type PlanWorkspaceViewMode,
} from '@/lib/planWorkspace'
import {
  buildTechnicalHorizontalRows,
  canConfirmTechnicalSubprojectMutation,
  canConfirmTechnicalSubprojectTransfer,
  filterTechnicalPlanGanttTasks,
  getTechnicalPlanExportColumns,
  getTechnicalPlanFilterFields,
  getTechnicalPlanRowKey,
  parseTechnicalPlanImportRows,
  projectTechnicalPlanRows,
  renumberTechnicalSubprojectTasks,
  selectVisibleTechnicalPlanVersions,
} from '@/lib/technicalPlanWorkspace'
import { compareVersionsForTable } from '@/lib/versionCompare'
import type { PlanRevisionKind } from '@/lib/planVersioning'
import { getTemplateSnapshotForProjectType } from '@/lib/projectTemplateCompatibility'
import { comparePublishedTechnicalPlanVersions } from '@/lib/technicalProjectRules'
import { canMaintainLevel1Plan, canMutateLevel1TaskStructure, projectLevel1FlatMilestones, projectLevel1Plan, projectTechnicalSubprojectRows, sumLevel1EstimatedDays, type Level1FlatMilestoneRow } from '@/lib/level1PlanRules'
import { applyPlanGanttDateChange, applyPlanTaskDatePatch, buildPlanGanttTasks } from '@/lib/planGanttRules'
import {
  createFilterCondition,
  getDefaultFilterOperator,
  getFieldOptionsWithDuplicateDisabled,
  getFilterOperatorsForKind,
  isFilterConditionActive,
  normalizeFilterValueForOperator,
  normalizeFilterConditions,
  type AnyFilterCondition,
  type FilterOperator,
} from '@/lib/filterConditions'
import {
  getTemplateConfigScopeKey,
  insertNextTechnicalSubprojectTransfer,
  TECHNICAL_TEMPLATE_STORAGE_KEYS, validateTechnicalTdtMilestoneDates,
  validateTechnicalSubprojectDates,
  validateTechnicalTemplateDepth,
} from '@/lib/technicalPlanRules'
import { exportMergedSheet, exportSheet, exportTimestamp } from '@/utils/exportExcel'
import { usePlanStore } from '@/stores/plan'
import { useProjectStore } from '@/stores/project'
import { hasPermission, usePermissionStore } from '@/stores/permission'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import { useUiStore } from '@/stores/ui'
import {
  buildTechnicalPlanTabs, getTechnicalPlanKey, useTechnicalPlanStore,
} from '@/stores/technicalPlan'
import type { TechnicalTemplateKind, TechnicalTemplateTask } from '@/types/technicalPlan'
import type { TechnicalSubprojectTransferScopeToken } from '@/lib/technicalPlanWorkspace'
import type { TechnicalSubproject } from '@/types/technicalProject'

const { Text } = Typography
const FIXED_TDT_LABEL = 'TDT项目计划'
const TECHNICAL_STAGE_COLORS = ['#1890ff', '#52c41a', '#722ed1', '#faad14', '#eb2f96', '#13c2c2'] as const
const PLAN_REVISION_KIND_OPTIONS: Array<{ key: PlanRevisionKind; label: string }> = [
  { key: 'gray', label: '创建非正式版本' },
  { key: 'formal', label: '创建正式版本' },
]

const DEFAULT_MAX_DEPTH: Readonly<Record<TechnicalTemplateKind, number>> = { tdt: 2, subproject: 1 }
type TechnicalPlanRow = Level1FlatMilestoneRow & TechnicalTemplateTask

function TechnicalHorizontalPlanTable({
  tasks,
  templateKind,
  versions,
  currentVersionId,
  canEditPlanEnd,
  canEditActualEnd,
  onDateChange,
}: {
  tasks: readonly TechnicalTemplateTask[]
  templateKind: TechnicalTemplateKind
  versions: readonly { id: string; versionNo: string; status: string; tasks: TechnicalTemplateTask[] }[]
  currentVersionId: string
  canEditPlanEnd: boolean
  canEditActualEnd: boolean
  onDateChange: (taskId: string, field: 'planEndDate' | 'actualEndDate', value: string) => void
}) {
  const mode = templateKind === 'subproject' ? 'technical-subproject' : 'standard'
  const currentProjection = projectLevel1Plan(tasks, { mode })
  const groups = currentProjection.stageGroups.map(group => ({
    ...group,
    colSpan: Math.max(1, group.milestones.length),
  }))
  if (!tasks.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无横版计划数据" />
  const milestoneTasks = mode === 'technical-subproject'
    ? currentProjection.rows
    : groups.flatMap(group => group.milestones.length > 0 ? group.milestones : [group.stage])
  type TechnicalHorizontalRow = {
    id: string
    versionNo: string
    status: string
    rowType: 'version' | 'actual'
    endDatesByTaskId: Record<string, string>
    cycleDays: number | null
  }
  const rows: TechnicalHorizontalRow[] = versions.map(version => {
    const versionProjection = projectLevel1Plan(version.tasks, { mode })
    return {
      id: version.id,
      versionNo: version.versionNo,
      status: version.status,
      rowType: 'version' as const,
      endDatesByTaskId: Object.fromEntries(versionProjection.rows.map(row => [getTechnicalPlanRowKey(row), row.planEndDate || ''])),
      cycleDays: sumLevel1EstimatedDays(versionProjection.rows),
    }
  })
  const actualStarts = currentProjection.rows.map(row => Date.parse(row.actualStartDate)).filter(Number.isFinite)
  const actualEnds = currentProjection.rows.map(row => Date.parse(row.actualEndDate)).filter(Number.isFinite)
  rows.push({
    id: 'actual',
    versionNo: '实际',
    status: '',
    rowType: 'actual',
    endDatesByTaskId: Object.fromEntries(currentProjection.rows.map(row => [getTechnicalPlanRowKey(row), row.actualEndDate || ''])),
    cycleDays: actualStarts.length > 0 && actualEnds.length > 0
      ? Math.max(0, Math.ceil((Math.max(...actualEnds) - Math.min(...actualStarts)) / 86_400_000))
      : null,
  })

  const thStyle: CSSProperties = {
    background: '#f8fafc', fontWeight: 600, fontSize: 13, color: '#4b5563', padding: '10px 12px',
    border: '1px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'center',
  }
  const tdStyle: CSSProperties = {
    padding: '8px 12px', fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap', minWidth: 100,
    border: '1px solid #e5e7eb',
  }
  const versionThStyle: CSSProperties = {
    ...thStyle, position: 'sticky', left: 0, zIndex: 2, minWidth: 80, background: '#f8fafc', borderBottom: 'none',
  }
  const cycleThStyle: CSSProperties = {
    ...thStyle, position: 'sticky', left: 80, zIndex: 2, minWidth: 80, background: '#f8fafc', borderBottom: 'none',
  }
  const versionTdStyle: CSSProperties = {
    ...tdStyle, position: 'sticky', left: 0, zIndex: 1, fontWeight: 600, background: '#fff', minWidth: 80,
  }
  const cycleTdStyle: CSSProperties = {
    ...tdStyle, position: 'sticky', left: 80, zIndex: 1, background: '#fff', minWidth: 80,
  }

  return (
    <div
      className="technical-horizontal-plan-scroll"
      style={{ overflow: 'auto' }}
      role="region"
      aria-label="技术项目横版计划"
      tabIndex={0}
    >
      <table
        className="pms-level1-horizontal-table technical-horizontal-plan-table"
        aria-label="技术项目横版计划表"
        style={{ width: '100%', borderCollapse: 'collapse' }}
      >
        <thead>
          {mode === 'technical-subproject' ? (
            <tr data-technical-plan-header="single-row">
              <th scope="col" style={versionThStyle}>版本</th>
              <th scope="col" style={cycleThStyle}>开发周期</th>
              {milestoneTasks.map(task => <th key={getTechnicalPlanRowKey(task)} scope="col" style={thStyle}>{task.taskName}</th>)}
            </tr>
          ) : (
            <>
              <tr data-technical-plan-header="grouped">
                <th scope="col" style={versionThStyle} rowSpan={2}>版本</th>
                <th scope="col" style={cycleThStyle} rowSpan={2}>开发周期</th>
                {groups.map(({ stage, colSpan }, index) => {
                  const stageColor = TECHNICAL_STAGE_COLORS[index % TECHNICAL_STAGE_COLORS.length]
                  return (
                    <th
                      key={getTechnicalPlanRowKey(stage)}
                      scope="colgroup"
                      colSpan={colSpan}
                      style={{ ...thStyle, background: `${stageColor}10`, color: stageColor, borderBottom: `2px solid ${stageColor}` }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left' }}>
                        <span>{stage.taskName}</span>
                        <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                          {stage.estimatedDays == null ? '-' : `${stage.estimatedDays}天`}
                        </Tag>
                      </div>
                    </th>
                  )
                })}
              </tr>
              <tr>
                {groups.flatMap(({ stage, milestones }) => (
                  milestones.length > 0
                    ? milestones.map(milestone => <th key={getTechnicalPlanRowKey(milestone)} scope="col" style={thStyle}>{milestone.taskName}</th>)
                    : [<th key={getTechnicalPlanRowKey(stage)} scope="col" style={{ ...thStyle, color: '#bfbfbf' }}>{stage.taskName}</th>]
                ))}
              </tr>
            </>
          )}
        </thead>
        <tbody>
          {rows.filter(row => row.rowType === 'version').map(row => {
            const isCurrent = row.id === currentVersionId
            return (
              <tr
                key={row.id}
                className={isCurrent ? 'technical-horizontal-current' : undefined}
                style={isCurrent ? { background: '#fafffe' } : undefined}
              >
                <td style={{ ...versionTdStyle, color: isCurrent ? 'var(--pms-brand)' : '#111827', background: isCurrent ? 'var(--pms-brand-surface)' : '#fff' }}>
                  <Space size={5} style={{ justifyContent: 'center', width: '100%' }}>
                    <span>{row.versionNo}</span>
                    {row.status === '修订中' && (
                      <Tooltip title="修订中">
                        <EditOutlined aria-label="修订中" style={{ color: '#722ed1', fontSize: 13 }} />
                      </Tooltip>
                    )}
                  </Space>
                </td>
                <td style={{ ...cycleTdStyle, background: isCurrent ? '#f0f9ff' : '#fff' }}>
                  <Tooltip title="所有一级活动的预估工期总和"><span>{row.cycleDays ?? '-'}</span></Tooltip>
                </td>
                {milestoneTasks.map(milestone => {
                  const value = row.endDatesByTaskId[getTechnicalPlanRowKey(milestone)] || ''
                  return (
                    <td key={getTechnicalPlanRowKey(milestone)} style={tdStyle}>
                      {isCurrent && canEditPlanEnd
                        ? <ClickToEditDate align="center" value={value} onChange={nextValue => onDateChange(milestone.id, 'planEndDate', nextValue)} />
                        : value || '-'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {rows.filter(row => row.rowType === 'actual').map(row => (
            <tr key={row.id} className="technical-horizontal-actual" style={{ background: '#fffbe6' }}>
              <td style={{ ...versionTdStyle, color: '#d48806', background: '#fffbe6', fontSize: 12 }}>
                <Tooltip title="最近已发布版本的实际完成数据"><span>{row.versionNo}</span></Tooltip>
              </td>
              <td style={{ ...cycleTdStyle, background: '#fffbe6' }}>
                <Tooltip title="最早实际开始到最晚实际完成的天数"><span>{row.cycleDays ?? '-'}</span></Tooltip>
              </td>
              {milestoneTasks.map(milestone => {
                const value = row.endDatesByTaskId[getTechnicalPlanRowKey(milestone)] || ''
                return (
                  <td key={getTechnicalPlanRowKey(milestone)} style={{ ...tdStyle, color: '#d48806' }}>
                    {canEditActualEnd
                      ? <ClickToEditDate align="center" value={value} onChange={nextValue => onDateChange(milestone.id, 'actualEndDate', nextValue)} />
                      : value || '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  const { message, modal } = App.useApp()
  const [activeKey, setActiveKey] = useState(`${projectId}:tdt`)
  const [viewMode, setViewMode] = useState<PlanWorkspaceViewMode>('horizontal')
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareBaseId, setCompareBaseId] = useState('')
  const [compareTargetId, setCompareTargetId] = useState('')
  const [hasCompared, setHasCompared] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<AnyFilterCondition[]>([])
  const [tempFilters, setTempFilters] = useState<AnyFilterCondition[]>([createFilterCondition()])
  const [configuringChild, setConfiguringChild] = useState<TechnicalSubproject | null>(null)
  const [configTrigger, setConfigTrigger] = useState<HTMLElement | null>(null)
  const [deleteOpening, setDeleteOpening] = useState<TechnicalSubprojectTransferScopeToken | null>(null)
  const [transferConfirmation, setTransferConfirmation] = useState<TechnicalSubprojectTransferScopeToken | null>(null)
  const activeKeyRef = useRef(activeKey)

  const subprojects = useTechnicalProjectStore(state => state.subprojects)
  const plansByKey = useTechnicalPlanStore(state => state.plansByKey)
  const createRevision = useTechnicalPlanStore(state => state.createRevision)
  const publishRevision = useTechnicalPlanStore(state => state.publishRevision)
  const cancelRevision = useTechnicalPlanStore(state => state.cancelRevision)
  const updateCurrentTasks = useTechnicalPlanStore(state => state.updateCurrentTasks)
  const setCurrentVersion = useTechnicalPlanStore(state => state.setCurrentVersion)
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
  useEffect(() => { activeKeyRef.current = activeKey }, [activeKey])
  const tab = tabs.find(item => item.key === activeKey) || tabs[0]
  const scope = tab?.scope || { kind: 'tdt' as const, parentProjectId: projectId }
  const instance = plansByKey[getTechnicalPlanKey(scope)]
  const canViewTechnicalDraft = canViewTechnicalPlan && canEdit
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
  const projectedTasks: TechnicalPlanRow[] = useMemo(
    () => tab?.templateKind === 'subproject'
      ? projectTechnicalSubprojectRows(tasks) as TechnicalPlanRow[]
      : projectTechnicalPlanRows('tdt', tasks) as TechnicalPlanRow[],
    [tab?.templateKind, tasks],
  )
  const filterFields = useMemo(
    () => getTechnicalPlanFilterFields(tab?.templateKind || 'tdt', projectedTasks),
    [projectedTasks, tab?.templateKind],
  )
  const milestoneValidation = useMemo(() => validateTechnicalTdtMilestoneDates(tasks), [tasks])
  const subprojectValidation = useMemo(() => validateTechnicalSubprojectDates(tasks), [tasks])
  const collapsedIds = useMemo(() => new Set(instance?.collapsedRows || []), [instance?.collapsedRows])
  const directlyFilteredTasks = useMemo(
    () => applyPlanWorkspaceFilters(projectedTasks, filters, filterFields),
    [filterFields, filters, projectedTasks],
  )
  const hasActiveFilters = filters.some(isFilterConditionActive)
  const filteredTasks = useMemo(() => hasActiveFilters ? directlyFilteredTasks : [...projectedTasks], [directlyFilteredTasks, hasActiveFilters, projectedTasks])
  const filteredHierarchyTasks = useMemo(
    () => filterTechnicalPlanGanttTasks(tasks, tab?.templateKind || 'tdt', filteredTasks),
    [filteredTasks, tab?.templateKind, tasks],
  )
  const visibleTasks = filteredTasks
  const publishedVersions = useMemo(
    () => canViewTechnicalPlan
      ? (instance?.versions || []).filter(version => version.status === '已发布')
      : [],
    [canViewTechnicalPlan, instance?.versions],
  )
  const hasDraft = Boolean(instance?.versions.some(version => version.status === '修订中'))
  const canEditTaskStructure = canMaintain && tab?.templateKind === 'subproject' && viewMode === 'vertical'
  const canMutateTechnicalTaskStructure = (task: TechnicalTemplateTask, action: 'rename' | 'delete' | 'reorder') => Boolean(
    canEditTaskStructure
    && canMutateLevel1TaskStructure({
      projectType: '技术项目',
      technicalKind: tab?.templateKind,
      task,
      action,
    }),
  )
  const canEditActualDates = canEditTechnicalPlan && (isDraft || currentVersion?.id === latestPublishedVersion?.id)
  const hasDeletableCustomTask = tab?.templateKind === 'subproject' && tasks.some(task => canMutateTechnicalTaskStructure(task, 'delete'))

  const createSubprojectActionOpening = (): TechnicalSubprojectTransferScopeToken => ({
    projectId,
    tabId: activeKey,
    scopeKey: getTechnicalPlanKey(scope),
    versionId: currentVersion?.id || '',
    user: currentLoginUser || '',
  })

  const resolveLatestSubprojectActionContext = (opening: TechnicalSubprojectTransferScopeToken) => {
    const latestProject = useProjectStore.getState().selectedProject
    if (!latestProject || latestProject.id !== opening.projectId) return null
    const latestPermissionState = usePermissionStore.getState()
    const latestTabs = buildTechnicalPlanTabs(latestProject.id, useTechnicalProjectStore.getState().subprojects, false)
    const latestTab = latestTabs.find(item => item.key === opening.tabId)
    const latestInstance = useTechnicalPlanStore.getState().plansByKey[opening.scopeKey]
    const latestVersion = latestInstance?.versions.find(version => version.id === latestInstance.currentVersionId)
    const latestUser = useProjectStore.getState().currentLoginUser
    if (!latestTab || !latestVersion) return null
    const latestTechnicalRole = latestPermissionState.rolesByProject[latestProject.id]
      ?.find(role => role.name === '技术项目负责人')
    const latestGlobalAdmins = latestPermissionState.globalRoles.find(role => role.name === '管理组')?.members || []
    const latestTechnicalLead = String(
      (latestProject as { technicalLead?: string; fieldValues?: { technicalLead?: string } }).technicalLead
      || (latestProject as { fieldValues?: { technicalLead?: string } }).fieldValues?.technicalLead
      || latestTechnicalRole?.members?.[0]
      || '',
    ).trim()
    const latestReadOnlyReason = latestTab.subproject && !latestTab.subproject.active
      ? '已停用子项目仅可查看历史计划'
      : latestTab.subproject && (!latestTab.subproject.configuration.coreValue || !latestTab.subproject.configuration.developmentMode)
        ? '请先完成子项目信息配置'
        : ''
    const latestCanView = hasPermission(latestUser, latestProject.id, 'plan:一级计划-查看')
    const latestCanEdit = hasPermission(latestUser, latestProject.id, 'plan:一级计划-编辑')
    const latestCanMaintain = latestCanView
      && latestCanEdit
      && !latestReadOnlyReason
      && canMaintainLevel1Plan({
        projectType: latestProject.type,
        currentUser: latestUser,
        spmUsers: [],
        technicalLead: latestTechnicalLead,
        globalAdmins: latestGlobalAdmins,
      })
    return {
      tab: latestTab,
      version: latestVersion,
      canView: latestCanView,
      canEdit: latestCanEdit,
      canMaintain: latestCanMaintain,
      current: {
        projectId: latestProject.id,
        tabId: activeKeyRef.current,
        scopeKey: getTechnicalPlanKey(latestTab.scope),
        versionId: latestVersion.id,
        user: latestUser,
      },
    }
  }

  useEffect(() => {
    setIsEditMode(Boolean(canMaintain))
  }, [canMaintain, setIsEditMode])
  useEffect(() => () => setIsEditMode(false), [setIsEditMode])

  useEffect(() => {
    setFilters([])
    setTempFilters([createFilterCondition()])
    setFilterOpen(false)
    setViewMode('horizontal')
    setCompareOpen(false)
    setHasCompared(false)
    setTransferConfirmation(null)
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
    modal.confirm({
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
    const invalidByTaskId = tab?.templateKind === 'subproject'
      ? subprojectValidation.byTaskId
      : milestoneValidation.byTaskId
    const firstInvalidTaskId = Object.keys(invalidByTaskId)[0]
    if (firstInvalidTaskId) {
      const invalidTask = tasks.find(task => task.id === firstInvalidTaskId)
      const firstInvalidRowKey = invalidTask ? getTechnicalPlanRowKey(invalidTask) : firstInvalidTaskId
      setCollapsed(scope, [])
      setFilters([])
      setTempFilters([createFilterCondition()])
      setFilterOpen(false)
      setViewMode('vertical')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.querySelector(`[data-row-key="${CSS.escape(firstInvalidRowKey)}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      })
      const firstReason = Object.values(invalidByTaskId[firstInvalidTaskId] || {}).flat()[0]
      message.error(firstReason || '请先修复计划日期冲突')
      return
    }
    if (publishRevision(scope).ok) message.success('计划已发布')
  }

  const updateTask = (id: string, patch: Partial<TechnicalTemplateTask>) => {
    const fields = Object.keys(patch)
    const task = tasks.find(item => item.id === id)
    if (!task || fields.some(field => !['planStartDate', 'planEndDate', 'actualStartDate', 'actualEndDate'].includes(field))) return
    const updatesPlan = fields.some(field => field === 'planStartDate' || field === 'planEndDate')
    const updatesActual = fields.some(field => field === 'actualStartDate' || field === 'actualEndDate')
    if ((updatesPlan && !canMaintain) || (updatesActual && !canEditActualDates)) return
    const next = applyPlanTaskDatePatch(tasks, { taskId: id, patch })
    updateCurrentTasks(scope, next, maxDepth)
  }

  const handleDeleteTask = (stableId: string, opening: TechnicalSubprojectTransferScopeToken | null) => {
    if (!opening) { message.error('计划状态已变化，请重新操作'); return }
    const latest = resolveLatestSubprojectActionContext(opening)
    const latestTask = latest?.version.tasks.find(item => (item.stableId || item.id) === stableId)
    const canDeleteLatestTask = Boolean(
      latestTask
      && latest?.tab.templateKind === 'subproject'
      && viewMode === 'vertical'
      && latest.canMaintain
      && canMutateLevel1TaskStructure({
        projectType: '技术项目',
        technicalKind: latest.tab.templateKind,
        task: latestTask,
        action: 'delete',
      }),
    )
    if (!latest || !latestTask || !canConfirmTechnicalSubprojectMutation({
      opening,
      current: latest.current,
      isCurrentDraft: latest.version.status === '修订中',
      isEditMode: useUiStore.getState().isEditMode,
      canView: latest.canView,
      canEdit: latest.canEdit,
      canMaintain: canDeleteLatestTask,
    })) {
      message.error('计划状态已变化，请重新操作')
      return
    }
    const next = renumberTechnicalSubprojectTasks(latest.version.tasks.filter(item => (item.stableId || item.id) !== stableId))
    const updated = useTechnicalPlanStore.getState().updateCurrentTasks(latest.tab.scope, next, 1)
    if (!updated.ok) { message.error('删除活动失败，请重试'); return }
    message.success('已删除活动')
  }

  const confirmAddTechnicalSubprojectTransfer = () => {
    if (!tab || tab.templateKind !== 'subproject' || !canMaintain) return
    setTransferConfirmation(createSubprojectActionOpening())
  }

  const handleScopeChange = (nextKey: string) => {
    navigateWithEditGuard(() => {
      setFilterOpen(false)
      setActiveKey(nextKey)
    }, Boolean(isDraft))
  }

  const handleVersionChange = (versionId: string) => {
    navigateWithEditGuard(() => setCurrentVersion(scope, versionId), Boolean(isDraft))
  }

  const expandAll = () => setCollapsed(scope, [])
  const collapseAll = () => setCollapsed(scope, filteredHierarchyTasks
    .filter(task => tasks.some(child => child.parentId === task.id))
    .map(task => task.id))
  const dateErrors = (row: TechnicalPlanRow, field: string) => {
    const byTaskId = (tab?.templateKind === 'subproject' ? subprojectValidation.byTaskId : milestoneValidation.byTaskId) as Record<string, Record<string, string[] | undefined>>
    return byTaskId[row.id]?.[field] || []
  }
  const renderDate = (field: 'planStartDate' | 'planEndDate' | 'actualStartDate' | 'actualEndDate', editable: (row: TechnicalPlanRow) => boolean) => (
    (value: string, row: TechnicalPlanRow) => {
      const reasons = dateErrors(row, field)
      const content = editable(row)
        ? <DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { [field]: date?.format('YYYY-MM-DD') || '' })} />
        : value || '-'
      return reasons.length ? <Tooltip title={reasons.join('；')}>{content}</Tooltip> : content
    }
  )
  const tdtColumns: ColumnsType<TechnicalPlanRow> = [
    { title: '序号', dataIndex: 'sequence', key: 'sequence', width: 72, fixed: 'left' },
    { title: '阶段', dataIndex: 'stageName', key: 'stageName', width: 150, fixed: 'left' },
    { title: '里程碑点', dataIndex: 'milestoneName', key: 'milestoneName', width: 180, fixed: 'left' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: value => value || '-' },
    { title: '计划完成时间', dataIndex: 'planEndDate', key: 'planEndDate', width: 145, onCell: row => ({ className: dateErrors(row, 'planEndDate').length ? 'pms-cell-invalid' : '' }), render: renderDate('planEndDate', () => canMaintain) },
    { title: '计划开发周期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 120, render: value => value == null ? '-' : `${value}天` },
    { title: '实际完成时间', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 145, onCell: row => ({ className: dateErrors(row, 'actualEndDate').length ? 'pms-cell-invalid' : '' }), render: renderDate('actualEndDate', () => canEditActualDates) },
    { title: '实际开发周期', dataIndex: 'actualDays', key: 'actualDays', width: 120, render: value => value == null ? '-' : `${value}天` },
  ]
  const subprojectColumns: ColumnsType<TechnicalPlanRow> = [
    { title: '序号', dataIndex: 'sequence', key: 'sequence', width: 72, fixed: 'left' },
    { title: '活动名称', dataIndex: 'activityName', key: 'activityName', width: 180, fixed: 'left' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: value => value || '-' },
    { title: '计划开始时间', dataIndex: 'planStartDate', key: 'planStartDate', width: 145, onCell: row => ({ className: dateErrors(row, 'planStartDate').length ? 'pms-cell-invalid' : '' }), render: renderDate('planStartDate', () => canMaintain) },
    { title: '计划完成时间', dataIndex: 'planEndDate', key: 'planEndDate', width: 145, onCell: row => ({ className: dateErrors(row, 'planEndDate').length ? 'pms-cell-invalid' : '' }), render: renderDate('planEndDate', () => canMaintain) },
    { title: '计划周期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 100, render: value => value == null ? '-' : `${value}天` },
    { title: '实际开始时间', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 145, onCell: row => ({ className: dateErrors(row, 'actualStartDate').length ? 'pms-cell-invalid' : '' }), render: renderDate('actualStartDate', () => canEditActualDates) },
    { title: '实际完成时间', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 145, onCell: row => ({ className: dateErrors(row, 'actualEndDate').length ? 'pms-cell-invalid' : '' }), render: renderDate('actualEndDate', () => canEditActualDates) },
    { title: '实际周期', dataIndex: 'actualDays', key: 'actualDays', width: 100, render: value => value == null ? '-' : `${value}天` },
  ]
  const columns: ColumnsType<TechnicalPlanRow> = tab?.templateKind === 'subproject' ? [...subprojectColumns] : [...tdtColumns]
  if (hasDeletableCustomTask) columns.push({
    key: 'actions', title: '操作', fixed: 'right', width: 88,
    render: (_: unknown, row: TechnicalPlanRow) => canMutateTechnicalTaskStructure(row, 'delete') && (
      <Popconfirm
        title="确认删除该活动？"
        onOpenChange={open => { if (open) setDeleteOpening(createSubprojectActionOpening()); else setDeleteOpening(null) }}
        onConfirm={() => handleDeleteTask(row.stableId || row.id, deleteOpening)}
      >
        <Tooltip title="删除活动"><Button type="text" danger size="small" aria-label={`删除活动 ${row.activityName}`} icon={<DeleteOutlined />} /></Tooltip>
      </Popconfirm>
    ),
  })
  const verticalTableScrollX = columns.reduce((total, column) => (
    total + (typeof column.width === 'number' ? column.width : 140)
  ), 0)

  const exportHorizontalPlan = () => {
    const groups = buildPlanHorizontalStageGroups(
      filteredHierarchyTasks.map(task => ({ ...task })),
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
      ...milestoneTasks.map(task => row.endDatesByTaskId[getTechnicalPlanRowKey(task)] || '-'),
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
    const exportRows = mode === 'current' ? filteredTasks : projectedTasks
    const exportColumns = [...getTechnicalPlanExportColumns(tab?.templateKind || 'tdt')]
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
    if (!left || !right) return []
    const isSubproject = tab?.templateKind === 'subproject'
    return compareVersionsForTable(
      (isSubproject ? projectTechnicalSubprojectRows(left.tasks) : projectLevel1FlatMilestones(left.tasks)) as any,
      (isSubproject ? projectTechnicalSubprojectRows(right.tasks) : projectLevel1FlatMilestones(right.tasks)) as any,
    )
  }, [compareBaseId, compareTargetId, hasCompared, instance, tab?.templateKind, visibleVersions])

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

  const commitTechnicalFilters = (next: AnyFilterCondition[]) => {
    setTempFilters(next)
    setFilters(normalizeFilterConditions(next, filterFields))
  }

  const updateTechnicalFilter = (id: string, patch: Partial<AnyFilterCondition>) => {
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
                <span>- 日期修改自动保存；活动名称、模板阶段和排序不可修改</span>
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
            {isDraft && viewMode === 'gantt' && <Tag>甘特图日期调整自动保存</Tag>}
          </Space>
        )}
        primaryActions={(
          <Space size={6}>
            {!hasDraft && (
              <Dropdown
                menu={{ items: PLAN_REVISION_KIND_OPTIONS, onClick: handleCreateRevisionMenuClick }}
                trigger={['click']}
                placement="bottomLeft"
                disabled={!canEditTechnicalPlan || Boolean(readOnlyReason)}
              >
                <Tooltip title={!canEditTechnicalPlan ? '无计划编辑权限' : readOnlyReason}>
                  <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} disabled={!canEditTechnicalPlan || Boolean(readOnlyReason)} aria-label="创建修订">创建修订</Button>
                </Tooltip>
              </Dropdown>
            )}
            {isDraft && (
              <Tooltip title={!canMaintain ? readOnlyReason || '无计划编辑权限' : !publishedVersions.length ? '暂无已发布版本' : '计划克隆'}>
                <Button icon={<CopyOutlined />} style={{ borderRadius: 6 }} disabled={!canMaintain || !publishedVersions.length} onClick={handleClonePlan} aria-label="计划克隆" />
              </Tooltip>
            )}
            {tab?.templateKind === 'subproject' && canMaintain && (
              <Tooltip title="添加转测版本"><Button icon={<PlusOutlined />} aria-label="添加转测版本" onClick={confirmAddTechnicalSubprojectTransfer}>添加转测版本</Button></Tooltip>
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
              addDisabled={tempFilters.length >= filterFields.length}
              onClose={() => setFilterOpen(false)}
            >
              <div className="pms-filter-condition-list technical-plan-filter-list">
                {tempFilters.map(condition => {
                  const definition = filterFields.find(item => item.key === condition.field)
                  return (
                    <div key={condition.id} className="pms-filter-condition-row technical-plan-filter-row">
                      <Select
                        aria-label="筛选字段"
                        placeholder="筛选字段"
                        value={condition.field || undefined}
                        options={getFieldOptionsWithDuplicateDisabled(
                          filterFields.map(field => ({ value: field.key, label: field.label })),
                          tempFilters,
                          condition.id,
                        )}
                        onChange={field => {
                          const nextDefinition = filterFields.find(item => item.key === field)
                          updateTechnicalFilter(condition.id, {
                            field,
                            operator: getDefaultFilterOperator(nextDefinition?.kind ?? 'text'),
                            value: '',
                          })
                        }}
                      />
                      <Select
                        aria-label="筛选条件"
                        value={condition.operator === 'equalsAny' ? 'contains' : condition.operator}
                        options={[...getFilterOperatorsForKind(definition?.kind || 'text')]}
                        onChange={(operator: FilterOperator) => updateTechnicalFilter(condition.id, {
                          operator,
                          value: normalizeFilterValueForOperator(
                            condition.value,
                            operator,
                            definition?.kind ?? 'text',
                          ),
                        })}
                      />
                      <FilterConditionValue
                        condition={condition}
                        definition={definition}
                        onChange={value => updateTechnicalFilter(condition.id, { value })}
                      />
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
            <Tooltip title="当前计划列固定，无法配置"><Button icon={<SettingOutlined />} style={{ borderRadius: 6 }} disabled aria-label="字段配置" /></Tooltip>
            {viewMode === 'gantt' && tab?.templateKind === 'tdt' && <>
              <Tooltip title="全部展开"><Button icon={<PlusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={expandAll} aria-label="全部展开" /></Tooltip>
              <Tooltip title="全部收起"><Button icon={<MinusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={collapseAll} aria-label="全部收起" /></Tooltip>
            </>}
            <Tooltip title="版本对比"><Button aria-label="版本对比" icon={<HistoryOutlined />} style={{ borderRadius: 6 }} disabled={visibleVersions.length < 2} onClick={openVersionCompare} /></Tooltip>
          </Space>
        )}
        viewMode={viewMode}
        onViewModeChange={nextViewMode => { setFilterOpen(false); setViewMode(nextViewMode) }}
      >
        {!currentVersion ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划版本，请创建修订" />
        ) : viewMode === 'vertical' ? (
          <div className="technical-plan-vertical-table-shell pms-solid-surface">
            <Table<TechnicalPlanRow>
                  className={`pms-table technical-plan-vertical-table ${canMaintain ? 'pms-table-edit' : ''}`}
                  tableLayout="fixed"
                  rowKey={getTechnicalPlanRowKey}
                  size="middle"
                  pagination={false}
                  scroll={{ x: verticalTableScrollX }}
                  dataSource={visibleTasks}
                  columns={columns}
                  rowClassName={() => 'technical-plan-flat-row'}
                />
          </div>
        ) : viewMode === 'horizontal' ? (
          <TechnicalHorizontalPlanTable
            tasks={filteredHierarchyTasks}
            templateKind={tab?.templateKind || 'tdt'}
            versions={visibleVersions}
            currentVersionId={currentVersion.id}
            canEditPlanEnd={isDraft && canEditTechnicalPlan}
            canEditActualEnd={canEditTechnicalPlan && (isDraft || currentVersion.id === latestPublishedVersion?.id)}
            onDateChange={(taskId, field, value) => updateTask(taskId, { [field]: value })}
          />
        ) : viewMode === 'gantt' ? (
          <DHTMLXGantt
            tasks={buildPlanGanttTasks(filteredHierarchyTasks, {
              mode: tab?.templateKind === 'subproject' ? 'technical-subproject' : 'hierarchical',
              editable: canMaintain,
            })}
            readOnly={!canMaintain}
            collapsedIds={collapsedIds}
            onCollapsedChange={updater => setCollapsed(scope, [...updater(collapsedIds)])}
            onTaskDateChange={change => {
              const mode = tab?.templateKind === 'subproject' ? 'task' : 'milestone'
              if (change.nodeType !== mode) return false
              const next = applyPlanGanttDateChange(tasks, { ...change, mode })
              const valid = tab?.templateKind === 'subproject'
                ? validateTechnicalSubprojectDates(next).valid
                : validateTechnicalTdtMilestoneDates(next).valid
              if (!valid) { message.error('拖动后的日期不符合计划规则'); return false }
              return updateCurrentTasks(scope, next, maxDepth).ok
            }}
          />
        ) : null}
      </PlanWorkspaceShell>

      {transferConfirmation && (
        <Modal
          open
          title="确认添加转测版本？"
          okText="确认添加"
          cancelText="取消"
          onCancel={() => setTransferConfirmation(null)}
          onOk={() => {
            const opening = transferConfirmation
            setTransferConfirmation(null)
            const latest = resolveLatestSubprojectActionContext(opening)
            if (!latest || latest.tab.templateKind !== 'subproject' || !canConfirmTechnicalSubprojectTransfer({
              opening,
              current: latest.current,
              isCurrentDraft: latest.version.status === '修订中',
              isEditMode: useUiStore.getState().isEditMode,
              canView: latest.canView,
              canEdit: latest.canEdit,
              canMaintain: latest.canMaintain,
            })) {
              message.error('当前计划状态已变化，请重新操作')
              return
            }
            const result = insertNextTechnicalSubprojectTransfer(latest.version.tasks)
            if (!result.ok) {
              message.error(result.reason === 'tdr3-missing' ? '未找到 TDR3，无法添加转测版本' : 'TDR3 位置无效，无法添加转测版本')
              return
            }
            const updated = useTechnicalPlanStore.getState().updateCurrentTasks(latest.tab.scope, result.tasks, 1)
            if (!updated.ok) { message.error('添加转测版本失败，请重试'); return }
            message.success(`已添加 ${result.task.taskName}`)
          }}
        >
          系统将在 TDR3 前自动生成下一个转测版本，名称不可修改。
        </Modal>
      )}

      <PlanVersionCompareModal
        fieldMode={tab?.templateKind === 'subproject' ? 'technical-subproject' : 'hierarchical-flat'}
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
