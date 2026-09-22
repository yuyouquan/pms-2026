import type { ResourceAccountingDataset } from '@/types/resourceAccounting'
import { buildAccountingAnalysis, UNASSIGNED_PRIMARY, type DashboardFilter } from '@/components/project-resources/resourceAccounting'

/** Deliberately ignore the dashboard date/year filter: this is life-to-date actual labor. */
export function buildCumulativeLabor(dataset: ResourceAccountingDataset | undefined, filter: DashboardFilter, today: string, projectStart?: string) {
  const actual = buildAccountingAnalysis(dataset, 0, { primary: filter.primary, department: filter.department, startDate: projectStart, endDate: today })
  if (!actual) return undefined
  const groups = new Map<string, { key: string; primary: string; secondary: string; personDays: number; labor: number; people: Set<string> }>()
  actual.worklogs.forEach(row => {
    const primary = row.primaryDepartment || UNASSIGNED_PRIMARY, secondary = row.secondaryDepartment || '未归属二级部门'
    const key = JSON.stringify([primary, secondary])
    const group = groups.get(key) ?? { key, primary, secondary, personDays: 0, labor: 0, people: new Set<string>() }
    group.personDays += row.personDays; group.labor += row.labor; group.people.add(row.person); groups.set(key, group)
  })
  return { today, startDate: projectStart && projectStart > actual.dataset.startDate ? projectStart : actual.dataset.startDate,
    personDays: actual.personDays, labor: actual.labor, peopleCount: new Set(actual.worklogs.map(row => row.person)).size, issues: actual.issues,
    rows: [...groups.values()].map(({ people, ...row }) => ({ ...row, peopleCount: people.size, share: actual.labor > 0 ? row.labor / actual.labor * 100 : 0 }))
      .sort((a, b) => a.primary.localeCompare(b.primary, 'zh-CN') || a.secondary.localeCompare(b.secondary, 'zh-CN')) }
}
export type CumulativeLabor = ReturnType<typeof buildCumulativeLabor>
