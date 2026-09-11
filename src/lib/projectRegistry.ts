import { EXTERNAL_PROJECT_POOL, fetchByBid } from '@/data/externalProjectPool'
import { PROJECT_CATEGORY_MACHINE, PROJECT_CATEGORY_TECH, PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { findProjectCategoryMapping } from '@/lib/enumConsumers'
import { mapIpmProjectStatus } from '@/lib/projectStatus'
import { validateRegistryProject } from '@/lib/projectRegistryRules'
import { useEnumStore } from '@/stores/enums'
import { isGlobalAdmin } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import type { ProjectItem } from '@/types/app'
import { getRegistryProjectTypes, PROJECT_ATTRIBUTE_LABELS, type ConfiguredProjectInput, type ConfiguredProjectUpdates, type RegistryMutationResult } from '@/types/projectRegistry'
export { getBindableFormalProjects, getLinkedRegistryProjects } from '@/lib/projectRegistryRules'

export const canManageProjectRegistry = (actor: string): boolean => isGlobalAdmin(actor.trim())
const fail = (message: string): RegistryMutationResult => ({ ok: false, message })

export function createConfiguredProject(input: ConfiguredProjectInput, actor: string): RegistryMutationResult {
  actor = actor.trim()
  if (!canManageProjectRegistry(actor)) return fail('仅管理组可创建和管理项目配置')
  if (!Object.hasOwn(PROJECT_ATTRIBUTE_LABELS, input.projectAttribute)) return fail('请选择有效的项目属性')
  const responsiblePersons = [...new Set(input.responsiblePersons.map(person => person.trim()).filter(Boolean))]
  if (!responsiblePersons.length) return fail('请至少选择一位责任人')
  const source = input.projectAttribute === 'formal' ? EXTERNAL_PROJECT_POOL.find(p => p.bid === input.sourceBid?.trim()) : undefined
  if (input.projectAttribute === 'formal' && !source) return fail('请选择有效的 IPM 来源项目')
  const enumState = useEnumStore.getState()
  if (source && (!enumState.hasHydrated || enumState.hydrationError)) return fail('项目类型映射尚未加载，请稍后重试')
  const mapping = source ? findProjectCategoryMapping(enumState.rowsByType, source.ipmProjectCategoryName) : undefined
  if (source && (!mapping || !getRegistryProjectTypes('formal').includes(mapping.pmsProjectCategory))) return fail('该 IPM 项目分类尚未配置有效映射，请联系管理员维护')
  const type = mapping?.pmsProjectCategory || input.type || ''
  if (!getRegistryProjectTypes(input.projectAttribute).includes(type)) return fail('请选择有效的项目类型，路标项目仅支持整机产品项目')
  const name = (source?.name || input.name || '').trim()
  if (!name) return fail('项目名称不能为空')
  const fields = source ? fetchByBid(source.bid) : {}
  const project: ProjectItem = {
    id: `registry-${globalThis.crypto.randomUUID()}`, name, type: type as ProjectItem['type'],
    projectAttribute: input.projectAttribute, sourceBid: source?.bid,
    boundFormalProjectId: null, createdBy: actor, createdAt: new Date().toISOString(),
    status: mapIpmProjectStatus(source?.ipmStatus || '筹备中', type), progress: 0,
    leader: responsiblePersons[0], responsiblePersons, markets: [], androidVersion: '', chipPlatform: '',
    spm: type === PROJECT_CATEGORY_MACHINE ? responsiblePersons.join('、') : '',
    updatedAt: new Date().toISOString(), productLine: '', tosVersion: '', planStartDate: '', planEndDate: '',
    developCycle: 0, healthStatus: 'normal', ...fields,
    projectCode: fields.projectCode?.trim() || '',
    secondaryCategory: mapping?.pmsSecondaryCategory || (type === PROJECT_CATEGORY_TECH ? source?.ipmProjectCategoryName : undefined),
    ...(type === PROJECT_CATEGORY_TECH ? { technicalLead: responsiblePersons.join('、'), technicalTrack: source?.technicalTrack } : {}),
    fieldValues: type === PROJECT_CATEGORY_MACHINE ? { spm: responsiblePersons }
      : type === PROJECT_CATEGORY_TECH ? { technicalLead: responsiblePersons }
      : type === PROJECT_TYPE_TOS_VERSION ? { tosVersionProjectManager: responsiblePersons } : {},
  }
  const validation = validateRegistryProject(useProjectStore.getState().projects, project)
  if (validation) return fail(validation)
  if (!useProjectStore.getState().addProject(project, actor, { registryOperation: 'create' })) return fail('项目建档失败，请检查权限、来源和项目编码')
  return { ok: true, projectId: project.id }
}

export function updateConfiguredProject(id: string, updates: ConfiguredProjectUpdates, actor: string): RegistryMutationResult {
  if (!canManageProjectRegistry(actor)) return fail('仅管理组可创建和管理项目配置')
  const state = useProjectStore.getState(), previous = state.projects.find(p => p.id === id)
  if (!previous) return fail('项目不存在或已删除')
  if (Object.keys(updates).some(key => !['name','projectCode','boundFormalProjectId'].includes(key))) return fail('项目配置仅支持修改名称、编码和绑定')
  const candidate = { ...previous, ...updates }
  if (updates.name !== undefined) candidate.name = updates.name.trim()
  if (updates.projectCode !== undefined) candidate.projectCode = updates.projectCode.trim()
  if (updates.boundFormalProjectId !== undefined) candidate.boundFormalProjectId = updates.boundFormalProjectId?.trim() || null
  const validation = validateRegistryProject(state.projects, candidate, previous)
  if (validation) return fail(validation)
  if (!state.updateProject(id, candidate, actor.trim(), { registryOperation: 'update' })) return fail('项目配置保存失败，请刷新后重试')
  return { ok: true, projectId: id }
}

export function deleteConfiguredProject(id: string, actor: string): RegistryMutationResult {
  if (!canManageProjectRegistry(actor)) return fail('仅管理组可创建和管理项目配置')
  return useProjectStore.getState().deleteProject(id, actor.trim()) ? { ok: true, projectId: id } : fail('项目不存在或无法删除，请刷新后重试')
}
