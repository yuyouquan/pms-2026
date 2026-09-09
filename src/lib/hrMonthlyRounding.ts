/** Allocate tenths without losing or inventing person-months through independent rounding. */
export function roundHrMonthlyAllocation(raw: Record<string, number>, expectedTotal: number): Record<string, number> {
  const entries = Object.entries(raw).filter(([, value]) => Number.isFinite(value) && value >= 0)
  if (!entries.length) return {}
  const result = Object.fromEntries(entries.map(([month, value]) => [month, Math.floor(value * 10 + 1e-8)]))
  const target = Math.round(expectedTotal * 10)
  let remaining = target - Object.values(result).reduce((sum, value) => sum + value, 0)
  const ranked = entries.slice().sort((a, b) => ((b[1] * 10) % 1) - ((a[1] * 10) % 1) || a[0].localeCompare(b[0]))
  // With a complete allocation, only the rounding remainder needs distributing.
  if (remaining >= 0 && remaining <= entries.length) {
    for (const [month] of ranked) { if (remaining-- <= 0) break; result[month] += 1 }
    return Object.fromEntries(Object.entries(result).map(([month, tenths]) => [month, tenths / 10]))
  }
  return Object.fromEntries(entries.map(([month, value]) => [month, Math.round(value * 10) / 10]))
}
