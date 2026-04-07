'use client'

import { Fragment } from 'react'
import {
  Card,
  Table,
  Button,
  Progress,
  Tag,
  Space,
  Row,
  Col,
  message,
  Select,
  Input,
  Tooltip,
  Modal,
  Form,
  Avatar,
  Empty,
  Alert,
  Statistic,
  Descriptions,
  Breadcrumb,
  Segmented,
  Timeline,
  Tabs,
} from 'antd'
import {
  PlusOutlined,
  FileTextOutlined,
  EditOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SwapOutlined,
  AuditOutlined,
  DiffOutlined,
  UploadOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  SafetyOutlined,
  RocketOutlined,
  FileProtectOutlined,
  LinkOutlined,
  FolderOpenOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import {
  MOCK_TM_USERS,
  MOCK_HISTORY,
  MOCK_CHECKLIST_TEMPLATES,
  MOCK_REVIEW_ELEMENT_TEMPLATES,
  MOCK_CHECKLIST_VERSIONS,
  MOCK_CHECKLIST_VERSION_DIFF,
  MOCK_RE_VERSIONS,
  MOCK_RE_VERSION_DIFF,
  ROLE_COLORS,
  getCurrentNodeIndex,
  getCurrentNodeLabel,
  getCurrentNodeStatus,
  getPipelinePercent,
  buildCloseReviewRows,
  type TransferApplication,
  type CheckListItem,
  type ReviewElement,
  type BlockTask,
  type LegacyTask,
  type PipelineState,
  type PipelineNodeStatus,
  type TMTeamMember,
  type EntryStatus,
  type ReviewStatus,
} from '@/mock/transfer-maintenance'

const { Option } = Select
const { TextArea } = Input

// ========== Status Config Constants ==========
const PIPELINE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'in_progress': { color: 'blue', label: '进行中' },
  'completed': { color: 'green', label: '已完成' },
  'cancelled': { color: 'red', label: '已取消' },
}
const ENTRY_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'not_entered': { color: 'default', label: '未录入' },
  'draft': { color: 'orange', label: '草稿' },
  'entered': { color: 'green', label: '已录入' },
}
const AI_CHECK_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'not_started': { color: 'default', label: '-' },
  'in_progress': { color: 'processing', label: '检查中' },
  'passed': { color: 'success', label: '通过' },
  'failed': { color: 'error', label: '未通过' },
}
const REVIEW_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'not_reviewed': { color: 'default', label: '未审核' },
  'reviewing': { color: 'processing', label: '审核中' },
  'passed': { color: 'success', label: '通过' },
  'rejected': { color: 'error', label: '未通过' },
}
const STATUS_COLORS: Record<string, string> = {
  not_started: '#d9d9d9', in_progress: '#1677ff', success: '#52c41a', failed: '#ff4d4f',
}
const NODE_LABELS = ['项目发起', '资料录入与AI检查', '维护审核', 'SQA审核', '信息变更']
const BLOCK_TASK_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'open': { color: 'red', label: '未解决' }, 'resolved': { color: 'green', label: '已解决' }, 'cancelled': { color: 'default', label: '已取消' },
}
const LEGACY_TASK_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'open': { color: 'orange', label: '待处理' }, 'resolved': { color: 'green', label: '已完成' }, 'cancelled': { color: 'default', label: '已取消' },
}
const NODE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  not_started: { color: 'default', label: '未开始' },
  in_progress: { color: 'processing', label: '进行中' },
  success: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
}

// ========== Helper Components ==========
function PipelineProgress({ pipeline, showRoleDots = true }: { pipeline: PipelineState; showRoleDots?: boolean }) {
  const nodeStatuses: PipelineNodeStatus[] = [
    pipeline.projectInit, pipeline.dataEntry, pipeline.maintenanceReview, pipeline.sqaReview, pipeline.infoChange,
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '20px 0' }}>
      {NODE_LABELS.map((label, index) => {
        const status = nodeStatuses[index]
        const color = STATUS_COLORS[status]
        const isLast = index === NODE_LABELS.length - 1
        const showDots = showRoleDots && (index === 1 || index === 2)
        return (
          <Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
              <div style={{ marginTop: 8, fontSize: 13, color: '#4b5563', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</div>
            </div>
            {!isLast && <div style={{ flex: 1, height: 2, background: '#e5e7eb', alignSelf: 'center', marginTop: -16 }} />}
          </Fragment>
        )
      })}
    </div>
  )
}

function MiniPipeline({ app }: { app: TransferApplication }) {
  const idx = getCurrentNodeIndex(app)
  const label = getCurrentNodeLabel(app)
  const pct = getPipelinePercent(app)
  const nodeStatus = getCurrentNodeStatus(app)
  const strokeColor = nodeStatus === 'success' ? '#52c41a' : nodeStatus === 'failed' ? '#ff4d4f' : '#6366f1'
  const tagConfig = NODE_STATUS_CONFIG[nodeStatus] || NODE_STATUS_CONFIG['not_started']
  if (app.status === 'cancelled') {
    return <Tag color="default" icon={<StopOutlined />}>已关闭</Tag>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
      <Progress percent={pct} size="small" strokeColor={strokeColor} showInfo={false} style={{ flex: 1, margin: 0 }} />
      <Tag color={tagConfig.color} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>{label}</Tag>
    </div>
  )
}

function TeamMemberCard({ member }: { member: TMTeamMember }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f8fafc' }}>
      <Avatar size={28} style={{ background: ROLE_COLORS[member.role] || '#999', fontSize: 12, flexShrink: 0 }}>{member.name.slice(-1)}</Avatar>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{member.role} · {member.department}</div>
      </div>
    </div>
  )
}

function renderEntryContent(record: { entryContent?: string; deliverables?: { id: string; name: string; url: string; type: string }[] }) {
  const content = record.entryContent
  if (!content && (!record.deliverables || record.deliverables.length === 0)) return <span style={{ color: '#999' }}>-</span>
  const segments: { type: string; text: string; url?: string }[] = []
  if (content) {
    const urlRegex = /https?:\/\/[^\s，。、；：！？）》\]]+/g
    const sambaRegex = /\\\\[^\s，。、；：！？）》\]]+/g
    const combined = new RegExp(`(${urlRegex.source})|(${sambaRegex.source})`, 'g')
    let lastIdx = 0; let match
    while ((match = combined.exec(content)) !== null) {
      if (match.index > lastIdx) { const t = content.slice(lastIdx, match.index).trim(); if (t) segments.push({ type: 'text', text: t }) }
      if (match[1]) {
        const isFeishu = /feishu\.(cn|com)/i.test(match[0])
        segments.push({ type: isFeishu ? 'feishu' : 'link', text: match[0], url: match[0] })
      } else if (match[2]) {
        segments.push({ type: 'samba', text: match[0] })
      }
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < content.length) { const t = content.slice(lastIdx).trim(); if (t) segments.push({ type: 'text', text: t }) }
  }
  return (
    <div style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden', fontSize: 12 }}>
      {segments.map((seg, i) => {
        if (seg.type === 'feishu') return <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4338ca', display: 'inline-flex', alignItems: 'center', gap: 2 }}><FileTextOutlined style={{ fontSize: 11 }} />飞书文档</a>
        if (seg.type === 'link') return <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: 2 }}><LinkOutlined style={{ fontSize: 11 }} />{seg.text}</a>
        if (seg.type === 'samba') return <span key={i} style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 2 }}><FolderOpenOutlined style={{ fontSize: 11 }} />{seg.text}</span>
        return <span key={i}>{seg.text} </span>
      })}
      {record.deliverables && record.deliverables.length > 0 && record.deliverables.map(d => (
        <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4338ca', display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4 }}><FileTextOutlined style={{ fontSize: 11 }} />{d.name}</a>
      ))}
    </div>
  )
}

