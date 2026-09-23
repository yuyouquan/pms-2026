// 人员、项目和流程结果为演示数据；模板标准来自用户提供的最新版飞书模板。
import { createMockTransferMaterials } from '@/mock/transfer-materials'
import { MOCK_CHECKLIST_TEMPLATES, MOCK_TOS_CHECKLIST_TEMPLATES, MOCK_REVIEW_ELEMENT_TEMPLATES, TRANSFER_TEMPLATE_REVISION } from '@/mock/transfer-template-source'
export { MOCK_CHECKLIST_TEMPLATES, MOCK_TOS_CHECKLIST_TEMPLATES, MOCK_REVIEW_ELEMENT_TEMPLATES }

// ========== 枚举类型 ==========

export type PipelineNodeStatus = 'not_started' | 'in_progress' | 'success' | 'failed'
export type RoleNodeStatus = 'not_started' | 'in_progress' | 'completed' | 'rejected'
export type EntryStatus = 'not_entered' | 'draft' | 'entered'
export type AICheckStatus = 'not_started' | 'in_progress' | 'passed' | 'failed'
export type ReviewStatus = 'not_reviewed' | 'reviewing' | 'passed' | 'rejected'
export type PipelineStatus = 'in_progress' | 'completed' | 'cancelled' | 'failed'
export type RoleType = string
export type PipelineRole = string

// ========== 核心接口 ==========

export interface TMTeamMember {
  id: string
  name: string
  role: RoleType
  department: string
  ipmRoleCode?: string
  avatar?: string
}

export interface ProjectTeam {
  research: TMTeamMember[]
  maintenance: TMTeamMember[]
}

export interface RoleProgress {
  role: PipelineRole
  entryStatus: RoleNodeStatus
  reviewStatus: RoleNodeStatus
}

export interface PipelineState {
  projectInit: PipelineNodeStatus
  dataEntry: PipelineNodeStatus
  maintenanceReview: PipelineNodeStatus
  maintenanceSpmReview: PipelineNodeStatus
  infoChange: PipelineNodeStatus
  roleProgress: RoleProgress[]
}

export interface TransferApplication {
  id: string
  projectId: string
  projectName: string
  applicant: string
  applicantId: string
  team: ProjectTeam
  plannedReviewDate: string
  remark: string
  status: PipelineStatus
  projectType?: '整机产品项目' | 'tOS版本项目'
  teamConfig?: { id: string; roleName: string; ipmRoleCode: string }[]
  finalReviewRole?: string
  templateVersionIds?: { checklist: string; review?: string }
  predecessorId?: string
  reopenedAsId?: string
  failureReason?: string
  cancelReason?: string
  pipeline: PipelineState
  createdAt: string
  updatedAt: string
}

export interface Deliverable {
  id: string
  name: string
  url: string
  type: 'file' | 'link'
}

export interface CheckListItem {
  id: string
  applicationId: string
  seq: string | number
  type: string
  checkItem: string
  responsibleRole: PipelineRole
  entryPerson: string
  entryPersonId: string
  reviewPerson: string
  reviewPersonId: string
  aiCheckRule: string
  deliverables: Deliverable[]
  entryContent?: string
  entryStatus: EntryStatus
  aiCheckStatus: AICheckStatus
  aiCheckResult?: string
  reviewStatus: ReviewStatus
  reviewComment?: string
  reviewRemark?: string
  delegatedTo?: string[]
  reviewDelegatedTo?: string[]
}

export interface ReviewElement {
  type?: string
  id: string
  applicationId: string
  seq: string | number
  standard: string
  description: string
  remark: string
  responsibleRole: PipelineRole
  entryPerson: string
  entryPersonId: string
  reviewPerson: string
  reviewPersonId: string
  aiCheckRule: string
  deliverables: Deliverable[]
  entryContent?: string
  entryStatus: EntryStatus
  aiCheckStatus: AICheckStatus
  aiCheckResult?: string
  reviewStatus: ReviewStatus
  reviewComment?: string
  reviewRemark?: string
  delegatedTo?: string[]
  reviewDelegatedTo?: string[]
}

