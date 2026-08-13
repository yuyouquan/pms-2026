import {
  getMarketCurrentVersion,
  getMarketPlanVersionKey,
  getMarketVersions,
  type MarketCurrentVersionState,
  type MarketVersionsState,
  type PlanVersionLike,
} from '@/lib/marketRules'

export type TodoSource = 'plan' | 'transfer'
export type TodoStatus = 'pending' | 'completed'
export type TodoStatusFilter = 'all' | TodoStatus

export type WorkbenchTodoRoute =
  | {
    kind: 'plan'
    planLevel: 'level1' | 'level2'
    planKey: string
    versionId: string
    marketKey?: string
    tosType?: string
    tosTypeKey?: string
  }
  | {
    kind: 'transfer'
    applicationId: string
    view: 'entry' | 'review' | 'sqa-review' | 'detail'
  }

export interface WorkbenchTodo {
  id: string
  source: TodoSource
  title: string
  projectId: string
  projectName: string
  assignee: string
  dueDate: string
  generatedAt: string
  status: TodoStatus
  completedAt?: string
  market?: string
  tosType?: string
  sourceLabel?: string
  context?: string
  nodeLabel: string
  taskContent: string
  route: WorkbenchTodoRoute
}

export interface PlanTodoCandidate {
  id: string
  projectId: string
  projectName: string
  assignee: string
  dueDate: string
  generatedAt?: string
  completed: boolean
  completedAt?: string
  market?: string
  marketKey?: string
  tosType?: string
  tosTypeKey?: string
  sourceLabel?: string
  context?: string
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
  generatedAt?: string
  completed: boolean
  completedAt?: string
  title: string
  view: 'entry' | 'review' | 'sqa-review' | 'detail'
  sourceLabel?: string
  context?: string
}

export interface PlanTodoTaskLike {
  id?: string
  taskName?: string
  responsible?: string
  planEndDate?: string
  actualEndDate?: string
  generatedAt?: string
  status?: string
  progress?: number
}

export interface PlanTodoSource {
  projectId: string
  planLevel: 'level1' | 'level2'
  planKey: string
  planName?: string
  dimension?: {
    kind: 'market' | 'tos'
    value: string
    versionKey: string
  }
  tasks: readonly PlanTodoTaskLike[]
  versions: readonly PlanVersionLike[]
  currentVersionId: string
}

interface BuildPlanTodoCandidatesInput {
  projects: readonly {
    id: string
    name: string
    markets?: readonly string[]
    versionTypes?: readonly string[]
    versionType?: string
  }[]
  sources: readonly PlanTodoSource[]
}

function compareVersionNumber(left: PlanVersionLike, right: PlanVersionLike): number {
  const parts = (value: string) => value.replace(/^V/i, '').split('.').map(part => Number.parseInt(part, 10) || 0)
  const leftParts = parts(left.versionNo)
  const rightParts = parts(right.versionNo)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (delta) return delta
  }
  return 0
}

export function resolveVisiblePlanVersion(
  versions: readonly PlanVersionLike[],
  requestedVersionId: string | undefined,
  canViewDraft: boolean,
): string {
  const requested = versions.find(version => version.id === requestedVersionId)
  if (requested && (requested.status !== '修订中' || canViewDraft)) return requested.id
  const visibleVersions = versions.filter(version => version.status !== '修订中' || canViewDraft)
  const preferred = canViewDraft
    ? visibleVersions.find(version => version.status === '修订中')
    : undefined
  const latestPublished = visibleVersions
    .filter(version => version.status === '已发布')
    .sort((left, right) => compareVersionNumber(right, left))[0]
  return preferred?.id || latestPublished?.id || visibleVersions[0]?.id || ''
}

function resolvePlanTodoStatus(task: PlanTodoTaskLike): TodoStatus {
  if (task.status === '已完成' || Number(task.progress) >= 100) return 'completed'
  return 'pending'
}

