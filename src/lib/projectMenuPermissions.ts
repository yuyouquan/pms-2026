import { getPermissionFields, registerPermissionFields } from '@/constants/permissionCenter'
import { PROJECT_CATEGORY_MACHINE, PROJECT_CATEGORY_TECH, PROJECT_TYPE_TOS_VERSION, PROJECT_SECONDARY_CATEGORIES, matchesProjectTypeFilter, matchesProjectSecondaryCategoryFilter } from '@/constants/projectTypes'
import { getAuthorizedColumns, evaluateMenuPermission, projectAuthorizedRows } from '@/lib/permissionCenter'
import { buildProjectSummaryRow, getProjectListFieldDefinitions, getProjectSummaryFieldDefinitions, getTemplateTaskFieldDefinitions, type ProjectSummaryFieldDefinition, type ProjectSummaryRow, type ProjectSummaryTemplateTask } from '@/lib/projectSummary'
import type { ProjectInfoProject } from '@/lib/projectInfoValues'
import type { PermissionAction, PermissionCenterModel, PermissionMenuId } from '@/types/permissionCenter'
import type { ProjectItem } from '@/types/app'
import { getProjectAttribute, type ProjectRegistryHistoryEntry } from '@/types/projectRegistry'

/** Register actual list/task metadata before either the editor or consumers evaluate policies. */
export function registerProjectPermissionFields(templates: Record<string, readonly ProjectSummaryTemplateTask[]> = {}, snapshots: Record<string, readonly ProjectSummaryTemplateTask[]> = {}): void {
  const definitions: ProjectSummaryFieldDefinition[] = []
  for (const [type, variant] of [[PROJECT_CATEGORY_MACHINE, 'machine'], [PROJECT_TYPE_TOS_VERSION, 'tos'], [PROJECT_CATEGORY_TECH, 'technical-tdt'], [PROJECT_CATEGORY_TECH, 'technical-subproject']] as const) {
    const tasks = templates[type] ?? []
    definitions.push(...getProjectSummaryFieldDefinitions(type), ...getProjectListFieldDefinitions(variant, tasks, type), ...getTemplateTaskFieldDefinitions(type, tasks))
    for (const snapshot of Object.values(snapshots)) definitions.push(...getProjectListFieldDefinitions(variant, snapshot, type), ...getTemplateTaskFieldDefinitions(type, snapshot))
  }
  const existing = new Map(getPermissionFields('project.view').map(field => [field.key, field]))
  registerPermissionFields('project.view', [...existing.values(), { key: 'secondaryCategory', label: '二级分类', kind: 'enum', options: [...new Set(Object.values(PROJECT_SECONDARY_CATEGORIES).flat())] }, ...definitions.filter(field => !['projectName', 'projectCategory'].includes(field.key)).map(field => existing.get(field.key) ?? ({ key: field.key, label: field.title, kind: field.inputType === 'date' ? 'date' as const : 'text' as const }))])
  registerPermissionFields('project.config', [...getPermissionFields('project.config'), ...['createdBy', 'createdAt', 'boundFormalProjectId', 'brand', 'productLine'].map(key => ({ key, label: ({ projectCode: '项目编码', createdBy: '创建人', createdAt: '创建时间', boundFormalProjectId: '绑定正式项目', brand: '品牌', productLine: '产品线' })[key]!, kind: 'text' as const }))])
}

export function projectPermissionSource(project: ProjectInfoProject, definitions: readonly ProjectSummaryFieldDefinition[] = [], tasks: readonly ProjectSummaryTemplateTask[] = []): Record<string, unknown> {
  return { ...project, ...project.fieldValues, ...buildProjectSummaryRow(project, definitions, tasks), id: project.id, name: project.name, type: project.type, projectAttribute: getProjectAttribute(project as { projectAttribute?: import('@/types/projectRegistry').ProjectAttribute }), code: project.projectCode ?? project.code } as Record<string, unknown>
}

export function projectFieldAllowed(fields: readonly string[], key: string): boolean {
  return fields.includes(key) || (key === 'projectName' && fields.includes('name')) || (key === 'projectCategory' && fields.includes('type')) || (key === 'projectCode' && fields.includes('code'))
}

