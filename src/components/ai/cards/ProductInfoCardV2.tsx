'use client'
import { Card, Descriptions, Tag, Tabs } from 'antd'
import type { ProductInfoCardData2 } from '@/types/ai'

export function ProductInfoCardV2({ data }: { data: ProductInfoCardData2 }) {
  const s = data.spec
  const perMarket = s.perMarket
  const markets = perMarket ? Object.keys(perMarket) : []

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

      <Descriptions column={2} size="small" bordered
        title={<span style={{ fontSize: 13, fontWeight: 500 }}>🔧 硬件 / 平台规格（通用）</span>}>
        <Descriptions.Item label="处理器">{s.cpu}</Descriptions.Item>
        <Descriptions.Item label="存储">{s.memory}</Descriptions.Item>
        <Descriptions.Item label="屏幕">{s.lcd}</Descriptions.Item>
        <Descriptions.Item label="前摄">{s.frontCamera}</Descriptions.Item>
        <Descriptions.Item label="后摄">{s.primaryCamera}</Descriptions.Item>
        <Descriptions.Item label="平台">{s.chipPlatform}</Descriptions.Item>
        <Descriptions.Item label="操作系统">{s.os}</Descriptions.Item>
        <Descriptions.Item label="tOS 版本">{s.tosVersion}</Descriptions.Item>
        <Descriptions.Item label="当前阶段"><Tag color="blue">{s.currentStage}</Tag></Descriptions.Item>
        <Descriptions.Item label="项目等级">{s.projectLevel}</Descriptions.Item>
        <Descriptions.Item label="SPM">{s.spm}</Descriptions.Item>
        <Descriptions.Item label="TPM / PPM">{s.tpm} / {s.ppm}</Descriptions.Item>
      </Descriptions>

      {perMarket && markets.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🌍 市场专属配置</div>
          <Tabs
            size="small"
            items={markets.map(m => {
              const info = perMarket[m]
              return {
                key: m,
                label: m,
                children: (
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="上市日期">{info.launchDate}</Descriptions.Item>
                    {info.tosPatch && <Descriptions.Item label="tOS 分支">{info.tosPatch}</Descriptions.Item>}
                    <Descriptions.Item label="市场特性">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {info.keyFeatures.map(f => <Tag key={f} color="geekblue">{f}</Tag>)}
                      </div>
                    </Descriptions.Item>
                    {info.preinstalledApps && info.preinstalledApps.length > 0 && (
                      <Descriptions.Item label="预装应用">
                        {info.preinstalledApps.join(' / ')}
                      </Descriptions.Item>
                    )}
                    {info.notes && <Descriptions.Item label="备注">{info.notes}</Descriptions.Item>}
                  </Descriptions>
                ),
              }
            })}
          />
        </div>
      )}
    </Card>
  )
}
