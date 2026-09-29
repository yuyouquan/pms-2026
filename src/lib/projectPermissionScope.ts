import { resolveProjectClassification } from '@/constants/projectTypes'
import type { MenuPolicy, ProjectDataScope } from '@/types/permissionCenter'

/** Resolve the actual row subtype, including technical child rows merged over their parent source. */
export function getProjectDataScope(row?: Record<string, unknown>): ProjectDataScope | undefined {
  const type = resolveProjectClassification(String(row?.type ?? row?.projectCategory ?? '')).projectCategory
  if (type === '整机产品项目') return 'machine'
  if (type === 'tOS版本项目' || type === '产品项目') return 'tos'
  if (type === '技术项目') return row?.technicalProjectType === 'subproject' || row?.targetSubprojectId ? 'technical-subproject' : 'technical-tdt'
  if (type === '能力建设项目') return 'capability'
  return undefined
}

/** Functional actions stay at menu level; a scope overrides only that type's data and columns. */
export function getProjectDataPolicy(policy: MenuPolicy, scope?: ProjectDataScope): MenuPolicy {
  const { projectScopes, ...base } = policy
  const rule = policy.menuId === 'project.view' && scope ? projectScopes?.[scope] : undefined
  return rule ? { ...base, data: rule.data, columns: rule.columns } : base
}
