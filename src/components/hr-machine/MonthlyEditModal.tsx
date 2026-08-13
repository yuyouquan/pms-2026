'use client'

import { useEffect, useState, useMemo } from 'react'
import { Modal, InputNumber, message, Alert } from 'antd'
import { useHrMachineStore } from '@/stores/hrMachine'
import { formatPersonMonth, BUDGET_TYPE_LABELS } from '@/constants/hrMachine'

interface MonthlyEditModalProps {
  open: boolean
  monthlyId: string | null
  onCancel: () => void
}

export default function MonthlyEditModal({ open, monthlyId, onCancel }: MonthlyEditModalProps) {
  const { monthlyInvestments, projects, updateMonthlyInvestment } = useHrMachineStore()
  const [editData, setEditData] = useState<Record<string, number>>({})

  const investment = useMemo(
    () => monthlyInvestments.find(mi => mi.id === monthlyId),
    [monthlyInvestments, monthlyInvestments],
  )

  const project = useMemo(
    () => projects.find(p => p.id === investment?.projectId),
    [investment, projects],
  )

  useEffect(() => {
    if (investment && open) {
      setEditData({ ...investment.monthlyData })
    }
  }, [investment, open])

  const months = useMemo(() => {
    if (!investment) return []
    return Object.keys(investment.monthlyData).sort()
  }, [investment])

  const editTotal = useMemo(() => {
    return Object.values(editData).reduce((sum, v) => sum + (v || 0), 0)
  }, [editData])

  const estimatedTotal = investment?.estimatedTotal ?? 0
  const isMatch = Math.abs(editTotal - estimatedTotal) < 0.01

  const handleOk = () => {
    if (!isMatch) {
      message.error(`月度合计 ${formatPersonMonth(editTotal)} 与预估合计 ${formatPersonMonth(estimatedTotal)} 不一致，不允许保存`)
      return
    }
    if (monthlyId) {
      updateMonthlyInvestment(monthlyId, editData)
      message.success('月度投入已更新')
    }
  }

  if (!investment) return null

  return (
    <Modal
      className="pms-modal"
      title="编辑月度预估投入"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ disabled: !isMatch }}
      width={Math.max(640, months.length * 100 + 200)}
    >
      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12, display: 'flex', gap: 24, fontSize: 13, color: 'var(--pms-text-secondary)', flexWrap: 'wrap' }}>
          <span>项目名称：<strong style={{ color: 'var(--pms-text-primary)' }}>{project?.name || '-'}</strong></span>
          <span>预算类型：<strong style={{ color: 'var(--pms-text-primary)' }}>{BUDGET_TYPE_LABELS[investment.budgetType]}</strong></span>
          <span>版本号：<strong style={{ color: 'var(--pms-text-primary)' }}>{investment.versionNumber}</strong></span>
          <span>一级部门：<strong style={{ color: 'var(--pms-text-primary)' }}>{investment.primaryDepartment || '-'}</strong></span>
          <span>二级部门：<strong style={{ color: 'var(--pms-text-primary)' }}>{investment.secondaryDepartment || '-'}</strong></span>
        </div>

        <Alert
          type={isMatch ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            isMatch
              ? `月度合计 ${formatPersonMonth(editTotal)} 与预估合计 ${formatPersonMonth(estimatedTotal)} 一致`
              : `月度合计 ${formatPersonMonth(editTotal)} 与预估合计 ${formatPersonMonth(estimatedTotal)} 不一致，不允许保存`
          }
        />

        <div style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 8 }}>
          {months.map(month => {
            const value = editData[month] ?? 0
            const year = month.split('-')[0]
            const mon = month.split('-')[1]
            return (
              <div key={month} style={{ minWidth: 100, flex: '0 0 auto' }}>
                <label style={{
                  display: 'block',
                  marginBottom: 4,
                  fontSize: 12,
                  color: 'var(--pms-text-tertiary)',
                  textAlign: 'center',
                }}>
                  {year}年{mon}月
                </label>
                <InputNumber
                  value={value}
                  min={0}
                  step={0.1}
                  precision={1}
                  style={{ width: '100%' }}
                  onChange={(v) => setEditData(prev => ({
                    ...prev,
                    [month]: v || 0,
                  }))}
                />
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 16, padding: '8px 12px', background: 'var(--pms-brand-surface)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--pms-text-secondary)' }}>月度投入横向展示，仅可编辑月度预估投入</span>
            <span>
              <span style={{ color: 'var(--pms-text-tertiary)' }}>合计：</span>
              <strong style={{
                color: isMatch ? 'var(--pms-brand-strong)' : '#faad14',
                fontSize: 14,
              }}>
                {formatPersonMonth(editTotal)}
              </strong>
              <span style={{ color: 'var(--pms-text-tertiary)', margin: '0 4px' }}>/</span>
              <span style={{ color: 'var(--pms-text-secondary)' }}>{formatPersonMonth(estimatedTotal)}</span>
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
