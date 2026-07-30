'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Card, Tag, Space, Input, Button, Tooltip, Empty, Segmented, Divider, Row, Col
} from 'antd'
import {
  SearchOutlined, BarChartOutlined, TableOutlined,
  UnorderedListOutlined, SettingOutlined
} from '@ant-design/icons'
import { initialProjects, PROJECT_TYPE_COLORS } from '@/data/projects'
import {
  TaskTable,
  HorizontalTable,
  GanttChart,
  ALL_COLUMNS,
  DEFAULT_PLAN_COLUMN_SETTINGS,
  VERSION_DATA,
  LEVEL1_TASKS,
} from '@/components/plan/PlanModule'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  getDefaultColumnSettings,
  type SortableColumnDefinition,
  type SortableColumnSettingsValue,
} from '@/lib/columnSettings'
import { isMachineProjectType } from '@/constants/projectTypes'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'

function SharePlanContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const level = searchParams.get('level') || 'level1'
  const planType = searchParams.get('planType') || ''

  // Find project
  const project = initialProjects.find(p => p.id === projectId)

  // Versions — published only
  const publishedVersions = VERSION_DATA.filter(v => v.status === '已发布')
  const latestVersion = [...publishedVersions].sort((a, b) => {
    return parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', ''))
  })[0]

  // Is 整机产品项目 with markets?
  const isWholeMachine = isMachineProjectType(project?.type) && project?.markets && project.markets.length > 0
  const markets = isWholeMachine ? (project.markets as string[]) : []

  // Build market plan data — each market gets its own copy of L1 tasks
  const allMarketData = useMemo(() => {
    if (!isWholeMachine) return null
    const data: Record<string, any[]> = {}
    markets.forEach(m => {
      data[m] = LEVEL1_TASKS.map(t => ({ ...t }))
    })
    return data
  }, [isWholeMachine, markets.join(',')])

  // State
  const [selectedMarket, setSelectedMarket] = useState(markets[0] || '')
  const [viewMode, setViewMode] = useState<'table' | 'horizontal' | 'gantt'>('table')
  const [searchText, setSearchText] = useState('')
  const columnDefinitions: readonly SortableColumnDefinition<string>[] = ALL_COLUMNS
  const [columnSettings, setColumnSettings] = useState<SortableColumnSettingsValue<string>>(
    () => getDefaultColumnSettings(columnDefinitions),
  )
  const [showColumnModal, setShowColumnModal] = useState(false)

  // Current tasks based on market selection
  const tasks = useMemo(() => {
    if (isWholeMachine && allMarketData && selectedMarket) {
      return allMarketData[selectedMarket] || [...LEVEL1_TASKS]
    }
    return [...LEVEL1_TASKS]
  }, [isWholeMachine, allMarketData, selectedMarket])

  // Plan title
  const planTitle = level === 'level1' ? '一级计划' : planType || '二级计划'

  // Error: project not found
  if (!projectId || !project) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 80px' }}>
          <Empty description={<span style={{ color: '#9ca3af', fontSize: 14 }}>项目不存在或链接无效</span>} />
        </Card>
      </div>
    )
  }

  // Error: no published version
  if (!latestVersion) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 80px' }}>
          <Empty description={<span style={{ color: '#9ca3af', fontSize: 14 }}>该项目暂无已发布的计划</span>} />
        </Card>
      </div>
    )
  }

  const typeColor = PROJECT_TYPE_COLORS[project.type] || { bg: 'rgba(140,140,140,0.08)', color: '#8c8c8c' }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>
      {/* Header Info Bar */}
      <Card
        size="small"
        style={{
          marginBottom: 16, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(238,242,255,0.8))',
          border: '1px solid rgba(99,102,241,0.1)',
        }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space size={12}>
            <Tag style={{ fontSize: 12, borderRadius: 4, background: typeColor.bg, color: typeColor.color, border: 'none', padding: '2px 10px' }}>
              {project.type}
            </Tag>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
              {isMachineProjectType(project.type) && project.marketName ? project.marketName : project.name}
              <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>·</span>
              <span style={{ color: '#6366f1', marginLeft: 8 }}>{planTitle}</span>
            </span>
          </Space>
          <Space size={16} split={<Divider type="vertical" style={{ margin: 0, borderColor: 'rgba(99,102,241,0.15)' }} />}>
            <Space size={4}>
              <Tag color="green" style={{ fontSize: 12 }}>{latestVersion.versionNo}</Tag>
              <Tag color="success" style={{ fontSize: 11 }}>已发布</Tag>
            </Space>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>SPM: {(project as any).spm || '-'}</span>
          </Space>
        </div>
      </Card>

      {/* Toolbar */}
      <Card
        size="small"
        style={{ marginBottom: 16, borderRadius: 10 }}
        styles={{ body: { padding: '8px 16px' } }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Space size={8}>
              {/* Market tabs for 整机产品项目 */}
              {isWholeMachine && markets.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 3px', background: 'rgba(99,102,241,0.05)', borderRadius: 8 }}>
                    {markets.map(m => (
                      <div
                        key={m}
                        onClick={() => setSelectedMarket(m)}
                        style={{
                          padding: '4px 14px', borderRadius: 6, cursor: 'pointer',
                          fontSize: 13, fontWeight: selectedMarket === m ? 600 : 400,
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          background: selectedMarket === m ? '#fff' : 'transparent',
                          color: selectedMarket === m ? '#4338ca' : '#9ca3af',
                          boxShadow: selectedMarket === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                  <Divider type="vertical" style={{ margin: '0 4px', borderColor: 'rgba(99,102,241,0.12)' }} />
                </>
              )}
              <Input
                placeholder="搜索任务..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                style={{ width: 200, borderRadius: 6 }}
                allowClear
                onChange={(e) => setSearchText(e.target.value)}
              />
              {viewMode === 'table' && (
                <SortableColumnSettings
                  open={showColumnModal}
                  trigger={(
                    <Tooltip title="自定义列">
                      <Button
                        icon={<SettingOutlined />}
                        style={{ borderRadius: 6 }}
                        onClick={() => setShowColumnModal(true)}
                      />
                    </Tooltip>
                  )}
                  definitions={columnDefinitions}
                  value={columnSettings}
                  defaultValue={DEFAULT_PLAN_COLUMN_SETTINGS}
                  onCancel={() => setShowColumnModal(false)}
                  onApply={(nextSettings) => {
                    setColumnSettings(nextSettings)
                    setShowColumnModal(false)
                  }}
                />
              )}
            </Space>
          </Col>
          <Col>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as any)}
              options={[
                { label: <Space size={4}><TableOutlined />竖版表格</Space>, value: 'table' },
                { label: <Space size={4}><UnorderedListOutlined />横版表格</Space>, value: 'horizontal' },
                { label: <Space size={4}><BarChartOutlined />甘特图</Space>, value: 'gantt' },
              ]}
              style={{ borderRadius: 8 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Content Area */}
      <Card style={{ borderRadius: 10 }} styles={{ body: { padding: viewMode === 'horizontal' ? 0 : undefined } }}>
        {viewMode === 'table' && (
          <TaskTable
            tasks={tasks}
            setTasks={() => {}}
            isEditMode={false}
            isCurrentDraft={false}
            columnSettings={columnSettings}
            searchText={searchText}
            activeModule="share"
            planLevel="level1"
            projectPlanLevel="level1"
            activeLevel2Plan=""
            level2PlanTasks={[]}
            setLevel2PlanTasks={() => {}}
          />
        )}
        {viewMode === 'horizontal' && (
          <HorizontalTable tasks={tasks} versions={publishedVersions} />
        )}
        {viewMode === 'gantt' && (
          <GanttChart tasks={tasks} isEditMode={false} columnSettings={columnSettings} />
        )}
      </Card>
    </div>
  )
}

export default function SharePlanPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 80px' }}>
          <span style={{ color: '#9ca3af' }}>加载中...</span>
        </Card>
      </div>
    }>
      <SharePlanContent />
    </Suspense>
  )
}
