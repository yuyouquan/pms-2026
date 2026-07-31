import { NO_SUBDOMAIN_DOMAINS, SUBDOMAINS_BY_DOMAIN, TECHNICAL_DELIVERABLE_FIELDS, TECHNICAL_STRING_FIELD_KEYS } from '@/constants/technicalProject'
import type {
  DeliverableValue,
  IpmTechnicalSubproject,
  TechnicalDomain,
  TechnicalSubproject,
  TechnicalSubprojectConfiguration,
  TechnicalSubprojectSyncResult,
} from '@/types/technicalProject'

export interface TechnicalStageTask {
  id: string
  name?: string
  taskName?: string
  parentId?: string | null
  planStartDate: string
  planEndDate: string
  order: number
}

export interface TechnicalStagePlanVersion {
  id: string
  templateType: string
  status: string
  publishedAt?: string
  versionNo?: string
  tasks: readonly TechnicalStageTask[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const parseIsoDate = (value: string) => {
  if (!ISO_DATE.test(value)) return Number.NaN
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp
    : Number.NaN
}

/** Resolves a TDT stage from top-level phase intervals. Child tasks never affect it. */
export function calculateTechnicalProjectStage(
  tasks: readonly TechnicalStageTask[],
  today: string,
  inheritedParentStage?: string,
): string {
  if (inheritedParentStage !== undefined) return inheritedParentStage
  const todayTimestamp = parseIsoDate(today)
  if (!Number.isFinite(todayTimestamp)) return '-'
  const phases = tasks
    .filter(task => !task.parentId)
    .map(task => ({
      ...task,
      name: String(task.name || task.taskName || '').trim(),
      start: parseIsoDate(String(task.planStartDate || '')),
      end: parseIsoDate(String(task.planEndDate || '')),
    }))
    .sort((left, right) => left.order - right.order || left.start - right.start || left.id.localeCompare(right.id))
  if (!phases.length || phases.some(phase => !phase.name || !Number.isFinite(phase.start) || !Number.isFinite(phase.end) || phase.start > phase.end)) return '-'
  if (phases.some((phase, index) => index > 0 && phase.start <= phases[index - 1].end)) return '-'
  if (todayTimestamp < phases[0].start) return '未开始'
  if (todayTimestamp > phases[phases.length - 1].end) return '已完成'
  const active = phases.filter(phase => todayTimestamp >= phase.start && todayTimestamp <= phase.end)
  return active.length === 1 ? active[0].name : '-'
}

const technicalVersionTimestamp = (version: TechnicalStagePlanVersion) => {
  const published = Date.parse(String(version.publishedAt || ''))
  if (Number.isFinite(published)) return published
  const numericVersion = Number(String(version.versionNo || '').replace(/\D/g, ''))
  return Number.isFinite(numericVersion) ? numericVersion : 0
}

/** Selects only the latest published TDT snapshot. Draft and child-plan snapshots are excluded. */
export function resolveLatestPublishedTechnicalProjectStage(
  versions: readonly TechnicalStagePlanVersion[],
  today: string,
  inheritedParentStage?: string,
): string {
  if (inheritedParentStage !== undefined) return inheritedParentStage
  const latest = versions
    .filter(version => version.status === '已发布' && ['tdt', 'TDT项目计划'].includes(version.templateType))
    .sort((left, right) => technicalVersionTimestamp(right) - technicalVersionTimestamp(left))[0]
  return latest ? calculateTechnicalProjectStage(latest.tasks, today) : '-'
}

type ResolveInput = {
  ipm?: { projectName?: string; category?: string; secondaryCategory?: string; technicalTrack?: string }
  tmg?: string
  technicalLead?: string
}

export const resolveTechnicalProjectFields = (
  input: ResolveInput,
  options: { tmgSubdomains?: Record<string, readonly string[]> } = {},
) => {
  const tmg = String(input.tmg || '') as TechnicalDomain
  const fixedSubdomains = SUBDOMAINS_BY_DOMAIN[tmg]
  const subdomains = fixedSubdomains || options.tmgSubdomains?.[tmg] || []
  const result: Record<string, unknown> = {
    ...(input.ipm?.projectName ? { projectName: input.ipm.projectName } : {}),
    ...(input.ipm?.category ? { category: input.ipm.category } : {}),
    ...(input.ipm?.secondaryCategory ? { secondaryCategory: input.ipm.secondaryCategory } : {}),
    ...(input.ipm?.technicalTrack ? { technicalTrack: input.ipm.technicalTrack } : {}),
    tmg,
    subdomains: [...subdomains],
    technicalLead: String(input.technicalLead || ''),
    responsiblePersons: input.technicalLead?.trim() ? [input.technicalLead.trim()] : [],
  }
  if (NO_SUBDOMAIN_DOMAINS.includes(tmg)) result.subdomainDisabled = true
  return result
}

export class TechnicalProjectValidationError extends Error {
  constructor(public fieldKey: string, message = fieldKey) {
    super(message)
    this.name = 'TechnicalProjectValidationError'
  }
}

export const switchDeliverableMode = (
  value: DeliverableValue | undefined,
  nextKind: 'url' | 'file',
): DeliverableValue => value?.kind === nextKind ? value : null

export const normalizeDeliverableValue = (value: unknown): DeliverableValue => {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (item.kind === 'url') {
    const url = String(item.url || '').trim()
    return url ? { kind: 'url', url } : null
  }
  if (item.kind === 'file') {
    const name = String(item.name || '').trim()
    const mimeType = String(item.mimeType || '').trim()
    const size = Number(item.size)
    return name && mimeType && Number.isFinite(size) && size >= 0
      ? { kind: 'file', name, size, mimeType }
      : null
  }
  return null
}

const assertDeliverables = (deliverables: unknown) => {
  if (!deliverables || typeof deliverables !== 'object') return
  Object.entries(deliverables as Record<string, unknown>).forEach(([fieldKey, value]) => {
    if (value == null) return
    const invalid = () => { throw new TechnicalProjectValidationError(fieldKey, `deliverable:${fieldKey}`) }
    if (typeof value !== 'object') invalid()
    const item = value as Record<string, unknown>
    const hasUrl = typeof item.url === 'string' && item.url.trim() !== ''
    const hasFile = item.file != null || item.kind === 'file'
    if ((hasUrl && hasFile) || (item.kind !== 'url' && item.kind !== 'file')) invalid()
    if (item.kind === 'url') {
      try {
        const url = new URL(String(item.url || ''))
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol')
      } catch {
        invalid()
      }
    }
    if (item.kind === 'file' && (
      !String(item.name || '').trim()
      || !Number.isFinite(item.size)
      || Number(item.size) < 0
      || !String(item.mimeType || '').trim()
    )) invalid()
  })
}

export const normalizeTechnicalProjectValues = (rawValues: Record<string, unknown>) => {
  const values: Record<string, unknown> = {}
  TECHNICAL_STRING_FIELD_KEYS.forEach(key => {
    values[key] = typeof rawValues[key] === 'string' ? rawValues[key] : ''
  })
  TECHNICAL_DELIVERABLE_FIELDS.forEach(({ key }) => {
    values[key] = normalizeDeliverableValue(rawValues[key])
  })
  return values
}

export const synchronizeTechnicalProjectRecord = <T extends Record<string, unknown>>(
  project: T,
  rawValues: Record<string, unknown>,
  metadata: { ipmProjectType?: string } = {},
) => {
  const values = normalizeTechnicalProjectValues(rawValues)
  const technicalLead = String(values.technicalLead || '').trim()
  const ipmProjectType = String(metadata.ipmProjectType ?? project.ipmProjectType ?? '')
  const synchronizedValues = { ...values, ipmProjectType }
  return {
    ...project,
    ...synchronizedValues,
    fieldValues: {
      ...((project.fieldValues && typeof project.fieldValues === 'object') ? project.fieldValues as Record<string, unknown> : {}),
      ...synchronizedValues,
    },
    leader: technicalLead,
    responsiblePersons: technicalLead ? [technicalLead] : [],
  }
}

export const validateTechnicalProject = (value: Record<string, unknown>) => {
  if (!String(value.technicalLead || '').trim()) throw new Error('technicalLead')
  if (value.type === '技术项目前置工作' && !String(value.preProjectId || '').trim()) throw new Error('preProjectId')
  if (value.type !== 'tdt' && value.type !== '技术项目前置工作') return true
  const tmg = String(value.tmg || '') as TechnicalDomain
  if (!SUBDOMAINS_BY_DOMAIN[tmg]) throw new Error('tmg')
  if (!SUBDOMAINS_BY_DOMAIN[tmg].includes(String(value.subdomain || ''))) throw new Error('subdomain')
  if (value.projectYear && !/^\d{4}$/.test(String(value.projectYear))) throw new Error('projectYear')
  assertDeliverables(value.deliverables)
  return true
}

export const getPreProjectCandidates = <T extends { id: string }>(projects: readonly T[], currentProjectId?: string) => (
  projects.filter(project => project.id !== currentProjectId)
)

export const EMPTY_SUBPROJECT_CONFIGURATION: TechnicalSubprojectConfiguration = {
  coreValue: '',
  developmentMode: '',
  firstTosVersion: '',
  firstMachineProjectId: '',
}

const cloneNestedValue = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(cloneNestedValue) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, nested]) => [key, cloneNestedValue(nested)]),
    ) as T
  }
  return value
}

