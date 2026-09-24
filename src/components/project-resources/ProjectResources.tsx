'use client'
import { useState } from 'react'
import { Empty } from 'antd'
import { ProjectSpaceTabs } from '@/components/shared/ProjectSpaceTabs'
import { getProjectAttribute } from '@/types/projectRegistry'
import { matchesHrCategory } from '@/lib/hrFormalProjectSource'
import { useHasPermission } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { HrResourceScope } from '@/components/project-resources/HrResourceScope'
import ResourceVersionWorkspace from '@/components/project-resources/ResourceVersionWorkspace'
import ProjectResourceDashboard from '@/components/project-resources/ProjectResourceDashboard'
import { RESOURCE_TABS, type ResourceTab } from '@/components/project-resources/resourceVersionViewData'
import type { ProjectItem } from '@/types/app'

export default function ProjectResources({ project }: { project: ProjectItem }) {
  return <ResourceNavigation key={project.id} project={project} />
}
function ResourceNavigation({ project }: { project: ProjectItem }) {
  const actor = useProjectStore(state => state.currentLoginUser)
  const can = useHasPermission(actor, project.id)
  const [tab, setTab] = useState<ResourceTab>(getProjectAttribute(project) === 'budget' ? 'annual' : 'dashboard')
  const [detailVersionId, setDetailVersionId] = useState<string>()
  const category = matchesHrCategory(project, 'machine') ? 'machine' : matchesHrCategory(project, 'tos') ? 'tos'
    : matchesHrCategory(project, 'technical') ? 'technical' : 'capability'
  if (!can('resource:view')) return <Empty description="无项目资源查看权限" />
  return <HrResourceScope projectId={project.id}>
    <div className="pms-project-resources">
    <ProjectSpaceTabs className="pms-project-resource-tabs" navigationOnly activeKey={tab}
      onChange={key => useUiStore.getState().navigateWithEditGuard(() => { setTab(key as ResourceTab); setDetailVersionId(undefined) }, false)}
      items={RESOURCE_TABS.filter(item => getProjectAttribute(project) !== 'budget' || item.key === 'annual').map(item => ({ ...item }))} />
    {tab === 'dashboard' ? <ProjectResourceDashboard project={project} category={category} /> : tab === 'accounting'
      ? <div className="pms-resource-placeholder"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="项目核算待建设" /></div>
      : getProjectAttribute(project) === 'roadmap' ? <Empty description="路标项目暂无预算版本" />
        : <ResourceVersionWorkspace key={tab} project={project} category={category} budgetType={tab} initialVersionId={detailVersionId} />}
    </div>
  </HrResourceScope>
}
