'use client'
import { Card, Row, Col, Statistic, Tag } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons'
import type { VersionCompareCardData } from '@/types/ai'

function DeltaBadge({ value, reverse = false }: { value: number; reverse?: boolean }) {
  if (value === 0) return <Tag icon={<MinusOutlined />} style={{ margin: 0 }}>无变化</Tag>
  const isGood = reverse ? value < 0 : value > 0
  const color = isGood ? 'success' : 'error'
  const icon = value > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />
  return <Tag color={color} icon={icon} style={{ margin: 0 }}>{value > 0 ? '+' : ''}{value}</Tag>
}

export function VersionCompareCard({ data }: { data: VersionCompareCardData }) {
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
        📊 版本对比
      </div>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card size="small" title={
            <span>
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{data.a.versionNumber}</span>
              <Tag style={{ marginLeft: 4 }}>{data.a.market}</Tag>
              <Tag color="default">{data.a.buildType}</Tag>
              <span style={{ fontSize: 11, color: '#8c8c8c' }}> (旧)</span>
            </span>
          } style={{ background: '#fafafa' }}>
            <Row>
              <Col span={8}><Statistic title="稳定性" value={data.a.stabilityScore} suffix="/100" /></Col>
              <Col span={8}><Statistic title="性能" value={data.a.perfScore} suffix="/100" /></Col>
              <Col span={8}><Statistic title="缺陷" value={data.a.defectCount} /></Col>
            </Row>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 8 }}>{data.a.releaseDate}</div>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={
            <span>
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{data.b.versionNumber}</span>
              <Tag style={{ marginLeft: 4 }}>{data.b.market}</Tag>
              <Tag color="default">{data.b.buildType}</Tag>
              <span style={{ fontSize: 11, color: '#8c8c8c' }}> (新)</span>
            </span>
          } style={{ background: '#e6f4ff', borderColor: '#91caff' }}>
            <Row>
              <Col span={8}>
                <Statistic title="稳定性" value={data.b.stabilityScore} suffix="/100" />
                <DeltaBadge value={data.stabilityDelta} />
              </Col>
              <Col span={8}>
                <Statistic title="性能" value={data.b.perfScore} suffix="/100" />
                <DeltaBadge value={data.perfDelta} />
              </Col>
              <Col span={8}>
                <Statistic title="缺陷" value={data.b.defectCount} />
                <DeltaBadge value={data.defectDelta} reverse />
              </Col>
            </Row>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 8 }}>{data.b.releaseDate}</div>
          </Card>
        </Col>
      </Row>
    </Card>
  )
}
