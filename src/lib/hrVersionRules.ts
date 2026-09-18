import { canAccessHrProject, getHrAllowedBudgetTypes, getHrRegistryProject, isHrFormalRecord } from '@/lib/hrProjectRegistry'
import { PROJECT_CATEGORY_CAPABILITY } from '@/constants/projectTypes'
import { getManualHrMilestoneKeysForType } from '@/lib/hrMilestoneOwnership'
/** Shared HR version identity, activation, locking and write-scope rules. */
export const HR_BUDGET_TYPES = ['annual', 'projectEstimate', 'projectBudget'] as const
export const HR_BATCH_OPTIONS = Array.from({ length: 20 }, (_, index) => ({ value: index + 1, label: `第${index + 1}批` }))
export const isHrBatch = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 20
export const formatHrBatch = (value?: number | null) => isHrBatch(value) ? `第${value}批` : '-'

export interface HrVersionIdentity {
  id: string
  budgetType: string
  minorVersion: number
  majorVersion: number
  versionNumber: string
  createdAt: string
  isActive?: boolean
  lockState?: string
  copiedFromVersionId?: string
  copiedFromVersionNumber?: string
  batch?: number | null
}

export function getLatestHrVersion<T extends HrVersionIdentity>(versions: readonly T[], budgetType: string): T | undefined {
  return versions.filter(v => v.budgetType === budgetType).reduce<T | undefined>((latest, version) => (
    !latest || version.minorVersion > latest.minorVersion ? version : latest
  ), undefined)
}
/** Active state is independent of latest/default selection. */
export function getActiveHrVersion<T extends HrVersionIdentity>(versions: readonly T[], budgetType: string): T | undefined {
  return getLatestHrVersion(versions.filter(version => version.isActive === true), budgetType)
}
export function isHrVersionEditable(
  project: { pmsProjectId?: string } | null | undefined,
  version: Pick<HrVersionIdentity, 'lockState' | 'budgetType'> | null | undefined,
): boolean {
  return !!version && version.lockState !== 'locked' && canAccessHrProject(project, true)
    && getHrAllowedBudgetTypes(project).some(type => type === version.budgetType)
}

export const isLatestHrVersion = (project: { versions: readonly HrVersionIdentity[] }, version: HrVersionIdentity) => (
  getLatestHrVersion(project.versions, version.budgetType)?.id === version.id
)
export const nextHrMinorVersion = (versions: readonly HrVersionIdentity[], budgetType: string) => (
  Math.max(0, ...versions.filter(v => v.budgetType === budgetType).map(v => v.minorVersion)) + 1
)

/** Convert legacy major/lock numbering once, retaining record IDs and all historical values. */
export function normalizeHrVersionSequence<T extends HrVersionIdentity>(versions: readonly T[]): T[] {
  const sequence = new Map<string, number>()
  for (const budgetType of HR_BUDGET_TYPES) {
    const group = versions.filter(v => v.budgetType === budgetType)
    const valid = group.every(v => v.majorVersion === 0 && v.minorVersion >= 1 && v.versionNumber === `V0.${v.minorVersion}`)
      && new Set(group.map(v => v.minorVersion)).size === group.length
    if (valid) continue
    [...group].sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0))
      .forEach((version, index) => sequence.set(version.id, index + 1))
  }
  const normalized = versions.map(version => {
    const minorVersion = sequence.get(version.id) ?? version.minorVersion
    return { ...version, majorVersion: 0, minorVersion, versionNumber: `V0.${minorVersion}`, batch: isHrBatch(version.batch) ? version.batch : null }
  })
  return normalized.map(version => {
    const group = normalized.filter(item => item.budgetType === version.budgetType)
    const legacy = group.every(item => typeof item.isActive !== 'boolean')
    const active = legacy ? getLatestHrVersion(group, version.budgetType) : getActiveHrVersion(group, version.budgetType)
    return { ...version, isActive: active?.id === version.id }
  })
}

/** Reuse the same budget first; a first version of another budget starts from the newest project snapshot. */
export function getHrVersionSeed<T extends HrVersionIdentity>(versions: readonly T[], budgetType: string): T | undefined {
  return getLatestHrVersion(versions, budgetType) ?? versions.reduce<T | undefined>((latest, version) => (
    !latest || (Date.parse(version.createdAt || '') || 0) >= (Date.parse(latest.createdAt || '') || 0) ? version : latest
  ), undefined)
}

export function getMachineProjectYear(project: { versions: readonly { createdAt: string; milestones: { conceptStart: string | null; str5: string | null } }[] }): string {
  const latest = project.versions.reduce<typeof project.versions[number] | undefined>((current, version) => (
    !current || (Date.parse(version.createdAt) || 0) >= (Date.parse(current.createdAt) || 0) ? version : current
  ), undefined)
  const year = (date?: string | null) => date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(2, 4) : null
  const start = year(latest?.milestones.conceptStart)
  const end = year(latest?.milestones.str5)
  if (!start && !end) return '-'
  return `${start ? `${start}年立项` : '立项待补充'}${end ? `${end}年结项` : '结项待补充'}`
}

