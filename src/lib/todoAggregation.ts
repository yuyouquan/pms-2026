import {
  getMarketCurrentVersion,
  getMarketPlanVersionKey,
  getMarketVersions,
  type MarketCurrentVersionState,
  type MarketVersionsState,
  type PlanVersionLike,
} from '@/lib/marketRules'

export type TodoSource = 'plan' | 'transfer'
export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export type WorkbenchTodoRoute =
  | {
    kind: 'plan'
    planLevel: 'level1' | 'level2'
    planKey: string
    versionId: string
    marketKey?: string
  }
  | {
    kind: 'transfer'
    applicationId: string
    view: 'entry' | 'review' | 'sqa-review'
  }

export interface WorkbenchTodo {
  id: string
  source: TodoSource
  title: string
  projectId: string
  projectName: string
  assignee: string
  dueDate: string
  status: TodoStatus
  completedAt?: string
  market?: string
  route: WorkbenchTodoRoute
}

export interface PlanTodoCandidate {
  id: string
  projectId: string
  projectName: string
  assignee: string
  dueDate: string
  completed: boolean
  completedAt?: string
  market?: string
  marketKey?: string
  status?: TodoStatus
  title: string
  planLevel: 'level1' | 'level2'
  planKey: string
  versionId: string
}

export interface TransferTodoCandidate {
  applicationId: string
  /** Compatibility with the transfer store, whose application key is `id`. */
  id?: string
  projectId: string
  projectName: string
  activeOwner: string
  dueDate: string
  completed: boolean
  completedAt?: string
  title: string
  view: 'entry' | 'review' | 'sqa-review'
}

export interface TodoFilters {
  source: 'all' | TodoSource
  search: string
  projectId: string
  status: 'all' | TodoStatus
  dueDateFrom: string
  dueDateTo: string
}

export interface TodoSummary {
  total: number
  dueToday: number
  overdue: number
  completedThisWeek: number
}

interface AggregateWorkbenchTodosInput {
  currentUser: string
  today: string | Date
  planTodos: readonly PlanTodoCandidate[]
  transferApplications: readonly TransferTodoCandidate[]
}

/**
 * Identity bridge between the independent transfer-maintenance and PMS mock
 * user directories. Keys are authoritative transfer external user IDs; an
 * unmapped ID intentionally produces no PMS todo.
 */
export const TRANSFER_TO_PMS_USER_MAP: Readonly<Record<string, {
  transferUserName: string
  pmsUserName: string
}>> = {
  u001: { transferUserName: '张明辉', pmsUserName: '张三' },
  u002: { transferUserName: '李思源', pmsUserName: '李四' },
  u003: { transferUserName: '王建国', pmsUserName: '王五' },
  u004: { transferUserName: '赵丽华', pmsUserName: '赵六' },
  u005: { transferUserName: '孙伟强', pmsUserName: '孙七' },
  u006: { transferUserName: '周文博', pmsUserName: '周八' },
  u007: { transferUserName: '陈晓峰', pmsUserName: '李白' },
  u008: { transferUserName: '刘志远', pmsUserName: '杜甫' },
}

export function mapTransferOwnerToPmsUser(
  transferExternalUserId: string | undefined,
  transferExternalUserName: string | undefined,
): string | undefined {
  if (!transferExternalUserId || !transferExternalUserName) return undefined
  const identity = TRANSFER_TO_PMS_USER_MAP[transferExternalUserId]
  return identity?.transferUserName === transferExternalUserName
    ? identity.pmsUserName
    : undefined
}

interface ResolvePlanTodoNavigationInput {
  projectId: string
  projectMarkets: readonly string[]
  todoMarket?: string
  route: Extract<WorkbenchTodoRoute, { kind: 'plan' }>
  baseVersions: PlanVersionLike[]
  marketVersionsByKey: MarketVersionsState
  marketCurrentVersionByKey: MarketCurrentVersionState
  baseCurrentVersion: string
}

export type ResolvedPlanTodoNavigation =
  | {
    usesMarketVersion: true
    market: string
    marketKey: string
    versionId: string
  }
  | {
    usesMarketVersion: false
    versionId: string
  }

