'use client'

import { Alert } from 'antd'

interface MonthlyAllocationNoticeProps {
  records: readonly { estimatedTotal: number; monthlyData: Record<string, number> }[]
}

export default function MonthlyAllocationNotice({ records }: MonthlyAllocationNoticeProps) {
  const remaining = Math.round(records.reduce((sum, record) => (
    sum + Math.max(0, record.estimatedTotal - Object.values(record.monthlyData).reduce((amount, value) => amount + value, 0))
  ), 0) * 10) / 10
  if (remaining < 0.1) return null
  return <Alert
    type="info"
    showIcon
    style={{ marginBottom: 12 }}
    title={`当前列表有 ${remaining} 人月待分配`}
    description="部分阶段缺少有效里程碑时间。请补充最新预估版本的里程碑；已绑定正式项目的，请完善并发布对应的主市场／主类型一级计划。待分配投入仍计入预估合计。"
  />
}
