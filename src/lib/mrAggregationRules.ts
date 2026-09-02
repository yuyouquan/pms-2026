import { compareTosVersionNumbers, normalizeMrBusinessDate } from '@/lib/mrVersionPlanRules'
import type {
  ApplyStopReleaseInput,
  ApplyStopReleaseResult,
  EosExclusionInput,
  JointMachinePlan,
  MrLevel1Source,
  MrMachineProjectSource,
  ReconcileJointInput,
  ReconcileJointResult,
  StopExclusionInput,
  TosMrVersionInstance,
} from '@/types/mrVersionPlan'

const COLLECTION_START = '修改点收集开始时间'
const VERSION_PATTERN = /^V([1-9]\d*)$/
const TOS_MR_VERSION_PATTERN = /^(?:tos)?(\d+(?:\.\d+){3,})$/i
const LEGACY_PRODUCT_TYPES = new Set(['老品', '升级', '切换', '换代'])

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numericProjectKey(value: string): string | null {
  const matches = trim(value).match(/\d+/g)
  if (!matches || matches.length < 2) return null
  const segments = matches.slice(0, 2).map(Number)
  return segments.every(Number.isSafeInteger) ? segments.join('.') : null
}

function compareProjectKeys(left: string, right: string): number {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  return (leftParts[0] - rightParts[0]) || (leftParts[1] - rightParts[1])
}

