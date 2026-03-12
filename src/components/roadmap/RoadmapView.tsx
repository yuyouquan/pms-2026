'use client'

import { useState } from 'react'
import { Card, Tabs, Space } from 'antd'
import { FlagOutlined, RocketOutlined } from '@ant-design/icons'
import MilestoneView from './MilestoneView'
import MRTrainView from './MRTrainView'

interface RoadmapViewProps {
  projects: any[]
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>
  level1Tasks: any[]
  onViewProject: (projectId: string, market?: string) => void
}

export default function RoadmapView({ projects, marketPlanData, level1Tasks, onViewProject }: RoadmapViewProps) {
  const [activeTab, setActiveTab] = useState('milestone')

  return (
    <Card style={{ borderRadius: 8 }} styles={{ body: { padding: '0 20px 20px' } }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'milestone',
            label: (
              <Space size={4}>
                <FlagOutlined />
                <span>里程碑视图</span>
              </Space>
            ),
            children: (
              <MilestoneView
                projects={projects}
                marketPlanData={marketPlanData}
                level1Tasks={level1Tasks}
                onViewProject={onViewProject}
              />
            ),
          },
          {
            key: 'mr-train',
            label: (
              <Space size={4}>
                <RocketOutlined />
                <span>MR版本火车视图</span>
              </Space>
            ),
            children: (
              <MRTrainView onViewProject={onViewProject} />
            ),
          },
        ]}
      />
    </Card>
  )
}