export function buildPlanTodoCandidates({
  projects,
  sources,
}: BuildPlanTodoCandidatesInput): PlanTodoCandidate[] {
  const projectById = new Map(projects.map(project => [project.id, project]))
  return sources.flatMap(source => {
    const project = projectById.get(source.projectId)
    if (!project) return []
    if (source.dimension?.kind === 'market' && !project.markets?.includes(source.dimension.value)) return []
    if (source.dimension?.kind === 'tos') {
      const configuredTypes = new Set([...(project.versionTypes || []), project.versionType || ''].filter(Boolean))
      if (!configuredTypes.has(source.dimension.value)) return []
    }
    const versionId = resolveVisiblePlanVersion(source.versions, source.currentVersionId, true)
    const version = source.versions.find(item => item.id === versionId)
    if (!versionId || !version) return []
    const dimensionLabel = source.dimension?.kind === 'market'
      ? source.dimension.value
      : source.dimension?.kind === 'tos' ? `tOS ${source.dimension.value}` : ''
    const context = [dimensionLabel, `${version.versionNo} (${version.status})`].filter(Boolean).join(' · ')
    return source.tasks.map((task, index): PlanTodoCandidate => {
      const status = resolvePlanTodoStatus(task)
      const taskId = String(task.id || index + 1)
      const taskTitle = task.taskName || '未命名计划任务'
      const dimensionPrefix = source.dimension?.value ? `${source.dimension.value} · ` : ''
      return {
        id: `plan:${project.id}:${source.dimension?.kind || 'generic'}:${source.dimension?.value || 'default'}:${source.planLevel}:${source.planKey}:${taskId}`,
        projectId: project.id,
        projectName: project.name,
        assignee: task.responsible || '',
        dueDate: task.planEndDate || '',
        generatedAt: task.generatedAt,
        completed: status === 'completed',
        completedAt: task.actualEndDate || undefined,
        status,
        title: `${dimensionPrefix}${taskTitle}`,
        planLevel: source.planLevel,
        planKey: source.planKey,
        versionId,
        sourceLabel: source.planName || (source.planLevel === 'level1' ? '一级计划' : source.planKey),
        context,
        ...(source.dimension?.kind === 'market'
          ? { market: source.dimension.value, marketKey: source.dimension.versionKey }
          : {}),
        ...(source.dimension?.kind === 'tos'
          ? { tosType: source.dimension.value, tosTypeKey: source.dimension.versionKey }
          : {}),
      }
    })
  })
}

interface TransferApplicationLike {
  id: string
  projectId: string
  projectName: string
  status: string
  applicantId: string
  applicant: string
  plannedReviewDate?: string
  createdAt?: string
  updatedAt?: string
  remark?: string
  pipeline: { dataEntry: string; maintenanceReview: string; sqaReview: string }
  team: {
    maintenance: Array<{ id: string; name: string; role: string }>
    research: Array<{ id: string; name: string; role: string }>
  }
}

export function buildTransferTodoCandidates({
  applications,
  projects,
}: {
  applications: readonly TransferApplicationLike[]
  projects: readonly { id: string; name: string }[]
}): TransferTodoCandidate[] {
  return applications.flatMap(application => {
    if (application.status === 'cancelled') return []
    const project = projects.find(candidate => candidate.id === application.projectId || candidate.name === application.projectName)
    if (!project) return []
    const nodes = [
      {
        key: 'entry',
        state: application.pipeline.dataEntry,
        label: '转维资料录入',
        owner: { id: application.applicantId, name: application.applicant },
      },
      {
        key: 'review',
        state: application.pipeline.maintenanceReview,
        label: '转维维护审核',
        owner: application.team.maintenance.find(member => member.role === 'SPM'),
      },
      {
        key: 'sqa-review',
        state: application.pipeline.sqaReview,
        label: '转维 SQA 审核',
        owner: application.team.research.find(member => member.role === 'SQA'),
      },
    ] as const

    return nodes.flatMap(node => {
      if (node.state === 'not_started') return []
      const activeOwner = mapTransferOwnerToPmsUser(node.owner?.id, node.owner?.name)
      if (!activeOwner) return []
      const completed = node.state === 'success'
      return [{
        applicationId: `${application.id}:${node.key}`,
        id: application.id,
        projectId: project.id,
        projectName: project.name,
        activeOwner,
        dueDate: application.plannedReviewDate || '',
        generatedAt: application.createdAt,
        completed,
        completedAt: completed ? application.updatedAt : undefined,
        title: node.label,
        sourceLabel: node.label,
        context: application.remark || '',
        view: completed ? 'detail' as const : node.key,
      }]
    })
  })
}

export function filterTodoCandidatesByAccess({
  currentUser,
  planTodos,
  transferApplications,
  canViewPlan,
  canViewTransfer,
}: {
  currentUser: string
  planTodos: readonly PlanTodoCandidate[]
  transferApplications: readonly TransferTodoCandidate[]
  canViewPlan: (projectId: string, planLevel: 'level1' | 'level2') => boolean
  canViewTransfer: (projectId: string, view: TransferTodoCandidate['view']) => boolean
}): { planTodos: PlanTodoCandidate[]; transferApplications: TransferTodoCandidate[] } {
  if (!currentUser.trim()) return { planTodos: [], transferApplications: [] }
  const normalizedUser = currentUser.trim()
  return {
    planTodos: planTodos.filter(candidate => (
      candidate.assignee.trim() === normalizedUser
      && canViewPlan(candidate.projectId, candidate.planLevel)
    )),
    transferApplications: transferApplications.filter(candidate => (
      candidate.activeOwner.trim() === normalizedUser
      && canViewTransfer(candidate.projectId, candidate.view)
    )),
  }
}

