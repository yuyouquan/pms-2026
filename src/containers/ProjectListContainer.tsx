'use client'

import { useEffect, useState, useMemo, type CSSProperties } from 'react'
import {
  Row, Col, Button, Card, Empty, Segmented, Pagination, Space, Tooltip, message,
} from 'antd'
import {
  AppstoreOutlined, CalendarOutlined, FullscreenExitOutlined, FullscreenOutlined,
  PlusOutlined, TeamOutlined, UnorderedListOutlined, UserOutlined,
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
  PROJECT_CATEGORY_CAPABILITY,
  PROJECT_CATEGORY_MACHINE,
  PROJECT_CATEGORY_TECH,
  PROJECT_SECONDARY_CATEGORIES,
  PROJECT_TYPE_TOS_VERSION,
  isMachineProjectType,
  matchesProjectSecondaryCategoryFilter,
  matchesProjectTypeFilter,
} from '@/constants/projectTypes'
import {
  buildProjectSummaryRow,
  getLatestPublishedTemplateTasks,
  getLinkedQuickFilterValues,
  getProjectListFieldDefinitions,
  getProjectSummaryQuickFilterDefinitions,
  getWorkbenchListState,
  updateLinkedQuickFilterCondition,
  type ProjectSummaryRow,
  type ProjectSummaryTemplateTask,
} from '@/lib/projectSummary'
import { getTemplateTasksForProjectType } from '@/lib/projectTemplateCompatibility'
import { getProjectStatusEnumType } from '@/lib/projectStatus'
import { useEnumHydration, useSingleEnumOptions } from '@/hooks/useEnumOptions'
import { buildTosTypeRows, getMainTosType, getTosTypeSnapshotKey, getTosTypeVersionKey } from '@/lib/tosTypeRules'
import { buildMarketRowsFromMarkets, getMainMarket, getMarketPlanVersionKey, getProjectMarketSnapshotKey } from '@/lib/marketRules'
import { useActivateProject } from '@/hooks/useActivateProject'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import { useTechnicalPlanStore } from '@/stores/technicalPlan'
import {
  buildTechnicalProjectListRows,
  resolveTechnicalProjectType,
  selectLatestPublishedScopedSnapshot,
  TECHNICAL_PROJECT_TYPE_OPTIONS,
} from '@/lib/projectListMatrix'
import { getTemplateConfigScopeKey } from '@/lib/technicalPlanRules'
import {
  applyFilterConditions,
  isFilterConditionActive,
  type AnyFilterCondition,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import {
  countProjectsByCategory,
  canEnterProjectSpace,
  filterProjectsForList,
} from '@/lib/projectListFilters'
import ProjectListCalendar from '@/components/project-list/ProjectListCalendar'
import type { ProjectListViewMode } from '@/stores/project'
import { buildProjectListMockPlanTasks } from '@/data/projectListPlanMocks'

const WORKSPACE_FILTER_TOOLBAR_STYLE: CSSProperties = {
  borderRadius: 12,
  padding: '8px 20px',
  marginBottom: 16,
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
    projectStatusFilter, setProjectStatusFilter,
    projectTypeFilter, setProjectTypeFilter,
    projectSecondaryCategoryFilter, setProjectSecondaryCategoryFilter,
    projectListView, setProjectListView,
    projectCardPage, setProjectCardPage,
    tosTypeConfigsByProjectId, marketConfigsByProjectId,
  } = useProjectStore()

  const {
    versions, currentVersion, publishedSnapshots, configTemplateTasksByType,
    configTemplateVersionScopes, marketVersionsByKey, tosTypeVersionsByKey,
  } = usePlanStore()

  const { globalRoles, rolesByProject } = usePermissionStore()
  const activateProject = useActivateProject()
  const technicalSubprojects = useTechnicalProjectStore(state => state.subprojects)
  const technicalPlansByKey = useTechnicalPlanStore(state => state.plansByKey)
  const [summaryFilters, setSummaryFilters] = useState<AnyFilterCondition[]>([])
  const [technicalFilters, setTechnicalFilters] = useState<AnyFilterCondition[]>(() => (
    updateLinkedQuickFilterCondition([], 'technicalProjectType', ['tdt'])
  ))
  const [projectListTableToolbarHost, setProjectListTableToolbarHost] = useState<HTMLDivElement | null>(null)
  const [projectListFilterSummaryHost, setProjectListFilterSummaryHost] = useState<HTMLDivElement | null>(null)
  const [aboutMineOnly, setAboutMineOnly] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const technicalSelectedTypes = getLinkedQuickFilterValues(technicalFilters, 'technicalProjectType')
  const technicalActiveType = resolveTechnicalProjectType(technicalSelectedTypes)
  const statusEnumType = getProjectStatusEnumType(projectTypeFilter)
  const statusHistory = useMemo(() => [...new Set(projects
    .filter(project => projectTypeFilter !== 'all' && matchesProjectTypeFilter(
      project.type,
      projectTypeFilter,
      project.secondaryCategory,
    ))
    .map(project => project.status)
    .filter(Boolean))], [projectTypeFilter, projects])
  const configuredStatusOptions = useSingleEnumOptions(
    statusEnumType,
    statusHistory,
    projectTypeFilter !== 'all',
  )
  const {
    hasHydrated: statusHasHydrated,
    hydrationError: statusHydrationError,
    retryHydration: retryStatusHydration,
  } = useEnumHydration(projectTypeFilter !== 'all')

  const projectListPageSize = 15
  const [addProjectOpen, setAddProjectOpen] = useState(false)
  const fullscreenViewTitle = projectListView === 'calendar' ? '项目日历' : '项目列表'

  useEffect(() => {
    if (!isFullscreen) return
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  const workbenchListState = useMemo(
    () => getWorkbenchListState(projectTypeFilter),
    [projectTypeFilter],
  )

  const isAdminUser = useMemo(() => {
    const adminGroup = globalRoles.find(r => r.name === '管理组')
    return adminGroup ? adminGroup.members.includes(currentLoginUser) : false
  }, [globalRoles, currentLoginUser])

  const visibleProjects = projects
  const canEnterProject = (projectId: string) => canEnterProjectSpace(
    projectId,
    currentLoginUser,
    rolesByProject,
    isAdminUser,
  )
  const showProjectAccessDenied = () => message.warning({
    key: 'project-space-access-denied',
    content: '当前用户未配置该项目空间角色，无法进入项目空间',
  })

  const aboutMineProjects = useMemo(() => filterProjectsForList({
    projects: visibleProjects,
    aboutMine: aboutMineOnly,
    currentLoginUser,
    rolesByProject,
    getProjectId: project => project.id,
    matchesCategory: () => true,
    matchesSecondaryCategory: () => true,
    matchesStatus: () => true,
  }), [aboutMineOnly, currentLoginUser, rolesByProject, visibleProjects])

  const categoryBaseProjects = useMemo(
    () => aboutMineProjects.filter(project => (
      matchesProjectTypeFilter(project.type, projectTypeFilter, project.secondaryCategory)
    )),
    [aboutMineProjects, projectTypeFilter],
  )

  const projectSummaryPlanTasksByProjectId = useMemo(() => (
    Object.fromEntries(categoryBaseProjects.map(project => {
      const mockPlanTasks = buildProjectListMockPlanTasks(
        project.id,
        getTemplateTasksForProjectType(configTemplateTasksByType, project.type) || [],
      )
      if (isMachineProjectType(project.type)) {
        const marketRows = buildMarketRowsFromMarkets(
          project.markets || [],
          marketConfigsByProjectId[project.id],
        )
        const mainMarket = getMainMarket(marketRows)
        const scopedVersions = marketVersionsByKey[getMarketPlanVersionKey(project.id, mainMarket)] || []
        const publishedTasks = selectLatestPublishedScopedSnapshot(
          scopedVersions,
          publishedSnapshots,
          versionId => getProjectMarketSnapshotKey(project.id, mainMarket, versionId),
        )
        return [project.id, publishedTasks.length ? publishedTasks : mockPlanTasks]
      }
      if (project.type === PROJECT_TYPE_TOS_VERSION) {
        const typeRows = buildTosTypeRows(
          project.versionTypes || [],
          project.versionType || '',
          tosTypeConfigsByProjectId[project.id],
        )
        const mainType = getMainTosType(typeRows)
        const scopedVersions = tosTypeVersionsByKey[getTosTypeVersionKey(project.id, mainType, 'level1')] || []
        const publishedTasks = selectLatestPublishedScopedSnapshot(
          scopedVersions,
          publishedSnapshots,
          versionId => getTosTypeSnapshotKey(project.id, mainType, 'level1', versionId),
        )
        return [project.id, publishedTasks.length ? publishedTasks : mockPlanTasks]
      }
      return [project.id, mockPlanTasks]
    }))
  ), [
    categoryBaseProjects,
    configTemplateTasksByType,
    marketConfigsByProjectId,
    marketVersionsByKey,
    publishedSnapshots,
    tosTypeConfigsByProjectId,
    tosTypeVersionsByKey,
  ])

  const categoryCounts = useMemo(() => {
    return countProjectsByCategory(
      aboutMineProjects,
      PROJECT_CATEGORIES,
      (project, category) => matchesProjectTypeFilter(project.type, category, project.secondaryCategory),
    )
  }, [aboutMineProjects])

  const categoryAndSecondaryFilteredProjects = useMemo(() => {
    return filterProjectsForList({
      projects: visibleProjects,
      aboutMine: aboutMineOnly,
      currentLoginUser,
      rolesByProject,
      getProjectId: project => project.id,
      matchesCategory: project => matchesProjectTypeFilter(project.type, projectTypeFilter, project.secondaryCategory),
      matchesSecondaryCategory: project => matchesProjectSecondaryCategoryFilter(
        project.type,
        project.secondaryCategory,
        projectSecondaryCategoryFilter,
      ),
      matchesStatus: () => true,
    })
  }, [aboutMineOnly, currentLoginUser, projectSecondaryCategoryFilter, projectTypeFilter, rolesByProject, visibleProjects])

  const workspaceFilteredProjects = useMemo(() => (
    projectStatusFilter === 'all'
      ? categoryAndSecondaryFilteredProjects
      : categoryAndSecondaryFilteredProjects.filter(project => (
          project.status === projectStatusFilter
        ))
  ), [categoryAndSecondaryFilteredProjects, projectStatusFilter, projectTypeFilter])

  const secondaryCategoryOptions = useMemo(() => {
    if (projectTypeFilter === 'all') return []
    if (projectTypeFilter === PROJECT_TYPE_TOS_VERSION) return [{ label: '全部', value: 'all' }]
    const categoryOptions = PROJECT_SECONDARY_CATEGORIES[projectTypeFilter as keyof typeof PROJECT_SECONDARY_CATEGORIES] as readonly string[] | undefined
    return categoryOptions ? [{ label: '全部', value: 'all' }, ...categoryOptions.map(value => ({ label: value, value }))] : []
  }, [projectTypeFilter])

  const statusOptions = useMemo(() => [
    { label: '全部', value: 'all' },
    ...(projectTypeFilter === 'all' || !statusHasHydrated || statusHydrationError
      ? []
      : configuredStatusOptions),
  ], [configuredStatusOptions, projectTypeFilter, statusHasHydrated, statusHydrationError])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: categoryAndSecondaryFilteredProjects.length }
    categoryAndSecondaryFilteredProjects.forEach(project => {
      counts[project.status] = (counts[project.status] || 0) + 1
    })
    return counts
  }, [categoryAndSecondaryFilteredProjects])

  const technicalRows = useMemo(() => buildTechnicalProjectListRows({
    projects: aboutMineProjects,
    subprojects: technicalSubprojects,
    plansByKey: technicalPlansByKey,
    machineProjects: aboutMineProjects.filter(project => isMachineProjectType(project.type)),
  }), [aboutMineProjects, technicalPlansByKey, technicalSubprojects])

  const technicalTdtScope = configTemplateVersionScopes[getTemplateConfigScopeKey(PROJECT_CATEGORY_TECH, 'tdt')]
  const technicalSubprojectScope = configTemplateVersionScopes[getTemplateConfigScopeKey(PROJECT_CATEGORY_TECH, 'subproject')]
  const technicalTdtTemplate = getLatestPublishedTemplateTasks<ProjectSummaryTemplateTask>(
    PROJECT_CATEGORY_TECH,
    technicalTdtScope?.versions || [],
    publishedSnapshots,
    technicalTdtScope?.currentVersion || '',
    [],
    { namespacedOnly: true, planLevel: 'tdt' },
  )
  const technicalSubprojectTemplate = getLatestPublishedTemplateTasks<ProjectSummaryTemplateTask>(
    PROJECT_CATEGORY_TECH,
    technicalSubprojectScope?.versions || [],
    publishedSnapshots,
    technicalSubprojectScope?.currentVersion || '',
    [],
    { namespacedOnly: true, planLevel: 'subproject' },
  )

  const standardMatrixVariant = projectTypeFilter === PROJECT_CATEGORY_MACHINE
    ? 'machine' as const
    : projectTypeFilter === PROJECT_TYPE_TOS_VERSION
      ? 'tos' as const
      : null
  const standardTemplateTasks = getTemplateTasksForProjectType(
    configTemplateTasksByType,
    projectTypeFilter,
  ) ?? []
  const standardFieldDefinitions = useMemo(() => (
    standardMatrixVariant
      ? getProjectListFieldDefinitions(
          standardMatrixVariant,
          standardTemplateTasks,
          projectTypeFilter,
        )
      : []
  ), [projectTypeFilter, standardMatrixVariant, standardTemplateTasks])
  const standardQuickFilterDefinitions = useMemo(() => (
    getProjectSummaryQuickFilterDefinitions(projectTypeFilter, categoryBaseProjects)
  ), [categoryBaseProjects, projectTypeFilter])
  const standardFilterFieldDefinitions = useMemo<FilterFieldDefinition[]>(() => {
    const quickKeys = new Set(standardQuickFilterDefinitions.map(item => item.key))
    return standardFieldDefinitions.map(definition => ({
      key: definition.key,
      label: definition.title,
      kind: definition.inputType === 'date' ? 'date' : 'text',
      multiple: quickKeys.has(definition.key),
    }))
  }, [standardFieldDefinitions, standardQuickFilterDefinitions])
  const standardRows = useMemo(() => workspaceFilteredProjects.map(project => (
    buildProjectSummaryRow(
      project,
      standardFieldDefinitions,
      projectSummaryPlanTasksByProjectId[project.id],
    )
  )), [projectSummaryPlanTasksByProjectId, standardFieldDefinitions, workspaceFilteredProjects])
  const standardFilteredProjectIds = useMemo(() => new Set(
    applyFilterConditions(
      standardRows,
      summaryFilters,
      standardFilterFieldDefinitions,
    ).map(row => row.projectId),
  ), [standardFilterFieldDefinitions, standardRows, summaryFilters])
  const cardProjects = useMemo(() => workspaceFilteredProjects.filter(project => (
    !standardMatrixVariant || standardFilteredProjectIds.has(project.id)
  )), [standardFilteredProjectIds, standardMatrixVariant, workspaceFilteredProjects])

  const technicalActiveRows = (technicalActiveType === 'tdt'
    ? technicalRows.tdt
    : technicalRows.children) as ProjectSummaryRow[]
  const technicalStatusRows = useMemo(() => technicalActiveRows.filter(row => (
    projectStatusFilter === 'all' || row.status === projectStatusFilter
  )), [projectStatusFilter, technicalActiveRows])
  const technicalFilteredRows = useMemo(() => (
    applyFilterConditions(technicalStatusRows, technicalFilters)
  ), [technicalFilters, technicalStatusRows])
  const enterSummaryRow = (row: { targetProjectId?: unknown; targetSubprojectId?: unknown; projectId: string }) => {
    const targetProjectId = String(row.targetProjectId || row.projectId)
    const project = visibleProjects.find(item => item.id === targetProjectId)
    if (!project) return
    if (!canEnterProject(targetProjectId)) {
      showProjectAccessDenied()
      return
    }
    if (row.targetSubprojectId) {
      window.sessionStorage.setItem('pms:technical-project-list-target-child', String(row.targetSubprojectId))
    }
    activateProject(project)
    setProjectSpaceModule('basic')
    enterProjectSpace({ module: 'projectList' })
  }

  const renderProjectCard = (project: typeof projects[number]) => (
    <ProjectCard
      project={project as ProjectType}
      setSelectedProject={(p) => activateProject(p as typeof projects[number])}
      setProjectSpaceModule={setProjectSpaceModule}
      setActiveModule={(module) => {
        if (module === 'projectSpace') enterProjectSpace({ module: 'projectList' })
      }}
      PROJECT_STATUS_CONFIG={PROJECT_STATUS_CONFIG}
      canOpen={canEnterProject(project.id)}
      onOpenDenied={showProjectAccessDenied}
    />
  )

  const cardRows = projectTypeFilter === PROJECT_CATEGORY_TECH
    ? technicalFilteredRows
    : cardProjects
  const displayCategoryCounts = {
    ...categoryCounts,
    [projectTypeFilter]: cardRows.length,
  }
  const pagedCardRows = cardRows.slice(
    (projectCardPage - 1) * projectListPageSize,
    projectCardPage * projectListPageSize,
  )
  const projectListFullscreenAction = !isFullscreen && projectListView !== 'card' ? (
    <Tooltip title="全屏">
      <Button
        className="pms-project-list-icon-action"
        size="small"
        aria-label="全屏展示"
        icon={<FullscreenOutlined />}
        onClick={() => setIsFullscreen(true)}
      />
    </Tooltip>
  ) : null
  const aboutMineAction = (
    <Tooltip title={aboutMineOnly ? '当前仅显示我的项目，点击查看全部' : '当前显示全部项目，点击仅看我的'}>
      <Button
        className="pms-project-list-icon-action pms-project-list-scope-action"
        size="small"
        type={aboutMineOnly ? 'primary' : 'default'}
        aria-label={aboutMineOnly ? '切换为全部项目' : '切换为我的项目'}
        aria-pressed={aboutMineOnly}
        icon={aboutMineOnly ? <UserOutlined /> : <TeamOutlined />}
        onClick={() => {
          setAboutMineOnly(current => !current)
          setProjectCardPage(1)
        }}
      />
    </Tooltip>
  )
  const projectListToolbarTrailingActions = (
    <Space size={4} className="pms-project-list-scope-actions">
      {aboutMineAction}
      {projectListFullscreenAction}
    </Space>
  )
  const hasActiveFilterConditions = (
    projectTypeFilter === PROJECT_CATEGORY_TECH
      ? technicalFilters.some(condition => (
          condition.field !== 'technicalProjectType' && isFilterConditionActive(condition)
        ))
      : summaryFilters.some(isFilterConditionActive)
  )

  return (
    <div className="pms-project-list">
      {/* Unified toolbar */}
      <div className="pms-project-list-toolbar pms-wide-table-toolbar" style={{ ...WORKSPACE_FILTER_TOOLBAR_STYLE, flexDirection: 'column', alignItems: 'stretch' }}>
        <div
          className={`pms-project-list-filter-grid pms-toolbar${hasActiveFilterConditions ? ' has-active-filters' : ''}`}
          style={{ display: 'grid', gap: 4, padding: '5px 8px', borderRadius: 10 }}
        >
            <div className="pms-project-list-category-row" aria-label="项目分类筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ width: 92, paddingLeft: 4, color: '#6b7280', fontSize: 12, fontWeight: 600 }}>项目分类</span>
              {PROJECT_CATEGORIES.map(value => ({ label: value, value })).map(item => {
                const isActive = projectTypeFilter === item.value
                return (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => {
                      setProjectTypeFilter(item.value)
                      setProjectSecondaryCategoryFilter('all')
                      setProjectStatusFilter('all')
                      setSummaryFilters([])
                      setTechnicalFilters(updateLinkedQuickFilterCondition([], 'technicalProjectType', ['tdt']))
                      setProjectCardPage(1)
                    }}
                    style={{
                      ...WORKSPACE_FILTER_CHIP_STYLE,
                      padding: '3px 12px', borderRadius: 16, cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, transition: 'all 0.2s',
                      background: isActive ? '#fff' : 'transparent',
                      color: isActive ? 'var(--pms-brand-strong)' : '#6b7280',
                      boxShadow: isActive ? 'var(--pms-shadow-xs)' : 'none',
                      border: 0,
                    }}
                  >
                    {item.label} <span style={{ fontSize: 11, opacity: 0.8 }}>{displayCategoryCounts[item.value] || 0}</span>
                  </button>
                )
              })}
              <div className="pms-project-list-category-actions">
                <Segmented
                  aria-label="项目列表视图"
                  size="small"
                  className="pms-project-list-view-switch"
                  value={projectListView}
                  onChange={(value) => {
                    setProjectListView(value as ProjectListViewMode)
                    setProjectCardPage(1)
                  }}
                  options={[
                    {
                      label: <span className="pms-project-list-view-option" aria-label="列表视图"><UnorderedListOutlined />列表视图</span>,
                      value: 'list',
                    },
                    {
                      label: <span className="pms-project-list-view-option" aria-label="日历视图"><CalendarOutlined />日历视图</span>,
                      value: 'calendar',
                    },
                    {
                      label: <span className="pms-project-list-view-option" aria-label="卡片视图"><AppstoreOutlined />卡片视图</span>,
                      value: 'card',
                    },
                  ]}
                />
                <div className="pms-project-list-table-actions" ref={setProjectListTableToolbarHost} />
                {isAdminUser && (
                  <Tooltip title="新增项目">
                    <Button
                      className="pms-project-list-icon-action"
                      aria-label="新增项目"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setAddProjectOpen(true)}
                    />
                  </Tooltip>
                )}
              </div>
            </div>

            {workbenchListState.kind !== 'select-category' && (workbenchListState.showSecondaryCategory || projectTypeFilter === PROJECT_TYPE_TOS_VERSION) && (
              <div className="pms-project-list-secondary-row" aria-label="项目二级分类快捷筛选">
                <span style={{ width: 92, paddingLeft: 4, color: '#6b7280', fontSize: 12, fontWeight: 600 }}>二级分类</span>
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
                        color: isActive ? 'var(--pms-brand-strong)' : '#6b7280',
                        boxShadow: isActive ? 'var(--pms-shadow-xs)' : 'none',
                        border: 0,
                      }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}

            {workbenchListState.kind !== 'select-category' && (workbenchListState.showStatusQuickFilter || projectTypeFilter === PROJECT_TYPE_TOS_VERSION || projectTypeFilter === PROJECT_CATEGORY_TECH) && (
              <div aria-label="状态快捷筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ width: 92, paddingLeft: 4, color: '#6b7280', fontSize: 12, fontWeight: 600 }}>项目状态</span>
                {projectTypeFilter !== 'all' && !statusHasHydrated ? <span style={{ fontSize: 12, color: '#6b7280' }}>正在加载配置…</span> : null}
                {statusHydrationError ? (
                  <Button danger size="small" onClick={() => void retryStatusHydration()}>配置加载失败，重试</Button>
                ) : null}
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
                        background: isActive ? 'var(--pms-brand)' : 'transparent',
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

            {hasActiveFilterConditions && (
              <div
                className="pms-project-list-filter-summary-row"
                ref={setProjectListFilterSummaryHost}
              />
            )}

            {projectTypeFilter === PROJECT_CATEGORY_TECH && (
              <div className="pms-project-list-technical-type-row" aria-label="技术项目类型快捷筛选">
                <span style={{ width: 92, paddingLeft: 4, color: '#6b7280', fontSize: 12, fontWeight: 600 }}>项目类型</span>
                {TECHNICAL_PROJECT_TYPE_OPTIONS.map(item => (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => setTechnicalFilters(current => updateLinkedQuickFilterCondition(
                      current,
                      'technicalProjectType',
                      [item.value],
                    ))}
                    className={technicalActiveType === item.value
                      ? 'pms-project-filter-chip is-active'
                      : 'pms-project-filter-chip'}
                  >{item.label}</button>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Project list content */}
      <section
        className={`pms-project-list-content ${isFullscreen ? 'is-fullscreen pms-page-shell' : ''}`.trim()}
        aria-label={isFullscreen ? `${fullscreenViewTitle}全屏展示` : undefined}
      >
        {isFullscreen && (
          <header className="pms-project-list-fullscreen__header pms-toolbar">
            <div>
              <strong>{fullscreenViewTitle}</strong>
              <span>当前筛选结果</span>
            </div>
            <Tooltip title="退出全屏">
              <Button
                className="pms-project-list-icon-action"
                size="small"
                aria-label="退出全屏"
                icon={<FullscreenExitOutlined />}
                onClick={() => setIsFullscreen(false)}
              />
            </Tooltip>
          </header>
        )}
        <div
          className={`pms-project-list-content__body ${projectListView === 'card' ? '' : 'pms-solid-surface'}`.trim()}
          style={{ display: 'flex', gap: 20 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {projectTypeFilter === PROJECT_CATEGORY_CAPABILITY ? (
              <Empty description="该项目分类暂未配置" />
            ) : projectListView === 'calendar' ? (
              <>
                <ProjectListCalendar
                  rows={(projectTypeFilter === PROJECT_CATEGORY_TECH ? technicalFilteredRows : standardRows.filter(row => standardFilteredProjectIds.has(row.projectId)))}
                  milestoneDefinitions={projectTypeFilter === PROJECT_CATEGORY_TECH
                    ? (technicalActiveType === 'tdt' ? technicalTdtTemplate : technicalSubprojectTemplate).map(task => ({
                        key: `milestone::${task.taskName}`,
                        label: task.taskName,
                      }))
                    : standardFieldDefinitions
                        .filter(definition => definition.source === 'templateTask')
                        .map(definition => ({ key: definition.key, label: definition.title }))}
                  onOpenRow={enterSummaryRow}
                />
                {projectTypeFilter === PROJECT_CATEGORY_TECH ? (
                  <ProjectSummaryTable
                    projects={[]}
                    optionProjects={[]}
                    planTasksByProjectId={{}}
                    projectType={PROJECT_CATEGORY_TECH}
                    versions={versions}
                    currentVersion={currentVersion}
                    publishedSnapshots={publishedSnapshots}
                    currentTemplateTasks={technicalActiveType === 'tdt' ? technicalTdtTemplate : technicalSubprojectTemplate}
                    matrixTemplateTasks={technicalActiveType === 'tdt' ? technicalTdtTemplate : technicalSubprojectTemplate}
                    matrixVariant={technicalActiveType === 'tdt' ? 'technical-tdt' : 'technical-subproject'}
                    providedRows={technicalStatusRows}
                    storageNamespace={`project-list-technical-${technicalActiveType}`}
                    onViewProject={() => undefined}
                    onViewRow={enterSummaryRow}
                    controlledFilters={technicalFilters}
                    onFiltersChange={setTechnicalFilters}
                    showQuickFilters={false}
                    showTable={false}
                    toolbarHost={projectListTableToolbarHost}
                    filterSummaryHost={projectListFilterSummaryHost}
                    toolbarTrailingAction={projectListToolbarTrailingActions}
                  />
                ) : standardMatrixVariant ? (
                  <ProjectSummaryTable
                    projects={workspaceFilteredProjects}
                    optionProjects={categoryBaseProjects}
                    planTasksByProjectId={projectSummaryPlanTasksByProjectId}
                    projectType={projectTypeFilter}
                    versions={versions}
                    currentVersion={currentVersion}
                    publishedSnapshots={publishedSnapshots}
                    currentTemplateTasks={standardTemplateTasks}
                    storageNamespace="workbench-project-list"
                    matrixVariant={standardMatrixVariant}
                    controlledFilters={summaryFilters}
                    onFiltersChange={setSummaryFilters}
                    showQuickFilters={false}
                    showTable={false}
                    toolbarHost={projectListTableToolbarHost}
                    filterSummaryHost={projectListFilterSummaryHost}
                    toolbarTrailingAction={projectListToolbarTrailingActions}
                    machineHierarchy={standardMatrixVariant === 'machine'}
                    onViewProject={() => undefined}
                  />
                ) : null}
              </>
            ) : projectListView === 'card' ? (
              <>
                <Row gutter={[8, 8]}>
                  {projectTypeFilter === PROJECT_CATEGORY_TECH
                    ? pagedCardRows.map(row => {
                        const technicalRow = row as ProjectSummaryRow
                        if (technicalActiveType === 'tdt') {
                          const project = visibleProjects.find(item => item.id === technicalRow.targetProjectId)
                          return project
                            ? <Col className="pms-project-list-card-column" xs={24} sm={12} md={8} xl={6} key={technicalRow.key}>{renderProjectCard(project)}</Col>
                            : null
                        }
                        return (
                          <Col className="pms-project-list-card-column" xs={24} sm={12} md={8} xl={6} key={technicalRow.key}>
                            <Card
                              hoverable
                              className="pms-technical-project-card pms-glass-surface pms-interactive-surface"
                              onClick={() => enterSummaryRow(technicalRow as ProjectSummaryRow & { targetProjectId: string })}
                            >
                              <div className="pms-technical-project-card-title">{String(technicalRow.projectName)}</div>
                              <div className="pms-technical-project-card-parent">所属TDT：{String(technicalRow.parentProjectName ?? '-')}</div>
                              <div className="pms-technical-project-card-grid">
                                <span>核心价值<strong>{String(technicalRow.coreValue ?? '-')}</strong></span>
                                <span>开发模式<strong>{String(technicalRow.developmentMode ?? '-')}</strong></span>
                                <span>首导tOS<strong>{String(technicalRow.firstTosVersion ?? '-')}</strong></span>
                                <span>项目阶段<strong>{String(technicalRow.projectStage ?? '-')}</strong></span>
                              </div>
                            </Card>
                          </Col>
                        )
                      })
                    : pagedCardRows.map(project => {
                        const item = project as typeof projects[number]
                        return <Col className="pms-project-list-card-column" xs={24} sm={12} md={8} xl={6} key={item.id}>{renderProjectCard(item)}</Col>
                      })}
                </Row>
                <div className="pms-project-list-pagination">
                  <Pagination
                    current={projectCardPage}
                    pageSize={projectListPageSize}
                    total={cardRows.length}
                    onChange={(page) => setProjectCardPage(page)}
                    showTotal={(total) => `共 ${total} 个项目`}
                    showSizeChanger={false}
                    size="small"
                  />
                </div>
                {projectTypeFilter === PROJECT_CATEGORY_TECH ? (
                  <ProjectSummaryTable
                    projects={[]}
                    optionProjects={[]}
                    planTasksByProjectId={{}}
                    projectType={PROJECT_CATEGORY_TECH}
                    versions={versions}
                    currentVersion={currentVersion}
                    publishedSnapshots={publishedSnapshots}
                    currentTemplateTasks={technicalActiveType === 'tdt' ? technicalTdtTemplate : technicalSubprojectTemplate}
                    matrixTemplateTasks={technicalActiveType === 'tdt' ? technicalTdtTemplate : technicalSubprojectTemplate}
                    matrixVariant={technicalActiveType === 'tdt' ? 'technical-tdt' : 'technical-subproject'}
                    providedRows={technicalStatusRows}
                    storageNamespace={`project-list-technical-${technicalActiveType}`}
                    onViewProject={() => undefined}
                    onViewRow={enterSummaryRow}
                    controlledFilters={technicalFilters}
                    onFiltersChange={setTechnicalFilters}
                    showQuickFilters={false}
                    showTable={false}
                    toolbarHost={projectListTableToolbarHost}
                    filterSummaryHost={projectListFilterSummaryHost}
                    toolbarTrailingAction={projectListToolbarTrailingActions}
                  />
                ) : standardMatrixVariant ? (
                  <ProjectSummaryTable
                    projects={workspaceFilteredProjects}
                    optionProjects={categoryBaseProjects}
                    planTasksByProjectId={projectSummaryPlanTasksByProjectId}
                    projectType={projectTypeFilter}
                    versions={versions}
                    currentVersion={currentVersion}
                    publishedSnapshots={publishedSnapshots}
                    currentTemplateTasks={standardTemplateTasks}
                    storageNamespace="workbench-project-list"
                    matrixVariant={standardMatrixVariant}
                    controlledFilters={summaryFilters}
                    onFiltersChange={setSummaryFilters}
                    showQuickFilters={false}
                    showTable={false}
                    toolbarHost={projectListTableToolbarHost}
                    filterSummaryHost={projectListFilterSummaryHost}
                    toolbarTrailingAction={projectListToolbarTrailingActions}
                    machineHierarchy={standardMatrixVariant === 'machine'}
                    onViewProject={() => undefined}
                  />
                ) : null}
              </>
            ) : (
              projectTypeFilter === PROJECT_CATEGORY_TECH ? (
                <div className="pms-technical-list-panel">
                  <ProjectSummaryTable
                    projects={[]}
                    optionProjects={[]}
                    planTasksByProjectId={{}}
                    projectType={PROJECT_CATEGORY_TECH}
                    versions={versions}
                    currentVersion={currentVersion}
                    publishedSnapshots={publishedSnapshots}
                    currentTemplateTasks={technicalActiveType === 'tdt' ? technicalTdtTemplate : technicalSubprojectTemplate}
                    matrixTemplateTasks={technicalActiveType === 'tdt' ? technicalTdtTemplate : technicalSubprojectTemplate}
                    matrixVariant={technicalActiveType === 'tdt' ? 'technical-tdt' : 'technical-subproject'}
                    providedRows={technicalStatusRows}
                    storageNamespace={`project-list-technical-${technicalActiveType}`}
                    onViewProject={() => undefined}
                    onViewRow={enterSummaryRow}
                    controlledFilters={technicalFilters}
                    onFiltersChange={setTechnicalFilters}
                    showQuickFilters={false}
                    toolbarHost={projectListTableToolbarHost}
                    filterSummaryHost={projectListFilterSummaryHost}
                    toolbarTrailingAction={projectListToolbarTrailingActions}
                    tablePageSize={projectListPageSize}
                  />
                </div>
              ) : (
                <ProjectSummaryTable
                  projects={workspaceFilteredProjects}
                  optionProjects={categoryBaseProjects}
                  planTasksByProjectId={projectSummaryPlanTasksByProjectId}
                  projectType={projectTypeFilter}
                  versions={versions}
                  currentVersion={currentVersion}
                  publishedSnapshots={publishedSnapshots}
                  currentTemplateTasks={standardTemplateTasks}
                  storageNamespace="workbench-project-list"
                  matrixVariant={standardMatrixVariant ?? 'tos'}
                  controlledFilters={summaryFilters}
                  onFiltersChange={setSummaryFilters}
                  showQuickFilters={false}
                  toolbarHost={projectListTableToolbarHost}
                  filterSummaryHost={projectListFilterSummaryHost}
                  toolbarTrailingAction={projectListToolbarTrailingActions}
                  tablePageSize={projectListPageSize}
                  machineHierarchy={standardMatrixVariant === 'machine'}
                  onViewProject={(projectId) => {
                    const project = workspaceFilteredProjects.find(item => item.id === projectId)
                    if (!project) return
                    if (!canEnterProject(projectId)) {
                      showProjectAccessDenied()
                      return
                    }
                    activateProject(project)
                    setProjectSpaceModule('basic')
                    enterProjectSpace({ module: 'projectList' })
                  }}
                />
              )
            )}
          </div>
        </div>
      </section>
      <AddProjectModal open={addProjectOpen} onCancel={() => setAddProjectOpen(false)} />
    </div>
  )
}
