'use client'

import { useEffect } from 'react'
import { Modal, Button, Space, Card, Empty } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import RoadmapView from '@/components/roadmap/RoadmapView'
import { parseProjectViewShare } from '@/components/roadmap/utils'
import { MainHeader } from '@/containers/AppShell'
import WorkbenchContainer from '@/containers/WorkbenchContainer'
import ProjectListContainer from '@/containers/ProjectListContainer'
import ProjectSpaceContainer from '@/containers/ProjectSpaceContainer'
import ConfigContainer from '@/containers/ConfigContainer'
import HrPipelineContainer from '@/containers/HrPipelineContainer'
import { useActivateProject } from '@/hooks/useActivateProject'
import type { ProjectItem } from '@/types/app'

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
  } = useProjectStore()
  const activateProject = useActivateProject()

  const { setProjectPlanLevel } = usePlanStore()

  const {
    setActiveModule,
    enterProjectSpace,
    setProjectSpaceModule,
  } = useUiStore()

  useEffect(() => {
    if (parseProjectViewShare()) {
      setActiveModule('roadmap')
    }
  }, [setActiveModule])

  // ═══════ Roadmap callback (needs cross-store wiring) ═══════
  const handleViewProjectFromRoadmap = (projectId: string, market?: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    activateProject(project, { market })
    enterProjectSpace({ module: 'roadmap' })
    setProjectSpaceModule('plan')
    setProjectPlanLevel('level1')
  }

  // ═══════ Render ═══════
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div className="pms-page-shell">
        {/* Project Space — full-screen layout with its own header */}
        {activeModule === 'projectSpace' && selectedProject ? (
          <ProjectSpaceContainer />
        ) : (
          <>
            {/* Main header (logo + nav + user switcher) */}
            <MainHeader />

            <div className="pms-main-content" style={{ padding: 24 }}>
              {/* Workbench (todo center + work tracker) */}
              {activeModule === 'workbench' && <WorkbenchContainer />}

              {/* Dedicated project list */}
              {activeModule === 'projectList' && <ProjectListContainer />}

              {/* Roadmap */}
              {activeModule === 'roadmap' && (
                <RoadmapView
                  projects={projects as unknown as ProjectItem[]}
                  onViewProject={handleViewProjectFromRoadmap}
                />
              )}

              {/* HR Pipeline */}
              {activeModule === 'hrPipeline' && <HrPipelineContainer />}

              {/* Config Center */}
              {activeModule === 'config' && <ConfigContainer />}
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
    </>
  )
}