export const cloneTechnicalSubproject = (subproject: TechnicalSubproject): TechnicalSubproject => (
  cloneNestedValue(subproject)
)

export const isTechnicalSubprojectConfigured = (
  subproject: Pick<TechnicalSubproject, 'configuration'>,
) => Boolean(
  subproject.configuration?.coreValue
  && subproject.configuration?.developmentMode,
)

export const canCreateSubprojectPlanRevision = (
  subproject: Pick<TechnicalSubproject, 'active' | 'configuration'>,
) => subproject.active && isTechnicalSubprojectConfigured(subproject)

const normalizeIncomingSubproject = (
  value: unknown,
  parentProjectId: string,
): IpmTechnicalSubproject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.name !== 'string'
    || typeof candidate.parentProjectId !== 'string'
  ) return null
  const id = candidate.id.trim()
  const name = candidate.name.trim()
  const normalizedParentId = candidate.parentProjectId.trim()
  if (
    !id
    || !name
    || !normalizedParentId
    || normalizedParentId !== parentProjectId
    || typeof candidate.ipmOrder !== 'number'
    || !Number.isInteger(candidate.ipmOrder)
    || candidate.ipmOrder < 0
  ) return null
  return { id, name, parentProjectId: normalizedParentId, ipmOrder: candidate.ipmOrder }
}

