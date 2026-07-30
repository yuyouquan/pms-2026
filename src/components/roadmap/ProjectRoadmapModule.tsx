'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Empty, Modal, Result, message } from 'antd'
import {
  applyRoadmapFilters,
  buildRoadmapFilterFieldDefinitions,
  createRoadmapTextFilterDebouncer,
  getRoadmapQuickFilterValue,
  getRoadmapSelectedTosVersionIds,
  sanitizeRoadmapFilterConditions,
  setRoadmapQuickFilter,
  type RoadmapTextFilterDebouncer,
} from '@/lib/roadmapFilters'
import {
  adaptNormalProject,
  adaptPlannedProject,
  countConflictingPlannedProjects,
  deriveRoadmapPlanningConflicts,
} from '@/lib/roadmapProjectAdapter'
import { useHasGlobalPermission } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useRoadmapStore } from '@/stores/roadmap'
import type { ProjectItem } from '@/types/app'
import type {
  PlannedRoadmapProject,
  RoadmapColumnKey,
  RoadmapFilterCondition,
  RoadmapPlanningConflictGroup,
  RoadmapProjectRow,
  RoadmapSortState,
  RoadmapViewMode,
  TosVersionConfig,
} from '@/types/roadmap'
import PlannedProjectModal from './PlannedProjectModal'
import RoadmapColumnSettingsDrawer from './RoadmapColumnSettingsDrawer'
import RoadmapChangeLogDrawer from './RoadmapChangeLogDrawer'
import RoadmapConflictDrawer from './RoadmapConflictDrawer'
import RoadmapEvolutionView from './RoadmapEvolutionView'
import RoadmapFilterDrawer from './RoadmapFilterDrawer'
import RoadmapTableView from './RoadmapTableView'
import RoadmapToolbar from './RoadmapToolbar'
import TosVersionMaintenanceModal from './TosVersionMaintenanceModal'

const isPresent = <T,>(value: T | null): value is T => value !== null

export interface RoadmapViewRenderContext {
  rows: readonly RoadmapProjectRow[]
  normalRows: readonly RoadmapProjectRow[]
  plannedRows: readonly RoadmapProjectRow[]
  conflicts: readonly RoadmapPlanningConflictGroup[]
  versions: readonly TosVersionConfig[]
  selectedTosVersionId: string | null
  selectedTosVersionIds: readonly string[]
  columnOrder: readonly RoadmapColumnKey[]
  visibleColumns: readonly RoadmapColumnKey[]
  sort: RoadmapSortState
  canEdit: boolean
  onViewProject: (projectId: string, market?: string) => void
  onSelectedTosVersionChange: (id: string | null) => void
  onSortChange: (sort: RoadmapSortState) => void
  onOpenConflict: (conflictKey: string) => void
  onEditPlannedProject: (projectId: string) => void
  onDeletePlannedProject: (projectId: string) => void
  collapsedTargetVersionIds: ReadonlySet<string>
  onToggleTarget: (versionId: string) => void
}

interface ProjectRoadmapModuleProps {
  projects: readonly ProjectItem[]
  onViewProject: (projectId: string, market?: string) => void
  onOpenChangeLog?: () => void
  renderTableView?: (context: RoadmapViewRenderContext) => ReactNode
  renderEvolutionView?: (context: RoadmapViewRenderContext) => ReactNode
}

