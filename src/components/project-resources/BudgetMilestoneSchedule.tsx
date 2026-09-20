'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { App, Button, DatePicker } from 'antd'
import dayjs from 'dayjs'
import ResourceInlineField from '@/components/project-resources/ResourceInlineField'
import { inlineDateInputHandlers } from '@/components/project-resources/inlineFieldSession'
import {
  BUDGET_SCHEDULE_ANCHORS,
  calculateBudgetStageMetrics,
  createBudgetMilestoneSchedule,
  formatBudgetStageMetrics,
  resolveBudgetScheduleDisplay,
  resolvePublishedBudgetScheduleModel,
  type BudgetScheduleCategory,
  type BudgetScheduleModelSnapshot,
} from '@/lib/budgetMilestoneScheduling'
import { usePlanStore } from '@/stores/plan'

interface MilestoneField {
  key: string
  label: string
}

interface Props {
  category: BudgetScheduleCategory
  versionId: string
  dates: Record<string, string | null | undefined>
  fields: readonly MilestoneField[]
  modelSnapshot?: BudgetScheduleModelSnapshot
  readOnly: boolean
  canEdit: (key: string) => boolean
  onSaveDate: (key: string, value: string | null) => void
  onSchedule: (dates: Record<string, string>, modelSnapshot: BudgetScheduleModelSnapshot) => void
}

const STAGE_COLORS = ['#5b6ee1', '#7c58c7', '#3979b9', '#1f8b83', '#8c6c38', '#8655a8']

export default function BudgetMilestoneSchedule({
  category,
  versionId,
  dates,
  fields,
  modelSnapshot,
  readOnly,
  canEdit,
  onSaveDate,
  onSchedule,
}: Props) {
  const { message } = App.useApp()
  const anchors = BUDGET_SCHEDULE_ANCHORS[category]
  const [firstDate, setFirstDate] = useState(dates[anchors[0].key] ?? '')
  const [lastDate, setLastDate] = useState(dates[anchors[1].key] ?? '')
  useEffect(() => {
    setFirstDate(dates[anchors[0].key] ?? '')
    setLastDate(dates[anchors[1].key] ?? '')
  }, [versionId, dates[anchors[0].key], dates[anchors[1].key], anchors])

  const templateScopes = usePlanStore(state => state.configTemplateVersionScopes)
  const templateSnapshots = usePlanStore(state => state.publishedSnapshots)
  const displayModel = useMemo(() => {
    if (modelSnapshot?.category === category) return modelSnapshot
    return resolveBudgetScheduleDisplay({ configTemplateVersionScopes: templateScopes, publishedSnapshots: templateSnapshots }, category)
  }, [category, modelSnapshot, templateScopes, templateSnapshots])
  const metrics = useMemo(() => calculateBudgetStageMetrics(displayModel, dates), [dates, displayModel])
  const metricsByStage = new Map(metrics.map(metric => [metric.stageId, metric]))
  const fieldByKey = new Map(fields.map(field => [field.key, field]))
  const scheduledKeys = new Set(displayModel.milestones.map(milestone => milestone.fieldKey))
  const groups = [
    ...displayModel.stages.map(stage => ({
      id: stage.templateTaskId,
      label: stage.label,
      fields: stage.milestones.flatMap(milestone => fieldByKey.has(milestone.fieldKey) ? [fieldByKey.get(milestone.fieldKey)!] : []),
      metrics: metricsByStage.get(stage.templateTaskId),
    })),
    ...(() => {
      const manual = fields.filter(field => !scheduledKeys.has(field.key))
      return manual.length ? [{ id: 'manual', label: '后续阶段', fields: manual, metrics: undefined }] : []
    })(),
  ]

  const runSchedule = () => {
    try {
      const model = resolvePublishedBudgetScheduleModel(usePlanStore.getState(), category)
      const scheduledDates = createBudgetMilestoneSchedule(model, firstDate, lastDate)
      onSchedule(scheduledDates, model)
      message.success(`已按${model.templateVersionNo}模板完成里程碑排布`)
    } catch (error) {
      message.warning(error instanceof Error ? error.message : '里程碑排布失败')
    }
  }

  return <section className="pms-budget-milestone-schedule" aria-label="里程碑信息">
    {!readOnly && <div className="pms-budget-milestone-heading">
      <div className="pms-budget-milestone-anchor-inputs" role="group" aria-label="排布日期范围">
        {anchors.map((anchor, index) => {
          const value = index === 0 ? firstDate : lastDate
          const setValue = index === 0 ? setFirstDate : setLastDate
          return <label key={anchor.key}>
            <span>{anchor.label}</span>
            <div {...inlineDateInputHandlers(raw => setValue(raw ? String(raw) : ''))}>
              <DatePicker
                key={`${versionId}-${anchor.key}-${dates[anchor.key] ?? ''}`}
                aria-label={`${anchor.label}`}
                defaultValue={value ? dayjs(value) : null}
                disabled={readOnly}
                allowClear
                preserveInvalidOnBlur
                onChange={date => setValue(date?.format('YYYY-MM-DD') ?? '')}
              />
            </div>
          </label>
        })}
        <Button type="primary" size="small" disabled={readOnly || !firstDate || !lastDate} onClick={runSchedule}>按模型排布</Button>
      </div>
    </div>}
    <div className="pms-budget-milestone-scroll">
      <div className="pms-budget-milestone-track">
        {groups.filter(group => group.fields.length > 0).map((group, index) => <div
          key={group.id}
          className="pms-budget-milestone-stage"
          style={{ '--pms-budget-stage-color': STAGE_COLORS[index % STAGE_COLORS.length], minWidth: `${Math.max(group.fields.length, 1) * 142}px` } as CSSProperties}
        >
          <div className="pms-budget-milestone-stage-header">
            <strong>{group.label}</strong>
            {group.metrics ? <span>{formatBudgetStageMetrics(group.metrics)}</span> : null}
          </div>
          <dl style={{ gridTemplateColumns: `repeat(${Math.max(group.fields.length, 1)}, minmax(142px, 1fr))` }}>
            {group.fields.map(field => <div key={field.key}>
              <dt>{field.label}</dt>
              <dd><ResourceInlineField
                label={field.label}
                value={dates[field.key]}
                readOnly={readOnly || !canEdit(field.key)}
                onSave={value => onSaveDate(field.key, value ? String(value) : null)}
                renderEditor={(value, change, popup) => <div {...inlineDateInputHandlers(change)}><DatePicker
                  aria-label={field.label}
                  defaultValue={value ? dayjs(String(value)) : null}
                  preserveInvalidOnBlur
                  getPopupContainer={popup}
                  style={{ width: '100%' }}
                  onChange={date => change(date?.format('YYYY-MM-DD') ?? null)}
                /></div>}
              /></dd>
            </div>)}
          </dl>
        </div>)}
      </div>
    </div>
  </section>
}