export interface BlockTask {
  responsibleRole?: string
  id: string
  applicationId: string
  description: string
  resolution: string
  responsiblePerson: string
  department: string
  deadline: string
  status: 'open' | 'resolved' | 'cancelled'
  createdAt: string
}

export interface LegacyTask {
  id: string
  applicationId: string
  description: string
  responsiblePerson: string
  department: string
  deadline: string
  status: 'open' | 'resolved' | 'cancelled'
  createdAt: string
}

export interface HistoryRecord {
  id: string
  applicationId: string
  action: string
  operator: string
  detail: string
  timestamp: string
}

export interface CloseReviewRow {
  role: string
  responsiblePerson: string
  conclusion: 'N/A' | 'PASS' | 'Fail'
  comment: string
}

// ========== 配置中心模板接口（保留） ==========

export interface CheckListTemplate {
  seq?: string | number
  id: number
  type: string
  checkItem: string
  responsibleRole: string
  entryRole: string
  reviewRole: string
  aiCheckRule: string
}

export interface ReviewElementTemplate {
  seq?: string | number
  type?: string
  id: number
  standard: string
  description: string
  remark: string
  responsibleRole: string
  entryRole: string
  reviewRole: string
  aiCheckRule: string
}

// 版本管理接口
export interface TemplateVersion {
  version: string
  date: string
  itemCount: number
  isCurrent: boolean
}

export interface VersionDiffItem {
  checkItem?: string
  description?: string
  status: '新增' | '修改' | '删除'
}

// 兼容旧代码 — TeamMember alias
export type TeamMember = TMTeamMember

// ========== 用户列表（9个唯一可登录身份） ==========

export const MOCK_TM_USERS: TMTeamMember[] = [
  { id: 'u001', name: '演示用户01', role: 'SPM', department: '示例项目组' },
  { id: 'u002', name: '演示用户02', role: 'SPM', department: '示例项目组' },
  { id: 'u003', name: '演示用户03', role: 'SPM', department: '示例项目组' },
  { id: 'u004', name: '演示用户04', role: 'TPM', department: '示例测试组' },
  { id: 'u005', name: '演示用户05', role: 'TPM', department: '示例测试组' },
  { id: 'u006', name: '演示用户06', role: 'TPM', department: '示例测试组' },
  { id: 'u007', name: '演示用户07', role: 'SQA', department: '示例质量组' },
  { id: 'u008', name: '演示用户08', role: '底软', department: '示例底软组' },
  { id: 'login-演示用户09', name: '演示用户09', role: '底软', department: '示例底软组' },
]

// ========== 项目团队 ==========
// Role belongs to the project-team assignment; identity always comes from the unique directory.

const TEAM_1: ProjectTeam = {
  research: [
    { ...MOCK_TM_USERS[0], role: 'SPM' },
    { ...MOCK_TM_USERS[3], role: 'TPM' },
    { ...MOCK_TM_USERS[7], role: '底软' },
    { ...MOCK_TM_USERS[4], role: '系统' },
    { ...MOCK_TM_USERS[2], role: '影像' },
  ],
  maintenance: [
    { ...MOCK_TM_USERS[1], role: 'SPM' },
    { ...MOCK_TM_USERS[4], role: 'TPM' },
    { ...MOCK_TM_USERS[8], role: '底软' },
    { ...MOCK_TM_USERS[5], role: '系统' },
    { ...MOCK_TM_USERS[3], role: '影像' },
  ],
}

const TEAM_2: ProjectTeam = {
  research: [
    { ...MOCK_TM_USERS[2], role: 'SPM' },
    { ...MOCK_TM_USERS[5], role: 'TPM' },
    { ...MOCK_TM_USERS[7], role: '底软' },
    { ...MOCK_TM_USERS[6], role: '系统' },
    { ...MOCK_TM_USERS[3], role: '影像' },
  ],
  maintenance: [
    { ...MOCK_TM_USERS[0], role: 'SPM' },
    { ...MOCK_TM_USERS[3], role: 'TPM' },
    { ...MOCK_TM_USERS[7], role: '底软' },
    { ...MOCK_TM_USERS[4], role: '系统' },
    { ...MOCK_TM_USERS[2], role: '影像' },
  ],
}

export const MOCK_TM_TEAMS = { TEAM_1, TEAM_2 }

// ========== 角色颜色 ==========

