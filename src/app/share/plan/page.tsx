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
import { PROJECT_TYPE_COLORS } from '@/data/projects'
import {
  TaskTable,
  HorizontalTable,
  GanttChart,
  ALL_COLUMNS,
  DEFAULT_PLAN_COLUMN_SETTINGS,
} from '@/components/plan/PlanModule'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  getDefaultColumnSettings,
  type SortableColumnDefinition,
  type SortableColumnSettingsValue,
} from '@/lib/columnSettings'
import { isMachineProjectType, PROJECT_TYPE_TECH } from '@/constants/projectTypes'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { resolveTechnicalSharePlan, useTechnicalPlanStore } from '@/stores/technicalPlan'
import { getSharedLevel1Scopes, resolveSharedLevel1Plan } from '@/lib/sharePlan'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'

function SharePlanEmpty({ description }: { description: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <Card style={{ borderRadius: 16, textAlign: 'center', width: '100%', maxWidth: 560 }} styles={{ body: { padding: 24 } }}>
        <Empty description={description} />
      </Card>
    </div>
  )
}

function SharePlanContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const level = searchParams.get('level') || 'level1'
  const technical = searchParams.get('technical')
  const technicalKind = searchParams.get('kind')
  const technicalSubprojectId = searchParams.get('subprojectId')
  const projects = useProjectStore(state => state.projects)
  const marketConfigs = useProjectStore(state => state.marketConfigsByProjectId)
  const tosTypeConfigs = useProjectStore(state => state.tosTypeConfigsByProjectId)
  const planState = usePlanStore()
  const technicalPlansByKey = useTechnicalPlanStore(state => state.plansByKey)
  const isTechnicalShare = technical === '1'
  const technicalSharePlan = useMemo(() => resolveTechnicalSharePlan(technicalPlansByKey, {
    technical,
    kind: technicalKind,
    projectId,
    subprojectId: technicalSubprojectId,
  }), [technicalPlansByKey, technical, technicalKind, projectId, technicalSubprojectId])

  // Find project
  const project = projects.find(p => p.id === projectId)

  const isWholeMachine = isMachineProjectType(project?.type)
  const [scopeSelection, setScopeSelection] = useState({ projectId: '', value: '' })
  const sharedScopeQuery = {
    project,
    marketRows: projectId ? marketConfigs[projectId] : undefined,
    tosTypeRows: projectId ? tosTypeConfigs[projectId] : undefined,
  }
  const scopes = isTechnicalShare ? [] : getSharedLevel1Scopes(sharedScopeQuery)
  const requestedScope = scopeSelection.projectId === projectId
    ? scopeSelection.value
    : searchParams.get(isWholeMachine ? 'market' : 'tosType') || ''
  const selectedScope = requestedScope || scopes.find(scope => scope.isMain)?.value || scopes[0]?.value || ''
  const sharedPlan = resolveSharedLevel1Plan(planState, { ...sharedScopeQuery, level, scopeValue: selectedScope })
  const latestVersion = isTechnicalShare
    ? (technicalSharePlan.ok ? technicalSharePlan.version : undefined)
    : (sharedPlan.ok ? sharedPlan.version : undefined)
  const [viewMode, setViewMode] = useState<'table' | 'horizontal' | 'gantt'>('table')
  const [searchText, setSearchText] = useState('')
  const columnDefinitions: readonly SortableColumnDefinition<string>[] = ALL_COLUMNS
  const [columnSettings, setColumnSettings] = useState<SortableColumnSettingsValue<string>>(
    () => getDefaultColumnSettings(columnDefinitions),
  )
  const [showColumnModal, setShowColumnModal] = useState(false)

  const tasks = useMemo(() => {
    if (isTechnicalShare) return technicalSharePlan.ok ? technicalSharePlan.version.tasks.map(task => ({ ...task })) : []
    return sharedPlan.ok ? sharedPlan.tasks : []
  }, [isTechnicalShare, technicalSharePlan, sharedPlan])

  // Plan title
  const planTitle = isTechnicalShare
    ? (technicalKind === 'tdt' ? 'TDT项目计划' : '子项目计划')
    : '一级计划'

  // Technical links intentionally use one non-sensitive empty state for invalid and unpublished scopes.
  if (isTechnicalShare && (!projectId || !project || !technicalSharePlan.ok)) {
    return <SharePlanEmpty description="暂无可查看的已发布计划" />
  }

  // Error: project not found
  if (!projectId || !project) {
    return <SharePlanEmpty description="项目不存在或链接无效" />
  }

  if (!isTechnicalShare && (level !== 'level1' || project.type === PROJECT_TYPE_TECH)) {
    return <SharePlanEmpty description="此链接不支持该计划，请从项目空间重新复制分享链接" />
  }

  const typeColor = PROJECT_TYPE_COLORS[project.type] || { bg: 'rgba(140,140,140,0.08)', color: '#8c8c8c' }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header Info Bar */}
      <Card
        size="small"
        className="pms-glass-surface"
        style={{ marginBottom: 24, borderRadius: 16 }}
        styles={{ body: { padding: 16 } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space size={8} wrap>
            <Tag style={{ fontSize: 'var(--pms-font-size-aux)', lineHeight: 'var(--pms-line-height-aux)', borderRadius: 4, background: typeColor.bg, color: typeColor.color, border: 'none', padding: '2px 10px' }}>
              {project.type}
            </Tag>
            <span style={{ fontSize: 'var(--pms-font-size-title)', lineHeight: 'var(--pms-line-height-title)', fontWeight: 600, color: 'var(--pms-text-primary)' }}>
              {isMachineProjectType(project.type) && project.marketName ? project.marketName : project.name}
              <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>·</span>
              <span style={{ color: 'var(--pms-brand)', marginLeft: 8 }}>{planTitle}</span>
            </span>
          </Space>
          <Space size={16} split={<Divider type="vertical" style={{ margin: 0, borderColor: 'var(--pms-brand-border)' }} />}>
            {latestVersion ? <Space size={4}>
              <Tag color="green" style={{ fontSize: 12, lineHeight: '18px' }}>{latestVersion.versionNo}</Tag>
              <Tag color="success" style={{ fontSize: 12, lineHeight: '18px' }}>已发布</Tag>
            </Space> : <span style={{ fontSize: 12, lineHeight: '18px' }}>暂无已发布版本</span>}
            <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--pms-text-secondary)' }}>SPM: {project.spm || '-'}</span>
          </Space>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: '18px', color: 'var(--pms-text-secondary)' }}>
          查看最新已发布版本。当前为虚构数据的本地演示，分享页读取本浏览器已保存的计划；其他浏览器不会同步本地修改。
        </div>
      </Card>

      {/* Toolbar */}
      <Card
        className="pms-toolbar"
        size="small"
        style={{ marginBottom: 12, borderRadius: 16 }}
        styles={{ body: { padding: 16 } }}
      >
        <Row justify="space-between" align="middle" gutter={[8, 8]}>
          <Col>
            <Space size={8} wrap>
              {scopes.length > 0 && scopes[0].kind !== 'ordinary' && (
                <>
                  <Segmented
                    aria-label={isWholeMachine ? '分享计划市场' : '分享计划类型'}
                    value={selectedScope}
                    options={scopes.map(scope => ({ label: scope.value, value: scope.value }))}
                    onChange={value => setScopeSelection({ projectId, value: String(value) })}
                  />
                  <Divider type="vertical" style={{ margin: '0 4px', borderColor: 'var(--pms-brand-border)' }} />
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
                    <Tooltip title="字段配置">
                      <Button
                        icon={<SettingOutlined />}
                        aria-label="字段配置"
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
      <Card className="pms-solid-surface" style={{ borderRadius: 16 }} styles={{ body: { padding: 16 } }}>
        {!latestVersion && <Empty description="当前范围暂无可查看的已发布计划" />}
        {latestVersion && viewMode === 'table' && (
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
        {latestVersion && viewMode === 'horizontal' && (
          <HorizontalTable tasks={tasks} versions={[latestVersion]} />
        )}
        {latestVersion && viewMode === 'gantt' && (
          <GanttChart tasks={tasks} isEditMode={false} columnSettings={columnSettings} />
        )}
      </Card>
    </div>
  )
}

export default function SharePlanPage() {
  return (
    <main className="pms-share-page pms-page-shell pms-main-content">
      <Suspense fallback={<SharePlanEmpty description="加载中..." />}>
        <SharePlanContent />
      </Suspense>
    </main>
  )
}
