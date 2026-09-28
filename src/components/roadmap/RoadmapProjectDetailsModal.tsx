'use client'

import { ClockCircleOutlined } from '@ant-design/icons'
import { Flex, Modal, Tag, Tooltip, Typography } from 'antd'
import { formatTosVersionDisplay } from '@/lib/roadmapValidation'
import type { RoadmapProjectRow, TosVersionConfig } from '@/types/roadmap'
import { formatMarketName } from '@/lib/marketNameDisplay'

const VERSION_TYPE_TAG_COLORS = {
  Full: 'blue',
  Slim: 'gold',
  Go: 'cyan',
} as const

interface RoadmapProjectDetailsModalProps {
  open: boolean
  row: RoadmapProjectRow | null
  allowedColumns?: readonly string[]
  versions: readonly TosVersionConfig[]
  onClose: () => void
}

function EstimatedDate({ value, estimated }: { value: string; estimated: boolean }) {
  return (
    <Flex align="center" gap={5} wrap={false}>
      <span>{value || '—'}</span>
      {estimated ? (
        <Tooltip title="预估时间">
          <ClockCircleOutlined aria-label="预估时间" className="pms-roadmap-detail-estimated-icon" />
        </Tooltip>
      ) : null}
    </Flex>
  )
}

export default function RoadmapProjectDetailsModal({
  open,
  row,
  allowedColumns,
  versions,
  onClose,
}: RoadmapProjectDetailsModalProps) {
  const version = row ? versions.find(candidate => candidate.id === row.firstSaleTosVersionId) : null
  const title = row
    ? `${formatMarketName(row.marketName, row.brand) || '—'}（${row.displayName || '—'}）`
    : ''
  const details = row ? [
    ['firstSaleTosVersionId', 'tOS版本', version ? formatTosVersionDisplay(version) : '—'],
    ['brand', '品牌', row.brand],
    ['productLine', '产品线', row.productLine],
    ['productSeries', '产品系列', row.productSeries],
    ['marketName', '市场名', formatMarketName(row.marketName, row.brand)],
    ['displayName', '项目名', row.displayName],
    ['productType', '产品类型', row.productType],
    ['chipCode', '芯片编码', row.chipCode],
    ['startRam', '起步RAM', row.startRam],
    ['versionType', '版本类型', row.versionType],
    ['str5Date', 'STR5时间', <EstimatedDate key="str5" value={row.str5Date} estimated={row.str5Estimated} />],
    ['launchDate', '上市时间', <EstimatedDate key="launch" value={row.launchDate} estimated={row.launchEstimated} />],
    ['developMode', '开发模式', row.developMode],
    ['remark', '备注', row.remark || '—'],
  ].filter(([key]) => !allowedColumns || allowedColumns.includes(String(key))) : []
  // Extra legacy detail fields only exist on an unrestricted projection.
  if (row?.machineProjectType) details.splice(1, 0, ['machineProjectType', '项目二级分类', row.machineProjectType])
  if (row?.androidVersion) details.splice(1, 0, ['androidVersion', '安卓版本', row.androidVersion])
  if (row?.projectCode) details.splice(1, 0, ['projectCode', '项目编码', row.projectCode])
  if (row?.status) details.push(['status', '项目状态', row.status])


  return (
    <Modal
      open={open}
      title="项目详情"
      width={680}
      footer={null}
      centered
      destroyOnHidden
      onCancel={onClose}
      className="pms-roadmap-project-detail-modal"
    >
      {row ? (
        <div className="pms-roadmap-project-detail-body pms-solid-surface">
          <Flex className="pms-roadmap-project-detail-heading" align="center" gap={8} wrap>
            <Typography.Text strong>{title}</Typography.Text>
            {row.versionType ? <Tag color={VERSION_TYPE_TAG_COLORS[row.versionType as keyof typeof VERSION_TYPE_TAG_COLORS] ?? 'default'}>
              {row.versionType}
            </Tag> : null}
            {row.productType ? <Tag color={row.productType === '新品' ? 'volcano' : 'default'}>
              {row.productType === '新品' ? 'New' : 'Old'}
            </Tag> : null}
            {row.source ? <Tag color={row.source === 'planned' ? 'purple' : 'default'}>
              {row.source === 'planned' ? '待规划项目' : '正式项目'}
            </Tag> : null}
          </Flex>
          <dl className="pms-roadmap-project-detail-grid">
            {details.map(([key, label, value]) => (
              <div key={String(key)} className={label === '备注' ? 'is-wide' : undefined}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </Modal>
  )
}
