'use client'

import { Empty, Tag } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import CollapsibleInformationSection from '@/components/project-info/CollapsibleInformationSection'
import { getTechnicalPlanKey, useTechnicalPlanStore, type TechnicalPlanScope } from '@/stores/technicalPlan'
import type { TechnicalTemplateTask } from '@/types/technicalPlan'

interface TechnicalPlanSummaryProps {
  scope: TechnicalPlanScope
  label: string
}

const developmentCycle = (tasks: readonly TechnicalTemplateTask[]) => {
  const starts = tasks.map(task => Date.parse(task.planStartDate)).filter(Number.isFinite)
  const ends = tasks.map(task => Date.parse(task.planEndDate)).filter(Number.isFinite)
  if (!starts.length || !ends.length) return '-'
  return `${Math.max(0, Math.ceil((Math.max(...ends) - Math.min(...starts)) / 86_400_000))} 天`
}

export default function TechnicalPlanSummary({ scope, label }: TechnicalPlanSummaryProps) {
  const instance = useTechnicalPlanStore(state => state.plansByKey[getTechnicalPlanKey(scope)])
  const currentVersion = instance?.versions.find(version => version.id === instance.currentVersionId)
    || instance?.versions[0]

  if (!instance || !currentVersion) {
    return (
      <CollapsibleInformationSection title={`${label}计划摘要`} icon={<CalendarOutlined />} defaultActive>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划版本" />
      </CollapsibleInformationSection>
    )
  }

  const stages = currentVersion.tasks
    .filter(task => !task.parentId)
    .sort((left, right) => left.order - right.order)
  const groups = stages.map(stage => {
    const milestones = currentVersion.tasks
      .filter(task => task.parentId === stage.id)
      .sort((left, right) => left.order - right.order)
    return { stage, milestones, width: Math.max(1, milestones.length) }
  })
  const columns = groups.flatMap(group => group.milestones.length ? group.milestones : [group.stage])
  const versions = [
    currentVersion,
    ...instance.versions.filter(version => version.id !== currentVersion.id),
  ]

  return (
    <CollapsibleInformationSection
      title={`${label}计划摘要`}
      icon={<CalendarOutlined />}
      count={instance.versions.length}
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
            {versions.map(version => (
              <tr key={version.id} className={version.id === currentVersion.id ? 'technical-plan-summary-current' : undefined}>
                <td>
                  <span className="technical-plan-summary-version">{version.versionNo}</span>
                  <Tag color={version.status === '修订中' ? 'gold' : 'success'}>{version.status}</Tag>
                </td>
                <td>{developmentCycle(version.tasks)}</td>
                {columns.map(column => {
                  const task = version.tasks.find(item => item.id === column.id)
                  return <td key={column.id}>{task?.planEndDate || '-'}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleInformationSection>
  )
}
