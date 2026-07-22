'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Empty, Result } from 'antd'
import { PRODUCT_LINES_BY_BRAND } from '@/lib/roadmapValidation'
import {
  adaptNormalProject,
  adaptPlannedProject,
  deriveRoadmapPlanningConflicts,
} from '@/lib/roadmapProjectAdapter'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import {
  applyFilterConditions,
  normalizeFilterConditions,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import { useHasGlobalPermission } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useRoadmapStore } from '@/stores/roadmap'
import type { ProjectItem } from '@/types/app'
import type {
  PlannedRoadmapProject,
  RoadmapBrand,
  RoadmapColumnKey,
  RoadmapFilterCondition,
  RoadmapPlanningConflictGroup,
  RoadmapProductType,
  RoadmapProjectRow,
  RoadmapSortState,
  RoadmapViewMode,
  TosVersionConfig,
} from '@/types/roadmap'
import PlannedProjectModal from './PlannedProjectModal'
import RoadmapColumnSettingsDrawer from './RoadmapColumnSettingsDrawer'
import RoadmapFilterDrawer from './RoadmapFilterDrawer'
import RoadmapToolbar from './RoadmapToolbar'
import TosTargetEditor from './TosTargetEditor'
import TosVersionMaintenanceModal from './TosVersionMaintenanceModal'

const isPresent = <T,>(value: T | null): value is T => value !== null

const option = (value: string) => ({ label: value, value })

