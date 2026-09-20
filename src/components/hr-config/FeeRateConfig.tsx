'use client'
import { Card, InputNumber } from 'antd'
import { useHrConfigStore, canEditHrConfig } from '@/stores/hrConfig'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import ResourceInlineField from '@/components/project-resources/ResourceInlineField'

export default function FeeRateConfig() {
  const rate = useHrConfigStore(state => Number(state.data.feeRate?.[0]?.value ?? 5))
  useProjectStore(state => state.currentLoginUser)
  usePermissionStore()
  return <Card size="small" title="费率" className="pms-resource-fee-config">
    <div style={{ width: 240, display: 'flex', alignItems: 'center', gap: 8 }}>
      <ResourceInlineField label="费率" value={rate} readOnly={!canEditHrConfig('feeRate')}
        onSave={value => useHrConfigStore.getState().setFeeRate(value === null ? 0 : Number(value))}
        renderEditor={(value, change) => <InputNumber autoFocus controls={false} min={0} aria-label="费率" value={Number(value)} onChange={change} />} />
      <span>万元</span>
    </div>
  </Card>
}