export const ROLE_COLORS: Record<string, string> = {
  SPM: '#4338ca',
  TPM: '#0891b2',
  SQA: '#059669',
  '底软': '#d97706',
  '系统': '#dc2626',
  '影像': '#7c3aed',
  '测试': '#0891b2',
}

// ========== 转维申请 ==========

export const MOCK_TRANSFER_APPLICATIONS: TransferApplication[] = [
  {
    id: 'ta001',
    projectId: '1',
    projectName: 'DEMO017-DEMOCHIP001_DEMOBOARD016',
    applicant: '演示用户01',
    applicantId: 'u001',
    team: TEAM_1,
    plannedReviewDate: '2026-04-15',
    remark: '预计Q2完成全部转维材料，底软和系统已开始录入',
    status: 'in_progress',
    pipeline: {
      projectInit: 'success',
      dataEntry: 'in_progress',
      maintenanceReview: 'not_started',
      maintenanceSpmReview: 'not_started',
      infoChange: 'not_started',
      roleProgress: [
        { role: 'SPM', entryStatus: 'in_progress', reviewStatus: 'not_started' },
        { role: '测试', entryStatus: 'in_progress', reviewStatus: 'not_started' },
        { role: '底软', entryStatus: 'in_progress', reviewStatus: 'not_started' },
        { role: '系统', entryStatus: 'in_progress', reviewStatus: 'not_started' },
        { role: '影像', entryStatus: 'not_started', reviewStatus: 'not_started' },
      ],
    },
    createdAt: '2026-03-15 09:30:00',
    updatedAt: '2026-03-23 14:20:00',
  },
  {
    id: 'ta002',
    projectId: '3',
    projectName: 'DEMO013_DEMOBOARD010',
    applicant: '演示用户03',
    applicantId: 'u003',
    team: TEAM_2,
    plannedReviewDate: '2026-05-01',
    remark: '资料录入已完成，进入维护团队审核阶段',
    status: 'in_progress',
    pipeline: {
      projectInit: 'success',
      dataEntry: 'success',
      maintenanceReview: 'in_progress',
      maintenanceSpmReview: 'not_started',
      infoChange: 'not_started',
      roleProgress: [
        { role: 'SPM', entryStatus: 'completed', reviewStatus: 'in_progress' },
        { role: '测试', entryStatus: 'completed', reviewStatus: 'completed' },
        { role: '底软', entryStatus: 'completed', reviewStatus: 'in_progress' },
        { role: '系统', entryStatus: 'completed', reviewStatus: 'rejected' },
        { role: '影像', entryStatus: 'completed', reviewStatus: 'completed' },
      ],
    },
    createdAt: '2026-02-20 10:00:00',
    updatedAt: '2026-03-22 16:45:00',
  },
  {
    id: 'ta003',
    projectId: '7',
    projectName: 'DEMO020-DEMOCHIP002_DEMOBOARD002',
    applicant: '演示用户01',
    applicantId: 'u001',
    team: TEAM_1,
    plannedReviewDate: '2026-03-01',
    remark: '全部审核通过，已完成转维',
    status: 'completed',
    pipeline: {
      projectInit: 'success',
      dataEntry: 'success',
      maintenanceReview: 'success',
      maintenanceSpmReview: 'success',
      infoChange: 'success',
      roleProgress: [
        { role: 'SPM', entryStatus: 'completed', reviewStatus: 'completed' },
        { role: '测试', entryStatus: 'completed', reviewStatus: 'completed' },
        { role: '底软', entryStatus: 'completed', reviewStatus: 'completed' },
        { role: '系统', entryStatus: 'completed', reviewStatus: 'completed' },
        { role: '影像', entryStatus: 'completed', reviewStatus: 'completed' },
      ],
    },
    createdAt: '2026-01-10 08:00:00',
    updatedAt: '2026-03-01 17:30:00',
  },
  {
    id: 'ta004',
    projectId: '12',
    projectName: 'DEMO001-DEMOCHIP001_DEMOBOARD017',
    applicant: '演示用户02',
    applicantId: 'u002',
    team: TEAM_2,
    plannedReviewDate: '2026-04-20',
    remark: '',
    status: 'cancelled',
    cancelReason: '项目延期，转维计划取消',
    pipeline: {
      projectInit: 'success',
      dataEntry: 'failed',
      maintenanceReview: 'not_started',
      maintenanceSpmReview: 'not_started',
      infoChange: 'not_started',
      roleProgress: [
        { role: 'SPM', entryStatus: 'in_progress', reviewStatus: 'not_started' },
        { role: '测试', entryStatus: 'not_started', reviewStatus: 'not_started' },
        { role: '底软', entryStatus: 'not_started', reviewStatus: 'not_started' },
        { role: '系统', entryStatus: 'not_started', reviewStatus: 'not_started' },
        { role: '影像', entryStatus: 'not_started', reviewStatus: 'not_started' },
      ],
    },
    createdAt: '2026-03-05 11:00:00',
    updatedAt: '2026-03-18 09:15:00',
  },
  {
    id: 'ta005', projectId: '2', projectName: 'tOS16.1', projectType: 'tOS版本项目',
    applicant: '演示用户01', applicantId: 'u001',
    team: {
      research: TEAM_1.research.filter(member => ['SPM', 'TPM'].includes(member.role)),
      maintenance: TEAM_1.maintenance.filter(member => ['SPM', 'TPM'].includes(member.role)),
    },
    plannedReviewDate: '2026-10-15', remark: '使用最新版tOS CheckList的转维演示申请', status: 'in_progress',
    pipeline: {
      projectInit: 'success', dataEntry: 'in_progress', maintenanceReview: 'not_started', maintenanceSpmReview: 'not_started', infoChange: 'not_started',
      roleProgress: [{ role: 'SPM', entryStatus: 'in_progress', reviewStatus: 'not_started' }, { role: 'TPM', entryStatus: 'in_progress', reviewStatus: 'not_started' }],
    },
    createdAt: '2026-09-23 09:00:00', updatedAt: '2026-09-23 09:00:00',
  },
]

