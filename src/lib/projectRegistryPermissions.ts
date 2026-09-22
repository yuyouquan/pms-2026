import { PROJECT_TYPES, resolveProjectClassification } from '@/constants/projectTypes'
import { getProjectAttribute, getRegistryProjectTypes, type ProjectAttribute } from '@/types/projectRegistry'

const FORMAL_MANAGERS: Record<string, readonly string[]> = {
  '整机产品项目': ['乔永峰', '徐如秀（大圆）'],
  'tOS版本项目': ['孙仁海', '游进'],
  '技术项目': ['邓伟俊', '陈佩玲'],
  '能力建设项目': ['游进'],
}
export const BUDGET_PROJECT_MANAGER = '游进'
export const ROADMAP_PROJECT_MANAGER = '王健（Jim）'
export const PROJECT_REGISTRY_MANAGERS = [...new Set([
  ...Object.values(FORMAL_MANAGERS).flat(), BUDGET_PROJECT_MANAGER, ROADMAP_PROJECT_MANAGER,
])]

const identity = (name: string) => name.trim().normalize('NFKC')

/** Registry authority does not confer membership or editing rights inside a project space. */
export function canConfigureProjectScope(actor: string, attribute: ProjectAttribute, type: string, isAdmin: boolean): boolean {
  if (!actor.trim() || !['formal', 'budget', 'roadmap'].includes(attribute)) return false
  const category = resolveProjectClassification(type).projectCategory
  if (!getRegistryProjectTypes(attribute).includes(category)) return false
  if (isAdmin) return true
  const managers = attribute === 'budget' ? [BUDGET_PROJECT_MANAGER]
    : attribute === 'roadmap' ? [ROADMAP_PROJECT_MANAGER] : FORMAL_MANAGERS[category] ?? []
  return managers.some(manager => identity(manager) === identity(actor))
}

export function canEditProjectRegistry(actor: string, project: { projectAttribute?: ProjectAttribute; type: string }, isAdmin: boolean): boolean {
  return canConfigureProjectScope(actor, getProjectAttribute(project), project.type, isAdmin)
}

export const getCreatableProjectTypes = (actor: string, attribute: ProjectAttribute, isAdmin: boolean): string[] => (
  getRegistryProjectTypes(attribute).filter(type => canConfigureProjectScope(actor, attribute, type, isAdmin))
)

export const getCreatableProjectAttributes = (actor: string, isAdmin: boolean): ProjectAttribute[] => (
  (['formal', 'budget', 'roadmap'] as const).filter(attribute => PROJECT_TYPES.some(type => canConfigureProjectScope(actor, attribute, type, isAdmin)))
)

export const canAccessProjectRegistry = (actor: string, isAdmin: boolean): boolean => getCreatableProjectAttributes(actor, isAdmin).length > 0
