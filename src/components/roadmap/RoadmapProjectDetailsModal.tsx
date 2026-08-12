'use client'

import { ClockCircleOutlined } from '@ant-design/icons'
import { Flex, Modal, Tag, Tooltip, Typography } from 'antd'
import { buildRoadmapDisplayName, formatTosVersionDisplay } from '@/lib/roadmapValidation'
import type { RoadmapProjectRow, TosVersionConfig } from '@/types/roadmap'

const VERSION_TYPE_TAG_COLORS = {
  Full: 'blue',
  Slim: 'gold',
  Go: 'cyan',
} as const

interface RoadmapProjectDetailsModalProps {
  open: boolean
  row: RoadmapProjectRow | null
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
  versions,
  onClose,
}: RoadmapProjectDetailsModalProps) {
  const version = row ? versions.find(candidate => candidate.id === row.firstSaleTosVersionId) : null
  const title = row
    ? `${row.marketName || '—'}（${buildRoadmapDisplayName(row.projectCode, row.androidVersion, row.productType)}）`
    : ''
  const details = row ? [
    ['tOS版本', version ? formatTosVersionDisplay(version) : '—'],
    ['项目分类', '整机产品项目'],
    ['项目二级分类', row.machineProjectType],
    ['安卓版本', row.androidVersion],
    ['品牌', row.brand],
    ['产品线', row.productLine],
    ['产品系列', row.productSeries],
    ['市场名', row.marketName],
    ['项目名', row.projectCode],
    ['产品类型', row.productType],
    ['芯片平台', row.platform],
    ['起步RAM', row.startRam],
    ['版本类型', row.versionType],
    ['STR5时间', <EstimatedDate key="str5" value={row.str5Date} estimated={row.str5Estimated} />],
    ['上市时间', <EstimatedDate key="launch" value={row.launchDate} estimated={row.launchEstimated} />],
    ['开发模式', row.developMode],
    ['项目状态', row.source === 'planned' ? '待规划' : row.status || '正式项目'],
    ['备注', row.remark || '—'],
  ] as const : []

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
            <Tag color={VERSION_TYPE_TAG_COLORS[row.versionType]}>{row.versionType}</Tag>
            <Tag color={row.productType === '新品' ? 'volcano' : 'default'}>
              {row.productType === '新品' ? 'New' : 'Old'}
            </Tag>
            <Tag color={row.source === 'planned' ? 'purple' : 'default'}>
              {row.source === 'planned' ? '待规划项目' : '正式项目'}
            </Tag>
          </Flex>
          <dl className="pms-roadmap-project-detail-grid">
            {details.map(([label, value]) => (
              <div key={label} className={label === '备注' ? 'is-wide' : undefined}>
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
