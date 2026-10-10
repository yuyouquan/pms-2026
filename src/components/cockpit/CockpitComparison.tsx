'use client'
import { useMemo } from 'react'
import CockpitEChart from '@/components/cockpit/CockpitEChart'
import { cockpitComparisonOption } from '@/components/cockpit/cockpitChartOptions'
import { cockpitOverview, formatCockpit, type CockpitFact, type CockpitMode } from '@/components/cockpit/cockpitData'
import { RESOURCE_CHART_COLORS } from '@/theme/resourceChartTheme'

export default function CockpitComparison({ facts, mode, onDetails }: { facts: readonly CockpitFact[]; mode: CockpitMode; onDetails: () => void }) {
  const rows = useMemo(() => cockpitOverview(facts, 'category', mode), [facts, mode])
  const option = useMemo(() => cockpitComparisonOption(rows, mode), [rows, mode])
  const unit = mode === 'labor' ? '人月' : '万元'
  return <section className="cockpit-panel cockpit-comparison" aria-label="分类投入对比">
    <div className="cockpit-panel-header"><h2>分类投入对比 <small>{unit}</small></h2><button className="cockpit-text-button" onClick={onDetails}>明细 <span aria-hidden>↗</span></button></div>
    <div className="cockpit-comparison-legend"><span><i style={{ background: RESOURCE_CHART_COLORS.budget }} />项目预算</span><span><i style={{ background: RESOURCE_CHART_COLORS.actual }} />项目核算</span></div>
    <CockpitEChart option={option} label={`分类投入对比，${unit}。${rows.map(row => `${row.name} 预算 ${formatCockpit(row.budget?.[mode])} 核算 ${formatCockpit(row.actual?.[mode])}`).join('，')}`} />
  </section>
}
