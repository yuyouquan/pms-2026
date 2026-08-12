'use client'

import { Card } from 'antd'
import type { ProjectItem } from '@/types/app'
import ProjectRoadmapModule from './ProjectRoadmapModule'

interface RoadmapViewProps {
  projects: ProjectItem[]
  onViewProject: (projectId: string, market?: string) => void
}

export default function RoadmapView({ projects, onViewProject }: RoadmapViewProps) {
  return (
    <div className="pms-roadmap-view">
      <span className="pms-visually-hidden">tOS路标</span>
      <Card
        className="pms-roadmap-view-card"
        rootClassName="pms-solid-surface"
        bordered={false}
        style={{ borderRadius: 0, border: 0, overflow: 'visible', background: 'transparent', boxShadow: 'none' }}
        styles={{ body: { padding: '8px 18px 18px', overflow: 'visible', background: 'transparent' } }}
      >
        <ProjectRoadmapModule projects={projects} onViewProject={onViewProject} />
      </Card>
    </div>
  )
}
