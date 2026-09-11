import { PROJECT_CATEGORY_MACHINE, PROJECT_TYPES, resolveProjectClassification } from '@/constants/projectTypes'
import type { ProjectItem } from '@/types/app'

export type ProjectAttribute = 'formal' | 'budget' | 'roadmap'
export type MachineBudgetMetadataField = 'brand' | 'productLine' | 'marketName'
export interface ProjectRegistryMetadata {
  projectAttribute?: ProjectAttribute
  boundFormalProjectId?: string | null
  /** Full canonical snapshot, or explicitly edited fields awaiting exact-ID legacy adoption. */
  machineBudgetMetadataAuthority?: 'registry-v1' | MachineBudgetMetadataField[]
  createdBy?: string
  createdAt?: string
}
export interface ConfiguredProjectInput {
  projectAttribute: ProjectAttribute
  sourceBid?: string
  name?: string
  type?: string
  responsiblePersons: string[]
}
export interface ConfiguredProjectUpdates {
  name?: string
  projectCode?: string
  boundFormalProjectId?: string | null
}
export type RegistryMutationResult = { ok: true; projectId: string } | { ok: false; message: string }
export const PROJECT_ATTRIBUTE_LABELS: Record<ProjectAttribute, string> = {
  formal: '正式项目', budget: '预算项目', roadmap: '路标项目',
}
export const getProjectAttribute = (project: ProjectRegistryMetadata): ProjectAttribute => project.projectAttribute ?? 'formal'
export const isFormalProject = (project: ProjectRegistryMetadata): boolean => getProjectAttribute(project) === 'formal'
export const getRegistryProjectTypes = (attribute: ProjectAttribute): readonly string[] => (
  attribute === 'roadmap' ? [PROJECT_CATEGORY_MACHINE] : PROJECT_TYPES
)
export const getRegistryProjectCategory = (project: Pick<ProjectItem, 'type'>): string => resolveProjectClassification(project.type).projectCategory
export type ProjectRegistryAction = 'create' | 'update' | 'bind' | 'rebind' | 'unbind' | 'delete'
export interface ProjectRegistryChange { field: string; before: unknown; after: unknown }
export interface ProjectRegistryHistoryEntry {
  id: string
  projectId: string
  action: ProjectRegistryAction
  actor: string
  timestamp: string
  changes: ProjectRegistryChange[]
  before: ProjectItem | null
  after: ProjectItem | null
}
