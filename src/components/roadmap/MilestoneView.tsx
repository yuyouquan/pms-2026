'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Table, Button, Space, Select, Tag, Modal, Checkbox, Input, Tabs, message, Tooltip, Popconfirm, Empty,
} from 'antd'
import {
  FilterOutlined, SettingOutlined, SaveOutlined, FullscreenOutlined, FullscreenExitOutlined,
  EyeOutlined, PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RoadmapViewConfig } from '@/types'
import { aggregateMilestones, generateTableData, saveView, loadAllViews, deleteView } from './utils'

const PROJECT_TYPES = ['整机产品项目', '产品项目', '技术项目', '能力建设项目']

const DEFAULT_VIEW_ID = '__default__'

const FIXED_COLUMNS = [
  { key: 'projectName', title: '项目名称' },
  { key: 'market', title: '市场', onlyForType: '整机产品项目' },
  { key: 'productLine', title: '产品线' },
  { key: 'chipPlatform', title: '平台厂商' },
  { key: 'tosVersion', title: 'tOS版本' },
  { key: 'status', title: '状态' },
  { key: 'spm', title: 'SPM' },
]

const marketColors: Record<string, string> = {
  'OP': '#1890ff', 'TR': '#52c41a', 'RU': '#faad14',
  'FR': '#722ed1', 'IN': '#eb2f96', 'BR': '#13c2c2',
}

interface MilestoneViewProps {
  projects: any[]
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>
  level1Tasks: any[]
  onViewProject: (projectId: string, market?: string) => void
}

function getDefaultVisibleColumns(projectType: string) {
  return FIXED_COLUMNS
    .filter(c => !c.onlyForType || c.onlyForType === projectType)
    .map(c => c.key)
}

