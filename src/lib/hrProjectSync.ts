import { withMachineDerivedMilestones } from '@/lib/hrMachinePeriods'
import { withHrNonLaborRange } from '@/lib/hrNonLaborRange'
import type { NonLaborInvestment } from '@/types/nonLaborInvestment'
import { isHrFormalRecord, synchronizeHrRegistryRecord } from '@/lib/hrProjectRegistry'
import { resolveHrFormalSource, type HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { mergeHrFormalMilestones } from '@/lib/hrMilestoneOwnership'
import { HR_BUDGET_TYPES, getLatestHrVersion, getMachineProjectYear, isLatestHrVersion, normalizeHrVersionSequence, type HrVersionIdentity } from '@/lib/hrVersionRules'

interface SyncVersion extends HrVersionIdentity {
  nonLaborInvestment?: NonLaborInvestment
  milestones?: object
  projectStartTime?: string
  projectEndTime?: string
  projectLevel?: string
  levelCoefficient?: number
  hrModelVersion?: string
  estimatedInvestment: number
}
interface SyncProject {
  id: string
  name?: string
  pmsProjectId?: string
  versions: SyncVersion[]
  ipmProjectCode: string | null
  annualBudget: number
  projectEstimate: number
  projectBudget: number
  projectYear?: string
}

/** Latest formal plan milestones follow published plans, except version-owned end dates; budgets, capability dates and historical snapshots stay independent. */
export function synchronizeHrProjects<T extends SyncProject>(
  projects: readonly T[], category: HrProjectCategory,
  calculateMachineInvestment?: (level: string, model: string, coefficient: number) => number,
): T[] {
  return projects.map(input => {
    const project = synchronizeHrRegistryRecord(input, category)
    const normalized = { ...project, versions: normalizeHrVersionSequence(project.versions) }
    const source = isHrFormalRecord(project) ? resolveHrFormalSource(category, project.ipmProjectCode, project.pmsProjectId) : null
    const versions = normalized.versions.map(version => {
      if (!isLatestHrVersion(normalized, version)) return { ...version, nonLaborInvestment: withHrNonLaborRange(version.nonLaborInvestment, category, category === 'capability' ? version : version.milestones ?? {}) }
      const next = { ...version }
      if (source?.project && category !== 'capability' && version.budgetType !== 'annual') {
        next.milestones = mergeHrFormalMilestones(category, source.milestones, version.milestones)
        if (category === 'machine') next.projectLevel = source.projectLevel
      }
      if (category === 'machine') next.milestones = withMachineDerivedMilestones(next.milestones ?? {})
      if (category === 'machine' && calculateMachineInvestment) {
        next.estimatedInvestment = calculateMachineInvestment(next.projectLevel || '', next.hrModelVersion || '', next.levelCoefficient ?? 1)
      }
      next.nonLaborInvestment = withHrNonLaborRange(next.nonLaborInvestment, category, category === 'capability' ? next : next.milestones ?? {})
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
