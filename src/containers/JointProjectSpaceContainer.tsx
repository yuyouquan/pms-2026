'use client'

import { Card, Segmented } from 'antd'
import JointMrVersionPlan from '@/components/joint/JointMrVersionPlan'
import { useActivateProject } from '@/hooks/useActivateProject'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { useUiStore } from '@/stores/ui'

export default function JointProjectSpaceContainer() {
  const projects = useProjectStore(state => state.projects)
  const activateProject = useActivateProject()
  const setProjectPlanLevel = usePlanStore(state => state.setProjectPlanLevel)
  const {
    enterProjectSpace,
    navigateWithEditGuard,
    setProjectSpaceModule,
    setMrPlanNavigationIntent,
  } = useUiStore()

  const handleOpenProject = (projectId: string, mrTosVersion: string) => {
    const project = projects.find(item => item.id === projectId)
    if (!project) return
    navigateWithEditGuard(() => {
      activateProject(project)
      setMrPlanNavigationIntent({ source: 'joint-mr', projectId, mrTosVersion })
      setProjectSpaceModule('plan')
      setProjectPlanLevel('mr-version-plan')
      enterProjectSpace({ module: 'jointProjectSpace' })
    }, false)
  }

  return (
    <section className="pms-joint-space" aria-label="项目组合管理">
      <Card className="pms-joint-space__card pms-solid-surface" variant="borderless">
        <div className="pms-joint-space__view-mode">
          <Segmented
            aria-label="项目组合管理视图"
            value="mr-version-plan"
            options={[{ label: 'tOS&整机1+N项目计划', value: 'mr-version-plan' }]}
          />
        </div>
        <JointMrVersionPlan onOpenProject={handleOpenProject} />
      </Card>
    </section>
  )
}
