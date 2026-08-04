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
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
        borderRadius: '12px 12px 0 0', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Space size={12}>
          <GlobalOutlined style={{ fontSize: 20, color: '#fff' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              tOS路标
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>全局查看 tOS 路标、版本演进与项目规划</div>
          </div>
        </Space>
      </div>

      <Card
        className="pms-roadmap-view-card"
        style={{ borderRadius: '0 0 12px 12px', borderTop: 'none', overflow: 'visible' }}
        styles={{ body: { padding: '16px 20px 20px', overflow: 'visible' } }}
      >
        <ProjectRoadmapModule projects={projects} onViewProject={onViewProject} />
      </Card>
    </div>
  )
}
