'use client'

import { useMemo, useState } from 'react'
import { Drawer, Input } from 'antd'
import { ArrowRightOutlined, SearchOutlined } from '@ant-design/icons'
import CockpitTable, { type CockpitColumn } from '@/components/cockpit/CockpitTable'
import { formatCockpit, summarizeCockpit, type AmountKey, type CockpitFact, type CockpitInput, type CockpitMode, type CockpitRow } from '@/components/cockpit/cockpitData'
import { cockpitMetricAvailability, cockpitMetricDetail, cockpitMetricValue, cockpitRatioFields, type CockpitMetric, type CockpitSourceFilter } from '@/components/cockpit/cockpitMetricSources'
export type { CockpitMetric, CockpitMetricKey } from '@/components/cockpit/cockpitMetricSources'

export default function CockpitMetricDetail({ metric, facts, inputs, mode, dates, onClose, onOpenProject }: {
  metric: CockpitMetric; facts: readonly CockpitFact[]; inputs: readonly CockpitInput[]; mode: CockpitMode
  dates: [string, string]; onClose: () => void; onOpenProject: (id: string) => void
}) {
  const [search, setSearch] = useState(''), [sourceFilter, setSourceFilter] = useState<CockpitSourceFilter>('all')
  const inputByProject = useMemo(() => new Map(inputs.map(input => [input.project.id, input])), [inputs])
  const detail = useMemo(() => cockpitMetricDetail(facts, metric.key, mode, sourceFilter, search), [facts, metric.key, mode, sourceFilter, search])
  const ratioFields = cockpitRatioFields(metric.key), isRatio = ratioFields.length > 0
  const unit = mode === 'labor' ? '人月' : '万元'
  const valueOf = (row: CockpitRow) => cockpitMetricValue(row, metric.key, mode)
  const total: CockpitRow = { key: 'total', name: '当前范围合计', count: detail.count, ...summarizeCockpit(facts) }
  const coverage = detail.count ? Math.round(detail.available / detail.count * 100) : 0
  const sourceLabel = (row: CockpitRow) => {
    const input = row.project && inputByProject.get(row.project.id)
    if (!input) return '—'
    const sourceKeys = metric.key === 'annual' ? [0] : metric.key === 'estimate' ? [1] : metric.key === 'budget' || metric.key === 'annualExecution' ? [2] : metric.key === 'deviation' ? [1, 2] : metric.key === 'actual' ? [] : [input.sources[2] ? 2 : input.sources[1] ? 1 : 0]
    const labels = sourceKeys.map(index => `${['年度预算', '项目概算', '项目预算'][index]} ${input.sources[index]?.version.versionNumber ?? '无正式版本'}`)
    if (['actual', 'toDate', 'annualExecution'].includes(metric.key)) labels.push(input.dataset ? '项目工时核算台账' : '无核算台账')
    return labels.join(' · ')
  }
  const columns: CockpitColumn<CockpitRow>[] = [
    { key: 'name', label: '项目名称', width: 245, value: row => row.name, render: row => row.project ? <button className="cockpit-project-link" title={`查看 ${row.name} 的项目资源`} onClick={() => onOpenProject(row.project!.id)}><span>{row.name}</span><ArrowRightOutlined /></button> : <span>{row.name}</span> },
    { key: 'source', label: '项目空间来源', width: 310, render: row => {
      if (!row.project) return '—'
      const status = cockpitMetricAvailability(row, metric.key, mode, inputByProject.get(row.project.id))
      return <div className="cockpit-source-cell"><span title={sourceLabel(row)}>{sourceLabel(row)}</span><div><span className={`cockpit-source-status${status.available ? ' is-available' : ''}`}>{status.available ? '可用' : '无可用值'}</span>{!status.available && <span title={status.reason}>{status.reason}</span>}</div></div>
    } },
    { key: 'value', label: `${metric.label}（${isRatio ? '%' : unit}）`, width: 195, numeric: true, value: valueOf, render: row => formatCockpit(valueOf(row)) },
  ]
  if (!isRatio) columns.push({ key: 'other', label: mode === 'labor' ? '费用（万元）' : '投入（人月）', width: 150, numeric: true, value: row => row[metric.key as AmountKey]?.[mode === 'labor' ? 'cost' : 'labor'], render: row => formatCockpit(row[metric.key as AmountKey]?.[mode === 'labor' ? 'cost' : 'labor']) })
  ratioFields.forEach(field => columns.push({ key: field.key, label: `${field.label}（${unit}）`, width: 180, numeric: true, value: row => row[field.key]?.[mode], render: row => formatCockpit(row[field.key]?.[mode]) }))
  const clearDetailFilters = () => { setSearch(''); setSourceFilter('all') }
  const filtered = sourceFilter !== 'all' || !!search.trim()
  return <Drawer getContainer={false} open title={`${metric.label} · 来源明细`} onClose={onClose} size="min(980px, 100vw)" className="cockpit-detail-drawer">
    <div className="cockpit-detail-summary"><div><span>当前筛选范围</span><strong>{formatCockpit(valueOf(total))}<small>{isRatio ? '%' : unit}</small></strong></div><div><span>{dates[0]} 至 {dates[1]}</span><p>{detail.available} / {detail.count} 个项目有可用值</p></div></div>
    <p className="cockpit-detail-rule">{metric.note}。{isRatio ? '总比例按汇总金额或人月重新计算，不平均下方项目百分比。' : '与项目空间使用同一份正式版本和核算数据，按当前日期及部门范围统计。'}核算只累计至今日，缺失来源显示“—”。</p>
    {isRatio && <div className="cockpit-detail-basis">{ratioFields.map(field => <span key={field.key}>{field.label}<b>{formatCockpit(total[field.key]?.[mode])} {unit}</b></span>)}</div>}
    <section className="cockpit-source-coverage" aria-label="指标来源覆盖">
      <div><span>当前范围可用比例</span><strong>{detail.count ? `${coverage}%` : '—'}</strong></div>
      <div className="cockpit-coverage-track" role="progressbar" aria-label="有可用值的项目比例" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage} aria-valuetext={`${detail.available} / ${detail.count} 个项目有可用值`}><i style={{ width: `${coverage}%` }} /></div>
      <p>仅检查当前日期、部门和单位；无可用值可能是未设正式版本或所选范围没有对应投入，并不代表数据错误。</p>
      <div className="cockpit-source-filters" role="group" aria-label="指标来源筛选">
        {([{ key: 'all', label: '全部', count: detail.count }, { key: 'available', label: '可用', count: detail.available }, { key: 'unavailable', label: '无可用值', count: detail.unavailable }] as const).map(item => <button key={item.key} type="button" aria-pressed={sourceFilter === item.key} onClick={() => setSourceFilter(item.key)}>{item.label}<b>{item.count}</b></button>)}
      </div>
    </section>
    <div className="cockpit-detail-toolbar"><Input aria-label="搜索指标来源项目" placeholder="搜索来源项目" prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} allowClear /></div>
    <div className="cockpit-source-results" role="status"><span>匹配 <b>{detail.rows.length}</b> / {detail.count} 个项目</span>{filtered ? <button type="button" className="cockpit-text-button" onClick={clearDetailFilters}>清除来源筛选</button> : null}</div>
    <CockpitTable rows={detail.rows} columns={columns} label="指标来源明细" footer={detail.total} />
    <p className="cockpit-detail-footnote">项目空间默认查看全周期；核对时请选择相同日期和部门。已绑定年度预算归入正式项目，不重复计数。来源筛选与搜索只改变明细及表尾的匹配合计，不改变上方总值。</p>
  </Drawer>
}
