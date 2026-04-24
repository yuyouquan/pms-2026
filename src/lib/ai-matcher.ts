import type { ScenarioConfig, ScenarioVars, MatchResult } from '@/types/ai'

export function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim()
}

type ProjectRef = { id: string; name: string }

/**
 * Find a project name in the input using:
 * 1. Exact substring match (longest first)
 * 2. Fuzzy match: strip whitespace from both sides, compare
 */
export function extractProjectName(
  input: string,
  projects: ProjectRef[],
): string | null {
  const normInput = normalize(input)
  const normNoSpace = normInput.replace(/\s+/g, '')

  // Sort by length desc to prefer longest match
  const sorted = [...projects].sort((a, b) => b.name.length - a.name.length)

  for (const p of sorted) {
    const normName = p.name.toLowerCase()
    const normNameNoSpace = normName.replace(/\s+/g, '')
    // Strip version "v" prefix before digits (e.g. "mrv2.3" → "mr2.3")
    const normNameNoV = normNameNoSpace.replace(/v(\d)/g, '$1')
    if (
      normInput.includes(normName) ||
      normNoSpace.includes(normNameNoSpace) ||
      normNoSpace.includes(normNameNoV) ||
      normNameNoSpace.includes(normNoSpace) ||
      normNameNoV.includes(normNoSpace)
    ) {
      return p.name
    }
  }
  return null
}

type MatchCtx = {
  projects: ProjectRef[]
  currentProject: string | null
  scenarios: ScenarioConfig[]
}

export function matchScenario(rawInput: string, ctx: MatchCtx): MatchResult {
  const normInput = normalize(rawInput)
  const projectName = extractProjectName(rawInput, ctx.projects) ?? ctx.currentProject ?? undefined

  // Find keyword matches across ALL non-terminal scenarios (ignoring requiresProject for now)
  const keywordMatched = ctx.scenarios
    .filter(s => s.id !== 'fallback' && s.id !== 'ask-for-project')
    .filter(s => s.keywords.some(group => group.every(kw => normInput.includes(kw.toLowerCase()))))
    .sort((a, b) => b.priority - a.priority)

  if (keywordMatched.length === 0) {
    return { scenarioId: 'fallback', variables: { rawInput } }
  }

  const chosen = keywordMatched[0]

  // If chosen scenario requires project but none available → ask user
  if (chosen.requiresProject && !projectName) {
    return {
      scenarioId: 'ask-for-project',
      variables: { rawInput, intendedScenarioId: chosen.id },
    }
  }

  const variables: ScenarioVars = { projectName, rawInput }

  // Scenario #2 (project-plans) modifier extraction
  if (chosen.id === 'project-plans' && chosen.modifiers) {
    const hasOwnership = (chosen.modifiers.ownership ?? []).some(w => normInput.includes(w))
    variables.ownership = hasOwnership ? 'mine' : 'all'
    const foundType = (chosen.modifiers.planType ?? []).find(w => normInput.includes(w))
    if (foundType) variables.planType = foundType as ScenarioVars['planType']
  }

  return { scenarioId: chosen.id, variables }
}
