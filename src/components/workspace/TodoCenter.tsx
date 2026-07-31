'use client'

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  DatePicker,
  Empty,
  Input,
  Segmented,
  Select,
  Table,
  Tag,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
  filterWorkbenchTodos,
  summarizeWorkbenchTodos,
  type TodoFilters,
  type TodoSource,
  type WorkbenchTodo,
} from '@/lib/todoAggregation'

export interface TodoCenterProps {
  todos: WorkbenchTodo[]
  loading?: boolean
  onOpenTodo: (todo: WorkbenchTodo) => void
}

const EMPTY_FILTERS: TodoFilters = {
  source: 'all',
  search: '',
  projectId: '',
  status: 'all',
  dueDateFrom: '',
  dueDateTo: '',
}

const STATUS_LABELS = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
} as const

const SOURCE_LABELS = {
  plan: '计划待办',
  transfer: '转维待办',
} as const

function getDueBadge(todo: WorkbenchTodo, today: string) {
  if (todo.status === 'completed') {
    return { status: 'success' as const, text: '已完成', className: 'is-completed' }
  }
  if (todo.dueDate && todo.dueDate < today) {
    return { status: 'error' as const, text: '已逾期', className: 'is-overdue' }
  }
  if (todo.dueDate === today) {
    return { status: 'warning' as const, text: '今日到期', className: 'is-due-today' }
  }
  return { status: 'default' as const, text: todo.dueDate ? '按期' : '未设日期', className: '' }
}

