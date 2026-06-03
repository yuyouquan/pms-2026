'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Table, Button, Space, Select, Tag, Modal, Checkbox, Input, Tabs, message, Tooltip, Popconfirm, Empty, Dropdown, Drawer,
} from 'antd'
import {
  FilterOutlined, SettingOutlined, SaveOutlined, FullscreenOutlined, FullscreenExitOutlined,
  EyeOutlined, PlusOutlined, CameraOutlined, HistoryOutlined, DeleteOutlined, SwapOutlined, ArrowRightOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RoadmapFilterCondition, RoadmapViewConfig } from '@/types'
import {
  FILTER_OPERATORS,
  applyFilterConditions,
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  isFilterConditionActive,
  isValuelessFilterOperator,
  normalizeFilterConditions,
} from '@/lib/filterConditions'
import {
  aggregateMilestones, generateTableData, saveView, loadAllViews, deleteView,
  getFixedColumnsForType, getDefaultVisibleColumns, getMilestoneColumnKey, isRoadmapColumnVisible,
  diffSnapshots, buildCompareColumns,
  type DiffResult, type SnapshotLike,
} from './utils'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import { usePlanStore, LEVEL1_TEMPLATE_TASKS, getTemplateSnapshotKey } from '@/stores/plan'

const PROJECT_TYPES = ['软件产品项目', '整机产品项目']

const PROJECT_TYPE_MAP: Record<string, string> = {
  '软件产品项目': '产品项目',
  '整机产品项目': '整机产品项目',
}

