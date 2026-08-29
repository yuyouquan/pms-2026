import { normalizeMrTemplateActivities, numberMrTemplateActivities } from '@/lib/mrTemplateRules'
import type {
  CreateTosMrVersionInput,
  MrCellError,
  MrGroupedColumn,
  MrLeafColumn,
  MrPermissionInput,
  MrPermissionResult,
  MrTemplateActivity,
  MrTosDateBounds,
  MrTosVerticalRow,
  TosMrCandidateInput,
  TosMrVersionCandidate,
  TosMrVersionInstance,
} from '@/types/mrVersionPlan'

const TOS_STAGES = new Set(['上市迭代阶段', '维护阶段'])
const COLLECT_START = '修改点收集开始时间'
const OTA_RELEASE = 'OTA开放验证&部署'
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const EXPLICIT_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/
const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function trim(value: string | undefined | null): string {
  return value?.trim() ?? ''
}

function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function formatShanghaiDate(value: Date): string {
  const parts = new Map(SHANGHAI_DATE_FORMATTER.formatToParts(value).map(part => [part.type, part.value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}

export function normalizeMrBusinessDate(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : formatShanghaiDate(value)
  if (typeof value !== 'string') return ''
  const text = value.trim()
  if (isValidDateOnly(text)) return text
  if (!EXPLICIT_ISO_PATTERN.test(text) || !isValidDateOnly(text.slice(0, 10))) return ''
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? '' : formatShanghaiDate(parsed)
}

function parseTosVersion(value: string): number[] | undefined {
  const normalized = trim(value).replace(/^tos/i, '')
  if (!/^\d+(?:\.\d+)*$/.test(normalized)) return undefined
  const segments = normalized.split('.').map(Number)
  return segments.every(segment => Number.isSafeInteger(segment)) ? segments : undefined
}

function sortByOrder<T extends { order?: number }>(rows: readonly T[]): T[] {
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const leftOrder = Number.isFinite(left.row.order) ? left.row.order! : Number.MAX_SAFE_INTEGER
    const rightOrder = Number.isFinite(right.row.order) ? right.row.order! : Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder || left.index - right.index
  }).map(({ row }) => row)
}

function parsePublishedVersion(value: string): number | undefined {
  const match = /^V([1-9]\d*)$/.exec(value)
  const parsed = match ? Number(match[1]) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

function escapedIdentity(parentName: string, activityName = ''): string {
  return `${encodeURIComponent(parentName)}::${encodeURIComponent(activityName)}`
}

export function compareTosVersionNumbers(left: string, right: string): number {
  const leftParts = parseTosVersion(left)
  const rightParts = parseTosVersion(right)
  if (!leftParts || !rightParts) {
    if (leftParts) return -1
    if (rightParts) return 1
    return left.localeCompare(right, 'zh-CN')
  }
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function sortTosVersionNumbers(values: readonly string[]): string[] {
  return values.map((value, index) => ({ value, index }))
    .sort((left, right) => compareTosVersionNumbers(left.value, right.value) || left.index - right.index)
    .map(({ value }) => value)
}

export function selectTosMrVersionCandidates(input: TosMrCandidateInput): TosMrVersionCandidate[] {
  const latest = input.versions.reduce<{ id: string; number: number } | undefined>((current, version) => {
    const number = version.status === '已发布' ? parsePublishedVersion(version.versionNo) : undefined
    return number !== undefined && (!current || number > current.number) ? { id: version.id, number } : current
  }, undefined)
  if (!latest) return []

  const snapshot = input.getSnapshot(latest.id)
  if (!snapshot) return []
  const parents = sortByOrder(snapshot.filter(task => task.parentId == null && TOS_STAGES.has(trim(task.taskName))))
  const used = new Set(input.usedVersions.map(value => trim(value)))
  const seen = new Set<string>()
  const candidates: TosMrVersionCandidate[] = []

  parents.forEach(parent => {
    const parentIds = new Set([trim(parent.id), trim(parent.stableId)].filter(Boolean))
    sortByOrder(snapshot.filter(task => parentIds.has(trim(task.parentId)))).forEach(child => {
      const value = trim(child.taskName)
      if (!value || seen.has(value)) return
      seen.add(value)
      const planStartDate = normalizeMrBusinessDate(child.planStartDate)
      const planEndDate = normalizeMrBusinessDate(child.planEndDate)
      const disabled = used.has(value) || !planStartDate || !planEndDate
      candidates.push({
        value,
        label: value,
        planStartDate,
        planEndDate,
        disabled,
        ...(disabled ? { reason: used.has(value) ? '该tOS版本号已添加' : '请先完善一级计划中的计划开始时间和计划完成时间' } : {}),
      })
    })
  })

  return candidates.map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => compareTosVersionNumbers(left.candidate.value, right.candidate.value) || left.index - right.index)
    .map(({ candidate }) => candidate)
}

export function validateTosMrInstanceDates(instance: TosMrVersionInstance, bounds: MrTosDateBounds): MrCellError[] {
  const rowKey = `${instance.projectId}::${instance.tosVersion}`
  const startBound = normalizeMrBusinessDate(bounds.planStartDate)
  const endBound = normalizeMrBusinessDate(bounds.planEndDate)
  const errors: MrCellError[] = []

  instance.activities.forEach(activity => {
    if (activity.parentId === null) return
    const name = trim(activity.activityName)
    const date = normalizeMrBusinessDate(instance.dates[activity.id])
    if (!date) return
    if (name === COLLECT_START && startBound && date < startBound) {
      errors.push({ rowKey, activityId: activity.id, activityName: activity.activityName, message: '修改点收集开始时间不能早于一级计划中的计划开始时间' })
    }
    if (name === OTA_RELEASE && endBound && date > endBound) {
      errors.push({ rowKey, activityId: activity.id, activityName: activity.activityName, message: 'OTA开放验证&部署不能晚于一级计划中的计划完成时间' })
    }
  })
  return errors
}

export function resolveMrPermissions(input: MrPermissionInput): MrPermissionResult {
  const result: MrPermissionResult = { canView: false, canEditTemplate: false, canEditTos: false, canEditMachine: false, canStopRelease: false, canEditMarket: false }
  const currentUser = trim(input.currentUser)
  if (!currentUser) return result
  result.canView = true
  if (input.globalAdminUsers.some(user => trim(user) === currentUser)) {
    return { canView: true, canEditTemplate: true, canEditTos: true, canEditMachine: true, canStopRelease: true, canEditMarket: true }
  }
  if (input.context === 'tos' && input.tosManagerUsers.some(user => trim(user) === currentUser)) result.canEditTos = true
  if (input.context === 'joint-machine' && currentUser === trim(input.machineSpm)) {
    result.canEditMachine = true
    result.canStopRelease = true
  }
  if (input.context === 'machine-market' && currentUser === trim(input.machineSpm)) result.canEditMarket = true
  return result
}

export function createTosMrVersionInstance(input: CreateTosMrVersionInput): TosMrVersionInstance {
  const projectId = trim(input.projectId)
  const tosVersion = trim(input.tosVersion)
  const actor = trim(input.actor)
  if (!projectId || !tosVersion || !actor) throw new Error('项目、tOS版本号和操作人不能为空')
  if (input.templateVersion.status !== '已发布') throw new Error('仅可使用已发布模板版本')
  const activities = normalizeMrTemplateActivities(input.templateVersion.activities).map(activity => ({ ...activity }))
  return {
    projectId,
    tosVersion,
    templateVersionId: input.templateVersion.id,
    activities,
    dates: {},
    createdBy: actor,
    createdAt: input.now,
    updatedBy: actor,
    updatedAt: input.now,
  }
}

export function projectTosMrVerticalRows(instance: TosMrVersionInstance): MrTosVerticalRow[] {
  return numberMrTemplateActivities(instance.activities).map(activity => ({
    ...activity,
    date: activity.parentId === null ? '/' : instance.dates[activity.id] ?? '',
  }))
}

export function projectTosMrHorizontalColumns(activities: readonly MrTemplateActivity[]): MrGroupedColumn[] {
  const canonical = normalizeMrTemplateActivities(activities)
  return canonical.filter(activity => activity.parentId === null).map(parent => {
    const parentName = trim(parent.activityName)
    const children: MrLeafColumn[] = canonical.filter(activity => activity.parentId === parent.id).map(child => {
      const activityName = trim(child.activityName)
      return { key: escapedIdentity(parentName, activityName), title: activityName, parentName, activityName, activityId: child.id }
    })
    return { key: escapedIdentity(parentName), title: parentName, children }
  })
}

export function buildJointMrColumnSchema(
  instances: readonly TosMrVersionInstance[],
  latestTemplate: readonly MrTemplateActivity[],
): MrGroupedColumn[] {
  const groups: MrGroupedColumn[] = []
  const pairs = new Set<string>()
  const groupsByName = new Map<string, MrGroupedColumn>()
  const appendColumns = (sourceGroups: readonly MrGroupedColumn[]) => {
    sourceGroups.forEach(sourceGroup => {
      let targetGroup = groupsByName.get(sourceGroup.title)
      if (!targetGroup) {
        targetGroup = { key: sourceGroup.key, title: sourceGroup.title, children: [] }
        groups.push(targetGroup)
        groupsByName.set(targetGroup.title, targetGroup)
      }
      sourceGroup.children.forEach(sourceChild => {
        const pair = escapedIdentity(sourceChild.parentName, sourceChild.activityName)
        if (pairs.has(pair)) return
        pairs.add(pair)
        targetGroup!.children.push({ ...sourceChild })
      })
    })
  }

  appendColumns(projectTosMrHorizontalColumns(latestTemplate))
  const sortedInstances = instances.map((instance, index) => ({ instance, index }))
    .sort((left, right) => compareTosVersionNumbers(left.instance.tosVersion, right.instance.tosVersion) || left.index - right.index)

  sortedInstances.forEach(({ instance }) => {
    appendColumns(projectTosMrHorizontalColumns(instance.activities))
  })
  return groups
}
