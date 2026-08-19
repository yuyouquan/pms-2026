import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { SortableColumnSettingsValue } from '@/lib/columnSettings'
import {
  createLevel3ActualDateOverride,
  createLevel3WorkflowOverride,
  deleteLevel3ActivityTree,
  forkLevel3ScopeData,
  getLevel3MovePermission,
  mergeLevel3ActualDateOverrides,
  mergeLevel3WorkflowOverrides,
  moveLevel3Activity,
  numberLevel3Activities,
} from '@/lib/level3PlanRules'
import {
  LEVEL3_COLUMN_KEYS,
  LEVEL3_ACTIVITY_RISKS,
  LEVEL3_ACTIVITY_STATUSES,
  type Level3Activity,
  type Level3ActualDateOverrideMap,
  type Level3ChangeLog,
  type Level3ColumnKey,
  type Level3FieldChange,
  type Level3MoveResult,
  type Level3Milestone,
  type Level3PermissionContext,
  type Level3ScopeData,
  type Level3WorkflowOverrideMap,
} from '@/types/level3Plan'

export const LEVEL3_PLAN_STORAGE_KEY = 'pms-level3-plan-store'
export const LEVEL3_PLAN_STORE_VERSION = 3

const DEFAULT_COLUMN_SETTINGS: SortableColumnSettingsValue<Level3ColumnKey> = {
  order: [...LEVEL3_COLUMN_KEYS],
  visible: [...LEVEL3_COLUMN_KEYS],
}

const FIELD_LABELS: Partial<Record<keyof Level3Activity, string>> = {
  activityName: '活动名称',
  responsible: '责任人',
  responsibleDepartment: '责任部门',
  planStartDate: '计划开始时间',
  planEndDate: '计划完成时间',
  actualStartDate: '实际开始时间',
  actualEndDate: '实际完成时间',
  milestoneName: '关键节点',
  status: '状态',
  risk: '任务风险',
  remark: '备注',
}

const cloneActivities = (activities: Level3Activity[]) => activities.map(activity => ({ ...activity }))
const cloneHistory = (history: Level3ChangeLog[]) => history.map(log => ({
  ...log,
  changes: log.changes.map(change => ({ ...change })),
}))

const getParentHistorySnapshot = (activity: Level3Activity, activities: Level3Activity[]) => {
  if (!activity.parentId) return {}
  const parent = activities.find(item => item.id === activity.parentId)
  if (!parent || parent.parentId) return null
  return { parentActivityId: parent.id, parentActivityName: parent.activityName }
}

let lastFormattedTimestamp = 0
const formatNow = () => {
  const timestamp = Math.max(Date.now(), lastFormattedTimestamp + 1)
  lastFormattedTimestamp = timestamp
  return new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
  }).format(new Date(timestamp)).replace('T', ' ').replace(',', '.')
}

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const addCalendarDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const LEVEL3_MOCK_SECTIONS = [
  {
    name: 'IR计划输出', fallbackEndDate: '2026-02-26', milestoneIndex: 1,
    children: ['原始IR输出', '需求串讲', 'IR锁定', 'PD/UX/概设/测试方案锁定', 'SR分解', '需求反串讲', 'IR排期', 'IR开发', 'IR验收'],
  },
  {
    name: 'tOS子系统概要设计', fallbackEndDate: '2026-05-22', milestoneIndex: 3,
    children: ['概要设计启动', 'SDRB评审', '子系统概要设计终审'],
  },
  {
    name: '测试计划', fallbackEndDate: '2026-12-15', milestoneIndex: 6,
    children: ['测试范围 & 需求拆解', '测试用例设计评审', '测试策略&计划评审', '版本测试-STR4', '版本测试-STR4A', 'STR5版本归档'],
  },
  {
    name: 'Beta NPS调研计划', fallbackEndDate: '2027-03-01', milestoneIndex: 7,
    children: ['调研问卷设计', 'Beta版本发布', '用户反馈收集', 'NPS数据统计', '调研报告输出'],
  },
] as const

