import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { pmsLocalStorage } from '@/lib/mockDatasetStorage'
import { hasGlobalPermission } from '@/stores/permission'
import { createTransferTemplateVersions, getTransferRoleConfig, validateTransferTeamConfig, type TransferProjectType, type TransferTeamRole, type TransferTemplateVersions, type TransferTemplateKind, type TransferTemplateRow } from '@/lib/transferConfig'
import { seedTransferMaterials, syncTransferPipeline } from '@/lib/transferWorkflow'
import { getTransferAiCheckResult } from '@/lib/transferAiCheck'
import {
  MOCK_TM_USERS,
  MOCK_HISTORY,
  type HistoryRecord,
  MOCK_TRANSFER_APPLICATIONS,
  MOCK_CHECKLIST_ITEMS,
  MOCK_REVIEW_ELEMENTS,
  MOCK_BLOCK_TASKS,
  MOCK_LEGACY_TASKS,
  type TransferApplication,
  type CheckListItem,
  type ReviewElement,
  type BlockTask,
  type LegacyTask,
  type TMTeamMember,
} from '@/mock/transfer-maintenance'

export interface TransferState {
  // Current user (transfer system mock user)
  currentUser: typeof MOCK_TM_USERS[0]

  // View navigation
  transferView: null | 'apply' | 'detail' | 'entry' | 'review' | 'maintenance-spm-review'
  selectedTransferAppId: string | null

  // Config center
  transferConfigView: 'home' | 'checklist' | 'review' | 'team'
  tmConfigSearchText: string
  tmConfigSelectedVersion: string
  tmConfigDiffOpen: boolean
  tmConfigDiffFrom: string
  tmConfigDiffTo: string

  transferProjectType: TransferProjectType
  tmTeamConfigs: Record<TransferProjectType, TransferTeamRole[]>
  tmTemplateVersions: TransferTemplateVersions
  tmHistory: HistoryRecord[]
  tmReopenAppId: string | null
  // Data
  transferApplications: TransferApplication[]
  tmChecklistItems: CheckListItem[]
  tmReviewElements: ReviewElement[]
  tmBlockTasks: BlockTask[]
  tmLegacyTasks: LegacyTask[]

  // Apply form
  tmApplyProject: string
  tmApplyDate: string
  tmApplyRemark: string
  tmApplyTeam: { research: TMTeamMember[]; maintenance: TMTeamMember[] }

  // General modal
  tmModalVisible: boolean
  tmModalTitle: string
  tmModalContent: string

  // Detail result modal (AI check / review opinion)
  tmDetailModalVisible: boolean
  tmDetailModalTitle: string
  tmDetailModalContent: string

  // Close pipeline modal
  tmCloseModalVisible: boolean
  tmCloseAppId: string | null
  tmCloseReason: string

  // Entry (资料录入)
  tmEntryTab: 'checklist' | 'review'
  tmEntryModalOpen: boolean
  tmEntryModalRecord: any
  tmEntryContent: string
  tmEntryActiveRole: string

  // Review (审核)
  tmReviewTab: 'checklist' | 'review'
  tmReviewModalOpen: boolean
  tmReviewAction: 'pass' | 'reject'
  tmReviewRecord: any
  tmReviewComment: string
  tmReviewActiveRole: string

  // SQA review
  tmSqaComment: string
  tmSqaModalOpen: boolean
  tmSqaAction: 'approve' | 'reject'
}

export interface TransferActions {
  setTransferProjectType: (kind: TransferProjectType) => void
  setTmHistory: (v: HistoryRecord[] | ((previous: HistoryRecord[]) => HistoryRecord[])) => void
  setTmReopenAppId: (id: string | null) => void
  saveTransferTeamConfig: (kind: TransferProjectType, roles: TransferTeamRole[], actor: string) => string[]
  importTransferTemplate: (kind: TransferProjectType, templateKind: TransferTemplateKind, rows: TransferTemplateRow[], actor: string) => boolean

  setCurrentUser: (v: typeof MOCK_TM_USERS[0]) => void

  setTransferView: (v: null | 'apply' | 'detail' | 'entry' | 'review' | 'maintenance-spm-review') => void
  setSelectedTransferAppId: (v: string | null) => void

