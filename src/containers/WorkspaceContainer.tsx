'use client'

import { useState, useMemo } from 'react'
import {
  Row, Col, Space, Input, Table, Progress, Tag, Badge, Button,
  Segmented, Pagination,
} from 'antd'
import {
  AppstoreOutlined, UnorderedListOutlined, ClockCircleOutlined,
  SearchOutlined, MenuFoldOutlined, MenuUnfoldOutlined, CheckSquareOutlined,
} from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { usePermissionStore } from '@/stores/permission'
import { ProjectCard, TodoList, KanbanBoard } from '@/components/workspace/WorkspaceModule'
import type { ProjectType, TodoType } from '@/components/workspace/WorkspaceModule'
import WorkTracker from '@/components/work-tracker/WorkTracker'
import { initialProjects, PROJECT_TYPES, PROJECT_STATUS_CONFIG } from '@/data/projects'
import { initialTodos } from '@/components/shared/PlanHelpers'
import { kanbanColumns } from '@/stores/project'

export default function WorkspaceContainer() {
  const {
    workspaceTab, setWorkspaceTab,
    setActiveModule, setProjectSpaceModule,
  } = useUiStore()

  const {
    projects, setSelectedProject,
    currentLoginUser,
    projectSearchText2, setProjectSearchText2,
    projectStatusFilter, setProjectStatusFilter,
    projectTypeFilter, setProjectTypeFilter,
    projectListView, setProjectListView,
    projectCardPage, setProjectCardPage,
    kanbanDimension, setKanbanDimension,
    todoFilter, setTodoFilter,
    todoCollapsed, setTodoCollapsed,
    setSelectedMarketTab,
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

  const isAdminUser = useMemo(() => {
    const adminGroup = globalRoles.find(r => r.name === '管理组')
    return adminGroup ? adminGroup.members.includes(currentLoginUser) : false
  }, [globalRoles, currentLoginUser])

  const visibleProjects = useMemo(() => {
    if (isAdminUser) return projects
    return projects.filter(p => {
      const members = PROJECT_MEMBER_MAP[p.id] || []
      return members.includes(currentLoginUser)
    })
  }, [projects, isAdminUser, currentLoginUser])

  const workspaceFilteredProjects = useMemo(() => {
    let result = visibleProjects
    if (projectSearchText2) {
      const keyword = projectSearchText2.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(keyword) || (p.marketName && p.marketName.toLowerCase().includes(keyword)))
    }
    if (projectStatusFilter !== 'all') {
      result = result.filter(p => p.status === projectStatusFilter)
    }
    if (projectTypeFilter !== 'all') {
      result = result.filter(p => p.type === projectTypeFilter)
    }
    return result
  }, [visibleProjects, projectSearchText2, projectStatusFilter, projectTypeFilter])

  const renderProjectCard = (project: typeof initialProjects[0]) => (
    <ProjectCard
      project={project as ProjectType}
      setSelectedProject={(p) => setSelectedProject(p as typeof initialProjects[0])}
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
      setSelectedProject={(p) => setSelectedProject(p as typeof initialProjects[0])}
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
      setSelectedProject={(p) => setSelectedProject(p as typeof initialProjects[0])}
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
      <div style={{
        background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '8px 20px', marginBottom: 16,
        border: '1px solid rgba(99,102,241,0.08)', boxShadow: '0 2px 8px rgba(99,102,241,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
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
          {workspaceTab === 'projects' && (
            <>
              <div style={{ width: 1, height: 20, background: 'rgba(99,102,241,0.12)', margin: '0 14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {[
                  { label: '全部', value: visibleProjects.length, filterValue: 'all', color: '#6366f1' },
                  { label: '进行中', value: visibleProjects.filter(p => p.status === '进行中').length, filterValue: '进行中', color: '#6366f1' },
                  { label: '待立项', value: visibleProjects.filter(p => p.status === '筹备中' || p.status === '待立项').length, filterValue: '筹备中', color: '#faad14' },
                  { label: '已完成', value: visibleProjects.filter(p => p.status === '已完成').length, filterValue: '已完成', color: '#52c41a' },
                ].map((stat) => {
                  const isActive = projectStatusFilter === stat.filterValue
                  return (
                    <div
                      key={stat.filterValue}
                      onClick={() => { setProjectStatusFilter(stat.filterValue); setProjectCardPage(1); }}
                      style={{
                        padding: '4px 14px', borderRadius: 20, cursor: 'pointer',
                        fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                        background: isActive ? stat.color : 'transparent',
                        color: isActive ? '#fff' : '#4b5563',
                        border: isActive ? `1px solid ${stat.color}` : '1px solid transparent',
                      }}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(99,102,241,0.06)' } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent' } }}
                    >
                      {stat.label} <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 2 }}>{stat.value}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        {workspaceTab === 'projects' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px', background: 'rgba(99,102,241,0.04)', borderRadius: 20, border: '1px solid rgba(99,102,241,0.06)' }}>
              {[
                { label: '全部', value: 'all' },
                { label: '整机', value: '整机产品项目' },
                { label: '产品', value: '产品项目' },
                { label: '技术', value: '技术项目' },
                { label: '能力', value: '能力建设项目' },
              ].map(item => {
                const isActive = projectTypeFilter === item.value
                return (
                  <div
                    key={item.value}
                    onClick={() => { setProjectTypeFilter(item.value); setProjectCardPage(1); }}
                    style={{
                      padding: '3px 12px', borderRadius: 16, cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, transition: 'all 0.2s',
                      background: isActive ? '#fff' : 'transparent',
                      color: isActive ? '#6366f1' : '#9ca3af',
                      boxShadow: isActive ? '0 2px 6px rgba(99,102,241,0.15)' : 'none',
                    }}
                  >
                    {item.label}
                  </div>
                )
              })}
            </div>
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
                  onClick: () => { setSelectedProject(record); setProjectSpaceModule('basic'); setActiveModule('projectSpace') },
                })}
                columns={[
                  { title: '项目名称', dataIndex: 'name', width: 200, render: (name: string, r: any) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{r.type === '整机产品项目' && r.marketName ? r.marketName : name}</div>
                      {r.type === '整机产品项目' && r.marketName && <div style={{ fontSize: 11, color: '#9ca3af' }}>{name}</div>}
                    </div>
                  )},
                  { title: '类型', dataIndex: 'type', width: 120, render: (t: string) => {
                    const tc = { '整机产品项目': { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' }, '产品项目': { bg: 'rgba(22,119,255,0.08)', color: '#1677ff' }, '技术项目': { bg: 'rgba(250,173,20,0.08)', color: '#d48806' }, '能力建设项目': { bg: 'rgba(82,196,26,0.08)', color: '#389e0d' } }[t] || { bg: 'rgba(140,140,140,0.08)', color: '#8c8c8c' }
                    return <Tag color="default" style={{ fontSize: 11, borderRadius: 3, background: tc.bg, color: tc.color, border: 'none' }}>{t}</Tag>
                  }},
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
            setSelectedProject(proj)
            setProjectSpaceModule(module)
            setActiveModule('projectSpace')
            if (module === 'plan' && planLevel) {
              setProjectPlanLevel(planLevel)
              if (planLevel === 'level2' && planType) {
                const plan = createdLevel2Plans.find(p => p.name === planType)
                if (plan) setActiveLevel2Plan(plan.id)
              }
            }
          }}
        />
      )}
    </div>
  )
}
