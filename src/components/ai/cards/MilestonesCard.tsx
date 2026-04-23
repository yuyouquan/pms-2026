'use client'
import { Card, Timeline, Tag, Progress } from 'antd'
import { CheckCircleFilled, ClockCircleFilled, WarningFilled } from '@ant-design/icons'
import type { MilestonesCardData } from '@/types/ai'
import { MOCK_LEVELED_PLANS } from '@/mock/ai-extended'

const STATUS_ICON = {
  '已完成': <CheckCircleFilled style={{ color: '#52c41a' }} />,
  '进行中': <ClockCircleFilled style={{ color: '#1677ff' }} />,
  '未开始': <ClockCircleFilled style={{ color: '#d9d9d9' }} />,
  '延期': <WarningFilled style={{ color: '#ff4d4f' }} />,
  '阻塞': <WarningFilled style={{ color: '#ff4d4f' }} />,
}

export function MilestonesCard({ data }: { data: MilestonesCardData }) {
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>🏁 里程碑（一级计划）</div>
      <Timeline
        items={data.milestones.map(m => {
          const childCount = MOCK_LEVELED_PLANS.filter(
            p => p.level === 'L2' && p.parentId === m.id
          ).length
          return {
          dot: STATUS_ICON[m.status as keyof typeof STATUS_ICON],
          children: (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 500, fontSize: 13,
                  color: m.isRisk ? '#ff4d4f' : undefined }}>{m.name}</span>
                <Tag style={{ margin: 0 }} color={m.status === '已完成' ? 'green' : m.status === '延期' ? 'red' : 'blue'}>
                  {m.status}
                </Tag>
                {m.isRisk && <Tag color="red" style={{ margin: 0 }}>⚠️ 风险</Tag>}
                {childCount > 0 && (
                  <Tag color="geekblue" style={{ margin: 0 }}>
                    含 {childCount} 个二级计划
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                负责人: {m.owner} · 计划: {m.planDate}
                {m.actualDate ? ` · 实际: ${m.actualDate}` : ''}
              </div>
              {m.progress > 0 && m.progress < 100 && (
                <Progress percent={m.progress} size="small" showInfo={false}
                  style={{ width: 200, marginTop: 4 }} />
              )}
              {m.description && (
                <div style={{ fontSize: 11, color: '#8c8c8c', fontStyle: 'italic', marginTop: 4 }}>
                  {m.description}
                </div>
              )}
            </div>
          ),
        }
        })}
      />
    </Card>
  )
}
