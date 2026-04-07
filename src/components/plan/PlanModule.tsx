'use client'

import { useState, useEffect, useRef, createContext, useContext, Fragment, type CSSProperties } from 'react'
import dayjs from 'dayjs'
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
  message,
  Select,
  Input,
  Popconfirm,
  Tooltip,
  Modal,
  Checkbox,
  Divider,
  Radio,
  Statistic,
  Descriptions,
  Alert,
  DatePicker,
} from 'antd'
import {
  PlusOutlined,
  SaveOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  HolderOutlined,
  BarChartOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnsType } from 'antd/es/table'
import { compareVersionsForTable, CompareTableRow, FieldDiff } from '@/lib/versionCompare'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { gantt } from 'dhtmlx-gantt'
import RequirementDevPlan from '@/components/plans/RequirementDevPlan'
import VersionTrainPlan from '@/components/plans/VersionTrainPlan'
import type { Avatar } from 'antd'

const { Option } = Select

// ========== Constants ==========

export const VERSION_DATA = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
  { id: 'v3', versionNo: 'V3', status: '已发布' },
]

export const LEVEL1_TASKS = [
  { id: '1', order: 1, taskName: '概念', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-15', estimatedDays: 15, actualStartDate: '2026-01-01', actualEndDate: '2026-01-14', actualDays: 14 },
  { id: '1.1', parentId: '1', order: 1, taskName: '概念启动', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-07', estimatedDays: 7, actualStartDate: '2026-01-01', actualEndDate: '2026-01-07', actualDays: 7 },
  { id: '1.2', parentId: '1', order: 2, taskName: 'STR1', status: '已完成', progress: 100, responsible: '李四', predecessor: '1.1', planStartDate: '2026-01-08', planEndDate: '2026-01-15', estimatedDays: 8, actualStartDate: '2026-01-08', actualEndDate: '2026-01-14', actualDays: 7 },
  { id: '2', order: 2, taskName: '计划', status: '进行中', progress: 60, responsible: '王五', predecessor: '1.2', planStartDate: '2026-01-16', planEndDate: '2026-02-15', estimatedDays: 30, actualStartDate: '2026-01-16', actualEndDate: '', actualDays: 18 },
  { id: '2.1', parentId: '2', order: 1, taskName: 'STR2', status: '进行中', progress: 60, responsible: '王五', predecessor: '1.2', planStartDate: '2026-01-16', planEndDate: '2026-01-31', estimatedDays: 15, actualStartDate: '2026-01-16', actualEndDate: '', actualDays: 12 },
  { id: '2.2', parentId: '2', order: 2, taskName: 'STR3', status: '未开始', progress: 0, responsible: '赵六', predecessor: '2.1', planStartDate: '2026-02-01', planEndDate: '2026-02-15', estimatedDays: 15, actualStartDate: '', actualEndDate: '', actualDays: 0 },
  { id: '3', order: 3, taskName: '开发验证', status: '未开始', progress: 0, responsible: '', predecessor: '2.2', planStartDate: '2026-02-16', planEndDate: '2026-03-15', estimatedDays: 28, actualStartDate: '', actualEndDate: '', actualDays: 0 },
  { id: '4', order: 4, taskName: '上市保障', status: '未开始', progress: 0, responsible: '', predecessor: '3', planStartDate: '2026-03-16', planEndDate: '2026-04-15', estimatedDays: 30, actualStartDate: '', actualEndDate: '', actualDays: 0 },
]

export const ALL_COLUMNS = [
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

export const LEVEL2_PLAN_TYPES = ['1+N MR版本火车计划', '粉丝版本计划', '基础体验计划', 'WBS计划']

export const FIXED_LEVEL2_PLANS = [
  { id: 'plan0', name: '需求开发计划', type: '需求开发计划', fixed: true },
  { id: 'plan1', name: '在研版本火车计划', type: '在研版本火车计划', fixed: true },
]

// ========== DHTMLXGantt Component ==========
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

// ========== Drag & Drop Components ==========
const DragHandleContext = createContext<Record<string, any>>({})

function SortableRow({ children, ...props }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props['data-row-key'] })
  const style = { ...props.style, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <DragHandleContext.Provider value={listeners || {}}>
      <tr ref={setNodeRef} style={style} {...attributes}>{children}</tr>
    </DragHandleContext.Provider>
  )
}

function DragHandle() {
  const listeners = useContext(DragHandleContext)
  return <HolderOutlined style={{ cursor: 'grab', color: '#999' }} {...listeners} />
}

// ========== Helper Functions ==========

const getTaskDepth = (task: any, allTasks: any[]): number => {
  if (!task.parentId) return 0
  const parent = allTasks.find((t: any) => t.id === task.parentId)
  if (!parent) return 1
  return 1 + getTaskDepth(parent, allTasks)
}

// ========== Prop Interfaces ==========

export interface HorizontalTableProps {
  tasks: any[]
  versions: { id: string; versionNo: string; status: string }[]
}

export interface TaskTableProps {
  tasks: any[]
  setTasks: (tasks: any[]) => void
  isEditMode: boolean
  isCurrentDraft?: boolean
  currentLoginUser?: string
  visibleColumns: string[]
  searchText: string
  activeModule: string
  planLevel: string
  projectPlanLevel: string
  activeLevel2Plan: string
  level2PlanTasks: any[]
  setLevel2PlanTasks: React.Dispatch<React.SetStateAction<any[]>>
}

export interface ActionButtonsProps {
  versions: { id: string; versionNo: string; status: string }[]
  setVersions: React.Dispatch<React.SetStateAction<{ id: string; versionNo: string; status: string }[]>>
  currentVersion: string
  setCurrentVersion: (v: string) => void
  isEditMode: boolean
  setIsEditMode: (v: boolean) => void
  tasks: any[]
  setTasks: (tasks: any[]) => void
  setShowVersionCompare: (v: boolean) => void
  projectPlanLevel: string
  level2PlanMilestones: string[]
  level2PlanTasks: any[]
  checkParentTimeConstraint: () => { valid: boolean; violations: any[] }
  checkMilestoneTimeConstraint: (level2Tasks: any[], milestoneIds: string[], level1Tasks: any[]) => { valid: boolean; violations: any[] }
  parentTimeWarning: { visible: boolean; tasks: any[]; message: string }
  setParentTimeWarning: (v: { visible: boolean; tasks: any[]; message: string }) => void
  milestoneTimeWarning: { visible: boolean; violations: any[]; message: string }
  setMilestoneTimeWarning: (v: { visible: boolean; violations: any[]; message: string }) => void
}

export interface VersionCompareResultProps {
  compareResult: CompareTableRow[]
  compareShowUnchanged: boolean
  setCompareShowUnchanged: (v: boolean) => void
  compareFilterType: string
  setCompareFilterType: (v: string) => void
}

export interface PlanInfoProps {
  selectedProject: any
  renderHorizontalTable: () => React.ReactNode
}

export interface ProjectPlanProps {
  selectedProject: any
  tasks: any[]
  setTasks: (tasks: any[]) => void
  versions: { id: string; versionNo: string; status: string }[]
  setVersions: React.Dispatch<React.SetStateAction<{ id: string; versionNo: string; status: string }[]>>
  currentVersion: string
  setCurrentVersion: (v: string) => void
  isEditMode: boolean
  setIsEditMode: (v: boolean) => void
  viewMode: string
  setViewMode: (v: 'table' | 'gantt') => void
  searchText: string
  setSearchText: (v: string) => void
  visibleColumns: string[]
  setVisibleColumns: (v: string[]) => void
  showColumnModal: boolean
  setShowColumnModal: (v: boolean) => void
  projectPlanLevel: string
  setProjectPlanLevel: (v: string) => void
  projectPlanViewMode: 'table' | 'horizontal' | 'gantt'
  setProjectPlanViewMode: (v: 'table' | 'horizontal' | 'gantt') => void
  level2PlanTasks: any[]
  setLevel2PlanTasks: React.Dispatch<React.SetStateAction<any[]>>
  activeLevel2Plan: string
  setActiveLevel2Plan: (v: string) => void
  createdLevel2Plans: { id: string; name: string; type: string; fixed?: boolean }[]
  setCreatedLevel2Plans: React.Dispatch<React.SetStateAction<{ id: string; name: string; type: string; fixed?: boolean }[]>>
  selectedMarketTab: string
  setSelectedMarketTab: (v: string) => void
  marketPlanData: Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: { id: string; name: string; type: string }[] }>
  showVersionCompare: boolean
  setShowVersionCompare: (v: boolean) => void
  compareVersionA: string
  setCompareVersionA: (v: string) => void
  compareVersionB: string
  setCompareVersionB: (v: string) => void
  compareResult: CompareTableRow[]
  setCompareResult: (v: CompareTableRow[]) => void
  compareShowUnchanged: boolean
  setCompareShowUnchanged: (v: boolean) => void
  compareFilterType: string
  setCompareFilterType: (v: string) => void
  showCreateLevel2Plan: boolean
  setShowCreateLevel2Plan: (v: boolean) => void
  navigateWithEditGuard: (action: () => void) => void
  activeModule: string
  planLevel: string
  level2PlanMilestones: string[]
  setLevel2PlanMilestones: (v: string[]) => void
  level2PlanMeta: Record<string, any>
  setLevel2PlanMeta: React.Dispatch<React.SetStateAction<Record<string, any>>>
  hasPublishedLevel1Plan: boolean
  checkParentTimeConstraint: () => { valid: boolean; violations: any[] }
  checkMilestoneTimeConstraint: (level2Tasks: any[], milestoneIds: string[], level1Tasks: any[]) => { valid: boolean; violations: any[] }
  parentTimeWarning: { visible: boolean; tasks: any[]; message: string }
  setParentTimeWarning: (v: { visible: boolean; tasks: any[]; message: string }) => void
  milestoneTimeWarning: { visible: boolean; violations: any[]; message: string }
  setMilestoneTimeWarning: (v: { visible: boolean; violations: any[]; message: string }) => void
  projectPlanOverviewTab: string
  setProjectPlanOverviewTab: (v: string) => void
}

