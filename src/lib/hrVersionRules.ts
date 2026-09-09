/** Shared HR version rules. Legacy lock fields remain readable only for data migration. */
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
  batch?: number | null
}

export function getLatestHrVersion<T extends HrVersionIdentity>(versions: readonly T[], budgetType: string): T | undefined {
  return versions.filter(v => v.budgetType === budgetType).reduce<T | undefined>((latest, version) => (
    !latest || version.minorVersion > latest.minorVersion ? version : latest
  ), undefined)
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
  return versions.map(version => {
    const minorVersion = sequence.get(version.id) ?? version.minorVersion
    return { ...version, majorVersion: 0, minorVersion, versionNumber: `V0.${minorVersion}`, batch: isHrBatch(version.batch) ? version.batch : null }
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

/** Enforce edit scope in the store as well as in every UI entry point. */
export function allowedHrVersionUpdates<T extends object>(
  project: { ipmProjectCode: string | null; versions: readonly HrVersionIdentity[] },
  version: HrVersionIdentity,
  updates: T,
): Partial<T> {
  const allowed = { ...updates } as Record<string, unknown>
  for (const key of Object.keys(allowed)) {
    if (key === 'batch') {
      if (allowed.batch !== null && !isHrBatch(allowed.batch)) delete allowed.batch
    } else if (!isLatestHrVersion(project, version) || (project.ipmProjectCode && version.budgetType !== 'annual' && ['milestones', 'projectStartTime', 'projectEndTime', 'projectLevel'].includes(key))) {
      delete allowed[key]
    }
  }
  return allowed as Partial<T>
}
