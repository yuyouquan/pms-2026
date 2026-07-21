export const getBalancedRows = <T>(
  items: T[],
  maxColumns: number,
  maxRows?: number,
): T[][] => {
  if (!items.length || maxColumns < 1) return []
  const requiredRows = Math.ceil(items.length / maxColumns)
  const rowCount = Math.min(maxRows || Number.POSITIVE_INFINITY, requiredRows)
  const baseSize = Math.floor(items.length / rowCount)
  const largerRows = items.length % rowCount
  const rows: T[][] = []
  let cursor = 0

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const size = baseSize + (rowIndex < largerRows ? 1 : 0)
    rows.push(items.slice(cursor, cursor + size))
    cursor += size
  }
  return rows
}
