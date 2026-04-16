'use client'

import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { Progress, Tag, Avatar, DatePicker, message } from 'antd'
import dayjs from 'dayjs'
import { HolderOutlined, StopOutlined, FileTextOutlined, LinkOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { gantt } from 'dhtmlx-gantt'
import {
  getCurrentNodeIndex,
  getCurrentNodeLabel,
  getCurrentNodeStatus,
  getPipelinePercent,
  ROLE_COLORS,
  type TransferApplication,
  type TMTeamMember,
} from '@/mock/transfer-maintenance'
import type { FeishuRecipient } from '@/types/plan-notify'

// ─── DragHandleContext ──────────────────────────────────────────────
export const DragHandleContext = createContext<Record<string, any>>({})

// ─── SortableRow ────────────────────────────────────────────────────
export function SortableRow({ children, ...props }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props['data-row-key'] })
  const style = { ...props.style, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <DragHandleContext.Provider value={listeners || {}}>
      <tr ref={setNodeRef} style={style} {...attributes}>{children}</tr>
    </DragHandleContext.Provider>
  )
}

// ─── DragHandle ─────────────────────────────────────────────────────
export function DragHandle() {
  const listeners = useContext(DragHandleContext)
  return <HolderOutlined style={{ cursor: 'grab', color: '#999' }} {...listeners} />
}

// ─── DHTMLXGantt ────────────────────────────────────────────────────
export function DHTMLXGantt({
  tasks,
  onTaskClick,
  readOnly = false,
  collapsedIds,
  onCollapsedChange,
}: {
  tasks: any[]
  onTaskClick?: (task: any) => void
  readOnly?: boolean
  collapsedIds?: Set<string>
  onCollapsedChange?: (updater: (prev: Set<string>) => Set<string>) => void
}) {
  const ganttContainer = useRef<HTMLDivElement>(null)
  const suppressFeedback = useRef(false)

  useEffect(() => {
    if (!ganttContainer.current) return

    gantt.config.date_format = '%Y-%m-%d'
    gantt.config.columns = [
      { name: 'text', label: '任务名称', width: 180, tree: true },
      { name: 'predecessor', label: '前置任务', align: 'center', width: 70 },
      { name: 'start_date', label: '计划开始', align: 'center', width: 90 },
      { name: 'end_date', label: '计划完成', align: 'center', width: 90 },
      { name: 'duration', label: '计划周期', align: 'center', width: 60, template: (task: any) => task.duration + '天' },
      { name: 'progress', label: '进度', align: 'center', width: 60, template: (task: any) => Math.round(task.progress * 100) + '%' },
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

    gantt.init(ganttContainer.current)

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
        responsible: t.responsible,
        predecessor: t.predecessor || '',
      })),
      links: tasks.filter(t => t.predecessor).map((t, i) => ({
        id: i + 1,
        source: t.predecessor,
        target: t.id,
        type: '0'
      }))
    }

    suppressFeedback.current = true
    gantt.parse(ganttData)
    queueMicrotask(() => { suppressFeedback.current = false })

    const openHandler = gantt.attachEvent('onTaskOpened', (id: any) => {
      if (suppressFeedback.current) return
      onCollapsedChange?.((prev) => { const s = new Set(prev); s.delete(String(id)); return s })
    })
    const closeHandler = gantt.attachEvent('onTaskClosed', (id: any) => {
      if (suppressFeedback.current) return
      onCollapsedChange?.((prev) => { const s = new Set(prev); s.add(String(id)); return s })
    })

    if (onTaskClick) {
      gantt.attachEvent('onTaskClick', (id: number) => {
        const task = gantt.getTask(id)
        onTaskClick(task)
        return true
      })
    }

    return () => {
      gantt.detachEvent(openHandler)
      gantt.detachEvent(closeHandler)
      gantt.clearAll()
    }
  }, [tasks, readOnly])

  useEffect(() => {
    if (!ganttContainer.current) return
    if (!(gantt as any).$container) return
    suppressFeedback.current = true
    gantt.eachTask((task: any) => {
      const id = String(task.id)
      const shouldOpen = !(collapsedIds && collapsedIds.has(id))
      if (task.$open !== shouldOpen) {
        if (shouldOpen) gantt.open(id)
        else gantt.close(id)
      }
    })
    queueMicrotask(() => { suppressFeedback.current = false })
  }, [collapsedIds])

  return <div ref={ganttContainer} style={{ width: '100%', height: '500px' }} />
}

// ─── MiniPipeline ───────────────────────────────────────────────────
const NODE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  not_started: { color: 'default', label: '未开始' },
  in_progress: { color: 'processing', label: '进行中' },
  success: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
}