export interface PlanOverviewProps {
  tasks: any[]
  level2PlanTasks: any[]
  isEditMode: boolean
  visibleColumns: string[]
  projectPlanViewMode: 'table' | 'horizontal' | 'gantt'
  setProjectPlanViewMode: (v: 'table' | 'horizontal' | 'gantt') => void
  activeModule: string
  planLevel: string
  projectPlanLevel: string
  activeLevel2Plan: string
  setLevel2PlanTasks: React.Dispatch<React.SetStateAction<any[]>>
  searchText: string
  setTasks: (tasks: any[]) => void
}

// ========== HorizontalTable Component ==========

export function HorizontalTable({ tasks, versions }: HorizontalTableProps) {
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

  const thStyle: CSSProperties = { background: '#f8fafc', fontWeight: 600, fontSize: 13, color: '#4b5563', padding: '10px 12px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'center' }
  const tdStyle: CSSProperties = { padding: '8px 12px', fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap', minWidth: 100, border: '1px solid #e5e7eb' }
  const versionThStyle: CSSProperties = { ...thStyle, position: 'sticky', left: 0, zIndex: 2, minWidth: 80, background: '#f8fafc' }
  const cycleThStyle: CSSProperties = { ...thStyle, position: 'sticky', left: 80, zIndex: 2, minWidth: 80, background: '#f8fafc' }
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
              <tr key={version.id} style={isLatest ? { background: 'rgba(99,102,241,0.03)' } : undefined}>
                <td style={{ ...versionTdStyle, color: isLatest ? '#6366f1' : '#111827', background: isLatest ? 'rgba(99,102,241,0.06)' : '#fff' }}>
                  {version.versionNo}
                </td>
                <td style={{ ...cycleTdStyle, background: isLatest ? 'rgba(99,102,241,0.06)' : '#fff' }}>
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

// ========== GanttChart Component ==========

export function GanttChart({ tasks, isEditMode, onTaskClick }: { tasks: any[]; isEditMode: boolean; onTaskClick?: (task: any) => void }) {
  return (
    <div style={{ border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <DHTMLXGantt
        tasks={tasks}
        onTaskClick={(task) => {
          if (onTaskClick) {
            onTaskClick(task)
          } else {
            message.info(`点击任务: ${task.text}`)
          }
        }}
        readOnly={!isEditMode}
      />
    </div>
  )
}

// ========== ActualDateCell - 点击切换编辑的日期单元格 ==========
function ActualDateCell({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <DatePicker
        size="small"
        autoFocus
        open
        value={value ? dayjs(value) : null}
        style={{ width: 120 }}
        onChange={(date) => {
          const newVal = date ? date.format('YYYY-MM-DD') : ''
          onChange(newVal)
          setEditing(false)
          message.success('已保存')
        }}
        onBlur={() => setEditing(false)}
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
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}
    >
      {value || '点击填写'}
    </div>
  )
}

// ========== TaskTable Component ==========

export function TaskTable({
  tasks: tableTasks,
  setTasks: currentSetTasks,
  isEditMode,
  isCurrentDraft,
  visibleColumns,
  searchText,
  activeModule,
  planLevel,
  projectPlanLevel,
  activeLevel2Plan,
  level2PlanTasks,
  setLevel2PlanTasks,
}: TaskTableProps) {
  const isLevel2Custom = false // Determined by caller passing filtered tasks
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const handleAddSubTask = (parentId: string) => {
    const isLevel2Context = (activeModule === 'config' && planLevel === 'level2') || (activeModule === 'projectSpace' && projectPlanLevel === 'level2')
    const isLevel2TaskContext = isLevel2Context && activeLevel2Plan
    const currentTasks = isLevel2TaskContext ? level2PlanTasks.filter(t => t.planId === activeLevel2Plan) : tableTasks
    const parentTask = currentTasks.find(t => t.id === parentId)
    if (!parentTask) return
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
      const newTasks = [...tableTasks]
      const globalIndex = tableTasks.findIndex(t => t.id === parentId)
      let globalInsertIndex = globalIndex + 1
      for (let i = globalIndex + 1; i < tableTasks.length; i++) {
        if (tableTasks[i].parentId === parentId || (tableTasks[i].parentId && tableTasks.find(t => t.id === tableTasks[i].parentId)?.parentId === parentId)) {
          globalInsertIndex = i + 1
        } else {
          break
        }
      }
      newTasks.splice(globalInsertIndex, 0, newTask)
      currentSetTasks(newTasks)
    }
    message.success(`已添加子任务: ${newId}`)
  }

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
          {canAddChild && <Tooltip title="添加子项"><Button type="text" size="small" icon={<PlusOutlined />} style={{ color: '#6366f1' }} onClick={(e) => { e.stopPropagation(); handleAddSubTask(record.id) }} /></Tooltip>}
          <span style={{ fontWeight: depth === 0 ? 600 : 500, color: depth === 0 ? '#111827' : '#4b5563', fontSize: 13 }}>{id}</span>
        </div>
      )
    } })
    if (visibleColumns.includes('taskName')) cols.push({ title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 220, render: (name: string, record: any) => {
      const depth = record.indentLevel || 0
      if (isEditMode) return <Input className="pms-edit-input" value={name} size="small" style={{ fontWeight: depth === 0 ? 600 : 400 }} onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, taskName: e.target.value } : t); currentSetTasks(updated) }} />
      return (
        <div style={{ paddingLeft: depth * 16, display: 'flex', alignItems: 'center', gap: 4 }}>
          {depth > 0 && <span style={{ color: '#e5e7eb', fontSize: 11, flexShrink: 0 }}>{depth === 1 ? '├' : '└'}</span>}
          <span style={{ color: depth === 0 ? '#111827' : depth === 1 ? '#4b5563' : '#9ca3af', fontWeight: depth === 0 ? 600 : 400 }}>{name}</span>
        </div>
      )
    } })
    if (visibleColumns.includes('responsible')) cols.push({ title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 100, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, responsible: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <span style={{ fontSize: 13 }}>{val}</span> : <span style={{ color: '#e5e7eb' }}>-</span>) })
    if (visibleColumns.includes('predecessor')) cols.push({ title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 100, render: (val: string, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" placeholder="如: 1.1" onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, predecessor: e.target.value } : t); currentSetTasks(updated) }} /> : (val ? <Tag style={{ borderRadius: 4, fontSize: 12 }}>{val}</Tag> : <span style={{ color: '#e5e7eb' }}>-</span>) })
    if (visibleColumns.includes('planStartDate')) cols.push({ title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 130, render: (val: string, record: any) => isEditMode ? <DatePicker size="small" value={val ? dayjs(val) : null} style={{ width: 120 }} onChange={(date) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, planStartDate: date ? date.format('YYYY-MM-DD') : '' } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#4b5563' }}>{val || '-'}</span> })
    if (visibleColumns.includes('planEndDate')) cols.push({ title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 130, render: (val: string, record: any) => isEditMode ? <DatePicker size="small" value={val ? dayjs(val) : null} style={{ width: 120 }} onChange={(date) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, planEndDate: date ? date.format('YYYY-MM-DD') : '' } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#4b5563' }}>{val || '-'}</span> })
    if (visibleColumns.includes('estimatedDays')) cols.push({ title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 90, render: (val: number, record: any) => isEditMode ? <Input className="pms-edit-input" value={val} size="small" type="number" style={{ width: 70 }} onChange={(e) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, estimatedDays: parseInt(e.target.value) || 0 } : t); currentSetTasks(updated) }} /> : <span style={{ fontSize: 12, color: '#4b5563' }}>{val}天</span> })
    // 实际时间：修订版本中不可编辑，已发布版本中点击切换编辑
    const renderActualDateCell = (field: 'actualStartDate' | 'actualEndDate') => (val: string, record: any) => {
      if (isCurrentDraft) {
        // 修订版本：只读
        return <span style={{ fontSize: 12, color: '#4b5563' }}>{val || '-'}</span>
      }
      // 已发布版本：点击编辑
      return <ActualDateCell value={val} onChange={(newVal) => { const updated = tableTasks.map(t => t.id === record.id ? { ...t, [field]: newVal } : t); currentSetTasks(updated) }} />
    }
    if (visibleColumns.includes('actualStartDate')) cols.push({ title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 130, render: renderActualDateCell('actualStartDate') })
    if (visibleColumns.includes('actualEndDate')) cols.push({ title: '实际完成', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 130, render: renderActualDateCell('actualEndDate') })
    if (visibleColumns.includes('actualDays')) cols.push({ title: '实际工期', dataIndex: 'actualDays', key: 'actualDays', width: 90, render: (val: number) => <span style={{ fontSize: 12, color: '#4b5563' }}>{val > 0 ? `${val}天` : '-'}</span> })
    if (visibleColumns.includes('status')) cols.push({ title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === '已完成' ? 'success' : s === '进行中' ? 'processing' : 'default'} style={{ borderRadius: 4, fontSize: 12 }}>{s}</Tag> })
    if (visibleColumns.includes('progress')) cols.push({ title: '进度', dataIndex: 'progress', key: 'progress', width: 130, render: (p: number) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Progress percent={p} size="small" showInfo={false} strokeColor={p === 100 ? '#52c41a' : '#1890ff'} style={{ flex: 1, marginBottom: 0 }} />
        <span style={{ fontSize: 11, color: p === 100 ? '#52c41a' : '#4b5563', fontWeight: 500, minWidth: 32 }}>{p}%</span>
      </div>
    ) })
    if (isEditMode) cols.push({ title: '操作', key: 'action', width: 60, fixed: 'right', render: (_: any, record: any) => (<Popconfirm title="确认删除" description={`删除 "${record.taskName}" 及其子任务？`} onConfirm={() => { const filtered = tableTasks.filter(t => t.id !== record.id && t.parentId !== record.id && !(t.parentId && tableTasks.find((p: any) => p.id === t.parentId)?.parentId === record.id)); currentSetTasks(filtered); message.success(`已删除任务: ${record.id}`) }} okText="确认" cancelText="取消"><Button type="text" icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 4 }} /></Popconfirm>) })
    return cols
  }

  // 表格内拖拽处理器
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
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', background: '#f8fafc' }}>
          <Button type="dashed" icon={<PlusOutlined />} style={{ width: '100%', borderRadius: 6, height: 36 }} onClick={() => {
            const parentTasks = tableTasks.filter(t => !t.parentId)
            const maxOrder = parentTasks.length > 0 ? Math.max(...parentTasks.map(t => parseInt(t.id) || t.order)) : 0
            const newId = String(maxOrder + 1)
            const newTask: any = { id: newId, order: maxOrder + 1, taskName: '新活动', status: '未开始', progress: 0, responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
            currentSetTasks([...tableTasks, newTask])
            message.success(`已添加一级活动: ${newId}`)
          }}>添加新活动</Button>
        </div>
      )}
    </div>
  )
}