  setTransferConfigView: (v: 'home' | 'checklist' | 'review' | 'team') => void
  setTmConfigSearchText: (v: string) => void
  setTmConfigSelectedVersion: (v: string) => void
  setTmConfigDiffOpen: (v: boolean) => void
  setTmConfigDiffFrom: (v: string) => void
  setTmConfigDiffTo: (v: string) => void

  setTransferApplications: (v: TransferApplication[] | ((prev: TransferApplication[]) => TransferApplication[])) => void
  setTmChecklistItems: (v: CheckListItem[] | ((prev: CheckListItem[]) => CheckListItem[])) => void
  setTmReviewElements: (v: ReviewElement[] | ((prev: ReviewElement[]) => ReviewElement[])) => void
  setTmBlockTasks: (v: BlockTask[] | ((prev: BlockTask[]) => BlockTask[])) => void
  setTmLegacyTasks: (v: LegacyTask[] | ((prev: LegacyTask[]) => LegacyTask[])) => void

  setTmApplyProject: (v: string) => void
  setTmApplyDate: (v: string) => void
  setTmApplyRemark: (v: string) => void
  setTmApplyTeam: (v: { research: TMTeamMember[]; maintenance: TMTeamMember[] } | ((prev: { research: TMTeamMember[]; maintenance: TMTeamMember[] }) => { research: TMTeamMember[]; maintenance: TMTeamMember[] })) => void

  setTmModalVisible: (v: boolean) => void
  setTmModalTitle: (v: string) => void
  setTmModalContent: (v: string) => void

  setTmDetailModalVisible: (v: boolean) => void
  setTmDetailModalTitle: (v: string) => void
  setTmDetailModalContent: (v: string) => void

  setTmCloseModalVisible: (v: boolean) => void
  setTmCloseAppId: (v: string | null) => void
  setTmCloseReason: (v: string) => void

  setTmEntryTab: (v: 'checklist' | 'review') => void
  setTmEntryModalOpen: (v: boolean) => void
  setTmEntryModalRecord: (v: any) => void
  setTmEntryContent: (v: string) => void
  setTmEntryActiveRole: (v: string) => void

  setTmReviewTab: (v: 'checklist' | 'review') => void
  setTmReviewModalOpen: (v: boolean) => void
  setTmReviewAction: (v: 'pass' | 'reject') => void
  setTmReviewRecord: (v: any) => void
  setTmReviewComment: (v: string) => void
  setTmReviewActiveRole: (v: string) => void

  setTmSqaComment: (v: string) => void
  setTmSqaModalOpen: (v: boolean) => void
  setTmSqaAction: (v: 'approve' | 'reject') => void
}

// View-scoped transient state — reset whenever transferView changes to prevent
// stale data leaking between apply / detail / entry / review / sqa-review.
const VIEW_TRANSIENT_DEFAULTS = {
  // Apply
  tmApplyProject: '',
  tmApplyDate: '',
  tmApplyRemark: '',
  tmApplyTeam: { research: [] as TMTeamMember[], maintenance: [] as TMTeamMember[] },
  // Detail
  tmDetailModalVisible: false,
  tmDetailModalTitle: '',
  tmDetailModalContent: '',
  // Entry
  tmEntryTab: 'checklist' as const,
  tmEntryModalOpen: false,
  tmEntryModalRecord: null as any,
  tmEntryContent: '',
  tmEntryActiveRole: 'all',
  // Review
  tmReviewTab: 'checklist' as const,
  tmReviewModalOpen: false,
  tmReviewAction: 'pass' as const,
  tmReviewRecord: null as any,
  tmReviewComment: '',
  tmReviewActiveRole: 'all',
  // SQA
  tmSqaComment: '',
  tmSqaModalOpen: false,
  tmSqaAction: 'approve' as const,
}

const additionalMaterials = MOCK_TRANSFER_APPLICATIONS.filter(app => !MOCK_CHECKLIST_ITEMS.some(item => item.applicationId === app.id)).map(seedTransferMaterials)