const DEFAULT_VIEW_ID = '__default__'
const ROADMAP_DRAWER_Z_INDEX = 1200

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
  const { versions, publishedSnapshots } = usePlanStore()
  const [projectType, setProjectTypeLocal] = useState(initialProjectType || PROJECT_TYPES[0])
  const setProjectType = (val: string) => {
    setProjectTypeLocal(val)
    onProjectTypeChange?.(val)
  }
  const [filters, setFilters] = useState<RoadmapFilterCondition[]>([])
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
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

  // Temp filter state for drawer
  const [tempFilters, setTempFilters] = useState(filters)

  // Sync projectType from parent
  useEffect(() => {
    if (initialProjectType && initialProjectType !== projectType && PROJECT_TYPES.includes(initialProjectType)) {
      setProjectTypeLocal(initialProjectType)
      setActiveViewId(DEFAULT_VIEW_ID)
      setFilters([])
      setCurrentPage(1)
      setActiveSnapshotId(null)
      setCompareMode(false)
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

  // Reset page on compare mode toggle
  useEffect(() => {
    setCurrentPage(1)
  }, [compareMode])

  // Map display type to data type
  const dataType = PROJECT_TYPE_MAP[projectType] || projectType

  const latestPublishedVersion = useMemo(() => {
    return [...versions]
      .filter(v => v.status === '已发布')
      .sort((a, b) => parseInt(b.versionNo.replace('V', ''), 10) - parseInt(a.versionNo.replace('V', ''), 10))[0]
  }, [versions])

  const templateTasks = useMemo(() => {
    if (!latestPublishedVersion) return LEVEL1_TEMPLATE_TASKS
    const projectTypeSnapshot = publishedSnapshots[getTemplateSnapshotKey(dataType, latestPublishedVersion.id)]
    const fallbackSnapshot = publishedSnapshots[latestPublishedVersion.id]
    const snapshot = projectTypeSnapshot?.length ? projectTypeSnapshot : fallbackSnapshot
    return snapshot?.length ? snapshot : LEVEL1_TEMPLATE_TASKS
  }, [dataType, latestPublishedVersion, publishedSnapshots])

  // Aggregate milestones
  const milestones = useMemo(() => {
    return aggregateMilestones(templateTasks)
  }, [templateTasks])

  const defaultVisibleColumns = useMemo(() => {
    return getDefaultVisibleColumns(projectType, milestones)
  }, [projectType, milestones])

  // Update visible columns when projectType or template milestones change.
  useEffect(() => {
    if (activeViewId === DEFAULT_VIEW_ID) {
      setVisibleColumns(defaultVisibleColumns)
    }
  }, [activeViewId, defaultVisibleColumns])

  // Generate table data
  const allTableData = useMemo(() => {
    return generateTableData(projects, milestones, dataType, marketPlanData, level1Tasks)
  }, [projects, milestones, dataType, marketPlanData, level1Tasks])

  // Apply filters
  const tableData = useMemo(() => {
    return applyFilterConditions(allTableData, filters)
  }, [allTableData, filters])

  const renderProjectCell = (key: string, val: any) => {
    if (key === 'status') {
      const colorMap: Record<string, string> = { '进行中': 'processing', '已完成': 'success', '筹备中': 'warning', '待立项': 'warning', '暂停': 'default', '已上市': 'purple', '维护': 'cyan', '已取消': 'error' }
      return <Tag color={colorMap[val] || 'default'}>{val || '-'}</Tag>
    }
    if (key === 'healthStatus') {
      const config: Record<string, { label: string; color: string }> = {
        normal: { label: '正常', color: 'success' },
        warning: { label: '预警', color: 'warning' },
        risk: { label: '风险', color: 'error' },
      }
      const item = config[val] || { label: val || '-', color: 'default' }
      return <Tag color={item.color}>{item.label}</Tag>
    }
    if (key === 'projectName') {
      return <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{val || '-'}</span>
    }
    if (key === 'market') {
      return <Tag color={marketColors[val] || 'default'} style={{ fontWeight: 600 }}>{val || '-'}</Tag>
    }
    if (key === 'projectDescription') {
      return (
        <Tooltip title={val === '-' ? '' : val}>
          <span style={{ display: 'inline-block', maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: val === '-' ? '#bfbfbf' : '#4b5563' }}>{val || '-'}</span>
        </Tooltip>
      )
    }
    return <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#4b5563' }}>{val || '-'}</span>
  }

  const buildStandardColumns = (sourceMilestones: { name: string; order: number }[], sourceProjectType = projectType): ColumnsType<any> => {
    const cols: ColumnsType<any> = []
    const typeColumns = getFixedColumnsForType(sourceProjectType)

    for (const col of typeColumns) {
      if (!isRoadmapColumnVisible(sourceProjectType, visibleColumns, col.key)) continue
      cols.push({
        title: col.title,
        dataIndex: col.key,
        key: col.key,
        width: col.width || 100,
        fixed: col.locked ? 'left' as const : undefined,
        render: (val: any) => renderProjectCell(col.key, val),
      })
    }

    for (const ms of sourceMilestones) {
      const field = getMilestoneColumnKey(ms.name)
      if (!visibleColumns.includes(field)) continue
      cols.push({
        title: ms.name,
        dataIndex: field,
        key: field,
        width: 120,
        align: 'center' as const,
        render: (val: string) => (
          <span style={{ fontSize: 12, color: val === '-' ? '#bfbfbf' : '#4b5563' }}>{val || '-'}</span>
        ),
      })
    }

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
  }

  // Build columns
  const columns = useMemo((): ColumnsType<any> => {
    return buildStandardColumns(milestones)
  }, [visibleColumns, milestones, onViewProject, projectType])

  // Reset to default view state
  const resetToDefault = () => {
    setFilters([])
    setVisibleColumns(defaultVisibleColumns)
    setPageSize(10)
    setCurrentPage(1)
  }

  // ========== 导出 Excel ==========
  const handleExport = (scope: 'current' | 'all') => {
    // 列集合：scope='current' 用当前可见列，scope='all' 用全部固定列 + 全部里程碑
    const fixedCols = getFixedColumnsForType(projectType)
    const visibleFixedKeys = scope === 'current'
      ? fixedCols.filter(c => isRoadmapColumnVisible(projectType, visibleColumns, c.key)).map(c => c.key)
      : fixedCols.map(c => c.key)
    const exportMilestones = scope === 'current'
      ? milestones.filter(ms => visibleColumns.includes(getMilestoneColumnKey(ms.name)))
      : milestones

    const exportCols: ExportColumn[] = []
    for (const col of fixedCols) {
      if (!visibleFixedKeys.includes(col.key)) continue
      exportCols.push({ key: col.key, title: col.title })
    }
    for (const ms of exportMilestones) {
      exportCols.push({ key: getMilestoneColumnKey(ms.name), title: ms.name })
    }

    // 数据源：scope='current' 用筛选后的 tableData，scope='all' 用 allTableData
    const rows = scope === 'current' ? tableData : allTableData

    const filename = `里程碑视图_${projectType}_${exportTimestamp()}.xlsx`
    exportSheet(rows, exportCols, filename, '里程碑视图')
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
      filters: [...filters],
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
    setFilters(Array.isArray(view.filters) ? view.filters : [])
    setVisibleColumns(view.visibleColumns || getDefaultVisibleColumns(view.projectType || projectType, milestones))
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

  const formatCompareSrcLabel = (src: CompareSource): string => {
    if (src === 'live') return '实时数据'
    const snap = baselineSnapshots.find(s => s.id === src)
    return snap ? snap.version : src
  }

  // Compare mode: resolve sources and compute diff
  const resolveCompareSource = (src: CompareSource): SnapshotLike => {
    if (src === 'live') {
      return { data: allTableData, milestones: milestones.map(m => ({ name: m.name, order: m.order })) }
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
  }, [compareMode, compareBase, compareTarget, allTableData, milestones, baselineSnapshots, projectType])

  // Auto-exit compare mode if a selected snapshot is deleted
  useEffect(() => {
    if (!compareMode) return
    const baseOk = compareBase === 'live' || baselineSnapshots.some(s => s.id === compareBase)
    const targetOk = compareTarget === 'live' || baselineSnapshots.some(s => s.id === compareTarget)
    if (!baseOk || !targetOk) {
      setCompareMode(false)
      message.info('所选快照已被删除，已退出对比')
    }
  }, [baselineSnapshots, compareMode, compareBase, compareTarget])

  // Get current display data (compare / snapshot / live)
  const activeSnapshot = activeSnapshotId ? baselineSnapshots.find(s => s.id === activeSnapshotId) : null

  const displayData: any[] = useMemo(() => {
    if (compareMode && diffResult) {
      let rows = diffResult.rows
      rows = rows.filter(r => applyFilterConditions([r.target ?? r.base].filter(Boolean), filters).length > 0)
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
    return buildStandardColumns(displayMilestones, activeSnapshot.projectType)
  }, [compareMode, diffResult, activeSnapshot, visibleColumns, displayMilestones, onViewProject, projectType, columns])

  const hasActiveFilters = filters.some(isFilterConditionActive)

  // Columns available for column settings (context-aware)
  const projectInfoSettableColumns = getFixedColumnsForType(projectType).filter(c => !c.locked)
  const milestoneSettableColumns = milestones.map(ms => ({
    key: getMilestoneColumnKey(ms.name),
    title: ms.name,
    defaultRoadmap: !!ms.defaultRoadmap,
  }))
  const filterFieldOptions = [
    ...getFixedColumnsForType(projectType).map(c => ({ value: c.key, label: c.title })),
    ...milestones.map(ms => ({ value: getMilestoneColumnKey(ms.name), label: ms.name })),
  ]

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
          onClick={() => { setTempFilters(filters.length ? filters.map(f => ({ ...f })) : [createFilterCondition()]); setShowFilterModal(true) }}
          type={hasActiveFilters ? 'primary' : 'default'}
          ghost={hasActiveFilters}
          size="small"
          style={{ borderRadius: 6 }}
        >
          筛选{hasActiveFilters ? ' ●' : ''}
        </Button>
      </Tooltip>
      <Tooltip title="列设置">
        <Button icon={<SettingOutlined />} size="small" style={{ borderRadius: 6 }} onClick={() => setShowColumnModal(true)}>列设置</Button>
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
      <Dropdown
        menu={{
          items: [
            { key: 'current', label: '导出当前视图' },
            { key: 'all', label: `导出全部（${projectType}）` },
          ],
          onClick: ({ key }) => handleExport(key as 'current' | 'all'),
        }}
      >
        <Tooltip title="导出为 Excel">
          <Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: 6 }} />
        </Tooltip>
      </Dropdown>
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
                  setFilters([])
                  setCurrentPage(1)
                  setActiveSnapshotId(null)
                  setCompareMode(false)
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

      {/* 快照提示条（单快照查看时） */}
      {activeSnapshot && !compareMode && (
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

      {/* 对比摘要条（对比模式时） */}
      {compareMode && diffResult && (
        <div style={{
          padding: '10px 16px', marginBottom: 12, borderRadius: 8,
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '1px solid rgba(217,119,6,0.25)',
          boxShadow: '0 2px 8px rgba(217,119,6,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
        }}>
          <Space size={10} wrap>
            <SwapOutlined style={{ color: '#b45309', fontSize: 16 }} />
            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>对比模式</span>
            <Tag color="default" style={{ fontSize: 11 }}>基准: {formatCompareSrcLabel(compareBase)}</Tag>
            <ArrowRightOutlined style={{ color: '#9ca3af', fontSize: 11 }} />
            <Tag color="gold" style={{ fontSize: 11 }}>对比: {formatCompareSrcLabel(compareTarget)}</Tag>
            <span style={{ color: '#22c55e', fontSize: 12 }}>🟢 新增 {diffResult.summary.added} 行</span>
            <span style={{ color: '#ef4444', fontSize: 12 }}>🔴 删除 {diffResult.summary.removed} 行</span>
            <span style={{ color: '#d97706', fontSize: 12 }}>🟠 修改 {diffResult.summary.modified} 行（共 {diffResult.summary.cellChanges} 处字段变化）</span>
          </Space>
          <Space size={6}>
            <Checkbox checked={onlyDiffRows} onChange={e => { setOnlyDiffRows(e.target.checked); setCurrentPage(1) }}>
              <span style={{ fontSize: 12 }}>只看有差异的行</span>
            </Checkbox>
            <Button size="small" onClick={() => setShowCompareModal(true)}>切换版本</Button>
            <Button size="small" danger onClick={() => setCompareMode(false)}>退出对比</Button>
          </Space>
        </div>
      )}

      {/* 数据表格 */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        {tableComponent}
      </div>

      {/* Filter Drawer */}
      <Drawer
        title="筛选条件"
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        width={520}
        placement="right"
        zIndex={ROADMAP_DRAWER_Z_INDEX}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button key="clear" onClick={() => setTempFilters([createFilterCondition()])}>
              清除全部
            </Button>
            <Space>
              <Button key="cancel" onClick={() => setShowFilterModal(false)}>
                取消
              </Button>
              <Button key="ok" type="primary" onClick={() => {
                setFilters(normalizeFilterConditions(tempFilters))
                setCurrentPage(1)
                setShowFilterModal(false)
              }}>
                应用
              </Button>
            </Space>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tempFilters.map((condition) => (
            <div key={condition.id} style={{ padding: 12, border: '1px solid #eef2ff', borderRadius: 8, background: '#fafbff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 116px 40px', gap: 8, marginBottom: isValuelessFilterOperator(condition.operator) ? 0 : 8 }}>
                <Select
                  aria-label="筛选字段"
                  placeholder="筛选字段"
                  value={condition.field || undefined}
                  options={getFieldOptionsWithDuplicateDisabled(filterFieldOptions, tempFilters, condition.id)}
                  onChange={(value) => setTempFilters(prev => prev.map(item => item.id === condition.id ? { ...item, field: value } : item))}
                />
                <Select
                  value={condition.operator}
                  options={FILTER_OPERATORS as any}
                  onChange={(value) => {
                    const operator = value as RoadmapFilterCondition['operator']
                    setTempFilters(prev => prev.map(item => item.id === condition.id ? {
                      ...item,
                      operator,
                      value: isValuelessFilterOperator(operator) ? '' : item.value,
                    } : item))
                  }}
                />
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => setTempFilters(prev => prev.length > 1 ? prev.filter(item => item.id !== condition.id) : [createFilterCondition()])}
                />
              </div>
              {!isValuelessFilterOperator(condition.operator) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    placeholder="输入筛选值"
                    value={condition.value}
                    onChange={(e) => setTempFilters(prev => prev.map(item => item.id === condition.id ? { ...item, value: e.target.value } : item))}
                  />
                </div>
              )}
            </div>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setTempFilters(prev => [...prev, createFilterCondition()])}
          >
            添加条件
          </Button>
        </div>
      </Drawer>

      {/* Column Settings Drawer */}
      <Drawer
        title="列设置"
        open={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        width={420}
        placement="right"
        zIndex={ROADMAP_DRAWER_Z_INDEX}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setVisibleColumns(defaultVisibleColumns)}>重置默认</Button>
            <Space>
              <Button onClick={() => setShowColumnModal(false)}>取消</Button>
              <Button type="primary" onClick={() => setShowColumnModal(false)}>确定</Button>
            </Space>
          </div>
        )}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: '#9ca3af' }}>
          {projectType === '整机产品项目' ? '项目名、市场' : '项目名称'}为固定列，始终显示。
        </div>
        <Checkbox.Group
          value={visibleColumns}
          onChange={(vals) => setVisibleColumns(vals as string[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '8px 0 2px' }}>项目信息字段</div>
          {projectInfoSettableColumns.map(col => (
            <Checkbox key={col.key} value={col.key}>{col.title}</Checkbox>
          ))}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '14px 0 2px' }}>里程碑信息字段</div>
          {milestoneSettableColumns.map(col => (
            <Checkbox key={col.key} value={col.key}>
              <Space size={6}>
                <span>{col.title}</span>
                {col.defaultRoadmap && <Tag color="green" style={{ marginInlineEnd: 0 }}>默认</Tag>}
              </Space>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Drawer>

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