export function MiniPipeline({ app }: { app: TransferApplication }) {
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

// ─── TeamMemberCard ─────────────────────────────────────────────────
export function TeamMemberCard({ member }: { member: TMTeamMember }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #f3f4f6', background: '#f8fafc' }}>
      <Avatar size={28} style={{ background: ROLE_COLORS[member.role] || '#999', fontSize: 12, flexShrink: 0 }}>{member.name.slice(-1)}</Avatar>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{member.role} · {member.department}</div>
      </div>
    </div>
  )
}

// ─── renderEntryContent ─────────────────────────────────────────────
export function renderEntryContent(record: { entryContent?: string; deliverables?: { id: string; name: string; url: string; type: string }[] }) {
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

// ─── ClickToEditDate ────────────────────────────────────────────────
export function ClickToEditDate({ value, onChange, disabledDate }: { value: string; onChange: (val: string) => void; disabledDate?: (current: dayjs.Dayjs) => boolean }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <DatePicker
        size="small"
        autoFocus
        open
        value={value ? dayjs(value) : null}
        style={{ width: 120 }}
        disabledDate={disabledDate}
        onChange={(date) => {
          onChange(date ? date.format('YYYY-MM-DD') : '')
          setEditing(false)
          message.success('已保存')
        }}
        onOpenChange={(open) => { if (!open) setEditing(false) }}
      />
    )
  }
  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        fontSize: 12, color: value ? '#4b5563' : '#bfbfbf',
        cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
        border: '1px dashed transparent', transition: 'all 0.2s',
        minHeight: 28, display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#91caff'; e.currentTarget.style.background = '#f0f7ff' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}
    >
      {value || '点击填写'}
    </div>
  )
}

// ─── sortTeamMembers ────────────────────────────────────────────────
export function sortTeamMembers(members: TMTeamMember[]): TMTeamMember[] {
  const order: Record<string, number> = { SPM: 0, TPM: 1, SQA: 2, '底软': 3, '系统': 4, '影像': 5 }
  return [...members].sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99))
}

// ─── Utility functions ──────────────────────────────────────────────

export const NOTIFY_DIFF_FIELDS = ['taskName', 'planStartDate', 'planEndDate', 'responsible', 'predecessor'] as const

export const MOCK_USER_MAP: Record<string, FeishuRecipient> = {
  '张三': { openId: 'ou_mock_zhangsan', email: 'zhangsan@transsion.com', name: '张三' },
  '李四': { openId: 'ou_mock_lisi',     email: 'lisi@transsion.com',     name: '李四' },
  '王五': { openId: 'ou_mock_wangwu',   email: 'wangwu@transsion.com',   name: '王五' },
  '赵六': { openId: 'ou_mock_zhaoliu',  email: 'zhaoliu@transsion.com',  name: '赵六' },
  '孙七': { openId: 'ou_mock_sunqi',    email: 'sunqi@transsion.com',    name: '孙七' },
  '周八': { openId: 'ou_mock_zhouba',   email: 'zhouba@transsion.com',   name: '周八' },
  '吴九': { openId: 'ou_mock_wujiu',    email: 'wujiu@transsion.com',    name: '吴九' },
}

/** Compute task depth in a flat task list */
export function getTaskDepth(task: any, allTasks: any[]): number {
  if (!task.parentId) return 0
  const parent = allTasks.find((t: any) => t.id === task.parentId)
  if (!parent) return 1
  return 1 + getTaskDepth(parent, allTasks)
}

/** Check if a task has children */
export function hasChildren(id: string, allTasks: any[]): boolean {
  return allTasks.some((t: any) => t.parentId === id)
}

/** Filter tasks by collapsed set */
export function filterByCollapsed(flatTasks: any[], collapsedSet: Set<string>): any[] {
  if (collapsedSet.size === 0) return flatTasks
  const byId = new Map(flatTasks.map((t: any) => [t.id, t]))
  const isHidden = (task: any): boolean => {
    let cur = task
    while (cur.parentId) {
      if (collapsedSet.has(cur.parentId)) return true
      cur = byId.get(cur.parentId)
      if (!cur) return false
    }
    return false
  }
  return flatTasks.filter((t: any) => !isHidden(t))
}

/** Get all expandable (parent) IDs */
export function getAllExpandableIds(tasksArg: any[]): string[] {
  const parentIds = new Set<string>()
  for (const t of tasksArg) if (t.parentId) parentIds.add(t.parentId)
  return Array.from(parentIds)
}