MOCK_TRANSFER_APPLICATIONS.forEach(app => {
  const projectType = app.projectType ?? '整机产品项目'
  app.projectType = projectType
  app.finalReviewRole = 'SPM'
  app.teamConfig = app.team.research.map((member, index) => ({ id: member.role === 'SPM' ? 'spm' : `seed-role-${index}`, roleName: member.role === 'TPM' && projectType === '整机产品项目' ? '测试' : member.role, ipmRoleCode: member.role }))
  app.templateVersionIds = { checklist: `${projectType}-checklist-${TRANSFER_TEMPLATE_REVISION}`, ...(projectType === '整机产品项目' ? { review: `${projectType}-review-${TRANSFER_TEMPLATE_REVISION}` } : {}) }
})

// ========== Pipeline 节点名 ==========
const PIPELINE_NODES = ['项目发起', '资料录入', '维护审核', '维护SPM审核', '信息变更']
const PIPELINE_KEYS: (keyof Omit<PipelineState, 'roleProgress'>)[] = ['projectInit', 'dataEntry', 'maintenanceReview', 'maintenanceSpmReview', 'infoChange']

// ========== 与配置中心同源的流程材料 ==========
const initialMaterials = MOCK_TRANSFER_APPLICATIONS.map(createMockTransferMaterials)
export const MOCK_CHECKLIST_ITEMS = initialMaterials.flatMap(materials => materials.checklist)
export const MOCK_REVIEW_ELEMENTS = initialMaterials.flatMap(materials => materials.reviewElements)

// ========== Block 任务 ==========

export const MOCK_BLOCK_TASKS: BlockTask[] = [
  {
    id: 'bt001', applicationId: 'ta002', description: '系统模块接口文档版本不一致，Swagger文档未同步更新',
    resolution: '需系统组更新Swagger文档并重新生成接口说明', responsiblePerson: '演示用户07', department: '示例系统组',
    deadline: '2026-03-28', status: 'open', createdAt: '2026-03-20 10:30:00',
  },
  {
    id: 'bt002', applicationId: 'ta002', description: '底软驱动兼容性测试在特定机型上失败',
    resolution: '底软组排查驱动兼容问题，已定位到LCD驱动初始化时序', responsiblePerson: '演示用户08', department: '示例底软组',
    deadline: '2026-03-25', status: 'resolved', createdAt: '2026-03-18 14:00:00',
  },
  {
    id: 'bt003', applicationId: 'ta002', description: '维护SPM审核发现性能测试报告缺少压力测试场景',
    resolution: '测试组补充压力测试场景并重新出具报告', responsiblePerson: '演示用户06', department: '示例测试组',
    deadline: '2026-03-30', status: 'open', createdAt: '2026-03-22 09:15:00',
  },
]

