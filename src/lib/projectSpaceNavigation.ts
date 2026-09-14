import { getProjectAttribute } from '@/types/projectRegistry'
import type { ProjectItem } from '@/types/app'

export function getProjectSpaceModules(project: Pick<ProjectItem, 'projectAttribute'> | null) {
  if (!project) return null
  const attribute = getProjectAttribute(project)
  return attribute === 'budget' ? ['resources', 'permission'] : attribute === 'roadmap' ? ['basic', 'permission'] : null
}

export function resolveProjectSpaceModule(project: Pick<ProjectItem, 'projectAttribute'> | null, requested: string) {
  const allowed = getProjectSpaceModules(project)
  return allowed && !allowed.includes(requested) ? allowed[0] : requested
}
