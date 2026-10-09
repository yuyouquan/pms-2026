'use client'

import { useMemo, useRef } from 'react'
import { Segmented, Tooltip } from 'antd'
import { ArrowRightOutlined, SearchOutlined } from '@ant-design/icons'
import { formatCockpit, type CockpitFact, type CockpitMode } from '@/components/cockpit/cockpitData'
import { cockpitProjectRanking } from '@/components/cockpit/cockpitRankingData'
import { useCockpitMotion } from '@/components/cockpit/useCockpitMotion'

export default function CockpitProjectRanking({ facts, metric, mode, onMetricChange, onOpenProject, onLocateProject }: {
  facts: readonly CockpitFact[]; metric: 'budget' | 'actual'; mode: CockpitMode
  onMetricChange: (metric: 'budget' | 'actual') => void; onOpenProject: (id: string) => void; onLocateProject: (name?: string) => void
}) {
  const ranking = useMemo(() => cockpitProjectRanking(facts, metric, mode), [facts, metric, mode])
  const panel = useRef<HTMLElement>(null)
  useCockpitMotion(panel, JSON.stringify([metric, mode, ranking.rows.map(row => [row.key, row.value])]), 'ranking')
  const label = metric === 'budget' ? '项目预算' : '项目核算', unit = mode === 'labor' ? '人月' : '万元'
  const share = (value?: number) => value === undefined ? '—' : `${formatCockpit(value)}%`
  return <section ref={panel} className="cockpit-panel cockpit-ranking" aria-label="项目投入排行">
    <div className="cockpit-panel-header"><div><h2>项目投入排行 <small>{unit}</small></h2></div>
      <Segmented aria-label="项目排行指标" value={metric} onChange={value => onMetricChange(value as 'budget' | 'actual')} options={[{ label: '项目核算', value: 'actual' }, { label: '项目预算', value: 'budget' }]} />
    </div>
    <div className="cockpit-ranking-body">
      <div className="cockpit-ranking-summary">
        <span>{ranking.topCount ? `前 ${ranking.topCount} 个项目占比` : '项目占比'}</span><strong>{share(ranking.topShare)}</strong>
        <div className="cockpit-ranking-total"><span>已知合计</span><b>{formatCockpit(ranking.total)} <small>{unit}</small></b></div>
        <span className="cockpit-ranking-coverage" role="status">{ranking.covered} / {ranking.projectCount} 个项目可用</span>
        <button type="button" className="cockpit-text-button" onClick={() => onLocateProject()}>查看全部项目明细 <ArrowRightOutlined /></button>
      </div>
      {ranking.rows.length ? <ol className="cockpit-ranking-list" aria-label="项目投入排名">{ranking.rows.slice(0, 5).map((row, index) => <li key={row.key}>
        <span className="cockpit-rank-position">{index + 1}</span><div className="cockpit-rank-content">
          <div className="cockpit-rank-heading"><Tooltip title={row.name}><button type="button" className="cockpit-project-link" aria-label={`查看 ${row.name} 的项目资源`} onClick={() => onOpenProject(row.project!.id)}><span>{row.name}</span><ArrowRightOutlined /></button></Tooltip>
            <span className="cockpit-rank-value">{formatCockpit(row.value)} <small>{unit}</small></span>
          </div>
          <div className="cockpit-rank-track" role="img" aria-label={`${row.name} ${formatCockpit(row.value)} ${unit}，占已知合计 ${share(row.share)}`}>
            <i className={`cockpit-rank-bar${row.value < 0 ? ' is-negative' : ''}`} style={{ left: `${row.barStart}%`, width: `${row.barWidth}%` }} /><i className="cockpit-rank-zero" style={{ left: `${ranking.zero}%` }} />
          </div>

        </div><Tooltip title="在项目总览中定位"><button type="button" className="cockpit-rank-locate" aria-label={`在总览中定位 ${row.name}`} onClick={() => onLocateProject(row.name)}><SearchOutlined /><span>明细</span></button></Tooltip>
      </li>)}</ol> : <div className="cockpit-ranking-empty">当前范围暂无可用{label}</div>}
    </div>

  </section>
}
