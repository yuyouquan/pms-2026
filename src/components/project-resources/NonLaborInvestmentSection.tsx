'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, App, Button, DatePicker, InputNumber, Select, Table } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useHrConfigStore } from '@/stores/hrConfig'
import { cloneNonLaborInvestment, nonLaborMonths, nonLaborTotal } from '@/lib/nonLaborInvestment'
import type { NonLaborInvestment, NonLaborInvestmentItem } from '@/types/nonLaborInvestment'

export function useNonLaborDraft(open: boolean, editorKey: string, seed?: NonLaborInvestment) {
  const seedRef = useRef(seed)
  seedRef.current = seed
  const [value, setValue] = useState<NonLaborInvestment>(() => cloneNonLaborInvestment(seed))
  useEffect(() => {
    if (open) setValue(cloneNonLaborInvestment(seedRef.current))
  }, [open, editorKey])
  return { value, onChange: setValue }
}

export default function NonLaborInvestmentSection({ value, onChange, readOnly = false }: {
  value: NonLaborInvestment; onChange?: (value: NonLaborInvestment) => void; readOnly?: boolean
}) {
  const { modal } = App.useApp()
  const subjects = useHrConfigStore(state => state.data.nonLaborSubject ?? [])
  const active = subjects.filter(subject => subject.enabled !== false)
  const months = nonLaborMonths(value)
  const update = (id: string, change: Partial<NonLaborInvestmentItem>) =>
    onChange?.({ ...value, items: value.items.map(item => item.id === id ? { ...item, ...change } : item) })
  const changeRange = (startMonth: string | null, endMonth: string | null) => {
    const allowed = nonLaborMonths({ startMonth, endMonth })
    const outside = value.items.some(item => Object.entries(item.monthlyAmounts).some(([month, amount]) => !allowed.includes(month) && amount !== 0))
    const save = () => onChange?.({ startMonth, endMonth,
      items: value.items.map(item => ({ ...item, monthlyAmounts: Object.fromEntries(Object.entries(item.monthlyAmounts).filter(([month]) => allowed.includes(month))) })),
    })
    if (outside) modal.confirm({
      title: '确认修改非人力投入时间范围',
      content: '新范围之外的已填投入将被移除，确认后生效。',
      okText: '确认修改', cancelText: '保留原范围', onOk: save,
    })
    else save()
  }
  const columns: ColumnsType<NonLaborInvestmentItem> = [
    { title: '二级科目', key: 'secondarySubject', width: 170, fixed: 'left',
      render: (_, item) => readOnly ? item.secondarySubject : <Select
        aria-label="二级科目" showSearch optionFilterProp="label" placeholder="请选择二级科目"
        style={{ width: '100%' }} value={item.secondarySubject || undefined}
        options={[...new Set([...active.map(subject => String(subject.secondarySubject)), ...(item.secondarySubject ? [item.secondarySubject] : [])])].map(label => ({ value: label, label }))}
        onChange={secondarySubject => update(item.id, { secondarySubject, tertiarySubject: '', subjectId: '' })} /> },
    { title: '三级科目', key: 'tertiarySubject', width: 170, fixed: 'left',
      render: (_, item) => {
        if (readOnly) return item.tertiarySubject
        const available = active.filter(subject => subject.secondarySubject === item.secondarySubject)
        const options = available.map(subject => ({
          value: subject.id, label: String(subject.tertiarySubject),
          disabled: value.items.some(other => other.id !== item.id && other.secondarySubject === subject.secondarySubject && other.tertiarySubject === subject.tertiarySubject),
        }))
        // Retired/renamed subjects are only retained for their existing row.
        if (item.subjectId && !options.some(option => option.value === item.subjectId && option.label === item.tertiarySubject)) {
          const sameId = options.findIndex(option => option.value === item.subjectId)
          if (sameId >= 0) options.splice(sameId, 1)
          options.push({ value: item.subjectId, label: item.tertiarySubject, disabled: false })
        }
        return <Select aria-label="三级科目" showSearch optionFilterProp="label"
          placeholder="请选择三级科目" style={{ width: '100%' }} value={item.subjectId || undefined}
          options={options} onChange={id => {
            const subject = available.find(row => row.id === id)
            if (subject) update(item.id, { subjectId: id, tertiarySubject: String(subject.tertiarySubject) })
          }} />
      } },
    ...months.map(month => ({ title: dayjs(month + '-01').format('YYYY年MM月'), key: month, width: 126, align: 'right' as const,
      render: (_: unknown, item: NonLaborInvestmentItem) => readOnly ? (item.monthlyAmounts[month] ?? 0) : <InputNumber
        aria-label={item.tertiarySubject + ' ' + month + ' 非人力投入'} min={0} precision={2} step={0.1}
        style={{ width: '100%' }} value={item.monthlyAmounts[month] ?? 0}
        onChange={amount => update(item.id, { monthlyAmounts: { ...item.monthlyAmounts, [month]: amount ?? 0 } })} /> })),
    ...(!readOnly ? [{ title: '操作', key: 'actions', width: 64, fixed: 'right' as const,
      render: (_: unknown, item: NonLaborInvestmentItem) => <Button type="text" danger size="small"
        aria-label={'删除非人力科目 ' + (item.tertiarySubject || '未选择')} icon={<DeleteOutlined />}
        onClick={() => onChange?.({ ...value, items: value.items.filter(row => row.id !== item.id) })} /> }] : []),
  ]
  return <section className="pms-non-labor-section" aria-label="非人力投入">
    <h3>非人力投入</h3>
    <div className="pms-non-labor-toolbar">
      <Alert type="info" showIcon title={'预估非人力投入合计：' + nonLaborTotal(value) + ' 人月。'} />
      <div className="pms-non-labor-range">
        <span>投入时间范围</span>
        {readOnly ? <span>{value.startMonth && value.endMonth ? dayjs(value.startMonth + '-01').format('YYYY年MM月') + '～' + dayjs(value.endMonth + '-01').format('YYYY年MM月') : '—'}</span>
          : <DatePicker.RangePicker picker="month" format="YYYY年MM月" allowClear={false}
            aria-label="非人力投入时间范围" placeholder={['开始月份', '结束月份']}
            value={value.startMonth && value.endMonth ? [dayjs(value.startMonth + '-01'), dayjs(value.endMonth + '-01')] : null}
            onChange={dates => changeRange(dates?.[0]?.format('YYYY-MM') ?? null, dates?.[1]?.format('YYYY-MM') ?? null)} />}
      </div>
    </div>
    <Table className="pms-table pms-hr-investment-table" rowKey="id" columns={columns} dataSource={value.items}
      pagination={false} size="small" scroll={{ x: Math.max(600, 404 + months.length * 126) }}
      locale={{ emptyText: months.length ? '暂无非人力投入' : '请选择投入时间范围' }}
      summary={() => value.items.length > 0 ? <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell>
        {months.map((month, index) => <Table.Summary.Cell key={month} index={index + 2} align="right">
          {Math.round(value.items.reduce((sum, item) => sum + (item.monthlyAmounts[month] ?? 0), 0) * 100) / 100}
        </Table.Summary.Cell>)}
        {!readOnly && <Table.Summary.Cell index={months.length + 2} />}
      </Table.Summary.Row> : null} />
    {!readOnly && <Button type="dashed" block icon={<PlusOutlined />} disabled={!months.length}
      aria-label="添加非人力投入" onClick={() => onChange?.({ ...value, items: [...value.items, {
        id: 'non-labor-' + crypto.randomUUID(), subjectId: '', secondarySubject: '', tertiarySubject: '', monthlyAmounts: {},
      }] })}>添加</Button>}
  </section>
}
