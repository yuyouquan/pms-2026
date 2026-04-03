'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Table, Button, Space, Select, Tag, Modal, Checkbox, Input, Tabs, message, Tooltip, Popconfirm, Empty,
} from 'antd'
import {
  FilterOutlined, SettingOutlined, SaveOutlined, FullscreenOutlined, FullscreenExitOutlined,
  EyeOutlined, PlusOutlined, CameraOutlined, HistoryOutlined, DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RoadmapViewConfig } from '@/types'
import { aggregateMilestones, generateTableData, saveView, loadAllViews, deleteView } from './utils'

const PROJECT_TYPES = ['软件产品项目', '整机产品项目']

const PROJECT_TYPE_MAP: Record<string, string> = {
  '软件产品项目': '产品项目',
  '整机产品项目': '整机产品项目',
}

const DEFAULT_VIEW_ID = '__default__'

// 软件产品项目固定列
const SOFTWARE_FIXED_COLUMNS = [
  { key: 'projectName', title: '项目名称' },
  { key: 'versionType', title: '版本类型' },
  { key: 'currentNode', title: '当前节点' },
  { key: 'chipPlatform', title: '芯片平台' },
  { key: 'status', title: '状态' },
  { key: 'spm', title: 'SPM' },
]

// 整机产品项目固定列
const MACHINE_FIXED_COLUMNS = [
  { key: 'tosVersion', title: 'tOS版本' },
  { key: 'brand', title: '品牌' },
  { key: 'productType', title: '产品类型' },
  { key: 'productLine', title: '产品线' },
  { key: 'projectName', title: '项目名称' },
  { key: 'chipPlatform', title: '芯片平台' },
  { key: 'memory', title: '内存' },
  { key: 'versionType', title: '版本类型' },
  { key: 'developMode', title: '开发模式' },
  { key: 'status', title: '状态' },
  { key: 'spm', title: 'SPM' },
]

const FIXED_COLUMNS = SOFTWARE_FIXED_COLUMNS

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

function getFixedColumnsForType(projectType: string) {
  return projectType === '整机产品项目' ? MACHINE_FIXED_COLUMNS : SOFTWARE_FIXED_COLUMNS
}

