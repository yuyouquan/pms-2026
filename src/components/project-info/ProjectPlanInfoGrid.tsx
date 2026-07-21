'use client'

import type { ReactNode } from 'react'
import { Tag } from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  GlobalOutlined,
  LockOutlined,
  PauseCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { getBalancedRows } from '@/lib/balancedRows'

export interface ProjectPlanInfoGridProps {
  visibleFieldKeys: string[]
  planStartDate?: string
  planEndDate?: string
  developCycle?: string | number
  googleLaunchDate?: string
  isCarrierCustomized?: string
  isSimLocked?: string
  isCancelPaused?: string
  cancelPauseDate?: string
  isMadaControlled?: string
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

const displayBoolean = (value: string | undefined) => (
  hasValue(value)
    ? <Tag className="pms-project-plan-info-tag" color={value === '是' ? 'geekblue' : undefined}>{value}</Tag>
    : '-'
)

export default function ProjectPlanInfoGrid({
  visibleFieldKeys,
  planStartDate,
  planEndDate,
  developCycle,
  googleLaunchDate,
  isCarrierCustomized,
  isSimLocked,
  isCancelPaused,
  cancelPauseDate,
  isMadaControlled,
}: ProjectPlanInfoGridProps) {
  const metrics: PlanMetric[] = [
    {
      key: 'planStartDate',
      label: '计划开始时间',
      value: displayValue(planStartDate),
      icon: <CalendarOutlined />,
      tabular: true,
    },
    {
      key: 'planEndDate',
      label: '计划结束时间',
      value: displayValue(planEndDate),
      icon: <CalendarOutlined />,
      tabular: true,
    },
    {
      key: 'developCycle',
      label: '开发周期（工作日）',
      value: hasValue(developCycle) ? <>{developCycle}<span className="pms-project-plan-info-suffix">天</span></> : '-',
      icon: <ClockCircleOutlined />,
      tabular: true,
    },
    {
      key: 'googleLaunchDate',
      label: 'Google Launch Date',
      value: displayValue(googleLaunchDate),
      icon: <GlobalOutlined />,
      tabular: true,
    },
    {
      key: 'isMadaControlled',
      label: '是否MADA管控',
      value: displayBoolean(isMadaControlled),
      icon: <SafetyCertificateOutlined />,
    },
    {
      key: 'isCarrierCustomized',
      label: '是否运营商定制',
      value: displayBoolean(isCarrierCustomized),
      icon: <CustomerServiceOutlined />,
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
