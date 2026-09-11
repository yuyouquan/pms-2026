'use client'

import { useEffect } from 'react'
import { useRoadmapRegistryMigration } from '@/hooks/useRoadmapRegistryMigration'
import { isFormalProject } from '@/types/projectRegistry'
import { Alert, Modal, Button, Space } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import RoadmapView from '@/components/roadmap/RoadmapView'
import { parseProjectViewShare } from '@/components/roadmap/utils'
import { MainHeader } from '@/containers/AppShell'
import WorkbenchContainer from '@/containers/WorkbenchContainer'
import ProjectManagementContainer from '@/containers/ProjectManagementContainer'
import ProjectSpaceContainer from '@/containers/ProjectSpaceContainer'
import ConfigContainer from '@/containers/ConfigContainer'
import JointProjectSpaceContainer from '@/containers/JointProjectSpaceContainer'
import HrPipelineContainer from '@/containers/HrPipelineContainer'
import { useActivateProject } from '@/hooks/useActivateProject'
import type { ProjectItem } from '@/types/app'
import ProjectSpaceAccessBoundary from '@/components/permission/ProjectSpaceAccessBoundary'

// Minimal page-specific style overrides (bulk styles live in globals.css)
const globalStyles = `
  /* All pms-table, pms-modal, pms-card-hover, pms-sidebar, pms-edit-input
     styles are now in globals.css with the purple glassmorphism theme.
     This block is intentionally minimal — only page-specific overrides go here. */
`

export default function Home() {
  const roadmapMigrationConflicts = useRoadmapRegistryMigration()
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
    currentLoginUser,
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
    useUiStore.getState().navigateWithEditGuard(() => {
    activateProject(project, { market })
    enterProjectSpace({ module: 'roadmap' })
    setProjectSpaceModule(isFormalProject(project) ? 'plan' : 'basic')
    setProjectPlanLevel('level1')
    }, false)
  }

  // ═══════ Render ═══════
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div className="pms-page-shell">
        {/* Project Space — full-screen layout with its own header */}
        {activeModule === 'projectSpace' && selectedProject ? (
          <ProjectSpaceAccessBoundary>
            <ProjectSpaceContainer key={`${selectedProject.id}::${currentLoginUser}`} />
          </ProjectSpaceAccessBoundary>
        ) : (
          <>
            {/* Main header (logo + nav + user switcher) */}
            <MainHeader />
            {roadmapMigrationConflicts.map(conflict => <Alert key={conflict} type="warning" showIcon message={conflict} />)}

            <div className="pms-main-content" style={{ padding: 24 }}>
              {/* Workbench (todo center + work tracker) */}
              {activeModule === 'workbench' && <WorkbenchContainer />}

              {/* Project configuration and formal-project views */}
              {activeModule === 'projectManagement' && <ProjectManagementContainer />}

              {/* Cross-project MR aggregation workspace */}
              {activeModule === 'jointProjectSpace' && <JointProjectSpaceContainer />}

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
