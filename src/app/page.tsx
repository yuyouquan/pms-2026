'use client'

import { ConfigProvider, Modal, Button, Space, Card, Empty } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore, LEVEL1_TASKS } from '@/stores/plan'
import RoadmapView from '@/components/roadmap/RoadmapView'
import { MainHeader } from '@/containers/AppShell'
import WorkspaceContainer from '@/containers/WorkspaceContainer'
import ProjectSpaceContainer from '@/containers/ProjectSpaceContainer'
import ConfigContainer from '@/containers/ConfigContainer'
import GlobalPermissionContainer from '@/containers/GlobalPermissionContainer'
import AIAssistantContainer from '@/containers/AIAssistantContainer'

// Minimal page-specific style overrides (bulk styles live in globals.css)
const globalStyles = `
  /* All pms-table, pms-modal, pms-card-hover, pms-sidebar, pms-edit-input
     styles are now in globals.css with the purple glassmorphism theme.
     This block is intentionally minimal — only page-specific overrides go here. */
`

export default function Home() {
  // ═══════ Routing-level store hooks ═══════
  const {
    activeModule,
    showLeaveConfirm,
    handleConfirmLeave,
    handleCancelLeave,
  } = useUiStore()

  const {
    projects,
    selectedProject,
    setSelectedProject,
    setSelectedMarketTab,
  } = useProjectStore()

  const {
    marketPlanData,
    setProjectPlanLevel,
  } = usePlanStore()

  const {
    setActiveModule,
    setProjectSpaceModule,
  } = useUiStore()

  // ═══════ Roadmap callback (needs cross-store wiring) ═══════
  const handleViewProjectFromRoadmap = (projectId: string, market?: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    setSelectedProject(project)
    setActiveModule('projectSpace')
    setProjectSpaceModule('plan')
    setProjectPlanLevel('level1')
    if (market && project.type === '整机产品项目') {
      setSelectedMarketTab(market)
    }
  }

  // ═══════ Render ═══════
  return (
    <ConfigProvider autoInsertSpaceInButton={false}>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
        {/* Project Space — full-screen layout with its own header */}
        {activeModule === 'projectSpace' && selectedProject ? (
          <ProjectSpaceContainer />
        ) : (
          <>
            {/* Main header (logo + nav + user switcher) */}
            <MainHeader />

            <div style={{ padding: 24 }}>
              {/* Workspace (projects + work tracker) */}
              {activeModule === 'projects' && <WorkspaceContainer />}

              {/* Roadmap */}
              {activeModule === 'roadmap' && (
                <RoadmapView
                  projects={projects}
                  marketPlanData={marketPlanData}
                  level1Tasks={LEVEL1_TASKS}
                  onViewProject={handleViewProjectFromRoadmap}
                />
              )}

              {/* Global Permission */}
              {activeModule === 'globalPermission' && <GlobalPermissionContainer />}

              {/* HR Pipeline placeholder */}
              {activeModule === 'hrPipeline' && (
                <Card style={{ borderRadius: 8, textAlign: 'center', padding: '80px 0' }}>
                  <Empty
                    description={<span style={{ color: '#9ca3af', fontSize: 14 }}>人力资源管道模块开发中...</span>}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </Card>
              )}

              {/* Config Center */}
              {activeModule === 'config' && <ConfigContainer />}

              {/* AI Assistant */}
              {activeModule === 'aiAssistant' && <AIAssistantContainer />}
            </div>
          </>
        )}
      </div>

      {/* Leave-confirm Modal (shared across all routes) */}
      <Modal
        className="pms-modal"
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
            <span>离开确认</span>
          </Space>
        }
        open={showLeaveConfirm}
        onCancel={handleCancelLeave}
        footer={[
          <Button key="cancel" onClick={handleCancelLeave}>取消</Button>,
          <Button key="confirm" type="primary" danger onClick={handleConfirmLeave}>
            确认离开
          </Button>,
        ]}
        width={420}
      >
        <div style={{ padding: '12px 0', fontSize: 14, color: '#4b5563' }}>
          您还未提交现有编辑内容，是否要离开该界面？
        </div>
      </Modal>
    </ConfigProvider>
  )
}
