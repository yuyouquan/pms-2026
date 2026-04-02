'use client'

import { useState, useMemo, useEffect, useRef, createContext, useContext, Fragment, type CSSProperties } from 'react'
import {
  Card,
  Tabs,
  Table,
  Button,
  Progress,
  Tag,
  Space,
  Row,
  Col,
  Badge,
  Menu,
  message,
  Select,
  Input,
  Popconfirm,
  Tooltip,
  Modal,
  Checkbox,
  DatePicker,
  Form,
  Avatar,
  Empty,
  Slider,
  Alert,
  Statistic,
  ConfigProvider,
  Descriptions,
  Divider,
  Radio,
  Dropdown,
  Breadcrumb,
  Segmented,
  Collapse,
  Timeline,
  Typography,
  Pagination
} from 'antd'
import type { MenuProps } from 'antd'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { gantt } from 'dhtmlx-gantt'

// 全局表格和交互样式
const globalStyles = `
  .pms-table .ant-table-thead > tr > th {
    background: #fafbfc !important;
    font-weight: 600 !important;
    font-size: 13px !important;
    color: #595959 !important;
    border-bottom: 2px solid #f0f0f0 !important;
    padding: 10px 12px !important;
  }
  .pms-table .ant-table-tbody > tr > td {
    padding: 8px 12px !important;
    font-size: 13px !important;
    vertical-align: middle !important;
    transition: background 0.15s !important;
  }
  .pms-table .ant-table-tbody > tr:hover > td {
    background: #e6f4ff !important;
  }
  .pms-table .ant-table-tbody > tr:nth-child(even) > td {
    background: #fafbfc;
  }
  .pms-table .ant-table-tbody > tr:nth-child(even):hover > td {
    background: #e6f4ff !important;
  }
  .pms-table-edit .ant-table-tbody > tr > td {
    background: #fffbe6 !important;
  }
  .pms-table-edit .ant-table-tbody > tr:hover > td {
    background: #fff1b8 !important;
  }
  .pms-table-edit .ant-table-tbody > tr:nth-child(even) > td {
    background: #fffef0 !important;
  }
  .pms-table-edit .ant-table-tbody > tr:nth-child(even):hover > td {
    background: #fff1b8 !important;
  }
  .pms-edit-input {
    border-color: #d9d9d9 !important;
    border-radius: 4px !important;
    transition: all 0.2s !important;
  }
  .pms-edit-input:focus, .pms-edit-input:hover {
    border-color: #1890ff !important;
    box-shadow: 0 0 0 2px rgba(24,144,255,0.1) !important;
  }
  .pms-card-hover {
    transition: all 0.2s ease !important;
  }
  .pms-card-hover:hover {
    border-color: #d9d9d9 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
    transform: translateY(-2px);
  }
  .pms-sidebar .ant-menu-item {
    border-radius: 6px !important;
    margin: 2px 8px !important;
  }
  .pms-sidebar .ant-menu-item-selected {
    background: #e6f4ff !important;
    font-weight: 500 !important;
  }
  .pms-modal .ant-modal-header {
    padding: 16px 24px !important;
    border-bottom: 1px solid #f0f0f0 !important;
    background: #fafbfc !important;
    border-radius: 8px 8px 0 0 !important;
  }
  .pms-modal .ant-modal-content {
    border-radius: 8px !important;
    overflow: hidden !important;
  }
  .pms-modal .ant-modal-footer {
    padding: 12px 24px !important;
    border-top: 1px solid #f0f0f0 !important;
    background: #fafbfc !important;
  }
  .pms-modal .ant-modal-footer .ant-btn {
    border-radius: 6px !important;
  }
`

// DHTMLX Gantt组件
function DHTMLXGantt({ tasks, onTaskClick, readOnly = false }: { tasks: any[], onTaskClick?: (task: any) => void, readOnly?: boolean }) {
  const ganttContainer = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!ganttContainer.current) return
    
    // 配置Gantt
    gantt.config.date_format = '%Y-%m-%d'
    gantt.config.columns = [
      { name: 'text', label: '任务名称', width: 200, tree: true },
      { name: 'start_date', label: '开始', align: 'center', width: 80 },
      { name: 'duration', label: '天数', align: 'center', width: 50 },
      { name: 'progress', label: '进度', align: 'center', width: 60, template: (task: any) => Math.round(task.progress * 100) + '%' }
    ]
    gantt.config.scale_unit = 'month'
    gantt.config.date_scale = '%Y年%m月'
    gantt.config.subscales = [{ unit: 'day', step: 1, date: '%d日' }]
    gantt.config.row_height = 35
    gantt.config.bar_height = 20
    gantt.config.fit_tasks = true
    gantt.config.auto_scheduling = true
    gantt.config.auto_scheduling_strict = true
    gantt.config.open_tree_initial = true
    gantt.config.readonly = readOnly
    
    // 初始化
    gantt.init(ganttContainer.current)
    
    // 转换数据格式
    const ganttData = {
      data: tasks.map(t => ({
        id: t.id,
        text: t.taskName,
        start_date: t.planStartDate || '',
        end_date: t.planEndDate || '',
        duration: t.estimatedDays || 1,
        progress: (t.progress || 0) / 100,
        parent: t.parentId || 0,
        open: true,
        status: t.status,
        responsible: t.responsible
      })),
      links: tasks.filter(t => t.predecessor).map((t, i) => ({
        id: i + 1,
        source: t.predecessor,
        target: t.id,
        type: '0'
      }))
    }
    
    gantt.parse(ganttData)
    
    // 点击事件
    if (onTaskClick) {
      gantt.attachEvent('onTaskClick', (id: number) => {
        const task = gantt.getTask(id)
        onTaskClick(task)
        return true
      })
    }
    
    return () => {
      gantt.clearAll()
    }
  }, [tasks, readOnly])
  
  return <div ref={ganttContainer} style={{ width: '100%', height: '500px' }} />
}
import { 
  PlusOutlined, 
  SaveOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  ProjectOutlined,
  UnorderedListOutlined,
  CheckSquareOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  HolderOutlined,
  BarChartOutlined,
  LeftOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SettingOutlined,
  TeamOutlined,
  WarningOutlined,
  BugOutlined,
  FolderOutlined,
  CheckCircleOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  FlagOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  AuditOutlined,
  DiffOutlined,
  UploadOutlined,
  DownloadOutlined,
  CloseCircleOutlined,
  ArrowLeftOutlined,
  SafetyOutlined,
  RocketOutlined,
  FileProtectOutlined,
  LinkOutlined,
  FolderOpenOutlined,
  SendOutlined,
  CheckOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  DeploymentUnitOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { compareVersions, compareVersionsForTable, CompareTableRow, FieldDiff } from '@/lib/versionCompare'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnsType } from 'antd/es/table'
import {
  MOCK_TM_USERS,
  MOCK_TRANSFER_APPLICATIONS,
  MOCK_CHECKLIST_ITEMS,
  MOCK_REVIEW_ELEMENTS,
  MOCK_BLOCK_TASKS,
  MOCK_LEGACY_TASKS,
  MOCK_HISTORY,
  MOCK_CHECKLIST_TEMPLATES,
  MOCK_REVIEW_ELEMENT_TEMPLATES,
  MOCK_CHECKLIST_VERSIONS,
  MOCK_CHECKLIST_VERSION_DIFF,
  MOCK_RE_VERSIONS,
  MOCK_RE_VERSION_DIFF,
  ROLE_COLORS,
  PIPELINE_NODES,
  PIPELINE_KEYS,
  getCurrentNodeIndex,
  getCurrentNodeLabel,
  getCurrentNodeStatus,
  getPipelinePercent,
  hasAnyRoleEnteredReview,
  buildCloseReviewRows,
  type TransferApplication,
  type CheckListItem,
  type ReviewElement,
  type BlockTask,
  type LegacyTask,
  type HistoryRecord,
  type CloseReviewRow,
  type PipelineState,
  type PipelineNodeStatus,
  type RoleNodeStatus,
  type PipelineRole,
  type TMTeamMember,
  type EntryStatus,
  type AICheckStatus,
  type ReviewStatus,
} from '@/mock/transfer-maintenance'
import RequirementDevPlan from '@/components/plans/RequirementDevPlan'
import VersionTrainPlan from '@/components/plans/VersionTrainPlan'
import RoadmapView from '@/components/roadmap/RoadmapView'

const { TabPane } = Tabs
const { Option } = Select
const { RangePicker } = DatePicker
const { TextArea } = Input
const { Text } = Typography

// ========== 转维状态配置 ==========
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
const ROLE_STATUS_COLORS: Record<string, string> = {
  not_started: '#d9d9d9', in_progress: '#1677ff', completed: '#52c41a', rejected: '#ff4d4f',
}
const STATUS_COLORS: Record<string, string> = {
  not_started: '#d9d9d9', in_progress: '#1677ff', success: '#52c41a', failed: '#ff4d4f',
}
const NODE_LABELS = ['项目发起', '资料录入与AI检查', '维护审核', 'SQA审核', '信息变更']
const ROLE_STATUS_LABELS: Record<string, string> = {
  not_started: '未开始', in_progress: '进行中', completed: '已完成', rejected: '被拒绝',
}
const BLOCK_TASK_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'open': { color: 'red', label: '未解决' }, 'resolved': { color: 'green', label: '已解决' }, 'cancelled': { color: 'default', label: '已取消' },
}
const LEGACY_TASK_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'open': { color: 'orange', label: '待处理' }, 'resolved': { color: 'green', label: '已完成' }, 'cancelled': { color: 'default', label: '已取消' },
}

// ========== PipelineProgress 内联组件 ==========
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
              <div style={{ marginTop: 8, fontSize: 13, color: '#333', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</div>
              {showDots && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {pipeline.roleProgress.map((rp) => {
                    const roleStatus = index === 1 ? rp.entryStatus : rp.reviewStatus
                    const dotColor = ROLE_STATUS_COLORS[roleStatus]
                    return (
                      <Tooltip key={rp.role} title={`${rp.role}: ${ROLE_STATUS_LABELS[roleStatus]}`}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.1)' }} />
                      </Tooltip>
                    )
                  })}
                </div>
              )}
            </div>
            {!isLast && <div style={{ flex: 1, height: 2, background: '#e0e0e0', marginTop: 15, minWidth: 60 }} />}
          </Fragment>
        )
      })}
    </div>
  )
}

// ========== MiniPipeline 内联组件 ==========
const NODE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  not_started: { color: 'default', label: '未开始' },
  in_progress: { color: 'processing', label: '进行中' },
  success: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
}
function MiniPipeline({ app }: { app: TransferApplication }) {
  const idx = getCurrentNodeIndex(app)
  const label = getCurrentNodeLabel(app)
  const pct = getPipelinePercent(app)
  const nodeStatus = getCurrentNodeStatus(app)
  const strokeColor = nodeStatus === 'success' ? '#52c41a' : nodeStatus === 'failed' ? '#ff4d4f' : '#1677ff'
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

// ========== TeamMemberCard 内联组件 ==========
function TeamMemberCard({ member }: { member: TMTeamMember }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #f0f0f0', background: '#fafbfc' }}>
      <Avatar size={28} style={{ background: ROLE_COLORS[member.role] || '#999', fontSize: 12, flexShrink: 0 }}>{member.name.slice(-1)}</Avatar>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#262626', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{member.role} · {member.department}</div>
      </div>
    </div>
  )
}

// ========== EntryContentRenderer 内联组件 ==========
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
        if (seg.type === 'link') return <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff', display: 'inline-flex', alignItems: 'center', gap: 2 }}><LinkOutlined style={{ fontSize: 11 }} />{seg.text}</a>
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

// 项目类型选项
const PROJECT_TYPES = ['整机产品项目', '产品项目', '技术项目', '能力建设项目']
// 可在创建二级计划时选择的类型（不含固定类型）
const LEVEL2_PLAN_TYPES = ['1+N MR版本火车计划', '粉丝版本计划', '基础体验计划', 'WBS计划']
// 固定二级计划（始终显示在前两位，不可删除）
const FIXED_LEVEL2_PLANS = [
  { id: 'plan0', name: '需求开发计划', type: '需求开发计划', fixed: true },
  { id: 'plan1', name: '在研版本火车计划', type: '在研版本火车计划', fixed: true },
]

// IPM状态 → PMS展示状态 映射
const mapIpmStatus = (ipmStatus: string, projectType: string): string => {
  const mapping: Record<string, string> = {
    '筹备中': '待立项',
    '进行中': '进行中',
    '已完成': '已完成',
    '已取消': '已取消',
    '维护期': '维护',
  }
  if (projectType === '整机产品项目' && ipmStatus === '已上市') return '已上市'
  if (projectType === '技术项目' && ipmStatus === '待立议') return '待立议'
  if (projectType === '技术项目' && ipmStatus === '待验') return '待验'
  return mapping[ipmStatus] || ipmStatus
}

// 项目状态颜色配置
const PROJECT_STATUS_CONFIG: Record<string, { color: string; tagColor: string }> = {
  '待立项': { color: '#faad14', tagColor: 'warning' },
  '待立议': { color: '#faad14', tagColor: 'warning' },
  '进行中': { color: '#1890ff', tagColor: 'processing' },
  '已完成': { color: '#52c41a', tagColor: 'success' },
  '已上市': { color: '#722ed1', tagColor: 'purple' },
  '维护': { color: '#13c2c2', tagColor: 'cyan' },
  '暂停': { color: '#d9d9d9', tagColor: 'default' },
  '已取消': { color: '#ff4d4f', tagColor: 'error' },
  '待验': { color: '#faad14', tagColor: 'warning' },
  '筹备中': { color: '#faad14', tagColor: 'warning' },
}

// 项目数据
const initialProjects = [
  {
    id: '1', name: 'X6877-D8400_H991', type: '整机产品项目' as const,
    status: '进行中', progress: 65, leader: '张三',
    markets: ['OP', 'TR', 'RU'], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '李白', updatedAt: '2小时前', productLine: 'NOTE', tosVersion: 'tOS 16.3',
    marketName: 'NOTE 50 Pro', brand: 'TECNO', developMode: 'ODC',
    planStartDate: '2026-01-01', planEndDate: '2026-06-30',
    developCycle: 120, healthStatus: 'normal' as const,
    model: 'X6877', mainboard: 'H991', born: 'B2026Q1',
    cpu: 'MT6877', memory: '8GB+256GB', lcd: '6.78" FHD+',
    frontCamera: '32MP', primaryCamera: '108MP+8MP+2MP',
    operatingSystem: 'Android 16', version: 'V1.0.0',
    buildAddress: 'https://build.example.com/X6877',
    productType: '新品', tosVersionName: 'tOS 16.3', versionType: 'Full',
    market: 'OP,TR,RU', ppm: '王明', tpm: '刘洋', projectLevel: 'A',
    currentNode: 'STR2', launchDate: '2026-06-15',
    screenShape: '直板', screenType: 'LCD', networkMode: '5G',
    kernelVersion: '5.15', lightEffect: '有', faceRecognition: '3D结构光',
    soundEffect: 'DTS', simCard: '双卡双待', motor: '线性马达',
    fingerprint: '侧边指纹', infrared: '有',
    branchInfo: 'main_dev_x6877', jenkinsUrl: 'https://jenkins.example.com/job/X6877',
  },
  {
    id: '3', name: 'X6855_H8917', type: '整机产品项目' as const,
    status: '进行中', progress: 45, leader: '王五',
    markets: ['OP', 'TR'], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '赵六', updatedAt: '3天前', productLine: 'SPARK', tosVersion: 'tOS 16.3',
    marketName: 'SPARK 30 Pro', brand: 'TECNO', developMode: 'JDM',
    planStartDate: '2026-02-01', planEndDate: '2026-08-31',
    developCycle: 140, healthStatus: 'warning' as const,
    model: 'X6855', mainboard: 'H8917', born: 'B2026Q1',
    cpu: 'MT6855', memory: '6GB+128GB', lcd: '6.67" HD+',
    frontCamera: '16MP', primaryCamera: '64MP+2MP+2MP',
    operatingSystem: 'Android 16', version: 'V1.0.0',
    buildAddress: 'https://build.example.com/X6855',
    productType: '新品', tosVersionName: 'tOS 16.3', versionType: 'Slim',
    market: 'OP,TR,RU', ppm: '赵敏', tpm: '李刚', projectLevel: 'B',
    currentNode: 'STR1', launchDate: '2026-09-01',
    screenShape: '水滴屏', screenType: 'OLED', networkMode: '5G',
    kernelVersion: '5.15', lightEffect: '有', faceRecognition: '2D',
    soundEffect: 'DTS', simCard: '双卡双待', motor: '转子马达',
    fingerprint: '屏下指纹', infrared: '无',
    branchInfo: 'main_dev_x6855', jenkinsUrl: 'https://jenkins.example.com/job/X6855',
  },
  {
    id: '2', name: 'tOS16.0', type: '产品项目' as const,
    status: '进行中', progress: 55, leader: '李四',
    markets: [], androidVersion: 'Android 15', chipPlatform: 'MTK',
    spm: '张三', updatedAt: '1天前', productLine: 'tOS', tosVersion: 'tOS 16.0',
    planStartDate: '2026-01-15', planEndDate: '2026-05-30',
    developCycle: 95, healthStatus: 'normal' as const,
    operatingSystem: 'Android 15', version: 'tOS16.0-V2',
    buildAddress: 'https://build.example.com/tOS16',
    currentNode: 'STR3', versionType: 'Full',
    versionFiveRoles: { '版本规划代表': '张三', '版本经理': '李四', '版本SE': '王五', '版本测试代表': '赵六', '版本质量代表': '孙七' },
    branchInfo: 'main_dev_tos16', jenkinsUrl: 'https://jenkins.example.com/job/tOS16',
  },
  {
    id: '6', name: 'tOS17.1', type: '产品项目' as const,
    status: '筹备中', progress: 15, leader: '赵六',
    markets: [], androidVersion: 'Android 16', chipPlatform: 'QCOM',
    spm: '李四', updatedAt: '3小时前', productLine: 'tOS', tosVersion: 'tOS 17.1',
    planStartDate: '2026-03-01', planEndDate: '2026-09-30',
    developCycle: 140, healthStatus: 'normal' as const,
    operatingSystem: 'Android 16', version: 'tOS17.1-V1',
    buildAddress: 'https://build.example.com/tOS17',
    currentNode: 'STR1', versionType: 'Slim',
    versionFiveRoles: { '版本规划代表': '赵六', '版本经理': '孙七', '版本SE': '李四', '版本测试代表': '王五', '版本质量代表': '张三' },
    branchInfo: 'main_dev_tos17', jenkinsUrl: 'https://jenkins.example.com/job/tOS17',
  },
  {
    id: '4', name: 'X6876_H786', type: '技术项目' as const,
    status: '已完成', progress: 100, leader: '孙七',
    markets: [], androidVersion: 'Android 15', chipPlatform: 'QCOM',
    spm: '李四', updatedAt: '5天前', productLine: '平台技术', tosVersion: 'tOS 15.0',
    planStartDate: '2025-10-01', planEndDate: '2026-02-28',
    developCycle: 100, healthStatus: 'normal' as const,
    operatingSystem: 'Android 15',
    buildAddress: 'https://build.example.com/X6876',
    currentNode: 'STR5', projectDescription: '平台技术预研项目，探索新一代芯片平台的适配与优化方案',
    branchInfo: 'main_dev_x6876', jenkinsUrl: 'https://jenkins.example.com/job/X6876',
    teamMembers: '孙七,李四,张三',
  },
  {
    id: '5', name: 'X6873_H972', type: '能力建设项目' as const,
    status: '进行中', progress: 30, leader: '周八',
    markets: [], androidVersion: 'Android 16', chipPlatform: 'UNISOC',
    spm: '王五', updatedAt: '1周前', productLine: '基础能力', tosVersion: 'tOS 16.2',
    planStartDate: '2026-02-15', planEndDate: '2026-07-31',
    developCycle: 110, healthStatus: 'risk' as const,
    operatingSystem: 'Android 16',
    buildAddress: 'https://build.example.com/X6873',
    projectDescription: '基础能力建设项目，提升团队自动化测试与CI/CD能力',
    teamMembers: '周八,王五,李白',
  },
  // 新增整机产品项目
  {
    id: '7', name: 'X6890-D8500_H1001', type: '整机产品项目' as const,
    status: '筹备中', progress: 10, leader: '李白',
    markets: ['OP', 'TR', 'RU', 'IN'], androidVersion: 'Android 16', chipPlatform: 'QCOM',
    spm: '张三', updatedAt: '1天前', productLine: 'CAMON', tosVersion: 'tOS 16.5',
    marketName: 'CAMON 40 Pro', brand: 'TECNO', developMode: 'ODC',
    planStartDate: '2026-03-15', planEndDate: '2026-10-31',
    developCycle: 155, healthStatus: 'normal' as const,
    model: 'X6890', mainboard: 'H1001', born: 'B2026Q2',
    cpu: 'SD8Gen3', memory: '12GB+512GB', lcd: '6.9" AMOLED',
    frontCamera: '50MP', primaryCamera: '200MP+12MP+5MP',
    operatingSystem: 'Android 16', version: 'V0.1.0',
    buildAddress: 'https://build.example.com/X6890',
    productType: '新品', versionType: 'Go',
    market: 'OP,TR,RU,IN', ppm: '王明', tpm: '刘洋', projectLevel: 'S',
    currentNode: '概念启动', launchDate: '2026-11-15',
    screenShape: '曲面屏', screenType: 'AMOLED', networkMode: '5G',
    kernelVersion: '6.1', lightEffect: '有', faceRecognition: '3D结构光',
    soundEffect: 'Dolby Atmos', simCard: '双卡双待', motor: '线性马达',
    fingerprint: '屏下超声波指纹', infrared: '有',
    branchInfo: 'main_dev_x6890', jenkinsUrl: 'https://jenkins.example.com/job/X6890',
  },
  // 新增软件产品项目
  {
    id: '8', name: 'tOS18.0', type: '产品项目' as const,
    status: '筹备中', progress: 5, leader: '杜甫',
    markets: [], androidVersion: 'Android 17', chipPlatform: 'MTK',
    spm: '赵六', updatedAt: '2天前', productLine: 'tOS', tosVersion: 'tOS 18.0',
    planStartDate: '2026-04-01', planEndDate: '2026-12-31',
    developCycle: 180, healthStatus: 'normal' as const,
    operatingSystem: 'Android 17', version: 'tOS18.0-V1',
    buildAddress: 'https://build.example.com/tOS18',
    currentNode: '概念启动', versionType: 'Go', brand: 'TECNO',
    versionFiveRoles: { '版本规划代表': '杜甫', '版本经理': '李白', '版本SE': '张三', '版本测试代表': '李四', '版本质量代表': '王五' },
    branchInfo: 'main_dev_tos18', jenkinsUrl: 'https://jenkins.example.com/job/tOS18',
  },
  // 新增技术项目
  {
    id: '9', name: 'AI-Engine-V2', type: '技术项目' as const,
    status: '进行中', progress: 40, leader: '李四',
    markets: [], androidVersion: 'Android 16', chipPlatform: 'MTK',
    spm: '张三', updatedAt: '4小时前', productLine: 'AI引擎', tosVersion: '',
    planStartDate: '2026-02-01', planEndDate: '2026-07-15',
    developCycle: 112, healthStatus: 'warning' as const,
    operatingSystem: 'Android 16',
    buildAddress: 'https://build.example.com/ai-engine-v2',
    currentNode: 'STR3', projectDescription: 'AI推理引擎V2版本，提升端侧大模型推理性能，支持多模态输入输出',
    branchInfo: 'main_dev_ai_engine_v2', jenkinsUrl: 'https://jenkins.example.com/job/ai-engine-v2',
    teamMembers: '李四,张三,赵六,孙七',
  },
  // 新增能力建设项目
  {
    id: '10', name: 'DevOps-Platform', type: '能力建设项目' as const,
    status: '进行中', progress: 55, leader: '孙七',
    markets: [], androidVersion: '', chipPlatform: '',
    spm: '李四', updatedAt: '6小时前', productLine: '工程效率', tosVersion: '',
    planStartDate: '2026-01-10', planEndDate: '2026-06-30',
    developCycle: 118, healthStatus: 'normal' as const,
    operatingSystem: '',
    buildAddress: '',
    projectDescription: 'DevOps平台建设，整合CI/CD流水线、自动化测试、代码质量门禁，提升研发交付效率',
    teamMembers: '孙七,周八,李白,杜甫,王五',
  },
]

const kanbanColumns = [
  { title: '概念阶段', key: 'concept', color: '#1890ff' },
  { title: '计划阶段', key: 'planning', color: '#52c41a' },
  { title: '开发阶段', key: 'developing', color: '#faad14' },
  { title: '发布阶段', key: 'released', color: '#722ed1' },
]

const DEFAULT_LOGIN_USER = '张三' // 默认登录用户（Mock）

// 项目-人员分配（Mock：每个项目在权限配置中分配了哪些用户）
const PROJECT_MEMBER_MAP: Record<string, string[]> = {
  '1': ['张三', '李四', '王五', '赵六', '李白'],         // X6877
  '3': ['王五', '赵六', '孙七'],                         // X6855
  '2': ['张三', '李四', '王五', '赵六', '孙七'],         // tOS16.0
  '6': ['赵六', '李四', '王五'],                         // tOS17.1
  '4': ['孙七', '李四', '张三'],                         // X6876_H786
  '5': ['周八', '王五', '李白'],                         // X6873_H972
  '7': ['李白', '张三', '王五'],                         // X6890 CAMON
  '8': ['杜甫', '李白', '张三', '李四', '王五'],         // tOS18.0
  '9': ['李四', '张三', '赵六', '孙七'],                 // AI-Engine-V2
  '10': ['孙七', '周八', '李白', '杜甫', '王五'],        // DevOps-Platform
}

