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
import { SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
  filterWorkbenchTodos,
  type TodoFilters,
  type TodoSource,
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

const EMPTY_FILTERS: TodoFilters = {
  search: '',
  projectId: '',
  categories: [],
  generatedDateFrom: '',
  generatedDateTo: '',
}

const SOURCE_LABELS: Record<TodoSource, string> = {
  plan: '计划待办',
  transfer: '转维待办',
}

export default function TodoCenter({ todos, loading = false, error, onRetry, onOpenTodo }: TodoCenterProps) {
  const [filters, setFilters] = useState<TodoFilters>(EMPTY_FILTERS)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredTodos = useMemo(
    () => filterWorkbenchTodos(todos, filters),
    [filters, todos],
  )
  const projectOptions = useMemo(() => {
    const projects = new Map<string, string>()
    todos.forEach(todo => {
      if (todo.projectId) projects.set(todo.projectId, todo.projectName || todo.projectId)
    })
    return Array.from(projects, ([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
  }, [todos])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredTodos.length / pageSize))
    if (currentPage > maxPage) setCurrentPage(maxPage)
  }, [currentPage, filteredTodos.length, pageSize])

  const updateFilter = <Key extends keyof TodoFilters>(key: Key, value: TodoFilters[Key]) => {
    setFilters(current => ({ ...current, [key]: value }))
    setCurrentPage(1)
  }

  const generatedRange: [Dayjs, Dayjs] | null = filters.generatedDateFrom && filters.generatedDateTo
    ? [dayjs(filters.generatedDateFrom), dayjs(filters.generatedDateTo)]
    : null
  const emptyDescription = filters.categories.length === 1
    ? `暂无${SOURCE_LABELS[filters.categories[0]]}`
    : '暂无符合条件的待办'
  const filtersAreEmpty = !filters.search
    && !filters.projectId
    && filters.categories.length === 0
    && !filters.generatedDateFrom
    && !filters.generatedDateTo

  return (
    <section className="pms-todo-center pms-glass-surface" aria-label="待办中心">
      <div className="pms-todo-center__filters pms-toolbar" aria-label="待办筛选条">
        <Input
          allowClear
          size="small"
          aria-label="搜索待办"
          prefix={<SearchOutlined />}
          placeholder="搜索任务或项目"
          value={filters.search}
          onChange={event => updateFilter('search', event.target.value)}
        />
        <Select
          allowClear
          size="small"
          aria-label="项目筛选"
          placeholder="全部项目"
          value={filters.projectId || undefined}
          onChange={value => updateFilter('projectId', value || '')}
          options={projectOptions}
        />
        <Select<TodoSource[]>
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          size="small"
          aria-label="任务分类"
          placeholder="任务分类"
          value={filters.categories}
          onChange={value => updateFilter('categories', value)}
          options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <RangePicker
          allowClear
          size="small"
          aria-label="生成时间"
          value={generatedRange}
          placeholder={['生成开始日期', '生成结束日期']}
          onChange={values => {
            updateFilter('generatedDateFrom', values?.[0]?.format('YYYY-MM-DD') || '')
            setFilters(current => ({
              ...current,
              generatedDateFrom: values?.[0]?.format('YYYY-MM-DD') || '',
              generatedDateTo: values?.[1]?.format('YYYY-MM-DD') || '',
            }))
          }}
        />
        <Button
          size="small"
          aria-label="清空筛选"
          disabled={filtersAreEmpty}
          onClick={() => {
            setFilters(EMPTY_FILTERS)
            setCurrentPage(1)
          }}
        >
          清空筛选
        </Button>
      </div>

      <div className="pms-todo-center__result-status" role="status" aria-live="polite" aria-atomic="true">
        {loading ? '待办加载中' : error ? '待办加载失败' : `共 ${filteredTodos.length} 条待处理任务`}
      </div>

      <div className="pms-todo-center__table pms-solid-surface pms-table">
        {loading ? (
          <div className="pms-todo-center__loading" aria-label="待办加载中">
            <Skeleton active title={false} paragraph={{ rows: 8, width: ['96%', '92%', '98%', '88%', '95%', '90%', '97%', '86%'] }} />
          </div>
        ) : error ? (
          <div className="pms-todo-center__error" role="alert">
            <Alert
              type="error"
              showIcon
              title="待办加载失败"
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
            scroll={{ x: 980, y: 420 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} /> }}
            columns={[
              {
                title: '任务名称',
                dataIndex: 'title',
                key: 'title',
                width: 260,
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
                width: 190,
                render: (projectName: string) => projectName || '未关联项目',
              },
              {
                title: '任务',
                dataIndex: 'source',
                key: 'source',
                width: 260,
                render: (source: TodoSource, record) => (
                  <div className="pms-todo-center__source">
                    <Tag color={source === 'plan' ? 'purple' : 'cyan'}>{SOURCE_LABELS[source]}</Tag>
                    <span>{record.sourceLabel || SOURCE_LABELS[source]}</span>
                    {record.context && <span className="pms-todo-center__context">{record.context}</span>}
                  </div>
                ),
              },
              {
                title: '处理人',
                dataIndex: 'assignee',
                key: 'assignee',
                width: 110,
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
                render: (_value, record) => (
                  <Button
                    type="link"
                    size="small"
                    aria-label={`前往处理 ${record.title}`}
                    onClick={() => onOpenTodo(record)}
                  >
                    前往处理
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>
    </section>
  )
}
