'use client'

import { useState } from 'react'
import { Drawer, Input } from 'antd'
import { ArrowRightOutlined, SearchOutlined } from '@ant-design/icons'
import CockpitTable, { type CockpitColumn } from '@/components/cockpit/CockpitTable'
import { cockpitOverview, cockpitRatios, formatCockpit, summarizeCockpit, type AmountKey, type CockpitFact, type CockpitInput, type CockpitMode, type CockpitRow } from '@/components/cockpit/cockpitData'

export type CockpitMetricKey = AmountKey | 'deviation' | 'toDate' | 'annualExecution'
export interface CockpitMetric { key: CockpitMetricKey; label: string; note: string }

export default function CockpitMetricDetail({ metric, facts, inputs, mode, dates, onClose, onOpenProject }: {
  metric: CockpitMetric; facts: readonly CockpitFact[]; inputs: readonly CockpitInput[]; mode: CockpitMode
  dates: [string, string]; onClose: () => void; onOpenProject: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const isRatio = ['deviation', 'toDate', 'annualExecution'].includes(metric.key)
  const unit = mode === 'labor' ? '人月' : '万元'
  const valueOf = (row: CockpitRow) => isRatio ? cockpitRatios(row, mode)[metric.key as keyof ReturnType<typeof cockpitRatios>] : row[metric.key as AmountKey]?.[mode]
  const projectRows = cockpitOverview(facts, 'project', mode)
  const rows = projectRows.filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  const total: CockpitRow = { key: 'total', name: '当前范围合计', count: projectRows.length, ...summarizeCockpit(facts) }
  const sourceLabel = (row: CockpitRow) => {
    const input = inputs.find(item => item.project.id === row.project?.id)
    if (!input) return '—'
    const sourceKeys = metric.key === 'annual' ? [0] : metric.key === 'estimate' ? [1] : metric.key === 'budget' || metric.key === 'annualExecution' ? [2] : metric.key === 'deviation' ? [1, 2] : metric.key === 'actual' ? [] : [input.sources[2] ? 2 : input.sources[1] ? 1 : 0]
    const labels = sourceKeys.map(index => `${['年度预算', '项目概算', '项目预算'][index]} ${input.sources[index]?.version.versionNumber ?? '无正式版本'}`)
    if (['actual', 'toDate', 'annualExecution'].includes(metric.key)) labels.push(input.dataset ? '项目工时核算台账' : '无核算台账')
    return labels.join(' · ')
  }
  const columns: CockpitColumn<CockpitRow>[] = [
    { key: 'name', label: '项目名称', width: 245, value: row => row.name, render: row => <button className="cockpit-project-link" title={`查看 ${row.name} 的项目资源`} onClick={() => row.project && onOpenProject(row.project.id)}><span>{row.name}</span><ArrowRightOutlined /></button> },
    { key: 'source', label: '项目空间来源', width: 295, render: row => <span title={sourceLabel(row)}>{sourceLabel(row)}</span> },
    { key: 'value', label: `${metric.label}（${isRatio ? '%' : unit}）`, width: 195, numeric: true, value: valueOf, render: row => formatCockpit(valueOf(row)) },
  ]
  if (!isRatio) columns.push({ key: 'other', label: mode === 'labor' ? '费用（万元）' : '投入（人月）', width: 150, numeric: true, value: row => row[metric.key as AmountKey]?.[mode === 'labor' ? 'cost' : 'labor'], render: row => formatCockpit(row[metric.key as AmountKey]?.[mode === 'labor' ? 'cost' : 'labor']) })
  const ratioFields: { key: AmountKey; label: string }[] = metric.key === 'deviation' ? [{ key: 'estimate', label: '项目概算' }, { key: 'budget', label: '项目预算' }] : metric.key === 'toDate' ? [{ key: 'actual', label: '项目核算' }, { key: 'cumulative', label: '累至今日预估投入' }] : metric.key === 'annualExecution' ? [{ key: 'actual', label: '项目核算' }, { key: 'budget', label: '项目预算' }] : []
  ratioFields.forEach(field => columns.push({ key: field.key, label: `${field.label}（${unit}）`, width: 180, numeric: true, value: row => row[field.key]?.[mode], render: row => formatCockpit(row[field.key]?.[mode]) }))
  return <Drawer open title={`${metric.label} · 来源明细`} onClose={onClose} width="min(980px, 100vw)" className="cockpit-detail-drawer">
    <div className="cockpit-detail-summary"><div><span>当前筛选范围</span><strong>{formatCockpit(valueOf(total))}<small>{isRatio ? '%' : unit}</small></strong></div><div><span>{dates[0]} 至 {dates[1]}</span><p>{projectRows.filter(row => valueOf(row) !== undefined).length} / {projectRows.length} 个项目有可用来源</p></div></div>
    <p className="cockpit-detail-rule">{metric.note}。{isRatio ? '总比例按汇总金额或人月重新计算，不平均下方项目百分比。' : '与项目空间使用同一份正式版本和核算数据，按当前日期及部门范围统计。'}核算只累计至今日，缺失来源显示“—”。</p>
    {isRatio && <div className="cockpit-detail-basis">{ratioFields.map(field => <span key={field.key}>{field.label}<b>{formatCockpit(total[field.key]?.[mode])} {unit}</b></span>)}</div>}
    <div className="cockpit-detail-toolbar"><Input aria-label="搜索指标来源项目" placeholder="搜索来源项目" prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} allowClear /><span>点击项目名称查看资源详情</span></div>
    <CockpitTable rows={rows} columns={columns} label="指标来源明细" />
    <p className="cockpit-detail-footnote">项目空间默认查看全周期；核对时请选择相同日期和部门。已绑定年度预算归入正式项目，不重复计数。搜索只筛选明细，不改变上方总值。</p>
  </Drawer>
}
