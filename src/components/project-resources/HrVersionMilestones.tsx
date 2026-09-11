'use client'

import { useEffect, useState } from 'react'
import { DatePicker, Descriptions, Form } from 'antd'
import dayjs from 'dayjs'
import { MILESTONE_FIELDS } from '@/constants/hrMachine'
import { TOS_MILESTONE_FIELDS } from '@/constants/hrTos'
import { TECH_MILESTONE_FIELDS } from '@/constants/hrTechnical'
import { isHrFormalRecord } from '@/lib/hrProjectRegistry'
import { resolveHrFormalSource, type HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { getHrVersionSeed, type HrVersionIdentity } from '@/lib/hrVersionRules'

const fieldsByCategory = { machine: MILESTONE_FIELDS, tos: TOS_MILESTONE_FIELDS, technical: TECH_MILESTONE_FIELDS,
  capability: [{ key: 'projectStartTime', label: '项目开始时间' }, { key: 'projectEndTime', label: '项目结束时间' }] }
type Dates = Record<string, string | null | undefined>
type Project = { id: string; pmsProjectId?: string; ipmProjectCode: string | null; versions: (HrVersionIdentity & { milestones?: object })[] }

export function useHrVersionMilestones(category: Exclude<HrProjectCategory, 'capability'>, project: Project | undefined, budgetType: string, open: boolean) {
  const [manual, setManual] = useState<Dates>({})
  useEffect(() => {
    if (!open) return
    const seed = project ? getHrVersionSeed(project.versions, budgetType) : undefined
    setManual({ ...seed?.milestones } as Dates)
  }, [open, project?.id, budgetType])
  const readOnly = isHrFormalRecord(project)
  const values = readOnly
    ? resolveHrFormalSource(category, project?.ipmProjectCode ?? null, project?.pmsProjectId).milestones as Dates
    : manual
  return { values, readOnly, onChange: (key: string, value: string | null) => setManual(previous => ({ ...previous, [key]: value })) }
}

export function HrVersionMilestoneFields({ category, values, readOnly, onChange }: {
  category: HrProjectCategory; values: object; readOnly: boolean; onChange: (key: string, value: string | null) => void
}) {
  const dates = values as Dates
  return <>{fieldsByCategory[category].map(field => <Form.Item key={field.key} label={field.label} tooltip={readOnly ? '来源于本项目最新已发布一级计划，空日期等待计划发布' : '预算项目独立维护，绑定正式项目后仍保留手工日期'}>
    <DatePicker aria-label={field.label} style={{ width: '100%' }} value={dates[field.key] ? dayjs(dates[field.key]) : null} disabled={readOnly} onChange={value => onChange(field.key, value?.format('YYYY-MM-DD') ?? null)} />
  </Form.Item>)}</>
}

export function HrVersionMilestoneDetails({ category, values }: { category: HrProjectCategory; values: object }) {
  const dates = values as Dates
  return <Descriptions title="里程碑信息" bordered size="small" column={3} style={{ marginBottom: 16 }} items={fieldsByCategory[category].map(field => ({ key: field.key, label: field.label, children: dates[field.key] || '—' }))} />
}
