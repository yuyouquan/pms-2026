'use client'

import type { ReactNode } from 'react'
import { BarChartOutlined, SwapOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Radio, Tooltip } from 'antd'
import type { PlanWorkspaceViewMode } from '@/lib/planWorkspace'
import { normalizePlanViewMode } from '@/lib/planWorkspace'

export interface PlanViewModeSwitcherProps {
  viewMode: PlanWorkspaceViewMode
  onViewModeChange: (viewMode: PlanWorkspaceViewMode) => void
  horizontalDisabled?: boolean
}

const VIEW_OPTIONS = [
  { label: '竖版表格', value: 'vertical', icon: <UnorderedListOutlined /> },
  { label: '横版表格', value: 'horizontal', icon: <SwapOutlined /> },
  { label: '甘特图', value: 'gantt', icon: <BarChartOutlined /> },
] satisfies readonly { label: string; value: PlanWorkspaceViewMode; icon: ReactNode }[]

export function PlanViewModeSwitcher({
  viewMode,
  onViewModeChange,
  horizontalDisabled = false,
}: PlanViewModeSwitcherProps) {
  const normalizedViewMode = normalizePlanViewMode(viewMode, horizontalDisabled)

  return (
    <Radio.Group
      value={normalizedViewMode}
      onChange={event => onViewModeChange(normalizePlanViewMode(event.target.value, horizontalDisabled))}
      buttonStyle="solid"
      size="middle"
      className="pms-plan-view-mode-switcher"
      aria-label="计划视图"
    >
      {VIEW_OPTIONS.map(option => {
        const disabled = option.value === 'horizontal' && horizontalDisabled
        const title = disabled ? '横版表格在当前计划中不可用' : option.label
        return (
          <Tooltip title={title} key={option.value}>
            <Radio.Button
              value={option.value}
              disabled={disabled}
              aria-label={option.label}
              aria-disabled={disabled}
            >
              {option.icon}
            </Radio.Button>
          </Tooltip>
        )
      })}
    </Radio.Group>
  )
}
