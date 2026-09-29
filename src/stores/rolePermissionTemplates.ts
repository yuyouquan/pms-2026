import { create } from 'zustand'
import { getPmsLocalStorage, isPmsHydrationWriteSuppressed } from '@/lib/mockDatasetStorage'
import { createRoleTemplateSeed, defaultViewGrants, isRoleTemplateType, projectGrantKeys, sourceRoleIdentity, validateTemplateInput } from '@/lib/rolePermissionTemplates'
import { initialProjects } from '@/data/projects'
import { useProjectTeamStore } from '@/stores/projectTeam'
import { ROLE_TEMPLATE_TYPES, type RolePermissionTemplate, type RoleTemplateInput, type RoleTemplateProjectType, type SyncedProjectRole } from '@/types/rolePermissionTemplate'
import type { PermissionMutationResult } from '@/types/permissionCenter'
import type { ProjectItem } from '@/types/app'

export const ROLE_TEMPLATE_STORAGE_KEY = 'pms-role-permission-templates'
interface Data {
  templatesByType: Record<RoleTemplateProjectType, RolePermissionTemplate[]>
  copiesByProject: Record<string, Record<string, SyncedProjectRole>>
  error?: string
}
interface Actions {
  rehydrate(): void
  createTemplate(actor: string, type: RoleTemplateProjectType, input: RoleTemplateInput): PermissionMutationResult
  updateTemplate(actor: string, type: RoleTemplateProjectType, id: string, input: RoleTemplateInput): PermissionMutationResult
  deleteTemplate(actor: string, type: RoleTemplateProjectType, id: string): PermissionMutationResult
  updateTemplateGrants(actor: string, type: RoleTemplateProjectType, id: string, keys: readonly string[], enabled: boolean): PermissionMutationResult
  ensureProjectCopies(): PermissionMutationResult
  updateSyncedRoleGrants(actor: string, projectId: string, id: string, keys: readonly string[], enabled: boolean): PermissionMutationResult
}
let authority: { template: (actor: string, type: RoleTemplateProjectType) => boolean; project: (actor: string, projectId: string) => boolean } = { template: () => false, project: () => false }
export function registerRoleTemplateAuthority(value: typeof authority): void { authority = value }
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const validGrants = (v: unknown): v is Record<string, boolean> => record(v) && Object.values(v).every(value => typeof value === 'boolean')
const validRow = (v: unknown): v is RolePermissionTemplate => record(v) && ['id', 'roleName', 'ipmRoleCode', 'pmsRoleCode'].every(key => typeof v[key] === 'string' && (v[key] as string).trim()) && validGrants(v.grants)
function validCopy(value: unknown, projectId: string, id: string): boolean {
  if (!record(value) || typeof value.pmsRoleCode !== 'string') return false
  // Unmapped source roles intentionally have no PMS code; templates still require all three fields.
  if (!validRow({ ...value, pmsRoleCode: value.pmsRoleCode || 'unmapped' })) return false
  return value.id === id && value.projectId === projectId && value.source === 'ipm'
    && typeof value.sourceRoleName === 'string' && typeof value.sourceBinding === 'string'
    && id === sourceRoleIdentity(value.sourceBinding, value.ipmRoleCode as string)
}
function readData(): Data {
  const fresh: Data = { templatesByType: createRoleTemplateSeed(), copiesByProject: {} }
  if (typeof window === 'undefined') return fresh
  try {
    const raw = getPmsLocalStorage().getItem(ROLE_TEMPLATE_STORAGE_KEY)
    if (!raw) return fresh
    const value = JSON.parse(raw)
    if (value.version !== 1 || !record(value.templatesByType) || !record(value.copiesByProject)) throw new Error('schema')
    for (const type of ROLE_TEMPLATE_TYPES) {
      const rows = value.templatesByType[type]
      if (!Array.isArray(rows) || rows.some(row => !validRow(row) || validateTemplateInput(rows, row, row.id)) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('rows')
      if (rows.some(row => Object.keys(row.grants).some(key => !projectGrantKeys(type).includes(key)))) throw new Error('grants')
    }
    for (const [projectId, copies] of Object.entries(value.copiesByProject)) {
      if (!projectId || !record(copies) || Object.entries(copies).some(([id, row]) => !validCopy(row, projectId, id))) throw new Error('copies')
    }
    return { templatesByType: value.templatesByType, copiesByProject: value.copiesByProject }
  } catch { return { templatesByType: Object.fromEntries(ROLE_TEMPLATE_TYPES.map(type => [type, []])) as unknown as Data['templatesByType'], copiesByProject: {}, error: '角色模板缓存损坏，已停止授权与写入，请恢复有效数据后重试' } }
}
function commit(set: (data: Partial<Data>) => void, data: Data): PermissionMutationResult {
  try {
    if (typeof window !== 'undefined') {
      if (isPmsHydrationWriteSuppressed()) return { ok: false, error: '数据正在恢复，请稍后重试' }
      getPmsLocalStorage().setItem(ROLE_TEMPLATE_STORAGE_KEY, JSON.stringify({ version: 1, templatesByType: data.templatesByType, copiesByProject: data.copiesByProject }))
    }
  } catch { return { ok: false, error: '自动保存失败；原权限保持不变，请重试' } }
  set(data)
  return { ok: true }
}
function mutateTemplate(get: () => Data, set: (data: Partial<Data>) => void, actor: string, type: RoleTemplateProjectType, mutate: (rows: RolePermissionTemplate[]) => PermissionMutationResult): PermissionMutationResult {
  const state = get()
  if (state.error) return { ok: false, error: state.error }
  if (!isRoleTemplateType(type) || !authority.template(actor, type)) return { ok: false, error: '没有此类型角色模板编辑权限' }
  const rows = structuredClone(state.templatesByType[type])
  const result = mutate(rows)
  if (!result.ok) return result
  const saved = commit(set, { templatesByType: { ...state.templatesByType, [type]: rows }, copiesByProject: state.copiesByProject })
  return saved.ok ? result : saved
}
export function effectiveTeamProjectId(projectId: string): string { return useProjectTeamStore.getState().scopeByProjectId[projectId] ?? projectId }
export function getTeamProjectContext(projectId: string) {
  const team = useProjectTeamStore.getState()
  const scope = effectiveTeamProjectId(projectId)
  const project = team.projects.find(row => row.id === scope)
  const type = project?.type ?? initialProjects.find(row => row.id === scope)?.type
  return { scope, project, type, team: team.teamsByProjectId[scope], attribute: project?.projectAttribute as ProjectItem['projectAttribute'] }
}
export function getSyncedProjectRoles(projectId: string): SyncedProjectRole[] {
  const { scope, team, type, attribute } = getTeamProjectContext(projectId)
  if (!team?.sourceBinding || !type) return []
  const copies = useRolePermissionTemplateStore.getState().copiesByProject[scope] ?? {}
  const allowed = new Set(projectGrantKeys(type, attribute))
  return (team.roleDefinitions ?? []).flatMap(role => {
    const copy = copies[sourceRoleIdentity(team.sourceBinding!, role.code)]
    return copy ? [{ ...copy, sourceRoleName: role.name, grants: Object.fromEntries(Object.entries(copy.grants).filter(([key]) => allowed.has(key))) }] : []
  })
}
const cleanedInput = (input: RoleTemplateInput): RoleTemplateInput => ({ roleName: input.roleName.trim(), ipmRoleCode: input.ipmRoleCode.trim(), pmsRoleCode: input.pmsRoleCode.trim() })
export const useRolePermissionTemplateStore = create<Data & Actions>((set, get) => ({
  ...readData(),
  rehydrate: () => set({ error: undefined, ...readData() }),
  createTemplate: (actor, type, input) => mutateTemplate(get, set, actor, type, rows => {
    const error = validateTemplateInput(rows, input)
    if (error) return { ok: false, error }
    const id = `template:${Date.now()}:${Math.random().toString(36).slice(2)}`
    rows.push({ id, ...cleanedInput(input), grants: defaultViewGrants(type) })
    return { ok: true, roleId: id }
  }),
  updateTemplate: (actor, type, id, input) => mutateTemplate(get, set, actor, type, rows => {
    const row = rows.find(row => row.id === id)
    if (!row) return { ok: false, error: '角色模板不存在' }
    const error = validateTemplateInput(rows, input, id)
    if (error) return { ok: false, error }
    Object.assign(row, cleanedInput(input))
    return { ok: true, roleId: id }
  }),
  deleteTemplate: (actor, type, id) => mutateTemplate(get, set, actor, type, rows => {
    const index = rows.findIndex(row => row.id === id)
    if (index < 0) return { ok: false, error: '角色模板不存在' }
    rows.splice(index, 1)
    return { ok: true }
  }),
  updateTemplateGrants: (actor, type, id, keys, enabled) => mutateTemplate(get, set, actor, type, rows => {
    const row = rows.find(row => row.id === id)
    if (!row || !Array.isArray(keys) || typeof enabled !== 'boolean' || keys.some(key => !projectGrantKeys(type).includes(key))) return { ok: false, error: '权限目标无效' }
    row.grants = { ...row.grants, ...Object.fromEntries([...new Set(keys)].map(key => [key, enabled])) }
    return { ok: true }
  }),
  ensureProjectCopies: () => {
    const state = get()
    if (state.error) return { ok: false, error: state.error }
    const copiesByProject = structuredClone(state.copiesByProject)
    let changed = false
    for (const scope of new Set(Object.values(useProjectTeamStore.getState().scopeByProjectId))) {
      const { team, type, attribute } = getTeamProjectContext(scope)
      if (!team?.sourceBinding || !type || !isRoleTemplateType(type)) continue
      const copies = copiesByProject[scope] ??= {}
      for (const source of team.roleDefinitions ?? []) {
        const id = sourceRoleIdentity(team.sourceBinding, source.code)
        if (copies[id]) continue
        const template = state.templatesByType[type].find(row => row.ipmRoleCode === source.code)
        const allowed = new Set(projectGrantKeys(type, attribute))
        copies[id] = { id, projectId: scope, source: 'ipm', sourceBinding: team.sourceBinding, sourceRoleName: source.name, roleName: template?.roleName ?? source.name, ipmRoleCode: source.code, pmsRoleCode: template?.pmsRoleCode ?? '', ...(template ? { templateId: template.id } : {}), grants: template ? Object.fromEntries(Object.entries(template.grants).filter(([key]) => allowed.has(key))) : defaultViewGrants(type, attribute) }
        changed = true
      }
    }
    return changed ? commit(set, { templatesByType: state.templatesByType, copiesByProject }) : { ok: true }
  },
  updateSyncedRoleGrants: (actor, projectId, id, keys, enabled) => {
    const state = get()
    if (state.error) return { ok: false, error: state.error }
    const { scope, type, attribute } = getTeamProjectContext(projectId)
    if (!authority.project(actor, scope)) return { ok: false, error: '没有项目角色管理权限' }
    if (!type || !getSyncedProjectRoles(projectId).some(row => row.id === id) || !Array.isArray(keys) || typeof enabled !== 'boolean' || keys.some(key => !projectGrantKeys(type, attribute).includes(key))) return { ok: false, error: '角色来源或权限目标已失效' }
    const copiesByProject = structuredClone(state.copiesByProject)
    const row = copiesByProject[scope][id]
    row.grants = { ...row.grants, ...Object.fromEntries([...new Set(keys)].map(key => [key, enabled])) }
    return commit(set, { templatesByType: state.templatesByType, copiesByProject })
  },
}))

export function useSyncedProjectRoles(projectId: string): SyncedProjectRole[] {
  useRolePermissionTemplateStore(state => state.copiesByProject)
  useProjectTeamStore(state => state.teamsByProjectId)
  useProjectTeamStore(state => state.scopeByProjectId)
  return getSyncedProjectRoles(projectId)
}