export default function MilestoneView({ projects, marketPlanData, level1Tasks, onViewProject }: MilestoneViewProps) {
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0])
  const [filters, setFilters] = useState<{
    productLine?: string[]
    chipPlatform?: string[]
    status?: string[]
    tosVersion?: string[]
  }>({})
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getDefaultVisibleColumns(PROJECT_TYPES[0]))
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [savedViews, setSavedViews] = useState<RoadmapViewConfig[]>([])
  const [activeViewId, setActiveViewId] = useState<string>(DEFAULT_VIEW_ID)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Modal states
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [showSaveViewModal, setShowSaveViewModal] = useState(false)
  const [viewName, setViewName] = useState('')

  // Temp filter state for modal
  const [tempFilters, setTempFilters] = useState(filters)

  // Load saved views
  useEffect(() => {
    setSavedViews(loadAllViews())
  }, [])

  // Reset page on type change
  useEffect(() => {
    setCurrentPage(1)
  }, [projectType])

  // Update visible columns when projectType changes (add/remove market column)
  useEffect(() => {
    if (activeViewId === DEFAULT_VIEW_ID) {
      setVisibleColumns(getDefaultVisibleColumns(projectType))
    }
  }, [projectType, activeViewId])

  // Aggregate milestones
  const milestones = useMemo(() => {
    return aggregateMilestones(projects, projectType, marketPlanData, level1Tasks)
  }, [projects, projectType, marketPlanData, level1Tasks])

  // Generate table data
  const allTableData = useMemo(() => {
    return generateTableData(projects, milestones, projectType, marketPlanData, level1Tasks)
  }, [projects, milestones, projectType, marketPlanData, level1Tasks])

  // Apply filters
  const tableData = useMemo(() => {
    let data = allTableData
    if (filters.productLine?.length) {
      data = data.filter(r => filters.productLine!.includes(r.productLine))
    }
    if (filters.chipPlatform?.length) {
      data = data.filter(r => filters.chipPlatform!.includes(r.chipPlatform))
    }
    if (filters.status?.length) {
      data = data.filter(r => filters.status!.includes(r.status))
    }
    if (filters.tosVersion?.length) {
      data = data.filter(r => filters.tosVersion!.includes(r.tosVersion))
    }
    return data
  }, [allTableData, filters])

  // Extract unique filter options from current project type
  const filterOptions = useMemo(() => {
    const filteredProjects = projects.filter(p => p.type === projectType)
    return {
      productLine: [...new Set(filteredProjects.map(p => p.productLine).filter(Boolean))] as string[],
      chipPlatform: [...new Set(filteredProjects.map(p => p.chipPlatform).filter(Boolean))] as string[],
      status: [...new Set(filteredProjects.map(p => p.status).filter(Boolean))] as string[],
      tosVersion: [...new Set(filteredProjects.map(p => p.tosVersion).filter(Boolean))] as string[],
    }
  }, [projects, projectType])

  // Build columns
  const columns = useMemo((): ColumnsType<any> => {
    const cols: ColumnsType<any> = []

    // Fixed left - project name (always visible)
    cols.push({
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      fixed: 'left' as const,
      width: 200,
      render: (text: string) => (
        <span style={{ fontWeight: 500, fontSize: 13 }}>{text}</span>
      ),
    })

    // Market column - only for 整机产品项目
    if (projectType === '整机产品项目' && visibleColumns.includes('market')) {
      cols.push({
        title: '市场',
        dataIndex: 'market',
        key: 'market',
        width: 80,
        render: (val: string) => val ? (
          <Tag color={marketColors[val] || 'default'} style={{ margin: 0 }}>{val}</Tag>
        ) : '-',
      })
    }

    // Optional fixed columns
    if (visibleColumns.includes('productLine')) {
      cols.push({ title: '产品线', dataIndex: 'productLine', key: 'productLine', width: 100 })
    }
    if (visibleColumns.includes('chipPlatform')) {
      cols.push({ title: '平台厂商', dataIndex: 'chipPlatform', key: 'chipPlatform', width: 100 })
    }
    if (visibleColumns.includes('tosVersion')) {
      cols.push({ title: 'tOS版本', dataIndex: 'tosVersion', key: 'tosVersion', width: 100 })
    }
    if (visibleColumns.includes('status')) {
      cols.push({
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (val: string) => {
          const colorMap: Record<string, string> = {
            '进行中': 'processing',
            '已完成': 'success',
            '筹备中': 'warning',
            '暂停': 'default',
            '未开始': 'default',
          }
          return <Tag color={colorMap[val] || 'default'}>{val}</Tag>
        },
      })
    }
    if (visibleColumns.includes('spm')) {
      cols.push({ title: 'SPM', dataIndex: 'spm', key: 'spm', width: 80 })
    }

    // Dynamic milestone columns
    for (const ms of milestones) {
      cols.push({
        title: ms.name,
        dataIndex: `ms_${ms.name}`,
        key: `ms_${ms.name}`,
        width: 200,
        align: 'center' as const,
        render: (val: string) => (
          <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#595959' }}>{val}</span>
        ),
      })
    }

    // Fixed right - actions
    cols.push({
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 70,
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onViewProject(record.projectId, record.market)}
        >
          查看
        </Button>
      ),
    })

    return cols
  }, [visibleColumns, milestones, onViewProject, projectType])

  // Reset to default view state
  const resetToDefault = () => {
    setFilters({})
    setVisibleColumns(getDefaultVisibleColumns(projectType))
    setPageSize(10)
    setCurrentPage(1)
  }

  // Handle save view
  const handleSaveView = () => {
    if (!viewName.trim()) {
      message.warning('请输入视图名称')
      return
    }
    const config: RoadmapViewConfig = {
      id: Date.now().toString(),
      name: viewName.trim(),
      projectType: projectType as any,
      filters: { ...filters },
      visibleColumns: [...visibleColumns],
      pageSize,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveView(config)
    const updated = loadAllViews()
    setSavedViews(updated)
    setActiveViewId(config.id)
    setShowSaveViewModal(false)
    setViewName('')
    message.success('视图保存成功')
  }

  // Handle switch view tab
  const handleViewTabChange = (viewId: string) => {
    setActiveViewId(viewId)
    if (viewId === DEFAULT_VIEW_ID) {
      resetToDefault()
      return
    }
    const view = savedViews.find(v => v.id === viewId)
    if (!view) return
    if (view.projectType) setProjectType(view.projectType)
    setFilters(view.filters || {})
    setVisibleColumns(view.visibleColumns || getDefaultVisibleColumns(view.projectType || projectType))
    setPageSize(view.pageSize || 10)
    setCurrentPage(1)
  }

  // Handle delete view tab
  const handleViewTabEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'remove') {
      const viewId = targetKey as string
      if (viewId === DEFAULT_VIEW_ID) return
      deleteView(viewId)
      const updated = loadAllViews()
      setSavedViews(updated)
      if (activeViewId === viewId) {
        setActiveViewId(DEFAULT_VIEW_ID)
        resetToDefault()
      }
      message.success('视图已删除')
    }
    if (action === 'add') {
      setShowSaveViewModal(true)
    }
  }

  const hasActiveFilters = Object.values(filters).some(v => v && v.length > 0)

  // Columns available for column settings (context-aware)
  const settableColumns = FIXED_COLUMNS.filter(c => {
    if (c.key === 'projectName') return false // always visible
    if (c.onlyForType && c.onlyForType !== projectType) return false
    return true
  })

  // View tabs
  const viewTabs = useMemo(() => {
    const items: { key: string; label: React.ReactNode; closable: boolean }[] = [
      { key: DEFAULT_VIEW_ID, label: '默认视图', closable: false },
    ]
    for (const v of savedViews) {
      items.push({
        key: v.id,
        label: v.name,
        closable: true,
      })
    }
    return items
  }, [savedViews])

  // Table component
  const tableComponent = (
    <Table
      className="pms-table"
      columns={columns}
      dataSource={tableData}
      scroll={{ x: 'max-content' }}
      size="small"
      pagination={{
        current: currentPage,
        pageSize,
        total: tableData.length,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: (total) => `共 ${total} 条`,
        onChange: (page, size) => {
          setCurrentPage(page)
          setPageSize(size)
        },
      }}
      locale={{ emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
  )

  // Toolbar (right side buttons)
  const toolbarActions = (
    <Space wrap>
      <Select
        value={projectType}
        onChange={(val) => {
          setProjectType(val)
          setActiveViewId(DEFAULT_VIEW_ID)
          setFilters({})
          setCurrentPage(1)
        }}
        style={{ width: 160 }}
        options={PROJECT_TYPES.map(t => ({ label: t, value: t }))}
      />
      <Tooltip title="筛选">
        <Button
          icon={<FilterOutlined />}
          onClick={() => {
            setTempFilters({ ...filters })
            setShowFilterModal(true)
          }}
          type={hasActiveFilters ? 'primary' : 'default'}
          ghost={hasActiveFilters}
        >
          筛选{hasActiveFilters ? ' (已启用)' : ''}
        </Button>
      </Tooltip>
      <Tooltip title="列设置">
        <Button icon={<SettingOutlined />} onClick={() => setShowColumnModal(true)}>列设置</Button>
      </Tooltip>
      <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
        <Button
          icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={() => setIsFullscreen(!isFullscreen)}
        />
      </Tooltip>
    </Space>
  )

  return (
    <div>
      {/* View Tabs + Toolbar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Tabs
            type="editable-card"
            activeKey={activeViewId}
            onChange={handleViewTabChange}
            onEdit={handleViewTabEdit}
            size="small"
            addIcon={<span style={{ fontSize: 12 }}><PlusOutlined /> 保存当前视图</span>}
            items={viewTabs}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ flexShrink: 0, paddingTop: 4 }}>
          {toolbarActions}
        </div>
      </div>

      {tableComponent}

      {/* Filter Modal */}
      <Modal
        title="筛选条件"
        open={showFilterModal}
        onCancel={() => setShowFilterModal(false)}
        onOk={() => {
          setFilters(tempFilters)
          setCurrentPage(1)
          setShowFilterModal(false)
        }}
        okText="应用"
        cancelText="取消"
        width={520}
        footer={[
          <Button key="clear" onClick={() => setTempFilters({})}>
            清除全部
          </Button>,
          <Button key="cancel" onClick={() => setShowFilterModal(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={() => {
            setFilters(tempFilters)
            setCurrentPage(1)
            setShowFilterModal(false)
          }}>
            应用
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {filterOptions.productLine.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#262626' }}>产品线</div>
              <Checkbox.Group
                options={filterOptions.productLine}
                value={tempFilters.productLine || []}
                onChange={(vals) => setTempFilters(prev => ({ ...prev, productLine: vals as string[] }))}
              />
            </div>
          )}
          {filterOptions.chipPlatform.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#262626' }}>平台厂商</div>
              <Checkbox.Group
                options={filterOptions.chipPlatform}
                value={tempFilters.chipPlatform || []}
                onChange={(vals) => setTempFilters(prev => ({ ...prev, chipPlatform: vals as string[] }))}
              />
            </div>
          )}
          {filterOptions.status.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#262626' }}>状态</div>
              <Checkbox.Group
                options={filterOptions.status}
                value={tempFilters.status || []}
                onChange={(vals) => setTempFilters(prev => ({ ...prev, status: vals as string[] }))}
              />
            </div>
          )}
          {filterOptions.tosVersion.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#262626' }}>tOS版本</div>
              <Checkbox.Group
                options={filterOptions.tosVersion}
                value={tempFilters.tosVersion || []}
                onChange={(vals) => setTempFilters(prev => ({ ...prev, tosVersion: vals as string[] }))}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Column Settings Modal */}
      <Modal
        title="列设置"
        open={showColumnModal}
        onCancel={() => setShowColumnModal(false)}
        onOk={() => setShowColumnModal(false)}
        okText="确定"
        cancelText="取消"
        width={400}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: '#8c8c8c' }}>
          &quot;项目名称&quot;和&quot;操作&quot;列始终显示，以下为可选列：
        </div>
        <Checkbox.Group
          value={visibleColumns}
          onChange={(vals) => setVisibleColumns(vals as string[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {settableColumns.map(col => (
            <Checkbox key={col.key} value={col.key}>{col.title}</Checkbox>
          ))}
        </Checkbox.Group>
      </Modal>

      {/* Save View Modal */}
      <Modal
        title="保存视图"
        open={showSaveViewModal}
        onCancel={() => {
          setShowSaveViewModal(false)
          setViewName('')
        }}
        onOk={handleSaveView}
        okText="保存"
        cancelText="取消"
        width={400}
      >
        <div style={{ marginBottom: 8, color: '#595959', fontSize: 13 }}>
          将当前的项目类型、筛选条件、列配置和分页设置保存为视图，便于下次快速切换。
        </div>
        <Input
          placeholder="请输入视图名称"
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          maxLength={30}
          onPressEnter={handleSaveView}
        />
      </Modal>

      {/* Fullscreen Modal */}
      <Modal
        open={isFullscreen}
        onCancel={() => setIsFullscreen(false)}
        footer={null}
        width="100vw"
        style={{ top: 0, maxWidth: '100vw', paddingBottom: 0 }}
        styles={{ body: { height: 'calc(100vh - 110px)', overflow: 'auto' } }}
        title={
          <Space>
            <span style={{ fontSize: 16, fontWeight: 600 }}>里程碑视图 - 全屏模式</span>
            <Tag>{projectType}</Tag>
          </Space>
        }
      >
        <div style={{ marginBottom: 12 }}>{toolbarActions}</div>
        {tableComponent}
      </Modal>
    </div>
  )
}
