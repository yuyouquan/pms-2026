'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal, Select, InputNumber, Form, message, Tooltip, Tag, Alert } from 'antd'
import { useHrMachineStore } from '@/stores/hrMachine'
import { useHrConfigStore } from '@/stores/hrConfig'
import { BUDGET_TYPES } from '@/constants/hrMachine'
import { getConfigProjectLevels, getConfigModelVersions, calcEstimatedInvestment } from '@/constants/hrConfig'
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
  const configData = useHrConfigStore(s => s.data)
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [projectLevel, setProjectLevel] = useState<string>('')
  const [levelCoefficient, setLevelCoefficient] = useState<number>(1)
  const [hrModelVersion, setHrModelVersion] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const project = useMemo(
    () => projects.find(p => p.id === projectId),
    [projects, projectId],
  )

  const hasIpm = useMemo(
    () => Boolean(project?.ipmProjectCode),
    [project],
  )

  // 从配置中心获取项目等级和模型版本号选项
  const hrModelRecords = configData.hrModel ?? []
  const projectLevelOptions = useMemo(
    () => getConfigProjectLevels(hrModelRecords).map(l => ({ value: l, label: l })),
    [hrModelRecords],
  )
  const hrModelVersionOptions = useMemo(
    () => getConfigModelVersions(hrModelRecords).map(v => ({ value: v, label: v })),
    [hrModelRecords],
  )

  // 预估投入预览
  const estimatedPreview = useMemo(() => {
    if (!projectLevel || !hrModelVersion) return 0
    return calcEstimatedInvestment(hrModelRecords, projectLevel, hrModelVersion, levelCoefficient)
  }, [hrModelRecords, projectLevel, hrModelVersion, levelCoefficient])

  useEffect(() => {
    if (open) {
      // 默认值：年度预算 + 配置中心第一个等级 + 系数1 + 第一个版本号
      const firstLevel = getConfigProjectLevels(hrModelRecords)[0] ?? ''
      const firstVersion = getConfigModelVersions(hrModelRecords)[0] ?? ''
      setBudgetType('annual')
      setProjectLevel(firstLevel)
      setLevelCoefficient(1)
      setHrModelVersion(firstVersion)
    }
  }, [open, hrModelRecords])

  const handleOk = async () => {
    if (!projectId) return
    if (!projectLevel || !hrModelVersion) {
      message.warning('请选择项目等级和人力模型版本号')
      return
    }
    // 前端兜底校验：未绑定 IPM 时不允许创建需要 IPM 的版本
    if (!hasIpm && IPM_REQUIRED_TYPES.includes(budgetType)) {
      message.warning(IPM_REQUIRED_TIP)
      return
    }
    try {
      setSubmitting(true)
      addVersion(projectId, budgetType, { projectLevel, levelCoefficient, hrModelVersion })
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
      width={520}
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

        {/* 表单字段 */}
        <Form layout="vertical">
          <Form.Item label="预算类型" required>
            <Select
              value={budgetType}
              onChange={(v) => setBudgetType(v)}
              style={{ width: '100%' }}
              options={budgetOptions}
            />
          </Form.Item>

          <Form.Item label="项目等级" required tooltip="下拉值来自配置中心-人力模型">
            <Select
              value={projectLevel || undefined}
              onChange={(v) => setProjectLevel(v)}
              style={{ width: '100%' }}
              options={projectLevelOptions}
              placeholder="请选择项目等级"
            />
          </Form.Item>

          <Form.Item label="等级系数" required>
            <InputNumber
              value={levelCoefficient}
              onChange={(v) => setLevelCoefficient(v ?? 1)}
              min={0}
              step={0.1}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入等级系数"
            />
          </Form.Item>

          <Form.Item label="人力模型版本号" required tooltip="下拉值来自配置中心-人力模型">
            <Select
              value={hrModelVersion || undefined}
              onChange={(v) => setHrModelVersion(v)}
              style={{ width: '100%' }}
              options={hrModelVersionOptions}
              placeholder="请选择人力模型版本号"
            />
          </Form.Item>
        </Form>

        {/* 预估投入预览 */}
        {projectLevel && hrModelVersion && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12, borderRadius: 8 }}
            message={`预估投入 = 模型综合 × 等级系数 = ${estimatedPreview} 人月`}
            description="预估投入根据配置中心人力模型数据自动计算"
          />
        )}

        {/* 版本规则说明 */}
        <div
          style={{
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
