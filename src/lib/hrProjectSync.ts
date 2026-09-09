import { resolveHrFormalSource, type HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { HR_BUDGET_TYPES, getLatestHrVersion, getMachineProjectYear, isLatestHrVersion, normalizeHrVersionSequence, type HrVersionIdentity } from '@/lib/hrVersionRules'

interface SyncVersion extends HrVersionIdentity {
  milestones?: object
  projectStartTime?: string
  projectEndTime?: string
  projectLevel?: string
  levelCoefficient?: number
  hrModelVersion?: string
  estimatedInvestment: number
}
interface SyncProject {
  versions: SyncVersion[]
  ipmProjectCode: string | null
  annualBudget: number
  projectEstimate: number
  projectBudget: number
  projectYear?: string
}

/** Latest versions follow the formal plan; historical versions keep their own snapshots. */
export function synchronizeHrProjects<T extends SyncProject>(
  projects: readonly T[], category: HrProjectCategory,
  calculateMachineInvestment?: (level: string, model: string, coefficient: number) => number,
): T[] {
  return projects.map(project => {
    const normalized = { ...project, versions: normalizeHrVersionSequence(project.versions) }
    const source = project.ipmProjectCode ? resolveHrFormalSource(category, project.ipmProjectCode) : null
    const versions = normalized.versions.map(version => {
      if (!isLatestHrVersion(normalized, version)) return version
      const next = { ...version }
      if (source?.project) {
        if (category === 'capability') {
          next.projectStartTime = source.projectStartTime
          next.projectEndTime = source.projectEndTime
        } else {
          next.milestones = source.milestones
        }
        if (category === 'machine') next.projectLevel = source.projectLevel
      }
      if (category === 'machine' && calculateMachineInvestment) {
        next.estimatedInvestment = calculateMachineInvestment(next.projectLevel || '', next.hrModelVersion || '', next.levelCoefficient ?? 1)
      }
      return next
    })
    const updated = { ...normalized, versions }
    for (const budgetType of HR_BUDGET_TYPES) updated[budgetType === 'annual' ? 'annualBudget' : budgetType] = getLatestHrVersion(versions, budgetType)?.estimatedInvestment ?? 0
    if (category === 'machine') {
      updated.projectYear = getMachineProjectYear({ versions: versions as Array<SyncVersion & { milestones: { conceptStart: string | null; str5: string | null } }> })
    }
    return updated as T
  })
}
