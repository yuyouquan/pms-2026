'use client'
import { useRef } from 'react'
import { Alert, App, Button, DatePicker, Input, InputNumber, Select, Space, Table, Tabs, Tooltip, Upload } from 'antd'
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
import { canEditResourceMilestone, resolveMachineDepartmentInvestments, resolveMachinePhaseFields, resourceMilestoneFields, resourcePhaseFields, type InlineDepartment, type ResourceInlinePatch } from '@/lib/resourceInlineEditing'
import { getResourcePhaseRatios, getResourceRatioFields } from '@/lib/resourceRatios'
import { cloneNonLaborInvestment } from '@/lib/nonLaborInvestment'
import { isHrFormalRecord, getHrRegistryProject, canEditHrInScope } from '@/lib/hrProjectRegistry'
import { getConfigProjectLevels, getConfigModelVersions } from '@/constants/hrConfig'
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
  const machine = 'hrModelVersion' in version ? version : null
  const rows: InlineDepartment[] = machine ? resolveMachineDepartmentInvestments(machine) : 'departmentInvestments' in version ? version.departmentInvestments.map(row => ({ ...row })) : []
  const phases = machine ? resolveMachinePhaseFields(machine) : getResourceRatioFields(category)
  const saveDepartments = (next: InlineDepartment[]) => persist({ type: 'departments', rows: next, phaseRatios: Object.fromEntries(next.map(row => [row.id, getResourcePhaseRatios(category, version, row)])) })
  const patchRow = (id: string, key: string, value: string | number) => saveDepartments(rows.map(row => row.id === id ? { ...row, [key]: value, ...(key === 'primaryDepartment' && value !== row.primaryDepartment ? { secondaryDepartment: '' } : {}) } : row))
  const fields: ColumnsType<InlineDepartment> = [
    ...[{ key: 'primaryDepartment', label: '一级部门' }, { key: 'secondaryDepartment', label: '二级部门' }].map(field => ({ title: field.label, key: field.key, width: 150, fixed: 'left' as const,
      render: (_: unknown, row: InlineDepartment) => field.key === 'secondaryDepartment' && !row.primaryDepartment && !readOnly
        ? <HrReadonlyField label="二级部门" placeholder="请先选择一级部门" reason="选择一级部门后可编辑" />
        : <ResourceInlineField label={field.label} value={row[field.key]} readOnly={readOnly} onSave={value => patchRow(row.id, field.key, String(value ?? ''))}
          renderEditor={(value, change, popup) => <Select showSearch allowClear aria-label={field.label} value={value || undefined} optionFilterProp="label" getPopupContainer={popup} style={{ width: '100%' }}
            options={field.key === 'primaryDepartment' ? primaryOptions : getSecondaryOptions(row.primaryDepartment)} onChange={change} />} /> })),
    ...[{ title: '预估投入合计', key: 'total', width: 130, align: 'center' as const,
      render: (_: unknown, row: InlineDepartment) => <ResourceInlineField label={`${row.primaryDepartment || '未选择一级部门'} ${row.secondaryDepartment || '未选择二级部门'} 预估投入合计（人月）`} value={row.estimatedInvestment} display={formatPersonMonth(row.estimatedInvestment)} readOnly={readOnly}
        onSave={value => persist({ type: 'departmentTotal', rowId: row.id, value: value === null ? 0 : Number(value) })}
        renderEditor={(value, change) => <InputNumber controls={false} aria-label={`${row.primaryDepartment || '未选择一级部门'} ${row.secondaryDepartment || '未选择二级部门'} 预估投入合计（人月）`} value={value as number} min={0} precision={1} step={0.1} style={{ width: '100%' }} onChange={change} />} /> }],
    ...phases.map(field => ({ title: field.label, key: field.key, width: 170, align: 'center' as const,
      render: (_: unknown, row: InlineDepartment) => {
        const ratio = getResourcePhaseRatios(category, version, row)[field.key] ?? 0
        const amount = category === 'capability' ? row.estimatedInvestment * ratio / 100 : Number(row[field.key] ?? 0)
        const label = `${row.primaryDepartment} ${row.secondaryDepartment} ${field.label}比例`
        return <ResourceInlineField label={label} value={ratio} display={`${ratio.toFixed(2)}%（${formatPersonMonth(amount)}）`} readOnly={readOnly}
          onSave={value => persist({ type: 'departmentRatio', rowId: row.id, key: field.key, value: value === null ? 0 : Number(value) })}
          renderEditor={(value, change) => <InputNumber controls={false} aria-label={label} value={Number(value)} min={0} max={100} precision={2} suffix={`%（${formatPersonMonth(amount)}）`} style={{ width: '100%' }} onChange={change} />} />
      } })),
    { title: '比例合计', key: 'ratioTotal', width: 140, fixed: 'right', align: 'center', render: (_, row) => {
      const total = Object.values(getResourcePhaseRatios(category, version, row)).reduce((sum, value) => sum + value, 0)
      const difference = Math.round((total - 100) * 100) / 100
      return <span className={`pms-resource-ratio-total${difference ? ' pms-resource-difference' : ''}`}>{total.toFixed(2)}%/100%</span>
    } },
    ...(!readOnly ? [{ title: '操作', key: 'actions', width: 64, fixed: 'right' as const, render: (_: unknown, row: InlineDepartment) => <Tooltip title="删除部门"><Button type="text" danger size="small" aria-label="删除部门" icon={<DeleteOutlined />} onClick={() => action(() => saveDepartments(rows.filter(item => item.id !== row.id)))} /></Tooltip> }] : []),
  ]
  const templateColumns = [{ key: 'primaryDepartment', title: '一级部门' }, { key: 'secondaryDepartment', title: '二级部门' }, { key: 'estimatedInvestment', title: '预估投入合计（人月）' }, ...phases.map(field => ({ key: field.key, title: `${field.label}（%）` }))]
  const importDepartments = async (file: File) => {
    const original = version
    const canApply = importSession.capture(() => currentVersion.current === original && isImportCurrent())
    try {
      const workbook = XLSX.read(await file.arrayBuffer())
      if (!workbook.SheetNames[0]) throw new Error('文件中没有工作表')
      const source = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 })
      const phaseRatios: Record<string, Record<string, number>> = {}
      const parsed = source.slice(1).filter(row => row.some(value => value !== '' && value != null)).map((row, index) => {
        const item: InlineDepartment = { id: `department-${Date.now()}-${index}`, primaryDepartment: String(row[0] ?? '').trim(), secondaryDepartment: String(row[1] ?? '').trim(), estimatedInvestment: Number(row[2] ?? 0) }
        phaseRatios[item.id] = Object.fromEntries(phases.map((field, i) => [field.key, row[i + 3] == null || row[i + 3] === '' ? 0 : Number(String(row[i + 3]).replace(/%$/, ''))]))
        return item
      })
      if (!parsed.length) throw new Error('未解析到有效数据，请检查模板格式')
      if (!canApply()) throw new Error('当前版本、数据或编辑权限已变化，请重新导入')
      persist({ type: 'departments', rows: parsed, phaseRatios, complete: true })
      message.success(`已导入 ${parsed.length} 条部门数据`)
    } catch (error) { message.warning(error instanceof Error ? error.message : '文件解析失败，请检查模板格式') }
    return false
  }
  const machineProject = 'brand' in project ? project : null
  const registryProject = getHrRegistryProject(project)
  const metadataReadOnly = readOnly || isHrFormalRecord(project) || !!registryProject?.boundFormalProjectId
  const isBudgetProject = !!registryProject && getProjectAttribute(registryProject) === 'budget'
  const metadataFields = machineProject ? [{ key: 'brand' as const, label: '品牌' }, { key: 'productLine' as const, label: '产品线' }, { key: 'marketName' as const, label: '市场名' }].map(field => ({ key: field.key, label: field.label,
    children: <ResourceInlineField label={field.label} value={machineProject[field.key]} readOnly={metadataReadOnly} onSave={value => persist({ type: 'metadata', key: field.key, value: String(value ?? '') })}
      renderEditor={(value, change, popup) => field.key === 'marketName' ? <Input aria-label={field.label} value={String(value ?? '')} onChange={event => change(event.target.value)} />
        : <Select aria-label={field.label} value={value || undefined} getPopupContainer={popup} style={{ minWidth: 140 }} onChange={change}
          options={[...new Set([...(field.key === 'brand' ? Object.keys(PRODUCT_LINES_BY_BRAND) : PRODUCT_LINES_BY_BRAND[machineProject.brand as keyof typeof PRODUCT_LINES_BY_BRAND] ?? []), ...(value ? [String(value)] : [])])].map(label => ({ label, value: label }))} />} /> })) : []
  const modelFields = machine ? [{ key: 'projectLevel' as const, label: '项目等级' }, { key: 'levelCoefficient' as const, label: '等级系数' }, { key: 'hrModelVersion' as const, label: '人力模型版本号' }].map(field => ({ key: field.key, label: field.label,
    children: <ResourceInlineField label={field.label} value={machine[field.key]} readOnly={readOnly || field.key === 'projectLevel' && isHrFormalRecord(project)} onSave={value => persist({ type: 'model', key: field.key, value: field.key === 'levelCoefficient' ? Number(value) : String(value ?? '') })}
      renderEditor={(value, change, popup) => field.key === 'levelCoefficient' ? <InputNumber controls={false} aria-label={field.label} value={value as number} step={0.1} onChange={change} />
        : <Select aria-label={field.label} value={value || undefined} getPopupContainer={popup} style={{ minWidth: 120 }} onChange={change} options={(field.key === 'projectLevel' ? getConfigProjectLevels(records) : getConfigModelVersions(records)).map(label => ({ label, value: label }))} />} /> })) : []
  const machineRows = machine ? resolveMachineDepartmentInvestments(machine) : []
  const machinePhases = machine ? resolveMachinePhaseFields(machine) : []
  const machineColumns = [{ title: '一级部门', dataIndex: 'primaryDepartment', width: 150, align: 'center' as const }, { title: '二级部门', dataIndex: 'secondaryDepartment', width: 150, align: 'center' as const },
    { title: '预估投入合计', key: 'total', width: 140, align: 'center' as const, render: (_: unknown, row: InlineDepartment) => formatPersonMonth(row.estimatedInvestment) },
    ...machinePhases.map(field => ({ title: field.label, key: field.key, width: 170, align: 'center' as const, render: (_: unknown, row: InlineDepartment) => {
      const amount = Number(row[field.key] ?? 0)
      return `${formatPersonMonth(amount)}（${(row.estimatedInvestment ? amount / row.estimatedInvestment * 100 : 0).toFixed(2)}%）`
    } }))]
  return <div className="pms-resource-inline-detail">
    <section className="pms-resource-panel pms-resource-basics" aria-label="基础信息与里程碑">
    {category !== 'capability' ? <BudgetMilestoneSchedule
      category={category}
      versionId={version.id}
      dates={dates}
      fields={resourceMilestoneFields[category]}
      modelSnapshot={'scheduleModelSnapshot' in version ? version.scheduleModelSnapshot : undefined}
      readOnly={readOnly}
      allowSchedule={isBudgetProject}
      headerContent={machine && <dl className="pms-resource-metadata">{[...metadataFields, ...modelFields].map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.children}</dd></div>)}</dl>}
      canEdit={key => canEditResourceMilestone(category, project, key)}
      onSaveDate={(key, value) => persist({ type: 'milestone', key, value })}
      onSchedule={(scheduledDates, modelSnapshot) => persist({ type: 'milestoneSchedule', dates: scheduledDates, modelSnapshot })}
    /> : <section className="pms-hr-milestone-details" aria-label="里程碑信息"><h3 className="pms-hr-investment-section-title">里程碑信息</h3>
      <div className="pms-hr-milestone-details-scroll"><dl style={{ gridTemplateColumns: `repeat(${resourceMilestoneFields[category].length}, minmax(130px, 1fr))` }}>
        {resourceMilestoneFields[category].map(field => <div key={field.key}><dt>{field.label}</dt><dd><ResourceInlineField label={field.label} value={dates[field.key]} readOnly={readOnly || !canEditResourceMilestone(category, project, field.key)}
          onSave={value => persist({ type: 'milestone', key: field.key, value: value ? String(value) : null })}
          renderEditor={(value, change, popup) => <div {...inlineDateInputHandlers(change)}><DatePicker aria-label={field.label} defaultValue={value ? dayjs(String(value)) : null} preserveInvalidOnBlur getPopupContainer={popup} style={{ width: '100%' }} onChange={date => change(date?.format('YYYY-MM-DD') ?? null)} /></div>} /></dd></div>)}
      </dl></div></section>}
    </section>
    <section className="pms-resource-panel" aria-label="预估投入">
    <Tabs items={[{ key: 'labor', label: '各部门人力（人月）投入', children: <>

    {!machine && !readOnly && <Space size="small" className="pms-resource-department-actions">
      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => action(() => saveDepartments([...rows, { id: `department-${crypto.randomUUID()}`, primaryDepartment: '', secondaryDepartment: '', estimatedInvestment: 0 }]))}>添加部门</Button>
      <Button size="small" type="dashed" icon={<DownloadOutlined />} onClick={() => exportSheet([Object.fromEntries(templateColumns.map(column => [column.key, column.key.includes('Department') ? '' : 0]))], templateColumns, '部门预估投入模板.xlsx', '部门预估投入')}>下载模板</Button>
      <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={importDepartments}><Button size="small" type="dashed" icon={<UploadOutlined />}>导入</Button></Upload>
    </Space>}
    {machine ? machine.modelSnapshot ? <Table className="pms-table pms-hr-investment-table" rowKey="id" columns={machineColumns} dataSource={machineRows} pagination={false} size="small" scroll={{ x: machineColumns.reduce((sum, column) => sum + column.width, 0) }}
        summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell>
          <Table.Summary.Cell index={2} align="center">{formatPersonMonth(version.estimatedInvestment)}</Table.Summary.Cell>
          {machinePhases.map((field, index) => <Table.Summary.Cell key={field.key} index={index + 3} align="center">{formatPersonMonth(Math.round(machineRows.reduce((sum, row) => sum + Number(category === 'capability' ? row.estimatedInvestment * (getResourcePhaseRatios(category, version, row).projectPeriod ?? 0) / 100 : row[field.key] ?? 0), 0) * 10) / 10)}</Table.Summary.Cell>)}
        </Table.Summary.Row>} />
      : <Alert type="info" showIcon title="该历史版本未保存模型明细，无法还原原始部门投入；版本总额和里程碑仍保留。" />
      : <Table className="pms-table pms-hr-investment-table" rowKey="id" columns={fields} dataSource={rows} pagination={false} size="small" tableLayout="fixed" scroll={{ x: fields.reduce((sum, field) => sum + Number(field.width ?? 0), 0) }} locale={{ emptyText: '暂无部门预估投入数据' }}
        summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell>
          <Table.Summary.Cell index={2} align="center">{formatPersonMonth(version.estimatedInvestment)}</Table.Summary.Cell>
          {phases.map((field, index) => <Table.Summary.Cell key={field.key} index={index + 3} align="center">{formatPersonMonth(Math.round(rows.reduce((sum, row) => sum + Number(category === 'capability' ? row.estimatedInvestment * (getResourcePhaseRatios(category, version, row).projectPeriod ?? 0) / 100 : row[field.key] ?? 0), 0) * 10) / 10)}</Table.Summary.Cell>)}
          <Table.Summary.Cell index={phases.length + 3} />
          {!readOnly && <Table.Summary.Cell index={phases.length + 4} />}
        </Table.Summary.Row>} />}
    </> }, { key: 'nonLabor', label: '非人力投入（万元）', children: <NonLaborInvestmentSection inline unit="万元" canImport={isImportCurrent} value={cloneNonLaborInvestment(version.nonLaborInvestment)} readOnly={readOnly}
      onChange={value => persist({ type: 'nonLabor', value })} onItemTotalChange={(itemId, value) => persist({ type: 'nonLaborItemTotal', itemId, value })} /> }]} />
    </section>
  </div>
}
