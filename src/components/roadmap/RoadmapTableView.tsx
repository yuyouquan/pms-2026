'use client'

import { useEffect, useMemo } from 'react'
import {
  BulbOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  UpOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Button, Empty, Flex, Select, Table, Tag, Typography, type TableProps } from 'antd'
import { compareRoadmapValues, compareSemanticTos } from '@/lib/roadmapSorting'
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
  visibleColumns: readonly RoadmapColumnKey[]
  sort: RoadmapSortState
  canEdit: boolean
  onSelectedTosVersionChange: (id: string | null) => void
  onSortChange: (sort: RoadmapSortState) => void
  onEditTosTargets: (versionId: string) => void
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
  str5Date: 130,
  launchDate: 130,
  developMode: 120,
  remark: 220,
}

export function resolveRoadmapTableVersion(
  versions: readonly TosVersionConfig[],
  selectedTosVersionId: string | null,
): TosVersionConfig | null {
  if (!versions.length) return null
  return versions.find(version => version.id === selectedTosVersionId)
    ?? [...versions].sort((left, right) => compareSemanticTos(right, left))[0]
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
    return versions.find(version => version.id === row.firstSaleTosVersionId)?.name ?? '—'
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
  visibleColumns,
  sort,
  canEdit,
  onSelectedTosVersionChange,
  onSortChange,
  onEditTosTargets,
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

  useEffect(() => {
    const effectiveId = version?.id ?? null
    if (effectiveId !== selectedTosVersionId) onSelectedTosVersionChange(effectiveId)
  }, [onSelectedTosVersionChange, selectedTosVersionId, version?.id])

  const versionRows = useMemo(
    () => version ? rows.filter(row => row.firstSaleTosVersionId === version.id) : [],
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
  const displayNameVisible = visibleColumns.includes('displayName')
  const descendingVersions = useMemo(
    () => [...versions].sort((left, right) => compareSemanticTos(right, left)),
    [versions],
  )
  const targetCollapsed = version ? collapsedTargetVersionIds.has(version.id) : false

  const businessColumns = ROADMAP_COLUMNS
    .filter(column => visibleColumns.includes(column.key))
    .map(column => ({
      title: column.label,
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
        if (column.key !== 'displayName') return formattedValue
        const conflictKey = row.source === 'planned'
          ? conflictKeyByPlannedIdentity.get(`planned:${row.id}`)
          : undefined
        return (
          <Flex vertical gap={4} align="flex-start">
            <Typography.Text strong>{formattedValue}</Typography.Text>
            {row.source === 'planned' ? <Tag color="purple">待规划</Tag> : null}
            {conflictKey ? (
              <Button
                className="roadmap-conflict-link"
                type="link"
                danger
                size="small"
                icon={<WarningOutlined aria-hidden />}
                onClick={() => onOpenConflict(conflictKey)}
                style={{ height: 'auto', minHeight: 28, padding: 0, whiteSpace: 'normal', textAlign: 'start' }}
              >
                已存在正常项目
              </Button>
            ) : null}
          </Flex>
        )
      },
    }))

  const columns: NonNullable<TableProps<RoadmapProjectRow>['columns']> = [
    ...businessColumns,
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: displayNameVisible ? 172 : 230,
      render: (_value, row) => {
        if (row.source !== 'planned') {
          return null
        }
        const conflictKey = conflictKeyByPlannedIdentity.get(`planned:${row.id}`)
        return (
          <Flex vertical gap={6} align="flex-start">
            {!displayNameVisible ? <Tag color="purple">待规划</Tag> : null}
            {!displayNameVisible && conflictKey ? (
              <Button
                className="roadmap-conflict-link"
                type="link"
                danger
                size="small"
                icon={<WarningOutlined aria-hidden />}
                onClick={() => onOpenConflict(conflictKey)}
                style={{ height: 'auto', minHeight: 28, padding: 0, whiteSpace: 'normal', textAlign: 'start' }}
              >
                已存在正常项目
              </Button>
            ) : null}
            {canEdit ? (
              <Flex gap={4} wrap>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined aria-hidden />}
                  onClick={() => onEditPlannedProject(row.id)}
                >
                  编辑
                </Button>
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined aria-hidden />}
                  onClick={() => onDeletePlannedProject(row.id)}
                >
                  删除
                </Button>
              </Flex>
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
      <Flex justify="space-between" align="center" gap={10} style={{ marginBottom: 8 }} wrap>
        <Flex align="center" gap={10} wrap>
          <Select
            aria-label="表单视图 tOS 版本"
            value={version?.id}
            placeholder="选择 tOS 版本"
            options={descendingVersions.map(item => ({ label: item.name, value: item.id }))}
            onChange={onSelectedTosVersionChange}
            disabled={!descendingVersions.length}
            style={{ width: 156 }}
          />
          <Typography.Text type="secondary">共 {versionRows.length} 个项目</Typography.Text>
        </Flex>
        <Flex align="center" gap={6}>
          {version?.targets.length ? (
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
          {version && canEdit ? (
            <Button size="small" icon={<EditOutlined aria-hidden />} onClick={() => onEditTosTargets(version.id)}>
              修改目标
            </Button>
          ) : null}
        </Flex>
      </Flex>

      {version && version.targets.length > 0 && !targetCollapsed ? (
        <section
          className="pms-glass-panel roadmap-target-card"
          data-roadmap-target-card
          aria-label={`${version.name} 目标`}
          style={{
            marginBottom: 16,
            borderColor: 'var(--border-purple)',
            background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.96), rgba(250, 245, 255, 0.92))',
          }}
        >
          <Flex align="flex-start" gap={8}>
            <BulbOutlined aria-hidden style={{ color: 'var(--primary)', marginTop: 3 }} />
            <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {version.targets.join('\n')}
            </Typography.Paragraph>
          </Flex>
        </section>
      ) : null}

      <Table<RoadmapProjectRow>
        className="pms-table roadmap-table"
        aria-label={`${version?.name ?? '当前版本'} 项目表`}
        rowKey={row => `${row.source}:${row.id}`}
        columns={columns}
        dataSource={versionRows}
        onChange={handleTableChange}
        rowClassName={row => (
          row.source === 'planned' && conflictKeyByPlannedIdentity.has(`planned:${row.id}`)
            ? 'roadmap-conflict-row'
            : ''
        )}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前版本下暂无项目" /> }}
        scroll={{ x: 'max-content' }}
        size="middle"
      />

      <style jsx global>{`
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
        .roadmap-table-shell .roadmap-conflict-link:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }
        @media (prefers-reduced-motion: reduce) {
          .roadmap-table-shell .pms-table .ant-table-tbody > tr.roadmap-conflict-row > td {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}
