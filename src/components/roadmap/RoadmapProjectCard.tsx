'use client'

import { DeleteOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Flex, Tag, Typography } from 'antd'
import {
  ROADMAP_COLUMNS,
  type RoadmapColumnKey,
  type RoadmapProjectRow,
  type TosVersionConfig,
} from '@/types/roadmap'

export interface RoadmapProjectCardProps {
  row: RoadmapProjectRow
  versions: readonly TosVersionConfig[]
  visibleColumns: readonly RoadmapColumnKey[]
  conflictKey?: string
  canEdit: boolean
  onOpenConflict: (conflictKey: string) => void
  onEditPlannedProject: (projectId: string) => void
  onDeletePlannedProject: (projectId: string) => void
}

export function formatRoadmapCardValue(
  field: RoadmapColumnKey,
  row: RoadmapProjectRow,
  versions: readonly TosVersionConfig[],
): string {
  if (field === 'firstSaleTosVersionId') {
    return versions.find(version => version.id === row.firstSaleTosVersionId)?.name ?? '—'
  }
  const value = row[field]
  return typeof value === 'string' && value.trim() ? value : '—'
}

export default function RoadmapProjectCard({
  row,
  versions,
  visibleColumns,
  conflictKey,
  canEdit,
  onOpenConflict,
  onEditPlannedProject,
  onDeletePlannedProject,
}: RoadmapProjectCardProps) {
  const detailColumns = ROADMAP_COLUMNS.filter(column => (
    column.key !== 'displayName' && visibleColumns.includes(column.key)
  ))
  const isPlanned = row.source === 'planned'

  return (
    <article
      className={`pms-roadmap-evolution-card${conflictKey && isPlanned ? ' is-conflict' : ''}`}
      aria-label={`${row.displayName}，${isPlanned ? '待规划项目' : '正常项目，只读'}`}
    >
      <Flex justify="space-between" align="flex-start" gap={8}>
        <div style={{ minWidth: 0 }}>
          <Typography.Text className="pms-roadmap-evolution-card-title" strong>
            {row.displayName}
          </Typography.Text>
          {row.projectCode !== row.displayName ? (
            <Typography.Text className="pms-roadmap-evolution-card-code" type="secondary">
              {row.projectCode}
            </Typography.Text>
          ) : null}
        </div>
        <Tag className="pms-roadmap-evolution-source-tag" color={isPlanned ? 'purple' : 'blue'}>
          {isPlanned ? '待规划项目' : '正常项目 · 只读'}
        </Tag>
      </Flex>

      {detailColumns.length ? (
        <dl className="pms-roadmap-evolution-card-details">
          {detailColumns.map(column => (
            <div key={column.key} className="pms-roadmap-evolution-card-detail">
              <dt>{column.label}</dt>
              <dd title={formatRoadmapCardValue(column.key, row, versions)}>
                {formatRoadmapCardValue(column.key, row, versions)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {conflictKey && isPlanned ? (
        <Button
          className="pms-roadmap-evolution-conflict-action"
          type="link"
          danger
          icon={<WarningOutlined aria-hidden />}
          onClick={() => onOpenConflict(conflictKey)}
        >
          已存在正常项目，查看冲突
        </Button>
      ) : null}

      {isPlanned && canEdit ? (
        <Flex className="pms-roadmap-evolution-card-actions" gap={4} wrap>
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
    </article>
  )
}