export const buildLevel3MockActivities = (milestones: Level3Milestone[]): Level3Activity[] => {
  const owners = [
    { name: '张三', department: '项目管理部' },
    { name: '李四', department: '产品规划部' },
    { name: '王五', department: '测试部' },
    { name: '赵六', department: '用户研究部' },
  ]
  const createdAt = '2026-08-18 09:00:00'
  return LEVEL3_MOCK_SECTIONS.flatMap((section, sectionIndex) => {
    const parentId = `level3-mock-parent-${sectionIndex + 1}`
    const owner = owners[sectionIndex]
    const milestone = milestones[Math.min(section.milestoneIndex, Math.max(milestones.length - 1, 0))]
    const sectionEndDate = milestone?.planEndDate || section.fallbackEndDate
    const parent: Level3Activity = {
      id: parentId,
      parentId: null,
      order: sectionIndex,
      activityName: section.name,
      responsible: owner.name,
      responsibleDepartment: owner.department,
      planStartDate: '',
      planEndDate: '',
      actualStartDate: '',
      actualEndDate: '',
      milestoneId: '',
      milestoneName: '',
      milestonePlanEndDate: '',
      status: '待启动',
      risk: '无',
      remark: `三级计划示例：${section.name}`,
      creator: '系统管理员',
      createdAt,
      updatedBy: '系统管理员',
      updatedAt: createdAt,
    }
    const children = section.children.map((activityName, childIndex): Level3Activity => {
      const planEndDate = addCalendarDays(sectionEndDate, -(section.children.length - childIndex - 1) * 7)
      const planStartDate = addCalendarDays(planEndDate, -4)
      const completed = childIndex < Math.min(2, section.children.length)
      const progressing = !completed && childIndex === Math.min(2, section.children.length - 1)
      return {
        id: `level3-mock-${sectionIndex + 1}-${childIndex + 1}`,
        parentId,
        order: childIndex,
        activityName,
        responsible: owner.name,
        responsibleDepartment: owner.department,
        planStartDate,
        planEndDate,
        actualStartDate: completed || progressing ? planStartDate : '',
        actualEndDate: completed ? planEndDate : '',
        milestoneId: milestone?.id || '',
        milestoneName: milestone?.name || '',
        milestonePlanEndDate: milestone?.planEndDate || sectionEndDate,
        status: completed ? '已完成' : progressing ? '进行中' : '待启动',
        risk: childIndex === 2 ? '中' : childIndex === 4 ? '低' : '无',
        remark: childIndex === 0 ? '示例数据，可直接在表格中维护执行信息' : '',
        creator: '系统管理员',
        createdAt,
        updatedBy: '系统管理员',
        updatedAt: createdAt,
      }
    })
    return [parent, ...children]
  })
}

const getActivityNumber = (activities: Level3Activity[], activityId: string) => (
  numberLevel3Activities(activities).find(activity => activity.id === activityId)?.number || ''
)

const buildFieldChanges = (
  previous: Level3Activity,
  next: Level3Activity,
): Level3FieldChange[] => Object.entries(FIELD_LABELS).flatMap(([field, label]) => {
  const before = String(previous[field as keyof Level3Activity] ?? '')
  const after = String(next[field as keyof Level3Activity] ?? '')
  return before === after ? [] : [{ field, label: label || field, before, after }]
})

const isValidActualDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const isValidWorkflowStatus = (value: unknown): value is Level3Activity['status'] => (
  typeof value === 'string' && LEVEL3_ACTIVITY_STATUSES.includes(value as Level3Activity['status'])
)

const isValidWorkflowRisk = (value: unknown): value is Level3Activity['risk'] => (
  typeof value === 'string' && LEVEL3_ACTIVITY_RISKS.includes(value as Level3Activity['risk'])
)

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
)

const sanitizeActualOverridesByScope = (value: unknown): Record<string, Level3ActualDateOverrideMap> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([scopeKey, activityMap]) => {
    if (!scopeKey || !activityMap || typeof activityMap !== 'object' || Array.isArray(activityMap)) return []
    const valid = Object.fromEntries(Object.entries(activityMap).flatMap(([activityId, record]) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return []
      const item = record as Record<string, unknown>
      if (
        activityId !== item.activityId || !isNonEmptyString(item.activityId)
        || typeof item.actualStartDate !== 'string' || typeof item.actualEndDate !== 'string'
        || (item.actualStartDate && !isValidActualDate(item.actualStartDate))
        || (item.actualEndDate && !isValidActualDate(item.actualEndDate))
        || (item.actualStartDate && item.actualEndDate && item.actualStartDate > item.actualEndDate)
        || !isNonEmptyString(item.detachedBy) || !isNonEmptyString(item.detachedAt)
      ) return []
      return [[activityId, { activityId, actualStartDate: item.actualStartDate, actualEndDate: item.actualEndDate, detachedBy: item.detachedBy, detachedAt: item.detachedAt }]]
    }))
    return Object.keys(valid).length ? [[scopeKey, valid]] : []
  }))
}

