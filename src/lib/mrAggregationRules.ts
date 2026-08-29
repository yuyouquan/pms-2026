import { compareTosVersionNumbers, normalizeMrBusinessDate } from '@/lib/mrVersionPlanRules'
import type {
  ApplyStopReleaseInput,
  ApplyStopReleaseResult,
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

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numericProjectKey(value: string): string | null {
  const matches = trim(value).match(/\d+/g)
  if (!matches || matches.length < 2) return null
  return `${Number(matches[0])}.${Number(matches[1])}`
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

export function resolveMachineTosProjectKey(project: MrMachineProjectSource): string | null {
  const productType = trim(project.productType)
  const version = productType === '新品'
    ? project.firstSaleTosVersion
    : new Set(['老品', '升级', '切换', '换代']).has(productType) ? project.currentTosVersion : undefined
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
  const instance = input.tosInstances.find(item => item.projectId === input.plan.tosProjectId && item.tosVersion === input.plan.tosVersion)
  if (!instance) return false
  const referenceDate = findActivityDate(instance, COLLECTION_START)
  if (!referenceDate) return false
  return input.stopRecords.some(record => {
    const stopDate = normalizeMrBusinessDate(record.stopDate)
    return record.projectId === input.plan.projectId && !!stopDate && referenceDate > stopDate
  })
}

export function applyStopRelease(input: ApplyStopReleaseInput): ApplyStopReleaseResult {
  const stopRecords = [...input.stopRecords.map(record => ({ ...record })), { ...input.record }]
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
  const persistedPlans: Record<string, JointMachinePlan> = {}
  const eligibleByInstance = new Map<string, JointMachinePlan[]>()
  const sortedProjects = [...input.tosProjects].sort((left, right) => left.tosProjectKey.localeCompare(right.tosProjectKey) || left.projectId.localeCompare(right.projectId))

  sortedProjects.forEach(tosProject => {
    const instances = input.tosInstances
      .filter(instance => instance.projectId === tosProject.projectId)
      .map((instance, index) => ({ instance, index, interval: getTosVersionInterval(instance) }))
      .sort((left, right) => compareTosVersionNumbers(left.instance.tosVersion, right.instance.tosVersion) || left.index - right.index)

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
        const existing = input.persistedPlans[key]
        const plan: JointMachinePlan = existing ? clonePlan(existing) : {
          projectId: machine.id,
          tosProjectId: tosProject.projectId,
          tosVersion: instance.tosVersion,
          transferType: '1',
          dates: {},
          updatedBy: trim(machine.spm),
          updatedAt: today,
        }
        if (isPlanExcludedByStopRecord({ plan, tosInstances: input.tosInstances, stopRecords: input.stopRecords })) return
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
    const instances = input.tosInstances
      .filter(instance => instance.projectId === tosProject.projectId)
      .map((instance, index) => ({ instance, index }))
      .sort((left, right) => compareTosVersionNumbers(left.instance.tosVersion, right.instance.tosVersion) || left.index - right.index)
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
