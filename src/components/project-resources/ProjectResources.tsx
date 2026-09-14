'use client'
import { Empty, Tabs } from 'antd'
import { getProjectAttribute } from '@/types/projectRegistry'
import { matchesHrCategory } from '@/lib/hrFormalProjectSource'
import { hasPermission } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { HrResourceScope } from '@/components/project-resources/HrResourceScope'
import MachineProjectContent from '@/components/hr-machine/MachineProjectContent'
import TosProjectContent from '@/components/hr-tos/TosProjectContent'
import TechnicalProjectContent from '@/components/hr-technical/TechnicalProjectContent'
import CapabilityProjectContent from '@/components/hr-capability/CapabilityProjectContent'
import type { ProjectItem } from '@/types/app'
export default function ProjectResources({ project }: { project: ProjectItem }) {
  const actor = useProjectStore(state => state.currentLoginUser)
  if (!hasPermission(actor, project.id, 'basicInfo:查看')) return <Empty description="无项目资源查看权限" />
  const content = getProjectAttribute(project) === 'roadmap' ? <Empty description="路标项目暂无预估投入" />
    : matchesHrCategory(project, 'machine') ? <MachineProjectContent />
      : matchesHrCategory(project, 'tos') ? <TosProjectContent />
        : matchesHrCategory(project, 'technical') ? <TechnicalProjectContent /> : <CapabilityProjectContent />
  return <HrResourceScope key={project.id} projectId={project.id}><Tabs defaultActiveKey="estimate" items={[
    { key: 'estimate', label: '项目预估投入', children: content },
    { key: 'dashboard', label: '项目资源看板', children: <Empty description="暂无项目资源看板" /> },
  ]} /></HrResourceScope>
}