const sanitizeWorkflowOverridesByScope = (value: unknown): Record<string, Level3WorkflowOverrideMap> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([scopeKey, activityMap]) => {
    if (!scopeKey || !activityMap || typeof activityMap !== 'object' || Array.isArray(activityMap)) return []
    const valid = Object.fromEntries(Object.entries(activityMap).flatMap(([activityId, record]) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return []
      const item = record as Record<string, unknown>
      if (activityId !== item.activityId || !isNonEmptyString(item.activityId) || !isNonEmptyString(item.detachedBy) || !isNonEmptyString(item.detachedAt)) return []
      const status = isValidWorkflowStatus(item.status) ? item.status : undefined
      const risk = isValidWorkflowRisk(item.risk) ? item.risk : undefined
      if (status === undefined && risk === undefined) return []
      return [[activityId, { activityId, ...(status !== undefined ? { status } : {}), ...(risk !== undefined ? { risk } : {}), detachedBy: item.detachedBy, detachedAt: item.detachedAt }]]
    }))
    return Object.keys(valid).length ? [[scopeKey, valid]] : []
  }))
}

const safeStorage: StateStorage = {
  getItem(name) {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(name)
    } catch (error) {
      console.error(`Failed to read ${LEVEL3_PLAN_STORAGE_KEY}.`, error)
      return null
    }
  },
  setItem(name, value) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      console.error(`Failed to persist ${LEVEL3_PLAN_STORAGE_KEY}.`, error)
    }
  },
  removeItem(name) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(name)
    } catch (error) {
      console.error(`Failed to remove ${LEVEL3_PLAN_STORAGE_KEY}.`, error)
    }
  },
}

interface Level3PlanState {
  activitiesByScope: Record<string, Level3Activity[]>
  historyByScope: Record<string, Level3ChangeLog[]>
  collapsedIdsByScope: Record<string, string[]>
  columnSettingsByScope: Record<string, SortableColumnSettingsValue<Level3ColumnKey>>
  actualOverridesByScope: Record<string, Level3ActualDateOverrideMap>
  workflowOverridesByScope: Record<string, Level3WorkflowOverrideMap>
}

interface Level3PlanActions {
  getScopeData: (scopeKey: string) => Level3ScopeData
  ensureScopeMockData: (scopeKey: string, milestones: Level3Milestone[]) => void
  initializeScopeFromTemplate: (scopeKey: string, activities: Level3Activity[]) => boolean
  createActivity: (scopeKey: string, activity: Level3Activity, actor: string) => boolean
  updateActivity: (
    scopeKey: string,
    activityId: string,
    patch: Partial<Level3Activity>,
    actor: string,
  ) => boolean
  updateFollowActualDates: (
    sourceScopeKey: string,
    selectedScopeKey: string,
    activityId: string,
    patch: Pick<Partial<Level3Activity>, 'actualStartDate' | 'actualEndDate'>,
    actor: string,
  ) => boolean
  updateFollowWorkflowFields: (
    sourceScopeKey: string,
    selectedScopeKey: string,
    activityId: string,
    patch: Pick<Partial<Level3Activity>, 'status' | 'risk'>,
    actor: string,
  ) => boolean
  moveActivity: (
    scopeKey: string,
    activeId: string,
    overId: string,
    context: Level3PermissionContext,
    readOnly: boolean,
  ) => Level3MoveResult
  deleteActivity: (scopeKey: string, activityId: string, actor: string) => boolean
  forkFollowScope: (sourceScopeKey: string, targetScopeKey: string) => boolean
  setCollapsedIds: (scopeKey: string, collapsedIds: string[]) => void
  setColumnSettings: (
    scopeKey: string,
    value: SortableColumnSettingsValue<Level3ColumnKey>,
  ) => void
}

const initialState: Level3PlanState = {
  activitiesByScope: {},
  historyByScope: {},
  collapsedIdsByScope: {},
  columnSettingsByScope: {},
  actualOverridesByScope: {},
  workflowOverridesByScope: {},
}

const parsePersistedTimestamp = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{3})?$/.test(value)) return null
  const timestamp = Date.parse(`${value.replace(' ', 'T')}+08:00`)
  return Number.isFinite(timestamp) ? timestamp : null
}

