interface MonthlyRow {
  id: string
  projectId: string
  versionId: string
  primaryDepartment: string
  secondaryDepartment: string
  estimatedTotal: number
  monthlyData: Record<string, number>
  isEdited: boolean
  sourceRowId?: string
  isArchived?: boolean
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
    return previous.isEdited ? { ...record, id: previous.id, sourceRowId: record.id, isArchived: false, monthlyData: { ...previous.monthlyData }, isEdited: true } : { ...record, id: previous.id, sourceRowId: record.id, isArchived: false }
  })
  return [...synchronized, ...existing.filter(row => !used.has(row.id) && !synchronized.some(next => next.id === row.id)).map(row => ({ ...row, isArchived: true }))]
}
