import { PERMISSION_MENUS } from '@/constants/permissionCenter'
import { evaluateMenuPermission } from '@/lib/permissionCenter'
import type { PermissionCenterModel } from '@/types/permissionCenter'
import type { MainModule } from '@/stores/ui'

export const PERMISSION_MAIN_NAV: { key: Exclude<MainModule, 'projectSpace'>; label: string }[] = [
  { key: 'workbench', label: '工作台' },
  { key: 'projectManagement', label: '项目管理' },
  { key: 'jointProjectSpace', label: '项目组合管理' },
  { key: 'roadmap', label: 'tOS路标' },
  { key: 'hrPipeline', label: '驾驶舱' },
  { key: 'config', label: '配置中心' },
  { key: 'globalPermission', label: '权限中心' },
]

export function canAccessMainModule(model: PermissionCenterModel | undefined, user: string, module: MainModule): boolean {
  const matches = (id: string) => {
    switch (module) {
      case 'workbench': return id === 'workbench'
      case 'projectManagement': return id === 'project.view' || id === 'project.config'
      case 'jointProjectSpace': return id === 'joint.plan'
      case 'roadmap': return id.startsWith('roadmap.')
      case 'hrPipeline': return id.startsWith('cockpit.')
      case 'config': return id.startsWith('config.')
      case 'globalPermission': return id === 'permission.center'
      default: return false
    }
  }
  return PERMISSION_MENUS.some(menu => matches(menu.id) && evaluateMenuPermission(model, user, menu.id, module === 'globalPermission' ? 'manage' : 'view'))
}