export function resolvePlanTodoNavigation({
  projectId,
  projectMarkets,
  todoMarket,
  route,
  baseVersions,
  marketVersionsByKey,
  marketCurrentVersionByKey,
  baseCurrentVersion,
}: ResolvePlanTodoNavigationInput): ResolvedPlanTodoNavigation | null {
  if (route.planLevel !== 'level1' || !route.marketKey) {
    const versionId = baseVersions.some(version => version.id === route.versionId)
      ? route.versionId
      : baseCurrentVersion
    return { usesMarketVersion: false, versionId }
  }

  const market = todoMarket?.trim() || ''
  const expectedMarketKey = getMarketPlanVersionKey(projectId, market)
  if (!market || !projectMarkets.includes(market) || route.marketKey !== expectedMarketKey) return null

  const marketVersions = getMarketVersions(marketVersionsByKey, projectId, market, baseVersions)
  const versionId = marketVersions.some(version => version.id === route.versionId)
    ? route.versionId
    : getMarketCurrentVersion(
      marketCurrentVersionByKey,
      projectId,
      market,
      marketVersions,
      baseCurrentVersion,
    )
  return {
    usesMarketVersion: true,
    market,
    marketKey: expectedMarketKey,
    versionId,
  }
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toDateKey(value: string | Date | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') {
    const dateKey = value.slice(0, 10)
    return DATE_KEY_PATTERN.test(dateKey) ? dateKey : ''
  }
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isOverdue(todo: WorkbenchTodo, today: string): boolean {
  return todo.status !== 'completed'
    && Boolean(toDateKey(todo.dueDate))
    && toDateKey(todo.dueDate) < today
}

function sortTodos(todos: WorkbenchTodo[], today: string): WorkbenchTodo[] {
  return todos.sort((left, right) => {
    const overdueDelta = Number(isOverdue(right, today)) - Number(isOverdue(left, today))
    if (overdueDelta) return overdueDelta

    const leftDue = toDateKey(left.dueDate)
    const rightDue = toDateKey(right.dueDate)
    if (leftDue && rightDue && leftDue !== rightDue) return leftDue.localeCompare(rightDue)
    if (leftDue !== rightDue) return leftDue ? -1 : 1

    const titleDelta = left.title.localeCompare(right.title, 'zh-CN')
    return titleDelta || left.id.localeCompare(right.id)
  })
}

export function aggregateWorkbenchTodos({
  currentUser,
  today,
  planTodos,
  transferApplications,
}: AggregateWorkbenchTodosInput): WorkbenchTodo[] {
  const normalizedUser = currentUser.trim()

  const planItems = planTodos
    .filter(candidate => candidate.assignee?.trim() === normalizedUser)
    .map((candidate): WorkbenchTodo => {
      const completed = Boolean(candidate.completed || candidate.completedAt || candidate.status === 'completed')
      const status: TodoStatus = completed
        ? 'completed'
        : candidate.status === 'in_progress' ? 'in_progress' : 'pending'
      return {
        id: candidate.id,
        source: 'plan',
        title: candidate.title || candidate.id,
        projectId: candidate.projectId || '',
        projectName: candidate.projectName || '',
        assignee: candidate.assignee,
        dueDate: toDateKey(candidate.dueDate),
        status,
        completedAt: toDateKey(candidate.completedAt) || undefined,
        market: candidate.market,
        route: {
          kind: 'plan',
          planLevel: candidate.planLevel === 'level2' ? 'level2' : 'level1',
          planKey: candidate.planKey || '',
          versionId: candidate.versionId || '',
          ...(candidate.marketKey ? { marketKey: candidate.marketKey } : {}),
        },
      }
    })

  const transferItems = transferApplications
    .filter(candidate => !candidate.completed && candidate.activeOwner?.trim() === normalizedUser)
    .map((candidate): WorkbenchTodo => {
      const applicationId = candidate.applicationId || candidate.id || ''
      return {
        id: applicationId,
        source: 'transfer',
        title: candidate.title || applicationId,
        projectId: candidate.projectId || '',
        projectName: candidate.projectName || '',
        assignee: candidate.activeOwner,
        dueDate: toDateKey(candidate.dueDate),
        status: 'in_progress',
        completedAt: undefined,
        route: {
          kind: 'transfer',
          applicationId,
          view: candidate.view || 'entry',
        },
      }
    })

  return sortTodos([...planItems, ...transferItems], toDateKey(today))
}

export function filterWorkbenchTodos(
  todos: readonly WorkbenchTodo[],
  filters: Partial<TodoFilters> = {},
): WorkbenchTodo[] {
  const source = filters.source ?? 'all'
  const search = (filters.search ?? '').trim().toLocaleLowerCase('zh-CN')
  const projectId = filters.projectId ?? ''
  const status = filters.status ?? 'all'
  const dueDateFrom = toDateKey(filters.dueDateFrom)
  const dueDateTo = toDateKey(filters.dueDateTo)

  return todos.filter(todo => {
    if (source !== 'all' && todo.source !== source) return false
    if (projectId && todo.projectId !== projectId) return false
    if (status !== 'all' && todo.status !== status) return false
    if (search) {
      const haystack = `${todo.title} ${todo.projectName}`.toLocaleLowerCase('zh-CN')
      if (!haystack.includes(search)) return false
    }
    const dueDate = toDateKey(todo.dueDate)
    if (dueDateFrom && (!dueDate || dueDate < dueDateFrom)) return false
    if (dueDateTo && (!dueDate || dueDate > dueDateTo)) return false
    return true
  })
}

function startOfNaturalWeek(today: string): string {
  const [year, month, day] = today.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const daysSinceMonday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - daysSinceMonday)
  return toDateKey(date)
}

function endOfNaturalWeek(today: string): string {
  const [year, month, day] = startOfNaturalWeek(today).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + 6)
  return toDateKey(date)
}

export function summarizeWorkbenchTodos(
  todos: readonly WorkbenchTodo[],
  todayValue: string | Date,
): TodoSummary {
  const today = toDateKey(todayValue)
  const weekStart = startOfNaturalWeek(today)
  const weekEnd = endOfNaturalWeek(today)

  return todos.reduce<TodoSummary>((summary, todo) => {
    summary.total += 1
    const dueDate = toDateKey(todo.dueDate)
    if (todo.status !== 'completed' && dueDate === today) summary.dueToday += 1
    if (isOverdue(todo, today)) summary.overdue += 1
    const completedAt = toDateKey(todo.completedAt)
    if (
      todo.status === 'completed'
      && completedAt
      && completedAt >= weekStart
      && completedAt <= weekEnd
    ) {
      summary.completedThisWeek += 1
    }
    return summary
  }, { total: 0, dueToday: 0, overdue: 0, completedThisWeek: 0 })
}
