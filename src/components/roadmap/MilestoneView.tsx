'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Table, Button, Space, Select, Tag, Modal, Checkbox, Input, Tabs, message, Tooltip, Popconfirm, Empty,
} from 'antd'
import {
  FilterOutlined, SettingOutlined, SaveOutlined, FullscreenOutlined, FullscreenExitOutlined,
  EyeOutlined, PlusOutlined, CameraOutlined, HistoryOutlined, DeleteOutlined, SwapOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RoadmapViewConfig } from '@/types'
import {
  aggregateMilestones, generateTableData, saveView, loadAllViews, deleteView,
  SOFTWARE_FIXED_COLUMNS, MACHINE_FIXED_COLUMNS, getFixedColumnsForType, getDefaultVisibleColumns,
  diffSnapshots, buildCompareColumns,
  type DiffResult, type SnapshotLike,
} from './utils'

const PROJECT_TYPES = ['软件产品项目', '整机产品项目']

const PROJECT_TYPE_MAP: Record<string, string> = {
  '软件产品项目': '产品项目',
  '整机产品项目': '整机产品项目',
}

const DEFAULT_VIEW_ID = '__default__'

const marketColors: Record<string, string> = {
  'OP': '#6366f1', 'TR': '#52c41a', 'RU': '#faad14',
  'FR': '#722ed1', 'IN': '#eb2f96', 'BR': '#13c2c2',
}

interface MilestoneViewProps {
  projects: any[]
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>
  level1Tasks: any[]
  onViewProject: (projectId: string, market?: string) => void
  initialProjectType?: string
  onProjectTypeChange?: (type: string) => void
  hideProjectTypeTabs?: boolean
}