export default function ProjectRoadmapModule({
  projects,
  onViewProject,
  onOpenChangeLog,
  renderTableView,
  renderEvolutionView,
}: ProjectRoadmapModuleProps) {
  const currentLoginUser = useProjectStore(state => state.currentLoginUser)
  const hasPermission = useHasGlobalPermission(currentLoginUser)
  const canView = hasPermission('roadmap:view')
  const canEdit = hasPermission('roadmap:edit')

  const plannedProjects = useRoadmapStore(state => state.plannedProjects)
  const versions = useRoadmapStore(state => state.tosVersions)
  const changeLogs = useRoadmapStore(state => state.changeLogs)
  const viewMode = useRoadmapStore(state => state.viewMode)
  const selectedTosVersionId = useRoadmapStore(state => state.selectedTosVersionId)
  const filters = useRoadmapStore(state => state.filters)
  const columnOrder = useRoadmapStore(state => state.columnOrder)
  const visibleColumns = useRoadmapStore(state => state.visibleColumns)
  const sort = useRoadmapStore(state => state.sort)
  const selectedConflictKey = useRoadmapStore(state => state.selectedConflictKey)
  const setViewMode = useRoadmapStore(state => state.setViewMode)
  const setSelectedTosVersionId = useRoadmapStore(state => state.setSelectedTosVersionId)
  const setFilters = useRoadmapStore(state => state.setFilters)
  const setColumnSettings = useRoadmapStore(state => state.setColumnSettings)
  const setSort = useRoadmapStore(state => state.setSort)
  const setSelectedConflictKey = useRoadmapStore(state => state.setSelectedConflictKey)
  const deletePlannedProject = useRoadmapStore(state => state.deletePlannedProject)

  const [plannedModalOpen, setPlannedModalOpen] = useState(false)
  const [editingPlannedProjectId, setEditingPlannedProjectId] = useState<string | null>(null)
  const [tosMaintenanceOpen, setTosMaintenanceOpen] = useState(false)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false)
  const [changeLogOpen, setChangeLogOpen] = useState(false)
  const [conflictDrawerOpen, setConflictDrawerOpen] = useState(false)
  const [collapsedTargetVersionIds, setCollapsedTargetVersionIds] = useState<Set<string>>(
    () => new Set(versions.filter(version => version.targets.length > 0).map(version => version.id)),
  )
  const knownTargetVersionIdsRef = useRef<Set<string>>(
    new Set(versions.filter(version => version.targets.length > 0).map(version => version.id)),
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const roadmapShellRef = useRef<HTMLElement>(null)
  const textFilterDebouncerRef = useRef<RoadmapTextFilterDebouncer | null>(null)

  const filterFieldDefinitions = useMemo(
    () => buildRoadmapFilterFieldDefinitions(versions),
    [versions],
  )
  const filterDefinitionsByKey = useMemo(
    () => new Map(filterFieldDefinitions.map(definition => [definition.key, definition])),
    [filterFieldDefinitions],
  )

  const normalRows = useMemo(
    () => projects.map(project => adaptNormalProject(project, versions)).filter(isPresent),
    [projects, versions],
  )
  const plannedRows = useMemo(
    () => plannedProjects.map(adaptPlannedProject),
    [plannedProjects],
  )
  const conflicts = useMemo(
    () => deriveRoadmapPlanningConflicts(normalRows, plannedRows),
    [normalRows, plannedRows],
  )
  const conflictCount = countConflictingPlannedProjects([...conflicts])
  const allRows = useMemo(
    () => [...normalRows, ...plannedRows],
    [normalRows, plannedRows],
  )

  const normalizedFilters = useMemo(
    () => sanitizeRoadmapFilterConditions(filters, versions),
    [filters, versions],
  )
  const brandFilter = getRoadmapQuickFilterValue(normalizedFilters, 'brand')
  const productTypeFilter = getRoadmapQuickFilterValue(normalizedFilters, 'productType')
  const configuredFilterCount = normalizedFilters.length
  const selectedTosVersionIds = useMemo(
    () => getRoadmapSelectedTosVersionIds(normalizedFilters),
    [normalizedFilters],
  )
  const immediateFilters = useMemo(() => normalizedFilters.filter(condition => (
    filterDefinitionsByKey.get(condition.field)?.kind !== 'text'
  )), [filterDefinitionsByKey, normalizedFilters])
  const textFilters = useMemo(() => normalizedFilters.filter(condition => (
    filterDefinitionsByKey.get(condition.field)?.kind === 'text'
  )), [filterDefinitionsByKey, normalizedFilters])
  const [effectiveTextFilters, setEffectiveTextFilters] = useState<RoadmapFilterCondition[]>(textFilters)

  useEffect(() => {
    if (!textFilterDebouncerRef.current) {
      textFilterDebouncerRef.current = createRoadmapTextFilterDebouncer(
        textFilters,
        setEffectiveTextFilters,
      )
      return
    }
    textFilterDebouncerRef.current.update(textFilters)
  }, [textFilters])

  useEffect(() => () => {
    textFilterDebouncerRef.current?.dispose()
    textFilterDebouncerRef.current = null
  }, [])

  const appliedFilters = useMemo(
    () => [...immediateFilters, ...effectiveTextFilters],
    [effectiveTextFilters, immediateFilters],
  )
  const filteredRows = useMemo(
    () => applyRoadmapFilters(allRows, 'all', 'all', appliedFilters, filterFieldDefinitions),
    [allRows, appliedFilters, filterFieldDefinitions],
  )

  const targetVersionIds = useMemo(
    () => versions.filter(version => version.targets.length > 0).map(version => version.id),
    [versions],
  )
  const allTargetsCollapsed = targetVersionIds.length > 0
    && targetVersionIds.every(id => collapsedTargetVersionIds.has(id))

  useEffect(() => {
    const validIds = new Set(versions.map(version => version.id))
    const nextTargetIds = new Set(targetVersionIds)
    const newTargetIds = targetVersionIds.filter(id => !knownTargetVersionIdsRef.current.has(id))
    setCollapsedTargetVersionIds(current => {
      const next = new Set([...current].filter(id => validIds.has(id)))
      newTargetIds.forEach(id => next.add(id))
      return next.size === current.size && [...next].every(id => current.has(id)) ? current : next
    })
    knownTargetVersionIdsRef.current = nextTargetIds
  }, [targetVersionIds, versions])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === roadmapShellRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const overlayOpen = document.querySelector('.ant-modal-wrap, .ant-drawer-open')
        if (!overlayOpen) {
          if (document.fullscreenElement) void document.exitFullscreen()
          else setIsFullscreen(false)
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreen])

  const toggleFullscreen = async () => {
    const shell = roadmapShellRef.current
    if (!shell) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setIsFullscreen(false)
      return
    }
    try {
      await shell.requestFullscreen()
      setIsFullscreen(true)
    } catch {
      setIsFullscreen(current => !current)
    }
  }

  const editingProject = useMemo(
    () => plannedProjects.find(project => project.id === editingPlannedProjectId) ?? null,
    [editingPlannedProjectId, plannedProjects],
  )
  const openCreatePlannedProject = () => {
    setEditingPlannedProjectId(null)
    setPlannedModalOpen(true)
  }
  const openPlannedProjectEditor = (projectId: string) => {
    if (!canEdit || !plannedProjects.some(project => project.id === projectId)) return
    setEditingPlannedProjectId(projectId)
    setPlannedModalOpen(true)
  }
  const closePlannedProjectModal = () => {
    setPlannedModalOpen(false)
    setEditingPlannedProjectId(null)
  }
  const toggleTarget = (versionId: string) => {
    setCollapsedTargetVersionIds(current => {
      const next = new Set(current)
      if (next.has(versionId)) next.delete(versionId)
      else next.add(versionId)
      return next
    })
  }
  const toggleAllTargets = () => {
    setCollapsedTargetVersionIds(allTargetsCollapsed ? new Set() : new Set(targetVersionIds))
  }
  const updateQuickFilter = (
    field: 'brand' | 'productType',
    value: 'all' | 'TECNO' | 'Infinix' | 'itel' | '待定' | '其他品牌' | '新品' | '老品',
  ) => {
    setFilters(setRoadmapQuickFilter(normalizedFilters, field, value))
  }
  const handleViewModeChange = (nextViewMode: RoadmapViewMode) => {
    if (viewMode === 'table' && nextViewMode === 'evolution') {
      setFilters(normalizedFilters.filter(condition => condition.field !== 'firstSaleTosVersionId'))
      setSelectedTosVersionId(null)
    }
    setViewMode(nextViewMode)
  }
  const requestChangeLog = () => {
    if (!canView) return
    if (onOpenChangeLog) onOpenChangeLog()
    else setChangeLogOpen(true)
  }
  const openConflictDrawer = (conflictKey?: string) => {
    const nextKey = conflictKey ?? conflicts[0]?.key ?? null
    setSelectedConflictKey(nextKey)
    setConflictDrawerOpen(Boolean(nextKey))
  }
  const requestDeletePlannedProject = (projectId: string, onDeleted?: () => void) => {
    if (!canEdit) return
    const project = plannedProjects.find(candidate => candidate.id === projectId)
    if (!project) {
      message.error('待规划项目不存在，请刷新后重试')
      return
    }
    Modal.confirm({
      title: '删除待规划项目？',
      content: (
        <>
          <div style={{ marginBottom: 8 }}>项目：{project.displayName}</div>
          <div>删除后，该待规划项目会立即从 tOS 路标中移除；修改记录仍保留删除前快照。确认删除？</div>
        </>
      ),
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const result = deletePlannedProject(project.id, currentLoginUser)
        if (!result.ok) {
          message.error(result.reason === 'not-found' ? '待规划项目不存在，请刷新后重试' : '删除失败，请重试')
          return Promise.reject(new Error('planned-project-delete-failed'))
        }
        message.success('待规划项目已删除，修改记录已保留')
        onDeleted?.()
      },
    })
  }

  if (!canView) {
    return (
      <Result
        status="403"
        title="暂无 tOS 路标查看权限"
        subTitle="请联系管理员开通 tOS 路标查看权限。"
      />
    )
  }

  const renderContext: RoadmapViewRenderContext = {
    rows: filteredRows,
    normalRows,
    plannedRows,
    conflicts,
    versions,
    selectedTosVersionId,
    selectedTosVersionIds,
    columnOrder,
    visibleColumns,
    sort,
    canEdit,
    onViewProject,
    onSelectedTosVersionChange: setSelectedTosVersionId,
    onSortChange: setSort,
    onOpenConflict: openConflictDrawer,
    onEditPlannedProject: openPlannedProjectEditor,
    onDeletePlannedProject: requestDeletePlannedProject,
    collapsedTargetVersionIds,
    onToggleTarget: toggleTarget,
  }

  const content = viewMode === 'table'
    ? renderTableView?.(renderContext) ?? <RoadmapTableView {...renderContext} />
    : renderEvolutionView?.(renderContext) ?? <RoadmapEvolutionView {...renderContext} />

  return (
    <section
      ref={roadmapShellRef}
      className={`pms-roadmap-shell${isFullscreen ? ' pms-roadmap-shell-fullscreen' : ''}`}
      aria-label="tOS 路标视图"
      style={{ width: '100%', minWidth: 0 }}
    >
      <RoadmapToolbar
        canView={canView}
        canEdit={canEdit}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        brandFilter={brandFilter}
        onBrandFilterChange={value => updateQuickFilter('brand', value)}
        productTypeFilter={productTypeFilter}
        onProductTypeFilterChange={value => updateQuickFilter('productType', value)}
        filterCount={configuredFilterCount}
        conflictCount={conflictCount}
        onResolveConflicts={() => openConflictDrawer()}
        hasTargetVersions={targetVersionIds.length > 0}
        allTargetsCollapsed={allTargetsCollapsed}
        onToggleAllTargets={toggleAllTargets}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => void toggleFullscreen()}
        onOpenChangeLog={requestChangeLog}
        onOpenTosMaintenance={() => setTosMaintenanceOpen(true)}
        onCreatePlannedProject={openCreatePlannedProject}
        onOpenFilters={() => setFilterDrawerOpen(true)}
        onOpenColumnSettings={() => setColumnDrawerOpen(true)}
        renderColumnSettings={trigger => (
          <RoadmapColumnSettingsDrawer
            open={columnDrawerOpen}
            trigger={trigger}
            onClose={() => setColumnDrawerOpen(false)}
            viewMode={viewMode}
            value={{ order: [...columnOrder], visible: [...visibleColumns] }}
            onChange={setColumnSettings}
          />
        )}
      />

      {content ?? (
        <div style={{ padding: '48px 16px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={viewMode === 'table' ? '表单视图内容接口已就绪' : '版本演进视图内容接口已就绪'}
          />
        </div>
      )}

      <RoadmapFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        conditions={filters}
        fieldDefinitions={filterFieldDefinitions}
        onApply={setFilters}
      />
      <PlannedProjectModal
        open={plannedModalOpen}
        onCancel={closePlannedProjectModal}
        editingProject={editingProject}
        allRows={allRows}
        tosVersions={versions}
        currentUser={currentLoginUser}
        canEdit={canEdit}
        onDeletePlannedProject={projectId => requestDeletePlannedProject(projectId, closePlannedProjectModal)}
      />
      <TosVersionMaintenanceModal
        open={tosMaintenanceOpen}
        onCancel={() => setTosMaintenanceOpen(false)}
        normalProjects={projects}
        plannedProjects={plannedProjects}
        canEdit={canEdit}
      />
      <RoadmapConflictDrawer
        open={conflictDrawerOpen}
        groups={conflicts}
        tosVersions={versions}
        selectedConflictKey={selectedConflictKey}
        canEdit={canEdit}
        onClose={() => setConflictDrawerOpen(false)}
        onSelectedConflictKeyChange={setSelectedConflictKey}
        onViewProject={projectId => onViewProject(projectId)}
        onDeletePlannedProject={project => requestDeletePlannedProject(project.id)}
      />
      <RoadmapChangeLogDrawer
        open={changeLogOpen}
        onClose={() => setChangeLogOpen(false)}
        changeLogs={changeLogs}
        tosVersions={versions}
      />
    </section>
  )
}
