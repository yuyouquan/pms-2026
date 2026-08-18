'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import {
  Badge,
  Button,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CaretDownOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FilterOutlined,
  HistoryOutlined,
  HolderOutlined,
  MinusSquareOutlined,
  PlusOutlined,
  PlusSquareOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import dayjs, { type Dayjs } from 'dayjs'
import { FloatingFilterPanel } from '@/components/shared/FloatingFilterPanel'
import { ClickToEditDate } from '@/components/shared/PlanHelpers'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  getDefaultColumnSettings,
  normalizeColumnSettings,
  orderVisibleDefinitions,
  type SortableColumnDefinition,
} from '@/lib/columnSettings'
import {
  applyFilterConditions,
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  getFilterOperatorsForKind,
  isFilterConditionActive,
  isValuelessFilterOperator,
  normalizeFilterConditions,
  type FilterCondition,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import {
  applyLevel3Rollups,
  canInlineEditLevel3ActualDate,
  filterLevel3ActivitiesWithParents,
  getLevel3ActivityPermissions,
  getLevel3NumberIndent,
  mergeLevel3ActualDateOverrides,
  mergeLevel3Histories,
  shouldShowLevel3CreateButton,
  validateLevel3ChildDates,
} from '@/lib/level3PlanRules'
import { useLevel3PlanStore } from '@/stores/level3Plan'
import {
  LEVEL3_ACTIVITY_RISKS,
  LEVEL3_ACTIVITY_STATUSES,
  type Level3Activity,
  type Level3ChangeLog,
  type Level3ActivityFormValue,
  type Level3ActivityViewRow,
  type Level3ColumnKey,
  type Level3Milestone,
  type Level3PermissionContext,
} from '@/types/level3Plan'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'

const { Text } = Typography
const EMPTY_ACTIVITIES: Level3Activity[] = []
const EMPTY_HISTORY: Level3ChangeLog[] = []
const EMPTY_STRINGS: string[] = []

const LEVEL3_COLUMN_DEFINITIONS: Array<SortableColumnDefinition<Level3ColumnKey> & { width: number }> = [
  { key: 'number', title: '序号', defaultVisible: true, hideable: false, fixed: 'left', width: 92 },
  { key: 'activityName', title: '活动名称', defaultVisible: true, hideable: false, fixed: 'left', width: 240 },
  { key: 'responsible', title: '责任人', defaultVisible: true, width: 110 },
  { key: 'responsibleDepartment', title: '责任部门', defaultVisible: true, width: 150 },
  { key: 'planStartDate', title: '计划开始时间', defaultVisible: true, width: 132 },
  { key: 'planEndDate', title: '计划结束时间', defaultVisible: true, width: 132 },
  { key: 'estimatedDays', title: '预估工期', defaultVisible: true, width: 100 },
  { key: 'milestoneName', title: '关键节点', defaultVisible: true, width: 140 },
  { key: 'actualStartDate', title: '实际开始时间', defaultVisible: true, width: 132 },
  { key: 'actualEndDate', title: '实际完成时间', defaultVisible: true, width: 132 },
  { key: 'actualDays', title: '实际工期', defaultVisible: true, width: 100 },
  { key: 'status', title: '状态', defaultVisible: true, width: 100 },
  { key: 'risk', title: '任务风险', defaultVisible: true, width: 100 },
  { key: 'creator', title: '创建者', defaultVisible: true, width: 110 },
]

const FILTER_FIELDS: FilterFieldDefinition[] = [
  { key: 'number', label: '序号', kind: 'text' },
  { key: 'activityName', label: '活动名称', kind: 'text' },
  { key: 'responsible', label: '责任人', kind: 'text' },
  { key: 'responsibleDepartment', label: '责任部门', kind: 'text' },
  { key: 'planStartDate', label: '计划开始时间', kind: 'date' },
  { key: 'planEndDate', label: '计划结束时间', kind: 'date' },
  { key: 'estimatedDays', label: '预估工期', kind: 'text' },
  { key: 'milestoneName', label: '关键节点', kind: 'text' },
  { key: 'actualStartDate', label: '实际开始时间', kind: 'date' },
  { key: 'actualEndDate', label: '实际完成时间', kind: 'date' },
  { key: 'actualDays', label: '实际工期', kind: 'text' },
  { key: 'status', label: '状态', kind: 'enum', options: LEVEL3_ACTIVITY_STATUSES.map(value => ({ label: value, value })) },
  { key: 'risk', label: '任务风险', kind: 'enum', options: LEVEL3_ACTIVITY_RISKS.map(value => ({ label: value, value })) },
  { key: 'creator', label: '创建者', kind: 'text' },
]
const FILTER_FIELD_OPTIONS = FILTER_FIELDS.map(field => ({ label: field.label, value: field.key }))

const STATUS_COLORS: Record<string, string> = {
  待启动: 'default',
  进行中: 'processing',
  已完成: 'success',
}

const RISK_COLORS: Record<string, string> = {
  无: 'default',
  高: 'error',
  中: 'warning',
  低: 'blue',
}

type ActivityModalMode =
  | { kind: 'create-parent' }
  | { kind: 'create-child'; parentId: string }
  | { kind: 'edit'; activityId: string }
  | null

interface Level3PlanModuleProps {
  projectName: string
  scopeKey: string
  selectedScopeKey: string
  scopeLabel: string
  readOnly: boolean
  currentUser: string
  administratorUsers: string[]
  spmUsers: string[]
  users: string[]
  userDepartments: Record<string, string>
  milestones: Level3Milestone[]
}

const DragPermissionContext = createContext<Record<string, boolean>>({})

interface SortableTableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string
}

