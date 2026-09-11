import { useProjectStore } from '@/stores/project'
import { hasPermission, isGlobalAdmin, usePermissionStore } from '@/stores/permission'
import { getProjectAttribute, isFormalProject } from '@/types/projectRegistry'
import { getProjectInfoValue } from '@/lib/projectInfoValues'
import { matchesHrCategory, hrFormalDisplayCode, hrFormalProjectCode, type HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { ProjectItem } from '@/types/app'

export interface HrRegistryRecord {
  id: string; pmsProjectId?: string; name?: string; tdtName?: string; ipmProjectCode: string | null
  migrationIssue?: string; legacyHrSnapshot?: unknown
  hrCanonicalMetadata?: Record<string, unknown>
}
/** A detail dialog may select a linked source; creation always returns to the owning resource scope. */
export function resolveHrNewVersionProjectId(projects: readonly Pick<HrRegistryRecord, 'id' | 'pmsProjectId'>[], selectedProjectId?: string | null, scopeId?: string): string {
  return scopeId ? projects.find(project => project.pmsProjectId === scopeId)?.id ?? '' : selectedProjectId ?? ''
}

export const getHrRegistryProject = (record?: Pick<HrRegistryRecord, 'pmsProjectId'> | null) => record?.pmsProjectId
  ? useProjectStore.getState().projects.find(project => project.id === record.pmsProjectId) : undefined
export function canAccessHrProject(record?: Pick<HrRegistryRecord, 'pmsProjectId'> | null, edit = false, actor = useProjectStore.getState().currentLoginUser) {
  const project = getHrRegistryProject(record)
  if (!project && !edit && record && !record.pmsProjectId) return isGlobalAdmin(actor)
  return !!project && hasPermission(actor, project.id, edit ? 'basicInfo:编辑' : 'basicInfo:查看')
}
export function getHrAllowedBudgetTypes(record?: Pick<HrRegistryRecord, 'pmsProjectId'> | null): Array<'annual' | 'projectEstimate' | 'projectBudget'> {
  const project = getHrRegistryProject(record)
  if (!project) return []
  const attribute = getProjectAttribute(project)
  return attribute === 'formal' ? ['projectEstimate', 'projectBudget'] : attribute === 'budget' ? ['annual'] : []
}
export function isHrFormalRecord(record?: Pick<HrRegistryRecord, 'pmsProjectId'> | null) {
  const project = getHrRegistryProject(record)
  return !!project && isFormalProject(project)
}
export function isHrVersionVisible(record: HrRegistryRecord, budgetType: string, scopeId?: string) {
  if (!canAccessHrProject(record)) return false
  if (!scopeId) return true
  if (record.pmsProjectId === scopeId) return true
  const source = getHrRegistryProject(record)
  return budgetType === 'annual' && source?.projectAttribute === 'budget' && source.boundFormalProjectId === scopeId
}
export const canEditHrInScope = (record?: HrRegistryRecord | null, scopeId?: string) => !!record
  && (!scopeId || record.pmsProjectId === scopeId) && canAccessHrProject(record, true)

interface RegistryVersion { id: string; projectId: string; budgetType: string }
interface Migratable extends HrRegistryRecord { versions: RegistryVersion[]; createdAt: string; [key: string]: unknown }
interface Monthly { projectId: string; versionId: string }
const categoryType = { machine: '整机产品项目', tos: 'tOS版本项目', technical: '技术项目', capability: '能力建设项目' }
export const legacyHrBudgetId = (category: HrProjectCategory, id: string) => `hr-budget:${category}:${id}`

/** One migration per persisted HR store. Unknown and duplicate bindings are retained, never guessed. */
export function reconcileHrRegistry<T extends HrRegistryRecord & { versions: RegistryVersion[]; createdAt: string }, M extends Monthly>(
  records: T[], monthly: M[], category: HrProjectCategory, migrated: boolean,
): { projects: T[]; monthlyInvestments: M[]; registryMigrationComplete: boolean } {
  let registry = useProjectStore.getState().projects
  const imported: ProjectItem[] = []
  const deleted = new Set(useProjectStore.getState().registryHistory.filter(row => row.action === 'delete').map(row => row.projectId))
  const next: T[] = []
  const claims = new Map<string, number>()
  records.filter(row => !row.pmsProjectId && row.ipmProjectCode).forEach(row => claims.set(row.ipmProjectCode!, (claims.get(row.ipmProjectCode!) || 0) + 1))
  for (const record of records) {
    if (record.pmsProjectId || migrated) { next.push(record); continue }
    const candidates = registry.filter(project => isFormalProject(project) && matchesHrCategory(project, category) && hrFormalProjectCode(project) === record.ipmProjectCode)
    const formal = candidates.length === 1 && claims.get(record.ipmProjectCode || '') === 1 ? candidates[0] : undefined
    const annual = record.versions.filter(version => version.budgetType === 'annual')
    const nonannual = record.versions.filter(version => version.budgetType !== 'annual')
    const snapshot = JSON.parse(JSON.stringify(record))
    if (annual.length || !record.versions.length) {
      const id = legacyHrBudgetId(category, record.id)
      if (!deleted.has(id)) {
        const existing = registry.find(project => project.id === id)
        if (!existing) {
          const bound = formal && ![...registry, ...imported].some(project => project.projectAttribute === 'budget' && project.boundFormalProjectId === formal.id) ? formal.id : null
          const old = record as unknown as Migratable
          const creator = typeof old.createdBy === 'string' ? old.createdBy : ''
          imported.push({ id, name: record.name || record.tdtName || record.id, type: categoryType[category], projectAttribute: 'budget', boundFormalProjectId: bound,
            createdBy: creator, createdAt: record.createdAt, responsiblePersons: creator ? [creator] : [],
            status: '筹备中', progress: 0, leader: creator, planStartDate: '', planEndDate: '',
            developCycle: 0, healthStatus: 'normal', brand: String(old.brand || ''), productLine: String(old.productLine || ''),
            marketName: String(old.marketName || ''), fieldValues: {},
          } as ProjectItem)
        }
        next.push({ ...record, id: `${record.id}:annual`, pmsProjectId: id, legacyHrSnapshot: snapshot, versions: annual.map(version => ({ ...version, projectId: `${record.id}:annual` })) })
      }
    }
    if (nonannual.length) next.push({ ...record, ...(formal ? { pmsProjectId: formal.id } : {
      migrationIssue: `旧人力项目 ${record.id}：正式绑定 ${record.ipmProjectCode || '空'} ${candidates.length === 0 ? '无法匹配' : '不唯一'}，原记录保留待核对`,
    }), legacyHrSnapshot: snapshot, versions: nonannual })
  }
  if (imported.length) {
    registry = [...registry, ...imported]
    useProjectStore.setState({ projects: registry })
    usePermissionStore.getState().ensureProjectPermissions(imported.map(project => ({
      ...project,
      // Select the explicit-owner role initializer even when the old record has no creator.
      // This adapter sentinel is not persisted as registry metadata and grants nobody access.
      createdBy: project.createdBy || '__legacy_hr_permission_scope__',
    })))
  }
  // A missing hydrated registry row is not proof of deletion. Only confirmed config deletion may remove resource data.
  const active = next.filter(record => !record.pmsProjectId || !deleted.has(record.pmsProjectId))
  for (const project of registry.filter(project => matchesHrCategory(project, category) && getProjectAttribute(project) !== 'roadmap')) {
    if (active.some(record => record.pmsProjectId === project.id)) continue
    active.push({ id: `hr:${category}:${project.id}`, pmsProjectId: project.id, name: project.name,
      ipmProjectCode: null, ipmProjectName: null, status: 'active', createdAt: project.createdAt || '',
      annualBudget: 0, projectEstimate: 0, projectBudget: 0, projectAccounting: 0, versions: [],
      tdtName: project.name, planningYear: '', techDomain: '', tmg: '', techTrack: '', subTrack: '', subTaskName: '', projectTarget: '', brand: '', productLine: '', marketName: '', projectLevel: '', levelCoefficient: 1, hrModelVersion: '', projectYear: '-',
    } as unknown as T)
  }
  const removedRecordIds = new Set(records.filter(record => record.pmsProjectId && deleted.has(record.pmsProjectId)).map(record => record.id))
  const owners = new Map(active.flatMap(record => record.versions.map(version => [version.id, record.id] as const)))
  return { projects: active, monthlyInvestments: monthly.filter(row => !removedRecordIds.has(row.projectId)).map(row => ({ ...row, projectId: owners.get(row.versionId) || row.projectId })), registryMigrationComplete: true }
}

/** Registry identity follows by ID; budget binding only follows the three required machine metadata fields. */
export function synchronizeHrRegistryRecord<T extends HrRegistryRecord>(record: T, category: HrProjectCategory): T {
  const canonical = getHrRegistryProject(record)
  if (!canonical) return record
  const bound = canonical.boundFormalProjectId ? useProjectStore.getState().projects.find(project => project.id === canonical.boundFormalProjectId && isFormalProject(project)) : undefined
  const source = isFormalProject(canonical) ? canonical : bound
  const result = { ...record, ...(category === 'technical' ? { tdtName: canonical.name } : { name: canonical.name }), ipmProjectCode: source ? hrFormalDisplayCode(source) : null, ipmProjectName: source?.name || null }
  if (category === 'machine') {
    const metadata = source || canonical
    for (const key of ['brand', 'productLine', 'marketName'] as const) {
      const value = getProjectInfoValue(metadata, key)
      // Unbinding keeps the last followed value until the user explicitly edits the budget metadata.
      const canonicalValue = getProjectInfoValue(canonical, key)
      if (source || !record.hrCanonicalMetadata || canonicalValue !== record.hrCanonicalMetadata[key]) Object.assign(result, { [key]: typeof value === 'string' ? value : '' })
    }
    result.hrCanonicalMetadata = Object.fromEntries(['brand', 'productLine', 'marketName'].map(key => [key, getProjectInfoValue(canonical, key)]))
  }
  return result
}
