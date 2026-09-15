import type { NonLaborInvestment } from '@/types/nonLaborInvestment'

export function mockNonLaborInvestment(versionId: string, minorVersion: number): NonLaborInvestment {
  return { startMonth: '2026-12', endMonth: '2027-02', items: [
    { id: versionId + '-transport', subjectId: 'non-labor-transport-flight', secondarySubject: '交通费', tertiarySubject: '机票',
      monthlyAmounts: { '2026-12': 1.2, '2027-01': 2.5 + minorVersion, '2027-02': 0 } },
    { id: versionId + '-hotel', subjectId: 'non-labor-travel-hotel', secondarySubject: '差旅费', tertiarySubject: '住宿费',
      monthlyAmounts: { '2026-12': 2, '2027-01': 1.5, '2027-02': minorVersion } },
  ] }
}

/** Only backfill the shipped fixture versions, never user-created or explicitly cleared data. */
export function seedExistingMockNonLabor<T extends { versions: { id: string; minorVersion: number; nonLaborInvestment?: NonLaborInvestment }[] }>(projects: T[]): T[] {
  return projects.map(project => ({ ...project, versions: project.versions.map(version =>
    version.nonLaborInvestment === undefined && /^hr-resource-(machine|tos|technical|capability)-.+-(annual|projectEstimate|projectBudget)-[1-9]\d*$/.test(version.id)
      ? { ...version, nonLaborInvestment: mockNonLaborInvestment(version.id, version.minorVersion) }
      : version),
  }))
}
