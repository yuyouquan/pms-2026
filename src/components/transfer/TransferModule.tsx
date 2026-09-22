'use client'

import { useEffect, useState, type Key, type ReactNode } from 'react'
import dayjs from 'dayjs'
import { Alert, Anchor, Avatar, Badge, Button, Card, Col, Collapse, DatePicker, Descriptions, Empty, Form, Image, Input, Modal, Popconfirm, Popover, Progress, Row, Segmented, Select, Space, Table, Tabs, Tag, Timeline, Tooltip, message } from 'antd'
import { ArrowLeftOutlined, AuditOutlined, CheckCircleOutlined, CloseCircleOutlined, CopyOutlined, EditOutlined, FileTextOutlined, HistoryOutlined, PlusOutlined, PushpinOutlined, SafetyOutlined, StopOutlined, SwapOutlined, SyncOutlined, TeamOutlined } from '@ant-design/icons'
import { ALL_USERS } from '@/constants/permissions'
import { MOCK_TM_USERS, ROLE_COLORS, getCurrentNodeLabel, getCurrentNodeStatus, getPipelinePercent, buildCloseReviewRows, type TransferApplication, type CheckListItem, type ReviewElement, type BlockTask, type LegacyTask, type TMTeamMember, type HistoryRecord } from '@/mock/transfer-maintenance'
import { matchesTransferProject, matchesTransferActor, canEnterTransferItem, canReviewTransferItem, canManageTransfer, canCloseTransfer, canEditTransferLegacy, canResolveTransferLegacy, canDelegateTransferItem, getMaintenanceSpmReviewAccess, createTransferMaterials, getMissingTransferTeamRoles, syncTransferPipeline, type TransferItem } from '@/lib/transferWorkflow'
import { getTransferProjectType, getTransferMember, getCurrentTransferTemplates } from '@/lib/transferConfig'
import { useTransferStore } from '@/stores/transfer'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { getTransferAiCheckResult } from '@/lib/transferAiCheck'
import { getInitialTransferTeam } from '@/lib/transferProjectTeam'
import type { ColumnsType } from 'antd/es/table'
import { useTransferColumnSearch } from '@/components/transfer/useTransferColumnSearch'
import { TransferEntryExchange } from '@/components/transfer/TransferEntryExchange'
import { TransferPipelineProgress } from '@/components/transfer/TransferPipelineProgress'
import { getTransferRoleSubmission, canAppendTransferRoleLegacy, inheritTransferMaterialContent, canAssignTransferParticipant, getTransferDelegateAssignee, getTransferParticipantLabel, getTransferAiDetail, getTransferContentHref } from '@/components/transfer/transferInteraction'

export { TransferConfig } from '@/components/transfer/TransferConfig'
const { TextArea } = Input
export interface TransferModuleProps {
  // Project context
  selectedProject: { id: string; name: string; [key: string]: any } | null
  currentUser: { id: string; name: string; [key: string]: any }
  canApplyTransfer?: boolean
  canViewTransfer?: boolean

  // Transfer view navigation
  transferView: null | 'apply' | 'detail' | 'entry' | 'review' | 'maintenance-spm-review'
  setTransferView: (v: null | 'apply' | 'detail' | 'entry' | 'review' | 'maintenance-spm-review') => void

