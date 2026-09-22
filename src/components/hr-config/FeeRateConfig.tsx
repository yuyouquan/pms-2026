'use client'
import { useId } from 'react'
import { InputNumber } from 'antd'
import { CalculatorOutlined } from '@ant-design/icons'
import { useHrConfigStore, canEditHrConfig } from '@/stores/hrConfig'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import ResourceInlineField from '@/components/project-resources/ResourceInlineField'

export default function FeeRateConfig() {
  const rate = useHrConfigStore(state => Number(state.data.feeRate?.[0]?.value ?? 5))
  useProjectStore(state => state.currentLoginUser)
  usePermissionStore()
  const id = useId()
  const canEdit = canEditHrConfig('feeRate')
  const formatAmount = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 20 })
  return <section className="pms-resource-fee-config" aria-labelledby={`${id}-title`}>
    <header className="pms-fee-config-header">
      <span className="pms-fee-config-icon" aria-hidden="true"><CalculatorOutlined /></span>
      <div>
        <h2 id={`${id}-title`}>费率配置</h2>
        <p>统一设置每人月费率，用于项目资源中的人力费用计算。</p>
      </div>
    </header>
    <div className="pms-fee-config-body">
      <div className="pms-fee-config-field">
        <label htmlFor={`${id}-rate`}>每人月费率</label>
        <ResourceInlineField label="费率" value={rate} readOnly={!canEdit}
          display={<span className="pms-fee-config-readonly">{formatAmount(rate)}<span>万元</span></span>}
          onSave={value => useHrConfigStore.getState().setFeeRate(value === null ? 0 : Number(value))}
          renderEditor={(value, change) => <InputNumber id={`${id}-rate`} controls={false} min={0}
            aria-label="每人月费率" aria-describedby={`${id}-hint`} suffix="万元"
            value={value === null ? null : Number(value)} onChange={change} />} />
        <p id={`${id}-hint`} className="pms-fee-config-hint">{canEdit ? '按 Enter 或移出输入框后自动保存' : '当前为只读，无费率编辑权限'}</p>
      </div>
      <aside className="pms-fee-config-example" aria-label="费用换算说明">
        <h3>费用换算</h3>
        <p>人力费用（万元）= 投入人月 × 费率</p>
        <div className="pms-fee-config-equation" aria-live="polite">
          <span>10 人月</span><span>×</span><span>{formatAmount(rate)} 万元 / 人月</span>
          <span>=</span><strong>{formatAmount(Number((10 * rate).toPrecision(15)))}<small>万元</small></strong>
        </div>
        <p className="pms-fee-config-example-note">示例按当前已保存费率计算，保存后费用视图同步更新。</p>
      </aside>
    </div>
  </section>
}
