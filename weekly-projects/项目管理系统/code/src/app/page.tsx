'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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
  Timeline,
  Form,
  Avatar,
  Empty,
  Slider,
  Alert,
  Statistic
} from 'antd'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { gantt } from 'dhtmlx-gantt'

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
    
    if (readOnly) {
      gantt.config.readonly = true
    }
    
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
  CheckCircleOutlined
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { compareVersions } from '@/lib/versionCompare'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnsType } from 'antd/es/table'

const { TabPane } = Tabs
const { Option } = Select
const { RangePicker } = DatePicker
const { TextArea } = Input

// 项目类型选项
const PROJECT_TYPES = ['整机产品项目', '产品项目', '技术项目', '能力建设项目']
const LEVEL2_PLAN_TYPES = ['需求开发计划', '在研版本火车计划', '1+N MR版本火车计划', '粉丝版本计划', '基础体验计划', 'WBS计划']

// 项目数据
const initialProjects = [
  { id: '1', name: 'X6877-D8400_H991', type: '整机产品项目', status: '进行中', progress: 65, leader: '张三', markets: ['OP', 'TR', 'RU'], androidVersion: 'Android 16', chipPlatform: 'MTK', spm: '李白', updatedAt: '2小时前' },
  { id: '2', name: 'X6801_TBD', type: '产品项目', status: '规划中', progress: 20, leader: '李四', markets: [], androidVersion: 'Android 16', chipPlatform: 'QCOM', spm: '张三', updatedAt: '1天前' },
  { id: '3', name: 'X6855_H8917', type: '整机产品项目', status: '进行中', progress: 45, leader: '王五', markets: ['OP', 'TR'], androidVersion: 'Android 16', chipPlatform: 'MTK', spm: '赵六', updatedAt: '3天前' },
  { id: '4', name: 'X6876_H786', type: '技术项目', status: '已完成', progress: 100, leader: '孙七', markets: [], androidVersion: 'Android 15', chipPlatform: 'QCOM', spm: '李四', updatedAt: '5天前' },
  { id: '5', name: 'X6873_H972', type: '能力建设项目', status: '进行中', progress: 30, leader: '周八', markets: [], androidVersion: 'Android 16', chipPlatform: 'UNISOC', spm: '王五', updatedAt: '1周前' },
]

const kanbanColumns = [
  { title: '概念阶段', key: 'concept', color: '#1890ff' },
  { title: '计划阶段', key: 'planning', color: '#52c41a' },
  { title: '开发阶段', key: 'developing', color: '#faad14' },
  { title: '发布阶段', key: 'released', color: '#722ed1' },
]

const initialTodos = [
  { id: '1', title: '完成项目计划文档', priority: 'high', deadline: '2026-03-10', status: '进行中' },
  { id: '2', title: '审核开发方案', priority: 'medium', deadline: '2026-03-15', status: '待处理' },
  { id: '3', title: '准备产品演示', priority: 'low', deadline: '2026-03-20', status: '待处理' },
]

const VERSION_DATA = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '修订中' },
  { id: 'v3', versionNo: 'V3', status: '已发布' },
]