const rebaseHistoryClock = (state: Partial<Level3PlanState>) => {
  let maximum = lastFormattedTimestamp
  const consider = (value: unknown) => {
    const timestamp = parsePersistedTimestamp(value)
    if (timestamp !== null) maximum = Math.max(maximum, timestamp)
  }
  Object.values(state.historyByScope || {}).flat().forEach(log => consider(log.occurredAt))
  for (const overrideMaps of [state.actualOverridesByScope, state.workflowOverridesByScope]) {
    Object.values(overrideMaps || {}).forEach(activityMap => {
      Object.values(activityMap || {}).forEach(override => consider((override as { detachedAt?: unknown } | undefined)?.detachedAt))
    })
  }
  lastFormattedTimestamp = maximum
}

const hasMaterializableScopeData = (state: Level3PlanState, scopeKey: string) => {
  const columnSettings = state.columnSettingsByScope[scopeKey]
  return (state.activitiesByScope[scopeKey]?.length || 0) > 0
    || (state.historyByScope[scopeKey]?.length || 0) > 0
    || (state.collapsedIdsByScope[scopeKey]?.length || 0) > 0
    || (Array.isArray(columnSettings?.order) && columnSettings.order.length > 0)
    || (Array.isArray(columnSettings?.visible) && columnSettings.visible.length > 0)
}