export type NormalizedTechnicalSubprojectPayload =
  | { ok: true; parentProjectId: string; items: IpmTechnicalSubproject[] }
  | { ok: false; reason: 'invalid-payload' }

export const normalizeTechnicalSubprojectPayload = (
  incoming: unknown,
  parentProjectId: unknown,
): NormalizedTechnicalSubprojectPayload => {
  if (typeof parentProjectId !== 'string' || !parentProjectId.trim() || !Array.isArray(incoming)) {
    return { ok: false, reason: 'invalid-payload' }
  }
  const normalizedParentId = parentProjectId.trim()
  const items = incoming.map(item => normalizeIncomingSubproject(item, normalizedParentId))
  if (items.some(item => item === null)) return { ok: false, reason: 'invalid-payload' }
  return {
    ok: true,
    parentProjectId: normalizedParentId,
    items: items as IpmTechnicalSubproject[],
  }
}

const compareSubprojects = (left: TechnicalSubproject, right: TechnicalSubproject) => (
  left.ipmOrder - right.ipmOrder
  || left.id.localeCompare(right.id)
)

export const synchronizeTechnicalSubprojects = (
  existing: readonly TechnicalSubproject[],
  incoming: readonly IpmTechnicalSubproject[],
  parentProjectId: string,
): TechnicalSubprojectSyncResult => {
  const normalized = normalizeTechnicalSubprojectPayload(incoming, parentProjectId)
  if (!normalized.ok) {
    return { ok: false as const, reason: 'invalid-payload' as const, items: existing }
  }
  const payload = normalized.items
  const normalizedIds = payload.map(item => item.id)
  if (new Set(normalizedIds).size !== payload.length) {
    return { ok: false as const, reason: 'duplicate-id' as const, items: existing }
  }
  const incomingById = new Map(payload.map(item => [item.id, item]))
  const existingIds = new Set(existing.map(item => item.id))
  const items = existing.map(sourceItem => {
    const item = cloneTechnicalSubproject(sourceItem)
    const next = incomingById.get(item.id)
    return next ? { ...item, ...next, active: true } : { ...item, active: false }
  })
  payload.forEach(item => {
    const id = item.id
    if (!existingIds.has(id)) items.push({
      id,
      parentProjectId: item.parentProjectId,
      name: item.name,
      active: true,
      ipmOrder: item.ipmOrder,
      configuration: { ...EMPTY_SUBPROJECT_CONFIGURATION },
    })
  })
  return { ok: true as const, items: items.sort(compareSubprojects) }
}
