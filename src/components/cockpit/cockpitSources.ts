import type { ProjectItem } from '@/types/app'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { ResourceStoreView } from '@/components/project-resources/resourceVersionAdapter'
import { dashboardSources, DASHBOARD_BUDGETS, selectDashboardSource } from '@/components/project-resources/resourceDashboardData'
import { resourceAccountingDataset } from '@/mock/resourceAccounting'
import { matchesHrCategory } from '@/lib/hrFormalProjectSource'
import { canResourceAction } from '@/lib/hrProjectRegistry'
import { getProjectAttribute } from '@/types/projectRegistry'
import { COCKPIT_CATEGORIES, type CockpitInput } from '@/components/cockpit/cockpitData'

type ResourceSources = Record<HrProjectCategory, Pick<ResourceStoreView, 'projects' | 'monthlyInvestments'>>

/** Read the same live stores and official-version selectors as each project's resource overview. */
export function collectCockpitInputs(registry: readonly ProjectItem[], stores: ResourceSources, actor: string): CockpitInput[] {
  return registry.flatMap(project => {
    if (getProjectAttribute(project) === 'roadmap' || project.boundFormalProjectId || !canResourceAction({ pmsProjectId: project.id }, 'view', project.id, actor)) return []
    const category = COCKPIT_CATEGORIES.find(item => matchesHrCategory(project, item.key))?.key
    if (!category) return []
    const store = stores[category]
    return [{ project, category, monthly: store.monthlyInvestments, dataset: resourceAccountingDataset(project.id),
      sources: DASHBOARD_BUDGETS.map(item => selectDashboardSource(dashboardSources(store.projects, project.id, item.key))),
    }]
  })
}
