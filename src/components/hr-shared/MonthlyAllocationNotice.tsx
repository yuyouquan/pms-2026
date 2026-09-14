'use client'

import { Alert } from 'antd'

interface MonthlyAllocationNoticeProps {
  records: readonly { estimatedTotal: number; monthlyData: Record<string, number>; projectName?: string; secondaryDepartment?: string; versionNumber?: string }[]
}

export default function MonthlyAllocationNotice({ records }: MonthlyAllocationNoticeProps) {
  const balances = records.map(record => ({ record, difference: Math.round((record.estimatedTotal
    - Object.values(record.monthlyData).reduce((amount, value) => amount + value, 0)) * 10) / 10 }))
  const remaining = Math.round(balances.reduce((sum, item) => sum + Math.max(0, item.difference), 0) * 10) / 10
  const exceeded = balances.filter(item => item.difference < 0)
  const excess = Math.round(exceeded.reduce((sum, item) => sum - item.difference, 0) * 10) / 10
  if (remaining < 0.1 && excess < 0.1) return null
  const affected = exceeded.slice(0, 3).map(({ record }) => [record.projectName, record.versionNumber, record.secondaryDepartment].filter(Boolean).join(' / ')).filter(Boolean).join('；')
  return <Alert
    type={excess > 0 ? 'warning' : 'info'}
    showIcon
    style={{ marginBottom: 12 }}
    title={excess > 0 ? `当前列表 ${exceeded.length} 条记录的月度分配超出预估 ${excess} 人月${remaining > 0 ? `，另有 ${remaining} 人月待分配` : ''}` : `当前列表有 ${remaining} 人月待分配`}
    description={excess > 0
      ? `${affected ? `${affected}${exceeded.length > 3 ? '等' : ''}。` : ''}预估投入调整后保留了原手工分配。请点击对应记录调整各月投入，使月度合计与预估一致；当前月度汇总仍包含这些待调整数值。`
      : '请检查最新版本的里程碑、起止日期和手工月度分配。正式项目的计划节点取自已发布一级计划；整机上市结束、生命周期结束、tOS上市迭代结束、维护结束及能力建设起止日期需在资源版本中手工维护。预算项目的日期始终独立维护。待分配投入仍计入预估合计。'}
  />
}
