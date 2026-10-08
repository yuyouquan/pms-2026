'use client'

import { App, Card, Empty, Segmented } from 'antd'
import { useMenuPermission, usePermissionStore, isGlobalAdmin, hasAllProjectSpaceView } from '@/stores/permission'
import { canEnterProjectSpace } from '@/lib/projectListFilters'
import JointMrVersionPlan from '@/components/joint/JointMrVersionPlan'
import { useActivateProject } from '@/hooks/useActivateProject'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { useUiStore } from '@/stores/ui'

export default function JointProjectSpaceContainer() {
  const { message } = App.useApp()
  const currentLoginUser = useProjectStore(state => state.currentLoginUser)
  const permission = useMenuPermission(currentLoginUser, 'joint.plan')
  const rolesByProject = usePermissionStore(state => state.rolesByProject)
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
    if (!project || !permission.can('view', project)) return
    if (!canEnterProjectSpace(projectId, currentLoginUser, rolesByProject, isGlobalAdmin(currentLoginUser), hasAllProjectSpaceView(currentLoginUser))) { message.warning('当前用户未配置该项目空间角色，无法进入项目空间'); return }
    navigateWithEditGuard(() => {
      activateProject(project)
      setMrPlanNavigationIntent({ source: 'joint-mr', projectId, mrTosVersion })
      setProjectSpaceModule('plan')
      setProjectPlanLevel('mr-version-plan')
      enterProjectSpace({ module: 'jointProjectSpace' })
    }, false)
  }

  if (!permission.can()) return <Empty description="暂无项目组合计划权限" />

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
        <div className="pms-joint-space__content-panel">
          <JointMrVersionPlan onOpenProject={handleOpenProject} />
        </div>
      </Card>
    </section>
  )
}
