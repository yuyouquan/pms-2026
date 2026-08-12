'use client'

import { useId, useState } from 'react'
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  MoreOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Button, Flex, Tag, Tooltip, Typography } from 'antd'
import { orderVisibleDefinitions } from '@/lib/columnSettings'
import { getRoadmapSortableColumnDefinitions } from '@/lib/roadmapFilters'
import {
  buildRoadmapDisplayName,
  formatTosVersionDisplay,
  formatTosVersionFull,
} from '@/lib/roadmapValidation'
import {
  type RoadmapColumnKey,
  type RoadmapProjectRow,
  type TosVersionConfig,
} from '@/types/roadmap'

const VERSION_TYPE_TAG_COLORS = {
  Full: 'blue',
  Slim: 'gold',
  Go: 'cyan',
} as const

export interface RoadmapProjectCardProps {
  row: RoadmapProjectRow
  versions: readonly TosVersionConfig[]
  columnOrder: readonly RoadmapColumnKey[]
  visibleColumns: readonly RoadmapColumnKey[]
  conflictKey?: string
  canEdit: boolean
  onOpenProjectHistory: (projectId: string) => void
  onOpenProjectDetails: (row: RoadmapProjectRow) => void
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
    const version = versions.find(candidate => candidate.id === row.firstSaleTosVersionId)
    return version ? formatTosVersionDisplay(version) : '—'
  }
  const value = row[field]
  return typeof value === 'string' && value.trim() ? value : '—'
}

export function formatEvolutionCardTitle(row: RoadmapProjectRow): string {
  const marketName = row.marketName?.trim() || '—'
  const projectName = buildRoadmapDisplayName(row.projectCode, row.androidVersion, row.productType)
  return `${marketName}（${projectName || '—'}）`
}

export default function RoadmapProjectCard({
  row,
  versions,
  columnOrder,
  visibleColumns,
  conflictKey,
  canEdit,
  onOpenProjectHistory,
  onOpenProjectDetails,
  onOpenConflict,
  onEditPlannedProject,
  onDeletePlannedProject,
}: RoadmapProjectCardProps) {
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const actionsId = useId()
  const detailColumns = orderVisibleDefinitions(
    getRoadmapSortableColumnDefinitions('evolution'),
    {
      order: [...columnOrder],
      visible: [...visibleColumns],
    },
  ).filter(column => (
    column.key !== 'marketName'
    && column.key !== 'displayName'
    && column.key !== 'versionType'
    && column.key !== 'productType'
  ))
  const isPlanned = row.source === 'planned'
  const title = formatEvolutionCardTitle(row)

  return (
    <article
      className={`pms-roadmap-evolution-card pms-glass-surface pms-interactive-surface${conflictKey && isPlanned ? ' is-conflict' : ''}`}
      aria-label={`${title}，${isPlanned ? '待规划项目' : '正式项目，只读'}`}
      tabIndex={0}
      onClick={() => onOpenProjectDetails(row)}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpenProjectDetails(row)
      }}
    >
      <Flex className="pms-roadmap-evolution-card-header" justify="space-between" align="center" gap={8} wrap={false}>
        <Typography.Text className="pms-roadmap-evolution-card-title" title={title} strong>
          {title}
        </Typography.Text>
        <Flex className="pms-roadmap-card-header-actions" align="center" gap={4} wrap={false}>
          <Flex className="pms-roadmap-card-header-tags" align="center" gap={4} wrap={false}>
            <Tag color={VERSION_TYPE_TAG_COLORS[row.versionType]}>{row.versionType}</Tag>
            <Tag color={row.productType === '新品' ? 'volcano' : 'default'}>
              {row.productType === '新品' ? 'New' : 'Old'}
            </Tag>
          </Flex>
        </Flex>
      </Flex>

      {detailColumns.length ? (
        <dl className="pms-roadmap-evolution-card-details">
          {detailColumns.map(column => {
            const value = formatRoadmapCardValue(column.key, row, versions)
            const cellVersion = column.key === 'firstSaleTosVersionId'
              ? versions.find(candidate => candidate.id === row.firstSaleTosVersionId)
              : null
            return (
              <div key={column.key} className="pms-roadmap-evolution-card-detail">
                {column.key === 'str5Date' || column.key === 'launchDate' ? <dt>{column.title}</dt> : null}
                <dd title={value}>
                  {cellVersion ? (
                    <Tooltip title={formatTosVersionFull(cellVersion)}>{value}</Tooltip>
                  ) : column.key === 'str5Date' && row.str5Estimated ? (
                    <Flex align="center" gap={6} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                      <span>{value}</span>
                      <Tooltip title="预估时间">
                        <ClockCircleOutlined
                          aria-label="预估时间"
                          style={{ color: '#d48806', fontSize: 12 }}
                        />
                      </Tooltip>
                    </Flex>
                  ) : column.key === 'launchDate' && row.launchEstimated ? (
                    <Flex align="center" gap={6} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                      <span>{value}</span>
                      <Tooltip title="预估时间">
                        <ClockCircleOutlined
                          aria-label="预估时间"
                          style={{ color: '#d48806', fontSize: 12 }}
                        />
                      </Tooltip>
                    </Flex>
                  ) : value}
                </dd>
              </div>
            )
          })}
        </dl>
      ) : null}

      <Flex className="pms-roadmap-evolution-action-trigger-row" justify="flex-end">
        <Tooltip title={actionsExpanded ? '收起操作' : '操作'}>
          <Button
            className="pms-roadmap-evolution-action-toggle"
            type="text"
            size="small"
            icon={<MoreOutlined aria-hidden />}
            aria-label={actionsExpanded ? '收起项目操作' : '展开项目操作'}
            aria-expanded={actionsExpanded}
            aria-controls={actionsId}
            onClick={event => {
              event.stopPropagation()
              setActionsExpanded(expanded => !expanded)
            }}
          />
        </Tooltip>
      </Flex>

      <div
        id={actionsId}
        className={`pms-roadmap-evolution-actions-collapse${actionsExpanded ? ' is-expanded' : ''}`}
        aria-hidden={!actionsExpanded}
      >
        <div className="pms-roadmap-evolution-actions-inner">
          <Flex className="pms-roadmap-evolution-card-actions" gap={4} wrap>
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined aria-hidden />}
              onClick={event => {
                event.stopPropagation()
                setActionsExpanded(false)
                onOpenProjectHistory(row.id)
              }}
            >
              历史
            </Button>
            {conflictKey && isPlanned ? (
              <Button
                type="link"
                danger
                size="small"
                icon={<WarningOutlined aria-hidden />}
                onClick={event => {
                  event.stopPropagation()
                  setActionsExpanded(false)
                  onOpenConflict(conflictKey)
                }}
              >
                冲突
              </Button>
            ) : null}
            {isPlanned && canEdit ? (
              <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined aria-hidden />}
                onClick={event => {
                  event.stopPropagation()
                  setActionsExpanded(false)
                  onEditPlannedProject(row.id)
                }}
              >
                编辑
              </Button>
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined aria-hidden />}
                onClick={event => {
                  event.stopPropagation()
                  setActionsExpanded(false)
                  onDeletePlannedProject(row.id)
                }}
              >
                删除
              </Button>
              </>
            ) : null}
          </Flex>
        </div>
      </div>
    </article>
  )
}
