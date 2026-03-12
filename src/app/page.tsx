'use client'

import { useState, useMemo, useEffect, useRef, createContext, useContext, type CSSProperties } from 'react'
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
  Statistic,
  ConfigProvider,
  Descriptions,
  Divider,
  Radio
} from 'antd'
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
  FlagOutlined
} from '@ant-design/icons'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { compareVersions } from '@/lib/versionCompare'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnsType } from 'antd/es/table'
import RequirementDevPlan from '@/components/plans/RequirementDevPlan'
import VersionTrainPlan from '@/components/plans/VersionTrainPlan'
import RoadmapView from '@/components/roadmap/RoadmapView'

const { TabPane } = Tabs
const { Option } = Select
const { RangePicker } = DatePicker
const { TextArea } = Input

// 项目类型选项
const PROJECT_TYPES = ['整机产品项目', '产品项目', '技术项目', '能力建设项目']
// 可在创建二级计划时选择的类型（不含固定类型）
const LEVEL2_PLAN_TYPES = ['1+N MR版本火车计划', '粉丝版本计划', '基础体验计划', 'WBS计划']
// 固定二级计划（始终显示在前两位，不可删除）
const FIXED_LEVEL2_PLANS = [
  { id: 'plan0', name: '需求开发计划', type: '需求开发计划', fixed: true },
  { id: 'plan1', name: '在研版本火车计划', type: '在研版本火车计划', fixed: true },
]

// 项目数据
const initialProjects = [
  { id: '1', name: 'X6877-D8400_H991', type: '整机产品项目', status: '进行中', progress: 65, leader: '张三', markets: ['OP', 'TR', 'RU'], androidVersion: 'Android 16', chipPlatform: 'MTK', spm: '李白', updatedAt: '2小时前', productLine: '高端系列', tosVersion: 'tOS 16.3' },
  { id: '2', name: 'X6801_TBD', type: '产品项目', status: '筹备中', progress: 20, leader: '李四', markets: [], androidVersion: 'Android 16', chipPlatform: 'QCOM', spm: '张三', updatedAt: '1天前', productLine: '中端系列', tosVersion: 'tOS 16.2' },
  { id: '3', name: 'X6855_H8917', type: '整机产品项目', status: '进行中', progress: 45, leader: '王五', markets: ['OP', 'TR'], androidVersion: 'Android 16', chipPlatform: 'MTK', spm: '赵六', updatedAt: '3天前', productLine: '高端系列', tosVersion: 'tOS 16.3' },
  { id: '4', name: 'X6876_H786', type: '技术项目', status: '已完成', progress: 100, leader: '孙七', markets: [], androidVersion: 'Android 15', chipPlatform: 'QCOM', spm: '李四', updatedAt: '5天前', productLine: '平台技术', tosVersion: 'tOS 15.0' },
  { id: '5', name: 'X6873_H972', type: '能力建设项目', status: '进行中', progress: 30, leader: '周八', markets: [], androidVersion: 'Android 16', chipPlatform: 'UNISOC', spm: '王五', updatedAt: '1周前', productLine: '基础能力', tosVersion: 'tOS 16.2' },
]

const kanbanColumns = [
  { title: '概念阶段', key: 'concept', color: '#1890ff' },
  { title: '计划阶段', key: 'planning', color: '#52c41a' },
  { title: '开发阶段', key: 'developing', color: '#faad14' },
  { title: '发布阶段', key: 'released', color: '#722ed1' },
]

const initialTodos = [
  { id: '1', title: '[X6877-D8400_H991] V2(修订版) - 计划阶段任务待处理', priority: 'high', deadline: '2026-03-10', status: '进行中', projectId: '1', versionId: 'v2' },
  { id: '2', title: '[X6855_H8917] V2(修订版) - STR2 任务审核', priority: 'medium', deadline: '2026-03-15', status: '待处理', projectId: '3', versionId: 'v2' },
  { id: '3', title: '[X6877-D8400_H991] V2(修订版) - 开发验证阶段安排', priority: 'low', deadline: '2026-03-20', status: '待处理', projectId: '1', versionId: 'v2' },
]