  // Transfer config
  transferConfigView: 'home' | 'checklist' | 'review' | 'team'
  setTransferConfigView: (v: 'home' | 'checklist' | 'review' | 'team') => void
  configSidebarCollapsed?: boolean
  setConfigSidebarCollapsed?: (value: boolean) => void
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


const STATUS: Record<string, { color: string; label: string }> = {
  in_progress: { color: 'processing', label: '进行中' }, completed: { color: 'success', label: '已完成' }, cancelled: { color: 'default', label: '已关闭' }, failed: { color: 'error', label: '已失败' },
  not_entered: { color: 'default', label: '未录入' }, draft: { color: 'orange', label: '暂存' }, entered: { color: 'success', label: '已录入' },
  not_started: { color: 'default', label: '未开始' }, success: { color: 'success', label: '已完成' },
  passed: { color: 'success', label: '通过' }, rejected: { color: 'error', label: '不通过' }, reviewing: { color: 'processing', label: '审核中' }, not_reviewed: { color: 'default', label: '未审核' },
  open: { color: 'warning', label: '待处理' }, resolved: { color: 'success', label: '已完成' },
}
const tag = (value: string) => <Tag color={STATUS[value]?.color}>{STATUS[value]?.label || value}</Tag>
const stamp = () => new Date().toISOString()
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const when = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
const people: TMTeamMember[] = ALL_USERS.map(name => { const known = MOCK_TM_USERS.find(person => person.name === name); return { id: `login-${name}`, name, role: known?.role || '', department: known?.department || '' } })
function useAssignableTransferPeople(project: TransferModuleProps['selectedProject']) {
  usePermissionStore()
  return people.filter(person => canAssignTransferParticipant(person, project))
}
const personName = (id: string) => people.find(person => person.id === id)?.name || MOCK_TM_USERS.find(person => person.id === id)?.name || id.replace(/^login-/, '')
const history = (appId: string, actor: TransferModuleProps['currentUser'], action: string, detail: string): HistoryRecord => ({ id: uid('history'), applicationId: appId, action, operator: actor.name, detail, timestamp: stamp() })
const getApp = (props: TransferModuleProps) => props.transferApplications.find(app => app.id === props.selectedTransferAppId && matchesTransferProject(app, props.selectedProject))
const freshApp = (props: TransferModuleProps, id = props.selectedTransferAppId) => useTransferStore.getState().transferApplications.find(app => app.id === id && matchesTransferProject(app, props.selectedProject))
const scopeKey = (props: TransferModuleProps) => `${props.currentUser.id}:${props.currentUser.name}:${props.selectedProject?.id}:${props.selectedTransferAppId}:${props.canViewTransfer}:${props.canApplyTransfer}`
const canView = (props: TransferModuleProps) => Boolean(props.canViewTransfer)
function LongText({ value, lines = 3 }: { value?: string; lines?: number }) {
  if (!value?.trim()) return <span>-</span>
  const content = <Space orientation="vertical" size={8} style={{ maxWidth: 560 }}><div style={{ maxHeight: '50vh', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{value}</div><Button type="text" size="small" icon={<CopyOutlined />} aria-label="复制完整内容" onClick={async event => { event.stopPropagation(); try { await navigator.clipboard.writeText(value); message.success('已复制') } catch { message.error('复制失败，请手动选中文本复制') } }}>复制</Button></Space>
  return <Popover placement="topLeft" trigger={['hover', 'click', 'focus']} content={content}><span tabIndex={0} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden', cursor: 'pointer' }}>{value}</span></Popover>
}
function Personnel({ name, delegates, side }: { name: string; delegates?: string[]; side: '录入' | '审核' }) {
  return <Space orientation="vertical" size={3} style={{ maxWidth: '100%' }}><span>{name || '-'} {Boolean(delegates?.length) && <Tag color="purple">已委派</Tag>}</span>{delegates?.map(id => <Tag key={id} color="blue" style={{ maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{side}委派→{personName(id)}</Tag>)}</Space>
}
function EntryContent({ item }: { item: TransferItem }) {
  const segments = (item.entryContent || '').split(/(https?:\/\/[^\s，。、；！？]+|\\\\[^\s，。、；！？]+)/g)
  return <Space orientation="vertical" size={4}><Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{item.entryContent}</span>}><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}>{segments.map((segment, index) => getTransferContentHref(segment) ? <a key={index} href={getTransferContentHref(segment)} target="_blank" rel="noopener noreferrer">{segment}</a> : <span key={index}>{segment}</span>)}{!item.entryContent && '-'}</div></Tooltip>{item.deliverables.map(file => <a key={file.id} href={getTransferContentHref(file.url)} target="_blank" rel="noopener noreferrer">{file.name}</a>)}</Space>
}
function MiniPipeline({ app }: { app: TransferApplication }) {
  if (app.status === 'cancelled' || app.status === 'failed') return tag(app.status)
  return <Space style={{ width: '100%' }}><Progress percent={getPipelinePercent(app)} size="small" showInfo={false} strokeColor={getCurrentNodeStatus(app) === 'failed' ? '#ff4d4f' : 'var(--pms-brand)'} style={{ width: 100 }} /><Tag>{getCurrentNodeLabel(app)}</Tag></Space>
}
function PageHeading({ props, app, title, compact = false, children }: { props: TransferModuleProps; app: TransferApplication; title: string; compact?: boolean; children?: ReactNode }) {
  useEffect(() => { document.getElementById('basic-info-scroll-container')?.scrollTo({ top: 0 }) }, [app.id, title])
  return <header className={`pms-transfer-heading${compact ? ' pms-transfer-heading--compact' : ''}`}>
    <Button icon={<ArrowLeftOutlined />} onClick={() => props.setTransferView(null)}>返回</Button>
    <h2>{title === '维护SPM审核' && <SafetyOutlined style={{ color: 'var(--warning)', marginRight: 8 }} />}{title}</h2>
    {compact && <span className="pms-transfer-heading__project">{app.projectName}</span>}
    {children}
  </header>
}
function PipelinePanel({ app, compact = false }: { app: TransferApplication; compact?: boolean }) {
  return <Card id="transfer-pipeline" className={`pms-solid-surface pms-transfer-pipeline-card${compact ? ' pms-transfer-pipeline-card--compact' : ''}`}><TransferPipelineProgress pipeline={app.pipeline} /></Card>
}
const AI_STATUS: Record<TransferItem['aiCheckStatus'], { color: string; label: string }> = {
  not_started: { color: 'default', label: '未开始' }, in_progress: { color: 'processing', label: '检查中' }, passed: { color: 'success', label: '通过' }, failed: { color: 'error', label: '不通过' },
}
function materialColumns(kind: 'checklist' | 'review', options: { view?: 'entry' | 'review' | 'detail'; search?: ReturnType<typeof useTransferColumnSearch>; onAiDetail?: (item: TransferItem) => void; onRejected?: (item: TransferItem) => void; aiFailuresOnly?: boolean; showAiRule?: boolean } = {}): ColumnsType<TransferItem> {
  const search = options.search
  const detail = !options.view || options.view === 'detail'
  const statusFilter = (field: 'entryStatus' | 'aiCheckStatus', values: { text: string; value: string }[]) => ({ filters: values, onFilter: (value: Key | boolean, item: TransferItem) => item[field] === String(value) })
  return [
    { title: '序号', dataIndex: 'seq', width: 60, align: 'center' },
    ...(kind === 'checklist' ? [...(detail ? [] : [{ title: '类型', dataIndex: 'type', width: 80 }]), { title: detail ? '检查项目名称' : '标准', dataIndex: 'checkItem', width: detail ? 300 : 260, render: (value: string) => <LongText value={value} lines={1} />, ...search?.('checkItem', '检查项目名称') }] : [{ title: '标准', dataIndex: 'standard', width: 140, render: (value: string) => <LongText value={value} lines={1} /> }, { title: '评审要素', dataIndex: 'description', width: 220, render: (value: string) => <LongText value={value} lines={1} />, ...search?.('description', '评审要素') }, { title: '模板备注', dataIndex: 'remark', width: 150, render: (value: string) => <LongText value={value} lines={1} /> }]),
    { title: detail ? '所属角色' : '责任角色', dataIndex: 'responsibleRole', width: 80, align: 'center' },
    { title: detail ? '录入人员' : '资料录入-责任人', width: 140, render: (_: unknown, item: TransferItem) => <Personnel name={item.entryPerson} delegates={item.delegatedTo} side="录入" /> },
    { title: detail ? '审核人员' : '人工审核-责任人', width: 120, render: (_: unknown, item: TransferItem) => <Personnel name={item.reviewPerson} delegates={item.reviewDelegatedTo} side="审核" /> },
    ...(options.showAiRule ? [{ title: '智能检查规则', dataIndex: 'aiCheckRule', width: 200, render: (value: string) => <LongText value={value} lines={1} /> }] : []),
    { title: '交付件', width: 180, render: (_: unknown, item: TransferItem) => <EntryContent item={item} /> },
    { title: '录入状态', dataIndex: 'entryStatus', width: 90, render: tag, ...(search ? statusFilter('entryStatus', [{ text: '未录入', value: 'not_entered' }, { text: '暂存', value: 'draft' }, { text: '已录入', value: 'entered' }]) : {}) },
    { title: 'AI检查状态', dataIndex: 'aiCheckStatus', width: 100, ...(search ? statusFilter('aiCheckStatus', Object.entries(AI_STATUS).map(([value, status]) => ({ value, text: status.label }))) : {}), render: (value: TransferItem['aiCheckStatus'], item: TransferItem) => {
      const status = AI_STATUS[value]
      const badge = <Tag color={status.color}>{status.label}</Tag>
      return options.onAiDetail && value !== 'not_started' && (!options.aiFailuresOnly || value === 'failed') ? <Button type="text" size="small" aria-label={`查看AI检查详情：${'checkItem' in item ? item.checkItem : item.description}`} style={{ padding: 0 }} onClick={() => options.onAiDetail?.(item)}>{badge}</Button> : badge
    } },
    { title: '维护审核状态', dataIndex: 'reviewStatus', width: 110, render: (value: string, item: TransferItem) => options.onRejected && value === 'rejected' ? <Button type="text" size="small" aria-label="查看审核意见" style={{ padding: 0 }} onClick={() => options.onRejected?.(item)}>{tag(value)}</Button> : tag(value) },
    { title: '备注', width: 170, render: (_: unknown, item: TransferItem) => <LongText value={[item.reviewRemark, item.reviewComment].filter(Boolean).join('；')} lines={1} /> },
  ]
}
function recordUpdate(props: TransferModuleProps, appId: string, ids: string[], update: (item: TransferItem) => TransferItem, action: string, detail: string) {
  useTransferStore.setState(state => {
    const checklist = state.tmChecklistItems.map(item => item.applicationId === appId && ids.includes(item.id) ? update(item) as CheckListItem : item)
    const elements = state.tmReviewElements.map(item => item.applicationId === appId && ids.includes(item.id) ? update(item) as ReviewElement : item)
    return { tmChecklistItems: checklist, tmReviewElements: elements, transferApplications: state.transferApplications.map(app => app.id === appId ? syncTransferPipeline(app, checklist, elements) : app), tmHistory: [...state.tmHistory, history(appId, props.currentUser, action, detail)] }
  })
}
function canOpenItems(props: TransferModuleProps, app: TransferApplication, side: 'entry' | 'review') {
  if (!canView(props) || app.status !== 'in_progress' || app.pipeline.maintenanceSpmReview === 'success') return false
  const items = [...props.tmChecklistItems, ...props.tmReviewElements].filter(item => item.applicationId === app.id)
  if (side === 'review' && items.some(item => canAppendTransferRoleLegacy(app, item.responsibleRole, items, props.currentUser, props.selectedProject, canView(props)))) return true
  return items.some(item => {
    if (canDelegateTransferItem(app, item, props.currentUser, props.selectedProject, side)) return true
    if (side === 'entry' ? canEnterTransferItem(app, item, props.currentUser, props.selectedProject) : canReviewTransferItem(app, item, props.currentUser, props.selectedProject)) return true
    const member = getTransferMember(app.team[side === 'entry' ? 'research' : 'maintenance'], item.responsibleRole, app.teamConfig)
    if (!matchesTransferActor(props.currentUser, member?.id, member?.name)) return false
    return side === 'entry' ? ['not_reviewed', 'rejected'].includes(item.reviewStatus) : app.pipeline.maintenanceReview === 'in_progress' && ['reviewing', 'rejected'].includes(item.reviewStatus)
  })
}
function ActorAlert() { return <Alert type="warning" showIcon message="当前用户、任务或流程阶段已变更，请返回后重新选择" /> }

export function TransferWorkbench(props: TransferModuleProps & { embedded?: boolean }) {
  const [closingId, setClosingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const key = scopeKey(props)
  useEffect(() => { setClosingId(null); setReason('') }, [key])
  if (!canView(props)) return <Empty description="暂无转维信息查看权限" />
  const apps = props.transferApplications.filter(app => matchesTransferProject(app, props.selectedProject))
  const go = (app: TransferApplication, view: TransferModuleProps['transferView']) => { props.setSelectedTransferAppId(app.id); props.setTransferView(view) }
  const reopen = (app: TransferApplication) => {
    if (!canManageTransfer(app, props.currentUser, props.selectedProject, Boolean(props.canApplyTransfer))) return
    useTransferStore.getState().setTmReopenAppId(app.id)
    props.setTransferView('apply')
  }
  const table = <><Table className="pms-table pms-transfer-surface" dataSource={apps} rowKey="id" size="small" pagination={false} scroll={{ x: 1100 }} columns={[
    { title: '项目名称', dataIndex: 'projectName', width: 220, render: (name: string, app) => <><div style={{ fontWeight: 500 }}>{name}</div><span style={{ color: '#9ca3af', fontSize: 12 }}>{app.applicant} · {app.createdAt.slice(0, 10)}</span></> },
    { title: '流水线进度', width: 210, render: (_: unknown, app) => <MiniPipeline app={app} /> },
    { title: '计划评审日期', dataIndex: 'plannedReviewDate', width: 120 },
    { title: '角色进度', width: 200, render: (_: unknown, app) => ['failed', 'cancelled'].includes(app.status) ? '-' : <Space size={4} wrap>{app.pipeline.roleProgress.map(role => <Tag key={role.role} color={role.reviewStatus === 'completed' ? 'success' : role.reviewStatus === 'rejected' ? 'error' : role.entryStatus === 'in_progress' || role.entryStatus === 'completed' || role.reviewStatus === 'in_progress' ? 'processing' : 'default'}>{role.role}</Tag>)}</Space> },
    { title: '操作', width: 300, render: (_: unknown, app) => { const items = [...props.tmChecklistItems, ...props.tmReviewElements].filter(item => item.applicationId === app.id); const final = getMaintenanceSpmReviewAccess(app, props.currentUser, props.selectedProject); const manage = canManageTransfer(app, props.currentUser, props.selectedProject, Boolean(props.canApplyTransfer)); return <Space size={0} wrap>
      <Button size="small" type="link" onClick={() => go(app, 'detail')}>详情</Button>
      {canOpenItems(props, app, 'entry') && <Button size="small" type="link" onClick={() => go(app, 'entry')}>录入</Button>}
      {canOpenItems(props, app, 'review') && <Button size="small" type="link" onClick={() => go(app, 'review')}>评审</Button>}
      {(final.canApprove || final.canReject) && <Button size="small" type="link" onClick={() => go(app, 'maintenance-spm-review')}>维护SPM审核</Button>}
      {canCloseTransfer(app, props.currentUser, props.selectedProject, Boolean(props.canApplyTransfer)) && <Button size="small" type="link" danger onClick={() => { setClosingId(app.id); setReason('') }}>关闭</Button>}
      {manage && app.status === 'failed' && !app.reopenedAsId && !apps.some(row => ['in_progress', 'completed'].includes(row.status)) && <Button size="small" type="link" onClick={() => reopen(app)}>重新发起</Button>}
    </Space> } },
  ]} /><Modal className="pms-modal pms-transfer-surface" title="关闭转维流水线" open={Boolean(closingId)} onCancel={() => setClosingId(null)} okText="确认关闭" okButtonProps={{ danger: true }} onOk={() => {
    const app = freshApp(props, closingId)
    if (!canView(props) || !app || !canCloseTransfer(app, props.currentUser, props.selectedProject, Boolean(props.canApplyTransfer))) { message.warning('当前无权关闭该申请'); return }
    if (!reason.trim()) { message.warning('请输入关闭原因'); return }
    useTransferStore.setState(state => ({ transferApplications: state.transferApplications.map(row => row.id === app.id ? { ...row, status: 'cancelled', cancelReason: reason.trim(), updatedAt: stamp() } : row), tmHistory: [...state.tmHistory, history(app.id, props.currentUser, '关闭流水线', reason.trim())] }))
    setClosingId(null); message.success('已关闭转维流水线')
  }}><Descriptions column={1} size="small"><Descriptions.Item label="项目名称">{apps.find(row => row.id === closingId)?.projectName}</Descriptions.Item></Descriptions>{(() => { const closing = apps.find(row => row.id === closingId); return closing && closing.pipeline.roleProgress.some(role => role.reviewStatus !== 'not_started') ? <Table size="small" rowKey="role" pagination={false} dataSource={buildCloseReviewRows(closing, props.tmChecklistItems, props.tmReviewElements)} columns={[{ title: '角色', dataIndex: 'role' }, { title: '责任人', dataIndex: 'responsiblePerson' }, { title: '审核结论', dataIndex: 'conclusion' }, { title: '评审意见', dataIndex: 'comment', render: (value: string) => <LongText value={value} /> }]} style={{ marginBottom: 16 }} /> : null })()}<Alert type="warning" showIcon message="关闭后停止当前流水线，保留录入资料和历史记录。" style={{ marginBottom: 16 }} /><TextArea maxLength={500} showCount aria-label="关闭原因" placeholder="请输入关闭原因" rows={4} value={reason} onChange={event => setReason(event.target.value)} /></Modal></>
  if (props.embedded) return table
  return <Card className="pms-solid-surface" title="转维管理" extra={<Button type="primary" icon={<PlusOutlined />} disabled={!props.canApplyTransfer || apps.some(app => ['in_progress', 'completed'].includes(app.status))} onClick={() => { useTransferStore.getState().setTmReopenAppId(null); props.setTransferView('apply') }}>申请转维</Button>}>{table}</Card>
}

export function TransferApply(props: TransferModuleProps) {
  const selectablePeople = useAssignableTransferPeople(props.selectedProject)
  const store = useTransferStore()
  const projectType = getTransferProjectType(props.selectedProject)
  const config = store.tmTeamConfigs[projectType]
  const source = store.transferApplications.find(app => app.id === store.tmReopenAppId)
  useEffect(() => {
    if (source && matchesTransferProject(source, props.selectedProject)) {
      props.setTmApplyDate(source.plannedReviewDate); props.setTmApplyRemark(source.remark)
      const inheritTeam = (side: 'research' | 'maintenance') => config.flatMap(role => {
        const previousRole = source.teamConfig?.find(row => row.id === role.id)
        const member = getTransferMember(source.team[side], previousRole?.roleName || role.roleName, source.teamConfig)
        return member ? [{ ...member, role: role.roleName, ipmRoleCode: role.ipmRoleCode }] : []
      })
      props.setTmApplyTeam({ research: inheritTeam('research'), maintenance: inheritTeam('maintenance') })
    } else if (props.selectedProject) {
      props.setTmApplyDate(''); props.setTmApplyRemark(''); props.setTmApplyTeam(getInitialTransferTeam(props.selectedProject, config))
    }
  }, [source?.id, props.selectedProject?.id, props.currentUser.id])
  const [submitting, setSubmitting] = useState(false)
  const cancel = () => { store.setTmReopenAppId(null); props.setTransferView(null) }
  const submit = () => {
    if (submitting) return
    const state = useTransferStore.getState()
    const currentConfig = state.tmTeamConfigs[projectType]
    const predecessor = state.tmReopenAppId ? state.transferApplications.find(app => app.id === state.tmReopenAppId) : undefined
    if (!props.selectedProject || !props.canApplyTransfer || !canView(props)) { message.warning('暂无申请权限'); return }
    if (predecessor && (!matchesTransferProject(predecessor, props.selectedProject) || predecessor.status !== 'failed' || predecessor.reopenedAsId || !canManageTransfer(predecessor, props.currentUser, props.selectedProject, Boolean(props.canApplyTransfer)))) { message.warning('当前不可重新发起该申请'); return }
    if (state.transferApplications.some(app => matchesTransferProject(app, props.selectedProject) && ['in_progress', 'completed'].includes(app.status))) { message.warning('当前项目已有进行中或已完成的转维申请'); return }
    if (!state.tmApplyDate) { message.warning('请选择计划评审日期'); return }
    const missing = getMissingTransferTeamRoles(state.tmApplyTeam, currentConfig)
    if (missing.length) { message.warning(`请选择${missing.join('、')}成员`); return }
    const now = stamp()
    const team = { research: currentConfig.flatMap(role => { const member = getTransferMember(state.tmApplyTeam.research, role.roleName, currentConfig); return member ? [{ ...member, role: role.roleName, ipmRoleCode: role.ipmRoleCode }] : [] }), maintenance: currentConfig.flatMap(role => { const member = getTransferMember(state.tmApplyTeam.maintenance, role.roleName, currentConfig); return member ? [{ ...member, role: role.roleName, ipmRoleCode: role.ipmRoleCode }] : [] }) }
    const unavailable = [...new Set([...team.research, ...team.maintenance].filter(member => !canAssignTransferParticipant(member, props.selectedProject)).map(member => member.name))]
    if (unavailable.length) { message.warning(`以下成员已无当前项目转维查看权限，请重新选择：${unavailable.join('、')}`); return }
    setSubmitting(true)
    const application: TransferApplication = { id: uid('transfer'), projectId: props.selectedProject.id, projectName: props.selectedProject.name, projectType, teamConfig: currentConfig.map(role => ({ ...role })), templateVersionIds: { checklist: state.tmTemplateVersions[projectType].checklist.at(-1)?.id || '', review: state.tmTemplateVersions[projectType].review.at(-1)?.id }, finalReviewRole: currentConfig.find(role => role.id === 'spm')?.roleName || 'SPM', applicant: props.currentUser.name, applicantId: props.currentUser.id, team, plannedReviewDate: state.tmApplyDate, remark: state.tmApplyRemark.trim(), status: 'in_progress', predecessorId: predecessor?.id, pipeline: { projectInit: 'success', dataEntry: 'in_progress', maintenanceReview: 'not_started', maintenanceSpmReview: 'not_started', infoChange: 'not_started', roleProgress: currentConfig.map(role => ({ role: role.roleName, entryStatus: 'not_started', reviewStatus: 'not_started' })) }, createdAt: now, updatedAt: now }
    const materials = createTransferMaterials(application, getCurrentTransferTemplates(projectType, state.tmTemplateVersions))
    const inheritedChecklist = predecessor ? inheritTransferMaterialContent(predecessor, application, materials.checklist, state.tmChecklistItems) : materials.checklist
    const inheritedReview = predecessor ? inheritTransferMaterialContent(predecessor, application, materials.reviewElements, state.tmReviewElements) : materials.reviewElements
    useTransferStore.setState(previous => ({ transferApplications: [application, ...previous.transferApplications.map(row => row.id === predecessor?.id ? { ...row, reopenedAsId: application.id, updatedAt: now } : row)], tmChecklistItems: [...previous.tmChecklistItems, ...inheritedChecklist], tmReviewElements: [...previous.tmReviewElements, ...inheritedReview], tmHistory: [...previous.tmHistory, history(application.id, props.currentUser, predecessor ? '重新发起转维' : '发起转维', predecessor ? `继承申请 ${predecessor.id} 的录入内容，按当前模板重新审核` : `按${projectType}团队与当前模板发起转维`)], selectedTransferAppId: application.id, tmReopenAppId: null }))
    if (predecessor) window.setTimeout(() => {
      useTransferStore.setState(current => {
        const target = current.transferApplications.find(row => row.id === application.id)
        if (!target || target.status !== 'in_progress') return current
        const recheck = <T extends TransferItem>(item: T): T => item.applicationId === target.id && item.aiCheckStatus === 'in_progress' ? { ...item, ...getTransferAiCheckResult() } : item
        const checklist = current.tmChecklistItems.map(recheck); const review = current.tmReviewElements.map(recheck)
        return { tmChecklistItems: checklist, tmReviewElements: review, transferApplications: current.transferApplications.map(row => row.id === target.id ? syncTransferPipeline(row, checklist, review) : row) }
      })
    }, 700)
    props.setTransferView('detail'); message.success(predecessor ? '已重新发起，录入内容已保留并重新进行模拟AI检查' : '转维申请已提交')
  }
  return <Modal className="pms-modal pms-transfer-surface" title={<Space><SwapOutlined />{source ? '重新发起转维' : '申请转维'}</Space>} open width={940} onCancel={cancel} onOk={submit} okText="提交申请" confirmLoading={submitting} destroyOnHidden>
    {source && <Alert type="warning" showIcon message="基于已终止的转维申请重新发起" description={<><div>原申请维护SPM驳回原因：{source.failureReason || '（无）'}</div><div style={{ marginTop: 4 }}>按当前团队和最新模板创建新流水线；匹配的材料会回填录入内容，新增项留空，删除项不再出现，AI检查和维护审核将重新进行。</div></>} style={{ marginBottom: 16 }} />}
    <Form layout="vertical"><Row gutter={16}><Col span={16}><Form.Item label="项目名称" required><Input value={props.selectedProject?.name} disabled /></Form.Item></Col><Col span={8}><Form.Item label="项目类型"><Input value={projectType} disabled /></Form.Item></Col></Row><Form.Item label="计划评审日期" required><DatePicker aria-label="计划评审日期" format="YYYY-MM-DD" value={store.tmApplyDate ? dayjs(store.tmApplyDate) : null} onChange={date => store.setTmApplyDate(date?.format('YYYY-MM-DD') || '')} style={{ width: '100%' }} /></Form.Item><Form.Item label="备注"><TextArea maxLength={500} showCount rows={3} placeholder="请输入备注信息" value={store.tmApplyRemark} onChange={event => store.setTmApplyRemark(event.target.value)} /></Form.Item></Form>
    <Row gutter={16}>{(['research', 'maintenance'] as const).map(side => <Col span={12} key={side}><Card className="pms-transfer-team-form" size="small" title={side === 'research' ? '在研团队' : '维护团队'}>{config.map(role => { const member = getTransferMember(store.tmApplyTeam[side], role.roleName, config); return <div key={role.id} className="pms-transfer-team-form__row"><Tooltip title={`IPM角色编码：${role.ipmRoleCode}`}><Tag color="purple" style={{ minWidth: 72 }}>{role.roleName}</Tag></Tooltip><Select aria-label={`${side === 'research' ? '在研' : '维护'}${role.roleName}`} allowClear showSearch optionFilterProp="label" placeholder="选择成员" style={{ flex: 1, minWidth: 0 }} value={member?.id} options={selectablePeople.map(user => ({ value: user.id, label: `${user.name}（${user.department}）` }))} onChange={id => { if (!id) { store.setTmApplyTeam(previous => ({ ...previous, [side]: previous[side].filter(row => row !== getTransferMember(previous[side], role.roleName, config)) })); return }; const user = selectablePeople.find(person => person.id === id); if (!user || !canAssignTransferParticipant(user, props.selectedProject)) return; store.setTmApplyTeam(previous => ({ ...previous, [side]: [...previous[side].filter(row => row !== getTransferMember(previous[side], role.roleName, config)), { ...user, role: role.roleName, ipmRoleCode: role.ipmRoleCode }] })) }} /></div> })}</Card></Col>)}</Row>
    <TransferGuides isTos={projectType === 'tOS版本项目'} />
  </Modal>
}

type TaskDraft = { responsiblePerson: string; department: string; description: string; deadline: string; resolution: string }
const blankTask = (): TaskDraft => ({ responsiblePerson: '', department: '', description: '', deadline: '', resolution: '' })
function TaskForms({ tasks, setTasks, block }: { tasks: TaskDraft[]; setTasks: (tasks: TaskDraft[]) => void; block: boolean }) {
  const update = (index: number, field: keyof TaskDraft, value: string) => setTasks(tasks.map((task, current) => current === index ? { ...task, [field]: value } : task))
  return <Space orientation="vertical" style={{ width: '100%' }} size={12}>{tasks.map((task, index) => <Card key={index} size="small" title={`${block ? 'Block' : '遗留'}任务 ${index + 1}`} extra={tasks.length > 1 ? <Button danger size="small" type="text" onClick={() => setTasks(tasks.filter((_, row) => row !== index))}>移除</Button> : null}>
    <Form layout="vertical"><Row gutter={12}><Col span={12}><Form.Item label="责任人" required><Select showSearch optionFilterProp="label" aria-label={`任务${index + 1}责任人`} placeholder="选择责任人" value={task.responsiblePerson || undefined} options={people.map(person => ({ value: person.name, label: person.name }))} onChange={name => { const person = people.find(row => row.name === name); setTasks(tasks.map((row, current) => current === index ? { ...row, responsiblePerson: name, department: person?.department || '' } : row)) }} /></Form.Item></Col><Col span={12}><Form.Item label="部门" required><Input aria-label={`任务${index + 1}部门`} value={task.department} onChange={event => update(index, 'department', event.target.value)} /></Form.Item></Col></Row>
      <Form.Item label={block ? '问题描述' : '任务描述'} required><TextArea aria-label={`任务${index + 1}描述`} rows={3} value={task.description} onChange={event => update(index, 'description', event.target.value)} /></Form.Item>
      {block && <Form.Item label="解决方案" required><TextArea aria-label={`任务${index + 1}解决方案`} rows={3} value={task.resolution} onChange={event => update(index, 'resolution', event.target.value)} /></Form.Item>}
      <Form.Item label="截止日期" required><DatePicker aria-label={`任务${index + 1}截止日期`} format="YYYY-MM-DD" value={task.deadline ? dayjs(task.deadline) : null} onChange={date => update(index, 'deadline', date?.format('YYYY-MM-DD') || '')} style={{ width: '100%' }} /></Form.Item>
    </Form></Card>)}<Button icon={<PlusOutlined />} onClick={() => setTasks([...tasks, blankTask()])}>添加{block ? 'Block' : '遗留'}任务</Button></Space>
}
const tasksComplete = (tasks: TaskDraft[], block = false) => tasks.length > 0 && tasks.every(task => task.description.trim() && task.responsiblePerson && task.department.trim() && task.deadline && (!block || task.resolution.trim()))
function TaskPanels({ props, app, editLegacy = false, resolveLegacy = false }: { props: TransferModuleProps; app: TransferApplication; editLegacy?: boolean; resolveLegacy?: boolean }) {
  const [adding, setAdding] = useState(false)
  const [resolvePrompt, setResolvePrompt] = useState<{ taskId: string; scope: string } | null>(null)
  const [tasks, setTasks] = useState<TaskDraft[]>([blankTask()])
  const key = scopeKey(props)
  useEffect(() => { setAdding(false); setTasks([blankTask()]); setResolvePrompt(null) }, [key])
  const allowed = editLegacy && canView(props) && canEditTransferLegacy(app, props.currentUser, props.selectedProject)
  const taskColumns = (block: boolean) => [
    { title: '序号', width: 60, render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: block ? '问题描述' : '任务描述', dataIndex: 'description', width: 230, render: (value: string) => <LongText value={value} /> },
    ...(block ? [{ title: '解决方案', dataIndex: 'resolution', width: 230, render: (value: string) => <LongText value={value} /> }] : []),
    { title: '责任人', dataIndex: 'responsiblePerson', width: 110 }, { title: '部门', dataIndex: 'department', width: 120 }, { title: '截止日期', dataIndex: 'deadline', width: 120 },
    { title: '状态', dataIndex: 'status', width: 130, render: (value: string, task: LegacyTask) => !block && allowed ? <Select aria-label={`${task.description}状态`} value={value as LegacyTask['status']} style={{ width: 115 }} options={[{ value: 'open', label: '待处理' }, { value: 'resolved', label: '已完成' }, { value: 'cancelled', label: '已取消' }]} onChange={(status: LegacyTask['status']) => {
      const current = freshApp(props, app.id)
      if (!canView(props) || !current || !canEditTransferLegacy(current, props.currentUser, props.selectedProject)) { message.warning('当前不可编辑遗留任务'); return }
      useTransferStore.setState(state => ({ tmLegacyTasks: state.tmLegacyTasks.map(row => row.id === task.id && row.applicationId === app.id ? { ...row, status } : row), tmHistory: [...state.tmHistory, history(app.id, props.currentUser, '更新遗留任务', `${task.description}：${STATUS[status]?.label || status}`)] }))
    }} /> : tag(value) },
    { title: '创建时间', dataIndex: 'createdAt', width: 120, render: (value: string) => value?.slice(0, 10) || '-' },
    ...(!block && resolveLegacy ? [{ title: '操作', width: 140, render: (_: unknown, task: LegacyTask) => canResolveTransferLegacy(app, task, props.currentUser, props.selectedProject, canView(props)) ? <Popconfirm title="标记任务为已解决" description="确认该遗留任务已解决？操作后状态将更新为「已解决」。" okText="确认已解决" cancelText="取消" open={resolvePrompt?.taskId === task.id} onOpenChange={open => setResolvePrompt(open ? { taskId: task.id, scope: key } : null)} onConfirm={() => {
      const current = freshApp(props, app.id)
      const latest = useTransferStore.getState().tmLegacyTasks.find(row => row.id === task.id && row.applicationId === app.id)
      if (resolvePrompt?.scope !== key || !current || !latest || !canResolveTransferLegacy(current, latest, props.currentUser, props.selectedProject, canView(props))) { setResolvePrompt(null); message.warning('当前任务、责任人或权限已变更，无法标记已解决'); return }
      useTransferStore.setState(state => ({ tmLegacyTasks: state.tmLegacyTasks.map(row => row.id === latest.id && row.applicationId === current.id ? { ...row, status: 'resolved' as const } : row), tmHistory: [...state.tmHistory, history(current.id, props.currentUser, '遗留任务已解决', latest.description)] }))
      setResolvePrompt(null); message.success('已标记为已解决')
    }}><Button type="link" size="small" icon={<CheckCircleOutlined />}>标记已解决</Button></Popconfirm> : '-' }] : []),
  ]
  return <><Card id="transfer-block" title="Block任务列表" style={{ marginBottom: 16 }}><Table<BlockTask> className="pms-table" rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} dataSource={props.tmBlockTasks.filter(task => task.applicationId === app.id)} columns={taskColumns(true)} /></Card>
    <Card id="transfer-legacy" title="遗留任务列表" style={{ marginBottom: 16 }} extra={allowed && <Button icon={<PlusOutlined />} onClick={() => { setAdding(true); setTasks([blankTask()]) }}>添加遗留任务</Button>}><Table<LegacyTask> className="pms-table" rowKey="id" size="small" pagination={false} scroll={{ x: 900 }} dataSource={props.tmLegacyTasks.filter(task => task.applicationId === app.id)} columns={taskColumns(false)} /></Card>
    <Modal className="pms-modal pms-transfer-surface" title="添加遗留任务" open={adding} width={720} onCancel={() => setAdding(false)} okText="保存遗留任务" onOk={() => {
      const current = freshApp(props, app.id)
      if (!canView(props) || !current || !canEditTransferLegacy(current, props.currentUser, props.selectedProject)) { message.warning('当前不可添加遗留任务'); return }
      if (!tasksComplete(tasks)) { message.warning('请填写完整所有遗留任务信息'); return }
      useTransferStore.setState(state => ({ tmLegacyTasks: [...state.tmLegacyTasks, ...tasks.map(task => ({ ...task, id: uid('legacy'), applicationId: app.id, status: 'open' as const, createdAt: stamp() }))], tmHistory: [...state.tmHistory, history(app.id, props.currentUser, '新增遗留任务', `新增 ${tasks.length} 项遗留任务`)] }))
      setAdding(false); message.success('遗留任务已保存')
    }}><TaskForms tasks={tasks} setTasks={setTasks} block={false} /></Modal></>
}
function MaterialPanels({ props, app }: { props: TransferModuleProps; app: TransferApplication }) {
  const [result, setResult] = useState<{ title: string; content: string } | null>(null)
  const key = scopeKey(props)
  useEffect(() => setResult(null), [key])
  const options = { aiFailuresOnly: true, onAiDetail: (item: TransferItem) => setResult({ title: 'AI检查结果', content: getTransferAiDetail(item) || '暂无详情' }), onRejected: (item: TransferItem) => setResult({ title: '审核意见', content: item.reviewComment || item.reviewRemark || '暂无详情' }) }
  return <><Card id="transfer-checklist" title="转维CheckList" style={{ marginBottom: 16 }}><Table<TransferItem> className="pms-table" rowKey="id" size="small" pagination={false} scroll={{ x: 1400 }} dataSource={props.tmChecklistItems.filter(item => item.applicationId === app.id)} columns={materialColumns('checklist', options)} /></Card>{getTransferProjectType(app.projectType || props.selectedProject) !== 'tOS版本项目' && <Card id="transfer-review" title="转维要素评审列表" style={{ marginBottom: 16 }}><Table<TransferItem> className="pms-table" rowKey="id" size="small" pagination={false} scroll={{ x: 1540 }} dataSource={props.tmReviewElements.filter(item => item.applicationId === app.id)} columns={materialColumns('review', options)} /></Card>}<Modal className="pms-modal pms-transfer-surface" title={result?.title} open={Boolean(result)} onCancel={() => setResult(null)} footer={<Button onClick={() => setResult(null)}>关闭</Button>}><div style={{ maxHeight: '60vh', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result?.content}</div></Modal></>
}
function TransferProjectPanels({ props, app }: { props: TransferModuleProps; app: TransferApplication }) {
  return <>
    <Card id="transfer-info" title="项目信息" className="pms-transfer-info">
      <Descriptions column={{ xs: 1, sm: 2, md: 2, lg: 4, xl: 4, xxl: 4, xxxl: 4 }} size="small">
        <Descriptions.Item label="项目名">{app.projectName}</Descriptions.Item>
        <Descriptions.Item label="项目编号">{props.selectedProject?.projectCode || app.projectId}</Descriptions.Item>
        <Descriptions.Item label="项目负责人">{app.applicant}</Descriptions.Item>
        <Descriptions.Item label="转维负责人">{getTransferMember(app.team.maintenance, app.finalReviewRole || 'SPM', app.teamConfig)?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="转维启动时间">{app.createdAt.slice(0, 10)}</Descriptions.Item>
        <Descriptions.Item label="转维截止时间">{app.plannedReviewDate}</Descriptions.Item>
        <Descriptions.Item label="项目状态">{tag(app.status)}</Descriptions.Item>
        <Descriptions.Item label="备注"><LongText value={app.remark} /></Descriptions.Item>
      </Descriptions>
    </Card>
    <div id="transfer-team" className="pms-transfer-teams">{(['research', 'maintenance'] as const).map(side => <Card key={side} size="small" title={side === 'research' ? '在研团队' : '维护团队'}>
      <div className="pms-transfer-team-members">{app.team[side].map(member => <div className="pms-transfer-team-member" key={`${member.id}-${member.role}`}>
        <Avatar size={34} style={{ background: ROLE_COLORS[member.role] || 'var(--pms-brand)', flexShrink: 0 }}>{member.name.slice(-1)}</Avatar>
        <div className="pms-transfer-team-member__text"><div>{member.name}</div><div className="pms-transfer-team-member__role">{member.role} · {member.department || '未配置部门'}</div></div>
      </div>)}</div>
    </Card>)}</div>
  </>
}
function TransferSectionNavigation({ isTos, final = false }: { isTos: boolean; final?: boolean }) {
  const sections = [['pipeline', '流水线'], ['info', '项目信息'], ['team', '团队信息'], ['checklist', 'CheckList'], ...(!isTos ? [['review', '评审要素']] : []), ['block', 'Block任务'], ['legacy', '遗留任务'], final ? ['decision', '维护SPM评审'] : ['history', '历史记录']]
  const icons: Record<string, ReactNode> = { pipeline: <SyncOutlined />, info: <FileTextOutlined />, team: <TeamOutlined />, summary: <AuditOutlined />, checklist: <CheckCircleOutlined />, review: <AuditOutlined />, block: <StopOutlined />, legacy: <PushpinOutlined />, decision: <SafetyOutlined />, history: <HistoryOutlined /> }
  return <nav aria-label="转维页面导航" className="pms-transfer-anchor pms-solid-surface">
    <div className="pms-transfer-anchor__title">页面导航</div>
    <Anchor direction="vertical" affix={false} getCurrentAnchor={active => active || '#transfer-pipeline'} targetOffset={16} getContainer={() => document.getElementById('basic-info-scroll-container') || window} onClick={event => event.preventDefault()} items={sections.map(([id, label]) => ({ key: id, href: `#transfer-${id}`, title: <span className="pms-transfer-anchor__label">{icons[id]}<span>{label}</span></span> }))} />
  </nav>
}
function TransferPageLayout({ children, heading, isTos, final = false }: { children: ReactNode; heading: ReactNode; isTos: boolean; final?: boolean }) {
  return <div className="pms-transfer-overview">{heading}<div className="pms-transfer-page-layout"><div className="pms-transfer-page-content">{children}</div><TransferSectionNavigation isTos={isTos} final={final} /></div></div>
}
function TransferGuides({ isTos }: { isTos: boolean }) {
  const guides = [{ title: '转维流程概览', description: '了解转维流程的整体步骤和关键节点', image: '转维流程概览图' }, { title: '转维CheckList', description: '查看转维所需的检查项和交付物清单', image: '转维CheckList图' }, ...(!isTos ? [{ title: '转维评审要素', description: '了解转维评审的关键评审标准和要素', image: '转维评审要素图' }] : [])]
  return <div style={{ marginTop: 20 }}><div style={{ marginBottom: 8 }}>转维指南</div><Row gutter={16}>{guides.map(guide => <Col key={guide.title} span={isTos ? 12 : 8}><Card size="small" className="pms-card-hover" cover={<Image alt={guide.title} src={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect fill="#f0f0f0" width="400" height="240" rx="8"/><text x="200" y="120" text-anchor="middle" dominant-baseline="central" fill="#999" font-size="16" font-family="sans-serif">${guide.image}</text></svg>`)}`} style={{ height: 120, width: '100%', objectFit: 'cover' }} preview={{ mask: '点击预览' }} />}><Card.Meta title={guide.title} description={guide.description} /></Card></Col>)}</Row></div>
}
export function TransferDetail(props: TransferModuleProps) {
  const records = useTransferStore(state => state.tmHistory)
  const app = getApp(props)
  if (!canView(props) || !app) return <Empty description="未找到申请或暂无查看权限" />
  const items = [...props.tmChecklistItems, ...props.tmReviewElements].filter(item => item.applicationId === app.id)
  const final = getMaintenanceSpmReviewAccess(app, props.currentUser, props.selectedProject)
  const related = props.transferApplications.find(row => row.id === (app.reopenedAsId || app.predecessorId))
  return <TransferPageLayout isTos={getTransferProjectType(app.projectType || props.selectedProject) === 'tOS版本项目'} heading={<PageHeading props={props} app={app} title="项目转维进展详情页"><Space className="pms-transfer-heading__actions">
    {canOpenItems(props, app, 'entry') && <Button icon={<EditOutlined />} onClick={() => props.setTransferView('entry')}>资料录入</Button>}
    {canOpenItems(props, app, 'review') && <Button icon={<AuditOutlined />} onClick={() => props.setTransferView('review')}>维护审核</Button>}
    {(final.canApprove || final.canReject) && <Button icon={<SafetyOutlined />} onClick={() => props.setTransferView('maintenance-spm-review')}>维护SPM审核</Button>}
  </Space></PageHeading>}><PipelinePanel app={app} />
    {(app.status === 'failed' || app.status === 'cancelled') && <Alert style={{ marginBottom: 16 }} showIcon type="error" message={app.status === 'failed' ? '转维流程已失败' : '转维流水线已关闭'} description={<><div>{app.failureReason || app.cancelReason}</div>{app.status === 'failed' && !app.reopenedAsId && (canManageTransfer(app, props.currentUser, props.selectedProject, Boolean(props.canApplyTransfer)) && !props.transferApplications.some(row => matchesTransferProject(row, props.selectedProject) && ['in_progress', 'completed'].includes(row.status)) ? <Button type="primary" style={{ marginTop: 12 }} onClick={() => { const target = freshApp(props, app.id); if (!canView(props) || !target || target.status !== 'failed' || target.reopenedAsId || !canManageTransfer(target, props.currentUser, props.selectedProject, Boolean(props.canApplyTransfer))) return; useTransferStore.getState().setTmReopenAppId(target.id); props.setTransferView('apply') }}>重新发起转维申请</Button> : <div style={{ marginTop: 8 }}>请联系在研SPM或管理员重新发起转维申请。</div>)}</>} />}
    {related && <Alert style={{ marginBottom: 16 }} type="info" message={<Space>{app.reopenedAsId ? '已重新发起申请' : '本申请继承自历史申请'}<Button type="link" size="small" onClick={() => props.setSelectedTransferAppId(related.id)}>查看关联申请</Button></Space>} />}
    <TransferProjectPanels props={props} app={app} />
    <MaterialPanels props={props} app={app} /><TaskPanels props={props} app={app} resolveLegacy />
    <Card id="transfer-history" title="历史记录"><Timeline items={records.filter(record => record.applicationId === app.id).slice().sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()).map(record => ({ content: <><Space><strong>{record.action}</strong><span>{record.operator}</span><span style={{ color: '#9ca3af' }}>{when(record.timestamp)}</span></Space><div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{record.detail}</div></> }))} /></Card>
  </TransferPageLayout>
}

type PendingItemAction = { scope: string; appId: string; ids: string[]; mode: 'entry' | 'pass' | 'reject' | 'delegate' | 'submit' | 'role-pass' | 'role-reject' | 'role-legacy'; role?: string }
function TransferItems(props: TransferModuleProps & { side: 'entry' | 'review' }) {
  const selectablePeople = useAssignableTransferPeople(props.selectedProject)
  const side = props.side
  const [role, setRole] = useState('')
  const [tab, setTab] = useState<'checklist' | 'review'>('checklist')
  const [selection, setSelection] = useState<Key[]>([])
  const [aiDetailId, setAiDetailId] = useState<string | null>(null)
  const columnSearch = useTransferColumnSearch()
  const [pending, setPending] = useState<PendingItemAction | null>(null)
  const [content, setContent] = useState('')
  const [remark, setRemark] = useState('')
  const [assignee, setAssignee] = useState<string>()
  const [wantLegacy, setWantLegacy] = useState(false)
  const [tasks, setTasks] = useState<TaskDraft[]>([blankTask()])
  const key = scopeKey(props)
  const app = getApp(props)
  const items = [...props.tmChecklistItems, ...props.tmReviewElements].filter(item => item.applicationId === app?.id)
  const owner = (item: TransferItem) => side === 'entry' ? matchesTransferActor(props.currentUser, item.entryPersonId, item.entryPerson) : matchesTransferActor(props.currentUser, item.reviewPersonId, item.reviewPerson)
  const delegated = (item: TransferItem) => (side === 'entry' ? item.delegatedTo : item.reviewDelegatedTo)?.some(id => matchesTransferActor(props.currentUser, id, personName(id))) || false
  const coordinatesRole = (target: TransferApplication, name: string) => {
    const member = getTransferMember(target.team[side === 'entry' ? 'research' : 'maintenance'], name, target.teamConfig)
    return matchesTransferActor(props.currentUser, member?.id, member?.name)
  }
  const materialRoles = Array.from(new Set(items.map(item => item.responsibleRole)))
  const roles = materialRoles.filter(name => (app && coordinatesRole(app, name)) || items.some(item => item.responsibleRole === name && owner(item)))
  const delegatedItems = items.filter(item => delegated(item) && (getTransferProjectType(app?.projectType || props.selectedProject) !== 'tOS版本项目' || 'checkItem' in item))
  const hasDelegated = delegatedItems.length > 0
  const effectiveRole = roles.includes(role) ? role : roles[0] || ''
  const isTos = getTransferProjectType(app?.projectType || props.selectedProject) === 'tOS版本项目'
  const effectiveTab = isTos ? 'checklist' : tab
  useEffect(() => { setPending(null); setSelection([]); setContent(''); setRemark(''); setRole(''); setAssignee(undefined); setAiDetailId(null) }, [key, side])
  useEffect(() => { setSelection([]) }, [effectiveRole, effectiveTab])
  if (!canView(props) || !app) return <Empty description="未找到申请或暂无查看权限" />
  if ((!effectiveRole && !hasDelegated) || app.status !== 'in_progress') return <><PageHeading props={props} app={app} title={side === 'entry' ? '资料录入' : '维护审核'} /><ActorAlert /></>
  const eligible = (item: TransferItem, target = app) => side === 'entry' ? canEnterTransferItem(target, item, props.currentUser, props.selectedProject) : canReviewTransferItem(target, item, props.currentUser, props.selectedProject)
  const currentItems = items.filter(item => item.responsibleRole === effectiveRole)
  const displayed = currentItems.filter(item => effectiveTab === 'checklist' ? 'checkItem' in item : 'standard' in item)
  const roleItems = items.filter(item => item.responsibleRole === effectiveRole)
  const ownsRole = Boolean(effectiveRole) && roleItems.length > 0 && coordinatesRole(app, effectiveRole)
  const canSubmit = ownsRole && getTransferRoleSubmission(app, effectiveRole, items, props.currentUser, props.selectedProject, canView(props)).canSubmit
  const pendingChecklistCount = currentItems.filter(item => 'checkItem' in item && (item.entryStatus !== 'entered' || item.aiCheckStatus !== 'passed')).length
  const pendingReviewCount = currentItems.filter(item => 'standard' in item && (item.entryStatus !== 'entered' || item.aiCheckStatus !== 'passed')).length
  const submitHint = canSubmit ? `「${effectiveRole}」角色所有录入项已通过AI检查，可以提交审核` : pendingChecklistCount + pendingReviewCount > 0 ? `还有未完成项：CheckList ${pendingChecklistCount} 项${isTos ? '' : `、评审要素 ${pendingReviewCount} 项`}（需录入并通过AI检查）` : '本角色当前已提交审核或已完成'
  const roleLegacyAllowed = side === 'review' && canAppendTransferRoleLegacy(app, effectiveRole, items, props.currentUser, props.selectedProject, canView(props))
  const roleReviewAllowed = side === 'review' && ownsRole && app.pipeline.maintenanceReview === 'in_progress' && roleItems.every(item => item.entryStatus === 'entered' && item.aiCheckStatus === 'passed' && ['reviewing', 'passed', 'rejected'].includes(item.reviewStatus)) && roleItems.some(item => item.reviewStatus !== 'passed')
  const open = (mode: PendingItemAction['mode'], records: TransferItem[], targetRole?: string) => {
    if (!records.length) return
    setPending({ scope: key, appId: app.id, ids: records.map(item => item.id), mode, role: targetRole })
    setContent(records[0]?.entryContent || ''); setRemark(''); setWantLegacy(false); setTasks([blankTask()]); const existingDelegate = getTransferDelegateAssignee(records, side); setAssignee(existingDelegate ? people.find(person => matchesTransferActor(person, existingDelegate, personName(existingDelegate)))?.id || existingDelegate : undefined)
  }
  const resolvePending = () => {
    const target = freshApp(props, pending?.appId)
    const state = useTransferStore.getState()
    const rows = [...state.tmChecklistItems, ...state.tmReviewElements].filter(item => item.applicationId === target?.id && pending?.ids.includes(item.id))
    if (!canView(props) || !pending || pending.scope !== key || !target || target.status !== 'in_progress' || rows.length !== pending.ids.length) { setPending(null); message.warning('当前用户、任务或流程阶段已变更，请重新选择'); return null }
    return { target, state, rows }
  }
  const saveEntry = (draft: boolean) => {
    const fresh = resolvePending()
    if (!fresh || !pending) return
    const record = fresh.rows[0]
    if (!canEnterTransferItem(fresh.target, record, props.currentUser, props.selectedProject)) { message.warning('当前无权录入该资料'); return }
    if (!content.trim()) { message.warning('请输入内容'); return }
    const savedContent = content
    recordUpdate(props, fresh.target.id, [record.id], item => ({ ...item, entryContent: savedContent, entryStatus: draft ? 'draft' : 'entered', aiCheckStatus: draft ? 'not_started' : 'in_progress', aiCheckResult: undefined, reviewStatus: 'not_reviewed', reviewComment: undefined }), draft ? '暂存资料' : '确认录入资料', `${record.responsibleRole}：${'checkItem' in record ? record.checkItem : record.standard}`)
    if (!draft) {
      window.setTimeout(() => {
        const result = getTransferAiCheckResult()
        let checked = false
        useTransferStore.setState(state => {
          const target = state.transferApplications.find(row => row.id === fresh.target.id)
          if (!target || target.status !== 'in_progress') return state
          const finish = <T extends TransferItem>(item: T): T => {
            if (item.id !== record.id || item.applicationId !== target.id || item.entryContent !== savedContent || item.aiCheckStatus !== 'in_progress') return item
            checked = true
            return { ...item, ...result }
          }
          const checklist = state.tmChecklistItems.map(finish); const review = state.tmReviewElements.map(finish)
          return { tmChecklistItems: checklist, tmReviewElements: review, transferApplications: state.transferApplications.map(row => row.id === target.id ? syncTransferPipeline(row, checklist, review) : row) }
        })
        const visible = useTransferStore.getState()
        const projectState = useProjectStore.getState()
        if (checked && visible.selectedTransferAppId === fresh.target.id && visible.transferView === 'entry' && projectState.selectedProject?.id === props.selectedProject?.id && projectState.currentLoginUser === props.currentUser.name && canAssignTransferParticipant(props.currentUser, props.selectedProject)) {
          if (result.aiCheckStatus === 'passed') message.success('AI检查通过')
          else message.error('AI检查不通过，请修改后重新提交')
        }
      }, 1000 + Math.random() * 1000)
    }
    setPending(null); message.success(draft ? '已暂存' : '已确认录入，模拟AI检查进行中')
  }
  const confirm = () => {
    const fresh = resolvePending()
    if (!fresh || !pending) return
    const { target, rows } = fresh
    if (pending.mode === 'delegate') {
      if (!rows.every(item => canDelegateTransferItem(target, item, props.currentUser, props.selectedProject, side))) { message.warning('当前无权委派选中任务'); return }
      if (!assignee) { message.warning('请选择委派人员'); return }
      const delegate = people.find(person => person.id === assignee) ?? MOCK_TM_USERS.find(person => person.id === assignee)
      if (!delegate || !canAssignTransferParticipant(delegate, props.selectedProject)) { message.warning('被委派人已无当前项目转维查看权限，请重新选择'); return }
      recordUpdate(props, target.id, pending.ids, item => side === 'entry' ? { ...item, delegatedTo: [assignee] } : { ...item, reviewDelegatedTo: [assignee] }, side === 'entry' ? '委派录入' : '委派审核', `${rows.length} 项任务委派给 ${personName(assignee)}`)
      setSelection([]); setPending(null); message.success(`已委派给 ${personName(assignee)}`); return
    }
    if (pending.mode === 'pass' || pending.mode === 'reject') {
      if (!rows.every(item => canReviewTransferItem(target, item, props.currentUser, props.selectedProject))) { message.warning('当前无权审核选中资料'); return }
      recordUpdate(props, target.id, pending.ids, item => ({ ...item, reviewStatus: pending.mode === 'pass' ? 'passed' : 'rejected', reviewRemark: remark.trim() }), pending.mode === 'pass' ? '资料审核通过' : '资料审核不通过', `${rows.length} 条记录${remark.trim() ? `；审核备注：${remark.trim()}` : ''}`)
      setSelection([]); setPending(null); message.success(`已${pending.mode === 'pass' ? '通过' : '退回'} ${rows.length} 条记录`); return
    }
    const ownAll = Boolean(pending.role && coordinatesRole(target, pending.role))
    const allRoleRows = [...fresh.state.tmChecklistItems, ...fresh.state.tmReviewElements].filter(item => item.applicationId === target.id && item.responsibleRole === pending.role)
    if (!ownAll || allRoleRows.length !== rows.length || !rows.every(item => item.entryStatus === 'entered' && item.aiCheckStatus === 'passed')) { message.warning('当前角色资料或责任人已变更，请重新选择'); return }
    if (pending.mode === 'submit') {
      const submission = getTransferRoleSubmission(target, pending.role || '', rows, props.currentUser, props.selectedProject, canView(props))
      if (!submission.canSubmit) { message.warning('当前不可提交审核'); return }
      useTransferStore.setState(state => {
        const update = <T extends TransferItem>(item: T): T => item.applicationId === target.id && submission.itemIds.includes(item.id) ? { ...item, reviewStatus: 'reviewing' } : item
        const checklist = state.tmChecklistItems.map(update); const review = state.tmReviewElements.map(update)
        return { tmChecklistItems: checklist, tmReviewElements: review, tmBlockTasks: state.tmBlockTasks.map(task => task.applicationId === target.id && task.responsibleRole === pending.role && task.status === 'open' ? { ...task, status: 'resolved' } : task), transferApplications: state.transferApplications.map(row => row.id === target.id ? syncTransferPipeline(row, checklist, review) : row), tmHistory: [...state.tmHistory, history(target.id, props.currentUser, `${pending.role} 提交维护审核`, '资料录入和模拟AI检查完成，当前角色未关闭的Block任务已确认解决')] }
      })
      setPending(null); props.setTransferView('detail'); message.success('已提交维护审核'); return
    }
    if (pending.mode === 'role-legacy') {
      if (!canAppendTransferRoleLegacy(target, pending.role || '', allRoleRows, props.currentUser, props.selectedProject, canView(props))) { message.warning('当前角色不可追加遗留任务'); return }
      if (!tasksComplete(tasks)) { message.warning('请填写完整所有遗留任务信息'); return }
      useTransferStore.setState(state => ({
        tmLegacyTasks: [...state.tmLegacyTasks, ...tasks.map(task => ({ ...task, id: uid('legacy'), applicationId: target.id, status: 'open' as const, createdAt: stamp() }))],
        tmHistory: [...state.tmHistory, history(target.id, props.currentUser, `${pending.role} 追加遗留任务`, `审核通过后追加 ${tasks.length} 项遗留任务`)],
      }))
      setPending(null); message.success('遗留任务已追加'); return
    }
    if (target.pipeline.maintenanceReview !== 'in_progress' || !rows.some(item => item.reviewStatus !== 'passed') || !rows.every(item => ['reviewing', 'rejected', 'passed'].includes(item.reviewStatus))) { message.warning('当前角色不可审核'); return }
    const rejected = pending.mode === 'role-reject'
    if (rejected && (!remark.trim() || !tasksComplete(tasks, true))) { message.warning('请填写评审意见和完整的Block任务信息'); return }
    if (!rejected && wantLegacy && !tasksComplete(tasks)) { message.warning('请填写完整所有遗留任务信息'); return }
    useTransferStore.setState(state => {
      const update = <T extends TransferItem>(item: T): T => item.applicationId === target.id && pending.ids.includes(item.id) ? { ...item, reviewStatus: rejected ? 'rejected' : 'passed', ...(rejected ? { aiCheckStatus: 'not_started' as const, reviewComment: remark.trim() } : {}) } : item
      const checklist = state.tmChecklistItems.map(update); const review = state.tmReviewElements.map(update)
      const newTasks = tasks.map(task => ({ ...task, id: uid(rejected ? 'block' : 'legacy'), applicationId: target.id, responsibleRole: pending.role, status: 'open' as const, createdAt: stamp() }))
      return { tmChecklistItems: checklist, tmReviewElements: review, tmBlockTasks: rejected ? [...state.tmBlockTasks, ...newTasks] : state.tmBlockTasks, tmLegacyTasks: !rejected && wantLegacy ? [...state.tmLegacyTasks, ...newTasks] : state.tmLegacyTasks, transferApplications: state.transferApplications.map(row => row.id === target.id ? syncTransferPipeline(row, checklist, review) : row), tmHistory: [...state.tmHistory, history(target.id, props.currentUser, `${pending.role} 维护审核${rejected ? '不通过' : '通过'}`, rejected ? `${remark.trim()}；创建 ${tasks.length} 项Block任务` : `角色审核通过${wantLegacy ? `，登记 ${tasks.length} 项遗留任务` : ''}`)] }
    })
    setPending(null); props.setTransferView('detail'); message.success(rejected ? '已退回资料录入，并创建Block任务' : '角色审核已通过')
  }
  const selected = displayed.filter(item => selection.includes(item.id))
  const columns = (kind: 'checklist' | 'review'): ColumnsType<TransferItem> => [...materialColumns(kind, { view: side, search: columnSearch, showAiRule: side === 'entry', onAiDetail: side === 'entry' ? item => setAiDetailId(item.id) : undefined }), { title: '操作', width: side === 'entry' ? 140 : 200, fixed: 'right' as const, render: (_: unknown, item: TransferItem) => <Space size={0}>
    {eligible(item) && (side === 'entry' ? <Button type="link" size="small" onClick={() => open('entry', [item])}>{item.entryStatus === 'not_entered' ? '录入' : '编辑'}</Button> : <><Button type="link" size="small" onClick={() => open('pass', [item])}>通过</Button><Button type="link" size="small" danger onClick={() => open('reject', [item])}>不通过</Button></>)}
    {canDelegateTransferItem(app, item, props.currentUser, props.selectedProject, side) && <Button type="link" size="small" onClick={() => open('delegate', [item])}>委派</Button>}
  </Space> }]
  const pendingRecord = items.find(item => item.id === pending?.ids[0])
  const blockTasks = props.tmBlockTasks.filter(task => task.applicationId === app.id && task.responsibleRole === effectiveRole && task.status === 'open')
  const selectionActions = selection.length > 0 && <Space wrap>
    {side === 'review' && <><Button size="small" disabled={!selected.every(item => eligible(item))} onClick={() => open('pass', selected)}>批量通过 ({selection.length})</Button><Button size="small" danger disabled={!selected.every(item => eligible(item))} onClick={() => open('reject', selected)}>批量不通过 ({selection.length})</Button></>}
    <Button size="small" disabled={!selected.every(item => canDelegateTransferItem(app, item, props.currentUser, props.selectedProject, side))} onClick={() => open('delegate', selected)}>批量委派 ({selection.length})</Button>
  </Space>
  return <div className="pms-transfer-work-page"><PageHeading props={props} app={app} compact title={side === 'entry' ? '资料录入与AI检查' : '维护审核'}>
    {roles.length > 1 ? <Segmented value={effectiveRole} options={roles.map(value => ({ value, label: `${value}角色` }))} onChange={value => setRole(String(value))} /> : effectiveRole ? <Tag color="processing">{effectiveRole}角色</Tag> : null}
  </PageHeading><PipelinePanel app={app} compact />
    {side === 'review' && effectiveRole && <div className="pms-transfer-review-bar pms-solid-surface">
      <Space size={16} wrap><span style={{ fontWeight: 600 }}>评审角色：<Tag color="processing">{effectiveRole}</Tag></span><span style={{ color: 'var(--pms-text-secondary)' }}>负责人：{getTransferMember(app.team.maintenance, effectiveRole, app.teamConfig)?.name || '-'}</span></Space>
      <Space wrap>{selectionActions}{roleLegacyAllowed && <Button icon={<PlusOutlined />} onClick={() => open('role-legacy', roleItems, effectiveRole)}>追加遗留任务</Button>}
        {roleReviewAllowed && <><Button danger icon={<CloseCircleOutlined />} onClick={() => open('role-reject', roleItems, effectiveRole)}>不通过</Button><Button type="primary" icon={<CheckCircleOutlined />} onClick={() => open('role-pass', roleItems, effectiveRole)}>通过</Button></>}
      </Space>
    </div>}
    {side === 'entry' && (blockTasks.length > 0 || currentItems.some(item => item.reviewStatus === 'rejected' || item.reviewComment)) && <Collapse key={`rejection-${effectiveRole}`} className="pms-solid-surface" style={{ marginBottom: 16 }} defaultActiveKey={[]} items={[{ key: 'rejection', label: <Space wrap><span>「{effectiveRole}」角色维护审核不通过</span><Tag color="error">Block 未关闭 {blockTasks.length}</Tag><span style={{ color: 'var(--pms-text-secondary)' }}>请按评审意见修改资料后重新提交审核</span></Space>, children: <><div style={{ fontWeight: 500, marginBottom: 8 }}>评审意见</div>{!currentItems.some(item => item.reviewComment) && <div style={{ marginBottom: 12 }}>（未填写）</div>}<Space orientation="vertical" style={{ width: '100%', marginBottom: 12 }}>{Array.from(new Set(currentItems.map(item => item.reviewComment).filter(Boolean))).map(comment => <Alert key={comment} type="warning" message={comment} />)}</Space><Table rowKey="id" pagination={false} size="small" dataSource={blockTasks} columns={[{ title: '问题描述', dataIndex: 'description' }, { title: '解决方案', dataIndex: 'resolution' }, { title: '责任人', dataIndex: 'responsiblePerson' }, { title: '部门', dataIndex: 'department' }, { title: '截止日期', dataIndex: 'deadline' }]} /></> }]} />}
    {hasDelegated && <Collapse className="pms-solid-surface" style={{ marginBottom: 16 }} defaultActiveKey={['delegated-to-me']} items={[{ key: 'delegated-to-me', label: <span style={{ fontWeight: 600 }}>委派给我的 ({delegatedItems.length} 项)</span>, children: <>{(['checklist', ...(!isTos ? ['review'] : [])] as ('checklist' | 'review')[]).map(kind => { const rows = delegatedItems.filter(item => kind === 'checklist' ? 'checkItem' in item : 'standard' in item); return rows.length > 0 && <div key={kind} style={{ marginBottom: 16 }}><div style={{ fontWeight: 500, marginBottom: 8 }}>{kind === 'checklist' ? 'CheckList' : '评审要素'} ({rows.length})</div><Table<TransferItem> className="pms-table" rowKey="id" size="small" pagination={false} scroll={{ x: side === 'entry' ? 1820 : 1620 }} columns={columns(kind)} dataSource={rows} /></div> })}</> }]} />}
    {effectiveRole && <Card className="pms-transfer-material-card"><Tabs tabBarExtraContent={side === 'entry' ? <Space wrap>{selectionActions}{ownsRole && <Tooltip title={submitHint}><Button type="primary" size="small" icon={<CheckCircleOutlined />} disabled={!canSubmit} onClick={() => open('submit', roleItems, effectiveRole)}>提交{effectiveRole}审核</Button></Tooltip>}<TransferEntryExchange key={`${key}:${effectiveRole}:${effectiveTab}`} items={displayed} title={`${app.projectName}_${effectiveRole}_${effectiveTab === 'checklist' ? 'CheckList' : '评审要素'}`} canEdit={eligible} onImport={changes => {
        const target = freshApp(props, app.id)
        const state = useTransferStore.getState()
        const current = [...state.tmChecklistItems, ...state.tmReviewElements].filter(item => item.applicationId === app.id && item.responsibleRole === effectiveRole)
        if (!canView(props) || !target || !changes.every(change => { const item = current.find(row => row.id === change.id); return item && (item.entryContent || '') === change.previousContent && canEnterTransferItem(target, item, props.currentUser, props.selectedProject) })) { message.warning('资料内容、责任人或流程状态已变化，请重新导入'); return false }
        const contentById = new Map(changes.map(change => [change.id, change.content]))
        recordUpdate(props, app.id, changes.map(change => change.id), item => ({ ...item, entryContent: contentById.get(item.id), entryStatus: 'draft', aiCheckStatus: 'not_started', aiCheckResult: undefined, reviewStatus: 'not_reviewed', reviewComment: undefined }), '导入录入内容', `${effectiveRole} 导入并暂存 ${changes.length} 项资料`)
        message.success(`已暂存 ${changes.length} 项资料，请逐项确认提交`); return true
      }} /></Space> : undefined} activeKey={effectiveTab} onChange={value => setTab(value as 'checklist' | 'review')} items={[{ key: 'checklist', label: <Space>CheckList ({currentItems.filter(item => 'checkItem' in item).length}){side === 'entry' && pendingChecklistCount > 0 && <Tooltip title={`还有 ${pendingChecklistCount} 项未录入或AI检查未通过`}><Badge count={pendingChecklistCount} size="small" /></Tooltip>}</Space> }, ...(!isTos ? [{ key: 'review', label: <Space>评审要素 ({currentItems.filter(item => 'standard' in item).length}){side === 'entry' && pendingReviewCount > 0 && <Tooltip title={`还有 ${pendingReviewCount} 项未录入或AI检查未通过`}><Badge count={pendingReviewCount} size="small" /></Tooltip>}</Space> }] : [])]} />

      <Table<TransferItem> className="pms-table" rowKey="id" size="small" pagination={false} scroll={{ x: side === 'entry' ? 1820 : 1620 }} dataSource={displayed} columns={columns(effectiveTab)} rowSelection={{ selectedRowKeys: selection, onChange: setSelection, getCheckboxProps: item => ({ disabled: !eligible(item) && !canDelegateTransferItem(app, item, props.currentUser, props.selectedProject, side) }) }} />
    </Card>}
    <Modal className="pms-modal pms-transfer-surface" title="AI检查详情" open={Boolean(aiDetailId)} width={500} onCancel={() => setAiDetailId(null)} footer={<Button onClick={() => setAiDetailId(null)}>关闭</Button>}><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{getTransferAiDetail(items.find(item => item.id === aiDetailId))}</div></Modal>
    <Modal className="pms-modal pms-transfer-surface" title="资料录入" open={pending?.mode === 'entry'} width={680} onCancel={() => setPending(null)} footer={<Space><Button onClick={() => setPending(null)}>取消</Button><Button onClick={() => saveEntry(true)}>暂存</Button><Button type="primary" onClick={() => saveEntry(false)}>确认提交</Button></Space>}><Descriptions column={1} size="small"><Descriptions.Item label="评审要素">{pendingRecord && ('checkItem' in pendingRecord ? pendingRecord.checkItem : pendingRecord.description)}</Descriptions.Item><Descriptions.Item label="AI检查规则">{pendingRecord?.aiCheckRule || '-'}</Descriptions.Item></Descriptions>{pendingRecord?.reviewRemark && <Alert type="info" message={`审核备注：${pendingRecord.reviewRemark}`} style={{ margin: '12px 0' }} />}<TextArea rows={7} aria-label="录入内容" placeholder="请输入资料内容，支持文本描述、链接、飞书文档地址等" value={content} onChange={event => setContent(event.target.value)} /></Modal>
    <Modal className="pms-modal pms-transfer-surface" title={pending?.mode === 'pass' ? '审核通过' : '审核不通过'} open={pending?.mode === 'pass' || pending?.mode === 'reject'} onCancel={() => setPending(null)} onOk={confirm} okText={pending?.mode === 'pass' ? '确认通过' : '确认不通过'} okButtonProps={{ danger: pending?.mode === 'reject' }}><p>本次审核 {pending?.ids.length || 0} 条记录。</p><Form layout="vertical"><Form.Item label="审核备注（选填）"><TextArea rows={4} aria-label="审核备注" placeholder="请输入审核备注，可留空" value={remark} onChange={event => setRemark(event.target.value)} /></Form.Item></Form></Modal>
    <Modal className="pms-modal pms-transfer-surface" title={side === 'entry' ? '委派任务' : '委派审核'} open={pending?.mode === 'delegate'} onCancel={() => setPending(null)} onOk={confirm} okText="确认委派" footer={<Space>{side === 'review' && <Button danger disabled={pending?.ids.length !== 1 || !pendingRecord?.reviewDelegatedTo?.length} onClick={() => { const fresh = resolvePending(); if (!fresh || !pending || pending.ids.length !== 1 || !fresh.rows[0]?.reviewDelegatedTo?.length || !fresh.rows.every(item => canDelegateTransferItem(fresh.target, item, props.currentUser, props.selectedProject, side))) return; recordUpdate(props, fresh.target.id, pending.ids, item => ({ ...item, reviewDelegatedTo: undefined }), '取消审核委派', `${pending.ids.length} 项任务取消委派`); setPending(null); setSelection([]) }}>清空委派</Button>}<Button onClick={() => setPending(null)}>取消</Button><Button type="primary" onClick={confirm} disabled={!assignee}>确认委派</Button></Space>}><p>原责任人保持不变，所选 {pending?.ids.length || 0} 项任务由被委派人协助处理。</p><Select style={{ width: '100%' }} showSearch optionFilterProp="label" aria-label="委派人员" placeholder="搜索/选择委派人员" value={assignee} onChange={setAssignee} options={selectablePeople.filter(person => !matchesTransferActor(props.currentUser, person.id, person.name)).map(person => ({ value: person.id, label: getTransferParticipantLabel(person, app) }))} /></Modal>
    <Modal className="pms-modal pms-transfer-surface" title={blockTasks.length ? '确认Block任务已解决并提交审核' : '确认提交审核'} open={pending?.mode === 'submit'} onCancel={() => setPending(null)} onOk={confirm} okText="确认提交"><p>提交后“{pending?.role}”角色将进入维护审核阶段。</p>{blockTasks.length > 0 && <Alert type="warning" showIcon message={`确认当前 ${blockTasks.length} 项Block任务已实际解决。提交后将标记为已解决。`} />}</Modal>
    <Modal className="pms-modal pms-transfer-surface" width={760} title="追加遗留任务" open={pending?.mode === 'role-legacy'} onCancel={() => setPending(null)} onOk={confirm} okText="保存遗留任务"><Alert type="info" showIcon message="本角色审核已通过，可在维护SPM终审通过前追加遗留任务。" style={{ marginBottom: 16 }} /><TaskForms tasks={tasks} setTasks={setTasks} block={false} /></Modal>
    <Modal className="pms-modal pms-transfer-surface" width={760} title={pending?.mode === 'role-reject' ? '角色审核不通过并创建Block任务' : '角色审核通过'} open={pending?.mode === 'role-pass' || pending?.mode === 'role-reject'} onCancel={() => setPending(null)} onOk={confirm} okText={pending?.mode === 'role-reject' ? '确认不通过' : '确认通过'} okButtonProps={{ danger: pending?.mode === 'role-reject' }}>
      {pending?.mode === 'role-reject' ? <><Form layout="vertical"><Form.Item label="评审意见" required><TextArea aria-label="角色评审意见" rows={3} value={remark} onChange={event => setRemark(event.target.value)} /></Form.Item></Form><TaskForms tasks={tasks} setTasks={setTasks} block /></> : !wantLegacy ? <div style={{ textAlign: 'center', padding: '20px 0' }}><p style={{ fontSize: 15, marginBottom: 20 }}>是否需要创建遗留任务？</p><Space size={16}><Button size="large" onClick={confirm}>否，直接通过</Button><Button size="large" type="primary" onClick={() => setWantLegacy(true)}>是，创建遗留任务</Button></Space></div> : <><div style={{ marginBottom: 16, fontWeight: 600 }}>创建遗留任务</div><TaskForms tasks={tasks} setTasks={setTasks} block={false} /></>}
    </Modal>
  </div>
}
export function TransferEntry(props: TransferModuleProps) { return <TransferItems {...props} side="entry" /> }
export function TransferReview(props: TransferModuleProps) { return <TransferItems {...props} side="review" /> }

export function TransferMaintenanceSpmReview(props: TransferModuleProps) {
  const [comment, setComment] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [openedScope, setOpenedScope] = useState('')
  const key = scopeKey(props)
  useEffect(() => { setAction(null); setComment('') }, [key])
  const app = getApp(props)
  if (!canView(props) || !app) return <Empty description="未找到申请或暂无查看权限" />
  const access = getMaintenanceSpmReviewAccess(app, props.currentUser, props.selectedProject)
  const closeRows = buildCloseReviewRows(app, props.tmChecklistItems, props.tmReviewElements)
  const confirm = () => {
    const target = freshApp(props, app.id)
    const current = target && getMaintenanceSpmReviewAccess(target, props.currentUser, props.selectedProject)
    if (!canView(props) || openedScope !== key || !target || !current || (action === 'approve' ? !current.canApprove : !current.canReject)) { message.warning('当前用户或流程阶段已变更，无法审核'); setAction(null); return }
    if (action === 'reject' && !comment.trim()) { message.warning('请填写维护SPM评审建议'); return }
    useTransferStore.setState(state => ({ transferApplications: state.transferApplications.map(row => row.id === target.id ? { ...row, ...(action === 'reject' ? { status: 'failed' as const, failureReason: comment.trim() } : {}), pipeline: { ...row.pipeline, maintenanceSpmReview: action === 'approve' ? 'success' : 'failed', infoChange: action === 'approve' ? 'in_progress' : row.pipeline.infoChange }, updatedAt: stamp() } : row), tmHistory: [...state.tmHistory, history(target.id, props.currentUser, action === 'approve' ? '维护SPM审核通过' : '维护SPM审核不通过', action === 'approve' ? `进入信息变更阶段${comment.trim() ? `；评审建议：${comment.trim()}` : ''}` : `转维流程终止；驳回原因：${comment.trim()}`)] }))
    setAction(null); props.setTransferView('detail'); message.success(action === 'approve' ? '维护SPM审核通过，进入信息变更阶段' : '转维流程已终止，资料和历史记录已保留')
  }
  return <TransferPageLayout isTos={getTransferProjectType(app.projectType || props.selectedProject) === 'tOS版本项目'} final heading={<PageHeading props={props} app={app} title="维护SPM审核">{tag(app.status)}</PageHeading>}><PipelinePanel app={app} /><TransferProjectPanels props={props} app={app} />

    <MaterialPanels props={props} app={app} /><TaskPanels props={props} app={app} editLegacy />
    <Card id="transfer-decision" title={<Space><SafetyOutlined />维护SPM评审</Space>}><Descriptions size="small"><Descriptions.Item label="当前维护SPM">{access.reviewer?.name || '-'}</Descriptions.Item></Descriptions>
    <div style={{ marginBottom: 24 }}><div style={{ fontWeight: 500, marginBottom: 12 }}>各角色评审状态</div><Table rowKey="role" size="small" pagination={false} dataSource={closeRows} columns={[{ title: '角色', dataIndex: 'role', width: 140 }, { title: '责任人', dataIndex: 'responsiblePerson', width: 140 }, { title: '审核结论', dataIndex: 'conclusion', width: 140, render: (value: string) => <Tag color={value === 'PASS' ? 'success' : value === 'Fail' ? 'error' : 'default'}>{value}</Tag> }, { title: '评审意见', dataIndex: 'comment', render: (value: string) => <LongText value={value} /> }]} /></div>
      {access.isRejectionMode && <Alert type="warning" showIcon message="存在角色审核不通过，当前仅可选择不通过以终止流水线；角色重新提交并通过后才可通过终审。" style={{ marginBottom: 16 }} />}
      <div style={{ fontWeight: 500, marginBottom: 8 }}>维护SPM评审建议</div><TextArea maxLength={500} showCount rows={4} aria-label="维护SPM评审建议" value={comment} disabled={!access.canApprove && !access.canReject} onChange={event => setComment(event.target.value)} placeholder="请输入维护SPM评审建议（不通过时必填）" style={{ marginBottom: 16 }} />
      <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>{access.canApprove && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => { setOpenedScope(key); setAction('approve') }}>审核通过</Button>}{access.canReject && <Button danger icon={<CloseCircleOutlined />} onClick={() => { setOpenedScope(key); setAction('reject') }}>审核不通过</Button>}{!access.canApprove && !access.canReject && <Alert type="info" showIcon message="当前用户无终审权限或流程尚未进入可终审阶段。" />}</Space>
    </Card><Modal className="pms-modal pms-transfer-surface" title={action === 'approve' ? '维护SPM审核通过确认' : '维护SPM审核不通过确认'} open={Boolean(action)} onCancel={() => setAction(null)} onOk={confirm} okText="确认" okButtonProps={{ danger: action === 'reject' }}><p>{action === 'approve' ? '确认通过维护SPM审核？流水线将进入信息变更阶段。' : '确认不通过？本次转维流程将终止，保留所有录入内容，可由有权限的人员重新发起。'}</p><LongText value={comment} /></Modal>
  </TransferPageLayout>
}
/** Existing consumers may still import the previous symbol while navigating to the new final-review view. */
export const TransferSqaReview = TransferMaintenanceSpmReview
