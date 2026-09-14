'use client'

import { Input, Tooltip } from 'antd'
import { StopOutlined } from '@ant-design/icons'

export function HrReadonlyField({ value, label, reason = '此字段不可编辑', placeholder = '—' }: {
  value?: string | null; label: string; reason?: string; placeholder?: string
}) {
  return <Tooltip title={reason}>
    <Input className="pms-hr-readonly-field" aria-label={label} readOnly value={value ?? ''} placeholder={placeholder}
      suffix={<StopOutlined className="pms-hr-readonly-field__icon" aria-label="不可编辑" />} />
  </Tooltip>
}
