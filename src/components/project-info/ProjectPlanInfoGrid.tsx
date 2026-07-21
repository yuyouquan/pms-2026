'use client'

import type { ReactNode } from 'react'
import { Tag } from 'antd'
import {
  CalendarOutlined,
  CodeOutlined,
  GlobalOutlined,
  LockOutlined,
  PauseCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { getBalancedRows } from '@/lib/balancedRows'
import type { MarketYesNoValue } from '@/lib/marketRules'

export interface ProjectPlanInfoGridProps {
  visibleFieldKeys: string[]
  buildOption?: string
  buildMarket?: string
  googleLaunchDate?: string
  isMadaControlled?: MarketYesNoValue | undefined
  isSimLocked?: MarketYesNoValue | undefined
  isCancelPaused?: MarketYesNoValue | undefined
  cancelPauseDate?: string
}

interface PlanMetric {
  key: string
  label: string
  value: ReactNode
  icon: ReactNode
  tabular?: boolean
}

const hasValue = (value: string | number | null | undefined) => (
  value !== undefined && value !== null && String(value).trim() !== ''
)

const displayValue = (value: string | number | null | undefined) => (
  hasValue(value) ? String(value) : '-'
)

const displayBoolean = (value: MarketYesNoValue | undefined) => (
  hasValue(value)
    ? <Tag className="pms-project-plan-info-tag" color={value === '是' ? 'geekblue' : undefined}>{value}</Tag>
    : '-'
)

export default function ProjectPlanInfoGrid({
  visibleFieldKeys,
  buildOption,
  buildMarket,
  googleLaunchDate,
  isMadaControlled,
  isSimLocked,
  isCancelPaused,
  cancelPauseDate,
}: ProjectPlanInfoGridProps) {
  const metrics: PlanMetric[] = [
    {
      key: 'buildOption',
      label: '编译选项',
      value: displayValue(buildOption),
      icon: <CodeOutlined />,
    },
    {
      key: 'buildMarket',
      label: '编译市场',
      value: displayValue(buildMarket),
      icon: <GlobalOutlined />,
    },
    {
      key: 'googleLaunchDate',
      label: 'Google Launch Date',
      value: displayValue(googleLaunchDate),
      icon: <CalendarOutlined />,
      tabular: true,
    },
    {
      key: 'isMadaControlled',
      label: '是否MADA管控',
      value: displayBoolean(isMadaControlled),
      icon: <SafetyCertificateOutlined />,
    },
    {
      key: 'isSimLocked',
      label: '是否锁卡',
      value: displayBoolean(isSimLocked),
      icon: <LockOutlined />,
    },
    {
      key: 'isCancelPaused',
      label: '是否取消暂停',
      value: displayBoolean(isCancelPaused),
      icon: <PauseCircleOutlined />,
    },
    {
      key: 'cancelPauseDate',
      label: '取消暂停时间',
      value: displayValue(isCancelPaused === '是' ? cancelPauseDate : undefined),
      icon: <CalendarOutlined />,
      tabular: true,
    },
  ].filter(metric => visibleFieldKeys.includes(metric.key))
  const metricRows = getBalancedRows(metrics, 5, 2)

  return (
    <dl className="pms-project-plan-info-rows" aria-label="计划信息" data-visible-count={metrics.length}>
      {metricRows.map((row, rowIndex) => (
        <div
          key={`plan-info-${rowIndex}`}
          className="pms-project-plan-info-grid"
          style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
        >
          {row.map(metric => (
            <div key={metric.key} className="pms-project-plan-info-metric">
              <dt className="pms-project-plan-info-label">{metric.label}</dt>
              <dd className={`pms-project-plan-info-value${metric.tabular ? ' pms-project-plan-info-value--tabular' : ''}`}>
                <span className="pms-project-plan-info-icon" aria-hidden="true">{metric.icon}</span>
                <span className="pms-project-plan-info-value-text">{metric.value}</span>
              </dd>
            </div>
          ))}
        </div>
      ))}
    </dl>
  )
}
