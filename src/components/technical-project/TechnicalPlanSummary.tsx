'use client'

import type { ReactNode } from 'react'
import { Card, Empty, Space, Tag, Tooltip } from 'antd'
import { CalendarOutlined, EditOutlined } from '@ant-design/icons'
import { ClickToEditDate } from '@/components/shared/PlanHelpers'
import { projectLevel1Plan, sumLevel1EstimatedDays } from '@/lib/level1PlanRules'
import { comparePublishedTechnicalPlanVersions } from '@/lib/technicalProjectRules'
import { selectVisibleTechnicalPlanVersions } from '@/lib/technicalPlanWorkspace'
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
  const visibleVersions = selectVisibleTechnicalPlanVersions(instance?.versions || [], canEditPlan)
  const latestPublishedVersion = [...visibleVersions]
    .filter(version => version.status === '已发布')
    .sort(comparePublishedTechnicalPlanVersions)[0]
  const activeDraft = canEditPlan ? visibleVersions.find(version => version.status === '修订中') : undefined
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
  const projectionMode = normalizedTasks.some(task => task.parentId) ? 'standard' : 'technical-subproject'
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
      endDatesByTaskId: Object.fromEntries(projection.rows.map(task => [task.id, task.planEndDate || ''])),
    }
  })
  const actualStarts = currentProjection.rows.map(row => Date.parse(row.actualStartDate)).filter(Number.isFinite)
  const actualEnds = currentProjection.rows.map(row => Date.parse(row.actualEndDate)).filter(Number.isFinite)
  const actualCycleDays = actualStarts.length && actualEnds.length
    ? Math.max(0, Math.ceil((Math.max(...actualEnds) - Math.min(...actualStarts)) / 86_400_000))
    : null
  const canEditPlanEnd = canEditPlan && currentVersion.status === '修订中'
  const canEditActualEnd = canEditPlan && (
    currentVersion.status === '修订中' || currentVersion.id === latestPublishedVersion?.id
  )
  const updateDate = (taskId: string, field: 'planEndDate' | 'actualEndDate', value: string) => {
    if (field === 'planEndDate' ? !canEditPlanEnd : !canEditActualEnd) return
    updateCurrentTasks(
      scope,
      currentVersion.tasks.map(task => task.id === taskId ? { ...task, [field]: value } : task),
      scope.kind === 'subproject' ? 1 : 2,
    )
  }

  return planCard(
    <div className="technical-plan-summary" role="region" aria-label={`${label}计划信息内容`} tabIndex={0}>
      <table aria-label={`${label}版本阶段里程碑`}>
        <thead>
          {projectionMode === 'technical-subproject' ? (
            <tr data-technical-plan-header="single-row">
              <th className="technical-plan-summary-sticky-version">版本</th>
              <th className="technical-plan-summary-sticky-cycle">开发周期</th>
              {columns.map(column => <th key={column.id}>{column.taskName}</th>)}
            </tr>
          ) : (
            <>
              <tr data-technical-plan-header="grouped">
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
                  ? group.milestones.map(milestone => <th key={milestone.id}>{milestone.taskName}</th>)
                  : [<th key={group.stage.id}>-</th>])}
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
                  <Space size={4}>
                    <span className="technical-plan-summary-version">{row.version.versionNo}</span>
                    {row.version.status === '修订中' && <Tooltip title="修订中"><EditOutlined aria-label="修订中" /></Tooltip>}
                  </Space>
                </td>
                <td className="technical-plan-summary-sticky-cycle">{displayCycle(row.cycleDays)}</td>
                {columns.map(column => {
                  const planEndDate = row.endDatesByTaskId[column.id]
                  return (
                    <td key={column.id}>
                      {isCurrent && canEditPlanEnd
                        ? <ClickToEditDate align="center" value={planEndDate || ''} onChange={value => updateDate(column.id, 'planEndDate', value)} />
                        : planEndDate || '-'}
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
              const actualEndDate = currentProjection.rows.find(task => task.id === column.id)?.actualEndDate || ''
              return (
                <td key={column.id}>
                  {canEditActualEnd
                    ? <ClickToEditDate align="center" value={actualEndDate} onChange={value => updateDate(column.id, 'actualEndDate', value)} />
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
