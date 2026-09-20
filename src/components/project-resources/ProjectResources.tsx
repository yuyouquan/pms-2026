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
import { RESOURCE_TABS, type ResourceTab } from '@/components/project-resources/resourceVersionViewData'
import type { ProjectItem } from '@/types/app'

export default function ProjectResources({ project }: { project: ProjectItem }) {
  return <ResourceNavigation key={project.id} project={project} />
}
function ResourceNavigation({ project }: { project: ProjectItem }) {
  const actor = useProjectStore(state => state.currentLoginUser)
  const can = useHasPermission(actor, project.id)
  const [tab, setTab] = useState<ResourceTab>(getProjectAttribute(project) === 'budget' ? 'annual' : 'projectEstimate')
  const category = matchesHrCategory(project, 'machine') ? 'machine' : matchesHrCategory(project, 'tos') ? 'tos'
    : matchesHrCategory(project, 'technical') ? 'technical' : 'capability'
  if (!can('basicInfo:查看')) return <Empty description="无项目资源查看权限" />
  return <HrResourceScope projectId={project.id}>
    <ProjectSpaceTabs className="pms-project-resource-tabs" navigationOnly activeKey={tab}
      onChange={key => useUiStore.getState().navigateWithEditGuard(() => setTab(key as ResourceTab), false)}
      items={RESOURCE_TABS.filter(item => getProjectAttribute(project) !== 'budget' || item.key === 'annual').map(item => ({ ...item }))} />
    {tab === 'dashboard' || tab === 'accounting'
      ? <div className="pms-resource-placeholder"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tab === 'dashboard' ? '项目资源看板待建设' : '项目核算待建设'} /></div>
      : getProjectAttribute(project) === 'roadmap' ? <Empty description="路标项目暂无预算版本" />
        : <ResourceVersionWorkspace key={tab} project={project} category={category} budgetType={tab} />}
  </HrResourceScope>
}
