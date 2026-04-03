'use client'

import { useState } from 'react'
import { Card, Space } from 'antd'
import { GlobalOutlined, FlagOutlined, RocketOutlined } from '@ant-design/icons'
import MilestoneView from './MilestoneView'
import MRTrainView from './MRTrainView'

interface RoadmapViewProps {
  projects: any[]
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>
  level1Tasks: any[]
  onViewProject: (projectId: string, market?: string) => void
}

export default function RoadmapView({ projects, marketPlanData, level1Tasks, onViewProject }: RoadmapViewProps) {
  const [activeView, setActiveView] = useState<'milestone' | 'mr-train'>('milestone')

  const VIEW_OPTIONS = [
    { key: 'milestone' as const, label: '里程碑视图', icon: <FlagOutlined /> },
    { key: 'mr-train' as const, label: 'MR版本火车视图', icon: <RocketOutlined /> },
  ]

  return (
    <div>
      {/* 顶部标题栏 + 视图切换 */}
      <div style={{
        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        borderRadius: '12px 12px 0 0', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Space size={12}>
          <GlobalOutlined style={{ fontSize: 20, color: '#fff' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>项目路标视图</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>全局视角查看各项目里程碑计划与进展</div>
          </div>
        </Space>
        {/* 视图类型切换 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 4px', background: 'rgba(255,255,255,0.15)', borderRadius: 22,
        }}>
          {VIEW_OPTIONS.map(v => {
            const isActive = activeView === v.key
            return (
              <div
                key={v.key}
                onClick={() => setActiveView(v.key)}
                style={{
                  padding: '5px 18px', borderRadius: 18, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.25s',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? '#1890ff' : 'rgba(255,255,255,0.85)',
                  boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {v.icon}
                {v.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* 内容区域 */}
      <Card
        style={{ borderRadius: '0 0 12px 12px', borderTop: 'none' }}
        styles={{ body: { padding: '16px 20px 20px' } }}
      >
        {activeView === 'mr-train' ? (
          <MRTrainView onViewProject={onViewProject} />
        ) : (
          <MilestoneView
            projects={projects}
            marketPlanData={marketPlanData}
            level1Tasks={level1Tasks}
            onViewProject={onViewProject}
          />
        )}
      </Card>
    </div>
  )
}
