import type { NonLaborInvestment } from '@/types/nonLaborInvestment'

export function mockNonLaborInvestment(versionId: string, minorVersion: number): NonLaborInvestment {
  return { startMonth: '2026-12', endMonth: '2027-02', items: [
    { id: versionId + '-transport', primaryDepartment: '研发中心', secondaryDepartment: '软件部', tertiaryDepartment: '驱动开发', subjectId: 'non-labor-transport-flight', secondarySubject: '交通费', tertiarySubject: '机票',
      monthlyAmounts: { '2026-12': 1200, '2027-01': 2500 + minorVersion * 1000, '2027-02': 0 } },
    { id: versionId + '-hotel', primaryDepartment: '研发中心', secondaryDepartment: '软件部', tertiaryDepartment: '驱动开发', subjectId: 'non-labor-travel-hotel', secondarySubject: '差旅费', tertiarySubject: '住宿费',
      monthlyAmounts: { '2026-12': 2000, '2027-01': 1500, '2027-02': minorVersion * 1000 } },
    { id: versionId + '-hardware-flight', primaryDepartment: '研发中心', secondaryDepartment: '硬件部', tertiaryDepartment: '电源设计', subjectId: 'non-labor-transport-flight', secondarySubject: '交通费', tertiarySubject: '机票',
      monthlyAmounts: { '2026-12': 800, '2027-01': 600, '2027-02': 450.5 } },
  ] }
}

/** Only backfill the shipped fixture versions, never user-created or explicitly cleared data. */
export function seedExistingMockNonLabor<T extends { versions: { id: string; minorVersion: number; nonLaborInvestment?: NonLaborInvestment }[] }>(projects: T[]): T[] {
  return projects.map(project => ({ ...project, versions: project.versions.map(version => {
    if (!/^hr-resource-(machine|tos|technical|capability)-.+-(annual|projectEstimate|projectBudget)-[1-9]\d*$/.test(version.id)) return version
    const value = version.nonLaborInvestment
    // Upgrade only untouched legacy fixtures. User amounts and cleared data stay intact.
    const oldAmounts = [[1.2, 2.5 + version.minorVersion, 0], [2, 1.5, version.minorVersion]]
    const oldIds = ['transport', 'hotel']
    const oldSubjects = [['non-labor-transport-flight', '交通费', '机票'], ['non-labor-travel-hotel', '差旅费', '住宿费']]
    const untouchedLegacy = value?.startMonth === '2026-12' && value.endMonth === '2027-02' && value.items.length === 2 && value.items.every((item, index) =>
      item.id === version.id + '-' + oldIds[index] && !item.secondaryDepartment && !item.tertiaryDepartment
      && item.subjectId === oldSubjects[index][0] && item.secondarySubject === oldSubjects[index][1] && item.tertiarySubject === oldSubjects[index][2]
      && Object.keys(item.monthlyAmounts).length === 3
      && ['2026-12', '2027-01', '2027-02'].every((month, monthIndex) => item.monthlyAmounts[month] === oldAmounts[index][monthIndex]),
    )
    return value === undefined || untouchedLegacy ? { ...version, nonLaborInvestment: mockNonLaborInvestment(version.id, version.minorVersion) } : version
  }) }))
}