function sortTeamMembers(members: TMTeamMember[]): TMTeamMember[] {
  const order: Record<string, number> = { SPM: 0, TPM: 1, SQA: 2, '底软': 3, '系统': 4, '影像': 5 }
  return [...members].sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99))
}

// ========== Shared Props Interface ==========
export interface TransferModuleProps {
  // Project context
  selectedProject: { id: string; name: string; [key: string]: any } | null
  currentUser: { id: string; name: string; [key: string]: any }

  // Transfer view navigation
  transferView: null | 'apply' | 'detail' | 'entry' | 'review' | 'sqa-review'
  setTransferView: (v: null | 'apply' | 'detail' | 'entry' | 'review' | 'sqa-review') => void

  // Transfer config
  transferConfigView: 'home' | 'checklist' | 'review'
  setTransferConfigView: (v: 'home' | 'checklist' | 'review') => void
  tmConfigSearchText: string
  setTmConfigSearchText: (v: string) => void
  tmConfigSelectedVersion: string
  setTmConfigSelectedVersion: (v: string) => void
  tmConfigDiffOpen: boolean
  setTmConfigDiffOpen: (v: boolean) => void
  tmConfigDiffFrom: string
  setTmConfigDiffFrom: (v: string) => void
  tmConfigDiffTo: string
  setTmConfigDiffTo: (v: string) => void

  // Transfer applications
  selectedTransferAppId: string | null
  setSelectedTransferAppId: (v: string | null) => void
  transferApplications: TransferApplication[]
  setTransferApplications: React.Dispatch<React.SetStateAction<TransferApplication[]>>

  // Checklist & Review data
  tmChecklistItems: CheckListItem[]
  setTmChecklistItems: React.Dispatch<React.SetStateAction<CheckListItem[]>>
  tmReviewElements: ReviewElement[]
  setTmReviewElements: React.Dispatch<React.SetStateAction<ReviewElement[]>>
  tmBlockTasks: BlockTask[]
  tmLegacyTasks: LegacyTask[]

  // Apply form
  tmApplyDate: string
  setTmApplyDate: (v: string) => void
  tmApplyRemark: string
  setTmApplyRemark: (v: string) => void
  tmApplyTeam: { research: TMTeamMember[]; maintenance: TMTeamMember[] }
  setTmApplyTeam: React.Dispatch<React.SetStateAction<{ research: TMTeamMember[]; maintenance: TMTeamMember[] }>>

  // Detail modal
  tmDetailModalVisible: boolean
  setTmDetailModalVisible: (v: boolean) => void
  tmDetailModalTitle: string
  setTmDetailModalTitle: (v: string) => void
  tmDetailModalContent: string
  setTmDetailModalContent: (v: string) => void

  // Close modal
  tmCloseModalVisible: boolean
  setTmCloseModalVisible: (v: boolean) => void
  tmCloseAppId: string | null
  setTmCloseAppId: (v: string | null) => void
  tmCloseReason: string
  setTmCloseReason: (v: string) => void

  // Entry
  tmEntryTab: 'checklist' | 'review'
  setTmEntryTab: (v: 'checklist' | 'review') => void
  tmEntryModalOpen: boolean
  setTmEntryModalOpen: (v: boolean) => void
  tmEntryModalRecord: any
  setTmEntryModalRecord: (v: any) => void
  tmEntryContent: string
  setTmEntryContent: (v: string) => void
  tmEntryActiveRole: string
  setTmEntryActiveRole: (v: string) => void

  // Review
  tmReviewTab: 'checklist' | 'review'
  setTmReviewTab: (v: 'checklist' | 'review') => void
  tmReviewModalOpen: boolean
  setTmReviewModalOpen: (v: boolean) => void
  tmReviewAction: 'pass' | 'reject'
  setTmReviewAction: (v: 'pass' | 'reject') => void
  tmReviewRecord: any
  setTmReviewRecord: (v: any) => void
  tmReviewComment: string
  setTmReviewComment: (v: string) => void
  tmReviewActiveRole: string
  setTmReviewActiveRole: (v: string) => void

  // SQA
  tmSqaComment: string
  setTmSqaComment: (v: string) => void
  tmSqaModalOpen: boolean
  setTmSqaModalOpen: (v: boolean) => void
  tmSqaAction: 'approve' | 'reject'
  setTmSqaAction: (v: 'approve' | 'reject') => void

  // Navigation helper
  setProjectSpaceModule: (v: string) => void
}