const VERSION_DATA = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '修订中' },
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
  const [projects] = useState(initialProjects)
  const [todos] = useState(initialTodos)
  const [selectedProject, setSelectedProject] = useState<typeof initialProjects[0] | null>(null)
  
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
  
  // 带编辑保护的导航函数 - 如果当前在编辑模式，弹出确认框
  const navigateWithEditGuard = (action: () => void) => {
    if (isEditMode) {
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
  const filteredProjects = projects.filter(p => {
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
    const statusColor = project.status === '进行中' ? '#1890ff' : project.status === '已完成' ? '#52c41a' : '#faad14'
    const statusTagColor = project.status === '进行中' ? 'processing' : project.status === '已完成' ? 'success' : 'warning'
    return (
      <Card
        hoverable
        className="pms-card-hover"
        style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
        styles={{ body: { padding: '16px 20px' } }}
        onClick={() => { setSelectedProject(project); setActiveModule('projectSpace') }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#262626', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
            <Space size={4}>
              <Tag color="default" style={{ fontSize: 11, borderRadius: 3, margin: 0 }}>{project.type}</Tag>
              {project.type === '整机产品项目' && project.markets && project.markets.length > 0 && (
                <Tag color="blue" style={{ fontSize: 11, borderRadius: 3, margin: 0 }}>{project.markets.join(' / ')}</Tag>
              )}
            </Space>
          </div>
          <Tag color={statusTagColor} style={{ margin: 0, borderRadius: 4, flexShrink: 0 }}>{project.status}</Tag>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#bfbfbf' }}>Android</span> <span style={{ color: '#595959', fontWeight: 500 }}>{project.androidVersion.replace('Android ', '')}</span>
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#bfbfbf' }}>芯片</span> <span style={{ color: '#595959', fontWeight: 500 }}>{project.chipPlatform}</span>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>进度</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{project.progress}%</span>
          </div>
          <Progress percent={project.progress} size="small" showInfo={false} strokeColor={statusColor} trailColor="#f0f0f0" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={6}>
            <Avatar size={20} style={{ background: statusColor, fontSize: 10 }}>{project.spm[0]}</Avatar>
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
                {projects.filter(getKanbanFilter(col)).map(project => (
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

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {todos.map(todo => {
          const pc = priorityConfig[todo.priority] || priorityConfig.low
          return (
            <div
              key={todo.id}
              style={{
                padding: '12px 14px',
                background: '#fff',
                borderRadius: 6,
                border: '1px solid #f0f0f0',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d9d9d9'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f0f0f0'; e.currentTarget.style.boxShadow = 'none' }}
              onClick={() => { const proj = projects.find(p => p.id === todo.projectId); if (proj) { setSelectedProject(proj); setActiveModule('projectSpace'); setProjectSpaceModule('plan'); setCurrentVersion(todo.versionId || 'v2') } }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: pc.dotColor, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#262626', lineHeight: 1.5, marginBottom: 6 }}>{todo.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                      <Tag color={pc.color} style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>{pc.text}</Tag>
                      <Tag color={todo.status === '进行中' ? 'processing' : 'default'} style={{ fontSize: 10, borderRadius: 3, margin: 0, lineHeight: '16px', padding: '0 4px' }}>{todo.status}</Tag>
                    </Space>
                    <span style={{ fontSize: 11, color: '#bfbfbf' }}>{todo.deadline}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
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
    // 横版表格：表头在左侧第一列，阶段=父活动，里程碑=子活动，阶段按里程碑数量合并
    const stages = tasks.filter((t: any) => !t.parentId).sort((a: any, b: any) => a.order - b.order)
    const calcDays = (start: string, end: string) => {
      if (!start || !end) return '-'
      const s = new Date(start), e = new Date(end)
      const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
      return diff > 0 ? `${diff}天` : '-'
    }

    // 构建列数据：每个阶段下的里程碑（子活动），无子活动则阶段自身占一列
    const stageGroups = stages.map((stage: any) => {
      const milestones = tasks.filter((t: any) => t.parentId === stage.id).sort((a: any, b: any) => a.order - b.order)
      return { stage, milestones, colSpan: milestones.length || 1 }
    })

    const thStyle: CSSProperties = { background: '#fafbfc', fontWeight: 600, fontSize: 13, color: '#595959', padding: '10px 12px', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, minWidth: 120 }
    const tdStyle: CSSProperties = { padding: '8px 12px', fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap', minWidth: 110 }
    const stageTdStyle: CSSProperties = { ...tdStyle, fontWeight: 600, background: '#f5f7fa', borderBottom: '2px solid #f0f0f0' }

    return (
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #f0f0f0' }}>
          <tbody>
            {/* 阶段行：按里程碑数量合并 */}
            <tr>
              <th style={thStyle}>阶段</th>
              {stageGroups.map(({ stage, colSpan }) => (
                <td key={stage.id} colSpan={colSpan} style={stageTdStyle}>{stage.taskName}</td>
              ))}
            </tr>
            {/* 里程碑行 */}
            <tr>
              <th style={thStyle}>里程碑</th>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <td key={m.id} style={tdStyle}>{m.taskName}</td>)
                  : [<td key={stage.id} style={{ ...tdStyle, color: '#bfbfbf' }}>-</td>]
              )}
            </tr>
            {/* 计划开始时间 */}
            <tr>
              <th style={thStyle}>计划开始时间</th>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <td key={m.id} style={tdStyle}>{m.planStartDate || '-'}</td>)
                  : [<td key={stage.id} style={tdStyle}>{stage.planStartDate || '-'}</td>]
              )}
            </tr>
            {/* 计划完成时间 */}
            <tr>
              <th style={thStyle}>计划完成时间</th>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <td key={m.id} style={tdStyle}>{m.planEndDate || '-'}</td>)
                  : [<td key={stage.id} style={tdStyle}>{stage.planEndDate || '-'}</td>]
              )}
            </tr>
            {/* 计划时间周期 */}
            <tr>
              <th style={thStyle}>计划时间周期</th>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <td key={m.id} style={tdStyle}>{calcDays(m.planStartDate, m.planEndDate)}</td>)
                  : [<td key={stage.id} style={tdStyle}>{calcDays(stage.planStartDate, stage.planEndDate)}</td>]
              )}
            </tr>
            {/* 实际开始时间 */}
            <tr>
              <th style={thStyle}>实际开始时间</th>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <td key={m.id} style={tdStyle}>{m.actualStartDate || '-'}</td>)
                  : [<td key={stage.id} style={tdStyle}>{stage.actualStartDate || '-'}</td>]
              )}
            </tr>
            {/* 实际完成时间 */}
            <tr>
              <th style={thStyle}>实际完成时间</th>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <td key={m.id} style={tdStyle}>{m.actualEndDate || '-'}</td>)
                  : [<td key={stage.id} style={tdStyle}>{stage.actualEndDate || '-'}</td>]
              )}
            </tr>
            {/* 实际时间周期 */}
            <tr>
              <th style={thStyle}>实际时间周期</th>
              {stageGroups.flatMap(({ stage, milestones }) =>
                milestones.length > 0
                  ? milestones.map((m: any) => <td key={m.id} style={tdStyle}>{calcDays(m.actualStartDate, m.actualEndDate)}</td>)
                  : [<td key={stage.id} style={tdStyle}>{calcDays(stage.actualStartDate, stage.actualEndDate)}</td>]
              )}
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
    
    if (isEditMode) return (<Space><Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{currentVersionData?.versionNo}({currentVersionData?.status})</Tag><Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button><Button onClick={() => { setIsEditMode(false); message.info('已取消编辑') }}>取消</Button></Space>)
    return (<Space>{!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRevision}>创建修订</Button>}{isCurrentDraft && <Button icon={<EditOutlined />} onClick={() => setIsEditMode(true)}>编辑</Button>}{isCurrentDraft && <Button type="primary" icon={<SaveOutlined />} onClick={handlePublish}>发布</Button>}<Button icon={<HistoryOutlined />} onClick={() => setShowVersionCompare(true)}>历史版本对比</Button></Space>)
  }

  const renderVersionCompareResult = () => {
    if (compareResult.length === 0) {
      return <div style={{ textAlign: 'center', padding: 32, color: '#bfbfbf' }}><HistoryOutlined style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />请选择两个版本点击"开始对比"</div>
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
      <Card style={{ borderRadius: 8, textAlign: 'center', padding: '48px 0' }}>
        <Empty description={<span style={{ color: '#8c8c8c' }}>需求模块开发中...</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }

  // 项目空间-基础信息
  const renderProjectBasicInfo = () => {
    const markets = selectedProject?.markets || ['OP', 'TR', 'RU']
    const isWholeMachine = selectedProject?.type === '整机产品项目'

    const sectionTitleStyle: CSSProperties = {
      fontSize: 13,
      fontWeight: 600,
      color: '#8c8c8c',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      marginBottom: 12,
      paddingBottom: 8,
      borderBottom: '1px solid #f0f0f0',
    }

    const descLabelStyle: CSSProperties = {
      fontWeight: 500,
      color: '#8c8c8c',
      fontSize: 13,
      background: '#fafbfc',
    }
    const descContentStyle: CSSProperties = {
      color: '#262626',
      fontSize: 13,
    }

    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 项目概要卡片 */}
        <Card
          style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden' }}
          styles={{
            header: { background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', borderBottom: 'none', padding: '16px 24px' },
            body: { padding: 0 },
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ProjectOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>NOTE 50 Pro</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>X6855 · MT6789J · XOS16.2.0</div>
              </div>
            </div>
          }
          extra={
            <Space size={8}>
              <Tag color="gold" style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>待立项</Tag>
              <Tag style={{ margin: 0, borderRadius: 4, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}>等级 A</Tag>
            </Space>
          }
        >
          {/* 关键信息摘要行 */}
          <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #f0f0f0' }}>
            {[
              { label: '产品线', value: 'NOTE' },
              { label: '合作形式', value: 'ODC' },
              { label: '安卓版本', value: '16 (W)' },
              { label: '主板名', value: 'H8917' },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 20px', borderRight: i < 3 ? '1px solid #f0f0f0' : 'none', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: '#262626', fontWeight: 600 }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* 详细信息 */}
          <div style={{ padding: '20px 24px' }}>
            <Row gutter={[48, 16]}>
              <Col span={12}>
                <div style={sectionTitleStyle}>项目信息</div>
                <Row gutter={[16, 10]}>
                  {[
                    { label: '项目名', value: 'X6855' },
                    { label: '芯片', value: 'MT6789J (G100 Ultimate)' },
                    { label: 'OS版本', value: 'XOS16.2.0' },
                    { label: '市场名', value: 'NOTE 50 Pro' },
                  ].map((item, i) => (
                    <Col span={12} key={i}>
                      <div style={{ display: 'flex', lineHeight: '28px' }}>
                        <span style={{ color: '#8c8c8c', fontSize: 13, minWidth: 70, flexShrink: 0 }}>{item.label}</span>
                        <span style={{ color: '#262626', fontSize: 13, fontWeight: 500 }}>{item.value}</span>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Col>
              <Col span={12}>
                <div style={sectionTitleStyle}>团队成员</div>
                <Row gutter={[16, 12]}>
                  {[
                    { role: 'PPM', name: '李莲秋', color: '#87d068' },
                    { role: 'SPM', name: '曾晓寅', color: '#1890ff' },
                  ].map((member, i) => (
                    <Col span={12} key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                        <Avatar size={32} style={{ background: member.color, fontSize: 14, flexShrink: 0 }}>{member.name[0]}</Avatar>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#262626', lineHeight: 1.3 }}>{member.name}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{member.role}</div>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Col>
            </Row>
          </div>
        </Card>

        {/* 市场项目信息 */}
        {isWholeMachine && (
          <Card
            style={{ borderRadius: 8 }}
            styles={{
              header: { background: '#fafbfc', borderBottom: '2px solid #52c41a', padding: '12px 24px' },
              body: { padding: '4px 0 0 0' },
            }}
            title={
              <Space size={8}>
                <TeamOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>市场项目信息</span>
                <Tag color="default" style={{ marginLeft: 4, fontSize: 11 }}>{markets.length} 个市场</Tag>
              </Space>
            }
          >
            <Tabs
              activeKey={selectedMarketTab}
              onChange={setSelectedMarketTab}
              type="card"
              style={{ padding: '0 16px' }}
              items={markets.map(m => {
                const marketColor = m === 'OP' ? '#1890ff' : m === 'TR' ? '#52c41a' : '#faad14'
                return {
                  key: m,
                  label: <Space size={6}><Badge color={marketColor} /><span style={{ fontWeight: 500 }}>{m}</span></Space>,
                  children: (
                    <div style={{ padding: '8px 8px 16px' }}>
                      {/* 市场基础信息 */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ ...sectionTitleStyle, color: '#1890ff', borderBottomColor: '#e6f4ff' }}>市场项目基础信息</div>
                        <Descriptions
                          bordered
                          size="small"
                          column={{ xs: 1, sm: 2, md: 3 }}
                          labelStyle={descLabelStyle}
                          contentStyle={descContentStyle}
                        >
                          <Descriptions.Item label="市场项目名"><span style={{ fontWeight: 500 }}>{`X6855-${m}`}</span></Descriptions.Item>
                          <Descriptions.Item label="编译选项"><code style={{ padding: '1px 6px', background: '#f5f5f5', borderRadius: 3, fontSize: 12 }}>x6855</code></Descriptions.Item>
                          <Descriptions.Item label="运营商定制"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="市场名称">{`${m} Market`}</Descriptions.Item>
                          <Descriptions.Item label="编译市场"><code style={{ padding: '1px 6px', background: '#f5f5f5', borderRadius: 3, fontSize: 12 }}>{m.toLowerCase()}</code></Descriptions.Item>
                          <Descriptions.Item label="是否锁卡"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="内存"><span style={{ fontWeight: 500 }}>8GB</span></Descriptions.Item>
                          <Descriptions.Item label="软件项目等级"><Tag color="blue">A</Tag></Descriptions.Item>
                          <Descriptions.Item label="是否保密"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="SQA审计策略"><Tag color="blue">全审</Tag></Descriptions.Item>
                          <Descriptions.Item label="是否支持VILTE"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="运营商版本标识">-</Descriptions.Item>
                          <Descriptions.Item label="BOM"><span style={{ fontWeight: 500 }}>BOM-001</span></Descriptions.Item>
                          <Descriptions.Item label="软件版本号"><span style={{ fontWeight: 500 }}>XOS16.2.0</span></Descriptions.Item>
                          <Descriptions.Item label="备注">-</Descriptions.Item>
                          <Descriptions.Item label="是否取消暂停"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="取消暂停时间">-</Descriptions.Item>
                        </Descriptions>
                      </div>

                      {/* 市场维护信息 */}
                      <div>
                        <div style={{ ...sectionTitleStyle, color: '#52c41a', borderBottomColor: '#f6ffed' }}>市场项目维护信息</div>
                        <Descriptions
                          bordered
                          size="small"
                          column={{ xs: 1, sm: 2, md: 3 }}
                          labelStyle={descLabelStyle}
                          contentStyle={descContentStyle}
                        >
                          <Descriptions.Item label="维护类型"><Tag color="processing">常规维护</Tag></Descriptions.Item>
                          <Descriptions.Item label="维护原因">版本升级</Descriptions.Item>
                          <Descriptions.Item label="已触发MADA"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="维护周期"><span style={{ fontWeight: 500 }}>6个月</span></Descriptions.Item>
                          <Descriptions.Item label="Launch Date"><CalendarOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />2026-06-01</Descriptions.Item>
                          <Descriptions.Item label="EOS"><CalendarOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />2028-06-01</Descriptions.Item>
                          <Descriptions.Item label="是否转维护组"><Tag color="default">否</Tag></Descriptions.Item>
                          <Descriptions.Item label="是否MADA管控"><Tag color="default">否</Tag></Descriptions.Item>
                        </Descriptions>
                      </div>
                    </div>
                  ),
                }
              })}
            />
          </Card>
        )}
      </div>
    )
  }

  // renderRequirementDevelopmentPlan 已移至 RequirementDevPlan 独立组件

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

        {/* 二级计划元数据展示 - 非固定计划显示创建时填写的信息 */}
        {projectPlanLevel === 'level2' && activeLevel2Plan !== 'plan0' && activeLevel2Plan !== 'plan1' && level2PlanMeta[activeLevel2Plan] && (
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
            {level2PlanMeta[activeLevel2Plan]?.planType === '1+N MR版本火车计划' ? (
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
                <Descriptions.Item label="产品线">{level2PlanMeta[activeLevel2Plan]?.productLine || '-'}</Descriptions.Item>
                <Descriptions.Item label="市场名">{level2PlanMeta[activeLevel2Plan]?.marketName || '-'}</Descriptions.Item>
                <Descriptions.Item label="项目名称">{level2PlanMeta[activeLevel2Plan]?.projectName || '-'}</Descriptions.Item>
                <Descriptions.Item label="芯片厂商">{level2PlanMeta[activeLevel2Plan]?.chipVendor || '-'}</Descriptions.Item>
                <Descriptions.Item label="tOS-市场版本号">
                  {level2PlanMeta[activeLevel2Plan]?.tosVersion ? <Tag color="cyan">{level2PlanMeta[activeLevel2Plan].tosVersion}</Tag> : '-'}
                </Descriptions.Item>
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
                <Descriptions.Item label="1+N转测类型">
                  {level2PlanMeta[activeLevel2Plan]?.transferType ? <Tag color="orange">{level2PlanMeta[activeLevel2Plan].transferType}</Tag> : '-'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Descriptions
                size="small"
                column={3}
                labelStyle={{ color: '#8c8c8c', fontSize: 13, fontWeight: 500, padding: '6px 12px 6px 0' }}
                contentStyle={{ color: '#262626', fontSize: 13, padding: '6px 0' }}
                colon={false}
              >
                <Descriptions.Item label="计划类型">{level2PlanMeta[activeLevel2Plan]?.planType || '-'}</Descriptions.Item>
                <Descriptions.Item label="计划名称">{level2PlanMeta[activeLevel2Plan]?.planName || '-'}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        )}

        {/* 需求开发计划 - 专用组件 */}
        {projectPlanLevel === 'level2' && activeLevel2Plan === 'plan0' && <RequirementDevPlan />}

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
                {isEditMode ? (
                  <Space size={8}>
                    <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 4, fontWeight: 500 }}>{currentVersionData?.versionNo} ({currentVersionData?.status})</Tag>
                    <Button type="primary" icon={<SaveOutlined />} style={{ borderRadius: 6 }} onClick={() => { setIsEditMode(false); message.success('保存成功') }}>保存</Button>
                    <Button style={{ borderRadius: 6 }} onClick={() => { setIsEditMode(false); message.info('已取消编辑') }}>取消</Button>
                  </Space>
                ) : (
                  <Space size={8} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                    <Space size={6}>
                      <span style={{ color: '#8c8c8c', fontSize: 13 }}>版本</span>
                      <Select value={currentVersion} onChange={(val) => navigateWithEditGuard(() => { setCurrentVersion(val); setIsEditMode(false) })} style={{ width: 150 }} size="middle">
                        {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo} ({v.status})</Option>)}
                      </Select>
                    </Space>
                    <Space size={6}>
                      {!hasDraftVersion && <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 6 }} onClick={handleCreateRevision}>创建修订</Button>}
                      {isCurrentDraft && <Button icon={<EditOutlined />} style={{ borderRadius: 6 }} onClick={() => setIsEditMode(true)}>编辑</Button>}
                      {isCurrentDraft && <Button type="primary" icon={<SaveOutlined />} style={{ borderRadius: 6 }} onClick={handlePublish}>发布</Button>}
                      <Button icon={<HistoryOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowVersionCompare(true)}>版本对比</Button>
                    </Space>
                  </Space>
                )}
              </Col>
              <Col>
                <Space size={6}>
                  <Input placeholder="搜索任务..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear onChange={(e) => setSearchText(e.target.value)} />
                  <Tooltip title="自定义列">
                    <Button icon={<AppstoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
                  </Tooltip>
                  <Radio.Group
                    value={projectPlanViewMode}
                    onChange={(e) => setProjectPlanViewMode(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    size="small"
                    options={[
                      { label: '竖版表格', value: 'table' },
                      { label: '横版表格', value: 'horizontal' },
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
      <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        {/* 顶部导航栏 */}
        <div style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <Row align="middle" style={{ height: 56 }}>
            <Col flex="none">
              <Button type="text" icon={<LeftOutlined />} onClick={() => navigateWithEditGuard(() => setActiveModule('projects'))} style={{ color: '#595959', fontWeight: 500 }}>返回工作台</Button>
            </Col>
            <Col flex="auto" style={{ textAlign: 'center' }}>
              <div ref={projectSearchRef} style={{ display: 'inline-block', position: 'relative' }}>
                <div
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 6, transition: 'background 0.2s', background: showProjectSearch ? '#f0f5ff' : 'transparent' }}
                  onClick={() => setShowProjectSearch(!showProjectSearch)}
                >
                  <ProjectOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#262626' }}>{selectedProject?.name}</span>
                  <DownOutlined style={{ fontSize: 10, color: '#8c8c8c', transition: 'transform 0.2s', transform: showProjectSearch ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>项目空间</Tag>
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
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
          {/* 侧边导航 */}
          <div className="pms-sidebar" style={{ width: 200, background: '#fff', borderRight: '1px solid #f0f0f0', paddingTop: 8 }}>
            <Menu
              mode="inline"
              selectedKeys={[projectSpaceModule]}
              style={{ border: 'none', fontSize: 13 }}
              items={menuItems.map(item => ({
                ...item,
                label: <span style={{ fontWeight: projectSpaceModule === item.key ? 500 : 400 }}>{item.label}</span>,
              }))}
              onClick={({ key }) => navigateWithEditGuard(() => setProjectSpaceModule(key))}
            />
          </div>
          {/* 内容区域 */}
          <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
            {projectSpaceModule === 'basic' && renderProjectBasicInfo()}
            {projectSpaceModule === 'plan' && renderProjectPlan()}
            {projectSpaceModule === 'overview' && renderProjectOverview()}
            {projectSpaceModule === 'requirements' && renderProjectRequirements()}
            {projectSpaceModule !== 'basic' && projectSpaceModule !== 'plan' && projectSpaceModule !== 'overview' && projectSpaceModule !== 'requirements' && (
              <Card style={{ borderRadius: 8, textAlign: 'center', padding: '40px 0' }}>
                <Empty description={<span style={{ color: '#8c8c8c' }}>{`${menuItems.find(m => m.key === projectSpaceModule)?.label}模块开发中...`}</span>} />
              </Card>
            )}
          </div>
        </div>
        {/* 版本对比Modal */}
        <Modal className="pms-modal" title="历史版本对比" open={showVersionCompare} onCancel={() => setShowVersionCompare(false)} footer={<Button type="primary" onClick={() => setShowVersionCompare(false)}>关闭</Button>} width={600}><Space direction="vertical" style={{ width: '100%' }}><div><span style={{ marginRight: 16 }}>版本A:</span><Select value={compareVersionA} onChange={setCompareVersionA} style={{ width: 200 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select></div><div><span style={{ marginRight: 16 }}>版本B:</span><Select value={compareVersionB} onChange={setCompareVersionB} style={{ width: 200 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select></div><Button type="primary" onClick={() => {
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
                  const result = compareVersions(oldTasks as any, newTasks as any)
                  setCompareResult(result)
                  message.success('对比完成')
                }
              }}>开始对比</Button>{renderVersionCompareResult()}</Space></Modal>
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
                  Object.assign(meta, {
                    mrVersion: selectedMRVersion,
                    productLine: selectedProject?.productLine || 'NOTE',
                    marketName: selectedProject?.type === '整机产品项目' ? selectedMarketTab : '-',
                    projectName: selectedProject?.name || '',
                    chipVendor: selectedProject?.chipPlatform || '',
                    tosVersion: createFormValues.tosVersion || '',
                    branch: createFormValues.branch || '',
                    isMada: createFormValues.isMada || '',
                    madaMarket: createFormValues.madaMarket || '',
                    spm: createFormValues.spm || '',
                    tpm: createFormValues.tpm || '',
                    contact: createFormValues.contact || '',
                    projectVersion: createFormValues.projectVersion || '',
                    transferType: createFormValues.transferType || '',
                  })
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
                  <Form.Item label="产品线"><Input placeholder="自动获取" disabled value={selectedProject?.productLine || 'NOTE'} /></Form.Item>
                  <Form.Item label="市场名"><Input placeholder="自动获取" disabled value={selectedProject?.type === '整机产品项目' ? selectedMarketTab : '-'} /></Form.Item>
                  <Form.Item label="项目名称"><Input placeholder="自动获取" disabled value={selectedProject?.name || ''} /></Form.Item>
                  <Form.Item label="芯片厂商"><Input placeholder="自动获取" disabled value={selectedProject?.chipPlatform || ''} /></Form.Item>
                  <Form.Item label="tOS-市场版本号"><Input placeholder="请输入tOS-市场版本号" value={createFormValues.tosVersion || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, tosVersion: e.target.value}))} /></Form.Item>
                  <Form.Item label="分支信息"><Input placeholder="请输入分支信息" value={createFormValues.branch || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, branch: e.target.value}))} /></Form.Item>
                  <Form.Item label="是否MADA"><Select placeholder="请选择" style={{ width: '100%' }} value={createFormValues.isMada} onChange={(val) => setCreateFormValues(prev => ({...prev, isMada: val}))}><Option value="是">是</Option><Option value="否">否</Option></Select></Form.Item>
                  <Form.Item label="MADA市场"><Input placeholder="请输入MADA市场" value={createFormValues.madaMarket || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, madaMarket: e.target.value}))} /></Form.Item>
                  <Form.Item label="项目SPM"><Select placeholder="请选择SPM" style={{ width: '100%' }} value={createFormValues.spm} onChange={(val) => setCreateFormValues(prev => ({...prev, spm: val}))}><Option value="李白">李白</Option><Option value="张三">张三</Option></Select></Form.Item>
                  <Form.Item label="项目TPM"><Select placeholder="请选择TPM" style={{ width: '100%' }} value={createFormValues.tpm} onChange={(val) => setCreateFormValues(prev => ({...prev, tpm: val}))}><Option value="王五">王五</Option><Option value="赵六">赵六</Option></Select></Form.Item>
                  <Form.Item label="对接人"><Select placeholder="请选择对接人" style={{ width: '100%' }} value={createFormValues.contact} onChange={(val) => setCreateFormValues(prev => ({...prev, contact: val}))}><Option value="孙七">孙七</Option><Option value="周八">周八</Option></Select></Form.Item>
                  <Form.Item label="项目版本号"><Input placeholder="请输入项目版本号" value={createFormValues.projectVersion || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, projectVersion: e.target.value}))} /></Form.Item>
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
          <div style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Row align="middle" justify="space-between" style={{ height: 56 }}>
              <Col>
                <Space size={32} align="center">
                  <Space size={8}>
                    <ProjectOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <span style={{ fontSize: 17, fontWeight: 700, color: '#262626', letterSpacing: -0.3 }}>项目管理系统</span>
                  </Space>
                  <Tabs
                    activeKey={activeModule}
                    onChange={(key) => navigateWithEditGuard(() => setActiveModule(key))}
                    style={{ marginBottom: 0 }}
                    items={[
                      { key: 'projects', label: <span style={{ fontWeight: 500, padding: '0 4px' }}>工作台</span> },
                      { key: 'roadmap', label: <span style={{ fontWeight: 500, padding: '0 4px' }}>项目路标视图</span> },
                      { key: 'config', label: <span style={{ fontWeight: 500, padding: '0 4px' }}>配置中心</span> },
                    ]}
                  />
                </Space>
              </Col>
              <Col>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #1890ff, #096dd9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>用</div>
              </Col>
            </Row>
          </div>
          <div style={{ padding: 24 }}>
            {activeModule === 'projects' && (
              <div style={{ display: 'flex', gap: 20 }}>
                {/* 左侧 - 项目列表 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 项目统计概览 */}
                  <Row gutter={16} style={{ marginBottom: 20 }}>
                    {[
                      { label: '全部项目', value: projects.length, color: '#1890ff', bg: '#e6f7ff' },
                      { label: '进行中', value: projects.filter(p => p.status === '进行中').length, color: '#1890ff', bg: '#e6f7ff' },
                      { label: '筹备中', value: projects.filter(p => p.status === '筹备中').length, color: '#faad14', bg: '#fff7e6' },
                      { label: '已完成', value: projects.filter(p => p.status === '已完成').length, color: '#52c41a', bg: '#f6ffed' },
                    ].map((stat, i) => (
                      <Col span={6} key={i}>
                        <div style={{ background: '#fff', borderRadius: 8, padding: '14px 16px', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</span>
                          </div>
                          <span style={{ fontSize: 13, color: '#8c8c8c' }}>{stat.label}</span>
                        </div>
                      </Col>
                    ))}
                  </Row>

                  {/* 项目卡片标题 */}
                  <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={8}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>项目列表</span>
                      <Tag color="default" style={{ fontSize: 11, borderRadius: 4 }}>{projects.length} 个</Tag>
                    </Space>
                    <Input placeholder="搜索项目..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} style={{ width: 200, borderRadius: 6 }} allowClear />
                  </div>

                  {/* 项目卡片网格 */}
                  <Row gutter={[16, 16]}>
                    {projects.map(p => (
                      <Col xs={24} sm={12} lg={todoCollapsed ? 6 : 8} key={p.id}>{renderProjectCard(p)}</Col>
                    ))}
                  </Row>
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
                      <Badge count={todos.length} size="small" style={{ marginBottom: 8 }} />
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
                          <Badge count={todos.length} style={{ backgroundColor: '#1890ff' }} size="small" />
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
            {(activeModule === 'config' || activeModule === 'projectSpace') && (
              <div>
                {/* 配置分类导航 */}
                <Card size="small" style={{ marginBottom: 20, borderRadius: 8 }} styles={{ body: { padding: '4px 16px' } }}>
                  <Tabs
                    activeKey="plan"
                    style={{ marginBottom: 0 }}
                    items={[
                      { key: 'plan', label: <Space size={6}><CalendarOutlined />计划模板配置</Space> },
                    ]}
                  />
                </Card>

                {/* 计划模板配置 */}
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
              </div>
            )}
          </div>
          <Modal className="pms-modal" title="自定义列" open={showColumnModal} onCancel={() => setShowColumnModal(false)} footer={[<Button key="reset" onClick={() => setVisibleColumns(ALL_COLUMNS.filter(c => c.default).map(c => c.key))}>重置</Button>, <Button key="cancel" onClick={() => setShowColumnModal(false)}>取消</Button>, <Button key="ok" type="primary" onClick={() => { setShowColumnModal(false); message.success('列配置已保存') }}>确定</Button>]}><Checkbox.Group value={visibleColumns} onChange={(vals) => setVisibleColumns(vals as string[])}><Row><Col span={12}>{ALL_COLUMNS.slice(0, 6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col><Col span={12}>{ALL_COLUMNS.slice(6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col></Row></Checkbox.Group></Modal>
          <Modal className="pms-modal" title="历史版本对比" open={showVersionCompare} onCancel={() => setShowVersionCompare(false)} footer={<Button type="primary" onClick={() => setShowVersionCompare(false)}>关闭</Button>} width={600}><Space direction="vertical" style={{ width: '100%' }}><div><span style={{ marginRight: 16 }}>版本A:</span><Select value={compareVersionA} onChange={setCompareVersionA} style={{ width: 200 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select></div><div><span style={{ marginRight: 16 }}>版本B:</span><Select value={compareVersionB} onChange={setCompareVersionB} style={{ width: 200 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select></div><Button type="primary" onClick={() => {
                const versionA = versions.find(v => v.id === compareVersionA)
                const versionB = versions.find(v => v.id === compareVersionB)
                if (versionA && versionB) {
                  // 根据版本号模拟不同版本数据
                  const vANum = parseInt(versionA.versionNo.replace('V', ''))
                  const vBNum = parseInt(versionB.versionNo.replace('V', ''))
                  const oldTasks = versionA.status === '已发布' ? LEVEL1_TASKS : tasks
                  // 为不同版本生成差异化数据
                  let newTasks = versionB.status === '已发布' ? LEVEL1_TASKS : tasks
                  if (vANum !== vBNum) {
                    // 模拟版本间差异：修改部分任务、新增/删除
                    newTasks = [
                      ...tasks.map(t => {
                        if (t.id === '2.1') return { ...t, taskName: 'STR2(更新)', status: '已完成', progress: 100 }
                        if (t.id === '3') return { ...t, responsible: '李四', planStartDate: '2026-02-20' }
                        return t
                      }),
                      { id: '5', order: 5, taskName: '维护', status: '未开始', progress: 0, responsible: '', predecessor: '4', planStartDate: '2026-04-16', planEndDate: '2026-05-15', estimatedDays: 30, actualStartDate: '', actualEndDate: '', actualDays: 0 }
                    ]
                  }
                  const result = compareVersions(oldTasks as any, newTasks as any)
                  setCompareResult(result)
                  message.success('对比完成')
                }
              }}>开始对比</Button>{renderVersionCompareResult()}</Space></Modal>
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
                  Object.assign(meta, {
                    mrVersion: selectedMRVersion,
                    productLine: selectedProject?.productLine || 'NOTE',
                    marketName: selectedProject?.type === '整机产品项目' ? selectedMarketTab : '-',
                    projectName: selectedProject?.name || '',
                    chipVendor: selectedProject?.chipPlatform || '',
                    tosVersion: createFormValues.tosVersion || '',
                    branch: createFormValues.branch || '',
                    isMada: createFormValues.isMada || '',
                    madaMarket: createFormValues.madaMarket || '',
                    spm: createFormValues.spm || '',
                    tpm: createFormValues.tpm || '',
                    contact: createFormValues.contact || '',
                    projectVersion: createFormValues.projectVersion || '',
                    transferType: createFormValues.transferType || '',
                  })
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
                  <Form.Item label="产品线">
                    <Input placeholder="自动获取项目基础信息" disabled value={selectedProject?.productLine || 'NOTE'} />
                  </Form.Item>
                  <Form.Item label="市场名">
                    <Input placeholder="自动获取该计划所属市场" disabled value={selectedProject?.type === '整机产品项目' ? selectedMarketTab : '-'} />
                  </Form.Item>
                  <Form.Item label="项目名称">
                    <Input placeholder="自动获取项目基础信息" disabled value={selectedProject?.name || ''} />
                  </Form.Item>
                  <Form.Item label="芯片厂商">
                    <Input placeholder="自动获取项目基础信息" disabled value={selectedProject?.chipPlatform || ''} />
                  </Form.Item>
                  <Form.Item label="tOS-市场版本号">
                    <Input placeholder="请输入tOS-市场版本号" value={createFormValues.tosVersion || ''} onChange={(e) => setCreateFormValues(prev => ({...prev, tosVersion: e.target.value}))} />
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
