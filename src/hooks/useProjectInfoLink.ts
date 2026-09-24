'use client'

import { useEffect, useRef, useState } from 'react'
import { useActivateProject } from '@/hooks/useActivateProject'
import { parseProjectInfoLink } from '@/lib/projectInfoLink'
import { canEnterProjectSpace } from '@/lib/projectListFilters'
import { resolveProjectSpaceModule } from '@/lib/projectSpaceNavigation'
import { hasPermission, isGlobalAdmin, resolvePermissionProjectId, usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'

/** The same permission-checked editor intent used by the workbench's basic-info task. */
export function useProjectInfoLink() {
  const activateProject = useActivateProject()
  const handled = useRef(false)
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    const openLink = () => {
      if (handled.current || !useProjectStore.persist.hasHydrated() || !usePermissionStore.persist.hasHydrated()) return
      const target = parseProjectInfoLink(window.location.search)
      if (!target) return
      handled.current = true
      // Consume the auto-open action once: cancelling the editor must not reopen it.
      const url = new URL(window.location.href)
      url.searchParams.delete('projectId')
      url.searchParams.delete('action')
      window.history.replaceState(window.history.state, '', url)
      if ('error' in target) { setLinkError(target.error); return }
      const { projects, currentLoginUser } = useProjectStore.getState()
      const project = projects.find(item => item.id === target.projectId)
      if (!project) { setLinkError('该项目不存在或已删除，无法打开通知中的项目。'); return }
      const permissionId = resolvePermissionProjectId(project.id, typeof project.parentProjectId === 'string' ? project.parentProjectId : undefined)
      if (!canEnterProjectSpace(permissionId, currentLoginUser, usePermissionStore.getState().rolesByProject, isGlobalAdmin(currentLoginUser))) {
        setLinkError('当前用户无权访问该项目空间。'); return
      }
      const canEdit = hasPermission(currentLoginUser, permissionId, 'basicInfo:查看')
        && hasPermission(currentLoginUser, permissionId, 'basicInfo:编辑')
      useUiStore.getState().navigateWithEditGuard(() => {
        activateProject(project)
        const ui = useUiStore.getState()
        ui.setIsEditMode(false)
        ui.setProjectSpaceModule(resolveProjectSpaceModule(project, 'basic'))
        ui.setProjectInfoNavigationIntent(canEdit ? { projectId: project.id, currentUser: currentLoginUser } : null)
        ui.enterProjectSpace({ module: 'projectManagement', projectManagementTab: 'configuration' })
        if (!canEdit) setLinkError('当前用户没有项目基础信息编辑权限，已打开项目空间。')
      }, false)
    }
    const offProjects = useProjectStore.persist.onFinishHydration(openLink)
    const offPermissions = usePermissionStore.persist.onFinishHydration(openLink)
    openLink()
    return () => { offProjects(); offPermissions() }
  }, [activateProject])

  return linkError
}
