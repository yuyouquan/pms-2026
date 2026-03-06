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
  Statistic,
  Alert
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  LeftOutlined,
  SettingOutlined,
  CalendarOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  WarningOutlined,
  BugOutlined,
  FolderOutlined,
  FileTextOutlined,
  SearchOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  HistoryOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useRouter, useParams } from 'next/navigation'
import dayjs from 'dayjs'

const { Option } = Select

// Mock数据
const initialProjects = [
  { id: '1', name: 'T5 AI Board', type: '硬件项目', status: '进行中', progress: 65, members: 8, startDate: '2026-01-01', endDate: '2026-12-31', description: 'T5 AI开发板项目' },
  { id: '2', name: 'TuyaOpen SDK', type: '软件开发', status: '进行中', progress: 80, members: 5, startDate: '2026-01-01', endDate: '2026-06-30', description: '涂鸦开放SDK' },
  { id: '3', name: 'Smart Home App', type: 'APP开发', status: '规划中', progress: 30, members: 4, startDate: '2026-03-01', endDate: '2026-12-31', description: '智能家居APP' },
  { id: '4', name: 'IoT Platform', type: '平台项目', status: '进行中', progress: 55, members: 12, startDate: '2025-10-01', endDate: '2026-09-30', description: 'IoT云平台升级' },
  { id: '5', name: 'AI Voice Assistant', type: 'AI项目', status: '已完成', progress: 100, members: 6, startDate: '2025-06-01', endDate: '2025-12-31', description: 'AI语音助手' },
]

const PROJECT_TYPES = ['硬件项目', '软件开发', 'APP开发', '平台项目', 'AI项目']

const LEVEL1_TASKS = [
  { id: '1', seq: 1, taskName: '需求分析', responsible: '张三', preTasks: '', planStartDate: '2026-01-01', planEndDate: '2026-01-15', estimatedDays: 15, actualStartDate: '2026-01-01', actualEndDate: '2026-01-14', actualDays: 14, status: '已完成', progress: 100 },
  { id: '2', seq: 2, taskName: '系统设计', responsible: '李四', preTasks: '需求分析', planStartDate: '2026-01-16', planEndDate: '2026-01-31', estimatedDays: 16, actualStartDate: '2026-01-15', actualEndDate: '2026-01-30', actualDays: 16, status: '已完成', progress: 100 },
  { id: '3', seq: 3, taskName: '开发实现', responsible: '王五', preTasks: '系统设计', planStartDate: '2026-02-01', planEndDate: '2026-03-15', estimatedDays: 43, actualStartDate: '2026-01-31', actualEndDate: '', actualDays: 0, status: '进行中', progress: 60 },
  { id: '4', seq: 4, taskName: '测试验证', responsible: '赵六', preTasks: '开发实现', planStartDate: '2026-03-16', planEndDate: '2026-04-15', estimatedDays: 31, actualStartDate: '', actualEndDate: '', actualDays: 0, status: '待开始', progress: 0 },
  { id: '5', seq: 5, taskName: '上线发布', responsible: '钱七', preTasks: '测试验证', planStartDate: '2026-04-16', planEndDate: '2026-04-30', estimatedDays: 15, actualStartDate: '', actualEndDate: '', actualDays: 0, status: '待开始', progress: 0 },
]

const LEVEL2_TASKS = [
  { id: '1', seq: 1, taskName: '详细设计', responsible: '李四', preTasks: '', planStartDate: '2026-01-16', planEndDate: '2026-01-20', estimatedDays: 5, actualStartDate: '2026-01-16', actualEndDate: '2026-01-19', actualDays: 4, status: '已完成', progress: 100 },
  { id: '2', seq: 2, taskName: 'API开发', responsible: '王五', preTasks: '详细设计', planStartDate: '2026-01-21', planEndDate: '2026-02-05', estimatedDays: 16, actualStartDate: '2026-01-20', actualEndDate: '2026-02-04', actualDays: 16, status: '已完成', progress: 100 },
  { id: '3', seq: 3, taskName: '前端开发', responsible: '孙八', preTasks: 'API开发', planStartDate: '2026-02-06', planEndDate: '2026-02-20', estimatedDays: 15, actualStartDate: '2026-02-05', actualEndDate: '', actualDays: 0, status: '进行中', progress: 70 },
  { id: '4', seq: 4, taskName: '集成测试', responsible: '赵六', preTasks: '前端开发', planStartDate: '2026-02-21', planEndDate: '2026-02-28', estimatedDays: 8, actualStartDate: '', actualEndDate: '', actualDays: 0, status: '待开始', progress: 0 },
]

