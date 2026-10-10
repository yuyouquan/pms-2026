import type { CockpitMode, CockpitScope } from '@/components/cockpit/cockpitData'
import { isSoftwareDepartment } from '@/components/cockpit/cockpitData'
import { validDashboardDate } from '@/components/project-resources/resourceDashboardPeriods'
import { dashboardDepartmentParents, type DashboardFilter } from '@/components/project-resources/resourceAccounting'

/** Navigation choices only. Resource values and grants are always resolved live. */
export interface ResourceDashboardContext {
  actor: string
  projectId: string
  dates: [string, string]
  scope: CockpitScope
  departments: string[]
  mode: CockpitMode
}

export function resolveResourceDashboardContext(context: ResourceDashboardContext | undefined, actor: string, projectId: string) {
  if (!context || context.actor !== actor || context.projectId !== projectId
    || !context.dates.every(validDashboardDate) || context.dates[0] > context.dates[1]) return undefined
  return context
}

export function cockpitResourceFilter(context: ResourceDashboardContext, dates: [string, string], today: string,
  canReadDepartment: (primary: string, secondary: string) => boolean): DashboardFilter {
  return {
    primaryLabel: context.scope === 'software' ? '软件工程部' : '全研发', departmentLabel: context.departments.length ? context.departments.join('、') : '全部二级部门',
    startDate: dates[0], endDate: dates[1], asOfDate: today, cumulativeFromDate: dates[0],
    acceptDepartment: (primary, secondary) => canReadDepartment(primary, secondary)
      && (context.scope === 'all' || isSoftwareDepartment(primary))
      && (!context.departments.length || context.departments.includes(secondary || '未填二级部门')),
  }
}

/** Cockpit uses only source attribution; ordinary project entry retains its config fallback. */
export function resourceDashboardDepartmentParents(pairs: { primaryDepartment: string; secondaryDepartment: string }[], fallback: Record<string, string>, inherited: boolean) {
  return { ...(!inherited ? fallback : {}), ...dashboardDepartmentParents(pairs) }
}