// ========== ActionButtons Component ==========

export function ActionButtons({
  versions,
  setVersions,
  currentVersion,
  setCurrentVersion,
  isEditMode,
  setIsEditMode,
  tasks,
  setTasks,
  setShowVersionCompare,
  projectPlanLevel,
  level2PlanMilestones,
  level2PlanTasks,
  checkParentTimeConstraint,
  checkMilestoneTimeConstraint,
  parentTimeWarning,
  setParentTimeWarning,
  milestoneTimeWarning,
  setMilestoneTimeWarning,
}: ActionButtonsProps) {
  const hasDraftVersion = versions.some(v => v.status === '修订中')
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'

  const handleCreateRevision = () => {
    const maxVersionNum = versions.reduce((max, v) => {
      const num = parseInt(v.versionNo.replace('V', ''))
      return num > max ? num : max
    }, 0)
    const newVersionNum = maxVersionNum + 1
    const newVersionId = `v${newVersionNum}`

    const publishedVersion = versions.find(v => v.status === '已发布')

    let clonedTasks = [...LEVEL1_TASKS]
    if (publishedVersion) {
      clonedTasks = LEVEL1_TASKS.map(t => ({ ...t }))
      message.success(`已创建修订版本 V${newVersionNum}，已克隆V${publishedVersion.versionNo}的内容`)
    } else {
      message.success(`已创建修订版本 V${newVersionNum}`)
    }

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
    setVersions(versions.map(v =>
      v.id === currentVersion
        ? { ...v, status: '已发布' }
        : v
    ))
    message.success('发布成功')
  }

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

    // 3. 检查二级计划时间是否在里程碑范围内
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

// ========== VersionCompareResult Component ==========

export function VersionCompareResult({
  compareResult,
  compareShowUnchanged,
  setCompareShowUnchanged,
  compareFilterType,
  setCompareFilterType,
}: VersionCompareResultProps) {
  if (compareResult.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#bfbfbf' }}>
        <HistoryOutlined style={{ fontSize: 36, display: 'block', marginBottom: 12, color: '#e5e7eb' }} />
        <div style={{ fontSize: 14, color: '#9ca3af' }}>选择两个版本后点击"开始对比"查看差异</div>
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
    return <span style={{ color: '#4b5563' }}>{value || '-'}</span>
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
                border: isActive ? `1px solid ${item.color}` : '1px solid #f3f4f6',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.label}</div>
            </div>
          )
        })}
      </div>
      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>共 {filteredData.length} 条记录</span>
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

