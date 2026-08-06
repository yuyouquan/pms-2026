'use client'

import type { ReactNode } from 'react'
import { Card, Empty, Space } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import { resolveTechnicalPlanSummary } from '@/lib/technicalProjectRules'
import { getTechnicalPlanKey, useTechnicalPlanStore, type TechnicalPlanScope } from '@/stores/technicalPlan'

interface TechnicalPlanSummaryProps {
  scope: TechnicalPlanScope
  label: string
}

const TECHNICAL_STAGE_COLORS = ['#1890ff', '#52c41a', '#722ed1', '#faad14', '#eb2f96', '#13c2c2'] as const

const displayCycle = (days: number | null) => days === null ? '-' : days

export default function TechnicalPlanSummary({ scope, label }: TechnicalPlanSummaryProps) {
  const instance = useTechnicalPlanStore(state => state.plansByKey[getTechnicalPlanKey(scope)])
  const summary = resolveTechnicalPlanSummary(instance?.versions || [])
  const planCard = (content: ReactNode) => (
    <Card
      className="pms-project-info-plan-card"
      title={<Space size={8}><CalendarOutlined style={{ color: 'var(--pms-brand)' }} /><span>计划信息</span></Space>}
    >
      {content}
    </Card>
  )

  if (!summary.latestVersion) {
    return planCard(<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划版本（仅展示已发布版本）" />)
  }

  if (!summary.hasTaskData) {
    return planCard(<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划数据" />)
  }

  const stages = summary.latestVersion.tasks
    .filter(task => !task.parentId)
    .sort((left, right) => left.order - right.order)
  const groups = stages.map(stage => {
    const milestones = summary.latestVersion!.tasks
      .filter(task => task.parentId === stage.id)
      .sort((left, right) => left.order - right.order)
    return { stage, milestones, width: Math.max(1, milestones.length) }
  })
  const columns = groups.flatMap(group => group.milestones.length ? group.milestones : [group.stage])

  return planCard(
      <div className="technical-plan-summary" role="region" aria-label={`${label}计划信息内容`} tabIndex={0}>
        <table aria-label={`${label}版本阶段里程碑`}>
          <thead>
            <tr>
              <th className="technical-plan-summary-sticky-version" rowSpan={2}>版本</th>
              <th className="technical-plan-summary-sticky-cycle" rowSpan={2}>开发周期</th>
              {groups.map((group, index) => {
                const stageColor = TECHNICAL_STAGE_COLORS[index % TECHNICAL_STAGE_COLORS.length]
                return (
                  <th
                    key={group.stage.id}
                    className="technical-plan-summary-stage"
                    colSpan={group.width}
                    style={{
                      background: `${stageColor}10`,
                      color: stageColor,
                      borderBottom: `2px solid ${stageColor}`,
                    }}
                  >
                    {group.stage.taskName}
                  </th>
                )
              })}
            </tr>
            <tr>
              {groups.flatMap(group => group.milestones.length
                ? group.milestones.map(milestone => <th key={milestone.id}>{milestone.taskName}</th>)
                : [<th key={group.stage.id}>-</th>])}
            </tr>
          </thead>
          <tbody>
            {summary.versionRows.map(row => (
              <tr key={row.version.id} className={row.version.id === summary.latestVersion?.id ? 'technical-plan-summary-current' : undefined}>
                <td className="technical-plan-summary-sticky-version"><span className="technical-plan-summary-version">{row.version.versionNo}</span></td>
                <td className="technical-plan-summary-sticky-cycle">{displayCycle(row.cycleDays)}</td>
                {columns.map(column => {
                  const planEndDate = row.endDatesByTaskId[column.id]
                  return <td key={column.id}>{planEndDate || '-'}</td>
                })}
              </tr>
            ))}
            <tr className="technical-plan-summary-actual">
              <td className="technical-plan-summary-sticky-version"><span className="technical-plan-summary-version">实际</span></td>
              <td className="technical-plan-summary-sticky-cycle">{displayCycle(summary.actualRow.cycleDays)}</td>
              {columns.map(column => {
                const actualEndDate = summary.actualRow.endDatesByTaskId[column.id]
                return <td key={column.id}>{actualEndDate || '-'}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>,
  )
}