// ========== TransferConfig ==========
export function TransferConfig(props: TransferModuleProps) {
  if (props.transferConfigView === 'home') {
    const cards = [
      { key: 'checklist', icon: <FileTextOutlined style={{ fontSize: 28, color: '#4338ca' }} />, title: '转维材料配置', count: MOCK_CHECKLIST_TEMPLATES.length, desc: '管理转维CheckList模板，包括检查项、交接资料等' },
      { key: 'review', icon: <AuditOutlined style={{ fontSize: 28, color: '#4338ca' }} />, title: '评审要素配置', count: MOCK_REVIEW_ELEMENT_TEMPLATES.length, desc: '管理评审要素模板，包括各角色评审标准' },
    ]
    return (
      <div>
        <Breadcrumb items={[{ title: '配置中心' }]} style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: '#111827' }}>配置中心</div>
        <Row gutter={24}>
          {cards.map(c => (
            <Col span={12} key={c.key}>
              <Card hoverable style={{ borderRadius: 10 }} styles={{ body: { padding: 24 } }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{c.title}</span>
                      <Tag color="blue" style={{ borderRadius: 4 }}>{c.count} 条</Tag>
                    </div>
                    <div style={{ fontSize: 13, color: '#9ca3af' }}>{c.desc}</div>
                  </div>
                </div>
                <Button type="primary" style={{ background: '#4338ca', borderColor: '#4338ca' }} onClick={() => props.setTransferConfigView(c.key as 'checklist' | 'review')}>管理</Button>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    )
  }

  const isChecklist = props.transferConfigView === 'checklist'
  const title = isChecklist ? '转维材料配置' : '评审要素配置'
  const templates = isChecklist ? MOCK_CHECKLIST_TEMPLATES : MOCK_REVIEW_ELEMENT_TEMPLATES
  const versions = isChecklist ? MOCK_CHECKLIST_VERSIONS : MOCK_RE_VERSIONS
  const diffData = isChecklist ? MOCK_CHECKLIST_VERSION_DIFF : MOCK_RE_VERSION_DIFF
  const filtered = templates.filter((t: any) => {
    if (!props.tmConfigSearchText) return true
    const s = props.tmConfigSearchText.toLowerCase()
    return (t.checkItem || t.description || '').toLowerCase().includes(s) || (t.responsibleRole || '').toLowerCase().includes(s)
  })

  const CONFIG_ROLE_TAG: Record<string, string> = { SPM: 'blue', '测试': 'cyan', '底软': 'orange', '系统': 'red', '影像': 'purple' }
  const columns: any[] = isChecklist ? [
    { title: '序号', dataIndex: 'seq', width: 70, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: '类型', dataIndex: 'type', width: 100, render: (v: string) => <Tag color={v === '检查项' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: '评审要素', dataIndex: 'checkItem', ellipsis: true },
    { title: '责任角色', dataIndex: 'responsibleRole', width: 90, align: 'center' as const, render: (v: string) => <Tag color={CONFIG_ROLE_TAG[v] || 'default'}>{v}</Tag> },
    { title: '资料录入-责任人', dataIndex: 'entryRole', width: 160 },
    { title: '人工审核-责任人', dataIndex: 'reviewRole', width: 160 },
    { title: '智能检查规则', dataIndex: 'aiCheckRule', width: 200, ellipsis: true, render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip> },
  ] : [
    { title: '序号', dataIndex: 'seq', width: 70, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: '标准', dataIndex: 'standard', width: 200, ellipsis: true, render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip> },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '备注', dataIndex: 'remark', width: 160, ellipsis: true },
    { title: '责任角色', dataIndex: 'responsibleRole', width: 90, align: 'center' as const, render: (v: string) => <Tag color={CONFIG_ROLE_TAG[v] || 'default'}>{v}</Tag> },
    { title: '资料录入-责任人', dataIndex: 'entryRole', width: 140 },
    { title: '人工审核-责任人', dataIndex: 'reviewRole', width: 140 },
    { title: '智能检查规则', dataIndex: 'aiCheckRule', width: 200, ellipsis: true, render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip> },
  ]

  return (
    <div>
      <Breadcrumb items={[{ title: <a onClick={() => props.setTransferConfigView('home')}>配置中心</a> }, { title }]} style={{ marginBottom: 16 }} />
      <Card
        title={<span style={{ fontWeight: 600 }}>{title}</span>}
        extra={
          <Space size={8}>
            <Button icon={<UploadOutlined />}>导入</Button>
            <Button icon={<DownloadOutlined />}>导出</Button>
            <Select value={props.tmConfigSelectedVersion} onChange={props.setTmConfigSelectedVersion} style={{ width: 100 }}>
              {versions.map((v: any) => <Option key={v.version} value={v.version}>{v.version}</Option>)}
            </Select>
            <Tooltip title="版本对比"><Button icon={<DiffOutlined />} onClick={() => props.setTmConfigDiffOpen(true)} /></Tooltip>
          </Space>
        }
        style={{ borderRadius: 10 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Input placeholder="搜索..." prefix={<SearchOutlined />} allowClear value={props.tmConfigSearchText} onChange={e => props.setTmConfigSearchText(e.target.value)} style={{ width: 300 }} />
        </div>
        <Table dataSource={filtered as any[]} columns={columns} rowKey="id" size="small" pagination={false} scroll={{ x: 900 }} />
      </Card>
      <Modal title="版本对比" open={props.tmConfigDiffOpen} onCancel={() => props.setTmConfigDiffOpen(false)} width={800} footer={<Button onClick={() => props.setTmConfigDiffOpen(false)}>关闭</Button>}>
        <Space style={{ marginBottom: 16 }}>
          <span>从</span>
          <Select value={props.tmConfigDiffFrom} onChange={props.setTmConfigDiffFrom} style={{ width: 100 }}>{versions.map((v: any) => <Option key={v.version} value={v.version}>{v.version}</Option>)}</Select>
          <span>到</span>
          <Select value={props.tmConfigDiffTo} onChange={props.setTmConfigDiffTo} style={{ width: 100 }}>{versions.map((v: any) => <Option key={v.version} value={v.version}>{v.version}</Option>)}</Select>
        </Space>
        <Table dataSource={diffData as any[]} rowKey="id" size="small" pagination={false} columns={[
          { title: '序号', dataIndex: 'seq', width: 60 },
          { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === '新增' ? 'green' : v === '修改' ? 'blue' : 'red'}>{v}</Tag> },
          { title: isChecklist ? '评审要素' : '说明', dataIndex: isChecklist ? 'checkItem' : 'description', ellipsis: true },
          { title: '变更内容', dataIndex: 'change', ellipsis: true },
        ]} />
      </Modal>
    </div>
  )
}

// ========== TransferWorkbench ==========
export function TransferWorkbench(props: TransferModuleProps) {
  const apps = props.transferApplications.filter(a => a.projectName === props.selectedProject?.name)
  const stats = [
    { label: '总计', value: apps.length, color: '#4338ca' },
    { label: '进行中', value: apps.filter(a => a.status === 'in_progress').length, color: '#6366f1' },
    { label: '已完成', value: apps.filter(a => a.status === 'completed').length, color: '#52c41a' },
    { label: '已关闭', value: apps.filter(a => a.status === 'cancelled').length, color: '#e5e7eb' },
  ]
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>转维管理</span>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#4338ca' }} onClick={() => props.setTransferView('apply')}>申请转维</Button>
      </div>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {stats.map(s => (
          <Col span={6} key={s.label}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic title={s.label} value={s.value} valueStyle={{ color: s.color, fontWeight: 700 }} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card style={{ borderRadius: 8 }}>
        <Table dataSource={apps} rowKey="id" size="small" pagination={false} rowClassName={(r) => r.status === 'cancelled' ? 'tm-row-cancelled' : ''}
          columns={[
            { title: '项目名称', dataIndex: 'projectName', width: 240, render: (_: unknown, r: TransferApplication) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar size={32} style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[r.team.research[0]?.role] || '#4338ca'} 0%, #6366f1 100%)`, fontSize: 12 }}>{r.applicant.slice(-1)}</Avatar>
                <div><div style={{ fontSize: 13, fontWeight: 500 }}>{r.projectName}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{r.applicant} · {r.createdAt.slice(0, 10)}</div></div>
              </div>
            )},
            { title: '流水线进度', width: 200, render: (_: unknown, r: TransferApplication) => <MiniPipeline app={r} /> },
            { title: '计划评审', dataIndex: 'plannedReviewDate', width: 110 },
            { title: '备注', dataIndex: 'remark', width: 160, ellipsis: true, render: (v: string) => v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-' },
            { title: '角色进度', width: 200, render: (_: unknown, r: TransferApplication) => (
              <Space size={4} wrap>{r.pipeline.roleProgress.map(rp => {
                const color = rp.entryStatus === 'completed' && rp.reviewStatus === 'completed' ? 'success' : rp.reviewStatus === 'rejected' ? 'error' : rp.entryStatus === 'in_progress' || rp.reviewStatus === 'in_progress' ? 'processing' : 'default'
                return <Tag key={rp.role} color={color} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>{rp.role}</Tag>
              })}</Space>
            )},
            { title: '操作', width: 260, fixed: 'right' as const, render: (_: unknown, r: TransferApplication) => (
              <Space size={4}>
                <Button size="small" type="text" icon={<FileTextOutlined />} style={{ color: '#666' }} onClick={() => { props.setSelectedTransferAppId(r.id); props.setTransferView('detail'); }}>详情</Button>
                {r.status === 'in_progress' && r.pipeline.dataEntry !== 'success' && <Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#6366f1' }} onClick={() => { props.setSelectedTransferAppId(r.id); props.setTransferView('entry'); }}>录入</Button>}
                {r.status === 'in_progress' && r.pipeline.maintenanceReview === 'in_progress' && <Button size="small" type="text" icon={<AuditOutlined />} style={{ color: '#52c41a' }} onClick={() => { props.setSelectedTransferAppId(r.id); props.setTransferView('review'); }}>评审</Button>}
                {r.status === 'in_progress' && r.pipeline.sqaReview === 'in_progress' && <Button size="small" type="text" icon={<SafetyOutlined />} style={{ color: '#faad14' }} onClick={() => { props.setSelectedTransferAppId(r.id); props.setTransferView('sqa-review'); }}>SQA审核</Button>}
                {r.status === 'in_progress' && <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={() => { props.setTmCloseAppId(r.id); props.setTmCloseReason(''); props.setTmCloseModalVisible(true); }}>关闭</Button>}
              </Space>
            )},
          ]}
        />
      </Card>
      {/* 关闭Modal */}
      <Modal title="关闭转维流水线" open={props.tmCloseModalVisible} onCancel={() => props.setTmCloseModalVisible(false)} onOk={() => {
        if (!props.tmCloseReason.trim()) { message.warning('请输入关闭原因'); return; }
        props.setTransferApplications(prev => prev.map(a => a.id === props.tmCloseAppId ? { ...a, status: 'cancelled' as const, cancelReason: props.tmCloseReason } : a));
        props.setTmCloseModalVisible(false); message.success('已关闭');
      }}>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#9ca3af' }}>关闭后该转维申请将不可恢复，请确认。</div>
        <TextArea rows={3} placeholder="请输入关闭原因..." value={props.tmCloseReason} onChange={e => props.setTmCloseReason(e.target.value)} />
      </Modal>
    </div>
  )
}

// ========== TransferApply ==========
export function TransferApply(props: TransferModuleProps) {
  const roleOrder: string[] = ['SPM', 'TPM', 'SQA', '底软', '系统', '影像']
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => props.setTransferView(null)} style={{ color: '#4338ca', fontWeight: 500, padding: 0 }}>返回</Button>
      </div>
      <Card style={{ borderRadius: 10 }} title={<Space><SwapOutlined style={{ color: '#4338ca' }} /><span style={{ fontWeight: 600 }}>申请转维</span></Space>}>
        <Form layout="vertical">
          <Form.Item label="项目名称" required>
            <Select value={props.selectedProject?.name || ''} disabled style={{ width: '100%' }}>
              <Option value={props.selectedProject?.name || ''}>{props.selectedProject?.name}</Option>
            </Select>
          </Form.Item>
          <Form.Item label="计划评审日期">
            <Input type="date" value={props.tmApplyDate} onChange={e => props.setTmApplyDate(e.target.value)} />
          </Form.Item>
          <Form.Item label="备注">
            <TextArea rows={3} placeholder="请输入备注信息..." value={props.tmApplyRemark} onChange={e => props.setTmApplyRemark(e.target.value)} />
          </Form.Item>
        </Form>

        {/* 团队配置 */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>团队配置</div>
          <Row gutter={24}>
            {(['research', 'maintenance'] as const).map(side => (
              <Col span={12} key={side}>
                <Card size="small" title={<Tag color={side === 'research' ? 'blue' : 'green'}>{side === 'research' ? '在研团队' : '维护团队'}</Tag>} style={{ borderRadius: 8 }}>
                  {roleOrder.map(role => {
                    const members = props.tmApplyTeam[side].filter(m => m.role === role)
                    return (
                      <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <Tag color={ROLE_COLORS[role] || '#999'} style={{ color: '#fff', minWidth: 40, textAlign: 'center', borderRadius: 4 }}>{role}</Tag>
                        <Select mode="multiple" placeholder={`选择${role}成员`} value={members.map(m => m.id)} style={{ flex: 1 }}
                          onChange={(vals: string[]) => {
                            const newMembers = props.tmApplyTeam[side].filter(m => m.role !== role)
                            vals.forEach(uid => {
                              const u = MOCK_TM_USERS.find(u => u.id === uid)
                              if (u) newMembers.push({ ...u, role: role as any })
                            })
                            props.setTmApplyTeam(prev => ({ ...prev, [side]: newMembers }))
                          }}
                        >
                          {MOCK_TM_USERS.filter(u => u.role === role || (role === 'TPM' && u.role === 'TPM')).map(u => <Option key={u.id} value={u.id}>{u.name}</Option>)}
                        </Select>
                      </div>
                    )
                  })}
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* 转维指南 */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>转维指南</div>
          <Row gutter={16}>
            {[
              { icon: <RocketOutlined />, title: '转维流程概览', desc: '了解完整的转维流程步骤和各阶段要求' },
              { icon: <FileProtectOutlined />, title: 'CheckList', desc: `共 ${MOCK_CHECKLIST_TEMPLATES.length} 条检查项，覆盖所有角色` },
              { icon: <SafetyOutlined />, title: '评审要素', desc: `共 ${MOCK_REVIEW_ELEMENT_TEMPLATES.length} 条评审标准` },
            ].map((g, i) => (
              <Col span={8} key={i}>
                <Card size="small" hoverable style={{ borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, color: '#4338ca', marginBottom: 8 }}>{g.icon}</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.title}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{g.desc}</div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => props.setTransferView(null)}>取消</Button>
            <Button type="primary" style={{ background: '#4338ca' }} onClick={() => {
              if (!props.tmApplyDate) { message.warning('请选择计划评审日期'); return; }
              const newApp: TransferApplication = {
                id: `app-new-${Date.now()}`,
                projectId: props.selectedProject?.id || '',
                projectName: props.selectedProject?.name || '',
                applicant: props.currentUser.name,
                applicantId: props.currentUser.id,
                team: { research: props.tmApplyTeam.research, maintenance: props.tmApplyTeam.maintenance },
                plannedReviewDate: props.tmApplyDate,
                remark: props.tmApplyRemark,
                status: 'in_progress',
                pipeline: {
                  projectInit: 'success', dataEntry: 'in_progress', maintenanceReview: 'not_started', sqaReview: 'not_started', infoChange: 'not_started',
                  roleProgress: [
                    { role: 'SPM', entryStatus: 'not_started', reviewStatus: 'not_started' },
                    { role: '测试', entryStatus: 'not_started', reviewStatus: 'not_started' },
                    { role: '底软', entryStatus: 'not_started', reviewStatus: 'not_started' },
                    { role: '系统', entryStatus: 'not_started', reviewStatus: 'not_started' },
                    { role: '影像', entryStatus: 'not_started', reviewStatus: 'not_started' },
                  ],
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
              props.setTransferApplications(prev => [newApp, ...prev])
              props.setTmApplyDate(''); props.setTmApplyRemark(''); props.setTmApplyTeam({ research: [], maintenance: [] })
              props.setTransferView(null); props.setProjectSpaceModule('basic')
              message.success('转维申请已提交')
            }}>提交申请</Button>
          </Space>
        </div>
      </Card>
    </div>
  )
}

// ========== TransferDetail ==========
export function TransferDetail(props: TransferModuleProps) {
  const app = props.transferApplications.find(a => a.id === props.selectedTransferAppId)
  if (!app) return <Empty description="未找到该转维申请" />
  const appChecklist = props.tmChecklistItems.filter(c => c.applicationId === app.id)
  const appReviewEls = props.tmReviewElements.filter(r => r.applicationId === app.id)
  const appBlockTasks = props.tmBlockTasks.filter(b => b.applicationId === app.id)
  const appLegacyTasks = props.tmLegacyTasks.filter(l => l.applicationId === app.id)
  const appHistory = MOCK_HISTORY.filter(h => h.applicationId === app.id)
  const statusConfig = PIPELINE_STATUS_CONFIG[app.status] ?? { color: 'default', label: app.status }

  const ANCHOR_SECTIONS = [
    { id: 'section-pipeline', label: '流水线', icon: '🔄' },
    { id: 'section-info', label: '项目信息', icon: '📋' },
    { id: 'section-team', label: '团队信息', icon: '👥' },
    { id: 'section-checklist', label: 'CheckList', icon: '✅' },
    { id: 'section-review', label: '评审要素', icon: '📝' },
    { id: 'section-block', label: 'Block任务', icon: '🚫' },
    { id: 'section-legacy', label: '遗留任务', icon: '📌' },
    { id: 'section-history', label: '历史记录', icon: '🕐' },
  ]

  const getTimelineIcon = (action: string) => {
    if (action.includes('创建')) return <ExclamationCircleOutlined style={{ color: '#6366f1' }} />
    if (action.includes('通过')) return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    if (action.includes('Block') || action.includes('不通过')) return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    if (action.includes('录入')) return <ClockCircleOutlined style={{ color: '#faad14' }} />
    return <ClockCircleOutlined style={{ color: '#6366f1' }} />
  }

  const renderEntryStatusTag = (status: string) => {
    const config = ENTRY_STATUS_CONFIG[status]
    return <Tag color={config?.color}>{config?.label}</Tag>
  }
  const renderAICheckStatusTag = (status: string, result?: string) => {
    const config = AI_CHECK_STATUS_CONFIG[status]
    if (status === 'failed' && result) {
      return <Tag color={config?.color} style={{ cursor: 'pointer' }} onClick={() => { props.setTmDetailModalTitle('AI检查结果'); props.setTmDetailModalContent(result); props.setTmDetailModalVisible(true) }}>{config?.label}</Tag>
    }
    return <Tag color={config?.color}>{config?.label}</Tag>
  }
  const renderReviewStatusTag = (status: string, comment?: string) => {
    const config = REVIEW_STATUS_CONFIG[status]
    if (status === 'rejected' && comment) {
      return <Tag color={config?.color} style={{ cursor: 'pointer' }} onClick={() => { props.setTmDetailModalTitle('审核意见'); props.setTmDetailModalContent(comment); props.setTmDetailModalVisible(true) }}>{config?.label}</Tag>
    }
    return <Tag color={config?.color}>{config?.label}</Tag>
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* 顶部返回按钮 + 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => props.setTransferView(null)}>返回</Button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>项目转维进展详情页</h2>
        </div>
      </div>

      {/* 取消提示横幅 */}
      {app.status === 'cancelled' && app.cancelReason && (
        <Alert message="该转维申请已取消" description={`取消原因：${app.cancelReason}`} type="error" showIcon style={{ marginBottom: 20 }} />
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* 左侧主内容 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 流水线进度 */}
          <Card id="section-pipeline" style={{ marginBottom: 20 }}>
            <PipelineProgress pipeline={app.pipeline} showRoleDots />
          </Card>

          {/* 项目信息 */}
          <Card id="section-info" title="项目信息" style={{ marginBottom: 20 }}>
            <Descriptions column={4} size="small" styles={{ label: { fontWeight: 500, color: '#666' } }}>
              <Descriptions.Item label="项目名">{app.projectName}</Descriptions.Item>
              <Descriptions.Item label="项目编号">{app.projectId || '-'}</Descriptions.Item>
              <Descriptions.Item label="项目负责人">{app.applicant}</Descriptions.Item>
              <Descriptions.Item label="转维负责人">{app.team.maintenance.find(m => m.role === 'SPM')?.name ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="转维启动时间">{app.createdAt.slice(0, 10)}</Descriptions.Item>
              <Descriptions.Item label="转维截止时间">{app.plannedReviewDate}</Descriptions.Item>
              <Descriptions.Item label="项目状态"><Tag color={statusConfig.color}>{statusConfig.label}</Tag></Descriptions.Item>
              <Descriptions.Item label="备注">{app.remark || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 团队信息：在研团队 + 维护团队 左右布局 */}
          <div id="section-team" style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
            <Card title="在研团队" size="small" style={{ flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {sortTeamMembers(app.team.research).map(m => <TeamMemberCard key={m.id} member={m} />)}
              </div>
            </Card>
            <Card title="维护团队" size="small" style={{ flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {sortTeamMembers(app.team.maintenance).map(m => <TeamMemberCard key={m.id} member={m} />)}
              </div>
            </Card>
          </div>

          {/* 转维CheckList */}
          <Card id="section-checklist" title="转维CheckList" style={{ marginBottom: 20 }}>
            <Table dataSource={appChecklist} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} locale={{ emptyText: '暂无检查项' }}
              columns={[
                { title: '序号', dataIndex: 'seq', width: 60, align: 'center' as const },
                { title: '检查项目名称', dataIndex: 'checkItem', width: 280, ellipsis: true },
                { title: '所属角色', dataIndex: 'responsibleRole', width: 80, align: 'center' as const },
                { title: '责任人', dataIndex: 'entryPerson', width: 80, align: 'center' as const },
                { title: '交付件', width: 180, render: (_: unknown, record: any) => renderEntryContent(record) },
                { title: '录入状态', dataIndex: 'entryStatus', width: 90, align: 'center' as const, render: (_: unknown, record: any) => renderEntryStatusTag(record.entryStatus) },
                { title: 'AI检查状态', dataIndex: 'aiCheckStatus', width: 100, align: 'center' as const, render: (_: unknown, record: any) => renderAICheckStatusTag(record.aiCheckStatus, record.aiCheckResult) },
                { title: '维护审核状态', dataIndex: 'reviewStatus', width: 100, align: 'center' as const, render: (_: unknown, record: any) => renderReviewStatusTag(record.reviewStatus, record.reviewComment) },
              ]}
            />
          </Card>

          {/* 转维要素评审列表 */}
          <Card id="section-review" title="转维要素评审列表" style={{ marginBottom: 20 }}>
            <Table dataSource={appReviewEls} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} locale={{ emptyText: '暂无评审要素' }}
              columns={[
                { title: '序号', dataIndex: 'seq', width: 60, align: 'center' as const },
                { title: '类型', dataIndex: 'standard', width: 100 },
                { title: '评审要素', dataIndex: 'description', width: 280, ellipsis: true },
                { title: '责任人', dataIndex: 'entryPerson', width: 80, align: 'center' as const },
                { title: '交付件', width: 180, render: (_: unknown, record: any) => renderEntryContent(record) },
                { title: '录入状态', dataIndex: 'entryStatus', width: 90, align: 'center' as const, render: (_: unknown, record: any) => renderEntryStatusTag(record.entryStatus) },
                { title: 'AI检查状态', dataIndex: 'aiCheckStatus', width: 100, align: 'center' as const, render: (_: unknown, record: any) => renderAICheckStatusTag(record.aiCheckStatus, record.aiCheckResult) },
                { title: '维护审核状态', dataIndex: 'reviewStatus', width: 100, align: 'center' as const, render: (_: unknown, record: any) => renderReviewStatusTag(record.reviewStatus, record.reviewComment) },
              ]}
            />
          </Card>

          {/* Block任务列表 */}
          <Card id="section-block" title="Block任务列表" style={{ marginBottom: 20 }}>
            <Table dataSource={appBlockTasks} rowKey="id" size="small" pagination={false} scroll={{ x: 900 }} locale={{ emptyText: '暂无Block任务' }}
              columns={[
                { title: '序号', key: 'index', width: 60, align: 'center' as const, render: (_: unknown, __: any, index: number) => index + 1 },
                { title: '问题描述', dataIndex: 'description', width: 280, ellipsis: true },
                { title: '解决方案', dataIndex: 'resolution', width: 280, ellipsis: true },
                { title: '责任人', dataIndex: 'responsiblePerson', width: 80, align: 'center' as const },
                { title: '部门', dataIndex: 'department', width: 100, align: 'center' as const },
                { title: '截止日期', dataIndex: 'deadline', width: 110, align: 'center' as const },
                { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const, render: (v: string) => <Tag color={BLOCK_TASK_STATUS_CONFIG[v]?.color}>{BLOCK_TASK_STATUS_CONFIG[v]?.label}</Tag> },
                { title: '创建时间', dataIndex: 'createdAt', width: 110, align: 'center' as const, render: (val: string) => val?.slice(0, 10) },
              ]}
            />
          </Card>

          {/* 遗留任务列表 */}
          <Card id="section-legacy" title="遗留任务列表" style={{ marginBottom: 20 }}>
            <Table dataSource={appLegacyTasks} rowKey="id" size="small" pagination={false} scroll={{ x: 900 }} locale={{ emptyText: '暂无遗留任务' }}
              columns={[
                { title: '序号', key: 'index', width: 60, align: 'center' as const, render: (_: unknown, __: any, index: number) => index + 1 },
                { title: '任务描述', dataIndex: 'description', width: 300, ellipsis: true },
                { title: '责任人', dataIndex: 'responsiblePerson', width: 80, align: 'center' as const },
                { title: '部门', dataIndex: 'department', width: 100, align: 'center' as const },
                { title: '截止日期', dataIndex: 'deadline', width: 110, align: 'center' as const },
                { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const, render: (v: string) => <Tag color={LEGACY_TASK_STATUS_CONFIG[v]?.color}>{LEGACY_TASK_STATUS_CONFIG[v]?.label}</Tag> },
                { title: '创建时间', dataIndex: 'createdAt', width: 110, align: 'center' as const, render: (val: string) => val?.slice(0, 10) },
              ]}
            />
          </Card>

          {/* 历史记录 */}
          <Card id="section-history" title="历史记录" style={{ marginBottom: 20 }}>
            {appHistory.length === 0 ? (
              <Empty description="暂无历史记录" />
            ) : (
              <Timeline items={appHistory.map(h => ({
                dot: getTimelineIcon(h.action),
                children: (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500 }}>{h.action}</span>
                      <span style={{ color: '#888', fontSize: 12 }}>{h.operator} - {new Date(h.timestamp).toLocaleString('zh-CN')}</span>
                    </div>
                    <div style={{ color: '#555', fontSize: 13, marginTop: 4 }}>{h.detail}</div>
                  </div>
                ),
              }))} />
            )}
          </Card>
        </div>

        {/* 右侧悬浮锚点导航 */}
        <div style={{ position: 'sticky', top: 80, width: 140, flexShrink: 0 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '12px 0', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '0 16px 8px', borderBottom: '1px solid #f3f4f6', marginBottom: 4, letterSpacing: 1 }}>页面导航</div>
            {ANCHOR_SECTIONS.map(section => (
              <div key={section.id} onClick={() => { const el = document.getElementById(section.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, color: '#666', borderLeft: '3px solid transparent', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0edff'; e.currentTarget.style.color = '#4338ca'; e.currentTarget.style.borderLeftColor = '#4338ca' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; e.currentTarget.style.borderLeftColor = 'transparent' }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{section.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 结果详情弹窗 */}
      <Modal title={props.tmDetailModalTitle} open={props.tmDetailModalVisible} onCancel={() => props.setTmDetailModalVisible(false)} footer={[<Button key="close" onClick={() => props.setTmDetailModalVisible(false)}>关闭</Button>]}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{props.tmDetailModalContent}</p>
      </Modal>
    </div>
  )
}

// ========== TransferEntry ==========
export function TransferEntry(props: TransferModuleProps) {
  const app = props.transferApplications.find(a => a.id === props.selectedTransferAppId)
  if (!app) return <Empty description="未找到申请" />

  const appChecklist = props.tmChecklistItems.filter(c => c.applicationId === app.id)
  const appReviewEls = props.tmReviewElements.filter(r => r.applicationId === app.id)
  const roles = Array.from(new Set([...appChecklist.map(c => c.responsibleRole), ...appReviewEls.map(r => r.responsibleRole)]))
  const filteredCL = props.tmEntryActiveRole === 'all' ? appChecklist : appChecklist.filter(c => c.responsibleRole === props.tmEntryActiveRole)
  const filteredRE = props.tmEntryActiveRole === 'all' ? appReviewEls : appReviewEls.filter(r => r.responsibleRole === props.tmEntryActiveRole)

  const openEntry = (record: any, tab: 'checklist' | 'review') => {
    props.setTmEntryModalRecord({ ...record, _tab: tab })
    props.setTmEntryContent(record.entryContent || '')
    props.setTmEntryModalOpen(true)
  }

  const saveEntry = (mode: 'draft' | 'confirm') => {
    if (!props.tmEntryModalRecord) return
    const status: EntryStatus = mode === 'draft' ? 'draft' : 'entered'
    if (props.tmEntryModalRecord._tab === 'checklist') {
      props.setTmChecklistItems(prev => prev.map(c => c.id === props.tmEntryModalRecord.id ? { ...c, entryContent: props.tmEntryContent, entryStatus: status, aiCheckStatus: mode === 'confirm' ? 'passed' as const : 'not_started' as const } : c))
    } else {
      props.setTmReviewElements(prev => prev.map(r => r.id === props.tmEntryModalRecord.id ? { ...r, entryContent: props.tmEntryContent, entryStatus: status, aiCheckStatus: mode === 'confirm' ? 'passed' as const : 'not_started' as const } : r))
    }
    props.setTmEntryModalOpen(false)
    message.success(mode === 'draft' ? '已暂存' : '已确认并提交AI检查')
  }

  const clColumns: any[] = [
    { title: '序号', dataIndex: 'seq', width: 60 },
    { title: '类型', dataIndex: 'type', width: 80, render: (v: string) => <Tag color={v === '检查项' ? 'processing' : 'warning'}>{v}</Tag> },
    { title: '评审要素', dataIndex: 'checkItem', ellipsis: true },
    { title: '角色', dataIndex: 'responsibleRole', width: 70, render: (v: string) => <Tag color={ROLE_COLORS[v]} style={{ color: '#fff', borderRadius: 4 }}>{v}</Tag> },
    { title: '录入人', dataIndex: 'entryPerson', width: 80 },
    { title: '录入状态', dataIndex: 'entryStatus', width: 90, render: (v: string) => <Tag color={ENTRY_STATUS_CONFIG[v]?.color}>{ENTRY_STATUS_CONFIG[v]?.label}</Tag> },
    { title: 'AI检查', dataIndex: 'aiCheckStatus', width: 90, render: (v: string) => <Tag color={AI_CHECK_STATUS_CONFIG[v]?.color}>{AI_CHECK_STATUS_CONFIG[v]?.label}</Tag> },
    { title: '内容', dataIndex: 'entryContent', width: 160, ellipsis: true, render: (v: string) => v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-' },
    { title: '操作', width: 100, render: (_: unknown, r: any) => <Button size="small" type="link" onClick={() => openEntry(r, 'checklist')}>录入</Button> },
  ]
  const reColumns: any[] = [
    { title: '序号', dataIndex: 'seq', width: 60 },
    { title: '标准', dataIndex: 'standard', width: 100, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '角色', dataIndex: 'responsibleRole', width: 70, render: (v: string) => <Tag color={ROLE_COLORS[v]} style={{ color: '#fff', borderRadius: 4 }}>{v}</Tag> },
    { title: '录入人', dataIndex: 'entryPerson', width: 80 },
    { title: '录入状态', dataIndex: 'entryStatus', width: 90, render: (v: string) => <Tag color={ENTRY_STATUS_CONFIG[v]?.color}>{ENTRY_STATUS_CONFIG[v]?.label}</Tag> },
    { title: 'AI检查', dataIndex: 'aiCheckStatus', width: 90, render: (v: string) => <Tag color={AI_CHECK_STATUS_CONFIG[v]?.color}>{AI_CHECK_STATUS_CONFIG[v]?.label}</Tag> },
    { title: '内容', dataIndex: 'entryContent', width: 160, ellipsis: true, render: (v: string) => v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-' },
    { title: '操作', width: 100, render: (_: unknown, r: any) => <Button size="small" type="link" onClick={() => openEntry(r, 'review')}>录入</Button> },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => props.setTransferView(null)} style={{ color: '#4338ca', fontWeight: 500, padding: 0 }}>返回</Button></div>
      <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space><SwapOutlined style={{ color: '#4338ca' }} /><span style={{ fontWeight: 600 }}>{app.projectName} - 资料录入</span></Space>}>
        <PipelineProgress pipeline={app.pipeline} />
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Segmented options={[{ label: '全部', value: 'all' }, ...roles.map(r => ({ label: r, value: r }))]} value={props.tmEntryActiveRole} onChange={v => props.setTmEntryActiveRole(v as string)} />
          </Space>
          <Tabs activeKey={props.tmEntryTab} onChange={k => props.setTmEntryTab(k as any)} items={[{ key: 'checklist', label: `转维材料 (${filteredCL.length})` }, { key: 'review', label: `评审要素 (${filteredRE.length})` }]} style={{ marginBottom: 0 }} />
        </div>
        {props.tmEntryTab === 'checklist' && <Table dataSource={filteredCL} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} columns={clColumns} />}
        {props.tmEntryTab === 'review' && <Table dataSource={filteredRE} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} columns={reColumns} />}
      </Card>

      <Modal title="资料录入" open={props.tmEntryModalOpen} onCancel={() => props.setTmEntryModalOpen(false)} width={600}
        footer={[
          <Button key="cancel" onClick={() => props.setTmEntryModalOpen(false)}>取消</Button>,
          <Button key="draft" onClick={() => saveEntry('draft')}>暂存</Button>,
          <Button key="confirm" type="primary" style={{ background: '#4338ca' }} onClick={() => saveEntry('confirm')}>确认提交</Button>,
        ]}>
        {props.tmEntryModalRecord && (
          <div>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="评审要素">{props.tmEntryModalRecord.checkItem || props.tmEntryModalRecord.description}</Descriptions.Item>
              <Descriptions.Item label="角色"><Tag color={ROLE_COLORS[props.tmEntryModalRecord.responsibleRole]} style={{ color: '#fff' }}>{props.tmEntryModalRecord.responsibleRole}</Tag></Descriptions.Item>
              <Descriptions.Item label="AI检查规则"><span style={{ fontSize: 12, color: '#9ca3af' }}>{props.tmEntryModalRecord.aiCheckRule}</span></Descriptions.Item>
            </Descriptions>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>录入内容</div>
            <TextArea rows={6} placeholder="请输入资料内容，支持文本描述、链接、飞书文档地址等..." value={props.tmEntryContent} onChange={e => props.setTmEntryContent(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  )
}

// ========== TransferReview ==========
export function TransferReview(props: TransferModuleProps) {
  const app = props.transferApplications.find(a => a.id === props.selectedTransferAppId)
  if (!app) return <Empty description="未找到申请" />

  const appChecklist = props.tmChecklistItems.filter(c => c.applicationId === app.id)
  const appReviewEls = props.tmReviewElements.filter(r => r.applicationId === app.id)
  const roles = Array.from(new Set([...appChecklist.map(c => c.responsibleRole), ...appReviewEls.map(r => r.responsibleRole)]))
  const filteredCL = props.tmReviewActiveRole === 'all' ? appChecklist : appChecklist.filter(c => c.responsibleRole === props.tmReviewActiveRole)
  const filteredRE = props.tmReviewActiveRole === 'all' ? appReviewEls : appReviewEls.filter(r => r.responsibleRole === props.tmReviewActiveRole)

  const openReview = (record: any, action: 'pass' | 'reject', tab: 'checklist' | 'review') => {
    props.setTmReviewRecord({ ...record, _tab: tab }); props.setTmReviewAction(action); props.setTmReviewComment(''); props.setTmReviewModalOpen(true)
  }

  const submitReview = () => {
    if (!props.tmReviewRecord) return
    const status: ReviewStatus = props.tmReviewAction === 'pass' ? 'passed' : 'rejected'
    if (props.tmReviewRecord._tab === 'checklist') {
      props.setTmChecklistItems(prev => prev.map(c => c.id === props.tmReviewRecord.id ? { ...c, reviewStatus: status, reviewComment: props.tmReviewAction === 'reject' ? props.tmReviewComment : undefined } : c))
    } else {
      props.setTmReviewElements(prev => prev.map(r => r.id === props.tmReviewRecord.id ? { ...r, reviewStatus: status, reviewComment: props.tmReviewAction === 'reject' ? props.tmReviewComment : undefined } : r))
    }
    props.setTmReviewModalOpen(false)
    message.success(props.tmReviewAction === 'pass' ? '已通过' : '已拒绝')
  }

  const reviewColumns = (tab: 'checklist' | 'review'): any[] => {
    const base = tab === 'checklist' ? [
      { title: '序号', dataIndex: 'seq', width: 60 },
      { title: '类型', dataIndex: 'type', width: 80, render: (v: string) => <Tag color={v === '检查项' ? 'processing' : 'warning'}>{v}</Tag> },
      { title: '评审要素', dataIndex: 'checkItem', ellipsis: true },
    ] : [
      { title: '序号', dataIndex: 'seq', width: 60 },
      { title: '标准', dataIndex: 'standard', width: 100, render: (v: string) => <Tag color="purple">{v}</Tag> },
      { title: '说明', dataIndex: 'description', ellipsis: true },
    ]
    return [
      ...base,
      { title: '角色', dataIndex: 'responsibleRole', width: 70, render: (v: string) => <Tag color={ROLE_COLORS[v]} style={{ color: '#fff', borderRadius: 4 }}>{v}</Tag> },
      { title: '内容', dataIndex: 'entryContent', width: 160, ellipsis: true, render: (v: string) => v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-' },
      { title: 'AI检查', dataIndex: 'aiCheckStatus', width: 80, render: (v: string) => <Tag color={AI_CHECK_STATUS_CONFIG[v]?.color}>{AI_CHECK_STATUS_CONFIG[v]?.label}</Tag> },
      { title: '审核状态', dataIndex: 'reviewStatus', width: 90, render: (v: string) => <Tag color={REVIEW_STATUS_CONFIG[v]?.color}>{REVIEW_STATUS_CONFIG[v]?.label}</Tag> },
      { title: '操作', width: 140, render: (_: unknown, r: any) => r.entryStatus === 'entered' && r.aiCheckStatus === 'passed' && r.reviewStatus !== 'passed' ? (
        <Space size={4}>
          <Button size="small" type="link" style={{ color: '#52c41a' }} onClick={() => openReview(r, 'pass', tab)}>通过</Button>
          <Button size="small" type="link" danger onClick={() => openReview(r, 'reject', tab)}>拒绝</Button>
        </Space>
      ) : '-' },
    ]
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => props.setTransferView(null)} style={{ color: '#4338ca', fontWeight: 500, padding: 0 }}>返回</Button></div>
      <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space><SwapOutlined style={{ color: '#4338ca' }} /><span style={{ fontWeight: 600 }}>{app.projectName} - 维护审核</span></Space>}>
        <PipelineProgress pipeline={app.pipeline} />
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Segmented options={[{ label: '全部', value: 'all' }, ...roles.map(r => ({ label: r, value: r }))]} value={props.tmReviewActiveRole} onChange={v => props.setTmReviewActiveRole(v as string)} />
          <Tabs activeKey={props.tmReviewTab} onChange={k => props.setTmReviewTab(k as any)} items={[{ key: 'checklist', label: `转维材料 (${filteredCL.length})` }, { key: 'review', label: `评审要素 (${filteredRE.length})` }]} style={{ marginBottom: 0 }} />
        </div>
        {props.tmReviewTab === 'checklist' && <Table dataSource={filteredCL} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} columns={reviewColumns('checklist')} />}
        {props.tmReviewTab === 'review' && <Table dataSource={filteredRE} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} columns={reviewColumns('review')} />}
      </Card>
      <Modal title={props.tmReviewAction === 'pass' ? '审核通过' : '审核拒绝'} open={props.tmReviewModalOpen} onCancel={() => props.setTmReviewModalOpen(false)} onOk={submitReview} okButtonProps={{ danger: props.tmReviewAction === 'reject', style: props.tmReviewAction === 'pass' ? { background: '#52c41a', borderColor: '#52c41a' } : {} }} okText={props.tmReviewAction === 'pass' ? '确认通过' : '确认拒绝'}>
        {props.tmReviewRecord && (
          <div>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="评审要素">{props.tmReviewRecord.checkItem || props.tmReviewRecord.description}</Descriptions.Item>
              <Descriptions.Item label="录入内容">{props.tmReviewRecord.entryContent || '-'}</Descriptions.Item>
            </Descriptions>
            {props.tmReviewAction === 'reject' && <TextArea rows={3} placeholder="请输入拒绝原因..." value={props.tmReviewComment} onChange={e => props.setTmReviewComment(e.target.value)} />}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ========== TransferSqaReview ==========
export function TransferSqaReview(props: TransferModuleProps) {
  const app = props.transferApplications.find(a => a.id === props.selectedTransferAppId)
  if (!app) return <Empty description="未找到申请" />
  const sqaComment = props.tmSqaComment
  const setSqaComment = props.setTmSqaComment
  const sqaModalOpen = props.tmSqaModalOpen
  const setSqaModalOpen = props.setTmSqaModalOpen
  const sqaAction = props.tmSqaAction
  const setSqaAction = props.setTmSqaAction

  const appChecklist = props.tmChecklistItems.filter(c => c.applicationId === app.id)
  const appReviewEls = props.tmReviewElements.filter(r => r.applicationId === app.id)
  const appBlockTasks = props.tmBlockTasks.filter(b => b.applicationId === app.id)
  const appLegacyTasks = props.tmLegacyTasks.filter(l => l.applicationId === app.id)
  const closeRows = buildCloseReviewRows(app, props.tmChecklistItems, props.tmReviewElements)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => props.setTransferView(null)} style={{ color: '#4338ca', fontWeight: 500, padding: 0 }}>返回</Button></div>
      <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space><SafetyOutlined style={{ color: '#4338ca' }} /><span style={{ fontWeight: 600 }}>{app.projectName} - SQA审核</span></Space>}>
        <PipelineProgress pipeline={app.pipeline} />
      </Card>

      {/* 评审状态汇总 */}
      <Card style={{ marginBottom: 20, borderRadius: 10 }} title="评审状态汇总" size="small">
        <Table dataSource={closeRows} rowKey="role" size="small" pagination={false}
          columns={[
            { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => <Tag color={ROLE_COLORS[v] || '#999'} style={{ color: '#fff' }}>{v}</Tag> },
            { title: '责任人', dataIndex: 'responsiblePerson', width: 120 },
            { title: '审核结论', dataIndex: 'conclusion', width: 100, render: (v: string) => <Tag color={v === 'PASS' ? 'success' : v === 'Fail' ? 'error' : 'default'}>{v}</Tag> },
            { title: '备注', dataIndex: 'comment' },
          ]}
        />
      </Card>

      {/* CheckList概览 */}
      <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space>转维材料 CheckList<Tag>{appChecklist.length}</Tag></Space>} size="small">
        <Table dataSource={appChecklist} rowKey="id" size="small" pagination={false} scroll={{ x: 900 }}
          columns={[
            { title: '序号', dataIndex: 'seq', width: 60 },
            { title: '评审要素', dataIndex: 'checkItem', ellipsis: true },
            { title: '角色', dataIndex: 'responsibleRole', width: 70, render: (v: string) => <Tag color={ROLE_COLORS[v]} style={{ color: '#fff', borderRadius: 4 }}>{v}</Tag> },
            { title: '录入状态', dataIndex: 'entryStatus', width: 80, render: (v: string) => <Tag color={ENTRY_STATUS_CONFIG[v]?.color}>{ENTRY_STATUS_CONFIG[v]?.label}</Tag> },
            { title: 'AI检查', dataIndex: 'aiCheckStatus', width: 80, render: (v: string) => <Tag color={AI_CHECK_STATUS_CONFIG[v]?.color}>{AI_CHECK_STATUS_CONFIG[v]?.label}</Tag> },
            { title: '审核', dataIndex: 'reviewStatus', width: 80, render: (v: string) => <Tag color={REVIEW_STATUS_CONFIG[v]?.color}>{REVIEW_STATUS_CONFIG[v]?.label}</Tag> },
          ]}
        />
      </Card>

      {/* 评审要素概览 */}
      <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space>评审要素<Tag>{appReviewEls.length}</Tag></Space>} size="small">
        <Table dataSource={appReviewEls} rowKey="id" size="small" pagination={false} scroll={{ x: 900 }}
          columns={[
            { title: '序号', dataIndex: 'seq', width: 60 },
            { title: '说明', dataIndex: 'description', ellipsis: true },
            { title: '角色', dataIndex: 'responsibleRole', width: 70, render: (v: string) => <Tag color={ROLE_COLORS[v]} style={{ color: '#fff', borderRadius: 4 }}>{v}</Tag> },
            { title: '录入状态', dataIndex: 'entryStatus', width: 80, render: (v: string) => <Tag color={ENTRY_STATUS_CONFIG[v]?.color}>{ENTRY_STATUS_CONFIG[v]?.label}</Tag> },
            { title: 'AI检查', dataIndex: 'aiCheckStatus', width: 80, render: (v: string) => <Tag color={AI_CHECK_STATUS_CONFIG[v]?.color}>{AI_CHECK_STATUS_CONFIG[v]?.label}</Tag> },
            { title: '审核', dataIndex: 'reviewStatus', width: 80, render: (v: string) => <Tag color={REVIEW_STATUS_CONFIG[v]?.color}>{REVIEW_STATUS_CONFIG[v]?.label}</Tag> },
          ]}
        />
      </Card>

      {/* Block任务 */}
      {appBlockTasks.length > 0 && (
        <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space>Block任务<Tag color="error">{appBlockTasks.length}</Tag></Space>} size="small">
          <Table dataSource={appBlockTasks} rowKey="id" size="small" pagination={false}
            columns={[
              { title: '问题描述', dataIndex: 'description', ellipsis: true },
              { title: '解决方案', dataIndex: 'resolution', ellipsis: true },
              { title: '责任人', dataIndex: 'responsiblePerson', width: 80 },
              { title: '截止日期', dataIndex: 'deadline', width: 110 },
              { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={BLOCK_TASK_STATUS_CONFIG[v]?.color}>{BLOCK_TASK_STATUS_CONFIG[v]?.label}</Tag> },
            ]}
          />
        </Card>
      )}

      {/* 遗留任务 */}
      {appLegacyTasks.length > 0 && (
        <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space>遗留任务<Tag>{appLegacyTasks.length}</Tag></Space>} size="small">
          <Table dataSource={appLegacyTasks} rowKey="id" size="small" pagination={false}
            columns={[
              { title: '描述', dataIndex: 'description', ellipsis: true },
              { title: '责任人', dataIndex: 'responsiblePerson', width: 80 },
              { title: '部门', dataIndex: 'department', width: 120 },
              { title: '截止日期', dataIndex: 'deadline', width: 110 },
              { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={LEGACY_TASK_STATUS_CONFIG[v]?.color}>{LEGACY_TASK_STATUS_CONFIG[v]?.label}</Tag> },
            ]}
          />
        </Card>
      )}

      {/* SQA审核操作 */}
      <Card style={{ borderRadius: 10 }} title="SQA审核决定" size="small">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>SQA意见</div>
          <TextArea rows={3} placeholder="请输入SQA审核意见..." value={sqaComment} onChange={e => setSqaComment(e.target.value)} />
        </div>
        <Space>
          <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => { setSqaAction('approve'); setSqaModalOpen(true); }}>审核通过</Button>
          <Button danger onClick={() => { if (!sqaComment.trim()) { message.warning('拒绝时请填写SQA意见'); return; } setSqaAction('reject'); setSqaModalOpen(true); }}>审核拒绝</Button>
        </Space>
      </Card>

      <Modal title={sqaAction === 'approve' ? 'SQA审核通过确认' : 'SQA审核拒绝确认'} open={sqaModalOpen} onCancel={() => setSqaModalOpen(false)}
        onOk={() => {
          message.success(sqaAction === 'approve' ? 'SQA审核已通过，流水线进入信息变更阶段' : 'SQA审核已拒绝，流水线回退至维护审核')
          setSqaModalOpen(false); props.setTransferView(null)
        }}
        okButtonProps={{ danger: sqaAction === 'reject', style: sqaAction === 'approve' ? { background: '#52c41a', borderColor: '#52c41a' } : {} }}
        okText="确认"
      >
        <p>{sqaAction === 'approve' ? '确认通过SQA审核？流水线将进入信息变更阶段。' : '确认拒绝SQA审核？流水线将回退至维护审核阶段。'}</p>
        {sqaComment && <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 6, marginTop: 8 }}><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>SQA意见：</div><div>{sqaComment}</div></div>}
      </Modal>
    </div>
  )
}
