'use client'

import { useMemo, useRef } from 'react'
import { Segmented, Select, Tooltip } from 'antd'
import { ArrowRightOutlined, SearchOutlined } from '@ant-design/icons'
import { COCKPIT_CATEGORIES, formatCockpit, type CockpitFact, type CockpitMode } from '@/components/cockpit/cockpitData'
import { COCKPIT_RANKING_LIMIT, cockpitProjectRanking, type CockpitRankingCategory } from '@/components/cockpit/cockpitRankingData'
import { useCockpitMotion } from '@/components/cockpit/useCockpitMotion'

export default function CockpitProjectRanking({ facts, category, mode, onCategoryChange, onOpenProject, onLocateProject }: {
  facts: readonly CockpitFact[]; category: CockpitRankingCategory; mode: CockpitMode
  onCategoryChange: (category: CockpitRankingCategory) => void; onOpenProject: (id: string) => void; onLocateProject: (name?: string) => void
}) {
  const ranking = useMemo(() => cockpitProjectRanking(facts, 'actual', mode, category), [facts, category, mode])
  const panel = useRef<HTMLElement>(null)
  useCockpitMotion(panel, JSON.stringify([category, mode, ranking.rows.map(row => [row.key, row.value])]), 'ranking')
  const unit = mode === 'labor' ? '人月' : '万元'
  const share = (value?: number) => value === undefined ? '—' : `${formatCockpit(value)}%`
  const categories = [{ label: '全部项目', value: 'all' }, ...COCKPIT_CATEGORIES.map(item => ({ label: item.label, value: item.key }))]
  return <section ref={panel} className="cockpit-panel cockpit-ranking" aria-label="项目核算排行">
    <div className="cockpit-panel-header"><div><h2>项目核算排行 <small>{unit}</small></h2></div>
      <span className="cockpit-ranking-limit">TOP {COCKPIT_RANKING_LIMIT}</span>
    </div>
    <div className="cockpit-ranking-types"><div className="cockpit-ranking-segments"><Segmented aria-label="核算排行项目类型" value={category} onChange={value => onCategoryChange(value as CockpitRankingCategory)} options={categories} /></div>
      <Select className="cockpit-ranking-select" aria-label="核算排行项目类型" value={category} onChange={onCategoryChange} options={categories} />
    </div>
    <div className="cockpit-ranking-body">
      <div className="cockpit-ranking-summary">
        <div className="cockpit-ranking-coverage" role="status"><span>可用项目</span><strong>{ranking.covered}<small> / {ranking.projectCount}</small></strong></div>
        <div className="cockpit-ranking-total"><span>已知合计</span><b>{formatCockpit(ranking.total)} <small>{unit}</small></b></div>
        <div className="cockpit-ranking-concentration"><span>{ranking.topCount ? `前 ${ranking.topCount} 项占比` : '项目占比'}</span><b>{share(ranking.topShare)}</b></div>
        <button type="button" className="cockpit-text-button" onClick={() => onLocateProject()}>{category === 'all' ? '查看全部项目明细' : '查看该类型项目明细'} <ArrowRightOutlined /></button>
      </div>
      {ranking.rows.length ? <ol className="cockpit-ranking-list" aria-label="项目投入排名">{ranking.rows.slice(0, COCKPIT_RANKING_LIMIT).map((row, index) => <li key={row.key}>
        <span className="cockpit-rank-position">{index + 1}</span><div className="cockpit-rank-content">
          <div className="cockpit-rank-heading"><Tooltip title={row.name}><button type="button" className="cockpit-project-link" aria-label={`查看 ${row.name} 的项目资源`} onClick={() => onOpenProject(row.project!.id)}><span>{row.name}</span><ArrowRightOutlined /></button></Tooltip>
            <span className="cockpit-rank-value">{formatCockpit(row.value)} <small>{unit}</small></span>
          </div>
          <div className="cockpit-rank-track" role="img" aria-label={`${row.name} ${formatCockpit(row.value)} ${unit}，占已知合计 ${share(row.share)}`}>
            <i className={`cockpit-rank-bar${row.value < 0 ? ' is-negative' : ''}`} style={{ left: `${row.barStart}%`, width: `${row.barWidth}%` }} />{ranking.zero > 0 && ranking.zero < 100 && <i className="cockpit-rank-zero" style={{ left: `${ranking.zero}%` }} />}
          </div>

        </div><Tooltip title="在项目总览中定位"><button type="button" className="cockpit-rank-locate" aria-label={`在总览中定位 ${row.name}`} onClick={() => onLocateProject(row.name)}><SearchOutlined /><span>明细</span></button></Tooltip>
      </li>)}</ol> : <div className="cockpit-ranking-empty">当前类型暂无可用项目核算</div>}
    </div>

  </section>
}
