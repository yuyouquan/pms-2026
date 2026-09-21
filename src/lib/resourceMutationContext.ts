/** Synchronous action context for canonical metadata writes inside a resource transaction. */
interface ResourceMutationContext { category: string; projectId?: string; versionId?: string; action: string }
let current: ResourceMutationContext | undefined
export const getResourceMutationContext = () => current
export function withResourceMutationContext<T>(context: ResourceMutationContext, mutate: () => T): T {
  const previous = current
  current = context
  try { return mutate() } finally { current = previous }
}
