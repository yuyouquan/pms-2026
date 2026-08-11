'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal, Select, message, Tooltip, Tag } from 'antd'
import { useHrMachineStore } from '@/stores/hrMachine'
import { BUDGET_TYPES } from '@/constants/hrMachine'
import type { BudgetType } from '@/types/hrMachine'

interface NewVersionModalProps {
  open: boolean
  projectId: string
  onCancel: () => void
}

/** 需要先绑定 IPM 正式项目编码才能创建的预算类型 */
const IPM_REQUIRED_TYPES: BudgetType[] = ['projectEstimate', 'projectBudget']

/** 未绑定 IPM 时的提示文案 */
const IPM_REQUIRED_TIP = '需要先绑定正式项目编码才能创建此类型版本'

export default function NewVersionModal({ open, projectId, onCancel }: NewVersionModalProps) {
  const { projects, addVersion } = useHrMachineStore()
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [submitting, setSubmitting] = useState(false)

  const project = useMemo(
    () => projects.find(p => p.id === projectId),
    [projects, projectId],
  )

  const hasIpm = useMemo(
    () => Boolean(project?.ipmProjectCode),
    [project],
  )

  useEffect(() => {
    if (open) {
      // 年度预算始终可选，作为默认值
      setBudgetType('annual')
    }
  }, [open])

  const handleOk = async () => {
    if (!projectId) return
    // 前端兜底校验：未绑定 IPM 时不允许创建需要 IPM 的版本
    if (!hasIpm && IPM_REQUIRED_TYPES.includes(budgetType)) {
      message.warning(IPM_REQUIRED_TIP)
      return
    }
    try {
      setSubmitting(true)
      addVersion(projectId, budgetType)
      message.success('版本创建成功')
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  const budgetOptions = BUDGET_TYPES.map(bt => {
    const restricted = !hasIpm && IPM_REQUIRED_TYPES.includes(bt.value)
    return {
      value: bt.value,
      label: restricted ? (
        <Tooltip title={IPM_REQUIRED_TIP}>
          <span style={{ color: 'var(--pms-text-tertiary)' }}>{bt.label}</span>
        </Tooltip>
      ) : (
        bt.label
      ),
      disabled: restricted,
    }
  })

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
      width={460}
    >
      <div style={{ marginTop: 16 }}>
        {/* 项目信息 */}
        <div
          style={{
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--pms-brand-surface)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--pms-text-tertiary)' }}>项目：</span>
            <span style={{ color: 'var(--pms-text-primary)', fontWeight: 600 }}>
              {project?.name ?? '-'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--pms-text-tertiary)' }}>IPM：</span>
            {hasIpm ? (
              <span style={{ color: 'var(--pms-text-secondary)' }}>
                <Tag color="green" style={{ marginRight: 6 }}>已绑定</Tag>
                {project?.ipmProjectCode}
                {project?.ipmProjectName ? ` · ${project.ipmProjectName}` : ''}
              </span>
            ) : (
              <span style={{ color: 'var(--pms-text-tertiary)' }}>
                <Tag color="default" style={{ marginRight: 6 }}>未绑定</Tag>
                仅可创建年度预算版本
              </span>
            )}
          </div>
        </div>

        {/* 预算类型选择 */}
        <p style={{ marginBottom: 8, color: 'var(--pms-text-secondary)', fontSize: 13 }}>
          选择预算类型以创建新版本：
        </p>
        <Select
          value={budgetType}
          onChange={(v) => setBudgetType(v)}
          style={{ width: '100%' }}
          options={budgetOptions}
        />

        {/* 版本规则说明 */}
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'var(--pms-brand-surface)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--pms-text-tertiary)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500, color: 'var(--pms-text-secondary)' }}>
            版本规则：
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, lineHeight: '1.8' }}>
            <li>首行 V0.1，新增递增 V0.2、V0.3…</li>
            <li>锁定后版本号不变，仅状态变为已锁定</li>
            <li>仅最新版本支持锁定操作</li>
            <li>里程碑节点自动带出，可独立修改</li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}
