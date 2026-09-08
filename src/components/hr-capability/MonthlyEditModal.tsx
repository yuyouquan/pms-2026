'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal, Form, InputNumber, Alert, message } from 'antd'
import { useHrCapabilityStore } from '@/stores/hrCapability'
import { formatPersonMonth } from '@/constants/hrCapability'

interface MonthlyEditModalProps {
  open: boolean
  monthlyId: string | null
  onCancel: () => void
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}年${month}月`
}

export default function MonthlyEditModal({ open, monthlyId, onCancel }: MonthlyEditModalProps) {
  const monthlyInvestments = useHrCapabilityStore((s) => s.monthlyInvestments)
  const updateMonthlyInvestment = useHrCapabilityStore((s) => s.updateMonthlyInvestment)
  const setShowMonthlyEditModal = useHrCapabilityStore((s) => s.setShowMonthlyEditModal)

  const record = useMemo(
    () => monthlyInvestments.find((mi) => mi.id === monthlyId) ?? null,
    [monthlyInvestments, monthlyId],
  )

  const [editData, setEditData] = useState<Record<string, number>>({})

  useEffect(() => {
    if (open && record) {
      setEditData({ ...record.monthlyData })
    }
    if (!open) {
      setEditData({})
    }
  }, [open, record])

  const sortedMonths = useMemo(
    () => (record ? Object.keys(record.monthlyData).sort((a, b) => a.localeCompare(b)) : []),
    [record],
  )

  const editTotal = useMemo(
    () => Object.values(editData).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [editData],
  )

  const estimatedTotal = record?.estimatedTotal ?? 0
  const isMatch = Math.round(editTotal * 10) === Math.round(estimatedTotal * 10)

  const handleOk = () => {
    if (!record) return
    if (!isMatch) {
      message.error(`月度投入合计 ${formatPersonMonth(editTotal)} 与预估合计 ${formatPersonMonth(estimatedTotal)} 不一致`)
      return
    }
    updateMonthlyInvestment(record.id, editData)
    message.success('月度投入已更新')
    setShowMonthlyEditModal(false)
    onCancel()
  }

  const handleCancel = () => {
    setShowMonthlyEditModal(false)
    onCancel()
  }

  if (!record) return null

  return (
    <Modal
      className="pms-modal"
      title="编辑月度投入"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="保存"
      cancelText="取消"
      width={680}
    >
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            marginBottom: 12,
            display: 'flex',
            gap: 24,
            fontSize: 13,
            color: 'var(--pms-text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          <span>一级部门：<strong style={{ color: 'var(--pms-text-primary)' }}>{record.primaryDepartment}</strong></span>
          <span>二级部门：<strong style={{ color: 'var(--pms-text-primary)' }}>{record.secondaryDepartment}</strong></span>
          <span>预算类型：<strong style={{ color: 'var(--pms-text-primary)' }}>{record.budgetType === 'annual' ? '年度预算' : record.budgetType === 'projectEstimate' ? '项目概算' : '项目预算'}</strong></span>
        </div>

        <Alert
          type={isMatch ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 12 }}
          message={`月度合计：${formatPersonMonth(editTotal)} / 预估合计：${formatPersonMonth(estimatedTotal)} ${isMatch ? '（一致）' : '（不一致，请调整）'}`}
        />

        <Form layout="vertical">
          {sortedMonths.map((monthKey) => (
            <Form.Item key={monthKey} label={formatMonthLabel(monthKey)}>
              <InputNumber
                value={editData[monthKey] ?? 0}
                min={0}
                step={0.1}
                precision={1}
                style={{ width: 200 }}
                onChange={(v) => setEditData((prev) => ({ ...prev, [monthKey]: v ?? 0 }))}
              />
              <span style={{ marginLeft: 8, color: 'var(--pms-text-tertiary)', fontSize: 12 }}>
                人月
              </span>
            </Form.Item>
          ))}
        </Form>
      </div>
    </Modal>
  )
}