function SortableTableRow(props: SortableTableRowProps) {
  const dragPermissions = useContext(DragPermissionContext)
  const rowId = String(props['data-row-key'] || '')
  const enabled = dragPermissions[rowId] === true
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowId, disabled: !enabled })
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: enabled ? (isDragging ? 'grabbing' : 'grab') : undefined,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 2 : undefined,
  }
  return (
    <tr
      {...props}
      ref={setNodeRef}
      style={style}
      className={`${props.className || ''}${isDragging ? ' pms-level3-dragging' : ''}`.trim()}
      {...(enabled ? attributes : {})}
      {...(enabled ? listeners : {})}
    />
  )
}

const formatDuration = (value: number | null) => value == null ? '—' : `${value}天`
const formatCell = (value: string) => value || '—'
const formatNow = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date()).replace('T', ' ')

const createActivityId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `level3-${crypto.randomUUID()}`
  }
  return `level3-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const toDateString = (value: Dayjs | string | null | undefined) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.format('YYYY-MM-DD')
}

export default function Level3PlanModule({
  projectName,
  scopeKey,
  selectedScopeKey,
  scopeLabel,
  readOnly,
  currentUser,
  administratorUsers,
  spmUsers,
  users,
  userDepartments,
  milestones,
}: Level3PlanModuleProps) {
  const sourceActivities = useLevel3PlanStore(state => state.activitiesByScope[scopeKey] || EMPTY_ACTIVITIES)
  const sourceHistory = useLevel3PlanStore(state => state.historyByScope[scopeKey] || EMPTY_HISTORY)
  const actualOverrides = useLevel3PlanStore(state => state.actualOverridesByScope[selectedScopeKey] || {})
  const selectedScopeHistory = useLevel3PlanStore(state => state.historyByScope[selectedScopeKey] || EMPTY_HISTORY)
  const collapsedIds = useLevel3PlanStore(state => state.collapsedIdsByScope[scopeKey] || EMPTY_STRINGS)
  const storedColumnSettings = useLevel3PlanStore(state => state.columnSettingsByScope[scopeKey])
  const createActivity = useLevel3PlanStore(state => state.createActivity)
  const updateActivity = useLevel3PlanStore(state => state.updateActivity)
  const updateFollowActualDates = useLevel3PlanStore(state => state.updateFollowActualDates)
  const moveActivity = useLevel3PlanStore(state => state.moveActivity)
  const deleteActivity = useLevel3PlanStore(state => state.deleteActivity)
  const setCollapsedIds = useLevel3PlanStore(state => state.setCollapsedIds)
  const setColumnSettings = useLevel3PlanStore(state => state.setColumnSettings)
  const [form] = Form.useForm()
  const [messageApi, messageContextHolder] = message.useMessage()
  const selectedMilestoneId = Form.useWatch('milestoneId', form)
  const [modalMode, setModalMode] = useState<ActivityModalMode>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<FilterCondition[]>([createFilterCondition()])
  const [draftFilters, setDraftFilters] = useState<FilterCondition[]>([createFilterCondition()])
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const permissionContext: Level3PermissionContext = useMemo(() => ({
    currentUser,
    administratorUsers,
    spmUsers,
  }), [administratorUsers, currentUser, spmUsers])
  const effectiveActivities = useMemo(
    () => mergeLevel3ActualDateOverrides(sourceActivities, actualOverrides),
    [actualOverrides, sourceActivities],
  )
  const history = useMemo(
    () => readOnly ? mergeLevel3Histories(sourceHistory, selectedScopeHistory) : sourceHistory,
    [readOnly, selectedScopeHistory, sourceHistory],
  )
  const canCreateParent = !readOnly
    && getLevel3ActivityPermissions(undefined, effectiveActivities, permissionContext).canCreateParent
  const rows = useMemo(() => applyLevel3Rollups(effectiveActivities), [effectiveActivities])
  const activeFilters = useMemo(
    () => normalizeFilterConditions(filters, FILTER_FIELDS),
    [filters],
  )
  const filteredRows = useMemo(() => {
    if (activeFilters.length === 0) return rows
    const matched = applyFilterConditions(rows, activeFilters, FILTER_FIELDS)
    return filterLevel3ActivitiesWithParents(rows, new Set(matched.map(row => row.id))) as Level3ActivityViewRow[]
  }, [activeFilters, rows])
  const visibleRows = useMemo(() => filteredRows.filter(row => (
    !row.parentId || !collapsedIds.includes(row.parentId)
  )), [collapsedIds, filteredRows])
  const columnSettings = useMemo(() => normalizeColumnSettings(
    LEVEL3_COLUMN_DEFINITIONS,
    storedColumnSettings || getDefaultColumnSettings(LEVEL3_COLUMN_DEFINITIONS),
  ), [storedColumnSettings])
  const visibleDefinitions = useMemo(
    () => orderVisibleDefinitions(LEVEL3_COLUMN_DEFINITIONS, columnSettings),
    [columnSettings],
  )
  const selectedMilestone = milestones.find(item => item.id === selectedMilestoneId)
  const editingActivity = modalMode?.kind === 'edit'
    ? effectiveActivities.find(activity => activity.id === modalMode.activityId)
    : undefined
  const modalIsChild = modalMode?.kind === 'create-child' || Boolean(editingActivity?.parentId)

  useEffect(() => {
    if (!modalMode) return
    form.resetFields()
    const values = modalMode.kind !== 'edit' || !editingActivity
      ? { status: '待启动', risk: '无', responsibleDepartment: '' }
      : {
          activityName: editingActivity.activityName,
          responsible: editingActivity.responsible,
          responsibleDepartment: editingActivity.responsibleDepartment,
          planStartDate: editingActivity.planStartDate ? dayjs(editingActivity.planStartDate) : null,
          planEndDate: editingActivity.planEndDate ? dayjs(editingActivity.planEndDate) : null,
          actualStartDate: editingActivity.actualStartDate ? dayjs(editingActivity.actualStartDate) : null,
          actualEndDate: editingActivity.actualEndDate ? dayjs(editingActivity.actualEndDate) : null,
          milestoneId: editingActivity.milestoneId || undefined,
          status: editingActivity.status,
          risk: editingActivity.risk,
          remark: editingActivity.remark,
        }
    const timer = window.setTimeout(() => form.setFieldsValue(values), 0)
    return () => window.clearTimeout(timer)
  }, [editingActivity, form, modalMode])

  const resolveDepartment = (responsible: string) => userDepartments[responsible] || '待补充'

  const openCreateParent = () => {
    if (!canCreateParent) return
    setModalMode({ kind: 'create-parent' })
  }

  const openCreateChild = (parentId: string) => {
    if (readOnly) return
    if (!milestones.some(milestone => milestone.planEndDate)) {
      void messageApi.warning('请先发布一级计划后再新增二级活动')
      return
    }
    setModalMode({ kind: 'create-child', parentId })
  }

  const openEdit = (activity: Level3Activity) => {
    if (readOnly) return
    const permissions = getLevel3ActivityPermissions(activity, effectiveActivities, permissionContext)
    if (!permissions.canEdit) return
    setModalMode({ kind: 'edit', activityId: activity.id })
  }

  const closeModal = () => {
    setModalMode(null)
    form.resetFields()
  }

  const saveActivity = async (rawValues: Level3ActivityFormValue & {
    planStartDate?: Dayjs
    planEndDate?: Dayjs
    actualStartDate?: Dayjs
    actualEndDate?: Dayjs
  }) => {
    if (!modalMode || readOnly) return
    const milestone = milestones.find(item => item.id === rawValues.milestoneId)
    const values: Level3ActivityFormValue = {
      ...rawValues,
      activityName: rawValues.activityName?.trim(),
      responsibleDepartment: resolveDepartment(rawValues.responsible || ''),
      planStartDate: toDateString(rawValues.planStartDate),
      planEndDate: toDateString(rawValues.planEndDate),
      actualStartDate: toDateString(rawValues.actualStartDate),
      actualEndDate: toDateString(rawValues.actualEndDate),
    }
    if (modalIsChild) {
      const validation = validateLevel3ChildDates(values, milestone)
      if (!validation.ok) {
        void messageApi.error(validation.errors[0])
        return
      }
      if (!milestone) {
        void messageApi.error('关键节点已失效，请重新选择')
        return
      }
    }
    if (modalMode.kind === 'edit') {
      const activity = effectiveActivities.find(item => item.id === modalMode.activityId)
      if (!activity) return
      const patch: Partial<Level3Activity> = {
        activityName: values.activityName || '',
        responsible: values.responsible || '',
        responsibleDepartment: values.responsibleDepartment || '待补充',
        status: values.status || '待启动',
        risk: values.risk || '无',
        remark: values.remark || '',
      }
      if (activity.parentId) {
        Object.assign(patch, {
          planStartDate: values.planStartDate || '',
          planEndDate: values.planEndDate || '',
          actualStartDate: values.actualStartDate || '',
          actualEndDate: values.actualEndDate || '',
          milestoneId: milestone?.id || '',
          milestoneName: milestone?.name || '',
          milestonePlanEndDate: milestone?.planEndDate || '',
        })
      }
      if (updateActivity(scopeKey, activity.id, patch, currentUser)) {
        void messageApi.success('活动已更新')
        closeModal()
      }
      return
    }
    const now = formatNow()
    const parentId = modalMode.kind === 'create-child' ? modalMode.parentId : null
    const nextActivity: Level3Activity = {
      id: createActivityId(),
      parentId,
      order: 0,
      activityName: values.activityName || '',
      responsible: values.responsible || '',
      responsibleDepartment: values.responsibleDepartment || '待补充',
      planStartDate: parentId ? values.planStartDate || '' : '',
      planEndDate: parentId ? values.planEndDate || '' : '',
      actualStartDate: parentId ? values.actualStartDate || '' : '',
      actualEndDate: parentId ? values.actualEndDate || '' : '',
      milestoneId: parentId ? milestone?.id || '' : '',
      milestoneName: parentId ? milestone?.name || '' : '',
      milestonePlanEndDate: parentId ? milestone?.planEndDate || '' : '',
      status: values.status || '待启动',
      risk: values.risk || '无',
      remark: values.remark || '',
      creator: currentUser,
      createdAt: now,
      updatedBy: currentUser,
      updatedAt: now,
    }
    if (createActivity(scopeKey, nextActivity, currentUser)) {
      void messageApi.success(parentId ? '二级活动已新增' : '一级活动已新增')
      closeModal()
    }
  }

  const updateDraftFilter = (conditionId: string, patch: Partial<FilterCondition>) => {
    setDraftFilters(previous => {
      const next = previous.map(condition => (
        condition.id === conditionId ? { ...condition, ...patch } : condition
      ))
      setFilters(next)
      return next
    })
  }

  const commitFilters = (next: FilterCondition[]) => {
    setDraftFilters(next)
    setFilters(next)
  }

  const handleExport = (mode: 'current' | 'all') => {
    const exportRows = mode === 'current' ? filteredRows : rows
    if (exportRows.length === 0) {
      void messageApi.warning('暂无可导出数据')
      return
    }
    const definitions = mode === 'current' ? visibleDefinitions : LEVEL3_COLUMN_DEFINITIONS
    const exportColumns: ExportColumn[] = definitions.map(definition => ({
      key: definition.key,
      title: String(definition.title),
    }))
    exportSheet(
      exportRows,
      exportColumns,
      `三级计划_${projectName}_${scopeLabel}_${exportTimestamp()}.xlsx`,
      '三级计划',
    )
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (readOnly || !over || active.id === over.id) return
    const activeActivity = effectiveActivities.find(activity => activity.id === String(active.id))
    const overActivity = effectiveActivities.find(activity => activity.id === String(over.id))
    if (!activeActivity || !overActivity) return
    const activePermissions = getLevel3ActivityPermissions(activeActivity, effectiveActivities, permissionContext)
    if (!activePermissions.canDrag) {
      void messageApi.warning('无权限拖动该活动')
      return
    }
    const elevated = administratorUsers.includes(currentUser) || spmUsers.includes(currentUser)
    if (activeActivity.parentId && overActivity.parentId && activeActivity.parentId !== overActivity.parentId && !elevated) {
      const sourceParent = effectiveActivities.find(activity => activity.id === activeActivity.parentId)
      const targetParent = effectiveActivities.find(activity => activity.id === overActivity.parentId)
      if (sourceParent?.responsible !== currentUser || targetParent?.responsible !== currentUser) {
        void messageApi.warning('跨组拖动需要同时管理来源和目标一级活动')
        return
      }
    }
    const result = moveActivity(scopeKey, activeActivity.id, overActivity.id, currentUser)
    if (!result.ok) {
      void messageApi.warning(result.reason || '拖动失败')
      return
    }
    void messageApi.success('活动顺序已更新')
  }

  const dragPermissions = useMemo(() => Object.fromEntries(rows.map(row => [
    row.id,
    !readOnly && getLevel3ActivityPermissions(row, effectiveActivities, permissionContext).canDrag,
  ])), [effectiveActivities, permissionContext, readOnly, rows])

  const renderActivityName = (row: Level3ActivityViewRow): ReactNode => {
    const permissions = getLevel3ActivityPermissions(row, effectiveActivities, permissionContext)
    return (
      <div className="pms-level3-activity-cell" style={{ paddingLeft: row.depth ? 18 : 0 }}>
        <span className="pms-level3-activity-title">{row.activityName}</span>
        {!readOnly && (permissions.canEdit || permissions.canAddChild) && (
          <Space size={2} className="pms-level3-row-actions" onPointerDown={event => event.stopPropagation()}>
            {permissions.canEdit && (
              <Tooltip title="编辑活动">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label={`编辑活动 ${row.activityName}`}
                  onClick={() => openEdit(row)}
                />
              </Tooltip>
            )}
            {!row.parentId && permissions.canAddChild && (
              <Tooltip title="新增二级活动">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label={`新增二级活动 ${row.activityName}`}
                  onClick={() => openCreateChild(row.id)}
                />
              </Tooltip>
            )}
            {permissions.canDelete && (
              <Popconfirm
                title="确认删除活动？"
                description={row.parentId
                  ? `删除后无法恢复。确认删除「${row.activityName}」？`
                  : `删除后将同时删除所有二级活动。确认删除「${row.activityName}」？`}
                okText="确认删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => {
                  if (deleteActivity(scopeKey, row.id, currentUser)) void messageApi.success('活动已删除')
                }}
              >
                <Tooltip title="删除活动">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`删除活动 ${row.activityName}`}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        )}
      </div>
    )
  }

  const handleInlineActualDateChange = (
    row: Level3ActivityViewRow,
    field: 'actualStartDate' | 'actualEndDate',
    value: string,
  ) => {
    if (!canInlineEditLevel3ActualDate(row, effectiveActivities, permissionContext, false)) return
    if (readOnly) {
      if (updateFollowActualDates(scopeKey, selectedScopeKey, row.id, { [field]: value }, currentUser)) {
        void messageApi.success('已保存')
      }
      return
    }
    if (updateActivity(scopeKey, row.id, { [field]: value }, currentUser)) {
      void messageApi.success('已保存')
    }
  }

  const columns: ColumnsType<Level3ActivityViewRow> = visibleDefinitions.map(definition => {
    const base = {
      title: definition.title,
      dataIndex: definition.key,
      key: definition.key,
      width: LEVEL3_COLUMN_DEFINITIONS.find(item => item.key === definition.key)?.width,
      fixed: definition.fixed,
      ellipsis: true,
    }
    if (definition.key === 'number') {
      return {
        ...base,
        render: (_: unknown, row: Level3ActivityViewRow) => (
          <Space
            size={5}
            className="pms-level3-number-cell"
            style={{ paddingLeft: getLevel3NumberIndent(row.depth) }}
          >
            {dragPermissions[row.id] && <HolderOutlined style={{ color: '#9ca3af' }} />}
            {!row.parentId && effectiveActivities.some(activity => activity.parentId === row.id) && (
              <Button
                type="text"
                size="small"
                className="pms-level3-collapse-button"
                icon={collapsedIds.includes(row.id) ? <CaretRightOutlined /> : <CaretDownOutlined />}
                aria-label={`${collapsedIds.includes(row.id) ? '展开' : '收起'} ${row.activityName}`}
                onPointerDown={event => event.stopPropagation()}
                onClick={() => setCollapsedIds(
                  scopeKey,
                  collapsedIds.includes(row.id)
                    ? collapsedIds.filter(id => id !== row.id)
                    : [...collapsedIds, row.id],
                )}
              />
            )}
            <span>{row.number}</span>
          </Space>
        ),
      }
    }
    if (definition.key === 'activityName') return { ...base, render: (_: unknown, row: Level3ActivityViewRow) => renderActivityName(row) }
    if (definition.key === 'estimatedDays') return { ...base, render: (value: number | null) => formatDuration(value) }
    if (definition.key === 'actualDays') return { ...base, render: (value: number | null) => formatDuration(value) }
    if (definition.key === 'actualStartDate' || definition.key === 'actualEndDate') {
      const actualField = definition.key
      return {
        ...base,
        ellipsis: false,
        render: (value: string, row: Level3ActivityViewRow) => {
          if (!canInlineEditLevel3ActualDate(row, effectiveActivities, permissionContext, false)) return formatCell(value)
          const isStart = actualField === 'actualStartDate'
          return (
            <div
              className="pms-level3-inline-date"
              onPointerDown={event => event.stopPropagation()}
              onDoubleClick={event => event.stopPropagation()}
            >
              <ClickToEditDate
                value={value}
                onChange={nextValue => handleInlineActualDateChange(row, actualField, nextValue)}
                disabledDate={current => isStart
                  ? Boolean(row.actualEndDate && current.isAfter(dayjs(row.actualEndDate), 'day'))
                  : Boolean(row.actualStartDate && current.isBefore(dayjs(row.actualStartDate), 'day'))}
                onSaved={() => undefined}
              />
            </div>
          )
        },
      }
    }
    if (definition.key === 'status') return { ...base, render: (value: string) => <Tag color={STATUS_COLORS[value]}>{value}</Tag> }
    if (definition.key === 'risk') return { ...base, render: (value: string) => <Tag color={RISK_COLORS[value]}>{value}</Tag> }
    return { ...base, render: (value: string) => formatCell(value) }
  })

  const milestoneOptions = useMemo(() => {
    const options = milestones.map(milestone => ({
      label: milestone.planEndDate ? `${milestone.name}（${milestone.planEndDate}）` : `${milestone.name}（缺少计划完成时间）`,
      value: milestone.id,
      disabled: !milestone.planEndDate,
    }))
    if (editingActivity?.milestoneId && !milestones.some(item => item.id === editingActivity.milestoneId)) {
      options.push({
        label: `${editingActivity.milestoneName || '原关键节点'}（已失效）`,
        value: editingActivity.milestoneId,
        disabled: true,
      })
    }
    return options
  }, [editingActivity, milestones])

  return (
    <div className="pms-level3-plan">
      {messageContextHolder}
      <div className="pms-level3-toolbar pms-toolbar">
        <div>
          {shouldShowLevel3CreateButton(readOnly) && (
            <Tooltip title={canCreateParent ? '新增一级活动' : '仅SPM和管理员可新增一级活动'}>
              <span>
                <Button type="primary" icon={<PlusOutlined />} disabled={!canCreateParent} onClick={openCreateParent}>新增活动</Button>
              </span>
            </Tooltip>
          )}
        </div>
        <Space size={6} wrap>
          <FloatingFilterPanel
            open={filterOpen}
            title="三级计划筛选"
            trigger={(
              <Tooltip title="筛选">
                <Badge dot={activeFilters.length > 0} offset={[-2, 2]}>
                  <Button
                    icon={<FilterOutlined />}
                    aria-label="筛选"
                    onClick={() => {
                      setColumnSettingsOpen(false)
                      setDraftFilters(filters.map(condition => ({ ...condition })))
                      setFilterOpen(true)
                    }}
                  />
                </Badge>
              </Tooltip>
            )}
            onReset={() => commitFilters([createFilterCondition()])}
            onAdd={() => commitFilters([...draftFilters, createFilterCondition()])}
            addDisabled={draftFilters.length >= FILTER_FIELDS.length}
            onClose={() => setFilterOpen(false)}
          >
            <div className="pms-filter-condition-list">
              {draftFilters.map(condition => {
                const definition = FILTER_FIELDS.find(field => field.key === condition.field)
                return (
                  <div key={condition.id} className="pms-filter-condition-row">
                    <Select
                      aria-label="筛选字段"
                      placeholder="筛选字段"
                      value={condition.field || undefined}
                      options={getFieldOptionsWithDuplicateDisabled(FILTER_FIELD_OPTIONS, draftFilters, condition.id)}
                      onChange={value => updateDraftFilter(condition.id, { field: value, value: '', operator: 'equals' })}
                    />
                    <Select
                      aria-label="筛选条件"
                      value={condition.operator}
                      options={getFilterOperatorsForKind(definition?.kind || 'text') as unknown as Array<{ label: string; value: string }>}
                      onChange={value => updateDraftFilter(condition.id, {
                        operator: value as FilterCondition['operator'],
                        value: isValuelessFilterOperator(value as FilterCondition['operator']) ? '' : condition.value,
                      })}
                    />
                    {!isValuelessFilterOperator(condition.operator) ? (
                      definition?.kind === 'enum' ? (
                        <Select
                          aria-label="筛选值"
                          placeholder="请选择"
                          value={condition.value || undefined}
                          options={definition.options}
                          onChange={value => updateDraftFilter(condition.id, { value })}
                        />
                      ) : (
                        <Input
                          aria-label="筛选值"
                          placeholder={definition?.kind === 'date' ? 'YYYY-MM-DD' : '输入筛选值'}
                          value={condition.value}
                          onChange={event => updateDraftFilter(condition.id, { value: event.target.value })}
                        />
                      )
                    ) : <span className="pms-filter-value-placeholder" aria-hidden />}
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="删除筛选条件"
                      onClick={() => {
                        const remaining = draftFilters.filter(item => item.id !== condition.id)
                        commitFilters(remaining.length ? remaining : [createFilterCondition()])
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </FloatingFilterPanel>
          <Dropdown menu={{
            items: [
              { key: 'current', label: '导出当前视图' },
              { key: 'all', label: '导出全部' },
            ],
            onClick: ({ key }) => handleExport(key as 'current' | 'all'),
          }}>
            <Tooltip title="导出"><Button icon={<DownloadOutlined />} aria-label="导出" /></Tooltip>
          </Dropdown>
          <SortableColumnSettings
            open={columnSettingsOpen}
            trigger={(
              <Tooltip title="字段配置">
                <Button
                  icon={<SettingOutlined />}
                  aria-label="字段配置"
                  onClick={() => {
                    setFilterOpen(false)
                    setColumnSettingsOpen(true)
                  }}
                />
              </Tooltip>
            )}
            definitions={LEVEL3_COLUMN_DEFINITIONS}
            value={columnSettings}
            defaultValue={getDefaultColumnSettings(LEVEL3_COLUMN_DEFINITIONS)}
            onApply={value => setColumnSettings(scopeKey, value)}
            onCancel={() => setColumnSettingsOpen(false)}
          />
          <Tooltip title="全部展开"><Button icon={<PlusSquareOutlined />} aria-label="全部展开" onClick={() => setCollapsedIds(scopeKey, [])} /></Tooltip>
          <Tooltip title="全部收起"><Button icon={<MinusSquareOutlined />} aria-label="全部收起" onClick={() => setCollapsedIds(scopeKey, rows.filter(row => !row.parentId).map(row => row.id))} /></Tooltip>
          <Tooltip title="历史修改记录"><Button icon={<HistoryOutlined />} aria-label="历史修改记录" onClick={() => setHistoryOpen(true)} /></Tooltip>
        </Space>
      </div>

      <DragPermissionContext.Provider value={dragPermissions}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleRows.map(row => row.id)} strategy={verticalListSortingStrategy}>
            <Table<Level3ActivityViewRow>
              className="pms-table pms-level3-table"
              rowKey="id"
              size="middle"
              pagination={false}
              dataSource={visibleRows}
              columns={columns}
              scroll={{ x: Math.max(1500, visibleDefinitions.reduce((sum, definition) => sum + (LEVEL3_COLUMN_DEFINITIONS.find(item => item.key === definition.key)?.width || 100), 0)) }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无三级计划活动" /> }}
              rowClassName={row => row.parentId ? 'pms-level3-child-row' : 'pms-level3-parent-row'}
              components={{ body: { row: SortableTableRow } }}
              onRow={row => ({
                onDoubleClick: () => {
                  if (!readOnly && getLevel3ActivityPermissions(row, effectiveActivities, permissionContext).canEdit) openEdit(row)
                },
              })}
            />
          </SortableContext>
        </DndContext>
      </DragPermissionContext.Provider>

      <Modal
        className="pms-modal"
        title={modalMode?.kind === 'create-parent' ? '新增活动' : modalMode?.kind === 'create-child' ? '新增二级活动' : '编辑活动'}
        open={modalMode !== null}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText="确认"
        cancelText="取消"
        width={modalIsChild ? 760 : 620}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={saveActivity} preserve={false}>
          <Form.Item label="活动名称" name="activityName" rules={[{ required: true, whitespace: true, message: '请输入活动名称' }]}>
            <Input maxLength={100} showCount placeholder="请输入活动名称" />
          </Form.Item>
          <div className="pms-level3-form-grid">
            <Form.Item label="责任人" name="responsible" rules={[{ required: true, message: '请选择责任人' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={users.map(user => ({ label: user, value: user }))}
                placeholder="请选择责任人"
                onChange={value => form.setFieldValue('responsibleDepartment', resolveDepartment(value))}
              />
            </Form.Item>
            <Form.Item label="责任部门" name="responsibleDepartment">
              <Input readOnly placeholder="选择责任人后自动带出" />
            </Form.Item>
          </div>
          {modalIsChild && (
            <>
              <div className="pms-level3-form-grid">
                <Form.Item label="计划开始时间" name="planStartDate" rules={[{ required: true, message: '请选择计划开始时间' }]}>
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
                <Form.Item label="计划完成时间" name="planEndDate" dependencies={['milestoneId']} rules={[{ required: true, message: '请选择计划完成时间' }]}>
                  <DatePicker
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD"
                    disabledDate={current => Boolean(selectedMilestone?.planEndDate && current.format('YYYY-MM-DD') > selectedMilestone.planEndDate)}
                  />
                </Form.Item>
              </div>
              <div className="pms-level3-form-grid">
                <Form.Item label="实际开始时间" name="actualStartDate">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
                <Form.Item label="实际完成时间" name="actualEndDate">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </div>
              <Form.Item label="关键节点" name="milestoneId" rules={[{ required: true, message: '请选择关键节点' }]}>
                <Select showSearch optionFilterProp="label" options={milestoneOptions} placeholder="请选择最新已发布一级计划的二级任务" />
              </Form.Item>
            </>
          )}
          <div className="pms-level3-form-grid">
            <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
              <Select options={LEVEL3_ACTIVITY_STATUSES.map(value => ({ label: value, value }))} />
            </Form.Item>
            <Form.Item label="任务风险" name="risk" rules={[{ required: true, message: '请选择任务风险' }]}>
              <Select options={LEVEL3_ACTIVITY_RISKS.map(value => ({ label: value, value }))} />
            </Form.Item>
          </div>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="历史修改记录"
        size={520}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      >
        {history.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史修改记录" />
        ) : (
          <div className="pms-level3-history-list">
            {history.map(item => (
              <div key={item.id} className="pms-level3-history-item">
                <Space size={8} wrap>
                  <Tag color={item.action === 'move' ? 'purple' : item.action === 'edit' ? 'blue' : 'green'}>{item.summary}</Tag>
                  <Text strong>{item.activityNumber} {item.activityName}</Text>
                </Space>
                <div className="pms-level3-history-description">
                  <div style={{ marginBottom: item.changes.length ? 8 : 0 }}>{item.actor} · {item.occurredAt}</div>
                  {item.changes.map(change => (
                    <div key={`${item.id}-${change.field}`} className="pms-level3-history-change">
                      <span>{change.label}</span>
                      <Text type="secondary" delete>{change.before || '—'}</Text>
                      <span>→</span>
                      <Text>{change.after || '—'}</Text>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  )
}