// ========== 遗留任务 ==========

export const MOCK_LEGACY_TASKS: LegacyTask[] = [
  {
    id: 'lt001', applicationId: 'ta002', description: '旧版Camera HAL层接口需在MR1版本中迁移至新框架',
    responsiblePerson: '演示用户03', department: '示例影像组', deadline: '2026-06-30', status: 'open', createdAt: '2026-03-20 11:00:00',
  },
  {
    id: 'lt002', applicationId: 'ta002', description: '底软电源管理模块历史遗留的唤醒延迟问题需后续优化',
    responsiblePerson: '演示用户08', department: '示例底软组', deadline: '2026-07-15', status: 'open', createdAt: '2026-03-21 16:30:00',
  },
]

// ========== 历史记录 ==========

export const MOCK_HISTORY: HistoryRecord[] = [
  { id: 'h001', applicationId: 'ta001', action: '创建', operator: '演示用户01', detail: '创建转维申请，计划评审日期: 2026-04-15', timestamp: '2026-03-15 09:30:00' },
  { id: 'h002', applicationId: 'ta001', action: '录入', operator: '演示用户01', detail: 'SPM角色完成当前CheckList资料整理，待提交', timestamp: '2026-03-16 14:20:00' },
  { id: 'h003', applicationId: 'ta001', action: '录入', operator: '演示用户08', detail: '底软角色完成当前CheckList资料整理，待提交', timestamp: '2026-03-18 17:00:00' },
  { id: 'h004', applicationId: 'ta001', action: '录入', operator: '演示用户04', detail: '测试角色开始录入CheckList', timestamp: '2026-03-19 09:00:00' },
  { id: 'h005', applicationId: 'ta001', action: '录入', operator: '演示用户05', detail: '系统角色开始录入CheckList', timestamp: '2026-03-20 10:30:00' },
  { id: 'h006', applicationId: 'ta001', action: 'AI检查', operator: '系统', detail: 'AI检查演示：已录入的模拟资料检查通过', timestamp: '2026-03-20 10:35:00' },
  { id: 'h007', applicationId: 'ta002', action: '创建', operator: '演示用户03', detail: '创建转维申请，计划评审日期: 2026-05-01', timestamp: '2026-02-20 10:00:00' },
  { id: 'h008', applicationId: 'ta002', action: '录入完成', operator: '系统', detail: '全部角色完成资料录入，流水线进入维护审核阶段', timestamp: '2026-03-10 16:00:00' },
  { id: 'h009', applicationId: 'ta002', action: '通过', operator: '演示用户05', detail: '测试角色维护审核通过', timestamp: '2026-03-15 11:00:00' },
  { id: 'h010', applicationId: 'ta002', action: '通过', operator: '演示用户04', detail: '影像角色维护审核通过', timestamp: '2026-03-16 14:30:00' },
  { id: 'h011', applicationId: 'ta002', action: '不通过', operator: '演示用户05', detail: '系统角色维护审核不通过: 接口文档版本不一致', timestamp: '2026-03-18 09:20:00' },
  { id: 'h012', applicationId: 'ta003', action: '创建', operator: '演示用户01', detail: '创建转维申请', timestamp: '2026-01-10 08:00:00' },
  { id: 'h013', applicationId: 'ta003', action: '通过', operator: '演示用户07', detail: '维护SPM审核通过，转维流程完成', timestamp: '2026-03-01 17:30:00' },
  { id: 'h014', applicationId: 'ta004', action: '创建', operator: '演示用户02', detail: '创建转维申请', timestamp: '2026-03-05 11:00:00' },
  { id: 'h015', applicationId: 'ta004', action: '关闭', operator: '演示用户02', detail: '项目延期，取消转维计划', timestamp: '2026-03-18 09:15:00' },
  { id: 'h016', applicationId: 'ta005', action: '创建', operator: '演示用户01', detail: '按最新版tOS CheckList创建演示转维申请，共26项，计划评审日期：2026-10-15', timestamp: '2026-09-23 09:00:00' },
]

