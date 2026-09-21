import { canResourceAction, type ResourcePermissionAction } from '@/lib/hrProjectRegistry'
import type { ResourceInlinePatch } from '@/lib/resourceInlineEditing'

export function resourceInlinePermission(patch: ResourceInlinePatch): ResourcePermissionAction {
  if (['departments', 'departmentRatio', 'departmentTotal'].includes(patch.type)) return 'laborEdit'
  if (['nonLabor', 'nonLaborItemTotal'].includes(patch.type)) return 'nonLaborEdit'
  return 'createVersion'
}

const fields: Record<string, ResourcePermissionAction> = {
  batch: 'createVersion', metadata: 'createVersion', milestones: 'createVersion',
  projectLevel: 'createVersion', levelCoefficient: 'createVersion', hrModelVersion: 'createVersion',
  projectStartTime: 'createVersion', projectEndTime: 'createVersion',
  nonLaborInvestment: 'nonLaborEdit', estimatedInvestment: 'laborEdit',
  departmentInvestments: 'laborEdit', departmentPhaseRatios: 'laborEdit',
}
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => equal(value, b[i]))
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && equal(left[key], right[key]))
}
/** Validate every changed field before any writes; never let a bulk payload bypass another grant. */
export function canUpdateResourceFields(project: { pmsProjectId?: string }, version: object, updates: Record<string, unknown>): boolean {
  const source = version as Record<string, unknown>
  return Object.entries(updates).every(([key, value]) => {
    if (!(key in fields)) return false
    if (value === undefined) return true
    const old = key === 'metadata' ? project as unknown as Record<string, unknown> : source
    const unchanged = (key === 'milestones' || key === 'metadata') && value && typeof value === 'object'
      ? Object.entries(value).every(([field, item]) => equal((key === 'metadata' ? old : source.milestones as Record<string, unknown>)?.[field], item))
      : equal(source[key], value)
    return unchanged || canResourceAction(project, fields[key])
  })
}
