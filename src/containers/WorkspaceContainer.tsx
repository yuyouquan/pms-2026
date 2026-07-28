'use client'

import { useState, useMemo, type CSSProperties } from 'react'
import {
  Row, Col, Space, Input, Table, Progress, Tag, Badge, Button,
  Segmented, Pagination,
} from 'antd'
import {
  AppstoreOutlined, UnorderedListOutlined, ClockCircleOutlined,
  SearchOutlined, MenuFoldOutlined, MenuUnfoldOutlined, CheckSquareOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { usePermissionStore } from '@/stores/permission'
import { ProjectCard, TodoList, KanbanBoard } from '@/components/workspace/WorkspaceModule'
import type { ProjectType, TodoType } from '@/components/workspace/WorkspaceModule'
import WorkTracker from '@/components/work-tracker/WorkTracker'
import AddProjectModal from '@/components/workspace/AddProjectModal'
import { PROJECT_TYPES, PROJECT_STATUS_CONFIG } from '@/data/projects'
import { initialTodos } from '@/components/shared/PlanHelpers'
import { kanbanColumns } from '@/stores/project'
import {
  PROJECT_CATEGORIES,
  PROJECT_SECONDARY_CATEGORIES,
  PROJECT_TYPE_COLORS,
  PROJECT_TYPE_TOS_VERSION,
  getProjectStatusOptions,
  isMachineProjectType,
  matchesProjectSecondaryCategoryFilter,
  matchesProjectTypeFilter,
  resolveProjectClassification,
} from '@/constants/projectTypes'
import { buildTosTypeRows, getMainTosType } from '@/lib/tosTypeRules'

const WORKSPACE_FILTER_TOOLBAR_STYLE: CSSProperties = {
  background: 'rgba(255,255,255,0.8)',
  backdropFilter: 'blur(8px)',
  borderRadius: 14,
  padding: '8px 20px',
  marginBottom: 16,
  border: '1px solid rgba(99,102,241,0.08)',
  boxShadow: '0 2px 8px rgba(99,102,241,0.04)',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: 16,
  rowGap: 10,
}

const WORKSPACE_FILTER_CHIP_STYLE: CSSProperties = {
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

export default function WorkspaceContainer() {
  const {
    workspaceTab, setWorkspaceTab,
    setActiveModule, setProjectSpaceModule,
  } = useUiStore()

  const {
    projects, setSelectedProject,
    currentLoginUser,
    projectMemberMap,
    projectSearchText2, setProjectSearchText2,
    projectStatusFilter, setProjectStatusFilter,
    projectTypeFilter, setProjectTypeFilter,
    projectSecondaryCategoryFilter, setProjectSecondaryCategoryFilter,
    projectListView, setProjectListView,
    projectCardPage, setProjectCardPage,
    kanbanDimension, setKanbanDimension,
    todoFilter, setTodoFilter,
    todoCollapsed, setTodoCollapsed,
    setSelectedMarketTab,
    setSelectedTosTypeTab, tosTypeConfigsByProjectId,
  } = useProjectStore()

  const {
    setProjectPlanLevel, setProjectPlanViewMode,
    setCurrentVersion, setActiveLevel2Plan,
    createdLevel2Plans,
  } = usePlanStore()

  const { setIsEditMode } = useUiStore()

  const { globalRoles } = usePermissionStore()

  const projectCardPageSize = 9
  const [todos] = useState(initialTodos)
  const [addProjectOpen, setAddProjectOpen] = useState(false)

  const activateProject = (project: typeof projects[number]) => {
    setSelectedProject(project)
    if (project.markets?.length) setSelectedMarketTab(project.markets[0])
    if (project.type === PROJECT_TYPE_TOS_VERSION) {
      const typeRows = buildTosTypeRows(
        project.versionTypes || [],
        project.versionType || '',
        tosTypeConfigsByProjectId[project.id],
      )
      setSelectedTosTypeTab(getMainTosType(typeRows) || typeRows[0]?.type || 'Full')
    }
  }

  const isAdminUser = useMemo(() => {
    const adminGroup = globalRoles.find(r => r.name === '管理组')
    return adminGroup ? adminGroup.members.includes(currentLoginUser) : false
  }, [globalRoles, currentLoginUser])

  const visibleProjects = useMemo(() => {
    if (isAdminUser) return projects
    return projects.filter(p => {
      const members = projectMemberMap[p.id] || []
      return members.includes(currentLoginUser)
    })
  }, [projects, isAdminUser, currentLoginUser, projectMemberMap])

  const categoryAndSecondaryFilteredProjects = useMemo(() => {
    let result = visibleProjects
    if (projectSearchText2) {
      const keyword = projectSearchText2.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(keyword) || (p.marketName && p.marketName.toLowerCase().includes(keyword)))
    }
    result = result.filter(p => matchesProjectTypeFilter(p.type, projectTypeFilter, p.secondaryCategory))
    result = result.filter(p => matchesProjectSecondaryCategoryFilter(
      p.type,
      p.secondaryCategory,
      projectSecondaryCategoryFilter,
    ))
    return result
  }, [visibleProjects, projectSearchText2, projectTypeFilter, projectSecondaryCategoryFilter])

  const workspaceFilteredProjects = useMemo(() => (
    projectStatusFilter === 'all'
      ? categoryAndSecondaryFilteredProjects
      : categoryAndSecondaryFilteredProjects.filter(p => p.status === projectStatusFilter)
  ), [categoryAndSecondaryFilteredProjects, projectStatusFilter])

  const secondaryCategoryOptions = useMemo(() => {
    if (projectTypeFilter === 'all') return []
    const categoryOptions = PROJECT_SECONDARY_CATEGORIES[projectTypeFilter as keyof typeof PROJECT_SECONDARY_CATEGORIES] as readonly string[] | undefined
    return categoryOptions ? [{ label: '全部', value: 'all' }, ...categoryOptions.map(value => ({ label: value, value }))] : []
  }, [projectTypeFilter])

  const statusOptions = useMemo(() => (
    projectTypeFilter === 'all'
      ? [{ label: '全部', value: 'all' }]
      : getProjectStatusOptions(projectTypeFilter)
  ), [projectTypeFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: categoryAndSecondaryFilteredProjects.length }
    categoryAndSecondaryFilteredProjects.forEach(project => {
      counts[project.status] = (counts[project.status] || 0) + 1
    })
    return counts
  }, [categoryAndSecondaryFilteredProjects])

  const renderProjectCard = (project: typeof projects[number]) => (
    <ProjectCard
      project={project as ProjectType}
      setSelectedProject={(p) => activateProject(p as typeof projects[number])}
      setProjectSpaceModule={setProjectSpaceModule}
      setActiveModule={setActiveModule}
      PROJECT_STATUS_CONFIG={PROJECT_STATUS_CONFIG}
    />
  )

  const renderKanbanBoard = () => (
    <KanbanBoard
      visibleProjects={visibleProjects as ProjectType[]}
      kanbanDimension={kanbanDimension}
      setKanbanDimension={setKanbanDimension}
      kanbanColumns={kanbanColumns}
      PROJECT_TYPES={PROJECT_TYPES}
      setSelectedProject={(p) => activateProject(p as typeof projects[number])}
      setProjectSpaceModule={setProjectSpaceModule}
      setActiveModule={setActiveModule}
    />
  )

  const renderTodoList = () => (
    <TodoList
      todos={todos as TodoType[]}
      projects={projects as ProjectType[]}
      todoFilter={todoFilter}
      currentLoginUser={currentLoginUser}
      setSelectedProject={(p) => activateProject(p as typeof projects[number])}
      setActiveModule={setActiveModule}
      setProjectSpaceModule={setProjectSpaceModule}
      setCurrentVersion={setCurrentVersion}
      setProjectPlanLevel={setProjectPlanLevel}
      setProjectPlanViewMode={setProjectPlanViewMode}
      setIsEditMode={setIsEditMode}
      setActiveLevel2Plan={setActiveLevel2Plan}
      setSelectedMarketTab={setSelectedMarketTab}
    />
  )

  return (
    <div>
      {/* Unified toolbar */}
      <div style={{ ...WORKSPACE_FILTER_TOOLBAR_STYLE, flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 16, rowGap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 680px', minWidth: 0, columnGap: 0, rowGap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 3px', background: 'rgba(99,102,241,0.05)', borderRadius: 8 }}>
            {([
              { key: 'projects' as const, label: '项目列表', icon: <AppstoreOutlined /> },
              { key: 'workTracker' as const, label: '工作跟踪', icon: <ClockCircleOutlined /> },
            ]).map(tab => {
              const isActive = workspaceTab === tab.key
              return (
                <div
                  key={tab.key}
                  onClick={() => setWorkspaceTab(tab.key)}
                  style={{
                    ...WORKSPACE_FILTER_CHIP_STYLE,
                    padding: '4px 14px', borderRadius: 6, cursor: 'pointer',
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#4338ca' : '#9ca3af',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {tab.icon} {tab.label}
                </div>
              )
            })}
          </div>
        </div>
        {workspaceTab === 'projects' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', minWidth: 0, columnGap: 10, rowGap: 8 }}>
            <Input
              placeholder="搜索项目名称..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{ width: 220, borderRadius: 20, background: '#f7f8fa' }}
              variant="borderless"
              allowClear
              value={projectSearchText2}
              onChange={e => { setProjectSearchText2(e.target.value); setProjectCardPage(1); }}
            />
            <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
            <Segmented
              size="small"
              value={projectListView}
              onChange={(v) => setProjectListView(v as 'card' | 'list')}
              options={[
                { label: <AppstoreOutlined />, value: 'card' },
                { label: <UnorderedListOutlined />, value: 'list' },
              ]}
            />
            {isAdminUser && (
              <>
                <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddProjectOpen(true)} style={{ borderRadius: 6 }}>
                  新增项目
                </Button>
              </>
            )}
          </div>
        )}
        </div>
        {workspaceTab === 'projects' && (
          <div style={{ display: 'grid', gap: 4, padding: '5px 8px', background: 'rgba(99,102,241,0.04)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.06)' }}>
            <div aria-label="项目分类筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ width: 92, paddingLeft: 4, color: '#6b7280', fontSize: 12, fontWeight: 600 }}>项目分类</span>
              {[{ label: '全部', value: 'all' }, ...PROJECT_CATEGORIES.map(value => ({ label: value, value }))].map(item => {
                const isActive = projectTypeFilter === item.value
                return (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => {
                      setProjectTypeFilter(item.value)
                      setProjectSecondaryCategoryFilter('all')
                      setProjectStatusFilter('all')
                      setProjectCardPage(1)
                    }}
                    style={{
                      ...WORKSPACE_FILTER_CHIP_STYLE,
                      padding: '3px 12px', borderRadius: 16, cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, transition: 'all 0.2s',
                      background: isActive ? '#fff' : 'transparent',
                      color: isActive ? '#6366f1' : '#6b7280',
                      boxShadow: isActive ? '0 2px 6px rgba(99,102,241,0.15)' : 'none',
                      border: 0,
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {projectTypeFilter !== 'all' && (
              <div aria-label="项目二级分类筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ width: 92, paddingLeft: 4, color: '#6b7280', fontSize: 12, fontWeight: 600 }}>项目二级分类</span>
                {secondaryCategoryOptions.map(item => {
                  const isActive = projectSecondaryCategoryFilter === item.value
                  return (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => { setProjectSecondaryCategoryFilter(item.value); setProjectCardPage(1) }}
                      style={{
                        ...WORKSPACE_FILTER_CHIP_STYLE,
                        padding: '3px 12px', borderRadius: 16, cursor: 'pointer',
                        fontSize: 12, fontWeight: 500, transition: 'all 0.2s',
                        background: isActive ? '#fff' : 'transparent',
                        color: isActive ? '#6366f1' : '#6b7280',
                        boxShadow: isActive ? '0 2px 6px rgba(99,102,241,0.15)' : 'none',
                        border: 0,
                      }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}

            <div aria-label="项目状态筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ width: 92, paddingLeft: 4, color: '#6b7280', fontSize: 12, fontWeight: 600 }}>状态</span>
              {statusOptions.map(item => {
                const isActive = projectStatusFilter === item.value
                return (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => { setProjectStatusFilter(item.value); setProjectCardPage(1) }}
                    style={{
                      ...WORKSPACE_FILTER_CHIP_STYLE,
                      padding: '3px 12px', borderRadius: 16, cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, transition: 'all 0.2s',
                      background: isActive ? '#6366f1' : 'transparent',
                      color: isActive ? '#fff' : '#6b7280',
                      border: 0,
                    }}
                  >
                    {item.label} <span style={{ fontSize: 11, opacity: 0.8 }}>{statusCounts[item.value] || 0}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Project list content */}
      {workspaceTab === 'projects' && (
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {projectListView === 'card' ? (
              <>
                <Row gutter={[16, 16]}>
                  {workspaceFilteredProjects.slice((projectCardPage - 1) * projectCardPageSize, projectCardPage * projectCardPageSize).map(p => (
                    <Col xs={24} sm={12} lg={todoCollapsed ? 6 : 8} key={p.id}>{renderProjectCard(p)}</Col>
                  ))}
                </Row>
                {workspaceFilteredProjects.length > projectCardPageSize && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <Pagination
                      current={projectCardPage}
                      pageSize={projectCardPageSize}
                      total={workspaceFilteredProjects.length}
                      onChange={(page) => setProjectCardPage(page)}
                      showTotal={(total) => `共 ${total} 个项目`}
                      showSizeChanger={false}
                      size="small"
                    />
                  </div>
                )}
              </>
            ) : (
              <Table
                dataSource={workspaceFilteredProjects}
                rowKey="id"
                size="small"
                pagination={{ pageSize: projectCardPageSize, size: 'small', showTotal: (total: number) => `共 ${total} 个项目` }}
                className="pms-table"
                onRow={(record) => ({
                  style: { cursor: 'pointer' },
                  onClick: () => { activateProject(record); setProjectSpaceModule('basic'); setActiveModule('projectSpace') },
                })}
                columns={[
                  { title: '项目名称', dataIndex: 'name', width: 200, render: (name: string, r: any) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{isMachineProjectType(r.type) && r.marketName ? r.marketName : name}</div>
                      {isMachineProjectType(r.type) && r.marketName && <div style={{ fontSize: 11, color: '#9ca3af' }}>{name}</div>}
                    </div>
                  )},
                  { title: '项目分类', dataIndex: 'type', width: 130, render: (_: string, r: any) => {
                    const classification = resolveProjectClassification(r.type, r.secondaryCategory)
                    const tc = PROJECT_TYPE_COLORS[classification.projectCategory] || { bg: 'rgba(140,140,140,0.08)', color: '#8c8c8c' }
                    return <Tag color="default" style={{ fontSize: 11, borderRadius: 3, background: tc.bg, color: tc.color, border: 'none' }}>{classification.projectCategory}</Tag>
                  }},
                  { title: '项目二级分类', dataIndex: 'secondaryCategory', width: 140, render: (_: string, r: any) => resolveProjectClassification(r.type, r.secondaryCategory).secondaryCategory || '-' },
                  { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => {
                    const conf = PROJECT_STATUS_CONFIG[s] || { tagColor: 'default' }
                    return <Tag color={conf.tagColor}>{s}</Tag>
                  }},
                  { title: '进度', dataIndex: 'progress', width: 120, render: (v: number) => <Progress percent={v} size="small" style={{ marginBottom: 0 }} /> },
                  { title: '计划开始', dataIndex: 'planStartDate', width: 110 },
                  { title: '计划结束', dataIndex: 'planEndDate', width: 110 },
                  { title: 'SPM', dataIndex: 'spm', width: 80 },
                  { title: '更新', dataIndex: 'updatedAt', width: 80, render: (t: string) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{t}</span> },
                ]}
              />
            )}
          </div>

          {/* Todo sidebar */}
          <div style={{
            width: todoCollapsed ? 40 : 320,
            flexShrink: 0,
            transition: 'width 0.25s ease',
            position: 'relative',
          }}>
            {todoCollapsed ? (
              <div
                style={{
                  width: 40,
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid #f3f4f6',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 0',
                  cursor: 'pointer',
                  position: 'sticky',
                  top: 24,
                }}
                onClick={() => setTodoCollapsed(false)}
              >
                <MenuUnfoldOutlined style={{ color: '#9ca3af', fontSize: 14, marginBottom: 8 }} />
                <Badge count={todos.filter(t => t.category === 'overdue').length} size="small" style={{ marginBottom: 8, backgroundColor: '#ff4d4f' }} />
                <div style={{ writingMode: 'vertical-lr', fontSize: 12, color: '#9ca3af', letterSpacing: 2 }}>待办中心</div>
              </div>
            ) : (
              <div style={{
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #f3f4f6',
                overflow: 'hidden',
                position: 'sticky',
                top: 24,
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                }}>
                  <Space size={6}>
                    <CheckSquareOutlined style={{ color: '#6366f1', fontSize: 14 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>待办中心</span>
                    <Badge count={todos.filter(t => t.category === 'overdue').length} style={{ backgroundColor: '#ff4d4f' }} size="small" />
                  </Space>
                  <Button type="text" size="small" icon={<MenuFoldOutlined />} style={{ color: '#9ca3af' }} onClick={() => setTodoCollapsed(true)} />
                </div>
                <div style={{ padding: 12, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                  {renderTodoList()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Work tracker content */}
      {workspaceTab === 'workTracker' && (
        <WorkTracker
          currentLoginUser={currentLoginUser}
          projects={projects}
          onNavigateToProject={(projectId, module, planLevel, planType) => {
            const proj = projects.find(p => p.id === projectId)
            if (!proj) return
            activateProject(proj)
            setProjectSpaceModule(module)
            setActiveModule('projectSpace')
            if (module === 'plan' && planLevel) {
              if (planLevel === 'level2') setProjectPlanViewMode('table')
              setProjectPlanLevel(planLevel)
              if (planLevel === 'level2' && planType) {
                const plan = createdLevel2Plans.find(p => p.name === planType)
                if (plan) setActiveLevel2Plan(plan.id)
              }
            }
          }}
        />
      )}
      <AddProjectModal open={addProjectOpen} onCancel={() => setAddProjectOpen(false)} />
    </div>
  )
}
