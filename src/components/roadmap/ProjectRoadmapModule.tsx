'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Card, Empty, Flex, Modal, Result, Skeleton, Space, Typography, message } from 'antd'
import {
  applyRoadmapFilters,
  createRoadmapTextFilterDebouncer,
  getRoadmapQuickFilterValue,
  getRoadmapSelectedTosVersionIds,
  sanitizeRoadmapFilterConditions,
  setRoadmapQuickFilter,
  type RoadmapTextFilterDebouncer,
} from '@/lib/roadmapFilters'
import {
  adaptNormalProject,
  projectRegistryToPlanned,
  adaptRegistryRoadmapProject,
  deriveRoadmapPlanningConflicts,
} from '@/lib/roadmapProjectAdapter'
import ActiveFilterConditions from '@/components/project-list/ActiveFilterConditions'
import { hasMenuPermission, useMenuPermission, usePermissionStore } from '@/stores/permission'
import { evaluateWholeMenuPermission, getAuthorizedColumns } from '@/lib/permissionCenter'
import { buildAuthorizedRoadmapFilterDefinitions, buildRoadmapPermissionExport, projectRoadmapRows, scopeRoadmapVersions } from '@/lib/roadmapPermission'
import type { PermissionAction } from '@/types/permissionCenter'
import { useProjectStore } from '@/stores/project'
import { useRoadmapStore } from '@/stores/roadmap'
import { useEnumStore } from '@/stores/enums'
import { orderProjectEnumOptions } from '@/lib/enumConsumers'
import { useUiStore } from '@/stores/ui'
import { useEnumHydration, useSingleEnumOptions } from '@/hooks/useEnumOptions'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import {
  formatRoadmapTosValue,
  normalizeRoadmapTosReference,
  normalizeRoadmapTosValue,
  normalizeTosVersionName,
} from '@/lib/roadmapValidation'
import type { ProjectItem } from '@/types/app'
import type {
  RoadmapColumnKey,
  RoadmapFilterCondition,
  RoadmapPlanningConflictGroup,
  RoadmapProjectRow,
  RoadmapSortState,
  RoadmapViewMode,
  TosVersionConfig,
} from '@/types/roadmap'
import { deleteConfiguredProject } from '@/lib/projectRegistry'
import { canUseProjectRegistry } from '@/lib/projectRegistryAuthorization'
import { getProjectAttribute, isFormalProject } from '@/types/projectRegistry'
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

