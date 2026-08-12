'use client'

import { useMemo } from 'react'
import {
  BulbOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  HistoryOutlined,
  UpOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Button, Empty, Flex, Select, Table, Tooltip, Typography, type TableProps } from 'antd'
import { orderVisibleDefinitions } from '@/lib/columnSettings'
import { getRoadmapSortableColumnDefinitions } from '@/lib/roadmapFilters'
import { compareRoadmapValues, compareSemanticTos } from '@/lib/roadmapSorting'
import { formatTosVersionDisplay, formatTosVersionFull } from '@/lib/roadmapValidation'
import {
  ROADMAP_COLUMNS,
  type RoadmapColumnKey,
  type RoadmapPlanningConflictGroup,
  type RoadmapProjectRow,
  type RoadmapSortState,
  type TosVersionConfig,
} from '@/types/roadmap'

interface RoadmapTableViewProps {
  rows: readonly RoadmapProjectRow[]
  conflicts: readonly RoadmapPlanningConflictGroup[]
  versions: readonly TosVersionConfig[]
  selectedTosVersionId: string | null
  columnOrder: readonly RoadmapColumnKey[]
  visibleColumns: readonly RoadmapColumnKey[]
  sort: RoadmapSortState
  canEdit: boolean
  onSelectedTosVersionChange: (id: string | null) => void
  onSortChange: (sort: RoadmapSortState) => void
  onOpenProjectHistory: (projectId: string) => void
  onOpenConflict: (conflictKey: string) => void
  onEditPlannedProject: (projectId: string) => void
  onDeletePlannedProject: (projectId: string) => void
  collapsedTargetVersionIds: ReadonlySet<string>
  onToggleTarget: (versionId: string) => void
}

const COLUMN_WIDTHS: Record<RoadmapColumnKey, number> = {
  firstSaleTosVersionId: 120,
  brand: 100,
  productLine: 120,
  productSeries: 140,
  marketName: 140,
  displayName: 220,
  productType: 100,
  platform: 120,
  startRam: 110,
  versionType: 110,
  str5Date: 176,
  launchDate: 130,
  developMode: 120,
  remark: 220,
}

export function resolveRoadmapTableVersion(
  versions: readonly TosVersionConfig[],
  selectedTosVersionId: string | null,
): TosVersionConfig | null {
  return versions.find(version => version.id === selectedTosVersionId) ?? null
}

export function getRoadmapAriaSort(
  sort: RoadmapSortState,
  field: RoadmapColumnKey,
): 'none' | 'ascending' | 'descending' {
  if (sort.field !== field || !sort.direction) return 'none'
  return sort.direction === 'ascend' ? 'ascending' : 'descending'
}

export function formatRoadmapTableValue(
  field: RoadmapColumnKey,
  row: RoadmapProjectRow,
  versions: readonly TosVersionConfig[],
): string {
  if (field === 'firstSaleTosVersionId') {
    const version = versions.find(candidate => candidate.id === row.firstSaleTosVersionId)
    return version ? formatTosVersionDisplay(version) : '—'
  }
  const value = row[field]
  if (field === 'str5Date' || field === 'launchDate') {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '—'
  }
  return typeof value === 'string' && value.trim() ? value : '—'
}

