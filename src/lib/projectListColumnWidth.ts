export const PROJECT_LIST_COLUMN_WIDTH_MIN = 80
export const PROJECT_LIST_COLUMN_WIDTH_MAX = 600

interface ProjectListWidthDefinition {
  key: string
  width?: number
}

export function clampProjectListColumnWidth(width: number): number {
  if (!Number.isFinite(width)) return PROJECT_LIST_COLUMN_WIDTH_MIN
  return Math.min(
    PROJECT_LIST_COLUMN_WIDTH_MAX,
    Math.max(PROJECT_LIST_COLUMN_WIDTH_MIN, Math.round(width)),
  )
}

export function resizeProjectListColumnWidth(startWidth: number, deltaX: number): number {
  return clampProjectListColumnWidth(startWidth + deltaX)
}

export function normalizeProjectListColumnWidths(
  definitions: readonly ProjectListWidthDefinition[],
  stored: unknown,
): Record<string, number> {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
  const candidate = stored as Record<string, unknown>
  return Object.fromEntries(definitions.flatMap(definition => {
    const width = candidate[definition.key]
    return typeof width === 'number' && Number.isFinite(width)
      ? [[definition.key, clampProjectListColumnWidth(width)]]
      : []
  }))
}

export function getProjectListColumnWidth(
  key: string,
  defaultWidth: number,
  widths: Readonly<Record<string, number>>,
): number {
  return clampProjectListColumnWidth(widths[key] ?? defaultWidth)
}