export function buildRoadmapFilterFieldDefinitions(
  versions: readonly TosVersionConfig[],
): FilterFieldDefinition[] {
  const productLines = [...new Set(Object.values(PRODUCT_LINES_BY_BRAND).flat())]
  return [
    {
      key: 'firstSaleTosVersionId',
      label: 'tOS版本',
      kind: 'enum',
      options: [...versions]
        .sort((left, right) => compareSemanticTos(right, left))
        .map(version => ({ label: version.name, value: version.id })),
    },
    { key: 'brand', label: '品牌', kind: 'enum', options: ['TECNO', 'Infinix', 'itel', '待定', '其他品牌'].map(option) },
    { key: 'productLine', label: '产品线', kind: 'enum', options: productLines.map(option) },
    { key: 'productSeries', label: '产品系列', kind: 'text' },
    { key: 'marketName', label: '市场名', kind: 'text' },
    { key: 'displayName', label: '项目名', kind: 'text' },
    { key: 'productType', label: '产品类型', kind: 'enum', options: ['新品', '老品'].map(option) },
    { key: 'platform', label: '平台', kind: 'text' },
    { key: 'startRam', label: '起步RAM', kind: 'enum', options: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'].map(option) },
    { key: 'versionType', label: '版本类型', kind: 'enum', options: ['Full', 'Slim', 'Go'].map(option) },
    { key: 'str5Date', label: 'STR5时间', kind: 'date' },
    { key: 'launchDate', label: '上市时间', kind: 'date' },
    { key: 'developMode', label: '开发模式', kind: 'enum', options: ['自研', 'ODC', 'ITD-ODC', 'ODM', '纯外研'].map(option) },
    { key: 'remark', label: '备注', kind: 'text' },
  ]
}

export function applyRoadmapFilters(
  rows: readonly RoadmapProjectRow[],
  brandFilter: 'all' | RoadmapBrand,
  productTypeFilter: 'all' | RoadmapProductType,
  filters: readonly RoadmapFilterCondition[],
  fieldDefinitions: readonly FilterFieldDefinition[],
): RoadmapProjectRow[] {
  const quickFilteredRows = rows.filter(row => (
    (brandFilter === 'all' || row.brand === brandFilter)
    && (productTypeFilter === 'all' || row.productType === productTypeFilter)
  ))
  return applyFilterConditions(quickFilteredRows, filters, fieldDefinitions)
}

export interface RoadmapViewRenderContext {
  rows: readonly RoadmapProjectRow[]
  normalRows: readonly RoadmapProjectRow[]
  plannedRows: readonly RoadmapProjectRow[]
  conflicts: readonly RoadmapPlanningConflictGroup[]
  versions: readonly TosVersionConfig[]
  selectedTosVersionId: string | null
  visibleColumns: readonly RoadmapColumnKey[]
  sort: RoadmapSortState
  canEdit: boolean
  onViewProject: (projectId: string, market?: string) => void
  onEditPlannedProject: (projectId: string) => void
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
  const viewMode = useRoadmapStore(state => state.viewMode)
  const selectedTosVersionId = useRoadmapStore(state => state.selectedTosVersionId)
  const brandFilter = useRoadmapStore(state => state.brandFilter)
  const productTypeFilter = useRoadmapStore(state => state.productTypeFilter)
  const filters = useRoadmapStore(state => state.filters)
  const visibleColumns = useRoadmapStore(state => state.visibleColumns)
  const sort = useRoadmapStore(state => state.sort)
  const setViewMode = useRoadmapStore(state => state.setViewMode)
  const setSelectedTosVersionId = useRoadmapStore(state => state.setSelectedTosVersionId)
  const setBrandFilter = useRoadmapStore(state => state.setBrandFilter)
  const setProductTypeFilter = useRoadmapStore(state => state.setProductTypeFilter)
  const setFilters = useRoadmapStore(state => state.setFilters)
  const setVisibleColumns = useRoadmapStore(state => state.setVisibleColumns)

  const [plannedModalOpen, setPlannedModalOpen] = useState(false)
  const [editingPlannedProjectId, setEditingPlannedProjectId] = useState<string | null>(null)
  const [tosMaintenanceOpen, setTosMaintenanceOpen] = useState(false)
  const [targetVersionId, setTargetVersionId] = useState<string | null>(null)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false)
  const [changeLogRequested, setChangeLogRequested] = useState(false)

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
  const allRows = useMemo(
    () => [...normalRows, ...plannedRows],
    [normalRows, plannedRows],
  )

  const normalizedFilters = useMemo(
    () => normalizeFilterConditions(filters, filterFieldDefinitions),
    [filterFieldDefinitions, filters],
  )
  const activeFilterCount = normalizedFilters.length
  const immediateFilters = useMemo(() => normalizedFilters.filter(condition => (
    filterDefinitionsByKey.get(condition.field)?.kind !== 'text'
  )), [filterDefinitionsByKey, normalizedFilters])
  const textFilters = useMemo(() => normalizedFilters.filter(condition => (
    filterDefinitionsByKey.get(condition.field)?.kind === 'text'
  )), [filterDefinitionsByKey, normalizedFilters])
  const [debouncedTextFilters, setDebouncedTextFilters] = useState<RoadmapFilterCondition[]>(textFilters)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTextFilters(textFilters), 150)
    return () => window.clearTimeout(timer)
  }, [textFilters])

  const appliedFilters = useMemo(
    () => normalizeFilterConditions([...immediateFilters, ...debouncedTextFilters], filterFieldDefinitions),
    [debouncedTextFilters, filterFieldDefinitions, immediateFilters],
  )
  const filteredRows = useMemo(
    () => applyRoadmapFilters(allRows, brandFilter, productTypeFilter, appliedFilters, filterFieldDefinitions),
    [allRows, appliedFilters, brandFilter, filterFieldDefinitions, productTypeFilter],
  )

  const editingProject = useMemo(
    () => plannedProjects.find(project => project.id === editingPlannedProjectId) ?? null,
    [editingPlannedProjectId, plannedProjects],
  )
  const targetVersion = useMemo(
    () => versions.find(version => version.id === targetVersionId) ?? null,
    [targetVersionId, versions],
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
  const requestChangeLog = () => {
    if (!canView) return
    if (onOpenChangeLog) onOpenChangeLog()
    else setChangeLogRequested(true)
  }

  if (!canView) {
    return (
      <Result
        status="403"
        title="暂无项目路标查看权限"
        subTitle="请联系管理员开通项目路标查看权限。"
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
    visibleColumns,
    sort,
    canEdit,
    onViewProject,
    onEditPlannedProject: openPlannedProjectEditor,
  }

  const content = viewMode === 'table'
    ? renderTableView?.(renderContext)
    : renderEvolutionView?.(renderContext)

  return (
    <section aria-label="项目路标" style={{ width: '100%', minWidth: 0 }}>
      <RoadmapToolbar
        canView={canView}
        canEdit={canEdit}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        tosVersions={versions}
        selectedTosVersionId={selectedTosVersionId}
        onTosVersionChange={setSelectedTosVersionId}
        brandFilter={brandFilter}
        onBrandFilterChange={setBrandFilter}
        productTypeFilter={productTypeFilter}
        onProductTypeFilterChange={setProductTypeFilter}
        filterCount={activeFilterCount}
        onOpenChangeLog={requestChangeLog}
        onOpenTosMaintenance={() => setTosMaintenanceOpen(true)}
        onCreatePlannedProject={openCreatePlannedProject}
        onOpenFilters={() => setFilterDrawerOpen(true)}
        onOpenColumnSettings={() => setColumnDrawerOpen(true)}
      />

      {content ?? (
        <div style={{ padding: '48px 16px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={viewMode === 'table' ? '表单视图内容接口已就绪' : '版本演进视图内容接口已就绪'}
          />
        </div>
      )}

      <div
        data-roadmap-overlay="change-log-pending"
        data-requested={changeLogRequested ? 'true' : 'false'}
        hidden
      />

      <RoadmapFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        conditions={filters}
        fieldDefinitions={filterFieldDefinitions}
        onApply={setFilters}
        onReset={() => setFilters([])}
      />
      <RoadmapColumnSettingsDrawer
        open={columnDrawerOpen}
        onClose={() => setColumnDrawerOpen(false)}
        visibleColumns={visibleColumns}
        onChange={setVisibleColumns}
      />
      <PlannedProjectModal
        open={plannedModalOpen}
        onCancel={closePlannedProjectModal}
        editingProject={editingProject}
        allRows={allRows}
        tosVersions={versions}
        currentUser={currentLoginUser}
        canEdit={canEdit}
      />
      <TosVersionMaintenanceModal
        open={tosMaintenanceOpen}
        onCancel={() => setTosMaintenanceOpen(false)}
        normalProjects={projects}
        plannedProjects={plannedProjects}
        canEdit={canEdit}
        onEditTargets={version => setTargetVersionId(version.id)}
      />
      <TosTargetEditor
        open={Boolean(targetVersionId)}
        onCancel={() => setTargetVersionId(null)}
        version={targetVersion}
        canEdit={canEdit}
      />
    </section>
  )
}
