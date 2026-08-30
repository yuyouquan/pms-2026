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
import { PROJECT_PLAN_INFO_FIELDS } from '@/constants/projectPlanInfoSchema'
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
  const metricContentByKey: Record<string, Omit<PlanMetric, 'key' | 'label'>> = {
    isMadaControlled: {
      value: displayBoolean(isMadaControlled),
      icon: <SafetyCertificateOutlined />,
    },
    isSimLocked: {
      value: displayBoolean(isSimLocked),
      icon: <LockOutlined />,
    },
    googleLaunchDate: {
      value: displayValue(googleLaunchDate),
      icon: <CalendarOutlined />,
      tabular: true,
    },
    isCancelPaused: {
      value: displayBoolean(isCancelPaused),
      icon: <PauseCircleOutlined />,
    },
    cancelPauseDate: {
      value: displayValue(isCancelPaused === '是' ? cancelPauseDate : undefined),
      icon: <CalendarOutlined />,
      tabular: true,
    },
    buildOption: {
      value: displayValue(buildOption),
      icon: <CodeOutlined />,
    },
    buildMarket: {
      value: displayValue(buildMarket),
      icon: <GlobalOutlined />,
    },
  }
  const metrics = PROJECT_PLAN_INFO_FIELDS.map(field => ({
    key: field.key,
    label: field.label,
    ...metricContentByKey[field.key],
  })).filter(metric => visibleFieldKeys.includes(metric.key))
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
