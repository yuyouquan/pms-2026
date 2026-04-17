import { create } from 'zustand'
import {
  MOCK_TM_USERS,
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
  transferView: null | 'apply' | 'detail' | 'entry' | 'review' | 'sqa-review'
  selectedTransferAppId: string | null

  // Config center
  transferConfigView: 'home' | 'checklist' | 'review'
  tmConfigSearchText: string
  tmConfigSelectedVersion: string
  tmConfigDiffOpen: boolean
  tmConfigDiffFrom: string
  tmConfigDiffTo: string

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
  setCurrentUser: (v: typeof MOCK_TM_USERS[0]) => void

  setTransferView: (v: null | 'apply' | 'detail' | 'entry' | 'review' | 'sqa-review') => void
  setSelectedTransferAppId: (v: string | null) => void

  setTransferConfigView: (v: 'home' | 'checklist' | 'review') => void
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

export const useTransferStore = create<TransferState & TransferActions>()((set) => ({
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
  tmChecklistItems: MOCK_CHECKLIST_ITEMS,
  tmReviewElements: MOCK_REVIEW_ELEMENTS,
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

  // ─── Setters ─────────────────────────────────────────────────────
  setCurrentUser: (v) => set({ currentUser: v }),

  setTransferView: (v) => set((s) => s.transferView === v ? { transferView: v } : { transferView: v, ...VIEW_TRANSIENT_DEFAULTS }),
  setSelectedTransferAppId: (v) => set({ selectedTransferAppId: v }),

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
}))
