'use client'

import { Card, Space } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import type { ProjectItem } from '@/types/app'
import ProjectRoadmapModule from './ProjectRoadmapModule'

interface RoadmapViewProps {
  projects: ProjectItem[]
  onViewProject: (projectId: string, market?: string) => void
}

export default function RoadmapView({ projects, onViewProject }: RoadmapViewProps) {
  return (
    <div className="pms-roadmap-view">
      <div className="pms-roadmap-view-header pms-glass-surface" style={{
        borderRadius: '12px 12px 0 0', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Space size={12}>
          <GlobalOutlined style={{ fontSize: 20, color: 'var(--pms-brand-strong)' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--pms-text-primary)', lineHeight: 1.2 }}>
              tOS路标
            </div>
            <div style={{ fontSize: 11, color: 'var(--pms-text-secondary)', marginTop: 2 }}>全局查看 tOS 路标、版本演进与项目规划</div>
          </div>
        </Space>
      </div>

      <Card
        className="pms-roadmap-view-card"
        rootClassName="pms-solid-surface"
        style={{ borderRadius: '0 0 12px 12px', borderTop: 'none', overflow: 'visible' }}
        styles={{ body: { padding: '16px 20px 20px', overflow: 'visible' } }}
      >
        <ProjectRoadmapModule projects={projects} onViewProject={onViewProject} />
      </Card>
    </div>
  )
}
