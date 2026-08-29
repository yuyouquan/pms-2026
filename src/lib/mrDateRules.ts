import { compareTosVersionNumbers, normalizeMrBusinessDate } from '@/lib/mrVersionPlanRules'
import { canonicalizeTosMrVersion } from '@/lib/mrAggregationRules'
import type {
  JointMachinePlan,
  JointValidationInput,
  MarketDateValidationInput,
  MrCellError,
  TosMrVersionInstance,
} from '@/types/mrVersionPlan'

const COLLECTION = '修改点收集开始时间'
const LOCK = '修改点锁定时间'
const MP_DEADLINE = 'MP入库截止时间'
const TRANSFER = '版本转测时间'
const TEST_START = '测试开始时间'
const BOUNDED_FIELDS = ['测试开始时间', '测试完成时间', '评审时间', '软件归档时间', 'OTA开放验证&部署'] as const
const EQUALITY_MESSAGES: Record<string, string> = {
  [COLLECTION]: '修改点收集开始时间需与tOS项目时间保持一致',
  [LOCK]: '修改点锁定时间需与tOS项目时间保持一致',
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function rowKey(row: JointMachinePlan): string {
  return `${row.projectId}::${canonicalizeTosMrVersion(row.tosVersion) ?? row.tosVersion}`
}

function activityByName(instance: TosMrVersionInstance, name: string) {
  return instance.activities.find(activity => activity.parentId !== null && trim(activity.activityName) === name)
}

function rawMachineDate(row: JointMachinePlan, instance: TosMrVersionInstance, name: string): string {
  const activity = activityByName(instance, name)
  return trim((activity ? row.dates[activity.id] : undefined) ?? row.dates[name])
}

function rawTosDate(instance: TosMrVersionInstance, name: string): string {
  const activity = activityByName(instance, name)
  return activity ? trim(instance.dates[activity.id]) : ''
}

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function numericType(row: JointMachinePlan): number | null {
  if (row.transferType === 'N/A') return null
  const value = Number(row.transferType)
  return Number.isInteger(value) ? value : null
}

function makeError(row: JointMachinePlan, instance: TosMrVersionInstance, name: string, message: string): MrCellError {
  return {
    rowKey: rowKey(row),
    activityId: activityByName(instance, name)?.id ?? name,
    activityName: name,
    message,
  }
}

function nextTosInstance(instances: readonly TosMrVersionInstance[], current: TosMrVersionInstance): TosMrVersionInstance | undefined {
  const currentVersion = canonicalizeTosMrVersion(current.tosVersion)
  if (!currentVersion) return undefined
  return instances
    .map(instance => ({ instance, version: canonicalizeTosMrVersion(instance.tosVersion) }))
    .filter((item): item is { instance: TosMrVersionInstance; version: string } => (
      item.instance.projectId === current.projectId && item.version !== null && compareTosVersionNumbers(item.version, currentVersion) > 0
    ))
    .sort((left, right) => compareTosVersionNumbers(left.version, right.version))[0]?.instance
}

function previousTypeRows(rows: readonly JointMachinePlan[], current: JointMachinePlan): JointMachinePlan[] {
  const currentType = numericType(current)
  if (currentType === null || currentType <= 1) return []
  const currentVersion = canonicalizeTosMrVersion(current.tosVersion)
  const candidates = rows.filter(row => (
    row.tosProjectId === current.tosProjectId && currentVersion !== null && canonicalizeTosMrVersion(row.tosVersion) === currentVersion
  ))
    .map(row => ({ row, type: numericType(row) }))
    .filter((item): item is { row: JointMachinePlan; type: number } => item.type !== null && item.type < currentType)
  const greatest = candidates.reduce<number | null>((result, item) => result === null || item.type > result ? item.type : result, null)
  return greatest === null ? [] : candidates.filter(item => item.type === greatest).map(item => item.row)
}

export function validateJointMachineRows(input: JointValidationInput): MrCellError[] {
  const errors: MrCellError[] = []
  const instances = [...input.tosInstances].sort((left, right) => (
    left.projectId.localeCompare(right.projectId) || compareTosVersionNumbers(left.tosVersion, right.tosVersion)
  ))
  const rows = [...input.machinePlans].sort((left, right) => (
    left.tosProjectId.localeCompare(right.tosProjectId)
    || compareTosVersionNumbers(left.tosVersion, right.tosVersion)
    || left.projectId.localeCompare(right.projectId)
  ))

  rows.forEach(row => {
    if (row.transferType === 'N/A') return
    const version = canonicalizeTosMrVersion(row.tosVersion)
    const instance = version ? instances.find(item => item.projectId === row.tosProjectId && canonicalizeTosMrVersion(item.tosVersion) === version) : undefined
    if (!instance) return
    const type = numericType(row)
    if (type === null) return
    const next = nextTosInstance(instances, instance)
    const previousRows = previousTypeRows(rows, row)

    const allNames = [COLLECTION, LOCK, MP_DEADLINE, TRANSFER, ...BOUNDED_FIELDS]
    const malformed = new Set<string>()
    allNames.forEach(name => {
      const raw = rawMachineDate(row, instance, name)
      if (raw && !normalizeMrBusinessDate(raw)) {
        malformed.add(name)
        errors.push(makeError(row, instance, name, `${name}日期格式不正确`))
      }
    })

    ;[COLLECTION, LOCK].forEach(name => {
      if (malformed.has(name)) return
      const value = normalizeMrBusinessDate(rawMachineDate(row, instance, name))
      const reference = normalizeMrBusinessDate(rawTosDate(instance, name))
      if (value && reference && value !== reference) errors.push(makeError(row, instance, name, EQUALITY_MESSAGES[name]))
    })

    if (!malformed.has(MP_DEADLINE)) {
      const value = normalizeMrBusinessDate(rawMachineDate(row, instance, MP_DEADLINE))
      const reference = normalizeMrBusinessDate(rawTosDate(instance, MP_DEADLINE))
      if (value && reference && value > reference) errors.push(makeError(row, instance, MP_DEADLINE, '整机产品项目的MP入库截止时间不得晚于tOS项目时间'))
    }

    if (!malformed.has(TRANSFER)) {
      const value = normalizeMrBusinessDate(rawMachineDate(row, instance, TRANSFER))
      if (value) {
        if (type === 1) {
          const reference = normalizeMrBusinessDate(rawTosDate(instance, TRANSFER))
          if (reference && value !== reference) errors.push(makeError(row, instance, TRANSFER, '版本转测时间应等于tOS版本转测时间'))
        } else {
          const violatesPrior = previousRows.some(previous => {
            const previousValue = normalizeMrBusinessDate(rawMachineDate(previous, instance, TRANSFER))
            return !!previousValue && value < addDays(previousValue, 7)
          })
          const nextStart = next ? normalizeMrBusinessDate(rawTosDate(next, TEST_START)) : ''
          if (violatesPrior || (nextStart && value > nextStart)) {
            errors.push(makeError(row, instance, TRANSFER, '版本转测时间需晚于上一个1+N转测类型至少1周'))
          }
        }
      }
    }

    BOUNDED_FIELDS.forEach(name => {
      if (malformed.has(name)) return
      const value = normalizeMrBusinessDate(rawMachineDate(row, instance, name))
      if (!value) return
      if (type === 1) {
        const reference = normalizeMrBusinessDate(rawTosDate(instance, name))
        const nextStart = next ? normalizeMrBusinessDate(rawTosDate(next, TEST_START)) : ''
        if ((reference && value < reference) || (nextStart && value > nextStart)) {
          errors.push(makeError(row, instance, name, `${name}不早于tOS项目时间，可与tOS项目保持一致，且不能超过下一个tOS版本的测试开始时间`))
        }
      } else {
        const violatesPrior = previousRows.some(previous => {
          const previousValue = normalizeMrBusinessDate(rawMachineDate(previous, instance, name))
          return !!previousValue && value < addDays(previousValue, 7)
        })
        const nextValue = next ? normalizeMrBusinessDate(rawTosDate(next, name)) : ''
        if (violatesPrior || (nextValue && value > nextValue)) {
          errors.push(makeError(row, instance, name, `${name}需晚于上一个1+N转测类型至少1周，且不能超过下一个tOS版本的${name}`))
        }
      }
    })
  })

  const sameTypes = new Map<string, Array<{ row: JointMachinePlan; instance: TosMrVersionInstance; value: string }>>()
  rows.forEach(row => {
    const type = numericType(row)
    const version = canonicalizeTosMrVersion(row.tosVersion)
    const instance = version ? instances.find(item => item.projectId === row.tosProjectId && canonicalizeTosMrVersion(item.tosVersion) === version) : undefined
    if (type === null || !instance) return
    const value = normalizeMrBusinessDate(rawMachineDate(row, instance, TRANSFER))
    if (!value) return
    const key = `${row.tosProjectId}::${version}::${type}`
    const group = sameTypes.get(key) ?? []
    group.push({ row, instance, value })
    sameTypes.set(key, group)
  })
  sameTypes.forEach(group => {
    if (new Set(group.map(item => item.value)).size <= 1) return
    group.forEach(item => errors.push(makeError(item.row, item.instance, TRANSFER, '同一1+N转测类型的版本转测时间需保持一致')))
  })
  return errors
}

export function validateMachineMarketDate(input: MarketDateValidationInput): string[] {
  const valueText = trim(input.value)
  if (!valueText) return []
  const value = normalizeMrBusinessDate(valueText)
  if (!value) return [`${trim(input.activityName)}日期格式不正确`]
  const mainValue = normalizeMrBusinessDate(input.mainValue)
  if (!mainValue) return ['主市场对应时间未填写，当前市场不可填写']
  return value > mainValue ? ['非主市场时间不得晚于主市场对应时间'] : []
}

export function clearDatesForNa(row: JointMachinePlan): JointMachinePlan {
  return row.transferType === 'N/A' ? { ...row, dates: {} } : { ...row, dates: { ...row.dates } }
}

export function groupMrErrorsByRow(errors: readonly MrCellError[]): Record<string, MrCellError[]> {
  const grouped: Record<string, MrCellError[]> = {}
  const seen = new Set<string>()
  errors.forEach(error => {
    const identity = `${error.rowKey}\u0000${error.activityId}\u0000${error.message}`
    if (seen.has(identity)) return
    seen.add(identity)
    ;(grouped[error.rowKey] ??= []).push({ ...error })
  })
  return grouped
}
