export type MrPlanNavigationAction = 'clear-stale' | 'wait' | 'focus'

export function resolveMrPlanNavigationAction(input: {
  intentProjectId: string
  selectedProjectId?: string
  activeContextMatches: boolean
  targetAvailable: boolean
}): MrPlanNavigationAction {
  const intentProjectId = input.intentProjectId.trim()
  const selectedProjectId = input.selectedProjectId?.trim() ?? ''
  if (selectedProjectId && selectedProjectId !== intentProjectId) return 'clear-stale'
  if (!input.activeContextMatches || !input.targetAvailable) return 'wait'
  return 'focus'
}
