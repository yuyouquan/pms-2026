// 转维流程演示数据：人员、项目、材料及评审内容均为虚构样本。

// ========== 枚举类型 ==========

export type PipelineNodeStatus = 'not_started' | 'in_progress' | 'success' | 'failed'
export type RoleNodeStatus = 'not_started' | 'in_progress' | 'completed' | 'rejected'
export type EntryStatus = 'not_entered' | 'draft' | 'entered'
export type AICheckStatus = 'not_started' | 'in_progress' | 'passed' | 'failed'
export type ReviewStatus = 'not_reviewed' | 'reviewing' | 'passed' | 'rejected'
export type PipelineStatus = 'in_progress' | 'completed' | 'cancelled'
export type RoleType = 'SPM' | 'TPM' | 'SQA' | '底软' | '系统' | '影像'
export type PipelineRole = 'SPM' | '测试' | '底软' | '系统' | '影像'

// ========== 核心接口 ==========

export interface TMTeamMember {
  id: string
  name: string
  role: RoleType
  department: string
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
  sqaReview: PipelineNodeStatus
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
  seq: number
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
  delegatedTo?: string
}

export interface ReviewElement {
  id: string
  applicationId: string
  seq: number
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
  delegatedTo?: string
}

export interface BlockTask {
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
  id: number
  type: string
  checkItem: string
  responsibleRole: string
  entryRole: string
  reviewRole: string
  aiCheckRule: string
}

