'use client'

import { useEffect, useState } from 'react'
import { DatePicker, Form } from 'antd'
import dayjs from 'dayjs'
import { withMachineDerivedMilestones } from '@/lib/hrMachinePeriods'
import { MILESTONE_FIELDS } from '@/constants/hrMachine'
import { TOS_MILESTONE_FIELDS } from '@/constants/hrTos'
import { TECH_MILESTONE_FIELDS } from '@/constants/hrTechnical'
import { isHrFormalRecord } from '@/lib/hrProjectRegistry'
import { resolveHrFormalSource, type HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { getHrVersionSeed, type HrVersionIdentity } from '@/lib/hrVersionRules'
import { HR_MANUAL_MILESTONE_KEYS, mergeHrFormalMilestones } from '@/lib/hrMilestoneOwnership'
import { HrReadonlyField } from '@/components/project-resources/HrReadonlyField'

const fieldsByCategory = { machine: MILESTONE_FIELDS, tos: TOS_MILESTONE_FIELDS, technical: TECH_MILESTONE_FIELDS,
  capability: [{ key: 'projectStartTime', label: '项目开始时间' }, { key: 'projectEndTime', label: '项目结束时间' }] }
type Dates = Record<string, string | null | undefined>
type Project = { id: string; pmsProjectId?: string; ipmProjectCode: string | null; versions: (HrVersionIdentity & { milestones?: object })[] }

export function useHrVersionMilestones(category: Exclude<HrProjectCategory, 'capability'>, project: Project | undefined, budgetType: string, open: boolean, versionId?: string) {
  const [manual, setManual] = useState<Dates>({})
  useEffect(() => {
    if (!open) return
    const seed = project ? (versionId ? project.versions.find(version => version.id === versionId) : getHrVersionSeed(project.versions, budgetType)) : undefined
    setManual({ ...seed?.milestones } as Dates)
  }, [open, project?.id, budgetType, versionId])
  const readOnly = isHrFormalRecord(project)
  const values = readOnly
    ? mergeHrFormalMilestones(category, resolveHrFormalSource(category, project?.ipmProjectCode ?? null, project?.pmsProjectId).milestones, manual) as Dates
    : manual
  return { values, readOnly, onChange: (key: string, value: string | null) => setManual(previous => ({ ...previous, [key]: value })) }
}

export function HrVersionMilestoneFields({ category, values, readOnly, onChange }: {
  category: HrProjectCategory; values: object; readOnly: boolean; onChange: (key: string, value: string | null) => void
}) {
  const dates = (category === 'machine' ? withMachineDerivedMilestones(values) : values) as Dates
  return <>{fieldsByCategory[category].map(field => {
    const derived = category === 'machine' && field.key === 'str5Plus6Months'
    const locked = derived || (readOnly && !HR_MANUAL_MILESTONE_KEYS[category].includes(field.key))
    const reason = derived ? '根据 STR5 自动加 6 个自然月，不可编辑' : locked ? '来源于本项目最新已发布一级计划，空日期等待计划发布' : readOnly
      ? '手工维护，不随一级计划同步' : '预算项目独立维护，绑定正式项目后仍保留手工日期'
    return <Form.Item key={field.key} label={field.label} tooltip={reason}>
      {locked ? <HrReadonlyField label={field.label} value={dates[field.key]} reason={reason} />
        : <DatePicker aria-label={field.label} style={{ width: '100%' }} value={dates[field.key] ? dayjs(dates[field.key]) : null} onChange={value => onChange(field.key, value?.format('YYYY-MM-DD') ?? null)} />}
    </Form.Item>
  })}</>
}

export function HrVersionMilestoneRow(props: Parameters<typeof HrVersionMilestoneFields>[0]) {
  return <div className="pms-hr-version-milestone-scroll" role="group" aria-label="里程碑时间">
    <div className="pms-hr-version-row pms-hr-version-row--milestones" style={{ gridTemplateColumns: `repeat(${fieldsByCategory[props.category].length}, minmax(128px, 1fr))` }}>
      <HrVersionMilestoneFields {...props} />
    </div>
  </div>
}

export function HrVersionMilestoneDetails({ category, values }: { category: HrProjectCategory; values: object }) {
  const dates = (category === 'machine' ? withMachineDerivedMilestones(values) : values) as Dates
  return <section className="pms-hr-milestone-details" aria-label="里程碑信息">
    <h3 className="pms-hr-investment-section-title">里程碑信息</h3>
    <div className="pms-hr-milestone-details-scroll">
      <dl style={{ gridTemplateColumns: `repeat(${fieldsByCategory[category].length}, minmax(94px, 1fr))` }}>
        {fieldsByCategory[category].map(field => <div key={field.key}><dt>{field.label}</dt><dd>{dates[field.key] || '—'}</dd></div>)}
      </dl>
    </div>
  </section>
}