const LEVEL1_TASKS = [
  { id: '1', order: 1, taskName: '概念', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-15', estimatedDays: 15, actualDays: 14 },
  { id: '1.1', parentId: '1', order: 1, taskName: '概念启动', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-07', estimatedDays: 7, actualDays: 7 },
  { id: '1.2', parentId: '1', order: 2, taskName: 'STR1', status: '已完成', progress: 100, responsible: '李四', predecessor: '1.1', planStartDate: '2026-01-08', planEndDate: '2026-01-15', estimatedDays: 8, actualDays: 7 },
  { id: '2', order: 2, taskName: '计划', status: '进行中', progress: 60, responsible: '王五', predecessor: '1.2', planStartDate: '2026-01-16', planEndDate: '2026-02-15', estimatedDays: 30, actualDays: 18 },
  { id: '2.1', parentId: '2', order: 1, taskName: 'STR2', status: '进行中', progress: 60, responsible: '王五', predecessor: '1.2', planStartDate: '2026-01-16', planEndDate: '2026-01-31', estimatedDays: 15, actualDays: 12 },
  { id: '2.2', parentId: '2', order: 2, taskName: 'STR3', status: '未开始', progress: 0, responsible: '赵六', predecessor: '2.1', planStartDate: '2026-02-01', planEndDate: '2026-02-15', estimatedDays: 15, actualDays: 0 },
  { id: '3', order: 3, taskName: '开发验证', status: '未开始', progress: 0, responsible: '', predecessor: '2.2', planStartDate: '2026-02-16', planEndDate: '2026-03-15', estimatedDays: 28, actualDays: 0 },
  { id: '4', order: 4, taskName: '上市保障', status: '未开始', progress: 0, responsible: '', predecessor: '3', planStartDate: '2026-03-16', planEndDate: '2026-04-15', estimatedDays: 30, actualDays: 0 },
]

const ALL_COLUMNS = [
  { key: 'id', title: '序号', default: true },
  { key: 'taskName', title: '任务名称', default: true },
  { key: 'responsible', title: '责任人', default: true },
  { key: 'predecessor', title: '前置任务', default: true },
  { key: 'planStartDate', title: '计划开始', default: true },
  { key: 'planEndDate', title: '计划完成', default: true },
  { key: 'estimatedDays', title: '预估工期', default: true },
  { key: 'actualStartDate', title: '实际开始', default: false },
  { key: 'actualEndDate', title: '实际完成', default: false },
  { key: 'actualDays', title: '实际工期', default: true },
  { key: 'status', title: '状态', default: true },
  { key: 'progress', title: '进度', default: true },
]

// IR需求Mock数据（待定状态）
const IR_REQUIREMENTS: any[] = []

// SR需求Mock数据（待定状态）
const SR_REQUIREMENTS: any[] = []

// 可排序行组件
function SortableRow({ children, ...props }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props['data-row-key'] })
  const style = { ...props.style, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return <tr ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</tr>
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<string>('projects')
  const [projectView, setProjectView] = useState<string>('card')
  const [projects] = useState(initialProjects)
  const [todos] = useState(initialTodos)
  const [selectedProject, setSelectedProject] = useState<typeof initialProjects[0] | null>(null)
  
  // 配置相关状态
  // 配置相关状态
  const [selectedProjectType, setSelectedProjectType] = useState(PROJECT_TYPES[0])
  const [planLevel, setPlanLevel] = useState<string>('level1')
  const [selectedPlanType, setSelectedPlanType] = useState(LEVEL2_PLAN_TYPES[0])
  const [customTypes, setCustomTypes] = useState<string[]>([])
  const [versions, setVersions] = useState(VERSION_DATA)
  const [currentVersion, setCurrentVersion] = useState('v2')
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
  const [compareResult, setCompareResult] = useState<any[]>([])
  
  // 项目空间
  const [projectSpaceModule, setProjectSpaceModule] = useState('basic')
  const [ganttEditingTask, setGanttEditingTask] = useState<any>(null)
  
  // 项目空间-计划
  const [projectPlanLevel, setProjectPlanLevel] = useState<string>('level1')
  const [projectPlanViewMode, setProjectPlanViewMode] = useState<'table' | 'gantt'>('table')
  const [level2PlanTasks, setLevel2PlanTasks] = useState<any[]>([])
  const [level2PlanMilestones, setLevel2PlanMilestones] = useState<string[]>([])
  const [createdLevel2Plans, setCreatedLevel2Plans] = useState<{id: string, name: string, type: string}[]>([
    { id: 'plan1', name: 'FR版本火车计划', type: 'FR版本火车计划' },
    { id: 'plan2', name: 'MR1版本火车计划', type: 'MR版本火车计划' },
    { id: 'plan3', name: 'MR2版本火车计划', type: 'MR版本火车计划' },
  ])  // 已创建的二级计划列表
  const [activeLevel2Plan, setActiveLevel2Plan] = useState<string>('')  // 当前查看的二级计划
  
  // 项目空间-市场Tab
  const [selectedMarketTab, setSelectedMarketTab] = useState<string>('OP')
  
  // 二级计划创建
  const [showCreateLevel2Plan, setShowCreateLevel2Plan] = useState(false)
  const [selectedLevel2PlanType, setSelectedLevel2PlanType] = useState('需求开发计划')
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([])
  const [selectedMRVersion, setSelectedMRVersion] = useState<string>('FR')  // MR版本类型
  const [irSrView, setIrSrView] = useState<'ir' | 'sr'>('ir')
  
  // 二级计划时间约束警告状态
  const [milestoneTimeWarning, setMilestoneTimeWarning] = useState<{visible: boolean, violations: any[], message: string}>({visible: false, violations: [], message: ''})
  
  // 检查是否有一级计划已发布
  const hasPublishedLevel1Plan = versions.some(v => v.status === '已发布')
  
  // 自定义类型管理
  const [showAddCustomType, setShowAddCustomType] = useState(false)
  const [newCustomTypeName, setNewCustomTypeName] = useState('')

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const allPlanTypes = [...LEVEL2_PLAN_TYPES, ...customTypes]
  const hasDraftVersion = versions.some(v => v.status === '修订中')
  const currentVersionData = versions.find(v => v.id === currentVersion)
  const isCurrentDraft = currentVersionData?.status === '修订中'

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
    const parentTask = tasks.find(t => t.id === parentId)
    if (!parentTask) return
    const siblingTasks = tasks.filter(t => t.parentId === parentId)
    const newOrder = siblingTasks.length + 1
    const newId = `${parentId}.${newOrder}`
    const newTask = { id: newId, parentId, order: newOrder, taskName: '新子任务', status: '未开始', progress: 0, responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0, actualDays: 0 }
    setTasks([...tasks, newTask])
    message.success(`已添加子任务: ${newId}`)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    
    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    
    if (oldIndex !== -1 && newIndex !== -1) {
      // 获取移动的任务
      const movedTask = tasks[oldIndex]
      const isParentTask = !movedTask.parentId
      
      let newTasks = [...tasks]
      
      if (isParentTask) {
        // 移动父任务时包括其所有子任务
        const childTasks = tasks.filter(t => t.parentId === movedTask.id)
        const parentAndChildren = [movedTask, ...childTasks]
        
        // 从原位置移除
        newTasks = newTasks.filter(t => t.id !== movedTask.id && !childTasks.some(c => c.id === t.id))
        
        // 找到目标位置
        const overTask = tasks[newIndex]
        const overIsParent = !overTask.parentId
        
        if (overIsParent) {
          const overParentChildren = newTasks.filter(t => t.parentId === overTask.id)
          const insertIndex = newTasks.findIndex(t => t.id === overTask.id) + overParentChildren.length
          newTasks.splice(insertIndex, 0, ...parentAndChildren)
        } else {
          // 插入到子任务之前
          const insertIndex = newTasks.findIndex(t => t.id === overTask.id)
          newTasks.splice(insertIndex, 0, ...parentAndChildren)
        }
      } else {
        // 移动子任务
        newTasks = arrayMove(tasks, oldIndex, newIndex)
      }
      
      // 重新生成序号 - 保持层级结构
      let parentCounter = 0
      newTasks = newTasks.map(t => {
        if (!t.parentId) {
          // 一级任务
          parentCounter++
          const newId = String(parentCounter)
          return { ...t, id: newId, order: parentCounter }
        } else {
          // 子任务 - 保持父任务ID
          return t
        }
      })
      
      // 更新子任务的ID和parentId
      newTasks = newTasks.map(t => {
        if (t.parentId) {
          const parentTask = newTasks.find(p => p.id === t.parentId)
          if (parentTask) {
            return { ...t, id: `${parentTask.id}.${t.order || 1}` }
          }
        }
        return t
      })
      
      setTasks(newTasks)
      message.success('任务顺序已更新，序号已重新生成')
    }
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
    const statusColor = project.status === '进行中' ? 'processing' : project.status === '已完成' ? 'success' : 'warning'
    return (
      <Card hoverable style={{ marginBottom: 16 }} onClick={() => { setSelectedProject(project); setActiveModule('projectSpace') }}>
        <Card.Meta 
          title={<Space><span>{project.name}</span><Tag color={statusColor}>{project.status}</Tag></Space>} 
          description={
            <Space direction="vertical" size={0}>
              <span>{project.type}</span>
              <Space size={4}>
                <Tag>📱 {project.androidVersion}</Tag>
                <Tag>🔧 {project.chipPlatform}</Tag>
              </Space>
              {project.type === '整机产品项目' && project.markets && project.markets.length > 0 && <Tag color="blue">🌍 市场: {project.markets.join(', ')}</Tag>}
            </Space>
          } 
        />
        <div style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div><span style={{ color: '#888' }}>进度 </span><Progress percent={project.progress} size="small" status={project.progress === 100 ? 'success' : 'active'}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: 12 }}>
              <span>SPM: {project.spm}</span>
              <span>更新于 {project.updatedAt}</span>
            </div>
          </Space>
        </div>
      </Card>
    )
  }

  const renderKanbanBoard = () => (
    <Row gutter={16}>
      {kanbanColumns.map(col => (
        <Col span={6} key={col.key}>
          <Card title={<Space><Badge color={col.color} />{col.title}</Space>} style={{ background: '#fafafa', minHeight: 300 }} bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {projects.filter(p => { if (col.key === 'concept') return p.progress === 0; if (col.key === 'planning') return p.progress > 0 && p.progress < 30; if (col.key === 'developing') return p.progress >= 30 && p.progress < 100; return p.progress === 100 }).map(project => (
                <Card key={project.id} size="small" hoverable onClick={() => { setSelectedProject(project); setActiveModule('projectSpace') }}>
                  <Space direction="vertical" style={{ width: '100%' }}><div style={{ fontWeight: 500 }}>{project.name}</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Tag>{project.type}</Tag><Progress percent={project.progress} size="small" style={{ width: 60 }} /></div></Space>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  )

  const renderTodoList = () => {
    const columns = [
      { title: '待办事项', dataIndex: 'title', key: 'title' },
      { title: '优先级', dataIndex: 'priority', key: 'priority', render: (p: string) => <Tag color={p === 'high' ? 'red' : p === 'medium' ? 'orange' : 'blue'}>{p === 'high' ? '高' : p === 'medium' ? '中' : '低'}</Tag> },
      { title: '截止日期', dataIndex: 'deadline', key: 'deadline' },
      { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === '进行中' ? 'processing' : 'default'}>{s}</Tag> },
      { title: '操作', key: 'action', render: () => <Button type="link" size="small">完成</Button> }
    ]
    return <Table dataSource={todos} columns={columns} rowKey="id" pagination={false} />
  }

  const renderGanttChart = () => {
    return (
      <Card>
        <DHTMLXGantt 
          tasks={filteredTasks} 
          onTaskClick={(task) => {
            message.info(`点击任务: ${task.text}`)
          }}
          readOnly={!isEditMode}
        />
      </Card>
    )
  }

  const renderTaskTable = () => {
    const flatTasks = tasks.map(task => ({ ...task, indentLevel: task.parentId ? (task.parentId.split('.').length - 1) : 0 }))
    const getColumns = (): ColumnsType<any> => {
      const cols: ColumnsType<any> = []
      if (visibleColumns.includes('id')) cols.push({ title: '序号', dataIndex: 'id', key: 'id', width: 80, fixed: 'left', render: (id: string, record: any) => (<Space>{isEditMode && !record.parentId && <HolderOutlined style={{ cursor: 'grab', color: '#999' }} />}<span style={{ fontWeight: record.parentId ? 400 : 500, paddingLeft: record.indentLevel * 16 }}>{id}</span>{isEditMode && !record.parentId && <Tooltip title="添加子项"><Button type="text" size="small" icon={<PlusOutlined />} onClick={() => handleAddSubTask(record.id)} /></Tooltip>}</Space>) })
      if (visibleColumns.includes('taskName')) cols.push({ title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 180, render: (name: string, record: any) => (isEditMode ? <Input defaultValue={name} style={{ fontWeight: record.parentId ? 400 : 500 }} /> : (record.parentId ? <span style={{ paddingLeft: record.indentLevel * 16, color: '#666' }}>└─ {name}</span> : name)) })
      if (visibleColumns.includes('responsible')) cols.push({ title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 100, render: (val: string) => isEditMode ? <Input defaultValue={val} size="small" /> : val })
      if (visibleColumns.includes('predecessor')) cols.push({ title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 100, render: (val: string) => isEditMode ? <Input defaultValue={val} size="small" placeholder="如: 1.1" /> : val })
      if (visibleColumns.includes('planStartDate')) cols.push({ title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 120 })
      if (visibleColumns.includes('planEndDate')) cols.push({ title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 120 })
      if (visibleColumns.includes('estimatedDays')) cols.push({ title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 90, render: (val: number) => `${val}天` })
      if (visibleColumns.includes('actualStartDate')) cols.push({ title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 120 })
      if (visibleColumns.includes('actualEndDate')) cols.push({ title: '实际完成', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 120 })
      if (visibleColumns.includes('actualDays')) cols.push({ title: '实际工期', dataIndex: 'actualDays', key: 'actualDays', width: 90, render: (val: number) => val > 0 ? `${val}天` : '-' })
      if (visibleColumns.includes('status')) cols.push({ title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === '已完成' ? 'success' : s === '进行中' ? 'processing' : 'default'}>{s}</Tag> })
      if (visibleColumns.includes('progress')) cols.push({ title: '进度', dataIndex: 'progress', key: 'progress', width: 120, render: (p: number) => <Progress percent={p} size="small" status={p === 100 ? 'success' : 'active'} /> })
      cols.push({ title: '操作', key: 'action', width: 80, fixed: 'right', render: (_: any, record: any) => (<Popconfirm title="确认删除" description="是否确认删除？" onConfirm={() => message.success(`删除任务: ${record.id}`)} okText="确认" cancelText="取消"><Button type="text" icon={<DeleteOutlined />} size="small" danger /></Popconfirm>) })
      return cols
    }
    const TableComponents = isEditMode ? { body: { row: SortableRow } } : undefined
    return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={filteredTasks.filter(t => !t.parentId).map(t => t.id)} strategy={verticalListSortingStrategy}><Table dataSource={flatTasks} columns={getColumns()} rowKey="id" pagination={false} scroll={{ x: visibleColumns.length * 100 + 200 }} components={TableComponents} /></SortableContext></DndContext>
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
    
    if (isEditMode) return (<Space><Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{currentVersionData?.versionNo}({currentVersionData?.status})</Tag><Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button><Button onClick={() => { setIsEditMode(false); message.info('已取消编辑') }}>取消</Button></Space>)
    return (<Space>{!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRevision}>创建修订</Button>}{isCurrentDraft && <Button icon={<EditOutlined />} onClick={() => setIsEditMode(true)}>编辑</Button>}{isCurrentDraft && <Button type="primary" icon={<SaveOutlined />} onClick={handlePublish}>发布</Button>}<Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)}>历史版本对比</Button></Space>)
  }

  const renderVersionCompareResult = () => {
    if (compareResult.length === 0) {
      return <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>请选择两个版本点击"开始对比"</div>
    }
    
    const getColor = (type: string) => {
      if (type === '新增') return '#52c41a'
      if (type === '删除') return '#ff4d4f'
      return '#1890ff'
    }
    
    return (
      <div style={{ marginTop: 16, maxHeight: 400, overflow: 'auto' }}>
        <Alert 
          message={`对比完成: 新增${compareResult.filter(d => d.changeType === '新增').length}项, 删除${compareResult.filter(d => d.changeType === '删除').length}项, 修改${compareResult.filter(d => d.changeType === '修改').length}项`} 
          type="info" 
          style={{ marginBottom: 16 }} 
        />
        <Timeline items={compareResult.map((d: any) => ({
          color: getColor(d.changeType),
          children: (
            <div>
              {d.changeType === '新增' && <span style={{ color: '#52c41a', fontWeight: 'bold' }}>+ 新增: </span>}
              {d.changeType === '删除' && <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>- 删除: </span>}
              {d.changeType === '修改' && <span style={{ color: '#1890ff', fontWeight: 'bold' }}>~ 修改: </span>}
              <span style={{ fontWeight: 500 }}>{d.taskId}</span> {d.changeType === '新增' ? d.newValue : d.oldValue?.split('\n')[0]}
              {d.changeType === '修改' && (
                <div style={{ marginTop: 4, marginLeft: 16, color: '#666', fontSize: 12 }}>
                  {d.oldValue?.split('\n').map((line: string, i: number) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )
        }))} />
      </div>
    )
  }

  // 项目空间 - 需求模块
  const renderProjectRequirements = () => {
    return (
      <Card>
        <Empty description="该模块开发中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }

  // 项目空间-基础信息
  const renderProjectBasicInfo = () => {
    const markets = selectedProject?.markets || ['OP', 'TR', 'RU']
    const isWholeMachine = selectedProject?.type === '整机产品项目'
    
    return (
      <div>
        {/* 项目基础信息 - 只读 */}
        <Card title="项目基础信息" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={24}>
            <Col span={8}>
              <Form layout="vertical">
                <Form.Item label="产品线"><Input defaultValue="NOTE" disabled /></Form.Item>
                <Form.Item label="主板名"><Input defaultValue="H8917" disabled /></Form.Item>
                <Form.Item label="芯片"><Input defaultValue="MT6789J (G100 Ultimate)" disabled /></Form.Item>
              </Form>
            </Col>
            <Col span={8}>
              <Form layout="vertical">
                <Form.Item label="市场名"><Input defaultValue="NOTE 50 Pro" disabled /></Form.Item>
                <Form.Item label="项目名"><Input defaultValue="X6855" disabled /></Form.Item>
                <Form.Item label="OS版本"><Input defaultValue="XOS16.2.0" disabled /></Form.Item>
              </Form>
            </Col>
            <Col span={8}>
              <Form layout="vertical">
                <Form.Item label="安卓版本"><Input defaultValue="16 (W)" disabled /></Form.Item>
                <Form.Item label="项目状态"><Input defaultValue="待立项" disabled /></Form.Item>
                <Form.Item label="SPM"><Input defaultValue="曾晓寅" disabled /></Form.Item>
              </Form>
            </Col>
          </Row>
        </Card>
        
        {/* 市场项目信息 - Tab切换 */}
        {isWholeMachine && (
          <Card title="市场项目信息" size="small">
            <Tabs 
              activeKey={selectedMarketTab}
              onChange={setSelectedMarketTab}
              items={markets.map(m => ({
                key: m,
                label: m,
                children: (
                  <Form layout="vertical">
                    <Row gutter={24}>
                      <Col span={8}>
                        <Form.Item label="市场项目名"><Input defaultValue={`X6855-${m}`} disabled /></Form.Item>
                        <Form.Item label="编译选项"><Input defaultValue="x6855" disabled /></Form.Item>
                        <Form.Item label="运营商定制"><Select defaultValue="否" style={{ width: '100%' }} disabled><Option value="否">否</Option><Option value="是">是</Option></Select></Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="是否取消暂停"><Select defaultValue="否" style={{ width: '100%' }} disabled><Option value="否">否</Option><Option value="是">是</Option></Select></Form.Item>
                        <Form.Item label="SQA审计策略"><Select defaultValue="全审" style={{ width: '100%' }} disabled><Option value="全审">全审</Option><Option value="抽审">抽审</Option></Select></Form.Item>
                        <Form.Item label="是否锁卡"><Select defaultValue="否" style={{ width: '100%' }} disabled><Option value="否">否</Option><Option value="是">是</Option></Select></Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="内存"><Input defaultValue="8GB" disabled /></Form.Item>
                        <Form.Item label="BOM"><Input defaultValue="BOM-001" disabled /></Form.Item>
                        <Form.Item label="软件版本号"><Input defaultValue="XOS16.2.0" disabled /></Form.Item>
                      </Col>
                    </Row>
                  </Form>
                )
              }))}
            />
          </Card>
        )}
      </div>
    )
  }

  // 项目空间 - 计划模块
  const renderProjectPlan = () => {
    return (
      <div>
        <Tabs 
          activeKey={projectPlanLevel} 
          onChange={(key) => setProjectPlanLevel(key as string)}
          style={{ marginBottom: 16 }}
          items={[
            { key: 'level1', label: '一级计划' },
            { key: 'level2', label: '二级计划' },
          ]}
        />
        
        {/* 二级计划Tab切换 - 在版本选择器上方 */}
        {projectPlanLevel === 'level2' && (
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <Tabs 
                activeKey={activeLevel2Plan} 
                onChange={setActiveLevel2Plan}
                items={[
                  ...createdLevel2Plans.map(plan => ({
                    key: plan.id,
                    label: plan.name
                  }))
                ]}
              />
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateLevel2Plan(true)}>创建二级计划</Button>
            </Col>
          </Row>
        )}
        
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <span style={{ color: '#666' }}>版本:</span>
              <Select value={currentVersion} onChange={(val) => { setCurrentVersion(val); setIsEditMode(false) }} style={{ width: 150 }}>
                {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}
              </Select>
              {/* 操作按钮：创建修订/编辑/发布/版本对比 */}
              {!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRevision}>创建修订</Button>}
              {isCurrentDraft && <><Button icon={<EditOutlined />} onClick={() => setIsEditMode(true)}>编辑</Button><Button type="primary" icon={<SaveOutlined />} onClick={handlePublish}>发布</Button></>}
              <Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)}>版本对比</Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Input placeholder="搜索任务..." prefix={<SearchOutlined />} style={{ width: 200 }} onChange={(e) => setSearchText(e.target.value)} />
              <Button icon={<AppstoreOutlined />} onClick={() => setShowColumnModal(true)}>自定义列</Button>
              <Button 
                icon={projectPlanViewMode === 'table' ? <BarChartOutlined /> : <AppstoreOutlined />} 
                onClick={() => setProjectPlanViewMode(projectPlanViewMode === 'table' ? 'gantt' : 'table')}
              >
                {projectPlanViewMode === 'table' ? '甘特图' : '表格'}
              </Button>
            </Space>
          </Col>
        </Row>
        
        {/* 表格或甘特图内容 */}

        {projectPlanViewMode === 'gantt' ? renderGanttChart() : renderTaskTable()}
      </div>
    )
  }

  // 项目空间 - 概况模块
  const renderProjectOverview = () => {
    return (
      <Card>
        <Empty description="该模块开发中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }
  
  // 项目空间 - 计划总览（一二级融合）
  const renderProjectPlanOverview = () => {
    return (
      <div>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col><h3 style={{ margin: 0 }}>计划总览</h3><p style={{ margin: '4px 0 0', color: '#666' }}>一级计划与二级计划融合展示</p></Col>
          <Col>
            <Space>
              <Button 
                icon={projectPlanViewMode === 'table' ? <BarChartOutlined /> : <AppstoreOutlined />} 
                onClick={() => setProjectPlanViewMode(projectPlanViewMode === 'table' ? 'gantt' : 'table')}
              >
                {projectPlanViewMode === 'table' ? '甘特图' : '表格'}
              </Button>
            </Space>
          </Col>
        </Row>
        
        <Card>
          <Tabs 
            items={[
              { key: 'overview', label: '总览' },
              { key: 'level1', label: '一级计划' },
              { key: 'level2', label: '二级计划' },
            ]}
          />
          {projectPlanViewMode === 'gantt' ? renderGanttChart() : renderTaskTable()}
        </Card>
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
    ]
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <div style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
          <Row align="middle" style={{ height: 64 }}>
            <Col flex="none"><Button icon={<LeftOutlined />} onClick={() => setActiveModule('projects')}>返回</Button></Col>
            <Col flex="auto" style={{ textAlign: 'center' }}><h2 style={{ margin: 0 }}>{selectedProject?.name} - 项目空间</h2></Col>
            <Col flex="none"><Button type="primary" icon={<SaveOutlined />}>保存</Button></Col>
          </Row>
        </div>
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
          <div style={{ width: 200, background: '#fff', borderRight: '1px solid #f0f0f0' }}>
            <Menu mode="inline" selectedKeys={[projectSpaceModule]} style={{ border: 'none' }} items={menuItems} onClick={({ key }) => setProjectSpaceModule(key)} />
          </div>
          <div style={{ flex: 1, padding: 24 }}>
            {projectSpaceModule === 'basic' && renderProjectBasicInfo()}
            {projectSpaceModule === 'plan' && renderProjectPlan()}
            {projectSpaceModule === 'overview' && renderProjectOverview()}
            {projectSpaceModule === 'requirements' && renderProjectRequirements()}
            {projectSpaceModule !== 'basic' && projectSpaceModule !== 'plan' && projectSpaceModule !== 'overview' && projectSpaceModule !== 'requirements' && <Card><Empty description={`${menuItems.find(m => m.key === projectSpaceModule)?.label}模块开发中...`} /></Card>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {activeModule === 'projectSpace' && selectedProject ? renderProjectSpace() : (
        <>
          <div style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
            <Row align="middle" justify="space-between" style={{ height: 64 }}>
              <Col><Space size={48}><h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>项目管理系统</h1><Tabs activeKey={activeModule} onChange={(key) => setActiveModule(key)} type="card" items={[{ key: 'projects', label: <span style={{ color: activeModule === 'projects' ? '#1890ff' : '#000', fontWeight: 500 }}>工作台</span> }, { key: 'config', label: <span style={{ color: activeModule === 'config' ? '#1890ff' : '#000', fontWeight: 500 }}>配置中心</span> }]} /></Space></Col>
              <Col><div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1890ff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>用</div></Col>
            </Row>
          </div>
          <div style={{ padding: 24 }}>
            {activeModule === 'projects' && (<Card><Tabs activeKey={projectView} onChange={(key) => setProjectView(key)} type="card" items={[{ key: 'card', label: <span style={{ color: projectView === 'card' ? '#1890ff' : '#000', fontWeight: 500 }}>项目卡片</span> }, { key: 'kanban', label: <span style={{ color: projectView === 'kanban' ? '#1890ff' : '#000', fontWeight: 500 }}>项目看板</span> }, { key: 'todo', label: <span style={{ color: projectView === 'todo' ? '#1890ff' : '#000', fontWeight: 500 }}>代办中心</span> }]} />
              {projectView === 'card' && (<><Row justify="space-between" align="middle" style={{ marginBottom: 16 }}><Col><h3 style={{ margin: 0 }}>项目列表</h3></Col></Row><Row gutter={[16, 16]}>{projects.map(p => <Col xs={24} sm={12} lg={8} key={p.id}>{renderProjectCard(p)}</Col>)}</Row></>)}
              {projectView === 'kanban' && renderKanbanBoard()}
              {projectView === 'todo' && renderTodoList()}
            </Card>)}
            {(activeModule === 'config' || activeModule === 'projectSpace') && (
              <Row gutter={24}>
                <Col span={sidebarCollapsed ? 1 : 4}><Card title={!sidebarCollapsed && "项目类型"} size="small" bodyStyle={{ padding: sidebarCollapsed ? '12px 8px' : '12px' }} extra={<Button type="text" size="small" icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setSidebarCollapsed(!sidebarCollapsed)} />}>
                  {!sidebarCollapsed && <Menu mode="inline" selectedKeys={[selectedProjectType]} style={{ border: 'none' }} items={PROJECT_TYPES.map(t => ({ key: t, label: t, onClick: () => setSelectedProjectType(t) }))} />}
                </Card></Col>
                <Col span={sidebarCollapsed ? 23 : 20}><Card>
                  <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}><Col><h2 style={{ margin: 0 }}>{selectedProjectType} - 计划配置</h2><p style={{ margin: '8px 0 0', color: '#666' }}>配置和管理项目计划模板</p></Col></Row>
                  <Tabs activeKey={planLevel} onChange={setPlanLevel} style={{ marginBottom: 24 }} items={[{ key: 'level1', label: '一级计划' }, { key: 'level2', label: '二级计划' }]} />
                  {planLevel === 'level2' && (<div style={{ marginBottom: 24, padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}><Space wrap><span style={{ color: '#666' }}>模板类型:</span>{allPlanTypes.map(t => <Tag key={t} color={selectedPlanType === t ? 'blue' : 'default'} style={{ cursor: 'pointer' }} onClick={() => setSelectedPlanType(t)}>{t}</Tag>)}<Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setShowAddCustomType(true)}>添加类型</Button></Space></div>)}
                  <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}><Col><Space><span style={{ color: '#666' }}>版本:</span><Select value={currentVersion} onChange={(val) => { setCurrentVersion(val); setIsEditMode(false) }} style={{ width: 180 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select>{renderActionButtons()}</Space></Col><Col><Space><Input placeholder="搜索任务..." prefix={<SearchOutlined />} style={{ width: 200 }} onChange={(e) => setSearchText(e.target.value)} /><Button icon={<AppstoreOutlined />} onClick={() => setShowColumnModal(true)}>自定义列</Button></Space></Col></Row>
                  {viewMode === 'gantt' ? renderGanttChart() : renderTaskTable()}
                </Card></Col>
              </Row>
            )}
          </div>
          <Modal title="自定义列" open={showColumnModal} onCancel={() => setShowColumnModal(false)} footer={[<Button key="reset" onClick={() => setVisibleColumns(ALL_COLUMNS.filter(c => c.default).map(c => c.key))}>重置</Button>, <Button key="cancel" onClick={() => setShowColumnModal(false)}>取消</Button>, <Button key="ok" type="primary" onClick={() => { setShowColumnModal(false); message.success('列配置已保存') }}>确定</Button>]}><Checkbox.Group value={visibleColumns} onChange={(vals) => setVisibleColumns(vals as string[])}><Row><Col span={12}>{ALL_COLUMNS.slice(0, 6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col><Col span={12}>{ALL_COLUMNS.slice(6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col></Row></Checkbox.Group></Modal>
          <Modal title="历史版本对比" open={showVersionCompare} onCancel={() => setShowVersionCompare(false)} footer={<Button type="primary" onClick={() => setShowVersionCompare(false)}>关闭</Button>} width={600}><Space direction="vertical" style={{ width: '100%' }}><div><span style={{ marginRight: 16 }}>版本A:</span><Select value={compareVersionA} onChange={setCompareVersionA} style={{ width: 200 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select></div><div><span style={{ marginRight: 16 }}>版本B:</span><Select value={compareVersionB} onChange={setCompareVersionB} style={{ width: 200 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select></div><Button type="primary" onClick={() => {
                const versionA = versions.find(v => v.id === compareVersionA)
                const versionB = versions.find(v => v.id === compareVersionB)
                if (versionA && versionB) {
                  const oldTasks = versionA.status === '已发布' ? LEVEL1_TASKS : []
                  const newTasks = versionB.status === '已发布' ? LEVEL1_TASKS : tasks
                  // 使用类型断言绕过类型检查（数据实际是字符串日期）
                  const result = compareVersions(oldTasks as any, newTasks as any)
                  setCompareResult(result)
                  message.success('对比完成')
                }
              }}>开始对比</Button>{renderVersionCompareResult()}</Space></Modal>
          <Modal 
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
          <Modal 
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
          <Modal title={`编辑时间 - ${ganttEditingTask?.taskName}`} open={!!ganttEditingTask} onCancel={() => setGanttEditingTask(null)} onOk={() => setGanttEditingTask(null)}><Space direction="vertical" style={{ width: '100%' }}><div><span>开始时间:</span><DatePicker value={ganttEditingTask?.planStartDate ? { format: 'YYYY-MM-DD', value: ganttEditingTask.planStartDate } : undefined} onChange={(date, dateStr) => dateStr && handleGanttTimeChange(ganttEditingTask.id, 'planStartDate', dateStr)} style={{ marginLeft: 8 }} /></div><div><span>结束时间:</span><DatePicker value={ganttEditingTask?.planEndDate ? { format: 'YYYY-MM-DD', value: ganttEditingTask.planEndDate } : undefined} onChange={(date, dateStr) => dateStr && handleGanttTimeChange(ganttEditingTask.id, 'planEndDate', dateStr)} style={{ marginLeft: 8 }} /></div></Space></Modal>
          <Modal title={`编辑进度 - ${progressEditingTask?.taskName}`} open={!!progressEditingTask} onCancel={() => setProgressEditingTask(null)} onOk={() => setProgressEditingTask(null)} footer={null}>
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
          <Modal 
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
          <Modal
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
          <Modal
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
                    ? '自定义计划' 
                    : selectedLevel2PlanType
                
                // 添加到已创建的二级计划列表
                const newPlan = {
                  id: `plan_${Date.now()}`,
                  name: planName,
                  type: selectedLevel2PlanType
                }
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
              {/* 需求开发计划 - 无额外参数 */}
              
              {/* 在研版本火车计划 - 无额外参数 */}
              
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
                  <Form.Item label="产品线">
                    <Input placeholder="自动获取项目基础信息" disabled defaultValue="NOTE" />
                  </Form.Item>
                  <Form.Item label="市场名">
                    <Input placeholder="自动获取该计划所属市场" disabled defaultValue="NOTE 50 Pro" />
                  </Form.Item>
                  <Form.Item label="项目名称">
                    <Input placeholder="自动获取项目基础信息" disabled defaultValue="X6855" />
                  </Form.Item>
                  <Form.Item label="芯片厂商">
                    <Input placeholder="自动获取项目基础信息" disabled defaultValue="MT6789J" />
                  </Form.Item>
                  <Form.Item label="tOS-市场版本号">
                    <Input placeholder="请输入tOS-市场版本号" />
                  </Form.Item>
                  <Form.Item label="分支信息">
                    <Input placeholder="请输入分支信息" />
                  </Form.Item>
                  <Form.Item label="是否MADA">
                    <Select placeholder="请选择" style={{ width: '100%' }}>
                      <Option value="是">是</Option>
                      <Option value="否">否</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="MADA市场">
                    <Input placeholder="请输入MADA市场" />
                  </Form.Item>
                  <Form.Item label="项目SPM">
                    <Select placeholder="请选择SPM" style={{ width: '100%' }}>
                      <Option value="李白">李白</Option>
                      <Option value="张三">张三</Option>
                      <Option value="李四">李四</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="项目TPM">
                    <Select placeholder="请选择TPM" style={{ width: '100%' }}>
                      <Option value="王五">王五</Option>
                      <Option value="赵六">赵六</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="对接人">
                    <Select placeholder="请选择对接人" style={{ width: '100%' }}>
                      <Option value="孙七">孙七</Option>
                      <Option value="周八">周八</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="项目版本号">
                    <Input placeholder="请输入项目版本号" />
                  </Form.Item>
                  <Form.Item label="1+N转测类型">
                    <Select placeholder="请选择转测类型" style={{ width: '100%' }}>
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
                        ? '' 
                        : selectedLevel2PlanType
                  } 
                  disabled={selectedLevel2PlanType !== '无'} 
                />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  )
}
