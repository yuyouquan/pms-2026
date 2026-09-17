'use client'
import { Alert, Empty } from 'antd'
import { ProjectSpaceTabs } from '@/components/shared/ProjectSpaceTabs'
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
  return <HrResourceScope key={project.id} projectId={project.id}><ProjectSpaceTabs className="pms-project-resource-tabs" defaultActiveKey="estimate" items={[
    { key: 'estimate', label: '项目预估投入', children: <>
      {getProjectAttribute(project) === 'budget' && project.boundFormalProjectId && <Alert type="info" showIcon style={{ marginBottom: 8 }} title="已绑定正式项目，当前预算只读；解绑后可新增或修改预算。" />}
      {content}
    </> },
    { key: 'dashboard', label: '项目资源看板', children: <Empty description="暂无项目资源看板" /> },
  ]} /></HrResourceScope>
}
