'use client'

import { CloseOutlined, FilterOutlined } from '@ant-design/icons'
import type { CockpitScope } from '@/components/cockpit/cockpitData'

export default function CockpitFiltersSummary({ dates, defaultDates, scope, explicitScope, departments, onResetDates, onResetScope, onRemoveDepartment }: {
  dates: [string, string]; defaultDates: [string, string]; scope: CockpitScope; explicitScope: boolean; departments: string[]
  onResetDates: () => void; onResetScope: () => void; onRemoveDepartment: (department: string) => void
}) {
  const customDates = dates[0] !== defaultDates[0] || dates[1] !== defaultDates[1]
  const scopeLabel = scope === 'software' ? '软件工程部' : '全研发'
  return <section className="cockpit-filter-summary" aria-label="当前全局筛选">
    <span className="cockpit-filter-summary-label"><FilterOutlined /> 当前范围</span>
    {customDates ? <button className="cockpit-filter-chip" aria-label="清除日期筛选，恢复本年度" onClick={onResetDates}><span>{dates[0]} — {dates[1]}</span><CloseOutlined /></button> : <span className="cockpit-filter-chip is-default">{dates[0].slice(0, 4)} 全年</span>}
    {explicitScope ? <button className="cockpit-filter-chip" aria-label="清除部门范围筛选，使用默认范围" onClick={onResetScope}><span>{scopeLabel}</span><CloseOutlined /></button> : <span className="cockpit-filter-chip is-default">{scopeLabel}</span>}
    {departments.map(department => <button className="cockpit-filter-chip" key={department} aria-label={`移除二级部门筛选 ${department}`} onClick={() => onRemoveDepartment(department)}><span>{department}</span><CloseOutlined /></button>)}
    {!departments.length && <span className="cockpit-filter-summary-all">全部二级部门</span>}
    <span className="cockpit-context-memory">本次会话保留你的筛选与视图</span>
  </section>
}
