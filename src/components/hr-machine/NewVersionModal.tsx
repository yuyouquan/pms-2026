'use client'

import { useEffect, useMemo, useState } from 'react'
import { App, Form, Input, InputNumber, Modal, Select, Table, Alert } from 'antd'
import { useHrResourceScope } from '@/components/project-resources/HrResourceScope'
import { HrVersionMilestoneFields, useHrVersionMilestones } from '@/components/project-resources/HrVersionMilestones'
import { useHrMachineStore } from '@/hooks/useHrResourceStores'
import { useHrConfigStore } from '@/stores/hrConfig'
import { canAccessHrProject, getHrAllowedBudgetTypes, getHrRegistryProject, isHrFormalRecord, resolveHrNewVersionProjectId } from '@/lib/hrProjectRegistry'
import { canCreateHrVersion, getHrVersionSeed, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'
import { PRODUCT_LINES_BY_BRAND } from '@/lib/roadmapValidation'
import { BUDGET_TYPES } from '@/constants/hrMachine'
import { calcMachineDepartmentInvestments, getAvailableHrModelSelection, getConfigProjectLevels, getConfigModelVersions, HR_MODEL_PHASE_FIELDS } from '@/constants/hrConfig'
import type { BudgetType } from '@/types/hrMachine'

export default function NewVersionModal({ open, projectId, onCancel }: { open: boolean; projectId: string; onCancel: () => void }) {
  const { message } = App.useApp()
  const scopeId = useHrResourceScope()
  const { projects, addVersion } = useHrMachineStore()
  const records = useHrConfigStore(state => state.data.hrModel ?? [])
  const [localProjectId, setLocalProjectId] = useState(projectId)
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [projectLevel, setProjectLevel] = useState('')
  const [levelCoefficient, setLevelCoefficient] = useState(1)
  const [hrModelVersion, setHrModelVersion] = useState('')
  const [metadata, setMetadata] = useState({ brand: '', productLine: '', marketName: '' })
  const project = projects.find(item => item.id === localProjectId)
  const formal = isHrFormalRecord(project)
  const bound = Boolean(getHrRegistryProject(project)?.boundFormalProjectId)
  const metadataReadOnly = formal || bound
  const effectiveMetadata = metadataReadOnly ? { brand: project?.brand ?? '', productLine: project?.productLine ?? '', marketName: project?.marketName ?? '' } : metadata
  const effectiveProjectLevel = formal ? resolveHrFormalSource('machine', project?.ipmProjectCode ?? null, project?.pmsProjectId).projectLevel : projectLevel
  const milestoneForm = useHrVersionMilestones('machine', project, budgetType, open)

  useEffect(() => {
    if (!open) return
    const id = resolveHrNewVersionProjectId(projects, projectId, scopeId)
    setLocalProjectId(id)
    setBudgetType(getHrAllowedBudgetTypes(projects.find(item => item.id === id))[0] ?? 'annual')
  }, [open, projectId, scopeId])
  useEffect(() => {
    if (!open) return
    const seed = project ? getHrVersionSeed(project.versions, budgetType) : undefined
    const sourceLevel = isHrFormalRecord(project) ? resolveHrFormalSource('machine', project?.ipmProjectCode ?? null, project?.pmsProjectId).projectLevel : seed?.projectLevel ?? ''
    const selection = getAvailableHrModelSelection(records, { projectLevel: sourceLevel, hrModelVersion: seed?.hrModelVersion ?? '' })
    setProjectLevel(selection.projectLevel)
    setHrModelVersion(selection.hrModelVersion)
    setLevelCoefficient(seed?.levelCoefficient ?? 1)
    setMetadata({ brand: project?.brand ?? '', productLine: project?.productLine ?? '', marketName: project?.marketName ?? '' })
  }, [open, localProjectId, budgetType])

  const departments = useMemo(() => calcMachineDepartmentInvestments(records, effectiveProjectLevel, hrModelVersion, levelCoefficient), [records, effectiveProjectLevel, hrModelVersion, levelCoefficient])
  const total = Math.round(departments.reduce((sum, row) => sum + row.estimatedTotal, 0) * 10) / 10
  const columns = [
    { title: '一级部门', dataIndex: 'primaryDepartment', width: 140 },
    { title: '二级部门', dataIndex: 'secondaryDepartment', width: 140 },
    ...HR_MODEL_PHASE_FIELDS.map(field => ({ title: field.label, key: field.key, width: 120, render: (_: unknown, row: typeof departments[number]) => row.phases[field.key] })),
    { title: '预估投入合计', dataIndex: 'estimatedTotal', width: 130 },
  ]
  const budgetOptions = BUDGET_TYPES.filter(type => getHrAllowedBudgetTypes(project).includes(type.value))
  const productLines = PRODUCT_LINES_BY_BRAND[metadata.brand as keyof typeof PRODUCT_LINES_BY_BRAND] ?? []
  const handleOk = () => {
    try {
      addVersion(localProjectId, budgetType, { projectLevel: effectiveProjectLevel, levelCoefficient, hrModelVersion, milestones: milestoneForm.values, metadata: effectiveMetadata })
      message.success('版本创建成功')
      onCancel()
    } catch (error) { message.warning(error instanceof Error ? error.message : '版本创建失败') }
  }

  return <Modal className="pms-modal" title="新增版本" open={open} onCancel={onCancel} onOk={handleOk} okText="创建" cancelText="取消" width={1280} okButtonProps={{ disabled: !canCreateHrVersion(project, budgetType) }}>
    <Form layout="vertical" className="pms-hr-version-form" style={{ marginTop: 16 }}>
      <Form.Item label="项目">{scopeId ? <Input value={project?.name ?? ''} readOnly /> : <Select showSearch aria-label="选择项目" value={localProjectId || undefined} optionFilterProp="label" options={projects.filter(item => canAccessHrProject(item, true) && getHrAllowedBudgetTypes(item).length > 0).map(item => ({ value: item.id, label: item.name, disabled: item.status !== 'active' }))} onChange={id => { setLocalProjectId(id); setBudgetType(getHrAllowedBudgetTypes(projects.find(item => item.id === id))[0] ?? 'annual') }} />}</Form.Item>
      <Form.Item label="预算类型" required><Select value={budgetType} options={budgetOptions} onChange={setBudgetType} /></Form.Item>
      <Form.Item label="将创建版本"><Input readOnly value={project ? `V0.${nextHrMinorVersion(project.versions, budgetType)}` : ''} /></Form.Item>
      <Form.Item label="品牌" required={!formal}>{metadataReadOnly ? <Input readOnly value={effectiveMetadata.brand} placeholder="请在正式项目空间补充" /> : <Select aria-label="品牌" value={metadata.brand || undefined} options={[...new Set([...Object.keys(PRODUCT_LINES_BY_BRAND), ...(metadata.brand ? [metadata.brand] : [])])].map(value => ({ value, label: value }))} onChange={brand => setMetadata(previous => ({ ...previous, brand, productLine: '' }))} />}</Form.Item>
      <Form.Item label="产品线" required={!formal}>{metadataReadOnly ? <Input readOnly value={effectiveMetadata.productLine} placeholder="请在正式项目空间补充" /> : <Select aria-label="产品线" value={metadata.productLine || undefined} options={[...new Set([...productLines, ...(metadata.productLine ? [metadata.productLine] : [])])].map(value => ({ value, label: value }))} onChange={productLine => setMetadata(previous => ({ ...previous, productLine }))} />}</Form.Item>
      <Form.Item label="市场名" required={!formal}><Input aria-label="市场名" readOnly={metadataReadOnly} value={effectiveMetadata.marketName} placeholder={metadataReadOnly ? '请在正式项目空间补充' : '请输入市场名'} onChange={event => setMetadata(previous => ({ ...previous, marketName: event.target.value }))} /></Form.Item>
      <Form.Item label="项目等级" required tooltip={formal ? '来源于本项目基础信息' : '来源于启用的整机人力模型'}><Select disabled={formal} value={effectiveProjectLevel || undefined} options={getConfigProjectLevels(records).map(value => ({ value, label: value }))} onChange={setProjectLevel} /></Form.Item>
      <Form.Item label="等级系数" required><InputNumber style={{ width: '100%' }} min={0} precision={2} step={0.1} value={levelCoefficient} onChange={value => setLevelCoefficient(value ?? 1)} /></Form.Item>
      <Form.Item label="人力模型版本号" required><Select value={hrModelVersion || undefined} options={getConfigModelVersions(records).map(value => ({ value, label: value }))} onChange={setHrModelVersion} /></Form.Item>
      <HrVersionMilestoneFields category="machine" {...milestoneForm} />
    </Form>
    <Alert type="info" showIcon style={{ marginBottom: 12 }} title={`预估投入合计：${total} 人月。部门及阶段投入由所选模型、项目等级和等级系数计算，只读展示。`} />
    <Table className="pms-table pms-hr-investment-table" rowKey="id" columns={columns} dataSource={departments} pagination={false} size="small" scroll={{ x: 1130 }} locale={{ emptyText: '当前项目等级与模型版本无可用部门配置' }} />
  </Modal>
}
