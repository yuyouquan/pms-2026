import { PROJECT_CATEGORY_MACHINE, PROJECT_CATEGORY_TECH, PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { RESOURCE_PERMISSION_ITEMS } from '@/constants/permissions'
import { getProjectSpaceModules } from '@/lib/projectSpaceNavigation'
import { getProjectAttribute } from '@/types/projectRegistry'
import type { ProjectItem } from '@/types/app'

export interface ProjectPermissionAction { key: string; label: string }
export interface ProjectPermissionRow { id: string; label: string; actions: ProjectPermissionAction[]; hint?: string }
export interface ProjectPermissionGroup { id: string; label: string; rows: ProjectPermissionRow[]; hint?: string }

/** Only operations used by the current project-space surfaces belong in this catalog. */
export function getProjectPermissionCatalog(project: Pick<ProjectItem, 'type' | 'projectAttribute'>): ProjectPermissionGroup[] {
  const technical = project.type === PROJECT_CATEGORY_TECH
  const hasMrPlan = project.type === PROJECT_CATEGORY_MACHINE || project.type === PROJECT_TYPE_TOS_VERSION
  const hasTransfer = getProjectAttribute(project) !== 'roadmap' && (project.type === PROJECT_CATEGORY_MACHINE || project.type === PROJECT_TYPE_TOS_VERSION)
  const groups: ProjectPermissionGroup[] = [
    { id: 'basic', label: '基础信息', rows: [
      { id: 'basic-core', label: '基本信息', actions: [{ key: 'basicInfo:查看', label: '查看' }, { key: 'basicInfo:编辑', label: '编辑' }] },
      ...(hasTransfer ? [
        { id: 'basic-plan', label: '计划与配置', actions: [{ key: 'basicInfo:planConfigView', label: '查看' }] },
        { id: 'basic-transfer', label: '转维信息', actions: [{ key: 'basicInfo:transferView', label: '查看' }, { key: 'basicInfo:applyTransfer', label: '申请转维' }] },
      ] : []),
    ] },
    { id: 'plan', label: '计划', hint: '一级计划的维护与发布沿用项目负责人、SPM 等既有职责规则；任务实际进度仍按任务责任人维护。', rows: [
      { id: 'plan-l1', label: technical ? '技术计划' : '一级计划', actions: [
        { key: 'plan:一级计划-查看', label: '查看' }, { key: 'plan:一级计划-分享', label: '分享' },
        ...(technical ? [{ key: 'plan:导入', label: '导入' }] : []), { key: 'plan:导出', label: '导出' },
      ] },
      ...(hasMrPlan ? [{ id: 'plan-mr', label: '三级计划-MR版本计划', hint: '查看权限与一级计划共用；维护沿用项目 SPM 和版本职责规则。', actions: [{ key: 'plan:一级计划-查看', label: '查看' }] }] : []),
      ...(!technical ? [{ id: 'plan-l2', label: '二级计划', hint: '适用于工作台待办中的二级计划；导出用于版本火车计划，与一级计划共用。', actions: [
        { key: 'plan:二级计划-查看', label: '查看' }, { key: 'plan:二级计划-编辑', label: '编辑' }, { key: 'plan:导出', label: '导出' },
      ] }] : []),
    ] },
    { id: 'resources', label: '资源', rows: [
      { id: 'resource-versions', label: '资源版本', hint: '基础信息、里程碑和模型维护随“新建版本”权限生效。', actions: RESOURCE_PERMISSION_ITEMS.filter(item => !['resource:laborEdit', 'resource:nonLaborEdit'].includes(item.key)).map(item => ({ key: item.key, label: item.name })) },
      { id: 'resource-investment', label: '投入配置', actions: RESOURCE_PERMISSION_ITEMS.filter(item => ['resource:laborEdit', 'resource:nonLaborEdit'].includes(item.key)).map(item => ({ key: item.key, label: item.name })) },
    ] },
    { id: 'permission', label: '团队&权限', rows: [{ id: 'permission-roles', label: '角色管理', actions: [{ key: 'projectPermission:manageRoles', label: '管理角色与授权' }] }] },
  ]
  const allowed = getProjectSpaceModules(project)
  return groups.filter(group => !allowed || allowed.includes(group.id))
}