export default function RoadmapTableView({
  rows,
  conflicts,
  versions,
  selectedTosVersionId,
  columnOrder,
  visibleColumns,
  sort,
  canEdit,
  onSelectedTosVersionChange,
  onSortChange,
  onOpenProjectHistory,
  onOpenConflict,
  onEditPlannedProject,
  onDeletePlannedProject,
  collapsedTargetVersionIds,
  onToggleTarget,
}: RoadmapTableViewProps) {
  const version = useMemo(
    () => resolveRoadmapTableVersion(versions, selectedTosVersionId),
    [selectedTosVersionId, versions],
  )

  const versionRows = useMemo(
    () => version ? rows.filter(row => row.firstSaleTosVersionId === version.id) : rows,
    [rows, version],
  )
  const conflictKeyByPlannedIdentity = useMemo(() => {
    const keys = new Map<string, string>()
    for (const conflict of conflicts) {
      for (const project of conflict.plannedProjects) {
        keys.set(`planned:${project.id}`, conflict.key)
      }
    }
    return keys
  }, [conflicts])
  const descendingVersions = useMemo(
    () => [...versions].sort((left, right) => compareSemanticTos(right, left)),
    [versions],
  )
  const targetCollapsed = version ? collapsedTargetVersionIds.has(version.id) : false

  const orderedDefinitions = orderVisibleDefinitions(
    getRoadmapSortableColumnDefinitions('table'),
    {
      order: [...columnOrder],
      visible: [...visibleColumns],
    },
  )
  const businessColumns = orderedDefinitions
    .map(column => ({
      title: column.title,
      dataIndex: column.key,
      key: column.key,
      width: COLUMN_WIDTHS[column.key],
      fixed: column.key === 'firstSaleTosVersionId' ? 'left' as const : undefined,
      ellipsis: column.key === 'remark' || column.key === 'productSeries',
      sorter: (left: RoadmapProjectRow, right: RoadmapProjectRow) => (
        compareRoadmapValues(column.key, left, right, versions)
      ),
      sortOrder: sort.field === column.key ? sort.direction : null,
      onHeaderCell: () => ({
        'aria-sort': getRoadmapAriaSort(sort, column.key),
      }),
      render: (_value: unknown, row: RoadmapProjectRow) => {
        const formattedValue = formatRoadmapTableValue(column.key, row, versions)
        if (column.key === 'firstSaleTosVersionId') {
          const cellVersion = versions.find(candidate => candidate.id === row.firstSaleTosVersionId)
          return cellVersion ? (
            <Tooltip title={formatTosVersionFull(cellVersion)}>{formattedValue}</Tooltip>
          ) : formattedValue
        }
        if (column.key === 'str5Date' && row.str5Estimated) {
          return (
            <Flex align="center" gap={6} wrap={false} style={{ whiteSpace: 'nowrap' }}>
              <span>{formattedValue}</span>
              <Tooltip title="预估时间">
                <ClockCircleOutlined
                  aria-label="预估时间"
                  style={{ color: '#d48806', fontSize: 12 }}
                />
              </Tooltip>
            </Flex>
          )
        }
        if (column.key === 'launchDate' && row.launchEstimated) {
          return (
            <Flex align="center" gap={6} wrap={false} style={{ whiteSpace: 'nowrap' }}>
              <span>{formattedValue}</span>
              <Tooltip title="预估时间">
                <ClockCircleOutlined
                  aria-label="预估时间"
                  style={{ color: '#d48806', fontSize: 12 }}
                />
              </Tooltip>
            </Flex>
          )
        }
        if (column.key !== 'displayName') return formattedValue
        return (
          <Typography.Text className="roadmap-table-project-name" title={formattedValue} strong>
            {formattedValue}
          </Typography.Text>
        )
      },
    }))

  const columns: NonNullable<TableProps<RoadmapProjectRow>['columns']> = [
    ...businessColumns,
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 136,
      render: (_value, row) => {
        const isPlanned = row.source === 'planned'
        const conflictKey = isPlanned
          ? conflictKeyByPlannedIdentity.get(`planned:${row.id}`)
          : undefined
        return (
          <Flex className="roadmap-table-row-actions" align="center" gap={2} wrap={false}>
            {isPlanned && canEdit ? (
              <Tooltip title="编辑项目">
                <Button
                  type="text"
                  size="small"
                  aria-label={`编辑${row.displayName}`}
                  icon={<EditOutlined aria-hidden />}
                  onClick={() => onEditPlannedProject(row.id)}
                />
              </Tooltip>
            ) : null}
            <Tooltip title="历史记录">
              <Button
                type="text"
                size="small"
                aria-label={`查看${row.displayName}历史记录`}
                icon={<HistoryOutlined aria-hidden />}
                onClick={() => onOpenProjectHistory(row.id)}
              />
            </Tooltip>
            {conflictKey ? (
              <Tooltip title="解决冲突">
                <Button
                  type="text"
                  danger
                  size="small"
                  aria-label={`解决${row.displayName}冲突`}
                  icon={<WarningOutlined aria-hidden />}
                  onClick={() => onOpenConflict(conflictKey)}
                />
              </Tooltip>
            ) : null}
            {isPlanned && canEdit ? (
              <Tooltip title="删除项目">
                <Button
                  type="text"
                  danger
                  size="small"
                  aria-label={`删除${row.displayName}`}
                  icon={<DeleteOutlined aria-hidden />}
                  onClick={() => onDeletePlannedProject(row.id)}
                />
              </Tooltip>
            ) : null}
          </Flex>
        )
      },
    },
  ]

  const handleTableChange: NonNullable<TableProps<RoadmapProjectRow>['onChange']> = (
    _pagination,
    _filters,
    sorter,
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
    const field = ROADMAP_COLUMNS.some(column => column.key === activeSorter?.columnKey)
      ? activeSorter.columnKey as RoadmapColumnKey
      : null
    onSortChange(field && activeSorter?.order
      ? { field, direction: activeSorter.order }
      : { field: null, direction: null })
  }

  return (
    <div className="roadmap-table-shell" style={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <Flex className="roadmap-table-controls pms-toolbar" align="center" gap={10} style={{ marginBottom: 8 }} wrap>
        <Flex align="center" gap={10} wrap>
          <Select
            aria-label="表单视图 tOS 版本"
            value={selectedTosVersionId ?? 'all'}
            placeholder="选择 tOS 版本"
            options={[
              { label: '全部', value: 'all' },
              ...descendingVersions.map(item => ({
                label: (
                  <Tooltip title={formatTosVersionFull(item)}>
                    {formatTosVersionDisplay(item)}
                  </Tooltip>
                ),
                value: item.id,
                disabled: item.selectable === false,
              })),
            ]}
            onChange={selectedId => onSelectedTosVersionChange(selectedId === 'all' ? null : selectedId)}
            style={{ width: 156 }}
          />
          <Typography.Text type="secondary">共 {versionRows.length} 个项目</Typography.Text>
        </Flex>
      </Flex>

      {version ? (
        <section
          className="pms-glass-panel roadmap-target-card pms-glass-surface pms-interactive-surface"
          data-roadmap-target-card
          aria-label={`${formatTosVersionDisplay(version)} 目标`}
          style={{
            marginBottom: 16,
            borderColor: 'var(--pms-brand-border)',
          }}
        >
          <Flex
            className="pms-roadmap-target-card-header"
            justify="space-between"
            align="center"
            gap={8}
            wrap={false}
          >
            <Flex align="center" gap={6} wrap={false} style={{ minWidth: 0 }}>
              <BulbOutlined aria-hidden style={{ color: 'var(--primary)' }} />
              <Tooltip title={formatTosVersionFull(version)}>
                <Typography.Text strong ellipsis>{formatTosVersionDisplay(version)} 版本目标</Typography.Text>
              </Tooltip>
            </Flex>
            <Flex
              className="pms-roadmap-target-card-actions"
              align="center"
              justify="flex-end"
              gap={4}
              wrap={false}
              style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
            >
              {version.targets.length ? (
                <Button
                  size="small"
                  type="text"
                  icon={targetCollapsed ? <DownOutlined /> : <UpOutlined />}
                  aria-expanded={!targetCollapsed}
                  onClick={() => onToggleTarget(version.id)}
                >
                  {targetCollapsed ? '展开版本目标' : '收起版本目标'}
                </Button>
              ) : null}
            </Flex>
          </Flex>
          {version.targets.length > 0 && !targetCollapsed ? (
            <Typography.Paragraph style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
              {version.targets.join('\n')}
            </Typography.Paragraph>
          ) : null}
        </section>
      ) : null}

      <Table<RoadmapProjectRow>
        className="pms-table roadmap-table pms-solid-surface"
        aria-label={`${version ? formatTosVersionDisplay(version) : '全部 tOS'} 项目表`}
        rowKey={row => `${row.source}:${row.id}`}
        columns={columns}
        dataSource={versionRows}
        onChange={handleTableChange}
        rowClassName={row => {
          const classNames = []
          if (row.source === 'planned') classNames.push('roadmap-planned-row')
          if (row.source === 'planned' && conflictKeyByPlannedIdentity.has(`planned:${row.id}`)) {
            classNames.push('roadmap-conflict-row')
          }
          return classNames.join(' ')
        }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={version ? '当前版本下暂无项目' : '暂无项目'}
            />
          ),
        }}
        scroll={{ x: 'max-content' }}
        size="middle"
      />

      <style jsx global>{`
        .roadmap-table-shell .roadmap-table-project-name-row {
          width: 100%;
          min-width: 0;
          flex-wrap: nowrap;
        }
        .roadmap-table-shell .roadmap-table-project-name {
          display: block;
          min-width: 0;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .roadmap-table-shell .roadmap-table .ant-table-thead > tr > th.ant-table-cell-fix-start,
        .roadmap-table-shell .roadmap-table .ant-table-thead > tr > th.ant-table-cell-fix-end {
          position: sticky !important;
          z-index: 4;
          background: #f7f7fd !important;
        }
        .roadmap-table-shell .roadmap-table .ant-table-tbody > tr > td.ant-table-cell-fix-start,
        .roadmap-table-shell .roadmap-table .ant-table-tbody > tr > td.ant-table-cell-fix-end {
          position: sticky !important;
          z-index: 2;
          background: var(--bg-secondary) !important;
        }
        .roadmap-table-shell .roadmap-table .ant-table-tbody > tr:nth-child(even) > td.ant-table-cell-fix-start,
        .roadmap-table-shell .roadmap-table .ant-table-tbody > tr:nth-child(even) > td.ant-table-cell-fix-end {
          background: #fbfbff !important;
        }
        .roadmap-table-shell .roadmap-table .ant-table-tbody > tr:hover > td.ant-table-cell-fix-start,
        .roadmap-table-shell .roadmap-table .ant-table-tbody > tr:hover > td.ant-table-cell-fix-end {
          background: #f5f4ff !important;
        }
        .roadmap-table-shell .roadmap-table-row-actions {
          opacity: 0;
          pointer-events: none;
          transform: translateY(3px);
          transition: opacity 160ms var(--ease-out),
            transform 180ms var(--ease-out);
        }
        .roadmap-table-shell .pms-table .ant-table-tbody > tr:hover .roadmap-table-row-actions,
        .roadmap-table-shell .pms-table .ant-table-tbody > tr:focus-within .roadmap-table-row-actions {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .roadmap-table-shell .roadmap-table-row-actions .ant-btn {
          width: 28px;
          min-width: 28px;
          height: 28px;
          padding: 0;
        }
        .roadmap-table-shell .pms-table .ant-table-tbody > tr.roadmap-conflict-row > td {
          background: color-mix(in srgb, var(--warning-light) 78%, white) !important;
          transition: background-color var(--duration-fast) var(--ease-out);
        }
        .roadmap-table-shell .pms-table .ant-table-tbody > tr.roadmap-conflict-row > td:first-child {
          box-shadow: inset 4px 0 0 var(--warning);
        }
        .roadmap-table-shell .pms-table .ant-table-tbody > tr.roadmap-conflict-row:hover > td {
          background: var(--warning-light) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .roadmap-table-shell .pms-table .ant-table-tbody > tr.roadmap-conflict-row > td,
          .roadmap-table-shell .roadmap-table-row-actions {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}
