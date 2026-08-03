'use client'

import { Empty, Tag } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import CollapsibleInformationSection from '@/components/project-info/CollapsibleInformationSection'
import { resolveTechnicalPlanSummary } from '@/lib/technicalProjectRules'
import { getTechnicalPlanKey, useTechnicalPlanStore, type TechnicalPlanScope } from '@/stores/technicalPlan'

interface TechnicalPlanSummaryProps {
  scope: TechnicalPlanScope
  label: string
}

const displayCycle = (days: number | null) => days === null ? '-' : `${days} 天`

export default function TechnicalPlanSummary({ scope, label }: TechnicalPlanSummaryProps) {
  const instance = useTechnicalPlanStore(state => state.plansByKey[getTechnicalPlanKey(scope)])
  const summary = resolveTechnicalPlanSummary(instance?.versions || [])

  if (!summary.latestVersion) {
    return (
      <CollapsibleInformationSection title={`${label}计划摘要`} icon={<CalendarOutlined />} defaultActive>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划版本（仅展示已发布版本）" />
      </CollapsibleInformationSection>
    )
  }

  if (!summary.hasTaskData) {
    return (
      <CollapsibleInformationSection title={`${label}计划摘要`} icon={<CalendarOutlined />} count={summary.versions.length} defaultActive>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划数据" />
      </CollapsibleInformationSection>
    )
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

  return (
    <CollapsibleInformationSection
      title={`${label}计划摘要`}
      icon={<CalendarOutlined />}
      count={summary.versions.length}
      defaultActive
    >
      <div className="technical-plan-summary" role="region" aria-label={`${label}计划摘要内容`} tabIndex={0}>
        <table aria-label={`${label}版本阶段里程碑`}>
          <thead>
            <tr>
              <th rowSpan={2}>版本</th>
              <th rowSpan={2}>开发周期</th>
              {groups.map(group => (
                <th key={group.stage.id} colSpan={group.width}>{group.stage.taskName}</th>
              ))}
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
                <td>
                  <span className="technical-plan-summary-version">{row.version.versionNo}</span>
                  <Tag color="success">已发布</Tag>
                </td>
                <td>{displayCycle(row.cycleDays)}</td>
                {columns.map(column => {
                  const planEndDate = row.endDatesByTaskId[column.id]
                  return <td key={column.id}>{planEndDate || '-'}</td>
                })}
              </tr>
            ))}
            <tr className="technical-plan-summary-actual">
              <td><span className="technical-plan-summary-version">实际</span></td>
              <td>{displayCycle(summary.actualRow.cycleDays)}</td>
              {columns.map(column => {
                const actualEndDate = summary.actualRow.endDatesByTaskId[column.id]
                return <td key={column.id}>{actualEndDate || '-'}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </CollapsibleInformationSection>
  )
}