/** Creation and copying share the same project-state and budget prerequisites. */
export function canCreateHrVersion(
  project: { status: string; ipmProjectCode: string | null; pmsProjectId?: string } | null | undefined,
  budgetType: string | null,
): boolean {
  return project?.status === 'active' && !!budgetType
    && canAccessHrProject(project, true) && getHrAllowedBudgetTypes(project).some(type => type === budgetType)
}

/** Enforce edit scope in the store as well as in every UI entry point. */
export function allowedHrVersionUpdates<T extends object>(
  project: { ipmProjectCode: string | null; pmsProjectId?: string; versions: readonly HrVersionIdentity[] },
  version: HrVersionIdentity,
  updates: T,
): Partial<T> {
  if (!isHrVersionEditable(project, version)) return {}
  const allowed = { ...updates } as Record<string, unknown>
  const manualCapabilityDates = getHrRegistryProject(project)?.type === PROJECT_CATEGORY_CAPABILITY
  const manualMilestoneKeys = getManualHrMilestoneKeysForType(getHrRegistryProject(project)?.type)
  for (const key of Object.keys(allowed)) {
    if (key === 'batch') {
      if (allowed.batch !== null && !isHrBatch(allowed.batch)) delete allowed.batch
    } else if (isHrFormalRecord(project) && version.budgetType !== 'annual') {
      if (key === 'milestones') {
        const dates = allowed.milestones
        const permitted = dates && typeof dates === 'object' && !Array.isArray(dates)
          ? Object.fromEntries(Object.entries(dates).filter(([field]) => manualMilestoneKeys.includes(field))) : {}
        if (Object.keys(permitted).length) allowed.milestones = permitted
        else delete allowed.milestones
      } else if (['projectLevel', ...(manualCapabilityDates ? [] : ['projectStartTime', 'projectEndTime'])].includes(key)) delete allowed[key]
    }
  }
  return allowed as Partial<T>
}

interface LifecycleVersion extends HrVersionIdentity {
  projectId: string
  lockState: string
  lockedAt: string | null
  createdBy?: string
  operationLogs?: unknown[]
}
interface LifecycleProject {
  id: string
  pmsProjectId?: string
  ipmProjectCode: string | null
  status: string
  versions: LifecycleVersion[]
}
/** Pure lifecycle transforms retain business snapshots; synchronization is intentionally excluded. */
export function changeHrVersionLifecycle<P extends LifecycleProject>(projects: P[], projectId: string, versionId: string, action: 'lock' | 'active', enabled: boolean): P[] {
  return projects.map(project => {
    if (project.id !== projectId || !canAccessHrProject(project, true)) return project
    const target = project.versions.find(version => version.id === versionId)
    if (!target || !getHrAllowedBudgetTypes(project).some(type => type === target.budgetType)) return project
    const versions = project.versions.map(version => action === 'lock'
      ? version.id === versionId ? { ...version, lockState: enabled ? 'locked' : 'unlocked', lockedAt: enabled ? new Date().toISOString() : null } : version
      : version.budgetType === target.budgetType && (enabled || version.id === versionId) ? { ...version, isActive: enabled && version.id === versionId } : version)
    const updated = { ...project, versions }
    for (const type of HR_BUDGET_TYPES) {
      const key = type === 'annual' ? 'annualBudget' : type
      Object.assign(updated, { [key]: (getActiveHrVersion(versions, type) as LifecycleVersion & { estimatedInvestment: number } | undefined)?.estimatedInvestment ?? 0 })
    }
    return updated as P
  })
}
export function copyHrVersionSnapshot<P extends LifecycleProject, M extends { id: string; versionId: string; sourceRowId?: string; versionNumber: string; versionLockState: string }>(
  projects: P[], monthlyInvestments: M[], projectId: string, versionId: string, actor: string,
): { projects: P[]; monthlyInvestments: M[] } {
  const project = projects.find(item => item.id === projectId)
  const source = project?.versions.find(version => version.id === versionId)
  if (!project || !source || !canCreateHrVersion(project, source.budgetType)) return { projects, monthlyInvestments }
  const minorVersion = nextHrMinorVersion(project.versions, source.budgetType)
  const id = `${projectId}-${source.budgetType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const version = { ...structuredClone(source), id, versionNumber: `V0.${minorVersion}`, majorVersion: 0, minorVersion,
    isActive: false, lockState: 'unlocked', lockedAt: null, createdBy: actor, createdAt: new Date().toISOString(),
    copiedFromVersionId: source.id, copiedFromVersionNumber: source.versionNumber, operationLogs: [] }
  if ('departmentInvestments' in version && Array.isArray(version.departmentInvestments)) {
    version.departmentInvestments = version.departmentInvestments.map(row => ({ ...row, id: String(row.id).replaceAll(source.id, id) }))
  }
  const rows = monthlyInvestments.filter(row => row.versionId === source.id).map(row => ({
    ...structuredClone(row), id: row.id.includes(source.id) ? row.id.replaceAll(source.id, id) : `${id}-${row.id}`,
    sourceRowId: row.sourceRowId?.replaceAll(source.id, id), versionId: id, versionNumber: version.versionNumber, versionLockState: 'unlocked',
  }))
  return { projects: projects.map(item => item.id === projectId ? { ...item, versions: [...item.versions, version] } as P : item), monthlyInvestments: [...monthlyInvestments, ...rows] }
}
