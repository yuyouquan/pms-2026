'use client'

import { Button, Form, InputNumber, Select } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { isValidTrialQuantity, readFanTrialRows, selectFanTrialCountries } from '@/lib/fanTrial'
import type { EnumOption } from '@/lib/enumConsumers'
import type { ProjectInfoValue } from '@/types/app'

interface FanTrialCountriesProps {
  value?: ProjectInfoValue
  id?: string
  options?: EnumOption[]
  onChange?: (value: ProjectInfoValue) => void
}

function TrialTotal({ value }: Pick<FanTrialCountriesProps, 'value'>) {
  const rows = readFanTrialRows(value)
  const total = rows.reduce((sum, row) => sum + (isValidTrialQuantity(row.quantity) ? row.quantity : 0), 0)
  const incomplete = rows.some(row => !isValidTrialQuantity(row.quantity))
  return <div className="pms-fan-trial-total">共 {rows.length} 个国家，{incomplete ? '已填写' : '合计'} {Number.isSafeInteger(total) ? total : '—'} 台{incomplete ? '（部分台数待填写）' : ''}</div>
}

export function FanTrialCountryEditor({ value, id, options = [], onChange }: FanTrialCountriesProps) {
  const rows = readFanTrialRows(value)
  const { errors } = Form.Item.useStatus()
  return (
    <div className="pms-fan-trial">
      <Select
        id={id}
        aria-label="粉丝试用国家"
        mode="multiple"
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder={options.length ? '请选择粉丝试用国家，可多选' : '暂无可用国家，请先在配置中心维护“粉丝试用国家”'}
        options={options}
        value={rows.map(row => row.country)}
        onChange={countries => onChange?.(selectFanTrialCountries(countries, rows))}
      />
      {rows.length > 0 && <>
        <table className="pms-fan-trial-table" aria-label="粉丝试用台数配置">
          <thead><tr><th scope="col">国家</th><th scope="col">试用台数</th><th scope="col" className="pms-fan-trial-action">操作</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.country}>
            <td>{row.country}{options.find(option => option.value === row.country)?.disabled && <span className="pms-fan-trial-retired">（已停用）</span>}</td>
            <td><InputNumber
              aria-label={`${row.country}试用台数`}
              min={1}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              value={row.quantity}
              placeholder="请输入正整数"
              status={errors.length && !isValidTrialQuantity(row.quantity) ? 'error' : undefined}
              onChange={quantity => onChange?.(rows.map(item => item.country === row.country ? { ...item, quantity } : item))}
            /></td>
            <td className="pms-fan-trial-action"><Button type="text" danger icon={<DeleteOutlined />} aria-label={`移除${row.country}`} onClick={() => onChange?.(rows.filter(item => item.country !== row.country))} /></td>
          </tr>)}</tbody>
        </table>
        <TrialTotal value={value} />
      </>}
    </div>
  )
}

export function FanTrialCountrySummary({ value }: Pick<FanTrialCountriesProps, 'value'>) {
  const rows = readFanTrialRows(value)
  if (!rows.length) return <span className="pms-project-info-empty">待配置</span>
  return <div className="pms-fan-trial">
    <table className="pms-fan-trial-table" aria-label="粉丝试用台数">
      <thead><tr><th scope="col">国家</th><th scope="col">试用台数</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.country}><td>{row.country}</td><td>{isValidTrialQuantity(row.quantity) ? `${row.quantity} 台` : '待填写'}</td></tr>)}</tbody>
    </table>
    <TrialTotal value={value} />
  </div>
}
