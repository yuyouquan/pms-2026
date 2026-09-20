'use client'

import { isValidElement, useEffect, useRef, useState } from 'react'
import { Alert, App, Button, InputNumber, Select, Space, Table, Upload } from 'antd'
import { DeleteOutlined, DownloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { useHrConfigStore } from '@/stores/hrConfig'
import { cloneNonLaborInvestment, nonLaborDepartmentPairs, nonLaborItemKey, nonLaborMonths, nonLaborTotal } from '@/lib/nonLaborInvestment'
import { formatNonLaborDisplayAmount, fromNonLaborDisplayAmount, nonLaborAmountPrecision, toNonLaborDisplayAmount, type NonLaborAmountUnit } from '@/lib/nonLaborAmountUnit'
import { nonLaborSpreadsheetColumns, parseNonLaborInvestmentRows } from '@/lib/nonLaborSpreadsheet'
import { exportMultiSheet } from '@/utils/exportExcel'
import { useInlineImportSession } from '@/components/project-resources/useInlineImportSession'
import { ResourceInlineControl } from '@/components/project-resources/ResourceInlineField'
import { HrReadonlyField } from '@/components/project-resources/HrReadonlyField'
import type { NonLaborInvestment, NonLaborInvestmentItem } from '@/types/nonLaborInvestment'
import { hrNonLaborMonthRange } from '@/lib/hrNonLaborRange'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { applyNonLaborItemTotalChange } from '@/components/project-resources/nonLaborItemTotalChange'

export function useNonLaborDraft(open: boolean, editorKey: string, seed: NonLaborInvestment | undefined, category: HrProjectCategory, dates: object) {
  const seedRef = useRef(seed)
  seedRef.current = seed
  const [value, setValue] = useState<NonLaborInvestment>(() => cloneNonLaborInvestment(seed))
  useEffect(() => {
    if (open) setValue(cloneNonLaborInvestment(seedRef.current))
  }, [open, editorKey])
  return { value: { ...value, ...hrNonLaborMonthRange(category, dates) }, onChange: setValue }
}

export default function NonLaborInvestmentSection({ value, onChange, onItemTotalChange, readOnly = false, inline = false, canImport, unit = '元' }: {
  value: NonLaborInvestment; onChange?: (value: NonLaborInvestment) => void; onItemTotalChange?: (itemId: string, value: number) => void
  readOnly?: boolean; inline?: boolean; canImport?: () => boolean; unit?: NonLaborAmountUnit
}) {
  const { modal, message } = App.useApp()
  const config = useHrConfigStore(state => state.data)
  const subjects = config.nonLaborSubject ?? []
  const departmentRecords = config.techModuleDept ?? []
  const departments = nonLaborDepartmentPairs(departmentRecords)
  const [importing, setImporting] = useState(false)
  const importSession = useInlineImportSession()
  const importPermission = useRef({ readOnly, canImport, unit })
  importPermission.current = { readOnly, canImport, unit }
  const currentValueRef = useRef(value)
  currentValueRef.current = value
  const active = subjects.filter(subject => subject.enabled !== false)
  const months = nonLaborMonths(value)
  const displayAmount = (amount: number) => toNonLaborDisplayAmount(amount, unit)
  const storedAmount = (amount: number | null) => fromNonLaborDisplayAmount(amount ?? 0, unit)
  const formatAmount = (amount: number) => formatNonLaborDisplayAmount(amount, unit)
  const unitSuffix = unit === '万元' ? '（万元）' : ''
  const inputFormatter = unit === '万元' ? (amount: number | string | undefined, info: { userTyping: boolean; input: string }) =>
    info.userTyping ? info.input : Number(amount ?? 0).toLocaleString('zh-CN', { useGrouping: false, maximumFractionDigits: 6 }) : undefined
  const itemTotal = (item: NonLaborInvestmentItem) => Math.round(months.reduce((sum, month) => sum + (item.monthlyAmounts[month] ?? 0), 0) * 100) / 100
  const isDuplicate = (item: NonLaborInvestmentItem) => [item.secondaryDepartment, item.tertiaryDepartment, item.secondarySubject, item.tertiarySubject].every(Boolean)
    && value.items.some(other => other.id !== item.id && nonLaborItemKey(other) === nonLaborItemKey(item))
  const update = (id: string, change: Partial<NonLaborInvestmentItem>) => {
    const item = value.items.find(row => row.id === id)
    if (!item) return
    const next = { ...item, ...change }
    if (isDuplicate(next)) {
      if (inline) throw new Error('二级部门、三级部门、二级科目和三级科目组合不能重复')
      message.warning('二级部门、三级部门、二级科目和三级科目组合不能重复')
      return
    }
    onChange?.({ ...value, items: value.items.map(row => row.id === id ? next : row) })
  }
  const downloadTemplate = () => exportMultiSheet([
    { sheetName: '非人力投入', rows: [], columns: nonLaborSpreadsheetColumns(value, unit) },
    { sheetName: '部门选项', rows: departments, columns: [{ key: 'secondaryDepartment', title: '二级部门' }, { key: 'tertiaryDepartment', title: '三级部门' }] },
    { sheetName: '科目选项', rows: active, columns: [{ key: 'secondarySubject', title: '二级科目' }, { key: 'tertiarySubject', title: '三级科目' }] },
  ], `非人力投入模板${unitSuffix}.xlsx`)
  const handleImport = async (file: File) => {
    const canApply = importSession.capture(() => currentValueRef.current === value && importPermission.current.unit === unit && !importPermission.current.readOnly && (importPermission.current.canImport?.() ?? true))
    setImporting(true)
    try {
      const workbook = XLSX.read(await file.arrayBuffer())
      if (!workbook.SheetNames[0]) throw new Error('文件中没有工作表')
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 })
      const parsed = parseNonLaborInvestmentRows(rows, value, subjects, departmentRecords, value, unit)
      const apply = () => {
        if (!canApply()) {
          message.warning('当前版本、投入数据或编辑权限已变化，请重新导入')
          return
        }
        onChange?.(parsed)
        message.success(`已导入 ${parsed.items.length} 条非人力投入数据`)
      }
      if (!canApply()) { message.warning('当前版本、投入数据或编辑权限已变化，请重新导入'); return false }
      if (value.items.length) modal.confirm({
        centered: true,
        title: '确认导入非人力投入',
        content: `将用 ${parsed.items.length} 条导入数据替换当前 ${value.items.length} 条非人力投入${inline ? '，确认后立即生效。' : '，保存版本后生效。'}`,
        okText: '确认导入', cancelText: '取消', onOk: apply,
      })
      else apply()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '文件解析失败，请检查模板格式')
    } finally {
      setImporting(false)
    }
    return false
  }
  const columns: ColumnsType<NonLaborInvestmentItem> = [
    { title: '二级部门', key: 'secondaryDepartment', width: 140, fixed: 'left',
      render: (_, item) => readOnly ? item.secondaryDepartment || '—' : <Select
        aria-label="非人力二级部门" showSearch optionFilterProp="label" placeholder="请选择二级部门"
        style={{ width: '100%' }} value={item.secondaryDepartment || undefined}
        options={[...new Set([...departments.map(row => row.secondaryDepartment), ...(item.secondaryDepartment ? [item.secondaryDepartment] : [])])].map(label => ({ value: label, label }))}
        onChange={secondaryDepartment => update(item.id, { secondaryDepartment, tertiaryDepartment: '' })} /> },
    { title: '三级部门', key: 'tertiaryDepartment', width: 140, fixed: 'left',
      render: (_, item) => {
        if (readOnly) return item.tertiaryDepartment || '—'
        if (!item.secondaryDepartment) return <HrReadonlyField label="非人力三级部门" placeholder="请先选择二级部门" reason="选择二级部门后可编辑" />
        const options = [...new Set([
          ...departments.filter(row => row.secondaryDepartment === item.secondaryDepartment).map(row => row.tertiaryDepartment),
          ...(item.tertiaryDepartment ? [item.tertiaryDepartment] : []),
        ])].map(label => ({ value: label, label, disabled: isDuplicate({ ...item, tertiaryDepartment: label }) }))
        return <Select aria-label="非人力三级部门" showSearch optionFilterProp="label" placeholder="请选择三级部门"
          style={{ width: '100%' }} value={item.tertiaryDepartment || undefined} options={options}
          onChange={tertiaryDepartment => update(item.id, { tertiaryDepartment })} />
      } },
    { title: '二级科目', key: 'secondarySubject', width: 160, fixed: 'left',
      render: (_, item) => readOnly ? item.secondarySubject : <Select
        aria-label="二级科目" showSearch optionFilterProp="label" placeholder="请选择二级科目"
        style={{ width: '100%' }} value={item.secondarySubject || undefined}
        options={[...new Set([...active.map(subject => String(subject.secondarySubject)), ...(item.secondarySubject ? [item.secondarySubject] : [])])].map(label => ({ value: label, label }))}
        onChange={secondarySubject => update(item.id, { secondarySubject, tertiarySubject: '', subjectId: '' })} /> },
    { title: '三级科目', key: 'tertiarySubject', width: 160, fixed: 'left',
      render: (_, item) => {
        if (readOnly) return item.tertiarySubject
        if (!item.secondarySubject) return <HrReadonlyField label="三级科目" placeholder="请先选择二级科目" reason="选择二级科目后可编辑" />
        const available = active.filter(subject => subject.secondarySubject === item.secondarySubject)
        const options = available.map(subject => ({
          value: subject.id, label: String(subject.tertiarySubject),
          disabled: isDuplicate({ ...item, secondarySubject: String(subject.secondarySubject), tertiarySubject: String(subject.tertiarySubject) }),
        }))
        // Retired/renamed subjects are only retained for their existing row.
        if (item.subjectId && !options.some(option => option.value === item.subjectId && option.label === item.tertiarySubject)) {
          const sameId = options.findIndex(option => option.value === item.subjectId)
          if (sameId >= 0) options.splice(sameId, 1)
          options.push({ value: item.subjectId, label: item.tertiarySubject, disabled: isDuplicate(item) })
        }
        return <Select aria-label="三级科目" showSearch optionFilterProp="label"
          placeholder="请选择三级科目" style={{ width: '100%' }} value={item.subjectId || undefined}
          options={options} onChange={id => {
            const subject = available.find(row => row.id === id)
            if (subject) update(item.id, { subjectId: id, tertiarySubject: String(subject.tertiarySubject) })
          }} />
      } },
    { title: `预估投入合计${unitSuffix}`, key: 'total', width: 140, align: 'center' as const,
      render: (_: unknown, item: NonLaborInvestmentItem) => readOnly ? formatAmount(itemTotal(item)) : <InputNumber controls={false}
        aria-label={`${item.secondaryDepartment || '未选择部门'} ${item.tertiarySubject || '未选择科目'} 预估投入合计（${unit}）`}
        min={0} precision={nonLaborAmountPrecision(unit)} formatter={inputFormatter} step={1} style={{ width: '100%' }} value={displayAmount(itemTotal(item))}
        onChange={amount => applyNonLaborItemTotalChange({ value, itemId: item.id, amount: storedAmount(amount), inline, onChange, onItemTotalChange, onError: text => message.warning(text) })} /> },
    ...months.map(month => ({ title: dayjs(month + '-01').format('YYYY年MM月'), key: month, width: 126, align: 'center' as const,
      render: (_: unknown, item: NonLaborInvestmentItem) => readOnly ? formatAmount(item.monthlyAmounts[month] ?? 0) : <InputNumber controls={false}
        aria-label={[item.secondaryDepartment, item.tertiaryDepartment, item.secondarySubject, item.tertiarySubject, month, `非人力投入（${unit}）`].join(' ')} min={0} precision={nonLaborAmountPrecision(unit)} formatter={inputFormatter} step={1}
        style={{ width: '100%' }} value={displayAmount(item.monthlyAmounts[month] ?? 0)}
        onChange={amount => update(item.id, { monthlyAmounts: { ...item.monthlyAmounts, [month]: storedAmount(amount) } })} /> })),
    ...(!readOnly ? [{ title: '操作', key: 'actions', width: 64, fixed: 'right' as const,
      render: (_: unknown, item: NonLaborInvestmentItem) => <Button type="text" danger size="small"
        aria-label={'删除非人力科目 ' + (item.tertiarySubject || '未选择')} icon={<DeleteOutlined />}
        onClick={() => onChange?.({ ...value, items: value.items.filter(row => row.id !== item.id) })} /> }] : []),
  ]
  const displayColumns = inline && !readOnly ? columns.map(column => {
    if (column.key === 'actions' || !column.render) return column
    const render = column.render
    return { ...column, render: (value: unknown, item: NonLaborInvestmentItem, index: number) => {
      const control = render(value, item, index)
      if (!isValidElement(control) || !('onChange' in control.props)) return control
      const label = String((control.props as { 'aria-label'?: string })['aria-label'] ?? column.title)
      const display = column.key === 'tertiarySubject' ? item.tertiarySubject || '待填写' : undefined
      return <ResourceInlineControl label={label} control={control} display={display} />
    } }
  }) : columns
  return <section className="pms-non-labor-section" aria-label={`非人力投入${unitSuffix}`}>
    <h3>{`非人力投入${unitSuffix}`}</h3>
    <Alert className="pms-non-labor-summary" type="info" showIcon title={<div className="pms-non-labor-toolbar">
      <span>{'费用预估投入合计：' + formatAmount(nonLaborTotal(value)) + ` ${unit}。`}</span>
      <div className="pms-non-labor-range">
        <span>投入时间范围</span>
        <span aria-label="费用投入时间范围" title="根据当前版本里程碑时间自动生成">{value.startMonth && value.endMonth ? dayjs(value.startMonth + '-01').format('YYYY年MM月') + '～' + dayjs(value.endMonth + '-01').format('YYYY年MM月') : '待填写里程碑时间'}</span>
      </div>
    </div>} />
    {!readOnly && <div className="pms-non-labor-actions">
      <Space size="small">
        <Button size="small" type="dashed" icon={<PlusOutlined />} disabled={importing}
          aria-label="添加非人力投入" onClick={() => onChange?.({ ...value, items: [...value.items, {
            id: 'non-labor-' + crypto.randomUUID(), secondaryDepartment: '', tertiaryDepartment: '',
            subjectId: '', secondarySubject: '', tertiarySubject: '', monthlyAmounts: {},
          }] })}>添加</Button>
        <Button size="small" type="dashed" icon={<DownloadOutlined />} disabled={!months.length}
          aria-label={`下载非人力投入模板${unitSuffix}`} onClick={downloadTemplate}>下载模板</Button>
        <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleImport} disabled={!months.length || importing}>
          <Button size="small" type="dashed" icon={<UploadOutlined />} disabled={!months.length} loading={importing}
            aria-label={`导入非人力投入${unitSuffix}`}>导入</Button>
        </Upload>
      </Space>
    </div>}
    <Table className="pms-table pms-hr-investment-table" rowKey="id" columns={displayColumns} dataSource={value.items}
      pagination={false} size="small" tableLayout="fixed" scroll={{ x: 740 + (readOnly ? 0 : 64) + months.length * 126, y: 320 }}
      locale={{ emptyText: readOnly ? '暂无非人力投入' : months.length ? '暂无非人力投入数据，请点击「添加」或「导入」' : '暂无非人力投入数据，可先点击「添加」配置部门和科目，填写里程碑后自动生成月份' }}
      summary={() => value.items.length > 0 ? <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={4}>合计</Table.Summary.Cell>
        <Table.Summary.Cell index={4} align="center">{formatAmount(nonLaborTotal(value))}</Table.Summary.Cell>
        {months.map((month, index) => <Table.Summary.Cell key={month} index={index + 5} align="center">
          {formatAmount(value.items.reduce((sum, item) => sum + (item.monthlyAmounts[month] ?? 0), 0))}
        </Table.Summary.Cell>)}
        {!readOnly && <Table.Summary.Cell index={months.length + 5} />}
      </Table.Summary.Row> : null} />
  </section>
}
