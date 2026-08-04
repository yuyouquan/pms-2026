'use client'

import { useState, useMemo, type CSSProperties } from 'react'
import {
  Row, Col, Input, Button, Card, Checkbox, Empty, Segmented, Pagination, Select,
} from 'antd'
import {
  SearchOutlined, PlusOutlined,
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
  getProjectStatusOptions,
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
import { applyFilterConditions, type AnyFilterCondition, type FilterFieldDefinition } from '@/lib/filterConditions'
import {
  countProjectsByCategory,
  filterProjectsForList,
  matchesAggregateProjectStatus,
  type AggregateProjectStatus,
} from '@/lib/projectListFilters'
import ProjectListCalendar from '@/components/project-list/ProjectListCalendar'
import type { ProjectListViewMode } from '@/stores/project'

const WORKSPACE_FILTER_TOOLBAR_STYLE: CSSProperties = {
  background: 'rgba(255,255,255,0.8)',
  backdropFilter: 'blur(8px)',
  borderRadius: 12,
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
  const [aboutMineOnly, setAboutMineOnly] = useState(true)
  const technicalSelectedTypes = getLinkedQuickFilterValues(technicalFilters, 'technicalProjectType')
  const technicalActiveType = resolveTechnicalProjectType(technicalSelectedTypes)

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
      if (isMachineProjectType(project.type)) {
        const marketRows = buildMarketRowsFromMarkets(
          project.markets || [],
          marketConfigsByProjectId[project.id],
        )
        const mainMarket = getMainMarket(marketRows)
        const scopedVersions = marketVersionsByKey[getMarketPlanVersionKey(project.id, mainMarket)] || []
        return [project.id, selectLatestPublishedScopedSnapshot(
          scopedVersions,
          publishedSnapshots,
          versionId => getProjectMarketSnapshotKey(project.id, mainMarket, versionId),
        )]
      }
      if (project.type === PROJECT_TYPE_TOS_VERSION) {
        const typeRows = buildTosTypeRows(
          project.versionTypes || [],
          project.versionType || '',
          tosTypeConfigsByProjectId[project.id],
        )
        const mainType = getMainTosType(typeRows)
        const scopedVersions = tosTypeVersionsByKey[getTosTypeVersionKey(project.id, mainType, 'level1')] || []
        return [project.id, selectLatestPublishedScopedSnapshot(
          scopedVersions,
          publishedSnapshots,
          versionId => getTosTypeSnapshotKey(project.id, mainType, 'level1', versionId),
        )]
      }
      return [project.id, []]
    }))
  ), [
    categoryBaseProjects,
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
          projectTypeFilter === PROJECT_TYPE_TOS_VERSION || projectTypeFilter === PROJECT_CATEGORY_TECH
            ? matchesAggregateProjectStatus(project.status, projectStatusFilter as AggregateProjectStatus)
            : project.status === projectStatusFilter
        ))
  ), [categoryAndSecondaryFilteredProjects, projectStatusFilter, projectTypeFilter])

  const secondaryCategoryOptions = useMemo(() => {
    if (projectTypeFilter === 'all') return []
    if (projectTypeFilter === PROJECT_TYPE_TOS_VERSION) return [{ label: '全部', value: 'all' }]
    const categoryOptions = PROJECT_SECONDARY_CATEGORIES[projectTypeFilter as keyof typeof PROJECT_SECONDARY_CATEGORIES] as readonly string[] | undefined
    return categoryOptions ? [{ label: '全部', value: 'all' }, ...categoryOptions.map(value => ({ label: value, value }))] : []
  }, [projectTypeFilter])

  const statusOptions = useMemo(() => (
    projectTypeFilter === PROJECT_TYPE_TOS_VERSION || projectTypeFilter === PROJECT_CATEGORY_TECH
      ? [
          { label: '全部', value: 'all' },
          { label: '进行中', value: 'inProgress' },
          { label: '已完成', value: 'completed' },
        ]
      : projectTypeFilter === 'all'
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
    matchesAggregateProjectStatus(row.status, projectStatusFilter as AggregateProjectStatus)
  )), [projectStatusFilter, technicalActiveRows])
  const technicalFilteredRows = useMemo(() => (
    applyFilterConditions(technicalStatusRows, technicalFilters)
  ), [technicalFilters, technicalStatusRows])
  const technicalFilterOptions = useMemo(() => {
    const optionsFor = (key: string) => [...new Set(technicalActiveRows
      .map(row => String(row[key] ?? '').trim())
      .filter(value => value && value !== '-'))]
      .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }))
      .map(value => ({ label: value, value }))
    return {
      technicalTrack: optionsFor('technicalTrack'),
      projectStage: optionsFor('projectStage'),
    }
  }, [technicalActiveRows])

  const enterSummaryRow = (row: { targetProjectId?: unknown; targetSubprojectId?: unknown; projectId: string }) => {
    const targetProjectId = String(row.targetProjectId || row.projectId)
    const project = visibleProjects.find(item => item.id === targetProjectId)
    if (!project) return
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
    (projectCardPage - 1) * projectCardPageSize,
    projectCardPage * projectCardPageSize,
  )

  return (
    <div className="pms-project-list">
      {/* Unified toolbar */}
      <div className="pms-project-list-toolbar pms-wide-table-toolbar" style={{ ...WORKSPACE_FILTER_TOOLBAR_STYLE, flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="pms-project-list-filter-grid" style={{ display: 'grid', gap: 4, padding: '5px 8px', background: 'rgba(99,102,241,0.04)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.06)' }}>
            <div aria-label="项目分类筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
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
                  onChange={(value) => setProjectListView(value as ProjectListViewMode)}
                  options={[
                    { label: <span className="pms-project-list-view-option" aria-label="列表视图">列表视图</span>, value: 'list' },
                    { label: <span className="pms-project-list-view-option" aria-label="卡片视图">卡片视图</span>, value: 'card' },
                    { label: <span className="pms-project-list-view-option" aria-label="日历视图">日历视图</span>, value: 'calendar' },
                  ]}
                />
                {isAdminUser && (
                  <Button aria-label="新增项目" type="primary" icon={<PlusOutlined />} onClick={() => setAddProjectOpen(true)}>
                    新增项目
                  </Button>
                )}
              </div>
            </div>

            {workbenchListState.kind !== 'select-category' && (workbenchListState.showSecondaryCategory || projectTypeFilter === PROJECT_TYPE_TOS_VERSION) && (
              <div aria-label="项目二级分类快捷筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
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

            {workbenchListState.kind !== 'select-category' && (workbenchListState.showStatusQuickFilter || projectTypeFilter === PROJECT_TYPE_TOS_VERSION || projectTypeFilter === PROJECT_CATEGORY_TECH) && (
              <div aria-label="状态快捷筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ width: 92, paddingLeft: 4, color: '#6b7280', fontSize: 12, fontWeight: 600 }}>项目状态</span>
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

            {projectTypeFilter === PROJECT_CATEGORY_TECH && (
              <div aria-label="技术项目类型快捷筛选" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
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

            {standardMatrixVariant && (
              <div aria-label="项目字段快捷筛选" className="pms-project-list-field-filters">
                <span className="pms-project-list-filter-label">快捷筛选</span>
                {standardMatrixVariant === 'machine' && (
                  <Input
                    size="small"
                    allowClear
                    aria-label="快捷筛选-项目名称"
                    placeholder="项目名称"
                    prefix={<SearchOutlined />}
                    value={typeof summaryFilters.find(item => item.field === 'projectName')?.value === 'string'
                      ? String(summaryFilters.find(item => item.field === 'projectName')?.value)
                      : ''}
                    onChange={event => {
                      const value = event.target.value
                      setSummaryFilters(current => [
                        ...current.filter(condition => condition.field !== 'projectName'),
                        ...(value ? [{ id: 'quick-projectName', field: 'projectName', operator: 'contains' as const, value }] : []),
                      ])
                      setProjectCardPage(1)
                    }}
                  />
                )}
                {standardQuickFilterDefinitions.map(definition => (
                  <Select
                    size="small"
                    aria-label={`快捷筛选-${definition.label}`}
                    key={definition.key}
                    mode="multiple"
                    allowClear
                    showSearch
                    maxTagCount={1}
                    optionFilterProp="label"
                    placeholder={definition.label}
                    options={definition.options}
                    value={getLinkedQuickFilterValues(summaryFilters, definition.key)}
                    onChange={values => {
                      setSummaryFilters(current => updateLinkedQuickFilterCondition(current, definition.key, values))
                      setProjectCardPage(1)
                    }}
                  />
                ))}
                <Checkbox
                  checked={aboutMineOnly}
                  onChange={event => { setAboutMineOnly(event.target.checked); setProjectCardPage(1) }}
                >关于我的</Checkbox>
                <div className="pms-project-list-table-actions" ref={setProjectListTableToolbarHost} />
              </div>
            )}

            {projectTypeFilter === PROJECT_CATEGORY_TECH && (
              <div aria-label="技术项目字段快捷筛选" className="pms-project-list-field-filters">
                <span className="pms-project-list-filter-label">快捷筛选</span>
                <Input
                  size="small"
                  allowClear
                  aria-label="快捷筛选-项目名称"
                  placeholder="项目名称"
                  prefix={<SearchOutlined />}
                  value={typeof technicalFilters.find(item => item.field === 'projectName')?.value === 'string'
                    ? String(technicalFilters.find(item => item.field === 'projectName')?.value)
                    : ''}
                  onChange={event => {
                    const value = event.target.value
                    setTechnicalFilters(current => [
                      ...current.filter(condition => condition.field !== 'projectName'),
                      ...(value ? [{ id: 'quick-projectName', field: 'projectName', operator: 'contains' as const, value }] : []),
                    ])
                    setProjectCardPage(1)
                  }}
                />
                {(['technicalTrack', 'projectStage'] as const).map(key => {
                  const label = key === 'technicalTrack' ? '技术赛道' : '项目阶段'
                  return (
                    <Select
                      size="small"
                      aria-label={`快捷筛选-${label}`}
                      key={key}
                      mode="multiple"
                      allowClear
                      showSearch
                      maxTagCount={1}
                      optionFilterProp="label"
                      placeholder={label}
                      options={technicalFilterOptions[key]}
                      value={getLinkedQuickFilterValues(technicalFilters, key)}
                      onChange={values => {
                        setTechnicalFilters(current => updateLinkedQuickFilterCondition(current, key, values))
                        setProjectCardPage(1)
                      }}
                    />
                  )
                })}
                <Checkbox
                  checked={aboutMineOnly}
                  onChange={event => { setAboutMineOnly(event.target.checked); setProjectCardPage(1) }}
                >关于我的</Checkbox>
                <div className="pms-project-list-table-actions" ref={setProjectListTableToolbarHost} />
              </div>
            )}
        </div>
      </div>

      {/* Project list content */}
      <div className="pms-project-list-content" style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {projectTypeFilter === PROJECT_CATEGORY_CAPABILITY ? (
              <Empty description="该项目分类暂未配置" />
            ) : projectListView === 'calendar' ? (
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
            ) : projectListView === 'card' ? (
              <>
                <Row gutter={[16, 16]}>
                  {projectTypeFilter === PROJECT_CATEGORY_TECH
                    ? pagedCardRows.map(row => {
                        const technicalRow = row as ProjectSummaryRow
                        if (technicalActiveType === 'tdt') {
                          const project = visibleProjects.find(item => item.id === technicalRow.targetProjectId)
                          return project
                            ? <Col xs={24} sm={12} lg={8} key={technicalRow.key}>{renderProjectCard(project)}</Col>
                            : null
                        }
                        return (
                          <Col xs={24} sm={12} lg={8} key={technicalRow.key}>
                            <Card
                              hoverable
                              className="pms-technical-project-card"
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
                        return <Col xs={24} sm={12} lg={8} key={item.id}>{renderProjectCard(item)}</Col>
                      })}
                </Row>
                {cardRows.length > projectCardPageSize && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <Pagination
                      current={projectCardPage}
                      pageSize={projectCardPageSize}
                      total={cardRows.length}
                      onChange={(page) => setProjectCardPage(page)}
                      showTotal={(total) => `共 ${total} 个项目`}
                      showSizeChanger={false}
                      size="small"
                    />
                  </div>
                )}
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
                    groupBy={standardMatrixVariant === 'machine'
                      ? { key: 'productSeries', fallbackLabel: '未配置产品系列' }
                      : undefined}
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
                  groupBy={standardMatrixVariant === 'machine'
                    ? { key: 'productSeries', fallbackLabel: '未配置产品系列' }
                    : undefined}
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
