'use client'
import { Card, Descriptions, Tag } from 'antd'
import type { ProductInfoCardData2 } from '@/types/ai'

export function ProductInfoCardV2({ data }: { data: ProductInfoCardData2 }) {
  const s = data.spec
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 20 }}>📱</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{s.codename} · {s.marketName}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{s.brand} · {s.productType}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {s.markets.map(m => <Tag key={m} color="blue" style={{ margin: 0 }}>{m}</Tag>)}
        </div>
      </div>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="处理器">{s.cpu}</Descriptions.Item>
        <Descriptions.Item label="存储">{s.memory}</Descriptions.Item>
        <Descriptions.Item label="屏幕">{s.lcd}</Descriptions.Item>
        <Descriptions.Item label="前摄">{s.frontCamera}</Descriptions.Item>
        <Descriptions.Item label="后摄">{s.primaryCamera}</Descriptions.Item>
        <Descriptions.Item label="平台">{s.chipPlatform}</Descriptions.Item>
        <Descriptions.Item label="操作系统">{s.os}</Descriptions.Item>
        <Descriptions.Item label="tOS 版本">{s.tosVersion}</Descriptions.Item>
        <Descriptions.Item label="发布日期">{s.launchDate}</Descriptions.Item>
        <Descriptions.Item label="当前阶段"><Tag color="blue">{s.currentStage}</Tag></Descriptions.Item>
        <Descriptions.Item label="SPM">{s.spm}</Descriptions.Item>
        <Descriptions.Item label="TPM / PPM">{s.tpm} / {s.ppm}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
