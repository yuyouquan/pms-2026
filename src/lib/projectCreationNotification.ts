import type { ProjectItem } from '@/types/app'
import { getProjectAttribute, PROJECT_ATTRIBUTE_LABELS, type ProjectCreationNotification } from '@/types/projectRegistry'
import { getProjectResponsiblePersons } from '@/lib/projectResponsibility'
import { BUDGET_PROJECT_MANAGER, ROADMAP_PROJECT_MANAGER } from '@/lib/projectRegistryPermissions'
import { buildProjectInfoLink } from '@/lib/projectInfoLink'

/** A persisted simulation receipt; never represents a request to Feishu's API. */
export function buildProjectCreationNotification(project: ProjectItem): ProjectCreationNotification | undefined {
  const attribute = getProjectAttribute(project)
  const role = ({ '整机产品项目': 'SPM', 'tOS版本项目': '版本项目经理', '技术项目': '技术项目负责人' } as Record<string, string>)[project.type]
  if (attribute === 'formal' && !role) return undefined
  const recipients = [...new Set(attribute === 'budget' ? [BUDGET_PROJECT_MANAGER]
    : attribute === 'roadmap' ? [ROADMAP_PROJECT_MANAGER] : getProjectResponsiblePersons(project))]
  if (!recipients.length) return undefined
  return {
    status: 'simulated', recipients, timestamp: project.createdAt || new Date().toISOString(),
    subject: `${project.name}--请补全项目信息`,
    actionUrl: buildProjectInfoLink(project.id),
    body: [
      `项目属性：${PROJECT_ATTRIBUTE_LABELS[attribute]}`,
      `项目类型：${project.type}`,
      `创建人：${project.createdBy || '—'}`,
      '请进入项目空间，补全项目基础信息、项目团队及计划信息。',
    ].join('\n'),
  }
}