const versions = [
  { id: 'v1', versionNo: 'V1', status: '已发布', createTime: '2026-01-15' },
  { id: 'v2', versionNo: 'V2', status: '修订中', createTime: '2026-03-01' },
]

const ALL_COLUMNS = [
  { key: 'seq', title: '序号', default: true },
  { key: 'taskName', title: '任务名称', default: true },
  { key: 'responsible', title: '责任人', default: true },
  { key: 'preTasks', title: '前置任务', default: true },
  { key: 'planStartDate', title: '计划开始', default: true },
  { key: 'planEndDate', title: '计划完成', default: true },
  { key: 'estimatedDays', title: '预估工期', default: true },
  { key: 'actualStartDate', title: '实际开始', default: true },
  { key: 'actualEndDate', title: '实际完成', default: true },
  { key: 'actualDays', title: '实际工期', default: true },
  { key: 'status', title: '状态', default: true },
  { key: 'progress', title: '进度', default: true },
]

export default function ProjectDetail() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const project = initialProjects.find(p => p.id === projectId)

  const [projectSpaceModule, setProjectSpaceModule] = useState('basic')
  const [tasks, setTasks] = useState(LEVEL1_TASKS)
  const [currentVersion, setCurrentVersion] = useState('v1')
  const [searchText, setSearchText] = useState('')
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [projectPlanViewMode, setProjectPlanViewMode] = useState<'table' | 'gantt'>('table')
  const [projectPlanLevel, setProjectPlanLevel] = useState<string>('level1')
  const [showVersionCompare, setShowVersionCompare] = useState(false)
  const [compareVersionA, setCompareVersionA] = useState('')
  const [compareVersionB, setCompareVersionB] = useState('')
  const [compareResult, setCompareResult] = useState<{added: string[], removed: string[], modified: string[]} | null>(null)
  const [createdLevel2Plans, setCreatedLevel2Plans] = useState<{id: string, name: string, type: string}[]>([
    { id: 'plan1', name: 'FR版本火车计划', type: 'FR版本火车计划' },
    { id: 'plan2', name: 'MR1版本火车计划', type: 'MR版本火车计划' },
    { id: 'plan3', name: 'MR2版本火车计划', type: 'MR版本火车计划' },
  ])
  const [activeLevel2Plan, setActiveLevel2Plan] = useState('plan1')
  const [showCreateLevel2Plan, setShowCreateLevel2Plan] = useState(false)
  const [newPlanType, setNewPlanType] = useState('FR版本火车计划')
  const [level2PlanTasks, setLevel2PlanTasks] = useState(LEVEL2_TASKS)
  const [level2PlanMilestones, setLevel2PlanMilestones] = useState<{id: string, name: string, date: string}[]>([])
  const [ganttEditingTask, setGanttEditingTask] = useState<typeof tasks[0] | null>(null)
  const [progressEditingTask, setProgressEditingTask] = useState<typeof tasks[0] | null>(null)
  const [parentTimeWarning, setParentTimeWarning] = useState<{visible: boolean, tasks: string[], message: string}>({visible: false, tasks: [], message: ''})

  const hasDraftVersion = useMemo(() => versions.some(v => v.status === '修订中'), [])
  const isCurrentDraft = useMemo(() => {
    const v = versions.find(v2 => v2.id === currentVersion)
    return v?.status === '修订中'
  }, [currentVersion])

  const filteredTasks = useMemo(() => {
    if (!searchText) return projectPlanLevel === 'level1' ? tasks : level2PlanTasks
    const search = searchText.toLowerCase()
    const data = projectPlanLevel === 'level1' ? tasks : level2PlanTasks
    return data.filter((task: typeof LEVEL1_TASKS[0]) => {
      const t = task as Record<string, unknown>
      return Object.values(t).some(val =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(search)
      )
    })
  }, [searchText, tasks, level2PlanTasks, projectPlanLevel])

  const columns: ColumnsType<typeof LEVEL1_TASKS[0]> = useMemo(() => {
    return ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => ({
      title: col.title,
      dataIndex: col.key,
      key: col.key,
      render: (text: unknown, record: typeof LEVEL1_TASKS[0]) => {
        if (col.key === 'seq') {
          return record.seq
        }
        if (col.key === 'status') {
          const statusMap: Record<string, { color: string; text: string }> = {
            '已完成': { color: 'green', text: '已完成' },
            '进行中': { color: 'blue', text: '进行中' },
            '待开始': { color: 'default', text: '待开始' },
            '已延期': { color: 'red', text: '已延期' },
          }
          const s = statusMap[String(text)] || { color: 'default', text: String(text) }
          return <Tag color={s.color}>{s.text}</Tag>
        }
        if (col.key === 'progress') {
          return <Progress percent={Number(text) || 0} size="small" />
        }
        return String(text ?? '')
      }
    }))
  }, [visibleColumns])

  const compareVersions = (oldTasks: typeof LEVEL1_TASKS, newTasks: typeof LEVEL1_TASKS) => {
    const oldIds = new Set(oldTasks.map(t => t.id))
    const newIds = new Set(newTasks.map(t => t.id))
    const added = newTasks.filter(t => !oldIds.has(t.id)).map(t => t.taskName)
    const removed = oldTasks.filter(t => !newIds.has(t.id)).map(t => t.taskName)
    const modified = newTasks.filter(t => {
      const old = oldTasks.find(o => o.id === t.id)
      return old && (old.taskName !== t.taskName || old.responsible !== t.responsible)
    }).map(t => t.taskName)
    return { added, removed, modified }
  }

  const renderVersionCompareResult = () => {
    if (!compareResult) return null
    return (
      <div style={{ marginTop: 16 }}>
        <Alert type="success" message={`新增: ${compareResult.added.join(', ') || '无'}`} style={{ marginBottom: 8 }} />
        <Alert type="error" message={`删除: ${compareResult.removed.join(', ') || '无'}`} style={{ marginBottom: 8 }} />
        <Alert type="warning" message={`修改: ${compareResult.modified.join(', ') || '无'}`} />
      </div>
    )
  }

  const handleCreateRevision = () => {
    const newVersion = { id: `v${versions.length + 1}`, versionNo: `V${versions.length + 1}`, status: '修订中', createTime: new Date().toISOString().split('T')[0] }
    setTasks([...tasks])
    message.success('创建修订版本成功')
  }

  const handlePublish = () => {
    setTasks([...tasks])
    message.success('版本发布成功')
  }

  const handleGanttTimeChange = (taskId: string, field: string, value: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t))
    setGanttEditingTask(null)
  }

  const renderProjectBasicInfo = () => {
    if (!project) return <Empty description="项目不存在" />
    return (
      <Card>
        <Row gutter={24}>
          <Col span={12}>
            <Statistic title="项目名称" value={project.name} />
          </Col>
          <Col span={12}>
            <Statistic title="项目类型" value={project.type} />
          </Col>
          <Col span={12} style={{ marginTop: 16 }}>
            <Statistic title="项目状态" value={project.status} />
          </Col>
          <Col span={12} style={{ marginTop: 16 }}>
            <Statistic title="项目进度" value={project.progress} suffix="%" />
          </Col>
          <Col span={12} style={{ marginTop: 16 }}>
            <Statistic title="开始日期" value={project.startDate} />
          </Col>
          <Col span={12} style={{ marginTop: 16 }}>
            <Statistic title="结束日期" value={project.endDate} />
          </Col>
        </Row>
      </Card>
    )
  }

  const renderGanttChart = () => {
    const allTasks = projectPlanLevel === 'level1' ? tasks : level2PlanTasks
    return (
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 8, border: '1px solid #ddd', width: 150 }}>任务名称</th>
                <th style={{ padding: 8, border: '1px solid #ddd', width: 80 }}>责任人</th>
                <th style={{ padding: 8, border: '1px solid #ddd', width: 80 }}>状态</th>
                <th style={{ padding: 8, border: '1px solid #ddd' }}>时间轴</th>
              </tr>
            </thead>
            <tbody>
              {allTasks.map(task => {
                const start = dayjs(task.planStartDate)
                const end = dayjs(task.planEndDate)
                const days = end.diff(start, 'day') + 1
                const totalDays = 120
                const startOffset = start.diff(dayjs('2026-01-01'), 'day')
                const leftPercent = (startOffset / totalDays) * 100
                const widthPercent = (days / totalDays) * 100
                const statusColor = task.status === '已完成' ? '#52c41a' : task.status === '进行中' ? '#1890ff' : '#d9d9d9'
                return (
                  <tr key={task.id}>
                    <td style={{ padding: 8, border: '1px solid #ddd' }}>{task.taskName}</td>
                    <td style={{ padding: 8, border: '1px solid #ddd' }}>{task.responsible}</td>
                    <td style={{ padding: 8, border: '1px solid #ddd' }}>
                      <Tag color={task.status === '已完成' ? 'green' : task.status === '进行中' ? 'blue' : 'default'}>{task.status}</Tag>
                    </td>
                    <td style={{ padding: 8, border: '1px solid #ddd', position: 'relative', height: 40 }}>
                      <div style={{
                        position: 'absolute',
                        left: `${Math.max(0, leftPercent)}%`,
                        width: `${Math.min(100 - leftPercent, widthPercent)}%`,
                        height: 24,
                        background: statusColor,
                        borderRadius: 4,
                        top: 8,
                        cursor: 'pointer'
                      }} onClick={() => setGanttEditingTask(task)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  const renderTaskTable = () => {
    const data = projectPlanLevel === 'level1' ? tasks : level2PlanTasks
    return (
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredTasks}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Card>
    )
  }

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
              <Select value={currentVersion} onChange={(val) => { setCurrentVersion(val) }} style={{ width: 150 }}>
                {versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}
              </Select>
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

        {projectPlanViewMode === 'gantt' ? renderGanttChart() : renderTaskTable()}

        <Modal title="自定义列" open={showColumnModal} onCancel={() => setShowColumnModal(false)} footer={[<Button key="reset" onClick={() => setVisibleColumns(ALL_COLUMNS.filter(c => c.default).map(c => c.key))}>重置</Button>, <Button key="cancel" onClick={() => setShowColumnModal(false)}>取消</Button>, <Button key="ok" type="primary" onClick={() => { setShowColumnModal(false); message.success('列配置已保存') }}>确定</Button>]}><Checkbox.Group value={visibleColumns} onChange={(vals) => setVisibleColumns(vals as string[])}><Row><Col span={12}>{ALL_COLUMNS.slice(0, 6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col><Col span={12}>{ALL_COLUMNS.slice(6).map(c => <Checkbox key={c.key} value={c.key} style={{ margin: '8px 0' }}>{c.title}</Checkbox>)}</Col></Row></Checkbox.Group></Modal>
        <Modal title="历史版本对比" open={showVersionCompare} onCancel={() => setShowVersionCompare(false)} footer={<Button type="primary" onClick={() => setShowVersionCompare(false)}>关闭</Button>} width={600}><Space direction="vertical" style={{ width: '100%' }}><div><span style={{ marginRight: 16 }}>版本A:</span><Select value={compareVersionA} onChange={setCompareVersionA} style={{ width: 200 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select></div><div><span style={{ marginRight: 16 }}>版本B:</span><Select value={compareVersionB} onChange={setCompareVersionB} style={{ width: 200 }}>{versions.map(v => <Option key={v.id} value={v.id}>{v.versionNo}({v.status})</Option>)}</Select></div><Button type="primary" onClick={() => {
                const versionA = versions.find(v => v.id === compareVersionA)
                const versionB = versions.find(v => v.id === compareVersionB)
                if (versionA && versionB) {
                  const oldTasks = versionA.status === '已发布' ? LEVEL1_TASKS : []
                  const newTasks = versionB.status === '已发布' ? LEVEL1_TASKS : tasks
                  const result = compareVersions(oldTasks as typeof LEVEL1_TASKS, newTasks as typeof LEVEL1_TASKS)
                  setCompareResult(result)
                  message.success('对比完成')
                }
              }}>开始对比</Button>{renderVersionCompareResult()}</Space></Modal>
        <Modal title={`编辑时间 - ${ganttEditingTask?.taskName}`} open={!!ganttEditingTask} onCancel={() => setGanttEditingTask(null)} onOk={() => setGanttEditingTask(null)}><Space direction="vertical" style={{ width: '100%' }}><div><span>开始时间:</span><DatePicker value={ganttEditingTask?.planStartDate ? { format: 'YYYY-MM-DD', value: ganttEditingTask.planStartDate } : undefined} onChange={(date, dateStr) => { if (dateStr && ganttEditingTask) handleGanttTimeChange(ganttEditingTask.id, 'planStartDate', dateStr) }} style={{ marginLeft: 8 }} /></div><div><span>结束时间:</span><DatePicker value={ganttEditingTask?.planEndDate ? { format: 'YYYY-MM-DD', value: ganttEditingTask.planEndDate } : undefined} onChange={(date, dateStr) => { if (dateStr && ganttEditingTask) handleGanttTimeChange(ganttEditingTask.id, 'planEndDate', dateStr) }} style={{ marginLeft: 8 }} /></div></Space></Modal>
        <Modal title={`编辑进度 - ${progressEditingTask?.taskName}`} open={!!progressEditingTask} onCancel={() => setProgressEditingTask(null)} onOk={() => setProgressEditingTask(null)} footer={null}>
            <div style={{ padding: '20px 0' }}>
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <Progress percent={progressEditingTask?.progress || 0} status="active" strokeColor={{ '0%': '#108ee9', '100%': '#52c41a' }} />
              </div>
              <Slider
                value={progressEditingTask?.progress || 0}
                onChange={(val) => {
                  if (progressEditingTask) {
                    setProgressEditingTask({ ...progressEditingTask, progress: val })
                  }
                }}
                marks={{ 0: '0%', 50: '50%', 100: '100%' }}
              />
            </div>
        </Modal>
        <Modal title="创建二级计划" open={showCreateLevel2Plan} onCancel={() => setShowCreateLevel2Plan(false)} onOk={() => {
          const newPlan = { id: `plan${createdLevel2Plans.length + 1}`, name: `${newPlanType}火车计划`, type: newPlanType }
          setCreatedLevel2Plans([...createdLevel2Plans, newPlan])
          setActiveLevel2Plan(newPlan.id)
          setShowCreateLevel2Plan(false)
          message.success('创建成功')
        }}>
          <Form layout="vertical">
            <Form.Item label="计划类型">
              <Select value={newPlanType} onChange={setNewPlanType}>
                <Option value="FR版本火车计划">FR版本火车计划</Option>
                <Option value="MR版本火车计划">MR版本火车计划</Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    )
  }

  const renderProjectOverview = () => (
    <Card>
      <Empty description="该模块开发中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
    </Card>
  )

  const renderProjectRequirements = () => (
    <Card>
      <Empty description="该模块开发中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
    </Card>
  )

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

    if (!project) return <Empty description="项目不存在" />

    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <div style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
          <Row align="middle" style={{ height: 64 }}>
            <Col flex="none"><Button icon={<LeftOutlined />} onClick={() => router.push('/')}>返回</Button></Col>
            <Col flex="auto" style={{ textAlign: 'center' }}><h2 style={{ margin: 0 }}>{project.name} - 项目空间</h2></Col>
            <Col flex="none"><Button type="primary" icon={<SaveOutlined />}>保存</Button></Col>
          </Row>
        </div>
        <div style={{ display: 'flex' }}>
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

  if (!project) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: 24 }}>
        <Card>
          <Empty description="项目不存在" />
          <Button type="primary" onClick={() => router.push('/')} style={{ marginTop: 16 }}>返回首页</Button>
        </Card>
      </div>
    )
  }

  return renderProjectSpace()
}