// ========== Helper 函数 ==========

export function getCurrentNodeIndex(app: TransferApplication): number {
  const keys = PIPELINE_KEYS
  for (let i = keys.length - 1; i >= 0; i--) {
    if (app.pipeline[keys[i]] !== 'not_started') return i
  }
  return 0
}

export function getCurrentNodeLabel(app: TransferApplication): string {
  return PIPELINE_NODES[getCurrentNodeIndex(app)]
}

export function getCurrentNodeStatus(app: TransferApplication): PipelineNodeStatus {
  const idx = getCurrentNodeIndex(app)
  return app.pipeline[PIPELINE_KEYS[idx]]
}

export function getPipelinePercent(app: TransferApplication): number {
  const keys = PIPELINE_KEYS
  let done = 0
  for (const k of keys) {
    if (app.pipeline[k] === 'success') done++
  }
  return Math.round((done / keys.length) * 100)
}

export function hasAnyRoleEnteredReview(app: TransferApplication): boolean {
  return app.pipeline.roleProgress.some(rp => rp.reviewStatus !== 'not_started')
}

export function buildCloseReviewRows(
  app: TransferApplication,
  checklistItems: CheckListItem[],
  reviewElements: ReviewElement[],
): CloseReviewRow[] {
  const config = app.teamConfig ?? []
  const roleConfig = (role: string) => config.find(row => row.roleName === role || row.ipmRoleCode === role)
    ?? (role === '测试' || role === 'TPM' ? config.find(row => row.id === 'test' || row.roleName === '测试' || row.ipmRoleCode === 'TPM') : undefined)
  // Resolve against this application's snapshot; later configuration changes must not alter its history.
  const roleKey = (role: string) => roleConfig(role)?.id ?? (role === 'TPM' ? '测试' : role)
  const appItems = [...checklistItems, ...(app.projectType === 'tOS版本项目' ? [] : reviewElements)]
    .filter(item => item.applicationId === app.id)

  return app.pipeline.roleProgress.map(rp => {
    const key = roleKey(rp.role)
    const allItems = appItems.filter(item => roleKey(item.responsibleRole) === key)
    const allPassed = allItems.length > 0 && allItems.every(item => item.reviewStatus === 'passed')
    const rejectedItems = allItems.filter(item => item.reviewStatus === 'rejected')
    const person = app.team.maintenance.find(member => roleKey(member.role) === key)
      ?? app.team.maintenance.find(member => member.ipmRoleCode && roleKey(member.ipmRoleCode) === key)
    // Item review remarks take priority over the shared role opinion, as on the source final-review page.
    const notes = [...new Set((rejectedItems.length > 0 ? rejectedItems : allItems)
      .map(item => item.reviewRemark?.trim() || item.reviewComment?.trim())
      .filter((comment): comment is string => Boolean(comment)))]
    return {
      role: roleConfig(rp.role)?.roleName ?? rp.role,
      responsiblePerson: person?.name || '-',
      conclusion: allPassed ? 'PASS' : rejectedItems.length > 0 ? 'Fail' : 'N/A',
      comment: notes.join('\n') || (rejectedItems.length > 0 ? '审核不通过' : allPassed ? '审核通过，资料完整' : 'N/A'),
    }
  })
}

export { PIPELINE_NODES, PIPELINE_KEYS }

// ========== 配置中心版本数据 ==========

export const MOCK_CHECKLIST_VERSIONS: TemplateVersion[] = [{ version: 'v1.0', date: '2026-09-23', itemCount: MOCK_CHECKLIST_TEMPLATES.length, isCurrent: true }]
export const MOCK_CHECKLIST_VERSION_DIFF: VersionDiffItem[] = []
export const MOCK_RE_VERSIONS: TemplateVersion[] = [{ version: 'v1.0', date: '2026-09-23', itemCount: MOCK_REVIEW_ELEMENT_TEMPLATES.length, isCurrent: true }]
export const MOCK_RE_VERSION_DIFF: VersionDiffItem[] = []