export const useLevel3PlanStore = create<Level3PlanState & Level3PlanActions>()(persist(
  (set, get) => ({
    ...initialState,
    ensureScopeMockData: (scopeKey, milestones) => set(state => {
      if (!scopeKey || Object.prototype.hasOwnProperty.call(state.activitiesByScope, scopeKey)) return state
      return {
        activitiesByScope: {
          ...state.activitiesByScope,
          [scopeKey]: buildLevel3MockActivities(milestones),
        },
      }
    }),
    initializeScopeFromTemplate: (scopeKey, activities) => {
      if (!scopeKey) return false
      let initialized = false
      set(state => {
        if (Object.prototype.hasOwnProperty.call(state.activitiesByScope, scopeKey)) return state
        initialized = true
        return {
          activitiesByScope: {
            ...state.activitiesByScope,
            [scopeKey]: cloneActivities(activities),
          },
        }
      })
      return initialized
    },
    getScopeData: (scopeKey) => ({
      activities: cloneActivities(get().activitiesByScope[scopeKey] || []),
      history: cloneHistory(get().historyByScope[scopeKey] || []),
      collapsedIds: [...(get().collapsedIdsByScope[scopeKey] || [])],
      columnSettings: get().columnSettingsByScope[scopeKey]
        ? {
            order: [...get().columnSettingsByScope[scopeKey].order],
            visible: [...get().columnSettingsByScope[scopeKey].visible],
          }
        : { order: [...DEFAULT_COLUMN_SETTINGS.order], visible: [...DEFAULT_COLUMN_SETTINGS.visible] },
    }),
    createActivity: (scopeKey, activity, actor) => {
      if (!scopeKey || !activity.id || !actor) return false
      let created = false
      set(state => {
        const previousActivities = state.activitiesByScope[scopeKey] || []
        if (previousActivities.some(item => item.id === activity.id)) return state
        const parentSnapshot = getParentHistorySnapshot(activity, previousActivities)
        if (!parentSnapshot) return state
        const siblings = previousActivities.filter(item => item.parentId === activity.parentId)
        const nextActivity = { ...activity, order: siblings.length }
        const nextActivities = [...previousActivities.map(item => ({ ...item })), nextActivity]
        const log: Level3ChangeLog = {
          id: createId('level3-log'),
          action: activity.parentId ? 'create-child' : 'create-parent',
          actor,
          occurredAt: nextActivity.createdAt || formatNow(),
          activityId: nextActivity.id,
          activityName: nextActivity.activityName,
          activityNumber: getActivityNumber(nextActivities, nextActivity.id),
          summary: activity.parentId ? '新增二级活动' : '新增一级活动',
          changes: [],
          ...parentSnapshot,
        }
        created = true
        return {
          activitiesByScope: { ...state.activitiesByScope, [scopeKey]: nextActivities },
          historyByScope: {
            ...state.historyByScope,
            [scopeKey]: [log, ...(state.historyByScope[scopeKey] || [])],
          },
        }
      })
      return created
    },
    updateActivity: (scopeKey, activityId, patch, actor) => {
      if (!scopeKey || !activityId || !actor) return false
      let updated = false
      set(state => {
        const previousActivities = state.activitiesByScope[scopeKey] || []
        const previousActivity = previousActivities.find(activity => activity.id === activityId)
        if (!previousActivity) return state
        const parentSnapshot = getParentHistorySnapshot(previousActivity, previousActivities)
        if (!parentSnapshot) return state
        const nextActivity: Level3Activity = {
          ...previousActivity,
          ...patch,
          id: previousActivity.id,
          parentId: previousActivity.parentId,
          order: previousActivity.order,
          creator: previousActivity.creator,
          createdAt: previousActivity.createdAt,
          updatedBy: actor,
          updatedAt: formatNow(),
        }
        const changes = buildFieldChanges(previousActivity, nextActivity)
        if (changes.length === 0) return state
        const nextActivities = previousActivities.map(activity => (
          activity.id === activityId ? nextActivity : { ...activity }
        ))
        const log: Level3ChangeLog = {
          id: createId('level3-log'),
          action: 'edit',
          actor,
          occurredAt: nextActivity.updatedAt,
          activityId,
          activityName: nextActivity.activityName,
          activityNumber: getActivityNumber(nextActivities, activityId),
          summary: `编辑活动：${changes.map(change => change.label).join('、')}`,
          changes,
          ...parentSnapshot,
        }
        updated = true
        return {
          activitiesByScope: { ...state.activitiesByScope, [scopeKey]: nextActivities },
          historyByScope: {
            ...state.historyByScope,
            [scopeKey]: [log, ...(state.historyByScope[scopeKey] || [])],
          },
        }
      })
      return updated
    },
    updateFollowActualDates: (sourceScopeKey, selectedScopeKey, activityId, patch, actor) => {
      if (!sourceScopeKey || !selectedScopeKey || !activityId || !actor) return false
      let updated = false
      set(state => {
        const sourceActivities = state.activitiesByScope[sourceScopeKey] || []
        const currentOverrides = state.actualOverridesByScope[selectedScopeKey] || {}
        const displayedActivities = mergeLevel3ActualDateOverrides(sourceActivities, currentOverrides)
        const previousActivity = displayedActivities.find(activity => activity.id === activityId)
        if (!previousActivity) return state
        const parentSnapshot = getParentHistorySnapshot(previousActivity, displayedActivities)
        if (!parentSnapshot) return state
        const nextOverride = createLevel3ActualDateOverride(
          previousActivity,
          currentOverrides[activityId],
          patch,
          actor,
          formatNow(),
        )
        if (
          (nextOverride.actualStartDate && !isValidActualDate(nextOverride.actualStartDate))
          || (nextOverride.actualEndDate && !isValidActualDate(nextOverride.actualEndDate))
        ) return state
        if (
          nextOverride.actualStartDate
          && nextOverride.actualEndDate
          && nextOverride.actualStartDate > nextOverride.actualEndDate
        ) return state
        const nextOverrides = { ...currentOverrides, [activityId]: nextOverride }
        const nextActivities = mergeLevel3ActualDateOverrides(sourceActivities, nextOverrides)
        const nextActivity = nextActivities.find(activity => activity.id === activityId)
        if (!nextActivity) return state
        const changes = buildFieldChanges(previousActivity, nextActivity)
        if (changes.length === 0) return state
        const log: Level3ChangeLog = {
          id: createId('level3-log'),
          action: 'edit',
          actor,
          occurredAt: nextOverride.detachedAt,
          activityId,
          activityName: nextActivity.activityName,
          activityNumber: getActivityNumber(nextActivities, activityId),
          summary: `编辑活动：${changes.map(change => change.label).join('、')}`,
          changes,
          ...parentSnapshot,
        }
        updated = true
        return {
          actualOverridesByScope: {
            ...state.actualOverridesByScope,
            [selectedScopeKey]: nextOverrides,
          },
          historyByScope: {
            ...state.historyByScope,
            [selectedScopeKey]: [log, ...(state.historyByScope[selectedScopeKey] || [])],
          },
        }
      })
      return updated
    },
    updateFollowWorkflowFields: (sourceScopeKey, selectedScopeKey, activityId, patch, actor) => {
      if (!sourceScopeKey || !selectedScopeKey || sourceScopeKey === selectedScopeKey || !activityId || !actor) return false
      if (
        (patch.status !== undefined && !isValidWorkflowStatus(patch.status))
        || (patch.risk !== undefined && !isValidWorkflowRisk(patch.risk))
        || (patch.status === undefined && patch.risk === undefined)
      ) return false
      let updated = false
      set(state => {
        const sourceActivities = state.activitiesByScope[sourceScopeKey] || []
        const actualOverrides = state.actualOverridesByScope[selectedScopeKey] || {}
        const currentOverrides = state.workflowOverridesByScope[selectedScopeKey] || {}
        const displayedActivities = mergeLevel3WorkflowOverrides(
          mergeLevel3ActualDateOverrides(sourceActivities, actualOverrides),
          currentOverrides,
        )
        const previousActivity = displayedActivities.find(activity => activity.id === activityId)
        if (!previousActivity || !previousActivity.parentId) return state
        const parentSnapshot = getParentHistorySnapshot(previousActivity, displayedActivities)
        if (!parentSnapshot) return state
        const nextOverride = createLevel3WorkflowOverride(
          previousActivity,
          currentOverrides[activityId],
          patch,
          actor,
          formatNow(),
        )
        const nextOverrides = { ...currentOverrides, [activityId]: nextOverride }
        const nextActivities = mergeLevel3WorkflowOverrides(
          mergeLevel3ActualDateOverrides(sourceActivities, actualOverrides),
          nextOverrides,
        )
        const nextActivity = nextActivities.find(activity => activity.id === activityId)
        if (!nextActivity) return state
        const changes = buildFieldChanges(previousActivity, nextActivity)
          .filter(change => change.field === 'status' || change.field === 'risk')
        if (changes.length === 0) return state
        const log: Level3ChangeLog = {
          id: createId('level3-log'),
          action: 'edit',
          actor,
          occurredAt: nextOverride.detachedAt,
          activityId,
          activityName: nextActivity.activityName,
          activityNumber: getActivityNumber(nextActivities, activityId),
          summary: `编辑活动：${changes.map(change => change.label).join('、')}`,
          changes,
          ...parentSnapshot,
        }
        updated = true
        return {
          workflowOverridesByScope: {
            ...state.workflowOverridesByScope,
            [selectedScopeKey]: nextOverrides,
          },
          historyByScope: {
            ...state.historyByScope,
            [selectedScopeKey]: [log, ...(state.historyByScope[selectedScopeKey] || [])],
          },
        }
      })
      return updated
    },
    moveActivity: (scopeKey, activeId, overId, context, readOnly) => {
      const previousActivities = get().activitiesByScope[scopeKey] || []
      const permission = getLevel3MovePermission(activeId, overId, previousActivities, context, readOnly)
      if (!permission.allowed) {
        return { ok: false, activities: cloneActivities(previousActivities), reason: permission.reason }
      }
      const beforeNumber = getActivityNumber(previousActivities, activeId)
      const result = moveLevel3Activity(previousActivities, activeId, overId)
      if (!result.ok) return result
      if (!result.changed) return result
      const previousActivity = previousActivities.find(activity => activity.id === activeId)
      const movedActivity = result.activities.find(activity => activity.id === activeId)
      if (!previousActivity || !movedActivity) return { ok: false, activities: cloneActivities(previousActivities), reason: '拖动活动不存在' }
      const afterNumber = getActivityNumber(result.activities, activeId)
      const sourceParent = getParentHistorySnapshot(previousActivity, previousActivities) || {}
      const targetParent = getParentHistorySnapshot(movedActivity, result.activities) || {}
      const log: Level3ChangeLog = {
        id: createId('level3-log'),
        action: 'move',
        actor: context.currentUser,
        occurredAt: formatNow(),
        activityId: activeId,
        activityName: movedActivity.activityName,
        activityNumber: afterNumber,
        summary: `拖动活动：${beforeNumber || '—'} → ${afterNumber || '—'}`,
        changes: [
          ...(sourceParent.parentActivityId || targetParent.parentActivityId ? [{
            field: 'parentId',
            label: '所属一级活动',
            before: sourceParent.parentActivityName || '—',
            after: targetParent.parentActivityName || '—',
          }] : []),
          {
            field: 'number',
            label: '序号',
            before: beforeNumber,
            after: afterNumber,
          },
        ],
        ...(sourceParent.parentActivityId ? {
          sourceParentActivityId: sourceParent.parentActivityId,
          sourceParentActivityName: sourceParent.parentActivityName,
        } : {}),
        ...(targetParent.parentActivityId ? {
          targetParentActivityId: targetParent.parentActivityId,
          targetParentActivityName: targetParent.parentActivityName,
        } : {}),
      }
      set(state => ({
        activitiesByScope: { ...state.activitiesByScope, [scopeKey]: result.activities },
        historyByScope: {
          ...state.historyByScope,
          [scopeKey]: [log, ...(state.historyByScope[scopeKey] || [])],
        },
      }))
      return result
    },
    deleteActivity: (scopeKey, activityId, actor) => {
      if (!scopeKey || !activityId || !actor) return false
      const previousActivities = get().activitiesByScope[scopeKey] || []
      const activity = previousActivities.find(item => item.id === activityId)
      if (!activity) return false
      const parentSnapshot = getParentHistorySnapshot(activity, previousActivities)
      if (!parentSnapshot) return false
      const activityNumber = getActivityNumber(previousActivities, activityId)
      const result = deleteLevel3ActivityTree(previousActivities, activityId)
      if (!result.ok) return false
      const deletedChildCount = result.deletedActivities.filter(item => item.parentId === activityId).length
      const log: Level3ChangeLog = {
        id: createId('level3-log'),
        action: 'delete',
        actor,
        occurredAt: formatNow(),
        activityId,
        activityName: activity.activityName,
        activityNumber,
        summary: activity.parentId
          ? '删除二级活动'
          : `删除一级活动${deletedChildCount > 0 ? `（含 ${deletedChildCount} 个二级活动）` : ''}`,
        changes: [],
        ...parentSnapshot,
      }
      set(state => ({
        activitiesByScope: { ...state.activitiesByScope, [scopeKey]: result.activities },
        historyByScope: { ...state.historyByScope, [scopeKey]: [log, ...(state.historyByScope[scopeKey] || [])] },
        collapsedIdsByScope: {
          ...state.collapsedIdsByScope,
          [scopeKey]: (state.collapsedIdsByScope[scopeKey] || []).filter(id => id !== activityId),
        },
      }))
      return true
    },
    forkFollowScope: (sourceScopeKey, targetScopeKey) => {
      if (!sourceScopeKey || !targetScopeKey || sourceScopeKey === targetScopeKey) return false
      const state = get()
      const hasSource = hasMaterializableScopeData(state, sourceScopeKey)
      const hasTarget = hasMaterializableScopeData(state, targetScopeKey)
      if (!hasSource && !hasTarget) return true
      const source: Level3ScopeData = {
        activities: cloneActivities(state.activitiesByScope[sourceScopeKey] || []),
        history: cloneHistory(state.historyByScope[sourceScopeKey] || []),
        collapsedIds: [...(state.collapsedIdsByScope[sourceScopeKey] || [])],
        columnSettings: state.columnSettingsByScope[sourceScopeKey]
          ? {
              order: [...state.columnSettingsByScope[sourceScopeKey].order],
              visible: [...state.columnSettingsByScope[sourceScopeKey].visible],
            }
          : { order: [...DEFAULT_COLUMN_SETTINGS.order], visible: [...DEFAULT_COLUMN_SETTINGS.visible] },
      }
      const target: Level3ScopeData | undefined = hasTarget ? {
        activities: cloneActivities(state.activitiesByScope[targetScopeKey] || []),
        history: cloneHistory(state.historyByScope[targetScopeKey] || []),
        collapsedIds: [...(state.collapsedIdsByScope[targetScopeKey] || [])],
        columnSettings: state.columnSettingsByScope[targetScopeKey]
          ? {
              order: [...state.columnSettingsByScope[targetScopeKey].order],
              visible: [...state.columnSettingsByScope[targetScopeKey].visible],
            }
          : { order: [...DEFAULT_COLUMN_SETTINGS.order], visible: [...DEFAULT_COLUMN_SETTINGS.visible] },
      } : undefined
      const forked = forkLevel3ScopeData(
        hasSource ? source : target!,
        target,
        state.actualOverridesByScope[targetScopeKey] || {},
        state.workflowOverridesByScope[targetScopeKey] || {},
      )
      const forkedActivityIds = new Set(forked.activities.map(activity => activity.id))
      set(current => {
        const orphanOverrides = Object.fromEntries(
          Object.entries(current.actualOverridesByScope[targetScopeKey] || {})
            .filter(([activityId]) => !forkedActivityIds.has(activityId)),
        )
        const nextOverridesByScope = Object.fromEntries(
          Object.entries(current.actualOverridesByScope).filter(([scopeKey]) => scopeKey !== targetScopeKey),
        )
        if (Object.keys(orphanOverrides).length > 0) {
          nextOverridesByScope[targetScopeKey] = orphanOverrides
        }
        const orphanWorkflowOverrides = Object.fromEntries(
          Object.entries(current.workflowOverridesByScope[targetScopeKey] || {})
            .filter(([activityId]) => !forkedActivityIds.has(activityId)),
        )
        const nextWorkflowOverridesByScope = Object.fromEntries(
          Object.entries(current.workflowOverridesByScope).filter(([scopeKey]) => scopeKey !== targetScopeKey),
        )
        if (Object.keys(orphanWorkflowOverrides).length > 0) {
          nextWorkflowOverridesByScope[targetScopeKey] = orphanWorkflowOverrides
        }
        return {
          activitiesByScope: { ...current.activitiesByScope, [targetScopeKey]: forked.activities },
          historyByScope: { ...current.historyByScope, [targetScopeKey]: forked.history },
          collapsedIdsByScope: { ...current.collapsedIdsByScope, [targetScopeKey]: forked.collapsedIds },
          columnSettingsByScope: { ...current.columnSettingsByScope, [targetScopeKey]: forked.columnSettings },
          actualOverridesByScope: nextOverridesByScope,
          workflowOverridesByScope: nextWorkflowOverridesByScope,
        }
      })
      return true
    },
    setCollapsedIds: (scopeKey, collapsedIds) => set(state => ({
      collapsedIdsByScope: {
        ...state.collapsedIdsByScope,
        [scopeKey]: [...new Set(collapsedIds)],
      },
    })),
    setColumnSettings: (scopeKey, value) => set(state => ({
      columnSettingsByScope: {
        ...state.columnSettingsByScope,
        [scopeKey]: { order: [...value.order], visible: [...value.visible] },
      },
    })),
  }),
  {
    name: LEVEL3_PLAN_STORAGE_KEY,
    version: LEVEL3_PLAN_STORE_VERSION,
    storage: createJSONStorage(() => safeStorage),
    partialize: state => ({
      activitiesByScope: state.activitiesByScope,
      historyByScope: state.historyByScope,
      collapsedIdsByScope: state.collapsedIdsByScope,
      columnSettingsByScope: state.columnSettingsByScope,
      actualOverridesByScope: state.actualOverridesByScope,
      workflowOverridesByScope: state.workflowOverridesByScope,
    }),
    migrate: (persistedState, version) => {
      if (!persistedState || typeof persistedState !== 'object') return initialState
      const legacyState = persistedState as Partial<Level3PlanState>
      if (version <= 1) {
        const migrated = {
          activitiesByScope: legacyState.activitiesByScope || {},
          historyByScope: legacyState.historyByScope || {},
          collapsedIdsByScope: legacyState.collapsedIdsByScope || {},
          columnSettingsByScope: legacyState.columnSettingsByScope || {},
          actualOverridesByScope: sanitizeActualOverridesByScope(legacyState.actualOverridesByScope),
          workflowOverridesByScope: {},
        }
        rebaseHistoryClock(migrated)
        return migrated
      }
      const migrated = {
        activitiesByScope: legacyState.activitiesByScope || {},
        historyByScope: legacyState.historyByScope || {},
        collapsedIdsByScope: legacyState.collapsedIdsByScope || {},
        columnSettingsByScope: legacyState.columnSettingsByScope || {},
        actualOverridesByScope: sanitizeActualOverridesByScope(legacyState.actualOverridesByScope),
        workflowOverridesByScope: version >= 3
          ? sanitizeWorkflowOverridesByScope(legacyState.workflowOverridesByScope)
          : {},
      }
      rebaseHistoryClock(migrated)
      return migrated
    },
    merge: (persistedState, currentState) => {
      const persisted = persistedState && typeof persistedState === 'object' && !Array.isArray(persistedState)
        ? persistedState as Partial<Level3PlanState>
        : {}
      const merged = {
        ...currentState,
        ...persisted,
        actualOverridesByScope: sanitizeActualOverridesByScope(persisted.actualOverridesByScope),
        workflowOverridesByScope: sanitizeWorkflowOverridesByScope(persisted.workflowOverridesByScope),
      }
      rebaseHistoryClock(merged)
      return merged
    },
  },
))
