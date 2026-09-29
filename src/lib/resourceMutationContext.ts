import { useProjectStore } from '@/stores/project'
import { projectTeamScopeToken } from '@/lib/projectTeamMutationGuard'

/** Captured by the rendered operation, before a dialog, edit or asynchronous parser opens. */
export interface ResourceOpening {
  category: string
  scopeId: string
  projectId?: string
  versionId?: string
  actor: string
  sourceToken: string
}
export function captureResourceOpening(category: string, scopeId: string, projectId?: string, versionId?: string): ResourceOpening {
  return { category, scopeId, projectId, versionId, actor: useProjectStore.getState().currentLoginUser, sourceToken: projectTeamScopeToken(scopeId) }
}
export function isResourceOpeningCurrent(opening: ResourceOpening): boolean {
  const live = useProjectStore.getState()
  return live.currentLoginUser === opening.actor && live.selectedProject?.id === opening.scopeId
    && projectTeamScopeToken(opening.scopeId) === opening.sourceToken
}
let openingContext: ResourceOpening | undefined
export function assertResourceOpening(category: string, projectId: string, versionId?: string): void {
  if (openingContext && (!isResourceOpeningCurrent(openingContext) || openingContext.category !== category
    || openingContext.projectId !== projectId || (openingContext.versionId !== undefined && openingContext.versionId !== versionId))) {
    throw new Error('当前用户、项目、来源或版本已变化，请重新操作')
  }
}
/** Wrap only the final synchronous operation, never an await; background hydration has no opening context. */
export function withResourceOpening<T>(opening: ResourceOpening, mutate: () => T): T {
  if (!isResourceOpeningCurrent(opening)) throw new Error('当前用户、项目或来源已变化，请重新操作')
  const previous = openingContext
  openingContext = opening
  try { return mutate() } finally { openingContext = previous }
}

/** Synchronous action context for canonical metadata writes inside a resource transaction. */
interface ResourceMutationContext { category: string; projectId?: string; versionId?: string; action: string }
let current: ResourceMutationContext | undefined
export const getResourceMutationContext = () => current
export function withResourceMutationContext<T>(context: ResourceMutationContext, mutate: () => T): T {
  const previous = current
  current = context
  try { return mutate() } finally { current = previous }
}
