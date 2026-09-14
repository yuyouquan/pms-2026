import { PROJECT_CATEGORY_CAPABILITY } from '@/constants/projectTypes'
import { getProjectAttribute } from '@/types/projectRegistry'
import type { ProjectItem } from '@/types/app'

export function getProjectSpaceModules(project: Pick<ProjectItem, 'projectAttribute'> & Partial<Pick<ProjectItem, 'type'>> | null) {
  if (!project) return null
  const attribute = getProjectAttribute(project)
  return attribute === 'budget' || project.type === PROJECT_CATEGORY_CAPABILITY ? ['resources', 'permission'] : attribute === 'roadmap' ? ['basic', 'permission'] : null
}

export function resolveProjectSpaceModule(project: Pick<ProjectItem, 'projectAttribute'> & Partial<Pick<ProjectItem, 'type'>> | null, requested: string) {
  const allowed = getProjectSpaceModules(project)
  return allowed && !allowed.includes(requested) ? allowed[0] : requested
}
