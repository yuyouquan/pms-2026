'use client'

import type { ReactNode } from 'react'
import { Card, Empty, Space, Tag, Tooltip } from 'antd'
import { CalendarOutlined, EditOutlined } from '@ant-design/icons'
import { ClickToEditDate } from '@/components/shared/PlanHelpers'
import { projectLevel1Plan, sumLevel1EstimatedDays } from '@/lib/level1PlanRules'
import { formatPlanPublishedDate } from '@/lib/planVersioning'
import { selectLevel1HorizontalVersions } from '@/lib/projectSpaceLevel1Rules'
import { getTechnicalPlanRowKey } from '@/lib/technicalPlanWorkspace'
import { getTechnicalPlanKey, useTechnicalPlanStore, type TechnicalPlanScope } from '@/stores/technicalPlan'
import type { TechnicalTemplateTask } from '@/types/technicalPlan'

interface TechnicalPlanSummaryProps {
  scope: TechnicalPlanScope
  label: string
  canEditPlan: boolean
}

const TECHNICAL_STAGE_COLORS = ['#1890ff', '#52c41a', '#722ed1', '#faad14', '#eb2f96', '#13c2c2'] as const

const displayCycle = (days: number | null) => days === null ? '-' : days

const normalizeTasks = (tasks: readonly TechnicalTemplateTask[]) => tasks.map(task => ({
  ...task,
  taskName: String(task.taskName || ''),
  planEndDate: String(task.planEndDate || ''),
  actualEndDate: String(task.actualEndDate || ''),
}))