export default function MilestoneView({ projects, marketPlanData, level1Tasks, onViewProject, initialProjectType, onProjectTypeChange, hideProjectTypeTabs }: MilestoneViewProps) {
  const [projectType, setProjectTypeLocal] = useState(initialProjectType || PROJECT_TYPES[0])
  const setProjectType = (val: string) => {
    setProjectTypeLocal(val)
    onProjectTypeChange?.(val)
  }
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

  // Compare mode state (added 2026-04-10)
  type CompareSource = 'live' | string
  const [compareMode, setCompareMode] = useState(false)
  const [compareBase, setCompareBase] = useState<CompareSource>('live')
  const [compareTarget, setCompareTarget] = useState<CompareSource>('live')
  const [onlyDiffRows, setOnlyDiffRows] = useState(true)
  const [showCompareModal, setShowCompareModal] = useState(false)

  // Temp filter state for modal
  const [tempFilters, setTempFilters] = useState(filters)

  // Sync projectType from parent
  useEffect(() => {
    if (initialProjectType && initialProjectType !== projectType && PROJECT_TYPES.includes(initialProjectType)) {
      setProjectTypeLocal(initialProjectType)
      setActiveViewId(DEFAULT_VIEW_ID)
      setFilters({})
      setCurrentPage(1)
      setActiveSnapshotId(null)
    }
  }, [initialProjectType])

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
          <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#4b5563' }}>{val}</span>
        ),
      })
    }

    // 整机产品项目：产品上市列
    if (projectType === '整机产品项目') {
      cols.push({
        title: '产品上市', dataIndex: 'launchDate', key: 'launchDate', width: 120, align: 'center' as const,
        render: (val: string) => <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#4b5563' }}>{val}</span>,
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

  // Compare mode: resolve sources and compute diff
  const resolveCompareSource = (src: CompareSource): SnapshotLike => {
    if (src === 'live') {
      return { data: tableData, milestones: milestones.map(m => ({ name: m.name, order: m.order })) }
    }
    const snap = baselineSnapshots.find(s => s.id === src)
    if (!snap) {
      return { data: [], milestones: [] }
    }
    return { data: snap.data, milestones: snap.milestones }
  }

  const diffResult = useMemo(() => {
    if (!compareMode) return null
    const baseSrc = resolveCompareSource(compareBase)
    const targetSrc = resolveCompareSource(compareTarget)
    return diffSnapshots(baseSrc, targetSrc, projectType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareMode, compareBase, compareTarget, tableData, milestones, baselineSnapshots, projectType])

  // Get current display data (compare / snapshot / live)
  const activeSnapshot = activeSnapshotId ? baselineSnapshots.find(s => s.id === activeSnapshotId) : null

  const displayData: any[] = useMemo(() => {
    if (compareMode && diffResult) {
      let rows = diffResult.rows
      // Apply existing filters to diff rows (using target ?? base for field lookup)
      if (filters.productLine?.length) {
        rows = rows.filter(r => {
          const src = r.target ?? r.base
          return src && filters.productLine!.includes(src.productLine)
        })
      }
      if (filters.chipPlatform?.length) {
        rows = rows.filter(r => {
          const src = r.target ?? r.base
          return src && filters.chipPlatform!.includes(src.chipPlatform)
        })
      }
      if (filters.status?.length) {
        rows = rows.filter(r => {
          const src = r.target ?? r.base
          return src && filters.status!.includes(src.status)
        })
      }
      if (filters.tosVersion?.length) {
        rows = rows.filter(r => {
          const src = r.target ?? r.base
          return src && filters.tosVersion!.includes(src.tosVersion)
        })
      }
      if (onlyDiffRows) {
        rows = rows.filter(r => r.rowStatus !== 'same')
      }
      return rows
    }
    return activeSnapshot ? activeSnapshot.data : tableData
  }, [compareMode, diffResult, onlyDiffRows, filters, activeSnapshot, tableData])

  const displayMilestones = compareMode && diffResult
    ? diffResult.mergedMilestones
    : (activeSnapshot ? activeSnapshot.milestones : milestones)

  // Rebuild columns (compare / snapshot / live)
  const displayColumns = useMemo((): ColumnsType<any> => {
    if (compareMode && diffResult) {
      return buildCompareColumns(diffResult, visibleColumns, projectType, onViewProject)
    }
    if (!activeSnapshot) return columns

    // Existing snapshot column logic (unchanged)
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
        render: (val: string) => <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#4b5563' }}>{val}</span>,
      })
    }
    cols.push({
      title: '操作', key: 'action', fixed: 'right' as const, width: 80,
      render: (_: any, record: any) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewProject(record.projectId, record.market)}>查看/记录</Button>
      ),
    })
    return cols
  }, [compareMode, diffResult, activeSnapshot, visibleColumns, displayMilestones, onViewProject, projectType, columns])

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
      rowKey={(r: any) => compareMode ? r.rowKey : r.key}
      rowClassName={(r: any) => {
        if (!compareMode) return ''
        if (r.rowStatus === 'added') return 'row-diff-added'
        if (r.rowStatus === 'removed') return 'row-diff-removed'
        if (r.rowStatus === 'modified') return 'row-diff-modified'
        return ''
      }}
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
      locale={{ emptyText: <Empty description={compareMode && onlyDiffRows ? '两个版本无差异' : '暂无数据'} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
  )

  // Filter snapshots for current project type
  const currentSnapshots = baselineSnapshots.filter(s => s.projectType === projectType)

  // Toolbar (right side buttons)
  const toolbarActions = (
    <Space size={6}>
      <Tooltip title="筛选">
        <Button
          icon={<FilterOutlined />}
          onClick={() => { setTempFilters({ ...filters }); setShowFilterModal(true) }}
          type={hasActiveFilters ? 'primary' : 'default'}
          ghost={hasActiveFilters}
          size="small"
          style={{ borderRadius: 6 }}
        >
          筛选{hasActiveFilters ? ' ●' : ''}
        </Button>
      </Tooltip>
      <Tooltip title="列设置">
        <Button icon={<SettingOutlined />} size="small" style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)} />
      </Tooltip>
      <div style={{ width: 1, height: 18, background: '#e0e0e0' }} />
      <Tooltip title={compareMode ? '对比模式下不可创建快照' : '将当前数据创建基线快照'}>
        <Button
          icon={<CameraOutlined />}
          size="small"
          style={{ borderRadius: 6 }}
          onClick={handleCreateSnapshot}
          disabled={!!activeSnapshotId || compareMode}
        >
          快照
        </Button>
      </Tooltip>
      {!compareMode && currentSnapshots.length > 0 && (
        <Select
          value={activeSnapshotId || 'live'}
          onChange={(val) => setActiveSnapshotId(val === 'live' ? null : val)}
          style={{ width: 180 }}
          size="small"
          popupMatchSelectWidth={240}
          optionLabelProp="label"
        >
          <Select.Option value="live" label={<span style={{ fontSize: 12 }}><span style={{ color: '#52c41a', marginRight: 4 }}>●</span>实时数据</span>}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#52c41a' }}>●</span>
              <span style={{ fontWeight: 500 }}>实时数据</span>
            </div>
          </Select.Option>
          {currentSnapshots.map(s => (
            <Select.Option key={s.id} value={s.id} label={<span style={{ fontSize: 12 }}><HistoryOutlined style={{ marginRight: 4, color: '#6366f1' }} />{s.version}</span>}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{s.version}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.createdAt}</div>
                </div>
                <DeleteOutlined style={{ color: '#ff4d4f', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(s.id) }} />
              </div>
            </Select.Option>
          ))}
        </Select>
      )}
      <Tooltip title={currentSnapshots.length === 0 ? '请先至少创建一个快照' : '对比两个版本'}>
        <Button
          icon={<SwapOutlined />}
          size="small"
          style={{ borderRadius: 6 }}
          onClick={() => setShowCompareModal(true)}
          disabled={currentSnapshots.length === 0}
          type={compareMode ? 'primary' : 'default'}
          ghost={compareMode}
        >
          {compareMode ? '对比中' : '对比'}
        </Button>
      </Tooltip>
      <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
        <Button icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} size="small" style={{ borderRadius: 6 }} onClick={() => setIsFullscreen(!isFullscreen)} />
      </Tooltip>
    </Space>
  )

  return (
    <div>
      {/* 项目类型切换 - 当外层已处理时隐藏 */}
      {!hideProjectTypeTabs && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
          padding: '3px 4px', background: '#f3f4f6', borderRadius: 22, width: 'fit-content',
        }}>
          {PROJECT_TYPES.map(t => {
            const isActive = projectType === t
            return (
              <div
                key={t}
                onClick={() => {
                  setProjectType(t)
                  setActiveViewId(DEFAULT_VIEW_ID)
                  setFilters({})
                  setCurrentPage(1)
                  setActiveSnapshotId(null)
                }}
                style={{
                  padding: '6px 20px', borderRadius: 18, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.25s ease',
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? '#6366f1' : '#9ca3af',
                  boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.2)' : 'none',
                }}
              >
                {t}
              </div>
            )
          })}
        </div>
      )}

      {/* 工具栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '10px 16px', marginBottom: 12,
        background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)',
        borderRadius: 10, border: '1px solid rgba(99,102,241,0.08)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}>
        {/* 左侧: 视图切换 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 2 }}>视图</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 3px', background: '#f3f4f6', borderRadius: 16 }}>
            {viewTabs.map(tab => {
              const isActive = activeViewId === tab.key
              return (
                <div
                  key={tab.key}
                  onClick={() => handleViewTabChange(tab.key)}
                  style={{
                    padding: '3px 12px', borderRadius: 14, cursor: 'pointer',
                    fontSize: 12, fontWeight: 500, transition: 'all 0.3s ease',
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#6366f1' : '#4b5563',
                    boxShadow: isActive ? '0 2px 6px rgba(99,102,241,0.12)' : 'none',
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.closable && (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleViewTabEdit(tab.key, 'remove') }}
                      style={{ fontSize: 10, color: '#bfbfbf', marginLeft: 2, cursor: 'pointer', lineHeight: 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ff4d4f')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#bfbfbf')}
                    >
                      ✕
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div
            onClick={() => handleViewTabEdit('', 'add')}
            style={{
              padding: '3px 10px', borderRadius: 14, cursor: 'pointer',
              fontSize: 11, color: '#6366f1', border: '1px dashed #a5b4fc',
              display: 'flex', alignItems: 'center', gap: 3,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <PlusOutlined style={{ fontSize: 10 }} /> 保存
          </div>
        </div>
        {/* 右侧: 操作按钮 */}
        <div style={{ flexShrink: 0 }}>
          {toolbarActions}
        </div>
      </div>

      {/* 快照提示条 */}
      {activeSnapshot && (
        <div style={{
          padding: '8px 16px', marginBottom: 12, borderRadius: 8,
          background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
          border: '1px solid rgba(99,102,241,0.2)',
          boxShadow: '0 2px 8px rgba(99,102,241,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Space size={8}>
            <HistoryOutlined style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 500 }}>
              基线快照: {activeSnapshot.version}
            </span>
            <Tag color="blue" style={{ fontSize: 11 }}>{activeSnapshot.createdAt}</Tag>
          </Space>
          <Button type="link" size="small" onClick={() => setActiveSnapshotId(null)}>返回实时数据</Button>
        </div>
      )}

      {/* 数据表格 */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        {tableComponent}
      </div>

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
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#111827' }}>产品线</div>
              <Checkbox.Group
                options={filterOptions.productLine}
                value={tempFilters.productLine || []}
                onChange={(vals) => setTempFilters(prev => ({ ...prev, productLine: vals as string[] }))}
              />
            </div>
          )}
          {filterOptions.chipPlatform.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#111827' }}>平台厂商</div>
              <Checkbox.Group
                options={filterOptions.chipPlatform}
                value={tempFilters.chipPlatform || []}
                onChange={(vals) => setTempFilters(prev => ({ ...prev, chipPlatform: vals as string[] }))}
              />
            </div>
          )}
          {filterOptions.status.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#111827' }}>状态</div>
              <Checkbox.Group
                options={filterOptions.status}
                value={tempFilters.status || []}
                onChange={(vals) => setTempFilters(prev => ({ ...prev, status: vals as string[] }))}
              />
            </div>
          )}
          {filterOptions.tosVersion.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#111827' }}>tOS版本</div>
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
        <div style={{ marginBottom: 8, fontSize: 12, color: '#9ca3af' }}>
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
        <div style={{ marginBottom: 8, color: '#4b5563', fontSize: 13 }}>
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

      {/* Compare Entry Modal */}
      <Modal
        title="选择要对比的两个版本"
        open={showCompareModal}
        onCancel={() => setShowCompareModal(false)}
        onOk={() => {
          if (compareBase === compareTarget) {
            message.warning('请选择两个不同的版本')
            return
          }
          setCompareMode(true)
          setActiveSnapshotId(null)
          setShowCompareModal(false)
          setCurrentPage(1)
        }}
        okText="开始对比"
        cancelText="取消"
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>基准版本（旧）</div>
            <Select
              value={compareBase}
              onChange={setCompareBase}
              style={{ width: '100%' }}
            >
              <Select.Option value="live">
                <span style={{ color: '#52c41a', marginRight: 4 }}>●</span>实时数据
              </Select.Option>
              {currentSnapshots.map(s => (
                <Select.Option key={s.id} value={s.id}>
                  <HistoryOutlined style={{ marginRight: 4, color: '#6366f1' }} />
                  {s.version}
                  <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>{s.createdAt}</span>
                </Select.Option>
              ))}
            </Select>
          </div>
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>↓ 对比到 ↓</div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>对比版本（新）</div>
            <Select
              value={compareTarget}
              onChange={setCompareTarget}
              style={{ width: '100%' }}
            >
              <Select.Option value="live">
                <span style={{ color: '#52c41a', marginRight: 4 }}>●</span>实时数据
              </Select.Option>
              {currentSnapshots.map(s => (
                <Select.Option key={s.id} value={s.id}>
                  <HistoryOutlined style={{ marginRight: 4, color: '#6366f1' }} />
                  {s.version}
                  <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>{s.createdAt}</span>
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