export interface TodoFilters {
  search: string
  projectId: string
  source: TodoSource
  status: TodoStatusFilter
  generatedDateFrom: string
  generatedDateTo: string
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

function sortTodos(todos: WorkbenchTodo[]): WorkbenchTodo[] {
  return todos.sort((left, right) => {
    if (left.status !== right.status) return left.status === 'pending' ? -1 : 1
    const generatedDelta = toDateKey(right.generatedAt).localeCompare(toDateKey(left.generatedAt))
    if (generatedDelta) return generatedDelta

    const titleDelta = left.title.localeCompare(right.title, 'zh-CN')
    return titleDelta || left.id.localeCompare(right.id)
  })
}

export function aggregateWorkbenchTodos({
  currentUser,
  planTodos,
  transferApplications,
}: AggregateWorkbenchTodosInput): WorkbenchTodo[] {
  const normalizedUser = currentUser.trim()
  if (!normalizedUser) return []

  const planItems = planTodos
    .filter(candidate => candidate.assignee?.trim() === normalizedUser)
    .map((candidate): WorkbenchTodo => {
      const completed = Boolean(candidate.completed || candidate.completedAt || candidate.status === 'completed')
      const status: TodoStatus = completed ? 'completed' : 'pending'
      const nodeLabel = candidate.sourceLabel || (candidate.planLevel === 'level1' ? '一级计划' : candidate.planKey)
      const taskContent = candidate.context || ''
      return {
        id: candidate.id,
        source: 'plan',
        title: candidate.title || candidate.id,
        projectId: candidate.projectId || '',
        projectName: candidate.projectName || '',
        assignee: candidate.assignee,
        dueDate: toDateKey(candidate.dueDate),
        generatedAt: toDateKey(candidate.generatedAt),
        status,
        completedAt: toDateKey(candidate.completedAt) || undefined,
        market: candidate.market,
        tosType: candidate.tosType,
        sourceLabel: candidate.sourceLabel,
        context: candidate.context,
        nodeLabel,
        taskContent,
        route: {
          kind: 'plan',
          planLevel: candidate.planLevel === 'level2' ? 'level2' : 'level1',
          planKey: candidate.planKey || '',
          versionId: candidate.versionId || '',
          ...(candidate.marketKey ? { marketKey: candidate.marketKey } : {}),
          ...(candidate.tosType ? { tosType: candidate.tosType } : {}),
          ...(candidate.tosTypeKey ? { tosTypeKey: candidate.tosTypeKey } : {}),
        },
      }
    })

  const transferItems = transferApplications
    .filter(candidate => candidate.activeOwner?.trim() === normalizedUser)
    .map((candidate): WorkbenchTodo => {
      const applicationId = candidate.applicationId || candidate.id || ''
      const status: TodoStatus = candidate.completed ? 'completed' : 'pending'
      return {
        id: applicationId,
        source: 'transfer',
        title: candidate.title || applicationId,
        projectId: candidate.projectId || '',
        projectName: candidate.projectName || '',
        assignee: candidate.activeOwner,
        dueDate: toDateKey(candidate.dueDate),
        generatedAt: toDateKey(candidate.generatedAt),
        status,
        completedAt: toDateKey(candidate.completedAt) || undefined,
        sourceLabel: candidate.sourceLabel,
        context: candidate.context,
        nodeLabel: candidate.sourceLabel || '转维护',
        taskContent: candidate.context || '',
        route: {
          kind: 'transfer',
          applicationId,
          view: candidate.view || 'entry',
        },
      }
    })

  return sortTodos([...planItems, ...transferItems])
}

export function resolveWorkbenchDefaultSelection(
  todos: readonly Pick<WorkbenchTodo, 'source' | 'status'>[],
): { source: TodoSource; status: TodoStatusFilter } {
  for (const source of ['plan', 'transfer'] as const) {
    if (todos.some(todo => todo.source === source && todo.status === 'pending')) {
      return { source, status: 'pending' }
    }
  }
  return { source: 'plan', status: 'all' }
}

export function filterWorkbenchTodos(
  todos: readonly WorkbenchTodo[],
  filters: Partial<TodoFilters> = {},
): WorkbenchTodo[] {
  const search = (filters.search ?? '').trim().toLocaleLowerCase('zh-CN')
  const projectId = filters.projectId ?? ''
  const source = filters.source
  const status = filters.status ?? 'all'
  const generatedDateFrom = toDateKey(filters.generatedDateFrom)
  const generatedDateTo = toDateKey(filters.generatedDateTo)

  return todos.filter(todo => {
    if (source && todo.source !== source) return false
    if (status !== 'all' && todo.status !== status) return false
    if (projectId && todo.projectId !== projectId) return false
    if (search) {
      const haystack = `${todo.title} ${todo.projectName} ${todo.nodeLabel} ${todo.taskContent} ${todo.assignee}`.toLocaleLowerCase('zh-CN')
      if (!haystack.includes(search)) return false
    }
    const generatedAt = toDateKey(todo.generatedAt)
    if (generatedDateFrom && (!generatedAt || generatedAt < generatedDateFrom)) return false
    if (generatedDateTo && (!generatedAt || generatedAt > generatedDateTo)) return false
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
