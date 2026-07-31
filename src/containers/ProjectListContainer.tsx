'use client'

import { useState, useMemo, type CSSProperties } from 'react'
import {
  Row, Col, Input, Button, Empty, Segmented, Pagination,
} from 'antd'
import {
  AppstoreOutlined, UnorderedListOutlined, SearchOutlined, PlusOutlined,
} from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { usePermissionStore } from '@/stores/permission'
import { ProjectCard } from '@/components/workspace/WorkspaceModule'
import type { ProjectType } from '@/components/workspace/WorkspaceModule'
import AddProjectModal from '@/components/workspace/AddProjectModal'
import ProjectSummaryTable from '@/components/project-summary/ProjectSummaryTable'
import { PROJECT_STATUS_CONFIG } from '@/data/projects'
import {
  PROJECT_CATEGORIES,
  PROJECT_SECONDARY_CATEGORIES,
  PROJECT_TYPE_TOS_VERSION,
  getProjectStatusOptions,
  isMachineProjectType,
  matchesProjectSecondaryCategoryFilter,
  matchesProjectTypeFilter,
} from '@/constants/projectTypes'
import { getWorkbenchListState } from '@/lib/projectSummary'
import { getTemplateTasksForProjectType } from '@/lib/projectTemplateCompatibility'
import { buildTosTypeRows, getMainTosType } from '@/lib/tosTypeRules'
import { buildMarketRowsFromMarkets, getMainMarket } from '@/lib/marketRules'
import { useActivateProject } from '@/hooks/useActivateProject'

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

