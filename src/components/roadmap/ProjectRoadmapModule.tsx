'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Card, Empty, Flex, Modal, Result, Skeleton, Space, Typography, message } from 'antd'
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
  deriveRoadmapPlanningConflicts,
} from '@/lib/roadmapProjectAdapter'
import ActiveFilterConditions from '@/components/project-list/ActiveFilterConditions'
import { useHasGlobalPermission } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useRoadmapStore } from '@/stores/roadmap'
import { useEnumStore } from '@/stores/enums'
import { useUiStore } from '@/stores/ui'
import { useTosEnumOptions } from '@/hooks/useTosEnumOptions'
import {
  formatRoadmapTosValue,
  normalizeRoadmapTosReference,
  normalizeRoadmapTosValue,
} from '@/lib/roadmapValidation'
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
import RoadmapProjectDetailsModal from './RoadmapProjectDetailsModal'
import RoadmapTableView from './RoadmapTableView'
import RoadmapToolbar, { RoadmapViewModeSwitch } from './RoadmapToolbar'
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
  onOpenProjectHistory: (projectId: string) => void
  onOpenProjectDetails: (row: RoadmapProjectRow) => void
  onOpenConflict: (conflictKey: string) => void
  onEditPlannedProject: (projectId: string) => void
  onDeletePlannedProject: (projectId: string) => void
  collapsedTargetVersionIds: ReadonlySet<string>
  onToggleTarget: (versionId: string) => void
}

interface ProjectRoadmapModuleProps {
  projects: readonly ProjectItem[]
  onViewProject: (projectId: string, market?: string) => void
  renderTableView?: (context: RoadmapViewRenderContext) => ReactNode
  renderEvolutionView?: (context: RoadmapViewRenderContext) => ReactNode
}