function getDefaultVisibleColumns(projectType: string) {
  return getFixedColumnsForType(projectType).map(c => c.key)
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

  // Baseline snapshot state
  const [baselineSnapshots, setBaselineSnapshots] = useState<{
    id: string
    version: string
    createdAt: string
    projectType: string
    data: any[]
    milestones: { name: string; order: number }[]
  }[]>([])
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null)

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

  // Map display type to data type
  const dataType = PROJECT_TYPE_MAP[projectType] || projectType

  // Aggregate milestones
  const milestones = useMemo(() => {
    return aggregateMilestones(projects, dataType, marketPlanData, level1Tasks)
  }, [projects, dataType, marketPlanData, level1Tasks])

  // Generate table data
  const allTableData = useMemo(() => {
    return generateTableData(projects, milestones, dataType, marketPlanData, level1Tasks)
  }, [projects, milestones, dataType, marketPlanData, level1Tasks])

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
    const filteredProjects = projects.filter(p => p.type === dataType)
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
    const typeColumns = getFixedColumnsForType(projectType)

    // Build fixed columns dynamically based on type
    for (const col of typeColumns) {
      if (!visibleColumns.includes(col.key)) continue
      if (col.key === 'status') {
        cols.push({
          title: col.title, dataIndex: col.key, key: col.key, width: 90,
          render: (val: string) => {
            const colorMap: Record<string, string> = { '进行中': 'processing', '已完成': 'success', '筹备中': 'warning', '暂停': 'default', '未开始': 'default' }
            return <Tag color={colorMap[val] || 'default'}>{val}</Tag>
          },
        })
      } else if (col.key === 'projectName') {
        cols.push({
          title: col.title, dataIndex: col.key, key: col.key, width: 160,
          render: (text: string) => <span style={{ fontWeight: 500, fontSize: 13 }}>{text}</span>,
        })
      } else {
        cols.push({ title: col.title, dataIndex: col.key, key: col.key, width: 100 })
      }
    }

    // Dynamic milestone columns
    for (const ms of milestones) {
      cols.push({
        title: ms.name,
        dataIndex: `ms_${ms.name}`,
        key: `ms_${ms.name}`,
        width: 120,
        align: 'center' as const,
        render: (val: string) => (
          <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#595959' }}>{val}</span>
        ),
      })
    }

    // 整机产品项目：产品上市列
    if (projectType === '整机产品项目') {
      cols.push({
        title: '产品上市', dataIndex: 'launchDate', key: 'launchDate', width: 120, align: 'center' as const,
        render: (val: string) => <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#595959' }}>{val}</span>,
      })
    }

    // Fixed right - actions
    cols.push({
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 90,
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onViewProject(record.projectId, record.market)}
        >
          查看/记录
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

  // Create baseline snapshot
  const handleCreateSnapshot = () => {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const version = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const snapshot = {
      id: version,
      version,
      createdAt: now.toLocaleString('zh-CN'),
      projectType,
      data: JSON.parse(JSON.stringify(allTableData)),
      milestones: milestones.map(m => ({ name: m.name, order: m.order })),
    }
    setBaselineSnapshots(prev => [snapshot, ...prev])
    message.success(`基线快照 ${version} 已创建`)
  }

  // Delete baseline snapshot
  const handleDeleteSnapshot = (id: string) => {
    setBaselineSnapshots(prev => prev.filter(s => s.id !== id))
    if (activeSnapshotId === id) setActiveSnapshotId(null)
    message.success('快照已删除')
  }

  // Get current display data (snapshot or live)
  const activeSnapshot = activeSnapshotId ? baselineSnapshots.find(s => s.id === activeSnapshotId) : null
  const displayData = activeSnapshot ? activeSnapshot.data : tableData
  const displayMilestones = activeSnapshot ? activeSnapshot.milestones : milestones

  // Rebuild columns for snapshot milestones
  const displayColumns = useMemo((): ColumnsType<any> => {
    if (!activeSnapshot) return columns
    // Rebuild with snapshot milestones using same type-aware logic
    const cols: ColumnsType<any> = []
    const snapshotType = activeSnapshot.projectType
    const typeColumns = getFixedColumnsForType(snapshotType)
    for (const col of typeColumns) {
      if (!visibleColumns.includes(col.key)) continue
      if (col.key === 'status') {
        cols.push({
          title: col.title, dataIndex: col.key, key: col.key, width: 90,
          render: (val: string) => {
            const colorMap: Record<string, string> = { '进行中': 'processing', '已完成': 'success', '筹备中': 'warning', '暂停': 'default', '未开始': 'default' }
            return <Tag color={colorMap[val] || 'default'}>{val}</Tag>
          },
        })
      } else if (col.key === 'projectName') {
        cols.push({ title: col.title, dataIndex: col.key, key: col.key, width: 160, render: (text: string) => <span style={{ fontWeight: 500, fontSize: 13 }}>{text}</span> })
      } else {
        cols.push({ title: col.title, dataIndex: col.key, key: col.key, width: 100 })
      }
    }
    for (const ms of displayMilestones) {
      cols.push({
        title: ms.name, dataIndex: `ms_${ms.name}`, key: `ms_${ms.name}`, width: 120, align: 'center' as const,
        render: (val: string) => <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#595959' }}>{val}</span>,
      })
    }
    cols.push({
      title: '操作', key: 'action', fixed: 'right' as const, width: 80,
      render: (_: any, record: any) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewProject(record.projectId, record.market)}>查看/记录</Button>
      ),
    })
    return cols
  }, [activeSnapshot, visibleColumns, displayMilestones, onViewProject])

  const hasActiveFilters = Object.values(filters).some(v => v && v.length > 0)

  // Columns available for column settings (context-aware)
  const settableColumns = getFixedColumnsForType(projectType).filter(c => {
    return true // all columns configurable
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
      columns={displayColumns}
      dataSource={displayData}
      scroll={{ x: 'max-content' }}
      size="small"
      pagination={{
        current: currentPage,
        pageSize,
        total: displayData.length,
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

  // Filter snapshots for current project type
  const currentSnapshots = baselineSnapshots.filter(s => s.projectType === projectType)

  // Toolbar (right side buttons)
  const toolbarActions = (
    <Space wrap>
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
      <div style={{ width: 1, height: 20, background: '#e8e8e8', margin: '0 2px' }} />
      <Tooltip title="将当前数据创建基线快照">
        <Button
          icon={<CameraOutlined />}
          onClick={handleCreateSnapshot}
          disabled={!!activeSnapshotId}
        >
          基线快照
        </Button>
      </Tooltip>
      {currentSnapshots.length > 0 && (
        <Select
          value={activeSnapshotId || 'live'}
          onChange={(val) => setActiveSnapshotId(val === 'live' ? null : val)}
          style={{ width: 220 }}
          popupMatchSelectWidth={280}
          optionLabelProp="label"
        >
          <Select.Option value="live" label={<span><span style={{ color: '#52c41a', marginRight: 4 }}>●</span> 实时数据</span>}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#52c41a' }}>●</span>
              <span style={{ fontWeight: 500 }}>实时数据</span>
            </div>
          </Select.Option>
          {currentSnapshots.map(s => (
            <Select.Option key={s.id} value={s.id} label={<span><HistoryOutlined style={{ marginRight: 4, color: '#1890ff' }} /> {s.version}</span>}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.version}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>{s.createdAt}</div>
                </div>
                <DeleteOutlined
                  style={{ color: '#ff4d4f', fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(s.id) }}
                />
              </div>
            </Select.Option>
          ))}
        </Select>
      )}
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
      {/* Project Type Tabs */}
      <Tabs
        activeKey={projectType}
        onChange={(val) => {
          setProjectType(val)
          setActiveViewId(DEFAULT_VIEW_ID)
          setFilters({})
          setCurrentPage(1)
          setActiveSnapshotId(null)
        }}
        size="small"
        style={{ marginBottom: 8 }}
        items={PROJECT_TYPES.map(t => ({
          key: t,
          label: <span style={{ fontWeight: projectType === t ? 600 : 400, padding: '0 4px' }}>{t}</span>,
        }))}
      />

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

      {/* Snapshot banner */}
      {activeSnapshot && (
        <div style={{
          padding: '8px 16px', marginBottom: 8, borderRadius: 6,
          background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)',
          border: '1px solid #91caff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Space size={8}>
            <HistoryOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: 13, color: '#1890ff', fontWeight: 500 }}>
              正在查看基线快照: {activeSnapshot.version}
            </span>
            <Tag color="blue" style={{ fontSize: 11 }}>{activeSnapshot.createdAt}</Tag>
          </Space>
          <Button type="link" size="small" onClick={() => setActiveSnapshotId(null)}>返回实时数据</Button>
        </div>
      )}

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
