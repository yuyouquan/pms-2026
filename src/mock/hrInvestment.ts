import type { HrMachineProject, HrMachineVersion, BudgetType, MilestoneNodes } from '@/types/hrMachine'
import type { HrTosProject, HrTosVersion, TosMilestoneNodes } from '@/types/hrTos'
import type { HrTechnicalProject, HrTechnicalVersion, TechMilestoneNodes } from '@/types/hrTechnical'
import type { HrCapabilityProject, HrCapabilityVersion } from '@/types/hrCapability'

/** Stable, additive fixtures: migrations never replace existing projects or resurrect later deletions. */
export function appendHrMockProjects<T extends { id: string }>(existing: T[], additions: T[]): T[] {
  const ids = new Set(existing.map(project => project.id))
  return [...existing, ...additions.filter(project => !ids.has(project.id))]
}

type FormalOption = { code: string; name: string }
const SCENARIOS = ['多预算对比', '年度方案调整', '跨年研发', '里程碑待完善', '已取消方案', '筹备方案']
const NAMES = { machine: '示例整机', tos: '示例tOS', technical: '示例技术', capability: '示例能力建设' }
type Category = keyof typeof NAMES
const round = (value: number) => Math.round(value * 10) / 10
const DEPARTMENTS = [
  { primaryDepartment: '研发中心', secondaryDepartment: '产品部' },
  { primaryDepartment: '研发中心', secondaryDepartment: '软件部' },
  { primaryDepartment: '硬件部', secondaryDepartment: '结构部' },
]

function baseProject(category: Category, scenario: number, options: FormalOption[]) {
  const formal = [0, 1, 4].includes(scenario) ? options[scenario === 1 ? 1 : 0] ?? options[0] : undefined
  return {
    id: `hr-demo-202609-${category}-${scenario + 1}`,
    name: `${NAMES[category]}-${SCENARIOS[scenario]}`,
    projectTarget: `用于演示${SCENARIOS[scenario]}下的预算、部门投入及月度分配。`,
    ipmProjectCode: formal?.code ?? null,
    ipmProjectName: formal?.name ?? null,
    status: scenario === 4 ? 'cancelled' as const : 'active' as const,
    annualBudget: 0, projectEstimate: 0, projectBudget: 0,
    projectAccounting: scenario === 0 ? 28.6 : scenario === 4 ? 12.5 : 0,
    createdAt: `2026-0${scenario + 1}-02T08:00:00.000Z`,
  }
}

function versionSpecs(project: ReturnType<typeof baseProject>, scenario: number) {
  const counts: [BudgetType, number][] = scenario === 5 ? [] : scenario === 0
    ? [['annual', 3], ['projectEstimate', 2], ['projectBudget', 1]]
    : scenario === 4 ? [['annual', 1], ['projectBudget', 1]]
    : [['annual', scenario === 3 ? 1 : 2]]
  let order = 0
  return counts.flatMap(([budgetType, count]) => {
    if (budgetType !== 'annual' && !project.ipmProjectCode) return []
    return Array.from({ length: count }, (_, index) => {
      order++
      return {
        id: `${project.id}-${budgetType}-${index + 1}`, projectId: project.id, budgetType,
        versionNumber: `V0.${index + 1}`, majorVersion: 0, minorVersion: index + 1,
        lockState: 'unlocked' as const, lockedAt: null, batch: null,
        createdBy: ['演示用户01', '演示用户02', '演示用户03'][index % 3],
        createdAt: `2026-0${scenario + 1}-${String(order + 2).padStart(2, '0')}T09:00:00.000Z`,
      }
    })
  })
}

function dates(scenario: number, minor: number): (string | null)[] {
  if (scenario === 3) return ['2026-08-01', '2026-09-01', null, null, null, null, null]
  const startYear = scenario === 2 ? 2026 : 2025
  const endYear = startYear + 1
  return [`${startYear}-11-01`, `${startYear}-12-01`, `${endYear}-01-15`, `${endYear}-02-20`, `${endYear}-04-10`, `${endYear}-0${minor > 1 ? 6 : 5}-15`, `${endYear}-10-31`]
}
const machineDates = (d: (string | null)[]): MilestoneNodes => ({ conceptStart: d[0], str1: d[1], str3: d[2], str4: d[3], str5: d[4], productLaunch: d[5] })
const tosDates = (d: (string | null)[]): TosMilestoneNodes => ({ planningKO: d[0], conceptStart: d[1], str1: d[2], str3: d[3], str5: d[4], marketIteration: d[5], maintenanceEnd: d[6] })
const techDates = (d: (string | null)[]): TechMilestoneNodes => ({ planningStart: d[0], charterDCP: d[1], tdr1: d[2], pdcp: d[3], tdcpx: d[4], edcp: d[5] })

