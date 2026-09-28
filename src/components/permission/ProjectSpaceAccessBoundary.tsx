'use client'

import { useEffect, type ReactNode } from 'react'
import { Button, Card, Empty } from 'antd'
import { MainHeader } from '@/containers/AppShell'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore, resolvePermissionProjectId, isGlobalAdmin } from '@/stores/permission'
import { useProjectTeamStore } from '@/stores/projectTeam'
import { useUiStore } from '@/stores/ui'
import { useTransferStore } from '@/stores/transfer'
import { canEnterProjectSpace } from '@/lib/projectListFilters'

/** Re-check the live role scope on every entry and identity/permission change. */
export default function ProjectSpaceAccessBoundary({ children }: { children: ReactNode }) {
  const { selectedProject, currentLoginUser } = useProjectStore()
  const { rolesByProject } = usePermissionStore()
  useProjectTeamStore(state => state.teamsByProjectId)
  const permissionProjectId = resolvePermissionProjectId(
    selectedProject?.id || '',
    typeof selectedProject?.parentProjectId === 'string' ? selectedProject.parentProjectId : undefined,
  )
  const allowed = Boolean(selectedProject) && canEnterProjectSpace(
    permissionProjectId,
    currentLoginUser,
    rolesByProject,
    isGlobalAdmin(currentLoginUser),
  )

  useEffect(() => {
    if (allowed) return
    useUiStore.getState().setIsEditMode(false)
    useUiStore.getState().setShowVersionCompare(false)
    useUiStore.getState().setShowColumnModal(false)
    useUiStore.getState().setShowCreateLevel2Plan(false)
    useProjectStore.getState().setBasicInfoEditMode(false)
    useProjectStore.getState().setEditingProjectFields({})
    useTransferStore.getState().setTransferView(null)
  }, [allowed])

  if (allowed) return children
  return <>
    <MainHeader />
    <div className="pms-main-content">
      <Card>
        <Empty description="当前用户不在该项目团队中，且未配置项目空间角色，无法查看项目内容">
          <Button type="primary" onClick={() => {
            useUiStore.getState().returnFromProjectSpace()
            useProjectStore.getState().setSelectedProject(null)
          }}>返回来源页面</Button>
        </Empty>
      </Card>
    </div>
  </>
}