export default function TodoCenter({ todos, loading = false, onOpenTodo }: TodoCenterProps) {
  const [filters, setFilters] = useState<TodoFilters>(EMPTY_FILTERS)
  const today = dayjs().format('YYYY-MM-DD')

  const filteredTodos = useMemo(
    () => filterWorkbenchTodos(todos, filters),
    [filters, todos],
  )
  const summary = useMemo(
    () => summarizeWorkbenchTodos(filteredTodos, today),
    [filteredTodos, today],
  )
  const projectOptions = useMemo(() => {
    const projects = new Map<string, string>()
    todos.forEach(todo => {
      if (todo.projectId) projects.set(todo.projectId, todo.projectName || todo.projectId)
    })
    return Array.from(projects, ([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
  }, [todos])

  const updateFilter = <Key extends keyof TodoFilters>(key: Key, value: TodoFilters[Key]) => {
    setFilters(current => ({ ...current, [key]: value }))
  }

  const metrics = [
    { key: 'total', label: '待办总数', value: summary.total, icon: <FolderOpenOutlined />, tone: 'purple' },
    { key: 'today', label: '今日到期', value: summary.dueToday, icon: <CalendarOutlined />, tone: 'orange' },
    { key: 'overdue', label: '已逾期', value: summary.overdue, icon: <ClockCircleOutlined />, tone: 'red' },
    { key: 'completed', label: '本周完成', value: summary.completedThisWeek, icon: <CheckCircleOutlined />, tone: 'green' },
  ]

  const emptyDescription = filters.source === 'plan'
    ? '暂无计划待办'
    : filters.source === 'transfer'
      ? '暂无转维待办'
      : '暂无符合条件的待办'

  return (
    <section className="pms-todo-center" aria-label="分类待办中心">
      <div className="pms-todo-center__source-row">
        <div>
          <div className="pms-todo-center__eyebrow">个人工作台</div>
          <h2 className="pms-todo-center__title">分类待办</h2>
        </div>
        <Segmented
          aria-label="待办来源"
          value={filters.source}
          onChange={value => updateFilter('source', value as 'all' | TodoSource)}
          options={[
            { label: '全部', value: 'all' },
            { label: '计划待办', value: 'plan' },
            { label: '转维待办', value: 'transfer' },
          ]}
        />
      </div>

      <div className="pms-todo-center__metrics" aria-label="待办指标">
        {metrics.map(metric => (
          <div key={metric.key} className={`pms-todo-metric pms-todo-metric--${metric.tone}`}>
            <div className="pms-todo-metric__icon" aria-hidden="true">{metric.icon}</div>
            <div>
              <div className="pms-todo-metric__label">{metric.label}</div>
              <div className="pms-todo-metric__value" aria-label={`${metric.label} ${metric.value}`}>{metric.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="pms-todo-center__filters" aria-label="待办筛选条">
        <Input
          allowClear
          aria-label="搜索待办"
          prefix={<SearchOutlined />}
          placeholder="搜索任务或项目"
          value={filters.search}
          onChange={event => updateFilter('search', event.target.value)}
        />
        <Select
          allowClear
          aria-label="项目筛选"
          placeholder="全部项目"
          value={filters.projectId || undefined}
          onChange={value => updateFilter('projectId', value || '')}
          options={projectOptions}
        />
        <Select
          aria-label="状态筛选"
          value={filters.status}
          onChange={value => updateFilter('status', value)}
          options={[
            { label: '全部状态', value: 'all' },
            { label: '待处理', value: 'pending' },
            { label: '进行中', value: 'in_progress' },
            { label: '已完成', value: 'completed' },
          ]}
        />
        <DatePicker
          allowClear
          aria-label="开始日期"
          placeholder="开始日期"
          value={filters.dueDateFrom ? dayjs(filters.dueDateFrom) : null}
          onChange={(value: Dayjs | null) => updateFilter('dueDateFrom', value?.format('YYYY-MM-DD') || '')}
        />
        <DatePicker
          allowClear
          aria-label="结束日期"
          placeholder="结束日期"
          value={filters.dueDateTo ? dayjs(filters.dueDateTo) : null}
          onChange={(value: Dayjs | null) => updateFilter('dueDateTo', value?.format('YYYY-MM-DD') || '')}
        />
        <Button
          aria-label="清空筛选"
          disabled={Object.entries(filters).every(([key, value]) => key === 'source' ? value === 'all' : !value || value === 'all')}
          onClick={() => setFilters(EMPTY_FILTERS)}
        >
          清空筛选
        </Button>
      </div>

      <div className="pms-todo-center__table" aria-live="polite">
        {loading ? (
          <div className="pms-todo-center__loading">待办加载中...</div>
        ) : (
          <Table<WorkbenchTodo>
            size="small"
            sticky
            rowKey={record => `${record.source}:${record.id}`}
            dataSource={filteredTodos}
            pagination={false}
            scroll={{ x: 900, y: 360 }}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />,
            }}
            onRow={record => ({
              tabIndex: 0,
              role: 'button',
              'aria-label': `打开待办 ${record.title}`,
              onClick: () => onOpenTodo(record),
              onKeyDown: event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenTodo(record)
                }
              },
            })}
            columns={[
              {
                title: '任务',
                dataIndex: 'title',
                key: 'title',
                width: 300,
                render: (title: string, record) => (
                  <div className="pms-todo-center__task">
                    <span className="pms-todo-center__task-title">{title}</span>
                    <span>{record.projectName || '未关联项目'}</span>
                  </div>
                ),
              },
              {
                title: '分类',
                dataIndex: 'source',
                key: 'source',
                width: 112,
                render: (source: TodoSource) => (
                  <Tag color={source === 'plan' ? 'purple' : 'cyan'}>{SOURCE_LABELS[source]}</Tag>
                ),
              },
              {
                title: '处理人',
                dataIndex: 'assignee',
                key: 'assignee',
                width: 100,
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                width: 100,
                render: (status: WorkbenchTodo['status']) => <Tag color={status === 'completed' ? 'success' : status === 'in_progress' ? 'processing' : 'default'}>{STATUS_LABELS[status]}</Tag>,
              },
              {
                title: '截止日期',
                dataIndex: 'dueDate',
                key: 'dueDate',
                width: 190,
                render: (dueDate: string, record) => {
                  const badge = getDueBadge(record, today)
                  return (
                    <div className={`pms-todo-center__due ${badge.className}`}>
                      <span>{dueDate || '未设置'}</span>
                      <Badge status={badge.status} text={badge.text} />
                    </div>
                  )
                },
              },
            ]}
          />
        )}
      </div>
    </section>
  )
}
