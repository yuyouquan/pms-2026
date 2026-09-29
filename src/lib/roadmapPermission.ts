import { getAuthorizedColumns, projectAuthorizedRows } from '@/lib/permissionCenter'
import { applyRoadmapFilters, buildRoadmapFilterFieldDefinitions } from '@/lib/roadmapFilters'
import { ROADMAP_COLUMNS, type RoadmapColumnKey, type RoadmapFilterCondition, type RoadmapProjectRow, type TosVersionConfig } from '@/types/roadmap'
import type { PermissionAction, PermissionCenterModel, PermissionMenuId } from '@/types/permissionCenter'

/** Empty values keep existing renderers total without copying any hidden source data. */
export function completeProjectedRoadmapRow(row: Partial<RoadmapProjectRow>): RoadmapProjectRow {
  return {
    id: '', source: '' as RoadmapProjectRow['source'], status: '', readOnly: true,
    machineProjectType: '' as RoadmapProjectRow['machineProjectType'], projectCode: '', displayName: '',
    androidVersion: '' as RoadmapProjectRow['androidVersion'], firstSaleTosVersionId: '',
    brand: '' as RoadmapProjectRow['brand'], productLine: '', productSeries: '', marketName: '',
    productType: '' as RoadmapProjectRow['productType'], chipCode: '', startRam: '', versionType: '',
    str5Date: '', str5Estimated: false, launchDate: '', launchEstimated: false, developMode: '', remark: '',
    ...row,
  }
}

export function projectRoadmapRows(model: PermissionCenterModel | undefined, user: string, menu: PermissionMenuId, action: PermissionAction, rows: readonly RoadmapProjectRow[]): RoadmapProjectRow[] {
  return projectAuthorizedRows(model, user, menu, action, rows).map(completeProjectedRoadmapRow)
}

export function scopeRoadmapVersions(versions: readonly TosVersionConfig[], rows: readonly RoadmapProjectRow[]): TosVersionConfig[] {
  const ids = new Set(rows.map(row => row.firstSaleTosVersionId).filter(Boolean))
  return versions.filter(version => ids.has(version.id))
}

/** Candidate values come only from already projected rows, including historical enums. */
export function buildAuthorizedRoadmapFilterDefinitions(rows: readonly RoadmapProjectRow[], versions: readonly TosVersionConfig[], columns: readonly string[]) {
  const allowed = new Set(columns)
  return buildRoadmapFilterFieldDefinitions(versions).filter(field => allowed.has(field.key)).map(field => {
    const values = [...new Set(rows.map(row => row[field.key as RoadmapColumnKey]).filter(value => typeof value === 'string' && value.trim()))]
    return field.options ? { ...field, options: values.map(value => ({ label: field.key === 'firstSaleTosVersionId' ? versions.find(version => version.id === value)?.name ?? value : value, value })) } : field
  })
}

/** Export independently authorizes each row and its fields before personal filtering. */
export function buildRoadmapPermissionExport(model: PermissionCenterModel | undefined, user: string, menu: PermissionMenuId, sourceRows: readonly RoadmapProjectRow[], versions: readonly TosVersionConfig[], filters: readonly RoadmapFilterCondition[], order: readonly RoadmapColumnKey[], visible: readonly RoadmapColumnKey[], selectedVersionId: string | null) {
  const projected = projectRoadmapRows(model, user, menu, 'export', sourceRows)
  const permitted = new Set(sourceRows.flatMap(row => getAuthorizedColumns(model, user, menu, 'export', row as unknown as Record<string, unknown>)))
  const allowedColumns = ROADMAP_COLUMNS.filter(column => permitted.has(column.key)).map(column => column.key)
  const definitions = buildAuthorizedRoadmapFilterDefinitions(projected, scopeRoadmapVersions(versions, projected), allowedColumns)
  // Filtering a field not granted for export must not query the raw source as an oracle.
  const safeFilters = filters.filter(condition => allowedColumns.includes(condition.field))
  const rows = applyRoadmapFilters(projected, 'all', 'all', safeFilters, definitions)
    .filter(row => !selectedVersionId || row.firstSaleTosVersionId === selectedVersionId)
  return { rows, columns: order.filter(key => visible.includes(key) && permitted.has(key)) }
}
