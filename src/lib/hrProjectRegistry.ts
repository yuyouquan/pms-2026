import { MACHINE_BUDGET_METADATA_KEYS, withBoundMachineBudgetMetadata } from '@/lib/boundMachineBudgetMetadata'
import { useProjectStore } from '@/stores/project'
import { hasPermission, isGlobalAdmin, usePermissionStore } from '@/stores/permission'
import { getProjectAttribute, isFormalProject } from '@/types/projectRegistry'
import { getProjectInfoValue } from '@/lib/projectInfoValues'
import { matchesHrCategory, hrFormalDisplayCode, hrFormalProjectCode, type HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { ProjectItem } from '@/types/app'

export interface HrRegistryRecord {
  id: string; pmsProjectId?: string; name?: string; tdtName?: string; ipmProjectCode: string | null
  status?: 'active' | 'cancelled' | 'paused'
  migrationIssue?: string; legacyHrSnapshot?: unknown
  /** Last diagnostic owned by annual-binding reconciliation; unrelated warnings remain untouched. */
  annualBindingMigrationIssue?: string
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
  if (edit && project && getProjectAttribute(project) === 'budget' && project.boundFormalProjectId) return false
  return !!project && hasPermission(actor, project.id, edit ? 'basicInfo:编辑' : 'resource:view')
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
export type ResourcePermissionAction = 'view' | 'createVersion' | 'lockVersion' | 'setOfficialVersion' | 'deleteVersion' | 'export' | 'laborEdit' | 'nonLaborEdit'
/** Resolve authority in the displayed space. Linked budgets may only be read/exported there. */
export function canResourceAction(record: { pmsProjectId?: string } | null | undefined, action: ResourcePermissionAction, scopeId?: string, actor = useProjectStore.getState().currentLoginUser): boolean {
  const project = getHrRegistryProject(record)
  if (!project) return false
  const scope = scopeId || project.id
  const read = action === 'view' || action === 'export'
  if (scope !== project.id && (!read || getProjectAttribute(project) !== 'budget' || project.boundFormalProjectId !== scope)) return false
  if (!read && getProjectAttribute(project) === 'budget' && project.boundFormalProjectId) return false
  return hasPermission(actor, scope, 'resource:view') && hasPermission(actor, scope, `resource:${action}`)
}
export function isHrVersionVisible(record: HrRegistryRecord, budgetType: string, scopeId?: string) {
  if (!canResourceAction(record, 'view', scopeId)) return false
  return !scopeId || record.pmsProjectId === scopeId || budgetType === 'annual'
}
export const canEditHrInScope = (record?: { pmsProjectId?: string } | null, scopeId?: string) =>
  (['createVersion', 'laborEdit', 'nonLaborEdit'] as const).some(action => canResourceAction(record, action, scopeId))

interface RegistryVersion { id: string; projectId: string; budgetType: string }
interface Migratable extends HrRegistryRecord { versions: RegistryVersion[]; createdAt: string; [key: string]: unknown }
interface Monthly { projectId: string; versionId: string }
const categoryType = { machine: '整机产品项目', tos: 'tOS版本项目', technical: '技术项目', capability: '能力建设项目' }
export const legacyHrBudgetId = (category: HrProjectCategory, id: string) => `hr-budget:${category}:${id}`

function legacySnapshot(record: HrRegistryRecord): HrRegistryRecord | undefined {
  const value = record.legacyHrSnapshot
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string') return undefined
  return value as HrRegistryRecord
}

/** Diagnose retained annual snapshots by exact import ID, without undoing deliberate binding decisions. */
function diagnoseAnnualBinding<T extends HrRegistryRecord>(record: T, registry: ProjectItem[], category: HrProjectCategory, claims: Map<string, Set<string>>): T {
  const snapshot = legacySnapshot(record)
  if (!snapshot || record.pmsProjectId !== legacyHrBudgetId(category, snapshot.id)) return record
  const canonical = registry.find(project => project.id === record.pmsProjectId && project.projectAttribute === 'budget')
  if (!canonical) return record
  const code = snapshot.ipmProjectCode
  const candidates = code ? registry.filter(project => isFormalProject(project) && matchesHrCategory(project, category) && hrFormalProjectCode(project) === code) : []
  const history = useProjectStore.getState().registryHistory
  const handled = history.some(row => row.projectId === canonical.id && row.action !== 'create' && row.changes.some(change => change.field === 'boundFormalProjectId'))
    || (candidates.length === 0 && history.some(row => row.action === 'delete' && row.before && isFormalProject(row.before) && matchesHrCategory(row.before, category) && hrFormalProjectCode(row.before) === code))
  let issue: string | undefined
  if (code && !canonical.boundFormalProjectId && !handled) {
    const reason = candidates.length === 0 ? '无法匹配'
      : candidates.length > 1 || (claims.get(code)?.size || 0) > 1 ? '不唯一'
      : registry.some(project => project.id !== canonical.id && project.projectAttribute === 'budget' && project.boundFormalProjectId === candidates[0].id) ? '已被其他预算项目占用'
      : '尚未确认关联'
    issue = `旧年度预算 ${snapshot.id}：正式绑定 ${code} ${reason}，原记录保留待核对`
  }
  if (record.migrationIssue && record.migrationIssue !== record.annualBindingMigrationIssue) return record
  if (issue === record.annualBindingMigrationIssue && issue === record.migrationIssue) return record
  const result = { ...record }
  if (issue) {
    result.migrationIssue = issue
    result.annualBindingMigrationIssue = issue
  } else {
    delete result.migrationIssue
    delete result.annualBindingMigrationIssue
  }
  return result
}

/** One migration per persisted HR store. Unknown and duplicate bindings are retained, never guessed. */
export function reconcileHrRegistry<T extends HrRegistryRecord & { versions: RegistryVersion[]; createdAt: string }, M extends Monthly>(
  records: T[], monthly: M[], category: HrProjectCategory, migrated: boolean,
): { projects: T[]; monthlyInvestments: M[]; registryMigrationComplete: boolean } {
  let registry = useProjectStore.getState().projects
  const imported: ProjectItem[] = []
  const deleted = new Set(useProjectStore.getState().registryHistory.filter(row => row.action === 'delete').map(row => row.projectId))
  const next: T[] = []
  const claims = new Map<string, Set<string>>()
  records.forEach(row => {
    // Annual/nonannual fragments retain the same snapshot and count as one original claim.
    const original = legacySnapshot(row) || (!row.pmsProjectId ? row : undefined)
    if (!original?.ipmProjectCode) return
    const ids = claims.get(original.ipmProjectCode) || new Set<string>()
    ids.add(original.id)
    claims.set(original.ipmProjectCode, ids)
  })
  for (const record of records) {
    if (record.pmsProjectId || migrated) { next.push(record); continue }
    const candidates = registry.filter(project => isFormalProject(project) && matchesHrCategory(project, category) && hrFormalProjectCode(project) === record.ipmProjectCode)
    const formal = candidates.length === 1 && claims.get(record.ipmProjectCode || '')?.size === 1 ? candidates[0] : undefined
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
    .map(record => diagnoseAnnualBinding(record, registry, category, claims))
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

/** Adopt only exact-ID legacy retained values whose canonical fields were not edited since the old snapshot. */
function adoptLegacyMachineBudgetMetadata(record: HrRegistryRecord, canonical: ProjectItem): ProjectItem {
  if (getProjectAttribute(canonical) !== 'budget' || canonical.boundFormalProjectId || canonical.machineBudgetMetadataAuthority === 'registry-v1' || !record.hrCanonicalMetadata) return canonical
  const explicitFields = new Set(Array.isArray(canonical.machineBudgetMetadataAuthority) ? canonical.machineBudgetMetadataAuthority : [])
  const values = Object.fromEntries(MACHINE_BUDGET_METADATA_KEYS.map(key => {
    const current = getProjectInfoValue(canonical as unknown as Parameters<typeof getProjectInfoValue>[0], key)
    const retained = (record as unknown as Record<string, unknown>)[key]
    const value = !explicitFields.has(key) && Object.hasOwn(record.hrCanonicalMetadata!, key) && current === record.hrCanonicalMetadata![key] && typeof retained === 'string' ? retained : current
    return [key, typeof value === 'string' ? value : '']
  }))
  const adopted: ProjectItem = { ...canonical, ...values, fieldValues: { ...canonical.fieldValues, ...values }, machineBudgetMetadataAuthority: 'registry-v1' }
  useProjectStore.setState(state => ({
    projects: state.projects.map(project => project.id === canonical.id ? adopted : project),
    selectedProject: state.selectedProject?.id === canonical.id ? adopted : state.selectedProject,
  }))
  return adopted
}

/** Registry identity and effective machine metadata follow canonical IDs, never display names. */
export function synchronizeHrRegistryRecord<T extends HrRegistryRecord>(record: T, category: HrProjectCategory): T {
  const found = getHrRegistryProject(record)
  if (!found) return record
  const canonical = category === 'machine' ? adoptLegacyMachineBudgetMetadata(record, found) : found
  const bound = canonical.boundFormalProjectId ? useProjectStore.getState().projects.find(project => project.id === canonical.boundFormalProjectId && isFormalProject(project)) : undefined
  const source = isFormalProject(canonical) ? canonical : bound
  const result = { ...record, ...(category === 'technical' ? { tdtName: canonical.name } : { name: canonical.name }), ipmProjectCode: source ? hrFormalDisplayCode(source) : null, ipmProjectName: source?.name || null }
  if (category === 'machine') {
    const metadata = withBoundMachineBudgetMetadata(canonical, useProjectStore.getState().projects)
    for (const key of MACHINE_BUDGET_METADATA_KEYS) {
      const value = getProjectInfoValue(metadata as unknown as Parameters<typeof getProjectInfoValue>[0], key)
      Object.assign(result, { [key]: typeof value === 'string' ? value : '' })
    }
    result.hrCanonicalMetadata = Object.fromEntries(MACHINE_BUDGET_METADATA_KEYS.map(key => [key, getProjectInfoValue(canonical as unknown as Parameters<typeof getProjectInfoValue>[0], key)]))
  }
  return result
}
