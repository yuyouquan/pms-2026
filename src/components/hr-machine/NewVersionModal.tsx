'use client'

import { getHrAllowedBudgetTypes, isHrFormalRecord } from '@/lib/hrProjectRegistry'
import { useHrResourceScope } from '@/components/project-resources/HrResourceScope'
import { canCreateHrVersion, getHrVersionSeed, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'

import { useState, useEffect, useMemo } from 'react'
import { Modal, Select, InputNumber, Form, App, Tooltip, Tag } from 'antd'
import { useHrMachineStore } from '@/hooks/useHrResourceStores'
import { useHrConfigStore } from '@/stores/hrConfig'
import { BUDGET_TYPES } from '@/constants/hrMachine'
import { getConfigProjectLevels, getConfigModelVersions, calcEstimatedInvestment, getAvailableHrModelSelection, isHrModelAvailable } from '@/constants/hrConfig'
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
  const { message } = App.useApp()
  const scopeId = useHrResourceScope()
  const { projects, addVersion } = useHrMachineStore()
  const configData = useHrConfigStore(s => s.data)
  const [localProjectId, setLocalProjectId] = useState<string>(projectId)
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [projectLevel, setProjectLevel] = useState<string>('')
  const [levelCoefficient, setLevelCoefficient] = useState<number>(1)
  const [hrModelVersion, setHrModelVersion] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const project = useMemo(
    () => projects.find(p => p.id === localProjectId),
    [projects, localProjectId],
  )

  const hasIpm = useMemo(
    () => Boolean(project?.ipmProjectCode),
    [project],
  )

  const formalSource = hasIpm ? resolveHrFormalSource('machine', project?.ipmProjectCode ?? null, project?.pmsProjectId) : null
  const followsFormalPlan = isHrFormalRecord(project) && budgetType !== 'annual'
  const effectiveProjectLevel = followsFormalPlan
    ? formalSource?.project ? formalSource.projectLevel : project?.versions[project.versions.length - 1]?.projectLevel || project?.projectLevel || ''
    : projectLevel

  // 项目下拉选项
  const projectOptions = useMemo(
    () => projects.map(p => ({
      disabled: p.status !== 'active',
      value: p.id,
      label: `${p.name}（${p.brand} · ${p.productLine}）`,
    })),
    [projects],
  )

  // 从配置中心获取项目等级和模型版本号选项
  const hrModelRecords = useMemo(() => configData.hrModel ?? [], [configData.hrModel])
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
    if (!effectiveProjectLevel || !hrModelVersion) return 0
    return calcEstimatedInvestment(hrModelRecords, effectiveProjectLevel, hrModelVersion, levelCoefficient)
  }, [hrModelRecords, effectiveProjectLevel, hrModelVersion, levelCoefficient])

  useEffect(() => {
    if (open) {
      // 重置本地项目选择为传入的 projectId
      setLocalProjectId(scopeId ? projects.find(p => p.pmsProjectId === scopeId)?.id ?? '' : projectId || '')
      // 默认值：年度预算 + 配置中心第一个等级 + 系数1 + 第一个版本号
      const firstLevel = getConfigProjectLevels(useHrConfigStore.getState().data.hrModel ?? [])[0] ?? ''
      const firstVersion = getConfigModelVersions(useHrConfigStore.getState().data.hrModel ?? [])[0] ?? ''
      setBudgetType(getHrAllowedBudgetTypes(projects.find(p => scopeId ? p.pmsProjectId === scopeId : p.id === projectId))[0] ?? 'annual')
      setProjectLevel(firstLevel)
      setLevelCoefficient(1)
      setHrModelVersion(firstVersion)
    }
  }, [open, projectId])

  useEffect(() => {
    if (!open) return
    const selected = useHrMachineStore.getState().projects.find(p => p.id === localProjectId)
    const seed = selected ? getHrVersionSeed(selected.versions, budgetType) : undefined
    const records = useHrConfigStore.getState().data.hrModel ?? []
    const linkedSource = selected?.ipmProjectCode && budgetType !== 'annual'
      ? resolveHrFormalSource('machine', selected.ipmProjectCode, selected.pmsProjectId)
      : null
    const preferredLevel = linkedSource
      ? linkedSource.project ? linkedSource.projectLevel : selected?.versions[selected.versions.length - 1]?.projectLevel || selected?.projectLevel || ''
      : seed?.projectLevel ?? ''
    const available = getAvailableHrModelSelection(records, { projectLevel: preferredLevel, hrModelVersion: seed?.hrModelVersion ?? '' })
    setProjectLevel(available.projectLevel)
    setLevelCoefficient(seed?.levelCoefficient ?? 1)
    setHrModelVersion(available.hrModelVersion)
  }, [open, localProjectId, budgetType])

  const handleOk = async () => {
    if (project?.status === 'cancelled') { message.warning('已取消的项目不支持新建版本'); return }
    if (!localProjectId) {
      message.warning('请先选择项目')
      return
    }
    if ((!followsFormalPlan && !effectiveProjectLevel) || !hrModelVersion) {
      message.warning('请选择项目等级和人力模型版本号')
      return
    }
    if (!isHrModelAvailable(useHrConfigStore.getState().data.hrModel ?? [], effectiveProjectLevel, hrModelVersion)) {
      message.warning('该项目等级对应的人力模型不可用，请选择启用的模型版本')
      return
    }
    // 前端兜底校验：未绑定 IPM 时不允许创建需要 IPM 的版本
    if (!hasIpm && IPM_REQUIRED_TYPES.includes(budgetType)) {
      message.warning(IPM_REQUIRED_TIP)
      return
    }
    try {
      setSubmitting(true)
      addVersion(localProjectId, budgetType, { projectLevel: effectiveProjectLevel, levelCoefficient, hrModelVersion })
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
      okButtonProps={{ disabled: !canCreateHrVersion(project, budgetType) }}
      cancelText="取消"
      width={520}
    >
      <div style={{ marginTop: 16 }}>
        {/* 项目选择 + 信息 */}
        <div
          style={{
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--pms-brand-surface)',
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ color: 'var(--pms-text-tertiary)', whiteSpace: 'nowrap' }}>项目：</span>
            {scopeId ? <span>{project?.name}</span> : (<Select
              showSearch
              value={localProjectId || undefined}
              onChange={(v) => { setLocalProjectId(v); setBudgetType(getHrAllowedBudgetTypes(projects.find(p => p.id === v))[0] ?? 'annual') }}
              style={{ width: '100%' }}
              options={projectOptions}
              placeholder="请选择项目"
              optionFilterProp="label"
            />)}
          </div>
          {project && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--pms-text-tertiary)' }}>IPM：</span>
              {hasIpm ? (
                <span style={{ color: 'var(--pms-text-secondary)' }}>
                  <Tag color="green" style={{ marginRight: 6 }}>已绑定</Tag>
                  {project.ipmProjectCode}
                  {project.ipmProjectName ? ` · ${project.ipmProjectName}` : ''}
                </span>
              ) : (
                <span style={{ color: 'var(--pms-text-tertiary)' }}>
                  <Tag color="default" style={{ marginRight: 6 }}>未绑定</Tag>
                </span>
              )}
            </div>
          )}
        </div>

        {project && <div style={{ marginBottom: 12 }}>将创建版本：<strong>V0.{nextHrMinorVersion(project.versions, budgetType)}</strong></div>}

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

          <Form.Item label="项目等级" required={!followsFormalPlan} tooltip={followsFormalPlan ? '来源于正式项目基础信息' : '下拉值来自配置中心-人力模型'}>
            <Select
              value={effectiveProjectLevel || undefined}
              disabled={followsFormalPlan}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span>预估投入合计</span><strong>{estimatedPreview} 人月</strong>
        </div>
      </div>
    </Modal>
  )
}
