'use client'

import { HrVersionModalTitle } from '@/components/project-resources/HrVersionModalTitle'

import NonLaborInvestmentSection, { useNonLaborDraft } from '@/components/project-resources/NonLaborInvestmentSection'

import { useEffect, useMemo, useState } from 'react'
import { App, Form, Input, InputNumber, Modal, Select, Table, Alert } from 'antd'
import { machinePhaseFields } from '@/lib/hrMachinePeriods'
import { HrReadonlyField } from '@/components/project-resources/HrReadonlyField'
import { useHrResourceScope } from '@/components/project-resources/HrResourceScope'
import { HrVersionMilestoneRow, useHrVersionMilestones } from '@/components/project-resources/HrVersionMilestones'
import { useHrMachineStore } from '@/hooks/useHrResourceStores'
import { useHrConfigStore } from '@/stores/hrConfig'
import { canEditHrInScope, canAccessHrProject, getHrAllowedBudgetTypes, getHrRegistryProject, isHrFormalRecord, resolveHrNewVersionProjectId } from '@/lib/hrProjectRegistry'
import { canCreateHrVersion, isLatestHrVersion, getHrVersionSeed, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'
import { PRODUCT_LINES_BY_BRAND } from '@/lib/roadmapValidation'
import { BUDGET_TYPES } from '@/constants/hrMachine'
import { calcMachineDepartmentInvestments, isHrModelAvailable, getAvailableHrModelSelection, getConfigProjectLevels, getConfigModelVersions } from '@/constants/hrConfig'
import type { BudgetType } from '@/types/hrMachine'

export default function NewVersionModal({ open, projectId, versionId, onCancel }: { open: boolean; projectId: string; versionId?: string; onCancel: () => void }) {
  const { message } = App.useApp()
  const scopeId = useHrResourceScope()
  const { projects, addVersion, updateVersion } = useHrMachineStore()
  const records = useHrConfigStore(state => state.data.hrModel ?? [])
  const [localProjectId, setLocalProjectId] = useState(projectId)
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [projectLevel, setProjectLevel] = useState('')
  const [levelCoefficient, setLevelCoefficient] = useState(1)
  const [hrModelVersion, setHrModelVersion] = useState('')
  const [metadata, setMetadata] = useState({ brand: '', productLine: '', marketName: '' })
  const project = projects.find(item => item.id === localProjectId)
  const editingVersion = project?.versions.find(version => version.id === versionId)
  const editing = Boolean(versionId)
  const canSave = editing ? Boolean(project && editingVersion && isLatestHrVersion(project, editingVersion) && canEditHrInScope(project, scopeId)) : canCreateHrVersion(project, budgetType)
  const formal = isHrFormalRecord(project)
  const bound = Boolean(getHrRegistryProject(project)?.boundFormalProjectId)
  const metadataReadOnly = formal || bound
  const effectiveMetadata = metadataReadOnly ? { brand: project?.brand ?? '', productLine: project?.productLine ?? '', marketName: project?.marketName ?? '' } : metadata
  const effectiveProjectLevel = formal ? resolveHrFormalSource('machine', project?.ipmProjectCode ?? null, project?.pmsProjectId).projectLevel : projectLevel
  const milestoneForm = useHrVersionMilestones('machine', project, budgetType, open, versionId)
  const nonLabor = useNonLaborDraft(open, localProjectId + ':' + budgetType + ':' + versionId, editingVersion?.nonLaborInvestment ?? (project ? getHrVersionSeed(project.versions, budgetType)?.nonLaborInvestment : undefined), 'machine', milestoneForm.values)

  useEffect(() => {
    if (!open) return
    const id = resolveHrNewVersionProjectId(projects, projectId, scopeId)
    setLocalProjectId(id)
    setBudgetType(projects.find(item => item.id === id)?.versions.find(version => version.id === versionId)?.budgetType ?? getHrAllowedBudgetTypes(projects.find(item => item.id === id))[0] ?? 'annual')
  }, [open, projectId, scopeId, versionId])
  useEffect(() => {
    if (!open) return
    const seed = editingVersion ?? (project ? getHrVersionSeed(project.versions, budgetType) : undefined)
    const sourceLevel = isHrFormalRecord(project) ? resolveHrFormalSource('machine', project?.ipmProjectCode ?? null, project?.pmsProjectId).projectLevel : seed?.projectLevel ?? ''
    const selection = getAvailableHrModelSelection(records, { projectLevel: sourceLevel, hrModelVersion: seed?.hrModelVersion ?? '' })
    setProjectLevel(editing ? seed?.projectLevel ?? '' : selection.projectLevel)
    setHrModelVersion(editing ? seed?.hrModelVersion ?? '' : selection.hrModelVersion)
    setLevelCoefficient(seed?.levelCoefficient ?? 1)
    setMetadata({ brand: project?.brand ?? '', productLine: project?.productLine ?? '', marketName: project?.marketName ?? '' })
  }, [open, localProjectId, budgetType, versionId])

  const modelUnchanged = editingVersion && effectiveProjectLevel === editingVersion.projectLevel && hrModelVersion === editingVersion.hrModelVersion && levelCoefficient === editingVersion.levelCoefficient
  const previewRecords = modelUnchanged ? editingVersion.modelSnapshot ?? [] : records
  const departments = useMemo(() => calcMachineDepartmentInvestments(previewRecords, effectiveProjectLevel, hrModelVersion, levelCoefficient), [previewRecords, effectiveProjectLevel, hrModelVersion, levelCoefficient])
  const total = Math.round(departments.reduce((sum, row) => sum + row.estimatedTotal, 0) * 10) / 10
  const columns = [
    { title: '一级部门', dataIndex: 'primaryDepartment', width: 140 },
    { title: '二级部门', dataIndex: 'secondaryDepartment', width: 140 },
    ...machinePhaseFields(previewRecords.filter(row => row.enabled !== false && String(row.projectLevel) === effectiveProjectLevel && String(row.modelVersion) === hrModelVersion)).map(field => ({ title: field.label, key: field.key, width: 145, align: 'center' as const, render: (_: unknown, row: typeof departments[number]) => row.phases[field.key] ?? '—' })),
    { title: '预估投入合计', dataIndex: 'estimatedTotal', width: 130, align: 'center' as const },
  ]
  const budgetOptions = BUDGET_TYPES.filter(type => getHrAllowedBudgetTypes(project).includes(type.value))
  const productLines = PRODUCT_LINES_BY_BRAND[metadata.brand as keyof typeof PRODUCT_LINES_BY_BRAND] ?? []
  const handleOk = () => {
    try {
      if (!canSave) { message.warning('当前版本不可编辑'); return }
      if (!editing && !isHrModelAvailable(records, effectiveProjectLevel, hrModelVersion)) { message.warning('请选择有效的项目等级与人力模型版本'); return }
      if (editing && editingVersion) updateVersion(localProjectId, editingVersion.id, { projectLevel: effectiveProjectLevel === editingVersion.projectLevel ? undefined : effectiveProjectLevel, levelCoefficient: levelCoefficient === editingVersion.levelCoefficient ? undefined : levelCoefficient, hrModelVersion: hrModelVersion === editingVersion.hrModelVersion ? undefined : hrModelVersion, milestones: milestoneForm.values, nonLaborInvestment: nonLabor.value, metadata: effectiveMetadata })
      else addVersion(localProjectId, budgetType, { projectLevel: effectiveProjectLevel, levelCoefficient, hrModelVersion, milestones: milestoneForm.values, metadata: effectiveMetadata, nonLaborInvestment: nonLabor.value })
      message.success(editing ? '版本已更新' : '版本创建成功')
      onCancel()
    } catch (error) { message.warning(error instanceof Error ? error.message : '版本创建失败') }
  }

  return <Modal className="pms-modal pms-hr-version-modal" title={<HrVersionModalTitle title={editing ? "编辑版本" : "新增版本"} projectName={project?.name} versionNumber={editingVersion?.versionNumber ?? (project ? `V0.${nextHrMinorVersion(project.versions, budgetType)}` : undefined)} versionLabel={editing ? "版本号" : "将创建版本"} />} open={open} onCancel={onCancel} onOk={handleOk} okText={editing ? "保存" : "创建"} cancelText="取消" width={1560} okButtonProps={{ disabled: !canSave }}>
    {bound && Object.values(effectiveMetadata).some(value => !value.trim()) && <Alert type="info" showIcon style={{ marginBottom: 8 }} title="来源正式项目的品牌信息尚未补充完整，可在正式项目空间完善；解绑后可新增或修改预算。" />}
    <Form layout="vertical">
      <div className="pms-hr-version-row pms-hr-version-row--machine-settings">
      <Form.Item label="预算类型" required>{editing ? <HrReadonlyField label="预算类型" value={budgetOptions.find(option => option.value === budgetType)?.label} reason="版本预算类型不可修改" /> : <Select value={budgetType} options={budgetOptions} onChange={setBudgetType} />}</Form.Item>
      <Form.Item label="品牌" required={!formal && !bound}>{metadataReadOnly ? <HrReadonlyField label="品牌" value={effectiveMetadata.brand} reason="来源于正式项目基础信息" /> : <Select aria-label="品牌" value={metadata.brand || undefined} options={[...new Set([...Object.keys(PRODUCT_LINES_BY_BRAND), ...(metadata.brand ? [metadata.brand] : [])])].map(value => ({ value, label: value }))} onChange={brand => setMetadata(previous => ({ ...previous, brand, productLine: '' }))} />}</Form.Item>
      <Form.Item label="产品线" required={!formal && !bound}>{metadataReadOnly ? <HrReadonlyField label="产品线" value={effectiveMetadata.productLine} reason="来源于正式项目基础信息" /> : <Select aria-label="产品线" value={metadata.productLine || undefined} options={[...new Set([...productLines, ...(metadata.productLine ? [metadata.productLine] : [])])].map(value => ({ value, label: value }))} onChange={productLine => setMetadata(previous => ({ ...previous, productLine }))} />}</Form.Item>
      <Form.Item label="市场名" required={!formal && !bound}>{metadataReadOnly ? <HrReadonlyField label="市场名" value={effectiveMetadata.marketName} reason="来源于正式项目基础信息" /> : <Input aria-label="市场名" value={effectiveMetadata.marketName} placeholder="请输入市场名" onChange={event => setMetadata(previous => ({ ...previous, marketName: event.target.value }))} />}</Form.Item>
      <Form.Item label="项目等级" required tooltip={formal ? '来源于本项目基础信息' : '来源于启用的整机人力模型'}>{formal ? <HrReadonlyField label="项目等级" value={effectiveProjectLevel} reason="来源于本项目基础信息" /> : <Select value={effectiveProjectLevel || undefined} options={getConfigProjectLevels(records).map(value => ({ value, label: value }))} onChange={setProjectLevel} />}</Form.Item>
      <Form.Item label="等级系数" required><InputNumber style={{ width: '100%' }} min={0} precision={2} step={0.1} value={levelCoefficient} onChange={value => setLevelCoefficient(value ?? 1)} /></Form.Item>
      <Form.Item label="人力模型版本号" required><Select value={hrModelVersion || undefined} options={getConfigModelVersions(records).map(value => ({ value, label: value }))} onChange={setHrModelVersion} /></Form.Item>
      </div>
      {!scopeId && !editing && <div className="pms-hr-version-form"><Form.Item label="项目" required><Select showSearch aria-label="选择项目" value={localProjectId || undefined} optionFilterProp="label" options={projects.filter(item => canAccessHrProject(item, true) && getHrAllowedBudgetTypes(item).length > 0).map(item => ({ value: item.id, label: item.name, disabled: item.status !== 'active' }))} onChange={id => { setLocalProjectId(id); setBudgetType(getHrAllowedBudgetTypes(projects.find(item => item.id === id))[0] ?? 'annual') }} /></Form.Item></div>}
      <HrVersionMilestoneRow category="machine" {...milestoneForm} />
    </Form>
    <h3 className="pms-hr-investment-section-title">各部门人力投入</h3>
    <Alert type="info" showIcon style={{ marginBottom: 8 }} title={`人力预估投入合计：${total} 人月。`} />
    <Table className="pms-table pms-hr-investment-table" rowKey="id" columns={columns} dataSource={departments} pagination={false} size="small" scroll={{ x: columns.reduce((sum, column) => sum + column.width, 0) }} locale={{ emptyText: '当前项目等级与模型版本无可用部门配置' }} />
    <NonLaborInvestmentSection {...nonLabor} />
  </Modal>
}