const ROADMAP_EXPORT_COLUMNS: Record<RoadmapColumnKey, ExportColumn> = {
  firstSaleTosVersionId: { key: 'firstSaleTosVersionId', title: 'tOS版本' },
  brand: { key: 'brand', title: '品牌' },
  productLine: { key: 'productLine', title: '产品线' },
  productSeries: { key: 'productSeries', title: '产品系列' },
  marketName: { key: 'marketName', title: '市场名' },
  displayName: { key: 'displayName', title: '项目名' },
  productType: { key: 'productType', title: '产品类型' },
  chipCode: { key: 'chipCode', title: '芯片编码' },
  startRam: { key: 'startRam', title: '起步RAM' },
  versionType: { key: 'versionType', title: '版本类型' },
  str5Date: { key: 'str5Date', title: 'STR5时间' },
  launchDate: { key: 'launchDate', title: '上市时间' },
  developMode: { key: 'developMode', title: '开发模式' },
  remark: { key: 'remark', title: '备注' },
}

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
  canEditRow: (row: RoadmapProjectRow) => boolean
  canDeleteRow: (row: RoadmapProjectRow) => boolean
  canViewHistory: boolean
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
  projects: allProjects,
  onViewProject,
  renderTableView,
  renderEvolutionView,
}: ProjectRoadmapModuleProps) {
  const projects = useMemo(() => allProjects.filter(project => getProjectAttribute(project) !== 'budget'), [allProjects])
  const currentLoginUser = useProjectStore(state => state.currentLoginUser)
  const permissionModel = usePermissionStore(state => state.permissionCenter)
  const viewMode = useRoadmapStore(state => state.viewMode)
  const menuId = viewMode === 'table' ? 'roadmap.table' : 'roadmap.evolution'
  const permission = useMenuPermission(currentLoginUser, menuId)
  const tablePermission = useMenuPermission(currentLoginUser, 'roadmap.table')
  const evolutionPermission = useMenuPermission(currentLoginUser, 'roadmap.evolution')
  const allowedModes: RoadmapViewMode[] = [...(tablePermission.can('view') ? ['table' as const] : []), ...(evolutionPermission.can('view') ? ['evolution' as const] : [])]
  const canView = permission.can('view')
  const canEdit = permission.can('edit')
  const canMaintainVersions = evaluateWholeMenuPermission(permissionModel, currentLoginUser, menuId, 'edit')
  const canViewHistory = evaluateWholeMenuPermission(permissionModel, currentLoginUser, menuId, 'view')
  const permittedColumns = permission.columns()

  const plannedProjects = useMemo(() => projects.filter(project => getProjectAttribute(project) === 'roadmap').map(projectRegistryToPlanned), [projects])
  const storedVersionDetails = useRoadmapStore(state => state.tosVersions)
  const enumTosOptions = useSingleEnumOptions('roadmap-tos', undefined, true, 'filter')
  const enumRowsByType = useEnumStore(state => state.rowsByType)
  const {
    hasHydrated: enumHasHydrated,
    hydrationError: enumHydrationError,
    retryHydration,
  } = useEnumHydration()
  const setSelectedType = useEnumStore(state => state.setSelectedType)
  const setActiveModule = useUiStore(state => state.setActiveModule)
  const setConfigTab = useUiStore(state => state.setConfigTab)
  const navigateWithEditGuard = useUiStore(state => state.navigateWithEditGuard)
  const changeLogs = useRoadmapStore(state => state.changeLogs)
  const selectedTosVersionId = useRoadmapStore(state => state.selectedTosVersionId)
  const filters = useRoadmapStore(state => state.filters)
  const columnOrder = useRoadmapStore(state => state.columnOrder)
  const personalVisibleColumns = useRoadmapStore(state => state.visibleColumns)
  const visibleColumns = personalVisibleColumns.filter(key => permittedColumns.includes(key))
  const sort = useRoadmapStore(state => state.sort)
  const selectedConflictKey = useRoadmapStore(state => state.selectedConflictKey)
  const setViewMode = useRoadmapStore(state => state.setViewMode)
  const setSelectedTosVersionId = useRoadmapStore(state => state.setSelectedTosVersionId)
  const setFilters = useRoadmapStore(state => state.setFilters)
  const setColumnSettings = useRoadmapStore(state => state.setColumnSettings)
  const setSort = useRoadmapStore(state => state.setSort)
  const setSelectedConflictKey = useRoadmapStore(state => state.setSelectedConflictKey)
  const roadmapHydrationStartedRef = useRef(false)

  useEffect(() => {
    if (!enumHasHydrated || enumHydrationError || roadmapHydrationStartedRef.current) return
    roadmapHydrationStartedRef.current = true
    void useRoadmapStore.persist.rehydrate()
  }, [enumHasHydrated, enumHydrationError])

  const sourceVersions = useMemo<TosVersionConfig[]>(() => {
    const currentValues = enumTosOptions.map(option => normalizeRoadmapTosValue(option.value)).filter(Boolean)
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
      ...storedVersionDetails.map(version => version.id),
      selectedTosVersionId,
      ...getRoadmapSelectedTosVersionIds(filters),
    ].map(value => normalizeRoadmapTosReference(value, storedVersionDetails)).filter(Boolean)
    const allValues = [...new Set([...currentValues, ...historicalReferences])]
    return allValues.map(normalizedValue => {
      const parsed = normalizeTosVersionName(normalizedValue)
      const existing = storedVersionDetails.find(version => version.id === normalizedValue)
      return {
        id: normalizedValue,
        name: formatRoadmapTosValue(normalizedValue),
        major: parsed?.major ?? null,
        minor: parsed?.minor ?? null,
        periodStartDate: existing?.periodStartDate ?? '',
        periodEndDate: existing?.periodEndDate ?? '',
        targets: existing?.targets ?? [],
        createdAt: existing?.createdAt ?? '2026-01-01T00:00:00.000Z',
        updatedAt: existing?.updatedAt ?? '2026-01-01T00:00:00.000Z',
        selectable: currentValues.includes(normalizedValue),
      }
    })
  }, [enumTosOptions, filters, plannedProjects, projects, selectedTosVersionId, storedVersionDetails])
  const sourceNormalRows = useMemo(
    () => projects.map(project => adaptNormalProject(project, sourceVersions)).filter(isPresent),
    [projects, sourceVersions],
  )
  const sourcePlannedRows = useMemo(
    () => projects.map(project => adaptRegistryRoadmapProject(project)).filter(isPresent),
    [projects],
  )
  const sourceRows = useMemo(() => [...sourceNormalRows, ...sourcePlannedRows], [sourceNormalRows, sourcePlannedRows])
  const normalRows = useMemo(() => projectRoadmapRows(permissionModel, currentLoginUser, menuId, 'view', sourceNormalRows), [permissionModel, currentLoginUser, menuId, sourceNormalRows])
  const plannedRows = useMemo(() => projectRoadmapRows(permissionModel, currentLoginUser, menuId, 'view', sourcePlannedRows), [permissionModel, currentLoginUser, menuId, sourcePlannedRows])
  const allRows = useMemo(() => [...normalRows, ...plannedRows], [normalRows, plannedRows])
  const versions = useMemo(() => canViewHistory ? sourceVersions : scopeRoadmapVersions(sourceVersions, allRows), [canViewHistory, sourceVersions, allRows])
  const maintainedVersions = useMemo(() => {
    const maintainedIds = new Set(storedVersionDetails.map(version => normalizeRoadmapTosValue(version.id)))
    return versions.filter(version => maintainedIds.has(version.id))
  }, [storedVersionDetails, versions])
  const normalizedFilters = useMemo(
    () => sanitizeRoadmapFilterConditions(filters, versions).filter(condition => permittedColumns.includes(condition.field)),
    [filters, versions, permittedColumns.join('|')],
  )

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false)
  const [changeLogOpen, setChangeLogOpen] = useState(false)
  const pendingDeleteConfirmRef = useRef<ReturnType<typeof Modal.confirm> | null>(null)
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
    () => buildAuthorizedRoadmapFilterDefinitions(allRows, versions, permittedColumns).map(field => field.options
      ? { ...field, options: orderProjectEnumOptions(enumRowsByType, '整机产品项目', field.key, field.options) }
      : field),
    [allRows, versions, permittedColumns.join('|'), enumRowsByType],
  )
  const filterDefinitionsByKey = useMemo(
    () => new Map(filterFieldDefinitions.map(definition => [definition.key, definition])),
    [filterFieldDefinitions],
  )
  const conflicts = useMemo(
    () => deriveRoadmapPlanningConflicts(
      normalRows.filter(row => row.projectCode && row.androidVersion && row.productType),
      plannedRows.filter(row => row.projectCode && row.androidVersion && row.productType),
    ),
    [normalRows, plannedRows],
  )
  const scopedChangeLogs = useMemo(
    () => canViewHistory && activeProjectLogId && allRows.some(row => row.id === activeProjectLogId)
      ? changeLogs.filter(log => log.projectId === activeProjectLogId)
      : [],
    [activeProjectLogId, allRows, canViewHistory, changeLogs],
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

  const authorizedDetails = detailsProject ? allRows.find(row => row.id === detailsProject.id) ?? null : null
  const detailsColumns = detailsProject
    ? getAuthorizedColumns(permissionModel, currentLoginUser, menuId, 'view', sourceRows.find(row => row.id === detailsProject.id) as unknown as Record<string, unknown> | undefined)
    : []
  useEffect(() => {
    if (!canView && allowedModes.length) setViewMode(allowedModes[0])
    pendingDeleteConfirmRef.current?.destroy()
    pendingDeleteConfirmRef.current = null
    setDetailsProject(null)
    setChangeLogOpen(false)
    setActiveProjectLogId(null)
    setConflictDrawerOpen(false)
    setTosMaintenanceOpen(false)
    setFilterDrawerOpen(false)
    setColumnDrawerOpen(false)
  }, [currentLoginUser, permissionModel, menuId, canView, allowedModes.join('|'), setViewMode])

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

  const currentRow = (projectId: string) => {
    const project = useProjectStore.getState().projects.find(candidate => candidate.id === projectId)
    return project ? adaptRegistryRoadmapProject(project) ?? adaptNormalProject(project, sourceVersions) : null
  }
  const canActOnRow = (projectId: string, action: PermissionAction) => {
    const row = currentRow(projectId)
    return !!row && useRoadmapStore.getState().viewMode === viewMode
      && hasMenuPermission(useProjectStore.getState().currentLoginUser, menuId, action, row as unknown as Record<string, unknown>)
  }
  const canUseRegistryRow = (projectId: string, action: PermissionAction) => {
    const project = useProjectStore.getState().projects.find(candidate => candidate.id === projectId)
    return !!project && canUseProjectRegistry(useProjectStore.getState().currentLoginUser, action, project)
  }
  const canEditRow = (row: RoadmapProjectRow) => sourcePlannedRows.some(source => source.id === row.id)
    && canUseRegistryRow(row.id, 'edit') && permission.can('edit', sourceRows.find(source => source.id === row.id) as unknown as Record<string, unknown>)
  const canDeleteRow = (row: RoadmapProjectRow) => sourcePlannedRows.some(source => source.id === row.id)
    && canUseRegistryRow(row.id, 'delete') && permission.can('delete', sourceRows.find(source => source.id === row.id) as unknown as Record<string, unknown>)
  const canActOnCollection = (action: PermissionAction) => useRoadmapStore.getState().viewMode === viewMode
    && evaluateWholeMenuPermission(usePermissionStore.getState().permissionCenter, useProjectStore.getState().currentLoginUser, menuId, action)
  const openCreatePlannedProject = () => {
    const actor = useProjectStore.getState().currentLoginUser
    if (!hasMenuPermission(actor, menuId, 'create') || !canUseProjectRegistry(actor, 'create')) return
    navigateWithEditGuard(() => useUiStore.getState().openProjectConfiguration(), false)
  }
  const guardedViewProject = (projectId: string, market?: string) => {
    if (canActOnRow(projectId, 'view')) onViewProject(projectId, market)
  }
  const openPlannedProjectEditor = (projectId: string) => {
    if (canActOnRow(projectId, 'edit') && canUseRegistryRow(projectId, 'edit')) onViewProject(projectId)
  }
  const openProjectDetails = (row: RoadmapProjectRow) => {
    if (canActOnRow(row.id, 'view')) setDetailsProject(row)
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
    value: 'all' | '示例品牌A' | '示例品牌B' | '示例品牌C' | '待定' | '其他品牌' | '新品' | '老品',
  ) => {
    setFilters(setRoadmapQuickFilter(normalizedFilters, field, value))
  }
  const handleViewModeChange = (nextViewMode: RoadmapViewMode) => {
    if (!hasMenuPermission(useProjectStore.getState().currentLoginUser, nextViewMode === 'table' ? 'roadmap.table' : 'roadmap.evolution', 'view')) return
    if (viewMode === 'table' && nextViewMode === 'evolution') {
      setFilters(normalizedFilters.filter(condition => condition.field !== 'firstSaleTosVersionId'))
      setSelectedTosVersionId(null)
    }
    setViewMode(nextViewMode)
  }
  const openProjectHistory = (projectId: string) => {
    if (!canActOnCollection('view') || !canActOnRow(projectId, 'view')) return
    setActiveProjectLogId(projectId)
    setChangeLogOpen(true)
  }
  const openSharedTosEnumConfig = () => {
    if (!hasMenuPermission(useProjectStore.getState().currentLoginUser, 'config.enum:roadmap-tos', 'view')) return
    navigateWithEditGuard(() => {
      setSelectedType('roadmap-tos')
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
    if (!canActOnRow(projectId, 'delete') || !canUseRegistryRow(projectId, 'delete')) return
    const project = plannedRows.find(candidate => candidate.id === projectId)
    if (!project) {
      message.error('待规划项目不存在，请刷新后重试')
      return
    }
    pendingDeleteConfirmRef.current = Modal.confirm({
      centered: true,
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
        if (!canActOnRow(project.id, 'delete') || !canUseRegistryRow(projectId, 'delete')) return Promise.reject(new Error('roadmap-permission-revoked'))
        const result = deleteConfiguredProject(project.id, useProjectStore.getState().currentLoginUser)
        if (!result.ok) {
          message.error(result.message)
          return Promise.reject(new Error('planned-project-delete-failed'))
        }
        message.success('待规划项目已删除，修改记录已保留')
        onDeleted?.()
      },
    })
  }
  const handleExport = () => {
    const user = useProjectStore.getState().currentLoginUser
    const model = usePermissionStore.getState().permissionCenter
    if (useRoadmapStore.getState().viewMode !== viewMode || !hasMenuPermission(user, menuId, 'export')) return
    const liveRows = useProjectStore.getState().projects.flatMap(project => {
      const row = adaptRegistryRoadmapProject(project) ?? adaptNormalProject(project, sourceVersions)
      return row ? [row] : []
    })
    const result = buildRoadmapPermissionExport(model, user, menuId, liveRows, sourceVersions, appliedFilters, columnOrder, personalVisibleColumns, viewMode === 'table' ? selectedTosVersionId : null)
    if (!result.columns.length) return
    const exportRows = result.rows.map(row => ({
      ...row,
      firstSaleTosVersionId: row.firstSaleTosVersionId ? formatRoadmapTosValue(row.firstSaleTosVersionId) : '',
    }))
    exportSheet(exportRows, result.columns.map(key => ROADMAP_EXPORT_COLUMNS[key]), `tOS路标_${exportTimestamp()}.xlsx`, 'tOS路标')
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
    canEditRow,
    canDeleteRow,
    canViewHistory,
    onViewProject: guardedViewProject,
    onSelectedTosVersionChange: setSelectedTosVersionId,
    onSortChange: setSort,
    onOpenProjectHistory: openProjectHistory,
    onOpenProjectDetails: openProjectDetails,
    onOpenConflict: openConflictDrawer,
    onEditPlannedProject: openPlannedProjectEditor,
    onDeletePlannedProject: requestDeletePlannedProject,
    collapsedTargetVersionIds,
    onToggleTarget: toggleTarget,
  }
  const evolutionRenderContext: RoadmapViewRenderContext = {
    ...renderContext,
    rows: filteredRows,
    versions: maintainedVersions,
  }

  const content = viewMode === 'table'
    ? renderTableView?.(renderContext) ?? <RoadmapTableView {...renderContext} />
    : renderEvolutionView?.(evolutionRenderContext) ?? <RoadmapEvolutionView {...evolutionRenderContext} />

  return (
    <section
      ref={roadmapShellRef}
      data-roadmap-shell
      className={`pms-roadmap-shell${isFullscreen ? ' pms-roadmap-shell-fullscreen' : ''}`}
      aria-label="tOS 路标视图"
      style={{ width: '100%', minWidth: 0 }}
    >
      <RoadmapViewModeSwitch value={viewMode} allowedModes={allowedModes} onChange={handleViewModeChange} />
      <div className="pms-roadmap-content-panel pms-solid-surface">
      <RoadmapToolbar
        canView={canView}
        canEdit={canMaintainVersions}
        canCreate={permission.can('create') && canUseProjectRegistry(currentLoginUser, 'create')}
        canExport={permission.can('export')}
        allowedBrands={allRows.map(row => row.brand).filter(Boolean)}
        allowedProductTypes={allRows.map(row => row.productType).filter(Boolean)}
        viewMode={viewMode}
        versions={maintainedVersions}
        selectedTosVersionId={selectedTosVersionId}
        onSelectedTosVersionChange={setSelectedTosVersionId}
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
        onOpenTosMaintenance={() => { if (canActOnCollection('edit')) setTosMaintenanceOpen(true) }}
        onCreatePlannedProject={openCreatePlannedProject}
        onExport={handleExport}
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
            conditions={normalizedFilters}
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
            allowedColumns={permittedColumns}
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

      <TosVersionMaintenanceModal
        open={tosMaintenanceOpen && canMaintainVersions}
        onCancel={() => setTosMaintenanceOpen(false)}
        normalProjects={projects.filter(isFormalProject)}
        plannedProjects={plannedProjects}
        canEdit={canMaintainVersions}
        canMutate={() => canActOnCollection('edit')}
      />
      <RoadmapConflictDrawer
        open={conflictDrawerOpen}
        groups={scopedConflicts}
        tosVersions={versions}
        selectedConflictKey={selectedConflictKey}
        canEdit={canEdit}
        canDeleteRow={canDeleteRow}
        onClose={() => {
          setConflictDrawerOpen(false)
          setSelectedConflictKey(null)
        }}
        onSelectedConflictKeyChange={setSelectedConflictKey}
        onViewProject={projectId => guardedViewProject(projectId)}
        onDeletePlannedProject={project => requestDeletePlannedProject(project.id)}
      />
      <RoadmapChangeLogDrawer
        open={changeLogOpen && canViewHistory}
        onClose={() => {
          setChangeLogOpen(false)
          setActiveProjectLogId(null)
        }}
        changeLogs={scopedChangeLogs}
        projectScopeLabel={activeProjectLogLabel}
        tosVersions={versions}
      />
      <RoadmapProjectDetailsModal
        open={authorizedDetails !== null}
        row={authorizedDetails}
        allowedColumns={detailsColumns}
        versions={versions}
        onClose={() => setDetailsProject(null)}
      />
    </section>
  )
}