// ========== PlanInfo Component (for basic info page) ==========

export function PlanInfo({ selectedProject }: { selectedProject: any }) {
  const p = selectedProject

  return (
    <Card
      id="section-plan"
      style={{ marginBottom: 20, borderRadius: 8 }}
      title={<Space><CalendarOutlined style={{ color: '#6366f1' }} /><span style={{ fontWeight: 600 }}>计划信息</span></Space>}
    >
      <Row gutter={[24, 16]}>
        <Col span={6}>
          <Statistic
            title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划开始时间</span>}
            value={p.planStartDate || '-'}
            valueStyle={{ fontSize: 16, fontWeight: 600 }}
            prefix={<CalendarOutlined style={{ color: '#6366f1', fontSize: 14 }} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={<span style={{ fontSize: 12, color: '#9ca3af' }}>计划结束时间</span>}
            value={p.planEndDate || '-'}
            valueStyle={{ fontSize: 16, fontWeight: 600 }}
            prefix={<CalendarOutlined style={{ color: '#faad14', fontSize: 14 }} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={<span style={{ fontSize: 12, color: '#9ca3af' }}>开发周期（工作日）</span>}
            value={p.developCycle || '-'}
            valueStyle={{ fontSize: 16, fontWeight: 600 }}
            suffix={p.developCycle ? <span style={{ fontSize: 12, color: '#9ca3af' }}>天</span> : undefined}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={<span style={{ fontSize: 12, color: '#9ca3af' }}>健康状态</span>}
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
      <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 1 }}>里程碑计划（横排视图）</div>
      <HorizontalTable tasks={LEVEL1_TASKS} versions={VERSION_DATA} />
    </Card>
  )
}