export interface ReviewElementTemplate {
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

// ========== 用户列表（15人） ==========

export const MOCK_TM_USERS: TMTeamMember[] = [
  { id: 'u001', name: '演示用户01', role: 'SPM', department: '示例项目组' },
  { id: 'u002', name: '演示用户02', role: 'SPM', department: '示例项目组' },
  { id: 'u003', name: '演示用户03', role: 'SPM', department: '示例项目组' },
  { id: 'u004', name: '演示用户04', role: 'TPM', department: '示例测试组' },
  { id: 'u005', name: '演示用户05', role: 'TPM', department: '示例测试组' },
  { id: 'u006', name: '演示用户06', role: 'TPM', department: '示例测试组' },
  { id: 'u007', name: '演示用户07', role: 'SQA', department: '示例质量组' },
  { id: 'u008', name: '演示用户08', role: '底软', department: '示例底软组' },
  { id: 'u009', name: '演示外协01', role: '底软', department: '示例底软组' },
  { id: 'u010', name: '演示外协02', role: '底软', department: '示例底软组' },
  { id: 'u011', name: '演示外协03', role: '系统', department: '示例系统组' },
  { id: 'u012', name: '演示外协04', role: '系统', department: '示例系统组' },
  { id: 'u013', name: '演示外协05', role: '系统', department: '示例系统组' },
  { id: 'u014', name: '演示外协06', role: '影像', department: '示例影像组' },
  { id: 'u015', name: '演示外协07', role: '影像', department: '示例影像组' },
]

// ========== 项目团队 ==========

const TEAM_1: ProjectTeam = {
  research: [
    MOCK_TM_USERS[0],  // 演示用户01 SPM
    MOCK_TM_USERS[3],  // 演示用户04 TPM
    MOCK_TM_USERS[7],  // 演示用户08 底软
    MOCK_TM_USERS[10], // 演示外协03 系统
    MOCK_TM_USERS[13], // 演示外协06 影像
    MOCK_TM_USERS[6],  // 演示用户07 SQA
  ],
  maintenance: [
    MOCK_TM_USERS[1],  // 演示用户02 SPM
    MOCK_TM_USERS[4],  // 演示用户05 TPM
    MOCK_TM_USERS[8],  // 演示外协01 底软
    MOCK_TM_USERS[11], // 演示外协04 系统
    MOCK_TM_USERS[14], // 演示外协07 影像
  ],
}

const TEAM_2: ProjectTeam = {
  research: [
    MOCK_TM_USERS[2],  // 演示用户03 SPM
    MOCK_TM_USERS[5],  // 演示用户06 TPM
    MOCK_TM_USERS[9],  // 演示外协02 底软
    MOCK_TM_USERS[12], // 演示外协05 系统
    MOCK_TM_USERS[14], // 演示外协07 影像
    MOCK_TM_USERS[6],  // 演示用户07 SQA
  ],
  maintenance: [
    MOCK_TM_USERS[0],  // 演示用户01 SPM
    MOCK_TM_USERS[3],  // 演示用户04 TPM
    MOCK_TM_USERS[7],  // 演示用户08 底软
    MOCK_TM_USERS[10], // 演示外协03 系统
    MOCK_TM_USERS[13], // 演示外协06 影像
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
      sqaReview: 'not_started',
      infoChange: 'not_started',
      roleProgress: [
        { role: 'SPM', entryStatus: 'completed', reviewStatus: 'not_started' },
        { role: '测试', entryStatus: 'in_progress', reviewStatus: 'not_started' },
        { role: '底软', entryStatus: 'completed', reviewStatus: 'not_started' },
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
      sqaReview: 'not_started',
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
      sqaReview: 'success',
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
      sqaReview: 'not_started',
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
]

// ========== Pipeline 节点名 ==========
const PIPELINE_NODES = ['项目发起', '资料录入', '维护审核', 'SQA审核', '信息变更']
const PIPELINE_KEYS: (keyof Omit<PipelineState, 'roleProgress'>)[] = ['projectInit', 'dataEntry', 'maintenanceReview', 'sqaReview', 'infoChange']

// ========== CheckList 条目（基于 ta001） ==========

const CL_ROLES: PipelineRole[] = ['SPM', '测试', '底软', '系统']
const CL_TYPES = ['检查项', '交接资料']

function generateChecklistItems(appId: string): CheckListItem[] {
  const items: CheckListItem[] = []
  let seq = 1
  const team = TEAM_1

  const templateItems: { type: string; checkItem: string; role: PipelineRole; aiRule: string }[] = [
    // SPM (25 items)
    { type: '检查项', checkItem: '项目信息与版本记录核对', role: 'SPM', aiRule: '演示检查：填写项目信息与版本记录核对的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '升级空间规划说明', role: 'SPM', aiRule: '演示检查：填写升级空间规划说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '项目计划归档确认', role: 'SPM', aiRule: '演示检查：填写项目计划归档确认的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '市场配置与归档包核对', role: 'SPM', aiRule: '演示检查：填写市场配置与归档包核对的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '编译参数与任务入口确认', role: 'SPM', aiRule: '演示检查：填写编译参数与任务入口确认的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '项目交接资料目录', role: 'SPM', aiRule: '演示检查：资料目录按项目说明、配置记录、验证报告和待跟进事项整理。录入人填写每类材料的摘要及演示附件名称，接收人逐项记录已收到、待补充或不适用；如同一附件覆盖多项内容，补充对应章节，方便在交接页面定位。样本仅用于演示材料录入、长文本阅读、退回补充及再次提交的过程。' },
    { type: '检查项', checkItem: '客制化需求记录', role: 'SPM', aiRule: '演示检查：填写客制化需求记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: 'OTA升级路径说明', role: 'SPM', aiRule: '演示检查：填写OTA升级路径说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '市场版本推送记录', role: 'SPM', aiRule: '演示检查：填写市场版本推送记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '市场版本维护安排', role: 'SPM', aiRule: '演示检查：填写市场版本维护安排的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '基础版本归档说明', role: 'SPM', aiRule: '演示检查：填写基础版本归档说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '多供器件配置清单', role: 'SPM', aiRule: '演示检查：填写多供器件配置清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '版本开放记录', role: 'SPM', aiRule: '演示检查：填写版本开放记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '待跟进问题清单', role: 'SPM', aiRule: '演示检查：填写待跟进问题清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '用户反馈任务分解', role: 'SPM', aiRule: '演示检查：填写用户反馈任务分解的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '产品定义说明', role: 'SPM', aiRule: '演示检查：填写产品定义说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '风险评估说明', role: 'SPM', aiRule: '演示检查：填写风险评估说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '软件需求概览', role: 'SPM', aiRule: '演示检查：填写软件需求概览的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '需求分解清单', role: 'SPM', aiRule: '演示检查：填写需求分解清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '项目状态记录', role: 'SPM', aiRule: '演示检查：填写项目状态记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '目标市场清单', role: 'SPM', aiRule: '演示检查：填写目标市场清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '关键器件说明', role: 'SPM', aiRule: '演示检查：填写关键器件说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '多供导入安排', role: 'SPM', aiRule: '演示检查：填写多供导入安排的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '板级配置说明', role: 'SPM', aiRule: '演示检查：填写板级配置说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '产品规格说明', role: 'SPM', aiRule: '演示检查：填写产品规格说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    // 测试 (11 items)
    { type: '检查项', checkItem: 'OTA升级路径说明', role: '测试', aiRule: '演示检查：填写OTA升级路径说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '市场版本推送记录', role: '测试', aiRule: '演示检查：填写市场版本推送记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '流畅性专项验证报告', role: '测试', aiRule: '演示检查：填写流畅性专项验证报告的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '功耗与硬件验证资料', role: '测试', aiRule: '演示检查：填写功耗与硬件验证资料的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '样机交接清单', role: '测试', aiRule: '演示检查：填写样机交接清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '产品说明与认证资料', role: '测试', aiRule: '演示检查：填写产品说明与认证资料的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '硬件交接资料清单', role: '测试', aiRule: '演示检查：填写硬件交接资料清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '软硬件报告归档说明', role: '测试', aiRule: '演示检查：填写软硬件报告归档说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '功耗续航验证数据', role: '测试', aiRule: '演示检查：填写功耗续航验证数据的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '硬件验证报告', role: '测试', aiRule: '演示检查：填写硬件验证报告的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '性能验证报告', role: '测试', aiRule: '演示检查：填写性能验证报告的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    // 底软 (11 items)
    { type: '交接资料', checkItem: '散热与温升方案说明', role: '底软', aiRule: '演示检查：填写验证场景、采用方案和观察结论，并说明接收人需要关注的事项。若材料仍在整理，可保存草稿并列出待补充内容；再次提交时说明本次补充了哪些材料，让接收人能够对照前次意见完成复核。' },
    { type: '交接资料', checkItem: '样机交接清单', role: '底软', aiRule: '演示检查：填写样机交接清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '功耗评估报告', role: '底软', aiRule: '演示检查：填写功耗评估报告的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '温升方案检查记录', role: '底软', aiRule: '演示检查：填写温升方案检查记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '启动前风险记录', role: '底软', aiRule: '演示检查：填写启动前风险记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '基础接口检查记录', role: '底软', aiRule: '演示检查：填写基础接口检查记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '通信接口检查记录', role: '底软', aiRule: '演示检查：填写通信接口检查记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '产品配置检查记录', role: '底软', aiRule: '演示检查：填写产品配置检查记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '驱动交接记录', role: '底软', aiRule: '演示检查：填写驱动交接记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '功耗差异说明', role: '底软', aiRule: '演示检查：填写功耗差异说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '下一版本重点验证说明', role: '底软', aiRule: '演示检查：填写下一版本重点验证说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    // 系统 (5 items)
    { type: '交接资料', checkItem: '性能模型验证概览', role: '系统', aiRule: '演示检查：填写性能模型验证概览的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '动态模型对比记录', role: '系统', aiRule: '演示检查：填写动态模型对比记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '样机交接清单', role: '系统', aiRule: '演示检查：填写样机交接清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '交接资料', checkItem: '性能差异分析', role: '系统', aiRule: '演示检查：填写性能差异分析的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
    { type: '检查项', checkItem: '下一版本重点验证说明', role: '系统', aiRule: '演示检查：填写下一版本重点验证说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  ]

  const getEntryPerson = (role: PipelineRole) => {
    const m = team.research.find(t => {
      if (role === 'SPM') return t.role === 'SPM'
      if (role === '测试') return t.role === 'TPM'
      return t.role === role
    })
    return m || team.research[0]
  }
  const getReviewPerson = (role: PipelineRole) => {
    const m = team.maintenance.find(t => {
      if (role === 'SPM') return t.role === 'SPM'
      if (role === '测试') return t.role === 'TPM'
      return t.role === role
    })
    return m || team.maintenance[0]
  }

  for (const t of templateItems) {
    const entry = getEntryPerson(t.role)
    const reviewer = getReviewPerson(t.role)
    // Determine status based on role progress in ta001
    let entryStatus: EntryStatus = 'not_entered'
    let aiCheckStatus: AICheckStatus = 'not_started'
    let reviewStatus: ReviewStatus = 'not_reviewed'
    let entryContent: string | undefined
    let aiCheckResult: string | undefined

    if (t.role === 'SPM' || t.role === '底软') {
      // completed entry
      entryStatus = 'entered'
      entryContent = `${t.checkItem} — 已完成，详见附件。`
      aiCheckStatus = t.aiRule !== '-' ? 'passed' : 'passed'
    } else if (t.role === '测试' || t.role === '系统') {
      // in_progress: mix of entered and draft
      if (seq % 3 === 0) {
        entryStatus = 'entered'
        entryContent = `${t.checkItem} — 录入完成。`
        aiCheckStatus = t.aiRule !== '-' ? (seq % 5 === 0 ? 'failed' : 'passed') : 'passed'
        if (seq % 5 === 0) aiCheckResult = `AI检查未通过: ${t.aiRule} 演示材料缺少接收意见，请补充后再次提交`
      } else if (seq % 3 === 1) {
        entryStatus = 'draft'
        entryContent = `${t.checkItem} — 草稿中...`
      }
    }
    // 影像 role stays not_entered

    items.push({
      id: `cl_${appId}_${String(seq).padStart(3, '0')}`,
      applicationId: appId,
      seq,
      type: t.type,
      checkItem: t.checkItem,
      responsibleRole: t.role,
      entryPerson: entry.name,
      entryPersonId: entry.id,
      reviewPerson: reviewer.name,
      reviewPersonId: reviewer.id,
      aiCheckRule: t.aiRule,
      deliverables: seq % 4 === 0 ? [{ id: `d_${seq}`, name: `${t.checkItem}_报告.pdf`, url: '#', type: 'file' }] : [],
      entryContent,
      entryStatus,
      aiCheckStatus,
      aiCheckResult,
      reviewStatus,
    })
    seq++
  }
  return items
}

export const MOCK_CHECKLIST_ITEMS: CheckListItem[] = generateChecklistItems('ta001')

// ========== 评审要素（基于 ta001） ==========

function generateReviewElements(appId: string): ReviewElement[] {
  const items: ReviewElement[] = []
  const team = TEAM_1

  const templateElements: { standard: string; desc: string; remark: string; role: PipelineRole; aiRule: string }[] = [
    // SPM (5 items)
    { standard: '问题清单与跟进安排', desc: '演示评审汇总已完成事项、待跟进事项和接收人的确认意见。样本场景包含一项等待补充说明的问题：先由录入人补齐现象、影响范围和建议安排，再由接收人核对材料是否对应本次交接。需要继续处理的事项保留负责人及下一步说明，审核人在备注中记录判断依据，后续可从历史记录查看补充、退回和重新提交的过程。', remark: '演示场景：用于查看较长评审说明的完整展示。', role: 'SPM', aiRule: '演示评审：核对问题清单与跟进安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '预警事项交接确认', desc: '演示材料列出预警事项及处理状态，由接收人确认后续跟进安排。', remark: '', role: 'SPM', aiRule: '演示评审：核对预警事项交接确认的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '共性事项处理记录', desc: '演示材料说明共性事项的适用范围、处理记录和接收意见。', remark: '', role: 'SPM', aiRule: '演示评审：核对共性事项处理记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '外部反馈跟进安排', desc: '演示反馈按已处理和待跟进分类，并为待跟进事项指定接收人。', remark: '', role: 'SPM', aiRule: '演示评审：核对外部反馈跟进安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '需求与配置导入安排', desc: '演示材料列出需求、配置和功能的交接状态，待完成事项记录下一步安排。', remark: '', role: 'SPM', aiRule: '演示评审：核对需求与配置导入安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    // 底软 (5 items)
    { standard: '稳定性验证记录', desc: '演示记录描述稳定性验证场景、观察结果与待补充材料。', remark: '', role: '底软', aiRule: '演示评审：核对稳定性验证记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '用户反馈改进记录', desc: '演示反馈已整理为改进事项，记录处理方式和计划验证内容。', remark: '', role: '底软', aiRule: '演示评审：核对用户反馈改进记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '质量观察与改进安排', desc: '演示材料包含质量观察、原因说明和下一步改进安排。', remark: '待跟进事项由对应演示成员继续补充。', role: '底软', aiRule: '演示评审：核对质量观察与改进安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '性能观察记录', desc: '演示记录列出性能验证场景和观察结论；有差异时补充说明及跟进安排。', remark: '', role: '底软', aiRule: '演示评审：核对性能观察记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '能耗观察记录', desc: '演示记录说明使用场景、能耗观察和后续验证安排。', remark: '', role: '底软', aiRule: '演示评审：核对能耗观察记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    // 系统 (5 items)
    { standard: '稳定性验证记录', desc: '演示记录描述稳定性验证场景、观察结果与待补充材料。', remark: '', role: '系统', aiRule: '演示评审：核对稳定性验证记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '用户反馈改进记录', desc: '演示反馈已整理为改进事项，记录处理方式和计划验证内容。', remark: '', role: '系统', aiRule: '演示评审：核对用户反馈改进记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '质量观察与改进安排', desc: '演示材料包含质量观察、原因说明和下一步改进安排。', remark: '待跟进事项由对应演示成员继续补充。', role: '系统', aiRule: '演示评审：核对质量观察与改进安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '性能观察记录', desc: '演示记录列出性能验证场景和观察结论；有差异时补充说明及跟进安排。', remark: '', role: '系统', aiRule: '演示评审：核对性能观察记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
    { standard: '能耗观察记录', desc: '演示记录说明使用场景、能耗观察和后续验证安排。', remark: '', role: '系统', aiRule: '演示评审：核对能耗观察记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  ]

  const getEntry = (role: PipelineRole) => {
    const m = team.research.find(t => { if (role === 'SPM') return t.role === 'SPM'; if (role === '测试') return t.role === 'TPM'; return t.role === role })
    return m || team.research[0]
  }
  const getReview = (role: PipelineRole) => {
    const m = team.maintenance.find(t => { if (role === 'SPM') return t.role === 'SPM'; if (role === '测试') return t.role === 'TPM'; return t.role === role })
    return m || team.maintenance[0]
  }

  templateElements.forEach((t, i) => {
    const entry = getEntry(t.role)
    const reviewer = getReview(t.role)
    let entryStatus: EntryStatus = 'not_entered'
    let aiCheckStatus: AICheckStatus = 'not_started'
    let entryContent: string | undefined

    if (t.role === 'SPM' || t.role === '底软') {
      entryStatus = 'entered'
      entryContent = `${t.desc} — 已确认达标。`
      aiCheckStatus = 'passed'
    } else if (t.role === '测试' || t.role === '系统') {
      if (i % 2 === 0) {
        entryStatus = 'entered'
        entryContent = `${t.desc} — 已完成录入。`
        aiCheckStatus = 'passed'
      } else {
        entryStatus = 'draft'
        entryContent = `${t.desc} — 草稿...`
      }
    }

    items.push({
      id: `re_${appId}_${String(i + 1).padStart(3, '0')}`,
      applicationId: appId,
      seq: i + 1,
      standard: t.standard,
      description: t.desc,
      remark: t.remark,
      responsibleRole: t.role,
      entryPerson: entry.name,
      entryPersonId: entry.id,
      reviewPerson: reviewer.name,
      reviewPersonId: reviewer.id,
      aiCheckRule: t.aiRule,
      deliverables: i % 3 === 0 ? [{ id: `rd_${i}`, name: `${t.standard}_评审报告.pdf`, url: '#', type: 'file' }] : [],
      entryContent,
      entryStatus,
      aiCheckStatus,
      reviewStatus: 'not_reviewed',
    })
  })
  return items
}

export const MOCK_REVIEW_ELEMENTS: ReviewElement[] = generateReviewElements('ta001')

// ========== Block 任务 ==========

export const MOCK_BLOCK_TASKS: BlockTask[] = [
  {
    id: 'bt001', applicationId: 'ta002', description: '系统模块接口文档版本不一致，Swagger文档未同步更新',
    resolution: '需系统组更新Swagger文档并重新生成接口说明', responsiblePerson: '演示外协05', department: '示例系统组',
    deadline: '2026-03-28', status: 'open', createdAt: '2026-03-20 10:30:00',
  },
  {
    id: 'bt002', applicationId: 'ta002', description: '底软驱动兼容性测试在特定机型上失败',
    resolution: '底软组排查驱动兼容问题，已定位到LCD驱动初始化时序', responsiblePerson: '演示外协02', department: '示例底软组',
    deadline: '2026-03-25', status: 'resolved', createdAt: '2026-03-18 14:00:00',
  },
  {
    id: 'bt003', applicationId: 'ta002', description: 'SQA审核发现性能测试报告缺少压力测试场景',
    resolution: '测试组补充压力测试场景并重新出具报告', responsiblePerson: '演示用户06', department: '示例测试组',
    deadline: '2026-03-30', status: 'open', createdAt: '2026-03-22 09:15:00',
  },
]

// ========== 遗留任务 ==========

export const MOCK_LEGACY_TASKS: LegacyTask[] = [
  {
    id: 'lt001', applicationId: 'ta002', description: '旧版Camera HAL层接口需在MR1版本中迁移至新框架',
    responsiblePerson: '演示外协06', department: '示例影像组', deadline: '2026-06-30', status: 'open', createdAt: '2026-03-20 11:00:00',
  },
  {
    id: 'lt002', applicationId: 'ta002', description: '底软电源管理模块历史遗留的唤醒延迟问题需后续优化',
    responsiblePerson: '演示用户08', department: '示例底软组', deadline: '2026-07-15', status: 'open', createdAt: '2026-03-21 16:30:00',
  },
]

// ========== 历史记录 ==========

export const MOCK_HISTORY: HistoryRecord[] = [
  { id: 'h001', applicationId: 'ta001', action: '创建', operator: '演示用户01', detail: '创建转维申请，计划评审日期: 2026-04-15', timestamp: '2026-03-15 09:30:00' },
  { id: 'h002', applicationId: 'ta001', action: '录入', operator: '演示用户01', detail: 'SPM角色完成全部12项CheckList录入', timestamp: '2026-03-16 14:20:00' },
  { id: 'h003', applicationId: 'ta001', action: '录入', operator: '演示用户08', detail: '底软角色完成全部12项CheckList录入', timestamp: '2026-03-18 17:00:00' },
  { id: 'h004', applicationId: 'ta001', action: '录入', operator: '演示用户04', detail: '测试角色开始录入CheckList', timestamp: '2026-03-19 09:00:00' },
  { id: 'h005', applicationId: 'ta001', action: '录入', operator: '演示外协03', detail: '系统角色开始录入CheckList，已完成4项', timestamp: '2026-03-20 10:30:00' },
  { id: 'h006', applicationId: 'ta001', action: 'AI检查', operator: '系统', detail: 'AI智能检查发现2项不通过: 监控平台CPU指标、内存使用率偏高', timestamp: '2026-03-20 10:35:00' },
  { id: 'h007', applicationId: 'ta002', action: '创建', operator: '演示用户03', detail: '创建转维申请，计划评审日期: 2026-05-01', timestamp: '2026-02-20 10:00:00' },
  { id: 'h008', applicationId: 'ta002', action: '录入完成', operator: '系统', detail: '全部角色完成资料录入，流水线进入维护审核阶段', timestamp: '2026-03-10 16:00:00' },
  { id: 'h009', applicationId: 'ta002', action: '通过', operator: '演示用户05', detail: '测试角色维护审核通过', timestamp: '2026-03-15 11:00:00' },
  { id: 'h010', applicationId: 'ta002', action: '通过', operator: '演示外协07', detail: '影像角色维护审核通过', timestamp: '2026-03-16 14:30:00' },
  { id: 'h011', applicationId: 'ta002', action: '不通过', operator: '演示外协03', detail: '系统角色维护审核不通过: 接口文档版本不一致', timestamp: '2026-03-18 09:20:00' },
  { id: 'h012', applicationId: 'ta003', action: '创建', operator: '演示用户01', detail: '创建转维申请', timestamp: '2026-01-10 08:00:00' },
  { id: 'h013', applicationId: 'ta003', action: '通过', operator: '演示用户07', detail: 'SQA审核通过，转维流程完成', timestamp: '2026-03-01 17:30:00' },
  { id: 'h014', applicationId: 'ta004', action: '创建', operator: '演示用户02', detail: '创建转维申请', timestamp: '2026-03-05 11:00:00' },
  { id: 'h015', applicationId: 'ta004', action: '关闭', operator: '演示用户02', detail: '项目延期，取消转维计划', timestamp: '2026-03-18 09:15:00' },
]

// ========== 配置中心模板（保留原有） ==========

export const MOCK_CHECKLIST_TEMPLATES: CheckListTemplate[] = [
  { id: 1, type: '检查项', checkItem: '项目信息与版本记录核对', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写项目信息与版本记录核对的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 2, type: '检查项', checkItem: '升级空间规划说明', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写升级空间规划说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 3, type: '检查项', checkItem: '项目计划归档确认', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写项目计划归档确认的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 4, type: '检查项', checkItem: '市场配置与归档包核对', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写市场配置与归档包核对的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 5, type: '检查项', checkItem: '编译参数与任务入口确认', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写编译参数与任务入口确认的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 6, type: '检查项', checkItem: '项目交接资料目录', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：资料目录按项目说明、配置记录、验证报告和待跟进事项整理。录入人填写每类材料的摘要及演示附件名称，接收人逐项记录已收到、待补充或不适用；如同一附件覆盖多项内容，补充对应章节，方便在交接页面定位。样本仅用于演示材料录入、长文本阅读、退回补充及再次提交的过程。' },
  { id: 7, type: '检查项', checkItem: '客制化需求记录', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写客制化需求记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 8, type: '检查项', checkItem: 'OTA升级路径说明', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写OTA升级路径说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 9, type: '检查项', checkItem: 'OTA升级路径说明', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写OTA升级路径说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 10, type: '检查项', checkItem: '市场版本推送记录', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写市场版本推送记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 11, type: '检查项', checkItem: '市场版本推送记录', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写市场版本推送记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 12, type: '交接资料', checkItem: '散热与温升方案说明', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写验证场景、采用方案和观察结论，并说明接收人需要关注的事项。若材料仍在整理，可保存草稿并列出待补充内容；再次提交时说明本次补充了哪些材料，让接收人能够对照前次意见完成复核。' },
  { id: 13, type: '交接资料', checkItem: '性能模型验证概览', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示检查：填写性能模型验证概览的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 14, type: '交接资料', checkItem: '动态模型对比记录', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示检查：填写动态模型对比记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 15, type: '交接资料', checkItem: '流畅性专项验证报告', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写流畅性专项验证报告的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 16, type: '交接资料', checkItem: '功耗与硬件验证资料', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写功耗与硬件验证资料的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 17, type: '交接资料', checkItem: '市场版本维护安排', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写市场版本维护安排的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 18, type: '交接资料', checkItem: '基础版本归档说明', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写基础版本归档说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 19, type: '交接资料', checkItem: '样机交接清单', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写样机交接清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 20, type: '交接资料', checkItem: '样机交接清单', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写样机交接清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 21, type: '交接资料', checkItem: '样机交接清单', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示检查：填写样机交接清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 22, type: '交接资料', checkItem: '产品说明与认证资料', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写产品说明与认证资料的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 23, type: '交接资料', checkItem: '硬件交接资料清单', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写硬件交接资料清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 24, type: '交接资料', checkItem: '多供器件配置清单', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写多供器件配置清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 25, type: '交接资料', checkItem: '版本开放记录', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写版本开放记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 26, type: '交接资料', checkItem: '待跟进问题清单', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写待跟进问题清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 27, type: '交接资料', checkItem: '用户反馈任务分解', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写用户反馈任务分解的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 28, type: '交接资料', checkItem: '产品定义说明', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写产品定义说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 29, type: '交接资料', checkItem: '风险评估说明', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写风险评估说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 30, type: '交接资料', checkItem: '软件需求概览', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写软件需求概览的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 31, type: '交接资料', checkItem: '需求分解清单', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写需求分解清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 32, type: '交接资料', checkItem: '项目状态记录', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写项目状态记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 33, type: '交接资料', checkItem: '目标市场清单', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写目标市场清单的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 34, type: '交接资料', checkItem: '关键器件说明', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写关键器件说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 35, type: '交接资料', checkItem: '多供导入安排', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写多供导入安排的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 36, type: '交接资料', checkItem: '板级配置说明', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写板级配置说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 37, type: '交接资料', checkItem: '产品规格说明', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示检查：填写产品规格说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 38, type: '交接资料', checkItem: '功耗评估报告', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写功耗评估报告的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 39, type: '交接资料', checkItem: '温升方案检查记录', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写温升方案检查记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 40, type: '交接资料', checkItem: '启动前风险记录', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写启动前风险记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 41, type: '交接资料', checkItem: '基础接口检查记录', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写基础接口检查记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 42, type: '交接资料', checkItem: '通信接口检查记录', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写通信接口检查记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 43, type: '交接资料', checkItem: '产品配置检查记录', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写产品配置检查记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 44, type: '交接资料', checkItem: '驱动交接记录', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写驱动交接记录的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 45, type: '交接资料', checkItem: '功耗差异说明', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写功耗差异说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 46, type: '交接资料', checkItem: '性能差异分析', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示检查：填写性能差异分析的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 47, type: '交接资料', checkItem: '软硬件报告归档说明', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写软硬件报告归档说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 48, type: '交接资料', checkItem: '功耗续航验证数据', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写功耗续航验证数据的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 49, type: '交接资料', checkItem: '硬件验证报告', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写硬件验证报告的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 50, type: '交接资料', checkItem: '性能验证报告', responsibleRole: '测试', entryRole: '在研TPM', reviewRole: '维护TPM', aiCheckRule: '演示检查：填写性能验证报告的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 51, type: '检查项', checkItem: '下一版本重点验证说明', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示检查：填写下一版本重点验证说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },
  { id: 52, type: '检查项', checkItem: '下一版本重点验证说明', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示检查：填写下一版本重点验证说明的材料摘要、当前状态和接收意见；待补充事项写明下一步安排。' },

]

export const MOCK_REVIEW_ELEMENT_TEMPLATES: ReviewElementTemplate[] = [
  { id: 1, standard: '问题清单与跟进安排', description: '演示评审汇总已完成事项、待跟进事项和接收人的确认意见。样本场景包含一项等待补充说明的问题：先由录入人补齐现象、影响范围和建议安排，再由接收人核对材料是否对应本次交接。需要继续处理的事项保留负责人及下一步说明，审核人在备注中记录判断依据，后续可从历史记录查看补充、退回和重新提交的过程。', remark: '演示场景：用于查看较长评审说明的完整展示。', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示评审：核对问题清单与跟进安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 2, standard: '预警事项交接确认', description: '演示材料列出预警事项及处理状态，由接收人确认后续跟进安排。', remark: '', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示评审：核对预警事项交接确认的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 3, standard: '共性事项处理记录', description: '演示材料说明共性事项的适用范围、处理记录和接收意见。', remark: '', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示评审：核对共性事项处理记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 4, standard: '外部反馈跟进安排', description: '演示反馈按已处理和待跟进分类，并为待跟进事项指定接收人。', remark: '', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示评审：核对外部反馈跟进安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 5, standard: '稳定性验证记录', description: '演示记录描述稳定性验证场景、观察结果与待补充材料。', remark: '', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示评审：核对稳定性验证记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 6, standard: '稳定性验证记录', description: '演示记录描述稳定性验证场景、观察结果与待补充材料。', remark: '', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示评审：核对稳定性验证记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 7, standard: '用户反馈改进记录', description: '演示反馈已整理为改进事项，记录处理方式和计划验证内容。', remark: '', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示评审：核对用户反馈改进记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 8, standard: '用户反馈改进记录', description: '演示反馈已整理为改进事项，记录处理方式和计划验证内容。', remark: '', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示评审：核对用户反馈改进记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 9, standard: '质量观察与改进安排', description: '演示材料包含质量观察、原因说明和下一步改进安排。', remark: '待跟进事项由对应演示成员继续补充。', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示评审：核对质量观察与改进安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 10, standard: '质量观察与改进安排', description: '演示材料包含质量观察、原因说明和下一步改进安排。', remark: '待跟进事项由对应演示成员继续补充。', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示评审：核对质量观察与改进安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 11, standard: '性能观察记录', description: '演示记录列出性能验证场景和观察结论；有差异时补充说明及跟进安排。', remark: '', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示评审：核对性能观察记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 12, standard: '性能观察记录', description: '演示记录列出性能验证场景和观察结论；有差异时补充说明及跟进安排。', remark: '', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示评审：核对性能观察记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 13, standard: '能耗观察记录', description: '演示记录说明使用场景、能耗观察和后续验证安排。', remark: '', responsibleRole: '底软', entryRole: '在研底软集成开发代表', reviewRole: '维护底软集成开发代表', aiCheckRule: '演示评审：核对能耗观察记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 14, standard: '能耗观察记录', description: '演示记录说明使用场景、能耗观察和后续验证安排。', remark: '', responsibleRole: '系统', entryRole: '在研系统集成开发代表', reviewRole: '维护系统集成开发代表', aiCheckRule: '演示评审：核对能耗观察记录的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },
  { id: 15, standard: '需求与配置导入安排', description: '演示材料列出需求、配置和功能的交接状态，待完成事项记录下一步安排。', remark: '', responsibleRole: 'SPM', entryRole: '在研SPM', reviewRole: '维护SPM', aiCheckRule: '演示评审：核对需求与配置导入安排的材料摘要、当前结论和接收意见；需要补充时记录原因，不适用时说明依据。' },

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
  const appCl = checklistItems.filter(c => c.applicationId === app.id)
  const appRe = reviewElements.filter(r => r.applicationId === app.id)

  return app.pipeline.roleProgress.map(rp => {
    const roleCl = appCl.filter(c => c.responsibleRole === rp.role)
    const roleRe = appRe.filter(r => r.responsibleRole === rp.role)
    const allItems = [...roleCl, ...roleRe]
    const allPassed = allItems.every(item => item.reviewStatus === 'passed')
    const anyFailed = allItems.some(item => item.reviewStatus === 'rejected')
    const team = app.team.maintenance
    const person = team.find(m => {
      if (rp.role === 'SPM') return m.role === 'SPM'
      if (rp.role === '测试') return m.role === 'TPM'
      return m.role === rp.role
    })
    return {
      role: rp.role,
      responsiblePerson: person?.name || '-',
      conclusion: allItems.length === 0 ? 'N/A' : allPassed ? 'PASS' : anyFailed ? 'Fail' : 'N/A',
      comment: '',
    }
  })
}

export { PIPELINE_NODES, PIPELINE_KEYS }

// ========== 配置中心版本数据 ==========

export const MOCK_CHECKLIST_VERSIONS: TemplateVersion[] = [
  { version: 'v3.0', date: '2026-03-10', itemCount: 52, isCurrent: true },
  { version: 'v2.0', date: '2026-02-15', itemCount: 48, isCurrent: false },
  { version: 'v1.0', date: '2026-01-20', itemCount: 45, isCurrent: false },
]

export const MOCK_CHECKLIST_VERSION_DIFF: VersionDiffItem[] = [
  { checkItem: '项目风险清单确认', status: '新增' },
  { checkItem: '客户反馈问题清单已交接', status: '新增' },
  { checkItem: '版本分支管理策略确认', status: '新增' },
  { checkItem: '知识库文档归档确认', status: '新增' },
  { checkItem: '自动化测试用例交接确认', status: '新增' },
  { checkItem: '编译参数与任务入口确认', status: '修改' },
  { checkItem: 'OTA升级路径说明', status: '修改' },
  { checkItem: '旧版测试环境说明', status: '删除' },
]

export const MOCK_RE_VERSIONS: TemplateVersion[] = [
  { version: 'v3.0', date: '2026-03-10', itemCount: 15, isCurrent: true },
  { version: 'v2.0', date: '2026-02-15', itemCount: 12, isCurrent: false },
  { version: 'v1.0', date: '2026-01-20', itemCount: 10, isCurrent: false },
]

export const MOCK_RE_VERSION_DIFF: VersionDiffItem[] = [
  { description: '确认安全启动链路完整', status: '新增' },
  { description: '确认底软已知问题清单已完整交接', status: '新增' },
  { description: '确认系统兼容性问题已记录', status: '新增' },
  { description: '确认项目关键文档已归档到指定服务器', status: '修改' },
  { description: '确认OTA版本链路完整，无断链', status: '修改' },
  { description: '旧版驱动交接要求', status: '删除' },
]
