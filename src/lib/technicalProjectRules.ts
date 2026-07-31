import { NO_SUBDOMAIN_DOMAINS, SUBDOMAINS_BY_DOMAIN, TECHNICAL_DELIVERABLE_FIELDS, TECHNICAL_STRING_FIELD_KEYS } from '@/constants/technicalProject'
import type { DeliverableValue, TechnicalDomain, TechnicalSubproject } from '@/types/technicalProject'

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

export const synchronizeTechnicalSubprojects = (
  existing: readonly TechnicalSubproject[],
  incoming: ReadonlyArray<{ id: string; name?: string }>,
) => {
  if (new Set(incoming.map(item => item.id)).size !== incoming.length) {
    return { ok: false as const, reason: 'duplicate-id' as const, items: existing }
  }
  const incomingById = new Map(incoming.map(item => [item.id, item]))
  const existingIds = new Set(existing.map(item => item.id))
  const items = existing.map(item => {
    const next = incomingById.get(item.id)
    return next ? { ...item, ...next, active: true } : { ...item, active: false }
  })
  incoming.forEach(item => {
    if (!existingIds.has(item.id)) items.push({ ...item, active: true })
  })
  return { ok: true as const, items }
}
