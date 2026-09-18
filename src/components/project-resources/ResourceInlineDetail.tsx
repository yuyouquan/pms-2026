'use client'
import { useRef } from 'react'
import { Alert, App, Button, DatePicker, Descriptions, Input, InputNumber, Select, Space, Table, Tooltip, Upload } from 'antd'
import { DeleteOutlined, DownloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import type { ColumnsType } from 'antd/es/table'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { ResourceProject, ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import { resourceStore } from '@/components/project-resources/resourceVersionAdapter'
import ResourceInlineField from '@/components/project-resources/ResourceInlineField'
import { useInlineImportSession } from '@/components/project-resources/useInlineImportSession'
import { isHrVersionEditable } from '@/lib/hrVersionRules'
import { inlineDateInputHandlers } from '@/components/project-resources/inlineFieldSession'
import NonLaborInvestmentSection from '@/components/project-resources/NonLaborInvestmentSection'
import { canEditResourceMilestone, resourceMilestoneFields, resourcePhaseFields, type InlineDepartment, type ResourceInlinePatch } from '@/lib/resourceInlineEditing'
import { cloneNonLaborInvestment } from '@/lib/nonLaborInvestment'
import { isHrFormalRecord, getHrRegistryProject, canEditHrInScope } from '@/lib/hrProjectRegistry'
import { calcMachineDepartmentInvestments, getConfigProjectLevels, getConfigModelVersions } from '@/constants/hrConfig'
import { machinePhaseFields } from '@/lib/hrMachinePeriods'
import { useHrConfigStore } from '@/stores/hrConfig'
import { useHrDepartmentOptions } from '@/hooks/useHrDepartmentOptions'
import { HrReadonlyField } from '@/components/project-resources/HrReadonlyField'
import { PRODUCT_LINES_BY_BRAND } from '@/lib/roadmapValidation'
import { formatPersonMonth } from '@/constants/hrMachine'
import { exportSheet } from '@/utils/exportExcel'
import BudgetMilestoneSchedule from '@/components/project-resources/BudgetMilestoneSchedule'
import { getProjectAttribute } from '@/types/projectRegistry'

export default function ResourceInlineDetail({ category, project, version, scopeId, readOnly }: {
  category: HrProjectCategory; project: ResourceProject; version: ResourceVersion; scopeId: string; readOnly: boolean
}) {
  const { message } = App.useApp()
  const { primaryOptions, getSecondaryOptions } = useHrDepartmentOptions()
  const records = useHrConfigStore(state => state.data.hrModel ?? [])
  const currentVersion = useRef(version); currentVersion.current = version
  const importSession = useInlineImportSession()
  const isImportCurrent = () => {
    const current = resourceStore(category).getState().projects.find(item => item.id === project.id)
    const saved = current?.versions.find(item => item.id === version.id)
    return saved === version && canEditHrInScope(current, scopeId) && isHrVersionEditable(current, saved)
  }
  const persist = (patch: ResourceInlinePatch) => resourceStore(category).getState().updateVersionInline(project.id, version.id, patch, scopeId)
  const action = (fn: () => void) => { try { fn() } catch (error) { message.warning(error instanceof Error ? error.message : '保存失败') } }
  const dates = ('projectStartTime' in version ? version : version.milestones) as unknown as Record<string, string | null>
  const rows: InlineDepartment[] = 'departmentInvestments' in version ? version.departmentInvestments.map(row => ({ ...row })) : []
  const phases = resourcePhaseFields[category]
  const patchRow = (id: string, key: string, value: string | number) => persist({ type: 'departments', rows: rows.map(row => row.id === id ? { ...row, [key]: value, ...(key === 'primaryDepartment' && value !== row.primaryDepartment ? { secondaryDepartment: '' } : {}) } : row) })
  const fields: ColumnsType<InlineDepartment> = [
    ...[{ key: 'primaryDepartment', label: '一级部门' }, { key: 'secondaryDepartment', label: '二级部门' }].map(field => ({ title: field.label, key: field.key, width: 150, fixed: 'left' as const,
      render: (_: unknown, row: InlineDepartment) => field.key === 'secondaryDepartment' && !row.primaryDepartment && !readOnly
        ? <HrReadonlyField label="二级部门" placeholder="请先选择一级部门" reason="选择一级部门后可编辑" />
        : <ResourceInlineField label={field.label} value={row[field.key]} readOnly={readOnly} onSave={value => patchRow(row.id, field.key, String(value ?? ''))}
          renderEditor={(value, change, popup) => <Select autoFocus showSearch allowClear aria-label={field.label} value={value || undefined} optionFilterProp="label" getPopupContainer={popup} style={{ width: '100%' }}
            options={field.key === 'primaryDepartment' ? primaryOptions : getSecondaryOptions(row.primaryDepartment)} onChange={change} />} /> })),
    ...phases.map(field => ({ title: field.label, key: field.key, width: 145, align: 'center' as const,
      render: (_: unknown, row: InlineDepartment) => <ResourceInlineField label={field.label} value={row[field.key] ?? 0} readOnly={readOnly}
        onSave={value => patchRow(row.id, field.key, value === null ? 0 : Number(value))}
        renderEditor={(value, change) => <InputNumber autoFocus aria-label={field.label} value={value as number} step={0.1} style={{ width: '100%' }} onChange={change} />} /> })),
    ...(category === 'capability' ? [] : [{ title: '预估投入合计', key: 'total', width: 130, render: (_: unknown, row: InlineDepartment) => formatPersonMonth(row.estimatedInvestment) }]),
    ...(!readOnly ? [{ title: '操作', key: 'actions', width: 64, fixed: 'right' as const, render: (_: unknown, row: InlineDepartment) => <Tooltip title="删除部门"><Button type="text" danger size="small" aria-label="删除部门" icon={<DeleteOutlined />} onClick={() => action(() => persist({ type: 'departments', rows: rows.filter(item => item.id !== row.id) }))} /></Tooltip> }] : []),
  ]
  const templateColumns = [{ key: 'primaryDepartment', title: '一级部门' }, { key: 'secondaryDepartment', title: '二级部门' }, ...phases.map(field => ({ key: field.key, title: field.label }))]
  const importDepartments = async (file: File) => {
    const original = version
    const canApply = importSession.capture(() => currentVersion.current === original && isImportCurrent())
    try {
      const workbook = XLSX.read(await file.arrayBuffer())
      if (!workbook.SheetNames[0]) throw new Error('文件中没有工作表')
      const source = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 })
      const parsed = source.slice(1).filter(row => row.some(value => value !== '' && value != null)).map((row, index) => {
        const item: InlineDepartment = { id: `department-${Date.now()}-${index}`, primaryDepartment: String(row[0] ?? '').trim(), secondaryDepartment: String(row[1] ?? '').trim(), estimatedInvestment: 0 }
        phases.forEach((field, i) => { item[field.key] = row[i + 2] == null || row[i + 2] === '' ? 0 : Number(row[i + 2]) })
        return item
      })
      if (!parsed.length) throw new Error('未解析到有效数据，请检查模板格式')
      if (!canApply()) throw new Error('当前版本、数据或编辑权限已变化，请重新导入')
      persist({ type: 'departments', rows: parsed, complete: true })
      message.success(`已导入 ${parsed.length} 条部门数据`)
    } catch (error) { message.warning(error instanceof Error ? error.message : '文件解析失败，请检查模板格式') }
    return false
  }
  const machine = 'hrModelVersion' in version ? version : null
  const machineProject = 'brand' in project ? project : null
  const registryProject = getHrRegistryProject(project)
  const metadataReadOnly = readOnly || isHrFormalRecord(project) || !!registryProject?.boundFormalProjectId
  const isBudgetProject = !!registryProject && getProjectAttribute(registryProject) === 'budget'
  const metadataFields = machineProject ? [{ key: 'brand' as const, label: '品牌' }, { key: 'productLine' as const, label: '产品线' }, { key: 'marketName' as const, label: '市场名' }].map(field => ({ key: field.key, label: field.label,
    children: <ResourceInlineField label={field.label} value={machineProject[field.key]} readOnly={metadataReadOnly} onSave={value => persist({ type: 'metadata', key: field.key, value: String(value ?? '') })}
      renderEditor={(value, change, popup) => field.key === 'marketName' ? <Input autoFocus aria-label={field.label} value={String(value ?? '')} onChange={event => change(event.target.value)} />
        : <Select autoFocus aria-label={field.label} value={value || undefined} getPopupContainer={popup} style={{ minWidth: 140 }} onChange={change}
          options={[...new Set([...(field.key === 'brand' ? Object.keys(PRODUCT_LINES_BY_BRAND) : PRODUCT_LINES_BY_BRAND[machineProject.brand as keyof typeof PRODUCT_LINES_BY_BRAND] ?? []), ...(value ? [String(value)] : [])])].map(label => ({ label, value: label }))} />} /> })) : []
  const modelFields = machine ? [{ key: 'projectLevel' as const, label: '项目等级' }, { key: 'levelCoefficient' as const, label: '等级系数' }, { key: 'hrModelVersion' as const, label: '人力模型版本号' }].map(field => ({ key: field.key, label: field.label,
    children: <ResourceInlineField label={field.label} value={machine[field.key]} readOnly={readOnly || field.key === 'projectLevel' && isHrFormalRecord(project)} onSave={value => persist({ type: 'model', key: field.key, value: field.key === 'levelCoefficient' ? Number(value) : String(value ?? '') })}
      renderEditor={(value, change, popup) => field.key === 'levelCoefficient' ? <InputNumber autoFocus aria-label={field.label} value={value as number} step={0.1} onChange={change} />
        : <Select autoFocus aria-label={field.label} value={value || undefined} getPopupContainer={popup} style={{ minWidth: 120 }} onChange={change} options={(field.key === 'projectLevel' ? getConfigProjectLevels(records) : getConfigModelVersions(records)).map(label => ({ label, value: label }))} />} /> })) : []
  const machineRows = machine ? calcMachineDepartmentInvestments(machine.modelSnapshot ?? [], machine.projectLevel, machine.hrModelVersion, machine.levelCoefficient) : []
  const machinePhases = machinePhaseFields(machine?.modelSnapshot ?? [])
  const machineColumns = [{ title: '一级部门', dataIndex: 'primaryDepartment', width: 150 }, { title: '二级部门', dataIndex: 'secondaryDepartment', width: 150 },
    ...machinePhases.map(field => ({ title: field.label, key: field.key, width: 145, render: (_: unknown, row: typeof machineRows[number]) => formatPersonMonth(row.phases[field.key]) })),
    { title: '预估投入合计', dataIndex: 'estimatedTotal', width: 130, render: (value: number) => formatPersonMonth(value) }]
  return <div className="pms-resource-inline-detail">
    {machine && <Descriptions size="small" column={3} bordered items={[...metadataFields, ...modelFields]} />}
    {isBudgetProject && category !== 'capability' ? <BudgetMilestoneSchedule
      category={category}
      versionId={version.id}
      dates={dates}
      fields={resourceMilestoneFields[category]}
      modelSnapshot={'scheduleModelSnapshot' in version ? version.scheduleModelSnapshot : undefined}
      readOnly={readOnly}
      canEdit={key => canEditResourceMilestone(category, project, key)}
      onSaveDate={(key, value) => persist({ type: 'milestone', key, value })}
      onSchedule={(scheduledDates, modelSnapshot) => persist({ type: 'milestoneSchedule', dates: scheduledDates, modelSnapshot })}
    /> : <section className="pms-hr-milestone-details" aria-label="里程碑信息"><h3 className="pms-hr-investment-section-title">里程碑信息</h3>
      <div className="pms-hr-milestone-details-scroll"><dl style={{ gridTemplateColumns: `repeat(${resourceMilestoneFields[category].length}, minmax(130px, 1fr))` }}>
        {resourceMilestoneFields[category].map(field => <div key={field.key}><dt>{field.label}</dt><dd><ResourceInlineField label={field.label} value={dates[field.key]} readOnly={readOnly || !canEditResourceMilestone(category, project, field.key)}
          onSave={value => persist({ type: 'milestone', key: field.key, value: value ? String(value) : null })}
          renderEditor={(value, change, popup) => <div {...inlineDateInputHandlers(change)}><DatePicker autoFocus aria-label={field.label} defaultValue={value ? dayjs(String(value)) : null} preserveInvalidOnBlur getPopupContainer={popup} style={{ width: '100%' }} onChange={date => change(date?.format('YYYY-MM-DD') ?? null)} /></div>} /></dd></div>)}
      </dl></div></section>}
    <h3 className="pms-hr-investment-section-title">各部门人力投入</h3>
    {!machine && !readOnly && <Space size="small" className="pms-resource-department-actions">
      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => action(() => persist({ type: 'departments', rows: [...rows, { id: `department-${crypto.randomUUID()}`, primaryDepartment: '', secondaryDepartment: '', estimatedInvestment: 0 }] }))}>添加部门</Button>
      <Button size="small" type="dashed" icon={<DownloadOutlined />} onClick={() => exportSheet([Object.fromEntries(templateColumns.map(column => [column.key, column.key.includes('Department') ? '' : 0]))], templateColumns, '部门预估投入模板.xlsx', '部门预估投入')}>下载模板</Button>
      <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={importDepartments}><Button size="small" type="dashed" icon={<UploadOutlined />}>导入</Button></Upload>
    </Space>}
    {machine ? machine.modelSnapshot ? <Table className="pms-table pms-hr-investment-table" rowKey="id" columns={machineColumns} dataSource={machineRows} pagination={false} size="small" scroll={{ x: machineColumns.reduce((sum, column) => sum + column.width, 0) }}
        summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell>
          {machinePhases.map((field, index) => <Table.Summary.Cell key={field.key} index={index + 2}>{formatPersonMonth(Math.round(machineRows.reduce((sum, row) => sum + (row.phases[field.key] ?? 0), 0) * 10) / 10)}</Table.Summary.Cell>)}
          <Table.Summary.Cell index={machinePhases.length + 2}>{formatPersonMonth(version.estimatedInvestment)}</Table.Summary.Cell>
        </Table.Summary.Row>} />
      : <Alert type="info" showIcon title="该历史版本未保存模型明细，无法还原原始部门投入；版本总额和里程碑仍保留。" />
      : <Table className="pms-table pms-hr-investment-table" rowKey="id" columns={fields} dataSource={rows} pagination={false} size="small" tableLayout="fixed" scroll={{ x: fields.reduce((sum, field) => sum + Number(field.width ?? 0), 0) }} locale={{ emptyText: '暂无部门预估投入数据' }}
        summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell>
          {phases.map((field, index) => <Table.Summary.Cell key={field.key} index={index + 2} align="center">{formatPersonMonth(Math.round(rows.reduce((sum, row) => sum + Number(row[field.key] ?? 0), 0) * 10) / 10)}</Table.Summary.Cell>)}
          {category !== 'capability' && <Table.Summary.Cell index={phases.length + 2}>{formatPersonMonth(version.estimatedInvestment)}</Table.Summary.Cell>}
          {!readOnly && <Table.Summary.Cell index={phases.length + (category === 'capability' ? 2 : 3)} />}
        </Table.Summary.Row>} />}
    <NonLaborInvestmentSection inline canImport={isImportCurrent} value={cloneNonLaborInvestment(version.nonLaborInvestment)} readOnly={readOnly} onChange={value => persist({ type: 'nonLabor', value })} />
  </div>
}