export const useTransferStore = create<TransferState & TransferActions>()(persist((set, get) => ({
  transferProjectType: '整机产品项目',
  tmTeamConfigs: { '整机产品项目': getTransferRoleConfig('整机产品项目'), 'tOS版本项目': getTransferRoleConfig('tOS版本项目') },
  tmTemplateVersions: createTransferTemplateVersions(),
  tmHistory: MOCK_HISTORY,
  tmReopenAppId: null,
  // Current user
  currentUser: MOCK_TM_USERS[0],

  // View navigation
  transferView: null,
  selectedTransferAppId: null,

  // Config center
  transferConfigView: 'home',
  tmConfigSearchText: '',
  tmConfigSelectedVersion: 'v3.0',
  tmConfigDiffOpen: false,
  tmConfigDiffFrom: 'v2.0',
  tmConfigDiffTo: 'v3.0',

  // Data
  transferApplications: MOCK_TRANSFER_APPLICATIONS,
  tmChecklistItems: [...MOCK_CHECKLIST_ITEMS, ...additionalMaterials.flatMap(materials => materials.checklist)],
  tmReviewElements: [...MOCK_REVIEW_ELEMENTS, ...additionalMaterials.flatMap(materials => materials.reviewElements)],
  tmBlockTasks: MOCK_BLOCK_TASKS,
  tmLegacyTasks: MOCK_LEGACY_TASKS,

  // Apply form
  tmApplyProject: '',
  tmApplyDate: '',
  tmApplyRemark: '',
  tmApplyTeam: { research: [], maintenance: [] },

  // General modal
  tmModalVisible: false,
  tmModalTitle: '',
  tmModalContent: '',

  // Detail result modal
  tmDetailModalVisible: false,
  tmDetailModalTitle: '',
  tmDetailModalContent: '',

  // Close pipeline modal
  tmCloseModalVisible: false,
  tmCloseAppId: null,
  tmCloseReason: '',

  // Entry
  tmEntryTab: 'checklist',
  tmEntryModalOpen: false,
  tmEntryModalRecord: null,
  tmEntryContent: '',
  tmEntryActiveRole: 'all',

  // Review
  tmReviewTab: 'checklist',
  tmReviewModalOpen: false,
  tmReviewAction: 'pass',
  tmReviewRecord: null,
  tmReviewComment: '',
  tmReviewActiveRole: 'all',

  // SQA
  tmSqaComment: '',
  tmSqaModalOpen: false,
  tmSqaAction: 'approve',

  setTransferProjectType: kind => set({ transferProjectType: kind, transferConfigView: 'checklist', tmConfigSearchText: '', tmConfigSelectedVersion: '', tmConfigDiffOpen: false }),
  setTmHistory: value => set(state => ({ tmHistory: typeof value === 'function' ? value(state.tmHistory) : value })),
  setTmReopenAppId: id => set({ tmReopenAppId: id }),
  saveTransferTeamConfig: (kind, roles, actor) => {
    if (!hasGlobalPermission(actor, 'configCenter:transferEdit')) return ['暂无转维配置编辑权限']
    const errors = validateTransferTeamConfig(roles)
    const current = get(), previous = current.tmTeamConfigs[kind]
    const removed = previous.filter(role => !roles.some(next => next.id === role.id))
    const used = [...(current.tmTemplateVersions[kind].checklist.at(-1)?.rows ?? []), ...(current.tmTemplateVersions[kind].review.at(-1)?.rows ?? [])]
    removed.forEach(role => { if (used.some(row => [row.responsibleRole, row.entryRole.replace(/^在研/, ''), row.reviewRole.replace(/^维护/, '')].includes(role.roleName))) errors.push(`角色“${role.roleName}”仍被当前模板使用，请先调整模板`) })
    if (errors.length) return errors
    const normalized = roles.map(role => ({ ...role, roleName: role.roleName.trim(), ipmRoleCode: role.ipmRoleCode.trim() }))
    const rename = (name: string) => { const old = previous.find(role => role.roleName === name); return normalized.find(role => role.id === old?.id)?.roleName ?? name }
    const versions = { ...current.tmTemplateVersions[kind] }
    for (const templateKind of ['checklist', 'review'] as const) {
      const latest = versions[templateKind].at(-1)
      if (!latest) continue
      const rows = latest.rows.map(row => ({ ...row, responsibleRole: rename(row.responsibleRole), entryRole: `在研${rename(row.entryRole.replace(/^在研/, ''))}`, reviewRole: `维护${rename(row.reviewRole.replace(/^维护/, ''))}` }))
      if (JSON.stringify(rows) !== JSON.stringify(latest.rows)) versions[templateKind] = [...versions[templateKind], { ...latest, id: `${kind}-${templateKind}-${Date.now()}`, version: `v${versions[templateKind].length + 1}.0`, date: new Date().toISOString(), createdBy: actor, rows }]
    }
    set({ tmTeamConfigs: { ...current.tmTeamConfigs, [kind]: normalized }, tmTemplateVersions: { ...current.tmTemplateVersions, [kind]: versions } })
    return []
  },
  importTransferTemplate: (kind, templateKind, rows, actor) => {
    if (!hasGlobalPermission(actor, 'configCenter:transferEdit') || (kind === 'tOS版本项目' && templateKind === 'review') || !rows.length) return false
    const versions = get().tmTemplateVersions, previous = versions[kind][templateKind]
    const snapshot = { id: `${kind}-${templateKind}-${Date.now()}`, version: `v${previous.length + 1}.0`, kind: templateKind, date: new Date().toISOString(), createdBy: actor, rows: structuredClone(rows) }
    set({ tmTemplateVersions: { ...versions, [kind]: { ...versions[kind], [templateKind]: [...previous, snapshot] } }, tmConfigSelectedVersion: snapshot.id })
    return true
  },

  // ─── Setters ─────────────────────────────────────────────────────
  setCurrentUser: (v) => set({ currentUser: v }),

  setTransferView: (v) => set((s) => s.transferView === v ? { transferView: v } : { transferView: v, ...VIEW_TRANSIENT_DEFAULTS }),
  setSelectedTransferAppId: (v) => set(s => s.selectedTransferAppId === v ? { selectedTransferAppId: v } : { selectedTransferAppId: v, ...VIEW_TRANSIENT_DEFAULTS }),

  setTransferConfigView: (v) => set({ transferConfigView: v }),
  setTmConfigSearchText: (v) => set({ tmConfigSearchText: v }),
  setTmConfigSelectedVersion: (v) => set({ tmConfigSelectedVersion: v }),
  setTmConfigDiffOpen: (v) => set({ tmConfigDiffOpen: v }),
  setTmConfigDiffFrom: (v) => set({ tmConfigDiffFrom: v }),
  setTmConfigDiffTo: (v) => set({ tmConfigDiffTo: v }),

  setTransferApplications: (v) => set((s) => ({ transferApplications: typeof v === 'function' ? v(s.transferApplications) : v })),
  setTmChecklistItems: (v) => set((s) => ({ tmChecklistItems: typeof v === 'function' ? v(s.tmChecklistItems) : v })),
  setTmReviewElements: (v) => set((s) => ({ tmReviewElements: typeof v === 'function' ? v(s.tmReviewElements) : v })),
  setTmBlockTasks: (v) => set((s) => ({ tmBlockTasks: typeof v === 'function' ? v(s.tmBlockTasks) : v })),
  setTmLegacyTasks: (v) => set((s) => ({ tmLegacyTasks: typeof v === 'function' ? v(s.tmLegacyTasks) : v })),

  setTmApplyProject: (v) => set({ tmApplyProject: v }),
  setTmApplyDate: (v) => set({ tmApplyDate: v }),
  setTmApplyRemark: (v) => set({ tmApplyRemark: v }),
  setTmApplyTeam: (v) => set((s) => ({ tmApplyTeam: typeof v === 'function' ? v(s.tmApplyTeam) : v })),

  setTmModalVisible: (v) => set({ tmModalVisible: v }),
  setTmModalTitle: (v) => set({ tmModalTitle: v }),
  setTmModalContent: (v) => set({ tmModalContent: v }),

  setTmDetailModalVisible: (v) => set({ tmDetailModalVisible: v }),
  setTmDetailModalTitle: (v) => set({ tmDetailModalTitle: v }),
  setTmDetailModalContent: (v) => set({ tmDetailModalContent: v }),

  setTmCloseModalVisible: (v) => set({ tmCloseModalVisible: v }),
  setTmCloseAppId: (v) => set({ tmCloseAppId: v }),
  setTmCloseReason: (v) => set({ tmCloseReason: v }),

  setTmEntryTab: (v) => set({ tmEntryTab: v }),
  setTmEntryModalOpen: (v) => set({ tmEntryModalOpen: v }),
  setTmEntryModalRecord: (v) => set({ tmEntryModalRecord: v }),
  setTmEntryContent: (v) => set({ tmEntryContent: v }),
  setTmEntryActiveRole: (v) => set({ tmEntryActiveRole: v }),

  setTmReviewTab: (v) => set({ tmReviewTab: v }),
  setTmReviewModalOpen: (v) => set({ tmReviewModalOpen: v }),
  setTmReviewAction: (v) => set({ tmReviewAction: v }),
  setTmReviewRecord: (v) => set({ tmReviewRecord: v }),
  setTmReviewComment: (v) => set({ tmReviewComment: v }),
  setTmReviewActiveRole: (v) => set({ tmReviewActiveRole: v }),

  setTmSqaComment: (v) => set({ tmSqaComment: v }),
  setTmSqaModalOpen: (v) => set({ tmSqaModalOpen: v }),
  setTmSqaAction: (v) => set({ tmSqaAction: v }),
}), {
  name: 'pms-transfer-store', storage: createJSONStorage(() => pmsLocalStorage), skipHydration: true,
  partialize: state => ({ tmTeamConfigs: state.tmTeamConfigs, tmTemplateVersions: state.tmTemplateVersions, transferApplications: state.transferApplications, tmChecklistItems: state.tmChecklistItems, tmReviewElements: state.tmReviewElements, tmBlockTasks: state.tmBlockTasks, tmLegacyTasks: state.tmLegacyTasks, tmHistory: state.tmHistory }),
}))
let hydration: Promise<void> | undefined
/** Refresh only the untouched legacy mock configuration; preserve imports and application snapshots. */
export function upgradeTransferMockDefaults(): void {
  useTransferStore.setState(state => {
    const kind = 'tOS版本项目'
    const versions = state.tmTemplateVersions[kind]
    const untouchedTeam = JSON.stringify(state.tmTeamConfigs[kind]) === JSON.stringify(getTransferRoleConfig('整机产品项目'))
    const untouchedTemplates = versions.checklist.length === 1 && versions.checklist[0].id === `${kind}-checklist-1` && versions.checklist[0].createdBy === '系统' && !versions.review.length
    if (!untouchedTeam || !untouchedTemplates) return state
    return { tmTeamConfigs: { ...state.tmTeamConfigs, [kind]: getTransferRoleConfig(kind) }, tmTemplateVersions: { ...state.tmTemplateVersions, [kind]: createTransferTemplateVersions()[kind] } }
  })
}
/** A reload drops browser timers; finish saved mock checks instead of leaving them stuck forever. */
export function resumeTransferAiChecks(): void {
  useTransferStore.setState(state => {
    const activeIds = new Set(state.transferApplications.filter(app => app.status === 'in_progress' && app.pipeline.maintenanceSpmReview !== 'success').map(app => app.id))
    let changed = false
    const finish = <T extends CheckListItem | ReviewElement>(item: T): T => {
      if (!activeIds.has(item.applicationId) || item.entryStatus !== 'entered' || item.aiCheckStatus !== 'in_progress') return item
      changed = true
      return { ...item, ...getTransferAiCheckResult() }
    }
    const checklist = state.tmChecklistItems.map(finish), review = state.tmReviewElements.map(finish)
    return changed ? { tmChecklistItems: checklist, tmReviewElements: review, transferApplications: state.transferApplications.map(app => syncTransferPipeline(app, checklist, review)) } : state
  })
}
export function rehydrateTransferStore(): Promise<void> {
  if (!hydration) hydration = Promise.resolve(useTransferStore.persist.rehydrate()).then(() => { upgradeTransferMockDefaults(); resumeTransferAiChecks() })
  return hydration
}
