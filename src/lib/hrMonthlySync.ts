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
}

/** Match by source row identity; department names alone are not unique. */
export function preserveHrMonthlyEdits<T extends MonthlyRow>(generated: T[], existing: T[]): T[] {
  const byId = new Map(existing.map(row => [row.id, row]))
  const byDepartment = new Map<string, T[]>()
  const keyOf = (row: T) => JSON.stringify([row.versionId, row.primaryDepartment, row.secondaryDepartment])
  existing.forEach(row => byDepartment.set(keyOf(row), [...(byDepartment.get(keyOf(row)) ?? []), row]))
  const versionIndexes = new Map<string, number>()
  const used = new Set<string>()
  const synchronized = generated.map(record => {
    const index = versionIndexes.get(record.versionId) ?? 0
    versionIndexes.set(record.versionId, index + 1)
    const candidates = byDepartment.get(keyOf(record)) ?? []
    // Previous releases used the department's index. Migrate that ID without losing its edit.
    const legacyId = `mi-${record.projectId}-${record.versionId}-dept${index}`
    const previous = byId.get(record.id) ?? existing.find(row => row.sourceRowId === record.id) ?? byId.get(legacyId) ?? (candidates.length === 1 ? candidates[0] : undefined)
    if (!previous || used.has(previous.id)) return record
    used.add(previous.id)
    return previous.isEdited ? { ...record, id: previous.id, sourceRowId: record.id, monthlyData: { ...previous.monthlyData }, isEdited: true } : { ...record, id: previous.id, sourceRowId: record.id }
  })
  return [...synchronized, ...existing.filter(row => !used.has(row.id) && !synchronized.some(next => next.id === row.id))]
}
