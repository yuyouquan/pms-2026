'use client'

import { useEffect, useState } from 'react'
import { Card, Space } from 'antd'
import { AppstoreOutlined, GlobalOutlined, FlagOutlined, RocketOutlined, TableOutlined } from '@ant-design/icons'
import MilestoneView from './MilestoneView'
import MRTrainView from './MRTrainView'
import ProjectPlanSummaryBoard from './ProjectPlanSummaryBoard'
import { PROJECT_VIEW_KINDS, parseProjectViewShare } from './utils'

interface RoadmapViewProps {
  projects: any[]
  marketPlanData: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: any[] }>
  level1Tasks: any[]
  onViewProject: (projectId: string, market?: string) => void
}

export default function RoadmapView({ projects, marketPlanData, level1Tasks, onViewProject }: RoadmapViewProps) {
  const [activeProjectView, setActiveProjectView] = useState<'summary' | 'roadmap'>('summary')
  const [activeView, setActiveView] = useState<'milestone' | 'mr-train'>('milestone')
  const mrTrainDisabled = true

  useEffect(() => {
    const sharedView = parseProjectViewShare()
    if (sharedView?.kind === PROJECT_VIEW_KINDS.roadmapMilestone) {
      setActiveProjectView('roadmap')
      setActiveView('milestone')
    }
    if (sharedView?.kind === PROJECT_VIEW_KINDS.summaryBoard) {
      setActiveProjectView('summary')
      setActiveView('milestone')
    }
  }, [])

  useEffect(() => {
    if (mrTrainDisabled && activeView === 'mr-train') {
      setActiveView('milestone')
    }
  }, [activeView, mrTrainDisabled])

  const PROJECT_VIEW_OPTIONS = [
    { key: 'summary' as const, label: '项目计划汇总看板', icon: <TableOutlined /> },
    { key: 'roadmap' as const, label: '项目路标视图', icon: <GlobalOutlined /> },
  ]

  const VIEW_OPTIONS = [
    { key: 'milestone' as const, label: '里程碑视图', icon: <FlagOutlined /> },
    { key: 'mr-train' as const, label: 'MR版本火车视图', icon: <RocketOutlined /> },
  ]

  const renderRoadmapViewSwitcher = () => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '3px 4px', background: '#f3f4f6', borderRadius: 22,
    }}>
      {VIEW_OPTIONS.map(v => {
        const isActive = activeView === v.key
        const isDisabled = mrTrainDisabled && v.key === 'mr-train'
        return (
          <div
            key={v.key}
            aria-disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return
              setActiveView(v.key)
            }}
            style={{
              padding: '5px 18px', borderRadius: 18, cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.25s',
              display: 'flex', alignItems: 'center', gap: 6,
              background: isActive && !isDisabled ? '#fff' : 'transparent',
              color: isDisabled ? '#94a3b8' : (isActive ? '#4338ca' : '#64748b'),
              opacity: isDisabled ? 0.72 : 1,
              boxShadow: isActive && !isDisabled ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {v.icon}
            {v.label}
          </div>
        )
      })}
    </div>
  )

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
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>项目视图</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>全局查看项目计划汇总、里程碑路标与版本节奏</div>
          </div>
        </Space>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 4px', background: 'rgba(255,255,255,0.15)', borderRadius: 22,
        }}>
          {PROJECT_VIEW_OPTIONS.map(v => {
            const isActive = activeProjectView === v.key
            return (
              <div
                key={v.key}
                onClick={() => setActiveProjectView(v.key)}
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
              </div>
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
          <>
            {activeView === 'mr-train' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  {renderRoadmapViewSwitcher()}
                </div>
                <MRTrainView onViewProject={onViewProject} />
              </>
            ) : (
              <MilestoneView
                projects={projects}
                marketPlanData={marketPlanData}
                level1Tasks={level1Tasks}
                onViewProject={onViewProject}
                scopeExtra={renderRoadmapViewSwitcher()}
              />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