export default function TechnicalPlanSummary({ scope, label, canEditPlan }: TechnicalPlanSummaryProps) {
  const instance = useTechnicalPlanStore(state => state.plansByKey[getTechnicalPlanKey(scope)])
  const updateCurrentTasks = useTechnicalPlanStore(state => state.updateCurrentTasks)
  const visibleVersions = selectLevel1HorizontalVersions(instance?.versions || [], { surface: 'basic-info' })
  const latestPublishedVersion = visibleVersions.find(version => version.status === '已发布')
  const activeDraft = visibleVersions.find(version => version.status === '修订中')
  const currentVersion = activeDraft
    || visibleVersions.find(version => version.id === instance?.currentVersionId)
    || latestPublishedVersion
    || visibleVersions[0]
  const planCard = (content: ReactNode) => (
    <Card
      className="pms-project-info-plan-card"
      title={<Space size={8}><CalendarOutlined style={{ color: 'var(--pms-brand)' }} /><span>计划信息</span></Space>}
    >
      {content}
    </Card>
  )

  if (!currentVersion) {
    return planCard(<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划版本" />)
  }

  if (!currentVersion.tasks.length) {
    return planCard(<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划数据" />)
  }

  const normalizedTasks = normalizeTasks(currentVersion.tasks)
  const projectionMode = scope.kind === 'subproject' ? 'technical-subproject' : 'standard'
  const currentProjection = projectLevel1Plan(normalizedTasks, { mode: projectionMode })
  const groups = currentProjection.stageGroups.map(group => ({
    ...group,
    width: Math.max(1, group.milestones.length),
  }))
  const columns = projectionMode === 'technical-subproject'
    ? currentProjection.rows
    : groups.flatMap(group => group.milestones.length ? group.milestones : [group.stage])
  const versionRows = visibleVersions.map(version => {
    const projection = projectLevel1Plan(normalizeTasks(version.tasks), { mode: projectionMode })
    return {
      version,
      cycleDays: sumLevel1EstimatedDays(projection.rows),
      endDatesByTaskId: Object.fromEntries(projection.rows.map(task => [getTechnicalPlanRowKey(task), task.planEndDate || ''])),
    }
  })
  const actualProjection = projectLevel1Plan(normalizeTasks(latestPublishedVersion?.tasks || []), { mode: projectionMode })
  const actualStarts = actualProjection.rows.map(row => Date.parse(row.actualStartDate)).filter(Number.isFinite)
  const actualEnds = actualProjection.rows.map(row => Date.parse(row.actualEndDate)).filter(Number.isFinite)
  const actualCycleDays = actualStarts.length && actualEnds.length
    ? Math.max(0, Math.ceil((Math.max(...actualEnds) - Math.min(...actualStarts)) / 86_400_000))
    : null
  const actualEndDatesByTaskId = Object.fromEntries(
    actualProjection.rows.map(task => [getTechnicalPlanRowKey(task), task.actualEndDate || '']),
  )
  const canEditActualEnd = canEditPlan && currentVersion.status === '修订中'
  const updateActualDate = (taskKey: string, value: string) => {
    if (!canEditActualEnd) return
    updateCurrentTasks(
      scope,
      currentVersion.tasks.map(task => getTechnicalPlanRowKey(task) === taskKey ? { ...task, actualEndDate: value } : task),
      scope.kind === 'subproject' ? 1 : 2,
    )
  }

  return planCard(
    <div className="technical-plan-summary" role="region" aria-label={`${label}计划信息内容`} tabIndex={0}>
      <table aria-label={projectionMode === 'technical-subproject' ? `${label}版本活动` : `${label}版本阶段里程碑`}>
        <thead>
          {projectionMode === 'technical-subproject' ? (
            <tr data-technical-plan-header="single-row">
              <th scope="col" className="technical-plan-summary-sticky-version">版本</th>
              <th scope="col" className="technical-plan-summary-sticky-cycle">开发周期</th>
              {columns.map(column => <th key={getTechnicalPlanRowKey(column)} scope="col">{column.taskName}</th>)}
            </tr>
          ) : (
            <>
              <tr data-technical-plan-header="grouped">
                <th scope="col" className="technical-plan-summary-sticky-version" rowSpan={2}>版本</th>
                <th scope="col" className="technical-plan-summary-sticky-cycle" rowSpan={2}>开发周期</th>
                {groups.map((group, index) => {
                  const stageColor = TECHNICAL_STAGE_COLORS[index % TECHNICAL_STAGE_COLORS.length]
                  return (
                    <th
                      key={getTechnicalPlanRowKey(group.stage)}
                      scope="colgroup"
                      className="technical-plan-summary-stage"
                      colSpan={group.width}
                      style={{
                        background: `${stageColor}10`,
                        color: stageColor,
                        borderBottom: `2px solid ${stageColor}`,
                      }}
                    >
                      <div className="technical-plan-summary-stage-content">
                        <span>{group.stage.taskName}</span>
                        <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                          {group.stage.estimatedDays == null ? '-' : `${group.stage.estimatedDays}天`}
                        </Tag>
                      </div>
                    </th>
                  )
                })}
              </tr>
              <tr>
                {groups.flatMap(group => group.milestones.length
                  ? group.milestones.map(milestone => <th key={getTechnicalPlanRowKey(milestone)} scope="col">{milestone.taskName}</th>)
                  : [<th key={getTechnicalPlanRowKey(group.stage)} scope="col">-</th>])}
              </tr>
            </>
          )}
        </thead>
        <tbody>
          {versionRows.map(row => {
            const isCurrent = row.version.id === currentVersion.id
            return (
              <tr key={row.version.id} className={isCurrent ? 'technical-plan-summary-current' : undefined}>
                <td className="technical-plan-summary-sticky-version">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Space size={4}>
                      <span className="technical-plan-summary-version">{row.version.versionNo}</span>
                      {row.version.status === '修订中' && <Tooltip title="修订中"><EditOutlined aria-label="修订中" /></Tooltip>}
                    </Space>
                    <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 400 }}>{formatPlanPublishedDate(row.version)}</span>
                  </div>
                </td>
                <td className="technical-plan-summary-sticky-cycle">{displayCycle(row.cycleDays)}</td>
                {columns.map(column => {
                  const planEndDate = row.endDatesByTaskId[getTechnicalPlanRowKey(column)]
                  return (
                    <td key={getTechnicalPlanRowKey(column)}>
                      {planEndDate || '-'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          <tr className="technical-plan-summary-actual">
            <td className="technical-plan-summary-sticky-version"><span className="technical-plan-summary-version">实际</span></td>
            <td className="technical-plan-summary-sticky-cycle">{displayCycle(actualCycleDays)}</td>
            {columns.map(column => {
              const taskKey = getTechnicalPlanRowKey(column)
              const actualTask = actualProjection.rows.find(task => getTechnicalPlanRowKey(task) === taskKey)
              const actualEndDate = actualTask ? actualEndDatesByTaskId[taskKey] || '' : ''
              return (
                <td key={taskKey}>
                  {actualTask && canEditActualEnd
                    ? <ClickToEditDate align="center" value={actualEndDate} onChange={value => updateActualDate(taskKey, value)} />
                    : actualEndDate || '-'}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>,
  )
}