const initialTodos = [
  { id: '1', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V2', versionId: 'v2', market: 'OP', responsible: '张三', priority: 'high', deadline: '2026-03-10', status: '进行中', taskDesc: '计划阶段任务待处理', category: 'overdue' as const },
  { id: '2', projectId: '3', projectName: 'X6855_H8917', planLevel: 'level2' as const, planType: '在研版本火车计划', planTabKey: 'plan1', versionNo: 'V2', versionId: 'v2', market: 'OP', responsible: '李四', priority: 'medium', deadline: '2026-04-05', status: '待处理', taskDesc: 'STR2 任务审核', category: 'pending' as const },
  { id: '3', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level2' as const, planType: '需求开发计划', planTabKey: 'plan0', versionNo: 'V2', versionId: 'v2', market: 'TR', responsible: '张三', priority: 'low', deadline: '2026-04-03', status: '待处理', taskDesc: '开发验证阶段安排', category: 'upcoming' as const },
  { id: '4', projectId: '2', projectName: 'tOS16.0', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V1', versionId: 'v1', market: '', responsible: '张三', priority: 'high', deadline: '2026-03-12', status: '进行中', taskDesc: '里程碑STR1待确认', category: 'overdue' as const },
  { id: '5', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level2' as const, planType: '1+N MR版本火车计划', planTabKey: 'plan2', versionNo: 'V1', versionId: 'v1', market: 'OP', responsible: '李四', priority: 'medium', deadline: '2026-04-18', status: '待处理', taskDesc: 'FR版本转测安排', category: 'pending' as const },
  { id: '6', projectId: '3', projectName: 'X6855_H8917', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V1', versionId: 'v1', market: 'OP', responsible: '张三', priority: 'low', deadline: '2026-02-28', status: '已完成', taskDesc: '概念阶段已完成', category: 'completed' as const },
]

const VERSION_DATA = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
  { id: 'v3', versionNo: 'V3', status: '已发布' },
]

const LEVEL1_TASKS = [
  { id: '1', order: 1, taskName: '概念', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-15', estimatedDays: 15, actualStartDate: '2026-01-01', actualEndDate: '2026-01-14', actualDays: 14 },
  { id: '1.1', parentId: '1', order: 1, taskName: '概念启动', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-07', estimatedDays: 7, actualStartDate: '2026-01-01', actualEndDate: '2026-01-07', actualDays: 7 },
  { id: '1.2', parentId: '1', order: 2, taskName: 'STR1', status: '已完成', progress: 100, responsible: '李四', predecessor: '1.1', planStartDate: '2026-01-08', planEndDate: '2026-01-15', estimatedDays: 8, actualStartDate: '2026-01-08', actualEndDate: '2026-01-14', actualDays: 7 },
  { id: '2', order: 2, taskName: '计划', status: '进行中', progress: 60, responsible: '王五', predecessor: '1.2', planStartDate: '2026-01-16', planEndDate: '2026-02-15', estimatedDays: 30, actualStartDate: '2026-01-16', actualEndDate: '', actualDays: 18 },
  { id: '2.1', parentId: '2', order: 1, taskName: 'STR2', status: '进行中', progress: 60, responsible: '王五', predecessor: '1.2', planStartDate: '2026-01-16', planEndDate: '2026-01-31', estimatedDays: 15, actualStartDate: '2026-01-16', actualEndDate: '', actualDays: 12 },
  { id: '2.2', parentId: '2', order: 2, taskName: 'STR3', status: '未开始', progress: 0, responsible: '赵六', predecessor: '2.1', planStartDate: '2026-02-01', planEndDate: '2026-02-15', estimatedDays: 15, actualStartDate: '', actualEndDate: '', actualDays: 0 },
  { id: '3', order: 3, taskName: '开发验证', status: '未开始', progress: 0, responsible: '', predecessor: '2.2', planStartDate: '2026-02-16', planEndDate: '2026-03-15', estimatedDays: 28, actualStartDate: '', actualEndDate: '', actualDays: 0 },
  { id: '4', order: 4, taskName: '上市保障', status: '未开始', progress: 0, responsible: '', predecessor: '3', planStartDate: '2026-03-16', planEndDate: '2026-04-15', estimatedDays: 30, actualStartDate: '', actualEndDate: '', actualDays: 0 },
]

const ALL_COLUMNS = [
  { key: 'id', title: '序号', default: true },
  { key: 'taskName', title: '任务名称', default: true },
  { key: 'responsible', title: '责任人', default: true },
  { key: 'predecessor', title: '前置任务', default: true },
  { key: 'planStartDate', title: '计划开始', default: true },
  { key: 'planEndDate', title: '计划完成', default: true },
  { key: 'estimatedDays', title: '预估工期', default: true },
  { key: 'actualStartDate', title: '实际开始', default: true },
  { key: 'actualEndDate', title: '实际完成', default: true },
  { key: 'actualDays', title: '实际工期', default: true },
  { key: 'status', title: '状态', default: true },
  { key: 'progress', title: '进度', default: true },
]

// IR需求Mock数据
// IR/SR需求数据已移至 RequirementDevPlan 组件

// 拖拽上下文 - 将 listeners 传递给拖拽手柄而非整行
const DragHandleContext = createContext<Record<string, any>>({})

// 可排序行组件 - 不再将 listeners 绑定到整行
function SortableRow({ children, ...props }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props['data-row-key'] })
  const style = { ...props.style, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <DragHandleContext.Provider value={listeners || {}}>
      <tr ref={setNodeRef} style={style} {...attributes}>{children}</tr>
    </DragHandleContext.Provider>
  )
}

// 拖拽手柄组件
function DragHandle() {
  const listeners = useContext(DragHandleContext)
  return <HolderOutlined style={{ cursor: 'grab', color: '#999' }} {...listeners} />
}

export default function Home() {
  // const router = useRouter()
  const [activeModule, setActiveModule] = useState<string>('projects')
  const [projectView, setProjectView] = useState<string>('card')
  const [todoCollapsed, setTodoCollapsed] = useState(false)
  const [projectSearchText2, setProjectSearchText2] = useState('')
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('all')
  const [projectListView, setProjectListView] = useState<'card' | 'list'>('card')
  const [projectCardPage, setProjectCardPage] = useState(1)
  const projectCardPageSize = 9
  const [projects, setProjects] = useState(initialProjects)
  const [todos] = useState(initialTodos)
  const [todoFilter, setTodoFilter] = useState<'all' | 'overdue' | 'upcoming' | 'pending' | 'completed'>('all')
  const [selectedProject, setSelectedProject] = useState<typeof initialProjects[0] | null>(null)
  const [basicInfoEditMode, setBasicInfoEditMode] = useState(false)
  const [editingProjectFields, setEditingProjectFields] = useState<Record<string, any>>({})

  // 配置相关状态
  const [selectedProjectType, setSelectedProjectType] = useState(PROJECT_TYPES[0])
  const [planLevel, setPlanLevel] = useState<string>('level1')
  const [selectedPlanType, setSelectedPlanType] = useState(LEVEL2_PLAN_TYPES[0])
  const [customTypes, setCustomTypes] = useState<string[]>([])
  const [versions, setVersions] = useState(VERSION_DATA)
  const [currentVersion, setCurrentVersion] = useState('v3')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  const [isEditMode, setIsEditMode] = useState(false)
  const [tasks, setTasks] = useState(LEVEL1_TASKS)
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('table')
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [showVersionCompare, setShowVersionCompare] = useState(false)
  const [compareVersionA, setCompareVersionA] = useState('v1')
  const [compareVersionB, setCompareVersionB] = useState('v3')
  const [compareResult, setCompareResult] = useState<CompareTableRow[]>([])
  
  // 项目空间
  const [projectSpaceModule, setProjectSpaceModule] = useState('basic')
  const [ganttEditingTask, setGanttEditingTask] = useState<any>(null)

  // ========== 转维系统状态 ==========
  const [currentUser, setCurrentUser] = useState(MOCK_TM_USERS[0]) // 张明辉 SPM
  const [currentLoginUser, setCurrentLoginUser] = useState(DEFAULT_LOGIN_USER)
  const [configTab, setConfigTab] = useState('plan')
  const [transferConfigView, setTransferConfigView] = useState<'home' | 'checklist' | 'review'>('home')
  const [tmConfigSearchText, setTmConfigSearchText] = useState('')
  const [tmConfigSelectedVersion, setTmConfigSelectedVersion] = useState('v3.0')
  const [tmConfigDiffOpen, setTmConfigDiffOpen] = useState(false)
  const [tmConfigDiffFrom, setTmConfigDiffFrom] = useState('v2.0')
  const [tmConfigDiffTo, setTmConfigDiffTo] = useState('v3.0')
  const [transferView, setTransferView] = useState<null | 'apply' | 'detail' | 'entry' | 'review' | 'sqa-review'>(null)
  const [selectedTransferAppId, setSelectedTransferAppId] = useState<string | null>(null)
  const [transferApplications, setTransferApplications] = useState(MOCK_TRANSFER_APPLICATIONS)
  const [tmChecklistItems, setTmChecklistItems] = useState(MOCK_CHECKLIST_ITEMS)
  const [tmReviewElements, setTmReviewElements] = useState(MOCK_REVIEW_ELEMENTS)
  const [tmBlockTasks, setTmBlockTasks] = useState(MOCK_BLOCK_TASKS)
  const [tmLegacyTasks, setTmLegacyTasks] = useState(MOCK_LEGACY_TASKS)
  // 转维申请表单
  const [tmApplyProject, setTmApplyProject] = useState('')
  const [tmApplyDate, setTmApplyDate] = useState('')
  const [tmApplyRemark, setTmApplyRemark] = useState('')
  const [tmApplyTeam, setTmApplyTeam] = useState<{ research: TMTeamMember[]; maintenance: TMTeamMember[] }>({ research: [], maintenance: [] })
  // 转维详情/评审 modal
  const [tmModalVisible, setTmModalVisible] = useState(false)
  const [tmModalTitle, setTmModalTitle] = useState('')
  const [tmModalContent, setTmModalContent] = useState('')
  // 详情结果弹窗（AI检查/审核意见）
  const [tmDetailModalVisible, setTmDetailModalVisible] = useState(false)
  const [tmDetailModalTitle, setTmDetailModalTitle] = useState('')
  const [tmDetailModalContent, setTmDetailModalContent] = useState('')
  // 关闭流水线
  const [tmCloseModalVisible, setTmCloseModalVisible] = useState(false)
  const [tmCloseAppId, setTmCloseAppId] = useState<string | null>(null)
  const [tmCloseReason, setTmCloseReason] = useState('')
  // 转维资料录入
  const [tmEntryTab, setTmEntryTab] = useState<'checklist' | 'review'>('checklist')
  const [tmEntryModalOpen, setTmEntryModalOpen] = useState(false)
  const [tmEntryModalRecord, setTmEntryModalRecord] = useState<any>(null)
  const [tmEntryContent, setTmEntryContent] = useState('')
  const [tmEntryActiveRole, setTmEntryActiveRole] = useState<string>('all')
  // 转维审核
  const [tmReviewTab, setTmReviewTab] = useState<'checklist' | 'review'>('checklist')
  const [tmReviewModalOpen, setTmReviewModalOpen] = useState(false)
  const [tmReviewAction, setTmReviewAction] = useState<'pass' | 'reject'>('pass')
  const [tmReviewRecord, setTmReviewRecord] = useState<any>(null)
  const [tmReviewComment, setTmReviewComment] = useState('')
  const [tmReviewActiveRole, setTmReviewActiveRole] = useState<string>('all')
  // SQA审核
  const [tmSqaComment, setTmSqaComment] = useState('')
  const [tmSqaModalOpen, setTmSqaModalOpen] = useState(false)
  const [tmSqaAction, setTmSqaAction] = useState<'approve' | 'reject'>('approve')

  // 当前项目的转维申请
  const currentProjectTransferApps = useMemo(() =>
    transferApplications.filter(a => a.projectName === selectedProject?.name),
    [transferApplications, selectedProject]
  )
  
  // 项目空间-计划
  const [projectPlanLevel, setProjectPlanLevel] = useState<string>('level1')
  const [projectPlanViewMode, setProjectPlanViewMode] = useState<'table' | 'horizontal' | 'gantt'>('table')
  const [projectPlanOverviewTab, setProjectPlanOverviewTab] = useState<string>('overview')
  const [level2PlanTasks, setLevel2PlanTasks] = useState<any[]>([
    // 在研版本火车计划 - 三层结构 (plan1)
    { id: '1', order: 1, taskName: '16.3.030', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-02-01', planId: 'plan1' },
    { id: '1.1', parentId: '1', order: 1, taskName: '需求分析', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-15', planId: 'plan1' },
    { id: '1.1.1', parentId: '1.1', order: 1, taskName: 'IR需求梳理', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-07', planId: 'plan1' },
    { id: '1.1.2', parentId: '1.1', order: 2, taskName: 'SR需求拆分', status: '已完成', progress: 100, responsible: '李四', predecessor: '1.1.1', planStartDate: '2026-01-08', planEndDate: '2026-01-15', planId: 'plan1' },
    { id: '1.2', parentId: '1', order: 2, taskName: '开发集成', status: '已完成', progress: 100, responsible: '王五', predecessor: '1.1', planStartDate: '2026-01-16', planEndDate: '2026-02-01', planId: 'plan1' },
    { id: '2', order: 2, taskName: '16.3.031', status: '进行中', progress: 60, responsible: '李四', predecessor: '1', planStartDate: '2026-02-02', planEndDate: '2026-03-15', planId: 'plan1' },
    { id: '2.1', parentId: '2', order: 1, taskName: '功能开发', status: '进行中', progress: 70, responsible: '李四', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-28', planId: 'plan1' },
    { id: '2.1.1', parentId: '2.1', order: 1, taskName: 'Camera模块', status: '已完成', progress: 100, responsible: '李四', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-15', planId: 'plan1' },
    { id: '2.1.2', parentId: '2.1', order: 2, taskName: 'Display模块', status: '进行中', progress: 40, responsible: '赵六', predecessor: '2.1.1', planStartDate: '2026-02-16', planEndDate: '2026-02-28', planId: 'plan1' },
    { id: '2.2', parentId: '2', order: 2, taskName: '集成测试', status: '未开始', progress: 0, responsible: '王五', predecessor: '2.1', planStartDate: '2026-03-01', planEndDate: '2026-03-15', planId: 'plan1' },
    { id: '3', order: 3, taskName: '16.3.032', status: '未开始', progress: 0, responsible: '王五', predecessor: '2', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan1' },
    // FR版本火车计划 - 三层结构 (plan2)
    { id: '1', order: 1, taskName: '版本规划', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-02-02', planId: 'plan2' },
    { id: '1.1', parentId: '1', order: 1, taskName: '修改点收集', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-01-20', planId: 'plan2' },
    { id: '1.1.1', parentId: '1.1', order: 1, taskName: '需求变更评审', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-01-10', planId: 'plan2' },
    { id: '1.1.2', parentId: '1.1', order: 2, taskName: '修改点确认', status: '已完成', progress: 100, responsible: '孙七', predecessor: '1.1.1', planStartDate: '2026-01-11', planEndDate: '2026-01-20', planId: 'plan2' },
    { id: '1.2', parentId: '1', order: 2, taskName: '版本计划制定', status: '已完成', progress: 100, responsible: '孙七', predecessor: '1.1', planStartDate: '2026-01-21', planEndDate: '2026-02-02', planId: 'plan2' },
    { id: '2', order: 2, taskName: '版本开发', status: '进行中', progress: 50, responsible: '孙七', predecessor: '1', planStartDate: '2026-02-02', planEndDate: '2026-03-15', planId: 'plan2' },
    { id: '2.1', parentId: '2', order: 1, taskName: 'MP分支入库', status: '进行中', progress: 60, responsible: '孙七', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-03-01', planId: 'plan2' },
    { id: '2.1.1', parentId: '2.1', order: 1, taskName: '代码合入', status: '已完成', progress: 100, responsible: '孙七', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-15', planId: 'plan2' },
    { id: '2.1.2', parentId: '2.1', order: 2, taskName: '编译验证', status: '进行中', progress: 30, responsible: '周八', predecessor: '2.1.1', planStartDate: '2026-02-16', planEndDate: '2026-03-01', planId: 'plan2' },
    { id: '2.2', parentId: '2', order: 2, taskName: 'MR版本转测', status: '未开始', progress: 0, responsible: '周八', predecessor: '2.1', planStartDate: '2026-03-02', planEndDate: '2026-03-15', planId: 'plan2' },
    { id: '3', order: 3, taskName: '版本测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '2', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan2' },
    { id: '3.1', parentId: '3', order: 1, taskName: 'MR版本测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan2' },
    { id: '3.1.1', parentId: '3.1', order: 1, taskName: '冒烟测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-03-25', planId: 'plan2' },
    { id: '3.1.2', parentId: '3.1', order: 2, taskName: '回归测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '3.1.1', planStartDate: '2026-03-26', planEndDate: '2026-05-01', planId: 'plan2' },
    // MR版本火车计划 (plan3)
    { id: '1', order: 1, taskName: 'MR版本规划', status: '未开始', progress: 0, responsible: '周八', predecessor: '', planStartDate: '2026-03-01', planEndDate: '2026-03-15', planId: 'plan3' },
    { id: '1.1', parentId: '1', order: 1, taskName: '版本需求整理', status: '未开始', progress: 0, responsible: '周八', predecessor: '', planStartDate: '2026-03-01', planEndDate: '2026-03-10', planId: 'plan3' },
    { id: '1.2', parentId: '1', order: 2, taskName: '版本计划评审', status: '未开始', progress: 0, responsible: '周八', predecessor: '1.1', planStartDate: '2026-03-11', planEndDate: '2026-03-15', planId: 'plan3' },
    { id: '2', order: 2, taskName: 'MR版本开发', status: '未开始', progress: 0, responsible: '吴九', predecessor: '1', planStartDate: '2026-03-16', planEndDate: '2026-04-15', planId: 'plan3' },
    { id: '2.1', parentId: '2', order: 1, taskName: '功能修复', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-04-01', planId: 'plan3' },
    { id: '2.2', parentId: '2', order: 2, taskName: '版本集成', status: '未开始', progress: 0, responsible: '吴九', predecessor: '2.1', planStartDate: '2026-04-02', planEndDate: '2026-04-15', planId: 'plan3' },
  ])
  const [level2PlanMilestones, setLevel2PlanMilestones] = useState<string[]>([])
  const [createdLevel2Plans, setCreatedLevel2Plans] = useState<{id: string, name: string, type: string, fixed?: boolean}[]>([
    ...FIXED_LEVEL2_PLANS,
    { id: 'plan2', name: 'FR版本火车计划', type: 'FR版本火车计划' },
    { id: 'plan3', name: 'MR1版本火车计划', type: 'MR版本火车计划' },
  ])  // 已创建的二级计划列表（前两项为固定计划，不可删除）
  const [activeLevel2Plan, setActiveLevel2Plan] = useState<string>('plan0')  // 当前查看的二级计划
  
  // 项目空间-市场Tab
  const [selectedMarketTab, setSelectedMarketTab] = useState<string>('OP')

  // 市场维度的计划数据（整机产品项目按市场分别配置）
  const [marketPlanData, setMarketPlanData] = useState<Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: {id: string, name: string, type: string}[] }>>({
    'OP': { tasks: [...LEVEL1_TASKS], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
    'TR': { tasks: [...LEVEL1_TASKS.map(t => ({...t}))], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
    'RU': { tasks: [...LEVEL1_TASKS.map(t => ({...t}))], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
  })

  // 项目搜索下拉
  const [showProjectSearch, setShowProjectSearch] = useState(false)
  const [projectSearchText, setProjectSearchText] = useState('')
  const projectSearchRef = useRef<HTMLDivElement>(null)

  // 编辑离开确认
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)

  // 二级计划创建
  const [showCreateLevel2Plan, setShowCreateLevel2Plan] = useState(false)
  const [selectedLevel2PlanType, setSelectedLevel2PlanType] = useState('1+N MR版本火车计划')
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([])
  const [selectedMRVersion, setSelectedMRVersion] = useState<string>('FR')  // MR版本类型
  // irSrView 已移至 RequirementDevPlan 组件
  
  // 二级计划时间约束警告状态
  const [milestoneTimeWarning, setMilestoneTimeWarning] = useState<{visible: boolean, violations: any[], message: string}>({visible: false, violations: [], message: ''})

  // 二级计划元数据（保存创建时填写的表单信息）
  const [level2PlanMeta, setLevel2PlanMeta] = useState<Record<string, any>>({
    plan2: {
      planType: '1+N MR版本火车计划', planName: 'FR版本火车计划', mrVersion: 'FR',
      productLine: 'NOTE', marketName: 'OP', projectName: 'X6877-D8400_H991',
      chipVendor: 'MTK', tosVersion: '16.3.050', branch: '16.3.050_main',
      isMada: '否', madaMarket: '', spm: '李白', tpm: '王五', contact: '孙七',
      projectVersion: 'V1.0.0', transferType: '1',
    },
    plan3: {
      planType: '1+N MR版本火车计划', planName: 'MR1版本火车计划', mrVersion: 'MR1',
      productLine: 'NOTE', marketName: 'OP', projectName: 'X6877-D8400_H991',
      chipVendor: 'MTK', tosVersion: '16.3.051', branch: '16.3.050_MR1',
      isMada: '是', madaMarket: 'EU', spm: '张三', tpm: '赵六', contact: '周八',
      projectVersion: 'V1.1.0', transferType: '2',
    },
  })
  const [createFormValues, setCreateFormValues] = useState<Record<string, string>>({})

  // ========== 权限配置 ==========
  const FIXED_ROLES = ['系统管理员', '产品经理', '项目经理', '开发代表', '软件SE', '设计师', '开发工程师', '测试工程师', '管理层']
  const ALL_USERS = ['张三', '李四', '王五', '赵六', '孙七', '周八', '李白', '杜甫']
  const PERMISSION_MODULES = [
    { key: 'basicInfo', name: '基础信息', permissions: ['查看', '编辑'] },
    { key: 'requirements', name: '需求', permissions: [] as string[] },
    { key: 'plan', name: '计划', permissions: ['一级计划-查看', '一级计划-编辑', '一级计划-审核', '二级计划-查看', '二级计划-编辑', '导入/导出'] },
    { key: 'resources', name: '资源', permissions: ['查看'] },
    { key: 'tasks', name: '任务', permissions: ['查看'] },
    { key: 'risks', name: '风险', permissions: ['查看'] },
  ]
  const [roles, setRoles] = useState<{name: string; members: string[]; isFixed: boolean}[]>([
    { name: '系统管理员', members: ['张三'], isFixed: true },
    { name: '产品经理', members: ['李四', '王五'], isFixed: true },
    { name: '项目经理', members: ['张三', '赵六'], isFixed: true },
    { name: '开发代表', members: ['王五'], isFixed: true },
    { name: '软件SE', members: ['孙七'], isFixed: true },
    { name: '设计师', members: ['周八'], isFixed: true },
    { name: '开发工程师', members: ['李白', '杜甫'], isFixed: true },
    { name: '测试工程师', members: ['赵六', '孙七'], isFixed: true },
    { name: '管理层', members: ['张三'], isFixed: true },
  ])
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>(() => {
    const init: Record<string, Record<string, boolean>> = {}
    const defaultPerms: Record<string, string[]> = {
      '系统管理员': PERMISSION_MODULES.flatMap(m => m.permissions.map(p => `${m.key}:${p}`)),
      '项目经理': ['basicInfo:查看', 'basicInfo:编辑', 'plan:一级计划-查看', 'plan:一级计划-编辑', 'plan:二级计划-查看', 'plan:二级计划-编辑', 'plan:导入/导出', 'resources:查看', 'tasks:查看', 'risks:查看'],
      '产品经理': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'resources:查看', 'tasks:查看', 'risks:查看'],
      '开发代表': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
      '软件SE': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
      '设计师': ['basicInfo:查看'],
      '开发工程师': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
      '测试工程师': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看', 'risks:查看'],
      '管理层': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'resources:查看', 'tasks:查看', 'risks:查看'],
    }
    FIXED_ROLES.forEach(r => { init[r] = {}; (defaultPerms[r] || []).forEach(p => { init[r][p] = true }) })
    return init
  })
  const [showAddRoleModal, setShowAddRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [editingRoleName, setEditingRoleName] = useState<string | null>(null)
  const [editRoleNameValue, setEditRoleNameValue] = useState('')
  const [permissionActiveRole, setPermissionActiveRole] = useState('系统管理员')
  const [permConfigTab, setPermConfigTab] = useState<'roles' | 'perms'>('roles')

  // ========== 全局权限配置 ==========
  const GLOBAL_PERM_OPTIONS = [
    { key: 'roadmap:view', module: '项目路标', name: '查看' },
    { key: 'roadmap:edit', module: '项目路标', name: '编辑' },
    { key: 'roadmap:baseline', module: '项目路标', name: '基线' },
    { key: 'roadmap:export', module: '项目路标', name: '导出' },
    { key: 'viewBoard:placeholder', module: '视图看板', name: '' },
    { key: 'resourceMgmt:placeholder', module: '资源管理', name: '' },
    { key: 'configCenter:placeholder', module: '配置中心', name: '' },
  ]
  const [globalRoles, setGlobalRoles] = useState<{name: string; members: string[]}[]>([
    { name: '管理组', members: ['张三', '李白'] },
    { name: '编辑组', members: ['李四', '赵六', '王五'] },
    { name: '查看组', members: ['孙七', '周八', '杜甫'] },
  ])
  const [globalRolePerms, setGlobalRolePerms] = useState<Record<string, Record<string, boolean>>>({
    '管理组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': true },
    '编辑组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': true },
    '查看组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': false },
  })
  const [globalPermTab, setGlobalPermTab] = useState<'roles' | 'perms'>('roles')
  const [showGlobalAddRole, setShowGlobalAddRole] = useState(false)
  const [globalNewRoleName, setGlobalNewRoleName] = useState('')
  const [globalEditingRole, setGlobalEditingRole] = useState<string | null>(null)
  const [globalEditRoleValue, setGlobalEditRoleValue] = useState('')
  const [globalPermActiveRole, setGlobalPermActiveRole] = useState('管理组')

  // 当前用户是否为管理组成员
  const isAdminUser = useMemo(() => {
    const adminGroup = globalRoles.find(r => r.name === '管理组')
    return adminGroup ? adminGroup.members.includes(currentLoginUser) : false
  }, [globalRoles, currentLoginUser])

  // 当前用户可见的项目（管理组可看全部，其他用户只看自己被分配的项目）
  const visibleProjects = useMemo(() => {
    if (isAdminUser) return projects
    return projects.filter(p => {
      const members = PROJECT_MEMBER_MAP[p.id] || []
      return members.includes(currentLoginUser)
    })
  }, [projects, isAdminUser, currentLoginUser])

  const workspaceFilteredProjects = useMemo(() => {
    let result = visibleProjects
    if (projectSearchText2) {
      const keyword = projectSearchText2.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(keyword) || (p.marketName && p.marketName.toLowerCase().includes(keyword)))
    }
    if (projectStatusFilter !== 'all') {
      result = result.filter(p => p.status === projectStatusFilter)
    }
    return result
  }, [visibleProjects, projectSearchText2, projectStatusFilter])

  // 带编辑保护的导航函数 - 如果当前在编辑模式，弹出确认框
  const navigateWithEditGuard = (action: () => void) => {
    if (isEditMode && !isCurrentDraft) {
      setPendingNavigation(() => action)
      setShowLeaveConfirm(true)
    } else {
      action()
    }
  }

  // 确认离开编辑
  const handleConfirmLeave = () => {
    setIsEditMode(false)
    setShowLeaveConfirm(false)
    if (pendingNavigation) {
      pendingNavigation()
      setPendingNavigation(null)
    }
  }

  // 取消离开
  const handleCancelLeave = () => {
    setShowLeaveConfirm(false)
    setPendingNavigation(null)
  }

  // 点击外部关闭项目搜索下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectSearchRef.current && !projectSearchRef.current.contains(e.target as Node)) {
        setShowProjectSearch(false)
      }
    }
    if (showProjectSearch) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProjectSearch])

  // 项目模糊搜索过滤
  const filteredProjects = visibleProjects.filter(p => {
    if (!projectSearchText) return true
    return p.name.toLowerCase().includes(projectSearchText.toLowerCase()) ||
      p.type.includes(projectSearchText) ||
      p.leader.includes(projectSearchText)
  })

  // 获取当前市场的计划数据（整机产品项目）
  const isWholeMachineProject = selectedProject?.type === '整机产品项目'
  const currentMarketData = isWholeMachineProject ? marketPlanData[selectedMarketTab] : null

  // 检查是否有一级计划已发布
  const hasPublishedLevel1Plan = versions.some(v => v.status === '已发布')
  
  // 跨里程碑拆分挂靠 - 计划融合算法
  // 功能：将跨里程碑的二级计划子活动拆分并挂靠到对应时间范围的里程碑下
  const mergePlans = (level1Tasks: any[], level2Tasks: any[]) => {
    if (!level1Tasks || !level2Tasks) return []
    
    // 1. 获取一级计划中的里程碑（二级活动，有parentId的）
    const milestones = level1Tasks.filter(t => t.parentId)
    
    // 2. 构建里程碑时间范围映射
    const milestoneRanges: Record<string, { start: Date, end: Date, parentId: string, parentName: string }> = {}
    milestones.forEach(m => {
      if (m.planStartDate && m.planEndDate) {
        milestoneRanges[m.id] = {
          start: new Date(m.planStartDate),
          end: new Date(m.planEndDate),
          parentId: m.parentId,
          parentName: level1Tasks.find(t => t.id === m.parentId)?.taskName || ''
        }
      }
    })
    
    // 3. 对二级计划任务进行拆分
    const mergedTasks: any[] = []
    const level2Plans = level2Tasks.filter(t => !t.parentId || !t.id.startsWith('l2-'))
    
    // 先添加一级计划
    level1Tasks.forEach(task => {
      mergedTasks.push({ ...task, source: 'level1', children: [] })
    })
    
    // 4. 处理二级计划，挂靠到对应里程碑
    level2Tasks.forEach(l2Task => {
      // 跳过顶级计划类型，只处理子任务
      if (!l2Task.parentId || !l2Task.parentId.startsWith('plan')) return
      
      const l2Start = new Date(l2Task.planStartDate)
      const l2End = new Date(l2Task.planEndDate)
      
      // 查找所有与该任务时间重叠的里程碑
      const overlappingMilestones = Object.entries(milestoneRanges).filter(([milestoneId, range]) => {
        return l2Start <= range.end && l2End >= range.start
      })
      
      if (overlappingMilestones.length === 0) {
        // 没有重叠的里程碑，尝试挂靠到最近的里程碑
        const allMilestoneStarts = Object.values(milestoneRanges).map(r => r.start.getTime())
        const l2StartTime = l2Start.getTime()
        const closest = allMilestoneStarts.reduce((prev, curr) => 
          Math.abs(curr - l2StartTime) < Math.abs(prev - l2StartTime) ? curr : prev
        , allMilestoneStarts[0])
        
        const closestMilestone = Object.entries(milestoneRanges).find(([_, r]) => r.start.getTime() === closest)
        if (closestMilestone) {
          mergedTasks.push({
            ...l2Task,
            source: 'level2',
            milestoneId: closestMilestone[0],
            milestoneName: milestoneRanges[closestMilestone[0]].parentName
          })
        }
      } else if (overlappingMilestones.length === 1) {
        // 只有一个重叠，直接挂靠
        const [milestoneId, range] = overlappingMilestones[0]
        mergedTasks.push({
          ...l2Task,
          source: 'level2',
          milestoneId,
          milestoneName: range.parentName
        })
      } else {
        // 跨多个里程碑，需要拆分
        overlappingMilestones.forEach(([milestoneId, range], index) => {
          // 计算拆分后的时间范围
          const splitStart = l2Start > range.start ? l2Start : range.start
          const splitEnd = l2End < range.end ? l2End : range.end
          
          mergedTasks.push({
            ...l2Task,
            id: `${l2Task.id}-split-${index}`,
            source: 'level2',
            milestoneId,
            milestoneName: range.parentName,
            planStartDate: splitStart.toISOString().split('T')[0],
            planEndDate: splitEnd.toISOString().split('T')[0],
            isSplit: true,
            splitInfo: `拆分${index + 1}/${overlappingMilestones.length}`
          })
        })
      }
    })
    
    return mergedTasks
  }
  
  // 根据当前Tab获取展示的任务
  const getOverviewTasks = () => {
    if (projectPlanOverviewTab === 'level1') {
      return tasks
    } else if (projectPlanOverviewTab === 'level2') {
      return level2PlanTasks
    } else {
      // 总览 - 融合模式
      return mergePlans(tasks, level2PlanTasks)
    }
  }
  
  // 自定义类型管理
  const [showAddCustomType, setShowAddCustomType] = useState(false)
  const [newCustomTypeName, setNewCustomTypeName] = useState('')

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const allPlanTypes = [...LEVEL2_PLAN_TYPES, ...customTypes]
  const hasDraftVersion = versions.some(v => v.status === '修订中')
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'

  // 修订版本自动进入编辑状态，已发布版本退出编辑
  useEffect(() => {
    if (isCurrentDraft) {
      setIsEditMode(true)
      // 一级计划编辑时不支持横版表格，自动切换到竖版
      if (projectPlanViewMode === 'horizontal') {
        setProjectPlanViewMode('table')
      }
    } else {
      setIsEditMode(false)
    }
  }, [currentVersion, isCurrentDraft])

  // 搜索所有字段
  const filteredTasks = (tasks as any[]).filter((task: any) => {
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      task.id.toLowerCase().includes(searchLower) ||
      task.taskName.toLowerCase().includes(searchLower) ||
      (task.responsible && task.responsible.toLowerCase().includes(searchLower)) ||
      (task.predecessor && task.predecessor.toLowerCase().includes(searchLower)) ||
      (task.planStartDate && task.planStartDate.toLowerCase().includes(searchLower)) ||
      (task.planEndDate && task.planEndDate.toLowerCase().includes(searchLower)) ||
      (task.estimatedDays && String(task.estimatedDays).includes(searchLower)) ||
      (task.actualStartDate && task.actualStartDate.toLowerCase().includes(searchLower)) ||
      (task.actualEndDate && task.actualEndDate.toLowerCase().includes(searchLower)) ||
      (task.actualDays && String(task.actualDays).includes(searchLower)) ||
      (task.status && task.status.toLowerCase().includes(searchLower)) ||
      (task.progress && String(task.progress).includes(searchLower))
    )
  })

  const handleAddSubTask = (parentId: string) => {
    // 判断当前操作的任务列表上下文
    const isLevel2Context = (activeModule === 'config' && planLevel === 'level2') || (activeModule === 'projectSpace' && projectPlanLevel === 'level2')
    const isLevel2TaskContext = isLevel2Context && activeLevel2Plan
    const currentTasks = isLevel2TaskContext ? level2PlanTasks.filter(t => t.planId === activeLevel2Plan) : tasks
    const parentTask = currentTasks.find(t => t.id === parentId)
    if (!parentTask) return
    // 检查层级限制：一级计划最多2层，二级计划最多3层
    const depth = getTaskDepth(parentTask, currentTasks)
    const maxDepth = isLevel2Context ? 3 : 2
    if (depth + 1 >= maxDepth) {
      message.warning(`${isLevel2Context ? '二级' : '一级'}计划最多支持${maxDepth}层活动`)
      return
    }
    const siblingTasks = currentTasks.filter(t => t.parentId === parentId)
    const newOrder = siblingTasks.length + 1
    const newId = `${parentId}.${newOrder}`
    const newTask: any = { id: newId, parentId, order: newOrder, taskName: '新子任务', status: '未开始', progress: 0, responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
    if (isLevel2TaskContext && parentTask.planId) newTask.planId = parentTask.planId
    // 在父任务及其最后一个子任务之后插入
    const parentIndex = currentTasks.findIndex(t => t.id === parentId)
    let insertIndex = parentIndex + 1
    for (let i = parentIndex + 1; i < currentTasks.length; i++) {
      if (currentTasks[i].parentId === parentId || (currentTasks[i].parentId && currentTasks.find(t => t.id === currentTasks[i].parentId)?.parentId === parentId)) {
        insertIndex = i + 1
      } else {
        break
      }
    }
    if (isLevel2TaskContext) {
      const updatedTasks = [...currentTasks]
      updatedTasks.splice(insertIndex, 0, newTask)
      setLevel2PlanTasks(prev => [...prev.filter(t => t.planId !== activeLevel2Plan), ...updatedTasks])
    } else {
      const newTasks = [...tasks]
      const globalIndex = tasks.findIndex(t => t.id === parentId)
      let globalInsertIndex = globalIndex + 1
      for (let i = globalIndex + 1; i < tasks.length; i++) {
        if (tasks[i].parentId === parentId || (tasks[i].parentId && tasks.find(t => t.id === tasks[i].parentId)?.parentId === parentId)) {
          globalInsertIndex = i + 1
        } else {
          break
        }
      }
      newTasks.splice(globalInsertIndex, 0, newTask)
      setTasks(newTasks)
    }
    message.success(`已添加子任务: ${newId}`)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const activeTask = tasks.find(t => t.id === activeId)
    const overTask = tasks.find(t => t.id === overId)
    if (!activeTask || !overTask) return

    // 收集某个任务及其所有后代（递归）
    const collectDescendants = (parentId: string, allTasks: any[]): any[] => {
      const children = allTasks.filter(t => t.parentId === parentId)
      const result: any[] = []
      for (const child of children) {
        result.push(child)
        result.push(...collectDescendants(child.id, allTasks))
      }
      return result
    }

    // 收集移动的任务块（任务本身 + 所有后代）
    const descendants = collectDescendants(activeId, tasks)
    const movedBlock = [activeTask, ...descendants]
    const movedIds = new Set(movedBlock.map(t => t.id))

    // 只允许同级拖拽（同一个 parentId）
    if (activeTask.parentId !== overTask.parentId) {
      message.warning('只能在同级任务之间拖动')
      return
    }

    // 从列表中移除被拖动的块
    const remaining = tasks.filter(t => !movedIds.has(t.id))

    // 找到目标任务在剩余列表中的位置
    const overIndex = remaining.findIndex(t => t.id === overId)
    if (overIndex === -1) return

    // 目标任务也可能有后代，需要插入到目标块之后
    const overDescendants = collectDescendants(overId, remaining)
    const insertAfterIndex = overIndex + overDescendants.length

    // 判断移动方向：向下则插在目标块之后，向上则插在目标位置之前
    const originalActiveIndex = tasks.findIndex(t => t.id === activeId)
    const originalOverIndex = tasks.findIndex(t => t.id === overId)
    const movingDown = originalActiveIndex < originalOverIndex

    const insertIndex = movingDown ? insertAfterIndex + 1 : overIndex

    // 插入被拖动的块
    const newTasks = [...remaining]
    newTasks.splice(insertIndex, 0, ...movedBlock)

    // 重新生成所有层级的序号
    const renumberTasks = (allTasks: any[]): any[] => {
      const result = allTasks.map(t => ({ ...t }))
      // 按parentId分组计数
      const counterMap = new Map<string, number>()
      // 存储旧ID到新ID的映射
      const idMapping = new Map<string, string>()

      // 第一遍：分配新序号给顶级任务
      for (const task of result) {
        if (!task.parentId) {
          const count = (counterMap.get('root') || 0) + 1
          counterMap.set('root', count)
          const newId = String(count)
          idMapping.set(task.id, newId)
          task.id = newId
          task.order = count
        }
      }

      // 第二遍：分配新序号给二级任务
      for (const task of result) {
        if (task.parentId && !result.find(t => t.id === task.parentId)?.parentId) {
          // 这是二级任务，其父是顶级任务
          const newParentId = idMapping.get(task.parentId) || task.parentId
          const key = `child_${newParentId}`
          const count = (counterMap.get(key) || 0) + 1
          counterMap.set(key, count)
          const newId = `${newParentId}.${count}`
          idMapping.set(task.id, newId)
          task.parentId = newParentId
          task.id = newId
          task.order = count
        }
      }

      // 第三遍：分配新序号给三级任务
      for (const task of result) {
        if (task.parentId && idMapping.has(task.parentId) && !idMapping.has(task.id)) {
          const newParentId = idMapping.get(task.parentId) || task.parentId
          const key = `child_${newParentId}`
          const count = (counterMap.get(key) || 0) + 1
          counterMap.set(key, count)
          const newId = `${newParentId}.${count}`
          idMapping.set(task.id, newId)
          task.parentId = newParentId
          task.id = newId
          task.order = count
        }
      }

      return result
    }

    setTasks(renumberTasks(newTasks))
    message.success('任务顺序已更新，序号已重新生成')
  }

  // 进度编辑
  const [progressEditingTask, setProgressEditingTask] = useState<any>(null)
  
  const handleProgressChange = (taskId: string, newProgress: number) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        let newStatus = t.status
        if (newProgress === 100) newStatus = '已完成'
        else if (newProgress > 0) newStatus = '进行中'
        else newStatus = '未开始'
        return { ...t, progress: newProgress, status: newStatus }
      }
      return t
    }))
    setProgressEditingTask(null)
    message.success('进度已更新')
  }

  // 子活动时间约束检查 - 子活动必须在父活动时间范围内
  const [parentTimeWarning, setParentTimeWarning] = useState<{visible: boolean, tasks: any[], message: string}>({visible: false, tasks: [], message: ''})
  
  // 二级计划时间约束检查 - 二级计划时间必须在里程碑时间范围内
  const checkMilestoneTimeConstraint = (level2Tasks: any[], milestoneIds: string[], level1Tasks: any[]): {valid: boolean, violations: any[]} => {
    if (milestoneIds.length === 0) return { valid: true, violations: [] }
    
    const violations: any[] = []
    
    // 获取选中里程碑的时间范围
    const milestoneTasks = level1Tasks.filter(t => milestoneIds.includes(t.id))
    if (milestoneTasks.length === 0) return { valid: true, violations: [] }
    
    // 计算里程碑的总体时间范围
    let earliestStart = Infinity
    let latestEnd = -Infinity
    
    milestoneTasks.forEach(m => {
      if (m.planStartDate) {
        const start = new Date(m.planStartDate).getTime()
        if (start < earliestStart) earliestStart = start
      }
      if (m.planEndDate) {
        const end = new Date(m.planEndDate).getTime()
        if (end > latestEnd) latestEnd = end
      }
    })
    
    if (earliestStart === Infinity || latestEnd === -Infinity) return { valid: true, violations: [] }
    
    const milestoneStartDate = new Date(earliestStart).toISOString().split('T')[0]
    const milestoneEndDate = new Date(latestEnd).toISOString().split('T')[0]
    
    // 检查二级计划任务是否在里程碑时间范围内
    level2Tasks.forEach(task => {
      if (task.planStartDate && task.planEndDate) {
        const taskStart = new Date(task.planStartDate).getTime()
        const taskEnd = new Date(task.planEndDate).getTime()
        
        if (taskStart < earliestStart || taskEnd > latestEnd) {
          violations.push({
            id: task.id,
            taskName: task.taskName,
            taskTime: `${task.planStartDate} ~ ${task.planEndDate}`,
            milestoneRange: `${milestoneStartDate} ~ ${milestoneEndDate}`,
            milestones: milestoneIds.join(', ')
          })
        }
      }
    })
    
    return { valid: violations.length === 0, violations }
  }
  
  const checkParentTimeConstraint = (): {valid: boolean, violations: any[]} => {
    const violations: any[] = []
    
    tasks.forEach(task => {
      if (task.parentId) {
        const parentTask = tasks.find(t => t.id === task.parentId)
        if (parentTask && parentTask.planStartDate && parentTask.planEndDate && task.planStartDate && task.planEndDate) {
          const parentStart = new Date(parentTask.planStartDate).getTime()
          const parentEnd = new Date(parentTask.planEndDate).getTime()
          const childStart = new Date(task.planStartDate).getTime()
          const childEnd = new Date(task.planEndDate).getTime()
          
          if (childStart < parentStart || childEnd > parentEnd) {
            violations.push({
              id: task.id,
              taskName: task.taskName,
              parentId: task.parentId,
              parentName: parentTask.taskName,
              childTime: `${task.planStartDate} ~ ${task.planEndDate}`,
              parentTime: `${parentTask.planStartDate} ~ ${parentTask.planEndDate}`
            })
          }
        }
      }
    })
    
    return { valid: violations.length === 0, violations }
  }

  // 前置任务检查
  const [predecessorWarning, setPredecessorWarning] = useState<{visible: boolean, task: any, message: string}>({visible: false, task: null, message: ''})
  
  const checkPredecessor = (task: any, field: 'planStartDate' | 'planEndDate', newDate: string): boolean => {
    if (!task.predecessor) return true
    const predTask = tasks.find(t => t.id === task.predecessor)
    if (!predTask || !predTask.planEndDate) return true
    
    const newDateTime = new Date(newDate).getTime()
    const predEndTime = new Date(predTask.planEndDate).getTime()
    
    if (field === 'planStartDate' && newDateTime < predEndTime) {
      setPredecessorWarning({
        visible: true,
        task: { ...task, [field]: newDate },
        message: `任务"${task.taskName}"的开始时间(${newDate})早于前置任务"${predTask.taskName}"的结束时间(${predTask.planEndDate})`
      })
      return false
    }
    return true
  }
  
  const handleGanttTimeChange = (taskId: string, field: 'planStartDate' | 'planEndDate', date: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    
    // 检查前置任务约束
    if (!checkPredecessor(task, field, date)) {
      return
    }
    
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: date } : t))
    setGanttEditingTask(null)
    message.success('时间已更新')
  }

  const confirmPredecessorChange = () => {
    if (!predecessorWarning.task) return
    setTasks(tasks.map(t => t.id === predecessorWarning.task.id ? predecessorWarning.task : t))
    setPredecessorWarning({visible: false, task: null, message: ''})
    setGanttEditingTask(null)
    message.success('时间已更新（已确认前置任务冲突）')
  }

  const renderProjectCard = (project: typeof initialProjects[0]) => {
    const statusConf = PROJECT_STATUS_CONFIG[project.status] || { color: '#8c8c8c', tagColor: 'default' }
    const isWholeMachine = project.type === '整机产品项目'
    const isSoftware = project.type === '产品项目'
    const isTech = project.type === '技术项目'
    const isCapability = project.type === '能力建设项目'

    const fieldItem = (label: string, value: string | undefined) => value ? (
      <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: '#bfbfbf' }}>{label}</span> <span style={{ color: '#595959', fontWeight: 500 }}>{value}</span>
      </div>
    ) : null

    return (
      <Card
        hoverable
        className="pms-card-hover"
        style={{ borderRadius: 10, border: '1px solid #f0f0f0', height: '100%' }}
        styles={{ body: { padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column' as const } }}
        onClick={() => { setSelectedProject(project); setActiveModule('projectSpace') }}
      >
        {/* 头部: 项目名 + 状态 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#262626', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </div>
            {isWholeMachine && project.marketName && (
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>市场名: {project.marketName}</div>
            )}
            <Tag color="default" style={{ fontSize: 11, borderRadius: 3, margin: 0 }}>{project.type}</Tag>
          </div>
          <Tag color={statusConf.tagColor} style={{ margin: 0, borderRadius: 4, flexShrink: 0 }}>{project.status}</Tag>
        </div>

        {/* 中间: 类型差异化字段 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {isWholeMachine && (
            <>
              {fieldItem('品牌', project.brand)}
              {fieldItem('产品线', project.productLine)}
              {fieldItem('开发模式', project.developMode)}
            </>
          )}
        </div>

        {/* 计划时间 - 软件产品/整机产品/技术项目显示 */}
        {!isCapability && (project.planStartDate || project.planEndDate) && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 12, color: '#8c8c8c' }}>
            {project.planStartDate && (
              <span><CalendarOutlined style={{ marginRight: 4, color: '#bfbfbf' }} />{project.planStartDate}</span>
            )}
            {project.planEndDate && (
              <span>→ {project.planEndDate}</span>
            )}
          </div>
        )}

        {/* 底部: 项目经理 + 更新时间 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <Space size={6}>
            <Avatar size={20} style={{ background: statusConf.color, fontSize: 10 }}>{project.spm[0]}</Avatar>
            <span style={{ fontSize: 12, color: '#595959' }}>{project.spm}</span>
          </Space>
          <span style={{ fontSize: 11, color: '#bfbfbf' }}>{project.updatedAt}</span>
        </div>
      </Card>
    )
  }

  const [kanbanDimension, setKanbanDimension] = useState<'stage' | 'type' | 'status'>('stage')

  const getKanbanColumns = () => {
    if (kanbanDimension === 'type') {
      return PROJECT_TYPES.map((t, i) => ({ title: t, key: t, color: ['#1890ff', '#52c41a', '#faad14', '#722ed1'][i] }))
    }
    if (kanbanDimension === 'status') {
      return [
        { title: '筹备中', key: '筹备中', color: '#faad14' },
        { title: '进行中', key: '进行中', color: '#1890ff' },
        { title: '已完成', key: '已完成', color: '#52c41a' },
        { title: '上市', key: '上市', color: '#722ed1' },
      ]
    }
    return kanbanColumns
  }

  const getKanbanFilter = (col: { key: string }) => {
    if (kanbanDimension === 'type') {
      return (p: typeof initialProjects[0]) => p.type === col.key
    }
    if (kanbanDimension === 'status') {
      return (p: typeof initialProjects[0]) => p.status === col.key
    }
    return (p: typeof initialProjects[0]) => {
      if (col.key === 'concept') return p.progress === 0
      if (col.key === 'planning') return p.progress > 0 && p.progress < 30
      if (col.key === 'developing') return p.progress >= 30 && p.progress < 100
      return p.progress === 100
    }
  }

  const renderKanbanBoard = () => (
    <div>
      <Row justify="end" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <span style={{ color: '#666' }}>分组维度:</span>
            <Select value={kanbanDimension} onChange={setKanbanDimension} style={{ width: 120 }}>
              <Option value="stage">阶段</Option>
              <Option value="type">项目类型</Option>
              <Option value="status">项目状态</Option>
            </Select>
          </Space>
        </Col>
      </Row>
      <Row gutter={16}>
        {getKanbanColumns().map(col => (
          <Col span={Math.floor(24 / getKanbanColumns().length)} key={col.key}>
            <Card title={<Space><Badge color={col.color} />{col.title}</Space>} style={{ background: '#fafafa', minHeight: 300 }} bodyStyle={{ padding: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {visibleProjects.filter(getKanbanFilter(col)).map(project => (
                    <Card key={project.id} size="small" hoverable onClick={() => { setSelectedProject(project); setActiveModule('projectSpace') }}>
                    <Space direction="vertical" style={{ width: '100%' }}><div style={{ fontWeight: 500 }}>{project.name}</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Tag>{project.type}</Tag><Progress percent={project.progress} size="small" style={{ width: 60 }} /></div></Space>
                  </Card>
                ))}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )

  const renderTodoList = () => {
    const priorityConfig: Record<string, { color: string; text: string; dotColor: string }> = {
      high: { color: 'red', text: '高', dotColor: '#ff4d4f' },
      medium: { color: 'orange', text: '中', dotColor: '#faad14' },
      low: { color: 'blue', text: '低', dotColor: '#1890ff' },
    }

    // 按 项目+计划级别+计划类型+版本 去重合并
    const mergeTodos = (list: typeof todos) => {
      const groupMap = new Map<string, typeof todos>()
      list.forEach(t => {
        const key = `${t.projectId}|${t.planLevel}|${t.planType}|${t.versionNo}`
        if (!groupMap.has(key)) groupMap.set(key, [])
        groupMap.get(key)!.push(t)
      })
      const merged: (typeof todos[0] & { mergedCount?: number })[] = []
      groupMap.forEach((group) => {
        // 取优先级最高的（overdue > upcoming > pending > completed）和最早的截止日期
        const priorityOrder = { overdue: 0, upcoming: 1, pending: 2, completed: 3 }
        const sorted = [...group].sort((a, b) => (priorityOrder[a.category] ?? 9) - (priorityOrder[b.category] ?? 9))
        const rep = { ...sorted[0], mergedCount: group.length }
        merged.push(rep)
      })
      return merged
    }

    const allMerged = mergeTodos(todos)
    const filteredTodos = todoFilter === 'all' ? allMerged : allMerged.filter(t => t.category === todoFilter)
    const overdueCount = allMerged.filter(t => t.category === 'overdue').length
    const upcomingCount = allMerged.filter(t => t.category === 'upcoming').length

    return (
      <div>
        {/* 分类筛选 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: '全部', count: allMerged.length },
            { key: 'overdue', label: '逾期', count: overdueCount, color: '#ff4d4f' },
            { key: 'upcoming', label: '即将到期', count: upcomingCount, color: '#faad14' },
            { key: 'pending', label: '待办', count: allMerged.filter(t => t.category === 'pending').length },
            { key: 'completed', label: '已完成', count: allMerged.filter(t => t.category === 'completed').length },
          ].map(f => (
            <Tag
              key={f.key}
              color={todoFilter === f.key ? (f.color ? f.color : 'blue') : 'default'}
              style={{ cursor: 'pointer', borderRadius: 4, fontSize: 11, margin: 0 }}
              onClick={() => setTodoFilter(f.key as any)}
            >
              {f.label} {f.count > 0 && <span style={{ fontWeight: 600 }}>{f.count}</span>}
            </Tag>
          ))}
        </div>

        {/* 待办列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredTodos.length === 0 ? (
            <Empty description="暂无待办" style={{ padding: '20px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            filteredTodos.map(todo => {
              const pc = priorityConfig[todo.priority] || priorityConfig.low
              const isOverdue = todo.category === 'overdue'
              const isUpcoming = todo.category === 'upcoming'
              const borderColor = isOverdue ? '#ff4d4f' : isUpcoming ? '#faad14' : '#f0f0f0'
              const bgColor = isOverdue ? '#fff2f0' : isUpcoming ? '#fffbe6' : '#fff'

              return (
                <div
                  key={todo.id}
                  style={{
                    padding: '12px 14px',
                    background: bgColor,
                    borderRadius: 6,
                    border: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
                  onClick={() => {
                    const proj = projects.find(p => p.id === todo.projectId)
                    if (!proj) return
                    setSelectedProject(proj)
                    setActiveModule('projectSpace')
                    setProjectSpaceModule('plan')
                    setCurrentVersion(todo.versionId || 'v2')
                    setProjectPlanLevel(todo.planLevel)
                    setProjectPlanViewMode('table')
                    setIsEditMode(true)
                    if (todo.planLevel === 'level2' && todo.planTabKey) {
                      setActiveLevel2Plan(todo.planTabKey)
                    }
                    if (proj.type === '整机产品项目' && todo.market) {
                      setSelectedMarketTab(todo.market)
                    }
                    setTimeout(() => {
                      const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
                      for (let i = 0; i < rows.length; i++) {
                        const cells = rows[i].querySelectorAll('td')
                        for (let j = 0; j < cells.length; j++) {
                          if (cells[j].textContent?.trim() === currentLoginUser) {
                            rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' })
                            const row = rows[i] as HTMLElement
                            row.style.transition = 'background 0.3s'
                            row.style.background = '#e6f7ff'
                            setTimeout(() => { row.style.background = '' }, 2000)
                            return
                          }
                        }
                      }
                    }, 800)
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {isOverdue && <WarningOutlined style={{ color: '#ff4d4f', fontSize: 14, marginTop: 2, flexShrink: 0 }} />}
                    {isUpcoming && <ClockCircleOutlined style={{ color: '#faad14', fontSize: 14, marginTop: 2, flexShrink: 0 }} />}
                    {!isOverdue && !isUpcoming && <div style={{ width: 6, height: 6, borderRadius: '50%', background: pc.dotColor, marginTop: 7, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isOverdue ? '#ff4d4f' : '#262626', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.projectName}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {todo.planLevel === 'level1' ? '一级计划' : '二级计划'}
                        {todo.planLevel === 'level2' && todo.planType && <> · {todo.planType}</>}
                        {' · '}<span style={{ color: '#1890ff', fontWeight: 500 }}>{todo.versionNo}</span>
                        {todo.market && <> · <span style={{ color: '#13c2c2' }}>{todo.market}</span></>}
                      </div>
                      {(todo as any).mergedCount > 1 && <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>共 {(todo as any).mergedCount} 项待处理</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={4}>
                          <Tag color={pc.color} style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>{pc.text}</Tag>
                          <Tag color={todo.status === '进行中' ? 'processing' : todo.status === '已完成' ? 'success' : 'default'} style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>{todo.status}</Tag>
                          {isOverdue && <Tag color="error" style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>已逾期</Tag>}
                          {isUpcoming && <Tag color="warning" style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>即将到期</Tag>}
                        </Space>
                        <span style={{ fontSize: 11, color: isOverdue ? '#ff4d4f' : '#bfbfbf', fontWeight: isOverdue ? 500 : 400 }}>{todo.deadline}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  const renderGanttChart = (customTasks?: any[]) => {
    const ganttTasks = customTasks || filteredTasks
    return (
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <DHTMLXGantt
          tasks={ganttTasks}
          onTaskClick={(task) => {
            message.info(`点击任务: ${task.text}`)
          }}
          readOnly={!isEditMode}
        />
      </div>
    )
  }

  // 横版表格视图（一级计划专用）
  const renderHorizontalTable = () => {
    // 横版表格：按已发布版本倒序显示计划数据 + 实际数据行
    const stages = tasks.filter((t: any) => !t.parentId).sort((a: any, b: any) => a.order - b.order)

    // 构建阶段-里程碑列结构
    const stageGroups = stages.map((stage: any) => {
      const milestones = tasks.filter((t: any) => t.parentId === stage.id).sort((a: any, b: any) => a.order - b.order)
      return { stage, milestones, colSpan: milestones.length || 1 }
    })

    // 所有里程碑（子活动）扁平列表
    const allMilestones = stageGroups.flatMap(({ stage, milestones }) =>
      milestones.length > 0 ? milestones : [stage]
    )

    // 计算开发周期（最早计划开始到最晚计划结束的天数）
    const calcDevCycle = (taskList: any[]) => {
      const starts = taskList.map((t: any) => t.planStartDate).filter(Boolean).map((d: string) => new Date(d).getTime())
      const ends = taskList.map((t: any) => t.planEndDate).filter(Boolean).map((d: string) => new Date(d).getTime())
      if (starts.length === 0 || ends.length === 0) return '-'
      const earliest = Math.min(...starts)
      const latest = Math.max(...ends)
      const days = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24))
      return days > 0 ? days : '-'
    }

    // 为每个已发布版本模拟不同的计划数据（Mock: 各版本计划完成时间有偏移）
    const publishedVersions = versions.filter(v => v.status === '已发布').sort((a, b) => {
      const aNum = parseInt(a.versionNo.replace('V', ''))
      const bNum = parseInt(b.versionNo.replace('V', ''))
      return bNum - aNum // 倒序
    })

    const getVersionTasks = (versionId: string) => {
      const vNum = parseInt(versions.find(v => v.id === versionId)?.versionNo.replace('V', '') || '1')
      const latestNum = Math.max(...publishedVersions.map(v => parseInt(v.versionNo.replace('V', ''))))
      if (vNum === latestNum) return tasks // 最新版本使用当前数据
      // 旧版本模拟：计划日期往前偏移
      const offsetDays = (latestNum - vNum) * 3
      return (tasks as any[]).map((t: any) => ({
        ...t,
        planEndDate: t.planEndDate ? (() => {
          const d = new Date(t.planEndDate)
          d.setDate(d.getDate() - offsetDays)
          return d.toISOString().split('T')[0]
        })() : '',
        planStartDate: t.planStartDate ? (() => {
          const d = new Date(t.planStartDate)
          d.setDate(d.getDate() - offsetDays)
          return d.toISOString().split('T')[0]
        })() : '',
      }))
    }

    const thStyle: CSSProperties = { background: '#fafbfc', fontWeight: 600, fontSize: 13, color: '#595959', padding: '10px 12px', border: '1px solid #e8e8e8', whiteSpace: 'nowrap', textAlign: 'center' }
    const tdStyle: CSSProperties = { padding: '8px 12px', fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap', minWidth: 100, border: '1px solid #e8e8e8' }
    const versionThStyle: CSSProperties = { ...thStyle, position: 'sticky', left: 0, zIndex: 2, minWidth: 80, background: '#fafbfc' }
    const cycleThStyle: CSSProperties = { ...thStyle, position: 'sticky', left: 80, zIndex: 2, minWidth: 80, background: '#fafbfc' }
    const versionTdStyle: CSSProperties = { ...tdStyle, position: 'sticky', left: 0, zIndex: 1, fontWeight: 600, background: '#fff', minWidth: 80 }
    const cycleTdStyle: CSSProperties = { ...tdStyle, position: 'sticky', left: 80, zIndex: 1, background: '#fff', minWidth: 80 }

    // 阶段表头颜色
    const stageColors = ['#1890ff', '#52c41a', '#722ed1', '#faad14', '#eb2f96', '#13c2c2']

    return (
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {/* 阶段分组行 */}
            <tr>
              <th style={{ ...versionThStyle, borderBottom: 'none' }} rowSpan={2}>版本</th>
              <th style={{ ...cycleThStyle, borderBottom: 'none' }} rowSpan={2}>开发周期</th>
              {stageGroups.map(({ stage, colSpan }, i) => (
                <th
                  key={stage.id}
                  colSpan={colSpan}
                  style={{
                    ...thStyle,
                    background: `${stageColors[i % stageColors.length]}10`,
                    color: stageColors[i % stageColors.length],
                    borderBottom: `2px solid ${stageColors[i % stageColors.length]}`,
                  }}
                >
                  {stage.taskName}
                </th>
              ))}
            </tr>
            {/* 里程碑行 */}
            <tr>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <th key={m.id} style={thStyle}>{m.taskName}</th>)
                  : [<th key={stage.id} style={{ ...thStyle, color: '#bfbfbf' }}>-</th>]
              )}
            </tr>
          </thead>
          <tbody>
            {/* 已发布版本行（倒序） */}
            {publishedVersions.map((version, idx) => {
              const vTasks = getVersionTasks(version.id)
              const vMilestones = stageGroups.flatMap(({ stage, milestones: ms }) => {
                if (ms.length > 0) {
                  return ms.map((m: any) => {
                    const vt = vTasks.find((t: any) => t.id === m.id)
                    return vt || m
                  })
                }
                const vt = vTasks.find((t: any) => t.id === stage.id)
                return [vt || stage]
              })
              const devCycle = calcDevCycle(vTasks)
              const isLatest = idx === 0
              return (
                <tr key={version.id} style={isLatest ? { background: '#fafffe' } : undefined}>
                  <td style={{ ...versionTdStyle, color: isLatest ? '#1890ff' : '#262626', background: isLatest ? '#f0f9ff' : '#fff' }}>
                    {version.versionNo}
                  </td>
                  <td style={{ ...cycleTdStyle, background: isLatest ? '#f0f9ff' : '#fff' }}>
                    <Tooltip title="最早计划开始到最晚计划完成的天数">
                      <span>{devCycle}</span>
                    </Tooltip>
                  </td>
                  {vMilestones.map((m: any, mi: number) => (
                    <td key={mi} style={tdStyle}>{m.planEndDate || '-'}</td>
                  ))}
                </tr>
              )
            })}
            {/* 实际数据行（最新已发布版本的实际数据） */}
            <tr style={{ background: '#fffbe6' }}>
              <td style={{ ...versionTdStyle, color: '#d48806', background: '#fffbe6', fontSize: 12 }}>
                <Tooltip title="最近已发布版本的实际完成数据">
                  <span>实际</span>
                </Tooltip>
              </td>
              <td style={{ ...cycleTdStyle, background: '#fffbe6' }}>
                <Tooltip title="最早实际开始到最晚实际完成的天数">
                  <span>{(() => {
                    const starts = (tasks as any[]).map((t: any) => t.actualStartDate).filter(Boolean).map((d: string) => new Date(d).getTime())
                    const ends = (tasks as any[]).map((t: any) => t.actualEndDate).filter(Boolean).map((d: string) => new Date(d).getTime())
                    if (starts.length === 0 || ends.length === 0) return '-'
                    const days = Math.ceil((Math.max(...ends) - Math.min(...starts)) / (1000 * 60 * 60 * 24))
                    return days > 0 ? days : '-'
                  })()}</span>
                </Tooltip>
              </td>
              {allMilestones.map((m: any, mi: number) => (
                <td key={mi} style={{ ...tdStyle, color: '#d48806' }}>{m.actualEndDate || '-'}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // 计算任务层级深度
  const getTaskDepth = (task: any, allTasks: any[]): number => {
    if (!task.parentId) return 0
    const parent = allTasks.find(t => t.id === task.parentId)
    if (!parent) return 1
    return 1 + getTaskDepth(parent, allTasks)
  }

  const renderTaskTable = (customTasks?: any[]) => {
    const isLevel2Custom = !!customTasks
    const tableTasks = customTasks || tasks
    const currentSetTasks = isLevel2Custom ? (newTasks: any[]) => {
      // 更新level2PlanTasks中对应planId的任务
      const planId = customTasks?.[0]?.planId
      if (planId) {
        setLevel2PlanTasks(prev => [...prev.filter(t => t.planId !== planId), ...newTasks])
      }
    } : setTasks
    const flatTasks = tableTasks.map(task => ({ ...task, indentLevel: getTaskDepth(task, tableTasks) }))
    const getColumns = (): ColumnsType<any> => {
      const cols: ColumnsType<any> = []
      if (visibleColumns.includes('id')) cols.push({ title: '序号', dataIndex: 'id', key: 'id', width: 130, fixed: 'left', render: (id: string, record: any) => {
        const depth = record.indentLevel || 0
        const isLevel2Mode = (activeModule === 'config' && planLevel === 'level2') || (activeModule === 'projectSpace' && projectPlanLevel === 'level2')
        const maxDepth = isLevel2Mode ? 3 : 2
        const canAddChild = isEditMode && depth < maxDepth - 1
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 20 }}>
            {isEditMode && <DragHandle />}
            {canAddChild && <Tooltip title="添加子项"><Button type="text" size="small" icon={<PlusOutlined />} style={{ color: '#1890ff' }} onClick={(e) => { e.stopPropagation(); handleAddSubTask(record.id) }} /></Tooltip>}
            <span style={{ fontWeight: depth === 0 ? 600 : 500, color: depth === 0 ? '#262626' : '#595959', fontSize: 13 }}>{id}</span>
          </div>
        )
      } })
      if (visibleColumns.includes('taskName')) cols.push({ title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 220, render: (name: string, record: any) => {
        const depth = record.indentLevel || 0
        if (isEditMode) return <Input className="pms-edit-input" value={name} size="small" style={{ fontWeight: depth === 0 ? 600 : 400 }} onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, taskName: e.target.value } : t); currentSetTasks(updated) }} />
        return (
          <div style={{ paddingLeft: depth * 16, display: 'flex', alignItems: 'center', gap: 4 }}>
            {depth > 0 && <span style={{ color: '#d9d9d9', fontSize: 11, flexShrink: 0 }}>{depth === 1 ? '├' : '└'}</span>}
            <span style={{ color: depth === 0 ? '#262626' : depth === 1 ? '#595959' : '#8c8c8c', fontWeight: depth === 0 ? 600 : 400 }}>{name}</span>
          </div>
        )
      } })
      if (visibleColumns.includes('responsible')) cols.push({ title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 100, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, responsible: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <Space size={4}><Avatar size={18} style={{ background: '#1890ff', fontSize: 10 }}>{val[0]}</Avatar><span style={{ fontSize: 13 }}>{val}</span></Space> : <span style={{ color: '#d9d9d9' }}>-</span>) })
      if (visibleColumns.includes('predecessor')) cols.push({ title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 100, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" placeholder="如: 1.1" onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, predecessor: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <Tag style={{ borderRadius: 4, fontSize: 12 }}>{val}</Tag> : <span style={{ color: '#d9d9d9' }}>-</span>) })
      if (visibleColumns.includes('planStartDate')) cols.push({ title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 120, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" placeholder="YYYY-MM-DD" onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, planStartDate: e.target.value } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#595959' }}>{val || '-'}</span> })
      if (visibleColumns.includes('planEndDate')) cols.push({ title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 120, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" placeholder="YYYY-MM-DD" onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, planEndDate: e.target.value } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#595959' }}>{val || '-'}</span> })
      if (visibleColumns.includes('estimatedDays')) cols.push({ title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 90, render: (val: number, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" type="number" style={{ width: 70 }} onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, estimatedDays: parseInt(e.target.value) || 0 } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#595959' }}>{val}天</span> })
      if (visibleColumns.includes('actualStartDate')) cols.push({ title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 120, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" placeholder="YYYY-MM-DD" onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, actualStartDate: e.target.value } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#595959' }}>{val || '-'}</span> })
      if (visibleColumns.includes('actualEndDate')) cols.push({ title: '实际完成', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 120, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" placeholder="YYYY-MM-DD" onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, actualEndDate: e.target.value } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#595959' }}>{val || '-'}</span> })
      if (visibleColumns.includes('actualDays')) cols.push({ title: '实际工期', dataIndex: 'actualDays', key: 'actualDays', width: 90, render: (val: number) => <span style={{ fontSize: 12, color: '#595959' }}>{val > 0 ? `${val}天` : '-'}</span> })
      if (visibleColumns.includes('status')) cols.push({ title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === '已完成' ? 'success' : s === '进行中' ? 'processing' : 'default'} style={{ borderRadius: 4, fontSize: 12 }}>{s}</Tag> })
      if (visibleColumns.includes('progress')) cols.push({ title: '进度', dataIndex: 'progress', key: 'progress', width: 130, render: (p: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={p} size="small" showInfo={false} strokeColor={p === 100 ? '#52c41a' : '#1890ff'} style={{ flex: 1, marginBottom: 0 }} />
          <span style={{ fontSize: 11, color: p === 100 ? '#52c41a' : '#595959', fontWeight: 500, minWidth: 32 }}>{p}%</span>
        </div>
      ) })
      if (isEditMode) cols.push({ title: '操作', key: 'action', width: 60, fixed: 'right', render: (_: any, record: any) => (<Popconfirm title="确认删除" description={`删除 "${record.taskName}" 及其子任务？`} onConfirm={() => { const filtered = tableTasks.filter(t => t.id !== record.id && t.parentId !== record.id && !(t.parentId && tableTasks.find((p: any) => p.id === t.parentId)?.parentId === record.id)); currentSetTasks(filtered); message.success(`已删除任务: ${record.id}`) }} okText="确认" cancelText="取消"><Button type="text" icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 4 }} /></Popconfirm>) })
      return cols
    }

    // 表格内拖拽处理器（使用当前上下文的任务列表）
    const handleTableDragEnd = (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeId = String(active.id)
      const overId = String(over.id)
      const activeTask = tableTasks.find(t => t.id === activeId)
      const overTask = tableTasks.find(t => t.id === overId)
      if (!activeTask || !overTask) return

      const collectDescendants = (parentId: string, allTasks: any[]): any[] => {
        const children = allTasks.filter(t => t.parentId === parentId)
        const result: any[] = []
        for (const child of children) {
          result.push(child)
          result.push(...collectDescendants(child.id, allTasks))
        }
        return result
      }

      const descendants = collectDescendants(activeId, tableTasks)
      const movedBlock = [activeTask, ...descendants]
      const movedIds = new Set(movedBlock.map(t => t.id))

      if (activeTask.parentId !== overTask.parentId) {
        message.warning('只能在同级任务之间拖动')
        return
      }

      const remaining = tableTasks.filter(t => !movedIds.has(t.id))
      const overIndex = remaining.findIndex(t => t.id === overId)
      if (overIndex === -1) return

      const overDescendants = collectDescendants(overId, remaining)
      const insertAfterIndex = overIndex + overDescendants.length

      const originalActiveIndex = tableTasks.findIndex(t => t.id === activeId)
      const originalOverIndex = tableTasks.findIndex(t => t.id === overId)
      const movingDown = originalActiveIndex < originalOverIndex
      const insertIndex = movingDown ? insertAfterIndex + 1 : overIndex

      const newTasks = [...remaining]
      newTasks.splice(insertIndex, 0, ...movedBlock)

      // 重新生成所有层级的序号
      const result = newTasks.map(t => ({ ...t }))
      const counterMap = new Map<string, number>()
      const idMapping = new Map<string, string>()

      for (const task of result) {
        if (!task.parentId) {
          const count = (counterMap.get('root') || 0) + 1
          counterMap.set('root', count)
          const newId = String(count)
          idMapping.set(task.id, newId)
          task.id = newId
          task.order = count
        }
      }
      for (const task of result) {
        if (task.parentId && idMapping.has(task.parentId)) {
          const newParentId = idMapping.get(task.parentId)!
          const key = `child_${newParentId}`
          const count = (counterMap.get(key) || 0) + 1
          counterMap.set(key, count)
          const newId = `${newParentId}.${count}`
          idMapping.set(task.id, newId)
          task.parentId = newParentId
          task.id = newId
          task.order = count
        }
      }
      for (const task of result) {
        if (task.parentId && !idMapping.has(task.id) && idMapping.has(task.parentId)) {
          const newParentId = idMapping.get(task.parentId)!
          const key = `child_${newParentId}`
          const count = (counterMap.get(key) || 0) + 1
          counterMap.set(key, count)
          const newId = `${newParentId}.${count}`
          idMapping.set(task.id, newId)
          task.parentId = newParentId
          task.id = newId
          task.order = count
        }
      }

      currentSetTasks(result)
      message.success('任务顺序已更新，序号已重新生成')
    }

    const TableComponents = isEditMode ? { body: { row: SortableRow } } : undefined
    const tableClassName = `pms-table ${isEditMode ? 'pms-table-edit' : ''}`
    return (
      <div>
        {isEditMode && (
          <div style={{ padding: '8px 16px', background: 'linear-gradient(90deg, #fffbe6, #fff7cc)', borderBottom: '1px solid #ffe58f', display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#faad14', fontSize: 14 }} />
            <span style={{ fontSize: 13, color: '#ad6800', fontWeight: 500 }}>编辑模式</span>
            <span style={{ fontSize: 12, color: '#ad8b00' }}>- 拖拽手柄排序，点击单元格编辑，完成后点击保存</span>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTableDragEnd}><SortableContext items={flatTasks.map(t => t.id)} strategy={verticalListSortingStrategy}><Table className={tableClassName} dataSource={flatTasks} columns={getColumns()} rowKey="id" pagination={false} scroll={{ x: visibleColumns.length * 100 + 200 }} components={TableComponents} size="middle" /></SortableContext></DndContext>
        {isEditMode && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fafbfc' }}>
            <Button type="dashed" icon={<PlusOutlined />} style={{ width: '100%', borderRadius: 6, height: 36 }} onClick={() => {
              const parentTasks = tableTasks.filter(t => !t.parentId)
              const maxOrder = parentTasks.length > 0 ? Math.max(...parentTasks.map(t => parseInt(t.id) || t.order)) : 0
              const newId = String(maxOrder + 1)
              const newTask: any = { id: newId, order: maxOrder + 1, taskName: '新活动', status: '未开始', progress: 0, responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
              if (isLevel2Custom && customTasks?.[0]?.planId) newTask.planId = customTasks[0].planId
              currentSetTasks([...tableTasks, newTask])
              message.success(`已添加一级活动: ${newId}`)
            }}>添加新活动</Button>
          </div>
        )}
      </div>
    )
  }

  const handleCreateRevision = () => {
    // 找到最新版本号
    const maxVersionNum = versions.reduce((max, v) => {
      const num = parseInt(v.versionNo.replace('V', ''))
      return num > max ? num : max
    }, 0)
    const newVersionNum = maxVersionNum + 1
    const newVersionId = `v${newVersionNum}`
    
    // 找到最新已发布的版本
    const publishedVersion = versions.find(v => v.status === '已发布')
    
    // 如果有已发布版本，克隆其任务内容
    let clonedTasks = [...LEVEL1_TASKS]
    if (publishedVersion) {
      // 从已发布版本克隆任务数据
      clonedTasks = LEVEL1_TASKS.map(t => ({ ...t }))
      message.success(`已创建修订版本 V${newVersionNum}，已克隆V${publishedVersion.versionNo}的内容`)
    } else {
      message.success(`已创建修订版本 V${newVersionNum}`)
    }
    
    // 创建新修订版本
    const newVersion = {
      id: newVersionId,
      versionNo: `V${newVersionNum}`,
      status: '修订中'
    }
    
    setVersions([...versions, newVersion])
    setCurrentVersion(newVersionId)
    setTasks(clonedTasks)
  }

  const handlePublish = () => {
    // 将当前修订版改为已发布
    setVersions(versions.map(v => 
      v.id === currentVersion 
        ? { ...v, status: '已发布' }
        : v
    ))
    message.success('发布成功')
  }

  const renderActionButtons = () => {
    const handleSave = () => {
      // 1. 检查子活动时间约束
      const parentCheck = checkParentTimeConstraint()
      if (!parentCheck.valid) {
        setParentTimeWarning({
          visible: true,
          tasks: parentCheck.violations,
          message: `发现${parentCheck.violations.length}个子任务时间超出父任务范围，请修改后再保存`
        })
        return
      }
      // 2. 检查前置任务约束
      const predViolations: any[] = []
      tasks.forEach(task => {
        if (task.predecessor && task.planStartDate) {
          const predTask = tasks.find(t => t.id === task.predecessor)
          if (predTask && predTask.planEndDate) {
            const newDateTime = new Date(task.planStartDate).getTime()
            const predEndTime = new Date(predTask.planEndDate).getTime()
            if (newDateTime < predEndTime) {
              predViolations.push({
                id: task.id,
                taskName: task.taskName,
                predName: predTask.taskName,
                predEnd: predTask.planEndDate
              })
            }
          }
        }
      })
      
      if (predViolations.length > 0) {
        Modal.warning({
          title: '前置任务时间冲突',
          content: (
            <div>
              <p>发现以下任务开始时间早于前置任务结束时间：</p>
              <ul>
                {predViolations.map(v => (
                  <li key={v.id}>{v.taskName} 的开始时间早于前置任务 {v.predName} 的结束时间({v.predEnd})</li>
                ))}
              </ul>
              <p>请修改后再保存</p>
            </div>
          ),
          okText: '知道了'
        })
        return
      }
      
      // 3. 检查二级计划时间是否在里程碑范围内（项目空间）
      if (projectPlanLevel === 'level2' && level2PlanMilestones.length > 0 && level2PlanTasks.length > 0) {
        const milestoneCheck = checkMilestoneTimeConstraint(level2PlanTasks, level2PlanMilestones, tasks)
        if (!milestoneCheck.valid) {
          setMilestoneTimeWarning({
            visible: true,
            violations: milestoneCheck.violations,
            message: `发现${milestoneCheck.violations.length}个二级计划任务时间超出绑定里程碑的时间范围，请修改后再保存`
          })
          return
        }
      }
      
      setIsEditMode(false)
      message.success('保存成功')
    }
    
    if (isCurrentDraft) return (<Space><Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{currentVersionData?.versionNo}({currentVersionData?.status})</Tag><Tag color="green" style={{ fontSize: 12 }}>自动保存</Tag><Button type="primary" icon={<SaveOutlined />} onClick={handlePublish}>发布</Button></Space>)
    return (<Space>{!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRevision}>创建修订</Button>}<Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)}>历史版本对比</Button></Space>)
  }

  const [compareShowUnchanged, setCompareShowUnchanged] = useState(false)
  const [compareFilterType, setCompareFilterType] = useState<string>('all')

  const renderVersionCompareResult = () => {
    if (compareResult.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#bfbfbf' }}>
          <HistoryOutlined style={{ fontSize: 36, display: 'block', marginBottom: 12, color: '#d9d9d9' }} />
          <div style={{ fontSize: 14, color: '#8c8c8c' }}>选择两个版本后点击"开始对比"查看差异</div>
        </div>
      )
    }

    const changedRows = compareResult.filter(r => r.changeType !== '未变更')
    const stats = {
      total: compareResult.length,
      added: changedRows.filter(r => r.changeType === '新增').length,
      deleted: changedRows.filter(r => r.changeType === '删除').length,
      modified: changedRows.filter(r => r.changeType === '修改').length,
      unchanged: compareResult.filter(r => r.changeType === '未变更').length,
    }

    // 筛选数据
    let filteredData = compareShowUnchanged ? compareResult : changedRows
    if (compareFilterType !== 'all') {
      filteredData = filteredData.filter(r => r.changeType === compareFilterType)
    }

    // 行背景色
    const getRowBg = (type: string) => {
      if (type === '新增') return '#f6ffed'
      if (type === '删除') return '#fff2f0'
      if (type === '修改') return '#e6f4ff'
      return undefined
    }

    // 渲染单元格：修改的字段显示 旧值→新值
    const renderDiffCell = (row: CompareTableRow, fieldKey: string, value: any) => {
      const diff = row.fieldDiffs.find((d: FieldDiff) => d.field === fieldKey)
      if (row.changeType === '修改' && diff) {
        return (
          <Tooltip title={<div style={{ fontSize: 12 }}><div>修改人: {row.modifier}</div><div>修改时间: {row.modifyTime}</div></div>}>
            <div style={{ lineHeight: 1.6 }}>
              <div style={{ color: '#ff4d4f', fontSize: 11, textDecoration: 'line-through', opacity: 0.7 }}>{diff.oldValue}</div>
              <div style={{ color: '#1890ff', fontWeight: 600, fontSize: 12 }}>{diff.newValue}</div>
            </div>
          </Tooltip>
        )
      }
      if (row.changeType === '新增') {
        return <span style={{ color: '#52c41a', fontWeight: 500 }}>{value || '-'}</span>
      }
      if (row.changeType === '删除') {
        return <span style={{ color: '#ff4d4f', textDecoration: 'line-through', opacity: 0.7 }}>{value || '-'}</span>
      }
      return <span style={{ color: '#595959' }}>{value || '-'}</span>
    }

    const compareColumns: any[] = [
      {
        title: '序号', dataIndex: 'taskId', key: 'taskId', width: 70, fixed: 'left',
        render: (val: string, row: CompareTableRow) => (
          <span style={{ fontWeight: 600, fontSize: 12, color: row.changeType === '新增' ? '#52c41a' : row.changeType === '删除' ? '#ff4d4f' : row.changeType === '修改' ? '#1890ff' : '#8c8c8c' }}>{val}</span>
        ),
      },
      {
        title: '变更类型', dataIndex: 'changeType', key: 'changeType', width: 80, fixed: 'left',
        render: (val: string) => {
          const conf: Record<string, { color: string; bg: string }> = {
            '新增': { color: '#52c41a', bg: '#f6ffed' },
            '删除': { color: '#ff4d4f', bg: '#fff2f0' },
            '修改': { color: '#1890ff', bg: '#e6f4ff' },
            '未变更': { color: '#8c8c8c', bg: '#fafafa' },
          }
          const c = conf[val]
          return c ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: c.color, background: c.bg, border: `1px solid ${c.color}20` }}>{val}</span> : null
        },
      },
      { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 160, fixed: 'left', ellipsis: true, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'taskName', val) },
      { title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 80, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'responsible', val) },
      { title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 80, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'predecessor', val) },
      { title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 105, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'planStartDate', val) },
      { title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 105, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'planEndDate', val) },
      { title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 80, render: (val: number, row: CompareTableRow) => renderDiffCell(row, 'estimatedDays', val ? `${val}天` : '-') },
      { title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 105, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'actualStartDate', val) },
      { title: '实际完成', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 105, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'actualEndDate', val) },
      { title: '实际工期', dataIndex: 'actualDays', key: 'actualDays', width: 80, render: (val: number, row: CompareTableRow) => renderDiffCell(row, 'actualDays', val ? `${val}天` : '-') },
      { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (val: string, row: CompareTableRow) => renderDiffCell(row, 'status', val) },
      { title: '进度', dataIndex: 'progress', key: 'progress', width: 70, render: (val: number, row: CompareTableRow) => renderDiffCell(row, 'progress', `${val}%`) },
    ]

    return (
      <div style={{ marginTop: 16 }}>
        {/* 统计概览 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          {[
            { label: '变更总计', value: changedRows.length, color: '#1890ff', filterVal: 'all' },
            { label: '新增', value: stats.added, color: '#52c41a', filterVal: '新增' },
            { label: '修改', value: stats.modified, color: '#1890ff', filterVal: '修改' },
            { label: '删除', value: stats.deleted, color: '#ff4d4f', filterVal: '删除' },
          ].map(item => {
            const isActive = compareFilterType === item.filterVal
            return (
              <div
                key={item.filterVal}
                onClick={() => setCompareFilterType(item.filterVal)}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                  background: isActive ? `${item.color}10` : '#fafafa',
                  border: isActive ? `1px solid ${item.color}` : '1px solid #f0f0f0',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{item.label}</div>
              </div>
            )
          })}
        </div>
        {/* 工具栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>共 {filteredData.length} 条记录</span>
          <Checkbox checked={compareShowUnchanged} onChange={e => setCompareShowUnchanged(e.target.checked)}>
            <span style={{ fontSize: 12 }}>显示未变更项</span>
          </Checkbox>
        </div>
        <Table
          className="pms-table"
          columns={compareColumns}
          dataSource={filteredData}
          size="small"
          bordered
          pagination={filteredData.length > 15 ? { pageSize: 15, size: 'small', showTotal: (t) => `共 ${t} 条` } : false}
          scroll={{ x: 1200, y: 420 }}
          rowKey="key"
          onRow={(record: CompareTableRow) => ({
            style: { background: getRowBg(record.changeType) },
          })}
        />
      </div>
    )
  }

  // 项目空间 - 需求模块
  const renderProjectRequirements = () => {
    return (
      <Card style={{ borderRadius: 8, textAlign: 'center', padding: '48px 0' }}>
        <Empty description={<span style={{ color: '#8c8c8c' }}>需求模块开发中...</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }

  // 基本信息编辑相关
  const startBasicInfoEdit = () => {
    if (!selectedProject) return
    const p = selectedProject
    setEditingProjectFields({
      productType: p.productType || '',
      developMode: p.developMode || '',
      currentNode: p.currentNode || '',
      healthStatus: p.healthStatus || 'normal',
      branchInfo: p.branchInfo || '',
      jenkinsUrl: p.jenkinsUrl || '',
      buildAddress: p.buildAddress || '',
      ppm: p.ppm || '',
      spm: p.spm || '',
      tpm: p.tpm || '',
      teamMembers: p.teamMembers || '',
      versionFiveRoles: p.versionFiveRoles || {},
      projectDescription: p.projectDescription || '',
    })
    setBasicInfoEditMode(true)
  }

  const saveBasicInfoEdit = () => {
    if (!selectedProject) return
    const updated = { ...selectedProject, ...editingProjectFields }
    setSelectedProject(updated)
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
    setBasicInfoEditMode(false)
    message.success('基本信息已保存')
  }

  // 项目空间-基础信息
  const renderProjectBasicInfo = () => {
    const p = selectedProject
    if (!p) return null
    const isWholeMachine = p.type === '整机产品项目'
    const isSoftware = p.type === '产品项目'
    const isTech = p.type === '技术项目'
    const isCapability = p.type === '能力建设项目'
    const statusConf = PROJECT_STATUS_CONFIG[p.status] || { color: '#8c8c8c', tagColor: 'default' }
    const healthMap: Record<string, { label: string; color: string }> = { normal: { label: '正常', color: '#52c41a' }, warning: { label: '关注', color: '#faad14' }, risk: { label: '风险', color: '#ff4d4f' } }
    const hConf = healthMap[p.healthStatus || 'normal'] || healthMap.normal
    const markets = p.markets || []

    // 编辑模式辅助
    const ef = editingProjectFields
    const setEf = (key: string, value: any) => setEditingProjectFields(prev => ({ ...prev, [key]: value }))
    const editableField = (key: string, value: any, options?: { type?: 'input' | 'select' | 'select-multiple' | 'textarea'; choices?: { label: string; value: string }[] }) => {
      if (!basicInfoEditMode) return <span>{value || '-'}</span>
      if (options?.type === 'select') {
        return <Select size="small" value={ef[key]} onChange={(v: string) => setEf(key, v)} style={{ width: '100%' }} options={options.choices} />
      }
      if (options?.type === 'select-multiple') {
        return <Select size="small" mode="multiple" value={(ef[key] || '').split(',').filter(Boolean)} onChange={(v: string[]) => setEf(key, v.join(','))} style={{ width: '100%' }} options={options.choices} />
      }
      if (options?.type === 'textarea') {
        return <Input.TextArea size="small" value={ef[key]} onChange={e => setEf(key, e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
      }
      return <Input size="small" value={ef[key]} onChange={e => setEf(key, e.target.value)} />
    }
    const nodeChoices = [{ label: '概念启动', value: '概念启动' }, { label: 'STR1', value: 'STR1' }, { label: 'STR2', value: 'STR2' }, { label: 'STR3', value: 'STR3' }, { label: 'STR4', value: 'STR4' }, { label: 'STR5', value: 'STR5' }, { label: 'STR6', value: 'STR6' }]
    const healthChoices = [{ label: '正常', value: 'normal' }, { label: '关注', value: 'warning' }, { label: '风险', value: 'risk' }]
    const developModeChoices = [{ label: 'ODC', value: 'ODC' }, { label: 'JDM', value: 'JDM' }, { label: '自研', value: '自研' }]
    const userChoices = ALL_USERS.map(u => ({ label: u, value: u }))

    const descLabelStyle: CSSProperties = { fontWeight: 500, color: '#8c8c8c', fontSize: 13, background: '#fafbfc' }
    const descContentStyle: CSSProperties = { color: '#262626', fontSize: 13 }
    const sectionTitle = (icon: React.ReactNode, title: string, color: string) => (
      <Space size={8}>{icon}<span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span></Space>
    )

    // 表头 - 只显示项目名称
    const headerExtra = p.name

    // 锚点导航配置
    const anchorSections = [
      { id: 'section-header', label: '项目概览', icon: <ProjectOutlined /> },
      { id: 'section-basic', label: '基本信息', icon: <SettingOutlined /> },
      ...(isWholeMachine && currentProjectTransferApps.length > 0 ? [{ id: 'section-transfer', label: '转维信息', icon: <DeploymentUnitOutlined /> }] : []),
      { id: 'section-plan', label: isWholeMachine ? '计划与配置' : '计划信息', icon: <CalendarOutlined /> },
      ...(!isWholeMachine && (isSoftware || isTech) ? [{ id: 'section-config', label: '配置信息', icon: <SettingOutlined /> }] : []),
    ]

    const scrollToSection = (id: string) => {
      const container = document.getElementById('basic-info-scroll-container')
      const target = document.getElementById(id)
      if (container && target) {
        const containerRect = container.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const offset = targetRect.top - containerRect.top + container.scrollTop - 16
        container.scrollTo({ top: offset, behavior: 'smooth' })
      }
    }

    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingRight: 170 }}>
        {/* 右侧锚点导航 - fixed定位 */}
        <div style={{
          position: 'fixed', right: 32, top: 130, zIndex: 50, width: 150,
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #fff 0%, #fafbfc 100%)',
            borderRadius: 10,
            border: '1px solid #e8e8e8',
            padding: '16px 0 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <div style={{ padding: '0 16px 10px', fontSize: 11, fontWeight: 600, color: '#bfbfbf', letterSpacing: 2, textTransform: 'uppercase' as const }}>导航</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {anchorSections.map((section) => (
                <div
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', cursor: 'pointer',
                    fontSize: 12, color: '#595959',
                    transition: 'all 0.2s',
                    borderLeft: '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e6f4ff'
                    e.currentTarget.style.color = '#1890ff'
                    e.currentTarget.style.borderLeftColor = '#1890ff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#595959'
                    e.currentTarget.style.borderLeftColor = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 13, opacity: 0.7 }}>{section.icon}</span>
                  <span style={{ fontWeight: 500 }}>{section.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* 表头卡片 */}
        <Card
          id="section-header"
          style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden' }}
          styles={{ header: { background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', borderBottom: 'none', padding: '16px 24px' }, body: { padding: 0 } }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ProjectOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{headerExtra}</div>
              </div>
            </div>
          }
          extra={
            <Space size={8}>
              <Tag color={statusConf.tagColor} style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>{p.status}</Tag>
              <Tag style={{ margin: 0, borderRadius: 4, background: hConf.color, border: 'none', color: '#fff' }}>{hConf.label}</Tag>
              {isWholeMachine && <Button type="primary" icon={<SendOutlined />} style={{ background: '#4338ca', borderColor: '#4338ca' }} onClick={() => setTransferView('apply')}>申请转维</Button>}
            </Space>
          }
        >
          {/* 摘要行: 项目分类 | 项目状态 | 健康状态 | 当前节点 */}
          <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #f0f0f0' }}>
            {[
              { label: '项目分类', value: p.type, editable: false },
              { label: '项目状态', value: p.status, editable: false },
              { label: '健康状态', value: hConf.label, editable: true, key: 'healthStatus', editNode: <Select size="small" value={ef.healthStatus} onChange={(v: string) => setEf('healthStatus', v)} style={{ width: 100 }} options={healthChoices} /> },
              ...((isSoftware || isWholeMachine || isTech) ? [{ label: '当前节点', value: p.currentNode || '-', editable: true, key: 'currentNode', editNode: <Select size="small" value={ef.currentNode} onChange={(v: string) => setEf('currentNode', v)} style={{ width: 120 }} options={nodeChoices} /> }] : []),
            ].map((item, i, arr) => (
              <div key={i} style={{ flex: 1, padding: '14px 20px', borderRight: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: '#262626', fontWeight: 600 }}>{basicInfoEditMode && item.editable ? item.editNode : item.value}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* 一、基本信息 */}
        <Card id="section-basic" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<SettingOutlined style={{ color: '#1890ff' }} />, '基本信息', '#1890ff')} extra={
          basicInfoEditMode ? (
            <Space>
              <Button size="small" onClick={() => setBasicInfoEditMode(false)}>取消</Button>
              <Button size="small" type="primary" onClick={saveBasicInfoEdit}>保存</Button>
            </Space>
          ) : (
            <Button size="small" icon={<EditOutlined />} onClick={startBasicInfoEdit}>编辑</Button>
          )
        }>
          {/* 软件产品项目 */}
          {isSoftware && (
            <div>
              <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                <Descriptions.Item label="项目名称">{p.name}</Descriptions.Item>
                <Descriptions.Item label="品牌">{p.brand || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品线">{p.productLine || '-'}</Descriptions.Item>
                <Descriptions.Item label="版本类型">{p.versionType || '-'}</Descriptions.Item>
                <Descriptions.Item label="芯片平台">{p.chipPlatform || '-'}</Descriptions.Item>
                <Descriptions.Item label="开发模式">{editableField('developMode', p.developMode, { type: 'select', choices: developModeChoices })}</Descriptions.Item>
              </Descriptions>
              {/* 版本五大员 */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#8c8c8c', marginBottom: 10 }}>版本五大员</div>
                <Row gutter={[12, 12]}>
                  {basicInfoEditMode ? (
                    Object.entries(ef.versionFiveRoles || {}).map(([role, name]: [string, any]) => (
                      <Col key={role} span={Math.floor(24 / 5)}>
                        <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                          <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>{role}</div>
                          <Select size="small" value={String(name)} onChange={(v: string) => setEf('versionFiveRoles', { ...ef.versionFiveRoles, [role]: v })} style={{ width: '100%' }} options={userChoices} />
                        </div>
                      </Col>
                    ))
                  ) : (
                    p.versionFiveRoles && typeof p.versionFiveRoles === 'object' ? (
                      Object.entries(p.versionFiveRoles).map(([role, name]: [string, any]) => (
                        <Col key={role} span={Math.floor(24 / 5)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                            <Avatar size={28} style={{ background: '#1890ff', fontSize: 12, flexShrink: 0 }}>{String(name)[0]}</Avatar>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#262626', lineHeight: 1.3 }}>{String(name)}</div>
                              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{role}</div>
                            </div>
                          </div>
                        </Col>
                      ))
                    ) : (
                      <Col><span style={{ color: '#8c8c8c', fontSize: 13 }}>-</span></Col>
                    )
                  )}
                </Row>
              </div>
            </div>
          )}

          {/* 整机产品项目 */}
          {isWholeMachine && (
            <div>
              <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                <Descriptions.Item label="项目名称">{p.name}</Descriptions.Item>
                <Descriptions.Item label="市场名">{p.marketName || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品类型">{editableField('productType', p.productType, { type: 'select', choices: [{ label: '新品', value: '新品' }, { label: '换代', value: '换代' }] })}</Descriptions.Item>
                <Descriptions.Item label="tOS版本">{p.tosVersion || '-'}</Descriptions.Item>
                <Descriptions.Item label="开发模式">{editableField('developMode', p.developMode, { type: 'select', choices: developModeChoices })}</Descriptions.Item>
                <Descriptions.Item label="品牌">{p.brand || '-'}</Descriptions.Item>
                <Descriptions.Item label="产品线">{p.productLine || '-'}</Descriptions.Item>
                <Descriptions.Item label="版本类型">{p.versionType || '-'}</Descriptions.Item>
                <Descriptions.Item label="市场">{p.market || (p.markets || []).join(', ') || '-'}</Descriptions.Item>
                <Descriptions.Item label="PPM">{editableField('ppm', p.ppm, { type: 'select', choices: userChoices })}</Descriptions.Item>
                <Descriptions.Item label="SPM">{editableField('spm', p.spm, { type: 'select', choices: userChoices })}</Descriptions.Item>
                <Descriptions.Item label="TPM">{editableField('tpm', p.tpm, { type: 'select', choices: userChoices })}</Descriptions.Item>
              </Descriptions>
            </div>
          )}

          {/* 技术项目 / 能力建设项目 */}
          {(isTech || isCapability) && (
            <div>
              <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                <Descriptions.Item label="项目名称">{p.name}</Descriptions.Item>
                <Descriptions.Item label="项目分类">{p.type}</Descriptions.Item>
                <Descriptions.Item label="项目状态"><Tag color={statusConf.tagColor}>{p.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="健康状态">{basicInfoEditMode ? <Select size="small" value={ef.healthStatus} onChange={(v: string) => setEf('healthStatus', v)} style={{ width: '100%' }} options={healthChoices} /> : <Tag style={{ background: hConf.color, border: 'none', color: '#fff' }}>{hConf.label}</Tag>}</Descriptions.Item>
              </Descriptions>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#8c8c8c', marginBottom: 8 }}>团队成员</div>
                {basicInfoEditMode ? (
                  <Select size="small" mode="multiple" value={(ef.teamMembers || '').split(',').filter(Boolean)} onChange={(v: string[]) => setEf('teamMembers', v.join(','))} style={{ width: '100%' }} options={userChoices} />
                ) : (
                  <Space wrap>
                    {(p.teamMembers || p.spm || '').split(',').filter(Boolean).map((name: string, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                        <Avatar size={24} style={{ background: '#1890ff', fontSize: 11 }}>{name.trim()[0]}</Avatar>
                        <span style={{ fontSize: 13 }}>{name.trim()}</span>
                      </div>
                    ))}
                  </Space>
                )}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#8c8c8c', marginBottom: 8 }}>项目描述</div>
                {basicInfoEditMode ? (
                  <Input.TextArea size="small" value={ef.projectDescription} onChange={e => setEf('projectDescription', e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
                ) : (
                  <div style={{ padding: '10px 14px', background: '#fafbfc', borderRadius: 6, border: '1px solid #f0f0f0', fontSize: 13, color: '#595959', lineHeight: 1.8 }}>
                    {p.projectDescription || '暂无描述'}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* 整机: 转维信息 */}
        {isWholeMachine && currentProjectTransferApps.length > 0 && (
          <Card id="section-transfer" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<DeploymentUnitOutlined style={{ color: '#4338ca' }} />, '转维信息', '#4338ca')}>
            <Table
              dataSource={currentProjectTransferApps}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
              rowClassName={(r) => r.status === 'cancelled' ? 'tm-row-cancelled' : ''}
              columns={[
                {
                  title: '项目名称', dataIndex: 'projectName', width: 200,
                  render: (_: unknown, r: TransferApplication) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar size={32} style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[r.team.research[0]?.role] || '#4338ca'} 0%, #6366f1 100%)`, fontSize: 12, flexShrink: 0 }}>{r.applicant.slice(-1)}</Avatar>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.projectName}</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.applicant} · {r.createdAt.slice(0, 10)}</div>
                      </div>
                    </div>
                  ),
                },
                { title: '流水线进度', width: 180, render: (_: unknown, r: TransferApplication) => <MiniPipeline app={r} /> },
                { title: '计划评审日期', dataIndex: 'plannedReviewDate', width: 110 },
                {
                  title: '角色进度', width: 180,
                  render: (_: unknown, r: TransferApplication) => (
                    <Space size={4} wrap>
                      {r.pipeline.roleProgress.map(rp => {
                        const color = rp.entryStatus === 'completed' && rp.reviewStatus === 'completed' ? 'success' : rp.reviewStatus === 'rejected' ? 'error' : rp.entryStatus === 'in_progress' || rp.reviewStatus === 'in_progress' ? 'processing' : 'default'
                        return <Tag key={rp.role} color={color} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>{rp.role}</Tag>
                      })}
                    </Space>
                  ),
                },
                {
                  title: '操作', width: 220,
                  render: (_: unknown, r: TransferApplication) => (
                    <Space size={4}>
                      <Button size="small" type="text" icon={<FileTextOutlined />} style={{ color: '#666' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('detail'); }}>详情</Button>
                      {r.status === 'in_progress' && r.pipeline.dataEntry !== 'success' && <Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#1677ff' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('entry'); }}>录入</Button>}
                      {r.status === 'in_progress' && r.pipeline.maintenanceReview === 'in_progress' && <Button size="small" type="text" icon={<AuditOutlined />} style={{ color: '#52c41a' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('review'); }}>评审</Button>}
                      {r.status === 'in_progress' && r.pipeline.sqaReview === 'in_progress' && <Button size="small" type="text" icon={<SafetyOutlined />} style={{ color: '#faad14' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('sqa-review'); }}>SQA审核</Button>}
                      {r.status === 'in_progress' && <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={() => { setTmCloseAppId(r.id); setTmCloseReason(''); setTmCloseModalVisible(true); }}>关闭</Button>}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        )}

        {/* 二、计划信息 + 三、配置信息 */}
        {isWholeMachine && markets.length > 0 ? (
          /* 整机产品项目: 按市场TAB切换计划信息和配置信息 */
          <Card id="section-plan" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<CalendarOutlined style={{ color: '#1890ff' }} />, '计划信息与配置信息', '#1890ff')}>
            <Tabs
              activeKey={selectedMarketTab}
              onChange={setSelectedMarketTab}
              type="card"
              items={markets.map(m => {
                const marketColor = m === 'OP' ? '#1890ff' : m === 'TR' ? '#52c41a' : '#faad14'
                return {
                  key: m,
                  label: <Space size={6}><Badge color={marketColor} /><span style={{ fontWeight: 500 }}>{m}</span></Space>,
                  children: (
                    <div style={{ padding: '8px 0' }}>
                      {/* 计划信息 */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#262626', marginBottom: 16 }}>计划信息</div>
                      <Row gutter={[24, 16]} style={{ marginBottom: 16 }}>
                        <Col span={6}>
                          <Statistic title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>计划开始时间</span>} value={p.planStartDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#1890ff', fontSize: 14 }} />} />
                        </Col>
                        <Col span={6}>
                          <Statistic title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>计划结束时间</span>} value={p.planEndDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} prefix={<CalendarOutlined style={{ color: '#faad14', fontSize: 14 }} />} />
                        </Col>
                        <Col span={6}>
                          <Statistic title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>开发周期（工作日）</span>} value={p.developCycle || '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} suffix={p.developCycle ? <span style={{ fontSize: 12, color: '#8c8c8c' }}>天</span> : undefined} />
                        </Col>
                        <Col span={6}>
                          <Statistic title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>上市时间</span>} value={p.launchDate || '-'} valueStyle={{ fontSize: 16, fontWeight: 600, color: '#722ed1' }} prefix={<CalendarOutlined style={{ color: '#722ed1', fontSize: 14 }} />} />
                        </Col>
                      </Row>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', marginBottom: 12 }}>里程碑计划（横排视图）</div>
                      {renderHorizontalTable()}

                      <Divider />

                      {/* 配置信息 */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#262626', marginBottom: 16 }}>配置信息</div>
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>硬件配置</div>
                        <Descriptions bordered size="small" column={4} labelStyle={descLabelStyle} contentStyle={descContentStyle}>
                          <Descriptions.Item label="主板名">{p.mainboard || '-'}</Descriptions.Item>
                          <Descriptions.Item label="芯片平台">{p.chipPlatform || '-'}</Descriptions.Item>
                          <Descriptions.Item label="芯片型号">{p.cpu || '-'}</Descriptions.Item>
                          <Descriptions.Item label="安卓版本">{p.operatingSystem || p.androidVersion || '-'}</Descriptions.Item>
                          <Descriptions.Item label="内存">{p.memory || '-'}</Descriptions.Item>
                          <Descriptions.Item label="屏幕">{p.lcd || '-'}</Descriptions.Item>
                          <Descriptions.Item label="网络模式">{p.networkMode || '-'}</Descriptions.Item>
                          <Descriptions.Item label="kernel版本">{p.kernelVersion || '-'}</Descriptions.Item>
                          <Descriptions.Item label="前摄像头">{p.frontCamera || '-'}</Descriptions.Item>
                          <Descriptions.Item label="后摄像头">{p.primaryCamera || '-'}</Descriptions.Item>
                          <Descriptions.Item label="屏幕形态">{p.screenShape || '-'}</Descriptions.Item>
                          <Descriptions.Item label="屏幕类型">{p.screenType || '-'}</Descriptions.Item>
                          <Descriptions.Item label="灯效">{p.lightEffect || '-'}</Descriptions.Item>
                          <Descriptions.Item label="人脸">{p.faceRecognition || '-'}</Descriptions.Item>
                          <Descriptions.Item label="音效">{p.soundEffect || '-'}</Descriptions.Item>
                          <Descriptions.Item label="SIM卡">{p.simCard || '-'}</Descriptions.Item>
                          <Descriptions.Item label="马达">{p.motor || '-'}</Descriptions.Item>
                          <Descriptions.Item label="指纹">{p.fingerprint || '-'}</Descriptions.Item>
                          <Descriptions.Item label="红外">{p.infrared || '-'}</Descriptions.Item>
                        </Descriptions>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>构建信息</div>
                      <Descriptions bordered size="small" column={1} labelStyle={{ ...descLabelStyle, width: 120 }} contentStyle={descContentStyle}>
                        <Descriptions.Item label="分支信息">{editableField('branchInfo', p.branchInfo)}</Descriptions.Item>
                        <Descriptions.Item label="Jenkins构建">{basicInfoEditMode ? editableField('jenkinsUrl', p.jenkinsUrl) : (p.jenkinsUrl ? <a href={p.jenkinsUrl} target="_blank" rel="noopener noreferrer">{p.jenkinsUrl}</a> : '-')}</Descriptions.Item>
                        <Descriptions.Item label="版本地址">{basicInfoEditMode ? editableField('buildAddress', p.buildAddress) : (p.buildAddress ? <a href={p.buildAddress} target="_blank" rel="noopener noreferrer">{p.buildAddress}</a> : '-')}</Descriptions.Item>
                      </Descriptions>
                    </div>
                  ),
                }
              })}
            />
          </Card>
        ) : (
          <>
            {/* 非整机: 计划信息 */}
            {renderProjectPlanInfo()}

            {/* 非整机: 配置信息 */}
            {(isSoftware || isTech) && (
              <Card id="section-config" style={{ marginBottom: 20, borderRadius: 8 }} title={sectionTitle(<SettingOutlined style={{ color: '#52c41a' }} />, '配置信息', '#52c41a')}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>构建信息</div>
                <Descriptions bordered size="small" column={1} labelStyle={{ ...descLabelStyle, width: 120 }} contentStyle={descContentStyle}>
                  <Descriptions.Item label="分支信息">{editableField('branchInfo', p.branchInfo)}</Descriptions.Item>
                  <Descriptions.Item label="Jenkins构建">{basicInfoEditMode ? editableField('jenkinsUrl', p.jenkinsUrl) : (p.jenkinsUrl ? <a href={p.jenkinsUrl} target="_blank" rel="noopener noreferrer">{p.jenkinsUrl}</a> : '-')}</Descriptions.Item>
                  <Descriptions.Item label="版本地址">{basicInfoEditMode ? editableField('buildAddress', p.buildAddress) : (p.buildAddress ? <a href={p.buildAddress} target="_blank" rel="noopener noreferrer">{p.buildAddress}</a> : '-')}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </>
        )}
      </div>
    )
  }

  // renderRequirementDevelopmentPlan 已移至 RequirementDevPlan 独立组件
  const renderProjectPlanInfo = () => {
    const p = selectedProject!
    const planTasks = LEVEL1_TASKS

    return (
      <Card
        id="section-plan"
        style={{ marginBottom: 20, borderRadius: 8 }}
        title={<Space><CalendarOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 600 }}>计划信息</span></Space>}
      >
        <Row gutter={[24, 16]}>
          <Col span={6}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>计划开始时间</span>}
              value={p.planStartDate || '-'}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
              prefix={<CalendarOutlined style={{ color: '#1890ff', fontSize: 14 }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>计划结束时间</span>}
              value={p.planEndDate || '-'}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
              prefix={<CalendarOutlined style={{ color: '#faad14', fontSize: 14 }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>开发周期（工作日）</span>}
              value={p.developCycle || '-'}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
              suffix={p.developCycle ? <span style={{ fontSize: 12, color: '#8c8c8c' }}>天</span> : undefined}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>健康状态</span>}
              value={p.healthStatus === 'normal' ? '健康' : p.healthStatus === 'warning' ? '关注' : p.healthStatus === 'risk' ? '风险' : '-'}
              valueStyle={{
                fontSize: 16, fontWeight: 600,
                color: p.healthStatus === 'normal' ? '#52c41a' : p.healthStatus === 'warning' ? '#faad14' : p.healthStatus === 'risk' ? '#ff4d4f' : '#8c8c8c',
              }}
            />
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        {/* 里程碑计划 - 横排视图 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 1 }}>里程碑计划（横排视图）</div>
        {renderHorizontalTable()}
      </Card>
    )
  }


  // 市场颜色映射
  const marketColors: Record<string, string> = { 'OP': '#1890ff', 'TR': '#52c41a', 'RU': '#faad14', 'FR': '#722ed1', 'IN': '#eb2f96', 'BR': '#13c2c2' }

  // 项目空间 - 计划模块
  const renderProjectPlan = () => {
    const markets = selectedProject?.markets || []
    const showMarketTabs = selectedProject?.type === '整机产品项目' && markets.length > 0

    const planTabItems = [
      { key: 'level1', label: '一级计划' },
      { key: 'level2', label: '二级计划' },
      { key: 'overview', label: '计划总览' },
    ]

    return (
      <div>
        {/* 市场TAB切换 - 仅整机产品项目显示 */}
        {showMarketTabs && (
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8 }}
            styles={{ body: { padding: '4px 16px' } }}
          >
            <Row align="middle" justify="space-between">
              <Col>
                <Space size={4} align="center">
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#8c8c8c', marginRight: 8 }}>市场</span>
                  {markets.map(market => (
                    <Tag
                      key={market}
                      color={selectedMarketTab === market ? (marketColors[market] || '#1890ff') : 'default'}
                      style={{
                        cursor: 'pointer', borderRadius: 4, padding: '4px 16px', fontSize: 13,
                        fontWeight: selectedMarketTab === market ? 600 : 400,
                        borderColor: selectedMarketTab === market ? (marketColors[market] || '#1890ff') : '#d9d9d9',
                      }}
                      onClick={() => navigateWithEditGuard(() => setSelectedMarketTab(market))}
                    >
                      {market}
                    </Tag>
                  ))}
                </Space>
              </Col>
              <Col>
                <Tag style={{ fontSize: 11, borderRadius: 4 }}>
                  当前市场: <span style={{ fontWeight: 600, color: marketColors[selectedMarketTab] || '#1890ff' }}>{selectedMarketTab}</span>
                </Tag>
              </Col>
            </Row>
          </Card>
        )}

        {/* 计划级别切换 */}
        <Card
          size="small"
          style={{ marginBottom: 16, borderRadius: 8 }}
          styles={{ body: { padding: '4px 16px' } }}
        >
          <Row align="middle" justify="space-between">
            <Col>
              <Tabs
                activeKey={projectPlanLevel}
                onChange={(key) => navigateWithEditGuard(() => setProjectPlanLevel(key as string))}
                style={{ marginBottom: 0 }}
                items={planTabItems.map(item => ({
                  ...item,
                  label: <span style={{ fontWeight: 500, padding: '0 4px' }}>{item.label}</span>,
                }))}
              />
            </Col>
            <Col>
              <Tag color={projectPlanLevel === 'overview' ? 'blue' : 'default'} style={{ fontSize: 11 }}>
                {planTabItems.find(t => t.key === projectPlanLevel)?.label}
              </Tag>
            </Col>
          </Row>
        </Card>

        {/* 计划总览 */}
        {projectPlanLevel === 'overview' && renderProjectPlanOverview()}

        {/* 二级计划Tab切换 - 在版本选择器上方 */}
        {projectPlanLevel === 'level2' && (
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8 }}
            styles={{ body: { padding: '4px 16px 4px 16px' } }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Tabs
                  activeKey={activeLevel2Plan}
                  onChange={(key) => navigateWithEditGuard(() => setActiveLevel2Plan(key))}
                  style={{ marginBottom: 0 }}
                  items={createdLevel2Plans.map(plan => ({
                    key: plan.id,
                    label: (
                      <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {plan.name}
                        {!plan.fixed && (
                          <Popconfirm
                            title={`确认删除"${plan.name}"？`}
                            onConfirm={(e) => {
                              e?.stopPropagation()
                              const newPlans = createdLevel2Plans.filter(p => p.id !== plan.id)
                              setCreatedLevel2Plans(newPlans)
                              if (activeLevel2Plan === plan.id) setActiveLevel2Plan(newPlans[0]?.id || 'plan0')
                              message.success(`已删除${plan.name}`)
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                            okText="确认"
                            cancelText="取消"
                          >
                            <DeleteOutlined
                              style={{ fontSize: 12, color: '#bfbfbf', marginLeft: 2 }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4d4f')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#bfbfbf')}
                            />
                          </Popconfirm>
                        )}
                      </span>
                    ),
                  }))}
                />
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} onClick={() => { if (!hasPublishedLevel1Plan) { message.warning('请先发布一级计划后再创建二级计划'); return; } setCreateFormValues({}); setShowCreateLevel2Plan(true) }}>创建二级计划</Button>
              </Col>
            </Row>
          </Card>
        )}

        {/* 二级计划元数据展示 - 仅1+N MR版本火车计划类型显示 */}
        {projectPlanLevel === 'level2' && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1' && level2PlanMeta[activeLevel2Plan]?.planType === '1+N MR版本火车计划' && (
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #e6f4ff' }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 16, background: '#1890ff', borderRadius: 2 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#262626' }}>计划基本信息</span>
              <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>{level2PlanMeta[activeLevel2Plan]?.planType}</Tag>
            </div>
            <Descriptions
              size="small"
              column={3}
              labelStyle={{ color: '#8c8c8c', fontSize: 13, fontWeight: 500, padding: '6px 12px 6px 0' }}
              contentStyle={{ color: '#262626', fontSize: 13, padding: '6px 0' }}
              colon={false}
            >
              <Descriptions.Item label="MR版本类型">
                <Tag color="geekblue">{level2PlanMeta[activeLevel2Plan]?.mrVersion}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="1+N转测类型">
                {level2PlanMeta[activeLevel2Plan]?.transferType ? <Tag color="orange">{level2PlanMeta[activeLevel2Plan].transferType}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="tOS-市场版本号">
                {level2PlanMeta[activeLevel2Plan]?.tosVersion ? <Tag color="cyan">{level2PlanMeta[activeLevel2Plan].tosVersion}</Tag> : '-'}
              </Descriptions.Item>
              {level2PlanMeta[activeLevel2Plan]?.productLine && (
                <>
                  <Descriptions.Item label="产品线">{level2PlanMeta[activeLevel2Plan]?.productLine || '-'}</Descriptions.Item>
                  <Descriptions.Item label="市场名">{level2PlanMeta[activeLevel2Plan]?.marketName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="项目名称">{level2PlanMeta[activeLevel2Plan]?.projectName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="芯片厂商">{level2PlanMeta[activeLevel2Plan]?.chipVendor || '-'}</Descriptions.Item>
                  <Descriptions.Item label="分支信息">
                    {level2PlanMeta[activeLevel2Plan]?.branch ? <Tag color="purple">{level2PlanMeta[activeLevel2Plan].branch}</Tag> : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="是否MADA">
                    {level2PlanMeta[activeLevel2Plan]?.isMada ? <Tag color={level2PlanMeta[activeLevel2Plan].isMada === '是' ? 'green' : 'default'}>{level2PlanMeta[activeLevel2Plan].isMada}</Tag> : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="MADA市场">{level2PlanMeta[activeLevel2Plan]?.madaMarket || '-'}</Descriptions.Item>
                  <Descriptions.Item label="项目SPM">{level2PlanMeta[activeLevel2Plan]?.spm || '-'}</Descriptions.Item>
                  <Descriptions.Item label="项目TPM">{level2PlanMeta[activeLevel2Plan]?.tpm || '-'}</Descriptions.Item>
                  <Descriptions.Item label="对接人">{level2PlanMeta[activeLevel2Plan]?.contact || '-'}</Descriptions.Item>
                  <Descriptions.Item label="项目版本号">
                    {level2PlanMeta[activeLevel2Plan]?.projectVersion ? <Tag>{level2PlanMeta[activeLevel2Plan].projectVersion}</Tag> : '-'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>
        )}

        {/* 需求开发计划 - 专用组件 */}
        {projectPlanLevel === 'level2' && activeLevel2Plan === 'plan0' && <RequirementDevPlan isEditMode={isEditMode} />}

        {/* 在研版本火车计划 - 专用组件 */}
        {projectPlanLevel === 'level2' && activeLevel2Plan === 'plan1' && <VersionTrainPlan />}

        {/* 非固定类型的二级计划 + 一级计划：版本管理 + 表格/甘特图 */}
        {projectPlanLevel !== 'overview' && !(projectPlanLevel === 'level2' && (activeLevel2Plan === 'plan0' || activeLevel2Plan === 'plan1')) && (
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8 }}
            styles={{ body: { padding: '12px 16px' } }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                    <Space size={6}>
                      <span style={{ color: '#8c8c8c', fontSize: 13 }}>版本</span>
                      <Select value={currentVersion} onChange={(val) => navigateWithEditGuard(() => { setCurrentVersion(val); setIsEditMode(false) })} style={{ width: 150 }} size="middle">
                        {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
                      </Select>
                      {isCurrentDraft && <Tag color="green" style={{ fontSize: 12, margin: 0 }}>自动保存</Tag>}
                    </Space>
                    <Space size={6}>
                      {!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} onClick={handleCreateRevision}>创建修订</Button>}
                      {isCurrentDraft && <Button type="primary" icon={<SaveOutlined />} style={{ borderRadius: 6 }} onClick={handlePublish}>发布</Button>}
                      {!isCurrentDraft && <Button icon={<HistoryOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowVersionCompare(true)}>版本对比</Button>}
                    </Space>
                  </Space>
              </Col>
              <Col>
                <Space size={6}>
                  <Input placeholder="搜索任务..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear onChange={(e) => setSearchText(e.target.value)} />
                  <Tooltip title="自定义列">
                    <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
                  </Tooltip>
                  <Radio.Group
                    value={projectPlanViewMode === 'horizontal' && projectPlanLevel === 'level2' ? 'table' : projectPlanViewMode}
                    onChange={(e) => setProjectPlanViewMode(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    size="small"
                    options={projectPlanLevel === 'level1' ? (isEditMode ? [
                      { label: '竖版表格', value: 'table' },
                      { label: '甘特图', value: 'gantt' },
                    ] : [
                      { label: '竖版表格', value: 'table' },
                      { label: '横版表格', value: 'horizontal' },
                      { label: '甘特图', value: 'gantt' },
                    ]) : [
                      { label: '表格', value: 'table' },
                      { label: '甘特图', value: 'gantt' },
                    ]}
                  />
                </Space>
              </Col>
            </Row>
          </Card>
        )}

        {/* 表格或甘特图内容 */}
        <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          {projectPlanLevel === 'level1' && (projectPlanViewMode === 'gantt' ? renderGanttChart() : projectPlanViewMode === 'horizontal' ? renderHorizontalTable() : renderTaskTable())}
          {projectPlanLevel === 'level2' && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1' && activeLevel2Plan && (
            projectPlanViewMode === 'gantt'
              ? renderGanttChart(level2PlanTasks.filter(t => t.planId === activeLevel2Plan))
              : renderTaskTable(level2PlanTasks.filter(t => t.planId === activeLevel2Plan))
          )}
        </Card>
      </div>
    )
  }

  // 项目空间 - 概况模块
  const renderProjectOverview = () => {
    return (
      <Card style={{ borderRadius: 8, textAlign: 'center', padding: '48px 0' }}>
        <Empty description={<span style={{ color: '#8c8c8c' }}>概况模块开发中...</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }
  
  // 项目空间 - 计划总览（一二级融合）
  const renderProjectPlanOverview = () => {
    const displayTasks = mergePlans(tasks, level2PlanTasks)

    return (
      <div>
        <Card
          style={{ borderRadius: 8 }}
          styles={{ body: { padding: 0 } }}
        >
          {/* 总览头部 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Space size={8} align="center">
                <BarChartOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>计划总览</span>
                <Tag color="blue" style={{ fontSize: 11, borderRadius: 4 }}>融合模式</Tag>
              </Space>
              <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c', paddingLeft: 24 }}>一级计划与二级计划融合展示</div>
            </div>
            <Tooltip title={projectPlanViewMode === 'gantt' ? '切换表格' : '切换甘特图'}>
              <Button
                icon={projectPlanViewMode === 'gantt' ? <UnorderedListOutlined /> : <BarChartOutlined />}
                size="small"
                style={{ borderRadius: 6 }}
                onClick={() => setProjectPlanViewMode(projectPlanViewMode === 'gantt' ? 'table' : 'gantt')}
              />
            </Tooltip>
          </div>
          {/* 表格/甘特图内容 */}
          <div style={{ padding: 0 }}>
            {projectPlanViewMode === 'gantt' ? renderGanttChart(displayTasks) : renderTaskTable(displayTasks)}
          </div>
        </Card>
      </div>
    )
  }

  // ========== 全局权限配置渲染 ==========
  const renderGlobalPermissionConfig = () => {
    const handleAddRole = () => {
      const name = globalNewRoleName.trim()
      if (!name) { message.warning('请输入角色名称'); return }
      if (globalRoles.some(r => r.name === name)) { message.warning('角色名称已存在'); return }
      setGlobalRoles([...globalRoles, { name, members: [] }])
      setGlobalRolePerms(prev => ({ ...prev, [name]: {} }))
      setGlobalNewRoleName('')
      setShowGlobalAddRole(false)
      message.success('角色添加成功')
    }
    const handleDeleteRole = (roleName: string) => {
      setGlobalRoles(globalRoles.filter(r => r.name !== roleName))
      setGlobalRolePerms(prev => { const next = { ...prev }; delete next[roleName]; return next })
      if (globalPermActiveRole === roleName) setGlobalPermActiveRole(globalRoles.filter(r => r.name !== roleName)[0]?.name || '')
      message.success('角色已删除')
    }
    const handleRenameRole = (oldName: string) => {
      const newName = globalEditRoleValue.trim()
      if (!newName) { message.warning('角色名称不能为空'); return }
      if (newName !== oldName && globalRoles.some(r => r.name === newName)) { message.warning('角色名称已存在'); return }
      setGlobalRoles(globalRoles.map(r => r.name === oldName ? { ...r, name: newName } : r))
      setGlobalRolePerms(prev => { const next = { ...prev }; next[newName] = next[oldName]; if (newName !== oldName) delete next[oldName]; return next })
      if (globalPermActiveRole === oldName) setGlobalPermActiveRole(newName)
      setGlobalEditingRole(null)
      message.success('角色名称已修改')
    }
    const handleMembersChange = (roleName: string, members: string[]) => {
      setGlobalRoles(globalRoles.map(r => r.name === roleName ? { ...r, members } : r))
    }
    const handlePermToggle = (roleName: string, permKey: string) => {
      setGlobalRolePerms(prev => ({
        ...prev,
        [roleName]: { ...prev[roleName], [permKey]: !prev[roleName]?.[permKey] }
      }))
    }

    return (
      <Card style={{ borderRadius: 8 }}>
        <Tabs activeKey={globalPermTab} onChange={(k) => setGlobalPermTab(k as any)} items={[
          { key: 'roles', label: <Space><TeamOutlined />角色配置</Space> },
          { key: 'perms', label: <Space><SafetyCertificateOutlined />权限配置</Space> },
        ]} />

        {globalPermTab === 'roles' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#595959' }}>共 {globalRoles.length} 个角色</span>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowGlobalAddRole(true)}>新增角色</Button>
            </div>
            <Table
              dataSource={globalRoles}
              rowKey="name"
              pagination={false}
              size="middle"
              columns={[
                {
                  title: '角色名称', dataIndex: 'name', width: 200,
                  render: (name: string) => {
                    if (globalEditingRole === name) {
                      return (
                        <Space>
                          <Input size="small" value={globalEditRoleValue} onChange={e => setGlobalEditRoleValue(e.target.value)} onPressEnter={() => handleRenameRole(name)} style={{ width: 120 }} />
                          <Button size="small" type="link" onClick={() => handleRenameRole(name)}>确定</Button>
                          <Button size="small" type="link" onClick={() => setGlobalEditingRole(null)}>取消</Button>
                        </Space>
                      )
                    }
                    return <span style={{ fontWeight: 500 }}>{name}</span>
                  }
                },
                {
                  title: '人员配置', dataIndex: 'members',
                  render: (_: any, record: any) => (
                    <Select
                      mode="multiple"
                      value={record.members}
                      onChange={(val: string[]) => handleMembersChange(record.name, val)}
                      style={{ width: '100%', minWidth: 300 }}
                      placeholder="请选择人员"
                      maxTagCount={5}
                      options={ALL_USERS.map(u => ({ label: u, value: u }))}
                    />
                  )
                },
                {
                  title: '操作', width: 150,
                  render: (_: any, record: any) => (
                    <Space>
                      <Button type="link" size="small" onClick={() => { setGlobalEditingRole(record.name); setGlobalEditRoleValue(record.name) }}>重命名</Button>
                      <Popconfirm title="确定删除该角色？" onConfirm={() => handleDeleteRole(record.name)}>
                        <Button type="link" size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  )
                },
              ]}
            />
            <Modal title="新增角色" open={showGlobalAddRole} onCancel={() => { setShowGlobalAddRole(false); setGlobalNewRoleName('') }} onOk={handleAddRole} okText="确定" cancelText="取消">
              <Form layout="vertical">
                <Form.Item label="角色名称" required>
                  <Input placeholder="请输入角色名称" value={globalNewRoleName} onChange={e => setGlobalNewRoleName(e.target.value)} onPressEnter={handleAddRole} />
                </Form.Item>
              </Form>
            </Modal>
          </div>
        )}

        {globalPermTab === 'perms' && (
          <div>
            {globalRoles.length === 0 ? (
              <Empty description="请先添加角色" style={{ padding: '40px 0' }} />
            ) : (
              <>
                <Tabs
                  activeKey={globalPermActiveRole}
                  onChange={setGlobalPermActiveRole}
                  type="card"
                  size="small"
                  style={{ marginBottom: 16 }}
                  items={globalRoles.map(r => ({ key: r.name, label: r.name }))}
                />
                <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, padding: '12px 16px', background: '#fafbfc', borderBottom: '1px solid #f0f0f0' }}>
                    角色权限配置 — {globalPermActiveRole}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {(() => {
                        // 按 module 分组
                        const modules: { module: string; perms: typeof GLOBAL_PERM_OPTIONS }[] = []
                        GLOBAL_PERM_OPTIONS.forEach(opt => {
                          const last = modules[modules.length - 1]
                          if (last && last.module === opt.module) {
                            last.perms.push(opt)
                          } else {
                            modules.push({ module: opt.module, perms: [opt] })
                          }
                        })
                        const maxCols = Math.max(...modules.map(m => m.perms.filter(p => p.name).length), 4)
                        return modules.map(mod => {
                          const realPerms = mod.perms.filter(p => p.name)
                          return (
                            <tr key={mod.module}>
                              <td style={{ padding: '12px 16px', fontWeight: 500, fontSize: 14, borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0', width: 140, background: '#fafbfc', verticalAlign: 'middle' }}>{mod.module}</td>
                              {realPerms.map(opt => (
                                <td key={opt.key} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0', minWidth: 110 }}>
                                  <div style={{ fontSize: 13, marginBottom: 6 }}>{opt.name}</div>
                                  <Checkbox checked={!!globalRolePerms[globalPermActiveRole]?.[opt.key]} onChange={() => handlePermToggle(globalPermActiveRole, opt.key)} />
                                </td>
                              ))}
                              {realPerms.length < maxCols && Array.from({ length: maxCols - realPerms.length }).map((_, i) => (
                                <td key={`empty-${i}`} style={{ borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />
                              ))}
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    )
  }

  // ========== 项目空间权限配置渲染 ==========
  const renderPermissionConfig = () => {
    const handleAddRole = () => {
      const name = newRoleName.trim()
      if (!name) { message.warning('请输入角色名称'); return }
      if (roles.some(r => r.name === name)) { message.warning('角色名称已存在'); return }
      setRoles([...roles, { name, members: [], isFixed: false }])
      setRolePermissions(prev => ({ ...prev, [name]: {} }))
      setNewRoleName('')
      setShowAddRoleModal(false)
      message.success('角色添加成功')
    }
    const handleDeleteRole = (roleName: string) => {
      setRoles(roles.filter(r => r.name !== roleName))
      setRolePermissions(prev => { const next = { ...prev }; delete next[roleName]; return next })
      if (permissionActiveRole === roleName) setPermissionActiveRole(roles[0]?.name || '系统管理员')
      message.success('角色已删除')
    }
    const handleRenameRole = (oldName: string) => {
      const newName = editRoleNameValue.trim()
      if (!newName) { message.warning('角色名称不能为空'); return }
      if (newName !== oldName && roles.some(r => r.name === newName)) { message.warning('角色名称已存在'); return }
      setRoles(roles.map(r => r.name === oldName ? { ...r, name: newName } : r))
      setRolePermissions(prev => { const next = { ...prev }; next[newName] = next[oldName]; if (newName !== oldName) delete next[oldName]; return next })
      if (permissionActiveRole === oldName) setPermissionActiveRole(newName)
      setEditingRoleName(null)
      message.success('角色名称已修改')
    }
    const handleMembersChange = (roleName: string, members: string[]) => {
      setRoles(roles.map(r => r.name === roleName ? { ...r, members } : r))
    }
    const handlePermToggle = (roleName: string, permKey: string) => {
      setRolePermissions(prev => ({
        ...prev,
        [roleName]: { ...prev[roleName], [permKey]: !prev[roleName]?.[permKey] }
      }))
    }

    return (
      <Card style={{ borderRadius: 8 }}>
        <Tabs activeKey={permConfigTab} onChange={(k) => setPermConfigTab(k as any)} items={[
          { key: 'roles', label: <Space><TeamOutlined />角色人员配置</Space> },
          { key: 'perms', label: <Space><SafetyCertificateOutlined />权限配置</Space> },
        ]} />

        {permConfigTab === 'roles' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#595959' }}>共 {roles.length} 个角色（{FIXED_ROLES.length} 个固定角色）</span>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddRoleModal(true)}>新增角色</Button>
            </div>
            <Table
              dataSource={roles}
              rowKey="name"
              pagination={false}
              size="middle"
              columns={[
                {
                  title: '角色名称', dataIndex: 'name', width: 200,
                  render: (name: string, record: any) => {
                    if (editingRoleName === name) {
                      return (
                        <Space>
                          <Input size="small" value={editRoleNameValue} onChange={e => setEditRoleNameValue(e.target.value)} onPressEnter={() => handleRenameRole(name)} style={{ width: 120 }} />
                          <Button size="small" type="link" onClick={() => handleRenameRole(name)}>确定</Button>
                          <Button size="small" type="link" onClick={() => setEditingRoleName(null)}>取消</Button>
                        </Space>
                      )
                    }
                    return (
                      <Space>
                        <span style={{ fontWeight: 500 }}>{name}</span>
                        {record.isFixed && <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>固定</Tag>}
                      </Space>
                    )
                  }
                },
                {
                  title: '人员配置', dataIndex: 'members',
                  render: (_: any, record: any) => (
                    <Select
                      mode="multiple"
                      value={record.members}
                      onChange={(val: string[]) => handleMembersChange(record.name, val)}
                      style={{ width: '100%', minWidth: 300 }}
                      placeholder="请选择人员"
                      maxTagCount={5}
                      options={ALL_USERS.map(u => ({ label: u, value: u }))}
                    />
                  )
                },
                {
                  title: '操作', width: 120,
                  render: (_: any, record: any) => record.isFixed ? (
                    <span style={{ color: '#bfbfbf', fontSize: 12 }}>-</span>
                  ) : (
                    <Space>
                      <Button type="link" size="small" onClick={() => { setEditingRoleName(record.name); setEditRoleNameValue(record.name) }}>重命名</Button>
                      <Popconfirm title="确定删除该角色？" onConfirm={() => handleDeleteRole(record.name)}>
                        <Button type="link" size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  )
                },
              ]}
            />
            <Modal title="新增角色" open={showAddRoleModal} onCancel={() => { setShowAddRoleModal(false); setNewRoleName('') }} onOk={handleAddRole} okText="确定" cancelText="取消">
              <Form layout="vertical">
                <Form.Item label="角色名称" required>
                  <Input placeholder="请输入角色名称" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onPressEnter={handleAddRole} />
                </Form.Item>
              </Form>
            </Modal>
          </div>
        )}

        {permConfigTab === 'perms' && (
          <div>
            <Tabs
              activeKey={permissionActiveRole}
              onChange={setPermissionActiveRole}
              type="card"
              size="small"
              style={{ marginBottom: 16 }}
              items={roles.map(r => ({ key: r.name, label: r.name }))}
            />
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: 14, padding: '12px 16px', background: '#fafbfc', borderBottom: '1px solid #f0f0f0' }}>
                角色权限配置 — {permissionActiveRole}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {PERMISSION_MODULES.map((mod) => {
                    const perms = mod.permissions
                    const maxCols = 6
                    return (
                      <tr key={mod.key}>
                        <td style={{ padding: '12px 16px', fontWeight: 500, fontSize: 14, borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0', width: 100, background: '#fafbfc', verticalAlign: 'middle' }}>{mod.name}</td>
                        {perms.length > 0 ? (
                          <>
                            {perms.map(p => (
                              <td key={p} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0', minWidth: 110 }}>
                                <div style={{ fontSize: 13, marginBottom: 6 }}>{p}</div>
                                <Checkbox checked={!!rolePermissions[permissionActiveRole]?.[`${mod.key}:${p}`]} onChange={() => handlePermToggle(permissionActiveRole, `${mod.key}:${p}`)} />
                              </td>
                            ))}
                            {perms.length < maxCols && Array.from({ length: maxCols - perms.length }).map((_, i) => (
                              <td key={`empty-${i}`} style={{ borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />
                            ))}
                          </>
                        ) : (
                          <td colSpan={maxCols} style={{ borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    )
  }

  // ========== 转维配置中心 ==========
  const renderTransferMaterialConfig = () => {
    if (transferConfigView === 'home') {
      const cards = [
        { key: 'checklist', icon: <FileTextOutlined style={{ fontSize: 28, color: '#4338ca' }} />, title: '转维材料配置', count: MOCK_CHECKLIST_TEMPLATES.length, desc: '管理转维CheckList模板，包括检查项、交接资料等' },
        { key: 'review', icon: <AuditOutlined style={{ fontSize: 28, color: '#4338ca' }} />, title: '评审要素配置', count: MOCK_REVIEW_ELEMENT_TEMPLATES.length, desc: '管理评审要素模板，包括各角色评审标准' },
      ]
      return (
        <div>
          <Breadcrumb items={[{ title: '配置中心' }]} style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: '#262626' }}>配置中心</div>
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
                      <div style={{ fontSize: 13, color: '#8c8c8c' }}>{c.desc}</div>
                    </div>
                  </div>
                  <Button type="primary" style={{ background: '#4338ca', borderColor: '#4338ca' }} onClick={() => setTransferConfigView(c.key as 'checklist' | 'review')}>管理</Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )
    }

    const isChecklist = transferConfigView === 'checklist'
    const title = isChecklist ? '转维材料配置' : '评审要素配置'
    const templates = isChecklist ? MOCK_CHECKLIST_TEMPLATES : MOCK_REVIEW_ELEMENT_TEMPLATES
    const versions = isChecklist ? MOCK_CHECKLIST_VERSIONS : MOCK_RE_VERSIONS
    const diffData = isChecklist ? MOCK_CHECKLIST_VERSION_DIFF : MOCK_RE_VERSION_DIFF
    const filtered = templates.filter((t: any) => {
      if (!tmConfigSearchText) return true
      const s = tmConfigSearchText.toLowerCase()
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
        <Breadcrumb items={[{ title: <a onClick={() => setTransferConfigView('home')}>配置中心</a> }, { title }]} style={{ marginBottom: 16 }} />
        <Card
          title={<span style={{ fontWeight: 600 }}>{title}</span>}
          extra={
            <Space size={8}>
              <Button icon={<UploadOutlined />}>导入</Button>
              <Button icon={<DownloadOutlined />}>导出</Button>
              <Select value={tmConfigSelectedVersion} onChange={setTmConfigSelectedVersion} style={{ width: 100 }}>
                {versions.map((v: any) => <Option key={v.version} value={v.version}>{v.version}</Option>)}
              </Select>
              <Tooltip title="版本对比"><Button icon={<DiffOutlined />} onClick={() => setTmConfigDiffOpen(true)} /></Tooltip>
            </Space>
          }
          style={{ borderRadius: 10 }}
        >
          <div style={{ marginBottom: 16 }}>
            <Input placeholder="搜索..." prefix={<SearchOutlined />} allowClear value={tmConfigSearchText} onChange={e => setTmConfigSearchText(e.target.value)} style={{ width: 300 }} />
          </div>
          <Table dataSource={filtered as any[]} columns={columns} rowKey="id" size="small" pagination={false} scroll={{ x: 900 }} />
        </Card>
        <Modal title="版本对比" open={tmConfigDiffOpen} onCancel={() => setTmConfigDiffOpen(false)} width={800} footer={<Button onClick={() => setTmConfigDiffOpen(false)}>关闭</Button>}>
          <Space style={{ marginBottom: 16 }}>
            <span>从</span>
            <Select value={tmConfigDiffFrom} onChange={setTmConfigDiffFrom} style={{ width: 100 }}>{versions.map((v: any) => <Option key={v.version} value={v.version}>{v.version}</Option>)}</Select>
            <span>到</span>
            <Select value={tmConfigDiffTo} onChange={setTmConfigDiffTo} style={{ width: 100 }}>{versions.map((v: any) => <Option key={v.version} value={v.version}>{v.version}</Option>)}</Select>
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

  // ========== 转维工作台 ==========
  const renderTransferWorkbench = () => {
    const apps = transferApplications.filter(a => a.projectName === selectedProject?.name)
    const stats = [
      { label: '总计', value: apps.length, color: '#4338ca' },
      { label: '进行中', value: apps.filter(a => a.status === 'in_progress').length, color: '#1677ff' },
      { label: '已完成', value: apps.filter(a => a.status === 'completed').length, color: '#52c41a' },
      { label: '已关闭', value: apps.filter(a => a.status === 'cancelled').length, color: '#d9d9d9' },
    ]
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>转维管理</span>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: '#4338ca' }} onClick={() => setTransferView('apply')}>申请转维</Button>
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
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{r.projectName}</div><div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.applicant} · {r.createdAt.slice(0, 10)}</div></div>
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
                  <Button size="small" type="text" icon={<FileTextOutlined />} style={{ color: '#666' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('detail'); }}>详情</Button>
                  {r.status === 'in_progress' && r.pipeline.dataEntry !== 'success' && <Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#1677ff' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('entry'); }}>录入</Button>}
                  {r.status === 'in_progress' && r.pipeline.maintenanceReview === 'in_progress' && <Button size="small" type="text" icon={<AuditOutlined />} style={{ color: '#52c41a' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('review'); }}>评审</Button>}
                  {r.status === 'in_progress' && r.pipeline.sqaReview === 'in_progress' && <Button size="small" type="text" icon={<SafetyOutlined />} style={{ color: '#faad14' }} onClick={() => { setSelectedTransferAppId(r.id); setTransferView('sqa-review'); }}>SQA审核</Button>}
                  {r.status === 'in_progress' && <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={() => { setTmCloseAppId(r.id); setTmCloseReason(''); setTmCloseModalVisible(true); }}>关闭</Button>}
                </Space>
              )},
            ]}
          />
        </Card>
        {/* 关闭Modal */}
        <Modal title="关闭转维流水线" open={tmCloseModalVisible} onCancel={() => setTmCloseModalVisible(false)} onOk={() => {
          if (!tmCloseReason.trim()) { message.warning('请输入关闭原因'); return; }
          setTransferApplications(prev => prev.map(a => a.id === tmCloseAppId ? { ...a, status: 'cancelled' as const, cancelReason: tmCloseReason } : a));
          setTmCloseModalVisible(false); message.success('已关闭');
        }}>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#8c8c8c' }}>关闭后该转维申请将不可恢复，请确认。</div>
          <TextArea rows={3} placeholder="请输入关闭原因..." value={tmCloseReason} onChange={e => setTmCloseReason(e.target.value)} />
        </Modal>
      </div>
    )
  }

  // ========== 转维申请 ==========
  const renderTransferApply = () => {
    const roleOrder: string[] = ['SPM', 'TPM', 'SQA', '底软', '系统', '影像']
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setTransferView(null)} style={{ color: '#4338ca', fontWeight: 500, padding: 0 }}>返回</Button>
        </div>
        <Card style={{ borderRadius: 10 }} title={<Space><SwapOutlined style={{ color: '#4338ca' }} /><span style={{ fontWeight: 600 }}>申请转维</span></Space>}>
          <Form layout="vertical">
            <Form.Item label="项目名称" required>
              <Select value={selectedProject?.name || ''} disabled style={{ width: '100%' }}>
                <Option value={selectedProject?.name || ''}>{selectedProject?.name}</Option>
              </Select>
            </Form.Item>
            <Form.Item label="计划评审日期">
              <Input type="date" value={tmApplyDate} onChange={e => setTmApplyDate(e.target.value)} />
            </Form.Item>
            <Form.Item label="备注">
              <TextArea rows={3} placeholder="请输入备注信息..." value={tmApplyRemark} onChange={e => setTmApplyRemark(e.target.value)} />
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
                      const members = tmApplyTeam[side].filter(m => m.role === role)
                      return (
                        <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <Tag color={ROLE_COLORS[role] || '#999'} style={{ color: '#fff', minWidth: 40, textAlign: 'center', borderRadius: 4 }}>{role}</Tag>
                          <Select mode="multiple" placeholder={`选择${role}成员`} value={members.map(m => m.id)} style={{ flex: 1 }}
                            onChange={(vals: string[]) => {
                              const newMembers = tmApplyTeam[side].filter(m => m.role !== role)
                              vals.forEach(uid => {
                                const u = MOCK_TM_USERS.find(u => u.id === uid)
                                if (u) newMembers.push({ ...u, role: role as any })
                              })
                              setTmApplyTeam(prev => ({ ...prev, [side]: newMembers }))
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
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>{g.desc}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setTransferView(null)}>取消</Button>
              <Button type="primary" style={{ background: '#4338ca' }} onClick={() => {
                if (!tmApplyDate) { message.warning('请选择计划评审日期'); return; }
                const newApp: TransferApplication = {
                  id: `app-new-${Date.now()}`,
                  projectId: selectedProject?.id || '',
                  projectName: selectedProject?.name || '',
                  applicant: currentUser.name,
                  applicantId: currentUser.id,
                  team: { research: tmApplyTeam.research, maintenance: tmApplyTeam.maintenance },
                  plannedReviewDate: tmApplyDate,
                  remark: tmApplyRemark,
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
                setTransferApplications(prev => [newApp, ...prev])
                setTmApplyDate(''); setTmApplyRemark(''); setTmApplyTeam({ research: [], maintenance: [] })
                setTransferView(null); setProjectSpaceModule('basic')
                message.success('转维申请已提交')
              }}>提交申请</Button>
            </Space>
          </div>
        </Card>
      </div>
    )
  }

  // ========== 转维详情 ==========
  const renderTransferDetail = () => {
    const app = transferApplications.find(a => a.id === selectedTransferAppId)
    if (!app) return <Empty description="未找到该转维申请" />
    const appChecklist = tmChecklistItems.filter(c => c.applicationId === app.id)
    const appReviewEls = tmReviewElements.filter(r => r.applicationId === app.id)
    const appBlockTasks = tmBlockTasks.filter(b => b.applicationId === app.id)
    const appLegacyTasks = tmLegacyTasks.filter(l => l.applicationId === app.id)
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
      if (action.includes('创建')) return <ExclamationCircleOutlined style={{ color: '#1677ff' }} />
      if (action.includes('通过')) return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      if (action.includes('Block') || action.includes('不通过')) return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      if (action.includes('录入')) return <ClockCircleOutlined style={{ color: '#faad14' }} />
      return <ClockCircleOutlined style={{ color: '#1677ff' }} />
    }

    const renderEntryStatusTag = (status: string) => {
      const config = ENTRY_STATUS_CONFIG[status]
      return <Tag color={config?.color}>{config?.label}</Tag>
    }
    const renderAICheckStatusTag = (status: string, result?: string) => {
      const config = AI_CHECK_STATUS_CONFIG[status]
      if (status === 'failed' && result) {
        return <Tag color={config?.color} style={{ cursor: 'pointer' }} onClick={() => { setTmDetailModalTitle('AI检查结果'); setTmDetailModalContent(result); setTmDetailModalVisible(true) }}>{config?.label}</Tag>
      }
      return <Tag color={config?.color}>{config?.label}</Tag>
    }
    const renderReviewStatusTag = (status: string, comment?: string) => {
      const config = REVIEW_STATUS_CONFIG[status]
      if (status === 'rejected' && comment) {
        return <Tag color={config?.color} style={{ cursor: 'pointer' }} onClick={() => { setTmDetailModalTitle('审核意见'); setTmDetailModalContent(comment); setTmDetailModalVisible(true) }}>{config?.label}</Tag>
      }
      return <Tag color={config?.color}>{config?.label}</Tag>
    }

    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* 顶部返回按钮 + 标题 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setTransferView(null)}>返回</Button>
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
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 0', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '0 16px 8px', borderBottom: '1px solid #f5f5f5', marginBottom: 4, letterSpacing: 1 }}>页面导航</div>
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
        <Modal title={tmDetailModalTitle} open={tmDetailModalVisible} onCancel={() => setTmDetailModalVisible(false)} footer={[<Button key="close" onClick={() => setTmDetailModalVisible(false)}>关闭</Button>]}>
          <p style={{ whiteSpace: 'pre-wrap' }}>{tmDetailModalContent}</p>
        </Modal>
      </div>
    )
  }

  // ========== 转维资料录入 ==========
  const renderTransferEntry = () => {
    const app = transferApplications.find(a => a.id === selectedTransferAppId)
    if (!app) return <Empty description="未找到申请" />

    const appChecklist = tmChecklistItems.filter(c => c.applicationId === app.id)
    const appReviewEls = tmReviewElements.filter(r => r.applicationId === app.id)
    const roles = Array.from(new Set([...appChecklist.map(c => c.responsibleRole), ...appReviewEls.map(r => r.responsibleRole)]))
    const filteredCL = tmEntryActiveRole === 'all' ? appChecklist : appChecklist.filter(c => c.responsibleRole === tmEntryActiveRole)
    const filteredRE = tmEntryActiveRole === 'all' ? appReviewEls : appReviewEls.filter(r => r.responsibleRole === tmEntryActiveRole)

    const openEntry = (record: any, tab: 'checklist' | 'review') => {
      setTmEntryModalRecord({ ...record, _tab: tab })
      setTmEntryContent(record.entryContent || '')
      setTmEntryModalOpen(true)
    }

    const saveEntry = (mode: 'draft' | 'confirm') => {
      if (!tmEntryModalRecord) return
      const status: EntryStatus = mode === 'draft' ? 'draft' : 'entered'
      if (tmEntryModalRecord._tab === 'checklist') {
        setTmChecklistItems(prev => prev.map(c => c.id === tmEntryModalRecord.id ? { ...c, entryContent: tmEntryContent, entryStatus: status, aiCheckStatus: mode === 'confirm' ? 'passed' as const : 'not_started' as const } : c))
      } else {
        setTmReviewElements(prev => prev.map(r => r.id === tmEntryModalRecord.id ? { ...r, entryContent: tmEntryContent, entryStatus: status, aiCheckStatus: mode === 'confirm' ? 'passed' as const : 'not_started' as const } : r))
      }
      setTmEntryModalOpen(false)
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
        <div style={{ marginBottom: 20 }}><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setTransferView(null)} style={{ color: '#4338ca', fontWeight: 500, padding: 0 }}>返回</Button></div>
        <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space><SwapOutlined style={{ color: '#4338ca' }} /><span style={{ fontWeight: 600 }}>{app.projectName} - 资料录入</span></Space>}>
          <PipelineProgress pipeline={app.pipeline} />
        </Card>

        <Card style={{ borderRadius: 10 }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Segmented options={[{ label: '全部', value: 'all' }, ...roles.map(r => ({ label: r, value: r }))]} value={tmEntryActiveRole} onChange={v => setTmEntryActiveRole(v as string)} />
            </Space>
            <Tabs activeKey={tmEntryTab} onChange={k => setTmEntryTab(k as any)} items={[{ key: 'checklist', label: `转维材料 (${filteredCL.length})` }, { key: 'review', label: `评审要素 (${filteredRE.length})` }]} style={{ marginBottom: 0 }} />
          </div>
          {tmEntryTab === 'checklist' && <Table dataSource={filteredCL} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} columns={clColumns} />}
          {tmEntryTab === 'review' && <Table dataSource={filteredRE} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} columns={reColumns} />}
        </Card>

        <Modal title="资料录入" open={tmEntryModalOpen} onCancel={() => setTmEntryModalOpen(false)} width={600}
          footer={[
            <Button key="cancel" onClick={() => setTmEntryModalOpen(false)}>取消</Button>,
            <Button key="draft" onClick={() => saveEntry('draft')}>暂存</Button>,
            <Button key="confirm" type="primary" style={{ background: '#4338ca' }} onClick={() => saveEntry('confirm')}>确认提交</Button>,
          ]}>
          {tmEntryModalRecord && (
            <div>
              <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="评审要素">{tmEntryModalRecord.checkItem || tmEntryModalRecord.description}</Descriptions.Item>
                <Descriptions.Item label="角色"><Tag color={ROLE_COLORS[tmEntryModalRecord.responsibleRole]} style={{ color: '#fff' }}>{tmEntryModalRecord.responsibleRole}</Tag></Descriptions.Item>
                <Descriptions.Item label="AI检查规则"><span style={{ fontSize: 12, color: '#8c8c8c' }}>{tmEntryModalRecord.aiCheckRule}</span></Descriptions.Item>
              </Descriptions>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>录入内容</div>
              <TextArea rows={6} placeholder="请输入资料内容，支持文本描述、链接、飞书文档地址等..." value={tmEntryContent} onChange={e => setTmEntryContent(e.target.value)} />
            </div>
          )}
        </Modal>
      </div>
    )
  }

  // ========== 转维审核 ==========
  const renderTransferReview = () => {
    const app = transferApplications.find(a => a.id === selectedTransferAppId)
    if (!app) return <Empty description="未找到申请" />

    const appChecklist = tmChecklistItems.filter(c => c.applicationId === app.id)
    const appReviewEls = tmReviewElements.filter(r => r.applicationId === app.id)
    const roles = Array.from(new Set([...appChecklist.map(c => c.responsibleRole), ...appReviewEls.map(r => r.responsibleRole)]))
    const filteredCL = tmReviewActiveRole === 'all' ? appChecklist : appChecklist.filter(c => c.responsibleRole === tmReviewActiveRole)
    const filteredRE = tmReviewActiveRole === 'all' ? appReviewEls : appReviewEls.filter(r => r.responsibleRole === tmReviewActiveRole)

    const openReview = (record: any, action: 'pass' | 'reject', tab: 'checklist' | 'review') => {
      setTmReviewRecord({ ...record, _tab: tab }); setTmReviewAction(action); setTmReviewComment(''); setTmReviewModalOpen(true)
    }

    const submitReview = () => {
      if (!tmReviewRecord) return
      const status: ReviewStatus = tmReviewAction === 'pass' ? 'passed' : 'rejected'
      if (tmReviewRecord._tab === 'checklist') {
        setTmChecklistItems(prev => prev.map(c => c.id === tmReviewRecord.id ? { ...c, reviewStatus: status, reviewComment: tmReviewAction === 'reject' ? tmReviewComment : undefined } : c))
      } else {
        setTmReviewElements(prev => prev.map(r => r.id === tmReviewRecord.id ? { ...r, reviewStatus: status, reviewComment: tmReviewAction === 'reject' ? tmReviewComment : undefined } : r))
      }
      setTmReviewModalOpen(false)
      message.success(tmReviewAction === 'pass' ? '已通过' : '已拒绝')
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
        <div style={{ marginBottom: 20 }}><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setTransferView(null)} style={{ color: '#4338ca', fontWeight: 500, padding: 0 }}>返回</Button></div>
        <Card style={{ marginBottom: 20, borderRadius: 10 }} title={<Space><SwapOutlined style={{ color: '#4338ca' }} /><span style={{ fontWeight: 600 }}>{app.projectName} - 维护审核</span></Space>}>
          <PipelineProgress pipeline={app.pipeline} />
        </Card>
        <Card style={{ borderRadius: 10 }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Segmented options={[{ label: '全部', value: 'all' }, ...roles.map(r => ({ label: r, value: r }))]} value={tmReviewActiveRole} onChange={v => setTmReviewActiveRole(v as string)} />
            <Tabs activeKey={tmReviewTab} onChange={k => setTmReviewTab(k as any)} items={[{ key: 'checklist', label: `转维材料 (${filteredCL.length})` }, { key: 'review', label: `评审要素 (${filteredRE.length})` }]} style={{ marginBottom: 0 }} />
          </div>
          {tmReviewTab === 'checklist' && <Table dataSource={filteredCL} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} columns={reviewColumns('checklist')} />}
          {tmReviewTab === 'review' && <Table dataSource={filteredRE} rowKey="id" size="small" pagination={false} scroll={{ x: 1000 }} columns={reviewColumns('review')} />}
        </Card>
        <Modal title={tmReviewAction === 'pass' ? '审核通过' : '审核拒绝'} open={tmReviewModalOpen} onCancel={() => setTmReviewModalOpen(false)} onOk={submitReview} okButtonProps={{ danger: tmReviewAction === 'reject', style: tmReviewAction === 'pass' ? { background: '#52c41a', borderColor: '#52c41a' } : {} }} okText={tmReviewAction === 'pass' ? '确认通过' : '确认拒绝'}>
          {tmReviewRecord && (
            <div>
              <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="评审要素">{tmReviewRecord.checkItem || tmReviewRecord.description}</Descriptions.Item>
                <Descriptions.Item label="录入内容">{tmReviewRecord.entryContent || '-'}</Descriptions.Item>
              </Descriptions>
              {tmReviewAction === 'reject' && <TextArea rows={3} placeholder="请输入拒绝原因..." value={tmReviewComment} onChange={e => setTmReviewComment(e.target.value)} />}
            </div>
          )}
        </Modal>
      </div>
    )
  }

  // ========== SQA审核 ==========
  const renderTransferSqaReview = () => {
    const app = transferApplications.find(a => a.id === selectedTransferAppId)
    if (!app) return <Empty description="未找到申请" />
    const sqaComment = tmSqaComment
    const setSqaComment = setTmSqaComment
    const sqaModalOpen = tmSqaModalOpen
    const setSqaModalOpen = setTmSqaModalOpen
    const sqaAction = tmSqaAction
    const setSqaAction = setTmSqaAction

    const appChecklist = tmChecklistItems.filter(c => c.applicationId === app.id)
    const appReviewEls = tmReviewElements.filter(r => r.applicationId === app.id)
    const appBlockTasks = tmBlockTasks.filter(b => b.applicationId === app.id)
    const appLegacyTasks = tmLegacyTasks.filter(l => l.applicationId === app.id)
    const closeRows = buildCloseReviewRows(app, tmChecklistItems, tmReviewElements)

    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setTransferView(null)} style={{ color: '#4338ca', fontWeight: 500, padding: 0 }}>返回</Button></div>
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
            setSqaModalOpen(false); setTransferView(null)
          }}
          okButtonProps={{ danger: sqaAction === 'reject', style: sqaAction === 'approve' ? { background: '#52c41a', borderColor: '#52c41a' } : {} }}
          okText="确认"
        >
          <p>{sqaAction === 'approve' ? '确认通过SQA审核？流水线将进入信息变更阶段。' : '确认拒绝SQA审核？流水线将回退至维护审核阶段。'}</p>
          {sqaComment && <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, marginTop: 8 }}><div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>SQA意见：</div><div>{sqaComment}</div></div>}
        </Modal>
      </div>
    )
  }

  const renderProjectSpace = () => {
    const menuItems = [
      { key: 'basic', icon: <SettingOutlined />, label: '基础信息' },
      { key: 'overview', icon: <FileTextOutlined />, label: '概况' },
      { key: 'requirements', icon: <FileTextOutlined />, label: '需求' },
      { key: 'plan', icon: <CalendarOutlined />, label: '计划' },
      { key: 'resources', icon: <TeamOutlined />, label: '资源' },
      { key: 'tasks', icon: <CheckSquareOutlined />, label: '任务' },
      { key: 'risks', icon: <WarningOutlined />, label: '风险' },
      { key: 'bugs', icon: <BugOutlined />, label: '缺陷' },
      { key: 'team', icon: <TeamOutlined />, label: '团队' },
      { key: 'docs', icon: <FolderOutlined />, label: '项目文档' },
      { key: 'permission', icon: <SafetyCertificateOutlined />, label: '权限配置' },
      // 转维菜单已移除，转维信息在基础信息中展示
    ]
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        {/* 顶部导航栏 */}
        <div style={{ background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)', padding: '0 24px', boxShadow: '0 2px 12px rgba(67,56,202,0.35)', position: 'sticky', top: 0, zIndex: 100 }}>
          <Row align="middle" style={{ height: 56 }}>
            <Col flex="none">
              <Button type="text" icon={<LeftOutlined style={{ color: '#fff' }} />} onClick={() => { setTransferView(null); navigateWithEditGuard(() => setActiveModule('projects')); }} style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>返回工作台</Button>
            </Col>
            <Col flex="auto" style={{ textAlign: 'center' }}>
              <div ref={projectSearchRef} style={{ display: 'inline-block', position: 'relative' }}>
                <div
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 6, transition: 'background 0.2s', background: showProjectSearch ? 'rgba(255,255,255,0.15)' : 'transparent' }}
                  onClick={() => setShowProjectSearch(!showProjectSearch)}
                >
                  <ProjectOutlined style={{ color: '#fff', fontSize: 16 }} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{selectedProject?.name}</span>
                  <DownOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', transition: 'transform 0.2s', transform: showProjectSearch ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  <Tag style={{ marginLeft: 4, fontSize: 11, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}>项目空间</Tag>
                </div>
                {showProjectSearch && (
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginTop: 4, width: 360, background: '#fff', borderRadius: 8,
                    boxShadow: '0 6px 16px rgba(0,0,0,0.12)', border: '1px solid #e8e8e8',
                    zIndex: 1000, overflow: 'hidden',
                  }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                      <Input
                        placeholder="搜索项目名称..."
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        value={projectSearchText}
                        onChange={(e) => setProjectSearchText(e.target.value)}
                        allowClear
                        autoFocus
                        style={{ borderRadius: 6 }}
                      />
                    </div>
                    <div style={{ maxHeight: 300, overflowY: 'auto', padding: '4px 0' }}>
                      {filteredProjects.length === 0 ? (
                        <div style={{ padding: '16px 0', textAlign: 'center', color: '#8c8c8c', fontSize: 13 }}>无匹配项目</div>
                      ) : (
                        filteredProjects.map(p => (
                          <div
                            key={p.id}
                            style={{
                              padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              background: selectedProject?.id === p.id ? '#e6f4ff' : 'transparent',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { if (selectedProject?.id !== p.id) (e.currentTarget as HTMLElement).style.background = '#fafafa' }}
                            onMouseLeave={(e) => { if (selectedProject?.id !== p.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                            onClick={() => {
                              navigateWithEditGuard(() => {
                                setSelectedProject(p)
                                setProjectSpaceModule('basic')
                                setShowProjectSearch(false)
                                setProjectSearchText('')
                                // 初始化市场Tab
                                if (p.markets && p.markets.length > 0) {
                                  setSelectedMarketTab(p.markets[0])
                                }
                              })
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#262626' }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{p.type} | {p.leader}</div>
                            </div>
                            <Tag color={p.status === '进行中' ? 'blue' : p.status === '已完成' ? 'green' : 'orange'} style={{ fontSize: 11 }}>{p.status}</Tag>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Col>
            <Col flex="none" />
          </Row>
        </div>
        <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
          {/* 侧边导航 - 固定不滚动 */}
          <div className="pms-sidebar" style={{ width: 200, background: '#fff', borderRight: '1px solid #f0f0f0', paddingTop: 8, overflowY: 'auto', flexShrink: 0 }}>
            <Menu
              mode="inline"
              selectedKeys={[projectSpaceModule]}
              style={{ border: 'none', fontSize: 13 }}
              items={menuItems.map(item => ({
                ...item,
                label: <span style={{ fontWeight: projectSpaceModule === item.key ? 500 : 400 }}>{item.label}</span>,
              }))}
              onClick={({ key }) => navigateWithEditGuard(() => { setProjectSpaceModule(key); setTransferView(null); })}
            />
          </div>
          {/* 内容区域 - 独立滚动 */}
          <div id="basic-info-scroll-container" style={{ flex: 1, padding: 24, overflow: 'auto' }}>
            {transferView === 'apply' && renderTransferApply()}
            {transferView === 'detail' && renderTransferDetail()}
            {transferView === 'entry' && renderTransferEntry()}
            {transferView === 'review' && renderTransferReview()}
            {transferView === 'sqa-review' && renderTransferSqaReview()}
            {transferView === null && projectSpaceModule === 'basic' && renderProjectBasicInfo()}
            {transferView === null && projectSpaceModule === 'plan' && renderProjectPlan()}
            {transferView === null && projectSpaceModule === 'overview' && renderProjectOverview()}
            {transferView === null && projectSpaceModule === 'requirements' && renderProjectRequirements()}
            {transferView === null && projectSpaceModule === 'permission' && renderPermissionConfig()}
            {transferView === null && projectSpaceModule !== 'basic' && projectSpaceModule !== 'plan' && projectSpaceModule !== 'overview' && projectSpaceModule !== 'requirements' && projectSpaceModule !== 'permission' && (
              <Card style={{ borderRadius: 8, textAlign: 'center', padding: '40px 0' }}>
                <Empty description={<span style={{ color: '#8c8c8c' }}>{`${menuItems.find(m => m.key === projectSpaceModule)?.label}模块开发中...`}</span>} />
              </Card>
            )}
          </div>
        </div>
        {/* 版本对比Modal */}
        <Modal
          className="pms-modal"
          title={<Space><HistoryOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 600 }}>历史版本对比</span></Space>}
          open={showVersionCompare}
          onCancel={() => { setShowVersionCompare(false); setCompareResult([]); setCompareFilterType('all'); setCompareShowUnchanged(false) }}
          footer={null}
          width={1200}
          styles={{ body: { padding: '20px 24px' } }}
        >
          {/* 版本选择区域 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)',
            borderRadius: 10, marginBottom: 16, border: '1px solid #e8e8e8',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#262626', whiteSpace: 'nowrap' }}>基准版本</span>
              <Select
                value={compareVersionA}
                onChange={setCompareVersionA}
                style={{ width: 180 }}
                size="middle"
              >
                {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
              </Select>
            </div>
            <div style={{ fontSize: 18, color: '#bfbfbf' }}>→</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#262626', whiteSpace: 'nowrap' }}>对比版本</span>
              <Select
                value={compareVersionB}
                onChange={setCompareVersionB}
                style={{ width: 180 }}
                size="middle"
              >
                {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
              </Select>
            </div>
            <Button type="primary" icon={<SearchOutlined />} style={{ borderRadius: 6 }} onClick={() => {
              const versionA = versions.find(v => v.id === compareVersionA)
              const versionB = versions.find(v => v.id === compareVersionB)
              if (versionA && versionB) {
                const vANum = parseInt(versionA.versionNo.replace('V', ''))
                const vBNum = parseInt(versionB.versionNo.replace('V', ''))
                const oldTasks = versionA.status === '已发布' ? LEVEL1_TASKS : tasks
                let newTasks = versionB.status === '已发布' ? LEVEL1_TASKS : tasks
                if (vANum !== vBNum) {
                  newTasks = [
                    ...tasks.map(t => {
                      if (t.id === '2.1') return { ...t, taskName: 'STR2(更新)', status: '已完成', progress: 100 }
                      if (t.id === '3') return { ...t, responsible: '李四', planStartDate: '2026-02-20' }
                      return t
                    }),
                    { id: '5', order: 5, taskName: '维护', status: '未开始', progress: 0, responsible: '', predecessor: '4', planStartDate: '2026-04-16', planEndDate: '2026-05-15', estimatedDays: 30, actualStartDate: '', actualEndDate: '', actualDays: 0 }
                  ]
                }
                const result = compareVersionsForTable(oldTasks as any, newTasks as any)
                setCompareResult(result as CompareTableRow[])
                setCompareFilterType('all')
                message.success('对比完成')
              }
            }}>开始对比</Button>
          </div>
          {renderVersionCompareResult()}
        </Modal>
        {/* 自定义列Modal */}
        <Modal className="pms-modal" title="自定义列" open={showColumnModal} onCancel={() => setShowColumnModal(false)} footer={[<Button key="reset" onClick={() => setVisibleColumns(ALL_COLUMNS.filter(c => c.default).map(c => c.key))}>重置</Button>, <Button key="cancel" onClick={() => setShowColumnModal(false)}>取消</Button>, <Button key="ok" type="primary" onClick={() => { setShowColumnModal(false); message.success('列配置已保存') }}>确定</Button>]}><Checkbox.Group value={visibleColumns} onChange={(vals) => setVisibleColumns(vals as string[])}><Row><Col span={12}>{ALL_COLUMNS.slice(0, 6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col><Col span={12}>{ALL_COLUMNS.slice(6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col></Row></Checkbox.Group></Modal>
        {/* 创建二级计划Modal */}
        <Modal className="pms-modal"
            title="创建二级计划"
            open={showCreateLevel2Plan}
            onCancel={() => setShowCreateLevel2Plan(false)}
            width={600}
            footer={[
              <Button key="cancel" onClick={() => setShowCreateLevel2Plan(false)}>取消</Button>,
              <Button key="create" type="primary" onClick={() => {
                setLevel2PlanMilestones(selectedMilestones)
                const planName = selectedLevel2PlanType === '1+N MR版本火车计划'
                  ? `${selectedMRVersion}版本火车计划`
                  : selectedLevel2PlanType === '无'
                    ? (createFormValues.customPlanName || '自定义计划')
                    : selectedLevel2PlanType
                const newPlan = { id: `plan_${Date.now()}`, name: planName, type: selectedLevel2PlanType }
                // 保存创建时的元数据
                const meta: Record<string, string> = {
                  planType: selectedLevel2PlanType,
                  planName,
                }
                if (selectedLevel2PlanType === '1+N MR版本火车计划') {
                  meta.mrVersion = selectedMRVersion
                  meta.transferType = createFormValues.transferType || ''
                  meta.tosVersion = createFormValues.tosVersion || ''
                  if (selectedProject?.type === '整机产品项目') {
                    Object.assign(meta, {
                      productLine: selectedProject?.productLine || '',
                      marketName: selectedMarketTab,
                      projectName: selectedProject?.name || '',
                      chipVendor: selectedProject?.chipPlatform || '',
                      branch: createFormValues.branch || '',
                      isMada: createFormValues.isMada || '',
                      madaMarket: createFormValues.madaMarket || '',
                      spm: createFormValues.spm || '',
                      tpm: createFormValues.tpm || '',
                      contact: createFormValues.contact || '',
                      projectVersion: createFormValues.projectVersion || '',
                    })
                  }
                }
                setLevel2PlanMeta(prev => ({ ...prev, [newPlan.id]: meta }))
                setCreatedLevel2Plans([...createdLevel2Plans, newPlan])
                setActiveLevel2Plan(newPlan.id)
                message.success(`已创建${planName}`)
                setShowCreateLevel2Plan(false)
                if (!versions.find(v => v.status === '修订中')) {
                  setVersions([...versions, { id: 'v1', versionNo: 'V1', status: '修订中' }])
                  setCurrentVersion('v1')
                }
              }}>创建</Button>
            ]}
          >
            <Form layout="vertical">
              <Form.Item label="绑定里程碑（多选）">
                <Checkbox.Group value={selectedMilestones} onChange={(vals) => setSelectedMilestones(vals as string[])}>
                  <Row>
                    {LEVEL1_TASKS.filter(t => t.parentId).map(t => (
                      <Col span={8} key={t.id}><Checkbox value={t.id}>{t.id} {t.taskName}</Checkbox></Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Form.Item>
              <Form.Item label="计划模板类型">
                <Select value={selectedLevel2PlanType} style={{ width: '100%' }} onChange={(val) => setSelectedLevel2PlanType(val)}>
                  <Option value="无">无</Option>
                  {LEVEL2_PLAN_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
                  {customTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
              </Form.Item>
              {selectedLevel2PlanType === '1+N MR版本火车计划' && (
                <>
                  <Form.Item label="MR版本类型">
                    <Select value={selectedMRVersion} onChange={(val) => setSelectedMRVersion(val)} style={{ width: '100%' }}>
                      <Option value="FR">FR</Option>
                      {[...Array(99)].map((_, i) => (<Option key={`MR${i + 1}`} value={`MR${i + 1}`}>MR{i + 1}</Option>))}
                    </Select>
                  </Form.Item>
                  <Form.Item label="tOS-市场版本号"><Input placeholder="请输入tOS-市场版本号" value={createFormValues.tosVersion || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, tosVersion: e.target.value}))} /></Form.Item>
                  {selectedProject?.type === '整机产品项目' && (
                    <>
                      <Form.Item label="产品线"><Input placeholder="自动获取" disabled value={selectedProject?.productLine || ''} /></Form.Item>
                      <Form.Item label="市场名"><Input placeholder="自动获取" disabled value={selectedMarketTab} /></Form.Item>
                      <Form.Item label="项目名称"><Input placeholder="自动获取" disabled value={selectedProject?.name || ''} /></Form.Item>
                      <Form.Item label="芯片厂商"><Input placeholder="自动获取" disabled value={selectedProject?.chipPlatform || ''} /></Form.Item>
                      <Form.Item label="分支信息"><Input placeholder="请输入分支信息" value={createFormValues.branch || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, branch: e.target.value}))} /></Form.Item>
                      <Form.Item label="是否MADA"><Select placeholder="请选择" style={{ width: '100%' }} value={createFormValues.isMada} onChange={(val) => setCreateFormValues(prev => ({...prev, isMada: val}))}><Option value="是">是</Option><Option value="否">否</Option></Select></Form.Item>
                      <Form.Item label="MADA市场"><Input placeholder="请输入MADA市场" value={createFormValues.madaMarket || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, madaMarket: e.target.value}))} /></Form.Item>
                      <Form.Item label="项目SPM"><Select placeholder="请选择SPM" style={{ width: '100%' }} value={createFormValues.spm} onChange={(val) => setCreateFormValues(prev => ({...prev, spm: val}))}><Option value="李白">李白</Option><Option value="张三">张三</Option></Select></Form.Item>
                      <Form.Item label="项目TPM"><Select placeholder="请选择TPM" style={{ width: '100%' }} value={createFormValues.tpm} onChange={(val) => setCreateFormValues(prev => ({...prev, tpm: val}))}><Option value="王五">王五</Option><Option value="赵六">赵六</Option></Select></Form.Item>
                      <Form.Item label="对接人"><Select placeholder="请选择对接人" style={{ width: '100%' }} value={createFormValues.contact} onChange={(val) => setCreateFormValues(prev => ({...prev, contact: val}))}><Option value="孙七">孙七</Option><Option value="周八">周八</Option></Select></Form.Item>
                      <Form.Item label="项目版本号"><Input placeholder="请输入项目版本号" value={createFormValues.projectVersion || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, projectVersion: e.target.value}))} /></Form.Item>
                    </>
                  )}
                  <Form.Item label="1+N转测类型"><Select placeholder="请选择转测类型" style={{ width: '100%' }} value={createFormValues.transferType} onChange={(val) => setCreateFormValues(prev => ({...prev, transferType: val}))}>{[...Array(99)].map((_, i) => (<Option key={i + 1} value={String(i + 1)}>{i + 1}</Option>))}</Select></Form.Item>
                </>
              )}
              <Form.Item label="二级计划名称">
                <Input value={selectedLevel2PlanType === '1+N MR版本火车计划' ? `${selectedMRVersion}版本火车计划` : selectedLevel2PlanType === '无' ? (createFormValues.customPlanName || '') : selectedLevel2PlanType} disabled={selectedLevel2PlanType !== '无'} onChange={selectedLevel2PlanType === '无' ? (e) => setCreateFormValues(prev => ({...prev, customPlanName: e.target.value})) : undefined} />
              </Form.Item>
            </Form>
          </Modal>
      </div>
    )
  }

  return (
    <ConfigProvider autoInsertSpaceInButton={false}>
    <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      {activeModule === 'projectSpace' && selectedProject ? renderProjectSpace() : (
        <>
          <div style={{ background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)', padding: '0 32px', boxShadow: '0 2px 12px rgba(67,56,202,0.35)', position: 'sticky', top: 0, zIndex: 100 }}>
            <Row align="middle" justify="space-between" style={{ height: 56 }}>
              <Col>
                <Space size={32} align="center">
                  <Space size={8}>
                    <ProjectOutlined style={{ color: '#fff', fontSize: 18 }} />
                    <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>项目管理系统</span>
                  </Space>
                  <Menu
                    theme="dark"
                    mode="horizontal"
                    selectedKeys={[activeModule]}
                    onClick={({ key }) => navigateWithEditGuard(() => { setActiveModule(key); if (key === 'config') setConfigTab('plan') })}
                    style={{ background: 'transparent', borderBottom: 'none', fontSize: 14 }}
                    items={[
                      { key: 'projects', label: '工作台' },
                      { key: 'roadmap', label: '项目路标视图' },
                      { key: 'config', label: '配置中心' },
                      { key: 'globalPermission', label: '权限配置' },
                    ]}
                  />
                </Space>
              </Col>
              <Col>
                <Dropdown
                  menu={{
                    items: [
                      { key: 'label', label: <div style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <span style={{ color: '#999', fontSize: 11 }}>当前登录用户</span>
                        <div style={{ fontWeight: 600, marginTop: 2 }}>{currentLoginUser}
                          {(() => {
                            const adminGroup = globalRoles.find(r => r.name === '管理组')
                            const isAdmin = adminGroup?.members.includes(currentLoginUser)
                            const projectCount = isAdmin ? projects.length : projects.filter(p => (PROJECT_MEMBER_MAP[p.id] || []).includes(currentLoginUser)).length
                            return <>
                              {isAdmin && <Tag color="red" style={{ fontSize: 10, marginLeft: 6 }}>管理组</Tag>}
                              <span style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 6 }}>可见 {projectCount} 个项目</span>
                            </>
                          })()}
                        </div>
                      </div>, disabled: true },
                      { type: 'divider' as const },
                      { key: 'switch-label', label: <span style={{ color: '#999', fontSize: 11 }}><SwapOutlined style={{ marginRight: 4 }} />切换用户（测试权限）</span>, disabled: true },
                      ...ALL_USERS.map(u => {
                        const isActive = currentLoginUser === u
                        const adminGroup = globalRoles.find(r => r.name === '管理组')
                        const isAdmin = adminGroup?.members.includes(u)
                        const projectCount = isAdmin ? projects.length : projects.filter(p => (PROJECT_MEMBER_MAP[p.id] || []).includes(u)).length
                        // 获取该用户在项目空间中的角色
                        const userRoles = roles.filter(r => r.members.includes(u)).map(r => r.name)
                        return {
                          key: u,
                          label: <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: isActive ? 600 : 400 }}>
                            <Avatar size="small" style={{ background: isActive ? '#4338ca' : '#e0e0e0', fontSize: 12 }}>{u.slice(-1)}</Avatar>
                            <span>{u}</span>
                            {isAdmin && <Tag color="red" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>管理组</Tag>}
                            <span style={{ color: '#8c8c8c', fontSize: 11, marginLeft: 'auto' }}>{projectCount}个项目</span>
                            {isActive && <CheckCircleOutlined style={{ color: '#4338ca' }} />}
                          </div>,
                          onClick: () => { setCurrentLoginUser(u); setProjectCardPage(1) },
                        }
                      }),
                    ],
                  }}
                  placement="bottomRight"
                  trigger={['click']}
                  overlayStyle={{ minWidth: 340 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 14px', borderRadius: 24, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                  >
                    <Avatar size={28} style={{ background: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 600 }}>{currentLoginUser.slice(-1)}</Avatar>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{currentLoginUser}</span>
                    {isAdminUser && <Tag color="rgba(255,100,100,0.35)" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.25)', fontSize: 10, margin: 0 }}>管理组</Tag>}
                  </div>
                </Dropdown>
              </Col>
            </Row>
          </div>
          <div style={{ padding: 24 }}>
            {activeModule === 'projects' && (
              <div style={{ display: 'flex', gap: 20 }}>
                {/* 左侧 - 项目列表 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 筛选工具栏 */}
                  <div style={{
                    background: '#fff', borderRadius: 10, padding: '12px 20px', marginBottom: 16,
                    border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  }}>
                    {/* 左侧: 状态标签筛选 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {[
                        { label: '全部', value: visibleProjects.length, filterValue: 'all', color: '#1890ff' },
                        { label: '进行中', value: visibleProjects.filter(p => p.status === '进行中').length, filterValue: '进行中', color: '#1890ff' },
                        { label: '待立项', value: visibleProjects.filter(p => p.status === '筹备中' || p.status === '待立项').length, filterValue: '筹备中', color: '#faad14' },
                        { label: '已完成', value: visibleProjects.filter(p => p.status === '已完成').length, filterValue: '已完成', color: '#52c41a' },
                      ].map((stat) => {
                        const isActive = projectStatusFilter === stat.filterValue
                        return (
                          <div
                            key={stat.filterValue}
                            onClick={() => { setProjectStatusFilter(stat.filterValue); setProjectCardPage(1); }}
                            style={{
                              padding: '4px 14px', borderRadius: 20, cursor: 'pointer',
                              fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                              background: isActive ? stat.color : 'transparent',
                              color: isActive ? '#fff' : '#595959',
                              border: isActive ? `1px solid ${stat.color}` : '1px solid transparent',
                            }}
                            onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = '#f5f5f5' } }}
                            onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent' } }}
                          >
                            {stat.label} <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 2 }}>{stat.value}</span>
                          </div>
                        )
                      })}
                    </div>
                    {/* 右侧: 搜索 + 视图切换 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Input
                        placeholder="搜索项目名称..."
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        style={{ width: 220, borderRadius: 20, background: '#f7f8fa' }}
                        variant="borderless"
                        allowClear
                        value={projectSearchText2}
                        onChange={e => { setProjectSearchText2(e.target.value); setProjectCardPage(1); }}
                      />
                      <div style={{ width: 1, height: 20, background: '#e8e8e8' }} />
                      <Segmented
                        size="small"
                        value={projectListView}
                        onChange={(v) => setProjectListView(v as 'card' | 'list')}
                        options={[
                          { label: <AppstoreOutlined />, value: 'card' },
                          { label: <UnorderedListOutlined />, value: 'list' },
                        ]}
                      />
                    </div>
                  </div>

                  {/* 项目卡片/列表 */}
                  {projectListView === 'card' ? (
                    <>
                      <Row gutter={[16, 16]}>
                        {workspaceFilteredProjects.slice((projectCardPage - 1) * projectCardPageSize, projectCardPage * projectCardPageSize).map(p => (
                          <Col xs={24} sm={12} lg={todoCollapsed ? 6 : 8} key={p.id}>{renderProjectCard(p)}</Col>
                        ))}
                      </Row>
                      {workspaceFilteredProjects.length > projectCardPageSize && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                          <Pagination
                            current={projectCardPage}
                            pageSize={projectCardPageSize}
                            total={workspaceFilteredProjects.length}
                            onChange={(page) => setProjectCardPage(page)}
                            showTotal={(total) => `共 ${total} 个项目`}
                            showSizeChanger={false}
                            size="small"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <Table
                      dataSource={workspaceFilteredProjects}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: projectCardPageSize, size: 'small', showTotal: (total) => `共 ${total} 个项目` }}
                      className="pms-table"
                      onRow={(record) => ({
                        style: { cursor: 'pointer' },
                        onClick: () => { setSelectedProject(record); setActiveModule('projectSpace') },
                      })}
                      columns={[
                        { title: '项目名称', dataIndex: 'name', width: 200, render: (name: string, r: typeof initialProjects[0]) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{r.type === '整机产品项目' && r.marketName ? r.marketName : name}</div>
                            {r.type === '整机产品项目' && r.marketName && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{name}</div>}
                          </div>
                        )},
                        { title: '类型', dataIndex: 'type', width: 120, render: (t: string) => <Tag color="default" style={{ fontSize: 11 }}>{t}</Tag> },
                        { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => {
                          const conf = PROJECT_STATUS_CONFIG[s] || { tagColor: 'default' }
                          return <Tag color={conf.tagColor}>{s}</Tag>
                        }},
                        { title: '进度', dataIndex: 'progress', width: 120, render: (v: number) => <Progress percent={v} size="small" style={{ marginBottom: 0 }} /> },
                        { title: '计划开始', dataIndex: 'planStartDate', width: 110 },
                        { title: '计划结束', dataIndex: 'planEndDate', width: 110 },
                        { title: 'SPM', dataIndex: 'spm', width: 80 },
                        { title: '更新', dataIndex: 'updatedAt', width: 80, render: (t: string) => <span style={{ color: '#8c8c8c', fontSize: 12 }}>{t}</span> },
                      ]}
                    />
                  )}
                </div>

                {/* 右侧 - 待办中心（可展开收起） */}
                <div style={{
                  width: todoCollapsed ? 40 : 320,
                  flexShrink: 0,
                  transition: 'width 0.25s ease',
                  position: 'relative',
                }}>
                  {todoCollapsed ? (
                    /* 收起状态 - 竖条 */
                    <div
                      style={{
                        width: 40,
                        background: '#fff',
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '12px 0',
                        cursor: 'pointer',
                        position: 'sticky',
                        top: 24,
                      }}
                      onClick={() => setTodoCollapsed(false)}
                    >
                      <MenuUnfoldOutlined style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }} />
                      <Badge count={todos.filter(t => t.category === 'overdue').length} size="small" style={{ marginBottom: 8, backgroundColor: '#ff4d4f' }} />
                      <div style={{ writingMode: 'vertical-lr', fontSize: 12, color: '#8c8c8c', letterSpacing: 2 }}>待办中心</div>
                    </div>
                  ) : (
                    /* 展开状态 */
                    <div style={{
                      background: '#fff',
                      borderRadius: 8,
                      border: '1px solid #f0f0f0',
                      overflow: 'hidden',
                      position: 'sticky',
                      top: 24,
                    }}>
                      {/* 待办头部 */}
                      <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#fafbfc',
                      }}>
                        <Space size={6}>
                          <CheckSquareOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#262626' }}>待办中心</span>
                          <Badge count={todos.filter(t => t.category === 'overdue').length} style={{ backgroundColor: '#ff4d4f' }} size="small" />
                        </Space>
                        <Button type="text" size="small" icon={<MenuFoldOutlined />} style={{ color: '#8c8c8c' }} onClick={() => setTodoCollapsed(true)} />
                      </div>
                      {/* 待办列表 */}
                      <div style={{ padding: 12, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                        {renderTodoList()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeModule === 'roadmap' && (
              <RoadmapView
                projects={projects}
                marketPlanData={marketPlanData}
                level1Tasks={LEVEL1_TASKS}
                onViewProject={(projectId, market) => {
                  const project = projects.find(p => p.id === projectId)
                  if (!project) return
                  setSelectedProject(project)
                  setActiveModule('projectSpace')
                  setProjectSpaceModule('plan')
                  setProjectPlanLevel('level1')
                  if (market && project.type === '整机产品项目') {
                    setSelectedMarketTab(market)
                  }
                }}
              />
            )}
            {activeModule === 'globalPermission' && renderGlobalPermissionConfig()}
            {(activeModule === 'config' || activeModule === 'projectSpace') && (
              <div>
                {/* 配置分类导航 */}
                <Card size="small" style={{ marginBottom: 20, borderRadius: 8 }} styles={{ body: { padding: '4px 16px' } }}>
                  <Tabs
                    activeKey={configTab}
                    onChange={(key) => { setConfigTab(key); if (key === 'transfer') setTransferConfigView('home'); }}
                    style={{ marginBottom: 0 }}
                    items={[
                      { key: 'plan', label: <Space size={6}><CalendarOutlined />计划模板配置</Space> },
                      { key: 'transfer', label: <Space size={6}><SwapOutlined />转维材料模板配置</Space> },
                    ]}
                  />
                </Card>

                {/* 转维材料模板配置 */}
                {configTab === 'transfer' && renderTransferMaterialConfig()}

                {/* 计划模板配置 */}
                {configTab === 'plan' && (
                <Row gutter={20}>
                    <Col span={sidebarCollapsed ? 1 : 4}>
                      <Card
                        size="small"
                        style={{ borderRadius: 8, position: 'sticky', top: 24 }}
                        styles={{
                          header: { background: '#fafbfc', borderBottom: '1px solid #f0f0f0', padding: '8px 12px', minHeight: 40 },
                          body: { padding: sidebarCollapsed ? '8px 4px' : '8px' },
                        }}
                        title={!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 600, color: '#595959' }}>项目类型</span>}
                        extra={<Button type="text" size="small" icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setSidebarCollapsed(!sidebarCollapsed)} />}
                      >
                        {!sidebarCollapsed && <Menu mode="inline" selectedKeys={[selectedProjectType]} style={{ border: 'none', fontSize: 13 }} items={PROJECT_TYPES.map(t => ({ key: t, label: <span style={{ fontWeight: selectedProjectType === t ? 500 : 400 }}>{t}</span>, onClick: () => navigateWithEditGuard(() => setSelectedProjectType(t)) }))} />}
                      </Card>
                    </Col>
                    <Col span={sidebarCollapsed ? 23 : 20}>
                      {/* 配置头部 */}
                      <Card size="small" style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
                        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)', borderBottom: '1px solid #e8e8e8' }}>
                          <Row justify="space-between" align="middle">
                            <Col>
                              <Space size={8} align="center">
                                <CalendarOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                                <span style={{ fontSize: 16, fontWeight: 600, color: '#262626' }}>{selectedProjectType}</span>
                                <Divider type="vertical" style={{ height: 16, margin: '0 4px' }} />
                                <span style={{ fontSize: 14, color: '#595959' }}>计划模板配置</span>
                              </Space>
                              <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c', paddingLeft: 24 }}>配置和管理项目计划模板</div>
                            </Col>
                          </Row>
                        </div>
                        <div style={{ padding: '4px 16px' }}>
                          <Tabs activeKey={planLevel} onChange={(key) => navigateWithEditGuard(() => setPlanLevel(key))} style={{ marginBottom: 0 }} items={[{ key: 'level1', label: <span style={{ fontWeight: 500 }}>一级计划</span> }, { key: 'level2', label: <span style={{ fontWeight: 500 }}>二级计划</span> }]} />
                        </div>
                      </Card>

                      {/* 二级计划类型选择器 */}
                      {planLevel === 'level2' && (
                        <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '10px 16px' } }}>
                          <Space wrap size={[8, 8]}>
                            <span style={{ color: '#8c8c8c', fontSize: 13, fontWeight: 500 }}>模板类型</span>
                            <Divider type="vertical" style={{ height: 16, margin: '0 4px' }} />
                            {allPlanTypes.map(t => {
                              const isCustom = customTypes.includes(t)
                              return (
                                <Tag
                                  key={t}
                                  color={selectedPlanType === t ? 'blue' : 'default'}
                                  style={{ cursor: 'pointer', borderRadius: 4, padding: '2px 10px', fontWeight: selectedPlanType === t ? 500 : 400 }}
                                  onClick={() => navigateWithEditGuard(() => setSelectedPlanType(t))}
                                  closable={isCustom}
                                  onClose={(e) => {
                                    e.preventDefault()
                                    Modal.confirm({
                                      title: '删除计划类型',
                                      content: `确认删除自定义类型"${t}"？`,
                                      okText: '删除',
                                      okType: 'danger',
                                      cancelText: '取消',
                                      onOk: () => {
                                        setCustomTypes(prev => prev.filter(c => c !== t))
                                        if (selectedPlanType === t) setSelectedPlanType(LEVEL2_PLAN_TYPES[0])
                                        message.success('已删除')
                                      },
                                    })
                                  }}
                                >
                                  {t}
                                </Tag>
                              )
                            })}
                            <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ borderRadius: 4 }} onClick={() => setShowAddCustomType(true)}>添加类型</Button>
                          </Space>
                        </Card>
                      )}

                      {/* 版本控制 + 工具栏 */}
                      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '10px 16px' } }}>
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                              <Space size={6}>
                                <span style={{ color: '#8c8c8c', fontSize: 13 }}>版本</span>
                                <Select value={currentVersion} onChange={(val) => navigateWithEditGuard(() => { setCurrentVersion(val); setIsEditMode(false) })} style={{ width: 180 }} size="middle">
                                  {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
                                </Select>
                              </Space>
                              {renderActionButtons()}
                            </Space>
                          </Col>
                          <Col>
                            <Space size={6}>
                              <Input placeholder="搜索任务..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear onChange={(e) => setSearchText(e.target.value)} />
                              <Tooltip title="自定义列">
                                <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
                              </Tooltip>
                            </Space>
                          </Col>
                        </Row>
                      </Card>

                      {/* 表格/甘特图内容 */}
                      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
                        {viewMode === 'gantt' ? renderGanttChart() : renderTaskTable()}
                      </Card>
                    </Col>
                  </Row>
                )}
              </div>
            )}
          </div>
          <Modal className="pms-modal" title="自定义列" open={showColumnModal} onCancel={() => setShowColumnModal(false)} footer={[<Button key="reset" onClick={() => setVisibleColumns(ALL_COLUMNS.filter(c => c.default).map(c => c.key))}>重置</Button>, <Button key="cancel" onClick={() => setShowColumnModal(false)}>取消</Button>, <Button key="ok" type="primary" onClick={() => { setShowColumnModal(false); message.success('列配置已保存') }}>确定</Button>]}><Checkbox.Group value={visibleColumns} onChange={(vals) => setVisibleColumns(vals as string[])}><Row><Col span={12}>{ALL_COLUMNS.slice(0, 6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col><Col span={12}>{ALL_COLUMNS.slice(6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col></Row></Checkbox.Group></Modal>
          <Modal
            className="pms-modal"
            title={<Space><HistoryOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 600 }}>历史版本对比</span></Space>}
            open={showVersionCompare}
            onCancel={() => { setShowVersionCompare(false); setCompareResult([]); setCompareFilterType('all'); setCompareShowUnchanged(false) }}
            footer={null}
            width={1200}
            styles={{ body: { padding: '20px 24px' } }}
          >
            {/* 版本选择区域 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)',
              borderRadius: 10, marginBottom: 16, border: '1px solid #e8e8e8',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#262626', whiteSpace: 'nowrap' }}>基准版本</span>
                <Select value={compareVersionA} onChange={setCompareVersionA} style={{ width: 180 }} size="middle">
                  {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
                </Select>
              </div>
              <div style={{ fontSize: 18, color: '#bfbfbf' }}>→</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#262626', whiteSpace: 'nowrap' }}>对比版本</span>
                <Select value={compareVersionB} onChange={setCompareVersionB} style={{ width: 180 }} size="middle">
                  {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
                </Select>
              </div>
              <Button type="primary" icon={<SearchOutlined />} style={{ borderRadius: 6 }} onClick={() => {
                const versionA = versions.find(v => v.id === compareVersionA)
                const versionB = versions.find(v => v.id === compareVersionB)
                if (versionA && versionB) {
                  const vANum = parseInt(versionA.versionNo.replace('V', ''))
                  const vBNum = parseInt(versionB.versionNo.replace('V', ''))
                  const oldTasks = versionA.status === '已发布' ? LEVEL1_TASKS : tasks
                  let newTasks = versionB.status === '已发布' ? LEVEL1_TASKS : tasks
                  if (vANum !== vBNum) {
                    newTasks = [
                      ...tasks.map(t => {
                        if (t.id === '2.1') return { ...t, taskName: 'STR2(更新)', status: '已完成', progress: 100 }
                        if (t.id === '3') return { ...t, responsible: '李四', planStartDate: '2026-02-20' }
                        return t
                      }),
                      { id: '5', order: 5, taskName: '维护', status: '未开始', progress: 0, responsible: '', predecessor: '4', planStartDate: '2026-04-16', planEndDate: '2026-05-15', estimatedDays: 30, actualStartDate: '', actualEndDate: '', actualDays: 0 }
                    ]
                  }
                  const result = compareVersionsForTable(oldTasks as any, newTasks as any)
                  setCompareResult(result as CompareTableRow[])
                  setCompareFilterType('all')
                  message.success('对比完成')
                }
              }}>开始对比</Button>
            </div>
            {renderVersionCompareResult()}
          </Modal>
          <Modal className="pms-modal" 
            title="子任务时间超出父任务范围" 
            open={parentTimeWarning.visible} 
            onCancel={() => setParentTimeWarning({visible: false, tasks: [], message: ''})}
            footer={[
              <Button key="close" type="primary" onClick={() => setParentTimeWarning({visible: false, tasks: [], message: ''})}>
                知道了，去修改
              </Button>
            ]}
            width={600}
          >
            <Alert 
              type="warning" 
              message="以下子任务的计划时间超出了父任务的时间范围" 
              description={parentTimeWarning.message}
              style={{ marginBottom: 16 }}
            />
            <Table 
              dataSource={parentTimeWarning.tasks} 
              columns={[
                { title: '子任务ID', dataIndex: 'id', key: 'id', width: 80 },
                { title: '子任务名称', dataIndex: 'taskName', key: 'taskName' },
                { title: '子任务时间', dataIndex: 'childTime', key: 'childTime' },
                { title: '父任务名称', dataIndex: 'parentName', key: 'parentName' },
                { title: '父任务时间', dataIndex: 'parentTime', key: 'parentTime' }
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </Modal>
          <Modal className="pms-modal" 
            title="⚠️ 二级计划时间超出里程碑范围" 
            open={milestoneTimeWarning.visible} 
            onCancel={() => setMilestoneTimeWarning({visible: false, violations: [], message: ''})}
            footer={[
              <Button key="close" type="primary" onClick={() => setMilestoneTimeWarning({visible: false, violations: [], message: ''})}>
                知道了，去修改
              </Button>
            ]}
            width={700}
          >
            <Alert 
              type="warning" 
              message="二级计划时间必须在绑定里程碑的时间范围内" 
              description={milestoneTimeWarning.message}
              style={{ marginBottom: 16 }}
            />
            <Table 
              dataSource={milestoneTimeWarning.violations} 
              columns={[
                { title: '任务ID', dataIndex: 'id', key: 'id', width: 80 },
                { title: '任务名称', dataIndex: 'taskName', key: 'taskName' },
                { title: '任务时间', dataIndex: 'taskTime', key: 'taskTime' },
                { title: '里程碑范围', dataIndex: 'milestoneRange', key: 'milestoneRange' },
                { title: '绑定里程碑', dataIndex: 'milestones', key: 'milestones', width: 100 }
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </Modal>
          <Modal className="pms-modal" title={`编辑时间 - ${ganttEditingTask?.taskName}`} open={!!ganttEditingTask} onCancel={() => setGanttEditingTask(null)} onOk={() => setGanttEditingTask(null)}><Space direction="vertical" style={{ width: '100%' }}><div><span>开始时间:</span><DatePicker value={ganttEditingTask?.planStartDate ? { format: 'YYYY-MM-DD', value: ganttEditingTask.planStartDate } : undefined} onChange={(date, dateStr) => dateStr && handleGanttTimeChange(ganttEditingTask.id, 'planStartDate', dateStr)} style={{ marginLeft: 8 }} /></div><div><span>结束时间:</span><DatePicker value={ganttEditingTask?.planEndDate ? { format: 'YYYY-MM-DD', value: ganttEditingTask.planEndDate } : undefined} onChange={(date, dateStr) => dateStr && handleGanttTimeChange(ganttEditingTask.id, 'planEndDate', dateStr)} style={{ marginLeft: 8 }} /></div></Space></Modal>
          <Modal className="pms-modal" title={`编辑进度 - ${progressEditingTask?.taskName}`} open={!!progressEditingTask} onCancel={() => setProgressEditingTask(null)} onOk={() => setProgressEditingTask(null)} footer={null}>
            <div style={{ padding: '20px 0' }}>
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <Progress percent={progressEditingTask?.progress || 0} status="active" strokeColor={{ '0%': '#108ee9', '100%': '#52c41a' }} />
              </div>
              <Slider 
                value={progressEditingTask?.progress || 0} 
                onChange={(val) => {
                  setProgressEditingTask({ ...progressEditingTask, progress: val })
                }}
                marks={{ 0: '0%', 50: '50%', 100: '100%' }}
              />
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Space>
                  <Button onClick={() => setProgressEditingTask(null)}>取消</Button>
                  <Button type="primary" onClick={() => handleProgressChange(progressEditingTask.id, progressEditingTask.progress)}>保存</Button>
                </Space>
              </div>
            </div>
          </Modal>
          <Modal className="pms-modal" 
            title="⚠️ 前置任务冲突警告" 
            open={predecessorWarning.visible} 
            onCancel={() => setPredecessorWarning({visible: false, task: null, message: ''})}
            footer={[
              <Button key="cancel" onClick={() => setPredecessorWarning({visible: false, task: null, message: ''})}>
                取消
              </Button>,
              <Button key="confirm" type="primary" onClick={confirmPredecessorChange}>
                确认修改
              </Button>
            ]}
          >
            <Alert 
              type="warning" 
              showIcon 
              message="前置任务检查" 
              description={predecessorWarning.message} 
            />
            <div style={{ marginTop: 16 }}>
              <p>是否仍要修改？</p>
            </div>
          </Modal>
          <Modal className="pms-modal"
            title="添加自定义二级计划类型"
            open={showAddCustomType}
            onCancel={() => { setShowAddCustomType(false); setNewCustomTypeName('') }}
            footer={[
              <Button key="cancel" onClick={() => { setShowAddCustomType(false); setNewCustomTypeName('') }}>
                取消
              </Button>,
              <Button 
                key="add" 
                type="primary"
                disabled={!newCustomTypeName.trim() || allPlanTypes.includes(newCustomTypeName.trim())}
                onClick={() => {
                  if (!newCustomTypeName.trim()) {
                    message.error('请输入类型名称')
                    return
                  }
                  if (allPlanTypes.includes(newCustomTypeName.trim())) {
                    message.error('该类型名称已存在')
                    return
                  }
                  // Add to custom types
                  const newTypes = [...customTypes, newCustomTypeName.trim()]
                  setCustomTypes(newTypes)
                  setSelectedPlanType(newCustomTypeName.trim())
                  setShowAddCustomType(false)
                  setNewCustomTypeName('')
                  message.success(`已添加类型: ${newCustomTypeName.trim()}`)
                }}
              >
                确认添加
              </Button>
            ]}
          >
            <Form layout="vertical">
              <Form.Item 
                label="类型名称" 
                required
                help={allPlanTypes.includes(newCustomTypeName.trim()) ? '该类型名称已存在' : undefined}
                validateStatus={newCustomTypeName.trim() && allPlanTypes.includes(newCustomTypeName.trim()) ? 'error' : undefined}
              >
                <Input 
                  placeholder="请输入自定义类型名称" 
                  value={newCustomTypeName}
                  onChange={(e) => setNewCustomTypeName(e.target.value)}
                  maxLength={20}
                />
              </Form.Item>
              <div style={{ color: '#888', fontSize: 12 }}>
                <p>固定类型: {LEVEL2_PLAN_TYPES.join('、')}</p>
              </div>
            </Form>
          </Modal>
          <Modal className="pms-modal"
            title="创建二级计划"
            open={showCreateLevel2Plan}
            onCancel={() => setShowCreateLevel2Plan(false)}
            width={600}
            footer={[
              <Button key="cancel" onClick={() => setShowCreateLevel2Plan(false)}>取消</Button>,
              <Button key="create" type="primary" onClick={() => {
                // 保存选中的里程碑到状态
                setLevel2PlanMilestones(selectedMilestones)

                // 生成二级计划名称
                const planName = selectedLevel2PlanType === '1+N MR版本火车计划'
                  ? `${selectedMRVersion}版本火车计划`
                  : selectedLevel2PlanType === '无'
                    ? (createFormValues.customPlanName || '自定义计划')
                    : selectedLevel2PlanType

                // 添加到已创建的二级计划列表
                const newPlan = {
                  id: `plan_${Date.now()}`,
                  name: planName,
                  type: selectedLevel2PlanType
                }
                // 保存创建时的元数据
                const meta: Record<string, string> = {
                  planType: selectedLevel2PlanType,
                  planName,
                }
                if (selectedLevel2PlanType === '1+N MR版本火车计划') {
                  meta.mrVersion = selectedMRVersion
                  meta.transferType = createFormValues.transferType || ''
                  meta.tosVersion = createFormValues.tosVersion || ''
                  if (selectedProject?.type === '整机产品项目') {
                    Object.assign(meta, {
                      productLine: selectedProject?.productLine || '',
                      marketName: selectedMarketTab,
                      projectName: selectedProject?.name || '',
                      chipVendor: selectedProject?.chipPlatform || '',
                      branch: createFormValues.branch || '',
                      isMada: createFormValues.isMada || '',
                      madaMarket: createFormValues.madaMarket || '',
                      spm: createFormValues.spm || '',
                      tpm: createFormValues.tpm || '',
                      contact: createFormValues.contact || '',
                      projectVersion: createFormValues.projectVersion || '',
                    })
                  }
                }
                setLevel2PlanMeta(prev => ({ ...prev, [newPlan.id]: meta }))
                setCreatedLevel2Plans([...createdLevel2Plans, newPlan])
                setActiveLevel2Plan(newPlan.id)

                message.success(`已创建${planName}`)
                setShowCreateLevel2Plan(false)

                // 自动创建V1修订版（如果没有）
                if (!versions.find(v => v.status === '修订中')) {
                  const newVersion = {
                    id: 'v1',
                    versionNo: 'V1',
                    status: '修订中'
                  }
                  setVersions([...versions, newVersion])
                  setCurrentVersion('v1')
                }
              }}>创建</Button>
            ]}
          >
            <Form layout="vertical">
              <Form.Item label="绑定里程碑（多选）">
                <Checkbox.Group value={selectedMilestones} onChange={(vals) => setSelectedMilestones(vals as string[])}>
                  <Row>
                    {LEVEL1_TASKS.filter(t => t.parentId).map(t => (
                      <Col span={8} key={t.id}><Checkbox value={t.id}>{t.id} {t.taskName}</Checkbox></Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Form.Item>
              <Form.Item label="计划模板类型">
                <Select 
                  value={selectedLevel2PlanType} 
                  style={{ width: '100%' }} 
                  onChange={(val) => {
                    setSelectedLevel2PlanType(val)
                  }}
                >
                  <Option value="无">无</Option>
                  {LEVEL2_PLAN_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
                  {customTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
              </Form.Item>
              
              {/* 根据不同计划类型显示不同参数 */}
              {selectedLevel2PlanType === '1+N MR版本火车计划' && (
                <>
                  <Form.Item label="MR版本类型">
                    <Select
                      value={selectedMRVersion}
                      onChange={(val) => setSelectedMRVersion(val)}
                      style={{ width: '100%' }}
                    >
                      <Option value="FR">FR</Option>
                      {[...Array(99)].map((_, i) => (
                        <Option key={`MR${i + 1}`} value={`MR${i + 1}`}>MR{i + 1}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item label="tOS-市场版本号">
                    <Input placeholder="请输入tOS-市场版本号" value={createFormValues.tosVersion || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, tosVersion: e.target.value}))} />
                  </Form.Item>
                  {selectedProject?.type === '整机产品项目' && (
                    <>
                      <Form.Item label="产品线">
                        <Input placeholder="自动获取项目基础信息" disabled value={selectedProject?.productLine || ''} />
                      </Form.Item>
                      <Form.Item label="市场名">
                        <Input placeholder="自动获取该计划所属市场" disabled value={selectedMarketTab} />
                      </Form.Item>
                      <Form.Item label="项目名称">
                        <Input placeholder="自动获取项目基础信息" disabled value={selectedProject?.name || ''} />
                      </Form.Item>
                      <Form.Item label="芯片厂商">
                        <Input placeholder="自动获取项目基础信息" disabled value={selectedProject?.chipPlatform || ''} />
                      </Form.Item>
                      <Form.Item label="分支信息">
                        <Input placeholder="请输入分支信息" value={createFormValues.branch || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, branch: e.target.value}))} />
                      </Form.Item>
                      <Form.Item label="是否MADA">
                        <Select placeholder="请选择" style={{ width: '100%' }} value={createFormValues.isMada} onChange={(val) => setCreateFormValues(prev => ({...prev, isMada: val}))}>
                          <Option value="是">是</Option>
                          <Option value="否">否</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item label="MADA市场">
                        <Input placeholder="请输入MADA市场" value={createFormValues.madaMarket || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, madaMarket: e.target.value}))} />
                      </Form.Item>
                      <Form.Item label="项目SPM">
                        <Select placeholder="请选择SPM" style={{ width: '100%' }} value={createFormValues.spm} onChange={(val) => setCreateFormValues(prev => ({...prev, spm: val}))}>
                          <Option value="李白">李白</Option>
                          <Option value="张三">张三</Option>
                          <Option value="李四">李四</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item label="项目TPM">
                        <Select placeholder="请选择TPM" style={{ width: '100%' }} value={createFormValues.tpm} onChange={(val) => setCreateFormValues(prev => ({...prev, tpm: val}))}>
                          <Option value="王五">王五</Option>
                          <Option value="赵六">赵六</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item label="对接人">
                        <Select placeholder="请选择对接人" style={{ width: '100%' }} value={createFormValues.contact} onChange={(val) => setCreateFormValues(prev => ({...prev, contact: val}))}>
                          <Option value="孙七">孙七</Option>
                          <Option value="周八">周八</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item label="项目版本号">
                        <Input placeholder="请输入项目版本号" value={createFormValues.projectVersion || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, projectVersion: e.target.value}))} />
                      </Form.Item>
                    </>
                  )}
                  <Form.Item label="1+N转测类型">
                    <Select placeholder="请选择转测类型" style={{ width: '100%' }} value={createFormValues.transferType} onChange={(val) => setCreateFormValues(prev => ({...prev, transferType: val}))}>
                      {[...Array(99)].map((_, i) => (
                        <Option key={i + 1} value={String(i + 1)}>{i + 1}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </>
              )}
              
              {/* 粉丝版本计划 - 无额外参数 */}
              
              {selectedLevel2PlanType === '基础体验计划' && (
                <>
                  {/* 基础体验计划 - 无额外参数 */}
                </>
              )}
              
              {selectedLevel2PlanType === 'WBS计划' && (
                <>
                  {/* WBS计划 - 无额外参数 */}
                </>
              )}
              
              <Form.Item label="二级计划名称">
                <Input
                  value={
                    selectedLevel2PlanType === '1+N MR版本火车计划'
                      ? `${selectedMRVersion}版本火车计划`
                      : selectedLevel2PlanType === '无'
                        ? (createFormValues.customPlanName || '')
                        : selectedLevel2PlanType
                  }
                  disabled={selectedLevel2PlanType !== '无'}
                  onChange={selectedLevel2PlanType === '无' ? (e) => setCreateFormValues(prev => ({...prev, customPlanName: e.target.value})) : undefined}
                />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
    {/* 编辑离开确认弹窗 */}
    <Modal
      className="pms-modal"
      title={<Space><ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} /><span>离开确认</span></Space>}
      open={showLeaveConfirm}
      onCancel={handleCancelLeave}
      footer={[
        <Button key="cancel" onClick={handleCancelLeave}>取消</Button>,
        <Button key="confirm" type="primary" danger onClick={handleConfirmLeave}>确认离开</Button>,
      ]}
      width={420}
    >
      <div style={{ padding: '12px 0', fontSize: 14, color: '#595959' }}>
        您还未提交现有编辑内容，是否要离开该界面？
      </div>
    </Modal>
    </ConfigProvider>
  )
}
