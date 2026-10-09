'use client'
import { useMemo } from 'react'
import CockpitEChart from '@/components/cockpit/CockpitEChart'
import { cockpitAllocationOption, cockpitColors } from '@/components/cockpit/cockpitChartOptions'
import { formatCockpit, type cockpitShares } from '@/components/cockpit/cockpitData'

export default function CockpitAllocation({ shares, onDetails }: { shares: ReturnType<typeof cockpitShares>; onDetails: () => void }) {
  const option = useMemo(() => cockpitAllocationOption(shares.rows), [shares.rows])
  return <div className="cockpit-allocation">
    <div className="cockpit-donut">
      <CockpitEChart option={option} label={`工时投入分布，合计 ${formatCockpit(shares.total)} 人天。${shares.rows.map(row => `${row.label} ${row.total === undefined ? '暂无数据' : `${formatCockpit(row.total)}%`}`).join('，')}`} />
      <div className="cockpit-donut-center"><strong>{shares.total ? formatCockpit(shares.total) : '—'}</strong><span>工时投入 · 人天</span></div>
    </div>
    <div className="cockpit-allocation-legend">{shares.rows.map((row, index) => <div key={row.key}><i style={{ background: cockpitColors[index % cockpitColors.length] }} /><span>{row.label}</span><strong>{row.total === undefined ? '—' : `${formatCockpit(row.total)}%`}</strong></div>)}</div>
    <button className="cockpit-text-button cockpit-allocation-details" onClick={onDetails}>月度明细 <span aria-hidden>↗</span></button>
  </div>
}
