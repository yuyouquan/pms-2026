import { getPermissionColumnFields } from '@/constants/permissionCenter'
import { buildProjectListColumnUnits } from '@/lib/projectListColumnOrder'
import type { MenuPolicy, ProjectDataScope } from '@/types/permissionCenter'

export interface PermissionColumnUnit {
  key: string
  label: string
  fieldKeys: string[]
  required: boolean
}

export function getPermissionColumnUnits(menuId: string, scope?: ProjectDataScope): PermissionColumnUnit[] {
  const fields = getPermissionColumnFields(menuId, scope)
  if (menuId !== 'project.view' || !scope) return fields.map(field => ({ key: field.key, label: field.label, fieldKeys: [field.key], required: !!field.required }))
  return buildProjectListColumnUnits(fields.map(field => ({
    key: field.key, title: field.label, source: field.source ?? 'system',
    defaultVisible: true, hideable: !field.required,
  }))).map(unit => ({ key: unit.key, label: String(unit.title), fieldKeys: unit.leafKeys, required: unit.hideable === false }))
}

export function getSelectedPermissionColumns(menuId: string, columns: MenuPolicy['columns'], scope?: ProjectDataScope): string[] {
  const keys = getPermissionColumnFields(menuId, scope).map(field => field.key)
  if (columns.mode === 'all') return keys
  const aliases: Record<string, string> = { name: 'projectName', code: 'projectCode', type: 'projectCategory' }
  return [...new Set(columns.fields.map(key => menuId === 'project.view' && scope ? aliases[key] ?? key : key))].filter(key => keys.includes(key))
}

export function getPermissionColumnUnitState(unit: PermissionColumnUnit, selected: readonly string[]) {
  const selectedCount = unit.fieldKeys.filter(key => selected.includes(key)).length
  return { checked: selectedCount === unit.fieldKeys.length, indeterminate: selectedCount > 0 && selectedCount < unit.fieldKeys.length, selectedCount }
}

// Persist leaf grants, not display units: reading or editing another column must
// never turn a legacy partial milestone grant into permission for all its leaves.
export function togglePermissionColumnUnit(selected: readonly string[], unit: PermissionColumnUnit, checked: boolean): string[] {
  return checked ? [...new Set([...selected, ...unit.fieldKeys])] : selected.filter(key => !unit.fieldKeys.includes(key))
}
