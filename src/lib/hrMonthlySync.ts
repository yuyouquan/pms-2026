interface MonthlyRow {
  id: string
  projectId: string
  versionId: string
  primaryDepartment: string
  secondaryDepartment: string
  estimatedTotal: number
  monthlyData: Record<string, number>
  isEdited: boolean
  allocationBasis?: string
  sourceRowId?: string
  isArchived?: boolean
}

/** Dates and metadata are excluded: only upstream effort changes replace manual allocations. */
export function hrMonthlyAllocationBasis(total: number, phases: Record<string, number>, ratios: Record<string, number> = {}): string {
  const ordered = (values: Record<string, number>) => Object.keys(values).sort().map(key => [key, values[key]])
  return JSON.stringify([total, ordered(phases), ordered(ratios)])
}

/** Rows removed from the current source remain stored, but never enter live totals. */
export function selectActiveHrMonthlyRows<T extends { isArchived?: boolean }>(rows: readonly T[]): T[] {
  return rows.filter(row => !row.isArchived)
}

// Registry migration may change the HR project prefix while version and department identities stay stable.
function stableDepartmentSource(row: MonthlyRow): string | undefined {
  const identity = row.sourceRowId ?? row.id
  const marker = `-${row.versionId}-source-`
  const index = identity.indexOf(marker)
  return index >= 0 ? JSON.stringify([row.versionId, identity.slice(index + marker.length)]) : undefined
}

/** Match by source row identity; department names alone are not unique. */
export function preserveHrMonthlyEdits<T extends MonthlyRow>(generated: T[], existing: T[]): T[] {
  const byId = new Map(existing.map(row => [row.id, row]))
  const byDepartment = new Map<string, T[]>()
  const bySource = new Map<string, T[]>()
  existing.forEach(row => {
    const source = stableDepartmentSource(row)
    if (source) bySource.set(source, [...(bySource.get(source) ?? []), row])
  })
  const keyOf = (row: T) => JSON.stringify([row.versionId, row.primaryDepartment, row.secondaryDepartment])
  existing.forEach(row => byDepartment.set(keyOf(row), [...(byDepartment.get(keyOf(row)) ?? []), row]))
  const versionIndexes = new Map<string, number>()
  const used = new Set<string>()
  const synchronized = generated.map(record => {
    const index = versionIndexes.get(record.versionId) ?? 0
    versionIndexes.set(record.versionId, index + 1)
    // Name/index fallback is only for legacy rows without stable source identity.
    // A new department with the same name must not inherit a removed source's edits.
    const candidates = (byDepartment.get(keyOf(record)) ?? []).filter(row => !row.sourceRowId && !row.id.includes('-source-') && !row.id.startsWith(`${row.versionId}|`))
    // Previous releases used the department's index. Migrate that ID without losing its edit.
    const legacyId = `mi-${record.projectId}-${record.versionId}-dept${index}`
    const sourceMatches = bySource.get(stableDepartmentSource(record) ?? '') ?? []
    const previous = byId.get(record.id) ?? existing.find(row => row.sourceRowId === record.id) ?? (sourceMatches.length === 1 ? sourceMatches[0] : undefined) ?? (byId.get(legacyId)?.sourceRowId ? undefined : byId.get(legacyId)) ?? (candidates.length === 1 ? candidates[0] : undefined)
    if (!previous || used.has(previous.id)) return { ...record, sourceRowId: record.id, isArchived: false }
    used.add(previous.id)
    // Adopt a baseline for legacy saved rows; subsequent effort/ratio changes regenerate only this source row.
    const effortChanged = previous.allocationBasis !== undefined && record.allocationBasis !== undefined && previous.allocationBasis !== record.allocationBasis
    return previous.isEdited && !effortChanged ? { ...record, id: previous.id, sourceRowId: record.id, isArchived: false, monthlyData: { ...previous.monthlyData }, isEdited: true } : { ...record, id: previous.id, sourceRowId: record.id, isArchived: false }
  })
  return [...synchronized, ...existing.filter(row => !used.has(row.id) && !synchronized.some(next => next.id === row.id)).map(row => ({ ...row, isArchived: true }))]
}

/** A locked version's saved allocation rows are a snapshot, even when model configuration changes. */
export function preserveLockedHrMonthlyRows<T extends MonthlyRow>(generated: T[], existing: T[], projects: readonly { versions: readonly { id: string; lockState?: string }[] }[]): T[] {
  const locked = new Set(projects.flatMap(project => project.versions.filter(version => version.lockState === 'locked').map(version => version.id)))
  const generatedIds = new Set(generated.map(row => row.id))
  const lockedRows = existing.filter(row => locked.has(row.versionId))
  // Reuse source/legacy identity matching without taking its regenerated amounts into locked rows.
  const baselines = new Map(preserveHrMonthlyEdits(generated.filter(row => locked.has(row.versionId)), lockedRows).map(row => [row.id, row.allocationBasis]))
  // Legacy latest-only synchronization archived historical versions. Restore source-present rows without changing their allocations.
  const saved = lockedRows.map(row => {
    const sourceId = row.sourceRowId ?? row.id
    const restored = row.isArchived && generatedIds.has(sourceId) ? { ...row, isArchived: false } : row
    // Establish the old source baseline before a legacy locked version is unlocked and edited.
    // This migration only adds metadata; the saved monthly amounts remain a locked snapshot.
    const basis = baselines.get(row.id)
    return restored.allocationBasis === undefined && basis !== undefined ? { ...restored, allocationBasis: basis } : restored
  })
  const savedVersions = new Set(saved.map(row => row.versionId))
  return [...preserveHrMonthlyEdits(generated.filter(row => !savedVersions.has(row.versionId)), existing.filter(row => !savedVersions.has(row.versionId))), ...saved]
}