/** Only opaque routing keys survive independently from grants; all rendered values are projected. */
export function projectSummaryRows(model: PermissionCenterModel | undefined, user: string, rows: readonly ProjectSummaryRow[], sources: ReadonlyMap<string, Record<string, unknown>>, action: PermissionAction = 'view'): ProjectSummaryRow[] {
  if (!model) return [...rows]
  return rows.flatMap(row => {
    const source = { ...sources.get(String(row.targetProjectId ?? row.projectId)), ...row }
    if (!evaluateMenuPermission(model, user, 'project.view', action, source)) return []
    if (hasAllProjectFields(model, user, 'project.view', source, action)) return [{ ...row }]
    const allowed = getAuthorizedColumns(model, user, 'project.view', action, source)
    const projected = projectAuthorizedRows(model, user, 'project.view', action, [source])[0] ?? {}
    const result: ProjectSummaryRow = { key: row.key, projectId: row.projectId, projectName: projectFieldAllowed(allowed, 'projectName') ? row.projectName : '' }
    for (const key of ['targetProjectId', 'targetSubprojectId']) if (row[key] !== undefined) result[key] = row[key]
    for (const [key, value] of Object.entries(row)) if (projectFieldAllowed(allowed, key)) result[key] = value
    if ('jiraProjects' in projected) result.__jiraProjects = row.__jiraProjects
    if ('fanTrialEnabled' in projected) result.__fanTrialEnabled = row.__fanTrialEnabled
    // Country names need their own grant even when the visible boolean is granted.
    if ('fanTrialCountries' in projected) result.__fanTrialCountries = row.__fanTrialCountries
    return [result]
  })
}

export function projectMenuRows<T extends ProjectInfoProject>(model: PermissionCenterModel | undefined, user: string, menu: PermissionMenuId, rows: readonly T[], action: PermissionAction = 'view'): Partial<T>[] {
  if (!model) return [...rows]
  return rows.flatMap(row => {
    const source = projectPermissionSource(row)
    return projectAuthorizedRows(model, user, menu, action, [source]).map(projected => ({ ...projected, ...('code' in projected && !('projectCode' in projected) ? { projectCode: projected.code } : {}) })) as Partial<T>[]
  })
}

export function hasAllProjectFields(model: PermissionCenterModel | undefined, user: string, menu: PermissionMenuId, row: Record<string, unknown>, action: PermissionAction = 'view'): boolean {
  return !model || evaluateMenuPermission({ ...model, policies: model.policies.filter(policy => policy.columns.mode === 'all') }, user, menu, action, row)
}

/** Category counts and filters are disclosures too; structural routing fields are not display grants. */
export function canReadProjectClassification(model: PermissionCenterModel | undefined, user: string, row: Record<string, unknown>, secondary = false): boolean {
  if (hasAllProjectFields(model, user, 'project.view', row)) return true
  const fields = getAuthorizedColumns(model, user, 'project.view', 'view', row)
  return fields.includes('type') && (!secondary || fields.includes('secondaryCategory'))
}

export function matchesAuthorizedProjectClassification(model: PermissionCenterModel | undefined, user: string, row: Record<string, unknown>, category: string, secondary = 'all'): boolean {
  if (category === 'all' && secondary === 'all') return true
  if (!canReadProjectClassification(model, user, row, secondary !== 'all')) return false
  return matchesProjectTypeFilter(String(row.type ?? ''), category, String(row.secondaryCategory ?? ''))
    && matchesProjectSecondaryCategoryFilter(String(row.type ?? ''), String(row.secondaryCategory ?? ''), secondary)
}

/** History and notification prose contain complete snapshots, so each scope needs a full-field grant. */
export function canReadProjectRegistryHistory(
  model: PermissionCenterModel | undefined,
  user: string,
  currentProject: ProjectItem | undefined,
  entry: Pick<ProjectRegistryHistoryEntry, 'projectId' | 'before' | 'after'>,
): boolean {
  if (!currentProject || currentProject.id !== entry.projectId) return false
  const canReadSnapshot = (project: ProjectItem) => project.id === entry.projectId
    && hasAllProjectFields(model, user, 'project.config', projectPermissionSource({ ...project }))
  if (!canReadSnapshot(currentProject)) return false
  const snapshots = [entry.before, entry.after].filter((snapshot): snapshot is ProjectItem => snapshot !== null)
  return snapshots.length > 0 && snapshots.every(canReadSnapshot)
}