// ========== PlanOverview Component ==========

export function PlanOverview({
  tasks,
  level2PlanTasks,
  isEditMode,
  visibleColumns,
  projectPlanViewMode,
  setProjectPlanViewMode,
  activeModule,
  planLevel,
  projectPlanLevel,
  activeLevel2Plan,
  setLevel2PlanTasks,
  searchText,
  setTasks,
}: PlanOverviewProps) {
  // 跨里程碑拆分挂靠 - 计划融合算法
  const mergePlans = (level1Tasks: any[], l2Tasks: any[]) => {
    if (!level1Tasks || !l2Tasks) return []

    const milestones = level1Tasks.filter(t => t.parentId)
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

    const mergedTasks: any[] = []

    level1Tasks.forEach(task => {
      mergedTasks.push({ ...task, source: 'level1', children: [] })
    })

    l2Tasks.forEach(l2Task => {
      if (!l2Task.parentId || !l2Task.parentId.startsWith('plan')) return

      const l2Start = new Date(l2Task.planStartDate)
      const l2End = new Date(l2Task.planEndDate)

      const overlappingMilestones = Object.entries(milestoneRanges).filter(([milestoneId, range]) => {
        return l2Start <= range.end && l2End >= range.start
      })

      if (overlappingMilestones.length === 0) {
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

  const displayTasks = mergePlans(tasks, level2PlanTasks)

  return (
    <div>
      <Card
        style={{ borderRadius: 8 }}
        styles={{ body: { padding: 0 } }}
      >
        {/* 总览头部 */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Space size={8} align="center">
              <BarChartOutlined style={{ color: '#6366f1', fontSize: 16 }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>计划总览</span>
              <Tag color="blue" style={{ fontSize: 11, borderRadius: 4 }}>融合模式</Tag>
            </Space>
            <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af', paddingLeft: 24 }}>一级计划与二级计划融合展示</div>
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
          {projectPlanViewMode === 'gantt' ? (
            <GanttChart tasks={displayTasks} isEditMode={isEditMode} />
          ) : (
            <TaskTable
              tasks={displayTasks}
              setTasks={setTasks}
              isEditMode={isEditMode}
              isCurrentDraft={false}
              visibleColumns={visibleColumns}
              searchText={searchText}
              activeModule={activeModule}
              planLevel={planLevel}
              projectPlanLevel={projectPlanLevel}
              activeLevel2Plan={activeLevel2Plan}
              level2PlanTasks={level2PlanTasks}
              setLevel2PlanTasks={setLevel2PlanTasks}
            />
          )}
        </div>
      </Card>
    </div>
  )
}

// ========== ProjectPlan Component (Full plan module) ==========

export function ProjectPlan({
  selectedProject,
  tasks,
  setTasks,
  versions,
  setVersions,
  currentVersion,
  setCurrentVersion,
  isEditMode,
  setIsEditMode,
  searchText,
  setSearchText,
  visibleColumns,
  setVisibleColumns,
  showColumnModal,
  setShowColumnModal,
  projectPlanLevel,
  setProjectPlanLevel,
  projectPlanViewMode,
  setProjectPlanViewMode,
  level2PlanTasks,
  setLevel2PlanTasks,
  activeLevel2Plan,
  setActiveLevel2Plan,
  createdLevel2Plans,
  setCreatedLevel2Plans,
  selectedMarketTab,
  setSelectedMarketTab,
  marketPlanData,
  showVersionCompare,
  setShowVersionCompare,
  compareVersionA,
  setCompareVersionA,
  compareVersionB,
  setCompareVersionB,
  compareResult,
  setCompareResult,
  compareShowUnchanged,
  setCompareShowUnchanged,
  compareFilterType,
  setCompareFilterType,
  showCreateLevel2Plan,
  setShowCreateLevel2Plan,
  navigateWithEditGuard,
  activeModule,
  planLevel,
  level2PlanMilestones,
  setLevel2PlanMilestones,
  level2PlanMeta,
  setLevel2PlanMeta,
  hasPublishedLevel1Plan,
  checkParentTimeConstraint,
  checkMilestoneTimeConstraint,
  parentTimeWarning,
  setParentTimeWarning,
  milestoneTimeWarning,
  setMilestoneTimeWarning,
  projectPlanOverviewTab,
  setProjectPlanOverviewTab,
}: ProjectPlanProps) {
  const markets = selectedProject?.markets || []
  const showMarketTabs = selectedProject?.type === '整机产品项目' && markets.length > 0
  const hasDraftVersion = versions.some(v => v.status === '修订中')
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'

  // 市场颜色映射
  const marketColors: Record<string, string> = { 'OP': '#1890ff', 'TR': '#52c41a', 'RU': '#faad14', 'FR': '#722ed1', 'IN': '#eb2f96', 'BR': '#13c2c2' }

  // 搜索过滤
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

  const handleCreateRevision = () => {
    const maxVersionNum = versions.reduce((max, v) => {
      const num = parseInt(v.versionNo.replace('V', ''))
      return num > max ? num : max
    }, 0)
    const newVersionNum = maxVersionNum + 1
    const newVersionId = `v${newVersionNum}`
    const publishedVersion = versions.find(v => v.status === '已发布')
    let clonedTasks = [...LEVEL1_TASKS]
    if (publishedVersion) {
      clonedTasks = LEVEL1_TASKS.map(t => ({ ...t }))
      message.success(`已创建修订版本 V${newVersionNum}，已克隆V${publishedVersion.versionNo}的内容`)
    } else {
      message.success(`已创建修订版本 V${newVersionNum}`)
    }
    const newVersion = { id: newVersionId, versionNo: `V${newVersionNum}`, status: '修订中' }
    setVersions([...versions, newVersion])
    setCurrentVersion(newVersionId)
    setTasks(clonedTasks)
  }

  const handlePublish = () => {
    setVersions(versions.map(v => v.id === currentVersion ? { ...v, status: '已发布' } : v))
    message.success('发布成功')
  }

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
                <span style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginRight: 8 }}>市场</span>
                {markets.map((market: string) => (
                  <Tag
                    key={market}
                    color={selectedMarketTab === market ? (marketColors[market] || '#1890ff') : 'default'}
                    style={{
                      cursor: 'pointer', borderRadius: 4, padding: '4px 16px', fontSize: 13,
                      fontWeight: selectedMarketTab === market ? 600 : 400,
                      borderColor: selectedMarketTab === market ? (marketColors[market] || '#1890ff') : '#e5e7eb',
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
      {projectPlanLevel === 'overview' && (
        <PlanOverview
          tasks={tasks}
          level2PlanTasks={level2PlanTasks}
          isEditMode={isEditMode}
          visibleColumns={visibleColumns}
          projectPlanViewMode={projectPlanViewMode}
          setProjectPlanViewMode={setProjectPlanViewMode}
          activeModule={activeModule}
          planLevel={planLevel}
          projectPlanLevel={projectPlanLevel}
          activeLevel2Plan={activeLevel2Plan}
          setLevel2PlanTasks={setLevel2PlanTasks}
          searchText={searchText}
          setTasks={setTasks}
        />
      )}

      {/* 二级计划Tab切换 */}
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
              <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} onClick={() => { if (!hasPublishedLevel1Plan) { message.warning('请先发布一级计划后再创建二级计划'); return; } setShowCreateLevel2Plan(true) }}>创建二级计划</Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* 二级计划元数据展示 - 仅1+N MR版本火车计划类型显示 */}
      {projectPlanLevel === 'level2' && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1' && level2PlanMeta[activeLevel2Plan]?.planType === '1+N MR版本火车计划' && (
        <Card
          size="small"
          style={{ marginBottom: 16, borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}
          styles={{ body: { padding: '16px 20px' } }}
        >
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 3, height: 16, background: '#6366f1', borderRadius: 2 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>计划基本信息</span>
            <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>{level2PlanMeta[activeLevel2Plan]?.planType}</Tag>
          </div>
          <Descriptions
            size="small"
            column={3}
            labelStyle={{ color: '#9ca3af', fontSize: 13, fontWeight: 500, padding: '6px 12px 6px 0' }}
            contentStyle={{ color: '#111827', fontSize: 13, padding: '6px 0' }}
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
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>版本</span>
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
        {projectPlanLevel === 'level1' && (
          projectPlanViewMode === 'gantt' ? (
            <GanttChart tasks={filteredTasks} isEditMode={isEditMode} />
          ) : projectPlanViewMode === 'horizontal' ? (
            <HorizontalTable tasks={tasks} versions={versions} />
          ) : (
            <TaskTable
              tasks={tasks}
              setTasks={setTasks}
              isEditMode={isEditMode}
              isCurrentDraft={isCurrentDraft}
              visibleColumns={visibleColumns}
              searchText={searchText}
              activeModule={activeModule}
              planLevel={planLevel}
              projectPlanLevel={projectPlanLevel}
              activeLevel2Plan={activeLevel2Plan}
              level2PlanTasks={level2PlanTasks}
              setLevel2PlanTasks={setLevel2PlanTasks}
            />
          )
        )}
        {projectPlanLevel === 'level2' && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1' && activeLevel2Plan && (
          projectPlanViewMode === 'gantt' ? (
            <GanttChart tasks={level2PlanTasks.filter(t => t.planId === activeLevel2Plan)} isEditMode={isEditMode} />
          ) : (
            <TaskTable
              tasks={level2PlanTasks.filter(t => t.planId === activeLevel2Plan)}
              setTasks={(newTasks: any[]) => {
                const planId = activeLevel2Plan
                if (planId) {
                  setLevel2PlanTasks(prev => [...prev.filter(t => t.planId !== planId), ...newTasks])
                }
              }}
              isEditMode={isEditMode}
              isCurrentDraft={isCurrentDraft}
              visibleColumns={visibleColumns}
              searchText={searchText}
              activeModule={activeModule}
              planLevel={planLevel}
              projectPlanLevel={projectPlanLevel}
              activeLevel2Plan={activeLevel2Plan}
              level2PlanTasks={level2PlanTasks}
              setLevel2PlanTasks={setLevel2PlanTasks}
            />
          )
        )}
      </Card>

      {/* 版本对比Modal */}
      <Modal
        className="pms-modal"
        title={<Space><HistoryOutlined style={{ color: '#6366f1' }} /><span style={{ fontWeight: 600 }}>历史版本对比</span></Space>}
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
          borderRadius: 10, marginBottom: 16, border: '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>基准版本</span>
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
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>对比版本</span>
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
        <VersionCompareResult
          compareResult={compareResult}
          compareShowUnchanged={compareShowUnchanged}
          setCompareShowUnchanged={setCompareShowUnchanged}
          compareFilterType={compareFilterType}
          setCompareFilterType={setCompareFilterType}
        />
      </Modal>

      {/* 自定义列Modal */}
      <Modal className="pms-modal" title="自定义列" open={showColumnModal} onCancel={() => setShowColumnModal(false)} footer={[<Button key="reset" onClick={() => setVisibleColumns(ALL_COLUMNS.filter(c => c.default).map(c => c.key))}>重置</Button>, <Button key="cancel" onClick={() => setShowColumnModal(false)}>取消</Button>, <Button key="ok" type="primary" onClick={() => { setShowColumnModal(false); message.success('列配置已保存') }}>确定</Button>]}>
        <Checkbox.Group value={visibleColumns} onChange={(vals) => setVisibleColumns(vals as string[])}>
          <Row>
            <Col span={12}>{ALL_COLUMNS.slice(0, 6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col>
            <Col span={12}>{ALL_COLUMNS.slice(6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col>
          </Row>
        </Checkbox.Group>
      </Modal>
    </div>
  )
}