function departmentValues(versionId: string, scenario: number, minor: number, phaseCount: number) {
  return DEPARTMENTS.map((department, index) => {
    const phases = Array.from({ length: phaseCount }, (_, phase) => round((index + 1) * (phase + 1) * 0.7 + minor * 0.3 + scenario))
    return { id: `${versionId}-department-${index + 1}`, ...department, phases, estimatedInvestment: round(phases.reduce((sum, v) => sum + v, 0)) }
  })
}
const operationLogs = (version: ReturnType<typeof versionSpecs>[number]) => [{
  id: `${version.id}-created`, operation: 'created' as const, operator: version.createdBy,
  timestamp: version.createdAt, description: `创建${version.versionNumber}预估投入版本`,
}]

export function createAdditionalMachineProjects(options: FormalOption[]): HrMachineProject[] {
  return SCENARIOS.map((_, scenario) => {
    const base = baseProject('machine', scenario, options)
    const level = scenario === 2 ? 'A' : scenario === 3 ? 'B' : 'S'
    const coefficient = scenario === 2 ? 1.25 : 1
    const versions: HrMachineVersion[] = versionSpecs(base, scenario).map(version => ({
      ...version, projectLevel: level, levelCoefficient: coefficient, hrModelVersion: 'V2026.1',
      estimatedInvestment: (level === 'B' ? 52 : 100) * coefficient,
      milestones: machineDates(dates(scenario, version.minorVersion)),
    }))
    return { ...base, brand: scenario % 2 === 0 ? 'TECNO' : 'Infinix', productLine: scenario % 2 === 0 ? 'CAMON' : 'NOTE', projectLevel: level, levelCoefficient: coefficient, hrModelVersion: 'V2026.1', projectYear: '-', versions }
  })
}

export function createAdditionalTosProjects(options: FormalOption[]): HrTosProject[] {
  return SCENARIOS.map((_, scenario) => {
    const base = baseProject('tos', scenario, options)
    const versions: HrTosVersion[] = versionSpecs(base, scenario).map(version => {
      const departmentInvestments = departmentValues(version.id, scenario, version.minorVersion, 6).map(({ phases, ...department }) => ({
        ...department, planningPhase: phases[0], conceptPhase: phases[1], planningPhase2: phases[2], developmentValidationPhase: phases[3], marketIterationPhase: phases[4], maintenancePhase: phases[5],
      }))
      return { ...version, milestones: tosDates(dates(scenario, version.minorVersion)), departmentInvestments, estimatedInvestment: round(departmentInvestments.reduce((sum, d) => sum + d.estimatedInvestment, 0)), operationLogs: operationLogs(version) }
    })
    return { ...base, versions }
  })
}

export function createAdditionalTechnicalProjects(options: FormalOption[]): HrTechnicalProject[] {
  return SCENARIOS.map((_, scenario) => {
    const base = baseProject('technical', scenario, options)
    const versions: HrTechnicalVersion[] = versionSpecs(base, scenario).map(version => {
      const departmentInvestments = departmentValues(version.id, scenario, version.minorVersion, 5).map(({ phases, ...department }) => ({
        ...department, planningPhase: phases[0], conceptPhase: phases[1], planPhase: phases[2], developmentPhase: phases[3], migrationPhase: phases[4],
      }))
      return { ...version, milestones: techDates(dates(scenario, version.minorVersion)), departmentInvestments, estimatedInvestment: round(departmentInvestments.reduce((sum, d) => sum + d.estimatedInvestment, 0)), operationLogs: operationLogs(version) }
    })
    return { ...base, tdtName: base.name, planningYear: scenario === 2 ? '2027' : '2026', techDomain: 'AI技术', tmg: 'AITMG', techTrack: 'AI框架', subTrack: '推理优化', subTaskName: SCENARIOS[scenario], versions }
  })
}

export function createAdditionalCapabilityProjects(options: FormalOption[]): HrCapabilityProject[] {
  return SCENARIOS.map((_, scenario) => {
    const base = baseProject('capability', scenario, options)
    const versions: HrCapabilityVersion[] = versionSpecs(base, scenario).map(version => {
      const d = dates(scenario, version.minorVersion)
      const departmentInvestments = departmentValues(version.id, scenario, version.minorVersion, 1).map(({ phases: _phases, ...department }) => ({ ...department, estimatedInvestment: round(department.estimatedInvestment * 6) }))
      return { ...version, projectStartTime: d[0] ?? '', projectEndTime: d[5] ?? '', departmentInvestments, estimatedInvestment: round(departmentInvestments.reduce((sum, item) => sum + item.estimatedInvestment, 0)), operationLogs: operationLogs(version) }
    })
    return { ...base, versions }
  })
}