function addCalendarDays(value: string, days: number): string | null {
  const canonical = normalizeMrBusinessDate(value)
  if (!canonical) return null
  const [year, month, day] = canonical.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function publishedVersionNumber(versionNo: string): number | null {
  const match = VERSION_PATTERN.exec(trim(versionNo))
  const number = match ? Number(match[1]) : Number.NaN
  return Number.isSafeInteger(number) ? number : null
}

function planKey(plan: Pick<JointMachinePlan, 'projectId' | 'tosVersion'>): string {
  return `${plan.projectId}::${plan.tosVersion}`
}

function clonePlan(plan: JointMachinePlan): JointMachinePlan {
  return { ...plan, dates: { ...plan.dates } }
}

function cloneInstance(instance: TosMrVersionInstance, tosVersion: string): TosMrVersionInstance {
  return {
    ...instance,
    tosVersion,
    activities: instance.activities.map(activity => ({ ...activity })),
    dates: { ...instance.dates },
  }
}

function findActivityDate(instance: TosMrVersionInstance, activityName: string): string {
  const activity = instance.activities.find(row => row.parentId !== null && trim(row.activityName) === activityName)
  return activity ? normalizeMrBusinessDate(instance.dates[activity.id]) : ''
}

export function getTosVersionInterval(instance: TosMrVersionInstance): { startDate: string; endDate: string } | null {
  const dates = instance.activities
    .filter(activity => activity.parentId !== null)
    .map(activity => normalizeMrBusinessDate(instance.dates[activity.id]))
    .filter(Boolean)
    .sort()
  return dates.length ? { startDate: dates[0], endDate: dates[dates.length - 1] } : null
}

export function canonicalizeTosMrVersion(value: string): string | null {
  const match = TOS_MR_VERSION_PATTERN.exec(trim(value))
  if (!match) return null
  const parts = match[1].split('.').map(Number)
  if (!parts.every(Number.isSafeInteger)) return null
  while (parts.length > 4 && parts.at(-1) === 0) parts.pop()
  return parts.join('.')
}

export function resolveMachineTosProjectKey(project: MrMachineProjectSource): string | null {
  const productType = trim(project.productType)
  const version = productType === '新品'
    ? project.firstSaleTosVersion
    : LEGACY_PRODUCT_TYPES.has(productType) ? project.currentTosVersion : undefined
  return numericProjectKey(trim(version))
}

export function resolveLatestPublishedStr5Date(source: MrLevel1Source): string | null {
  const latest = source.versions.reduce<{ id: string; number: number } | null>((result, version) => {
    const number = version.status === '已发布' ? publishedVersionNumber(version.versionNo) : null
    return number !== null && (!result || number > result.number) ? { id: version.id, number } : result
  }, null)
  if (!latest) return null
  const task = source.getSnapshot(latest.id)?.find(row => row.parentId != null && trim(row.taskName) === 'STR5')
  return task ? normalizeMrBusinessDate(task.planEndDate) || null : null
}

export function isPlanExcludedByStopRecord(input: StopExclusionInput): boolean {
  const planVersion = canonicalizeTosMrVersion(input.plan.tosVersion)
  if (!planVersion) return false
  const instance = input.tosInstances.find(item => (
    item.projectId === input.plan.tosProjectId && canonicalizeTosMrVersion(item.tosVersion) === planVersion
  ))
  if (!instance) return false
  const referenceDate = findActivityDate(instance, COLLECTION_START)
  if (!referenceDate) return false
  return input.stopRecords.some(record => {
    const stopDate = normalizeMrBusinessDate(record.stopDate)
    return record.projectId === input.plan.projectId && !!stopDate && referenceDate > stopDate
  })
}

/** EOS is inclusive: the release whose collection start equals the EOS day remains visible. */
export function isPlanExcludedByMachineEos(input: EosExclusionInput): boolean {
  const machine = input.machineProjects.find(project => project.id === input.plan.projectId)
  if (trim(machine?.status) !== 'EOS') return false
  const eosDate = normalizeMrBusinessDate(trim(machine?.statusChangedAt).slice(0, 10))
  if (!eosDate) return false
  const planVersion = canonicalizeTosMrVersion(input.plan.tosVersion)
  if (!planVersion) return false
  const instance = input.tosInstances.find(item => (
    item.projectId === input.plan.tosProjectId && canonicalizeTosMrVersion(item.tosVersion) === planVersion
  ))
  if (!instance) return false
  const collectionStart = findActivityDate(instance, COLLECTION_START)
  return !!collectionStart && collectionStart > eosDate
}

function normalizeStopRecord(record: ApplyStopReleaseInput['record']): ApplyStopReleaseInput['record'] {
  const id = trim(record.id)
  const projectId = trim(record.projectId)
  const projectName = trim(record.projectName)
  const operator = trim(record.operator)
  const operatedAt = trim(record.operatedAt)
  const stopDate = normalizeMrBusinessDate(record.stopDate)
  if (!id) throw new Error('停止发版记录ID不能为空')
  if (!projectId) throw new Error('停止发版项目不能为空')
  if (!projectName) throw new Error('停止发版项目名称不能为空')
  if (!operator) throw new Error('停止发版操作人不能为空')
  if (!operatedAt) throw new Error('停止发版操作时间不能为空')
  if (!stopDate || stopDate !== trim(record.stopDate)) throw new Error('停止发版日期格式无效')
  return { ...record, id, projectId, projectName, stopDate, operator, operatedAt }
}

function sameStopRecord(left: ApplyStopReleaseInput['record'], right: ApplyStopReleaseInput['record']): boolean {
  return left.id === right.id
    && left.projectId === right.projectId
    && left.projectName === right.projectName
    && left.stopDate === right.stopDate
    && left.operator === right.operator
    && left.operatedAt === right.operatedAt
}

export function applyStopRelease(input: ApplyStopReleaseInput): ApplyStopReleaseResult {
  const record = normalizeStopRecord(input.record)
  const existingById = input.stopRecords.find(item => item.id === record.id)
  if (existingById && !sameStopRecord(existingById, record)) throw new Error('停止发版记录ID已存在')
  const alreadyStopped = input.stopRecords.some(item => item.projectId === record.projectId)
  const stopRecords = input.stopRecords.map(item => ({ ...item }))
  if (!existingById && !alreadyStopped) stopRecords.push(record)
  const persistedPlans: Record<string, JointMachinePlan> = {}
  const removedPlanKeys: string[] = []
  Object.keys(input.persistedPlans).sort().forEach(key => {
    const plan = input.persistedPlans[key]
    if (isPlanExcludedByStopRecord({ plan, tosInstances: input.tosInstances, stopRecords })) removedPlanKeys.push(key)
    else persistedPlans[key] = clonePlan(plan)
  })
  return { persistedPlans, stopRecords, removedPlanKeys }
}

export function reconcileJointMachinePlans(input: ReconcileJointInput): ReconcileJointResult {
  const today = normalizeMrBusinessDate(input.today)
  if (!today || today !== trim(input.today)) throw new Error('当前日期格式无效')
  const persistedPlans: Record<string, JointMachinePlan> = {}
  const eligibleByInstance = new Map<string, JointMachinePlan[]>()
  const sortedProjects = input.tosProjects
    .map(project => ({ project, key: numericProjectKey(project.tosProjectKey) }))
    .filter((item): item is { project: ReconcileJointInput['tosProjects'][number]; key: string } => item.key !== null)
    .sort((left, right) => compareProjectKeys(left.key, right.key) || left.project.projectId.localeCompare(right.project.projectId))
    .map(item => ({ ...item.project, tosProjectKey: item.key }))
  const persistedByCanonicalKey = new Map<string, JointMachinePlan>()
  Object.keys(input.persistedPlans).sort().forEach(sourceKey => {
    const source = input.persistedPlans[sourceKey]
    const version = canonicalizeTosMrVersion(source.tosVersion)
    if (!version) return
    const key = `${source.projectId}::${version}`
    if (!persistedByCanonicalKey.has(key)) persistedByCanonicalKey.set(key, { ...clonePlan(source), tosVersion: version })
  })

  const instancesForProject = (projectId: string) => {
    const seen = new Set<string>()
    return input.tosInstances
      .filter(instance => instance.projectId === projectId)
      .map((instance, index) => ({ instance, index, version: canonicalizeTosMrVersion(instance.tosVersion) }))
      .filter((item): item is { instance: TosMrVersionInstance; index: number; version: string } => item.version !== null)
      .filter(item => {
        if (seen.has(item.version)) return false
        seen.add(item.version)
        return true
      })
      .map(item => ({ instance: cloneInstance(item.instance, item.version), index: item.index }))
      .sort((left, right) => compareTosVersionNumbers(left.instance.tosVersion, right.instance.tosVersion) || left.index - right.index)
  }

  sortedProjects.forEach(tosProject => {
    const instances = instancesForProject(tosProject.projectId).map(item => ({ ...item, interval: getTosVersionInterval(item.instance) }))

    const machines = input.machineProjects
      .filter(project => resolveMachineTosProjectKey(project) === tosProject.tosProjectKey)
      .sort((left, right) => left.id.localeCompare(right.id))

    machines.forEach(machine => {
      const source = input.latestPublishedLevel1ByProjectId[machine.id]
      const str5Date = source ? resolveLatestPublishedStr5Date(source) : null
      if (!today || !str5Date || today <= str5Date) return
      const targetDate = addCalendarDays(str5Date, 1)
      if (!targetDate) return
      const startIndex = instances.findIndex(item => item.interval && targetDate >= item.interval.startDate && targetDate <= item.interval.endDate)
      if (startIndex < 0) return

      instances.slice(startIndex).forEach(({ instance }) => {
        const key = `${machine.id}::${instance.tosVersion}`
        const existing = persistedByCanonicalKey.get(key)
        const plan: JointMachinePlan = existing ? clonePlan(existing) : {
          projectId: machine.id,
          tosProjectId: tosProject.projectId,
          tosVersion: instance.tosVersion,
          transferType: '1',
          dates: {},
          updatedBy: trim(machine.spm),
          updatedAt: today,
        }
        if (isPlanExcludedByMachineEos({ plan, tosInstances: input.tosInstances, machineProjects: input.machineProjects })) return
        persistedPlans[key] = plan
        const instanceKey = `${instance.projectId}::${instance.tosVersion}`
        const list = eligibleByInstance.get(instanceKey) ?? []
        list.push(plan)
        eligibleByInstance.set(instanceKey, list)
      })
    })
  })

  const rows: ReconcileJointResult['rows'] = []
  sortedProjects.forEach(tosProject => {
    const instances = instancesForProject(tosProject.projectId)
    instances.forEach(({ instance }) => {
      rows.push({
        key: `${instance.projectId}::${instance.tosVersion}::reference`, kind: 'tos-reference',
        projectId: instance.projectId, tosProjectId: instance.projectId, tosVersion: instance.tosVersion, instance,
      })
      const plans = eligibleByInstance.get(`${instance.projectId}::${instance.tosVersion}`) ?? []
      plans.sort((left, right) => left.projectId.localeCompare(right.projectId)).forEach(plan => {
        rows.push({ key: planKey(plan), kind: 'machine', projectId: plan.projectId, tosProjectId: plan.tosProjectId, tosVersion: plan.tosVersion, plan })
      })
    })
  })
  return { rows, persistedPlans }
}
