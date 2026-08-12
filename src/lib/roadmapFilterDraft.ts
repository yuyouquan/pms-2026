export interface RoadmapFilterDraftTransition<T> {
  wasOpen: boolean
  open: boolean
  draft: readonly T[]
  applied: readonly T[]
}

/**
 * Applied filters may change while a floating panel is open. That state update must
 * never replace the user's in-progress row; only a closed-to-open transition hydrates
 * the draft from the store.
 */
export function resolveRoadmapFilterDraft<T>({
  wasOpen,
  open,
  draft,
  applied,
}: RoadmapFilterDraftTransition<T>): T[] {
  return [...(open && !wasOpen ? applied : draft)]
}