/** Shift a date string by N days (for export) */
export function shiftDateStrForExport(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

// ─── initialTodos (data used by WorkspaceContainer) ─────────────────
// 待办数据：仅修订中(未发布)的版本才会产生待办，已发布版本不产生待办
export const initialTodos = [
  // 逾期：修订版中的任务已过截止日
  { id: '1', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V4', versionId: 'v4', market: 'OP', responsible: '张三', priority: 'high', deadline: '2026-04-12', status: '进行中', taskDesc: 'V4修订版：STR2里程碑已逾期，需确认延期方案', category: 'overdue' as const },
  { id: '2', projectId: '2', projectName: 'tOS16.0', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V4', versionId: 'v4', market: '', responsible: '张三', priority: 'high', deadline: '2026-04-10', status: '进行中', taskDesc: 'V4修订版：STR3节点逾期，请更新计划', category: 'overdue' as const },
  // 即将到期：修订版中2天内到期的任务
  { id: '3', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level2' as const, planType: '1+N MR版本火车计划', planTabKey: 'plan2', versionNo: 'V1', versionId: 'v1', market: 'OP', responsible: '张三', priority: 'medium', deadline: '2026-04-17', status: '进行中', taskDesc: 'V1修订版：FR版本编译验证明天到期', category: 'upcoming' as const },
  { id: '4', projectId: '9', projectName: 'AI-Engine-V2', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V1', versionId: 'v1', market: '', responsible: '李四', priority: 'medium', deadline: '2026-04-18', status: '进行中', taskDesc: 'V1修订版：推理引擎性能测试即将到期', category: 'upcoming' as const },
  // 待处理：修订版中未开始的任务
  { id: '5', projectId: '3', projectName: 'X6855_H8917', planLevel: 'level2' as const, planType: '在研版本火车计划', planTabKey: 'plan1', versionNo: 'V1', versionId: 'v1', market: 'OP', responsible: '李四', priority: 'medium', deadline: '2026-04-25', status: '待处理', taskDesc: 'V1修订版：Display模块开发任务待启动', category: 'pending' as const },
  { id: '6', projectId: '1', projectName: 'X6877-D8400_H991', planLevel: 'level2' as const, planType: '需求开发计划', planTabKey: 'plan0', versionNo: 'V1', versionId: 'v1', market: 'TR', responsible: '张三', priority: 'low', deadline: '2026-04-30', status: '待处理', taskDesc: 'V1修订版：TR市场需求评审安排', category: 'pending' as const },
  { id: '7', projectId: '7', projectName: 'X6890-D8500_H1001', planLevel: 'level1' as const, planType: '一级计划', planTabKey: '', versionNo: 'V1', versionId: 'v1', market: 'OP', responsible: '张三', priority: 'low', deadline: '2026-05-10', status: '待处理', taskDesc: 'V1修订版：CAMON 40 Pro概念启动材料准备', category: 'pending' as const },
]

/** Merge L1 and L2 plans for the overview tab */
export function mergePlans(level1Tasks: any[], level2Tasks: any[]) {
  if (!level1Tasks || !level2Tasks) return []

  const milestones = level1Tasks.filter((t: any) => t.parentId)
  const milestoneRanges: Record<string, { start: Date, end: Date, parentId: string, parentName: string }> = {}
  milestones.forEach((m: any) => {
    if (m.planStartDate && m.planEndDate) {
      milestoneRanges[m.id] = {
        start: new Date(m.planStartDate),
        end: new Date(m.planEndDate),
        parentId: m.parentId,
        parentName: level1Tasks.find((t: any) => t.id === m.parentId)?.taskName || ''
      }
    }
  })

  const mergedTasks: any[] = []

  level1Tasks.forEach((task: any) => {
    mergedTasks.push({ ...task, source: 'level1', children: [] })
  })

  level2Tasks.forEach((l2Task: any) => {
    if (!l2Task.parentId || !l2Task.parentId.startsWith('plan')) return

    const l2Start = new Date(l2Task.planStartDate)
    const l2End = new Date(l2Task.planEndDate)

    const overlappingMilestones = Object.entries(milestoneRanges).filter(([milestoneId, range]) => {
      return l2Start <= range.end && l2End >= range.start
    })

    if (overlappingMilestones.length === 0) {
      const allMilestoneStarts = Object.values(milestoneRanges).map(r => r.start.getTime())
      if (allMilestoneStarts.length === 0) return
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
      const [milestoneId, range] = overlappingMilestones[0]
      mergedTasks.push({
        ...l2Task,
        source: 'level2',
        milestoneId,
        milestoneName: range.parentName
      })
    } else {
      overlappingMilestones.forEach(([milestoneId, range], index) => {
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
