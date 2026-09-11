import { EXTERNAL_PROJECT_POOL, fetchByBid } from '@/data/externalProjectPool'
import { findProjectCategoryMapping } from '@/lib/enumConsumers'
import type { EnumRowsByType } from '@/types/enums'
import type { ProjectItem } from '@/types/app'
import {
  getProjectAttribute, getRegistryProjectCategory, getRegistryProjectTypes, isFormalProject, PROJECT_ATTRIBUTE_LABELS,
  type ProjectRegistryHistoryEntry,
} from '@/types/projectRegistry'

/** Rechecked by the store; the minimal-creation option cannot bypass identity rules. */
export function validateRegistryCreation(candidate: ProjectItem, actor: string, rows: EnumRowsByType): string | null {
  const attribute = getProjectAttribute(candidate)
  if (!Object.hasOwn(PROJECT_ATTRIBUTE_LABELS, attribute) || !getRegistryProjectTypes(attribute).includes(candidate.type)) return '项目属性或类型无效'
  if (!candidate.responsiblePersons?.length || candidate.responsiblePersons.some(person => !person.trim())) return '请至少选择一位责任人'
  if (candidate.createdBy !== actor || !candidate.createdAt) return '创建信息无效'
  if (!isFormalProject(candidate)) return candidate.sourceBid ? '非正式项目不能使用 IPM 来源标识' : null
  const source = EXTERNAL_PROJECT_POOL.find(item => item.bid === candidate.sourceBid)
  if (!source) return '请选择有效的 IPM 来源项目'
  const mapping = findProjectCategoryMapping(rows, source.ipmProjectCategoryName)
  if (!mapping || mapping.pmsProjectCategory !== candidate.type) return '该 IPM 项目分类尚未配置有效映射'
  if (candidate.name !== source.name || candidate.projectCode !== (fetchByBid(source.bid).projectCode?.trim() || '')) return '正式项目名称和编码必须使用 IPM 来源字段'
  return null
}

/** Validates registry invariants at both configuration and project-space write boundaries. */
export function validateRegistryProject(projects: readonly ProjectItem[], candidate: ProjectItem, previous?: ProjectItem): string | null {
  if (!candidate.id.trim() || !candidate.name.trim()) return '项目名称不能为空'
  if (previous) {
    for (const key of ['id', 'type', 'projectAttribute', 'sourceBid', 'createdBy', 'createdAt'] as const) {
      if (candidate[key] !== previous[key]) return '项目身份、类型、属性和创建信息不可修改'
    }
    if (isFormalProject(previous) && (candidate.name !== previous.name || candidate.projectCode !== previous.projectCode)) {
      return '正式项目名称和编码由 IPM 来源维护，不可手工修改'
    }
  }
  const sourceBid = candidate.sourceBid?.trim()
  if (sourceBid && projects.some(p => p.id !== candidate.id && p.sourceBid?.trim() === sourceBid)) return '该外部项目已建档，请勿重复创建'
  const code = candidate.projectCode?.trim()
  if (code && (!previous || code !== previous.projectCode?.trim()) && projects.some(p => p.id !== candidate.id && p.projectCode?.trim() === code)) return '项目编码已存在，请使用唯一编码'
  const binding = candidate.boundFormalProjectId
  if (!binding) return null
  if (isFormalProject(candidate)) return '正式项目不能绑定正式项目'
  const formal = projects.find(p => p.id === binding)
  if (!formal || !isFormalProject(formal)) return '绑定对象必须是有效的正式项目'
  if (getRegistryProjectCategory(formal) !== getRegistryProjectCategory(candidate)) return '只能绑定相同项目类型的正式项目'
  if (projects.some(p => p.id !== candidate.id && getProjectAttribute(p) === getProjectAttribute(candidate) && p.boundFormalProjectId === binding)) return '该正式项目已被同属性项目绑定，请先解除原绑定'
  return null
}

export function getBindableFormalProjects<T extends ProjectItem>(projects: readonly T[], source: ProjectItem): T[] {
  if (isFormalProject(source)) return []
  return projects.filter(p => isFormalProject(p) && !validateRegistryProject(projects, { ...source, boundFormalProjectId: p.id }, source))
}
export const getLinkedRegistryProjects = <T extends ProjectItem>(projects: readonly T[], formalId: string): T[] => projects.filter(p => p.boundFormalProjectId === formalId)

export function createRegistryHistoryEntry(before: ProjectItem | null, after: ProjectItem | null, actor: string): ProjectRegistryHistoryEntry | null {
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  const changes = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter(field => JSON.stringify((before as any)?.[field]) !== JSON.stringify((after as any)?.[field]))
    .map(field => ({ field, before: clone((before as any)?.[field] ?? null), after: clone((after as any)?.[field] ?? null) }))
  if (!changes.length) return null
  const oldBinding = before?.boundFormalProjectId, newBinding = after?.boundFormalProjectId
  const action = !before ? 'create' : !after ? 'delete' : oldBinding !== newBinding
    ? !newBinding ? 'unbind' : oldBinding ? 'rebind' : 'bind' : 'update'
  return {
    id: globalThis.crypto.randomUUID(), projectId: (after || before)!.id,
    action, actor, timestamp: new Date().toISOString(), changes,
    before: clone(before), after: clone(after),
  }
}
