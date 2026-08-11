'use client'

import { useState, useEffect } from 'react'
import { Modal, Select, message } from 'antd'
import { useHrMachineStore } from '@/stores/hrMachine'
import { BUDGET_TYPES, BUDGET_TYPE_LABELS } from '@/constants/hrMachine'
import type { BudgetType } from '@/types/hrMachine'

interface NewVersionModalProps {
  open: boolean
  projectId: string
  onCancel: () => void
}

export default function NewVersionModal({ open, projectId, onCancel }: NewVersionModalProps) {
  const { addVersion } = useHrMachineStore()
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setBudgetType('annual')
    }
  }, [open])

  const handleOk = async () => {
    if (!projectId) return
    try {
      setSubmitting(true)
      addVersion(projectId, budgetType)
      message.success('版本创建成功')
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      className="pms-modal"
      title="新增版本"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText="创建"
      cancelText="取消"
      width={420}
    >
      <div style={{ marginTop: 16 }}>
        <p style={{ marginBottom: 8, color: 'var(--pms-text-secondary)', fontSize: 13 }}>
          选择预算类型以创建新版本：
        </p>
        <Select
          value={budgetType}
          onChange={(v) => setBudgetType(v)}
          style={{ width: '100%' }}
          options={BUDGET_TYPES.map(bt => ({
            value: bt.value,
            label: bt.label,
          }))}
        />
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--pms-brand-surface)', borderRadius: 8, fontSize: 12, color: 'var(--pms-text-tertiary)' }}>
          <p style={{ margin: 0, fontWeight: 500, color: 'var(--pms-text-secondary)' }}>
            版本号规则：
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, lineHeight: '1.8' }}>
            <li>首行 V0.1，新增递增 V0.X</li>
            <li>点击锁定后，版本号变为 V1.0</li>
            <li>继续新增则从 V1.1 开始，至 V1.X</li>
            <li>第二次锁定后变为 V2.0，以此类推</li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}