export default function ProjectListContainer() {
  const {
    enterProjectSpace, setProjectSpaceModule,
  } = useUiStore()

  const {
    projects,
    currentLoginUser,
    projectMemberMap,
    projectSearchText2, setProjectSearchText2,
    projectStatusFilter, setProjectStatusFilter,
    projectTypeFilter, setProjectTypeFilter,
    projectSecondaryCategoryFilter, setProjectSecondaryCategoryFilter,
    projectListView, setProjectListView,
    projectCardPage, setProjectCardPage,
    tosTypeConfigsByProjectId, marketConfigsByProjectId,
  } = useProjectStore()

  const {
    versions, currentVersion, publishedSnapshots, configTemplateTasksByType,
    marketPlanData, tosTypePlanDataByProjectId,
  } = usePlanStore()

  const { globalRoles } = usePermissionStore()
  const activateProject = useActivateProject()

  const projectCardPageSize = 9
  const [addProjectOpen, setAddProjectOpen] = useState(false)
  const workbenchListState = useMemo(
    () => getWorkbenchListState(projectTypeFilter),
    [projectTypeFilter],
  )

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

  const searchFilteredProjects = useMemo(() => {
    let result = visibleProjects
    if (projectSearchText2) {
      const keyword = projectSearchText2.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(keyword) || (p.marketName && p.marketName.toLowerCase().includes(keyword)))
    }
    return result
  }, [visibleProjects, projectSearchText2])

  const categoryBaseProjects = useMemo(
    () => visibleProjects.filter(project => (
      matchesProjectTypeFilter(project.type, projectTypeFilter, project.secondaryCategory)
    )),
    [projectTypeFilter, visibleProjects],
  )

  const projectSummaryPlanTasksByProjectId = useMemo(() => (
    Object.fromEntries(categoryBaseProjects.map(project => {
      if (isMachineProjectType(project.type)) {
        const marketRows = buildMarketRowsFromMarkets(
          project.markets || [],
          marketConfigsByProjectId[project.id],
        )
        const mainMarket = getMainMarket(marketRows)
        return [project.id, marketPlanData[mainMarket]?.tasks || []]
      }
      if (project.type === PROJECT_TYPE_TOS_VERSION) {
        const typeRows = buildTosTypeRows(
          project.versionTypes || [],
          project.versionType || '',
          tosTypeConfigsByProjectId[project.id],
        )
        const mainType = getMainTosType(typeRows)
        return [
          project.id,
          tosTypePlanDataByProjectId[project.id]?.[mainType]?.level1Tasks || [],
        ]
      }
      return [project.id, []]
    }))
  ), [
    categoryBaseProjects,
    marketConfigsByProjectId,
    marketPlanData,
    tosTypeConfigsByProjectId,
    tosTypePlanDataByProjectId,
  ])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: searchFilteredProjects.length }
    PROJECT_CATEGORIES.forEach(category => {
      counts[category] = searchFilteredProjects.filter(project => (
        matchesProjectTypeFilter(project.type, category, project.secondaryCategory)
      )).length
    })
    return counts
  }, [searchFilteredProjects])

  const categoryAndSecondaryFilteredProjects = useMemo(() => {
    let result = searchFilteredProjects
    result = result.filter(p => matchesProjectTypeFilter(p.type, projectTypeFilter, p.secondaryCategory))
    result = result.filter(p => matchesProjectSecondaryCategoryFilter(
      p.type,
      p.secondaryCategory,
      projectSecondaryCategoryFilter,
    ))
    return result
  }, [searchFilteredProjects, projectTypeFilter, projectSecondaryCategoryFilter])

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
      setActiveModule={(module) => {
        if (module === 'projectSpace') enterProjectSpace({ module: 'projectList' })
      }}
      PROJECT_STATUS_CONFIG={PROJECT_STATUS_CONFIG}
    />
  )

  return (
    <div>
      {/* Unified toolbar */}
      <div style={{ ...WORKSPACE_FILTER_TOOLBAR_STYLE, flexDirection: 'column', alignItems: 'stretch' }}>
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
              aria-label="项目列表视图"
              size="small"
              value={projectListView}
              onChange={(v) => setProjectListView(v as 'card' | 'list')}
              options={[
                { label: <span aria-label="卡片视图"><AppstoreOutlined /></span>, value: 'card' },
                { label: <span aria-label="列表视图"><UnorderedListOutlined /></span>, value: 'list' },
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
                    {item.label} <span style={{ fontSize: 11, opacity: 0.8 }}>{categoryCounts[item.value] || 0}</span>
                  </button>
                )
              })}
            </div>

            {workbenchListState.kind !== 'select-category' && workbenchListState.showSecondaryCategory && (
              <div aria-label="项目二级分类快捷筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
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

            {workbenchListState.kind !== 'select-category' && workbenchListState.showStatusQuickFilter && (
              <div aria-label="状态快捷筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
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
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}
        </div>
      </div>

      {/* Project list content */}
      <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {projectListView === 'card' ? (
              <>
                <Row gutter={[16, 16]}>
                  {workspaceFilteredProjects.slice((projectCardPage - 1) * projectCardPageSize, projectCardPage * projectCardPageSize).map(p => (
                    <Col xs={24} sm={12} lg={8} key={p.id}>{renderProjectCard(p)}</Col>
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
              workbenchListState.kind === 'select-category' ? (
                <Empty description="请选择项目分类" />
              ) : workbenchListState.kind === 'unsupported' ? (
                <Empty description="该项目分类的列表视图暂未配置" />
              ) : (
                <ProjectSummaryTable
                  projects={workspaceFilteredProjects}
                  optionProjects={categoryBaseProjects}
                  planTasksByProjectId={projectSummaryPlanTasksByProjectId}
                  projectType={projectTypeFilter}
                  versions={versions}
                  currentVersion={currentVersion}
                  publishedSnapshots={publishedSnapshots}
                  currentTemplateTasks={
                    getTemplateTasksForProjectType(
                      configTemplateTasksByType,
                      projectTypeFilter,
                    ) ?? []
                  }
                  storageNamespace="workbench-project-list"
                  onViewProject={(projectId) => {
                    const project = workspaceFilteredProjects.find(item => item.id === projectId)
                    if (!project) return
                    activateProject(project)
                    setProjectSpaceModule('basic')
                    enterProjectSpace({ module: 'projectList' })
                  }}
                />
              )
            )}
          </div>

        </div>
      <AddProjectModal open={addProjectOpen} onCancel={() => setAddProjectOpen(false)} />
    </div>
  )
}
