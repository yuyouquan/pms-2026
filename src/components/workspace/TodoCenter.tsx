'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Skeleton,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import { DeploymentUnitOutlined, ProjectOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
  filterWorkbenchTodos,
  resolveWorkbenchDefaultSelection,
  type TodoFilters,
  type TodoSource,
  type TodoStatusFilter,
  type WorkbenchTodo,
} from '@/lib/todoAggregation'

const { RangePicker } = DatePicker

export interface TodoCenterProps {
  todos: WorkbenchTodo[]
  loading?: boolean
  error?: string
  onRetry?: () => void
  onOpenTodo: (todo: WorkbenchTodo) => void
}

type FieldFilters = Pick<TodoFilters, 'search' | 'projectId' | 'generatedDateFrom' | 'generatedDateTo'>

const EMPTY_FIELD_FILTERS: FieldFilters = {
  search: '',
  projectId: '',
  generatedDateFrom: '',
  generatedDateTo: '',
}

const SOURCE_LABELS: Record<TodoSource, string> = {
  plan: '计划',
  transfer: '转维',
}

const STATUS_LABELS: Record<TodoStatusFilter, string> = {
  all: '全部',
  pending: '待处理',
  completed: '已完成',
}

export default function TodoCenter({ todos, loading = false, error, onRetry, onOpenTodo }: TodoCenterProps) {
  const defaultSelection = resolveWorkbenchDefaultSelection(todos)
  const [source, setSource] = useState<TodoSource>(defaultSelection.source)
  const [status, setStatus] = useState<TodoStatusFilter>(defaultSelection.status)
  const [fieldFilters, setFieldFilters] = useState<FieldFilters>(EMPTY_FIELD_FILTERS)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const directoryTodos = useMemo(
    () => todos.filter(todo => todo.source === source),
    [source, todos],
  )
  const filteredTodos = useMemo(
    () => filterWorkbenchTodos(todos, { ...fieldFilters, source, status }),
    [fieldFilters, source, status, todos],
  )
  const projectOptions = useMemo(() => {
    const projects = new Map<string, string>()
    directoryTodos.forEach(todo => {
      if (todo.projectId) projects.set(todo.projectId, todo.projectName || todo.projectId)
    })
    return Array.from(projects, ([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
  }, [directoryTodos])

  const pendingCounts = useMemo(() => ({
    plan: todos.filter(todo => todo.source === 'plan' && todo.status === 'pending').length,
    transfer: todos.filter(todo => todo.source === 'transfer' && todo.status === 'pending').length,
  }), [todos])
  const statusCounts = useMemo(() => ({
    all: directoryTodos.length,
    pending: directoryTodos.filter(todo => todo.status === 'pending').length,
    completed: directoryTodos.filter(todo => todo.status === 'completed').length,
  }), [directoryTodos])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredTodos.length / pageSize))
    if (currentPage > maxPage) setCurrentPage(maxPage)
  }, [currentPage, filteredTodos.length, pageSize])

  const updateFieldFilter = <Key extends keyof FieldFilters>(key: Key, value: FieldFilters[Key]) => {
    setFieldFilters(current => ({ ...current, [key]: value }))
    setCurrentPage(1)
  }

  const switchSource = (nextSource: TodoSource) => {
    setSource(nextSource)
    setFieldFilters(EMPTY_FIELD_FILTERS)
    setCurrentPage(1)
  }

  const switchStatus = (nextStatus: TodoStatusFilter) => {
    setStatus(nextStatus)
    setCurrentPage(1)
  }

  const generatedRange: [Dayjs, Dayjs] | null = fieldFilters.generatedDateFrom && fieldFilters.generatedDateTo
    ? [dayjs(fieldFilters.generatedDateFrom), dayjs(fieldFilters.generatedDateTo)]
    : null
  const filtersAreEmpty = !fieldFilters.search
    && !fieldFilters.projectId
    && !fieldFilters.generatedDateFrom
    && !fieldFilters.generatedDateTo
  const emptyDescription = !filtersAreEmpty
    ? '暂无符合条件的任务'
    : status === 'pending'
      ? '暂无待处理任务'
      : status === 'completed'
        ? '暂无已完成任务'
        : `暂无${SOURCE_LABELS[source]}任务`

  return (
    <section className="pms-todo-center pms-glass-surface" aria-label="个人工作台任务">
      <aside className="pms-todo-directory" aria-label="任务目录">
        <h2>任务目录</h2>
        <div className="pms-todo-directory__items">
          {(['plan', 'transfer'] as const).map(item => {
            const active = source === item
            const Icon = item === 'plan' ? ProjectOutlined : DeploymentUnitOutlined
            return (
              <button
                key={item}
                type="button"
                className={`pms-todo-directory__item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                aria-label={`${SOURCE_LABELS[item]}，${pendingCounts[item]} 条待处理`}
                onClick={() => switchSource(item)}
              >
                <Icon aria-hidden="true" />
                <span>{SOURCE_LABELS[item]}</span>
                <span className="pms-todo-directory__count">{pendingCounts[item]}</span>
              </button>
            )
          })}
        </div>
      </aside>

      <div className="pms-todo-workspace">
        <div className="pms-todo-status-tabs" role="tablist" aria-label="任务状态">
          {(['all', 'pending', 'completed'] as const).map(item => (
            <button
              key={item}
              type="button"
              role="tab"
              className="pms-todo-status-tabs__item"
              aria-selected={status === item}
              onClick={() => switchStatus(item)}
            >
              <span>{STATUS_LABELS[item]}</span>
              <span className="pms-todo-status-tabs__count">{statusCounts[item]}</span>
            </button>
          ))}
        </div>

        <div className="pms-todo-center__filters pms-toolbar" aria-label="待办筛选条">
          <Input
            className="pms-todo-filter--search"
            allowClear
            size="small"
            aria-label="搜索待办"
            prefix={<SearchOutlined />}
            placeholder="搜索任务、项目或处理人"
            value={fieldFilters.search}
            onChange={event => updateFieldFilter('search', event.target.value)}
          />
          <Select
            className="pms-todo-filter--project"
            allowClear
            size="small"
            aria-label="项目筛选"
            placeholder="全部项目"
            value={fieldFilters.projectId || undefined}
            onChange={value => updateFieldFilter('projectId', value || '')}
            options={projectOptions}
          />
          <RangePicker
            className="pms-todo-filter--date"
            allowClear
            size="small"
            aria-label="生成时间"
            value={generatedRange}
            placeholder={['生成开始日期', '生成结束日期']}
            onChange={values => {
              setFieldFilters(current => ({
                ...current,
                generatedDateFrom: values?.[0]?.format('YYYY-MM-DD') || '',
                generatedDateTo: values?.[1]?.format('YYYY-MM-DD') || '',
              }))
              setCurrentPage(1)
            }}
          />
          <Button
            className="pms-todo-filter--clear"
            size="small"
            aria-label="清空筛选"
            disabled={filtersAreEmpty}
            onClick={() => {
              setFieldFilters(EMPTY_FIELD_FILTERS)
              setCurrentPage(1)
            }}
          >
            清空筛选
          </Button>
        </div>

        <div className="pms-todo-center__result-status" role="status" aria-live="polite" aria-atomic="true">
          {loading ? '任务加载中' : error ? '任务加载失败' : `共 ${filteredTodos.length} 条任务`}
        </div>

        <div className="pms-todo-center__table pms-solid-surface pms-table">
          {loading ? (
            <div className="pms-todo-center__loading" aria-label="任务加载中">
              <Skeleton active title={false} paragraph={{ rows: 8, width: ['96%', '92%', '98%', '88%', '95%', '90%', '97%', '86%'] }} />
            </div>
          ) : error ? (
            <div className="pms-todo-center__error" role="alert">
              <Alert
                type="error"
                showIcon
                title="任务加载失败"
                description={error}
                action={onRetry ? <Button onClick={onRetry}>重新加载</Button> : undefined}
              />
            </div>
          ) : (
            <Table<WorkbenchTodo>
              size="small"
              sticky
              rowKey={record => `${record.source}:${record.id}`}
              rowClassName="pms-solid-surface"
              dataSource={filteredTodos}
              pagination={{
                current: currentPage,
                pageSize,
                total: filteredTodos.length,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showTotal: total => `共 ${total} 条`,
                onChange: (page, nextPageSize) => {
                  setCurrentPage(nextPageSize !== pageSize ? 1 : page)
                  setPageSize(nextPageSize)
                },
              }}
              scroll={{ x: 1320, y: 460 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} /> }}
              columns={[
                {
                  title: '任务名称',
                  dataIndex: 'title',
                  key: 'title',
                  width: 220,
                  ellipsis: true,
                  render: (title: string) => (
                    <Tooltip title={title} placement="topLeft">
                      <span className="pms-todo-center__task-title">{title}</span>
                    </Tooltip>
                  ),
                },
                {
                  title: '所属项目',
                  dataIndex: 'projectName',
                  key: 'projectName',
                  width: 180,
                  ellipsis: true,
                  render: (projectName: string) => projectName || '未关联项目',
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (todoStatus: WorkbenchTodo['status']) => (
                    <Tag className={`pms-todo-status-tag is-${todoStatus}`}>
                      {todoStatus === 'completed' ? '已完成' : '待处理'}
                    </Tag>
                  ),
                },
                {
                  title: '任务节点',
                  dataIndex: 'nodeLabel',
                  key: 'nodeLabel',
                  width: 170,
                  ellipsis: true,
                  render: (nodeLabel: string) => (
                    <Tooltip title={nodeLabel} placement="topLeft">
                      <span>{nodeLabel || '—'}</span>
                    </Tooltip>
                  ),
                },
                {
                  title: '任务内容',
                  dataIndex: 'taskContent',
                  key: 'taskContent',
                  width: 280,
                  ellipsis: true,
                  render: (taskContent: string) => (
                    <Tooltip title={taskContent || undefined} placement="topLeft">
                      <span className="pms-todo-center__context">{taskContent || '—'}</span>
                    </Tooltip>
                  ),
                },
                {
                  title: '处理人',
                  dataIndex: 'assignee',
                  key: 'assignee',
                  width: 110,
                  render: (assignee: string) => assignee || '未指定',
                },
                {
                  title: '生成时间',
                  dataIndex: 'generatedAt',
                  key: 'generatedAt',
                  width: 130,
                  render: (generatedAt: string) => generatedAt || '未记录',
                },
                {
                  title: '操作',
                  key: 'action',
                  fixed: 'right',
                  width: 110,
                  render: (_value, record) => {
                    if (record.status === 'completed') return null
                    return (
                      <Button
                        type="link"
                        size="small"
                        aria-label={`前往处理 ${record.title}`}
                        onClick={() => onOpenTodo(record)}
                      >
                        前往处理
                      </Button>
                    )
                  },
                },
              ]}
            />
          )}
        </div>
      </div>
    </section>
  )
}
