import type { TransferState } from '@/stores/transfer'
import { MOCK_TRANSFER_APPLICATIONS, MOCK_CHECKLIST_ITEMS, MOCK_REVIEW_ELEMENTS, MOCK_HISTORY, MOCK_BLOCK_TASKS, MOCK_LEGACY_TASKS } from '@/mock/transfer-maintenance'
import { TRANSFER_TEMPLATE_REVISION } from '@/mock/transfer-template-source'
import { createTransferTemplateVersions, getTransferRoleConfig, TRANSFER_PROJECT_TYPES } from '@/lib/transferConfig'

/** Non-security fingerprint of the complete previous fixture, including drafts and history. */
export function transferMockFingerprint(value: unknown): string {
  const normalize = (input: unknown): unknown => Array.isArray(input) ? input.map(normalize) : input && typeof input === 'object'
    ? Object.fromEntries(Object.entries(input).filter(([, child]) => child !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, normalize(child)])) : input
  const text = JSON.stringify(normalize(value))
  let first = 2166136261, second = 5381
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619) >>> 0
    second = (Math.imul(second, 33) ^ text.charCodeAt(index)) >>> 0
  }
  return `${text.length}:${first.toString(16).padStart(8, '0')}:${second.toString(16).padStart(8, '0')}`
}
// Baselines captured from the previously released fixtures (bad3388).
const templateBaselines = { '整机产品项目': '13412:a040df3a:0514857a', 'tOS版本项目': '6715:3893d91f:acd35ffb' }
const applicationBaselines: Record<string, string> = { ta001: '32040:946689b3:cf94f005', ta002: '30848:91ab7e46:d14d24b4', ta003: '29256:9fbd88d5:acb46735', ta004: '28092:26b30823:8bc5b44b' }
const refreshRevision = `${TRANSFER_TEMPLATE_REVISION}-refresh-2`
const collections = ['tmChecklistItems', 'tmReviewElements', 'tmHistory', 'tmBlockTasks', 'tmLegacyTasks'] as const

export function refreshTransferMockState(state: TransferState): Partial<TransferState> | null {
  if (state.tmMockTemplateRevision === refreshRevision) return null
  const tmTemplateVersions = { ...state.tmTemplateVersions }
  const current = createTransferTemplateVersions()
  for (const kind of TRANSFER_PROJECT_TYPES) {
    const roles = state.tmTeamConfigs[kind]
    const defaultRoles = getTransferRoleConfig(kind)
    const roleMap = new Map(defaultRoles.map(role => [role.roleName, roles.find(candidate => candidate.ipmRoleCode === role.ipmRoleCode)?.roleName]))
    // Custom team roles remain authoritative; never publish rows with missing owners.
    const requiredRoles = current[kind].checklist.concat(current[kind].review).flatMap(version => version.rows.map(row => row.responsibleRole))
    if (requiredRoles.some(role => !roleMap.get(role))) continue
    if (transferMockFingerprint(roles) === transferMockFingerprint(defaultRoles)
      && transferMockFingerprint(state.tmTemplateVersions[kind]) === templateBaselines[kind]) {
      tmTemplateVersions[kind] = current[kind]
      continue
    }
    tmTemplateVersions[kind] = { ...state.tmTemplateVersions[kind] }
    for (const templateKind of ['checklist', 'review'] as const) {
      const incoming = current[kind][templateKind][0]
      const versions = state.tmTemplateVersions[kind][templateKind]
      if (!incoming || versions.some(version => version.id === incoming.id)) continue
      const rows = incoming.rows.map(row => {
        const role = roleMap.get(row.responsibleRole)!
        return { ...row, responsibleRole: role, entryRole: `在研${role}`, reviewRole: `维护${role}` }
      })
      // A source refresh becomes the current version; user imports remain immutable history.
      tmTemplateVersions[kind][templateKind] = [...versions, { ...incoming, version: `v${versions.length + 1}.0`, rows }]
    }
  }
  const refreshIds = new Set(state.transferApplications.filter(application => {
    const bundle = { application, ...Object.fromEntries(collections.map(key => [key, state[key].filter(row => row.applicationId === application.id)])) }
    return transferMockFingerprint(bundle) === applicationBaselines[application.id]
  }).map(app => app.id))
  const nextApplications = state.transferApplications.map(app => refreshIds.has(app.id) ? structuredClone(MOCK_TRANSFER_APPLICATIONS.find(seed => seed.id === app.id)!) : app)
  const tosSeed = MOCK_TRANSFER_APPLICATIONS.find(app => app.id === 'ta005')!
  // Do not introduce a second active application in a project a user already started.
  if (!nextApplications.some(app => app.id === tosSeed.id || (app.projectId === tosSeed.projectId && app.status === 'in_progress'))) {
    nextApplications.push(structuredClone(tosSeed)); refreshIds.add(tosSeed.id)
  }
  const replace = <T extends { applicationId: string }>(rows: T[], seeds: T[]): T[] => [...rows.filter(row => !refreshIds.has(row.applicationId)), ...structuredClone(seeds.filter(row => refreshIds.has(row.applicationId)))]
  return {
    tmMockTemplateRevision: refreshRevision, tmTemplateVersions, transferApplications: nextApplications,
    tmChecklistItems: replace(state.tmChecklistItems, MOCK_CHECKLIST_ITEMS), tmReviewElements: replace(state.tmReviewElements, MOCK_REVIEW_ELEMENTS),
    tmHistory: replace(state.tmHistory, MOCK_HISTORY), tmBlockTasks: replace(state.tmBlockTasks, MOCK_BLOCK_TASKS), tmLegacyTasks: replace(state.tmLegacyTasks, MOCK_LEGACY_TASKS),
  }
}
