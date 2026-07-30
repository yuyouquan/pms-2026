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
  Typography, Pagination, Drawer, Switch
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
  FilterOutlined, CopyOutlined, QuestionCircleOutlined,
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { MenuProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { compareVersionsForTable, type CompareTableRow, type FieldDiff } from '@/lib/versionCompare'
import {
  FILTER_OPERATORS,
  applyFilterConditions,
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  isFilterConditionActive,
  isValuelessFilterOperator,
  normalizeFilterConditions,
  type FilterCondition,
} from '@/lib/filterConditions'
import { GANTT_SCALE_OPTIONS } from '@/lib/ganttScale'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import {
  comparePlanVersions,
  getDisplayPlanVersionsForHorizontalPlan,
  getNextPlanRevisionVersionNo,
  getPlanVersionId,
  parsePlanVersionNo,
  type PlanRevisionKind,
} from '@/lib/planVersioning'
import {
  JIRA_AFFECT_PROJECT_OPTIONS,
  JIRA_PROJECT_NAME_OPTIONS,
  JIRA_PROJECT_TYPE_OPTIONS,
  JIRA_SERVER_OPTIONS,
  createJiraProjectConfig,
  formatJiraProjectTag,
  getJiraProjectUrl,
  type JiraProjectConfig,
} from '@/lib/jiraProject'
import { notifyPublishChanges, notifyDueTasks } from '@/lib/feishu-notify'
import type { TaskChange, PlanDueNotice } from '@/types/plan-notify'
import type { VersionTrainRecord } from '@/types'
import { exportSheet, exportMergedSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import {
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_TOS_VERSION,
  getProjectTypeFamilyKey,
  isMachineProjectType,
  isSoftwareProjectType,
} from '@/constants/projectTypes'
import {
  buildMarketRowsFromMarkets,
  canUseMarketPlanScope,
  canChangeMainMarket,
  canCreateRevisionForMarket,
  cancelDraftRevision,
  formatFollowVersionSource,
  ensureMarketPlanDataForRows,
  getConfiguredMarketMetadataValue,
  getConfiguredMarketSelection,
  getMainMarket,
  getMarketCurrentVersion,
  getMarketFollowVersionKey,
  getMarketVersions,
  getProjectMarketSnapshotKey,
  isConfiguredMarket,
  isFollowMarket,
  markTaskActualTimeDetachedFromMain,
  mergeFollowMarketActualDates,
  normalizeMarketRows,
  removeFollowVersionMetaForMarkets,
  setMarketCurrentVersion,
  setMarketVersions,
  syncFollowMarketPlans,
  type MarketConfigRow,
  type PlanVersionLike,
} from '@/lib/marketRules'
import {
  buildTosTypeRows,
  createTosTypePlanEntry,
  ensureTosTypePlanDataForRows,
  getMainTosType,
  getTosTypePlanSourceType,
  getTosTypeSummaryGroups,
  getTosTypeCurrentVersion,
  getTosTypeSnapshotKey,
  getTosTypeVersionKey,
  getTosTypeVersions,
  isFollowTosType,
  isTosTypeLevel1ReadOnly,
  normalizeTosTypeRows,
  setTosTypeCurrentVersion,
  setTosTypeVersions,
  type TosPlanType,
  type TosTypeConfigRow,
  type TosTypePlanEntry,
} from '@/lib/tosTypeRules'

import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { useRoadmapStore } from '@/stores/roadmap'
import { usePlanStore, LEVEL2_PLAN_TYPES, FIXED_LEVEL2_PLANS, VERSION_DATA, LEVEL1_TASKS, LEVEL1_TEMPLATE_TASKS, INITIAL_LEVEL2_PLAN_TASKS, ALL_COLUMNS, TABLE_COLUMNS, GANTT_COLUMNS, getColumnsForView, getTemplateSnapshotKey } from '@/stores/plan'
import { useTransferStore } from '@/stores/transfer'
import { usePermissionStore, useHasPermission } from '@/stores/permission'
import { PermissionConfig } from '@/components/permission/PermissionModule'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import { TransferApply, TransferDetail, TransferEntry, TransferReview, TransferSqaReview } from '@/components/transfer/TransferModule'
import RequirementDevPlan from '@/components/plans/RequirementDevPlan'
import VersionTrainPlan, { INITIAL_VERSION_TRAIN_DATA } from '@/components/plans/VersionTrainPlan'
import ProjectInfoModal, { type ProjectInfoSubmitPayload } from '@/components/project-info/ProjectInfoModal'
import TargetProjectInformationView from '@/components/project-info/TargetProjectInformationView'
import MarketEditorModal from '@/components/project-info/MarketEditorModal'
import TosTypeEditorModal from '@/components/project-info/TosTypeEditorModal'
import ProjectPlanInfoGrid from '@/components/project-info/ProjectPlanInfoGrid'
import FieldVisibilityPicker from '@/components/project-info/FieldVisibilityPicker'
import { PROJECT_PLAN_INFO_FIELDS } from '@/constants/projectPlanInfoSchema'
import { useProjectFieldVisibility } from '@/hooks/useProjectFieldVisibility'
import { mergeProjectInfoValues, type ProjectInfoProject } from '@/lib/projectInfoValues'
import {
  getTemplateSnapshotForProjectType,
  getTemplateTasksForProjectType,
} from '@/lib/projectTemplateCompatibility'
import {
  getProjectResponsiblePersons,
  haveProjectResponsiblePersonsChanged,
  mergeResponsiblePersonsIntoVisibleMembers,
  replaceProjectSystemAdministrators,
} from '@/lib/projectResponsibility'
import { PROJECT_STATUS_CONFIG } from '@/data/projects'
import {
  TECH_DOMAIN_OPTIONS,
  TOS_VERSION_OPTIONS,
  WHOLE_MACHINE_BASIC_INFO_FIELDS,
  inferOsSeriesFromProjectName,
  inferTosVersionFromProjectName,
} from '@/constants/projectBasicFields'
import {
  DHTMLXGantt, DragHandle, SortableRow, ClickToEditDate, MiniPipeline,
  getTaskDepth, hasChildren, filterByCollapsed, getAllExpandableIds,
  mergePlans, shiftDateStrForExport,
  NOTIFY_DIFF_FIELDS, MOCK_USER_MAP, type DHTMLXGanttColumn,
} from '@/components/shared/PlanHelpers'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  getDefaultColumnSettings,
  normalizeColumnSettings,
  orderVisibleDefinitions,
} from '@/lib/columnSettings'
import {
  ROLE_COLORS,
  type TransferApplication,
} from '@/mock/transfer-maintenance'
import { ProjectSpaceHeader } from '@/containers/AppShell'

const { Option } = Select
const PLAN_DRAWER_Z_INDEX = 1200
const TOS_VERSION_TRAIN_SNAPSHOT_LEVEL = 'level2-version-train'
const PROJECT_SPACE_STATUS_OPTIONS = [
  { label: '待立项', value: '待立项' },
  { label: '在研', value: '在研' },
  { label: '上市', value: '上市' },
  { label: '转维', value: '转维' },
  { label: 'EOS', value: 'EOS' },
  { label: '暂停', value: '暂停' },
  { label: '已取消', value: '已取消' },
]
const PROJECT_SPACE_TECH_STATUS_OPTIONS = [
  ...PROJECT_SPACE_STATUS_OPTIONS,
  { label: '已迁移', value: '已迁移' },
]
const getProjectStatusOptions = (p: any) => (
  p.type === PROJECT_TYPE_TECH ? PROJECT_SPACE_TECH_STATUS_OPTIONS : PROJECT_SPACE_STATUS_OPTIONS
)

const getSoftwareProductSeriesValue = (project: any) => {
  if (!project) return ''
  if (project.type === PROJECT_TYPE_TOS_VERSION) {
    return project.productSeries || project.osSeries || inferOsSeriesFromProjectName(project.name)
  }
  if (project.type === PROJECT_TYPE_INDEPENDENT_SOFTWARE) {
    return project.productSeries || ''
  }
  return project.productSeries || project.osSeries || inferOsSeriesFromProjectName(project.name)
}
const PROJECT_PLAN_CLONE_TEMPLATE_VERSIONS = ['V2', 'V1'] as const
const PROJECT_PLAN_CLONE_MARKET_VERSION_MAP = {
  OP: ['V3', 'V2', 'V1'],
  TR: ['V2', 'V1'],
} as const
const PROJECT_PLAN_CLONE_MARKET_GROUPS = [
  { label: 'OP', market: 'OP', versions: PROJECT_PLAN_CLONE_MARKET_VERSION_MAP.OP },
  { label: 'TR', market: 'TR', versions: PROJECT_PLAN_CLONE_MARKET_VERSION_MAP.TR },
] as const
const PLAN_TEMPLATE_ROLE_TO_PROJECT_PERMISSION_ROLE = {
  SPM: '项目经理',
} as const
const PLAN_REVISION_KIND_OPTIONS: Array<{ key: PlanRevisionKind; label: string }> = [
  { key: 'gray', label: '创建非正式版本' },
  { key: 'formal', label: '创建正式版本' },
]

const getPlanRevisionKindLabel = (kind: PlanRevisionKind) => (kind === 'gray' ? '非正式' : '正式')

const getLatestActivePlanVersion = (versions: PlanVersionLike[]) => (
  versions
    .filter(version => version.status !== '已取消')
    .filter(version => parsePlanVersionNo(version.versionNo))
    .sort((a, b) => comparePlanVersions(b, a))[0]
)

const getLatestPublishedPlanVersion = (versions: PlanVersionLike[]) => (
  versions
    .filter(version => version.status === '已发布')
    .filter(version => parsePlanVersionNo(version.versionNo))
    .sort((a, b) => comparePlanVersions(b, a))[0]
)

const clearTosTypeExecutionFields = (task: any) => ({
  ...task,
  planStartDate: '',
  planEndDate: '',
  actualStartDate: '',
  actualEndDate: '',
  actualDays: 0,
  status: '未开始',
  progress: 0,
})

const versionTrainRecordsToCompareTasks = (records: VersionTrainRecord[]) => records.map(record => ({
  id: record.id,
  taskName: `${record.versionNo}${record.versionGoal ? ` · ${record.versionGoal}` : ''}`,
  responsible: record.mainTestModel,
  predecessor: record.versionCategory,
  planStartDate: record.planCompileTime,
  planEndDate: record.planTestEndTime,
  estimatedDays: 0,
  actualStartDate: record.actualCompileTime,
  actualEndDate: record.actualTestEndTime,
  actualDays: 0,
  status: record.status,
  progress: record.status === '已完成' ? 100 : record.status === '测试中' ? 60 : record.status === '自检中' ? 30 : 0,
}))

const INITIAL_TOS_CURRENT_VERSION = VERSION_DATA
  .filter(version => version.status === '已发布')
  .sort((left, right) => comparePlanVersions(right, left))[0]?.id || VERSION_DATA[0]?.id || ''

const getPlanRevisionKindFromVersion = (version?: PlanVersionLike): PlanRevisionKind | null => {
  if (!version) return null
  const parsed = parsePlanVersionNo(version.versionNo)
  if (!parsed) return null
  return parsed.minor === null ? 'formal' : 'gray'
}

type PlanFilterCondition = FilterCondition
type PlanCloneSource = {
  type: 'template' | 'market'
  label: string
  versionNo: string
  market?: string
}

// 计划时间合法性校验：每个违规任务对应字段返回具体原因列表（用于 Tooltip 展示）
// 规则：
//   1. 同一行：planStartDate <= planEndDate
//   2. 父子关系：子.planStartDate >= 父.planStartDate 且 子.planEndDate <= 父.planEndDate
// 任一方日期为空跳过（空值不算违规，避免编辑过程中误报）
type InvalidFields = { start: string[]; end: string[] }
function getInvalidTaskFields(tasks: any[]): Map<string, InvalidFields> {
  const taskMap = new Map<string, any>()
  tasks.forEach((t: any) => taskMap.set(t.id, t))
  const result = new Map<string, InvalidFields>()
  const add = (id: string, key: keyof InvalidFields, reason: string) => {
    if (!result.has(id)) result.set(id, { start: [], end: [] })
    result.get(id)![key].push(reason)
  }
  tasks.forEach((t: any) => {
    // 1. 同一行 start > end → 两个格子都标，提示彼此互斥
    if (t.planStartDate && t.planEndDate && t.planStartDate > t.planEndDate) {
      add(t.id, 'start', `计划开始（${t.planStartDate}）不能晚于计划完成（${t.planEndDate}）`)
      add(t.id, 'end', `计划完成（${t.planEndDate}）不能早于计划开始（${t.planStartDate}）`)
    }
    // 2. 父子时间区间约束
    if (t.parentId) {
      const parent = taskMap.get(t.parentId)
      if (parent) {
        if (t.planStartDate && parent.planStartDate && t.planStartDate < parent.planStartDate) {
          add(t.id, 'start', `计划开始（${t.planStartDate}）不能早于父任务「${parent.taskName}」的计划开始（${parent.planStartDate}）`)
        }
        if (t.planEndDate && parent.planEndDate && t.planEndDate > parent.planEndDate) {
          add(t.id, 'end', `计划完成（${t.planEndDate}）不能晚于父任务「${parent.taskName}」的计划完成（${parent.planEndDate}）`)
        }
      }
    }
  })
  return result
}

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
    projects, selectedProject,
    currentLoginUser,
    basicInfoEditMode, setBasicInfoEditMode, editingProjectFields, setEditingProjectFields,
    selectedMarketTab, setSelectedMarketTab,
    marketConfigsByProjectId, setMarketConfigForProject,
    selectedTosTypeTab, setSelectedTosTypeTab,
    tosTypeConfigsByProjectId, setTosTypeConfigForProject,
    projectMemberMap, setProjectMember, updateProject,
  } = proj

  const roadmapTosVersions = useRoadmapStore(state => state.tosVersions)
  const roadmapTosOptions = useMemo(
    () => [...roadmapTosVersions]
      .sort((left, right) => compareSemanticTos(right, left))
      .map(version => ({ label: version.name, value: version.id })),
    [roadmapTosVersions],
  )

  const {
    projectPlanLevel, setProjectPlanLevel, projectPlanViewMode, setProjectPlanViewMode,
    projectPlanGanttScaleMode, setProjectPlanGanttScaleMode,
    projectPlanOverviewTab, setProjectPlanOverviewTab, planMetaCollapsed, setPlanMetaCollapsed,
    versions: baseVersions, setVersions: setBaseVersions, currentVersion: baseCurrentVersion, setCurrentVersion: setBaseCurrentVersion,
    tasks, setTasks, searchText, setSearchText,
    level2PlanTasks: baseLevel2PlanTasks, setLevel2PlanTasks: setBaseLevel2PlanTasks,
    level2PlanMilestones: baseLevel2PlanMilestones, setLevel2PlanMilestones: setBaseLevel2PlanMilestones,
    createdLevel2Plans: baseCreatedLevel2Plans, setCreatedLevel2Plans: setBaseCreatedLevel2Plans,
    activeLevel2Plan: baseActiveLevel2Plan, setActiveLevel2Plan: setBaseActiveLevel2Plan,
    level2PlanMeta: baseLevel2PlanMeta, setLevel2PlanMeta: setBaseLevel2PlanMeta,
    createFormValues, setCreateFormValues,
    selectedLevel2PlanType, setSelectedLevel2PlanType,
    selectedMilestones, setSelectedMilestones, selectedMRVersion, setSelectedMRVersion,
    columnSettingsByView, setColumnSettingsByView, collapsedNodes, setCollapsedNodes,
    publishedSnapshots, setPublishedSnapshots, configTemplateTasksByType,
    compareVersionA, setCompareVersionA, compareVersionB, setCompareVersionB,
    compareResult, setCompareResult, compareShowUnchanged, setCompareShowUnchanged,
    compareFilterType, setCompareFilterType,
    marketPlanData, setMarketPlanData,
    marketFollowVersionMeta, setMarketFollowVersionMeta,
    marketVersionsByKey, setMarketVersionsByKey,
    marketCurrentVersionByKey, setMarketCurrentVersionByKey,
    tosTypePlanDataByProjectId, setTosTypePlanDataByProjectId,
    tosTypeVersionsByKey, setTosTypeVersionsByKey,
    tosTypeCurrentVersionByKey, setTosTypeCurrentVersionByKey,
    ganttEditingTask, setGanttEditingTask, progressEditingTask, setProgressEditingTask,
    parentTimeWarning, setParentTimeWarning,
    milestoneTimeWarning, setMilestoneTimeWarning,
    predecessorWarning, setPredecessorWarning,
    customTypes,
    planLevel, selectedPlanType,
  } = plan

  const {
    showAddRoleModal, setShowAddRoleModal, newRoleName, setNewRoleName,
    editingRoleName, setEditingRoleName, editRoleNameValue, setEditRoleNameValue,
    permissionActiveRole, setPermissionActiveRole, permConfigTab, setPermConfigTab,
  } = perm

  // Per-project roles/permissions are looked up by selectedProject.id and
  // proxied through setRolesForProject/setRolePermissionsForProject so the
  // existing PermissionConfig signature (which takes roles/setRoles/etc.) is
  // unchanged.
  const _permProjectId = selectedProject?.id ?? ''
  const roles = perm.rolesByProject[_permProjectId] ?? []
  const setRoles = (v: Parameters<typeof perm.setRolesForProject>[1]) => {
    if (!_permProjectId) return
    perm.setRolesForProject(_permProjectId, v)
  }
  const rolePermissions = perm.rolePermissionsByProject[_permProjectId] ?? {}
  const setRolePermissions = (v: Parameters<typeof perm.setRolePermissionsForProject>[1]) => {
    if (!_permProjectId) return
    perm.setRolePermissionsForProject(_permProjectId, v)
  }

  // ═══════ Permissions ═══════
  // RBAC check tied to the currently logged-in user. Global "管理组" bypasses.
  const canDo = useHasPermission(currentLoginUser, selectedProject?.id)
  const canEditBasicInfo = canDo('basicInfo:编辑')
  const canViewBasicInfo = canDo('basicInfo:查看')
  const canEditLevel1Plan = canDo('plan:一级计划-编辑')
  const canEditLevel2Plan = canDo('plan:二级计划-编辑')
  const canEditCurrentPlan = projectPlanLevel === 'level2' ? canEditLevel2Plan : canEditLevel1Plan
  const currentPlanPermissionLabel = projectPlanLevel === 'level2' ? '二级计划' : '一级计划'
  const {
    visibleFieldKeys: visiblePlanInfoFieldKeys,
    setVisibleFieldKeys: setVisiblePlanInfoFieldKeys,
  } = useProjectFieldVisibility({
    userId: currentLoginUser,
    projectId: selectedProject?.id || '__no-project__',
    groupKey: 'plan',
    fields: PROJECT_PLAN_INFO_FIELDS,
    onSaveError: () => {
      void message.error('计划字段显示配置保存失败')
    },
  })

  // ═══════ Local state ═══════
  const lastDueCheckedProjectRef = useRef<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [level1PlanFilters, setLevel1PlanFilters] = useState<PlanFilterCondition[]>([])
  const [tempLevel1PlanFilters, setTempLevel1PlanFilters] = useState<PlanFilterCondition[]>([createFilterCondition()])
  const [showLevel1PlanFilterDrawer, setShowLevel1PlanFilterDrawer] = useState(false)
  const [showMarketEditor, setShowMarketEditor] = useState(false)
  const [marketDraftRows, setMarketDraftRows] = useState<MarketConfigRow[]>([])
  const [showTosTypeEditor, setShowTosTypeEditor] = useState(false)
  const [tosTypeDraftRows, setTosTypeDraftRows] = useState<TosTypeConfigRow[]>([])
  const [showProjectInfoEditor, setShowProjectInfoEditor] = useState(false)
  const [transferInfoCollapsed, setTransferInfoCollapsed] = useState(false)

  useEffect(() => {
    setTransferInfoCollapsed(false)
  }, [selectedProject?.id])

  // ═══════ Derived ═══════
  const isWholeMachineProject = isMachineProjectType(selectedProject?.type)
  const isTosVersionProject = selectedProject?.type === PROJECT_TYPE_TOS_VERSION
  const legacyBuildFields = selectedProject as NonNullable<typeof selectedProject> & {
    buildOption?: string
    buildMarket?: string
  }
  const legacyMarketBuildConfig = selectedProject
    ? {
        buildOption: legacyBuildFields.buildOption,
        buildMarket: legacyBuildFields.buildMarket,
        branchInfo: selectedProject.branchInfo,
        jenkinsUrl: selectedProject.jenkinsUrl,
        buildAddress: selectedProject.buildAddress,
      }
    : undefined
  const marketConfigRows = selectedProject && isWholeMachineProject
    ? buildMarketRowsFromMarkets(
        selectedProject.markets || [],
        marketConfigsByProjectId[selectedProject.id],
        legacyMarketBuildConfig,
      )
    : []
  const primaryMarket = getMainMarket(marketConfigRows)
  const selectedMarketIsConfigured = isConfiguredMarket(marketConfigRows, selectedMarketTab)
  const configuredMarketName = getConfiguredMarketMetadataValue(marketConfigRows, selectedMarketTab)
  const tosTypeConfigRows = selectedProject && isTosVersionProject
    ? buildTosTypeRows(
        selectedProject.versionTypes || [],
        selectedProject.versionType || '',
        tosTypeConfigsByProjectId[selectedProject.id],
      )
    : []
  const primaryTosType = getMainTosType(tosTypeConfigRows)
  const tosTypeScopeSignature = tosTypeConfigRows.map(row => `${row.type}:${row.isMain ? 'main' : row.followsMain ? 'follow' : 'secondary'}`).join('|')
  const scopedPlanLevel = projectPlanLevel === 'level2' ? 'level2' : 'level1'
  const canUseSelectedMarketPlanScope = canUseMarketPlanScope(
    marketConfigRows,
    selectedMarketTab,
    isWholeMachineProject,
    projectPlanLevel,
  )
  const machineMarketPlanUnavailable = isWholeMachineProject && !canUseSelectedMarketPlanScope
  const isMarketScopedLevel1 = !!selectedProject
    && isWholeMachineProject
    && projectPlanLevel === 'level1'
    && selectedMarketIsConfigured
  const isTosTypeScoped = !!selectedProject && isTosVersionProject && !!selectedTosTypeTab
  const effectiveTosLevel1Type = getTosTypePlanSourceType(tosTypeConfigRows, selectedTosTypeTab, 'level1')
  const scopedTosPlanType = scopedPlanLevel === 'level1' ? effectiveTosLevel1Type : selectedTosTypeTab
  const currentTosTypeIsFollow = isTosTypeScoped && isFollowTosType(tosTypeConfigRows, selectedTosTypeTab)
  const followedTosLevel1ReadOnly = isTosTypeScoped
    && scopedPlanLevel === 'level1'
    && isTosTypeLevel1ReadOnly(tosTypeConfigRows, selectedTosTypeTab, 'level1')
  const isFollowReadOnlyOverview = followedTosLevel1ReadOnly && projectPlanLevel === 'overview'
  const tosLevel1FollowSourceText = `当前类型跟随 ${effectiveTosLevel1Type}，请切换到 ${effectiveTosLevel1Type} 维护一级计划`
  const canMaintainCurrentPlan = canEditCurrentPlan
    && !followedTosLevel1ReadOnly
    && !machineMarketPlanUnavailable
  const currentPlanMaintenanceDisabledReason = followedTosLevel1ReadOnly
    ? tosLevel1FollowSourceText
    : `无${currentPlanPermissionLabel}编辑权限`
  const canCreateCurrentRevision = canMaintainCurrentPlan && (
    !isMarketScopedLevel1 || canCreateRevisionForMarket(marketConfigRows, selectedMarketTab, scopedPlanLevel)
  )
  const latestTemplateVersion = useMemo(
    () => baseVersions.filter(version => version.status === '已发布').sort((left, right) => comparePlanVersions(right, left))[0],
    [baseVersions],
  )
  const tosTypeSeedEntry = useMemo<TosTypePlanEntry>(() => {
    const templateSnapshot = latestTemplateVersion
      ? getTemplateSnapshotForProjectType(
          publishedSnapshots,
          PROJECT_TYPE_TOS_VERSION,
          latestTemplateVersion.id,
          'level1',
        )
      : undefined
    const templateTasks = templateSnapshot
      || getTemplateTasksForProjectType(configTemplateTasksByType, PROJECT_TYPE_TOS_VERSION)
      || LEVEL1_TEMPLATE_TASKS
    return createTosTypePlanEntry({
      level1Tasks: templateTasks.map(task => {
        const templateRole = task.responsibleRole || task.responsible || ''
        const projectRole = PLAN_TEMPLATE_ROLE_TO_PROJECT_PERMISSION_ROLE[templateRole as keyof typeof PLAN_TEMPLATE_ROLE_TO_PROJECT_PERMISSION_ROLE]
        const roleMembers = projectRole
          ? (roles.find(role => role.name === projectRole)?.members || []).filter(Boolean)
          : []
        return clearTosTypeExecutionFields({
          ...task,
          responsibleRole: templateRole,
          responsible: projectRole ? roleMembers.join(',') : templateRole,
        })
      }),
      level2PlanTasks: INITIAL_LEVEL2_PLAN_TASKS
        .filter(task => FIXED_LEVEL2_PLANS.some(planItem => planItem.id === task.planId))
        .map(clearTosTypeExecutionFields),
      level2PlanMilestones: [],
      createdLevel2Plans: FIXED_LEVEL2_PLANS,
      activeLevel2Plan: FIXED_LEVEL2_PLANS[0].id,
      level2PlanMeta: {},
      versionTrainRecords: INITIAL_VERSION_TRAIN_DATA,
    })
  }, [configTemplateTasksByType, latestTemplateVersion, publishedSnapshots, roles])
  const currentTosTypeData = isTosTypeScoped && selectedProject
    ? (
        tosTypePlanDataByProjectId[selectedProject.id]?.[selectedTosTypeTab]
        || createTosTypePlanEntry(tosTypeSeedEntry)
      )
    : null
  const currentTosLevel1Data = isTosTypeScoped && selectedProject
    ? (
        tosTypePlanDataByProjectId[selectedProject.id]?.[effectiveTosLevel1Type]
        || createTosTypePlanEntry(tosTypeSeedEntry)
      )
    : null

  const versions = useMemo(
    () => (
      isTosTypeScoped && selectedProject
        ? getTosTypeVersions(
            tosTypeVersionsByKey,
            selectedProject.id,
            scopedTosPlanType,
            scopedPlanLevel,
            VERSION_DATA,
          )
        : isMarketScopedLevel1 && selectedProject
          ? getMarketVersions(marketVersionsByKey, selectedProject.id, selectedMarketTab, baseVersions)
          : machineMarketPlanUnavailable
            ? []
            : baseVersions
    ),
    [
      baseVersions,
      isMarketScopedLevel1,
      isTosTypeScoped,
      machineMarketPlanUnavailable,
      marketVersionsByKey,
      scopedPlanLevel,
      selectedMarketTab,
      selectedProject?.id,
      scopedTosPlanType,
      tosTypeVersionsByKey,
    ],
  )
  const currentVersion = isTosTypeScoped && selectedProject
    ? getTosTypeCurrentVersion(
        tosTypeCurrentVersionByKey,
        selectedProject.id,
        scopedTosPlanType,
        scopedPlanLevel,
        versions,
        INITIAL_TOS_CURRENT_VERSION,
      )
    : isMarketScopedLevel1 && selectedProject
      ? getMarketCurrentVersion(marketCurrentVersionByKey, selectedProject.id, selectedMarketTab, versions, baseCurrentVersion)
      : machineMarketPlanUnavailable
        ? ''
        : baseCurrentVersion
  const setVersions = (nextVersions: PlanVersionLike[] | ((prev: PlanVersionLike[]) => PlanVersionLike[])) => {
    if (isTosTypeScoped && selectedProject) {
      setTosTypeVersionsByKey(prev => setTosTypeVersions(
        prev,
        selectedProject.id,
        scopedTosPlanType,
        scopedPlanLevel,
        VERSION_DATA,
        nextVersions,
      ))
      return
    }
    if (isMarketScopedLevel1 && selectedProject) {
      setMarketVersionsByKey(prev => setMarketVersions(prev, selectedProject.id, selectedMarketTab, baseVersions, nextVersions))
      return
    }
    if (machineMarketPlanUnavailable) return
    setBaseVersions(nextVersions as typeof baseVersions)
  }
  const setCurrentVersion = (versionId: string) => {
    if (isTosTypeScoped && selectedProject) {
      setTosTypeCurrentVersionByKey(prev => setTosTypeCurrentVersion(
        prev,
        selectedProject.id,
        scopedTosPlanType,
        scopedPlanLevel,
        versionId,
      ))
      return
    }
    if (isMarketScopedLevel1 && selectedProject) {
      setMarketCurrentVersionByKey(prev => setMarketCurrentVersion(prev, selectedProject.id, selectedMarketTab, versionId))
      return
    }
    if (machineMarketPlanUnavailable) return
    setBaseCurrentVersion(versionId)
  }
  const getVersionsForMarket = (market: string) => (
    selectedProject
      ? getMarketVersions(marketVersionsByKey, selectedProject.id, market, baseVersions)
      : baseVersions
  )
  const setVersionsForMarket = (
    market: string,
    nextVersions: PlanVersionLike[] | ((prev: PlanVersionLike[]) => PlanVersionLike[]),
  ) => {
    if (!selectedProject) return
    setMarketVersionsByKey(prev => setMarketVersions(prev, selectedProject.id, market, baseVersions, nextVersions))
  }
  const setCurrentVersionForMarket = (market: string, versionId: string) => {
    if (!selectedProject) return
    setMarketCurrentVersionByKey(prev => setMarketCurrentVersion(prev, selectedProject.id, market, versionId))
  }
  const hasDraftVersion = versions.some(v => v.status === '修订中')
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'
  const latestPublishedVersion = versions.filter(v => v.status === '已发布').sort((a, b) => comparePlanVersions(b, a))[0]
  const isLatestPublished = !isCurrentDraft && currentVersion === latestPublishedVersion?.id
  const tosLevel1Versions = selectedProject && isTosTypeScoped
    ? getTosTypeVersions(tosTypeVersionsByKey, selectedProject.id, effectiveTosLevel1Type, 'level1', VERSION_DATA)
    : []
  const tosLevel1CurrentVersion = selectedProject && isTosTypeScoped
    ? getTosTypeCurrentVersion(
        tosTypeCurrentVersionByKey,
        selectedProject.id,
        effectiveTosLevel1Type,
        'level1',
        tosLevel1Versions,
        INITIAL_TOS_CURRENT_VERSION,
      )
    : ''
  const tosLevel1CurrentVersionData = tosLevel1Versions.find(version => version.id === tosLevel1CurrentVersion)
  const tosLevel1PublishedSnapshot = selectedProject && isTosTypeScoped && tosLevel1CurrentVersionData?.status === '已发布'
    ? publishedSnapshots[getTosTypeSnapshotKey(selectedProject.id, effectiveTosLevel1Type, 'level1', tosLevel1CurrentVersion)]
    : undefined
  const tosLevel2Versions = selectedProject && isTosTypeScoped
    ? getTosTypeVersions(tosTypeVersionsByKey, selectedProject.id, selectedTosTypeTab, 'level2', VERSION_DATA)
    : []
  const tosLevel2CurrentVersion = selectedProject && isTosTypeScoped
    ? getTosTypeCurrentVersion(
        tosTypeCurrentVersionByKey,
        selectedProject.id,
        selectedTosTypeTab,
        'level2',
        tosLevel2Versions,
        INITIAL_TOS_CURRENT_VERSION,
      )
    : ''
  const tosLevel2CurrentVersionData = tosLevel2Versions.find(version => version.id === tosLevel2CurrentVersion)
  const tosLevel2PublishedSnapshot = selectedProject && isTosTypeScoped && tosLevel2CurrentVersionData?.status === '已发布'
    ? publishedSnapshots[getTosTypeSnapshotKey(selectedProject.id, selectedTosTypeTab, 'level2', tosLevel2CurrentVersion)]
    : undefined
  const hasPublishedLevel1Plan = isTosTypeScoped && selectedProject
    ? getTosTypeVersions(
        tosTypeVersionsByKey,
        selectedProject.id,
        effectiveTosLevel1Type,
        'level1',
        VERSION_DATA,
      ).some(version => version.status === '已发布')
    : versions.some(version => version.status === '已发布')
  const allPlanTypes = [...LEVEL2_PLAN_TYPES, ...customTypes]

  const currentMarketIsFollow = isMarketScopedLevel1 && isFollowMarket(marketConfigRows, selectedMarketTab)
  const currentMarketData = isWholeMachineProject && selectedMarketIsConfigured
    ? marketPlanData[selectedMarketTab]
    : null
  const getCurrentMarketFollowVersionSource = (versionId: string) => {
    if (!selectedProject || !isMarketScopedLevel1) return undefined
    return marketFollowVersionMeta[getMarketFollowVersionKey(selectedProject.id, selectedMarketTab, versionId)]
  }
  const renderVersionLabel = (version: PlanVersionLike) => {
    const base = `${version.versionNo} (${version.status})`
    const followLabel = formatFollowVersionSource(getCurrentMarketFollowVersionSource(version.id))
    if (!followLabel) return base
    return (
      <Space size={4}>
        <span>{base}</span>
        <Tag color="green" style={{ margin: 0, fontSize: 11, lineHeight: '18px', borderRadius: 4 }}>{followLabel}</Tag>
      </Space>
    )
  }
  const versionSelectWidth = isWholeMachineProject && projectPlanLevel === 'level1' ? 250 : 150
  const updateCurrentTosTypeData = (type: string, updater: (previous: TosTypePlanEntry) => TosTypePlanEntry) => {
    if (!selectedProject || !isTosTypeScoped) return
    setTosTypePlanDataByProjectId(previous => {
      const ensured = ensureTosTypePlanDataForRows(previous, selectedProject.id, tosTypeConfigRows, tosTypeSeedEntry)
      const projectData = ensured[selectedProject.id] || {}
      const current = projectData[type] || createTosTypePlanEntry(tosTypeSeedEntry)
      return {
        ...ensured,
        [selectedProject.id]: {
          ...projectData,
          [type]: updater(current),
        },
      }
    })
  }

  // 整机项目按市场隔离；tOS 版本项目按类型隔离；其他项目沿用全局数据。
  const effectiveTasks = currentTosLevel1Data
    ? (tosLevel1PublishedSnapshot ?? currentTosLevel1Data.level1Tasks)
    : currentMarketData?.tasks || (isWholeMachineProject ? [] : tasks)
  const setEffectiveTasks = currentTosLevel1Data
    ? (newTasks: any[] | ((prev: any[]) => any[])) => {
        if (currentTosTypeIsFollow) {
          void message.warning(tosLevel1FollowSourceText)
          return
        }
        updateCurrentTosTypeData(effectiveTosLevel1Type, previous => ({
          ...previous,
          level1Tasks: typeof newTasks === 'function' ? newTasks(previous.level1Tasks) : newTasks,
        }))
      }
    : currentMarketData
      ? (newTasks: any[] | ((prev: any[]) => any[])) => {
        setMarketPlanData((prev: any) => ({
          ...prev,
          [selectedMarketTab]: {
            ...prev[selectedMarketTab],
            tasks: typeof newTasks === 'function' ? newTasks(prev[selectedMarketTab].tasks) : newTasks,
          },
        }))
      }
      : machineMarketPlanUnavailable
        ? () => undefined
        : setTasks

  const effectiveLevel2PlanTasks = currentTosTypeData
    ? (tosLevel2PublishedSnapshot ?? currentTosTypeData.level2PlanTasks)
    : baseLevel2PlanTasks
  const level2PlanTasks = effectiveLevel2PlanTasks
  const setLevel2PlanTasks = currentTosTypeData
    ? (value: any[] | ((previous: any[]) => any[])) => updateCurrentTosTypeData(selectedTosTypeTab, previous => ({
        ...previous,
        level2PlanTasks: typeof value === 'function' ? value(previous.level2PlanTasks) : value,
      }))
    : setBaseLevel2PlanTasks
  const level2PlanMilestones = currentTosTypeData?.level2PlanMilestones || baseLevel2PlanMilestones
  const setLevel2PlanMilestones = currentTosTypeData
    ? (value: string[] | ((previous: string[]) => string[])) => updateCurrentTosTypeData(selectedTosTypeTab, previous => ({
        ...previous,
        level2PlanMilestones: typeof value === 'function' ? value(previous.level2PlanMilestones) : value,
      }))
    : setBaseLevel2PlanMilestones
  const effectiveCreatedLevel2Plans = currentTosTypeData?.createdLevel2Plans || baseCreatedLevel2Plans
  const createdLevel2Plans = effectiveCreatedLevel2Plans
  const setCreatedLevel2Plans = currentTosTypeData
    ? (value: typeof baseCreatedLevel2Plans | ((previous: typeof baseCreatedLevel2Plans) => typeof baseCreatedLevel2Plans)) => updateCurrentTosTypeData(selectedTosTypeTab, previous => ({
        ...previous,
        createdLevel2Plans: typeof value === 'function' ? value(previous.createdLevel2Plans) : value,
      }))
    : setBaseCreatedLevel2Plans
  const activeLevel2Plan = currentTosTypeData?.activeLevel2Plan || baseActiveLevel2Plan
  const setActiveLevel2Plan = currentTosTypeData
    ? (value: string) => updateCurrentTosTypeData(selectedTosTypeTab, previous => ({ ...previous, activeLevel2Plan: value }))
    : setBaseActiveLevel2Plan
  const effectiveLevel2PlanMeta = currentTosTypeData?.level2PlanMeta || baseLevel2PlanMeta
  const level2PlanMeta = effectiveLevel2PlanMeta
  const setLevel2PlanMeta = currentTosTypeData
    ? (value: Record<string, any> | ((previous: Record<string, any>) => Record<string, any>)) => updateCurrentTosTypeData(selectedTosTypeTab, previous => ({
        ...previous,
        level2PlanMeta: typeof value === 'function' ? value(previous.level2PlanMeta) : value,
      }))
    : setBaseLevel2PlanMeta
  const setVersionTrainRecords = currentTosTypeData
    ? (records: typeof INITIAL_VERSION_TRAIN_DATA) => updateCurrentTosTypeData(selectedTosTypeTab, previous => ({
        ...previous,
        versionTrainRecords: records,
      }))
    : undefined
  const isTosVersionTrainPlan = isTosTypeScoped
    && projectPlanLevel === 'level2'
    && activeLevel2Plan === 'plan1'
  const getVersionTrainSnapshot = (versionId: string): VersionTrainRecord[] | undefined => (
    selectedProject && isTosTypeScoped
      ? publishedSnapshots[getTosTypeSnapshotKey(
          selectedProject.id,
          selectedTosTypeTab,
          TOS_VERSION_TRAIN_SNAPSHOT_LEVEL,
          versionId,
        )] as VersionTrainRecord[] | undefined
      : undefined
  )
  const versionTrainRecordsForCurrentVersion: VersionTrainRecord[] | undefined = isTosVersionTrainPlan
    && tosLevel2CurrentVersionData?.status === '已发布'
    ? (getVersionTrainSnapshot(tosLevel2CurrentVersion) ?? currentTosTypeData?.versionTrainRecords)
    : currentTosTypeData?.versionTrainRecords

  useEffect(() => {
    if (!selectedProject || !isTosVersionProject || tosTypeConfigRows.length === 0) return

    if (!tosTypeConfigRows.some(row => row.type === selectedTosTypeTab)) {
      setSelectedTosTypeTab(primaryTosType || tosTypeConfigRows[0].type)
    }

    const existingProjectData = tosTypePlanDataByProjectId[selectedProject.id] || {}
    if (tosTypeConfigRows.some(row => !existingProjectData[row.type])) {
      setTosTypePlanDataByProjectId(previous => ensureTosTypePlanDataForRows(
        previous,
        selectedProject.id,
        tosTypeConfigRows,
        tosTypeSeedEntry,
      ))
    }
  }, [
    isTosVersionProject,
    primaryTosType,
    selectedProject,
    selectedTosTypeTab,
    setSelectedTosTypeTab,
    setTosTypePlanDataByProjectId,
    tosTypeConfigRows,
    tosTypePlanDataByProjectId,
    tosTypeSeedEntry,
  ])

  useEffect(() => {
    if (!selectedProject || !isTosVersionProject || tosTypeConfigRows.length === 0) return
    const projectId = selectedProject.id
    const planLevels = ['level1', 'level2'] as const

    setTosTypeVersionsByKey(previous => {
      let next = previous
      tosTypeConfigRows.forEach(row => {
        planLevels.forEach(level => {
          const key = getTosTypeVersionKey(projectId, row.type, level)
          if (next[key]) return
          if (next === previous) next = { ...previous }
          next[key] = VERSION_DATA.map(version => ({ ...version }))
        })
      })
      return next
    })
    setTosTypeCurrentVersionByKey(previous => {
      let next = previous
      tosTypeConfigRows.forEach(row => {
        planLevels.forEach(level => {
          const key = getTosTypeVersionKey(projectId, row.type, level)
          if (next[key]) return
          if (next === previous) next = { ...previous }
          next[key] = INITIAL_TOS_CURRENT_VERSION
        })
      })
      return next
    })
  }, [
    isTosVersionProject,
    selectedProject?.id,
    setTosTypeCurrentVersionByKey,
    setTosTypeVersionsByKey,
    tosTypeScopeSignature,
  ])

  useEffect(() => {
    if (!selectedProject || !isTosVersionProject || tosTypeConfigRows.length === 0) return
    const projectId = selectedProject.id
    const projectPlanData = tosTypePlanDataByProjectId[projectId] || {}
    const publishedVersions = VERSION_DATA.filter(version => version.status === '已发布')

    setPublishedSnapshots(previous => {
      let next = previous
      const ensureSnapshot = (key: string, value: unknown[]) => {
        if (next[key] !== undefined) return
        if (next === previous) next = { ...previous }
        next[key] = JSON.parse(JSON.stringify(value))
      }

      tosTypeConfigRows.forEach(row => {
        const entry = projectPlanData[row.type] || tosTypeSeedEntry
        publishedVersions.forEach(version => {
          ensureSnapshot(
            getTosTypeSnapshotKey(projectId, row.type, 'level1', version.id),
            entry.level1Tasks,
          )
          ensureSnapshot(
            getTosTypeSnapshotKey(projectId, row.type, 'level2', version.id),
            entry.level2PlanTasks,
          )
          ensureSnapshot(
            getTosTypeSnapshotKey(projectId, row.type, TOS_VERSION_TRAIN_SNAPSHOT_LEVEL, version.id),
            entry.versionTrainRecords,
          )
        })
      })
      return next
    })
  }, [
    isTosVersionProject,
    selectedProject?.id,
    setPublishedSnapshots,
    tosTypeScopeSignature,
    tosTypeSeedEntry,
  ])

  const getResponsibleNames = (responsible?: string) => (
    (responsible || '')
      .split(/[,，、;；/]/)
      .map(name => name.trim())
      .filter(Boolean)
  )

  const isResponsibleNameMatched = (responsible: string | undefined, userName: string) => (
    !!userName && getResponsibleNames(responsible).includes(userName)
  )

  const getProjectRoleMembers = (templateRole: string) => {
    const projectRole = PLAN_TEMPLATE_ROLE_TO_PROJECT_PERMISSION_ROLE[templateRole as keyof typeof PLAN_TEMPLATE_ROLE_TO_PROJECT_PERMISSION_ROLE]
    if (!projectRole) return []
    return (roles.find(role => role.name === projectRole)?.members || []).filter(Boolean)
  }

  const initializeProjectPlanTasksFromTemplate = (templateTasks: any[]) => (
    JSON.parse(JSON.stringify(templateTasks || [])).map((task: any) => {
      const templateRole = task.responsibleRole || task.responsible || ''
      const projectRole = PLAN_TEMPLATE_ROLE_TO_PROJECT_PERMISSION_ROLE[templateRole as keyof typeof PLAN_TEMPLATE_ROLE_TO_PROJECT_PERMISSION_ROLE]
      const roleMembers = getProjectRoleMembers(templateRole)
      return {
        ...task,
        responsibleRole: templateRole,
        responsible: projectRole ? roleMembers.join(',') : templateRole,
      }
    })
  )

  const versionNoToVersionId = getPlanVersionId

  const cloneTasksWithoutActualDates = (sourceTasks: any[]) => (
    JSON.parse(JSON.stringify(sourceTasks || [])).map((task: any) => ({
      ...task,
      actualStartDate: '',
      actualEndDate: '',
    }))
  )

  const getCloneSourceTasks = (source: PlanCloneSource) => {
    const versionId = versionNoToVersionId(source.versionNo)

    if (source.type === 'template') {
      const projectType = getProjectTypeFamilyKey(selectedProject?.type || selectedPlanType)
      return (
        getTemplateSnapshotForProjectType(publishedSnapshots, projectType, versionId, 'level1')
        || getTemplateTasksForProjectType(configTemplateTasksByType, projectType)
        || LEVEL1_TEMPLATE_TASKS
      )
    }

    if (!source.market) return []
    const marketSnapshotKey = selectedProject
      ? getProjectMarketSnapshotKey(selectedProject.id, source.market, versionId)
      : ''
    return (
      (marketSnapshotKey ? publishedSnapshots[marketSnapshotKey] : undefined)
      || marketPlanData[source.market]?.tasks
      || []
    )
  }

  const handleClonePlanSource = (source: PlanCloneSource) => {
    if (!canMaintainCurrentPlan) {
      void message.warning(
        machineMarketPlanUnavailable
          ? '请先配置并选择有效市场'
          : followedTosLevel1ReadOnly
            ? tosLevel1FollowSourceText
            : `无${currentPlanPermissionLabel}编辑权限`,
      )
      return
    }
    const sourceTasks = getCloneSourceTasks(source)
    if (!sourceTasks.length) {
      message.warning(`未找到 ${source.label} 的计划数据`)
      return
    }
    const resolvedTasks = source.type === 'template'
      ? initializeProjectPlanTasksFromTemplate(sourceTasks)
      : sourceTasks
    setEffectiveTasks(cloneTasksWithoutActualDates(resolvedTasks))
    setIsEditMode(true)
    message.success(`已克隆 ${source.label}，实际开始和实际完成时间已清空`)
  }

  const confirmClonePlanSource = (source: PlanCloneSource) => {
    Modal.confirm({
      title: '确认克隆计划',
      content: `确认将 ${source.label} 的计划信息克隆到当前修订版本？实际开始和实际完成时间不会被克隆。`,
      okText: '确认克隆',
      cancelText: '取消',
      onOk: () => handleClonePlanSource(source),
    })
  }

  const buildPlanCloneMenuItems = (): MenuProps['items'] => [
    {
      key: 'template',
      label: '模板',
      children: PROJECT_PLAN_CLONE_TEMPLATE_VERSIONS.map(versionNo => ({
        key: `template::${versionNo}`,
        label: versionNo,
      })),
    },
    ...PROJECT_PLAN_CLONE_MARKET_GROUPS.map(group => ({
      key: `market::${group.market}`,
      label: group.label,
      children: group.versions.map(versionNo => ({
        key: `market::${group.market}::${versionNo}`,
        label: versionNo,
      })),
    })),
  ]

  const handlePlanCloneMenuClick: MenuProps['onClick'] = ({ key }) => {
    const parts = String(key).split('::')
    if (parts[0] === 'template' && parts[1]) {
      confirmClonePlanSource({ type: 'template', label: `模板 ${parts[1]}`, versionNo: parts[1] })
      return
    }
    if (parts[0] === 'market' && parts[1] && parts[2]) {
      confirmClonePlanSource({ type: 'market', label: `${parts[1]} ${parts[2]}`, market: parts[1], versionNo: parts[2] })
    }
  }

  const renderPlanCloneButton = (style?: CSSProperties) => {
    if (!isCurrentDraft || projectPlanLevel !== 'level1') return null
    const buttonStyle = style || { borderRadius: 6 }
    if (!canMaintainCurrentPlan) {
      return (
        <Tooltip title={followedTosLevel1ReadOnly ? tosLevel1FollowSourceText : '无一级计划编辑权限'}>
          <Button icon={<CopyOutlined />} style={buttonStyle} disabled aria-label="克隆计划" />
        </Tooltip>
      )
    }
    return (
      <Dropdown
        menu={{ items: buildPlanCloneMenuItems(), onClick: handlePlanCloneMenuClick }}
        trigger={['click']}
        placement="bottomLeft"
      >
        <Button icon={<CopyOutlined />} style={buttonStyle} aria-label="克隆计划" title="克隆计划" />
      </Dropdown>
    )
  }

  const buildCreateRevisionMenuItems = (): MenuProps['items'] => (
    PLAN_REVISION_KIND_OPTIONS.map(option => ({
      key: option.key,
      label: option.label,
    }))
  )

  const handleCreateRevisionMenuClick: MenuProps['onClick'] = ({ key }) => {
    handleCreateRevision(key as PlanRevisionKind)
  }

  const renderCreateRevisionButton = (style?: CSSProperties) => {
    const buttonStyle = style || { borderRadius: 6 }
    if (!canCreateCurrentRevision) {
      const disabledReason = followedTosLevel1ReadOnly
        ? tosLevel1FollowSourceText
        : isMarketScopedLevel1 && currentMarketIsFollow
          ? `当前市场跟随 ${primaryMarket}，不能创建一级计划修订`
          : `无${currentPlanPermissionLabel}编辑权限`
      return (
        <Tooltip title={disabledReason}>
          <Button type="primary" icon={<PlusOutlined />} style={buttonStyle} disabled aria-label="创建修订">
            创建修订
          </Button>
        </Tooltip>
      )
    }
    return (
      <Dropdown
        menu={{ items: buildCreateRevisionMenuItems(), onClick: handleCreateRevisionMenuClick }}
        trigger={['click']}
        placement="bottomLeft"
      >
        <Button type="primary" icon={<PlusOutlined />} style={buttonStyle} aria-label="创建修订" title="创建修订">
          创建修订
        </Button>
      </Dropdown>
    )
  }

  const getCurrentTosTypeRows = () => (
    selectedProject
      ? buildTosTypeRows(
          selectedProject.versionTypes || [],
          selectedProject.versionType || '',
          tosTypeConfigsByProjectId[selectedProject.id],
        )
      : []
  )

  const openTosTypeEditor = () => {
    if (!canEditBasicInfo) {
      message.warning('无基本信息编辑权限')
      return
    }
    const rows = getCurrentTosTypeRows()
    setTosTypeDraftRows(rows.length > 0 ? rows.map(row => ({ ...row })) : [{
      id: `tos-type-${Date.now()}`,
      type: 'Full',
      isMain: true,
      followsMain: false,
    }])
    setShowTosTypeEditor(true)
  }

  const saveTosTypeConfig = () => {
    if (!canEditBasicInfo) {
      message.error('无基本信息编辑权限')
      return
    }
    if (!selectedProject || selectedProject.type !== PROJECT_TYPE_TOS_VERSION) return
    const normalizedRows = normalizeTosTypeRows(tosTypeDraftRows)
    if (normalizedRows.length === 0) {
      message.error('请至少配置一个类型')
      return
    }

    const nextTypes = normalizedRows.map(row => row.type)
    const mainType = getMainTosType(normalizedRows) as TosPlanType
    const updatedProject = {
      ...selectedProject,
      versionTypes: nextTypes,
      versionType: mainType,
    } as typeof selectedProject

    setTosTypeConfigForProject(selectedProject.id, normalizedRows)
    setTosTypePlanDataByProjectId(previous => ensureTosTypePlanDataForRows(
      previous,
      selectedProject.id,
      normalizedRows,
      tosTypeSeedEntry,
    ))
    if (!updateProject(selectedProject.id, updatedProject, currentLoginUser)) {
      message.error('类型配置保存失败')
      return
    }
    if (!nextTypes.includes(selectedTosTypeTab as TosPlanType)) setSelectedTosTypeTab(mainType || nextTypes[0])
    setShowTosTypeEditor(false)
    message.success('类型配置已保存')
  }

  const getCurrentMarketRows = () => (
    selectedProject
      ? buildMarketRowsFromMarkets(
          selectedProject.markets || [],
          marketConfigsByProjectId[selectedProject.id],
          legacyMarketBuildConfig,
        )
      : []
  )

  const openMarketEditor = () => {
    if (!canEditBasicInfo) {
      message.warning('无基础信息编辑权限')
      return
    }
    const rows = getCurrentMarketRows()
    setMarketDraftRows(rows.length > 0 ? rows.map(row => ({ ...row })) : [{
      id: `market-${Date.now()}`,
      market: 'OP',
      isMain: true,
      followsMain: false,
      buildOption: '',
      buildMarket: '',
      branchInfo: '',
      jenkinsUrl: '',
      buildAddress: '',
    }])
    setShowMarketEditor(true)
  }

  const saveMarketConfig = () => {
    if (!canEditBasicInfo) {
      message.error('无基础信息编辑权限')
      return
    }
    if (!selectedProject || !isMachineProjectType(selectedProject.type)) return
    const previousRows = getCurrentMarketRows()
    const previousMainMarket = getMainMarket(previousRows)
    const normalizedRows = normalizeMarketRows(marketDraftRows, previousMainMarket)
    if (normalizedRows.length === 0) {
      message.error('请至少配置一个市场')
      return
    }

    const nextMainMarket = getMainMarket(normalizedRows)
    if (
      previousMainMarket
      && nextMainMarket !== previousMainMarket
      && !canChangeMainMarket(getVersionsForMarket(previousMainMarket))
    ) {
      message.error('现有主市场存在修订版本，不可变更主市场')
      return
    }

    const missingBuildOptionRow = normalizedRows.find(row => !row.buildOption?.trim())
    if (missingBuildOptionRow) {
      message.error(`请填写 ${missingBuildOptionRow.market} 市场的编译选项`)
      return
    }
    const missingBuildMarketRow = normalizedRows.find(row => !row.buildMarket?.trim())
    if (missingBuildMarketRow) {
      message.error(`请填写 ${missingBuildMarketRow.market} 市场的编译市场`)
      return
    }

    const missingCancelPauseDateRow = normalizedRows.find(row => (
      row.isCancelPaused === '是' && !row.cancelPauseDate?.trim()
    ))
    if (missingCancelPauseDateRow) {
      message.error(`请填写 ${missingCancelPauseDateRow.market} 市场的取消暂停时间`)
      return
    }

    const nextMarkets = normalizedRows.map(row => row.market)
    const mainMarket = nextMainMarket
    const previousFollowMarkets = new Set(
      previousRows
        .filter(row => !row.isMain && row.followsMain)
        .map(row => row.market),
    )
    const newlyFollowedMarkets = normalizedRows
      .filter(row => !row.isMain && row.followsMain && !previousFollowMarkets.has(row.market))
      .map(row => row.market)
    const currentFollowMarkets = new Set(
      normalizedRows
        .filter(row => !row.isMain && row.followsMain)
        .map(row => row.market),
    )
    const unfollowedMarkets = [...previousFollowMarkets].filter(market => !currentFollowMarkets.has(market))
    const mainMarketVersions = mainMarket ? getVersionsForMarket(mainMarket) : versions
    const mainSourceVersion = getLatestActivePlanVersion(mainMarketVersions)
    const followRevisionKind = getPlanRevisionKindFromVersion(mainSourceVersion)
    const ensuredMarketPlanData = ensureMarketPlanDataForRows(marketPlanData, normalizedRows, LEVEL1_TASKS, FIXED_LEVEL2_PLANS)
    const mainTasksForFollow = mainMarket ? (ensuredMarketPlanData[mainMarket]?.tasks || LEVEL1_TASKS) : LEVEL1_TASKS
    const syncedMarketPlanData = newlyFollowedMarkets.reduce((acc, market) => ({
      ...acc,
      [market]: {
        ...(acc[market] || { level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] }),
        tasks: mergeFollowMarketActualDates(mainTasksForFollow, acc[market]?.tasks || []),
      },
    }), ensuredMarketPlanData)
    const followPublishPlans = selectedProject && mainMarket && mainSourceVersion && followRevisionKind
      ? newlyFollowedMarkets.map(market => {
          const followMarketVersions = getVersionsForMarket(market)
          const versionsWithoutDraft = followMarketVersions.map(version => (
            version.status === '修订中' ? { ...version, status: '已取消' } : version
          ))
          const versionNo = getNextPlanRevisionVersionNo(versionsWithoutDraft, followRevisionKind)
          const versionId = getPlanVersionId(versionNo)
          return {
            market,
            versionId,
            versionNo,
            versions: [...versionsWithoutDraft, { id: versionId, versionNo, status: '已发布' }],
            tasks: syncedMarketPlanData[market]?.tasks || [],
          }
        })
      : []
    const updatedProject = {
      ...selectedProject,
      markets: nextMarkets,
      market: nextMarkets.join(','),
    } as typeof selectedProject

    setMarketConfigForProject(selectedProject.id, normalizedRows)
    if (!updateProject(selectedProject.id, updatedProject, currentLoginUser)) {
      message.error('整机项目的路标必填信息不完整或取值不合法，无法保存')
      return
    }
    setMarketPlanData(syncedMarketPlanData)
    setSelectedMarketTab(getConfiguredMarketSelection(normalizedRows, selectedMarketTab))
    if (unfollowedMarkets.length > 0) {
      setMarketFollowVersionMeta(prev => removeFollowVersionMetaForMarkets(prev, {
        projectId: selectedProject.id,
        markets: unfollowedMarkets,
        versionIds: unfollowedMarkets
          .map(market => getLatestPublishedPlanVersion(getVersionsForMarket(market))?.id)
          .filter((versionId): versionId is string => !!versionId),
      }))
    }
    if (followPublishPlans.length > 0 && mainSourceVersion && followRevisionKind) {
      followPublishPlans.forEach(plan => {
        setVersionsForMarket(plan.market, plan.versions)
        setCurrentVersionForMarket(plan.market, plan.versionId)
      })
      setPublishedSnapshots(prev => {
        const nextSnapshots = { ...prev }
        followPublishPlans.forEach(plan => {
          nextSnapshots[getProjectMarketSnapshotKey(selectedProject.id, plan.market, plan.versionId)] = JSON.parse(JSON.stringify(plan.tasks))
        })
        return nextSnapshots
      })
      setMarketFollowVersionMeta(prev => {
        const nextMeta = { ...prev }
        followPublishPlans.forEach(plan => {
          nextMeta[getMarketFollowVersionKey(selectedProject.id, plan.market, plan.versionId)] = {
            sourceMarket: mainMarket,
            sourceVersionId: mainSourceVersion.id,
            sourceVersionNo: mainSourceVersion.versionNo,
          }
        })
        return nextMeta
      })
      setSelectedMarketTab(followPublishPlans[0].market)
      setIsEditMode(false)
      const kindLabel = getPlanRevisionKindLabel(followRevisionKind)
      const versionText = followPublishPlans.map(plan => `${plan.market} ${plan.versionNo}`).join('、')
      message.success(`市场配置已保存，已为跟随市场发布${kindLabel}版本：${versionText}`)
    } else {
      if (newlyFollowedMarkets.length > 0) {
        message.warning('市场配置已保存，主市场暂无可跟随版本，未自动创建跟随版本')
      } else {
        message.success('市场配置已保存')
      }
    }
    setShowMarketEditor(false)
  }

  const getCurrentJiraProjects = (): JiraProjectConfig[] => {
    const draftValue = editingProjectFields.jiraProjects
    const source = draftValue ?? (selectedProject as any)?.jiraProjects ?? []
    return Array.isArray(source) ? source : []
  }

  const normalizeJiraProjectRows = (rows: JiraProjectConfig[]) => (
    rows
      .map(row => ({
        ...row,
        server: row.server || JIRA_SERVER_OPTIONS[0].value,
        type: row.type || 'sw',
        projectKey: (row.projectKey || '').trim(),
        affectProjects: (row.affectProjects || '').trim(),
      }))
      .filter(row => row.projectKey)
  )

  const updateJiraProjectRows = (updater: (rows: JiraProjectConfig[]) => JiraProjectConfig[]) => {
    setEditingProjectFields((prev: any) => {
      const source = Array.isArray(prev.jiraProjects) ? prev.jiraProjects : []
      const rows = source.length > 0 ? source : [createJiraProjectConfig()]
      return { ...prev, jiraProjects: updater(rows) }
    })
  }

  const updateJiraProjectRow = (rowId: string, patch: Partial<JiraProjectConfig>) => {
    updateJiraProjectRows(rows => rows.map(row => row.id === rowId ? { ...row, ...patch } : row))
  }

  const addJiraProjectRow = () => {
    updateJiraProjectRows(rows => [...rows, createJiraProjectConfig()])
  }

  const copyJiraProjectRow = (rowId: string) => {
    updateJiraProjectRows(rows => {
      const row = rows.find(item => item.id === rowId)
      return row ? [...rows, { ...row, id: `jira-${Date.now()}-${Math.random().toString(16).slice(2)}` }] : rows
    })
  }

  const removeJiraProjectRow = (rowId: string) => {
    updateJiraProjectRows(rows => rows.length > 1 ? rows.filter(row => row.id !== rowId) : [createJiraProjectConfig()])
  }

  const currentProjectTransferApps = useMemo(() =>
    transfer.transferApplications.filter(a => a.projectName === selectedProject?.name),
    [transfer.transferApplications, selectedProject]
  )

  // ═══════ Plan view access matrix (per spec) ═══════
  // 是否当前 plan 视图下任意任务的责任人（L1 或 L2 任一）
  const isResponsibleForAnyTask = useMemo(() => {
    if (!currentLoginUser) return false
    return (effectiveTasks as any[]).some(t => isResponsibleNameMatched(t.responsible, currentLoginUser)) ||
           level2PlanTasks.some(t => isResponsibleNameMatched(t.responsible, currentLoginUser))
  }, [effectiveTasks, level2PlanTasks, currentLoginUser])
  // 用户能否查看修订版：有任一计划编辑权 OR 是某条任务的责任人
  const canViewDraft = canEditLevel1Plan || canEditLevel2Plan || isResponsibleForAnyTask

  // View columns
  const getViewKey = () => `project-${projectPlanLevel}-${projectPlanViewMode}`
  const currentViewMode = projectPlanViewMode
  const currentViewColumns = getColumnsForView(currentViewMode)
  const currentViewKey = getViewKey()
  const storedColumnSettings = columnSettingsByView[currentViewKey]
  const columnSettings = useMemo(
    () => normalizeColumnSettings(currentViewColumns, storedColumnSettings),
    [currentViewColumns, storedColumnSettings],
  )
  const orderedVisibleColumns = useMemo(
    () => orderVisibleDefinitions(currentViewColumns, columnSettings),
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
    setShowColumnModal(false)
    message.success('列配置已保存')
  }

  // Scope key for collapse
  const getScopeKey = (): string | null => {
    if (!selectedProject) return null
    if (isWholeMachineProject && projectPlanLevel === 'level1' && !selectedMarketIsConfigured) return null
    const planDimension = isTosVersionProject
      ? `type::${projectPlanLevel === 'level1' ? effectiveTosLevel1Type : selectedTosTypeTab}`
      : isWholeMachineProject
        ? projectPlanLevel === 'level1'
          ? `market::${configuredMarketName}`
          : 'machine'
        : 'default'
    if (projectPlanLevel === 'level1') return `${selectedProject.id}::${planDimension}::level1`
    if (projectPlanLevel === 'level2' && activeLevel2Plan) return `${selectedProject.id}::${planDimension}::level2::${activeLevel2Plan}`
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
    if (isCurrentDraft && !followedTosLevel1ReadOnly) {
      setIsEditMode(true)
      if (projectPlanViewMode === 'horizontal') setProjectPlanViewMode('table')
    } else {
      setIsEditMode(false)
    }
  }, [currentVersion, followedTosLevel1ReadOnly, isCurrentDraft])

  // 进入项目空间「计划」时按权限+责任人矩阵选择默认版本
  // - 有编辑权 / 是责任人：有修订版 → 默认修订版；无修订版 → 最新已发布
  // - 无编辑权 + 非责任人：无论有无修订版，都默认最新已发布（且下拉里也不展示修订版选项）
  // 用 ref 锁定到 project+市场/类型+level，防止用户手动切换版本后被覆盖
  const lastVersionInitKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeModule !== 'projectSpace') return
    if (projectSpaceModule !== 'plan') return
    if (!selectedProject) return
    if (machineMarketPlanUnavailable) return
    if (versions.length === 0) return
    const draftDimension = isTosTypeScoped
      ? scopedTosPlanType
      : isMarketScopedLevel1
        ? `market::${configuredMarketName}`
        : isWholeMachineProject
          ? 'machine'
          : ''
    const key = `${selectedProject.id}::${draftDimension}::${projectPlanLevel}::${currentLoginUser}`
    if (lastVersionInitKeyRef.current === key) return
    lastVersionInitKeyRef.current = key
    const draft = versions.find(v => v.status === '修订中')
    const latestPub = versions
      .filter(v => v.status === '已发布')
      .sort((a, b) => comparePlanVersions(b, a))[0]
    if (draft && canViewDraft) {
      if (currentVersion !== draft.id) setCurrentVersion(draft.id)
    } else if (latestPub) {
      if (currentVersion !== latestPub.id) setCurrentVersion(latestPub.id)
    }
  }, [activeModule, projectSpaceModule, selectedProject?.id, selectedMarketTab, scopedTosPlanType, projectPlanLevel, canViewDraft, versions, currentLoginUser])

  // Due task scanning
  useEffect(() => {
    if (activeModule !== 'projectSpace') return
    if (!selectedProject) return
    if (projectSpaceModule !== 'plan') return
    if (projectPlanLevel !== 'level1') return
    if (machineMarketPlanUnavailable) return
    const dueScanDimension = isTosTypeScoped
      ? effectiveTosLevel1Type
      : isWholeMachineProject
        ? selectedMarketTab
        : ''
    const key = `${selectedProject.id}::${dueScanDimension}`
    if (lastDueCheckedProjectRef.current === key) return
    lastDueCheckedProjectRef.current = key
    const latestPub = versions
      .filter(v => v.status === '已发布')
      .sort((a, b) => comparePlanVersions(b, a))[0]
    const scanSnapshotKey = latestPub && isTosTypeScoped
      ? getTosTypeSnapshotKey(selectedProject.id, effectiveTosLevel1Type, 'level1', latestPub.id)
      : latestPub && isMarketScopedLevel1
        ? getProjectMarketSnapshotKey(selectedProject.id, selectedMarketTab, latestPub.id)
        : latestPub?.id
    const scanTarget = isTosTypeScoped
      ? (scanSnapshotKey ? publishedSnapshots[scanSnapshotKey] : undefined) || effectiveTasks
      : latestPub && scanSnapshotKey && publishedSnapshots[scanSnapshotKey]
        ? publishedSnapshots[scanSnapshotKey]
        : latestPub && publishedSnapshots[latestPub.id]
          ? publishedSnapshots[latestPub.id]
          : effectiveTasks
    const notices = scanDueTasks(scanTarget)
    if (notices.length === 0) return
    // 后台仍触发飞书 mock 推送，但不再弹 notification 干扰用户进入计划视图的体验
    notifyDueTasks(notices, MOCK_USER_MAP)
  }, [selectedProject?.id, selectedMarketTab, effectiveTosLevel1Type, projectPlanLevel, activeModule, projectSpaceModule])

  // ═══════ Helper functions ═══════
  const toggleNode = (nodeId: string) => {
    const key = getScopeKey()
    if (!key) return
    setCollapsedNodes(prev => { const cur = new Set(prev[key] || []); if (cur.has(nodeId)) cur.delete(nodeId); else cur.add(nodeId); return { ...prev, [key]: cur } })
  }
  const expandAll = () => { const key = getScopeKey(); if (!key) return; setCollapsedNodes(prev => ({ ...prev, [key]: new Set<string>() })) }
  const collapseAll = () => {
    const key = getScopeKey(); if (!key) return
    const scopeTasks = projectPlanLevel === 'level1' ? effectiveTasks : level2PlanTasks.filter(t => t.planId === activeLevel2Plan)
    setCollapsedNodes(prev => ({ ...prev, [key]: new Set(getAllExpandableIds(scopeTasks)) }))
  }

  const planFilterFieldOptions = TABLE_COLUMNS.map(c => ({ label: c.title, value: c.key }))
  const hasActiveLevel1PlanFilters = level1PlanFilters.some(isFilterConditionActive)
  const filteredLevel1PlanTasks = applyFilterConditions(effectiveTasks as any[], level1PlanFilters)
  const filterBySearchText = (taskList: any[]) => taskList.filter((task: any) => {
    if (!searchText) return true
    const s = searchText.toLowerCase()
    return task.id.toLowerCase().includes(s) || task.taskName.toLowerCase().includes(s) || (task.responsible && task.responsible.toLowerCase().includes(s)) || (task.status && task.status.toLowerCase().includes(s))
  })
  const filteredTasks = projectPlanLevel === 'level1'
    ? filteredLevel1PlanTasks
    : filterBySearchText(effectiveTasks as any[])

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
    if (followedTosLevel1ReadOnly) {
      void message.warning(tosLevel1FollowSourceText)
      return
    }
    const isLevel2Context = projectPlanLevel === 'level2'
    const isLevel2TaskContext = isLevel2Context && activeLevel2Plan
    const currentTasks = isLevel2TaskContext ? level2PlanTasks.filter(t => t.planId === activeLevel2Plan) : effectiveTasks
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
      const newTasks = [...effectiveTasks]; newTasks.splice(insertIndex, 0, newTask); setEffectiveTasks(newTasks)
    }
    message.success(`已添加子任务: ${newId}`)
  }

  const handleProgressChange = (taskId: string, newProgress: number) => {
    if (followedTosLevel1ReadOnly) {
      void message.warning(tosLevel1FollowSourceText)
      return
    }
    setEffectiveTasks(effectiveTasks.map(t => {
      if (t.id === taskId) { let s = t.status; if (newProgress === 100) s = '已完成'; else if (newProgress > 0) s = '进行中'; else s = '未开始'; return { ...t, progress: newProgress, status: s } }
      return t
    }))
    setProgressEditingTask(null); message.success('进度已更新')
  }

  const checkParentTimeConstraint = (): { valid: boolean; violations: any[] } => {
    const violations: any[] = []
    effectiveTasks.forEach(task => {
      if (task.parentId) {
        const parentTask = effectiveTasks.find(t => t.id === task.parentId)
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
    const predTask = effectiveTasks.find(t => t.id === task.predecessor)
    if (!predTask || !predTask.planEndDate) return true
    if (field === 'planStartDate' && new Date(newDate).getTime() < new Date(predTask.planEndDate).getTime()) {
      setPredecessorWarning({ visible: true, task: { ...task, [field]: newDate }, message: `任务"${task.taskName}"的开始时间(${newDate})早于前置任务"${predTask.taskName}"的结束时间(${predTask.planEndDate})` })
      return false
    }
    return true
  }

  const handleGanttTimeChange = (taskId: string, field: 'planStartDate' | 'planEndDate', date: string) => {
    if (!canMaintainCurrentPlan) {
      void message.warning(machineMarketPlanUnavailable ? '请先配置并选择有效市场' : currentPlanMaintenanceDisabledReason)
      return
    }
    const task = effectiveTasks.find(t => t.id === taskId); if (!task) return
    if (!checkPredecessor(task, field, date)) return
    setEffectiveTasks(effectiveTasks.map(t => t.id === taskId ? { ...t, [field]: date } : t)); setGanttEditingTask(null); message.success('时间已更新')
  }

  const confirmPredecessorChange = () => {
    if (!canMaintainCurrentPlan) {
      void message.warning(machineMarketPlanUnavailable ? '请先配置并选择有效市场' : currentPlanMaintenanceDisabledReason)
      return
    }
    if (!predecessorWarning.task) return
    setEffectiveTasks(effectiveTasks.map(t => t.id === predecessorWarning.task.id ? predecessorWarning.task : t))
    setPredecessorWarning({ visible: false, task: null, message: '' }); setGanttEditingTask(null); message.success('时间已更新（已确认前置任务冲突）')
  }

  const handleCreateRevision = (revisionKind: PlanRevisionKind) => {
    if (!canCreateCurrentRevision) {
      if (followedTosLevel1ReadOnly) void message.warning(tosLevel1FollowSourceText)
      else if (isMarketScopedLevel1 && currentMarketIsFollow) void message.warning(`当前市场跟随 ${primaryMarket}，不能创建一级计划修订`)
      else void message.warning(`无${currentPlanPermissionLabel}编辑权限`)
      return
    }
    const versionNo = getNextPlanRevisionVersionNo(versions, revisionKind)
    const nid = getPlanVersionId(versionNo)
    const projectType = getProjectTypeFamilyKey(selectedProject?.type || selectedPlanType)
    const templateTasks = getTemplateTasksForProjectType(configTemplateTasksByType, projectType) || LEVEL1_TEMPLATE_TASKS
    const clonedTasks = initializeProjectPlanTasksFromTemplate(templateTasks)
    const kindLabel = getPlanRevisionKindLabel(revisionKind)
    setVersions([...versions, { id: nid, versionNo, status: '修订中' }])
    setCurrentVersion(nid)
    if (projectPlanLevel === 'level1') setEffectiveTasks(clonedTasks)
    if (isTosTypeScoped && projectPlanLevel === 'level2') {
      setLevel2PlanTasks(JSON.parse(JSON.stringify(effectiveLevel2PlanTasks)))
      const sourceTrainRecords = getVersionTrainSnapshot(tosLevel2CurrentVersion)
        ?? currentTosTypeData?.versionTrainRecords
      if (sourceTrainRecords && setVersionTrainRecords) {
        setVersionTrainRecords(JSON.parse(JSON.stringify(sourceTrainRecords)))
      }
    }
    message.success(`已创建${kindLabel}修订版本 ${versionNo}`)
  }

  const handlePublish = () => {
    if (!canMaintainCurrentPlan) {
      void message.warning(followedTosLevel1ReadOnly ? tosLevel1FollowSourceText : `无${currentPlanPermissionLabel}编辑权限`)
      return
    }
    // 父子时间区间校验：违规则阻止发布并滚动到首条违规行
    const tasksToValidate = isTosVersionTrainPlan
      ? []
      : projectPlanLevel === 'level2' && activeLevel2Plan && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1'
      ? level2PlanTasks.filter((t: any) => t.planId === activeLevel2Plan)
      : effectiveTasks
    const invalidFields = getInvalidTaskFields(tasksToValidate as any[])
    if (invalidFields.size > 0) {
      message.error('任务校验不通过，无法发布')
      const firstInvalid = (tasksToValidate as any[]).find((t: any) => invalidFields.has(t.id))
      if (firstInvalid) {
        setTimeout(() => {
          const rows = document.querySelectorAll('.pms-table .ant-table-tbody tr.ant-table-row')
          for (let i = 0; i < rows.length; i++) {
            if (rows[i].getAttribute('data-row-key') === firstInvalid.id) {
              rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' })
              break
            }
          }
        }, 0)
      }
      return
    }
    const prevPublished = versions.filter(v => v.status === '已发布' && v.id !== currentVersion).sort((a, b) => comparePlanVersions(b, a))[0]
    const versionTrainRecordsForSnapshot = currentTosTypeData?.versionTrainRecords || []
    const planTasksForVersion = isTosVersionTrainPlan
      ? versionTrainRecordsForSnapshot
      : projectPlanLevel === 'level2' ? level2PlanTasks : effectiveTasks
    const previousSnapshotKey = selectedProject && isTosTypeScoped && prevPublished
      ? getTosTypeSnapshotKey(
          selectedProject.id,
          scopedTosPlanType,
          isTosVersionTrainPlan ? TOS_VERSION_TRAIN_SNAPSHOT_LEVEL : scopedPlanLevel,
          prevPublished.id,
        )
      : selectedProject && isMarketScopedLevel1 && prevPublished
        ? getProjectMarketSnapshotKey(selectedProject.id, selectedMarketTab, prevPublished.id)
        : ''
    const baselineTasks: any[] = prevPublished
      ? isTosTypeScoped
        ? publishedSnapshots[previousSnapshotKey] || []
        : publishedSnapshots[previousSnapshotKey] || publishedSnapshots[prevPublished.id] || []
      : []
    const changes = isTosVersionTrainPlan ? [] : diffTasksForNotify(baselineTasks, planTasksForVersion)
    const publishedVersionId = currentVersion; const publishedVersion = versions.find(v => v.id === publishedVersionId)
    const mainMarket = getMainMarket(marketConfigRows)
    const shouldSyncFollowMarkets = isMarketScopedLevel1 && selectedMarketTab === mainMarket
    const nextMarketPlanData = shouldSyncFollowMarkets ? syncFollowMarketPlans(marketPlanData, marketConfigRows) : marketPlanData
    const versionNo = publishedVersion?.versionNo || publishedVersionId
    setVersions(versions.map(v => v.id === publishedVersionId ? { ...v, status: '已发布' } : v))
    if (shouldSyncFollowMarkets) setMarketPlanData(nextMarketPlanData)
    if (selectedProject && isMarketScopedLevel1) {
      setMarketFollowVersionMeta(prev => {
        const currentMarketKey = getMarketFollowVersionKey(selectedProject.id, selectedMarketTab, publishedVersionId)
        const nextMeta = { ...prev }
        delete nextMeta[currentMarketKey]
        return nextMeta
      })
    }
    setPublishedSnapshots(prev => {
      const snapshot = JSON.parse(JSON.stringify(planTasksForVersion))
      const nextSnapshots = { ...prev }
      if (selectedProject && isTosTypeScoped) {
        if (scopedPlanLevel === 'level2') {
          // tOS 二级版本是组合快照：任务型二级计划与固定版本火车分别保存，
          // 任一二级计划发布时都会冻结两部分，避免相互覆盖。
          nextSnapshots[getTosTypeSnapshotKey(selectedProject.id, selectedTosTypeTab, 'level2', publishedVersionId)] = JSON.parse(JSON.stringify(level2PlanTasks))
          nextSnapshots[getTosTypeSnapshotKey(selectedProject.id, selectedTosTypeTab, TOS_VERSION_TRAIN_SNAPSHOT_LEVEL, publishedVersionId)] = JSON.parse(JSON.stringify(versionTrainRecordsForSnapshot))
        } else {
          nextSnapshots[getTosTypeSnapshotKey(selectedProject.id, scopedTosPlanType, scopedPlanLevel, publishedVersionId)] = snapshot
        }
      } else if (selectedProject && isMarketScopedLevel1) {
        nextSnapshots[getProjectMarketSnapshotKey(selectedProject.id, selectedMarketTab, publishedVersionId)] = snapshot
      } else {
        nextSnapshots[publishedVersionId] = snapshot
      }
      return nextSnapshots
    })
    if (changes.length > 0) notifyPublishChanges(versionNo, changes, MOCK_USER_MAP).then(notified => {
      if (notified > 0) notification.info({ message: '已通过飞书通知责任人', description: `${projectPlanLevel === 'level2' ? '二级' : '一级'}计划 ${versionNo} 发布，共 ${changes.length} 条变更，已通知 ${notified} 位责任人`, placement: 'topRight', duration: 5 })
    })
    const syncedCount = shouldSyncFollowMarkets ? marketConfigRows.filter(row => row.followsMain).length : 0
    message.success(syncedCount > 0 ? `发布成功，已同步 ${syncedCount} 个跟随市场` : '发布成功')
  }

  const updateActualDateForTask = (
    tableTasks: any[],
    currentSetTasks: (newTasks: any[]) => void,
    record: any,
    field: 'actualStartDate' | 'actualEndDate',
    value: string,
    isLevel2Custom: boolean,
  ) => {
    if ((machineMarketPlanUnavailable && !isLevel2Custom) || (followedTosLevel1ReadOnly && (!isLevel2Custom || isFollowReadOnlyOverview))) {
      void message.warning(machineMarketPlanUnavailable ? '请先配置并选择有效市场' : tosLevel1FollowSourceText)
      return
    }
    const patch = { [field]: value }
    const isLevel1MarketTable = !isLevel2Custom && isMarketScopedLevel1

    if (isLevel1MarketTable && currentMarketIsFollow) {
      currentSetTasks(markTaskActualTimeDetachedFromMain(tableTasks, record.id, patch))
      return
    }

    const updatedTasks = tableTasks.map((task: any) => (
      task.id === record.id ? { ...task, [field]: value } : task
    ))

    if (isLevel1MarketTable && selectedMarketTab === primaryMarket) {
      setMarketPlanData((prev: any) => {
        const nextMarketPlanData = {
          ...prev,
          [selectedMarketTab]: {
            ...(prev[selectedMarketTab] || { level2Tasks: [], createdLevel2Plans: [] }),
            tasks: updatedTasks,
          },
        }
        return syncFollowMarketPlans(nextMarketPlanData, marketConfigRows)
      })
      return
    }

    currentSetTasks(updatedTasks)
  }

  const renderProjectPlanViewModeSwitcher = () => {
    const currentValue = projectPlanViewMode === 'horizontal' && projectPlanLevel === 'level2'
      ? 'table'
      : projectPlanViewMode
    const options = projectPlanLevel === 'level1'
      ? (isEditMode
        ? [
            { label: '竖版表格', value: 'table', icon: <UnorderedListOutlined /> },
            { label: '甘特图', value: 'gantt', icon: <BarChartOutlined /> },
          ]
        : [
            { label: '竖版表格', value: 'table', icon: <UnorderedListOutlined /> },
            { label: '横版表格', value: 'horizontal', icon: <SwapOutlined /> },
            { label: '甘特图', value: 'gantt', icon: <BarChartOutlined /> },
          ])
      : [
          { label: '表格', value: 'table', icon: <UnorderedListOutlined /> },
          { label: '甘特图', value: 'gantt', icon: <BarChartOutlined /> },
        ]

    return (
      <Radio.Group
        value={currentValue}
        onChange={(event) => setProjectPlanViewMode(event.target.value as 'table' | 'horizontal' | 'gantt')}
        buttonStyle="solid"
        size="middle"
        className="pms-plan-view-mode-switcher"
      >
        {options.map(option => (
          <Tooltip title={option.label} key={option.value}>
            <Radio.Button value={option.value} aria-label={option.label}>
              {option.icon}
            </Radio.Button>
          </Tooltip>
        ))}
      </Radio.Group>
    )
  }

  const handleCancelRevision = () => {
    if (!canMaintainCurrentPlan) {
      void message.warning(followedTosLevel1ReadOnly ? tosLevel1FollowSourceText : `无${currentPlanPermissionLabel}编辑权限`)
      return
    }
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
        if (selectedProject && isTosTypeScoped) {
          if (scopedPlanLevel === 'level1') {
            const restoredTasks = publishedSnapshots[getTosTypeSnapshotKey(
              selectedProject.id,
              effectiveTosLevel1Type,
              'level1',
              result.currentVersion,
            )]
            if (restoredTasks !== undefined) {
              setEffectiveTasks(JSON.parse(JSON.stringify(restoredTasks)))
            }
          } else {
            const restoredLevel2Tasks = publishedSnapshots[getTosTypeSnapshotKey(
              selectedProject.id,
              selectedTosTypeTab,
              'level2',
              result.currentVersion,
            )]
            if (restoredLevel2Tasks !== undefined) {
              setLevel2PlanTasks(JSON.parse(JSON.stringify(restoredLevel2Tasks)))
            }
            const restoredRecords = getVersionTrainSnapshot(result.currentVersion)
            if (restoredRecords !== undefined && setVersionTrainRecords) {
              setVersionTrainRecords(JSON.parse(JSON.stringify(restoredRecords)))
            }
          }
        }
        setIsEditMode(false)
        message.success(`${currentVersionData.versionNo} 已取消`)
      },
    })
  }

  // Basic info
  const startBasicInfoEdit = () => {
    if (!selectedProject) return; const p = selectedProject
    const currentJiraProjects = Array.isArray((p as any).jiraProjects) ? (p as any).jiraProjects.map((row: JiraProjectConfig) => ({ ...row })) : []
    setEditingProjectFields({
      projectCode: p.projectCode || p.model || '',
      androidVersion: p.androidVersion || p.operatingSystem || '',
      firstSaleTosVersionId: p.firstSaleTosVersionId || '',
      brand: p.brand || '',
      productLine: p.productLine || '',
      marketName: p.marketName || '',
      productType: p.productType || '',
      platform: p.platform || p.cpu || p.chipPlatform || '',
      startRam: p.startRam || '',
      versionType: p.versionType || '',
      str5Date: p.str5Date || '',
      launchDate: p.launchDate || '',
      developMode: p.developMode || '',
      remark: p.remark || '',
      cooperationForm: p.cooperationForm || '',
      projectLevel: p.projectLevel || '',
      status: p.status || '待立项',
      currentNode: p.currentNode || '',
      healthStatus: p.healthStatus || 'normal',
      systemType: (p as any).systemType || '',
      isGo: (p as any).isGo || '',
      isTwoStage: (p as any).isTwoStage || '',
      isSlimVersion: (p as any).isSlimVersion || '',
      isOutsourcedMini: (p as any).isOutsourcedMini || '',
      jiraProjects: currentJiraProjects.length > 0 ? currentJiraProjects : [createJiraProjectConfig()],
      buildOption: (p as any).buildOption || '',
      buildMarket: (p as any).buildMarket || '',
      branchInfo: p.branchInfo || '',
      jenkinsUrl: p.jenkinsUrl || '',
      buildAddress: p.buildAddress || '',
      ppm: p.ppm || '',
      spm: p.spm || '',
      tpm: p.tpm || '',
      productSeries: isSoftwareProjectType(p.type) ? getSoftwareProductSeriesValue(p) : ((p as any).productSeries || ''),
      osSeries: isSoftwareProjectType(p.type) ? getSoftwareProductSeriesValue(p) : ((p as any).osSeries || inferOsSeriesFromProjectName(p.name)),
      tosVersion: (p as any).tosVersion || inferTosVersionFromProjectName(p.name),
      domain: Array.isArray((p as any).domain) ? (p as any).domain.join(',') : ((p as any).domain || ''),
      tosVersions: Array.isArray((p as any).tosVersions) ? (p as any).tosVersions.join(',') : ((p as any).tosVersions || ''),
      teamMembers: p.teamMembers || '',
      versionFiveRoles: p.versionFiveRoles || {},
      projectDescription: p.projectDescription || '',
    })
    setBasicInfoEditMode(true)
  }
  const saveBasicInfoEdit = () => {
    if (!selectedProject) return
    const updatedFields = {
      ...editingProjectFields,
      jiraProjects: normalizeJiraProjectRows(Array.isArray(editingProjectFields.jiraProjects) ? editingProjectFields.jiraProjects : []),
    }
    const mergedProject = { ...selectedProject, ...updatedFields } as typeof selectedProject
    const updated = isSoftwareProjectType(mergedProject.type)
      ? {
          ...mergedProject,
          productSeries: getSoftwareProductSeriesValue(mergedProject),
          osSeries: getSoftwareProductSeriesValue(mergedProject),
        } as typeof selectedProject
      : mergedProject
    if (!updateProject(selectedProject.id, updated, currentLoginUser)) {
      message.error('整机项目的路标必填信息不完整或取值不合法，无法保存')
      return
    }
    setBasicInfoEditMode(false)
    message.success('基本信息已保存')
  }

  const saveTargetProjectInfo = async (payload: ProjectInfoSubmitPayload) => {
    if (!selectedProject || !canEditBasicInfo) return
    const previousResponsiblePersons = getProjectResponsiblePersons(selectedProject)
    const responsiblePersonsChanged = haveProjectResponsiblePersonsChanged(
      previousResponsiblePersons,
      payload.responsiblePersons,
    )
    const updatedBase = {
      ...selectedProject,
      type: payload.projectType,
      leader: payload.responsiblePersons[0] || selectedProject.leader,
      responsiblePersons: payload.responsiblePersons,
      healthStatus: payload.healthStatus,
      updatedAt: '刚刚',
    }
    const merged = mergeProjectInfoValues(
      updatedBase as unknown as ProjectInfoProject,
      payload.infoValues,
    )
    const firstSaleTosVersionName = typeof payload.infoValues.firstSaleTosVersion === 'string'
      ? payload.infoValues.firstSaleTosVersion.trim()
      : ''
    const firstSaleTosVersionId = roadmapTosVersions.find(version => (
      version.name.replace(/\s+/g, '').toLowerCase() === firstSaleTosVersionName.replace(/\s+/g, '').toLowerCase()
    ))?.id || selectedProject.firstSaleTosVersionId
    const rawVersionType = typeof payload.infoValues.versionType === 'string'
      ? payload.infoValues.versionType
      : selectedProject.versionType || ''
    const updated = isMachineProjectType(selectedProject.type)
      ? {
          ...merged,
          firstSaleTosVersionId,
          projectCode: typeof payload.infoValues.projectModel === 'string' ? payload.infoValues.projectModel : selectedProject.projectCode,
          startRam: typeof payload.infoValues.startingRam === 'string' ? payload.infoValues.startingRam : selectedProject.startRam,
          versionType: rawVersionType.toUpperCase() === 'GO' ? 'Go' : rawVersionType,
          developMode: typeof payload.infoValues.developmentMode === 'string' ? payload.infoValues.developmentMode : selectedProject.developMode,
        }
      : merged
    if (!updateProject(selectedProject.id, () => updated as unknown as typeof selectedProject, currentLoginUser)) {
      message.error('整机项目的路标必填信息不完整或取值不合法，无法保存')
      return false
    }
    if (responsiblePersonsChanged) {
      setProjectMember(
        selectedProject.id,
        mergeResponsiblePersonsIntoVisibleMembers(
          projectMemberMap[selectedProject.id] || [],
          payload.responsiblePersons,
        ),
      )
      setRoles(previous => replaceProjectSystemAdministrators(previous, payload.responsiblePersons))
    }
    setShowProjectInfoEditor(false)
    message.success('项目信息已保存')
    return true
  }

  // Export functions
  const handleExportVerticalPlan = (scope: 'current' | 'all') => {
    const cols = scope === 'current' ? TABLE_COLUMNS.filter(c => visibleColumns.includes(c.key)) : TABLE_COLUMNS
    const exportCols: ExportColumn[] = cols.map(c => ({ key: c.key, title: c.title }))
    let rows: any[] = []
    if (projectPlanLevel === 'level1') { rows = scope === 'current' ? filteredLevel1PlanTasks : effectiveTasks }
    else if (projectPlanLevel === 'level2' && activeLevel2Plan && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1') {
      const l2 = level2PlanTasks.filter((t: any) => t.planId === activeLevel2Plan); rows = scope === 'current' && searchText ? l2.filter((t: any) => (t.taskName || '').toLowerCase().includes(searchText.toLowerCase())) : l2
    }
    const filename = `项目空间计划_${selectedProject?.name || '项目'}_${projectPlanLevel === 'level1' ? '一级计划' : '二级计划'}_竖版_${exportTimestamp()}.xlsx`
    exportSheet(rows, exportCols, filename, `${projectPlanLevel === 'level1' ? '一级' : '二级'}计划竖版`)
  }

  const handleExportHorizontalPlan = (_scope: 'current' | 'all') => {
    const stages = (effectiveTasks as any[]).filter(t => !t.parentId).sort((a, b) => a.order - b.order)
    const stageGroups = stages.map(stage => { const ms = (effectiveTasks as any[]).filter(t => t.parentId === stage.id).sort((a, b) => a.order - b.order); return { stage, milestones: ms, colSpan: ms.length || 1 } })
    const allMilestones = stageGroups.flatMap(({ stage, milestones }) => milestones.length > 0 ? milestones : [stage])
    if (allMilestones.length === 0) { message.warning('暂无可导出数据'); return }
    const headerRow0: (string | null)[] = ['版本', '开发周期']; const headerRow1: (string | null)[] = [null, null]
    const merges: any[] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }]
    let colCursor = 2
    for (const { stage, milestones, colSpan } of stageGroups) { headerRow0.push(stage.taskName); for (let i = 1; i < colSpan; i++) headerRow0.push(null); if (milestones.length > 0) { for (const m of milestones) headerRow1.push(m.taskName) } else headerRow1.push('-'); merges.push({ s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + colSpan - 1 } }); colCursor += colSpan }
    const displayVersions = getDisplayPlanVersionsForHorizontalPlan(versions)
    const recencyVersions = [...displayVersions].sort((a, b) => comparePlanVersions(b, a))
    const versionOffsetIndex = new Map(recencyVersions.map((version, index) => [version.versionNo, index]))
    const getVersionTasks = (versionNo: string) => { const offsetIndex = versionOffsetIndex.get(versionNo) || 0; if (offsetIndex === 0) return effectiveTasks as any[]; const offsetDays = offsetIndex * 3; return (effectiveTasks as any[]).map(t => ({ ...t, planStartDate: t.planStartDate ? shiftDateStrForExport(t.planStartDate, -offsetDays) : '', planEndDate: t.planEndDate ? shiftDateStrForExport(t.planEndDate, -offsetDays) : '' })) }
    const calcCycleDays = (list: any[], sk: string, ek: string) => { const starts = list.map(t => t[sk]).filter(Boolean).map((d: string) => new Date(d).getTime()); const ends = list.map(t => t[ek]).filter(Boolean).map((d: string) => new Date(d).getTime()); if (starts.length === 0 || ends.length === 0) return '-'; const days = Math.ceil((Math.max(...ends) - Math.min(...starts)) / (1000 * 60 * 60 * 24)); return days > 0 ? days : '-' }
    const dataMatrix: (string | number)[][] = []
    for (const v of displayVersions) { const vt = getVersionTasks(v.versionNo); const row: (string | number)[] = [v.versionNo, calcCycleDays(vt, 'planStartDate', 'planEndDate')]; for (const m of allMilestones) { const match = vt.find((t: any) => t.id === m.id); row.push(match?.planEndDate || '-') }; dataMatrix.push(row) }
    const actualRow: (string | number)[] = ['实际', calcCycleDays(effectiveTasks as any[], 'actualStartDate', 'actualEndDate')]; for (const m of allMilestones) { const t = (effectiveTasks as any[]).find((x: any) => x.id === m.id); actualRow.push(t?.actualEndDate || '-') }; dataMatrix.push(actualRow)
    const colWidths = [10, 10, ...allMilestones.map(() => 14)]
    exportMergedSheet([headerRow0, headerRow1], merges, dataMatrix, colWidths, `项目空间计划_${selectedProject?.name || '项目'}_一级计划_横版_${exportTimestamp()}.xlsx`, '一级计划横版')
  }

  // ═══════ Build transferProps ═══════
  // Derive the transfer-module current user from the logged-in user so it
  // tracks the user switcher instead of being pinned to MOCK_TM_USERS[0].
  const transferCurrentUser = useMemo(() => ({
    id: `login-${currentLoginUser}`,
    name: currentLoginUser,
    role: 'SPM' as const,
    department: '-',
  }), [currentLoginUser])
  const transferProps = {
    selectedProject, currentUser: transferCurrentUser,
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
        <DHTMLXGantt tasks={ganttTasks} columns={ganttColumns} onTaskClick={(task) => message.info(`点击任务: ${task.text}`)} readOnly={!isEditMode || followedTosLevel1ReadOnly || isFollowReadOnlyOverview} collapsedIds={collapsedSet}
          scaleMode={!customTasks && projectPlanLevel === 'level1' ? projectPlanGanttScaleMode : 'month'}
          onCollapsedChange={(updater) => { if (!key) return; setCollapsedNodes(prev => { const c = prev[key] || new Set<string>(); return { ...prev, [key]: updater(c) } }) }}
        />
      </div>
    )
  }

  // ═══════ renderTaskTable ═══════
  const renderTaskTable = (customTasks?: any[]) => {
    const isLevel2Custom = !!customTasks
    const tableTasks = customTasks || effectiveTasks
    const isFollowReadOnlyTable = followedTosLevel1ReadOnly && (!isLevel2Custom || isFollowReadOnlyOverview)
    const writeTableTasks = isLevel2Custom ? (newTasks: any[]) => {
      const planId = customTasks?.[0]?.planId
      if (planId) {
        setLevel2PlanTasks(prev => [...prev.filter(t => t.planId !== planId), ...newTasks])
      }
    } : setEffectiveTasks
    const currentSetTasks = (newTasks: any[]) => {
      if (isFollowReadOnlyTable) {
        void message.warning(tosLevel1FollowSourceText)
        return
      }
      writeTableTasks(newTasks)
    }
    const displayTasks = isLevel2Custom
      ? filterBySearchText(tableTasks)
      : projectPlanLevel === 'level1'
        ? applyFilterConditions(tableTasks, level1PlanFilters)
        : filterBySearchText(tableTasks)
    const flatTasks = displayTasks.map((task: any) => ({ ...task, indentLevel: getTaskDepth(task, tableTasks) }))
    const scopeKey = getScopeKey()
    const collapsedSet = scopeKey ? (collapsedNodes[scopeKey] || new Set<string>()) : new Set<string>()
    const expandEnabled = scopeKey !== null
    const visibleTasks = expandEnabled ? filterByCollapsed(flatTasks, collapsedSet) : flatTasks
    // 修订版本下扫描父子时间约束，违规字段在对应单元格上加 pms-cell-invalid 类
    const invalidFields = isCurrentDraft ? getInvalidTaskFields(tableTasks as any[]) : new Map<string, InvalidFields>()
    // 编辑权限分级：
    //   canFullyEdit  — 编辑模式下且用户有相应级别的计划编辑权 → 拖拽/新增/删除/改任意单元格
    //   isRowEditable — 编辑模式下用户有编辑权 OR 是该行责任人 → 只能改自己负责的行的单元格
    const editPerm = isLevel2Custom ? canEditLevel2Plan : canEditLevel1Plan
    const canFullyEdit = isEditMode && editPerm && !isFollowReadOnlyTable
    const isRowEditable = (record: any) => isEditMode && !isFollowReadOnlyTable && (editPerm || isResponsibleNameMatched(record.responsible, currentLoginUser))
    const getColumns = (): ColumnsType<any> => {
      const cols: ColumnsType<any> = []
      if (visibleColumns.includes('id')) cols.push({ title: '序号', dataIndex: 'id', key: 'id', width: 130, fixed: 'left', render: (id: string, record: any) => {
        const depth = record.indentLevel || 0
        const isLevel2Mode = projectPlanLevel === 'level2'
        const maxDepth = isLevel2Mode ? 3 : 2
        const canAddChild = canFullyEdit && depth < maxDepth - 1
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 20 }}>
            {canFullyEdit && <DragHandle />}
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
        if (isRowEditable(record)) return <Input className="pms-edit-input" value={name} size="small" style={{ fontWeight: depth === 0 ? 600 : 400 }} onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, taskName: e.target.value } : t); currentSetTasks(updated) }} />
        return (
          <div style={{ paddingLeft: depth * 16, display: 'flex', alignItems: 'center', gap: 4 }}>
            {depth > 0 && <span style={{ color: '#e5e7eb', fontSize: 11, flexShrink: 0 }}>{depth === 1 ? '├' : '└'}</span>}
            <span style={{ color: depth === 0 ? '#111827' : depth === 1 ? '#4b5563' : '#9ca3af', fontWeight: depth === 0 ? 600 : 400 }}>{name}</span>
          </div>
        )
      } })
      // 责任人/前置任务是结构性字段，仅 canFullyEdit 可改（避免责任人改完自己丢权限的循环）
      if (visibleColumns.includes('responsible')) cols.push({ title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 100, render: (val: string, record: any) => canFullyEdit ? <Input className="pms-edit-input" value={val} size="small" onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, responsible: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <Space size={4}><Avatar size={18} style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', fontSize: 10 }}>{val[0]}</Avatar><span style={{ fontSize: 13 }}>{val}</span></Space> : <span style={{ color: '#e5e7eb' }}>-</span>) })
      if (visibleColumns.includes('predecessor')) cols.push({ title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 100, render: (val: string, record: any) => canFullyEdit ? <Input className="pms-edit-input" value={val} size="small" placeholder="如: 1.1" onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, predecessor: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <Tag style={{ borderRadius: 4, fontSize: 12 }}>{val}</Tag> : <span style={{ color: '#e5e7eb' }}>-</span>) })
      if (visibleColumns.includes('planStartDate')) cols.push({ title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 170, onCell: (record: any) => ({ className: (invalidFields.get(record.id)?.start.length ?? 0) > 0 ? 'pms-cell-invalid' : '' }), render: (val: string, record: any) => {
        const reasons = invalidFields.get(record.id)?.start || []
        const isInvalid = reasons.length > 0
        const tip = isInvalid ? <div style={{ fontSize: 12, lineHeight: 1.6 }}>{reasons.map((r, i) => <div key={i}>· {r}</div>)}</div> : null
        const node = isRowEditable(record)
          ? <DatePicker size="small" status={isInvalid ? 'error' : undefined} value={val ? dayjs(val) : null} style={{ width: 150 }} onChange={(date) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, planStartDate: date ? date.format('YYYY-MM-DD') : '' } : t); currentSetTasks(updated) }} />
          : <span style={{ fontSize: 12, color: isInvalid ? '#ef4444' : '#4b5563', fontWeight: isInvalid ? 600 : 400 }}>{val || '-'}</span>
        return isInvalid ? <Tooltip title={tip} color="#ef4444"><span style={{ display: 'inline-block' }}>{node}</span></Tooltip> : node
      } })
      if (visibleColumns.includes('planEndDate')) cols.push({ title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 170, onCell: (record: any) => ({ className: (invalidFields.get(record.id)?.end.length ?? 0) > 0 ? 'pms-cell-invalid' : '' }), render: (val: string, record: any) => {
        const reasons = invalidFields.get(record.id)?.end || []
        const isInvalid = reasons.length > 0
        const tip = isInvalid ? <div style={{ fontSize: 12, lineHeight: 1.6 }}>{reasons.map((r, i) => <div key={i}>· {r}</div>)}</div> : null
        const node = isRowEditable(record)
          ? <DatePicker size="small" status={isInvalid ? 'error' : undefined} value={val ? dayjs(val) : null} style={{ width: 150 }} onChange={(date) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, planEndDate: date ? date.format('YYYY-MM-DD') : '' } : t); currentSetTasks(updated) }} />
          : <span style={{ fontSize: 12, color: isInvalid ? '#ef4444' : '#4b5563', fontWeight: isInvalid ? 600 : 400 }}>{val || '-'}</span>
        return isInvalid ? <Tooltip title={tip} color="#ef4444"><span style={{ display: 'inline-block' }}>{node}</span></Tooltip> : node
      } })
      if (visibleColumns.includes('estimatedDays')) cols.push({ title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 90, render: (val: number, record: any) => isRowEditable(record) ? <Input className="pms-edit-input" value={val} size="small" type="number" style={{ width: 70 }} onChange={(e) => { const updated = tableTasks.map((t: any) => t.id === record.id ? { ...t, estimatedDays: parseInt(e.target.value) || 0 } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#4b5563' }}>{val}天</span> })
      if (visibleColumns.includes('actualStartDate')) cols.push({ title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 130, render: (val: string, record: any) => {
        if (isLatestPublished && !isEditMode && !isFollowReadOnlyTable) return <ClickToEditDate value={val} onChange={(newVal) => updateActualDateForTask(tableTasks, currentSetTasks, record, 'actualStartDate', newVal, isLevel2Custom)} disabledDate={(current) => record.actualEndDate ? current.isAfter(dayjs(record.actualEndDate), 'day') : false} />
        return <span style={{ fontSize: 12, color: '#4b5563' }}>{val || '-'}</span>
      } })
      if (visibleColumns.includes('actualEndDate')) cols.push({ title: '实际完成', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 130, render: (val: string, record: any) => {
        if (isLatestPublished && !isEditMode && !isFollowReadOnlyTable) return <ClickToEditDate value={val} onChange={(newVal) => updateActualDateForTask(tableTasks, currentSetTasks, record, 'actualEndDate', newVal, isLevel2Custom)} disabledDate={(current) => record.actualStartDate ? current.isBefore(dayjs(record.actualStartDate), 'day') : false} />
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
      if (canFullyEdit) cols.push({ title: '操作', key: 'action', width: 60, fixed: 'right', render: (_: any, record: any) => (<Popconfirm title="确认删除" description={`删除 "${record.taskName}" 及其子任务？`} onConfirm={() => { const filtered = tableTasks.filter((t: any) => t.id !== record.id && t.parentId !== record.id && !(t.parentId && tableTasks.find((p: any) => p.id === t.parentId)?.parentId === record.id)); currentSetTasks(filtered); message.success(`已删除任务: ${record.id}`) }} okText="确认" cancelText="取消"><Button type="text" icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 4 }} /></Popconfirm>) })
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
      if (isFollowReadOnlyTable) {
        void message.warning(tosLevel1FollowSourceText)
        return
      }
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

    // 仅在 canFullyEdit 时启用 SortableRow（拖拽）；否则用普通 <tr>
    const TableComponents = canFullyEdit ? { body: { row: SortableRow } } : undefined
    const tableClassName = `pms-table ${isEditMode ? 'pms-table-edit' : ''}`
    return (
      <div>
        {isEditMode && (
          <div style={{ padding: '8px 16px', background: 'linear-gradient(90deg, #fffbe6, #fff7cc)', borderBottom: '1px solid #ffe58f', display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#faad14', fontSize: 14 }} />
            <span style={{ fontSize: 13, color: '#ad6800', fontWeight: 500 }}>编辑模式</span>
            <span style={{ fontSize: 12, color: '#ad8b00' }}>
              {canFullyEdit
                ? '- 拖拽手柄排序，点击单元格编辑，完成后点击保存'
                : '- 你只能编辑负责人为自己的行，其他任务为只读'}
            </span>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTableDragEnd}><SortableContext items={visibleTasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}><Table className={tableClassName} dataSource={visibleTasks} columns={getColumns()} rowKey="id" pagination={false} scroll={{ x: visibleColumns.length * 100 + 200 }} components={TableComponents} size="middle" /></SortableContext></DndContext>
        {canFullyEdit && (
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
    // 基础信息里的横版计划始终展示一级计划版本，不能受用户上次停留的计划层级影响。
    const horizontalVersions = selectedProject && isTosVersionProject && selectedTosTypeTab
      ? getTosTypeVersions(
          tosTypeVersionsByKey,
          selectedProject.id,
          effectiveTosLevel1Type,
          'level1',
          VERSION_DATA,
        )
      : selectedProject && isWholeMachineProject && selectedMarketIsConfigured
        ? getMarketVersions(marketVersionsByKey, selectedProject.id, selectedMarketTab, baseVersions)
        : versions
    const horizontalCurrentVersion = selectedProject && isTosVersionProject && selectedTosTypeTab
      ? getTosTypeCurrentVersion(
          tosTypeCurrentVersionByKey,
          selectedProject.id,
          effectiveTosLevel1Type,
          'level1',
          horizontalVersions,
          INITIAL_TOS_CURRENT_VERSION,
        )
      : selectedProject && isWholeMachineProject && selectedMarketIsConfigured
        ? getMarketCurrentVersion(
            marketCurrentVersionByKey,
            selectedProject.id,
            selectedMarketTab,
            horizontalVersions,
            baseCurrentVersion,
          )
        : currentVersion
    const stages = effectiveTasks.filter((t: any) => !t.parentId).sort((a: any, b: any) => a.order - b.order)
    const stageGroups = stages.map((stage: any) => {
      const milestones = effectiveTasks.filter((t: any) => t.parentId === stage.id).sort((a: any, b: any) => a.order - b.order)
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
    const displayVersions = getDisplayPlanVersionsForHorizontalPlan(horizontalVersions)
    const recencyVersions = [...displayVersions].sort((a, b) => comparePlanVersions(b, a))
    const latestDisplayVersionId = recencyVersions[0]?.id
    const versionOffsetIndex = new Map(recencyVersions.map((version, index) => [version.id, index]))
    const getVersionTasks = (versionId: string) => {
      const scopedSnapshot = selectedProject && isTosVersionProject && selectedTosTypeTab
        ? publishedSnapshots[getTosTypeSnapshotKey(selectedProject.id, effectiveTosLevel1Type, 'level1', versionId)]
        : selectedProject && isWholeMachineProject && selectedMarketIsConfigured
          ? publishedSnapshots[getProjectMarketSnapshotKey(selectedProject.id, selectedMarketTab, versionId)]
          : publishedSnapshots[versionId]
      if (scopedSnapshot !== undefined) return scopedSnapshot
      if (versionId === horizontalCurrentVersion) return effectiveTasks
      const offsetIndex = versionOffsetIndex.get(versionId) || 0
      if (offsetIndex === 0) return effectiveTasks
      const offsetDays = offsetIndex * 3
      return (effectiveTasks as any[]).map((t: any) => ({
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
            {displayVersions.map((version) => {
              const vTasks = getVersionTasks(version.id)
              const vMilestones = stageGroups.flatMap(({ stage, milestones: ms }) => {
                if (ms.length > 0) return ms.map((m: any) => { const vt = (vTasks as any[]).find((t: any) => t.id === m.id); return vt || m })
                const vt = (vTasks as any[]).find((t: any) => t.id === stage.id); return [vt || stage]
              })
              const devCycle = calcDevCycle(vTasks as any[])
              const isLatest = version.id === latestDisplayVersionId
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
                const starts = (effectiveTasks as any[]).map((t: any) => t.actualStartDate).filter(Boolean).map((d: string) => new Date(d).getTime())
                const ends = (effectiveTasks as any[]).map((t: any) => t.actualEndDate).filter(Boolean).map((d: string) => new Date(d).getTime())
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
      effectiveTasks.forEach(task => {
        if (task.predecessor && task.planStartDate) {
          const predTask = effectiveTasks.find(t => t.id === task.predecessor)
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
        const milestoneCheck = checkMilestoneTimeConstraint(level2PlanTasks, level2PlanMilestones, effectiveTasks)
        if (!milestoneCheck.valid) {
          setMilestoneTimeWarning({ visible: true, violations: milestoneCheck.violations, message: `发现${milestoneCheck.violations.length}个二级计划任务时间超出绑定里程碑的时间范围，请修改后再保存` })
          return
        }
      }
      setIsEditMode(false)
      message.success('保存成功')
    }
    if (isCurrentDraft) return (
      <Space>
        <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{currentVersionData?.versionNo}({currentVersionData?.status})</Tag>
        <Tag color="green" style={{ fontSize: 12 }}>自动保存</Tag>
        {renderPlanCloneButton()}
        <Tooltip title={canMaintainCurrentPlan ? '发布' : currentPlanMaintenanceDisabledReason}><Button type="primary" icon={<SaveOutlined />} onClick={handlePublish} disabled={!canMaintainCurrentPlan} aria-label="发布" /></Tooltip>
        <Tooltip title={canMaintainCurrentPlan ? '取消修订' : currentPlanMaintenanceDisabledReason}><Button danger icon={<StopOutlined />} onClick={handleCancelRevision} disabled={!canMaintainCurrentPlan} aria-label="取消修订" /></Tooltip>
      </Space>
    )
    return (
      <Space>
        {!hasDraftVersion && renderCreateRevisionButton()}
        <Tooltip title="历史版本对比"><Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)} aria-label="历史版本对比" /></Tooltip>
      </Space>
    )
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
      { title: '序号', dataIndex: 'taskId', key: 'taskId', width: 70, render: (val: string, row: CompareTableRow) => (<span style={{ fontWeight: 600, fontSize: 12, color: row.changeType === '新增' ? '#52c41a' : row.changeType === '删除' ? '#ff4d4f' : row.changeType === '修改' ? '#6366f1' : '#9ca3af' }}>{val}</span>) },
      { title: '变更类型', dataIndex: 'changeType', key: 'changeType', width: 80, render: (val: string) => { const conf: Record<string, { color: string; bg: string }> = { '新增': { color: '#52c41a', bg: '#f6ffed' }, '删除': { color: '#ff4d4f', bg: '#fff2f0' }, '修改': { color: '#6366f1', bg: 'rgba(99,102,241,0.06)' }, '未变更': { color: '#9ca3af', bg: '#fafafa' } }; const c = conf[val]; return c ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: c.color, background: c.bg, border: `1px solid ${c.color}20` }}>{val}</span> : null } },
      { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 160, ellipsis: true, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'taskName', val) },
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
    const isWholeMachine = isMachineProjectType(p.type)
    const isTargetProject = isWholeMachine || p.type === PROJECT_TYPE_TOS_VERSION
    const isSoftware = isSoftwareProjectType(p.type)
    const isTech = p.type === '技术项目'
    const isCapability = p.type === '能力建设项目'
    const statusConf = PROJECT_STATUS_CONFIG[p.status] || { color: '#8c8c8c', tagColor: 'default' }
    const healthMap: Record<string, { label: string; color: string }> = { normal: { label: '正常', color: '#52c41a' }, warning: { label: '关注', color: '#faad14' }, risk: { label: '风险', color: '#ff4d4f' } }
    const hConf = healthMap[p.healthStatus || 'normal'] || healthMap.normal
    const marketRows = buildMarketRowsFromMarkets(
      p.markets || [],
      marketConfigsByProjectId[p.id],
      legacyMarketBuildConfig,
    )
    const markets = marketRows.map(row => row.market)
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
    const developModeChoices = [{ label: 'ODC', value: 'ODC' }, { label: 'JDM', value: 'JDM' }, { label: '自研', value: '自研' }, { label: '外研', value: '外研' }]
    const roadmapDevelopModeChoices = ['自研', 'ODC', 'ITD-ODC', 'ODM', '纯外研'].map(value => ({ label: value, value }))
    const startRamChoices = ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'].map(value => ({ label: value, value }))
    const versionTypeChoices = ['Full', 'Slim', 'Go'].map(value => ({ label: value, value }))
    const projectLevelChoices = [{ label: 'S', value: 'S' }, { label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'C', value: 'C' }]
    const systemTypeChoices = [{ label: '32bit', value: '32bit' }, { label: '64bit', value: '64bit' }, { label: '64only', value: '64only' }]
    const yesNoChoices = [{ label: '是', value: '是' }, { label: '否', value: '否' }]
    const userChoices = ALL_USERS.map(u => ({ label: u, value: u }))
    const renderMultiTags = (value: any, color = 'blue') => {
      const values = Array.isArray(value) ? value : String(value || '').split(',')
      const cleaned = values.map(v => String(v).trim()).filter(Boolean)
      if (cleaned.length === 0) return <span>-</span>
      return <Space size={4} wrap>{cleaned.map(v => <Tag key={v} color={color} style={{ margin: 0 }}>{v}</Tag>)}</Space>
    }
    const renderSingleTag = (value: any, color = 'geekblue') => value ? <Tag color={color} style={{ margin: 0 }}>{String(value)}</Tag> : <span>-</span>
    const affectProjectChoices = Array.from(new Map([
      ...JIRA_AFFECT_PROJECT_OPTIONS,
      ...projects.map((project: any) => {
        const value = project.model || project.name
        return { label: project.name === value ? value : `${value} ${project.name}`, value }
      }),
    ].map(option => [option.value, option])).values())
    const getProjectFieldValue = (field: { key: string; fallbackKeys?: readonly string[] }) => {
      const source = p as Record<string, any>
      const keys = [field.key, ...(field.fallbackKeys || [])]
      for (const key of keys) {
        const value = source[key]
        if (Array.isArray(value) && value.length > 0) return value.join(', ')
        if (value !== undefined && value !== null && value !== '') return value
      }
      return '-'
    }
    const renderJiraProjects = (projects: JiraProjectConfig[]) => {
      if (!projects.length) return <span style={{ color: '#9ca3af' }}>-</span>
      return (
        <Space size={6} wrap>
          {projects.map(project => (
            <Tooltip key={project.id} title={getJiraProjectUrl(project)}>
              <Tag color="blue" style={{ margin: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                <a
                  href={getJiraProjectUrl(project)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {formatJiraProjectTag(project)}
                </a>
              </Tag>
            </Tooltip>
          ))}
        </Space>
      )
    }
    const renderJiraProjectInlineEditor = (jiraProjects: JiraProjectConfig[]) => (
      <div style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid #eef2ff', background: '#f8fafc' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>JIRA库配置</span>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={addJiraProjectRow}>新增一行</Button>
        </div>
        <div style={{ overflowX: 'auto', padding: 12 }}>
          <div style={{ minWidth: 860 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.15fr 0.9fr 64px 1.15fr 82px', gap: 10, alignItems: 'center', marginBottom: 8, color: '#111827', fontSize: 13, fontWeight: 600 }}>
              <div style={{ textAlign: 'center' }}>JIRA服务器</div>
              <div style={{ textAlign: 'center' }}>JIRA库名</div>
              <div style={{ textAlign: 'center' }}>类型</div>
              <div style={{ textAlign: 'center' }}>共库</div>
              <div style={{ textAlign: 'center' }}>
                <Space size={4}>
                  <QuestionCircleOutlined style={{ fontSize: 12 }} />
                  <span>Affect Projects</span>
                </Space>
              </div>
              <div style={{ textAlign: 'center' }}>操作</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jiraProjects.map(row => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.15fr 0.9fr 64px 1.15fr 82px', gap: 10, alignItems: 'center' }}>
                  <Select
                    size="small"
                    value={row.server}
                    options={JIRA_SERVER_OPTIONS}
                    onChange={(server) => updateJiraProjectRow(row.id, { server })}
                  />
                  <Select
                    size="small"
                    showSearch
                    placeholder="请输入后选择"
                    value={row.projectKey || undefined}
                    options={JIRA_PROJECT_NAME_OPTIONS.map(value => ({ label: value, value }))}
                    filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
                    onChange={(projectKey) => updateJiraProjectRow(row.id, { projectKey })}
                  />
                  <Select
                    size="small"
                    value={row.type}
                    options={JIRA_PROJECT_TYPE_OPTIONS}
                    onChange={(type) => updateJiraProjectRow(row.id, { type })}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <Switch size="small" checked={row.shared} onChange={(shared) => updateJiraProjectRow(row.id, { shared })} />
                  </div>
                  <Select
                    size="small"
                    allowClear
                    showSearch
                    placeholder="请选择项目"
                    value={row.affectProjects || undefined}
                    options={affectProjectChoices}
                    filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
                    onChange={(affectProjects) => updateJiraProjectRow(row.id, { affectProjects: affectProjects || '' })}
                  />
                  <Space size={4} style={{ justifyContent: 'center', width: '100%' }}>
                    <Tooltip title="复制">
                      <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyJiraProjectRow(row.id)} />
                    </Tooltip>
                    <Tooltip title="删除">
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeJiraProjectRow(row.id)} />
                    </Tooltip>
                  </Space>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
    const renderWholeMachineBasicInfoField = (field: (typeof WHOLE_MACHINE_BASIC_INFO_FIELDS)[number]) => {
      const visibleDevelopMode = basicInfoEditMode ? ef.developMode : p.developMode
      if (field.key === 'isOutsourcedMini' && visibleDevelopMode !== '外研') return null
      const firstSaleTosVersionName = roadmapTosVersions.find(version => version.id === p.firstSaleTosVersionId)?.name || p.firstSaleTosVersionId || '-'
      let content: React.ReactNode = field.key === 'firstSaleTosVersionId'
        ? firstSaleTosVersionName
        : getProjectFieldValue(field)
      if (field.key === 'projectCode') content = editableField('projectCode', p.projectCode || p.model)
      if (field.key === 'androidVersion') content = editableField('androidVersion', p.androidVersion || p.operatingSystem)
      if (field.key === 'firstSaleTosVersionId') content = editableField('firstSaleTosVersionId', firstSaleTosVersionName, { type: 'select', choices: roadmapTosOptions })
      if (field.key === 'brand') content = editableField('brand', p.brand)
      if (field.key === 'productLine') content = editableField('productLine', p.productLine)
      if (field.key === 'marketName') content = editableField('marketName', p.marketName)
      if (field.key === 'productType') content = editableField('productType', p.productType, { type: 'select', choices: [{ label: '新品', value: '新品' }, { label: '老品', value: '老品' }] })
      if (field.key === 'productSeries') content = editableField('productSeries', (p as any).productSeries)
      if (field.key === 'startRam') content = editableField('startRam', p.startRam, { type: 'select', choices: startRamChoices })
      if (field.key === 'str5Date') content = editableField('str5Date', p.str5Date)
      if (field.key === 'launchDate') content = editableField('launchDate', p.launchDate)
      if (field.key === 'developMode') content = editableField('developMode', p.developMode, { type: 'select', choices: roadmapDevelopModeChoices })
      if (field.key === 'cooperationForm') content = editableField('cooperationForm', p.cooperationForm)
      if (field.key === 'projectLevel') content = editableField('projectLevel', p.projectLevel, { type: 'select', choices: projectLevelChoices })
      if (field.key === 'systemType') content = editableField('systemType', (p as any).systemType, { type: 'select', choices: systemTypeChoices })
      if (field.key === 'isGo') content = editableField('isGo', (p as any).isGo, { type: 'select', choices: yesNoChoices })
      if (field.key === 'isTwoStage') content = editableField('isTwoStage', (p as any).isTwoStage, { type: 'select', choices: yesNoChoices })
      if (field.key === 'isSlimVersion') content = editableField('isSlimVersion', (p as any).isSlimVersion, { type: 'select', choices: yesNoChoices })
      if (field.key === 'isOutsourcedMini') content = editableField('isOutsourcedMini', (p as any).isOutsourcedMini, { type: 'select', choices: yesNoChoices })
      if (field.key === 'remark') {
        content = editableField('remark', p.remark, { type: 'textarea' })
        return <Descriptions.Item key={field.key} label={field.label} span={4}>{content}</Descriptions.Item>
      }
      if (field.key === 'projectDescription') {
        content = basicInfoEditMode
          ? <Input.TextArea size="small" value={ef.projectDescription} onChange={e => setEf('projectDescription', e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} />
          : <div style={{ minHeight: 22, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{(p as any).projectDescription || '-'}</div>
        return <Descriptions.Item key={field.key} label={field.label} span={4}>{content}</Descriptions.Item>
      }
      if (field.key === 'jiraProjects') {
        const jiraProjects = (basicInfoEditMode ? getCurrentJiraProjects() : ((p as any).jiraProjects || [])) as JiraProjectConfig[]
        content = basicInfoEditMode ? renderJiraProjectInlineEditor(jiraProjects) : renderJiraProjects(jiraProjects)
        return <Descriptions.Item key={field.key} label={field.label} span={4}>{content}</Descriptions.Item>
      }
      return <Descriptions.Item key={field.key} label={field.label}>{content}</Descriptions.Item>
    }
    const descLabelStyle: CSSProperties = { fontWeight: 500, color: '#9ca3af', fontSize: 13, background: '#f8fafc' }
    const descContentStyle: CSSProperties = { color: '#111827', fontSize: 13 }
    const sectionTitle = (icon: React.ReactNode, title: string, _color: string) => (<Space size={8}>{icon}<span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span></Space>)
    const headerExtra = p.name
    const wideWholeMachineBasicInfoFields = WHOLE_MACHINE_BASIC_INFO_FIELDS.filter(field => ['remark', 'projectDescription', 'jiraProjects'].includes(field.key))
    const compactWholeMachineBasicInfoFields = WHOLE_MACHINE_BASIC_INFO_FIELDS.filter(field => !['remark', 'projectDescription', 'jiraProjects'].includes(field.key))
    const renderWholeMachinePlanInfo = () => {
      if (markets.length === 0) {
        return (
          <Card id="section-plan" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<CalendarOutlined style={{ color: '#6366f1' }} />, '计划信息', '#6366f1')}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="尚未配置市场"
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={openMarketEditor}>市场编辑</Button>
            </Empty>
          </Card>
        )
      }
      return (
        <Card id="section-plan" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<CalendarOutlined style={{ color: '#6366f1' }} />, '计划信息', '#6366f1')}>
          <Tabs activeKey={selectedMarketTab} onChange={setSelectedMarketTab} type="card"
            tabBarExtraContent={{
              right: (
                <Tooltip title="编辑市场">
                  <Button size="small" icon={<EditOutlined />} style={{ borderRadius: 6, marginLeft: 8 }} onClick={openMarketEditor}>市场编辑</Button>
                </Tooltip>
              ),
            }}
            items={marketRows.map(row => {
              const m = row.market
              const marketColor = marketColors[m] || '#faad14'
              return {
                key: m,
                label: <Space size={6}><Badge color={marketColor} /><span style={{ fontWeight: 500 }}>{m}</span>{row.isMain && <Tag color="blue" style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>主</Tag>}{row.followsMain && <Tag color="green" style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>跟随</Tag>}</Space>,
                children: (
                  <div style={{ padding: '8px 0' }}>
                    <div className="pms-project-plan-info-heading">
                      <span>计划信息</span>
                      <FieldVisibilityPicker
                        groupLabel="计划信息"
                        fields={PROJECT_PLAN_INFO_FIELDS}
                        visibleFieldKeys={visiblePlanInfoFieldKeys}
                        onChange={setVisiblePlanInfoFieldKeys}
                        disabled={!canViewBasicInfo}
                      />
                    </div>
                    <ProjectPlanInfoGrid
                      visibleFieldKeys={visiblePlanInfoFieldKeys}
                      buildOption={row.buildOption}
                      buildMarket={row.buildMarket}
                      googleLaunchDate={row.googleLaunchDate}
                      isMadaControlled={row.isMadaControlled}
                      isSimLocked={row.isSimLocked}
                      isCancelPaused={row.isCancelPaused}
                      cancelPauseDate={row.isCancelPaused === '是' ? row.cancelPauseDate : undefined}
                    />
                    {renderHorizontalTable()}
                  </div>
                ),
              }
            })}
          />
        </Card>
      )
    }
    const anchorSections = [
      { id: 'section-header', label: isTargetProject ? '项目名称' : '项目概览', icon: <ProjectOutlined /> },
      { id: 'section-plan', label: '计划信息', icon: <CalendarOutlined /> },
      { id: 'section-basic', label: isTargetProject ? '项目信息' : '基本信息', icon: <SettingOutlined /> },
      ...(isWholeMachine && currentProjectTransferApps.length > 0 ? [{ id: 'section-transfer', label: '转维信息', icon: <DeploymentUnitOutlined /> }] : []),
      ...(!isTargetProject && (isSoftware || isTech) ? [{ id: 'section-config', label: '配置信息', icon: <SettingOutlined /> }] : []),
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
        {isTargetProject ? (
          <TargetProjectInformationView
            project={p as unknown as ProjectInfoProject}
            currentUser={currentLoginUser}
            canEdit={canEditBasicInfo}
            canConfigure={canViewBasicInfo}
            onEdit={() => setShowProjectInfoEditor(true)}
            onApplyTransfer={isWholeMachine ? () => transfer.setTransferView('apply') : undefined}
            afterCore={isWholeMachine ? renderWholeMachinePlanInfo() : renderProjectPlanInfo()}
            visibleGroupKeys={isTosVersionProject ? ['team'] : undefined}
          />
        ) : (
          <>
        {/* Header card */}
        <Card id="section-header" style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden' }} styles={{ header: { background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)', borderBottom: 'none', padding: '16px 24px' }, body: { padding: 0 } }}
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(129,140,248,0.3) 0%, rgba(99,102,241,0.4) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}><ProjectOutlined style={{ color: '#fff', fontSize: 18 }} /></div><div><div style={{ color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{headerExtra}</div></div></div>}
          extra={<Space size={8}><Tag color={statusConf.tagColor} style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>{p.status}</Tag><Tag style={{ margin: 0, borderRadius: 4, background: hConf.color, border: 'none', color: '#fff' }}>{hConf.label}</Tag>{isWholeMachine && <Button type="primary" icon={<SendOutlined />} style={{ background: '#4338ca', borderColor: '#4338ca' }} onClick={() => transfer.setTransferView('apply')}>申请转维</Button>}</Space>}
        >
          <div style={{ display: 'flex', background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)', borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
            {[
              { label: '项目分类', value: p.type, editable: false },
              { label: '项目状态', value: p.status, editable: true, key: 'status', editNode: <Select size="small" value={ef.status} onChange={(v: string) => setEf('status', v)} style={{ width: 110 }} options={getProjectStatusOptions(p)} /> },
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
          basicInfoEditMode ? (<Space><Button size="small" onClick={() => setBasicInfoEditMode(false)}>取消</Button><Button size="small" type="primary" onClick={saveBasicInfoEdit}>保存</Button></Space>) : (
            canEditBasicInfo
              ? <Button size="small" icon={<EditOutlined />} onClick={startBasicInfoEdit}>编辑</Button>
              : <Tooltip title="无基本信息编辑权限"><Button size="small" icon={<EditOutlined />} disabled>编辑</Button></Tooltip>
          )
        }>
          {isSoftware && (
            <div>
              <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                <Descriptions.Item label="项目名称">{p.name}</Descriptions.Item>
                <Descriptions.Item label="品牌">{p.brand || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品线">{p.productLine || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品系列">
                  {renderSingleTag(getSoftwareProductSeriesValue(basicInfoEditMode ? { ...p, ...ef } : p), 'cyan')}
                </Descriptions.Item>
                <Descriptions.Item label="tOS版本">
                  {basicInfoEditMode
                    ? <Select size="small" value={ef.tosVersion} onChange={(v: string) => setEf('tosVersion', v)} style={{ width: '100%' }} options={TOS_VERSION_OPTIONS} />
                    : renderSingleTag((p as any).tosVersion || inferTosVersionFromProjectName(p.name), 'blue')}
                </Descriptions.Item>
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
                {compactWholeMachineBasicInfoFields.map(renderWholeMachineBasicInfoField)}
              </Descriptions>
              <Descriptions bordered size="small" column={1} labelStyle={descLabelStyle} contentStyle={descContentStyle} style={{ marginTop: -1 }}>
                {wideWholeMachineBasicInfoFields.map(renderWholeMachineBasicInfoField)}
              </Descriptions>
            </div>
          )}
          {(isTech || isCapability) && (
            <div>
              <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                <Descriptions.Item label="项目名称">{p.name}</Descriptions.Item>
                <Descriptions.Item label="项目分类">{p.type}</Descriptions.Item>
                <Descriptions.Item label="项目状态">
                  {basicInfoEditMode
                    ? <Select size="small" value={ef.status} onChange={(v: string) => setEf('status', v)} style={{ width: '100%' }} options={getProjectStatusOptions(p)} />
                    : <Tag color={statusConf.tagColor}>{p.status}</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="健康状态">{basicInfoEditMode ? <Select size="small" value={ef.healthStatus} onChange={(v: string) => setEf('healthStatus', v)} style={{ width: '100%' }} options={healthChoices} /> : <Tag style={{ background: hConf.color, border: 'none', color: '#fff' }}>{hConf.label}</Tag>}</Descriptions.Item>
                {isTech && (
                  <>
                    <Descriptions.Item label="领域">
                      {basicInfoEditMode
                        ? <Select size="small" mode="multiple" value={(ef.domain || '').split(',').filter(Boolean)} onChange={(v: string[]) => setEf('domain', v.join(','))} style={{ width: '100%' }} options={TECH_DOMAIN_OPTIONS} />
                        : renderMultiTags((p as any).domain, 'purple')}
                    </Descriptions.Item>
                    <Descriptions.Item label="tOS版本">
                      {basicInfoEditMode
                        ? <Select size="small" mode="multiple" value={(ef.tosVersions || '').split(',').filter(Boolean)} onChange={(v: string[]) => setEf('tosVersions', v.join(','))} style={{ width: '100%' }} options={TOS_VERSION_OPTIONS} />
                        : renderMultiTags((p as any).tosVersions, 'cyan')}
                    </Descriptions.Item>
                  </>
                )}
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
          </>
        )}
        {/* Transfer info */}
        {isWholeMachine && currentProjectTransferApps.length > 0 && (
          <Card
            id="section-transfer"
            style={{ marginBottom: 20, borderRadius: 8 }}
            styles={{ body: transferInfoCollapsed ? { display: 'none', padding: 0 } : undefined }}
            title={sectionTitle(<DeploymentUnitOutlined style={{ color: '#6366f1' }} />, '转维信息', '#6366f1')}
            extra={(
              <Button
                type="text"
                size="small"
                aria-expanded={!transferInfoCollapsed}
                aria-controls="section-transfer-content"
                icon={<DownOutlined style={{ transition: 'transform 0.2s', transform: transferInfoCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} />}
                onClick={() => setTransferInfoCollapsed(collapsed => !collapsed)}
              >
                {transferInfoCollapsed ? '展开' : '折叠'}
              </Button>
            )}
          >
            {!transferInfoCollapsed && <div id="section-transfer-content">
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
            </div>}
          </Card>
        )}
        {/* Target-project plan information is rendered directly after the core card. */}
        {!isTargetProject && renderProjectPlanInfo()}
        {!isTargetProject && (isSoftware || isTech) && (
          <Card id="section-config" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<SettingOutlined style={{ color: '#52c41a' }} />, '配置信息', '#52c41a')}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>构建信息</div>
            <Descriptions bordered size="small" column={1} labelStyle={{ ...descLabelStyle, width: 120 }} contentStyle={descContentStyle}>
              <Descriptions.Item label="分支信息">{editableField('branchInfo', p.branchInfo)}</Descriptions.Item>
              <Descriptions.Item label="Jenkins构建">{basicInfoEditMode ? editableField('jenkinsUrl', p.jenkinsUrl) : (p.jenkinsUrl ? <a href={p.jenkinsUrl} target="_blank" rel="noopener noreferrer">{p.jenkinsUrl}</a> : '-')}</Descriptions.Item>
              <Descriptions.Item label="版本地址">{basicInfoEditMode ? editableField('buildAddress', p.buildAddress) : (p.buildAddress ? <a href={p.buildAddress} target="_blank" rel="noopener noreferrer">{p.buildAddress}</a> : '-')}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}
        {isTargetProject && (
          <ProjectInfoModal
            mode="edit"
            open={showProjectInfoEditor}
            candidateProjects={[]}
            project={p as unknown as ProjectInfoProject}
            existingProjects={projects as unknown as ProjectInfoProject[]}
            responsiblePersons={getProjectResponsiblePersons(p)}
            onCancel={() => setShowProjectInfoEditor(false)}
            onSubmit={saveTargetProjectInfo}
            fieldOptionOverrides={{
              firstSaleTosVersion: roadmapTosOptions.map(option => option.label),
              versionType: ['Full', 'Slim', 'Go'],
              developmentMode: ['自研', 'ODC', 'ITD-ODC', 'ODM', '纯外研'],
            }}
          />
        )}
      </div>
    )
  }

  // ═══════ renderProjectPlanInfo ═══════
  const renderProjectPlanInfo = () => {
    const p = selectedProject!
    const summaryTosTypeGroups = getTosTypeSummaryGroups(tosTypeConfigRows)
    const summaryActiveType = getTosTypePlanSourceType(
      tosTypeConfigRows,
      selectedTosTypeTab,
      'level1',
    )
    const tosPlanStartDate = isTosVersionProject
      ? (effectiveTasks.map(task => task.planStartDate).filter(Boolean).sort()[0] || '')
      : ''
    const tosPlanEndDate = isTosVersionProject
      ? (effectiveTasks.map(task => task.planEndDate).filter(Boolean).sort().at(-1) || '')
      : ''
    const getWorkingDaySpan = (startDate: string, endDate: string) => {
      if (!startDate || !endDate) return 0
      let cursor = dayjs(startDate).startOf('day')
      const end = dayjs(endDate).startOf('day')
      if (!cursor.isValid() || !end.isValid() || cursor.isAfter(end)) return 0
      let days = 0
      while (!cursor.isAfter(end)) {
        if (cursor.day() !== 0 && cursor.day() !== 6) days += 1
        cursor = cursor.add(1, 'day')
      }
      return days
    }
    const tosPlanHealth = (() => {
      if (!isTosVersionProject) return p.healthStatus
      const today = dayjs().startOf('day')
      const openTaskEndDates = effectiveTasks
        .filter(task => task.status !== '已完成' && task.planEndDate)
        .map(task => dayjs(task.planEndDate).startOf('day'))
        .filter(date => date.isValid())
      if (openTaskEndDates.some(date => date.isBefore(today))) return 'risk'
      if (openTaskEndDates.some(date => date.diff(today, 'day') <= 7)) return 'warning'
      return 'normal'
    })()
    const displayedPlanStartDate = isTosVersionProject ? tosPlanStartDate : p.planStartDate
    const displayedPlanEndDate = isTosVersionProject ? tosPlanEndDate : p.planEndDate
    const displayedDevelopCycle = isTosVersionProject
      ? getWorkingDaySpan(tosPlanStartDate, tosPlanEndDate)
      : p.developCycle
    const displayedHealthLabel = tosPlanHealth === 'normal' ? '健康' : tosPlanHealth === 'warning' ? '关注' : tosPlanHealth === 'risk' ? '风险' : '-'
    const planInfoContent = (
      <>
        {!isTosVersionProject && (
          <>
            <Row gutter={[24, 16]}>
              <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划开始时间</span>} value={displayedPlanStartDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#6366f1', fontSize: 14 }} />} /></Col>
              <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划结束时间</span>} value={displayedPlanEndDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#faad14', fontSize: 14 }} />} /></Col>
              <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>开发周期（工作日）</span>} value={displayedDevelopCycle || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} suffix={displayedDevelopCycle ? <span style={{ fontSize: 12, color: '#9ca3af' }}>天</span> : undefined} /></Col>
              <Col span={6}><Statistic title={<span style={{ fontSize: 12, color: '#9ca3af' }}>健康状态</span>} value={displayedHealthLabel} valueStyle={{ fontSize: 16, fontWeight: 600, color: tosPlanHealth === 'normal' ? '#52c41a' : tosPlanHealth === 'warning' ? '#faad14' : tosPlanHealth === 'risk' ? '#ff4d4f' : '#9ca3af' }} /></Col>
            </Row>
            <Divider style={{ margin: '16px 0' }} />
          </>
        )}
        {!isTosVersionProject && (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 1 }}>里程碑计划（横排视图）</div>
        )}
        {renderHorizontalTable()}
      </>
    )
    return (
      <Card id="section-plan" style={{ marginBottom: 20, borderRadius: 8 }} title={<Space><CalendarOutlined style={{ color: '#6366f1' }} /><span style={{ fontWeight: 600 }}>计划信息</span></Space>}>
        {isTosVersionProject ? (
          <Tabs
            activeKey={summaryActiveType}
            onChange={(type) => navigateWithEditGuard(() => setSelectedTosTypeTab(type))}
            type="card"
            tabBarExtraContent={{
              right: canEditBasicInfo
                ? <Button size="small" icon={<EditOutlined />} style={{ borderRadius: 6, marginLeft: 8 }} onClick={openTosTypeEditor}>类型编辑</Button>
                : <Tooltip title="无基本信息编辑权限"><Button size="small" icon={<EditOutlined />} style={{ borderRadius: 6, marginLeft: 8 }} disabled>类型编辑</Button></Tooltip>,
            }}
            items={summaryTosTypeGroups.map(group => ({
              key: group.key,
              label: <span style={{ fontWeight: 500 }}>{group.label}</span>,
              children: <div style={{ paddingTop: 8 }}>{planInfoContent}</div>,
            }))}
          />
        ) : planInfoContent}
      </Card>
    )
  }

  // ═══════ renderProjectPlanOverview ═══════
  const renderProjectPlanOverview = () => {
    const displayTasks = mergePlans(effectiveTasks, level2PlanTasks)
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
  const tosTypeColors: Record<string, string> = { Full: '#6366f1', Slim: '#13c2c2', PAD: '#722ed1', GO: '#fa8c16' }

  // ═══════ renderProjectPlan ═══════
  const renderProjectPlan = () => {
    const showMarketControls = isMachineProjectType(selectedProject?.type)
    const showTosTypeTabs = selectedProject?.type === PROJECT_TYPE_TOS_VERSION && tosTypeConfigRows.length > 0
    const planTabItems = [
      { key: 'level1', label: '一级计划' },
      { key: 'level2', label: '二级计划' },
      { key: 'overview', label: '计划总览' },
    ]
    return (
      <div>
        {showTosTypeTabs && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '4px 16px' } }}>
            <Row align="middle" justify="space-between">
              <Col>
                <Space size={4} align="center">
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginRight: 8 }}>类型</span>
                  {tosTypeConfigRows.map(row => (
                    <Tag
                      key={row.type}
                      color={selectedTosTypeTab === row.type ? tosTypeColors[row.type] : 'default'}
                      style={{ cursor: 'pointer', borderRadius: 4, padding: '4px 12px', fontSize: 13, fontWeight: selectedTosTypeTab === row.type ? 600 : 400, borderColor: selectedTosTypeTab === row.type ? tosTypeColors[row.type] : '#d9d9d9' }}
                      onClick={() => navigateWithEditGuard(() => setSelectedTosTypeTab(row.type))}
                    >
                      <Space size={4}>{row.type}{row.isMain && <span style={{ fontSize: 11 }}>主</span>}{row.followsMain && <span style={{ fontSize: 11 }}>跟随</span>}</Space>
                    </Tag>
                  ))}
                </Space>
              </Col>
              <Col>
                {canEditBasicInfo
                  ? <Button size="small" icon={<EditOutlined />} style={{ borderRadius: 6 }} onClick={openTosTypeEditor}>类型编辑</Button>
                  : <Tooltip title="无基本信息编辑权限"><Button size="small" icon={<EditOutlined />} style={{ borderRadius: 6 }} disabled>类型编辑</Button></Tooltip>}
              </Col>
            </Row>
          </Card>
        )}
        {showMarketControls && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '4px 16px' } }}>
            <Row align="middle" justify="space-between">
              <Col>
                <Space size={4} align="center">
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginRight: 8 }}>市场</span>
                  {marketConfigRows.map(row => (
                    <Tag key={row.market} color={selectedMarketTab === row.market ? (marketColors[row.market] || '#1890ff') : 'default'} style={{ cursor: 'pointer', borderRadius: 4, padding: '4px 12px', fontSize: 13, fontWeight: selectedMarketTab === row.market ? 600 : 400, borderColor: selectedMarketTab === row.market ? (marketColors[row.market] || '#1890ff') : '#d9d9d9' }} onClick={() => navigateWithEditGuard(() => setSelectedMarketTab(row.market))}>
                      <Space size={4}>{row.market}{row.isMain && <span style={{ fontSize: 11 }}>主</span>}{row.followsMain && <span style={{ fontSize: 11 }}>跟随</span>}</Space>
                    </Tag>
                  ))}
                </Space>
              </Col>
              <Col>
                <Tooltip title="编辑市场">
                  <Button size="small" icon={<EditOutlined />} style={{ borderRadius: 6 }} onClick={openMarketEditor}>市场编辑</Button>
                </Tooltip>
              </Col>
            </Row>
          </Card>
        )}
        <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '4px 16px' } }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Tabs
                activeKey={projectPlanLevel}
                onChange={(key) => navigateWithEditGuard(() => {
                  if (key === 'level2') setProjectPlanViewMode('table')
                  setProjectPlanLevel(key as string)
                })}
                style={{ marginBottom: 0 }}
                items={planTabItems.map(item => ({ ...item, label: <span style={{ fontWeight: 500, padding: '0 4px' }}>{item.label}</span> }))}
              />
            </Col>
            <Col><Tag color={projectPlanLevel === 'overview' ? 'blue' : 'default'} style={{ fontSize: 11 }}>{planTabItems.find(t => t.key === projectPlanLevel)?.label}</Tag></Col>
          </Row>
        </Card>
        {machineMarketPlanUnavailable ? (
          <Card style={{ borderRadius: 8 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={marketConfigRows.length === 0 ? '尚未配置市场，无法查看一级计划' : '当前市场不属于本项目，请重新选择市场'}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={openMarketEditor}>
                {marketConfigRows.length === 0 ? '添加市场' : '市场编辑'}
              </Button>
            </Empty>
          </Card>
        ) : (
          <>
        {showTosTypeTabs && projectPlanLevel === 'level1' && currentTosTypeIsFollow && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16, borderRadius: 8 }}
            message={`当前类型跟随 ${effectiveTosLevel1Type}`}
            description={`一级计划来自 ${effectiveTosLevel1Type}；如需创建修订、编辑或发布，请切换到 ${effectiveTosLevel1Type}。`}
          />
        )}
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
                {canEditLevel2Plan
                  ? <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} onClick={() => { if (!hasPublishedLevel1Plan) { message.warning('请先发布一级计划后再创建二级计划'); return; } setCreateFormValues({}); setShowCreateLevel2Plan(true) }}>创建二级计划</Button>
                  : <Tooltip title="无二级计划编辑权限"><Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} disabled>创建二级计划</Button></Tooltip>}
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
        {isTosVersionTrainPlan && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '12px 16px' } }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                  <Space size={6}>
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>版本</span>
                    <Select
                      value={currentVersion}
                      onChange={(value) => navigateWithEditGuard(() => {
                        setCurrentVersion(value)
                        setIsEditMode(false)
                      })}
                      style={{ width: 150 }}
                    >
                      {versions
                        .filter(version => version.status !== '修订中' || canViewDraft)
                        .map(version => <Option key={version.id} value={version.id}>{renderVersionLabel(version)}</Option>)}
                    </Select>
                    {isCurrentDraft && <Tag color="green" style={{ fontSize: 12, margin: 0 }}>自动保存</Tag>}
                  </Space>
                  <Space size={6}>
                    {!hasDraftVersion && (canEditLevel2Plan
                      ? renderCreateRevisionButton({ borderRadius: 6 })
                      : <Tooltip title="无二级计划编辑权限"><Button type="primary" icon={<PlusOutlined />} disabled>创建修订</Button></Tooltip>)}
                    {isCurrentDraft && (canEditLevel2Plan
                      ? <Tooltip title="发布"><Button type="primary" icon={<SaveOutlined />} onClick={handlePublish} aria-label="发布" /></Tooltip>
                      : <Tooltip title="无二级计划编辑权限"><Button type="primary" icon={<SaveOutlined />} disabled aria-label="发布" /></Tooltip>)}
                    {isCurrentDraft && (canEditLevel2Plan
                      ? <Tooltip title="取消修订"><Button danger icon={<StopOutlined />} onClick={handleCancelRevision} aria-label="取消修订" /></Tooltip>
                      : <Tooltip title="无二级计划编辑权限"><Button danger icon={<StopOutlined />} disabled aria-label="取消修订" /></Tooltip>)}
                  </Space>
                </Space>
              </Col>
              <Col>
                <Tooltip title="版本对比">
                  <Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)} aria-label="版本对比" />
                </Tooltip>
              </Col>
            </Row>
          </Card>
        )}
        {projectPlanLevel === 'level2' && activeLevel2Plan === 'plan1' && (
          <VersionTrainPlan
            data={versionTrainRecordsForCurrentVersion}
            onDataChange={setVersionTrainRecords}
            canEdit={canEditLevel2Plan && isCurrentDraft}
          />
        )}
        {/* Version management + table/gantt for L1 and non-fixed L2 */}
        {projectPlanLevel !== 'overview' && !(projectPlanLevel === 'level2' && (activeLevel2Plan === 'plan0' || activeLevel2Plan === 'plan1')) && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '12px 16px' } }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                  <Space size={6}>
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>版本</span>
                    <Select value={currentVersion} onChange={(val) => navigateWithEditGuard(() => { setCurrentVersion(val); setIsEditMode(false) })} style={{ width: versionSelectWidth }} size="middle">
                      {versions
                        .filter(v => v.status !== '修订中' || canViewDraft)
                        .map(v => <Option key={v.id} value={v.id}>{renderVersionLabel(v)}</Option>)}
                    </Select>
                    {isCurrentDraft && <Tag color="green" style={{ fontSize: 12, margin: 0 }}>自动保存</Tag>}
                  </Space>
                  <Space size={6}>
                    {(followedTosLevel1ReadOnly || !hasDraftVersion) && (canEditCurrentPlan
                      ? renderCreateRevisionButton({ borderRadius: 6 })
                      : <Tooltip title={`无${currentPlanPermissionLabel}编辑权限`}><Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} disabled aria-label="创建修订">创建修订</Button></Tooltip>)}
                    {renderPlanCloneButton({ borderRadius: 6 })}
                    {isCurrentDraft && (canMaintainCurrentPlan
                      ? <Tooltip title="发布"><Button type="primary" icon={<SaveOutlined />} style={{ borderRadius: 6 }} onClick={handlePublish} aria-label="发布" /></Tooltip>
                      : <Tooltip title={followedTosLevel1ReadOnly ? tosLevel1FollowSourceText : `无${currentPlanPermissionLabel}编辑权限`}><Button type="primary" icon={<SaveOutlined />} style={{ borderRadius: 6 }} disabled aria-label="发布" /></Tooltip>)}
                    {isCurrentDraft && (canMaintainCurrentPlan
                      ? <Tooltip title="取消修订"><Button danger icon={<StopOutlined />} style={{ borderRadius: 6 }} onClick={handleCancelRevision} aria-label="取消修订" /></Tooltip>
                      : <Tooltip title={followedTosLevel1ReadOnly ? tosLevel1FollowSourceText : `无${currentPlanPermissionLabel}编辑权限`}><Button danger icon={<StopOutlined />} style={{ borderRadius: 6 }} disabled aria-label="取消修订" /></Tooltip>)}
                  </Space>
                </Space>
              </Col>
              <Col>
                <Space size={6}>
                  {projectPlanLevel === 'level1' && projectPlanViewMode === 'gantt' && (
                    <Space size={4}>
                      <span style={{ color: '#9ca3af', fontSize: 13 }}>刻度</span>
                      <Radio.Group
                        value={projectPlanGanttScaleMode}
                        onChange={(e) => setProjectPlanGanttScaleMode(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                        size="small"
                        options={GANTT_SCALE_OPTIONS}
                      />
                    </Space>
                  )}
                  {projectPlanLevel === 'level1' && projectPlanViewMode !== 'horizontal' ? (
                    <Tooltip title="筛选">
                      <Badge dot={hasActiveLevel1PlanFilters} offset={[-2, 2]}>
                        <Button
                          icon={<FilterOutlined />}
                          style={{ borderRadius: 6 }}
                          onClick={() => {
                            setTempLevel1PlanFilters(level1PlanFilters.length ? level1PlanFilters.map(item => ({ ...item })) : [createFilterCondition()])
                            setShowLevel1PlanFilterDrawer(true)
                          }}
                          aria-label="筛选"
                        />
                      </Badge>
                    </Tooltip>
                  ) : projectPlanLevel !== 'level1' ? (
                    <Input placeholder="搜索任务..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear onChange={(e) => setSearchText(e.target.value)} />
                  ) : null}
                  {projectPlanViewMode !== 'gantt' && (
                    <Dropdown menu={{ items: [{ key: 'current', label: '导出当前视图' }, { key: 'all', label: '导出全部' }], onClick: ({ key }) => { if (projectPlanViewMode === 'horizontal') handleExportHorizontalPlan(key as 'current' | 'all'); else handleExportVerticalPlan(key as 'current' | 'all') } }}>
                      <Tooltip title="导出为 Excel"><Button icon={<DownloadOutlined />} style={{ borderRadius: 6 }} /></Tooltip>
                    </Dropdown>
                  )}
                  {projectPlanViewMode !== 'horizontal' && (
                    <Tooltip title="列设置">
                      <SortableColumnSettings
                        open={showColumnModal}
                        trigger={(
                          <Button
                            icon={projectPlanLevel === 'level1' ? <SettingOutlined /> : <AppstoreOutlined />}
                            style={{ borderRadius: 6 }}
                            onClick={() => setShowColumnModal(true)}
                            aria-label="列设置"
                          />
                        )}
                        definitions={currentViewColumns}
                        value={columnSettings}
                        defaultValue={getDefaultColumnSettings(currentViewColumns)}
                        onApply={applyColumnSettings}
                        onCancel={() => setShowColumnModal(false)}
                      />
                    </Tooltip>
                  )}
                  {getScopeKey() !== null && (
                    <>
                      <Tooltip title="全部展开"><Button icon={<PlusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={expandAll} /></Tooltip>
                      <Tooltip title="全部收起"><Button icon={<MinusSquareOutlined />} size="small" style={{ borderRadius: 6 }} onClick={collapseAll} /></Tooltip>
                    </>
                  )}
                  <Tooltip title="版本对比">
                    <Button icon={<HistoryOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowVersionCompare(true)} aria-label="版本对比" />
                  </Tooltip>
                  {projectPlanLevel === 'level1' && versions.some(v => v.status === '已发布') && (
                    <Tooltip title="复制分享链接，无需权限即可查看">
                      <Button icon={<ShareAltOutlined />} style={{ borderRadius: 6 }} onClick={() => {
                        const url = `${window.location.origin}/share/plan?projectId=${selectedProject?.id}&level=level1`
                        navigator.clipboard.writeText(url).then(() => { message.success('分享链接已复制到剪贴板') })
                      }} aria-label="分享计划" />
                    </Tooltip>
                  )}
                  <Divider type="vertical" style={{ margin: '0 2px' }} />
                  {renderProjectPlanViewModeSwitcher()}
                </Space>
              </Col>
            </Row>
          </Card>
        )}
        {!(projectPlanLevel === 'level2' && (activeLevel2Plan === 'plan0' || activeLevel2Plan === 'plan1')) && (
          <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
            {projectPlanLevel === 'level1' && (projectPlanViewMode === 'gantt' ? renderGanttChart() : projectPlanViewMode === 'horizontal' ? renderHorizontalTable() : renderTaskTable())}
            {projectPlanLevel === 'level2' && activeLevel2Plan && (
              projectPlanViewMode === 'gantt'
                ? renderGanttChart(level2PlanTasks.filter(t => t.planId === activeLevel2Plan))
                : renderTaskTable(level2PlanTasks.filter(t => t.planId === activeLevel2Plan))
            )}
          </Card>
        )}
          </>
        )}
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
              const currentScopedTasks = isTosVersionTrainPlan
                ? versionTrainRecordsToCompareTasks(versionTrainRecordsForCurrentVersion || [])
                : projectPlanLevel === 'level2' ? level2PlanTasks : effectiveTasks
              const getTosVersionTasks = (versionId: string) => {
                if (!selectedProject || !isTosTypeScoped) return currentScopedTasks
                const snapshot = publishedSnapshots[getTosTypeSnapshotKey(
                  selectedProject.id,
                  scopedTosPlanType,
                  isTosVersionTrainPlan ? TOS_VERSION_TRAIN_SNAPSHOT_LEVEL : scopedPlanLevel,
                  versionId,
                )]
                if (snapshot === undefined) return currentScopedTasks
                return isTosVersionTrainPlan
                  ? versionTrainRecordsToCompareTasks(snapshot as VersionTrainRecord[])
                  : snapshot
              }
              const oldTasks = isTosTypeScoped
                ? getTosVersionTasks(versionA.id)
                : versionA.status === '已发布' ? LEVEL1_TASKS : effectiveTasks
              let newTasks = isTosTypeScoped
                ? getTosVersionTasks(versionB.id)
                : versionB.status === '已发布' ? LEVEL1_TASKS : effectiveTasks
              if (!isTosTypeScoped && comparePlanVersions(versionA, versionB) !== 0) {
                newTasks = [
                  ...effectiveTasks.map(t => {
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
      {/* Level 1 plan filter drawer */}
      <Drawer
        title="筛选条件"
        open={showLevel1PlanFilterDrawer && projectPlanLevel === 'level1'}
        onClose={() => setShowLevel1PlanFilterDrawer(false)}
        width={520}
        placement="right"
        zIndex={PLAN_DRAWER_Z_INDEX}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setTempLevel1PlanFilters([createFilterCondition()])}>
              清除全部
            </Button>
            <Space>
              <Button onClick={() => setShowLevel1PlanFilterDrawer(false)}>
                取消
              </Button>
              <Button type="primary" onClick={() => {
                setLevel1PlanFilters(normalizeFilterConditions(tempLevel1PlanFilters))
                setShowLevel1PlanFilterDrawer(false)
              }}>
                应用
              </Button>
            </Space>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tempLevel1PlanFilters.map((condition) => (
            <div key={condition.id} style={{ padding: 12, border: '1px solid #eef2ff', borderRadius: 8, background: '#fafbff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 116px 40px', gap: 8, marginBottom: isValuelessFilterOperator(condition.operator) ? 0 : 8 }}>
                <Select
                  aria-label="筛选字段"
                  placeholder="筛选字段"
                  value={condition.field || undefined}
                  options={getFieldOptionsWithDuplicateDisabled(planFilterFieldOptions, tempLevel1PlanFilters, condition.id)}
                  onChange={(value) => setTempLevel1PlanFilters(prev => prev.map(item => item.id === condition.id ? { ...item, field: value } : item))}
                />
                <Select
                  value={condition.operator}
                  options={FILTER_OPERATORS as any}
                  onChange={(value) => {
                    const operator = value as PlanFilterCondition['operator']
                    setTempLevel1PlanFilters(prev => prev.map(item => item.id === condition.id ? {
                      ...item,
                      operator,
                      value: isValuelessFilterOperator(operator) ? '' : item.value,
                    } : item))
                  }}
                />
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => setTempLevel1PlanFilters(prev => prev.length > 1 ? prev.filter(item => item.id !== condition.id) : [createFilterCondition()])}
                />
              </div>
              {!isValuelessFilterOperator(condition.operator) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    placeholder="输入筛选值"
                    value={condition.value}
                    onChange={(e) => setTempLevel1PlanFilters(prev => prev.map(item => item.id === condition.id ? { ...item, value: e.target.value } : item))}
                  />
                </div>
              )}
            </div>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setTempLevel1PlanFilters(prev => [...prev, createFilterCondition()])}
          >
            添加条件
          </Button>
        </div>
      </Drawer>
      {/* Market editor modal */}
      <MarketEditorModal
        open={showMarketEditor}
        rows={marketDraftRows}
        canChangeMainMarket={canChangeMainMarket(
          primaryMarket ? getVersionsForMarket(primaryMarket) : versions,
        )}
        onChange={setMarketDraftRows}
        onSave={saveMarketConfig}
        onCancel={() => setShowMarketEditor(false)}
      />
      <TosTypeEditorModal
        open={showTosTypeEditor}
        rows={tosTypeDraftRows}
        canEdit={canEditBasicInfo}
        onChange={setTosTypeDraftRows}
        onSave={saveTosTypeConfig}
        onCancel={() => setShowTosTypeEditor(false)}
      />
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
              if (isMachineProjectType(selectedProject?.type)) {
                Object.assign(meta, {
                  productLine: selectedProject?.productLine || '', marketName: configuredMarketName, projectName: selectedProject?.name || '', chipVendor: selectedProject?.chipPlatform || '',
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
              {isMachineProjectType(selectedProject?.type) && (
                <>
                  <Form.Item label="产品线"><Input placeholder="自动获取" disabled value={selectedProject?.productLine || ''} /></Form.Item>
                  <Form.Item label="市场名"><Input placeholder="自动获取" disabled value={configuredMarketName} /></Form.Item>
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