export default function ProjectRoadmapModule({
  projects,
  onViewProject,
  renderTableView,
  renderEvolutionView,
}: ProjectRoadmapModuleProps) {
  const currentLoginUser = useProjectStore(state => state.currentLoginUser)
  const hasPermission = useHasGlobalPermission(currentLoginUser)
  const canView = hasPermission('roadmap:view')
  const canEdit = hasPermission('roadmap:edit')

  const plannedProjects = useRoadmapStore(state => state.plannedProjects)
  const storedVersionDetails = useRoadmapStore(state => state.tosVersions)
  const {
    currentValues: enumTosValues,
    hasHydrated: enumHasHydrated,
    hydrationError: enumHydrationError,
    retryHydration,
  } = useTosEnumOptions('tos-2-part')
  const setSelectedType = useEnumStore(state => state.setSelectedType)
  const setActiveModule = useUiStore(state => state.setActiveModule)
  const setConfigTab = useUiStore(state => state.setConfigTab)
  const navigateWithEditGuard = useUiStore(state => state.navigateWithEditGuard)
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

  const versions = useMemo<TosVersionConfig[]>(() => {
    const currentValues = enumTosValues.map(normalizeRoadmapTosValue).filter(Boolean)
    const historicalReferences = [
      ...plannedProjects.map(project => project.firstSaleTosVersionId),
      ...projects.flatMap(project => [
        project.firstSaleTosVersionId,
        project.firstSaleTosVersion,
        project.currentTosVersionId,
        project.currentTosVersion,
        project.tosVersionName,
        project.tosVersion,
      ]),
      ...storedVersionDetails.flatMap(version => (
        version.targets.length || version.periodStartDate || version.periodEndDate ? [version.id] : []
      )),
      selectedTosVersionId,
      ...getRoadmapSelectedTosVersionIds(filters),
    ].map(value => normalizeRoadmapTosReference(value, storedVersionDetails)).filter(Boolean)
    const allValues = [...new Set([...currentValues, ...historicalReferences])]
    return allValues.map(normalizedValue => {
      const [major, minor] = normalizedValue.split('.').map(Number)
      const existing = storedVersionDetails.find(version => (
        version.major === major && version.minor === minor
      ))
      return {
        id: normalizedValue,
        name: formatRoadmapTosValue(normalizedValue),
        major,
        minor,
        periodStartDate: existing?.periodStartDate ?? '',
        periodEndDate: existing?.periodEndDate ?? '',
        targets: existing?.targets ?? [],
        createdAt: existing?.createdAt ?? '2026-01-01T00:00:00.000Z',
        updatedAt: existing?.updatedAt ?? '2026-01-01T00:00:00.000Z',
        selectable: currentValues.includes(normalizedValue),
      }
    }).sort((left, right) => (
      Number.isFinite(left.major) && Number.isFinite(left.minor)
        && Number.isFinite(right.major) && Number.isFinite(right.minor)
        ? right.major - left.major || right.minor - left.minor
        : left.name.localeCompare(right.name, 'zh-CN')
    ))
  }, [enumTosValues, filters, plannedProjects, projects, selectedTosVersionId, storedVersionDetails])
  const selectableVersions = useMemo(
    () => versions.filter(version => version.selectable !== false),
    [versions],
  )
  const normalizedFilters = useMemo(
    () => sanitizeRoadmapFilterConditions(filters, versions),
    [filters, versions],
  )
  const savedTosFilterValues = useMemo(
    () => getRoadmapSelectedTosVersionIds(normalizedFilters),
    [normalizedFilters],
  )

  const [plannedModalOpen, setPlannedModalOpen] = useState(false)
  const [editingPlannedProjectId, setEditingPlannedProjectId] = useState<string | null>(null)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false)
  const [changeLogOpen, setChangeLogOpen] = useState(false)
  const [detailsProject, setDetailsProject] = useState<RoadmapProjectRow | null>(null)
  const [activeProjectLogId, setActiveProjectLogId] = useState<string | null>(null)
  const [tosMaintenanceOpen, setTosMaintenanceOpen] = useState(false)
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
  const getRoadmapPopupContainer = useCallback((triggerNode: HTMLElement) => {
    const shell = triggerNode.closest<HTMLElement>('[data-roadmap-shell]')
      ?? roadmapShellRef.current
    if (shell?.matches(':fullscreen')) return shell
    return document.body
  }, [])

  const filterFieldDefinitions = useMemo(
    () => buildRoadmapFilterFieldDefinitions(versions, savedTosFilterValues),
    [savedTosFilterValues, versions],
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
  const allRows = useMemo(
    () => [...normalRows, ...plannedRows],
    [normalRows, plannedRows],
  )
  const scopedChangeLogs = useMemo(
    () => activeProjectLogId
      ? changeLogs.filter(log => log.projectId === activeProjectLogId)
      : [],
    [activeProjectLogId, changeLogs],
  )
  const activeProjectLogLabel = useMemo(
    () => allRows.find(row => row.id === activeProjectLogId)?.displayName ?? '',
    [activeProjectLogId, allRows],
  )
  const scopedConflicts = useMemo(
    () => selectedConflictKey
      ? conflicts.filter(conflict => conflict.key === selectedConflictKey)
      : [],
    [conflicts, selectedConflictKey],
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
    if (enumHasHydrated && selectedTosVersionId && !versions.some(version => version.id === selectedTosVersionId)) {
      setSelectedTosVersionId(null)
    }
  }, [enumHasHydrated, selectedTosVersionId, setSelectedTosVersionId, versions])

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
  const openProjectHistory = (projectId: string) => {
    if (!canView) return
    setActiveProjectLogId(projectId)
    setChangeLogOpen(true)
  }
  const openSharedTosEnumConfig = () => {
    navigateWithEditGuard(() => {
      setSelectedType('tos-2-part')
      setConfigTab('enum')
      setActiveModule('config')
    }, false)
  }
  const openConflictDrawer = (conflictKey: string) => {
    if (!conflicts.some(conflict => conflict.key === conflictKey)) return
    setSelectedConflictKey(conflictKey)
    setConflictDrawerOpen(true)
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

  if (!enumHasHydrated) {
    return (
      <Card aria-live="polite" style={{ width: '100%' }}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Text strong>正在加载 tOS 版本配置…</Typography.Text>
          <Skeleton active paragraph={{ rows: 5 }} />
        </Space>
      </Card>
    )
  }

  if (enumHydrationError) {
    return (
      <Alert
        type="error"
        showIcon
        message="加载 tOS 版本配置失败"
        description={(
          <Space orientation="vertical" size={12}>
            <Typography.Text>{enumHydrationError}</Typography.Text>
            <Space wrap>
              <Button type="primary" onClick={() => void retryHydration()}>
                重试加载
              </Button>
              <Button onClick={openSharedTosEnumConfig}>前往枚举配置恢复</Button>
            </Space>
          </Space>
        )}
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
    onOpenProjectHistory: openProjectHistory,
    onOpenProjectDetails: setDetailsProject,
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
      data-roadmap-shell
      className={`pms-roadmap-shell${isFullscreen ? ' pms-roadmap-shell-fullscreen' : ''}`}
      aria-label="tOS 路标视图"
      style={{ width: '100%', minWidth: 0 }}
    >
      <RoadmapViewModeSwitch value={viewMode} onChange={handleViewModeChange} />
      <div className="pms-roadmap-content-panel pms-solid-surface">
      <RoadmapToolbar
        canView={canView}
        canEdit={canEdit}
        viewMode={viewMode}
        brandFilter={brandFilter}
        onBrandFilterChange={value => updateQuickFilter('brand', value)}
        productTypeFilter={productTypeFilter}
        onProductTypeFilterChange={value => updateQuickFilter('productType', value)}
        filterCount={configuredFilterCount}
        hasTargetVersions={targetVersionIds.length > 0}
        allTargetsCollapsed={allTargetsCollapsed}
        onToggleAllTargets={toggleAllTargets}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => void toggleFullscreen()}
        onOpenTosMaintenance={() => setTosMaintenanceOpen(true)}
        onCreatePlannedProject={openCreatePlannedProject}
        onOpenFilters={() => {
          setColumnDrawerOpen(false)
          setFilterDrawerOpen(true)
        }}
        onOpenColumnSettings={() => {
          setFilterDrawerOpen(false)
          setColumnDrawerOpen(true)
        }}
        renderFilters={trigger => (
          <RoadmapFilterDrawer
            open={filterDrawerOpen}
            trigger={trigger}
            getPopupContainer={getRoadmapPopupContainer}
            onClose={() => setFilterDrawerOpen(false)}
            conditions={filters}
            fieldDefinitions={filterFieldDefinitions}
            onApply={setFilters}
          />
        )}
        renderColumnSettings={trigger => (
          <RoadmapColumnSettingsDrawer
            open={columnDrawerOpen}
            trigger={trigger}
            getPopupContainer={getRoadmapPopupContainer}
            onClose={() => setColumnDrawerOpen(false)}
            viewMode={viewMode}
            value={{ order: [...columnOrder], visible: [...visibleColumns] }}
            onChange={setColumnSettings}
          />
        )}
      />

      {normalizedFilters.length ? (
        <Flex className="pms-roadmap-filter-summary-row" align="center" gap={8} wrap={false}>
          <ActiveFilterConditions
            conditions={normalizedFilters}
            definitions={filterFieldDefinitions}
            onEdit={() => {
              setColumnDrawerOpen(false)
              setFilterDrawerOpen(true)
            }}
            onRemove={conditionId => setFilters(
              normalizedFilters.filter(condition => condition.id !== conditionId),
            )}
          />
          <Button className="pms-roadmap-filter-clear" type="text" danger size="small" onClick={() => setFilters([])}>
            清空
          </Button>
        </Flex>
      ) : null}

      {content ?? (
        <div style={{ padding: '48px 16px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={viewMode === 'table' ? '表单视图内容接口已就绪' : '版本演进视图内容接口已就绪'}
          />
        </div>
      )}
      </div>

      <PlannedProjectModal
        open={plannedModalOpen}
        onCancel={closePlannedProjectModal}
        editingProject={editingProject}
        allRows={allRows}
        tosVersions={selectableVersions}
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
        groups={scopedConflicts}
        tosVersions={versions}
        selectedConflictKey={selectedConflictKey}
        canEdit={canEdit}
        onClose={() => {
          setConflictDrawerOpen(false)
          setSelectedConflictKey(null)
        }}
        onSelectedConflictKeyChange={setSelectedConflictKey}
        onViewProject={projectId => onViewProject(projectId)}
        onDeletePlannedProject={project => requestDeletePlannedProject(project.id)}
      />
      <RoadmapChangeLogDrawer
        open={changeLogOpen}
        onClose={() => {
          setChangeLogOpen(false)
          setActiveProjectLogId(null)
        }}
        changeLogs={scopedChangeLogs}
        projectScopeLabel={activeProjectLogLabel}
        tosVersions={versions}
      />
      <RoadmapProjectDetailsModal
        open={detailsProject !== null}
        row={detailsProject}
        versions={versions}
        onClose={() => setDetailsProject(null)}
      />
    </section>
  )
}
