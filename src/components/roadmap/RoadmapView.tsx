'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Space } from 'antd'
import { AppstoreOutlined, GlobalOutlined, TableOutlined } from '@ant-design/icons'
import type { ProjectItem } from '@/types/app'
import ProjectPlanSummaryBoard from './ProjectPlanSummaryBoard'
import ProjectRoadmapModule from './ProjectRoadmapModule'
import { PROJECT_VIEW_KINDS, parseProjectViewShare } from './utils'

interface RoadmapViewProps {
  projects: ProjectItem[]
  onViewProject: (projectId: string, market?: string) => void
}

export default function RoadmapView({ projects, onViewProject }: RoadmapViewProps) {
  const [activeProjectView, setActiveProjectView] = useState<'summary' | 'roadmap'>('summary')

  useEffect(() => {
    const sharedView = parseProjectViewShare()
    if (sharedView?.kind === PROJECT_VIEW_KINDS.roadmapMilestone) {
      setActiveProjectView('roadmap')
    }
    if (sharedView?.kind === PROJECT_VIEW_KINDS.summaryBoard) {
      setActiveProjectView('summary')
    }
  }, [])

  const PROJECT_VIEW_OPTIONS = [
    { key: 'summary' as const, label: '项目计划汇总看板', icon: <TableOutlined /> },
    { key: 'roadmap' as const, label: 'tOS 路标视图', icon: <GlobalOutlined /> },
  ]

  return (
    <div>
      {/* 顶部标题栏 + 视图切换 */}
      <div style={{
        background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
        borderRadius: '12px 12px 0 0', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Space size={12}>
          <AppstoreOutlined style={{ fontSize: 20, color: '#fff' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              {activeProjectView === 'roadmap' ? 'tOS 路标视图' : '项目视图'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>全局查看项目计划汇总、tOS 路标与版本演进</div>
          </div>
        </Space>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 4px', background: 'rgba(255,255,255,0.15)', borderRadius: 22,
        }}>
          {PROJECT_VIEW_OPTIONS.map(v => {
            const isActive = activeProjectView === v.key
            return (
              <Button
                key={v.key}
                type="text"
                onClick={() => setActiveProjectView(v.key)}
                aria-pressed={isActive}
                style={{
                  padding: '5px 18px', borderRadius: 18, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.25s',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? '#4338ca' : 'rgba(255,255,255,0.85)',
                  boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {v.icon}
                {v.label}
              </Button>
            )
          })}
        </div>
      </div>

      <Card
        className="pms-roadmap-view-card"
        style={{ borderRadius: '0 0 12px 12px', borderTop: 'none', overflow: 'visible' }}
        styles={{ body: { padding: '16px 20px 20px', overflow: 'visible' } }}
      >
        {activeProjectView === 'summary' ? (
          <ProjectPlanSummaryBoard projects={projects} onViewProject={onViewProject} />
        ) : (
          <ProjectRoadmapModule projects={projects} onViewProject={onViewProject} />
        )}
      </Card>
    </div>
  )
}
